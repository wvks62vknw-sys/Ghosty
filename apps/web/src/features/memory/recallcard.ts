/**
 * [recall] The RECALL card's rows under a reply answered from the phone's own index (features/memory/recallturn.ts), and the
 * RECALL chip under a reply that says "like you said on Tuesday": each a tap into the turn (the log, or MEMORY's quote when the
 * log no longer has it) or into the thing (its editor). A turn's FORGET takes it out of recall here and on the brain; UNDO
 * brings it back. Every key is 44 pt (the house's `button`).
 */
import { h } from '../../core/dom';
import { openSafe } from '../../core/safeurl';
import { button, modal, toast } from '../../ui/components';
import { forgetTurn, foundState, KIND_WORD, turnFor, undoForgetTurn, type ThingKind } from './recall';
import { LENS_READ_NOTE, EXCHANGE_NO_ANSWER, EXCHANGE_PINNED, EXCHANGE_UNPINNED, TURN_FORGOTTEN } from './words';
import { chat } from '../../assistant/session';
import { navTo } from '../../shell/areas';

type Row = { key: string; kind: string; id: string; title: string; line: string; at: number; stamp: string; day: string; bid?: string };



/** The block a tap landed on: brought to the middle of the screen and lit a moment (the editors draw their blocks with data-id). */
function land(bid: string): void {
  let tries = 0;
  const look = () => {
    const el = document.querySelector<HTMLElement>(`.dcb[data-id="${CSS.escape(bid)}"], .wsblock[data-id="${CSS.escape(bid)}"]`);
    if (!el) return void (++tries < 30 && setTimeout(look, 100));
    el.scrollIntoView({ block: 'center' });
    el.classList.add('found');
    setTimeout(() => el.classList.remove('found'), 2600);
    foundState.landed = true;
  };
  look();
}

