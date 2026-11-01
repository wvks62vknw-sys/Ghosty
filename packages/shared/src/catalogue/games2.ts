/**
 * The catalogue's words for the two games made by us in the ARCADE (BRIEF-GAMES-2): the block world and the runner,
 * keyed as the arcade's registry items, `arcade:<shelf id>`. They join CATALOGUE (app.ts APP_WORDS) at the merge that
 * puts the arcade's shelf into the phone's registry (abilities/sources.ts); until then nothing lists them, so the
 * completeness test would call them stale. Rules: catalogue.ts `wordProblems` (apps/edge/test/games2.test.mjs holds
 * these two to them now).
 */
import type { CatValue } from '../catalogue';

export const GAMES2_WORDS: Record<string, CatValue> = {
  'arcade:block-world': {
    name: 'Build in the block world',
    line: 'You can walk, dig and build in a world of blocks, and I build what you say beside you, block by block.',
    more: 'Hills, caves, lakes and trees from a seed, day into night, three worlds kept on this phone. Tap BUILD and say a house, castle, tower, bridge, pyramid, wall, pool, garden, maze, statue of a cat, boat or lighthouse; add small, big or huge, and stone, wood, glass, brick or gold. All of it runs on the phone, with no model.',
    say: ['Build me a big stone castle', 'Play the block world'],
    scene: ['playing'],
    cat: 'play',
    go: { open: 'arcade' },
    since: '2026-11-01',
  },
  'arcade:runner': {
    name: 'Run from the shadow',
    line: 'You can run three lanes through a city at dawn, a tunnel, a bridge and the rooftops, with a shadow at your heels.',
    more: 'Swipe to change lane, jump and roll; coins, a magnet, a shield, a doubler and a jump boost. The second stumble and the shadow has you. Your best is kept, and my own best shows on the track once I have one.',
    say: ['Play the runner', 'Beat my runner score'],
    scene: ['playing'],
    cat: 'play',
    go: { open: 'arcade' },
    since: '2026-11-01',
  },
};
