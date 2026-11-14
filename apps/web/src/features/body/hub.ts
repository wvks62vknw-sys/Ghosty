/**
 * HEALTH HUB (APPS ROUND, BODY lane's flagship): everything his iPhone and Watch measure on one page that fills itself, kept on
 * this phone only (`ghosty.body.hub`). The pure parts are ./hubcore.ts.
 *  - IN: the ready-made Shortcut sends the day's totals each evening ("#body?hub=steps=8421,rhr=58,…") or copies them for one
 *    paste; the Health export, read once for the history and then only for new days. Never a route, never a position.
 *  - TODAY: the activity rings (move, exercise, stand), steps counted live by the motion sensor while Ghosty is open, and a card
 *    for each measure with its last value and its month.
 *  - A CARD opens its chart from a day to all time (pinch on the chart, or the range keys), with the average, the lowest and the
 *    highest; weight with its smoothed trend; sleep with its stages.
 *  - HIGHLIGHTS from his own history, told as what happened, never advice, never a forecast; WORKOUTS; a ONE-PAGE PDF for an
 *    appointment. Not medical advice. Nothing here goes to my brain.
 * The first run shows a sample (marked as one) and a three-step tour. The state is on window.__ghosty.hub for the specs.
 */
import { h, svgEl } from '../../core/dom';
import { button } from '../../ui/components';
import { emptyState, lacksSignal, phrases, sizeWords, stateIn, stateLine, waitFor } from '../lifeui';
import { sayError } from '../../ui/hisWords';
import {
  addDays, avgOver, dayKey, emptyHub, fmt, highlights, HUB_METRICS, hubDays, mendHub, metricOf, NOT_ADVICE_HUB, parseTotals, RANGES, ringsOf, sampleHub, seriesOf, smoothed,
  type HubData, type HubKey, type RangeId,
} from './hubcore';

const KEY = 'ghosty.body.hub';
const SEEN = 'ghosty.body.hub.tour';
let cache: HubData | null = null;
let failed = '';
const listeners = new Set<() => void>();
const now = (): number => Date.now() + ((window as unknown as { __ghostyClockOffset?: number }).__ghostyClockOffset ?? 0);
const today = () => dayKey(now());

export function loadHub(): HubData {
  if (cache) return cache;
  let raw: unknown = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  } catch {
    raw = null;
  }
  // the first run: a sample, marked as one, until his own numbers arrive
  cache = raw ? mendHub(raw) : sampleHub(today());
  return cache;
}
function save(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadHub()));
    failed = '';
  } catch {
    failed = 'I couldn’t keep that on this phone: its storage is full or switched off.';
  }
  for (const f of listeners) f();
  return !failed;
}
/** His own numbers arrive: the sample goes, and the trackers (Steps, Sleep) get the days too, never over a day he kept himself. */
function ownData(): HubData {
  const d = loadHub();
  if (d.sample) {
    const fresh = emptyHub();
    fresh.goals = d.goals;
    cache = fresh;
  }
  return cache!;
}
function toTrackers(days: Record<string, { steps?: number; sleep?: number }>): void {
  const list = Object.entries(days).map(([d, v]) => ({ d, steps: v.steps ?? null, sleep: v.sleep ?? null }));
  if (list.length) void import('./track').then((t) => t.fromHealth(list)).catch(() => undefined);
}

