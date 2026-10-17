/**
 * What the Lens SCAN mode and the brain agree on: the languages TRANSLATE offers, the answer to
 * a barcode lookup, and the small rules about barcode numbers both sides need (a check digit is
 * right, a number is a book's ISBN).
 */

/** Languages the translator offers (codes as Workers AI's m2m100 takes them), English first. */
export const LANGUAGES: readonly { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'ar', name: 'Arabic' },
  { code: 'bn', name: 'Bengali' },
  { code: 'zh', name: 'Chinese' },
  { code: 'cs', name: 'Czech' },
  { code: 'nl', name: 'Dutch' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'fa', name: 'Persian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'so', name: 'Somali' },
  { code: 'es', name: 'Spanish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'cy', name: 'Welsh' },
];

/** A language code from a code or a name ("es", "Spanish", "spanish" → "es"); '' when unknown. */
export function langCode(v: string): string {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return '';
  const hit = LANGUAGES.find((l) => l.code === s || l.name.toLowerCase() === s);
  return hit?.code ?? '';
}

export const langName = (code: string): string => LANGUAGES.find((l) => l.code === code)?.name ?? code;

/** What GET /api/lookup/barcode answers. */
export interface LookupResult {
  code: string;
  kind: 'product' | 'book' | 'unknown';
  /** Where the facts came from ("Open Food Facts", "Open Library", "web search"). */
  source: string;
  /** The credit line the card must show (Open Food Facts data is ODbL). */
  credit?: string;
  title: string;
  brand?: string;
  quantity?: string;
  /** A small picture of the product or the book's cover (https). */
  image?: string;
  /** Nutri-Score and Green-Score, a–e (absent when unknown). */
  nutriscore?: string;
  ecoscore?: string;
  /** Per 100 g: energy (kcal), fat, saturated fat, sugars, salt, protein (g). */
  nutrition?: Partial<Record<'kcal' | 'fat' | 'saturates' | 'sugars' | 'salt' | 'protein', number>>;
  ingredients?: string;
  allergens?: string[];
  categories?: string;
  authors?: string[];
  year?: string;
  publisher?: string;
  pages?: number;
  description?: string;
  /** The page to read more on. */
  url?: string;
  /** Web search hits when no database knew the code. */
  web?: { title: string; url: string; text: string }[];
  note?: string;
}

/** Only digits, as a barcode number is read or typed ("978-0-14-032872-1" → "9780140328721"). */
export const digitsOf = (s: string): string => String(s ?? '').replace(/[\s-]/g, '');

/** True when an EAN-8, UPC-A (12), EAN-13 or GTIN-14 number has the right check digit. */
export function gtinValid(code: string): boolean {
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return false;
  const d = code.split('').map(Number);
  const check = d.pop()!;
  let sum = 0;
  // weights 3,1,3,1… from the digit next to the check digit
  for (let i = d.length - 1, w = 3; i >= 0; i--, w = w === 3 ? 1 : 3) sum += d[i]! * w;
  return (10 - (sum % 10)) % 10 === check;
}

/** True for an ISBN-10 with a right check digit (the last may be X). */
export function isbn10Valid(code: string): boolean {
  if (!/^\d{9}[\dX]$/i.test(code)) return false;
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += (code[i]!.toUpperCase() === 'X' ? 10 : Number(code[i])) * (10 - i);
  return sum % 11 === 0;
}

/** A book's barcode: an EAN-13 in the 978/979 "Bookland" ranges (979-0 is sheet music, not a book), or an ISBN-10. */
export function isIsbn(code: string): boolean {
  const c = digitsOf(code);
  if (c.length === 10) return isbn10Valid(c);
  return c.length === 13 && /^97(8|9[1-9])/.test(c) && gtinValid(c);
}

/** A retail product number a product database may know (EAN-8, UPC-A, EAN-13, GTIN-14). */
export const isProductCode = (code: string): boolean => gtinValid(digitsOf(code));
