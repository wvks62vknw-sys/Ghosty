/**
 * THE APP LIBRARY's log renderer (and the importer's records underneath): records with fields, drawn as a list, a board, a
 * calendar or a gallery, with the stats strip (goal rings), a chart over time, reminders on the day and the field editor sheet
 * with every field type. Every change goes through the kit (k.add, k.update, k.remove), so undo, redo and Recently deleted hold.
 * THE PRO ROUND (lane LOG): the hero stat with its trend and goal ring, rich rows (thumbnail, stars, chips, a tabular value)
 * that swipe left to delete (Undo in the notice) and right for the main action, the item's own page, the quick-add bar
 * (quickadd.ts), a bank's day groups in the money skin, board drag, the heatmap month, the masonry gallery and charts with
 * rounded bars, labelled axes and today lit. Its look is log.css, every colour a token.
 */
import { h, icon, svgEl } from '../../../core/dom';
import { key } from '../../../ui/machine';
import { stateCard, type KitApp } from '../../../ui/appkit';
import type { AppDef, Field, LogConfig, Skin, Stat } from '../../../../../../packages/shared/src/applib/types';
import { quickAdd, quickExample } from '../../../../../../packages/shared/src/applib/quickadd';
import css from './log.css';
import { registerRenderer, redraw, toolKey } from '../registry';
import { blank, dayWords, extra, fill, mins, money, newId, num, queryOf, recordOf, sectionHead, show, today, type Rec, type Val } from '../engine';
import { glyphOf } from '../glyphs';

const PLUS = '<path d="M12 5v14M5 12h14"/>';
const NUMERIC = new Set(['number', 'money', 'duration', 'rating', 'scale']);
const WD = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const recs = (k: KitApp) => k.items() as Rec[];
const fOf = (r: Rec): Record<string, Val> => (r.f && typeof r.f === 'object' ? r.f : {});
const dateOf = (log: LogConfig, r: Rec) => (log.date ? String(fOf(r)[log.date] ?? '') : '');
const parseDay = (d: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d); return m ? new Date(+m[1]!, +m[2]! - 1, +m[3]!) : null; };

/** Does a record's day fall in the current day, week (Monday first), month or year? */
export function inPeriod(day: string, period: Stat['period'], now = new Date()): boolean {
  if (!period || period === 'all') return true;
  const d = parseDay(day);
  if (!d) return false;
  if (period === 'year') return d.getFullYear() === now.getFullYear();
  if (period === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (period === 'day') return day === today(now);
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return d >= mon && d < new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 7);
}

