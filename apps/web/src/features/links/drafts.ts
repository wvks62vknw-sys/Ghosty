/**
 * A DRAFT FOR HIS ACCOUNTS in the chat (BRIEF-SOCIAL item 2): the card the brain made by code (packages/shared/src/social.ts
 * draftCard) drawn with the words in full, the account, a picture of his own with its words, the state, and APPROVE · EDIT
 * · NO. APPROVE sends it once (the brain's queue: a second press sends nothing more), EDIT changes the words in a sheet (it
 * stays a draft), NO drops it; a draft is gone after 24 hours. After APPROVE the chat keeps what was done, with WHY under it.
 * Also here: POST THAT? on a line of his own (the musing card) — it makes a draft, never a post.
 */
import { stateWords, accountInfo, graphemes, type Draft } from '../../../../../packages/shared/src/social';
import type { Card } from '../../../../../packages/shared/src/cards';
import { brain } from '../../api/brain';
import { chat, type Entry } from '../../assistant/session';
import { register } from '../../commands/registry';
import { h } from '../../core/dom';
import { button, modal, toast } from '../../ui/components';

/** The chat's entries with this draft's card, given its new card (its state after an answer). */
function patchCard(card: Card): void {
  chat.set((s) => ({ entries: s.entries.map((e) => (e.kind === 'card' && e.card.id === card.id ? { ...e, card } : e)) }));
}

let stamp = 0;
const nextAt = () => (stamp = Math.max(Date.now(), stamp + 1, ((chat.get().entries.at(-1) as { at?: number } | undefined)?.at ?? 0) + 1));

/** What APPROVE did, in the chat: his press, the step that ran (what WHY reads), and what went out. */
function noteSent(d: Draft, said: string): void {
  const where = accountInfo(d.account).name;
  const what = d.kind === 'post' ? `post on ${where}` : `${d.kind} ${d.who ?? ''} on ${where}`;
  const user: Entry = { kind: 'user', text: `APPROVE — ${what}`, at: nextAt() };
  const step: Entry = { kind: 'activity', id: `social-${d.id}`, label: d.kind === 'post' ? `Posted on ${where}` : `${d.kind === 'follow' ? 'Followed' : 'Unfollowed'} on ${where}`, state: 'ok', tool: 'social', args: `${what}: “${(d.kind === 'post' ? d.text : d.who ?? '').slice(0, 80)}”` };
  const reply: Entry = { kind: 'assistant', text: said, at: nextAt(), model: 'Your APPROVE · no AI' };
  chat.set((s) => ({ entries: [...s.entries, user, step, reply].slice(-120) }));
}

async function approve(d: Draft, b: HTMLButtonElement): Promise<void> {
  b.disabled = true;
  try {
    const r = await brain.socialApprove(d.id);
    if (r.card) patchCard(r.card);
    if (r.error) toast(r.error, 'bad');
    else if (r.draft && r.said) {
      noteSent(r.draft, r.said);
      toast(r.said.replace(/: https?:\/\/\S+$/, ''), 'ok');
    }
  } catch (e) {
    toast(`Not sent: ${String((e as Error).message ?? e)}`, 'bad');
  } finally {
    b.disabled = false;
  }
}

async function refuse(d: Draft): Promise<void> {
  try {
    const r = await brain.socialNo(d.id);
    if (r.card) patchCard(r.card);
    toast('Dropped: nothing went out.', 'ok');
  } catch (e) {
    toast(String((e as Error).message ?? e), 'bad');
  }
}

