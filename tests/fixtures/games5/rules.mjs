// What the spec needs of the games' rules on the node side: positions found by playing at random (so it can hand the page a game
// that is one move from won and know which move wins), bundled by tests/games5.spec.mjs with esbuild.
export * from '../../../apps/web/src/arcade/games/board/kit';
export { draughts } from '../../../apps/web/src/arcade/games/board/draughts';
export { othello } from '../../../apps/web/src/arcade/games/board/othello';
export { connect4 } from '../../../apps/web/src/arcade/games/board/connect4';
export { backgammon } from '../../../apps/web/src/arcade/games/board/backgammon';
