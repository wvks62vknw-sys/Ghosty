/**
 * THE INDEPENDENCE METER as he reads it (OWNER-ISSUES 78), in Settings → OFFLINE BRAIN and on the REPORT CARD: how much of
 * the week his own brains answered, in his voice, from the counts kept on this phone (core/independence.ts; the words in
 * packages/shared/src/independence.ts meterLine), with the weeks' trend. And SOVEREIGN MODE — the offline brain on
 * "Always" (OWNER-ISSUES 72: nothing he asks leaves the phone) — with what stopped for want of the cloud, so he sees exactly
 * what still needs it. Shown, it gives the brain the days as counts at most once an hour (never a kept task's, and nothing
 * at all while Sovereign Mode is on).
 */
import { meterLine, ownShare, trendLine, weekOf, weeksOf } from '../../../../../packages/shared/src/independence';
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { brainDays, meter, phoneDay } from '../../core/independence';
import { settings } from '../../state/app';
import { bar, row, spark } from '../../ui/components';

const when = (t: number) => new Date(t).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

export function independenceBlock(): HTMLElement & { paint(): void } {
  const box = h('div.indep');
  const paint = (): void => {
    const s = meter.get();
    const day = phoneDay();
    const w = weekOf(s.days, day);
    const own = ownShare(w);
    const weeks = weeksOf(s.days, day);
    const seen = weeks.filter((x): x is number => x !== null);
    const always = settings.get().offlineBrain === 'always';
    const stopped = s.stopped.filter((x) => Date.now() - x.at < 7 * 86_400_000).reverse();
    clear(
      box,
      h('div.lab', 'YOUR OWN BRAINS'),
      own !== null ? bar('OWN BRAINS', own / 100, `${own}%`) : null,
      h('div.note.indline', meterLine(w)),
      seen.length >= 2 ? h('div.indtrend', h('div.note.small', trendLine(weeks)), spark(seen, 140, 24)) : null,
      h('div.lab', `SOVEREIGN MODE · ${always ? 'ON' : 'OFF'}`),
      h(
        'div.note.indsov',
        always
          ? stopped.length
            ? 'Nothing you ask leaves this phone. What stopped for want of the cloud this week:'
            : 'Nothing you ask leaves this phone, and nothing has stopped for want of the cloud this week.'
          : 'Set Settings → Offline brain → WHEN THE PHONE ANSWERS to Always and nothing you ask leaves this phone: what still needs the cloud is listed here.',
      ),
      ...(always ? stopped.slice(0, 8).map((x) => row(when(x.at), h('span', x.q, h('small.indwhy', ` · ${x.why}`)), null, { wrap: true })) : []),
      h('div.note.small.indhow', 'Counted on this phone, from the line each answer carries. What you ask on Telegram is answered in the cloud and is not counted here yet.'),
    );
  };
  meter.subscribe(paint);
  settings.subscribe((s, prev) => void (s.offlineBrain !== prev.offlineBrain && paint()));
  paint();
  // The brain's copy of the days (counts only), at most once an hour; never while Sovereign Mode keeps everything here.
  if (settings.get().offlineBrain !== 'always') {
    const days = brainDays();
    if (days) void brain.selftrain.meter(days).catch(() => undefined);
  }
  return Object.assign(box, { paint });
}
