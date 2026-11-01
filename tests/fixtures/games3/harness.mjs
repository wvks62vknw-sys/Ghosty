// The harness for the three games of BRIEF-GAMES-3 (tests/games3.spec.mjs bundles this with esbuild): the player at its
// smallest — a full-screen canvas, the shared Intent, the events, the real SaveStore — starting the game named in
// ?game= (kart | hopper | arena) with the words in ?args= (comma-separated: the kart's laps=1 and auto, the arena's
// round=20) and putting what the spec needs on window.__g3.
import { saveStore } from '../../../apps/web/src/arcade/engines/saves';
import { idle } from '../../../apps/web/src/arcade/input';
import { arenaEngine } from '../../../apps/web/src/arcade/games/arena/index';
import { hopperEngine } from '../../../apps/web/src/arcade/games/hopper/index';
import { kartEngine } from '../../../apps/web/src/arcade/games/kart/index';
import { ARENA_ID, HOPPER_ID, KART_ID } from '../../../apps/web/src/arcade/games/shelf3';

const q = new URLSearchParams(location.search);
const game = q.get('game') ?? 'kart';
const args = (q.get('args') ?? '').split(',').filter(Boolean);
const stage = document.getElementById('stage');
const canvas = document.createElement('canvas');
canvas.setAttribute('role', 'img');
canvas.setAttribute('aria-label', { kart: 'The kart racer, playing', hopper: 'The hopper, playing', arena: 'The arena, playing' }[game] ?? game);
stage.append(canvas);
const intent = idle();
const events = { quit: 0, hits: 0, levels: [], error: '' };
const engine = { kart: kartEngine, hopper: hopperEngine, arena: arenaEngine }[game];
const id = { kart: KART_ID, hopper: HOPPER_ID, arena: ARENA_ID }[game];
const t0 = performance.now();
const g3 = { intent, events, canvas, game, ready: false };
window.__g3 = g3;
try {
  g3.handle = await engine.start(canvas, {}, intent, {
    onHit: () => events.hits++,
    onLevelDone: (score, words) => events.levels.push([score, words]),
    onError: (e) => (events.error = e.message),
    onQuit: () => events.quit++,
  }, { saves: saveStore(id), sound: true, args });
  g3.startMs = performance.now() - t0;
  g3.ready = true;
} catch (e) {
  events.error = String(e?.message ?? e);
}
