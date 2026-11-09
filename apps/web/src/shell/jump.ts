/**
 * THE JUMP BAR (BRIEF-SHELL-2; nav-jump.png, nav-typed.png): in The Scan the command palette is what the ask line becomes. The same
 * ranking (commands/rank.ts), the same rows, the same finding test; only the drawing is the Scan's. A tap into the field raises
 * FAVOURITES and RECENT as plates above the keyboard, one tap each; a typed word is the search: `CHECKED HOME · SEE · … · FOUND IN
 * PLAN`, the box locking on the find (`RADIO · 04`) with OPEN and the recognition tone once; words that match no screen are left to
 * go to Ghosty as the question they are (today's path: the "Ask Ghosty" row, which Enter takes when nothing was found). A number
 * ("two", "learn 5") is found as the thing it means where he is. The mic dictates into the field. Glass keeps the palette as it was.
 */
import { clear, h, icon } from '../core/dom';
import { speechCaps } from '../api/brain';
import { listen, stopListening, voiceSupport } from '../assistant/voice';
import { toast } from '../ui/components';
import { index, key, lockBox, recognise, release, truthLine, plate, tag } from '../ui/machine';
import { houseOn } from './house';
import { DECK } from './deckcopy';
import { ROOMS, roomOf, thingOf } from './rooms';
import { roomWord, thingForNumber, worksLine } from './inventory';
import { ui } from '../state/app';
import { jumpOpen, togglePalette, type Command, type JumpCtx } from '../commands/registry';

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
const STAR = '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>';
const CLOCK = '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>';

/** What the jump bar shows, for specs (window.__ghosty.jump). */
export const jumpState = { open: false, found: '', checked: '', locks: 0, listening: false };

let root: HTMLElement | null = null;
let slot: HTMLElement | null = null;
let box: HTMLElement | null = null;
let lastFind = '';

/** The words of a thing's screen id in a command ("tab_radio" → "radio"). */
const screenOf = (c: Command) => (/^tab_/.test(c.id) ? c.id.replace(/^tab_/, '') : '');

function chip(c: Command, i: number, n: number, ctx: JumpCtx, glyph: string | null): HTMLElement {
  const b = h('button.it.jchip', { type: 'button', dataset: { id: c.id, group: c.group ?? '', case: 'keep' }, 'aria-label': `${String(n).padStart(2, '0')} ${c.title}` },
    index(n), h('span', c.title), glyph ? icon(glyph, 'ic jmark') : null);
  b.addEventListener('click', () => ctx.pick(i));
  ctx.hold(c, b);
  return b;
}

/** A group's plate: its tag and count at the left, its small line at the right, its chips under (his FAVOURITES, his RECENT). */
function group(name: string, right: string, rows: [Command, number][], ctx: JumpCtx, glyph: string): HTMLElement {
  return h('section.jgroup', { dataset: { group: name } },
    h('div.jhead', tag(name, { count: rows.length }), h('span.g-truth', right)),
    h('div.jchips', ...rows.map(([c, i], k) => chip(c, i, k + 1, ctx, glyph))));
}

/** A row that is not a screen or a pin: a command, a place, a look (small, one line). */
function row(c: Command, i: number, ctx: JumpCtx, sel: boolean): HTMLElement {
  const b = h(`button.it.jrow${sel ? '.sel' : ''}` as 'button', { type: 'button', dataset: { id: c.id, group: c.group ?? '', case: 'keep' } }, h('small', c.group ?? ''), h('span', c.title.replace(/^Theme: /, '')));
  b.addEventListener('click', () => ctx.pick(i));
  return b;
}

/** The mic: dictates into the field (the deck's way), and the field searches as it hears. */
function wireMic(ctx: JumpCtx): void {
  const prow = ctx.pal.querySelector('.prow');
  if (!prow || prow.querySelector('.jmic')) return;
  const mic = h('button.jmic', { type: 'button', 'aria-label': 'Say it' }, icon(MIC));
  mic.addEventListener('click', async () => {
    if (jumpState.listening) return stopListening();
    if (!voiceSupport.mic && !voiceSupport.browserStt) return void toast('No microphone access in this browser', 'warn');
    jumpState.listening = true;
    mic.classList.add('on');
    const say = (t: string) => {
      ctx.input.value = t;
      ctx.input.dispatchEvent(new Event('input'));
    };
    try {
      const said = await listen(speechCaps.get().stt, say);
      if (said) say(said);
    } catch (e) {
      toast(String((e as Error)?.message ?? e), 'bad');
    } finally {
      jumpState.listening = false;
      mic.classList.remove('on');
    }
  });
  prow.append(mic);
}

