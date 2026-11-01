/**
 * A small ZIP reader for the arcade's game packages, run on the phone: the free packages are fetched whole (a few to
 * twenty-odd MB) and the game's files are taken out of them here, so nothing of ours ever redistributes them.
 *
 * It reads the central directory (so an archive behind a self-extractor stub, like DOOM's shareware DOOMS_19.EXE, reads
 * the same: every offset is shifted by the stub's length), and inflates with the browser's own DecompressionStream
 * ('deflate-raw': Safari 16.4+, Chrome, Node 22). Every member is checked against its CRC-32 and size, so a damaged
 * download or a bad inflate never reaches an engine.
 */

export interface ZipEntry {
  /** The member's path inside the archive, as stored ('freedoom-0.13.0/freedoom1.wad'). */
  name: string;
  /** 0 stored, 8 deflated (the only two the packages use). */
  method: number;
  /** Compressed and uncompressed sizes in bytes. */
  csize: number;
  usize: number;
  crc: number;
  /** Where its local header starts in the buffer (already shifted past any stub before the archive). */
  offset: number;
}

const u16 = (b: Uint8Array, o: number): number => (b[o] ?? 0) | ((b[o + 1] ?? 0) << 8);
const u32 = (b: Uint8Array, o: number): number => (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0;

/** The archive's members, from its central directory. Throws when the buffer holds no readable archive. */
export function zipEntries(buf: Uint8Array): ZipEntry[] {
  // the end-of-central-directory record: the last 22 bytes, or earlier by up to 64 KB of comment
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (u32(buf, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a ZIP archive');
  const count = u16(buf, eocd + 10);
  const cdSize = u32(buf, eocd + 12);
  const cdOffset = u32(buf, eocd + 16);
  // a stub (or anything) before the archive moves every stored offset by the same amount
  const shift = eocd - cdSize - cdOffset;
  if (shift < 0) throw new Error('the archive is damaged (its directory points outside it)');
  const out: ZipEntry[] = [];
  let p = cdOffset + shift;
  for (let n = 0; n < count; n++) {
    if (u32(buf, p) !== 0x02014b50) throw new Error('the archive is damaged (a directory entry is missing)');
    const nameLen = u16(buf, p + 28);
    const extraLen = u16(buf, p + 30);
    const commentLen = u16(buf, p + 32);
    out.push({
      name: new TextDecoder('latin1').decode(buf.subarray(p + 46, p + 46 + nameLen)),
      method: u16(buf, p + 10),
      crc: u32(buf, p + 16),
      csize: u32(buf, p + 20),
      usize: u32(buf, p + 24),
      offset: u32(buf, p + 42) + shift,
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** Find a member by its path, ignoring case and slash direction (DOS archives say 'ID1\PAK0.PAK' or 'ID1/PAK0.PAK'). */
export function findEntry(entries: ZipEntry[], name: string): ZipEntry | undefined {
  const norm = (s: string) => s.replace(/\\/g, '/').toLowerCase();
  const want = norm(name);
  return entries.find((e) => norm(e.name) === want);
}

let table: Uint32Array | null = null;
/** CRC-32 (the ZIP polynomial). */
export function crc32(data: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = (table[(c ^ (data[i] ?? 0)) & 0xff] ?? 0) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('this browser cannot unpack the download (no DecompressionStream)');
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** One member's bytes, checked against its size and CRC-32. */
export async function zipRead(buf: Uint8Array, e: ZipEntry): Promise<Uint8Array> {
  if (u32(buf, e.offset) !== 0x04034b50) throw new Error(`the archive is damaged (${e.name} has no header)`);
  const start = e.offset + 30 + u16(buf, e.offset + 26) + u16(buf, e.offset + 28);
  const raw = buf.subarray(start, start + e.csize);
  if (raw.length !== e.csize) throw new Error(`the archive is cut short (${e.name})`);
  let out: Uint8Array;
  if (e.method === 0) out = raw.slice();
  else if (e.method === 8) out = await inflateRaw(raw);
  else throw new Error(`${e.name} is packed in a way this reader does not know (method ${e.method})`);
  if (out.length !== e.usize || crc32(out) !== e.crc) throw new Error(`${e.name} did not unpack whole (size or CRC-32 differs)`);
  return out;
}

/** Join byte arrays end to end (the shareware's two floppy parts are one self-extracting archive). */
export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
