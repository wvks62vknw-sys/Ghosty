/**
 * THE CREATIVE PACK, the sound and the words (BRIEF-PACKS-2; OWNER-ISSUES 92 ④): a SONG whose melody and chords are made in
 * code from his lyrics (the same seed gives the same tune), played by the phone from a synth written here and shared as a
 * small WAV or MIDI file; chord progressions; a BEAT he taps in, looped and exported the same way; names for a band, a pet or
 * a team; a rhyme finder; the day's drawing prompt; the seed of a story; the rules of a poem and a check of its form.
 * The pictures (poster, card, comic strip, logo, palette) are creativeart.ts. Pure: no storage, no network, no audio device
 * — the phone's sheet only plays and saves what is made here. Nothing is ever copied from anyone's art, lyrics or music.
 */
import { syllables } from './work';

/** The phone opens the drum pads with no model ("make a beat", "open the drum pads", "a house beat at 124"). */
export const BEAT_ASK = /^(?!.*\b(?:song|track|album|spotify|by)\b)(?:(?:make|start|open|play|give|do)\s+(?:me\s+)?(?:an?\s+|the\s+|my\s+)?(?:[a-z ]{0,14}?\s)?(?:beat|drum (?:machine|pads?|loop))\b.*|(?:open )?(?:the )?(?:drum pads?|beat maker))[.!?]*$/i;
/** The phone answers "a drawing prompt" itself: the day's prompt, no model. */
export const DRAW_ASK = /^(?:(?:give me|got|have you got|what'?s|what is|tell me)\s+)?(?:an?\s+|today'?s\s+|the\s+)?(?:drawing prompt|something to draw|what should i draw)(?:\s+(?:today|for today))?[?.!]*$/i;

// ---------------------------------------------------------------- a seed

/** A number from words (FNV-1a), so the same words always make the same thing. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (const c of s) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** A small deterministic random number generator (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, a: readonly T[]): T => a[Math.floor(r() * a.length) % a.length]!;
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------- keys, scales and chords

export const KEY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
const PC: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
export type Mode = 'major' | 'minor';
const SCALE: Record<Mode, number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const NUMERALS: Record<Mode, string[]> = { major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], minor: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] };
const PROGS: Record<Mode, number[][]> = {
  major: [[0, 4, 5, 3], [5, 3, 0, 4], [0, 5, 3, 4], [0, 3, 4, 3], [0, 4, 3, 4], [1, 4, 0, 5]],
  minor: [[0, 5, 2, 6], [0, 3, 6, 2], [0, 6, 5, 6], [0, 3, 4, 0], [5, 6, 0, 0], [0, 2, 5, 6]],
};
/** "in D minor", "key of F# major", "Am", "in Bb": the key and the mode, or null. */
export function parseKey(words: string): { key: string; mode: Mode } | null {
  const m = /\b(?:in|key of|key)\s+([A-Ga-g][#b]?)\s*(major|minor|maj|min|m)?\b/.exec(words) ?? /\b([A-G][#b]?)(m|min|minor|maj|major)\b/.exec(words);
  if (!m) return null;
  const k = m[1]!.charAt(0).toUpperCase() + m[1]!.slice(1);
  if (PC[k] === undefined) return null;
  const mode: Mode = /^(?:m|min|minor)$/i.test(m[2] ?? '') ? 'minor' : 'major';
  return { key: KEY_NAMES[PC[k]!]!, mode };
}
/** A tempo in his words ("at 90 bpm", "slow", "upbeat"). */
export function parseTempo(words: string): number | null {
  const n = /\b(\d{2,3})\s*(?:bpm|beats)\b|\bat\s+(\d{2,3})\b/i.exec(words);
  if (n) return Math.min(200, Math.max(40, +(n[1] ?? n[2]!)));
  return /\blullaby|very slow|dirge\b/i.test(words) ? 60 : /\bslow|ballad|gentle|calm\b/i.test(words) ? 72 : /\bfast|upbeat|energetic|dance|party\b/i.test(words) ? 126 : /\brock|punchy\b/i.test(words) ? 132 : null;
}
/** The mode his mood words suggest ("sad", "happy"), else null. */
export const modeOf = (words: string): Mode | null => (/\b(sad|blue|lonely|dark|moody|minor|melanchol|rainy|miss)\w*/i.test(words) ? 'minor' : /\b(happy|bright|sunny|joy|major|cheerful|celebrat|fun)\w*/i.test(words) ? 'major' : null);

const noteMidi = (key: string, mode: Mode, i: number, base = 60): number => {
  const tonic = base + (PC[key] ?? 0);
  const n = SCALE[mode].length;
  return tonic + 12 * Math.floor(i / n) + SCALE[mode][((i % n) + n) % n]!;
};
export interface Chord {
  name: string;
  numeral: string;
  bar: number;
  notes: number[];
  root: number;
}
/** One bar's chord: the triad on a scale degree (root position around middle C, a bass note an octave under), its name and numeral. */
export function chordOn(key: string, mode: Mode, degree: number, bar: number): Chord {
  const notes = [noteMidi(key, mode, degree, 48), noteMidi(key, mode, degree + 2, 48), noteMidi(key, mode, degree + 4, 48)];
  const third = notes[1]! - notes[0]!;
  const fifth = notes[2]! - notes[0]!;
  const root = KEY_NAMES[((notes[0]! % 12) + 12) % 12]!;
  return { name: `${root}${third === 3 ? (fifth === 6 ? 'dim' : 'm') : ''}`, numeral: NUMERALS[mode][degree % 7]!, bar, notes, root: notes[0]! - 12 };
}
/** The progression a seed picks, as a chord for each of the bars (it repeats every four). */
export function chordBars(key: string, mode: Mode, seed: number, bars: number): Chord[] {
  const progs = PROGS[mode];
  const p = progs[seed % progs.length]!;
  return Array.from({ length: bars }, (_, b) => chordOn(key, mode, p[b % p.length]!, b));
}

// ---------------------------------------------------------------- a song from his lyrics

export interface SongNote {
  midi: number;
  /** Beats from the start. */
  start: number;
  dur: number;
  /** The word it carries (a long word's later syllables carry "~"). */
  syl: string;
}
export interface SongLine {
  text: string;
  start: number;
  beats: number;
  section: 'verse' | 'chorus' | 'bridge';
  syllables: number;
}
export interface Song {
  title: string;
  key: string;
  mode: Mode;
  tempo: number;
  seed: number;
  bars: number;
  beats: number;
  chords: Chord[];
  notes: SongNote[];
  lines: SongLine[];
}
export const MAX_LYRIC_LINES = 16;

interface Block {
  kind: 'verse' | 'chorus' | 'bridge';
  lines: string[];
}
/** Lyrics as sections: blank lines and [Chorus] labels divide them; with neither, four lines to a section, verse then chorus. */
export function lyricBlocks(lyrics: string): Block[] {
  const raw = lyrics.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const blocks: Block[] = [];
  let cur: string[] = [];
  let label: Block['kind'] | '' = '';
  const flush = () => {
    if (cur.length) blocks.push({ kind: label || (blocks.length % 2 === 0 ? 'verse' : 'chorus'), lines: cur });
    cur = [];
    label = '';
  };
  for (const l of raw) {
    const lab = /^\[?\s*(verse|chorus|hook|refrain|bridge|outro|intro)\b[^\]]*\]?\s*:?$/i.exec(l);
    if (lab) {
      flush();
      label = /chorus|hook|refrain/i.test(lab[1]!) ? 'chorus' : /bridge|outro|intro/i.test(lab[1]!) ? 'bridge' : 'verse';
    } else if (!l) flush();
    else cur.push(l.slice(0, 80));
  }
  flush();
  if (blocks.length === 1 && blocks[0]!.lines.length > 4) {
    const all = blocks[0]!.lines;
    return Array.from({ length: Math.ceil(all.length / 4) }, (_, i) => ({ kind: i % 2 === 0 ? ('verse' as const) : ('chorus' as const), lines: all.slice(i * 4, i * 4 + 4) }));
  }
  const out: Block[] = [];
  let n = 0;
  for (const b of blocks) {
    const take = b.lines.slice(0, MAX_LYRIC_LINES - n);
    if (take.length) out.push({ ...b, lines: take });
    n += take.length;
  }
  return out;
}

const wordPieces = (line: string): { w: string; sy: number }[] => (line.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).map((w) => ({ w, sy: Math.min(4, syllables(w) || 1) }));

/**
 * The tune for his words: every syllable gets a note in the key, in time (two or three bars to a line), with a chord under
 * each bar. A random walk through the scale, pulled back to the middle, landing on a chord note at each bar and on the key's
 * note at the end of a section. The same lyrics, key, tempo and seed always make the same song.
 */
export function makeSong(o: { lyrics: string; key?: string; mode?: Mode; tempo?: number; seed?: number; title?: string }): Song {
  const key = o.key && PC[o.key] !== undefined ? KEY_NAMES[PC[o.key]!]! : 'C';
  const mode: Mode = o.mode ?? 'major';
  const tempo = Math.min(200, Math.max(40, Math.round(o.tempo ?? 100)));
  const seed = (o.seed ?? hashSeed(o.lyrics)) >>> 0;
  const blocks = lyricBlocks(o.lyrics);
  const all = blocks.flatMap((b) => b.lines.map((l, i) => ({ l, kind: b.kind, last: i === b.lines.length - 1, idx: i })));
  const lines: SongLine[] = [];
  const notes: SongNote[] = [];
  let at = 0;
  const prog = PROGS[mode][seed % PROGS[mode].length]!;
  const degreeAtBar = (bar: number) => prog[bar % prog.length]!;
  for (const ln of all) {
    const ps = wordPieces(ln.l);
    const sylls: { text: string; end: boolean }[] = ps.flatMap((p) => Array.from({ length: p.sy }, (_, i) => ({ text: i === 0 ? p.w : '~', end: i === p.sy - 1 })));
    const n = Math.min(24, sylls.length);
    if (!n) continue;
    const B = n <= 12 ? 8 : n <= 18 ? 12 : 16;
    const w = sylls.slice(0, n).map((s, i) => 1 + (s.end ? 0.5 : 0) + (i === n - 1 ? 1.5 : 0));
    const sum = w.reduce((a, b) => a + b, 0);
    const d = w.map((x) => Math.max(0.25, Math.round(((B * x) / sum) * 4) / 4));
    // snapped to quarter beats, the line fills its bars exactly: the longest note gives or takes a quarter at a time
    for (let guard = 0; guard < 400; guard++) {
      const diff = B - d.reduce((a, b) => a + b, 0);
      if (Math.abs(diff) < 1e-9) break;
      const big = Math.max(...d);
      const i = diff > 0 ? d.indexOf(big) : d.lastIndexOf(big);
      d[i] = Math.max(0.25, d[i]! + (diff > 0 ? 0.25 : -0.25));
    }
    const r = rng(hashSeed(`${seed}:${ln.kind}:${ln.idx}`));
    let idx = ln.kind === 'chorus' ? 4 : ln.kind === 'bridge' ? 3 : 2;
    const startBar = Math.round(at / 4);
    let t = 0;
    for (let i = 0; i < n; i++) {
      const barHere = startBar + Math.floor(t / 4);
      const deg = degreeAtBar(barHere);
      const stable = [0, 2, 4].map((k) => (deg + k) % 7);
      if (i > 0) {
        const pull = idx > 8 ? -1 : idx < 2 ? 1 : 0;
        const choices = [-2, -1, -1, -1, 0, 0, 1, 1, 1, 2];
        idx += pick(r, choices) + (r() < 0.35 ? pull : 0);
      }
      idx = Math.min(11, Math.max(0, idx));
      if (t % 4 === 0 || i === n - 1) {
        // a chord note at the start of a bar; the key's note at the end of a section; a chord note at the end of any line
        const target = i === n - 1 && ln.last ? [0] : stable;
        let best = idx;
        for (let k = 0; k <= 11; k++) {
          const cand = idx + (k % 2 === 0 ? k / 2 : -(k + 1) / 2);
          if (cand >= 0 && cand <= 11 && target.includes(((cand % 7) + 7) % 7)) {
            best = cand;
            break;
          }
        }
        idx = best;
      }
      notes.push({ midi: noteMidi(key, mode, idx), start: at + t, dur: d[i]!, syl: sylls[i]!.text });
      t += d[i]!;
    }
    lines.push({ text: ln.l, start: at, beats: B, section: ln.kind, syllables: n });
    at += B;
  }
  const bars = Math.max(1, Math.round(at / 4));
  return { title: (o.title ?? lines[0]?.text.split(/\s+/).slice(0, 4).join(' ').replace(/(?:\s+(?:at|the|a|an|of|to|in|on|and|with|for|my|your|is|it|i))+$/i, '') ?? 'Song').replace(/[,.!?;:]+$/, '') || 'Song', key, mode, tempo, seed, bars, beats: bars * 4, chords: chordBars(key, mode, seed, bars), notes, lines };
}
/** A chord loop with no words: eight bars of the seed's progression, a simple tune on its chord notes. */
export function makeChordLoop(o: { key?: string; mode?: Mode; tempo?: number; seed?: number }): Song {
  const key = o.key && PC[o.key] !== undefined ? KEY_NAMES[PC[o.key]!]! : 'C';
  const mode: Mode = o.mode ?? 'major';
  const seed = (o.seed ?? 1) >>> 0;
  const chords = chordBars(key, mode, seed, 8);
  const r = rng(seed);
  const notes: SongNote[] = chords.flatMap((c, b) => [0, 1, 2, 3].map((k) => ({ midi: c.notes[[0, 1, 2, 1][k]!]! + 12, start: b * 4 + k, dur: 1, syl: k === 0 ? c.name : '~' })).map((n) => (r() < 0.2 ? { ...n, midi: n.midi + 12 } : n)));
  return { title: `${key} ${mode} chords`, key, mode, tempo: Math.min(200, Math.max(40, Math.round(o.tempo ?? 90))), seed, bars: 8, beats: 32, chords, notes, lines: [] };
}
/** "C - Am - F - G" with the numerals under it. */
export const chordWords = (s: Song): string => `${s.chords.slice(0, 4).map((c) => c.name).join(' – ')}  (${s.chords.slice(0, 4).map((c) => c.numeral).join(' – ')})`;

// ---------------------------------------------------------------- the sound (a synth written here), WAV and MIDI

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
/** The song as sound: a soft organ voice for the tune, a pad of triangle waves for the chords and a bass note under each bar. Mono, -1 to 1. */
export function renderSong(s: Song, rate = 22050, parts: { melody?: boolean; chords?: boolean } = {}): Float32Array {
  const beat = 60 / s.tempo;
  const total = Math.ceil((s.beats * beat + 0.6) * rate);
  const out = new Float32Array(total);
  const voice = (f: number, t0: number, dur: number, gain: number, kind: 'organ' | 'tri' | 'sine', attack: number, release: number) => {
    const i0 = Math.floor(t0 * rate);
    const n = Math.floor((dur + release) * rate);
    for (let i = 0; i < n && i0 + i < total; i++) {
      const t = i / rate;
      const env = Math.min(1, t / attack) * (t < dur ? 1 : Math.max(0, 1 - (t - dur) / release)) * (kind === 'organ' ? 0.75 + 0.25 * Math.exp(-t * 6) : 1);
      const x = 2 * Math.PI * f * t;
      const v = kind === 'organ' ? 0.62 * Math.sin(x) + 0.26 * Math.sin(2 * x) + 0.1 * Math.sin(3 * x) : kind === 'tri' ? (2 / Math.PI) * Math.asin(Math.sin(x)) : Math.sin(x);
      out[i0 + i]! += v * env * gain;
    }
  };
  if (parts.chords !== false) {
    for (const c of s.chords) {
      for (const m of c.notes) voice(hz(m), c.bar * 4 * beat, 4 * beat * 0.97, 0.07, 'tri', 0.04, 0.25);
      voice(hz(c.root), c.bar * 4 * beat, 4 * beat * 0.9, 0.16, 'sine', 0.02, 0.2);
    }
  }
  if (parts.melody !== false) for (const n of s.notes) voice(hz(n.midi), n.start * beat, Math.max(0.08, n.dur * beat * 0.94), 0.34, 'organ', 0.012, 0.14);
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(out[i]!));
  const k = peak > 0.85 ? 0.85 / peak : 1;
  if (k !== 1) for (let i = 0; i < total; i++) out[i]! *= k;
  return out;
}
/** 16-bit mono PCM in a WAV file. */
export function toWav(samples: Float32Array, rate = 22050): Uint8Array {
  const n = samples.length;
  const out = new Uint8Array(44 + n * 2);
  const v = new DataView(out.buffer);
  const tag = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  tag(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  tag(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767), true);
  return out;
}

const vlq = (n: number): number[] => {
  const b = [n & 0x7f];
  while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80);
  return b;
};
const be = (n: number, len: number) => Array.from({ length: len }, (_, i) => (n >> (8 * (len - 1 - i))) & 0xff);
const chunk = (id: string, data: number[]) => [...[...id].map((c) => c.charCodeAt(0)), ...be(data.length, 4), ...data];
const PPQ = 480;
/** A track's events (tick, bytes) in time order as a MIDI track chunk. */
function track(events: { tick: number; bytes: number[] }[]): number[] {
  const sorted = [...events].sort((a, b) => a.tick - b.tick);
  let last = 0;
  const data: number[] = [];
  for (const e of sorted) {
    data.push(...vlq(e.tick - last), ...e.bytes);
    last = e.tick;
  }
  data.push(0, 0xff, 0x2f, 0);
  return chunk('MTrk', data);
}
const meta = (tick: number, type: number, bytes: number[]) => ({ tick, bytes: [0xff, type, ...vlq(bytes.length), ...bytes] });
const text = (s: string) => [...s].map((c) => c.charCodeAt(0) & 0x7f);
/** The song as a MIDI file: tempo, the tune on one track, the chords and a bass on another (any music app opens it). */
export function toMidi(s: Song): Uint8Array {
  const us = Math.round(60_000_000 / s.tempo);
  const t0 = track([meta(0, 0x03, text(s.title.slice(0, 40))), meta(0, 0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]), meta(0, 0x58, [4, 2, 24, 8])]);
  const mel: { tick: number; bytes: number[] }[] = [meta(0, 0x03, text('Tune')), { tick: 0, bytes: [0xc0, 0] }];
  for (const n of s.notes) mel.push({ tick: Math.round(n.start * PPQ), bytes: [0x90, n.midi, 90] }, { tick: Math.round((n.start + n.dur * 0.95) * PPQ), bytes: [0x80, n.midi, 0] });
  const cho: { tick: number; bytes: number[] }[] = [meta(0, 0x03, text('Chords')), { tick: 0, bytes: [0xc1, 0] }];
  for (const c of s.chords) {
    for (const m of [...c.notes, c.root]) cho.push({ tick: c.bar * 4 * PPQ, bytes: [0x91, m, m === c.root ? 80 : 55] }, { tick: (c.bar * 4 + 3.9) * PPQ, bytes: [0x81, m, 0] });
  }
  return Uint8Array.from([...chunk('MThd', [...be(1, 2), ...be(3, 2), ...be(PPQ, 2)]), ...t0, ...track(mel), ...track(cho)]);
}

