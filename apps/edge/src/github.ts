/**
 * KERNEL-ADJACENT — protected (see kernel/protected.ts).
 *
 * Minimal GitHub REST client for Ghosty's own repository. Every self-edit becomes a
 * branch + pull request; shipping merges it; restoring creates a new commit whose
 * files equal an earlier version, so history is never rewritten.
 */
import type { ChangeSummary, VersionSummary } from '../../../packages/shared/src/protocol';

export interface FileEdit {
  path: string;
  action: 'write' | 'replace' | 'delete';
  content?: string;
  find?: string;
  replace?: string;
}

export interface PullRequest {
  number: number;
  title: string;
  state: string;
  merged: boolean;
  head: { ref: string; sha: string; repo?: { full_name?: string } | null };
  html_url: string;
  created_at: string;
}

const API = 'https://api.github.com';
export const BRANCH_PREFIX = 'ghosty/';

function utf8ToB64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64ToUtf8(b64: string): string {
  const bin = atob(b64.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Cloudflare Pages branch alias: lowercase, non-alphanumerics to "-", max 28 chars. */
export function pagesAlias(branch: string): string {
  return branch
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 28)
    .replace(/^-+|-+$/g, '');
}

export class GitHub {
  constructor(
    private token: string,
    readonly repo: string,
    private pagesProject?: string,
    /** Hostname Ghosty is being served from, e.g. ghosty.yourname.workers.dev. */
    private selfHost?: string,
  ) {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    const r = await fetch(`${API}/repos/${this.repo}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ghosty-brain',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.status === 204) return undefined as T;
    const text = await r.text();
    if (!r.ok) throw new Error(`GitHub ${method} ${path} → ${r.status}: ${text.slice(0, 300)}`);
    return (text ? JSON.parse(text) : undefined) as T;
  }

  async defaultBranch(): Promise<string> {
    const j = await this.req<{ default_branch: string }>('GET', '');
    return j.default_branch;
  }

  async headSha(branch: string): Promise<string> {
    const j = await this.req<{ object: { sha: string } }>('GET', `/git/ref/heads/${encodeURIComponent(branch)}`);
    return j.object.sha;
  }

  async tree(ref: string): Promise<string[]> {
    const j = await this.req<{ tree: { path: string; type: string }[]; truncated: boolean }>('GET', `/git/trees/${encodeURIComponent(ref)}?recursive=1`);
    return j.tree.filter((t) => t.type === 'blob').map((t) => t.path);
  }

  async read(path: string, ref: string): Promise<string | null> {
    try {
      const j = await this.req<{ content?: string; encoding?: string; type: string; download_url?: string }>(
        'GET',
        `/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
      );
      if (j.type !== 'file') return null;
      if (j.content && j.encoding === 'base64') return b64ToUtf8(j.content);
      if (j.download_url) {
        const r = await fetch(j.download_url, { headers: { Authorization: `Bearer ${this.token}`, 'User-Agent': 'ghosty-brain' } });
        return r.ok ? await r.text() : null;
      }
      return '';
    } catch (e) {
      if (String(e).includes('→ 404')) return null;
      throw e;
    }
  }

  /** Apply edits on top of `baseRef` and return the new commit's sha. */
  async commit(baseRef: string, message: string, edits: FileEdit[]): Promise<string> {
    const base = await this.req<{ sha: string; tree: { sha: string } }>('GET', `/git/commits/${baseRef}`);
    const entries: { path: string; mode: '100644'; type: 'blob'; sha?: string | null; content?: string }[] = [];
    for (const e of edits) {
      if (e.action === 'delete') {
        entries.push({ path: e.path, mode: '100644', type: 'blob', sha: null });
        continue;
      }
      let content = e.content ?? '';
      if (e.action === 'replace') {
        const current = await this.read(e.path, baseRef);
        if (current === null) throw new Error(`${e.path} does not exist, so it cannot be edited with "replace". Use "write".`);
        const find = e.find ?? '';
        if (!find) throw new Error(`"replace" on ${e.path} needs a "find" string`);
        const count = current.split(find).length - 1;
        if (count !== 1) {
          throw new Error(`"find" text appears ${count} times in ${e.path}; it must appear exactly once. Read the file again and copy a longer exact snippet.`);
        }
        content = current.replace(find, () => e.replace ?? '');
      }
      const blob = await this.req<{ sha: string }>('POST', '/git/blobs', { content: utf8ToB64(content), encoding: 'base64' });
      entries.push({ path: e.path, mode: '100644', type: 'blob', sha: blob.sha });
    }
    const tree = await this.req<{ sha: string }>('POST', '/git/trees', { base_tree: base.tree.sha, tree: entries });
    const c = await this.req<{ sha: string }>('POST', '/git/commits', { message, tree: tree.sha, parents: [base.sha] });
    return c.sha;
  }

  async createBranch(name: string, sha: string): Promise<void> {
    await this.req('POST', '/git/refs', { ref: `refs/heads/${name}`, sha });
  }

  async moveBranch(name: string, sha: string): Promise<void> {
    await this.req('PATCH', `/git/refs/heads/${encodeURIComponent(name)}`, { sha, force: false });
  }

  async deleteBranch(name: string): Promise<void> {
    await this.req('DELETE', `/git/refs/heads/${encodeURIComponent(name)}`).catch(() => undefined);
  }

  async openPr(branch: string, base: string, title: string, body: string): Promise<number> {
    const j = await this.req<{ number: number }>('POST', '/pulls', { title, head: branch, base, body });
    return j.number;
  }

  previewFor(branch: string): string | null {
    if (this.pagesProject) return `https://${pagesAlias(branch)}.${this.pagesProject}.pages.dev`;
    // Worker Previews: <branch>-<worker>.<subdomain>.workers.dev (a best guess; the link
    // Cloudflare reports on the change's checks is preferred when there is one).
    const m = this.selfHost?.match(/^([a-z0-9-]+)\.([a-z0-9-]+)\.workers\.dev$/i);
    if (!m) return null;
    const worker = m[1]!.toLowerCase();
    const alias = branch.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, Math.max(1, 62 - worker.length)).replace(/-+$/g, '');
    return `https://${alias}-${worker}.${m[2]!.toLowerCase()}.workers.dev`;
  }

  async pr(n: number): Promise<PullRequest> {
    return this.req('GET', `/pulls/${n}`);
  }

  /** True only for Ghosty's own changes: a ghosty/ branch in THIS repository (never a fork). */
  isOwn(p: Pick<PullRequest, 'head'>): boolean {
    return p.head.ref.startsWith(BRANCH_PREFIX) && p.head.repo?.full_name?.toLowerCase() === this.repo.toLowerCase();
  }

  /** An open PR that Ghosty itself created, or an error. */
  async ownOpenPr(n: number): Promise<PullRequest> {
    const p = await this.pr(n);
    if (!this.isOwn(p)) throw new Error(`#${n} is not one of Ghosty's own changes (it must come from a ${BRANCH_PREFIX} branch in ${this.repo}).`);
    if (p.state !== 'open') throw new Error(`change #${n} is ${p.merged ? 'already shipped' : 'closed'}`);
    return p;
  }

  async files(n: number): Promise<string[]> {
    const j = await this.req<{ filename: string; status: string }[]>('GET', `/pulls/${n}/files?per_page=100`);
    return j.map((f) => `${f.filename}${f.status === 'removed' ? ' (deleted)' : f.status === 'added' ? ' (new)' : ''}`);
  }

  async openChanges(): Promise<ChangeSummary[]> {
    const prs = await this.req<PullRequest[]>('GET', '/pulls?state=open&per_page=20');
    const out: ChangeSummary[] = [];
    for (const p of prs.filter((x) => this.isOwn(x))) {
      const s = await this.checks(p.head.sha);
      out.push({ number: p.number, title: p.title, branch: p.head.ref, sha: p.head.sha, url: p.html_url, previewUrl: s.previewUrl ?? this.previewFor(p.head.ref), checks: s.state, createdAt: p.created_at });
    }
    return out;
  }

  /** Combined result of CI checks and the Cloudflare Pages build for a commit. */
  async checks(sha: string): Promise<{ state: ChangeSummary['checks']; previewUrl: string | null; details: string }> {
    const runs = await this.req<{ check_runs: { name: string; status: string; conclusion: string | null; details_url?: string; output?: { summary?: string; text?: string } }[] }>('GET', `/commits/${sha}/check-runs?per_page=30`).catch(() => ({ check_runs: [] }));
    const statuses = await this.req<{ statuses: { context: string; state: string; target_url?: string; description?: string }[] }>('GET', `/commits/${sha}/status`).catch(() => ({ statuses: [] }));
    const items = [
      ...runs.check_runs.map((r) => ({ name: r.name, done: r.status === 'completed', ok: r.conclusion === 'success' || r.conclusion === 'neutral' || r.conclusion === 'skipped', url: r.details_url ?? '', text: `${r.output?.summary ?? ''}\n${r.output?.text ?? ''}` })),
      ...statuses.statuses.map((s) => ({ name: s.context, done: s.state !== 'pending', ok: s.state === 'success', url: s.target_url ?? '', text: s.description ?? '' })),
    ];
    const preview = items.map((i) => `${i.url}\n${i.text}`.match(/https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.(?:pages|workers)\.dev/i)?.[0]).find(Boolean) ?? null;
    const state: ChangeSummary['checks'] = !items.length ? 'none' : items.some((i) => i.done && !i.ok) ? 'failed' : items.every((i) => i.done) ? 'passed' : 'pending';
    const details = items.map((i) => `${i.name}: ${!i.done ? 'running' : i.ok ? 'passed' : 'FAILED'}${i.done && !i.ok && i.text.trim() ? `\n${i.text.trim().slice(0, 1500)}` : ''}`).join('\n');
    return { state, previewUrl: preview, details };
  }

  /** Merge, but only if the branch is still exactly at `sha` (GitHub refuses otherwise). */
  async merge(n: number, title: string, sha: string): Promise<string> {
    const j = await this.req<{ sha: string }>('PUT', `/pulls/${n}/merge`, { merge_method: 'squash', commit_title: `${title} (#${n})`, sha });
    return j.sha;
  }

  async close(n: number): Promise<void> {
    await this.req('PATCH', `/pulls/${n}`, { state: 'closed' });
  }

  async versions(branch: string, n = 15): Promise<VersionSummary[]> {
    const j = await this.req<{ sha: string; commit: { message: string; committer: { date: string } } }[]>('GET', `/commits?sha=${encodeURIComponent(branch)}&per_page=${n}`);
    return j.map((c) => ({ sha: c.sha, message: c.commit.message.split('\n')[0]!, date: c.commit.committer.date }));
  }

  /** Make `branch` look exactly like `sha` again, as a new commit (history is kept). */
  async restore(branch: string, sha: string): Promise<string> {
    const target = await this.req<{ tree: { sha: string }; message: string }>('GET', `/git/commits/${sha}`);
    const head = await this.headSha(branch);
    const c = await this.req<{ sha: string }>('POST', '/git/commits', {
      message: `Restore Ghosty to ${sha.slice(0, 7)} (${target.message.split('\n')[0]})`,
      tree: target.tree.sha,
      parents: [head],
    });
    await this.moveBranch(branch, c.sha);
    return c.sha;
  }
}
