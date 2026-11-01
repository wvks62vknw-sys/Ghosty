/**
 * THE KART RACER, as an Engine: three laps against Ghosty and two of his bots on one of three tracks of our own. Touch:
 * steer with a stick where the left thumb lands (or two buttons, in the race menu), the kart accelerates by itself (or
 * on a held GAS button, as he likes), DRIFT and ITEM under the right thumb; a controller through the Intent (the stick
 * or d-pad steers and, pulled back, brakes; RB drifts, LB uses the item, A accelerates, B brakes); a keyboard's
 * arrows, space and X. The rules run in sim.ts at 120 steps a second; the world is drawn by scene.ts; a start light,
 * a minimap, the lap counter, the item in its slot, a finish with the places and Ghosty's line on his own. Lap records
 * per track (his and Ghosty's) and the race's points are kept through scores.ts.
 */
import { h } from '../../../core/dom';
import type { EngineEvents, EngineFiles, EngineHandle } from '../../engines/types';
import type { SaveStore } from '../../engines/saves';
import type { Intent } from '../../input';
import { recordScore, scoreOf } from '../../scores';
import { Hum, Synth, Tune } from '../audio';
import { accentHex, clamp, cssSize, fitCanvas, type Game3Id, type GameEngine, type GameStats, haptic, hapticIfNoVibrate, hudButton, Loop, loadThree, makeRenderer, Overlay, Resolution, ThumbStick } from '../kit';
import { GAMES3, KART_ID } from '../shelf3';
import { lapRecord, recordLap } from './records';
import { type KartScene, makeKartScene } from './scene';
import { clock, type Difficulty, DIFFICULTIES, type ItemKind, lapOf, newRace, ordinal, POINTS, type Race, type RaceEvent, speedOf, STEP, step, TOP } from './sim';
import { TRACK_IDS, TRACKS, trackOf, type TrackId } from './tracks';

export interface KartStats extends GameStats {
  track: TrackId;
  t: number;
  phase: Race['phase'];
  lights: number;
  place: number;
  lap: number;
  laps: number;
  prog: number;
  speed: number;
  heading: number;
  steer: number;
  drift: number;
  level: number;
  boost: number;
  item: ItemKind | null;
  done: boolean;
  places: string[];
  points: number | null;
  best: number;
}
export interface KartHandle extends EngineHandle {
  peek(): KartStats;
  resetStats(): void;
}

type Mode = 'title' | 'tracks' | 'race' | 'paused' | 'finish' | 'over' | 'gone';
interface Settings {
  steer: 'stick' | 'buttons';
  gas: 'auto' | 'hold';
  diff: Difficulty;
  track: TrackId;
}
const SETTINGS_FILE = 'settings.json';
const ITEM_WORDS: Record<ItemKind, string> = { boost: 'a boost', shield: 'a shield', oil: 'an oil slick', orb: 'a homing orb' };
const MUSIC = { chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], scale: [0, 3, 5, 7, 10, 12, 15], root: -5, bpm: [126, 150] as [number, number], kick: true, clap: true, hats: true, bass: [0, 3, 6, 8, 11, 14], bassWave: 'sawtooth' as OscillatorType, level: 0.2, seed: 23 };

export const kartEngine: GameEngine<Game3Id> = {
  id: 'kart',
  start: (canvas, files, intent, ev, opts) => startKart(canvas, files, intent, ev, opts),
};

/** Ghosty's line on how he did, from his place and yours. */
export function ghostyLine(race: Race): string {
  const you = race.karts.find((k) => k.you), g = race.karts.find((k) => k.ghosty)!;
  if (!you) return `I came ${ordinal(g.place)}.`;
  if (you.place === 1) return g.place === 2 ? 'You beat me by a nose. Rematch?' : 'You won, and I was not even close. I am going back to practise.';
  if (g.place === 1) return you.place === 2 ? 'I held you off, just. That last bend was close.' : 'First for me. Hold a drift through the hairpin: that is my secret.';
  if (you.place < g.place) return g.place === 4 ? 'You beat me and I came last. Please do not tell anyone.' : `${ordinal(you.place)} for you, ${ordinal(g.place)} for me: my own bots beat us both.`;
  return `${ordinal(g.place)} for me, ${ordinal(you.place)} for you. The boxes were not kind to you.`;
}

