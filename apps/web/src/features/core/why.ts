/**
 * WHY did you do that (OWNER-ISSUES 67d), on the phone: every reply keeps its trail in the chat itself — the tools that ran
 * before it (their names and arguments in plain words, kept on each tool's entry by assistant/session.ts) and how each
 * went — and a small WHY under the reply, or a long press on it, opens the sheet: what he asked, each step, the reason
 * (from the tool's ability: "you asked about “trains”, and I can plan door-to-door journeys…"), and his own reason when
 * his words gave one. Nothing is asked of a model (packages/shared/src/abilities.ts `whyLines`).
 */
import { whyLines, type Trail } from '../../../../../packages/shared/src/abilities';
import { allAbilities } from '../../abilities/registry';
import { brain } from '../../api/brain';
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

const same = (a: string, b: string) => a.replace(/\s+/g, ' ').trim().slice(0, 400) === b.replace(/\s+/g, ' ').trim().slice(0, 400);
/** How long the brain keeps a turn's trail (why.ts): two days. */
const KEPT_MS = 2 * 86_400_000;

/**
 * The trail of a reply, wherever it is kept: this phone's own entries hold it while the app stays open; once it has been
 * closed (the conversation comes back from the brain without its tools) the brain's kept trail for that question is
 * used. `note`: said under it when neither could tell (too long ago, or the brain out of reach).
 */
export async function resolveTrail(at: number, entries: Entry[] = chat.get().entries): Promise<{ trail: Trail; note?: string } | null> {
  const here = trailOf(entries, at);
  if (!here) return null;
  const reply = entries.find((e) => e.kind === 'assistant' && e.at === at) as Extract<Entry, { kind: 'assistant' }>;
  // answered on this phone (the offline brain, THINK HARDER, an answer about himself): the phone saw everything
  if (here.steps.length || reply.offline || reply.think || reply.local || !here.asked) return { trail: here };
  let trails: Trail[] | null = null;
  try {
    trails = (await Promise.race([brain.why(), new Promise<never>((_, no) => setTimeout(() => no(new Error('slow')), 4000))])).trails;
  } catch {
    trails = null;
  }
  const kept = trails?.filter((t) => same(t.asked, here.asked) && t.at <= at + 5000).at(-1);
  if (kept) return { trail: { ...kept, said: here.said ?? kept.said } };
  if (!trails) return { trail: here, note: 'I can’t reach my brain to check what ran for that one, so this is only what this phone saw.' };
  if (Date.now() - at > KEPT_MS) return { trail: here, note: 'That was more than two days ago: I only keep what I did for two days.' };
  return { trail: here };
}

/** The last reply that was not itself an answer about him: its stamp, or 0. */
export function lastReplyAt(entries: Entry[] = chat.get().entries): number {
  const e = [...entries].reverse().find((x) => x.kind === 'assistant' && !x.local && !x.think);
  return e?.kind === 'assistant' ? e.at : 0;
}

/** The sheet: one line each, the steps numbered, the reasons under them. */
export async function openWhy(at: number): Promise<void> {
  const r = await resolveTrail(at);
  if (!r) return;
  const lines = [...whyLines(r.trail, allAbilities()), ...(r.note ? [r.note] : [])];
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
  return h('button.msgact.whybtn', { type: 'button', 'aria-label': 'Why did you do that?', title: 'Why', onclick: () => void openWhy(at) }, icon(WHY));
}

/** A long press on a reply opens WHY too (a finger that moves is a scroll, not a press). */
export function holdForWhy(el: HTMLElement, at: number): void {
  let timer = 0;
  let from = { x: 0, y: 0 };
  el.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button, a, input, details')) return;
    from = { x: e.clientX, y: e.clientY };
    clearTimeout(timer);
    timer = window.setTimeout(() => void openWhy(at), HOLD_MS);
  });
  el.addEventListener('pointermove', (e) => Math.hypot(e.clientX - from.x, e.clientY - from.y) > 10 && clearTimeout(timer));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, () => clearTimeout(timer));
}
