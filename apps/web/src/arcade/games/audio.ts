/**
 * The two games' sound, made on the phone: every effect is an oscillator or a burst of noise shaped as it plays, and
 * the runner's music is a short loop written here and played note by note (no recorded or copied audio anywhere).
 * One AudioContext for both games, made or woken inside a tap (phones allow sound only from there).
 */

type AudioCtor = typeof AudioContext;
const ctor = (): AudioCtor | undefined =>
  (globalThis as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;

let shared: AudioContext | null = null;
let out: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

export interface ToneOpts {
  /** Frequency (Hz), and where it slides to by the end. */
  f: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  /** Seconds from now. */
  at?: number;
  attack?: number;
}
export interface NoiseOpts {
  dur: number;
  vol?: number;
  /** The filter's centre (Hz) and where it slides to. */
  f?: number;
  to?: number;
  q?: number;
  type?: BiquadFilterType;
  at?: number;
}

export class Synth {
  private gain: GainNode | null = null;
  on: boolean;
  /** Effects played (the harness counts them). */
  played = 0;
  constructor(on = true) {
    this.on = on;
  }
  /** Make (or wake) the context; call it inside a tap. Safe to call often. */
  wake(): boolean {
    try {
      if (!shared) {
        const C = ctor();
        if (!C) return false;
        shared = new C({ latencyHint: 'interactive' });
        out = shared.createGain();
        out.gain.value = 0.9;
        const comp = shared.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 4;
        out.connect(comp).connect(shared.destination);
      }
      if (shared.state === 'suspended') void shared.resume().catch(() => undefined);
      if (!this.gain) {
        this.gain = shared.createGain();
        this.gain.gain.value = this.on ? 1 : 0;
        this.gain.connect(out!);
      }
      return true;
    } catch {
      return false;
    }
  }
  get ctx(): AudioContext | null {
    return shared;
  }
  /** This game's own output (the music joins it too). */
  get dest(): AudioNode | null {
    return this.gain;
  }
  setOn(on: boolean): void {
    this.on = on;
    if (this.gain && shared) this.gain.gain.setTargetAtTime(on ? 1 : 0, shared.currentTime, 0.02);
  }
  private ready(): AudioContext | null {
    return this.on && shared && this.gain && shared.state === 'running' ? shared : null;
  }
  tone(o: ToneOpts, dest: AudioNode | null = this.gain): void {
    const c = this.ready();
    if (!c || !dest) return;
    const t = c.currentTime + (o.at ?? 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
    const v = o.vol ?? 0.2;
    const a = o.attack ?? 0.004;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
    this.played++;
  }
  noise(o: NoiseOpts, dest: AudioNode | null = this.gain): void {
    const c = this.ready();
    if (!c || !dest) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      let s = 12345;
      for (let i = 0; i < d.length; i++) {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        d[i] = (s / 0x3fffffff - 1) * 0.9;
      }
    }
    const t = c.currentTime + (o.at ?? 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.f ?? 1200, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.2, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.02);
    this.played++;
  }
  /** Let this game's output go (the shared context stays for the next game). */
  close(): void {
    try {
      this.gain?.disconnect();
    } catch {
      /* already gone */
    }
    this.gain = null;
  }
}

// ---------------------------------------------------------------- the runner's music

const A4 = 440;
const note = (semis: number) => A4 * Math.pow(2, semis / 12);
/** Four bars in A minor (Am, F, C, G), as semitones from A4 for the chord tones. */
const CHORDS: number[][] = [
  [0, 3, 7],
  [-4, 0, 3],
  [3, 7, 10],
  [-2, 2, 5],
];
/** The pentatonic notes the lead picks from (A minor). */
const PENTA = [0, 3, 5, 7, 10, 12, 15];

/**
 * A short loop of our own that speeds up with the run: a bass line, an arpeggio, a kick, a clap, hats once the pace
 * builds, and a lead phrase made up afresh every two bars from the pentatonic scale. Scheduled a little ahead of the
 * audio clock from the game's own frame (so it stops when the game pauses).
 */
export class RunMusic {
  private next = 0;
  private step = 0;
  private bus: GainNode | null = null;
  private seed = 7;
  private lead: number[] = [];
  pace = 0;
  playing = false;
  constructor(private synth: Synth) {}
  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
  start(): void {
    const c = this.synth.ctx;
    const dest = this.synth.dest;
    if (!c || !dest) return;
    if (!this.bus) {
      this.bus = c.createGain();
      this.bus.gain.value = 0.32;
      this.bus.connect(dest);
    }
    this.bus.gain.setTargetAtTime(0.32, c.currentTime, 0.05);
    this.next = c.currentTime + 0.05;
    this.step = 0;
    this.playing = true;
  }
  stop(): void {
    this.playing = false;
    const c = this.synth.ctx;
    if (this.bus && c) this.bus.gain.setTargetAtTime(0.0001, c.currentTime, 0.04);
  }
  /** 104 beats a minute at the start, 150 at full pace. */
  get bpm(): number {
    return 104 + 46 * Math.min(1, Math.max(0, this.pace));
  }
  /** Called every frame: schedules the notes of the next 120 ms. */
  pump(): void {
    const c = this.synth.ctx;
    if (!this.playing || !c || !this.bus || !this.synth.on) return;
    if (this.next < c.currentTime - 0.25) this.next = c.currentTime + 0.02; // after a stall, do not rush to catch up
    while (this.next < c.currentTime + 0.12) {
      this.play(this.step, this.next - c.currentTime);
      this.next += 60 / this.bpm / 4;
      this.step = (this.step + 1) % 64;
    }
  }
  private play(s: number, at: number): void {
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const chord = CHORDS[bar]!;
    const bus = this.bus;
    const t = (o: ToneOpts) => this.synth.tone({ ...o, at }, bus);
    const n = (o: NoiseOpts) => this.synth.noise({ ...o, at }, bus);
    const sixteenth = 60 / this.bpm / 4;
    // kick on the beat, clap on two and four
    if (i % 4 === 0) t({ f: 150, to: 42, dur: 0.22, type: 'sine', vol: 0.55 });
    if (i === 4 || i === 12) n({ dur: 0.12, f: 1700, q: 0.8, vol: 0.22 });
    if (this.pace > 0.25 && i % 2 === 1) n({ dur: 0.035, f: 8000, type: 'highpass', q: 0.7, vol: 0.06 + 0.05 * this.pace });
    // bass, syncopated
    if (i === 0 || i === 6 || i === 8 || i === 14) t({ f: note(chord[0]! - 24), dur: sixteenth * 2.6, type: 'triangle', vol: 0.42 });
    // arpeggio in eighths, up two octaves of the chord
    if (i % 2 === 0) {
      const k = (i / 2) % 6;
      const semi = chord[k % 3]! + (k >= 3 ? 12 : 0);
      t({ f: note(semi), dur: sixteenth * 1.6, type: 'square', vol: 0.045 });
    }
    // the lead: a new phrase every two bars
    if (i === 0 && bar % 2 === 0) this.lead = Array.from({ length: 8 }, () => (this.rnd() < 0.35 ? -1 : PENTA[Math.floor(this.rnd() * PENTA.length)]!));
    if (this.pace > 0.1 && bar % 2 === 1 && i % 2 === 0) {
      const v = this.lead[i / 2];
      if (v !== undefined && v >= 0) t({ f: note(v + 12), dur: sixteenth * 1.8, type: 'triangle', vol: 0.07 });
    }
  }
}
