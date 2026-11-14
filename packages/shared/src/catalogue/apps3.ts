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
  'panel:system:CLOCK AND CALCULATOR': {
    name: 'The clock and the calculator',
    line: 'You can open the clock (world clocks, a stopwatch and timers) and the calculator (sums with a tape) in one tap.',
    more: 'Both are apps of their own, kept on your phone and working with no signal. The clock knows seventy cities and their summer time; its timers ring like the kitchen’s. The calculator works sums out on the phone and keeps each answer on its tape, which you can search, undo and share as a spreadsheet file.',
    say: ['Open the clock', 'Calculator'],
    scene: ['phone'],
    cat: 'know',
    since: SINCE,
  },
  'phrase:clockapp': {
    name: 'The clock by words',
    line: 'You can say "open the clock", "world clock" or "stopwatch" and I open the clock there.',
    more: 'World clocks for the cities you keep, how each stands to here, a stopwatch with laps and timers that ring. "Set a timer for 5 minutes" still sets one straight away.',
    say: ['Open the clock', 'World clock', 'Stopwatch'],
    scene: ['phone'],
    cat: 'know',
    since: SINCE,
  },
  'phrase:calcapp': {
    name: 'The calculator by words',
    line: 'You can say "calculator" and I open it: a keypad, a keyboard, and a tape of every answer.',
    more: 'Sums are worked out on your phone with no request: + − × ÷, brackets, powers and a shop’s percent (64.80 + 15%). Tap an answer on the tape to use it again.',
    say: ['Calculator', 'Open the calculator'],
    scene: ['phone'],
    cat: 'know',
    since: SINCE,
  },
  'phrase:arcaderecord': {
    name: 'Your arcade record by words',
    line: 'You can say "show my trophies" or "continue my game" and I open the arcade there, with how many you have earned or what you played last.',
    more: 'Worked out on your phone from what you played: nothing is sent anywhere. A game starts only on your tap, so its sound can play.',
    say: ['Show my trophies', 'Continue my game', 'What did I play last?'],
    scene: ['playing'],
    cat: 'play',
    since: SINCE,
  },
};
