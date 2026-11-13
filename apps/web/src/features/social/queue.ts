/**
 * [tabs] The SOCIAL screen's own pages (BRIEF-TABS 2): THE QUEUE — every draft for his accounts still waiting for his APPROVE,
 * drawn by the chat's own draft card (features/links/drafts.ts: APPROVE · EDIT · NO, nothing goes out without APPROVE) — and
 * what went out today, from the brain's record (GET /api/social). The accounts themselves are LINKS' own panels
 * (features/links/social.ts) and FATHER AND THE ORIGIN its own page (features/me/origin.ts): the screen shows those as they are.
 */
import { ACCOUNTS, accountName, draftCard, type Account } from '../../../../../packages/shared/src/social';
import { brain, type SocialInfo } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { draftEl } from '../links/drafts';
import { COMPOSE_EMPTY, COMPOSE_KEY, COMPOSE_NONE, COMPOSE_NOTE, lengthWords, queueNote, QUEUE_ERROR, QUEUE_LOADING } from './words';
import { button, toast } from '../../ui/components';
import { sayError } from '../../ui/hisWords';
import { phrases } from '../lifeui';

/** One read of the brain shared by the pages shown together (the queue and what went out). */
let held: { at: number; info: Promise<SocialInfo | null> } | null = null;
export function socialInfo(fresh = false): Promise<SocialInfo | null> {
  if (!fresh && held && Date.now() - held.at < 3000) return held.info;
  held = { at: Date.now(), info: brain.social().catch(() => null) };
  return held.info;
}

/** The drafts still waiting for his APPROVE (or a failed send that waits again), across his accounts. */
export const waiting = (info: SocialInfo | null) => (info?.drafts ?? []).filter((d) => (d.state === 'waiting' || d.state === 'failed') && Date.now() <= d.expires);

/** THE QUEUE: each waiting draft as the chat draws it, newest first. */
export function queueScreen(): { el: HTMLElement; stop(): void } {
  const list = h('div.pkcol.socq', { 'aria-live': 'polite' });
  /* state: social.queue loading */
  const note = h('p.pknote', QUEUE_LOADING);
  let gone = false;
  const paint = async (fresh = false) => {
    const info = await socialInfo(fresh);
    if (gone) return;
    const w = waiting(info).sort((a, b) => b.at - a.at);
    /* state: social.queue offline */
    /* state: social.queue empty */
    /* state: social.queue error */
    note.textContent = !info ? QUEUE_ERROR : queueNote(w.length);
    clear(list, ...w.map((d) => draftEl(draftCard(d), () => void paint(true))));
    paintCompose(info);
  };
  // WRITE A POST: a box for his own words, to one of his linked accounts. It makes a DRAFT (POST /social/draft), never a post:
  // the draft shows in the queue above with APPROVE · EDIT · NO, and only his APPROVE sends it.
  const compose = h('div.pkcol.soccompose', { 'aria-label': 'Write a post' });
  let to: Account | null = null;
  const box = h('textarea', { rows: '4', placeholder: 'What do you want to post?', 'aria-label': 'Your post', maxlength: '4096' });
  const count = h('small.pknote.soccount', { 'aria-live': 'polite' });
  const recount = () => {
    const a = ACCOUNTS.find((x) => x.id === to);
    count.textContent = a ? lengthWords(box.value.trim().length, a.max, a.name) : '';
    count.classList.toggle('bad', !!a && box.value.trim().length > a.max);
  };
  box.addEventListener('input', recount);
  const paintCompose = (info: SocialInfo | null) => {
    const linked = (info?.accounts ?? []).filter((a) => a.who);
    if (!info) return void clear(compose);
    if (!linked.length) return void clear(compose, h('b', 'Write a post'), h('p.pknote', COMPOSE_NONE));
    if (!to || !linked.some((a) => a.id === to)) to = linked[0]!.id;
    const keys = linked.map((a) => {
      const b = button(accountName(a.id), () => {
        to = a.id;
        paintCompose(info);
      }, to === a.id ? 'on' : '');
      b.setAttribute('aria-pressed', String(to === a.id));
      return b;
    });
    const make = button(COMPOSE_KEY, async (b) => {
      const text = box.value.trim();
      if (!text || !to) return toast(COMPOSE_EMPTY, 'warn');
      b.disabled = true;
      try {
        const r = await brain.socialDraft({ account: to, text, from: 'phone' });
        if (r.error) toast(r.error, 'warn');
        else {
          box.value = '';
          toast('Draft made. It waits above for your APPROVE.', 'ok');
          await paint(true);
        }
      } catch (e) {
        toast(sayError(e, 'make the draft'), 'bad');
      }
      b.disabled = false;
      recount();
    }, 'on');
    clear(compose, h('b', 'Write a post'), h('div.keyrow.wrapit', { role: 'group', 'aria-label': 'Which account' }, ...keys), box, count, h('p.pknote', COMPOSE_NOTE), h('div.keyrow', make));
    recount();
  };
  void paint();
  return { el: h('div.pkcol', note, list, compose, phrases(['post that to Bluesky', 'who made you?'])), stop: () => (gone = true) };
}

/** What went out today: each post, follow or unfollow with its account, its time and its link. */
export function sentScreen(): { el: HTMLElement; stop(): void } {
  const list = h('div.pkcol', { role: 'list', 'aria-label': 'Sent today' });
  const note = h('p.pknote', 'Reading what went out…');
  let gone = false;
  void socialInfo().then((info) => {
    if (gone) return;
    const sent = [...(info?.sent ?? [])].sort((a, b) => b.at - a.at);
    note.textContent = !info ? 'I can’t reach my brain right now.' : sent.length ? 'Sent today, each one after your APPROVE:' : 'Nothing sent today.';
    clear(list, ...sent.map((s) => h('div.pkperson', { role: 'listitem' },
      h('b', { dataset: { case: 'keep' } }, s.kind === 'post' ? s.text : `${s.kind === 'follow' ? 'Followed' : 'Unfollowed'} ${s.who ?? s.text}`),
      h('span.pklab', `${accountName(s.account)} · ${fmt.ago(s.at)}`),
      s.link ? h('a.lnk', { href: s.link, target: '_blank', rel: 'noopener', 'aria-label': `Open it on ${accountName(s.account)}` }, 'Open it') : null,
    )));
  });
  return { el: h('div.pkcol', note, list), stop: () => (gone = true) };
}
