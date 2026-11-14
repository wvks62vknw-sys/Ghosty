/**
 * REHEARSE's working (BRIEF-OCT-IDEAS-3 item 7; STARS 168): the words and the counting, pure.
 *
 *  - the PROMPT for the other side: the situation in his words, the round, the talk so far, and how hard the other side plays it (the
 *    Character setting's HOW FIERY dial); the brain answers as the other person and stays in it (the screen sends it quietly: no
 *    chat history, no screen or place goes with it, nothing of it is kept on the brain);
 *  - NOTES after three rounds, five lines, counted in code from his own answers: what landed, what to tighten;
 *  - a TALK for a minute: his filler words, his pace and the one line to cut, from what the phone heard (or what he typed).
 * Nothing here is kept: the screen keeps a rehearsal only when he taps KEEP.
 */
import type { Dial } from '../../../../packages/shared/src/persona';

/** How hard the other side plays it, by the HOW FIERY dial. */
export const TEMPER: Record<Dial, string> = {
  0: 'mild: patient and fair, easy to talk to',
  1: 'firm: polite but not easily moved, asks for reasons',
  2: 'fiery: blunt and impatient, pushes back hard, but never cruel or personal',
};
export const TEMPER_WORD: Record<Dial, string> = { 0: 'mild', 1: 'firm', 2: 'fiery' };

export const ROUNDS = 3;

export const KEEP_KEY = 'ghosty.rehearsals';
/** At most this many rehearsals are kept (the oldest goes first). */
export const KEEP_MAX = 20;

/** A rehearsal he tapped KEEP on: the situation, his own answers and the notes (never the other side's lines). */
export interface Kept {
  at: number;
  situation: string;
  answers: string[];
  notes: string[];
}

/** Every kept rehearsal as written (oldest first); a damaged entry is left out, never shown half. */
export function loadKept(): Kept[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEEP_KEY) ?? '[]') as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (k): k is Kept =>
        !!k && typeof k === 'object' && typeof (k as Kept).at === 'number' && typeof (k as Kept).situation === 'string' && Array.isArray((k as Kept).answers) && Array.isArray((k as Kept).notes),
    );
  } catch {
    return [];
  }
}

/** Write the kept list (the newest KEEP_MAX). Throws when the phone's storage is full or blocked. */
export function saveKept(all: Kept[]): Kept[] {
  const kept = all.slice(-KEEP_MAX);
  localStorage.setItem(KEEP_KEY, JSON.stringify(kept));
  return kept;
}

/** Drop the kept rehearsal made at `at`. Throws when the phone's storage is blocked. */
export function deleteKept(at: number): Kept[] {
  return saveKept(loadKept().filter((k) => k.at !== at));
}

/** How many rehearsals he tapped KEEP on (kept on this phone: `ghosty.rehearsals`). */
export function keptRehearsals(): number {
  return loadKept().length;
}

