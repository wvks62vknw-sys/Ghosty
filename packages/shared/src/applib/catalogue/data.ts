import type { AppDef, Field, ImporterConfig } from '../types';

/**
 * The Library's data apps (docs/build-plan/APPLIB.md, "Reverse engineered, done for you"): each reads one of his own
 * exports on the phone and gives him a real app over it. The readers are packages/shared/src/applib/importers (READERS,
 * keyed by these ids); the field ids here are the keys those readers write. Only files he exported himself: nothing
 * logged in, nothing about other people, and routes are drawn on the phone only.
 */

const date: Field = { id: 'date', label: 'Date', type: 'date' };
const time: Field = { id: 'time', label: 'Time', type: 'time' };
const imp = (format: ImporterConfig['format'], how: string[], log: ImporterConfig['log']): ImporterConfig => ({ format, how, log });

/** The Health app's export, the same steps for every Health view. */
const HEALTH_HOW = [
  'Open the Health app and tap your picture at the top.',
  'Tap Export All Health Data, then Export. It can take a few minutes.',
  'Save the zip to Files, then pick it here. It is read on the phone.',
];

export const DATA: AppDef[] = [
  {
    id: 'health-steps', name: 'Health Steps', family: 'data', glyph: 'target', archetype: 'importer',
    pitch: 'Every day of steps, distance and stairs from your Health export.',
    keywords: ['steps', 'walking', 'stairs', 'health', 'distance', 'pedometer'],
    tour: ['Pick your Health export and every day of steps appears.', 'A phone and a watch both count: each day keeps the higher one.', 'The chart shows your month; search finds any day.'],
    sample: [
      { date: '2026-11-10', steps: 11240, km: 8.1, flights: 9 },
      { date: '2026-11-11', steps: 6420, km: 4.6, flights: 3 },
      { date: '2026-11-12', steps: 9310, km: 6.8, flights: 12 },
    ],
    importer: imp('apple-health', HEALTH_HOW, {
      fields: [date, { id: 'steps', label: 'Steps', type: 'number' }, { id: 'km', label: 'Distance', type: 'number', unit: 'km', step: 0.01 }, { id: 'flights', label: 'Stairs', type: 'number', unit: 'flights' }],
      title: '{steps} steps', sub: '{km} · {flights}', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'Today', kind: 'sum', field: 'steps', period: 'day', goal: 10000, dir: 'reach' },
        { label: 'Daily average', kind: 'avg', field: 'steps', period: 'month' },
        { label: 'Best day', kind: 'max', field: 'steps', period: 'all' },
        { label: 'Days', kind: 'count', period: 'all' },
      ],
      chart: { field: 'steps', kind: 'bar', period: 'month' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'health-sleep', name: 'Health Sleep', family: 'data', glyph: 'moon', archetype: 'importer',
    pitch: 'Each night of sleep from your Health export, with deep and dream sleep.',
    keywords: ['sleep', 'nights', 'bedtime', 'health', 'rest'],
    tour: ['Pick your Health export to see every night you slept.', 'A night belongs to the morning you woke up.', 'Stats show your average and how often you hit eight hours.'],
    sample: [
      { date: '2026-11-11', asleep: 432, inbed: 470, deep: 62, rem: 101, bed: '23:05', wake: '06:55' },
      { date: '2026-11-12', asleep: 398, inbed: 441, deep: 48, rem: 88, bed: '23:40', wake: '07:01' },
      { date: '2026-11-13', asleep: 471, inbed: 495, deep: 70, rem: 115, bed: '22:50', wake: '07:05' },
    ],
    importer: imp('apple-health', HEALTH_HOW, {
      fields: [date, { id: 'asleep', label: 'Asleep', type: 'duration' }, { id: 'inbed', label: 'In bed', type: 'duration' }, { id: 'deep', label: 'Deep', type: 'duration' }, { id: 'rem', label: 'Dream', type: 'duration' }, { id: 'bed', label: 'Bedtime', type: 'time' }, { id: 'wake', label: 'Woke', type: 'time' }],
      title: 'asleep', sub: '{bed} to {wake}', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'Last night', kind: 'last', field: 'asleep', goal: 480, dir: 'reach' },
        { label: 'Average', kind: 'avg', field: 'asleep', period: 'month' },
        { label: 'Deep average', kind: 'avg', field: 'deep', period: 'month' },
        { label: 'Nights', kind: 'count', period: 'all' },
      ],
      chart: { field: 'asleep', kind: 'bar', period: 'month' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'health-heart', name: 'Health Heart', family: 'data', glyph: 'heart', archetype: 'importer',
    pitch: 'Your heart rate each day, resting rate and variability, from Health.',
    keywords: ['heart', 'pulse', 'resting', 'bpm', 'health', 'variability'],
    tour: ['Pick your Health export to see your heart rate day by day.', 'Resting rate is the one to watch: lower usually means fitter.', 'The chart shows how your resting rate moves over a year.'],
    sample: [
      { date: '2026-11-10', avg: 74, low: 52, high: 151, resting: 56, hrv: 48 },
      { date: '2026-11-11', avg: 71, low: 50, high: 118, resting: 55, hrv: 52 },
      { date: '2026-11-12', avg: 76, low: 53, high: 162, resting: 57, hrv: 45 },
    ],
    importer: imp('apple-health', HEALTH_HOW, {
      fields: [date, { id: 'avg', label: 'Average', type: 'number', unit: 'bpm' }, { id: 'low', label: 'Lowest', type: 'number', unit: 'bpm' }, { id: 'high', label: 'Highest', type: 'number', unit: 'bpm' }, { id: 'resting', label: 'Resting', type: 'number', unit: 'bpm' }, { id: 'hrv', label: 'Variability', type: 'number', unit: 'ms' }],
      title: '{resting} resting', sub: '{low} to {high}', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'Resting', kind: 'last', field: 'resting' },
        { label: 'Month average', kind: 'avg', field: 'resting', period: 'month' },
        { label: 'Lowest resting', kind: 'min', field: 'resting', period: 'year' },
        { label: 'Variability', kind: 'avg', field: 'hrv', period: 'month' },
      ],
      chart: { field: 'resting', kind: 'line', period: 'year' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'health-workouts', name: 'Health Workouts', family: 'data', glyph: 'dumbbell', archetype: 'importer',
    pitch: 'Every workout you recorded, with time, distance and energy, from Health.',
    keywords: ['workouts', 'exercise', 'training', 'health', 'sessions'],
    tour: ['Pick your Health export to list every workout you recorded.', 'Search a kind, such as running, to see only those.', 'Stats count this month and add up the hours.'],
    sample: [
      { date: '2026-11-10', time: '07:05', type: 'Running', mins: 32, km: 5.02, kcal: 311 },
      { date: '2026-11-11', time: '18:00', type: 'Strength', mins: 45, kcal: 210 },
      { date: '2026-11-13', time: '12:30', type: 'Cycling', mins: 58, km: 21.4, kcal: 480 },
    ],
    importer: imp('apple-health', HEALTH_HOW, {
      fields: [date, time, { id: 'type', label: 'Workout', type: 'text' }, { id: 'mins', label: 'Time', type: 'duration' }, { id: 'km', label: 'Distance', type: 'number', unit: 'km', step: 0.01 }, { id: 'kcal', label: 'Energy', type: 'number', unit: 'kcal' }],
      title: 'type', sub: '{mins} · {km}', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'This month', kind: 'count', period: 'month' },
        { label: 'Minutes', kind: 'sum', field: 'mins', period: 'week', goal: 150, dir: 'reach' },
        { label: 'Distance', kind: 'sum', field: 'km', period: 'year' },
        { label: 'Week streak', kind: 'streak' },
      ],
      chart: { field: 'mins', kind: 'bar', period: 'month' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'health-weight', name: 'Health Weight', family: 'data', glyph: 'chart', archetype: 'importer',
    pitch: 'Your weight and body fat readings over the years, from Health.',
    keywords: ['weight', 'body fat', 'scales', 'health', 'kilos'],
    tour: ['Pick your Health export to see every weigh-in.', 'Pounds and stones are turned into kilograms for you.', 'The line shows the trend, which matters more than one day.'],
    sample: [
      { date: '2026-10-01', kg: 78.6, fat: 19.1 },
      { date: '2026-10-20', kg: 77.9, fat: 18.6 },
      { date: '2026-11-10', kg: 77.4, fat: 18.2 },
    ],
    importer: imp('apple-health', HEALTH_HOW, {
      fields: [date, { id: 'kg', label: 'Weight', type: 'number', unit: 'kg', step: 0.1 }, { id: 'fat', label: 'Body fat', type: 'number', unit: '%', step: 0.1 }],
      title: 'kg', sub: '{fat} body fat', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'Latest', kind: 'last', field: 'kg' },
        { label: 'Year low', kind: 'min', field: 'kg', period: 'year' },
        { label: 'Year high', kind: 'max', field: 'kg', period: 'year' },
        { label: 'Readings', kind: 'count', period: 'all' },
      ],
      chart: { field: 'kg', kind: 'line', period: 'year' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'health-activity', name: 'Health Activity', family: 'data', glyph: 'fire', archetype: 'importer',
    pitch: 'Each day of move, exercise and stand totals from your Health export.',
    keywords: ['activity', 'move', 'exercise', 'stand', 'rings', 'health'],
    tour: ['Pick your Health export to see each day of activity.', 'Move is active energy; exercise is brisk minutes.', 'The streak counts days in a row you moved.'],
    sample: [
      { date: '2026-11-10', move: 512, goal: 500, exercise: 38, stand: 11 },
      { date: '2026-11-11', move: 430, goal: 500, exercise: 22, stand: 10 },
      { date: '2026-11-12', move: 601, goal: 500, exercise: 47, stand: 12 },
    ],
    importer: imp('apple-health', HEALTH_HOW, {
      fields: [date, { id: 'move', label: 'Move', type: 'number', unit: 'kcal' }, { id: 'goal', label: 'Move goal', type: 'number', unit: 'kcal' }, { id: 'exercise', label: 'Exercise', type: 'duration' }, { id: 'stand', label: 'Stand', type: 'number', unit: 'hours' }],
      title: 'move', sub: '{exercise} exercise · {stand} stand', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'Exercise', kind: 'sum', field: 'exercise', period: 'week', goal: 150, dir: 'reach' },
        { label: 'Move average', kind: 'avg', field: 'move', period: 'month' },
        { label: 'Streak', kind: 'streak' },
        { label: 'Days', kind: 'count', period: 'all' },
      ],
      chart: { field: 'move', kind: 'bar', period: 'month' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'listening-year', name: 'Listening Year', family: 'data', glyph: 'headphones', archetype: 'importer',
    pitch: 'Your year in music any day you like, from your streaming history.',
    keywords: ['music', 'listening', 'wrapped', 'artists', 'songs', 'year', 'podcasts'],
    tour: ['Pick your music service data download to read your history.', 'Top artists works for any span: this month, this year or all.', 'Skips under 30 seconds are left out, as the services do.'],
    sample: [
      { date: '2026-11-10', track: 'Low Tide', artist: 'The Quiet Hours', album: 'Harbour', kind: 'Music', plays: 3, minutes: 9.8 },
      { date: '2026-11-11', track: 'Glass Roads', artist: 'Fen Lights', album: 'North', kind: 'Music', plays: 2, minutes: 8 },
      { date: '2026-11-12', track: 'On Bread', artist: 'Kitchen Talk', album: '', kind: 'Podcast', plays: 1, minutes: 41.5 },
    ],
    importer: imp('spotify-history', [
      'On your music service\'s website, open Account, then Privacy.',
      'Ask for your account data, or the extended history for every year.',
      'When the email comes, save the zip to Files and pick it here.',
    ], {
      fields: [date, { id: 'track', label: 'Track', type: 'text' }, { id: 'artist', label: 'Artist', type: 'text' }, { id: 'album', label: 'Album', type: 'text' }, { id: 'kind', label: 'Kind', type: 'choice', options: ['Music', 'Podcast'] }, { id: 'plays', label: 'Plays', type: 'number' }, { id: 'minutes', label: 'Minutes', type: 'number', unit: 'min', step: 0.1 }],
      title: 'track', sub: '{artist} · {plays} plays', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'kind',
      stats: [
        { label: 'Minutes', kind: 'sum', field: 'minutes', period: 'year' },
        { label: 'Artists', kind: 'distinct', field: 'artist', period: 'year' },
        { label: 'Tracks', kind: 'distinct', field: 'track', period: 'year' },
        { label: 'Today', kind: 'sum', field: 'minutes', period: 'day' },
      ],
      chart: { field: 'minutes', kind: 'bar', period: 'year' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'watch-history', name: 'Watch History', family: 'data', glyph: 'film', archetype: 'importer',
    pitch: 'Every series and film you streamed, from your viewing history file.',
    keywords: ['watched', 'series', 'films', 'tv', 'viewing', 'streaming'],
    tour: ['Pick your viewing history file to see all you watched.', 'Episodes are grouped under their series name.', 'Top shows ranks what you watched most in any span.'],
    sample: [
      { date: '2026-11-08', time: '20:10', title: 'Harbour Lights: Season 1: The Pier', show: 'Harbour Lights', episode: 'The Pier', kind: 'Series', mins: 46 },
      { date: '2026-11-09', time: '21:00', title: 'Harbour Lights: Season 1: Low Water', show: 'Harbour Lights', episode: 'Low Water', kind: 'Series', mins: 44 },
      { date: '2026-11-12', time: '19:30', title: 'A Long Walk', show: 'A Long Walk', kind: 'Film', mins: 104 },
    ],
    importer: imp('netflix-history', [
      'On the streaming service\'s website, open your profile\'s Account page.',
      'Under Viewing activity, tap Download all. For time watched, ask for your personal data.',
      'Save the file to Files and pick it here. It never leaves the phone.',
    ], {
      fields: [date, time, { id: 'title', label: 'Title', type: 'text' }, { id: 'show', label: 'Series', type: 'text' }, { id: 'episode', label: 'Episode', type: 'text' }, { id: 'kind', label: 'Kind', type: 'choice', options: ['Series', 'Film'] }, { id: 'mins', label: 'Watched', type: 'duration' }],
      title: 'show', sub: 'episode', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'kind',
      stats: [
        { label: 'This month', kind: 'count', period: 'month' },
        { label: 'Series', kind: 'distinct', field: 'show', period: 'year' },
        { label: 'Hours', kind: 'sum', field: 'mins', period: 'year' },
        { label: 'All time', kind: 'count', period: 'all' },
      ],
      chart: { field: 'mins', kind: 'bar', period: 'year' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'video-history', name: 'Video History', family: 'data', glyph: 'eye', archetype: 'importer',
    pitch: 'Every video you watched, searchable by title and channel, on your phone.',
    keywords: ['videos', 'watched', 'channels', 'history', 'clips'],
    tour: ['Pick your video site watch history to search everything you saw.', 'Find that video from last spring by a word in its title.', 'Top channels shows who you watched most in any span.'],
    sample: [
      { date: '2026-11-09', time: '20:15', title: 'How to Sharpen a Chisel', channel: 'Bench Notes', kind: 'Video', link: 'https://example.com/v/1' },
      { date: '2026-11-10', time: '07:40', title: 'Ten Minute Stretch', channel: 'Morning Moves', kind: 'Video', link: 'https://example.com/v/2' },
      { date: '2026-11-11', time: '22:05', title: 'Rain on a Tin Roof', channel: 'Quiet Sounds', kind: 'Music', link: 'https://example.com/v/3' },
    ],
    importer: imp('youtube-history', [
      'Open your account\'s data download page and choose only the video site.',
      'Pick history, and choose JSON if offered (the web page works too).',
      'Unzip it in Files and pick watch-history here, or pick the zip.',
    ], {
      fields: [date, time, { id: 'title', label: 'Title', type: 'text' }, { id: 'channel', label: 'Channel', type: 'text' }, { id: 'kind', label: 'Kind', type: 'choice', options: ['Video', 'Music'] }, { id: 'link', label: 'Link', type: 'link' }],
      title: 'title', sub: 'channel', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'Today', kind: 'count', period: 'day' },
        { label: 'This month', kind: 'count', period: 'month' },
        { label: 'Channels', kind: 'distinct', field: 'channel', period: 'year' },
        { label: 'All time', kind: 'count', period: 'all' },
      ],
      views: ['list', 'calendar'],
    }),
  },
  {
    id: 'book-highlights', name: 'Book Highlights', family: 'data', glyph: 'quote', archetype: 'importer',
    pitch: 'Every highlight and note from your e-reader, all in one searchable place.',
    keywords: ['highlights', 'quotes', 'notes', 'ereader', 'books', 'clippings'],
    tour: ['Pick the clippings file from your e-reader to gather your highlights.', 'Search a word to find a line you marked years ago.', 'A highlight you stretched later is kept once, the longer one.'],
    sample: [
      { book: 'The Salt Road', author: 'Ana Field', kind: 'Highlight', quote: 'The sea keeps its own time, and so do we.', page: 12, location: 170, date: '2026-11-10' },
      { book: 'The Salt Road', author: 'Ana Field', kind: 'Note', quote: 'Compare with chapter two.', page: 31, location: 410, date: '2026-11-11' },
      { book: 'Winter Maps', author: 'Joe Hale', kind: 'Highlight', quote: 'Every map is a guess someone was brave enough to draw.', page: 88, location: 1290, date: '2026-11-12' },
    ],
    importer: imp('kindle-clippings', [
      'Connect your e-reader to a computer with its cable.',
      'Open the documents folder and copy My Clippings.txt to Files.',
      'Pick that file here. Bookmarks are left out; highlights and notes stay.',
    ], {
      fields: [{ id: 'quote', label: 'Highlight', type: 'long' }, { id: 'book', label: 'Book', type: 'text' }, { id: 'author', label: 'Author', type: 'text' }, { id: 'kind', label: 'Kind', type: 'choice', options: ['Highlight', 'Note'] }, { id: 'page', label: 'Page', type: 'number' }, { id: 'location', label: 'Location', type: 'number' }, date],
      title: 'quote', sub: '{book} · {author}', meta: 'page', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'kind',
      stats: [
        { label: 'Highlights', kind: 'count', period: 'all' },
        { label: 'Books', kind: 'distinct', field: 'book', period: 'all' },
        { label: 'This year', kind: 'count', period: 'year' },
      ],
      views: ['list'],
    }),
  },
  {
    id: 'reading-history', name: 'Reading History', family: 'data', glyph: 'book', archetype: 'importer',
    pitch: 'Every book on your reading site shelves, with your ratings and reviews.',
    keywords: ['books', 'reading', 'shelves', 'ratings', 'reviews', 'library'],
    tour: ['Pick your reading site library export to bring your shelves here.', 'Group by shelf to see what you read and what is next.', 'Stats count books and pages read this year.'],
    sample: [
      { title: 'The Salt Road', author: 'Ana Field', shelf: 'Read', rating: 4, pages: 312, year: 2019, read: '2026-10-02', added: '2026-09-01' },
      { title: 'Winter Maps', author: 'Joe Hale', shelf: 'Reading', pages: 280, year: 2024, added: '2026-11-01' },
      { title: 'Bread and Stone', author: 'Mira Kent', shelf: 'To read', pages: 198, year: 2022, added: '2026-11-05' },
    ],
    importer: imp('goodreads', [
      'On the reading site, open My Books, then Import and export.',
      'Tap Export Library and wait for the file link.',
      'Save the CSV to Files and pick it here.',
    ], {
      fields: [{ id: 'title', label: 'Title', type: 'text' }, { id: 'author', label: 'Author', type: 'text' }, { id: 'shelf', label: 'Shelf', type: 'choice', options: ['Read', 'Reading', 'To read'] }, { id: 'rating', label: 'Rating', type: 'rating' }, { id: 'pages', label: 'Pages', type: 'number' }, { id: 'year', label: 'Published', type: 'number' }, { id: 'read', label: 'Finished', type: 'date' }, { id: 'added', label: 'Added', type: 'date' }, { id: 'review', label: 'Review', type: 'long' }],
      title: 'title', sub: '{author} · {year}', meta: 'rating', date: 'read', sort: { field: 'added', dir: 'desc' }, group: 'shelf',
      stats: [
        { label: 'Read this year', kind: 'count', period: 'year', goal: 24, dir: 'reach' },
        { label: 'Pages', kind: 'sum', field: 'pages', period: 'year' },
        { label: 'Average rating', kind: 'avg', field: 'rating', period: 'all' },
        { label: 'Books', kind: 'count', period: 'all' },
      ],
      views: ['list', 'board'],
    }),
  },
  {
    id: 'film-history', name: 'Film History', family: 'data', glyph: 'film', archetype: 'importer',
    pitch: 'Every film in your film diary export, with your stars, rewatches and tags.',
    keywords: ['films', 'movies', 'diary', 'cinema', 'ratings', 'watched'],
    tour: ['Pick your film diary export zip to bring every film here.', 'Search a tag, such as cinema, to see only those nights.', 'Stats count films this year and your average stars.'],
    sample: [
      { title: 'Harbour Nights', year: 1998, date: '2026-11-01', stars: 4.5, rewatch: true, tags: 'cinema' },
      { title: 'The Long Field', year: 2021, date: '2026-11-06', stars: 3.5 },
      { title: 'Paper Moon Road', year: 1974, date: '2026-11-12', stars: 4, tags: 'home' },
    ],
    importer: imp('letterboxd', [
      'On the film diary site, open Settings, then Data.',
      'Tap Export your data and save the zip to Files.',
      'Pick the zip here. The diary is read, with every watch date.',
    ], {
      fields: [{ id: 'title', label: 'Film', type: 'text' }, { id: 'year', label: 'Year', type: 'number' }, date, { id: 'stars', label: 'Stars', type: 'number', min: 0.5, max: 5, step: 0.5 }, { id: 'rewatch', label: 'Rewatch', type: 'check' }, { id: 'tags', label: 'Tags', type: 'text' }],
      title: '{title} ({year})', sub: 'tags', meta: 'stars', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'This year', kind: 'count', period: 'year' },
        { label: 'This month', kind: 'count', period: 'month' },
        { label: 'Average stars', kind: 'avg', field: 'stars', period: 'all' },
        { label: 'Films', kind: 'count', period: 'all' },
      ],
      chart: { field: 'stars', kind: 'bar', period: 'year' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'runs-rides', name: 'Runs and Rides', family: 'data', glyph: 'bike', archetype: 'importer',
    pitch: 'Runs and rides from GPX, TCX or FIT files, with pace, splits and route.',
    keywords: ['runs', 'rides', 'gpx', 'fit', 'pace', 'splits', 'cycling', 'running'],
    tour: ['Pick activity files, or a zip of many, from a watch or bike computer.', 'Each one shows distance, pace, kilometre splits and climb.', 'The route is drawn on the phone only, as a shape with no map.'],
    sample: [
      { date: '2026-11-10', time: '07:00', sport: 'Run', name: 'River Loop', km: 5.02, mins: 26, pace: '5:11 /km', kmh: 11.6, climb: 34, hr: 148, splits: '5:20, 5:12, 5:09, 5:08, 5:02' },
      { date: '2026-11-11', time: '17:45', sport: 'Ride', name: 'Hill Repeats', km: 32.4, mins: 74, pace: '2:17 /km', kmh: 26.3, climb: 410, hr: 139 },
      { date: '2026-11-13', time: '08:10', sport: 'Walk', name: 'Canal Path', km: 4.1, mins: 49, pace: '11:57 /km', kmh: 5, climb: 6 },
    ],
    importer: imp('gpx', [
      'In your watch or bike computer app, open an activity and export it as GPX, TCX or FIT.',
      'For all of them at once, ask the maker\'s website for your data and save the zip.',
      'Pick the files or the zip here. Routes stay on the phone.',
    ], {
      fields: [date, time, { id: 'sport', label: 'Sport', type: 'choice', options: ['Run', 'Ride', 'Walk', 'Hike', 'Swim', 'Other'] }, { id: 'name', label: 'Name', type: 'text' }, { id: 'km', label: 'Distance', type: 'number', unit: 'km', step: 0.01 }, { id: 'mins', label: 'Time', type: 'duration' }, { id: 'pace', label: 'Pace', type: 'text' }, { id: 'kmh', label: 'Speed', type: 'number', unit: 'km/h', step: 0.1 }, { id: 'climb', label: 'Climb', type: 'number', unit: 'm' }, { id: 'hr', label: 'Heart rate', type: 'number', unit: 'bpm' }, { id: 'kcal', label: 'Energy', type: 'number', unit: 'kcal' }, { id: 'splits', label: 'Splits', type: 'long' }],
      title: 'name', sub: '{km} · {pace}', meta: 'date', date: 'date', sort: { field: 'date', dir: 'desc' }, group: 'sport',
      stats: [
        { label: 'This week', kind: 'sum', field: 'km', period: 'week', goal: 20, dir: 'reach' },
        { label: 'This year', kind: 'sum', field: 'km', period: 'year' },
        { label: 'Longest', kind: 'max', field: 'km', period: 'all' },
        { label: 'Activities', kind: 'count', period: 'all' },
      ],
      chart: { field: 'km', kind: 'bar', period: 'month' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'calendar-file', name: 'Calendar File', family: 'data', glyph: 'calendar', archetype: 'importer',
    pitch: 'Open any calendar file and see its events, hours and busy months.',
    keywords: ['calendar', 'ics', 'events', 'diary', 'schedule'],
    tour: ['Pick a calendar file (.ics) exported from any calendar.', 'The calendar view shows the events on their days.', 'Stats add up the hours booked this month.'],
    sample: [
      { date: '2026-11-16', time: '09:30', title: 'Dentist', mins: 60, place: 'High Street' },
      { date: '2026-11-18', time: '19:00', title: 'Climbing', mins: 90, repeats: true },
      { date: '2026-12-25', title: 'Holiday', allday: true },
    ],
    importer: imp('ics', [
      'In your calendar on a computer, open the calendar\'s settings.',
      'Choose Export, which saves an .ics file (or a zip of them).',
      'Put it in Files and pick it here. Guests on events are left out.',
    ], {
      fields: [date, time, { id: 'title', label: 'Event', type: 'text' }, { id: 'mins', label: 'Length', type: 'duration' }, { id: 'place', label: 'Place', type: 'text' }, { id: 'repeats', label: 'Repeats', type: 'check' }, { id: 'allday', label: 'All day', type: 'check' }],
      title: 'title', sub: '{time} · {place}', meta: 'date', date: 'date', sort: { field: 'date', dir: 'asc' },
      stats: [
        { label: 'This month', kind: 'count', period: 'month' },
        { label: 'Hours', kind: 'sum', field: 'mins', period: 'month' },
        { label: 'This year', kind: 'count', period: 'year' },
        { label: 'Events', kind: 'count', period: 'all' },
      ],
      views: ['calendar', 'list'],
    }),
  },
  {
    id: 'contacts-file', name: 'Contacts File', family: 'data', glyph: 'people', archetype: 'importer',
    pitch: 'Open a contacts file to search, tidy and back up your address book.',
    keywords: ['contacts', 'vcf', 'address book', 'vcard', 'numbers'],
    tour: ['Pick a contacts file (.vcf) you exported from your address book.', 'Search any name, number or company.', 'Export as CSV for a tidy copy of your own address book.'],
    sample: [
      { name: 'Corner Garage', phone: '01632 960000', org: 'Corner Garage' },
      { name: 'Dentist', phone: '01632 960111', note: 'Ask for the early slot' },
      { name: 'Home', phone: '01632 960222', email: 'home@example.com' },
    ],
    importer: imp('vcf', [
      'In Contacts, open a list and press and hold its name, or select all.',
      'Choose Export, then save the .vcf file to Files.',
      'Pick it here. Photos are left out and nothing is shared.',
    ], {
      fields: [{ id: 'name', label: 'Name', type: 'text' }, { id: 'phone', label: 'Phone', type: 'text' }, { id: 'email', label: 'Email', type: 'text' }, { id: 'org', label: 'Company', type: 'text' }, { id: 'birthday', label: 'Birthday', type: 'date' }, { id: 'note', label: 'Note', type: 'long' }],
      title: 'name', sub: 'phone', meta: 'org', sort: { field: 'name', dir: 'asc' },
      stats: [{ label: 'Contacts', kind: 'count', period: 'all' }, { label: 'Companies', kind: 'distinct', field: 'org', period: 'all' }],
      views: ['list'],
    }),
  },
  {
    id: 'statement-reader', name: 'Statement Reader', family: 'data', glyph: 'bank', archetype: 'importer',
    pitch: 'Read your bank statement downloads to see spending and money in by month.',
    keywords: ['bank', 'statement', 'ofx', 'spending', 'transactions', 'money'],
    tour: ['Pick a statement download (.ofx or .qfx) from your bank\'s website.', 'Spending and money in are kept apart, month by month.', 'Most spent at shows where the money went in any span.'],
    sample: [
      { date: '2026-11-10', payee: 'Corner Cafe', spent: 4.2 },
      { date: '2026-11-11', payee: 'Salary', received: 2150 },
      { date: '2026-11-12', payee: 'Grocer', spent: 38.65, memo: 'Weekly shop' },
    ],
    importer: imp('ofx', [
      'On your bank\'s website, open the account and find Download or Export.',
      'Choose OFX, QFX or Money format and the dates you want.',
      'Save it to Files and pick it here. It is read only on the phone.',
    ], {
      fields: [date, { id: 'payee', label: 'Payee', type: 'text' }, { id: 'spent', label: 'Spent', type: 'money' }, { id: 'received', label: 'Money in', type: 'money' }, { id: 'memo', label: 'Memo', type: 'text' }],
      title: 'payee', sub: 'memo', meta: 'spent', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'Spent', kind: 'sum', field: 'spent', period: 'month' },
        { label: 'Money in', kind: 'sum', field: 'received', period: 'month' },
        { label: 'Year spent', kind: 'sum', field: 'spent', period: 'year' },
        { label: 'Payments', kind: 'count', period: 'month' },
      ],
      chart: { field: 'spent', kind: 'bar', period: 'year' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'accounts-export', name: 'Accounts Export', family: 'data', glyph: 'receipt', archetype: 'importer',
    pitch: 'Bring years of spending from a money program\'s QIF file, by category.',
    keywords: ['qif', 'accounts', 'categories', 'budget', 'spending', 'money'],
    tour: ['Pick a QIF file exported from a money program.', 'Each payment keeps its category, so you can see where it went.', 'Top categories ranks spending for any span you choose.'],
    sample: [
      { date: '2026-10-25', payee: 'Bakery', spent: 4.2, category: 'Food' },
      { date: '2026-10-28', payee: 'Railway', spent: 23.1, category: 'Travel' },
      { date: '2026-11-01', payee: 'Refund', received: 20, category: 'Shopping' },
    ],
    importer: imp('qif', [
      'In your money program, choose File, then Export.',
      'Pick QIF and the account, then save the file.',
      'Put it in Files and pick it here.',
    ], {
      fields: [date, { id: 'payee', label: 'Payee', type: 'text' }, { id: 'spent', label: 'Spent', type: 'money' }, { id: 'received', label: 'Money in', type: 'money' }, { id: 'category', label: 'Category', type: 'text' }, { id: 'memo', label: 'Memo', type: 'text' }],
      title: 'payee', sub: 'category', meta: 'spent', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'Spent', kind: 'sum', field: 'spent', period: 'month' },
        { label: 'Money in', kind: 'sum', field: 'received', period: 'month' },
        { label: 'Categories', kind: 'distinct', field: 'category', period: 'year' },
        { label: 'Payments', kind: 'count', period: 'all' },
      ],
      chart: { field: 'spent', kind: 'bar', period: 'year' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'table-explorer', name: 'Table Explorer', family: 'data', glyph: 'grid', archetype: 'importer',
    pitch: 'Open any CSV you exported and search, sort and chart it on your phone.',
    keywords: ['csv', 'table', 'spreadsheet', 'export', 'rows', 'data'],
    tour: ['Pick any CSV file, from a tracker, a bank or a spreadsheet.', 'Its date and number columns are found for you.', 'Search filters the rows as you type.'],
    sample: [
      { title: 'Yoga', details: 'Minutes: 45 · Notes: calm', date: '2026-11-14', value: 45 },
      { title: 'Run', details: 'Minutes: 30', date: '2026-11-13', value: 30 },
      { title: 'Swim', details: 'Minutes: 40 · Notes: 20 lengths', date: '2026-11-11', value: 40 },
    ],
    importer: imp('csv', [
      'In the app or website that holds your data, look for Export or Download.',
      'Choose CSV and save the file to Files.',
      'Pick it here. The first text column becomes each row\'s title.',
    ], {
      fields: [{ id: 'title', label: 'Row', type: 'text' }, { id: 'details', label: 'Details', type: 'long' }, date, { id: 'value', label: 'Number', type: 'number' }],
      title: 'title', sub: 'details', meta: 'value', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [{ label: 'Rows', kind: 'count', period: 'all' }, { label: 'Total', kind: 'sum', field: 'value', period: 'all' }, { label: 'Average', kind: 'avg', field: 'value', period: 'all' }],
      chart: { field: 'value', kind: 'bar', period: 'year' }, views: ['list', 'calendar'],
    }),
  },
  {
    id: 'saved-bookmarks', name: 'Saved Bookmarks', family: 'data', glyph: 'link', archetype: 'importer',
    pitch: 'All your browser bookmarks in one place to search, sort and tidy.',
    keywords: ['bookmarks', 'links', 'favourites', 'browser', 'saved'],
    tour: ['Pick a bookmarks file exported from any browser.', 'Folders are kept, and each link shows its site.', 'Search a word to find that page you saved years ago.'],
    sample: [
      { title: 'Bread and Rolls', link: 'https://example.org/bread', site: 'example.org', folder: 'Cooking', added: '2026-10-02' },
      { title: 'Train Times', link: 'https://example.com/trains', site: 'example.com', folder: 'Travel', added: '2026-10-20' },
      { title: 'Tide Tables', link: 'https://example.net/tides', site: 'example.net', added: '2026-11-03' },
    ],
    importer: imp('chrome-bookmarks', [
      'In your browser on a computer, open the bookmarks manager.',
      'Choose Export bookmarks, which saves an HTML file.',
      'Put it in Files and pick it here.',
    ], {
      fields: [{ id: 'title', label: 'Title', type: 'text' }, { id: 'link', label: 'Link', type: 'link' }, { id: 'site', label: 'Site', type: 'text' }, { id: 'folder', label: 'Folder', type: 'text' }, { id: 'added', label: 'Added', type: 'date' }],
      title: 'title', sub: '{site} · {folder}', meta: 'added', date: 'added', sort: { field: 'added', dir: 'desc' },
      stats: [{ label: 'Bookmarks', kind: 'count', period: 'all' }, { label: 'Sites', kind: 'distinct', field: 'site', period: 'all' }, { label: 'Folders', kind: 'distinct', field: 'folder', period: 'all' }],
      views: ['list'],
    }),
  },
  {
    id: 'podcast-list', name: 'Podcast List', family: 'data', glyph: 'mic', archetype: 'importer',
    pitch: 'Your podcast and feed subscriptions from an OPML file, kept in one list.',
    keywords: ['podcasts', 'feeds', 'opml', 'subscriptions', 'shows'],
    tour: ['Pick the OPML file your podcast or feed app exported.', 'Each show keeps its feed address and its folder.', 'Export again to move your shows to any new app.'],
    sample: [
      { title: 'Kitchen Talk', feed: 'https://feeds.example.com/kitchen', site: 'https://example.com/kitchen', folder: 'Food' },
      { title: 'Slow News', feed: 'https://feeds.example.com/slow' },
      { title: 'Night Walks', feed: 'https://feeds.example.com/walks', folder: 'Calm' },
    ],
    importer: imp('opml', [
      'In your podcast or feed app, open its settings.',
      'Choose Export subscriptions or Export OPML and save the file.',
      'Put it in Files and pick it here.',
    ], {
      fields: [{ id: 'title', label: 'Show', type: 'text' }, { id: 'feed', label: 'Feed', type: 'link' }, { id: 'site', label: 'Website', type: 'link' }, { id: 'folder', label: 'Folder', type: 'text' }],
      title: 'title', sub: 'folder', sort: { field: 'title', dir: 'asc' },
      stats: [{ label: 'Shows', kind: 'count', period: 'all' }, { label: 'Folders', kind: 'distinct', field: 'folder', period: 'all' }],
      views: ['list'],
    }),
  },
  {
    id: 'subtitle-reader', name: 'Subtitle Reader', family: 'data', glyph: 'type', archetype: 'importer',
    pitch: 'Read and search a subtitles file line by line, with every time mark.',
    keywords: ['subtitles', 'srt', 'captions', 'script', 'lines'],
    tour: ['Pick a subtitles file (.srt or .vtt).', 'Search a word to find the moment it is said.', 'Each line shows when it starts and how long it stays.'],
    sample: [
      { n: 1, start: '0:00:01', secs: 3.5, line: 'Where were you?', words: 3 },
      { n: 2, start: '0:00:05', secs: 2.2, line: 'Out by the pier. All night.', words: 6 },
      { n: 3, start: '0:00:09', secs: 1.8, line: 'In this weather?', words: 3 },
    ],
    importer: imp('srt', [
      'Save the subtitles file (.srt or .vtt) that came with your own video.',
      'Put it in Files.',
      'Pick it here to read and search every line.',
    ], {
      fields: [{ id: 'line', label: 'Line', type: 'long' }, { id: 'start', label: 'Starts', type: 'text' }, { id: 'n', label: 'Number', type: 'number' }, { id: 'secs', label: 'On screen', type: 'number', unit: 's', step: 0.1 }, { id: 'words', label: 'Words', type: 'number' }],
      title: 'line', sub: 'start', meta: 'n', sort: { field: 'n', dir: 'asc' },
      stats: [{ label: 'Lines', kind: 'count', period: 'all' }, { label: 'Words', kind: 'sum', field: 'words', period: 'all' }],
      views: ['list'],
    }),
  },
];