/** The Shortcut's totals (from its link or its paste): kept as that day's, the day's earlier Shortcut numbers replaced. */
export function takeTotals(text: string): string {
  const got = parseTotals(text, today());
  if (!got) return 'I couldn’t read any totals in that. The Shortcut sends lines like “steps=8421, rhr=58, sleep=7.2”.';
  const d = ownData();
  d.days[got.day] = { ...(d.days[got.day] ?? {}), ...got.values };
  d.lastShortcut = now();
  if (!save()) return failed;
  toTrackers({ [got.day]: d.days[got.day]! });
  const n = Object.keys(got.values).length;
  return `${n} total${n === 1 ? '' : 's'} kept for ${got.day === today() ? 'today' : new Date(`${got.day}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}, on this phone only.`;
}

// ---------------------------------------------------------------- drawing helpers

const R = (n: number) => Math.round(n * 10) / 10;
function rings(r: { move: number; exercise: number; stand: number }): SVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 120 120', class: 'hh-rings', role: 'img', 'aria-label': `Move ${Math.round(r.move * 100)}%, exercise ${Math.round(r.exercise * 100)}%, stand ${Math.round(r.stand * 100)}% of your goals` });
  ([['move', 52, r.move], ['exercise', 40, r.exercise], ['stand', 28, r.stand]] as const).forEach(([cls, rad, f]) => {
    const c = 2 * Math.PI * rad;
    svg.append(svgEl('circle', { cx: 60, cy: 60, r: rad, class: `hh-ringtrack ${cls}` }), svgEl('circle', { cx: 60, cy: 60, r: rad, class: `hh-ringfill ${cls}`, 'stroke-dasharray': `${(Math.min(1, f) * c).toFixed(1)} ${c.toFixed(1)}`, transform: 'rotate(-90 60 60)' }));
  });
  return svg;
}
function spark(vals: (number | null)[]): SVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 100 28', preserveAspectRatio: 'none', class: 'hh-spark', 'aria-hidden': 'true' });
  const xs = vals.map((v, i) => [i, v] as const).filter((p): p is readonly [number, number] => p[1] != null);
  if (xs.length < 2) return svg;
  const lo = Math.min(...xs.map((p) => p[1]));
  const hi = Math.max(...xs.map((p) => p[1]));
  const n = Math.max(1, vals.length - 1);
  svg.append(svgEl('polyline', { class: 'hh-sparkline', points: xs.map(([i, v]) => `${((i / n) * 100).toFixed(1)},${(26 - ((v - lo) / Math.max(1e-6, hi - lo)) * 24).toFixed(1)}`).join(' ') }));
  return svg;
}
function chart(key: HubKey, pts: { label: string; v: number | null }[]): SVGElement {
  const m = metricOf(key);
  const W = 300;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} 120`, preserveAspectRatio: 'none', class: 'hh-chart', role: 'img', 'aria-label': `${m.label}: ${pts.filter((p) => p.v != null).length} points` });
  const vals = pts.map((p) => p.v).filter((v): v is number => v != null);
  if (!vals.length) return svg;
  const bars = m.join === 'sum' && key !== 'sleep' ? true : key === 'sleep';
  let lo = bars ? 0 : Math.min(...vals);
  let hi = Math.max(...vals);
  if (!bars) {
    const pad2 = Math.max(0.5, (hi - lo) * 0.15);
    lo -= pad2;
    hi += pad2;
  }
  const y = (v: number) => 116 - ((v - lo) / Math.max(1e-6, hi - lo)) * 110;
  const step = W / pts.length;
  if (bars) pts.forEach((p, i) => p.v != null && svg.append(svgEl('rect', { x: (i * step + step * 0.15).toFixed(1), y: y(p.v).toFixed(1), width: Math.max(0.6, step * 0.7).toFixed(1), height: Math.max(0.5, 116 - y(p.v)).toFixed(1), class: 'hh-bar' })));
  else {
    const line = pts.map((p, i) => (p.v == null ? null : `${(i * step + step / 2).toFixed(1)},${y(p.v).toFixed(1)}`)).filter(Boolean).join(' ');
    svg.append(svgEl('polyline', { points: line, class: key === 'weight' ? 'hh-dots' : 'hh-line' }));
    if (key === 'weight') {
      const tr = smoothed(pts);
      svg.append(svgEl('polyline', { points: tr.map((v, i) => (v == null ? null : `${(i * step + step / 2).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' '), class: 'hh-trend' }));
    }
  }
  return svg;
}

// ---------------------------------------------------------------- the live step counter (motion sensor, while open)

let live: { n: number; stop(): void } | null = null;
export const liveState = { n: 0, on: false, why: '' };
async function startLive(onStep: () => void): Promise<string> {
  const DM = (window as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<string> } }).DeviceMotionEvent;
  if (!DM) return 'This phone has no motion sensor I can read here.';
  try {
    if (DM.requestPermission && (await DM.requestPermission()) !== 'granted') return 'The phone said no to the motion sensor. Settings, Safari, Motion and Orientation Access.';
  } catch {
    return 'The motion sensor needs your tap to start. Tap again.';
  }
  let last = 0;
  let avg = 9.8;
  let up = false;
  const on = (e: DeviceMotionEvent) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null || a.y == null || a.z == null) return;
    const mag = Math.hypot(a.x, a.y, a.z);
    avg = avg * 0.95 + mag * 0.05;
    const t = performance.now();
    if (!up && mag > avg + 1.6 && t - last > 280) {
      up = true;
      last = t;
      liveState.n++;
      onStep();
    } else if (up && mag < avg) up = false;
  };
  window.addEventListener('devicemotion', on);
  live = { n: 0, stop: () => window.removeEventListener('devicemotion', on) };
  liveState.on = true;
  return 'Counting your steps while Ghosty is open. Keep the phone in your hand or pocket.';
}
function stopLive(): void {
  live?.stop();
  live = null;
  liveState.on = false;
}

// ---------------------------------------------------------------- the PDF for an appointment

async function summaryPdf(d: HubData): Promise<Uint8Array> {
  const { writePdf, A4 } = await import('../../convert/pdfwrite');
  const t = today();
  const runs: { x: number; y: number; text: string; font: 'Helvetica' | 'Helvetica-Bold'; size: number }[] = [];
  const lines: { x1: number; y1: number; x2: number; y2: number; width: number }[] = [];
  let y = A4.h - 60;
  const put = (text: string, size = 11, bold = false, x = 50) => {
    runs.push({ x, y, text, font: bold ? 'Helvetica-Bold' : 'Helvetica', size });
  };
  put('Health summary', 20, true);
  y -= 22;
  put(`The 30 days to ${new Date(`${t}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}, from my iPhone and Watch.${d.sample ? ' (Sample data.)' : ''}`, 10);
  y -= 26;
  put('Measure', 10, true);
  put('Last 30 days', 10, true, 260);
  put('30 days before', 10, true, 400);
  y -= 6;
  lines.push({ x1: 50, y1: y, x2: A4.w - 50, y2: y, width: 0.6 });
  for (const m of HUB_METRICS) {
    const a = avgOver(d, m.key, t, 30);
    const b = avgOver(d, m.key, addDays(t, -30), 30);
    if (a.v == null && b.v == null) continue;
    y -= 18;
    put(m.label, 10);
    put(a.v == null ? '-' : `${fmt(m.key, a.v)}${m.key === 'sys' && avgOver(d, 'dia', t, 30).v != null ? `/${Math.round(avgOver(d, 'dia', t, 30).v!)}` : ''}`, 10, false, 260);
    put(b.v == null ? '-' : fmt(m.key, b.v), 10, false, 400);
  }
  y -= 30;
  put('What changed', 12, true);
  for (const hl of highlights(d, t).slice(0, 8)) {
    y -= 16;
    put(`- ${hl.words}`.slice(0, 110), 9);
  }
  y -= 30;
  put('Averages of what my devices recorded. My own record for the appointment: not a diagnosis, not medical advice.', 8);
  return writePdf([{ w: A4.w, h: A4.h, runs, lines }], { title: 'Health summary' });
}

// ---------------------------------------------------------------- the screen

export function hubScreen(): { el: HTMLElement; stop(): void } {
  expose();
  const el = h('div.pkcol.bt.hh', { dataset: { track: 'hub' } });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  let open: HubKey | '' = '';
  let range: RangeId = 'M';
  const say = (w: string, kind: '' | 'error' | 'offline' | 'loading' = '') => stateIn(status, kind, w);
  const draw = () => {
    const d = loadHub();
    const t = today();
    hubState.open = open;
    hubState.range = range;
    if (open) return drawOne(d, t, open);
    const kids: HTMLElement[] = [];
    // where the numbers came from
    const src = d.sample ? 'Sample numbers, so you can see it working. Your own arrive from the Shortcut or your export.' : d.lastShortcut ? `Updated by your Shortcut ${new Date(d.lastShortcut).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}.` : d.lastExport ? `Read from your export ${new Date(d.lastExport).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}.` : '';
    kids.push(h('div.hh-top', h('b.hh-date', new Date(`${t}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })), h('small', { dataset: { source: d.sample ? 'sample' : d.lastShortcut ? 'shortcut' : d.lastExport ? 'export' : 'none' } }, src)));
    if (failed) {
      /* state: body.hub error */
      kids.push(stateLine('error', failed));
    }
    const day = d.days[t] ?? d.days[addDays(t, -1)] ?? null;
    if (!Object.keys(d.days).length) {
      /* state: body.hub empty */
      kids.push(emptyState('Nothing from your iPhone or Watch yet', 'Make the Shortcut below once, or read your Health export, and this fills itself.'));
    }
    // the rings
    const r = ringsOf(d, d.days[t] ? t : addDays(t, -1));
    kids.push(h('section.hh-today', { 'aria-label': 'Activity' }, rings(r), h('div.hh-ringwords',
      h('p', { dataset: { ring: 'move' } }, h('b', `${Math.round(day?.kcal ?? 0)}`), h('small', ` of ${d.goals.move} kcal move`)),
      h('p', { dataset: { ring: 'exercise' } }, h('b', `${Math.round(day?.exercise ?? 0)}`), h('small', ` of ${d.goals.exercise} min exercise`)),
      h('p', { dataset: { ring: 'stand' } }, h('b', `${Math.round(day?.stand ?? 0)}`), h('small', ` of ${d.goals.stand} hours stand`)))));
    // the three-step tour, on the first run
    let seen = true;
    try {
      seen = localStorage.getItem(SEEN) === '1';
    } catch {
      seen = true;
    }
    if (!seen) {
      const got = button('Got it', () => {
        try {
          localStorage.setItem(SEEN, '1');
        } catch {
          /* shown again next time */
        }
        draw();
      }, 'on');
      kids.push(h('section.hh-tour', { 'aria-label': 'How it works', dataset: { tour: '1' } },
        h('ol.pklist', h('li', h('b', 'Fill it each day. '), 'Make the Shortcut below once: each evening it sends the day’s totals, nothing else.'), h('li', h('b', 'Bring your history. '), 'Read your Health export once; after that only new days are read.'), h('li', h('b', 'Tap any card. '), 'Its chart goes from a day to all time: pinch it or use the range keys.')),
        h('div.pkrow', got)));
    }
    // steps counted live
    const liveKey = button(liveState.on ? `Counting: ${liveState.n} steps` : 'Count steps now', async () => {
      if (liveState.on) {
        stopLive();
        say(`${liveState.n} steps counted while open, a rough count from the motion sensor.`);
        return draw();
      }
      say(await startLive(() => (liveKey.textContent = `Counting: ${liveState.n} steps`)));
      draw();
    }, liveState.on ? 'on' : '');
    liveKey.setAttribute('aria-label', liveState.on ? 'Stop counting steps' : 'Count steps live with the motion sensor');
    kids.push(h('div.pkrow', liveKey));
    // a card for each measure
    kids.push(h('h3.bt-h', 'Your measures'), h('div.hh-cards', ...HUB_METRICS.map((m) => {
      const last = Object.keys(d.days).sort().reverse().find((k) => d.days[k]![m.key] != null);
      const v = last ? d.days[last]![m.key]! : null;
      const month = seriesOf(d, m.key, t, 'M').map((p) => p.v);
      const b = button(h('span.hh-card', h('small', m.label), h('b', v == null ? '—' : m.key === 'sys' && last && d.days[last]!.dia != null ? `${Math.round(v)}/${Math.round(d.days[last]!.dia!)} mmHg` : fmt(m.key, v)), h('small', last ? (last === t ? 'today' : new Date(`${last}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })) : 'not measured yet'), spark(month)), () => {
        open = m.key;
        range = m.join === 'sum' ? 'W' : 'M';
        draw();
      });
      b.setAttribute('aria-label', `${m.label}: ${v == null ? 'not measured yet' : fmt(m.key, v)}. Open its chart`);
      b.dataset.card = m.key;
      return b;
    })));
    // highlights
    const hl = highlights(d, t);
    kids.push(h('h3.bt-h', 'Highlights'), hl.length ? h('div.pkcol', { dataset: { highlights: String(hl.length) } }, ...hl.slice(0, 6).map((x) => h('p.bc-pattern', { dataset: { hl: x.key } }, x.words))) : h('p.pknote', { dataset: { highlights: '0' } }, 'Highlights show once a month or more of your own numbers is here: what changed, never advice.'));
    // sleep stages, last night and the week
    const nights = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)).map((k) => ({ k, s: d.days[k] }));
    const ln = nights[nights.length - 1]!.s?.sleep != null ? nights[nights.length - 1]!.s! : nights[nights.length - 2]!.s;
    if (ln?.deep != null) {
      const tot = (ln.deep ?? 0) + (ln.rem ?? 0) + (ln.core ?? 0) + (ln.awake ?? 0);
      kids.push(h('h3.bt-h', 'Sleep stages'), h('div.hh-stages', { role: 'img', 'aria-label': `Last night: deep ${fmt('deep', ln.deep ?? 0)}, REM ${fmt('rem', ln.rem ?? 0)}, core ${fmt('core', ln.core ?? 0)}, awake ${fmt('awake', ln.awake ?? 0)}` },
        ...(['awake', 'rem', 'core', 'deep'] as const).map((s) => h(`i.hh-st.${s}` as 'i', { style: `flex:${((ln[s] ?? 0) / Math.max(0.01, tot)).toFixed(3)}` }))),
        h('div.hh-legend', ...(['deep', 'core', 'rem', 'awake'] as const).map((s) => h('small', h(`i.hh-key.${s}` as 'i'), ` ${s === 'rem' ? 'REM' : s[0]!.toUpperCase() + s.slice(1)} ${fmt(s, ln[s] ?? 0)}`))));
    }
    // workouts
    if (d.workouts.length) kids.push(h('h3.bt-h', 'Workouts'), h('ul.pkitems', { dataset: { workouts: String(d.workouts.length) } }, ...d.workouts.slice(-6).reverse().map((w) => h('li.pkitem', h('span.bt-entry', h('b', `${w.kind} · ${w.min} min`), h('small', ` · ${new Date(`${w.d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}${w.km ? ` · ${w.km} km` : ''}${w.kcal ? ` · ${w.kcal} kcal` : ''}`))))));
    kids.push(inBox(d));
    if (d.sample) {
      const clear = button('Clear the sample', () => {
        cache = emptyHub();
        cache.goals = d.goals;
        save();
        say('Sample cleared. Set up the Shortcut below, or read your export once for your history.');
      });
      kids.push(h('div.pkrow', clear));
    }
    kids.push(status, phrases(['open health hub', 'my resting heart rate', 'health summary for my appointment']), h('p.pknote', `Kept on this phone only: nothing here goes to my brain. ${NOT_ADVICE_HUB}`));
    paint(kids);
  };
  /** One measure's chart, from a day to all time. */
  const drawOne = (d: HubData, t: string, key: HubKey) => {
    const m = metricOf(key);
    const pts = seriesOf(d, key, t, range);
    const vals = pts.map((p) => p.v).filter((v): v is number => v != null);
    const back = button('All measures', () => {
      open = '';
      draw();
    });
    back.setAttribute('aria-label', 'Back to all measures');
    const keys = h('div.pkrow.hh-ranges', { role: 'group', 'aria-label': 'How far back' }, ...RANGES.map((r) => {
      const b = button(r.id, () => {
        range = r.id;
        draw();
      }, r.id === range ? 'on' : '');
      b.setAttribute('aria-pressed', String(r.id === range));
      b.setAttribute('aria-label', r.label);
      return b;
    }));
    const box = h('div.hh-chartbox', { dataset: { points: String(pts.length), range } }, chart(key, range === 'D' ? seriesOf(d, key, t, 'W').slice(-1) : pts));
    pinch(box);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    const hl = highlights(d, t).find((x) => x.key === key);
    const kids: HTMLElement[] = [h('div.pkrow', back), h('h3.kl-title', m.label), keys, box,
      vals.length ? h('div.bc-grid', h('div.bc-cell', h('small', 'Average'), h('b', fmt(key, avg!))), h('div.bc-cell', h('small', 'Lowest'), h('b', fmt(key, Math.min(...vals)))), h('div.bc-cell', h('small', 'Highest'), h('b', fmt(key, Math.max(...vals))))) : h('p.pknote', 'Nothing measured in this range.'),
      key === 'weight' ? h('p.pknote', 'The line is your smoothed trend: it evens out day-to-day water and food, as the weight apps draw it.') : h('p.pknote', ''),
      hl ? h('p.bc-pattern', hl.words) : h('p.pknote', 'No change worth saying between this month and the last.'),
      status, h('p.pknote', NOT_ADVICE_HUB)];
    paint(kids);
  };
  /** Two fingers on the chart: apart for a closer range, together for a longer one. */
  const pinch = (box: HTMLElement) => {
    let d0 = 0;
    const dist = (e: TouchEvent) => Math.hypot(e.touches[0]!.clientX - e.touches[1]!.clientX, e.touches[0]!.clientY - e.touches[1]!.clientY);
    box.addEventListener('touchstart', (e) => e.touches.length === 2 && (d0 = dist(e)), { passive: true });
    box.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 2 || !d0) return;
      const k = dist(e) / d0;
      const i = RANGES.findIndex((r) => r.id === range);
      if (k > 1.35 && i > 0) range = RANGES[i - 1]!.id;
      else if (k < 0.75 && i < RANGES.length - 1) range = RANGES[i + 1]!.id;
      else return;
      d0 = 0;
      draw();
    }, { passive: true });
  };
  /** Bring your numbers in: the Shortcut (its link or a paste), the export (only new days), the goals, the PDF. */
  const inBox = (d: HubData) => {
    const link = `${location.origin}/#body?hub=`;
    const copy = button('Copy the link', async () => {
      try {
        await navigator.clipboard.writeText(link);
        say('Copied. Paste it in the Shortcut’s Open URLs step, with the totals after the = sign.');
      } catch {
        say(`The link: ${link}`);
      }
    });
    const paste = h('textarea', { rows: 2, placeholder: 'steps=8421, rhr=58, hrv=44, sleep=7.2', 'aria-label': 'Paste what the Shortcut copied' }) as HTMLTextAreaElement;
    const keep = button('Keep these totals', () => {
      say(takeTotals(paste.value));
      paste.value = '';
    }, 'on');
    keep.setAttribute('aria-label', 'Keep the pasted totals');
    const file = h('input', { type: 'file', accept: '.zip,.xml,application/zip,text/xml', hidden: true, 'aria-label': 'Your Apple Health export' }) as HTMLInputElement;
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      const own = loadHub();
      const from = own.sample || !own.through ? addDays(today(), -3650) : addDays(own.through, -1);
      /* state: body.hub loading */
      const done = waitFor(el, `Reading your Health export, ${sizeWords(f.size)}${own.through && !own.sample ? ', only the days since the last time' : ''}…`);
      try {
        const { readHubExport } = await import('./export');
        const acc = await readHubExport(f, from, (x) => (status.textContent = `${Math.round(x * 100)}% read`));
        done();
        const days = hubDays(acc);
        const data = ownData();
        for (const [k, v] of Object.entries(days)) data.days[k] = { ...(data.days[k] ?? {}), ...v };
        const seen = new Set(data.workouts.map((w) => `${w.d}|${w.kind}|${w.min}`));
        data.workouts = [...data.workouts, ...acc.workouts.filter((w) => !seen.has(`${w.d}|${w.kind}|${w.min}`))].sort((a, b) => a.d.localeCompare(b.d)).slice(-500);
        data.through = Object.keys(data.days).sort().pop() ?? data.through;
        data.lastExport = now();
        save();
        toTrackers(days);
        say(`Read ${acc.records.toLocaleString('en-GB')} records across ${Object.keys(days).length} days, here on the phone. Next time only the new days are read.`);
      } catch (e) {
        done();
        /* state: body.hub error */
        say(sayError(e, 'read that export'), 'error');
      }
    });
    const pick = button('Read my Health export', () => file.click());
    pick.setAttribute('aria-label', 'Read my Health export, only the new days');
    const pdf = button('Summary for an appointment', async () => {
      try {
        const bytes = await summaryPdf(loadHub());
        hubState.pdf = bytes.length;
        const a = h('a', { href: URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' })), download: 'health-summary.pdf' }) as HTMLAnchorElement;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
        say('Saved: health-summary.pdf, one page of your last 30 days beside the 30 before.');
      } catch (e) {
        say(sayError(e, 'make the summary'), 'error');
      }
    });
    pdf.setAttribute('aria-label', 'Save a one-page summary PDF for an appointment');
    const goal = (label: string, k: keyof HubData['goals'], lo: number, hi: number) => {
      const inp = h('input', { type: 'number', inputmode: 'numeric', value: String(d.goals[k]), min: String(lo), max: String(hi), 'aria-label': label }) as HTMLInputElement;
      inp.addEventListener('change', () => {
        const v = Math.round(Number(inp.value));
        if (v >= lo && v <= hi) {
          loadHub().goals[k] = v;
          save();
        }
      });
      return h('div.pkfield', h('label', label), inp);
    };
    const net = lacksSignal() ? [
      /* state: body.hub offline */
      stateLine('offline', 'No signal needed: everything here is on this phone.'),
    ] : [];
    return h('section.hh-in', { 'aria-label': 'Bring your numbers in' },
      h('h3.bt-h', 'Fill it each day'),
      h('details.pkmore.hh-shortcut', h('summary', 'The Shortcut, made once'),
        h('ol.pklist',
          h('li', 'Shortcuts, then Automation, then New Automation: Time of Day, 21:00, Daily, Run Immediately.'),
          h('li', 'Add Find Health Samples for each of: Steps, Active Energy, Exercise Minutes, Stand Hours, Resting Heart Rate, Heart Rate Variability, Sleep (each Start Date is Today), then Calculate Statistics: Sum (Average for heart).'),
          h('li', 'Add Text: steps=[Steps], kcal=[Active Energy], ex=[Exercise], stand=[Stand], rhr=[Resting], hrv=[HRV], sleep=[Sleep hours].'),
          h('li', h('span', 'Add Open URLs with this link and the Text after the = sign, or Copy to Clipboard and paste below: '), h('code.bt-link', link))),
        h('div.pkrow', copy), h('p.pknote', 'It sends the day’s totals only: never a route, never where you were.')),
      h('div.pkfield', h('label', 'Or paste what it copied'), paste), h('div.pkrow', keep),
      h('div.pkrow', pick, pdf), file,
      h('details.pkmore.hh-goals', h('summary', 'Your ring goals'), h('div.kl-grid2', goal('Move, kcal', 'move', 100, 3000), goal('Exercise, minutes', 'exercise', 5, 300), goal('Stand, hours', 'stand', 1, 24))),
      ...net);
  };
  const paint = (kids: HTMLElement[]) => {
    const was = new Set([...el.querySelectorAll('details[open]')].map((x) => x.className));
    el.replaceChildren(...kids);
    el.querySelectorAll('details').forEach((x) => was.has(x.className) && ((x as HTMLDetailsElement).open = true));
  };
  listeners.add(draw);
  draw();
  return { el, stop: () => {
    listeners.delete(draw);
    stopLive();
  } };
}

/** "my resting heart rate", "how did I sleep last night (stages)", "open health hub": a line from his own numbers. */
export function hubTurn(text: string): { reply: string } | null {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/’/g, "'");
  if (/^(?:open |show )?(?:my )?health hub$/.test(t)) return { reply: `Health hub is open.${loadHub().sample ? ' It shows a sample until your Shortcut or export arrives.' : ''}` };
  if (/health summary|summary for (?:my |an )?appointment/.test(t)) return { reply: 'Health hub is open: tap SUMMARY FOR AN APPOINTMENT for one page of your last 30 days as a PDF.' };
  const which: [RegExp, HubKey][] = [[/resting heart/, 'rhr'], [/\bhrv\b|heart rate variability/, 'hrv'], [/vo2|cardio fitness/, 'vo2'], [/blood pressure/, 'sys'], [/breathing rate|respiratory/, 'resp'], [/active energy|calories burned/, 'kcal'], [/exercise minutes/, 'exercise']];
  const k = which.find(([re]) => re.test(t))?.[1];
  if (!k || !/^(?:what'?s |what is |how'?s |show |tell me )?(?:my )?/.test(t) || t.length > 60) return null;
  const d = loadHub();
  const a = avgOver(d, k, today(), 30);
  if (a.v == null) return { reply: `No ${metricOf(k).label.toLowerCase()} here yet. The Shortcut or your Health export brings it in.` };
  const hl = highlights(d, today()).find((x) => x.key === k);
  return { reply: `${metricOf(k).label}: ${fmt(k, R(a.v))} on average over the last 30 days.${hl ? ` ${hl.words}` : ''}${d.sample ? ' (Sample numbers.)' : ''} ${NOT_ADVICE_HUB}` };
}

export const hubState = { open: '' as HubKey | '', range: 'M' as RangeId, pdf: 0 };
function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.hub = { data: () => loadHub(), reset: () => void (cache = null), state: hubState, live: liveState, take: takeTotals };
}
