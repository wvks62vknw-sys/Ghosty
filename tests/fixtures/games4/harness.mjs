// The harness for the games of BRIEF-GAMES-4 (tests/games4.spec.mjs bundles this with esbuild): the player at its smallest
// — a full-screen canvas, the shared Intent, the events, the real SaveStore — starting the game named in ?game= (blocks |
// blast | flap | climb | beat) with the words in ?args= (comma-separated: level=N, seed=N, auto, nopractice) and putting what the
// spec needs on window.__g4.
import { saveStore } from '../../../apps/web/src/arcade/engines/saves';
import { idle } from '../../../apps/web/src/arcade/input';
import { ENGINES } from '../../../apps/web/src/arcade/engines/index';

const q = new URLSearchParams(location.search);
const game = q.get('game') ?? 'blocks';
const args = (q.get('args') ?? '').split(',').filter(Boolean);
const stage = document.getElementById('stage');
const canvas = document.createElement('canvas');
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', `${game}, playing`);
stage.append(canvas);
const intent = idle();
const events = { quit: 0, hits: 0, levels: [], error: '' };
const t0 = performance.now();
const g4 = { intent, events, canvas, game, ready: false };
window.__g4 = g4;
try {
  g4.handle = await ENGINES[game].start(canvas, {}, intent, {
    onHit: () => events.hits++,
    onLevelDone: (score, words) => events.levels.push([score, words]),
    onError: (e) => (events.error = e.message),
    onQuit: () => events.quit++,
  }, { saves: saveStore(game), sound: true, args });
  g4.startMs = performance.now() - t0;
  g4.ready = true;
} catch (e) {
  events.error = String(e?.message ?? e);
}
