/** QUIZ ME ALOUD's ear (learn.c6): what he said, as a choice. Pure, shared with the brain tests. */

export const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
/** How long I listen for an answer. */
export const LISTEN_MS = 5000;

/** What he said, as a choice: a letter ("B", "bee", "letter B"), an ordinal ("the second one") or the choice's own words; -1 none. Pure. */
export function choiceOf(heard: string, choices: string[]): number {
  const t = heard.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t) return -1;
  const sounds: Record<string, number> = { a: 0, ay: 0, eh: 0, b: 1, be: 1, bee: 1, c: 2, see: 2, sea: 2, d: 3, dee: 3, e: 4, f: 5 };
  const one = t.replace(/^(?:it s |its |the answer is |answer |letter |i think |i say )/, '').replace(/ please$/, '');
  if (one in sounds && sounds[one]! < choices.length) return sounds[one]!;
  const ord = ORDINALS.findIndex((o) => new RegExp(`\\b${o}\\b`).test(t));
  if (ord >= 0 && ord < choices.length) return ord;
  const words = choices.map((c) => c.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').trim());
  const hit = words.findIndex((w) => w && (t.includes(w) || (w.length > 3 && w.split(' ').every((x) => t.includes(x)))));
  return hit;
}

