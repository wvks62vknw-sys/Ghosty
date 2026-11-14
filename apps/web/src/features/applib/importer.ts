/**
 * THE APP LIBRARY's 'importer' renderer (the DATA lane; docs/build-plan/APPLIB.md, "Reverse engineered, done for you").
 * A "Your data" app is a log over one of his own exports: he reads the AppDef's steps for getting the file, picks it, and it
 * is read in a Web Worker (workers/applibdata.worker.ts, streamed and unzipped in chunks) with a progress bar and a cancel
 * key. Every record goes into IndexedDB under the app's id (localStorage is far too small for years of history); the
 * newest are handed to the kit, so the engine's log renderer draws them with its stats, chart, search and export.
 * Importing again lays the new file over the old (merge) or replaces it, and the records' keys keep it free of doubles.
 * The top panel ranks any span of days he picks, over every record. A run's route is drawn here from its shape only.
 * Nothing is sent anywhere: no location, no file, no record leaves the phone.
 */
import { h } from '../../core/dom';
import { key } from '../../ui/machine';
import { KIT_ICONS, type KitApp, type KitItem } from '../../ui/appkit';
import { redraw, registerRenderer, rendererFor, toolKey } from './registry';
import type { AppDef, Field, LogConfig } from '../../../../../packages/shared/src/applib/types';
import { READER_META } from '../../../../../packages/shared/src/applib/importers/meta';
import { mergeRecords, topList } from '../../../../../packages/shared/src/applib/importers/merge';
import { localDay, addDays, type Rec } from '../../../../../packages/shared/src/applib/importers/input';
import type { ImportReply } from '../../workers/applibdata.worker';

/** At most this many records are handed to the kit (the newest); every record stays in IndexedDB for the top panel. */
export const KIT_MAX = 1500;

// ── IndexedDB: one entry per app, { records, file, at } ───────────────────────────

const DB = 'ghosty-applib-data';
interface Kept { records: Rec[]; file: string; at: number }
function db(): Promise<IDBDatabase> {
  return new Promise((ok, bad) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('sets');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => bad(r.error);
  });
}
export async function loadSet(appId: string): Promise<Kept | null> {
  try {
    const d = await db();
    return await new Promise((ok) => {
      const q = d.transaction('sets').objectStore('sets').get(appId);
      q.onsuccess = () => ok((q.result as Kept | undefined) ?? null);
      q.onerror = () => ok(null);
    });
  } catch {
    return null;
  }
}
async function saveSet(appId: string, v: Kept): Promise<boolean> {
  try {
    const d = await db();
    return await new Promise((ok) => {
      const t = d.transaction('sets', 'readwrite');
      t.objectStore('sets').put(v, appId);
      t.oncomplete = () => ok(true);
      t.onerror = () => ok(false);
    });
  } catch {
    return false;
  }
}

// ── words: a value as he reads it ─────────────────────────────────────────────────

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const n0 = (x: number, dp = 0) => x.toLocaleString('en-GB', { maximumFractionDigits: dp });
/** "1 h 20 min" from minutes. */
export const mins = (m: number): string => (m >= 60 ? `${Math.floor(m / 60)} h${Math.round(m % 60) ? ` ${Math.round(m % 60)} min` : ''}` : `${Math.round(m)} min`);
/** One field's value in his words ('' when there is none). */
export function show(v: unknown, f?: Field): string {
  if (v == null || v === '') return '';
  if (!f) return String(v);
  switch (f.type) {
    case 'date': { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v)); return m ? `${+m[3]!} ${MON[+m[2]! - 1]} ${m[1]}` : String(v); }
    case 'duration': return mins(Number(v) || 0);
    case 'money': return `£${(Number(v) || 0).toFixed(2)}`;
    case 'number': return n0(Number(v), 2);
    case 'rating': return `${Number(v)} of 5`;
    case 'check': return v ? f.label : '';
    default: return String(v);
  }
}
/** A row line from the app's template ("{km} km · {pace}") or a field id; parts with nothing in them are left out. */
export function fill(tpl: string | undefined, r: Rec, fields: Field[]): string {
  if (!tpl) return '';
  const byId = new Map(fields.map((f) => [f.id, f]));
  if (!tpl.includes('{')) return show(r[tpl], byId.get(tpl));
  return tpl.split(' · ').map((part) => {
    let empty = true;
    const out = part.replace(/\{(\w+)\}/g, (_, id: string) => {
      const f = byId.get(id);
      const raw = r[id];
      if (raw == null || raw === '') return '';
      empty = false;
      return f?.type === 'number' || f?.type === 'money' || f?.type === 'duration' ? (f.type === 'number' ? n0(Number(raw), 2) : show(raw, f)) : show(raw, f);
    }).replace(/\(\s*\)/g, '').trim();
    return empty ? '' : out;
  }).filter(Boolean).join(' · ');
}

