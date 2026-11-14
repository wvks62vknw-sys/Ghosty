/**
 * APP MAKER (PLAY & MAKE lane): "make your own app", on THE APP KIT, drawn by the same engine as every Library app.
 *   - his made apps are the kit's own things (ghosty.app.maker), so deleting one goes to Recently deleted, with Undo;
 *   - NEW APP: pick a kind (records, checklist, counter, timer, cards, game), then name it, pick its icon, add fields of
 *     every type, stats and views (or steps, lines, cards, a game's settings);
 *   - DESCRIBE: "make me an app for my vinyl" becomes a first draft (draft.ts fromWords), shown with what was assumed, for
 *     his OK before anything is kept;
 *   - "make my own from this" on any Library app opens a copy of it here (duplicate and change);
 *   - nothing is kept until the engine's validator (validate.ts) finds no problem, said in plain words beside SAVE.
 * The Library reads his apps with `myApps()` and opens one with the engine like any other.
 * Every class is al-, every colour a token; one scroll area (the kit's), notices only through the kit.
 */
import { h, clear } from '../../core/dom';
import { key } from '../../ui/machine';
import { app, type KitApp, type KitItem } from '../../ui/appkit';
import { APP_GLYPHS, GAME_KINDS, type AppDef, type AppGlyph, type FieldType, type GameKind, type Stat, type StatKind } from '../../../../../packages/shared/src/applib/types';
import * as D from '../../../../../packages/shared/src/applib/draft';

const MAKER_ID = 'maker';
type Mine = KitItem & { def: AppDef };

/** His made apps, as AppDefs (for the Library's list and for opening one by name). */
export function myApps(): AppDef[] {
  try {
    const v = JSON.parse(localStorage.getItem(`ghosty.app.${MAKER_ID}`) ?? 'null') as { items?: Mine[] } | null;
    return (v?.items ?? []).map((x) => x.def).filter((d): d is AppDef => !!d && typeof d.id === 'string');
  } catch {
    return [];
  }
}

/** For the spec and the console: what the Maker is doing. */
export const makerState = { editing: '' as string, problems: [] as string[], saved: 0, step: '' as '' | 'list' | 'kind' | 'edit' | 'words' };

export interface MakerOptions {
  /** Ids already in the Library (made apps never take one). */
  taken?: () => string[];
  /** Open an app with the engine (the Library's own open). Without it, the hash #apps/<id> is set. */
  openApp?: (def: AppDef) => void;
  /** Start by copying this Library app (duplicate and change). */
  from?: AppDef;
  /** Start from his words ("make me an app for my vinyl"). */
  words?: string;
}

const itemOf = (d: AppDef): Mine => ({ id: d.id, title: d.name, sub: D.ARCHETYPE_WORDS[d.archetype]?.name ?? d.archetype, meta: d.archetype === 'log' ? `${d.log?.fields.length ?? 0} fields` : '', def: d });

