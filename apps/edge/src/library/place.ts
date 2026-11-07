/**
 * HIS PLACE IN A BOOK (BRIEF-LIBRARY-READER 2): for each book, the passage he is in and how far into it, kept on the brain so
 * another device opens the book where he left it. The phone keeps its own copy at once (apps/web/src/library/place.ts) and
 * sends it here a moment after it changes. No AI model; owner-only like every library route (index.ts signs every /api call
 * in), and every place is checked against the book itself: a book the library does not have, or a place past its end, is
 * refused in words.
 *
 *   GET    /library/place             → { places: { [doc]: BookPlace } }   (the Shelf's progress on every row)
 *   GET    /library/place?doc=<id>    → { place: BookPlace | null }
 *   PUT    /library/place  { doc, n, off, page?, pct?, done?, at? } → { place }   (or { place, newer: true }: see below)
 *   DELETE /library/place?doc=<id>    → { ok }
 *
 * One storage key holds every book's place (about sixty bytes a book; at most MAX_BOOKS, the oldest let go first). A place
 * older than the one kept (another device moved on since that phone last looked) never writes over it: the newer one comes
 * back, marked `newer`, and the phone moves there.
 */
import type { BookPlace, LibraryDoc } from '../../../../packages/shared/src/protocol';

export type { BookPlace };

export const PLACES_KEY = 'library:places';
/** The most books whose place is kept (the oldest let go first): a shelf far bigger than anyone reads at once. */
export const MAX_BOOKS = 500;
/** The longest a passage can be (library/store.ts MAX_PASSAGE_CHARS): an offset past it is past the passage. */
const MAX_OFF = 4000;
const ID = /^[\w-]{1,80}$/;

type Storage = Pick<DurableObjectStorage, 'get' | 'put'>;
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/** Every place kept. */
export async function loadPlaces(storage: Storage): Promise<Record<string, BookPlace>> {
  const v = (await storage.get<Record<string, BookPlace>>(PLACES_KEY)) ?? {};
  return v && typeof v === 'object' ? v : {};
}

/** A book's place let go (the book was removed from the library). */
export async function dropPlace(storage: Storage, doc: string): Promise<void> {
  const all = await loadPlaces(storage);
  if (!(doc in all)) return;
  delete all[doc];
  await storage.put(PLACES_KEY, all);
}

/**
 * A place as he sent it, checked against the book: null and the words of what is wrong when it cannot be kept. `n` is a
 * whole passage of the book (0 to its last), `off` within a passage, `page` one of its pages, `pct` a share.
 */
export function checkPlace(b: Record<string, unknown>, doc: LibraryDoc, now = Date.now()): { place: BookPlace } | { error: string; status: number } {
  const n = Number(b.n);
  const off = Number(b.off ?? 0);
  if (!Number.isInteger(n) || n < 0) return { error: 'a place is a passage of the book, counted from 0', status: 400 };
  if (n >= doc.passages) return { error: `that place is past the end of “${doc.title}”: it has ${doc.passages} passage${doc.passages === 1 ? '' : 's'}, the last is ${Math.max(0, doc.passages - 1)}`, status: 400 };
  if (!Number.isInteger(off) || off < 0 || off > MAX_OFF) return { error: `a place is at most ${MAX_OFF} characters into its passage`, status: 400 };
  const page = b.page === null || b.page === undefined ? null : Number(b.page);
  if (page !== null && (!Number.isInteger(page) || page < 1 || (doc.pages > 0 && page > doc.pages))) return { error: `“${doc.title}” has ${doc.pages} page${doc.pages === 1 ? '' : 's'}: there is no page ${b.page}`, status: 400 };
  const pct = b.pct === undefined ? (doc.passages > 1 ? n / (doc.passages - 1) : 0) : Number(b.pct);
  if (!Number.isFinite(pct) || pct < 0 || pct > 1) return { error: 'how far through a book is a share between 0 and 1', status: 400 };
  // a time from a phone whose clock runs fast is taken as now: a place is never in the future
  const at = Math.min(Number.isFinite(Number(b.at)) && Number(b.at) > 0 ? Number(b.at) : now, now);
  return { place: { doc: doc.id, n, off, page: doc.pages > 0 ? page : null, pct: Math.round(pct * 1000) / 1000, done: b.done === true, at } };
}

/** The place route: GET every place (or one book's), PUT a book's place, DELETE it. `doc` looks a book up in the library. */
export async function placeRoute(req: Request, method: string, url: URL, deps: { storage: Storage; doc(id: string): LibraryDoc | null }): Promise<Response> {
  const asked = url.searchParams.get('doc');
  if (method === 'GET') {
    const all = await loadPlaces(deps.storage);
    if (asked === null) return json({ places: all });
    return json({ place: ID.test(asked) ? all[asked] ?? null : null });
  }
  if (method === 'DELETE') {
    if (!asked || !ID.test(asked)) return json({ error: 'which book? (?doc=)' }, 400);
    await dropPlace(deps.storage, asked);
    return json({ ok: true });
  }
  if (method !== 'PUT' && method !== 'POST') return json({ error: 'not found' }, 404);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof b.doc === 'string' ? b.doc : '';
  if (!ID.test(id)) return json({ error: 'which book? (doc)' }, 400);
  const doc = deps.doc(id);
  if (!doc) return json({ error: 'the library has no such book' }, 404);
  const r = checkPlace(b, doc);
  if ('error' in r) return json({ error: r.error }, r.status);
  const all = await loadPlaces(deps.storage);
  const kept = all[id];
  // another device moved on since this one last looked: the newer place stays, and comes back for the phone to move to
  if (kept && kept.at > r.place.at) return json({ place: kept, newer: true });
  all[id] = r.place;
  const ids = Object.keys(all);
  if (ids.length > MAX_BOOKS) for (const old of ids.sort((x, y) => all[x]!.at - all[y]!.at).slice(0, ids.length - MAX_BOOKS)) delete all[old];
  await deps.storage.put(PLACES_KEY, all);
  return json({ place: r.place });
}
