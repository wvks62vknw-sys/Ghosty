/**
 * DESIGN MY HOME on the phone, the pure part: the plan the brain's design_home drew from the owner's
 * words arrives whole as the `home_plan` command (packages/shared/src/protocol.ts `HomePlanEvent`:
 * every storey as Room JSON v2). Here it is checked — each storey must come into the planner with every
 * room, door, window and piece, or the plan is refused rather than shown with parts missing — and put
 * into words for SPACE's DESIGN MY HOME card and the plan card in the chat. No DOM, no storage: the
 * kept plan and the screens are in features/space/home.ts. Unit-tested in apps/edge/test/homeplan.test.mjs.
 */
import { polyArea } from '../../../../packages/shared/src/design';
import { roomToPlan } from './roomjson';
import type { Plan } from './plan';

export interface HomeStorey {
  name: string;
  /** The storey as it came (Room JSON v2), or as the owner last left it in the planner. */
  plan: Record<string, unknown>;
  rooms: number;
  /** Floor area in m² (one decimal). */
  m2: number;
}

/** The last plan drawn from the owner's words, as the phone keeps it. */
export interface KeptHome {
  /** When it arrived (ms); also what a chat card points at. */
  id: string;
  at: number;
  words: string;
  unit: 'metric' | 'imperial';
  storeys: HomeStorey[];
  assumed: string[];
  cannot: string[];
  rooms: number;
  m2: number;
}

const strings = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.slice(0, 1200)).slice(0, max) : []);
const one = (v: number) => Math.round(v * 10) / 10;

/** The floor area of a planner plan's rooms, in m². */
export function planM2(plan: Plan): number {
  return one((plan.rooms ?? []).reduce((a, r) => a + polyArea(r.poly), 0) / 10_000);
}

/**
 * The `home_plan` command's arguments, read and checked. Null when there is no storey, more than
 * three, or a storey the planner would not take whole (a room, door, window or piece dropped).
 */
export function readHomePlan(args: unknown, at = Date.now()): KeptHome | null {
  const a = (args ?? {}) as Record<string, unknown>;
  const raw = Array.isArray(a.storeys) ? a.storeys : [];
  if (!raw.length || raw.length > 3) return null;
  const storeys: HomeStorey[] = [];
  for (const [i, s] of raw.entries()) {
    const o = (s ?? {}) as { name?: unknown; plan?: unknown };
    const json = o.plan as { rooms?: unknown; openings?: unknown; items?: unknown } | undefined;
    if (!json || typeof json !== 'object' || !Array.isArray(json.rooms) || !json.rooms.length) return null;
    const plan = roomToPlan(json);
    const count = (v: unknown) => (Array.isArray(v) ? v.length : 0);
    if (!plan || (plan.rooms?.length ?? 0) !== count(json.rooms) || (plan.openings?.length ?? 0) !== count(json.openings) || plan.items.length !== count(json.items)) return null;
    storeys.push({ name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 40) : `Floor ${i + 1}`, plan: json as Record<string, unknown>, rooms: plan.rooms!.length, m2: planM2(plan) });
  }
  return {
    id: String(at),
    at,
    words: typeof a.words === 'string' ? a.words.slice(0, 4000) : '',
    unit: a.unit === 'imperial' ? 'imperial' : 'metric',
    storeys,
    assumed: strings(a.assumed, 60),
    cannot: strings(a.cannot, 30),
    rooms: storeys.reduce((n, s) => n + s.rooms, 0),
    m2: one(storeys.reduce((n, s) => n + s.m2, 0)),
  };
}

/** An area in the owner's unit (Settings): "55.8 m²" or "601 ft²". */
export function areaIn(m2: number, unit: 'metric' | 'imperial'): string {
  return unit === 'imperial' ? `${Math.round(m2 * 10.7639)} ft²` : `${one(m2)} m²`;
}

const roomsText = (n: number) => `${n} room${n === 1 ? '' : 's'}`;

/** SPACE's line over a drawn plan: "Drawn from your words · 6 rooms · 55.8 m²" (and "· 2 floors" for a house). */
export function homeLine(h: Pick<KeptHome, 'rooms' | 'm2' | 'storeys'>, unit: 'metric' | 'imperial'): string {
  return ['Drawn from your words', ...(h.storeys.length > 1 ? [`${h.storeys.length} floors`] : []), roomsText(h.rooms), areaIn(h.m2, unit)].join(' · ');
}

/** The chat card's line: "Your plan: 6 rooms, 55.8 m²". */
export function cardLine(rooms: number, m2: number, unit: 'metric' | 'imperial'): string {
  return `Your plan: ${roomsText(rooms)}, ${areaIn(m2, unit)}`;
}

/**
 * Whether the planner still holds this storey: most of its rooms are there by id (the owner may have renamed,
 * resized, added or removed a room since). A drawn plan's ids are the rooms' kinds ("hall1", "bed2"), the
 * planner's own "r1", "r2", so a plan the owner made or imported is never taken for it.
 */
export function holdsStorey(plan: Plan, storey: HomeStorey): boolean {
  const want = ((storey.plan.rooms as { id?: unknown }[]) ?? []).map((r) => String(r?.id));
  const have = new Set((plan.rooms ?? []).map((r) => r.id));
  return want.length > 0 && want.filter((id) => have.has(id)).length * 2 > want.length;
}

/**
 * The chat log in the order it is shown (features/core/homecard.ts): a plan card arrives while its tool
 * runs, before the reply, and is shown after that reply (the next reply before the owner says anything
 * else); with no reply yet it stays where it is.
 */
export function homeAfterReply<T extends { kind: string }>(entries: T[]): T[] {
  const out = [...entries];
  for (let i = 0; i < out.length; i++) {
    if (out[i]!.kind !== 'home') continue;
    let j = i + 1;
    while (j < out.length && out[j]!.kind !== 'assistant' && out[j]!.kind !== 'user' && out[j]!.kind !== 'home') j++;
    if (j >= out.length || out[j]!.kind !== 'assistant') continue;
    const [card] = out.splice(i, 1);
    out.splice(j, 0, card!);
    i = j;
  }
  return out;
}
