/**
 * NIGHT SCHOOL on the brain (BRIEF-NIGHT-SCHOOL part A; the plan, the window and the words are in
 * packages/shared/src/night.ts). The brain keeps the switch and the window (storage `school:night`), and:
 *  - hands the phone tonight's school practice (`/school/night/practice`: checked exact items of his weak topics at his
 *    stage, the weakest first, the ones he got wrong before first; questions only) and marks its answers exactly
 *    (`/school/night/answers`, SCHOOL's `markExact`); a wrong one is counted on the item (`missed`), and missed items go
 *    first into the next week's training (practice.ts `practiceRecords`);
 *  - runs its own parts in the same window whether the phone is open or not (`nightStep`, from the training job's step,
 *    selftrain/cycle.ts): practice written by the free online models goes on with a night allowance (even while the
 *    week gathers), and the library's study job is kept due within minutes; the job wakes at the window's start;
 *  - files the morning report (`/school/night/report` from the phone, once a night) in the inbox and in the next school
 *    report's news; when the phone sent none, the daily report files the brain's own (`nightMorning`).
 */
import { brainReport, cleanSettings, NIGHT_DEFAULTS, NIGHT_LIMITS, nightWindow, type NightSettings } from '../../../../packages/shared/src/night';
import { weakSpots } from '../../../../packages/shared/src/school';
import { loadStudy, studySummary } from '../library/study';
import { addInbox, loadJobs, setNext } from '../schedule';
import { agrees, loadPractice, practiceKey, type PracticeItem, type PracticeTopic } from './practice';
import { addNews, loadState, saveState, type Store } from './state';

export const NIGHT_KEY = 'school:night';
/** Extra practice-writing calls the brain may make in a night's window (the day's own allowance stays as it was). */
export const NIGHT_CALLS = 40;
/** In the window, the library's study job is brought forward when it is due later than this. */
const STUDY_NUDGE = 15 * 60_000;

export interface NightRecord {
  settings: NightSettings;
  /** Where practice and study stood when the brain's part of a night began, and when that window ends. */
  brain?: { night: string; end: number; practice: number; read: number };
  /** The last morning report filed, and whose. */
  report?: { night: string; text: string; at: number; from: 'phone' | 'brain' };
}

export async function loadNight(storage: DurableObjectStorage): Promise<NightRecord> {
  const r = await storage.get<NightRecord>(NIGHT_KEY).catch(() => undefined);
  return { ...r, settings: cleanSettings(r?.settings ?? NIGHT_DEFAULTS) };
}
const saveNight = (storage: DurableObjectStorage, r: NightRecord) => storage.put(NIGHT_KEY, r);

const practiceCount = async (storage: DurableObjectStorage): Promise<number> => {
  const st = await loadState({ storage });
  return (await loadPractice(storage, st.stage)).reduce((n, t) => n + t.items.length, 0);
};
const studyRead = async (storage: DurableObjectStorage): Promise<number> => studySummary(await loadStudy(storage)).read;

/**
 * The brain's part of the night, from the training job's step: null with Night School off; outside the window, when
 * it wants the job back (the window's start); inside it, the night's starting counts kept once and the study job kept
 * due. Never throws.
 */
export async function nightStep(d: { storage: DurableObjectStorage; now?: () => number }): Promise<{ inside: boolean; next: number } | null> {
  try {
    const now = (d.now ?? Date.now)();
    const rec = await loadNight(d.storage);
    if (!rec.settings.on) return null;
    const w = nightWindow(now, rec.settings);
    if (!w.inside) return { inside: false, next: Math.max(60_000, w.start - now) };
    if (rec.brain?.night !== w.night) {
      rec.brain = { night: w.night, end: w.end, practice: await practiceCount(d.storage).catch(() => 0), read: await studyRead(d.storage).catch(() => 0) };
      await saveNight(d.storage, rec);
    }
    const job = (await loadJobs(d.storage)).find((j) => j.kind === 'study');
    if (job && job.next > now + STUDY_NUDGE) await setNext(d.storage, job.id, now + 60_000);
    return { inside: true, next: 10 * 60_000 };
  } catch {
    return null;
  }
}

/** Night School is on and `now` is inside its window (the practice allowance and pace follow it). */
export async function nightInside(storage: DurableObjectStorage, now: number): Promise<boolean> {
  const rec = await loadNight(storage).catch(() => null);
  return !!rec?.settings.on && nightWindow(now, rec.settings).inside;
}

/** A question as the phone gets it: no answer. */
export interface NightItem {
  id: string;
  q: string;
  type: PracticeItem['type'];
  marks: number;
  options?: string[];
}

