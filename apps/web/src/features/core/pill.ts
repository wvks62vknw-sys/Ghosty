/** The live-state pill's words (HOMEPASS). Pure, so the spec reads the same function the page does. */

/** Work in hand, as the pill says it: upper case, at most `max` characters, cut at a word with an ellipsis, never in the middle of one. */
export function pillWords(status: string, max = 40): string {
  const t = status.replace(/\s+/g, ' ').trim().toUpperCase();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(' ');
  return `${(at > 12 ? cut.slice(0, at) : cut).replace(/[ ,.;:…-]+$/, '')}…`;
}
