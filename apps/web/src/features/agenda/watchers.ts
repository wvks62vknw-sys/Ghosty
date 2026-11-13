/**
 * Agenda → WATCHERS (BRIEF-OCT-IDEAS-2 7): the public pages he asked me to watch ("tell me when this price drops", "…this page
 * changes", "…there's a strike on my line"), with STOP on each. The brain reads them on its hourly beat (the one that reads the
 * warnings for NEAR HOME), compares each with its last reading and tells him ONCE through his notices, so this list is what is
 * waiting, what was told, and what could not be read. A page is added by his words in the chat or by its address here: public
 * pages only, never a login, never a person's page (said in the panel). The brain keeps them: with no signal the list says so.
 */
import { sayError } from '../../ui/hisWords';
import { watcherStands, type WatcherInfo } from '../../../../../packages/shared/src/lifeeasier';
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button, panel, row, toast } from '../../ui/components';
import { more } from '../lifeui';

const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const day = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/** What a spec reads: window.__ghosty.watchers. */
export const watchersState = { count: 0, told: 0, state: 'idle' as 'idle' | 'loading' | 'shown' | 'empty' | 'offline', stopped: 0, ids: [] as string[] };

export function watchersPanel(): { el: HTMLElement; refresh(): Promise<void> } {
  const p = panel('WATCHERS', { grow: false, cls: 'watchers', status: '' });
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.watchers = watchersState;
  const list = h('div.wlist');
  const msg = h('p.note.wmsg', { role: 'status', 'aria-live': 'polite' });
  let items: WatcherInfo[] = [];
  let first = true;

  const stop = async (x: WatcherInfo, b: HTMLButtonElement) => {
    b.disabled = true;
    try {
      const r = await brain.watchersStop(x.id);
      items = r.watchers;
      watchersState.stopped++;
      toast(x.state === 'watching' ? `Stopped watching ${x.label}.` : `Cleared ${x.label} from the list.`, 'ok');
      paint();
    } catch {
      b.disabled = false;
      toast('I couldn’t reach my brain to stop it just now, so it is still on the list. Try again in a moment.', 'warn');
    }
  };

  const paint = () => {
    watchersState.count = items.length;
    watchersState.told = items.filter((x) => x.state === 'told').length;
    watchersState.ids = items.map((x) => x.id);
    watchersState.state = items.length ? 'shown' : 'empty';
    const waiting = items.filter((x) => x.state === 'watching').length;
    p.setStatus(items.length ? `${waiting} WATCHING${items.length > waiting ? ` · ${items.length - waiting} TOLD` : ''}` : 'NOTHING WATCHED', items.length ? 'ok' : 'off');
    clear(
      list,
      ...(items.length
        ? items.map((x) => {
            const b = button('STOP', (btn) => void stop(x, btn), 'wstop');
            b.setAttribute('aria-label', x.state === 'watching' ? `Stop watching ${x.label}` : `Remove ${x.label} from the list`);
            b.dataset.label = 'Stop';
            // the Agenda's own grammar: the time first (when it last looked, or told), the thing, its key last: the same row as a diary line
            const at = x.state === 'told' && x.toldAt ? x.toldAt : x.checked;
            const r = row(at ? clock(at) : '--:--', h('span.wtxt', h('b', x.label), h('small', watcherStands(x, Date.now(), clock, day)), h('small.wurl', x.url.replace(/^https?:\/\//, '').slice(0, 60))), null, { wrap: true });
            r.classList.add('wrow');
            Object.assign(r.dataset, { id: x.id, kind: x.kind, state: x.state, case: 'keep' });
            r.append(b);
            return r;
          })
        : [h('p.note.wempty', { dataset: { case: 'keep' } }, 'Nothing watched. Paste a page’s address below.')]),
    );
  };

  // ADD: a page's address and what to wait for: three keys, each a 44 pt target
  const url = h('input.wurlin', { type: 'url', inputMode: 'url', placeholder: 'https://… the page’s address', 'aria-label': 'The address of a public page to watch', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false' }) as HTMLInputElement;
  const add = async (kind: 'price' | 'page' | 'strike', b: HTMLButtonElement) => {
    const u = url.value.trim();
    if (!u) {
      msg.textContent = 'Paste the page’s address first.';
      url.focus();
      return;
    }
    b.disabled = true;
    msg.textContent = 'Reading the page once, to be sure I can…';
    try {
      const r = await brain.watchersAdd({ kind, url: u });
      msg.textContent = r.said;
      url.value = '';
      await refresh();
    } catch (e) {
      msg.textContent = sayError(e, 'do that');
    } finally {
      b.disabled = false;
    }
  };
  const keys = h(
    'div.row.wrap.wadd',
    ...([['price', 'PRICE DROP'], ['page', 'PAGE CHANGE'], ['strike', 'STRIKE']] as const).map(([k, l]) => {
      const b = button(l, (btn) => void add(k, btn));
      b.setAttribute('aria-label', k === 'price' ? 'Watch this page for a price drop' : k === 'page' ? 'Watch this page for a change' : 'Watch this status page for a strike');
      return b;
    }),
  );
  p.body.append(
    h('p.note', 'I look at each page every hour and tell you once.'),
    more('Public pages only: never a login, never a person’s page. Say “tell me when this price drops” with a page’s address in the chat, or paste one below.'),
    list,
    h('div.lab', 'WATCH A PAGE'),
    url,
    keys,
    msg,
  );

  async function refresh(): Promise<void> {
    if (first) {
      watchersState.state = 'loading';
      p.setStatus('LOOKING…', 'mid');
      clear(list, h('p.note', { dataset: { case: 'keep' } }, 'Looking at my watchers…'));
    }
    try {
      const r = await brain.watchers();
      items = r.watchers;
      first = false;
      paint();
    } catch {
      watchersState.state = 'offline';
      p.setStatus('OFFLINE', 'off');
      if (first || !items.length) clear(list, h('p.note', { dataset: { case: 'keep' } }, 'I can’t reach my brain, so I can’t show my watchers. They keep looking every hour all the same, and tell you when something changes.'));
    }
  }
  return { el: p.el, refresh };
}
