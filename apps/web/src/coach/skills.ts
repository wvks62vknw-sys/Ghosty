/**
 * SKILLS BEYOND MUSIC (BRIEF-REST-B part 2), the same shape as the music lessons: typing (a text to type, words a minute and
 * accuracy, the keys he gets wrong), a drawing prompt a day, and ten words a day in a language he can hear spoken and say back.
 * Everything here is ours: the passages, the prompts and the word lists are written for Ghosty. Pure; the node tests run it.
 * What a phone cannot judge is said, not guessed: a drawing is shown beside its prompt and never marked; juggling and tricks by
 * camera are not in.
 */

// ---------------------------------------------------------------------------------------------------------------- TYPING

/** Passages to type, of our own, plain and a little different in which keys they use. */
export const TEXTS: string[] = [
  'The quick ghost jumped over six lazy boxes while the kettle boiled.',
  'A small light in the window means someone is awake and thinking.',
  'Practise a little every day: ten minutes beats two hours on a Sunday.',
  'Look at the screen, not at your hands, and let your fingers find the keys.',
  'Zebras quietly examined five jumbo waxy puzzles in the afternoon.',
  'Slow is smooth and smooth is fast, so keep your rhythm even.',
  'The map showed a river, two hills and a road that led nowhere in particular.',
  'Check the spelling twice, send the message once, and then put the phone down.',
  'My brain fits in my pocket, and it learns something new every night.',
  'Why do the quiet jobs often matter most? Because nobody notices them until they stop.',
  'First measure it, then draw it, then cut it, and only then say it fits.',
  'Rain on the roof, tea on the table, and a long list that is slowly getting shorter.',
];

export interface TypingScore {
  chars: number;
  correct: number;
  errors: number;
  /** 0–1 */
  accuracy: number;
  /** Words a minute counting only the letters typed right, five to a word. */
  wpm: number;
  /** The keys he got wrong most, by the key that was wanted. */
  weak: { key: string; misses: number }[];
  secs: number;
}

const keyName = (c: string) => (c === ' ' ? 'space' : c.toLowerCase());

/** Score what was typed against the text (position by position), over `ms` milliseconds. */
export function scoreTyping(target: string, typed: string, ms: number): TypingScore {
  const n = typed.length;
  let correct = 0;
  const miss = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    if (typed[i] === target[i]) correct++;
    else if (target[i] !== undefined) miss.set(keyName(target[i]!), (miss.get(keyName(target[i]!)) ?? 0) + 1);
  }
  const secs = Math.max(0.001, ms / 1000);
  const weak = [...miss].map(([key, misses]) => ({ key, misses })).sort((a, b) => b.misses - a.misses || a.key.localeCompare(b.key)).slice(0, 5);
  return { chars: n, correct, errors: n - correct, accuracy: n ? correct / n : 0, wpm: Math.round(((correct / 5) / (secs / 60)) * 10) / 10, weak, secs };
}

/** The passage for a day, leaning on the keys he misses: the text with most of them in it (ties go to the day's turn). */
export function pickText(day: number, weak: string[] = []): string {
  const keys = weak.filter((k) => k.length === 1);
  if (!keys.length) return TEXTS[day % TEXTS.length]!;
  const ranked = TEXTS.map((t, i) => ({ t, i, hits: keys.reduce((s, k) => s + t.toLowerCase().split(k).length - 1, 0) })).sort((a, b) => b.hits - a.hits || ((a.i - day) % TEXTS.length + TEXTS.length) % TEXTS.length - ((b.i - day) % TEXTS.length + TEXTS.length) % TEXTS.length);
  return ranked[0]!.t;
}

export function typingWords(s: TypingScore): string {
  const weak = s.weak.length ? ` The keys to watch: ${s.weak.map((w) => `${w.key} (${w.misses})`).join(', ')}.` : ' Every key was right.';
  return `${Math.round(s.wpm)} words a minute at ${Math.round(s.accuracy * 100)}% accuracy.${weak}`;
}

// ---------------------------------------------------------------------------------------------------------------- DRAWING

const SUBJECTS = [
  'a teapot with a face', 'your left shoe from above', 'a tree in the wind', 'the view from your window', 'a cat asleep', 'a robot that waters plants',
  'your hand holding a cup', 'a staircase that goes somewhere strange', 'a bicycle leaning on a wall', 'a lighthouse in a storm', 'a bowl of fruit', 'a door that should not be there',
  'a bird on a wire', 'your favourite chair', 'a paper boat', 'a very old car', 'a mountain at sunrise', 'a hat on a hook',
  'a pair of glasses', 'a city at night', 'a snail', 'a key', 'a clock with no numbers', 'a house made of books',
  'a fish out of water', 'a street lamp', 'the things in your pocket', 'a giant’s boot', 'a train in the rain', 'a mug and its shadow',
];
const WAYS = ['in five minutes', 'without lifting your pen', 'using only circles', 'using only straight lines', 'with your other hand', 'in one hundred lines'];

