/**
 * QUAKE for the arcade: WebQuake (GPL-2), Quake's own engine in JavaScript on WebGL — public/vendor/quake/quake.js,
 * its client's scripts with Ghosty's patches and platform file, made by build.sh from the commit its SOURCE.md names.
 * It is 2014 JavaScript that needs a classic script (not a module), so it is loaded with a <script> tag and defines one
 * name, GhostyQuake: a function that makes a fresh Quake for each start, with no other name left on the page.
 *
 * pak0.pak is read from memory. The arcade's Intent drives it: the stick moves (full tilt runs) and the look turns and
 * tilts the view, every frame; FIRE, JUMP and RUN hold Quake's own +attack, +jump and +speed; WEAPON and the previous
 * weapon are impulses 10 and 12; the pause action opens Quake's menu, which the stick moves through, FIRE (or JUMP)
 * picks in and WEAPON leaves. Frames run at most at Quake's own 72 a second, drawn at the canvas's size with a pixel
 * ratio of at most 2 (and at most 1920 pixels across) so a phone keeps its frame rate. Sound effects play through
 * WebAudio (the shareware has no music: it was on the CD). Saved games (Quake's own SAVE and LOAD menus: no typing)
 * and the settings go to the SaveStore. No network: the multiplayer menu says there is none.
 */
import type { Action, Intent } from '../input';
import { monoBuffer, openAudio, pcm16, pcm8, type EngineAudio } from './audio';
import { takeLook, type Engine, type EngineEvents, type EngineFiles, type EngineHandle, type EngineProbe, type StartOptions } from './types';

export const QUAKE_VENDOR = '/vendor/quake';
/** Quake's own top frame rate (host_maxfps in the original). */
export const MAX_FPS = 72;
/** The pixel ratio Quake draws at, at most, and the most pixels across. */
export const MAX_RATIO = 2;
export const MAX_ACROSS = 1920;

/** What Quake's state looks like to the page (ghosty.js's state()). */
interface QuakeState {
  dest: 'game' | 'menu' | 'console' | 'message';
  playing: boolean;
  intermission: number;
  map: string | null;
  levelname: string;
  time: number;
  completed: number;
  kills: number;
  totalKills: number;
  secrets: number;
  totalSecrets: number;
  health: number;
  pos: [number, number, number] | null;
  yaw: number;
  pitch: number;
}
interface QuakeApi {
  QUIT: object;
  keys: Record<string, number>;
  start(argv: string[]): void;
  frame(): void;
  key(k: number, down: boolean): void;
  command(text: string): void;
  shutdown(): void;
  state(): QuakeState;
}
interface QuakeHost {
  canvas: HTMLCanvasElement;
  document: Document;
  files: Record<string, Uint8Array>;
  audio: AudioContext | null;
  audioOut: GainNode | null;
  wavBuffer(wav: ArrayBuffer): AudioBuffer;
  saves: Map<string, string>;
  kept(key: string, text: string | null): void;
  ratio(): number;
  clock(): number;
  print(text: string): void;
  error(text: string): void;
  quit(): void;
  hit(): void;
  sound(): void;
  move(cmd: { forwardmove: number; sidemove: number }, angles: number[]): void;
}
type QuakeFactory = (host: QuakeHost) => QuakeApi;

/** Quake's key numbers for the menu (WebQuake's Key.k). */
export const QKEY = { ENTER: 13, ESCAPE: 27, UP: 128, DOWN: 129, LEFT: 130, RIGHT: 131 } as const;

export type QuakeMode = 'game' | 'menu';
/** Held in a level: Quake's own button commands (with a key number of ours, so a real keyboard's never mixes in). */
export const QUAKE_HOLD: Partial<Record<Action, string>> = { fire: 'attack', jump: 'jump', run: 'speed' };
/** Pressed in a level: a command once (or, for the pause action, Quake's menu). */
export const QUAKE_PRESS: Partial<Record<Action, string>> = { weapon: 'impulse 10', weaponPrev: 'impulse 12' };
/** Pressed in the menu (and the console): Quake's own keys. */
export const QUAKE_MENU: Partial<Record<Action, number>> = { fire: QKEY.ENTER, jump: QKEY.ENTER, use: QKEY.ENTER, weapon: QKEY.ESCAPE, weaponPrev: QKEY.ESCAPE, map: QKEY.ESCAPE, pause: QKEY.ESCAPE };
/** The key numbers our held commands carry (above every real key's). */
export const QUAKE_KEYNUM: Record<string, number> = { attack: 301, jump: 302, speed: 303 };

