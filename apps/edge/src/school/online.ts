/**
 * SCHOOL sat by the brain's own model (13 Nov, the owner: "the school still uses the smallest brain which answers in
 * like multiple choice or something"). When the phone has signal, each question of a paper is answered by the model the
 * brain's router chooses for its best work (the 'big' tier: the same choice as his chat), in full working: every step
 * written out, then one final line "Answer: …" that the code marks where the answer is exact. A multiple-choice item is
 * still answered with its letter (the paper itself is multiple choice there), but only after the working. The phone's
 * own small brain sits a paper only when this cannot be reached (no signal): the phone's sit.ts falls back by itself.
 *
 *   GET  /school/sit-online                → { ready, line }: whether the brain has a model to sit papers with
 *   POST /school/sit-online { paperId, itemId } → that question answered by the brain's model and kept with the paper
 *        (like the phone's answers): { id, given, model, line }. 503 { error, busy } when no model answered in time
 *        (the phone sits that question itself); 404 for a paper or question not known; 409 once handed in.
 *
 * The answer is marked exactly as the phone's are (mark.ts): exact items by the code from the "Answer:" line, written
 * ones by the marker against the mark scheme. The paper is recorded as sat online, by the model that sat it.
 */
import { answerLine } from '../../../../packages/shared/src/school';
import { keepGiven } from './mark';
import type { SchoolItem, SchoolPaper } from './papers';
import { stageName } from './papers';
import { loadPaper, savePaper, type Store } from './state';

/** One question to the brain's own model: the reply's text and the model that wrote it (its label, as the router names it). */
export type Sit = (system: string, user: string, item: SchoolItem) => Promise<{ text: string; model: string }>;

export const ONLINE_SIT_SYSTEM =
  'You are a top pupil sitting a UK school exam. Answer the question properly, as a real exam answer earns full marks: ' +
  'show your full working step by step (every calculation written out, every reason given), and for written questions ' +
  'write the whole answer in full sentences, using the marks as a guide to how much to write. Never just pick or guess. ' +
  "Finish with ONE last line in exactly this form: 'Answer: <your final answer>'. For a multiple-choice question that " +
  'last line is the letter only. For a piece of writing, write the whole piece, then finish with \'Answer: done\'.';

/** What the brain's model reads for one question: the stage, the passage when there is one, the question, its marks, the choices. */
export function onlinePrompt(item: SchoolItem, paper: Pick<SchoolPaper, 'stage' | 'passages' | 'title'>): string {
  const p = item.passage ? paper.passages?.find((x) => x.id === item.passage) : undefined;
  const parts = [`Paper: ${paper.title} (${stageName(paper.stage)})`];
  if (p) parts.push(`Read this: "${p.title}"\n\n${p.text}`);
  parts.push(`Question (${item.marks} mark${item.marks === 1 ? '' : 's'}): ${item.q}`);
  if (item.unit) parts.push(`Give the answer in ${item.unit}.`);
  if (item.type === 'mcq' && item.options?.length) parts.push(`Choices:\n${item.options.map((o, i) => `${'ABCDEFGH'[i]}) ${o}`).join('\n')}\nWork it out first, then give the letter on the last line.`);
  else if (item.type === 'extended') parts.push('Write it out in full.');
  else parts.push('Show your full working, then the final answer on the last line.');
  return parts.join('\n\n');
}

/** The reply kept as his answer: the working and the answer line, never cut before the answer line (keepGiven). */
export function keepWorking(item: SchoolItem, text: string): string {
  return keepGiven(item, text);
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Shorter, plainer name for the model the brain chose ("Provider · model" stays as the router names it). */
const named = (model: string) => String(model || 'the brain’s model').slice(0, 80);

export interface OnlineDeps extends Store {
  sit?: Sit;
}

/** GET and POST /school/sit-online. `serial`: SCHOOL's one-change-at-a-time queue for the record. */
export async function sitOnlineRoute(method: string, body: Record<string, unknown>, d: OnlineDeps, serial: <T>(fn: () => Promise<T>) => Promise<T>): Promise<Response> {
  if (method === 'GET') return json({ ready: !!d.sit, line: d.sit ? 'Papers are sat by my own online model, in full working.' : 'My online model is not set up, so papers are sat on the brain on this phone.' });
  if (method !== 'POST') return json({ error: 'not found' }, 404);
  if (!d.sit) return json({ error: 'My online model is not set up, so this phone’s brain sits the paper.', busy: true }, 503);
  const paperId = String(body.paperId ?? '');
  const itemId = String(body.itemId ?? '');
  if (!/^[a-z0-9-]{1,80}$/.test(paperId)) return json({ error: 'Which paper?' }, 400);
  const rec = await loadPaper(d, paperId);
  if (!rec) return json({ error: 'That paper is not known.' }, 404);
  if (rec.result) return json({ error: 'That paper was already handed in.' }, 409);
  const item = rec.paper.items.find((i) => i.id === itemId);
  if (!item) return json({ error: 'That question is not on the paper.' }, 404);
  let got: { text: string; model: string };
  try {
    got = await d.sit(ONLINE_SIT_SYSTEM, onlinePrompt(item, rec.paper), item);
  } catch {
    return json({ error: 'No online model answered in time, so this phone’s brain answers that question.', busy: true }, 503);
  }
  const given = keepWorking(item, got.text);
  if (!given.trim()) return json({ error: 'The online model gave an empty answer, so this phone’s brain answers that question.', busy: true }, 503);
  const model = named(got.model);
  await serial(async () => {
    const now = await loadPaper(d, paperId);
    if (!now || now.result) return;
    now.given[item.id] = given;
    now.model = model;
    now.where = 'online';
    await savePaper(d, now);
  });
  return json({ id: item.id, given, answer: answerLine(given).slice(0, 200), model, line: `Answered by ${model}, online, in full working.` });
}
