/**
 * The catalogue's words for BRIEF-TALK-1A (talking to him: speed and presence): ASK MY PHONE under "my models are all cooling
 * down", the one new control in the chat. (Carrying on after a cut, the asides while he works, the "your turn" tone and "that's
 * all" are how a conversation goes, not things to find; they are said in the words of the mic and the chat.) Joined into
 * APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-02';

export const TALK_WORDS: Record<string, CatValue> = {
  'chat:askphone': {
    name: 'Ask my phone instead',
    line: 'You can tap ASK MY PHONE when all my cloud models are cooling down, and the brain on your phone answers at once.',
    more: 'When every free model I can reach is cooling down, I say so in a line with the time the first is back, and wait for it. If the brain on your phone is already awake, the line has ASK MY PHONE: one tap ends the wait and your phone answers the same question, offline.',
    say: ['(tap ASK MY PHONE under "my models are all cooling down")'],
    scene: ['phone', 'talking'],
    cat: 'talk',
    since: SINCE,
  },
};