// ---------------------------------------------------------------- a beat he taps in

export const DRUMS = ['kick', 'snare', 'hat', 'clap'] as const;
export type Drum = (typeof DRUMS)[number];
export interface Beat {
  name: string;
  bpm: number;
  steps: 16;
  rows: Record<Drum, boolean[]>;
}
const row = (s: string): boolean[] => Array.from({ length: 16 }, (_, i) => s[i] === 'x');
const PRESETS: Record<string, { bpm: number; rows: Record<Drum, string> }> = {
  house: { bpm: 124, rows: { kick: 'x...x...x...x...', snare: '................', hat: '..x...x...x...x.', clap: '....x.......x...' } },
  'hip hop': { bpm: 90, rows: { kick: 'x.....x..x......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', clap: '................' } },
  rock: { bpm: 110, rows: { kick: 'x.......x.x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.', clap: '................' } },
  reggae: { bpm: 76, rows: { kick: '........x.......', snare: '........x.......', hat: '..x...x...x...x.', clap: '................' } },
  trap: { bpm: 140, rows: { kick: 'x.......x..x....', snare: '........x.......', hat: 'xxxxxxxxxxxxxxxx', clap: '........x.......' } },
  funk: { bpm: 100, rows: { kick: 'x..x..x...x..x..', snare: '....x..x.x..x...', hat: 'x.xxx.xxx.xxx.xx', clap: '................' } },
  disco: { bpm: 118, rows: { kick: 'x...x...x...x...', snare: '................', hat: '.x.x.x.x.x.x.x.x', clap: '....x.......x...' } },
};
export const BEAT_STYLES = Object.keys(PRESETS);
/** "a house beat at 124", "boom bap 90 bpm", "four on the floor": a preset and a tempo. */
export function beatFromWords(words: string): Beat {
  const w = words.toLowerCase();
  const style = /four on the floor|\bhouse\b|\bedm\b/.test(w) ? 'house' : /hip.?hop|boom.?bap|\brap\b/.test(w) ? 'hip hop' : /\brock\b/.test(w) ? 'rock' : /reggae|one drop/.test(w) ? 'reggae' : /\btrap\b/.test(w) ? 'trap' : /\bfunk/.test(w) ? 'funk' : /disco/.test(w) ? 'disco' : 'hip hop';
  const p = PRESETS[style]!;
  return { name: style, bpm: parseTempo(words) ?? p.bpm, steps: 16, rows: { kick: row(p.rows.kick), snare: row(p.rows.snare), hat: row(p.rows.hat), clap: row(p.rows.clap) } };
}
export const emptyBeat = (bpm = 100): Beat => ({ name: 'my beat', bpm, steps: 16, rows: { kick: row(''), snare: row(''), hat: row(''), clap: row('') } });
/** The grid as text ("x" a hit): kick x...x... */
export const beatGrid = (b: Beat): string => DRUMS.map((d) => `${d.padEnd(5)} ${b.rows[d].map((x) => (x ? 'x' : '.')).join('')}`).join('\n');
/** A pattern from the grid text (the same as beatGrid makes). */
export function beatOfGrid(text: string, bpm: number, name = 'my beat'): Beat | null {
  const rows: Partial<Record<Drum, boolean[]>> = {};
  for (const l of text.split('\n')) {
    const m = /^\s*(kick|snare|hat|clap)\s+([x.]{16})\s*$/i.exec(l);
    if (m) rows[m[1]!.toLowerCase() as Drum] = row(m[2]!.toLowerCase());
  }
  return DRUMS.every((d) => rows[d]) ? { name, bpm: Math.min(200, Math.max(40, bpm)), steps: 16, rows: rows as Record<Drum, boolean[]> } : null;
}
/** The step (0 to 15) a tap at `ms` into the loop belongs to: the nearest sixteenth. */
export const quantise = (ms: number, bpm: number): number => {
  const bar = (4 * 60_000) / bpm;
  return Math.round((((ms % bar) + bar) % bar) / (bar / 16)) % 16;
};
/** The loop as sound: `bars` bars of kick, snare, hat and clap made by a synth written here (noise from a fixed seed). */
export function renderBeat(b: Beat, bars = 1, rate = 22050): Float32Array {
  const step = (60 / b.bpm) / 4;
  const total = Math.ceil(bars * 16 * step * rate);
  const out = new Float32Array(total);
  const r = rng(7);
  const hit = (d: Drum, i0: number) => {
    const n = Math.floor((d === 'hat' ? 0.05 : d === 'kick' ? 0.22 : 0.16) * rate);
    let lp = 0;
    for (let i = 0; i < n && i0 + i < total; i++) {
      const t = i / rate;
      let v = 0;
      if (d === 'kick') v = Math.sin(2 * Math.PI * (45 * t + (75 / 38) * (1 - Math.exp(-38 * t)))) * Math.exp(-t * 16) * 0.9;
      else if (d === 'snare') v = ((r() * 2 - 1) * 0.6 + Math.sin(2 * Math.PI * 190 * t) * 0.4) * Math.exp(-t * 22) * 0.7;
      else if (d === 'hat') {
        const nz = r() * 2 - 1;
        lp += 0.35 * (nz - lp);
        v = (nz - lp) * Math.exp(-t * 90) * 0.35;
      } else v = (r() * 2 - 1) * Math.exp(-t * 28) * (0.5 + 0.5 * Math.sin(2 * Math.PI * 70 * t)) * 0.6;
      out[i0 + i]! += v;
    }
  };
  for (let bar = 0; bar < bars; bar++) for (let s = 0; s < 16; s++) for (const d of DRUMS) if (b.rows[d][s]) hit(d, Math.floor((bar * 16 + s) * step * rate));
  let peak = 0;
  for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(out[i]!));
  if (peak > 0.9) for (let i = 0; i < total; i++) out[i]! *= 0.9 / peak;
  return out;
}
const DRUM_NOTE: Record<Drum, number> = { kick: 36, snare: 38, hat: 42, clap: 39 };
/** The beat as a MIDI file on the drum channel, `bars` bars. */
export function beatToMidi(b: Beat, bars = 4): Uint8Array {
  const us = Math.round(60_000_000 / b.bpm);
  const t0 = track([meta(0, 0x03, text(b.name.slice(0, 40))), meta(0, 0x51, [(us >> 16) & 0xff, (us >> 8) & 0xff, us & 0xff]), meta(0, 0x58, [4, 2, 24, 8])]);
  const ev: { tick: number; bytes: number[] }[] = [meta(0, 0x03, text('Drums'))];
  for (let bar = 0; bar < bars; bar++) for (let s = 0; s < 16; s++) for (const d of DRUMS) if (b.rows[d][s]) ev.push({ tick: (bar * 16 + s) * (PPQ / 4), bytes: [0x99, DRUM_NOTE[d], 100] }, { tick: (bar * 16 + s) * (PPQ / 4) + 60, bytes: [0x89, DRUM_NOTE[d], 0] });
  return Uint8Array.from([...chunk('MThd', [...be(1, 2), ...be(2, 2), ...be(PPQ, 2)]), ...t0, ...track(ev)]);
}

