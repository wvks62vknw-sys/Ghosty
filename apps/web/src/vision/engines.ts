/**
 * Reverse image search, attributed: each engine is named, and the owner opens it themselves. The
 * engines need a public link to the picture, so the crop is first shared through the brain
 * (POST /api/lens/share → a link that works for 24 hours, FORGET NOW deletes it). Pure apart
 * from the fetch, which is passed in.
 */
export type EngineId = 'google' | 'bing' | 'yandex' | 'tineye';

export interface Engine {
  id: EngineId;
  name: string;
  /** Plain words about where the picture link goes. */
  note: string;
  url(publicUrl: string): string;
}

export const ENGINES: readonly Engine[] = [
  { id: 'google', name: 'Google Lens', note: 'Opens Google Lens in a new tab; Google fetches the picture from its link.', url: (u) => `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(u)}` },
  { id: 'bing', name: 'Bing Visual Search', note: 'Opens Bing in a new tab; Microsoft fetches the picture from its link.', url: (u) => `https://www.bing.com/images/search?view=detailv2&iss=sbi&q=imgurl:${encodeURIComponent(u)}` },
  { id: 'yandex', name: 'Yandex Images', note: 'Opens Yandex in a new tab; Yandex fetches the picture from its link.', url: (u) => `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(u)}` },
  { id: 'tineye', name: 'TinEye', note: 'Opens TinEye in a new tab; TinEye fetches the picture from its link.', url: (u) => `https://tineye.com/search?url=${encodeURIComponent(u)}` },
];

export interface EngineLink {
  id: EngineId;
  name: string;
  url: string;
  note: string;
}

/** The search page of every engine for a public picture link ([] when the link is not http(s)). */
export function engineUrls(publicUrl: string): EngineLink[] {
  let u: URL;
  try {
    u = new URL(publicUrl);
  } catch {
    return [];
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return [];
  return ENGINES.map((e) => ({ id: e.id, name: e.name, url: e.url(u.toString()), note: e.note }));
}

export interface ShareInfo {
  id: string;
  url: string;
  /** When the link stops working, ms since the epoch. */
  expires: number;
}

/** The brain refuses bigger pictures (413). */
export const SHARE_MAX_BYTES = 1_500_000;
export const SHARE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface ShareDeps {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** The brain's request headers (x-ghosty, the owner key) with extras. */
  headers: (extra?: Record<string, string>) => Record<string, string>;
}

const errorOf = async (r: Response): Promise<string> => {
  const j = (await r.json().catch(() => null)) as { error?: string } | null;
  return j?.error ?? `HTTP ${r.status}`;
};

/** Share a crop through the brain: the public link the engines can fetch. */
export async function shareImage(blob: Blob, deps: ShareDeps): Promise<ShareInfo> {
  if (!SHARE_TYPES.includes(blob.type)) throw new Error('Only JPEG, PNG or WebP pictures can be shared');
  if (blob.size > SHARE_MAX_BYTES) throw new Error('The picture is too big to share (over 1.5 MB)');
  const r = await deps.fetch('/api/lens/share', { method: 'POST', headers: deps.headers({ 'content-type': blob.type }), body: blob, credentials: 'same-origin' });
  if (r.status === 413) throw new Error('The picture is too big to share (over 1.5 MB)');
  if (r.status === 429) throw new Error("Today's share limit is used up (30 pictures a day); try again tomorrow");
  if (!r.ok) throw new Error(await errorOf(r));
  return parseShare(await r.json().catch(() => null));
}

/** The brain's answer to a share, checked: an id, an http(s) link and when it expires. */
export function parseShare(j: unknown): ShareInfo {
  const o = (j ?? {}) as { id?: unknown; url?: unknown; expires?: unknown };
  const id = String(o.id ?? '');
  const url = String(o.url ?? '');
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) throw new Error('The brain did not give the picture an id');
  if (!/^https?:\/\//.test(url)) throw new Error('The brain did not give a public link');
  const raw = o.expires;
  const expires = typeof raw === 'number' ? raw : typeof raw === 'string' ? Date.parse(raw) : NaN;
  return { id, url, expires: Number.isFinite(expires) ? expires : Date.now() + 86_400_000 };
}

/** Take the shared picture down now (DELETE /api/lens/share/<id>). */
export async function forgetImage(id: string, deps: ShareDeps): Promise<void> {
  const r = await deps.fetch(`/api/lens/share/${encodeURIComponent(id)}`, { method: 'DELETE', headers: deps.headers(), credentials: 'same-origin' });
  if (!r.ok && r.status !== 404) throw new Error(await errorOf(r));
}

/** "reachable by link for 24 hours" / "for 3 more hours" / "no longer reachable". */
export function expiresText(expires: number, now = Date.now()): string {
  const left = expires - now;
  if (left <= 0) return 'no longer reachable by link';
  const h = left / 3_600_000;
  if (h >= 23.5) return 'reachable by link for 24 hours';
  if (h >= 1) return `reachable by link for ${Math.round(h)} more hour${Math.round(h) === 1 ? '' : 's'}`;
  const m = Math.max(1, Math.round(left / 60_000));
  return `reachable by link for ${m} more minute${m === 1 ? '' : 's'}`;
}
