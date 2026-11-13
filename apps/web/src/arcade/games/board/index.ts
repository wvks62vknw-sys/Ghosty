/** The four board games as Engines of the arcade (shell.ts is the frame, draw.ts the boards, engine.ts Ghosty's search). */
import { GAMES5 } from '../shelf5';
import { backgammonUI, connect4UI, draughtsUI, othelloUI } from './draw';
import { makeBoardEngine } from './shell';

const entry = (id: string) => GAMES5.find((e) => e.id === id)!;
export const draughtsEngine = makeBoardEngine('draughts', draughtsUI, entry('draughts'));
export const othelloEngine = makeBoardEngine('othello', othelloUI, entry('othello'));
export const backgammonEngine = makeBoardEngine('backgammon', backgammonUI, entry('backgammon'));
export const connect4Engine = makeBoardEngine('connect4', connect4UI, entry('connect4'));
