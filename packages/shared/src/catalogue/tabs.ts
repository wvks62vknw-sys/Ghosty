/**
 * [tabs] The words for every feature that became a screen of its own (BRIEF-TABS; OWNER-ISSUES 119, his words: "can't we add
 * tabs for everything we have like all the tabs we already have"): the seventh area, LIFE, its hub and its eight screens (the
 * money, body, kitchen, people, work, creative, outside and home packs), the LEARNING pack and the coach on LEARN, the
 * converter, the documents and the house on MAKE, and his social self on ME — each screen, its card on its hub, and the
 * deck's lines for it (a deck line that does what an entry already says is that entry: `same`). The chat's phrases and the
 * packs' actions keep their own words (catalogue/packs*.ts, restb.ts, restd.ts, reste.ts, social.ts): a screen is the
 * second door to the same things.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-01';

export const TABS_WORDS: Record<string, CatValue> = {
  // ---- the LIFE area (its hub: the eight everyday screens as cards)
  'screen:area-life': {
    name: 'The LIFE area', line: 'You can tap LIFE for the everyday: money, body, kitchen, people, work, creative, outside and home.',
    more: 'Eight screens, one for each of the everyday packs, each card with its own reading: what is due, the timers running, the people you told me about. The chat still opens each of them by its own words.',
    say: ['(tap Life)'], scene: ['money', 'out'], cat: 'do', since: SINCE,
  },
};
