/**
 * THE LEARNING PACK on the phone (BRIEF-PACKS-3): a sheet over whatever is showing (the open_learning command; the chat's "ten
 * Spanish words", "drawing class", "maths drill"). Twelve pages, one practice each, beside the LEARN tab's courses and never a
 * second tutor. WORDS: the day's ten in one of eight languages (or three phrases for a situation), said by the phone's own
 * voices; CARDS: the deck, one card at a time, AGAIN HARD GOOD EASY; DRAW: a guide drawn by code that he traces with his finger,
 * scored by simple overlap; TYPING: a passage from his own library, words a minute and accuracy; WRITING: a photo of a line he
 * wrote, read back on this phone; READING: a passage a word at a time at a speed he sets, then three questions; MEMORY: a number,
 * a list, or names with cues he gives; MATHS: five minutes by level; SPELLING: the slips in his own messages, said aloud for him to
 * spell; FIRST AID: the NHS's steps to learn and to put in order ("call 999 for a real one"); PLAN: four weeks of ten minutes;
 * STREAKS: every skill's run and best. The drills run on this phone (packages/shared/src/learning.ts); the deck, the log, the plans
 * and the slips are kept in his own brain (POST /packs/do, no model). The state sits on window.__ghosty.learning for the specs.
 */
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';
import { brain } from '../../api/brain';
import {
  asciiText,
  comprehension,
  dailyWords,
  dayNo,
  FIRST_AID,
  FIRST_AID_LINE,
  HAND_SENTENCES,
  LANGS,
  legibility,
  lessonFor,
  LESSONS,
  mathsDrill,
  memoryScore,
  orderScore,
  overlap,
  phrasesFor,
  READ_PASSAGES,
  readingFrom,
  readQuestions,
  rsvp,
  scenarioFor,
  SITUATIONS,
  TYPING_LINES,
  typingScore,
  type Entry,
  type LangId,
  type MemoryDrill,
  type MemoryKind,
  type Question,
  type Situation,
  type Stroke,
} from '../../../../../packages/shared/src/learning';
import { libraryPassage, libraryRaw } from './library';
import { hush, onVoices, sayIn, voiceReport } from './voices';

export type LearnWhat = 'words' | 'review' | 'draw' | 'typing' | 'hand' | 'readfast' | 'memory' | 'maths' | 'spelling' | 'firstaid' | 'plan' | 'progress';
const VIEWS: { id: LearnWhat; label: string }[] = [
  { id: 'words', label: 'Words' },
  { id: 'review', label: 'Cards' },
  { id: 'draw', label: 'Draw' },
  { id: 'typing', label: 'Typing' },
  { id: 'hand', label: 'Writing' },
  { id: 'readfast', label: 'Reading' },
  { id: 'memory', label: 'Memory' },
  { id: 'maths', label: 'Maths' },
  { id: 'spelling', label: 'Spelling' },
  { id: 'firstaid', label: 'First aid' },
  { id: 'plan', label: 'Plan' },
  { id: 'progress', label: 'Streaks' },
];
export const learnState = {
  open: '' as '' | LearnWhat,
  lang: 'es',
  said: '',
  result: '',
  logged: '',
  strokes: 0,
  guide: '',
  score: -1,
  level: 0,
  voices: { have: [] as string[], missing: [] as string[], none: true },
  words: [] as string[],
};
let openSheet: { close(): void } | null = null;
let cleanups: (() => void)[] = [];

// ---------------------------------------------------------------- small things

const ls = {
  get(k: string): string {
    try {
      return localStorage.getItem(`ghosty.learning.${k}`) ?? '';
    } catch {
      return '';
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(`ghosty.learning.${k}`, v);
    } catch {
      /* a private window keeps nothing: it still works */
    }
  },
};
const ymd = (d = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const note = (text = '') => h('p.pknote', { 'aria-live': 'polite' }, text);
const named = <T extends HTMLElement>(b: T, label: string): T => (b.setAttribute('aria-label', label), b);
const field = (label: string, control: HTMLElement) => h('label.pkfield', h('span.pklab', label), control);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const later = (fn: () => void, ms: number): number => window.setTimeout(fn, ms);

async function run(action: string, a: Record<string, unknown>): Promise<{ text: string; data?: unknown }> {
  try {
    const r = await brain.packDo('learning', action, a);
    learnState.said = r.text;
    return r;
  } catch (e) {
    toast(`My brain didn’t answer: ${(e as Error).message}`, 'warn');
    return { text: '' };
  }
}
/** A result into his log; what the brain says back (the streak, a new best, the level for next time) goes into `into`. */
async function logIt(a: Record<string, unknown>, into: HTMLElement): Promise<void> {
  const r = await run('done', a);
  learnState.logged = r.text;
  into.textContent = r.text || 'Not logged: my brain didn’t answer, so this one is not in your streak.';
}
/** The text of a photo, read on this phone with the Lens's reader: nothing leaves the phone to read it. */
async function readText(f: File, status: HTMLElement): Promise<string> {
  const [{ Reader }, { loadImageFile }, { cleanOcr }] = await Promise.all([import('../../vision/ocr'), import('../../vision/camera'), import('../../vision/ocrtext')]);
  const reader = new Reader();
  try {
    const r = await reader.read(await loadImageFile(f, 2048), (s) => (status.textContent = `${s}`));
    return cleanOcr(r);
  } finally {
    reader.terminate();
  }
}
function photo(label: string, onFile: (f: File) => void): HTMLElement {
  const input = h('input', { type: 'file', accept: 'image/*', 'aria-label': label, hidden: true }) as HTMLInputElement;
  input.setAttribute('capture', 'environment');
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    input.value = '';
    if (f) onFile(f);
  });
  return h('span', { style: 'display:contents' }, named(button(label, () => input.click()), label), input);
}
const svgEl = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

