/**
 * SIX-WEEK PLANS THAT STEP UP (NEXT ROUND, BODY AND KITCHEN lane, body.u7), kept on this phone only (`ghosty.body.plans`):
 * squats, push-ups or running, three sessions a week for six weeks. Each session has a target; when he hits it the next one
 * steps up, and when he doesn't it stays where it is (never a telling-off). A session counts as hit by his tap, or by itself
 * from what he already logged that day: a gym-log set of that many (./more.ts) or a kept run that long (./runs.ts).
 * Every target is a rough guide, never medical advice.
 */
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { emptyState, phrases, stateLine } from '../lifeui';
import { dayOf } from './trackcore';

export type PlanKind = 'squats' | 'pushups' | 'run';
export const PLAN_KINDS: { id: PlanKind; label: string; start: number; step: number; top: number; unit: string }[] = [
  { id: 'squats', label: 'Squats', start: 10, step: 2, top: 40, unit: 'squats a set, 3 sets' },
  { id: 'pushups', label: 'Push-ups', start: 5, step: 1, top: 25, unit: 'push-ups a set, 3 sets' },
  { id: 'run', label: 'Running', start: 10, step: 2, top: 30, unit: 'minutes running' },
];
interface Session {
  d: string;
  target: number;
  hit: boolean;
}
interface PlanData {
  v: 1;
  kind: PlanKind | null;
  started: string;
  sessions: Session[];
}
const KEY = 'ghosty.body.plans';
let cache: PlanData | null = null;
let failed = '';
const now = (): number => Date.now() + ((window as unknown as { __ghostyClockOffset?: number }).__ghostyClockOffset ?? 0);
const listeners = new Set<() => void>();
export function loadPlan(): PlanData {
  if (cache) return cache;
  let raw: Partial<PlanData> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    raw = {};
  }
  cache = {
    v: 1,
    kind: PLAN_KINDS.some((k) => k.id === raw.kind) ? (raw.kind as PlanKind) : null,
    started: /^\d{4}-\d{2}-\d{2}$/.test(String(raw.started)) ? String(raw.started) : '',
    sessions: (Array.isArray(raw.sessions) ? raw.sessions : []).filter((s) => s && /^\d{4}-\d{2}-\d{2}$/.test(String(s.d)) && Number.isFinite(s.target)).slice(0, 18),
  };
  return cache;
}
function save(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadPlan()));
    failed = '';
  } catch {
    failed = 'I couldn’t keep that on this phone: its storage is full or switched off.';
  }
  for (const f of listeners) f();
  return !failed;
}
const kindOf = (id: PlanKind) => PLAN_KINDS.find((k) => k.id === id)!;
/** The next session's target: up a step after a hit, the same after a miss, never past the plan's top. */
export function nextTarget(p: PlanData): number {
  const k = kindOf(p.kind!);
  const last = p.sessions[p.sessions.length - 1];
  if (!last) return k.start;
  return Math.min(k.top, last.hit ? last.target + k.step : last.target);
}
export function startPlan(kind: PlanKind): string {
  const p = loadPlan();
  p.kind = kind;
  p.started = dayOf(now());
  p.sessions = [];
  const k = kindOf(kind);
  return save() ? `${k.label}: six weeks, three sessions a week. The first target: ${k.start} ${k.unit}. It steps up each time you hit it.` : failed;
}
/** Today's session ticked hit or missed. */
export function logSession(hit: boolean): string {
  const p = loadPlan();
  if (!p.kind) return 'No plan running. Pick squats, push-ups or running first.';
  const d = dayOf(now());
  const target = nextTarget({ ...p, sessions: p.sessions.filter((s) => s.d !== d) });
  p.sessions = [...p.sessions.filter((s) => s.d !== d), { d, target, hit }];
  if (!save()) return failed;
  const k = kindOf(p.kind);
  const done = p.sessions.length;
  if (done >= 18) return `Session 18 of 18 ${hit ? 'hit' : 'kept'}: that’s the six weeks done.`;
  return hit ? `Hit: ${target} ${k.unit}. Next time: ${nextTarget(p)}. Session ${done} of 18.` : `Kept as not quite: next time stays at ${target}. Session ${done} of 18.`;
}
/** What he already logged today that hits the target by itself: a gym set or a kept run. */
async function loggedToday(p: PlanData, target: number): Promise<boolean> {
  const d = dayOf(now());
  try {
    if (p.kind === 'run') {
      const { loadRuns } = await import('./runs');
      return loadRuns().some((r) => dayOf(r.at) === d && r.secs >= target * 60);
    }
    const ex = p.kind === 'squats' ? /^squat/i : /^push/i;
    const raw = JSON.parse(localStorage.getItem('ghosty.body.gym') ?? '{}') as { log?: { d: string; ex: string; reps: number }[] };
    return (raw.log ?? []).filter((s) => s.d === d && ex.test(s.ex) && s.reps >= target).length >= 3;
  } catch {
    return false;
  }
}

