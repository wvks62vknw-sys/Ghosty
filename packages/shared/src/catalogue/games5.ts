/**
 * The catalogue's words for the six games of pass 5 in the ARCADE (BRIEF-GAMES-5), keyed as the arcade's registry items,
 * `arcade:<shelf id>`: the platformer, the cave and four board games he can lose to. The board games are search alone until
 * the GYM trains them, and the words say so.
 */
import type { CatValue } from '../catalogue';

const base = { scene: ['playing' as const], cat: 'play' as const, go: { open: 'arcade' }, since: '2026-11-11' };

export const GAMES5_WORDS: Record<string, CatValue> = {
  'arcade:platform': {
    name: 'Run and jump to the flag',
    line: 'You can run and jump through eight worlds of our own to the flag, with a dotted ghost that is my best time.',
    more: 'Land on walkers and hoppers, kick shells, break crates once a glow fruit has made you bigger, and take the checkpoint flag. Three lives and a timer. After the eighth world they come round again, faster and more crowded, and there is no top level. I practise on the real rules and have my own level.',
    say: ['Play the platformer', 'Run and jump to the flag'],
    ...base,
  },
  'arcade:cave': {
    name: 'Explore the cave',
    line: 'You can explore a cave of twelve rooms, find three tools in order, light lanterns that save your place, and find the way out.',
    more: 'Spring boots, a blaster that grows on crystals and a lamp that shows hidden steps each open the cave further, and two things in it are bigger than you. Quit any time and CONTINUE puts you back at the last lantern. Pinch for the map. I play it too, and my furthest room and time are on the card.',
    say: ['Play the cave game', 'Explore the cave'],
    ...base,
  },
  'arcade:draughts': {
    name: 'Play draughts against me',
    line: 'You can play draughts against me, with captures compulsory, and I think for as long as your level says.',
    more: 'I search on this phone, with a take-back, one hint a game and the rules on one card. We each have a rating, kept the way the chess ones are. I am search alone until the GYM trains me, and nothing learns on the phone.',
    say: ['Play draughts', 'Draughts against you'],
    ...base,
  },
  'arcade:othello': {
    name: 'Play Othello against me',
    line: 'You can play Othello against me, flipping my discs by closing them in.',
    more: 'The squares you may play are marked, corners are worth more than they look, and you can take a move back or ask for one hint a game. We each have a rating. I am search alone until the GYM trains me.',
    say: ['Play Othello', 'Othello against you'],
    ...base,
  },
  'arcade:backgammon': {
    name: 'Play backgammon against me',
    line: 'You can play backgammon against me, with the dice rolled fair and shown.',
    more: 'The game rolls the dice, never me. Hit a lone checker, come in from the bar and bear off to win; there is a take-back, one hint a game and the rules on a card. We each have a rating. I am search alone until the GYM trains me.',
    say: ['Play backgammon', 'Backgammon against you'],
    ...base,
  },
  'arcade:connect4': {
    name: 'Play Connect 4 against me',
    line: 'You can play Connect 4 against me, and I am much harder than the one in the GYM.',
    more: 'I search every column as deep as my level allows, so the old trick may work at level 1 and will not at level 12. Take a move back or ask for one hint a game. We each have a rating. I am search alone until the GYM trains me.',
    say: ['Play Connect 4', 'Connect 4 against you'],
    ...base,
  },
};
