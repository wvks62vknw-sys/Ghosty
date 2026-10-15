/**
 * The library tools: search everything Ghosty has read (no AI needed), add web pages,
 * papers, CVEs and code repositories, and list what is there. Files (PDFs, books, notes)
 * are added by the owner in the Library tab.
 */
import { asData } from '../kernel/permissions';
import { importSource } from '../library/importers';
import { formatHits, Library } from '../library/store';
import { arg, clip, type Tool } from './types';

const lib = (ctx: { storage: DurableObjectStorage; env: import('../env').Env }) => {
  const l = new Library(ctx.storage, ctx.env);
  if (!l.available) throw new Error('the library is not available here (it needs Ghosty’s SQLite storage)');
  return l;
};

export const libraryTools: Tool[] = [
  {
    name: 'library_search',
    description:
      "Search your own library — the books, PDFs, notes, papers, CVEs and code the owner gave you, plus your built-in starter library (algorithms, system design, compilers, maths, AI research, PyTorch/JAX/Triton/CUDA, reinforcement learning, production code, debugging, security). Returns the most relevant passages with their source. Costs no AI. Use it before answering knowledge questions and when you need facts for code; cite the source.",
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'what you want to know, in plain words' }, k: { type: 'number', description: 'how many passages (default 5, max 10)' } }, required: ['query'] },
    risk: 'auto',
    async run(a, ctx) {
      const l = lib(ctx);
      await l.seedStarter();
      const hits = await l.search(arg.str(a, 'query'), Math.max(1, Math.min(10, arg.num(a, 'k', 5))));
      if (!hits.length) return 'Nothing in the library matches that. (The owner can add books and documents in the Library tab, or ask you to library_import a web page, arXiv paper, CVE or GitHub repository.)';
      return clip(asData('your library', formatHits(hits, 7000)), 8000);
    },
  },
  {
    name: 'library_import',
    description:
      'Add knowledge to your library permanently, without AI: a web page or text file (https://…), an arXiv paper ("1706.03762"), a CVE record ("CVE-2021-44228") or a public GitHub repository ("owner/repo", imported 30 files at a time — pass offset to continue). PDFs, Word files and e-books are added by the owner in the Library tab.',
    parameters: { type: 'object', properties: { source: { type: 'string' }, offset: { type: 'number', description: 'GitHub only: continue from this file number' } }, required: ['source'] },
    risk: 'auto',
    async run(a, ctx) {
      const l = lib(ctx);
      const r = await importSource(l, arg.str(a, 'source'), { offset: arg.num(a, 'offset', 0) });
      return `Saved "${r.doc.title}" to the library: ${r.passages} passages (${Math.round(r.doc.chars / 1000)}k characters). ${r.note}`.trim();
    },
  },
  {
    name: 'library_list',
    description: 'List the documents in your library with their size.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const l = lib(ctx);
      await l.seedStarter();
      const s = l.stats();
      const docs = l.list();
      return clip(`${s.docs} documents, ${s.passages} passages, ${(s.bytes / 1e6).toFixed(1)} MB.\n${docs.map((d) => `- ${d.title}${d.builtin ? ' (starter)' : ''} — ${d.passages} passages${d.source && !d.builtin ? ` — ${d.source}` : ''}`).join('\n')}`, 6000);
    },
  },
];
