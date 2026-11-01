/**
 * THE RUNNER, as an Engine: swipe left or right to change lane, up to jump, down to roll (a pad: the d-pad, A to jump,
 * B to roll; a keyboard: the arrows). The rules run in sim.ts at 120 steps a second whatever the screen's rate; the
 * world is drawn by scene.ts; the music is a loop of our own that speeds up with the run. A run ends when the shadow
 * catches him (the second stumble); the score is the distance plus the coins, kept through scores.ts with a best;
 * Ghosty's own best (from the GYM, later) stands on the track as a gate in his colour when there is one.
 */
import { h } from '../../../core/dom';
import type { EngineEvents, EngineFiles, EngineHandle } from '../../engines/types';
import type { SaveStore } from '../../engines/saves';
import type { Intent } from '../../input';
import { recordScore, scoreOf } from '../../scores';
import { RunMusic, Synth } from '../audio';
import { clamp, cssSize, fitCanvas, type GameEngine, type GameStats, haptic, hapticIfNoVibrate, hudButton, Loop, loadThree, makeRenderer, num, Overlay, Resolution } from '../kit';
import { GAMES2, RUNNER_GHOSTY_ID, RUNNER_ID } from '../shelf';
import { makeRunnerScene } from './scene';
import { type Move, newRun, type ObKind, padMoves, type PadState, type Power, POWER_SECONDS, POWERS, type Run, scoreOf as runScore, type Section, sectionAt, step } from './sim';

export interface RunnerStats extends GameStats {
  d: number;
  coins: number;
  points: number;
  lane: number;
  y: number;
  speed: number;
  chase: number;
  stumbles: number;
  over: boolean;
  section: Section;
  powers: Record<Power, number>;
  best: number;
  ghostyBest: number | null;
}
export interface RunnerHandle extends EngineHandle {
  peek(): RunnerStats;
  /** Measure afresh from now (the harness). */
  resetStats(): void;
}

type Mode = 'title' | 'howto' | 'play' | 'paused' | 'over' | 'gone';
const STEP = 1 / 120;
const POWER_WORDS: Record<Power, string> = {
  magnet: 'Magnet: the coins come to you.',
  shield: 'Shield: the next stumble does not count.',
  double: 'Double: every metre and coin counts twice.',
  boost: 'Jump boost: high enough to clear the beams.',
};
const TIPS: Record<ObKind, string> = {
  barrier: 'Swipe up a beat before the low barriers.',
  beam: 'The striped beams are high: swipe down and roll.',
  pillar: 'Pillars never move. Change lanes sooner.',
  gap: 'Jump before the edge of a gap, not on it.',
};

export const runnerEngine: GameEngine = {
  id: 'runner',
  start: (canvas, files, intent, ev, opts) => startRunner(canvas, files, intent, ev, opts),
};

/** Ghosty's colour from the theme (the runner wears it). */
function accentHex(): number {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--c').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return parseInt(v.slice(1), 16);
  } catch {
    /* no styles: the default */
  }
  return 0x64d2ff;
}

