/**
 * DESIGN REVIEW: `design_review` looks at the owner's room plan (Room JSON v2 from the SPACE
 * PLANNER, packages/shared/src/design.ts) and/or a description of a photo, against their goal
 * ("make it feel bigger", "a home office"), and hands the model grounded findings to advise from:
 * the plan's own measurements, the UK guidance each one is checked against (with the source
 * named — Approved Documents B, F, K and M on GOV.UK, the kitchen work triangle), what the library
 * holds on it, and up to three concrete changes worked out here (not by the model) and checked —
 * sent to the phone as a `design_changes` client event, where SPACE shows BEFORE and AFTER.
 *
 * The plan reaches the brain from the phone just before the chat message (POST /api/design/plan,
 * kept in memory only — nothing is written), or in the call's own `plan`. Everything is advice,
 * never sign-off: structural work and anything under building regulations goes to Building
 * Control. No AI here, no outbound requests.
 */
import { areaText, changeProblem, describeRooms, designProblems, doorSwing, facing, inSwing, itemRect, openFloor, openingProblem, openingSpan, polyArea, readDesign, rectInRooms, toRoomJson, type DesignPlan, type Opening, type PlanItem, type Rect } from '../../../../packages/shared/src/design';
import { asData } from '../kernel/permissions';
import { formatHits, Library } from '../library/store';
import { arg, clip, type Tool } from './types';

/** The UK guidance the review checks against, each with where it is written (GOV.UK pages checked by hand). */
export const SOURCES = {
  B: { name: 'Approved Document B (fire safety) volume 1, para 2.10', url: 'https://www.gov.uk/government/publications/fire-safety-approved-document-b' },
  F: { name: 'Approved Document F (ventilation) volume 1, Table 1.4', url: 'https://www.gov.uk/government/publications/ventilation-approved-document-f' },
  K: { name: 'Approved Document K, Table 1.1 and para 1.11', url: 'https://www.gov.uk/government/publications/protection-from-falling-collision-and-impact-approved-document-k' },
  M1: { name: 'Approved Document M volume 1, M4(1) Table 1.1', url: 'https://www.gov.uk/government/publications/access-to-and-use-of-buildings-approved-document-m' },
  M2: { name: 'Approved Document M volume 1, M4(2) paras 2.24–2.25', url: 'https://www.gov.uk/government/publications/access-to-and-use-of-buildings-approved-document-m' },
  approval: { name: 'GOV.UK: Building regulations approval', url: 'https://www.gov.uk/building-regulations-approval' },
  party: { name: 'GOV.UK: Party walls and building work', url: 'https://www.gov.uk/party-walls-building-works' },
  planning: { name: 'GOV.UK: Planning permission', url: 'https://www.gov.uk/planning-permission-england-wales' },
  triangle: { name: 'Wikipedia: Kitchen work triangle', url: 'https://en.wikipedia.org/wiki/Kitchen_work_triangle' },
} as const;
type SourceId = keyof typeof SOURCES;

/** The everyday rules of thumb the planner already uses (not regulations): a walkway, the space to open a wardrobe. */
export const WALKWAY_CM = 70;
export const WARDROBE_FRONT_CM = 60;

export interface Finding {
  topic: string;
  text: string;
  source?: SourceId;
}

export interface Change {
  title: string;
  why: string;
  plan: Record<string, unknown>;
}

// ------------------------------------------------------------------ the plan from the phone

/** The plan the phone sent with the owner's last design question (memory only; gone after 30 minutes or a restart). */
let sent: { plan: unknown; at: number } | null = null;
const SENT_TTL_MS = 30 * 60_000;
const MAX_PLAN_CHARS = 60_000;

export function keepSentPlan(plan: unknown, now = Date.now()): void {
  sent = plan === null ? null : { plan, at: now };
}
export function sentPlan(now = Date.now()): unknown {
  return sent && now - sent.at < SENT_TTL_MS ? sent.plan : null;
}

