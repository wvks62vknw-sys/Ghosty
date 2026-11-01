/**
 * TV MODE: what this screen's browser can really do, tried rather than guessed (BRIEF-REST-C part 3). The PS5's hidden
 * browser is an older WebKit: no WebGPU, a weaker WebGL (OWNER-ISSUES 94 (e), 97 (b)), WebAssembly yes.
 *  - 3-D: a WebGL2 context on a throwaway canvas (the God's Eye globe, the 3D STUDIO and the 3-D games all need it);
 *  - WebAssembly: a tiny module compiled and run;
 *  - THE DOS ENGINE STARTING: DOSBox's own worker (/vendor/dos, the arcade's engine) started from this site and asked to
 *    install, as the arcade does; it has started when it answers ready. Tried once a visit, only when the arcade opens on
 *    a TV, and said in one line on the shelf. Nothing is fetched but the engine's own files.
 */
import { DOS_BACKEND, DOS_BASE } from '../arcade/engines/dos';

/** Can this browser draw WebGL2 (the 3-D everything here is built on)? Asked once. */
let gl2: boolean | null = null;
export function has3d(): boolean {
  if (gl2 !== null) return gl2;
  try {
    const c = document.createElement('canvas');
    const g = c.getContext('webgl2') as WebGL2RenderingContext | null;
    gl2 = !!g;
    g?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    gl2 = false;
  }
  return gl2;
}

/** WebGPU (the offline brain's): only asked, never used here. */
export const hasWebGpu = (): boolean => typeof navigator !== 'undefined' && 'gpu' in navigator;

/** The smallest WebAssembly module there is that does something: (func (result i32) i32.const 42), exported as "f". */
const WASM42 = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 127, 3, 2, 1, 0, 7, 5, 1, 1, 102, 0, 0, 10, 6, 1, 4, 0, 65, 42, 11]);
export async function hasWasm(): Promise<boolean> {
  try {
    if (typeof WebAssembly !== 'object' || !WebAssembly.validate(WASM42)) return false;
    const { instance } = await WebAssembly.instantiate(WASM42);
    return (instance.exports.f as () => number)() === 42;
  } catch {
    return false;
  }
}

export interface DosProbe {
  ok: boolean;
  ms: number;
  /** In his words: what the try found. */
  line: string;
}
let dos: Promise<DosProbe> | null = null;
/** Start the DOS engine's worker and wait for it to say it is ready (up to 25 s); the worker is ended either way. */
export function probeDos(timeoutMs = 25_000): Promise<DosProbe> {
  dos ??= (async () => {
    const t0 = performance.now();
    if (!(await hasWasm())) return { ok: false, ms: 0, line: 'DOS games can’t start on this screen: its browser has no WebAssembly.' };
    if (typeof Worker === 'undefined') return { ok: false, ms: 0, line: 'DOS games can’t start on this screen: its browser has no workers.' };
    return new Promise<DosProbe>((done) => {
      let w: Worker | null = null;
      const end = (ok: boolean, why = '') => {
        clearTimeout(timer);
        w?.terminate();
        const ms = Math.round(performance.now() - t0);
        done({ ok, ms, line: ok ? `DOS games start on this screen: I tried the engine and it was ready in ${(ms / 1000).toFixed(1)} s.` : `DOS games can’t start on this screen: ${why}.` });
      };
      const timer = setTimeout(() => end(false, 'the engine did not answer'), timeoutMs);
      try {
        w = new Worker(`${DOS_BASE}${DOS_BACKEND.worker}`);
        w.onmessage = (e: MessageEvent) => {
          const n = (e.data as { name?: string } | undefined)?.name;
          if (n === 'ws-ready' || n === 'ws-server-ready') end(true);
          else if (n === 'ws-err') end(false, 'the engine reported an error');
        };
        w.onerror = (e) => end(false, e.message || 'the engine stopped');
        w.postMessage({ name: 'wc-install', props: { sessionId: 'tv-probe' } });
      } catch (e) {
        end(false, String((e as Error)?.message ?? e));
      }
    });
  })();
  return dos;
}
