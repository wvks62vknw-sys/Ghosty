/**
 * A PNG from RGB pixels (8-bit truecolour), compressed with the platform's own deflate
 * (CompressionStream: Workers, browsers and Node 18+). Each row gets the PNG filter that makes it
 * smallest, so a 512 px icon with a smooth glow comes to a few kilobytes.
 */
let table: Uint32Array | null = null;
function crc32(bytes: Uint8Array, start = 0, end = bytes.length): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = start; i < end; i++) c = table[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

const paeth = (a: number, b: number, c: number) => {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** The rows, each led by the filter byte that keeps it smallest (the usual "minimum sum" choice). */
export function filterRows(rgb: Uint8Array, w: number, h: number): Uint8Array {
  const stride = w * 3;
  const out = new Uint8Array(h * (stride + 1));
  const trial = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    const prev = y ? row - stride : -1;
    let bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      let sum = 0;
      for (let x = 0; x < stride; x++) {
        const raw = rgb[row + x]!;
        const a = x >= 3 ? rgb[row + x - 3]! : 0;
        const b = prev >= 0 ? rgb[prev + x]! : 0;
        const c = prev >= 0 && x >= 3 ? rgb[prev + x - 3]! : 0;
        const v = (f === 0 ? raw : f === 1 ? raw - a : f === 2 ? raw - b : f === 3 ? raw - ((a + b) >> 1) : raw - paeth(a, b, c)) & 0xff;
        trial[x] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        out[y * (stride + 1)] = f;
        out.set(trial, y * (stride + 1) + 1);
      }
    }
  }
  return out;
}

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A complete PNG file. */
export async function encodePng(rgb: Uint8Array, w: number, h: number): Promise<Uint8Array> {
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w);
  dv.setUint32(4, h);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', await deflate(filterRows(rgb, w, h))), chunk('IEND', new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, x) => s + x.length, 0));
  let at = 0;
  for (const x of parts) {
    out.set(x, at);
    at += x.length;
  }
  return out;
}
