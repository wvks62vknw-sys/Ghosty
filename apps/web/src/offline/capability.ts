/**
 * What this phone can take (BRIEF-PHONE-HARDWARE, items 2 to 4): its memory, its cores and its graphics chip, read from what the
 * browser says, and the one rule that turns them into "a larger model may be chosen for you". Pure and dependency-free (the browser's
 * navigator and the graphics adapter are passed in), so tests/phonehw.spec.mjs bundles it and feeds it made-up phones.
 *
 * Safari does not report memory (`navigator.deviceMemory` is Chrome's, and at most 8); a phone that does not report it is never
 * chosen for automatically, and says so: the choice is his, by hand, in the panel.
 */

export interface Caps {
  /** Gigabytes the browser says the device has (Chrome: 0.25 to 8); null when it does not say. */
  memoryGB: number | null;
  cores: number | null;
  /** WebGPU gave an adapter. */
  gpu: boolean;
  /** The biggest buffer that adapter allows (bytes); null when there is no adapter. */
  buffer: number | null;
  /** 16-bit shader maths, which the offline brain needs. */
  f16: boolean;
}

/** What a larger model asks of a phone before it is chosen automatically. */
export interface Need {
  memoryGB: number;
  cores: number;
  /** The biggest single buffer it needs (bytes). */
  buffer: number;
}
export const LARGER_NEED: Need = { memoryGB: 6, cores: 6, buffer: 1 << 29 };

interface NavLike {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  gpu?: { requestAdapter(): Promise<{ limits?: { maxBufferSize?: number }; features?: { has(n: string): boolean } } | null> };
}

/** This phone's capabilities: nothing is asked for beyond an adapter (no device, nothing allocated); a throw reads as "none". */
export async function probeCaps(nav: NavLike | undefined = typeof navigator === 'undefined' ? undefined : (navigator as unknown as NavLike)): Promise<Caps> {
  const memoryGB = typeof nav?.deviceMemory === 'number' && nav.deviceMemory > 0 ? nav.deviceMemory : null;
  const cores = typeof nav?.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : null;
  let gpu = false;
  let buffer: number | null = null;
  let f16 = false;
  try {
    const a = nav?.gpu ? await nav.gpu.requestAdapter() : null;
    if (a) {
      gpu = true;
      buffer = a.limits?.maxBufferSize ?? null;
      f16 = !!a.features?.has('shader-f16');
    }
  } catch {
    gpu = false;
  }
  return { memoryGB, cores, gpu, buffer, f16 };
}

/** Whether this phone is chosen for a larger model by itself, and the plain reason either way. */
export function takesLarger(c: Caps, need: Need = LARGER_NEED): { ok: boolean; why: string } {
  if (!c.gpu) return { ok: false, why: 'this browser has no WebGPU' };
  if (c.memoryGB === null) return { ok: false, why: 'this browser does not say how much memory the phone has' };
  if (c.memoryGB < need.memoryGB) return { ok: false, why: `the phone says ${c.memoryGB} GB of memory and a larger one wants ${need.memoryGB}` };
  if (c.cores !== null && c.cores < need.cores) return { ok: false, why: `the phone has ${c.cores} cores and a larger one wants ${need.cores}` };
  if (c.buffer !== null && c.buffer < need.buffer) return { ok: false, why: `its graphics chip gives pieces of ${Math.floor(c.buffer / (1 << 20))} MB and a larger one wants ${Math.round(need.buffer / (1 << 20))}` };
  return { ok: true, why: `${c.memoryGB} GB of memory, ${c.cores ?? '?'} cores and WebGPU` };
}

/** The phone in one line: "memory 8 GB · 6 cores · WebGPU yes". */
export function capsWords(c: Caps): string {
  const mem = c.memoryGB === null ? 'memory not reported' : `memory ${c.memoryGB} GB`;
  const cores = c.cores === null ? 'cores not reported' : `${c.cores} cores`;
  return `${mem} · ${cores} · WebGPU ${c.gpu ? 'yes' : 'no'}`;
}

export type SizeChoice = 'auto' | 'standard' | 'larger';

/**
 * Which size of a pack is in use. By hand: exactly that (a larger one he picked but has not fetched falls back to the standard
 * one, since it is not here). Automatic: the larger one only when it is on the phone and the phone takes it; else the standard one.
 */
export function chooseSize(choice: SizeChoice, c: Caps, larger: { here: boolean; need?: Need } | null): { size: 'standard' | 'larger'; why: string } {
  if (!larger) return { size: 'standard', why: 'only one size of this is offered' };
  if (choice === 'standard') return { size: 'standard', why: 'chosen by hand' };
  if (choice === 'larger') return larger.here ? { size: 'larger', why: 'chosen by hand' } : { size: 'standard', why: 'the larger one is not on the phone yet' };
  const t = takesLarger(c, larger.need);
  if (!t.ok) return { size: 'standard', why: t.why };
  return larger.here ? { size: 'larger', why: `chosen for you: ${t.why}` } : { size: 'standard', why: 'the larger one is not on the phone yet' };
}
