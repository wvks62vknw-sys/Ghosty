/**
 * The built-in starter library: reference knowledge Ghosty has from day one, searched the
 * same way as the owner's own books and documents. Add a document by appending to one of
 * the lists (or a new file). Changing any text re-indexes the starter library automatically.
 */
import { AI } from './ai';
import { CS } from './cs';
import { MATH } from './math';
import { PRACTICE } from './practice';
import type { StarterDoc } from './types';

export type { StarterDoc };

export const STARTER: StarterDoc[] = [...CS, ...MATH, ...AI, ...PRACTICE];
