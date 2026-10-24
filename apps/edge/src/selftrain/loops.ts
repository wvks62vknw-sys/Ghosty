/**
 * GYM ideas on the brain: the training records the phone's checked work makes (part 3), and the numbers of the
 * brain's own loops for the REPORT CARD's LOOPS card (part 4).
 *
 * Part 3: POST /api/training/star brings `star` records — THINK HARDER's working for a question an exact check
 * passed, or a GYM puzzle the GYM's own checker passed (apps/web/src/offline/star.ts). Each is checked again
 * (`recordProblem`: a star record without the check that passed it is refused), at most STAR_DAY are taken a day,
 * and they wait (at most STAR_WAITING) for the next week's gathering, which puts them in that week's data after
 * the same near-exam filter as everything else (cycle.ts FREE_PARTS).
 *
 * Part 4: GET /api/training/loops gives this week's numbers per loop: drills, self-study, SCHOOL practice, the
 * weekly run, the voice and the star records. The study counters are cumulative, so a point a day is kept
 * (`loops:days`, the last LOOP_DAYS) and "this week" is today's counts less the ones from a week ago (or from
 * the first day kept, if that is later: the card then says from when).
 */
import type { BrainLoops } from '../../../../packages/shared/src/loops';
import { examMean, recordProblem, type TrainRecord, type TrainStatus } from '../../../../packages/shared/src/selftrain';
import { loadStudy } from '../library/study';
import { loadState as loadSchool } from '../school/state';
import { practiceView } from '../school/practice';

/** Star records taken a day (the phone keeps to the same number). */
export const STAR_DAY = 20;
/** At most this many wait for the next week (the oldest go). */
export const STAR_WAITING = 200;
const DAY = 86_400_000;
const WEEK = 7 * DAY;
const LOOP_DAYS = 15;

const K = { star: 'loops:star', days: 'loops:days' };

interface StarStore {
  day: string;
  today: number;
  list: TrainRecord[];
  /** Taken (day by day) and turned away (with why), for the LOOPS card. */
  taken: { at: number; n: number }[];
  refused: { at: number; why: string; n: number }[];
}

const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const fresh = (): StarStore => ({ day: '', today: 0, list: [], taken: [], refused: [] });

async function loadStars(s: DurableObjectStorage): Promise<StarStore> {
  return { ...fresh(), ...((await s.get<StarStore>(K.star)) ?? {}) };
}

/** Take the phone's star records: each checked again, today's cap kept; returns how many were kept and why the rest were not. */
export async function takeStars(s: DurableObjectStorage, records: unknown, now = Date.now()): Promise<{ kept: number; refused: { why: string; n: number }[]; waiting: number }> {
  const st = await loadStars(s);
  if (st.day !== dayOf(now)) Object.assign(st, { day: dayOf(now), today: 0 });
  const why = new Map<string, number>();
  const no = (w: string) => why.set(w, (why.get(w) ?? 0) + 1);
  let kept = 0;
  const seen = new Set(st.list.map((r) => r.messages?.[0]?.content ?? ''));
  for (const r of Array.isArray(records) ? records.slice(0, 100) : []) {
    const p = recordProblem(r);
    if (p) no(p);
    else if ((r as TrainRecord).kind !== 'star') no('only star records come this way');
    else if (st.today >= STAR_DAY) no(`over the day's ${STAR_DAY}`);
    else if (seen.has((r as TrainRecord).messages![0]!.content)) no('already waiting');
    else {
      const rec = r as TrainRecord;
      // Only what a record is: nothing else the phone sent comes along.
      st.list.push({ kind: 'star', messages: rec.messages!.map((m) => ({ role: m.role, content: m.content })), checked: String(rec.checked).slice(0, 300), ...(typeof rec.from === 'string' ? { from: rec.from.slice(0, 80) } : {}) });
      seen.add(rec.messages![0]!.content);
      st.today++;
      kept++;
    }
  }
  st.list = st.list.slice(-STAR_WAITING);
  if (kept) st.taken = [...st.taken, { at: now, n: kept }].slice(-60);
  const refused = [...why].map(([w, n]) => ({ why: w, n }));
  if (refused.length) st.refused = [...st.refused, ...refused.map((x) => ({ at: now, ...x }))].slice(-60);
  await s.put(K.star, st);
  return { kept, refused, waiting: st.list.length };
}

/** The star records waiting, handed to the week's gathering (and so no longer waiting). */
export async function drainStars(s: DurableObjectStorage): Promise<TrainRecord[]> {
  const st = await loadStars(s);
  if (!st.list.length) return [];
  const out = st.list;
  st.list = [];
  await s.put(K.star, st);
  return out;
}

