/**
 * THE WORKBENCH's one answer shape (OWNER-ISSUES 61b): every solver returns an `Estimate` — the numbers as lines, every
 * default it took (`assumptions`), the formula in words (`method`), a confidence word (the vocabulary of the Lens's measure,
 * apps/web/src/measure/geom.ts: good / fair / rough), what would move the answer (`changes`) and the caveat.
 *
 * The line that holds: every number here is a FIRST ESTIMATE, NEVER CERTIFIED, and says so on the card, in the chat and on
 * Telegram. Nothing here is design approval, structural sign-off or safety advice; a load-bearing or life-safety question
 * ends with "a chartered engineer signs this, not me". A case outside a formula's range says so and stops (`problem`).
 */

export type Confidence = 'rough' | 'fair' | 'good';

export type WorkKind =
  | 'beam' | 'column' | 'gears' | 'bike' | 'engine' | 'wing' | 'car' | 'fall' | 'projectile' | 'orbit' | 'heat' | 'sun' | 'circuit' | 'tunnel';

export interface EstLine {
  label: string;
  value: string;
  note?: string;
}

export interface Estimate {
  kind: WorkKind;
  title: string;
  lines: EstLine[];
  /** Every default it took, in words. */
  assumptions: string[];
  /** The formula, in words. */
  method: string;
  confidence: Confidence;
  /** What would move the answer ("a longer span adds deflection with the cube of the length"). */
  changes: string[];
  caveat: string;
  /** The numbers behind the lines, in SI (K, rad, rpm), for the tests and the screen's own state. */
  values: Record<string, number>;
  /** Set when the case is outside the formula's range: it says so, and there are no numbers. */
  problem?: string;
}

/** The standing label on every card. */
export const LABEL = 'FIRST ESTIMATE · NOT CERTIFIED';
export const FIRST = 'First estimate, not certified';
/** The last words of anything load-bearing or about safety. */
export const SIGNOFF = 'A chartered engineer signs this, not me.';

const CAVEATS: Record<WorkKind, string> = {
  beam: `${FIRST} — the textbook beam formulae, not a design to the Eurocodes; nothing here is structural approval. ${SIGNOFF}`,
  column: `${FIRST} — Euler's ideal column; a real one buckles below this. Nothing here is structural approval. ${SIGNOFF}`,
  gears: `${FIRST} — ideal gears and belts; real ones slip, flex and lose more as they wear.`,
  bike: `${FIRST} — the wheel's size is nominal; tyres and pressure move it a little.`,
  engine: `${FIRST} — ideal cycles and a guessed mean pressure; a dyno is the only real answer.`,
  wing: `${FIRST} — thin-aerofoil theory and a lifting-line correction; never flight-safety advice. ${SIGNOFF}`,
  car: `${FIRST} — the drag formula with a guessed drag area; a real car is measured in a wind tunnel or a coast-down test.`,
  fall: `${FIRST} — a steady fall with a constant drag coefficient; never safety advice for a jump or a drop.`,
  projectile: `${FIRST} — a point mass in still air; spin, wind and shape move it.`,
  orbit: `${FIRST} — two-body orbits and impulsive burns; a real mission needs a proper trajectory design.`,
  heat: `${FIRST} — steady-state U-values and a rule of thumb; never a building-regulations calculation (SAP).`,
  sun: `${FIRST} — the standard solar-position algorithm (about ±0.5°), flat ground and no terrain or neighbours.`,
  circuit: `${FIRST} — ideal parts and Ohm's law; check a part's datasheet, and never work on mains wiring yourself.`,
  tunnel: `${FIRST} — a 2-D, low-Reynolds lattice flow; a real wing is 3-D and turbulent.`,
};

/** "First estimate, not certified — …" for each kind (the load-bearing and safety ones end with the sign-off line). */
export function caveatFor(kind: WorkKind): string {
  return CAVEATS[kind] ?? `${FIRST}.`;
}

/**
 * The confidence word from the inputs' completeness: every input given → good; a default used → fair; a guess (a mean
 * pressure, a drag coefficient) → rough.
 */
export function confidenceOf(defaultsUsed: boolean, guessed = false): Confidence {
  return guessed ? 'rough' : defaultsUsed ? 'fair' : 'good';
}

/** The answer when a case is outside a formula's range: it says so and stops (no numbers). */
export function problemEstimate(kind: WorkKind, title: string, problem: string, method = ''): Estimate {
  return { kind, title, lines: [], assumptions: [], method, confidence: 'rough', changes: [], caveat: caveatFor(kind), values: {}, problem };
}

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, Math.max(0, n - 1)).trimEnd()}…`);

/**
 * The chat and Telegram rendering, at most `max` characters (900): the title, the numbers, the method, what was assumed,
 * what would change it, the confidence — and the caveat, always whole, always last. Lists are shortened (never the caveat)
 * to fit.
 */
export function estimateText(e: Estimate, max = 900): string {
  const head = `${e.title} — ${LABEL}`;
  if (e.problem) return `${clip(`${e.title}: ${e.problem}`, Math.max(0, max - e.caveat.length - 1))}\n${e.caveat}`;
  const lines = e.lines.map((l) => `• ${l.label}: ${l.value}${l.note ? ` (${l.note})` : ''}`);
  const tail = [`Confidence: ${e.confidence}.`, e.caveat];
  let assumed = e.assumptions.slice();
  let changes = e.changes.slice();
  let shown = lines.slice();
  const build = () => {
    const out = [head, ...shown];
    if (e.method) out.push(`How: ${e.method}`);
    if (assumed.length) out.push(`Assumed: ${assumed.join('; ')}.`);
    if (changes.length) out.push(`What would change it: ${changes.join('; ')}.`);
    out.push(...tail);
    return out.join('\n');
  };
  let text = build();
  // shorten what can be shortened, least important first: what would change it, then the assumptions, then the lines
  while (text.length > max && changes.length) {
    changes = changes.slice(0, -1);
    text = build();
  }
  while (text.length > max && assumed.length > 1) {
    assumed = assumed.slice(0, -1);
    text = build();
  }
  while (text.length > max && shown.length > 2) {
    shown = shown.slice(0, -1);
    text = build();
  }
  if (text.length <= max) return text;
  // still too long (a long method): cut the method, keep the caveat whole
  const rest = [head, ...shown, ...(assumed.length ? [`Assumed: ${assumed.join('; ')}.`] : []), ...tail].join('\n');
  if (rest.length <= max) return rest;
  return `${clip([head, ...shown].join('\n'), Math.max(0, max - e.caveat.length - 1))}\n${e.caveat}`;
}

/** One sentence to say aloud: "A first estimate, not certified: max deflection about 0.201 mm." */
export function estimateSpoken(e: Estimate): string {
  if (e.problem) return `I can't estimate that: ${e.problem.replace(/\.$/, '')}.`;
  const l = e.lines[0];
  return l ? `A first estimate, not certified: ${l.label.toLowerCase()} about ${l.value}.` : `A first estimate, not certified: ${e.title}.`;
}
