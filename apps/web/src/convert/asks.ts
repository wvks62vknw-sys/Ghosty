/**
 * The chat's words for the converter (BRIEF-REST-E part 1), read with no model: "convert this to PDF", "make a QR code",
 * "file converter", "take the location out of my photo". Pure, so the phrase table (assistant/phrases.ts) and the
 * catalogue's test read them too.
 */
import { CONVERSIONS } from './list';

/** Which tool or conversion his words mean (an empty object: the sheet itself), or null when they mean none. */
export function convertAsked(text: string): { tool?: string; conversion?: string; to?: string } | null {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, '');
  if (/^(?:make|create|generate)(?: me)? an? qr(?: code)?\b/.test(t) || /^qr code (?:for|of)\b/.test(t)) return { tool: 'qr-make' };
  if (/^(?:read|scan) (?:this|a|the) (?:qr(?: code)?|barcode)$/.test(t)) return { conversion: 'code-read' };
  if (/^(?:open (?:the )?)?(?:file |format )?convert(?:er|or)$|^convert (?:a|my|some) files?$|^(?:open )?(?:the )?converter$/.test(t)) return {};
  if (/^(?:paste|convert) a table(?: to csv)?$/.test(t)) return { tool: 'table-csv' };
  if (/^record (?:a )?wav$|^make a recording$/.test(t)) return { tool: 'record-wav' };
  const m = /^(?:please )?convert (?:this|it|that|these|them|my (?:photos?|pictures?|files?|documents?|pdfs?))(?: (?:in)?to| into| as)? (?:an? )?(pdf|jpe?g|png|webp|word(?: document)?|docx|excel|xlsx|spreadsheet|csv|json|text|txt|markdown|html|web page|wav|mp3)$/.exec(t);
  if (m) {
    const to = m[1]!.replace(/^jpeg$/, 'jpg').replace(/^word(?: document)?$/, 'docx').replace(/^(?:excel|spreadsheet)$/, 'xlsx').replace(/^text$/, 'txt').replace(/^web page$/, 'html');
    const c = CONVERSIONS.find((x) => x.to === to && x.from.length);
    return c ? { conversion: c.id, to } : { to };
  }
  if (/^(?:strip|remove|take(?: out)?) (?:the )?(?:location|gps|where it was taken)(?: data)?(?: (?:out )?(?:of|from) (?:this|my|a) (?:photo|picture)s?)?(?: out)?$/.test(t)) return { conversion: 'img-strip' };
  if (/^(?:compress|shrink) (?:this|my|a) (?:photo|picture|image)s?$/.test(t)) return { conversion: 'img-compress' };
  return null;
}
