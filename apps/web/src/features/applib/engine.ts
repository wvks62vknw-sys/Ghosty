/**
 * THE APP LIBRARY's engine (docs/build-plan/APPLIB.md, ENGINE 2): an AppDef in, a whole app out. The kit (ui/appkit.ts) builds the
 * frame (header, one scroll area, keys at the bottom, notices, first run and tour, search, undo and redo, Recently deleted, export),
 * then the archetype's renderer (registry.ts) draws the app into the kit's scroll area. Everything an app keeps is under
 * ghosty.app.<id> on this phone (the kit's own record, plus `ghosty.app.<id>.<part>` for a renderer's small extras).
 */
import { app, kitState, type KitApp, type KitItem } from '../../ui/appkit';
import { h, icon } from '../../core/dom';
import type { AppDef, Field, LogConfig } from '../../../../../packages/shared/src/applib/types';
import { rendererFor } from './registry';
import { glyphOf } from './glyphs';
import './renderers';

/** The kit's words for what each kind of app holds ("No entries yet", "Search entries"). */
const NOUNS: Record<string, [string, string]> = {
  log: ['entry', 'entries'], importer: ['record', 'records'], checklist: ['item', 'items'], calc: ['result', 'results'],
  timer: ['session', 'sessions'], deck: ['card', 'cards'], counter: ['tally', 'tallies'], guide: ['section', 'sections'],
  game: ['game', 'games'], screen: ['screen', 'screens'],
};

/** For the spec and the console: the app on screen and what it drew last. */
export const engineState = { open: '', archetype: '', drawn: 0, error: '' };

// ── values, as he reads them ──────────────────────────────────────────────────────────────

export type Val = string | number | boolean | string[] | undefined | null;

