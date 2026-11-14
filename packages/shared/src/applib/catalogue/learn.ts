import type { AppDef } from '../types';

/**
 * The Library's learn apps (docs/build-plan/APPLIB.md, list docs/build-plan/applib/catalogue-learn.md).
 * Decks hold only settled facts; calcs carry their public source and tests worked from it. The list's apps that
 * need their own engineering are named in docs/build-plan/APPLIB-CAT-C.md, never faked here.
 */

type Card = { q: string; a: string };
const pairs = (rows: [string, string][]): Card[] => rows.map(([q, a]) => ({ q, a }));
/** "a=b;c=d" into cards, for long lists of short facts. */
const list = (text: string, sep = ';'): Card[] =>
  text.split(sep).map((s) => s.trim()).filter(Boolean).map((s) => {
    const i = s.indexOf('=');
    return { q: s.slice(0, i).trim(), a: s.slice(i + 1).trim() };
  });

/* ---------- Periodic table: names and symbols (IUPAC), group, period and block worked out from the atomic number. */
const ELEMENTS =
  'H Hydrogen,He Helium,Li Lithium,Be Beryllium,B Boron,C Carbon,N Nitrogen,O Oxygen,F Fluorine,Ne Neon,Na Sodium,' +
  'Mg Magnesium,Al Aluminium,Si Silicon,P Phosphorus,S Sulphur,Cl Chlorine,Ar Argon,K Potassium,Ca Calcium,Sc Scandium,' +
  'Ti Titanium,V Vanadium,Cr Chromium,Mn Manganese,Fe Iron,Co Cobalt,Ni Nickel,Cu Copper,Zn Zinc,Ga Gallium,' +
  'Ge Germanium,As Arsenic,Se Selenium,Br Bromine,Kr Krypton,Rb Rubidium,Sr Strontium,Y Yttrium,Zr Zirconium,' +
  'Nb Niobium,Mo Molybdenum,Tc Technetium,Ru Ruthenium,Rh Rhodium,Pd Palladium,Ag Silver,Cd Cadmium,In Indium,Sn Tin,' +
  'Sb Antimony,Te Tellurium,I Iodine,Xe Xenon,Cs Caesium,Ba Barium,La Lanthanum,Ce Cerium,Pr Praseodymium,' +
  'Nd Neodymium,Pm Promethium,Sm Samarium,Eu Europium,Gd Gadolinium,Tb Terbium,Dy Dysprosium,Ho Holmium,Er Erbium,' +
  'Tm Thulium,Yb Ytterbium,Lu Lutetium,Hf Hafnium,Ta Tantalum,W Tungsten,Re Rhenium,Os Osmium,Ir Iridium,Pt Platinum,' +
  'Au Gold,Hg Mercury,Tl Thallium,Pb Lead,Bi Bismuth,Po Polonium,At Astatine,Rn Radon,Fr Francium,Ra Radium,' +
  'Ac Actinium,Th Thorium,Pa Protactinium,U Uranium,Np Neptunium,Pu Plutonium,Am Americium,Cm Curium,Bk Berkelium,' +
  'Cf Californium,Es Einsteinium,Fm Fermium,Md Mendelevium,No Nobelium,Lr Lawrencium,Rf Rutherfordium,Db Dubnium,' +
  'Sg Seaborgium,Bh Bohrium,Hs Hassium,Mt Meitnerium,Ds Darmstadtium,Rg Roentgenium,Cn Copernicium,Nh Nihonium,' +
  'Fl Flerovium,Mc Moscovium,Lv Livermorium,Ts Tennessine,Og Oganesson';
const ELS = ELEMENTS.split(',').map((s, i) => {
  const [sym = '', name = ''] = s.split(' ');
  return { z: i + 1, sym, name };
});
function place(z: number): { period: number; group?: number; block: string; series?: string } {
  const ends = [2, 10, 18, 36, 54, 86, 118];
  const period = ends.findIndex((e) => z <= e) + 1;
  const start = period === 1 ? 1 : (ends[period - 2] ?? 0) + 1;
  const pos = z - start + 1;
  const len = (ends[period - 1] ?? 0) - start + 1;
  if (period === 1) return { period, group: z === 1 ? 1 : 18, block: 's' };
  if (pos <= 2) return { period, group: pos, block: 's' };
  if (len === 8) return { period, group: pos + 10, block: 'p' };
  if (len === 18) return { period, group: pos, block: pos <= 12 ? 'd' : 'p' };
  // Periods 6 and 7: positions 3 to 17 are the lanthanides or actinides.
  if (pos <= 17) return { period, block: 'f', series: period === 6 ? 'lanthanide' : 'actinide' };
  const group = pos - 14;
  return { period, group, block: group <= 12 ? 'd' : 'p' };
}
const ELEMENT_SECTIONS = ELS.map(({ z, sym, name }) => {
  const p = place(z);
  const where = p.series ? `Period ${p.period}, ${a(p.series)}.` : `Period ${p.period}, group ${p.group}, ${p.block}-block.`;
  return {
    title: `${z} ${name} (${sym})`,
    body: `Symbol ${sym}, atomic number ${z}. ${where}`,
    tags: [sym.toLowerCase(), `period ${p.period}`, ...(p.series ? [p.series] : [`${p.block}-block`, `group ${p.group}`])],
  };
});
function a(series: string): string {
  return series === 'actinide' ? 'an actinide' : 'a lanthanide';
}

/* ---------- Squares and roots: worked out, never typed by hand. */
const SQUARES: Card[] = [];
for (let n = 2; n <= 20; n++) SQUARES.push({ q: `${n} squared`, a: String(n * n) }, { q: `Square root of ${n * n}`, a: String(n) });
for (let n = 2; n <= 10; n++) SQUARES.push({ q: `${n} cubed`, a: String(n ** 3) });

/* ---------- Roman numerals, worked out. */
function roman(n: number): string {
  const t: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '';
  for (const [v, r] of t) while (n >= v) { s += r; n -= v; }
  return s;
}
const ROMAN: Card[] = [1, 4, 5, 9, 10, 14, 19, 40, 44, 50, 90, 99, 100, 400, 500, 900, 1000, 1066, 1492, 1666, 1815, 1918, 1945, 1999, 2026, 3999]
  .map((n) => ({ q: roman(n), a: String(n) }));

/* ---------- Morse code (ITU-R M.1677-1). */
const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  1: '.----', 2: '..---', 3: '...--', 4: '....-', 5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.', 0: '-----',
};
const MORSE_CARDS: Card[] = Object.entries(MORSE).map(([k, v]) => ({ q: v.replace(/\./g, '·').replace(/-/g, '–').split('').join(' '), a: k }));

/* ---------- Binary and hex, worked out. */
const BASES: Card[] = [];
for (const n of [1, 2, 3, 4, 5, 7, 8, 10, 12, 15, 16, 32, 64, 100, 127, 128, 255]) BASES.push({ q: `${n.toString(2)} in binary`, a: String(n) });
for (const n of [10, 11, 12, 13, 14, 15, 16, 26, 32, 64, 100, 127, 128, 200, 255]) BASES.push({ q: `${n.toString(16).toUpperCase()} in hex`, a: String(n) });

