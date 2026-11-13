/**
 * THE SUNDAY NOTE'S SECOND SECTION (BRIEF-OCT-IDEAS-3 item 10): "What I learned this week", from the LOOPS card (what each loop practised and
 * what improved, selftrain/loops.ts) and the REPORT CARD (the weekly run's exam, kept or not), five lines at most, honest about the gap:
 * what was practised is counted, what improved is only what a measure says, and a last line says what the week cannot show.
 * It is one more section of the letter that already goes on Sunday morning (cycle.ts `sundayNote`: "What I learned to do this week"),
 * never a second message. Pure: the numbers come in, the lines go out; nothing here reads storage or the network.
 */
import type { BrainLoops } from '../../../../packages/shared/src/loops';

/** The heading the section carries in the letter. */
export const LEARNED_HEADING = 'What I learned this week';

const n = (x: number) => Math.round(x).toLocaleString('en-GB');
const pc = (x: number) => `${Math.round(x * 100)}%`;
const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`;
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));

/** The section's lines (none to five); [] when the week holds nothing to say, so no letter is sent for it alone. */
export function learnedLines(b: BrainLoops | null, ledger: string[] = []): string[] {
  if (!b) return [];
  const body: string[] = [];
  let improved = false;
  const d = b.drills;
  const s = b.study;
  const sc = b.school;
  const w = b.week && b.week.at != null && b.week.at >= b.since ? b.week : null;
  const st = b.star;

  // 1. what was practised: counted, nothing more
  const did: string[] = [];
  if (d.asked) did.push(`${plural(d.asked, 'drill')} (${n(d.right)} right)`);
  if (s.reads) did.push(`${plural(s.reads, 'piece')} of the library read`);
  if (s.digests) did.push(`${plural(s.digests, 'note')} written`);
  if (sc?.checked) did.push(`${plural(sc.checked, 'school practice item')} checked`);
  if (st.taken) did.push(`${plural(st.taken, 'checked answer')} kept for training`);
  if (did.length) body.push(`This week I did ${and(did)}.`);

  // 2. the drills: better only if the same checker scored more right than before
  if (d.asked) {
    const now = d.right / d.asked;
    const was = d.before.asked ? d.before.right / d.before.asked : null;
    if (was == null) body.push(`My drills were ${pc(now)} right; I have nothing earlier to compare, so I can’t say they improved.`);
    else if (now > was) {
      improved = true;
      body.push(`My drills went from ${pc(was)} right to ${pc(now)}.`);
    } else body.push(`My drills were ${pc(now)} right, not better than the ${pc(was)} before.`);
  }

  // 3. the weekly run, from the REPORT CARD: the exam decides whether a new brain is kept
  // (a letter that already says the run's exam in its first section is not told it twice: that run still counts as measured)
  if (w && ledger.some((l) => /\bexam\b/i.test(l))) {
    if (w.kept === true) improved = true;
  } else if (w) {
    const exam = w.before != null && w.after != null ? ` (${pc(w.before)} → ${pc(w.after)})` : '';
    if (w.stopped) body.push(`Week ${w.week}’s training stopped: ${w.stopped.replace(/[.\s]+$/, '')}.`);
    else if (w.kept === true) {
      improved = true;
      body.push(`Week ${w.week}’s training passed its exam${exam}, so I kept the new brain.`);
    } else if (w.kept === false) body.push(`Week ${w.week}’s training did not pass its exam${exam}${w.why ? `: ${w.why.replace(/[.\s]+$/, '')}` : ''}, so I kept the brain I had.`);
  }

  // 4. SCHOOL's papers, as marked
  if (sc?.papers.length) {
    const best = [...sc.papers].sort((a, c) => c.pct - a.pct)[0]!;
    const prev = sc.previous != null ? ` (the paper before: ${pc(sc.previous)})` : '';
    if (sc.previous != null && best.pct > sc.previous) improved = true;
    body.push(`I sat ${plural(sc.papers.length, 'paper')} at school; the best was ${best.title}, ${pc(best.pct)}${prev}.`);
  }

  if (!body.length) return [];

  // 5. the gap: what the week cannot show (always the last line; the others give way to it)
  const gap = improved
    ? 'What I can’t say: drill scores are my own checker’s, so the exam and the GYM’s checked levels are the measures to trust more.'
    : did.length
      ? 'What I can’t say: practice is counted, not skill, and nothing measured this week moved, so I can’t show it made me better.'
      : 'What I can’t say: no practice was counted, so there is nothing this week to show for me.';
  return [...body.slice(0, 4), gap];
}

/** The letter: the capability ledger's lines first (what I learned to do), then this section under its heading, in one message. */
export function letterText(ledger: string[], learned: string[]): string {
  return [...ledger, ...(learned.length ? [...(ledger.length ? [''] : []), `${LEARNED_HEADING}:`, ...learned] : [])].join('\n');
}
