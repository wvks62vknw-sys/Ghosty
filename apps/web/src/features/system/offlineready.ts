/**
 * SYSTEM → OFFLINE READY (NEXT ROUND, polish3.u10 with polish3.c4): one number for how much of Ghosty works with no signal right
 * now, the one download that would help most with its size, and each piece: here, its size, or what this phone cannot run.
 * GET IT opens the panel that fetches it; the download itself is still his tap there, on Wi-Fi, with the size said (his rule).
 * Read from what the phone already keeps, so it paints at once and asks nothing of the network.
 */
import { h } from '../../core/dom';
import { offlineBrain } from '../../offline/brain';
import { embedState } from '../../offline/embed';
import { readinessNow } from '../../offline/readiness';
import { readyHead, readyNext, readySay, type Readiness } from '../../offline/readywords';
import { button, panel, row, type Panel } from '../../ui/components';
import { goToPanel } from '../../ui/sections';
import { more } from '../lifeui';

export const READY_TITLE = 'OFFLINE READY';

export function offlineReadyPanel(): Panel & { refresh(): void; now(): Readiness } {
  const p = panel('OFFLINE READY', { grow: false, cls: 'offready' });
  let last: Readiness = readinessNow();
  const paint = () => {
    const r = (last = readinessNow());
    p.setStatus(`${r.pct}%`, r.pct >= 80 ? 'ok' : r.pct >= 40 ? 'mid' : 'off');
    const bar = h('div.ordybar', { role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(r.pct), 'aria-label': readyHead(r) }, h('i', { style: { width: `${r.pct}%` } }));
    const next = h('p.ordynext', { dataset: { case: 'keep' } }, readyNext(r));
    const get = r.next ? button('GET IT IN SETTINGS', () => goToPanel(r.next!.where.tab, r.next!.where.panel), 'on') : null;
    if (get) get.setAttribute('aria-label', `Open ${r.next!.where.panel} in Settings to get ${r.next!.name}, ${r.next!.size}`);
    const rows = [...r.held, ...r.missing, ...r.cannot].map((x) => {
      const k = !x.can ? 'CAN’T' : x.held ? 'HERE' : x.size.toUpperCase();
      const rw = row(k, h('span.ordyv', h('b', x.name), h('small', x.can ? x.gives : (x.why ?? ''))), null, { wrap: true, ...(x.held ? { tone: 'up' as const } : {}) });
      rw.classList.add('ordyrow');
      Object.assign(rw.dataset, { piece: x.id, state: !x.can ? 'cannot' : x.held ? 'here' : 'missing', case: 'keep' });
      return rw;
    });
    p.body.replaceChildren(
      h('p.ordyhead', { dataset: { case: 'keep' } }, h('b', `${r.pct}%`), ' works with no signal'),
      bar,
      next,
      ...(get ? [h('div.keyrow', get)] : []),
      ...rows,
      more('Counted from what is on this phone, each piece by how much of me it carries. ' + 'A download only ever starts on your tap, on Wi-Fi, with its size said first.'),
    );
  };
  paint();
  offlineBrain.subscribe(paint);
  embedState.subscribe(paint);
  addEventListener('storage', (e) => { if (e.key === 'ghosty.pack.kept') paint(); });
  return { ...p, refresh: paint, now: () => last };
}

/** "How ready are you offline?" (assistant/local.ts): the panel opened, and the number, what is here and the next download said. */
export function readyTurn(): string {
  goToPanel('system', READY_TITLE);
  // on a phone the screen is a list: the panel itself is opened (its row tapped), not only its section
  let tries = 0;
  const open = (): void => {
    const head = document.querySelector<HTMLElement>('#pg-system .pn.offready[data-row] > h3');
    if (head && !head.parentElement!.classList.contains('pushed')) head.click();
    else if (!head && ++tries < 10) setTimeout(open, 200);
  };
  setTimeout(open, 250);
  return readySay(readinessNow());
}