export const LEARN: AppDef[] = [
  /* ===================== From the owner's list ===================== */
  {
    id: 'periodic-table', name: 'Periodic Table', family: 'learn', glyph: 'atom', archetype: 'guide', from: 'learn.19',
    pitch: 'All 118 elements with symbol, atomic number, group, period and block, offline.',
    keywords: ['periodic', 'elements', 'chemistry', 'table', 'atoms'],
    tour: ['Search a name, a symbol or a number: "Fe", "26" or "iron".', 'Search "group 18" or "d-block" to see a whole family at once.', 'Pair it with Element Cards to learn the symbols for good.'],
    guide: { sections: ELEMENT_SECTIONS, source: { name: 'Wikipedia, List of chemical elements', url: 'https://en.wikipedia.org/wiki/List_of_chemical_elements' } },
  },
  {
    id: 'music-theory', name: 'Music Theory', family: 'learn', glyph: 'music', archetype: 'deck', from: 'learn.36',
    pitch: 'Key signatures, relative minors, intervals and chord spellings as drills.',
    keywords: ['music', 'theory', 'keys', 'intervals', 'chords', 'scales'],
    tour: ['Each card is one fact players read at sight: keys, intervals, chords.', 'Say the answer before you turn the card, then mark how it went.', 'Cards you miss come back sooner, so ten minutes a day is enough.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Key signature of G major=1 sharp: F sharp;Key signature of D major=2 sharps: F sharp, C sharp;' +
        'Key signature of A major=3 sharps: F, C, G sharp;Key signature of E major=4 sharps: F, C, G, D sharp;' +
        'Key signature of B major=5 sharps: F, C, G, D, A sharp;Key signature of F major=1 flat: B flat;' +
        'Key signature of B flat major=2 flats: B flat, E flat;Key signature of E flat major=3 flats: B, E, A flat;' +
        'Key signature of A flat major=4 flats: B, E, A, D flat;Key signature of D flat major=5 flats: B, E, A, D, G flat;' +
        'Key signature of C major=No sharps or flats;Relative minor of C major=A minor;Relative minor of G major=E minor;' +
        'Relative minor of D major=B minor;Relative minor of F major=D minor;Relative minor of B flat major=G minor;' +
        'Relative minor of E flat major=C minor;Order of sharps=F C G D A E B;Order of flats=B E A D G C F;' +
        'Semitones in a minor second=1;Semitones in a major second=2;Semitones in a minor third=3;Semitones in a major third=4;' +
        'Semitones in a perfect fourth=5;Semitones in a tritone=6;Semitones in a perfect fifth=7;Semitones in a minor sixth=8;' +
        'Semitones in a major sixth=9;Semitones in a minor seventh=10;Semitones in a major seventh=11;Semitones in an octave=12;' +
        'Notes of C major chord=C, E, G;Notes of A minor chord=A, C, E;Notes of G major chord=G, B, D;Notes of F major chord=F, A, C;' +
        'Notes of D minor chord=D, F, A;Notes of E minor chord=E, G, B;Notes of G7 chord=G, B, D, F;' +
        'Major scale pattern=Tone, tone, semitone, tone, tone, tone, semitone;' +
        'Natural minor scale pattern=Tone, semitone, tone, tone, semitone, tone, tone;' +
        'Notes of C major scale=C D E F G A B;A major triad is built from=Root, major third, perfect fifth;' +
        'A minor triad is built from=Root, minor third, perfect fifth;A diminished triad is built from=Root, minor third, diminished fifth;' +
        'An augmented triad is built from=Root, major third, augmented fifth;Beats in a bar of 4/4=4 crotchets;' +
        'Beats in a bar of 3/4=3 crotchets;A minim lasts=2 crotchet beats;A semibreve lasts=4 crotchet beats;' +
        'A quaver lasts=Half a crotchet beat;A dot after a note=Adds half its value again',
      ),
    },
  },
  {
    id: 'memory-palace', name: 'Memory Palace', family: 'learn', glyph: 'home', archetype: 'log', from: 'learn.53',
    pitch: 'Place what you must remember at spots along a walk through your own home.',
    keywords: ['memory', 'palace', 'loci', 'remember', 'mnemonic', 'recall'],
    tour: ['Pick a palace and number the spots along one walk: door, hall, stairs.', 'At each spot place a vivid, odd picture of the thing to remember.', 'Walk it in your head, then open the list and check each spot in order.'],
    log: {
      fields: [
        { id: 'palace', label: 'Palace', type: 'choice', options: ['Home', 'Office', 'Childhood home', 'Daily walk'], required: true },
        { id: 'spot', label: 'Spot', type: 'number', min: 1, max: 200, required: true },
        { id: 'place', label: 'Place', type: 'text', hint: 'e.g. Front door', required: true },
        { id: 'item', label: 'Item', type: 'text', hint: 'What to remember', required: true },
        { id: 'image', label: 'Image', type: 'long', hint: 'The vivid picture placed there' },
        { id: 'list', label: 'List', type: 'text', hint: 'e.g. Speech, shopping' },
        { id: 'sure', label: 'Recalled', type: 'check' },
        { id: 'photo', label: 'Photo', type: 'photo' },
      ],
      title: '{spot}. {place}', sub: '{item}', meta: 'list', sort: { field: 'spot', dir: 'asc' }, group: 'palace',
      stats: [{ label: 'Spots', kind: 'count' }, { label: 'Palaces', kind: 'distinct', field: 'palace' }, { label: 'Lists', kind: 'distinct', field: 'list' }],
      views: ['list', 'board'],
    },
    sample: [
      { palace: 'Home', spot: 1, place: 'Front door', item: 'Open with a thank-you', image: 'A giant bow tied round the door handle.', list: 'Wedding speech', sure: true },
      { palace: 'Home', spot: 2, place: 'Hall mirror', item: 'How we met at university', image: 'The mirror wearing a graduation cap.', list: 'Wedding speech' },
      { palace: 'Home', spot: 3, place: 'Stairs', item: 'The camping trip story', image: 'A tent pitched on every step.', list: 'Wedding speech' },
      { palace: 'Home', spot: 4, place: 'Kitchen table', item: 'Toast to the couple', image: 'Two glasses dancing on the table.', list: 'Wedding speech' },
    ],
  },
  {
    id: 'exam-planner', name: 'Exam Planner', family: 'learn', glyph: 'target', archetype: 'log', from: 'learn.54',
    pitch: 'Every topic on the syllabus with your confidence, the next review and exam day.',
    keywords: ['exam', 'revision', 'syllabus', 'topics', 'study', 'mock'],
    tour: ['Add each syllabus topic with how sure you feel from one to five.', 'Board view sorts topics into To learn, Revising and Secure.', 'Set a review date and a nudge arrives on the day.'],
    log: {
      fields: [
        { id: 'topic', label: 'Topic', type: 'text', required: true },
        { id: 'subject', label: 'Subject', type: 'text', hint: 'e.g. Chemistry' },
        { id: 'stage', label: 'Stage', type: 'choice', options: ['To learn', 'Revising', 'Secure'], default: 'To learn' },
        { id: 'confidence', label: 'Confidence', type: 'rating' },
        { id: 'review', label: 'Next review', type: 'date' },
        { id: 'score', label: 'Last score', type: 'number', unit: '%', min: 0, max: 100 },
        { id: 'exam', label: 'Exam day', type: 'date' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'topic', sub: '{subject} · {stage}', meta: 'score', date: 'review', sort: { field: 'review', dir: 'asc' }, group: 'stage',
      stats: [
        { label: 'Topics', kind: 'count' },
        { label: 'Avg score', kind: 'avg', field: 'score' },
        { label: 'Confidence', kind: 'avg', field: 'confidence' },
      ],
      views: ['board', 'list', 'calendar'],
      remind: { field: 'review', words: 'Review {topic} today' },
    },
    sample: [
      { topic: 'Rates of reaction', subject: 'Chemistry', stage: 'Revising', confidence: 3, review: '2026-11-16', score: 64, exam: '2027-05-18' },
      { topic: 'Electrolysis', subject: 'Chemistry', stage: 'To learn', confidence: 1, review: '2026-11-15', exam: '2027-05-18' },
      { topic: 'Atomic structure', subject: 'Chemistry', stage: 'Secure', confidence: 5, review: '2026-11-28', score: 91, exam: '2027-05-18' },
      { topic: 'Quadratic equations', subject: 'Maths', stage: 'Revising', confidence: 3, review: '2026-11-17', score: 72, exam: '2027-05-21' },
    ],
  },
  {
    id: 'highway-code', name: 'Highway Code', family: 'learn', glyph: 'car', archetype: 'deck', from: 'learn.55',
    pitch: 'Speed limits, stopping distances and sign rules from the public Highway Code.',
    keywords: ['highway', 'code', 'theory', 'driving', 'signs', 'test'],
    tour: ['Written from the public Highway Code; not the official test bank.', 'Stopping distances come up often: learn the thinking part first.', 'Missed cards return sooner, so a few minutes daily builds it up.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Speed limit for a car in a built-up area with street lights=30 mph unless signs say otherwise;' +
        'Speed limit for a car on a single carriageway=60 mph;Speed limit for a car on a dual carriageway=70 mph;' +
        'Speed limit for a car on a motorway=70 mph;Speed limit for a car towing a caravan on a motorway=60 mph;' +
        'Typical stopping distance at 20 mph=12 metres (6 thinking, 6 braking);' +
        'Typical stopping distance at 30 mph=23 metres (9 thinking, 14 braking);' +
        'Typical stopping distance at 40 mph=36 metres (12 thinking, 24 braking);' +
        'Typical stopping distance at 50 mph=53 metres (15 thinking, 38 braking);' +
        'Typical stopping distance at 60 mph=73 metres (18 thinking, 55 braking);' +
        'Typical stopping distance at 70 mph=96 metres (21 thinking, 75 braking);' +
        'Gap to the vehicle in front on a dry road=At least a two-second gap;Gap in the wet=At least double the dry gap;' +
        'Gap on icy roads=Up to ten times the dry gap;Signs in circles=Give orders;Signs in triangles=Give warnings;' +
        'Signs in rectangles=Give information;A blue circle sign=Tells you what you must do;' +
        'A red ring sign=Tells you what you must not do;The only upside-down triangle sign=Give way;' +
        'The only octagonal sign=Stop;Motorway direction signs are=Blue;Primary route signs are=Green;' +
        'Local route signs are=White with a black border;A flashing amber light at a pelican crossing=Give way to anyone on the crossing, then go if clear;' +
        'Order of traffic lights after red=Red and amber, then green;What amber alone means=Stop at the stop line, unless you are so close that pulling up might cause a collision;' +
        'Double white lines with the line nearest you solid=Do not cross or straddle it;' +
        'Double yellow lines at the kerb=No waiting at any time;Minimum tyre tread for cars=1.6 mm across the central three-quarters;' +
        'Break advised on a long drive=At least 15 minutes after every two hours;' +
        'Youngest age to drive a car on the road=17;When you must use headlights=When visibility is seriously reduced;' +
        'Use of fog lights=Only when visibility is seriously reduced, generally under 100 metres;' +
        'A hard shoulder is for=Emergencies only, unless signs open it as a lane;' +
        'Rule H1 of the hierarchy=Those who can do the greatest harm have the greatest responsibility;' +
        'Minimum passing gap for a cyclist at up to 30 mph=At least 1.5 metres',
      ),
    },
  },
  {
    id: 'typing-arcade', name: 'Typing Arcade', family: 'learn', glyph: 'type', archetype: 'game', from: 'learn.56',
    pitch: 'Typing runs that train speed and accuracy, with your best scores kept.',
    keywords: ['typing', 'keyboard', 'speed', 'wpm', 'words', 'touch'],
    tour: ['Type the words as they come; a miss costs time, not the round.', 'Accuracy first: speed follows once the errors fall.', 'Your best words per minute sits at the top to beat.'],
    game: { kind: 'typing', options: { seconds: 60 } },
  },
  {
    id: 'course-tracker', name: 'Course Tracker', family: 'learn', glyph: 'book', archetype: 'log', from: 'learn.48',
    pitch: 'Every course, textbook and lecture series you follow, with lessons done.',
    keywords: ['course', 'lectures', 'textbook', 'progress', 'study', 'lessons'],
    tour: ['Add a course with how many lessons it has and how many you have done.', 'Board view shows what is Up next, In progress and Finished.', 'Set a target date and a nudge comes the day it is due.'],
    log: {
      fields: [
        { id: 'course', label: 'Course', type: 'text', required: true, hint: 'e.g. Linear Algebra' },
        { id: 'kind', label: 'Kind', type: 'choice', options: ['Lectures', 'Textbook', 'Online course', 'Evening class', 'Workshop'] },
        { id: 'subject', label: 'Subject', type: 'text' },
        { id: 'status', label: 'Status', type: 'choice', options: ['Up next', 'In progress', 'Finished', 'Paused'], default: 'Up next' },
        { id: 'done', label: 'Lessons done', type: 'number', min: 0 },
        { id: 'total', label: 'Lessons', type: 'number', min: 1 },
        { id: 'hours', label: 'Hours', type: 'number', unit: 'h', min: 0, step: 0.5 },
        { id: 'target', label: 'Target date', type: 'date' },
        { id: 'link', label: 'Link', type: 'link' },
        { id: 'rating', label: 'Rating', type: 'rating' },
      ],
      title: 'course', sub: '{done} of {total} · {status}', meta: 'hours', date: 'target', group: 'status', sort: { field: 'target', dir: 'asc' },
      stats: [
        { label: 'Courses', kind: 'count' },
        { label: 'Hours', kind: 'sum', field: 'hours' },
        { label: 'Lessons done', kind: 'sum', field: 'done' },
      ],
      views: ['board', 'list', 'calendar'],
      remind: { field: 'target', words: 'Target day for {course}' },
    },
    sample: [
      { course: 'Linear Algebra', kind: 'Lectures', subject: 'Maths', status: 'In progress', done: 12, total: 34, hours: 14, target: '2027-02-28', rating: 5 },
      { course: 'Introductory Chemistry', kind: 'Textbook', subject: 'Chemistry', status: 'In progress', done: 5, total: 21, hours: 9, target: '2027-04-30' },
      { course: 'Conversational Urdu', kind: 'Evening class', subject: 'Languages', status: 'Up next', done: 0, total: 10, target: '2027-01-15' },
      { course: 'Python Basics', kind: 'Online course', subject: 'Coding', status: 'Finished', done: 24, total: 24, hours: 18, rating: 4 },
    ],
  },
  {
    id: 'listening-log', name: 'Listening Log', family: 'learn', glyph: 'headphones', archetype: 'log', from: 'learn.50',
    pitch: 'Audiobooks and talks you are hearing, with your chapter and place kept.',
    keywords: ['audiobook', 'listening', 'chapter', 'talks', 'podcast'],
    tour: ['Add a book with its chapters, then note where you stopped.', 'The place line shows chapter and minute, so you always pick up there.', 'Finished books stay in the list with your rating.'],
    log: {
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'author', label: 'Author', type: 'text' },
        { id: 'status', label: 'Status', type: 'choice', options: ['Listening', 'Up next', 'Finished', 'Set aside'], default: 'Listening' },
        { id: 'chapter', label: 'Chapter', type: 'number', min: 0 },
        { id: 'chapters', label: 'Chapters', type: 'number', min: 1 },
        { id: 'at', label: 'Stopped at', type: 'duration', hint: 'Minutes into the chapter' },
        { id: 'speed', label: 'Speed', type: 'choice', options: ['0.8×', '1×', '1.2×', '1.5×', '2×'], default: '1×' },
        { id: 'date', label: 'Last heard', type: 'date', default: 'today' },
        { id: 'rating', label: 'Rating', type: 'rating' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'title', sub: '{author} · chapter {chapter} of {chapters}', meta: 'at', date: 'date', group: 'status', sort: { field: 'date', dir: 'desc' },
      stats: [{ label: 'Books', kind: 'count' }, { label: 'Authors', kind: 'distinct', field: 'author' }, { label: 'Avg rating', kind: 'avg', field: 'rating' }],
      views: ['list', 'board'],
    },
    sample: [
      { title: 'Pride and Prejudice', author: 'Jane Austen', status: 'Listening', chapter: 23, chapters: 61, at: 7, speed: '1.2×', date: '2026-11-13' },
      { title: 'The Time Machine', author: 'H. G. Wells', status: 'Finished', chapter: 16, chapters: 16, date: '2026-10-30', rating: 4 },
      { title: 'Great Expectations', author: 'Charles Dickens', status: 'Up next', chapter: 0, chapters: 59, date: '2026-11-01' },
    ],
  },
  {
    id: 'gallery-visits', name: 'Gallery Visits', family: 'learn', glyph: 'palette', archetype: 'log', from: 'learn.43',
    pitch: 'The artworks that stopped you, with artist, year, gallery and your photo.',
    keywords: ['art', 'gallery', 'museum', 'paintings', 'artworks', 'favourites'],
    tour: ['Snap the label and the work, then add the artist and the year.', 'Gallery view turns your favourites into your own little museum.', 'Group by movement to see where your taste lies.'],
    log: {
      fields: [
        { id: 'work', label: 'Artwork', type: 'text', required: true },
        { id: 'artist', label: 'Artist', type: 'text' },
        { id: 'year', label: 'Year', type: 'number', min: -3000, max: 2100 },
        { id: 'movement', label: 'Movement', type: 'choice', options: ['Renaissance', 'Baroque', 'Romanticism', 'Impressionism', 'Modernism', 'Contemporary', 'Ancient', 'Other'] },
        { id: 'medium', label: 'Medium', type: 'text', hint: 'e.g. Oil on canvas' },
        { id: 'museum', label: 'Museum', type: 'text' },
        { id: 'date', label: 'Seen', type: 'date', default: 'today' },
        { id: 'rating', label: 'Rating', type: 'rating' },
        { id: 'photo', label: 'Photo', type: 'photo' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'work', sub: '{artist}, {year}', meta: 'museum', date: 'date', group: 'movement', sort: { field: 'date', dir: 'desc' },
      stats: [{ label: 'Artworks', kind: 'count' }, { label: 'Artists', kind: 'distinct', field: 'artist' }, { label: 'Museums', kind: 'distinct', field: 'museum' }],
      views: ['gallery', 'list', 'calendar'],
    },
    sample: [
      { work: 'Sunflowers', artist: 'Vincent van Gogh', year: 1888, movement: 'Impressionism', medium: 'Oil on canvas', museum: 'National Gallery, London', date: '2026-10-18', rating: 5 },
      { work: 'The Fighting Temeraire', artist: 'J. M. W. Turner', year: 1839, movement: 'Romanticism', medium: 'Oil on canvas', museum: 'National Gallery, London', date: '2026-10-18', rating: 5 },
      { work: 'The Ambassadors', artist: 'Hans Holbein the Younger', year: 1533, movement: 'Renaissance', medium: 'Oil on oak', museum: 'National Gallery, London', date: '2026-10-18', rating: 4, notes: 'Stand to the right to see the skull.' },
    ],
  },
  {
    id: 'coding-log', name: 'Coding Log', family: 'learn', glyph: 'code', archetype: 'log', from: 'learn.33',
    pitch: 'Each coding puzzle you solve, with language, difficulty, time and a streak.',
    keywords: ['coding', 'puzzles', 'challenges', 'kata', 'algorithms', 'practice'],
    tour: ['Log a puzzle when you finish it, with the minutes it took.', 'The streak counts days in a row with at least one solved.', 'Write the key idea in Notes: that is what you review later.'],
    log: {
      fields: [
        { id: 'puzzle', label: 'Puzzle', type: 'text', required: true },
        { id: 'date', label: 'Date', type: 'date', default: 'today' },
        { id: 'language', label: 'Language', type: 'choice', options: ['Python', 'JavaScript', 'TypeScript', 'SQL', 'Go', 'Rust', 'Java', 'C'] },
        { id: 'level', label: 'Difficulty', type: 'choice', options: ['Easy', 'Medium', 'Hard'] },
        { id: 'topic', label: 'Topic', type: 'multi', options: ['Arrays', 'Strings', 'Hashing', 'Two pointers', 'Recursion', 'Trees', 'Graphs', 'Dynamic programming', 'Maths', 'Sorting'] },
        { id: 'minutes', label: 'Time', type: 'duration' },
        { id: 'solved', label: 'Solved', type: 'check', default: true },
        { id: 'hints', label: 'Hints used', type: 'number', min: 0, max: 10 },
        { id: 'idea', label: 'Key idea', type: 'long' },
      ],
      title: 'puzzle', sub: '{language} · {level}', meta: 'minutes', date: 'date', group: 'level', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'This week', kind: 'count', period: 'week', goal: 5, dir: 'reach' },
        { label: 'Streak', kind: 'streak' },
        { label: 'Avg time', kind: 'avg', field: 'minutes' },
      ],
      views: ['list', 'calendar', 'board'],
    },
    sample: [
      { puzzle: 'Two numbers that sum to a target', date: '2026-11-13', language: 'Python', level: 'Easy', topic: ['Arrays', 'Hashing'], minutes: 12, solved: true, hints: 0, idea: 'Keep a map of value to index; look up target minus x.' },
      { puzzle: 'Longest run without repeats', date: '2026-11-12', language: 'Python', level: 'Medium', topic: ['Strings', 'Two pointers'], minutes: 34, solved: true, hints: 1, idea: 'Sliding window; move the left edge past the last repeat.' },
      { puzzle: 'Shortest path in a grid', date: '2026-11-11', language: 'TypeScript', level: 'Medium', topic: ['Graphs'], minutes: 41, solved: true, hints: 2, idea: 'Breadth-first search from the start, one layer per step.' },
    ],
  },

  /* ===================== Scripts and languages ===================== */
  {
    id: 'greek-alphabet', name: 'Greek Alphabet', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'All 24 Greek letters, capital and small, with their names and sounds.',
    keywords: ['greek', 'alphabet', 'letters', 'script'],
    tour: ['Each card shows a letter pair; say its name and sound.', 'Watch the false friends: P is rho, H is eta, X is chi.', 'Once you know them, signs in Greece start to read themselves.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Α α=alpha (a);Β β=beta (v in modern Greek);Γ γ=gamma (g);Δ δ=delta (th as in this);Ε ε=epsilon (e);Ζ ζ=zeta (z);' +
        'Η η=eta (i in modern Greek);Θ θ=theta (th as in thin);Ι ι=iota (i);Κ κ=kappa (k);Λ λ=lambda (l);Μ μ=mu (m);Ν ν=nu (n);' +
        'Ξ ξ=xi (ks);Ο ο=omicron (o);Π π=pi (p);Ρ ρ=rho (r);Σ σ ς=sigma (s; ς at the end of a word);Τ τ=tau (t);' +
        'Υ υ=upsilon (i in modern Greek);Φ φ=phi (f);Χ χ=chi (ch as in loch);Ψ ψ=psi (ps);Ω ω=omega (o)',
      ),
    },
  },
  {
    id: 'cyrillic-letters', name: 'Cyrillic Letters', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'The 33 letters of the Russian alphabet with the sound each one makes.',
    keywords: ['cyrillic', 'russian', 'alphabet', 'letters', 'script'],
    tour: ['Start with the true friends: А, К, М, О, Т sound as they look.', 'Then the false friends: В is v, Н is n, Р is r, С is s.', 'Read a word aloud from each card once you know its letters.'],
    deck: {
      mode: 'srs',
      cards: list(
        'А а=a;Б б=b;В в=v;Г г=g;Д д=d;Е е=ye;Ё ё=yo;Ж ж=zh (as in measure);З з=z;И и=i (ee);Й й=y (short i);К к=k;' +
        'Л л=l;М м=m;Н н=n;О о=o;П п=p;Р р=r (rolled);С с=s;Т т=t;У у=u (oo);Ф ф=f;Х х=kh (as in loch);Ц ц=ts;Ч ч=ch;' +
        'Ш ш=sh;Щ щ=shch (a long soft sh);Ъ ъ=hard sign (no sound of its own);Ы ы=y (a deep i);Ь ь=soft sign (softens the letter before);' +
        'Э э=e (as in met);Ю ю=yu;Я я=ya',
      ),
    },
  },
  {
    id: 'hiragana', name: 'Hiragana', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'The 46 basic hiragana, the first script every learner of Japanese reads.',
    keywords: ['hiragana', 'japanese', 'kana', 'script', 'letters'],
    tour: ['Each card is one sound: say it before you turn it over.', 'Learn a row a day: a-row, ka-row, sa-row and on.', 'Note the odd ones: し is shi, ち is chi, つ is tsu, ふ is fu.'],
    deck: {
      mode: 'srs',
      cards: list(
        'あ=a;い=i;う=u;え=e;お=o;か=ka;き=ki;く=ku;け=ke;こ=ko;さ=sa;し=shi;す=su;せ=se;そ=so;た=ta;ち=chi;つ=tsu;て=te;と=to;' +
        'な=na;に=ni;ぬ=nu;ね=ne;の=no;は=ha;ひ=hi;ふ=fu;へ=he;ほ=ho;ま=ma;み=mi;む=mu;め=me;も=mo;や=ya;ゆ=yu;よ=yo;' +
        'ら=ra;り=ri;る=ru;れ=re;ろ=ro;わ=wa;を=wo (said o);ん=n',
      ),
    },
  },
  {
    id: 'katakana', name: 'Katakana', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'The 46 basic katakana, used for loanwords, names and menus in Japan.',
    keywords: ['katakana', 'japanese', 'kana', 'script', 'letters'],
    tour: ['Katakana spell borrowed words, so menus and signs are full of them.', 'Mind the look-alikes: シ shi and ツ tsu, ソ so and ン n.', 'Learn a row a day and test yourself on a menu.'],
    deck: {
      mode: 'srs',
      cards: list(
        'ア=a;イ=i;ウ=u;エ=e;オ=o;カ=ka;キ=ki;ク=ku;ケ=ke;コ=ko;サ=sa;シ=shi;ス=su;セ=se;ソ=so;タ=ta;チ=chi;ツ=tsu;テ=te;ト=to;' +
        'ナ=na;ニ=ni;ヌ=nu;ネ=ne;ノ=no;ハ=ha;ヒ=hi;フ=fu;ヘ=he;ホ=ho;マ=ma;ミ=mi;ム=mu;メ=me;モ=mo;ヤ=ya;ユ=yu;ヨ=yo;' +
        'ラ=ra;リ=ri;ル=ru;レ=re;ロ=ro;ワ=wa;ヲ=wo (said o);ン=n',
      ),
    },
  },
  {
    id: 'arabic-letters', name: 'Arabic Letters', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'The 28 letters of the Arabic alphabet with their names and sounds.',
    keywords: ['arabic', 'alphabet', 'letters', 'script', 'abjad'],
    tour: ['Arabic reads right to left, and most letters join their neighbours.', 'Many letters share a shape and differ only by their dots.', 'Learn them in shape families: ب ت ث, then ج ح خ.'],
    deck: {
      mode: 'srs',
      cards: list(
        'ا=alif (long a);ب=ba (b);ت=ta (t);ث=tha (th as in thin);ج=jim (j);ح=ha (a breathy h from the throat);خ=kha (kh as in loch);' +
        'د=dal (d);ذ=dhal (th as in this);ر=ra (rolled r);ز=zay (z);س=sin (s);ش=shin (sh);ص=sad (a heavy s);ض=dad (a heavy d);' +
        'ط=ta (a heavy t);ظ=za (a heavy dh);ع=ayn (a sound from deep in the throat);غ=ghayn (a gargled g);ف=fa (f);ق=qaf (a deep k);' +
        'ك=kaf (k);ل=lam (l);م=mim (m);ن=nun (n);ه=ha (h);و=waw (w or long u);ي=ya (y or long i)',
      ),
    },
  },
  {
    id: 'urdu-letters', name: 'Urdu Letters', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'The Urdu alphabet letter by letter, with each name and the sound it makes.',
    keywords: ['urdu', 'alphabet', 'letters', 'script', 'nastaliq'],
    tour: ['Urdu reads right to left and adds letters Arabic lacks: پ ٹ چ ڈ ڑ گ.', 'Start with the shape families: ب پ ت ٹ ث share one body.', 'Then read a word you already say every day.'],
    deck: {
      mode: 'srs',
      cards: list(
        'ا=alif (a);ب=be (b);پ=pe (p);ت=te (soft t);ٹ=ṭe (hard t);ث=se (s);ج=jīm (j);چ=che (ch);ح=baṛī he (h);خ=khe (kh);' +
        'د=dāl (soft d);ڈ=ḍāl (hard d);ذ=zāl (z);ر=re (r);ڑ=ṛe (flapped r);ز=ze (z);ژ=zhe (zh as in measure);س=sīn (s);' +
        'ش=shīn (sh);ص=su\'ād (s);ض=zu\'ād (z);ط=to\'e (t);ظ=zo\'e (z);ع=ain (a throat sound or vowel);غ=ghain (gh);ف=fe (f);' +
        'ق=qāf (deep k);ک=kāf (k);گ=gāf (g);ل=lām (l);م=mīm (m);ن=nūn (n);ں=nūn ghunna (nasal n);و=wāo (w, o or oo);' +
        'ہ=choṭī he (h);ھ=do-chashmī he (breath after a letter, as in بھ bh);ء=hamza (a glottal stop);ی=choṭī ye (y or ee);ے=baṛī ye (e at a word end)',
      ),
    },
  },
  {
    id: 'hangul', name: 'Hangul', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'The 24 basic Korean letters, built to be learned in an afternoon.',
    keywords: ['hangul', 'korean', 'alphabet', 'letters', 'script'],
    tour: ['Fourteen consonants and ten vowels make every Korean syllable.', 'Vowels are lines and dots: ㅏ a, ㅓ eo, ㅗ o, ㅜ u.', 'Letters stack into blocks: ㅎ + ㅏ + ㄴ is 한, han.'],
    deck: {
      mode: 'srs',
      cards: list(
        'ㄱ=g or k;ㄴ=n;ㄷ=d or t;ㄹ=r or l;ㅁ=m;ㅂ=b or p;ㅅ=s;ㅇ=silent at the start, ng at the end;ㅈ=j;ㅊ=ch;ㅋ=k (breathy);' +
        'ㅌ=t (breathy);ㅍ=p (breathy);ㅎ=h;ㅏ=a;ㅑ=ya;ㅓ=eo (as in fun);ㅕ=yeo;ㅗ=o;ㅛ=yo;ㅜ=u;ㅠ=yu;ㅡ=eu;ㅣ=i',
      ),
    },
  },
  {
    id: 'vocabulary-book', name: 'Vocabulary Book', family: 'learn', glyph: 'note', archetype: 'log',
    pitch: 'New words in any language with meaning, example sentence and where you met them.',
    keywords: ['vocabulary', 'words', 'language', 'meaning', 'notebook'],
    tour: ['Add a word the moment you meet it, with the sentence it came in.', 'Mark it Known once you can use it without thinking.', 'Group by language to keep each one tidy.'],
    log: {
      fields: [
        { id: 'word', label: 'Word', type: 'text', required: true },
        { id: 'meaning', label: 'Meaning', type: 'text', required: true },
        { id: 'language', label: 'Language', type: 'choice', options: ['Urdu', 'Arabic', 'French', 'Spanish', 'German', 'Italian', 'Japanese', 'Mandarin', 'Other'] },
        { id: 'example', label: 'Example', type: 'long' },
        { id: 'source', label: 'Met in', type: 'text', hint: 'e.g. A recipe, a film' },
        { id: 'date', label: 'Added', type: 'date', default: 'today' },
        { id: 'stage', label: 'Stage', type: 'choice', options: ['New', 'Learning', 'Known'], default: 'New' },
      ],
      title: 'word', sub: 'meaning', meta: 'language', date: 'date', group: 'language', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'Words', kind: 'count' },
        { label: 'This week', kind: 'count', period: 'week', goal: 20, dir: 'reach' },
        { label: 'Languages', kind: 'distinct', field: 'language' },
      ],
      views: ['list', 'board'],
    },
    sample: [
      { word: 'دوست', meaning: 'Friend (dost)', language: 'Urdu', example: 'وہ میرا پرانا دوست ہے۔', source: 'A song', date: '2026-11-13', stage: 'Known' },
      { word: 'la boulangerie', meaning: 'The bakery', language: 'French', example: 'Je vais à la boulangerie.', source: 'A street sign', date: '2026-11-12', stage: 'Learning' },
      { word: 'el desayuno', meaning: 'Breakfast', language: 'Spanish', example: 'El desayuno está listo.', source: 'A menu', date: '2026-11-10', stage: 'New' },
    ],
  },
  {
    id: 'language-daily', name: 'Language Daily', family: 'learn', glyph: 'chat', archetype: 'checklist',
    pitch: 'A short daily round of review, listening, reading and speaking that builds up.',
    keywords: ['language', 'daily', 'routine', 'practice', 'habit'],
    tour: ['Tick each block as you finish it; the list starts fresh each morning.', 'Speaking aloud is the step most people skip, so it sits first.', 'Fifteen minutes a day beats two hours on a Sunday.'],
    checklist: {
      repeat: 'daily',
      sections: [
        { name: 'Speak', items: ['Say five sentences about your day aloud', 'Shadow one short recording, line by line'] },
        { name: 'Review', items: ['Clear the cards due today', 'Add three new words from today'] },
        { name: 'Input', items: ['Listen for ten minutes', 'Read one short text'] },
      ],
    },
  },
  {
    id: 'latin-phrases', name: 'Latin Phrases', family: 'learn', glyph: 'quote', archetype: 'deck',
    pitch: 'The Latin phrases that turn up in English, with what each one means.',
    keywords: ['latin', 'phrases', 'meaning', 'words', 'classics'],
    tour: ['Each card is a phrase you will meet in books, law or the news.', 'Say the meaning, then turn the card.', 'Try to use one in a sentence today.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Carpe diem=Seize the day;Ad hoc=For this purpose;Bona fide=In good faith;Status quo=The existing state of affairs;' +
        'Per se=By itself;Vice versa=The other way round;Ad infinitum=To infinity, without end;Mea culpa=My fault;' +
        'Quid pro quo=Something for something;Alma mater=Nourishing mother; one\'s old school or university;' +
        'Et cetera=And the rest;Ipso facto=By the fact itself;Pro bono=For the public good, without charge;' +
        'In situ=In its original place;Persona non grata=An unwelcome person;Magnum opus=Great work;' +
        'Caveat emptor=Let the buyer beware;Veni, vidi, vici=I came, I saw, I conquered;Tempus fugit=Time flies;' +
        'Sine qua non=An essential condition;De facto=In fact, whether by right or not;Ad nauseam=To the point of sickness;' +
        'Terra firma=Solid ground;Annus horribilis=A horrible year;Exempli gratia (e.g.)=For example;Id est (i.e.)=That is',
      ),
    },
  },
  {
    id: 'word-roots', name: 'Word Roots', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'Greek and Latin roots that unlock the meaning of thousands of English words.',
    keywords: ['roots', 'etymology', 'words', 'greek', 'latin', 'vocabulary'],
    tour: ['Each root comes with its meaning and two words built from it.', 'Next time you meet a long word, split it into its roots.', 'Ten roots a week and hard words start to explain themselves.'],
    deck: {
      mode: 'srs',
      cards: list(
        'bio (Greek)=Life: biology, biography;graph (Greek)=Write: autograph, paragraph;tele (Greek)=Far: telephone, telescope;' +
        'chron (Greek)=Time: chronology, synchronise;geo (Greek)=Earth: geography, geology;hydr (Greek)=Water: hydrant, dehydrate;' +
        'phot (Greek)=Light: photograph, photon;phon (Greek)=Sound: telephone, symphony;micro (Greek)=Small: microscope, microbe;' +
        'auto (Greek)=Self: automatic, autonomy;poly (Greek)=Many: polygon, polyglot;path (Greek)=Feeling or disease: sympathy, pathology;' +
        'port (Latin)=Carry: transport, portable;scrib, script (Latin)=Write: describe, manuscript;dict (Latin)=Say: predict, dictionary;' +
        'aqua (Latin)=Water: aquarium, aqueduct;terra (Latin)=Earth: territory, terrain;spect (Latin)=Look: inspect, spectator;' +
        'rupt (Latin)=Break: erupt, interrupt;struct (Latin)=Build: construct, structure;vid, vis (Latin)=See: video, vision;' +
        'aud (Latin)=Hear: audio, audience;ject (Latin)=Throw: eject, project;mal (Latin)=Bad: malfunction, malice;' +
        'bene (Latin)=Good, well: benefit, benevolent;cred (Latin)=Believe: credible, credit',
      ),
    },
  },

  /* ===================== Maths ===================== */
  {
    id: 'quadratic-solver', name: 'Quadratic Solver', family: 'learn', glyph: 'calc', archetype: 'calc',
    pitch: 'Solve ax² + bx + c = 0 with the discriminant, real roots and complex roots.',
    keywords: ['quadratic', 'equation', 'roots', 'algebra', 'solve', 'maths'],
    tour: ['Type a, b and c from ax² + bx + c = 0; the roots update as you type.', 'A negative discriminant means complex roots: real ± imaginary part.', 'Check one root by putting it back into the equation.'],
    calc: {
      source: 'The quadratic formula, x = (−b ± √(b² − 4ac)) / 2a',
      inputs: [
        { id: 'a', label: 'a', default: 1, step: 1 },
        { id: 'b', label: 'b', default: -3, step: 1 },
        { id: 'c', label: 'c', default: 2, step: 1 },
      ],
      outputs: [
        { id: 'd', label: 'Discriminant', expr: 'b^2 - 4*a*c', dp: 4 },
        { id: 'n', label: 'Real roots', expr: 'if(d > 0, 2, if(d == 0, 1, 0))', dp: 0 },
        { id: 'x1', label: 'Root one', expr: 'if(d >= 0, (-b + sqrt(abs(d))) / (2*a), -b / (2*a))', dp: 4 },
        { id: 'x2', label: 'Root two', expr: 'if(d >= 0, (-b - sqrt(abs(d))) / (2*a), -b / (2*a))', dp: 4 },
        { id: 'im', label: 'Imaginary part', expr: 'if(d < 0, sqrt(abs(d)) / abs(2*a), 0)', dp: 4 },
      ],
      tests: [
        { in: { a: 1, b: -3, c: 2 }, out: { d: 1, n: 2, x1: 2, x2: 1, im: 0 } },
        { in: { a: 1, b: 2, c: 5 }, out: { d: -16, n: 0, x1: -1, x2: -1, im: 2 } },
        { in: { a: 2, b: 4, c: 2 }, out: { d: 0, n: 1, x1: -1, x2: -1 } },
      ],
    },
  },
  {
    id: 'triangle-solver', name: 'Triangle Solver', family: 'learn', glyph: 'ruler', archetype: 'calc',
    pitch: 'Three sides give every angle, the area and the perimeter of a triangle.',
    keywords: ['triangle', 'angles', 'trigonometry', 'area', 'geometry', 'cosine'],
    tour: ['Type the three sides; each angle faces the side with its letter.', 'Try 3, 4 and 5: angle C comes out at exactly 90 degrees.', 'The area uses Heron\'s formula, so no height is needed.'],
    calc: {
      source: 'The cosine rule and Heron\'s formula',
      inputs: [
        { id: 'a', label: 'Side a', default: 3, min: 0 },
        { id: 'b', label: 'Side b', default: 4, min: 0 },
        { id: 'c', label: 'Side c', default: 5, min: 0 },
      ],
      outputs: [
        { id: 'ang_a', label: 'Angle A', expr: 'acos((b^2 + c^2 - a^2) / (2*b*c))', unit: '°' },
        { id: 'ang_b', label: 'Angle B', expr: 'acos((a^2 + c^2 - b^2) / (2*a*c))', unit: '°' },
        { id: 'ang_c', label: 'Angle C', expr: '180 - ang_a - ang_b', unit: '°' },
        { id: 'p', label: 'Perimeter', expr: 'a + b + c' },
        { id: 'area', label: 'Area', expr: 'sqrt((p/2) * (p/2 - a) * (p/2 - b) * (p/2 - c))' },
      ],
      tests: [
        { in: { a: 3, b: 4, c: 5 }, out: { ang_a: 36.8699, ang_b: 53.1301, ang_c: 90, p: 12, area: 6 } },
        { in: { a: 2, b: 2, c: 2 }, out: { ang_a: 60, ang_b: 60, ang_c: 60, p: 6, area: 1.7321 } },
      ],
    },
  },
  {
    id: 'circle-sphere', name: 'Circle and Sphere', family: 'learn', glyph: 'target', archetype: 'calc',
    pitch: 'One radius gives the circumference, area, sphere surface and volume.',
    keywords: ['circle', 'sphere', 'radius', 'area', 'volume', 'pi'],
    tour: ['Type the radius; half the diameter if that is what you measured.', 'Area and surface come out in square units, volume in cubic.', 'A radius of 1 shows pi itself as the area.'],
    calc: {
      source: 'Standard circle and sphere formulas: C = 2πr, A = πr², S = 4πr², V = 4/3 πr³',
      inputs: [{ id: 'r', label: 'Radius', default: 1, min: 0 }],
      outputs: [
        { id: 'd', label: 'Diameter', expr: '2*r', dp: 4 },
        { id: 'circ', label: 'Circumference', expr: '2*pi*r', dp: 4 },
        { id: 'area', label: 'Circle area', expr: 'pi*r^2', dp: 4 },
        { id: 'surf', label: 'Sphere surface', expr: '4*pi*r^2', dp: 4 },
        { id: 'vol', label: 'Sphere volume', expr: '4/3*pi*r^3', dp: 4 },
      ],
      tests: [
        { in: { r: 1 }, out: { d: 2, circ: 6.2832, area: 3.1416, surf: 12.5664, vol: 4.1888 } },
        { in: { r: 3 }, out: { d: 6, circ: 18.8496, area: 28.2743, surf: 113.0973, vol: 113.0973 } },
      ],
    },
  },
  {
    id: 'squares-roots', name: 'Squares and Roots', family: 'learn', glyph: 'grid', archetype: 'deck',
    pitch: 'Squares to 20, their square roots and cubes to 10, for quick mental maths.',
    keywords: ['squares', 'roots', 'cubes', 'mental', 'maths'],
    tour: ['Squares to 20 make estimating and checking work quick.', 'Each square has a matching root card going the other way.', 'Cubes to 10 finish the set.'],
    deck: { mode: 'srs', cards: SQUARES },
  },
  {
    id: 'roman-numerals', name: 'Roman Numerals', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'Read Roman numerals on clocks, buildings and film credits at a glance.',
    keywords: ['roman', 'numerals', 'numbers', 'history'],
    tour: ['I, V, X, L, C, D and M are 1, 5, 10, 50, 100, 500 and 1000.', 'A smaller numeral before a larger one is taken away: IX is 9.', 'Read the card, say the number, then turn it.'],
    deck: { mode: 'quiz', cards: ROMAN },
  },
  {
    id: 'maths-formulas', name: 'Maths Formulas', family: 'learn', glyph: 'calc', archetype: 'deck',
    pitch: 'The formulas worth knowing by heart, from areas to the quadratic formula.',
    keywords: ['formulas', 'maths', 'geometry', 'algebra', 'revision'],
    tour: ['Say the formula aloud before you turn the card.', 'Picture the shape as you say it: it sticks far better.', 'Missed ones return sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Area of a rectangle=length × width;Area of a triangle=½ × base × height;Area of a circle=πr²;' +
        'Circumference of a circle=2πr;Area of a trapezium=½(a + b)h;Volume of a cuboid=length × width × height;' +
        'Volume of a cylinder=πr²h;Volume of a cone=⅓πr²h;Volume of a sphere=4/3 πr³;Surface area of a sphere=4πr²;' +
        'Pythagoras\' theorem=a² + b² = c²;Quadratic formula=x = (−b ± √(b² − 4ac)) / 2a;' +
        'sin θ in a right triangle=opposite ÷ hypotenuse;cos θ in a right triangle=adjacent ÷ hypotenuse;' +
        'tan θ in a right triangle=opposite ÷ adjacent;Sine rule=a / sin A = b / sin B = c / sin C;' +
        'Cosine rule=a² = b² + c² − 2bc cos A;Gradient of a line=change in y ÷ change in x;Equation of a straight line=y = mx + c;' +
        'Angles in a triangle add to=180°;Angles in a quadrilateral add to=360°;Interior angles of an n-sided polygon=(n − 2) × 180°;' +
        'Compound growth=amount × (1 + r)ⁿ;Mean=sum of values ÷ number of values',
      ),
    },
  },
  {
    id: 'weighted-grade', name: 'Weighted Grade', family: 'learn', glyph: 'chart', archetype: 'calc',
    pitch: 'Combine coursework and exam marks by their weights into one overall grade.',
    keywords: ['grade', 'weighted', 'average', 'marks', 'coursework', 'exam'],
    tour: ['Type each part\'s mark and its weight; weights need not add to 100.', 'Leave a weight at 0 to drop that part.', 'Needed mark shows what the last part must score for your target.'],
    calc: {
      source: 'The weighted arithmetic mean',
      inputs: [
        { id: 's1', label: 'Mark one', unit: '%', default: 70, min: 0, max: 100 },
        { id: 'w1', label: 'Weight one', default: 40, min: 0 },
        { id: 's2', label: 'Mark two', unit: '%', default: 80, min: 0, max: 100 },
        { id: 'w2', label: 'Weight two', default: 60, min: 0 },
        { id: 'w3', label: 'Last weight', default: 0, min: 0 },
        { id: 't', label: 'Target', unit: '%', default: 70, min: 0, max: 100 },
      ],
      outputs: [
        { id: 'avg', label: 'So far', expr: '(s1*w1 + s2*w2) / max(w1 + w2, 0.000001)', unit: '%', dp: 1 },
        { id: 'need', label: 'Needed mark', expr: 'if(w3 > 0, (t*(w1 + w2 + w3) - s1*w1 - s2*w2) / w3, 0)', unit: '%', dp: 1 },
      ],
      tests: [
        { in: { s1: 70, w1: 40, s2: 80, w2: 60, w3: 0, t: 70 }, out: { avg: 76, need: 0 } },
        { in: { s1: 60, w1: 25, s2: 70, w2: 25, w3: 50, t: 70 }, out: { avg: 65, need: 75 } },
      ],
    },
  },

  /* ===================== Statistics ===================== */
  {
    id: 'z-score', name: 'Z-Score', family: 'learn', glyph: 'chart', archetype: 'calc',
    pitch: 'How many standard deviations a value sits from the mean, and its percentile.',
    keywords: ['z', 'score', 'standard', 'deviation', 'normal', 'statistics'],
    tour: ['Type the value, the mean and the standard deviation.', 'A z of 2 means two standard deviations above the mean.', 'The percentile assumes a normal distribution.'],
    calc: {
      source: 'Standard score z = (x − μ) / σ; normal percentile by the Zelen and Severo approximation (Abramowitz and Stegun 26.2.17)',
      inputs: [
        { id: 'x', label: 'Value', default: 85 },
        { id: 'mu', label: 'Mean', default: 70 },
        { id: 'sd', label: 'Std dev', default: 10, min: 0 },
      ],
      outputs: [
        { id: 'z', label: 'Z-score', expr: '(x - mu) / sd', dp: 3 },
        { id: 'k', label: 'k', expr: '1 / (1 + 0.2316419*abs(z))', dp: 6 },
        { id: 'tail', label: 'Upper tail', expr: 'exp(-(z^2)/2) / sqrt(2*pi) * (0.319381530*k - 0.356563782*k^2 + 1.781477937*k^3 - 1.821255978*k^4 + 1.330274429*k^5)', dp: 6 },
        { id: 'pct', label: 'Percentile', expr: 'if(z >= 0, 100*(1 - tail), 100*tail)', unit: '%', dp: 2 },
      ],
      tests: [
        { in: { x: 85, mu: 70, sd: 10 }, out: { z: 1.5, pct: 93.32 }, tol: 0.01 },
        { in: { x: 70, mu: 70, sd: 10 }, out: { z: 0, pct: 50 }, tol: 0.01 },
        { in: { x: 50, mu: 70, sd: 10 }, out: { z: -2, pct: 2.28 }, tol: 0.01 },
      ],
    },
  },
  {
    id: 'margin-of-error', name: 'Margin of Error', family: 'learn', glyph: 'pie', archetype: 'calc',
    pitch: 'A confidence interval for a survey share or a sample mean, in plain numbers.',
    keywords: ['confidence', 'interval', 'margin', 'error', 'survey', 'statistics'],
    tour: ['For a share: type how many said yes out of how many asked.', 'Pick 95% for the usual interval; 99% gives a wider, surer one.', 'The interval is the share plus or minus the margin.'],
    calc: {
      source: 'Normal approximation (Wald) interval for a proportion, p ± z√(p(1 − p)/n), NIST/SEMATECH e-Handbook',
      inputs: [
        { id: 'x', label: 'Yes answers', default: 50, min: 0 },
        { id: 'n', label: 'Sample size', default: 100, min: 1 },
        { id: 'z', label: 'Confidence', default: 1.96, choices: [{ label: '90%', value: 1.645 }, { label: '95%', value: 1.96 }, { label: '99%', value: 2.576 }] },
      ],
      outputs: [
        { id: 'p', label: 'Share', expr: '100*x/n', unit: '%', dp: 1 },
        { id: 'moe', label: 'Margin', expr: '100*z*sqrt((x/n)*(1 - x/n)/n)', unit: '%', dp: 1 },
        { id: 'lo', label: 'Low', expr: 'max(0, p - moe)', unit: '%', dp: 1 },
        { id: 'hi', label: 'High', expr: 'min(100, p + moe)', unit: '%', dp: 1 },
      ],
      tests: [
        { in: { x: 50, n: 100, z: 1.96 }, out: { p: 50, moe: 9.8, lo: 40.2, hi: 59.8 } },
        { in: { x: 300, n: 1000, z: 1.96 }, out: { p: 30, moe: 2.84, lo: 27.16, hi: 32.84 } },
      ],
    },
  },
  {
    id: 'hardy-weinberg', name: 'Hardy-Weinberg', family: 'learn', glyph: 'leaf', archetype: 'calc',
    pitch: 'From the share showing a recessive trait, find allele and carrier shares.',
    keywords: ['genetics', 'hardy', 'weinberg', 'allele', 'carrier', 'biology'],
    tour: ['Type the share of a made-up population showing the recessive trait.', 'That share is q², so q is its square root and p is 1 − q.', 'Carriers are 2pq: often far more than those showing the trait.'],
    calc: {
      source: 'The Hardy–Weinberg principle, p² + 2pq + q² = 1',
      inputs: [{ id: 'q2', label: 'Showing trait', unit: '%', default: 4, min: 0, max: 100 }],
      outputs: [
        { id: 'q', label: 'q', expr: 'sqrt(q2/100)', dp: 4 },
        { id: 'p', label: 'p', expr: '1 - q', dp: 4 },
        { id: 'het', label: 'Carriers', expr: '100*2*p*q', unit: '%', dp: 2 },
        { id: 'dom', label: 'Two dominant', expr: '100*p^2', unit: '%', dp: 2 },
      ],
      tests: [
        { in: { q2: 4 }, out: { q: 0.2, p: 0.8, het: 32, dom: 64 } },
        { in: { q2: 25 }, out: { q: 0.5, p: 0.5, het: 50, dom: 25 } },
      ],
    },
  },

  /* ===================== Physics, electronics and chemistry ===================== */
  {
    id: 'resistor-network', name: 'Resistor Network', family: 'learn', glyph: 'chip', archetype: 'calc',
    pitch: 'Up to three resistors in series or in parallel, combined into one value.',
    keywords: ['resistor', 'series', 'parallel', 'electronics', 'circuit'],
    tour: ['Type up to three resistors; leave the third at 0 if you have two.', 'In series they add; in parallel the total is below the smallest.', 'Two equal resistors in parallel give exactly half.'],
    calc: {
      source: 'Series R = R1 + R2 + R3; parallel 1/R = 1/R1 + 1/R2 + 1/R3',
      estimate: true,
      inputs: [
        { id: 'r1', label: 'R1', unit: 'Ω', default: 100, min: 0.000001 },
        { id: 'r2', label: 'R2', unit: 'Ω', default: 100, min: 0.000001 },
        { id: 'r3', label: 'R3', unit: 'Ω', default: 0, min: 0 },
      ],
      outputs: [
        { id: 'series', label: 'In series', expr: 'r1 + r2 + r3', unit: 'Ω' },
        { id: 'parallel', label: 'In parallel', expr: '1 / (1/r1 + 1/r2 + if(r3 > 0, 1/max(r3, 0.000001), 0))', unit: 'Ω' },
      ],
      tests: [
        { in: { r1: 100, r2: 100, r3: 0 }, out: { series: 200, parallel: 50 } },
        { in: { r1: 100, r2: 100, r3: 100 }, out: { series: 300, parallel: 33.33 } },
      ],
    },
  },
  {
    id: 'pendulum', name: 'Pendulum', family: 'learn', glyph: 'clock', archetype: 'calc',
    pitch: 'The swing time of a simple pendulum from its length, for small swings.',
    keywords: ['pendulum', 'period', 'physics', 'gravity', 'swing'],
    tour: ['Type the length from the pivot to the middle of the weight.', 'A one-metre pendulum swings there and back in about two seconds.', 'Time ten swings at home and compare: it is a classic lab.'],
    calc: {
      source: 'Simple pendulum, T = 2π√(L/g), for small angles',
      estimate: true,
      inputs: [
        { id: 'l', label: 'Length', unit: 'm', default: 1, min: 0 },
        { id: 'g', label: 'Gravity', unit: 'm/s²', default: 9.81, min: 0.1 },
      ],
      outputs: [
        { id: 't', label: 'Period', expr: '2*pi*sqrt(l/g)', unit: 's', dp: 3 },
        { id: 'f', label: 'Frequency', expr: '1/t', unit: 'Hz', dp: 3 },
      ],
      tests: [
        { in: { l: 1, g: 9.81 }, out: { t: 2.006, f: 0.4985 } },
        { in: { l: 0.25, g: 9.81 }, out: { t: 1.003, f: 0.997 } },
      ],
    },
  },
  {
    id: 'projectile', name: 'Projectile', family: 'learn', glyph: 'target', archetype: 'calc',
    pitch: 'Range, top height and flight time of a launch, ignoring air resistance.',
    keywords: ['projectile', 'range', 'trajectory', 'physics', 'launch'],
    tour: ['Type the launch speed and the angle above level ground.', 'On level ground 45 degrees gives the longest range.', 'Real balls fall short: air drag is left out.'],
    calc: {
      source: 'Projectile motion without drag: R = v² sin 2θ / g, H = v² sin²θ / 2g, T = 2v sin θ / g',
      estimate: true,
      inputs: [
        { id: 'v', label: 'Speed', unit: 'm/s', default: 20, min: 0 },
        { id: 'th', label: 'Angle', unit: '°', default: 45, min: 0, max: 90 },
        { id: 'g', label: 'Gravity', unit: 'm/s²', default: 9.81, min: 0.1 },
      ],
      outputs: [
        { id: 'range', label: 'Range', expr: 'v^2 * sin(2*th) / g', unit: 'm' },
        { id: 'height', label: 'Top height', expr: 'v^2 * sin(th)^2 / (2*g)', unit: 'm' },
        { id: 'time', label: 'Flight time', expr: '2 * v * sin(th) / g', unit: 's' },
      ],
      tests: [
        { in: { v: 20, th: 45, g: 9.81 }, out: { range: 40.77, height: 10.19, time: 2.883 } },
        { in: { v: 10, th: 30, g: 9.81 }, out: { range: 8.828, height: 1.274, time: 1.019 } },
      ],
    },
  },
  {
    id: 'motion-equations', name: 'Motion Equations', family: 'learn', glyph: 'chart', archetype: 'calc',
    pitch: 'Start speed, acceleration and time give final speed and distance covered.',
    keywords: ['suvat', 'motion', 'acceleration', 'velocity', 'physics', 'kinematics'],
    tour: ['Type the starting speed, the steady acceleration and the time.', 'Set acceleration to 9.81 for a dropped object.', 'A negative acceleration is braking.'],
    calc: {
      source: 'Equations of uniformly accelerated motion: v = u + at, s = ut + ½at²',
      estimate: true,
      inputs: [
        { id: 'u', label: 'Start speed', unit: 'm/s', default: 0 },
        { id: 'a', label: 'Acceleration', unit: 'm/s²', default: 9.81 },
        { id: 't', label: 'Time', unit: 's', default: 2, min: 0 },
      ],
      outputs: [
        { id: 'v', label: 'Final speed', expr: 'u + a*t', unit: 'm/s' },
        { id: 's', label: 'Distance', expr: 'u*t + 0.5*a*t^2', unit: 'm' },
        { id: 'avg', label: 'Average speed', expr: '(u + v) / 2', unit: 'm/s' },
      ],
      tests: [
        { in: { u: 0, a: 9.81, t: 2 }, out: { v: 19.62, s: 19.62, avg: 9.81 } },
        { in: { u: 20, a: -4, t: 5 }, out: { v: 0, s: 50, avg: 10 } },
      ],
    },
  },
  {
    id: 'energy-power', name: 'Energy and Power', family: 'learn', glyph: 'battery', archetype: 'calc',
    pitch: 'Kinetic and potential energy of a mass, and the power to lift it in time.',
    keywords: ['energy', 'kinetic', 'potential', 'power', 'joules', 'physics'],
    tour: ['Type the mass, its speed and how high it is.', 'Kinetic energy grows with the square of speed: double it, four times.', 'Lift time turns the potential energy into watts.'],
    calc: {
      source: 'Kinetic energy ½mv², gravitational potential energy mgh, power = energy ÷ time',
      estimate: true,
      inputs: [
        { id: 'm', label: 'Mass', unit: 'kg', default: 2, min: 0 },
        { id: 'v', label: 'Speed', unit: 'm/s', default: 3, min: 0 },
        { id: 'h', label: 'Height', unit: 'm', default: 10, min: 0 },
        { id: 't', label: 'Lift time', unit: 's', default: 4, min: 0.01 },
      ],
      outputs: [
        { id: 'ke', label: 'Kinetic', expr: '0.5*m*v^2', unit: 'J' },
        { id: 'pe', label: 'Potential', expr: 'm*9.81*h', unit: 'J' },
        { id: 'p', label: 'Lift power', expr: 'pe / t', unit: 'W' },
      ],
      tests: [
        { in: { m: 2, v: 3, h: 10, t: 4 }, out: { ke: 9, pe: 196.2, p: 49.05 } },
        { in: { m: 70, v: 5, h: 3, t: 6 }, out: { ke: 875, pe: 2060.1, p: 343.35 } },
      ],
    },
  },
  {
    id: 'speed-of-sound', name: 'Speed of Sound', family: 'learn', glyph: 'wave', archetype: 'calc',
    pitch: 'Sound speed in air at any temperature, and how far away the lightning was.',
    keywords: ['sound', 'speed', 'thunder', 'lightning', 'physics', 'acoustics'],
    tour: ['Type the air temperature for the speed of sound in dry air.', 'Count seconds from flash to thunder to see how far the storm is.', 'About three seconds is one kilometre.'],
    calc: {
      source: 'Speed of sound in dry air, v = 331.3 √(1 + T/273.15) m/s',
      inputs: [
        { id: 't', label: 'Air temp', unit: '°C', default: 20, min: -60, max: 60 },
        { id: 's', label: 'Thunder delay', unit: 's', default: 3, min: 0 },
      ],
      outputs: [
        { id: 'v', label: 'Speed', expr: '331.3*sqrt(1 + t/273.15)', unit: 'm/s', dp: 1 },
        { id: 'km', label: 'Storm distance', expr: 'v*s/1000', unit: 'km', dp: 2 },
      ],
      tests: [
        { in: { t: 20, s: 3 }, out: { v: 343.2, km: 1.03 } },
        { in: { t: 0, s: 10 }, out: { v: 331.3, km: 3.31 } },
      ],
    },
  },
  {
    id: 'drag-force', name: 'Drag Force', family: 'learn', glyph: 'wave', archetype: 'calc',
    pitch: 'Air drag on a moving shape and the power it takes to push through.',
    keywords: ['drag', 'aerodynamics', 'air', 'resistance', 'cycling', 'wind'],
    tour: ['Type speed, drag coefficient and frontal area of the shape.', 'An upright cyclist is near 0.9 Cd and 0.5 m² of front.', 'Drag grows with speed squared, power with speed cubed.'],
    calc: {
      source: 'The drag equation, F = ½ρv²CdA (NASA Glenn drag equation page)',
      estimate: true,
      inputs: [
        { id: 'v', label: 'Speed', unit: 'm/s', default: 10, min: 0 },
        { id: 'cd', label: 'Drag coefficient', default: 0.9, min: 0, step: 0.01 },
        { id: 'a', label: 'Frontal area', unit: 'm²', default: 0.5, min: 0, step: 0.01 },
        { id: 'rho', label: 'Air density', unit: 'kg/m³', default: 1.225, min: 0, step: 0.001 },
      ],
      outputs: [
        { id: 'f', label: 'Drag', expr: '0.5*rho*v^2*cd*a', unit: 'N' },
        { id: 'p', label: 'Power', expr: 'f*v', unit: 'W', dp: 1 },
      ],
      tests: [
        { in: { v: 10, cd: 0.9, a: 0.5, rho: 1.225 }, out: { f: 27.5625, p: 275.6 } },
        { in: { v: 30, cd: 0.3, a: 2.2, rho: 1.225 }, out: { f: 363.83, p: 10914.8 } },
      ],
    },
  },
  {
    id: 'light-travel', name: 'Light Travel Time', family: 'learn', glyph: 'sun', archetype: 'calc',
    pitch: 'How long light takes to cross any distance, from the Moon to the Sun.',
    keywords: ['light', 'speed', 'space', 'distance', 'astronomy'],
    tour: ['Type a distance in kilometres.', 'The Moon is about 384,400 km: light takes just over a second.', 'From the Sun, about 150 million km, it takes over eight minutes.'],
    calc: {
      source: 'Speed of light in a vacuum, c = 299,792.458 km/s exactly (SI definition, BIPM)',
      inputs: [{ id: 'd', label: 'Distance', unit: 'km', default: 384400, min: 0 }],
      outputs: [
        { id: 's', label: 'Seconds', expr: 'd / 299792.458', unit: 's', dp: 3 },
        { id: 'm', label: 'Minutes', expr: 's / 60', unit: 'min', dp: 2 },
      ],
      tests: [
        { in: { d: 384400 }, out: { s: 1.282, m: 0.02 } },
        { in: { d: 149597870.7 }, out: { s: 499.005, m: 8.317 } },
      ],
    },
  },
  {
    id: 'molar-mass', name: 'Molar Mass', family: 'learn', glyph: 'flask', archetype: 'calc',
    pitch: 'Count the atoms of each element to get a compound\'s molar mass.',
    keywords: ['molar', 'mass', 'chemistry', 'moles', 'formula', 'compound'],
    tour: ['Type how many of each atom the formula has: glucose is C6 H12 O6.', 'The answer is in grams per mole.', 'Grams to moles divides your sample by the molar mass.'],
    calc: {
      source: 'IUPAC standard atomic weights (abridged): C 12.011, H 1.008, O 15.999, N 14.007, S 32.06, Cl 35.45, Na 22.990',
      inputs: [
        { id: 'c', label: 'Carbon', default: 6, min: 0, step: 1 },
        { id: 'h', label: 'Hydrogen', default: 12, min: 0, step: 1 },
        { id: 'o', label: 'Oxygen', default: 6, min: 0, step: 1 },
        { id: 'n', label: 'Nitrogen', default: 0, min: 0, step: 1 },
        { id: 's', label: 'Sulphur', default: 0, min: 0, step: 1 },
        { id: 'cl', label: 'Chlorine', default: 0, min: 0, step: 1 },
        { id: 'na', label: 'Sodium', default: 0, min: 0, step: 1 },
        { id: 'g', label: 'Sample', unit: 'g', default: 18, min: 0 },
      ],
      outputs: [
        { id: 'mm', label: 'Molar mass', expr: 'c*12.011 + h*1.008 + o*15.999 + n*14.007 + s*32.06 + cl*35.45 + na*22.990', unit: 'g/mol', dp: 3 },
        { id: 'mol', label: 'Moles', expr: 'g / max(mm, 0.000001)', unit: 'mol', dp: 4 },
      ],
      tests: [
        { in: { c: 6, h: 12, o: 6, n: 0, s: 0, cl: 0, na: 0, g: 18 }, out: { mm: 180.156, mol: 0.0999 } },
        { in: { c: 0, h: 2, o: 1, n: 0, s: 0, cl: 0, na: 0, g: 18.015 }, out: { mm: 18.015, mol: 1 } },
        { in: { c: 0, h: 0, o: 0, n: 0, s: 0, cl: 1, na: 1, g: 58.44 }, out: { mm: 58.44, mol: 1 } },
      ],
    },
  },
  {
    id: 'dilution', name: 'Dilution', family: 'learn', glyph: 'drop', archetype: 'calc',
    pitch: 'How much a stock solution must be diluted to reach a weaker strength.',
    keywords: ['dilution', 'concentration', 'solution', 'chemistry', 'lab'],
    tour: ['Type the stock strength, the stock used and the strength you want.', 'Final volume is how much you end up with.', 'Water to add is the difference.'],
    calc: {
      source: 'Dilution equation, C1V1 = C2V2',
      inputs: [
        { id: 'c1', label: 'Stock strength', unit: 'mol/L', default: 2, min: 0 },
        { id: 'v1', label: 'Stock used', unit: 'mL', default: 50, min: 0 },
        { id: 'c2', label: 'Wanted strength', unit: 'mol/L', default: 0.5, min: 0.000001 },
      ],
      outputs: [
        { id: 'v2', label: 'Final volume', expr: 'c1*v1/c2', unit: 'mL', dp: 1 },
        { id: 'add', label: 'Add water', expr: 'v2 - v1', unit: 'mL', dp: 1 },
      ],
      tests: [
        { in: { c1: 2, v1: 50, c2: 0.5 }, out: { v2: 200, add: 150 } },
        { in: { c1: 1, v1: 10, c2: 0.1 }, out: { v2: 100, add: 90 } },
      ],
    },
  },
  {
    id: 'ideal-gas', name: 'Ideal Gas', family: 'learn', glyph: 'cloud', archetype: 'calc',
    pitch: 'Pressure, volume and temperature give the moles of an ideal gas.',
    keywords: ['gas', 'law', 'pressure', 'volume', 'moles', 'chemistry'],
    tour: ['Type pressure in kilopascals, volume in litres and temperature in °C.', 'At 0 °C and 101.325 kPa, 22.4 L holds about one mole.', 'Real gases stray from this at high pressure.'],
    calc: {
      source: 'Ideal gas law, PV = nRT, with R = 8.314 L·kPa/(mol·K)',
      inputs: [
        { id: 'p', label: 'Pressure', unit: 'kPa', default: 101.325, min: 0 },
        { id: 'v', label: 'Volume', unit: 'L', default: 22.414, min: 0 },
        { id: 't', label: 'Temperature', unit: '°C', default: 0, min: -273 },
      ],
      outputs: [
        { id: 'k', label: 'Kelvin', expr: 't + 273.15', unit: 'K' },
        { id: 'n', label: 'Moles', expr: 'p*v / (8.314*k)', unit: 'mol', dp: 4 },
      ],
      tests: [
        { in: { p: 101.325, v: 22.414, t: 0 }, out: { k: 273.15, n: 1.0001 } },
        { in: { p: 200, v: 10, t: 27 }, out: { k: 300.15, n: 0.8015 } },
      ],
    },
  },
  {
    id: 'half-life', name: 'Half-Life', family: 'learn', glyph: 'hourglass', archetype: 'calc',
    pitch: 'How much of a decaying substance is left after any length of time.',
    keywords: ['half', 'life', 'decay', 'radioactive', 'carbon', 'dating'],
    tour: ['Type the starting amount, the half-life and the time gone by.', 'Carbon-14 has a half-life of about 5,730 years.', 'After two half-lives a quarter is left.'],
    calc: {
      source: 'Exponential decay, N = N₀ (½)^(t / T½)',
      inputs: [
        { id: 'n0', label: 'Start amount', default: 100, min: 0 },
        { id: 'th', label: 'Half-life', default: 5730, min: 0.000001 },
        { id: 't', label: 'Time gone', default: 11460, min: 0 },
      ],
      outputs: [
        { id: 'n', label: 'Left', expr: 'n0 * 0.5^(t/th)', dp: 3 },
        { id: 'pct', label: 'Share left', expr: '100 * 0.5^(t/th)', unit: '%', dp: 2 },
        { id: 'halves', label: 'Half-lives', expr: 't/th', dp: 2 },
      ],
      tests: [
        { in: { n0: 100, th: 5730, t: 11460 }, out: { n: 25, pct: 25, halves: 2 } },
        { in: { n0: 80, th: 8, t: 24 }, out: { n: 10, pct: 12.5, halves: 3 } },
      ],
    },
  },
  {
    id: 'element-cards', name: 'Element Cards', family: 'learn', glyph: 'atom', archetype: 'deck',
    pitch: 'Every element\'s symbol and atomic number, drilled until you know them all.',
    keywords: ['elements', 'symbols', 'chemistry', 'periodic', 'cards'],
    tour: ['Each card shows a symbol; say the element and its number.', 'The tricky ones come from Latin: Na sodium, Fe iron, Pb lead.', 'Start with the first twenty, which come up most.'],
    deck: { mode: 'srs', cards: ELS.map(({ z, sym, name }) => ({ q: sym, a: `${name}, atomic number ${z}` })) },
  },
  {
    id: 'physical-constants', name: 'Constants', family: 'learn', glyph: 'atom', archetype: 'deck',
    pitch: 'The constants of physics with their exact or standard values.',
    keywords: ['constants', 'physics', 'light', 'planck', 'avogadro', 'gravity'],
    tour: ['Seven of these are exact by definition since the 2019 SI.', 'Say the value and its unit before turning the card.', 'Knowing the size of each one makes estimates easy.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Speed of light in a vacuum, c=299,792,458 m/s (exact);Planck constant, h=6.626 070 15 × 10⁻³⁴ J s (exact);' +
        'Elementary charge, e=1.602 176 634 × 10⁻¹⁹ C (exact);Boltzmann constant, k=1.380 649 × 10⁻²³ J/K (exact);' +
        'Avogadro constant, N_A=6.022 140 76 × 10²³ per mole (exact);Standard gravity, g=9.806 65 m/s² (defined);' +
        'Standard atmosphere=101,325 Pa (defined);Absolute zero=0 K, which is −273.15 °C;' +
        'Molar gas constant, R=8.314 J/(mol K), to four figures;Newtonian constant of gravitation, G=6.674 × 10⁻¹¹ m³/(kg s²), to four figures',
      ),
    },
  },
  {
    id: 'planets', name: 'Planets', family: 'learn', glyph: 'globe', archetype: 'deck',
    pitch: 'The eight planets in order, with the facts that set each one apart.',
    keywords: ['planets', 'solar', 'system', 'space', 'astronomy'],
    tour: ['Learn the order first, from Mercury out to Neptune.', 'Each card asks for one fact that sets a planet apart.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Planet closest to the Sun=Mercury;Second planet from the Sun=Venus;Fourth planet from the Sun=Mars;' +
        'Fifth planet from the Sun=Jupiter;Sixth planet from the Sun=Saturn;Seventh planet from the Sun=Uranus;' +
        'Eighth planet from the Sun=Neptune;Largest planet=Jupiter;Smallest planet=Mercury;Hottest planet=Venus, from its thick carbon dioxide air;' +
        'Planet that spins on its side=Uranus;Why Mars looks red=Iron oxide, rust, in its dust;The gas giants=Jupiter and Saturn;' +
        'The ice giants=Uranus and Neptune;The rocky planets=Mercury, Venus, Earth and Mars;Planet with the best-known rings=Saturn;' +
        'Pluto\'s class since 2006=Dwarf planet;Average distance from Earth to the Sun=About 150 million km, one astronomical unit;' +
        'Earth\'s one natural satellite=The Moon;Largest volcano known in the solar system=Olympus Mons, on Mars',
      ),
    },
  },
  {
    id: 'bones', name: 'Bones of the Body', family: 'learn', glyph: 'heart', archetype: 'deck',
    pitch: 'The main bones of the human skeleton by everyday and anatomical name.',
    keywords: ['bones', 'skeleton', 'anatomy', 'body', 'biology'],
    tour: ['Each card gives the everyday name; answer with the anatomical one.', 'Touch the bone on yourself as you say it: it sticks.', 'Start at the head and work down.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Skull=Cranium;Lower jaw=Mandible;Collarbone=Clavicle;Shoulder blade=Scapula;Breastbone=Sternum;' +
        'Upper arm bone=Humerus;Forearm bone on the thumb side=Radius;Forearm bone on the little finger side=Ulna;' +
        'Wrist bones=Carpals, eight in each wrist;Palm bones=Metacarpals, five in each hand;Finger and toe bones=Phalanges;' +
        'Thigh bone, the longest in the body=Femur;Kneecap=Patella;Shin bone=Tibia;Thin outer lower-leg bone=Fibula;' +
        'Heel bone=Calcaneus;Ankle bones=Tarsals, seven in each foot;Smallest bone in the body=Stapes, in the middle ear;' +
        'Bones in an adult skeleton=206;Neck vertebrae=7 cervical;Upper back vertebrae=12 thoracic;Lower back vertebrae=5 lumbar;' +
        'Pairs of ribs=12;Tailbone=Coccyx',
      ),
    },
  },
  {
    id: 'lab-notebook', name: 'Lab Notebook', family: 'learn', glyph: 'flask', archetype: 'log',
    pitch: 'Experiments written up properly: question, method, result and what it means.',
    keywords: ['experiment', 'lab', 'science', 'notebook', 'results'],
    tour: ['Write the question and your guess before you start.', 'Add the method and the numbers you measured, then a photo.', 'The conclusion says whether the guess held up.'],
    log: {
      fields: [
        { id: 'title', label: 'Experiment', type: 'text', required: true },
        { id: 'date', label: 'Date', type: 'date', default: 'today' },
        { id: 'subject', label: 'Subject', type: 'choice', options: ['Physics', 'Chemistry', 'Biology', 'Electronics', 'Kitchen science', 'Other'] },
        { id: 'question', label: 'Question', type: 'long' },
        { id: 'guess', label: 'Prediction', type: 'long' },
        { id: 'method', label: 'Method', type: 'long' },
        { id: 'result', label: 'Result', type: 'long' },
        { id: 'conclusion', label: 'Conclusion', type: 'long' },
        { id: 'held', label: 'Prediction held', type: 'check' },
        { id: 'photo', label: 'Photo', type: 'photo' },
      ],
      title: 'title', sub: 'subject', date: 'date', group: 'subject', sort: { field: 'date', dir: 'desc' },
      stats: [{ label: 'Experiments', kind: 'count' }, { label: 'This month', kind: 'count', period: 'month' }, { label: 'Subjects', kind: 'distinct', field: 'subject' }],
      views: ['list', 'gallery', 'calendar'],
    },
    sample: [
      { title: 'Pendulum length and period', date: '2026-11-08', subject: 'Physics', question: 'Does a longer pendulum swing more slowly?', guess: 'Four times the length doubles the period.', method: 'Timed ten swings at 25 cm and 100 cm.', result: '25 cm: 10.1 s. 100 cm: 20.0 s.', conclusion: 'Period doubled when length went up four times.', held: true },
      { title: 'Red cabbage indicator', date: '2026-10-25', subject: 'Kitchen science', question: 'Which household liquids are acids?', guess: 'Lemon juice and vinegar.', method: 'Added cabbage water to five liquids.', result: 'Lemon and vinegar turned pink; soap turned green.', conclusion: 'Pink for acids, green for alkalis.', held: true },
      { title: 'Seeds in light and dark', date: '2026-10-12', subject: 'Biology', question: 'Do cress seeds need light to sprout?', guess: 'They will not sprout in the dark.', method: 'Two trays, one in a cupboard, five days.', result: 'Both sprouted; the dark tray was pale and tall.', conclusion: 'Sprouting needs no light; greening does.', held: false },
    ],
  },
  {
    id: 'tempo-converter', name: 'Tempo Converter', family: 'learn', glyph: 'timer', archetype: 'calc',
    pitch: 'Beats per minute into milliseconds per beat, half beat and quarter beat.',
    keywords: ['tempo', 'bpm', 'delay', 'milliseconds', 'music', 'metronome'],
    tour: ['Type the tempo in beats per minute.', 'The results are note lengths in milliseconds, handy for delay effects.', 'At 120 bpm one beat is exactly half a second.'],
    calc: {
      source: 'One beat lasts 60,000 ms ÷ bpm',
      inputs: [{ id: 'bpm', label: 'Tempo', unit: 'bpm', default: 120, min: 20, max: 400 }],
      outputs: [
        { id: 'q', label: 'One beat', expr: '60000 / bpm', unit: 'ms', dp: 1 },
        { id: 'e', label: 'Half beat', expr: 'q / 2', unit: 'ms', dp: 1 },
        { id: 's', label: 'Quarter beat', expr: 'q / 4', unit: 'ms', dp: 1 },
        { id: 'bar', label: 'Bar (4/4)', expr: 'q * 4 / 1000', unit: 's', dp: 2 },
      ],
      tests: [
        { in: { bpm: 120 }, out: { q: 500, e: 250, s: 125, bar: 2 } },
        { in: { bpm: 90 }, out: { q: 666.7, e: 333.3, s: 166.7, bar: 2.67 } },
      ],
    },
  },
  {
    id: 'clean-runs', name: 'Clean Runs', family: 'learn', glyph: 'check', archetype: 'counter',
    pitch: 'Count clean run-throughs of a hard passage against the slips, each day.',
    keywords: ['practice', 'repetition', 'passage', 'count', 'music'],
    tour: ['Tap Clean for a run with no slips, Slip for one with any.', 'Aim for five clean in a row before you raise the tempo.', 'The counts start fresh each day.'],
    counter: { names: ['Clean', 'Slip'], step: 1, reset: 'daily' },
  },
  {
    id: 'morse-code', name: 'Morse Code', family: 'learn', glyph: 'wave', archetype: 'deck',
    pitch: 'Every letter and digit in international Morse code, read at sight.',
    keywords: ['morse', 'code', 'signals', 'radio', 'letters'],
    tour: ['Each card shows dots and dashes; say the letter.', 'Start with E, T, A, N, I, M: the shortest codes.', 'SOS is three dots, three dashes, three dots.'],
    deck: { mode: 'srs', cards: MORSE_CARDS },
  },
  {
    id: 'major-system', name: 'Major System', family: 'learn', glyph: 'brain', archetype: 'deck',
    pitch: 'The number-to-sound code that turns long numbers into memorable words.',
    keywords: ['memory', 'numbers', 'mnemonic', 'major', 'system'],
    tour: ['Each digit is a consonant sound; vowels are free filler.', '3 is m, 2 is n, so 32 can be "moon".', 'Learn the ten sounds, then turn your PIN into a picture.'],
    deck: {
      mode: 'srs',
      cards: list(
        '0=s or z (zero starts with z);1=t or d (one downstroke);2=n (two downstrokes);3=m (three downstrokes);' +
        '4=r (the last sound of four);5=l (fingers make an L);6=j, sh, ch or soft g;7=k, hard c or hard g;8=f or v;9=p or b;' +
        '32 as a word=moon (m, n);14 as a word=tyre (t, r);71 as a word=cat (k, t);95 as a word=bell (b, l)',
      ),
    },
  },
  {
    id: 'logical-fallacies', name: 'Fallacies', family: 'learn', glyph: 'brain', archetype: 'deck',
    pitch: 'The common flaws in arguments, named, so you can spot them anywhere.',
    keywords: ['fallacies', 'logic', 'argument', 'critical', 'thinking'],
    tour: ['Each card names a fallacy; say what it is before you turn it.', 'Then think of one you heard this week.', 'Naming a flaw calmly beats shouting at it.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Ad hominem=Attacking the person instead of the argument;Straw man=Answering a weaker version of the claim than the one made;' +
        'False dilemma=Offering two options when more exist;Slippery slope=Claiming one step must lead to an extreme without showing why;' +
        'Appeal to authority=Treating a claim as true only because someone important said it;' +
        'Bandwagon=Treating a claim as true because many people believe it;Circular reasoning=Using the conclusion as a premise;' +
        'Post hoc=Assuming that because B followed A, A caused B;Hasty generalisation=Drawing a wide rule from a few cases;' +
        'Red herring=Bringing in an unrelated point to distract;Tu quoque=Dismissing criticism because the critic does the same;' +
        'Appeal to nature=Treating natural as good and unnatural as bad;Sunk cost=Carrying on because of what has already been spent;' +
        'No true Scotsman=Changing a definition to dodge a counter-example;Burden of proof=Asking others to disprove a claim you made;' +
        'Loaded question=A question that assumes something unproven;Texas sharpshooter=Picking out the data that fits after the fact;' +
        'Middle ground=Assuming the truth must lie halfway between two claims',
      ),
    },
  },
  {
    id: 'history-dates', name: 'History Dates', family: 'learn', glyph: 'hourglass', archetype: 'deck',
    pitch: 'The landmark dates of British and world history, from 1066 to the Moon.',
    keywords: ['history', 'dates', 'events', 'timeline', 'britain'],
    tour: ['Each card names an event; say the year.', 'Hang new dates on ones you know: 1066, 1666, 1945.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Battle of Hastings=1066;Magna Carta sealed=1215;Black Death reaches England=1348;Battle of Bosworth Field=1485;' +
        'Columbus reaches the Americas=1492;Defeat of the Spanish Armada=1588;Gunpowder Plot=1605;Great Fire of London=1666;' +
        'Acts of Union of England and Scotland=1707;American Declaration of Independence=1776;Storming of the Bastille=1789;' +
        'Battle of Trafalgar=1805;Battle of Waterloo=1815;Slavery Abolition Act passed=1833;Queen Victoria crowned=1838;' +
        'First World War begins=1914;First World War ends=1918;Some women over 30 win the vote in Britain=1918;' +
        'Second World War begins=1939;D-Day landings=1944;Second World War ends=1945;NHS founded=1948;' +
        'Partition of India and Pakistan=1947;First person on the Moon=1969;Fall of the Berlin Wall=1989;' +
        'Channel Tunnel opens=1994;UK leaves the European Union=2020',
      ),
    },
  },
  {
    id: 'british-monarchs', name: 'British Monarchs', family: 'learn', glyph: 'trophy', archetype: 'deck',
    pitch: 'Every English and British monarch since the Tudors, with the year they came in.',
    keywords: ['monarchs', 'kings', 'queens', 'history', 'tudors', 'britain'],
    tour: ['Each card names a monarch; say the year their reign began.', 'Learn them house by house: Tudors, Stuarts, Hanoverians, Windsors.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Henry VII=1485, the first Tudor;Henry VIII=1509;Edward VI=1547;Mary I=1553;Elizabeth I=1558, the last Tudor;' +
        'James I=1603, the first Stuart in England;Charles I=1625;Charles II=1660, after the Commonwealth;James II=1685;' +
        'William III and Mary II=1689;Anne=1702, the first monarch of Great Britain from 1707;George I=1714, the first Hanoverian;' +
        'George II=1727;George III=1760;George IV=1820;William IV=1830;Victoria=1837;Edward VII=1901;' +
        'George V=1910, who named the house Windsor in 1917;Edward VIII=1936, abdicated the same year;George VI=1936;' +
        'Elizabeth II=1952;Charles III=2022',
      ),
    },
  },
  {
    id: 'capitals-europe', name: 'Capitals: Europe', family: 'learn', glyph: 'flag', archetype: 'deck',
    pitch: 'The capital city of every European country, drilled until it sticks.',
    keywords: ['capitals', 'europe', 'geography', 'countries', 'cities'],
    tour: ['Each card names a country; say its capital.', 'Watch the classics: Bern for Switzerland, Ankara for Turkey.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'France=Paris;Germany=Berlin;Spain=Madrid;Italy=Rome;Portugal=Lisbon;Netherlands=Amsterdam;Belgium=Brussels;' +
        'Austria=Vienna;Switzerland=Bern;Poland=Warsaw;Czechia=Prague;Slovakia=Bratislava;Hungary=Budapest;Romania=Bucharest;' +
        'Bulgaria=Sofia;Greece=Athens;Croatia=Zagreb;Slovenia=Ljubljana;Serbia=Belgrade;Bosnia and Herzegovina=Sarajevo;' +
        'Albania=Tirana;North Macedonia=Skopje;Montenegro=Podgorica;Denmark=Copenhagen;Norway=Oslo;Sweden=Stockholm;' +
        'Finland=Helsinki;Iceland=Reykjavík;Ireland=Dublin;Estonia=Tallinn;Latvia=Riga;Lithuania=Vilnius;Ukraine=Kyiv;' +
        'Belarus=Minsk;Moldova=Chișinău;Luxembourg=Luxembourg;Malta=Valletta;Cyprus=Nicosia;Andorra=Andorra la Vella;' +
        'Liechtenstein=Vaduz;Turkey=Ankara;Scotland=Edinburgh;Wales=Cardiff;Northern Ireland=Belfast;England=London',
      ),
    },
  },
  {
    id: 'capitals-asia', name: 'Capitals: Asia', family: 'learn', glyph: 'flag', archetype: 'deck',
    pitch: 'The capital cities of Asia and the Middle East, from Tokyo to Riyadh.',
    keywords: ['capitals', 'asia', 'geography', 'countries', 'cities'],
    tour: ['Each card names a country; say its capital.', 'Watch the ones that are not the biggest city: Islamabad, Astana.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Japan=Tokyo;China=Beijing;South Korea=Seoul;North Korea=Pyongyang;India=New Delhi;Pakistan=Islamabad;' +
        'Bangladesh=Dhaka;Nepal=Kathmandu;Bhutan=Thimphu;Afghanistan=Kabul;Iran=Tehran;Iraq=Baghdad;Saudi Arabia=Riyadh;' +
        'United Arab Emirates=Abu Dhabi;Qatar=Doha;Oman=Muscat;Kuwait=Kuwait City;Jordan=Amman;Syria=Damascus;Lebanon=Beirut;' +
        'Thailand=Bangkok;Vietnam=Hanoi;Cambodia=Phnom Penh;Laos=Vientiane;Myanmar=Naypyidaw;Malaysia=Kuala Lumpur;' +
        'Philippines=Manila;Mongolia=Ulaanbaatar;Kazakhstan=Astana;Uzbekistan=Tashkent;Bahrain=Manama;Yemen=Sana\'a',
      ),
    },
  },
  {
    id: 'capitals-africa', name: 'Capitals: Africa', family: 'learn', glyph: 'flag', archetype: 'deck',
    pitch: 'The capital cities of Africa, from Cairo and Rabat to Nairobi and Abuja.',
    keywords: ['capitals', 'africa', 'geography', 'countries', 'cities'],
    tour: ['Each card names a country; say its capital.', 'Watch the moved capitals: Abuja not Lagos, Dodoma not Dar es Salaam.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Egypt=Cairo;Morocco=Rabat;Algeria=Algiers;Tunisia=Tunis;Libya=Tripoli;Nigeria=Abuja;Ghana=Accra;Kenya=Nairobi;' +
        'Ethiopia=Addis Ababa;Uganda=Kampala;Tanzania=Dodoma;Rwanda=Kigali;Senegal=Dakar;Mali=Bamako;Zimbabwe=Harare;' +
        'Zambia=Lusaka;Botswana=Gaborone;Namibia=Windhoek;Angola=Luanda;Mozambique=Maputo;Madagascar=Antananarivo;' +
        'Sudan=Khartoum;Somalia=Mogadishu;Cameroon=Yaoundé;Democratic Republic of the Congo=Kinshasa;Malawi=Lilongwe',
      ),
    },
  },
  {
    id: 'capitals-americas', name: 'Capitals: Americas', family: 'learn', glyph: 'flag', archetype: 'deck',
    pitch: 'The capital cities of the Americas and Oceania, from Ottawa to Wellington.',
    keywords: ['capitals', 'americas', 'oceania', 'geography', 'countries'],
    tour: ['Each card names a country; say its capital.', 'Watch the classics: Ottawa, Brasília, Canberra.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'United States=Washington, D.C.;Canada=Ottawa;Mexico=Mexico City;Cuba=Havana;Jamaica=Kingston;Brazil=Brasília;' +
        'Argentina=Buenos Aires;Chile=Santiago;Peru=Lima;Colombia=Bogotá;Venezuela=Caracas;Ecuador=Quito;Uruguay=Montevideo;' +
        'Paraguay=Asunción;Costa Rica=San José;Panama=Panama City;Guatemala=Guatemala City;Australia=Canberra;' +
        'New Zealand=Wellington;Fiji=Suva;Papua New Guinea=Port Moresby',
      ),
    },
  },

  /* ===================== Code ===================== */
  {
    id: 'git-commands', name: 'Git Commands', family: 'learn', glyph: 'terminal', archetype: 'deck',
    pitch: 'The everyday version-control commands and what each one does.',
    keywords: ['git', 'commands', 'version', 'control', 'coding'],
    tour: ['Each card is a job; answer with the command.', 'Type it in a test folder to make it stick.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Start a new repository here=git init;Copy a remote repository=git clone <url>;See what has changed=git status;' +
        'Stage a file=git add <file>;Save staged changes with a message=git commit -m "message";See the history=git log;' +
        'See unstaged changes line by line=git diff;Make a new branch and switch to it=git switch -c <name>;' +
        'Switch to a branch=git switch <name>;Bring another branch\'s work into this one=git merge <branch>;' +
        'Download and merge remote work=git pull;Upload your commits=git push;Download remote work without merging=git fetch;' +
        'Put work aside for later=git stash;Bring stashed work back=git stash pop;Undo a commit with a new commit=git revert <commit>;' +
        'Unstage a file=git restore --staged <file>;Throw away changes to a file=git restore <file>;List branches=git branch;' +
        'Show who last changed each line=git blame <file>',
      ),
    },
  },
  {
    id: 'big-o', name: 'Big O', family: 'learn', glyph: 'chart', archetype: 'deck',
    pitch: 'The time cost of common algorithms and data structures, for interviews.',
    keywords: ['big', 'complexity', 'algorithms', 'data', 'structures', 'interview'],
    tour: ['Each card names an operation; say its time cost.', 'Picture doubling the input: what happens to the work.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Read an array item by index=O(1);Search an unsorted array=O(n);Binary search on a sorted array=O(log n);' +
        'Look up a key in a hash table (average)=O(1);Look up in a balanced binary search tree=O(log n);' +
        'Insert at the front of a linked list=O(1);Push or pop on a stack=O(1);Merge sort=O(n log n) in every case;' +
        'Quicksort, average=O(n log n);Quicksort, worst case=O(n²);Bubble sort, worst case=O(n²);' +
        'Insert into a binary heap=O(log n);Read the smallest item of a min-heap=O(1);' +
        'Breadth-first search on a graph=O(V + E);Depth-first search on a graph=O(V + E);' +
        'Dijkstra\'s algorithm with a binary heap=O((V + E) log V);Every subset of n items=O(2ⁿ);Every ordering of n items=O(n factorial)',
      ),
    },
  },
  {
    id: 'reading-list', name: 'Reading List', family: 'learn', glyph: 'book', archetype: 'log',
    pitch: 'Books to read, reading and read, with pages, dates, rating and a yearly goal.',
    keywords: ['reading', 'books', 'list', 'library', 'pages'],
    tour: ['Add a book to To read; move it to Reading when you start.', 'The ring counts books finished this year against your goal.', 'Board view is your shelf: drag books across as you go.'],
    log: {
      fields: [
        { id: 'title', label: 'Title', type: 'text', required: true },
        { id: 'author', label: 'Author', type: 'text' },
        { id: 'status', label: 'Status', type: 'choice', options: ['To read', 'Reading', 'Read', 'Set aside'], default: 'To read' },
        { id: 'genre', label: 'Genre', type: 'choice', options: ['Fiction', 'History', 'Science', 'Biography', 'Self-help', 'Faith', 'Poetry', 'Business', 'Other'] },
        { id: 'pages', label: 'Pages', type: 'number', min: 1 },
        { id: 'finished', label: 'Finished', type: 'date' },
        { id: 'rating', label: 'Rating', type: 'rating' },
        { id: 'cover', label: 'Cover', type: 'photo' },
        { id: 'notes', label: 'Notes', type: 'long' },
      ],
      title: 'title', sub: '{author} · {pages} pages', meta: 'status', date: 'finished', group: 'status', sort: { field: 'finished', dir: 'desc' },
      stats: [
        { label: 'This year', kind: 'count', period: 'year', goal: 24, dir: 'reach' },
        { label: 'Pages', kind: 'sum', field: 'pages', period: 'year' },
        { label: 'Avg rating', kind: 'avg', field: 'rating' },
      ],
      views: ['board', 'list', 'gallery'],
    },
    sample: [
      { title: 'The Count of Monte Cristo', author: 'Alexandre Dumas', status: 'Reading', genre: 'Fiction', pages: 1276 },
      { title: 'A Short History of Nearly Everything', author: 'Bill Bryson', status: 'Read', genre: 'Science', pages: 544, finished: '2026-10-21', rating: 5 },
      { title: 'Middlemarch', author: 'George Eliot', status: 'To read', genre: 'Fiction', pages: 880 },
      { title: 'The Muqaddimah', author: 'Ibn Khaldun', status: 'Read', genre: 'History', pages: 512, finished: '2026-09-02', rating: 4 },
    ],
  },
  {
    id: 'study-log', name: 'Study Log', family: 'learn', glyph: 'pen', archetype: 'log',
    pitch: 'Every study session by subject and minutes, with a weekly goal and a streak.',
    keywords: ['study', 'hours', 'sessions', 'revision', 'learning', 'focus'],
    tour: ['Log a session when you finish: subject, minutes and how focused.', 'The ring fills towards ten hours a week.', 'The chart shows which days you actually study.'],
    log: {
      fields: [
        { id: 'subject', label: 'Subject', type: 'text', required: true, hint: 'e.g. Urdu, statistics' },
        { id: 'date', label: 'Date', type: 'date', default: 'today', required: true },
        { id: 'minutes', label: 'Minutes', type: 'duration', required: true },
        { id: 'kind', label: 'Kind', type: 'choice', options: ['Reading', 'Practice', 'Cards', 'Lecture', 'Writing', 'Project'] },
        { id: 'focus', label: 'Focus', type: 'scale', min: 1, max: 10 },
        { id: 'learned', label: 'Learned', type: 'long', hint: 'One line on what stuck' },
      ],
      title: 'subject', sub: '{kind} · focus {focus}', meta: 'minutes', date: 'date', sort: { field: 'date', dir: 'desc' },
      stats: [
        { label: 'This week', kind: 'sum', field: 'minutes', period: 'week', goal: 600, dir: 'reach' },
        { label: 'Streak', kind: 'streak' },
        { label: 'Avg focus', kind: 'avg', field: 'focus' },
        { label: 'Subjects', kind: 'distinct', field: 'subject' },
      ],
      chart: { field: 'minutes', kind: 'bar', period: 'week' },
      views: ['list', 'calendar'],
    },
    sample: [
      { subject: 'Statistics', date: '2026-11-13', minutes: 45, kind: 'Practice', focus: 8, learned: 'The margin halves when the sample is four times larger.' },
      { subject: 'Urdu', date: '2026-11-13', minutes: 20, kind: 'Cards', focus: 7 },
      { subject: 'Linear algebra', date: '2026-11-12', minutes: 60, kind: 'Lecture', focus: 6, learned: 'A determinant of zero means no inverse.' },
      { subject: 'Urdu', date: '2026-11-11', minutes: 15, kind: 'Reading', focus: 8 },
    ],
  },
  {
    id: 'exam-day', name: 'Exam Day', family: 'learn', glyph: 'check', archetype: 'checklist',
    pitch: 'Everything to pack and do the night before and the morning of an exam.',
    keywords: ['exam', 'checklist', 'pack', 'test', 'morning'],
    tour: ['Tick it through the night before, then again in the morning.', 'Photo ID and the entry slip are the two that cause panics.', 'Untick everything in settings to reuse it next time.'],
    checklist: {
      repeat: 'never',
      sections: [
        { name: 'Night before', items: ['Check the time, room and seat number', 'Pack a clear pencil case', 'Lay out photo ID and the entry slip', 'Set two alarms', 'Light review only, then sleep'] },
        { name: 'In the bag', items: ['Two black pens', 'Pencil, rubber and sharpener', 'Ruler', 'Calculator with fresh batteries', 'Water in a clear bottle', 'A watch without smart features'] },
        { name: 'Morning', items: ['Breakfast', 'Leave with time to spare', 'Phone off and away before you go in'] },
      ],
    },
  },
  /* ===================== More: maths, science, words ===================== */
  {
    id: 'binary-hex', name: 'Binary and Hex', family: 'learn', glyph: 'chip', archetype: 'deck',
    pitch: 'Numbers in binary and hexadecimal, read at sight, from 0 to 255.',
    keywords: ['binary', 'hex', 'hexadecimal', 'bits', 'coding', 'numbers'],
    tour: ['Each card shows binary or hex; say the number.', 'Each binary place doubles: 1, 2, 4, 8, 16 and on.', 'Hex runs 0 to 9, then A to F for 10 to 15.'],
    deck: { mode: 'srs', cards: BASES },
  },
  {
    id: 'trig-values', name: 'Trig Values', family: 'learn', glyph: 'ruler', archetype: 'deck',
    pitch: 'The exact sine, cosine and tangent of the key angles, and degrees in radians.',
    keywords: ['trigonometry', 'sine', 'cosine', 'tangent', 'radians', 'maths'],
    tour: ['Each card asks for one exact value; say it as a fraction or root.', 'Sine climbs 0, ½, √2/2, √3/2, 1 as cosine falls the same way.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'sin 0°=0;sin 30°=1/2;sin 45°=√2/2;sin 60°=√3/2;sin 90°=1;cos 0°=1;cos 30°=√3/2;cos 45°=√2/2;cos 60°=1/2;cos 90°=0;' +
        'tan 0°=0;tan 30°=√3/3, which is 1/√3;tan 45°=1;tan 60°=√3;tan 90°=Undefined;180° in radians=π;90° in radians=π/2;' +
        '60° in radians=π/3;45° in radians=π/4;30° in radians=π/6;360° in radians=2π;sin² θ + cos² θ=1',
      ),
    },
  },
  {
    id: 'chemical-formulas', name: 'Chemical Formulas', family: 'learn', glyph: 'flask', archetype: 'deck',
    pitch: 'The formulas of everyday chemicals, from water to baking soda.',
    keywords: ['chemistry', 'formulas', 'compounds', 'molecules', 'science'],
    tour: ['Each card names a chemical; say its formula.', 'Count the atoms aloud: CO2 is one carbon, two oxygens.', 'Molar Mass turns any of these into grams per mole.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Water=H2O;Carbon dioxide=CO2;Oxygen gas=O2;Ozone=O3;Methane=CH4;Ammonia=NH3;Table salt, sodium chloride=NaCl;' +
        'Glucose=C6H12O6;Ethanol=C2H5OH;Hydrochloric acid=HCl;Sulphuric acid=H2SO4;Nitric acid=HNO3;Sodium hydroxide=NaOH;' +
        'Calcium carbonate, chalk and limestone=CaCO3;Baking soda, sodium hydrogencarbonate=NaHCO3;Hydrogen peroxide=H2O2;' +
        'Carbon monoxide=CO;Hydrogen gas=H2;Nitrogen gas=N2',
      ),
    },
  },
  {
    id: 'cell-biology', name: 'Cell Biology', family: 'learn', glyph: 'leaf', archetype: 'deck',
    pitch: 'The parts of a cell and the core facts of DNA, division and respiration.',
    keywords: ['biology', 'cells', 'dna', 'organelles', 'science', 'revision'],
    tour: ['Each card asks for a part\'s job or one core fact.', 'Picture the cell as you answer: where each part sits.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Nucleus=Holds the DNA and controls the cell;Mitochondria=Where aerobic respiration releases energy;' +
        'Ribosomes=Where proteins are made;Chloroplasts=Where photosynthesis happens, in plant cells;' +
        'Cell membrane=Controls what enters and leaves the cell;Cell wall=Made of cellulose in plants; supports the cell;' +
        'Permanent vacuole=Holds cell sap and keeps a plant cell firm;Cytoplasm=Where most of the cell\'s reactions take place;' +
        'Prokaryotic cells=Have no nucleus; DNA lies in a loop, often with plasmids;DNA\'s shape=A double helix;' +
        'DNA base pairs=A with T, C with G;Base in RNA instead of T=U, uracil;Mitosis makes=Two identical cells;' +
        'Meiosis makes=Four gametes, each genetically different;An enzyme is=A biological catalyst;' +
        'Photosynthesis=Carbon dioxide + water → glucose + oxygen, using light;Aerobic respiration=Glucose + oxygen → carbon dioxide + water',
      ),
    },
  },
  {
    id: 'shakespeare-lines', name: 'Shakespeare Lines', family: 'learn', glyph: 'quote', archetype: 'deck',
    pitch: 'Famous lines from Shakespeare, each matched to the play it comes from.',
    keywords: ['shakespeare', 'quotes', 'plays', 'literature', 'english'],
    tour: ['Each card is a line; name the play.', 'Hamlet and Macbeth give the most, so start there.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'To be, or not to be, that is the question=Hamlet;Brevity is the soul of wit=Hamlet;' +
        'Something is rotten in the state of Denmark=Hamlet;The lady doth protest too much, methinks=Hamlet;' +
        'All the world\'s a stage=As You Like It;Now is the winter of our discontent=Richard III;' +
        'Friends, Romans, countrymen, lend me your ears=Julius Caesar;Et tu, Brute?=Julius Caesar;' +
        'Cry havoc, and let slip the dogs of war=Julius Caesar;Out, damned spot=Macbeth;' +
        'Is this a dagger which I see before me=Macbeth;Double, double toil and trouble=Macbeth;' +
        'The course of true love never did run smooth=A Midsummer Night\'s Dream;If music be the food of love, play on=Twelfth Night;' +
        'We few, we happy few, we band of brothers=Henry V;O brave new world, that has such people in\'t=The Tempest;' +
        'Parting is such sweet sorrow=Romeo and Juliet;What\'s in a name? That which we call a rose by any other name would smell as sweet=Romeo and Juliet;' +
        'The quality of mercy is not strained=The Merchant of Venice;Uneasy lies the head that wears a crown=Henry IV, Part 2',
      ),
    },
  },
  {
    id: 'grammar-terms', name: 'Grammar Terms', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'The names of the parts of English grammar, each with a plain example.',
    keywords: ['grammar', 'english', 'terms', 'words', 'school'],
    tour: ['Each card names a term; say what it means.', 'Find one in the last thing you read.', 'Missed cards come back sooner.'],
    deck: {
      mode: 'srs',
      cards: list(
        'Noun=A naming word: city, idea, Sara;Verb=A doing or being word: run, is;Adjective=Describes a noun: a red door;' +
        'Adverb=Describes a verb, adjective or adverb: ran quickly;Pronoun=Stands in for a noun: she, it, they;' +
        'Preposition=Shows place, time or relation: under, before, with;Conjunction=Joins words or clauses: and, but, because;' +
        'Determiner=Comes before a noun to pin it down: the, a, this, some;Clause=A group of words with a subject and a verb;' +
        'Subordinate clause=A clause that cannot stand alone: because it rained;Active voice=The subject does the action: the dog bit him;' +
        'Passive voice=The subject receives the action: he was bitten;Homophones=Words that sound alike but differ: there, their, they\'re;' +
        'Synonym=A word with the same meaning: big, large;Antonym=A word with the opposite meaning: hot, cold;' +
        'Prefix=Added to the start of a word: un- in unhappy;Suffix=Added to the end of a word: -ness in kindness',
      ),
    },
  },
  {
    id: 'urdu-numbers', name: 'Urdu Numbers', family: 'learn', glyph: 'type', archetype: 'deck',
    pitch: 'Urdu digits and the words for one to ten, in Urdu script with sounds.',
    keywords: ['urdu', 'numbers', 'digits', 'counting', 'language'],
    tour: ['Each card shows an Urdu digit; say the number and its word.', 'Numbers read left to right, even inside right-to-left text.', 'Mind ۴, ۵ and ۶: they differ from the Arabic forms.'],
    deck: {
      mode: 'srs',
      cards: list(
        '۰=0, صفر (sifr);۱=1, ایک (ek);۲=2, دو (do);۳=3, تین (tīn);۴=4, چار (chār);۵=5, پانچ (pāñch);۶=6, چھ (chhe);' +
        '۷=7, سات (sāt);۸=8, آٹھ (āṭh);۹=9, نو (nau);۱۰=10, دس (das)',
      ),
    },
  },
  {
    id: 'speech-practice', name: 'Speech Practice', family: 'learn', glyph: 'mic', archetype: 'timer',
    pitch: 'A timed run-through of a short talk: opening, three points and a close.',
    keywords: ['speech', 'talk', 'presentation', 'practice', 'timer'],
    tour: ['Press start and speak; a chime moves you to the next part.', 'Three points is the shape listeners remember best.', 'Run it three times; it gets smoother each time.'],
    timer: { rounds: 1, steps: [{ name: 'Opening', secs: 60 }, { name: 'Point one', secs: 120 }, { name: 'Point two', secs: 120 }, { name: 'Point three', secs: 120 }, { name: 'Close', secs: 60 }] },
  },
];
