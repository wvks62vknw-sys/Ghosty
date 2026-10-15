/**
 * KERNEL-ADJACENT — protected (see kernel/protected.ts).
 *
 * Self-editing. Ghosty changes its own source code through these tools:
 *   repo_tree / repo_read / repo_search  → understand the code (start with MAP.md)
 *   propose_change                       → branch + commit + pull request (Cloudflare builds a preview)
 *   change_status                        → CI result, preview link, error output to fix
 *   update_change                        → push a fix to an open change
 *   ship_change (owner approval)         → merge; the live Ghosty updates in ~1–2 minutes
 *   discard_change                       → close a change without shipping
 *   list_versions / restore_version      → roll back (owner approval)
 */
import { pathProblem, UNREADABLE } from '../kernel/protected';

/** Deploy settings (incl. the owner password hash) are never read into the conversation. */
const unreadable = (p: string) => UNREADABLE.test(p.replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/(^|\/)\.\//g, '$1'));
import { BRANCH_PREFIX, type FileEdit, type GitHub } from '../github';
import { arg, clip, type Tool, type ToolContext } from './types';

async function gh(ctx: ToolContext): Promise<GitHub> {
  const g = await ctx.github();
  if (!g) throw new Error('Self-editing is not set up: set GITHUB_REPO on the brain Worker and add a GitHub token in the System tab (see SETUP.md).');
  return g;
}

async function mainBranch(g: GitHub, ctx: ToolContext): Promise<string> {
  const cached = await ctx.storage.get<string>('repo:main');
  if (cached) return cached;
  const b = await g.defaultBranch();
  await ctx.storage.put('repo:main', b);
  return b;
}

function parseEdits(raw: unknown): FileEdit[] {
  if (!Array.isArray(raw) || !raw.length) throw new Error('"edits" must be a non-empty list');
  if (raw.length > 25) throw new Error('at most 25 file edits per change; split bigger work into several changes');
  return raw.map((e, i) => {
    const o = (e ?? {}) as Record<string, unknown>;
    const path = String(o.path ?? '').trim();
    const action = String(o.action ?? 'write') as FileEdit['action'];
    if (!['write', 'replace', 'delete'].includes(action)) throw new Error(`edit ${i + 1}: action must be write, replace or delete`);
    if (action === 'write' && typeof o.content !== 'string') throw new Error(`edit ${i + 1} (${path}): "write" needs "content" (the whole new file)`);
    if (action === 'replace' && typeof o.find !== 'string') throw new Error(`edit ${i + 1} (${path}): "replace" needs "find" and "replace"`);
    return { path, action, content: o.content as string | undefined, find: o.find as string | undefined, replace: (o.replace as string | undefined) ?? '' };
  });
}

async function checkPaths(edits: FileEdit[], ctx: ToolContext): Promise<void> {
  const unlocked = await ctx.kernelUnlocked();
  for (const e of edits) {
    const p = pathProblem(e.path, unlocked);
    if (p) throw new Error(p);
  }
}

const editSchema = {
  type: 'array',
  description:
    'File edits. action "replace": swap one exact snippet (find must appear exactly once — copy it from repo_read). action "write": the COMPLETE new file content (for new files or full rewrites). action "delete": remove a file.',
  items: {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'repository path, e.g. apps/web/src/features/brief/index.ts' },
      action: { type: 'string', enum: ['replace', 'write', 'delete'] },
      find: { type: 'string' },
      replace: { type: 'string' },
      content: { type: 'string' },
    },
    required: ['path', 'action'],
  },
};