/** Draw App Maker into root. Returns the kit app (and its clean-up via the root being cleared). */
export function openMaker(root: HTMLElement, o: MakerOptions = {}): KitApp {
  const libraryIds = () => o.taken?.() ?? [];
  const sampleDraft = D.fromWords('make me an app for my vinyl', []).def;
  let editing: AppDef | null = null;
  let assumed: string[] = [];
  let ownRender: (() => void) | null = null;
  const k = app(root, {
    id: MAKER_ID,
    name: 'App Maker',
    glyph: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
    noun: ['app', 'apps'],
    sample: [itemOf(sampleDraft)],
    tour: ['This is a sample app, made from the words “an app for my vinyl”.', 'Tap it to change its fields, or make a new one below.', 'Describe lets you say what you want in your own words.'],
    actions: [
      { word: 'New app', run: () => pickKind() },
      { word: 'Describe', run: () => describe() },
    ],
    open: (item) => edit((item as Mine).def ?? sampleDraft),
  });
  const taken = () => [...libraryIds(), ...k.items().map((x) => x.id)];

  /** While a page of the Maker is up, the kit's redraws keep it (the list comes back with BACK). */
  function page(...kids: HTMLElement[]): void {
    if (!ownRender) {
      ownRender = k.render;
      const mine = ownRender;
      k.render = () => {
        mine.call(k);
        if (pageEl.isConnected === false || k.body.firstChild !== pageEl) k.body.replaceChildren(pageEl);
      };
    }
    clear(pageEl, ...kids);
    k.body.replaceChildren(pageEl);
    k.body.scrollTop = 0;
  }
  const pageEl = h('div.al-maker');
  function back(): void {
    editing = null;
    makerState.editing = '';
    makerState.step = 'list';
    if (ownRender) {
      k.render = ownRender;
      ownRender = null;
    }
    k.render();
  }
  const head = (title: string, line?: string) => h('div.al-mkhead', h('b.al-mktitle', title), line ? h('small.al-mkline', line) : null);
  const backKey = () => key('Back', () => back(), { label: 'Back to my apps' });

  // ---- pick a kind
  function pickKind(): void {
    makerState.step = 'kind';
    page(
      head('Make an app', 'Pick what kind of app it is. You can change everything after.'),
      h('div.al-mkkinds', ...D.MAKER_ARCHETYPES.map((a) => {
        const w = D.ARCHETYPE_WORDS[a]!;
        const b = h('button.al-mkkind', { type: 'button' }, h('b', w.name), h('small', w.line));
        b.addEventListener('click', () => edit(D.blank(a, `My ${w.name}`, taken())));
        return b;
      })),
      h('div.al-mkkeys', backKey()),
    );
  }

  // ---- describe it in words
  function describe(prefill = ''): void {
    makerState.step = 'words';
    const box = h('textarea.al-mkinput', { rows: 3, placeholder: 'For example: an app for my vinyl', 'aria-label': 'Describe the app' }) as HTMLTextAreaElement;
    box.value = prefill;
    const go = () => {
      const words = box.value.trim();
      if (!words) return k.notice('Say what the app is for first.');
      draftFrom(words);
    };
    page(head('Describe your app', 'Say what it is for. You will see the draft before anything is kept.'), box, h('div.al-mkkeys', key('Make draft', go, { kind: 'fill' }), backKey()));
    box.focus();
  }
  function draftFrom(words: string): void {
    const r = D.fromWords(words, taken());
    if (r.cannot) {
      k.notice(r.cannot, { tone: 'warn', ms: 8000 });
      return describe(words);
    }
    assumed = r.assumed;
    edit(r.def, true);
  }

  // ---- the editor
  function edit(d: AppDef, fresh = false): void {
    editing = JSON.parse(JSON.stringify(d)) as AppDef;
    makerState.editing = editing.id;
    makerState.step = 'edit';
    if (!fresh) assumed = [];
    draw();
  }
  const set = (d: AppDef) => {
    editing = d;
    draw();
  };

  function draw(): void {
    const d = editing!;
    const exists = k.items().some((x) => x.id === d.id);
    const problems = D.check(d, taken().filter((id) => id !== d.id));
    makerState.problems = problems;
    const name = h('input.al-mkinput', { value: d.name, maxLength: 18, 'aria-label': 'Name', autocapitalize: 'words' }) as HTMLInputElement;
    name.addEventListener('change', () => set(D.rename(d, name.value)));
    const glyph = h('select.al-mkselect', { 'aria-label': 'Icon' }, ...APP_GLYPHS.map((g) => h('option', { value: g, selected: g === d.glyph }, g))) as HTMLSelectElement;
    glyph.addEventListener('change', () => set(D.setGlyph(d, glyph.value as AppGlyph)));
    const parts: HTMLElement[] = [
      head(exists ? 'Change your app' : 'Your new app', D.ARCHETYPE_WORDS[d.archetype]?.line),
      assumed.length ? h('div.al-mkassumed', h('b', 'Made from your words, assuming:'), ...assumed.map((a) => h('small', a))) : h('span'),
      row('Name', name),
      row('Icon', glyph),
      h('p.al-mkpitch', d.pitch),
    ];
    if (d.archetype === 'log' && d.log) parts.push(...logEditor(d));
    if (d.archetype === 'checklist' && d.checklist) parts.push(...linesEditor('Lines, one a line', d.checklist.sections.flatMap((s) => s.items), (lines) => set({ ...d, checklist: { ...d.checklist!, sections: [{ name: d.checklist!.sections[0]?.name ?? d.name, items: lines }] } })), row('Start fresh', choose(['never', 'daily', 'weekly'], d.checklist.repeat, (v) => set({ ...d, checklist: { ...d.checklist!, repeat: v as 'never' } }), { never: 'Never', daily: 'Every day', weekly: 'Every week' })));
    if (d.archetype === 'counter' && d.counter) parts.push(...linesEditor('Names, one a line', d.counter.names, (lines) => set({ ...d, counter: { ...d.counter!, names: lines.slice(0, 12) } })), row('Step', numberBox(d.counter.step, 1, 1000, (v) => set({ ...d, counter: { ...d.counter!, step: v } }))), row('Start again', choose(['never', 'daily', 'weekly'], d.counter.reset, (v) => set({ ...d, counter: { ...d.counter!, reset: v as 'never' } }), { never: 'Never', daily: 'Every day', weekly: 'Every week' })));
    if (d.archetype === 'timer' && d.timer) parts.push(...linesEditor('Steps: a name, then seconds', d.timer.steps.map((s) => `${s.name}, ${s.secs}`), (lines) => set({ ...d, timer: { ...d.timer!, steps: lines.map((l) => { const m = /^(.*?)[,:]\s*(\d+)\s*$/.exec(l); return { name: (m?.[1] ?? l).trim() || 'Step', secs: Math.max(1, Number(m?.[2] ?? 30)) }; }) } })), row('Rounds', numberBox(d.timer.rounds, 1, 99, (v) => set({ ...d, timer: { ...d.timer!, rounds: v } }))));
    if (d.archetype === 'deck' && d.deck) parts.push(...linesEditor('Cards: a question | its answer', d.deck.cards.map((c) => `${c.q} | ${c.a}`), (lines) => set({ ...d, deck: { ...d.deck!, cards: lines.map((l) => { const [q, ...a] = l.split('|'); return { q: (q ?? '').trim(), a: a.join('|').trim() }; }).filter((c) => c.q && c.a) } })), row('Mode', choose(['srs', 'quiz'], d.deck.mode, (v) => set({ ...d, deck: { ...d.deck!, mode: v as 'srs' } }), { srs: 'Spaced repetition', quiz: 'Plain quiz' })));
    if (d.archetype === 'game' && d.game) parts.push(...gameEditor(d));
    parts.push(
      problems.length ? h('div.al-mkproblems', { role: 'status' }, h('b', 'Before it can be kept:'), ...problems.slice(0, 6).map((p) => h('small', cap(p) + '.'))) : h('p.al-mkok', 'Ready to keep.'),
      h('div.al-mkkeys',
        key(exists ? 'Save' : 'Keep it', () => save(), { kind: 'fill' }),
        exists ? key('Open', () => openIt(d)) : h('span'),
        backKey()),
    );
    page(...parts);
  }

  function save(): void {
    const d = editing!;
    const problems = D.check(d, taken().filter((id) => id !== d.id));
    if (problems.length) return k.notice(`Not kept yet: ${problems[0]}.`, { tone: 'warn' });
    const item = itemOf(d);
    if (k.items().some((x) => x.id === d.id)) k.update(d.id, item);
    else k.add(item);
    makerState.saved++;
    assumed = [];
    k.notice(`${d.name} is kept on this phone.`, { tone: 'ok' });
    draw();
  }
  function openIt(d: AppDef): void {
    if (o.openApp) o.openApp(d);
    else location.hash = `apps/${d.id}`;
  }

  // ---- the parts of the editor
  function row(label: string, el: HTMLElement): HTMLElement {
    return h('label.al-mkrow', h('span.al-mklabel', label), el);
  }
  function choose(values: string[], now: string, on: (v: string) => void, words: Record<string, string> = {}): HTMLSelectElement {
    const s = h('select.al-mkselect', ...values.map((v) => h('option', { value: v, selected: v === now }, words[v] ?? v))) as HTMLSelectElement;
    s.addEventListener('change', () => on(s.value));
    return s;
  }
  function numberBox(v: number, lo: number, hi: number, on: (v: number) => void): HTMLInputElement {
    const i = h('input.al-mkinput.al-mknum', { type: 'number', inputMode: 'numeric', value: String(v), min: String(lo), max: String(hi) }) as HTMLInputElement;
    i.addEventListener('change', () => on(Math.min(hi, Math.max(lo, Math.round(Number(i.value) || lo)))));
    return i;
  }
  function linesEditor(label: string, lines: string[], on: (lines: string[]) => void): HTMLElement[] {
    const t = h('textarea.al-mkinput', { rows: Math.min(10, Math.max(3, lines.length + 1)), 'aria-label': label }) as HTMLTextAreaElement;
    t.value = lines.join('\n');
    t.addEventListener('change', () => on(t.value.split('\n').map((x) => x.trim()).filter(Boolean)));
    return [h('span.al-mksection', label), t];
  }

  function logEditor(d: AppDef): HTMLElement[] {
    const log = d.log!;
    const out: HTMLElement[] = [h('span.al-mksection', `Fields (${log.fields.length} of 24)`)];
    for (const f of log.fields) {
      const label = h('input.al-mkinput', { value: f.label, maxLength: 24, 'aria-label': 'Field name' }) as HTMLInputElement;
      label.addEventListener('change', () => set(D.changeField(d, f.id, { label: label.value })));
      const type = choose(D.FIELD_TYPES.map((t) => t.type), f.type, (v) => set(D.changeField(d, f.id, { type: v as FieldType })), Object.fromEntries(D.FIELD_TYPES.map((t) => [t.type, t.name])));
      type.setAttribute('aria-label', `${f.label} type`);
      const kids: HTMLElement[] = [label, type];
      const keys = h('div.al-mkfieldkeys',
        key('↑', () => set(D.moveField(d, f.id, -1)), { label: `Move ${f.label} up` }),
        key('↓', () => set(D.moveField(d, f.id, 1)), { label: `Move ${f.label} down` }),
        key('✕', () => set(D.removeField(d, f.id)), { label: `Remove ${f.label}` }));
      const fieldEl = h('div.al-mkfield', h('div.al-mkfieldmain', ...kids), keys);
      if (f.type === 'choice' || f.type === 'multi') {
        const opts = h('input.al-mkinput', { value: (f.options ?? []).join(', '), 'aria-label': `${f.label} options, split by commas` }) as HTMLInputElement;
        opts.addEventListener('change', () => set(D.changeField(d, f.id, { options: [...new Set(opts.value.split(',').map((x) => x.trim()).filter(Boolean))].slice(0, 12) })));
        fieldEl.append(row('Options', opts));
      }
      if (f.type === 'number') {
        const unit = h('input.al-mkinput', { value: f.unit ?? '', maxLength: 12, 'aria-label': `${f.label} unit`, placeholder: 'e.g. km' }) as HTMLInputElement;
        unit.addEventListener('change', () => set(D.changeField(d, f.id, { unit: unit.value.trim() || undefined })));
        fieldEl.append(row('Unit', unit));
      }
      out.push(fieldEl);
    }
    // add a field
    const newLabel = h('input.al-mkinput', { placeholder: 'New field name', maxLength: 24, 'aria-label': 'New field name' }) as HTMLInputElement;
    const newType = choose(D.FIELD_TYPES.map((t) => t.type), 'text', () => {}, Object.fromEntries(D.FIELD_TYPES.map((t) => [t.type, t.name])));
    out.push(h('div.al-mkadd', newLabel, newType, key('Add field', () => {
      if (log.fields.length >= 24) return k.notice('24 fields is the most an app can have.');
      set(D.addField(d, newLabel.value, newType.value as FieldType));
    })));
    // what each row shows
    const fieldWords = Object.fromEntries(log.fields.map((f) => [f.id, f.label]));
    out.push(row('Each row shows', choose(log.fields.map((f) => f.id), log.fields.some((f) => f.id === log.title) ? log.title : log.fields[0]!.id, (v) => set({ ...d, log: { ...log, title: v } }), fieldWords)));
    // stats
    out.push(h('span.al-mksection', 'Stats'));
    (log.stats ?? []).forEach((s, i) => out.push(h('div.al-mkfield', h('div.al-mkfieldmain', h('b', s.label), h('small.al-mktype', statWords(s))), h('div.al-mkfieldkeys', key('✕', () => set(D.removeStat(d, i)), { label: `Remove ${s.label}` })))));
    const numeric = log.fields.filter((f) => ['number', 'money', 'duration', 'rating', 'scale'].includes(f.type));
    const statKind = choose(['count', ...(numeric.length ? ['sum', 'avg', 'max', 'min'] : []), 'distinct', ...(log.date ? ['streak'] : [])], 'count', () => {}, { count: 'How many', sum: 'Total', avg: 'Average', max: 'Highest', min: 'Lowest', distinct: 'Different', streak: 'Days in a row' });
    const statField = choose(log.fields.map((f) => f.id), numeric[0]?.id ?? log.fields[0]!.id, () => {}, fieldWords);
    out.push(h('div.al-mkadd', statKind, statField, key('Add stat', () => {
      const kind = statKind.value as StatKind;
      const f = log.fields.find((x) => x.id === statField.value)!;
      const words: Record<string, string> = { count: 'Entries', sum: `Total ${f.label.toLowerCase()}`, avg: `Average ${f.label.toLowerCase()}`, max: `Highest ${f.label.toLowerCase()}`, min: `Lowest ${f.label.toLowerCase()}`, distinct: `Different ${f.label.toLowerCase()}`, streak: 'Streak' };
      const s: Stat = kind === 'count' || kind === 'streak' ? { label: words[kind]!, kind } : { label: words[kind]!.slice(0, 24), kind, field: f.id };
      set(D.addStat(d, s));
    })));
    // views
    const can = D.possibleViews(log);
    out.push(h('span.al-mksection', 'Views'));
    out.push(h('div.al-mkviews', ...(['list', 'board', 'calendar', 'gallery'] as const).map((v) => {
      const on = (log.views ?? ['list']).includes(v);
      const b = key(cap(v), () => {
        const now = log.views ?? ['list'];
        set(D.setViews(d, on ? now.filter((x) => x !== v) : [...now, v]));
      }, { label: `${cap(v)} view` });
      b.setAttribute('aria-pressed', String(on));
      if (!can.includes(v)) {
        b.disabled = true;
        b.title = v === 'board' ? 'Needs a choice field' : v === 'calendar' ? 'Needs a date field' : 'Needs a photo field';
      }
      return b;
    })));
    return out;
  }

  function gameEditor(d: AppDef): HTMLElement[] {
    const g = d.game!;
    const out: HTMLElement[] = [row('Game', choose(GAME_KINDS, g.kind, (v) => set(D.setGame(d, v as GameKind, {})), GAME_NAMES))];
    for (const opt of GAME_OPTIONS[g.kind] ?? []) {
      const now = g.options[opt.key];
      let el: HTMLElement;
      if (opt.choices) el = choose(opt.choices, String(now ?? opt.dflt), (v) => set(D.setGame(d, g.kind, { ...g.options, [opt.key]: Number.isNaN(Number(v)) ? v : Number(v) })));
      else if (typeof opt.dflt === 'boolean') el = choose(['yes', 'no'], (now ?? opt.dflt) ? 'yes' : 'no', (v) => set(D.setGame(d, g.kind, { ...g.options, [opt.key]: v === 'yes' })), { yes: 'Yes', no: 'No' });
      else if (Array.isArray(opt.dflt)) {
        out.push(...linesEditor(opt.label, Array.isArray(now) ? (now as string[]) : [], (lines) => set(D.setGame(d, g.kind, { ...g.options, [opt.key]: lines }))));
        continue;
      } else el = numberBox(Number(now ?? opt.dflt), opt.lo ?? 1, opt.hi ?? 999, (v) => set(D.setGame(d, g.kind, { ...g.options, [opt.key]: v })));
      out.push(row(opt.label, el));
    }
    return out;
  }

  if (o.from) edit(D.duplicate(o.from, taken()));
  else if (o.words) draftFrom(o.words);
  else makerState.step = 'list';
  return k;
}

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const statWords = (s: Stat) => ({ count: 'How many', sum: 'Total', avg: 'Average', max: 'Highest', min: 'Lowest', last: 'Latest', streak: 'Days in a row', distinct: 'Different' })[s.kind] + (s.field ? ` of ${s.field}` : '');