export const money = (n: number) => `£${(Math.round(n * 100) / 100).toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const mins = (m: number) => {
  const t = Math.round(m);
  return t >= 60 ? `${Math.floor(t / 60)} h${t % 60 ? ` ${t % 60} min` : ''}` : `${t} min`;
};
/** A number as he reads it: grouped only from 10,000 up, so a year or a vintage reads 2016. */
export const num = (n: number, dp = 2) => (Number.isFinite(n) ? (+n.toFixed(dp)).toLocaleString('en-GB', { maximumFractionDigits: dp, useGrouping: Math.abs(n) >= 10000 }) : '–');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayWords = (d: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${+m[3]!} ${MONTHS[+m[2]! - 1]} ${m[1]}` : d;
};
export const today = (at = new Date()) => `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;

/** One value of a field, said the way he reads it (£12.50, 1 h 20 min, ★★★★, 12 km). */
export function show(f: Field, v: Val): string {
  if (v == null || v === '' || (Array.isArray(v) && !v.length)) return '';
  switch (f.type) {
    case 'money': return money(Number(v));
    case 'duration': return mins(Number(v));
    case 'date': return dayWords(String(v));
    case 'rating': return '★'.repeat(Math.max(0, Math.min(5, Math.round(Number(v))))) + '☆'.repeat(5 - Math.max(0, Math.min(5, Math.round(Number(v)))));
    case 'check': return v ? 'Yes' : 'No';
    case 'multi': return (Array.isArray(v) ? v : [String(v)]).join(', ');
    case 'number': case 'scale': return `${num(Number(v))}${f.unit ? ` ${f.unit}` : ''}`;
    case 'photo': return '';
    case 'link': return String(v).replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
    default: return `${String(v)}${f.unit ? ` ${f.unit}` : ''}`;
  }
}

/** A title, line or meta from its field id or template ("{name} ({year})"), with empty brackets tidied away. */
export function fill(log: LogConfig, t: string | undefined, f: Record<string, Val>): string {
  if (!t) return '';
  const by = (id: string) => { const fd = log.fields.find((x) => x.id === id); return fd ? show(fd, f[id]) : ''; };
  if (!t.includes('{')) return by(t);
  return t.replace(/\{([a-z0-9_]+)\}/g, (_, id: string) => by(id)).replace(/\(\s*\)|\[\s*\]/g, '').replace(/\s+([,.·])/g, '$1').replace(/^[\s,·-]+|[\s,·-]+$/g, '').replace(/\s{2,}/g, ' ');
}

/** A record of a log app as the kit keeps it: its title, line and meta worked out, its fields in `f`. */
export interface Rec extends KitItem {
  f: Record<string, Val>;
}
let seq = 0;
export const newId = () => `r${Date.now().toString(36)}${(seq++).toString(36)}`;
export function recordOf(log: LogConfig, f: Record<string, Val>, id = newId()): Rec {
  const title = fill(log, log.title, f) || 'Untitled';
  return { id, title, sub: fill(log, log.sub, f) || undefined, meta: fill(log, log.meta, f) || undefined, f };
}

/** A starting record from the fields' defaults ('today' and 'now' read now). */
export function blank(log: LogConfig): Record<string, Val> {
  const f: Record<string, Val> = {};
  const now = new Date();
  for (const x of log.fields) {
    if (x.default === 'today' && x.type === 'date') f[x.id] = today(now);
    else if (x.default === 'now' && x.type === 'time') f[x.id] = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    else if (x.default != null) f[x.id] = x.default;
  }
  return f;
}

/** A small extra a renderer keeps beside the kit's record (ghosty.app.<id>.<part>). */
export function extra<T>(id: string, part: string, fallback: T): { get(): T; set(v: T): void } {
  const key = `ghosty.app.${id}.${part}`;
  return {
    get() {
      try {
        const v = localStorage.getItem(key);
        return v == null ? fallback : (JSON.parse(v) as T);
      } catch {
        return fallback;
      }
    },
    set(v) {
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // (a full phone or a private window: it goes on, only not kept)
      }
    },
  };
}

/** The search words the kit holds for an app (its search box), lower case. */
export const queryOf = (k: KitApp) => (kitState[(k.el.dataset.app ?? '')]?.q ?? '').toLowerCase();

/** A small heading inside an app's scroll area. */
export const sectionHead = (words: string, right?: string) => h('div.al-head', h('h3', words), right ? h('small', right) : null);

/** The sample records a log or importer app starts with. */
function samples(def: AppDef): KitItem[] {
  if (def.checklist) return def.checklist.sections.flatMap((s, si) => s.items.map((t, i) => ({ id: `c${si}-${i}`, title: t, sub: s.name, done: false })));
  if (def.counter) return def.counter.names.map((n, i) => ({ id: `n${i}`, title: n, n: 0 }));
  if (def.deck) return def.deck.cards.map((c, i) => ({ id: `q${i}`, title: c.q, sub: c.a, s: { ef: 2.5, reps: 0, interval: 0, due: 0, lapses: 0, last: 0 } }));
  const log = def.log ?? def.importer?.log;
  if (!log || !def.sample) return [];
  return def.sample.map((r, i) => recordOf(log, r as Record<string, Val>, `s${i + 1}`));
}

/**
 * Build an app into `host`: the kit's frame, then its archetype's renderer. Returns the function that stops it (its timers and
 * listeners) and takes it off the page.
 */
export function mountApp(host: HTMLElement, def: AppDef): { k: KitApp; stop: () => void } {
  const k = app(host, {
    id: def.id,
    name: def.name,
    glyph: glyphOf(def.glyph),
    noun: NOUNS[def.archetype] ?? ['item', 'items'],
    sample: samples(def),
    tour: def.tour,
    settings: def.archetype === 'log' && def.log?.remind ? [{ id: 'remind', label: 'Reminders on the day', on: true }] : [],
  });
  k.el.classList.add('al-app');
  k.el.dataset.archetype = def.archetype;
  Object.assign(engineState, { open: def.id, archetype: def.archetype, drawn: Date.now(), error: '' });
  const r = rendererFor(def.archetype);
  let stop: void | (() => void);
  if (!r) {
    engineState.error = 'no renderer';
    k.state('error', 'This kind of app is still being built. It will open here once it lands.');
  } else {
    try {
      stop = r(k.body, def, k);
    } catch (e) {
      engineState.error = String(e);
      k.state('error', 'This app could not draw. Your things in it are kept.', { word: 'Try again', run: () => location.reload() });
    }
  }
  return {
    k,
    stop: () => {
      try {
        stop?.();
      } finally {
        k.el.remove();
      }
    },
  };
}

/** The app's icon, drawn the kit's way. */
export const appIcon = (def: Pick<AppDef, 'glyph'>, cls = 'ic') => icon(glyphOf(def.glyph), cls);
