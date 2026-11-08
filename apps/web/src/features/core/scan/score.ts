/**
 * THE SCORE (BRIEF-HUD-SCAN-1 7; round two's cue sheet, his "yeah cool" in OWNER-ISSUES 158): B, the short score under the boot's
 * film, synthesised here on the audio clock. No files, nothing from the network. The cue sheet, cue by cue:
 *   1 the eye opens      a low pad fades in under the point of light: one note, felt more than heard
 *   2 the scan           the pad rises a fifth as the front crosses the desk; a fine granular tick under it, the sound of points
 *                        landing, thinning as the room fills
 *   3 the things         one soft tick per thing found, each a semitone lower than the last
 *   4 the orb forms      the pad opens to a chord as the sphere resolves; the chord holds
 *   5 the stamp          a faint typing tick under the cursor, dry, no echo
 *   6 the feeds          three soft ticks, rising, one per feed; under the third the chord warms a shade
 *   7 the recognition    the tone (the app's own, assistant/sfx.ts: ui/machine.ts plays it as the box lands); the chord stops dead
 *                        with it; the wave is a soft noise sweep that follows it out, 700 ms
 *   8 the greeting       nothing under the voice: the voice has the floor
 *   9 the landing        silence, on purpose
 * A (the one tone, as today: silence but the tone on the lock) is the Sounds setting's quieter choice (Settings → Voice & home,
 * "The boot's score"). The platform's rule is honoured and said nowhere: a cold open on iOS is silent until a tap, so the score plays
 * only where the phone allows sound (his sounds on and the phone tapped: assistant/sfx.ts sfxAllowed); a reboot, which comes from a
 * tap, hears it. The cues are driven by the boot's own phases (shell/boot.ts calls them as each moment comes), so the sound and the
 * picture never drift.
 */
import { sfxAllowed } from '../../../assistant/sfx';

export interface Score {
  /** The scan begins: the pad rises a fifth, the granular ticks start. */
  scan(): void;
  /** A thing found: one soft tick, a semitone lower than the last. */
  thing(): void;
  /** The sphere resolves: the pad opens to a chord. */
  sphere(): void;
  /** The stamp types: a faint dry tick under the cursor. */
  typing(): void;
  /** A feed answered: a soft tick, rising with each; the third warms the chord a shade. */
  feed(): void;
  /** The recognition: the chord stops dead; the wave follows the tone out (the tone itself is the lock's, ui/machine.ts). */
  lock(): void;
  /** The greeting: nothing under the voice. */
  voice(): void;
  /** Stopped early (a skip): everything goes in 50 ms. */
  stop(): void;
  /** Whether anything is sounding. */
  readonly on: boolean;
}

const NONE: Score = { scan() {}, thing() {}, sphere() {}, typing() {}, feed() {}, lock() {}, voice() {}, stop() {}, on: false };

/** What the score did, for the checks (window.__bootState.score). */
export const scoreState = { on: false, cues: [] as string[] };
/** A boot begins: what the last one did is forgotten (A plays no score and says so by an empty list). */
export function resetScoreState(): void {
  scoreState.on = false;
  scoreState.cues = [];
}

/**
 * Start the score under the boot (B). Null where the phone allows no sound now (a cold open before any tap: iOS's rule), or his
 * sounds are off, or he chose A: the boot then has the one tone alone.
 */
