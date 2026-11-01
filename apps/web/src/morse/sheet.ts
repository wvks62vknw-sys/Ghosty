/**
 * The MORSE sheet (BRIEF-REST-A 3), from the chat ("morse", "SOS in morse", "decode morse", "learn morse"): four sides.
 *  - WORDS ⇄ MORSE: type either and the other follows; PLAY on the phone's own synth at the speed he sets (5–40 words a
 *    minute, kept on this phone), FLASH on the screen (Safari gives a web page no torch), STOP;
 *  - TAP: a pad that times his presses into dots and dashes and letters (morse/code.ts decodeTaps), with a tone while he
 *    presses; CLEAR;
 *  - LEARN: a letter a day in the Koch order (from the day he first opened it), its sound, and a five-letter quiz;
 *  - CHART: every letter and figure, a tap plays it.
 * All on the phone, no model, no network.
 */
import { clear, h } from '../core/dom';
import { button, modal } from '../ui/components';
import { CHART, decodeTaps, duration, fromMorse, letterOfDay, MORSE, quizLetters, timeline, toMorse, type MorseAsk, type Press } from './code';

const WPM_KEY = 'ghosty.morse.wpm';
const LEARN_KEY = 'ghosty.morse.started';

/** What the spec and the console can read (window.__ghostyMorse). */
export const morseState = { playing: false, played: '', flashed: false, tapped: '', taps: '' };

const nice = (code: string) => code.replace(/\./g, '·').replace(/-/g, '−');
const local = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const keep = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* blocked */
  }
};
const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------- the sound and the flash

let ac: AudioContext | null = null;
function audio(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ac ??= new AC();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}
const TONE = 640;
/**
 * The screen flashes at 5 words a minute at most: a dot is then 240 ms on and 240 ms off, about two flashes a second, under
 * the three a second that can bring on a seizure (WCAG 2.3.1). The sound keeps his speed.
 */
export const FLASH_WPM = 5;
let playing: { stop(): void } | null = null;

/** Plays (and, with `flash`, flashes) some Morse at this speed; resolves when it is done or stopped. */
function send(code: string, wpm: number, flash: boolean): Promise<void> {
  playing?.stop();
  const tl = timeline(code, flash ? Math.min(wpm, FLASH_WPM) : wpm);
  if (!tl.length) return Promise.resolve();
  const a = audio();
  const timers: number[] = [];
  let osc: OscillatorNode | null = null;
  let flashEl: HTMLElement | null = null;
  morseState.playing = true;
  morseState.played = code;
  if (flash) {
    morseState.flashed = true;
    flashEl = h('div.morseflash', { 'aria-hidden': 'true' });
    document.body.append(flashEl);
  }
  if (a) {
    osc = a.createOscillator();
    const g = a.createGain();
    osc.frequency.value = TONE;
    g.gain.value = 0;
    osc.connect(g).connect(a.destination);
    let t = a.currentTime + 0.05;
    for (const s of tl) {
      g.gain.setTargetAtTime(s.on ? 0.22 : 0, t, 0.004);
      t += s.ms / 1000;
    }
    g.gain.setTargetAtTime(0, t, 0.004);
    osc.start();
    osc.stop(t + 0.1);
  }
  let at = 50;
  for (const s of tl) {
    if (flashEl) {
      const el = flashEl;
      const on = s.on;
      timers.push(window.setTimeout(() => el.classList.toggle('on', on), at));
    }
    at += s.ms;
  }
  return new Promise((resolve) => {
    const done = () => {
      timers.forEach((t) => clearTimeout(t));
      try {
        osc?.stop();
      } catch {
        /* already stopped */
      }
      flashEl?.remove();
      morseState.playing = false;
      if (playing === me) playing = null;
      resolve();
    };
    const me = { stop: done };
    playing = me;
    timers.push(window.setTimeout(done, at + 80));
  });
}
export const stopMorse = (): void => playing?.stop();

/** A steady tone while a finger is on the pad. */
function sidetone(): { on(): void; off(): void } {
  let osc: OscillatorNode | null = null;
  return {
    on() {
      const a = audio();
      if (!a || osc) return;
      osc = a.createOscillator();
      const g = a.createGain();
      osc.frequency.value = TONE;
      g.gain.value = 0.18;
      osc.connect(g).connect(a.destination);
      osc.start();
    },
    off() {
      try {
        osc?.stop();
      } catch {
        /* stopped */
      }
      osc = null;
    },
  };
}

// ---------------------------------------------------------------- the sheet