/** POST /api/design/plan {plan}: the SPACE PLANNER's plan for the next design_review (kept in memory, never stored). */
export async function designRoute(req: Request, method: string): Promise<Response> {
  const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
  if (method !== 'POST') return json({ error: 'POST a plan' }, 405);
  const text = await req.text();
  if (text.length > MAX_PLAN_CHARS) return json({ error: 'that plan is too big' }, 413);
  let body: { plan?: unknown };
  try {
    body = JSON.parse(text) as { plan?: unknown };
  } catch {
    return json({ error: 'not JSON' }, 400);
  }
  const p = readDesign(body.plan);
  if (!p) return json({ error: 'that is not a room plan' }, 400);
  keepSentPlan(body.plan);
  return json({ ok: true, rooms: p.rooms.length, openings: p.openings.length, items: p.items.length });
}

// ------------------------------------------------------------------ geometry on the plan

const overlaps = (a: Rect, b: Rect, pad = 0) => a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
const quarter = (rot = 0) => ((Math.round(rot / 90) % 4) + 4) % 4;
const m = (cm: number) => `${(cm / 100).toFixed(2).replace(/\.?0+$/, '')} m`;
const name = (it: PlanItem) => it.name.replace(/^(Sofa|Bed|Dining table|Wardrobe), /, '$1 ');

/** The strip of floor in front of a piece (its back is against the wall it faces away from). */
export function frontStrip(r: Rect, rot: number | undefined, depth: number): Rect {
  const q = quarter(rot);
  if (q === 0) return { x: r.x, y: r.y + r.h, w: r.w, h: depth };
  if (q === 1) return { x: r.x - depth, y: r.y, w: depth, h: r.h };
  if (q === 2) return { x: r.x, y: r.y - depth, w: r.w, h: depth };
  return { x: r.x + r.w, y: r.y, w: depth, h: r.h };
}

/** The strips of floor either side of a piece (a bed's sides). */
export function sideStrips(r: Rect, rot: number | undefined, depth: number): [Rect, Rect] {
  return quarter(rot) % 2 === 0
    ? [
        { x: r.x - depth, y: r.y, w: depth, h: r.h },
        { x: r.x + r.w, y: r.y, w: depth, h: r.h },
      ]
    : [
        { x: r.x, y: r.y - depth, w: r.w, h: depth },
        { x: r.x, y: r.y + r.h, w: r.w, h: depth },
      ];
}

/** Is this strip of floor clear: inside a room and under no other piece? */
function clear(p: DesignPlan, strip: Rect, except: number): boolean {
  return rectInRooms(p.rooms, strip) && !p.items.some((it, j) => j !== except && overlaps(itemRect(it), strip, -0.5));
}

const is = {
  bed: (it: PlanItem) => /^(single|double|king)$/.test(it.kind ?? '') || /\bbed\b/i.test(it.name),
  double: (it: PlanItem) => /^(double|king)$/.test(it.kind ?? '') || /\b(double|king|queen)\b/i.test(it.name),
  wardrobe: (it: PlanItem) => it.kind === 'wardrobe' || /\b(wardrobe|drawers|dresser)\b/i.test(it.name),
  desk: (it: PlanItem) => it.kind === 'desk' || /\bdesk\b/i.test(it.name),
  sink: (it: PlanItem) => it.kind === 'sink' || /\bsink\b/i.test(it.name),
  hob: (it: PlanItem) => it.kind === 'hob' || /\b(hob|cooker|stove|oven|range)\b/i.test(it.name),
  fridge: (it: PlanItem) => it.kind === 'fridge' || /\b(fridge|refrigerator|freezer)\b/i.test(it.name),
};

