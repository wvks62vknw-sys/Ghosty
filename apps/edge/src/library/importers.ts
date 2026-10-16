/**
 * Importing knowledge into the library from the web, without any AI:
 *   - any web page or text file by URL
 *   - arXiv papers by id ("1706.03762", "arxiv.org/abs/…") — full text from arXiv's HTML version when it exists
 *   - CVE records by id ("CVE-2021-44228") from the official CVE service
 *   - public GitHub repositories ("owner/repo" or a github.com link) — README, docs and source
 *   - Project Gutenberg books ("gutenberg.org/ebooks/1342", "gutenberg 1342") — the plain-text edition,
 *     its licence header and footer removed, chapter by chapter, a part (~90k characters) per call
 * Each call imports a bounded amount (the free plan allows ~50 outbound requests and little
 * CPU per request); large sources say how to continue.
 */
import { chunkText, type Passage } from '../../../../packages/shared/src/chunk';
import { htmlToText } from '../tools/web';
import type { ProgressFn } from '../tools/types';
import type { GitHub } from '../github';
import type { Library, LibraryDoc } from './store';

const UA = 'Mozilla/5.0 (compatible; GhostyAssistant/2.0; personal library)';
const MAX_TEXT = 90_000; // characters stored per import call
const MAX_BYTES = 600_000;

export interface ImportResult {
  doc: LibraryDoc;
  passages: number;
  note: string;
}

async function readCapped(r: Response, max = MAX_BYTES): Promise<string> {
  if (!r.body) return '';
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  reader.cancel().catch(() => undefined);
  const all = new Uint8Array(Math.min(size, max));
  let o = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.max(0, all.length - o));
    all.set(part, o);
    o += part.length;
  }
  return new TextDecoder().decode(all);
}

async function get(url: string, accept = '*/*'): Promise<Response> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow' });
  if (!r.ok) throw new Error(`${new URL(url).hostname} answered ${r.status}`);
  return r;
}

/** Store passages in batches of 40 (the store's limit per call); a long document reports each batch. */
async function store(lib: Library, doc: LibraryDoc, passages: Passage[], onProgress?: ProgressFn): Promise<number> {
  let n = 0;
  for (let i = 0; i < passages.length; i += 40) {
    if (passages.length > 40) onProgress?.('saving passages…', Math.min(i + 40, passages.length), passages.length);
    n += await lib.addPassages(doc.id, passages.slice(i, i + 40));
  }
  lib.finish(doc.id);
  return n;
}

const clipText = (t: string) => (t.length > MAX_TEXT ? { text: t.slice(0, MAX_TEXT), cut: true } : { text: t, cut: false });

/** `onProgress` hears each stage (fetching, reading, file n of N, saving) so the chat can show it under the tool's line. */
export async function importSource(lib: Library, source: string, opts: { offset?: number; onProgress?: ProgressFn } = {}): Promise<ImportResult> {
  const s = source.trim();
  const cve = s.match(/^(CVE-\d{4}-\d{4,})$/i);
  if (cve) return importCve(lib, cve[1]!.toUpperCase(), opts.onProgress);
  const arxiv = s.match(/^(?:arxiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7}(?:v\d+)?)$/i) ?? s.match(/arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5}(?:v\d+)?|[a-z-]+(?:\.[a-z]{2})?\/\d{7}(?:v\d+)?)/i);
  if (arxiv) return importArxiv(lib, arxiv[1]!, opts.onProgress);
  const pg = s.match(/^(?:gutenberg|pg|project gutenberg)[:\s#]*(\d{1,6})$/i) ?? s.match(/gutenberg\.org\/(?:ebooks|cache\/epub|files)\/(\d{1,6})\b/i);
  if (pg) return importGutenberg(lib, Number(pg[1]), opts.offset ?? 0, opts.onProgress);
  const gh = s.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/[^/]+\/(.+))?\/?$/);
  if (gh && !/^https?:\/\/(?!github\.com)/.test(s) && !s.includes(' ')) return importGithub(lib, gh[1]!, gh[2]!, gh[3] ?? '', opts.offset ?? 0, opts.onProgress);
  if (/^https?:\/\//i.test(s)) return importUrl(lib, s, opts.onProgress);
  throw new Error('give a web address (https://…), an arXiv id (e.g. 1706.03762), a CVE id (e.g. CVE-2021-44228) or a GitHub repository (owner/repo)');
}

