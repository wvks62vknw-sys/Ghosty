/**
 * HOME'S TODAY CARD, its words (planlane:home): one pure file (no screen) that the card (features/core/home.ts) and its spec
 * (tests/planlane/home.mjs) both read. The card says what is left in his diary today and the to-dos due today or late (the
 * agenda's TO-DO, kept on this phone), and each of its states in his words. No number on it is made up: each one is a count
 * of the list it names.
 */

/** The card's head: "2 left · 1 to-do", "2 left", "3 to-dos", or nothing when there is neither. */
export function todayCount(eventsLeft: number, todosDue: number): string {
  const ev = eventsLeft > 0 ? `${eventsLeft} left` : '';
  const td = todosDue > 0 ? `${todosDue} ${todosDue === 1 ? 'to-do' : 'to-dos'}` : '';
  return [ev, td].filter(Boolean).join(' · ');
}

/** The to-do line: the one to-do's own words, or "3 due: Bins, Renew passport and 1 more". Never cut: the card wraps it. */
export function todoSummary(texts: readonly string[]): string {
  if (!texts.length) return '';
  if (texts.length === 1) return texts[0]!;
  const more = texts.length - 2;
  return `${texts.length} due: ${texts.slice(0, 2).join(', ')}${more > 0 ? ` and ${more} more` : ''}`;
}

/** Where a tap on the card goes: the to-do list when to-dos are all that is left today, else the agenda's diary. */
export function todayTap(eventsLeft: number, todosDue: number): 'todo' | 'diary' {
  return eventsLeft === 0 && todosDue > 0 ? 'todo' : 'diary';
}
export const todayAria = (to: 'todo' | 'diary'): string => (to === 'todo' ? 'Today: open your to-do list' : 'Today: open the agenda');

/** The card's states, said where they are drawn (home.ts). */
export const TODAY_WORDS = {
  loading: 'Checking your diary…',
  error: 'I can’t read your diary just now. I’ll look again in two minutes.',
  offline: 'No signal, so I can’t read your diary. It comes back with the signal.',
  emptyDay: 'Nothing in your diary today. Tell me one thing and I’ll keep it.',
  nothingMore: 'Nothing more today.',
};

/**
 * A free square round the orb (THE MAP's square of nine, GOD'S EYE's wall of feeds): what fills it, said once, not "nothing yet"
 * in every square. The words follow the square's role, not its place among the free ones: a square the next screen he opens fills
 * says so ('recent'), the square the next pin fills says how to pin ('pin'); only the first free square of each role says it, and
 * a square nothing can fill ('none') is only "Free". Short enough for two lines in the narrowest cell at his largest text.
 */
export const FREE_WORDS = { recent: 'Recents go here', pin: 'Hold to pin' } as const;
export function freeSquare(role: 'recent' | 'pin' | 'none', first: boolean): string {
  return first && role !== 'none' ? FREE_WORDS[role] : '';
}
/** THE MAP's free squares, in order (they all come after its 3 recents and 4 pins): the next screen opened fills the first free
 * square while there are fewer than 3 recents; the next pin fills the first square after that, while there are fewer than 4 pins. */
export function mapFreeRoles(recents: number, pins: number): ('recent' | 'pin')[] {
  return [...(recents < 3 ? (['recent'] as const) : []), ...(pins < 4 ? (['pin'] as const) : [])];
}

/** Home's second line when to-dos are due today or late and nothing else needs him: never "Nothing needs you" over a to-do. */
export function todoNeeds(n: number): string {
  return n === 1 ? 'One thing on your to-do list today.' : `${n} things on your to-do list today.`;
}
