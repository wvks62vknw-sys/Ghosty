/**
 * WATCH THE OFFLINE BRAIN IMPROVE (NEXT ROUND, polish3.u3): every finished week's test scores, kept on this phone as each report
 * arrives (the brain sends only this week's and last week's), drawn week by week for each area of the test and on average. Until
 * a week has really finished, it says the chart starts with the first one, never a sample.
 */
import { h } from '../../core/dom';
import { AREA_LABEL, EXAM_AREAS, examMean, type AreaScores, type ExamArea, type TrainReport } from '../../../../../packages/shared/src/selftrain';
import { row, spark } from '../../ui/components';

const KEY = 'ghosty.train.history';
const MAX_WEEKS = 26;

export interface WeekScores {
  week: number;
  at: number;
  after: AreaScores;
  kept: boolean;
}

export function weeksKept(): WeekScores[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as WeekScores[];
    return Array.isArray(v) ? v.filter((x) => x && Number.isFinite(x.week) && x.after) : [];
  } catch {
    return [];
  }
}

/** A finished report noted once (by its week and when it finished); the oldest go past half a year. */
export function noteWeek(r: TrainReport | null | undefined): WeekScores[] {
  const all = weeksKept();
  if (!r || !r.finishedAt || !Object.keys(r.after ?? {}).length) return all;
  if (all.some((x) => x.week === r.week && x.at === r.finishedAt)) return all;
  const next = [...all.filter((x) => x.week !== r.week), { week: r.week, at: r.finishedAt, after: r.after, kept: !!r.gate?.pass }].sort((a, b) => a.week - b.week).slice(-MAX_WEEKS);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* not kept: the chart shows what it had */
  }
  return next;
}

const pct = (n: number | undefined) => (typeof n === 'number' ? `${Math.round(n * 100)}%` : '–');

/** One line for a series: where it is now and how it moved since the first week kept. Pure. */
export function moveLine(values: number[]): string {
  if (!values.length) return '';
  const last = values[values.length - 1]!;
  if (values.length < 2) return `${pct(last)} in its first week`;
  const d = Math.round((last - values[0]!) * 100);
  return `${pct(last)} now, ${d > 0 ? `up ${d}` : d < 0 ? `down ${-d}` : 'no change'} since the first week`;
}

/** The chart: an average line and one per area, each a little line week by week. */
export function historyBlock(weeks: WeekScores[]): HTMLElement {
  const box = h('div.trainhist', h('div.lab', 'WEEK BY WEEK'));
  if (!weeks.length) {
    box.append(h('div.note.small', { dataset: { case: 'keep' } }, 'No week has finished yet, so the chart starts with the first one.'));
    return box;
  }
  const line = (k: string, values: number[], cls = '') => {
    const r = row(k, h('span.thv', spark(values, 120, 22), h('small', moveLine(values))), null, { wrap: true });
    r.classList.add('throw');
    if (cls) r.classList.add(cls);
    return r;
  };
  box.append(line('AVERAGE', weeks.map((w) => examMean(w.after)), 'thavg'));
  for (const a of EXAM_AREAS as readonly ExamArea[]) {
    const values = weeks.map((w) => w.after[a]).filter((x): x is number => typeof x === 'number');
    if (values.length) box.append(line(AREA_LABEL[a], values));
  }
  box.append(h('div.note.small', { dataset: { case: 'keep' } }, `${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'} kept on this phone, each the new brain’s test score.`));
  return box;
}
