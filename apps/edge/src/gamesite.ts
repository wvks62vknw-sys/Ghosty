/**
 * A GAME ON HIS SITES AS AN INSTALLABLE PAGE (BRIEF-KERNEL-3 item 6; the owner's yes, FINAL-ROUND 13 Nov). A game made in his
 * Game Studio is put on his sites at /s/<name>/ by one chat turn and his APPROVE, every time, as every page of his sites is:
 *
 *   1. The phone hands the game open in the studio to the brain (POST /api/sites/game, signed in like every /api call, answered
 *      in the brain so it is in the brain's own storage before his message is: KV alone is not read back at once everywhere): it
 *      is read back with the studio's own reader, checked with the studio's own problems, kept as THE GAME WAITING (one, the
 *      latest, for two hours) and NOT published. Nothing the studio's key does publishes anything.
 *   2. "put <name> on my sites" in the chat: `publish_game` (tools/sites.ts) is a 'confirm' tool, so the kernel stops for his
 *      APPROVE with the sentence `gameApproval` writes (appApproval's shape: { args, reason }). The approval takes a copy of the
 *      game into a one-time TICKET, and `publishGame` publishes ONLY a ticket's game: a call that did not come through the
 *      approval (no ticket, a used one, an old one) is refused, so what goes live is exactly what he approved.
 *   3. The Worker (index.ts) serves it straight at /s/<name>/, never framed, so it can be added to the Home Screen and keep its
 *      saves: the page is composed on every visit from the stored game (as data, never as code) and the studio's own player as
 *      the deployed interface serves it (/studio-player.js, the same build), pinned by its hash in the page's own policy. Nothing
 *      stored can run. Its manifest, its icon (once, the first room drawn flat) and its service worker (the mini-apps' own, which
 *      keeps only this page for offline play) are at /s/<name>/page, told apart by what the browser says it is loading.
 *
 * What the page may do: run that one script, its one style, pictures that are part of it, its manifest and its worker; no network
 * at all (connect-src 'none'), no form, no frame, never framed; no camera, microphone or location. Its saves are kept under its
 * own key in the phone's storage (ghosty-site:<name>) and the player touches no other key. Free: KV's own allowance, no new key.
 */
import { iconPng, manifestOf, STYLE } from '../../web/src/studio-game/app';
import { toBase64, utf8 } from '../../web/src/convert/bytes';
import { type Game, hardProblems, readGame, themeOf } from '../../web/src/studio-game/model';
import { APP_SW } from '../../../packages/shared/src/appkit/index';
import type { Env } from './env';
import { durableDelete, durableGet, durablePut } from './kv';

/** The one game waiting from his phone, and how long it waits. */
export const WAITING = 'sitegame:waiting';
export const WAIT_MS = 2 * 3600_000;
/** A ticket lives for the time an approval card waits. There is one, the latest card's: a newer card replaces it, so nothing piles up. */
export const TICKET_MS = 30 * 60_000;
export const TICKET = 'sitegame:ticket';
/** A game's JSON may be this big (the studio's own page target is 400 KB with the player). */
export const MAX_GAME_BYTES = 350_000;

export interface WaitingGame {
  game: Game;
  at: number;
}
export interface GameTicket {
  id: string;
  game: Game;
  /** [sites] his note for the front page (sites.u11) */
  note?: string;
  name: string;
  at: number;
}

