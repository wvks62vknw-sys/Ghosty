/**
 * The display's own refresh rate, measured (BRIEF-PHONE-HARDWARE, item 1): every frame the one loop (engine/scheduler.ts) is called with
 * the browser's frame time, and the gaps between them say how fast this screen really draws. A ProMotion phone gives 120 Hz, an older
 * one 60, a phone saving power 30 or 24; nothing asks the browser for a number, because the browser has none to give. Pure: no imports,
 * so tests/phonehw.spec.mjs bundles it and drives it with made-up frame times.
 *
 * The rate is the median of the last 90 gaps that were not stalls (a gap over 50 ms is a hidden tab, a long task or a dropped second,
 * not the display), snapped to a rate screens really have when it is within 6 % of one. `hz` is 0 until 12 gaps have been seen, and
 * everything that wants a rate reads `rate()`, which says 60 until it knows: nothing moves slower for waiting to be measured.
 */

/** The rates screens come in, for snapping a measure to the nearest. */
export const RATES = [24, 30, 48, 60, 72, 90, 100, 120, 144, 165, 240];
const WINDOW = 90;
const NEEDS = 12;
const STALL_MS = 50;

/** A measured gap (ms) as the rate of the nearest real screen, or the plain rounded rate when none is near. */
export function snapHz(gapMs: number): number {
  if (!(gapMs > 0)) return 0;
  const raw = 1000 / gapMs;
  let best = RATES[0]!;
  for (const r of RATES) if (Math.abs(r - raw) < Math.abs(best - raw)) best = r;
  return Math.abs(best - raw) / best <= 0.06 ? best : Math.round(raw);
}

export class RefreshMeter {
  private gaps: number[] = [];
  private prev = 0;
  /** How many frames the measure stands on. */
  frames = 0;
  /** The measured rate in Hz, 0 until there are enough frames. */
  hz = 0;

  /** One frame, at the browser's frame time (ms). A stall or a hidden tab breaks the chain rather than counting as a gap. */
  note(now: number): void {
    const gap = now - this.prev;
    this.prev = now;
    if (!(gap > 0) || gap > STALL_MS) return;
    this.gaps.push(gap);
    if (this.gaps.length > WINDOW) this.gaps.shift();
    this.frames = this.gaps.length;
    if (this.gaps.length < NEEDS) return;
    const s = [...this.gaps].sort((a, b) => a - b);
    this.hz = snapHz(s[s.length >> 1]!);
  }

  /** The tab was hidden or the page paused: the next frame's gap is not a gap. */
  pause(): void {
    this.prev = 0;
  }

  /** The rate to plan with: the measure, or 60 while there is none. */
  rate(): number {
    return this.hz || 60;
  }

  /** One frame's length in seconds at that rate (what a step uses when the browser gave no gap). */
  dt(): number {
    return 1 / this.rate();
  }

  /** The SYSTEM line: "120 Hz, measured over 90 frames", "Measuring…" before there is one. */
  words(): string {
    return this.hz ? `${this.hz} Hz, measured over ${this.frames} frames` : 'Measuring…';
  }
}

/** The one meter the page has. */
export const refresh = new RefreshMeter();

/** The rate a loop that wants "full speed while something moves" draws at: the display's own, never below 60. */
export const moving = (meter: RefreshMeter = refresh): number => Math.max(60, meter.rate());
