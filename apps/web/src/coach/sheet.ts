/**
 * THE COACH on the phone (BRIEF-REST-B part 2): a sheet over whatever is showing ("teach me guitar", "tune my guitar", "am I
 * in tune?", "coach me", "typing test", "what should I draw?", "Spanish word of the day"; assistant/restb.ts opens it).
 *  - TUNER: the microphone, pitch by YIN in code (coach/pitch.ts), the note, the cents off, a needle; guitar, bass, ukulele,
 *    violin or any note. Works offline;
 *  - LESSONS: ten each for guitar, piano and voice (coach/lessons.ts): a metronome of our own, the mic hearing whether the
 *    right notes came in order and on the click (or the strum, or a held note), a score, a streak, what to practise next;
 *  - TYPING: a passage, words a minute, accuracy and the keys he misses; DRAW: a prompt a day and his picture beside it
 *    (never judged by a model); WORDS: ten a day, spoken by this phone's voice, said back and scored by the recogniser.
 * What a microphone cannot judge is said on the screen. Nothing leaves the phone; nothing is recorded to keep.
 * The state sits on window.__ghosty.coach for the specs.
 */
import { clear, h } from '../core/dom';
import { button, modal, toast } from '../ui/components';
import { listen, speakIn, voiceIn } from '../assistant/voice';
import { dayNumber, dayOf, loadProgress, nextLesson, practiceWords, recordDrawing, recordLesson, recordTyping, recordWords, saveProgress, startInstrument, streak, type Progress } from './progress';
import { countIn, lessonsFor, lessonSecs, scoreLesson, stepsOf, TEACH, type Lesson, type Result, type Teach } from './lessons';
import { hzOfName, TUNINGS, tunerReading, tuningOf, rangeOf, type Instrument } from './notes';
import { detectPitch } from './pitch';
import { metronome, micMessage, openMic, playNotes, type Mic } from './mic';
import { dailyWords, drawPrompt, LANGUAGES, languageOf, pickText, scoreTyping, typingWords, wordMatch } from './skills';

export type CoachWhat = 'tuner' | 'lessons' | 'typing' | 'draw' | 'words';
const TABS: { id: CoachWhat; label: string }[] = [
  { id: 'tuner', label: 'TUNER' },
  { id: 'lessons', label: 'LESSONS' },
  { id: 'typing', label: 'TYPING' },
  { id: 'draw', label: 'DRAW' },
  { id: 'words', label: 'WORDS' },
];

/** What the coach is doing, for the specs (window.__ghosty.coach). */
export const coachState = {
  open: '' as '' | CoachWhat,
  error: '',
  streak: 0,
  tuner: { on: false, instrument: 'guitar', hz: 0, note: '', cents: 0, string: '' as string | null, inTune: false, words: '', level: 0, blocks: 0 },
  lesson: { id: '', phase: 'idle' as 'idle' | 'ready' | 'play' | 'listening' | 'done', beat: -1, heard: '', score: -1, passed: false, summary: '', words: [] as string[], lagMs: 0, steps: [] as string[] },
  typing: { target: '', typed: 0, wpm: -1, accuracy: -1, weak: [] as string[], done: false },
  draw: { prompt: '', shown: false, done: false },
  words: { language: 'es', list: [] as string[], said: 0, results: [] as string[] },
};

interface Screen {
  el: HTMLElement;
  stop(): void;
}

let sheet: { close(): void } | null = null;
let stopNow: (() => void) | null = null;
let prog: Progress = loadProgress();
const today = () => dayOf(Date.now());
const save = (p: Progress) => {
  prog = p;
  saveProgress(p);
  coachState.streak = streak(p.days, today());
};

