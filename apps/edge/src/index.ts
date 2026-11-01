/**
 * Ghosty — Worker entry point.
 * Cloudflare serves the interface's static files directly; only /api/* reaches this
 * code. Every /api request except /api/health is checked by the kernel's auth first.
 */
import type { Env } from './env';
import { authenticate, ownerSecured } from './kernel/auth';
import { siteFrameResponse, siteResponse, siteStore } from './tools/sites';
import { imageResponse } from './lens';
import { zimPassthrough } from './zim';
export { GhostyAgent } from './agent';

/** Hosts the interface may read through /api/proxy (public data feeds only). */
// Live public cameras (God's Eye CCTV): camera lists and images.
const CAMERA_HOSTS = [
  'api.tfl.gov.uk',
  'webcams.nyctmc.org',
  'cwwp2.dot.ca.gov',
  'tie.digitraffic.fi',
  'weathercam.digitraffic.fi',
  '511on.ca',
  'www.drivebc.ca',
  'data.livetraffic.com',
  'webcams.transport.nsw.gov.au',
  'data.calgary.ca',
  'trafficcam.calgary.ca',
  'spatial.durham.gov.uk',
  'dcc.ussgroup.co.uk',
  'wmsafetycameras.co.uk',
  'public.highwaystrafficcameras.co.uk',
];
// Intelligence feeds (God's Eye): ships, radar, weather alerts, disasters, buoys, aurora, cables, 911.
const INTEL_HOSTS = [
  'meri.digitraffic.fi',
  'api.weather.gov',
  'www.gdacs.org',
  'www.ndbc.noaa.gov',
  'www.submarinecablemap.com',
  'data.seattle.gov',
  'data.police.uk',
  'api.rainviewer.com',
  'tilecache.rainviewer.com',
  'nationalhighways.co.uk',
  'webtris.highwaysengland.co.uk',
  'trafficengland.uk',
];
/** Publishers that ask clients to identify themselves / accept compression. */
const FEED_HEADERS: Record<string, Record<string, string>> = {
  'meri.digitraffic.fi': { 'Digitraffic-User': 'Ghosty/personal', 'Accept-Encoding': 'gzip' },
  'tie.digitraffic.fi': { 'Digitraffic-User': 'Ghosty/personal', 'Accept-Encoding': 'gzip' },
  'api.weather.gov': { Accept: 'application/geo+json' },
  // Sits behind a web application firewall that turns away bare bot agents.
  'wmsafetycameras.co.uk': { 'User-Agent': 'Mozilla/5.0 (compatible; Ghosty personal assistant)' },
};
/** Hosts shared by many sites: allowed only under these paths. */
const FEED_PREFIXES = ['s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/'];
const allowedFeed = (u: URL) => FEED_HOSTS.has(u.hostname) || FEED_PREFIXES.some((p) => `${u.hostname}${u.pathname}`.startsWith(p));

