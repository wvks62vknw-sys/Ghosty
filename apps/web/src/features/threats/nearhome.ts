/**
 * THREATS → NEAR HOME (OWNER-ISSUES 55): one row per saved place, what is active there now — the Environment Agency's
 * flood alerts and warnings, the Met Office's weather warnings — with its source and since when, and the latest month of
 * street crime as police.uk publishes it (a count, never a forecast). "Nothing active" when nothing is. The brain looks
 * every hour (apps/edge/src/guardian.ts) and tells him what is new; CHECK NOW looks this minute.
 */
import { brain } from '../../api/brain';
import { guardian, loadGuardian, setGuardian } from '../../state/guardian';
import { clear, h } from '../../core/dom';
import { button, panel, row, toast } from '../../ui/components';
import { clockIn, FEED_NAMES, watchLine, type GuardianInfo, type GuardWarning } from '../../../../../packages/shared/src/guardian';

const SEV: Record<1 | 2 | 3, number> = { 1: 3, 2: 2, 3: 1 };
const month = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return y && m ? new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' }) : ym;
};

export function nearHomePanel(): { el: HTMLElement; refresh(): void } {
  const p = panel('NEAR HOME', { grow: false, cls: 'nearhome', status: 'Checking' });
  const line = h('p.note.watchline', { dataset: { case: 'keep' } });
  const list = h('div.nearlist');
  const feeds = h('p.note.feedsline', { dataset: { case: 'keep' } });
  const check = button('CHECK NOW', async (b) => {
    b.disabled = true;
    try {
      const r = await brain.guardianCheck();
      setGuardian(r);
      toast(r.news.length ? r.news[0]! : r.clear.length ? r.clear[0]! : 'Nothing new near your places', r.news.length ? 'warn' : 'ok');
    } catch {
      toast('I couldn’t look just now: my brain can’t be reached', 'bad');
    } finally {
      b.disabled = false;
    }
  });
  p.body.append(line, list, feeds, h('div.row', check));

  const warn = (w: GuardWarning, tz: string) => {
    const when = w.since > Date.now() ? `from ${clockIn(w.since, tz)}` : w.since ? `since ${clockIn(w.since, tz)}` : '';
    return `${w.title} · ${FEED_NAMES[w.feed].source}${when ? ` · ${when}` : ''}${w.until ? ` · until ${clockIn(w.until, tz)}` : ''}`;
  };

  const paint = (info: GuardianInfo | null) => {
    if (!info) {
      line.textContent = 'Checking…';
      p.setStatus('Checking');
      return;
    }
    line.textContent = watchLine(info);
    const active = info.places.reduce((n, x) => n + x.active.length, 0);
    p.setStatus(!info.places.length ? 'No places' : active ? `${active} active` : 'Quiet', active ? 'mid' : 'ok');
    const rows: HTMLElement[] = [];
    for (const pl of info.places) {
      if (!pl.active.length) rows.push(row(pl.label.toUpperCase(), `Nothing active near ${pl.label}.`, null, { wrap: true }));
      for (const w of pl.active) {
        const r = row(pl.label.toUpperCase(), warn(w, info.tz), null, { wrap: true, sev: SEV[w.level], onClick: w.link ? () => window.open(w.link, '_blank', 'noopener') : undefined });
        r.dataset.feed = w.feed;
        rows.push(r);
      }
      if (pl.crime?.month) {
        const r = row(null, pl.crime.total ? `Street crime near ${pl.label}, ${month(pl.crime.month)}: ${pl.crime.total} reported within a mile — ${pl.crime.top.map(([c, n]) => `${c} ${n}`).join(', ')}. A count as police.uk published it, about two months behind; not a forecast.` : `No street crime reported within a mile of ${pl.label} in ${month(pl.crime.month)} (police.uk).`, null, { wrap: true });
        r.classList.add('crimerow');
        rows.push(r);
      }
    }
    clear(list, ...rows);
    const bits = (['flood', 'weather', 'crime'] as const).map((f) => (info.failed[f] ? `${FEED_NAMES[f].source}: couldn’t be reached` : info.checked[f] ? `${FEED_NAMES[f].source} ${clockIn(info.checked[f]!, info.tz)}` : `${FEED_NAMES[f].source}: not yet`));
    feeds.textContent = `Last looked: ${bits.join(' · ')}.`;
  };

  guardian.subscribe((s) => paint(s.info));
  paint(guardian.get().info);
  return { el: p.el, refresh: () => void loadGuardian() };
}
