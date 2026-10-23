/**
 * Getting an exam board's PDF ready for the library's own reader (library/extract.ts `extractPdf`), on the phone.
 * Two things in the boards' files stop that reader, so this prepares a plain copy first and nothing else:
 *  - AQA's papers are "encrypted" with an EMPTY password (anyone may open them; it only stops editing). The reader
 *    refuses encrypted files, so the copy is unlocked with that empty password (the PDF standard's own method:
 *    RC4 or AES-128, MD5 keys) — never a password guess, and a file that needs a real password is refused.
 *  - Pearson's and OCR's pages draw most of their text inside "form" objects that the reader does not open, so
 *    each form is laid out as a page of its own straight after the page that draws it, with its own fonts.
 * Packed objects (object streams) are unpacked so every page and font is a plain object. The copy is then read by
 * `extractPdf` and the form pages are joined back onto their page, so the text comes out one page per page.
 * Pure apart from WebCrypto (AES-CBC) and DecompressionStream; nothing leaves the phone.
 */
import { extractPdf, type Extracted } from '../library/extract';

interface Obj {
  num: number;
  gen: number;
  dict: string;
  stream?: Uint8Array;
}

/** Bytes → a string with one character per byte (exactly). */
function bin(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192) as unknown as number[]);
  return s;
}
const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);

/** Every top-level object in the file: its number, generation, dictionary text and raw stream bytes. */
function parseObjects(bytes: Uint8Array, str: string): Map<number, Obj> {
  const objs = new Map<number, Obj>();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    const start = m.index + m[0].length;
    const end = str.indexOf('endobj', start);
    if (end < 0) break;
    const s = str.indexOf('stream', start);
    const num = Number(m[1]);
    const gen = Number(m[2]);
    if (s >= 0 && s < end && str.slice(start, s).includes('>>')) {
      let ds = s + 6;
      if (str[ds] === '\r') ds++;
      if (str[ds] === '\n') ds++;
      const dict = str.slice(start, s);
      // The declared length when it is a plain number (binary data may contain "endstream"), else up to endstream.
      const len = Number(dict.match(/\/Length\s+(\d+)(?!\s+\d+\s+R)/)?.[1] ?? NaN);
      const fits = Number.isFinite(len) && /^\s*endstream/.test(str.slice(ds + len, ds + len + 16));
      let de = fits ? ds + len : str.indexOf('endstream', ds);
      if (de < 0) de = end;
      let e = de;
      if (!fits) {
        if (str[e - 1] === '\n') e--;
        if (str[e - 1] === '\r') e--;
      }
      objs.set(num, { num, gen, dict, stream: bytes.subarray(ds, e) });
      const after = str.indexOf('endobj', de);
      re.lastIndex = Math.max(after < 0 ? de : after, start);
    } else {
      objs.set(num, { num, gen, dict: str.slice(start, end) });
      re.lastIndex = end;
    }
  }
  return objs;
}

async function inflate(data: Uint8Array): Promise<Uint8Array | null> {
  for (const fmt of ['deflate', 'deflate-raw'] as const) {
    try {
      const src = fmt === 'deflate' ? data : data.subarray(2);
      const ds = new DecompressionStream(fmt);
      const w = ds.writable.getWriter();
      void w.write(src as unknown as BufferSource).catch(() => undefined);
      void w.close().catch(() => undefined);
      const chunks: Uint8Array[] = [];
      const r = ds.readable.getReader();
      try {
        for (;;) {
          const { done, value } = await r.read();
          if (done) break;
          chunks.push(value);
        }
      } catch {
        // A truncated stream still gives what came before the break.
      }
      const n = chunks.reduce((a, c) => a + c.length, 0);
      if (!n) continue;
      const out = new Uint8Array(n);
      let o = 0;
      for (const c of chunks) (out.set(c, o), (o += c.length));
      return out;
    } catch {
      // try the next format
    }
  }
  return null;
}

// ---- the empty-password unlock (PDF standard security handler, revisions 2–4) -----------------------------

