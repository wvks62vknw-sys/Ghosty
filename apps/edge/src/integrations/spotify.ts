/**
 * Spotify: the owner's own account, linked with Authorization Code + PKCE (no client secret).
 *
 * The interface sends the owner to Spotify's sign-in page and back; this file swaps the code
 * for tokens and keeps them in the encrypted vault under 'spotify'. Every Spotify call goes
 * through the brain (the interface's security policy only lets the page talk to its own site).
 */
import type { SpotifyStatus } from '../../../../packages/shared/src/protocol';
import type { Vault } from '../kernel/vault';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const API = 'https://api.spotify.com/v1';
const VAULT_NAME = 'spotify';

/** What the vault holds (as JSON). */
interface Saved {
  clientId: string;
  refresh: string;
  access: string;
  /** ms epoch when `access` stops working */
  expires: number;
  name?: string;
  product?: string;
}

type Keys = Pick<Vault, 'get' | 'set'> & Partial<Pick<Vault, 'lookup'>>;

export const NOT_LINKED = "Spotify isn't linked yet. The owner can link it in the LINKS tab → SPOTIFY (it takes about a minute).";

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

async function load(vault: Keys): Promise<Saved | null> {
  const raw = await vault.get(VAULT_NAME);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as Saved;
    return s && typeof s.refresh === 'string' && typeof s.clientId === 'string' ? s : null;
  } catch {
    return null;
  }
}

const save = (vault: Keys, s: Saved) => vault.set(VAULT_NAME, JSON.stringify(s));

interface TokenReply {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

/** Ask Spotify's accounts service for tokens (form-encoded, public client: no secret). */
async function token(form: Record<string, string>): Promise<TokenReply> {
  const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form).toString() });
  const j = (await r.json().catch(() => ({}))) as Partial<TokenReply> & { error?: string; error_description?: string };
  if (!r.ok || !j.access_token) {
    const why = j.error_description || j.error || `HTTP ${r.status}`;
    throw Object.assign(new Error(`Spotify sign-in failed: ${why}`), { grant: j.error === 'invalid_grant' });
  }
  return j as TokenReply;
}

/** Swap the code from Spotify's redirect for tokens, then read who it is. */
export async function linkSpotify(vault: Keys, p: { code: string; verifier: string; redirectUri: string; clientId: string }): Promise<{ name: string; product: string }> {
  if (!/^[A-Za-z0-9]{16,64}$/.test(p.clientId)) throw new Error('That Client ID does not look right: copy it from your app on developer.spotify.com.');
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(p.verifier)) throw new Error('bad PKCE verifier');
  if (!p.code || p.code.length > 2048) throw new Error('missing code');
  if (!/^(https:\/\/|http:\/\/(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?\/)/.test(p.redirectUri)) throw new Error('the redirect address must be https');
  const t = await token({ grant_type: 'authorization_code', code: p.code, redirect_uri: p.redirectUri, client_id: p.clientId, code_verifier: p.verifier });
  if (!t.refresh_token) throw new Error('Spotify sign-in failed: no refresh token came back');
  const s: Saved = { clientId: p.clientId, refresh: t.refresh_token, access: t.access_token, expires: Date.now() + (t.expires_in ?? 3600) * 1000 };
  await save(vault, s);
  const me = (await api<{ display_name?: string | null; id?: string; product?: string }>({ vault }, 'GET', '/me')) ?? {};
  const name = me.display_name || me.id || 'Spotify user';
  const product = me.product ?? 'unknown';
  // api() may have refreshed and saved new tokens: re-read before adding the profile.
  const now = (await load(vault)) ?? s;
  await save(vault, { ...now, name, product });
  return { name, product };
}

async function refresh(vault: Keys, s: Saved): Promise<Saved> {
  let t: TokenReply;
  try {
    t = await token({ grant_type: 'refresh_token', refresh_token: s.refresh, client_id: s.clientId });
  } catch (e) {
    if ((e as { grant?: boolean }).grant) {
      // Revoked or expired for good: forget it so the LINKS tab shows "not linked".
      await vault.set(VAULT_NAME, '');
      throw new Error('Spotify access was withdrawn or has expired. The owner can link it again in the LINKS tab → SPOTIFY.');
    }
    throw e;
  }
  // Spotify may rotate the refresh token: keep the new one if it sends one.
  const next: Saved = { ...s, access: t.access_token, refresh: t.refresh_token || s.refresh, expires: Date.now() + (t.expires_in ?? 3600) * 1000 };
  await save(vault, next);
  return next;
}

