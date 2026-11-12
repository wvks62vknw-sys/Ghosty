/**
 * THE LIGHT FOLLOWING THE DAY (BRIEF-OCT-IDEAS-1 4): one number, `--g-day` on :root, 0 at night to 1 at noon, from the hour alone
 * (never from GPS, never sent anywhere), set once a minute. The Scan's ground, the plates' glow and the orb's brightness read it in
 * styles.css (a mix of two token colours; bright and cool when it is high, dim and warm when it is low); ONE INK's paper warms as
 * it falls after five; GLASS does not read it. The stage's own `data-hour` day/night stays as the coarse switch; this is the fine one.
 */

/** The curve: dark to six, up to noon, a slow fall to a dimmer afternoon by five, then down to dark by ten. */
export function dayLight(ms: number): number {
  const d = new Date(ms);
  const hr = d.getHours() + d.getMinutes() / 60;
  const ease = (k: number) => k * k * (3 - 2 * k);
  const v = hr < 6 || hr >= 22 ? 0 : hr < 12 ? ease((hr - 6) / 6) : hr < 17 ? 1 - 0.4 * ((hr - 12) / 5) : 0.6 * (1 - ease((hr - 17) / 5));
  return Math.round(v * 100) / 100;
}

/** What the checks read and set (window.__ghosty.day): a clock for the hour, and `set()` to write the variable now. */
export const dayState = {
  value: -1,
  clock: null as null | (() => number),
  set: () => undefined as void,
};

let started = false;
/** Start the minute (once): the variable is written now, then every minute, and when the page comes back to the front. */
export function startDay(): void {
  const set = () => {
    const v = dayLight(dayState.clock?.() ?? Date.now());
    dayState.value = v;
    document.documentElement.style.setProperty('--g-day', String(v));
  };
  dayState.set = set;
  if (started) return;
  started = true;
  set();
  setInterval(set, 60_000);
  document.addEventListener('visibilitychange', () => !document.hidden && set());
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.day = dayState) : n < 150 && setTimeout(() => attach(n + 1), 100));
  attach();
}
