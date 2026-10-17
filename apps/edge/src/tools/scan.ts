/**
 * SCAN's chat tools: what a barcode number is (lookup_barcode) and text in another language
 * (translate_text), so "what is 3017620422003?" or "translate this into Spanish" work in the
 * chat as well as in the Lens. Both look things up and change nothing.
 */
import { LANGUAGES } from '../../../../packages/shared/src/scan';
import { LookupError, lookupBarcode, renderLookup, translate } from '../integrations/lookup';
import { asData } from '../kernel/permissions';
import { arg, type Tool } from './types';
import { search } from './web';

export const scanTools: Tool[] = [
  {
    name: 'lookup_barcode',
    description: 'What a barcode number is: a book (ISBN, from Open Library: title, authors, year, description) or a product (Open Food Facts and its sister databases: name, brand, Nutri-Score, nutrition, allergens, ingredients), with a web search when no database knows it.',
    parameters: { type: 'object', properties: { code: { type: 'string', description: 'the digits under the barcode (EAN-8/13, UPC-A, ISBN-10/13)' } }, required: ['code'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      ctx.progress?.('looking it up…');
      const r = await lookupBarcode(arg.str(a, 'code'), { search: (q) => search(q, ctx) });
      return asData(r.source, renderLookup(r));
    },
  },
  {
    name: 'translate_text',
    description: `Translate text into another language with the free translator (Workers AI). Languages: ${LANGUAGES.map((l) => l.name).join(', ')}.`,
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'the text to translate (up to 4,000 characters)' },
        to: { type: 'string', description: 'the language to translate into (a name or a code), default English' },
        from: { type: 'string', description: 'the language it is in, when known' },
      },
      required: ['text'],
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const text = arg.str(a, 'text');
      const to = arg.str(a, 'to', false) || 'en';
      // No chat model here: without Workers AI (or when it fails, e.g. the day's allowance is used) the model calling this is the translator, and is told so.
      const yourself = `The free translator (Workers AI) is not available here: translate it yourself into ${to}, keeping the meaning exactly.`;
      if (!ctx.env.AI) return yourself;
      let r;
      try {
        r = await translate(text, to, { ai: ctx.env.AI, from: arg.str(a, 'from', false) });
      } catch (e) {
        // A request problem (nothing to translate, a language it does not offer) is said as it is.
        if (e instanceof LookupError && e.status !== 503) throw e;
        return yourself;
      }
      if (r.engine === 'none') return `The text is already in ${r.to}.`;
      return asData('the translator', `Translation (${r.from || '?'} → ${r.to}):\n${r.text}`);
    },
  },
];
