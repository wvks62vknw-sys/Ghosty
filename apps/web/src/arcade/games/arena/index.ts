/**
 * THE ARENA, as an Engine: drag anywhere to steer your cell (a stick appears under the thumb), SPLIT and EJECT under
 * the right thumb; a controller's stick steers, A splits, B ejects; a keyboard's arrows, space and E. Twelve of Ghosty's
 * bots, greedy, cautious and hunting, share the arena (sim.ts); scene.ts draws it as a soft-glow plane under a tilted
 * camera. A round is three minutes or until you are eaten; the table of the round, your peak mass kept through
 * scores.ts, and Ghosty's best (the heaviest any of his bots has grown) as a faint ring round your cell.
 */
import { h } from '../../../core/dom';
import type { EngineEvents, EngineFiles, EngineHandle } from '../../engines/types';
import type { SaveStore } from '../../engines/saves';
import type { Intent } from '../../input';
import { recordScore, scoreOf } from '../../scores';
import { Synth, Tune } from '../audio';
import { accentHex, clamp, cssSize, fitCanvas, type Game3Id, type GameEngine, type GameStats, haptic, hapticIfNoVibrate, hudButton, Loop, loadThree, makeRenderer, num, Overlay, Resolution, ThumbStick } from '../kit';
import { ARENA_GHOSTY_ID, ARENA_ID, GAMES3 } from '../shelf3';
import { makeArenaScene } from './scene';
import { type Arena, centre, eject, massOf, newArena, padHeading, radius, ROUND, split, standings, STEP, step } from './sim';

export interface ArenaStats extends GameStats {
  t: number;
  round: number;
  mass: number;
  peak: number;
  cells: number;
  alive: boolean;
  place: number;
  hx: number;
  hz: number;
  x: number;
  z: number;
  over: boolean;
  botPeak: number;
  ghostyBest: number | null;
  best: number;
  board: string[];
}
export interface ArenaHandle extends EngineHandle {
  peek(): ArenaStats;
  resetStats(): void;
}
type Mode = 'title' | 'play' | 'paused' | 'over' | 'gone';
const MUSIC = { chords: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-5, -2, 2]], scale: [0, 3, 5, 7, 10, 12], root: -7, bpm: [92, 118] as [number, number], kick: true, hats: true, bass: [0, 10], bassWave: 'sine' as OscillatorType, arpWave: 'sine' as OscillatorType, leadWave: 'triangle' as OscillatorType, level: 0.24, seed: 5 };
const TEMPER_WORDS = { greedy: 'greedy: it goes where the pellets are', cautious: 'cautious: it runs early', hunter: 'a hunter: it splits to catch' } as const;

export const arenaEngine: GameEngine<Game3Id> = {
  id: 'arena',
  start: (canvas, files, intent, ev, opts) => startArena(canvas, files, intent, ev, opts),
};

