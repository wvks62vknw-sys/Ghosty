/**
 * Reading a verdict out of a reply's final line, strictly: the words that name each verdict are found as
 * whole words; "not X" (or "isn't X", "nothing … X" just before it) turns a two-way verdict into the other
 * one, and drops a verdict that has no opposite; a line that names more than one distinct verdict ("TRUE
 * or FALSE", "VALID or INVALID") is a hedge and reads as no answer at all.
 */

const NEG = /^(not|no|never|nothing|neither|nor|isn't|aren't|doesn't|don't|wasn't|cannot|can't)$|n't$/;

/**
 * The one verdict a line gives. `table`: [pattern, verdict] pairs, tried in order — an earlier pattern's
 * matches use up their words, so list longer phrases first. `opposite`: what "not X" means for X.
 */
export function oneVerdict<V extends string>(line: string, table: [RegExp, V][], opposite: Partial<Record<V, V>> = {}): V | null {
  const text = line.toLowerCase().replace(/[’`]/g, "'");
  const used: [number, number][] = [];
  const found = new Set<V>();
  for (const [re, v] of table) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of text.matchAll(g)) {
      const a = m.index!;
      const b = a + m[0].length;
      if (used.some(([x, y]) => a < y && b > x)) continue;
      used.push([a, b]);
      // The (up to) three words just before it, within the same clause.
      const before = text.slice(0, a).split(/[.;:!?()—–,]/).pop()!.trim().split(/\s+/).slice(-3);
      const negated = before.some((w) => NEG.test(w));
      if (!negated) found.add(v);
      else if (opposite[v]) found.add(opposite[v]!);
    }
  }
  return found.size === 1 ? [...found][0]! : null;
}

/** Numbers a line gives as its answer: after "=" or ":" when it labels them ("y1 = 4"), else all of them; remarks in brackets left out. */
export function answerNumbers(line: string): number[] {
  const t = line.replace(/[−–]/g, '-');
  const outside = t.replace(/\([^()]*\)/g, ' ');
  const base = /-?\d/.test(outside) ? outside : t.replace(/[()]/g, ' ');
  const labelled = [...base.matchAll(/[=:]\s*(-?\d+)/g)].map((m) => Number(m[1]));
  if (labelled.length) return labelled;
  return (base.match(/-?\d+/g) ?? []).map(Number);
}
