/**
 * THE `document` TOOL (BRIEF-KERNEL-2 item 2): the brain reads, and proposes changes to, the ONE document open on his phone
 * (DOCUMENTS). The document is the turn's data (packages/shared/src/opendoc.ts: the phone sends its numbered paragraphs after his
 * message, marked as data), read back here from this turn's stored message; the brain keeps no copy and reaches no other document.
 *   read    the text and the outline (the headings, by paragraph number).
 *   edit    replace a numbered paragraph, or a quoted passage inside one, with new words.
 *   append  add paragraphs after the last one.
 * An edit and an append are PROPOSALS: nothing is applied here (the brain has no way to). The phone shows each as a marked change
 * in the editor, the old words struck and the new beside them; his tap on ACCEPT applies it, REJECT leaves the words as they were
 * (the approval shape of appbuild.ts appApproval: proposed, shown, his tap decides). Nothing else of his is touched.
 */
import type { ChatTurn } from '../../../../packages/shared/src/protocol';
import { parseOpenDoc, type OpenDoc } from '../../../../packages/shared/src/opendoc';
import type { Tool, ToolContext } from './types';

const NONE = 'No document is open on his phone right now (or this message carried none). Tell him to open it in DOCUMENTS first; you cannot reach any other document.';

/** The document the owner has open: from his latest message (a stale one from an earlier message is not trusted). */
async function openDocument(ctx: ToolContext): Promise<OpenDoc | null> {
  const turns = (await ctx.storage.get<ChatTurn[]>('turns').catch(() => undefined)) ?? [];
  const last = [...turns].reverse().find((t) => t.role === 'user');
  return last ? parseOpenDoc(last.text) : null;
}

const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

function outline(d: OpenDoc): string {
  const heads = d.paras.filter((p) => p.level);
  return heads.length ? heads.map((p) => `${'  '.repeat(p.level - 1)}[${p.n}] ${flat(p.text)}`).join('\n') : '(no headings)';
}

export const documentTools: Tool[] = [
  {
    name: 'document',
    description:
      "The ONE document open on his phone (Documents), only that one. read: its text by paragraph number and its outline. edit: give paragraph (a number) or quote (a passage inside one) and text, the new words; append: text to add at the end. Edits and appends are proposals: he sees a marked change and taps ACCEPT or REJECT; nothing changes until he does.",
    parameters: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['read', 'edit', 'append'] },
        paragraph: { type: 'number', description: 'edit: the paragraph number, as in read' },
        quote: { type: 'string', description: 'edit: a passage inside one paragraph, exactly as written, instead of a number' },
        text: { type: 'string', description: 'edit: the new words for that paragraph or passage; append: the paragraphs to add (a blank line between them)' },
      },
      required: ['op'],
    },
    risk: 'auto',
    pure: (a) => a.op === 'read',
    async run(a, ctx) {
      const op = String(a.op ?? '');
      if (!['read', 'edit', 'append'].includes(op)) throw new Error('op is read, edit or append');
      const d = await openDocument(ctx);
      if (!d) return NONE;
      if (op === 'read') {
        return [`"${d.title}": ${d.paras.length + d.more} paragraphs.`, 'OUTLINE:', outline(d), 'TEXT:', ...d.paras.map((p) => `[${p.n}] ${p.level ? `${'#'.repeat(p.level)} ` : ''}${p.text.replace(/\n/g, ' / ')}`), d.more ? `(${d.more} more paragraphs were not sent with this message.)` : ''].filter(Boolean).join('\n');
      }
      const words = typeof a.text === 'string' ? a.text.replace(/\r/g, '').trim() : '';
      if (!words) throw new Error('missing "text": the new words');
      if (op === 'append') {
        ctx.emit({ t: 'client', name: 'document', args: { op: 'append', text: words.slice(0, 6000), title: d.title } });
        return `Proposed to him as a marked addition at the end of "${d.title}". NOTHING is changed until he taps ACCEPT in the editor; tell him it is there to accept or reject.`;
      }
      let p = typeof a.paragraph === 'number' && Number.isFinite(a.paragraph) ? d.paras.find((x) => x.n === Math.round(a.paragraph as number)) : undefined;
      const quote = typeof a.quote === 'string' ? a.quote.trim() : '';
      let now = words;
      if (!p && quote) {
        const hits = d.paras.filter((x) => x.text.includes(quote));
        if (!hits.length) throw new Error('that passage is not in the document: read it again and quote it exactly');
        if (hits.length > 1 || hits[0]!.text.split(quote).length > 2) throw new Error('that passage is in more than one place: quote more of it, or give the paragraph number');
        p = hits[0]!;
        now = p.text.replace(quote, () => words);
      } else if (!p) throw new Error(`no such paragraph: give paragraph (1 to ${d.paras.length}) or quote`);
      else if (quote && p.text.includes(quote) && p.text.split(quote).length === 2) now = p.text.replace(quote, () => words);
      if (flat(now) === flat(p.text)) return 'That is how it already reads: no change proposed.';
      ctx.emit({ t: 'client', name: 'document', args: { op: 'edit', paragraph: p.n, old: p.text, text: now.slice(0, 6000), title: d.title } });
      return `Proposed to him as a marked change to paragraph ${p.n} of "${d.title}" (the old words struck, the new beside them). NOTHING is changed until he taps ACCEPT in the editor; REJECT leaves it as it was. Tell him it is there.`;
    },
  },
];

export const DOCUMENT_ABOUT = 'You can read and change the one document he has open in DOCUMENTS (document: read, edit, append); a change is only proposed, marked for him to accept or reject. It comes with his message.';
export const DOCUMENT_WHEN = /\b(documents?|paragraphs?|proofread|rewrite|reword|rephrase|shorter|longer|tighten|my letter|this letter|the letter|essay)\b/i;