export const repoTools: Tool[] = [
  {
    name: 'repo_tree',
    description: "List files in your own source code repository. Optionally filter by a path prefix such as 'apps/web/src/'.",
    parameters: { type: 'object', properties: { prefix: { type: 'string' } } },
    risk: 'auto',
    async run(a, ctx) {
      const g = await gh(ctx);
      const prefix = arg.str(a, 'prefix', false);
      const files = (await g.tree(await mainBranch(g, ctx))).filter((p) => !prefix || p.startsWith(prefix)).filter((p) => !p.startsWith('apps/web/public/data/'));
      return clip(files.join('\n'), 12000);
    },
  },
  {
    name: 'repo_read',
    description: 'Read a file from your own source code (main branch, or a change branch via "ref"). Read MAP.md first when planning a change.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, ref: { type: 'string' } }, required: ['path'] },
    risk: 'auto',
    async run(a, ctx) {
      const g = await gh(ctx);
      const path = arg.str(a, 'path');
      if (unreadable(path)) throw new Error(`${path} holds deploy settings and is not readable; MAP.md describes what it contains.`);
      const text = await g.read(path, arg.str(a, 'ref', false) || (await mainBranch(g, ctx)));
      if (text === null) throw new Error(`${path} does not exist`);
      return clip(text, 40000);
    },
  },
  {
    name: 'repo_search',
    description: 'Find lines containing some text across source files under a path prefix (max 30 files scanned). Use to locate where something is implemented.',
    parameters: { type: 'object', properties: { text: { type: 'string' }, prefix: { type: 'string', description: "e.g. 'apps/web/src/'" } }, required: ['text', 'prefix'] },
    risk: 'auto',
    async run(a, ctx) {
      const g = await gh(ctx);
      const needle = arg.str(a, 'text').toLowerCase();
      const prefix = arg.str(a, 'prefix');
      const ref = await mainBranch(g, ctx);
      const files = (await g.tree(ref)).filter((p) => p.startsWith(prefix) && /\.(ts|tsx|js|mjs|css|html|md|json|jsonc)$/.test(p) && !p.includes('/data/') && !unreadable(p)).slice(0, 30);
      const hits: string[] = [];
      for (const f of files) {
        const t = await g.read(f, ref);
        if (!t) continue;
        t.split('\n').forEach((line, i) => {
          if (hits.length < 60 && line.toLowerCase().includes(needle)) hits.push(`${f}:${i + 1}: ${line.trim().slice(0, 160)}`);
        });
      }
      return hits.length ? hits.join('\n') : `No matches in ${files.length} files under ${prefix}.`;
    },
  },
  {
    name: 'propose_change',
    description:
      'Change your own source code. Creates a branch and pull request; Cloudflare then builds a private preview of the changed Ghosty. Nothing goes live until the owner ships it. Keep changes small and focused. Afterwards call change_status (builds take 1–2 minutes).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'short summary, e.g. "Add rain radar panel to Brief"' },
        summary: { type: 'string', description: 'what changed and why, for the owner' },
        edits: editSchema,
      },
      required: ['title', 'summary', 'edits'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const g = await gh(ctx);
      const title = arg.str(a, 'title').slice(0, 90);
      const edits = parseEdits(a.edits);
      await checkPaths(edits, ctx);
      const main = await mainBranch(g, ctx);
      const head = await g.headSha(main);
      const sha = await g.commit(head, `${title}\n\nProposed by Ghosty.`, edits);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 16);
      const branch = `${BRANCH_PREFIX}${slug}-${Date.now().toString(36).slice(-4)}`;
      await g.createBranch(branch, sha);
      const body = `${arg.str(a, 'summary', false)}\n\n**Files:** ${edits.map((e) => `\`${e.path}\` (${e.action})`).join(', ')}\n\n_Proposed by Ghosty. Ship it from the Workshop tab or by telling Ghosty "ship it"._`;
      const pr = await g.openPr(branch, main, title, body);
      ctx.emit({ t: 'client', name: 'notify', args: { text: `Change #${pr} proposed: ${title}` } });
      const preview = g.previewFor(branch);
      return `Opened change #${pr} on branch ${branch}.${preview ? ` Preview (ready in ~1–2 min): ${preview}` : ''} Call change_status with pr=${pr} to check the build before suggesting the owner ships it.`;
    },
  },
  {
    name: 'update_change',
    description: 'Push more edits to an open change (for example to fix a failed build). Same edit format as propose_change.',
    parameters: { type: 'object', properties: { pr: { type: 'number' }, note: { type: 'string' }, edits: editSchema }, required: ['pr', 'edits'] },
    risk: 'auto',
    async run(a, ctx) {
      const g = await gh(ctx);
      const n = arg.num(a, 'pr');
      const pr = await g.ownOpenPr(n);
      const edits = parseEdits(a.edits);
      await checkPaths(edits, ctx);
      const sha = await g.commit(pr.head.sha, arg.str(a, 'note', false) || 'Fix from Ghosty', edits);
      await g.moveBranch(pr.head.ref, sha);
      return `Updated change #${n}. A new preview build has started; check change_status in 1–2 minutes.`;
    },
  },
  {
    name: 'change_status',
    description: 'Check an open change: build/CI results (with error output if something failed) and the preview link.',
    parameters: { type: 'object', properties: { pr: { type: 'number' } }, required: ['pr'] },
    risk: 'auto',
    async run(a, ctx) {
      const g = await gh(ctx);
      const n = arg.num(a, 'pr');
      const pr = await g.pr(n);
      const c = await g.checks(pr.head.sha);
      const preview = c.previewUrl ?? (c.preview === 'ok' ? g.previewFor(pr.head.ref) : null);
      return clip(
        `Change #${n} "${pr.title}" — ${pr.merged ? 'SHIPPED' : pr.state.toUpperCase()}\nCode checks: ${c.state}${c.state === 'failed' ? ' — fix with update_change before asking to ship' : ''}\nPreview build: ${c.preview}${c.preview === 'failed' ? ' (a Cloudflare preview problem; it does not block shipping if the code checks pass)' : ''}\n${c.details || '(no checks reported yet — builds can take a minute to start)'}\nPreview: ${preview ?? 'not reported yet (Cloudflare posts it on the change once the preview build finishes)'}`,
        5000,
      );
    },
  },
  {
    name: 'list_changes',
    description: 'List your open (unshipped) changes.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const list = await (await gh(ctx)).openChanges();
      return list.length ? list.map((c) => `#${c.number} ${c.title} — checks ${c.checks}${c.previewUrl ? ` — ${c.previewUrl}` : ''}`).join('\n') : 'No open changes.';
    },
  },
  {
    name: 'ship_change',
    description: 'Ship an open change to the live Ghosty (merges it). Needs the owner\'s approval, and only works once its checks have passed (see change_status).',
    parameters: { type: 'object', properties: { pr: { type: 'number' } }, required: ['pr'] },
    risk: 'confirm',
    /** Pin the exact commit being approved, and show the owner what it touches. */
    async approval(a, ctx) {
      const g = await gh(ctx);
      const n = arg.num(a, 'pr');
      const pr = await g.ownOpenPr(n);
      const c = await g.checks(pr.head.sha);
      if (c.state !== 'passed') {
        throw new Error(`change #${n} cannot be shipped by me yet: checks are ${c.state}. ${c.state === 'failed' ? `Fix it with update_change.\n${c.details}` : 'Wait for the build, then try again (the owner can also ship it from the Workshop tab).'}`);
      }
      const files = await g.files(n);
      const brain = files.some((f) => f.startsWith('apps/edge/'));
      return {
        args: { pr: n, sha: pr.head.sha },
        reason: `Ship change #${n} "${pr.title}" (commit ${pr.head.sha.slice(0, 7)})? It changes ${files.length} file(s)${brain ? ', including my brain code' : ''}: ${files.slice(0, 8).join(', ')}${files.length > 8 ? '…' : ''}`,
      };
    },
    async run(a, ctx) {
      const g = await gh(ctx);
      const n = arg.num(a, 'pr');
      const sha = arg.str(a, 'sha', false);
      if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error('shipping needs the exact approved commit; ask the owner to approve again');
      const pr = await g.ownOpenPr(n);
      if (pr.head.sha !== sha) throw new Error(`change #${n} changed after it was approved (now ${pr.head.sha.slice(0, 7)}); review and approve again`);
      const merged = await g.merge(n, pr.title, sha);
      await g.deleteBranch(pr.head.ref);
      ctx.emit({ t: 'client', name: 'notify', args: { text: `Shipped #${n}. Live in about a minute.` } });
      return `Shipped change #${n} (commit ${merged.slice(0, 7)}). Cloudflare is deploying it; the interface can be reloaded in about a minute.`;
    },
  },
  {
    name: 'discard_change',
    description: 'Close an open change without shipping it.',
    parameters: { type: 'object', properties: { pr: { type: 'number' } }, required: ['pr'] },
    risk: 'auto',
    async run(a, ctx) {
      const g = await gh(ctx);
      const n = arg.num(a, 'pr');
      const pr = await g.ownOpenPr(n);
      await g.close(n);
      await g.deleteBranch(pr.head.ref);
      return `Discarded change #${n}.`;
    },
  },
  {
    name: 'list_versions',
    description: 'List recent live versions of Ghosty (most recent first), for rolling back.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const g = await gh(ctx);
      const v = await g.versions(await mainBranch(g, ctx));
      return v.map((x) => `${x.sha.slice(0, 7)}  ${x.date.slice(0, 16).replace('T', ' ')}  ${x.message}`).join('\n');
    },
  },
  {
    name: 'restore_version',
    description: 'Roll the live Ghosty back to an earlier version (by commit sha from list_versions). Needs the owner\'s approval.',
    parameters: { type: 'object', properties: { sha: { type: 'string' } }, required: ['sha'] },
    risk: 'confirm',
    async approval(a, ctx) {
      const g = await gh(ctx);
      const want = arg.str(a, 'sha').toLowerCase();
      if (!/^[0-9a-f]{7,40}$/.test(want)) throw new Error('give at least the first 7 characters of the version id (from list_versions)');
      const matches = (await g.versions(await mainBranch(g, ctx), 50)).filter((v) => v.sha.startsWith(want));
      if (matches.length !== 1) throw new Error(matches.length ? `${want} matches several versions; give more characters` : `no recent version starts with ${want}`);
      const v = matches[0]!;
      return { args: { sha: v.sha }, reason: `Roll Ghosty back to version ${v.sha.slice(0, 7)} — "${v.message}" from ${v.date.slice(0, 16).replace('T', ' ')}? (This becomes a new version, so it can be undone.)` };
    },
    async run(a, ctx) {
      const g = await gh(ctx);
      const main = await mainBranch(g, ctx);
      const want = arg.str(a, 'sha').toLowerCase();
      if (!/^[0-9a-f]{40}$/.test(want)) throw new Error('restoring needs the full approved version id; ask the owner to approve again');
      const match = (await g.versions(main, 50)).find((v) => v.sha === want);
      if (!match) throw new Error(`version ${want.slice(0, 7)} is not among the recent versions`);
      const sha = await g.restore(main, match.sha);
      return `Restored to ${match.sha.slice(0, 7)} ("${match.message}") as new commit ${sha.slice(0, 7)}. Deploying now.`;
    },
  },
];
