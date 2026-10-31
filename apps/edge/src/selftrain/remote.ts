/**
 * The two outside services the weekly training uses, with the owner's own keys (vault names `kaggle` and
 * `hf_write`; keys.ts). Kaggle: pushes the notebook with a GPU and the internet on, and reads how the run is
 * going. Hugging Face: two PRIVATE repos on the owner's account — the dataset `ghosty-training` (the week's
 * data, checkpoints, adapters) and the model `ghosty-offline-brain` (the phone's weights, which the phone
 * fetches only through the brain: weights.ts). Plain fetch; `fetch` is injectable so tests stand in for both.
 * Errors come back as `RemoteError` with a plain message.
 *
 * Kaggle: the RPC API the current `kaggle` CLI uses (kaggle 2.2.4 / kagglesdk 0.1.37; the quota and output calls
 * read from kagglesdk 0.1.38): `POST https://api.kaggle.com/v1/<service>/<method>` with a JSON body in camelCase; a
 * legacy key signs in with HTTP Basic (username:key), a new API token (KGAT_…) as a Bearer token, and its username
 * comes from `security.OAuthService/IntrospectToken` like the CLI's `_introspect_token`. Errors come back as
 * `{code, message}`; durations as protobuf JSON strings ("108000s", "151.500s"), a zero one left out.
 * Hugging Face: whoami-v2, the repo info and settings endpoints, repos/create, the commit endpoint (NDJSON), preupload,
 * the Git LFS batch API, tags, and `resolve/<commit>/<file>`; for the daily GPU (pool.ts) a Space: repos/create with
 * the Gradio SDK on ZeroGPU (`zero-a10g`, the only hardware ever asked for: free, and a free account cannot buy more),
 * its secrets, and its Gradio API (`/gradio_api/call/<name>`: POST, then the event stream with the answer).
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
/** The same notebook in exam mode (a SCHOOL paper sat on the free GPU): its own slug, so it never touches the weekly run. */
export const EXAM_SLUG = 'ghosty-exam';
/** Kaggle's free T4 GPU (the CLI's `--accelerator` value), and the longest a run may take (Kaggle's limit is 12 h). */
export const MACHINE_SHAPE = 'NvidiaTeslaT4';
export const SESSION_TIMEOUT_S = 10 * 3600;

/** Push (and so start) the notebook: private, a GPU, the internet on. Returns the version and its address. */
export async function pushKernel(f: Fetch, c0: KaggleCreds, source: string, o: { slug?: string; timeoutS?: number } = {}): Promise<{ ref: string; url: string; version: number }> {
  const c = await kaggleUser(f, c0);
  const slug = o.slug ?? KERNEL_SLUG;
  const j = await kaggleRpc<{ ref?: string; url?: string; versionNumber?: number; error?: string }>(f, c, 'kernels.KernelsApiService', 'SaveKernel', {
    slug: `${c.username}/${slug}`,
    newTitle: slug,
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
    sessionTimeoutSeconds: o.timeoutS ?? SESSION_TIMEOUT_S,
  });
  if (j.error) throw new RemoteError(`Kaggle would not start the notebook: ${String(j.error).slice(0, 200)}`);
  return { ref: j.ref ?? `${c.username}/${slug}`, url: j.url ?? `https://www.kaggle.com/code/${c.username}/${slug}`, version: j.versionNumber ?? 0 };
}

export type KernelState = 'queued' | 'running' | 'complete' | 'error' | 'cancelled' | 'unknown';

/** How the notebook's latest run is going (Kaggle's KernelWorkerStatus names). */
export async function kernelStatus(f: Fetch, c0: KaggleCreds, slug = KERNEL_SLUG): Promise<{ state: KernelState; message: string }> {
  const c = await kaggleUser(f, c0);
  const j = await kaggleRpc<{ status?: string; failureMessage?: string }>(f, c, 'kernels.KernelsApiService', 'GetKernelSessionStatus', { userName: c.username, kernelSlug: slug });
  const s = String(j.status ?? '').toUpperCase();
  const state: KernelState = s === 'QUEUED' || s === 'NEW_SCRIPT' ? 'queued' : s === 'RUNNING' ? 'running' : s === 'COMPLETE' ? 'complete' : s === 'ERROR' ? 'error' : /CANCEL/.test(s) ? 'cancelled' : 'unknown';
  return { state, message: String(j.failureMessage ?? '').slice(0, 300) };
}

