/**
 * MY HEALTH WEEK (BRIEF-PACKS-1 item 2): an Apple Health export (export.zip as the Health app makes it, or the export.xml
 * inside) read on this phone, in code, as a stream (./export.ts: never held whole, even at gigabytes). The week's steps and
 * sleep come back as bars and a card; only those numbers go to my brain (to answer "how did I sleep?"). Not medical advice.
 */
import { healthCard, hoursText, NOT_ADVICE, type HealthWeek } from '../../../../../packages/shared/src/body';
import { readExport } from './export';
import { localDay } from '../../../../../packages/shared/src/cadence';
import { h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { timeZone } from '../../state/app';
import { brain } from '../../api/brain';
import { bodyState, type Screen } from './sheet';

export function healthScreen(): Screen {
  const input = h('input', { type: 'file', accept: '.zip,.xml,application/zip,text/xml', 'aria-label': 'Your Apple Health export (export.zip or export.xml)', hidden: true }) as HTMLInputElement;
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'On your iPhone: Health → your picture → Export All Health Data → Save to Files. Then pick it here. It is read on this phone; my brain gets only the week’s numbers.');
  const bars = h('div.pkbars', { role: 'list', 'aria-label': 'The week' });
  const sums = h('div.pkcol');
  let aborted = false;
  const pick = button('Pick the export', () => input.click(), 'on');
  pick.setAttribute('aria-label', 'Pick your Health export');
  input.addEventListener('change', async () => {
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    aborted = false;
    status.textContent = 'Reading… (a big export takes a minute)';
    try {
      const { acc, week } = await readExport(f, localDay(Date.now(), timeZone), (x) => !aborted && (status.textContent = `Reading… ${Math.round(x * 100)}%`));
      bodyState.health = { read: acc.records, avgSteps: week.avgSteps, avgSleep: week.avgSleep };
      paint(week);
      status.textContent = `Read ${acc.records.toLocaleString('en-GB')} records from the last 30 days, here on the phone. ${NOT_ADVICE}`;
      void import('../core/cards').then((m) => m.postCard(healthCard(week))).catch(() => undefined);
      await brain.packDo('body', 'health', { week }).catch(() => toast('Read here, but my brain didn’t answer: ask me later and pick it again.', 'warn'));
    } catch (e) {
      bodyState.error = (e as Error).message;
      status.textContent = `I couldn’t read that: ${(e as Error).message}.`;
    }
  });
  const paint = (w: HealthWeek) => {
    const maxSteps = Math.max(1, ...w.days.map((d) => d.steps ?? 0));
    const maxSleep = Math.max(1, ...w.days.map((d) => d.sleep ?? 0));
    bars.replaceChildren(
      ...w.days.map((d) =>
        h('div.pkbar', { role: 'listitem', 'aria-label': `${d.d}: ${d.steps ?? 'no'} steps, ${d.sleep !== null ? hoursText(d.sleep) : 'no'} sleep` },
          h('i.pkstep', { style: `height:${Math.round(((d.steps ?? 0) / maxSteps) * 100)}%` }),
          h('i.pksleep', { style: `height:${Math.round(((d.sleep ?? 0) / maxSleep) * 100)}%` }),
          h('small', d.d.slice(8))),
      ),
    );
    sums.replaceChildren(
      h('div.pkhero', h('b.pkmid', w.avgSteps !== null ? w.avgSteps.toLocaleString('en-GB') : '—'), h('span.pklab', 'steps a day (the larger of iPhone and Watch)')),
      h('div.pkhero', h('b.pkmid', w.avgSleep !== null ? hoursText(w.avgSleep) : '—'), h('span.pklab', 'asleep a night')),
    );
  };
  const el = h('div.pkcol', input, h('div.pkrow', pick), sums, bars, status);
  return { el, stop: () => void (aborted = true) };
}
