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

// ---------------------------------------------------------------- the next three games' sound (BRIEF-GAMES-3)

/** A loop of our own, by its numbers: the chords, the scale the lead picks from, the pace and which voices play. */
export interface TuneSpec {
  /** Chord tones per bar (four bars), semitones from the root. */
  chords: number[][];
  /** The notes the lead picks from, semitones from the root. */
  scale: number[];
  /** The root, in semitones from A4 (−9 is middle C). */
  root: number;
  /** Beats a minute at pace 0 and at pace 1. */
  bpm: [number, number];
  kick?: boolean;
  clap?: boolean;
  hats?: boolean;
  /** The bass's steps in a bar of sixteen. */
  bass?: number[];
  bassWave?: OscillatorType;
  arpWave?: OscillatorType;
  leadWave?: OscillatorType;
  /** The loop's level (the runner's is 0.32). */
  level?: number;
  seed?: number;
}

/**
 * A generative loop that follows a pace (0…1): a bass, an arpeggio, drums if it has them and a lead made up afresh
 * every two bars. Like the runner's, it is scheduled a little ahead of the audio clock from the game's own frame, so
 * it stops when the game pauses.
 */
export class Tune {
  private next = 0;
  private step = 0;
  private bus: GainNode | null = null;
  private seed: number;
  private lead: number[] = [];
  pace = 0;
  playing = false;
  constructor(private synth: Synth, private spec: TuneSpec) {
    this.seed = spec.seed ?? 11;
  }
  private rnd(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
  private get level(): number {
    return this.spec.level ?? 0.28;
  }
  start(): void {
    const c = this.synth.ctx;
    const dest = this.synth.dest;
    if (!c || !dest) return;
    if (!this.bus) {
      this.bus = c.createGain();
      this.bus.gain.value = this.level;
      this.bus.connect(dest);
    }
    this.bus.gain.setTargetAtTime(this.level, c.currentTime, 0.05);
    this.next = c.currentTime + 0.05;
    this.step = 0;
    this.playing = true;
  }
  stop(): void {
    this.playing = false;
    const c = this.synth.ctx;
    if (this.bus && c) this.bus.gain.setTargetAtTime(0.0001, c.currentTime, 0.04);
  }
  get bpm(): number {
    const [a, b] = this.spec.bpm;
    return a + (b - a) * Math.min(1, Math.max(0, this.pace));
  }
  pump(): void {
    const c = this.synth.ctx;
    if (!this.playing || !c || !this.bus || !this.synth.on) return;
    if (this.next < c.currentTime - 0.25) this.next = c.currentTime + 0.02;
    while (this.next < c.currentTime + 0.12) {
      this.play(this.step, this.next - c.currentTime);
      this.next += 60 / this.bpm / 4;
      this.step = (this.step + 1) % 64;
    }
  }
  private play(s: number, at: number): void {
    const sp = this.spec;
    const bar = Math.floor(s / 16);
    const i = s % 16;
    const chord = sp.chords[bar % sp.chords.length]!;
    const bus = this.bus;
    const t = (o: ToneOpts) => this.synth.tone({ ...o, at }, bus);
    const n = (o: NoiseOpts) => this.synth.noise({ ...o, at }, bus);
    const sixteenth = 60 / this.bpm / 4;
    const hz = (semi: number) => note(sp.root + semi);
    if (sp.kick && i % 4 === 0) t({ f: 150, to: 42, dur: 0.2, type: 'sine', vol: 0.5 });
    if (sp.clap && (i === 4 || i === 12)) n({ dur: 0.11, f: 1700, q: 0.8, vol: 0.2 });
    if (sp.hats && i % 2 === 1) n({ dur: 0.03, f: 8200, type: 'highpass', q: 0.7, vol: 0.05 + 0.04 * this.pace });
    if ((sp.bass ?? [0, 6, 8, 14]).includes(i)) t({ f: hz(chord[0]! - 24), dur: sixteenth * 2.4, type: sp.bassWave ?? 'triangle', vol: 0.38 });
    if (i % 2 === 0) {
      const k = (i / 2) % 6;
      t({ f: hz(chord[k % 3]! + (k >= 3 ? 12 : 0)), dur: sixteenth * 1.5, type: sp.arpWave ?? 'square', vol: 0.04 });
    }
    if (i === 0 && bar % 2 === 0) this.lead = Array.from({ length: 8 }, () => (this.rnd() < 0.35 ? -1 : sp.scale[Math.floor(this.rnd() * sp.scale.length)]!));
    if (bar % 2 === 1 && i % 2 === 0) {
      const v = this.lead[i / 2];
      if (v !== undefined && v >= 0) t({ f: hz(v + 12), dur: sixteenth * 1.7, type: sp.leadWave ?? 'triangle', vol: 0.065 });
    }
  }
}

/**
 * A little motor's hum: two saws a few cents apart and a square an octave down, through a low-pass; the pitch follows
 * the speed (0…1), the loudness the throttle, and a boost opens the filter. Made from the synth's context (woken in a
 * tap), let go on stop.
 */
export class Hum {
  private osc: OscillatorNode[] = [];
  private g: GainNode | null = null;
  private f: BiquadFilterNode | null = null;
  constructor(private synth: Synth) {}
  start(): void {
    const c = this.synth.ctx, dest = this.synth.dest;
    if (!c || !dest || this.g) return;
    this.g = c.createGain();
    this.g.gain.value = 0.0001;
    this.f = c.createBiquadFilter();
    this.f.type = 'lowpass';
    this.f.frequency.value = 700;
    this.f.Q.value = 2;
    this.f.connect(this.g).connect(dest);
    for (const [type, det] of [['sawtooth', -7], ['sawtooth', 6], ['square', 0]] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = 60;
      o.detune.value = det;
      const og = c.createGain();
      og.gain.value = type === 'square' ? 0.25 : 0.5;
      o.connect(og).connect(this.f);
      o.start();
      this.osc.push(o);
    }
  }
  /** speed 0…1 (past 1 in a boost), throttle 0…1. */
  set(speed: number, throttle: number, boost: boolean): void {
    const c = this.synth.ctx;
    if (!c || !this.g || !this.f) return;
    const t = c.currentTime;
    const base = 48 + 150 * Math.max(0, speed);
    this.osc.forEach((o, i) => o.frequency.setTargetAtTime(i === 2 ? base / 2 : base, t, 0.05));
    this.f.frequency.setTargetAtTime(boost ? 2600 : 520 + 1100 * Math.max(0, speed) * (0.5 + throttle * 0.5), t, 0.06);
    this.g.gain.setTargetAtTime(this.synth.on ? 0.035 + 0.05 * throttle + (boost ? 0.03 : 0) : 0.0001, t, 0.08);
  }
  stop(): void {
    const c = this.synth.ctx;
    if (this.g && c) this.g.gain.setTargetAtTime(0.0001, c.currentTime, 0.03);
    const osc = this.osc, g = this.g;
    this.osc = [];
    this.g = null;
    this.f = null;
    setTimeout(() => {
      for (const o of osc) {
        try {
          o.stop();
          o.disconnect();
        } catch {
          /* already stopped */
        }
      }
      try {
        g?.disconnect();
      } catch {
        /* gone */
      }
    }, 200);
  }
}
