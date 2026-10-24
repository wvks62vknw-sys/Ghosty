/**
 * The SPEED card (SYSTEM → STATUS, under the dials; SPEED part 2): how long Ghosty takes, in plain words. This
 * phone's own timings first (core/stopwatch.ts: replies as the owner sees them, screens, the start, the round trip
 * to the brain), then the brain's (apps/edge/src/speed.ts, carried by `/status` as `speed`): the first word and the
 * whole reply, where a reply's time goes as one stacked bar, the slowest tools and the writing speed, and a RECENT
 * list of the brain's newest 20 timings. It repaints when a status arrives (whoever asked for it) and when the phone
 * times something new; nothing is fetched for it.
 */
import type { BrainStatus } from '../../../../../packages/shared/src/protocol';
import type { Lap, Split, SpeedSummary } from '../../../../../packages/shared/src/speed';
import { lastSeen } from '../../api/brain';
import { clear, h, icon } from '../../core/dom';
import { dur, stopwatch, titleWords, type PhoneSpeed } from '../../core/stopwatch';

/** A thin stopwatch glyph (the icon language: a bare line drawing, no tile). */
const WATCH = '<circle cx="12" cy="13.5" r="7"/><path d="M12 13.5V9.5M10 3h4M12 3v3.5M18 6.5l1.5-1.5"/>';

/** A tool's name for the owner: "web_search" → "web search". */
const toolWords = (name: string) => name.replace(/_/g, ' ');

/** The four parts of a reply's time, in the order the bar draws them. */
export const PARTS: { key: keyof Split; label: string }[] = [
  { key: 'model', label: 'The model' },
  { key: 'tools', label: 'Tools' },
  { key: 'wait', label: 'Waiting' },
  { key: 'rest', label: 'The rest' },
];

/** Each part's share of the bar in whole per cent, adding up to exactly 100 (largest remainder); all 0 when nothing took any time. */
export function shares(split: Split): number[] {
  const ms = PARTS.map((p) => Math.max(0, split[p.key] || 0));
  const total = ms.reduce((a, b) => a + b, 0);
  if (!total) return ms.map(() => 0);
  const raw = ms.map((v) => (v / total) * 100);
  const out = raw.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  for (const i of raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]).map(([, i]) => i)) {
    if (left <= 0) break;
    out[i]!++;
    left--;
  }
  return out;
}

/** One of the brain's timings for RECENT: what it was, whose, how long, failed or not. */
export function recentEntry(l: Lap): { kind: string; who: string; time: string; failed: boolean; mine: boolean } {
  if (l.k === 'm') return { kind: 'Model call', who: l.p, time: dur(l.ms), failed: !!l.bad, mine: !l.bg };
  if (l.k === 't') return { kind: 'Tool', who: `${toolWords(l.name)}${l.n && l.n > 1 ? ` × ${l.n}` : ''}`, time: dur(l.ms), failed: false, mine: true };
  return { kind: 'Reply', who: `${l.calls} model call${l.calls === 1 ? '' : 's'}`, time: dur(l.ms), failed: false, mine: true };
}

/** Has the brain timed anything at all (today, last week or in its list)? */
const brainTimed = (s: SpeedSummary | undefined) => !!s && (s.recent.length > 0 || !!s.today.firstToken || !!s.today.reply || !!s.week?.firstToken);

export interface SpeedCard {
  el: HTMLElement;
  /** Repaint from a status (null: the brain could not be reached). */
  paint(st: BrainStatus | null): void;
}