async function importUrl(lib: Library, url: string, onProgress?: ProgressFn): Promise<ImportResult> {
  onProgress?.(`fetching ${new URL(url).hostname}…`);
  const r = await get(url);
  const type = r.headers.get('content-type') ?? '';
  if (/pdf|msword|officedocument|epub|zip/.test(type) || /\.(pdf|docx|epub)(\?|$)/i.test(url)) {
    throw new Error('that link is a document file — download it and add it in the Library tab (Ghosty reads PDFs, Word files and e-books there)');
  }
  onProgress?.('reading the page…');
  const raw = await readCapped(r);
  const isHtml = /html|xml/.test(type) || /^\s*</.test(raw);
  const { title, text } = isHtml ? htmlToText(raw) : { title: '', text: raw };
  const name = title || new URL(url).pathname.split('/').filter(Boolean).pop() || new URL(url).hostname;
  const { text: body, cut } = clipText(text);
  const doc = lib.createDoc({ title: name, source: url, kind: 'web' });
  const n = await store(lib, doc, chunkText(body, { code: /\.(js|ts|py|rs|go|c|cpp|h|java|rb|php|cs|swift|kt)$/i.test(url) }), onProgress);
  return { doc: lib.doc(doc.id)!, passages: n, note: cut ? 'Only the first part was saved (it is very long).' : '' };
}

