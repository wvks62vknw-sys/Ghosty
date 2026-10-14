/**
 * Ghosty brain — Worker entry point.
 * Only reachable through the interface's /api gateway (service binding); it has no
 * public URL. Every request is checked by the kernel's auth before anything runs.
 */
import type { Env } from './env';
import { authenticate } from './kernel/auth';
export { GhostyAgent } from './agent';

/** Hosts the interface may read through /api/proxy (public data feeds only). */
const FEED_HOSTS = new Set([
  'api.adsb.lol',
  'api.airplanes.live',
  'opensky-network.org',
  'celestrak.org',
  'earthquake.usgs.gov',
  'eonet.gsfc.nasa.gov',
  'll.thespacedevs.com',
  'api.open-meteo.com',
  'geocoding-api.open-meteo.com',
  'api.coingecko.com',
  'api.frankfurter.app',
  'stooq.com',
  'feeds.bbci.co.uk',
  'services.swpc.noaa.gov',
  'nominatim.openstreetmap.org',
  'overpass-api.de',
  'de1.api.radio-browser.info',
  'routing.openstreetmap.de',
]);

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function proxy(req: Request, ctx: ExecutionContext): Promise<Response> {
  const u = new URL(req.url);
  const target = u.searchParams.get('url') ?? '';
  let t: URL;
  try {
    t = new URL(target);
  } catch {
    return json({ error: 'bad url' }, 400);
  }
  if (t.protocol !== 'https:' || !FEED_HOSTS.has(t.hostname)) return json({ error: `host not allowed: ${t.hostname}` }, 403);
  const ttl = Math.max(5, Math.min(86400, Number(u.searchParams.get('ttl')) || 60));
  const cache = (caches as unknown as CacheStorage).default;
  const key = new Request(`https://ghosty-cache.internal/${encodeURIComponent(t.toString())}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const r = await fetch(t.toString(), {
    headers: { 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)', Accept: req.headers.get('accept') ?? '*/*' },
  });
  // Redirects must stay on allowed hosts too.
  if (r.url && !FEED_HOSTS.has(new URL(r.url).hostname)) return json({ error: 'redirected to a host that is not allowed' }, 403);
  // Feed data is never rendered as a page on Ghosty's own address: no scripts, download only.
  const out = new Response(r.body, {
    status: r.status,
    headers: {
      'content-type': r.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': `public, max-age=${ttl}`,
      'content-security-policy': "sandbox; default-src 'none'",
      'x-content-type-options': 'nosniff',
      'content-disposition': 'attachment',
    },
  });
  if (r.ok) ctx.waitUntil(cache.put(key, out.clone()));
  return out;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return json({ error: 'not found' }, 404);
    if (url.pathname === '/api/health') {
      return json({ ok: true, secured: !!(env.OWNER_KEY || (env.OWNER_EMAIL && env.ACCESS_TEAM && env.ACCESS_AUD)), access: !!env.ACCESS_TEAM, vault: !!env.VAULT_KEY });
    }
    // Only Ghosty's own interface may call the brain: refuse requests made by other sites
    // or by sandboxed widgets (cross-site request forgery), even if a login cookie rides along.
    const site = req.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') return json({ error: 'cross-site request refused' }, 403);
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.get('x-ghosty') !== '1') return json({ error: 'missing x-ghosty header' }, 403);
    const auth = await authenticate(req, env);
    if (!auth.ok) return json({ error: auth.reason, auth: true }, auth.status);
    if (url.pathname === '/api/proxy') return proxy(req, ctx);
    const stub = env.AGENT.get(env.AGENT.idFromName('owner'));
    const fwd = new Request(req);
    fwd.headers.set('x-ghosty-owner', auth.who);
    return stub.fetch(fwd);
  },
};
