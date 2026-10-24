/**
 * NIGHT SCHOOL on the phone (BRIEF-NIGHT-SCHOOL part A; the plan, the window and the words: packages/shared/src/night.ts;
 * the switch, tonight's practice, its marks and the morning report: the brain's /api/school/night, school/night.ts).
 *
 * Started at boot (main.ts). Every 15 seconds, and whenever Ghosty comes back on screen, it looks at the clock: while
 * NIGHT SCHOOL is on, Ghosty is on screen, the phone is plugged in (when the browser can tell) and the time is inside
 * the window, it holds a screen wake lock, dims the screen (a dark layer with the progress line; a tap shows Ghosty for
 * a minute) and works through the plan in order:
 *   1. school practice on the offline brain (one job on the model at a time, like a paper: offline/lock.ts), its
 *      answers marked by the brain five at a time;
 *   2. the GYM's TRAIN ALL (features/gym `gymControl`; the GYM is built off screen when it was not opened yet);
 *   3. the library's STUDY ALL (the brain reads; the phone asks it for a session every few minutes and counts the
 *      passages read).
 * Honest about the iPhone: nothing runs with the screen off — when Ghosty is hidden or the phone locks, the plan pauses
 * (the GYM pauses itself, the practice stops) and carries on when it is back on screen. When the window ends the
 * morning report goes to the brain, which files it in the inbox and the school report. State at window.__ghosty.night.
 */
import { advance, cleanSettings, morningReport, newNight, NIGHT_DEFAULTS, nightWindow, progressLine, type NightCtx, type NightRun, type NightSettings } from '../../../../packages/shared/src/night';
import { brain, headers } from '../api/brain';
import { createStore } from '../core/store';
import { META as GAMES } from '../gym/meta';
import { loadOffline, offlineReady, offlineReply } from '../offline/brain';
import { withModel } from '../offline/lock';
import { examPrompt, TOKENS, type SitItem } from '../school/sit';
import { ensureMounted } from '../shell/tabs';
import { gymControl } from '../features/gym';
import { niceCase } from '../ui/components';

/** What NIGHT SCHOOL is doing, for the SYSTEM card and the dimmed screen (and window.__ghosty.night). */
export const night = createStore(
  {
    settings: { ...NIGHT_DEFAULTS } as NightSettings,
    run: null as NightRun | null,
    /** off · waiting (outside the window) · running · paused (in the window, but cannot run now) · done (tonight's plan finished) */
    state: 'off' as 'off' | 'waiting' | 'running' | 'paused' | 'done',
    line: '',
    /** Why it is paused, in plain words. */
    why: '',
    /** The dark layer is up (a tap lifts it for a minute). */
    dim: false,
    /** The screen wake lock: the browser has one, it is held now, how many were asked for. */
    lock: { can: false, held: false, requests: 0 },
    /** Whether the phone is charging: null when the browser cannot tell (an iPhone cannot). */
    charging: null as boolean | null,
    /** The last morning report (the phone's, or the brain's own when the phone sent none). */
    report: null as Report | null,
    /** The brain could not be reached the last time it was asked. */
    offline: false,
  },
  { persist: 'ghosty.night', keys: ['settings', 'run', 'report'] },
);

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`/api${path}`, { method, headers: headers(body !== undefined ? { 'content-type': 'application/json' } : {}), body: body !== undefined ? JSON.stringify(body) : undefined, credentials: 'same-origin' });
  const j = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new Error(j?.error ?? `Ghosty could not be reached (${r.status}).`);
  return j as T;
}

type Report = { night: string; text: string; at: number; from: string };
type View = { settings: NightSettings; report: Report | null };

/** The switch and the window, saved on the brain (it runs its own part in the same window). */
export async function setNight(patch: Partial<NightSettings>): Promise<void> {
  const settings = cleanSettings({ ...night.get().settings, ...patch });
  night.set({ settings });
  const v = await call<View>('POST', '/school/night', settings);
  night.set({ settings: cleanSettings(v.settings), report: v.report ?? night.get().report, offline: false });
  void tick();
}

// ---- the screen: the wake lock and the dark layer -----------------------------------------------------------------

interface Lock {
  release(): Promise<void>;
  addEventListener(type: 'release', f: () => void): void;
}
const wakeLock = () => (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<Lock> } }).wakeLock;
let lock: Lock | null = null;
let locking = false;
function holdScreen(on: boolean): void {
  const api = wakeLock();
  const l = night.get().lock;
  if (!api) return;
  if (on && !lock && !locking && !document.hidden) {
    locking = true;
    night.set({ lock: { ...l, requests: l.requests + 1 } });
    api.request('screen').then(
      (x) => {
        locking = false;
        lock = x;
        night.set({ lock: { ...night.get().lock, held: true } });
        x.addEventListener('release', () => {
          if (lock === x) lock = null;
          night.set({ lock: { ...night.get().lock, held: !!lock } });
        });
        if (night.get().state !== 'running') holdScreen(false);
      },
      () => (locking = false),
    );
  } else if (!on && lock) {
    const x = lock;
    lock = null;
    night.set({ lock: { ...l, held: false } });
    void x.release().catch(() => undefined);
  }
}

