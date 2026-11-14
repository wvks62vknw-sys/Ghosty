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
import { button, row, toast } from '../../ui/components';
import { sayError } from '../../ui/hisWords';

/** [recall] "Due today: Sam (Invoice 42)". */
const chasesDue = (xs: string[]): string => `Chasing today: ${xs.join('; ')}.`;
/** Two working days from now, as the day word a chase takes ("thursday"). */
function chaseDayFor(d: Date): string {
  const t = new Date(d);
  let n = 0;
  while (n < 2) {
    t.setDate(t.getDate() + 1);
    if (t.getDay() !== 0 && t.getDay() !== 6) n++;
  }
  return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][t.getDay()]!;
}

/** The inbox as last read, kept two minutes: opening the Brief again does not ask the mail server again. */
let kept: { at: number; list: MailLine[] } | null = null;
const KEEP_MS = 120_000;

export const mailState = { shown: 0, line: '', state: 'idle' as 'idle' | 'hidden' | 'checking' | 'shown' | 'down', chases: 0 };

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
    // [recall] memory.c2 (memory lane, additive): the chases that come due today, from the one watcher system
    const today = new Date().toDateString();
    const due = ((await brain.watchers().catch(() => null))?.watchers ?? []).filter((w) => w.kind === 'reply' && w.state === 'watching' && !!w.by && new Date(w.by).toDateString() === today);
    if (mine !== token) return;
    mailState.chases = due.length;
    const chaseLine = due.length ? row('CHASES', chasesDue(due.map((w) => `${w.who || 'a reply'}${w.about ? ` (${w.about.slice(0, 40)})` : ''}`)), null, { wrap: true }) : null;
    if (chaseLine) chaseLine.classList.add('bremchase');
    if (!need.length && chaseLine) {
      el.hidden = false;
      mailState.state = 'shown';
      mailState.shown = 0;
      return void clear(el, chaseLine);
    }
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
        // [recall] memory.c2: CHASE holds it for two working days and checks that morning (nothing is sent; STOP is under PLAN → WATCHERS)
        const c = button('CHASE', async (k) => {
          k.disabled = true;
          const day = chaseDayFor(new Date());
          const r = await brain.chaseAdd({ kind: 'reply', who: (m.name || m.address).split(/\s+/)[0]!, day, about: m.subject ?? '', from: m.address, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }).catch((e: unknown) => ({ said: '', error: sayError(e, 'set that chase') }));
          if ('error' in r) {
            toast(r.error, 'warn');
            k.disabled = false;
            return;
          }
          toast(r.said, 'ok');
          k.textContent = 'CHASING';
        }, 'bremdraft bremchasekey');
        c.setAttribute('aria-label', `Chase ${who} if there is no reply in two working days: ${m.subject}`);
        return h('div.bremrow', { dataset: { uid: String(m.uid) } }, h('span.bremtxt', h('b', who), h('small', m.subject || '(no subject)')), h('span.bremkeys', b, c));
      }),
      ...(chaseLine ? [chaseLine] : []),
    );
  };
  return { el, paint };
}
