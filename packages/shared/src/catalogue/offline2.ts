/**
 * The catalogue's words for batch ⑥ part 2 (BRIEF-OFFLINE-DEFAULT): the brain on his phone answering FIRST what it has
 * passed (ASK THE CLOUD under such an answer), the INDEPENDENCE sheet in System (under its Report card pill), and "how
 * independent are you?" in the chat. TRUST itself is a part of SETTINGS → OFFLINE BRAIN (no panel of its own), said in these words too.
 * Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const OFFLINE2_WORDS: Record<string, CatValue> = {
  'panel:system:INDEPENDENCE': {
    name: 'How independent I am',
    line: 'You can see how much of what you ask stays on your phone, kind by kind, and why the rest still goes to the cloud.',
    more: 'The last seven and thirty days, week by week, and each kind of ask: greetings, sums, spelling, rewording and more. A kind the brain on your phone passed at school is answered there first; the rest says why not: no brain here yet, under your bar, or it needs a tool. Sovereign mode keeps everything on the phone.',
    say: ['How independent are you?', 'Show me the independence meter'],
    scene: ['phone', 'behind'],
    cat: 'know',
    since: SINCE,
  },
  'phrase:independent': {
    name: 'How independent are you',
    line: 'You can ask "how independent are you?" and I say how much of your week stayed on your phone, and open the meter.',
    more: 'Worked out on the phone with no AI, from the line each answer carries. The sheet opens on System: each kind of ask, what your own brains answered, and what still needs the cloud and why.',
    say: ['How independent are you?', 'Independence meter'],
    scene: ['phone', 'talking'],
    cat: 'talk',
    go: { ask: 'How independent are you?' },
    since: SINCE,
  },
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
