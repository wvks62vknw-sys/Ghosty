/**
 * FOUR MORE ROOMS ON BODY (NEXT ROUND, BODY AND KITCHEN lane), each kept on this phone only, each number a rough estimate and
 * never medical advice:
 *  - FASTING (body.s3, on Sleep): START A FAST and END THE FAST, the time so far against his target, the streak and past fasts;
 *  - MEASUREMENTS (body.s4, on Weight): waist, chest, hips and arms, in centimetres or inches, each with its own trend line;
 *  - GYM LOG (body.s6, on Move): sets, reps and weight per exercise, today's session, and personal bests (the heaviest, and a rough
 *    one-rep max by the Epley formula, said as an estimate);
 *  - SYMPTOM DIARY (body.s5, on Health): what, when and how bad, then one tidy page for an appointment, saved on his tap. It never
 *    guesses a diagnosis.
 * The state is on window.__ghosty.bodymore for the specs.
 */
import { h, svgEl } from '../../core/dom';
import { button } from '../../ui/components';
import { emptyState, phrases, stateLine } from '../lifeui';
import { dayOf, shift } from './trackcore';

const now = (): number => Date.now() + ((window as unknown as { __ghostyClockOffset?: number }).__ghostyClockOffset ?? 0);
const rid = () => Math.random().toString(36).slice(2, 10);
let failed = '';
const listeners = new Set<() => void>();

/** One small store on the phone: read once, mended by `fix`, written back whole. */
function store<T>(key: string, fix: (raw: Record<string, unknown>) => T): { get(): T; put(): boolean; reset(): void } {
  let cache: T | null = null;
  return {
    get() {
      if (cache) return cache;
      let raw: Record<string, unknown> = {};
      try {
        raw = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {};
      } catch {
        raw = {};
      }
      cache = fix(raw);
      return cache;
    },
    put() {
      try {
        localStorage.setItem(key, JSON.stringify(cache));
        failed = '';
      } catch {
        failed = 'I couldn’t keep that on this phone: its storage is full or switched off.';
      }
      for (const f of listeners) f();
      return !failed;
    },
    reset() {
      cache = null;
    },
  };
}
const arr = <X>(x: unknown, ok: (y: X) => boolean, n: number): X[] => (Array.isArray(x) ? (x as X[]).filter((y) => y && typeof y === 'object' && ok(y)).slice(-n) : []);
const fin = (x: unknown) => typeof x === 'number' && Number.isFinite(x);
const hm = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dur = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};
/** A room's frame: drawn on every change while it is open. */
function room(track: string, draw: (el: HTMLElement) => HTMLElement[], tick = 0): { el: HTMLElement; stop(): void } {
  expose();
  const el = h('div.pkcol.bt', { dataset: { track } });
  const paint = () => {
    const open = new Set([...el.querySelectorAll('details[open]')].map((x) => x.className));
    el.replaceChildren(...draw(el));
    el.querySelectorAll('details').forEach((x) => open.has(x.className) && ((x as HTMLDetailsElement).open = true));
  };
  listeners.add(paint);
  paint();
  const timer = tick ? window.setInterval(paint, tick) : 0;
  return { el, stop: () => {
    listeners.delete(paint);
    if (timer) window.clearInterval(timer);
  } };
}
const say = (el: HTMLElement, words: string) => {
  const s = el.querySelector<HTMLElement>('[data-say]');
  if (s) s.textContent = words;
  lastSaid = words;
};
let lastSaid = '';

// ---------------------------------------------------------------- FASTING