const FEED_HOSTS = new Set([
  ...CAMERA_HOSTS,
  ...INTEL_HOSTS,
  'api.adsb.lol',
  'api.airplanes.live',
  'opensky-network.org',
  'celestrak.org',
  'earthquake.usgs.gov',
  'eonet.gsfc.nasa.gov',
  'll.thespacedevs.com',
  'api.open-meteo.com',
  'air-quality-api.open-meteo.com',
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
  'router.project-osrm.org',
  'en.wikipedia.org',
  'api.postcodes.io',
  'i.ytimg.com',
]); // [video] i.ytimg.com: a YouTube thumbnail for the reply's video card (features/core/ytcard.ts)

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
  if (t.protocol !== 'https:' || !allowedFeed(t)) return json({ error: `host not allowed: ${t.hostname}` }, 403);
  const ttl = Math.max(5, Math.min(86400, Number(u.searchParams.get('ttl')) || 60));
  const cache = (caches as unknown as CacheStorage).default;
  const key = new Request(`https://ghosty-cache.internal/${encodeURIComponent(t.toString())}`);
  const hit = await cache.match(key);
  if (hit) return hit;
  const r = await fetch(t.toString(), {
    headers: { 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)', Accept: req.headers.get('accept') ?? '*/*', ...(FEED_HEADERS[t.hostname] ?? {}) },
  });
  // Redirects must stay on allowed hosts too.
  if (r.url && !allowedFeed(new URL(r.url))) return json({ error: 'redirected to a host that is not allowed' }, 403);
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
    // Pages Ghosty published (publish_site): public links, no sign-in, served sandboxed.
    const pub = url.pathname.match(/^\/s\/([a-z0-9-]{1,48})(\/page)?\/?$/);
    if (pub && (req.method === 'GET' || req.method === 'HEAD')) {
      // Nothing from the visitor's request is passed on, except whether it is loading a frame.
      const dest = req.headers.get('sec-fetch-dest');
      // Straight from KV when it is bound: no database involved, so the link stays up while
      // the brain's database is paused. Pages published before KV existed are still in the brain.
      if (env.SITES) {
        // A KV hiccup (its own daily limit, a blip) is not a dead link: the brain still has the page.
        const site = await siteStore(env).get(pub[1]!).catch(() => undefined);
        if (site) return pub[2] ? siteFrameResponse(site, dest) : siteResponse(site);
      }
      const stub = env.AGENT.get(env.AGENT.idFromName('owner'));
      return stub.fetch(new Request(`${url.origin}/api/site/${pub[1]}${pub[2] ? `/page${dest ? `?dest=${encodeURIComponent(dest)}` : ''}` : ''}`));
    }
    // A picture the owner shared from the Lens for reverse image search (lens.ts): a public link for
    // 24 hours, served straight from KV — the brain is never involved, and nothing but image bytes goes out.
    const img = url.pathname.match(/^\/i\/([A-Za-z0-9_-]{16})$/);
    if (img && (req.method === 'GET' || req.method === 'HEAD')) {
      if (!env.SITES) return new Response('not found', { status: 404, headers: { 'cache-control': 'no-store' } });
      return imageResponse(env.SITES, img[1]!, req.method === 'HEAD');
    }
    if (!url.pathname.startsWith('/api/')) return env.ASSETS ? env.ASSETS.fetch(req) : json({ error: 'not found' }, 404);
    if (url.pathname === '/api/health') {
      return json({ ok: true, secured: ownerSecured(env), access: !!env.ACCESS_TEAM, preview: env.IS_PREVIEW === '1' });
    }
    // Telegram's webhook (telegram.ts): Telegram itself calls it, so no owner sign-in — the brain
    // checks the secret it gave Telegram when it set the webhook, and turns away anything else.
    if (url.pathname === '/api/telegram/hook' && req.method === 'POST') return env.AGENT.get(env.AGENT.idFromName('owner')).fetch(req);
    // [social] Discord's interactions for his own bot (social/discord.ts): Discord calls it, so no owner sign-in — the brain
    // checks Discord's Ed25519 signature with his application's public key before it reads a word, and turns away the rest.
    if (url.pathname === '/api/discord/interactions' && req.method === 'POST') return env.AGENT.get(env.AGENT.idFromName('owner')).fetch(req);
    // [selftrain] The weekly Kaggle notebook's hook (selftrain/cycle.ts): Kaggle's machine calls it, so no owner
    // sign-in — the brain turns away anything without this week's one-time ticket.
    if (url.pathname === '/api/training/hook' && (req.method === 'POST' || req.method === 'GET')) return env.AGENT.get(env.AGENT.idFromName('owner')).fetch(req);
    // [selftrain] A trained offline brain's files for the phone (selftrain/weights.ts): WebLLM fetches them with no
    // owner key, so the long random capability in the address is the key; the brain checks it and the commit.
    if (url.pathname.startsWith('/api/w/') && (req.method === 'GET' || req.method === 'HEAD')) return env.AGENT.get(env.AGENT.idFromName('owner')).fetch(req);
    // Only Ghosty's own interface may call the brain: refuse requests made by other sites
    // or by sandboxed widgets (cross-site request forgery), even if a login cookie rides along.
    const site = req.headers.get('sec-fetch-site');
    if (site && site !== 'same-origin' && site !== 'none') return json({ error: 'cross-site request refused' }, 403);
    if (!['GET', 'HEAD'].includes(req.method) && req.headers.get('x-ghosty') !== '1') return json({ error: 'missing x-ghosty header' }, 403);
    const auth = await authenticate(req, env);
    if (!auth.ok) return json({ error: auth.reason, auth: true }, auth.status);
    if (url.pathname === '/api/proxy') return proxy(req, ctx);
    // [resta] WIKIPEDIA, OFFLINE: the owner's phone fetches a Kiwix file a piece at a time through here (zim.ts), streamed
    // and kept nowhere; the brain never reads it.
    if (url.pathname.startsWith('/api/zim/')) return zimPassthrough(req, url.pathname.slice('/api/zim/'.length));
    const stub = env.AGENT.get(env.AGENT.idFromName('owner'));
    const fwd = new Request(req);
    fwd.headers.set('x-ghosty-owner', auth.who);
    return stub.fetch(fwd);
  },
};
