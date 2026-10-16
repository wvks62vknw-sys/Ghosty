/**
 * The frame budget (pure): the detector runs as often as the phone can afford and no more.
 * Each run is timed; the next may start only after a pause proportional to that time, so the
 * camera and the drawing stay smooth and the rate settles between 2 and 10 runs a second.
 */
export interface BudgetOptions {
  /** Never more runs a second than this. */
  maxHz?: number;
  /** Never wait longer than a run at this rate, however slow the model is. */
  minHz?: number;
  /** Pause after a run, as a fraction of the run's own time (0.6: a 100 ms run waits 60 ms). */
  headroom?: number;
}

export class FrameBudget {
  readonly maxHz: number;
  readonly minHz: number;
  readonly headroom: number;
  /** Smoothed time of one run, ms. */
  ms = 0;
  private next = 0;
  private stamps: number[] = [];

  constructor(opts: BudgetOptions = {}) {
    this.maxHz = opts.maxHz ?? 10;
    this.minHz = opts.minHz ?? 2;
    this.headroom = opts.headroom ?? 0.6;
  }

  /** May a run start now (ms)? */
  due(now: number): boolean {
    return now >= this.next;
  }

  /** The pause between runs at the moment, ms. */
  get interval(): number {
    return Math.min(1000 / this.minHz, Math.max(1000 / this.maxHz, this.ms * (1 + this.headroom)));
  }

  /** A run finished at `now` and took `ms`: sets when the next may start. */
  record(ms: number, now: number): void {
    const m = Math.max(0, ms);
    this.ms = this.ms ? this.ms * 0.7 + m * 0.3 : m;
    this.next = now + this.interval;
    this.stamps.push(now);
    while (this.stamps.length && now - this.stamps[0]! > 2000) this.stamps.shift();
  }

  /** Runs in the last second before `now`. */
  rate(now: number): number {
    return this.stamps.filter((s) => now - s <= 1000 && s <= now).length;
  }

  reset(): void {
    this.ms = 0;
    this.next = 0;
    this.stamps = [];
  }
}

/** "8 fps" for the status line (one decimal below 3). */
export function fpsText(hz: number): string {
  if (!(hz > 0)) return '0 fps';
  return `${hz >= 3 ? Math.round(hz) : hz.toFixed(1)} fps`;
}
