/**
 * THE GUARDIAN'S PUBLIC FEEDS (OWNER-ISSUES 55): what is published about the places he saved, free and keyless, read as
 * published and never extrapolated.
 *
 *   floods        the Environment Agency's flood-monitoring API: alerts and warnings within a few km of a point
 *                 (England; Open Government Licence)
 *   metWarnings   the Met Office's National Severe Weather Warnings, its public RSS feed by region, matched to a place
 *                 by the council areas each warning names (UK; Crown copyright)
 *   crimeMonth    street crime from data.police.uk (the crime tool's source): the latest month's public count and its
 *                 categories within a mile, nothing more (England, Wales, Northern Ireland)
 *   placeArea     which region and council a place is in (postcodes.io, free, keyless), so the right Met Office feed is read
 *
 * The parsers are pure (tests feed them recorded answers); every call has its own timeout.
 */
import type { CrimeMonth, GuardWarning } from '../../../../packages/shared/src/guardian';
import { fromZoned } from '../time';
import { crimeLabel, inUK, summarise } from '../tools/crime';

const UA = { 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)', Accept: 'application/json' };
export const FEED_TIMEOUT_MS = 10_000;
/** How far from a place a flood alert or warning counts (km): the neighbourhood, not the county. */
export const FLOOD_KM = 5;

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** A time the Environment Agency writes without a zone ("2026-10-31T08:45:00"): UK local time. */
export function ukTime(s: string): number {
  if (/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) return Date.parse(s);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  return m ? fromZoned(+m[1]!, +m[2]!, +m[3]!, +m[4]!, +m[5]!, 'Europe/London', +(m[6] ?? 0)) : NaN;
}

const SEVERITY: Record<number, string> = { 1: 'Severe flood warning', 2: 'Flood warning', 3: 'Flood alert' };

/** The flood-monitoring API's answer → the alerts and warnings in force (a "no longer in force" item is a lifted one, so left out). */
export function parseFloods(json: unknown): GuardWarning[] {
  const items = Array.isArray((json as { items?: unknown })?.items) ? ((json as { items: unknown[] }).items as Record<string, unknown>[]) : [];
  const out: GuardWarning[] = [];
  for (const it of items) {
    const level = Number(it.severityLevel);
    const area = str(it.floodAreaID);
    if (!(level === 1 || level === 2 || level === 3) || !area) continue;
    const fa = (it.floodArea ?? {}) as Record<string, unknown>;
    const since = ukTime(str(it.timeSeverityChanged) || str(it.timeRaised) || str(it.timeMessageChanged));
    const where = str(it.description).replace(/\s+/g, ' ').trim();
    out.push({
      id: `ea:${area}`,
      feed: 'flood',
      title: `${SEVERITY[level]}${where ? `: ${where}` : ''}`.slice(0, 160),
      level: level as 1 | 2 | 3,
      since: Number.isFinite(since) ? since : 0,
      ...(str(fa.riverOrSea) || str(fa.county) ? { detail: [str(fa.riverOrSea), str(fa.county)].filter(Boolean).join(', ').slice(0, 120) } : {}),
      link: `https://check-for-flooding.service.gov.uk/target-area/${encodeURIComponent(area)}`,
    });
  }
  return out.sort((a, b) => a.level - b.level || b.since - a.since);
}

