/**
 * THE LENS THAT JUST KNOWS (BRIEF-LENS-KNOWS; OWNER-ISSUES 156), the pure part: what the words on a thing are written in, the
 * name of a colour, what the Machine says it is looking at, the plate above a thing and the one true line under the viewfinder.
 * No camera, no DOM, no model, nothing downloaded: the Lens (features/lens/one.ts) only draws what is decided here, and the brain
 * bundle tests it in Node (apps/edge/test/lens-one.test.mjs).
 *
 *   languageOf()     the language of some words from a small table of each language's commonest words (English, French, German,
 *                    Spanish, Italian, Portuguese, Dutch), or UNKNOWN; decided on the phone, nothing sent to say it
 *   colourName()     one of twelve colour words for a pixel; dominantColour() the word for most of a picture's pixels
 *   textKind()       a LETTER (a page of print) or a SIGN (a few words)
 *   lookingWords()   what the stamp line says: LOOKING AT A LETTER / A SIGN / TWO PEOPLE / A MUG / NOTHING YET
 *   truthParts()     the one line: what it is · one fact · the one act in his colour
 *   linkWord()       the one word that tells him what a link leads to
 *   firstSentence()  where the first sentence of a read text ends (it is lit in his colour)
 */
import { ENGLISH, looksEnglish, type TagKind } from './tags';

// ---------------------------------------------------------------- the language of some words

export type LangId = 'en' | 'fr' | 'de' | 'es' | 'it' | 'pt' | 'nl';
export interface Lang {
  /** 'unknown' when no language fits. */
  id: LangId | 'unknown';
  /** In capitals, as the tag says it ("FRENCH"); "UNKNOWN" when none fits. */
  name: string;
  /** A BCP 47 tag for the phone's voice; '' for UNKNOWN. */
  tag: string;
}

/**
 * The commonest words of each language, with the words of signs and packets, written without accents (the reader may drop them,
 * and the text is stripped of them before it is looked up). A word that two languages share is left out of both where it is the
 * other's commoner word ("de", "a", "la", "en", "no"): the table says the language only when its own words are most of the text.
 */
const TABLE: Record<Exclude<LangId, 'en'>, string> = {
  fr: 'le les des du est sont une un et ou pour dans sur avec sans par pas plus que qui ce cette ces au aux il elle nous vous ils je tu mon ma mes ton son sa ses notre votre leur nos vos leurs ne ni mais donc car si comme tres bien tout tous toute fait etre avoir sortie secours entree ouvert ferme defense interdit danger attention bienvenue merci bonjour rue boulangerie pharmacie fumer poussez tirez lundi mardi mercredi jeudi vendredi samedi dimanche',
  de: 'der die das den dem des ein eine einen einem und oder ist sind war nicht mit von zu fur auf im am um bei nach aus ich du er sie es wir ihr wird werden hat haben auch noch nur wie was wenn aber dann diese dieser dieses mein dein sein unser kein ausgang notausgang eingang offen geschlossen verboten achtung gefahr willkommen danke guten morgen strasse bitte montag dienstag mittwoch donnerstag freitag samstag sonntag',
  es: 'el los las una unos unas y o es son esta este estos estas con sin por para del al se su sus mi mis tu tus nuestro vuestro que como pero mas muy todo todos toda hay ser estar tener salida entrada abierto cerrado prohibido peligro emergencia atencion bienvenido gracias hola buenos dias calle cuidado empujar tirar lunes martes miercoles jueves viernes sabado domingo',
  it: 'il lo gli le uno una un e o che di del della dei delle degli per con su sono siamo questo questa questi queste nel nella nei nelle al alla ai alle io tu lui lei noi voi loro mio tuo suo nostro ma anche come non piu molto tutto tutti tutte uscita ingresso aperto chiuso vietato pericolo attenzione benvenuto grazie ciao buongiorno via spingere tirare lunedi martedi mercoledi giovedi venerdi sabato domenica',
  pt: 'o os as um uma uns umas e ou que de do da dos das em no na nos nas para por com sem se seu sua seus suas meu minha teu tua nosso nossa mas mais muito tudo todos todas esta este estes estas isso isto ser estar ter saida entrada aberto fechado proibido perigo emergencia atencao bem vindo obrigado obrigada ola bom dia rua cuidado empurre puxe segunda terca quarta quinta sexta sabado domingo nao sao voce',
  nl: 'de het een en of is zijn was niet met van voor op in aan om bij naar uit ik jij hij zij wij jullie ze wordt worden heeft hebben ook nog maar als dan deze dit die dat mijn jouw zijn ons uw geen uitgang nooduitgang ingang open gesloten verboden let op gevaar welkom dank goedemorgen straat alstublieft maandag dinsdag woensdag donderdag vrijdag zaterdag zondag',
};
const SETS = Object.fromEntries(Object.entries(TABLE).map(([k, v]) => [k, new Set(v.split(' '))])) as Record<Exclude<LangId, 'en'>, Set<string>>;
/** Words that only a language's own text has (a word several share does not count towards telling them apart). */
const OWN = (() => {
  const count = new Map<string, number>();
  for (const s of Object.values(SETS)) for (const w of s) count.set(w, (count.get(w) ?? 0) + 1);
  return Object.fromEntries(Object.entries(SETS).map(([k, s]) => [k, new Set([...s].filter((w) => count.get(w) === 1))])) as Record<Exclude<LangId, 'en'>, Set<string>>;
})();
/** English signs and notices the common-word list of looksEnglish misses. */
const ENGLISH_SIGNS = new Set('exit emergency entrance open closed push pull danger warning stop welcome toilets toilet keep out no entry way in please wait here ring bell fire door staff only private parking sale'.split(' '));

