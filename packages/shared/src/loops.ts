/**
 * The REPORT CARD's LOOPS card (GYM ideas, part 4): every way Ghosty practises by himself, on one card — what
 * each loop practised this week, what improved (the real numbers, before → after), what was rejected and why,
 * and ROLLBACK where there is one (the weekly brain). Pure: the brain gathers its loops' numbers
 * (apps/edge/src/selftrain/loops.ts, GET /api/training/loops), the phone adds its own (the GYM's records, the
 * training records THINK HARDER and the GYM sent), and `loopRows` writes the card in plain words. A number
 * that was not measured is never filled in: the row says "not measured yet" instead.
 */

/** The brain's loops this week (since `since`). */
export interface BrainLoops {
  now: number;
  /** Where "this week" starts: a week ago, or the first day the counts were kept (if later). */
  since: number;
  /** Drills Ghosty sets himself (library/drills.ts): this week's, and all before it. */
  drills: { asked: number; right: number; before: { asked: number; right: number } };
  /** Self-study (library/study.ts): pieces read, notes written, fields finished, reads that failed. */
  study: { reads: number; digests: number; finished: string[]; failed: number };
  /** SCHOOL practice for his weak spots: items checked this week, waiting for the next run; papers sat this week. */
  school: { checked: number; waiting: number; papers: { title: string; pct: number; at: number }[]; previous: number | null; near: number } | null;
  /** The weekly run (selftrain): its latest report. */
  week: {
    week: number;
    phase: string;
    at: number | null;
    trained: Record<string, number>;
    before: number | null;
    after: number | null;
    kept: boolean | null;
    why: string;
    rejected: { why: string; n: number }[];
    /** The brain in use (null: the stock one) and whether ROLLBACK can go back. */
    active: string | null;
    activeLabel: string;
  } | null;
  /** The voice (its own part of the weekly run). */
  voice: { trained: number; before: number | null; after: number | null; rejected: { why: string; n: number }[] } | null;
  /** Training records from checked work (THINK HARDER and the GYM): taken this week, waiting, turned away. */
  star: { taken: number; waiting: number; refused: { why: string; n: number }[] };
}

/** The phone's loops this week. */
export interface PhoneLoops {
  gym: {
    /** Per game trained this week: units, levels passed, the league (rating then → now, versions kept / thrown away), edge tries. */
    games: { id: string; name: string; units: number; levels: number; rating?: [number, number]; kept: number; thrown: { level: number; why: string }[]; tries: number; solved: number }[];
  };
  /** Records THINK HARDER and the GYM handed to the brain this week, still waiting on the phone, turned away (the day's cap). */
  star: { think: number; gym: number; waiting: number; over: number };
}

export type LoopId = 'gym' | 'drills' | 'school' | 'study' | 'week' | 'voice' | 'star';

export interface LoopRow {
  id: LoopId;
  name: string;
  practised: string;
  improved: string;
  rejected: string;
  /** ROLLBACK goes back one brain (the weekly brain, when one is in use). */
  rollback?: boolean;
}

