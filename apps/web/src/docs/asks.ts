/**
 * The chat's words for DOCUMENTS (BRIEF-REST-E part 2), read with no model: "my documents", "new document", "read a
 * document", "translate my letter into Urdu", "transliterate it". Writing ("write a letter to my landlord") is the
 * brain's, in the ordinary chat; the phone offers the reply laid out as a document afterwards (docs/ask.ts). Pure.
 */
import { languageAsked } from './model';

export interface DocsAsk {
  what: 'list' | 'new' | 'open' | 'translate' | 'letters';
  language?: string;
}

export function docsAsked(text: string): DocsAsk | null {
  const t = text.trim().replace(/[.!?]+$/, '');
  if (/^(?:open |show )?(?:me )?(?:my )?(?:documents?|docs)$|^(?:open )?(?:the )?document (?:reader|writer|editor)$/i.test(t)) return { what: 'list' };
  if (/^(?:new|start a|make a(?: new)?|write a(?: new)?) (?:blank )?document$/i.test(t)) return { what: 'new' };
  if (/^(?:read|open) (?:a|my|this) (?:document|file|pdf|word (?:file|document)|e-?book)(?: (?:to|for) me)?$/i.test(t)) return { what: 'open' };
  const tr = /^translate (?:this|the|my) (?:document|letter|doc|file)\b/i.test(t) ? languageAsked(t) : null;
  if (tr) return { what: 'translate', language: tr };
  if (/^(?:transliterate|romani[sz]e)(?: (?:this|it|the|my) (?:document|letter|doc))?$/i.test(t) || /^(?:put|write) (?:this|it|my (?:document|letter)) in (?:latin|english) letters$/i.test(t)) return { what: 'letters' };
  return null;
}
