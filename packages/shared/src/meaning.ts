/**
 * SEARCH BY MEANING, the pure parts: how a passage of the library copy on the phone is scored for a question,
 * and how its meaning vector is kept small. No browser, no model: apps/web/src/library/local.ts (searchLocal,
 * passagesFor) uses them, and apps/edge/test/meaning.test.mjs tests them.
 *
 * A vector is the small model's 384 numbers for a text (offline/embed.ts), scaled to length 1, so the cosine of
 * two vectors is their dot product: near 1 means "about the same thing", near 0 "unrelated".
 *
 * Kept as int8 with a scale: each number becomes a whole number from -127 to 127 (`q`) times one shared `s`, so
 * a passage costs 384 + 4 = 388 bytes instead of 1,536, and the cosine comes out the same to about 0.002.
 */

/** Words too common to search by (the brain's own list is similar). */
export const STOP = new Set(
  'the and are for from has have how its not our that their them then there these they this was were what when where which who why will with would you your about also any just like more most only other some such very use using want need make get show tell give please ghosty does did can could'.split(' '),
);

/** The question's search words: lower case, at least 3 letters, not a STOP word, at most 12. */
export const queryTerms = (q: string): string[] =>
  [...new Set((q.toLowerCase().match(/[a-z0-9][a-z0-9_+#.-]*[a-z0-9+#]|[a-z0-9]/g) ?? []).filter((t) => t.length > 2 && !STOP.has(t)))].slice(0, 12);

/**
 * How much of the question's wording a text has: `words` is the share of its search words found (by their first
 * few letters, so "plants" finds "plant"), and `matched` says whether that is enough to count as a keyword match
 * (half the words for a question of three words or more, every word otherwise). Null: the question has no
 * search words at all.
 */
export function wordMatcher(q: string): ((low: string) => { words: number; matched: boolean }) | null {
  const terms = queryTerms(q);
  if (!terms.length) return null;
  const stems = terms.map((t) => t.slice(0, Math.max(3, Math.min(t.length, 5))));
  const need = terms.length >= 3 ? 0.5 : 0.99;
  return (low) => {
    const words = stems.filter((x) => low.includes(x)).length / stems.length;
    return { words, matched: words >= need };
  };
}

const plain = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * The question names this document or section exactly: the whole title (or heading) appears in the question as
 * words of its own, e.g. "what is binary search" and a document called "Binary search". Titles shorter than five
 * letters ("Notes" is five) are too vague to count.
 */
export function exactTitle(q: string, ...titles: string[]): boolean {
  const qq = ` ${plain(q)} `;
  return titles.some((t) => {
    const tt = plain(t ?? '');
    return tt.length >= 5 && !STOP.has(tt) && qq.includes(` ${tt} `);
  });
}

/** A vector scaled to length 1 (a zero vector stays zero). */
export function normalise(v: ArrayLike<number>): Float32Array {
  let n = 0;
  for (let i = 0; i < v.length; i++) n += v[i]! * v[i]!;
  const out = new Float32Array(v.length);
  const k = n > 0 ? 1 / Math.sqrt(n) : 0;
  for (let i = 0; i < v.length; i++) out[i] = v[i]! * k;
  return out;
}

/** A vector as int8 with a scale (`v ≈ q × s`), scaled to length 1 first. */
export function quantise(v: ArrayLike<number>): { q: Int8Array; s: number } {
  const u = normalise(v);
  let max = 0;
  for (let i = 0; i < u.length; i++) max = Math.max(max, Math.abs(u[i]!));
  const s = max > 0 ? max / 127 : 1;
  const q = new Int8Array(u.length);
  for (let i = 0; i < u.length; i++) q[i] = Math.max(-127, Math.min(127, Math.round(u[i]! / s)));
  return { q, s };
}

/** Back from int8: the vector it stands for (about length 1). */
export function dequantise(q: ArrayLike<number>, s: number): Float32Array {
  const out = new Float32Array(q.length);
  for (let i = 0; i < q.length; i++) out[i] = q[i]! * s;
  return out;
}

/** Bytes a kept vector takes: one per number and four for the scale. */
export const bytesPerVector = (dims: number): number => dims + 4;

/**
 * The cosine between a question's vector (length 1) and a kept int8 vector. The scale cancels out, so it is the
 * dot product over the int8 vector's own length. 0 when either is missing or the lengths differ.
 */
export function cosine(query: ArrayLike<number>, q: ArrayLike<number>): number {
  if (!query.length || query.length !== q.length) return 0;
  let dot = 0;
  let nn = 0;
  for (let i = 0; i < q.length; i++) {
    dot += query[i]! * q[i]!;
    nn += q[i]! * q[i]!;
  }
  return nn > 0 ? dot / Math.sqrt(nn) : 0;
}

/**
 * The weights. A cosine at or under FLOOR counts as no meaning at all (unrelated English texts still share some);
 * a passage is brought up by meaning alone from MIN_COS; meaning outweighs the wording, but the question's own
 * words still count, and a document or section the question names exactly gets EXACT on top, so a name typed
 * exactly still wins. Checked against the real model (snowflake-arctic-embed-s, with the query prefix).
 */
export const MEANING = { FLOOR: 0.2, MIN_COS: 0.35, W_MEANING: 0.7, W_WORDS: 0.3, EXACT: 0.5 } as const;

/** What is known about one passage for one question. `cos` is null when the passage has no vector yet. */
export interface Signals {
  words: number;
  matched: boolean;
  exact: boolean;
  cos: number | null;
}

/** The keyword score, exactly as before search by meaning: the share of the question's words, when they match. */
export const keywordScore = (s: Signals): number => (s.matched ? s.words : 0);

/**
 * The blended score: meaning (the cosine above FLOOR, stretched to 0–1) and wording together, plus EXACT for a
 * named title. Null: not a hit at all (no keyword match, no named title and too far in meaning).
 */
export function blendScore(s: Signals): number | null {
  const near = s.cos === null ? 0 : Math.max(0, (s.cos - MEANING.FLOOR) / (1 - MEANING.FLOOR));
  if (!s.matched && !s.exact && !(s.cos !== null && s.cos >= MEANING.MIN_COS)) return null;
  return MEANING.W_MEANING * near + MEANING.W_WORDS * s.words + (s.exact ? MEANING.EXACT : 0);
}

export type SearchHow = 'meaning' | 'keywords';

/**
 * The best `k` passages, highest first, each with its score: by meaning (blended) or by keywords alone. The
 * search reads its passages a batch at a time; `rank` is used on each batch's leftovers too, so only the best
 * few are ever held.
 */
export function rank<T extends Signals>(items: T[], k: number, how: SearchHow): (T & { score: number })[] {
  const out: (T & { score: number })[] = [];
  for (const it of items) {
    const score = how === 'meaning' ? blendScore(it) : keywordScore(it) || null;
    if (score !== null && score > 0) out.push({ ...it, score: Math.round(score * 1000) / 1000 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * Two ranked lists as one, taking turns (the phone's search by meaning first, then the brain's), each passage
 * once. For when both answered: their scores are not on the same scale, their ranks are.
 */
export function interleave<T extends { doc: string; text: string }>(first: T[], second: T[], k: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (let i = 0; out.length < k && (i < first.length || i < second.length); i++) {
    for (const h of [first[i], second[i]]) {
      if (!h || out.length >= k) continue;
      const key = `${h.doc}|${h.text.slice(0, 120)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
    }
  }
  return out;
}