/** The drawing prompt for a day (a day number): a subject and a way of drawing it. */
export function drawPrompt(day: number): { subject: string; way: string; text: string } {
  const subject = SUBJECTS[day % SUBJECTS.length]!;
  const way = WAYS[(day * 7 + 3) % WAYS.length]!;
  return { subject, way, text: `Draw ${subject}, ${way}.` };
}

// ---------------------------------------------------------------------------------------------------------------- WORDS

export interface Language {
  id: 'es' | 'fr' | 'de' | 'it';
  label: string;
  /** [English, the word]. Forty, so a day's ten turn over every four days. */
  words: [string, string][];
}

const EN = ['hello', 'goodbye', 'please', 'thank you', 'yes', 'no', 'water', 'bread', 'house', 'friend', 'good', 'big', 'small', 'today', 'tomorrow', 'yesterday', 'night', 'day', 'food', 'milk', 'coffee', 'book', 'dog', 'cat', 'street', 'city', 'school', 'work', 'family', 'mother', 'father', 'brother', 'sister', 'red', 'blue', 'green', 'one', 'two', 'three', 'four'];
const zip = (words: string[]): [string, string][] => EN.map((e, i) => [e, words[i]!]);

export const LANGUAGES: Language[] = [
  { id: 'es', label: 'Spanish', words: zip(['hola', 'adiós', 'por favor', 'gracias', 'sí', 'no', 'agua', 'pan', 'casa', 'amigo', 'bueno', 'grande', 'pequeño', 'hoy', 'mañana', 'ayer', 'noche', 'día', 'comida', 'leche', 'café', 'libro', 'perro', 'gato', 'calle', 'ciudad', 'escuela', 'trabajo', 'familia', 'madre', 'padre', 'hermano', 'hermana', 'rojo', 'azul', 'verde', 'uno', 'dos', 'tres', 'cuatro']) },
  { id: 'fr', label: 'French', words: zip(['bonjour', 'au revoir', 's’il vous plaît', 'merci', 'oui', 'non', 'eau', 'pain', 'maison', 'ami', 'bon', 'grand', 'petit', 'aujourd’hui', 'demain', 'hier', 'nuit', 'jour', 'nourriture', 'lait', 'café', 'livre', 'chien', 'chat', 'rue', 'ville', 'école', 'travail', 'famille', 'mère', 'père', 'frère', 'sœur', 'rouge', 'bleu', 'vert', 'un', 'deux', 'trois', 'quatre']) },
  { id: 'de', label: 'German', words: zip(['hallo', 'auf Wiedersehen', 'bitte', 'danke', 'ja', 'nein', 'Wasser', 'Brot', 'Haus', 'Freund', 'gut', 'groß', 'klein', 'heute', 'morgen', 'gestern', 'Nacht', 'Tag', 'Essen', 'Milch', 'Kaffee', 'Buch', 'Hund', 'Katze', 'Straße', 'Stadt', 'Schule', 'Arbeit', 'Familie', 'Mutter', 'Vater', 'Bruder', 'Schwester', 'rot', 'blau', 'grün', 'eins', 'zwei', 'drei', 'vier']) },
  { id: 'it', label: 'Italian', words: zip(['ciao', 'arrivederci', 'per favore', 'grazie', 'sì', 'no', 'acqua', 'pane', 'casa', 'amico', 'buono', 'grande', 'piccolo', 'oggi', 'domani', 'ieri', 'notte', 'giorno', 'cibo', 'latte', 'caffè', 'libro', 'cane', 'gatto', 'strada', 'città', 'scuola', 'lavoro', 'famiglia', 'madre', 'padre', 'fratello', 'sorella', 'rosso', 'blu', 'verde', 'uno', 'due', 'tre', 'quattro']) },
];
export const languageOf = (id: string): Language => LANGUAGES.find((l) => l.id === id || l.label.toLowerCase() === id.toLowerCase()) ?? LANGUAGES[0]!;

/** The ten words of a day, in a language: the next ten of the forty, turning over each day. */
export function dailyWords(lang: string, day: number): { en: string; word: string }[] {
  const l = languageOf(lang);
  const start = ((day % 4) + 4) % 4 * 10;
  return l.words.slice(start, start + 10).map(([en, word]) => ({ en, word }));
}

const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/ß/g, 'ss').replace(/œ/g, 'oe').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const distance = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length]![b.length]!;
};

/**
 * What the speech recogniser heard against the word asked: 'right' (the word, with or without accents, even inside a longer
 * phrase), 'close' (one letter away — a word of four letters or more), or 'wrong'.
 */
export function wordMatch(heard: string, target: string): 'right' | 'close' | 'wrong' {
  const h = plain(heard);
  const t = plain(target);
  if (!h || !t) return 'wrong';
  if (h === t || ` ${h} `.includes(` ${t} `)) return 'right';
  const words = h.split(' ');
  if (t.length >= 4 && words.some((w) => distance(w, t) <= 1)) return 'close';
  return t.length >= 4 && distance(h, t) <= 1 ? 'close' : 'wrong';
}
