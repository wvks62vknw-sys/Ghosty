/**
 * What a reply shows of its read-back (BRIEF-RELIABILITY 2; assistant/verify.ts): while it is being read back, "Setting it…" in the
 * system's truth style; read back, the tick and where the thing is ("✓ ON YOUR AGENDA"); not read back, the sentence says so and the
 * two keys are RETRY (read it again) and SHOW ME (the list it should be on).
 */
import { chat, type Entry } from '../../assistant/session';
import { readBack, ruleFor, VERIFY, type Verified } from '../../assistant/verify';
import { h } from '../../core/dom';
import { perform } from '../../shell/launcher';
import { button } from '../../ui/components';
import { waitState } from '../../ui/wait';

type Reply = Extract<Entry, { kind: 'assistant' }>;

/** The held reply: his words are not drawn yet, only what it is doing. */
export function heldReply(): HTMLElement {
  const words = 'Setting it…';
  if (!waitState.said.includes(words)) waitState.said.push(words);
  return h('div.msg.held', h('small', 'GHOSTY'), h('p.g-truth.waiting', { role: 'status', 'aria-live': 'polite', dataset: { wait: words, case: 'keep' } }, words));
}

/** The tick, or RETRY and SHOW ME, under the reply. */
export function verifyRow(e: Reply): HTMLElement | null {
  const v: Verified | undefined = e.verify;
  if (!v) return null;
  if (v.state === 'ok') return h('p.g-truth.vtick', { dataset: { case: 'keep', verified: 'ok' } }, `✓ ${v.where.join(' and ')}`);
  const f = v.fail;
  if (!f) return null;
  const retry = button('RETRY', async (b) => {
    b.disabled = true;
    const rule = ruleFor(f.tool, f.args, f.summary) ?? VERIFY[f.tool];
    const r = rule ? await readBack(rule, f.args, f.summary, 4000) : 'no';
    if (r === 'ok' && rule) {
      const ok: Verified = { state: 'ok', where: [rule.where] };
      chat.set((s) => ({ entries: s.entries.map((x) => (x.kind === 'assistant' && x.at === e.at ? { ...x, text: f.original, verify: ok } : x)), live: f.original }));
    } else b.disabled = false;
  }, 'on vretry');
  const show = button('SHOW ME', () => perform({ open: f.show.open, ...(f.show.panel ? { panel: f.show.panel } : {}) }), 'vshow');
  retry.dataset.case = 'keep';
  show.dataset.case = 'keep';
  return h('div.row.wrap.verifyrow', { dataset: { case: 'keep', verified: 'no' } }, retry, show);
}
