/**
 * WHY did you do that (OWNER-ISSUES 67d), on the phone: every reply keeps its trail in the chat itself — the tools that ran
 * before it (their names and arguments in plain words, kept on each tool's entry by assistant/session.ts) and how each
 * went — and a small WHY under the reply, or a long press on it, opens the sheet: what he asked, each step, the reason
 * (from the tool's ability: "you asked about “trains”, and I can plan door-to-door journeys…"), and his own reason when
 * his words gave one. Nothing is asked of a model (packages/shared/src/abilities.ts `whyLines`).
 */
import { whyLines, type Trail } from '../../../../../packages/shared/src/abilities';
import { allAbilities } from '../../abilities/registry';
import { chat, type Entry } from '../../assistant/session';
import { h, icon } from '../../core/dom';
import { modal } from '../../ui/components';

const WHY = '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.4a2.5 2.5 0 014.8.9c0 1.7-2.4 2.1-2.4 3.6M12 16.6v.4"/>';
/** A press this long on a reply opens WHY (the phone's own long press, a little shorter than its menu). */
const HOLD_MS = 550;

/** The trail of the reply stamped `at`: what he asked before it, the tools between, and the reply's words. */
export function trailOf(entries: Entry[], at: number): Trail | null {
  const i = entries.findIndex((e) => e.kind === 'assistant' && e.at === at);
  if (i < 0) return null;
  let j = i - 1;
  while (j >= 0 && entries[j]!.kind !== 'user') j--;
  const user = j >= 0 ? (entries[j] as Extract<Entry, { kind: 'user' }>) : null;
  const steps = entries
    .slice(j + 1, i)
    .filter((e): e is Extract<Entry, { kind: 'activity' }> => e.kind === 'activity')
    .map((a) => ({
      tool: a.tool ?? '',
      ...(a.tool ? {} : { label: a.label }),
      ...(a.args ? { args: a.args } : {}),
      ok: a.state === 'ok' ? true : a.state === 'fail' ? false : null,
      ...(a.detail ? { note: a.detail } : {}),
    }));
  const reply = entries[i] as Extract<Entry, { kind: 'assistant' }>;
  return { at, asked: user?.text ?? '', steps, said: reply.text };
}

/** The last reply that was not itself an answer about him: its stamp, or 0. */
export function lastReplyAt(entries: Entry[] = chat.get().entries): number {
  const e = [...entries].reverse().find((x) => x.kind === 'assistant' && !x.local && !x.think);
  return e?.kind === 'assistant' ? e.at : 0;
}

/** The sheet: one line each, the steps numbered, the reasons under them. */
export function openWhy(at: number): void {
  const t = trailOf(chat.get().entries, at);
  if (!t) return;
  const lines = whyLines(t, allAbilities());
  const body = h('div.whybody', { dataset: { case: 'keep' } }, ...lines.map((l) => {
    if (/^\d+\. /.test(l)) return h('p.whystep', l);
    if (/^\s+Why: /.test(l)) return h('p.whyreason', l.trim());
    if (/^In my words: /.test(l)) return h('p.whyown', l);
    return h('p.whyask', l);
  }));
  modal('Why I did that', body);
  // (his "I" stays a capital: the sheet's title is not put in sentence case)
  const title = [...document.querySelectorAll<HTMLElement>('.modal .mhead b')].at(-1);
  if (title) title.dataset.case = 'keep';
}

/** WHY under a reply: a small button in its row. */
export function whyButton(at: number): HTMLButtonElement {
  return h('button.msgact.whybtn', { type: 'button', 'aria-label': 'Why did you do that?', title: 'Why', onclick: () => openWhy(at) }, icon(WHY));
}

/** A long press on a reply opens WHY too (a finger that moves is a scroll, not a press). */
export function holdForWhy(el: HTMLElement, at: number): void {
  let timer = 0;
  let from = { x: 0, y: 0 };
  el.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button, a, input, details')) return;
    from = { x: e.clientX, y: e.clientY };
    clearTimeout(timer);
    timer = window.setTimeout(() => openWhy(at), HOLD_MS);
  });
  el.addEventListener('pointermove', (e) => Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10 && clearTimeout(timer));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => clearTimeout(timer));
}
