/**
 * The catalogue's words for FURTHER (BRIEF-OCT-IDEAS-3): the interpreter, the orb as a map of what I know, the tools I draft for
 * myself, the lab, WALK ME THROUGH IT, WHAT CHANGED SINCE YESTERDAY, REHEARSE, places and spending together, the nature diary.
 * Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-11';

export const FURTHER_WORDS: Record<string, CatValue> = {
  // ---- INTERPRETER (SEE)
  'screen:interpreter': {
    name: 'The interpreter: two languages',
    line: 'You can hold a key and speak; I write it for the other person and say it in their language, and they answer the same way.',
    more: 'Two halves of the screen, one facing you and one facing them, upside down. I listen with this phone’s own speech recognition and speak with its own voice, and translate with my brain, or on the phone itself when there is no signal. Nothing is recorded and nothing of the other person is kept.',
    say: ['Interpreter', 'Translate for us', 'Help me talk to a French speaker'], scene: ['out', 'talking', 'phone'], cat: 'see', since: SINCE,
  },
  'deck:interpreter:hold-your-key-and-speak-the': { same: 'screen:interpreter' },
  'deck:interpreter:hand-the-phone-over-they-hold': { same: 'screen:interpreter' },
  'deck:interpreter:pick-the-two-languages-once-the': { same: 'screen:interpreter' },
  'deck:interpreter:no-signal-the-phone-translates-by': { same: 'screen:interpreter' },

  // ---- THE LAB (MAKE)
  'screen:lab': {
    name: 'The lab: free public data',
    line: 'I can run experiments on free public data, keep each as a page, and run it again whenever you like.',
    more: 'Make → Workshop → THE LAB, or just say the lab. Five to start with: earthquakes by month, the rain at Home against what the forecast said, how punctual the buses are, the markets’ week and space weather. Each page says its source, shows a chart and a table, says what it showed and when it ran. EXPORT builds it as a page of its own.',
    say: ['Open the lab', 'Run the quakes page again'], scene: ['making', 'phone'], cat: 'build', since: SINCE,
  },
  'deck:workshop:experiments-on-free-public-data-the': { same: 'screen:lab' },
  'panel:workshop:THE LAB': { same: 'screen:lab' },
  'panel:lab:EXPERIMENTS': {
    name: 'The five experiment pages',
    line: 'You can read each experiment’s question, source, chart and table, run it again, or export it as a page of its own.',
    more: 'A page that has never run is run once when the lab first opens. RUN IT AGAIN reads the source again and the date moves. A source that does not answer leaves the last run as it was and says so.',
    say: ['Run the rain page again'], scene: ['making'], cat: 'build', since: SINCE,
  },

  // ---- HIS OWN MISSING TOOLS (the Workshop)
  'panel:workshop:DRAFTED JOBS': {
    name: 'Changes I drafted for myself',
    line: 'You can read the changes I drafted when you said yes to my learning something: the plan, the files and the test.',
    more: 'Each is a paragraph in your words, the files I would touch as a first guess and the test I would add. SHIP IT starts the change in the chat, where it is built and checked first; nothing goes live until you ship it from the proposed changes. DROP IT has UNDO.',
    say: ['Can you teleport me?', '(then tap YES)'], scene: ['making', 'behind'], cat: 'build', since: SINCE,
  },

  // ---- REHEARSE (LEARN)
  'screen:rehearse': {
    name: 'Rehearse a talk or conversation',
    line: 'You can rehearse a conversation or a talk with me: I play the other side for three rounds, then give you notes.',
    more: 'Say the situation in your words, a job interview for a junior mechanic or telling your landlord about the damp. I play the other side as firm or as fiery as your Character setting says, you answer by voice or by typing, and after three rounds you get five lines on what landed and what to tighten. Nothing is kept unless you tap KEEP.',
    say: ['Rehearse a job interview for a junior mechanic', 'Help me practise telling my landlord about the damp'], scene: ['school', 'talking'], cat: 'learn', since: SINCE,
  },
  'panel:rehearse:A CONVERSATION': {
    name: 'Three rounds against me',
    line: 'You can say the situation, answer the other side by voice or text for three rounds, and get notes counted from your own answers.',
    more: 'The notes say what landed and what to tighten in five lines: your most concrete answer, how steady you were, the line to cut, your filler words and how you began. The other side’s lines are never kept; KEEP keeps your answers and the notes on this phone.',
    say: ['Rehearse telling my landlord about the damp'], scene: ['school', 'talking'], cat: 'learn', since: SINCE,
  },
  'panel:rehearse:A TALK FOR A MINUTE': {
    name: 'Talk for a minute',
    line: 'You can talk for a minute, or type what you would say, and get your filler words, your pace and the one line to cut.',
    more: 'The pace is words a minute against the 110 to 160 that people follow easily. The one line to cut is the longest sentence, or the one fullest of filler words. Nothing is kept.',
    say: ['Practise my presentation'], scene: ['school', 'talking'], cat: 'learn', since: SINCE,
  },
  'section:rehearse:conversation': { same: 'panel:rehearse:A CONVERSATION' },
  'section:rehearse:talk': { same: 'panel:rehearse:A TALK FOR A MINUTE' },
  'deck:rehearse:a-job-interview-for-a-junior': { same: 'screen:rehearse' },
  'deck:rehearse:telling-my-landlord-about-the-damp': { same: 'screen:rehearse' },
  'deck:rehearse:talk-for-a-minute-your-filler': { same: 'screen:rehearse' },
  'deck:rehearse:notes-on-what-landed-and-what': { same: 'screen:rehearse' },

  // ---- THE WORDS FURTHER ANSWERS IN THE CHAT (no model)
  'phrase:further': {
    name: 'Interpreter, map, walk, changes',
    line: 'You can say interpreter, what do you know, walk me through a screen, what changed, or rehearse something, and I do it.',
    more: 'Each is answered on the phone with no model: the interpreter opens, the map of what I know opens, a pointer walks you through a screen step by step, the plan’s lines for what changed since yesterday are read out, and REHEARSE opens with your situation filled in.',
    say: ['Translate for us', 'What do you know?', 'Walk me through the library', 'What changed?'], scene: ['talking', 'phone'], cat: 'talk', since: SINCE,
    go: { ask: 'What changed?', send: true },
  },

  // ---- THE NATURE DIARY (the Library's shelf)
  'panel:library:NATURE DIARY': {
    name: 'Your nature diary',
    line: 'You can read every bird, plant or insect you kept from the Lens, with the day and where you were.',
    more: 'In the Lens, NAME IT, then tap KEEP: nothing is kept by itself. Each is kept with where you were then, from your own position at that moment, on this phone only and never sent to my brain. A small map shows where from your home. READ IT TO ME says the lines; FORGET has UNDO.',
    say: ['Show my nature diary', '(Lens, NAME IT, KEEP)'], scene: ['out', 'camera', 'phone'], cat: 'learn', since: SINCE,
  },

  // ---- their cards on the rooms' hubs are the screens' own
  'hub:interpreter': { same: 'screen:interpreter' },
  'hub:rehearse': { same: 'screen:rehearse' },
};