interface Fast {
  start: number;
  end: number;
}
const fasts = store('ghosty.body.fast', (r) => ({
  on: fin(r.on) ? (r.on as number) : null,
  target: fin(r.target) && (r.target as number) >= 10 && (r.target as number) <= 72 ? (r.target as number) : 16,
  log: arr<Fast>(r.log, (f) => fin(f.start) && fin(f.end) && f.end > f.start, 500),
}));
export function startFast(): string {
  const f = fasts.get();
  if (f.on) return `You’ve been fasting ${dur(now() - f.on)} already, since ${hm(f.on)}.`;
  f.on = now();
  return fasts.put() ? `Fast started at ${hm(f.on)}. Your target: ${f.target} hours, until about ${hm(f.on + f.target * 3_600_000)}.` : failed;
}
export function endFast(): string {
  const f = fasts.get();
  if (!f.on) return 'No fast running. Say “start a fast” when you begin.';
  const x = { start: f.on, end: now() };
  f.on = null;
  if (x.end - x.start >= 60 * 60_000) f.log.push(x);
  if (!fasts.put()) return failed;
  return x.end - x.start < 60 * 60_000 ? 'That was under an hour, so I didn’t keep it as a fast.' : `Fast kept: ${dur(x.end - x.start)}${x.end - x.start >= f.target * 3_600_000 ? `, your ${f.target}-hour target met` : `, ${dur(f.target * 3_600_000 - (x.end - x.start))} short of your ${f.target} hours`}.`;
}
/** Days in a row (to the last one) with a fast that met the target. */
export function fastStreak(): number {
  const f = fasts.get();
  const met = new Set(f.log.filter((x) => x.end - x.start >= f.target * 3_600_000).map((x) => dayOf(x.end)));
  let d = dayOf(now());
  if (!met.has(d)) d = shift(d, -1);
  let n = 0;
  while (met.has(d)) {
    n++;
    d = shift(d, -1);
  }
  return n;
}
export function fastScreen() {
  return room('fast', (el) => {
    const f = fasts.get();
    const kids: HTMLElement[] = [];
    if (f.on) {
      const so = now() - f.on;
      const frac = Math.min(1, so / (f.target * 3_600_000));
      kids.push(h('p.bc-score', { dataset: { fast: 'on' } }, h('b', dur(so)), h('span', `of ${f.target} hours, since ${hm(f.on)}${frac >= 1 ? ': target met' : `, about ${hm(f.on + f.target * 3_600_000)} to go`}.`)));
    } else if (!f.log.length) {
      /* state: body.fast empty */
      kids.push(emptyState('No fasts kept yet', 'Tap START A FAST when you finish eating, and END THE FAST at your first meal.'));
    }
    if (failed) {
      /* state: body.fast error */
      kids.push(stateLine('error', failed));
    }
    const go = button(f.on ? 'End the fast' : 'Start a fast', () => say(el, f.on ? endFast() : startFast()), 'on');
    const target = h('select', { 'aria-label': 'Your target' }, ...[12, 14, 16, 18, 20, 24].map((x) => h('option', { value: String(x), ...(x === f.target ? { selected: true } : {}) }, `${x} hours`))) as HTMLSelectElement;
    target.addEventListener('change', () => {
      f.target = Number(target.value);
      fasts.put();
    });
    const st = fastStreak();
    kids.push(h('div.pkrow', go), h('div.pkfield', h('label', 'Your target'), target), h('p.pknote', { dataset: { faststreak: String(st) } }, st ? `${st} day${st === 1 ? '' : 's'} in a row with your target met.` : 'Your streak starts with the first fast that meets your target.'));
    if (f.log.length) kids.push(h('section', { 'aria-label': 'Past fasts' }, h('h3.bt-h', 'Past fasts'), h('ul.pkitems', ...f.log.slice(-8).reverse().map((x) => h('li.pkitem', h('span.bt-entry', `${new Date(x.end).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${dur(x.end - x.start)}${x.end - x.start >= f.target * 3_600_000 ? ' · target met' : ''}`))))));
    kids.push(h('p.pknote', { 'aria-live': 'polite', dataset: { say: '' } }), phrases(['start a fast', 'end my fast', 'how long have I been fasting?']), h('p.pknote', 'Kept on this phone only. Not medical advice: if you have a health condition, ask your doctor before fasting.'));
    return kids;
  }, 30_000);
}

// ---------------------------------------------------------------- MEASUREMENTS