export async function openCoach(what: CoachWhat = 'lessons', args: { instrument?: string; language?: string } = {}): Promise<void> {
  closeCoach();
  const w = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
  if (w) w.coach = coachState;
  prog = loadProgress();
  coachState.streak = streak(prog.days, today());
  coachState.error = '';
  const body = h('div.cobody');
  const tabs = h('div.pkrow.cotabs', { role: 'tablist', 'aria-label': 'What to practise' });
  const streakLine = h('p.pknote.costreak', { 'aria-live': 'polite' });
  const show = (id: CoachWhat, a: { instrument?: string; language?: string } = {}) => {
    stopNow?.();
    stopNow = null;
    coachState.open = id;
    for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.tab === id));
    let s: Screen;
    try {
      s = id === 'tuner' ? tunerScreen((a.instrument as Instrument) ?? 'guitar') : id === 'lessons' ? lessonsScreen((a.instrument as Teach) ?? startInstrument(prog), paintStreak) : id === 'typing' ? typingScreen(paintStreak) : id === 'draw' ? drawScreen(paintStreak) : wordsScreen(a.language ?? 'es', paintStreak);
    } catch (e) {
      coachState.error = (e as Error).message;
      s = { el: h('p.pknote', `That screen did not open: ${(e as Error).message}`), stop: () => undefined };
    }
    stopNow = s.stop;
    clear(body, s.el);
    paintStreak();
  };
  const paintStreak = () => {
    const n = streak(prog.days, today());
    streakLine.textContent = n ? `${n}-day streak: ${n === 1 ? 'you practised today' : `${n} days in a row`}. Everything here stays on this phone.` : 'Practise today and the streak starts. Everything here stays on this phone.';
  };
  for (const t of TABS) {
    const b = button(t.label, () => show(t.id));
    b.dataset.tab = t.id;
    b.setAttribute('role', 'tab');
    tabs.append(b);
  }
  sheet = modal('COACH', h('div.pk.coach', { dataset: { pack: 'coach' } }, tabs, streakLine, body), () => {
    stopNow?.();
    stopNow = null;
    sheet = null;
    coachState.open = '';
  });
  show(what, args);
}

export function closeCoach(): void {
  sheet?.close();
}

// ================================================================================================ TUNER
function tunerScreen(first: Instrument): Screen {
  let tuning = tuningOf(first);
  let mic: Mic | null = null;
  let off: (() => void) | null = null;
  let last = 0;
  const recent: (number | null)[] = [];
  const note = h('b.pkbig.conote', { 'aria-live': 'polite' }, '—');
  const cents = h('span.cocents', '');
  const needle = h('i.coneedle');
  const gauge = h('div.cogauge', { role: 'img', 'aria-label': 'Tuning needle: the middle is in tune' }, h('i.cotick.mid'), needle);
  const words = h('p.pknote.cowords', { 'aria-live': 'polite' }, 'Press START, then pluck a string.');
  const level = h('i.colevel');
  const strings = h('div.pkrow.costrings', { role: 'group', 'aria-label': 'Open strings' });
  const chips = h('div.pkrow', { role: 'group', 'aria-label': 'What you are tuning' });
  const go = button('START', () => (mic ? stop() : void start()), 'on');

  const paintChips = () => {
    chips.replaceChildren(...TUNINGS.map((t) => {
      const b = button(t.label, () => {
        tuning = t;
        coachState.tuner.instrument = t.id;
        recent.length = 0;
        paintChips();
      }, t.id === tuning.id ? 'on' : '');
      b.setAttribute('aria-pressed', String(t.id === tuning.id));
      return b;
    }));
    strings.replaceChildren(...tuning.strings.map((s) => h('span.costring', { dataset: { s } }, s)));
    strings.hidden = !tuning.strings.length;
  };
  paintChips();
  coachState.tuner.instrument = tuning.id;

  const reset = () => {
    note.textContent = '—';
    cents.textContent = '';
    needle.style.left = '50%';
    gauge.classList.remove('ok');
    for (const c of strings.children) c.classList.remove('near', 'ok');
  };
  const onBlock = (block: Float32Array) => {
    if (!mic) return;
    coachState.tuner.blocks++;
    let rms = 0;
    for (let i = 0; i < block.length; i += 4) rms += block[i]! * block[i]!;
    rms = Math.sqrt(rms / (block.length / 4));
    coachState.tuner.level = Math.round(Math.min(1, rms * 6) * 100) / 100;
    level.style.width = `${Math.round(coachState.tuner.level * 100)}%`;
    const r = rangeOf(tuning);
    const p = detectPitch(block, mic.sampleRate, { minHz: r.minHz, maxHz: r.maxHz });
    recent.push(p && p.clarity >= 0.85 ? p.hz : null);
    if (recent.length > 3) recent.shift();
    const hz = recent.filter((x): x is number => x != null).sort((a, b) => a - b);
    if (hz.length < 2) {
      if (Date.now() - last > 1500) {
        reset();
        words.textContent = coachState.tuner.level > 0.05 ? 'I hear a sound but not one clear note: pluck one string and let it ring.' : 'Listening… pluck a string.';
      }
      return;
    }
    last = Date.now();
    const t = tunerReading(hz[Math.floor(hz.length / 2)]!, tuning);
    Object.assign(coachState.tuner, { hz: Math.round(t.hz * 100) / 100, note: t.note, cents: t.off, string: t.string, inTune: t.inTune, words: t.words });
    note.textContent = t.note;
    cents.textContent = `${t.off > 0 ? '+' : ''}${Math.round(t.off)} cents`;
    needle.style.left = `${50 + Math.max(-50, Math.min(50, t.off)) * 0.9}%`;
    gauge.classList.toggle('ok', t.inTune);
    words.textContent = t.words;
    for (const c of strings.children) {
      c.classList.toggle('near', (c as HTMLElement).dataset.s === t.string);
      c.classList.toggle('ok', (c as HTMLElement).dataset.s === t.string && t.inTune);
    }
  };
  const start = async () => {
    go.disabled = true;
    try {
      mic = await openMic();
      off = mic.onBlock(onBlock);
      coachState.tuner.on = true;
      go.textContent = 'STOP';
      words.textContent = 'Listening… pluck a string.';
    } catch (e) {
      coachState.error = micMessage(e);
      words.textContent = coachState.error;
    } finally {
      go.disabled = false;
    }
  };
  const stop = () => {
    off?.();
    off = null;
    mic?.close();
    mic = null;
    coachState.tuner.on = false;
    go.textContent = 'START';
    reset();
  };
  const el = h('div.cotuner', chips, h('div.cohero', note, cents), gauge, h('span.colevelbox', { role: 'img', 'aria-label': 'How loud I hear you' }, level), strings, words, h('div.pkrow', go), h('p.pknote', 'The note and how far off it is, to the nearest cent, from this phone’s microphone: no recording is kept and nothing is sent. It works with no signal. It hears one note at a time: a chord, or two strings at once, will not read.'));
  return { el, stop };
}

