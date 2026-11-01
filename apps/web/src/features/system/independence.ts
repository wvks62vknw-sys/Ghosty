/**
 * THE INDEPENDENCE METER as he reads it (OWNER-ISSUES 78), in Settings → OFFLINE BRAIN and on the REPORT CARD: how much of
 * the week his own brains answered, in his voice, from the counts kept on this phone (core/independence.ts; the words in
 * packages/shared/src/independence.ts meterLine), with the weeks' trend. And SOVEREIGN MODE — the offline brain on
 * "Always" (OWNER-ISSUES 72: nothing he asks leaves the phone) — with what stopped for want of the cloud, so he sees exactly
 * what still needs it. Shown, it gives the brain the days as counts at most once an hour (never a kept task's, and nothing
 * at all while Sovereign Mode is on).
 * [offline2] THE INDEPENDENCE SHEET (SYSTEM → INDEPENDENCE; "how independent are you?", BRIEF-OFFLINE-DEFAULT part 2):
 * the same block, and around it the last seven and thirty days in full, each kind of ask (offline/trust.ts) with how much
 * of it stayed on the phone and, for the kinds still the cloud's, why (no brain sits here; under the bar; needs a tool),
 * the brain sitting here (a trained week said as its week), SOVEREIGN MODE's truth, and the one honest ceiling, said once.
 * And the Brief's weekly line (`briefIndependence`), when a brain sits on the phone.
 */
import { meterLine, ownShare, trendLine, weekOf, weeksOf } from '../../../../../packages/shared/src/independence';
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { goToPanel } from '../../ui/sections';
import { brainDays, meter, phoneDay } from '../../core/independence';
import { settings } from '../../state/app';
import { bar, panel, row, spark, type Panel } from '../../ui/components';
import { brainKey, currentModel, mayUse, offlineReady, offlineSupport, syncTrust } from '../../offline/brain';
import { briefLine, CAT_WORDS, judgedFor, spanOf, trust, TRUST_CATS, type AskCat } from '../../offline/trust';

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

// ---------------------------------------------------------------- [offline2] the sheet, and the Brief's line

/** A brain sits here: its files on the phone, it has not closed Ghosty, WebGPU works (what answering first needs). */
async function brainSits(): Promise<boolean> {
  const m = currentModel();
  return mayUse(m) && (await offlineReady().catch(() => false)) && (await offlineSupport().catch(() => ({ ok: false }))).ok;
}

const share = (o: number, n: number) => (n ? `${Math.round((o / n) * 100)}%` : '—');
/** "The last 7 days: 61% on your own brains (48 of 79 asks)." */
const spanWords = (x: { total: number; own: number; pct: number | null }, span: string) =>
  x.pct === null ? `${span}: nothing asked yet.` : `${span}: ${x.pct}% on your own brains (${x.own} of ${x.total} ask${x.total === 1 ? '' : 's'}).`;

/** SYSTEM → INDEPENDENCE: how independent he is, in full ("how independent are you?" opens it). */
export function independencePanel(): Panel {
  const p = panel('INDEPENDENCE', { grow: false, cls: 'indsheet' });
  const spans = h('div.indspans');
  const brainLine = h('div.note.small.indbrain');
  const cats = h('ul.indcats', { 'aria-label': 'Each kind of ask: how much stayed on your phone, and who answers it first' });
  let sits: boolean | null = null;
  const paint = (): void => {
    const s = meter.get();
    const day = phoneDay();
    const w7 = spanOf(s.days, day, 7);
    const w30 = spanOf(s.days, day, 30);
    clear(spans, h('div.lab', 'HOW INDEPENDENT AM I'), h('div.note.indspan', spanWords(w7, 'The last 7 days')), h('div.note.indspan', spanWords(w30, 'The last 30 days')));
    const m = currentModel();
    const judged = judgedFor(brainKey(m));
    clear(
      brainLine,
      sits === false
        ? 'No brain sits on this phone yet, so every kind of ask is the cloud’s until one does (Settings → Offline brain).'
        : `Answering first on this phone: ${m.label}. Your bar: ${trust.get().bar}%.`,
    );
    const kinds: AskCat[] = [...TRUST_CATS, 'cloud'];
    clear(
      cats,
      ...kinds.map((k) => {
        const a = w7.cats[k] ?? { n: 0, o: 0 };
        const b = w30.cats[k] ?? { n: 0, o: 0 };
        const j = k === 'cloud' ? null : judged.find((x) => x.cat === k);
        const who =
          k === 'cloud' ? 'the cloud’s: it needs a tool, a search or long thinking'
          : sits === false ? 'the cloud’s: no brain sits on this phone'
          : j?.trusted ? `on this phone first: ${j.why}`
          : `the cloud’s: ${j?.why ?? 'no paper tests it yet'}`;
        const nums = `7 days ${share(a.o, a.n)} of ${a.n} · 30 days ${share(b.o, b.n)} of ${b.n}`;
        return h(`li.indcat${k !== 'cloud' && j?.trusted && sits !== false ? '.on' : ''}` as 'li', { 'aria-label': `${CAT_WORDS[k].label}: on your phone ${nums}. ${who}.` },
          h('b', CAT_WORDS[k].label), h('span.indnums', nums), h('small.indwho', who));
      }),
    );
  };
  p.body.append(
    spans,
    independenceBlock(),
    h('div.lab', 'BY KIND OF ASK'),
    brainLine,
    cats,
    h('div.note.indtruth', 'SOVEREIGN MODE is the plain name for Always (Settings → Offline brain → WHEN THE PHONE ANSWERS): the cloud is off-limits; what I can’t do here, I say I can’t.'),
    h('div.note.small.indceiling', 'One honest limit, said once: a phone alone will likely never match the very biggest cloud brains on the hardest, newest reasoning. That is physics (memory, power, energy), not a lack of training. Your own brains, your tools and the library on this phone do more of what you need every week, and the cloud stays a rare fallback you can switch off.'),
  );
  meter.subscribe(paint);
  trust.subscribe(paint);
  paint();
  void syncTrust(3600_000);
  void brainSits().then((v) => {
    sits = v;
    paint();
  });
  return p;
}

/** The Brief's weekly line when a brain sits on the phone: "This week 61 per cent of what you asked stayed on your phone, up from 48." */
export function briefIndependence(): HTMLElement {
  const el = h('p.brindep', { dataset: { case: 'keep' } });
  el.hidden = true;
  const paint = (): void => {
    void brainSits().then((sits) => {
      const line = sits ? briefLine(meter.get().days, phoneDay()) : '';
      el.textContent = line;
      el.hidden = !line;
    });
  };
  meter.subscribe(paint);
  paint();
  return el;
}

/** "How independent are you?" (assistant/local.ts): the sheet opened, and the last seven days in one line. */
export function independenceTurn(): string {
  goToPanel('system', 'INDEPENDENCE');
  // on a phone the screen is a list: the sheet itself is opened (its row tapped), not only its section
  let tries = 0;
  const open = (): void => {
    const head = document.querySelector<HTMLElement>('#pg-system .pn.indsheet[data-row] > h3');
    if (head && !head.parentElement!.classList.contains('pushed')) head.click();
    else if (!head && ++tries < 10) setTimeout(open, 200);
  };
  setTimeout(open, 250);
  const w = spanOf(meter.get().days, phoneDay(), 7);
  return w.pct === null
    ? 'Nothing asked in the last seven days yet, so there is nothing to count. The meter is open: System → Independence.'
    : `The last seven days, ${w.pct}% of what you asked stayed on your own brains (${w.own} of ${w.total}). The rest is on the sheet: System → Independence.`;
}