/** A protobuf JSON duration ("108000s", "151.500s"; left out when zero) in hours. */
export function durationHours(v: unknown): number {
  const m = typeof v === 'string' ? v.match(/^(-?\d+(?:\.\d+)?)s$/) : null;
  const s = m ? Number(m[1]) : typeof v === 'number' ? v : 0;
  return Number.isFinite(s) ? s / 3600 : 0;
}

export interface GpuQuota {
  /** Hours Kaggle allows this week (0: the account has no GPU time, e.g. its phone number is not verified). */
  total: number;
  /** Hours left: allowed − used − reserved by sessions running now. */
  left: number;
  /** Pay-to-scale: past the free hours Kaggle would charge. */
  payToScale: boolean;
  /** When the weekly hours come back (ms), if Kaggle said. */
  refreshAt: number | null;
}

/** This week's GPU hours (`kernels.KernelsApiService/GetAcceleratorQuotaStatistics`, the CLI's `kaggle kernels quota`). */
export async function kaggleQuota(f: Fetch, c0: KaggleCreds): Promise<GpuQuota> {
  const c = await kaggleUser(f, c0);
  const j = await kaggleRpc<{ quotaRefreshTime?: string; gpuQuota?: { timeUsed?: string; timeReserved?: string; totalTimeAllowed?: string; isPayToScaleEnabled?: boolean } }>(f, c, 'kernels.KernelsApiService', 'GetAcceleratorQuotaStatistics', {});
  const g = j.gpuQuota ?? {};
  const total = durationHours(g.totalTimeAllowed);
  const refresh = j.quotaRefreshTime ? Date.parse(j.quotaRefreshTime) : NaN;
  return { total, left: Math.max(0, total - durationHours(g.timeUsed) - durationHours(g.timeReserved)), payToScale: g.isPayToScaleEnabled === true, refreshAt: Number.isFinite(refresh) ? refresh : null };
}

/**
 * What the notebook's latest run left behind (`kernels.KernelsApiService/ListKernelSessionOutput`, as the CLI's
 * `kaggle kernels output`): the end of its log, and its saved report (`ghosty_report.json`, fetched from the signed
 * address Kaggle gives, without the Kaggle key). Either may be missing.
 */
