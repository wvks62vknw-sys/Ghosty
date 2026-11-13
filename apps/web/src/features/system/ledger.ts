/**
 * SYSTEM → REPORT CARD → WHAT I LEARNED TO DO (OWNER-ISSUES 65, the capability ledger): what he learned to do this week,
 * in his words — the GYM levels reached and the games new to the GYM, the SCHOOL stage passed, the tools his offline
 * brain gained, the weekly training's exam, the independence meter's movement. The brain writes the lines (GET
 * /api/training/ledger, apps/edge/src/selftrain/ledger.ts) and sends the same as a note on Sunday; the LOOPS card has the
 * numbers. The GYM's levels on this phone go to the brain first, so a level just reached is in it.
 */
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { metaById } from '../../gym/meta';
import { niceCase, panel, type Panel } from '../../ui/components';
import { waiting } from '../../ui/wait';
import { ledgerHead, WAIT } from './words';
import { loadAll } from '../gym/store';

let sending: Promise<void> | null = null;
/** The GYM levels on this phone, with the games' names, to the brain (for the week's puzzles and the ledger); one send at a time. */
export function sendGymLevels(): Promise<void> {
  return (sending ??= (async () => {
    const levels: Record<string, number> = {};
    const names: Record<string, string> = {};
    for (const [id, rec] of await loadAll()) {
      levels[id] = rec.level;
      names[id] = niceCase(metaById(id)?.title ?? id);
    }
    if (Object.keys(levels).length) await brain.selftrain.gym(levels, names);
  })().finally(() => (sending = null)));
}

export function ledgerPanel(): Panel & { refresh(): void } {
  const p = panel('WHAT I LEARNED TO DO', { grow: false, cls: 'ledger' });
  const head = h('div.note.ledhead');
  const list = h('div.ledlines');
  p.body.append(head, list, h('div.note.small', 'Only ever more demanding: a GYM level I reach is kept, and a new brain counts only when it passes its exam. LOOPS has the numbers. On Sunday morning this comes as a note.'));

  const paint = (r: { lines: string[]; since: number } | null) => {
    if (!r) {
      /* state: system.ledger offline */
      head.textContent = 'I can’t reach the brain right now, so I can’t say what I learned this week.';
      p.setStatus('NOT REACHABLE', 'mid');
      clear(list);
      return;
    }
    head.textContent = ledgerHead(r.since, Date.now());
    p.setStatus(r.lines.length ? `${r.lines.length} NEW` : 'NOTHING NEW YET', r.lines.length ? 'ok' : 'off');
    clear(list, ...(r.lines.length ? r.lines.map((l) => h('div.ledline', l)) : [/* state: system.ledger empty */ h('div.note', 'Nothing new yet this week: what I learn to do shows here.')]));
  };

  function refresh(): void {
    void (async () => {
      // (a level reached on this phone since the last look goes in first; an old brain without the ledger is fine)
      /* state: system.ledger loading */
      const done = waiting(p.body, WAIT.ledger);
      await sendGymLevels().catch(() => undefined);
      const got = await brain.selftrain.ledger().catch(() => null);
      done();
      paint(got);
    })();
  }
  return Object.assign(p, { refresh });
}