/** One stat worked out over the records (null: nothing to say yet). */
export function statValue(log: LogConfig, s: Stat, rows: Rec[], now = new Date()): number | null {
  const pool = rows.filter((r) => !log.date || !s.period || s.period === 'all' || inPeriod(dateOf(log, r), s.period, now));
  if (s.kind === 'count') return pool.length;
  if (s.kind === 'streak') {
    const days = new Set(rows.map((r) => dateOf(log, r)).filter(Boolean));
    let n = 0;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!days.has(today(d))) d.setDate(d.getDate() - 1);
    while (days.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  const vals = pool.map((r) => fOf(r)[s.field!]).filter((v) => v != null && v !== '');
  if (s.kind === 'distinct') return new Set(vals.flatMap((v) => (Array.isArray(v) ? v : [String(v)]))).size;
  if (s.kind === 'last') {
    const sorted = log.date ? pool.slice().sort((a, b) => dateOf(log, b).localeCompare(dateOf(log, a))) : pool;
    const v = sorted.map((r) => fOf(r)[s.field!]).find((x) => x != null && x !== '');
    return v == null ? null : Number(v);
  }
  const ns = vals.map(Number).filter(Number.isFinite);
  if (!ns.length) return s.kind === 'sum' ? 0 : null;
  if (s.kind === 'sum') return ns.reduce((a, b) => a + b, 0);
  if (s.kind === 'avg') return ns.reduce((a, b) => a + b, 0) / ns.length;
  if (s.kind === 'min') return Math.min(...ns);
  return Math.max(...ns);
}

/** A stat's number as he reads it (money as money, minutes as hours). */
export function statWords(log: LogConfig, s: Stat, v: number | null): string {
  if (v == null) return '–';
  const f = s.field ? log.fields.find((x) => x.id === s.field) : undefined;
  if (s.kind === 'count' || s.kind === 'streak' || s.kind === 'distinct') return s.kind === 'streak' ? `${v} ${v === 1 ? 'day' : 'days'}` : num(v, 0);
  if (f?.type === 'money') return money(v);
  if (f?.type === 'duration') return mins(v);
  return `${num(v, s.kind === 'avg' ? 1 : 2)}${f?.unit ? ` ${f.unit}` : ''}`;
}

/** A goal ring: how far to the goal (reach) or how much of the limit is used (limit). */
function ring(frac: number, over: boolean): SVGSVGElement {
  const r = 15;
  const c = 2 * Math.PI * r;
  const svg = svgEl('svg', { viewBox: '0 0 36 36', class: `al-ring${over ? ' al-over' : ''}`, 'aria-hidden': 'true' });
  svg.append(svgEl('circle', { class: 'al-ringbg', cx: 18, cy: 18, r }), svgEl('circle', { class: 'al-ringfg', cx: 18, cy: 18, r, 'stroke-dasharray': `${(Math.min(1, Math.max(0, frac)) * c).toFixed(2)} ${c.toFixed(2)}`, transform: 'rotate(-90 18 18)' }));
  return svg;
}

/** The same stat over the period before (last week, last month), or the 7 days before the last 7 when it covers all time. */
function statBefore(log: LogConfig, s: Stat, rows: Rec[], now = new Date()): { cur: number | null; prev: number | null; span: string } | null {
  if (!log.date || s.kind === 'streak' || s.kind === 'last') return null;
  const p = s.period ?? 'all';
  if (p === 'all') {
    if (s.kind !== 'sum' && s.kind !== 'count') return null;
    const back = (n: number) => today(new Date(now.getFullYear(), now.getMonth(), now.getDate() - n));
    const a = back(6), b = back(13), t = today(now);
    const one = { ...s, period: 'all' as const };
    return { cur: statValue(log, one, rows.filter((r) => { const d = dateOf(log, r); return d >= a && d <= t; }), now), prev: statValue(log, one, rows.filter((r) => { const d = dateOf(log, r); return d >= b && d < a; }), now), span: 'the week before' };
  }
  const was = p === 'day' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    : p === 'week' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
    : p === 'month' ? new Date(now.getFullYear(), now.getMonth() - 1, Math.min(now.getDate(), 28))
    : new Date(now.getFullYear() - 1, now.getMonth(), Math.min(now.getDate(), 28));
  return { cur: statValue(log, s, rows, now), prev: statValue(log, s, rows, was), span: p === 'day' ? 'yesterday' : `last ${p}` };
}

/** "up 12% on last week": the stat against the period before, with whether that is good (a limit going down is). */
export function trendOf(log: LogConfig, s: Stat, rows: Rec[], now = new Date()): { words: string; dir: 'up' | 'down' | 'flat'; good: boolean } | null {
  const t = statBefore(log, s, rows, now);
  if (!t || t.cur == null || t.prev == null || !t.prev) return null;
  const pct = Math.round(((t.cur - t.prev) / Math.abs(t.prev)) * 100);
  const dir = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  const words = dir === 'flat' ? `the same as ${t.span}` : `${dir} ${Math.abs(pct)}% on ${t.span}`;
  return { words, dir, good: dir === 'flat' ? true : s.dir === 'limit' ? dir === 'down' : dir === 'up' };
}

/** The last 14 days (or 12 weeks) of a number field, for a sparkline. */
function series(log: LogConfig, field: string | undefined, rows: Rec[], now = new Date(), n = 14): number[] | null {
  if (!log.date) return null;
  const out: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = today(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
    const on = rows.filter((r) => dateOf(log, r) === day);
    out.push(field ? on.reduce((a, r) => a + (Number(fOf(r)[field]) || 0), 0) : on.length);
  }
  return out.some((v) => v) ? out : null;
}

function sparkline(vals: number[], cls = 'al-spark'): SVGSVGElement {
  const W = 100, H = 28, max = Math.max(1e-9, ...vals), min = Math.min(0, ...vals);
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * W).toFixed(1)},${(H - 2 - ((v - min) / (max - min || 1)) * (H - 4)).toFixed(1)}`);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: cls, 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  svg.append(svgEl('polygon', { class: 'al-sparkfill', points: `0,${H} ${pts.join(' ')} ${W},${H}` }), svgEl('polyline', { class: 'al-sparkline', points: pts.join(' ') }));
  const last = pts[pts.length - 1]!.split(',');
  svg.append(svgEl('circle', { class: 'al-sparkdot', cx: last[0]!, cy: last[1]!, r: 2.2 }));
  return svg;
}

/** The hero: the first stat big, with its trend, its goal ring and a sparkline; the others as metric tiles under it. */
function heroStrip(log: LogConfig, rows: Rec[]): HTMLElement | null {
  if (!log.stats?.length) return null;
  const tile = (s: Stat, big: boolean) => {
    const v = statValue(log, s, rows);
    const goal = s.goal;
    const frac = goal && v != null ? v / goal : 0;
    const over = !!goal && s.dir === 'limit' && v != null && v > goal;
    const words = statWords(log, s, v);
    const tr = trendOf(log, s, rows);
    const of = goal ? ` of ${statWords(log, s, goal)}` : '';
    const sp = series(log, s.kind === 'count' || s.kind === 'streak' || s.kind === 'distinct' ? undefined : s.field, rows);
    const left = goal ? (s.dir === 'limit' ? (v != null && v <= goal ? `${statWords(log, s, goal - v)} left` : 'Over the limit') : v != null && v >= goal ? 'Goal reached' : `${statWords(log, s, goal - (v ?? 0))} to go`) : '';
    return h(`div.al-stat${big ? '.al-lhero' : ''}`, { dataset: { kind: s.kind, ...(tr ? { trend: tr.dir, good: String(tr.good) } : {}) }, 'aria-label': `${s.label}: ${words}${of}${tr ? `, ${tr.words}` : ''}` },
      goal ? h('div.al-ringbox', ring(frac, over), big ? h('span.al-ringpct', `${Math.round(Math.min(9.99, frac) * 100)}%`) : null) : null,
      h('div.al-statwords', h('b', words), h('small', s.label + (goal ? ` · goal ${statWords(log, s, goal)}` : '')),
        tr ? h('span.al-trend', h('i', { 'aria-hidden': 'true' }, tr.dir === 'up' ? '↑' : tr.dir === 'down' ? '↓' : '→'), tr.words) : big && left ? h('span.al-trend', left) : null),
      sp ? sparkline(sp) : null);
  };
  const [first, ...rest] = log.stats;
  return h('div.al-stats', { role: 'group', 'aria-label': 'Summary' }, tile(first!, true), ...rest.map((s) => tile(s, false)));
}

/** The chart: one number field over the last 7 days, 30 days or 12 months; rounded bars, a labelled axis and today lit. */
function chart(log: LogConfig, rows: Rec[], now = new Date()): HTMLElement | null {
  const c = log.chart;
  if (!c || !log.date) return null;
  const f = log.fields.find((x) => x.id === c.field);
  const buckets: { label: string; v: number; now: boolean }[] = [];
  const val = (r: Rec) => Number(fOf(r)[c.field]) || 0;
  if (c.period === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ label: MONTHS[d.getMonth()]!.slice(0, 1), v: rows.filter((r) => dateOf(log, r).startsWith(pre)).reduce((a, r) => a + val(r), 0), now: i === 0 });
    }
  } else {
    const n = c.period === 'week' ? 7 : 30;
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const day = today(d);
      buckets.push({ label: n === 7 ? WD[(d.getDay() + 6) % 7]! : i % 7 === 0 ? String(d.getDate()) : '', v: rows.filter((r) => dateOf(log, r) === day).reduce((a, r) => a + val(r), 0), now: i === 0 });
    }
  }
  const sayN = (v: number) => (f?.type === 'money' ? money(v) : f?.type === 'duration' ? mins(v) : `${num(v)}${f?.unit ? ` ${f.unit}` : ''}`);
  const short = (v: number) => (f?.type === 'money' ? `£${v >= 1000 ? `${num(v / 1000, 1)}k` : num(v, 0)}` : f?.type === 'duration' ? (v >= 60 ? `${num(v / 60, 1)}h` : `${num(v, 0)}m`) : v >= 1000 ? `${num(v / 1000, 1)}k` : num(v, 1));
  const top = Math.max(1e-9, ...buckets.map((b) => b.v));
  const L = 30, W = 320, H = 96, T = 14, n = buckets.length, bw = (W - L) / n;
  const total = buckets.reduce((a, b) => a + b.v, 0);
  const span = c.period === 'week' ? 'the last 7 days' : c.period === 'month' ? 'the last 30 days' : 'the last 12 months';
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H + T + 14}`, class: 'al-chart', role: 'img', 'aria-label': `${f?.label ?? c.field} over ${span}: ${sayN(total)} in all` });
  const y = (v: number) => T + H - (v / top) * H;
  for (const g of [0, 0.5, 1]) {
    svg.append(svgEl('line', { class: g ? 'al-grid' : 'al-axis', x1: L, y1: y(top * g).toFixed(1), x2: W, y2: y(top * g).toFixed(1) }));
    const t = svgEl('text', { class: 'al-axistick al-ytick', x: L - 4, y: (y(top * g) + 3).toFixed(1), 'text-anchor': 'end' });
    t.textContent = total ? short(top * g) : g ? '' : '0';
    svg.append(t);
  }
  if (c.kind === 'bar') {
    buckets.forEach((b, i) => {
      const bh = Math.max(b.v ? 2 : 0, (b.v / top) * H);
      const w = bw * 0.62;
      svg.append(svgEl('rect', { class: `al-bar${b.now ? ' al-today' : ''}`, x: (L + i * bw + (bw - w) / 2).toFixed(1), y: (T + H - bh).toFixed(1), width: w.toFixed(1), height: bh.toFixed(1), rx: Math.min(4, w / 2).toFixed(1) }));
    });
  } else {
    const pts = buckets.map((b, i) => `${(L + i * bw + bw / 2).toFixed(1)},${y(b.v).toFixed(1)}`);
    svg.append(svgEl('polygon', { class: 'al-area', points: `${(L + bw / 2).toFixed(1)},${T + H} ${pts.join(' ')} ${(L + (n - 0.5) * bw).toFixed(1)},${T + H}` }), svgEl('polyline', { class: 'al-line', points: pts.join(' ') }));
    const last = pts[pts.length - 1]!.split(',');
    svg.append(svgEl('circle', { class: 'al-today al-dot', cx: last[0]!, cy: last[1]!, r: 3.5 }));
  }
  const nowB = buckets[buckets.length - 1]!;
  if (nowB.v) {
    const t = svgEl('text', { class: 'al-axistick al-nowval', x: (L + (n - 0.5) * bw).toFixed(1), y: (y(nowB.v) - 4).toFixed(1), 'text-anchor': 'end' });
    t.textContent = short(nowB.v);
    svg.append(t);
  }
  buckets.forEach((b, i) => {
    if (!b.label) return;
    const t = svgEl('text', { class: `al-axistick${b.now ? ' al-nowtick' : ''}`, x: (L + i * bw + bw / 2).toFixed(1), y: T + H + 12, 'text-anchor': 'middle' });
    t.textContent = b.label;
    svg.append(t);
  });
  return h('figure.al-chartbox', sectionHead(`${f?.label ?? ''}, ${span}`, sayN(total)), svg);
}

