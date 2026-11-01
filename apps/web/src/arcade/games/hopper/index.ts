/**
 * THE HOPPER, as an Engine: tap (or swipe up) to hop forward, swipe left or right to sidestep, down to hop back; a pad's
 * d-pad, A forward and B back; a keyboard's arrows. Rows of grass, road, river and rail laid out from a seed by sim.ts
 * (never an impossible one), drawn by scene.ts in our own blocky look; a fog rolls in behind and ends a run spent
 * idle. The score is the rows crossed, kept through scores.ts with a best; coins are kept in the game's SaveStore and
 * buy the other hoppers (a hen, a robot, Ghosty's own figure). Ghosty practises on his own (code, no model) each time
 * the game starts, and his best is a line across the road. A run ends on a hit, in the water or in the fog; another
 * starts at once.
 */
import { h } from '../../../core/dom';
import type { EngineEvents, EngineFiles, EngineHandle } from '../../engines/types';
import type { SaveStore } from '../../engines/saves';
import type { Intent } from '../../input';
import { recordScore, scoreOf } from '../../scores';
import { Synth, Tune } from '../audio';
import { accentHex, clamp, cssSize, fitCanvas, type Game3Id, type GameEngine, type GameStats, haptic, hapticIfNoVibrate, hudButton, Loop, loadThree, makeRenderer, num, Overlay, Resolution } from '../kit';
import { GAMES3, HOPPER_GHOSTY_ID, HOPPER_ID } from '../shelf3';
import { HOPPERS, type HopperKind, makeHopperScene } from './scene';
import { type Death, ghostyPractice, type Move, newRun, padMoves, type PadState, rowAt, type Run, STEP, step, trainAt } from './sim';

export interface HopperStats extends GameStats {
  rows: number;
  coins: number;
  wallet: number;
  x: number;
  r: number;
  alive: boolean;
  death: Death | null;
  fog: number;
  best: number;
  ghostyBest: number | null;
  hopper: HopperKind;
  have: HopperKind[];
}
export interface HopperHandle extends EngineHandle {
  peek(): HopperStats;
  resetStats(): void;
}
type Mode = 'title' | 'play' | 'paused' | 'over' | 'gone';
interface Purse {
  coins: number;
  have: HopperKind[];
  use: HopperKind;
}
const PURSE_FILE = 'hopper.json';
const TITLES: Record<Death, string> = { car: 'Squashed', lorry: 'Flattened', train: 'Hit by the train', water: 'Splash', edge: 'Swept away', fog: 'Lost in the fog' };
const TIPS: Record<Death, string> = {
  car: 'Look both ways, then look again.',
  lorry: 'Lorries are long. Let the whole thing go by.',
  train: 'When the light flashes, wait for the train.',
  water: 'Logs and lily pads, never the water.',
  edge: 'Hop off a log before it carries you away.',
  fog: 'The fog comes for those who stand still.',
};
const MUSIC = { chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]], scale: [0, 2, 4, 7, 9, 12, 14], root: -9, bpm: [112, 132] as [number, number], kick: true, hats: true, bass: [0, 8, 10], bassWave: 'triangle' as OscillatorType, arpWave: 'triangle' as OscillatorType, leadWave: 'square' as OscillatorType, level: 0.22, seed: 41 };

export const hopperEngine: GameEngine<Game3Id> = {
  id: 'hopper',
  start: (canvas, files, intent, ev, opts) => startHopper(canvas, files, intent, ev, opts),
};

