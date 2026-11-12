/**
 * EMAIL TRIAGE INTO THE BRIEF (BRIEF-OCT-IDEAS-2 8): only when his own email is linked (LINKS → EMAIL), YOUR DAY gets one line,
 * "two emails need an answer", from the inbox the link already reads: the sender and the subject only, sorted on this phone
 * (packages/shared/src/lifeeasier.ts `needsAnswer`), never a body. DRAFT on each opens a reply to start from (features/links/
 * drafts.ts) for his edit and his SEND tap: nothing is sent without it. With no email linked the line is absent and nothing asks
 * him to link one; linked but unreachable, one plain line says so and that it tries again when the Brief next opens.
 */
import { needsAnswer, triageLine, type MailLine } from '../../../../../packages/shared/src/lifeeasier';
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { button, row } from '../../ui/components';

/** The inbox as last read, kept two minutes: opening the Brief again does not ask the mail server again. */
let kept: { at: number; list: MailLine[] } | null = null;
const KEEP_MS = 120_000;

export const mailState = { shown: 0, line: '', state: 'idle' as 'idle' | 'hidden' | 'checking' | 'shown' | 'down' };

export function briefMail(): { el: HTMLElement; paint(): Promise<void> } {
  const el = h('div.bremail', { hidden: true, dataset: { case: 'keep' } });
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.briefMail = mailState;
  let token = 0;
  const hide = () => {
    el.hidden = true;
    clear(el);
    mailState.state = 'hidden';
    mailState.shown = 0;
    mailState.line = '';
  };
  const paint = async (): Promise<void> => {
    const mine = ++token;
    const st = await brain.emailStatus().catch(() => null);
    if (mine !== token) return;
    // not linked (or the brain cannot say): the line is absent, and nothing asks him to link one
    if (!st?.linked || st.problem) return hide();
    if (el.hidden) {
      el.hidden = false;
      clear(el, row('EMAIL', 'Checking your email…', null, { wrap: true }));
      mailState.state = 'checking';
    }
    let list: MailLine[];
    try {
      if (kept && Date.now() - kept.at < KEEP_MS) list = kept.list;
      else {
        const r = await brain.mailInbox();
        if (mine !== token) return;
        if (!r.linked) return hide();
        list = r.messages;
        kept = { at: Date.now(), list };
      }
    } catch {
      if (mine !== token) return;
      el.hidden = false;
      clear(el, row('EMAIL', 'I couldn’t check your email just now. I try again when you next open the Brief.', null, { wrap: true }));
      mailState.state = 'down';
      mailState.shown = 0;
      return;
    }
    const need = list.filter(needsAnswer).slice(0, 3);
    if (!need.length) return hide();
    el.hidden = false;
    mailState.state = 'shown';
    mailState.shown = need.length;
    mailState.line = triageLine(need.length);
    const head = row('EMAIL', triageLine(need.length), null, { wrap: true });
    head.classList.add('bremhead');
    clear(
      el,
      head,
      ...need.map((m) => {
        const who = m.name || m.address;
        const b = button('DRAFT', () => void import('../links/drafts').then((d) => d.openEmailDraft(m)), 'bremdraft');
        b.setAttribute('aria-label', `Draft a reply to ${who}: ${m.subject}`);
        b.dataset.label = 'Draft';
        return h('div.bremrow', { dataset: { uid: String(m.uid) } }, h('span.bremtxt', h('b', who), h('small', m.subject || '(no subject)')), b);
      }),
    );
  };
  return { el, paint };
}
