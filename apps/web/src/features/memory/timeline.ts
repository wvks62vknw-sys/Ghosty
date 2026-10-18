/**
 * MEMORY → TIMELINE and PATTERNS (the brain's memories.ts).
 * TIMELINE: everything Ghosty remembers about the owner, newest first — lines about them,
 * saved facts, diary days, lessons — filtered by kind or by words. Each shows where it came
 * from ("You added it", "From your chat on Sat 17 Oct, 14:03 ›" opening that chat, "From the
 * nightly reflection") and can be EDITed, FORGOTten (UNDO for a while after) or LOCKed so the
 * nightly reflection never rewrites or drops it.
 * PATTERNS: things Ghosty noticed by counting what is stored, each with what backs it up;
 * ✕ dismisses one for good.
 */
import type { ForgottenItem, MemoryItem, MemoryPattern } from '../../../../../packages/shared/src/protocol';
import { brain } from '../../api/brain';
import { chat } from '../../assistant/session';
import { clear, h } from '../../core/dom';
import { go } from '../../shell/tabs';
import { button, modal, panel, toast, type Panel } from '../../ui/components';

const KINDS: [string, string][] = [
  ['all', 'Everything'],
  ['profile', 'About you'],
  ['fact', 'Saved facts'],
  ['diary', 'Diary'],
  ['lesson', 'Lessons'],
  ['locked', 'Locked only'],
];

