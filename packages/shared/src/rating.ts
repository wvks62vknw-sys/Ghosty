/**
 * A gadget's rating plate (or the owner's words about it): the make and the model number. Shared by the phone (Lens
 * READ offers FIND THE MANUAL? when the text read has both) and the brain (integrations/manuals.ts finds the maker's
 * own manual with them). Nothing is looked up here.
 */

/** Makes Ghosty knows the manual sites of (the brain's MAKERS has their hosts), as a word in the text → the name. */
export const MAKE_NAMES: Record<string, string> = {
  bosch: 'Bosch', siemens: 'Siemens', neff: 'Neff', samsung: 'Samsung', lg: 'LG', sony: 'Sony', panasonic: 'Panasonic', philips: 'Philips',
  whirlpool: 'Whirlpool', hotpoint: 'Hotpoint', indesit: 'Indesit', beko: 'Beko', aeg: 'AEG', electrolux: 'Electrolux', zanussi: 'Zanussi',
  miele: 'Miele', hoover: 'Hoover', candy: 'Candy', smeg: 'Smeg', dyson: 'Dyson', delonghi: "De'Longhi", kenwood: 'Kenwood', haier: 'Haier',
  hisense: 'Hisense', sharp: 'Sharp', worcester: 'Worcester Bosch', vaillant: 'Vaillant', ideal: 'Ideal', baxi: 'Baxi', sonos: 'Sonos',
  yamaha: 'Yamaha', canon: 'Canon', epson: 'Epson', hp: 'HP', brother: 'Brother', tefal: 'Tefal', russell: 'Russell Hobbs',
  morphy: 'Morphy Richards', ninja: 'Ninja',
};
const MAKE_WORDS: Record<string, string> = { russell: 'russell hobbs', morphy: 'morphy richards', delonghi: "de'?\\s?longhi", worcester: 'worcester(?: bosch)?' };

/** The make named in the text (its key in MAKE_NAMES), or ''. "Worcester Bosch" is Worcester, not Bosch. */
export function makeIn(text: string): string {
  const t = String(text ?? '').toLowerCase();
  if (/\bworcester\b/.test(t)) return 'worcester';
  return Object.keys(MAKE_NAMES).find((k) => new RegExp(`\\b${MAKE_WORDS[k] ?? k}\\b`).test(t)) ?? '';
}

/** A model number: letters and digits together, five or more (SMS24AW01G, WAN28281GB, KD-55X85J), not a plain word or year. */
export function modelIn(text: string): string {
  const cands = String(text ?? '').toUpperCase().match(/\b[A-Z0-9][A-Z0-9-/.]{3,20}[A-Z0-9]\b/g) ?? [];
  const ok = cands.filter((c) => /[A-Z]/.test(c) && /\d/.test(c) && !/^E-?NR/.test(c) && !/^\d+[A-Z]{1,2}$/.test(c) && !/^\d+(?:[./-]\d+)*(?:V|HZ|W|KW|MM|CM|KG)$/.test(c) && c.replace(/[-/.]/g, '').length >= 5);
  // the longest is usually the model; a plate's "SMS24AW01G/29" keeps the part before the slash (the variant code is not searched)
  const best = ok.sort((a, b) => b.length - a.length)[0] ?? '';
  return best.replace(/\/\d{1,3}$/, '');
}

/** "Bosch SMS24AW01G" when the text has a known make and a model number (a rating plate read in Lens READ), else null. */
export function ratingPlate(text: string): string | null {
  const make = makeIn(text);
  const model = modelIn(text);
  return make && model ? `${MAKE_NAMES[make]} ${model}` : null;
}
