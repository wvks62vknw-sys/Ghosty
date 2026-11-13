/**
 * MATERIALS (FINAL ROUND, MAKE lane): what a room planner from a decorating company gives you under the plan — how much paint,
 * flooring, skirting and wallpaper the rooms on the plan take. Worked out from the plan itself (each room's floor, its walls at the
 * ceiling height, less its doors and windows), with the rules of thumb the UK's paint and flooring makers print on their tins and
 * boxes (public): emulsion covers about 12 m² a litre a coat and goes on in two coats; flooring is bought with 10% over for cuts;
 * a standard UK wallpaper roll is 10.05 m by 53 cm. Every number is a first estimate to shop with, never a quote. Pure, no DOM.
 */
import { polyArea, polyPerimeter, type Opening, type RoomShape } from '../../../../packages/shared/src/design';

/** The rules of thumb, said on the panel so he sees what the numbers rest on. */
export const RULES = {
  /** m² one litre of emulsion covers, one coat (tins say 12–14; the low end, so he is not a litre short). */
  paintM2PerLitre: 12,
  coats: 2,
  /** Flooring bought over the floor's area, for cuts and waste. */
  floorWaste: 0.1,
  /** A standard UK roll. */
  rollLength: 10.05,
  rollWidth: 0.53,
  /** Paint tins sold in the UK, litres, smallest first. */
  tins: [1, 2.5, 5] as const,
} as const;

export interface RoomMaterials {
  id: string;
  name: string;
  /** m² */
  floor: number;
  /** m², the walls less their doors and windows */
  walls: number;
  /** litres, both coats, walls and ceiling */
  paint: number;
  /** m² to buy, waste included */
  flooring: number;
  /** m, the walls' length less the doors */
  skirting: number;
  /** standard rolls */
  rolls: number;
}

export interface Materials {
  rooms: RoomMaterials[];
  total: Omit<RoomMaterials, 'id' | 'name'>;
  /** The tins that make up the paint, biggest first: "2 × 5 L + 1 × 2.5 L". */
  tins: string;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** The fewest tins (UK sizes) that hold at least `litres`, said plainly. */
export function tinsFor(litres: number): string {
  if (!(litres > 0)) return 'none';
  // the fewest litres over what is needed, then the fewest tins (every mix of 5 L, 2.5 L and 1 L tried)
  let best: [number, number, number] | null = null;
  let bestKey = Infinity;
  for (let a = 0; a <= Math.ceil(litres / 5); a++) {
    for (let b = 0; b <= 2; b++) {
      const c = Math.max(0, Math.ceil(litres - a * 5 - b * 2.5 - 1e-9));
      const total = a * 5 + b * 2.5 + c;
      const key = total * 100 + a + b + c;
      if (key < bestKey) {
        bestKey = key;
        best = [a, b, c];
      }
    }
  }
  const [a, b, c] = best!;
  return [[a, 5], [b, 2.5], [c, 1]].filter(([n]) => n! > 0).map(([n, s]) => `${n} × ${s} L`).join(' + ');
}

/** The materials for the rooms of a plan at ceiling height `hCm`, with its doors and windows. */
export function materialsFor(rooms: RoomShape[], openings: Opening[], hCm: number): Materials {
  const h = Math.max(0, hCm) / 100;
  const out: RoomMaterials[] = rooms.map((room) => {
    const floor = polyArea(room.poly) / 10000;
    const per = polyPerimeter(room.poly) / 100;
    const mine = openings.filter((o) => o.room === room.id);
    const holes = mine.reduce((s, o) => s + (Math.max(0, o.w) / 100) * (Math.min(Math.max(0, o.h), hCm) / 100), 0);
    const doors = mine.filter((o) => o.type === 'door').reduce((s, o) => s + Math.max(0, o.w) / 100, 0);
    const walls = Math.max(0, per * h - holes);
    const paint = ((walls + floor) * RULES.coats) / RULES.paintM2PerLitre;
    // wallpaper: whole drops cut from each roll (a drop is the wall's height and 10 cm to trim)
    const drops = Math.ceil(Math.max(0, per - doors) / RULES.rollWidth - 1e-9);
    const perRoll = h > 0 ? Math.max(1, Math.floor(RULES.rollLength / (h + 0.1))) : 0;
    const rolls = perRoll ? Math.ceil(drops / perRoll) : 0;
    return { id: room.id, name: room.name, floor: r1(floor), walls: r1(walls), paint: r1(paint), flooring: r1(floor * (1 + RULES.floorWaste)), skirting: r1(Math.max(0, per - doors)), rolls };
  });
  const sum = (k: keyof Omit<RoomMaterials, 'id' | 'name'>) => r1(out.reduce((s, r) => s + r[k], 0));
  const total = { floor: sum('floor'), walls: sum('walls'), paint: sum('paint'), flooring: sum('flooring'), skirting: sum('skirting'), rolls: out.reduce((s, r) => s + r.rolls, 0) };
  return { rooms: out, total, tins: tinsFor(total.paint) };
}

/** The panel's lines, in his words: one for the whole plan and one a room. */
export function materialsWords(m: Materials): { head: string; lines: string[] } {
  const t = m.total;
  if (!m.rooms.length || t.floor <= 0) return { head: 'Draw a room first and I’ll work out the paint and flooring for it.', lines: [] };
  const head = `Paint: about ${t.paint} L for two coats on the walls and ceilings (${m.tins}). Flooring: ${t.flooring} m² with 10% over for cuts. Skirting: ${t.skirting} m. Wallpaper: ${t.rolls} standard roll${t.rolls === 1 ? '' : 's'}.`;
  const lines = m.rooms.length > 1 ? m.rooms.map((r) => `${r.name}: floor ${r.floor} m², walls ${r.walls} m², paint ${r.paint} L, flooring ${r.flooring} m², skirting ${r.skirting} m, ${r.rolls} roll${r.rolls === 1 ? '' : 's'}.`) : [];
  return { head, lines };
}

/** The line under every materials answer: what it rests on, and that it is a first estimate. */
export const MATERIALS_NOTE = `A first estimate to shop with, never a quote: ${RULES.paintM2PerLitre} m² a litre a coat, ${RULES.coats} coats, ${RULES.floorWaste * 100}% more flooring for cuts, rolls of ${RULES.rollLength} m × ${RULES.rollWidth * 100} cm. Doors and windows are taken off the walls.`;
