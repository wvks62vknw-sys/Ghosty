/**
 * THE DOS ENGINE: DOSBox compiled to WebAssembly (the `emulators` package, GPL-2; vendored under /vendor/dos/ with its
 * LICENCE and SOURCE.md), running a free DOS game exactly as it shipped.
 *
 * Ghosty's pages allow no blob: workers and no eval, so the package's own loader (which fetches DOSBox as text, evals
 * it and starts its worker from a blob) is not used: DOSBox runs in a Worker started from our own origin
 * (/vendor/dos/wdosbox.js, which fetches its .wasm beside it), and only the package's protocol client
 * (`emulators.backend`, in /vendor/dos/emulators.js) talks to it. Sound goes straight from that worker to an
 * AudioWorklet (the package's own player, /vendor/dos/audio-worklet.js) on the arcade's one AudioContext.
 *
 * The game's bundle (its files, built on the phone at GET) and the text files the player adds (dosbox.conf with the
 * autoexec, the game's own set-up file, the controls block) go in first, then what the game saved last time (one
 * bundle in IndexedDB, through the SaveStore), then dosbox.conf again last so ours always rules. What the game writes
 * (its saved games, its set-up) is taken back with the emulator's persistence on PAUSE, on QUIT, when the page is
 * hidden and every two minutes, merged into that bundle.
 */
import { CONF_PATH, CONTROLS_PATH, type DosControls, freshInput, KEYS, keyOfEvent, keysHeld, mouseSteps } from '../dos';
import { zipEntries, zipRead, zipStore } from '../zip';
import { arcadeAudio } from './audio';
import type { SaveStore } from './saves';
import type { Engine, EngineEvents, EngineFiles, EngineHandle } from './types';

export const DOS_BASE = '/vendor/dos/';
/** The backend this phone runs (DOSBox; the faster of the package's two in our measurements, see SOURCE.md). */
export const DOS_BACKEND = { worker: 'wdosbox.js' };
/** The one saved bundle per game in its SaveStore. */
export const SAVE_NAME = 'changes.zip';
const SAVE_EVERY_MS = 120_000;

/** The parts of the package's CommandInterface this engine uses. */
interface CI {
  width(): number;
  height(): number;
  pause(): void;
  resume(): void;
  exit(): Promise<void>;
  sendKeyEvent(code: number, pressed: boolean): void;
  sendMouseRelativeMotion(dx: number, dy: number): void;
  sendMouseButton(button: number, pressed: boolean): void;
  persist(onlyChanges?: boolean): Promise<Uint8Array | null>;
  asyncifyStats(): Promise<{ cpuMetrics?: string | { emulatorSpeed?: number; cpuMax?: number } | null }>;
  events(): {
    onFrameSize(f: (w: number, h: number) => void): void;
    onFrame(f: (rgb: Uint8Array | null, rgba: Uint8Array | null) => void): void;
    onExit(f: () => void): void;
  };
}
interface Client {
  backend(init: unknown[], transport: unknown, options?: object): Promise<CI>;
}

/** What the arcade's spec and the shelf's measurements read: frames drawn, frames a second, load time. */
export const dosStats = { frames: 0, fps: 0, loadMs: 0, speed: 0, cycles: 0, running: false };

let client: Promise<Client> | null = null;
function loadClient(): Promise<Client> {
  if (client) return client;
  client = new Promise<Client>((resolve, reject) => {
    const w = window as unknown as { emulators?: Client };
    if (w.emulators) return resolve(w.emulators);
    const s = document.createElement('script');
    s.src = `${DOS_BASE}emulators.js`;
    s.onload = () => (w.emulators ? resolve(w.emulators) : reject(new Error('the DOS engine did not start')));
    s.onerror = () => reject(new Error('the DOS engine could not be fetched'));
    document.head.append(s);
  });
  client.catch(() => (client = null));
  return client;
}