/** MD5 (RFC 1321): the PDF standard's key maker; WebCrypto has no MD5. */
export function md5(data: Uint8Array): Uint8Array {
  const K = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0);
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const len = data.length;
  const padded = new Uint8Array(((len + 8) >>> 6) * 64 + 64);
  padded.set(data);
  padded[len] = 0x80;
  const bits = len * 8;
  const dv = new DataView(padded.buffer);
  dv.setUint32(padded.length - 8, bits >>> 0, true);
  dv.setUint32(padded.length - 4, Math.floor(bits / 2 ** 32), true);
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let off = 0; off < padded.length; off += 64) {
    let a = a0, b = b0, c = c0, d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) (f = (b & c) | (~b & d)), (g = i);
      else if (i < 32) (f = (d & b) | (~d & c)), (g = (5 * i + 1) % 16);
      else if (i < 48) (f = b ^ c ^ d), (g = (3 * i + 5) % 16);
      else (f = c ^ (b | ~d)), (g = (7 * i) % 16);
      const tmp = d;
      d = c;
      c = b;
      const x = (a + f + K[i]! + dv.getUint32(off + g * 4, true)) >>> 0;
      const s = S[(i >> 4) * 4 + (i % 4)]!;
      b = (b + ((x << s) | (x >>> (32 - s)))) >>> 0;
      a = tmp;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }
  const out = new Uint8Array(16);
  const ov = new DataView(out.buffer);
  [a0, b0, c0, d0].forEach((v, i) => ov.setUint32(i * 4, v, true));
  return out;
}

export function rc4(key: Uint8Array, data: Uint8Array): Uint8Array {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i]! + key[i % key.length]!) & 255;
    [s[i], s[j]] = [s[j]!, s[i]!];
  }
  const out = new Uint8Array(data.length);
  for (let k = 0, i = 0, j = 0; k < data.length; k++) {
    i = (i + 1) & 255;
    j = (j + s[i]!) & 255;
    [s[i], s[j]] = [s[j]!, s[i]!];
    out[k] = data[k]! ^ s[(s[i]! + s[j]!) & 255]!;
  }
  return out;
}

const PAD = bytesOf('\x28\xbf\x4e\x5e\x4e\x75\x8a\x41\x64\x00\x4e\x56\xff\xfa\x01\x08\x2e\x2e\x00\xb6\xd0\x68\x3e\x80\x2f\x0c\xa9\xfe\x64\x53\x69\x7a');

