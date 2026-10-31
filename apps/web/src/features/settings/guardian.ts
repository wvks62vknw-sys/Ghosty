/**
 * SETTINGS → GUARDIAN (OWNER-ISSUES 56, 60): the one named person — a name, a Telegram handle or an email (never a phone
 * number: a text costs money), whether his last known position goes with a walk's message — with a TEST MESSAGE; the
 * invite link that pairs them with his bot in one tap; his PANIC PHRASE, kept as a keyed hash made here (the words never
 * leave the phone); and the honest limits, said where he sets it up.
 */
import { brain } from '../../api/brain';
import { guardian, setGuardian } from '../../state/guardian';
import { clear, h } from '../../core/dom';
import { settings } from '../../state/app';
import { button, panel, toast } from '../../ui/components';
import { panicProblem, panicSecret, type GuardianInfo } from '../../../../../packages/shared/src/guardian';
import { switchRow } from './switch';

export function guardianPanel(): { el: HTMLElement; refresh(): void } {
  const p = panel('GUARDIAN', { grow: false, status: 'Not set' });
  const name = h('input', { placeholder: 'Their name', 'aria-label': 'Your named person', maxLength: 40, autocomplete: 'off' });
  const tg = h('input', { placeholder: 'Telegram @handle', 'aria-label': 'Their Telegram handle', maxLength: 33, autocomplete: 'off', autocapitalize: 'none' });
  const email = h('input', { type: 'email', placeholder: 'or their email', 'aria-label': 'Their email address', maxLength: 200, autocomplete: 'off', autocapitalize: 'none' });
  const mine = h('input', { placeholder: 'Your name, as they know you', 'aria-label': 'Your name for them', maxLength: 40, autocomplete: 'off' });
  let share = false;
  const shareSw = switchRow('Share where I am', 'My last known position goes with a walk’s message to them', () => share, (on) => (share = on));
  const state = h('p.note.guardstate', { dataset: { case: 'keep' } });
  const invite = h('div.guardinvite');
  const save = button('SAVE', () => void savePerson(), 'on');
  const test = button('TEST MESSAGE', () => void sendTest());
  const remove = button('REMOVE', () => void removePerson(), 'warn');
  const phrase = h('input', { type: 'password', placeholder: 'Two or more words you’d never say by accident', 'aria-label': 'Your panic phrase', autocomplete: 'off', maxLength: 80 });
  const setPhrase = button('SET', () => void savePhrase(), 'on');
  const dropPhrase = button('REMOVE', () => void removePhrase(), 'warn');
  const phraseState = h('p.note.panicstate', { dataset: { case: 'keep' } });
  phrase.addEventListener('keydown', (e) => e.key === 'Enter' && setPhrase.click());

  p.body.append(
    h('p.note', 'If you don’t answer me on a walk home, or you say your panic phrase, I message one person: by Telegram once they’ve opened your bot with the invite, or from your own email. Never a text — those cost money.'),
    h('div.lab', 'YOUR NAMED PERSON'),
    h('div.keyrow.wrapit', name),
    h('div.keyrow.wrapit', tg, email),
    h('div.keyrow.wrapit', mine),
    shareSw.el,
    h('div.row.wrap.guardbtns', save, test, remove),
    state,
    invite,
    h('div.lab', 'PANIC PHRASE'),
    h('p.note', 'Typed or said — here, in a voice note or on Telegram — it messages them at once, with where you are when I have it. I keep only a scrambled copy, never the words.'),
    h('div.keyrow.wrapit', phrase, setPhrase, dropPhrase),
    phraseState,
    h('p.note.guardlimit', 'The honest limits: I only know where you are while I’m open, only on a walk you started, and only after you said yes once. The check-in itself runs on my brain, so “Home?” comes even if your phone is asleep.'),
  );

  const paint = (info: GuardianInfo | null) => {
    const per = info?.person ?? null;
    if (per && document.activeElement !== name && document.activeElement !== tg && document.activeElement !== email) {
      name.value = per.name;
      tg.value = per.telegram;
      email.value = per.email;
      share = per.sharePos;
      shareSw.paint();
    }
    if (!mine.value) mine.value = /^boss$/i.test(settings.get().name) ? '' : settings.get().name;
    test.disabled = remove.disabled = !per;
    p.setStatus(per ? per.name : 'Not set', per?.via ? 'ok' : per ? 'mid' : undefined);
    state.textContent = !per
      ? 'Nobody named yet.'
      : per.via === 'telegram'
        ? `${per.name} is linked on Telegram: a message reaches them there.`
        : per.via === 'email'
          ? `${per.name} is reached by email from your linked address${per.telegram && !per.linked ? ' (Telegram once they open your bot)' : ''}.`
          : per.telegram && !per.linked
            ? `${per.name} can't be reached yet: send them the link below, and they tap START once.`
            : `${per.name} can't be reached yet: link your email in LINKS → EMAIL.`;
    clear(invite);
    if (per?.invite) {
      const a = h('a.guardlink', { href: per.invite, target: '_blank', rel: 'noopener' }, per.invite.replace(/^https:\/\//, ''));
      invite.append(
        h('span', 'Their one-tap invite: '),
        a,
        button('SHARE', () => {
          const text = `Ghosty, my assistant, may message you if I don't answer on a walk home. Tap this once and press START: ${per.invite}`;
          if (navigator.share) void navigator.share({ text }).catch(() => undefined);
          else void navigator.clipboard?.writeText(text).then(() => toast('Copied: send it to them', 'ok'), () => undefined);
        }),
      );
    }
    phraseState.textContent = info?.panic ? `Set (${info.panic.n} words). Change it by setting a new one.` : 'Not set.';
    dropPhrase.disabled = !info?.panic;
  };

  const said = (e: unknown) => String((e as Error)?.message ?? e).replace(/^Error:\s*/, '').slice(0, 160);

  const savePerson = async () => {
    const body = { name: name.value.trim(), telegram: tg.value.trim(), email: email.value.trim(), sharePos: share, ownerName: mine.value.trim() };
    if (!body.name) return toast('Their name first', 'warn');
    if (!body.telegram && !body.email) return toast('A Telegram handle or an email: I never send texts', 'warn');
    try {
      setGuardian(await brain.guardianPerson(body));
      toast(`${body.name} is your named person`, 'ok');
    } catch (e) {
      toast(said(e), 'bad');
    }
  };
  const sendTest = async () => {
    const r = await brain.guardianTest().catch((e: unknown) => ({ sent: false, error: said(e) }));
    toast(r.sent ? `Test sent by ${'via' in r && r.via === 'email' ? 'email' : 'Telegram'}` : `It didn't go: ${'error' in r ? r.error : 'no way to reach them'}`, r.sent ? 'ok' : 'bad');
  };
  const removePerson = async () => {
    try {
      setGuardian(await brain.guardianPersonRemove());
      name.value = tg.value = email.value = '';
      toast('Nobody is named now', 'ok');
    } catch (e) {
      toast(said(e), 'bad');
    }
  };
  const savePhrase = async () => {
    const words = phrase.value;
    const problem = panicProblem(words);
    if (problem) return toast(problem, 'warn');
    try {
      // made here: only the scrambled copy goes to the brain
      setGuardian(await brain.panicPhrase(await panicSecret(words)));
      phrase.value = '';
      toast('Panic phrase set', 'ok');
    } catch (e) {
      toast(said(e), 'bad');
    }
  };
  const removePhrase = async () => {
    try {
      setGuardian(await brain.panicPhraseRemove());
      toast('Panic phrase removed', 'ok');
    } catch (e) {
      toast(said(e), 'bad');
    }
  };

  guardian.subscribe((s) => paint(s.info));
  paint(guardian.get().info);
  return {
    el: p.el,
    refresh: () => void brain.guardian().then(setGuardian, () => undefined),
  };
}
