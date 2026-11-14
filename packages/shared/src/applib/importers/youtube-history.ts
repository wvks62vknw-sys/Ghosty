/**
 * A video site's watch history from the account data download: watch-history.json, or the default watch-history.html.
 * Each entry is one video watched: title, channel, link and time. Ads are left out.
 */
import { decodeEntities } from './xml';
import { localDay, localTime, parseClock, parseDay, type Rec } from './input';

export const videoAccept = (name: string): boolean => /watch-history\.(json|html)$/i.test(name);

const rec = (title: string, channel: string, link: string, at: Date | null, day: string, time: string, music: boolean): Rec | null => {
  const t = title.replace(/^Watched\s+/, '').trim();
  if (!t || (!at && !day)) return null;
  const date = at ? localDay(at) : day;
  const tm = at ? localTime(at) : time;
  const r: Rec = { _key: `${date}|${tm}|${t}`, date, title: t, kind: music ? 'Music' : 'Video' };
  if (tm) r.time = tm;
  if (channel) r.channel = channel;
  if (/^https:\/\//.test(link)) r.link = link;
  return r;
};

/** The JSON layout. */
export function videoFromJson(text: string): Rec[] {
  let rows: unknown;
  try { rows = JSON.parse(text); } catch { return []; }
  if (!Array.isArray(rows)) return [];
  const out: Rec[] = [];
  for (const r of rows as Record<string, any>[]) {
    if (Array.isArray(r.details) && r.details.some((d: any) => /ads/i.test(d?.name ?? ''))) continue;
    const at = new Date(r.time);
    const x = rec(String(r.title ?? ''), String(r.subtitles?.[0]?.name ?? ''), String(r.titleUrl ?? ''), Number.isNaN(+at) ? null : at, '', '', /music/i.test(String(r.header ?? '')));
    if (x) out.push(x);
  }
  return out;
}

/** The HTML layout: each outer-cell holds "Watched <a>title</a><br><a>channel</a><br>date". */
export function videoFromHtml(html: string): Rec[] {
  const out: Rec[] = [];
  const cells = html.split(/<div class="outer-cell/).slice(1);
  for (const c of cells) {
    if (/From Google Ads|Ads<\/b>/i.test(c)) continue;
    const music = /<p class="mdl-typography--title">\s*YouTube Music/i.test(c);
    const body = /<div class="content-cell[^"]*mdl-typography--body-1">([\s\S]*?)<\/div>/.exec(c)?.[1] ?? '';
    const links = [...body.matchAll(/<a href="([^"]*)">([\s\S]*?)<\/a>/g)];
    if (!links.length) continue;
    const text = body.split(/<br\s*\/?>/).map((s) => decodeEntities(s.replace(/<[^>]+>/g, '')).trim()).filter(Boolean);
    const when = text[text.length - 1] ?? '';
    const x = rec(decodeEntities(links[0]![2]!), links[1] ? decodeEntities(links[1][2]!) : '', decodeEntities(links[0]![1]!), null, parseDay(when, 'mdy'), parseClock(when), music);
    if (x) out.push(x);
  }
  return out;
}
