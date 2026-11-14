/**
 * TRANSLATE (THE APPS ROUND, the voice lane's flagship): the parts of the app that need no screen. What a script is, letters changed
 * between scripts, the history he keeps on this phone, the phrasebook he stars into (sorted by trip), and the countries a trip can
 * be to. Nothing here goes anywhere: the screen (apps/web/src/features/translate) keeps it all in this phone's storage.
 */

export type Script = 'latin' | 'cyrillic' | 'greek' | 'arabic' | 'devanagari' | 'other';

/** The script most of the letters are in ('other' for scripts with no letter table here, or none at all). */
export function scriptOf(text: string): Script {
  const n = (re: RegExp) => (text.match(re) ?? []).length;
  const counts: [Script, number][] = [
    ['latin', n(/[A-Za-zÀ-ɏ]/g)],
    ['cyrillic', n(/[Ѐ-ӿ]/g)],
    ['greek', n(/[Ͱ-Ͽ]/g)],
    ['arabic', n(/[؀-ۿ]/g)],
    ['devanagari', n(/[ऀ-ॿ]/g)],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  const [top] = counts;
  if (top![1] > 0) return top![0];
  return /\p{L}/u.test(text) ? 'other' : 'latin';
}

const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ґ: 'g', д: 'd', е: 'e', ё: 'yo', є: 'ye', ж: 'zh', з: 'z', и: 'i', і: 'i', ї: 'yi', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'shch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};
const GREEK: Record<string, string> = {
  α: 'a', ά: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'e', ζ: 'z', η: 'i', ή: 'i', θ: 'th', ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', ό: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'y', ϋ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'o',
};
/** Arabic and Urdu letters, as English speakers usually write them (the short vowels are not written, so none are added). */
const ARABIC: Record<string, string> = {
  ا: 'a', آ: 'aa', أ: 'a', إ: 'i', ب: 'b', پ: 'p', ت: 't', ٹ: 't', ث: 's', ج: 'j', چ: 'ch', ح: 'h', خ: 'kh', د: 'd', ڈ: 'd', ذ: 'z', ر: 'r', ڑ: 'r', ز: 'z', ژ: 'zh', س: 's', ش: 'sh', ص: 's', ض: 'z', ط: 't', ظ: 'z', ع: "'", غ: 'gh', ف: 'f', ق: 'q', ک: 'k', ك: 'k', گ: 'g', ل: 'l', م: 'm', ن: 'n', ں: 'n', و: 'o', ہ: 'h', ه: 'h', ھ: 'h', ة: 'a', ء: "'", ی: 'i', ي: 'i', ى: 'a', ے: 'e', ئ: 'i', ؤ: 'o', '،': ',', '؟': '?', '۔': '.',
};
const DEV_CONS: Record<string, string> = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'n', च: 'ch', छ: 'chh', ज: 'j', झ: 'jh', ञ: 'n', ट: 't', ठ: 'th', ड: 'd', ढ: 'dh', ण: 'n', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n', प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', व: 'v', श: 'sh', ष: 'sh', स: 's', ह: 'h', क़: 'q', ख़: 'kh', ग़: 'gh', ज़: 'z', ड़: 'r', ढ़: 'rh', फ़: 'f',
};
const DEV_VOWEL: Record<string, string> = { अ: 'a', आ: 'aa', इ: 'i', ई: 'ee', उ: 'u', ऊ: 'oo', ऋ: 'ri', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au' };
const DEV_SIGN: Record<string, string> = { 'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au' };
const DEV_MARK: Record<string, string> = { 'ं': 'n', 'ँ': 'n', 'ः': 'h', '।': '.', '॥': '.' };

/** Keep a capital where the letter had one. */
const cased = (from: string, to: string) => (to && from !== from.toLowerCase() ? to[0]!.toUpperCase() + to.slice(1) : to);

function byTable(text: string, table: Record<string, string>): string {
  let out = '';
  for (const ch of text) {
    const low = ch.toLowerCase();
    out += low in table ? cased(ch, table[low]!) : ch;
  }
  return out;
}

/** Devanagari: each consonant carries an "a" unless a vowel sign or the virama follows it, and a word's last "a" is dropped (Hindi). */
function devanagari(text: string): string {
  const chars = [...text.normalize('NFC')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]!;
    const next = chars[i + 1] ?? '';
    if (c in DEV_CONS) {
      out += DEV_CONS[c];
      if (next === '्') i++;
      else if (next in DEV_SIGN) {
        out += DEV_SIGN[next];
        i++;
      } else {
        const wordEnds = !next || !/[ऀ-ॿ]/.test(next) || next in DEV_MARK;
        if (!wordEnds) out += 'a';
      }
    } else if (c in DEV_VOWEL) out += DEV_VOWEL[c];
    else if (c in DEV_SIGN) out += DEV_SIGN[c];
    else if (c in DEV_MARK) out += DEV_MARK[c];
    else if (c === '़' || c === '्') continue;
    else out += c;
  }
  return out;
}