async function importArxiv(lib: Library, id: string, onProgress?: ProgressFn): Promise<ImportResult> {
  onProgress?.(`arXiv ${id}: the abstract…`);
  const absHtml = await readCapped(await get(`https://arxiv.org/abs/${id}`, 'text/html'));
  const title = (absHtml.match(/<meta name="citation_title" content="([^"]+)"/)?.[1] ?? htmlToText(absHtml).title).replace(/^\[[^\]]+\]\s*/, '').trim();
  const authors = [...absHtml.matchAll(/<meta name="citation_author" content="([^"]+)"/g)].map((m) => m[1]).slice(0, 8).join('; ');
  const date = absHtml.match(/<meta name="citation_date" content="([^"]+)"/)?.[1] ?? '';
  const abstract = htmlToText(absHtml.match(/<blockquote class="abstract[^"]*">([\s\S]*?)<\/blockquote>/)?.[1] ?? '').text.replace(/^Abstract:\s*/i, '');
  let full = '';
  try {
    onProgress?.(`arXiv ${id}: the full text…`);
    const r = await fetch(`https://arxiv.org/html/${id}`, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (r.ok) full = htmlToText((await readCapped(r, 1_500_000)).replace(/<math[\s\S]*?<\/math>/g, ' [formula] ')).text;
  } catch {
    /* no HTML version: the abstract is still useful */
  }
  const head = `# ${title}\n\n${authors ? `Authors: ${authors}\n` : ''}${date ? `Date: ${date}\n` : ''}arXiv: ${id}\n\n# Abstract\n\n${abstract}\n\n`;
  const { text, cut } = clipText(head + full);
  const doc = lib.createDoc({ title: title || `arXiv ${id}`, source: `https://arxiv.org/abs/${id}`, kind: 'paper' });
  const n = await store(lib, doc, chunkText(text, { heading: title }), onProgress);
  return {
    doc: lib.doc(doc.id)!,
    passages: n,
    note: full ? (cut ? 'Saved the abstract and the first part of the paper.' : 'Saved the full paper.') : 'Saved the abstract (arXiv has no HTML version of this paper — upload the PDF in the Library tab for the full text).',
  };
}

async function importCve(lib: Library, id: string, onProgress?: ProgressFn): Promise<ImportResult> {
  onProgress?.(`${id} from cve.org…`);
  const r = await get(`https://cveawg.mitre.org/api/cve/${id}`, 'application/json');
  const j = (await r.json()) as {
    cveMetadata?: { datePublished?: string; state?: string };
    containers?: {
      cna?: {
        title?: string;
        descriptions?: { lang?: string; value?: string }[];
        affected?: { vendor?: string; product?: string; versions?: { version?: string; lessThan?: string; lessThanOrEqual?: string; status?: string }[] }[];
        problemTypes?: { descriptions?: { description?: string; cweId?: string }[] }[];
        metrics?: Record<string, { baseScore?: number; baseSeverity?: string; vectorString?: string }>[];
        references?: { url?: string }[];
      };
    };
  };
  const c = j.containers?.cna ?? {};
  const desc = (c.descriptions ?? []).filter((d) => !d.lang || d.lang.startsWith('en')).map((d) => d.value).join('\n\n');
  const affected = (c.affected ?? [])
    .slice(0, 10)
    .map((a) => `${a.vendor ?? ''} ${a.product ?? ''}: ${(a.versions ?? []).slice(0, 6).map((v) => `${v.version ?? ''}${v.lessThan ? ` < ${v.lessThan}` : ''}${v.lessThanOrEqual ? ` <= ${v.lessThanOrEqual}` : ''} (${v.status ?? ''})`).join(', ')}`)
    .join('\n');
  const cwe = (c.problemTypes ?? []).flatMap((p) => p.descriptions ?? []).map((d) => `${d.cweId ?? ''} ${d.description ?? ''}`.trim()).join('; ');
  const metric = (c.metrics ?? []).flatMap((m) => Object.values(m)).find((m) => m && typeof m === 'object' && 'baseScore' in m);
  const refs = (c.references ?? []).slice(0, 8).map((x) => x.url).join('\n');
  const text = `# ${id}${c.title ? `: ${c.title}` : ''}\n\nPublished: ${j.cveMetadata?.datePublished?.slice(0, 10) ?? 'unknown'} · State: ${j.cveMetadata?.state ?? ''}${metric ? ` · Severity: ${metric.baseSeverity ?? ''} ${metric.baseScore ?? ''}` : ''}\n${cwe ? `Weakness: ${cwe}\n` : ''}\n${desc}\n\n# Affected\n\n${affected || 'not listed'}\n\n# References\n\n${refs}`;
  const doc = lib.createDoc({ title: `${id}${c.title ? ` — ${c.title}` : ''}`, source: `https://www.cve.org/CVERecord?id=${id}`, kind: 'cve' });
  const n = await store(lib, doc, chunkText(text, { heading: id }), onProgress);
  return { doc: lib.doc(doc.id)!, passages: n, note: '' };
}

const SOURCE = /\.(md|mdx|rst|txt|py|js|mjs|ts|tsx|jsx|rs|go|c|h|cc|cpp|hpp|java|kt|swift|rb|php|cs|scala|lua|sh|sql|toml|yaml|yml)$/i;
const SKIP = /(^|\/)(node_modules|vendor|third_party|dist|build|\.git|\.github|__pycache__|fixtures?|testdata|test_data|benchmarks?|examples?\/data)\//i;

async function importGithub(lib: Library, owner: string, repo: string, sub: string, offset: number, onProgress?: ProgressFn): Promise<ImportResult> {
  onProgress?.(`listing ${owner}/${repo}…`);
  const r = await get(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, 'application/vnd.github+json');
  const j = (await r.json()) as { tree?: { path: string; type: string; size?: number }[]; truncated?: boolean };
  const files = (j.tree ?? [])
    .filter((f) => f.type === 'blob' && SOURCE.test(f.path) && !SKIP.test(`${f.path}`) && (f.size ?? 0) < 120_000 && (!sub || f.path.startsWith(sub)))
    .map((f) => {
      const p = f.path.toLowerCase();
      const rank = /(^|\/)readme/.test(p) ? 0 : /\.(md|mdx|rst)$/.test(p) && /(^|\/)docs?\//.test(p) ? 1 : /\.(md|mdx|rst|txt)$/.test(p) ? 2 : /(^|\/)(tests?|spec)\//.test(p) ? 4 : 3;
      return { path: f.path, rank, depth: f.path.split('/').length };
    })
    .sort((a, b) => a.rank - b.rank || a.depth - b.depth || a.path.localeCompare(b.path));
  const batch = files.slice(offset, offset + 30);
  if (!batch.length) throw new Error(offset ? 'nothing more to import from that repository' : 'no readable text or source files found in that repository');
  const title = `GitHub: ${owner}/${repo}${sub ? `/${sub}` : ''}`;
  const existing = lib.list().find((d) => d.title === title);
  const doc = existing ?? lib.createDoc({ title, source: `https://github.com/${owner}/${repo}`, kind: 'code' });
  let total = 0;
  let chars = 0;
  for (const [i, f] of batch.entries()) {
    if (chars > MAX_TEXT) break;
    onProgress?.(f.path, i + 1, batch.length);
    try {
      const raw = await readCapped(await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${f.path.split('/').map(encodeURIComponent).join('/')}`, { headers: { 'User-Agent': UA } }), 150_000);
      chars += raw.length;
      const code = !/\.(md|mdx|rst|txt)$/i.test(f.path);
      const passages = chunkText(raw, { code, heading: f.path });
      for (let i = 0; i < passages.length; i += 40) total += await lib.addPassages(doc.id, passages.slice(i, i + 40));
    } catch {
      /* skip unreadable files */
    }
  }
  lib.finish(doc.id);
  const next = offset + batch.length;
  return {
    doc: lib.doc(doc.id)!,
    passages: total,
    note: next < files.length ? `Imported files ${offset + 1}–${next} of ${files.length} (README and docs first). To continue, import again with offset ${next}.` : `Imported all ${files.length} readable files.`,
  };
}

/** Ghosty's own source code, as a library document (kept up to date after every shipped change). */
/** The address of a Project Gutenberg book's plain-text edition. */
export const gutenbergTextUrl = (id: number): string => `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;

/** A line that opens a chapter, book, part, act… (its own line, blank lines around it). */
const CHAPTER_WORD = /^(?:THE\s+)?(?:CHAPTER|BOOK|PART|VOLUME|LETTER|CANTO|ACT|SCENE|STAVE|SECTION|EPISODE|EPILOGUE|PROLOGUE|PREFACE|INTRODUCTION|APPENDIX|CONCLUSION)\b.{0,80}$|^(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|ELEVENTH|TWELFTH|LAST)\s+(?:BOOK|PART|CHAPTER)\b.{0,60}$/i;
/** A roman numeral on its own, or followed by a stop and a title ("IV. THE GARDEN") — never "I think…". */
const CHAPTER_ROMAN = /^[IVXLCDM]{1,8}$|^[IVXLCDM]{1,8}(?:\.|:|\s*[—–-])(?:\s+\S.{0,70})?$/;

/** Hard-wrapped paragraphs (Gutenberg wraps at ~70 columns) joined into lines; verse (short lines) kept as it is. */
function unwrap(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((para) => {
      const p = para.replace(/^\n+|\n+$/g, '');
      const lines = p.split('\n');
      const avg = lines.reduce((n, l) => n + l.trim().length, 0) / lines.length;
      return lines.length > 1 && avg > 45 ? lines.map((l) => l.trim()).join(' ') : p;
    })
    .join('\n\n');
}

/**
 * The plain-text edition of a Project Gutenberg book, taken apart: title and author from the header,
 * the licence header and footer removed, and the body split into chapters (a short heading line
 * such as "CHAPTER I", "THE FIRST BOOK" or "IV. THE GARDEN" opens each). A book without such
 * headings is one chapter.
 */
export function gutenbergText(raw: string): { title: string; author: string; chapters: { heading: string; text: string }[] } {
  const t = raw.replace(/\r\n?/g, '\n');
  const title = (t.match(/^Title:\s*(.+)$/m)?.[1] ?? '').trim();
  const author = (t.match(/^Author:\s*(.+)$/m)?.[1] ?? '').trim();
  const start = t.search(/^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*$/m);
  let body = start >= 0 ? t.slice(t.indexOf('\n', start) + 1) : t;
  const end = body.search(/^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/m);
  if (end >= 0) body = body.slice(0, end);
  const lines = body.split('\n');
  const chapters: { heading: string; text: string }[] = [];
  let heading = title || 'Front matter';
  let buf: string[] = [];
  const flush = () => {
    const text = unwrap(buf.join('\n')).trim();
    if (text.length > 200 || (chapters.length && text)) chapters.push({ heading, text });
    buf = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    const alone = line.length > 0 && line.length <= 80 && !(lines[i - 1] ?? '').trim() && !(lines[i + 1] ?? '').trim();
    if (alone && (CHAPTER_WORD.test(line) || CHAPTER_ROMAN.test(line))) {
      flush();
      heading = line.replace(/\s+/g, ' ');
      continue;
    }
    buf.push(lines[i]!);
  }
  flush();
  return { title, author, chapters };
}

/**
 * A Project Gutenberg book, a part at a time: part `offset` of the parts the chapters make at
 * ~MAX_TEXT characters each (a long chapter is cut at paragraph ends). Passages carry the chapter
 * as their heading and its number as the page, so a search hit says "chapter 12".
 */
async function importGutenberg(lib: Library, id: number, offset: number, onProgress?: ProgressFn): Promise<ImportResult> {
  onProgress?.(`book ${id} from gutenberg.org…`);
  const url = gutenbergTextUrl(id);
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/plain' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`gutenberg.org answered ${r.status} for book ${id} (the number is in the book's address: gutenberg.org/ebooks/<number>)`);
  const raw = await readCapped(r, 2_500_000);
  const book = gutenbergText(raw);
  if (!book.chapters.length) throw new Error(`book ${id} has no readable text`);
  // chapters → pieces of at most MAX_TEXT characters → parts of about MAX_TEXT
  const pieces: { heading: string; text: string; page: number }[] = [];
  book.chapters.forEach((c, i) => {
    let rest = c.text;
    while (rest.length > MAX_TEXT) {
      const cut = rest.lastIndexOf('\n\n', MAX_TEXT);
      const at = cut > MAX_TEXT / 2 ? cut : MAX_TEXT;
      pieces.push({ heading: c.heading, text: rest.slice(0, at), page: i + 1 });
      rest = rest.slice(at).trimStart();
    }
    if (rest.trim()) pieces.push({ heading: c.heading, text: rest, page: i + 1 });
  });
  const parts: (typeof pieces)[] = [[]];
  let size = 0;
  for (const p of pieces) {
    if (size + p.text.length > MAX_TEXT && parts[parts.length - 1]!.length) {
      parts.push([]);
      size = 0;
    }
    parts[parts.length - 1]!.push(p);
    size += p.text.length;
  }
  const part = parts[Math.max(0, Math.min(offset, parts.length - 1))]!;
  const source = `https://www.gutenberg.org/ebooks/${id}`;
  const title = `${book.title || `Gutenberg ${id}`}${book.author ? ` — ${book.author}` : ''}`;
  const doc = (offset > 0 ? lib.list().find((d) => d.source === source) : undefined) ?? lib.createDoc({ title, source, kind: 'book', pages: book.chapters.length });
  const passages = part.flatMap((p) => chunkText(p.text, { heading: p.heading }).map((x) => ({ ...x, page: p.page })));
  onProgress?.(`part ${offset + 1} of ${parts.length}: ${part[0]!.heading}…`, offset + 1, parts.length);
  const n = await store(lib, doc, passages, onProgress);
  const next = offset + 1;
  const cut = raw.length >= 2_500_000 ? ' The text was very long and its end was left out.' : '';
  return {
    doc: lib.doc(doc.id)!,
    passages: n,
    note: next < parts.length ? `Saved part ${next} of ${parts.length} ("${part[0]!.heading}" to "${part[part.length - 1]!.heading}", ${book.chapters.length} chapters in all). To continue, import again with offset ${next}.` : `That was the whole book: ${book.chapters.length} chapter${book.chapters.length === 1 ? '' : 's'}.${cut}`,
  };
}

export const SELF_DOC = 'self_code';
const SELF_FILES = /^(MAP\.md|README\.md|SETUP\.md|apps\/(edge|web)\/src\/.+\.ts|packages\/shared\/src\/.+\.ts|apps\/web\/styles\.css|apps\/web\/public\/widget-(kit|host)\.js|\.github\/workflows\/.+\.yml|tests\/.+\.mjs)$/;
const UNREADABLE_SELF = /^apps\/edge\/wrangler\./i;

/**
 * Read Ghosty's own repository into the library: MAP.md and README first, then the brain,
 * the interface and the tests. 25 files per call (the free plan allows ~50 outbound requests
 * per request); call again with the offset it returns. `only` re-reads just those files.
 */
export async function importSelf(lib: Library, g: GitHub, ref: string, opts: { offset?: number; only?: string[]; onProgress?: ProgressFn } = {}): Promise<{ doc: LibraryDoc; files: number; next: number | null; total: number }> {
  opts.onProgress?.('listing my files…');
  const all = (await g.tree(ref)).filter((p) => SELF_FILES.test(p) && !UNREADABLE_SELF.test(p) && !p.includes('/library/starter/'));
  const rank = (p: string) => (p === 'MAP.md' ? 0 : /\.md$/.test(p) ? 1 : p.startsWith('apps/edge') ? 2 : p.startsWith('packages') ? 3 : p.startsWith('apps/web') ? 4 : 5);
  const files = (opts.only ? all.filter((p) => opts.only!.includes(p)) : all).sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  const offset = opts.offset ?? 0;
  const batch = files.slice(offset, offset + 25);
  if (!lib.doc(SELF_DOC)) lib.createDoc({ id: SELF_DOC, title: "Ghosty's own source code", source: `GitHub: ${ref}`, kind: 'code' });
  for (const [i, path] of batch.entries()) {
    opts.onProgress?.(path, i + 1, batch.length);
    const text = await g.read(path, ref).catch(() => null);
    lib.removeSection(SELF_DOC, path);
    if (!text) continue;
    // every passage of a file is filed under its path, so the file can be replaced as a whole later
    const passages = chunkText(text, { code: !/\.md$/.test(path), heading: path }).map((p) => ({ ...p, heading: path }));
    for (let i = 0; i < passages.length; i += 40) await lib.addPassages(SELF_DOC, passages.slice(i, i + 40));
  }
  lib.finish(SELF_DOC);
  const next = offset + batch.length < files.length ? offset + batch.length : null;
  return { doc: lib.doc(SELF_DOC)!, files: batch.length, next, total: files.length };
}
