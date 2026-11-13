/** The four board games as Engines of the arcade (shell.ts is the frame, draw.ts the boards, engine.ts Ghosty's search), and poker and the word game (their own frames). */
import { GAMES5 } from '../shelf5';
import { GAMES6 } from '../shelf6';
import { backgammonUI, connect4UI, draughtsUI, othelloUI } from './draw';
import { makePokerEngine } from './pokershell';
import { makeBoardEngine } from './shell';
import { makeWordsEngine } from './wordshell';

const entry = (id: string) => GAMES5.find((e) => e.id === id)!;
export const draughtsEngine = makeBoardEngine('draughts', draughtsUI, entry('draughts'));
export const othelloEngine = makeBoardEngine('othello', othelloUI, entry('othello'));
export const backgammonEngine = makeBoardEngine('backgammon', backgammonUI, entry('backgammon'));
export const connect4Engine = makeBoardEngine('connect4', connect4UI, entry('connect4'));
const entry6 = (id: string) => GAMES6.find((e) => e.id === id)!;
export const pokerEngine = makePokerEngine(entry6('poker'));
export const wordsEngine = makeWordsEngine(entry6('words'));