/** Flood alerts and warnings in force within `km` of a point (England only: elsewhere the agency publishes nothing). */
export async function floods(lat: number, lon: number, km = FLOOD_KM): Promise<GuardWarning[]> {
  const u = new URL('https://environment.data.gov.uk/flood-monitoring/id/floods');
  u.searchParams.set('lat', lat.toFixed(4));
  u.searchParams.set('long', lon.toFixed(4));
  u.searchParams.set('dist', String(km));
  const r = await fetch(u.toString(), { headers: UA, signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`the Environment Agency answered ${r.status}`);
  return parseFloods(await r.json());
}

// ---------------------------------------------------------------- the Met Office

/** Where a place is, as the Met Office feeds and the councils they name are divided. */
export interface PlaceArea {
  /** The Met Office RSS region code ("wm"), '' outside the UK. */
  code: string;
  /** The feed's region in words ("West Midlands"). */
  region: string;
  /** The council (admin district) and county, to match the areas a warning names. */
  district: string;
  county: string;
  country: string;
  /** In Greater London (the feed names London as one area). */
  london?: boolean;
}

/** The Met Office's regional warning feeds: code → the region's name as the feed says it. */
export const MET_REGIONS: Record<string, string> = {
  os: 'Orkney & Shetland', he: 'Highlands & Eilean Siar', gr: 'Grampian', st: 'Strathclyde', ta: 'Central, Tayside & Fife', dg: 'SW Scotland, Lothian Borders',
  ni: 'Northern Ireland', wl: 'Wales', nw: 'North West England', ne: 'North East England', yh: 'Yorkshire & Humber', wm: 'West Midlands', em: 'East Midlands', ee: 'East of England', sw: 'South West England', se: 'London & South East England',
};
const ENGLAND: Record<string, string> = { 'west midlands': 'wm', 'east midlands': 'em', london: 'se', 'south east': 'se', 'south west': 'sw', 'east of england': 'ee', 'north west': 'nw', 'north east': 'ne', 'yorkshire and the humber': 'yh', 'yorkshire and humber': 'yh' };
const SCOTLAND: [RegExp, string][] = [
  [/orkney|shetland/i, 'os'],
  [/highland|eilean siar|na h-eileanan/i, 'he'],
  [/aberdeen|moray/i, 'gr'],
  [/angus|dundee|perth|fife|clackmannan|falkirk|stirling/i, 'ta'],
  [/dumfries|borders|edinburgh|lothian/i, 'dg'],
  [/./, 'st'],
];

/** Which Met Office feed a postcodes.io answer belongs to. */
export function metCode(country: string, region: string, district: string): string {
  const c = country.toLowerCase();
  if (c === 'wales') return 'wl';
  if (c === 'northern ireland') return 'ni';
  if (c === 'scotland') return SCOTLAND.find(([re]) => re.test(district))?.[1] ?? 'st';
  if (c === 'england') return ENGLAND[region.toLowerCase()] ?? '';
  return '';
}

/** postcodes.io's nearest postcode to a point → the place's area (null: no postcode near, e.g. abroad or at sea). */
export function parseArea(json: unknown): PlaceArea | null {
  const r = (json as { result?: unknown })?.result;
  const first = (Array.isArray(r) ? r[0] : null) as Record<string, unknown> | null | undefined;
  if (!first) return null;
  const country = str(first.country);
  const region = str(first.region);
  const district = str(first.admin_district);
  const code = metCode(country, region, district);
  return { code, region: code ? MET_REGIONS[code] ?? region : '', district, county: str(first.admin_county), country, ...(region.toLowerCase() === 'london' ? { london: true } : {}) };
}

export async function placeArea(lat: number, lon: number): Promise<PlaceArea | null> {
  if (!inUK(lat, lon)) return null;
  const u = `https://api.postcodes.io/postcodes?lon=${lon.toFixed(5)}&lat=${lat.toFixed(5)}&limit=1&radius=2000`;
  const r = await fetch(u, { headers: UA, signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`postcodes.io answered ${r.status}`);
  return parseArea(await r.json());
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const unescapeXml = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENTITIES[e.toLowerCase()] ?? m));
const tag = (xml: string, name: string) => unescapeXml(xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'))?.[1] ?? '').trim();

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const LEVEL: Record<string, 1 | 2 | 3> = { red: 1, amber: 2, yellow: 3 };

/** "0411 Sat 31 Oct" → ms (UK local time), the year taken from `near` (a date months off is the next or last year). */
function metTime(s: string, near: number): number {
  const m = s.match(/(\d{2})(\d{2})\s+\w{3}\s+(\d{1,2})\s+(\w{3})/);
  if (!m) return NaN;
  const mo = MONTHS.indexOf(m[4]!.toLowerCase()) + 1;
  if (!mo) return NaN;
  const y = new Date(near).getUTCFullYear();
  const at = (yy: number) => fromZoned(yy, mo, +m[3]!, +m[1]!, +m[2]!, 'Europe/London');
  const SIX_MONTHS = 183 * 86_400_000;
  const t = at(y);
  return t - near > SIX_MONTHS ? at(y - 1) : near - t > SIX_MONTHS ? at(y + 1) : t;
}

/** One Met Office warning, with the council areas it names (empty: the whole region). */
export interface MetWarning extends GuardWarning {
  areas: string[];
}

/** The Met Office's regional RSS → its warnings (only those not yet over at `now`). */
export function parseMetRss(xml: string, now = Date.now()): MetWarning[] {
  const out: MetWarning[] = [];
  for (const item of xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? []) {
    const title = tag(item, 'title');
    const desc = tag(item, 'description');
    const link = tag(item, 'link');
    const guid = tag(item, 'guid');
    const colour = title.match(/^(red|amber|yellow)\b/i)?.[1]?.toLowerCase() ?? '';
    const level = LEVEL[colour];
    if (!level) continue;
    const id = (link.match(/[?&]id=([\w-]{6,64})/)?.[1] ?? guid.match(/[?&]id=([\w-]{6,64})/)?.[1] ?? '') || guid.slice(-60);
    if (!id) continue;
    const what = title.replace(/\s+affecting\s+.*$/i, '').trim();
    // "… affecting West Midlands: Shropshire, Staffordshire, Telford and Wrekin valid from 0411 Sat 31 Oct to 1000 Sat 31 Oct"
    const list = desc.match(/affecting [^:]+:\s*(.*?)\s+valid from/i)?.[1] ?? '';
    const areas = list
      .split(/,\s*|\s+and\s+(?=[A-Z])/)
      .map((a) => a.trim())
      .filter((a) => a && a.length < 60);
    const from = metTime(desc.match(/valid from\s+(\d{4}\s+\w{3}\s+\d{1,2}\s+\w{3})/i)?.[1] ?? '', now);
    const to = metTime(desc.match(/\bto\s+(\d{4}\s+\w{3}\s+\d{1,2}\s+\w{3})/i)?.[1] ?? '', now);
    if (Number.isFinite(to) && to <= now) continue; // over: the feed has not caught up yet
    out.push({
      id: `mo:${id}`,
      feed: 'weather',
      title: what.slice(0, 120),
      level,
      since: Number.isFinite(from) ? from : now,
      ...(Number.isFinite(to) ? { until: to } : {}),
      detail: areas.slice(0, 8).join(', ').slice(0, 160),
      link: link.replace(/&referrer=rss/, '') || 'https://www.metoffice.gov.uk/weather/warnings-and-advice/uk-warnings',
      areas,
    });
  }
  return out.sort((a, b) => a.level - b.level || a.since - b.since);
}

export async function metWarnings(code: string, now = Date.now()): Promise<MetWarning[]> {
  if (!MET_REGIONS[code]) return [];
  const r = await fetch(`https://www.metoffice.gov.uk/public/data/PWSCache/WarningsRSS/Region/${code}`, { headers: { ...UA, Accept: 'application/rss+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`the Met Office answered ${r.status}`);
  return parseMetRss(await r.text(), now);
}

/** Does a warning touch this place: it names the place's council or county (or names no areas: the whole region). */
export function touches(w: MetWarning, a: PlaceArea): boolean {
  if (!w.areas.length) return true;
  const mine = [a.district, a.county, a.london ? 'Greater London' : ''].filter(Boolean).map((x) => x.toLowerCase());
  return w.areas.some((x) => {
    const t = x.toLowerCase();
    return mine.some((m) => m === t || t.includes(m) || m.includes(t));
  });
}

// ---------------------------------------------------------------- street crime

/** police.uk's street-level crimes → the month's count and its biggest categories (nothing about anyone, no streets). */
export function crimeOf(list: unknown): CrimeMonth | null {
  if (!Array.isArray(list)) return null;
  const s = summarise(list as Parameters<typeof summarise>[0]);
  if (!s.month && !list.length) return { month: '', total: 0, top: [] };
  return { month: s.month, total: s.total, top: s.byCategory.slice(0, 4).map(([c, n]) => [crimeLabel(c), n] as [string, number]) };
}

/** The latest published month around a point, within a mile (police.uk's own radius). */
export async function crimeMonth(lat: number, lon: number): Promise<CrimeMonth | null> {
  if (!inUK(lat, lon)) return null;
  const u = new URL('https://data.police.uk/api/crimes-street/all-crime');
  u.searchParams.set('lat', lat.toFixed(5));
  u.searchParams.set('lng', lon.toFixed(5));
  const r = await fetch(u.toString(), { headers: { 'User-Agent': 'Ghosty/personal' }, signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`police.uk answered ${r.status}`);
  return crimeOf(await r.json());
}
