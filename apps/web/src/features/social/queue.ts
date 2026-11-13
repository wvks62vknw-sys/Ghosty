/**
 * [tabs] The SOCIAL screen's own pages (BRIEF-TABS 2): THE QUEUE — every draft for his accounts still waiting for his APPROVE,
 * drawn by the chat's own draft card (features/links/drafts.ts: APPROVE · EDIT · NO, nothing goes out without APPROVE) — and
 * what went out today, from the brain's record (GET /api/social). The accounts themselves are LINKS' own panels
 * (features/links/social.ts) and FATHER AND THE ORIGIN its own page (features/me/origin.ts): the screen shows those as they are.
 */
import { accountName, draftCard } from '../../../../../packages/shared/src/social';
import { brain, type SocialInfo } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { draftEl } from '../links/drafts';
import { queueNote, QUEUE_ERROR, QUEUE_LOADING } from './words';
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
  };
  void paint();
  return { el: h('div.pkcol', note, list, phrases(['post that to Bluesky', 'who made you?'])), stop: () => (gone = true) };
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
