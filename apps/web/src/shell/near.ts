/** THE NEAREST ROOM (HOMEPASS): words that matched no screen, set against the names in the house. Pure: no document, no state. */
import { ROOMS } from './rooms';

/** How far apart two words are (letters added, dropped or changed): the small count that finds the nearest name. */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
}
/**
 * The screen nearest to words that matched nothing, by the names in the house (a thing's name, then a room's): the closest by letters,
 * and only if it is close (never a wild guess). Pure; the room's own screen when only a room is near.
 */
export function nearestRoom(q: string): { screen: string; name: string; room: (typeof ROOMS)[number] } | null {
  const w = q.toLowerCase().replace(/[^a-z0-9’' ]+/g, ' ').trim();
  if (w.length < 2) return null;
  let best: { screen: string; name: string; room: (typeof ROOMS)[number]; d: number } | null = null;
  for (const room of ROOMS) {
    for (const t of room.things) {
      if (!t.screen) continue;
      const names = [t.name.toLowerCase(), t.id.toLowerCase()];
      const d = Math.min(...names.flatMap((n) => [editDistance(w, n), ...w.split(' ').map((x) => editDistance(x, n)), n.startsWith(w[0]!) ? editDistance(w.slice(0, n.length), n) + 1 : 99]));
      if (!best || d < best.d) best = { screen: t.screen, name: t.name, room, d };
    }
  }
  return best && best.d <= Math.max(2, Math.round(best.name.length / 3)) ? { screen: best.screen, name: best.name, room: best.room } : null;
}
