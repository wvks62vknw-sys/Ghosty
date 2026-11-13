/**
 * CONVERT'S WORDS (BRIEF-QUALITY-MAKE): the lines the converter says in his voice, in one place and with no DOM, so the spec reads the very
 * words the page is built from. Nothing is uploaded; that line stands as the screen has it.
 */
import { unitsExplain } from '../../convert/units';

/** UNITS with nothing typed, and with words that are not a unit question at all. */
export const UNITS_HINT = 'Say it like “3.5 miles in km”, “100 F in C”, “5 ft 10 in cm” or “2 pints in litres”.';

/** UNITS when it could not answer: the unit it did not know named back, or two kinds that cannot be turned into each other. */
export const unitsWhy = (typed: string): string => (typed.trim() ? unitsExplain(typed) ?? UNITS_HINT : UNITS_HINT);

/** A file the converter cannot read: its name back, and what it does know. */
export const unreadable = (name: string): string => `I can’t read “${name}”. I know pictures, PDFs, Word files, tables and sound: pick one of those.`;

/** The chat phrases that open the converter on the phone, listed in one line. */
export const PHRASES = ['file converter', 'make a QR code', '3.5 miles in km'];