type Handler = (name: string, props: unknown) => void;
/** The package's transport, with the worker started from our origin instead of a blob. */
function transport(sessionId: string, port: MessagePort | null, onFail: (e: Error) => void) {
  const worker = new Worker(`${DOS_BASE}${DOS_BACKEND.worker}`);
  let handler: Handler | null = null;
  const queue: [string, unknown][] = [];
  worker.onmessage = (e: MessageEvent) => {
    const d = e.data as { name?: string; props?: unknown } | undefined;
    if (d?.name === undefined) return;
    if (handler) handler(d.name, d.props);
    else queue.push([d.name, d.props]);
  };
  worker.onerror = (e) => onFail(new Error(`the DOS engine stopped: ${e.message || 'worker error'}`));
  const t = {
    sessionId,
    net: null,
    sendMessageToServer: (name: string, props: unknown, transfer?: Transferable[]) => (transfer?.length ? worker.postMessage({ name, props }, transfer) : worker.postMessage({ name, props })),
    initMessageHandler: (h: Handler) => {
      handler = h;
      for (const [n, p] of queue.splice(0)) h(n, p);
    },
    exit: () => worker.terminate(),
  };
  t.sendMessageToServer('wc-install', { sessionId, audioPort: port ?? undefined }, port ? [port] : []);
  return t;
}

const worklets = new WeakMap<BaseAudioContext, Promise<void>>();
async function soundOut(): Promise<{ port: MessagePort; gain: GainNode; node: AudioWorkletNode } | null> {
  const ctx = arcadeAudio();
  if (!ctx?.audioWorklet || typeof AudioWorkletNode === 'undefined') return null;
  try {
    let ready = worklets.get(ctx);
    if (!ready) worklets.set(ctx, (ready = ctx.audioWorklet.addModule(`${DOS_BASE}audio-worklet.js`)));
    await ready;
    const node = new AudioWorkletNode(ctx, 'jsdos-audio', { numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1] });
    const gain = ctx.createGain();
    node.connect(gain);
    gain.connect(ctx.destination);
    return { port: node.port, gain, node };
  } catch {
    return null;
  }
}

/** A Uint8Array that owns its whole buffer (the protocol sends `.buffer`, so a view into a larger one would send too much). */
const own = (u: Uint8Array): Uint8Array => (u.byteOffset === 0 && u.byteLength === u.buffer.byteLength ? u : u.slice());

/** The saved bundle and what the game changed this visit, as one bundle (this visit's files win; our set-up is never kept). */
export async function mergeSaves(old: Uint8Array | null, fresh: Uint8Array | null): Promise<Uint8Array | null> {
  const m = new Map<string, Uint8Array>();
  for (const z of [old, fresh]) {
    if (!z || z.length < 22 || z[0] !== 0x50 || z[1] !== 0x4b) continue;
    for (const e of zipEntries(z)) if (!e.name.endsWith('/') && !e.name.startsWith('.jsdos/')) m.set(e.name, await zipRead(z, e));
  }
  return m.size ? zipStore([...m]) : null;
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | undefined> => Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]);

