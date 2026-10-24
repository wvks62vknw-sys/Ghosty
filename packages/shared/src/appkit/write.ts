/**
 * The only words a model gives a mini-app (its title, a line under it, list items, habit and player
 * names, timer steps, flash cards), cleaned: no markup, no links, nothing over length — and the app's
 * own name and line may not claim what a web mini-app is not (App Store, notifications, sync, accounts,
 * medical or security promises). A word that fails is dropped and the kit's own is used.
 */
const CLAIMS = /\bapp ?store\b|\bplay store\b|\bnotif\w*|\bremind(?:s|ers?)\b|\balerts? you\b|\bin the background\b|\bsync\w*|\bcloud\b|\bbacked? up\b|\baccounts?\b|\blog ?ins?\b|\bsign ?ins?\b|\bpasswords?\b|\bguarantee\w*|\bcertified\b|\bclinically\b|\bmedically\b|\bdoctors?\b|\bnhs\b|\bai[- ]powered\b|\bsecure\b|\bencrypted\b|\bofficial\b/i;
const PLACEHOLDER = /\blorem\b|\bipsum\b|\btodo:|\btbd\b|\buntitled\b|\bplaceholder\b|\bxxx+\b|\{\{|\}\}/i;

/** Plain text, one line, at most `max` characters; '' for anything with markup, a link or a placeholder. */
export function cleanText(v: unknown, max: number): string {
  if (typeof v !== 'string' && typeof v !== 'number') return '';
  const t = String(v)
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || /<|>|https?:|www\.|javascript:|data:/i.test(t) || PLACEHOLDER.test(t)) return '';
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '').trim() || t.slice(0, max) : t;
}

/** The app's own name or line: clean, and no claim it cannot keep. */
export function cleanWords(v: unknown, max: number): string {
  const t = cleanText(v, max);
  return t && !CLAIMS.test(t) ? t : '';
}
export const claims = (t: string): boolean => CLAIMS.test(t);
export const placeholder = (t: string): boolean => PLACEHOLDER.test(t);

/** A list of short names or items from whatever the model sent (an array, or one string with commas or lines). */
export function cleanList(v: unknown, max: number, each: number): string[] {
  const raw = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\n|,|;/) : [];
  const out: string[] = [];
  for (const x of raw) {
    const t = cleanText(x, each);
    if (t && !out.some((y) => y.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/** Flash cards: [{q, a}] or lines "question | answer" (also " = " or " - "). */
export function cleanCards(v: unknown, max = 200): { q: string; a: string }[] {
  const raw: unknown[] = Array.isArray(v) ? v : typeof v === 'string' ? v.split('\n') : [];
  const out: { q: string; a: string }[] = [];
  for (const x of raw) {
    let q: unknown;
    let a: unknown;
    if (x && typeof x === 'object') ({ q, a } = x as { q?: unknown; a?: unknown });
    else if (typeof x === 'string') [q, a] = x.split(/\s*(?:\||=|\s-\s|→|:)\s*/, 2);
    const qq = cleanText(q, 200);
    const aa = cleanText(a, 300);
    if (qq && aa) out.push({ q: qq, a: aa });
    if (out.length >= max) break;
  }
  return out;
}