let liftedUntil = 0;
/** A tap on the dark layer shows Ghosty for a minute. */
export function liftDim(): void {
  liftedUntil = Date.now() + 60_000;
  night.set({ dim: false });
}

// ---- the parts -----------------------------------------------------------------------------------------------------

let schoolStop: AbortController | null = null;
let schoolBusy = false;
/** Why the school part could not run just now (the model busy with something else, the brain away); tried again next tick. */
let schoolHold = '';

const setRun = (f: (r: NightRun) => NightRun) => {
  const r = night.get().run;
  if (r) night.set({ run: f(r) });
};

/** Tonight's practice on the offline brain: the questions from the brain, answered one at a time, marked five at a time. */
async function schoolGo(): Promise<void> {
  if (schoolBusy) return;
  schoolBusy = true;
  const ctl = (schoolStop = new AbortController());
  try {
    const { items } = await call<{ items: (SitItem & { id: string })[] }>('GET', '/school/night/practice');
    const done = new Set(night.get().run?.school.done ?? []);
    setRun((r) => ({ ...r, school: { ...r.school, asked: true, of: Math.max(r.school.of, items.length) } }));
    const todo = items.filter((x) => !done.has(x.id));
    if (!todo.length) return;
    await withModel(
      'bench',
      async () => {
        await loadOffline();
        let batch: { id: string; given: string }[] = [];
        const send = async () => {
          if (!batch.length) return;
          const b = batch;
          batch = [];
          const m = await call<{ marked: number; right: number }>('POST', '/school/night/answers', { answers: b });
          setRun((r) => ({ ...r, school: { ...r.school, right: r.school.right + m.right } }));
        };
        for (const it of todo) {
          if (ctl.signal.aborted || night.get().run?.part !== 'school') break;
          let given = '';
          try {
            given = (await offlineReply(examPrompt(it, []), () => undefined, ctl.signal, { temperature: 0.3, max: TOKENS.item })).text;
          } catch {
            if (ctl.signal.aborted) break;
          }
          if (ctl.signal.aborted) break;
          batch.push({ id: it.id, given });
          setRun((r) => ({ ...r, school: { ...r.school, n: r.school.n + 1, done: [...r.school.done, it.id] } }));
          paint();
          if (batch.length >= 5) await send();
        }
        await send();
      },
      { wait: false },
    );
    schoolHold = '';
  } catch (e) {
    schoolHold = String((e as Error)?.message ?? e).slice(0, 160);
  } finally {
    schoolBusy = false;
    if (schoolStop === ctl) schoolStop = null;
    void tick();
  }
}
const schoolEnd = () => schoolStop?.abort();

/** Each game's level now (and which are mastered), from the GYM. */
const gymLevels = () => gymControl?.levels() ?? {};

let studyAt = 0;
let studyLeft = true;
/** Ask the brain for a study session every few minutes; count the passages read since the study part began. */
async function studyGo(now: number): Promise<void> {
  if (now - studyAt < 3 * 60_000) return;
  studyAt = now;
  try {
    const run = night.get().run;
    const st = run?.study.from === null ? await brain.studyStatus() : await brain.study({ now: true });
    const s = st.summary as typeof st.summary & { finished?: number };
    studyLeft = st.on && (s.finished ?? 0) < s.domains.length;
    setRun((r) => (r.study.from === null ? { ...r, study: { from: s.read, read: 0 } } : { ...r, study: { ...r.study, read: Math.max(r.study.read, s.read - (r.study.from ?? s.read)) } }));
  } catch {
    /* the brain is away: asked again next time */
  }
}

/** Stop what runs on the phone (the brain's part goes on by itself). */
function stopParts(): void {
  schoolEnd();
  if (gymControl?.allOn()) gymControl.stopAll();
}

// ---- the clock -----------------------------------------------------------------------------------------------------

let lastTick = 0;
let ticking = false;
let battery: { charging: boolean } | null = null;

/** The morning report for a night that is over: to the brain (inbox and school report), once. */
async function finish(run: NightRun): Promise<void> {
  const names = Object.fromEntries(GAMES.map((g) => [g.id, niceCase(g.title).toLowerCase()]));
  const text = morningReport(run, names);
  try {
    const r = await call<{ report: Report }>('POST', '/school/night/report', { night: run.night, text });
    night.set({ run: { ...run, reported: true }, report: r.report ?? { night: run.night, text, at: Date.now(), from: 'phone' } });
  } catch {
    // the brain is away: the run is kept (on this phone too) and sent at the next tick
  }
}