export async function kernelOutput(f: Fetch, c0: KaggleCreds, slug = KERNEL_SLUG): Promise<{ logTail: string; report: { error?: unknown; install?: unknown } | null }> {
  const c = await kaggleUser(f, c0);
  const j = await kaggleRpc<{ files?: { url?: string; fileName?: string }[]; log?: string }>(f, c, 'kernels.KernelsApiService', 'ListKernelSessionOutput', { userName: c.username, kernelSlug: slug });
  let report: { error?: unknown; install?: unknown } | null = null;
  const file = (j.files ?? []).find((x) => x.fileName === 'ghosty_report.json' && /^https:\/\//.test(String(x.url)));
  if (file) {
    try {
      const r = await f(String(file.url));
      const text = r.ok ? await r.text() : '';
      if (text.length < 4_000_000) report = JSON.parse(text) as { error?: unknown; install?: unknown };
    } catch {
      report = null;
    }
  }
  return { logTail: logTail(String(j.log ?? '')), report: report && typeof report === 'object' ? report : null };
}

/** The last lines of a Kaggle run's log (its JSON list of {stream_name, data}, or plain text), at most `n` characters. */
export function logTail(log: string, n = 300): string {
  let text = log;
  try {
    const items = JSON.parse(log) as { data?: unknown }[];
    if (Array.isArray(items)) text = items.map((x) => String(x?.data ?? '')).join('');
  } catch {
    /* plain text */
  }
  const lines = text.split('\n').map((l) => l.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()).filter(Boolean);
  let out = '';
  for (let i = lines.length - 1; i >= 0 && out.length < n; i--) out = out ? `${lines[i]} / ${out}` : lines[i]!;
  // A Hugging Face token never shows, wherever it came from.
  return (out.length > n ? `…${out.slice(-n)}` : out).replace(/hf_[A-Za-z0-9]{8,}/g, 'hf_…');
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
  /** The account is PRO (it could pay for GPU time past the free minutes), and whether it can pay (a card on file); absent when Hugging Face did not say. */
  isPro?: boolean;
  canPay?: boolean;
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
  const j = (await r.json()) as { name?: string; isPro?: unknown; canPay?: unknown; auth?: { accessToken?: { role?: string; fineGrained?: { scoped?: FineScope[]; global?: string[] } } } };
  const name = String(j.name ?? '');
  const at = j.auth?.accessToken;
  const role = String(at?.role ?? 'read');
  const scoped = at?.fineGrained?.scoped ?? [];
  const writes = (s: FineScope) => (s.permissions ?? []).some((p) => /^repo\.(write|content\.write)$/.test(p));
  const userWide = scoped.some((s) => s.entity?.type === 'user' && s.entity.name === name && writes(s));
  return {
    name,
    role,
    ...(typeof j.isPro === 'boolean' ? { isPro: j.isPro } : {}),
    ...(typeof j.canPay === 'boolean' ? { canPay: j.canPay } : {}),
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
  /** Worked out ahead (build.mjs does it for the 535 KB tasks.mjs): the bytes' base64, size and SHA-256, so the brain spends no CPU on them. */
  pre?: { b64: string; size: number; sha256: string };
}

const bytesOf = (s: string): Uint8Array<ArrayBuffer> => new TextEncoder().encode(s) as Uint8Array<ArrayBuffer>;
function b64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
/** The base64 of the first 512 bytes, from a whole file's base64 (684 characters hold bytes 0–512). */
const b64Head = (whole: string): string => btoa(atob(whole.slice(0, 684)).slice(0, 512));
async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...d].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const LFS = 'application/vnd.git-lfs+json';

/**
 * One commit of text files to a repo's main branch. Hugging Face says per file whether it wants it as a plain
 * file or in LFS (preupload); LFS files go up through the Git LFS batch API first. Returns the commit id.
 */
export async function hfCommit(f: Fetch, token: string, repo: string, type: 'model' | 'dataset' | 'space', files: HfFile[], summary: string): Promise<string> {
  const base = `${HF}/api/${type}s/${repo}`;
  // A file worked out ahead (x.pre) is never encoded here; the others are, once.
  const enc = files.map((x) => {
    const bytes = x.pre ? null : bytesOf(x.content);
    return { ...x, size: x.pre?.size ?? bytes!.length, bytes: () => bytes ?? bytesOf(x.content), b64: () => x.pre?.b64 ?? b64(bytes!), sample: x.pre ? b64Head(x.pre.b64) : b64(bytes!.subarray(0, 512)) };
  });
  const pre = await hfCall(f, token, 'POST', `${base}/preupload/main`, JSON.stringify({ files: enc.map((x) => ({ path: x.path, size: x.size, sample: x.sample })) }));
  if (!pre.ok) throw new RemoteError(`Hugging Face preupload failed (${pre.status}): ${(await pre.text()).slice(0, 200)}`, pre.status);
  const modes = new Map(((await pre.json()) as { files?: { path: string; uploadMode: string }[] }).files?.map((x) => [x.path, x.uploadMode]) ?? []);
  const lfs = [];
  for (const x of enc) if (modes.get(x.path) === 'lfs') lfs.push({ ...x, oid: x.pre?.sha256 ?? (await sha256Hex(x.bytes())) });
  if (lfs.length) {
    const gitBase = `${HF}/${type === 'dataset' ? 'datasets/' : type === 'space' ? 'spaces/' : ''}${repo}.git/info/lfs/objects/batch`;
    const r = await hfCall(f, token, 'POST', gitBase, JSON.stringify({ operation: 'upload', transfers: ['basic'], objects: lfs.map((x) => ({ oid: x.oid, size: x.size })), hash_algo: 'sha256', ref: { name: 'main' } }), LFS, { Accept: LFS });
    if (!r.ok) throw new RemoteError(`Hugging Face LFS refused the upload (${r.status})`, r.status);
    const objs = ((await r.json()) as { objects?: { oid: string; actions?: { upload?: { href: string; header?: Record<string, string> }; verify?: { href: string; header?: Record<string, string> } } }[] }).objects ?? [];
    for (const o of objs) {
      const x = lfs.find((y) => y.oid === o.oid)!;
      const up = o.actions?.upload;
      if (up) {
        const put = await f(up.href, { method: 'PUT', headers: { ...(up.header ?? {}) }, body: x.bytes() });
        if (!put.ok) throw new RemoteError(`uploading ${x.path} failed (${put.status})`, put.status);
      }
      const ver = o.actions?.verify;
      if (ver) {
        const v = await f(ver.href, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': LFS, Accept: LFS, ...(ver.header ?? {}) }, body: JSON.stringify({ oid: x.oid, size: x.size }) });
        if (!v.ok) throw new RemoteError(`Hugging Face could not verify ${x.path} (${v.status})`, v.status);
      }
    }
  }
  const lines = [JSON.stringify({ key: 'header', value: { summary, description: '' } })];
  for (const x of enc) {
    const l = lfs.find((y) => y.path === x.path);
    lines.push(l ? JSON.stringify({ key: 'lfsFile', value: { path: x.path, algo: 'sha256', oid: l.oid, size: x.size } }) : JSON.stringify({ key: 'file', value: { path: x.path, content: x.b64(), encoding: 'base64' } }));
  }
  const r = await hfCall(f, token, 'POST', `${base}/commit/main`, lines.join('\n'), 'application/x-ndjson');
  if (!r.ok) throw new RemoteError(`Hugging Face would not take the commit (${r.status}): ${(await r.text()).slice(0, 200)}`, r.status);
  const j = (await r.json()) as { commitOid?: string; commitUrl?: string };
  return j.commitOid ?? String(j.commitUrl ?? '').split('/').pop() ?? '';
}

/** Whether a file is on a repo's main branch (a HEAD of its address; redirects not followed). */
export async function hfHasFile(f: Fetch, token: string, repo: string, type: 'model' | 'dataset', path: string): Promise<boolean> {
  const r = await f(`${HF}/${type === 'dataset' ? 'datasets/' : ''}${repo}/resolve/main/${path}`, { method: 'HEAD', redirect: 'manual', headers: { Authorization: `Bearer ${token}` } });
  return r.status === 200 || (r.status >= 300 && r.status < 400);
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

// ---- Hugging Face Spaces: the daily GPU (pool.ts) --------------------------------------------------------------

/** The only hardware a Space of Ghosty's is ever put on: ZeroGPU, free (a free account gets its daily minutes and cannot buy more). */
export const ZERO_GPU = 'zero-a10g';

/** Where a Space's app answers: `https://<owner>-<name>.hf.space` (lower case, `_` and `.` as `-`). */
export const spaceHost = (repo: string): string => `https://${repo.toLowerCase().replace(/[/_.]/g, '-')}.hf.space`;

/**
 * A Gradio Space on ZeroGPU under the owner's name: private when Hugging Face lets a free account have one (else public,
 * which the caller is told: the Space then holds no data of his, and answers only with its key). An existing one is kept
 * as it is. Returns whether it is private.
 */
export async function hfCreateSpace(f: Fetch, token: string, repo: string): Promise<{ private: boolean; existed: boolean }> {
  const [org, name] = repo.split('/');
  const create = (priv: boolean) => hfCall(f, token, 'POST', `${HF}/api/repos/create`, JSON.stringify({ type: 'space', name, organization: org, private: priv, sdk: 'gradio', hardware: ZERO_GPU }));
  let r = await create(true);
  let priv = true;
  if (!r.ok && r.status !== 409) {
    const why = await r.text();
    if (!/private/i.test(why)) throw new RemoteError(`Hugging Face would not make the Space ${repo}: ${why.slice(0, 200)}`, r.status);
    r = await create(false);
    priv = false;
    if (!r.ok && r.status !== 409) throw new RemoteError(`Hugging Face would not make the Space ${repo}: ${(await r.text()).slice(0, 200)}`, r.status);
  }
  const existed = r.status === 409;
  // (an existing Space keeps its privacy; asked, to say it truly)
  const info = await hfCall(f, token, 'GET', `${HF}/api/spaces/${repo}`);
  if (info.ok) priv = ((await info.json()) as { private?: boolean }).private === true;
  // On the free GPU (asked again: Hugging Face may have ignored it at creation); never any other hardware.
  const hw = await hfCall(f, token, 'POST', `${HF}/api/spaces/${repo}/hardware`, JSON.stringify({ flavor: ZERO_GPU }));
  if (!hw.ok) throw new RemoteError(`Hugging Face would not put ${repo} on its free daily GPU (ZeroGPU needs an account older than 30 days with its email verified): ${(await hw.text()).slice(0, 160)}`, hw.status);
  return { private: priv, existed };
}

/** A secret of the Space (its code reads it; nobody else can). */
export async function hfSpaceSecret(f: Fetch, token: string, repo: string, key: string, value: string): Promise<void> {
  const r = await hfCall(f, token, 'POST', `${HF}/api/spaces/${repo}/secrets`, JSON.stringify({ key, value, description: 'set by Ghosty' }));
  if (!r.ok) throw new RemoteError(`Hugging Face would not keep the Space's ${key} (${r.status})`, r.status);
}

/**
 * One call of a Gradio app's API: POST the arguments (one JSON string), then read the event stream to its end; the
 * answer is the app's JSON string, parsed. An `error` event, or an answer that is `{error}`, comes back as RemoteError
 * (ZeroGPU says so when the day's minutes are used up: `quota` is then true).
 */
export async function gradioCall(f: Fetch, token: string, host: string, fn: string, args: unknown): Promise<Record<string, unknown>> {
  const auth = { Authorization: `Bearer ${token}` };
  const r = await f(`${host}/gradio_api/call/${fn}`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ data: [JSON.stringify(args)] }) });
  if (r.status === 401 || r.status === 403) throw new RemoteError('the daily GPU would not let Ghosty in (the Hugging Face token was refused)', r.status);
  if (!r.ok) throw new RemoteError(`the daily GPU is not answering (${r.status}${r.status === 404 || r.status === 503 ? ': it may be asleep or still being built' : ''})`, r.status);
  const id = ((await r.json().catch(() => ({}))) as { event_id?: string }).event_id;
  if (!id) throw new RemoteError('the daily GPU did not take the call');
  const s = await f(`${host}/gradio_api/call/${fn}/${encodeURIComponent(id)}`, { headers: auth });
  const text = s.ok ? await s.text() : '';
  let last: { event: string; data: string } | null = null;
  for (const block of text.split(/\r?\n\r?\n/)) {
    const event = /^event:\s*(.*)$/m.exec(block)?.[1]?.trim();
    const data = /^data:\s*(.*)$/m.exec(block)?.[1] ?? '';
    if (event === 'complete' || event === 'error') last = { event, data };
  }
  if (!last) throw new RemoteError(`the daily GPU sent no answer${s.ok ? '' : ` (${s.status})`}`, s.status);
  if (last.event === 'error') {
    const why = String(last.data).replace(/^"|"$/g, '').slice(0, 200);
    throw Object.assign(new RemoteError(`the daily GPU stopped: ${why || 'no reason given'}`), { quota: /quota|GPU (time|minutes)/i.test(why) });
  }
  let out: Record<string, unknown>;
  try {
    out = JSON.parse(String((JSON.parse(last.data) as unknown[])[0])) as Record<string, unknown>;
  } catch {
    throw new RemoteError('the daily GPU sent something that is not its answer');
  }
  if (typeof out?.error === 'string') throw new RemoteError(`the daily GPU said: ${out.error.slice(0, 200)}`);
  return out;
}
