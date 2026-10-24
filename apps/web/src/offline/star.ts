/**
 * The search teaches the brain (GYM ideas, part 3). When THINK HARDER's search reaches an answer that an exact
 * check passed, the question and the working that got there become a `star` training record, so a later
 * week's brain learns to get there without the search; and when the GYM's learner solves a puzzle at the edge
 * of what he can do (gym/stretch.ts), the puzzle, his moves and the checker's verdict do the same. Only checked
 * work: an answer the check did not pass, or a chain judged only by votes, never becomes a record. At most
 * STAR_PER_DAY a day; the records wait on the phone and go to the brain (POST /api/training/star), which checks
 * each again (`recordProblem`), keeps to the same daily cap and puts them in the next week's data.
 *
 * Pure: the builders, and the waiting box as a value (offline/starbox.ts keeps it and sends it).
 */
import type { ChatMsg } from '../../../../packages/shared/src/selftrain';

/** Records a day, THINK HARDER and the GYM together (the brain keeps to the same number). */
export const STAR_PER_DAY = 20;
/** At most this many wait on the phone (the oldest go). */
export const STAR_QUEUE = 60;
/** The weekly run's own words after a GYM puzzle (gym/tasks.ts ANSWER_HINT; the tests hold them equal). */
export const GYM_HINT = 'Think it through briefly, then give only the final answer on the last line.';

/** One training record of kind `star` (packages/shared/src/selftrain.ts TrainRecord). */
export interface StarRecord {
  kind: 'star';
  messages: ChatMsg[];
  /** The exact check that passed it ("a calculator", "the GYM's rules: …"). */
  checked: string;
  /** Where it came from: "think harder", "gym maze level 7½". */
  from: string;
}

interface ThinkLike {
  confidence: string;
  text: string;
  checkedBy?: string;
  attempts: { text: string; check?: { correct: boolean } | null }[];
}

/** THINK HARDER's answer as a record: only when the attempt it gives passed an exact check. */
export function starFromThink(question: string, r: ThinkLike): StarRecord | null {
  const q = question.trim();
  const text = r.text.trim();
  if (!q || !text || r.confidence !== 'checked' || !r.checkedBy) return null;
  // The working itself must be an attempt the check passed (never a voted or unchecked one).
  if (!r.attempts.some((a) => a.text.trim() === text && a.check?.correct === true)) return null;
  return { kind: 'star', messages: [{ role: 'user', content: q.slice(0, 4000) }, { role: 'assistant', content: text.slice(0, 6000) }], checked: r.checkedBy, from: 'think harder' };
}

/** A GYM puzzle he solved as a record: the puzzle, his moves as the answer, and the checker's verdict (only a pass). */
export function starFromGym(problem: { game: string; text: string }, answer: string, verdict: { correct: boolean; why: string }, level: string): StarRecord | null {
  const a = answer.trim();
  if (!verdict.correct || !a || !problem.text.trim()) return null;
  return { kind: 'star', messages: [{ role: 'user', content: `${problem.text}\n\n${GYM_HINT}` }, { role: 'assistant', content: a }], checked: `the GYM's own checker: ${verdict.why}`, from: `gym ${problem.game} level ${level}` };
}

/** The records waiting on the phone, today's count, what was refused, and what was sent (newest last). */
export interface StarBox {
  day: string;
  today: number;
  queue: StarRecord[];
  /** Turned away today because the day's cap was reached. */
  over: number;
  sent: { at: number; n: number; from: string[] }[];
}

export const newStarBox = (): StarBox => ({ day: '', today: 0, queue: [], over: 0, sent: [] });
const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Put a record in the box: refused once today's cap is reached, and the same question is never queued twice. Pure. */
export function queueStar(box: StarBox, rec: StarRecord | null, now: number): { box: StarBox; added: boolean; why: string } {
  const b = box.day === dayOf(now) ? box : { ...box, day: dayOf(now), today: 0, over: 0 };
  if (!rec) return { box: b, added: false, why: 'not checked' };
  if (b.today >= STAR_PER_DAY) return { box: { ...b, over: b.over + 1 }, added: false, why: `today's ${STAR_PER_DAY} are already kept` };
  const q = rec.messages[0]?.content ?? '';
  if (b.queue.some((r) => r.messages[0]?.content === q)) return { box: b, added: false, why: 'already kept' };
  return { box: { ...b, today: b.today + 1, queue: [...b.queue, rec].slice(-STAR_QUEUE) }, added: true, why: '' };
}

/** After the brain took `n` of the box's first records: they leave the box and are noted as sent. Pure. */
export function sentStars(box: StarBox, n: number, now: number): StarBox {
  if (n <= 0) return box;
  const gone = box.queue.slice(0, n);
  return { ...box, queue: box.queue.slice(n), sent: [...box.sent, { at: now, n: gone.length, from: gone.map((r) => r.from) }].slice(-30) };
}

/** Records sent to the brain since `since` (for the LOOPS card): from THINK HARDER, from the GYM. */
export function sentSince(box: StarBox, since: number): { think: number; gym: number } {
  let think = 0;
  let gym = 0;
  for (const s of box.sent) {
    if (s.at < since) continue;
    for (const f of s.from) {
      if (f === 'think harder') think++;
      else gym++;
    }
  }
  return { think, gym };
}
