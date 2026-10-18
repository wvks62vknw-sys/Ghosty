/**
 * Barge-in: hearing the owner start to talk while Ghosty is speaking, so Ghosty stops and
 * listens. Pure (no audio APIs here), so it can be tested with made-up mic levels:
 * `feed(level, time)` takes one reading of the microphone's loudness (RMS, 0–1) every 20 ms or
 * so — only while Ghosty's voice is actually playing (voice.ts calls `pause()` between clips) —
 * and answers true once, the moment it is sure the owner is talking.
 *
 * Ghosty's own voice comes back into the microphone a little even with the phone's echo
 * cancellation on, and it comes and goes with Ghosty's words. So the detector first learns how
 * loud that echo is (CALIBRATING: until it has heard 300 ms of it, or 800 ms have passed), and
 * afterwards never lets its idea of the echo drop below what it learned — the quiet between
 * words and sentences does not lower the bar, so the next word's echo can't clear it. It also
 * remembers the echo's loudest recent moments. It only fires on sound well above all that which
 * lasts — 180 ms of near-continuous voice — never on a click, a cough or a loud syllable of
 * Ghosty's own.
 */

export interface BargeOptions {
  /** How long the voice must last before it counts (ms). */
  minSpeechMs: number;
  /** Gaps shorter than this inside the voice are bridged (ms). */
  gapMs: number;
  /** Echo heard (above `audible`) before anything can fire (ms of playing time), or `calibrateMaxMs` in all. */
  calibrateMs: number;
  calibrateMaxMs: number;
  /** A reading quieter than this is silence (the room, a gap between words). */
  audible: number;
  /** How far above the echo level a reading must be. */
  ratio: number;
  /** How far above the echo's loudest recent moment. */
  peakRatio: number;
  /** The quietest reading that can ever count as the owner's voice. */
  minLevel: number;
}

export const BARGE_DEFAULTS: BargeOptions = { minSpeechMs: 180, gapMs: 90, calibrateMs: 300, calibrateMaxMs: 800, audible: 0.006, ratio: 2.5, peakRatio: 1.6, minLevel: 0.02 };

export class BargeDetector {
  readonly opts: BargeOptions;
  /** The level of what is heard when nobody is talking (Ghosty's echo + the room). */
  floor = 0;
  /** The echo level learned while calibrating: the floor never goes below it. */
  learned = 0;
  /** The echo's loudest recent moment (eases off over a few seconds). */
  peak = 0;
  private fed = 0;
  private heard = 0;
  private calibrated = false;
  private onset = -1;
  private lastLoud = -1;
  private voiced = 0;
  private lastT = -1;
  private fired = false;

  constructor(opts: Partial<BargeOptions> = {}) {
    this.opts = { ...BARGE_DEFAULTS, ...opts };
  }

  /** The level a reading must pass to count as the owner's voice right now. */
  threshold(): number {
    return Math.max(this.opts.minLevel, Math.max(this.floor, this.learned) * this.opts.ratio, this.peak * this.opts.peakRatio);
  }

  /** Ghosty's voice stopped for a moment (between clips): the next reading starts afresh, without counting the pause. */
  pause(): void {
    this.lastT = -1;
    this.onset = -1;
    this.voiced = 0;
  }

  /** One reading while Ghosty's voice plays. True exactly once: when the owner has been talking long enough to be sure. */
  feed(level: number, t: number): boolean {
    if (this.fired) return false;
    const dt = this.lastT < 0 ? 20 : Math.min(100, Math.max(0, t - this.lastT));
    this.lastT = t;
    const v = Number.isFinite(level) ? Math.max(0, level) : 0;
    if (!this.calibrated) {
      this.fed += dt;
      if (v > this.opts.audible) this.heard += dt;
      // Learning: the floor quickly climbs to the steady echo level, and eases off slowly; the peak follows the loudest.
      this.floor = v > this.floor ? this.floor + (v - this.floor) * 0.35 : this.floor + (v - this.floor) * 0.05;
      this.peak = Math.max(this.peak * 0.995, v);
      if (this.heard >= this.opts.calibrateMs || this.fed >= this.opts.calibrateMaxMs) {
        this.calibrated = true;
        this.learned = this.floor;
      }
      return false;
    }
    const loud = v > this.threshold();
    if (loud) {
      // A reading stands for the time since the one before it (so a slow timer does not slow the answer).
      if (this.onset < 0 || t - this.lastLoud > this.opts.gapMs) {
        this.onset = t;
        this.voiced = Math.min(dt, 40);
      } else this.voiced += dt;
      this.lastLoud = t;
      if (this.voiced >= this.opts.minSpeechMs) {
        this.fired = true;
        return true;
      }
      return false;
    }
    if (this.onset >= 0 && t - this.lastLoud > this.opts.gapMs) {
      this.onset = -1;
      this.voiced = 0;
    }
    if (this.onset < 0) {
      // Following the echo between the owner's words: up slowly (a louder passage), down slowly, never below what was learned.
      this.floor = Math.max(this.learned, this.floor + (v - this.floor) * (v > this.floor ? 0.01 : 0.02));
      // The peak eases off with a half-life of about three seconds.
      this.peak = Math.max(this.peak * 0.9954, v);
    }
    return false;
  }

  /** When the voice that fired began (ms, the clock `feed` was given), or -1. */
  get speechStart(): number {
    return this.fired ? this.onset : -1;
  }
}
