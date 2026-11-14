/**
 * THE APP LIBRARY's log renderer (and the importer's records underneath): records with fields, drawn as a list, a board, a
 * calendar or a gallery, with the stats strip (goal rings), a chart over time, reminders on the day and the field editor sheet
 * with every field type. Every change goes through the kit (k.add, k.update, k.remove), so undo, redo and Recently deleted hold.
 */
import { h, icon, svgEl } from '../../../core/dom';
import { key } from '../../../ui/machine';
import { listRow, stateCard, type KitApp } from '../../../ui/appkit';
import type { AppDef, Field, LogConfig, Stat } from '../../../../../../packages/shared/src/applib/types';
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

function statsStrip(log: LogConfig, rows: Rec[]): HTMLElement | null {
  if (!log.stats?.length) return null;
  return h('div.al-stats', { role: 'group', 'aria-label': 'Summary' }, ...log.stats.map((s) => {
    const v = statValue(log, s, rows);
    const goal = s.goal;
    const frac = goal && v != null ? v / goal : 0;
    const over = !!goal && s.dir === 'limit' && v != null && v > goal;
    const words = statWords(log, s, v);
    const of = goal ? ` of ${statWords(log, { ...s, kind: s.kind }, goal)}` : '';
    return h('div.al-stat', { dataset: { kind: s.kind }, 'aria-label': `${s.label}: ${words}${of}` },
      goal ? ring(frac, over) : null,
      h('div.al-statwords', h('b', words), h('small', s.label + (goal ? ` · goal ${statWords(log, s, goal)}` : ''))));
  }));
}

