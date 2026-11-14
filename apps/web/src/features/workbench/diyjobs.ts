/**
 * THE DIY JOB PLANNER (NEXT ROUND, make.s3): from "put up a shelf" to the tools, the materials, the steps and a first-estimate
 * load check, the way a DIY app walks you through a job. Four everyday jobs: a shelf, a TV on the wall, a curtain pole and a
 * picture or mirror. The load check is the Workbench's own: a shelf board and a curtain pole are beams (the same solver, the
 * same card, the same curve); a fixing's share of the weight is said with a margin of two, to set against what its own packet
 * says it holds. Prices come from Design a build's table where it has a line, each "typical, not a quote". Every number is a
 * first estimate, never certified; nothing here is a fitter's or an engineer's sign-off. Pure: the panel is diy.ts.
 */
import { solve, type Estimate } from '../../../../../packages/shared/src/workbench';
import { PRICES } from '../../build/prices';

export type JobId = 'shelf' | 'tv' | 'pole' | 'picture';
export type Wall = 'masonry' | 'plasterboard' | 'stud';
export const G = 9.80665;

export interface JobIn {
  /** m (shelf, pole). */
  length?: number;
  /** mm (shelf). */
  depth?: number;
  /** mm: a shelf's thickness, a pole's diameter. */
  thick?: number;
  /** Brackets (shelf, pole) or hooks (picture). */
  count?: number;
  /** kg: a shelf's load per metre; the TV, the curtains or the picture's weight. */
  kg?: number;
  wall?: Wall;
}

export interface JobPlan {
  id: JobId;
  title: string;
  tools: string[];
  materials: { what: string; qty: string; gbp?: number }[];
  steps: string[];
  /** The board or pole as a beam (shelf, pole). */
  beam: { estimate: Estimate; raw: Record<string, unknown> } | null;
  /** Each fixing's share with a margin of two (kg), and what it should be rated for. */
  fixing: { lines: { label: string; value: string }[]; perFixingKg: number };
  /** What was taken without his saying. */
  assumed: string[];
}

export const JOBS: { id: JobId; label: string; defaults: Required<JobIn> }[] = [
  { id: 'shelf', label: 'A SHELF', defaults: { length: 0.9, depth: 200, thick: 18, count: 2, kg: 25, wall: 'masonry' } },
  { id: 'tv', label: 'A TV ON THE WALL', defaults: { length: 0, depth: 0, thick: 0, count: 4, kg: 15, wall: 'masonry' } },
  { id: 'pole', label: 'A CURTAIN POLE', defaults: { length: 1.8, depth: 0, thick: 28, count: 2, kg: 6, wall: 'masonry' } },
  { id: 'picture', label: 'A PICTURE OR MIRROR', defaults: { length: 0, depth: 0, thick: 0, count: 2, kg: 8, wall: 'plasterboard' } },
];