export class SpotifyError extends Error {
  constructor(
    message: string,
    public status: number,
    public reason = '',
  ) {
    super(message);
  }
}

/**
 * Call the Spotify Web API as the owner. Refreshes the access token when it has expired
 * (or once on a 401), and turns Spotify's errors into plain words. Returns null for an empty reply.
 */
export async function api<T>(ctx: { vault: Keys }, method: string, path: string, body?: unknown): Promise<T | null> {
  const vault = ctx.vault;
  let s = await load(vault);
  if (!s) throw new Error(NOT_LINKED);
  if (s.expires - 60_000 < Date.now()) s = await refresh(vault, s);
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${s.access}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (r.status === 401 && attempt === 0) {
      s = await refresh(vault, s);
      continue;
    }
    const text = await r.text();
    if (r.ok) {
      if (!text.trim()) return null;
      try {
        return JSON.parse(text) as T;
      } catch {
        return null;
      }
    }
    let msg = '';
    let reason = '';
    try {
      const j = JSON.parse(text) as { error?: { message?: string; reason?: string } | string; error_description?: string };
      if (typeof j.error === 'object') {
        msg = j.error.message ?? '';
        reason = j.error.reason ?? '';
      } else msg = j.error_description ?? j.error ?? '';
    } catch {
      msg = text.slice(0, 200);
    }
    if (r.status === 404 && (reason === 'NO_ACTIVE_DEVICE' || /no active device/i.test(msg))) {
      throw new SpotifyError('No active Spotify device. Open Spotify on a device first (phone, computer or speaker) and play anything for a second, then ask again.', 404, 'NO_ACTIVE_DEVICE');
    }
    if (r.status === 403) {
      throw new SpotifyError(`Spotify refused this${msg ? ` (${msg})` : ''}. Controlling playback needs a Spotify Premium account.`, 403, reason);
    }
    if (r.status === 429) {
      const wait = Number(r.headers.get('retry-after')) || 30;
      throw new SpotifyError(`Spotify is rate-limiting requests right now. Try again in ${wait} seconds.`, 429);
    }
    if (r.status === 401) throw new SpotifyError(`Spotify did not accept the saved sign-in${msg ? ` (${msg})` : ''}. Unlink and link Spotify again in the LINKS tab.`, 401);
    throw new SpotifyError(`Spotify answered ${r.status}${msg ? `: ${msg}` : ''}`, r.status, reason);
  }
}

export async function spotifyStatus(vault: Keys): Promise<SpotifyStatus> {
  // Database paused and no copy of the sign-in reachable: say so, rather than "not linked".
  if (vault.lookup && (await vault.lookup(VAULT_NAME)) === undefined) return { linked: false, name: null, product: null, clientId: null, unknown: true };
  const s = await load(vault);
  return { linked: !!s, name: s?.name ?? null, product: s?.product ?? null, clientId: s?.clientId ?? null };
}

/** The LINKS tab's routes: /spotify/link, /spotify/status, /spotify/unlink. */
export async function spotifyRoute(req: Request, path: string, method: string, vault: Keys): Promise<Response> {
  if (path === '/spotify/status' && method === 'GET') return json(await spotifyStatus(vault));
  if (path === '/spotify/unlink' && method === 'POST') {
    await vault.set(VAULT_NAME, '');
    return json({ ok: true });
  }
  if (path === '/spotify/link' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    try {
      const me = await linkSpotify(vault, { code: String(b.code ?? ''), verifier: String(b.verifier ?? ''), redirectUri: String(b.redirectUri ?? ''), clientId: String(b.clientId ?? '').trim() });
      return json({ ok: true, name: me.name, product: me.product });
    } catch (e) {
      return json({ error: String((e as Error)?.message ?? e) }, 400);
    }
  }
  return json({ error: 'not found' }, 404);
}
