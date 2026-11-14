/**
 * What the page needs to know about each data app's reader without loading the parsers (they run in the worker): the file
 * kinds the picker offers, the top panel's field, and whether records carry a route's shape.
 */
export interface ReaderMeta {
  types: string;
  top?: { field: string; by?: string; label: string };
  route?: boolean;
}
const HEALTH: ReaderMeta = { types: '.zip,.xml' };
export const READER_META: Record<string, ReaderMeta> = {
  'health-steps': HEALTH,
  'health-sleep': HEALTH,
  'health-heart': HEALTH,
  'health-workouts': HEALTH,
  'health-weight': HEALTH,
  'health-activity': HEALTH,
  'listening-year': { types: '.zip,.json', top: { field: 'artist', by: 'minutes', label: 'Top artists' } },
  'watch-history': { types: '.csv,.zip', top: { field: 'show', label: 'Top shows' } },
  'video-history': { types: '.json,.html,.zip', top: { field: 'channel', label: 'Top channels' } },
  'book-highlights': { types: '.txt', top: { field: 'book', label: 'Most highlighted' } },
  'reading-history': { types: '.csv' },
  'film-history': { types: '.zip,.csv' },
  'runs-rides': { types: '.gpx,.tcx,.fit,.zip', route: true },
  'calendar-file': { types: '.ics,.zip' },
  'contacts-file': { types: '.vcf,.zip' },
  'statement-reader': { types: '.ofx,.qfx', top: { field: 'payee', by: 'spent', label: 'Most spent at' } },
  'accounts-export': { types: '.qif', top: { field: 'category', by: 'spent', label: 'Top categories' } },
  'table-explorer': { types: '.csv,.tsv,.txt' },
  'saved-bookmarks': { types: '.html,.htm,.json' },
  'podcast-list': { types: '.opml,.xml' },
  'subtitle-reader': { types: '.srt,.vtt' },
};
