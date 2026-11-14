/**
 * MY HEALTH WEEK (BRIEF-PACKS-1 item 2): an Apple Health export (export.zip as the Health app makes it, or the export.xml
 * inside) read on this phone, in code, as a stream (./export.ts: never held whole, even at gigabytes). The week's steps and
 * sleep come back as bars and a card; only those numbers go to my brain (to answer "how did I sleep?"). Not medical advice.
 */
import { healthCard, hoursText, NOT_ADVICE, type HealthWeek } from '../../../../../packages/shared/src/body';
import { readExport } from './export';
import { localDay } from '../../../../../packages/shared/src/cadence';
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { timeZone } from '../../state/app';
import { brain } from '../../api/brain';
import { bodyState, type Screen } from './sheet';
import { sayError } from '../../ui/hisWords';
import { emptyState, lacksSignal, sizeWords, stateIn, stateLine, waitFor } from '../lifeui';

export function healthScreen(): Screen {
  const input = h('input', { type: 'file', accept: '.zip,.xml,application/zip,text/xml', 'aria-label': 'Your Apple Health export (export.zip or export.xml)', hidden: true }) as HTMLInputElement;
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'In Health, tap your picture, then Export All Health Data, then Save to Files. Then pick it here.');
  /* state: body.health offline */
  const privacy = lacksSignal() ? stateLine('offline', 'No signal needed to read it. My brain gets the week’s numbers when the phone is back online.') : h('p.pknote', 'Read on this phone. My brain gets only the week’s numbers.');
  /* state: body.health empty */
  const none = emptyState('No export read yet', 'Pick the export from the Health app and I show your week.');
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
    status.textContent = 'A big export takes a minute.';
    delete status.dataset.state;
    /* state: body.health loading */
    const done = waitFor(el, `Reading your Health export, ${sizeWords(f.size)}…`);
    try {
      const { acc, week } = await readExport(f, localDay(Date.now(), timeZone), (x) => !aborted && (status.textContent = `${Math.round(x * 100)}% read`));
      done();
      none.remove();
      bodyState.health = { read: acc.records, avgSteps: week.avgSteps, avgSleep: week.avgSleep };
      paint(week);
      // [bodylane] the week's steps and sleep kept on the Steps and Sleep trackers too (never over a day he kept himself)
      void import('./track').then((t) => t.fromHealth(week.days)).catch(() => undefined);
      stateIn(status, '', `Read ${acc.records.toLocaleString('en-GB')} records from the last 30 days, here on the phone. ${NOT_ADVICE}`);
      void import('../core/cards').then((m) => m.postCard(healthCard(week))).catch(() => undefined);
      await brain.packDo('body', 'health', { week }).catch(() => stateIn(status, 'error', 'Read here, but my brain didn’t answer. Pick the export again later.'));
    } catch (e) {
      done();
      bodyState.error = sayError(e, 'read that');
      /* state: body.health error */
      stateIn(status, 'error', sayError(e, 'read that'));
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
      h('div.pkhero', h('b.pkmid', w.avgSteps !== null ? w.avgSteps.toLocaleString('en-GB') : '—'), h('span.pklab', 'steps a day, measured by your iPhone or Watch (the larger of the two)')),
      h('div.pkhero', h('b.pkmid', w.avgSleep !== null ? hoursText(w.avgSleep) : '—'), h('span.pklab', 'asleep a night, from your export')),
    );
  };
  const el = h('div.pkcol', input, h('div.pkrow', pick), none, sums, bars, status, privacy);
  return { el, stop: () => void (aborted = true) };
}