const NAMES: Record<LangId, { name: string; tag: string }> = {
  en: { name: 'ENGLISH', tag: 'en-GB' },
  fr: { name: 'FRENCH', tag: 'fr-FR' },
  de: { name: 'GERMAN', tag: 'de-DE' },
  es: { name: 'SPANISH', tag: 'es-ES' },
  it: { name: 'ITALIAN', tag: 'it-IT' },
  pt: { name: 'PORTUGUESE', tag: 'pt-PT' },
  nl: { name: 'DUTCH', tag: 'nl-NL' },
};
const lang = (id: LangId): Lang => ({ id, ...NAMES[id] });
export const UNKNOWN_LANG: Lang = { id: 'unknown', name: 'UNKNOWN', tag: '' };

/** Words of a text, lower case, accents taken off, apostrophes kept inside the word and cut at the first ("l'entree" → "l", "entree"). */
function wordsOf(text: string): string[] {
  const t = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ß/g, 'ss');
  return t.match(/[a-z]+/g) ?? [];
}

/**
 * The language of some words, or UNKNOWN. A language is named only when its own words are a fair share of the text (a quarter or
 * more, and at least two of them in a text of four words or more; one is enough in a sign of up to three) and clearly more than
 * any other's; English is the language of a text its common words, or the words of its signs, make most of. Nonsense, a name or a
 * number is UNKNOWN: nothing is guessed, and nothing is sent to find out.
 */
export function languageOf(text: string): Lang {
  const w = wordsOf(String(text ?? ''));
  if (!w.length) return UNKNOWN_LANG;
  const scores = (Object.keys(SETS) as Exclude<LangId, 'en'>[]).map((id) => {
    const hits = w.filter((x) => SETS[id].has(x)).length;
    const own = w.filter((x) => OWN[id].has(x)).length;
    return { id, hits, own };
  });
  // English counts the same way: the common words, and the words of signs
  const enHits = w.filter((x) => ENGLISH_SIGNS.has(x) || (x.length > 1 && ENGLISH.has(x))).length;
  const best = [...scores].sort((a, b) => b.hits - a.hits || b.own - a.own)[0]!;
  const enShare = enHits / w.length;
  const share = best.hits / w.length;
  const need = w.length <= 3 ? 1 : 2;
  if (enHits >= need && enShare >= 0.25 && enHits >= best.hits) return lang('en');
  if (best.hits >= need && share >= (w.length <= 3 ? 0.34 : 0.25) && best.own >= 1) {
    const rival = scores.filter((s) => s.id !== best.id).sort((a, b) => b.hits - a.hits)[0]!;
    if (best.hits > rival.hits || (best.hits === rival.hits && best.own > rival.own)) return lang(best.id);
  }
  // a longer text with the common English words in it, and no other language's, is English
  if (w.length >= 3 && looksEnglish(text) && best.hits === 0 && /[a-z]/i.test(text) && enHits > 0) return lang('en');
  return UNKNOWN_LANG;
}

/** The text is in his language, or too little to say (nothing is translated on a guess): English or UNKNOWN. */
export const needsTranslation = (l: Lang): boolean => l.id !== 'en' && l.id !== 'unknown';

// ---------------------------------------------------------------- a colour's name

