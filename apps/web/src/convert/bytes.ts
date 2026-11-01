/**
 * THE CONVERTER's bytes (BRIEF-REST-E part 1): what a file is from its first bytes, its size in words, checksums, base64,
 * and the plain helpers every conversion shares. Pure: tested in Node (apps/edge/test/reste.test.mjs).
 */

export const utf8 = new TextEncoder();
const strict = new TextDecoder('utf-8', { fatal: true });
const loose = new TextDecoder();

/** Bytes as text: UTF-8 when it is, else read as Windows-1252 (what a "plain text" file from an old PC usually is). */
export function textOf(bytes: Uint8Array): string {
  const b = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? bytes.subarray(3) : bytes;
  try {
    return strict.decode(b);
  } catch {
    return new TextDecoder('windows-1252').decode(b);
  }
}

export function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

let CRC: Uint32Array | null = null;
/** CRC-32 (zip, PNG). */
export function crc32(data: Uint8Array, crc = 0): number {
  if (!CRC) {
    CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC[n] = c >>> 0;
    }
  }
  let c = ~crc >>> 0;
  for (let i = 0; i < data.length; i++) c = CRC[(c ^ data[i]!) & 0xff]! ^ (c >>> 8);
  return ~c >>> 0;
}

/** Adler-32 (the zlib wrapper's checksum). */
export function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; ) {
    const end = Math.min(data.length, i + 3800);
    for (; i < end; i++) {
      a += data[i]!;
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

/** Bytes as base64 (standard alphabet, padded). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Base64 (standard or URL-safe, with or without padding and spaces) as bytes; null when it is not base64. */
export function fromBase64(s: string): Uint8Array | null {
  const clean = s.replace(/^data:[^,]*,/, '').replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean) || clean.replace(/=+$/, '').length % 4 === 1) return null;
  try {
    const bin = atob(clean + '='.repeat((4 - (clean.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** Text as base64 (its UTF-8 bytes). */
export const textToBase64 = (t: string): string => toBase64(utf8.encode(t));
/** Base64 as text: null when it is not base64 or its bytes are not UTF-8 text (then it is a file, not words). */
export function base64ToText(s: string): string | null {
  const b = fromBase64(s);
  if (!b) return null;
  try {
    return strict.decode(b);
  } catch {
    return null;
  }
}
export const looseText = (b: Uint8Array): string => loose.decode(b);

/** A size as he would say it: "820 bytes", "34 KB", "2.4 MB". */
export function sizeWords(n: number): string {
  if (n < 1000) return `${n} byte${n === 1 ? '' : 's'}`;
  if (n < 1_000_000) return `${Math.round(n / 100) / 10 >= 100 ? Math.round(n / 1000) : Math.round(n / 100) / 10} KB`;
  return `${Math.round(n / 100_000) / 10} MB`;
}

/** What a file can be, as the converter knows it. */
export type Kind =
  | 'jpg' | 'png' | 'webp' | 'gif' | 'heic' | 'bmp' | 'tiff' | 'svg'
  | 'pdf' | 'docx' | 'xlsx' | 'pptx' | 'epub' | 'odt' | 'ods' | 'zip'
  | 'csv' | 'tsv' | 'json' | 'txt' | 'md' | 'html' | 'xml'
  | 'wav' | 'mp3' | 'm4a' | 'aac' | 'ogg' | 'flac' | 'webm' | 'mp4' | 'mov' | 'video'
  | 'unknown';

/** The kind's name in words, for "photo.jpg — a JPEG photo, 2.4 MB". */
export const KIND_WORDS: Record<Kind, string> = {
  jpg: 'a JPEG photo', png: 'a PNG picture', webp: 'a WebP picture', gif: 'a GIF', heic: 'an iPhone HEIC photo', bmp: 'a BMP picture', tiff: 'a TIFF picture', svg: 'an SVG drawing',
  pdf: 'a PDF', docx: 'a Word document', xlsx: 'an Excel spreadsheet', pptx: 'a PowerPoint deck', epub: 'an e-book (EPUB)', odt: 'an OpenDocument text', ods: 'an OpenDocument spreadsheet', zip: 'a zip archive',
  csv: 'a CSV table', tsv: 'a tab-separated table', json: 'a JSON file', txt: 'plain text', md: 'Markdown text', html: 'a web page (HTML)', xml: 'an XML file',
  wav: 'a WAV recording', mp3: 'an MP3', m4a: 'an M4A recording', aac: 'an AAC recording', ogg: 'an Ogg recording', flac: 'a FLAC recording', webm: 'a WebM recording', mp4: 'an MP4 video', mov: 'a QuickTime video', video: 'a video',
  unknown: 'a file I don’t know',
};

const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));

/**
 * What a file is, from its first bytes (at least 64 of them), its name and the type the browser gave it: the bytes win,
 * the name decides between the zip-based formats and between the plain-text ones.
 */
export function sniff(head: Uint8Array, name = '', type = ''): Kind {
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? '').toLowerCase();
  const b = head;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x89 && ascii(b, 1, 3) === 'PNG') return 'png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WAVE') return 'wav';
  if (ascii(b, 0, 4) === 'GIF8') return 'gif';
  if (ascii(b, 0, 2) === 'BM') return 'bmp';
  if (ascii(b, 0, 4) === 'II*\0' || ascii(b, 0, 4) === 'MM\0*') return 'tiff';
  if (ascii(b, 0, 5) === '%PDF-') return 'pdf';
  if (ascii(b, 0, 4) === 'fLaC') return 'flac';
  if (ascii(b, 0, 4) === 'OggS') return 'ogg';
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && ((b[1] ?? 0) & 0xe6) === 0xe2)) return 'mp3';
  if (b[0] === 0xff && ((b[1] ?? 0) & 0xf6) === 0xf0) return 'aac';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'webm';
  if (ascii(b, 4, 4) === 'ftyp') {
    const brand = ascii(b, 8, 4);
    if (/^(heic|heix|heim|heis|hevc|hevx|mif1|msf1|avif)$/.test(brand)) return brand === 'avif' ? 'unknown' : 'heic';
    if (/^M4A |^M4B /.test(brand)) return 'm4a';
    if (brand === 'qt  ') return 'mov';
    return ext === 'm4a' ? 'm4a' : 'mp4';
  }
  if (ascii(b, 0, 4) === 'PK\x03\x04') {
    if (ascii(b, 30, 8) === 'mimetype') {
      const mt = ascii(b, 38, 40);
      if (mt.startsWith('application/epub+zip')) return 'epub';
      if (mt.startsWith('application/vnd.oasis.opendocument.text')) return 'odt';
      if (mt.startsWith('application/vnd.oasis.opendocument.spreadsheet')) return 'ods';
    }
    if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx' || ext === 'epub' || ext === 'odt' || ext === 'ods') return ext;
    return 'zip';
  }
  // text: the name, then the type, then a look at the words
  if (ext === 'csv' || type === 'text/csv') return 'csv';
  if (ext === 'tsv' || type === 'text/tab-separated-values') return 'tsv';
  if (ext === 'json' || type === 'application/json') return 'json';
  if (/^(md|markdown|mdx)$/.test(ext) || type === 'text/markdown') return 'md';
  if (/^(html?|xhtml)$/.test(ext) || type === 'text/html') return 'html';
  if (ext === 'svg' || type === 'image/svg+xml') return 'svg';
  if (ext === 'xml') return 'xml';
  if (/^(mov|mkv|avi|m4v)$/.test(ext) || type.startsWith('video/')) return 'video';
  if (ext === 'txt' || type.startsWith('text/')) return 'txt';
  const start = loose.decode(b.subarray(0, 64)).trimStart();
  if (/^<!doctype html|^<html/i.test(start)) return 'html';
  if (/^[[{]/.test(start)) return 'json';
  if (b.length && !b.subarray(0, 64).some((x) => x === 0)) return 'txt';
  return 'unknown';
}

export const IMAGE_KINDS: Kind[] = ['jpg', 'png', 'webp', 'gif', 'heic', 'bmp', 'tiff'];
export const AUDIO_KINDS: Kind[] = ['wav', 'mp3', 'm4a', 'aac', 'ogg', 'flac', 'webm'];
export const VIDEO_KINDS: Kind[] = ['mp4', 'mov', 'video'];
export const TEXT_KINDS: Kind[] = ['txt', 'md', 'html', 'csv', 'tsv', 'json', 'xml'];

/** A file name with a new ending: "Holiday photo.HEIC" → "Holiday photo.jpg". */
export function renamed(name: string, ext: string, tag = ''): string {
  const stem = name.replace(/\.[^./]+$/, '') || 'file';
  return `${stem}${tag ? ` ${tag}` : ''}.${ext}`;
}

/** The type a saved file carries, by its ending. */
export const MIME: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', html: 'text/html', csv: 'text/csv', json: 'application/json',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', zip: 'application/zip',
  wav: 'audio/wav', mp3: 'audio/mpeg', m4a: 'audio/mp4', webm: 'audio/webm', ogg: 'audio/ogg', svg: 'image/svg+xml',
};
