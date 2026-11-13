/**
 * THE BRIEF BY CHAT (planlane): the words that work this screen from the chat, read on the phone with no model, in many wordings.
 * Pure (no DOM, no storage): the spec and the chat both read this. Returns null when the words are not for this screen, so the next
 * table (and then the brain) gets them. Never take words another table owns ("play music", "open the agenda": the VOICE lane's meanings).
 *
 * Taken here: the morning's asks for the whole day ("good morning", "what's my day look like", "give me the rundown", "what do I need
 * to know today", "brief me", "my morning briefing"). Not taken: "brief me on X" or "the rundown on X" (a subject: the brain's), and
 * anything longer than an ask (the page's own BRIEF ME hands the chat a long message of facts: that goes to the brain).
 */
export type BriefAsk = { what: 'rundown'; [k: string]: unknown };

const WORDINGS: RegExp[] = [
  // a greeting that starts the day
  /^(?:good )?morning(?: (?:ghosty|ghost|mate|buddy|pal))?$/,
  // the day in one look
  /^(?:what(?:'s| is| does) )?(?:my|the) day (?:look(?:ing)?|looks) like(?: today)?$/,
  /^(?:what(?:'s| is) )?my day (?:like|looking like|ahead)(?: today)?$/,
  /^how(?:'s| is| does) my day (?:look(?:ing)?|shaping up)(?: today)?$/,
  /^what(?:'s| is) (?:the plan|happening) (?:for )?today$/,
  // the rundown
  /^(?:give me |gimme |let(?:'s| us) (?:have|get) |can i (?:have|get) |what(?:'s| is) )?(?:the|a|my|today's|this morning's) (?:rundown|run down|lowdown|low down)(?: for today| today| for the day)?$/,
  /^rundown(?: please)?$/,
  // what he needs to know
  /^what (?:do|should) i (?:need to |have to )?know (?:today|this morning|for today|about today)$/,
  /^anything i (?:need|should|have) to know (?:today|this morning|about today)$/,
  /^(?:catch me up|fill me in)(?: on today| for today)?$/,
  // the brief itself
  /^brief me$/,
  /^(?:give me |read me |show me |what(?:'s| is) )?(?:my|the|today's|a) (?:morning |daily )?brief(?:ing)?(?: for today)?$/,
  /^(?:morning|daily) brief(?:ing)?$/,
];

export function briefAsked(text: string): BriefAsk | null {
  const t = text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/^(?:hey |hi |ok |okay |so )?(?:ghosty[, ]+)?/, '')
    .replace(/(?:,? (?:ghosty|please))+[\s?!.]*$/, '')
    .replace(/[\s?!.,]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || t.length > 60) return null;
  return WORDINGS.some((w) => w.test(t)) ? { what: 'rundown' } : null;
}