/** EDIT: the words (and a picture's words) in a sheet; SAVE keeps it a draft, waiting for APPROVE. */
function edit(d: Draft): void {
  const max = accountInfo(d.account).max;
  const box = h('textarea.drbox', { rows: '6', 'aria-label': 'The words of the post' }) as HTMLTextAreaElement;
  box.value = d.text;
  const alt = d.image ? (h('input.dralt', { type: 'text', 'aria-label': 'What is in the picture, for anyone who cannot see it' }) as HTMLInputElement) : null;
  if (alt) alt.value = d.image!.alt;
  const count = h('small.drcount', { 'aria-live': 'polite' });
  const paint = () => {
    const n = d.account === 'bluesky' ? graphemes(box.value) : [...box.value].length;
    count.textContent = `${n} / ${max}`;
    count.classList.toggle('over', n > max);
  };
  box.addEventListener('input', paint);
  paint();
  const msg = h('small.note');
  const save = button('SAVE', async (b) => {
    b.disabled = true;
    try {
      const r = await brain.socialEdit(d.id, { text: box.value, ...(alt ? { alt: alt.value } : {}) });
      if (r.error || !r.card) {
        msg.textContent = r.error ?? 'Not saved.';
        return;
      }
      patchCard(r.card);
      m.close();
      toast('Changed: it still waits for your APPROVE.', 'ok');
    } catch (e) {
      msg.textContent = String((e as Error).message ?? e);
    } finally {
      b.disabled = false;
    }
  }, 'on');
  named(save, 'Save the new words (still a draft)');
  const m = modal('Edit the draft', h('div.dredit', box, count, ...(alt ? [h('div.lab', 'THE PICTURE, IN WORDS'), alt] : []), msg, h('div.row', save)));
  setTimeout(() => box.focus(), 50);
}

/** A button VoiceOver reads by what it does. */
const named = (b: HTMLButtonElement, label: string): HTMLButtonElement => (b.setAttribute('aria-label', label), b);

/** The draft's card in the chat: the words in full, the account, its state, and APPROVE · EDIT · NO while it waits. */
export function draftEl(c: Card): HTMLElement {
  const d = c.draft!;
  const live = (d.state === 'waiting' || d.state === 'failed') && Date.now() <= d.expires;
  const where = accountInfo(d.account).name;
  const words = d.kind === 'post' ? d.text : `${d.kind === 'follow' ? 'Follow' : 'Unfollow'} ${d.who ?? ''}`;
  const acts = live
    ? h(
        'div.ccacts.dracts',
        named(button('APPROVE', (b) => void approve(d, b), 'on'), `Approve: ${d.kind === 'post' ? `post this on ${where}` : `${d.kind} on ${where}`}`),
        ...(d.kind === 'post' ? [named(button('EDIT', () => edit(d)), 'Edit the words')] : []),
        named(button('NO', () => void refuse(d), 'warn'), 'No: drop it, nothing goes out'),
      )
    : null;
  for (const b of acts?.querySelectorAll('button') ?? []) {
    b.classList.add('ccbtn');
    b.dataset.case = 'keep';
  }
  return h(
    'article.ccard.draftcard',
    { dataset: { kind: 'draft', id: c.id, state: live ? 'waiting' : d.state === 'waiting' ? 'expired' : d.state, case: 'keep' } },
    h(
      'div.ccbody',
      h('b.cctitle', c.title),
      h('p.drwords', words),
      d.image ? h('figure.drpic', h('img', { src: `/i/${d.image.id}`, alt: d.image.alt, loading: 'lazy' }), h('figcaption', `In words: ${d.image.alt}`)) : null,
      h('small.drstate', { role: 'status' }, stateWords(d)),
      d.link ? h('a.drlink', { href: d.link, target: '_blank', rel: 'noopener noreferrer' }, `OPEN ON ${where.toUpperCase()} ↗`) : null,
      acts,
    ),
  );
}

// POST THAT? on a line of his own (the musing card, BRIEF-SOCIAL item 7): a draft for his Bluesky, never a post
register({
  id: 'social_post_that',
  title: 'Post that (a draft)',
  hidden: true,
  run: async (args) => {
    try {
      const r = await brain.socialDraft({ account: args?.account === 'mastodon' ? 'mastodon' : 'bluesky', text: String(args?.text ?? ''), from: 'musing' });
      if (r.error || !r.card) return void toast(r.error ?? 'No draft made.', 'bad');
      const { postCard } = await import('../core/cards');
      postCard(r.card);
    } catch (e) {
      toast(String((e as Error).message ?? e), 'bad');
    }
  },
});
