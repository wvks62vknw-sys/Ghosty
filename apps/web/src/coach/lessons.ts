/**
 * LESSONS OF OUR OWN (BRIEF-REST-B part 2): a first ten each for guitar, piano and voice, written here and nowhere else — no
 * file of anyone's music, no tune that belongs to someone. Chords are taught as the notes of the chord one at a time (a
 * microphone cannot tell you whether a chord rang true, but it can hear each note come in the right order and on the click).
 * A lesson is one of three kinds:
 *  - NOTES: one note on each click of a metronome (after a four-click count-in); the mic hears whether the right notes came in,
 *    in order, and whether each was on the click;
 *  - STRUM: a pattern of hits on the eighth notes; the mic hears each hit and whether it was on the beat — NOT whether it was
 *    down or up, or which strings (it cannot);
 *  - HOLD: one steady note for some seconds (voice): the pitch must stay inside a few cents.
 * Scoring is pure (the node tests give it recordings made in code): `scoreLesson(lesson, samples, sampleRate)`.
 */
import { detectOnsets, trackNotes, type NoteEvent } from './onset';
import { hzOfName, midiFromName, nameOfMidi } from './notes';

export type Teach = 'guitar' | 'piano' | 'voice';
export type Kind = 'notes' | 'strum' | 'hold';

export interface Lesson {
  id: string;
  instrument: Teach;
  /** 1–10, its place in the first ten. */
  n: number;
  title: string;
  /** What you are learning, in a sentence. */
  goal: string;
  /** What to do, in plain steps. */
  how: string;
  kind: Kind;
  bpm: number;
  /** The score that passes (0–1). */
  pass: number;
  /** NOTES: one per beat after the count-in ('-' is a rest). */
  notes?: string[];
  /** Any octave will do (a voice is not a guitar). */
  anyOctave?: boolean;
  /** STRUM: the eighth notes of a bar, 'x' a hit and '.' a rest, played `bars` times. */
  pattern?: string;
  bars?: number;
  /** HOLD: the note (or any steady one), for how long, within how many cents. */
  hold?: { note?: string; secs: number; tol: number };
}

const COUNT_IN = 4;
export const countIn = COUNT_IN;

const L = (instrument: Teach, n: number, title: string, goal: string, how: string, rest: Partial<Lesson>): Lesson => ({ id: `${instrument}-${n}`, instrument, n, title, goal, how, kind: 'notes', bpm: 60, pass: 0.7, ...rest });
const notes = (s: string) => s.split(/\s+/);

