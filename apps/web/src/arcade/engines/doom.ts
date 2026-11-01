/**
 * DOOM for the arcade: doomgeneric (GPL-2) built to WebAssembly with Ghosty's platform file — public/vendor/doom
 * (doom.js, doom.wasm), made by its build.sh from the commit its SOURCE.md names. Nothing of it is bundled here.
 *
 * It runs at DOOM's own 35 tics a second on a clock that stands still while the game is paused. On each new tic it
 * reads the Intent — the held buttons as DOOM's own keys, the stick's amount as analog movement, the look as turning —
 * runs one tic and hands back its 320×200 frame, drawn pixel-sharp onto the canvas in the 4:3 shape DOOM was drawn
 * for. Sound effects are the WAD's own, through WebAudio (no music: SOURCE.md). Saved games and the menu's settings
 * go to the SaveStore the moment the engine writes them. DOOM's own menu (NEW GAME and the skill, SAVE, LOAD,
 * OPTIONS, QUIT) opens on the pause action and is worked with the same Intent: the stick moves, FIRE or USE picks,
 * WEAPON or MAP goes back, and a yes/no question takes FIRE for yes.
 */
import type { Action, Intent } from '../input';
import { monoBuffer, openAudio, pcm8, type EngineAudio } from './audio';
import { hasArg, takeLook, type Engine, type EngineEvents, type EngineFiles, type EngineHandle, type EngineProbe, type StartOptions } from './types';

export const DOOM_VENDOR = '/vendor/doom';
const W = 320;
const H = 200;
/** DOOM's tics a second. */
export const TICRATE = 35;

/** DOOM's own key codes (doomkeys.h), and the two weapon keys the platform file binds. */
export const KEY = {
  RIGHT: 0xae,
  LEFT: 0xac,
  UP: 0xad,
  DOWN: 0xaf,
  USE: 0xa2,
  FIRE: 0xa3,
  ESCAPE: 27,
  ENTER: 13,
  TAB: 9,
  BACKSPACE: 0x7f,
  RSHIFT: 0x80 + 0x36,
  NEXT_WEAPON: 93, // ']'
  PREV_WEAPON: 91, // '['
  YES: 121, // 'y'
  NO: 110, // 'n'
} as const;

export type DoomMode = 'game' | 'menu' | 'ask';

/** What each held button presses: in a level (and on the title, intermission and finale screens), in the menu, and
 *  when the menu asks yes or no. */
export const DOOM_KEYS: Record<DoomMode, Partial<Record<Action, number>>> = {
  game: { fire: KEY.FIRE, use: KEY.USE, weapon: KEY.NEXT_WEAPON, weaponPrev: KEY.PREV_WEAPON, map: KEY.TAB, run: KEY.RSHIFT, pause: KEY.ESCAPE },
  menu: { fire: KEY.ENTER, use: KEY.ENTER, jump: KEY.ENTER, weapon: KEY.BACKSPACE, weaponPrev: KEY.BACKSPACE, map: KEY.BACKSPACE, pause: KEY.ESCAPE },
  ask: { fire: KEY.YES, use: KEY.YES, jump: KEY.YES, weapon: KEY.NO, weaponPrev: KEY.NO, map: KEY.NO, pause: KEY.ESCAPE },
};

const clamp1 = (v: number): number => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);

/** The stick's amount → DOOM's analog move units: full tilt runs (forward 50, strafe 40), as on every phone port. */
export function doomMove(moveX: number, moveY: number): { forward: number; side: number } {
  return { forward: Math.round(clamp1(moveY) * 50), side: Math.round(clamp1(moveX) * 40) };
}

/** DOOM's mouse units per degree turned at the default mouse speed: 65,536 angle units a turn, 8 to a mouse unit. */
export const UNITS_PER_DEGREE = 65536 / 360 / 8;