/** Pairs of pieces facing each other closer than a walkway (and not touching). */
function tightPairs(p: DesignPlan): { a: number; b: number; cm: number }[] {
  const out: { a: number; b: number; cm: number }[] = [];
  const rs = p.items.map(itemRect);
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i]!;
      const b = rs[j]!;
      const yShare = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      const xShare = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const gx = yShare >= 30 ? Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w)) : -1;
      const gy = xShare >= 30 ? Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)) : -1;
      for (const g of [gx, gy]) if (g > 0.5 && g < WALKWAY_CM) out.push({ a: i, b: j, cm: Math.round(g) });
    }
  }
  return out;
}

const windowArea = (o: Opening) => o.w * o.h;

/** Pieces standing close in front of a window and taller than its sill (they block its light). */
function blocksWindow(p: DesignPlan, it: PlanItem): Opening | null {
  const r = itemRect(it);
  for (const o of p.openings) {
    if (o.type !== 'window' || (it.h ?? 75) < o.sill) continue;
    const room = p.rooms.find((x) => x.id === o.room);
    if (!room) continue;
    const { p0, p1, edge } = openingSpan(room, o);
    const zone: Rect = { x: Math.min(p0[0], p1[0], p0[0] - edge.nx * 40, p1[0] - edge.nx * 40), y: Math.min(p0[1], p1[1], p0[1] - edge.ny * 40, p1[1] - edge.ny * 40), w: 0, h: 0 };
    zone.w = Math.max(p0[0], p1[0], p0[0] - edge.nx * 40, p1[0] - edge.nx * 40) - zone.x;
    zone.h = Math.max(p0[1], p1[1], p0[1] - edge.ny * 40, p1[1] - edge.ny * 40) - zone.y;
    if (overlaps(zone, r, -1)) return o;
  }
  return null;
}

// ------------------------------------------------------------------ finding a new place for a piece

/** Where a piece could go instead: in a room, clear of others by a walkway, out of door swings and windows; nearest first, against a wall when `wall`. */
export function relocate(p: DesignPlan, i: number, opts: { wall?: boolean; near?: [number, number]; keep?: number } = {}): PlanItem | null {
  const it = p.items[i]!;
  const others = p.items.filter((_, j) => j !== i).map(itemRect);
  const keep = opts.keep ?? WALKWAY_CM;
  const step = 10;
  let best: { it: PlanItem; score: number } | null = null;
  for (const rot of [it.rot ?? 0, (it.rot ?? 0) + 90].map((r) => quarter(r) * 90)) {
    const side = quarter(rot) % 2 === 1;
    const fw = side ? it.d : it.w;
    const fh = side ? it.w : it.d;
    for (let y = 0; y + fh <= p.room.d + 0.01; y += step) {
      for (let x = 0; x + fw <= p.room.w + 0.01; x += step) {
        const r: Rect = { x, y, w: fw, h: fh };
        if (!rectInRooms(p.rooms, r)) continue;
        if (others.some((o) => overlaps(r, o, keep - 0.5))) continue;
        if (p.openings.some((o) => {
          const room = p.rooms.find((q) => q.id === o.room);
          return !!room && inSwing(room, o, r);
        })) continue;
        // the unturned corner of a rectangle turned about its centre
        const cand: PlanItem = { ...it, rot, x: x + fw / 2 - it.w / 2, y: y + fh / 2 - it.d / 2 };
        if (blocksWindow(p, cand)) continue;
        const touching = !rectInRooms(p.rooms, { x: x - 2, y, w: fw + 4, h: fh }) || !rectInRooms(p.rooms, { x, y: y - 2, w: fw, h: fh + 4 });
        if (opts.wall && !touching) continue;
        const target = opts.near ?? [itemRect(it).x + itemRect(it).w / 2, itemRect(it).y + itemRect(it).h / 2];
        const score = Math.hypot(x + fw / 2 - target[0], y + fh / 2 - target[1]) + (rot === (it.rot ?? 0) ? 0 : 25);
        if (!best || score < best.score) best = { it: cand, score };
      }
    }
  }
  return best?.it ?? null;
}

