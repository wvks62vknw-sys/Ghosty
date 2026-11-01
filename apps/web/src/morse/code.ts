/**
 * MORSE (BRIEF-REST-A 3; the sheet is morse/sheet.ts): International Morse code both ways, its timing at a speed in words
 * a minute (the PARIS standard: one unit is 1200 / WPM ms; a dot one unit, a dash three, one unit between the parts of a
 * letter, three between letters, seven between words), presses on a pad timed into letters, a letter a day to learn (the
 * Koch order) and its five-letter quiz, and the chat's words for it. Pure, so the tests run it.
 */

export const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
};
const FROM: Record<string, string> = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

/** The letters and figures in the chart's order. */
export const CHART = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'];

/** Text to Morse: letters apart by a space, words by " / " (what has no code is left out). */
export function toMorse(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .toUpperCase()
    .split(/\s+/)
    .map((w) => [...w].map((c) => MORSE[c]).filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' / ');
}

/** Morse to text: dots and dashes in any of the usual marks; letters apart by spaces, words by "/" or three spaces; "?" for no letter. */
export function fromMorse(code: string): string {
  const norm = code
    .replace(/[·•∙⋅*]/g, '.')
    .replace(/[−–—_]/g, '-')
    .replace(/\s*[/|]\s*/g, ' / ')
    .replace(/ {3,}/g, ' / ')
    .trim();
  if (!norm) return '';
  return norm
    .split(' / ')
    .map((w) =>
      w
        .split(/\s+/)
        .filter(Boolean)
        .map((l) => (/^[.-]+$/.test(l) ? (FROM[l] ?? '?') : '?'))
        .join(''),
    )
    .filter(Boolean)
    .join(' ');
}

/** Looks like Morse (only dots, dashes, spaces and slashes, with at least one dot or dash). */
export const isMorse = (s: string): boolean => /^[\s.\-·•−–—_/|]+$/.test(s) && /[.\-·•−–—_]/.test(s);

/** One unit in ms at this speed (PARIS: 50 units a word). */
export const unitMs = (wpm: number): number => 1200 / Math.max(5, Math.min(40, wpm || 15));

/** Sound on and off in turn for some Morse (what the synth plays and the screen flashes): ms each. */
export function timeline(code: string, wpm: number): { on: boolean; ms: number }[] {
  const u = unitMs(wpm);
  const out: { on: boolean; ms: number }[] = [];
  const gap = (units: number) => {
    const last = out.at(-1);
    if (!last) return;
    if (!last.on) last.ms = Math.max(last.ms, units * u);
    else out.push({ on: false, ms: units * u });
  };
  const words = code.trim().split(/\s*\/\s*/).filter(Boolean);
  words.forEach((w, wi) => {
    if (wi) gap(7);
    w.split(/\s+/).filter(Boolean).forEach((l, li) => {
      if (li) gap(3);
      [...l].forEach((s, si) => {
        if (si) gap(1);
        if (s === '.' || s === '-') out.push({ on: true, ms: (s === '.' ? 1 : 3) * u });
      });
    });
  });
  return out;
}

/** How long some Morse takes to send, in ms. */
export const duration = (code: string, wpm: number): number => timeline(code, wpm).reduce((s, x) => s + x.ms, 0);

/** One press on the pad: when the finger went down and came up (ms). */
export interface Press {
  down: number;
  up: number;
}

/**
 * Presses on the pad into Morse and letters. A press shorter than the line between a dot and a dash is a dot: that line
 * comes from his own presses when they include both (halfway, as a ratio, between his shortest and longest), else from
 * the speed set (two units). A pause of three of his dots ends a letter; of seven, a word.
 */
export function decodeTaps(presses: Press[], wpm = 15): { code: string; text: string; dot: number } {
  const ps = presses.filter((p) => p.up > p.down).sort((a, b) => a.down - b.down);
  if (!ps.length) return { code: '', text: '', dot: unitMs(wpm) };
  const lens = ps.map((p) => p.up - p.down);
  const lo = Math.min(...lens);
  const hi = Math.max(...lens);
  const line = hi / lo >= 1.8 ? Math.sqrt(lo * hi) : 2 * unitMs(wpm);
  const dots = lens.filter((l) => l < line);
  const dot = dots.length ? dots.reduce((s, x) => s + x, 0) / dots.length : Math.min(unitMs(wpm), line / 2);
  let code = '';
  ps.forEach((p, i) => {
    if (i) {
      const gap = p.down - ps[i - 1]!.up;
      if (gap >= 7 * dot) code += ' / ';
      else if (gap >= 3 * dot) code += ' ';
    }
    code += p.up - p.down < line ? '.' : '-';
  });
  return { code, text: fromMorse(code), dot };
}

