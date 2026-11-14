/**
 * THE GAME KINDS (PLAY & MAKE lane): each GameKind's pure logic, one file each, no DOM. The boards that draw them are
 * apps/web/src/features/applib/games/<kind>.ts; the brain tests are apps/edge/test/applibgames.test.mjs.
 * The options each kind reads are documented at the top of its file.
 */
export * as rng from './rng';
export * as sudoku from './sudoku';
export * as mines from './mines';
export * as merge from './merge';
export * as solitaire from './solitaire';
export * as wordguess from './wordguess';
export * as nonogram from './nonogram';
export * as pairs from './pairs';
export * as blocks from './blocks';
export * as snake from './snake';
export * as slide from './slide';
export * as lights from './lights';
export * as simon from './simon';
export * as reaction from './reaction';
export * as hangman from './hangman';
export * as anagram from './anagram';
export * as typing from './typing';
export * as sprint from './sprint';
export * as dots from './dots';
export * as quiz from './quiz';
export * as wordgrid from './wordgrid';