const withItem = (p: DesignPlan, i: number, it: PlanItem): DesignPlan => ({ ...p, items: p.items.map((x, j) => (j === i ? it : x)) });
const withOpening = (p: DesignPlan, id: string, patch: Partial<Opening>): DesignPlan => ({ ...p, openings: p.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) });

// ------------------------------------------------------------------ the review

const GOALS = {
  bigger: /\b(bigger|larger|spacious|space|open|cramped|small|tiny|clutter\w*|airy|roomier)\b/i,
  office: /\b(office|work(?:ing)? from home|wfh|study|desk|workspace)\b/i,
  light: /\b(light|lighter|bright\w*|dark|sun\w*|daylight|gloomy)\b/i,
  access: /\b(access\w*|wheelchair|mobility|elderly|older|safe\w*|trip|disab\w*)\b/i,
  structural: /\b(knock(?:ing)? (?:through|down)|remove (?:a |the )?wall|load[- ]bearing|structural|steel|rsj|beam|open[- ]plan|extension|extend|conservatory|garage conversion)\b/i,
  loft: /\b(loft|attic|stairs?|staircase|dormer)\b/i,
};

/**
 * The review of one plan for one goal: the facts, what the plan does against the guidance (each
 * with its source), and up to three concrete changes — each a whole plan, checked to add no
 * problem the owner's plan does not already have.
 */
