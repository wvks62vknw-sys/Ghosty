/**
 * GOODNIGHT (planlane2, plan.c6 with boot.s1's wind-down): he says "goodnight" (or "good night", "night night", "nighty night", "time
 * for bed", "bedtime"; the bed forms are the body lane's GOING TO BED), or taps GOODNIGHT in the Brief after six. A three-second wind-down first (the screen
 * dims, the orb rests, the night look comes on for tonight only, never saved), then in turn, each said in one line in the chat:
 *   - every light in his house that is on is turned off (lights only; never a lock, an alarm, a garage door, a gate or anything in the
 *     guarded set: those still open are listed, each with a LOCK UP key that needs his own tap and his confirm, every time);
 *   - if the radio is playing, its sleep timer is set (30 minutes, said; a sooner timer of his is kept);
 *   - sleep tracking starts (the body lane's GOING TO BED, features/body/track.ts toBed);
 *   - the day ahead's first event is said ("Tomorrow: Dentist at 9:30."), or that it is clear.
 * A step that cannot run says why in his words (the house not linked, the brain out of reach, nothing playing) and the rest still run.
 * Nothing sends or posts. It calls the existing pieces and rewrites none of them: the house (house/api.ts act, the guarded rules in
 * packages/shared/src/house.ts), the radio (assistant/media.ts), the agenda (brain.agenda), the body's tracker and the look
 * (state/theme.ts). Each step is exported on its own (GOODNIGHT_STEPS) so a one-word routine engine can call them.
 */
import type { PackReply } from '../../assistant/packs';
import { player, setSleepAt } from '../../assistant/media';
import { brain } from '../../api/brain';
import { act, loadHouse } from '../../house/api';
import { isGuarded } from '../../../../../packages/shared/src/house';
import { settings } from '../../state/app';
import { offline } from '../../api/offline';
import { groundNow, nightFor, nightShowing } from '../../state/theme';
import { aheadLine, closeLine, lightsLine, lockKey, lockLine, openGuard, openLine, radioLine, sleepLine, type DayEvent } from './goodnightwords';

type Go = NonNullable<PackReply['go']>[number];
/** What one step did, in one line, and any key it offers. */
export interface StepOut {
  line: string;
  go?: Go[];
}

/** How long the wind-down lasts before the lines are said. */
export const WIND_DOWN_MS = 3000;
/** The radio's sleep timer goodnight sets. */
export const SLEEP_MIN = 30;
/** No step waits longer than this on the brain or his house: the rest are said regardless. */
const WAIT_MS = 8000;
const within = <T>(p: Promise<T>, ms = WAIT_MS): Promise<T | null> => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);

// ---------------------------------------------------------------- the wind-down and the night look

/** The next five in the morning on the phone's clock: when tonight's night look ends by itself. */
export function morningAt(now = Date.now()): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getHours() < 5 ? 0 : 1), 5).getTime();
}
/**
 * The night look on for tonight: his own night ground, if the ground in force is Paper. A passing override in state/theme.ts
 * (nightFor): never in his recipe, so no later look change saves it; it ends at five, or at his next look change.
 */
export function nightLook(): 'on' | 'already' {
  if (nightShowing() || groundNow() !== 'paper') return 'already';
  nightFor(morningAt());
  return 'on';
}

let woke: (() => void) | null = null;
/**
 * THE WIND-DOWN: for three seconds the screen settles (html[data-goodnight="down"]: the feeds dim and the orb rests, styles.css
 * [planlane2:goodnight]), then the night look comes on and it rests (data-goodnight="rest") until his next touch or key.
 */
export function windDown(ms = WIND_DOWN_MS): Promise<'on' | 'already'> {
  const el = document.documentElement;
  woke?.();
  el.dataset.goodnight = 'down';
  return new Promise((done) => {
    setTimeout(() => {
      const look = nightLook();
      el.dataset.goodnight = 'rest';
      const wake = () => {
        if (el.dataset.goodnight === 'rest') delete el.dataset.goodnight;
        removeEventListener('pointerdown', wake, true);
        removeEventListener('keydown', wake, true);
        woke = null;
      };
      woke = wake;
      addEventListener('pointerdown', wake, true);
      addEventListener('keydown', wake, true);
      done(look);
    }, ms);
  });
}

// ---------------------------------------------------------------- the steps

