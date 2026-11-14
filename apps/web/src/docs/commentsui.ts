/**
 * COMMENTS, the panel (NEXT ROUND, editors.u1; a document's COMMENTS key, and WRITE → COMMENT on chosen words): each comment with the
 * words it is on, who wrote it and when, its replies, and REPLY, ASK GHOSTY (the brain answers about that one sentence, as a reply),
 * RESOLVE or REOPEN, SHOW (the words chosen in the page) and DELETE. Resolved ones fold away under SHOW RESOLVED. Every change is a change
 * of the document, so UNDO takes it back and it is kept with the document (docs/comments.ts).
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { sayError } from '../ui/hisWords';
import { addComment, anchorOf, askMessage, commentsOf, removeComment, replyTo, resolveComment, sentenceAround, type Comment } from './comments';
import { textOf, type Doc } from './model';

export interface CommentsHost {
  doc(): Doc;
  change(d: Doc): void;
  say(w: string): void;
  /** The comment's words chosen in the page, scrolled to. */
  show(block: string, start: number, end: number): void;
  ask(message: string): Promise<{ text: string; where: 'brain' | 'phone' }>;
}
/** What the checks read (window.__ghosty.comments). */
export const commentsState = { open: 0, resolved: 0, list: [] as { quote: string; text: string; replies: string[]; resolved: boolean; lost: boolean }[] };
const expose = () => {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.comments = commentsState;
};
const when = (ms: number) => (ms ? new Date(ms).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export function commentsPanel(host: CommentsHost): { el: HTMLElement; paint(): void; startNew(sel: { block: string; start: number; end: number }): void } {
  expose();
  const el = h('div.dccomments');
  const form = h('div.dccmtnew');
  let showResolved = false;
  let draft: { block: string; start: number; end: number } | null = null;
  const asking = new Set<string>();

  const card = (c: Comment): HTMLElement => {
    const d = host.doc();
    const at = anchorOf(d, c);
    const replyIn = h('input', { type: 'text', placeholder: 'Reply', 'aria-label': `Reply to the comment on “${c.quote.slice(0, 30)}”`, autocomplete: 'off', enterKeyHint: 'send' }) as HTMLInputElement;
    const sendReply = () => {
      if (!replyIn.value.trim()) return host.say('Type the reply first.');
      host.change(replyTo(host.doc(), c.id, replyIn.value));
      host.say('Reply added. UNDO takes it back.');
    };
    replyIn.addEventListener('keydown', (e) => e.key === 'Enter' && sendReply());
    const askIt = async () => {
      const now = anchorOf(host.doc(), c);
      if (!now) return host.say('The words this comment is on are no longer in the document, so there is no sentence to ask about.');
      const blk = host.doc().blocks.find((b) => b.id === now.block)!;
      const sentence = sentenceAround(textOf(blk), now.start, now.end);
      asking.add(c.id);
      paint();
      host.say('Asking my brain about that one sentence. Only the sentence and this comment go with the message; its answer comes as a reply.');
      try {
        const r = await host.ask(askMessage(sentence, c.quote, c));
        const words = r.text.trim();
        if (!words) host.say('My brain had nothing to say about it.');
        else {
          host.change(replyTo(host.doc(), c.id, words, 'ghosty'));
          host.say(`Ghosty replied${r.where === 'phone' ? ' (the brain on this phone)' : ''}. UNDO takes the reply back.`);
        }
      } catch (e) {
        host.say(sayError(e, 'ask about it'));
      } finally {
        asking.delete(c.id);
        paint();
      }
    };
    return h(`div.dccmt${c.resolved ? '.done' : ''}` as 'div', { dataset: { id: c.id } },
      h('p.dccmtq', at ? `“${c.quote}”` : `On words no longer in the document: “${c.quote}”`),
      h('p.dccmtt', h('b', c.author ?? 'You'), ` · ${when(c.at)}${c.resolved ? ' · RESOLVED' : ''}`),
      h('p.dccmtw', c.text),
      ...c.replies.map((r) => h(`p.dccmtr${r.who === 'ghosty' ? '.gh' : ''}` as 'p', h('b', r.who === 'ghosty' ? 'Ghosty' : r.who === 'me' ? 'You' : r.who), ` · ${r.text}`)),
      ...(asking.has(c.id) ? [h('p.dcnote', 'Ghosty is reading that sentence…')] : []),
      h('div.dcrow', replyIn, button('REPLY', sendReply)),
      h('div.dcrow',
        ...(at ? [button('SHOW', () => host.show(at.block, at.start, at.end))] : []),
        button('ASK GHOSTY', () => void askIt(), asking.has(c.id) ? 'busy' : ''),
        button(c.resolved ? 'REOPEN' : 'RESOLVE', () => {
          host.change(resolveComment(host.doc(), c.id, !c.resolved));
          host.say(c.resolved ? 'Comment reopened.' : 'Resolved: it folds away under SHOW RESOLVED. UNDO takes it back.');
        }),
        button('DELETE', () => {
          host.change(removeComment(host.doc(), c.id));
          host.say('Comment deleted. UNDO puts it back.');
        }),
      ),
    );
  };

  const paintForm = () => {
    if (!draft) return clear(form);
    const d = host.doc();
    const b = d.blocks.find((x) => x.id === draft!.block);
    const quote = b ? textOf(b).slice(draft.start, draft.end) : '';
    const words = h('input', { type: 'text', placeholder: 'Your comment', 'aria-label': 'Your comment on the chosen words', autocomplete: 'off', enterKeyHint: 'done' }) as HTMLInputElement;
    const add = () => {
      if (!words.value.trim()) return host.say('Type the comment first.');
      const r = draft ? addComment(host.doc(), draft.block, draft.start, draft.end, words.value) : null;
      if (!r) return host.say('Choose the words to comment on first (press and hold, then drag).');
      draft = null;
      host.change(r.doc);
      host.say('Comment added, on those words. It is kept with the document; UNDO takes it back.');
    };
    words.addEventListener('keydown', (e) => e.key === 'Enter' && add());
    clear(form, h('small.cvgh', 'NEW COMMENT'), h('p.dccmtq', `“${quote}”`), h('div.dcrow', words), h('div.dcrow', button('ADD COMMENT', add, 'on'), button('CANCEL', () => {
      draft = null;
      paintForm();
    })));
    requestAnimationFrame(() => words.focus());
  };

  const paint = () => {
    const d = host.doc();
    const all = commentsOf(d);
    const open = all.filter((c) => !c.resolved);
    const done = all.filter((c) => c.resolved);
    commentsState.open = open.length;
    commentsState.resolved = done.length;
    commentsState.list = all.map((c) => ({ quote: c.quote, text: c.text, replies: c.replies.map((r) => `${r.who}: ${r.text}`), resolved: !!c.resolved, lost: !anchorOf(d, c) }));
    clear(el,
      h('small.cvgh', `COMMENTS · ${open.length} OPEN${done.length ? ` · ${done.length} RESOLVED` : ''}`),
      form,
      ...(all.length ? [] : [h('p.dcnote', 'No comments yet: choose some words in the page (press and hold, then drag), then COMMENT in WRITE.')]),
      ...open.map(card),
      ...(done.length ? [button(showResolved ? 'HIDE RESOLVED' : `SHOW RESOLVED (${done.length})`, () => {
        showResolved = !showResolved;
        paint();
      })] : []),
      ...(showResolved ? done.map(card) : []),
      h('small.dcnote', 'Comments stay with the document on this phone, and go into a Word file as Word comments.'),
    );
    paintForm();
  };
  paint();
  return {
    el,
    paint,
    startNew: (sel) => {
      draft = sel;
      paint();
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  };
}
