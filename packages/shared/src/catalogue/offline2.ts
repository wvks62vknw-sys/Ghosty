/**
 * The catalogue's words for batch ⑥ part 2 (BRIEF-OFFLINE-DEFAULT): the brain on his phone answering FIRST what it has
 * passed (ASK THE CLOUD under such an answer). TRUST itself is a part of SETTINGS → OFFLINE BRAIN (no panel of its own),
 * said in these words too.
 * Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const OFFLINE2_WORDS: Record<string, CatValue> = {
  'chat:askcloud': {
    name: 'Ask the cloud instead',
    line: 'You can tap ASK THE CLOUD under an answer your phone gave first, and the cloud answers the same question under it.',
    more: 'The phone answers first only the kinds of ask its brain passed at school, at the bar you set in Settings, Offline brain, Trust. Your tap is noted: three in a week and that kind goes back to the cloud until the brain’s next report card.',
    say: ['(tap ASK THE CLOUD under an answer from your phone)'],
    scene: ['phone', 'talking'],
    cat: 'talk',
    since: SINCE,
  },
};
