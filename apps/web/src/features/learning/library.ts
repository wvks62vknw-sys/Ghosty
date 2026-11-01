/**
 * A passage from his own library (kept on this phone) for the typing test and for reading faster: whole sentences, plain
 * letters (packages/shared/src/learning.ts passageFrom). '' when the library holds nothing worth reading, and the built-in
 * lines are used instead. Nothing is sent anywhere.
 */
import { passageFrom } from '../../../../../packages/shared/src/learning';

/** The raw text of one passage of one document, chosen by `seed` (his own documents first, the starter shelf otherwise). */
export async function libraryRaw(seed: number): Promise<string> {
  try {
    const lib = await import('../../library/local');
    const { docs } = await lib.shelf();
    const kept = docs.filter((d) => d.passages > 0);
    const mine = kept.filter((d) => !d.builtin);
    const pool = mine.length ? mine : kept;
    for (let k = 0; k < 6 && pool.length; k++) {
      const doc = pool[(seed + k) % pool.length]!;
      const ps = await lib.passagesHere(doc.id);
      if (ps?.length) return ps[(seed * 7 + k) % ps.length]!.text;
    }
  } catch {
    /* no library on this phone yet: a built-in line */
  }
  return '';
}

/** A passage of at least `min` words from his library, or ''. */
export async function libraryPassage(seed: number, min = 12): Promise<string> {
  for (let k = 0; k < 4; k++) {
    const p = passageFrom(await libraryRaw(seed + k * 13), seed + k);
    if (p.split(' ').length >= min) return p;
  }
  return '';
}