export function reviewDesign(p: DesignPlan, goal: string): { facts: string[]; findings: Finding[]; changes: Change[] } {
  const facts: string[] = [];
  const findings: Finding[] = [];
  const floor = p.rooms.reduce((s, r) => s + polyArea(r.poly), 0);
  facts.push(...describeRooms(p));
  if (p.rooms.length > 1) facts.push(`Total floor ${areaText(floor)}`);
  const covered = p.items.reduce((s, it) => s + it.w * it.d, 0);
  const open = openFloor(p);
  facts.push(`${p.items.length} piece${p.items.length === 1 ? '' : 's'} of furniture covering ${Math.round((covered / Math.max(1, floor)) * 100)}% of the floor; the biggest open floor is ${m(open.w)} × ${m(open.h)}`);

  // furniture: walkways, wardrobes, beds, the kitchen triangle
  for (const g of tightPairs(p)) findings.push({ topic: 'walkway', text: `${name(p.items[g.a]!)} and ${name(p.items[g.b]!)} are ${g.cm} cm apart — under the ${WALKWAY_CM} cm people need to walk between furniture (a rule of thumb; 90 cm for a main route).` });
  p.items.forEach((it, i) => {
    const r = itemRect(it);
    if (is.wardrobe(it) && !clear(p, frontStrip(r, it.rot, WARDROBE_FRONT_CM), i)) findings.push({ topic: 'wardrobe', text: `${name(it)} has less than ${WARDROBE_FRONT_CM} cm clear in front of it to open the doors and stand (a rule of thumb).` });
    if (is.bed(it)) {
      const [s1, s2] = sideStrips(r, it.rot, 75);
      const foot = clear(p, frontStrip(r, it.rot, 75), i);
      const sides = [clear(p, s1, i), clear(p, s2, i)].filter(Boolean).length;
      const need = is.double(it) ? 2 : 1;
      if (sides < need || (is.double(it) && !foot)) findings.push({ topic: 'bed', text: `${name(it)}: ${sides} side${sides === 1 ? '' : 's'}${is.double(it) ? ` and ${foot ? 'the foot' : 'not the foot'}` : ''} with 75 cm clear. The accessible-home standard asks for 750 mm to both sides and the foot of the main double bed (one side and the foot for other doubles, one side of a single).`, source: 'M2' });
    }
    const w = blocksWindow(p, it);
    if (w) findings.push({ topic: 'light', text: `${name(it)} stands in front of a window and is taller than its ${w.sill} cm sill, so it blocks light.` });
  });
  const sink = p.items.find(is.sink);
  const hob = p.items.find(is.hob);
  const fridge = p.items.find(is.fridge);
  if (sink && hob && fridge) {
    const c = (it: PlanItem) => {
      const r = itemRect(it);
      return [r.x + r.w / 2, r.y + r.h / 2] as const;
    };
    const legs = [
      [sink, hob],
      [hob, fridge],
      [fridge, sink],
    ].map(([a, b]) => Math.hypot(c(a!)[0] - c(b!)[0], c(a!)[1] - c(b!)[1]));
    const sum = legs.reduce((s, l) => s + l, 0);
    const bad = legs.some((l) => l < 120 || l > 275) || sum < 400 || sum > 790;
    findings.push({ topic: 'kitchen', text: `Kitchen work triangle: sink–hob ${m(legs[0]!)}, hob–fridge ${m(legs[1]!)}, fridge–sink ${m(legs[2]!)}, ${m(sum)} in all${bad ? ' — outside the usual guide of 1.2–2.7 m a side and 4–7.9 m in all' : ' — within the usual guide (1.2–2.7 m a side, 4–7.9 m in all)'}.`, source: 'triangle' });
  }

  // doors
  for (const o of p.openings.filter((x) => x.type === 'door')) {
    const room = p.rooms.find((r) => r.id === o.room)!;
    if (o.w < 77.5) findings.push({ topic: 'door', text: `Door ${o.id} in ${room.name} is ${o.w} cm wide. For a new home, Part M asks for a clear opening of 775 mm off a corridor that is not approached head-on (750 mm is enough with a 900 mm corridor approached head-on).`, source: 'M1' });
    const blocked = p.items.filter((it) => inSwing(room, o, itemRect(it)));
    if (blocked.length) findings.push({ topic: 'door', text: `${blocked.map(name).join(' and ')} ${blocked.length > 1 ? 'are' : 'is'} where door ${o.id} in ${room.name} swings: it cannot open fully.` });
  }

  // windows: purge ventilation, escape, which way they face
  for (const room of p.rooms) {
    const wins = p.openings.filter((o) => o.room === room.id && o.type === 'window');
    const area = polyArea(room.poly);
    const glazed = wins.reduce((s, o) => s + windowArea(o), 0);
    if (!wins.length) findings.push({ topic: 'light', text: `${room.name} has no window on the plan. A habitable room needs purge ventilation — openable windows of at least 1/20 of its floor area, or a mechanical system.`, source: 'F' });
    else {
      const dirs = [...new Set(wins.map((o) => facing(room, o, p.north)))].join(', ');
      findings.push({ topic: 'light', text: `${room.name}: ${wins.length} window${wins.length > 1 ? 's' : ''} facing ${dirs}${p.north ? '' : ' (taking the top of the plan as north)'}, ${(glazed / 10000).toFixed(2)} m² of window for ${(area / 10000).toFixed(1)} m² of floor.${glazed < area / 20 ? ' Even fully open that is under the 1/20 of the floor area purge ventilation asks for (windows opening 30° or more).' : ' Purge ventilation asks for openable area of at least 1/20 of the floor (windows opening 30° or more): check how far they open.'}`, source: 'F' });
      if (/\bbed/i.test(room.name)) {
        const escape = wins.some((o) => o.w >= 45 && o.h >= 45 && o.w * o.h >= 3300 && o.sill <= 110);
        findings.push({ topic: 'escape', text: escape ? `${room.name} has a window big enough and low enough to be an escape window (if its OPENABLE part is at least 0.33 m², 450 mm each way, its bottom at most 1100 mm above the floor) — needed for bedrooms upstairs and in loft conversions.` : `${room.name} has no window that could serve as an escape window (openable part at least 0.33 m² and 450 mm each way, bottom at most 1100 mm above the floor) — needed for bedrooms upstairs and in loft conversions.`, source: 'B' });
      }
    }
  }
  const problems = designProblems(p).filter((x) => !/where the door/.test(x));
  for (const x of problems.slice(0, 4)) findings.push({ topic: 'clash', text: `${x}.` });

  // building regulations in plain words, for what the goal touches
  if (GOALS.structural.test(goal)) {
    findings.push({ topic: 'regs', text: 'Taking out or altering a wall that holds the building up is structural work: it needs building regulations approval (Building Control) and usually a structural engineer\'s calculations for the beam. Shared walls with a neighbour can bring in the Party Wall etc. Act 1996.', source: 'approval' });
    findings.push({ topic: 'regs', text: 'Extensions and conversions may also need planning permission (many fall under permitted development).', source: 'planning' });
  }
  if (GOALS.loft.test(goal)) findings.push({ topic: 'regs', text: 'Stairs in a home: each rise at most 220 mm, each going at least 220 mm, no steeper than 42°, and 2 m of headroom (less is allowed in a loft conversion).', source: 'K' });
  if (GOALS.access.test(goal)) findings.push({ topic: 'regs', text: 'Accessible homes: 1200 mm clear in front of kitchen units, a 750 mm route from a bedroom door to its window, and main-window glazing starting no higher than 850 mm in the living room.', source: 'M2' });

  return { facts, findings, changes: proposeChanges(p, goal) };
}