let sheet: { close(): void; show(ask: MorseAsk): void } | null = null;

/** Opens the sheet on the side the chat asked for (with its words or its code), or brings it to that side. */
export function openMorse(ask: MorseAsk = { mode: 'text' }): void {
  (globalThis as { __ghostyMorse?: unknown }).__ghostyMorse = morseState;
  if (sheet) return sheet.show(ask);
  let wpm = Math.max(5, Math.min(40, Number(local(WPM_KEY)) || 15));

  // ---- WORDS ⇄ MORSE
  const words = h('textarea.morsein', { rows: 2, placeholder: 'Type words…', 'aria-label': 'Words to turn into Morse', autocapitalize: 'characters' });
  const code = h('textarea.morseout', { rows: 2, placeholder: '... --- ...', 'aria-label': 'Morse code, in dots and dashes: type it to read it', autocapitalize: 'none' });
  code.setAttribute('spellcheck', 'false');
  words.addEventListener('input', () => (code.value = toMorse(words.value)));
  code.addEventListener('input', () => (words.value = fromMorse(code.value)));
  const speed = h('input.morsewpm', { type: 'range', min: '5', max: '40', step: '1', value: String(wpm), 'aria-label': 'Speed in words a minute' });
  const speedText = h('span.morsewpmv', `${wpm} WPM`);
  speed.addEventListener('input', () => {
    wpm = Number(speed.value) || 15;
    speedText.textContent = `${wpm} WPM`;
    keep(WPM_KEY, String(wpm));
  });
  const status = h('small.note.morsestatus', { role: 'status' }, '');
  const go = async (flash: boolean) => {
    const c = code.value.trim() || toMorse(words.value);
    if (!c) return void (status.textContent = 'Type some words or some Morse first.');
    const at = flash ? Math.min(wpm, FLASH_WPM) : wpm;
    status.textContent = `${flash ? 'Flashing' : 'Playing'} at ${at} WPM · ${(duration(c, at) / 1000).toFixed(1)} s`;
    root.dataset.playing = '1';
    await send(c, wpm, flash);
    delete root.dataset.playing;
    status.textContent = '';
  };
  const textSide = h(
    'section.morseside',
    { dataset: { side: 'text' } },
    h('label.morselab', 'Words', words),
    h('label.morselab', 'Morse', code),
    h('div.row.morseplay', button('PLAY', () => void go(false), 'on'), button('FLASH', () => void go(true)), button('STOP', () => stopMorse())),
    h('div.row.morsespeed', speed, speedText),
    status,
    h('small.note', `FLASH lights the screen in time, at ${FLASH_WPM} WPM at most so it stays gentle on the eyes (a web page cannot use the torch). Letters a space apart, words a slash.`),
  );

  // ---- TAP
  const presses: Press[] = [];
  const tone = sidetone();
  const padCode = h('div.morsetapcode', { 'aria-live': 'polite' }, '');
  const padText = h('div.morsetaptext', { 'aria-live': 'polite' }, '');
  const pad = h('button.morsepad', { type: 'button', 'aria-label': 'Tap Morse here: a short press is a dot, a long press a dash' }, 'TAP');
  let downAt = 0;
  const down = (e: Event) => {
    e.preventDefault();
    if (downAt) return;
    downAt = performance.now();
    pad.classList.add('down');
    tone.on();
  };
  const up = () => {
    if (!downAt) return;
    presses.push({ down: downAt, up: performance.now() });
    downAt = 0;
    pad.classList.remove('down');
    tone.off();
    const r = decodeTaps(presses, wpm);
    padCode.textContent = nice(r.code);
    padText.textContent = r.text;
    morseState.taps = r.code;
    morseState.tapped = r.text;
  };
  pad.addEventListener('pointerdown', down);
  pad.addEventListener('pointerup', up);
  pad.addEventListener('pointercancel', up);
  pad.addEventListener('pointerleave', up);
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  pad.addEventListener('keydown', (e) => (e.key === ' ' || e.key === 'Enter') && !e.repeat && down(e));
  pad.addEventListener('keyup', (e) => (e.key === ' ' || e.key === 'Enter') && up());
  const tapSide = h(
    'section.morseside',
    { dataset: { side: 'tap' }, hidden: true },
    pad,
    padCode,
    padText,
    h('div.row', button('CLEAR', () => {
      presses.length = 0;
      padCode.textContent = padText.textContent = morseState.taps = morseState.tapped = '';
    })),
    h('small.note', 'A short press is a dot, a long one a dash; a pause ends the letter, a longer one the word.'),
  );

  // ---- LEARN
  const learnSide = h('section.morseside', { dataset: { side: 'learn' }, hidden: true });
  const paintLearn = () => {
    let started = local(LEARN_KEY);
    if (!started) keep(LEARN_KEY, (started = todayIso()));
    const day = letterOfDay(started, todayIso());
    const big = h('div.morsebig', h('b', day.letter), h('span', nice(MORSE[day.letter]!)));
    const quizBox = h('div.morsequiz');
    const startQuiz = () => {
      const qs = quizLetters(day.known, day.letter);
      let i = 0;
      let right = 0;
      const answer = h('input.morseans', { type: 'text', maxLength: 1, autocapitalize: 'characters', 'aria-label': 'The letter you heard' });
      const line = h('small.note', { role: 'status' }, '');
      const ask = () => {
        line.textContent = `Letter ${i + 1} of 5: listen, then type it.`;
        answer.value = '';
        answer.focus();
        void send(MORSE[qs[i]!]!, wpm, false);
      };
      const check = () => {
        const want = qs[i]!;
        const ok = answer.value.trim().toUpperCase() === want;
        if (ok) right++;
        line.textContent = ok ? `Yes: ${want} is ${nice(MORSE[want]!)}.` : `That was ${want}: ${nice(MORSE[want]!)}.`;
        i++;
        if (i < qs.length) setTimeout(ask, 900);
        else setTimeout(() => clear(quizBox, h('p.morsescore', `${right} of 5 right.`), button('AGAIN', startQuiz, 'on')), 900);
      };
      answer.addEventListener('keydown', (e) => e.key === 'Enter' && check());
      clear(quizBox, h('div.row', answer, button('CHECK', check, 'on'), button('HEAR IT AGAIN', () => void send(MORSE[qs[i]!]!, wpm, false))), line);
      ask();
    };
    clear(
      learnSide,
      h('p.note', `Day ${day.day}: today’s letter. The ones you know: ${day.known.join(' ')}.`),
      big,
      h('div.row', button('PLAY IT', () => void send(MORSE[day.letter]!, wpm, false), 'on'), button('QUIZ: FIVE LETTERS', startQuiz)),
      quizBox,
    );
  };

  // ---- CHART
  const chartSide = h(
    'section.morseside',
    { dataset: { side: 'chart' }, hidden: true },
    h('div.morsechart', ...CHART.map((c) => {
      const b = h('button.morsecell', { type: 'button', 'aria-label': `${c}: ${MORSE[c]!.replace(/\./g, 'dot ').replace(/-/g, 'dash ').trim()}` }, h('b', c), h('span', nice(MORSE[c]!)));
      b.addEventListener('click', () => void send(MORSE[c]!, wpm, false));
      return b;
    })),
  );

  // ---- the sides
  const sides: Record<MorseAsk['mode'], HTMLElement> = { text: textSide, decode: textSide, tap: tapSide, learn: learnSide, chart: chartSide };
  const tabs = (['text', 'tap', 'learn', 'chart'] as const).map((m) => {
    const b = button({ text: 'WORDS', tap: 'TAP', learn: 'LEARN', chart: 'CHART' }[m], () => show({ mode: m }));
    b.dataset.side = m;
    b.setAttribute('aria-label', { text: 'Words to Morse and back', tap: 'Tap Morse on a pad', learn: 'Learn a letter a day', chart: 'The Morse chart' }[m]);
    return b;
  });
  const root = h('div.morse', h('div.row.morsetabs', { role: 'group', 'aria-label': 'Morse' }, ...tabs), textSide, tapSide, learnSide, chartSide);
  const show = (ask: MorseAsk) => {
    const side = ask.mode === 'decode' ? 'text' : ask.mode;
    for (const s of [textSide, tapSide, learnSide, chartSide]) s.hidden = s !== sides[ask.mode];
    for (const t of tabs) {
      t.classList.toggle('on', t.dataset.side === side);
      t.setAttribute('aria-pressed', String(t.dataset.side === side));
    }
    if (ask.mode === 'learn') paintLearn();
    if (ask.mode === 'text' && ask.text) {
      words.value = ask.text;
      code.value = toMorse(ask.text);
    }
    if (ask.mode === 'decode' && ask.text) {
      code.value = ask.text;
      words.value = fromMorse(ask.text);
    }
    if (ask.mode === 'decode' && !ask.text) code.focus();
  };
  const m = modal('MORSE', root, () => {
    stopMorse();
    tone.off();
    sheet = null;
  });
  sheet = { close: m.close, show };
  show(ask);
}