/** A PDF string token (literal "(…)" with escapes, or hex "<…>") → its bytes. */
function stringBytes(tok: string): Uint8Array {
  if (tok.startsWith('<')) {
    const hex = tok.slice(1, -1).replace(/[^0-9a-fA-F]/g, '');
    return Uint8Array.from({ length: Math.ceil(hex.length / 2) }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2).padEnd(2, '0'), 16));
  }
  const s = tok.slice(1, -1).replace(/\\(\d{1,3}|\r\n|[\s\S])/g, (_, e: string) => {
    if (/^\d/.test(e)) return String.fromCharCode(parseInt(e, 8) & 255);
    return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\n': '', '\r': '', '\r\n': '' } as Record<string, string>)[e] ?? e;
  });
  return bytesOf(s);
}
/** The string value of /Key in a dictionary (a balanced literal or a hex string). */
function stringOf(dict: string, key: string): Uint8Array | null {
  const i = dict.search(new RegExp(`/${key}\\s*[(<]`));
  if (i < 0) return null;
  const j = dict.indexOf(dict.slice(i).match(/[(<]/)![0], i);
  if (dict[j] === '<') return stringBytes(dict.slice(j, dict.indexOf('>', j) + 1));
  let depth = 0;
  for (let k = j; k < dict.length; k++) {
    if (dict[k] === '\\') {
      k++;
      continue;
    }
    if (dict[k] === '(') depth++;
    else if (dict[k] === ')' && !--depth) return stringBytes(dict.slice(j, k + 1));
  }
  return null;
}

/** A dictionary's text with the dictionaries nested inside it taken out (its own entries only). */
function topLevel(dict: string): string {
  let out = '';
  let depth = 0;
  for (let i = 0; i < dict.length; i++) {
    if (dict[i] === '<' && dict[i + 1] === '<') {
      depth++;
      i++;
      if (depth > 1) continue;
      out += ' ';
      continue;
    }
    if (dict[i] === '>' && dict[i + 1] === '>') {
      depth--;
      i++;
      continue;
    }
    if (depth <= 1) out += dict[i];
  }
  return out;
}

interface Crypt {
  key: Uint8Array;
  aes: boolean;
  /** Streams are encrypted (a crypt filter of /Identity leaves them as they are). */
  streams: boolean;
}

/** The file key for the empty user password, or null when the file needs a real password (or a newer method). */
function fileKey(enc: string, id0: Uint8Array): Crypt | 'locked' | 'unsupported' {
  // Its own entries, not those of the crypt filters inside it (they have a /Length of their own).
  const own = topLevel(enc);
  if (!/\/Filter\s*\/Standard/.test(own)) return 'unsupported';
  const v = Number(own.match(/\/V\s+(\d+)/)?.[1] ?? 0);
  const r = Number(own.match(/\/R\s+(\d+)/)?.[1] ?? 0);
  if (r < 2 || r > 4) return 'unsupported';
  const o = stringOf(enc, 'O');
  const u = stringOf(enc, 'U');
  const p = Number(own.match(/\/P\s+(-?\d+)/)?.[1] ?? 0);
  if (!o || !u) return 'unsupported';
  const n = r === 2 ? 5 : Math.max(5, Math.min(16, Number(own.match(/\/Length\s+(\d+)/)?.[1] ?? 40) / 8));
  let aes = false;
  let streams = true;
  if (v === 4) {
    const stmf = own.match(/\/StmF\s*\/(\w+)/)?.[1] ?? 'Identity';
    if (stmf === 'Identity') streams = false;
    const cfm = enc.match(new RegExp(`/${stmf}\\s*<<[^>]*?/CFM\\s*/(\\w+)`))?.[1] ?? enc.match(/\/CFM\s*\/(\w+)/)?.[1] ?? 'V2';
    if (cfm === 'AESV2') aes = true;
    else if (cfm !== 'V2' && cfm !== 'None') return 'unsupported';
  }
  const meta = !/\/EncryptMetadata\s+false/.test(enc);
  const pb = new Uint8Array(4);
  new DataView(pb.buffer).setInt32(0, p, true);
  const parts = [PAD, o.subarray(0, 32), pb, id0, ...(r >= 4 && !meta ? [Uint8Array.from([255, 255, 255, 255])] : [])];
  const all = new Uint8Array(parts.reduce((a, x) => a + x.length, 0));
  let off = 0;
  for (const x of parts) (all.set(x, off), (off += x.length));
  let h = md5(all);
  if (r >= 3) for (let i = 0; i < 50; i++) h = md5(h.subarray(0, n));
  const key = h.slice(0, n);
  // The empty password is right when the user check value matches (revision 2: the padding itself; 3–4: its hash).
  let check: Uint8Array;
  if (r === 2) check = rc4(key, PAD);
  else {
    const both = new Uint8Array(32 + id0.length);
    both.set(PAD);
    both.set(id0, 32);
    check = rc4(key, md5(both));
    for (let i = 1; i <= 19; i++) check = rc4(key.map((b) => b ^ i), check);
  }
  const want = u.subarray(0, r === 2 ? 32 : 16);
  if (want.some((b, i) => b !== check[i])) return 'locked';
  return { key, aes, streams };
}

async function decryptStream(c: Crypt, num: number, gen: number, data: Uint8Array): Promise<Uint8Array> {
  const salt = c.aes ? bytesOf('sAlT') : new Uint8Array(0);
  const k = new Uint8Array(c.key.length + 5 + salt.length);
  k.set(c.key);
  k.set([num & 255, (num >> 8) & 255, (num >> 16) & 255, gen & 255, (gen >> 8) & 255], c.key.length);
  k.set(salt, c.key.length + 5);
  const objKey = md5(k).subarray(0, Math.min(c.key.length + 5, 16));
  if (!c.aes) return rc4(objKey, data);
  if (data.length < 32 || data.length % 16) return new Uint8Array(0);
  const ck = await crypto.subtle.importKey('raw', objKey as unknown as BufferSource, { name: 'AES-CBC' }, false, ['decrypt']);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: data.subarray(0, 16) as unknown as BufferSource }, ck, data.subarray(16) as unknown as BufferSource));
}