// ── the field editor sheet ──────────────────────────────────────────────────────────────

/** Read a picked photo down to a small JPEG kept on the phone (600 px on its long side). */
function shrink(file: File): Promise<string> {
  return new Promise((done, fail) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      done(c.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('not a picture')); };
    img.src = url;
  });
}

/** One field's control in the sheet; `get` reads what he set. */
function control(f: Field, v: Val, k: KitApp): { el: HTMLElement; get(): Val } {
  const id = `al-${f.id}-${Math.random().toString(36).slice(2, 7)}`;
  const label = h('label.al-flabel', { htmlFor: id }, f.label, f.required ? h('span.al-req', ' (needed)') : null);
  const wrap = (...kids: (Node | null)[]) => h('div.al-field', { dataset: { type: f.type, field: f.id } }, label, ...kids);
  const input = (type: string, extraProps: Record<string, unknown> = {}) => h('input.al-in', { id, type, value: v == null ? '' : String(v), placeholder: f.hint ?? '', ...extraProps }) as HTMLInputElement;
  switch (f.type) {
    case 'long': {
      const t = h('textarea.al-in', { id, rows: 3, placeholder: f.hint ?? '' }) as HTMLTextAreaElement;
      t.value = v == null ? '' : String(v);
      return { el: wrap(t), get: () => t.value.trim() || undefined };
    }
    case 'number': case 'money': {
      const i = input('number', { inputMode: 'decimal', step: f.step ?? (f.type === 'money' ? 0.01 : 'any'), ...(f.min != null ? { min: f.min } : {}), ...(f.max != null ? { max: f.max } : {}) });
      const row = h('div.al-inrow', f.type === 'money' ? h('span.al-unit', '£') : null, i, f.unit ? h('span.al-unit', f.unit) : null);
      return { el: wrap(row), get: () => (i.value.trim() === '' ? undefined : Number(i.value)) };
    }
    case 'duration': {
      const t = Number(v) || 0;
      const hh = h('input.al-in', { id, type: 'number', inputMode: 'numeric', min: 0, value: v == null ? '' : String(Math.floor(t / 60)), 'aria-label': `${f.label} hours` }) as HTMLInputElement;
      const mm = h('input.al-in', { type: 'number', inputMode: 'numeric', min: 0, max: 59, value: v == null ? '' : String(t % 60), 'aria-label': `${f.label} minutes` }) as HTMLInputElement;
      return { el: wrap(h('div.al-inrow', hh, h('span.al-unit', 'h'), mm, h('span.al-unit', 'min'))), get: () => (hh.value === '' && mm.value === '' ? undefined : (Number(hh.value) || 0) * 60 + (Number(mm.value) || 0)) };
    }
    case 'date': { const i = input('date'); return { el: wrap(i), get: () => i.value || undefined }; }
    case 'time': { const i = input('time'); return { el: wrap(i), get: () => i.value || undefined }; }
    case 'link': { const i = input('url', { inputMode: 'url', placeholder: f.hint ?? 'https://' }); return { el: wrap(i), get: () => i.value.trim() || undefined }; }
    case 'choice': case 'multi': {
      const multi = f.type === 'multi';
      const on = new Set(multi ? (Array.isArray(v) ? v : []) : v != null ? [String(v)] : []);
      const chips = (f.options ?? []).map((o) => {
        const b = h('button.al-chip', { type: 'button', role: multi ? 'checkbox' : 'radio', 'aria-checked': String(on.has(o)) }, o);
        b.addEventListener('click', () => {
          if (multi) { if (on.has(o)) on.delete(o); else on.add(o); } else { const was = on.has(o); on.clear(); if (!was) on.add(o); }
          for (const c of chips) c.setAttribute('aria-checked', String(on.has(c.textContent ?? '')));
        });
        return b;
      });
      label.removeAttribute('for');
      return { el: wrap(h('div.al-chips', { role: multi ? 'group' : 'radiogroup', 'aria-label': f.label }, ...chips)), get: () => (multi ? (on.size ? (f.options ?? []).filter((o) => on.has(o)) : undefined) : [...on][0]) };
    }
    case 'rating': {
      let n = Number(v) || 0;
      const stars = [1, 2, 3, 4, 5].map((i) => {
        const b = h('button.al-star', { type: 'button', 'aria-label': `${i} of 5`, 'aria-pressed': String(i <= n) }, i <= n ? '★' : '☆');
        b.addEventListener('click', () => { n = n === i ? 0 : i; stars.forEach((s, j) => { s.textContent = j < n ? '★' : '☆'; s.setAttribute('aria-pressed', String(j < n)); }); });
        return b;
      });
      label.removeAttribute('for');
      return { el: wrap(h('div.al-stars', { role: 'group', 'aria-label': f.label }, ...stars)), get: () => n || undefined };
    }
    case 'scale': {
      const lo = f.min ?? 1, hi = f.max ?? 10;
      const i = input('range', { min: lo, max: hi, step: f.step ?? 1, value: String(v ?? Math.round((lo + hi) / 2)) });
      const out = h('output.al-scaleval', String(i.value));
      i.addEventListener('input', () => (out.textContent = i.value));
      return { el: wrap(h('div.al-inrow', i, out)), get: () => Number(i.value) };
    }
    case 'check': {
      let on = !!v;
      const b = h('button.ak-switch', { id, type: 'button', role: 'switch', 'aria-checked': String(on) }, h('span', on ? 'Yes' : 'No'), h('i'));
      b.addEventListener('click', () => { on = !on; b.setAttribute('aria-checked', String(on)); b.querySelector('span')!.textContent = on ? 'Yes' : 'No'; });
      return { el: wrap(b), get: () => on };
    }
    case 'photo': {
      let src = typeof v === 'string' ? v : '';
      const pic = h('div.al-photo');
      const file = h('input', { id, type: 'file', accept: 'image/*', hidden: true }) as HTMLInputElement;
      const draw = () => pic.replaceChildren(src ? h('img', { src, alt: f.label }) : h('span.al-photonone', 'No photo yet'));
      const pick = key(src ? 'Change photo' : 'Add photo', () => file.click());
      const drop = key('Remove', () => { src = ''; draw(); });
      file.addEventListener('change', async () => {
        const fl = file.files?.[0];
        if (!fl) return;
        try { src = await shrink(fl); draw(); } catch { k.notice('That file is not a picture this phone can read.', { tone: 'warn' }); }
      });
      draw();
      return { el: wrap(pic, h('div.al-inrow', pick, drop), file), get: () => src || undefined };
    }
    default: { const i = input('text'); return { el: wrap(i), get: () => i.value.trim() || undefined }; }
  }
}

