/**
 * The two outside services the weekly training uses, with the owner's own keys (vault names `kaggle` and
 * `hf_write`; keys.ts). Kaggle: pushes the notebook with a GPU and the internet on, and reads how the run is
 * going. Hugging Face: two PRIVATE repos on the owner's account — the dataset `ghosty-training` (the week's
 * data, checkpoints, adapters) and the model `ghosty-offline-brain` (the phone's weights, which the phone
 * fetches only through the brain: weights.ts). Plain fetch; `fetch` is injectable so tests stand in for both.
 * Errors come back as `RemoteError` with a plain message.
 *
 * Kaggle: the RPC API the current `kaggle` CLI uses (kaggle 2.2.4 / kagglesdk 0.1.37): `POST
 * https://api.kaggle.com/v1/<service>/<method>` with a JSON body in camelCase; a legacy key signs in with HTTP
 * Basic (username:key), a new API token (KGAT_…) as a Bearer token, and its username comes from
 * `security.OAuthService/IntrospectToken` like the CLI's `_introspect_token`. Errors come back as `{code, message}`.
 * Hugging Face: whoami-v2, the repo info and settings endpoints, repos/create, the commit endpoint (NDJSON), preupload,
 * the Git LFS batch API, tags, and `resolve/<commit>/<file>`.
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
  /** Empty for a bare KGAT_ token until `kaggleUser` has asked Kaggle whose it is. */
  username: string;
  /** A legacy API key (Basic) or a new API token (KGAT_…, Bearer). */
  key: string;
}

