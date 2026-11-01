/**
 * An Apple Health export read as a stream, with no DOM (so the brain's tests run it too): the zip's directory read from its
 * end (ZIP64 too: an export can pass 4 GB), export.xml inflated piece by piece by the browser's own DecompressionStream,
 * each <Record> line weighed by packages/shared/src/body.ts. Nothing is held whole; nothing leaves the phone.
 */
import { feedHealth, healthStart, healthWeek, type HealthAcc, type HealthWeek } from '../../../../../packages/shared/src/body';

/** Where export.xml's bytes are in a zip, and how they are packed (8: deflate, 0: stored). Null when there is none. */
export async function zipEntry(file: Blob, want: (name: string) => boolean): Promise<{ start: number; size: number; method: number } | null> {
  const tailLen = Math.min(file.size, 65_557 + 20);
  const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer());
  let eocd = -1;
  for (let i = tail.byteLength - 22; i >= 0; i--) if (tail.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  let cdSize = tail.getUint32(eocd + 12, true);
  let cdOff = tail.getUint32(eocd + 16, true);
  // ZIP64: the real directory size and offset are in its own end record, found through the locator just before
  if ((cdOff === 0xffffffff || cdSize === 0xffffffff) && eocd >= 20 && tail.getUint32(eocd - 20, true) === 0x07064b50) {
    const z64 = Number(tail.getBigUint64(eocd - 12, true));
    const rec = new DataView(await file.slice(z64, z64 + 56).arrayBuffer());
    cdSize = Number(rec.getBigUint64(40, true));
    cdOff = Number(rec.getBigUint64(48, true));
  }
  const cd = new DataView(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const dec = new TextDecoder();
  for (let p = 0; p + 46 <= cd.byteLength && cd.getUint32(p, true) === 0x02014b50; ) {
    const method = cd.getUint16(p + 10, true);
    let size = cd.getUint32(p + 20, true);
    let local = cd.getUint32(p + 42, true);
    const nLen = cd.getUint16(p + 28, true);
    const xLen = cd.getUint16(p + 30, true);
    const cLen = cd.getUint16(p + 32, true);
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nLen));
    // ZIP64 sizes and offset in the extra field (0x0001), in order, for the ones marked 0xFFFFFFFF
    for (let x = p + 46 + nLen; x + 4 <= p + 46 + nLen + xLen; ) {
      const id = cd.getUint16(x, true);
      const len = cd.getUint16(x + 2, true);
      if (id === 1) {
        let q = x + 4;
        if (cd.getUint32(p + 24, true) === 0xffffffff) q += 8;
        if (size === 0xffffffff) (size = Number(cd.getBigUint64(q, true))), (q += 8);
        if (local === 0xffffffff) local = Number(cd.getBigUint64(q, true));
      }
      x += 4 + len;
    }
    if (want(name)) {
      const lh = new DataView(await file.slice(local, local + 30).arrayBuffer());
      return { start: local + 30 + lh.getUint16(26, true) + lh.getUint16(28, true), size, method };
    }
    p += 46 + nLen + xLen + cLen;
  }
  return null;
}

/** The export's text as a stream: export.xml inside the zip (inflated as it is read), or the file itself. `read` counts the bytes. */
async function exportText(file: File, read: (n: number, of: number) => void): Promise<ReadableStream<string>> {
  let src: Blob = file;
  let inflate = false;
  if (/\.zip$/i.test(file.name) || file.type === 'application/zip') {
    const e = await zipEntry(file, (n) => /(^|\/)export\.xml$/i.test(n));
    if (!e) throw new Error('there is no export.xml in that zip: it needs the Health app’s own export');
    if (e.method !== 0 && e.method !== 8) throw new Error('that zip is packed in a way I can’t read');
    src = file.slice(e.start, e.start + e.size);
    inflate = e.method === 8;
  }
  const of = src.size || 1;
  const counted = src.stream().pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform: (c, ctl) => (read(c.byteLength, of), ctl.enqueue(c)) }));
  const bytes = inflate ? counted.pipeThrough(new DecompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>) : counted;
  return bytes.pipeThrough(new TextDecoderStream() as unknown as TransformStream<Uint8Array, string>);
}

/** Read an export into the last 30 days of steps and sleep; the week is the seven days that end on its last day. */
export async function readExport(file: File, today: string, progress: (frac: number) => void = () => undefined): Promise<{ acc: HealthAcc; week: HealthWeek }> {
  const acc = healthStart(today, 30);
  let got = 0;
  const reader = (await exportText(file, (n, of) => progress(Math.min(1, (got += n) / of)))).getReader();
  let rest = '';
  for (;;) {
    const { done, value } = await reader.read();
    const text = rest + (value ?? '');
    const lines = text.split('\n');
    rest = done ? '' : lines.pop() ?? '';
    for (const l of lines) if (l.includes('StepCount') || l.includes('SleepAnalysis')) feedHealth(acc, l);
    if (done) break;
  }
  return { acc, week: healthWeek(acc) };
}
