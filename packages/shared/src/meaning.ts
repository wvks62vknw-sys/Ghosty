/**
 * SEARCH BY MEANING, the pure parts: how a passage of the library copy on the phone is scored for a question,
 * and how its meaning vector is kept small. No browser, no model: apps/web/src/library/local.ts (searchLocal,
 * passagesFor) uses them, and apps/edge/test/meaning.test.mjs tests them.
 *
 * A vector is the small model's 384 numbers for a text (offline/embed.ts), scaled to length 1, so the cosine of
 * two vectors is their dot product: the higher, the closer in meaning (see Spread for what the real model gives).
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
 * Everyday words that are not STOP words but say little about WHAT is asked ("what happens during mitosis",
 * "explain osmosis", "nothing here"): a passage that shares only these with a question is not a match for it. The
 * brain's search (library/store.ts) and the phone's (wordMatcher) both judge a match by the other words.
 */
export const COMMON = new Set(
  'here there nothing something anything everything thing things way ways work works working worked time times part parts kind kinds sort sorts lot lots good bad better best new old big small first last long great little own right left high low same different next early late young important few able back after before over under again still even much many well each every between during without within through upon around while because since until though although happen happens happened happening mean means meant say says said know knows knew think thinks thought look looks looking find finds found take takes took made makes making come comes came goes going went done doing see seen saw year years day days people person man men woman women world life place point number case fact question questions answer answers example examples problem problems group groups area areas end start starts help helps used uses called name named often usually always never sometimes really actually simply explain explains explained describe described difference differences definition define defined stop stops keep keeps let put set top main whole real true false yes ago today tomorrow yesterday thanks thank hello'.split(' '),
);
/** The question's words that say what it is about: those not in COMMON (all of them when every one is). */
export function rareTerms(terms: string[]): string[] {
  const rare = terms.filter((t) => !COMMON.has(t));
  return rare.length ? rare : terms;
}

/**
 * How much of the question's wording a text has: `words` is the share of its search words found (by their first
 * few letters, so "plants" finds "plant"), and `matched` says whether that is enough to count as a keyword match
 * (half the words for a question of three words or more, every word otherwise). Null: the question has no
 * search words at all.
 */