/** Tonight's practice: exact items of his weak topics at his stage, a topic at a time in turn (weakest first), missed ones first. */
export async function nightItems(storage: DurableObjectStorage, max = NIGHT_LIMITS.practice): Promise<NightItem[]> {
  const st = await loadState({ storage });
  const weak = weakSpots(st.results.filter((r) => r.stage === st.stage), 50).map((w) => practiceKey(w.stage, w.subject, w.topic));
  const rank = (t: PracticeTopic) => {
    const i = weak.indexOf(practiceKey(t.stage, t.subject, t.topic));
    return i < 0 ? weak.length : i;
  };
  const topics = (await loadPractice(storage, st.stage)).sort((a, b) => rank(a) - rank(b));
  const queues = topics.map((t) =>
    t.items
      .map((it, i) => ({ it, id: `${practiceKey(t.stage, t.subject, t.topic)}#${i}` }))
      .filter((x) => x.it.type !== 'short')
      .sort((a, b) => (b.it.missed ?? 0) - (a.it.missed ?? 0)),
  );
  const out: NightItem[] = [];
  for (let i = 0; out.length < max && queues.some((q) => i < q.length); i++) {
    for (const q of queues) {
      const x = q[i];
      if (!x || out.length >= max) continue;
      out.push({ id: x.id, q: x.it.q, type: x.it.type, marks: 1, ...(x.it.options ? { options: x.it.options } : {}) });
    }
  }
  return out;
}

/** His answers marked exactly; a wrong one is counted on its item (it goes first into the next week's training). */
export async function markNight(storage: DurableObjectStorage, answers: { id: string; given: string }[]): Promise<{ marked: number; right: number }> {
  const byKey = new Map<string, { i: number; given: string }[]>();
  for (const a of answers.slice(0, NIGHT_LIMITS.practice * 2)) {
    const m = /^(school:practice:[^#]+)#(\d+)$/.exec(String(a?.id ?? ''));
    if (m) byKey.set(m[1]!, [...(byKey.get(m[1]!) ?? []), { i: Number(m[2]), given: String(a.given ?? '').slice(0, 4000) }]);
  }
  let marked = 0;
  let right = 0;
  for (const [key, list] of byKey) {
    const t = await storage.get<PracticeTopic>(key);
    if (!t?.items) continue;
    let changed = false;
    for (const { i, given } of list) {
      const it = t.items[i];
      if (!it || it.type === 'short') continue;
      marked++;
      if (agrees(it, given)) right++;
      else {
        it.missed = (it.missed ?? 0) + 1;
        changed = true;
      }
    }
    if (changed) await storage.put(key, t);
  }
  return { marked, right };
}

type Serial = <T>(d: Store, fn: () => Promise<T>) => Promise<T>;

/** The morning report filed: in the inbox, and in the next school report's news. */
async function file(d: Store, serial: Serial, rec: NightRecord, night: string, text: string, from: 'phone' | 'brain', now: number): Promise<void> {
  rec.report = { night, text, at: now, from };
  await saveNight(d.storage, rec);
  await addInbox(d.storage, { kind: 'task', title: 'Night School', text });
  await serial(d, async () => {
    const st = await loadState(d);
    addNews(st, `Night School: ${text.replace(/^Last night: /, 'last night ')}`);
    await saveState(d, st);
  }).catch(() => undefined);
}

/** The brain's own morning report, from the daily report, for a night whose window has ended and the phone sent none. */
export async function nightMorning(d: Store & { now?: () => number }, serial: Serial): Promise<string | null> {
  const now = (d.now ?? Date.now)();
  const rec = await loadNight(d.storage);
  const b = rec.brain;
  if (!b || now < b.end || rec.report?.night === b.night) return null;
  const text = brainReport({ practice: Math.max(0, (await practiceCount(d.storage).catch(() => b.practice)) - b.practice), read: Math.max(0, (await studyRead(d.storage).catch(() => b.read)) - b.read) });
  await file(d, serial, rec, b.night, text, 'brain', now);
  return text;
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** /school/night and /school/night/* (owner-only, through routes.ts). */
export async function nightRoute(path: string, method: string, body: Record<string, unknown>, d: Store & { now?: () => number }, serial: Serial): Promise<Response> {
  const now = (d.now ?? Date.now)();
  const view = (rec: NightRecord) => ({ settings: rec.settings, window: nightWindow(now, rec.settings), report: rec.report ?? null });
  if (path === '/school/night' && method === 'GET') return json(view(await loadNight(d.storage)));
  if (path === '/school/night' && method === 'POST') {
    const rec = await loadNight(d.storage);
    rec.settings = cleanSettings({ ...rec.settings, ...(typeof body.on === 'boolean' ? { on: body.on } : {}), ...(typeof body.from === 'string' ? { from: body.from } : {}), ...(typeof body.to === 'string' ? { to: body.to } : {}) });
    await saveNight(d.storage, rec);
    return json(view(rec));
  }
  if (path === '/school/night/practice' && method === 'GET') {
    const st = await loadState(d);
    return json({ stage: st.stage, items: await nightItems(d.storage) });
  }
  if (path === '/school/night/answers' && method === 'POST') return json(await markNight(d.storage, Array.isArray(body.answers) ? (body.answers as { id: string; given: string }[]) : []));
  if (path === '/school/night/report' && method === 'POST') {
    const night = String(body.night ?? '');
    const text = String(body.text ?? '').trim().slice(0, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(night) || !/^Last night: /.test(text)) return json({ error: 'a morning report needs its night and its words' }, 400);
    const rec = await loadNight(d.storage);
    // once a night (the phone may send it again after a reload); the phone's replaces the brain's own
    if (rec.report?.night === night && rec.report.from === 'phone') return json({ ok: true, filed: false, report: rec.report });
    await file(d, serial, rec, night, text, 'phone', now);
    return json({ ok: true, filed: true, report: rec.report });
  }
  return json({ error: 'not found' }, 404);
}
