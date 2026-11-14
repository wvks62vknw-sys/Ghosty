/**
 * ONE MAP OF EVERYTHING HE KNOWS (learn.u3): one picture of what he has learned across courses, reading, speaking and revision,
 * from what this phone already keeps (nothing new is sent or kept), with where he has grown and the one thing to try next.
 *  - COURSES: each course's mastery (lessons mastered of all), from its kept scores.
 *  - READING: books read to the end, and the ones he is part way through.
 *  - SPEAKING: one-minute talks charted (learn.u12): the change since his first week.
 *  - REVISION: worked-answer booklets (learn.u1) and the questions still being learned.
 *  - NEXT: the course lesson his misses point at (learn.u2), else the book he is furthest into, else a course to start.
 * Told from his own numbers, as what happened; never a forecast.
 */
import { aimOf } from '../../../../../packages/shared/src/learn';
import { clear, h } from '../../core/dom';
import { places } from '../../library/place';
import { booklets } from '../../school/booklet';
import { loadTalks, talkTrend, talkWeeks } from '../../further/rehearse';
import { learn } from './store';

export interface MapRow { area: string; value: number; line: string }
export const masteryState = { rows: [] as MapRow[], next: '' };

/** The map's rows and the next thing, pure apart from what this phone keeps. */
export function masteryMap(): { rows: MapRow[]; next: string } {
  const s = learn.get();
  const rows: MapRow[] = [];
  for (const c of s.courses) rows.push({ area: `COURSE · ${c.title}`, value: (c.mastery ?? 0) / 100, line: `${c.mastered ?? 0} of ${c.lessons} lessons mastered · ${c.done} read` });
  const ps = Object.values(places.get().map ?? {});
  const done = ps.filter((p) => p.done).length;
  const going = ps.filter((p) => !p.done && p.pct > 0.02);
  if (ps.length) rows.push({ area: 'READING', value: ps.length ? done / ps.length : 0, line: `${done} book${done === 1 ? '' : 's'} read to the end · ${going.length} part way` });
  const weeks = talkWeeks(loadTalks());
  if (weeks.length) {
    // (the bar: the share of his talks at a pace people follow easily, 110 to 160 words a minute)
    const ts = loadTalks();
    rows.push({ area: 'SPEAKING', value: ts.filter((t) => t.wpm >= 110 && t.wpm <= 160).length / Math.max(1, ts.length), line: talkTrend(weeks).replace(/^Since your first week: /, '') });
  }
  const bs = booklets.get().list;
  if (bs.length) {
    const items = bs.reduce((n, b) => n + b.items.length, 0);
    const learning = bs.reduce((n, b) => n + b.items.filter((x) => x.learning).length, 0);
    rows.push({ area: 'REVISION', value: items ? 1 - learning / items : 0, line: `${bs.length} worked-answer booklet${bs.length === 1 ? '' : 's'} · ${learning} question${learning === 1 ? '' : 's'} still being learned` });
  }
  // the next thing: the lesson his misses point at, else the book he is furthest into, else a course to start
  let next = '';
  for (const c of s.courses) {
    const full = s.full[c.id];
    if (!full) continue;
    const aim = aimOf(full, c.stats, c.next);
    if (aim.kind === 'misses') {
      next = `${c.title}: ${aim.why}`;
      break;
    }
  }
  if (!next && going.length) next = 'Carry on the book you are furthest into: open the Library and it opens at your place.';
  if (!next) next = s.courses.length ? 'Nothing missed lately: take the next lesson, or the exam in a course you have read.' : 'Start a course: say “teach me…” and I build one.';
  return { rows, next };
}

/** The map, drawn: a bar per area and the next thing. */
export function masteryPanelBody(box: HTMLElement): void {
  const m = masteryMap();
  masteryState.rows = m.rows;
  masteryState.next = m.next;
  if (!m.rows.length) return void clear(box, h('p.note', { dataset: { state: 'empty' } }, 'Nothing to map yet: a course, a book read, a talk in Rehearse or a studied paper each add a line here.'));
  clear(box,
    ...m.rows.map((r) => h('div.lmrow', { dataset: { area: r.area.split(' · ')[0]!.toLowerCase() } },
      h('span.lmhead', { dataset: { case: 'keep' } }, h('b', r.area.split(' · ')[1] ?? r.area.charAt(0) + r.area.slice(1).toLowerCase()), h('small', r.line)),
      h('span.lmbar', h('i', { style: `width:${Math.round(Math.max(0, Math.min(1, r.value)) * 100)}%` })))),
    h('p.lmnext', h('b', 'NEXT · '), m.next));
}
