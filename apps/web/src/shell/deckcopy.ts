/**
 * The words of the Every screen deck (shell/launcher.ts; OWNER-ISSUES 33–34): for each screen of the deck (DECK_GROUPS) its
 * name, a promise (one line of at most 44 characters, so it never needs cutting on a half card), three to five
 * YOU CAN lines, each with what a tap does (a deep link into the right screen and mode, or an example said to
 * Ghosty), and a DID YOU KNOW where there is a true one; then the TRY THIS NOW picks, three a day.
 *
 * Every claim is one the app makes good on: checked against MAP.md and each feature's own header comment
 * (features/<tab>/index.ts and the files it names). Not claimed: naming plants, birds or insects (the Lens names
 * things from everyday-name lists), calories from a photo of dinner (Lens's ASK sends the picture to the brain,
 * nothing more). SCHOOL is Ghosty's own schooling: he sits the papers.
 * British English, plain words; "he" is Ghosty.
 */
import { META as GAMES } from '../gym/meta';
import { home } from '../state/app';
import { REVERSE_SUB } from '../features/reverse/words';

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
  ['Ask and see', ['core', 'brief', 'eye', 'lens', 'interpreter']],
  ['Make', ['studio', 'workshop', 'reverse', 'space', 'workbench', 'convert', 'docs', 'sheets', 'slides', 'workspace', 'photo', 'video', 'gamestudio', 'comic', 'house']],
  ['Learn and plan', ['learn', 'arcade', 'gym', 'school', 'library', 'learning', 'coach', 'rehearse', 'agenda', 'markets', 'threats', 'radio']],
  // [tabs] LIFE (BRIEF-TABS 4): the tab bar's seventh area, its eight everyday screens
  ['Life', ['money', 'body', 'kitchen', 'people', 'work', 'creative', 'outside', 'homeadmin']],
  ['Me', ['memory', 'settings', 'system', 'links', 'social']],
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
      { text: 'Brief me: weather and headlines in 90 words', act: { open: 'brief' } },
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
  interpreter: {
    name: 'Interpreter',
    promise: 'Two halves, two languages: hold and talk',
    can: [
      { text: 'Hold your key and speak: the far half writes and says it', act: { open: 'interpreter' } },
      { text: 'Hand the phone over: they hold theirs and answer', act: { open: 'interpreter' } },
      { text: 'Pick the two languages once; the last pair is remembered', act: { open: 'interpreter' } },
      { text: 'No signal: the phone translates by itself, roughly', act: { open: 'interpreter' } },
    ],
    dyk: 'Nothing is recorded and nothing of the other person is kept: it is gone when you leave.',
  },
  rehearse: {
    name: 'Rehearse',
    promise: 'Practise a hard talk against me, in three rounds',
    can: [
      { text: 'A job interview for a junior mechanic', act: { open: 'rehearse?situation=a%20job%20interview%20for%20a%20junior%20mechanic' } },
      { text: 'Telling my landlord about the damp', act: { open: 'rehearse?situation=telling%20my%20landlord%20about%20the%20damp' } },
      { text: 'Talk for a minute: your filler words, your pace, the line to cut', act: { open: 'rehearse?talk' } },
      { text: 'Notes on what landed and what to tighten, in five lines', act: { open: 'rehearse' } },
    ],
    dyk: 'Nothing is kept unless you tap KEEP, and the other side’s lines are never kept.',
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
      { text: 'Experiments on free public data: the lab', act: { open: 'lab' } },
    ],
    dyk: 'Every morning he suggests upgrades for himself; one tap on Build starts one.',
  },
  reverse: {
    name: 'Reverse',
    promise: REVERSE_SUB,
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
      { text: 'The wind tunnel: air round a wing, live', act: { open: 'workbench', panel: 'WIND TUNNEL' } },
      { text: 'Will a beam hold? Bend and stress', act: { open: 'workbench', panel: 'BEAM' } },
      { text: 'Gear ratios, worked out', act: { open: 'workbench', panel: 'GEARS' } },
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
  // [consistency] the Arcade was in DECK_GROUPS with no words: its card showed no YOU CAN lines (FINAL-CONSISTENCY)
  arcade: {
    name: 'Arcade',
    promise: 'Real classics, free, kept on the phone',
    can: [
      { text: 'DOOM, Quake and more off the shelf', act: { open: 'arcade', panel: 'THE SHELF' } },
      { text: 'Free DOOM levels fans made', act: { open: 'arcade', panel: 'THE FREE LEVELS' } },
      { text: 'Play the games you made', act: { open: 'arcade', panel: 'MY GAMES' } },
    ],
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
  // [reader] the Library as a library (BRIEF-LIBRARY-READER 5): his books, read in the reader or read to him, his place kept
  library: {
    name: 'Library',
    promise: 'Your books, read here or read to you',
    can: [
      { text: 'Open a book where you left it', act: { open: 'library', panel: 'SHELF' } },
      { text: '“Where were we?” and he reads on aloud', act: { ask: 'Where were we?' } },
      { text: 'Add books and PDFs for him to read', act: { open: 'library', panel: 'ADD KNOWLEDGE' } },
      { text: 'Search it by meaning or by keywords', act: { open: 'library', panel: 'ASK THE LIBRARY' } },
      { text: 'Fresh today: the news and papers he gathered', act: { open: 'library', panel: 'FRESH TODAY' } },
    ],
    dyk: 'Your place in every book is kept on this phone and on his brain, so another device opens it where you left off.',
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
    promise: 'Crypto, gold and currencies, live',
    can: [
      { text: 'Bitcoin and friends, with the day’s change', act: { open: 'markets', panel: 'CRYPTO' } },
      { text: 'Gold, silver and what £1 buys abroad', act: { open: 'markets', panel: 'GOLD & SILVER' } },
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
    promise: 'Make him yours: his look, voice, manner',
    can: [
      // [consistency] Settings → THEME is the gallery: seven looks and twelve colours (the presets and dials are on THE LOOK)
      { text: 'Pick his look: seven looks, twelve colours', act: { open: 'settings', panel: 'THEME' } },
      // THE LOOK (BRIEF-DESIGN-SYSTEM 5): the design system shown by itself, a row of Settings
      { text: 'The look: how he draws everything', act: { open: 'look' } },
      { text: 'Four dials: dry, brief, warm and fiery', act: { open: 'settings', panel: 'CHARACTER' } },
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
  // ---------------------------------------------------------------- [tabs] the fourteen sheets as screens (BRIEF-TABS 4):
  // what each does for him, a tap into its main page and two things to ask, and a true DID YOU KNOW
  money: {
    name: 'Money',
    promise: 'Your spending, read from your statements',
    can: [
      { text: 'Paste a statement: the month in one card', act: { open: 'money', panel: 'PASTE A STATEMENT' } },
      { text: 'How much did I spend this week?', act: { ask: 'How much did I spend this week?' } },
      { text: 'Where is the cheapest petrol near me?', act: { ask: 'Where is the cheapest petrol near me?' } },
    ],
    dyk: 'No AI sees your statement, not even the shop names: a table of rules sorts it, in code, and he never has bank access.',
  },
  body: {
    name: 'Body',
    promise: 'Reps, runs, breathing and water',
    can: [
      { text: 'Count your squats with the camera', act: { open: 'body', panel: 'COUNT MY REPS' } },
      { text: 'Start a run', act: { ask: 'Start a run' } },
      { text: 'Breathe with me', act: { ask: 'Breathe with me' } },
    ],
    dyk: 'The pose model counting your reps runs on the phone: the camera never sends a picture anywhere.',
  },
  kitchen: {
    name: 'Kitchen',
    promise: 'Timers, the shopping list and meals',
    can: [
      { text: 'The shopping list, ticked off as you go', act: { open: 'kitchen', panel: 'SHOPPING LIST' } },
      { text: 'Fan 180 in a conventional oven?', act: { ask: 'Fan 180 in conventional?' } },
      { text: 'What can I cook with eggs and spinach?', act: { ask: 'What can I cook with eggs and spinach?' } },
    ],
    dyk: 'Several timers can run at once, each with its own name, and they carry on after a reload.',
  },
  people: {
    name: 'People',
    promise: 'The people you told him about',
    can: [
      { text: 'Who’s who: birthdays and what you said', act: { open: 'people', panel: 'YOUR PEOPLE' } },
      { text: 'Gift ideas for Mum', act: { ask: 'Gift ideas for Mum' } },
      { text: 'Any birthdays this month?', act: { ask: 'Any birthdays this month?' } },
    ],
    dyk: 'He only knows what you tell him, and he never looks anyone up.',
  },
  work: {
    name: 'Work',
    promise: 'Your to-do list and interview practice',
    can: [
      { text: 'Your to-do list, kept in his brain', act: { open: 'work', panel: 'TO-DO' } },
      { text: 'Interview practice for a barista job', act: { ask: 'Interview practice for a barista job' } },
      { text: 'Write a cover letter for a barista job', act: { ask: 'Write a cover letter for a barista job' } },
    ],
    dyk: 'Nothing is sent for you: a CV, a cover letter or an email comes as text to copy or share.',
  },
  creative: {
    name: 'Creative',
    promise: 'Songs, posters, cards, comics and beats',
    can: [
      { text: 'Drum pads: tap along with a loop', act: { open: 'creative', panel: 'DRUM PADS' } },
      { text: 'What should I draw today?', act: { ask: 'What should I draw?' } },
      { text: 'A poster for the car boot sale', act: { ask: 'Make a poster for the car boot sale on Saturday' } },
    ],
    dyk: 'Every picture is laid out in code and drawn on the phone, and saved to your downloads only when you tap.',
  },
  outside: {
    name: 'Outside',
    promise: 'A safer walk, toilets, parking, the way',
    can: [
      { text: 'A safer walk, scored on street reports', act: { open: 'outside', panel: 'WALK' } },
      { text: 'Toilets near me', act: { ask: 'Toilets near me' } },
      { text: 'Where did I park?', act: { ask: 'Where did I park?' } },
    ],
    dyk: 'Where you are is asked only when you tap, used for that one question and kept nowhere.',
  },
  homeadmin: {
    name: 'Household',
    promise: 'Bins, bills, meters and what is due',
    can: [
      { text: 'What is due at home, in date order', act: { open: 'homeadmin', panel: 'DUE' } },
      { text: 'When are the bins?', act: { ask: 'When are the bins?' } },
      { text: 'What’s due this month?', act: { ask: 'What’s due this month?' } },
    ],
    dyk: 'A photo of a bill is read on the phone; only the supplier, the amount and the date go to his brain.',
  },
  learning: {
    name: 'Learning',
    promise: 'Words, typing, maths and first aid',
    can: [
      { text: 'Ten words a day in eight languages', act: { open: 'learning', panel: 'WORDS' } },
      { text: 'Ten words in Spanish', act: { ask: 'Ten words in Spanish' } },
      { text: 'A quick maths drill', act: { ask: 'Maths drill' } },
    ],
    dyk: 'The first aid steps are the NHS’s published ones, as practice: for a real emergency, call 999.',
  },
  coach: {
    name: 'Coach',
    promise: 'A tuner, and lessons that listen',
    can: [
      { text: 'Tune your guitar by the microphone', act: { open: 'coach', panel: 'TUNER' } },
      { text: 'Teach me guitar', act: { ask: 'Teach me guitar' } },
      { text: 'Typing test', act: { ask: 'Typing test' } },
    ],
    dyk: 'He hears the notes in code on the phone: nothing is recorded to keep, and what a microphone cannot judge he says.',
  },
  social: {
    name: 'Social',
    promise: 'Your accounts; every post waits for you',
    can: [
      { text: 'Posts waiting for your APPROVE', act: { open: 'social', panel: 'WAITING FOR YOUR APPROVE' } },
      { text: 'What’s on Bluesky?', act: { ask: 'What’s on Bluesky?' } },
      { text: 'Who made you?', act: { ask: 'Who made you?' } },
    ],
    dyk: 'Nothing goes out without your APPROVE, and a draft is gone after 24 hours.',
  },
  convert: {
    name: 'Convert',
    promise: 'Files into other formats, on this phone',
    can: [
      { text: 'Pictures, PDFs, Word, tables and sound', act: { open: 'convert' } },
      { text: 'Convert this to PDF', act: { ask: 'Convert this to PDF' } },
      { text: '3.5 miles in km', act: { ask: '3.5 miles in km' } },
    ],
    dyk: 'Nothing is uploaded: every conversion happens on the phone, even a PDF split or a recording.',
  },
  docs: {
    name: 'Documents',
    promise: 'Read, write, edit and translate',
    can: [
      { text: 'Your documents, kept on this phone', act: { open: 'docs' } },
      { text: 'Write a letter to my landlord about the damp', act: { ask: 'Write a letter to my landlord about the damp' } },
      { text: 'Translate my letter into Urdu', act: { ask: 'Translate my letter into Urdu' } },
    ],
    dyk: 'A translation keeps every heading and list in its place, beside the original.',
  },
  sheets: {
    name: 'Spreadsheets',
    promise: 'Budgets and lists, with formulas that follow',
    can: [
      { text: 'Your spreadsheets, kept on this phone', act: { open: 'sheets' } },
      { text: 'Start a household budget', act: { ask: 'New spreadsheet' } },
      { text: 'Open an Excel file', act: { ask: 'Open a spreadsheet' } },
    ],
    dyk: 'Change a rent in March and the month, the summary and the year all move at once.',
  },
  slides: {
    name: 'Presentations',
    promise: 'Slides, with your notes in your hand',
    can: [
      { text: 'Your decks, kept on this phone', act: { open: 'slides' } },
      { text: 'Make slides from a report', act: { ask: 'Make slides from a report' } },
      { text: 'Open a PowerPoint file', act: { ask: 'Open a PowerPoint file' } },
      { text: 'Builds and Magic Move, kept in PowerPoint', act: { open: 'slides' } },
    ],
    dyk: 'Press and hold a slide to move it; in the talk your notes and the next title are on the phone, not on the slide.',
  },
  workspace: {
    name: 'The workspace',
    promise: 'Pages in pages, with a brain that has read all of it',
    can: [
      { text: 'Your pages, kept on this phone', act: { open: 'workspace' } },
      { text: 'Start a project: a board, notes, decisions, deadlines', act: { ask: 'Start a project' } },
      { text: 'What is due this week in my project?', act: { ask: 'What is due this week in my project' } },
    ],
    dyk: 'A database is one list of rows: draw it as a table, a board, a calendar, a timeline or a gallery, and a change in one shows in all of them.',
  },
  photo: {
    name: 'Photo',
    promise: 'Edit a photo, kept untouched',
    can: [
      { text: 'Your photos, kept untouched on this phone', act: { open: 'photo' } },
      { text: 'Edit a photo', act: { ask: 'Edit a photo' } },
      { text: 'Straighten, grade, mask, heal and save a look', act: { open: 'photo' } },
    ],
    dyk: 'Your original is never changed: every edit is a recipe beside it, and the look you save goes onto many photos at once.',
  },
  video: {
    name: 'Video',
    promise: 'Cut, grade and score a video on this phone',
    can: [
      { text: 'Your videos, kept on this phone', act: { open: 'video' } },
      { text: 'Edit a video', act: { ask: 'Edit a video' } },
      { text: 'Cut this video', act: { ask: 'Cut this video' } },
    ],
    dyk: 'Your clips are never changed: every cut, grade and title is a recipe laid over them, and the file is made on the phone.',
  },
  house: {
    name: 'House',
    promise: 'Your smart home, room by room',
    can: [
      { text: 'Lights, heating and blinds, room by room', act: { open: 'house' } },
      { text: 'Is the back door open?', act: { ask: 'Is the back door open?' } },
      { text: 'What’s the temperature in the kitchen?', act: { ask: 'What’s the temperature in the kitchen?' } },
    ],
    dyk: 'A lock, an alarm or a garage door asks your confirm on every tap, and nothing acts on a schedule.',
  },
  gamestudio: {
    name: 'Game studio',
    promise: 'Make a 2-D game on your phone',
    can: [
      { text: 'Make a game from a template', act: { open: 'gamestudio' } },
      { text: 'Make a game', act: { ask: 'Make a game' } },
      { text: 'My games', act: { ask: 'My games' } },
    ],
    dyk: 'A game you make stays on this phone until you share it or put it on your Home Screen as an app.',
  },
  comic: {
    name: 'Comic',
    promise: 'Read your comics and make your own',
    can: [
      { text: 'Make a comic about a cat who wants to fly', act: { ask: 'Make me a comic about a cat who wants to fly' } },
      { text: 'Read a comic', act: { ask: 'Read a comic' } },
      { text: 'Free public-domain comics', act: { ask: 'Public domain comics' } },
    ],
    dyk: 'A CBZ, a PDF or a folder of pictures becomes a comic on your shelf, read panel by panel, and it never leaves this phone.',
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
