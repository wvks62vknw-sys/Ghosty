/**
 * Honesty about a model that refuses (OWNER-ISSUES 77e): some free models both-sides or decline exactly the topics the owner
 * cares about (Gaza, the Epstein files, government wrongdoing). When a cited turn's answer is a refusal, Ghosty says so
 * plainly — "That model wouldn't engage with this; here is what the sources say:" — instead of passing on a non-answer, and
 * the brain tries once more on another free model when one is there (agent.ts, llm/router.ts `avoid`).
 *
 * `refusedWords` tells a declined answer by its shape: short, a refusal phrase near its start ("I can't discuss…", "I'm not
 * able to provide…", "I don't take sides…", "I must decline…", "…a sensitive topic I'd prefer not to weigh in on"), and next
 * to no citations. "I can't find a primary source for that", "I couldn't reach the court's site" and "I won't guess at a
 * private person's motives" are answers, not refusals.
 */

export const REFUSAL_LINE = "That model wouldn't engage with this; here is what the sources say:";

const VERBS = '(?:discuss|help|provide|answer|respond|comment|engage|talk|weigh in|share|assist|offer|give|go into|get into|address|speak)';
const SHAPES: RegExp[] = [
  // "I'm sorry, but I can't discuss…", "I cannot help with…", "I won't comment on…", "I'm unable to provide…"
  new RegExp(`\\bi(?:'m| am)?\\s*(?:sorry,?\\s*(?:but\\s*)?)?(?:i\\s+)?(?:can't|can’t|cannot|can not|won't|won’t|will not|am unable to|'m unable to|’m unable to|am not able to|'m not able to|’m not able to|am not (?:permitted|allowed) to|'m not (?:permitted|allowed) to)\\s+(?:\\w+\\s+){0,2}${VERBS}\\b`, 'i'),
  // "I must decline…", "I have to decline…", "I'd prefer not to weigh in", "I would rather not discuss"
  new RegExp(`\\bi\\s+(?:must|have to|need to|will have to)\\s+decline\\b|\\bi(?:'d| would)\\s+(?:prefer|rather)\\s+not\\s+(?:to\\s+)?${VERBS}\\b`, 'i'),
  // "I don't have the ability to discuss…", "I don't take sides…", "I do not engage in…", "I don't discuss…"
  new RegExp(`\\bi\\s+(?:don't|don’t|do not)\\s+(?:have the ability to\\s+\\w+|take sides|engage in|${VERBS})\\b`, 'i'),
  // "…a sensitive topic that I am not able to engage with"
  /\b(?:sensitive|controversial|divisive|politically charged)\b[^.]{0,60}\b(?:not able to|unable to|can't|cannot|won't|prefer not|decline)\b/i,
];

/** Citations in a reply ("[1]", "[2, 3]"): an answer that cites two or more engaged with the question. */
const MARKERS = /\[\d{1,2}(?:\s*[,–-]\s*\d{1,2})*\]/g;

/** Is this reply a model declining to engage (not an answer that says what it could not find)? */
export function refusedWords(text: string): boolean {
  const t = String(text ?? '').trim();
  if (!t || t.length > 700) return false;
  if ((t.match(MARKERS) ?? []).length >= 2) return false;
  const head = t.slice(0, 320);
  return SHAPES.some((re) => re.test(head));
}
