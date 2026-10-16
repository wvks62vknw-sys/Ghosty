/**
 * The built-in starter library: reference knowledge Ghosty has from day one, searched the
 * same way as the owner's own books and documents. Add a document by appending to one of
 * the lists (or a new file). Changing any text re-indexes the starter library automatically.
 */
import { FULLSTACK } from '../../knowledge/fullstack';
import { AI } from './ai';
import { CS } from './cs';
import { MATH } from './math';
import { PRACTICE } from './practice';
import { SELF } from './self';
import type { StarterDoc } from './types';

export type { StarterDoc };

/** The full-stack handbook, also searchable in the library (and so while the database is paused). */
const ENGINEERING: StarterDoc[] = FULLSTACK.map((p) => ({ id: `eng-${p.id}`, title: p.title, text: p.body }));

export const STARTER: StarterDoc[] = [...SELF, ...CS, ...MATH, ...AI, ...PRACTICE, ...ENGINEERING];