/** The kaggle key as pasted: a bare KGAT_ token, the kaggle.json text, "username key", or "username KGAT_token". */
export function parseKaggleKey(value: string): KaggleCreds | null {
  const v = value.trim();
  if (/^KGAT_[A-Za-z0-9_-]{8,}$/.test(v)) return { username: '', key: v };
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

export const KAGGLE_API = 'https://api.kaggle.com/v1';
const isToken = (c: KaggleCreds) => c.key.startsWith('KGAT_');
const kaggleAuth = (c: KaggleCreds) => (isToken(c) ? `Bearer ${c.key}` : `Basic ${btoa(`${c.username}:${c.key}`)}`);

async function kaggleRpc<T>(f: Fetch, c: KaggleCreds, service: string, method: string, body: unknown): Promise<T> {
  const r = await f(`${KAGGLE_API}/${service}/${method}`, {
    method: 'POST',
    headers: { Authorization: kaggleAuth(c), 'content-type': 'application/json', 'user-agent': 'ghosty-selftrain (kaggle-api compatible)' },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j: (T & { code?: number; message?: string }) | null = null;
  try {
    j = JSON.parse(text || '{}');
  } catch {
    /* not JSON: judged by the status below */
  }
  const code = typeof j?.code === 'number' ? j.code : r.status;
  if (code === 401 || code === 403) throw new RemoteError('Kaggle says the key is not valid (or the account has not confirmed its phone number, which GPUs need).', code);
  if (code >= 400 || !r.ok) throw new RemoteError(`Kaggle answered ${code}: ${String(j?.message ?? text).slice(0, 200)}`, code);
  if (!j) throw new RemoteError(`Kaggle sent something that is not JSON (${r.status})`, r.status);
  return j;
}

/** The username a key belongs to: as pasted, or asked of Kaggle for a bare KGAT_ token. */
export async function kaggleUser(f: Fetch, c: KaggleCreds): Promise<KaggleCreds> {
  if (c.username) return c;
  const j = await kaggleRpc<{ active?: boolean; username?: string }>(f, c, 'security.OAuthService', 'IntrospectToken', { token: c.key });
  if (!j.active || !j.username) throw new RemoteError('Kaggle says this API token is not active: make a new one (kaggle.com → Settings → API Tokens).', 401);
  return { username: j.username, key: c.key };
}

/** The notebook's slug on the owner's account. */
export const KERNEL_SLUG = 'ghosty-weekly-training';
/** Kaggle's free T4 GPU (the CLI's `--accelerator` value), and the longest a run may take (Kaggle's limit is 12 h). */
export const MACHINE_SHAPE = 'NvidiaTeslaT4';
export const SESSION_TIMEOUT_S = 10 * 3600;

/** Push (and so start) the notebook: private, a GPU, the internet on. Returns the version and its address. */
export async function pushKernel(f: Fetch, c0: KaggleCreds, source: string): Promise<{ ref: string; url: string; version: number }> {
  const c = await kaggleUser(f, c0);
  const j = await kaggleRpc<{ ref?: string; url?: string; versionNumber?: number; error?: string }>(f, c, 'kernels.KernelsApiService', 'SaveKernel', {
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
    machineShape: MACHINE_SHAPE,
    sessionTimeoutSeconds: SESSION_TIMEOUT_S,
  });
  if (j.error) throw new RemoteError(`Kaggle would not start the notebook: ${String(j.error).slice(0, 200)}`);
  return { ref: j.ref ?? `${c.username}/${KERNEL_SLUG}`, url: j.url ?? `https://www.kaggle.com/code/${c.username}/${KERNEL_SLUG}`, version: j.versionNumber ?? 0 };
}

export type KernelState = 'queued' | 'running' | 'complete' | 'error' | 'cancelled' | 'unknown';

/** How the notebook's latest run is going (Kaggle's KernelWorkerStatus names). */
export async function kernelStatus(f: Fetch, c0: KaggleCreds): Promise<{ state: KernelState; message: string }> {
  const c = await kaggleUser(f, c0);
  const j = await kaggleRpc<{ status?: string; failureMessage?: string }>(f, c, 'kernels.KernelsApiService', 'GetKernelSessionStatus', { userName: c.username, kernelSlug: KERNEL_SLUG });
  const s = String(j.status ?? '').toUpperCase();
  const state: KernelState = s === 'QUEUED' || s === 'NEW_SCRIPT' ? 'queued' : s === 'RUNNING' ? 'running' : s === 'COMPLETE' ? 'complete' : s === 'ERROR' ? 'error' : /CANCEL/.test(s) ? 'cancelled' : 'unknown';
  return { state, message: String(j.failureMessage ?? '').slice(0, 300) };
}

/** A light check that the key works (lists one of the owner's notebooks); returns the username. */
export async function kaggleWorks(f: Fetch, c0: KaggleCreds): Promise<string> {
  const c = await kaggleUser(f, c0);
  await kaggleRpc(f, c, 'kernels.KernelsApiService', 'ListKernels', { user: c.username, pageSize: 1 });
  return c.username;
}

// ---- Hugging Face -------------------------------------------------------------------------------------------

const HF = 'https://huggingface.co';

async function hfCall(f: Fetch, token: string, method: string, url: string, body?: BodyInit, type = 'application/json', extra: Record<string, string> = {}): Promise<Response> {
  const r = await f(url, { method, headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'content-type': type } : {}), ...extra }, body });
  if (r.status === 401) throw new RemoteError('Hugging Face says the token is not valid.', 401);
  return r;
}

export interface HfMe {
  name: string;
  /** 'write' (a classic write token), 'fineGrained', or 'read'. */
  role: string;
  /** May create new repos under the owner's name. */
  canCreate: boolean;
  /** May write to this repo ("owner/name"). */
  canWrite: (repo: string) => boolean;
}

interface FineScope {
  entity?: { type?: string; name?: string };
  permissions?: string[];
}

/** Who the token belongs to and what it may do (classic write tokens may do everything; fine-grained ones what they were given). */
export async function hfWhoami(f: Fetch, token: string): Promise<HfMe> {
  const r = await hfCall(f, token, 'GET', `${HF}/api/whoami-v2`);
  if (!r.ok) throw new RemoteError(`Hugging Face answered ${r.status}`, r.status);
  const j = (await r.json()) as { name?: string; auth?: { accessToken?: { role?: string; fineGrained?: { scoped?: FineScope[]; global?: string[] } } } };
  const name = String(j.name ?? '');
  const at = j.auth?.accessToken;
  const role = String(at?.role ?? 'read');
  const scoped = at?.fineGrained?.scoped ?? [];
  const writes = (s: FineScope) => (s.permissions ?? []).some((p) => /^repo\.(write|content\.write)$/.test(p));
  const userWide = scoped.some((s) => s.entity?.type === 'user' && s.entity.name === name && writes(s));
  return {
    name,
    role,
    canCreate: role === 'write' || (role === 'fineGrained' && userWide),
    canWrite: (repo) => role === 'write' || (role === 'fineGrained' && (userWide || scoped.some((s) => s.entity?.name === repo && writes(s)))),
  };
}

