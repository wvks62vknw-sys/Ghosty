/**
 * The Brief's FORESIGHT (OWNER-ISSUES 61a; the brain's ledger, apps/edge/src/foresight.ts): today's expectations, one line
 * each with the confidence as a word ("Likely: rain by 15:00", "I think: the 08:12 on time"), how yesterday went, his own
 * questions still on record (a tap offers RIGHT / WRONG: his word is the only score they get), and the standing line
 * ("I keep score: right 78% of the time about trains."). What is missing is said plainly (the commute needs the TomTom key).
 */
import { ANSWER_DAYS, briefLine, NONE_YET, todayOpen, type ForesightInfo, type Prediction } from '../../../../../packages/shared/src/foresight';
import { clear, h } from '../../core/dom';
import { loadForesight, resolveForesight } from '../../state/foresight';
import { button, panel, row, toast, type Panel } from '../../ui/components';

/** RIGHT / WRONG (and UNKNOWN on the Report card) for one of his questions: his word, kept, then `done` repaints. */
export function verdictButtons(p: Prediction, done: (info: ForesightInfo) => void, unknown = false): HTMLElement {
  const say = (right: boolean | null) => async (b: HTMLButtonElement) => {
    b.disabled = true;
    try {
      const r = await resolveForesight(p.id, right);
      toast(r.said, 'ok');
      done(r);
    } catch {
      b.disabled = false;
      toast('I couldn’t reach my brain to note that. Try again in a moment.', 'warn');
    }
  };
  const acts = h('div.row.wrap.foreacts', { dataset: { case: 'keep', id: p.id } }, button('RIGHT', say(true), 'on foreright'), button('WRONG', say(false), 'forewrong'));
  if (unknown) acts.append(button('UNKNOWN', say(null), 'foreunknown'));
  return acts;
}

/** A row with one more class (for the spec and the look). */
export const tagged = (el: HTMLElement, cls: string) => (el.classList.add(cls), el);

/** His questions still open and under a week old, newest first. */
export const openQuestions = (items: Prediction[], now = Date.now()) => items.filter((p) => p.kind === 'answer' && !p.outcome && now - p.at < ANSWER_DAYS * 86_400_000).sort((a, b) => b.at - a.at);

export function briefForesight(): Panel & { paint(fresh?: boolean): Promise<void> } {
  const p = panel('FORESIGHT', { cls: 'foresight', grow: false });
  let shown: string | null = null;
  const draw = (info: ForesightInfo | null) => {
    if (!info) {
      p.setStatus('CAN’T CHECK', 'mid');
      return void clear(p.body, row(null, 'My predictions can’t be read right now. They come back when you next open the Brief.', null, { wrap: true }));
    }
    const now = Date.now();
    const today = todayOpen(info.items, now, info.tz);
    const asks = openQuestions(info.items, now).filter((q) => !today.includes(q)).slice(0, 3);
    const rows: HTMLElement[] = [];
    const answerRow = (q: Prediction, el: HTMLElement) => {
      rows.push(el);
      if (shown === q.id) rows.push(verdictButtons(q, (r) => ((shown = null), draw(r))));
    };
    const toggle = (q: Prediction) => () => {
      shown = shown === q.id ? null : q.id;
      draw(info);
    };
    for (const x of today) {
      const el = tagged(row(null, briefLine(x), x.kind === 'answer' ? '›' : null, { wrap: true, ...(x.kind === 'answer' ? { onClick: toggle(x) } : {}) }), 'foreline');
      el.dataset.kind = x.kind;
      if (x.kind === 'answer') answerRow(x, el);
      else rows.push(el);
    }
    for (const q of asks) {
      answerRow(q, tagged(row('ON RECORD', `${q.expect} · “${q.subject}”`, '›', { wrap: true, onClick: toggle(q) }), 'foreask'));
    }
    if (!info.items.length) rows.push(row(null, NONE_YET, null, { wrap: true }));
    else if (!today.length && !asks.length) rows.push(row(null, 'Nothing to expect for today yet: I make the day’s predictions at six in the morning.', null, { wrap: true }));
    if (info.yesterday) rows.push(tagged(row(null, info.yesterday, null, { wrap: true }), 'foreyday'));
    if (info.items.length) rows.push(tagged(row(null, info.score, null, { wrap: true }), 'forescore'));
    for (const n of info.notes) rows.push(tagged(row(null, n, null, { wrap: true }), 'forenote'));
    p.setStatus(today.length ? `${today.length} TODAY` : info.items.length ? 'NOTHING TODAY' : 'NONE YET', today.length ? 'ok' : 'off');
    clear(p.body, ...rows);
  };
  const paint = async (fresh = false) => draw(await loadForesight(fresh));
  return Object.assign(p, { paint });
}