// ================================================================================================ LESSONS
function lessonsScreen(first: Teach, repaintStreak: () => void): Screen {
  let inst: Teach = first;
  let mic: Mic | null = null;
  let timers: number[] = [];
  let stopHear: (() => void) | null = null;
  let clickOn = true;
  const root = h('div.colessons');
  const stop = () => {
    for (const t of timers) clearTimeout(t);
    timers = [];
    stopHear?.();
    stopHear = null;
    mic?.close();
    mic = null;
    coachState.lesson.phase = 'idle';
  };

  const list = () => {
    stop();
    coachState.lesson = { ...coachState.lesson, id: '', phase: 'idle', beat: -1, heard: '', score: -1, passed: false, summary: '', words: [], steps: [] };
    const chips = h('div.pkrow', { role: 'group', 'aria-label': 'Instrument' }, ...TEACH.map((t) => {
      const b = button(t.label.toUpperCase(), () => ((inst = t.id), list()), t.id === inst ? 'on' : '');
      b.setAttribute('aria-pressed', String(t.id === inst));
      return b;
    }));
    const next = nextLesson(prog, inst);
    const rows = lessonsFor(inst).map((l) => {
      const b = prog.best[l.id];
      const mark = prog.passed[l.id] ? '✓' : l.id === next.lesson.id ? '→' : '';
      return button(h('span.colrow', h('b', `${l.n}`), h('span.colname', l.title), h('i', `${mark}${b ? ` ${Math.round(b * 100)}%` : ''}`.trim())), () => detail(l), l.id === next.lesson.id ? 'on' : '');
    });
    for (const r of rows) r.classList.add('colbtn');
    clear(root, chips, h('p.pknote.copractice', practiceWords(prog, today(), inst)), h('div.colist', ...rows), h('p.pknote', 'The first ten lessons of each are ours, written for this. The microphone hears whether the right notes come in order and on the click; it cannot see your fingers, hear whether a chord is full, or tell an up-strum from a down-strum.'));
  };

  const detail = (l: Lesson) => {
    stop();
    coachState.lesson = { ...coachState.lesson, id: l.id, phase: 'idle', beat: -1, heard: '', score: -1, passed: false, summary: '', words: [], steps: stepsOf(l) };
    const steps = h('div.pkrow.costeps', { 'aria-label': 'The notes of this lesson' }, ...stepsOf(l).map((s, i) => h('span.costep', { dataset: { i: String(i) } }, s)));
    const status = h('p.pknote.costatus', { 'aria-live': 'polite' }, l.kind === 'hold' ? 'START gives a short count, then listens.' : `START plays ${countIn} clicks, then listens for ${l.kind === 'strum' ? 'your strums' : 'your notes'}. ${l.bpm} beats a minute.`);
    const live = h('b.pkbig.cohear', { 'aria-live': 'off' }, '');
    const result = h('div.coresult', { 'aria-live': 'polite' });
    const go = button('START', () => void run(), 'on');
    const click = button(clickOn ? 'CLICK: ON' : 'CLICK: OFF', (b) => {
      clickOn = !clickOn;
      b.textContent = clickOn ? 'CLICK: ON' : 'CLICK: OFF';
    });
    const heard = l.kind === 'notes' ? button('HEAR IT', () => hear()) : null;
    const hear = () => {
      stopHear?.();
      try {
        const ctx = mic?.ctx ?? new AudioContext();
        stopHear = playNotes(ctx, l.notes!.map((n) => (n === '-' ? 0 : hzOfName(n))), l.bpm);
      } catch {
        status.textContent = 'This phone would not play the notes.';
      }
    };

    const run = async () => {
      go.disabled = true;
      clear(result);
      live.textContent = '';
      try {
        mic = await openMic();
      } catch (e) {
        coachState.error = micMessage(e);
        status.textContent = coachState.error;
        go.disabled = false;
        return;
      }
      const m = mic;
      const stepEls = [...steps.children] as HTMLElement[];
      for (const s of stepEls) s.className = 'costep';
      coachState.lesson.phase = 'ready';
      coachState.lesson.beat = -1;
      m.onBlock((block) => {
        const p = detectPitch(block, m.sampleRate, { minHz: 70, maxHz: 1200 });
        if (p && p.clarity >= 0.85) {
          const t = tunerReading(p.hz, tuningOf('free'));
          live.textContent = t.note;
          coachState.lesson.heard = t.note;
        }
      });
      const total = lessonSecs(l);
      let t0 = 0;
      if (l.kind === 'hold') {
        status.textContent = 'Get ready…';
        t0 = m.ctx.currentTime + 1.5;
        timers.push(window.setTimeout(() => {
          m.startRecording();
          coachState.lesson.phase = 'play';
          status.textContent = `Now: ${l.hold!.note ? `sing ${l.hold!.note.replace(/\d/, '')} and hold it` : 'sing one note and hold it'} for ${l.hold!.secs} seconds.`;
        }, 1500));
      } else {
        const metro = metronome(m.ctx, l.bpm, (n) => {
          coachState.lesson.beat = n;
          if (n < countIn) {
            coachState.lesson.phase = 'ready';
            status.textContent = `${n + 1}…`;
          } else {
            coachState.lesson.phase = 'play';
            status.textContent = 'Play!';
            for (const e of stepEls) e.classList.remove('now');
            stepEls[l.kind === 'strum' ? (n - countIn) * 2 : n - countIn]?.classList.add('now');
          }
        }, clickOn);
        t0 = metro.start();
        timers.push(window.setTimeout(() => m.startRecording(), Math.max(0, (t0 - m.ctx.currentTime) * 1000)));
        timers.push(window.setTimeout(() => metro.stop(), total * 1000));
      }
      const endMs = (l.kind === 'hold' ? 0 : (t0 - m.ctx.currentTime) * 1000) + total * 1000;
      timers.push(window.setTimeout(() => {
        coachState.lesson.phase = 'listening';
        status.textContent = 'Listening back…';
        // let the screen say so before the work starts
        timers.push(window.setTimeout(() => {
          const samples = m.stopRecording();
          const sr = m.sampleRate;
          m.close();
          mic = null;
          finish(scoreLesson(l, samples, sr), stepEls);
        }, 60));
      }, Math.max(200, endMs)));
    };

    const finish = (res: Result, stepEls: HTMLElement[]) => {
      res.steps.forEach((s, i) => {
        const el = stepEls[chipIndex(l, i)];
        if (el) el.className = `costep ${s.state}`;
      });
      Object.assign(coachState.lesson, { phase: 'done', score: Math.round(res.score * 100) / 100, passed: res.passed, summary: res.summary, words: res.words, lagMs: res.lagMs });
      save(recordLesson(prog, l.id, res.score, res.passed, today()));
      repaintStreak();
      const nx = nextLesson(prog, l.instrument);
      clear(result, h('b', res.summary), ...(res.words.length ? [h('ul', ...res.words.slice(0, 6).map((w) => h('li', w)))] : []), h('small', practiceWords(prog, today(), l.instrument)), h('div.pkrow', button('AGAIN', () => detail(l)), button(res.passed && nx.lesson.id !== l.id ? `NEXT: ${nx.lesson.n}` : 'ALL LESSONS', () => (res.passed && nx.lesson.id !== l.id ? detail(nx.lesson) : list()))));
      status.textContent = res.passed ? 'Well done.' : 'Not this time.';
      go.disabled = false;
      go.textContent = 'AGAIN';
    };

    clear(root, h('div.pkrow', button('‹ LESSONS', () => list())), h('h3.cotitle', `${l.n} · ${l.title}`), h('p.pknote.cogoal', l.goal), h('p.pknote.cohow', l.how), steps, live, status, h('div.pkrow', go, ...(heard ? [heard] : []), ...(l.kind === 'hold' ? [] : [click])), result);
  };

  list();
  return { el: root, stop };
}