/** The words the brain is given to play the other side: one turn at a time (the talk so far is inside it, since nothing else goes). */
export function promptFor(situation: string, round: number, talk: { other: string; answer: string }[], fire: Dial, lang?: { code: string; name: string }): string {
  const said = talk.map((t) => `OTHER SIDE: ${t.other}\nHIM: ${t.answer}`).join('\n');
  // [learn.s2] speaking practice in another language: the other side speaks only that language, simply, so he can answer in it
  const foreign = lang && lang.code !== 'en' ? `Speak only ${lang.name}, simply and clearly, at a learner's level, in short everyday sentences; never switch to English.` : '';
  return [
    'You are playing the other person in a rehearsal, so the owner can practise a real conversation. Stay in character the whole time.',
    `The situation, in his words: ${situation.trim().slice(0, 300)}.`,
    `How you play it: ${TEMPER[fire]}.`,
    foreign,
    `This is round ${round} of ${ROUNDS}. ${round === 1 ? 'Open the conversation.' : 'Answer what he just said and push the conversation one step further.'}`,
    said ? `So far:\n${said}` : '',
    'Reply with only what the other person says: one or two plain sentences, in the first person, no stage directions, no advice, no coaching, no notes.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** The languages Rehearse can be practised in (learn.s2): English, and the ones the interpreter speaks that learners pick most. */
export const PRACTICE_LANGS = ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ar', 'zh', 'ja', 'hi'] as const;

/** After a practice in another language: the words the brain is given for gentle notes, in English. */
export function langNotesPrompt(lang: { code: string; name: string }, situation: string, talk: { other: string; answer: string }[]): string {
  return [
    `The owner practised a conversation in ${lang.name}: ${situation.trim().slice(0, 200)}. Here is what was said.`,
    talk.map((t) => `OTHER SIDE: ${t.other}\nHIM: ${t.answer}`).join('\n'),
    `Give gentle notes in English, as a kind language teacher would: first one line on what he made himself understood well, then at most three corrections, each as "You said: … → Say: … (why, in a few words)". If there is nothing to correct, say so. No more than four lines in all, one per line, no headings.`,
  ].join('\n\n');
}

/**
 * [learn.u12] HIS SPEAKING, CHARTED: each one-minute talk keeps only its numbers on this phone (when, words a minute, filler
 * words, length), never what was said, so the weeks can be compared.
 */
export const TALKS_KEY = 'ghosty.talks';
export const TALKS_MAX = 120;
export interface TalkMark { at: number; wpm: number; fillers: number; words: number; seconds: number }
export function loadTalks(): TalkMark[] {
  try {
    const v = JSON.parse(localStorage.getItem(TALKS_KEY) ?? '[]') as TalkMark[];
    return Array.isArray(v) ? v.filter((x) => Number.isFinite(x?.at) && Number.isFinite(x?.wpm)) : [];
  } catch {
    return [];
  }
}
export function addTalk(m: TalkMark): TalkMark[] {
  const all = [...loadTalks(), m].slice(-TALKS_MAX);
  try {
    localStorage.setItem(TALKS_KEY, JSON.stringify(all));
  } catch {
    /* storage full or blocked: the chart shows what it has */
  }
  return all;
}
/** The Monday that starts a talk's week, in London (the key a week is charted under). */
export function weekOf(at: number): string {
  const d = new Date(new Date(at).toLocaleString('en-US', { timeZone: 'Europe/London' }));
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** Week by week, oldest first: talks, the average words a minute and filler words a minute (the last eight weeks). */
export function talkWeeks(talks: TalkMark[]): { week: string; n: number; wpm: number; fpm: number }[] {
  const by = new Map<string, TalkMark[]>();
  for (const t of talks) by.set(weekOf(t.at), [...(by.get(weekOf(t.at)) ?? []), t]);
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-8).map(([week, ts]) => ({
    week,
    n: ts.length,
    wpm: Math.round(ts.reduce((a, t) => a + t.wpm, 0) / ts.length),
    fpm: Math.round((ts.reduce((a, t) => a + t.fillers, 0) / Math.max(1, ts.reduce((a, t) => a + t.seconds, 0) / 60)) * 10) / 10,
  }));
}
/** One line on the change since the first week charted (what happened, in his own numbers; never a forecast). */
export function talkTrend(weeks: { wpm: number; fpm: number }[]): string {
  if (weeks.length < 2) return weeks.length ? 'One week so far: talk again next week to see the change.' : 'No talks yet: CHECK IT on a talk and its numbers start the chart.';
  const a = weeks[0]!;
  const b = weeks.at(-1)!;
  const f = b.fpm < a.fpm ? `filler words down from ${a.fpm} to ${b.fpm} a minute` : b.fpm > a.fpm ? `filler words up from ${a.fpm} to ${b.fpm} a minute` : `filler words steady at ${b.fpm} a minute`;
  const inBand = (w: number) => w >= 110 && w <= 160;
  const p = inBand(b.wpm) ? `pace ${b.wpm} a minute, in the easy-to-follow band` : `pace ${b.wpm} a minute (easy to follow is 110 to 160)`;
  return `Since your first week: ${f}; ${p}.`;
}

/** The words he fills silence with (counted whole-word, lower case). */
export const FILLERS = ['um', 'uh', 'er', 'erm', 'like', 'you know', 'basically', 'actually', 'sort of', 'kind of', 'i mean', 'literally'];

/** Each filler found in `text` and how many times: only the ones there are, most first. */
export function fillersIn(text: string): { word: string; n: number }[] {
  const t = ` ${text.toLowerCase().replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ')} `;
  return FILLERS.map((w) => ({ word: w, n: t.split(` ${w} `).length - 1 }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
}
export const fillerTotal = (text: string): number => fillersIn(text).reduce((n, x) => n + x.n, 0);

/** Words in a text. */
export const wordCount = (t: string): number => (t.trim().match(/\S+/g) ?? []).length;
/** Sentences in a text, with their words. */
export const sentencesOf = (t: string): string[] => (t.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]*/g) ?? []).map((s) => s.trim()).filter(Boolean);

const quote = (t: string, n = 70) => `“${t.length > n ? `${t.slice(0, n).replace(/\s+\S*$/, '')}…` : t}”`;
const list = (xs: { word: string; n: number }[]) => xs.map((x) => `“${x.word}” ${x.n === 1 ? 'once' : `${x.n} times`}`).join(', ');

/** How concrete an answer is: numbers, names with capitals and longer words (a count, not a judgement of the person). */
const concrete = (a: string): number => (a.match(/\d+/g)?.length ?? 0) * 3 + (a.match(/(?<=[a-z,] )[A-Z][a-z]+/g)?.length ?? 0) * 2 + (a.match(/\b[a-z]{7,}\b/gi)?.length ?? 0);

/** NOTES after the rounds: exactly five lines, counted from his answers. Pure. */
export function notesOf(answers: string[]): string[] {
  const a = answers.map((x) => x.trim()).filter(Boolean);
  const out: string[] = [];
  if (!a.length) return ['I heard no answers, so there is nothing to note yet.', 'Say your answer in a sentence or two.', 'Open with the point.', 'Add one number or one example.', 'Then rehearse it again.'];
  // 1. what landed: the most concrete answer
  const best = a.map((x, i) => ({ i, c: concrete(x) })).sort((p, q) => q.c - p.c)[0]!;
  out.push(best.c > 0 ? `What landed: round ${best.i + 1}, the most concrete: ${quote(a[best.i]!)}.` : `What landed: you answered all ${a.length} round${a.length === 1 ? '' : 's'} without being asked twice.`);
  // 2. what landed: the steadiest length
  const w = a.map(wordCount);
  const spread = Math.max(...w) - Math.min(...w);
  out.push(a.length > 1 && spread <= Math.max(6, Math.min(...w))
    ? `What landed: your answers kept about the same length (${Math.min(...w) === Math.max(...w) ? `${w[0]} words each time` : `${Math.min(...w)} to ${Math.max(...w)} words`}), so you sounded steady.`
    : `What landed: you gave a full answer each time, ${w.join(', ')} words.`);
  // 3. what to tighten: the longest answer, and the line to cut
  const long = w.indexOf(Math.max(...w));
  const cut = sentencesOf(a[long]!).sort((p, q) => wordCount(q) - wordCount(p))[0] ?? '';
  out.push(w[long]! > 30 ? `Tighten: round ${long + 1} ran to ${w[long]} words; the line to cut is ${quote(cut)}.` : `Tighten: your longest answer is ${w[long]} words, which is short enough; the line I would sharpen first is ${quote(cut)}.`);
  // 4. filler words
  const f = fillersIn(a.join(' '));
  out.push(f.length ? `Tighten: you filled the silence with ${list(f.slice(0, 3))}; a pause says the same and sounds surer.` : 'Tighten: I counted no filler words in your answers.');
  // 5. how each began
  const soft = a.filter((x) => /^(?:i think|i guess|maybe|sorry|well|so|um|just)\b/i.test(x)).length;
  out.push(soft ? `Tighten: ${soft} of your ${a.length} answers began with a soft start (“I think”, “maybe”, “well”); open with the point instead.` : `Tighten: every answer opened with the point; keep that, and add one number or one example where you can.`);
  return out;
}

/** The pace a talk is said at, in plain words: 110 to 160 words a minute is how people speak to be followed. */
export function paceWords(wpm: number): string {
  if (wpm < 90) return 'slow: a little faster would hold them';
  if (wpm < 110) return 'a touch slow, but easy to follow';
  if (wpm <= 160) return 'a pace that is easy to follow';
  if (wpm <= 185) return 'quick: slow down a little at the important line';
  return 'very quick: they will lose you';
}

export interface TalkNotes {
  words: number;
  seconds: number;
  wpm: number;
  pace: string;
  fillers: { word: string; n: number }[];
  /** The one line to cut, or '' when every sentence earns its place. */
  cut: string;
  lines: string[];
}
/** A talk's notes: his filler words, pace and the one line to cut, from what was said and how long it took. Pure. */
export function talkNotes(transcript: string, seconds: number): TalkNotes {
  const words = wordCount(transcript);
  const secs = Math.max(1, Math.round(seconds));
  const wpm = Math.round((words / secs) * 60);
  const fillers = fillersIn(transcript);
  const ss = sentencesOf(transcript);
  const fillIn = (s: string) => fillerTotal(s);
  const longest = [...ss].sort((p, q) => wordCount(q) - wordCount(p))[0] ?? '';
  const busiest = [...ss].sort((p, q) => fillIn(q) - fillIn(p))[0] ?? '';
  const cut = longest && wordCount(longest) >= 25 ? longest : busiest && fillIn(busiest) >= 2 ? busiest : '';
  const lines = [
    `${words} words in ${secs} seconds: ${wpm} a minute, ${paceWords(wpm)}.`,
    fillers.length ? `Filler words: ${list(fillers.slice(0, 4))}.` : 'Filler words: none that I counted.',
    cut ? `The one line to cut: ${quote(cut, 110)}.` : 'The one line to cut: none, every sentence earns its place.',
  ];
  return { words, seconds: secs, wpm, pace: paceWords(wpm), fillers, cut, lines };
}