/** The editor sheet: a new record, or one he tapped (with its delete). */
export function editSheet(def: AppDef, log: LogConfig, k: KitApp, rec?: Rec, preset: Record<string, Val> = {}): void {
  k.el.querySelector('.al-edit')?.remove();
  const start = rec ? { ...fOf(rec) } : { ...blank(log), ...preset };
  const ctl = log.fields.map((f) => ({ f, c: control(f, start[f.id], k) }));
  const sheet = h('div.ak-sheet.al-edit', { role: 'dialog', 'aria-label': rec ? `Change ${rec.title}` : `New ${def.name} entry` });
  const close = () => sheet.remove();
  const save = () => {
    const f: Record<string, Val> = {};
    for (const { f: fd, c } of ctl) { const v = c.get(); if (v !== undefined) f[fd.id] = v; }
    const miss = log.fields.find((fd) => fd.required && (f[fd.id] == null || f[fd.id] === ''));
    if (miss) return k.notice(`${miss.label} is needed.`, { tone: 'warn' });
    const r = recordOf(log, f, rec?.id ?? newId());
    if (rec) k.update(rec.id, r);
    else k.add(r);
    close();
    k.notice(rec ? `Saved “${r.title}”.` : `Added “${r.title}”.`, { tone: 'ok' });
  };
  sheet.append(
    h('h3.ak-sheethead', rec ? 'Change' : 'New'),
    ...ctl.map((x) => x.c.el),
    h('div.al-sheetkeys', key('Save', save, { kind: 'fill' }), key('Cancel', close), rec ? key('Delete', () => { close(); deleteWithUndo(k, rec); }) : null),
  );
  k.el.append(sheet);
  sheet.querySelector<HTMLInputElement>('input.al-in:not([type=range]):not([type=file]), textarea')?.focus({ preventScroll: true });
}

// ── the views ──────────────────────────────────────────────────────────────────────────

function matches(r: Rec, q: string): boolean {
  if (!q) return true;
  const words = [r.title, r.sub ?? '', r.meta ?? '', ...Object.values(fOf(r)).map((v) => (Array.isArray(v) ? v.join(' ') : typeof v === 'string' && !v.startsWith('data:') ? v : ''))].join(' ').toLowerCase();
  return words.includes(q);
}

function sorted(log: LogConfig, rows: Rec[]): Rec[] {
  const s = log.sort ?? (log.date ? { field: log.date, dir: 'desc' as const } : null);
  if (!s) return rows;
  const f = log.fields.find((x) => x.id === s.field);
  const num_ = f && NUMERIC.has(f.type);
  return rows.slice().sort((a, b) => {
    const x = fOf(a)[s.field], y = fOf(b)[s.field];
    if (x == null || x === '') return 1;
    if (y == null || y === '') return -1;
    const c = num_ ? Number(x) - Number(y) : String(x).localeCompare(String(y));
    return s.dir === 'asc' ? c : -c;
  });
}

/** The skin a log draws in: the app's own, else its family's (a money log reads like a bank's, a body log like a health app's). */
export const skinOf = (def: AppDef): Skin => def.skin ?? (def.family as Skin);

const photoOf = (log: LogConfig, r: Rec) => { const p = log.fields.find((f) => f.type === 'photo'); const v = p ? fOf(r)[p.id] : undefined; return typeof v === 'string' && v ? v : ''; };
/** The choice a row is filed under (its group, else its first choice field), and that option's place, for its colour. */
function categoryOf(log: LogConfig, r: Rec): { word: string; tone: number } | null {
  const g = log.fields.find((f) => f.id === log.group) ?? log.fields.find((f) => f.type === 'choice');
  const v = g ? fOf(r)[g.id] : undefined;
  if (!g || v == null || v === '') return null;
  const i = (g.options ?? []).indexOf(String(v));
  return { word: String(v), tone: (i < 0 ? 0 : i) % 6 };
}
const initials = (t: string) => t.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '·';

/** The thumbnail at a row's left: his photo, else a round category mark (a bank's), else the initials. */
function thumb(def: AppDef, log: LogConfig, r: Rec): HTMLElement {
  const src = photoOf(log, r);
  if (src) return h('span.al-thumb.al-thumbpic', h('img', { src, alt: '', loading: 'lazy' }));
  const c = categoryOf(log, r);
  if (c) return h('span.al-thumb', { dataset: { tone: String(c.tone) }, 'aria-hidden': 'true' }, skinOf(def) === 'money' || skinOf(def) === 'body' ? icon(glyphOf(def.glyph)) : initials(c.word));
  return h('span.al-thumb', { dataset: { tone: String(r.title.length % 6) }, 'aria-hidden': 'true' }, initials(r.title));
}

