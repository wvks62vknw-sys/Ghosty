/**
 * TRANSLITERATION (BRIEF-REST-E part 2): letters, not meaning — a script's letters in Latin ones by a table, and back
 * where the table is one-to-one. The sounds in Latin letters, not a translation. Pure; the round trips are tested.
 *
 *  - Cyrillic: ISO 9 (one Latin letter, with its mark, for each Cyrillic one: Russian, Ukrainian, Belarusian, Serbian,
 *    Macedonian, Bulgarian), both ways.
 *  - Greek: a letter for a letter (θ th, χ ch, ψ ps, η ī, ω ō, accents kept), both ways; σ at a word's end comes back ς.
 *  - Armenian: ISO 9985, both ways. Georgian: ISO 9984, both ways.
 *  - Devanagari (Hindi, Marathi, Nepali): ISO 15919, the vowel each consonant carries written as "a", both ways.
 *  - Arabic, and Urdu or Persian: a letter for each letter (the scholars' marks: ṯ ḥ ḫ ḏ š ṣ ḍ ṭ ẓ ʿ ġ), both ways. The
 *    short vowels the script leaves unwritten are not added: "ktb", not "kataba", unless the text marks them.
 *  - Hebrew: to Latin only (its final letters and the letters a dot changes do not come back one to one).
 */

export interface Script {
  id: 'cyrillic' | 'greek' | 'armenian' | 'georgian' | 'devanagari' | 'arabic' | 'urdu' | 'hebrew';
  name: string;
  /** Whether Latin goes back to this script by the same table. */
  back: boolean;
  /** Its letters, to recognise it. */
  range: RegExp;
}

export const SCRIPTS: Script[] = [
  { id: 'urdu', name: 'Urdu or Persian', back: true, range: /[ٹڈڑںھہےپچژگکی]/ },
  { id: 'arabic', name: 'Arabic', back: true, range: /[؀-ۿ]/ },
  { id: 'cyrillic', name: 'Cyrillic (Russian, Ukrainian)', back: true, range: /[Ѐ-ӿ]/ },
  { id: 'greek', name: 'Greek', back: true, range: /[Ͱ-Ͽἀ-῿]/ },
  { id: 'devanagari', name: 'Devanagari (Hindi)', back: true, range: /[ऀ-ॿ]/ },
  { id: 'hebrew', name: 'Hebrew', back: false, range: /[֐-׿]/ },
  { id: 'armenian', name: 'Armenian', back: true, range: /[԰-֏]/ },
  { id: 'georgian', name: 'Georgian', back: true, range: /[Ⴀ-ჿ]/ },
];
export const THE_LINE = 'The sounds in Latin letters, not a translation.';

const pairs = (s: string): [string, string][] => s.trim().split(/\s+/).map((p) => p.split('=') as [string, string]).map(([a, b]) => [a!.normalize('NFC'), (b ?? '').normalize('NFC')]);
/** Each lower-case pair, and its capital (for the scripts with capitals). */
const cased = (ps: [string, string][]): [string, string][] => [...ps, ...ps.map(([n, l]): [string, string] => [n.toUpperCase(), l.charAt(0).toUpperCase() + l.slice(1)]).filter(([n, l], i) => n !== ps[i]![0] && l !== ps[i]![1])];