/** Latin letters into Cyrillic (Russian's usual way), the longest spelling first. */
const LATIN_TO_CYR: [string, string][] = [
  ['shch', 'щ'], ['yo', 'ё'], ['zh', 'ж'], ['kh', 'х'], ['ts', 'ц'], ['ch', 'ч'], ['sh', 'ш'], ['yu', 'ю'], ['ya', 'я'], ['ye', 'е'],
  ['a', 'а'], ['b', 'б'], ['v', 'в'], ['g', 'г'], ['d', 'д'], ['e', 'е'], ['z', 'з'], ['i', 'и'], ['y', 'й'], ['k', 'к'], ['l', 'л'], ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['r', 'р'], ['s', 'с'], ['t', 'т'], ['u', 'у'], ['f', 'ф'], ['h', 'х'], ['c', 'к'], ['w', 'в'], ['x', 'кс'], ['j', 'дж'], ['q', 'к'],
];
function toCyrillic(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; ) {
    const rest = text.slice(i).toLowerCase();
    const hit = LATIN_TO_CYR.find(([l]) => rest.startsWith(l));
    if (!hit) {
      out += text[i];
      i++;
      continue;
    }
    const src = text.slice(i, i + hit[0].length);
    out += src[0] !== src[0]!.toLowerCase() ? hit[1].toUpperCase() : hit[1];
    i += hit[0].length;
  }
  return out;
}

/** The scripts letters can be changed into here, for a text in `from`. */
export function scriptsFor(from: Script): Script[] {
  if (from === 'latin') return ['cyrillic'];
  if (from === 'cyrillic' || from === 'greek' || from === 'arabic' || from === 'devanagari') return ['latin'];
  return [];
}

/** Plain names for the scripts, as the key under a translation says them. */
export const SCRIPT_NAME: Record<Script, string> = { latin: 'English letters', cyrillic: 'Cyrillic', greek: 'Greek', arabic: 'Arabic script', devanagari: 'Devanagari', other: 'its own script' };

/** `text` in another script: '' when there is no letter table for that change (the key is not offered then). */
export function transliterate(text: string, to: Script): string {
  const from = scriptOf(text);
  if (from === to) return text;
  if (to === 'latin') {
    if (from === 'cyrillic') return byTable(text, CYRILLIC);
    if (from === 'greek') return byTable(text, GREEK);
    if (from === 'arabic') return byTable(text, ARABIC).replace(/\s+/g, ' ');
    if (from === 'devanagari') return devanagari(text);
    return '';
  }
  if (to === 'cyrillic' && from === 'latin') return toCyrillic(text);
  return '';
}

// ---------------------------------------------------------------- history and the phrasebook, kept on this phone

export interface Done {
  id: string;
  said: string;
  came: string;
  from: string;
  to: string;
  at: number;
  style?: 'formal' | 'casual' | '';
}
export interface Starred extends Done {
  /** The trip it is kept under ("Spain in May"); his own words, or the country he picked. */
  trip: string;
}

export const HISTORY_MAX = 100;
export const HISTORY_KEY = 'ghosty.translate.history';
export const BOOK_KEY = 'ghosty.translate.book';
export const TRIP_KEY = 'ghosty.translate.trip';
export const BIN_KEY = 'ghosty.translate.bin';
export const NO_TRIP = 'Any trip';

const same = (a: Done, b: Pick<Done, 'said' | 'to'>) => a.said.trim().toLowerCase() === b.said.trim().toLowerCase() && a.to === b.to;

