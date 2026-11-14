/**
 * Every screen (the owner's pick, 24 Oct: "H with F's pictures and G's information and prompts"; OWNER-ISSUES 33–34):
 * a full-screen deck of compact cards, two to a row under the area kickers, each with its glyph, its name, a
 * promise and one live line (TabDef.now: read from what the phone already holds; the accent for "you are here"
 * and anything due within the hour). Tapping a card opens it in place below its row, one at a time: a miniature
 * of the real screen (public/deck/<id>.jpg, made by tests/deckshots.spec.mjs), the promise, YOU CAN as tappable
 * rows (a deep link into the right screen and mode, or an example said to Ghosty), DID YOU KNOW where there is a
 * true one, and OPEN. TRY THIS NOW offers three picks a day. The "Go to, or ask…" pill filters the cards and the
 * YOU CAN lines as you type; return opens the first match, or asks Ghosty when nothing matches; the microphone
 * dictates into it. The words are in shell/deckcopy.ts.
 *
 * Opens from the avatar's Me sheet ("Every screen"), a long press on the avatar, the GHOSTY logo or the M key.
 * Escape or ✕ closes it.
 */
import { markOfScreen } from '../abilities/health';
import { register, run } from '../commands/registry';
import { clear, h, icon } from '../core/dom';
import { sfx } from '../assistant/sfx';
import { send } from '../assistant/session';
import { thatOne } from '../assistant/thatwords';
import { listen, stopListening, voiceSupport } from '../assistant/voice';
import { speechCaps } from '../api/brain';
import { settings, ui } from '../state/app';
import { empty, niceCase, toast } from '../ui/components';
import { revealPanel } from '../ui/sections';
import { navTo } from './areas';
import { isFavourite, pinOnHold } from './favourites';
import { DECK, DECK_GROUPS, picksFor, type DeckAct, type DeckLine, type DeckScreen, type TryPick } from './deckcopy';
import { tabs, type TabDef } from './tabs';
import { askFromHere, awarenessMark, lookingAt, screenActs, screenContext, setOverlay, stampFacts } from './awareness';
import { houseOn } from './house';
import { guardian } from '../state/guardian';
import { ROOMS, roomOf, thingOf, type Room } from './rooms';
import { atHand, recentIds, starredIds, thingForNumber, thingLine, worksLine } from './inventory';
import { index, stampLine, tag } from '../ui/machine';
import type { ScreenContext } from '../../../../packages/shared/src/awareness';
import { sayError } from '../ui/hisWords';

const SEARCH = '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>';
const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
const CLOSE = '<path d="M7 7l10 10M17 7L7 17"/>';
const DOWN = '<path d="M6 9.5l6 6 6-6"/>';
const RIGHT = '<path d="M9.5 6l6 6-6 6"/>';

/** A line ending "in N min" is due within the hour (TabDef.now). */
const DUE = /· in \d+ min$/;

export interface Launcher {
  open(): void;
  close(): void;
  toggle(): void;
}

/** What the deck shows, for specs and the console (window.__ghosty.deck). */
export const deckState = { open: false, expanded: '', query: '', shown: [] as string[], picks: [] as string[], group: '' };

/**
 * What the deck says while it is open (BRIEF-AWARENESS): it sits over the tab underneath, so for as long as it is up it speaks
 * instead of that tab: what he has typed in its search and the card he has open. Closed, null (the tab's own context counts).
 */
export function deckContext(): ScreenContext | null {
  if (!deckState.open) return null;
  const q = deckState.query.trim();
  const t = deckState.expanded ? tabs().find((x) => x.id === deckState.expanded) : undefined;
  const c = t ? copyOf(t) : null;
  return {
    screen: 'deck',
    title: 'Every screen',
    line: `the deck of every screen${q ? `, searching for '${q.replace(/'/g, '’')}'` : ''}`,
    looking: 'every screen',
    ...(t && c ? { selected: { kind: 'card', id: t.id, label: c.name, ...(c.promise ? { detail: c.promise } : {}) } } : {}),
    at: Date.now(),
  };
}