/** Up to three concrete changes, each a whole plan that adds no problem. */
export function proposeChanges(p: DesignPlan, goal: string): Change[] {
  const out: Change[] = [];
  const before = toRoomJson(p);
  // Each change moves different pieces, so the owner can take any of them.
  const touched = new Set<number>();
  const push = (title: string, why: string, next: DesignPlan) => {
    if (out.length >= 3 || out.some((c) => c.title === title)) return;
    const moved = next.items.map((it, i) => i).filter((i) => i >= p.items.length || JSON.stringify(next.items[i]) !== JSON.stringify(p.items[i]));
    if (moved.some((i) => touched.has(i))) return;
    const plan = toRoomJson(next);
    if (changeProblem(before, plan)) return;
    for (const i of moved) touched.add(i);
    out.push({ title, why, plan });
  };
  // 1. doors that cannot open: hang them the other way, or move what is in the way
  for (const o of p.openings.filter((x) => x.type === 'door')) {
    const room = p.rooms.find((r) => r.id === o.room)!;
    const inWay = p.items.map((it, i) => ({ it, i })).filter(({ it }) => inSwing(room, o, itemRect(it)));
    if (!inWay.length) continue;
    const flip = withOpening(p, o.id, { hinge: o.hinge === 'start' ? 'end' : 'start' });
    const outward = withOpening(p, o.id, { swing: o.swing === 'in' ? 'out' : 'in' });
    const clearOf = (q: DesignPlan) => !q.items.some((it) => inSwing(room, q.openings.find((x) => x.id === o.id)!, itemRect(it)));
    if (clearOf(flip)) push(`Hang door ${o.id} from its other side`, `${inWay.map(({ it }) => name(it)).join(' and ')} stop${inWay.length > 1 ? '' : 's'} it opening fully; hinged on the other side it swings clear.`, flip);
    else if (clearOf(outward) && doorSwing(room, { ...o, swing: 'out' })) push(`Make door ${o.id} open the other way`, `${inWay.map(({ it }) => name(it)).join(' and ')} stop${inWay.length > 1 ? '' : 's'} it opening fully.`, outward);
    else {
      let q = p;
      for (const { i } of inWay) {
        const moved = relocate(q, i);
        if (moved) q = withItem(q, i, moved);
      }
      if (q !== p) push(`Move ${inWay.map(({ it }) => name(it)).join(' and ')} out of the door's way`, `Door ${o.id} cannot open fully as things stand.`, q);
    }
  }
  // 2. what the owner asked for
  const goalChange = () => {
    if (GOALS.office.test(goal)) {
      const win = p.openings.find((o) => o.type === 'window');
      const room = win && p.rooms.find((r) => r.id === win.room);
      const near = room && win ? (openingSpan(room, win).mid as [number, number]) : undefined;
      const di = p.items.findIndex(is.desk);
      if (di >= 0) {
        const moved = relocate(p, di, { wall: true, near, keep: 60 });
        if (moved) push('Move the desk to the window', 'Daylight from the side is the kindest light to work by, and the desk stays against a wall.', withItem(p, di, moved));
      } else {
        const desk: PlanItem = { id: `desk${p.items.length + 1}`, kind: 'desk', name: 'Desk', w: 120, d: 60, h: 75, x: 0, y: 0, rot: 0 };
        const q: DesignPlan = { ...p, items: [...p.items, desk] };
        const placed = relocate(q, q.items.length - 1, { wall: true, near, keep: 60 });
        if (placed) push('Add a 120 × 60 cm desk by the window', 'A home office needs a proper desk; by a window it gets daylight, against a wall it keeps the floor open.', withItem(q, q.items.length - 1, placed));
      }
    }
    if (GOALS.light.test(goal)) {
      p.items.forEach((it, i) => {
        if (!blocksWindow(p, it)) return;
        const moved = relocate(p, i, { wall: true });
        if (moved) push(`Move ${name(it)} away from the window`, 'It blocks the window\'s light where it stands.', withItem(p, i, moved));
      });
    }
    if (GOALS.access.test(goal)) {
      for (const o of p.openings.filter((x) => x.type === 'door' && x.w < 80)) {
        const room = p.rooms.find((r) => r.id === o.room);
        const wider = { ...o, w: 80, at: Math.max(5, o.at - (80 - o.w) / 2) };
        if (room && !openingProblem(room, wider, p.openings, p.h)) push(`Widen door ${o.id} to 80 cm`, `At ${o.w} cm it is narrower than the 775 mm clear opening Part M asks of a new home.`, withOpening(p, o.id, wider));
      }
    }
    if (GOALS.bigger.test(goal) || out.length === 0) {
      // The biggest piece standing away from every wall, pushed against the nearest one.
      const now = openFloor(p).area;
      const order = p.items.map((it, i) => ({ it, i })).sort((a, b) => b.it.w * b.it.d - a.it.w * a.it.d);
      for (const { it, i } of order) {
        const moved = relocate(p, i, { wall: true });
        if (!moved || (moved.x === it.x && moved.y === it.y && moved.rot === it.rot)) continue;
        const q = withItem(p, i, moved);
        const gain = openFloor(q).area - now;
        if (gain >= 2500) {
          push(`Put ${name(it)} against the wall`, `It frees ${(gain / 10000).toFixed(1)} m² more open floor in one piece (${m(openFloor(q).w)} × ${m(openFloor(q).h)}): open floor is what makes a room feel bigger.`, q);
          break;
        }
      }
    }
  };
  goalChange();
  // 3. tight walkways and wardrobes that cannot open: move the smaller piece
  for (const g of tightPairs(p)) {
    const [i, j] = [g.a, g.b].sort((x, y) => p.items[x]!.w * p.items[x]!.d - p.items[y]!.w * p.items[y]!.d);
    const moved = relocate(p, i!);
    if (moved) push(`Move ${name(p.items[i!]!)} to give a ${WALKWAY_CM} cm walkway`, `It is ${g.cm} cm from ${name(p.items[j!]!)} now.`, withItem(p, i!, moved));
  }
  p.items.forEach((it, i) => {
    if (is.wardrobe(it) && !clear(p, frontStrip(itemRect(it), it.rot, WARDROBE_FRONT_CM), i)) {
      const moved = relocate(p, i, { wall: true });
      if (moved) push(`Move ${name(it)} where its doors can open`, `It needs ${WARDROBE_FRONT_CM} cm clear in front.`, withItem(p, i, moved));
    }
  });
  return out;
}

