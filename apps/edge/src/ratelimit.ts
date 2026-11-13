/**
 * [security] A per-caller allowance for the doors anyone on the internet can knock on (Telegram's, Discord's and the training
 * hook, the weights, published pages, the demo, and wrong owner keys). Counted in this Worker instance's memory, a minute at a
 * time: it does not stop a determined crowd (Cloudflare's own rules do that), but one caller hammering a door is told to wait
 * before the request ever wakes the brain or spends its daily allowance.
 */
const windows = new Map<string, { start: number; n: number }>();
const MAX_KEYS = 5000;

/** The caller's address as Cloudflare saw it ('' when there is none, as in tests). */
export const callerOf = (req: Request): string => req.headers.get('cf-connecting-ip') ?? '';

/** True when this caller has used up `perMinute` for this door; counts the request otherwise. */
export function overLimit(door: string, caller: string, perMinute: number, now = Date.now()): boolean {
  // No caller address means no Cloudflare edge in front (tests, the local preview): nothing to count by. Cloudflare always sets it.
  if (!caller) return false;
  const key = `${door}|${caller}`;
  const w = windows.get(key);
  if (!w || now - w.start >= 60_000) {
    if (windows.size >= MAX_KEYS) {
      for (const [k, v] of windows) if (now - v.start >= 60_000) windows.delete(k);
      if (windows.size >= MAX_KEYS) windows.delete(windows.keys().next().value!);
    }
    windows.set(key, { start: now, n: 1 });
    return false;
  }
  w.n++;
  return w.n > perMinute;
}

/** How many this caller has used of this door in the current minute (not counted itself). */
export function usedOf(door: string, caller: string, now = Date.now()): number {
  if (!caller) return 0;
  const w = windows.get(`${door}|${caller}`);
  return !w || now - w.start >= 60_000 ? 0 : w.n;
}

/** The plain "slow down" answer, with when to try again. */
export const slowDown = (): Response =>
  new Response(JSON.stringify({ error: 'too many requests — try again in a minute' }), { status: 429, headers: { 'content-type': 'application/json', 'retry-after': '60', 'cache-control': 'no-store' } });

/** The allowance per minute for each public door. */
export const DOOR_LIMITS = {
  training: 30,
  weights: 900,
  site: 300,
  image: 120,
  demo: 240,
  badkey: 20,
} as const;

/** Test hook: forget every count. */
export const resetLimits = (): void => windows.clear();