/** Words for matching: lower case, accents off, split at anything that is not a letter or a digit. */
const words = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
/** Every word typed starts a word of the text ("ag" finds Agenda, not "page"). */
const matches = (q: string[], hay: string[]) => q.every((w) => hay.some((x) => x.startsWith(w)));

/** A screen's words: from deckcopy.ts, or its own title and blurb for a screen added since. */
const copyOf = (t: TabDef): DeckScreen => DECK[t.id] ?? { name: niceCase(t.title), promise: t.blurb ?? '', can: [] };

/** A panel of a screen, found by its title once the screen is drawn: shown (its side on a phone, or pushed as its own screen in a grouped list) and scrolled to. */
function reveal(tab: string, title: string): void {
  let tries = 0;
  const look = () => {
    const root = document.getElementById(`pg-${tab}`);
    const pn = root && [...root.querySelectorAll<HTMLElement>('.pn')].find((p) => (p.querySelector('.ptitle')?.textContent ?? '').toUpperCase().startsWith(title));
    if (!root || !pn) return void (++tries < 16 && setTimeout(look, 250));
    // a screen in sections (ui/sections.ts) shows the section that holds it first
    revealPanel(pn);
    if (pn.matches('.listmode .pn[data-row]')) {
      if (!pn.classList.contains('pushed')) pn.querySelector<HTMLElement>(':scope > h3')?.click();
      return;
    }
    const two = pn.closest<HTMLElement>('.two:not(.stack)');
    if (two && !!pn.closest('.cR') !== two.classList.contains('alt')) two.querySelector<HTMLElement>('.swap')?.click();
    pn.classList.remove('min');
    pn.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };
  setTimeout(look, 350);
}

/** The conversation, open (on a phone the chat sits behind its own button). */
export function openChat(): void {
  askFromHere(); // (the screen he asks from is what "this" means in the question: shell/awareness.ts)
  if (ui.get().tab !== 'core') navTo('core', 'pop');
  setTimeout(() => {
    const hud = document.querySelector('#pg-core .hud.core');
    if (hud && !hud.classList.contains('logopen') && matchMedia('(max-width: 1239px)').matches) document.querySelector<HTMLElement>('.logbtn')?.click();
  }, 120);
}

/** Do what a YOU CAN line, a pick or the pill asks for. */
export function perform(a: DeckAct): void {
  if ('ask' in a) {
    openChat();
    void send(a.ask);
  } else if ('chat' in a) openChat();
  else if ('run' in a) void run(a.run, typeof a.args === 'function' ? a.args() : (a.args ?? {}));
  else {
    navTo(a.open, 'push');
    if (a.panel) reveal(a.open, a.panel);
  }
}

/** The deck's group a screen is in ('' for one that has none). */
const groupOfScreen = (id: string): string => (houseOn() ? roomOf(id.split('?')[0]!)?.key ?? '' : DECK_GROUPS.find(([, ids]) => ids.includes(id.split('?')[0]!))?.[0] ?? '');

const actKind = (a: DeckAct) => ('ask' in a ? 'ask' : 'chat' in a ? 'chat' : 'open');

