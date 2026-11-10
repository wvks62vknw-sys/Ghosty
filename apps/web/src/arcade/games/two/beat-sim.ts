/**
 * THE BEAT's rules, with no drawing in them: a rhythm platformer whose music is its level. A runner runs by itself along a
 * track; the notes of the song ARE the obstacles, each arriving exactly on its note: a gap or spike (a high note) to JUMP
 * over, a hanging bar (a low note) to DUCK under, a wall (an accent chord) to DASH through. An action covers a window of
 * time (a jump 0.6 s, a duck 0.4 s, a dash 0.3 s) and is safe if the obstacle's moment falls inside it; the nearer the
 * middle of the window it falls to the note, the better the grade: PERFECT, GOOD or just OK. A miss costs one of three
 * lives and the combo. The track is made by code from a seed (three tracks, each with its own key and scale) and goes on
 * for as long as you do: a level raises the tempo (to 176 beats a minute), then the density of notes, the off-beat notes
 * and the chains of them, always leaving time to recover. Ghosty plays it with a timing error and a lapse rate he tunes.
 * The engine draws it and plays the notes; the node test plays it; the GYM can learn it through `beatLearnable`.
 */
import type { Learnable } from '../../learnable';
import { intensity, rise } from './skill';

export type Move = 'jump' | 'duck' | 'dash';
export const MOVES: readonly Move[] = ['jump', 'duck', 'dash'];
/** How long each action's window lasts (s). */
export const WINDOW: Record<Move, number> = { jump: 0.6, duck: 0.4, dash: 0.3 };
export const PERFECT_S = 0.07;
export const GOOD_S = 0.16;
export const LIVES = 3;
export type Grade = 'perfect' | 'good' | 'ok';

export interface Track {
  id: number;
  name: string;
  /** Semitones from A4 of the key, and of the scale's degrees. */
  root: number;
  scale: number[];
  chords: number[][];
}
export const TRACKS: Track[] = [
  { id: 0, name: 'Neon', root: -9 - 3, scale: [0, 3, 5, 7, 10, 12], chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]] },
  { id: 1, name: 'Sunrise', root: -9, scale: [0, 2, 4, 7, 9, 12], chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]] },
  { id: 2, name: 'Deep', root: -9 - 7, scale: [0, 2, 3, 7, 9, 12], chords: [[0, 3, 7], [3, 7, 10], [5, 8, 12], [-2, 2, 5]] },
];

export interface Note {
  /** The moment it must be met (the song's seconds). */
  t: number;
  move: Move;
  /** A scale degree for its tone. */
  degree: number;
  /** Resolved: how it went. */
  result: 'hit' | 'miss' | null;
  grade: Grade | null;
}
export type BeatEvent =
  | { type: 'note'; move: Move; degree: number; delay: number }
  | { type: 'tick'; delay: number; beat: number }
  | { type: 'grade'; grade: Grade; move: Move; combo: number; points: number }
  | { type: 'miss'; move: Move; lives: number }
  | { type: 'act'; move: Move }
  | { type: 'over' };
export interface Act {
  move: Move;
  start: number;
}
export interface Run {
  seed: number;
  level: number;
  rnd: () => number;
  brnd: () => number;
  track: Track;
  bpm: number;
  t: number;
  notes: Note[];
  /** The time of the last note laid, and the beat the generator has reached. */
  laid: number;
  beatsSent: number;
  act: Act | null;
  buffer: { move: Move; t: number } | null;
  score: number;
  combo: number;
  best: number;
  lives: number;
  over: boolean;
  overT: number;
  perfects: number;
  goods: number;
  hits: number;
  misses: number;
  events: BeatEvent[];
  /** The last grade, for the drawing, and when. */
  last: { grade: Grade | 'miss'; t: number } | null;
  /** The bot's plan. */
  plan: { move: Move; at: number; note: Note } | null;
}

/** What a level asks. The tempo stops at 176; density, off-beats and chains keep rising without end after it. */
export const bpmOf = (level: number): number => Math.min(176, rise(level, 92, 16, 5));
export const densityOf = (level: number): number => Math.min(0.85, 0.3 + 0.09 * Math.log1p(Math.max(0, level - 1)));
export const offbeatOf = (level: number): number => (level < 3 ? 0 : Math.min(0.4, 0.06 * Math.log1p(level - 2)));
export const chainOf = (level: number): number => (level < 5 ? 0 : Math.min(0.5, 0.08 * Math.log1p(level - 4)));
export const targetOf = (level: number): number => Math.round(rise(level, 1500, 900, 4));
export const hardness = (level: number): number => intensity(level, [bpmOf(level) / 20, densityOf(level) * 4, offbeatOf(level) * 6, chainOf(level) * 6]);
export const trackOf = (seed: number, level: number): Track => TRACKS[(Math.abs(seed) + level) % TRACKS.length]!;

