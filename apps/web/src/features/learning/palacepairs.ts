/** MEMORY PALACE (learn.s7): the pure parts, pairing his places with his things and scoring his walk back. */
/** The pairs: each thing at a place, in order (as many as there are both). Pure. */
export function palacePairs(places: string[], items: string[]): { place: string; item: string; picture: string }[] {
  const ps = places.map((x) => x.trim()).filter(Boolean);
  const is = items.map((x) => x.trim()).filter(Boolean);
  return is.slice(0, ps.length).map((item, i) => ({ place: ps[i]!, item, picture: `Picture ${item.toLowerCase()} at the ${ps[i]!.toLowerCase()}: make it big, odd and moving, so it sticks.` }));
}

/** How many he recalled: a thing counts when his words for that place hold it (case, spaces and a/the aside). Pure. */
export function palaceScore(pairs: { item: string }[], answers: string[]): number {
  const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(a|an|the|some)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return pairs.filter((p, i) => n(answers[i] ?? '') !== '' && (n(answers[i] ?? '').includes(n(p.item)) || n(p.item).includes(n(answers[i] ?? '')))).length;
}