const html = (status: number, words: string, extra: Record<string, string> = {}) =>
  new Response(`<!doctype html><meta name="viewport" content="width=device-width"><title>Ghosty</title><p style="font:16px system-ui;padding:24px">${words}</p>`, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow', ...extra },
  });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** The link name a game has on his sites: its name in lower case, letters, numbers and hyphens (the studio's slugOf). */
export const gameSlug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'game';
/** Where its saves are kept on the phone that plays it: its own key, and only that. */
export const saveKeyOf = (name: string): string => `ghosty-site:${name}`;
export const gameBase = (name: string): string => `/s/${name}/`;

/** A game as the studio reads it back, or why it cannot go on his sites. */
export function readForSites(raw: unknown): { game: Game } | { error: string } {
  let size = 0;
  try {
    size = JSON.stringify(raw).length;
  } catch {
    return { error: 'That is not a game I can read.' };
  }
  if (size > MAX_GAME_BYTES) return { error: `The game is ${Math.round(size / 1024)} KB; a page on your sites holds up to ${Math.round(MAX_GAME_BYTES / 1024)} KB. Trim its sprites or rooms first.` };
  const r = readGame(raw);
  if (!r) return { error: 'That is not a game I can read.' };
  const stop = hardProblems(r.game)[0];
  if (stop) return { error: `It would not play yet: ${stop.text}` };
  return { game: r.game };
}

type Store = { env: Pick<Env, 'SITES'>; storage?: DurableObjectStorage };
/** Read back the brain's own storage first (it is what was written last, everywhere), and KV only while it is paused. */
async function fresh<T>(s: Store, key: string): Promise<T | undefined> {
  if (s.storage) {
    try {
      return await s.storage.get<T>(key);
    } catch {
      /* paused: KV's copy */
    }
  }
  return durableGet<T>(s.env, undefined, key).catch(() => undefined);
}

/**
 * /sites/game in the brain (agent.ts, behind the owner's sign-in): POST the game open in his studio, kept as the one game
 * waiting. It publishes nothing. GET says what waits; DELETE forgets it.
 */
export async function gameUpload(req: Request, s: Store): Promise<Response> {
  if (req.method === 'GET') {
    const w = await fresh<WaitingGame>(s, WAITING);
    return json(w && Date.now() - w.at < WAIT_MS ? { name: w.game.name, link: gameSlug(w.game.name), at: w.at } : { name: null });
  }
  if (req.method === 'DELETE') {
    await durableDelete(s.env, s.storage, WAITING).catch(() => undefined);
    return json({ ok: true });
  }
  if (req.method !== 'POST') return json({ error: 'POST the game' }, 405);
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > MAX_GAME_BYTES * 2) return json({ error: 'That game is too big for a page on your sites.' }, 413);
  const text = await req.text();
  if (text.length > MAX_GAME_BYTES * 2) return json({ error: 'That game is too big for a page on your sites.' }, 413);
  let body: { game?: unknown };
  try {
    body = JSON.parse(text) as { game?: unknown };
  } catch {
    return json({ error: 'That is not a game I can read.' }, 400);
  }
  const r = readForSites(body.game);
  if ('error' in r) return json({ error: r.error }, 422);
  try {
    await durablePut(s.env, s.storage, WAITING, { game: r.game, at: Date.now() } satisfies WaitingGame);
  } catch {
    return json({ error: 'I could not keep the game just now (my free storage said no). Try again in a minute.' }, 503);
  }
  return json({ ok: true, name: r.game.name, link: gameSlug(r.game.name) });
}

// ---------------------------------------------------------------------------------------------- the chat turn and his APPROVE

interface Ctx {
  env: Env;
  storage?: DurableObjectStorage;
  origin?: string;
}
const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '');

/** The game waiting from his phone, if it is the one he named (or any, when he named none). */
export async function waitingGame(ctx: Ctx, asked: string): Promise<Game> {
  const w = await fresh<WaitingGame>(ctx, WAITING);
  if (!w || Date.now() - w.at > WAIT_MS) throw new Error('No game is waiting from his phone. Tell him: open the game in the Game Studio, then ask again (or tap PUT IT ON MY SITES there).');
  const want = fold(asked);
  if (want && !fold(w.game.name).includes(want) && !want.includes(fold(w.game.name))) {
    throw new Error(`The game waiting from his phone is "${w.game.name}", not "${asked}". Tell him to open "${asked}" in the Game Studio and ask again.`);
  }
  return w.game;
}