export function buildLauncher(): Launcher {
  setOverlay('deck', deckContext);
  let expanded = '';
  let listening = false;
  const name = h('span.dkname', { dataset: { case: 'keep' } });
  const closeBtn = h('button.dkclose', { type: 'button', 'aria-label': 'Close every screen', onclick: () => close() }, icon(CLOSE));
  const tryRow = h('div.dktrys');
  const tryBox = h('section.dktry', h('div.dkkrow', h('small.dkk', 'Try this now'), h('em', '3 picks for today')), tryRow);
  const hits = h('section.dkhits');
  const groups = h('div.dkgroups');
  const none = h('p.dknone', 'Nothing here by that name. Press return and I’ll answer it.');
  // [recall] YOUR THINGS (memory lane, memory.s2/u10): three words or more also search his own things on this phone (features/memory/recall.ts)
  const mine = h('section.dkhits.dkmine', { hidden: true, dataset: { case: 'keep' } });
  let mineTimer: ReturnType<typeof setTimeout> | undefined;
  const findMine = (raw: string) => {
    clearTimeout(mineTimer);
    const q = raw.trim();
    if (q.split(/\s+/).length < 3 || q.length < 8) {
      mine.hidden = true;
      return;
    }
    mineTimer = setTimeout(() => void import('../features/memory/recall').then(async (r) => {
      if (!(await r.recallWarm()) || input.value.trim() !== q) return;
      const got = (await r.findLocal(q, { k: 4 })).filter((f) => input.value.trim() === q);
      const { openFound } = await import('../features/memory/recallcard');
      mine.hidden = !got.length;
      clear(mine, ...(got.length ? [h('small.dkk', 'Your things'), h('div.dkhitrows', ...got.map((f) =>
        h('button.dkrow.dkhit', { type: 'button', dataset: { kind: f.kind, case: 'keep' }, onclick: () => { close(true); void openFound(f); } },
          h('span', f.line.slice(0, 90), h('small', f.kind === 'turn' ? f.stamp : `${r.KIND_WORD[f.kind]} · ${f.title}`)))))] : []));
    }).catch(() => undefined), 220);
  };
  // EVERY SCREEN as the Machine's inventory (BRIEF-SHELL-2; deck.png), in The Scan: the stamp line, the name and its way back, then FAVOURITES,
  // RECENT and each room's things with their numbers and one true line; the cards above are Glass's (the CSS shows one set)
  const stamp = stampLine(() => stampFacts(lookingAt(screenContext())));
  guardian.subscribe(() => stamp.refresh());
  const backKey = h('button.dkback', { type: 'button', 'aria-label': 'Back to Me' }, icon('<path d="M15 5l-7 7 7 7"/>'), h('span', 'Me'));
  const head2 = h('header.dkhead2', stamp.el, h('div.dkt2', h('h2.dktitle2', { dataset: { case: 'keep' } }, 'Every screen'), backKey));
  const inv = h('div.dkinv', { dataset: { case: 'keep' } });
  const scroller = h('div.dk', { tabindex: '-1' },
    head2,
    inv,
    h('header.dkhead',
      h('div.dkht', h('small.dkk', 'Every screen'), h('h2.dktitle', { dataset: { case: 'keep' } }, 'At your service, ', name), h('p.dksub', 'Tap any screen to find out what it can do.')),
      closeBtn,
    ),
    tryBox,
    hits,
    mine,
    groups,
    none,
  );
  const input = h('input.dkin', { type: 'search', placeholder: 'Go to, or ask…', 'aria-label': 'Go to a screen, or ask Ghosty', enterkeyhint: 'go', autocomplete: 'off', autocapitalize: 'sentences' });
  const mic = h('button.dkmic', { type: 'button', 'aria-label': 'Say it' }, icon(MIC));
  const pill = h('form.dkgo', { role: 'search' }, icon(SEARCH, 'ic dksearch'), input, mic);
  const deck = h('div#deck', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Every screen' }, scroller, h('div.dkhouse', { 'aria-hidden': 'true' }), pill);
  deck.addEventListener('click', (e) => e.target === deck && close());
  document.body.append(deck);

  // (a screen inside another — THE LOOK, the reader — has no card of its own: its parent's card leads to it)
  const defs = () => new Map(tabs().filter((t) => !t.hub && !t.inside).map((t) => [t.id, t]));
  const choose = (a: DeckAct) => {
    // (where he went from is where it opens next time: the group of the screen he picked)
    close(true, 'open' in a ? groupOfScreen(a.open) : undefined);
    perform(a);
  };
  // "open that one" while a card is open (assistant/thatone.ts): the same as its OPEN button
  screenActs.openCard = (id) => {
    if (!defs().has(id)) return false;
    choose({ open: id });
    return true;
  };

  // ---------- the cards
  const liveOf = (t: TabDef, cur: string): { text: string; hot: boolean } | null => {
    let text = '';
    try {
      text = t.now?.() ?? '';
    } catch {
      text = '';
    }
    const here = t.id === cur;
    if (!text && here) text = 'You are here';
    return text ? { text, hot: here || DUE.test(text) } : null;
  };
  const lookRow = () => {
    const m = awarenessMark();
    return h(`span.dklook${m.state === 'working' ? '' : '.warn'}` as 'span', { dataset: { state: m.state, case: 'keep' } }, m.words);
  };
  const glyph = (t: TabDef) => h('span.dkg', { 'aria-hidden': 'true' }, icon(t.icon));
  const card = (t: TabDef, cur: string) => {
    const c = copyOf(t);
    const live = liveOf(t, cur);
    const b = h(`button.dkcard${t.id === cur ? '.here' : ''}${live?.hot ? '.hot' : ''}` as 'button', {
      type: 'button',
      dataset: { id: t.id, case: 'keep' },
      'aria-expanded': 'false',
      onclick: () => (expanded === t.id ? collapse() : expand(t.id)),
    },
      h('span.dkhd', glyph(t), h('b', c.name), icon(DOWN, 'ic dkmore')),
      h('span.dkpr', c.promise),
      live ? h(`span.dklive${live.hot ? '.hot' : ''}` as 'span', h('i'), live.text) : null,
      // the Core card says what I am looking at (BRIEF-AWARENESS), with the mark: WORKING while my last turn carried the screen
      t.id === 'core' ? lookRow() : null,
      isFavourite(t.id) ? h('i.pinmark', 'PINNED') : null,
    );
    // a long press pins it (FAVOURITES, BRIEF-SHELL); the deck repaints each time it opens, so the mark follows
    pinOnHold(b, t.id);
    if (isFavourite(t.id)) b.dataset.pinned = 'true';
    return b;
  };
  // [health] one word after each line, the mark of the screen's ability (abilities/health.ts): never a colour alone
  const canRow = (l: DeckLine, screen: string) =>
    h('button.dkrow', { type: 'button', dataset: { act: actKind(l.act), case: 'keep' }, onclick: () => choose(l.act) },
      h('span', l.text),
      h('small.g-truth.hmark', { dataset: { case: 'keep', mark: markOfScreen(screen) } }, markOfScreen(screen)),
      'ask' in l.act ? h('small.dkask', 'Ask') : icon(RIGHT, 'ic dkchev'),
    );
  const detail = (t: TabDef) => {
    const c = copyOf(t);
    const img = h('img', { alt: `${c.name}, as it looks`, loading: 'lazy', decoding: 'async', src: `/deck/${t.id}.jpg` });
    const mini = h('span.dkmini', img);
    img.addEventListener('error', () => mini.classList.add('none'), { once: true });
    return h('div.dkx', { id: `dkx-${t.id}`, dataset: { id: t.id }, role: 'region', 'aria-label': `${c.name}: what it can do` },
      mini,
      h('div.dkrt',
        h('span.dkhd', glyph(t), h('b', c.name)),
        h('p.dkpromise', c.promise),
        c.can.length ? h('div.dkcan', h('small.dkk', 'You can'), ...c.can.map((l) => canRow(l, t.id))) : null,
        c.dyk ? h('div.dkdyk', h('b', 'Did you know'), h('span', c.dyk)) : null,
        h('div.dkacts',
          h('button.dkopen', { type: 'button', dataset: { case: 'keep' }, onclick: () => choose({ open: t.id }) }, `Open ${c.name}`),
          h('button.dkless', { type: 'button', 'aria-label': `Close ${c.name}`, onclick: () => collapse() }, icon(DOWN)),
        ),
      ),
    );
  };

  /** One card open at a time, full width, under its row. */
  const expand = (id: string) => {
    const t = defs().get(id);
    const el = groups.querySelector<HTMLElement>(`.dkcard[data-id="${id}"]`);
    if (!t || !el) return;
    collapse(true);
    expanded = id;
    deckState.expanded = id;
    const grid = el.parentElement!;
    const shown = [...grid.querySelectorAll<HTMLElement>('.dkcard')].filter((x) => !x.hidden);
    const i = shown.indexOf(el);
    const after = shown[Math.min(i % 2 ? i : i + 1, shown.length - 1)]!;
    const x = detail(t);
    after.after(x);
    el.classList.add('sel');
    el.setAttribute('aria-expanded', 'true');
    el.setAttribute('aria-controls', x.id);
    sfx('tap');
    requestAnimationFrame(() => x.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  };
  const collapse = (quiet = false) => {
    groups.querySelector('.dkx')?.remove();
    for (const c of groups.querySelectorAll<HTMLElement>('.dkcard.sel')) {
      c.classList.remove('sel');
      c.setAttribute('aria-expanded', 'false');
    }
    if (expanded && !quiet) sfx('close');
    expanded = '';
    deckState.expanded = '';
  };


  // ---------- EVERY SCREEN, the inventory (The Scan)
  const CHEV = '<path d="M9.5 6l6 6-6 6"/>';
  const invRow = (id: string, n: number, name: string, group: string) => {
    const t = tabs().find((x) => x.id === id);
    const works = !!worksLine(id);
    const hot = !!t && DUE.test((() => { try { return t.now?.() ?? ''; } catch { return ''; } })());
    const b = h(`button.invrow${t && t.id === ui.get().tab ? '.here' : ''}${hot ? '.hot' : ''}` as 'button', {
      type: 'button',
      dataset: { id, n: String(n).padStart(2, '0'), group, case: 'keep', ...(isFavourite(id) ? { pinned: 'true' } : {}), ...(works ? { works: 'true' } : {}) },
      'aria-label': `${String(n).padStart(2, '0')} ${name}`,
    }, index(n), h('span.invwords', h('b.invname', name), h('span.invline', thingLine(id))), works ? h('i.invdot', { 'aria-hidden': 'true' }) : null, icon(CHEV, 'ic invchev'));
    b.addEventListener('click', () => {
      if (id === 'origin') return void (close(true), void import('../features/me/origin').then((m) => m.openOrigin()));
      choose({ open: t?.cardTo ?? id });
    });
    if (t) pinOnHold(b, id);
    return b;
  };
  const invSection = (title: string, right: string, rows: HTMLElement[], key: string, count = rows.length) =>
    h('section.invgroup', { dataset: { group: key } }, h('div.invhead', tag(title, { count }), h('span.invsmall', right)), h('div.invrows', ...rows));
  const paintInventory = () => {
    const stars = starredIds();
    const lately = recentIds().slice(0, 4);
    const name = (id: string) => thingOf(id)?.name ?? id;
    const out: HTMLElement[] = [];
    out.push(invSection('Favourites', 'Hold a thing to pin it', stars.length ? stars.map((id, i) => invRow(id, i + 1, name(id), 'favourites')) : [h('div.invnone', empty('NONE', 'Hold any thing to pin it.', 'Nothing pinned yet'))], 'favourites', stars.length));
    out.push(invSection('Recent', 'Newest first', lately.length ? lately.map((id, i) => invRow(id, i + 1, name(id), 'recent')) : [h('div.invnone', empty('NONE', 'The last ones you open wait here.', 'Nothing opened yet'))], 'recent', lately.length));
    for (const r of ROOMS) {
      const rows = r.things.filter((t) => t.id !== 'deck').map((t) => invRow(t.id, t.n, t.name, r.key));
      out.push(invSection(r.title, r.key === 'home' ? 'The hall' : 'A room', rows, r.key));
    }
    clear(inv, ...out);
    stamp.refresh();
  };
  backKey.addEventListener('click', () => {
    close(true);
    if (ui.get().tab !== 'area-me') navTo('area-me', 'switch');
  });

  // ---------- TRY THIS NOW
  const pick = (p: TryPick, all: Map<string, TabDef>) => {
    const t = all.get(p.id);
    if (!t) return null;
    const c = copyOf(t);
    const kind = actKind(p.act);
    return h('button.dkpick', { type: 'button', dataset: { id: p.id, act: kind, case: 'keep' }, onclick: () => choose(p.act) },
      h('small', glyph(t), c.name),
      h('span.dkwords', p.words),
      h('span.dkdo', kind === 'ask' ? 'Ask Ghosty ›' : kind === 'chat' ? 'Open the chat ›' : `Open ${c.name} ›`),
    );
  };

  const paint = () => {
    const cur = ui.get().tab;
    const all = defs();
    name.textContent = settings.get().name; // as typed
    const picks = picksFor().map((p) => pick(p, all)).filter((x): x is HTMLButtonElement => !!x);
    clear(tryRow, ...picks);
    deckState.picks = picks.map((p) => p.dataset.id!);
    const placed = new Set(DECK_GROUPS.flatMap(([, ids]) => ids));
    const list: [string, string[]][] = [...DECK_GROUPS, ['More', [...all.keys()].filter((id) => !placed.has(id))]];
    clear(groups, ...list.map(([g, ids]) => {
      const ts = ids.map((id) => all.get(id)).filter((t): t is TabDef => !!t);
      return ts.length ? h('section.dkgroup', { dataset: { group: g } }, h('h4.dksec', g), h('div.dkgrid', ...ts.map((t) => card(t, cur)))) : null;
    }));
    // (both are drawn; the stylesheet shows the inventory in The Scan and the cards in Glass)
    paintInventory();
  };

  // a pin made while the deck is up shows at once (the cards are drawn again each time it opens)
  const paintPins = () => {
    for (const c of groups.querySelectorAll<HTMLElement>('.dkcard')) {
      const on = isFavourite(c.dataset.id ?? '');
      c.querySelector('.pinmark')?.remove();
      if (on) {
        c.dataset.pinned = 'true';
        c.append(h('i.pinmark', 'PINNED'));
      } else delete c.dataset.pinned;
    }
  };
  settings.subscribe(paintPins);

  // ---------- the pill: filter, return, dictate
  type Hit = { t: TabDef; line: DeckLine };
  let found: { cards: TabDef[]; lines: Hit[] } = { cards: [], lines: [] };
  const filter = () => {
    // "open that one" (BRIEF-AWARENESS): words that point at the open card filter nothing, so the card stays as it is
    if (deckState.expanded && thatOne(input.value.trim())) return;
    const q = words(input.value);
    deckState.query = input.value;
    const all = defs();
    const cards: [TabDef, number][] = [];
    const lines: Hit[] = [];
    for (const t of all.values()) {
      const c = copyOf(t);
      const named = matches(q, words(c.name)) || matches(q, words(t.title));
      if (named || matches(q, words(`${c.name} ${c.promise} ${t.blurb ?? ''} ${c.can.map((l) => l.text).join(' ')}`))) cards.push([t, named ? 0 : 1]);
      if (q.length) for (const line of c.can) if (matches(q, words(line.text))) lines.push({ t, line });
    }
    found = { cards: cards.sort((a, b) => a[1] - b[1]).map(([t]) => t), lines: lines.slice(0, 5) };
    const show = new Set(found.cards.map((t) => t.id));
    for (const c of groups.querySelectorAll<HTMLElement>('.dkcard')) c.hidden = !show.has(c.dataset.id!);
    for (const g of groups.querySelectorAll<HTMLElement>('.dkgroup')) g.hidden = !g.querySelector('.dkcard:not([hidden])');
    if (expanded && !show.has(expanded)) collapse(true);
    tryBox.hidden = q.length > 0;
    hits.hidden = !found.lines.length;
    clear(hits, ...(found.lines.length ? [h('small.dkk', 'You can'), h('div.dkhitrows', ...found.lines.map(({ t, line }) =>
      h('button.dkrow.dkhit', { type: 'button', dataset: { act: actKind(line.act), id: t.id, case: 'keep' }, onclick: () => choose(line.act) },
        glyph(t), h('span', line.text, h('small', copyOf(t).name)), 'ask' in line.act ? h('small.dkask', 'Ask') : icon(RIGHT, 'ic dkchev'))))] : []));
    // The Scan's inventory: a number is the thing it means ("5", "learn 5"); words are the cards the deck found
    const num = houseOn() ? thingForNumber(input.value, 'deck') : null;
    // (a number shows the one thing it means, once, in the first list that holds it)
    let seen = false;
    for (const r of inv.querySelectorAll<HTMLElement>('.invrow')) {
      const mine = num ? r.dataset.id === num.id && !seen : show.has(r.dataset.id!);
      if (num && mine) seen = true;
      r.hidden = q.length > 0 && !mine;
    }
    for (const g of inv.querySelectorAll<HTMLElement>('.invgroup')) g.hidden = q.length > 0 && !g.querySelector('.invrow:not([hidden])');
    none.hidden = !q.length || found.cards.length > 0 || found.lines.length > 0 || !!num;
    deckState.shown = [...show];
  };
  input.addEventListener('input', filter);
  input.addEventListener('input', () => findMine(input.value));
  pill.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    // "open that one" with a card open: said to Ghosty while the deck is still up, so it is the card he means (assistant/thatone.ts)
    if (deckState.expanded && thatOne(text)) {
      input.value = '';
      void send(text);
      return;
    }
    // (a number said or typed opens that screen: "5" is the fifth of his starred and recent, "learn 5" the fifth thing in Learn)
    const num = houseOn() ? thingForNumber(text, 'deck') : null;
    if (num) return num.screen ? choose({ open: defs().get(num.screen)?.cardTo ?? num.screen }) : (close(true), void import('../features/me/origin').then((m) => m.openOrigin()));
    const top = found.cards[0];
    if (top) choose({ open: top.id });
    else if (found.lines[0]) choose(found.lines[0].line.act);
    else choose({ ask: text });
  });
  mic.addEventListener('click', async () => {
    if (listening) return stopListening();
    if (!voiceSupport.mic && !voiceSupport.browserStt) return void toast('This browser won’t let me hear you. Type it instead.', 'warn');
    listening = true;
    mic.classList.add('on');
    try {
      const said = await listen(speechCaps.get().stt, (t) => {
        input.value = t;
        filter();
      });
      if (said) {
        input.value = said;
        filter();
      }
    } catch (e) {
      toast(sayError(e, 'run that'), 'bad');
    } finally {
      listening = false;
      mic.classList.remove('on');
    }
  });

  const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
  const open = () => {
    if (deck.classList.contains('on')) return;
    input.value = '';
    input.placeholder = houseOn() ? 'A number, a word, or a question' : 'Go to, or ask…';
    expanded = '';
    paint();
    filter();
    deck.classList.add('on');
    document.body.classList.add('decked');
    deckState.open = true;
    stamp.refresh();
    dispatchEvent(new Event('ghosty:deck'));
    addEventListener('keydown', esc);
    sfx('open');
    // it opens on the group he left (STARS 163: "the deck remembers where he was"), the first when he has never left one
    const left = settings.get().deckGroup;
    // (in The Scan the groups are the rooms: it opens on the room he left)
    const sec = left ? (houseOn() ? inv : groups).querySelector<HTMLElement>(`.${houseOn() ? 'invgroup' : 'dkgroup'}[data-group="${CSS.escape(left)}"]`) : null;
    scroller.scrollTop = sec ? Math.max(0, sec.offsetTop - scroller.offsetTop - 8) : 0;
    deckState.group = sec ? left : DECK_GROUPS[0]![0];
    scroller.focus({ preventScroll: true });
  };
  /** quiet: a screen was chosen, so the tab change makes the sound instead. */
  const close = (quiet = false, picked?: string) => {
    if (!deck.classList.contains('on')) return;
    if (listening) stopListening();
    // the group he left it on: the screen he picked, else the card open, else the group at the top of what he was reading
    const leftOn = picked || (expanded ? groupOfScreen(expanded) : '') || (() => {
      const top = scroller.scrollTop + scroller.offsetTop + 24;
      let g = '';
      for (const s of (houseOn() ? inv : groups).querySelectorAll<HTMLElement>(houseOn() ? '.invgroup' : '.dkgroup')) if (!s.hidden && s.offsetTop <= top) g = s.dataset.group ?? g;
      return g;
    })();
    if (leftOn && leftOn !== 'More' && leftOn !== 'favourites' && leftOn !== 'recent') settings.set({ deckGroup: leftOn });
    deck.classList.remove('on');
    document.body.classList.remove('decked');
    deckState.open = false;
    dispatchEvent(new Event('ghosty:deck'));
    removeEventListener('keydown', esc);
    input.blur();
    if (!quiet) sfx('close');
  };
  const toggle = () => (deck.classList.contains('on') ? close() : open());
  register({ id: 'open_systems', title: 'Every screen', group: 'SYSTEM', keys: 'm', run: toggle });
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.deck = deckState), true);
  if (!attach()) {
    const t = setInterval(() => attach() && clearInterval(t), 500);
    setTimeout(() => clearInterval(t), 30_000);
  }
  return { open, close: () => close(), toggle };
}