export const LESSONS: Lesson[] = [
  // ---------------------------------------------------------------- GUITAR
  L('guitar', 1, 'Open strings, low to high', 'Know each open string by its sound.', 'Pluck each open string once on each click, thickest first, and let it ring: E, A, D, G, B, E.', { notes: notes('E2 A2 D3 G3 B3 E4') }),
  L('guitar', 2, 'Open strings, high to low', 'The same six strings, the other way.', 'Thinnest string first this time, one pluck on each click: E, B, G, D, A, E.', { notes: notes('E4 B3 G3 D3 A2 E2') }),
  L('guitar', 3, 'E minor, a string at a time', 'Your first chord, heard note by note.', 'Press the A string and the D string at the 2nd fret, one finger each. Pluck all six strings from the thickest to the thinnest, one on each click.', { notes: notes('E2 B2 E3 G3 B3 E4') }),
  L('guitar', 4, 'A minor, a string at a time', 'A second chord, a little sadder.', 'Press the D string at the 2nd fret, the G string at the 2nd fret and the B string at the 1st. Skip the thickest string and pluck the other five, one on each click.', { notes: notes('A2 E3 A3 C4 E4') }),
  L('guitar', 5, 'C major, a string at a time', 'A bright chord, the sunniest of the first three.', 'Press the A string at the 3rd fret, the D string at the 2nd and the B string at the 1st. Pluck the five thinnest strings, one on each click (the G and the top E ring open).', { notes: notes('C3 E3 G3 C4 E4') }),
  L('guitar', 6, 'G major, a string at a time', 'A chord that rings on all six strings.', 'Press the thickest string at the 3rd fret, the A string at the 2nd and the thinnest at the 3rd. Pluck all six, one on each click.', { notes: notes('G2 B2 D3 G3 B3 G4') }),
  L('guitar', 7, 'Your first strum', 'Hit on the beat, and between beats.', 'Hold a loose E minor and strum with the click: down, a gap, down, up, a gap, up, down, up. Eight little steps in each bar. (I can hear that you hit and whether it was on time; I cannot tell down from up.)', { kind: 'strum', pattern: 'x.xx.xxx', bars: 2, bpm: 70 }),
  L('guitar', 8, 'A minor pentatonic scale', 'The notes most riffs are made from.', 'Start on the thickest string at the 5th fret and climb: thickest 5th and 8th fret, A string 5th and 7th, D string 5th and 7th. One note on each click.', { notes: notes('A2 C3 D3 E3 G3 A3') }),
  L('guitar', 9, 'The Ghost riff (ours)', 'A riff you can play over and over.', 'On the thickest string: open, open, 3rd fret, open, then the A string open, the thickest 3rd fret, open, and a rest. One on each click.', { notes: notes('E2 E2 G2 E2 A2 G2 E2 -'), bpm: 70 }),
  L('guitar', 10, 'The roots of a tune of ours', 'Four chords and what holds them together.', 'Play only the bass note of each chord, one on each click: E minor, C, G, D, and round again.', { notes: notes('E3 C3 G2 D3 E3 C3 G2 D3'), bpm: 60 }),
  // ---------------------------------------------------------------- PIANO / KEYBOARD
  L('piano', 1, 'Middle C and its neighbours', 'Find middle C and the two keys next to it.', 'Middle C is the white key just left of the pair of black keys nearest the middle. Play C, D, E, D, C, one on each click.', { notes: notes('C4 D4 E4 D4 C4') }),
  L('piano', 2, 'Five fingers, up and down', 'One finger on each of five white keys.', 'Thumb on middle C, one finger on each key to G, then back down. One note on each click.', { notes: notes('C4 D4 E4 F4 G4 F4 E4 D4 C4') }),
  L('piano', 3, 'The C major scale, up', 'The scale that every other is measured against.', 'All the white keys from middle C to the next C: tuck your thumb under after the third finger. One note on each click.', { notes: notes('C4 D4 E4 F4 G4 A4 B4 C5') }),
  L('piano', 4, 'The C major scale, up and down', 'The same scale there and back.', 'Up the white keys to the top C and straight back down. One note on each click.', { notes: notes('C4 D4 E4 F4 G4 A4 B4 C5 B4 A4 G4 F4 E4 D4 C4'), bpm: 66 }),
  L('piano', 5, 'Left hand: root and fifth', 'A steady bass line for your left hand.', 'With your left hand, alternate C and the G above it, one on each click, with a rest to finish.', { notes: notes('C3 G3 C3 G3 C3 G3 C3 -') }),
  L('piano', 6, 'A C chord, one note at a time', 'A chord and its shape.', 'Play the notes of C major — C, E, G, the high C — and back down, one on each click.', { notes: notes('C4 E4 G4 C5 G4 E4 C4') }),
  L('piano', 7, 'Three chords, one note at a time', 'C, then F, then G.', 'Climb through the notes of C major, then F major, then G major, one on each click.', { notes: notes('C4 E4 G4 F4 A4 C5 G4 B4 D5'), bpm: 66 }),
  L('piano', 8, 'A minor scale, up', 'The sadder cousin of the C scale.', 'From the A below middle C, up the white keys to the next A, one on each click.', { notes: notes('A3 B3 C4 D4 E4 F4 G4 A4') }),
  L('piano', 9, 'A little tune of ours', 'Your first tune: eight notes.', 'E, E, G, E, D, C, D, and a rest. Keep it steady; one note on each click.', { notes: notes('E4 E4 G4 E4 D4 C4 D4 -'), bpm: 66 }),
  L('piano', 10, 'Both hands, one after the other', 'A bass note and a chord round it.', 'Left hand C, then the right hand through C major and back; then left hand G and the right hand through G major and back.', { notes: notes('C3 E4 G4 C5 G4 E4 G3 D4 G4 B4 G4 D4'), bpm: 66 }),
  // ---------------------------------------------------------------- VOICE
  L('voice', 1, 'Find a note you can hold', 'A steady voice is the start of everything.', 'Breathe in low, and sing one comfortable note — any note — for three seconds, as steady as you can.', { kind: 'hold', hold: { secs: 3, tol: 40 }, pass: 1 }),
  L('voice', 2, 'Match a C', 'Hear a note and sing it back.', 'Play a C on any keyboard or app (any C will do), then sing it and hold it for three seconds.', { kind: 'hold', hold: { note: 'C4', secs: 3, tol: 40 }, anyOctave: true, pass: 1 }),
  L('voice', 3, 'Do, re, mi', 'Three notes, up and back.', 'Sing C, D, E, D, C, one on each click, on “la”. Any octave that is comfortable.', { notes: notes('C4 D4 E4 D4 C4'), anyOctave: true }),
  L('voice', 4, 'Five notes up and down', 'A little more range.', 'Sing C, D, E, F, G and back, one on each click.', { notes: notes('C4 D4 E4 F4 G4 F4 E4 D4 C4'), anyOctave: true }),
  L('voice', 5, 'The scale, up', 'The whole scale in one breath.', 'Sing C, D, E, F, G, A, B, C, one on each click.', { notes: notes('C4 D4 E4 F4 G4 A4 B4 C5'), anyOctave: true }),
  L('voice', 6, 'Hold a G steady', 'Pitch you can trust.', 'Play a G on any keyboard or app, then sing it and hold it for four seconds, inside thirty cents.', { kind: 'hold', hold: { note: 'G4', secs: 4, tol: 30 }, anyOctave: true, pass: 1 }),
  L('voice', 7, 'A fifth apart', 'Jump between two notes.', 'Sing C, G, C, G, C, one on each click: a jump up and a jump down.', { notes: notes('C4 G4 C4 G4 C4'), anyOctave: true }),
  L('voice', 8, 'The scale, down', 'Coming down as well as going up.', 'Sing C, B, A, G, F, E, D, C, one on each click, coming down.', { notes: notes('C5 B4 A4 G4 F4 E4 D4 C4'), anyOctave: true }),
  L('voice', 9, 'A melody of ours', 'Seven notes that sound like something.', 'Sing E, G, A, G, E, D, E, and a rest, one on each click.', { notes: notes('E4 G4 A4 G4 E4 D4 E4 -'), anyOctave: true, bpm: 66 }),
  L('voice', 10, 'One long steady breath', 'Breath is the instrument.', 'Sing any comfortable note and hold it for eight seconds, as steady as you can.', { kind: 'hold', hold: { secs: 8, tol: 50 }, pass: 1 }),
];