/** The link name for a game: its own, unless another page (or another game) already has it. */
export async function gameLinkName(ctx: Ctx, g: Game, get: (name: string) => Promise<{ game?: Game; title: string } | undefined>): Promise<{ name: string; replaces?: string }> {
  const base = gameSlug(g.name);
  for (let i = 0; i < 20; i++) {
    const name = i === 0 ? base : `${base.slice(0, 44)}-${i + 1}`;
    const had = await get(name).catch(() => undefined);
    if (!had) return { name };
    if (had.game?.id === g.id) return { name, replaces: had.title };
  }
  throw new Error('every link for that name is taken: rename the game in the studio');
}

/** appApproval's shape: the sentence on the APPROVE card, and the arguments the run gets (with the ticket). */
export async function gameApproval(a: Record<string, unknown>, ctx: Ctx, get: (name: string) => Promise<{ game?: Game; title: string } | undefined>, link: (name: string) => string): Promise<{ args: Record<string, unknown>; reason: string }> {
  const game = await waitingGame(ctx, typeof a.name === 'string' ? a.name : '');
  const { name, replaces } = await gameLinkName(ctx, game, get);
  const ticket = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const note = typeof a.note === 'string' ? a.note.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, 400) : '';
  await durablePut(ctx.env, ctx.storage, TICKET, { id: ticket, game, name, at: Date.now(), ...(note ? { note } : {}) } satisfies GameTicket);
  const kb = Math.max(1, Math.round(JSON.stringify(game).length / 1024));
  return {
    args: { ...a, ticket },
    reason:
      `${replaces ? 'Update' : 'Put'} your game "${game.name}" on your sites at ${link(name)}/? Anyone with the link can play it (${kb} KB). ` +
      'It installs to a Home Screen, plays offline and keeps its saves on the phone that plays it; it reaches nothing on the network and asks for no camera, microphone or location.' +
      (replaces ? ' This replaces the copy already there.' : '') +
      // the whole note, every word that goes public (review fix: it is capped at 400 above)
      (note ? ` Its front page carries your note: “${note}”.` : ''),
  };
}

/** The run: only the latest approval's game, once, and only while its ticket is fresh. */
export async function publishGame(a: Record<string, unknown>, ctx: Ctx, put: (name: string, game: Game, note?: string) => Promise<void>, link: (name: string) => string): Promise<{ name: string; title: string; link: string }> {
  const ticket = typeof a.ticket === 'string' && /^[0-9a-f]{32}$/.test(a.ticket) ? a.ticket : '';
  const t = ticket ? await fresh<GameTicket>(ctx, TICKET) : undefined;
  if (!t || t.id !== ticket || Date.now() - t.at > TICKET_MS) throw new Error('Not published: a game goes on his sites only through his APPROVE in this chat. Ask him again.');
  await durableDelete(ctx.env, ctx.storage, TICKET).catch(() => undefined);
  await put(t.name, t.game, t.note);
  return { name: t.name, title: t.game.name, link: `${link(t.name)}/` };
}

// ---------------------------------------------------------------------------------------------- the page, served

/** What the page may do: exactly its one script and its one style, by hash; no network; never framed. */
export const gamePolicy = (scriptHash: string, styleHash: string): string =>
  `default-src 'none'; script-src 'sha256-${scriptHash}'; style-src 'sha256-${styleHash}'; img-src 'self' data: blob:; manifest-src 'self'; worker-src 'self'; connect-src 'none'; media-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`;
export const GAME_PERMISSIONS = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()';

