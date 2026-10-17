/**
 * Best settings for a gadget (a speaker, an amp, a soundbar, a TV): a web search for its manual,
 * the maker's page and the reviewers who publish settings (RTINGS, What Hi-Fi?, AVForums…) →
 * up to four pages read → only the sentences about settings kept, each with its source → the
 * model that called the tool writes the advice from those, naming where each came from. Nothing
 * found means "nothing published was found", never settings made up to fill the gap.
 *
 * Some review sites put their text in the page's data rather than its HTML (RTINGS' settings pages
 * do): `pageText` reads the plain text and those embedded strings too. Pure parts are unit-tested
 * on a real page (apps/edge/test/parts.test.mjs).
 */
import { htmlToText, readCapped } from '../tools/web';
import { hostOf, parseHitList } from './parts';

/** Sources that publish tested settings, best first (a maker's own site is found by its brand name). */
export const SETTINGS_SOURCES: { host: RegExp; name: string; rank: number }[] = [
  { host: /(^|\.)rtings\.com$/, name: 'RTINGS', rank: 10 },
  { host: /(^|\.)whathifi\.com$/, name: 'What Hi-Fi?', rank: 9 },
  { host: /(^|\.)avforums\.com$/, name: 'AVForums', rank: 8 },
  { host: /(^|\.)hdtvtest\.co\.uk$/, name: 'HDTVTest', rank: 8 },
  { host: /(^|\.)soundguys\.com$/, name: 'SoundGuys', rank: 7 },
  { host: /(^|\.)trustedreviews\.com$/, name: 'Trusted Reviews', rank: 7 },
  { host: /(^|\.)techradar\.com$/, name: 'TechRadar', rank: 6 },
  { host: /(^|\.)(manualslib\.com|manua\.ls|manualsdump\.com)$/, name: 'a manual library', rank: 6 },
  { host: /(^|\.)cnet\.com$/, name: 'CNET', rank: 5 },
  { host: /(^|\.)tomsguide\.com$/, name: "Tom's Guide", rank: 5 },
  { host: /(^|\.)digitaltrends\.com$/, name: 'Digital Trends', rank: 5 },
  { host: /(^|\.)reddit\.com$/, name: 'Reddit (owners’ opinions)', rank: 2 },
];

export type Use = 'music' | 'films' | 'gaming' | 'speech' | '';

export interface SettingsQuery {
  device: string;
  use?: Use;
  room?: string;
}

/** Words that mark a sentence as being about a setting. */
const SETTING_WORDS =
  /\b(picture mode|sound mode|filmmaker|cinema|expert|game mode|game optimi[sz]er|eq|equali[sz]er|bass|treble|mid(?:range)?|balance|loudness|dialogue|dialog|voice enhance|night mode|dynamic range|drc|surround|virtuali[sz]er|crossover|sub(?:woofer)? (?:level|phase|crossover)|phase|gain|volume limit|backlight|brightness|contrast|colou?r (?:temperature|gamut|space)|warm ?\d?|gamma|sharpness|motion (?:smoothing|interpolation)|truemotion|motionflow|noise reduction|local dimming|peak brightness|hdr|tone mapping|vrr|allm|hdmi (?:deep colou?r|enhanced|ultra hd)|earc|arc|room correction|trueplay|adaptive sound|auto volume|clear voice|speech enhance|white balance|black level|energy saving|eco mode)\b/i;
/** …and words that say what to do with it. */
const ADVICE_WORDS = /\b(set|setting|settings|turn(?:ed)? (?:on|off|up|down)|enable|disable|recommend|we used|use the|switch|select|choose|adjust|leave|keep|best|calibrat|disable|off\b|on\b|[-+]?\d+(?:\.\d+)?\s?(?:db|%|hz)?\b)/i;

/** The text a page carries: its visible text plus long strings embedded in its data (RTINGS-style JSON in attributes or scripts). */
export function pageText(html: string): { title: string; text: string } {
  const visible = htmlToText(html);
  const embedded: string[] = [];
  // JSON inside an attribute is HTML-escaped (&quot;): undo that first
  const raw = html.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  for (const m of raw.matchAll(/"(?:text|body|content|description|summary|value)"\s*:\s*"((?:[^"\\]|\\.){80,})"/g)) {
    let s: string;
    try {
      s = JSON.parse(`"${m[1]!}"`) as string;
    } catch {
      continue;
    }
    const t = htmlToText(s.replace(/&#39;/g, "'")).text;
    if (t.length > 60 && !visible.text.includes(t.slice(0, 60))) embedded.push(t);
    if (embedded.length > 80) break;
  }
  return { title: visible.title, text: [visible.text, ...embedded].join('\n') };
}

/** The sentences about settings, in page order, near the device's own name when it is there; at most `max` characters. */
export function settingsPassages(text: string, max = 1800): string[] {
  const sentences = text
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => s.length >= 25 && s.length <= 400);
  const out: string[] = [];
  let size = 0;
  const seen = new Set<string>();
  for (const s of sentences) {
    if (!SETTING_WORDS.test(s) || !ADVICE_WORDS.test(s)) continue;
    // cookie banners, menus and adverts say "settings" too
    if (/\b(cookie|privacy|newsletter|subscribe|sign in|log in|affiliate|commission|price|deal|buy now)\b|[£$]\s?\d/i.test(s)) continue;
    const key = s.toLowerCase().slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    if (size + s.length > max) break;
    out.push(s);
    size += s.length;
  }
  return out;
}