async function startHopper(canvas: HTMLCanvasElement, _files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }): Promise<HopperHandle> {
  const t0 = performance.now();
  const T = await loadThree();
  fitCanvas(canvas);
  const renderer = makeRenderer(T, canvas);
  const res = new Resolution();
  const accent = accentHex();
  const view = makeHopperScene(T, accent);
  const synth = new Synth(opts.sound);
  const music = new Tune(synth, MUSIC);
  const entry = GAMES3.find((g) => g.id === HOPPER_ID)!;
  const purse: Purse = { coins: 0, have: ['frog'], use: 'frog' };
  try {
    const raw = await opts.saves.get(PURSE_FILE);
    if (raw) {
      const p = JSON.parse(new TextDecoder().decode(raw)) as Partial<Purse>;
      if (Number.isFinite(p.coins)) purse.coins = Math.max(0, Math.floor(p.coins!));
      if (Array.isArray(p.have)) purse.have = [...new Set(['frog' as HopperKind, ...p.have.filter((k) => HOPPERS.some((x) => x.kind === k))])];
      if (p.use && purse.have.includes(p.use)) purse.use = p.use;
    }
  } catch {
    /* a new purse */
  }
  const savePurse = () => void opts.saves.put(PURSE_FILE, new TextEncoder().encode(JSON.stringify(purse))).catch(() => undefined);
  view.setHopper(purse.use);
  // Ghosty practises a run of his own while the game opens (code, no model): his best is the line across the road
  const practised = ghostyPractice((Math.random() * 2 ** 31) | 0, 45);
  if (practised > 0) recordScore(HOPPER_GHOSTY_ID, practised);
  const ghostyBest = () => scoreOf(HOPPER_GHOSTY_ID)?.best ?? null;
  const best = () => scoreOf(HOPPER_ID)?.best ?? 0;

  let run: Run = newRun(1);
  let mode: Mode = 'title';
  let ended = false;
  let acc = 0, shake = 0, overT = 0, firstFrameMs: number | null = null, hornT = 0, bellT = 0, passed = false, hops = 0;
  const queue: Move[] = [];
  const pad: PadState = { mx: 0, my: 0, held: new Set() };

  // ---------------------------------------------------------------- the overlay
  const ui = new Overlay(canvas, 'g3.g3hop', 'The hopper');
  const rowsEl = h('b.g3rows', '0');
  const coinsEl = h('span.g3coins', '0');
  const hud = h('div.g3hud', { 'aria-hidden': 'true' }, rowsEl, coinsEl);
  const hint = h('div.g3hint', { 'aria-hidden': 'true' });
  const banner = h('div.g3banner', { 'aria-hidden': 'true' });
  const mistEl = h('div.g3mist', { 'aria-hidden': 'true' });
  const swipe = h('div.g3swipe', { role: 'application', 'aria-label': 'Tap to hop forward. Swipe left or right to sidestep, down to hop back.' });
  const pauseBtn = hudButton('g2pause.g3pause', '', 'Pause', () => openPause());
  const moves = h('div.g3moves', ...(['up', 'left', 'right', 'down'] as Move[]).map((m) => hudButton('g3mv', m, m === 'up' ? 'Hop forward' : m === 'down' ? 'Hop back' : `Hop ${m}`, () => queue.push(m))));
  ui.layer.append(mistEl, swipe, hud, hint, banner, pauseBtn, moves);
  const setMode = (m: Mode) => {
    mode = m;
    ui.root.dataset.mode = m;
  };
  let sx = 0, sy = 0, sid = -1, fired = false, sT = 0;
  swipe.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    synth.wake();
    try {
      swipe.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    sid = e.pointerId;
    sx = e.clientX;
    sy = e.clientY;
    sT = performance.now();
    fired = false;
  });
  swipe.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid || fired || mode !== 'play') return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
    fired = true;
    queue.push(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down');
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId !== sid) return;
    sid = -1;
    if (e.type === 'pointerup' && !fired && mode === 'play' && performance.now() - sT < 500) queue.push('up');
  };
  swipe.addEventListener('pointerup', up);
  swipe.addEventListener('pointercancel', up);
  const onKey = (e: KeyboardEvent) => {
    const k = e.key;
    if (k === 'Escape' || k === 'p') {
      if (mode === 'play') openPause();
      else if (mode === 'paused') resumeRun();
      return;
    }
    if (mode !== 'play') return;
    const m: Move | null = k === 'ArrowUp' || k === 'w' || k === ' ' ? 'up' : k === 'ArrowDown' || k === 's' ? 'down' : k === 'ArrowLeft' || k === 'a' ? 'left' : k === 'ArrowRight' || k === 'd' ? 'right' : null;
    if (m) {
      e.preventDefault();
      queue.push(m);
    }
  };
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- what happens, heard and felt
  const happen = () => {
    for (const e of run.events.splice(0)) {
      switch (e.type) {
        case 'hop':
          hops++;
          synth.tone({ f: 480 + (hops % 4) * 40, to: 760 + (hops % 4) * 50, dur: 0.07, type: 'square', vol: 0.06 });
          haptic(5);
          hint.classList.remove('on');
          break;
        case 'bonk':
          synth.tone({ f: 180, to: 120, dur: 0.08, type: 'triangle', vol: 0.1 });
          break;
        case 'land':
          if (e.kind === 'river') synth.noise({ dur: 0.06, f: 380, q: 1.2, vol: 0.12 });
          break;
        case 'row':
          rowsEl.textContent = num(e.r);
          if (e.r % 25 === 0) [659, 784, 988].forEach((f, i) => synth.tone({ f, dur: 0.1, type: 'triangle', vol: 0.09, at: i * 0.07 }));
          {
            const gb = ghostyBest();
            if (gb && e.r === gb + 1 && !passed) {
              passed = true;
              ui.say('You passed my line! I need more practice.', 2600);
              [523, 659, 784, 1046].forEach((f, i) => synth.tone({ f, dur: 0.12, type: 'triangle', vol: 0.1, at: i * 0.08 }));
            }
          }
          break;
        case 'coin':
          synth.tone({ f: 1320, dur: 0.06, type: 'triangle', vol: 0.1 });
          synth.tone({ f: 1760, dur: 0.12, type: 'triangle', vol: 0.09, at: 0.05 });
          coinsEl.textContent = num(run.coins);
          view.burst('coin', e.x, e.r);
          break;
        case 'die': {
          const how = e.how;
          const p = run.p;
          if (how === 'water' || how === 'edge') synth.noise({ dur: 0.5, f: 1400, to: 200, q: 0.8, vol: 0.28 }), view.burst('splash', p.x, p.r);
          else if (how === 'fog') synth.tone({ f: 330, to: 110, dur: 1.1, type: 'sine', vol: 0.16 }), view.burst('fog', p.x, p.r);
          else {
            synth.noise({ dur: 0.25, f: 500, q: 0.6, vol: 0.32 });
            synth.tone({ f: 160, to: 50, dur: 0.35, type: 'square', vol: 0.14 });
            view.burst('squash', p.x, p.r);
            shake = how === 'train' ? 0.6 : 0.35;
          }
          ev.onHit?.();
          hapticIfNoVibrate();
          break;
        }
      }
    }
  };
  // the world's own sounds near him: a horn now and then, the railway's bell while its light flashes
  const ambience = (dt: number) => {
    hornT -= dt;
    bellT -= dt;
    const p = run.p;
    for (let r = p.r - 1; r <= p.r + 2; r++) {
      const row = rowAt(run, r);
      if (row.kind === 'rail' && bellT <= 0 && trainAt(row, run.t)?.light) {
        bellT = 0.42;
        synth.tone({ f: (Math.floor(run.t * 2.4) & 1) ? 1180 : 990, dur: 0.16, type: 'triangle', vol: 0.06 });
      }
      if (row.kind === 'road' && hornT <= 0 && r === p.r + 1) {
        for (const m of row.movers) {
          const x = ((m.x0 + row.dir * row.speed * run.t + 10) % 20 + 20) % 20 - 10;
          if (Math.abs(x - p.x) < 1.6 && Math.random() < 0.02) {
            hornT = 3;
            const f = m.kind === 'lorry' ? 220 : 392;
            synth.tone({ f, dur: 0.16, type: 'square', vol: 0.05 });
            synth.tone({ f: f * 0.8, dur: 0.2, type: 'square', vol: 0.05, at: 0.12 });
          }
        }
      }
    }
  };

  // ---------------------------------------------------------------- menus
  const soundBtn = (back: () => void) => ({ label: `Sound: ${synth.on ? 'on' : 'off'}`, aria: `Sound is ${synth.on ? 'on' : 'off'}: tap to turn it ${synth.on ? 'off' : 'on'}`, act: () => (synth.setOn(!synth.on), synth.wake(), back()) });
  let reopen: () => void = () => openTitle();
  const picker = (back: () => void) =>
    h('div.g3pick', { role: 'group', 'aria-label': 'Your hopper' },
      ...HOPPERS.map((x) => {
        const owned = purse.have.includes(x.kind);
        const using = purse.use === x.kind;
        return h(`button.g2btn.g3hopper${using ? '.sel' : ''}${owned ? '' : '.locked'}` as 'button', {
          type: 'button',
          'aria-label': owned ? `${x.name}${using ? ', chosen' : ': choose'}` : `${x.name}: ${x.cost} coins to unlock`,
          dataset: { id: `hopper-${x.kind}` },
          onclick: (e: Event) => {
            e.stopPropagation();
            synth.wake();
            if (owned) purse.use = x.kind;
            else if (purse.coins >= x.cost) {
              purse.coins -= x.cost;
              purse.have.push(x.kind);
              purse.use = x.kind;
              [784, 988, 1175, 1568].forEach((f, i) => synth.tone({ f, dur: 0.12, type: 'triangle', vol: 0.1, at: i * 0.07 }));
              ui.say(x.kind === 'ghost' ? 'You unlocked me! Now I can hop too.' : `The ${x.name.toLowerCase()} is yours.`, 2400);
            } else {
              ui.say(`${x.cost - purse.coins} more coins for the ${x.name.toLowerCase()}.`, 2200);
              return;
            }
            savePurse();
            view.setHopper(purse.use);
            back();
          },
        }, h('b', x.name), h('i', owned ? (using ? 'Chosen' : 'Choose') : `${x.cost} coins`));
      }),
    );
  const openTitle = () => {
    reopen = openTitle;
    if (mode !== 'title') (run = newRun(1)), view.reset();
    setMode('title');
    music.stop();
    const gb = ghostyBest();
    ui.menu({
      title: 'The hopper',
      line: entry.ghosty,
      notes: [`${best() ? `Your best: ${num(best())} rows · ` : ''}${num(purse.coins)} coins`, ...(gb ? [`My best: ${num(gb)} rows. It is the line across the road.`] : [])],
      extra: picker(openTitle),
      buttons: [
        { label: 'Play', aria: 'Play: start hopping', primary: true, act: () => startRun() },
        { label: 'How to play', act: () => openHow(openTitle) },
        soundBtn(openTitle),
        { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
      ],
    });
    loop.start();
  };
  const openHow = (back: () => void) => {
    reopen = () => openHow(back);
    const how = h('div.g2how',
      h('p', 'Tap anywhere to hop forward. Swipe left or right to sidestep, down to hop back.'),
      h('p', 'Roads: wait for a gap. Lorries are long. Railways: when the light flashes, a train is coming. Rivers: ride the logs and the lily pads; the water ends a run, and so does riding a log off the edge.'),
      h('p', 'Do not stand still too long: a fog rolls in behind you, slowly at first.'),
      h('p', 'Your score is the rows you cross. Coins buy the other hoppers: a hen, a robot and my own figure. My best is the line across the road.'),
      h('p', 'A controller: the d-pad or stick hops, A forward, B back, START pauses. A keyboard: the arrow keys or space.'),
    );
    ui.menu({ title: 'How to play', extra: how, buttons: [{ label: 'Back', act: back }], kind: 'how' });
  };
  const startRun = () => {
    synth.wake();
    run = newRun((Math.random() * 2 ** 31) | 0);
    view.reset();
    queue.length = 0;
    acc = 0;
    overT = 0;
    passed = false;
    ended = false;
    rowsEl.textContent = '0';
    coinsEl.textContent = '0';
    ui.closeMenu();
    setMode('play');
    music.start();
    hint.textContent = 'Tap to hop · swipe ← → to sidestep';
    hint.classList.add('on');
    loop.start();
  };
  const openPause = () => {
    if (mode !== 'play') return;
    reopen = openPause;
    setMode('paused');
    music.stop();
    ui.menu({
      title: 'Paused',
      line: `${num(run.best)} rows, ${num(run.coins)} coins so far.`,
      buttons: [
        { label: 'Resume', primary: true, act: () => resumeRun() },
        { label: 'How to play', act: () => openHow(openPause) },
        soundBtn(openPause),
        { label: 'End run', aria: 'End this run and go back to the start', act: () => (endRun(false), openTitle()) },
        { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
      ],
      kind: 'pause',
    });
    loop.stop();
    draw(0);
  };
  const resumeRun = () => {
    ui.closeMenu();
    setMode('play');
    music.start();
    if (!hostPaused) loop.start();
  };
  /** The run's score and coins kept (once a run). */
  const endRun = (show: boolean) => {
    if (!ended) {
      ended = true;
      const r = recordScore(HOPPER_ID, run.best);
      purse.coins += run.coins;
      savePurse();
      if (show) showOver(r.isBest);
    } else if (show) showOver(false);
  };
  const showOver = (isBest: boolean) => {
    setMode('over');
    music.stop();
    const how = run.p.death ?? 'fog';
    const gb = ghostyBest();
    const line = isBest && run.best > 0 ? `New best: ${num(run.best)} rows. I am writing that one down.` : gb && run.best > gb ? `Past my line by ${num(run.best - gb)}. ${TIPS[how]}` : TIPS[how];
    reopen = overMenu;
    function overMenu() {
      ui.menu({
        title: TITLES[how],
        line,
        notes: [`${num(run.best)} rows · ${num(run.coins)} coins · ${num(purse.coins)} saved`, `Your best: ${num(best())}${gb ? ` · mine: ${num(gb)}` : ''}`],
        buttons: [
          { label: 'Hop again', primary: true, act: () => startRun() },
          { label: 'Menu', act: () => openTitle() },
          soundBtn(overMenu),
          { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
        ],
        kind: 'over',
      });
    }
    overMenu();
    ui.announce(`${TITLES[how]}. ${num(run.best)} rows. ${line}`);
  };

  // ---------------------------------------------------------------- the frame
  let size = { w: 0, h: 0, s: 0 };
  const fit = () => {
    const { w, h: hh } = cssSize(canvas);
    if (w === size.w && hh === size.h && res.scale === size.s) return;
    size = { w, h: hh, s: res.scale };
    renderer.setPixelRatio(res.scale);
    renderer.setSize(w, hh, false);
    view.setAspect(w / hh);
  };
  const draw = (dt: number) => {
    fit();
    view.update(run, dt, { title: mode === 'title', ghostyBest: ghostyBest(), shake });
    renderer.render(view.scene, view.camera);
    // the fog rolling in: a wall of mist from its front down to the bottom of the screen
    const fy = mode === 'title' ? size.h * 2 : view.fogY(run.fog, size.w, size.h);
    mistEl.style.transform = `translateY(${Math.round(Math.min(size.h + 10, fy - 24))}px)`;
    if (firstFrameMs === null) firstFrameMs = performance.now() - t0;
  };
  let prevPause = false;
  const frame = (dt: number) => {
    if (ui.menuOpen) ui.menuPad(intent);
    const pm = padMoves(pad, intent);
    const startPressed = intent.held.has('pause') && !prevPause;
    prevPause = intent.held.has('pause');
    intent.lookX = 0;
    intent.lookY = 0;
    if (startPressed && mode === 'play') openPause();
    if (mode === 'play') {
      queue.push(...pm);
      acc += dt;
      let n = 0;
      while (acc >= STEP && n++ < 40) {
        step(run, queue.shift() ?? 'none', STEP);
        acc -= STEP;
      }
      if (n >= 40) acc = 0;
      happen();
      ambience(dt);
      music.pace = clamp(run.best / 150, 0, 1);
      music.pump();
      if (!run.p.alive) {
        overT += dt;
        if (overT > 0.75) endRun(true);
      }
    } else if (mode === 'title') {
      // the board lives on under the title: the cars and logs keep going
      run.t += dt;
    }
    shake = Math.max(0, shake - dt * 1.3);
    draw(dt);
    res.check(loop.stats);
  };
  const loop = new Loop(frame);

  // ---------------------------------------------------------------- pausing, the tab, quitting
  let hostPaused = false;
  const onHidden = () => {
    if (document.hidden && mode === 'play') openPause();
  };
  document.addEventListener('visibilitychange', onHidden);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => (size.w = 0)) : null;
  ro?.observe(canvas);
  let finished: Promise<void> | null = null;
  const finish = (): Promise<void> =>
    (finished ??= (async () => {
      loop.stop();
      music.stop();
      // a run cut short still counts
      if ((mode === 'play' || mode === 'paused') && run.best > 0) endRun(false);
      setMode('gone');
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKey);
      ro?.disconnect();
      view.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.width = 0;
      canvas.height = 0;
      synth.close();
      ui.destroy();
    })());
  const leave = async () => {
    await finish();
    ev.onQuit?.();
  };

  openTitle();
  draw(0);

  return {
    pause() {
      hostPaused = true;
      loop.stop();
      music.stop();
    },
    resume() {
      hostPaused = false;
      if (mode === 'gone') return;
      if (mode === 'play') music.start();
      if (mode !== 'paused') loop.start();
    },
    quit: finish,
    setSound(on: boolean) {
      synth.setOn(on);
      if (ui.menuOpen) reopen();
    },
    resetStats: () => loop.stats.reset(),
    peek: (): HopperStats => ({
      frames: loop.stats.frames,
      firstFrameMs,
      p50: loop.stats.interval(0.5),
      p95: loop.stats.interval(0.95),
      workP95: loop.stats.workMs(0.95),
      scale: res.scale,
      width: canvas.width,
      height: canvas.height,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      paused: !loop.running,
      mode,
      rows: run.best,
      coins: run.coins,
      wallet: purse.coins,
      x: run.p.x,
      r: run.p.r,
      alive: run.p.alive,
      death: run.p.death,
      fog: run.fog,
      best: best(),
      ghostyBest: ghostyBest(),
      hopper: purse.use,
      have: [...purse.have],
    }),
  };
}
