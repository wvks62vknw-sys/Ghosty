/**
 * A 16-BIT PNG, the app's own (BRIEF-EDITOR-PHOTO-2): the RAW reader's picture kept losslessly beside the RAW's bytes. A canvas holds eight
 * bits a channel, so the picture is written and read here: a PNG of three 16-bit channels, one filter (none), the zlib stream made by the
 * browser's own CompressionStream. `decodePng16` reads back only what `encodePng16` wrote (no other filter, no other shape): anything
 * else is refused in plain words. Pure apart from the streams, so the brain test runs it on numbers.
 */
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];

let crcTable: Uint32Array | null = null;
function crc32(parts: Uint8Array[]): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = crcTable[(c ^ p[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const u32 = (n: number): Uint8Array => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const ascii = (s: string): Uint8Array => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const chunk = (type: string, data: Uint8Array[]): Uint8Array[] => {
  const len = data.reduce((n, d) => n + d.length, 0);
  const t = ascii(type);
  return [u32(len), t, ...data, u32(crc32([t, ...data]))];
};

async function pipe(chunks: Uint8Array[], stream: CompressionStream | DecompressionStream): Promise<Uint8Array[]> {
  const w = stream.writable.getWriter();
  const out: Uint8Array[] = [];
  const reader = stream.readable.getReader();
  const reading = (async () => {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      out.push(value);
    }
  })();
  for (const c of chunks) await w.write(c as unknown as Uint8Array<ArrayBuffer>);
  await w.close();
  await reading;
  return out;
}

/** 16-bit interleaved samples (`colors` per pixel, 3 here) to a PNG. */
export async function encodePng16(data: Uint16Array, w: number, h: number): Promise<Blob> {
  const stride = w * 3 * 2;
  const rows: Uint8Array[] = [];
  // a few rows at a time, so the whole raw stream is never held beside the picture
  const batch = Math.max(1, Math.floor((8 << 20) / (stride + 1)));
  for (let y0 = 0; y0 < h; y0 += batch) {
    const n = Math.min(batch, h - y0);
    const buf = new Uint8Array(n * (stride + 1));
    for (let r = 0; r < n; r++) {
      const o = r * (stride + 1);
      buf[o] = 0;
      const src = (y0 + r) * w * 3;
      for (let i = 0; i < w * 3; i++) {
        const v = data[src + i]!;
        buf[o + 1 + i * 2] = v >> 8;
        buf[o + 2 + i * 2] = v & 255;
      }
    }
    rows.push(buf);
  }
  const z = await pipe(rows, new CompressionStream('deflate'));
  const ihdr = new Uint8Array([...u32(w), ...u32(h), 16, 2, 0, 0, 0]);
  const parts: Uint8Array[] = [new Uint8Array(SIGNATURE), ...chunk('IHDR', [ihdr]), ...chunk('IDAT', z), ...chunk('IEND', [])];
  return new Blob(parts as unknown as BlobPart[], { type: 'image/png' });
}

export interface Png16 {
  w: number;
  h: number;
  data: Uint16Array;
}

/** What `encodePng16` wrote, back; throws plain words for anything else. */
export async function decodePng16(blob: Blob): Promise<Png16> {
  const b = new Uint8Array(await blob.arrayBuffer());
  if (b.length < 33 || SIGNATURE.some((v, i) => b[i] !== v)) throw new Error('that is not the picture I kept');
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let at = 8;
  let w = 0;
  let h = 0;
  const idat: Uint8Array[] = [];
  while (at + 8 <= b.length) {
    const len = dv.getUint32(at);
    const type = String.fromCharCode(...b.subarray(at + 4, at + 8));
    const body = b.subarray(at + 8, at + 8 + len);
    if (type === 'IHDR') {
      w = dv.getUint32(at + 8);
      h = dv.getUint32(at + 12);
      if (body[8] !== 16 || body[9] !== 2 || body[12] !== 0) throw new Error('that is not the picture I kept');
    } else if (type === 'IDAT') idat.push(body);
    else if (type === 'IEND') break;
    at += 12 + len;
  }
  if (!w || !h || !idat.length) throw new Error('that is not the picture I kept');
  const raw = await pipe(idat, new DecompressionStream('deflate'));
  const stride = w * 6;
  const out = new Uint16Array(w * h * 3);
  let row = 0;
  let col = -1;
  for (const part of raw) {
    for (let i = 0; i < part.length; i++) {
      if (col < 0) {
        if (part[i] !== 0) throw new Error('that is not the picture I kept');
        col = 0;
        continue;
      }
      const px = row * w * 3 + (col >> 1);
      if (col & 1) out[px] = out[px]! | part[i]!;
      else out[px] = part[i]! << 8;
      col++;
      if (col === stride) {
        col = -1;
        row++;
      }
    }
  }
  if (row !== h) throw new Error('the picture I kept is cut short');
  return { w, h, data: out };
}