// ---------------------------------------------------------------- the sheet

export async function openLearning(what: string, args: Record<string, unknown> = {}): Promise<void> {
  const v: LearnWhat = VIEWS.find((x) => x.id === what)?.id ?? 'words';
  openSheet?.close();
  const win = window as unknown as { __ghosty?: Record<string, unknown> };
  if (win.__ghosty) win.__ghosty.learning = learnState;
  const body = h('div.pkcol');
  const pk = h('div.pk', { dataset: { pack: 'learning', screen: v } }, body);
  const tabs = h('div.pkrow', { role: 'group', 'aria-label': 'Pages of the learning sheet' });
  const stop = () => {
    for (const c of cleanups) c();
    cleanups = [];
    hush();
  };
  const show = (view: LearnWhat, a: Record<string, unknown> = {}) => {
    stop();
    learnState.open = view;
    learnState.result = '';
    learnState.logged = '';
    pk.dataset.screen = view;
    for (const b of tabs.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
    body.replaceChildren(
      view === 'words' ? wordsView(a)
      : view === 'review' ? reviewView(a)
      : view === 'draw' ? drawView(a)
      : view === 'typing' ? typingView(a)
      : view === 'hand' ? handView(a)
      : view === 'readfast' ? readView(a)
      : view === 'memory' ? memoryView(a)
      : view === 'maths' ? mathsView()
      : view === 'spelling' ? spellingView()
      : view === 'firstaid' ? firstAidView(a)
      : view === 'plan' ? planView()
      : progressView(),
    );
  };
  for (const t of VIEWS) {
    const b = button(t.label, () => show(t.id));
    b.dataset.view = t.id;
    b.setAttribute('aria-label', `${t.label} page`);
    tabs.append(b);
  }
  openSheet = modal('LEARNING', h('div.pkcol', tabs, pk), () => {
    stop();
    openSheet = null;
    learnState.open = '';
  });
  show(v, args);
}

// ---------------------------------------------------------------- WORDS

function wordsView(a: Record<string, unknown>): HTMLElement {
  let lang: LangId = (LANGS.find((l) => l.id === (typeof a.lang === 'string' ? a.lang : ls.get('lang')))?.id ?? 'es') as LangId;
  let sit: string = typeof a.situation === 'string' && (SITUATIONS as readonly string[]).includes(a.situation) ? a.situation : 'today';
  const langSel = h('select', { 'aria-label': 'Language' }, ...LANGS.map((l) => h('option', { value: l.id, selected: l.id === lang }, l.name))) as HTMLSelectElement;
  const sitSel = h('select', { 'aria-label': 'Today’s ten words, or phrases for a situation' }, h('option', { value: 'today', selected: sit === 'today' }, 'Today’s ten words'), ...SITUATIONS.map((s) => h('option', { value: s, selected: s === sit }, `Phrases: ${s}`))) as HTMLSelectElement;
  const heading = h('p.pkcue');
  const list = h('div.pkcol', { role: 'list', 'aria-label': 'Words' });
  const voices = note();
  const status = note();
  const say = (e: Entry) => {
    const l = LANGS.find((x) => x.id === lang)!;
    if (!sayIn(e.word, l.voice)) status.textContent = `This phone has no ${l.name} voice that I can find, so I can show the word but not say it.`;
    else status.textContent = '';
  };
  const row = (e: Entry) => {
    const l = LANGS.find((x) => x.id === lang)!;
    return h(
      'div.pkperson',
      { role: 'listitem', 'aria-label': `${e.en}: ${e.word}${e.roman ? `, ${e.roman}` : ''}` },
      h('b', { lang: l.voice, dir: l.id === 'ar' ? 'rtl' : 'ltr' }, e.word),
      h('span.pklab', `${e.en}${e.roman ? ` · ${e.roman}` : ''}`),
      h('div.pkrow', named(button('SAY IT', () => say(e)), `Say ${e.en} in ${l.name}`)),
    );
  };
  const entries = (): Entry[] => (sit === 'today' ? dailyWords(lang, ymd()).entries : phrasesFor(lang, sit as Situation));
  const render = () => {
    const l = LANGS.find((x) => x.id === lang)!;
    const es = entries();
    learnState.lang = lang;
    learnState.words = es.map((e) => e.word);
    heading.textContent = sit === 'today' ? `${l.name}: ${dailyWords(lang, ymd()).day}, ten words` : `${l.name}: ${sit}, three phrases`;
    list.replaceChildren(...es.map(row));
    status.textContent = '';
  };
  const showVoices = () => {
    const v = voiceReport();
    learnState.voices = v;
    voices.textContent = v.none
      ? 'This phone has not listed its voices yet. If SAY IT stays silent, it has none for this language.'
      : `Voices on this phone: ${v.have.join(', ') || 'none of the eight'}.${v.missing.length ? ` No voice found for ${v.missing.join(', ')}: I can show those words but not say them.` : ''}`;
  };
  cleanups.push(onVoices(showVoices));
  langSel.addEventListener('change', () => {
    lang = langSel.value as LangId;
    ls.set('lang', lang);
    render();
  });
  sitSel.addEventListener('change', () => {
    sit = sitSel.value;
    render();
  });
  const sayAll = button('SAY THEM ALL', () => {
    const l = LANGS.find((x) => x.id === lang)!;
    hush();
    let ok = true;
    for (const e of entries()) ok = sayIn(e.word, l.voice, 0.85, true) && ok;
    if (!ok) status.textContent = `This phone has no ${l.name} voice that I can find, so I can show the words but not say them.`;
  });
  const keep = button('KEEP THESE IN MY DECK', async () => {
    ls.set('lang', lang);
    const r = await run('deck', { lang, add: sit });
    status.textContent = r.text || 'My brain didn’t answer, so nothing was kept.';
  });
  const done = button('I SAID THEM ALL', async () => {
    const out = note();
    status.after(out);
    await logIt({ skill: 'words', score: entries().length, unit: sit === 'today' ? 'words' : 'phrases' }, out);
  });
  render();
  showVoices();
  return h('div.pkcol', { dataset: { view: 'words' } }, h('div.pkrow', field('Language', langSel), field('Which', sitSel)), heading, list, h('div.pkrow', named(sayAll, 'Say all of them'), named(keep, 'Keep these in my flashcard deck'), named(done, 'Log that I said them')), status, voices);
}

// ---------------------------------------------------------------- CARDS

interface ReviewData {
  card?: { id: string; en: string; word: string; roman: string };
  due?: number;
  hints?: Record<string, string>;
  voice?: string;
  name?: string;
}
function reviewView(a: Record<string, unknown>): HTMLElement {
  const status = note('Loading your deck…');
  const front = h('div.pkperson', { hidden: true });
  const back = h('div.pkperson', { hidden: true });
  const rates = h('div.pkrow', { hidden: true, role: 'group', 'aria-label': 'How well did you know it?' });
  const showBtn = named(button('SHOW THE ANSWER', () => reveal()), 'Show the answer');
  showBtn.hidden = true;
  let cur: ReviewData | null = null;
  const lang = typeof a.lang === 'string' ? a.lang : '';
  const reveal = () => {
    if (!cur?.card) return;
    const c = cur.card;
    back.replaceChildren(h('b', { lang: cur.voice, dir: cur.voice?.startsWith('ar') ? 'rtl' : 'ltr' }, c.word), c.roman ? h('span.pklab', c.roman) : '', h('div.pkrow', named(button('SAY IT', () => sayIn(c.word, cur?.voice ?? 'es-ES')), `Say ${c.en} in ${cur.name ?? 'the language'}`)));
    back.hidden = false;
    rates.hidden = false;
    showBtn.hidden = true;
    sayIn(c.word, cur.voice ?? 'es-ES');
  };
  const next = async (args: Record<string, unknown>) => {
    const r = await run('review', { ...(lang ? { lang } : {}), ...args });
    const d = (r.data ?? {}) as ReviewData;
    cur = d.card ? d : null;
    back.hidden = true;
    rates.hidden = true;
    if (!d.card) {
      front.hidden = true;
      showBtn.hidden = true;
      status.textContent = r.text || 'My brain didn’t answer, so I can’t read your deck just now.';
      return;
    }
    status.textContent = `${d.due ?? 1} card${d.due === 1 ? '' : 's'} due. ${d.name ?? ''}: say it, then check.`;
    front.replaceChildren(h('span.pklab', `Say this in ${d.name ?? 'the language'}`), h('b', d.card.en));
    front.hidden = false;
    showBtn.hidden = false;
    rates.replaceChildren(...(['again', 'hard', 'good', 'easy'] as const).map((k) => named(button(`${k.toUpperCase()} · ${d.hints?.[k] ?? ''}`, () => void next({ id: d.card!.id, rating: k })), `${k}: it comes back in ${d.hints?.[k] ?? 'a while'}`)));
  };
  void next({});
  return h('div.pkcol', { dataset: { view: 'review' } }, status, front, showBtn, back, rates);
}

// ---------------------------------------------------------------- DRAW

function drawView(a: Record<string, unknown>): HTMLElement {
  let at = Math.max(0, LESSONS.indexOf(lessonFor(ymd(), typeof a.shape === 'string' ? a.shape : '')));
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'pkguide', role: 'img' });
  const guide = svgEl('g', { class: 'g' });
  const mine = svgEl('g', { class: 'm' });
  svg.append(guide, mine);
  const title = h('p.pkcue');
  const tip = note();
  const result = note();
  const logged = note();
  let drawn: Stroke[] = [];
  let cur: Stroke | null = null;
  let curEl: SVGPolylineElement | null = null;
  const pts = (s: Stroke) => s.map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');
  const lesson = () => LESSONS[at]!;
  const paint = () => {
    const l = lesson();
    guide.replaceChildren(...l.strokes.map((s) => svgEl('polyline', { points: pts(s) })));
    mine.replaceChildren();
    drawn = [];
    learnState.strokes = 0;
    learnState.guide = l.id;
    learnState.score = -1;
    title.textContent = `Trace: ${l.title}`;
    tip.textContent = l.tip;
    svg.setAttribute('aria-label', `Drawing canvas. Trace the ${l.title.toLowerCase()} guide with your finger.`);
    result.textContent = '';
    logged.textContent = '';
  };
  const at2 = (e: PointerEvent): [number, number] => {
    const r = svg.getBoundingClientRect();
    return [clamp(((e.clientX - r.left) / Math.max(1, r.width)) * 100, 0, 100), clamp(((e.clientY - r.top) / Math.max(1, r.height)) * 100, 0, 100)];
  };
  svg.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      /* a synthetic pointer */
    }
    cur = [at2(e)];
    curEl = svgEl('polyline', { points: pts(cur) });
    mine.append(curEl);
  });
  svg.addEventListener('pointermove', (e) => {
    if (!cur || !curEl) return;
    cur.push(at2(e));
    curEl.setAttribute('points', pts(cur));
  });
  const end = () => {
    if (cur && cur.length > 1) {
      drawn.push(cur);
      learnState.strokes = drawn.length;
    } else curEl?.remove();
    cur = null;
    curEl = null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  const score = button('SCORE IT', async () => {
    if (!drawn.length) {
      result.textContent = 'Draw over the guide with your finger first, then I can compare.';
      return;
    }
    const o = overlap(lesson().strokes, drawn);
    learnState.score = o.score;
    learnState.result = o.said;
    result.textContent = `${o.said} (simple overlap: you covered ${o.covered}% of the guide, and ${o.onGuide}% of your line was on it.)`;
    await logIt({ skill: 'draw', score: o.score, unit: '% overlap', detail: lesson().id }, logged);
  });
  const clear = button('CLEAR', paint);
  const nextShape = button('NEXT SHAPE', () => {
    at = (at + 1) % LESSONS.length;
    paint();
  });
  paint();
  return h('div.pkcol', { dataset: { view: 'draw' } }, title, tip, svg, h('div.pkrow', named(score, 'Score my drawing'), named(clear, 'Clear my drawing'), named(nextShape, 'Next shape')), result, logged);
}

