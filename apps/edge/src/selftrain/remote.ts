/**
 * The two outside services the weekly training uses, called with the owner's own keys (vault names
 * `kaggle` and `hf_write`; keys.ts): Kaggle (pushes the notebook with GPU and internet on, reads how the
 * run is going) and Hugging Face (the private dataset repo with the week's data, checkpoints and adapters;
 * the public model repo the phone downloads the new brain from). Plain fetch; `fetch` is injectable so the
 * tests can stand in for both services. Errors come back as `RemoteError` with a plain message.
 *
 * Endpoints: Kaggle's public API v1 (www.kaggle.com/api/v1: kernels/push, kernels/status, kernels/list),
 * the same calls the official `kaggle` CLI makes; Hugging Face's Hub API (whoami-v2, repos/create, the
 * commit endpoint with NDJSON operations, preupload, and the Git LFS batch API for files it wants in LFS).
 */

export class RemoteError extends Error {
  constructor(
    message: string,
    public status = 0,
  ) {
    super(message);
  }
}

type Fetch = typeof fetch;

// ---- Kaggle -------------------------------------------------------------------------------------------------

export interface KaggleCreds {
  username: string;
  /** A legacy API key (Basic auth) or a new API token (KGAT_…, Bearer). */
  key: string;
}

/** The kaggle key as pasted: the kaggle.json file's text, "username key", or "username KGAT_token". */
export function parseKaggleKey(value: string): KaggleCreds | null {
  const v = value.trim();
  if (v.startsWith('{')) {
    try {
      const j = JSON.parse(v) as { username?: unknown; key?: unknown };
      if (typeof j.username === 'string' && typeof j.key === 'string' && j.username && j.key) return { username: j.username.trim(), key: j.key.trim() };
    } catch {
      return null;
    }
    return null;
  }
  const parts = v.split(/\s+/);
  if (parts.length === 2 && /^[A-Za-z0-9_-]{2,50}$/.test(parts[0]!) && parts[1]!.length >= 16) return { username: parts[0]!, key: parts[1]! };
  return null;
}

const KAGGLE = 'https://www.kaggle.com/api/v1';

function kaggleAuth(c: KaggleCreds): string {
  return c.key.startsWith('KGAT_') ? `Bearer ${c.key}` : `Basic ${btoa(`${c.username}:${c.key}`)}`;
}

