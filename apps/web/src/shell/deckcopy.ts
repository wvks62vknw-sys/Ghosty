/**
 * The words of the Every screen deck (shell/launcher.ts; OWNER-ISSUES 33–34): for each of the twenty screens its
 * name, a promise (one line of at most 44 characters, so it never needs cutting on a half card), three to five
 * YOU CAN lines, each with what a tap does (a deep link into the right screen and mode, or an example said to
 * Ghosty), and a DID YOU KNOW where there is a true one; then the TRY THIS NOW picks, three a day.
 *
 * Every claim is one the app makes good on: checked against MAP.md and each feature's own header comment
 * (features/<tab>/index.ts and the files it names). Not claimed: naming plants, birds or insects (the Lens names
 * things from everyday-name lists), calories from a photo of dinner (Lens's ASK sends the picture to the brain,
 * nothing more), Night School (planned, not built). SCHOOL is Ghosty's own schooling: he sits the papers.
 * British English, plain words; "he" is Ghosty.
 */
import { META as GAMES } from '../gym/meta';
import { home } from '../state/app';

/** What a YOU CAN line, or a TRY THIS NOW pick, does when it is tapped. */
export type DeckAct =
  /** The screen, scrolled to (or opening) the panel whose title starts with `panel`. */
  | { open: string; panel?: string }
  /** A command from commands/registry.ts, e.g. the Lens in a mode; `args` may be worked out at the tap. */
  | { run: string; args?: Record<string, unknown> | (() => Record<string, unknown>) }
  /** The words, sent to the chat as the owner's own message (assistant/session.ts `send`). */
  | { ask: string }
  /** The conversation, open, for something only he can paste (a link). */
  | { chat: true };

export interface DeckLine {
  text: string;
  act: DeckAct;
}

export interface DeckScreen {
  /** As the owner says it ("God’s eye", "3D studio"). */
  name: string;
  /** What it does for him, at most 44 characters. */
  promise: string;
  /** YOU CAN: three to five things, each tappable. */
  can: DeckLine[];
  /** DID YOU KNOW, only where there is something true and worth knowing. */
  dyk?: string;
}

/** The deck's groups, in order (the tab bar's areas: Learn and Plan share one). */
export const DECK_GROUPS: [string, string[]][] = [
  ['Ask and see', ['core', 'brief', 'eye', 'lens']],
  ['Make', ['studio', 'workshop', 'reverse', 'space', 'workbench']],
  ['Learn and plan', ['learn', 'gym', 'school', 'library', 'agenda', 'markets', 'threats', 'radio']],
  ['Me', ['memory', 'settings', 'system', 'links', 'abilities']],
];

const lens = (mode: string): DeckAct => ({ run: 'open_lens', args: { mode } });
/** The live cameras nearest home (commands/builtin.ts `show_cameras`; with none there, the mapped ones and traffic). */
const camerasNearHome: DeckAct = { run: 'show_cameras', args: () => ({ lat: home().lat, lon: home().lon, place: home().name }) };