/** Open what a row found: a turn in the log, a thing in its own editor at its line. */
export async function openFound(r: Pick<Row, 'kind' | 'at' | 'line' | 'id'> & { bid?: string; stamp?: string; key?: string }, o: { inChat?: boolean } = {}): Promise<void> {
  Object.assign(foundState, { kind: r.kind, id: r.id, bid: r.bid ?? '', landed: false });
  if (r.kind === 'turn' && !o.inChat) return showExchange(r);
  if (r.kind === 'turn') return void import('./timeline').then((m) => m.openChatAt(r.at, r.line));
  if (r.kind === 'doc') await import('../../docs/sheet').then((m) => m.openDocs({ id: r.id }));
  else if (r.kind === 'page') await import('../../workspace/sheet').then((m) => m.openWorkspace({ id: r.id }));
  else if (r.kind === 'deck') {
    // (memory.u9: at the slide: the deck opens where it was last left, so that is set to the slide first)
    if (r.bid) await import('../../slides/store').then((st) => st.keepWhere(r.id, r.bid!));
    await import('../../slides/sheet').then((m) => (r.bid ? m.openSlides() : m.openSlides({ id: r.id })));
    foundState.landed = !!r.bid;
    return;
  } else if (r.kind === 'sheet') {
    // (memory.u9: at the cell: the workbook opens on its kept sheet and selection, so they are set to the match first)
    const at = /^(\d+)!([A-Z]+\d+)$/.exec(r.bid ?? '');
    if (at) {
      const st = await import('../../sheets/store');
      const b = st.getBook(r.id);
      if (b) st.saveBook({ ...b, view: { sheet: Number(at[1]), sel: at[2]! } });
    }
    await import('../../sheets/sheet').then((m) => m.openSheets({ id: r.id }));
    foundState.landed = !!at;
    return;
  }
  else if (r.kind === 'scan') {
    // (memory.s1: what the Lens read, whole, where he is; the photo itself was never kept)
    const all = await import('./recall').then((R) => R.allThings());
    const text = all.filter((x) => x.kind === 'scan' && x.id === r.id).map((x) => x.text).join(' ');
    modal(`Read with the Lens · ${new Date(Number(r.id)).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, h('div.readwrap.exchange', { dataset: { case: 'keep' } }, h('div.reader', h('p', text || r.line), h('p.note', LENS_READ_NOTE))));
  // [security] a link rebuilt from history opens only when it is an ordinary web link (core/safeurl.ts)
  } else if (r.kind === 'link') openSafe(r.id);
  else if (r.kind === 'todo') navTo('agenda', 'push');
  else if (r.kind === 'book') navTo('library', 'push');
  if (r.bid) land(r.bid);
}

/**
 * [recall] memory.u7: a turn found, shown where he is: what he said and what I answered (the whole answer when the log still has it,
 * else its first sentence), with OPEN IN CHAT and PIN (kept past the 30 days, memory.u11).
 */
function showExchange(r: Pick<Row, 'at' | 'line'> & { stamp?: string; key?: string }): void {
  const es = chat.get().entries;
  const i = es.findIndex((e) => e.kind === 'user' && Math.abs(e.at - r.at) < 10 * 60_000 && e.text.replace(/\s+/g, ' ').trim().startsWith(r.line.slice(0, 40)));
  const reply = i >= 0 ? es.slice(i + 1, i + 6).find((e): e is Extract<typeof e, { kind: 'assistant' }> => e.kind === 'assistant') : undefined;
  const said = i >= 0 ? (es[i] as { text: string }).text : r.line;
  void import('./recall').then(async (R) => {
    const thing = (await R.allThings()).find((x) => x.key === (r.key ?? `t:${r.at}`));
    const answerText = reply?.text ?? thing?.a ?? '';
    const pinned = R.isPinned(r.key ?? `t:${r.at}`);
    let m: { close(): void } | null = null;
    const pin = button(pinned ? 'UNPIN' : 'PIN', async (b) => {
      b.disabled = true;
      const now = await R.pinTurn({ key: r.key ?? `t:${r.at}`, at: r.at }, b.textContent === 'PIN');
      b.textContent = now ? 'UNPIN' : 'PIN';
      toast(now ? EXCHANGE_PINNED : EXCHANGE_UNPINNED, 'ok');
      b.disabled = false;
    }, 'recallpin');
    pin.setAttribute('aria-label', 'Keep this chat in recall past 30 days');
    const open = button('OPEN IN CHAT', () => {
      m?.close();
      void import('./timeline').then((t) => t.openChatAt(r.at, r.line));
    }, 'on');
    const body = h('div.readwrap.exchange', { dataset: { case: 'keep' } },
      h('div.reader', h('p', h('b', 'You: '), said), answerText ? h('p', h('b', 'Ghosty: '), answerText) : h('p.note', EXCHANGE_NO_ANSWER)),
      h('div.row.wrap.exkeys', open, pin));
    m = modal(`Your chat · ${r.stamp ?? new Date(r.at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, body);
  });
}

export function recallRows(rows: Row[]): HTMLElement {
  const box = h('div.recallcard', { dataset: { case: 'keep' } });
  for (const r of rows) {
    const what = r.kind === 'turn' ? `${r.stamp}` : `${KIND_WORD[r.kind as ThingKind] ?? 'Thing'} · ${r.title}`;
    const open = button(`${what} — ${r.line.slice(0, 90)}`, () => void openFound(r), 'recallgo');
    open.dataset.case = 'keep';
    open.dataset.key = r.key;
    open.setAttribute('aria-label', `Open ${r.kind === 'turn' ? `the chat of ${r.day}` : r.title}`);
    const row = h('div.row.recallrow', { dataset: { key: r.key, kind: r.kind } }, open);
    if (r.kind === 'turn') {
      const forget = button('FORGET', async (b) => {
        b.disabled = true;
        await forgetTurn(r);
        open.disabled = true;
        open.classList.add('struck');
        toast(TURN_FORGOTTEN, 'ok');
        const undo = button('UNDO', async (u) => {
          u.disabled = true;
          await undoForgetTurn(r);
          open.disabled = false;
          open.classList.remove('struck');
          u.replaceWith(forget);
          forget.disabled = false;
        }, 'recallundo');
        undo.dataset.case = 'keep';
        b.replaceWith(undo);
      }, 'recallforget');
      forget.dataset.case = 'keep';
      forget.setAttribute('aria-label', `Forget the turn of ${r.day}`);
      row.append(forget);
    }
    box.append(row);
  }
  return box;
}

/** The RECALL chip under a reply that says "like you said on Tuesday": filled in once the turn it means is found on this phone. */
export function recallChip(reply: string, at: number): HTMLElement | null {
  if (!/\b(?:like|as) you (?:said|asked|mentioned|told me)\b|\byou (?:said|asked|mentioned|told me)\b.*\b(?:yesterday|last week|on (?:mon|tues|wednes|thurs|fri|satur|sun)day)\b/i.test(reply)) return null;
  const slot = h('div.row.recallchip', { dataset: { case: 'keep' } });
  // the question this reply answered: his message just before it
  const mine = [...chat.get().entries].reverse().find((x): x is Extract<typeof x, { kind: 'user' }> => x.kind === 'user' && x.at <= at);
  const question = mine?.text ?? '';
  void turnFor(reply, question).then((t) => {
    if (!t) return slot.remove();
    const b = button(`RECALL · ${t.day[0]!.toUpperCase()}${t.day.slice(1)}`, () => void openFound(t, { inChat: true }), 'on');
    b.dataset.case = 'keep';
    b.classList.add('recallchipkey');
    b.setAttribute('aria-label', `Open what you said ${t.day}`);
    slot.append(b);
  }).catch(() => slot.remove());
  return slot;
}

/** [keep] The open promises under "what did I say I'd do?": a 44 pt DONE each, with UNDO (the brain keeps them: features/memory/keep.ts). */
export function promiseRows(list: { id: string; what: string; due: string }[]): HTMLElement {
  const box = h('div.recallcard.keepcard', { dataset: { case: 'keep' } });
  for (const p of list) {
    const done = button('DONE', async (b) => {
      b.disabled = true;
      const k = await import('./keep');
      if (await k.changeKeep('done', p.id)) {
        row.classList.add('kept');
        b.replaceWith(h('span.note', 'Done.'));
        toast(`Done: ${p.what}.`, 'ok');
      } else b.disabled = false;
    }, 'on recallforget');
    done.dataset.case = 'keep';
    done.setAttribute('aria-label', `Done: ${p.what}`);
    const row = h('div.row.recallrow', { dataset: { id: p.id, kind: 'promise' } }, h('span.recallgo.keepline', `${p.what}${p.due ? ` · ${p.due}` : ''}`), done);
    box.append(row);
  }
  return box;
}