/** The chip (among a lesson's steps on the screen) that the nth result stands for: the nth note that is not a rest, or the nth hit. */
const chipIndex = (l: Lesson, n: number): number => {
  if (l.kind === 'hold') return 0;
  const marks = stepsOf(l);
  let k = -1;
  for (let i = 0; i < marks.length; i++) if (marks[i] !== '·' && ++k === n) return i;
  return -1;
};

// ================================================================================================ TYPING
function typingScreen(repaintStreak: () => void): Screen {
  const target = pickText(dayNumber(today()) + prog.typing.log.length, prog.typing.weak ?? []);
  coachState.typing = { target, typed: 0, wpm: -1, accuracy: -1, weak: [], done: false };
  let t0 = 0;
  const text = h('p.cotext', { 'aria-label': 'The passage to type' }, ...[...target].map((c) => h('span', c)));
  const input = h('textarea.cotype', { rows: 3, autocapitalize: 'off', autocorrect: 'off', spellcheck: false, autocomplete: 'off', 'aria-label': 'Type the passage here', placeholder: 'Start typing the passage above' }) as HTMLTextAreaElement;
  const result = h('p.pknote.coresult', { 'aria-live': 'polite' });
  const spans = [...text.children] as HTMLElement[];
  const paint = () => {
    const v = input.value;
    spans.forEach((s, i) => {
      s.className = i < v.length ? (v[i] === target[i] ? 'ok' : 'bad') : i === v.length ? 'cur' : '';
    });
  };
  input.addEventListener('paste', (e) => e.preventDefault());
  input.addEventListener('input', () => {
    if (!t0) t0 = performance.now();
    coachState.typing.typed = input.value.length;
    paint();
    if (input.value.length >= target.length && !coachState.typing.done) {
      const s = scoreTyping(target, input.value.slice(0, target.length), performance.now() - t0);
      Object.assign(coachState.typing, { wpm: Math.round(s.wpm), accuracy: Math.round(s.accuracy * 100) / 100, weak: s.weak.map((w) => w.key), done: true });
      input.disabled = true;
      save(recordTyping(prog, s.wpm, s.accuracy, today(), s.weak.map((w) => w.key)));
      repaintStreak();
      result.textContent = `${typingWords(s)} Your best is ${prog.typing.best} words a minute.`;
      again.hidden = false;
    }
  });
  const again = button('ANOTHER PASSAGE', () => {
    host.replaceWith(typingScreen(repaintStreak).el);
  });
  again.hidden = true;
  paint();
  const host = h('div.cotyping', text, input, result, h('div.pkrow', again), h('p.pknote', 'Words a minute counts only the letters you got right, five to a word. The keys you miss most come back in the next passage.'));
  return { el: host, stop: () => undefined };
}