async function startRunner(canvas: HTMLCanvasElement, _files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean }): Promise<RunnerHandle> {
  const t0 = performance.now();
  const T = await loadThree();
  fitCanvas(canvas);
  const renderer = makeRenderer(T, canvas);
  const res = new Resolution();
  const view = makeRunnerScene(T, 7919, accentHex());
  const synth = new Synth(opts.sound);
  const music = new RunMusic(synth);
  const entry = GAMES2.find((g) => g.id === RUNNER_ID)!;

  let run: Run = newRun(1);
  let mode: Mode = 'title';
  let acc = 0, clock = 0, shake = 0, overT = 0, lastKind: ObKind = 'barrier', firstFrameMs: number | null = null;
  const queue: Move[] = [];
  const pad: PadState = { mx: 0, my: 0, held: new Set() };
  const ghostyBest = () => scoreOf(RUNNER_GHOSTY_ID)?.best ?? null;
  const best = () => scoreOf(RUNNER_ID)?.best ?? 0;

  // ---------------------------------------------------------------- the overlay: HUD, swipes, menus
  const ui = new Overlay(canvas, 'g2run', 'The runner');
  const dist = h('b.g2dist', '0 m');
  const coinsEl = h('span.g2coins', '0');
  const scoreEl = h('span.g2score', 'SCORE 0');
  const hud = h('div.g2hud', { 'aria-hidden': 'true' }, dist, h('div.g2sub', coinsEl, scoreEl));
  const powersEl = h('div.g2powers', { 'aria-hidden': 'true' });
  const chips = Object.fromEntries(POWERS.map((p) => {
    const bar = h('i');
    const chip = h(`div.g2pw.${p}` as 'div', h('b', p === 'double' ? '×2' : p === 'magnet' ? 'M' : p === 'shield' ? 'S' : '↑'), bar);
    powersEl.append(chip);
    return [p, { chip, bar }];
  })) as Record<Power, { chip: HTMLDivElement; bar: HTMLElement }>;
  const hint = h('div.g2hint', { 'aria-hidden': 'true' });
  const vignette = h('div.g2chase', { 'aria-hidden': 'true' });
  const swipe = h('div.g2swipe', { role: 'application', 'aria-label': 'Swipe left or right to change lane, up to jump, down to roll' });
  const pauseBtn = hudButton('g2pause', '', 'Pause', () => openPause());
  // for VoiceOver (and anyone who would rather tap): the four moves as buttons, hidden from sight
  const moves = h('div.g2moves',
    ...(['left', 'right', 'jump', 'roll'] as Move[]).map((m) => hudButton('g2mv', m.toUpperCase(), m === 'left' ? 'Move a lane left' : m === 'right' ? 'Move a lane right' : m === 'jump' ? 'Jump' : 'Roll', () => queue.push(m))),
  );
  ui.layer.append(vignette, swipe, hud, powersEl, hint, pauseBtn, moves);
  const setMode = (m: Mode) => {
    mode = m;
    ui.root.dataset.mode = m;
  };

  let sx = 0, sy = 0, sid = -1, fired = false;
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
    fired = false;
  });
  swipe.addEventListener('pointermove', (e) => {
    if (e.pointerId !== sid || fired || mode !== 'play') return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
    fired = true;
    queue.push(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'jump' : 'roll');
  });
  const up = (e: PointerEvent) => {
    if (e.pointerId === sid) sid = -1;
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
    const m: Move | null = k === 'ArrowLeft' || k === 'a' ? 'left' : k === 'ArrowRight' || k === 'd' ? 'right' : k === 'ArrowUp' || k === 'w' || k === ' ' ? 'jump' : k === 'ArrowDown' || k === 's' ? 'roll' : null;
    if (m) {
      e.preventDefault();
      queue.push(m);
    }
  };
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- sound for what happens
  const sounds = () => {
    for (const e of run.events.splice(0)) {
      switch (e.type) {
        case 'coin':
          synth.tone({ f: 1480, dur: 0.07, type: 'triangle', vol: 0.11 });
          synth.tone({ f: 1976, dur: 0.1, type: 'triangle', vol: 0.09, at: 0.05 });
          break;
        case 'jump':
          synth.tone({ f: 300, to: 640, dur: 0.15, type: 'triangle', vol: 0.15 });
          break;
        case 'roll':
          synth.noise({ dur: 0.2, f: 900, to: 280, q: 0.8, vol: 0.18 });
          break;
        case 'lane':
          synth.noise({ dur: 0.05, f: 2600, type: 'highpass', vol: 0.07 });
          break;
        case 'land':
          synth.noise({ dur: 0.05, f: 320, vol: 0.08 });
          break;
        case 'bump':
        case 'stumble':
          if (e.type === 'stumble') {
            lastKind = e.kind;
            synth.tone({ f: 150, to: 55, dur: 0.3, type: 'square', vol: 0.16 });
            synth.noise({ dur: 0.22, f: 420, q: 0.6, vol: 0.28 });
            shake = 0.35;
            ev.onHit?.();
            hapticIfNoVibrate();
            ui.say(run.stumbles === 1 ? 'Careful! One more and the shadow has you.' : 'Up you get.', 2400);
          }
          break;
        case 'shield':
          synth.noise({ dur: 0.32, f: 3200, to: 700, q: 1.2, vol: 0.24 });
          synth.tone({ f: 880, to: 440, dur: 0.25, type: 'triangle', vol: 0.1 });
          shake = 0.2;
          ui.announce('The shield took that one.');
          break;
        case 'power':
          [660, 880, 1175].forEach((f, i) => synth.tone({ f, dur: 0.1, type: 'triangle', vol: 0.12, at: i * 0.06 }));
          haptic(8);
          ui.say(POWER_WORDS[e.kind], 2200);
          break;
        case 'expire':
          synth.tone({ f: 620, to: 310, dur: 0.18, type: 'triangle', vol: 0.07 });
          break;
        case 'clear':
          synth.tone({ f: 523, dur: 0.1, type: 'triangle', vol: 0.08 });
          synth.tone({ f: 659, dur: 0.14, type: 'triangle', vol: 0.08, at: 0.08 });
          ui.announce('The shadow fell back.');
          break;
        case 'caught':
          synth.tone({ f: 392, to: 98, dur: 0.7, type: 'sawtooth', vol: 0.14 });
          shake = 0.5;
          ev.onHit?.();
          haptic(30);
          break;
      }
    }
  };

  // ---------------------------------------------------------------- menus
  const soundBtn = (back: () => void) => ({ label: `SOUND: ${synth.on ? 'ON' : 'OFF'}`, aria: `Sound is ${synth.on ? 'on' : 'off'}: tap to turn it ${synth.on ? 'off' : 'on'}`, act: () => (synth.setOn(!synth.on), synth.wake(), back()) });
  let reopen: () => void = () => openTitle();
  const openTitle = () => {
    reopen = openTitle;
    if (mode !== 'title') run = newRun(1); // back at the start line, the shadow far behind
    setMode('title');
    music.stop();
    const gb = ghostyBest();
    ui.menu({
      title: 'THE RUNNER',
      line: entry.ghosty,
      notes: [...(best() ? [`Your best: ${num(best())}`] : []), ...(gb ? [`My best: ${num(gb)} m. Beat it and I will notice.`] : [])],
      buttons: [
        { label: 'PLAY', aria: 'Play: start a run', primary: true, act: () => startRun() },
        { label: 'HOW TO PLAY', act: () => openHow(openTitle) },
        soundBtn(openTitle),
        { label: 'QUIT', aria: 'Quit to the arcade', act: () => void leave() },
      ],
    });
    loop.start();
  };
  const openHow = (back: () => void) => {
    reopen = () => openHow(back);
    const how = h('div.g2how',
      h('p', 'Swipe left or right to change lane. Swipe up to jump the low barriers and the gaps. Swipe down to roll under the striped beams. Pillars and parked blocks: go round them.'),
      h('p', 'Hit something and you stumble: the shadow closes in. Stumble again before it falls back and it catches you. The first one is forgiven.'),
      h('p', 'Coins come in lines and arcs. Power-ups: M pulls the coins in, S takes a stumble for you, ×2 doubles your score, ↑ jumps high enough to clear the beams.'),
      h('p', 'Your score is the metres you run plus ten a coin. It gets faster the further you go.'),
      h('p', 'A controller: the d-pad or left stick moves (up jumps, down rolls), A jumps, B rolls, START pauses. A keyboard: the arrow keys.'),
    );
    ui.menu({ title: 'HOW TO PLAY', extra: how, buttons: [{ label: 'BACK', act: back }], kind: 'how' });
  };
  const startRun = () => {
    synth.wake();
    run = newRun((Math.random() * 2 ** 31) | 0);
    queue.length = 0;
    acc = 0;
    overT = 0;
    ui.closeMenu();
    setMode('play');
    music.start();
    hint.textContent = 'Swipe ← → to change lane · ↑ to jump · ↓ to roll';
    hint.classList.add('on');
    setTimeout(() => hint.classList.remove('on'), 3500);
    loop.start();
  };
  const openPause = () => {
    if (mode !== 'play') return;
    reopen = openPause;
    setMode('paused');
    music.stop();
    ui.menu({
      title: 'PAUSED',
      line: `${num(run.d)} m, ${num(run.coins)} coins so far.`,
      buttons: [
        { label: 'RESUME', primary: true, act: () => resumeRun() },
        { label: 'HOW TO PLAY', act: () => openHow(openPause) },
        soundBtn(openPause),
        { label: 'END RUN', aria: 'End this run and go back to the start', act: () => openTitle() },
        { label: 'QUIT', aria: 'Quit to the arcade', act: () => void leave() },
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
  const endRun = () => {
    setMode('over');
    music.stop();
    const points = runScore(run);
    const r = recordScore(RUNNER_ID, points);
    const gb = ghostyBest();
    const line = r.isBest
      ? `New best: ${num(points)}. I'm writing that one down.`
      : `Caught at ${num(run.d)} m. ${TIPS[lastKind]}`;
    reopen = endMenu;
    function endMenu() {
      ui.menu({
        title: 'CAUGHT',
        line,
        notes: [`${num(run.d)} m · ${num(run.coins)} coins · score ${num(points)}`, `Your best: ${num(r.score.best)}${gb ? ` · mine: ${num(gb)} m` : ''}`],
        buttons: [
          { label: 'RUN AGAIN', primary: true, act: () => startRun() },
          { label: 'MENU', act: () => openTitle() },
          soundBtn(endMenu),
          { label: 'QUIT', aria: 'Quit to the arcade', act: () => void leave() },
        ],
        kind: 'over',
      });
    }
    endMenu();
    ui.announce(line);
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
    const gb = ghostyBest();
    view.update(run, dt, clock, { title: mode === 'title', marks: gb ? [{ d: gb, ghosty: true }] : [], shake });
    renderer.render(view.scene, view.camera);
    if (firstFrameMs === null) firstFrameMs = performance.now() - t0;
  };
  let lastHud = '';
  const paintHud = () => {
    const key = `${Math.floor(run.d)}|${run.coins}|${Math.round(run.points)}`;
    if (key !== lastHud) {
      lastHud = key;
      dist.textContent = `${num(run.d)} m`;
      coinsEl.textContent = num(run.coins);
      scoreEl.textContent = `SCORE ${num(run.points)}`;
    }
    for (const p of POWERS) {
      const left = run.powers[p];
      chips[p].chip.classList.toggle('on', left > 0);
      if (left > 0) chips[p].bar.style.transform = `scaleX(${left / POWER_SECONDS[p]})`;
    }
    vignette.classList.toggle('on', run.chase > 0 && !run.over);
    const gb = ghostyBest();
    if (gb && mode === 'play' && run.d < gb && gb - run.d < 150) {
      hint.textContent = `My best is ${num(gb - run.d)} m ahead`;
      hint.classList.add('on');
    }
  };
  const frame = (dt: number) => {
    clock += dt;
    if (ui.menuOpen) ui.menuPad(intent);
    // a controller: lane changes and jumps from the d-pad, A and B; START pauses
    const startPressed = intent.held.has('pause') && !pad.held.has('pause');
    const pm = padMoves(pad, intent);
    intent.lookX = 0;
    intent.lookY = 0;
    if (startPressed && mode === 'play') openPause();
    if (mode === 'play') {
      queue.push(...pm);
      acc += dt;
      while (acc >= STEP) {
        step(run, queue.shift() ?? 'none', STEP);
        acc -= STEP;
        if (run.over) break;
      }
      music.pace = clamp((run.speed - 10.5) / 11.5, 0, 1);
      music.pump();
      sounds();
      paintHud();
      if (run.over) {
        overT = 0.0001;
        setMode('over');
      }
    } else if (mode === 'over' && overT > 0) {
      overT += dt;
      if (overT > 0.9) {
        overT = 0;
        endRun();
      }
    }
    shake = Math.max(0, shake - dt * 1.2);
    draw(dt);
    res.check(loop.stats); // a new resolution takes effect at the next draw (resizing now would clear this frame)
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
      if (mode === 'play' || mode === 'paused') if (run.d > 1) recordScore(RUNNER_ID, runScore(run));
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
    (ev as EngineEvents & { onQuit?(): void }).onQuit?.();
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
    peek: (): RunnerStats => ({
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
      d: run.d,
      coins: run.coins,
      points: run.points,
      lane: run.lane,
      y: run.y,
      speed: run.speed,
      chase: run.chase,
      stumbles: run.stumbles,
      over: run.over,
      section: sectionAt(run, run.d),
      powers: { ...run.powers },
      best: best(),
      ghostyBest: ghostyBest(),
    }),
  };
}