// ---------------------------------------------------------------- names for a band, a pet, a team

const ADJ = ['Midnight', 'Electric', 'Velvet', 'Paper', 'Golden', 'Quiet', 'Neon', 'Wild', 'Lucky', 'Crimson', 'Silver', 'Hollow', 'Rusty', 'Gentle', 'Cosmic', 'Scarlet', 'Brave', 'Sleepy', 'Foggy', 'Marble', 'Copper', 'Dusty', 'Little', 'Giant'];
const NOUN = ['Crows', 'Lanterns', 'Engines', 'Pilots', 'Foxes', 'Anchors', 'Parade', 'Static', 'Harbour', 'Orchard', 'Compass', 'Tides', 'Thunder', 'Kites', 'Rivers', 'Echoes', 'Wolves', 'Signals', 'Gardens', 'Owls', 'Mirrors', 'Sparks', 'Postcards', 'Comets'];
const PLACE = ['Harbour', 'Northern', 'Riverside', 'Hillside', 'Moorland', 'Coastal', 'Valley', 'Eastside', 'Highfield', 'Lakeside', 'Castle', 'Meadow', 'Brookfield', 'Westgate', 'Parkside'];
const ANIMAL = ['Hawks', 'Badgers', 'Otters', 'Stags', 'Falcons', 'Hounds', 'Bears', 'Rams', 'Herons', 'Lions', 'Ravens', 'Wasps', 'Stoats', 'Magpies', 'Swifts'];
const PET = ['Biscuit', 'Pickle', 'Noodle', 'Waffles', 'Mochi', 'Pepper', 'Ziggy', 'Bramble', 'Nugget', 'Poppy', 'Maple', 'Tofu', 'Fudge', 'Juniper', 'Pixel', 'Marmite', 'Olive', 'Cosmo', 'Basil', 'Sprout', 'Truffle', 'Gizmo', 'Custard', 'Clover'];
const SIR = ['Sir', 'Lady', 'Captain', 'Doctor', 'Professor', 'Duke', 'Baroness', 'Major'];
const THEMES: [RegExp, string[]][] = [
  [/space|star|moon|rocket|galaxy|cosmic/, ['Orbit', 'Nebula', 'Comet', 'Lunar', 'Rocket', 'Stardust']],
  [/sea|ocean|boat|sail|harbour|beach|wave/, ['Tide', 'Anchor', 'Mariner', 'Salt', 'Driftwood', 'Lighthouse']],
  [/garden|plant|flower|tree|forest|green/, ['Bramble', 'Willow', 'Fern', 'Thistle', 'Bloom', 'Acorn']],
  [/food|cook|pizza|cake|tea|coffee|bake/, ['Crumble', 'Toast', 'Sprinkle', 'Biscuit', 'Pepper', 'Marmalade']],
  [/city|street|night|neon|urban|town/, ['Alley', 'Subway', 'Skyline', 'Traffic', 'Lamplight', 'Rooftop']],
  [/dark|goth|storm|shadow|ghost/, ['Raven', 'Ember', 'Hollow', 'Shade', 'Thorn', 'Eclipse']],
];
const BLOCK = /\b(?:ass|sex|nazi|rape|kill|slut|damn|hell|porn|nude|drug|dick|cock|piss|shit|fuck|cunt|bitch)/i;
export type NameKind = 'band' | 'pet' | 'team';
/** Ten names for a band, a pet or a team, from word banks and any theme he gave; a starting letter if he wants one. The same words and seed give the same ten. */
export function nameIdeas(kind: NameKind, words: string, seed = 0): string[] {
  const r = rng(hashSeed(`${kind}:${words.toLowerCase()}:${seed}`));
  const theme = THEMES.find(([re]) => re.test(words.toLowerCase()))?.[1] ?? [];
  const letter = /\b(?:starting|starts?|beginning|begins?) with (?:an? |the letter )?([a-z])\b/i.exec(words)?.[1]?.toUpperCase();
  const out = new Set<string>();
  const nouns = [...theme, ...NOUN];
  for (let tries = 0; out.size < 10 && tries < 400; tries++) {
    let n: string;
    if (kind === 'band') {
      const form = Math.floor(r() * 6);
      const a = pick(r, ADJ);
      const b = theme.length && r() < 0.5 ? pick(r, theme) : pick(r, nouns);
      n = form === 0 ? `The ${a} ${b.endsWith('s') ? b : `${b}s`}` : form === 1 ? `${a} ${b}` : form === 2 ? `${pick(r, PLACE)} ${b}` : form === 3 ? `The ${b.endsWith('s') ? b : `${b}s`} of ${pick(r, PLACE)}` : form === 4 ? `${a} & ${pick(r, ADJ)}` : `${b} Parade`;
    } else if (kind === 'pet') {
      const base = theme.length && r() < 0.4 ? pick(r, theme) : pick(r, PET);
      n = r() < 0.2 ? `${pick(r, SIR)} ${base}` : r() < 0.15 ? `${base} ${pick(r, ['Jr', 'the Great', 'McFluff', 'Bean'])}` : base;
    } else {
      const form = Math.floor(r() * 4);
      const place = pick(r, PLACE);
      n = form === 0 ? `${place} ${pick(r, ANIMAL)}` : form === 1 ? `${place} ${pick(r, ['United', 'Rovers', 'Athletic', 'Town', 'Wanderers'])}` : form === 2 ? `${pick(r, ADJ)} ${pick(r, ANIMAL)}` : `${pick(r, ADJ)} ${pick(r, ANIMAL)} FC`;
    }
    if (BLOCK.test(n) || (letter && !n.replace(/^The /, '').toUpperCase().startsWith(letter))) continue;
    out.add(n);
  }
  return [...out];
}