const TABLES: Record<Exclude<Script['id'], 'devanagari'>, [string, string][]> = {
  cyrillic: cased(pairs('а=a б=b в=v г=g д=d е=e ё=ë ж=ž з=z и=i й=j к=k л=l м=m н=n о=o п=p р=r с=s т=t у=u ф=f х=h ц=c ч=č ш=š щ=ŝ ъ=ʺ ы=y ь=ʹ э=è ю=û я=â ґ=g̀ є=ê і=ì ї=ï ў=ŭ ђ=đ ј=ǰ љ=l̂ њ=n̂ ћ=ć џ=d̂ ѓ=ǵ ќ=ḱ ѕ=ẑ')),
  greek: cased(pairs('α=a β=v γ=g δ=d ε=e ζ=z η=ī θ=th ι=i κ=k λ=l μ=m ν=n ξ=x ο=o π=p ρ=r σ=s τ=t υ=y φ=f χ=ch ψ=ps ω=ō ά=á έ=é ή=ī́ ί=í ό=ó ύ=ý ώ=ṓ ϊ=ï ϋ=ÿ ΐ=ḯ ΰ=ÿ́')).concat([['ς', 's'], [';', ';']]),
  armenian: cased(pairs('ա=a բ=b գ=g դ=d ե=e զ=z է=ē ը=ë թ=tʻ ժ=ž ի=i լ=l խ=x ծ=c կ=k հ=h ձ=j ղ=ł ճ=č մ=m յ=y ն=n շ=š ո=o չ=čʻ պ=p ջ=ǰ ռ=ṙ ս=s վ=v տ=t ր=r ց=cʻ ւ=w փ=pʻ ք=kʻ օ=ō ֆ=f')),
  georgian: pairs('ა=a ბ=b გ=g დ=d ე=e ვ=v ზ=z თ=t’ ი=i კ=k ლ=l მ=m ნ=n ო=o პ=p ჟ=ž რ=r ს=s ტ=t უ=u ფ=p’ ქ=k’ ღ=ḡ ყ=q შ=š ჩ=č’ ც=c’ ძ=j წ=c ჭ=č ხ=x ჯ=ǰ ჰ=h'),
  arabic: pairs('ا=ā ب=b ت=t ث=ṯ ج=ǧ ح=ḥ خ=ḫ د=d ذ=ḏ ر=r ز=z س=s ش=š ص=ṣ ض=ḍ ط=ṭ ظ=ẓ ع=ʿ غ=ġ ف=f ق=q ك=k ل=l م=m ن=n ه=h و=w ي=y ء=ʾ أ=ʾa إ=ʾi ؤ=ʾu ئ=ʾy آ=ʾā ة=ẗ ى=ỳ ٱ=ạ َ=a ِ=i ُ=u ً=an ٍ=in ٌ=un ْ=° ّ=² ،=, ؛=; ؟=? ٠=0 ١=1 ٢=2 ٣=3 ٤=4 ٥=5 ٦=6 ٧=7 ٨=8 ٩=9'),
  urdu: pairs('ا=ā ب=b پ=p ت=t ٹ=ṭ ث=s̱ ج=j چ=c ح=ḥ خ=x د=d ڈ=ḍ ذ=ẕ ر=r ڑ=ṛ ز=z ژ=ž س=s ش=š ص=ṣ ض=ż ط=t̤ ظ=z̤ ع=ʿ غ=ġ ف=f ق=q ک=k گ=g ل=l م=m ن=n ں=ṉ و=v ہ=h ھ=ʰ ء=ʾ ی=y ے=e ۃ=ẗ ئ=ʾy آ=ʾā أ=ʾa ؤ=ʾu ه=ẖ ي=ý ك=ḱ َ=a ِ=i ُ=u ْ=° ّ=² ،=, ؛=; ؟=? ۔=. ۰=0 ۱=1 ۲=2 ۳=3 ۴=4 ۵=5 ۶=6 ۷=7 ۸=8 ۹=9'),
  hebrew: pairs('וֹ=ō וּ=ū א=ʾ ב=b ג=g ד=d ה=h ו=v ז=z ח=ḥ ט=ṭ י=y כ=k ך=k ל=l מ=m ם=m נ=n ן=n ס=s ע=ʿ פ=p ף=p צ=ṣ ץ=ṣ ק=q ר=r ש=š ת=t ַ=a ָ=ā ֶ=e ֵ=ē ִ=i ֹ=ō ֻ=u ְ=ə ּ= ׁ= ׂ= ־=-'),
};

/** Greedy longest match, one way of a table. */
function apply(text: string, ps: [string, string][], from: 0 | 1): string {
  const map = new Map(ps.map((p) => [p[from], p[1 - from]!] as [string, string]));
  const longest = Math.max(...ps.map((p) => [...p[from]].length));
  const chars = [...text.normalize('NFC')];
  let out = '';
  for (let i = 0; i < chars.length; ) {
    let hit = false;
    for (let n = Math.min(longest, chars.length - i); n > 0; n--) {
      const piece = chars.slice(i, i + n).join('');
      const v = map.get(piece);
      if (v !== undefined) {
        out += v;
        i += n;
        hit = true;
        break;
      }
    }
    if (!hit) out += chars[i++];
  }
  return out;
}

// ---------------------------------------------------------------- Devanagari (an abugida: each consonant carries "a")
const D_VOWELS = pairs('अ=a आ=ā इ=i ई=ī उ=u ऊ=ū ऋ=r̥ ॠ=r̥̄ ऌ=l̥ ए=ē ऐ=ai ओ=ō औ=au ऍ=ê ऑ=ô');
const D_SIGNS = pairs('ा=ā ि=i ी=ī ु=u ू=ū ृ=r̥ ॄ=r̥̄ ॢ=l̥ े=ē ै=ai ो=ō ौ=au ॅ=ê ॉ=ô');
const D_CONS = pairs('क=k ख=kh ग=g घ=gh ङ=ṅ च=c छ=ch ज=j झ=jh ञ=ñ ट=ṭ ठ=ṭh ड=ḍ ढ=ḍh ण=ṇ त=t थ=th द=d ध=dh न=n प=p फ=ph ब=b भ=bh म=m य=y र=r ल=l ळ=ḷ व=v श=ś ष=ṣ स=s ह=h क़=q ख़=ḵh ग़=ġ ज़=z ड़=ṛ ढ़=ṛh फ़=f य़=ẏ');
const D_MARKS = pairs('ं=ṁ ः=ḥ ँ=m̐ ऽ=’ ।=. ॥=.. ०=0 १=1 २=2 ३=3 ४=4 ५=5 ६=6 ७=7 ८=8 ९=9 ॐ=ōm');
const VIRAMA = '्';
const NUKTA = '़';