/** The little things under a row's title: its stars and its chips. */
function rowBits(log: LogConfig, r: Rec): HTMLElement | null {
  const kids: HTMLElement[] = [];
  const rate = log.fields.find((f) => f.type === 'rating');
  const n = rate ? Math.round(Number(fOf(r)[rate.id]) || 0) : 0;
  if (n) kids.push(h('span.al-rowstars', { 'aria-label': `${n} of 5 stars` }, '★'.repeat(n), h('i', '★'.repeat(5 - n))));
  const shown = new Set([log.sub, log.meta, log.title].flatMap((t) => (t ? (t.includes('{') ? [...t.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]) : [t]) : [])));
  for (const f of log.fields) {
    if (kids.length >= 4 || shown.has(f.id)) continue;
    const v = fOf(r)[f.id];
    if (f.type === 'multi' && Array.isArray(v)) kids.push(...v.slice(0, 2).map((o) => h('span.al-rowchip', o)));
    else if (f.type === 'choice' && v != null && v !== '' && f.id !== log.group) kids.push(h('span.al-rowchip', String(v)));
    else if (f.type === 'check' && v === true) kids.push(h('span.al-rowchip', f.label));
  }
  return kids.length ? h('span.al-rowbits', ...kids) : null;
}

/** The main action a swipe right does: tick its yes-or-no, move it to the next column, or log it again today. */
function mainAction(log: LogConfig): { word: (r: Rec) => string; run: (r: Rec, k: KitApp) => void } {
  const chk = log.fields.find((f) => f.type === 'check');
  if (chk) return { word: (r) => (fOf(r)[chk.id] ? `Untick ${chk.label}` : chk.label), run: (r, k) => { const on = !fOf(r)[chk.id]; k.update(r.id, recordOf(log, { ...fOf(r), [chk.id]: on }, r.id)); k.notice(`${r.title}: ${chk.label} ${on ? 'ticked' : 'unticked'}.`, { tone: 'ok' }); } };
  const g = log.fields.find((f) => f.id === log.group && f.type === 'choice' && f.options?.length);
  if (g) {
    const next = (r: Rec) => { const o = g.options!; return o[(o.indexOf(String(fOf(r)[g.id] ?? o[0])) + 1) % o.length]!; };
    return { word: (r) => `To ${next(r)}`, run: (r, k) => { const to = next(r); k.update(r.id, recordOf(log, { ...fOf(r), [g.id]: to }, r.id)); k.notice(`Moved “${r.title}” to ${to}.`, { tone: 'ok' }); } };
  }
  return {
    word: () => (log.date ? 'Again today' : 'Copy'),
    run: (r, k) => { const f = { ...fOf(r), ...(log.date ? { [log.date]: today() } : {}) }; const c = recordOf(log, f); k.add(c); k.notice(`Added “${c.title}” again${log.date ? ' today' : ''}.`, { tone: 'ok' }); },
  };
}

/** Delete with the kit (so Recently deleted holds it) and offer Undo right in the notice. */
export function deleteWithUndo(k: KitApp, r: Rec): void {
  k.remove(r.id);
  const note = k.el.querySelector<HTMLElement>('.ak-notice');
  if (!note) return;
  note.querySelector('.al-undo')?.remove();
  const b = key('Undo', () => { k.undo(); b.remove(); k.notice(`Put back “${r.title}”.`, { tone: 'ok' }); }, { label: `Undo delete ${r.title}` });
  b.classList.add('al-undo');
  note.append(' ', b);
}

/** Swipe on a row's face: left past halfway deletes, right past halfway does the main action; a short swipe leaves its key showing. */
function swipeable(row: HTMLElement, face: HTMLElement, left: () => void, right: () => void): { moved: () => boolean; close: () => void } {
  let x0 = 0, y0 = 0, dx = 0, on = false, dragging = false, open = 0, moved = false, pid = -1;
  const OPEN = 84;
  const set = (x: number, anim: boolean) => { face.style.transition = anim ? '' : 'none'; face.style.transform = x ? `translateX(${x}px)` : ''; row.dataset.swipe = x < 0 ? 'left' : x > 0 ? 'right' : ''; };
  const close = () => { open = 0; set(0, true); };
  face.addEventListener('pointerdown', (e) => { if (e.button) return; x0 = e.clientX; y0 = e.clientY; dx = 0; on = true; dragging = false; moved = false; pid = e.pointerId; });
  face.addEventListener('pointermove', (e) => {
    if (!on || e.pointerId !== pid) return;
    const mx = e.clientX - x0, my = e.clientY - y0;
    if (!dragging) {
      if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { on = false; return; }
      if (Math.abs(mx) < 8) return;
      dragging = true;
      moved = true;
      try { face.setPointerCapture(pid); } catch { /* (an old browser: the move still follows) */ }
    }
    dx = open + mx;
    const w = row.clientWidth || 1;
    set(Math.max(-w, Math.min(w, dx)), false);
  });
  const end = () => {
    if (!on) return;
    on = false;
    if (!dragging) return;
    const w = row.clientWidth || 1;
    if (dx < -w * 0.5) { set(-w, true); setTimeout(left, 160); }
    else if (dx > w * 0.5) { set(0, true); open = 0; right(); }
    else if (dx < -OPEN / 2) { open = -OPEN; set(open, true); }
    else if (dx > OPEN / 2) { open = OPEN; set(open, true); }
    else close();
    setTimeout(() => (moved = false), 0);
  };
  face.addEventListener('pointerup', end);
  face.addEventListener('pointercancel', () => { on = false; if (dragging) close(); });
  return { moved: () => moved || open !== 0, close };
}

/** One rich row: thumbnail, title, line, stars and chips, the value at the right; swipe for delete and the main action; tap for its page. */
function richRow(def: AppDef, log: LogConfig, k: KitApp, r: Rec): HTMLElement {
  const act = mainAction(log);
  const main = h('button.ak-rowmain', { type: 'button' }, thumb(def, log, r),
    h('span.al-rowtext', h('b.ak-rowtitle', r.title), r.sub ? h('small.ak-rowsub', r.sub) : null, rowBits(log, r)));
  const face = h('div.al-rowface', main, r.meta ? h('span.ak-rowmeta', r.meta) : null);
  const doAct = () => act.run(r, k);
  const doDel = () => deleteWithUndo(k, r);
  const back = h('div.al-swback', { 'aria-hidden': 'true' },
    h('button.al-swact', { type: 'button', tabIndex: -1, onclick: doAct }, act.word(r)),
    h('button.al-swdel', { type: 'button', tabIndex: -1, onclick: doDel }, 'Delete'));
  const row = h('div.ak-row.al-row', { role: 'listitem', dataset: { id: r.id } }, back, face);
  const sw = swipeable(row, face, doDel, doAct);
  main.addEventListener('click', () => { if (sw.moved()) return sw.close(); itemPage(def, log, k, r); });
  // VoiceOver and keyboards: the same two actions, named
  main.setAttribute('aria-label', [r.title, r.sub, r.meta].filter(Boolean).join(', '));
  return row;
}

