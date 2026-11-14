/**
 * THE TROPHY ROOM (APPS ROUND): achievements earned by playing, worked out from the record of play (stats.ts) and the scores
 * (scores.ts), both kept on this phone. Pure: no storage, no DOM. Each game has the same five, the games he makes included,
 * and the Arcade as a whole has five more. Nothing is bought, nothing is sent: a trophy is only ever earned.
 */
import type { PlayStat } from './stats';
import type { Score } from './scores';

export interface Trophy {
  /** Steady: `<game>:<kind>` for a game's, `arcade:<kind>` for the Arcade's. */
  id: string;
  name: string;
  /** How it is earned, in his words. */
  how: string;
  earned: boolean;
  /** How far along, 0 to 1 (1 once earned). */
  progress: number;
}

const frac = (have: number, need: number) => Math.max(0, Math.min(1, have / need));
const t = (id: string, name: string, how: string, have: number, need: number): Trophy => ({ id, name, how, earned: have >= need, progress: frac(have, need) });

/** One game's five: a first sitting, ten minutes, an hour, five sittings, and a best score kept. */
export function gameTrophies(id: string, stat: PlayStat | undefined, score: Score | undefined): Trophy[] {
  const plays = stat?.plays ?? 0;
  const secs = stat?.seconds ?? 0;
  return [
    t(`${id}:first`, 'First go', 'Play it once.', plays, 1),
    t(`${id}:ten`, 'Settling in', 'Play for ten minutes in all.', secs, 600),
    t(`${id}:hour`, 'Devoted', 'Play for an hour in all.', secs, 3600),
    t(`${id}:five`, 'Regular', 'Come back to it five times.', plays, 5),
    t(`${id}:best`, 'On the board', 'Set a score or a best of your own.', score ? 1 : 0, 1),
  ];
}

/** The Arcade's five: five games tried, ten games tried, five hours in all, a game he made played, and a trophy in every game played. */
export function arcadeTrophies(stats: Record<string, PlayStat>): Trophy[] {
  const list = Object.values(stats);
  const games = list.filter((s) => s.plays > 0).length;
  const secs = list.reduce((n, s) => n + s.seconds, 0);
  const mine = list.some((s) => s.mine && s.plays > 0) ? 1 : 0;
  return [
    t('arcade:five', 'Explorer', 'Try five different games.', games, 5),
    t('arcade:ten', 'Collector', 'Try ten different games.', games, 10),
    t('arcade:hours', 'Marathon', 'Play for five hours across the Arcade.', secs, 5 * 3600),
    t('arcade:maker', 'Maker', 'Play a game you made in the game studio.', mine, 1),
    t('arcade:week', 'Seven days', 'Play on seven different days.', 0, 7),
  ];
}

/** Every trophy: the Arcade's, then each played game's. `days` is how many different days he played (stats.ts has no per-day log, so it is passed in). */
export function trophyRoom(stats: Record<string, PlayStat>, scores: Record<string, Score>, days = 0): { arcade: Trophy[]; games: { id: string; title: string; trophies: Trophy[] }[]; earned: number; total: number } {
  const arcade = arcadeTrophies(stats).map((x) => (x.id === 'arcade:week' ? { ...x, earned: days >= 7, progress: frac(days, 7) } : x));
  const games = Object.entries(stats)
    .sort((a, b) => b[1].last - a[1].last)
    .map(([id, s]) => ({ id, title: s.title, trophies: gameTrophies(id, s, scores[id] ?? scores[`studio.${id.replace(/^studio-/, '')}`]) }));
  const all = [...arcade, ...games.flatMap((g) => g.trophies)];
  return { arcade, games, earned: all.filter((x) => x.earned).length, total: all.length };
}

/** The trophies a sitting just earned: those earned now and not before. */
export const newlyEarned = (before: Trophy[], after: Trophy[]): Trophy[] => {
  const had = new Set(before.filter((x) => x.earned).map((x) => x.id));
  return after.filter((x) => x.earned && !had.has(x.id));
};