export const lessonsFor = (i: Teach): Lesson[] => LESSONS.filter((l) => l.instrument === i);
export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id);
export const TEACH: { id: Teach; label: string }[] = [
  { id: 'guitar', label: 'Guitar' },
  { id: 'piano', label: 'Piano' },
  { id: 'voice', label: 'Voice' },
];

/** How long a lesson's recording runs, in seconds: the count-in, the lesson, and a beat of ring after it. */
export function lessonSecs(l: Lesson): number {
  const beat = 60 / l.bpm;
  if (l.kind === 'hold') return 1.5 + l.hold!.secs + 1.5;
  if (l.kind === 'strum') return (COUNT_IN + l.bars! * 4 + 1) * beat;
  return (COUNT_IN + l.notes!.length + 1) * beat;
}

// ---------------------------------------------------------------------------------------------------------------- scoring

export type StepState = 'right' | 'early' | 'late' | 'wrong' | 'missed';
export interface Step {
  /** What was wanted: a note ("E2"), or "hit 3". */
  want: string;
  state: StepState;
  /** What was heard instead (a wrong note). */
  heard?: string;
  /** How far from the click (ms; + late), once any steady lag is taken out. */
  ms?: number;
}
export interface Result {
  steps: Step[];
  /** 0–1. */
  score: number;
  passed: boolean;
  /** The steady lag between the click and the playing (ms), taken out of the timing. */
  lagMs: number;
  /** Plain words for each thing to fix, and the summary. */
  words: string[];
  summary: string;
}

/** What was heard in a recording. */
export interface Heard {
  onsets: number[];
  notes: NoteEvent[];
}
export const hear = (samples: ArrayLike<number>, sampleRate: number, opts: { minHz?: number; maxHz?: number } = {}): Heard => ({
  onsets: detectOnsets(samples, sampleRate),
  notes: trackNotes(samples, sampleRate, { minHz: opts.minHz ?? 60, maxHz: opts.maxHz ?? 1200 }),
});

const median = (a: number[]) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)]!;
};
const pct = (x: number) => `${Math.round(x * 100)}%`;
const same = (a: number, b: number, any: boolean) => (any ? ((a - b) % 12 + 12) % 12 === 0 : a === b);

/** The time a note began, snapped to the onset of the sound it belongs to when there is one close by. */
function startOf(n: NoteEvent, onsets: number[]): number {
  let best = n.t;
  let d = 0.14;
  for (const o of onsets) if (Math.abs(o - n.t) < d) ((d = Math.abs(o - n.t)), (best = o));
  return best;
}