/** A record as one of the kit's items: its key as the id, its line words, and every field it has (none starting _). */
export function toItem(r: Rec, log: LogConfig): KitItem {
  const it: KitItem = { id: String(r._key ?? `h${Math.random().toString(36).slice(2)}`), title: fill(log.title, r, log.fields) || 'Untitled' };
  const sub = fill(log.sub, r, log.fields);
  const meta = fill(log.meta, r, log.fields);
  if (sub) it.sub = sub;
  if (meta) it.meta = meta;
  for (const [k, v] of Object.entries(r)) if (k[0] !== '_' && !(k in it)) it[k] = v;
  return it;
}

/** The newest records first (by the app's date field, then its sort field), at most KIT_MAX. */
export function newest(recs: Rec[], log: LogConfig, max = KIT_MAX): Rec[] {
  const by = log.date ?? log.sort?.field;
  const s = by ? recs.slice().sort((a, b) => String(b[by] ?? '').localeCompare(String(a[by] ?? ''))) : recs.slice();
  return s.slice(0, max);
}

/** The spans the top panel offers, as from..to days ('' for open). */
export function span(which: string, today = localDay(new Date())): { from: string; to: string } {
  const y = today.slice(0, 4);
  switch (which) {
    case '7': return { from: addDays(today, -6), to: today };
    case '30': return { from: addDays(today, -29), to: today };
    case 'year': return { from: `${y}-01-01`, to: today };
    case 'last': return { from: `${+y - 1}-01-01`, to: `${+y - 1}-12-31` };
    default: return { from: '', to: '' };
  }
}

// ── the renderer ──────────────────────────────────────────────────────────────────

/** The kit's sample items, told apart from records he typed in himself by their values. */
const sameAsSample = (it: KitItem, def: AppDef) =>
  (def.sample ?? []).some((s) => Object.entries(s).every(([k, v]) => String(it[k] ?? '') === String(v)));

function routeSvg(d: string): SVGSVGElement {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('class', 'al-imp-route');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Route shape');
  const p = document.createElementNS(NS, 'path');
  if (/^[ML0-9. ]+$/.test(d)) p.setAttribute('d', d);
  svg.append(p);
  return svg;
}