const clamp1 = (v: number): number => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
/** The stick's amount → Quake's move speeds: full tilt runs (forward 400, sideways 350; the server holds both to 320). */
export function quakeMove(moveX: number, moveY: number): { forward: number; side: number } {
  return { forward: clamp1(moveY) * 400, side: clamp1(moveX) * 350 };
}
/** Degrees looked (+ right, + up) → Quake's view angles: yaw turns left as it grows, pitch looks down as it grows,
 *  and the pitch stays between 70° up and 80° down (Quake's own limits). */
export function quakeLook(angles: number[], lookX: number, lookY: number): void {
  angles[1] = (angles[1] ?? 0) - (Number.isFinite(lookX) ? lookX : 0);
  angles[0] = Math.max(-70, Math.min(80, (angles[0] ?? 0) - (Number.isFinite(lookY) ? lookY : 0)));
}
/** In the menu the stick works as the arrow keys (as in doom.ts). */
export function quakeArrow(moveX: number, moveY: number): number | null {
  if (moveY > 0.5) return QKEY.UP;
  if (moveY < -0.5) return QKEY.DOWN;
  if (moveX > 0.5) return QKEY.RIGHT;
  if (moveX < -0.5) return QKEY.LEFT;
  return null;
}
/** The pixel ratio for a canvas shown at w × h points on a screen of `dpr`. */
export function quakeRatio(w: number, h: number, dpr: number): number {
  const across = Math.max(1, w, h);
  return Math.max(1, Math.min(dpr || 1, MAX_RATIO, MAX_ACROSS / across));
}
/** The level's tally at an intermission → a score (kills and secrets, each out of 100) and Ghosty's words. */
export function quakeScore(t: { map: string | null; levelname: string; kills: number; totalKills: number; secrets: number; totalSecrets: number; seconds: number }): { score: number; words: string } {
  const pct = (n: number, max: number): number => (max > 0 ? Math.max(0, Math.min(100, Math.floor((n * 100) / max))) : 100);
  const s = Math.max(0, Math.floor(t.seconds));
  const time = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const name = t.levelname ? `${t.levelname}${t.map ? ` (${t.map})` : ''}` : (t.map ?? 'The level');
  return {
    score: pct(t.kills, t.totalKills) + pct(t.secrets, t.totalSecrets),
    words: `${name} done: kills ${t.kills}/${t.totalKills}, secrets ${t.secrets}/${t.totalSecrets}, time ${time}.`,
  };
}
/** The game's files as Quake looks for them: a bare name ('pak0.pak') is in the id1 folder. */
export function quakePaths(files: EngineFiles): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {};
  for (const [name, bytes] of Object.entries(files)) {
    const n = name.toLowerCase().replace(/^\/+/, '');
    out[n.includes('/') ? n : `id1/${n}`] = bytes;
  }
  return out;
}

/** A WAV as S.js rebuilds it (a 44-byte header, then PCM) → an AudioBuffer at the context's rate. */
function wavBuffer(ctx: BaseAudioContext, wav: ArrayBuffer): AudioBuffer {
  const v = new DataView(wav);
  const channels = v.getUint16(22, true) || 1;
  const rate = v.getUint32(24, true);
  const bits = v.getUint16(34, true);
  const size = Math.min(v.getUint32(40, true), wav.byteLength - 44);
  let data = new Uint8Array(wav, 44, Math.max(0, size));
  const step = (bits / 8) * channels;
  if (channels > 1) {
    // the first channel only (Quake's sounds are mono)
    const one = new Uint8Array(Math.floor(data.length / step) * (bits / 8));
    for (let i = 0, o = 0; i + step <= data.length; i += step) for (let b = 0; b < bits / 8; b++) one[o++] = data[i + b]!;
    data = one;
  }
  return monoBuffer(ctx, bits === 16 ? pcm16(data, rate, ctx.sampleRate) : pcm8(data, rate, ctx.sampleRate));
}

