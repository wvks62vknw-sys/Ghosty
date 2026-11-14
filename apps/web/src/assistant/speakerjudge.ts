/**
 * WHOSE VOICE, FROM THE VOICE MODEL'S NUMBERS (STARS 171): the judge for 256-number voice embeddings, in plain arithmetic. Pure: no
 * DOM, no network, no storage. A voice kept is the embedding of each of the three lines read and their centroid (never a
 * recording); a capture is the embedding of what was just said; the likeness is the cosine between them (1 the same, 0 nothing
 * in common). It keeps the shape of voiceprint.ts's judge: the same labels, a floor made from the enrolment itself, and it FAILS
 * CLOSED. Under the voice's ACCEPT line, or with a second voice about as near, or between the accept line and the REJECT line, it is
 * "a voice I don't know": a stranger is never named, never searched, never guessed at.
 *
 * A COURTESY, NEVER A LOCK: nothing in the app that confirms, pays, unlocks or approves reads this (tests/speaker.spec.mjs and
 * apps/edge/test/speaker.test.mjs read the sources to be sure); a recording of him played at the phone defeats any such model.
 * When the model is not on the phone (voiceprint.ts `judgeBest`) the phone's own features judge, as they did before it.
 */
import type { Known, Who } from './voiceprint';

/** The model's embedding length. */
export const EMB_LEN = 256;
/** The accept line is the enrolment's worst leave-one-out likeness less this, kept between ACCEPT_MIN and ACCEPT_MAX. */
export const ACCEPT_MARGIN = 0.12;
export const ACCEPT_MIN = 0.4;
export const ACCEPT_MAX = 0.55;
/** Under this to every voice known: certainly another voice (the published equal-error line for such models is 0.3 to 0.4). */
export const REJECT = 0.28;
/** The best voice must beat the second by this, or two voices both claim it. */
export const MARGIN = 0.08;
/** A person introduced who is this alike a voice already known could be mistaken for it: not added. */
export const TOO_ALIKE = 0.5;
export const SENTENCES = 3;

/** A voice, as the model's numbers: the likeness line it is held to, each line read, and their centroid (all of length 1). */
export interface EmbPrint {
  looks: number[][];
  pooled: number[];
  accept: number;
}

export const norm = (v: ArrayLike<number>): number[] => {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i]! * v[i]!;
  const n = Math.sqrt(s) || 1;
  return Array.from({ length: v.length }, (_, i) => v[i]! / n);
};
export const cosine = (a: number[], b: number[]): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
};
const centroid = (vs: number[][]): number[] => norm(Array.from({ length: EMB_LEN }, (_, i) => vs.reduce((s, v) => s + v[i]!, 0)));

/** Is a stored thing an EmbPrint with its numbers whole? */
export function isEmb(p: unknown): p is EmbPrint {
  const q = p as EmbPrint | null;
  const whole = (v: unknown) => Array.isArray(v) && v.length === EMB_LEN && v.every(Number.isFinite);
  return !!q && whole(q.pooled) && Array.isArray(q.looks) && q.looks.length > 0 && q.looks.every(whole) && Number.isFinite(q.accept);
}

/** A voice from the three lines' embeddings; null when one is missing or not whole. */
export function enrolEmb(embs: (number[] | undefined | null)[]): EmbPrint | null {
  const good = embs.filter((e): e is number[] => !!e && e.length === EMB_LEN && e.every(Number.isFinite));
  if (good.length < SENTENCES) return null;
  const looks = good.map(norm);
  let worst = 1;
  for (let i = 0; i < looks.length; i++) worst = Math.min(worst, cosine(looks[i]!, centroid(looks.filter((_, j) => j !== i))));
  return { looks, pooled: centroid(looks), accept: Math.min(ACCEPT_MAX, Math.max(ACCEPT_MIN, worst - ACCEPT_MARGIN)) };
}

/** A voice known whose model numbers are kept. */
export type KnownEmb = Known & { print: Known['print'] & { emb: EmbPrint } };
export const hasEmb = (k: Known): k is KnownEmb => isEmb((k.print as { emb?: unknown }).emb);

/** Whose voice an embedding is among the voices known (each with model numbers). `d` is the best likeness, for the checks only. */
export function judgeEmb(known: KnownEmb[], emb: number[]): { who: Who; d: number } {
  const e = norm(emb);
  const near = known.map((k) => ({ k, c: cosine(k.print.emb.pooled, e) })).sort((a, b) => b.c - b.k.print.emb.accept - (a.c - a.k.print.emb.accept) || b.c - a.c);
  const best = near[0];
  if (!best) return { who: { kind: 'unknown', why: 'voice' }, d: 0 };
  const inside = near.filter((n) => n.c >= n.k.print.emb.accept);
  const second = [...near].sort((a, b) => b.c - a.c)[1];
  if (inside.length === 1 && (!second || best.c - second.c >= MARGIN || second.k === best.k)) {
    return { who: best.k.me ? { kind: 'owner' } : { kind: 'person', id: best.k.id, name: best.k.name }, d: best.c };
  }
  if (inside.length > 1) return { who: { kind: 'unknown', why: 'unsure', two: true }, d: best.c };
  return { who: { kind: 'unknown', why: near.every((n) => n.c < REJECT) ? 'voice' : 'unsure' }, d: best.c };
}

/** Could this voice be added beside the voices known without the two being mistaken for each other? The one it is too like, or null. */
export function tooAlike(known: Known[], emb: EmbPrint): Known | null {
  return known.find((k) => hasEmb(k) && cosine(k.print.emb.pooled, emb.pooled) >= TOO_ALIKE) ?? null;
}
