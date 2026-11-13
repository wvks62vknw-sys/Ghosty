/**
 * THE ARCADE'S WORDS (BRIEF-QUALITY-LEARN): every line a game's card says about getting a game and starting it, in his voice and with
 * no DOM, so the spec reads the very words the page is built from. The download rule is kept exactly: the size is said before GET, a
 * fetch waits for Wi-Fi, and nothing is fetched that was not fetched before.
 */

/** On mobile data: said as I, with the size, and that I wait. */
export const mobileData = (size: string): string => `You’re on mobile data, so I’ll wait for Wi-Fi, then fetch ${size}.`;

/** The fetch has begun: the size, and where from. */
export const fetchStart = (size: string): string => `Fetching ${size} from the Internet Archive…`;

/** Mid-way: the bytes with their unit, and the share (a number is never bare). */
export const fetchMid = (got: string, total: string, pct: number): string => `Fetching ${got} of ${total} (${pct}%)…`;

/** A fetch that failed: what happened (his error voice), that nothing was kept, and the way on (the key reads RETRY). */
export const fetchFailed = (why: string): string => `${why} Nothing was kept; tap RETRY and I’ll start again.`;

/** The key on a card whose fetch failed. */
export const retryKey = (size: string): string => `RETRY · ${size}`;

/** A game that will not start: the one thing to try. */
export const startFailed = (title: string): string => `I couldn’t start ${title}. Tap PLAY to try again; if it still won’t, delete it under ⋯ and GET it again.`;

/** The shelf with nothing on it that plays here. */
export const SHELF_NONE = { head: 'No games play on this phone yet.', line: 'When one does, it is here with its size, ready to GET.' };