const mk = (seed: number): (() => number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
export const THETA0: readonly number[] = [0.11, 0.1];
export const SIGMA: readonly number[] = [0.03, 0.03];

export function newRun(seed: number, level: number): Run {
  const bpm = bpmOf(level);
  const r: Run = { seed, level, rnd: mk(seed), brnd: mk(seed + 7), track: trackOf(seed, level), bpm, t: -2, notes: [], laid: 1.2, beatsSent: 0, act: null, buffer: null, score: 0, combo: 0, best: 0, lives: LIVES, over: false, overT: 0, perfects: 0, goods: 0, hits: 0, misses: 0, events: [], last: null, plan: null };
  lay(r, 8);
  return r;
}
const beatOf = (r: Run) => 60 / r.bpm;
/** The least time between two notes so the runner can finish the first move and start the second in time: half of each window. */
export const needGap = (a: Move, b: Move): number => (WINDOW[a] + WINDOW[b]) / 2 + 0.02;
/** Lay notes ahead on the beat and the off-beat, each far enough after the last for its move to be made, until `until` seconds. */
function lay(r: Run, until: number): void {
  const beat = beatOf(r);
  const put = (t: number, move: Move, degree: number): number => {
    const last = r.notes[r.notes.length - 1];
    let at = t;
    if (last) while (at - last.t < needGap(last.move, move) - 1e-9) at += beat / 2;
    r.notes.push({ t: at, move, degree, result: null, grade: null });
    return at;
  };
  while (r.laid < until) {
    let t = r.laid + beat;
    // on the beat or (rarely) on the off-beat
    if (r.rnd() < offbeatOf(r.level)) t -= beat / 2;
    r.laid = t;
    if (r.rnd() > densityOf(r.level)) continue;
    const roll = r.rnd();
    const move: Move = roll < 0.45 ? 'jump' : roll < 0.78 ? 'duck' : 'dash';
    const chain = r.rnd() < chainOf(r.level);
    const degree = Math.floor(r.rnd() * r.track.scale.length);
    const at = put(t, move, degree);
    r.laid = Math.max(r.laid, at);
    if (chain) {
      // a second note a beat later: the same move or its mate
      const at2 = put(at + beat, r.rnd() < 0.5 ? move : MOVES[(MOVES.indexOf(move) + 1) % 3]!, (degree + 2) % r.track.scale.length);
      r.laid = Math.max(r.laid, at2);
    }
  }
}
/** The action the runner is in at time `t`, or null. */
export const activeAt = (r: Run, t = r.t): Act | null => (r.act && t >= r.act.start && t < r.act.start + WINDOW[r.act.move] ? r.act : null);
export function perform(r: Run, move: Move): boolean {
  if (r.over) return false;
  if (activeAt(r)) {
    r.buffer = { move, t: r.t };
    return false;
  }
  r.act = { move, start: r.t };
  r.events.push({ type: 'act', move });
  return true;
}
function judge(r: Run, n: Note): void {
  // the action whose window holds the note's moment
  const a = r.act;
  const inside = a && a.move === n.move && n.t >= a.start && n.t <= a.start + WINDOW[a.move];
  if (inside && a) {
    const off = Math.abs(a.start + WINDOW[a.move] / 2 - n.t);
    const grade: Grade = off <= PERFECT_S + (a.move === 'jump' ? 0.08 : 0) ? 'perfect' : off <= GOOD_S + (a.move === 'jump' ? 0.1 : 0) ? 'good' : 'ok';
    n.result = 'hit';
    n.grade = grade;
    r.combo++;
    r.best = Math.max(r.best, r.combo);
    const base = grade === 'perfect' ? 300 : grade === 'good' ? 150 : 60;
    const points = Math.round(base * (1 + Math.floor(r.combo / 8) * 0.5));
    r.score += points;
    r.hits++;
    if (grade === 'perfect') r.perfects++;
    else if (grade === 'good') r.goods++;
    r.last = { grade, t: r.t };
    r.events.push({ type: 'grade', grade, move: n.move, combo: r.combo, points });
  } else {
    n.result = 'miss';
    r.combo = 0;
    r.lives--;
    r.misses++;
    r.last = { grade: 'miss', t: r.t };
    r.events.push({ type: 'miss', move: n.move, lives: r.lives });
    if (r.lives <= 0) {
      r.over = true;
      r.events.push({ type: 'over' });
    }
  }
}
export function step(r: Run, dt: number, pressed: ReadonlySet<string>): void {
  if (r.over) {
    r.overT += dt;
    return;
  }
  r.t += dt;
  if (pressed.has('a') || pressed.has('up')) perform(r, 'jump');
  if (pressed.has('b') || pressed.has('down')) perform(r, 'duck');
  if (pressed.has('x') || pressed.has('right')) perform(r, 'dash');
  if (r.buffer && !activeAt(r)) {
    if (r.t - r.buffer.t < 0.12) perform(r, r.buffer.move);
    r.buffer = null;
  }
  // the music: notes sent 0.1 s ahead with their delay, and a tick on every beat
  const beat = beatOf(r);
  for (const n of r.notes) {
    if (n.result === null && !('sent' in n) && n.t - r.t < 0.1) {
      (n as Note & { sent?: true }).sent = true;
      r.events.push({ type: 'note', move: n.move, degree: n.degree, delay: Math.max(0, n.t - r.t) });
    }
  }
  while ((r.beatsSent + 1) * beat - 2 < r.t + 0.1) {
    r.beatsSent++;
    r.events.push({ type: 'tick', delay: Math.max(0, r.beatsSent * beat - 2 - r.t), beat: r.beatsSent });
  }
  for (const n of r.notes) if (n.result === null && r.t >= n.t) judge(r, n);
  if (r.notes.length > 40) r.notes = r.notes.filter((n) => n.result === null || r.t - n.t < 1);
  lay(r, r.t + 8);
}

// ---------------------------------------------------------------- Ghosty's play

const gauss = (f: () => number): number => {
  let s = 0;
  for (let i = 0; i < 6; i++) s += f();
  return (s - 3) / 0.7071;
};
/** Ghosty reads the notes coming and plans each move for the middle of its window plus a timing error; sometimes (his lapse rate) he picks the wrong one. */
export function botStep(r: Run, th: readonly number[]): void {
  if (r.over) return;
  if (!r.plan) {
    const n = r.notes.find((q) => q.result === null && q.t > r.t && q.t - r.t < 1.0);
    if (n) {
      const lapse = r.brnd() < Math.abs(th[1] ?? 0.1);
      const move: Move = lapse ? MOVES[(MOVES.indexOf(n.move) + 1 + Math.floor(r.brnd() * 2)) % 3]! : n.move;
      r.plan = { move, at: n.t - WINDOW[move] / 2 + gauss(r.brnd) * Math.abs(th[0] ?? 0.1), note: n };
    }
  }
  if (r.plan && r.t >= r.plan.at) {
    if (!activeAt(r)) {
      perform(r, r.plan.move);
      r.plan = null;
    } else if (r.plan.note.result !== null) r.plan = null;
  }
  if (r.plan && r.plan.note.result !== null) r.plan = null;
}

// ---------------------------------------------------------------- the GYM's way in

export interface BeatObs {
  /** The next notes: [seconds until, move 0/1/2]. */
  ahead: number[][];
  acting: number;
  lives: number;
  combo: number;
}
export const BEAT_ACTIONS = ['none', 'jump', 'duck', 'dash'] as const;
export function beatLearnable(seed = 1, level = 1): Learnable<BeatObs, 'none' | 'jump' | 'duck' | 'dash'> & { run: Run } {
  const run = newRun(seed, level);
  return {
    run,
    id: 'beat',
    actions: BEAT_ACTIONS,
    observe: () => ({ ahead: run.notes.filter((n) => n.result === null).slice(0, 4).map((n) => [n.t - run.t, MOVES.indexOf(n.move)]), acting: run.act && activeAt(run) ? MOVES.indexOf(run.act.move) + 1 : 0, lives: run.lives, combo: run.combo }),
    act(a) {
      step(run, 1 / 60, new Set(a === 'jump' ? ['a'] : a === 'duck' ? ['b'] : a === 'dash' ? ['x'] : []));
      run.events.length = 0;
    },
    score: () => run.score,
    done: () => run.over,
  };
}