// ---------------------------------------------------------------- rhymes

/** A real public list: Datamuse's rhymes for a word (https://api.datamuse.com/words?rel_rhy=…), no key. */
export const rhymeUrl = (word: string): string => `https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(word.toLowerCase())}&max=60`;
/** Datamuse's answer grouped by syllables, the best-scored first; phrases and the word itself left out. */
export function rhymesFrom(json: unknown, word: string): { sy: number; words: string[] }[] {
  const list = Array.isArray(json) ? (json as { word?: unknown; score?: unknown; numSyllables?: unknown }[]) : [];
  const by = new Map<number, string[]>();
  for (const x of list.filter((y) => typeof y.word === 'string' && /^[a-z'-]+$/i.test(y.word as string) && (y.word as string).toLowerCase() !== word.toLowerCase())) {
    const sy = Number(x.numSyllables) || syllables(x.word as string);
    by.set(sy, [...(by.get(sy) ?? []), x.word as string]);
  }
  return [...by].sort((a, b) => a[0] - b[0]).map(([sy, words]) => ({ sy, words: words.slice(0, 10) }));
}
/** When the list does not answer: families of words that end alike. Small on purpose, and said to be. */
const FAMILIES = 'ight:light night right bright sight flight tight fight might white quite|ove:love above dove glove shove|ay:day say way play stay away today gray may pay stray|ee:see me be free tree key sea three agree|ine:line mine fine shine wine sign nine divine design|ear:near dear fear clear year here hear cheer|ain:rain train pain again main brain chain plain|and:hand land band stand sand grand|eart:heart start part art smart chart|ound:sound ground found round around bound|ow:know show go slow grow flow glow below|eam:dream team beam stream seem cream|ing:sing ring thing spring bring wing king|ime:time rhyme climb prime|ack:back track black pack crack|all:call all fall wall tall small ball|un:sun run fun done one none|one:bone phone alone stone tone zone|oon:moon soon tune June afternoon|ake:make take wake break shake lake|ate:late great wait fate gate date|old:gold cold hold told bold old|ore:more door floor before shore store core|eed:need speed feed read seed|ide:side wide ride hide pride guide inside|ose:rose close those nose goes|ame:name game same flame came frame|ife:life wife knife strife|ull:full pull wool|ast:fast past last cast vast|est:best rest test west chest guest|ill:still will hill fill until chill|ew:you new blue true through too view|ove2:move prove groove';
export function offlineRhymes(word: string): string[] {
  const w = word.toLowerCase().trim();
  const fams = FAMILIES.split('|').map((f) => f.split(':')[1]!.split(' '));
  const fam = fams.find((f) => f.includes(w)) ?? fams.find((f) => f.some((x) => x.length > 2 && w.length > 2 && x.slice(-3) === w.slice(-3)));
  return fam ? fam.filter((x) => x !== w) : [];
}

// ---------------------------------------------------------------- a drawing prompt a day

const SUBJECT = ['a lighthouse', 'a robot learning to cook', 'your breakfast', 'a very tall giraffe', 'a train station at 3am', 'a tiny dragon', 'your favourite mug', 'a cat on a motorbike', 'a snowy bus stop', 'a garden gnome with a secret', 'an octopus at the gym', 'the moon doing the washing-up', 'a castle on a hill', 'a hot air balloon over your street', 'a friendly ghost', 'a pirate on holiday', 'a forgotten umbrella', 'a market stall', 'a bear in a raincoat', 'the view from your window', 'a paper boat', 'a spaceship made of old furniture', 'a sleepy owl', 'your hands', 'a haunted chip shop', 'a dog who thinks he is a king', 'a tree with a door', 'a snail in a hurry', 'a bridge at sunset', 'a robot walking a robot dog'];
const TWIST = ['in the style of a children’s book', 'as a comic strip of three panels', 'upside down', 'in only two colours', 'in the rain', 'as a map', 'from above, like a bird would see it', 'as a postage stamp', 'in the dark with one light', 'tiny, in the corner of the page', 'as a poster for a film that does not exist', 'in a hundred years’ time', 'made of shapes only', 'as a sticker', 'with everything slightly too big'];
const LIMIT = ['Use only circles and lines.', 'Five minutes, no more.', 'Draw without lifting the pen.', 'Use your other hand.', 'No outlines: shapes of colour only.', 'Only three colours.', 'Keep your eyes on the subject, not the page.', 'Fill the whole page.', 'Leave out the most obvious thing.', 'Add one thing that does not belong.'];
/** Today's prompt: the same all day for everyone, a different one tomorrow; `nth` for another today. Ours, never copied from anyone. */
export function drawingPrompt(day: string, nth = 0): string {
  const r = rng(hashSeed(`${day}:${nth}`));
  return cap(`${pick(r, SUBJECT)} ${pick(r, TWIST)}. ${pick(r, LIMIT)}`);
}

// ---------------------------------------------------------------- the seed of a story, the rules of a poem

const HERO = ['a retired lighthouse keeper', 'a night-bus driver', 'a girl who repairs clocks', 'a boy with a borrowed dog', 'a baker who cannot sleep', 'an old woman and her stubborn goat', 'a trainee astronaut afraid of heights', 'two cousins and a map', 'a shy magician', 'a postman on his last day'];
const PLACE2 = ['a seaside town in winter', 'a train that never stops', 'a market after closing', 'a village with one road', 'a flooded library', 'a roof above the city', 'an island with no name', 'a school after dark', 'a canal boat in fog', 'a hill with a standing stone'];
const WANT = ['to find something that was lost', 'to keep a promise', 'to get home before dawn', 'to finish one last job', 'to say sorry', 'to win a small, important race', 'to hide a secret', 'to prove everyone wrong'];
const BLOCKER = ['a storm that will not move', 'someone who knows the secret', 'a rule nobody can explain', 'a broken bridge', 'a letter that arrives too late', 'their own pride', 'a door that only opens once'];
const TURN = ['the thing they were looking for was with them all along', 'the villain is only frightened', 'the help comes from the last person they expected', 'it was a gift, not a loss', 'the map was upside down', 'nobody was ever chasing them'];
const ENDING = ['warm and a little sad', 'quietly funny', 'hopeful, with one question left open', 'a clean happy ending', 'bittersweet'];
export interface StorySeed {
  hero: string;
  place: string;
  want: string;
  blocker: string;
  turn: string;
  ending: string;
  words: number;
}
/** A story's bones from a seed and a length (flash 150, short 400, long 900 words): the same call, the same bones; he can ask for another. */
export function storySeed(words: string, variant = 0): StorySeed {
  const r = rng(hashSeed(`${words.toLowerCase()}:${variant}`));
  const len = /\b(flash|tiny|very short)\b/i.test(words) ? 150 : /\b(long|chapter)\b/i.test(words) ? 900 : 400;
  return { hero: pick(r, HERO), place: pick(r, PLACE2), want: pick(r, WANT), blocker: pick(r, BLOCKER), turn: pick(r, TURN), ending: pick(r, ENDING), words: len };
}
export const POEM_FORMS: Record<string, string> = {
  haiku: 'Three lines of 5, 7 and 5 syllables; one image, no rhyme needed.',
  limerick: 'Five lines rhyming AABBA; lines 1, 2 and 5 are longer (about 8 syllables), 3 and 4 shorter (about 5); a funny turn at the end.',
  sonnet: 'Fourteen lines of about 10 syllables, rhyming ABAB CDCD EFEF GG; the last two lines turn the thought.',
  couplets: 'Pairs of lines that rhyme (AA BB CC), each line about the same length.',
  ode: 'A warm address to one thing, in lines of any length; praise it from three sides, then say what it taught you.',
  acrostic: 'The first letter of each line spells a word, down the page; each line is its own small thought.',
  free: 'No rhyme or count: short lines, one clear image per line, an ending that lands.',
};
export const poemForm = (words: string): keyof typeof POEM_FORMS => (Object.keys(POEM_FORMS).find((f) => new RegExp(`\\b${f}\\b`, 'i').test(words)) ?? (/\b(funny|silly|joke)\b/i.test(words) ? 'limerick' : 'free')) as keyof typeof POEM_FORMS;
const tail = (w: string) => {
  const x = w.toLowerCase().replace(/[^a-z]/g, '');
  const m = /[aeiouy]+[^aeiouy]*(?:e)?$/.exec(x);
  return m ? m[0].replace(/e$/, '') : x.slice(-2);
};
/** Does his poem keep its form? Haiku syllables, a limerick's rhymes, couplets, an acrostic's word — what is wrong, in plain words (none: fine). */
export function checkPoem(form: string, poem: string, word = ''): string[] {
  const lines = poem.split('\n').map((l) => l.trim()).filter(Boolean);
  const last = (l: string) => (l.match(/[\p{L}']+/gu) ?? []).pop() ?? '';
  const sy = (l: string) => (l.match(/[\p{L}']+/gu) ?? []).reduce((k, w) => k + syllables(w), 0);
  const rhymes = (a: string, b: string) => !!a && !!b && tail(last(a)) === tail(last(b)) && last(a).toLowerCase() !== last(b).toLowerCase();
  const out: string[] = [];
  if (form === 'haiku') {
    if (lines.length !== 3) out.push(`a haiku has 3 lines (you have ${lines.length})`);
    ([5, 7, 5] as const).forEach((n, i) => lines[i] && sy(lines[i]!) !== n && out.push(`line ${i + 1} has about ${sy(lines[i]!)} syllables, not ${n}`));
  } else if (form === 'limerick') {
    if (lines.length !== 5) out.push(`a limerick has 5 lines (you have ${lines.length})`);
    else {
      if (!(rhymes(lines[0]!, lines[1]!) && rhymes(lines[1]!, lines[4]!))) out.push('lines 1, 2 and 5 should rhyme');
      if (!rhymes(lines[2]!, lines[3]!)) out.push('lines 3 and 4 should rhyme with each other');
    }
  } else if (form === 'couplets') {
    if (lines.length % 2) out.push('couplets come in pairs: you have an odd line out');
    for (let i = 0; i + 1 < lines.length; i += 2) if (!rhymes(lines[i]!, lines[i + 1]!)) out.push(`lines ${i + 1} and ${i + 2} don’t rhyme`);
  } else if (form === 'sonnet') {
    if (lines.length !== 14) out.push(`a sonnet has 14 lines (you have ${lines.length})`);
    lines.forEach((l, i) => Math.abs(sy(l) - 10) > 2 && out.push(`line ${i + 1} has about ${sy(l)} syllables (aim for 10)`));
  } else if (form === 'acrostic' && word) {
    const need = word.toUpperCase().replace(/[^A-Z]/g, '');
    if (lines.length !== need.length) out.push(`${need} needs ${need.length} lines (you have ${lines.length})`);
    lines.forEach((l, i) => need[i] && l.charAt(0).toUpperCase() !== need[i] && out.push(`line ${i + 1} should start with ${need[i]}`));
  }
  return out.slice(0, 6);
}
/** The scaffold of an acrostic: one letter a line. */
export const acrostic = (word: string): string => [...word.toUpperCase().replace(/[^A-Z]/g, '')].map((c) => `${c} …`).join('\n');