/** A translation added to the top of the history: the same words into the same language move up rather than twice. */
export const withDone = (list: Done[], d: Done): Done[] => [d, ...list.filter((x) => !same(x, d))].slice(0, HISTORY_MAX);

/** The history that matches his search, in what was said or what it came to. */
export function searchDone<T extends Done>(list: T[], q: string): T[] {
  const s = q.trim().toLowerCase();
  if (!s) return list;
  return list.filter((d) => d.said.toLowerCase().includes(s) || d.came.toLowerCase().includes(s));
}

/** Is this one starred (the same words into the same language)? */
export const isStarred = (book: Starred[], d: Pick<Done, 'said' | 'to'>): boolean => book.some((x) => same(x, d));

/** Star or unstar: starring keeps it under the trip now. */
export const toggleStar = (book: Starred[], d: Done, trip: string): Starred[] => (isStarred(book, d) ? book.filter((x) => !same(x, d)) : [{ ...d, trip: trip.trim() || NO_TRIP }, ...book]);

/** The phrasebook by trip: the trip now first, then the others by their newest phrase. */
export function byTrip(book: Starred[], now = ''): { trip: string; phrases: Starred[] }[] {
  const groups = new Map<string, Starred[]>();
  for (const p of book) groups.set(p.trip, [...(groups.get(p.trip) ?? []), p]);
  return [...groups.entries()]
    .map(([trip, phrases]) => ({ trip, phrases: phrases.sort((a, b) => b.at - a.at) }))
    .sort((a, b) => (a.trip === now ? -1 : b.trip === now ? 1 : (b.phrases[0]?.at ?? 0) - (a.phrases[0]?.at ?? 0)));
}

/** Read a kept list, keeping only well-formed entries (storage can hold anything). */
export function readList<T extends Done>(raw: string | null): T[] {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((d): d is T => !!d && typeof d === 'object' && typeof (d as Done).said === 'string' && typeof (d as Done).came === 'string' && typeof (d as Done).to === 'string');
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------- trips: a country and its language

/** Countries a trip can be to, with the language a phrasebook for it is in. */
export const COUNTRIES: readonly { name: string; lang: string }[] = [
  { name: 'Spain', lang: 'es' },
  { name: 'France', lang: 'fr' },
  { name: 'Germany', lang: 'de' },
  { name: 'Italy', lang: 'it' },
  { name: 'Portugal', lang: 'pt' },
  { name: 'Greece', lang: 'el' },
  { name: 'Turkey', lang: 'tr' },
  { name: 'Netherlands', lang: 'nl' },
  { name: 'Poland', lang: 'pl' },
  { name: 'Pakistan', lang: 'ur' },
  { name: 'India', lang: 'hi' },
  { name: 'Japan', lang: 'ja' },
  { name: 'China', lang: 'zh' },
  { name: 'Korea', lang: 'ko' },
  { name: 'Thailand', lang: 'th' },
  { name: 'Vietnam', lang: 'vi' },
];

/** A trip's phrasebook: the lines a traveller needs first, in English, translated into the country's language when he opens it. */
export const TRIP_PHRASES: readonly { group: string; lines: readonly string[] }[] = [
  { group: 'Basics', lines: ['Hello.', 'Thank you.', 'Please.', 'Yes.', 'No.', 'Excuse me.', 'Sorry, I don’t understand.', 'Do you speak English?'] },
  { group: 'Getting around', lines: ['Where is the station?', 'How do I get to this address?', 'A ticket to the centre, please.', 'Where is the toilet?'] },
  { group: 'Eating', lines: ['A table for two, please.', 'The menu, please.', 'I am allergic to nuts.', 'The bill, please.'] },
  { group: 'Shopping', lines: ['How much is it?', 'Can I pay by card?', 'Just looking, thank you.'] },
  { group: 'Help', lines: ['Help!', 'I need a doctor.', 'Call an ambulance.', 'I have lost my passport.'] },
];

/** The phrasebook as a CSV file (trip, what he said, what it came to, the language), for the Share sheet or Files. */
export function bookCsv(book: Starred[], langName: (code: string) => string = (c) => c): string {
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = byTrip(book).flatMap((g) => g.phrases.map((p) => [g.trip, p.said, p.came, langName(p.to)]));
  return [['Trip', 'You said', 'Translation', 'Language'], ...rows].map((r) => r.map(cell).join(',')).join('\n');
}