// ---------------------------------------------------------------- TYPING

function typingView(a: Record<string, unknown>): HTMLElement {
  let passage = '';
  let t0 = 0;
  let finished = false;
  const target = h('p.pkpass');
  const box = h('textarea', { rows: 4, 'aria-label': 'Type the passage here', autocapitalize: 'off', autocomplete: 'off', placeholder: 'The clock starts at your first key' }) as HTMLTextAreaElement;
  box.spellcheck = false;
  const result = note();
  const logged = note();
  const finish = async () => {
    if (finished || !t0) return;
    finished = true;
    const t = typingScore(passage, box.value, performance.now() - t0);
    learnState.score = t.wpm;
    learnState.result = t.said;
    result.textContent = t.said;
    box.readOnly = true;
    if (t.valid) await logIt({ skill: 'typing', score: t.wpm, unit: 'wpm', detail: `${t.accuracy}%` }, logged);
  };
  const load = async (fresh: boolean) => {
    finished = false;
    t0 = 0;
    box.value = '';
    box.readOnly = false;
    result.textContent = '';
    logged.textContent = '';
    const seed = Math.floor(Math.random() * 9973);
    passage = (!fresh && typeof a.passage === 'string' && a.passage) || (await libraryPassage(seed)) || TYPING_LINES[seed % TYPING_LINES.length]!;
    target.textContent = passage;
    target.setAttribute('aria-label', `Type this passage: ${passage}`);
  };
  box.addEventListener('input', () => {
    if (finished) return;
    if (!t0) t0 = performance.now();
    if (asciiText(box.value).length >= asciiText(passage).length) void finish();
  });
  box.addEventListener('paste', (e) => {
    e.preventDefault();
    result.textContent = 'Type it by hand: a paste cannot be timed.';
  });
  void load(false);
  return h(
    'div.pkcol',
    { dataset: { view: 'typing' } },
    note('Type the passage as fast as you can. Speed counts only the right letters, and the clock starts at your first key. It comes from your own library when it has text.'),
    target,
    box,
    h('div.pkrow', named(button('DONE', () => void finish()), 'Finish and score my typing'), named(button('NEW PASSAGE', () => void load(true)), 'A new passage')),
    result,
    logged,
  );
}

