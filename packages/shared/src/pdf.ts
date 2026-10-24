/**
 * Reading a PDF's text with no libraries and no AI: every page's text in order (ToUnicode fonts,
 * /Differences encodings and object streams), the title, and a warning when the file looks scanned or
 * is encrypted. Shared by the phone (the Library tab, SCHOOL's official papers: apps/web/src/library/extract.ts)
 * and the brain (gadget manuals: apps/edge/src/integrations/manuals.ts). Pure apart from DecompressionStream,
 * which both a browser and a Worker have.
 */

/** A PDF's text: one entry per page, in order. */
export interface PdfText {
  title: string;
  pages: string[];
  kind: 'pdf';
  warning?: string;
}

/** Inflate zlib ('deflate') or raw deflate data; null when nothing decodes (a corrupt tail keeps what decoded). */
export async function inflateAll(data: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array | null> {
  try {
    const ds = new DecompressionStream(format);
    const writer = ds.writable.getWriter();
    void writer.write(data as unknown as BufferSource).catch(() => undefined);
    void writer.close().catch(() => undefined);
    const reader = ds.readable.getReader();
    const parts: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      let r: ReadableStreamReadResult<Uint8Array>;
      try {
        r = await reader.read();
      } catch {
        break; // corrupt or truncated tail: keep what decoded
      }
      if (r.done) break;
      parts.push(r.value);
      size += r.value.length;
    }
    if (!size) return null;
    const out = new Uint8Array(size);
    let o = 0;
    for (const p of parts) {
      out.set(p, o);
      o += p.length;
    }
    return out;
  } catch {
    return null;
  }
}

interface PdfObj {
  dict: string;
  stream?: Uint8Array;
}

/** Glyph names that appear in /Differences arrays → characters (the common ones). */
const GLYPHS: Record<string, string> = {
  space: ' ', exclam: '!', quotedbl: '"', numbersign: '#', dollar: '$', percent: '%', ampersand: '&', quotesingle: "'", parenleft: '(', parenright: ')', asterisk: '*', plus: '+', comma: ',', hyphen: '-', period: '.', slash: '/',
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', colon: ':', semicolon: ';', less: '<', equal: '=', greater: '>', question: '?', at: '@',
  bracketleft: '[', backslash: '\\', bracketright: ']', asciicircum: '^', underscore: '_', grave: '`', braceleft: '{', bar: '|', braceright: '}', asciitilde: '~',
  quoteleft: '‘', quoteright: '’', quotedblleft: '“', quotedblright: '”', endash: '–', emdash: '—', bullet: '•', ellipsis: '…', fi: 'fi', fl: 'fl', ff: 'ff', ffi: 'ffi', ffl: 'ffl', minus: '−', degree: '°', copyright: '©', registered: '®', trademark: '™', multiply: '×', divide: '÷', section: '§', paragraph: '¶', dagger: '†', daggerdbl: '‡', sterling: '£', Euro: '€', cent: '¢', yen: '¥',
};

const glyphChar = (g: string): string => {
  if (GLYPHS[g] !== undefined) return GLYPHS[g]!;
  if (/^[A-Za-z]$/.test(g)) return g;
  const u = g.match(/^uni([0-9A-F]{4,6})$/i) ?? g.match(/^u([0-9A-F]{4,6})$/i);
  if (u) return String.fromCodePoint(parseInt(u[1]!, 16));
  return '';
};

interface Font {
  map: Map<number, string>;
  bytes: 1 | 2;
  enc: Map<number, string>;
}

/** Bytes → a string with one character per byte (exactly; TextDecoder('latin1') is really Windows-1252). */
function bin(b: Uint8Array): string {
  let s = '';
  for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192) as unknown as number[]);
  return s;
}

