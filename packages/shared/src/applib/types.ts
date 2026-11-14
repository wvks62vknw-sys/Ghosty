/**
 * THE APP LIBRARY's one format: every app in the Library is an AppDef, a plain description the engine draws into a
 * whole app on THE APP KIT (apps/web/src/ui/appkit.ts). Hundreds of apps are data, not hundreds of screens of code,
 * so every one gets the kit's header, search, undo and redo, Recently deleted, first run, export and Home card.
 * Everything an app keeps stays on the phone under ghosty.app.<id>. No app costs money, needs a key or sends
 * anything anywhere; an app that shares does it only through the phone's Share sheet on his tap.
 * The brief is docs/build-plan/APPLIB.md. The checks are validate.ts (run by apps/edge/test/applib.test.mjs).
 */

/** The ten families (the Library's sections), plus the importers that read his own data exports. */
export type Family = 'office' | 'create' | 'games' | 'learn' | 'body' | 'money' | 'tools' | 'life' | 'maker' | 'world' | 'data';
export const FAMILIES: Record<Family, string> = {
  office: 'Office', create: 'Creative', games: 'Games', learn: 'Learning', body: 'Health & food', money: 'Money & home',
  tools: 'Utilities', life: 'Family & life', maker: 'Developer & maker', world: 'Travel & world', data: 'Your data',
};

/** The app icons (24-unit stroke paths drawn by the engine in glyphs.ts, one per name). */
export const APP_GLYPHS = [
  'drop', 'list', 'clock', 'calc', 'plus', 'calendar', 'note', 'cards', 'die', 'moon', 'heart', 'star', 'bolt', 'coins', 'cup',
  'dumbbell', 'smile', 'cart', 'case', 'book', 'pen', 'brush', 'camera', 'film', 'music', 'mic', 'headphones', 'game', 'puzzle',
  'chess', 'trophy', 'flag', 'map', 'pin', 'plane', 'car', 'bike', 'train', 'globe', 'sun', 'cloud', 'leaf', 'tree', 'flower',
  'paw', 'fish', 'home', 'key', 'lock', 'tool', 'wrench', 'hammer', 'ruler', 'cube', 'chip', 'code', 'terminal', 'bug', 'link',
  'chart', 'pie', 'wallet', 'receipt', 'bank', 'gift', 'baby', 'people', 'chat', 'mail', 'phone', 'bell', 'fire', 'pill',
  'apple', 'bowl', 'bottle', 'tag', 'box', 'shirt', 'scissors', 'palette', 'grid', 'layers', 'type', 'quote', 'brain', 'atom',
  'flask', 'eye', 'target', 'compass', 'tent', 'wave', 'mountain', 'anchor', 'battery', 'wifi', 'file', 'folder', 'download',
  'upload', 'timer', 'hourglass', 'check', 'shield', 'spark',
] as const;
export type AppGlyph = (typeof APP_GLYPHS)[number];

/** How an app works: each archetype is one renderer in the engine (apps/web/src/features/applib/). */
export type Archetype = 'log' | 'checklist' | 'calc' | 'timer' | 'deck' | 'counter' | 'guide' | 'game' | 'importer' | 'screen';
export const ARCHETYPES: Archetype[] = ['log', 'checklist', 'calc', 'timer', 'deck', 'counter', 'guide', 'game', 'importer', 'screen'];

/** One field of a record. Ids are lower-case words (a-z, 0-9, _), unique in the app. */
export type FieldType =
  | 'text' // one line
  | 'long' // several lines
  | 'number'
  | 'money' // pounds and pence, shown £12.50
  | 'date' // a day (YYYY-MM-DD)
  | 'time' // a time of day (HH:MM)
  | 'duration' // minutes, shown 1 h 20 min
  | 'choice' // one of options
  | 'multi' // any of options
  | 'rating' // 1 to 5 stars
  | 'scale' // min to max, a slider (default 1 to 10)
  | 'check' // yes or no
  | 'photo' // a photo kept on the phone
  | 'link'; // a web address
export interface Field {
  id: string;
  label: string;
  type: FieldType;
  /** Shown after a number ("km", "kg", "pages"); never for money. */
  unit?: string;
  /** choice and multi only: 2 to 12 options, each 24 characters at most. */
  options?: string[];
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** The grey words in the empty box ("e.g. Rioja"). */
  hint?: string;
  /** A new record starts with this ('today' for a date, 'now' for a time). */
  default?: string | number | boolean;
}

