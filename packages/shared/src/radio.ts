/**
 * Radio stations from radio-browser.info (free, no key), in plain words: shared by the Radio tab
 * (apps/web/src/features/radio) and the brain's play_radio (apps/edge/src/tools/media.ts).
 */

export interface RawStation {
  name: string;
  url_resolved: string;
  country?: string;
  countrycode?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
  votes?: number;
}

/**
 * Hosts that serve the very same stream on https as on http (each checked, 25 Oct 2026): the BBC's own
 * streams (Radio 1, 2, 4, 5 Live, the World Service, the locals), Global's (Capital, Classic FM, LBC, Heart)
 * and GB News. The directory lists most of them with http:// addresses, and an https page can only play
 * https, so without this "play BBC Radio 4" found nothing at all.
 */
const SECURE_TOO = /^(as-hls-ww-live\.akamaized\.net|stream\.live\.vc\.bbcmedia\.co\.uk|a\.files\.bbci\.co\.uk|(media|ice)-[a-z]+\.musicradio\.com|listen-gbnews\.sharp-stream\.com)$/i;

/** The stream's https address, or null when there is none an https page can play. */
export function secureStream(url: string): string | null {
  const m = /^(https?):\/\/([^/:?#]+)(:\d+)?([/?#].*)?$/i.exec(url.trim());
  if (!m) return null;
  if ((m[1] ?? '').toLowerCase() === 'https') return url.trim();
  return !m[3] && SECURE_TOO.test(m[2] ?? '') ? `https://${url.trim().slice(7)}` : null;
}

/** A TV channel in the radio list ("BBC News HD (720P)"): a picture stream, not radio. */
export const isVideo = (s: RawStation): boolean => /\b\d{3,4}p\b|\bTV\b/i.test(s.name) || /h\.?26[45]|vp[89]|video/i.test(s.codec ?? '');

/** "BBC Radio 4 (128k)" → "BBC Radio 4": the bitrate and stream notes the directory adds to names. */
export function stationName(name: string): string {
  return name.replace(/\s*\((?:\d+\s*k[^)]*|uk|hd|aac\+?|mp3|nonuk|national stream)\)/gi, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

const SHORT: Record<string, string> = { GB: 'UK', US: 'USA', AE: 'UAE' };
let regions: Intl.DisplayNames | null | undefined;
/** "GB" → "UK", "FR" → "France": the country in a word or two, not "The United Kingdom Of Great Britain And Northern Ireland". */
export function countryWord(code = '', name = ''): string {
  const c = code.toUpperCase();
  if (SHORT[c]) return SHORT[c];
  if (regions === undefined) {
    try {
      regions = new Intl.DisplayNames(['en-GB'], { type: 'region' });
    } catch {
      regions = null;
    }
  }
  if (/^[A-Z]{2}$/.test(c) && regions) {
    try {
      const n = regions.of(c);
      if (n && n !== c) return n;
    } catch {
      /* not a region */
    }
  }
  return name.length > 24 ? '' : name;
}

/** The station's line: "UK · News, talk · 128 kbps". */
export function stationInfo(s: RawStation): string {
  const country = countryWord(s.countrycode, (s.country ?? '').trim());
  const tags = (s.tags ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t && t.length <= 18 && !/^\d+$/.test(t) && t.toLowerCase() !== country.toLowerCase())
    .slice(0, 2)
    .join(', ');
  return [country, tags ? tags.charAt(0).toUpperCase() + tags.slice(1) : '', s.bitrate ? `${s.bitrate} kbps` : ''].filter(Boolean).join(' · ');
}

export interface Station {
  name: string;
  url: string;
  info: string;
}

/**
 * The directory's answer as stations he can play: https only (or made https where the same stream is
 * served there), no TV channels, one row per station (the same station's other bitrates and copies left out),
 * stations from `home` (a country code, "GB") first.
 */
export function tidyStations(raw: RawStation[], home = 'GB', limit = 30): Station[] {
  const seen = new Set<string>();
  const out: (Station & { home: boolean })[] = [];
  for (const s of raw) {
    const url = secureStream(s.url_resolved ?? '');
    if (!url || !s.name?.trim() || isVideo(s)) continue;
    const name = stationName(s.name);
    const key = name.toLowerCase();
    if (seen.has(key) || seen.has(url)) continue;
    seen.add(key);
    seen.add(url);
    out.push({ name, url, info: stationInfo(s), home: (s.countrycode ?? '').toUpperCase() === home });
  }
  // a stable sort: the directory's own order (most listened to) within each group
  return out
    .sort((a, b) => Number(b.home) - Number(a.home))
    .slice(0, limit)
    .map(({ name, url, info }) => ({ name, url, info }));
}