// ---------------------------------------------------------------- WRITING

function handView(a: Record<string, unknown>): HTMLElement {
  const line = (typeof a.sentence === 'string' && a.sentence) || HAND_SENTENCES[dayNo(ymd()) % HAND_SENTENCES.length]!;
  const status = note('Write the line on plain paper in dark ink, then photograph it flat in good light. The photo is read on this phone and never leaves it.');
  const read = h('p.pkdoc', { hidden: true });
  const result = note();
  const logged = note();
  const pick = photo('PHOTOGRAPH IT', async (f) => {
    status.textContent = 'Reading it on this phone…';
    try {
      const text = await readText(f, status);
      const l = legibility(line, text.split(/\s+/).filter(Boolean).map((t) => ({ text: t })));
      learnState.score = l.share;
      learnState.result = l.said;
      read.hidden = false;
      read.textContent = text || '(nothing read)';
      status.textContent = 'Read on this phone. What it read:';
      result.textContent = l.said;
      await logIt({ skill: 'hand', score: l.share, unit: '% legible' }, logged);
    } catch (e) {
      status.textContent = `I couldn’t read that photo: ${(e as Error).message}`;
    }
  });
  return h('div.pkcol', { dataset: { view: 'hand' } }, h('p.pkpass', line), status, h('div.pkrow', pick), read, result, logged);
}