/** A number the app works out from its records, shown in its summary strip and on its Home card (the first one). */
export type StatKind = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'last' | 'streak' | 'distinct';
export interface Stat {
  label: string;
  kind: StatKind;
  /** The field it reads (not needed for count and streak). */
  field?: string;
  /** Which records count: those dated in the current day, week, month or year (by the app's date field), or all. */
  period?: 'day' | 'week' | 'month' | 'year' | 'all';
  /** A goal draws a ring: reach means at least (steps), limit means at most (spending). */
  goal?: number;
  dir?: 'reach' | 'limit';
}

/** log: records with fields. Trackers, journals, collections, inventories, logs, CRMs of his own, boards. */
export interface LogConfig {
  fields: Field[];
  /** Each row's title, line and right-hand number: a field id, or a template like "{name} ({year})". */
  title: string;
  sub?: string;
  meta?: string;
  /** The date field that places a record in time (for periods, streaks, the calendar view and reminders). */
  date?: string;
  sort?: { field: string; dir: 'asc' | 'desc' };
  /** A choice field to group the list by (and the board view's columns). */
  group?: string;
  stats?: Stat[];
  /** One chart of a number field over time (needs date). */
  chart?: { field: string; kind: 'bar' | 'line'; period: 'week' | 'month' | 'year' };
  /** The views offered (the first is the default). */
  views?: ('list' | 'board' | 'calendar' | 'gallery')[];
  /** A nudge on the date: "Drink by {name}" on the day of field 'drinkby' (a phone notification only if he allowed them). */
  remind?: { field: string; words: string };
}

/** checklist: lists of things to tick, in sections, optionally starting fresh each day or week. */
export interface ChecklistConfig {
  sections: { name: string; items: string[] }[];
  repeat: 'never' | 'daily' | 'weekly';
}

/**
 * calc: a calculator. Outputs are expressions over the input ids (and earlier output ids) in the engine's safe
 * expression language: numbers, + - * / ^ %, ( ), comparisons < <= > >= == !=, and, or, not, and the functions
 * min max round(x, dp) floor ceil abs sqrt cbrt ln log10 exp pow sin cos tan asin acos atan atan2 hypot clamp(x, lo, hi)
 * if(cond, a, b), and the constants pi and e. Angles in degrees. Nothing else (no variables beyond the ids).
 * Every calc carries tests: known inputs and the outputs a trusted public source gives for them.
 */
export interface CalcInput {
  id: string;
  label: string;
  unit?: string;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  /** A picker instead of a number box: each choice's label and the number it stands for. */
  choices?: { label: string; value: number }[];
}
export interface CalcOutput {
  id: string;
  label: string;
  expr: string;
  unit?: string;
  format?: 'number' | 'money' | 'percent' | 'duration';
  /** Decimal places shown (default 2). */
  dp?: number;
  /** THE PRO ROUND: the answer said in words, by band: the first band whose upTo the value is at most (the last may leave upTo out). */
  bands?: { upTo?: number; words: string; tone?: 'good' | 'ok' | 'warn' | 'bad' }[];
  /** THE PRO ROUND: one plain sentence on what this number means for him. */
  explain?: string;
}
export interface CalcConfig {
  inputs: CalcInput[];
  outputs: CalcOutput[];
  tests: { in: Record<string, number>; out: Record<string, number>; tol?: number }[];
  /** An engineering, car, build, body or money figure: shown with "A first estimate, never certified." */
  estimate?: boolean;
  /** The formula's public source, named plainly ("NHS BMI formula"). */
  source?: string;
}

/** timer: a sequence of timed steps, repeated (intervals, routines, brewing, cooking, practice). */
export interface TimerConfig {
  steps: { name: string; secs: number }[];
  rounds: number;
}

/** deck: cards to learn, with spaced repetition (or a plain quiz). Facts must be right and checkable. */
export interface DeckConfig {
  cards: { q: string; a: string }[];
  mode: 'srs' | 'quiz';
}

/** counter: tallies, one per name (scores, reps, stock, laps). */
export interface CounterConfig {
  names: string[];
  step: number;
  /** Start again at zero each day or week, or never. */
  reset: 'never' | 'daily' | 'weekly';
}