export const dosEngine: Engine = {
  id: 'dos',
  async start(canvas: HTMLCanvasElement, files: EngineFiles, intent, ev: EngineEvents, opts: { saves: SaveStore; sound: boolean }): Promise<EngineHandle> {
    const t0 = performance.now();
    Object.assign(dosStats, { frames: 0, fps: 0, loadMs: 0, speed: 0, cycles: 0, running: false });
    let controls: DosControls = { stick: 'arrows', drag: 'none', buttons: [] };
    const init: unknown[] = [];
    let conf: string | null = null;
    for (const [path, bytes] of Object.entries(files)) {
      if (path === CONTROLS_PATH) controls = JSON.parse(new TextDecoder().decode(bytes)) as DosControls;
      else if (path === CONF_PATH) conf = new TextDecoder().decode(bytes);
      else if (/\.jsdos$/i.test(path)) init.push(own(bytes));
      else init.push({ path, contents: own(bytes) });
    }
    const saved = await opts.saves.get(SAVE_NAME).catch(() => null);
    if (saved) init.push(own(saved));
    if (conf !== null) init.push(conf);

    const [emu, out] = await Promise.all([loadClient(), soundOut()]);
    if (out) out.gain.gain.value = opts.sound ? 1 : 0;
    let failed: (e: Error) => void = (e) => ev.onError?.(e);
    const tl = transport(`ghosty-${Date.now()}`, out?.port ?? null, (e) => failed(e));
    const ci = await Promise.race([
      emu.backend(init, tl, {}),
      new Promise<never>((_, reject) => {
        failed = reject;
        setTimeout(() => reject(new Error('the DOS engine took too long to start')), 45_000);
      }),
    ]).catch((e: unknown) => {
      tl.exit();
      out?.node.disconnect();
      throw e instanceof Error ? e : new Error(String(e));
    });
    failed = (e) => ev.onError?.(e);

    // ---- the picture: each frame the emulator sends, drawn at its own size (the page scales it, pixels kept sharp)
    const g = canvas.getContext('2d', { alpha: false });
    let img: ImageData | null = null;
    const fit = (w: number, h: number) => {
      if (!g || w <= 0 || h <= 0) return;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      if (!img || img.width !== w || img.height !== h) img = g.createImageData(w, h);
    };
    let second = performance.now();
    let inSecond = 0;
    ci.events().onFrameSize((w, h) => fit(w, h));
    ci.events().onFrame((rgb, rgba) => {
      fit(ci.width(), ci.height());
      if (!g || !img) return;
      const d = img.data;
      if (rgba) {
        d.set(rgba.length > d.length ? rgba.subarray(0, d.length) : rgba);
        for (let j = 3; j < d.length; j += 4) d[j] = 255;
      } else if (rgb) {
        for (let i = 0, j = 0; j < d.length && i + 2 < rgb.length; i += 3, j += 4) {
          d[j] = rgb[i]!;
          d[j + 1] = rgb[i + 1]!;
          d[j + 2] = rgb[i + 2]!;
          d[j + 3] = 255;
        }
      } else return;
      g.putImageData(img, 0, 0);
      if (dosStats.frames++ === 0) dosStats.loadMs = Math.round(performance.now() - t0);
      inSecond++;
      const now = performance.now();
      if (now - second >= 1000) {
        dosStats.fps = Math.round((inSecond * 1000) / (now - second));
        inSecond = 0;
        second = now;
      }
    });
    dosStats.running = true;

    // ---- the thumbs and the pad: the shared Intent → DOS keys and mouse, every frame
    let paused = false;
    let done = false;
    let st = freshInput();
    let held = new Set<number>();
    const press = (code: number, down: boolean) => (code < 0 ? ci.sendMouseButton(-code - 1, down) : ci.sendKeyEvent(code, down));
    const release = () => {
      for (const k of held) press(k, false);
      held = new Set();
      st = freshInput();
    };
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);

    // ---- a keyboard (a real one, or the phone's own, for a saved game's name or a cheat) goes straight to DOS
    const typed = new Set<number>();
    const onKey = (e: KeyboardEvent) => {
      if (paused || done || e.isComposing) return;
      const code = keyOfEvent(e.code, e.key);
      if (code === undefined) return;
      e.preventDefault();
      const down = e.type === 'keydown';
      if (down && typed.has(code)) return; // a held key's repeats
      if (down) typed.add(code);
      else typed.delete(code);
      ci.sendKeyEvent(code, down);
    };
    // an on-screen keyboard that names no key (Android's) still says what it typed
    const onInput = (e: Event) => {
      const ie = e as InputEvent;
      if (paused || done || ie.inputType !== 'insertText' || !ie.data) return;
      for (const ch of ie.data) {
        const code = keyOfEvent('', ch);
        if (code === undefined) continue;
        ci.sendKeyEvent(code, true);
        ci.sendKeyEvent(code, false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    document.addEventListener('input', onInput, true);
      if (paused || done) return;
      const want = keysHeld(intent, controls, st);
      for (const k of want) if (!held.has(k)) press(k, true);
      for (const k of held) if (!want.has(k)) press(k, false);
      held = want;
      const m = mouseSteps(controls, intent.lookX, intent.lookY);
      intent.lookX = 0;
      intent.lookY = 0;
      if (m.dx || m.dy) ci.sendMouseRelativeMotion(m.dx, m.dy);
    };
    raf = requestAnimationFrame(tick);

    // ---- a keyboard (a real one, or the phone's own, for a saved game's name or a cheat) goes straight to DOS
    const typed = new Set<number>();
    const onKey = (e: KeyboardEvent) => {
      if (paused || done || e.isComposing) return;
      const code = keyOfEvent(e.code, e.key);
      if (code === undefined) return;
      e.preventDefault();
      const down = e.type === 'keydown';
      if (down && typed.has(code)) return; // a held key's repeats
      if (down) typed.add(code);
      else typed.delete(code);
      ci.sendKeyEvent(code, down);
    };
    // an on-screen keyboard that names no key (Android's) still says what it typed
    const onInput = (e: Event) => {
      const ie = e as InputEvent;
      if (paused || done || ie.inputType !== 'insertText' || !ie.data) return;
      for (const ch of ie.data) {
        const code = keyOfEvent('', ch);
        if (code === undefined) continue;
        ci.sendKeyEvent(code, true);
        ci.sendKeyEvent(code, false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    document.addEventListener('input', onInput, true);

    // ---- saves: what the game wrote, merged into its one saved bundle
    let saving: Promise<void> = Promise.resolve();
    const persist = (): Promise<void> => {
      saving = saving.then(async () => {
        try {
          const fresh = await withTimeout(ci.persist(true), 8000);
          if (!fresh) return;
          const merged = await mergeSaves(await opts.saves.get(SAVE_NAME), fresh);
          if (merged) await opts.saves.put(SAVE_NAME, merged);
        } catch {
          /* the next save tries again */
        }
      });
      return saving;
    };
    const every = setInterval(() => void (paused || done ? undefined : persist()), SAVE_EVERY_MS);
    const hidden = () => {
      if (document.visibilityState === 'hidden' && !done) void persist();
    };
    document.addEventListener('visibilitychange', hidden);
    const speed = setInterval(() => {
      ci.asyncifyStats()
        .then((s) => {
          let m = s?.cpuMetrics;
          if (typeof m === 'string') m = JSON.parse(m || '{}') as { emulatorSpeed?: number };
          dosStats.speed = Number(m?.emulatorSpeed) || 0;
          dosStats.cycles = Number((m as { cpuMax?: number } | undefined)?.cpuMax) || 0;
        })
        .catch(() => undefined);
    }, 2000);
    ci.events().onExit(() => {
      if (!done) failed(new Error('the game closed'));
    });

    return {
      pause() {
        if (paused || done) return;
        paused = true;
        release();
        ci.pause();
        if (out) out.gain.gain.value = 0;
        void persist();
      },
      resume() {
        if (!paused || done) return;
        paused = false;
        ci.resume();
        if (out) out.gain.gain.value = opts.sound ? 1 : 0;
      },
      setSound(on: boolean) {
        opts.sound = on;
        if (out && !paused) out.gain.gain.value = on ? 1 : 0;
      },
      async quit() {
        if (done) return;
        release();
        if (paused) ci.resume();
        await withTimeout(persist(), 9000);
        done = true;
        dosStats.running = false;
        cancelAnimationFrame(raf);
        clearInterval(every);
        clearInterval(speed);
        document.removeEventListener('visibilitychange', hidden);
        window.removeEventListener('keydown', onKey, true);
        window.removeEventListener('keyup', onKey, true);
        document.removeEventListener('input', onInput, true);
        await withTimeout(ci.exit().catch(() => undefined), 3000);
        tl.exit();
        out?.node.disconnect();
        out?.gain.disconnect();
      },
    };
  },
};

/** The DOS keys a game's buttons press, as the CONTROLS panel says them ("CTRL", "SPACE"). */
export const keyWord = (key: string): string => (key === 'mouse1' ? 'MOUSE' : key === 'mouse2' ? 'RIGHT MOUSE' : key in KEYS ? key.toUpperCase() : key);