export const PARTS = [{ id: 'waist', label: 'Waist' }, { id: 'chest', label: 'Chest' }, { id: 'hips', label: 'Hips' }, { id: 'arms', label: 'Arms' }] as const;
type Part = (typeof PARTS)[number]['id'];
interface Measure {
  d: string;
  t: number;
  part: Part;
  cm: number;
}
const measures = store('ghosty.body.measure', (r) => ({
  inches: r.inches === true,
  log: arr<Measure>(r.log, (m) => PARTS.some((p) => p.id === m.part) && fin(m.cm) && m.cm > 5 && m.cm < 300 && /^\d{4}-\d{2}-\d{2}$/.test(String(m.d)), 2000),
}));
const showLen = (cm: number, inches: boolean) => (inches ? `${Math.round((cm / 2.54) * 10) / 10} in` : `${Math.round(cm * 10) / 10} cm`);
export function addMeasure(part: Part, v: number, inches: boolean): string {
  const cm = inches ? v * 2.54 : v;
  if (!(cm > 5 && cm < 300)) return 'Type a size, like 84 cm or 33 in.';
  const m = measures.get();
  const t = now();
  m.log = m.log.filter((x) => !(x.part === part && x.d === dayOf(t)));
  m.log.push({ d: dayOf(t), t, part, cm: Math.round(cm * 10) / 10 });
  return measures.put() ? `${PARTS.find((p) => p.id === part)!.label}: ${showLen(cm, m.inches)} kept.` : failed;
}
export function measureScreen() {
  return room('measure', (el) => {
    const m = measures.get();
    const kids: HTMLElement[] = [];
    if (!m.log.length) {
      /* state: body.measure empty */
      kids.push(emptyState('No measurements yet', 'Pick waist, chest, hips or arms, type the size and tap KEEP. Once a fortnight is plenty for a trend.'));
    }
    if (failed) {
      /* state: body.measure error */
      kids.push(stateLine('error', failed));
    }
    const part = h('select', { 'aria-label': 'Which measurement' }, ...PARTS.map((p) => h('option', { value: p.id }, p.label))) as HTMLSelectElement;
    const v = h('input', { type: 'number', inputmode: 'decimal', min: '1', max: '300', placeholder: m.inches ? 'in' : 'cm', 'aria-label': `The size, in ${m.inches ? 'inches' : 'centimetres'}` }) as HTMLInputElement;
    const keep = button('Keep', () => {
      const words = addMeasure(part.value as Part, Number(v.value), m.inches);
      say(el, words);
    }, 'on');
    keep.setAttribute('aria-label', 'Keep this measurement');
    const unit = button(m.inches ? 'Inches' : 'Centimetres', () => {
      m.inches = !m.inches;
      measures.put();
    });
    unit.setAttribute('aria-label', `Show in ${m.inches ? 'centimetres' : 'inches'}`);
    kids.push(h('div.kl-grid2', h('div.pkfield', h('label', 'Which'), part), h('div.pkfield', h('label', m.inches ? 'Inches' : 'Centimetres'), v)), h('div.pkrow', keep, unit));
    for (const p of PARTS) {
      const xs = m.log.filter((x) => x.part === p.id).sort((a, b) => a.t - b.t);
      if (!xs.length) continue;
      const last = xs[xs.length - 1]!;
      const first = xs[0]!;
      const diff = last.cm - first.cm;
      const W = 100;
      const lo = Math.min(...xs.map((x) => x.cm)) - 1;
      const hi = Math.max(...xs.map((x) => x.cm)) + 1;
      const svg = svgEl('svg', { viewBox: `0 0 ${W} 30`, preserveAspectRatio: 'none', class: 'bt-chart bm-spark', role: 'img', 'aria-label': `${p.label}: ${xs.length} kept` });
      if (xs.length > 1) svg.append(svgEl('polyline', { points: xs.map((x, i) => `${((i / (xs.length - 1)) * W).toFixed(1)},${(28 - ((x.cm - lo) / (hi - lo)) * 26).toFixed(1)}`).join(' '), class: 'bt-goal bm-line' }));
      kids.push(h('div.bc-cell', { dataset: { part: p.id } }, h('small', p.label), h('b', showLen(last.cm, m.inches)), h('small', xs.length > 1 ? (Math.abs(diff) < 0.3 ? `about the same since ${new Date(first.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : `${showLen(Math.abs(diff), m.inches)} ${diff < 0 ? 'less' : 'more'} than on ${new Date(first.t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`) : 'the first one kept'), svg));
    }
    kids.push(h('p.pknote', { 'aria-live': 'polite', dataset: { say: '' } }), phrases(['my waist is 84 cm', 'chest 40 inches']), h('p.pknote', 'Kept on this phone only. Measure at the same spot and time of day for a fair trend; a rough guide, never medical advice.'));
    return kids;
  });
}

// ---------------------------------------------------------------- GYM LOG

interface GymSet {
  d: string;
  t: number;
  ex: string;
  reps: number;
  kg: number;
}
export const LIFTS = ['Squat', 'Bench press', 'Deadlift', 'Overhead press', 'Barbell row', 'Pull-up', 'Lat pulldown', 'Leg press', 'Dumbbell curl', 'Lunge'];
const gym = store('ghosty.body.gym', (r) => ({ log: arr<GymSet>(r.log, (s) => typeof s.ex === 'string' && fin(s.reps) && fin(s.kg) && s.reps > 0 && s.reps <= 200 && s.kg >= 0 && s.kg <= 600, 5000) }));
/** A rough one-rep max (the Epley formula): weight × (1 + reps / 30); exactly the weight for a single. */
export const oneRep = (kg: number, reps: number): number => Math.round((reps === 1 ? kg : kg * (1 + reps / 30)) * 2) / 2;
export function bests(ex: string): { heaviest: number; orm: number } | null {
  const xs = gym.get().log.filter((s) => s.ex.toLowerCase() === ex.toLowerCase());
  if (!xs.length) return null;
  return { heaviest: Math.max(...xs.map((s) => s.kg)), orm: Math.max(...xs.map((s) => oneRep(s.kg, s.reps))) };
}
export function addSets(ex: string, sets: number, reps: number, kg: number): string {
  const name = ex.trim().replace(/^./, (c) => c.toUpperCase()).slice(0, 40);
  if (!name) return 'Say which exercise, like Squat.';
  if (!(reps >= 1 && reps <= 200) || !(kg >= 0 && kg <= 600) || !(sets >= 1 && sets <= 20)) return 'Type the reps (1 to 200) and the weight in kg (0 for bodyweight).';
  const before = bests(name);
  const g = gym.get();
  const t = now();
  for (let i = 0; i < sets; i++) g.log.push({ d: dayOf(t), t: t + i, ex: name, reps, kg });
  if (!gym.put()) return failed;
  const pb = before && (kg > before.heaviest || oneRep(kg, reps) > before.orm);
  return `${name}: ${sets} set${sets === 1 ? '' : 's'} of ${reps}${kg ? ` at ${kg} kg` : ''} kept.${pb ? ` A personal best: ${kg > before!.heaviest ? `your heaviest yet` : `a rough one-rep max of ${oneRep(kg, reps)} kg`}.` : ''}`;
}
export function gymScreen() {
  return room('gym', (el) => {
    const g = gym.get();
    const kids: HTMLElement[] = [];
    if (!g.log.length) {
      /* state: body.gym empty */
      kids.push(emptyState('No sets kept yet', 'Pick the exercise, type the reps and the weight, and tap ADD SET after each one.'));
    }
    if (failed) {
      /* state: body.gym error */
      kids.push(stateLine('error', failed));
    }
    const names = [...new Set([...g.log.map((s) => s.ex), ...LIFTS])];
    const ex = h('input', { type: 'text', placeholder: 'Squat', 'aria-label': 'The exercise', maxlength: '40' }) as HTMLInputElement;
    ex.setAttribute('list', 'bg-lifts');
    ex.value = g.log.length ? g.log[g.log.length - 1]!.ex : '';
    const reps = h('input', { type: 'number', inputmode: 'numeric', min: '1', max: '200', placeholder: 'Reps', 'aria-label': 'Reps' }) as HTMLInputElement;
    const kg = h('input', { type: 'number', inputmode: 'decimal', min: '0', max: '600', step: '0.5', placeholder: 'kg', 'aria-label': 'Weight in kg' }) as HTMLInputElement;
    const add = button('Add set', () => say(el, addSets(ex.value, 1, Number(reps.value), Number(kg.value || 0))), 'on');
    add.setAttribute('aria-label', 'Add this set');
    kids.push(h('datalist', { id: 'bg-lifts' }, ...names.map((n) => h('option', { value: n }))), h('div.pkfield', h('label', 'Exercise'), ex), h('div.kl-grid2', h('div.pkfield', h('label', 'Reps'), reps), h('div.pkfield', h('label', 'kg'), kg)), h('div.pkrow', add));
    const today = g.log.filter((s) => s.d === dayOf(now()));
    if (today.length) {
      const by = new Map<string, GymSet[]>();
      for (const s of today) by.set(s.ex, [...(by.get(s.ex) ?? []), s]);
      kids.push(h('section', { 'aria-label': 'Today' }, h('h3.bt-h', 'Today'), h('ul.pkitems', ...[...by.entries()].map(([n, ss]) => h('li.pkitem', { dataset: { ex: n } }, h('span.bt-entry', h('b', n), h('small', ` · ${ss.map((s) => `${s.reps}${s.kg ? ` × ${s.kg} kg` : ''}`).join(', ')} · ${ss.reduce((a, s) => a + s.reps * s.kg, 0).toLocaleString('en-GB')} kg lifted`)))))));
    }
    const exs = [...new Set(g.log.map((s) => s.ex))];
    if (exs.length) kids.push(h('section', { 'aria-label': 'Personal bests' }, h('h3.bt-h', 'Personal bests'), h('div.bc-grid', ...exs.slice(0, 12).map((n) => {
      const b = bests(n)!;
      return h('div.bc-cell', { dataset: { pb: n } }, h('small', n), h('b', `${b.heaviest} kg`), h('small', `rough one-rep max ${b.orm} kg`));
    }))));
    kids.push(h('p.pknote', { 'aria-live': 'polite', dataset: { say: '' } }), phrases(['squat 3 sets of 5 at 80 kg', 'bench 8 reps at 60 kg', 'my personal bests']), h('p.pknote', 'Kept on this phone only. The one-rep max is a rough estimate from the Epley formula, never a target.'));
    return kids;
  });
}

// ---------------------------------------------------------------- SYMPTOM DIARY

interface Symptom {
  t: number;
  what: string;
  sev: number;
  note: string;
}
export const SYMPTOMS = ['Headache', 'Migraine', 'Back pain', 'Hay fever', 'Stomach ache', 'Tiredness', 'Cough', 'Joint pain'];
const symptoms = store('ghosty.body.symptoms', (r) => ({ log: arr<Symptom>(r.log, (s) => fin(s.t) && typeof s.what === 'string' && fin(s.sev) && s.sev >= 1 && s.sev <= 10, 2000) }));
export function addSymptom(what: string, sev: number, note = ''): string {
  const w = what.trim().replace(/^./, (c) => c.toUpperCase()).slice(0, 40);
  if (!w) return 'Say what it was, like Headache.';
  if (!(sev >= 1 && sev <= 10)) return 'How bad, from 1 (barely) to 10 (the worst)?';
  symptoms.get().log.push({ t: now(), what: w, sev: Math.round(sev), note: note.trim().slice(0, 200) });
  return symptoms.put() ? `${w}, ${Math.round(sev)} out of 10, kept at ${hm(now())}.` : failed;
}
/** The tidy page for an appointment: every entry of the last `days` days, newest first, with no reading into it. */
export function doctorPage(days = 30): string {
  const from = now() - days * 864e5;
  const xs = symptoms.get().log.filter((s) => s.t >= from).sort((a, b) => b.t - a.t);
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const by = new Map<string, number[]>();
  for (const s of xs) by.set(s.what, [...(by.get(s.what) ?? []), s.sev]);
  const sum = [...by.entries()].map(([w, v]) => `<li>${esc(w)}: ${v.length} time${v.length === 1 ? '' : 's'}, ${Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10} out of 10 on average</li>`).join('');
  const rows = xs.map((s) => `<tr><td>${esc(new Date(s.t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</td><td>${esc(s.what)}</td><td>${s.sev}/10</td><td>${esc(s.note)}</td></tr>`).join('');
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Symptom diary</title><style>body{font:16px/1.4 system-ui,sans-serif;margin:24px;color:black;background:white}table{border-collapse:collapse;width:100%}td,th{border:1px solid gray;padding:6px;text-align:left;vertical-align:top}</style></head><body><h1>Symptom diary</h1><p>The last ${days} days, as I noted them. My own notes, not a diagnosis.</p><h2>In short</h2><ul>${sum || '<li>Nothing noted.</li>'}</ul><h2>Every entry</h2><table><tr><th>When</th><th>What</th><th>How bad</th><th>Notes</th></tr>${rows}</table></body></html>`;
}
export function symptomScreen() {
  return room('symptoms', (el) => {
    const s = symptoms.get();
    const kids: HTMLElement[] = [];
    if (!s.log.length) {
      /* state: body.symptoms empty */
      kids.push(emptyState('No symptoms noted', 'Tap what it is, pick how bad from 1 to 10, and keep it. Before an appointment, save one tidy page for your doctor.'));
    }
    if (failed) {
      /* state: body.symptoms error */
      kids.push(stateLine('error', failed));
    }
    const what = h('input', { type: 'text', placeholder: 'Headache', maxlength: '40', 'aria-label': 'What it is' }) as HTMLInputElement;
    what.setAttribute('list', 'bs-sym');
    const sev = h('select', { 'aria-label': 'How bad, 1 to 10' }, ...Array.from({ length: 10 }, (_, i) => h('option', { value: String(i + 1), ...(i === 4 ? { selected: true } : {}) }, `${i + 1}${i === 0 ? ', barely' : i === 9 ? ', the worst' : ''}`))) as HTMLSelectElement;
    const note = h('input', { type: 'text', placeholder: 'A note (optional)', maxlength: '200', 'aria-label': 'A note' }) as HTMLInputElement;
    const keep = button('Keep it', () => say(el, addSymptom(what.value, Number(sev.value), note.value)), 'on');
    keep.setAttribute('aria-label', 'Keep this symptom');
    const quick = h('div.pkrow.bt-moods', { role: 'group', 'aria-label': 'Quick picks' }, ...SYMPTOMS.map((x) => button(x, () => (what.value = x))));
    kids.push(h('datalist', { id: 'bs-sym' }, ...SYMPTOMS.map((x) => h('option', { value: x }))), quick, h('div.pkfield', h('label', 'What'), what), h('div.kl-grid2', h('div.pkfield', h('label', 'How bad'), sev), h('div.pkfield', h('label', 'Note'), note)), h('div.pkrow', keep));
    const recent = s.log.slice(-10).reverse();
    if (recent.length) kids.push(h('section', { 'aria-label': 'Recent' }, h('h3.bt-h', 'Recent'), h('ul.pkitems', ...recent.map((x) => h('li.pkitem', h('span.bt-entry', h('b', `${x.what} · ${x.sev}/10`), h('small', ` · ${new Date(x.t).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}${x.note ? ` · ${x.note}` : ''}`)))))));
    if (s.log.length) {
      const save = button('Save a page for the doctor', () => {
        const html = doctorPage();
        lastPage = html;
        try {
          const a = h('a', { href: URL.createObjectURL(new Blob([html], { type: 'text/html' })), download: 'symptom-diary.html' }) as HTMLAnchorElement;
          a.click();
          window.setTimeout(() => URL.revokeObjectURL(a.href), 30_000);
          say(el, 'Saved: symptom-diary.html, the last 30 days on one page, ready to show or print.');
        } catch {
          say(el, 'This phone wouldn’t save the page. Try again in a moment.');
        }
      });
      save.setAttribute('aria-label', 'Save one page of the last 30 days for the doctor');
      kids.push(h('div.pkrow', save));
    }
    kids.push(h('p.pknote', { 'aria-live': 'polite', dataset: { say: '' } }), phrases(['headache 6 out of 10', 'log back pain 4', 'my symptoms']), h('p.pknote', 'Kept on this phone only. Your own notes to show your doctor: I never guess what it might be.'));
    return kids;
  });
}
let lastPage = '';

// ---------------------------------------------------------------- the chat

/** "start a fast", "end my fast", "my waist is 84 cm", "squat 3 sets of 5 at 80 kg", "headache 6 out of 10" (null: not these). */
export function moreTurn(text: string): { reply: string; open: string } | null {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '').replace(/’/g, "'");
  if (/^(?:start(?:ing)?|begin) (?:a |my )?fast(?:ing)?$|^i'?m (?:starting|beginning) (?:a |my )?fast$/.test(t)) return { reply: startFast(), open: 'fast' };
  if (/^(?:end|stop|break|finish) (?:the |my )?fast(?:ing)?$|^i'?ve (?:broken|ended) my fast$/.test(t)) return { reply: endFast(), open: 'fast' };
  if (/^how long have i been fasting$|^(?:my )?fast(?:ing)? (?:so far|status)$/.test(t)) {
    const f = fasts.get();
    return { reply: f.on ? `${dur(now() - f.on)} so far, since ${hm(f.on)}, of your ${f.target} hours.` : 'No fast running.', open: 'fast' };
  }
  const ms = /^(?:my )?(waist|chest|hips?|arms?)(?: is| measures?|:)?\s*(\d+(?:\.\d+)?)\s*(cm|centimetres?|in|inches|")$/.exec(t);
  if (ms) return { reply: addMeasure((ms[1]!.replace(/s$/, '') === 'hip' ? 'hips' : ms[1]!.replace(/s$/, '') === 'arm' ? 'arms' : ms[1]!.replace(/s$/, '')) as Part, Number(ms[2]), !/^c/.test(ms[3]!)), open: 'measure' };
  const gs = /^(squats?|bench(?: press)?|deadlifts?|overhead press|press|rows?|barbell rows?|pull-?ups?|leg press|curls?|lunges?)\s+(?:(\d+) sets? of )?(\d+)(?: reps)?(?: (?:at|with|@) (\d+(?:\.\d+)?)\s*(?:kg|kilos?))?$/.exec(t);
  if (gs) {
    const name = /^squat/.test(gs[1]!) ? 'Squat' : /^bench/.test(gs[1]!) ? 'Bench press' : /^dead/.test(gs[1]!) ? 'Deadlift' : /press$/.test(gs[1]!) && /leg/.test(gs[1]!) ? 'Leg press' : /press/.test(gs[1]!) ? 'Overhead press' : /row/.test(gs[1]!) ? 'Barbell row' : /pull/.test(gs[1]!) ? 'Pull-up' : /curl/.test(gs[1]!) ? 'Dumbbell curl' : 'Lunge';
    return { reply: addSets(name, Number(gs[2] ?? 1), Number(gs[3]), Number(gs[4] ?? 0)), open: 'gym' };
  }
  if (/^(?:my )?(?:personal bests|pbs|gym bests)$/.test(t)) {
    const exs = [...new Set(gym.get().log.map((s) => s.ex))];
    return { reply: exs.length ? exs.map((n) => `${n} ${bests(n)!.heaviest} kg`).join(', ') + '. One-rep maxes on the Gym log are rough estimates.' : 'No sets kept yet.', open: 'gym' };
  }
  const sy = /^(?:log |note |i have (?:a |an )?|i've got (?:a |an )?)?(headache|migraine|back pain|hay fever|stomach ache|tiredness|cough|joint pain)[, ]+(?:a |about )?(\d{1,2})(?: out of 10|\/10)?$/.exec(t);
  if (sy && Number(sy[2]) >= 1 && Number(sy[2]) <= 10) return { reply: addSymptom(sy[1]!, Number(sy[2])), open: 'symptoms' };
  if (/^(?:my |open my |show my )?symptoms?(?: diary)?$/.test(t)) return { reply: `${symptoms.get().log.length} noted. The symptom diary is open; save a page for your doctor from there.`, open: 'symptoms' };
  return null;
}

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.bodymore = { fast: () => fasts.get(), measure: () => measures.get(), gym: () => gym.get(), symptoms: () => symptoms.get(), page: () => lastPage || doctorPage(), said: () => lastSaid, reset: () => [fasts, measures, gym, symptoms].forEach((s) => s.reset()) };
}