/** NOTES: the right notes, in order, each on its click. */
export function scoreNotes(l: Lesson, heard: Heard): Result {
  const beat = 60 / l.bpm;
  const want = l.notes!;
  const any = !!l.anyOctave;
  const ev = heard.notes.map((n) => ({ n, t: startOf(n, heard.onsets) })).filter((e) => e.t > (COUNT_IN - 0.5) * beat);
  const steps: Step[] = [];
  const offs: { i: number; off: number }[] = [];
  let from = 0;
  want.forEach((w, i) => {
    if (w === '-') return;
    const midi = midiFromName(w)!;
    const at = (COUNT_IN + i) * beat;
    // the first note, not yet used, near the click: the right one if it is there
    const near = ev.slice(from).map((e, k) => ({ e, k: k + from })).filter((x) => Math.abs(x.e.t - at) <= 0.75 * beat + 0.15);
    const hit = near.find((x) => same(x.e.n.midi, midi, any));
    if (hit) {
      from = hit.k + 1;
      offs.push({ i, off: hit.e.t - at });
      steps.push({ want: w, state: 'right' });
    } else if (near.length) steps.push({ want: w, state: 'wrong', heard: nameOfMidi(near[0]!.e.n.midi) });
    else steps.push({ want: w, state: 'missed' });
  });
  // the steady lag (the phone's own delay, and how you feel the click) comes out of the timing
  const lag = median(offs.map((o) => o.off));
  const tol = Math.max(0.12, 0.25 * beat);
  let k = 0;
  for (const s of steps) {
    if (s.state !== 'right') continue;
    const o = offs[k++]!;
    const ms = Math.round((o.off - lag) * 1000);
    s.ms = ms;
    if (Math.abs(o.off - lag) > tol) s.state = o.off - lag > 0 ? 'late' : 'early';
  }
  const total = steps.length;
  const got = steps.reduce((t, s) => t + (s.state === 'right' ? 1 : s.state === 'early' || s.state === 'late' ? 0.6 : 0), 0);
  const score = total ? got / total : 0;
  const words = steps.flatMap((s, i) => (s.state === 'right' ? [] : [stepWords(s, i + 1)]));
  const right = steps.filter((s) => s.state === 'right').length;
  const inOrder = steps.filter((s) => s.state !== 'wrong' && s.state !== 'missed').length;
  return finish(l, steps, score, Math.round(lag * 1000), words, `${right} of ${total} notes right and on the click; ${inOrder} of ${total} heard in order.`);
}

const stepWords = (s: Step, n: number): string =>
  s.state === 'wrong' ? `Note ${n} (${s.want}): I heard ${s.heard} instead.` : s.state === 'missed' ? `Note ${n} (${s.want}): I did not hear it — pluck it clearly, near its click.` : `Note ${n} (${s.want}): ${s.state === 'late' ? 'late' : 'early'} by about ${Math.abs(s.ms ?? 0)} ms.`;

/** STRUM: each hit of the pattern, near its beat. */
export function scoreStrum(l: Lesson, heard: Heard): Result {
  const beat = 60 / l.bpm;
  const slots: number[] = [];
  for (let b = 0; b < l.bars!; b++) for (let s = 0; s < 8; s++) if (l.pattern![s] === 'x') slots.push((COUNT_IN + b * 4 + s / 2) * beat);
  const tol = Math.max(0.09, 0.2 * beat);
  const ons = heard.onsets.filter((o) => o > (COUNT_IN - 0.5) * beat);
  // a first pass finds the steady lag, a second judges the timing without it
  const first = slots.map((t) => ons.map((o) => o - t).sort((a, b) => Math.abs(a) - Math.abs(b))[0]).filter((d): d is number => d !== undefined && Math.abs(d) < 0.3 * beat + 0.1);
  const lag = median(first);
  const used = new Set<number>();
  const steps: Step[] = slots.map((t, i) => {
    let best = -1;
    let bd = tol;
    ons.forEach((o, k) => {
      const d = Math.abs(o - lag - t);
      if (!used.has(k) && d <= bd) ((bd = d), (best = k));
    });
    if (best < 0) return { want: `hit ${i + 1}`, state: 'missed' as const };
    used.add(best);
    return { want: `hit ${i + 1}`, state: 'right' as const, ms: Math.round((ons[best]! - lag - t) * 1000) };
  });
  const extra = ons.length - used.size;
  const hits = steps.filter((s) => s.state === 'right').length;
  const score = Math.max(0, Math.min(1, (hits - 0.5 * extra) / Math.max(1, slots.length)));
  const words = [...steps.flatMap((s) => (s.state === 'missed' ? [`${s.want}: I did not hear a strum there.`] : [])), ...(extra > 0 ? [`${extra} extra strum${extra === 1 ? '' : 's'} I was not expecting.`] : [])];
  return finish(l, steps, score, Math.round(lag * 1000), words, `${hits} of ${slots.length} strums on the beat${extra > 0 ? `, ${extra} extra` : ''}.`);
}