export const DECK: Record<string, DeckScreen> = {
  core: {
    name: 'Core',
    promise: 'Talk or type, and he gets it done',
    can: [
      { text: 'Ask with sources, each claim checked', act: { ask: 'How much sleep do adults need? With sources.' } },
      { text: 'Paste a YouTube link: the gist, with times', act: { chat: true } },
      { text: 'Have a website built from a few words', act: { ask: 'Build me a one-page website for a café' } },
    ],
    dyk: 'Home’s Mind is his library as a hologram: a point for about every 20 passages, lit once he has read them.',
  },
  brief: {
    name: 'Brief',
    promise: 'Your day in one look, or read out loud',
    can: [
      { text: 'Rain chance and temperature, hour by hour', act: { open: 'brief', panel: 'WEATHER' } },
      { text: 'Headlines by section: world, tech, science', act: { open: 'brief', panel: 'HEADLINES' } },
      { text: 'Brief me: weather and headlines in 90 words', act: { open: 'brief', panel: 'HEADLINES' } },
    ],
  },
  eye: {
    name: 'God’s eye',
    promise: 'The planet live: planes, ships, satellites',
    can: [
      { text: 'See the traffic cameras nearest home', act: camerasNearHome },
      { text: 'Tap any spot for Street View, 3-D and traffic', act: { open: 'eye' } },
      { text: 'Plan a bus, tram or train journey', act: { run: 'journey_planner' } },
    ],
    dyk: 'About 5,000 official public cameras are on the globe, from London to the West Midlands motorways.',
  },
  lens: {
    name: 'Lens',
    promise: 'Point the camera and he names what he sees',
    can: [
      { text: 'Translate a sign or a menu', act: lens('translate') },
      { text: 'Measure a wall or a sofa from a photo', act: lens('measure') },
      { text: 'Label the planes and ships you point at', act: lens('aim') },
      { text: 'Scan a QR code and spot a fake link', act: lens('scan') },
      { text: 'Read a UK number plate: its MOT history', act: lens('read') },
    ],
    dyk: 'He names things on the phone itself, from 4,624 everyday names. Nothing leaves it until you ask.',
  },
  studio: {
    name: '3D studio',
    promise: 'Make 3-D models, then take them apart',
    can: [
      { text: 'Take the arc reactor apart: 16 parts', act: { run: 'open_studio', args: { sample: 'reactor' } } },
      { text: 'Find a real model: “oak dining chair”', act: { run: 'open_studio', args: { make: 'oak dining chair' } } },
      { text: 'Turn a photo into a 3-D model', act: { open: 'studio' } },
    ],
    dyk: 'Cut any model open with a section plane, or measure it between two taps.',
  },
  workshop: {
    name: 'Workshop',
    promise: 'He changes his own code when you ask',
    can: [
      { text: 'Tell him what to build or change', act: { open: 'workshop', panel: 'TELL GHOSTY' } },
      { text: 'See a preview, then ship it or bin it', act: { open: 'workshop', panel: 'PROPOSED CHANGES' } },
      { text: 'Roll back to any earlier version', act: { open: 'workshop', panel: 'VERSIONS' } },
      { text: 'Make a mini-game: “a little snake game”', act: { ask: 'Make me a little snake game to play' } },
    ],
    dyk: 'Every morning he suggests upgrades for himself; one tap on Build starts one.',
  },
  reverse: {
    name: 'Reverse',
    promise: 'Paste a link: see how any app or site works',
    can: [
      { text: 'A website, an npm package or a GitHub project', act: { open: 'reverse' } },
      { text: 'Even an .apk or an .exe', act: { open: 'reverse' } },
      { text: 'The report arrives in a few minutes', act: { open: 'reverse' } },
    ],
    dyk: 'It runs on GitHub’s free computers, not on this phone.',
  },
  space: {
    name: 'Space',
    promise: 'Plan a room to scale: will the sofa fit?',
    can: [
      { text: 'Will it fit? Try a piece before you buy it', act: { open: 'space', panel: 'WILL IT FIT' } },
      { text: 'Describe your home and he draws the plan', act: { open: 'space', panel: 'DESIGN MY HOME' } },
      { text: 'Make space: up to three better layouts', act: { open: 'space', panel: 'MAKE SPACE' } },
      { text: 'A design review against UK guidance', act: { open: 'space', panel: 'DESIGN REVIEW' } },
      { text: 'Doors, windows and L-shaped rooms', act: { open: 'space', panel: 'ROOMS' } },
    ],
    dyk: 'Gaps narrower than a 70 cm walkway show in red, so you can see where you would squeeze past.',
  },
  workbench: {
    name: 'Workbench',
    promise: 'Engineering first estimates, never certified',
    can: [
      { text: 'Will a beam hold? Bend and stress', act: { open: 'workbench', panel: 'BEAM' } },
      { text: 'Gear ratios and an engine’s power', act: { open: 'workbench', panel: 'GEARS' } },
      { text: 'Wings, cars, projectiles and orbits', act: { open: 'workbench', panel: 'WING' } },
      { text: 'Heat loss, sun and shadow, circuits', act: { open: 'workbench', panel: 'HEAT' } },
    ],
    dyk: 'Every answer says how it was worked out, what it assumed and what would change it — and that it is a first estimate, never certified.',
  },
  learn: {
    name: 'Learn',
    promise: 'Say “teach me…” and he builds you a course',
    can: [
      { text: '“Teach me how the stock market works”', act: { ask: 'Teach me how the stock market works' } },
      { text: 'Lessons with sources, read aloud', act: { open: 'learn' } },
      { text: 'Quizzes that mark themselves', act: { open: 'learn' } },
      { text: 'Revise your flashcards', act: { run: 'open_learn', args: { view: 'revise' } } },
    ],
    dyk: 'Flashcards come back just before you would forget them.',
  },
  gym: {
    name: 'Gym',
    promise: `He teaches himself by playing ${GAMES.length} games`,
    can: [
      { text: 'Watch him play: mazes, sudoku, chess, Go', act: { open: 'gym' } },
      { text: 'Train all, and watch the levels climb', act: { open: 'gym' } },
      { text: 'Play him at chess', act: { run: 'open_gym', args: { game: 'chess' } } },
    ],
    dyk: 'Mastery is measured against the right answers, never guessed.',
  },
  school: {
    name: 'School',
    promise: 'He sits real exams, nursery to university',
    can: [
      { text: 'Watch him sit a paper, question by question', act: { open: 'school', panel: 'THIS STAGE' } },
      { text: 'Every answer, its marks and the marker’s note', act: { open: 'school', panel: 'RESULTS' } },
      { text: 'Real SATs, GCSE and A-level papers', act: { open: 'school', panel: 'OFFICIAL PAPERS' } },
      { text: 'A report on how he did, every night', act: { open: 'school', panel: 'NIGHTLY REPORT' } },
    ],
    dyk: 'He moves up a stage only with top grades in every subject, on papers he has never trained on.',
  },
  library: {
    name: 'Library',
    promise: 'Everything he has read, searchable offline',
    can: [
      { text: 'Add books and PDFs for him to read', act: { open: 'library', panel: 'ADD KNOWLEDGE' } },
      { text: 'Search it by meaning or by keywords', act: { open: 'library', panel: 'ASK THE LIBRARY' } },
      { text: 'Fresh today: the news and papers he gathered', act: { open: 'library', panel: 'FRESH TODAY' } },
      { text: 'See what he is studying by himself', act: { open: 'library', panel: 'SELF-STUDY' } },
    ],
    dyk: 'A copy lives on this phone, so the library still answers with no signal.',
  },
  agenda: {
    name: 'Agenda',
    promise: 'Your diary, reminders and the jobs he runs',
    can: [
      { text: 'Your reminders and his scheduled jobs', act: { open: 'agenda', panel: 'REMINDERS' } },
      { text: 'Connect your calendars', act: { open: 'agenda', panel: 'CALENDARS' } },
      { text: '“What’s on this week?”', act: { ask: 'What’s on this week?' } },
    ],
  },
  markets: {
    name: 'Markets',
    promise: 'Crypto, indices and currencies, live',
    can: [
      { text: 'Bitcoin and friends, with the day’s change', act: { open: 'markets', panel: 'CRYPTO' } },
      { text: 'The FTSE, gold, oil and currencies', act: { open: 'markets' } },
      { text: '“Why is bitcoin moving today?”', act: { ask: 'Why is bitcoin moving today?' } },
    ],
  },
  threats: {
    name: 'Threats',
    promise: 'Quakes, storms, space weather: worst first',
    can: [
      { text: 'See what is near you right now', act: { open: 'threats', panel: 'NEAR YOU' } },
      { text: 'Check a website’s weak spots (Recon)', act: { open: 'threats', panel: 'RECON' } },
      { text: 'Tap a quake to fly there on the globe', act: { open: 'threats', panel: 'ACTIVE SIGNALS' } },
    ],
  },
  radio: {
    name: 'Radio',
    promise: 'Stations from everywhere: “play some jazz”',
    can: [
      { text: '“Play some jazz”', act: { ask: 'Play some jazz' } },
      { text: 'Search by name, genre or country', act: { open: 'radio', panel: 'STATIONS' } },
      { text: 'Keep your favourites one tap away', act: { open: 'radio', panel: 'FAVOURITES' } },
    ],
  },
  memory: {
    name: 'Memory',
    promise: 'What he knows about you, and where from',
    can: [
      { text: 'Edit, lock or forget any memory, with undo', act: { open: 'memory' } },
      { text: 'Patterns he noticed in your days', act: { open: 'memory' } },
      { text: 'Read the diary he writes each night', act: { open: 'memory', panel: 'DIARY' } },
    ],
    dyk: 'Every night he looks back over the day’s chats and writes a diary entry. Passwords and card numbers are never kept.',
  },
  settings: {
    name: 'Settings',
    promise: 'Make him yours: colour, voice, manner',
    can: [
      { text: 'Pick his colour: Reactor or Graphite', act: { open: 'settings', panel: 'THEME' } },
      { text: 'Three dials: how dry, how brief, how warm', act: { open: 'settings', panel: 'CHARACTER' } },
      { text: 'Choose the voice he speaks in', act: { open: 'settings', panel: 'VOICE' } },
      { text: 'Download the offline brain', act: { open: 'settings', panel: 'OFFLINE BRAIN' } },
    ],
  },
  system: {
    name: 'System',
    promise: 'Under the bonnet: models, keys, backups',
    can: [
      { text: 'See which free AI models are answering', act: { open: 'system', panel: 'AI MODELS' } },
      { text: 'Back up this phone every day', act: { open: 'system', panel: 'BACKUP' } },
      { text: 'The offline brain’s report card', act: { open: 'system', panel: 'OFFLINE BRAIN REPORT' } },
    ],
  },
  links: {
    name: 'Links',
    promise: 'Connect email, Spotify, Telegram, phone',
    can: [
      { text: 'Message him on Telegram, voice notes too', act: { open: 'links', panel: 'TELEGRAM' } },
      { text: 'Notifications on this phone', act: { open: 'links', panel: 'PHONE' } },
      { text: 'Live traffic from TomTom', act: { open: 'links', panel: 'LIVE TRAFFIC' } },
    ],
    dyk: 'Every key you give him goes into an encrypted vault and is never shown again.',
  },
  // ABILITIES (OWNER-ISSUES 68): made from what he really has (abilities/registry.ts), so it is always true
  abilities: {
    name: 'Abilities',
    promise: 'Everything he can do, and what he learns',
    can: [
      { text: 'Ask “can you…?” and he says, or learns it', act: { open: 'abilities', panel: 'CAN YOU' } },
      { text: 'Every ability, each with GO to try it', act: { open: 'abilities' } },
      { text: 'What he is learning for you', act: { open: 'abilities', panel: 'LEARNING' } },
      { text: 'Anything he still needs a key for', act: { open: 'system', panel: 'KEYS' } },
    ],
    dyk: 'The list is made from what he really has, so a new ability shows up there by itself.',
  },
};

