/**
 * [consistency] The catalogue's words for what the consistency lane built in the next round (NEXT-ROUND): his own one-word routines
 * (Settings → ROUTINES) and the help desk, with the jump bar reading whole sentences.
 */
import type { CatValue } from '../catalogue';

export const CONSISTENCY_WORDS: Record<string, CatValue> = {
  // [consistency] HIS OWN ROUTINES (NEXT-ROUND consistency.s2): one word of his runs a few things in turn
  'panel:settings:ROUTINES': {
    name: 'Your own one-word routines',
    line: 'You can make one word of yours, like “morning”, run a few things in turn: a screen, a panel, words you say to me.',
    more: 'Settings → ROUTINES: give it a word, add steps from the things every screen can do (or words to say to me), put them in order, SAVE. Then say or type the word and I run each step in turn; RUN does it too. Kept on this phone. Anything that would send or post still waits for your APPROVE.',
    say: ['Morning', 'Make a routine', 'My routines'],
    scene: ['talking', 'morning'], cat: 'talk', since: '2026-11-14',
  },
  // [consistency] NEXT-ROUND s1 and u5: "how do I …?" answered with the taps, and the search reading whole sentences
  'app:helpdesk': {
    name: 'Ask how, and get the taps', line: 'You can ask me “how do I …?” and I give the exact taps to it, what it does and TRY IT, right away.',
    more: 'Answered on this phone from what every screen says it does, so it only ever points at what is there. “What can I say here?” gives that screen’s own words. The search understands whole sentences the same way: type “where do I paste a bank statement” and Money comes up. It does sums as you type, too: “15% of 80”.',
    say: ['How do I paste a bank statement?', 'What can I say here?'], scene: ['talking'], cat: 'talk', since: '2026-11-14',
  },
  // [consistency] NEXT-ROUND u4: the guided tour of the house
  'app:tour': {
    name: 'A guided tour of the house', line: 'You can say “show me around” and I walk you through the seven rooms, a few seconds each, with one thing to try in each.',
    more: 'For you, or a friend you show me to. The reply keeps a key into every room; any new word stops the walk where it is, and it ends back on Home.',
    say: ['Show me around', 'Give me a tour'], scene: ['talking'], cat: 'talk', since: '2026-11-14',
  },
};
