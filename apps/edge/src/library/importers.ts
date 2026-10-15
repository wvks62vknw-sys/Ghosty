/**
 * Importing knowledge into the library from the web, without any AI:
 *   - any web page or text file by URL
 *   - arXiv papers by id ("1706.03762", "arxiv.org/abs/…") — full text from arXiv's HTML version when it exists
 *   - CVE records by id ("CVE-2021-44228") from the official CVE service
 *   - public GitHub repositories ("owner/repo" or a github.com link) — README, docs and source
 * Each call imports a bounded amount (the free plan allows ~50 outbound requests and little
 * CPU per request); large sources say how to continue.
 */
import { chunkText, type Passage } from '../../../../packages/shared/src/chunk';
import { htmlToText } from '../tools/web';
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

/** Store passages in batches of 40 (the store's limit per call). */
async function store(lib: Library, doc: LibraryDoc, passages: Passage[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < passages.length; i += 40) n += await lib.addPassages(doc.id, passages.slice(i, i + 40));
  lib.finish(doc.id);
  return n;
}

const clipText = (t: string) => (t.length > MAX_TEXT ? { text: t.slice(0, MAX_TEXT), cut: true } : { text: t, cut: false });

export async function importSource(lib: Library, source: string, opts: { offset?: number } = {}): Promise<ImportResult> {
  const s = source.trim();
  const cve = s.match(/^(CVE-\d{4}-\d{4,})$/i);
  if (cve) return importCve(lib, cve[1]!.toUpperCase());
  const arxiv = s.match(/^(?:arxiv:\s*)?(\d{4}\.\d{4,5}(?:v\d+)?)$/i) ?? s.match(/arxiv\.org\/(?:abs|pdf|html)\/(\d{4}\.\d{4,5}(?:v\d+)?)/i);
  if (arxiv) return importArxiv(lib, arxiv[1]!);
  const gh = s.match(/^(?:https?:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:\/tree\/[^/]+\/(.+))?\/?$/);
  if (gh && !/^https?:\/\/(?!github\.com)/.test(s) && !s.includes(' ')) return importGithub(lib, gh[1]!, gh[2]!, gh[3] ?? '', opts.offset ?? 0);
  if (/^https?:\/\//i.test(s)) return importUrl(lib, s);
  throw new Error('give a web address (https://…), an arXiv id (e.g. 1706.03762), a CVE id (e.g. CVE-2021-44228) or a GitHub repository (owner/repo)');
}

async function importUrl(lib: Library, url: string): Promise<ImportResult> {
  const r = await get(url);
  const type = r.headers.get('content-type') ?? '';
  if (/pdf|msword|officedocument|epub|zip/.test(type) || /\.(pdf|docx|epub)(\?|$)/i.test(url)) {
    throw new Error('that link is a document file — download it and add it in the Library tab (Ghosty reads PDFs, Word files and e-books there)');
  }
  const raw = await readCapped(r);
  const isHtml = /html|xml/.test(type) || /^\s*</.test(raw);
  const { title, text } = isHtml ? htmlToText(raw) : { title: '', text: raw };
  const name = title || new URL(url).pathname.split('/').filter(Boolean).pop() || new URL(url).hostname;
  const { text: body, cut } = clipText(text);
  const doc = lib.createDoc({ title: name, source: url, kind: 'web' });
  const n = await store(lib, doc, chunkText(body, { code: /\.(js|ts|py|rs|go|c|cpp|h|java|rb|php|cs|swift|kt)$/i.test(url) }));
  return { doc: lib.doc(doc.id)!, passages: n, note: cut ? 'Only the first part was saved (it is very long).' : '' };
}

async function importArxiv(lib: Library, id: string): Promise<ImportResult> {
  const absHtml = await readCapped(await get(`https://arxiv.org/abs/${id}`, 'text/html'));
  const title = (absHtml.match(/<meta name="citation_title" content="([^"]+)"/)?.[1] ?? htmlToText(absHtml).title).replace(/^\[[^\]]+\]\s*/, '').trim();
  const authors = [...absHtml.matchAll(/<meta name="citation_author" content="([^"]+)"/g)].map((m) => m[1]).slice(0, 8).join('; ');
  const date = absHtml.match(/<meta name="citation_date" content="([^"]+)"/)?.[1] ?? '';
  const abstract = htmlToText(absHtml.match(/<blockquote class="abstract[^"]*">([\s\S]*?)<\/blockquote>/)?.[1] ?? '').text.replace(/^Abstract:\s*/i, '');
  let full = '';
  try {
    const r = await fetch(`https://arxiv.org/html/${id}`, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (r.ok) full = htmlToText((await readCapped(r, 1_500_000)).replace(/<math[\s\S]*?<\/math>/g, ' [formula] ')).text;
  } catch {
    /* no HTML version: the abstract is still useful */
  }
  const head = `# ${title}\n\n${authors ? `Authors: ${authors}\n` : ''}${date ? `Date: ${date}\n` : ''}arXiv: ${id}\n\n# Abstract\n\n${abstract}\n\n`;
  const { text, cut } = clipText(head + full);
  const doc = lib.createDoc({ title: title || `arXiv ${id}`, source: `https://arxiv.org/abs/${id}`, kind: 'paper' });
  const n = await store(lib, doc, chunkText(text, { heading: title }));
  return {
    doc: lib.doc(doc.id)!,
    passages: n,
    note: full ? (cut ? 'Saved the abstract and the first part of the paper.' : 'Saved the full paper.') : 'Saved the abstract (arXiv has no HTML version of this paper — upload the PDF in the Library tab for the full text).',
  };
}

async function importCve(lib: Library, id: string): Promise<ImportResult> {
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
  const n = await store(lib, doc, chunkText(text, { heading: id }));
  return { doc: lib.doc(doc.id)!, passages: n, note: '' };
}

const SOURCE = /\.(md|mdx|rst|txt|py|js|mjs|ts|tsx|jsx|rs|go|c|h|cc|cpp|hpp|java|kt|swift|rb|php|cs|scala|lua|sh|sql|toml|yaml|yml)$/i;
const SKIP = /(^|\/)(node_modules|vendor|third_party|dist|build|\.git|\.github|__pycache__|fixtures?|testdata|test_data|benchmarks?|examples?\/data)\//i;

async function importGithub(lib: Library, owner: string, repo: string, sub: string, offset: number): Promise<ImportResult> {
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
  for (const f of batch) {
    if (chars > MAX_TEXT) break;
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
