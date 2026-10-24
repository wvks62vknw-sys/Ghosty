/**
 * A small client for public Gradio apps (Hugging Face Spaces), asked the way their own web page
 * asks them — there is no key to sign up for. The protocol (Gradio 4–6, "sse_v3"):
 *   GET  <root>/config                        the app: its functions (`dependencies`, each with an
 *                                             `api_name`, an `id` = fn_index and the click that
 *                                             triggers it) and, from Gradio 5, `api_prefix`
 *                                             ("/gradio_api") in front of every route below
 *   POST <base>/upload                        multipart `files` → ["/tmp/gradio/…/name.png"]
 *   POST <base>/queue/join                    {data, fn_index, trigger_id, session_hash, event_data}
 *                                             → {event_id}
 *   GET  <base>/queue/data?session_hash=…     an event stream of `data: {...}` lines: estimation
 *                                             (rank, queue_size, rank_eta), process_starts,
 *                                             progress, log, heartbeat, process_completed
 *                                             (success, output.data or output.error), close_stream
 *   GET  <base>/file=<path>                   a file the app made
 * State components stay on the Space, keyed by the session hash: calls that hand state from one
 * step to the next (a background cut-out, then the model) use the same session hash.
 */
import { imageId } from './lens';

/** A refusal or failure with the status the route answers with, in words for the owner. */
export class Model3dError extends Error {
  constructor(
    public status: number,
    message: string,
    /** 'busy' (try again soon), 'quota' (used up for today), 'no_picture' (nothing here can draw one). */
    public code: 'busy' | 'quota' | 'no_picture' | 'failed' = 'failed',
  ) {
    super(message);
  }
}

/** One message from a Gradio queue stream (`data: {...}` lines). */
export interface GradioEvent {
  msg: string;
  event_id?: string | null;
  rank?: number;
  queue_size?: number;
  rank_eta?: number;
  eta?: number;
  /** A note from the Space while it works ("Waiting for a GPU to become available"). */
  log?: string;
  progress_data?: { index?: number; length?: number | null; unit?: string; desc?: string | null }[] | null;
  success?: boolean;
  output?: { data?: unknown[]; error?: string | null; title?: string | null };
  /** An unexpected_error's own words. */
  message?: string | null;
}

/** Every `data:` message in an event-stream text (a partial last line is left out). */
export function parseSse(text: string): GradioEvent[] {
  const out: GradioEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    try {
      const v = JSON.parse(line.slice(5).trim()) as unknown;
      if (v && typeof v === 'object' && typeof (v as GradioEvent).msg === 'string') out.push(v as GradioEvent);
    } catch {
      // a line cut in half, or not JSON: skip it
    }
  }
  return out;
}

/** A Gradio app's function by its API name: its index and the click that triggers it (from /config). */
export function findFn(config: unknown, apiName: string): { fnIndex: number; triggerId: number | null } | null {
  const deps = (config as { dependencies?: unknown })?.dependencies;
  if (!Array.isArray(deps)) return null;
  for (let i = 0; i < deps.length; i++) {
    const d = deps[i] as { id?: unknown; api_name?: unknown; targets?: unknown };
    if (d?.api_name !== apiName) continue;
    const t = Array.isArray(d.targets) && Array.isArray(d.targets[0]) ? d.targets[0][0] : null;
    return { fnIndex: typeof d.id === 'number' ? d.id : i, triggerId: typeof t === 'number' ? t : null };
  }
  return null;
}

/**
 * The first file in a Gradio answer (a FileData, or an update wrapping one), as an address on the
 * Space; `ext` keeps to files of that kind (".glb").
 */
export function fileFrom(data: unknown, root: string, ext = ''): string | null {
  if (!Array.isArray(data)) return null;
  for (const v of data) {
    const f = (v && typeof v === 'object' && 'value' in v ? (v as { value: unknown }).value : v) as { url?: unknown; path?: unknown } | null;
    if (!f || typeof f !== 'object') continue;
    const name = typeof f.path === 'string' ? f.path : typeof f.url === 'string' ? f.url : '';
    if (ext && !name.toLowerCase().split('?')[0]!.endsWith(ext)) continue;
    if (typeof f.url === 'string' && f.url.startsWith(`${root}/`)) return f.url;
    if (typeof f.path === 'string' && f.path) return `${root}/file=${f.path}`;
  }
  return null;
}

/** "Try again in 13:46:29" → "about 13 h 46 min"; null when the message names no time. */
export function retryIn(message: string): string | null {
  const m = message.match(/try again in (\d+):(\d{2}):(\d{2})/i);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  // "0:00:00" is what the runs-a-day cap says (it has no clock of its own): no time to name.
  if (!h && !min) return null;
  return `about ${h ? `${h} h ` : ''}${min} min`.replace(/ 0 min$/, '');
}