export function speedCard(): SpeedCard {
  const phoneBox = h('div.spdlines', { dataset: { speed: 'phone' } });
  const brainBox = h('div.spdlines', { dataset: { speed: 'brain' } });
  const rows = h('div.spdrows');
  const split = h('div.spdsplit', { dataset: { speed: 'split' } });
  const more = h('div.spdrows');
  const list = h('ol.spdlist');
  const sum = h('summary', 'Recent');
  // (one disclosure kept across repaints, so an open RECENT stays open while new timings arrive)
  const recent = h('details.spdrecent', { dataset: { speed: 'recent' } }, sum, list);
  const el = h(
    'section.speed',
    { dataset: { speed: 'card', case: 'keep' } },
    h('div.spdhead', icon(WATCH), h('b', 'Speed'), h('small', 'how long Ghosty takes, timed')),
    phoneBox,
    brainBox,
    rows,
    split,
    more,
    recent,
  );

  let status: BrainStatus | null = null;
  let phone: PhoneSpeed | null = null;
  // a caption (whose timing it is) over its sentences, each its own line
  const line = (who: string, texts: string[], empty = false) => h(`p.spdline${empty ? '.none' : ''}` as 'p', h('small', who), ...texts.map((t) => h('span', t)));
  const small = (k: string, v: string, key: string) => h('div.spdrow', { dataset: { speed: key } }, h('span.k', k), h('span.v', v));

  const draw = () => {
    const sp = status?.speed;
    // ---- this phone: the reply line first
    const reply = phone?.lines.find((l) => l.startsWith('Replies:'));
    clear(phoneBox, reply ? line('On this phone', [reply.replace(/^Replies: none timed yet today/, 'No replies timed yet today')], !phone?.replies.today.done) : line('On this phone', ['No replies timed yet today'], true));
    // ---- the brain: the first word, then the whole reply
    if (!status) clear(brainBox, line('In the brain', ['The brain can’t be reached right now'], true));
    else if (!brainTimed(sp)) clear(brainBox, line('In the brain', ['The brain has not timed anything yet'], true));
    else {
      const said = sp!.lines.filter((l) => /^(First word|No model calls|Replies take)/.test(l));
      clear(brainBox, line('In the brain', said, !sp!.today.firstToken));
    }
    // ---- small rows: screens, the start, the round trip
    clear(rows);
    if (phone?.screens.length) {
      const shown = phone.screens.slice(0, 6);
      const slowest = shown.length > 1 ? shown.reduce((a, b) => (b.median > a.median ? b : a)) : null;
      rows.append(small('Screens', shown.map((s) => `${titleWords(s.title)} ${dur(s.median)}${s === slowest ? ' (slowest)' : ''}`).join(', '), 'screens'));
    }
    if (phone?.start.screen) rows.append(small('Start', `${phone.start.paint ? `first paint ${dur(phone.start.paint.median)}, ` : ''}first screen ${dur(phone.start.screen.median)}`, 'start'));
    if (phone?.trip) rows.append(small('Brain round trip', `${dur(phone.trip.median)} (median of ${phone.trip.n})`, 'trip'));
    // ---- where a reply's time goes: one stacked bar, each part labelled
    clear(split);
    const s = sp?.today.split ?? sp?.week?.split ?? null;
    if (s) {
      const total = PARTS.reduce((t, p) => t + Math.max(0, s[p.key] || 0), 0);
      const pc = shares(s);
      split.append(
        h('div.spdsk', h('span', 'Where a reply’s time goes'), h('span.v', `${dur(total)} on average${sp?.today.split ? '' : ' last week'}`)),
        h('div.spdbar', { role: 'img', 'aria-label': PARTS.map((p) => `${p.label} ${dur(s[p.key])}`).join(', ') }, ...PARTS.map((p, i) => h('i', { dataset: { part: p.key, ms: String(Math.round(s[p.key] || 0)), pc: String(pc[i]) }, style: { width: `${pc[i]}%` } }))),
        h('div.spdkey', ...PARTS.map((p, i) => h('span', { dataset: { part: p.key } }, h('i'), `${p.label} `, h('b', dur(s[p.key])), h('em', ` ${pc[i]}%`)))),
      );
    }
    // ---- tools (slowest first) and writing speed
    clear(more);
    const tools = sp?.today.tools.length ? sp.today.tools : (sp?.week?.tools ?? []);
    if (tools.length) more.append(small('Tools', [...tools].sort((a, b) => b.median - a.median).slice(0, 6).map((t) => `${toolWords(t.name)} ${dur(t.median)}`).join(', '), 'tools'));
    const tps = (sp?.today.providers ?? []).filter((p) => p.tps).sort((a, b) => b.tps! - a.tps!);
    // (a token is about three quarters of a word: the owner reads words)
    if (tps.length) more.append(small('Writing speed', tps.slice(0, 3).map((p) => `${p.provider} about ${Math.round(p.tps! * 0.75)} words a second`).join(', '), 'writing'));
    // ---- RECENT: the brain's newest 20
    const laps = sp?.recent.slice(0, 20) ?? [];
    recent.hidden = !laps.length;
    sum.textContent = `Recent · ${laps.length}`;
    clear(list, ...laps.map((l) => {
      const e = recentEntry(l);
      const at = new Date(l.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return h(`li${e.failed ? '.bad' : ''}` as 'li', { dataset: { kind: l.k, at: String(l.at) } }, h('span.kd', e.kind), h('span.who', `${e.who}${e.mine ? '' : ' · Ghosty’s own work'}${e.failed ? ' · failed' : ''}`), h('span.tm', e.time), h('small', at));
    }));
  };

  // Several changes at once (a reply's round trips, then its status) draw once.
  let queued = false;
  const refresh = () => {
    if (queued) return;
    queued = true;
    void stopwatch
      .summary()
      .catch(() => null)
      .then((p) => {
        queued = false;
        phone = p;
        draw();
      });
  };
  lastSeen.subscribe((st, prev) => {
    if (st.status === prev.status || !st.status) return;
    status = st.status;
    if (el.isConnected) refresh();
  });
  stopwatch.onChange(() => el.isConnected && refresh());
  draw();
  return {
    el,
    paint(st) {
      status = st;
      refresh();
    },
  };
}