/** THE HOUSE: every light that is on, off (one after another, the house read once after); the guarded set only listed, with LOCK UP. */
export async function houseStep(said = 'goodnight'): Promise<StepOut[]> {
  let v = await within(loadHouse(true));
  if (v && (!v.linked || v.error) && !v.stale) v = (await within(loadHouse(true))) ?? v;
  if (!v) return [{ line: lightsLine('out') }];
  if (!v.linked) return [{ line: lightsLine('unlinked'), go: [{ id: 'panel:links:HOME ASSISTANT', ask: -1, label: 'OPEN LINKS', open: 'links' }] }];
  if (v.error || v.stale) return [{ line: lightsLine('down') }];
  const all = v.entities;
  const guarded = all.filter((e) => isGuarded(e, v.marked, all));
  const lights = all.filter((e) => e.domain === 'light' && e.state === 'on' && !guarded.includes(e));
  const done: string[] = [];
  const failed: string[] = [];
  // all at once, each with its own limit: a slow box never holds the other lines past WAIT_MS
  const res = await Promise.all(lights.map((e) => within(act(e.id, 'turn_off', {}, { origin: 'chat', why: said, reload: false }))));
  lights.forEach((e, i) => (res[i]?.ok ? done : failed).push(e.name));
  if (lights.length) void loadHouse(true);
  const out: StepOut[] = [{ line: lightsLine('ok', done, failed) }];
  // the guarded set: locks, alarms, garage doors and gates (a switch he marked is not a light, so goodnight leaves it be)
  const locks = guarded.filter((e) => e.domain === 'lock' || e.domain === 'alarm_control_panel' || e.domain === 'cover');
  const open = locks.map(openGuard).filter((x) => x !== null);
  const line = lockLine(open, locks.length);
  if (line)
    out.push({
      line,
      go: open.filter((o) => o.service).map((o) => ({ id: 'phrase:house', ask: -1, label: lockKey(o), run: 'house_do', args: { entity: o.id, name: o.name, domain: o.domain, guarded: true, service: o.service, data: {}, said } })),
    });
  return out;
}

/** THE RADIO: playing (or tuning in), its sleep timer set for 30 minutes, unless one of his ends sooner. */
export function radioStep(min = SLEEP_MIN): StepOut {
  const p = player.get();
  const now = Date.now();
  if (!p.now || p.state === 'idle' || p.state === 'error') return { line: radioLine({ kind: 'nothing' }) };
  if (p.state === 'paused') return { line: radioLine({ kind: 'paused', name: p.now.name }) };
  const at = now + min * 60_000;
  if (p.sleepAt && p.sleepAt > now && p.sleepAt <= at) return { line: radioLine({ kind: 'sooner', name: p.now.name, at: p.sleepAt }) };
  setSleepAt(at, String(min));
  return { line: radioLine({ kind: 'set', name: p.now.name, at, min }) };
}

/** SLEEP: the body lane's GOING TO BED (its tracker keeps the time from now; "I'm up now" ends the night). Already going: said, kept. */
export async function sleepStep(): Promise<StepOut> {
  try {
    const t = await import('../body/track');
    const bed = t.load().set.bedAt;
    if (bed && Date.now() - bed < 16 * 3_600_000) return { line: sleepLine({ kind: 'already', since: bed }) };
    t.toBed();
    // kept on this phone? (storage full or off keeps it only in memory, and iOS ends a hidden app overnight)
    let kept = false;
    try {
      kept = !!(JSON.parse(localStorage.getItem('ghosty.body.track') ?? 'null') as { set?: { bedAt?: number } } | null)?.set?.bedAt;
    } catch {
      kept = false;
    }
    return { line: sleepLine({ kind: kept ? 'started' : 'unkept' }) };
  } catch {
    return { line: sleepLine({ kind: 'none' }) };
  }
}

/** THE DAY AHEAD: its first event from his diary (the brain's agenda, or the phone's copy of it when the brain is out of reach). */
export async function aheadStep(now = Date.now()): Promise<StepOut> {
  const was = offline.get().agenda;
  const r = await within(brain.agenda(2));
  // the brain gives the phone's copy when it is out of reach (api/offline.ts): the copy unchanged means it was that (as the agenda does)
  const copy = !!r && !!was && offline.get().agenda === was;
  const events: DayEvent[] | null = r ? r.events.map((e) => ({ title: e.title, start: e.start, allDay: !!e.allDay })) : null;
  return { line: aheadLine(events, now, { calendarsDown: !!r?.errors?.length, copy }), go: [{ id: 'agenda', ask: -1, label: 'OPEN THE AGENDA', open: 'agenda' }] };
}

/** The steps, in the order said: a routine engine can run any of them on its own. None sends or posts anything. */
export const GOODNIGHT_STEPS = [
  { id: 'house', run: (said?: string) => houseStep(said) },
  { id: 'radio', run: async () => [radioStep()] },
  { id: 'sleep', run: async () => [await sleepStep()] },
  { id: 'ahead', run: async () => [await aheadStep()] },
] as const;

/** Running now: a second "goodnight" while one is winding down is said, not run twice. */
let running = false;

/** GOODNIGHT from the chat (or the key): the wind-down, then each step's line in turn, in one reply with their keys. */
export async function goodnightTurn(said: string): Promise<PackReply> {
  /* state: core.goodnight loading */
  if (running) return { said, reply: 'I’m already winding everything down: the lines come in a moment.' };
  running = true;
  try {
    // the steps run while the screen settles; the lines are said once both are done
    const [look, ...steps] = await Promise.all([windDown(), ...GOODNIGHT_STEPS.map((s) => s.run(said).catch((): StepOut[] => []))]);
    const outs = steps.flat();
    const name = settings.get().name?.trim() ?? '';
    const lines = [openLine(name), ...outs.map((o) => o.line), closeLine(look)];
    const keys = outs.flatMap((o) => o.go ?? []);
    const go = [...keys.filter((k) => k.run === 'house_do'), ...keys.filter((k) => k.run !== 'house_do')];
    return { said, reply: lines.join('\n'), go };
  } finally {
    running = false;
  }
}