const n = (x: number) => Math.round(x).toLocaleString('en-GB');
const pc = (x: number) => `${Math.round(x * 100)}%`;
const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`;
const sum = (xs: { n: number }[]) => xs.reduce((t, x) => t + x.n, 0);
const whys = (xs: { why: string; n: number }[], max = 3) =>
  xs
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, max)
    .map((x) => `${n(x.n)} ${x.why}`)
    .join('; ');

/** The card's rows, one per loop, in a fixed order. */
export function loopRows(b: BrainLoops | null, p: PhoneLoops): LoopRow[] {
  const rows: LoopRow[] = [];
  const NOT = 'not measured yet';

  // ---- the GYM (on this phone)
  const games = p.gym.games.filter((g) => g.units > 0 || g.levels > 0 || g.tries > 0 || g.kept + g.thrown.length > 0);
  const units = games.reduce((t, g) => t + g.units, 0);
  const levels = games.reduce((t, g) => t + g.levels, 0);
  const rated = games.filter((g) => g.rating && g.rating[1] !== g.rating[0]);
  const tries = games.reduce((t, g) => t + g.tries, 0);
  const solved = games.reduce((t, g) => t + g.solved, 0);
  const thrown = games.flatMap((g) => g.thrown.map((t) => ({ ...t, name: g.name })));
  rows.push({
    id: 'gym',
    name: 'GYM',
    practised: games.length ? `${plural(units, 'round')} of practice in ${plural(games.length, 'game')}${tries ? `; ${plural(tries, 'puzzle')} he made at his edge` : ''}` : 'nothing this week',
    improved: games.length
      ? [levels ? `${plural(levels, 'level')} passed (checked against ground truth)` : 'no level passed', ...rated.map((g) => `${g.name} rating ${n(g.rating![0])} → ${n(g.rating![1])}`), tries ? `solved ${n(solved)} of ${n(tries)} at his edge` : ''].filter(Boolean).join('; ')
      : NOT,
    rejected: thrown.length ? thrown.map((t) => `${t.name} level ${t.level}'s version thrown away: ${t.why}`).join('; ') : 'nothing thrown away',
  });

  // ---- the brain's loops
  if (!b) {
    for (const [id, name] of [['drills', 'DRILLS'], ['school', 'SCHOOL PRACTICE'], ['study', 'SELF-STUDY'], ['week', 'THE WEEKLY RUN'], ['voice', 'THE VOICE']] as [LoopId, string][])
      rows.push({ id, name, practised: 'the brain is not reachable', improved: NOT, rejected: '—' });
  } else {
    const d = b.drills;
    const now = d.asked ? d.right / d.asked : null;
    const before = d.before.asked ? d.before.right / d.before.asked : null;
    rows.push({
      id: 'drills',
      name: 'DRILLS',
      practised: d.asked ? `${plural(d.asked, 'drill')} he set himself (${n(d.right)} right)` : 'no drills this week',
      improved: now == null ? NOT : before == null ? `${pc(now)} right this week (nothing earlier to compare)` : `${pc(before)} right before → ${pc(now)} this week`,
      rejected: d.asked - d.right > 0 ? `${plural(d.asked - d.right, 'answer')} marked wrong by the checker` : 'none marked wrong',
    });
    const s = b.school;
    rows.push({
      id: 'school',
      name: 'SCHOOL PRACTICE',
      practised: s ? `${plural(s.checked, 'practice item')} checked this week; ${n(s.waiting)} waiting for the next run${s.papers.length ? `; ${plural(s.papers.length, 'paper')} sat` : ''}` : 'no school yet',
      improved: s?.papers.length ? `${s.previous != null ? `${pc(s.previous)} before → ` : ''}${s.papers.map((x) => `${x.title} ${pc(x.pct)}`).join(', ')}` : NOT,
      rejected: s?.near ? `${plural(s.near, 'item')} too close to a question on a paper` : 'nothing rejected',
    });
    const st = b.study;
    rows.push({
      id: 'study',
      name: 'SELF-STUDY',
      practised: st.reads + st.digests ? `${plural(st.reads, 'piece')} read, ${plural(st.digests, 'note')} written` : 'nothing read this week',
      improved: st.finished.length ? `finished ${st.finished.join(', ')}` : 'no field finished this week',
      rejected: st.failed ? `${plural(st.failed, 'read')} failed` : 'none failed',
    });
    const w = b.week;
    const kept = (w?.trained ?? {}) as Record<string, number>;
    const total = Object.values(kept).reduce((t, x) => t + x, 0);
    rows.push({
      id: 'week',
      name: 'THE WEEKLY RUN',
      practised: w?.at ? `week ${w.week}: ${plural(total, 'example')} trained on` : w ? `week ${w.week}: ${w.phase === 'idle' ? 'no run finished yet' : `${w.phase} now`}` : 'no run yet',
      improved: w?.before != null && w.after != null ? `test ${pc(w.before)} → ${pc(w.after)}: ${w.kept ? 'KEPT' : 'NOT KEPT'}` : NOT,
      rejected: [w && w.kept === false ? `the new brain: ${w.why}` : '', w ? whys(w.rejected) : ''].filter(Boolean).join('; ') || 'nothing rejected',
      rollback: !!w?.active,
    });
    const v = b.voice;
    rows.push({
      id: 'voice',
      name: 'THE VOICE',
      practised: v?.trained ? `${plural(v.trained, 'reply', 'replies')} rewritten or written to sound like a person` : 'nothing this week',
      improved: v?.before != null && v.after != null ? `sounds like a person ${pc(v.before)} → ${pc(v.after)}` : NOT,
      rejected: v && sum(v.rejected) ? whys(v.rejected) : 'nothing rejected',
    });
  }

  // ---- the search teaches the brain: checked work into training records
  const sent = p.star.think + p.star.gym;
  rows.push({
    id: 'star',
    name: 'LESSONS FROM CHECKED WORK',
    practised: sent || p.star.waiting ? `${plural(sent, 'record')} sent (${n(p.star.think)} from THINK HARDER, ${n(p.star.gym)} from the GYM)${p.star.waiting ? `; ${n(p.star.waiting)} waiting on this phone` : ''}` : 'none this week',
    improved: b ? `${plural(b.star.taken, 'record')} taken for the next week's run${b.star.waiting ? ` (${n(b.star.waiting)} waiting)` : ''}` : NOT,
    rejected: [p.star.over ? `${plural(p.star.over, 'record')} over today's cap` : '', b ? whys(b.star.refused) : ''].filter(Boolean).join('; ') || 'only checked answers are kept: nothing turned away',
  });
  return rows;
}
