/**
 * THE APP LIBRARY's importers (the DATA lane): each "Your data" app reads one of his own exports on the phone and gets
 * a real app over it. READERS says, app by app, which files in an export it takes and how they become records keyed by
 * the AppDef's field ids (catalogue/data.ts). Every record carries _key, so importing again replaces or merges and never
 * doubles up. Parsing runs in a Web Worker on the phone (features/applib/importer.ts); nothing is sent anywhere.
 */
import { parts, readText, wholeBytes, wholeTexts, type FileIn, type Part, type ReadCtx, type Rec } from './input';
import { activityTally, healthAccept, healthReader, heartTally, sleepTally, stepsTally, weightTally, workoutsTally, type Tally } from './apple-health';
import { listeningAccept, listeningPlays, listeningRecords } from './spotify-history';
import { watchAccept, watchRecords } from './netflix-history';
import { videoAccept, videoFromHtml, videoFromJson } from './youtube-history';
import { clippingRecords, clippingsAccept } from './kindle-clippings';
import { readingRecords } from './goodreads';
import { filmAccept, filmRecords } from './letterboxd';
import { gpxReader } from './gpx';
import { tcxReader } from './tcx';
import { fitActivities } from './fit';
import { activityRecord, type Activity } from './route';
import { eventRecords } from './ics';
import { contactRecords } from './vcf';
import { statementRecords } from './ofx';
import { qifRecords } from './qif';
import { tableRecords } from './csv-table';
import { bookmarkRecords } from './chrome-bookmarks';
import { feedRecords } from './opml';
import { subtitleRecords } from './srt';
import { guessOrder } from './input';

export * from './input';
export { Sax, decodeEntities } from './xml';
export { parseCsv, csvObjects } from './csv';
export { zipEntries, zipStream } from './zip';
export { fitMessages, fitActivities, FIT_EPOCH } from './fit';
export { activityRecord, routePath, splits, cumulative, climb, metres, mmss, sportOf, SPORTS } from './route';
export type { Activity, Pt } from './route';
export * from './apple-health';
export { listeningPlays, listeningRecords } from './spotify-history';
export { watchRecords, splitTitle } from './netflix-history';
export { videoFromJson, videoFromHtml } from './youtube-history';
export { clippingRecords, titleAuthor } from './kindle-clippings';
export { readingRecords } from './goodreads';
export { filmRecords } from './letterboxd';
export { gpxReader } from './gpx';
export { tcxReader } from './tcx';
export { eventRecords, icsWhen, isoMinutes } from './ics';
export { contactRecords } from './vcf';
export { statementRecords } from './ofx';
export { qifRecords } from './qif';
export { tableRecords } from './csv-table';
export { bookmarkRecords } from './chrome-bookmarks';
export { feedRecords } from './opml';
export { subtitleRecords } from './srt';

export interface AppReader {
  /** The file kinds the picker offers. */
  types: string;
  /** Which entries of a zip it reads (names in lower case). */
  accept: (name: string) => boolean;
  read(ps: Part[], ctx: ReadCtx): Promise<Rec[]>;
  /** The "top" panel over a chosen span of days: the field ranked, weighted by a number field (or by count). */
  top?: { field: string; by?: string; label: string };
  /** Records carry _route, the shape of the route, drawn on the phone. */
  route?: boolean;
}

/** One streaming pass over the health export into one tally. */
const health = (make: () => Tally): AppReader => ({
  types: '.zip,.xml',
  accept: healthAccept,
  async read(ps, ctx) {
    const t = make();
    const r = healthReader((it) => t.add(it));
    await readText(ps, ctx, (s) => r.push(s));
    r.end();
    return t.done();
  },
});

const texts = (types: string, accept: (n: string) => boolean, fn: (files: { name: string; text: string }[]) => Rec[], extra: Partial<AppReader> = {}): AppReader => ({
  types,
  accept,
  read: async (ps, ctx) => fn(await wholeTexts(ps, ctx)),
  ...extra,
});
const each = (fn: (text: string, name: string) => Rec[]) => (files: { name: string; text: string }[]) => files.flatMap((f) => fn(f.text, f.name));
const ext = (...xs: string[]) => (n: string) => xs.some((x) => n.endsWith(x));

/** Runs and rides from GPX, TCX and FIT files, or a zip of many of them. */
const activities: AppReader = {
  types: '.gpx,.tcx,.fit,.zip',
  accept: ext('.gpx', '.tcx', '.fit', '.fit.gz', '.gpx.gz', '.tcx.gz'),
  route: true,
  async read(ps, ctx) {
    const acts: Activity[] = [];
    const bin = ps.filter((p) => /\.fit$/i.test(p.name));
    const txt = ps.filter((p) => !/\.fit$/i.test(p.name));
    const share = (n: number) => (txt.length + bin.length ? n / (txt.length + bin.length) : 0);
    const split = (lo: number, hi: number): ReadCtx => ({ ...ctx, progress: (f) => ctx.progress?.(lo + f * (hi - lo)) });
    const mid = share(txt.length);
    for (const f of await wholeBytes(bin, split(mid, 1))) {
      try { acts.push(...fitActivities(f.bytes)); } catch { /* a file that is not an activity is skipped */ }
    }
    let i = 0;
    for (const p of txt) {
      const r = /\.tcx$/i.test(p.name) ? tcxReader() : gpxReader();
      await readText([p], split(share(i), share(i + 1)), (s) => r.push(s));
      acts.push(...r.end());
      i++;
    }
    return acts.map(activityRecord).filter((r): r is Rec => !!r);
  },
};

