/**
 * THE GYM'S TRAINING PATH (BRIEF-PHONE-HARDWARE, item 3): one line under TRAIN ALL that says which way the sums run on this phone, the
 * graphics chip (WebGPU) or the processor, and why when it is the processor, chosen when the page opens by what the phone can do
 * (gym/gpu.ts chooseBackend). TIME IT trains the same fixed practice network on the chosen path and, when that is the graphics chip,
 * on the processor too, and says both times, so what the chip buys on this phone is measured, not claimed. The line carries
 * data-path ("webgpu" or "cpu") for the checks.
 */
import { sayError } from '../../ui/hisWords';
import { h } from '../../core/dom';
import { chooseBackend, cpuBackend, type Choice } from '../../gym/gpu';
import { blobs, trainMlp } from '../../gym/gputrain';
import { button } from '../../ui/components';

let chosen: Promise<Choice> | null = null;
export const trainingChoice = (): Promise<Choice> => choice();
const choice = (): Promise<Choice> => (chosen ??= chooseBackend((navigator as unknown as { gpu?: Parameters<typeof chooseBackend>[0] }).gpu));

/** The words for a measured pair: "graphics chip 210 ms, processor 940 ms: about 4 times faster". */
export function timeWords(gpuMs: number | null, cpuMs: number): string {
  const t = (ms: number) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`);
  if (gpuMs === null) return `Processor ${t(cpuMs)} for the practice network.`;
  const x = cpuMs / Math.max(1, gpuMs);
  return `Graphics chip ${t(gpuMs)}, processor ${t(cpuMs)}: ${x >= 1.15 ? `about ${x >= 10 ? Math.round(x) : x.toFixed(1)} times faster` : x <= 0.87 ? 'the processor was quicker for a job this small' : 'about the same'}.`;
}

export function trainingPathRow(): HTMLElement {
  const say = h('small.gympathsay', { role: 'status', 'aria-live': 'polite' }, 'Checking this phone for WebGPU…');
  const timed = h('small.gympathtime', { role: 'status' });
  const row = h('div.gympath', { dataset: { path: '' } }, say, timed);
  const go = button('TIME IT', async (b) => {
    b.disabled = true;
    timed.textContent = 'Timing…';
    try {
      const c = await choice();
      const p = blobs(1024, 16, 4, 7);
      const gpuMs = c.path === 'webgpu' ? (await trainMlp(c.backend, p, [64], 10, 0.5, 3)).ms : null;
      const cpuMs = (await trainMlp(cpuBackend, p, [64], 10, 0.5, 3, () => new Promise((r) => setTimeout(r, 0)))).ms;
      timed.textContent = timeWords(c.path === 'webgpu' ? gpuMs : null, cpuMs);
      say.textContent = c.message;
      row.dataset.path = c.path;
    } catch (e) {
      timed.textContent = sayError(e, 'finish the timing');
    }
    b.disabled = false;
  });
  go.dataset.act = 'time-training';
  row.append(go);
  void choice().then((c) => {
    row.dataset.path = c.path;
    say.textContent = c.message;
  });
  return row;
}
