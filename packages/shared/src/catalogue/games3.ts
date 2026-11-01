/**
 * The catalogue's words for the three games that followed in the ARCADE (BRIEF-GAMES-3): the kart racer, the hopper and
 * the arena, keyed as the arcade's registry items, `arcade:<shelf id>`. Like GAMES2_WORDS they join CATALOGUE at the
 * merge that puts the arcade's shelf into the phone's registry; until then nothing lists them (the completeness test
 * would call them stale), and apps/edge/test/games3.test.mjs holds them to catalogue.ts `wordProblems` now.
 */
import type { CatValue } from '../catalogue';

export const GAMES3_WORDS: Record<string, CatValue> = {
  'arcade:kart-racer': {
    name: 'Race karts against me',
    line: 'You can race karts against me and two of my bots on a seaside loop, a mountain pass and a city at night.',
    more: 'Three laps with drifts that build a boost, item boxes with a boost, a shield, an oil slick and a homing orb, and a start light. Your lap records are kept for each track, and so are mine. Steer with the stick or two buttons; it plays best turned sideways. All of it runs on the phone, with no model.',
    say: ['Race me in the karts', 'Play the kart racer'],
    scene: ['playing'],
    cat: 'play',
    go: { open: 'arcade' },
    since: '2026-11-01',
  },
  'arcade:hopper': {
    name: 'Hop across the roads',
    line: 'You can hop across roads, rivers and railways, row after row, with a fog rolling in behind you.',
    more: 'Tap to hop forward and swipe to sidestep. Dodge the cars, lorries and trains, ride the logs and lily pads, and pick up coins to unlock a chicken, a robot or my own figure. My best is the line across the road.',
    say: ['Play the hopper', 'Beat my hopper score'],
    scene: ['playing'],
    cat: 'play',
    go: { open: 'arcade' },
    since: '2026-11-01',
  },
  'arcade:arena': {
    name: 'Grow in the arena',
    line: 'You can steer a glowing cell in an arena, eating smaller ones and running from bigger ones, against twelve of my bots.',
    more: 'Drag to steer, split to catch, eject to lighten up, and stay off the spiky ones once you are big. A round lasts three minutes or until you are eaten. My best is the faint ring round your cell.',
    say: ['Play the arena', 'Eat or be eaten'],
    scene: ['playing'],
    cat: 'play',
    go: { open: 'arcade' },
    since: '2026-11-01',
  },
};
