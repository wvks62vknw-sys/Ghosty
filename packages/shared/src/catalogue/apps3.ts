/**
 * The catalogue's words for SYSTEM AND SETTINGS in the apps round (APPS-POLISH3): the console-class Arcade's new parts, its
 * game pages, CONTINUE PLAYING and THE TROPHY ROOM. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-14';

export const APPS3_WORDS: Record<string, CatValue> = {
  'panel:arcade:CONTINUE PLAYING': {
    name: 'Carry on where you were',
    line: 'You can pick up the games you played lately, newest first, each with when you last played, your sittings and your time.',
    more: 'CONTINUE starts the game at once; a game that keeps saves loads them from its own menu. The arrow opens the game’s page. All of it is kept on your phone and never sent anywhere.',
    say: ['Continue my game', 'What did I play last?'],
    scene: ['playing'],
    cat: 'play',
    since: SINCE,
  },
  'panel:arcade:THE TROPHY ROOM': {
    name: 'Trophies you earned playing',
    line: 'You can see the trophies you earned in the arcade: five for every game, the ones you made included, and five for the arcade as a whole.',
    more: 'A trophy is only ever earned by playing: a first go, ten minutes, an hour, coming back five times and setting a best, and across the arcade five games, ten games, five hours, seven days and playing a game you made. Each game’s page shows how far along you are. Nothing is bought and nothing leaves your phone.',
    say: ['Show my trophies', 'What have I earned?'],
    scene: ['playing'],
    cat: 'play',
    since: SINCE,
  },
};