/** "put up a shelf", "mount my tv", "hang a mirror", "fit a curtain pole", "diy planner" → the job (null: not one of these). */
export function diyAsked(text: string): { job: JobId | null } | null {
  const s = String(text ?? '').toLowerCase().trim().replace(/[.!?]+$/, '').replace(/^(?:please |ghosty,? |hey ghosty,? )/, '').replace(/^(?:how (?:do i|to|would i|should i)|help me|i want to|i need to|i'm going to|im going to|plan(?: how to)?)\s+/, '');
  if (s.length > 80) return null;
  if (/^(?:the |a |my )?diy(?: job)?(?: planner| jobs?| helper)?$/.test(s)) return { job: null };
  const m = /^(?:put up|fit|fix|mount|hang|install|wall[- ]mount|attach)\s+(?:up\s+)?(?:a |an |the |my |some )?(.+?)(?: on (?:the|a|my) wall| to (?:the|a|my) wall| up)?$/.exec(s);
  if (!m) return null;
  const what = m[1]!;
  if (/^(?:floating )?shel(?:f|ves)$|^bookshel(?:f|ves)$/.test(what)) return { job: 'shelf' };
  if (/^(?:tv|telly|television)(?: bracket)?$/.test(what)) return { job: 'tv' };
  if (/^curtain (?:pole|rail)s?$/.test(what)) return { job: 'pole' };
  if (/^(?:picture|mirror|painting|frame|photo frame)s?$/.test(what)) return { job: 'picture' };
  return null;
}

const WALL_WORDS: Record<Wall, string> = { masonry: 'brick or block', plasterboard: 'plasterboard on its own', stud: 'plasterboard on wooden studs' };
const fixingsFor = (w: Wall) =>
  w === 'masonry' ? 'Brown wall plugs (7 mm) and 50 mm screws' : w === 'stud' ? '50 mm wood screws, straight into the studs' : 'Metal cavity fixings (spring toggles or hollow-wall anchors)';
const toolsFor = (w: Wall) => [
  'A spirit level, a pencil and a tape measure',
  w === 'masonry' ? 'A drill with a 7 mm masonry bit' : w === 'stud' ? 'A drill, a stud finder and a 3 mm wood bit for pilot holes' : 'A drill and the bit size the cavity fixing’s packet says',
  'A screwdriver or drill-driver',
  'A cable and pipe detector (check before every hole)',
];
const pounds = (n: number) => Math.round(n * 100) / 100;

/** The plan for a job from his numbers (anything missing takes its default, and is said). */
export function planJob(id: JobId, input: JobIn = {}): JobPlan {
  const d = JOBS.find((j) => j.id === id)!.defaults;
  const assumed: string[] = [];
  const pick = <K extends keyof JobIn>(k: K, say: string): Required<JobIn>[K] => {
    const v = input[k];
    if (v === undefined || v === null || (typeof v === 'number' && !(Number.isFinite(v) && v > 0))) {
      assumed.push(say);
      return d[k];
    }
    return v as Required<JobIn>[K];
  };
  const wall = pick('wall', `a ${WALL_WORDS[d.wall]} wall`);
  const wallLine = `The wall: ${WALL_WORDS[wall]}.`;
  if (id === 'shelf') {
    const L = pick('length', `${d.length} m long`);
    const depth = pick('depth', `${d.depth} mm deep`);
    const t = pick('thick', `an ${d.thick} mm pine board`);
    const n = Math.max(2, Math.round(pick('count', `${d.count} brackets, one near each end`)));
    const perM = pick('kg', `${d.kg} kg a metre (a row of paperbacks)`);
    const span = L / (n - 1);
    const raw = { support: 'simple', span, udl: perM * G, material: 'c24', section: { shape: 'rect', b: depth / 1000, h: t / 1000 }, selfWeight: true };
    const estimate = solve('beam', raw);
    const board = 420 * L * (depth / 1000) * (t / 1000);
    const total = perM * L + board;
    const perFixing = (total / n / 2) * 2;
    return {
      id, title: `A ${L} m shelf on ${n} brackets`, assumed,
      tools: [...toolsFor(wall), 'A saw, if the board is cut to length'],
      materials: [
        { what: 'Pine furniture board', qty: `${L} × ${depth / 1000} m, ${t} mm`, gbp: pounds(L * (depth / 1000) * PRICES.pine18.gbp) },
        { what: 'Shelf brackets', qty: `${n}, rated for at least ${Math.ceil(total / n * 2)} kg each` },
        { what: fixingsFor(wall), qty: `${n * 2}, two a bracket` },
        { what: 'Wood screws 4.0 × 40 mm (board to brackets)', qty: 'a box of 200', gbp: PRICES.screws40.gbp },
      ],
      steps: [
        'Check the wall for cables and pipes where the brackets go.',
        `Mark the first bracket’s top hole, then level across to the others (${Math.round(span * 100)} cm apart).`,
        wall === 'stud' ? 'Find the studs and put the brackets on them.' : wall === 'masonry' ? 'Drill, push in a plug, and screw each bracket on loosely; level, then tighten.' : 'Fit the cavity fixings as their packet says, then the brackets.',
        'Lay the board on, centred, and screw it to the brackets from below.',
        'Load it a little at first and look along it for sag.',
        wallLine,
      ],
      beam: { estimate, raw },
      fixing: { perFixingKg: perFixing, lines: [
        { label: 'Weight on it, loaded', value: `${Math.round(total)} kg` },
        { label: 'Each bracket carries', value: `${Math.round(total / n)} kg` },
        { label: 'Each fixing to rate for', value: `${Math.ceil(perFixing)} kg or more`, },
      ] },
    };
  }
  if (id === 'pole') {
    const L = pick('length', `${d.length} m long`);
    const dia = pick('thick', `a ${d.thick} mm wooden pole`);
    const n = Math.max(2, Math.round(pick('count', `${d.count} brackets`)));
    const kg = pick('kg', `${d.kg} kg of lined curtains`);
    const span = L / (n - 1);
    const raw = { support: 'simple', span, udl: (kg / L) * G, material: 'c24', section: { shape: 'round', d: dia / 1000 }, selfWeight: true };
    const estimate = solve('beam', raw);
    const perFixing = (kg / n / 2) * 2;
    return {
      id, title: `A ${L} m curtain pole on ${n} brackets`, assumed,
      tools: toolsFor(wall),
      materials: [
        { what: `Curtain pole, ${dia} mm, with ${n} brackets and finials`, qty: `${L} m` },
        { what: fixingsFor(wall), qty: `${n * 2}, two a bracket` },
      ],
      steps: [
        'Check the wall for cables and pipes above the window.',
        'Mark the brackets 15 cm above the window and 15 cm past each side, level across.',
        n > 2 ? 'Put the middle bracket halfway, on the same level line.' : 'Two brackets do a pole up to about 2 m; a longer one needs a middle bracket.',
        'Fix the brackets, put the rings on the pole, then the pole in the brackets and the finials on.',
        wallLine,
      ],
      beam: { estimate, raw },
      fixing: { perFixingKg: perFixing, lines: [
        { label: 'Curtains', value: `${Math.round(kg)} kg` },
        { label: 'Each fixing to rate for', value: `${Math.ceil(perFixing)} kg or more` },
      ] },
    };
  }
  if (id === 'tv') {
    const kg = pick('kg', `a ${d.kg} kg TV (a 50-inch is about that)`);
    const n = Math.max(2, Math.round(pick('count', `${d.count} fixings in the bracket`)));
    // a tilting bracket holds the TV about 8 cm off the wall; its fixings are about 20 cm apart top to bottom: the top ones pull out
    const shear = (kg / n) * 2;
    const pull = ((kg * 0.08) / 0.2 / Math.max(1, Math.floor(n / 2))) * 2;
    return {
      id, title: `A ${kg} kg TV on the wall`, assumed: [...assumed, 'a tilting bracket holding it about 8 cm off the wall, its fixings about 20 cm apart'],
      tools: [...toolsFor(wall), 'A second pair of hands to lift the TV'],
      materials: [
        { what: 'TV wall bracket for the TV’s VESA size', qty: `rated for at least ${Math.ceil(kg * 2)} kg` },
        { what: wall === 'plasterboard' ? 'Heavy-duty cavity fixings (a TV on plasterboard alone is best avoided: find a stud or the brick)' : fixingsFor(wall), qty: `${n}` },
      ],
      steps: [
        'Check the wall for cables and pipes behind where the bracket goes.',
        'Hold the bracket’s wall plate up, level it and mark its holes.',
        'Drill and fix the wall plate; tighten it fully.',
        'Fix the arms to the back of the TV, then lift it on together and lock it.',
        wallLine,
      ],
      beam: null,
      fixing: { perFixingKg: Math.max(shear, pull), lines: [
        { label: 'Each fixing’s share of the weight', value: `${Math.ceil(shear)} kg with the margin` },
        { label: 'Each top fixing’s pull out of the wall', value: `${Math.ceil(pull)} kg with the margin` },
        { label: 'Each fixing to rate for', value: `${Math.ceil(Math.max(shear, pull))} kg or more` },
      ] },
    };
  }
  const kg = pick('kg', `${d.kg} kg (a framed mirror about 60 × 90 cm)`);
  const n = Math.max(1, Math.round(pick('count', `${d.count} hooks`)));
  const per = (kg / n) * 2;
  return {
    id, title: `A ${kg} kg picture on ${n} hook${n === 1 ? '' : 's'}`, assumed,
    tools: n > 1 ? ['A spirit level, a pencil and a tape measure', 'A hammer (picture hooks) or a drill (screws and plugs)', 'A cable and pipe detector'] : ['A pencil and a tape measure', 'A hammer or a drill', 'A cable and pipe detector'],
    materials: [{ what: kg > 10 ? fixingsFor(wall) : 'Picture hooks with hardened pins', qty: `${n}, each rated for at least ${Math.ceil(per)} kg` }],
    steps: [
      'Hold it where you want it and mark the top middle lightly.',
      'Measure from the top of the frame to the tight wire or the D-rings, and mark the hooks that far down.',
      n > 1 ? 'Level the marks across.' : 'One hook: the middle mark is enough.',
      'Fix the hooks, hang it, and level it.',
      wallLine,
    ],
    beam: null,
    fixing: { perFixingKg: per, lines: [{ label: 'Each hook to rate for', value: `${Math.ceil(per)} kg or more` }] },
  };
}

/** The line under every plan. */
export const DIY_NOTE = 'Every number here is a first estimate, never certified. A fixing’s packet says what it holds; choose one rated for at least the number above. Prices are typical, not quotes.';
