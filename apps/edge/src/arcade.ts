/**
 * /api/arcade/<item>/<file>[/<member>]: the ARCADE's game packages on their way to the owner's phone when the phone cannot get
 * them from the Internet Archive itself (apps/web/src/arcade/store.ts asks here only once every public mirror has failed), a
 * plain passthrough. On 1 Nov 2026 every fetch of archive.org/cors/… from his iPhone ended in Safari's "Load failed", a fetch
 * that never got an answer: the page's side is right (its security policy lets archive.org through), so it is the network
 * between the phone and the Archive, or Safari, refusing the direct fetch. The Worker asks the Archive for the same address
 * instead and streams the answer back as it comes, with its size and range headers. Nothing is kept here and nothing is
 * read: the brain never sees the package (the phone checks its exact size and SHA-256 and unpacks it), and the Durable
 * Object is not involved at all. The packages are fixed releases, so the answer tells the phone it may keep it a week.
 *
 * Only for the owner (index.ts checks his sign-in first), only the Archive items the shelf uses (ARCADE_ITEMS, which the
 * arcade mirror test holds to shelf.ts and levels.ts, both ways), only a file or a ZIP member by the name the shelf writes
 * into an address (encodeURIComponent's letters, digits, . _ - and %XX; never a dot-dot, however it is spelled). A ZIP member
 * is handed to one of the Archive's own data servers by a redirect, which is followed here. On the free plan this costs
 * nothing: a streamed body is not a size the plan limits, and the bytes pass through without the Worker's CPU touching them.
 */

/**
 * The Internet Archive items the shelf and the free levels fetch from: every `archive('<item>', …)` in
 * apps/web/src/arcade/shelf.ts, and idgames_202003 (the free levels' copy of the idgames archive, through `idgames()`).
 */
export const ARCADE_ITEMS: ReadonlySet<string> = new Set([
  '3dduke13SW',
  'Bs-aog-sw1',
  'Epic-pinball-sw1',
  'Idstuff',
  'Keen4e-sw',
  'Raptor-sw1',
  'TyrianV2.1SW1996EpicMegaGamesInc.Action',
  'WackyWheels',
  'doom19s_202607',
  'freedoom-0.13.0',
  'heretic-dos',
  'idgames_202003',
  'jill1-sw',
  'keen1-sw',
  'msdos_Quake106_shareware',
  'msdos_Quake106_shareware_201702',
  'omf20_zip',
  'rott_shareware',
]);

const UPSTREAM = 'https://archive.org/cors/';
/** A name as the shelf writes it into an address: encodeURIComponent's letters, digits, . _ - and whole %XX escapes. */
const NAME = /^(?:[A-Za-z0-9._-]|%[0-9A-Fa-f]{2})+$/;
/** One piece of a file (a first byte, a last byte, or the last few): the only Range the phone could mean. */
const RANGE = /^bytes=(?:\d+-\d*|-\d+)$/;

const plain = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/**
 * A name that is whole and plain once its escapes are read: no dot-dot or empty folder in it ("..", "%2e%2e" and "a%2F..%2Fb"
 * all walk up a folder somewhere), no backslash, no control character, no escape inside an escape.
 */
function plainName(name: string): boolean {
  if (!NAME.test(name)) return false;
  let read: string;
  try {
    read = decodeURIComponent(name);
  } catch {
    return false;
  }
  return !/[\u0000-\u001f\u007f\\%]/.test(read) && read.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
}

/** One package (or one member of a ZIP the Archive holds) for the owner's phone (`fetcher`: the tests give a stand-in). */
export async function arcadePassthrough(req: Request, rest: string, fetcher: typeof fetch = fetch): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(405, 'GET or HEAD only');
  const parts = rest.split('/');
  if (parts.length < 2 || parts.length > 3 || !ARCADE_ITEMS.has(parts[0]!) || !parts.slice(1).every((p) => plainName(p))) {
    return plain(404, 'not a package from the arcade shelf');
  }
  const range = (req.headers.get('range') ?? '').trim();
  const ranged = RANGE.test(range);
  let up: Response;
  try {
    up = await fetcher(`${UPSTREAM}${rest}`, {
      method: req.method,
      headers: { 'user-agent': 'Ghosty/2.0 (personal assistant; single user)', ...(ranged ? { range } : {}) },
      redirect: 'follow',
      cache: 'no-store',
    } as RequestInit);
  } catch {
    return plain(502, 'archive.org could not be reached');
  }
  const refuse = async (status: number, why: string) => {
    await up.body?.cancel().catch(() => undefined);
    return plain(status, why);
  };
  if (up.status === 404) return refuse(404, 'the Archive no longer has that file');
  if (up.status !== 200 && up.status !== 206) return refuse(502, `archive.org answered ${up.status}`);
  // fixed releases, each checked by its SHA-256 on the phone: a week in the phone's own cache is safe
  const headers = new Headers({
    'content-type': 'application/octet-stream',
    'cache-control': 'public, max-age=604800',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "sandbox; default-src 'none'",
    'content-disposition': 'attachment',
  });
  for (const k of ['content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag']) {
    const v = up.headers.get(k);
    if (v) headers.set(k, v);
  }
  return new Response(req.method === 'HEAD' ? null : up.body, { status: up.status, headers });
}