// ---- the plain copy -------------------------------------------------------------------------------------------

/** The text of /Key's value when it is a dictionary (inline, balanced) or a reference to one. */
function sub(objs: Map<number, Obj>, dict: string, key: string): string {
  const i = dict.search(new RegExp(`/${key}(?![A-Za-z])`));
  if (i < 0) return '';
  const rest = dict.slice(i + key.length + 1);
  const r = rest.match(/^\s*(\d+)\s+\d+\s+R/);
  if (r) return objs.get(Number(r[1]))?.dict ?? '';
  const open = rest.indexOf('<<');
  if (open < 0 || rest.slice(0, open).trim()) return '';
  let depth = 0;
  for (let j = open; j < rest.length - 1; j++) {
    if (rest[j] === '<' && rest[j + 1] === '<') (depth++, j++);
    else if (rest[j] === '>' && rest[j + 1] === '>') {
      depth--;
      j++;
      if (!depth) return rest.slice(open + 2, j - 1);
    }
  }
  return '';
}
const ref = (dict: string, key: string): number | null => {
  const r = dict.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`));
  return r ? Number(r[1]) : null;
};

export class LockedPdf extends Error {}

/**
 * A plain copy of the PDF the library's reader can read, and which of its pages belong to which real page
 * (`owner[k]` = the real page that copy page k came from). Throws `LockedPdf` for a file that needs a password.
 */
export async function plainPdf(bytes: Uint8Array): Promise<{ bytes: Uint8Array; owner: number[]; unlocked: boolean; forms: number }> {
  const str = bin(bytes);
  if (!str.slice(0, 1024).includes('%PDF')) throw new Error('this is not a PDF file');
  const objs = parseObjects(bytes, str);
  // Unlock with the empty password when the file is "encrypted".
  const encRef = [...str.matchAll(/\/Encrypt\s+(\d+)\s+\d+\s+R/g)].at(-1)?.[1];
  const encInline = encRef ? '' : (str.match(/\/Encrypt\s*<<([\s\S]*?)>>\s*(?:\/|>>)/)?.[1] ?? '');
  const encDict = encRef ? (objs.get(Number(encRef))?.dict ?? '') : encInline;
  let unlocked = false;
  if (encDict) {
    const id0 = (() => {
      const m = [...str.matchAll(/\/ID\s*\[\s*(<[0-9a-fA-F\s]*>|\((?:\\.|[^\\)])*\))/g)].at(-1)?.[1];
      return m ? stringBytes(m) : new Uint8Array(0);
    })();
    const c = fileKey(encDict, id0);
    if (c === 'locked') throw new LockedPdf('This paper is locked with a password, so it cannot be read.');
    if (c === 'unsupported') throw new LockedPdf('This paper is locked in a way Ghosty cannot open yet.');
    if (c.streams) {
      for (const o of objs.values()) {
        if (!o.stream || o.num === Number(encRef) || /\/Type\s*\/XRef/.test(o.dict)) continue;
        o.stream = await decryptStream(c, o.num, o.gen, o.stream);
      }
    }
    if (encRef) objs.delete(Number(encRef));
    unlocked = true;
  }
  // Unpack object streams into plain objects.
  for (const o of [...objs.values()]) {
    if (!o.stream || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const data = /\/FlateDecode/.test(o.dict) ? await inflate(o.stream) : o.stream;
    objs.delete(o.num);
    if (!data) continue;
    const text = bin(data);
    const first = Number(o.dict.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const n = Number(o.dict.match(/\/N\s+(\d+)/)?.[1] ?? 0);
    const head = text.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const id = head[i * 2]!;
      const off = head[i * 2 + 1]!;
      const next = i + 1 < n ? head[(i + 1) * 2 + 1]! : text.length - first;
      if (!objs.has(id)) objs.set(id, { num: id, gen: 0, dict: text.slice(first + off, first + next) });
    }
  }
  // A simple (one byte per letter) font whose letter map says "two bytes per letter" is read two bytes at a time
  // by the library's reader, which turns its text into nothing: such maps get a one-byte copy.
  let top = Math.max(0, ...objs.keys());
  const fixed = new Map<number, number>();
  for (const o of [...objs.values()]) {
    if (!/\/Type\s*\/Font/.test(o.dict) || /\/Subtype\s*\/Type0/.test(o.dict)) continue;
    const tu = ref(o.dict, 'ToUnicode');
    const cm = tu === null ? undefined : objs.get(tu);
    if (tu === null || !cm?.stream) continue;
    let copy = fixed.get(tu);
    if (copy === undefined) {
      const raw = /\/FlateDecode/.test(cm.dict) ? await inflate(cm.stream) : /\/Filter/.test(cm.dict) ? null : cm.stream;
      if (!raw) continue;
      const text = bin(raw);
      if (!/begincodespacerange\s*<[0-9a-fA-F]{4}>/.test(text)) continue;
      const one = text.replace(/begincodespacerange([\s\S]*?)endcodespacerange/, (_, r: string) => `begincodespacerange${r.replace(/<00([0-9a-fA-F]{2})>/g, '<$1>')}endcodespacerange`);
      copy = ++top;
      objs.set(copy, { num: copy, gen: 0, dict: `<< /Length ${one.length} >>`, stream: bytesOf(one) });
      fixed.set(tu, copy);
    }
    o.dict = o.dict.replace(/\/ToUnicode\s+\d+\s+\d+\s+R/, `/ToUnicode ${copy} 0 R`);
  }
  // The pages, in order, with the resources they inherit.
  const pages: { dict: string; res: string }[] = [];
  const catalog = [...objs.values()].find((o) => /\/Type\s*\/Catalog/.test(o.dict));
  const walk = (num: number | null, inherited: string, depth: number) => {
    if (num === null || depth > 40) return;
    const o = objs.get(num);
    if (!o) return;
    const res = /\/Resources/.test(o.dict) ? sub(objs, o.dict, 'Resources') : inherited;
    if (/\/Type\s*\/Pages/.test(o.dict)) {
      for (const k of (o.dict.match(/\/Kids\s*\[([^\]]*)\]/)?.[1] ?? '').matchAll(/(\d+)\s+\d+\s+R/g)) walk(Number(k[1]), res, depth + 1);
    } else if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push({ dict: o.dict, res });
  };
  if (catalog) walk(ref(catalog.dict, 'Pages'), '', 0);
  // The new copy: every object but the page tree, then a page for each real page and for each form it draws.
  let max = Math.max(0, ...objs.keys());
  const fresh: string[] = [];
  const kids: number[] = [];
  const owner: number[] = [];
  let forms = 0;
  const contentText = async (nums: number[]): Promise<string> => {
    let s = '';
    for (const n of nums) {
      const o = objs.get(n);
      if (!o?.stream) continue;
      const d = /\/FlateDecode/.test(o.dict) ? await inflate(o.stream) : /\/Filter/.test(o.dict) ? null : o.stream;
      if (d) s += `${bin(d)}\n`;
    }
    return s;
  };
  const addPage = (res: string, contents: number[], page: number) => {
    const n = ++max;
    fresh.push(`${n} 0 obj\n<< /Type /Page /Parent PARENT 0 R /Resources << ${res} >> /Contents [${contents.map((c) => `${c} 0 R`).join(' ')}] >>\nendobj\n`);
    kids.push(n);
    owner.push(page);
  };
  for (const [pi, pg] of pages.entries()) {
    const contents: number[] = [];
    const arr = pg.dict.match(/\/Contents\s*\[([^\]]*)\]/)?.[1];
    if (arr) for (const c of arr.matchAll(/(\d+)\s+\d+\s+R/g)) contents.push(Number(c[1]));
    else {
      const c = ref(pg.dict, 'Contents');
      if (c !== null) contents.push(c);
    }
    addPage(pg.res, contents, pi);
    // The forms this page draws (and the forms they draw, a few levels down), each as a page of its own.
    const seen = new Set<number>();
    const visit = async (res: string, nums: number[], depth: number) => {
      if (depth > 3) return;
      const xo = sub(objs, res, 'XObject');
      if (!xo) return;
      const drawn = new Set([...(await contentText(nums)).matchAll(/\/([^\s/<>[\]()]+)\s+Do\b/g)].map((m) => m[1]!));
      for (const f of xo.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) {
        const num = Number(f[2]);
        const o = objs.get(num);
        if (!drawn.has(f[1]!) || seen.has(num) || !o?.stream || !/\/Subtype\s*\/Form/.test(o.dict)) continue;
        seen.add(num);
        const fres = /\/Resources/.test(o.dict) ? sub(objs, o.dict, 'Resources') : res;
        addPage(fres, [num], pi);
        forms++;
        await visit(fres, [num], depth + 1);
      }
    };
    await visit(pg.res, contents, 0);
  }
  const parent = ++max;
  const root = ++max;
  const out: string[] = ['%PDF-1.7\n'];
  const chunks: Uint8Array[] = [];
  const flush = () => {
    if (out.length) chunks.push(bytesOf(out.join(''))), (out.length = 0);
  };
  for (const o of objs.values()) {
    if (/\/Type\s*\/(Catalog|Pages|XRef|ObjStm)\b/.test(o.dict) || /\/Type\s*\/Page\b/.test(o.dict)) continue;
    // Lengths may have been references to objects inside packed streams: the reader goes by "endstream".
    const dict = o.dict.replace(/\/Length\s+\d+\s+\d+\s+R/, `/Length ${o.stream?.length ?? 0}`);
    if (o.stream) {
      out.push(`${o.num} 0 obj\n${dict}\nstream\n`);
      flush();
      chunks.push(o.stream);
      out.push('\nendstream\nendobj\n');
    } else out.push(`${o.num} 0 obj\n${dict}\nendobj\n`);
  }
  out.push(...fresh.map((f) => f.replace('PARENT', String(parent))));
  out.push(`${parent} 0 obj\n<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>\nendobj\n`);
  out.push(`${root} 0 obj\n<< /Type /Catalog /Pages ${parent} 0 R >>\nendobj\ntrailer\n<< /Root ${root} 0 R >>\n%%EOF\n`);
  flush();
  const total = chunks.reduce((a, c) => a + c.length, 0);
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) (all.set(c, off), (off += c.length));
  return { bytes: all, owner, unlocked, forms };
}

/**
 * An exam board's PDF read to text on the phone: prepared as above, then read by the library's own reader, the
 * form pages joined back onto their page.
 */
export async function readExamPdf(bytes: Uint8Array, title: string): Promise<Extracted> {
  let plain: Awaited<ReturnType<typeof plainPdf>>;
  try {
    plain = await plainPdf(bytes);
  } catch (e) {
    if (e instanceof LockedPdf) throw e;
    // A file this cannot lay out goes to the reader as it came.
    return extractPdf(bytes, title);
  }
  const read = await extractPdf(plain.bytes, title);
  const pages: string[] = [];
  read.pages.forEach((t, k) => {
    const p = plain.owner[k] ?? 0;
    pages[p] = pages[p] ? `${pages[p]}\n${t}` : t;
  });
  const out = Array.from({ length: pages.length }, (_, i) => pages[i] ?? '');
  const chars = out.join('').replace(/\s/g, '').length;
  return { title: read.title, pages: out, kind: 'pdf', ...(chars < Math.max(60, out.length * 40) ? { warning: 'Very little text found — this paper may be pictures of pages.' } : {}) };
}
