/**
 * The weekly training in plain words (pure): what the brain's log of runs and rollbacks says about the last REAL run (one
 * that reached the test of the new brain), its report card, what became of it (published, not kept, stopped, rolled back),
 * when the next is due, and the pre-flight's last answer. The card in SYSTEM → OFFLINE BRAIN TRAINING draws these lines.
 */
import { AREA_LABEL, EXAM_AREAS, examMean, RUN_NOW_WILL, type ExamArea, type Preflight, type TrainEvent, type TrainReport, type WeeklyView } from '../../../../packages/shared/src/selftrain';

const TZ = 'Europe/London';
/** "Fri 13 Nov, 09:30" in UK time. */
export const ukWhen = (t: number): string => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(t);
const pct = (x: number): string => `${Math.round(x * 100)}%`;
const pts = (x: number): string => (Math.abs(x) < 0.0005 ? '±0' : `${x > 0 ? '+' : '-'}${Math.round(Math.abs(x) * 100)}`);

/** The log line for a run that ended: a REAL one reached its test (it has scores for the new brain). */
export function runEvent(r: TrainReport, now: number): TrainEvent {
  const real = EXAM_AREAS.some((a) => typeof r.after?.[a] === 'number') && EXAM_AREAS.some((a) => typeof r.before?.[a] === 'number');
  const published = !!(r.gate?.pass && r.published);
  const areas = real ? EXAM_AREAS.filter((a) => typeof r.before[a] === 'number' && typeof r.after[a] === 'number').map((a) => ({ area: a, before: r.before[a]!, after: r.after[a]! })) : [];
  return {
    at: now,
    kind: 'run',
    week: r.week,
    real,
    ...(real ? { before: examMean(r.before), after: examMean(r.after), areas } : {}),
    outcome: published ? 'published' : real && !r.error ? 'not-kept' : 'stopped',
    ...(published ? { commit: r.published!.commit } : {}),
    why: real ? String(r.gate?.why ?? r.error ?? '').slice(0, 240) : String(r.error ?? r.gate?.why ?? 'the run did not finish').slice(0, 240),
  };
}

/** The log with an event added (newest first, twenty kept). */
export const addEvent = (log: TrainEvent[], e: TrainEvent): TrainEvent[] => [e, ...log].slice(0, 20);

const REASON: Record<NonNullable<TrainEvent['reason']>, string> = { worse: 'it turned out worse', broken: 'it would not load on the phone', chosen: 'you chose to' };

export function weeklyView(o: { log: TrainEvent[]; now: number; phase: string; nextRun: number; note: string; keysOk: boolean; preflight: Preflight | null }): WeeklyView {
  const run = o.log.find((e) => e.kind === 'run' && e.real);
  const gone = run?.commit ? o.log.find((e) => e.kind === 'rollback' && e.commit === run.commit && e.at >= run.at) : undefined;
  const last: WeeklyView['last'] = run ? { ...run, outcome: gone ? 'rolled-back' : run.outcome!, ...(gone ? { rolledBack: { at: gone.at, reason: gone.reason ?? 'chosen' } } : {}) } : null;
  const tried = o.log.find((e) => e.kind === 'run' && !e.real);

  let lastLine: string;
  let card: string;
  let happened: string;
  if (last) {
    lastLine = `Week ${last.week}, finished ${ukWhen(last.at)}.`;
    const areas = [...(last.areas ?? [])].map((a) => ({ ...a, d: a.after - a.before })).sort((x, y) => y.d - x.d);
    const best = areas[0];
    const worst = areas.length > 1 ? areas[areas.length - 1] : undefined;
    card = `The old brain scored ${pct(last.before ?? 0)} and the new one ${pct(last.after ?? 0)} on the same questions${best ? `. Best: ${AREA_LABEL[best.area as ExamArea].toLowerCase()} ${pts(best.d)}` : ''}${worst ? `. Worst: ${AREA_LABEL[worst.area as ExamArea].toLowerCase()} ${pts(worst.d)}` : ''}.`;
    happened =
      last.outcome === 'published' ? `Published: the new brain beat the old one (${last.why}) and is offered to your phone.`
      : last.outcome === 'rolled-back' ? `Published, then rolled back on ${ukWhen(last.rolledBack!.at)} (${REASON[last.rolledBack!.reason as keyof typeof REASON] ?? 'you chose to'}). The brain before it is in use.`
      : last.outcome === 'not-kept' ? `Not published: ${last.why}. Nothing changed on your phone.`
      : `Stopped before the end: ${last.why}. Nothing changed on your phone.`;
  } else {
    lastLine = 'No real run has finished yet.';
    card = 'There is no report card yet: it appears when the first run has trained and tested a new brain.';
    happened = tried ? `The last try (week ${tried.week}, ${ukWhen(tried.at)}) stopped before its test: ${tried.why}. Nothing changed on your phone.` : 'Nothing has been published.';
  }

  let next: string;
  let dueAt: number | null = null;
  if (!o.keysOk) next = 'Waiting for the Kaggle and Hugging Face keys (SYSTEM → KEYS).';
  else if (o.phase !== 'idle') next = `A run is under way: ${o.note}`;
  else if (o.nextRun > o.now) {
    dueAt = o.nextRun;
    next = `The next run is due ${ukWhen(o.nextRun)}; it starts by itself.`;
  } else {
    dueAt = o.now;
    next = 'A run is due now: it starts at the next check (within the hour), or press RUN NOW.';
  }

  const pf = o.preflight;
  const preflight = !pf ? 'Not checked yet: CHECK FIRST asks Kaggle and Hugging Face and starts nothing.'
    : pf.ok ? `Checked ${ukWhen(pf.at)}: all clear.`
    : `Checked ${ukWhen(pf.at)}: stopped at "${pf.steps.find((s) => s.id === pf.stoppedAt)?.label ?? pf.stoppedAt}". ${pf.steps.find((s) => s.id === pf.stoppedAt)?.say ?? ''}`;

  return { last, lines: { last: lastLine, card, happened, next, preflight }, dueAt, preflight: pf, willDo: RUN_NOW_WILL };
}