// ---------------------------------------------------------------- READING

interface ReadData {
  passage: string;
  frames: { w: string; ms: number }[];
  questions: Question[];
}
function readView(a: Record<string, unknown>): HTMLElement {
  let wpm = clamp(Math.round(Number(a.wpm) || Number(ls.get('wpm')) || 250), 100, 900);
  const speed = h('b', { 'aria-live': 'polite' }, `${wpm} words a minute`);
  const stage = h('div.pkword', { 'aria-hidden': 'true' });
  const plain = h('p.pkpass', { hidden: true });
  const quiz = h('div.pkcol');
  const result = note();
  const logged = note();
  const status = note('Pick a speed, then START. You read a passage one word at a time, then answer three questions about it.');
  let timer = 0;
  const setSpeed = (d: number) => {
    wpm = clamp(wpm + d, 100, 900);
    speed.textContent = `${wpm} words a minute`;
    ls.set('wpm', String(wpm));
  };
  cleanups.push(() => window.clearTimeout(timer));
  const start = async () => {
    window.clearTimeout(timer);
    quiz.replaceChildren();
    result.textContent = '';
    logged.textContent = '';
    plain.hidden = true;
    const seed = Math.floor(Math.random() * 9973);
    status.textContent = 'Getting a passage…';
    const raw = await libraryRaw(seed);
    const r = await run('readfast', { ...(raw ? { text: raw.slice(0, 1500) } : {}), seed, wpm });
    let d = r.data as ReadData | undefined;
    if (!d?.frames?.length) {
      const passage = readingFrom(raw, seed) || READ_PASSAGES[seed % READ_PASSAGES.length]!;
      d = { passage, frames: rsvp(passage, wpm), questions: readQuestions(passage, seed) };
    }
    const data = d;
    status.textContent = `${data.passage.split(' ').length} words at ${wpm} a minute. Eyes on the word.`;
    let i = 0;
    const tick = () => {
      if (i >= data.frames.length) {
        stage.textContent = '';
        status.textContent = 'Now three questions about what you read.';
        ask(data);
        return;
      }
      const f = data.frames[i++]!;
      stage.textContent = f.w;
      timer = later(tick, f.ms);
    };
    tick();
  };
  const ask = (data: ReadData) => {
    const given: number[] = [];
    const rows = data.questions.map((q, qi) => {
      const opts = h('div.pkrow', { role: 'group', 'aria-label': `Question ${qi + 1}` });
      for (const [oi, o] of q.options.entries()) {
        opts.append(
          named(
            button(o, (b) => {
              given[qi] = oi;
              for (const x of opts.querySelectorAll('button')) x.setAttribute('aria-pressed', String(x === b));
              if (given.filter((x) => x !== undefined).length === data.questions.length) void score(data, given);
            }),
            `Question ${qi + 1}: ${o}`,
          ),
        );
      }
      return h('div.pkperson', h('b', q.q), opts);
    });
    quiz.replaceChildren(...rows);
  };
  const score = async (data: ReadData, given: number[]) => {
    const right = comprehension(data.questions, given);
    const said = `${right} of ${data.questions.length} right at ${wpm} words a minute. ${right === 3 ? 'You kept the sense at that speed: try 50 faster.' : right === 2 ? 'Mostly there: stay at this speed once more.' : 'Too fast to keep the sense: slower by 50.'}`;
    result.textContent = said;
    learnState.result = said;
    learnState.score = right;
    plain.textContent = data.passage;
    plain.hidden = false;
    if (right === 3) setSpeed(50);
    else if (right < 2) setSpeed(-50);
    await logIt({ skill: 'readfast', ...(right >= 2 ? { score: wpm } : {}), unit: 'wpm', detail: `${right} of ${data.questions.length}` }, logged);
  };
  return h(
    'div.pkcol',
    { dataset: { view: 'readfast' } },
    status,
    h('div.pkrow', named(button('SLOWER', () => setSpeed(-50)), 'Slower by 50 words a minute'), speed, named(button('FASTER', () => setSpeed(50)), 'Faster by 50 words a minute')),
    h('div.pkrow', named(button('START', () => void start()), 'Start reading')),
    stage,
    quiz,
    result,
    plain,
    logged,
  );
}

// ---------------------------------------------------------------- MEMORY

