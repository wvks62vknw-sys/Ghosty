/**
 * THE OFFLINE BRAIN, MEASURED ON THIS PHONE (BRIEF-PHONE-HARDWARE, item 4): how long each brain took to load and how much memory the
 * page gained doing it, kept per brain so SYSTEM can say it, and the guidance for the three sizes (the 0.6B, the 2B, the 4B) read from
 * the measure and from what the phone reports. Timings always; memory where the browser has `performance.memory` (Chrome only: the
 * JavaScript heap, not the graphics memory, which no page can read, so the figure is the part of the cost a page can see).
 *
 * The safe fallback: before a bigger brain is loaded, `memoryShort` says whether the phone's own report of its memory rules it out
 * (more than 40 % of it: models.ts fitOf says "no"); the load is then refused in plain words and the smaller brain takes over
 * (offline/brain.ts mayLoad, then fallBack), instead of trying and having iOS close Ghosty. A phone that does not report its memory
 * (Safari) is not ruled out by a guess: the crash record (models.ts Held) still protects it.
 */
import { createStore } from '../core/store';
import { fitOf, memText, type ModelDef } from './models';

export interface LoadMeasure {
  id: string;
  label: string;
  /** Milliseconds from asking to load to ready. */
  ms: number;
  /** How much the JavaScript heap grew (MB), or null where the browser gives no figure. */
  heapMB: number | null;
  at: number;
}

export const brainMeasure = createStore({ by: {} as Record<string, LoadMeasure> }, { persist: 'ghosty.brainmeasure', keys: ['by'] });

/** The JavaScript heap in use now (MB), or null when this browser does not say (anything but Chrome). */
export function heapNow(): number | null {
  const m = (globalThis as { performance?: { memory?: { usedJSHeapSize?: number } } }).performance?.memory;
  return typeof m?.usedJSHeapSize === 'number' ? Math.round((m.usedJSHeapSize / (1 << 20)) * 10) / 10 : null;
}

/** Keep one brain's load: its time, and its heap growth when both ends could be read. */
export function recordLoad(m: Pick<ModelDef, 'id' | 'label'>, ms: number, before: number | null, after: number | null, at = Date.now()): void {
  const heapMB = before !== null && after !== null ? Math.max(0, Math.round((after - before) * 10) / 10) : null;
  brainMeasure.set({ by: { ...brainMeasure.get().by, [m.id]: { id: m.id, label: m.label, ms: Math.round(ms), heapMB, at } } });
}

/** Run a load and keep its measure; a load that fails is not a measure. */
export async function timed<T>(m: Pick<ModelDef, 'id' | 'label'>, fn: () => Promise<T> | T): Promise<T> {
  const t0 = performance.now();
  const h0 = heapNow();
  const r = await fn();
  recordLoad(m, performance.now() - t0, h0, heapNow());
  return r;
}

/** Whether the phone's own report of its memory rules this brain out: only when the browser says (GB), and by the rule models.ts fitOf holds. */
export function memoryShort(m: Pick<ModelDef, 'label' | 'vram'>, deviceGB: number | null): { short: boolean; why: string } {
  if (deviceGB === null || !(deviceGB > 0)) return { short: false, why: '' };
  if (fitOf(m.vram, deviceGB) !== 'no') return { short: false, why: '' };
  return { short: true, why: `${m.label} needs about ${memText(m.vram)} of memory when running and this phone says it has ${deviceGB} GB, which is too little to hold it safely, so Ghosty does not try.` };
}

const secs = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)} s`);

/** What was measured, in one line: "loaded in 6.2 s, the page gained 310 MB" (no memory figure where the browser gives none). */
export function measureWords(x: LoadMeasure | undefined): string {
  if (!x) return 'not measured on this phone yet';
  return `loaded in ${secs(x.ms)}${x.heapMB === null ? ', memory not reported by this browser' : `, the page gained ${Math.round(x.heapMB)} MB`}`;
}

/** A load slower than this is a slow brain to wait for (it comes before the first word, every time the phone has let it go). */
export const SLOW_MS = 45_000;

/**
 * The three sizes' guidance, one line each, from the measure and from what this phone reports: how much memory it needs, whether the
 * phone's own report allows it, and what the load took when it has been loaded here.
 */
export function guidance(models: Pick<ModelDef, 'id' | 'label' | 'vram'>[], deviceGB: number | null, by: Record<string, LoadMeasure>): { id: string; label: string; line: string; tone: 'ok' | 'slow' | 'short' | 'unknown' }[] {
  return models.map((m) => {
    const x = by[m.id];
    const need = `needs about ${memText(m.vram)} when running`;
    const short = memoryShort(m, deviceGB);
    if (short.short) return { id: m.id, label: m.label, line: `${need}; over what this phone says it can hold (${deviceGB} GB): Ghosty uses a smaller brain instead`, tone: 'short' as const };
    if (x) {
      const slow = x.ms > SLOW_MS;
      return { id: m.id, label: m.label, line: `${need}; ${measureWords(x)}${slow ? '; a long wait for the first word, so the smaller brain is the better everyday one' : ''}`, tone: slow ? ('slow' as const) : ('ok' as const) };
    }
    return { id: m.id, label: m.label, line: `${need}; ${deviceGB === null ? 'this browser does not report memory, so only loading it here tells' : `fits what this phone says (${deviceGB} GB)`}; not measured yet`, tone: 'unknown' as const };
  });
}
