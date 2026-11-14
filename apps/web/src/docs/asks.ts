/**
 * The chat's words for DOCUMENTS (BRIEF-REST-E part 2), read with no model: "my documents", "new document", "read a
 * document", "translate my letter into Urdu", "transliterate it". Writing ("write a letter to my landlord") is the
 * brain's, in the ordinary chat; the phone offers the reply laid out as a document afterwards (docs/ask.ts). Pure.
 */
import { languageAsked } from './model';

export interface DocsAsk {
  what: 'list' | 'new' | 'open' | 'translate' | 'letters' | 'scan' | 'receipt';
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

export function docsAsked(text: string): DocsAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '');
  const paper = paperAsked(t);
  if (paper) return paper;
  if (/^(?:open |show )?(?:me )?(?:my )?(?:documents?|docs)$|^(?:open )?(?:the )?document (?:reader|writer|editor)$/i.test(t)) return { what: 'list' };
  if (/^(?:new|start a|make a(?: new)?|write a(?: new)?) (?:blank )?document$/i.test(t)) return { what: 'new' };
  if (/^(?:read|open) (?:a|my|this) (?:document|file|pdf|word (?:file|document)|e-?book)(?: (?:to|for) me)?$/i.test(t)) return { what: 'open' };
  const tr = /^translate (?:this|the|my) (?:document|letter|doc|file)\b/i.test(t) ? languageAsked(t) : null;
  if (tr) return { what: 'translate', language: tr };
  if (/^(?:transliterate|romani[sz]e)(?: (?:this|it|the|my) (?:document|letter|doc))?$/i.test(t) || /^(?:put|write) (?:this|it|my (?:document|letter)) in (?:latin|english) letters$/i.test(t)) return { what: 'letters' };
  return null;
}
