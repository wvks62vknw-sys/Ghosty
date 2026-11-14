/**
 * The chat's words for DOCUMENTS (BRIEF-REST-E part 2), read with no model: "my documents", "new document", "read a
 * document", "translate my letter into Urdu", "transliterate it". Writing ("write a letter to my landlord") is the
 * brain's, in the ordinary chat; the phone offers the reply laid out as a document afterwards (docs/ask.ts). Pure.
 */
import { languageAsked } from './model';

export interface DocsAsk {
  what: 'list' | 'new' | 'open' | 'translate' | 'letters' | 'scan' | 'receipt' | 'fill' | 'merge' | 'comments' | 'outline';
  language?: string;
}

/**
 * [editors.s3] Paper into a document or a spreadsheet row: "scan this letter into a document", "turn this letter into a document I can edit",
 * "scan a receipt into my spreadsheet", "add this receipt to my spreadsheet".
 */
export function paperAsked(text: string): DocsAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '').replace(/^(?:please |ghosty,? |can you |could you )+/i, '');
  if (/^(?:scan|put|add|turn|copy|read)\b.*\breceipts?\b.*\b(?:spreadsheet|sheet|receipts sheet|excel)\b/i.test(t) || /^receipts? (?:to|into) (?:a |my )?(?:spreadsheet|sheet)$/i.test(t)) return { what: 'receipt' };
  if (/^(?:scan|turn|put|make|read|type up|copy)\b.*\b(?:letter|page|paper|document|form|notes?|this)\b.*\b(?:into|to|as)\s+(?:a |an |my )?(?:editable |word )?(?:document|doc|word document)\b/i.test(t) || /^scan (?:a |this )?(?:letter|page|paper) to edit$/i.test(t)) return { what: 'scan' };
  return null;
}

/** [editors.s12] "fill in a PDF form", "sign this PDF", "fill and sign a form". */
export function fillAsked(text: string): boolean {
  const t = text.trim().replace(/[.!?]+$/, '').replace(/^(?:please |ghosty,? |can you |could you |help me |i need to |i want to )+/i, '');
  return /^(?:fill (?:in |out )?(?:and sign )?|sign )(?:a |an |the |this |my )?(?:pdf(?: form)?|form(?: in pdf)?|pdf document)(?: and sign it)?$/i.test(t) || /^(?:fill|sign) (?:a |this )?(?:pdf|form) without printing(?: it)?$/i.test(t);
}

/** [editors.s2] "mail merge", "a copy of this letter for everyone in my spreadsheet". */
export function mergeAsked(text: string): boolean {
  const t = text.trim().replace(/[.!?]+$/, '').replace(/^(?:please |ghosty,? |can you |could you |i want to |help me )+/i, '');
  return /^(?:do |start |open )?(?:a )?mail ?merge(?: (?:my|this|the) letter)?(?: (?:from|with) (?:my |a )?spreadsheet)?$/i.test(t) || /^(?:make|send out|print|do) (?:a copy of )?(?:this|my|the) letter (?:for|to) (?:everyone|every(?: one| name| person| row)|each (?:name|person|row)) (?:in|on|from) (?:my|the|a) (?:spreadsheet|sheet|list)$/i.test(t);
}

/** [editors.u1] "show the comments on my document", "comment on my letter", "my document's comments". */
export function commentsAsked(text: string): boolean {
  const t = text.trim().replace(/[.!?]+$/, '').replace(/^(?:please |ghosty,? |can you |could you |i want to |let me )+/i, '');
  return /^(?:show |open |read |see )?(?:me )?(?:the |my )?comments (?:on|in) (?:my|the|this) (?:document|letter|doc)$/i.test(t) || /^(?:my|the) (?:document|letter)['’]s comments$/i.test(t) || /^(?:add a |leave a )?comment on (?:my|the|this) (?:document|letter|doc)$/i.test(t);
}

/** [editors.u13] "the outline of my document", "move a section in my document". */
export function outlineAsked(text: string): boolean {
  const t = text.trim().replace(/[.!?]+$/, '').replace(/^(?:please |ghosty,? |can you |could you |i want to |let me )+/i, '');
  return /^(?:show |open )?(?:me )?(?:the )?(?:outline|contents|headings) (?:of|in) (?:my|the|this) (?:document|letter|doc|essay|report)$/i.test(t) || /^(?:move|reorder|rearrange) (?:a |the )?sections? (?:of|in) (?:my|the|this) (?:document|letter|doc|essay|report)$/i.test(t);
}

export function docsAsked(text: string): DocsAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '');
  const paper = paperAsked(t);
  if (paper) return paper;
  if (fillAsked(t)) return { what: 'fill' };
  if (mergeAsked(t)) return { what: 'merge' };
  if (commentsAsked(t)) return { what: 'comments' };
  if (outlineAsked(t)) return { what: 'outline' };
  if (/^(?:open |show )?(?:me )?(?:my )?(?:documents?|docs)$|^(?:open )?(?:the )?document (?:reader|writer|editor)$/i.test(t)) return { what: 'list' };
  if (/^(?:new|start a|make a(?: new)?|write a(?: new)?) (?:blank )?document$/i.test(t)) return { what: 'new' };
  if (/^(?:read|open) (?:a|my|this) (?:document|file|pdf|word (?:file|document)|e-?book)(?: (?:to|for) me)?$/i.test(t)) return { what: 'open' };
  const tr = /^translate (?:this|the|my) (?:document|letter|doc|file)\b/i.test(t) ? languageAsked(t) : null;
  if (tr) return { what: 'translate', language: tr };
  if (/^(?:transliterate|romani[sz]e)(?: (?:this|it|the|my) (?:document|letter|doc))?$/i.test(t) || /^(?:put|write) (?:this|it|my (?:document|letter)) in (?:latin|english) letters$/i.test(t)) return { what: 'letters' };
  return null;
}
