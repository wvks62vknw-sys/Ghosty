/**
 * The game kinds' dice: one small seeded generator (mulberry32), so a puzzle made from a seed is the same puzzle on
 * every phone and every run, the brain tests can replay it, and a daily puzzle is the same for the whole day.
 */
export type Rng = () => number;

export function rng(seed: number): Rng {
  let a = seed >>> 0 || 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number from lo to hi inclusive. */
export const int = (r: Rng, lo: number, hi: number): number => lo + Math.floor(r() * (hi - lo + 1));

export function shuffle<T>(r: Rng, list: readonly T[]): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export const pick = <T>(r: Rng, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;

/** Today's seed (YYYYMMDD), the same all day: the daily puzzle. */
export const daySeed = (d = new Date()): number => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();

/** A fresh seed for a new game. */
export const freshSeed = (): number => (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;

/** A number option read safely from GameConfig.options, kept within lo and hi. */
export function num(o: Record<string, unknown> | undefined, key: string, dflt: number, lo: number, hi: number): number {
  const v = o?.[key];
  const n = typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : dflt;
  return Math.min(hi, Math.max(lo, Math.round(n)));
}
export function str<T extends string>(o: Record<string, unknown> | undefined, key: string, allowed: readonly T[], dflt: T): T {
  const v = o?.[key];
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : dflt;
}
export function bool(o: Record<string, unknown> | undefined, key: string, dflt: boolean): boolean {
  const v = o?.[key];
  return typeof v === 'boolean' ? v : dflt;
}
export function list(o: Record<string, unknown> | undefined, key: string): string[] {
  const v = o?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim()) : [];
}