export async function extractPdf(bytes: Uint8Array, fallbackTitle: string): Promise<PdfText> {
  const str = bin(bytes);
  if (!str.startsWith('%PDF') && !str.slice(0, 1024).includes('%PDF')) throw new Error('this is not a PDF file');
  const objs = new Map<number, PdfObj>();
  const re = /(\d+)\s+\d+\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(str))) {
    const start = m.index + m[0].length;
    const end = str.indexOf('endobj', start);
    if (end < 0) break;
    const s = str.indexOf('stream', start);
    if (s >= 0 && s < end && str.slice(start, s).includes('>>')) {
      let ds = s + 6;
      if (str[ds] === '\r') ds++;
      if (str[ds] === '\n') ds++;
      let de = str.indexOf('endstream', ds);
      if (de < 0) de = end;
      let e = de;
      if (str[e - 1] === '\n') e--;
      if (str[e - 1] === '\r') e--;
      objs.set(Number(m[1]), { dict: str.slice(start, s), stream: bytes.subarray(ds, e) });
      re.lastIndex = Math.max(de, start);
    } else {
      objs.set(Number(m[1]), { dict: str.slice(start, end) });
      re.lastIndex = end;
    }
  }
  const encrypted = /\/Encrypt\s+\d+\s+\d+\s+R/.test(str.slice(-4096)) || /\/Encrypt\s*<</.test(str.slice(-4096));

  const decoded = new Map<number, Uint8Array | null>();
  const decode = async (num: number): Promise<Uint8Array | null> => {
    if (decoded.has(num)) return decoded.get(num)!;
    const o = objs.get(num);
    let out: Uint8Array | null = null;
    if (o?.stream) {
      const filters = o.dict.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/)?.[1] ?? '';
      if (!filters) out = o.stream;
      else if (/^\/FlateDecode$|^\[\s*\/FlateDecode\s*\]$/.test(filters.trim())) out = (await inflateAll(o.stream, 'deflate')) ?? (await inflateAll(o.stream.subarray(2), 'deflate-raw'));
    }
    decoded.set(num, out);
    return out;
  };
  const latin = bin;

  // objects packed inside object streams (PDF 1.5+)
  for (const [num, o] of [...objs]) {
    if (!/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const data = await decode(num);
    if (!data) continue;
    const text = latin(data);
    const first = Number(o.dict.match(/\/First\s+(\d+)/)?.[1] ?? 0);
    const n = Number(o.dict.match(/\/N\s+(\d+)/)?.[1] ?? 0);
    const head = text.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const id = head[i * 2]!;
      const off = head[i * 2 + 1]!;
      const next = i + 1 < n ? head[(i + 1) * 2 + 1]! : text.length - first;
      if (!objs.has(id)) objs.set(id, { dict: text.slice(first + off, first + next) });
    }
  }

  const ref = (dict: string, key: string): number | null => {
    const r = dict.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`));
    return r ? Number(r[1]) : null;
  };
  /** The text of a sub-dictionary /Key << … >> (balanced), or of the object it references. */
  const sub = (dict: string, key: string): string => {
    const i = dict.search(new RegExp(`/${key}(?![A-Za-z])`));
    if (i < 0) return '';
    const rest = dict.slice(i + key.length + 1);
    const r = rest.match(/^\s*(\d+)\s+\d+\s+R/);
    if (r) return objs.get(Number(r[1]))?.dict ?? '';
    const open = rest.indexOf('<<');
    if (open < 0 || rest.slice(0, open).trim()) return '';
    let depth = 0;
    for (let j = open; j < rest.length - 1; j++) {
      if (rest[j] === '<' && rest[j + 1] === '<') {
        depth++;
        j++;
      } else if (rest[j] === '>' && rest[j + 1] === '>') {
        depth--;
        j++;
        if (!depth) return rest.slice(open + 2, j - 1);
      }
    }
    return '';
  };

  // pages, in order
  const pages: { dict: string; resources: string }[] = [];
  const catalog = [...objs.values()].find((o) => /\/Type\s*\/Catalog/.test(o.dict));
  const walk = (num: number | null, inherited: string, depth: number) => {
    if (num === null || depth > 40) return;
    const o = objs.get(num);
    if (!o) return;
    const res = /\/Resources/.test(o.dict) ? sub(o.dict, 'Resources') : inherited;
    if (/\/Type\s*\/Pages/.test(o.dict)) {
      const kids = o.dict.match(/\/Kids\s*\[([^\]]*)\]/)?.[1] ?? '';
      for (const k of kids.matchAll(/(\d+)\s+\d+\s+R/g)) walk(Number(k[1]), res, depth + 1);
    } else if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push({ dict: o.dict, resources: res });
  };
  if (catalog) walk(ref(catalog.dict, 'Pages'), '', 0);
  if (!pages.length) for (const o of objs.values()) if (/\/Type\s*\/Page\b/.test(o.dict)) pages.push({ dict: o.dict, resources: sub(o.dict, 'Resources') });

  const fonts = new Map<number, Font>();
  const loadFont = async (num: number): Promise<Font> => {
    if (fonts.has(num)) return fonts.get(num)!;
    const d = objs.get(num)?.dict ?? '';
    const font: Font = { map: new Map(), bytes: /\/Subtype\s*\/Type0/.test(d) ? 2 : 1, enc: new Map() };
    const tu = ref(d, 'ToUnicode');
    if (tu !== null) {
      const cm = await decode(tu);
      if (cm) parseCMap(latin(cm), font);
    }
    const encDict = /\/Encoding\s*\d+\s+\d+\s+R/.test(d) ? sub(d, 'Encoding') : d.match(/\/Encoding\s*<<([\s\S]*?)>>/)?.[1] ?? '';
    const diffs = encDict.match(/\/Differences\s*\[([^\]]*)\]/)?.[1];
    if (diffs) {
      let code = 0;
      for (const t of diffs.match(/\d+|\/[^\s/[\]]+/g) ?? []) {
        if (/^\d+$/.test(t)) code = Number(t);
        else font.enc.set(code++, glyphChar(t.slice(1)));
      }
    }
    fonts.set(num, font);
    return font;
  };

  const texts: string[] = [];
  for (const pg of pages) {
    const fontDict = sub(pg.resources, 'Font');
    const fontRefs = new Map<string, number>();
    for (const f of fontDict.matchAll(/\/([^\s/<>[\]()]+)\s+(\d+)\s+\d+\s+R/g)) fontRefs.set(f[1]!, Number(f[2]));
    const contentRefs: number[] = [];
    const arr = pg.dict.match(/\/Contents\s*\[([^\]]*)\]/)?.[1];
    if (arr) for (const c of arr.matchAll(/(\d+)\s+\d+\s+R/g)) contentRefs.push(Number(c[1]));
    else {
      const c = ref(pg.dict, 'Contents');
      if (c !== null) contentRefs.push(c);
    }
    let content = '';
    for (const c of contentRefs) {
      const d = await decode(c);
      if (d) content += `${latin(d)}\n`;
    }
    const fontsByName = new Map<string, Font>();
    for (const [name, num] of fontRefs) fontsByName.set(name, await loadFont(num));
    texts.push(runContent(content, fontsByName));
  }

  const title = (() => {
    const info = [...objs.values()].find((o) => /\/Producer|\/Creator|\/Title/.test(o.dict) && /\/Title\s*\(/.test(o.dict));
    const t = info?.dict.match(/\/Title\s*\(((?:\\.|[^\\)])*)\)/)?.[1];
    return t ? pdfString(t).replace(/^\xfe\xff/, '') : '';
  })();
  const total = texts.join('').replace(/\s/g, '').length;
  const warning = encrypted ? 'This PDF is encrypted.' : total < Math.max(60, pages.length * 40) ? 'Very little text found — this PDF may be scanned images.' : undefined;
  return { title: (title && /[a-z]{3}/i.test(title) ? title : '') || fallbackTitle, pages: texts, kind: 'pdf', warning };
}

/** ToUnicode CMap: bfchar and bfrange entries. */
function parseCMap(text: string, font: Font): void {
  const space = text.match(/begincodespacerange\s*<([0-9a-fA-F]+)>/);
  if (space) font.bytes = space[1]!.length > 2 ? 2 : 1;
  const hex16 = (h: string) => {
    let s = '';
    for (let i = 0; i + 4 <= h.length; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16));
    if (h.length % 4 === 2) s += String.fromCharCode(parseInt(h.slice(-2), 16));
    return s;
  };
  for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const e of block[1]!.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]*)>/g)) font.map.set(parseInt(e[1]!, 16), hex16(e[2]!));
  }
  for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const e of block[1]!.matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([^\]]*)\])/g)) {
      const lo = parseInt(e[1]!, 16);
      const hi = Math.min(parseInt(e[2]!, 16), lo + 65535);
      if (e[3] !== undefined) {
        const startStr = hex16(e[3]);
        const last = startStr.charCodeAt(startStr.length - 1);
        for (let c = lo; c <= hi; c++) font.map.set(c, startStr.slice(0, -1) + String.fromCharCode(last + (c - lo)));
      } else {
        const list = [...(e[4] ?? '').matchAll(/<([0-9a-fA-F]*)>/g)].map((x) => hex16(x[1]!));
        list.forEach((s, i) => font.map.set(lo + i, s));
      }
    }
  }
}

/** A PDF literal string's escapes → raw byte characters. */
function pdfString(s: string): string {
  return s.replace(/\\(\d{1,3}|\r\n|[\s\S])/g, (_, e: string) => {
    if (/^\d/.test(e)) return String.fromCharCode(parseInt(e, 8) & 255);
    return ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '\n': '', '\r': '', '\r\n': '' } as Record<string, string>)[e] ?? e;
  });
}

/** Run a page's content stream and collect its text, with line breaks and word spaces. */
function runContent(src: string, fonts: Map<string, Font>): string {
  let out = '';
  let font: Font | undefined;
  let lastY: number | null = null;
  // Rough text position, to tell a word gap from kerning: glyph widths aren't read, so each
  // character is taken as ~0.5 em. lineX = where the current line started (Tm/Td), adv = how
  // far the text shown since then reaches (text-space units).
  let fontSize = 10;
  let scale = 1;
  let lineX = 0;
  let adv = 0;
  const stack: (string | number | (string | number)[])[] = [];
  let arr: (string | number)[] | null = null;
  const nl = () => {
    if (out && !out.endsWith('\n')) out += '\n';
  };
  const show = (raw: string) => {
    let t = '';
    if (font && font.bytes === 2) {
      for (let i = 0; i + 1 < raw.length; i += 2) {
        const code = (raw.charCodeAt(i) << 8) | raw.charCodeAt(i + 1);
        t += font.map.get(code) ?? (code >= 32 && code < 0xd800 && !font.map.size ? String.fromCharCode(code) : '');
      }
    } else {
      for (let i = 0; i < raw.length; i++) {
        const code = raw.charCodeAt(i);
        t += font?.map.get(code) ?? font?.enc.get(code) ?? (code >= 32 ? WIN[code] ?? String.fromCharCode(code) : code === 9 ? ' ' : '');
      }
    }
    out += t;
    adv += t.length * 0.5 * fontSize;
  };
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i]!;
    if (c === '%') {
      while (i < n && src[i] !== '\n' && src[i] !== '\r') i++;
      continue;
    }
    if (c <= ' ') {
      i++;
      continue;
    }
    if (c === '(') {
      let depth = 1;
      let j = i + 1;
      let s = '';
      while (j < n && depth) {
        const ch = src[j]!;
        if (ch === '\\') {
          s += ch + (src[j + 1] ?? '');
          j += 2;
          continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')' && !--depth) break;
        s += ch;
        j++;
      }
      const v = pdfString(s);
      (arr ?? stack).push(`(${v}`);
      i = j + 1;
      continue;
    }
    if (c === '<' && src[i + 1] === '<') {
      i += 2;
      continue;
    }
    if (c === '>' && src[i + 1] === '>') {
      i += 2;
      continue;
    }
    if (c === '<') {
      const j = src.indexOf('>', i);
      const hex = src.slice(i + 1, j < 0 ? n : j).replace(/[^0-9a-fA-F]/g, '');
      let s = '';
      for (let k = 0; k < hex.length; k += 2) s += String.fromCharCode(parseInt(hex.slice(k, k + 2).padEnd(2, '0'), 16));
      (arr ?? stack).push(`(${s}`);
      i = j < 0 ? n : j + 1;
      continue;
    }
    if (c === '[') {
      arr = [];
      i++;
      continue;
    }
    if (c === ']') {
      if (arr) stack.push(arr);
      arr = null;
      i++;
      continue;
    }
    if (c === '/') {
      let j = i + 1;
      while (j < n && !/[\s/[\]()<>{}%]/.test(src[j]!)) j++;
      (arr ?? stack).push(`/${src.slice(i + 1, j)}`);
      i = j;
      continue;
    }
    if (/[0-9+\-.]/.test(c)) {
      let j = i + 1;
      while (j < n && /[0-9.]/.test(src[j]!)) j++;
      (arr ?? stack).push(parseFloat(src.slice(i, j)) || 0);
      i = j;
      continue;
    }
    // operator
    let j = i;
    while (j < n && /[A-Za-z*'"0-9]/.test(src[j]!)) j++;
    if (j === i) j = i + 1;
    const op = src.slice(i, j);
    i = j;
    if (op === 'BI') {
      // inline image: skip to EI
      const e = src.indexOf('EI', i);
      i = e < 0 ? n : e + 2;
      stack.length = 0;
      continue;
    }
    const num = (k: number) => {
      const v = stack[stack.length - k];
      return typeof v === 'number' ? v : 0;
    };
    const str = (v: unknown) => (typeof v === 'string' && v.startsWith('(') ? v.slice(1) : null);
    switch (op) {
      case 'Tf': {
        const name = stack[stack.length - 2];
        font = typeof name === 'string' ? fonts.get(name.slice(1)) : undefined;
        fontSize = Math.abs(num(1)) || fontSize;
        break;
      }
      case 'Td':
      case 'TD': {
        const tx = num(2);
        if (Math.abs(num(1)) > 0.5) nl();
        else if (tx - adv > fontSize * 0.3 && out && !/\s$/.test(out)) out += ' ';
        lineX += tx * scale;
        adv = 0;
        break;
      }
      case 'Tm': {
        const x = num(2);
        const y = num(1);
        scale = Math.hypot(num(6), num(5)) || 1;
        if (lastY !== null && Math.abs(y - lastY) > Math.max(0.5, fontSize * scale * 0.3)) nl();
        else if (x - (lineX + adv * scale) > fontSize * scale * 0.3 && out && !/\s$/.test(out)) out += ' ';
        lastY = y;
        lineX = x;
        adv = 0;
        break;
      }
      case 'T*':
        nl();
        adv = 0;
        break;
      case 'Tj': {
        const s = str(stack[stack.length - 1]);
        if (s !== null) show(s);
        break;
      }
      case "'":
      case '"': {
        nl();
        const s = str(stack[stack.length - 1]);
        if (s !== null) show(s);
        break;
      }
      case 'TJ': {
        const a = stack[stack.length - 1];
        if (Array.isArray(a)) {
          for (const part of a) {
            if (typeof part === 'number') {
              if (part < -180 && out && !/\s$/.test(out)) out += ' ';
            } else {
              const s = str(part);
              if (s !== null) show(s);
            }
          }
        }
        break;
      }
      case 'ET':
        if (out && !/\s$/.test(out)) out += ' ';
        break;
    }
    stack.length = 0;
  }
  return out.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').trim();
}

/** Windows-1252 characters for bytes 0x80–0x9F (WinAnsiEncoding). */
const WIN: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž',
  0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};