function memoryView(a: Record<string, unknown>): HTMLElement {
  let kind: MemoryKind = (['number', 'list', 'names'] as const).find((k) => k === a.kind) ?? 'number';
  const kinds = h('div.pkrow', { role: 'group', 'aria-label': 'What to remember' });
  const names = h('textarea', { rows: 3, 'aria-label': 'Names and a cue each, like Priya - red scarf, Tom - tall, Jo - glasses', placeholder: 'Priya - red scarf, Tom - tall, Jo - glasses' }) as HTMLTextAreaElement;
  names.value = ls.get('names');
  const namesField = h('div.pkfield', { hidden: kind !== 'names' }, h('span.pklab', 'Names and a cue you choose for each. I never look at faces or look anyone up. They are kept on this phone only, and sent to your own brain just to set the drill.'), names);
  const show = h('p.pkpass', { hidden: true, 'aria-live': 'polite' });
  const answer = h('input', { type: 'text', 'aria-label': 'Your answer', autocomplete: 'off', hidden: true }) as HTMLInputElement;
  const check = named(button('CHECK', () => void score()), 'Check my answer');
  check.hidden = true;
  const status = note('Pick what to remember and START: look, then cover it and say it back.');
  const result = note();
  const logged = note();
  let drill: MemoryDrill | null = null;
  let timer = 0;
  cleanups.push(() => window.clearTimeout(timer));
  const pick = (k: MemoryKind) => {
    kind = k;
    for (const b of kinds.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.kind === k));
    namesField.hidden = k !== 'names';
  };
  for (const [k, label] of [['number', 'A number'], ['list', 'A list'], ['names', 'Names']] as const) {
    const b = button(label, () => pick(k));
    b.dataset.kind = k;
    b.setAttribute('aria-label', `${label}: what to remember`);
    kinds.append(b);
  }
  pick(kind);
  const start = async () => {
    window.clearTimeout(timer);
    answer.hidden = true;
    check.hidden = true;
    result.textContent = '';
    logged.textContent = '';
    ls.set('names', names.value);
    const r = await run('memory', { kind, seed: Math.floor(Math.random() * 9973), ...(kind === 'names' ? { words: names.value } : {}), ...(typeof a.level === 'number' ? { level: a.level } : {}) });
    const d = (r.data as { drill?: MemoryDrill } | undefined)?.drill;
    if (!d) {
      status.textContent = r.text || 'My brain didn’t answer, so I can’t set the drill just now.';
      return;
    }
    drill = d;
    learnState.level = d.level;
    const items = kind === 'names' ? d.items.map((n, i) => `${n} (${d.cues?.[i] ?? ''})`) : d.items;
    show.hidden = false;
    show.textContent = items.join(kind === 'number' ? ' ' : ', ');
    status.textContent = `Level ${d.level}. Look at it for ${d.seconds} seconds.`;
    timer = later(() => {
      show.textContent = '';
      show.hidden = true;
      answer.hidden = false;
      check.hidden = false;
      answer.value = '';
      status.textContent = kind === 'names' ? 'Now the names, in the order of their cues, with commas between.' : kind === 'list' ? 'Now the words, in any order.' : 'Now the digits, in order.';
      answer.focus();
    }, d.seconds * 1000);
  };
  const score = async () => {
    if (!drill) return;
    const s = memoryScore(drill, answer.value);
    learnState.result = s.said;
    learnState.score = s.right;
    result.textContent = s.said;
    check.hidden = true;
    await logIt({ skill: 'memory', score: s.right, of: s.of, kind, level: drill.level, unit: 'items' }, logged);
  };
  return h('div.pkcol', { dataset: { view: 'memory' } }, kinds, namesField, status, show, answer, h('div.pkrow', named(button('START', () => void start()), 'Start the memory drill'), check), result, logged);
}

// ---------------------------------------------------------------- MATHS

