/**
 * Linking the owner's Spotify account (Authorization Code with PKCE, no client secret).
 *  1. startSpotifyLink(): make a code verifier + state, keep them in sessionStorage, go to Spotify
 *  2. Spotify sends the owner back to `redirectUri()` with ?code=…&state=…
 *  3. finishSpotifyLink() (called at boot) hands the code to the brain, which swaps it for tokens.
 * The page never talks to Spotify itself: the security policy only allows this site.
 */
import { brain } from '../api/brain';

const PKCE_KEY = 'ghosty.spotify.pkce';
const CLIENT_KEY = 'ghosty.spotify.clientId';
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing playlist-read-private user-library-read user-read-recently-played';

/** The exact Redirect URI the owner adds to their Spotify app: this site's root page. */
export const redirectUri = () => `${location.origin}/`;

/** The Client ID typed on this device (remembered for convenience; it is not a secret). */
export const savedClientId = {
  get(): string {
    try {
      return localStorage.getItem(CLIENT_KEY) ?? '';
    } catch {
      return '';
    }
  },
  set(v: string) {
    try {
      if (v) localStorage.setItem(CLIENT_KEY, v);
      else localStorage.removeItem(CLIENT_KEY);
    } catch {
      /* ignore */
    }
  },
};

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
function random(n: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  let s = '';
  for (const b of bytes) s += CHARS[b % CHARS.length];
  return s;
}

function b64url(buf: ArrayBuffer): string {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Go to Spotify's sign-in page. Throws if the Client ID looks wrong. */
export async function startSpotifyLink(clientId: string): Promise<void> {
  const id = clientId.trim();
  if (!/^[A-Za-z0-9]{16,64}$/.test(id)) throw new Error('Paste the Client ID from your Spotify app first (32 letters and numbers).');
  const verifier = random(64);
  const state = random(24);
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, clientId: id }));
  savedClientId.set(id);
  const q = new URLSearchParams({ client_id: id, response_type: 'code', redirect_uri: redirectUri(), code_challenge_method: 'S256', code_challenge: challenge, state, scope: SCOPES });
  location.assign(`https://accounts.spotify.com/authorize?${q.toString()}`);
}

/**
 * At boot: if Spotify just sent the owner back here, finish linking and tidy the address bar.
 * Returns a message to show (and whether it worked), or null when this isn't a Spotify return.
 */
export async function finishSpotifyLink(): Promise<{ ok: boolean; text: string } | null> {
  const q = new URLSearchParams(location.search);
  const code = q.get('code');
  const state = q.get('state');
  const error = q.get('error');
  if (!state || (!code && !error)) return null;
  let saved: { verifier?: string; state?: string; clientId?: string } = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? '{}') as typeof saved;
    sessionStorage.removeItem(PKCE_KEY);
  } catch {
    /* storage unavailable */
  }
  try {
    history.replaceState(null, '', `${location.pathname}${location.hash}`);
  } catch {
    /* ignore */
  }
  if (!saved.state || saved.state !== state || !saved.verifier || !saved.clientId) return null; // not ours: ignore
  if (error) return { ok: false, text: error === 'access_denied' ? 'Spotify linking was cancelled' : `Spotify said: ${error}` };
  try {
    const r = await brain.spotifyLink({ code: code!, verifier: saved.verifier, redirectUri: redirectUri(), clientId: saved.clientId });
    return { ok: true, text: `Spotify linked as ${r.name}` };
  } catch (e) {
    return { ok: false, text: `Spotify linking failed: ${String((e as Error).message)}` };
  }
}