export const COLOURS = ['WHITE', 'GREY', 'BLACK', 'RED', 'ORANGE', 'YELLOW', 'GREEN', 'BLUE', 'PURPLE', 'PINK', 'BROWN', 'BEIGE'] as const;
export type ColourName = (typeof COLOURS)[number];

/** One of twelve words for a colour (0–255 each), from hue, saturation and brightness. */
export function colourName(r: number, g: number, b: number): ColourName {
  const R = r / 255, G = g / 255, B = b / 255;
  const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
  const v = mx, d = mx - mn, s = mx ? d / mx : 0;
  if (v < 0.2) return 'BLACK';
  if (s < 0.13) return v > 0.78 ? 'WHITE' : v < 0.32 ? 'BLACK' : 'GREY';
  let hue = 0;
  if (d) {
    if (mx === R) hue = ((G - B) / d) % 6;
    else if (mx === G) hue = (B - R) / d + 2;
    else hue = (R - G) / d + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }
  // warm and pale: cream, sand, beige
  if (hue >= 15 && hue < 65 && s < 0.4 && v > 0.62) return 'BEIGE';
  if (hue < 15 || hue >= 345) return s < 0.45 && v > 0.7 ? 'PINK' : v < 0.45 ? 'BROWN' : 'RED';
  if (hue < 40) return v < 0.62 ? 'BROWN' : 'ORANGE';
  if (hue < 70) return v < 0.5 ? 'BROWN' : 'YELLOW';
  if (hue < 165) return 'GREEN';
  if (hue < 255) return 'BLUE';
  if (hue < 300) return 'PURPLE';
  return s < 0.5 && v > 0.7 ? 'PINK' : 'PURPLE';
}

/**
 * The colour word for most of a picture: RGBA pixels, the colour of each sampled pixel named, the commonest name wins. A box
 * (in the picture's pixels) limits it to a thing; its middle three quarters, so the edge of the box (the table, the wall behind)
 * does not vote.
 */
export function dominantColour(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, box?: { x: number; y: number; w: number; h: number }): ColourName | null {
  const b = box ?? { x: 0, y: 0, w, h };
  const x0 = Math.max(0, Math.floor(b.x + b.w * 0.125));
  const y0 = Math.max(0, Math.floor(b.y + b.h * 0.125));
  const x1 = Math.min(w, Math.ceil(b.x + b.w * 0.875));
  const y1 = Math.min(h, Math.ceil(b.y + b.h * 0.875));
  if (x1 <= x0 || y1 <= y0) return null;
  const step = Math.max(1, Math.floor(Math.sqrt(((x1 - x0) * (y1 - y0)) / 400)));
  const votes = new Map<ColourName, number>();
  for (let y = y0; y < y1; y += step) {
    for (let x = x0; x < x1; x += step) {
      const p = (y * w + x) * 4;
      const n = colourName(rgba[p]!, rgba[p + 1]!, rgba[p + 2]!);
      votes.set(n, (votes.get(n) ?? 0) + 1);
    }
  }
  let best: ColourName | null = null;
  let top = 0;
  for (const [n, c] of votes) if (c > top) (top = c), (best = n);
  return best;
}

// ---------------------------------------------------------------- words on a thing

/** The words of a read text, as the plate and the count see them (anything with a letter or a digit in it). */
export function wordList(text: string): string[] {
  return (text.match(/\S+/g) ?? []).filter((x) => /[\p{L}\p{N}]/u.test(x));
}

/** At least this many words and it is a letter (a page of print); fewer and it is a sign. */
export const LETTER_WORDS = 12;
export const textKind = (words: number): 'letter' | 'sign' => (words >= LETTER_WORDS ? 'letter' : 'sign');