const GAME_NAMES: Record<string, string> = {
  sudoku: 'Number place', mines: 'Mines', merge: 'Merge tiles', slide: 'Sliding tiles', pairs: 'Pairs', nonogram: 'Picture logic', wordgrid: 'Word search',
  wordguess: 'Word guess', anagram: 'Anagrams', hangman: 'Letters', reaction: 'Reaction', sprint: 'Sum sprint', typing: 'Typing', simon: 'Sequence',
  lights: 'Lights off', solitaire: 'Patience', snake: 'Snake', blocks: 'Falling blocks', dots: 'Dots and boxes', quiz: 'Quiz',
};

/** Each kind's options, as documented at the top of its games/<kind>.ts (the boards read the same keys). */
export const GAME_OPTIONS: Partial<Record<GameKind, { key: string; label: string; dflt: number | string | boolean | string[]; lo?: number; hi?: number; choices?: string[] }[]>> = {
  sudoku: [{ key: 'difficulty', label: 'Difficulty', dflt: 'medium', choices: ['easy', 'medium', 'hard'] }, { key: 'mistakes', label: 'Mistakes allowed', dflt: 3, lo: 0, hi: 9 }, { key: 'daily', label: 'Daily puzzle', dflt: false }],
  mines: [{ key: 'rows', label: 'Rows', dflt: 12, lo: 6, hi: 24 }, { key: 'cols', label: 'Columns', dflt: 9, lo: 6, hi: 16 }, { key: 'mines', label: 'Mines', dflt: 16, lo: 1, hi: 300 }],
  merge: [{ key: 'size', label: 'Size', dflt: 4, lo: 3, hi: 6 }, { key: 'target', label: 'Winning tile', dflt: '2048', choices: ['512', '1024', '2048', '4096'] }],
  solitaire: [{ key: 'draw', label: 'Cards turned', dflt: '1', choices: ['1', '3'] }],
  wordguess: [{ key: 'tries', label: 'Tries', dflt: 6, lo: 3, hi: 8 }, { key: 'daily', label: 'Daily word', dflt: true }, { key: 'strict', label: 'Only listed words', dflt: false }, { key: 'words', label: 'Your words, one a line', dflt: [] }],
  nonogram: [{ key: 'size', label: 'Size', dflt: 10, lo: 5, hi: 15 }, { key: 'density', label: 'Filled share', dflt: 55, lo: 35, hi: 70 }, { key: 'daily', label: 'Daily picture', dflt: false }],
  pairs: [{ key: 'pairs', label: 'Pairs', dflt: 8, lo: 4, hi: 15 }, { key: 'cols', label: 'Columns', dflt: 4, lo: 2, hi: 6 }],
  blocks: [{ key: 'cols', label: 'Columns', dflt: 10, lo: 8, hi: 12 }, { key: 'rows', label: 'Rows', dflt: 20, lo: 16, hi: 24 }, { key: 'level', label: 'Starting level', dflt: 1, lo: 1, hi: 10 }],
  snake: [{ key: 'size', label: 'Size', dflt: 16, lo: 10, hi: 30 }, { key: 'speed', label: 'Speed', dflt: 7, lo: 4, hi: 15 }, { key: 'wrap', label: 'Wrap round the edges', dflt: false }],
  slide: [{ key: 'size', label: 'Size', dflt: 4, lo: 3, hi: 6 }],
  lights: [{ key: 'size', label: 'Size', dflt: 5, lo: 3, hi: 7 }, { key: 'moves', label: 'Scramble presses', dflt: 10, lo: 3, hi: 25 }],
  simon: [{ key: 'pads', label: 'Pads', dflt: 4, lo: 3, hi: 6 }, { key: 'speed', label: 'Flash in ms', dflt: 520, lo: 250, hi: 900 }],
  reaction: [{ key: 'rounds', label: 'Rounds', dflt: 5, lo: 3, hi: 10 }],
  hangman: [{ key: 'misses', label: 'Misses allowed', dflt: 7, lo: 4, hi: 10 }, { key: 'words', label: 'Your words, one a line', dflt: [] }],
  anagram: [{ key: 'secs', label: 'Seconds', dflt: 90, lo: 30, hi: 300 }, { key: 'words', label: 'Your words, one a line', dflt: [] }],
  typing: [{ key: 'secs', label: 'Seconds', dflt: 60, lo: 15, hi: 300 }, { key: 'passages', label: 'Your passages, one a line', dflt: [] }],
  sprint: [{ key: 'secs', label: 'Seconds', dflt: 60, lo: 30, hi: 180 }, { key: 'max', label: 'Largest number', dflt: 20, lo: 10, hi: 100 }, { key: 'ops', label: 'Sums', dflt: '+-×÷', choices: ['+-', '+-×', '+-×÷', '×÷'] }],
  dots: [{ key: 'size', label: 'Boxes a side', dflt: 4, lo: 2, hi: 6 }, { key: 'cpu', label: 'The phone plays', dflt: 'fair', choices: ['easy', 'fair'] }],
  quiz: [{ key: 'count', label: 'Questions', dflt: 10, lo: 3, hi: 20 }, { key: 'secs', label: 'Seconds each', dflt: 15, lo: 0, hi: 120 }, { key: 'questions', label: 'Question | right | wrong | wrong', dflt: [] }],
  wordgrid: [{ key: 'size', label: 'Size', dflt: 10, lo: 8, hi: 14 }, { key: 'count', label: 'Words', dflt: 8, lo: 4, hi: 12 }, { key: 'diagonal', label: 'Diagonal words', dflt: true }, { key: 'words', label: 'Your words, one a line', dflt: [] }],
};

