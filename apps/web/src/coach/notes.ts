/**
 * NOTES (BRIEF-REST-B part 2): a frequency as a note and how many cents off it is, the open strings of the instruments the tuner
 * knows, and the words for a reading. Pure: nothing here touches the page, so the node tests run it (apps/edge/test/restb.test.mjs).
 * Equal temperament, A4 = 440 Hz.
 */
export const A4 = 440;
const NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** MIDI note number (A4 = 69) of a frequency, as a real number. */
export const midiOf = (hz: number, a4 = A4): number => 69 + 12 * Math.log2(hz / a4);
/** The frequency of a MIDI note number. */
export const hzOf = (midi: number, a4 = A4): number => a4 * 2 ** ((midi - 69) / 12);

/** "A4", "C#3", "Bb2" or "C♯3" → MIDI note number (null if it is not a note). */
export function midiFromName(name: string): number | null {
  const m = /^([A-Ga-g])([#♯b♭]?)(-?\d)$/.exec(name.trim());
  if (!m) return null;
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]!.toUpperCase() as 'C']!;
  const acc = m[2] === '#' || m[2] === '♯' ? 1 : m[2] === 'b' || m[2] === '♭' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + base + acc;
}
/** MIDI note number → "A4" (sharps written ♯). */
export const nameOfMidi = (midi: number): string => `${NAMES[((Math.round(midi) % 12) + 12) % 12]}${Math.floor(Math.round(midi) / 12) - 1}`;
/** The frequency of a named note: "A4" → 440, "E2" → 82.41. */
export const hzOfName = (name: string, a4 = A4): number => {
  const m = midiFromName(name);
  if (m == null) throw new Error(`not a note: ${name}`);
  return hzOf(m, a4);
};

/** What a frequency is as a note: the nearest note and how far from it, in cents (−50…+50). */
export interface Reading {
  midi: number;
  note: string;
  name: string;
  octave: number;
  cents: number;
  hz: number;
}
export function reading(hz: number, a4 = A4): Reading {
  const m = midiOf(hz, a4);
  const nearest = Math.round(m);
  return { midi: nearest, note: nameOfMidi(nearest), name: NAMES[((nearest % 12) + 12) % 12]!, octave: Math.floor(nearest / 12) - 1, cents: Math.round((m - nearest) * 100 * 10) / 10, hz };
}
/** The cents a frequency is above (+) or below (−) a target frequency. */
export const centsBetween = (hz: number, target: number): number => 1200 * Math.log2(hz / target);

export type Instrument = 'guitar' | 'bass' | 'ukulele' | 'violin' | 'free';
export interface Tuning {
  id: Instrument;
  label: string;
  /** The open strings, lowest first, as notes. */
  strings: string[];
}
export const TUNINGS: Tuning[] = [
  { id: 'guitar', label: 'Guitar', strings: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'bass', label: 'Bass', strings: ['E1', 'A1', 'D2', 'G2'] },
  { id: 'ukulele', label: 'Ukulele', strings: ['G4', 'C4', 'E4', 'A4'] },
  { id: 'violin', label: 'Violin', strings: ['G3', 'D4', 'A4', 'E5'] },
  { id: 'free', label: 'Any note', strings: [] },
];
export const tuningOf = (id: string): Tuning => TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]!;

/** The lowest and highest pitch the detector should look for with a tuning (a little beyond its strings). */
export function rangeOf(t: Tuning): { minHz: number; maxHz: number } {
  if (!t.strings.length) return { minHz: 55, maxHz: 1400 };
  const f = t.strings.map((s) => hzOfName(s));
  return { minHz: Math.max(30, Math.min(...f) * 0.8), maxHz: Math.min(1600, Math.max(...f) * 2.2) };
}

/** How the tuner reads a pitch: the note and cents, the open string it is near (within half a semitone), and whether it is in tune (5 cents). */
export interface Tuned extends Reading {
  string: string | null;
  /** Cents from that string (or from the note, when no string is near). */
  off: number;
  inTune: boolean;
  words: string;
}
export const IN_TUNE_CENTS = 5;
export function tunerReading(hz: number, t: Tuning, a4 = A4): Tuned {
  const r = reading(hz, a4);
  const near = t.strings.map((s) => ({ s, c: centsBetween(hz, hzOfName(s, a4)) })).filter((x) => Math.abs(x.c) <= 100).sort((a, b) => Math.abs(a.c) - Math.abs(b.c))[0];
  const off = near ? near.c : r.cents;
  const inTune = Math.abs(off) <= IN_TUNE_CENTS;
  const who = near ? near.s : r.note;
  const words = inTune ? `${who}: in tune` : `${who}: ${Math.round(Math.abs(off))} cents ${off > 0 ? 'sharp' : 'flat'}${near ? (off > 0 ? ' — loosen it a little' : ' — tighten it a little') : ''}`;
  return { ...r, string: near ? near.s : null, off: Math.round(off * 10) / 10, inTune, words };
}