/** The review as text for the model: facts and findings marked as the owner's data, the sources, the changes, the library. */
export function reviewText(goal: string, review: { facts: string[]; findings: Finding[]; changes: Change[] } | null, photo: string, library: string): string {
  const cited = new Set<SourceId>();
  const lines: string[] = [`DESIGN REVIEW for: ${goal || 'a better room'}`];
  if (review) {
    // The names in a plan are whatever was typed or imported: the whole measured block is data.
    const ids = Object.keys(SOURCES) as SourceId[];
    const body = [...review.facts, 'FINDINGS (measured on the plan; [n] is the source):'];
    for (const f of review.findings) {
      if (f.source) cited.add(f.source);
      body.push(`- ${f.text}${f.source ? ` [${ids.indexOf(f.source) + 1}]` : ''}`);
    }
    if (!review.findings.length) body.push('- Nothing the plan breaks: walkways, door swings and windows all check out.');
    body.push(review.changes.length ? `CHANGES SENT TO THE PHONE (SPACE shows each BEFORE and AFTER; the owner taps APPLY): ${review.changes.map((c, i) => `${i + 1}. ${c.title} — ${c.why}`).join(' ')}` : 'No change to suggest on the plan itself.');
    lines.push(asData("the owner's room plan (measured on the phone)", body.join('\n')));
  }
  if (photo) lines.push(asData("the owner's description of a photo of the room", photo));
  lines.push(library);
  cited.add('approval');
  const ids = Object.keys(SOURCES) as SourceId[];
  lines.push(`SOURCES: ${[...cited].map((id) => `[${ids.indexOf(id) + 1}] ${SOURCES[id].name} — ${SOURCES[id].url}`).join('; ')}`);
  lines.push('Now write the owner a short, warm review for their goal: the 2–4 things that matter most (with the numbers), the changes on their phone, and the sources by name. It is guidance, not approval: for structural work, or anything under building regulations, say plainly to check with Building Control (and a structural engineer for walls and beams).');
  return lines.join('\n');
}