/** The order letters are learnt in, one a day (Koch's: each new letter heard among the ones before). */
export const LEARN_ORDER = [...'KMRSUAPTLOWINJEFYVGQZHBCDX'];

/** Today's letter and the ones learnt so far, from the day he started (YYYY-MM-DD, his own date) and today. */
export function letterOfDay(started: string, today: string): { letter: string; known: string[]; day: number } {
  const d = Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${started}T12:00:00Z`)) / 86_400_000));
  const day = Number.isFinite(d) ? Math.min(d, LEARN_ORDER.length - 1) : 0;
  return { letter: LEARN_ORDER[day]!, known: LEARN_ORDER.slice(0, day + 1), day: day + 1 };
}

/** The five-letter quiz: today's letter twice at least, the rest from the ones learnt (`rand` in [0, 1)). */
export function quizLetters(known: string[], today: string, rand: () => number = Math.random): string[] {
  const pool = known.length ? known : [today];
  const out = [today, today];
  while (out.length < 5) out.push(pool[Math.floor(rand() * pool.length)] ?? today);
  // shuffled, so today's letter is not always first
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** What the chat asked of Morse: the sheet on its side, with the words to put in (or the code to read). */
export interface MorseAsk {
  mode: 'text' | 'decode' | 'tap' | 'learn' | 'chart';
  text?: string;
}

const LEAD = /^(?:hey ghosty[,!]?\s+|ghosty[,!]?\s+)?(?:please\s+|can you\s+|could you\s+)?/i;

/** "morse", "SOS in morse", "decode morse", "decode ... --- ...", "learn morse", "morse chart", "tap morse"; null otherwise. */
export function morseAsked(text: string): MorseAsk | null {
  const raw = text.trim().replace(LEAD, '');
  // (a code keeps its last dot: "decode ... --- ..."; a sentence loses its full stop)
  const t = raw.replace(/[\s!?]+$/, '').replace(/([a-z0-9"”'’])\.$/i, '$1');
  if (!t || t.length > 300) return null;
  if (/^(?:in )?morse(?: code)?$/i.test(t) || /^(?:open|show)(?: me)? (?:the )?morse(?: code)?(?: sheet)?$/i.test(t)) return { mode: 'text' };
  if (/^(?:learn|teach me|practi[sc]e) (?:the )?morse(?: code)?$/i.test(t) || /^morse (?:lesson|quiz|letter of the day)$/i.test(t)) return { mode: 'learn' };
  if (/^(?:the )?morse(?: code)? (?:chart|alphabet|table)$/i.test(t)) return { mode: 'chart' };
  if (/^tap (?:in |out )?(?:some )?morse(?: code)?$/i.test(t) || /^morse (?:pad|tapper)$/i.test(t)) return { mode: 'tap' };
  let m = /^(?:decode|read|translate)(?: this| the)?(?: morse(?: code)?)?(?:\s*[:,-]\s*|\s+)?(.*)$/i.exec(t);
  if (m && /morse/i.test(t.split(/[:,]/)[0] ?? '') && !m[1]) return { mode: 'decode' };
  if (m && m[1] && isMorse(m[1])) return { mode: 'decode', text: m[1].trim() };
  // a bare code of two letters or more ("... --- ..."), never a lone "..." typed as a pause
  if (isMorse(t) && /[.\-·•−–—_]+\s+[.\-·•−–—_]+/.test(t)) return { mode: 'decode', text: t };
  m = /^(?:say|write|put|turn|translate|convert|spell|show|send)?\s*(?:me\s+)?["“]?(.+?)["”]?\s+(?:in|into|to) morse(?: code)?$/i.exec(t.replace(/^(?:how (?:do|would|can) (?:you|i) (?:say|write|spell|send)|what(?:'s| is))\s+/i, ''));
  if (m && m[1]!.trim()) return { mode: 'text', text: m[1]!.trim() };
  return null;
}