function devToLatin(text: string): string {
  const cons = new Map(D_CONS);
  const vowel = new Map(D_VOWELS);
  const sign = new Map(D_SIGNS);
  const mark = new Map(D_MARKS);
  // nukta letters written as letter + dot become the one letter
  const chars = [...text.normalize('NFC')];
  let out = '';
  for (let i = 0; i < chars.length; i++) {
    let c = chars[i]!;
    if (chars[i + 1] === NUKTA && cons.has(c + NUKTA)) c += chars[++i];
    const k = cons.get(c) ?? (c.length === 1 ? cons.get(c.normalize('NFD')) : undefined);
    if (k !== undefined) {
      const next = chars[i + 1] ?? '';
      if (next === VIRAMA) {
        out += k;
        i++;
      } else if (sign.has(next)) {
        out += k + sign.get(next);
        i++;
      } else out += `${k}a`;
    } else out += vowel.get(c) ?? mark.get(c) ?? c;
  }
  return out;
}

function devFromLatin(text: string): string {
  const cons = D_CONS.map(([d, l]) => [l, d] as [string, string]).sort((a, b) => [...b[0]].length - [...a[0]].length);
  const vows = D_VOWELS.map(([d, l]) => [l, d] as [string, string]).sort((a, b) => [...b[0]].length - [...a[0]].length);
  const signOf = new Map(D_SIGNS.map(([d, l]) => [l, d] as [string, string]));
  const marks = D_MARKS.map(([d, l]) => [l, d] as [string, string]).sort((a, b) => [...b[0]].length - [...a[0]].length);
  const s = text.normalize('NFC');
  let out = '';
  let i = 0;
  const match = (list: [string, string][]) => list.find(([l]) => s.startsWith(l, i));
  while (i < s.length) {
    const c0 = match(cons);
    const v0 = match(vows);
    // "r̥" is a vowel, not "r" with a mark: the longer reading wins
    const c = c0 && !(v0 && v0[0].length > c0[0].length) ? c0 : undefined;
    if (c) {
      i += c[0].length;
      out += c[1];
      const v = match(vows);
      if (v) {
        i += v[0].length;
        if (v[0] !== 'a') out += signOf.get(v[0]) ?? '';
      } else out += VIRAMA;
      continue;
    }
    const v = match(vows);
    if (v) {
      out += v[1];
      i += v[0].length;
      continue;
    }
    const m = match(marks);
    if (m) {
      out += m[1];
      i += m[0].length;
      continue;
    }
    out += s[i++];
  }
  return out;
}

/** The script most of the text is written in (null: Latin, or none it knows). */
export function scriptOf(text: string): Script | null {
  let best: Script | null = null;
  let most = 0;
  for (const sc of SCRIPTS) {
    const n = [...text].filter((ch) => sc.range.test(ch)).length;
    if (n > most) {
      most = n;
      best = sc;
    }
  }
  // Urdu's own letters decide between it and Arabic, which share the rest
  if (best?.id === 'arabic' && SCRIPTS[0]!.range.test(text)) best = SCRIPTS[0]!;
  return most ? best : null;
}

/** The text's letters in Latin ones (by its own script when not named). */
export function toLatin(text: string, id: Script['id'] | null = scriptOf(text)?.id ?? null): string {
  if (!id) return text;
  if (id === 'devanagari') return devToLatin(text);
  // the Armenian ligature և is the two letters ե and ւ
  return apply(id === 'armenian' ? text.replace(/և/g, 'եւ') : text, TABLES[id], 0);
}

/** Latin letters in the script's, by the same table (null: the script does not come back one to one). */
export function fromLatin(text: string, id: Script['id']): string | null {
  if (id === 'devanagari') return devFromLatin(text);
  if (id === 'hebrew') return null;
  let out = apply(text, TABLES[id].filter(([n]) => !(id === 'greek' && n === 'ς')), 1);
  if (id === 'greek') out = out.replace(/σ(?=$|[^\p{L}])/gu, 'ς');
  return out;
}
