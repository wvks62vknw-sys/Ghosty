/**
 * The catalogue's words for LIFE EASIER (BRIEF-OCT-IDEAS-2): "what did I miss?", "teach me what you learned this week", "tell me when
 * this price drops", and WATCHERS under PLAN (Agenda). The rest of the slice has no registry item of its own: "Hey Siri, ask Ghosty"
 * and "Send to Ghosty" are in Settings → SHORTCUTS, the Brief read aloud is a switch in Settings → VOICE, the money nudges are on the
 * SPENDING panel, the letter's REMIND and FILE are on the Lens plate, and the Brief's email line is in YOUR DAY. Joined into
 * APP_WORDS in app.ts. The rules are catalogue.ts `wordProblems`.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-11';

export const LIFEEASIER_WORDS: Record<string, CatValue> = {
  'phrase:missed': {
    name: 'What did I miss', line: 'You can ask "what did I miss?" and I tell you what came while you were away, from your own things only.',
    more: 'Your diary items that passed, the headlines you did not see, spending you added, school and training news, and what I sent you that you have not read. Put together on the phone with no AI; a card on Home does it by itself after a day away.',
    say: ['What did I miss?', 'Catch me up'], scene: ['talking', 'morning'], cat: 'talk',
    go: { ask: 'What did I miss?', send: false }, since: SINCE,
  },
  'phrase:teach': {
    name: 'Teach me what you learned', line: 'You can ask me to teach you what I learned this week and I tell you in five sentences or fewer, and read it out.',
    more: 'From my report card’s numbers, what I learned to do and the loss in the GYM I studied. Where my brain cannot be reached I use the last copy this phone kept, and say so. No AI writes it.',
    say: ['Teach me what you learned this week', 'What did you learn this week?'], scene: ['talking', 'behind'], cat: 'talk',
    go: { ask: 'Teach me what you learned this week', send: false }, since: SINCE,
  },
  'phrase:watcher': {
    name: 'Tell me when it changes', line: 'You can say "tell me when this price drops" with a page’s address and I watch it every hour and tell you once.',
    more: 'A price that goes down, a page whose words change, or a strike on your line’s status page. Public pages only: never a login, never a person’s page. I tell you once when it trips; STOP is on each in Agenda.',
    say: ['Tell me when this price drops', 'Tell me when this page changes', 'Tell me when there’s a strike on my line'], scene: ['talking', 'watching'], cat: 'watch',
    go: { ask: 'Tell me when this price drops ', send: false }, needs: ['brain'], since: SINCE,
  },
  'panel:agenda:WATCHERS': {
    name: 'The pages I am watching', line: 'You can see the pages I watch for you, what each waits for, what I told you, and stop any with one tap.',
    more: 'I read each public page every hour on my brain’s clock and tell you once when it trips. A page that asks for a login is refused; one that cannot be read changes nothing and says so.',
    say: ['Tell me when this price drops', 'What are you watching for me?'], scene: ['watching', 'phone'], cat: 'watch', needs: ['brain'],
    since: SINCE,
  },
};
