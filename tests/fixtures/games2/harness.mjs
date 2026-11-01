// The harness for the two games made by us (tests/games2.spec.mjs bundles this with esbuild): it is the player, as
// small as it can be — a full-screen canvas, the shared Intent, the events, the real SaveStore — and it starts the game
// named in ?game= (voxel | runner) and puts what the spec needs on window.__g2.
import { saveStore } from '../../../apps/web/src/arcade/engines/saves';
import { idle } from '../../../apps/web/src/arcade/input';
import { runnerEngine } from '../../../apps/web/src/arcade/games/runner/index';
import { BLOCK_WORLD_ID, RUNNER_ID } from '../../../apps/web/src/arcade/games/shelf';
import { voxelEngine } from '../../../apps/web/src/arcade/games/voxel/index';

const game = new URLSearchParams(location.search).get('game') ?? 'voxel';
const stage = document.getElementById('stage');
const canvas = document.createElement('canvas');
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', game === 'runner' ? 'The runner, playing' : 'The block world, playing');
stage.append(canvas);
const intent = idle();
const events = { quit: 0, hits: 0, levels: [], error: '' };
const engine = game === 'runner' ? runnerEngine : voxelEngine;
const t0 = performance.now();
const g2 = { intent, events, canvas, game, ready: false };
window.__g2 = g2;
try {
  g2.handle = await engine.start(canvas, {}, intent, {
    onHit: () => events.hits++,
    onLevelDone: (score, words) => events.levels.push([score, words]),
    onError: (e) => (events.error = e.message),
    onQuit: () => events.quit++,
  }, { saves: saveStore(game === 'runner' ? RUNNER_ID : BLOCK_WORLD_ID), sound: true });
  g2.startMs = performance.now() - t0;
  g2.ready = true;
} catch (e) {
  events.error = String(e?.message ?? e);
}