export const designTools: Tool[] = [
  {
    name: 'design_review',
    description:
      "Review the owner's room design for a goal (\"feel bigger\", \"home office\"): uses the SPACE PLANNER plan the phone sent (or `plan`, Room JSON) and/or `photo` (a description). Returns measured findings against UK guidance with sources, library notes, and sends up to 3 checked changes to the phone (SPACE shows BEFORE/AFTER). Advice only, never approval.",
    parameters: {
      type: 'object',
      properties: {
        goal: { type: 'string', description: 'what the owner wants, in their words' },
        plan: { type: 'object', description: 'Room JSON, only if the owner pasted one' },
        photo: { type: 'string', description: 'what a photo of the room shows, when there is one' },
      },
      required: ['goal'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const goal = arg.str(a, 'goal').slice(0, 200);
      const photo = arg.str(a, 'photo', false).slice(0, 1500);
      const raw = a.plan && typeof a.plan === 'object' ? a.plan : typeof a.plan === 'string' && a.plan.trim().startsWith('{') ? a.plan : sentPlan();
      const plan = raw ? readDesign(raw) : null;
      if (!plan && !photo) throw new Error('no plan to review: ask the owner to open SPACE and press REVIEW (it sends the plan), or describe the room or a photo of it');
      const review = plan ? reviewDesign(plan, goal) : null;
      if (plan && review?.changes.length) ctx.emit({ t: 'client', name: 'design_changes', args: { goal, before: toRoomJson(plan), options: review.changes } });
      let library = 'LIBRARY: nothing on this yet (the study field "Architecture, interior design and UK building regulations" fills it over time).';
      try {
        const l = new Library(ctx.storage, ctx.env);
        if (l.available) {
          const hits = await l.search(`${goal} interior design room layout clearance building regulations`, 4);
          if (hits.length) library = `LIBRARY (cite by title):\n${asData('your library', formatHits(hits, 2500))}`;
        }
      } catch {
        /* the library is optional here: a paused database must not stop the review */
      }
      return clip(reviewText(goal, review, photo, library), 9000);
    },
  },
];