/** HOLD: one steady note for the time asked. */
export function scoreHold(l: Lesson, heard: Heard): Result {
  const h = l.hold!;
  const target = h.note ? midiFromName(h.note)! : null;
  const best = [...heard.notes].sort((a, b) => b.dur - a.dur)[0];
  const words: string[] = [];
  let state: StepState = 'missed';
  if (!best) words.push('I did not hear a steady note. Sing a little louder, closer to the phone.');
  else {
    const long = best.dur >= h.secs * 0.85;
    const steady = best.spread <= h.tol * 2;
    const onNote = target == null || (l.anyOctave ? Math.abs((((best.midi * 100 + best.cents) - target * 100 + 600) % 1200 + 1200) % 1200 - 600) <= h.tol : Math.abs(best.midi * 100 + best.cents - target * 100) <= h.tol);
    if (!long) words.push(`You held it for ${best.dur.toFixed(1)} seconds; ${h.secs} were asked. Breathe in lower and let it go on.`);
    if (!steady) words.push(`The pitch wandered by about ${Math.round(best.spread)} cents; keep it inside ${h.tol * 2}.`);
    if (!onNote) words.push(`That was ${nameOfMidi(best.midi)}${best.cents ? ` (${best.cents > 0 ? '+' : ''}${Math.round(best.cents)} cents)` : ''}, not ${h.note}.`);
    state = long && steady && onNote ? 'right' : 'wrong';
  }
  const steps: Step[] = [{ want: h.note ?? 'a steady note', state, ...(best ? { heard: nameOfMidi(best.midi) } : {}) }];
  return finish(l, steps, state === 'right' ? 1 : 0, 0, words, state === 'right' ? `A steady ${best ? nameOfMidi(best.midi) : 'note'} for ${best?.dur.toFixed(1)} seconds.` : 'Not steady enough yet.');
}

function finish(l: Lesson, steps: Step[], score: number, lagMs: number, words: string[], head: string): Result {
  const passed = score >= l.pass;
  const lag = Math.abs(lagMs) > 250 ? [`You were playing about ${Math.abs(lagMs)} ms ${lagMs > 0 ? 'behind' : 'ahead of'} the click all the way through: listen to it and let it lead.`] : [];
  return { steps, score, passed, lagMs, words: [...lag, ...words], summary: `${head} ${pct(score)}. ${passed ? 'Passed.' : 'Not yet: the same lesson again, a little slower, is the way.'}` };
}

/** Score a lesson's recording: the mic's samples, taken from the first click of the count-in. */
export function scoreLesson(l: Lesson, samples: ArrayLike<number>, sampleRate: number): Result {
  const rng = l.instrument === 'voice' ? { minHz: 70, maxHz: 1100 } : l.instrument === 'guitar' ? { minHz: 70, maxHz: 700 } : { minHz: 100, maxHz: 1200 };
  const heard = hear(samples, sampleRate, rng);
  return l.kind === 'strum' ? scoreStrum(l, heard) : l.kind === 'hold' ? scoreHold(l, heard) : scoreNotes(l, heard);
}

/** The note names a lesson asks for, for the chips on the screen (a rest is shown as a dot). */
export const stepsOf = (l: Lesson): string[] => (l.kind === 'notes' ? l.notes!.map((n) => (n === '-' ? '·' : n)) : l.kind === 'strum' ? Array.from({ length: l.bars! * 8 }, (_, i) => (l.pattern![i % 8] === 'x' ? '↓' : '·')) : [l.hold!.note ?? 'any']);

/** A lesson's note frequencies, for the specs and the "listen" button: the first note's pitch. */
export const firstHz = (l: Lesson): number | null => {
  const n = l.notes?.find((x) => x !== '-') ?? l.hold?.note;
  return n ? hzOfName(n) : null;
};
