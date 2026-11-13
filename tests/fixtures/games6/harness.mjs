// The harness for the games of BRIEF-GAMES-6 (tests/games6.spec.mjs bundles this with esbuild): the player at its smallest — a
// full-screen canvas, the shared Intent, the events, the real SaveStore — starting the game named in ?game= (poker | words |
// backgammon | draughts …) with the words in ?args= (separated by |: level=N, seed=N, hands=N, stack=N, bag=N, first=0|1, human=1|2,
// fast, nopractice) and putting what the spec needs on window.__g5 (the same name as the pass-5 harness).
import { saveStore } from '../../../apps/web/src/arcade/engines/saves';
import { idle } from '../../../apps/web/src/arcade/input';
import { ENGINES } from '../../../apps/web/src/arcade/engines/index';

const q = new URLSearchParams(location.search);
const game = q.get('game') ?? 'poker';
const args = (q.get('args') ?? '').split('|').filter(Boolean);
const stage = document.getElementById('stage');
const canvas = document.createElement('canvas');
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', `${game}, playing`);
stage.append(canvas);
const intent = idle();
const events = { quit: 0, hits: 0, levels: [], error: '' };
const t0 = performance.now();
const saves = saveStore(game);
const g5 = { intent, events, canvas, game, ready: false, saves };
window.__g5 = g5;
try {
  g5.handle = await ENGINES[game].start(canvas, {}, intent, {
    onHit: () => events.hits++,
    onLevelDone: (score, words) => events.levels.push([score, words]),
    onError: (e) => (events.error = e.message),
    onQuit: () => events.quit++,
  }, { saves, sound: true, args });
  g5.startMs = performance.now() - t0;
  g5.ready = true;
} catch (e) {
  events.error = String(e?.message ?? e);
}
