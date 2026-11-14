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
export { mergeRecords, topList } from './merge';
export { READER_META, type ReaderMeta } from './meta';
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
  /** Which entries of a zip it reads (names in lower case). */
  accept: (name: string) => boolean;
  read(ps: Part[], ctx: ReadCtx): Promise<Rec[]>;
}

/** One streaming pass over the health export into one tally. */
const health = (make: () => Tally): AppReader => ({
  accept: healthAccept,
  async read(ps, ctx) {
    const t = make();
    const r = healthReader((it) => t.add(it));
    await readText(ps, ctx, (s) => r.push(s));
    r.end();
    return t.done();
  },
});

const texts = (accept: (n: string) => boolean, fn: (files: { name: string; text: string }[]) => Rec[]): AppReader => ({
  accept,
  read: async (ps, ctx) => fn(await wholeTexts(ps, ctx)),
});
const each = (fn: (text: string, name: string) => Rec[]) => (files: { name: string; text: string }[]) => files.flatMap((f) => fn(f.text, f.name));
const ext = (...xs: string[]) => (n: string) => xs.some((x) => n.endsWith(x));

/** Runs and rides from GPX, TCX and FIT files, or a zip of many of them. */
const activities: AppReader = {
  accept: ext('.gpx', '.tcx', '.fit', '.fit.gz', '.gpx.gz', '.tcx.gz'),
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
  'listening-year': texts(listeningAccept, (fs) => listeningRecords(fs.flatMap((f) => listeningPlays(f.text)))),
  'watch-history': texts(watchAccept, (fs) => {
    const all = fs.map((f) => f.text);
    const order = guessOrder(all.flatMap((t) => t.split('\n').slice(1, 200).map((l) => l.split(',').pop()?.replace(/"/g, '') ?? '')));
    return all.flatMap((t) => watchRecords(t, order));
  }),
  'video-history': texts(videoAccept, each((t, n) => (/\.html?$/i.test(n) || t.trimStart()[0] === '<' ? videoFromHtml(t) : videoFromJson(t)))),
  'book-highlights': texts(clippingsAccept, each(clippingRecords)),
  'reading-history': texts(ext('.csv'), each(readingRecords)),
  'film-history': texts(filmAccept, filmRecords),
  'runs-rides': activities,
  'calendar-file': texts(ext('.ics'), each(eventRecords)),
  'contacts-file': texts(ext('.vcf'), each(contactRecords)),
  'statement-reader': texts(ext('.ofx', '.qfx'), each(statementRecords)),
  'accounts-export': texts(ext('.qif'), each(qifRecords)),
  'table-explorer': texts(ext('.csv', '.tsv', '.txt'), each(tableRecords)),
  'saved-bookmarks': texts(ext('.html', '.htm', '.json', 'bookmarks'), each(bookmarkRecords)),
  'podcast-list': texts(ext('.opml', '.xml'), each(feedRecords)),
  'subtitle-reader': texts(ext('.srt', '.vtt'), each(subtitleRecords)),
};

/** Reads his file for one app: every record it holds, keyed by the app's field ids. */
export async function importFile(appId: string, file: FileIn, ctx: ReadCtx = {}): Promise<Rec[]> {
  const r = READERS[appId];
  if (!r) throw new Error(`no importer for ${appId}`);
  const ps = await parts(file, r.accept);
  if (!ps.length) return [];
  return r.read(ps, ctx);
}

