/**
 * Reading a zip export without loading it: the central directory is read from the end of the file, and each entry is
 * a slice of the file piped through the browser's DecompressionStream, so a large export zip streams like a plain file.
 * Stored and deflated entries, and zip64 (exports over 4 GB).
 */
export interface BlobLike {
  size: number;
  slice(start?: number, end?: number): BlobLike;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): ReadableStream<Uint8Array>;
}
export interface ZipEntry {
  name: string;
  method: number;
  compSize: number;
  size: number;
  offset: number;
}

const u16 = (v: DataView, o: number) => v.getUint16(o, true);
const u32 = (v: DataView, o: number) => v.getUint32(o, true);
const u64 = (v: DataView, o: number) => u32(v, o) + u32(v, o + 4) * 2 ** 32;

/** Whether these first bytes start a zip. */
export const isZip = (head: Uint8Array): boolean => head[0] === 0x50 && head[1] === 0x4b && head[2] === 3 && head[3] === 4;

/** The entries of a zip, read from its central directory (folders left out). */
export async function zipEntries(file: BlobLike): Promise<ZipEntry[]> {
  const tailLen = Math.min(file.size, 65557);
  const tail = new Uint8Array(await file.slice(file.size - tailLen).arrayBuffer());
  const tv = new DataView(tail.buffer);
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) if (u32(tv, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip');
  let count = u16(tv, eocd + 10);
  let cdSize = u32(tv, eocd + 12);
  let cdOff = u32(tv, eocd + 16);
  if (eocd >= 20 && u32(tv, eocd - 20) === 0x07064b50) {
    const z64 = u64(tv, eocd - 12);
    const rec = new DataView(await file.slice(z64, z64 + 56).arrayBuffer());
    if (u32(rec, 0) === 0x06064b50) { count = u64(rec, 32); cdSize = u64(rec, 40); cdOff = u64(rec, 48); }
  }
  const cd = new Uint8Array(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
  const v = new DataView(cd.buffer);
  const dec = new TextDecoder();
  const out: ZipEntry[] = [];
  let p = 0;
  for (let n = 0; n < count && p + 46 <= cd.length && u32(v, p) === 0x02014b50; n++) {
    const method = u16(v, p + 10);
    let compSize = u32(v, p + 20);
    let size = u32(v, p + 24);
    const nameLen = u16(v, p + 28);
    const extraLen = u16(v, p + 30);
    const commentLen = u16(v, p + 32);
    let offset = u32(v, p + 42);
    const name = dec.decode(cd.subarray(p + 46, p + 46 + nameLen));
    // zip64 extra field: the 64-bit values appear only for those set to 0xffffffff, in this order
    let e = p + 46 + nameLen;
    const eEnd = e + extraLen;
    while (e + 4 <= eEnd) {
      const id = u16(v, e);
      const len = u16(v, e + 2);
      if (id === 1) {
        let q = e + 4;
        if (size === 0xffffffff) { size = u64(v, q); q += 8; }
        if (compSize === 0xffffffff) { compSize = u64(v, q); q += 8; }
        if (offset === 0xffffffff) offset = u64(v, q);
      }
      e += 4 + len;
    }
    if (!name.endsWith('/')) out.push({ name, method, compSize, size, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** One entry's bytes as a stream (inflated when deflated); `count` hears how many stored bytes have been read. */
export async function zipStream(file: BlobLike, e: ZipEntry, count?: (n: number) => void): Promise<ReadableStream<Uint8Array>> {
  const lh = new DataView(await file.slice(e.offset, e.offset + 30).arrayBuffer());
  if (u32(lh, 0) !== 0x04034b50) throw new Error('bad zip entry');
  const start = e.offset + 30 + u16(lh, 26) + u16(lh, 28);
  let raw = file.slice(start, start + e.compSize).stream();
  if (count) raw = raw.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(c, ctl) { count(c.length); ctl.enqueue(c); } }));
  if (e.method === 0) return raw;
  if (e.method !== 8) throw new Error('unsupported zip method');
  return raw.pipeThrough(new DecompressionStream('deflate-raw') as unknown as TransformStream<Uint8Array, Uint8Array>);
}