// ================================================================================================ DRAW
function drawScreen(repaintStreak: () => void): Screen {
  const p = drawPrompt(dayNumber(today()));
  coachState.draw = { prompt: p.text, shown: false, done: prog.drawn.includes(today()) };
  const pic = h('figure.codrawpic', h('div.codrawempty', 'Your drawing will be here'), h('figcaption', 'YOURS'));
  const input = h('input', { type: 'file', accept: 'image/*', capture: 'environment', 'aria-label': 'Take a picture of your drawing' }) as HTMLInputElement;
  input.hidden = true;
  let url = '';
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (!f) return;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(f);
    clear(pic, h('img', { src: url, alt: 'Your drawing' }), h('figcaption', 'YOURS'));
    coachState.draw.shown = true;
    coachState.draw.done = true;
    save(recordDrawing(prog, today()));
    repaintStreak();
    note.textContent = 'There it is, beside the prompt. I do not mark drawings: look at both and ask yourself whether yours says what the prompt says.';
  });
  const note = h('p.pknote', { 'aria-live': 'polite' }, 'Draw it on paper (or anything), then take its picture: it goes beside the prompt. A drawing is yours to judge; I do not mark it, and the picture stays on this phone.');
  const el = h('div.codraw', h('div.codrawpair', h('figure.codrawprompt', h('div.codrawtext', p.text), h('figcaption', 'TODAY’S PROMPT')), pic), input, h('div.pkrow', button('TAKE A PICTURE OF IT', () => input.click(), 'on')), note, h('small.pknote', `${p.subject[0]!.toUpperCase()}${p.subject.slice(1)}: a new prompt every day.`));
  return { el, stop: () => url && URL.revokeObjectURL(url) };
}