const when = (at: number) => new Date(at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const day = (at: number) => new Date(at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

function tag(m: MemoryItem): string {
  if (m.kind === 'profile') return `ABOUT YOU · ${(m.section ?? 'other').toUpperCase()}`;
  return m.kind === 'fact' ? 'SAVED FACT' : m.kind === 'diary' ? 'DIARY' : 'LESSON';
}

/** The conversation at the owner's message `at` — in the CORE tab's log if this phone still has it, else what they said, in a box. */
export function openChatAt(at: number, quote?: string): void {
  const mine = chat.get().entries.filter((e): e is Extract<typeof e, { kind: 'user' }> => e.kind === 'user');
  // The brain's time for a message and this phone's differ a little: the same words near that time.
  const hit = mine.filter((e) => (!quote || e.text.replace(/\s+/g, ' ').trim().startsWith(quote.slice(0, 60))) && Math.abs(e.at - at) < 10 * 60_000).sort((a, b) => Math.abs(a.at - at) - Math.abs(b.at - at))[0];
  if (hit) {
    go('core');
    setTimeout(() => {
      const hud = document.querySelector('#pg-core .hud.core');
      if (hud && matchMedia('(max-width: 1239px)').matches) hud.classList.add('logopen');
      const el = document.querySelector<HTMLElement>(`#pg-core .log .msg.me[data-at="${hit.at}"]`);
      if (el) {
        el.scrollIntoView({ block: 'center' });
        el.classList.add('found');
        setTimeout(() => el.classList.remove('found'), 2600);
        return;
      }
      showQuote(at, quote);
    }, 60);
    return;
  }
  showQuote(at, quote);
}

function showQuote(at: number, quote?: string): void {
  modal(
    `Your chat · ${when(at)}`,
    h('div.readwrap', h('div.reader', quote ? h('p', h('b', 'You said: '), `“${quote}”`) : null, h('p.note', quote ? 'That part of the conversation is no longer on this phone, so here is what you said.' : 'That conversation is no longer kept: its words have rolled out of the history.'))),
  );
}

/** Where a memory came from, in a line; a chat source is tappable. */
function sourceLine(m: MemoryItem): HTMLElement {
  const s = m.src;
  const edited = m.edited ? ` · edited ${day(m.edited)}` : '';
  if (s.kind === 'owner') return h('div.misrc', `You added it · ${day(s.at)}${edited}`);
  if (s.kind === 'ghosty') return h('div.misrc', `Ghosty learned it from its own work · ${day(s.at)}${edited}`);
  if (s.kind === 'unknown') return h('div.misrc', `Kept before sources were recorded · ${day(s.at)}${edited}`);
  const label = s.kind === 'chat' ? `From your chat on ${when(s.turnAt ?? s.at)}` : s.turnAt ? `From the reflection on your chat of ${when(s.turnAt)}` : `From the reflection · ${day(s.at)}`;
  if (s.kind === 'reflection' && !s.turnAt) return h('div.misrc', `${label}${edited}`);
  const b = h('button.srclink', { type: 'button', title: 'Open that chat' }, `${label} ›`);
  b.addEventListener('click', () => openChatAt(s.turnAt ?? s.at, s.quote));
  return h('div.misrc', b, edited);
}

/** A profile line's id on the brain (memories.ts lineKey): the line in lower case, spaces squeezed. */
export const lineId = (text: string): string => `p:${text.replace(/\s+/g, ' ').trim().toLowerCase()}`;

export function timelinePanel(onChange: () => void): { el: HTMLElement; refresh(): Promise<void>; patterns: MemoryPattern[] } {
  const p: Panel = panel('TIMELINE', { cls: 'tl', status: '' });
  const kindSel = h('select', { 'aria-label': 'Show which memories' }, ...KINDS.map(([v, l]) => h('option', { value: v }, l)));
  const find = h('input', { type: 'search', placeholder: 'Find a memory…', 'aria-label': 'Find a memory' });
  const undoBar = h('div.undo', { role: 'status', hidden: true });
  p.el.insertBefore(h('div.keyrow.wrapit', kindSel, find), p.body);
  p.el.insertBefore(undoBar, p.body);
  // RECENTLY FORGOTTEN: everything forgotten in the last day (here, under ME, in WHAT I REMEMBER, or FORGET EVERYTHING), each with UNDO.
  const forgotBox = h('details.forgot', { hidden: true });
  p.el.insertBefore(forgotBox, p.body);
  let forgotten: ForgottenItem[] = [];
  let items: MemoryItem[] = [];
  let shown = 30;
  let editing = '';
  let undoTimer = 0;
  const state = { el: p.el, refresh, patterns: [] as MemoryPattern[] };

  const change = async (m: MemoryItem, op: 'edit' | 'forget' | 'restore' | 'lock' | 'unlock', text?: string): Promise<boolean> => {
    try {
      const r = await brain.memoryChange(m.id, op, text);
      const i = items.findIndex((x) => x.id === m.id);
      if (r.item && i >= 0) items[i] = r.item;
      else if (r.item) items = [r.item, ...items].sort((a, b) => b.at - a.at);
      else items = items.filter((x) => x.id !== m.id);
      paint();
      onChange();
      if (op === 'forget' || op === 'restore') void refresh();
      return true;
    } catch (e) {
      toast(`Could not ${op === 'restore' ? 'undo' : op} it: ${(e as Error).message}`, 'bad');
      return false;
    }
  };

  const showUndo = (m: MemoryItem) => {
    clearTimeout(undoTimer);
    clear(
      undoBar,
      h('span', `Forgotten: “${m.text.length > 70 ? `${m.text.slice(0, 70)}…` : m.text}”`),
      button('UNDO', async (b) => {
        b.disabled = true;
        if (await change(m, 'restore')) toast('Back in my memory', 'ok');
        undoBar.hidden = true;
      }, 'on'),
    );
    undoBar.hidden = false;
    // The brain keeps a forgotten memory a day for UNDO; the button stays a while.
    undoTimer = window.setTimeout(() => (undoBar.hidden = true), 15_000);
  };

  const row = (m: MemoryItem): HTMLElement => {
    const el = h(`div.mi${m.locked ? '.locked' : ''}` as 'div', { 'data-id': m.id });
    const head = h('div.mih', h('span.k', day(m.at)), h('span.mik', tag(m)), m.locked ? h('span.milock', 'LOCKED') : null);
    if (editing === m.id) {
      const box = h('textarea', { 'aria-label': 'New words for this memory', rows: m.kind === 'diary' ? 6 : 2 });
      box.value = m.text;
      const save = button('SAVE', async (b) => {
        b.disabled = true;
        if (await change(m, 'edit', box.value)) {
          editing = '';
          paint();
          toast('Saved', 'ok');
        } else b.disabled = false;
      }, 'on');
      const cancel = button('CANCEL', () => {
        editing = '';
        paint();
      });
      el.append(head, box, h('div.mia', save, cancel));
      setTimeout(() => box.focus(), 0);
      return el;
    }
    const text = h('div.mit', m.kind === 'diary' && m.text.length > 220 ? `${m.text.slice(0, 220)}…` : m.text);
    if (m.kind === 'diary') text.addEventListener('click', () => modal(`Diary · ${m.id.slice(2)}`, h('div.readwrap', h('div.reader', ...m.text.split(/\n+/).map((x) => h('p', x))))));
    const edit = button('EDIT', () => {
      editing = m.id;
      paint();
    });
    const lock = button(m.locked ? 'UNLOCK' : 'LOCK', async (b) => {
      b.disabled = true;
      if (await change(m, m.locked ? 'unlock' : 'lock')) toast(m.locked ? 'Unlocked: the nightly reflection may update it again' : 'Locked: the nightly reflection will never change or drop it', 'ok');
    }, m.locked ? 'on' : '');
    lock.title = m.locked ? 'Let the nightly reflection update it again' : 'Keep it exactly as it is';
    const forget = button('FORGET', async (b) => {
      b.disabled = true;
      if (await change(m, 'forget')) showUndo(m);
    }, 'warn');
    el.append(head, text, sourceLine(m), h('div.mia', edit, lock, forget));
    return el;
  };

  const ago = (t: number) => {
    const m = Math.max(1, Math.round((Date.now() - t) / 60_000));
    return m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
  };
  function paintForgotten(): void {
    const open = forgotBox.open;
    forgotBox.hidden = !forgotten.length;
    clear(
      forgotBox,
      h('summary', `RECENTLY FORGOTTEN (${forgotten.length}) — UNDO for a day after`),
      ...forgotten.map((f) =>
        h(
          'div.fgi',
          { 'data-id': f.id },
          h('span.fgt', f.text.length > 90 ? `${f.text.slice(0, 90)}…` : f.text),
          h('span.k', ago(f.gone)),
          button('UNDO', async (b) => {
            b.disabled = true;
            try {
              await brain.memoryChange(f.id, 'restore');
              toast('Back in my memory', 'ok');
              onChange();
            } catch (e) {
              toast(`Could not undo it: ${(e as Error).message}`, 'bad');
            }
            void refresh();
          }, 'on'),
        ),
      ),
    );
    forgotBox.open = open;
  }

  function filtered(): MemoryItem[] {
    const k = kindSel.value;
    const q = find.value.trim().toLowerCase();
    return items.filter((m) => (k === 'all' || (k === 'locked' ? m.locked : m.kind === k)) && (!q || m.text.toLowerCase().includes(q)));
  }

  function paint(): void {
    const list = filtered();
    clear(p.body);
    const locked = items.filter((m) => m.locked).length;
    p.setStatus(items.length ? `${items.length} THINGS${locked ? ` · ${locked} LOCKED` : ''}` : 'EMPTY', items.length ? 'ok' : 'mid');
    if (!list.length) {
      p.body.append(h('div.note', items.length ? 'Nothing matches.' : 'Nothing remembered yet. Tell me about yourself in a chat, or add a line under ME.'));
      return;
    }
    for (const m of list.slice(0, shown)) p.body.append(row(m));
    if (list.length > shown)
      p.body.append(
        button(`SHOW ${Math.min(30, list.length - shown)} MORE`, () => {
          shown += 30;
          paint();
        }, 'more'),
      );
  }

  kindSel.addEventListener('change', () => {
    shown = 30;
    paint();
  });
  find.addEventListener('input', () => {
    shown = 30;
    paint();
  });

  async function refresh(): Promise<void> {
    try {
      const r = await brain.memoryTimeline();
      // An older brain (no timeline yet) answers something else: shown as empty, not as a crash.
      items = Array.isArray(r.items) ? r.items : [];
      state.patterns = Array.isArray(r.patterns) ? r.patterns : [];
      forgotten = Array.isArray(r.forgotten) ? r.forgotten : [];
    } catch {
      p.setStatus('OFFLINE', 'off');
      return;
    }
    paintForgotten();
    if (!editing) paint();
  }
  paint();
  return state;
}

export function patternsPanel(): { el: HTMLElement; set(list: MemoryPattern[]): void } {
  const p = panel('PATTERNS', { cls: 'pats', grow: false, status: 'noticed over time' });
  let list: MemoryPattern[] = [];
  const paint = () => {
    clear(p.body);
    p.setStatus(list.length ? `${list.length}` : 'NONE YET', list.length ? 'ok' : 'mid');
    if (!list.length) {
      p.body.append(h('div.note', 'Nothing yet. After a few days of chats I point out what keeps coming up — when you usually talk to me, topics you return to, how you say you feel — always with how often I saw it. Worked out from what is stored in your brain, never guessed.'));
      return;
    }
    for (const pat of list) {
      const x = h('button.del', { type: 'button', title: 'Not useful: hide it', 'aria-label': 'Dismiss this pattern' }, '✕');
      x.addEventListener('click', async () => {
        try {
          list = (await brain.dismissPattern(pat.id)).patterns;
          paint();
          toast('Hidden: I will not point that out again', 'ok');
        } catch (e) {
          toast(`Could not hide it: ${(e as Error).message}`, 'bad');
        }
      });
      p.body.append(h('div.pat', { 'data-id': pat.id }, h('span.pt', pat.text), h('span.pe', `${pat.evidence} ${pat.unit}`), x));
    }
  };
  paint();
  return {
    el: p.el,
    set(l) {
      list = l;
      paint();
    },
  };
}