function mathsView(): HTMLElement {
  const status = note('A five-minute drill at your level. Answer each sum and press ENTER; SKIP if you are stuck. It moves you up after two sets of 90%.');
  const q = h('p.pkbig', { 'aria-live': 'off' });
  const clockEl = h('span.pklab', { role: 'timer' });
  const input = h('input', { type: 'text', inputMode: 'numeric', 'aria-label': 'Your answer', autocomplete: 'off', hidden: true }) as HTMLInputElement;
  const result = note();
  const logged = note();
  let timer = 0;
  let sums: { q: string; a: number }[] = [];
  let i = 0;
  let tried = 0;
  let right = 0;
  let level = 1;
  let ends = 0;
  let attempt = 0;
  let live = false;
  cleanups.push(() => window.clearInterval(timer));
  const showSum = () => {
    q.textContent = sums[i] ? `${sums[i]!.q} =` : '';
    input.value = '';
    input.focus();
  };
  const finish = async () => {
    if (!live) return;
    live = false;
    window.clearInterval(timer);
    input.hidden = true;
    q.textContent = '';
    clockEl.textContent = '';
    const said = `${right} of ${tried} right${tried ? ` (${Math.round((right / tried) * 100)}%)` : ''} at level ${level}.`;
    result.textContent = said;
    learnState.result = said;
    learnState.score = right;
    if (tried) await logIt({ skill: 'maths', score: right, of: tried, level, unit: 'right' }, logged);
  };
  const answer = (skip: boolean) => {
    if (!live || !sums[i]) return;
    if (!skip) {
      tried++;
      if (Number(input.value.trim()) === sums[i]!.a && input.value.trim() !== '') right++;
    }
    i++;
    if (i >= sums.length) void finish();
    else showSum();
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      answer(false);
    }
  });
  const start = async () => {
    window.clearInterval(timer);
    result.textContent = '';
    logged.textContent = '';
    const r = await run('maths', { n: 5 });
    level = clamp(Math.round(Number((r.data as { level?: number } | undefined)?.level) || 1), 1, 5);
    learnState.level = level;
    sums = mathsDrill(level, dayNo(ymd()) * 7 + attempt++, 60);
    i = 0;
    tried = 0;
    right = 0;
    live = true;
    ends = Date.now() + 5 * 60_000;
    input.hidden = false;
    status.textContent = `Level ${level}. Five minutes, as many as you can.`;
    showSum();
    const paint = () => {
      const left = Math.max(0, Math.ceil((ends - Date.now()) / 1000));
      clockEl.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left`;
      if (left <= 0) void finish();
    };
    paint();
    timer = window.setInterval(paint, 250);
  };
  return h('div.pkcol', { dataset: { view: 'maths' } }, status, clockEl, q, input, h('div.pkrow', named(button('START', () => void start()), 'Start the five-minute drill'), named(button('SKIP', () => answer(true)), 'Skip this sum'), named(button('STOP', () => void finish()), 'Stop and score the drill')), result, logged);
}

// ---------------------------------------------------------------- SPELLING

interface SpellData {
  due?: number;
  count?: number;
  note?: string;
  word?: { id: string; length: number; first: string };
}
function spellingView(): HTMLElement {
  const status = note('Looking through your latest messages for the words you often misspell…');
  const input = h('input', { type: 'text', 'aria-label': 'Spell the word', autocomplete: 'off', autocapitalize: 'off', hidden: true }) as HTMLInputElement;
  input.spellcheck = false;
  const say = named(button('SAY THE WORD', () => word && sayIn(word, 'en-GB')), 'Say the word again');
  say.hidden = true;
  const check = named(button('CHECK', () => void grade()), 'Check my spelling');
  check.hidden = true;
  let word = '';
  const apply = (d: SpellData | undefined, said: string) => {
    if (!d) {
      status.textContent = said || 'My brain didn’t answer, so I can’t read your spelling list just now.';
      return;
    }
    const lead = d.note ? `${d.note} ` : '';
    if (d.word) {
      word = d.word.id;
      status.textContent = `${lead}${d.due ?? 1} word${d.due === 1 ? '' : 's'} to practise. Listen, then spell it: ${d.word.length} letters, starting with ${d.word.first}.`;
      input.hidden = false;
      check.hidden = false;
      say.hidden = false;
      input.value = '';
      sayIn(word, 'en-GB');
    } else {
      word = '';
      status.textContent = `${lead}${d.count ? 'Nothing is due to practise now.' : 'Nothing kept yet: the words you get wrong in your messages will land here.'}`;
      input.hidden = true;
      check.hidden = true;
      say.hidden = true;
    }
  };
  const grade = async () => {
    if (!word || !input.value.trim()) return;
    const r = await run('spelling', { id: word, answer: input.value });
    learnState.result = r.text;
    apply(r.data as SpellData | undefined, r.text);
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void grade();
    }
  });
  void run('spelling', {}).then((r) => apply(r.data as SpellData | undefined, r.text));
  return h('div.pkcol', { dataset: { view: 'spelling' } }, status, h('div.pkrow', say), input, h('div.pkrow', check));
}

// ---------------------------------------------------------------- FIRST AID

function firstAidView(a: Record<string, unknown>): HTMLElement {
  let sc = scenarioFor(ymd(), typeof a.which === 'string' ? a.which : '');
  const sel = h('select', { 'aria-label': 'Which situation' }, ...FIRST_AID.map((s) => h('option', { value: s.id, selected: s.id === sc.id }, s.title))) as HTMLSelectElement;
  const body = h('div.pkcol');
  const result = note();
  const logged = note();
  const learn = () => {
    body.replaceChildren(h('ol.pklist', ...sc.steps.map((s) => h('li', s))), note('Source: NHS first aid guidance (nhs.uk/conditions/first-aid).'));
    result.textContent = '';
    logged.textContent = '';
  };
  const test = () => {
    const order: number[] = [];
    // the steps in a shuffled order that is the same all day (so a re-open does not reshuffle)
    const idx = sc.steps.map((_, i) => i).sort((x, y) => ((x * 7 + dayNo(ymd())) % 11) - ((y * 7 + dayNo(ymd())) % 11) || x - y);
    if (idx.every((v, i) => v === i)) idx.reverse();
    const buttons = idx.map((si) => {
      const b = button(sc.steps[si]!, () => {
        order.push(si);
        b.disabled = true;
        b.textContent = `${order.length}. ${sc.steps[si]}`;
        if (order.length === sc.steps.length) void finish(order);
      });
      b.setAttribute('aria-label', `Step: ${sc.steps[si]}`);
      return b;
    });
    body.replaceChildren(note('Tap the steps in the order you would do them.'), h('div.pkcol', ...buttons));
    result.textContent = '';
    logged.textContent = '';
  };
  const finish = async (order: number[]) => {
    const r = orderScore(sc, order);
    const said = `${r.right} of ${r.of} steps in the right place.${r.right === r.of ? ' That is the order.' : ` The order is: ${sc.steps.map((s, i) => `${i + 1}. ${s}`).join(' ')}`}`;
    result.textContent = said;
    learnState.result = said;
    learnState.score = r.right;
    await logIt({ skill: 'firstaid', score: Math.round((r.right / r.of) * 100), unit: '% in order', detail: sc.id }, logged);
  };
  sel.addEventListener('change', () => {
    sc = FIRST_AID.find((s) => s.id === sel.value) ?? sc;
    learn();
  });
  learn();
  return h(
    'div.pkcol',
    { dataset: { view: 'firstaid' } },
    note(FIRST_AID_LINE),
    field('Situation', sel),
    h('div.pkrow', named(button('READ THE STEPS', learn), 'Read the steps in order'), named(button('TEST ME', test), 'Test me on the order')),
    body,
    result,
    logged,
  );
}

// ---------------------------------------------------------------- PLAN

interface PlanData {
  plan?: { id: string; skill: string; start: string; minutes: number; days: number };
  plans?: { id: string; skill: string; start: string; minutes: number; days: number }[];
  lines?: string[];
}
function planView(): HTMLElement {
  const status = note('Loading your plans…');
  const list = h('div.pkcol');
  const skill = h('input', { type: 'text', 'aria-label': 'A skill, like guitar, chess or Spanish', placeholder: 'guitar, chess, Spanish…', autocomplete: 'off' }) as HTMLInputElement;
  const minutes = h('input', { type: 'number', inputMode: 'numeric', min: '5', max: '60', value: '10', 'aria-label': 'Minutes a day' }) as HTMLInputElement;
  const logged = note();
  const draw = (plans: NonNullable<PlanData['plans']>, lines?: string[]) => {
    list.replaceChildren(
      ...plans.map((p) =>
        h(
          'div.pkperson',
          { role: 'group', 'aria-label': `${p.skill}: ${p.minutes} minutes a day` },
          h('b', p.skill),
          h('span.pklab', `${p.minutes} minutes a day, from ${p.start}`),
          h('div.pkrow', named(button('I DID TODAY’S', () => void logIt({ skill: p.skill }, logged)), `I did today’s ${p.skill}`), named(button('STOP THIS PLAN', async () => {
            await run('plan', { stop: p.skill });
            await load();
          }), `Stop the ${p.skill} plan`)),
        ),
      ),
      ...(lines ? [h('details.pkdoc', h('summary', 'All 28 days'), h('ol.pklist', ...lines.map((l) => h('li', l))))] : []),
    );
  };
  const load = async () => {
    const r = await run('plan', {});
    const d = (r.data ?? {}) as PlanData;
    const plans = d.plans ?? [];
    status.textContent = plans.length ? r.text : 'No plan yet. Name a skill and I make four weeks of ten minutes a day, with the day’s line in your Brief. It is a plan, not a teacher.';
    draw(plans);
  };
  const make = named(
    button('MAKE MY PLAN', async () => {
      if (!skill.value.trim()) {
        status.textContent = 'Name a skill first.';
        return;
      }
      const r = await run('plan', { skill: skill.value, minutes: Number(minutes.value) || 10 });
      const d = (r.data ?? {}) as PlanData;
      status.textContent = r.text.split('\n')[0] ?? '';
      if (d.plan) {
        const all = await run('plan', {});
        draw(((all.data ?? {}) as PlanData).plans ?? [d.plan], d.lines);
      }
    }),
    'Make my four-week plan',
  );
  void load();
  return h('div.pkcol', { dataset: { view: 'plan' } }, status, list, field('A skill', skill), field('Minutes a day', minutes), h('div.pkrow', make), logged);
}

// ---------------------------------------------------------------- STREAKS

interface Row {
  skill: string;
  name: string;
  count: number;
  streak: number;
  longest: number;
  today: boolean;
  best: number | null;
  unit: string;
}
function progressView(): HTMLElement {
  const status = note('Loading your streaks…');
  const list = h('div.pkcol');
  void run('progress', {}).then((r) => {
    const d = (r.data ?? {}) as { rows?: Row[]; overall?: { current: number; best: number; today: boolean } };
    if (!d.rows?.length) {
      status.textContent = r.text || 'My brain didn’t answer, so I can’t read your streaks just now.';
      return;
    }
    const all = d.overall;
    status.textContent = all ? `Any practice: ${all.current} day${all.current === 1 ? '' : 's'} in a row${all.today ? '' : all.current ? ' (do one today to keep it)' : ''}, longest ${all.best}.` : '';
    list.replaceChildren(
      ...d.rows.map((x) =>
        h(
          'div.pkperson',
          { role: 'group', 'aria-label': `${x.name}: ${x.streak} days in a row, best ${x.best ?? 'none'}` },
          h('b', x.name),
          h('span.pklab', `${x.streak ? `${x.streak} day${x.streak === 1 ? '' : 's'} in a row${x.today ? '' : ' (do one today to keep it)'}` : 'no run right now'} · longest ${x.longest} · ${x.count} session${x.count === 1 ? '' : 's'}${x.best !== null ? ` · best ${x.best}${x.unit ? ` ${x.unit}` : ''}` : ''}`),
        ),
      ),
    );
  });
  return h('div.pkcol', { dataset: { view: 'progress' } }, status, list);
}