// ================================================================================================ WORDS
function wordsScreen(first: string, repaintStreak: () => void): Screen {
  let lang = languageOf(first);
  const root = h('div.cowords');
  const spokenOverride = (): ((t: string) => Promise<string>) | null => {
    const w = window as unknown as { __ghostyListen?: (want: string) => Promise<string> };
    return navigator.webdriver && w.__ghostyListen ? w.__ghostyListen : null;
  };
  const paint = () => {
    const day = dayNumber(today());
    const list = dailyWords(lang.id, day);
    const results = new Array<string>(list.length).fill('');
    coachState.words = { language: lang.id, list: list.map((x) => x.word), said: prog.words[lang.id]?.[today()] ?? 0, results: [] };
    const chips = h('div.pkrow', { role: 'group', 'aria-label': 'Language' }, ...LANGUAGES.map((l) => {
      const b = button(l.label.toUpperCase(), () => ((lang = l), paint()), l.id === lang.id ? 'on' : '');
      b.setAttribute('aria-pressed', String(l.id === lang.id));
      return b;
    }));
    const hasVoice = !!voiceIn(lang.id);
    const score = h('p.pknote.coscore', { 'aria-live': 'polite' }, `${coachState.words.said} of ${list.length} said back today.`);
    const rows = list.map((x, i) => {
      const mark = h('i.comark', '');
      const hear = button('HEAR', () => {
        if (!speakIn(x.word, lang.id)) toast(`This phone has no ${lang.label} voice to read it aloud. The word is ${x.word}.`, 'warn');
      });
      hear.setAttribute('aria-label', `Hear ${x.word}`);
      const say = button('SAY IT', async (b) => {
        b.disabled = true;
        mark.textContent = '…';
        try {
          const o = spokenOverride();
          const heard = o ? await o(x.word) : await listen(true);
          const m = wordMatch(heard, x.word);
          results[i] = m;
          mark.textContent = m === 'right' ? '✓' : m === 'close' ? '≈' : '✗';
          mark.dataset.r = m;
          coachState.words.results = [...results];
          const said = results.filter((r) => r === 'right').length;
          coachState.words.said = Math.max(coachState.words.said, said);
          score.textContent = `${coachState.words.said} of ${list.length} said back today. I heard “${heard.trim() || '…nothing'}”${m === 'close' ? ' — close' : m === 'wrong' ? ' — try again' : ''}.`;
          save(recordWords(prog, lang.id, today(), coachState.words.said));
          repaintStreak();
        } catch (e) {
          mark.textContent = '';
          score.textContent = (e as Error).message;
        } finally {
          b.disabled = false;
        }
      });
      say.setAttribute('aria-label', `Say ${x.word} back`);
      return h('li.coword', h('span.coen', x.en), h('b.cofw', x.word), hear, say, mark);
    });
    clear(root, chips, h('ul.cowordlist', ...rows), score, h('p.pknote', `${hasVoice ? `This phone has a ${lang.label} voice: HEAR reads each word aloud.` : `This phone has no ${lang.label} voice, so HEAR cannot speak them (the words are still here).`} SAY IT listens once and checks what it heard against the word, ignoring accents. Ten new ones tomorrow.`));
  };
  paint();
  return { el: root, stop: () => undefined };
}
