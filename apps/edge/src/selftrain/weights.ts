/**
 * The trained offline brain's weights, served to the phone through the brain. The model repo on Hugging Face is
 * PRIVATE (the brain learned from the owner's library and chats), so the phone cannot fetch it itself, and the
 * owner's token must never reach the phone. Instead WebLLM is given a model address on Ghosty's own site:
 *
 *   https://<ghosty>/api/w/<cap>/resolve/<commit>/<file>
 *
 * `<cap>` is a long random capability kept in the brain (`train:cap`), handed to the phone in the /training
 * status and replaced by REVOKE (old addresses stop working). index.ts forwards `/api/w/…` without the owner's
 * sign-in (WebLLM's fetches carry no owner key, like Telegram's webhook carries none): the capability is the key.
 * Only commits the brain promoted after the exam gate (`train:models`) are served, only plain file names.
 *
 * The brain asks Hugging Face for `resolve/<commit>/<file>` with the owner's token and does not follow the
 * redirect: a large file (the weight shards, in LFS/Xet) is answered with a short-lived signed address on
 * Hugging Face's CDN (`*.hf.co`, already in the interface's connect-src; it allows any origin), passed on as a
 * 302, so the gigabytes never go through the Worker and the token stays here. A small file (the JSON configs,
 * the tokenizer) comes back directly, or after a redirect within huggingface.co, and is streamed through.
 */
import { hfResolve } from './remote';

export const CAP_KEY = 'train:cap';

export interface WeightDeps {
  storage: DurableObjectStorage;
  vault: { get(name: string): Promise<string | null | undefined> };
  fetch?: typeof fetch;
}

const notFound = () => new Response('not found', { status: 404, headers: { 'cache-control': 'no-store' } });

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

const randomCap = () => [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');

/** The phone's capability (made on first use). */
export async function weightsCap(storage: DurableObjectStorage): Promise<string> {
  let c = await storage.get<string>(CAP_KEY);
  if (!c) {
    c = randomCap();
    await storage.put(CAP_KEY, c);
  }
  return c;
}

/** A new capability: every address handed out before stops working. */
export async function revokeCap(storage: DurableObjectStorage): Promise<string> {
  const c = randomCap();
  await storage.put(CAP_KEY, c);
  return c;
}

/** Hugging Face's CDN hosts the interface may fetch from itself (connect-src `https://*.hf.co`). */
const CDN = (h: string) => h === 'hf.co' || h.endsWith('.hf.co');
/** Hugging Face's own hosts, followed here (an older CDN host like cdn-lfs.huggingface.co is not in the policy: streamed through). */
const HFHOST = (h: string) => h === 'huggingface.co' || h.endsWith('.huggingface.co');

/** `path` = `/w/<cap>/resolve/<commit>/<file>` (after `/api`). */
export async function weightsRoute(req: Request, path: string, d: WeightDeps): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return notFound();
  const m = path.match(/^\/w\/([0-9a-f]{48})\/resolve\/([0-9a-f]{40})\/([A-Za-z0-9_][A-Za-z0-9._-]{0,120})$/);
  if (!m) return notFound();
  const cap = await d.storage.get<string>(CAP_KEY);
  if (!cap || !sameText(cap, m[1]!)) return notFound();
  const models = (await d.storage.get<{ commit: string; repo: string }[]>('train:models')) ?? [];
  const model = models.find((x) => x.commit === m[2]);
  if (!model) return notFound();
  const token = ((await d.vault.get('hf_write')) ?? '').trim();
  if (!token) return new Response('the Hugging Face token is not saved', { status: 503, headers: { 'cache-control': 'no-store' } });
  const f = d.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const method = req.method as 'GET' | 'HEAD';
  let r = await hfResolve(f, token, model.repo, model.commit, m[3]!, method, req.headers.get('range'));
  // A redirect inside huggingface.co (a renamed repo, the small-file cache) is followed here, with the token, a few times at most.
  for (let hops = 0; hops < 4 && r.status >= 300 && r.status < 400; hops++) {
    const loc = r.headers.get('location');
    if (!loc) break;
    const to = new URL(loc, 'https://huggingface.co');
    if (to.protocol !== 'https:') return new Response('bad redirect', { status: 502 });
    if (CDN(to.hostname)) return new Response(null, { status: 302, headers: { location: to.href, 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } });
    if (!HFHOST(to.hostname)) return new Response('bad redirect', { status: 502 });
    // The token goes only to huggingface.co itself; a signed address on another host needs none.
    r = await f(to.href, { method, redirect: 'manual', headers: to.hostname === 'huggingface.co' ? { Authorization: `Bearer ${token}` } : {} });
  }
  if (!r.ok && r.status !== 206) return new Response(`Hugging Face answered ${r.status}`, { status: r.status === 404 ? 404 : 502, headers: { 'cache-control': 'no-store' } });
  const headers = new Headers({ 'cache-control': 'private, max-age=3600', 'x-content-type-options': 'nosniff' });
  for (const h of ['content-type', 'content-length', 'content-range', 'etag', 'accept-ranges']) {
    const v = r.headers.get(h);
    if (v) headers.set(h, v);
  }
  return new Response(method === 'HEAD' ? null : r.body, { status: r.status, headers });
}
