/** The pure parts of 👍 / 👎 (rate.ts): a reply's id, and the phone's list of ratings. Tested by apps/edge/test/selftrain.test.mjs. */

/** A reply's id: a hash of its words (FNV-1a, 32 bits), the same on every load. */
export function replyId(text: string): number {
  let x = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) x = Math.imul(x ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return x;
}

/** A rating set (or taken back with undefined), moved to the newest end; only the newest `keep` stay. */
export function withRating(list: [number, 1 | -1][], id: number, v: 1 | -1 | undefined, keep = 300): [number, 1 | -1][] {
  const out = list.filter(([x]) => x !== id);
  if (v) out.push([id, v]);
  return out.slice(-keep);
}