interface DayCounts {
  d: string;
  at: number;
  drills: number;
  right: number;
  reads: number;
  digests: number;
  failed: number;
}

/**
 * The day's point of the cumulative counters (the first reading of each day stays that day's), kept LOOP_DAYS;
 * called by the hourly training job (cycle.ts trainTick) and the LOOPS route. Returns today's counts and the points.
 */
export async function noteDays(s: DurableObjectStorage, now = Date.now()): Promise<{ today: DayCounts; days: DayCounts[]; study: Awaited<ReturnType<typeof loadStudy>> }> {
  const study = await loadStudy(s);
  const doms = Object.values(study.domains ?? {});
  const today: DayCounts = {
    d: dayOf(now),
    at: now,
    drills: study.drills ?? 0,
    right: study.right ?? 0,
    reads: doms.reduce((t, x) => t + (x.read ?? 0), 0),
    digests: doms.reduce((t, x) => t + (x.digested ?? 0), 0),
    failed: doms.reduce((t, x) => t + (x.failed ?? 0), 0),
  };
  const prev = (await s.get<DayCounts[]>(K.days)) ?? [];
  if (prev.at(-1)?.d === today.d) return { today, days: prev, study };
  const days = [...prev, today].slice(-LOOP_DAYS);
  await s.put(K.days, days);
  return { today, days, study };
}

/** This week's numbers for every loop the brain runs (see the top of this file). */
export async function brainLoops(s: DurableObjectStorage, status: TrainStatus | null, now = Date.now()): Promise<BrainLoops> {
  const { today, days, study } = await noteDays(s, now);
  // A week ago: the last point at or before then, else the first point kept ("since" says which).
  const base = [...days].reverse().find((x) => x.at <= now - WEEK) ?? days[0]!;
  const since = Math.max(base.at, now - WEEK);

  const school = await loadSchool({ storage: s }).catch(() => null);
  const view = school ? await practiceView(s, school.stage, now).catch(() => null) : null;
  const papers = (school?.results ?? []).filter((r) => r.at >= since && r.max > 0);
  const earlier = (school?.results ?? []).find((r) => r.at < since && r.max > 0);
  const nearSchool = status?.report?.rejected?.find((x) => /school practice too close/.test(x.why))?.n ?? 0;

  const r = status?.report ?? null;
  const voiceRejected = (r?.rejected ?? []).filter((x) => /^voice:/.test(x.why)).map((x) => ({ why: x.why.replace(/^voice:\s*/, ''), n: x.n }));
  const stars = await loadStars(s);
  const models = status?.models ?? [];

  return {
    now,
    since,
    drills: { asked: today.drills - base.drills, right: today.right - base.right, before: { asked: base.drills, right: base.right } },
    study: {
      reads: today.reads - base.reads,
      digests: today.digests - base.digests,
      finished: Object.entries(study.finished ?? {})
        .filter(([, at]) => at >= since)
        .map(([id]) => id),
      failed: today.failed - base.failed,
    },
    school: school && (school.results.length || view) ? { checked: view?.checked ?? 0, waiting: status?.school?.practice ?? 0, papers: papers.map((p) => ({ title: p.title, pct: p.raw / p.max, at: p.at })), previous: earlier ? earlier.raw / earlier.max : null, near: nearSchool } : null,
    week: status
      ? {
          week: r?.week ?? status.week,
          phase: status.phase,
          at: r?.finishedAt ?? null,
          trained: r?.trained ?? {},
          before: r && Object.keys(r.before ?? {}).length ? examMean(r.before) : null,
          after: r && Object.keys(r.after ?? {}).length ? examMean(r.after) : null,
          kept: r ? r.gate.pass : null,
          why: r?.gate.why ?? '',
          rejected: (r?.rejected ?? []).filter((x) => !/^voice:/.test(x.why)),
          active: status.active,
          activeLabel: models.find((m) => m.commit === status.active)?.label ?? 'the stock Qwen3',
        }
      : null,
    voice: r ? { trained: r.trained?.voice ?? 0, before: r.before?.voice ?? null, after: r.after?.voice ?? null, rejected: voiceRejected } : null,
    star: {
      taken: stars.taken.filter((x) => x.at >= since).reduce((t, x) => t + x.n, 0),
      waiting: stars.list.length,
      refused: [...stars.refused.filter((x) => x.at >= since).reduce((m, x) => m.set(x.why, (m.get(x.why) ?? 0) + x.n), new Map<string, number>())].map(([why, n]) => ({ why, n })),
    },
  };
}
