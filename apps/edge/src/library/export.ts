/**
 * The library, readable outside Ghosty: its notebooks (study notes, the reading log, drills,
 * research notes, builds) exported as Markdown files to a branch of Ghosty's own repository
 * (`library`, created on first use; no builds run from it). Free, off the phone, versioned,
 * readable on github.com — and Ghosty can read it back. One call writes up to 40 files (the
 * free plan allows ~50 outbound requests per request); a big library takes a few calls.
 */
import type { GitHub } from '../github';
import type { ProgressFn } from '../tools/types';
import type { Library } from './store';

export const EXPORT_BRANCH = 'library';
const MAX_FILES = 40;

export interface ExportResult {
  branch: string;
  files: number;
  passages: number;
  /** How many documents were left for a later call. */
  left: number;
  url: string;
}

/** Documents worth exporting: what Ghosty wrote (not the owner's uploads, not the built-in starter texts). */
export const exportable = (d: { id: string; kind: string; builtin?: boolean; status: string }) => d.status === 'ready' && !d.builtin && /^(digest_|read_|study_|notes_)/.test(d.id);

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'doc';

function markdown(title: string, source: string, passages: { heading: string; text: string }[]): string {
  const out: string[] = [`# ${title}`, '', source ? `_${source}_` : '', ''];
  let last = '';
  for (const p of passages) {
    if (p.heading && p.heading !== last) {
      out.push(`## ${p.heading}`, '');
      last = p.heading;
    }
    out.push(p.text, '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
}

/**
 * Write the next batch of notebooks to the branch. `offset` skips documents already written
 * by an earlier call (the list is in a fixed order). `onProgress` hears which file is being
 * gathered (n of N) and when the commit goes up.
 */
export async function exportLibrary(g: GitHub, lib: Library, repo: string, opts: { offset?: number; onProgress?: ProgressFn } = {}): Promise<ExportResult> {
  const docs = lib.list().filter(exportable).sort((a, b) => a.id.localeCompare(b.id));
  const offset = Math.max(0, opts.offset ?? 0);
  const batch = docs.slice(offset, offset + MAX_FILES);
  const files: { path: string; content: string }[] = [];
  let passages = 0;
  for (const [i, d] of batch.entries()) {
    opts.onProgress?.(`gathering ${d.title}…`, i + 1, batch.length);
    const all: { heading: string; text: string }[] = [];
    let after = 0;
    for (let guard = 0; guard < 50; guard++) {
      const page = lib.passagesOf(d.id, after, 400);
      for (const p of page.passages) all.push({ heading: p.heading, text: p.text });
      if (page.next === null) break;
      after = page.next;
    }
    passages += all.length;
    files.push({ path: `library/${slug(d.id)}.md`, content: markdown(d.title, d.source, all) });
  }
  const readme = {
    path: 'README.md',
    content: `# Ghosty's library\n\nWhat Ghosty has studied and written, exported as Markdown (one file per notebook).\nUpdated by Ghosty itself; read it here or in the Library tab.\n\n${docs.map((d) => `- [${d.title}](library/${slug(d.id)}.md) — ${d.passages} passages`).join('\n')}\n`,
  };
  opts.onProgress?.(`writing ${files.length} file${files.length === 1 ? '' : 's'} to GitHub…`);
  // The branch starts from the default branch's tree the first time, so it is a normal branch (no orphan tricks).
  let base: string;
  try {
    base = await g.headSha(EXPORT_BRANCH);
  } catch {
    base = await g.headSha(await g.defaultBranch());
    await g.createBranch(EXPORT_BRANCH, base);
  }
  const sha = await g.commitStaged(base, `Library export: ${batch.length} notebook${batch.length === 1 ? '' : 's'}, ${passages} passages`, [...files, readme]);
  await g.moveBranch(EXPORT_BRANCH, sha);
  return { branch: EXPORT_BRANCH, files: files.length, passages, left: Math.max(0, docs.length - offset - batch.length), url: `https://github.com/${repo}/tree/${EXPORT_BRANCH}` };
}