export function startScore(): Score {
  scoreState.cues = [];
  if (!sfxAllowed()) {
    scoreState.on = false;
    return NONE;
  }
  let a: AudioContext;
  try {
    a = new AudioContext();
  } catch {
    scoreState.on = false;
    return NONE;
  }
  void a.resume().catch(() => undefined);
  scoreState.on = true;
  const out = a.createGain();
  out.gain.value = 0.6;
  out.connect(a.destination);
  const now = () => a.currentTime;
  const cue = (name: string) => scoreState.cues.push(name);

  // the pad: two low voices a hair apart (a slow beat between them) through a low-pass, felt more than heard
  const padGain = a.createGain();
  padGain.gain.setValueAtTime(0.0001, now());
  padGain.gain.exponentialRampToValueAtTime(0.11, now() + 0.9);
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(240, now());
  padGain.connect(lp).connect(out);
  const voices: OscillatorNode[] = [];
  const voice = (f: number, type: OscillatorType, g: number) => {
    const o = a.createOscillator();
    const gg = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now());
    gg.gain.value = g;
    o.connect(gg).connect(padGain);
    o.start();
    voices.push(o);
    return o;
  };
  const root = 55; // A1
  const v1 = voice(root, 'triangle', 0.5);
  const v2 = voice(root * 1.004, 'triangle', 0.4);
  const v3 = voice(root * 2, 'sine', 0.18);
  // the chord's voices, silent until the sphere resolves
  const chordGain = a.createGain();
  chordGain.gain.value = 0.0001;
  chordGain.connect(lp);
  const chord = [root * 3, root * 2.997 * 1.5, root * 4 * 1.2599].map((f, i) => {
    const o = a.createOscillator();
    const gg = a.createGain();
    o.type = i === 2 ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(f, now());
    gg.gain.value = [0.16, 0.12, 0.09][i]!;
    o.connect(gg).connect(chordGain);
    o.start();
    return { o, gg };
  });
  // the granular ticks under the scan: short filtered noise grains, thinning as the room fills
  let noise: AudioBuffer | null = null;
  const grainBuffer = () => {
    if (noise) return noise;
    const n = Math.round(a.sampleRate * 0.03);
    noise = a.createBuffer(1, n, a.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    return noise;
  };
  const grain = (at: number, vol: number, f: number) => {
    const src = a.createBufferSource();
    src.buffer = grainBuffer();
    const bp = a.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f, at);
    bp.Q.value = 8;
    const g = a.createGain();
    g.gain.setValueAtTime(vol, at);
    src.connect(bp).connect(g).connect(out);
    src.start(at);
  };
  /** One short tick: a sine blip with a dry envelope. */
  const tick = (f: number, vol: number, dur = 0.05, type: OscillatorType = 'sine') => {
    const t = now();
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  };
  let things = 0;
  let feeds = 0;
  let typed = 0;
  let locked = false;
  let stopped = false;
  const score: Score = {
    get on() {
      return scoreState.on;
    },
    scan() {
      cue('scan');
      const t = now();
      // the pad rises a fifth as the front crosses the desk
      for (const o of [v1, v2]) o.frequency.exponentialRampToValueAtTime(o.frequency.value * 1.5, t + 0.7);
      v3.frequency.exponentialRampToValueAtTime(v3.frequency.value * 1.5, t + 0.7);
      lp.frequency.linearRampToValueAtTime(520, t + 1.8);
      // the points landing: grains thick at first, thinning as the room fills (about 2 s)
      for (let i = 0; i < 70; i++) {
        const k = i / 70;
        const at = t + k * k * 2.0;
        if (Math.random() < 1 - 0.75 * k) grain(at, 0.012 * (1 - 0.5 * k), 2400 + Math.random() * 2600);
      }
    },
    thing() {
      cue('thing');
      // each a semitone lower than the last, from A5 down
      tick(880 * Math.pow(2, -things / 12), 0.03, 0.07);
      things++;
    },
    sphere() {
      cue('sphere');
      const t = now();
      chordGain.gain.setValueAtTime(0.0001, t);
      chordGain.gain.exponentialRampToValueAtTime(0.5, t + 0.9);
      lp.frequency.linearRampToValueAtTime(1100, t + 1.2);
    },
    typing() {
      // a faint dry tick under the cursor, one every few characters (never a clatter)
      if (typed++ % 3) return;
      tick(3200, 0.008, 0.012, 'square');
    },
    feed() {
      cue('feed');
      tick([1175, 1319, 1480][Math.min(2, feeds)]!, 0.028, 0.08);
      // under the third the chord warms a shade (its upper voice a touch brighter)
      if (feeds === 2) chord[2]!.gg.gain.setTargetAtTime(0.14, now(), 0.3);
      feeds++;
    },
    lock() {
      if (locked) return;
      locked = true;
      cue('lock');
      const t = now();
      // the chord and the pad stop dead with the tone; the wave is a soft noise sweep that follows it out, 700 ms
      chordGain.gain.cancelScheduledValues(t);
      chordGain.gain.setValueAtTime(chordGain.gain.value, t);
      chordGain.gain.linearRampToValueAtTime(0.0001, t + 0.03);
      padGain.gain.cancelScheduledValues(t);
      padGain.gain.setValueAtTime(padGain.gain.value, t);
      padGain.gain.linearRampToValueAtTime(0.0001, t + 0.03);
      const n = Math.round(a.sampleRate * 0.7);
      const buf = a.createBuffer(1, n, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 1.6);
      const src = a.createBufferSource();
      src.buffer = buf;
      const bp = a.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 2.5;
      bp.frequency.setValueAtTime(900, t);
      bp.frequency.exponentialRampToValueAtTime(4800, t + 0.7);
      const g = a.createGain();
      g.gain.setValueAtTime(0.05, t);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.7);
      src.connect(bp).connect(g).connect(out);
      src.start(t);
    },
    voice() {
      cue('voice');
      // nothing under the voice: whatever is left goes
      out.gain.setTargetAtTime(0.0001, now(), 0.08);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      cue('stop');
      scoreState.on = false;
      try {
        out.gain.setTargetAtTime(0, now(), 0.05);
      } catch {
        /* closed */
      }
      setTimeout(() => {
        for (const o of voices) {
          try {
            o.stop();
          } catch {
            /* stopped */
          }
        }
        for (const c of chord) {
          try {
            c.o.stop();
          } catch {
            /* stopped */
          }
        }
        void a.close().catch(() => undefined);
      }, 400);
    },
  };
  return score;
}