/** guide: an offline reference, sections to search and read. Plain facts only, never medical dosing or legal advice. */
export interface GuideConfig {
  sections: { title: string; body: string; tags?: string[] }[];
  /** The public source the facts come from (a name and its https address). */
  source: { name: string; url: string };
}

/** game: one of the engine's own game kinds, set up (sizes, words, levels, speed). Genres only, no copied game. */
export type GameKind =
  | 'sudoku' | 'mines' | 'merge' | 'slide' | 'pairs' | 'nonogram' | 'wordgrid' | 'wordguess' | 'anagram' | 'hangman'
  | 'reaction' | 'sprint' | 'typing' | 'simon' | 'lights' | 'solitaire' | 'snake' | 'blocks' | 'dots' | 'quiz';
export const GAME_KINDS: GameKind[] = [
  'sudoku', 'mines', 'merge', 'slide', 'pairs', 'nonogram', 'wordgrid', 'wordguess', 'anagram', 'hangman',
  'reaction', 'sprint', 'typing', 'simon', 'lights', 'solitaire', 'snake', 'blocks', 'dots', 'quiz',
];
export interface GameConfig {
  kind: GameKind;
  /** Board size, speed, word list, levels: whatever that kind reads (see the engine's games/<kind>.ts). */
  options: Record<string, number | string | boolean | string[]>;
}

/** importer: reads one of his own data exports on the phone and turns it into records (a log underneath). */
export type ImportFormat =
  | 'apple-health' | 'spotify-history' | 'netflix-history' | 'youtube-history' | 'kindle-clippings' | 'goodreads'
  | 'letterboxd' | 'gpx' | 'tcx' | 'fit' | 'ics' | 'vcf' | 'ofx' | 'qif' | 'csv' | 'chrome-bookmarks' | 'opml' | 'srt';
export interface ImporterConfig {
  format: ImportFormat;
  /** Where to get the file, in steps he can follow ("Health app → your picture → Export All Health Data"). */
  how: string[];
  /** The records' shape and summary once read (title, stats, chart, as for a log). */
  log: LogConfig;
}

/** THE PRO ROUND's look for a family: how its apps are laid out, like a company that specialises in that kind of app. */
export type Skin = 'money' | 'body' | 'office' | 'create' | 'games' | 'learn' | 'world' | 'tools' | 'life' | 'maker' | 'data';

export interface AppDef {
  /** Lower-case words joined by hyphens, unique across the Library; also the key under ghosty.app.<id>. */
  id: string;
  /** 2 to 18 characters, Title Case ("Wine Cellar"). */
  name: string;
  family: Family;
  glyph: AppGlyph;
  /** One sentence, 30 to 90 characters, ending with a full stop: what it does for him. */
  pitch: string;
  /** Words he might say or type to open it ("wine", "cellar", "bottles"), lower case, 2 to 8 of them. */
  keywords: string[];
  archetype: Archetype;
  /** The three lines of the first-run tour, each 70 characters at most. */
  tour: [string, string, string];
  /** The first-run sample records (log and importer apps: 2 to 6, keyed by field id). */
  sample?: Record<string, string | number | boolean | string[]>[];
  log?: LogConfig;
  checklist?: ChecklistConfig;
  calc?: CalcConfig;
  timer?: TimerConfig;
  deck?: DeckConfig;
  counter?: CounterConfig;
  guide?: GuideConfig;
  game?: GameConfig;
  importer?: ImporterConfig;
  /** screen: one of Ghosty's own full screens, listed in the Library so it holds everything (opened at this hash, e.g. 'sheets'). */
  screen?: { hash: string };
  /** The catalogue id this answers (from the Atlas, e.g. "office.11"); new apps leave it out. */
  from?: string;
  /** THE PRO ROUND: essentials lead the Library; the rest sit under MORE APPS (never hidden). */
  tier?: 'essential' | 'more';
  /** THE PRO ROUND: the app's own hue (0 to 359) when its family's would not suit it; the look's tokens set lightness and chroma. */
  hue?: number;
  /** THE PRO ROUND: the family's look by default; another family's when the app is more like those (a budget app in a tools family). */
  skin?: Skin;
}