async function startArena(canvas: HTMLCanvasElement, _files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }): Promise<ArenaHandle> {
  const t0 = performance.now();
  const T = await loadThree();
  fitCanvas(canvas);
  const renderer = makeRenderer(T, canvas);
  const res = new Resolution();
  const accent = accentHex();
  const view = makeArenaScene(T, accent);
  const synth = new Synth(opts.sound);
  const music = new Tune(synth, MUSIC);
  const entry = GAMES3.find((g) => g.id === ARENA_ID)!;
  const roundArg = Number((opts.args ?? []).find((a) => a.startsWith('round='))?.slice(6)) || ROUND;
  const massArg = Number((opts.args ?? []).find((a) => a.startsWith('mass='))?.slice(5)) || 0;
  const ghostyBest = () => scoreOf(ARENA_GHOSTY_ID)?.best ?? null;
  const best = () => scoreOf(ARENA_ID)?.best ?? 0;

  let arena: Arena = newArena(1, { you: false, round: 1e9 });
  let mode: Mode = 'title';
  let acc = 0, overT = 0, shake = 0, firstFrameMs: number | null = null, blipT = 0, recorded = false;

  // ---------------------------------------------------------------- the overlay
  const ui = new Overlay(canvas, 'g3.g3arena', 'The arena');
  const touch = h('div.g3touch', { role: 'application', 'aria-label': 'Drag anywhere to steer your cell' });
  const base = h('div.g3base', { 'aria-hidden': 'true' }, h('i.g3knob'));
  const massEl = h('b.g3mass', '18');
  const timeEl = h('span.g3clock', '3:00');
  const hud = h('div.g3hud', { 'aria-hidden': 'true' }, massEl, h('span.g3unit', 'mass'), timeEl);
  const board = h('ol.g3board', { 'aria-hidden': 'true' });
  const labels = Array.from({ length: 14 }, () => h('span.g3tag', { 'aria-hidden': 'true' }));
  const tags = h('div.g3tags', ...labels);
  const banner = h('div.g3banner', { 'aria-hidden': 'true' });
  const splitBtn = hudButton('g3split', 'Split', 'Split: fling half of each big cell ahead', () => doSplit());
  const ejectBtn = hudButton('g3eject', 'Eject', 'Eject: throw a little mass ahead', () => doEject());
  const pauseBtn = hudButton('g2pause.g3pause', '', 'Pause', () => openPause());
  ui.layer.append(touch, base, tags, hud, board, banner, splitBtn, ejectBtn, pauseBtn);
  const stick = new ThumbStick(touch, base, 60, () => mode === 'play', () => synth.wake());
  const setMode = (m: Mode) => {
    mode = m;
    ui.root.dataset.mode = m;
  };
  setMode('title');
  let bannerT = 0;
  const show = (words: string, ms = 1400, cls = '') => {
    banner.textContent = words;
    banner.className = `g3banner on ${cls}`;
    bannerT = ms / 1000;
  };
  const you = () => arena.players[0]!;
  const doSplit = () => {
    synth.wake();
    if (mode === 'play' && split(arena, you())) haptic(6);
  };
  const doEject = () => {
    synth.wake();
    if (mode === 'play') eject(arena, you());
  };
  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown';
    if (down && (e.key === 'Escape' || e.key === 'p')) {
      if (mode === 'play') openPause();
      else if (mode === 'paused') resumeRound();
      return;
    }
    if (mode !== 'play') return;
    if (down && e.key === ' ') (e.preventDefault(), doSplit());
    else if (down && (e.key === 'e' || e.key === 'Enter')) doEject();
    if (down) keys.add(e.key);
    else keys.delete(e.key);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // ---------------------------------------------------------------- what happens, heard and felt
  const happen = () => {
    const y = you();
    const near = (x: number, z: number) => {
      const c = centre(y);
      return Math.hypot(x - c.x, z - c.z) < 70;
    };
    for (const e of arena.events.splice(0)) {
      switch (e.type) {
        case 'pellet':
          if (e.owner === 0 && blipT <= 0) {
            blipT = 0.045;
            synth.tone({ f: 900 + Math.random() * 500, dur: 0.05, type: 'sine', vol: 0.05 });
          }
          break;
        case 'eat':
          view.burst(e.x, e.z, arena.players[e.eaten]!.colour, Math.min(26, 8 + Math.round(e.m / 6)), e.m > 40);
          if (e.eater === 0) {
            synth.tone({ f: 320, to: 110, dur: 0.22, type: 'square', vol: 0.12 });
            synth.noise({ dur: 0.14, f: 500, q: 0.7, vol: 0.14 });
            haptic(10);
            if (e.whole) show(`Ate ${arena.players[e.eaten]!.name}`, 1300, 'go');
          } else if (e.eaten === 0) {
            shake = 0.4;
          } else if (near(e.x, e.z)) synth.tone({ f: 260, to: 120, dur: 0.18, type: 'triangle', vol: 0.05 });
          break;
        case 'split':
          if (e.owner === 0) synth.noise({ dur: 0.22, f: 600, to: 2600, q: 0.8, vol: 0.16 });
          break;
        case 'eject':
          if (e.owner === 0) synth.noise({ dur: 0.1, f: 1400, q: 1.2, vol: 0.1 });
          break;
        case 'merge':
          if (e.owner === 0) synth.tone({ f: 523, to: 784, dur: 0.18, type: 'sine', vol: 0.08 });
          break;
        case 'pop':
          view.burst(e.x, e.z, 0x8dffb0, 26, true);
          if (e.owner === 0) {
            synth.noise({ dur: 0.5, f: 300, to: 2400, q: 0.6, vol: 0.3 });
            synth.tone({ f: 160, to: 60, dur: 0.4, type: 'square', vol: 0.12 });
            shake = 0.55;
            ev.onHit?.();
            hapticIfNoVibrate();
            ui.say('A spiky one! Big cells burst on them. Stay clear until you have merged again.', 3000);
          } else if (near(e.x, e.z)) synth.noise({ dur: 0.3, f: 400, to: 1800, q: 0.6, vol: 0.12 });
          break;
        case 'feed':
          break;
        case 'eaten':
          if (e.owner === 0) {
            synth.tone({ f: 440, to: 70, dur: 0.9, type: 'sawtooth', vol: 0.14 });
            ev.onHit?.();
            haptic(30);
          }
          break;
        case 'over':
          overT = 0.0001;
          break;
      }
    }
  };

  // ---------------------------------------------------------------- menus
  const soundBtn = (back: () => void) => ({ label: `Sound: ${synth.on ? 'on' : 'off'}`, aria: `Sound is ${synth.on ? 'on' : 'off'}: tap to turn it ${synth.on ? 'off' : 'on'}`, act: () => (synth.setOn(!synth.on), synth.wake(), back()) });
  let reopen: () => void = () => openTitle();
  const openTitle = () => {
    reopen = openTitle;
    if (mode !== 'title') arena = newArena(1, { you: false, round: 1e9 });
    setMode('title');
    music.stop();
    const gb = ghostyBest();
    ui.menu({
      title: 'The arena',
      line: entry.ghosty,
      notes: [...(best() ? [`Your best: ${num(best())} mass`] : []), ...(gb ? [`My bots' best: ${num(gb)}. It is the faint ring round your cell.`] : [])],
      buttons: [
        { label: 'Play', aria: 'Play: start a round', primary: true, act: () => startRound() },
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
      h('p', 'Drag anywhere to steer: your cell heads the way you drag. Eat the little lit pellets to grow. Bigger is slower.'),
      h('p', 'Eat a cell a quarter smaller than you by covering it; keep away from any a quarter bigger. Split flings half of each big cell ahead to catch one; the halves join again after a while. Eject throws a little of you ahead.'),
      h('p', 'The spiky green ones: small cells slip past them, but a big cell that covers one bursts into pieces.'),
      h('p', 'A round lasts three minutes, or until you are eaten. Twelve of my bots play: Mochi, Blip, Zest and the rest; some greedy, some cautious, some hunting. The faint ring round your cell is the biggest any of them has grown: grow past it.'),
      h('p', 'A controller: the stick steers, A splits, B ejects, START pauses. A keyboard: the arrows, space to split, E to eject.'),
    );
    ui.menu({ title: 'How to play', extra: how, buttons: [{ label: 'Back', act: back }], kind: 'how' });
  };
  const startRound = () => {
    synth.wake();
    arena = newArena((Math.random() * 2 ** 31) | 0, { round: roundArg });
    if (massArg > 0) arena.players[0]!.cells[0]!.m = massArg;
    acc = 0;
    overT = 0;
    recorded = false;
    stick.reset();
    ui.closeMenu();
    setMode('play');
    music.start();
    show('Eat or be eaten', 1500, 'go');
    loop.start();
  };
  const openPause = () => {
    if (mode !== 'play') return;
    reopen = openPause;
    setMode('paused');
    music.stop();
    ui.menu({
      title: 'Paused',
      line: `${num(massOf(you()))} mass, ${clockOf(arena.round - arena.t)} left.`,
      buttons: [
        { label: 'Resume', primary: true, act: () => resumeRound() },
        { label: 'How to play', act: () => openHow(openPause) },
        soundBtn(openPause),
        { label: 'End round', aria: 'End this round and go back to the start', act: () => (record(), openTitle()) },
        { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
      ],
      kind: 'pause',
    });
    loop.stop();
    draw(0);
  };
  const resumeRound = () => {
    ui.closeMenu();
    setMode('play');
    music.start();
    if (!hostPaused) loop.start();
  };
  /** The round's numbers kept, once: your peak, and the heaviest any of Ghosty's bots grew. */
  const record = () => {
    if (recorded) return { isBest: false };
    recorded = true;
    if (arena.botPeak > 0) recordScore(ARENA_GHOSTY_ID, arena.botPeak);
    return recordScore(ARENA_ID, you().peak);
  };
  const endRound = () => {
    setMode('over');
    music.stop();
    const r = record();
    const y = you();
    const table = standings(arena);
    const place = y.alive ? table.findIndex((s) => s.you) + 1 : 0;
    const by = y.eatenBy !== null ? arena.players[y.eatenBy]! : null;
    const gb = ghostyBest();
    const line = by
      ? `${by.name} is ${TEMPER_WORDS[by.temper as keyof typeof TEMPER_WORDS] ?? 'hungry'}. ${r.isBest ? `Still, ${num(y.peak)} is your best.` : 'Keep your distance from the big ones.'}`
      : place === 1
        ? 'Top of the table! My bots will be talking about you.'
        : r.isBest
          ? `Your best yet: ${num(y.peak)}. I am writing that one down.`
          : `${ordinalOf(place)} of ${table.length}. ${gb && y.peak > gb ? 'And you grew past my ring.' : 'Grow past my ring next time.'}`;
    const list = h('ol.g3table', ...[...table.slice(0, 5)].map((s, i) => h(`li${s.you ? '.you' : ''}` as 'li', h('b', ordinalOf(i + 1)), h('span', s.name), h('i', num(s.m)))));
    reopen = overMenu;
    function overMenu() {
      ui.menu({
        title: by ? `Eaten by ${by.name}` : 'Round over',
        line,
        notes: [`Peak ${num(y.peak)} · ${clockOf(Math.min(arena.t, arena.round))} played`, `Your best: ${num(best())}${gb ? ` · my bots: ${num(gb)}` : ''}`],
        extra: list,
        buttons: [
          { label: 'Play again', primary: true, act: () => startRound() },
          { label: 'Menu', act: () => openTitle() },
          soundBtn(overMenu),
          { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
        ],
        kind: 'over',
      });
    }
    overMenu();
    ui.announce(`${by ? `Eaten by ${by.name}` : 'Round over'}. Peak mass ${num(y.peak)}. ${line}`);
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
    view.update(arena, dt, { title: mode === 'title', ghostyBest: ghostyBest() });
    renderer.render(view.scene, view.camera);
    if (firstFrameMs === null) firstFrameMs = performance.now() - t0;
    placeTags();
  };
  // names over the cells big enough to read them
  const placeTags = () => {
    const list: { name: string; x: number; z: number; r: number; you: boolean }[] = [];
    for (const p of arena.players) {
      if (!p.alive || !p.cells.length) continue;
      const big = p.cells.reduce((b, c) => (c.m > b.m ? c : b), p.cells[0]!);
      list.push({ name: p.i === 0 ? 'You' : p.name, x: big.x, z: big.z, r: radius(big.m), you: p.i === 0 });
    }
    list.sort((a, b) => b.r - a.r);
    let k = 0;
    for (const c of list) {
      if (k >= labels.length) break;
      const s = view.toScreen(c.x, 0.4 + c.r * 0.6, c.z, size.w, size.h);
      const edge = view.toScreen(c.x + c.r, 0.4, c.z, size.w, size.h);
      if (!s || !edge || s.x < -40 || s.x > size.w + 40 || s.y < -20 || s.y > size.h + 20) continue;
      const px = Math.abs(edge.x - s.x);
      if (px < 16) continue;
      const el = labels[k++]!;
      if (el.textContent !== c.name) el.textContent = c.name;
      const cls = `g3tag on${c.you ? ' you' : ''}`;
      if (el.className !== cls) el.className = cls;
      el.style.transform = `translate(${Math.round(s.x)}px, ${Math.round(s.y)}px) translate(-50%, -50%) scale(${clamp(px / 40, 0.7, 1.5).toFixed(2)})`;
    }
    for (; k < labels.length; k++) if (labels[k]!.className !== 'g3tag') labels[k]!.className = 'g3tag';
  };
  let lastBoard = '', lastMass = '', lastClock = '', boardT = 0;
  const paintHud = (dt: number) => {
    const y = you();
    const m = massOf(y);
    const ms = num(m), cs = clockOf(Math.max(0, arena.round - arena.t));
    if (ms !== lastMass) massEl.textContent = lastMass = ms;
    if (cs !== lastClock) timeEl.textContent = lastClock = cs;
    if ((boardT -= dt) > 0) return;
    boardT = 0.3;
    const table = standings(arena);
    const key = table.slice(0, 5).map((s) => `${s.name}${Math.round(s.m)}`).join('|') + (table.findIndex((s) => s.you) + 1);
    if (key !== lastBoard) {
      lastBoard = key;
      const mine = table.findIndex((s) => s.you);
      board.replaceChildren(...table.slice(0, 5).map((s, i) => h(`li${s.you ? '.you' : ''}` as 'li', h('b', String(i + 1)), h('span', s.name), h('i', num(s.m)))), ...(mine >= 5 ? [h('li.you', h('b', String(mine + 1)), h('span', 'You'), h('i', num(m)))] : []));
    }
  };
  let prevPad = new Set<string>();
  const frame = (dt: number) => {
    if (ui.menuOpen) ui.menuPad(intent);
    const pressed = (a: string) => intent.held.has(a as never) && !prevPad.has(a);
    const startPressed = pressed('pause');
    if (mode === 'play') {
      if (pressed('fire')) doSplit();
      if (pressed('use')) doEject();
    }
    prevPad = new Set(intent.held);
    intent.lookX = 0;
    intent.lookY = 0;
    if (startPressed && mode === 'play') openPause();
    blipT -= dt;
    if (mode === 'play' || mode === 'title' || (mode === 'over' && overT > 0)) {
      // your heading: the stick under the thumb, a controller's stick, the arrows
      const y = you();
      if (mode === 'play' && y.alive) {
        const kx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
        const kz = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
        const pad = padHeading(intent);
        if (stick.active && (stick.x || stick.y)) {
          const l = Math.hypot(stick.x, stick.y);
          (y.hx = stick.x / l), (y.hz = -stick.y / l), (y.push = clamp(l, 0, 1));
        } else if (pad) (y.hx = pad.hx), (y.hz = pad.hz), (y.push = pad.push);
        else if (kx || kz) {
          const l = Math.hypot(kx, kz);
          (y.hx = kx / l), (y.hz = kz / l), (y.push = 1);
        } else y.push = Math.max(0, y.push - dt * 2.5);
      }
      acc += dt;
      let n = 0;
      while (acc >= STEP && n++ < 20) {
        step(arena, STEP);
        acc -= STEP;
      }
      if (n >= 20) acc = 0;
      if (mode === 'title') arena.events.length = 0;
      else happen();
      if (mode === 'play') {
        music.pace = clamp(Math.sqrt(massOf(you())) / 25, 0, 1);
        music.pump();
        paintHud(dt);
        if (overT > 0) {
          overT += dt;
          if (overT > 1.1) endRound();
        }
      }
    }
    bannerT -= dt;
    if (bannerT <= 0 && banner.classList.contains('on')) banner.classList.remove('on');
    shake = Math.max(0, shake - dt * 1.5);
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
      // a round cut short still counts
      if (mode === 'play' || mode === 'paused') record();
      setMode('gone');
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
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
    peek: (): ArenaStats => {
      const y = you();
      const c = centre(y);
      const table = standings(arena);
      return {
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
        t: arena.t,
        round: arena.round,
        mass: massOf(y),
        peak: y.peak,
        cells: y.cells.length,
        alive: y.alive,
        place: table.findIndex((s) => s.you) + 1,
        hx: y.hx,
        hz: y.hz,
        x: c.x,
        z: c.z,
        over: arena.over,
        botPeak: arena.botPeak,
        ghostyBest: ghostyBest(),
        best: best(),
        board: table.slice(0, 5).map((s) => s.name),
      };
    },
  };
}

const clockOf = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const ordinalOf = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;
