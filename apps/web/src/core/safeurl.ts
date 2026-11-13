/**
 * [security] The schemes a link or a picture may carry in Ghosty's own page. Anything that would run code when tapped or loaded
 * (javascript:, vbscript:, a data: page or an SVG with scripts in it) comes out empty, whoever wrote it: a reply, a feed, a page
 * the brain read, an imported document. The page's CSP blocks those too; this is the second lock, so loosening one never opens
 * the door. Pure: apps/edge/test/security.test.mjs holds it.
 */

/** Control characters and spaces browsers ignore inside a scheme ("java\tscript:" is still javascript:). */
const STRIP = /[\u0000- \u007f-\u009f]/g;

/** The address, or '' when its scheme is not safe for a link (`href`). Relative addresses and #anchors pass unchanged. */
export function safeHref(raw: unknown): string {
  const s = String(raw ?? '');
  const t = s.replace(STRIP, '').toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(t)?.[1];
  if (!scheme) return s;
  return ['http', 'https', 'mailto', 'tel', 'sms', 'blob', 'geo', 'about'].includes(scheme) && !/^about:(?!blank)/.test(t) ? s : '';
}

/** The address, or '' when its scheme is not safe to load as a picture, sound or frame (`src`). */
export function safeSrc(raw: unknown): string {
  const s = String(raw ?? '');
  const t = s.replace(STRIP, '').toLowerCase();
  const scheme = /^([a-z][a-z0-9+.-]*):/.exec(t)?.[1];
  if (!scheme) return s;
  if (scheme === 'data') return /^data:(image\/(png|jpe?g|gif|webp|avif|bmp)|audio\/|video\/|font\/|application\/octet-stream)/.test(t) ? s : '';
  return ['http', 'https', 'blob', 'about'].includes(scheme) && !/^about:(?!blank)/.test(t) ? s : '';
}

/** The props whose value is an address, and which check each takes. */
export const URL_PROPS: Record<string, (v: unknown) => string> = { href: safeHref, src: safeSrc, action: safeHref, formAction: safeHref, formaction: safeHref, poster: safeSrc, data: safeSrc };

/** Open an address from data in a new tab, only when its scheme is safe (a feed's link, a search hit). */
export function openSafe(raw: unknown): void {
  const u = safeHref(raw);
  if (u && !/^\s*(about|blob):/i.test(u)) window.open(u, '_blank', 'noopener');
}

/** [security] The most one imported file may be: a document, a deck, a sheet, a zip of pages, a book (a phone tab is not a server). */
export const MAX_IMPORT_BYTES = 150 * 1024 * 1024;
/** A game or a 3D room shared as a file. */
export const MAX_GAME_BYTES = 30 * 1024 * 1024;

/** Throws the plain-words error when a picked file is past `max`. */
export function checkSize(f: Blob, max = MAX_IMPORT_BYTES): void {
  if (f.size > max) throw new Error(`That file is too big to open on this phone (over ${Math.round(max / 1024 / 1024)} MB).`);
}

/** A picked file's bytes, or the plain-words error when it is past `max` (read only after the size is checked). */
export async function bytesOf(f: Blob, max = MAX_IMPORT_BYTES): Promise<Uint8Array> {
  checkSize(f, max);
  return new Uint8Array(await f.arrayBuffer());
}