export function sourceOf(url: string, brand = ''): { name: string; rank: number } {
  const host = hostOf(url);
  const s = SETTINGS_SOURCES.find((x) => x.host.test(host));
  if (s) return { name: s.name, rank: s.rank };
  // the maker's own site (sony.co.uk, support.lg.com, bose.co.uk…)
  if (brand && brand.length >= 2 && host.split('.').some((p) => p === brand.toLowerCase())) return { name: `${brand} (the maker)`, rank: 9 };
  return { name: host || 'a web page', rank: 3 };
}

/** RTINGS keeps a TV's or monitor's calibration settings on their own page next to the review. */
export function settingsPageFor(url: string): string | null {
  const m = url.match(/^(https:\/\/www\.rtings\.com\/(?:tv|monitor)\/reviews\/[^/?#]+\/[^/?#]+)\/?(?:[?#].*)?$/);
  return m ? `${m[1]}/settings` : null;
}

export interface SettingsFound {
  url: string;
  source: string;
  title: string;
  passages: string[];
}

export interface SettingsDeps {
  search: (query: string) => Promise<string>;
  fetch?: typeof fetch;
  progress?: (label: string, done?: number, total?: number) => void;
}

const UA = 'Mozilla/5.0 (compatible; GhostyAssistant/2.0; personal assistant)';

const USE_WORDS: Record<Exclude<Use, ''>, string> = { music: 'music', films: 'movies', gaming: 'gaming', speech: 'dialogue' };

/** What the model reads: the passages with their sources, and the rule about inventing nothing. */
export function renderSettings(q: SettingsQuery, found: SettingsFound[]): string {
  const want = [q.use ? `for ${q.use}` : '', q.room ? `in ${q.room}` : ''].filter(Boolean).join(' ');
  if (!found.length) return `No published settings were found for ${q.device}. Say so plainly and do NOT invent settings or menu names. You may offer general advice clearly marked as general (not specific to this model), and ask for the exact model number (on the back or underneath) to search again.`;
  const lines = [`Settings published for ${q.device} (read just now). Recommend ONLY settings that appear below${want ? `, picking those that suit ${want}` : ''}; name the source of each (e.g. "RTINGS recommends…"); where sources disagree, say so; never add menu names or values that are not here.`];
  for (const f of found) lines.push(`\n[${f.source}] ${f.title}\n${f.url}\n- ${f.passages.join('\n- ')}`);
  return lines.join('\n');
}

/** The errand: search (one or two queries), read up to four pages, keep the settings sentences. */
export async function gadgetSettings(q: SettingsQuery, deps: SettingsDeps): Promise<{ found: SettingsFound[]; text: string }> {
  const f = deps.fetch ?? fetch;
  const device = q.device.replace(/\s+/g, ' ').trim();
  if (!device) throw new Error('say which gadget (make and model, or what it is)');
  const brand = device.split(' ')[0]!.replace(/[^A-Za-z0-9-]/g, '');
  const use = q.use ? USE_WORDS[q.use] : '';
  const queries = [`${device} best ${use ? `${use} ` : ''}settings`, `${device} recommended settings manual review`];
  const hits: { title: string; url: string; text: string }[] = [];
  for (const [i, query] of queries.entries()) {
    if (i > 0 && hits.filter((h) => sourceOf(h.url, brand).rank >= 5).length >= 3) break;
    deps.progress?.(i ? 'looking for the manual and reviews…' : 'searching for the best settings…');
    const found = await deps.search(query).then(parseHitList).catch(() => []);
    for (const h of found) if (!hits.some((x) => x.url === h.url)) hits.push(h);
  }
  const urls: string[] = [];
  for (const h of hits.filter((x) => /^https:\/\//.test(x.url) && !/youtube\.com|youtu\.be|facebook\.com|tiktok\.com|\.pdf$/i.test(x.url)).sort((a, b) => sourceOf(b.url, brand).rank - sourceOf(a.url, brand).rank)) {
    const extra = settingsPageFor(h.url);
    for (const u of extra ? [extra, h.url] : [h.url]) if (!urls.includes(u)) urls.push(u);
  }
  const toRead = urls.slice(0, 4);
  const found: SettingsFound[] = [];
  let done = 0;
  await Promise.all(
    toRead.map(async (url) => {
      let html = '';
      try {
        const r = await f(url, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5', 'Accept-Language': 'en-GB,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(8000) });
        if (r.ok) html = await readCapped(r, 600_000);
      } catch {
        /* unreachable: skipped */
      }
      deps.progress?.(`reading ${hostOf(url)}…`, ++done, toRead.length);
      if (!html) return;
      const page = pageText(html);
      const passages = settingsPassages(page.text);
      if (passages.length) found.push({ url, source: sourceOf(url, brand).name, title: page.title.replace(/\s+/g, ' ').trim().slice(0, 140), passages });
    }),
  );
  found.sort((a, b) => toRead.indexOf(a.url) - toRead.indexOf(b.url));
  return { found, text: renderSettings({ ...q, device }, found) };
}