/** One look at the clock: what should run now, and the line that says so. */
export async function tick(): Promise<void> {
  if (ticking) return;
  ticking = true;
  try {
    const now = Date.now();
    const dt = lastTick ? Math.min(60_000, Math.max(0, now - lastTick)) : 0;
    lastTick = now;
    const s = night.get().settings;
    night.set({ lock: { ...night.get().lock, can: !!wakeLock() }, charging: battery ? battery.charging : null });
    const old = night.get().run;
    const w = nightWindow(now, s);
    // a night that is over (or Night School switched off while one ran): its morning report first
    if (old && !old.reported && (!w.inside || old.night !== w.night || !s.on)) {
      stopParts();
      await finish(advance(old, { now, end: now, offline: false, gymLeft: false, studyLeft: false }));
    }
    if (!s.on || !w.inside) {
      stopParts();
      holdScreen(false);
      night.set({ state: s.on ? 'waiting' : 'off', why: '', dim: false, line: s.on ? `Night School · on · starts at ${s.from}` : 'Night School is off' });
      return;
    }
    // Nothing runs with the screen off: hidden or locked, the plan pauses (and carries on when Ghosty is back).
    const why = document.hidden ? 'Ghosty is not on screen' : night.get().charging === false ? 'plug the phone in' : '';
    if (why) {
      stopParts();
      holdScreen(false);
      const r = night.get().run;
      night.set({ run: r && r.night === w.night ? r : newNight(w.night, now), state: 'paused', why, dim: false, line: `Night School · paused: ${why}` });
      return;
    }
    // The GYM is built (off screen) so TRAIN ALL can run; its saved games are read first.
    if (!gymControl) ensureMounted('gym');
    await gymControl?.ready;
    const levels = gymLevels();
    const offline = await offlineReady().catch(() => false);
    // (read after the waits: the practice running beside this keeps its count in the store)
    let run = night.get().run;
    if (!run || run.night !== w.night) run = newNight(w.night, now);
    if (run.part === 'gym' && gymControl?.allOn()) run = { ...run, gym: { ...run.gym, ms: run.gym.ms + dt } };
    const ctx: NightCtx = { now, end: w.end, offline, gymLeft: Object.values(levels).some((x) => !x.mastered), studyLeft };
    run = advance(run, ctx);
    // the GYM's levels: each game not yet mastered when the gym part began, its level then and now (and mastered tonight)
    if (run.part === 'gym' && !Object.keys(run.gym.from).length) run = { ...run, gym: { ...run.gym, from: Object.fromEntries(Object.entries(levels).filter(([, x]) => !x.mastered).map(([id, x]) => [id, x.level])) } };
    const from = run.gym.from;
    if (Object.keys(from).length) run = { ...run, gym: { ...run.gym, to: Object.fromEntries(Object.keys(from).map((id) => [id, levels[id]?.level ?? from[id]!])), mastered: Object.keys(from).filter((id) => levels[id]?.mastered) } };
    night.set({ run, state: run.part === 'done' ? 'done' : 'running', why: schoolHold && run.part === 'school' ? schoolHold : '' });
    if (run.part !== 'school') schoolEnd();
    if (run.part !== 'gym' && gymControl?.allOn()) gymControl.stopAll();
    if (run.part === 'school') void schoolGo();
    if (run.part === 'gym') gymControl?.startAll();
    if (run.part === 'study') await studyGo(now);
    // the screen held on, dimmed, while there is work; tonight's plan finished: let go
    holdScreen(run.part !== 'done');
    if (run.part === 'done') night.set({ dim: false });
    else if (!night.get().dim && now > liftedUntil) night.set({ dim: true });
    paint();
  } finally {
    ticking = false;
  }
}

/** The progress line, from what the store holds. */
function paint(): void {
  const st = night.get();
  if (!st.run || (st.state !== 'running' && st.state !== 'done')) return;
  night.set({ line: progressLine(st.run, Date.now(), st.settings, gymControl?.now() ?? '') });
}

let started = false;
/** At boot (main.ts): the settings and the last report from the brain, then the clock. */
export function startNight(): void {
  if (started) return;
  started = true;
  void import('./layer').then((m) => m.nightLayer());
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.night = { get: () => night.get(), tick };
  night.subscribe((s) => {
    if (w.__ghosty) w.__ghosty.night = { ...s, get: () => night.get(), tick };
  });
  const nav = navigator as Navigator & { getBattery?: () => Promise<{ charging: boolean; addEventListener(t: 'chargingchange', f: () => void): void }> };
  void nav.getBattery?.().then(
    (b) => {
      battery = b;
      b.addEventListener('chargingchange', () => void tick());
    },
    () => undefined,
  );
  void call<View>('GET', '/school/night').then(
    (v) => night.set({ settings: cleanSettings(v.settings), report: v.report ?? night.get().report, offline: false }),
    () => night.set({ offline: true }),
  ).finally(() => void tick());
  window.setInterval(() => void tick(), 15_000);
  document.addEventListener('visibilitychange', () => void tick());
}