async function kaggleCall<T>(f: Fetch, c: KaggleCreds, method: string, path: string, body?: unknown): Promise<T> {
  const r = await f(`${KAGGLE}${path}`, {
    method,
    headers: { Authorization: kaggleAuth(c), 'content-type': 'application/json', 'user-agent': 'ghosty-selftrain' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (r.status === 401 || r.status === 403) throw new RemoteError('Kaggle says the key is not valid (or the account has not confirmed its phone number, which GPUs need).', r.status);
  if (!r.ok) throw new RemoteError(`Kaggle answered ${r.status}: ${text.slice(0, 200)}`, r.status);
  try {
    return JSON.parse(text || '{}') as T;
  } catch {
    throw new RemoteError(`Kaggle sent something that is not JSON (${r.status})`, r.status);
  }
}

/** The notebook's slug on the owner's account. */
export const KERNEL_SLUG = 'ghosty-weekly-training';

/** Push (and so start) the notebook: private, a GPU, the internet on. Returns the version and its address. */
export async function pushKernel(f: Fetch, c: KaggleCreds, source: string): Promise<{ ref: string; url: string; version: number }> {
  const j = await kaggleCall<{ ref?: string; url?: string; versionNumber?: number; error?: string }>(f, c, 'POST', '/kernels/push', {
    slug: `${c.username}/${KERNEL_SLUG}`,
    newTitle: KERNEL_SLUG,
    text: source,
    language: 'python',
    kernelType: 'script',
    isPrivate: true,
    enableGpu: true,
    enableTpu: false,
    enableInternet: true,
    datasetDataSources: [],
    competitionDataSources: [],
    kernelDataSources: [],
    modelDataSources: [],
    categoryIds: [],
  });
  if (j.error) throw new RemoteError(`Kaggle would not start the notebook: ${String(j.error).slice(0, 200)}`);
  return { ref: j.ref ?? `${c.username}/${KERNEL_SLUG}`, url: j.url ?? `https://www.kaggle.com/code/${c.username}/${KERNEL_SLUG}`, version: j.versionNumber ?? 0 };
}

export type KernelState = 'queued' | 'running' | 'complete' | 'error' | 'cancelled' | 'unknown';

/** How the notebook's latest run is going. */
export async function kernelStatus(f: Fetch, c: KaggleCreds): Promise<{ state: KernelState; message: string }> {
  const q = new URLSearchParams({ userName: c.username, kernelSlug: KERNEL_SLUG });
  const j = await kaggleCall<{ status?: string; failureMessage?: string }>(f, c, 'GET', `/kernels/status?${q}`);
  const s = String(j.status ?? '').toLowerCase();
  const state: KernelState = /queued/.test(s) ? 'queued' : /running/.test(s) ? 'running' : /complete/.test(s) ? 'complete' : /error/.test(s) ? 'error' : /cancel/.test(s) ? 'cancelled' : 'unknown';
  return { state, message: String(j.failureMessage ?? '').slice(0, 300) };
}

/** A light check that the key works (lists one of the owner's notebooks). */
export async function kaggleWorks(f: Fetch, c: KaggleCreds): Promise<void> {
  await kaggleCall(f, c, 'GET', `/kernels/list?${new URLSearchParams({ user: c.username, pageSize: '1' })}`);
}

// ---- Hugging Face -------------------------------------------------------------------------------------------

const HF = 'https://huggingface.co';

async function hfCall(f: Fetch, token: string, method: string, url: string, body?: BodyInit, type = 'application/json'): Promise<Response> {
  const r = await f(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': type } : {}) }, body });
  if (r.status === 401) throw new RemoteError('Hugging Face says the token is not valid.', 401);
  if (r.status === 403) throw new RemoteError('Hugging Face refused: the token needs WRITE access (make a "Write" token).', 403);
  return r;
}

/** Who the token belongs to, and whether it can write. */
export async function hfWhoami(f: Fetch, token: string): Promise<{ name: string; write: boolean }> {
  const r = await hfCall(f, token, 'GET', `${HF}/api/whoami-v2`);
  if (!r.ok) throw new RemoteError(`Hugging Face answered ${r.status}`, r.status);
  const j = (await r.json()) as { name?: string; auth?: { accessToken?: { role?: string; fineGrained?: { scoped?: { permissions?: string[] }[]; global?: string[] } } } };
  const at = j.auth?.accessToken;
  const fine = at?.fineGrained?.scoped?.some((s) => (s.permissions ?? []).some((p) => /repo\.write/.test(p))) ?? false;
  return { name: String(j.name ?? ''), write: at?.role === 'write' || (at?.role === 'fineGrained' && fine) };
}

/** Make the repo if it is not there (409 = already there). */
export async function hfEnsureRepo(f: Fetch, token: string, repo: string, type: 'model' | 'dataset', isPrivate: boolean): Promise<void> {
  const [org, name] = repo.split('/');
  const r = await hfCall(f, token, 'POST', `${HF}/api/repos/create`, JSON.stringify({ type, name, organization: org, private: isPrivate }));
  if (!r.ok && r.status !== 409) throw new RemoteError(`Hugging Face would not make ${repo}: ${(await r.text()).slice(0, 200)}`, r.status);
}

export interface HfFile {
  path: string;
  content: string;
}

const bytesOf = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;
function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * One commit of text files to a repo's main branch. Hugging Face says per file whether it wants it as a plain
 * file or in LFS (preupload); LFS files go up through the Git LFS batch API first. Returns the commit id.
 */
export async function hfCommit(f: Fetch, token: string, repo: string, type: 'model' | 'dataset', files: HfFile[], summary: string): Promise<string> {
  const base = `${HF}/api/${type}s/${repo}`;
  const enc = files.map((x) => ({ ...x, bytes: bytesOf(x.content) }));
  const pre = await hfCall(f, token, 'POST', `${base}/preupload/main`, JSON.stringify({ files: enc.map((x) => ({ path: x.path, size: x.bytes.length, sample: b64(x.bytes.subarray(0, 512)) })) }));
  if (!pre.ok) throw new RemoteError(`Hugging Face preupload failed (${pre.status}): ${(await pre.text()).slice(0, 200)}`, pre.status);
  const modes = new Map(((await pre.json()) as { files?: { path: string; uploadMode: string }[] }).files?.map((x) => [x.path, x.uploadMode]) ?? []);
  const lfs = [];
  for (const x of enc) if (modes.get(x.path) === 'lfs') lfs.push({ ...x, oid: await sha256Hex(x.bytes) });
  if (lfs.length) {
    const gitBase = `${HF}/${type === 'dataset' ? 'datasets/' : ''}${repo}.git/info/lfs/objects/batch`;
    const r = await hfCall(f, token, 'POST', gitBase, JSON.stringify({ operation: 'upload', transfers: ['basic'], objects: lfs.map((x) => ({ oid: x.oid, size: x.bytes.length })), hash_algo: 'sha256' }), 'application/vnd.git-lfs+json');
    if (!r.ok) throw new RemoteError(`Hugging Face LFS refused the upload (${r.status})`, r.status);
    const objs = ((await r.json()) as { objects?: { oid: string; actions?: { upload?: { href: string; header?: Record<string, string> }; verify?: { href: string; header?: Record<string, string> } } }[] }).objects ?? [];
    for (const o of objs) {
      const x = lfs.find((y) => y.oid === o.oid)!;
      const up = o.actions?.upload;
      if (up) {
        const put = await f(up.href, { method: 'PUT', headers: { ...(up.header ?? {}) }, body: x.bytes });
        if (!put.ok) throw new RemoteError(`uploading ${x.path} failed (${put.status})`, put.status);
      }
      const ver = o.actions?.verify;
      if (ver) {
        const v = await f(ver.href, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/vnd.git-lfs+json', ...(ver.header ?? {}) }, body: JSON.stringify({ oid: x.oid, size: x.bytes.length }) });
        if (!v.ok) throw new RemoteError(`Hugging Face could not verify ${x.path} (${v.status})`, v.status);
      }
    }
  }
  const lines = [JSON.stringify({ key: 'header', value: { summary, description: '' } })];
  for (const x of enc) {
    const l = lfs.find((y) => y.path === x.path);
    lines.push(l ? JSON.stringify({ key: 'lfsFile', value: { path: x.path, algo: 'sha256', oid: l.oid, size: x.bytes.length } }) : JSON.stringify({ key: 'file', value: { path: x.path, content: b64(x.bytes), encoding: 'base64' } }));
  }
  const r = await hfCall(f, token, 'POST', `${base}/commit/main`, lines.join('\n'), 'application/x-ndjson');
  if (!r.ok) throw new RemoteError(`Hugging Face would not take the commit (${r.status}): ${(await r.text()).slice(0, 200)}`, r.status);
  const j = (await r.json()) as { commitOid?: string; commitUrl?: string };
  return j.commitOid ?? String(j.commitUrl ?? '').split('/').pop() ?? '';
}

/** A file in the model repo at a commit exists (the phone downloads from there). */
export async function hfHasFile(f: Fetch, repo: string, commit: string, path: string): Promise<boolean> {
  const r = await f(`${HF}/${repo}/resolve/${commit}/${path}`, { method: 'HEAD' });
  return r.ok || (r.status >= 300 && r.status < 400);
}
