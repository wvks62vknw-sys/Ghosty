/**
 * COMMENTS ON WORDS (NEXT ROUND, editors.u1): a comment hangs on the words he chose in a paragraph (its quote, and where they were), with
 * replies (his and Ghosty's), resolved or open. It finds its words again after edits by its quote, nearest where they were; words that are
 * gone leave it "on words no longer in the document". Kept in the document, so it is saved, undone and reopened with it; written into a
 * Word file as Word comments and read back from one (docx.ts, docxread.ts). ASK GHOSTY sends the one sentence, the comment and its
 * replies as the message (docs/ask.ts askBrain, as the documents' other asks do). Pure.
 */
import { textOf, type Block, type Doc } from './model';

export interface Reply {
  text: string;
  at: number;
  who: 'me' | 'ghosty' | string;
}
export interface Comment {
  id: string;
  block: string;
  start: number;
  end: number;
  quote: string;
  text: string;
  at: number;
  replies: Reply[];
  resolved?: boolean;
  /** Who wrote it, when it came from a Word file ("Sam Khan"). */
  author?: string;
}

let seq = 0;
export const commentId = (): string => `c${Date.now().toString(36)}${(++seq).toString(36)}`;

/** Where a comment's words are now: its own place if the words are still there, else the nearest copy of its quote (its paragraph first). */
export function anchorOf(d: Doc, c: Comment): { block: string; start: number; end: number } | null {
  const b = d.blocks.find((x) => x.id === c.block);
  const near = (blk: Block, from: number): number => {
    const t = textOf(blk);
    if (t.slice(c.start, c.end) === c.quote && blk.id === c.block) return c.start;
    let best = -1;
    for (let i = t.indexOf(c.quote); i >= 0; i = t.indexOf(c.quote, i + 1)) if (best < 0 || Math.abs(i - from) < Math.abs(best - from)) best = i;
    return best;
  };
  if (!c.quote) return null;
  if (b) {
    const i = near(b, c.start);
    if (i >= 0) return { block: b.id, start: i, end: i + c.quote.length };
  }
  for (const x of d.blocks) {
    if (x.id === c.block) continue;
    const i = near(x, 0);
    if (i >= 0) return { block: x.id, start: i, end: i + c.quote.length };
  }
  return null;
}

export const commentsOf = (d: Doc): Comment[] => d.comments ?? [];
const withComments = (d: Doc, list: Comment[]): Doc => ({ ...d, comments: list.length ? list : undefined });

export function addComment(d: Doc, block: string, start: number, end: number, text: string, at = Date.now()): { doc: Doc; id: string } | null {
  const b = d.blocks.find((x) => x.id === block);
  if (!b || end <= start || !text.trim()) return null;
  const quote = textOf(b).slice(start, end);
  if (!quote.trim()) return null;
  const id = commentId();
  return { doc: withComments(d, [...commentsOf(d), { id, block, start, end, quote, text: text.trim(), at, replies: [] }]), id };
}
export const replyTo = (d: Doc, id: string, text: string, who: Reply['who'] = 'me', at = Date.now()): Doc =>
  withComments(d, commentsOf(d).map((c) => (c.id === id ? { ...c, replies: [...c.replies, { text: text.trim(), at, who }] } : c)));
export const resolveComment = (d: Doc, id: string, on = true): Doc => withComments(d, commentsOf(d).map((c) => (c.id === id ? { ...c, resolved: on ? true : undefined } : c)));
export const removeComment = (d: Doc, id: string): Doc => withComments(d, commentsOf(d).filter((c) => c.id !== id));

/** The sentence the words sit in (from the full stop before them to the one after), for ASK GHOSTY. */
export function sentenceAround(text: string, start: number, end: number): string {
  const before = text.slice(0, start);
  const from = Math.max(before.lastIndexOf('. '), before.lastIndexOf('? '), before.lastIndexOf('! '), before.lastIndexOf('\n'));
  const rest = text.slice(end);
  const m = /[.!?](?=\s|$)|\n/.exec(rest);
  const to = m ? end + m.index + (m[0] === '\n' ? 0 : 1) : text.length;
  return text.slice(from < 0 ? 0 : from + (text[from] === '\n' ? 1 : 2), to).trim();
}

/** ASK GHOSTY's message: the one sentence and the words chosen, the comment and its replies; the answer is a reply, never an edit. */
export function askMessage(sentence: string, quote: string, c: Comment): string {
  const thread = [`Comment: ${c.text}`, ...c.replies.map((r) => `${r.who === 'ghosty' ? 'Ghosty' : r.who === 'me' ? 'Me' : r.who}: ${r.text}`)].join('\n');
  return `I left a comment on one sentence of my document. Answer the comment about that sentence only, in a few plain lines, as a reply in the comment thread (do not rewrite the document).\n\nThe sentence: "${sentence}"\nThe words the comment is on: "${quote}"\n${thread}`;
}

// ---------------------------------------------------------------- Word: a comment's paragraphs out and back in

/** A comment as Word comment paragraphs: its words, then each reply as "↳ Who: words"; a resolved one starts "[Resolved]". */
export function wordParas(c: Comment, me = 'Me'): string[] {
  return [`${c.resolved ? '[Resolved] ' : ''}${c.text}`, ...c.replies.map((r) => `↳ ${r.who === 'ghosty' ? 'Ghosty' : r.who === 'me' ? me : r.who}: ${r.text}`)];
}
/** A Word comment's paragraphs read back: the first is its words (and whether resolved), the rest that start "↳ Who:" are replies. */
export function fromWordParas(paras: string[], me = 'Me'): { text: string; resolved: boolean; replies: Reply[] } {
  const [head = '', ...rest] = paras;
  const resolved = /^\[Resolved\]\s*/.test(head);
  const replies: Reply[] = [];
  let text = head.replace(/^\[Resolved\]\s*/, '');
  for (const p of rest) {
    const m = /^↳\s*([^:]{1,40}):\s*([\s\S]*)$/.exec(p);
    if (m) replies.push({ text: m[2]!.trim(), at: 0, who: m[1] === 'Ghosty' ? 'ghosty' : m[1] === me || m[1] === 'Me' ? 'me' : m[1]!.trim() });
    else if (replies.length) replies[replies.length - 1]!.text += `\n${p}`;
    else text += `\n${p}`;
  }
  return { text: text.trim(), resolved, replies };
}
