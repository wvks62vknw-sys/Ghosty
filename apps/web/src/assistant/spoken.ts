/**
 * A reply as Ghosty says it out loud (pure, no audio here: tested in Node, apps/edge/test/speech.test.mjs).
 * `clean` takes off what a voice must not read (code, links, markdown, list markers); `sentences` cuts
 * it into the pieces the voice says one at a time — never inside a number ("£1.42", "8.30am", "12.5
 * miles") or after a short form ("e.g.", "Dr."), so a price or a time is said in one breath, not as
 * "one" … pause … "forty-two".
 */

/** Short forms that end in a full stop but never end a sentence. */
const SHORT = /(?:^|\s)(?:e\.g|i\.e|etc|vs|approx|Mr|Mrs|Ms|Dr|St|Prof|No|Nos|Fig|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|[A-Z])\.$/;

/** What the voice reads: no code, links, markdown or list markers; a line break becomes a full stop. */
export function clean(t: string): string {
  return t
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, 'link')
    // A list item's marker ("- ", "• ", "1. ", "2) ") at the start of a line is not said.
    .replace(/^[ \t]*(?:[-*•▪◦]|\d{1,2}[.)])[ \t]+/gm, '')
    .replace(/[*_#`>~|]+/g, ' ')
    // A line break ends a sentence, unless the line already did ("Saturday:" → "Saturday.", "done." stays "done.").
    .replace(/[ \t]*([.!?])?[ \t]*[:;,]?[ \t]*\n+\s*/g, (_m, end: string | undefined) => `${end ?? '.'} `)
    .replace(/\bkm\b/g, 'kilometres')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** The sentences of a reply, none longer than `max` characters (a long one is cut at a comma, else a space). */
export function sentences(t: string, max = 300): string[] {
  const out: string[] = [];
  // A sentence ends at . ! or ? followed by a space (so "8.30" and "£1.42" never split), unless the word before is a short form.
  const raw: string[] = [];
  let from = 0;
  for (const m of t.matchAll(/[.!?]+["')\]]*(?=\s|$)/g)) {
    const end = m.index! + m[0].length;
    if (m[0].startsWith('.') && m[0].length === 1 && SHORT.test(t.slice(Math.max(from, m.index! - 8), m.index! + 1))) continue;
    raw.push(t.slice(from, end));
    from = end;
  }
  if (from < t.length) raw.push(t.slice(from));
  for (const piece of raw) {
    let s = piece.trim();
    while (s.length > max) {
      const slice = s.slice(0, max);
      let cut = Math.max(slice.lastIndexOf(', '), slice.lastIndexOf('; '), slice.lastIndexOf(': ')) + 1;
      if (cut < max / 3) cut = slice.lastIndexOf(' ');
      if (cut < max / 3) cut = max;
      out.push(s.slice(0, cut).trim());
      s = s.slice(cut).trim();
    }
    if (s) out.push(s);
  }
  return out;
}
