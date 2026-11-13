/**
 * THE STUDIO'S SOUND: a tune is text in a small note language (our own, played by the same few lines in the app and in the page
 * a game is exported as): notes like C4, F#3 or Bb4, `-` for a rest, `:2` after a note for two beats, `|` between bars. A
 * game's preset is one of eight loops made here (one for each world of the kit), or his own eight bars typed in.
 * Pure but for `startTune`, which is handed an audio context.
 */
export interface Note {
  midi: number;
  rest: boolean;
  beats: number;
}
const BASE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function parseTune(text: string): Note[] {
  const out: Note[] = [];
  for (const tok of text.replace(/\|/g, ' ').split(/\s+/)) {
    if (!tok) continue;
    const [name, len] = tok.split(':');
    const beats = Math.max(0.25, Math.min(8, Number(len) || 1));
    if (name === '-') {
      out.push({ midi: 0, rest: true, beats });
      continue;
    }
    const m = /^([A-Ga-g])([#b]?)(\d)$/.exec(name ?? '');
    if (!m) continue;
    const semi = (BASE[m[1]!.toUpperCase()] ?? 0) + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    out.push({ midi: 12 * (Number(m[3]) + 1) + semi, rest: false, beats });
  }
  return out;
}
/** The bars of a tune typed in: the text between bar lines that holds any notes. */
export const bars = (text: string): string[] => text.split('|').map((b) => b.trim()).filter((b) => parseTune(b).length);
/** His eight bars: at most eight bars are kept. */
export const eightBars = (text: string): string => bars(text).slice(0, 8).join(' | ');

const NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const SCALES: Record<string, number[]> = { major: [0, 2, 4, 7, 9], minor: [0, 3, 5, 7, 10], dorian: [0, 2, 3, 7, 9] };
const noteName = (midi: number): string => {
  const semi = midi % 12;
  const flat = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'][semi]!;
  void NAMES;
  return `${flat}${Math.floor(midi / 12) - 1}`;
};
function loop(root: number, scale: number[], seed: number): string {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const bar: string[] = [];
  for (let b = 0; b < 8; b++) {
    const chord = [0, 0, 3, 4, 0, 5, 3, 4][b]! % scale.length;
    const notes: string[] = [];
    for (let i = 0; i < 4; i++) {
      const step = scale[(chord + [0, 2, 1, 3][i]! + (rnd() > 0.7 ? 1 : 0)) % scale.length]!;
      notes.push(rnd() > 0.88 ? '-' : noteName(root + step + (i === 3 ? 12 : 0)));
    }
    bar.push(notes.join(' '));
  }
  return bar.join(' | ');
}
/** The eight presets, one for each world of the kit. */
export const PRESETS: Record<string, string> = {
  hills: loop(60, SCALES.major!, 11),
  caves: loop(55, SCALES.minor!, 23),
  roofs: loop(57, SCALES.dorian!, 37),
  factory: loop(52, SCALES.minor!, 41),
  clouds: loop(67, SCALES.major!, 53),
  ship: loop(53, SCALES.dorian!, 67),
  snow: loop(64, SCALES.major!, 71),
  tower: loop(50, SCALES.minor!, 89),
};
export const tuneOf = (g: { music: string; tune: string }): string => (g.tune.trim() ? eightBars(g.tune) : (PRESETS[g.music] ?? ''));

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);
/** Play a tune on a loop: notes are scheduled a little ahead, so a busy frame never breaks it. Returns what stops it. */
export function startTune(ctx: AudioContext, dest: AudioNode, text: string, bpm = 112, vol = 0.05): { stop(): void } {
  const notes = parseTune(text);
  if (!notes.length) return { stop() {} };
  const beat = 60 / bpm;
  let i = 0;
  let when = ctx.currentTime + 0.05;
  let alive = true;
  const pump = () => {
    if (!alive) return;
    while (when < ctx.currentTime + 0.4) {
      const n = notes[i % notes.length]!;
      if (!n.rest) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = hz(n.midi);
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(vol, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, when + n.beats * beat * 0.95);
        o.connect(g).connect(dest);
        o.start(when);
        o.stop(when + n.beats * beat);
      }
      when += n.beats * beat;
      i++;
    }
  };
  const id = setInterval(pump, 120);
  pump();
  return {
    stop() {
      alive = false;
      clearInterval(id);
    },
  };
}

/** The arcade's synth, as far as a tune needs it. */
interface Bus {
  ctx: AudioContext | null;
  dest: AudioNode | null;
}
/** A tune the arcade's frame can start, stop and pause as it does its own music (the shell's `makeTune`). */
export class NoteTune {
  private h: { stop(): void } | null = null;
  constructor(private bus: Bus, private text: string, private bpm = 112) {}
  start(): void {
    this.stop();
    const c = this.bus.ctx;
    const d = this.bus.dest;
    if (c && d && this.text) this.h = startTune(c, d, this.text, this.bpm);
  }
  stop(): void {
    this.h?.stop();
    this.h = null;
  }
}