async function startKart(canvas: HTMLCanvasElement, _files: EngineFiles, intent: Intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean; args?: string[] }): Promise<KartHandle> {
  const t0 = performance.now();
  const T = await loadThree();
  fitCanvas(canvas);
  const renderer = makeRenderer(T, canvas);
  const res = new Resolution();
  const accent = accentHex();
  const synth = new Synth(opts.sound);
  const music = new Tune(synth, MUSIC);
  const hum = new Hum(synth);
  const entry = GAMES3.find((g) => g.id === KART_ID)!;
  const arg = (k: string) => (opts.args ?? []).find((a) => a.startsWith(`${k}=`))?.slice(k.length + 1);
  const lapsArg = Number(arg('laps')) || undefined;
  const auto = (opts.args ?? []).includes('auto');

  const settings: Settings = { steer: 'stick', gas: 'auto', diff: 'normal', track: 'seaside' };
  try {
    const raw = await opts.saves.get(SETTINGS_FILE);
    if (raw) Object.assign(settings, JSON.parse(new TextDecoder().decode(raw)) as Partial<Settings>);
  } catch {
    /* no settings yet */
  }
  if (!TRACK_IDS.includes(settings.track)) settings.track = 'seaside';
  if (!DIFFICULTIES.includes(settings.diff)) settings.diff = 'normal';
  const tr = arg('track') as TrackId | undefined;
  if (tr && TRACK_IDS.includes(tr)) settings.track = tr;
  const saveSettings = () => void opts.saves.put(SETTINGS_FILE, new TextEncoder().encode(JSON.stringify(settings))).catch(() => undefined);

  let view: KartScene = makeKartScene(T, trackOf(settings.track), settings.track, accent);
  let viewTrack = settings.track;
  let race: Race = newRace(settings.track, { difficulty: settings.diff, laps: lapsArg });
  let mode: Mode = 'title';
  let acc = 0, t = 0, mapT = 0, shake = 0, finT = 0, firstFrameMs: number | null = null, boosts = 0, points: number | null = null, driftTick = 0, lastLap = 0;
  const best = () => scoreOf(KART_ID)?.best ?? 0;

  // ---------------------------------------------------------------- the overlay
  const ui = new Overlay(canvas, 'g3.g3kart', 'The kart racer');
  const touch = h('div.g3touch', { role: 'application', 'aria-label': 'Left thumb: steer. Pull back to brake.' });
  const base = h('div.g3base', { 'aria-hidden': 'true' }, h('i.g3knob'));
  const held = { left: false, right: false, drift: false, item: false, gas: false };
  const holdBtn = (cls: string, label: string, aria: string, key: keyof typeof held) => {
    const b = hudButton(cls, label, aria, () => {
      held[key] = true;
      synth.wake();
    });
    const off = () => (held[key] = false);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('lostpointercapture', off);
    // VoiceOver's double tap is a click: a moment's press
    b.addEventListener('click', (e) => {
      if (e.detail === 0) setTimeout(off, 260);
    });
    return b;
  };
  const leftBtn = holdBtn('g3steer.l', '', 'Steer left', 'left');
  const rightBtn = holdBtn('g3steer.r', '', 'Steer right', 'right');
  const driftBtn = holdBtn('g3drift', 'Drift', 'Drift: hold it through a bend, let go for a boost', 'drift');
  const itemBtn = holdBtn('g3item', '', 'Use your item', 'item');
  const gasBtn = holdBtn('g3gas', 'Gas', 'Accelerate: hold', 'gas');
  const pauseBtn = hudButton('g2pause.g3pause', '', 'Pause', () => openPause());
  const placeEl = h('b.g3place', '3rd');
  const ofEl = h('span.g3of', 'of 4');
  const lapEl = h('span.g3lap', 'Lap 1/3');
  const timeEl = h('span.g3time', '0:00.0');
  const hud = h('div.g3hud', { 'aria-hidden': 'true' }, h('div.g3pos', placeEl, ofEl), h('div.g3sub', lapEl, timeEl));
  const lamps = [h('i'), h('i'), h('i')];
  const lightsEl = h('div.g3lights', { 'aria-hidden': 'true' }, ...lamps);
  const banner = h('div.g3banner', { 'aria-hidden': 'true' });
  const map = h('canvas.g3map', { 'aria-hidden': 'true', width: 216, height: 216 }) as HTMLCanvasElement;
  const rush = h('div.g3rush', { 'aria-hidden': 'true' });
  const ctl = h('div.g3ctl', leftBtn, rightBtn, gasBtn, itemBtn, driftBtn);
  ui.layer.append(rush, touch, base, hud, lightsEl, banner, map, pauseBtn, ctl);
  const stick = new ThumbStick(touch, base, 52, (e, box) => mode === 'race' && settings.steer === 'stick' && e.clientX - box.left < box.width * 0.6, () => synth.wake());
  const setMode = (m: Mode) => {
    mode = m;
    ui.root.dataset.mode = m;
    ui.root.dataset.steer = settings.steer;
    ui.root.dataset.gas = settings.gas;
  };
  setMode('title');
  let bannerT = 0;
  const show = (words: string, ms = 1100, cls = '') => {
    banner.textContent = words;
    banner.className = `g3banner on ${cls}`;
    bannerT = ms / 1000;
  };

  // the keyboard (a computer, and the tests)
  const keys = new Set<string>();
  const onKey = (e: KeyboardEvent) => {
    const down = e.type === 'keydown';
    if (down && (e.key === 'Escape' || e.key === 'p')) {
      if (mode === 'race') openPause();
      else if (mode === 'paused') resumeRace();
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', 'Shift', 'x', 'Enter'].includes(e.key) && mode === 'race') e.preventDefault();
    if (down) keys.add(e.key);
    else keys.delete(e.key);
  };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);

  // ---------------------------------------------------------------- the minimap
  const mctx = map.getContext('2d');
  let mapScale = 1, mapX = 0, mapZ = 0;
  let mapPath: Path2D | null = null;
  const fitMap = () => {
    const o = view.outline;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < o.length; i += 2) (x0 = Math.min(x0, o[i]!)), (x1 = Math.max(x1, o[i]!)), (z0 = Math.min(z0, o[i + 1]!)), (z1 = Math.max(z1, o[i + 1]!));
    mapScale = 184 / Math.max(x1 - x0, z1 - z0);
    mapX = (x0 + x1) / 2;
    mapZ = (z0 + z1) / 2;
    mapPath = typeof Path2D === 'function' ? new Path2D() : null;
    for (let i = 0; i < o.length; i += 2) {
      const [px, py] = mp(o[i]!, o[i + 1]!);
      if (i === 0) mapPath?.moveTo(px, py);
      else mapPath?.lineTo(px, py);
    }
    mapPath?.closePath();
  };
  // north up, the view's right as the map's right (x is drawn mirrored: +x is to the left as you look along +z)
  const mp = (x: number, z: number): [number, number] => [108 - (x - mapX) * mapScale, 108 - (z - mapZ) * mapScale];
  fitMap();
  const drawMap = () => {
    if (!mctx || !mapPath) return;
    mctx.clearRect(0, 0, 216, 216);
    mctx.lineJoin = 'round';
    mctx.strokeStyle = 'rgba(8,12,20,.55)';
    mctx.lineWidth = 16;
    mctx.stroke(mapPath);
    mctx.strokeStyle = 'rgba(255,255,255,.85)';
    mctx.lineWidth = 7;
    mctx.stroke(mapPath);
    const cols = ['#ff6a3d', `#${accent.toString(16).padStart(6, '0')}`, '#ffc83d', '#6ad38a'];
    for (const k of [...race.karts].reverse()) {
      const [px, py] = mp(k.x, k.z);
      mctx.fillStyle = cols[k.i]!;
      mctx.beginPath();
      mctx.arc(px, py, k.you ? 9 : 7, 0, Math.PI * 2);
      mctx.fill();
      if (k.you) {
        mctx.strokeStyle = '#fff';
        mctx.lineWidth = 3;
        mctx.stroke();
      }
    }
  };

  // ---------------------------------------------------------------- sound and feel for what happens
  const you = () => race.karts[0]!;
  const happen = (e: RaceEvent) => {
    const mine = 'kart' in e && e.kart === 0;
    const kk = 'kart' in e ? race.karts[e.kart] : undefined;
    if (kk && (e.type === 'wall' || e.type === 'box' || e.type === 'shield' || e.type === 'boost')) view.burst(e.type, kk.x, kk.y, kk.z);
    if (e.type === 'bump') {
      const a = race.karts[e.a]!, b = race.karts[e.b]!;
      view.burst('bump', (a.x + b.x) / 2, a.y, (a.z + b.z) / 2);
    }
    switch (e.type) {
      case 'light':
        synth.tone({ f: 523, dur: 0.22, type: 'square', vol: 0.12 });
        lamps.forEach((l, i) => l.classList.toggle('red', i < e.n));
        show(String(4 - e.n), 800, 'count');
        ui.announce(String(4 - e.n));
        break;
      case 'go':
        synth.tone({ f: 1046, dur: 0.5, type: 'square', vol: 0.14 });
        lamps.forEach((l) => (l.classList.remove('red'), l.classList.add('green')));
        show('Go!', 900, 'go');
        ui.announce('Go!');
        setTimeout(() => lightsEl.classList.add('off'), 1200);
        haptic(12);
        break;
      case 'hop':
        if (mine) synth.noise({ dur: 0.07, f: 300, vol: 0.12 });
        break;
      case 'drift':
        if (mine) synth.tone({ f: [0, 660, 880, 1175][e.level]!, dur: 0.12, type: 'triangle', vol: 0.12 }), hapticIfNoVibrate();
        break;
      case 'boost':
        if (mine) {
          boosts++;
          synth.noise({ dur: 0.45, f: 500, to: 3200, q: 0.9, vol: 0.2 });
          synth.tone({ f: 330, to: 990, dur: 0.35, type: 'sawtooth', vol: 0.07 });
          haptic(8);
        }
        break;
      case 'box':
        if (mine) [988, 1319, 1568].forEach((f, i) => synth.tone({ f, dur: 0.08, type: 'triangle', vol: 0.1, at: i * 0.05 }));
        break;
      case 'item':
        if (mine) {
          synth.tone({ f: 1568, dur: 0.18, type: 'triangle', vol: 0.12 });
          ui.announce(`You have ${ITEM_WORDS[e.item]}. Tap ITEM to use it.`);
        }
        break;
      case 'use':
        if (mine || Math.hypot(race.karts[e.kart]!.x - you().x, race.karts[e.kart]!.z - you().z) < 40) {
          const v = mine ? 1 : 0.5;
          if (e.item === 'boost') synth.noise({ dur: 0.6, f: 400, to: 3600, q: 0.8, vol: 0.22 * v });
          else if (e.item === 'shield') [523, 659, 784].forEach((f, i) => synth.tone({ f, dur: 0.3, type: 'sine', vol: 0.1 * v, at: i * 0.03 }));
          else if (e.item === 'oil') synth.noise({ dur: 0.3, f: 260, to: 120, q: 1.4, vol: 0.25 * v });
          else synth.tone({ f: 880, to: 220, dur: 0.4, type: 'sawtooth', vol: 0.09 * v });
        }
        break;
      case 'spin':
        if (mine) {
          synth.tone({ f: 600, to: 120, dur: 0.7, type: 'triangle', vol: 0.16 });
          synth.noise({ dur: 0.4, f: 900, to: 200, vol: 0.18 });
          shake = 0.35;
          ev.onHit?.();
          hapticIfNoVibrate();
          ui.say(e.by === 'oil' ? 'Oil! Steer round the dark patches.' : 'An orb got you. A shield would have stopped it.', 2200);
        } else if (e.kart === 1) ui.say(e.by === 'orb' ? 'Hey! Who threw that?' : 'Whoa, slippery!', 1600);
        break;
      case 'shield':
        synth.noise({ dur: 0.3, f: 3000, to: 800, q: 1.2, vol: mine ? 0.2 : 0.08 });
        if (mine) ui.announce('Your shield took it.');
        break;
      case 'bump':
        if (e.a === 0 || e.b === 0) {
          synth.tone({ f: 110, to: 60, dur: 0.16, type: 'square', vol: 0.12 + Math.min(0.12, e.force * 0.01) });
          shake = Math.max(shake, Math.min(0.25, e.force * 0.02));
          if (e.force > 4) ev.onHit?.(), hapticIfNoVibrate();
        }
        break;
      case 'wall':
        if (mine) {
          synth.noise({ dur: 0.18, f: 600, to: 180, q: 0.7, vol: 0.12 + Math.min(0.15, e.force * 0.012) });
          shake = Math.max(shake, Math.min(0.3, e.force * 0.025));
          if (e.force > 5) ev.onHit?.(), hapticIfNoVibrate();
        }
        break;
      case 'lap':
        if (e.kart === 1) recordLap(race.track.def.id, e.time, true);
        if (mine) {
          const rec = recordLap(race.track.def.id, e.time);
          if (e.lap < race.laps) {
            const last = e.lap === race.laps - 1;
            (last ? [659, 784, 1046] : [784, 1046]).forEach((f, i) => synth.tone({ f, dur: 0.14, type: 'triangle', vol: 0.12, at: i * 0.09 }));
            show(last ? 'Final lap' : `Lap ${e.lap + 1}`, 1400, last ? 'final' : '');
            ui.announce(`${last ? 'Final lap' : `Lap ${e.lap + 1}`}. Last lap ${e.time.toFixed(1)} seconds.`);
          }
          if (rec.isBest && e.lap > 1) ui.say(`Lap record: ${e.time.toFixed(1)} seconds.`, 2400);
          lastLap = e.time;
        }
        break;
      case 'finish':
        if (mine) {
          const p = e.place;
          (p === 1 ? [523, 659, 784, 1046, 1319] : p === 2 ? [523, 659, 784, 988] : [440, 523, 659]).forEach((f, i) => synth.tone({ f, dur: 0.22, type: 'triangle', vol: 0.13, at: i * 0.11 }));
          show(p === 1 ? 'You won!' : `${ordinal(p)}!`, 2400, 'final');
          ui.announce(`Finished ${ordinal(p)}.`);
          haptic(20);
          hum.stop();
          points = POINTS[p - 1]! + boosts;
          recordScore(KART_ID, points);
        }
        break;
      case 'done':
        break;
    }
  };

  // ---------------------------------------------------------------- menus
  const soundBtn = (back: () => void) => ({ label: `Sound: ${synth.on ? 'on' : 'off'}`, aria: `Sound is ${synth.on ? 'on' : 'off'}: tap to turn it ${synth.on ? 'off' : 'on'}`, act: () => (synth.setOn(!synth.on), synth.wake(), back()) });
  let reopen: () => void = () => openTitle();
  const useTrack = (id: TrackId) => {
    if (viewTrack !== id) {
      scene3dSwap(id);
    }
    race = newRace(id, { difficulty: settings.diff, laps: lapsArg, auto });
  };
  const scene3dSwap = (id: TrackId) => {
    view.dispose();
    view = makeKartScene(T, trackOf(id), id, accent);
    viewTrack = id;
    fitMap();
    size.w = 0;
  };
  const portraitNote = () => (innerHeight > innerWidth ? ['Plays best turned sideways; upright works too.'] : []);
  const recordNote = (id: TrackId) => {
    const mine = lapRecord(id), his = lapRecord(id, true);
    return `${mine ? `Your best lap ${mine.toFixed(1)} s` : 'No lap record yet'}${his ? ` · mine ${his.toFixed(1)} s` : ''}`;
  };
  const openTitle = () => {
    reopen = openTitle;
    if (mode !== 'title') useTrack(settings.track);
    setMode('title');
    music.stop();
    hum.stop();
    lightsEl.classList.remove('off');
    ui.menu({
      title: 'The kart racer',
      line: entry.ghosty,
      notes: [...(best() ? [`Your best race: ${best()} points`] : []), ...portraitNote()],
      buttons: [
        { label: 'Play', aria: 'Play: choose a track', primary: true, act: () => openTracks() },
        { label: 'How to play', act: () => openHow(openTitle) },
        soundBtn(openTitle),
        { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
      ],
    });
    loop.start();
  };
  const openTracks = () => {
    reopen = openTracks;
    synth.wake();
    setMode('tracks');
    const list = h('div.g3tracks',
      ...TRACK_IDS.map((id) =>
        h('button.g2btn.g3track', {
          type: 'button',
          'aria-label': `Race at ${TRACKS[id].name}: ${TRACKS[id].line} ${recordNote(id)}`,
          dataset: { id: `track-${id}`, on: String(settings.track === id) },
          onclick: (e: Event) => {
            e.stopPropagation();
            settings.track = id;
            saveSettings();
            startRace();
          },
        }, h('b', TRACKS[id].name), h('span', TRACKS[id].line), h('i', recordNote(id))),
      ),
    );
    ui.menu({
      title: 'Choose a track',
      extra: list,
      buttons: [
        { label: `Steering: ${settings.steer === 'stick' ? 'stick' : 'two buttons'}`, aria: `Steering with ${settings.steer === 'stick' ? 'a stick' : 'two buttons'}: tap to change`, act: () => ((settings.steer = settings.steer === 'stick' ? 'buttons' : 'stick'), saveSettings(), openTracks()) },
        { label: `Accelerate: ${settings.gas === 'auto' ? 'by itself' : 'hold Gas'}`, aria: `The kart accelerates ${settings.gas === 'auto' ? 'by itself' : 'while you hold Gas'}: tap to change`, act: () => ((settings.gas = settings.gas === 'auto' ? 'hold' : 'auto'), saveSettings(), openTracks()) },
        { label: `Bots: ${settings.diff}`, aria: `The bots drive at ${settings.diff}: tap to change`, act: () => ((settings.diff = DIFFICULTIES[(DIFFICULTIES.indexOf(settings.diff) + 1) % 3]!), saveSettings(), openTracks()) },
        { label: 'Back', act: () => openTitle() },
      ],
      kind: 'tracks',
    });
  };
  const openHow = (back: () => void) => {
    reopen = () => openHow(back);
    const how = h('div.g2how',
      h('p', 'Three laps against Ghosty and his bots, Rivet and Pebble. Your kart accelerates by itself (or on a held Gas button, if you choose it): steer with your left thumb, pull back to brake.'),
      h('p', 'Drift: hold Drift as you turn into a bend. The longer you hold it, the hotter the sparks: blue, then orange, then violet. Let go for a boost. Touch a wall or run wide and the drift is lost.'),
      h('p', 'Drive through a glowing box for an item, then tap Item: a boost; a shield that stops one hit; an oil slick dropped behind you; a homing orb that chases the kart ahead.'),
      h('p', 'Points: 10 for a win, 7 for second, 5 for third, 3 for fourth, and one for every drift boost. Your lap records are kept for each track.'),
      h('p', 'A controller: the stick or d-pad steers and brakes, RB drifts, LB uses the item, A accelerates, START pauses. A keyboard: the arrows, space to drift, X for the item.'),
    );
    ui.menu({ title: 'How to play', extra: how, buttons: [{ label: 'Back', act: back }], kind: 'how' });
  };
  const startRace = () => {
    synth.wake();
    useTrack(settings.track);
    acc = 0;
    boosts = 0;
    points = null;
    finT = 0;
    lastLap = 0;
    ui.closeMenu();
    lamps.forEach((l) => l.classList.remove('red', 'green'));
    lightsEl.classList.remove('off');
    setMode('race');
    music.start();
    hum.start();
    stick.reset();
    ui.say(`${TRACKS[settings.track].name}. ${race.laps === 1 ? 'One lap' : `${race.laps} laps`}. Good luck: you will need it.`, 2600);
    loop.start();
  };
  const openPause = () => {
    if (mode !== 'race') return;
    reopen = openPause;
    setMode('paused');
    music.stop();
    hum.stop();
    ui.menu({
      title: 'Paused',
      line: race.t > 0 ? `${ordinal(you().place)}, lap ${lapOf(race, you())} of ${race.laps}.` : 'On the grid.',
      buttons: [
        { label: 'Resume', primary: true, act: () => resumeRace() },
        { label: 'How to play', act: () => openHow(openPause) },
        soundBtn(openPause),
        { label: 'Restart race', aria: 'Start this race again', act: () => startRace() },
        { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
      ],
      kind: 'pause',
    });
    loop.stop();
    draw(0);
  };
  const resumeRace = () => {
    ui.closeMenu();
    setMode('race');
    music.start();
    if (!you().done) hum.start();
    if (!hostPaused) loop.start();
  };
  const openResults = () => {
    setMode('over');
    music.stop();
    hum.stop();
    const line = ghostyLine(race);
    const y = you();
    const order = [...race.karts].sort((a, b) => a.place - b.place);
    const table = h('ol.g3table', ...order.map((k) => h(`li${k.you ? '.you' : k.ghosty ? '.ghosty' : ''}` as 'li', h('b', ordinal(k.place)), h('span', k.name), h('i', clock(k.finishT)))));
    const bl = y.laps.length ? Math.min(...y.laps) : null;
    const id = race.track.def.id as TrackId;
    const rec = lapRecord(id), his = lapRecord(id, true);
    reopen = endMenu;
    function endMenu() {
      ui.menu({
        title: y.place === 1 ? 'You won' : `Finished ${ordinal(y.place)}`,
        line,
        notes: [
          `${points ?? 0} points${boosts ? ` (${boosts} drift boost${boosts === 1 ? '' : 's'})` : ''} · best race ${best()}`,
          `${bl ? `Best lap ${bl.toFixed(1)} s` : ''}${rec ? ` · record ${rec.toFixed(1)} s` : ''}${his ? ` · mine ${his.toFixed(1)} s` : ''}`,
        ].filter((n) => n.trim()),
        extra: table,
        buttons: [
          { label: 'Race again', primary: true, act: () => startRace() },
          { label: 'Next track', aria: 'Race the next track', act: () => ((settings.track = TRACK_IDS[(TRACK_IDS.indexOf(id) + 1) % TRACK_IDS.length]!), saveSettings(), startRace()) },
          { label: 'Menu', act: () => openTitle() },
          soundBtn(endMenu),
          { label: 'Quit', aria: 'Quit to the arcade', act: () => void leave() },
        ],
        kind: 'over',
      });
    }
    endMenu();
    ui.announce(`Finished ${ordinal(y.place)}. ${line}`);
    ev.onLevelDone?.(points ?? 0, `Finished ${ordinal(y.place)} at ${TRACKS[id].name}.`);
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
    view.update(race, dt, t, { title: mode === 'title' || mode === 'tracks', shake, you: 0, finish: you().done ? finT : 0 });
    renderer.render(view.scene, view.camera);
    if (firstFrameMs === null) firstFrameMs = performance.now() - t0;
  };
  let lastHud = '';
  const paintHud = () => {
    const y = you();
    const key = `${y.place}|${lapOf(race, y)}|${Math.floor(Math.max(0, race.t) * 10)}|${y.item ?? ''}|${y.rollT > 0}`;
    if (key !== lastHud) {
      lastHud = key;
      placeEl.textContent = ordinal(y.place);
      lapEl.textContent = `Lap ${lapOf(race, y)}/${race.laps}`;
      timeEl.textContent = clock(y.done ? y.finishT : race.t);
      itemBtn.dataset.item = y.rollT > 0 ? 'rolling' : y.item ?? '';
      itemBtn.setAttribute('aria-label', y.item ? `Use your item: ${ITEM_WORDS[y.item]}` : 'Item: drive through a glowing box for one');
    }
    rush.classList.toggle('on', y.boostT > 0);
    driftBtn.dataset.level = y.drift ? String(y.clean ? y.level : 0) : '';
    if (y.wrongT > 1.2 && bannerT <= 0) show('Wrong way', 900, 'warn');
  };
  const controls = () => {
    const y = you();
    if (y.bot) return;
    const k = (s: string) => keys.has(s);
    let steer = settings.steer === 'stick' ? stick.x : (held.right ? 1 : 0) - (held.left ? 1 : 0);
    steer += (Number.isFinite(intent.moveX) ? intent.moveX : 0) + (k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0);
    const brake = (settings.steer === 'stick' ? stick.y < -0.55 : held.left && held.right) || intent.moveY < -0.5 || intent.held.has('use') || k('ArrowDown');
    if (settings.steer === 'buttons' && held.left && held.right) steer = 0;
    const gas = settings.gas === 'auto' || held.gas || intent.held.has('run') || k('ArrowUp');
    y.ctl = {
      steer: clamp(steer, -1, 1),
      throttle: gas && !brake ? 1 : 0,
      brake: brake ? 1 : 0,
      drift: held.drift || intent.held.has('jump') || k(' ') || k('Shift'),
      item: held.item || intent.held.has('fire') || k('x') || k('Enter'),
    };
  };
  let prevPad = new Set<string>();
  const frame = (dt: number) => {
    t += dt;
    if (ui.menuOpen) ui.menuPad(intent);
    const startPressed = intent.held.has('pause') && !prevPad.has('pause');
    prevPad = new Set(intent.held);
    intent.lookX = 0;
    intent.lookY = 0;
    if (startPressed && mode === 'race') openPause();
    if (mode === 'race') {
      controls();
      acc += dt;
      let n = 0;
      while (acc >= STEP && n++ < 40) {
        step(race, STEP);
        acc -= STEP;
      }
      if (n >= 40) acc = 0;
      for (const e of race.events.splice(0)) happen(e);
      const y = you();
      const v = speedOf(y);
      hum.set(v / TOP, y.ctl.throttle, y.boostT > 0);
      if (y.drift && v > 6 && (driftTick -= dt) <= 0) {
        driftTick = 0.085;
        synth.noise({ dur: 0.09, f: 2200 + y.level * 500, q: 3, vol: 0.035 });
      }
      music.pace = clamp((y.prog / (race.track.length * race.laps)) * 1.2, 0, 1);
      music.pump();
      paintHud();
      if (y.done) finT += dt;
      if (race.phase === 'done' && finT > 2.4) openResults();
    } else if (mode === 'title' || mode === 'tracks' || mode === 'over') {
      // the karts idle on the grid while the camera turns
    }
    bannerT -= dt;
    if (bannerT <= 0 && banner.classList.contains('on')) banner.classList.remove('on');
    shake = Math.max(0, shake - dt * 1.4);
    draw(dt);
    if (mode === 'race' && t - mapT >= 1 / 15) (mapT = t), drawMap();
    res.check(loop.stats);
  };
  const loop = new Loop(frame);

  // ---------------------------------------------------------------- pausing, the tab, quitting
  let hostPaused = false;
  const onHidden = () => {
    if (document.hidden && mode === 'race') openPause();
  };
  document.addEventListener('visibilitychange', onHidden);
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => (size.w = 0)) : null;
  ro?.observe(canvas);
  let finished: Promise<void> | null = null;
  const finish = (): Promise<void> =>
    (finished ??= (async () => {
      loop.stop();
      music.stop();
      hum.stop();
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
      hum.stop();
    },
    resume() {
      hostPaused = false;
      if (mode === 'gone') return;
      if (mode === 'race') {
        music.start();
        if (!you().done) hum.start();
      }
      if (mode !== 'paused') loop.start();
    },
    quit: finish,
    setSound(on: boolean) {
      synth.setOn(on);
      if (ui.menuOpen) reopen();
    },
    resetStats: () => loop.stats.reset(),
    peek: (): KartStats => {
      const y = you();
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
        track: viewTrack,
        t: race.t,
        phase: race.phase,
        lights: race.lights,
        place: y.place,
        lap: lapOf(race, y),
        laps: race.laps,
        prog: y.prog,
        speed: speedOf(y),
        heading: y.h,
        steer: y.ctl.steer,
        drift: y.drift,
        level: y.level,
        boost: y.boostT,
        item: y.item,
        done: y.done,
        places: [...race.karts].sort((a, b) => a.place - b.place).map((k) => k.name),
        points,
        best: best(),
      };
    },
  };
}