/** A TRY THIS NOW pick: the screen it belongs to, the words on the card and what a tap does. */
export interface TryPick {
  id: string;
  words: string;
  act: DeckAct;
}

/**
 * Eight days of picks, three a day: each day has one thing to ask and something to open, from a different screen
 * each. They go round in order, so nothing comes back within a week.
 */
export const TRY_DAYS: TryPick[][] = [
  [
    { id: 'lens', words: 'Point the Lens at a menu and translate it', act: lens('translate') },
    { id: 'core', words: 'How much sleep do adults need? With sources.', act: { ask: 'How much sleep do adults need? With sources.' } },
    { id: 'space', words: 'Will a three-seater sofa fit? Try it on a plan', act: { open: 'space', panel: 'WILL IT FIT' } },
  ],
  [
    { id: 'eye', words: 'See the traffic cameras nearest home', act: camerasNearHome },
    { id: 'radio', words: 'Play some jazz', act: { ask: 'Play some jazz' } },
    { id: 'school', words: 'See how Ghosty did in his last exam', act: { open: 'school', panel: 'RESULTS' } },
  ],
  [
    { id: 'lens', words: 'Measure a wall from a photo, no tape needed', act: lens('measure') },
    { id: 'markets', words: 'Why is bitcoin moving today?', act: { ask: 'Why is bitcoin moving today?' } },
    { id: 'gym', words: 'Watch him teach himself sudoku', act: { run: 'open_gym', args: { game: 'sudoku' } } },
  ],
  [
    { id: 'studio', words: 'Take the arc reactor apart, piece by piece', act: { run: 'open_studio', args: { sample: 'reactor' } } },
    { id: 'learn', words: 'Teach me how the stock market works', act: { ask: 'Teach me how the stock market works' } },
    { id: 'threats', words: 'See what is happening near you', act: { open: 'threats', panel: 'NEAR YOU' } },
  ],
  [
    { id: 'lens', words: 'Point at a plane overhead: how high, how far', act: lens('aim') },
    { id: 'agenda', words: 'What’s on this week?', act: { ask: 'What’s on this week?' } },
    { id: 'library', words: 'Read what he gathered for you this morning', act: { open: 'library', panel: 'FRESH TODAY' } },
  ],
  [
    { id: 'eye', words: 'Plan a bus or train journey', act: { run: 'journey_planner' } },
    { id: 'brief', words: 'What should I wear today?', act: { ask: 'What should I wear today?' } },
    { id: 'memory', words: 'See what he knows about you', act: { open: 'memory' } },
  ],
  [
    { id: 'lens', words: 'Scan a QR code and see where it really goes', act: lens('scan') },
    { id: 'workshop', words: 'Make me a little snake game to play', act: { ask: 'Make me a little snake game to play' } },
    { id: 'agenda', words: 'Connect your calendar', act: { open: 'agenda', panel: 'CALENDARS' } },
  ],
  [
    { id: 'space', words: 'Ask for a design review of your room', act: { open: 'space', panel: 'DESIGN REVIEW' } },
    { id: 'core', words: 'Explain how a jet engine works, simply', act: { ask: 'Explain how a jet engine works, simply' } },
    { id: 'settings', words: 'Make him drier, briefer or warmer', act: { open: 'settings', panel: 'CHARACTER' } },
  ],
];

/** Today's three picks: the day's place in the round of eight, counted from the local date. */
export function picksFor(d = new Date()): TryPick[] {
  const day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
  return TRY_DAYS[day % TRY_DAYS.length]!;
}