export const READERS: Record<string, AppReader> = {
  'health-steps': health(stepsTally),
  'health-sleep': health(sleepTally),
  'health-heart': health(heartTally),
  'health-workouts': health(workoutsTally),
  'health-weight': health(weightTally),
  'health-activity': health(activityTally),
  'listening-year': texts('.zip,.json', listeningAccept, (fs) => listeningRecords(fs.flatMap((f) => listeningPlays(f.text))), { top: { field: 'artist', by: 'minutes', label: 'Top artists' } }),
  'watch-history': texts('.csv,.zip', watchAccept, (fs) => {
    const all = fs.map((f) => f.text);
    const order = guessOrder(all.flatMap((t) => t.split('\n').slice(1, 200).map((l) => l.split(',').pop()?.replace(/"/g, '') ?? '')));
    return all.flatMap((t) => watchRecords(t, order));
  }, { top: { field: 'show', label: 'Top shows' } }),
  'video-history': texts('.json,.html,.zip', videoAccept, each((t, n) => (/\.html?$/i.test(n) || t.trimStart()[0] === '<' ? videoFromHtml(t) : videoFromJson(t))), { top: { field: 'channel', label: 'Top channels' } }),
  'book-highlights': texts('.txt', clippingsAccept, each(clippingRecords), { top: { field: 'book', label: 'Most highlighted' } }),
  'reading-history': texts('.csv', ext('.csv'), each(readingRecords)),
  'film-history': texts('.zip,.csv', filmAccept, filmRecords),
  'runs-rides': activities,
  'calendar-file': texts('.ics,.zip', ext('.ics'), each(eventRecords)),
  'contacts-file': texts('.vcf,.zip', ext('.vcf'), each(contactRecords)),
  'statement-reader': texts('.ofx,.qfx', ext('.ofx', '.qfx'), each(statementRecords), { top: { field: 'payee', by: 'spent', label: 'Most spent at' } }),
  'accounts-export': texts('.qif', ext('.qif'), each(qifRecords), { top: { field: 'category', by: 'spent', label: 'Top categories' } }),
  'table-explorer': texts('.csv,.tsv,.txt', ext('.csv', '.tsv', '.txt'), each(tableRecords)),
  'saved-bookmarks': texts('.html,.htm,.json', ext('.html', '.htm', '.json', 'bookmarks'), each(bookmarkRecords), { top: { field: 'site', label: 'Top sites' } }),
  'podcast-list': texts('.opml,.xml', ext('.opml', '.xml'), each(feedRecords)),
  'subtitle-reader': texts('.srt,.vtt', ext('.srt', '.vtt'), each(subtitleRecords)),
};

/** Reads his file for one app: every record it holds, keyed by the app's field ids. */
export async function importFile(appId: string, file: FileIn, ctx: ReadCtx = {}): Promise<Rec[]> {
  const r = READERS[appId];
  if (!r) throw new Error(`no importer for ${appId}`);
  const ps = await parts(file, r.accept);
  if (!ps.length) return [];
  return r.read(ps, ctx);
}

/**
 * Old and new records together. 'merge' keeps what he had and lays the new file over it (the same _key is replaced,
 * never doubled); 'replace' keeps only the new file. Records he added by hand (no _key) are always kept.
 */
export function mergeRecords(old: Rec[], incoming: Rec[], mode: 'merge' | 'replace' = 'merge'): Rec[] {
  const m = new Map<string, Rec>();
  const loose: Rec[] = [];
  for (const r of old) {
    if (typeof r._key !== 'string') loose.push(r);
    else if (mode === 'merge') m.set(r._key, r);
  }
  for (const r of incoming) m.set(String(r._key), r);
  return [...m.values(), ...loose];
}

/** The top values of a field over records dated from..to (inclusive, YYYY-MM-DD; '' for no bound), weighted by `by`. */
export function topList(recs: Rec[], field: string, opts: { by?: string; from?: string; to?: string; dateField?: string; n?: number } = {}): { name: string; value: number }[] {
  const df = opts.dateField ?? 'date';
  const m = new Map<string, number>();
  for (const r of recs) {
    const d = String(r[df] ?? '');
    if (opts.from && (!d || d < opts.from)) continue;
    if (opts.to && (!d || d > opts.to)) continue;
    const k = String(r[field] ?? '').trim();
    if (!k) continue;
    const w = opts.by ? Number(r[opts.by]) || 0 : 1;
    m.set(k, (m.get(k) ?? 0) + w);
  }
  return [...m].map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, opts.n ?? 5);
}
