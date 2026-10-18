/**
 * Barge-in: hearing the owner start to talk while Ghosty is speaking, so Ghosty stops and
 * listens. Pure (no audio APIs here), so it can be tested with made-up mic levels:
 * `feed(level, time, speaking)` takes one reading of the microphone's loudness (RMS, 0–1) every
 * 20 ms or so and answers true once, the moment it is sure the owner is talking.
 *
 * Ghosty's own voice comes back into the microphone a little even with the phone's echo
 * cancellation on. So the detector learns the level of what it hears while Ghosty speaks (the
 * echo left over, the room) during its first moments and keeps following it slowly; it only
 * fires on sound well above that floor that lasts — 180 ms of near-continuous voice — never on
 * a click, a cough or a loud syllable of Ghosty's own.
 */

export interface BargeOptions {
  /** How long the voice must last before it counts (ms). */
  minSpeechMs: number;
  /** Gaps shorter than this inside the voice are bridged (ms). */
  gapMs: number;
  /** Time at the start spent learning the echo and room level before anything can fire (ms). */
  calibrateMs: number;
  /** How far above the floor a reading must be, while Ghosty is speaking, and while it is quiet. */
  ratioSpeaking: number;
  ratioQuiet: number;
  /** The quietest reading that can ever count as the owner's voice. */
  minLevel: number;
}

export const BARGE_DEFAULTS: BargeOptions = { minSpeechMs: 180, gapMs: 90, calibrateMs: 300, ratioSpeaking: 3, ratioQuiet: 2.6, minLevel: 0.02 };

export class BargeDetector {
  readonly opts: BargeOptions;
  /** The level of what is heard when nobody is talking (echo + room). */
  floor = 0;
  private start = -1;
  private onset = -1;
  private lastLoud = -1;
  private voiced = 0;
  private lastT = -1;
  private fired = false;

  constructor(opts: Partial<BargeOptions> = {}) {
    this.opts = { ...BARGE_DEFAULTS, ...opts };
  }

  /** The level a reading must pass to count as the owner's voice right now. */
  threshold(speaking: boolean): number {
    return Math.max(this.opts.minLevel, this.floor * (speaking ? this.opts.ratioSpeaking : this.opts.ratioQuiet));
  }

  /** One reading. True exactly once: when the owner has been talking long enough to be sure. */
  feed(level: number, t: number, speaking = true): boolean {
    if (this.fired) return false;
    if (this.start < 0) this.start = t;
    const dt = this.lastT < 0 ? 0 : Math.min(100, Math.max(0, t - this.lastT));
    this.lastT = t;
    const v = Number.isFinite(level) ? Math.max(0, level) : 0;
    if (t - this.start < this.opts.calibrateMs) {
      // Learning: the floor quickly climbs to the loudest steady level heard (the echo), and eases off slowly.
      this.floor = v > this.floor ? this.floor + (v - this.floor) * 0.35 : this.floor + (v - this.floor) * 0.05;
      return false;
    }
    const loud = v > this.threshold(speaking);
    if (loud) {
      if (this.onset < 0 || t - this.lastLoud > this.opts.gapMs) {
        this.onset = t;
        this.voiced = 0;
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
    // Following the floor between words: up slowly (a louder room, louder echo), down faster.
    if (this.onset < 0) this.floor += (v - this.floor) * (v > this.floor ? 0.01 : 0.08);
    return false;
  }

  /** When the voice that fired began (ms, the clock `feed` was given), or -1. */
  get speechStart(): number {
    return this.fired ? this.onset : -1;
  }
}