let loading: Promise<QuakeFactory> | null = null;
/** quake.js, once a page: a classic script from this site (the app's security policy allows only those). */
function loadQuake(): Promise<QuakeFactory> {
  loading ??= new Promise<QuakeFactory>((resolve, reject) => {
    const g = globalThis as unknown as { GhostyQuake?: QuakeFactory };
    if (g.GhostyQuake) return resolve(g.GhostyQuake);
    const s = document.createElement('script');
    s.src = `${QUAKE_VENDOR}/quake.js`;
    s.async = true;
    s.onload = () => (g.GhostyQuake ? resolve(g.GhostyQuake) : reject(new Error('Quake did not load.')));
    s.onerror = () => reject(new Error('Quake could not be fetched from this site.'));
    document.head.append(s);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
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
  const paths = quakePaths(files);
  if (!paths['id1/pak0.pak']) throw new Error('These files hold no Quake game (no pak0.pak).');
  const factory = await loadQuake();

  // saved games and settings, as Quake keeps them ('Quake.id1/s0.sav' → its text)
  const saves = new Map<string, string>();
  const utf8 = new TextDecoder();
  for (const name of await opts.saves.list()) {
    const bytes = await opts.saves.get(name);
    if (bytes) saves.set(`Quake.${name}`, utf8.decode(bytes));
  }
  let writing: Promise<void> = Promise.resolve();
  const encode = new TextEncoder();

  let gameMs = 0; // ms of play; stands still while paused
  let frames = 0;
  let fps = 0;
  let fpsFrames = 0;
  let fpsAt = performance.now();
  let work = 0; // ms of the engine's own work since fpsAt
  let workMs = 0;
  let loadMs: number | null = null;
  let sounds = 0;
  let quitAsked = false;
  let mode: QuakeMode = 'menu';
  let errorText = '';
  const said: string[] = [];

  const host: QuakeHost = {
    canvas,
    document,
    files: paths,
    audio: audio?.ctx ?? null,
    audioOut: audio?.out ?? null,
    wavBuffer: (wav) => wavBuffer(audio!.ctx, wav),
    saves,
    kept(key, text) {
      if (text === null || !key.startsWith('Quake.')) return; // a deleted save stays in the store (the menu has no delete here)
      const name = key.slice('Quake.'.length);
      const bytes = encode.encode(text);
      writing = writing.then(() => opts.saves.put(name, bytes)).catch(() => undefined);
    },
    ratio: () => quakeRatio(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height, globalThis.devicePixelRatio || 1),
    clock: () => gameMs / 1000,
    print(text) {
      for (const line of String(text).split('\n')) if (line.trim()) said.push(line);
      if (said.length > 60) said.splice(0, said.length - 60);
    },
    error(text) {
      errorText = String(text);
    },
    quit() {
      quitAsked = true;
    },
    hit() {
      if (mode === 'game') ev.onHit?.();
    },
    sound() {
      sounds++;
    },
    move(cmd, angles) {
      if (mode !== 'game') return;
      const look = takeLook(intent);
      const m = quakeMove(intent.moveX, intent.moveY);
      cmd.forwardmove += m.forward;
      cmd.sidemove += m.side;
      quakeLook(angles, look.x, look.y);
    },
  };

  const q = factory(host);
  try {
    q.start(['quake', ...(audio ? [] : ['-nosound']), ...(opts.args ?? [])]);
  } catch (e) {
    throw new Error(errorText || (e as Error)?.message || String(e));
  }

  // ---- the loop ----
  let raf = 0;
  let stopped = false;
  let paused = false;
  let last = performance.now();
  let lastFrame = 0;
  const held = new Set<string>(); // Quake button commands held now
  let spent = new Set<Action>(); // buttons held through a change of mode: they press nothing until let go
  let pressedBefore = new Set<Action>();
  let arrow: number | null = null;
  let arrowNext = 0;
  let intermission = 0;
  let probe: EngineProbe = { fps: 0, frames: 0, workMs: 0, loadMs: null, level: null, pos: null, angle: null, pitch: null, menu: false, paused: false, sounds: 0 };

  const release = (): void => {
    for (const c of [...held]) {
      q.command(`-${c} ${QUAKE_KEYNUM[c]}`);
      held.delete(c);
    }
  };
  const feed = (st: QuakeState): void => {
    const now: QuakeMode = st.dest === 'game' ? 'game' : 'menu';
    if (now !== mode) {
      release();
      spent = new Set(intent.held);
      mode = now;
      arrow = null;
    }
    for (const a of [...spent]) if (!intent.held.has(a)) spent.delete(a);
    const live = new Set([...intent.held].filter((a) => !spent.has(a)));
    const down = [...live].filter((a) => !pressedBefore.has(a));
    pressedBefore = live;
    if (mode === 'game') {
      if (!st.playing) takeLook(intent); // loading or a demo: a look now would turn him all at once later
      const want = new Set<string>();
      for (const a of live) {
        const c = QUAKE_HOLD[a];
        if (c) want.add(c);
      }
      for (const c of [...held]) if (!want.has(c)) (q.command(`-${c} ${QUAKE_KEYNUM[c]}`), held.delete(c));
      for (const c of want) if (!held.has(c)) (q.command(`+${c} ${QUAKE_KEYNUM[c]}`), held.add(c));
      for (const a of down) {
        const c = QUAKE_PRESS[a];
        if (c) q.command(c);
        if (a === 'pause') (q.key(QKEY.ESCAPE, true), q.key(QKEY.ESCAPE, false));
      }
      return;
    }
    takeLook(intent);
    for (const a of down) {
      const k = QUAKE_MENU[a];
      if (k !== undefined) (q.key(k, true), q.key(k, false));
    }
    const k = quakeArrow(intent.moveX, intent.moveY);
    const t = performance.now();
    if (k === null) arrow = null;
    else if (k !== arrow || t >= arrowNext) {
      arrowNext = t + (k === arrow ? 140 : 350);
      arrow = k;
      q.key(k, true);
      q.key(k, false);
    }
  };
  const after = (st: QuakeState): void => {
    if (st.playing && st.intermission > 0 && intermission === 0) {
      const r = quakeScore({ map: st.map, levelname: st.levelname, kills: st.kills, totalKills: st.totalKills, secrets: st.secrets, totalSecrets: st.totalSecrets, seconds: st.completed });
      ev.onLevelDone?.(r.score, r.words);
    }
    intermission = st.intermission;
    if (st.playing && loadMs === null) loadMs = Math.round(performance.now() - t0);
    const level = st.playing && st.intermission === 0 && st.dest === 'game';
    probe = {
      fps,
      frames,
      workMs,
      loadMs,
      level: level ? st.map : null,
      pos: st.playing ? st.pos : null,
      angle: st.playing ? ((st.yaw % 360) + 360) % 360 : null,
      pitch: st.playing ? st.pitch : null,
      menu: st.dest !== 'game',
      paused,
      sounds,
    };
  };
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
  };
  const letGo = (): void => {
    // the canvas's WebGL memory goes back to the phone at once (a game's canvas is not drawn on again)
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    audio?.close();
  };
  const fail = (e: unknown): void => {
    stop();
    try {
      q.shutdown();
    } catch {
      /* already down */
    }
    letGo();
    ev.onError?.(new Error(errorText || (e as Error)?.message || String(e)));
  };
  const isAbort = (e: unknown): boolean => e === 'Host.abortserver' || (e as Error)?.message === 'Host.abortserver';
  const loop = (t: number): void => {
    if (stopped) return;
    raf = requestAnimationFrame(loop);
    const dt = t - last;
    last = t;
    if (t - fpsAt >= 1000) {
      fps = Math.round((fpsFrames * 1000) / (t - fpsAt));
      workMs = fpsFrames ? Math.round((work / fpsFrames) * 10) / 10 : 0;
      work = 0;
      fpsFrames = 0;
      fpsAt = t;
    }
    if (paused) return;
    gameMs += Math.min(100, Math.max(0, dt)); // a long stall is not caught up all at once
    if (t - lastFrame < 1000 / MAX_FPS - 1) return;
    lastFrame = t;
    const w0 = performance.now();
    try {
      feed(q.state());
      q.frame();
      frames++;
      fpsFrames++;
      after(q.state());
      work += performance.now() - w0;
    } catch (e) {
      if ((e as { ghostyQuit?: boolean })?.ghostyQuit || quitAsked) {
        stop();
        letGo();
        void writing.then(() => ev.onQuit?.());
        return;
      }
      if (isAbort(e)) return; // a demo or a server ending: Quake carries on
      fail(e);
    }
  };
  raf = requestAnimationFrame(loop);

  return {
    pause() {
      if (stopped || paused) return;
      paused = true;
      probe = { ...probe, paused };
      release();
      pressedBefore = new Set();
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
          q.shutdown(); // writes config.cfg
        } catch {
          /* the settings are not worth an error */
        }
        letGo();
      }
      await writing;
    },
    setSound(on) {
      audio?.setOn(on);
    },
    probe: () => probe,
  };
}

export const quake: Engine = { id: 'quake', start };