/** The chart: one number field summed over the last 7 days, 30 days or 12 months. */
function chart(log: LogConfig, rows: Rec[], now = new Date()): HTMLElement | null {
  const c = log.chart;
  if (!c || !log.date) return null;
  const f = log.fields.find((x) => x.id === c.field);
  const buckets: { label: string; v: number }[] = [];
  const val = (r: Rec) => Number(fOf(r)[c.field]) || 0;
  if (c.period === 'year') {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.push({ label: MONTHS[d.getMonth()]!.slice(0, 1), v: rows.filter((r) => dateOf(log, r).startsWith(pre)).reduce((a, r) => a + val(r), 0) });
    }
  } else {
    const n = c.period === 'week' ? 7 : 30;
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const day = today(d);
      buckets.push({ label: n === 7 ? WD[(d.getDay() + 6) % 7]! : i % 7 === 0 ? String(d.getDate()) : '', v: rows.filter((r) => dateOf(log, r) === day).reduce((a, r) => a + val(r), 0) });
    }
  }
  const max = Math.max(1e-9, ...buckets.map((b) => b.v));
  const W = 300, H = 56, n = buckets.length, bw = W / n;
  const total = buckets.reduce((a, b) => a + b.v, 0);
  const said = f?.type === 'money' ? money(total) : f?.type === 'duration' ? mins(total) : `${num(total)}${f?.unit ? ` ${f.unit}` : ''}`;
  const span = c.period === 'week' ? 'the last 7 days' : c.period === 'month' ? 'the last 30 days' : 'the last 12 months';
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H + 14}`, class: 'al-chart', role: 'img', 'aria-label': `${f?.label ?? c.field} over ${span}: ${said} in all` });
  svg.append(svgEl('line', { class: 'al-axis', x1: 0, y1: H, x2: W, y2: H }));
  if (c.kind === 'bar') {
    buckets.forEach((b, i) => {
      const bh = (b.v / max) * (H - 6);
      svg.append(svgEl('rect', { class: 'al-bar', x: (i * bw + bw * 0.18).toFixed(1), y: (H - bh).toFixed(1), width: (bw * 0.64).toFixed(1), height: bh.toFixed(1), rx: 1.5 }));
    });
  } else {
    svg.append(svgEl('polyline', { class: 'al-line', points: buckets.map((b, i) => `${(i * bw + bw / 2).toFixed(1)},${(H - (b.v / max) * (H - 6)).toFixed(1)}`).join(' ') }));
  }
  buckets.forEach((b, i) => {
    if (!b.label) return;
    const t = svgEl('text', { class: 'al-axistick', x: (i * bw + bw / 2).toFixed(1), y: H + 12, 'text-anchor': 'middle' });
    t.textContent = b.label;
    svg.append(t);
  });
  return h('figure.al-chartbox', sectionHead(`${f?.label ?? ''}, ${span}`, said), svg);
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
    h('div.al-sheetkeys', key('Save', save, { kind: 'fill' }), key('Cancel', close), rec ? key('Delete', () => { close(); k.remove(rec.id); }) : null),
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

const rowOf = (def: AppDef, log: LogConfig, k: KitApp, r: Rec) => listRow(r, { onTap: () => editSheet(def, log, k, r), onDelete: () => k.remove(r.id) });

function listView(def: AppDef, log: LogConfig, k: KitApp, rows: Rec[]): HTMLElement[] {
  const g = log.group ? log.fields.find((f) => f.id === log.group) : undefined;
  if (!g) return [h('div.al-list', { role: 'list' }, ...rows.map((r) => rowOf(def, log, k, r)))];
  const groups = [...(g.options ?? []), ''];
  return groups.map((o) => {
    const in_ = rows.filter((r) => (String(fOf(r)[g.id] ?? '')) === o || (!o && !(g.options ?? []).includes(String(fOf(r)[g.id] ?? ''))));
    return in_.length ? h('section.al-group', sectionHead(o || `No ${g.label.toLowerCase()}`, String(in_.length)), h('div.al-list', { role: 'list' }, ...in_.map((r) => rowOf(def, log, k, r)))) : null;
  }).filter((x): x is HTMLElement => !!x);
}

function boardView(def: AppDef, log: LogConfig, k: KitApp, rows: Rec[]): HTMLElement[] {
  const g = log.fields.find((f) => f.id === log.group);
  if (!g?.options) return listView(def, log, k, rows);
  const opts = g.options;
  return opts.map((o, i) => {
    const col = rows.filter((r) => String(fOf(r)[g.id] ?? opts[0]) === o);
    const next = opts[(i + 1) % opts.length]!;
    return h('section.al-col', { dataset: { col: o } }, sectionHead(o, String(col.length)),
      col.length ? h('div.al-cards', ...col.map((r) => {
        const open = h('button.al-cardmain', { type: 'button' }, h('b', r.title), r.sub ? h('small', r.sub) : null);
        open.addEventListener('click', () => editSheet(def, log, k, r));
        const move = key(`To ${next}`, () => { k.update(r.id, recordOf(log, { ...fOf(r), [g.id]: next }, r.id)); k.notice(`Moved “${r.title}” to ${next}.`); }, { label: `Move ${r.title} to ${next}` });
        return h('div.al-bcard', open, move);
      })) : h('p.al-none', 'Nothing here.'));
  });
}

function calendarView(def: AppDef, log: LogConfig, k: KitApp, rows: Rec[], st: { get(): Pick<View, 'month' | 'day'> & View; set(v: View): void }, again: () => void): HTMLElement[] {
  const v = st.get();
  const now = new Date();
  const [y, m] = (v.month ?? `${now.getFullYear()}-${now.getMonth()}`).split('-').map(Number) as [number, number];
  const first = new Date(y, m, 1);
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  const byDay = new Map<string, Rec[]>();
  for (const r of rows) { const d = dateOf(log, r); if (d) byDay.set(d, [...(byDay.get(d) ?? []), r]); }
  const shift = (n: number) => { const d = new Date(y, m + n, 1); st.set({ ...v, month: `${d.getFullYear()}-${d.getMonth()}`, day: undefined }); again(); };
  const head = h('div.al-calhead', key('Previous', () => shift(-1), { label: 'Previous month' }), h('b', `${MONTHS[m]} ${y}`), key('Next', () => shift(1), { label: 'Next month' }));
  const cells: HTMLElement[] = WD.map((w) => h('span.al-wd', { 'aria-hidden': 'true' }, w));
  for (let i = 0; i < lead; i++) cells.push(h('span.al-blank'));
  for (let d = 1; d <= days; d++) {
    const day = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const n = byDay.get(day)?.length ?? 0;
    const b = h('button.al-day', { type: 'button', 'aria-label': `${dayWords(day)}: ${n ? `${n} ${n === 1 ? 'entry' : 'entries'}` : 'nothing'}`, 'aria-pressed': String(v.day === day), dataset: { today: String(day === today(now)), n: String(n) } }, String(d), n ? h('i') : null);
    b.addEventListener('click', () => { st.set({ ...v, day: v.day === day ? undefined : day }); again(); });
    cells.push(b);
  }
  const pick = v.day ? byDay.get(v.day) ?? [] : [];
  const below = v.day
    ? h('section.al-group', sectionHead(dayWords(v.day), String(pick.length)), pick.length ? h('div.al-list', { role: 'list' }, ...pick.map((r) => rowOf(def, log, k, r))) : null,
      key(`Add on ${dayWords(v.day)}`, () => editSheet(def, log, k, undefined, { [log.date!]: v.day! }), { glyph: PLUS }))
    : h('p.al-none', 'Tap a day to see what is on it.');
  return [head, h('div.al-cal', { role: 'group', 'aria-label': `${MONTHS[m]} ${y}` }, ...cells), below];
}

function galleryView(def: AppDef, log: LogConfig, k: KitApp, rows: Rec[]): HTMLElement[] {
  const p = log.fields.find((f) => f.type === 'photo');
  return [h('div.al-gallery', ...rows.map((r) => {
    const src = p ? fOf(r)[p.id] : undefined;
    const b = h('button.al-tile', { type: 'button', 'aria-label': r.title },
      typeof src === 'string' && src ? h('img', { src, alt: '' }) : h('span.al-tileicon', icon(glyphOf(def.glyph))),
      h('b', r.title), r.sub ? h('small', r.sub) : null);
    b.addEventListener('click', () => editSheet(def, log, k, r));
    return b;
  }))];
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

/** Draw a log (also the importer's records, with `opts.add` false when the records come only from his file). */
export function drawLog(root: HTMLElement, def: AppDef, k: KitApp, log: LogConfig, opts: { add?: boolean; top?: () => HTMLElement | null } = {}): () => void {
  const st = extra<View>(def.id, 'view', {});
  const views = log.views?.length ? log.views : ['list' as const];
  if (opts.add !== false) toolKey(k, key('Add', () => editSheet(def, log, k), { glyph: PLUS, label: `Add to ${def.name}` }));
  const draw = () => {
    const v = st.get();
    const view = views.includes(v.view as never) ? v.view! : views[0]!;
    const all = recs(k);
    const q = queryOf(k);
    const rows = sorted(log, all.filter((r) => matches(r, q)));
    const parts: (HTMLElement | null)[] = [opts.top?.() ?? null];
    if (!q) parts.push(statsStrip(log, all), chart(log, all));
    if (views.length > 1) {
      parts.push(h('div.al-seg', { role: 'tablist', 'aria-label': 'Views' }, ...views.map((w) => {
        const b = h('button.al-segkey', { type: 'button', role: 'tab', 'aria-selected': String(w === view) }, VIEW_WORDS[w]);
        b.addEventListener('click', () => { st.set({ ...st.get(), view: w }); draw(); });
        return b;
      })));
    }
    if (!all.length) parts.push(stateCard('empty', opts.add === false ? 'Nothing read yet. Pick your file with the key below.' : `Nothing in ${def.name} yet. Add your first with the key below.`));
    else if (!rows.length) parts.push(stateCard('empty', `Nothing matches “${q}”.`, { word: 'Clear search', run: () => { const f = k.el.querySelector<HTMLInputElement>('.ak-find'); if (f) f.value = ''; k.search(''); } }));
    else if (view === 'board') parts.push(...boardView(def, log, k, rows));
    else if (view === 'calendar') parts.push(...calendarView(def, log, k, rows, st as never, draw));
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