export const importerRenderer = (root: HTMLElement, def: AppDef, k: KitApp): (() => void) => {
  const imp = def.importer!;
  const log = imp.log;
  const reader = READER_META[def.id];
  const stops: (() => void)[] = [];
  // the engine's log renderer draws the records (stats, chart, search, export); the kit's own list if it is not there yet
  const logR = rendererFor('log');
  if (logR) {
    const stop = logR(root, { ...def, archetype: 'log', log }, k);
    if (stop) stops.push(stop);
  }

  let all: Rec[] = [];
  let kept: Kept | null = null;
  let worker: Worker | null = null;
  let pick: { from: string; to: string; which: string } = { ...span('year'), which: 'year' };
  let routeAt = 0;

  const panel = h('div.al-imp', { dataset: { app: def.id } });
  const input = h('input.al-imp-file', { type: 'file', accept: reader?.types ?? '', multiple: reader?.route ?? false, hidden: true, 'aria-label': `Pick your file for ${def.name}` }) as HTMLInputElement;
  panel.append(input);
  const body = h('div.al-imp-in');
  panel.append(body);

  const stepsList = () => h('ol.al-imp-how', ...imp.how.map((s) => h('li', s)));
  const pickKey = (word = 'Pick file') => key(word, () => input.click(), { kind: 'fill', glyph: KIT_ICONS.plus });

  /** The records handed to the kit: the newest, plus anything he typed in himself, never the samples. */
  const toKit = (recs: Rec[]) => {
    const keys = new Set(recs.map((r) => String(r._key)));
    const mine = k.items().filter((it) => !keys.has(it.id) && !sameAsSample(it, def) && !kept?.records.some((r) => String(r._key) === it.id));
    k.replaceAll([...newest(recs, log).map((r) => toItem(r, log)), ...mine]);
  };

  const drawIdle = () => {
    if (!kept) {
      body.replaceChildren(h('p.al-imp-lead', 'Get your file:'), stepsList(), pickKey(), h('p.al-imp-fine', 'It is read on this phone. Nothing is sent anywhere.'));
      return;
    }
    const when = new Date(kept.at);
    const parts: (HTMLElement | SVGSVGElement)[] = [
      h('p.al-imp-lead', `${n0(kept.records.length)} ${kept.records.length === 1 ? 'record' : 'records'} from ${kept.file}, ${when.getDate()} ${MON[when.getMonth()]}.`),
    ];
    if (kept.records.length > KIT_MAX) parts.push(h('p.al-imp-fine', `The list shows the newest ${n0(KIT_MAX)}; the top lists use them all.`));
    if (reader?.top) parts.push(topPanel());
    if (reader?.route) { const r = routePanel(); if (r) parts.push(r); }
    parts.push(h('details.al-imp-again', h('summary', 'How to get a newer file'), stepsList()));
    body.replaceChildren(...parts);
  };

  const topPanel = () => {
    const t = reader!.top!;
    const wrap = h('div.al-imp-top');
    const chips = h('div.al-imp-spans', { role: 'group', 'aria-label': 'Span' });
    const SP: [string, string][] = [['7', '7 days'], ['30', '30 days'], ['year', 'This year'], ['last', 'Last year'], ['all', 'All']];
    for (const [w, label] of SP) {
      const b = key(label, () => { pick = { ...span(w), which: w }; drawIdle(); }, { kind: pick.which === w ? 'fill' : 'line' });
      b.setAttribute('aria-pressed', String(pick.which === w));
      chips.append(b);
    }
    const from = h('input.al-imp-day', { type: 'date', value: pick.from, 'aria-label': 'From' }) as HTMLInputElement;
    const to = h('input.al-imp-day', { type: 'date', value: pick.to, 'aria-label': 'To' }) as HTMLInputElement;
    const onDay = () => { pick = { from: from.value, to: to.value, which: 'days' }; drawIdle(); };
    from.addEventListener('change', onDay);
    to.addEventListener('change', onDay);
    const df = log.date ?? 'date';
    const list = topList(all, t.field, { by: t.by, from: pick.from, to: pick.to, dateField: df, n: 5 });
    const byF = log.fields.find((f) => f.id === t.by);
    const val = (v: number) => (!t.by ? `${n0(v)} ${v === 1 ? 'time' : 'times'}` : byF?.type === 'money' ? `£${v.toFixed(2)}` : byF?.unit === 'min' ? mins(v) : `${n0(v, 1)}${byF?.unit ? ` ${byF.unit}` : ''}`);
    wrap.append(
      h('h3.al-imp-head', t.label),
      chips,
      h('div.al-imp-days', from, h('span', 'to'), to),
      list.length
        ? h('ol.al-imp-rank', ...list.map((x, i) => h('li', h('b', String(i + 1)), h('span', x.name), h('em', val(x.value)))))
        : h('p.al-imp-fine', 'Nothing in these days. Pick a wider span.'),
    );
    return wrap;
  };

  const routePanel = () => {
    const withRoute = newest(all.filter((r) => typeof r._route === 'string' && r._route), log, 500);
    if (!withRoute.length) return null;
    routeAt = Math.max(0, Math.min(routeAt, withRoute.length - 1));
    const r = withRoute[routeAt]!;
    const moveKey = (word: string, d: number) => {
      const b = key(word, () => { routeAt += d; drawIdle(); });
      b.disabled = routeAt + d < 0 || routeAt + d >= withRoute.length;
      return b;
    };
    return h('div.al-imp-act',
      h('h3.al-imp-head', String(r.name ?? 'Route')),
      h('p.al-imp-fine', fill('{date} · {km} km · {pace}', r, log.fields)),
      routeSvg(String(r._route)),
      r.splits ? h('p.al-imp-splits', `Splits: ${String(r.splits)}`) : null,
      h('div.al-imp-move', moveKey('Newer', -1), moveKey('Older', 1)),
    );
  };

  const drawProgress = (f: number, cancel: () => void) => {
    const pct = Math.round(f * 100);
    const bar = h('div.al-imp-bar', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': 'Reading' }, h('i', { style: `width: ${pct}%` }));
    body.replaceChildren(h('p.al-imp-lead', `Reading your file. ${pct}%`), bar, key('Cancel', cancel));
  };

  /** He picked: profiles to choose from first (a shared account), then merge or replace, then keep it. */
  const finish = async (recs: Rec[], file: string) => {
    const who = [...new Set(recs.map((r) => r._who).filter((x): x is string => typeof x === 'string'))];
    if (who.length > 1) {
      body.replaceChildren(h('p.al-imp-lead', 'This file holds more than one profile. Which one is yours?'), h('div.al-imp-move', ...who.map((w) => key(w, () => void finish(recs.filter((r) => r._who === w), file)))));
      return;
    }
    const clean = recs.map(({ _who: _w, ...r }) => r as Rec);
    if (!clean.length) {
      k.notice('No records found in that file. Check it is the right export.', { tone: 'warn' });
      return drawIdle();
    }
    if (kept?.records.length) {
      body.replaceChildren(
        h('p.al-imp-lead', `${n0(clean.length)} records read. You already have ${n0(kept.records.length)}.`),
        h('div.al-imp-move', key('Add to them', () => void keep(clean, file, 'merge'), { kind: 'fill' }), key('Replace them', () => void keep(clean, file, 'replace'))),
      );
      return;
    }
    await keep(clean, file, 'merge');
  };

  const keep = async (recs: Rec[], file: string, mode: 'merge' | 'replace') => {
    const merged = mergeRecords(kept?.records ?? [], recs, mode);
    const added = merged.length - (mode === 'merge' ? kept?.records.length ?? 0 : 0);
    kept = { records: merged, file, at: Date.now() };
    all = merged;
    const ok = await saveSet(def.id, kept);
    toKit(merged);
    drawIdle();
    k.notice(ok ? `${n0(recs.length)} records read${mode === 'merge' && added < recs.length ? `, ${n0(Math.max(0, added))} of them new` : ''}.` : 'Read, but this phone would not keep them. Free some space and import again.', { tone: ok ? 'ok' : 'warn' });
  };

  const run = (files: File[]) => {
    if (!files.length || !reader) return;
    worker?.terminate();
    const w = new Worker('/applibdata.worker.js');
    worker = w;
    const cancel = () => { w.terminate(); worker = null; drawIdle(); k.notice('Stopped. Nothing was changed.'); };
    drawProgress(0, cancel);
    // several activity files at once are read one after another and kept together
    const queue = files.slice();
    const got: Rec[] = [];
    const next = () => {
      const f = queue.shift();
      if (!f) { w.terminate(); worker = null; void finish(got, files.length > 1 ? `${files.length} files` : files[0]!.name); return; }
      w.postMessage({ appId: def.id, file: f });
    };
    const done = files.length;
    w.onmessage = (ev: MessageEvent<ImportReply>) => {
      const m = ev.data;
      if (m.kind === 'progress') drawProgress((done - queue.length - 1 + m.f) / done, cancel);
      else if (m.kind === 'done') { got.push(...m.records); next(); }
      else { w.terminate(); worker = null; drawIdle(); k.notice(m.words, { tone: 'warn' }); }
    };
    w.onerror = () => { w.terminate(); worker = null; drawIdle(); k.notice('That file could not be read.', { tone: 'warn' }); };
    next();
  };
  input.addEventListener('change', () => {
    const fs = [...(input.files ?? [])];
    input.value = '';
    run(fs);
  });

  // the panel sits at the top of the one scroll area, put back after each of the kit's draws
  stops.push(redraw(k, () => { if (root.firstChild !== panel) root.prepend(panel); }));
  const tk = toolKey(k, key('Import', () => input.click(), { glyph: KIT_ICONS.plus }));
  stops.push(() => tk.remove());
  drawIdle();
  void loadSet(def.id).then((v) => {
    kept = v;
    all = v?.records ?? [];
    drawIdle();
  });
  return () => {
    worker?.terminate();
    for (const s of stops) s();
    panel.remove();
  };
};

registerRenderer('importer', importerRenderer);