export function wordMatcher(q: string): ((low: string) => { words: number; matched: boolean }) | null {
  const terms = queryTerms(q);
  if (!terms.length) return null;
  const stem = (t: string) => t.slice(0, Math.max(3, Math.min(t.length, 5)));
  const stems = terms.map(stem);
  // a match needs the words that say what is asked (half of them from three on, else all), not just everyday ones
  const rare = rareTerms(terms).map(stem);
  const need = rare.length >= 3 ? 0.5 : 0.99;
  return (low) => {
    const words = stems.filter((x) => low.includes(x)).length / stems.length;
    return { words, matched: rare.filter((x) => low.includes(x)).length / rare.length >= need };
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
 * How a question's cosines spread over the whole library: their mean and standard deviation. Measured on the real
 * model (snowflake-arctic-embed-s with the query prefix, through this app's vendored worker, Oct 2026), unrelated
 * English passages score 0.30–0.50 and the passages that answer 0.52–0.70, and the background level moves from one
 * question to the next — so a passage is judged by how far it stands out from the rest for THIS question (`z`, in
 * standard deviations), not by a fixed cosine. A few imaginary passages at PRIOR (that measurement) are counted in,
 * so a library of a handful of passages still gets a sensible spread.
 */
export interface Spread {
  mean: number;
  sd: number;
}
export const PRIOR: Spread & { n: number } = { mean: 0.42, sd: 0.06, n: 20 };

/** The spread from `n` cosines, their sum and the sum of their squares (gathered while the search reads). */
export function spreadOf(n: number, sum: number, sumSq: number): Spread {
  const N = n + PRIOR.n;
  const mean = (sum + PRIOR.mean * PRIOR.n) / N;
  const sq = (sumSq + PRIOR.n * (PRIOR.sd * PRIOR.sd + PRIOR.mean * PRIOR.mean)) / N;
  return { mean, sd: Math.max(0.02, Math.sqrt(Math.max(0, sq - mean * mean))) };
}

/**
 * The weights. Nearness is 0 up to Z_FLOOR standard deviations above the question's mean and 1 from Z_FULL; a
 * passage is brought up by meaning alone from Z_HIT, and only with a cosine of at least COS_HIT (the real model's
 * unrelated passages stay under it). Meaning outweighs the wording, but a passage with all the question's words
 * and some meaning beats a neighbour without them, and a document or section the question names exactly gets
 * EXACT on top — so exact names still win.
 */
export const MEANING = { Z_FLOOR: 1, Z_FULL: 4, Z_HIT: 1.5, COS_HIT: 0.5, W_MEANING: 0.65, W_WORDS: 0.35, EXACT: 0.5 } as const;

/** What is known about one passage for one question. `cos` is null when the passage has no vector yet. */
export interface Signals {
  words: number;
  matched: boolean;
  exact: boolean;
  cos: number | null;
}

/** How far a cosine stands out for this question, 0–1. */
export function nearness(cos: number | null, sp: Spread = PRIOR): number {
  if (cos === null) return 0;
  const z = (cos - sp.mean) / sp.sd;
  return Math.max(0, Math.min(1, (z - MEANING.Z_FLOOR) / (MEANING.Z_FULL - MEANING.Z_FLOOR)));
}

/** The keyword score, exactly as before search by meaning: the share of the question's words, when they match. */
export const keywordScore = (s: Signals): number => (s.matched ? s.words : 0);

/**
 * The blended score: meaning (how far it stands out) and wording together, plus EXACT for a named title. Null: not
 * a hit at all (no keyword match, no named title, and not near enough in meaning).
 */
export function blendScore(s: Signals, sp: Spread = PRIOR): number | null {
  const near = s.cos !== null && s.cos >= MEANING.COS_HIT && (s.cos - sp.mean) / sp.sd >= MEANING.Z_HIT;
  if (!s.matched && !s.exact && !near) return null;
  return MEANING.W_MEANING * nearness(s.cos, sp) + MEANING.W_WORDS * s.words + (s.exact ? MEANING.EXACT : 0);
}

export type SearchHow = 'meaning' | 'keywords';

/**
 * How much of the library must have its vectors for a search to go by meaning. New passages arrive all day (the
 * copy is refreshed at start-up and every half hour, and Ghosty studies around the clock), and the index catches
 * them up in the background: meanwhile the newest few are found by their words alone, and the small print says
 * how many. Below this share it is keywords for everything.
 */
export const MEANING_SHARE = 0.98;
/** Whether `indexed` of `total` passages is enough to search by meaning. */
export const meaningCovers = (indexed: number, total: number): boolean => total > 0 && indexed >= total * MEANING_SHARE;

/**
 * The best `k` passages, highest first, each with its score: by meaning (blended, against the question's spread)
 * or by keywords alone.
 */
export function rank<T extends Signals>(items: T[], k: number, how: SearchHow, sp: Spread = PRIOR): (T & { score: number })[] {
  const out: (T & { score: number })[] = [];
  for (const it of items) {
    const score = how === 'meaning' ? blendScore(it, sp) : keywordScore(it) || null;
    if (score !== null && score > 0) out.push({ ...it, score: Math.round(score * 1000) / 1000 });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, k);
}

/**
 * While a search reads the library a batch at a time, only a pool of candidates is kept: the `pool` nearest in
 * meaning, the `pool` best by wording and every exactly named one. Every passage that can end in the top `k`
 * (pool ≥ k) is among them, whatever the spread turns out to be.
 */
export function prunePool<T extends Signals>(items: T[], pool: number): T[] {
  if (items.length <= pool * 2) return items;
  const keep = new Set<T>(items.filter((x) => x.exact));
  [...items].sort((a, b) => (b.cos ?? -2) - (a.cos ?? -2)).slice(0, pool).forEach((x) => keep.add(x));
  [...items].sort((a, b) => b.words - a.words).slice(0, pool).forEach((x) => keep.add(x));
  return items.filter((x) => keep.has(x));
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