/** The item's own page: the big photo (or its art), the fields as a clean sheet, Edit and Delete. */
export function itemPage(def: AppDef, log: LogConfig, k: KitApp, r: Rec): HTMLElement {
  k.el.querySelector('.al-item')?.remove();
  const f = fOf(r);
  const src = photoOf(log, r);
  const cat = categoryOf(log, r);
  const close = () => { page.classList.add('al-leaving'); setTimeout(() => page.remove(), 180); k.el.removeEventListener('keydown', esc); };
  const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
  const rate = log.fields.find((x) => x.type === 'rating');
  const stars = rate ? Math.round(Number(f[rate.id]) || 0) : 0;
  const titleIds = new Set((log.title.includes('{') ? [...log.title.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]) : [log.title]));
  const rows = log.fields.filter((x) => x.type !== 'photo' && x.type !== 'long' && x.type !== 'rating' && !titleIds.has(x.id)).map((x) => ({ x, v: show(x, f[x.id]) })).filter((x) => x.v);
  const longs = log.fields.filter((x) => x.type === 'long' && f[x.id]);
  const page: HTMLElement = h('div.al-item', { role: 'dialog', 'aria-modal': 'true', 'aria-label': r.title },
    h('div.al-itembar', key('', close, { label: 'Back', glyph: '<path d="M15 5l-7 7 7 7"/>' }), h('span.al-itembarname', def.name), key('Edit', () => { close(); editSheet(def, log, k, r); }, { label: `Edit ${r.title}` })),
    h('div.al-itemscroll',
      h('div.al-itemart', { dataset: { tone: String(cat?.tone ?? 0) } }, src ? h('img', { src, alt: r.title }) : icon(glyphOf(def.glyph), 'al-itemglyph')),
      h('div.al-itemhead', h('h2.al-itemtitle', r.title), r.sub ? h('p.al-itemsub', r.sub) : null,
        stars ? h('p.al-itemstars', { 'aria-label': `${stars} of 5 stars` }, '★'.repeat(stars), h('i', '★'.repeat(5 - stars))) : null,
        r.meta ? h('p.al-itemmeta', r.meta) : null),
      rows.length ? h('dl.al-itemsheet', ...rows.flatMap(({ x, v }) => [h('div.al-itemrow', { dataset: { field: x.id } }, h('dt', x.label), h('dd', v))])) : null,
      ...longs.map((x) => h('section.al-itemlong', h('h3', x.label), h('p', String(f[x.id])))),
      h('div.al-itemkeys', key(mainAction(log).word(r), () => { close(); mainAction(log).run(r, k); }), key('Delete', () => { close(); deleteWithUndo(k, r); }, { label: `Delete ${r.title}` }))));
  k.el.append(page);
  k.el.addEventListener('keydown', esc);
  page.querySelector<HTMLButtonElement>('.al-itembar button')?.focus({ preventScroll: true });
  return page;
}

const dayHead = (d: string) => {
  const t = today(), y = today(new Date(Date.now() - 864e5));
  if (d === t) return 'Today';
  if (d === y) return 'Yesterday';
  const x = parseDay(d);
  return x ? `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]!.slice(0, 3)}${x.getFullYear() !== new Date().getFullYear() ? ` ${x.getFullYear()}` : ''}` : d;
};

function listView(def: AppDef, log: LogConfig, k: KitApp, rows: Rec[]): HTMLElement[] {
  const list = (rs: Rec[]) => h('div.al-list', { role: 'list' }, ...rs.map((r) => richRow(def, log, k, r)));
  // a money log reads like a bank's: grouped by day, each day with its total
  const money_ = log.fields.find((f) => f.type === 'money' && (f.id === log.meta || log.chart?.field === f.id || log.stats?.some((s) => s.field === f.id)));
  if (skinOf(def) === 'money' && log.date && (!log.sort || log.sort.field === log.date)) {
    const days = [...new Set(rows.map((r) => dateOf(log, r)))];
    return days.map((d) => {
      const on = rows.filter((r) => dateOf(log, r) === d);
      const sum = money_ ? on.reduce((a, r) => a + (Number(fOf(r)[money_.id]) || 0), 0) : 0;
      return h('section.al-group.al-dayg', { dataset: { day: d } }, sectionHead(d ? dayHead(d) : 'No date', money_ ? money(sum) : String(on.length)), list(on));
    });
  }
  const g = log.group ? log.fields.find((f) => f.id === log.group) : undefined;
  if (!g) return [list(rows)];
  const groups = [...(g.options ?? []), ''];
  return groups.map((o) => {
    const in_ = rows.filter((r) => (String(fOf(r)[g.id] ?? '')) === o || (!o && !(g.options ?? []).includes(String(fOf(r)[g.id] ?? ''))));
    return in_.length ? h('section.al-group', sectionHead(o || `No ${g.label.toLowerCase()}`, String(in_.length)), list(in_)) : null;
  }).filter((x): x is HTMLElement => !!x);
}

/** Drag a board card by its grip to another column (its Move key does the same in one tap). */
function dragCard(card: HTMLElement, grip: HTMLElement, drop: (col: string) => void): void {
  let pid = -1, y0 = 0, x0 = 0;
  const colAt = (x: number, y: number) => (document.elementFromPoint(x, y)?.closest('.al-col') as HTMLElement | null);
  grip.addEventListener('pointerdown', (e) => {
    pid = e.pointerId; x0 = e.clientX; y0 = e.clientY;
    try { grip.setPointerCapture(pid); } catch { /* (still follows) */ }
    card.classList.add('al-dragging');
  });
  grip.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    card.style.transform = `translate(${e.clientX - x0}px, ${e.clientY - y0}px) scale(1.03)`;
    // near the top or the bottom of the scroll area, it scrolls along
    const body = card.closest<HTMLElement>('.ak-body');
    if (body) { const r = body.getBoundingClientRect(); if (e.clientY < r.top + 40) body.scrollTop -= 12; else if (e.clientY > r.bottom - 40) body.scrollTop += 12; }
    const over = colAt(e.clientX, e.clientY);
    for (const c of card.closest('.ak-body')?.querySelectorAll('.al-col') ?? []) c.classList.toggle('al-dropping', c === over);
  });
  const end = (e: PointerEvent, ok: boolean) => {
    if (e.pointerId !== pid) return;
    pid = -1;
    card.classList.remove('al-dragging');
    card.style.transform = '';
    for (const c of card.closest('.ak-body')?.querySelectorAll('.al-col') ?? []) c.classList.remove('al-dropping');
    if (!ok) return;
    card.style.visibility = 'hidden';
    const over = colAt(e.clientX, e.clientY);
    card.style.visibility = '';
    const to = over?.dataset.col;
    if (to && to !== card.closest<HTMLElement>('.al-col')?.dataset.col) drop(to);
  };
  grip.addEventListener('pointerup', (e) => end(e, true));
  grip.addEventListener('pointercancel', (e) => end(e, false));
}

