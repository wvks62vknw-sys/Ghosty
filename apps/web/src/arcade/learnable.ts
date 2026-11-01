/**
 * A game the GYM may learn to play later. A game that implements this lets a learner see what the player sees
 * (observe), do what the player can do (act, one action a tick) and know how well it is doing (score). Only the
 * interface and its contract live here for now; no game is wired to the GYM yet.
 */

export interface Learnable<Obs = unknown, Act extends string = string> {
  /** The game's id on the shelf. */
  readonly id: string;
  /** Every action act() accepts (the learner picks from these). */
  readonly actions: readonly Act[];
  /** What the player can see now, as plain data: finite numbers, strings, booleans, null, arrays, plain objects and typed arrays (what a Worker can be handed). */
  observe(): Obs;
  /** Do one action for one tick. */
  act(a: Act): void;
  /** The score so far: a finite number, higher is better. */
  score(): number;
  /** The run is over (optional: an endless game never says so). */
  done?(): boolean;
}

/** Plain data all the way down (no functions, class instances, NaN or cycles deeper than 32). */
const plain = (v: unknown, depth = 0): boolean => {
  if (depth > 32) return false;
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true;
  if (typeof v === 'number') return Number.isFinite(v);
  if (ArrayBuffer.isView(v)) return true;
  if (Array.isArray(v)) return v.every((x) => plain(x, depth + 1));
  if (typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v) as unknown;
  return (proto === Object.prototype || proto === null) && Object.values(v as object).every((x) => plain(x, depth + 1));
};

/**
 * Hold a game to the contract: it names its actions (distinct, non-empty), each observation is plain data, every
 * action is accepted, and the score stays finite. Plays `steps` ticks through its actions in turn; returns the
 * problems found (none: it keeps the contract).
 */
export function checkLearnable(g: Learnable, steps = 24): string[] {
  const problems: string[] = [];
  if (!g.id) problems.push('it has no id');
  if (!Array.isArray(g.actions) || g.actions.length === 0) problems.push('it names no actions');
  else if (new Set(g.actions).size !== g.actions.length) problems.push('its actions repeat');
  for (let i = 0; i < steps && problems.length === 0; i++) {
    if (g.done?.()) break;
    let obs: unknown;
    try {
      obs = g.observe();
    } catch (e) {
      problems.push(`observe() threw: ${(e as Error)?.message ?? e}`);
      break;
    }
    if (!plain(obs)) problems.push(`observe() at tick ${i} is not plain data`);
    const a = g.actions[i % g.actions.length]!;
    try {
      g.act(a);
    } catch (e) {
      problems.push(`act(${a}) threw: ${(e as Error)?.message ?? e}`);
    }
    const s = g.score();
    if (!Number.isFinite(s)) problems.push(`score() at tick ${i} is not a finite number`);
  }
  return problems;
}
