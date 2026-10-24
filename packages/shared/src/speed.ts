/**
 * The stopwatch's shapes (SPEED): what apps/edge/src/speed.ts records and what `/status` carries as
 * `speed` for the SPEED card (packages/shared/src/protocol.ts BrainStatus). Types only.
 */
/** One timed model call. `first`: until the reply started to arrive; `wait`: the room or cool-down waited out before it. */
export interface ModelLap {
  k: 'm';
  at: number;
  p: string;
  m: string;
  f: number;
  ms: number;
  w: number;
  tps?: number;
  /** The call failed (rate limit, error): kept in the ring, left out of the medians. */
  bad?: 1;
  /** Ghosty's own work rather than the owner's chat. */
  bg?: 1;
}
/** One tool's time (`n`: several of it side by side). */
export interface ToolLap {
  k: 't';
  at: number;
  name: string;
  ms: number;
  n?: number;
}
/** One turn of the chat, from its first model call to its answer, and where the time went. */
export interface TurnLap {
  k: 'r';
  at: number;
  ms: number;
  wait: number;
  model: number;
  tools: number;
  rest: number;
  calls: number;
}
export type Lap = ModelLap | ToolLap | TurnLap;

export interface Stat {
  median: number;
  p90: number;
  n: number;
}
/** Where a turn's time went: averages (they add up to the average turn). */
export interface Split {
  wait: number;
  model: number;
  tools: number;
  rest: number;
}
export interface ProviderSpeed {
  provider: string;
  firstToken: number;
  total: number;
  tps?: number;
  n: number;
}
export interface ToolSpeed {
  name: string;
  median: number;
  n: number;
}
/** A day's (or the week's) medians. */
export interface SpeedDay {
  day: string;
  firstToken: Stat | null;
  reply: Stat | null;
  providers: ProviderSpeed[];
  tools: ToolSpeed[];
  split: Split | null;
}
/** For SYSTEM → STATUS (the SPEED card): today, the week before, and the same in plain words. */
export interface SpeedSummary {
  today: SpeedDay;
  week: SpeedDay | null;
  lines: string[];
  /** The newest entries, newest first (for a "latest" list). */
  recent: Lap[];
}