function boardView(def: AppDef, log: LogConfig, k: KitApp, rows: Rec[]): HTMLElement[] {
  const g = log.fields.find((f) => f.id === log.group);
  if (!g?.options) return listView(def, log, k, rows);
  const opts = g.options;
  const moveTo = (r: Rec, to: string) => { k.update(r.id, recordOf(log, { ...fOf(r), [g.id]: to }, r.id)); k.notice(`Moved “${r.title}” to ${to}.`, { tone: 'ok' }); };
  return [h('div.al-board', ...opts.map((o, i) => {
    const col = rows.filter((r) => String(fOf(r)[g.id] ?? opts[0]) === o);
    const next = opts[(i + 1) % opts.length]!;
    return h('section.al-col', { dataset: { col: o } }, sectionHead(o, String(col.length)),
      col.length ? h('div.al-cards', ...col.map((r) => {
        const open = h('button.al-cardmain', { type: 'button' }, h('b', r.title), r.sub ? h('small', r.sub) : null, rowBits(log, r));
        open.addEventListener('click', () => itemPage(def, log, k, r));
        const grip = h('span.al-grip', { 'aria-hidden': 'true', title: 'Drag to another column' }, h('i'), h('i'), h('i'));
        const move = key(`To ${next}`, () => moveTo(r, next), { label: `Move ${r.title} to ${next}` });
        const card = h('div.al-bcard', { dataset: { id: r.id } }, grip, photoOf(log, r) ? h('img.al-bpic', { src: photoOf(log, r), alt: '' }) : null, open, move);
        dragCard(card, grip, (to) => moveTo(r, to));
        return card;
      })) : h('p.al-none', 'Nothing here. Drag a card in.'));
  }))];
}

function calendarView(def: AppDef, log: LogConfig, k: KitApp, rows: Rec[], st: { get(): View; set(v: View): void }, again: () => void): HTMLElement[] {
  const v = st.get();
  const now = new Date();
  const [y, m] = (v.month ?? `${now.getFullYear()}-${now.getMonth()}`).split('-').map(Number) as [number, number];
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const byDay = new Map<string, Rec[]>();
  for (const r of rows) { const d = dateOf(log, r); if (d) byDay.set(d, [...(byDay.get(d) ?? []), r]); }
  // the heat: the chart's number where there is one, else how many
  const cf = log.chart?.field;
  const weight = (rs: Rec[]) => (cf ? rs.reduce((a, r) => a + (Number(fOf(r)[cf]) || 0), 0) || rs.length : rs.length);
  const pre = `${y}-${String(m + 1).padStart(2, '0')}`;
  const inMonth = [...byDay.entries()].filter(([d]) => d.startsWith(pre));
  const peak = Math.max(1e-9, ...inMonth.map(([, rs]) => weight(rs)));
  const shift = (n: number) => { const d = new Date(y, m + n, 1); st.set({ ...v, month: `${d.getFullYear()}-${d.getMonth()}`, day: undefined }); again(); };
  const count = inMonth.reduce((a, [, rs]) => a + rs.length, 0);
  const head = h('div.al-calhead', key('', () => shift(-1), { label: 'Previous month', glyph: '<path d="M15 5l-7 7 7 7"/>' }), h('div.al-calname', h('b', `${MONTHS[m]} ${y}`), h('small', `${count} ${count === 1 ? 'entry' : 'entries'} · ${inMonth.length} ${inMonth.length === 1 ? 'day' : 'days'}`)), key('', () => shift(1), { label: 'Next month', glyph: '<path d="M9 5l7 7-7 7"/>' }));
  const cells: HTMLElement[] = WD.map((w) => h('span.al-wd', { 'aria-hidden': 'true' }, w));
  for (let i = 0; i < lead; i++) cells.push(h('span.al-blank'));
  for (let d = 1; d <= days; d++) {
    const day = `${pre}-${String(d).padStart(2, '0')}`;
    const on = byDay.get(day) ?? [];
    const n = on.length;
    const level = n ? Math.max(1, Math.min(4, Math.ceil((weight(on) / peak) * 4))) : 0;
    const b = h('button.al-day', { type: 'button', 'aria-label': `${dayWords(day)}: ${n ? `${n} ${n === 1 ? 'entry' : 'entries'}` : 'nothing'}`, 'aria-pressed': String(v.day === day), dataset: { today: String(day === today(now)), n: String(n), level: String(level) } }, h('span', String(d)));
    b.addEventListener('click', () => { st.set({ ...v, day: v.day === day ? undefined : day }); again(); });
    cells.push(b);
  }
  const legend = h('div.al-heatkey', { 'aria-hidden': 'true' }, h('small', 'Less'), ...[0, 1, 2, 3, 4].map((l) => h('i', { dataset: { level: String(l) } })), h('small', 'More'));
  const pick = v.day ? byDay.get(v.day) ?? [] : [];
  const below = v.day
    ? h('section.al-group', sectionHead(dayWords(v.day), String(pick.length)), pick.length ? h('div.al-list', { role: 'list' }, ...pick.map((r) => richRow(def, log, k, r))) : null,
      key(`Add on ${dayWords(v.day)}`, () => editSheet(def, log, k, undefined, { [log.date!]: v.day! }), { glyph: PLUS }))
    : h('p.al-none', 'Tap a day to see what is on it.');
  return [head, h('div.al-cal', { role: 'group', 'aria-label': `${MONTHS[m]} ${y}` }, ...cells), legend, below];
}

function galleryView(def: AppDef, log: LogConfig, k: KitApp, rows: Rec[]): HTMLElement[] {
  const SHAPES = ['1', '0.78', '1.25', '0.9', '1.1'];
  return [h('div.al-gallery', ...rows.map((r, i) => {
    const src = photoOf(log, r);
    const cat = categoryOf(log, r);
    const b = h('button.al-tile', { type: 'button', 'aria-label': [r.title, r.sub].filter(Boolean).join(', '), dataset: { tone: String(cat?.tone ?? i % 6) } },
      src ? h('img', { src, alt: '', loading: 'lazy' }) : h('span.al-tileicon', { style: `aspect-ratio: ${SHAPES[i % SHAPES.length]}` }, icon(glyphOf(def.glyph))),
      h('span.al-tilewords', h('b', r.title), r.sub ? h('small', r.sub) : null, r.meta ? h('em', r.meta) : null));
    b.addEventListener('click', () => itemPage(def, log, k, r));
    return b;
  }))];
}

