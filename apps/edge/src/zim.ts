/**
 * /api/zim/<file>: WIKIPEDIA, OFFLINE's bytes on their way to the owner's phone (apps/web/src/wiki/store.ts), a plain
 * passthrough. download.kiwix.org hands its files to mirrors that answer no other site's page (no CORS header, checked
 * 1 Nov 2026), so the phone cannot fetch them itself; the Worker passes each of the owner's Range requests on and streams
 * the answer back as it comes, with its size and range headers. Nothing is kept or cached here, nothing is read: the
 * brain never sees the file (it lives on the phone), and the Durable Object is not involved at all.
 *
 * Only for the owner (index.ts checks his sign-in first), only Wikipedia files from the Kiwix library by their published
 * names, only a piece at a time (at most 64 MB a request; the phone asks 8 MB), never a file over 4 GB (the whole English
 * Wikipedia, 119 GB, is refused). On the free plan this costs nothing: a streamed body is not a size the plan limits, the
 * bytes pass through without the Worker's CPU touching them, and a 1.1 GB file is about 131 requests.
 */

/** The names the Kiwix library gives its Wikipedia files ("wikipedia_en-simple_all_nopic_2026-09.zim"). */
export const ZIM_NAME = /^wikipedia_[a-z]{2,3}(?:-[a-z]+)?_[a-z0-9-]+_(?:maxi|mini|nopic)_\d{4}-\d{2}\.zim$/;
export const ZIM_MAX_FILE = 4_000_000_000;
export const ZIM_MAX_PIECE = 64 * 1024 * 1024;
const UPSTREAM = 'https://download.kiwix.org/zim/wikipedia/';

const plain = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** One piece of a Kiwix file for the owner's phone (`fetcher`: the tests give a stand-in). */
export async function zimPassthrough(req: Request, file: string, fetcher: typeof fetch = fetch): Promise<Response> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return plain(405, 'GET or HEAD only');
  if (!ZIM_NAME.test(file)) return plain(404, 'not a Wikipedia file from the Kiwix library');
  const range = (req.headers.get('range') ?? '').trim();
  const m = /^bytes=(\d+)-(\d+)$/.exec(range);
  if (req.method === 'GET') {
    if (!m) return plain(416, 'ask for one piece at a time: Range: bytes=<first>-<last>');
    const span = Number(m[2]) - Number(m[1]) + 1;
    if (!(span > 0) || span > ZIM_MAX_PIECE) return plain(416, `a piece is at most ${ZIM_MAX_PIECE} bytes`);
  }
  let up: Response;
  try {
    up = await fetcher(`${UPSTREAM}${file}`, {
      method: req.method,
      headers: { 'user-agent': 'Ghosty/2.0 (personal assistant; single user)', ...(m ? { range } : {}) },
      redirect: 'follow',
      cache: 'no-store',
    } as RequestInit);
  } catch {
    return plain(502, 'download.kiwix.org could not be reached');
  }
  // the file's whole size: from Content-Range (a piece) or Content-Length (a HEAD)
  const total = Number(/\/(\d+)$/.exec(up.headers.get('content-range') ?? '')?.[1] ?? (up.status === 200 ? up.headers.get('content-length') : NaN));
  const refuse = async (status: number, why: string) => {
    await up.body?.cancel().catch(() => undefined);
    return plain(status, why);
  };
  if (up.status === 404) return refuse(404, 'Kiwix no longer has that file');
  if (up.status !== 206 && up.status !== 200) return refuse(502, `the Kiwix mirror answered ${up.status}`);
  if (Number.isFinite(total) && total > ZIM_MAX_FILE) return refuse(413, 'that file is too big for a phone');
  // a mirror that ignored the range would send the whole file: never streamed
  if (req.method === 'GET' && up.status !== 206) return refuse(502, 'the Kiwix mirror did not send a piece');
  const headers = new Headers({
    'content-type': 'application/octet-stream',
    'accept-ranges': 'bytes',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "sandbox; default-src 'none'",
    'content-disposition': 'attachment',
  });
  for (const k of ['content-length', 'content-range', 'last-modified']) {
    const v = up.headers.get(k);
    if (v) headers.set(k, v);
  }
  return new Response(req.method === 'HEAD' ? null : up.body, { status: up.status, headers });
}