/** The owner-facing reason a queue run failed. */
export function failureText(ev: GradioEvent | null, hasToken: boolean): { status: number; text: string; code: Model3dError['code'] } {
  const raw = String(ev?.output?.error ?? ev?.message ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const title = String(ev?.output?.title ?? '');
  if (ev?.msg === 'queue_full') return { status: 503, text: 'the free 3-D model maker is full right now — try again in a few minutes', code: 'busy' };
  if (/quota|runn+ing out of daily/i.test(`${title} ${raw}`)) {
    const when = retryIn(raw);
    const tip = hasToken
      ? ''
      : ' Without a Hugging Face account it allows only about 2–3 models a day, shared with everyone on the same network; a free Hugging Face token (SYSTEM → KEYS → Hugging Face) gives Ghosty its own daily allowance.';
    return { status: 429, text: `the free 3-D model maker (Hugging Face ZeroGPU) has used up today's GPU allowance${when ? ` — try again in ${when}` : ' — try again later today or tomorrow'}.${tip}`, code: 'quota' };
  }
  if (raw) return { status: 502, text: `the 3-D model maker could not do it: ${raw.slice(0, 200)}`, code: 'failed' };
  return { status: 502, text: 'the 3-D model maker failed on this picture without saying why — try a clear photo of one object on a plain background, or again in a few minutes', code: 'failed' };
}

/** Read a queue stream until its function finishes; reports place in the queue on the way. */
export async function readQueue(res: Response, progress: (l: string) => void, what: string): Promise<GradioEvent> {
  if (!res.ok || !res.body) throw new Model3dError(502, `the 3-D model maker did not answer (${res.status})`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  let last: GradioEvent | null = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (value) buf += value;
      // Whole messages only: everything up to the last blank line.
      const cut = buf.lastIndexOf('\n\n');
      if (cut >= 0) {
        for (const ev of parseSse(buf.slice(0, cut))) {
          last = ev;
          if (ev.msg === 'estimation' && typeof ev.rank === 'number') progress(ev.rank > 0 ? `${what}: number ${ev.rank + 1} in the queue…` : `${what}: next in the queue…`);
          else if (ev.msg === 'process_starts') progress(`${what}…`);
          // The Space's own notes ("Waiting for a GPU to become available").
          else if (ev.msg === 'log' && typeof ev.log === 'string') progress(`${what}: ${ev.log.slice(0, 80)}`);
          else if (ev.msg === 'progress' && Array.isArray(ev.progress_data) && ev.progress_data[0]) {
            const p = ev.progress_data[0];
            if (typeof p.index === 'number' && typeof p.length === 'number' && p.length > 0) progress(`${what}: ${Math.min(100, Math.round(((p.index + 1) / p.length) * 100))}%`);
          } else if (ev.msg === 'process_completed' || ev.msg === 'queue_full' || ev.msg === 'unexpected_error') return ev;
        }
        buf = buf.slice(cut + 2);
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
  for (const ev of parseSse(buf)) last = ev;
  if (last && (last.msg === 'process_completed' || last.msg === 'queue_full')) return last;
  throw new Model3dError(502, 'the 3-D model maker stopped answering before the model was ready — try again in a few minutes', 'busy');
}

/** The largest model kept (KV takes 25 MiB a value; a lightened model is far smaller). */
export const MAX_MODEL_BYTES = 20_000_000;

/** A binary glTF starts with "glTF" and version 2. */
export function isGlb(b: ArrayBuffer): boolean {
  const v = new DataView(b);
  return b.byteLength > 20 && v.getUint32(0, true) === 0x46546c67 && v.getUint32(4, true) === 2;
}

export const sessionHash = () => imageId().replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 11) || 'ghosty';

export interface GradioDeps {
  fetch: typeof fetch;
  /** A Hugging Face token (optional): the owner's own allowance. Never logged or returned. */
  token?: string | null;
  progress?: (label: string) => void;
  signal: AbortSignal;
}

/** A file already on the Space, as a Gradio function takes it. */
export const fileData = (path: string) => ({ path, meta: { _type: 'gradio.FileData' } });

/** One Space: open it (its /config), then upload and call its functions by API name. */
export class GradioApp {
  base: string;
  config: unknown = null;
  /** One session for every call, so state handed between steps stays on the Space. */
  readonly session = sessionHash();

  constructor(
    readonly root: string,
    private d: GradioDeps,
    /** How the owner hears of it: "the free 3-D model maker (Stable Fast 3D)". */
    readonly label: string,
  ) {
    this.base = root;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { ...(this.d.token ? { Authorization: `Bearer ${this.d.token}` } : {}), ...extra };
  }

  get(url: string): Promise<Response> {
    // Called bare, never as deps.fetch(…): the Workers runtime refuses a fetch bound to another object.
    const f = this.d.fetch;
    return f(url, { headers: this.headers(), signal: this.d.signal });
  }

  private post(url: string, body: BodyInit, headers: Record<string, string> = {}): Promise<Response> {
    const f = this.d.fetch;
    return f(url, { method: 'POST', headers: this.headers(headers), body, signal: this.d.signal });
  }

  /** Read the app; throws in words when it is asleep or has changed. */
  async open(needs: string[]): Promise<void> {
    // Never billed: the token goes to a ZeroGPU Space only from a free account that cannot pay.
    if (this.d.token) {
      const t = await spaceToken(this.d.token, this.d.fetch);
      if (!t.token) {
        this.d = { ...this.d, token: null };
        this.d.progress?.(t.why);
      }
    }
    const r = await this.get(`${this.root}/config`);
    const asleep = () => new Model3dError(503, `${this.label} is not running right now (${r.status}) — it sleeps when nobody uses it; try again in a few minutes`, 'busy');
    if (!r.ok) throw asleep();
    // A Space that is asleep or waking answers 206 with Hugging Face's "Preparing Space" page, not its config.
    this.config = await r.json().catch(() => {
      throw asleep();
    });
    const prefix = (this.config as { api_prefix?: unknown })?.api_prefix;
    this.base = this.root + (typeof prefix === 'string' && /^\/[\w/-]*$/.test(prefix) ? prefix.replace(/\/$/, '') : '');
    for (const n of needs) if (!findFn(this.config, n)) throw new Model3dError(502, `${this.label} has changed and no longer offers "${n}"`);
  }

  async upload(bytes: ArrayBuffer, type: string, name: string): Promise<string> {
    const form = new FormData();
    form.append('files', new Blob([bytes], { type }), name);
    const up = await this.post(`${this.base}/upload`, form);
    if (!up.ok) throw new Model3dError(502, `${this.label} would not take the picture (${up.status})`);
    const paths = (await up.json()) as unknown;
    const path = Array.isArray(paths) && typeof paths[0] === 'string' ? paths[0] : null;
    if (!path) throw new Model3dError(502, `${this.label} did not keep the picture`);
    return path;
  }

  /** Call a function and wait for it; a failed run throws its reason in words. */
  async call(apiName: string, data: unknown[], what: string): Promise<unknown[]> {
    const fn = findFn(this.config, apiName);
    if (!fn) throw new Model3dError(502, `${this.label} has changed and no longer offers "${apiName}"`);
    const j = await this.post(`${this.base}/queue/join`, JSON.stringify({ data, fn_index: fn.fnIndex, trigger_id: fn.triggerId, session_hash: this.session, event_data: null }), { 'content-type': 'application/json' });
    if (j.status === 429) throw new Model3dError(429, `${this.label} is turning visitors away right now — try again in a few minutes`, 'busy');
    if (!j.ok) throw new Model3dError(502, `${this.label} did not take the job (${j.status})`);
    const ev = await readQueue(await this.get(`${this.base}/queue/data?session_hash=${this.session}`), this.d.progress ?? (() => undefined), what);
    if (ev.msg !== 'process_completed' || ev.success === false) {
      const f = failureText(ev, !!this.d.token);
      throw new Model3dError(f.status, f.text.replace(/^the (free )?3-D model maker( \(Hugging Face ZeroGPU\))?/, (_m, _f, z) => `${this.label}${z ?? ''}`), f.code);
    }
    return ev.output?.data ?? [];
  }

  /** The address of the first file (of kind `ext`) in an answer. */
  fileUrl(data: unknown[], ext = ''): string | null {
    return fileFrom(data, this.base, ext) ?? (this.base !== this.root ? fileFrom(data, this.root, ext) : null);
  }
}

/** Kept for an hour per token, so one model costs one look-up. */
const checked = new Map<string, { at: number; free: boolean; why: string }>();

/**
 * The owner's Hugging Face token when it is safe to send to a ZeroGPU Space — a free account that
 * cannot pay — else null and the reason. Fails closed: no answer, an unknown answer, PRO, a card on
 * file (canPay) or any organisation on a paid plan all mean "do not send it".
 */
export async function spaceToken(token: string | null | undefined, f: typeof fetch, now = Date.now()): Promise<{ token: string | null; why: string }> {
  if (!token) return { token: null, why: '' };
  const memo = checked.get(token);
  if (memo && now - memo.at < 3_600_000) return { token: memo.free ? token : null, why: memo.why };
  let free = false;
  let why = "Hugging Face could not say whether your token's account can be charged, so the free GPUs are asked without it";
  try {
    const r = await f('https://huggingface.co/api/whoami-v2', { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (r.ok) {
      const w = (await r.json()) as { type?: unknown; isPro?: unknown; canPay?: unknown; orgs?: unknown };
      const orgs = Array.isArray(w.orgs) ? (w.orgs as { isEnterprise?: unknown; canPay?: unknown; plan?: unknown }[]) : null;
      const paidOrg = !orgs || orgs.some((o) => !o || o.isEnterprise === true || o.canPay === true || (typeof o.plan === 'string' && o.plan !== 'free'));
      if (w.type === 'user' && w.isPro === false && w.canPay !== true && !paidOrg) {
        free = true;
        why = '';
      } else why = 'your Hugging Face token belongs to an account that can be charged for GPU time (PRO, a card on file, or a paid organisation), so Ghosty never sends it to the free GPUs — use a token from a free account with no card';
    }
  } catch {
    // no answer: not sent
  }
  checked.set(token, { at: now, free, why });
  return { token: free ? token : null, why };
}
