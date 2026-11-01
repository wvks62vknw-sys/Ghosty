/**
 * DESIGN A BUILD from the chat, with no model (BRIEF-REST-D 1; the phrases registry, assistant/phrases.ts `build`):
 *  - "design me a shed three by two": the design made from his words, the sheet open on THE PLAN, and the reply with its
 *    size, its bill's total as a first estimate, and SHOW ME, THE PLAN, THE BILL;
 *  - "show me the build": the Studio's DESIGN A BUILD pane on it;
 *  - "price the roof": the sheet's BILL with the roof's lines lit, and their sum said;
 *  - "make it 4 by 3", "an apex roof", "add a window": the design on show changed, every face with it.
 * With no design on show, the last three let the next table (or the brain) answer.
 */
import { run } from '../commands/registry';
import { totals } from './bom';
import { CONCEPT_LINE } from './concept';
import { groupLines, type Design } from './kits';
import { lowFirst, PRICE_LINE, pounds } from './prices';
import { PC_LINE } from './pc';
import { buildNow, designNow, setDesign } from './state';
import { applyChange, buildAsked } from './words';

type Opts = { voice?: boolean; private?: boolean };
type Go = { id: string; ask: number; label: string; run?: string; args?: Record<string, unknown> };
type Answer = (text: string, reply: string, local: { kind: 'pack'; go?: Go[] }, opts: Opts) => true;

const SHOW: Go = { id: 'studio:sample:build', ask: -1, label: 'SHOW ME', run: 'open_studio', args: { sample: 'build' } };
const sheet = (label: string, side: string): Go => ({ id: 'phrase:build', ask: -1, label, run: 'open_build', args: { side } });

/** The reply for a design: what it is, what it comes to, the honest lines. */
export function designReply(d: Design): string {
  if (d.concept) return `${d.title}: ${d.summary.replace(` ${CONCEPT_LINE}`, '')}. ${CONCEPT_LINE} The real parts: ${(d.parts ?? []).map((p) => p.role.toLowerCase()).join(', ')}, each named on the sheet.`;
  const t = totals(d, buildNow.get().live);
  const fits = d.compat ? (d.compat.every((c) => c.ok) ? ' Everything fits.' : ` ${d.compat.filter((c) => !c.ok).length} things do not fit: see the sheet.`) : '';
  const notes = d.params.notes.length ? ` (${d.params.notes.join('; ')}.)` : '';
  return `${d.title}: ${d.summary}.${notes} ${d.lines.length} lines in the bill, ${pounds(t.total)} in all (${d.kind === 'pc' ? PC_LINE.replace(/\.$/, '') : lowFirst(PRICE_LINE)}).${fits} Every number is a first estimate, never certified.`;
}

export async function buildTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const ask = buildAsked(text);
  if (!ask) return false;
  const { openBuild } = await import('./sheet');
  if (ask.kind === 'design') {
    const d = setDesign(ask.params);
    openBuild({ side: d.concept ? 'bill' : 'plan', lit: '' });
    return answer(text, designReply(d), { kind: 'pack', go: d.concept ? [sheet('THE PARTS', 'bill')] : [SHOW, sheet('THE PLAN', 'plan'), sheet('THE BILL', 'bill')] }, opts);
  }
  const d = designNow();
  if (!d) return false;
  if (ask.kind === 'show') {
    if (d.concept) return answer(text, `${d.title} is a concept, so nothing is drawn: ${CONCEPT_LINE}`, { kind: 'pack', go: [sheet('THE PARTS', 'bill')] }, opts);
    void run('open_studio', { sample: 'build' });
    return answer(text, `Here is the ${d.title.toLowerCase()} in 3-D: tap a part to light its lines; EXPLODE shows the frame, ROOF OFF looks inside.`, { kind: 'pack', go: [SHOW, sheet('THE BILL', 'bill')] }, opts);
  }
  if (ask.kind === 'price') {
    const g = groupLines(d, ask.group);
    const name = d.groups.find((x) => x.id === ask.group)?.name.toLowerCase() ?? ask.group;
    if (!g.lines.length) return answer(text, `This ${d.title.toLowerCase()} has no ${name} in its bill.`, { kind: 'pack', go: [sheet('THE BILL', 'bill')] }, opts);
    openBuild({ side: 'bill', lit: ask.group });
    const live = buildNow.get().live;
    const sum = g.lines.reduce((s, l) => s + (live[l.id] ? live[l.id]!.gbp * (l.per === 'm' ? l.n : l.qty) : l.total), 0);
    const list = g.lines.map((l) => `${l.name} (${l.n} ${l.unit}) ${pounds(live[l.id] ? live[l.id]!.gbp * (l.per === 'm' ? l.n : l.qty) : l.total)}`).join('; ');
    return answer(text, `The ${name}: ${list}. ${pounds(sum)} in all, ${lowFirst(PRICE_LINE)}. Paste a shop page into any line and PRICE IT LIVE makes it real, watched twice a day.`, { kind: 'pack', go: [sheet('THE BILL', 'bill')] }, opts);
  }
  const p = buildNow.get().params!;
  const next = setDesign(applyChange(p, ask.change));
  return answer(text, `Done: ${designReply(next)}`, { kind: 'pack', go: next.concept ? [sheet('THE PARTS', 'bill')] : [SHOW, sheet('THE PLAN', 'plan')] }, opts);
}