export function plansScreen(): { el: HTMLElement; stop(): void } {
  const el = h('div.pkcol.bt', { dataset: { track: 'plans' } });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const say = (w: string) => (status.textContent = w);
  const draw = () => {
    const p = loadPlan();
    const kids: HTMLElement[] = [];
    if (failed) {
      /* state: body.plans error */
      kids.push(stateLine('error', failed));
    }
    if (!p.kind) {
      /* state: body.plans empty */
      kids.push(emptyState('No plan running', 'Pick one: three sessions a week for six weeks, the target stepping up each time you hit it.'));
      kids.push(h('div.pkrow', ...PLAN_KINDS.map((k) => {
        const b = button(k.label, () => say(startPlan(k.id)), 'on');
        b.setAttribute('aria-label', `Start the six-week ${k.label.toLowerCase()} plan`);
        return b;
      })));
    } else {
      const k = kindOf(p.kind);
      const d = dayOf(now());
      const today = p.sessions.find((s) => s.d === d);
      const target = today?.target ?? nextTarget(p);
      const done = p.sessions.length;
      const hits = p.sessions.filter((s) => s.hit).length;
      kids.push(h('p.bc-score', { dataset: { plan: p.kind, target: String(target) } }, h('b', String(target)), h('span', `${k.unit}${today ? `: today’s, ${today.hit ? 'hit' : 'not quite'}` : ': your next session'}.`)));
      kids.push(h('p.pknote', { dataset: { sessions: `${done}/${hits}` } }, `${k.label}, week ${Math.min(6, Math.floor(done / 3) + 1)} of 6: ${done} of 18 sessions, ${hits} hit.`));
      const hit = button('Hit it', () => say(logSession(true)), 'on');
      hit.setAttribute('aria-label', `Today's session: hit ${target}`);
      const miss = button('Not quite', () => say(logSession(false)));
      miss.setAttribute('aria-label', 'Today’s session: not quite');
      kids.push(h('div.pkrow', hit, miss));
      kids.push(h('div.pkrow', ...p.sessions.slice(-9).map((s) => h('small.bp-dot', { dataset: { hit: s.hit ? '1' : '0' } }, `${s.target}${s.hit ? ' ✓' : ''}`))));
      const stopB = button('Stop the plan', () => {
        p.kind = null;
        p.sessions = [];
        save();
        say('Plan stopped. Pick another whenever you like.');
      });
      kids.push(h('div.pkrow', stopB));
      if (!today) void loggedToday(p, target).then((yes) => yes && !loadPlan().sessions.some((s) => s.d === d) && say(logSession(true)));
    }
    kids.push(status, phrases(['start a squat plan', 'I hit my plan today']), h('p.pknote', 'Kept on this phone only. A rough guide that steps up as you go, never medical advice: stop if anything hurts.'));
    el.replaceChildren(...kids);
  };
  listeners.add(draw);
  draw();
  return { el, stop: () => void listeners.delete(draw) };
}