/** Degrees turned (+ right) → whole mouse units now, the fraction carried to the next tic so slow turns add up. */
export function doomTurn(deg: number, carry = 0): { units: number; carry: number } {
  const u = (Number.isFinite(deg) ? deg : 0) * UNITS_PER_DEGREE + carry;
  const units = Math.trunc(u);
  return { units, carry: u - units };
}

/** In the menu the stick works as the arrow keys: past half-way it presses once, then again while held. */
export function menuArrow(moveX: number, moveY: number): number | null {
  if (moveY > 0.5) return KEY.UP;
  if (moveY < -0.5) return KEY.DOWN;
  if (moveX > 0.5) return KEY.RIGHT;
  if (moveX < -0.5) return KEY.LEFT;
  return null;
}

/** The keys the held buttons press in a mode (buttons a mode has no key for press nothing). */
export function doomKeys(held: ReadonlySet<Action>, mode: DoomMode): Set<number> {
  const out = new Set<number>();
  const map = DOOM_KEYS[mode];
  for (const a of held) {
    const k = map[a];
    if (k !== undefined) out.add(k);
  }
  return out;
}

/** The level's tally at an intermission → a score (kills, items and secrets, each out of 100) and Ghosty's words. */
export interface Tally {
  commercial: boolean;
  episode: number; // 0-based, as the engine keeps it
  map: number; // 0-based
  kills: number;
  maxKills: number;
  items: number;
  maxItems: number;
  secrets: number;
  maxSecrets: number;
  tics: number;
  parTics: number;
}
const pct = (n: number, max: number): number => (max > 0 ? Math.max(0, Math.min(100, Math.floor((n * 100) / max))) : 100);
const clock = (tics: number): string => {
  const s = Math.max(0, Math.floor(tics / TICRATE));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const levelName = (commercial: boolean, episode1: number, map1: number): string => (commercial ? `MAP${String(map1).padStart(2, '0')}` : `E${episode1}M${map1}`);
export function doomScore(t: Tally): { score: number; words: string } {
  const k = pct(t.kills, t.maxKills);
  const i = pct(t.items, t.maxItems);
  const s = pct(t.secrets, t.maxSecrets);
  const name = levelName(t.commercial, t.episode + 1, t.map + 1);
  const par = t.parTics > 0 ? ` (par ${clock(t.parTics)})` : '';
  return { score: k + i + s, words: `${name} done: kills ${k}%, items ${i}%, secrets ${s}%, time ${clock(t.tics)}${par}.` };
}

/** Which of the files is the game (the IWAD: the first by name when there are several) and which add levels to it. */
const kindOf = (b: Uint8Array): string => String.fromCharCode(b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0);
export function pickWads(files: EngineFiles): { iwad: string | null; pwads: string[] } {
  const names = Object.keys(files).sort();
  const iwad = names.find((n) => kindOf(files[n]!) === 'IWAD') ?? null;
  const pwads = names.filter((n) => kindOf(files[n]!) === 'PWAD');
  return { iwad, pwads };
}

/** The file name a kept file is written under in the engine's folder (no folders, lower case). */
export const fileName = (path: string): string => path.split('/').pop()!.toLowerCase();

interface DoomFS {
  mkdir(path: string): void;
  chdir(path: string): void;
  writeFile(path: string, data: Uint8Array): void;
  readFile(path: string): Uint8Array;
  analyzePath(path: string): { exists: boolean };
  close(stream: { path?: string; flags?: number }): unknown;
  rename(from: string, to: string): unknown;
}
interface DoomModule {
  FS: DoomFS;
  HEAP32: Int32Array;
  HEAPU8: Uint8Array;
  _malloc(bytes: number): number;
  _dg_create(argc: number, argv: number): void;
  _dg_tick(): void;
  _dg_key(pressed: number, key: number): void;
  _dg_input(forward: number, side: number, turn: number): void;
  _dg_state(): number;
  _dg_save_config(): void;
}
type DoomFactory = (m: Record<string, unknown>) => Promise<DoomModule>;

const GS_LEVEL = 0;
const GS_INTERMISSION = 1;
const DIR = '/doom';
/** A path the engine named (absolute, or from its folder, with ./ and ../ in it) as one absolute path. */
export function enginePath(path: string): string {
  const parts: string[] = [];
  for (const p of (path.startsWith('/') ? path : `${DIR}/${path}`).split('/')) {
    if (p === '' || p === '.') continue;
    if (p === '..') parts.pop();
    else parts.push(p);
  }
  return `/${parts.join('/')}`;
}

/** The engine's files the SaveStore keeps: saved games and the settings (never the half-written temp.dsg). */
export const keptName = (path: string): string | null => {
  if (!path.startsWith(`${DIR}/`)) return null;
  const name = path.slice(DIR.length + 1);
  if (!/\.(dsg|cfg)$/i.test(name) || /(^|\/)temp\.dsg$/i.test(name)) return null;
  return name;
};

/** DOOM's sound channels, played through WebAudio. */
function soundEffects(audio: EngineAudio | null) {
  const buffers = new Map<number, AudioBuffer>();
  const chans = new Map<number, { src: AudioBufferSourceNode; gain: GainNode; pan: StereoPannerNode | null; ends: number }>();
  const set = (c: { gain: GainNode; pan: StereoPannerNode | null }, vol: number, sep: number): void => {
    c.gain.gain.value = Math.max(0, Math.min(1, vol / 127));
    if (c.pan) c.pan.pan.value = Math.max(-1, Math.min(1, (sep - 128) / 127));
  };
  const stop = (ch: number): void => {
    const c = chans.get(ch);
    if (!c) return;
    chans.delete(ch);
    try {
      c.src.stop();
    } catch {
      /* not started */
    }
    c.src.disconnect();
  };
  let started = 0;
  return {
    started: (): number => started,
    known: (id: number): boolean => buffers.has(id),
    start(ch: number, id: number, pcm: Uint8Array | null, rate: number, vol: number, sep: number): void {
      if (!audio) return;
      let buf = buffers.get(id);
      if (!buf) {
        if (!pcm || !(rate > 0)) return;
        buf = monoBuffer(audio.ctx, pcm8(pcm, rate, audio.ctx.sampleRate));
        buffers.set(id, buf);
      }
      stop(ch);
      const { ctx } = audio;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
      src.connect(gain);
      if (pan) gain.connect(pan).connect(audio.out);
      else gain.connect(audio.out);
      const c = { src, gain, pan, ends: ctx.currentTime + buf.duration };
      set(c, vol, sep);
      chans.set(ch, c);
      src.onended = () => {
        if (chans.get(ch)?.src === src) stop(ch);
      };
      src.start();
      started++;
    },
    params(ch: number, vol: number, sep: number): void {
      const c = chans.get(ch);
      if (c) set(c, vol, sep);
    },
    stop,
    playing: (ch: number): boolean => {
      const c = chans.get(ch);
      return !!c && !!audio && audio.ctx.currentTime < c.ends;
    },
    stopAll(): void {
      for (const ch of [...chans.keys()]) stop(ch);
    },
  };
}

async function start(canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: StartOptions): Promise<EngineHandle> {
  // made first, inside the tap that started the game (a phone allows sound only from one)
  const audio = openAudio(opts.sound);
  const t0 = performance.now();
  try {
    return await boot(canvas, files, intent, ev, opts, audio, t0);
  } catch (e) {
    audio?.close();
    throw e;
  }
}

async function boot(canvas: HTMLCanvasElement, files: EngineFiles, intent: Intent, ev: EngineEvents, opts: StartOptions, audio: EngineAudio | null, t0: number): Promise<EngineHandle> {
  const { iwad, pwads } = pickWads(files);
  if (!iwad && !hasArg(opts.args, '-iwad')) throw new Error('These files hold no DOOM game (no IWAD).');
  const screen = canvas.getContext('2d', { alpha: false });
  if (!screen) throw new Error('This browser cannot draw the game (no 2-D canvas).');
  const frame = document.createElement('canvas');
  frame.width = W;
  frame.height = H;
  const fctx = frame.getContext('2d')!;
  const img = fctx.createImageData(W, H);
  const sfx = soundEffects(audio);

  // The canvas: as many pixels as it shows, DOOM's 320×200 drawn in the 4:3 box it was made for, nothing smoothed.
  let box = { x: 0, y: 0, w: W, h: H };
  let sizeDirty = true;
  const resize = (): void => {
    sizeDirty = false;
    const dpr = Math.min(3, Math.max(1, globalThis.devicePixelRatio || 1));
    const cw = Math.max(1, Math.round((canvas.clientWidth || canvas.width / dpr) * dpr));
    const ch = Math.max(1, Math.round((canvas.clientHeight || canvas.height / dpr) * dpr));
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
    }
    screen.imageSmoothingEnabled = false;
    screen.fillStyle = '#000';
    screen.fillRect(0, 0, cw, ch);
    const s = Math.min(cw / W, ch / (H * 1.2));
    const w = Math.round(W * s);
    const h = Math.round(H * 1.2 * s);
    box = { x: Math.floor((cw - w) / 2), y: Math.floor((ch - h) / 2), w, h };
  };
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => (sizeDirty = true)) : null;
  ro?.observe(canvas);

  let gameClock = 0; // ms of play; stands still while paused
  let frames = 0;
  let fps = 0;
  let fpsFrames = 0;
  let fpsAt = performance.now();
  let loadMs: number | null = null;
  let quitAsked = false;
  const said: string[] = [];
  const keep = (s: string): void => {
    said.push(String(s));
    if (said.length > 40) said.shift();
  };

  const ghosty = {
    frame(px: Uint8Array): void {
      img.data.set(px);
      fctx.putImageData(img, 0, 0);
      if (sizeDirty) resize();
      screen.drawImage(frame, 0, 0, W, H, box.x, box.y, box.w, box.h);
      frames++;
      fpsFrames++;
    },
    clock: (): number => gameClock,
    sleep(ms: number): void {
      gameClock += Math.max(0, ms);
    },
    quit(): void {
      quitAsked = true;
    },
    sfxKnown: sfx.known,
    sfxStart: sfx.start,
    sfxParams: sfx.params,
    sfxStop: sfx.stop,
    sfxPlaying: sfx.playing,
  };

  // a module served next to the app; its address is a plain string so the bundler leaves it alone
  const url: string = `${DOOM_VENDOR}/doom.js`;
  const factory = ((await import(/* @vite-ignore */ url)) as { default: DoomFactory }).default;
  const M = await factory({ ghosty, print: keep, printErr: keep, locateFile: (p: string) => `${DOOM_VENDOR}/${p}` });
  const FS = M.FS;
  FS.mkdir(DIR);
  FS.chdir(DIR);
  // the game's files (another IWAD among them, like Freedoom's second phase, is left out unless asked for)
  const own = hasArg(opts.args, '-iwad');
  for (const [name, bytes] of Object.entries(files)) {
    if (!own && name !== iwad && kindOf(bytes) === 'IWAD') continue;
    FS.writeFile(`${DIR}/${fileName(name)}`, bytes);
  }

  // saved games and settings back in place, then kept again each time the engine writes one
  const mkdirs = (path: string): void => {
    const parts = path.split('/').slice(0, -1);
    let at = DIR;
    for (const p of parts) {
      at += `/${p}`;
      if (!FS.analyzePath(at).exists) FS.mkdir(at);
    }
  };
  for (const name of await opts.saves.list()) {
    if (name.includes('..')) continue;
    const bytes = await opts.saves.get(name);
    if (!bytes) continue;
    mkdirs(name);
    FS.writeFile(`${DIR}/${name}`, bytes);
  }
  let writing: Promise<void> = Promise.resolve();
  const keepFile = (path: string | undefined): void => {
    const name = path ? keptName(path) : null;
    if (!name) return;
    let bytes: Uint8Array;
    try {
      bytes = FS.readFile(path!);
    } catch {
      return;
    }
    writing = writing.then(() => opts.saves.put(name, bytes)).catch(() => undefined);
  };
  const close = FS.close;
  FS.close = (stream: { path?: string; flags?: number }) => {
    const path = stream?.path;
    const wrote = ((stream?.flags ?? 0) & 3) !== 0; // opened to write (O_WRONLY or O_RDWR), not just read
    const r = close(stream);
    if (wrote) keepFile(path);
    return r;
  };
  const rename = FS.rename;
  FS.rename = (from: string, to: string) => {
    const r = rename(from, to);
    keepFile(enginePath(to));
    return r;
  };

  const args = [
    ...(hasArg(opts.args, '-iwad') ? [] : ['-iwad', fileName(iwad!)]),
    ...(pwads.length && !hasArg(opts.args, '-file') ? ['-file', ...pwads.map(fileName)] : []),
    '-nomusic',
    '-mb',
    '32',
    ...(opts.args ?? []),
  ];
  const failWords = (): string => said.filter((s) => /error/i.test(s)).pop()?.replace(/^\s*Error:\s*/i, '') || said.slice(-1)[0] || 'DOOM stopped.';
  // the command line, in the engine's memory for good (it keeps pointers into it)
  const utf8 = new TextEncoder();
  const words = ['doom', ...args].map((a) => utf8.encode(`${a}\0`));
  const argv = M._malloc(4 * (words.length + 1));
  words.forEach((w, i) => {
    const p = M._malloc(w.length);
    M.HEAPU8.set(w, p);
    M.HEAP32[(argv >> 2) + i] = p;
  });
  M.HEAP32[(argv >> 2) + words.length] = 0;
  try {
    M._dg_create(words.length, argv); // loads the WAD and sets the game up: the "load"
  } catch (e) {
    throw new Error((e as { name?: string })?.name === 'ExitStatus' ? failWords() : (e as Error)?.message || String(e));
  }

  // ---- the loop ----
  const state = (): Int32Array => {
    const p = M._dg_state() >> 2;
    return M.HEAP32.subarray(p, p + 24);
  };
  let raf = 0;
  let stopped = false;
  let paused = false;
  let last = performance.now();
  const ticOf = (ms: number): number => Math.floor((Math.floor(ms) * TICRATE) / 1000); // as the engine counts (whole ms)
  let lastTic = ticOf(gameClock);
  let mode: DoomMode = 'game';
  const down = new Set<number>(); // DOOM keys held down now
  let spent = new Set<Action>(); // buttons held through a change of mode: they press nothing until let go
  let carry = 0;
  let arrow: number | null = null;
  let arrowNext = 0;
  let damage = 0;
  let gamestate = -1;
  let probe: EngineProbe = { fps: 0, frames: 0, loadMs: null, level: null, pos: null, angle: null, menu: false, paused: false, sounds: 0 };

  const key = (pressed: boolean, k: number): void => {
    M._dg_key(pressed ? 1 : 0, k);
    if (pressed) down.add(k);
    else down.delete(k);
  };
  const feed = (s: Int32Array): void => {
    const now: DoomMode = s[2] ? 'ask' : s[1] ? 'menu' : 'game';
    if (now !== mode) {
      for (const k of [...down]) key(false, k);
      spent = new Set(intent.held);
      mode = now;
      arrow = null;
    }
    for (const a of [...spent]) if (!intent.held.has(a)) spent.delete(a);
    const live = new Set([...intent.held].filter((a) => !spent.has(a)));
    const want = doomKeys(live, mode);
    for (const k of [...down]) if (!want.has(k)) key(false, k);
    for (const k of want) if (!down.has(k)) key(true, k);
    const look = takeLook(intent);
    if (mode === 'game') {
      const m = doomMove(intent.moveX, intent.moveY);
      const t = doomTurn(look.x, carry);
      carry = t.carry;
      M._dg_input(m.forward, m.side, t.units);
      return;
    }
    carry = 0;
    M._dg_input(0, 0, 0);
    // the menu: the stick as the arrow keys, pressed once and then again every 140 ms while held (after 350 ms)
    const a = menuArrow(intent.moveX, intent.moveY);
    const t = performance.now();
    if (a === null) arrow = null;
    else if (a !== arrow || t >= arrowNext) {
      arrowNext = t + (a === arrow ? 140 : 350);
      arrow = a;
      M._dg_key(1, a);
      M._dg_key(0, a);
    }
  };
  const after = (s: Int32Array): void => {
    const gs = s[0]!;
    if (s[3]! > damage && gs === GS_LEVEL && !s[11]) ev.onHit?.();
    damage = s[3]!;
    if (gs === GS_INTERMISSION && gamestate === GS_LEVEL && !s[11]) {
      const r = doomScore({
        commercial: !!s[10],
        episode: s[14]!,
        map: s[15]!,
        maxKills: s[16]!,
        maxItems: s[17]!,
        maxSecrets: s[18]!,
        kills: s[19]!,
        items: s[20]!,
        secrets: s[21]!,
        tics: s[22]!,
        parTics: s[23]!,
      });
      ev.onLevelDone?.(r.score, r.words);
    }
    gamestate = gs;
    const playing = gs === GS_LEVEL && !s[11];
    if (playing && loadMs === null) loadMs = Math.round(performance.now() - t0);
    probe = {
      fps,
      frames,
      loadMs,
      level: playing && !s[1] ? levelName(!!s[10], s[8]!, s[9]!) : null,
      pos: playing ? [s[5]! / 65536, s[6]! / 65536, 0] : null,
      angle: playing ? (((s[7]! & 0xffff) * 360) / 65536) : null,
      menu: !!s[1],
      paused,
      sounds: sfx.started(),
    };
  };
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    sfx.stopAll();
    // the canvas's pixels go back to the phone at once (a game's canvas is not drawn on again)
    canvas.width = 0;
    canvas.height = 0;
  };
  const fail = (e: unknown): void => {
    stop();
    audio?.close();
    const msg = (e as { name?: string })?.name === 'ExitStatus' ? failWords() : (e as Error)?.message || String(e);
    ev.onError?.(new Error(msg));
  };
  const loop = (t: number): void => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    const dt = t - last;
    last = t;
    if (t - fpsAt >= 1000) {
      fps = Math.round((fpsFrames * 1000) / (t - fpsAt));
      fpsFrames = 0;
      fpsAt = t;
    }
    if (paused) return;
    gameClock += Math.min(100, Math.max(0, dt)); // a long stall is not caught up all at once
    const tic = ticOf(gameClock);
    if (tic === lastTic) return;
    lastTic = tic;
    try {
      feed(state());
      M._dg_tick();
      after(state());
    } catch (e) {
      fail(e);
      return;
    }
    if (quitAsked) {
      stop();
      audio?.close();
      void writing.then(() => ev.onQuit?.());
    }
  };
  raf = requestAnimationFrame(loop);

  return {
    pause() {
      if (stopped || paused) return;
      paused = true;
      probe = { ...probe, paused };
      for (const k of [...down]) key(false, k);
      audio?.suspend();
    },
    resume() {
      if (stopped || !paused) return;
      paused = false;
      probe = { ...probe, paused };
      last = performance.now();
      audio?.resume();
    },
    async quit() {
      if (!stopped) {
        stop();
        try {
          M._dg_save_config();
        } catch {
          /* the settings are not worth an error */
        }
      }
      await writing;
      audio?.close();
    },
    setSound(on) {
      audio?.setOn(on);
    },
    probe: () => probe,
  };
}

export const doom: Engine = { id: 'doom', start };