/** How many of the words (from the first) make the first sentence: up to the first full stop, question or exclamation mark; else the first line. */
export function firstSentence(text: string): number {
  const ws = text.match(/\S+/g) ?? [];
  for (let i = 0; i < ws.length; i++) if (/[.!?]["'”’)]*$/.test(ws[i]!) && /[\p{L}\p{N}]/u.test(ws[i]!) && !/^(?:mr|mrs|ms|dr|st|no)\.$/i.test(ws[i]!)) return i + 1;
  const line = (text.split('\n').find((l) => l.trim()) ?? '').match(/\S+/g) ?? [];
  return Math.max(1, Math.min(ws.length, line.length || Math.min(6, ws.length)));
}

/** The one word that tells him what a link leads to: the last word of its path ("/menu" → "MENU"), else its host ("EXAMPLE.COM"). */
export function linkWord(href: string, host = ''): string {
  let h = host;
  try {
    const u = new URL(href);
    h = h || u.hostname;
    const seg = u.pathname.split('/').filter(Boolean).pop() ?? '';
    const w = decodeURIComponent(seg).replace(/\.[a-z0-9]{2,5}$/i, '').split(/[-_+\s]+/).filter((x) => /^\p{L}{2,}$/u.test(x)).slice(0, 2).join(' ');
    if (w) return w.toUpperCase();
  } catch {
    /* a host or nothing */
  }
  return h.replace(/^www\./, '').toUpperCase();
}

// ---------------------------------------------------------------- what the Lens says it knows

/** What the Lens sees, one entry for each thing on screen, as the words need them (never who: a known face has no name here). */
export interface Known {
  kind: 'text' | 'code' | 'face' | 'stranger' | 'object';
  /** For text: how many words (0 until it has been read), and the language once decided. */
  words?: number;
  lang?: Lang;
  translated?: boolean;
  /** The words are on their way to be translated. */
  translating?: boolean;
  /** Text that was read but cannot be translated (offline, or the brain failed). */
  untranslated?: boolean;
  /** Text still being read. */
  reading?: boolean;
  /** For a code: its kind (SCAN's) and the word it leads to. */
  codeKind?: string;
  linkWord?: string;
  /** For a thing: what it is (the namer's or the finder's word, '' when neither knows), and its colour. */
  label?: string;
  named?: boolean;
  colour?: string;
  /** For a face he knows: the name he gave (kept on the phone). */
  name?: string;
  /** How far its middle is from the middle of the picture (0 near … 1 far): the act that ends the line is the nearest one's. */
  away: number;
}

const NUMBER_WORDS = ['NO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);
const article = (w: string): string => (/^[AEIOU]/i.test(w) ? 'AN' : 'A');

export const STRANGER_WORDS = 'SOMEONE I DON’T KNOW';

/** What a code is called in a tag and in its act. */
const CODE_NAME: Record<string, string> = { url: 'A LINK', wifi: 'WI-FI', contact: 'A CONTACT', product: 'A PRODUCT CODE', isbn: 'A BOOK’S CODE', geo: 'A PLACE', email: 'AN EMAIL ADDRESS', phone: 'A PHONE NUMBER', sms: 'A TEXT MESSAGE', text: 'A CODE' };
const CODE_ACT: Record<string, string> = { url: 'TAP IT', wifi: 'TAP TO JOIN', contact: 'TAP TO SAVE', product: 'TAP IT', isbn: 'TAP IT', geo: 'TAP IT', email: 'TAP IT', phone: 'TAP IT', sms: 'TAP IT', text: 'TAP IT' };
export const codeName = (kind?: string): string => CODE_NAME[kind ?? ''] ?? 'A CODE';

/** The plate above a thing (the mock's form): `A LETTER · 61 WORDS`, `A SIGN · FRENCH`, `MUM`, `SOMEONE I DON’T KNOW`, `A LINK · MENU`, `A MUG`. */
export function plateWords(k: Known): string {
  switch (k.kind) {
    case 'face':
      return k.name || STRANGER_WORDS;
    case 'stranger':
      return STRANGER_WORDS;
    case 'code':
      return [codeName(k.codeKind), k.linkWord].filter(Boolean).join(' · ');
    case 'text': {
      if (k.reading || !k.words) return k.reading ? 'TEXT · READING' : 'TEXT';
      const kind = textKind(k.words);
      const l = k.lang && k.lang.id !== 'unknown' && k.lang.id !== 'en' ? k.lang.name : '';
      return kind === 'letter' ? `A LETTER · ${k.words} ${k.words === 1 ? 'WORD' : 'WORDS'}${l ? ` · ${l}` : ''}` : `A SIGN${l ? ` · ${l}` : ''}`;
    }
    default: {
      if (k.named && k.label) return `${article(k.label)} ${k.label.toUpperCase()}`;
      return ['SOMETHING HERE', k.label?.toUpperCase()].filter(Boolean).join(' · ');
    }
  }
}

/** What one thing is in a word or two on the truth line ("A LETTER", "MUM", "A MUG"): a code's own line is its act. */
function shortName(k: Known): string {
  switch (k.kind) {
    case 'face':
      return k.name || STRANGER_WORDS;
    case 'stranger':
      return STRANGER_WORDS;
    case 'code':
      return '';
    case 'text':
      return k.reading || !k.words ? 'TEXT' : textKind(k.words) === 'letter' ? 'A LETTER' : 'A SIGN';
    default:
      return k.named && k.label ? `${article(k.label)} ${k.label.toUpperCase()}` : 'SOMETHING HERE';
  }
}

/** The act of one thing, in his colour (a face has none). */
export function actWords(k: Known): string {
  switch (k.kind) {
    case 'code':
      return `${codeName(k.codeKind)}: ${CODE_ACT[k.codeKind ?? ''] ?? 'TAP IT'}`;
    case 'text':
      if (k.reading || !k.words) return '';
      if (k.untranslated) return '';
      return k.translated ? 'TAP TO HEAR IT' : textKind(k.words) === 'letter' ? 'TAP A WORD TO HEAR IT' : 'TAP TO HEAR IT';
    case 'object':
      return 'TAP TO ASK ABOUT IT';
    default:
      return '';
  }
}

/** The one fact of a thing (a text's language and what was done with it, a thing's colour, a link's word). */
function factWords(k: Known): string[] {
  switch (k.kind) {
    case 'text': {
      if (k.reading || !k.words) return k.reading ? ['READING…'] : [];
      const name = k.lang?.name ?? 'UNKNOWN';
      if (k.untranslated) return [name, 'I CAN’T TRANSLATE OFFLINE'];
      if (k.translating) return [name, 'TRANSLATING…'];
      if (k.translated) return [name, 'TRANSLATED'];
      return [name === 'UNKNOWN' ? 'LANGUAGE UNKNOWN' : name];
    }
    case 'code':
      return k.linkWord ? [k.linkWord] : [];
    case 'object':
      return k.colour ? [k.colour] : [];
    default:
      return [];
  }
}

const ORDER: Known['kind'][] = ['face', 'stranger', 'code', 'text', 'object'];
const rank = (k: Known): number => ORDER.indexOf(k.kind);

/** The things in the mock's order: the people, then the code, then the text, then the things. */
export const inOrder = (list: Known[]): Known[] => [...list].sort((a, b) => rank(a) - rank(b) || a.away - b.away);

/**
 * What the stamp line says it is looking at (a part of its one sentence, "LOOKING AT …"): the first group in the mock's order,
 * named by its kind and never by who (this goes to the brain as the screen's own short words, and a known name never does).
 */
export function lookingWords(list: Known[]): string {
  if (!list.length) return 'nothing yet';
  const o = inOrder(list);
  const people = o.filter((k) => k.kind === 'face' || k.kind === 'stranger').length;
  if (people) return people === 1 ? 'a person' : `${numberWord(people).toLowerCase()} people`;
  const first = o[0]!;
  if (first.kind === 'code') return first.codeKind === 'url' ? 'a link' : codeName(first.codeKind).toLowerCase();
  if (first.kind === 'text') return first.reading || !first.words ? 'some text' : textKind(first.words) === 'letter' ? 'a letter' : 'a sign';
  return first.named && first.label ? `${article(first.label).toLowerCase()} ${first.label.toLowerCase()}` : 'something';
}

/**
 * The one line under the viewfinder: what it is · one fact · the one act (the last part, in his colour). With one thing: its
 * name, its fact, its act. With several: their names in the mock's order (a code's name is part of its act) and the act of the
 * one nearest the middle at the end. Nothing in view: `NOTHING YET`.
 */
export function truthParts(list: Known[]): ({ text: string; tone: 'on' } | string)[] {
  if (!list.length) return ['NOTHING YET · POINT ME AT SOMETHING'];
  const o = inOrder(list);
  const nearest = [...o].filter((k) => actWords(k)).sort((a, b) => a.away - b.away)[0];
  const act = nearest ? actWords(nearest) : '';
  const parts: string[] = [];
  if (o.length === 1) {
    const only = o[0]!;
    const n = shortName(only);
    if (n) parts.push(n);
    parts.push(...factWords(only));
  } else {
    for (const k of o) {
      const n = shortName(k);
      if (n) parts.push(n);
    }
  }
  return [...parts, ...(act ? [{ text: act, tone: 'on' as const }] : [])];
}

/** The honest line when nothing is tagged and the eyes are not on the phone (the key itself is this line). */
export const EYES_LINE = 'I CAN SEE TEXT, CODES AND THE PEOPLE I KNOW · GET THE EYES';
export const eyesLine = (size: string): string => `${EYES_LINE} (${size}, ON WI-FI)`;

/** Which kinds a stamp or a line counts as a person. */
export const isPerson = (k: TagKind): boolean => k === 'face' || k === 'stranger';