/** The quick-add bar: one line of plain words, read into the fields as he types (shown as chips); the full form one tap away. */
function quickBar(def: AppDef, log: LogConfig, k: KitApp): HTMLElement {
  const ex = quickExample(log, def.sample?.[0] as Record<string, unknown> | undefined);
  const input = h('input.al-quickin', { type: 'text', enterKeyHint: 'done', autocomplete: 'off', placeholder: ex ? `e.g. ${ex}` : `Add to ${def.name} in plain words`, 'aria-label': `Quick add to ${def.name}` }) as HTMLInputElement;
  const read = h('div.al-quickread', { 'aria-live': 'polite' });
  const preview = () => {
    const t = input.value.trim();
    if (!t) { read.replaceChildren(); read.hidden = true; return; }
    const r = quickAdd(log, t);
    read.hidden = false;
    read.replaceChildren(...r.used.map((id) => { const f = log.fields.find((x) => x.id === id)!; return h('span.al-quickchip', { dataset: { field: id } }, h('small', f.label), ' ', show(f, r.fields[id] as Val) || String(r.fields[id])); }));
  };
  const add = () => {
    const t = input.value.trim();
    if (!t) return input.focus();
    const r = quickAdd(log, t);
    const f: Record<string, Val> = { ...blank(log), ...(r.fields as Record<string, Val>) };
    const miss = log.fields.find((fd) => fd.required && (f[fd.id] == null || f[fd.id] === ''));
    input.value = '';
    preview();
    if (miss) { editSheet(def, log, k, undefined, r.fields as Record<string, Val>); k.notice(`Add the ${miss.label.toLowerCase()} to finish.`); return; }
    const rec = recordOf(log, f);
    k.add(rec);
    k.notice(`Added “${rec.title}”.`, { tone: 'ok' });
    const note = k.el.querySelector<HTMLElement>('.ak-notice');
    if (note) { const b = key('Undo', () => { k.undo(); b.remove(); }, { label: `Undo adding ${rec.title}` }); b.classList.add('al-undo'); note.append(' ', b); }
  };
  input.addEventListener('input', preview);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
  read.hidden = true;
  return h('div.al-quick', h('div.al-quickrow', h('span.al-quickplus', { 'aria-hidden': 'true' }, icon(PLUS)), input, key('Add', add, { kind: 'fill', label: 'Quick add' }), key('', () => editSheet(def, log, k, undefined, input.value.trim() ? (quickAdd(log, input.value).fields as Record<string, Val>) : {}), { label: 'The full form', glyph: '<path d="M4 7h16M4 12h16M4 17h10"/>' })), read);
}

/** The empty state: the app's own art and one inviting line. */
function emptyState(def: AppDef, words: string, act?: { word: string; run: () => void }): HTMLElement {
  return h('div.ak-state.ak-empty.al-empty', { role: 'status' }, h('span.al-emptyart', { 'aria-hidden': 'true' }, h('i'), h('i'), icon(glyphOf(def.glyph))), h('p', words), act ? key(act.word, act.run, { kind: 'fill' }) : null);
}

/** The loading skeleton in the log's own final shape: the hero, the tiles and rows with their thumbnails. */
export function logSkeleton(rowsN = 5): HTMLElement {
  return h('div.al-skel', { 'aria-busy': 'true', 'aria-label': 'Loading' }, h('div.al-skelhero', h('i'), h('i'), h('i')), h('div.al-skeltiles', h('i'), h('i')),
    ...Array.from({ length: rowsN }, () => h('div.al-skelrow', h('i.al-skelthumb'), h('span', h('i'), h('i')), h('i.al-skelmeta'))));
}

interface View {
  view?: string;
  month?: string;
  day?: string;
  told?: string;
}
const VIEW_WORDS: Record<string, string> = { list: 'List', board: 'Board', calendar: 'Calendar', gallery: 'Gallery' };

/** The reminders due today ("Drink by today: Chablis"), worded from remind.words with the record's fields. */
export function dueToday(log: LogConfig, rows: Rec[], now = new Date()): string[] {
  const r = log.remind;
  if (!r) return [];
  const day = today(now);
  return rows.filter((x) => String(fOf(x)[r.field] ?? '') === day).map((x) => fill(log, r.words, fOf(x)) || x.title);
}

let styled = false;
/** Draw a log (also the importer's records, with `opts.add` false when the records come only from his file). */
export function drawLog(root: HTMLElement, def: AppDef, k: KitApp, log: LogConfig, opts: { add?: boolean; top?: () => HTMLElement | null } = {}): () => void {
  if (!styled && !document.getElementById('al-log-style')) { document.head.append(h('style#al-log-style', css)); styled = true; }
  const st = extra<View>(def.id, 'view', {});
  const views = log.views?.length ? log.views : ['list' as const];
  const skin = skinOf(def);
  k.el.dataset.lskin = skin;
  if (opts.add !== false) toolKey(k, key('Add', () => editSheet(def, log, k), { glyph: PLUS, label: `Add to ${def.name}` }));
  let bar: HTMLElement | null = null;
  const draw = () => {
    const v = st.get();
    const view = views.includes(v.view as never) ? v.view! : views[0]!;
    const all = recs(k);
    const q = queryOf(k);
    const rows = sorted(log, all.filter((r) => matches(r, q)));
    const parts: (HTMLElement | null)[] = [opts.top?.() ?? null];
    if (!q && all.length) parts.push(heroStrip(log, all), chart(log, all));
    if (opts.add !== false && !q) parts.push(bar ??= quickBar(def, log, k));
    if (views.length > 1 && all.length) {
      parts.push(h('div.al-seg', { role: 'tablist', 'aria-label': 'Views' }, ...views.map((w) => {
        const b = h('button.al-segkey', { type: 'button', role: 'tab', 'aria-selected': String(w === view) }, VIEW_WORDS[w]);
        b.addEventListener('click', () => { st.set({ ...st.get(), view: w }); draw(); });
        return b;
      })));
    }
    if (!all.length) parts.push(emptyState(def, opts.add === false ? 'Nothing read yet. Pick your file above and it all lands here.' : `${def.name} starts here. Type your first one above in plain words.`, opts.add === false ? undefined : { word: 'Add the first', run: () => (bar?.querySelector<HTMLInputElement>('.al-quickin')?.focus() ?? editSheet(def, log, k)) }));
    else if (!rows.length) parts.push(stateCard('empty', `Nothing matches “${q}”.`, { word: 'Clear search', run: () => { const f = k.el.querySelector<HTMLInputElement>('.ak-find'); if (f) f.value = ''; k.search(''); } }));
    else if (view === 'board') parts.push(...boardView(def, log, k, rows));
    else if (view === 'calendar') parts.push(...calendarView(def, log, k, rows, st, draw));
    else if (view === 'gallery') parts.push(...galleryView(def, log, k, rows));
    else parts.push(...listView(def, log, k, rows));
    root.replaceChildren(...parts.filter((x): x is HTMLElement => !!x));
    root.dataset.view = view;
  };
  const stop = redraw(k, draw);
  // reminders on the day, said once a day in the app's notice (and kept off when he turned them off)
  const due = dueToday(log, recs(k));
  const v = st.get();
  if (due.length && k.setting('remind') !== false && v.told !== today()) {
    st.set({ ...v, told: today() });
    setTimeout(() => k.notice(due.length === 1 ? due[0]! : `${due[0]} and ${due.length - 1} more today.`), 400);
  }
  return stop;
}

registerRenderer('log', (root, def, k) => drawLog(root, def, k, def.log!));
