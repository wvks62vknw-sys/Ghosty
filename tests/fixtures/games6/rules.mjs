// What the spec needs of the games' rules on the node side (bundled by tests/games6.spec.mjs with esbuild): the rules of poker and
// the word game, the list reader, and the backgammon rules for finding a turn.
export * from '../../../apps/web/src/arcade/games/board/kit';
export * from '../../../apps/web/src/arcade/games/board/poker';
export * from '../../../apps/web/src/arcade/games/board/words';
export { backgammon } from '../../../apps/web/src/arcade/games/board/backgammon';
