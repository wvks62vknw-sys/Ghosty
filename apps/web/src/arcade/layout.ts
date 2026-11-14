/**
 * THE TOUCH LAYOUT (APPS ROUND): the big buttons under his right thumb moved to where his thumb rests, and made bigger or
 * smaller, kept per engine on this phone. Pure helpers for what is kept; the player (features/arcade/index.ts) does the
 * dragging and draws them.
 */

export const LAYOUT_KEY = 'ghosty.arcade.layout';

export interface Layout {
  /** Each button slot's move from where it starts, in CSS pixels. */
  moves: Record<string, [number, number]>;
  /** The buttons' size, 0.8 to 1.4 of the usual. */
  scale: number;
}

export const SCALES = [0.8, 1, 1.2, 1.4];

const blank = (): Layout => ({ moves: {}, scale: 1 });

export function layoutOf(engine: string): Layout {
  try {
    const all = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}');
    const v = all?.[engine];
    if (!v || typeof v !== 'object') return blank();
    const moves: Layout['moves'] = {};
    for (const [k, m] of Object.entries(v.moves ?? {})) if (Array.isArray(m) && m.length === 2 && m.every((n) => Number.isFinite(n))) moves[k] = [m[0], m[1]];
    return { moves, scale: SCALES.includes(v.scale) ? v.scale : 1 };
  } catch {
    return blank();
  }
}

export function saveLayout(engine: string, l: Layout | null): void {
  try {
    const all = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? '{}') ?? {};
    if (l) all[engine] = l;
    else delete all[engine];
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(all));
  } catch {
    /* this visit only */
  }
}

/** A move kept on the screen: a button's centre stays inside the screen with a margin. */
export function clampMove(dx: number, dy: number, centre: [number, number], view: [number, number], margin = 30): [number, number] {
  const x = Math.max(margin, Math.min(view[0] - margin, centre[0] + dx));
  const y = Math.max(margin, Math.min(view[1] - margin, centre[1] + dy));
  return [Math.round(x - centre[0]), Math.round(y - centre[1])];
}

/** The next size along (wrapping round). */
export const nextScale = (s: number): number => SCALES[(SCALES.indexOf(s) + 1) % SCALES.length] ?? 1;
