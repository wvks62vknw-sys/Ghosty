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
import { register, run } from '../commands/registry';
import { clear, h, icon } from '../core/dom';
import { sfx } from '../assistant/sfx';
import { send } from '../assistant/session';
import { listen, stopListening, voiceSupport } from '../assistant/voice';
import { speechCaps } from '../api/brain';
import { settings, ui } from '../state/app';
import { niceCase, toast } from '../ui/components';
import { revealPanel } from '../ui/sections';
import { navTo } from './areas';
import { DECK, DECK_GROUPS, picksFor, type DeckAct, type DeckLine, type DeckScreen, type TryPick } from './deckcopy';
import { tabs, type TabDef } from './tabs';

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
export const deckState = { open: false, expanded: '', query: '', shown: [] as string[], picks: [] as string[] };

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

const actKind = (a: DeckAct) => ('ask' in a ? 'ask' : 'chat' in a ? 'chat' : 'open');

export function buildLauncher(): Launcher {
  let expanded = '';
  let listening = false;
  const name = h('span.dkname', { dataset: { case: 'keep' } });
  const closeBtn = h('button.dkclose', { type: 'button', 'aria-label': 'Close every screen', onclick: () => close() }, icon(CLOSE));
  const tryRow = h('div.dktrys');
  const tryBox = h('section.dktry', h('div.dkkrow', h('small.dkk', 'Try this now'), h('em', '3 picks for today')), tryRow);
  const hits = h('section.dkhits');
  const groups = h('div.dkgroups');
  const none = h('p.dknone', 'Nothing here by that name. Press return and Ghosty will answer it.');
  const scroller = h('div.dk', { tabindex: '-1' },
    h('header.dkhead',
      h('div.dkht', h('small.dkk', 'Every screen'), h('h2.dktitle', { dataset: { case: 'keep' } }, 'At your service, ', name), h('p.dksub', 'Tap any screen to find out what it can do.')),
      closeBtn,
    ),
    tryBox,
    hits,
    groups,
    none,
  );
  const input = h('input.dkin', { type: 'search', placeholder: 'Go to, or ask…', 'aria-label': 'Go to a screen, or ask Ghosty', enterkeyhint: 'go', autocomplete: 'off', autocapitalize: 'sentences' });
  const mic = h('button.dkmic', { type: 'button', 'aria-label': 'Say it' }, icon(MIC));
  const pill = h('form.dkgo', { role: 'search' }, icon(SEARCH, 'ic dksearch'), input, mic);
  const deck = h('div#deck', { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Every screen' }, scroller, pill);
  deck.addEventListener('click', (e) => e.target === deck && close());
  document.body.append(deck);

  const defs = () => new Map(tabs().filter((t) => !t.hub).map((t) => [t.id, t]));
  const choose = (a: DeckAct) => {
    close(true);
    perform(a);
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
    );
    return b;
  };
  const canRow = (l: DeckLine) =>
    h('button.dkrow', { type: 'button', dataset: { act: actKind(l.act), case: 'keep' }, onclick: () => choose(l.act) },
      h('span', l.text),
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
        c.can.length ? h('div.dkcan', h('small.dkk', 'You can'), ...c.can.map(canRow)) : null,
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
  };

  // ---------- the pill: filter, return, dictate
  type Hit = { t: TabDef; line: DeckLine };
  let found: { cards: TabDef[]; lines: Hit[] } = { cards: [], lines: [] };
  const filter = () => {
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
    none.hidden = !q.length || found.cards.length > 0 || found.lines.length > 0;
    deckState.shown = [...show];
  };
  input.addEventListener('input', filter);
  pill.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const top = found.cards[0];
    if (top) choose({ open: top.id });
    else if (found.lines[0]) choose(found.lines[0].line.act);
    else choose({ ask: text });
  });
  mic.addEventListener('click', async () => {
    if (listening) return stopListening();
    if (!voiceSupport.mic && !voiceSupport.browserStt) return void toast('No microphone access in this browser', 'warn');
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
      toast(String((e as Error)?.message ?? e), 'bad');
    } finally {
      listening = false;
      mic.classList.remove('on');
    }
  });

  const esc = (e: KeyboardEvent) => e.key === 'Escape' && close();
  const open = () => {
    if (deck.classList.contains('on')) return;
    input.value = '';
    expanded = '';
    paint();
    filter();
    deck.classList.add('on');
    document.body.classList.add('decked');
    deckState.open = true;
    addEventListener('keydown', esc);
    sfx('open');
    scroller.scrollTop = 0;
    scroller.focus({ preventScroll: true });
  };
  /** quiet: a screen was chosen, so the tab change makes the sound instead. */
  const close = (quiet = false) => {
    if (!deck.classList.contains('on')) return;
    if (listening) stopListening();
    deck.classList.remove('on');
    document.body.classList.remove('decked');
    deckState.open = false;
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