/** Whether a repo exists and is private (null: not there, or not visible to this token). */
export async function hfRepoInfo(f: Fetch, token: string, repo: string, type: 'model' | 'dataset'): Promise<{ private: boolean } | null> {
  const r = await hfCall(f, token, 'GET', `${HF}/api/${type}s/${repo}`);
  if (r.status === 404 || r.status === 403) return null;
  if (!r.ok) throw new RemoteError(`Hugging Face answered ${r.status} about ${repo}`, r.status);
  const j = (await r.json()) as { private?: boolean };
  return { private: j.private === true };
}

/**
 * The repo, private: made if it is not there (when the token may), made private if it is public (or refused,
 * with the fix in words). The owner's data never goes into a public repo.
 */
export async function hfEnsurePrivateRepo(f: Fetch, me: HfMe, token: string, repo: string, type: 'model' | 'dataset'): Promise<void> {
  const kind = type === 'dataset' ? 'dataset' : 'model';
  let info = await hfRepoInfo(f, token, repo, type);
  if (!info) {
    if (!me.canCreate) throw new RemoteError(`the Hugging Face token cannot make the ${kind} "${repo}": make it yourself as a PRIVATE ${kind} (steps in SYSTEM → KEYS) and give the token write access to it.`, 403);
    const [org, name] = repo.split('/');
    const r = await hfCall(f, token, 'POST', `${HF}/api/repos/create`, JSON.stringify({ type, name, organization: org, private: true }));
    if (!r.ok && r.status !== 409) throw new RemoteError(`Hugging Face would not make ${repo}: ${(await r.text()).slice(0, 200)}`, r.status);
    info = await hfRepoInfo(f, token, repo, type);
    if (!info) throw new RemoteError(`Hugging Face made ${repo} but the token cannot see it.`);
  }
  if (!me.canWrite(repo)) throw new RemoteError(`the Hugging Face token may not write to "${repo}": give it write access to that ${kind}.`, 403);
  if (!info.private) {
    const r = await hfCall(f, token, 'PUT', `${HF}/api/${type}s/${repo}/settings`, JSON.stringify({ private: true }));
    if (!r.ok || !(await hfRepoInfo(f, token, repo, type))?.private) throw new RemoteError(`"${repo}" on Hugging Face is PUBLIC and could not be made private: open it on huggingface.co → Settings → make it Private, then press TRAIN NOW. Nothing was uploaded.`, r.status);
  }
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

const LFS = 'application/vnd.git-lfs+json';

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
    const r = await hfCall(f, token, 'POST', gitBase, JSON.stringify({ operation: 'upload', transfers: ['basic'], objects: lfs.map((x) => ({ oid: x.oid, size: x.bytes.length })), hash_algo: 'sha256', ref: { name: 'main' } }), LFS, { Accept: LFS });
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
        const v = await f(ver.href, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': LFS, Accept: LFS, ...(ver.header ?? {}) }, body: JSON.stringify({ oid: x.oid, size: x.bytes.length }) });
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

/** Mark a commit of the model repo as a promoted week (a tag; the brain serves only commits it promoted). */
export async function hfTag(f: Fetch, token: string, repo: string, commit: string, tag: string): Promise<void> {
  const r = await hfCall(f, token, 'POST', `${HF}/api/models/${repo}/tag/${commit}`, JSON.stringify({ tag, message: `Ghosty: ${tag} passed its exam` }));
  if (!r.ok && r.status !== 409) throw new RemoteError(`Hugging Face would not tag ${commit.slice(0, 7)} (${r.status})`, r.status);
}

/** One file of the private model repo at a commit, asked with the owner's token; redirects are NOT followed (weights.ts decides). */
export function hfResolve(f: Fetch, token: string, repo: string, commit: string, path: string, method: 'GET' | 'HEAD' = 'GET', range?: string | null): Promise<Response> {
  return f(`${HF}/${repo}/resolve/${commit}/${path}`, { method, redirect: 'manual', headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) } });
}
