/**
 * [security] The one gate every fetch of an address someone else chose goes through: a chat tool's argument (so possibly
 * words planted in a page the model read), a link in a Telegram message, a link found inside a fetched page, an address a
 * redirect points at. The brain only ever reads the public web with it:
 *  - http:// or https:// only, no username or password in the address;
 *  - no IP address that is loopback, private, link-local (the cloud's metadata address), carrier NAT, reserved, multicast,
 *    or IPv4 hidden inside IPv6 (mapped, NAT64, 6to4) — decimal, hex and octal forms arrive here already as dotted quads;
 *  - no name that never leaves a local network (localhost, *.localhost, *.local, *.internal, *.home.arpa, one-word names);
 *  - every redirect hop is checked BEFORE it is asked (redirect: 'manual'), at most five hops;
 *  - a body is read to a cap and no further.
 */
import { isPrivateIp } from './integrations/recon';

const LOCAL_NAME = /^localhost$|\.(localhost|local|internal|home\.arpa|lan|intranet|corp)$/i;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Why the brain will not fetch this address (a plain line), or '' when it may. */
export function unsafeUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(String(raw ?? '').trim());
  } catch {
    return 'that is not a web address';
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'only http:// and https:// addresses can be read';
  if (u.username || u.password) return 'an address with a username or password in it is not read';
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (!host) return 'that address has no host';
  const v6 = host.includes(':');
  if (IPV4.test(host) || v6) {
    if (isPrivateIp(host) || reservedExtra(host)) return 'that is a private, local or reserved network address';
    return '';
  }
  if (LOCAL_NAME.test(host) || !host.includes('.')) return 'that is a name on a local network, not a public web address';
  return '';
}

/** Ranges recon's list leaves to the public records but a fetch must never reach. */
function reservedExtra(ip: string): boolean {
  if (IPV4.test(ip)) {
    const [a, b, c] = ip.split('.').map(Number) as [number, number, number];
    return (a === 192 && b === 0 && (c === 0 || c === 2)) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113) || a >= 240;
  }
  const s = ip.toLowerCase();
  // NAT64 (64:ff9b::/96), 6to4 (2002::/16), Teredo (2001::/32), documentation (2001:db8::/32), the old site-local and IPv4-compatible forms.
  return /^100:(0{1,4}:){0,3}:/.test(s) || /^100::/.test(s) || /^2001:0?0?[12][0-9a-f]:/.test(s) || /^64:ff9b:/.test(s) || /^2002:/.test(s) || /^2001:0*:/.test(s) || /^2001:0?db8:/.test(s) || /^::(\d|[0-9a-f]{1,4}:)/.test(s) || /^fec0:/.test(s);
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Fetch an address someone else chose. Throws a plain line for a refused address or a redirect into one. The returned
 * response's `url` is the address it ended at.
 */
export async function guardedFetch(url: string, init: RequestInit = {}, opts: { fetcher?: Fetcher; hops?: number } = {}): Promise<Response> {
  const f = opts.fetcher ?? ((u: string, i?: RequestInit) => fetch(u, i));
  let at = url;
  let req: RequestInit = init;
  for (let hop = 0; hop <= (opts.hops ?? 5); hop++) {
    const bad = unsafeUrl(at);
    if (bad) throw new Error(hop ? `the page redirected somewhere the brain does not go (${bad})` : bad);
    const r = await f(at, { ...req, redirect: 'manual' });
    const loc = r.status >= 300 && r.status < 400 ? r.headers.get('location') : null;
    if (!loc) {
      try {
        Object.defineProperty(r, 'url', { value: at, configurable: true });
      } catch {
        /* a frozen response keeps its own url */
      }
      return r;
    }
    try {
      r.body?.cancel().catch(() => undefined);
    } catch {
      /* nothing to cancel */
    }
    const next = new URL(loc, at);
    // like a browser: credentials never follow a redirect to another site, and a 303 (or a POST's 301/302) becomes a plain GET
    if (next.origin !== new URL(at).origin && req.headers) {
      const h = new Headers(req.headers);
      for (const k of ['authorization', 'cookie', 'proxy-authorization', 'x-api-key']) h.delete(k);
      req = { ...req, headers: h };
    }
    const method = (req.method ?? 'GET').toUpperCase();
    if (r.status === 303 || ((r.status === 301 || r.status === 302) && method === 'POST')) req = { ...req, method: method === 'HEAD' ? 'HEAD' : 'GET', body: undefined };
    at = next.toString();
  }
  throw new Error('the page redirected too many times');
}

/** The body as bytes, read to `max` and no further (the rest is left unread). */
export async function readCappedBytes(r: Response, max: number): Promise<{ bytes: Uint8Array; cut: boolean }> {
  if (!r.body) {
    const b = new Uint8Array(await r.arrayBuffer());
    return { bytes: b.subarray(0, max), cut: b.length > max };
  }
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  let cut = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    size += value.length;
    if (size > max) {
      cut = true;
      reader.cancel().catch(() => undefined);
      break;
    }
  }
  const out = new Uint8Array(Math.min(size, max));
  let o = 0;
  for (const p of parts) {
    const part = p.subarray(0, out.length - o);
    out.set(part, o);
    o += part.length;
    if (o >= out.length) break;
  }
  return { bytes: out, cut };
}

/** The body as text, read to `max` bytes and no further. */
export async function readCappedText(r: Response, max: number): Promise<string> {
  return new TextDecoder().decode((await readCappedBytes(r, max)).bytes);
}

/** A request body as text, refused past `max` bytes (a stranger's huge body is never held whole). */
export async function bodyCapped(req: Request, max: number): Promise<string | null> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > max) return null;
  const { bytes, cut } = await readCappedBytes(req as unknown as Response, max);
  return cut ? null : new TextDecoder().decode(bytes);
}