async function sha(text: string): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', utf8.encode(text))));
}
interface Player {
  code: string;
  hash: string;
}
const players = new WeakMap<object, Promise<Player | null>>();
/** The studio's own player, as the deployed interface serves it (the same build as this Worker), and its hash. */
export function playerOf(assets: Env['ASSETS'], origin: string): Promise<Player | null> {
  if (!assets) return Promise.resolve(null);
  let p = players.get(assets);
  if (!p) {
    p = assets
      .fetch(new Request(new URL('/studio-player.js', origin).toString()))
      .then(async (r) => {
        if (!r.ok) return null;
        const code = (await r.text()).replace(/<\/script/gi, '<\\/script');
        return code.length > 1000 ? { code, hash: await sha(code) } : null;
      })
      .catch(() => null);
    players.set(assets, p);
    // a miss is not kept: the next visit asks again
    void p.then((x) => (x ? undefined : players.delete(assets)));
  }
  return p;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** The manifest: installs as its own app, standalone, at /s/<name>/, with its one icon. */
export function gameManifest(name: string, g: Game): Record<string, unknown> {
  const base = gameBase(name);
  return { ...manifestOf(g, base, `${base}page`), id: base, description: `${g.name}: a game made in Ghosty's game studio.`, lang: 'en-GB' };
}

/** [sites] The front page's look (sites.u11): over the game until PLAY, scrolling, in the game's own sky. One style with the player's. */
export const FRONT_CSS = `#front{position:fixed;inset:0;z-index:10;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--fsky);color:white;font:16px/1.45 -apple-system,system-ui,sans-serif;padding:calc(20px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom));box-sizing:border-box;touch-action:pan-y}#front h1{font-size:30px;line-height:1.15;margin:0 0 6px}#front .by{margin:0 0 12px;opacity:.85}#front .note{margin:0 0 16px;padding:12px;border:2px solid rgba(255,255,255,.6);border-radius:8px;white-space:pre-line}#front h2{font-size:15px;letter-spacing:.06em;text-transform:uppercase;margin:18px 0 6px}#front ul{margin:0;padding-left:20px}#front .rooms{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:8px}#front figure{margin:0}#front img{width:100%;height:auto;image-rendering:pixelated;border-radius:6px;display:block}#front figcaption{font-size:14px;opacity:.85;margin-top:4px}#front .play{position:sticky;bottom:0;display:block;width:100%;min-height:56px;margin-top:20px;font:700 20px -apple-system,system-ui,sans-serif;color:black;background:white;border:0;border-radius:10px}`;
const HOW: Record<Game['kind'], string[]> = {
  platformer: ['◀ and ▶ on the pad move you; the big button jumps (or the arrow keys and the space bar).', 'Talk to the people you meet: they give you the quests.', 'Touch a save point to keep your place: CONTINUE takes you back to it next time.'],
  topdown: ['The arrows on the pad walk you round (or the arrow keys).', 'Walk up to people to talk: they give you the quests.', 'Touch a save point to keep your place: CONTINUE takes you back to it next time.'],
};
/** The front page: its name, who made it, his note, how to play, its rooms as pictures, and PLAY. */
export function frontOf(g: Game, note = ''): string {
  const rooms = g.rooms.slice(0, 6).map((r) => `<figure><img src="data:image/png;base64,${toBase64(iconPng(g, { room: r, size: 256 }))}" alt="${esc(r.name)}" width="256" height="256"><figcaption>${esc(r.name)}</figcaption></figure>`);
  return `<section id="front" aria-label="${esc(g.name)}"><h1>${esc(g.name)}</h1><p class="by">${g.maker ? `A game by ${esc(g.maker)}, made in Ghosty’s game studio.` : 'A game made in Ghosty’s game studio.'} ${g.rooms.length} room${g.rooms.length === 1 ? '' : 's'}, ${g.quests.length} quest${g.quests.length === 1 ? '' : 's'}.</p>${note ? `<p class="note">${esc(note)}</p>` : ''}<h2>How to play</h2><ul>${HOW[g.kind].map((x) => `<li>${esc(x)}</li>`).join('')}</ul><h2>The rooms</h2><div class="rooms">${rooms.join('')}</div><button class="play" type="button">PLAY</button></section>`;
}

/** The page: the game as data (never as code), the studio's player as its one script, its saves' key and its worker named for the player. */
export function gamePage(name: string, g: Game, player: Player, note = ''): string {
  const base = gameBase(name);
  const data = JSON.stringify(g).replace(/</g, '\\u003c');
  const th = themeOf(g.palette);
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><title>${esc(g.name)}</title><meta name="robots" content="noindex,nofollow"><meta name="theme-color" content="${esc(th.sky[0])}"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="${esc(g.name.slice(0, 12))}"><link rel="manifest" href="${base}page"><link rel="apple-touch-icon" href="${base}page"><style>${pageStyle(th.sky[0])}</style></head><body>${frontOf(g, note)}<canvas id="c"></canvas><div id="u"><div class="gpUi" id="gp"></div></div><script type="application/json" id="game" data-save="${esc(saveKeyOf(name))}" data-sw="${base}page" data-scope="${base}">${data}</script><script>${player.code}</script></body></html>`;
}

/** The page's one style: the player's, and the front page's in the game's sky colour (from the kit's own palette). */
export const pageStyle = (sky: string): string => `${STYLE}:root{--fsky:${/^#[0-9a-f]{6}$/i.test(sky) ? sky : 'black'}}${FRONT_CSS}`;

const icons = new Map<string, Uint8Array>();
function iconFor(name: string, at: number, g: Game): Uint8Array {
  const k = `${name}@${at}`;
  let png = icons.get(k);
  if (!png) {
    png = iconPng(g);
    if (icons.size > 20) icons.delete(icons.keys().next().value!);
    icons.set(k, png);
  }
  return png;
}

/**
 * /s/<name>/ and /s/<name>/page for a game (index.ts from KV; the brain's /site/<name> while KV has not caught up): the page
 * itself (dest null), or what the browser loads for it at /page — its service worker, its manifest, its icon. Opened as a page,
 * /page goes to the game. `path` is the address asked for (/s/<name> goes to /s/<name>/, the scope its worker keeps).
 */
export async function gameSiteResponse(site: { name: string; at: number; game?: Game; gameNote?: string }, env: Pick<Env, 'ASSETS'>, origin: string, path: string, dest: string | null): Promise<Response> {
  const g = site.game;
  if (!g) return html(404, 'This page doesn’t exist (any more).');
  const base = gameBase(site.name);
  const vary = { vary: 'Sec-Fetch-Dest', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' };
  if (dest === null) {
    if (!path.endsWith('/')) return new Response(null, { status: 301, headers: { location: base, 'cache-control': 'no-store' } });
    const player = await playerOf(env.ASSETS, origin);
    if (!player) return html(503, 'This game’s player is being set up. Try again in a minute.', { 'retry-after': '60' });
    const styleHash = await sha(pageStyle(themeOf(g.palette).sky[0]));
    return new Response(gamePage(site.name, g, player, site.gameNote ?? ''), {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-cache',
        'content-security-policy': gamePolicy(player.hash, styleHash),
        'permissions-policy': GAME_PERMISSIONS,
        'cross-origin-opener-policy': 'same-origin',
        'referrer-policy': 'no-referrer',
        'x-content-type-options': 'nosniff',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }
  if (dest === 'serviceworker') return new Response(APP_SW, { headers: { ...vary, 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'no-cache', 'content-security-policy': "default-src 'none'; connect-src 'self'" } });
  if (dest === 'manifest') return new Response(JSON.stringify(gameManifest(site.name, g)), { headers: { ...vary, 'content-type': 'application/manifest+json; charset=utf-8', 'cache-control': 'no-cache' } });
  if (dest === 'document' || dest === 'iframe' || dest === 'frame' || dest === 'embed' || dest === 'object') return new Response(null, { status: 302, headers: { location: base, 'cache-control': 'no-store', vary: 'Sec-Fetch-Dest' } });
  return new Response(iconFor(site.name, site.at, g) as Uint8Array<ArrayBuffer>, { headers: { ...vary, 'content-type': 'image/png', 'cache-control': 'public, max-age=3600', 'content-security-policy': "default-src 'none'" } });
}