/** The jump bar, drawn. Returns the row Enter takes: the find when there is one, else the first row. */
function draw(ctx: JumpCtx): number {
  const { list, items, q } = ctx;
  jumpState.open = true;
  wireMic(ctx);
  if (!root || !list.contains(root)) {
    root = h('div.jroot');
    slot = h('div.jfind');
    box = lockBox(slot);
    clear(list, root);
    lastFind = '';
  }
  const out: HTMLElement[] = [];
  let take = 0;
  if (!q) {
    release(box!);
    lastFind = '';
    jumpState.found = '';
    const pins = items.map((c, i) => [c, i] as [Command, number]).filter(([c]) => c.group === 'FAVOURITES');
    const lately = items.map((c, i) => [c, i] as [Command, number]).filter(([c]) => c.group === 'RECENT');
    if (pins.length) out.push(group('Favourites', 'Hold a thing to pin it', pins, ctx, STAR));
    if (lately.length) out.push(group('Recent', 'Newest first', lately, ctx, CLOCK));
    if (!pins.length && !lately.length) {
      // (first use: nothing pinned and nothing opened yet: say how, and offer the first screens)
      out.push(h('section.jgroup.jempty', { dataset: { group: 'empty' } }, plate({}, h('p.jsay', 'Nothing pinned and nothing opened yet. Hold any thing to pin it; the last ones you open wait here.'))));
      const some = items.map((c, i) => [c, i] as [Command, number]).filter(([c]) => c.group === 'GO').slice(0, 6);
      if (some.length) out.push(group('Screens', 'Say a word, or a number', some, ctx, ''));
    }
    jumpState.checked = '';
    clear(root, ...out);
    return 0;
  }
  // a number said or typed is the thing it means where he is ("two" in a room)
  const num = thingForNumber(q, ui.get().tab);
  const hit = num?.screen ? items.findIndex((c) => c.id === `tab_${num.screen}`) : -1;
  // the find: the first screen ranked (the bar's own order); else the first row that is not a question to me
  let at = hit >= 0 ? hit : items.findIndex((c) => !!screenOf(c));
  if (at < 0) at = items.findIndex((c) => c.group !== 'ASK');
  const find = at >= 0 ? items[at]! : null;
  const sc = find ? screenOf(find) : '';
  const thing = sc ? thingOf(sc) : undefined;
  const room = sc ? roomOf(sc) : undefined;
  const rest = items.map((c, i) => [c, i] as [Command, number]).filter(([c, i]) => i !== at && c.group !== 'ASK').slice(0, 4);
  const ask = items.findIndex((c) => c.group === 'ASK');
  if (find) {
    // CHECKED HOME · SEE · … · FOUND IN PLAN (the rooms in the house's order, up to the one it is in)
    const ri = room ? ROOMS.indexOf(room) : -1;
    const checked = ri > 0 ? ROOMS.slice(0, ri).map((r) => r.title) : [];
    const parts: Parameters<typeof truthLine>[0] = [...(checked.length ? [`Checked ${checked[0]!.toLowerCase()}`, ...checked.slice(1).map((x) => x.toLowerCase())] : []), { text: room ? `Found in ${room.title.toLowerCase()}` : 'Found', tone: 'on' }];
    jumpState.checked = checked.join(' · ');
    const name = find.title;
    const sub = sc ? `In ${roomWord(sc)} · ${DECK[sc]?.promise || ''}` : find.group ?? '';
    const open = key(sc ? 'Open' : 'Run', () => ctx.pick(at!), { kind: 'fill', label: `${sc ? 'Open' : 'Run'} ${name}` });
    open.dataset.act = 'open';
    const works = sc ? worksLine(sc) : '';
    const p = h('div.jplate', { dataset: { id: find.id, screen: sc, n: thing ? String(thing.n) : '' } },
      thing ? index(thing.n, { on: true }) : h('span.g-index', '·'),
      h('div.jwords', h('b.jname', { dataset: { case: 'keep' } }, name), h('span.jsub', { dataset: { case: 'keep' } }, sub), works ? h('span.jworks', 'In the works') : null),
      open);
    p.addEventListener('click', (e) => !(e.target as HTMLElement).closest('button') && ctx.pick(at!));
    slot!.querySelector('.jplate')?.remove();
    slot!.prepend(p);
    out.push(h('p.jchecked.g-truth', { dataset: { case: 'keep', checked: jumpState.checked } }, ...truthLine(parts).childNodes), slot!);
    // the box locks on the find, with the tone, once for each thing found
    const id = find.id;
    jumpState.found = `${name}${thing ? ` · ${String(thing.n).padStart(2, '0')}` : ''}`;
    if (id !== lastFind) {
      lastFind = id;
      requestAnimationFrame(() => void recognise(box!, p, { name, again: true, onLock: () => (jumpState.locks += 1) }));
    } else requestAnimationFrame(() => void recognise(box!, p, { name }));
    take = at;
  } else {
    release(box!);
    lastFind = '';
    jumpState.found = '';
    jumpState.checked = ROOMS.map((r) => r.title).join(' · ');
    out.push(h('p.jchecked.g-truth', { dataset: { case: 'keep', checked: jumpState.checked } }, ...truthLine(['Checked home', ...ROOMS.slice(1).map((r) => r.title.toLowerCase()), { text: 'Nothing found', tone: 'warn' }]).childNodes));
    take = ask >= 0 ? ask : 0;
  }
  if (rest.length) out.push(h('div.jrows', ...rest.map(([c, i]) => row(c, i, ctx, false))));
  // (what he typed, said to me as the question it is: the way today's path takes it)
  if (ask >= 0) {
    const a = h(`button.it.jask.${find ? 'second' : 'only'}` as 'button', { type: 'button', dataset: { id: items[ask]!.id, case: 'keep' } }, h('b', q), h('span', `Or ask me: “${q.length > 24 ? `${q.slice(0, 24)}…` : `${q}...`}” goes to me as a question`));
    a.addEventListener('click', () => ctx.pick(ask));
    out.push(a);
  }
  clear(root!, ...out);
  return take;
}

/** The jump bar from the mic key: opens and listens. */
export function openWithMic(): void {
  if (!jumpOpen()) togglePalette();
  setTimeout(() => document.querySelector<HTMLElement>('#palette .jmic')?.click(), 60);
}

export const jump = {
  on: houseOn,
  draw,
};

const w = window as unknown as { __ghosty?: Record<string, unknown> };
const attach = (n = 0) => (w.__ghosty ? (w.__ghosty.jump = jumpState) : n < 150 && setTimeout(() => attach(n + 1), 100));
attach();
