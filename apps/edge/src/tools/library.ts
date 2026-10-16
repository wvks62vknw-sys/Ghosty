/**
 * The library tools: search everything Ghosty has read (no AI needed), add web pages,
 * papers, CVEs and code repositories, and list what is there. Files (PDFs, books, notes)
 * are added by the owner in the Library tab.
 */
import { asData } from '../kernel/permissions';
import { importSelf, importSource } from '../library/importers';
import { DOMAINS } from '../library/curriculum';
import { exportLibrary } from '../library/export';
import { loadStudy, matchDomains, STUDY_KEY, studySummary } from '../library/study';
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
    pure: true,
    async run(a, ctx) {
      const l = lib(ctx);
      await l.seedStarter();
      const hits = await l.search(arg.str(a, 'query'), Math.max(1, Math.min(10, arg.num(a, 'k', 5))));
      if (!hits.length) return 'Nothing in the library matches that. (The owner can add books and documents in the Library tab, or ask you to library_import a web page, arXiv paper, CVE, GitHub repository or Project Gutenberg book.)';
      return clip(asData('your library', formatHits(hits, 7000)), 8000);
    },
  },
  {
    name: 'library_import',
    description:
      'Add knowledge to your library permanently, without AI: a web page or text file (https://…), an arXiv paper ("1706.03762"), a CVE record ("CVE-2021-44228"), a public GitHub repository ("owner/repo", 30 files at a time — pass offset to continue), a Project Gutenberg book ("gutenberg.org/ebooks/1342" or "gutenberg 1342": the whole text, chapter by chapter, a part at a time — pass offset to continue), or "self" = YOUR OWN source code and architecture (25 files at a time; pass offset to continue) so you understand exactly how you work. PDFs, Word files and e-books are added by the owner in the Library tab.',
    parameters: { type: 'object', properties: { source: { type: 'string' }, offset: { type: 'number', description: 'GitHub only: continue from this file number' } }, required: ['source'] },
    risk: 'auto',
    async run(a, ctx) {
      const l = lib(ctx);
      const source = arg.str(a, 'source').trim();
      if (/^(self|me|myself|yourself|your (own )?(code|source)|my (own )?(code|source)|ghosty)$/i.test(source)) {
        const g = await ctx.github();
        if (!g) throw new Error('reading your own code needs the GitHub token (System tab)');
        const r = await importSelf(l, g, await g.defaultBranch(), { offset: arg.num(a, 'offset', 0), onProgress: ctx.progress });
        return `Read ${r.files} of my own files into the library ("${r.doc.title}", ${r.doc.passages} passages so far). ${r.next !== null ? `${r.total - r.next} files left — call library_import again with source "self" and offset ${r.next}.` : 'That was the last of them: my whole codebase is in the library.'}`;
      }
      // The chat shows how far a long import has got (file n of N, the pages of a paper) under this tool's line.
      const r = await importSource(l, source, { offset: arg.num(a, 'offset', 0), onProgress: ctx.progress });
      return `Saved "${r.doc.title}" to the library: ${r.passages} passages (${Math.round(r.doc.chars / 1000)}k characters). ${r.note}`.trim();
    },
  },
  {
    name: 'library_list',
    description: 'List the documents in your library with their size.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    pure: true,
    async run(_a, ctx) {
      const l = lib(ctx);
      await l.seedStarter();
      const s = l.stats();
      const docs = l.list();
      return clip(`${s.docs} documents, ${s.passages} passages, ${(s.bytes / 1e6).toFixed(1)} MB.\n${docs.map((d) => `- ${d.title}${d.builtin ? ' (starter)' : ''} — ${d.passages} passages${d.source && !d.builtin ? ` — ${d.source}` : ''}`).join('\n')}`, 6000);
    },
  },
  {
    name: 'study_progress',
    description: "How your self-study is going: what you have read, digested and drilled, by domain and skill, today's counts, and what is next. Use it when the owner asks what you have been learning or how your studies are going.",
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    pure: true,
    async run(_a, ctx) {
      const st = await loadStudy(ctx.storage);
      const s = studySummary(st);
      const acc = s.drills.asked ? Math.round((100 * s.drills.right) / s.drills.asked) : null;
      const weak = s.drills.skills.slice(0, 4).map((k) => `${k.skill} ${k.right}/${k.n}`).join(', ');
      const lines = [
        `Self-study is ${st.on ? 'on' : 'off'}: ${s.read} of ${s.topics} topics read, ${s.digested} digested, ${s.drills.asked} drills${acc === null ? '' : ` (${acc}% right)`}; today ${s.today.reads} read, ${s.today.digests} digested, ${s.today.drills} drilled.`,
        st.focus.length ? `Focus: ${st.focus.join(', ')}.` : 'No focus set (every domain in turn).',
        weak ? `Shakiest skills: ${weak}.` : '',
        st.last ? `Last: ${st.last.kind ?? 'read'} "${st.last.topic}" — ${st.last.error ? `failed: ${st.last.error}` : st.last.title ?? 'done'}.` : '',
        `Domains: ${s.domains.map((d) => `${d.name} ${d.read}/${d.topics}${d.focus ? ' ★' : ''}`).join('; ')}.`,
      ];
      return clip(lines.filter(Boolean).join('\n'), 5000);
    },
  },
  {
    name: 'focus_study',
    description: 'Put some study domains first ("focus on quantum computing and macroeconomics"), or clear the focus ("none"). The rest of the curriculum carries on after them.',
    parameters: { type: 'object', properties: { on: { type: 'string', description: 'words naming the domains, or "none"' } }, required: ['on'] },
    risk: 'auto',
    async run(a, ctx) {
      const words = arg.str(a, 'on');
      const st = await loadStudy(ctx.storage);
      st.focus = /^(none|off|clear|-)$/i.test(words.trim()) ? [] : matchDomains(words).slice(0, 6);
      await ctx.storage.put(STUDY_KEY, st);
      return st.focus.length ? `Focusing on: ${st.focus.join(', ')} (then everything else in turn).` : words.trim().toLowerCase() === 'none' ? 'Focus cleared: every domain in turn.' : `No domain matches "${words}". Domains: ${DOMAINS.map((d) => d.name).join(', ')}.`;
    },
  },
  {
    name: 'library_export',
    description: "Export your notebooks (study notes, reading, drills, research notes) as Markdown files to the 'library' branch of your own GitHub repository, so the owner can read them anywhere. Up to 40 notebooks per call; pass offset to continue.",
    parameters: { type: 'object', properties: { offset: { type: 'number' } } },
    risk: 'auto',
    async run(a, ctx) {
      const g = await ctx.github();
      const repo = ctx.env.GITHUB_REPO;
      if (!g || !repo) throw new Error('exporting needs the GitHub token (System tab)');
      const r = await exportLibrary(g, lib(ctx), repo, { offset: arg.num(a, 'offset', 0), onProgress: ctx.progress });
      return `Exported ${r.files} notebook${r.files === 1 ? '' : 's'} (${r.passages} passages) to ${r.url}.${r.left ? ` ${r.left} more to go — call library_export again with offset ${(arg.num(a, 'offset', 0) || 0) + r.files}.` : ''}`;
    },
  },
];
