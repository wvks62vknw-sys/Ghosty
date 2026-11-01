/**
 * THE LEARNING PACK, the pure parts (BRIEF-PACKS-3; OWNER-ISSUES 92 ④): practical skills beside the LEARN tab's courses — never
 * a second tutor. Eight languages (ten words a day, phrases for a situation, a spaced-repetition deck on SM-2), a drawing guide
 * he draws over and an overlap score, a typing test, handwriting read back by the phone's reader, speed reading with three
 * questions made in code, memory drills, mental maths by level, spelling slips from his own messages, the NHS's first-aid
 * steps as a drill, a four-week plan of ten minutes a day, and every skill's streak and best on one sheet. Pure: no storage,
 * no clock, no network. The brain (apps/edge/src/tools/learning.ts) and the phone (features/learning) share it.
 */
import { addDays } from './packs';
import { emptyStreak, freshCard, markDay, rate, streakOf, type Rating, type Sm2State, type Streak } from './sm2';

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
/** Days since 1 January 1970 of a YYYY-MM-DD day. */
export const dayNo = (ymd: string): number => Math.round(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000);
/** A small seeded random number generator (mulberry32): the same seed, the same drill. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!;
const shuffle = <T>(r: () => number, list: readonly T[]): T[] => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
};

// ---------------------------------------------------------------- languages: ten words a day, phrases for a situation

export const LANGS = [
  { id: 'es', name: 'Spanish', voice: 'es-ES' },
  { id: 'fr', name: 'French', voice: 'fr-FR' },
  { id: 'de', name: 'German', voice: 'de-DE' },
  { id: 'it', name: 'Italian', voice: 'it-IT' },
  { id: 'pt', name: 'Portuguese', voice: 'pt-PT' },
  { id: 'pl', name: 'Polish', voice: 'pl-PL' },
  { id: 'ar', name: 'Arabic', voice: 'ar-SA' },
  { id: 'zh', name: 'Mandarin', voice: 'zh-CN' },
] as const;
export type LangId = (typeof LANGS)[number]['id'];
export const langOf = (words: string): (typeof LANGS)[number] | null => {
  const w = words.toLowerCase();
  return LANGS.find((l) => new RegExp(`\\b${l.name.toLowerCase()}\\b`).test(w) || (l.id === 'zh' && /\bchinese\b/.test(w))) ?? null;
};
/** Six days of ten words. */
export const WORD_DAYS = ['greetings and manners', 'numbers one to ten', 'food and drink', 'getting around', 'time and questions', 'people and things'] as const;
const EN = `hello|goodbye|good evening|good night|please|thank you|you're welcome|sorry|yes|no
one|two|three|four|five|six|seven|eight|nine|ten
water|bread|coffee|tea|milk|rice|chicken|cheese|breakfast|the bill
where?|left|right|straight on|near|far|station|ticket|hotel|airport
today|tomorrow|yesterday|now|later|how much?|what?|when?|why?|excuse me
friend|family|house|street|big|small|hot|cold|good|bad`.split(/\n|\|/);
/** The sixty words, in the order of EN; Arabic and Mandarin as “script · how it sounds”. */
const WORDS: Record<LangId, string> = {
  es: 'hola|adiós|buenas tardes|buenas noches|por favor|gracias|de nada|lo siento|sí|no|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|agua|pan|café|té|leche|arroz|pollo|queso|desayuno|la cuenta|¿dónde?|izquierda|derecha|todo recto|cerca|lejos|estación|billete|hotel|aeropuerto|hoy|mañana|ayer|ahora|luego|¿cuánto cuesta?|¿qué?|¿cuándo?|¿por qué?|perdone|amigo|familia|casa|calle|grande|pequeño|caliente|frío|bueno|malo',
  fr: 'bonjour|au revoir|bonsoir|bonne nuit|s’il vous plaît|merci|de rien|désolé|oui|non|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|eau|pain|café|thé|lait|riz|poulet|fromage|petit-déjeuner|l’addition|où ?|gauche|droite|tout droit|près|loin|gare|billet|hôtel|aéroport|aujourd’hui|demain|hier|maintenant|plus tard|combien ?|quoi ?|quand ?|pourquoi ?|excusez-moi|ami|famille|maison|rue|grand|petit|chaud|froid|bon|mauvais',
  de: 'hallo|auf Wiedersehen|guten Abend|gute Nacht|bitte|danke|bitte schön|Entschuldigung|ja|nein|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|Wasser|Brot|Kaffee|Tee|Milch|Reis|Hähnchen|Käse|Frühstück|die Rechnung|wo?|links|rechts|geradeaus|nah|weit|Bahnhof|Fahrkarte|Hotel|Flughafen|heute|morgen|gestern|jetzt|später|wie viel?|was?|wann?|warum?|entschuldigen Sie|Freund|Familie|Haus|Straße|groß|klein|heiß|kalt|gut|schlecht',
  it: 'ciao|arrivederci|buonasera|buonanotte|per favore|grazie|prego|mi dispiace|sì|no|uno|due|tre|quattro|cinque|sei|sette|otto|nove|dieci|acqua|pane|caffè|tè|latte|riso|pollo|formaggio|colazione|il conto|dove?|sinistra|destra|sempre dritto|vicino|lontano|stazione|biglietto|albergo|aeroporto|oggi|domani|ieri|adesso|più tardi|quanto costa?|che cosa?|quando?|perché?|scusi|amico|famiglia|casa|via|grande|piccolo|caldo|freddo|buono|cattivo',
  pt: 'olá|adeus|boa tarde|boa noite|por favor|obrigado / obrigada|de nada|desculpe|sim|não|um|dois|três|quatro|cinco|seis|sete|oito|nove|dez|água|pão|café|chá|leite|arroz|frango|queijo|pequeno-almoço|a conta|onde?|esquerda|direita|sempre em frente|perto|longe|estação|bilhete|hotel|aeroporto|hoje|amanhã|ontem|agora|mais tarde|quanto custa?|o quê?|quando?|porquê?|com licença|amigo|família|casa|rua|grande|pequeno|quente|frio|bom|mau',
  pl: 'cześć|do widzenia|dobry wieczór|dobranoc|proszę|dziękuję|proszę bardzo|przepraszam|tak|nie|jeden|dwa|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć|dziesięć|woda|chleb|kawa|herbata|mleko|ryż|kurczak|ser|śniadanie|rachunek|gdzie?|lewo|prawo|prosto|blisko|daleko|dworzec|bilet|hotel|lotnisko|dzisiaj|jutro|wczoraj|teraz|później|ile to kosztuje?|co?|kiedy?|dlaczego?|przepraszam bardzo|przyjaciel|rodzina|dom|ulica|duży|mały|gorący|zimny|dobry|zły',
  ar: 'مرحبا · marhaban|مع السلامة · maʿa s-salāma|مساء الخير · masāʾ al-khayr|تصبح على خير · tuṣbiḥ ʿalā khayr|من فضلك · min faḍlik|شكرا · shukran|عفوا · ʿafwan|آسف · āsif|نعم · naʿam|لا · lā|واحد · wāḥid|اثنان · ithnān|ثلاثة · thalātha|أربعة · arbaʿa|خمسة · khamsa|ستة · sitta|سبعة · sabʿa|ثمانية · thamāniya|تسعة · tisʿa|عشرة · ʿashara|ماء · māʾ|خبز · khubz|قهوة · qahwa|شاي · shāy|حليب · ḥalīb|أرز · aruzz|دجاج · dajāj|جبن · jubn|فطور · futūr|الحساب · al-ḥisāb|أين · ayna|يسار · yasār|يمين · yamīn|إلى الأمام · ilā l-amām|قريب · qarīb|بعيد · baʿīd|محطة · maḥaṭṭa|تذكرة · tadhkira|فندق · funduq|مطار · maṭār|اليوم · al-yawm|غدا · ghadan|أمس · amsi|الآن · al-ān|لاحقا · lāḥiqan|بكم · bikam|ماذا · mādhā|متى · matā|لماذا · limādhā|لو سمحت · law samaḥt|صديق · ṣadīq|عائلة · ʿāʾila|بيت · bayt|شارع · shāriʿ|كبير · kabīr|صغير · ṣaghīr|ساخن · sākhin|بارد · bārid|جيد · jayyid|سيء · sayyiʾ',
  zh: '你好 · nǐ hǎo|再见 · zàijiàn|晚上好 · wǎnshang hǎo|晚安 · wǎn’ān|请 · qǐng|谢谢 · xièxie|不客气 · bú kèqi|对不起 · duìbuqǐ|是 · shì|不 · bù|一 · yī|二 · èr|三 · sān|四 · sì|五 · wǔ|六 · liù|七 · qī|八 · bā|九 · jiǔ|十 · shí|水 · shuǐ|面包 · miànbāo|咖啡 · kāfēi|茶 · chá|牛奶 · niúnǎi|米饭 · mǐfàn|鸡肉 · jīròu|奶酪 · nǎilào|早餐 · zǎocān|买单 · mǎidān|哪里 · nǎlǐ|左 · zuǒ|右 · yòu|直走 · zhí zǒu|近 · jìn|远 · yuǎn|车站 · chēzhàn|票 · piào|酒店 · jiǔdiàn|机场 · jīchǎng|今天 · jīntiān|明天 · míngtiān|昨天 · zuótiān|现在 · xiànzài|以后 · yǐhòu|多少钱 · duōshao qián|什么 · shénme|什么时候 · shénme shíhou|为什么 · wèishénme|打扰一下 · dǎrǎo yíxià|朋友 · péngyou|家人 · jiārén|房子 · fángzi|街 · jiē|大 · dà|小 · xiǎo|热 · rè|冷 · lěng|好 · hǎo|坏 · huài',
};
export const SITUATIONS = ['cafe', 'directions', 'transport', 'shop', 'help', 'hotel'] as const;
export type Situation = (typeof SITUATIONS)[number];
const EN_PHRASES: Record<Situation, string[]> = {
  cafe: ['A coffee, please.', 'Can I have the bill, please?', 'Do you have vegetarian food?'],
  directions: ['Where is the station?', 'How far is it?', 'Can you show me on the map?'],
  transport: ['One ticket to the centre, please.', 'What time is the next train?', 'Which platform is it?'],
  shop: ['How much is this?', 'Do you take cards?', 'I’m just looking, thank you.'],
  help: ['I need help.', 'I don’t understand.', 'Do you speak English?'],
  hotel: ['I have a reservation.', 'What time is breakfast?', 'Where is the toilet?'],
};
/** A line to open a conversation with, in each language (what `converse` says first). */
export const OPENERS: Record<LangId, string> = {
  es: '¡Hola! ¿Cómo estás hoy?',
  fr: 'Bonjour ! Comment allez-vous aujourd’hui ?',
  de: 'Hallo! Wie geht es dir heute?',
  it: 'Ciao! Come stai oggi?',
  pt: 'Olá! Como estás hoje?',
  pl: 'Cześć! Jak się dziś masz?',
  ar: 'مرحبا! كيف حالك اليوم؟ · marhaban! kayfa ḥāluka al-yawm?',
  zh: '你好！你今天怎么样？ · nǐ hǎo! nǐ jīntiān zěnmeyàng?',
};
/** Three phrases a situation, a line each, in the order of EN_PHRASES. */
const PHRASES: Record<Situation, Record<LangId, string>> = {
  cafe: {
    es: 'Un café, por favor.\n¿Me trae la cuenta, por favor?\n¿Tienen comida vegetariana?', fr: 'Un café, s’il vous plaît.\nL’addition, s’il vous plaît.\nAvez-vous des plats végétariens ?', de: 'Einen Kaffee, bitte.\nDie Rechnung, bitte.\nHaben Sie vegetarisches Essen?',
    it: 'Un caffè, per favore.\nIl conto, per favore.\nAvete piatti vegetariani?', pt: 'Um café, por favor.\nA conta, por favor.\nTêm comida vegetariana?', pl: 'Poproszę kawę.\nPoproszę rachunek.\nCzy macie dania wegetariańskie?',
    ar: 'قهوة من فضلك · qahwa min faḍlik\nالحساب من فضلك · al-ḥisāb min faḍlik\nهل عندكم طعام نباتي؟ · hal ʿindakum ṭaʿām nabātī?', zh: '请给我一杯咖啡。 · qǐng gěi wǒ yì bēi kāfēi.\n请结账。 · qǐng jiézhàng.\n你们有素食吗？ · nǐmen yǒu sùshí ma?',
  },
  directions: {
    es: '¿Dónde está la estación?\n¿A qué distancia está?\n¿Me lo puede mostrar en el mapa?', fr: 'Où est la gare ?\nC’est loin ?\nPouvez-vous me le montrer sur la carte ?', de: 'Wo ist der Bahnhof?\nWie weit ist es?\nKönnen Sie es mir auf der Karte zeigen?',
    it: 'Dov’è la stazione?\nÈ lontano?\nPuò mostrarmelo sulla mappa?', pt: 'Onde fica a estação?\nFica longe?\nPode mostrar-me no mapa?', pl: 'Gdzie jest dworzec?\nCzy to daleko?\nCzy może mi pan to pokazać na mapie?',
    ar: 'أين المحطة؟ · ayna l-maḥaṭṭa?\nهل هو بعيد؟ · hal huwa baʿīd?\nهل يمكنك أن تريني على الخريطة؟ · hal yumkinuka an turiyanī ʿalā l-kharīṭa?', zh: '车站在哪里？ · chēzhàn zài nǎlǐ?\n远吗？ · yuǎn ma?\n你能在地图上指给我看吗？ · nǐ néng zài dìtú shàng zhǐ gěi wǒ kàn ma?',
  },
  transport: {
    es: 'Un billete para el centro, por favor.\n¿A qué hora sale el próximo tren?\n¿Qué andén es?', fr: 'Un billet pour le centre-ville, s’il vous plaît.\nÀ quelle heure part le prochain train ?\nC’est quel quai ?', de: 'Eine Fahrkarte in die Innenstadt, bitte.\nWann fährt der nächste Zug?\nWelches Gleis ist es?',
    it: 'Un biglietto per il centro, per favore.\nA che ora parte il prossimo treno?\nChe binario è?', pt: 'Um bilhete para o centro, por favor.\nA que horas sai o próximo comboio?\nQual é a linha?', pl: 'Poproszę bilet do centrum.\nO której jest następny pociąg?\nKtóry to peron?',
    ar: 'تذكرة إلى وسط المدينة من فضلك · tadhkira ilā wasaṭ al-madīna min faḍlik\nمتى القطار القادم؟ · matā l-qiṭār al-qādim?\nأي رصيف؟ · ayy raṣīf?', zh: '请给我一张去市中心的票。 · qǐng gěi wǒ yì zhāng qù shìzhōngxīn de piào.\n下一班火车几点？ · xià yì bān huǒchē jǐ diǎn?\n是哪个站台？ · shì nǎge zhàntái?',
  },
  shop: {
    es: '¿Cuánto cuesta esto?\n¿Aceptan tarjetas?\nSolo estoy mirando, gracias.', fr: 'Combien ça coûte ?\nAcceptez-vous les cartes ?\nJe regarde seulement, merci.', de: 'Wie viel kostet das?\nNehmen Sie Karten?\nIch schaue nur, danke.',
    it: 'Quanto costa questo?\nAccettate carte?\nSto solo guardando, grazie.', pt: 'Quanto custa isto?\nAceitam cartões?\nEstou só a ver, obrigado.', pl: 'Ile to kosztuje?\nCzy przyjmujecie karty?\nTylko się rozglądam, dziękuję.',
    ar: 'بكم هذا؟ · bikam hādhā?\nهل تقبلون البطاقات؟ · hal taqbalūna l-biṭāqāt?\nأنا أتفرج فقط، شكرا · anā atafarraj faqaṭ, shukran', zh: '这个多少钱？ · zhège duōshao qián?\n可以刷卡吗？ · kěyǐ shuākǎ ma?\n我只是看看，谢谢。 · wǒ zhǐshì kànkan, xièxie.',
  },
  help: {
    es: 'Necesito ayuda.\nNo entiendo.\n¿Habla inglés?', fr: 'J’ai besoin d’aide.\nJe ne comprends pas.\nParlez-vous anglais ?', de: 'Ich brauche Hilfe.\nIch verstehe nicht.\nSprechen Sie Englisch?',
    it: 'Ho bisogno di aiuto.\nNon capisco.\nParla inglese?', pt: 'Preciso de ajuda.\nNão entendo.\nFala inglês?', pl: 'Potrzebuję pomocy.\nNie rozumiem.\nCzy mówi pan po angielsku?',
    ar: 'أحتاج إلى مساعدة · aḥtāju ilā musāʿada\nلا أفهم · lā afham\nهل تتكلم الإنجليزية؟ · hal tatakallam al-inglīziyya?', zh: '我需要帮助。 · wǒ xūyào bāngzhù.\n我不明白。 · wǒ bù míngbai.\n你会说英语吗？ · nǐ huì shuō yīngyǔ ma?',
  },
  hotel: {
    es: 'Tengo una reserva.\n¿A qué hora es el desayuno?\n¿Dónde está el baño?', fr: 'J’ai une réservation.\nÀ quelle heure est le petit-déjeuner ?\nOù sont les toilettes ?', de: 'Ich habe eine Reservierung.\nWann gibt es Frühstück?\nWo ist die Toilette?',
    it: 'Ho una prenotazione.\nA che ora è la colazione?\nDov’è il bagno?', pt: 'Tenho uma reserva.\nA que horas é o pequeno-almoço?\nOnde é a casa de banho?', pl: 'Mam rezerwację.\nO której jest śniadanie?\nGdzie jest toaleta?',
    ar: 'لدي حجز · ladayya ḥajz\nمتى الفطور؟ · matā l-futūr?\nأين الحمام؟ · ayna l-ḥammām?', zh: '我有预订。 · wǒ yǒu yùdìng.\n早餐几点？ · zǎocān jǐ diǎn?\n洗手间在哪里？ · xǐshǒujiān zài nǎlǐ?',
  },
};
export interface Entry {
  /** The English. */
  en: string;
  /** The word as written in the language (Arabic and Mandarin in their own script). */
  word: string;
  /** How it sounds, for the scripts that need it. */
  roman: string;
  lang: LangId;
}
const entryOf = (lang: LangId, en: string, raw: string): Entry => {
  const [word, roman] = raw.split(' · ');
  return { en, word: word!.trim(), roman: (roman ?? '').trim(), lang };
};
/** All sixty words of a language. */
export const wordsOfLang = (lang: LangId): Entry[] => WORDS[lang].split('|').map((raw, i) => entryOf(lang, EN[i]!, raw));
/** Which of the six days of ten a calendar day falls on. */
export const wordDay = (ymd: string): number => dayNo(ymd) % WORD_DAYS.length;
/** Today's ten words in a language (the same ten all day, the next ten tomorrow; six days, then round again). */
export function dailyWords(lang: LangId, ymd: string): { day: string; entries: Entry[] } {
  const d = wordDay(ymd);
  return { day: WORD_DAYS[d]!, entries: wordsOfLang(lang).slice(d * 10, d * 10 + 10) };
}
/** A situation in his words → ours ("ordering coffee" → cafe). */
export function situationOf(words: string): Situation | null {
  const w = words.toLowerCase();
  if (/\bcaf[eé]s?\b|\bcoffee\b|\brestaurants?\b|\border(?:ing)?\b|\bfood\b|\beat(?:ing)?\b|\bmenu\b|\bbill\b|\bdrinks?\b|\bbar\b|\bpub\b|\blunch\b|\bdinner\b|\btea\b|\bbreakfast\b/.test(w)) return 'cafe';
  if (/\btrains?\b|\bbus(?:es)?\b|\btrams?\b|\btickets?\b|\bplatforms?\b|\bmetro\b|\btube\b|\bsubway\b|\btaxis?\b|\btransport\b|\bflights?\b/.test(w)) return 'transport';
  if (/\bdirections?\b|\blost\b|\bway\b|\bmaps?\b|\bstation\b|\bfind\b|\bwhere\b|\bwalk(?:ing)?\b|\broad\b|\bstreet\b/.test(w)) return 'directions';
  if (/\bshop(?:ping|s)?\b|\bbuy(?:ing)?\b|\bmarkets?\b|\bprices?\b|\bpay(?:ing)?\b|\bcost\b|\bstores?\b|\bsouvenirs?\b|\bclothes\b/.test(w)) return 'shop';
  if (/\bhelp\b|\bdoctors?\b|\bemergenc\w+|\bill\b|\bsick\b|\bhurt\b|\bpolice\b|\bunderstand\b|\bproblems?\b/.test(w)) return 'help';
  if (/\bhotels?\b|\brooms?\b|\bstay(?:ing)?\b|\bbook(?:ing)?\b|\bcheck(?:ing)?[- ]?in\b|\breservations?\b|\bhostels?\b|\bairbnb\b/.test(w)) return 'hotel';
  return null;
}
export function phrasesFor(lang: LangId, s: Situation): Entry[] {
  const lines = PHRASES[s][lang].split('\n');
  return EN_PHRASES[s].map((en, i) => entryOf(lang, en, lines[i]!));
}

// ---------------------------------------------------------------- the deck: SM-2, kept on the brain

export interface Card {
  id: string;
  lang: LangId;
  en: string;
  word: string;
  roman: string;
  state: Sm2State;
}
export const cardId = (e: Pick<Entry, 'lang' | 'en'>): string => `${e.lang}:${e.en}`;
/** Words into the deck (once each), due now. */
export function deckAdd(deck: Card[], entries: Entry[], now: number): { deck: Card[]; added: number } {
  const have = new Set(deck.map((c) => c.id));
  const fresh = entries.filter((e) => !have.has(cardId(e))).map((e): Card => ({ id: cardId(e), lang: e.lang, en: e.en, word: e.word, roman: e.roman, state: freshCard(now) }));
  return { deck: [...deck, ...fresh].slice(-1200), added: fresh.length };
}
export const dueCards = (deck: Card[], now: number, lang?: LangId): Card[] => deck.filter((c) => c.state.due <= now && (!lang || c.lang === lang)).sort((a, b) => a.state.due - b.state.due);
/** A card reviewed with one of the four buttons; the deck with its new state. */
export function reviewCard(deck: Card[], id: string, rating: Rating, now: number): { deck: Card[]; card: Card | null } {
  const i = deck.findIndex((c) => c.id === id);
  if (i < 0) return { deck, card: null };
  const card = { ...deck[i]!, state: rate(deck[i]!.state, rating, now) };
  return { deck: deck.map((c, k) => (k === i ? card : c)), card };
}

// ---------------------------------------------------------------- drawing: a guide he draws over, scored by overlap

export type Stroke = [number, number][];
const r1 = (n: number) => Math.round(n * 10) / 10;
const circle = (cx: number, cy: number, r: number, n = 40, rx = r): Stroke => Array.from({ length: n + 1 }, (_, i) => [r1(cx + rx * Math.cos((2 * Math.PI * i) / n)), r1(cy + r * Math.sin((2 * Math.PI * i) / n))]);
const rect = (x: number, y: number, w: number, h: number): Stroke => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
const arcOf = (cx: number, cy: number, r: number, a0: number, a1: number, n = 16): Stroke => Array.from({ length: n + 1 }, (_, i) => [r1(cx + r * Math.cos(((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180)), r1(cy + r * Math.sin(((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180))]);
export interface Lesson {
  id: string;
  title: string;
  /** The step to take, in a sentence. */
  tip: string;
  strokes: Stroke[];
}
export const LESSONS: Lesson[] = [
  { id: 'circle', title: 'A circle', tip: 'One smooth loop, without lifting your finger. Keep every part the same distance from the middle.', strokes: [circle(50, 50, 34)] },
  { id: 'square', title: 'A square', tip: 'Four straight sides of the same length, and four corners. Pause at each corner and turn.', strokes: [rect(25, 25, 50, 50)] },
  { id: 'triangle', title: 'A triangle', tip: 'Start at the top, go down to the right corner, across to the left, and back to the top.', strokes: [[[50, 14], [86, 80], [14, 80], [50, 14]]] },
  { id: 'star', title: 'A five-point star', tip: 'One line, never lifting: top to bottom-right, up to the left point, across, down to bottom-left, back to the top.', strokes: [[[50, 10], [79, 90], [14, 38], [86, 38], [21, 90], [50, 10]]] },
  { id: 'house', title: 'A house', tip: 'The box first, then the roof on top, then the door. Big shapes before small ones.', strokes: [rect(20, 46, 60, 40), [[14, 46], [50, 14], [86, 46]], rect(43, 62, 14, 24)] },
  { id: 'tree', title: 'A tree', tip: 'A trunk like a tall thin box, and a round top that overlaps its end.', strokes: [rect(44, 56, 12, 32), circle(50, 36, 24)] },
  { id: 'sun', title: 'A sun', tip: 'A circle in the middle and eight short rays, each pointing straight out from the centre.', strokes: [circle(50, 50, 16), ...Array.from({ length: 8 }, (_, i): Stroke => [[r1(50 + 24 * Math.cos((i * Math.PI) / 4)), r1(50 + 24 * Math.sin((i * Math.PI) / 4))], [r1(50 + 38 * Math.cos((i * Math.PI) / 4)), r1(50 + 38 * Math.sin((i * Math.PI) / 4))]])] },
  { id: 'spiral', title: 'A spiral', tip: 'Start in the middle and widen a little with every turn. Slow and even.', strokes: [Array.from({ length: 80 }, (_, i): [number, number] => [r1(50 + (i / 80) * 38 * Math.cos(i / 6)), r1(50 + (i / 80) * 38 * Math.sin(i / 6))])] },
  { id: 'wave', title: 'A wave', tip: 'Rise and fall evenly across the page, like a gentle sea. The peaks are all the same height.', strokes: [Array.from({ length: 41 }, (_, i): [number, number] => [r1(8 + i * 2.1), r1(50 + 20 * Math.sin((i / 40) * 4 * Math.PI))])] },
  { id: 'smiley', title: 'A smiley face', tip: 'The head first, then two eyes at the same height, then a curve for the mouth.', strokes: [circle(50, 50, 38), circle(37, 40, 4, 12), circle(63, 40, 4, 12), arcOf(50, 52, 22, 25, 155)] },
  { id: 'heart', title: 'A heart', tip: 'Two rounded bumps at the top that meet in a dip, then straight down to a point.', strokes: [Array.from({ length: 41 }, (_, i): [number, number] => { const t = (i / 40) * 2 * Math.PI; return [r1(50 + 2.1 * 16 * Math.sin(t) ** 3), r1(46 - 2.1 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)))]; })] },
  { id: 'cube', title: 'A cube', tip: 'Two squares, one up and to the right of the other, then join their matching corners.', strokes: [rect(18, 38, 44, 44), rect(38, 18, 44, 44), [[18, 38], [38, 18]], [[62, 38], [82, 18]], [[62, 82], [82, 62]], [[18, 82], [38, 62]]] },
  { id: 'cup', title: 'A cup', tip: 'A shape that narrows towards the bottom, and a handle that is a half circle on the side.', strokes: [[[26, 28], [74, 28], [66, 84], [34, 84], [26, 28]], arcOf(74, 52, 14, -90, 90)] },
  { id: 'fish', title: 'A fish', tip: 'A long oval for the body, a triangle for the tail, and a small circle for the eye.', strokes: [circle(46, 50, 20, 32, 32), [[78, 50], [94, 32], [94, 68], [78, 50]], circle(32, 44, 3, 10)] },
  { id: 'boat', title: 'A boat', tip: 'The hull is a flat-bottomed bowl; the mast stands in the middle and the sail is a triangle.', strokes: [[[14, 62], [86, 62], [72, 84], [28, 84], [14, 62]], [[50, 62], [50, 14]], [[50, 16], [80, 56], [50, 56]]] },
  { id: 'flower', title: 'A flower', tip: 'A small circle in the middle, six round petals around it, and a long straight stem.', strokes: [circle(50, 36, 8), ...Array.from({ length: 6 }, (_, i): Stroke => circle(r1(50 + 17 * Math.cos((i * Math.PI) / 3)), r1(36 + 17 * Math.sin((i * Math.PI) / 3)), 9, 16)), [[50, 62], [50, 92]]] },
  { id: 'arrow', title: 'An arrow', tip: 'A straight line, and a head made of two short lines that meet at its end.', strokes: [[[12, 50], [88, 50]], [[70, 32], [88, 50], [70, 68]]] },
  { id: 'mountains', title: 'Mountains', tip: 'A zigzag of peaks. Make the middle one the tallest.', strokes: [[[8, 82], [30, 44], [44, 62], [62, 18], [78, 58], [92, 82], [8, 82]]] },
  { id: 'diamond', title: 'A kite', tip: 'Four corners: top, right, bottom, left, with a cross inside joining them.', strokes: [[[50, 10], [80, 44], [50, 90], [20, 44], [50, 10]], [[50, 10], [50, 90]], [[20, 44], [80, 44]]] },
  { id: 'cat', title: 'A cat’s face', tip: 'A round face, two pointed ears on top, a small nose, and three whiskers a side.', strokes: [circle(50, 56, 32), [[24, 40], [24, 12], [44, 28]], [[76, 40], [76, 12], [56, 28]], [[46, 58], [54, 58], [50, 63], [46, 58]], [[8, 54], [34, 60]], [[8, 66], [34, 64]], [[92, 54], [66, 60]], [[92, 66], [66, 64]]] },
];
/** The lesson of the day, or the one he names (“trace the star”). */
export function lessonFor(ymd: string, named = ''): Lesson {
  const w = named.toLowerCase();
  const hit = w ? LESSONS.find((l) => new RegExp(`\\b${l.id}\\b`).test(w) || w.includes(l.title.toLowerCase().replace(/^an? /, ''))) : null;
  return hit ?? LESSONS[dayNo(ymd) % LESSONS.length]!;
}
const sample = (strokes: Stroke[], step = 2): [number, number][] => {
  const out: [number, number][] = [];
  for (const s of strokes) {
    for (let i = 0; i < s.length; i++) {
      out.push(s[i]!);
      if (i === 0) continue;
      const [x0, y0] = s[i - 1]!;
      const [x1, y1] = s[i]!;
      const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / step);
      for (let k = 1; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
    }
  }
  return out;
};
const near = (p: [number, number], pts: [number, number][], r: number) => pts.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) <= r);
export interface Overlap {
  /** 0–100: how much of the guide he covered. */
  covered: number;
  /** 0–100: how much of his drawing is on the guide. */
  onGuide: number;
  score: number;
  said: string;
}
/** His strokes against the guide (both on the 0–100 square), by simple overlap within `r`; said kindly. */
export function overlap(guide: Stroke[], drawn: Stroke[], r = 5): Overlap {
  const g = sample(guide);
  const d = sample(drawn);
  if (!d.length || !g.length) return { covered: 0, onGuide: 0, score: 0, said: 'Draw over the guide with your finger, then I can compare.' };
  const covered = Math.round((g.filter((p) => near(p, d, r)).length / g.length) * 100);
  const onGuide = Math.round((d.filter((p) => near(p, g, r)).length / d.length) * 100);
  const score = covered + onGuide ? Math.round((2 * covered * onGuide) / (covered + onGuide)) : 0;
  const said =
    score >= 85 ? `Very close: ${score}%. Smooth and sure.`
    : score >= 65 ? `Good: ${score}%. The shape is clearly there${covered < onGuide ? '; a bit of the guide was missed, so go all the way round' : '; the lines wander a little, so slow down'}.`
    : score >= 40 ? `A fair start: ${score}%. ${covered < 50 ? 'Much of the guide was left untouched: trace every part of it.' : 'You covered it, but strayed: slower, shorter strokes keep you on the line.'}`
    : `${score}%: not the shape yet, and that is normal. Trace the guide slowly, then try beside it.`;
  return { covered, onGuide, score, said };
}

// ---------------------------------------------------------------- typing

export const TYPING_LINES = [
  'The quick brown fox jumps over the lazy dog while the band plays on.',
  'A calm mind makes steady hands, and steady hands make quick work of small jobs.',
  'Pack my box with five dozen liquor jugs, then write the label in clear letters.',
  'Rain on the window, tea in the cup, and an hour with nothing at all to do.',
  'Every long road is walked one step at a time, and every step counts.',
  'Sphinx of black quartz, judge my vow: type each word without looking down.',
  'The train leaves at half past seven, so be at the station with your ticket.',
];
export const TYPING_PASSAGES = [
  'A lighthouse keeps ships away from rocks by throwing a beam of light far out to sea. Long ago, keepers lived beside the lamp and trimmed the wick by hand every evening. Today most lights run themselves, but each one still has its own pattern of flashes, so a sailor can tell which coast is near.',
  'Bread rises because yeast, a tiny living thing, feeds on the sugars in flour and gives off a gas. The gas is trapped in the stretchy dough and makes it swell. In the oven the heat sets the crumb, the gas escapes slowly, and the crust turns brown and crisp.',
  'Tides are caused mostly by the pull of the Moon on the oceans. Water on the side facing the Moon is drawn towards it, and a second bulge forms on the far side. As the Earth turns, a coast passes through each bulge, which is why most places have two high tides a day.',
  'The sky looks blue because air scatters short waves of light more than long ones. Blue light bounces around the whole sky and reaches your eyes from every direction. At sunset the light crosses far more air, most of the blue is lost on the way, and the reds are what remain.',
];
/** Edit distance between two strings (insertions, deletions, swaps of one letter). */
export function levenshtein(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}
/** Typing is judged on plain letters: curly quotes, long dashes and odd spaces count as the straight ones a keyboard gives. */
export const asciiText = (s: string): string =>
  s.replace(/[\u2018\u2019\u201B\u2032]/g, "'").replace(/[\u201C\u201D\u201F\u2033]/g, '"').replace(/[\u2013\u2014\u2212]/g, '-').replace(/\u2026/g, '...').replace(/[\u00A0\u2009\u202F]/g, ' ').replace(/\s+/g, ' ').trim();
export interface Typed {
  /** False when the time cannot be right (faster than anyone types): it is said, and not counted. */
  valid: boolean;
  /** Words a minute, counting only the right letters (a word is five letters). */
  wpm: number;
  /** Words a minute counting every letter typed. */
  gross: number;
  accuracy: number;
  errors: number;
  said: string;
}
/** The test scored: net words a minute (right letters only) and the share of the passage he got right. */
export function typingScore(target: string, typed: string, ms: number): Typed {
  const t = asciiText(target);
  const y = asciiText(typed);
  const minutes = Math.max(ms, 1000) / 60_000;
  const errors = levenshtein(t, y);
  const right = Math.max(0, t.length - errors);
  const accuracy = t.length ? Math.round((right / t.length) * 100) : 0;
  const wpm = Math.round(right / 5 / minutes);
  const gross = Math.round(y.length / 5 / minutes);
  const valid = wpm <= 250 && ms >= 1000;
  const head = `${wpm} words a minute at ${accuracy}% accuracy${errors ? ` (${errors} slip${errors === 1 ? '' : 's'})` : ''}`;
  const tail = !valid ? 'That is faster than anyone types, so the clock must have slipped (or it was pasted): I am not counting it.' : accuracy < 90 ? 'Accuracy first: slow down until it is 95%, and the speed follows.' : wpm < 30 ? 'Clean typing. Speed comes with the practice.' : wpm < 60 ? 'A good everyday speed.' : 'Fast and clean.';
  return { valid, wpm, gross, accuracy, errors, said: `${head}. ${tail}` };
}
/** A line of 12 to 26 words from some library text: whole sentences, or cut at a word; plain letters. */
export function passageFrom(text: string, seed = 0): string {
  const t = clean(text.replace(/[^\S\n]+/g, ' ').replace(/\[\d+\]/g, ''));
  const sentences = t.split(/(?<=[.!?])\s+/).filter((s) => /^[A-Z]/.test(s) && s.split(' ').length >= 6);
  const start = sentences.length ? Math.floor(rng(seed + 1)() * sentences.length) : 0;
  let out = '';
  for (let i = start; i < sentences.length && out.split(' ').length < 12; i++) out = clean(`${out} ${sentences[i]}`);
  const words = asciiText(out).split(' ');
  return words.length > 26 ? `${words.slice(0, 22).join(' ').replace(/[,;:]$/, '')}.` : words.join(' ');
}

// ---------------------------------------------------------------- handwriting: the phone’s reader reads it back

export const HAND_SENTENCES = [
  'Write a clear line and read it back.',
  'Neat letters take time and care.',
  'The little brown dog sleeps by the door.',
  'A good cup of tea needs a minute.',
  'Slow and steady wins the race today.',
];
const wordsOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9'\s]/g, ' ').split(/\s+/).filter(Boolean);
/** The share of a sentence the reader could read back: each of its words found among the reader’s (one slip allowed), or, with no sentence, the share of the reader’s words it was sure of. */
export function legibility(expected: string, read: { text: string; confidence?: number }[]): { share: number; read: number; of: number; said: string } {
  const got = read.map((w) => ({ w: wordsOf(w.text).join(''), c: w.confidence ?? 100 })).filter((x) => x.w.length > 0);
  const want = wordsOf(expected);
  if (want.length) {
    const used = new Set<number>();
    let n = 0;
    for (const w of want) {
      const k = got.findIndex((g, i) => !used.has(i) && levenshtein(g.w, w) <= (w.length > 3 ? 1 : 0));
      if (k >= 0) {
        used.add(k);
        n++;
      }
    }
    const share = Math.round((n / want.length) * 100);
    return { share, read: n, of: want.length, said: `The phone read back ${n} of the ${want.length} words (${share}%). ${share >= 90 ? 'Very legible.' : share >= 70 ? 'Mostly clear: slow down on the words it missed.' : share >= 40 ? 'Part of it read: leave a little more space between letters and between words.' : 'It struggled: write bigger, with darker ink, on plain paper, and try again.'}` };
  }
  const sure = got.filter((g) => g.c >= 60 && g.w.length >= 2).length;
  const share = got.length ? Math.round((sure / got.length) * 100) : 0;
  return { share, read: sure, of: got.length, said: got.length ? `The reader was sure of ${sure} of ${got.length} words (${share}%).` : 'The reader found no words in that photo: try a flatter, brighter one.' };
}

// ---------------------------------------------------------------- reading faster: a word at a time, three questions

/** Each word with how long to show it at `wpm`: longer words and a full stop get a little longer. */
export function rsvp(text: string, wpm: number): { w: string; ms: number }[] {
  const base = 60_000 / Math.max(60, Math.min(1000, wpm));
  return clean(text).split(' ').filter(Boolean).map((w) => ({ w, ms: Math.round(base * (1 + (w.replace(/\W/g, '').length >= 9 ? 0.4 : w.replace(/\W/g, '').length >= 7 ? 0.2 : 0) + (/[.!?]$/.test(w) ? 0.8 : /[,;:]$/.test(w) ? 0.4 : 0))) }));
}
export interface Question {
  q: string;
  options: string[];
  answer: number;
}
const STOP = new Set('about after again against because before between could during every other should their there these those through under until where which while would'.split(' '));
/** Three fill-the-gap questions made from the passage itself, in code: a long word taken out, three words to choose from. */
export function readQuestions(passage: string, seed = 1, n = 3): Question[] {
  const r = rng(seed);
  const sentences = passage.split(/(?<=[.!?])\s+/).map(clean).filter((s) => s.split(' ').length >= 6);
  const pool = [...new Set((passage.toLowerCase().match(/[a-z]{6,}/g) ?? []).filter((w) => !STOP.has(w)))];
  const out: Question[] = [];
  for (const s of shuffle(r, sentences)) {
    if (out.length >= n) break;
    const cands = (s.match(/[A-Za-z]{6,}/g) ?? []).filter((w) => !STOP.has(w.toLowerCase()) && s.indexOf(w) > 0);
    const target = cands[Math.floor(r() * cands.length)];
    if (!target) continue;
    const others = shuffle(r, pool.filter((w) => w !== target.toLowerCase())).slice(0, 2);
    if (others.length < 2) continue;
    const options = shuffle(r, [target.toLowerCase(), ...others]);
    out.push({ q: s.replace(new RegExp(`\\b${target}\\b`), '_____'), options, answer: options.indexOf(target.toLowerCase()) });
  }
  return out;
}
export const READ_PASSAGES = TYPING_PASSAGES;
/** A passage for reading faster from some text: four sentences or more, 60 to 160 words, enough in it for three questions; '' when the text has no such run. */
export function readingFrom(text: string, seed = 0): string {
  const sentences = asciiText(text.replace(/\[\d+\]/g, '')).split(/(?<=[.!?])\s+/).filter((s) => /^[A-Z]/.test(s) && s.split(' ').length >= 5);
  if (sentences.length < 4) return '';
  const first = Math.floor(rng(seed + 3)() * sentences.length);
  for (let k = 0; k < sentences.length; k++) {
    let out = '';
    let n = 0;
    for (let i = (first + k) % sentences.length; i < sentences.length && out.split(' ').length < 60; i++) {
      out = out ? `${out} ${sentences[i]}` : sentences[i]!;
      n++;
    }
    const w = out.split(' ').length;
    if (n >= 4 && w >= 60 && w <= 160 && readQuestions(out, seed).length >= 3) return out;
  }
  return '';
}
/** Comprehension: how many of the answers (indexes) were right. */
export const comprehension = (qs: Question[], given: number[]): number => qs.filter((q, i) => given[i] === q.answer).length;

// ---------------------------------------------------------------- memory

export const MEMORY_WORDS = ['apple', 'bridge', 'candle', 'dragon', 'engine', 'forest', 'garden', 'hammer', 'island', 'jacket', 'kettle', 'ladder', 'mirror', 'needle', 'orange', 'pillow', 'rabbit', 'saddle', 'tunnel', 'window', 'anchor', 'basket', 'camera', 'dolphin', 'feather', 'guitar', 'helmet', 'lantern', 'magnet', 'pepper'];
export type MemoryKind = 'number' | 'list' | 'names';
export interface MemoryDrill {
  kind: MemoryKind;
  level: number;
  /** What to remember, in order. */
  items: string[];
  /** For names: what to be asked (the cue) for each. */
  cues?: string[];
  /** Seconds to look, a fair time for this many. */
  seconds: number;
}
/** A drill by level: digits (4 at level 1, then one more a level), words (3, then one more every level), or names with the cues he gave. */
export function memoryDrill(kind: MemoryKind, level: number, seed: number, names: { name: string; cue: string }[] = []): MemoryDrill {
  const r = rng(seed);
  const lv = Math.max(1, Math.min(10, Math.round(level)));
  if (kind === 'number') {
    const items = Array.from({ length: 3 + lv }, () => String(Math.floor(r() * 10)));
    return { kind, level: lv, items, seconds: Math.max(3, items.length) };
  }
  if (kind === 'names') {
    const use = shuffle(r, names).slice(0, Math.max(2, Math.min(names.length, 2 + lv)));
    return { kind, level: lv, items: use.map((x) => x.name), cues: use.map((x) => x.cue), seconds: use.length * 4 };
  }
  const items = shuffle(r, MEMORY_WORDS).slice(0, 2 + lv);
  return { kind, level: lv, items, seconds: items.length * 3 };
}
/** The pairs he gives, "Priya - red scarf, Tom - tall": a name and a cue he chose (nothing about anyone is looked up). */
export function parsePairs(words: string): { name: string; cue: string }[] {
  return clean(words.replace(/^\s*(?:names?|people|faces?)\s*:\s*/i, '').replace(/\n+/g, ';'))
    .split(/[;,]\s*/)
    .map((p) => /^(.{1,30}?)\s+[-–—=]\s+(.{1,40})$/.exec(p.trim()) ?? /^([^:]{1,30}?)\s*:\s*(.{1,40})$/.exec(p.trim()) ?? /^([^-–:=]{1,30}?)[-–=](.{1,40})$/.exec(p.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ name: cap(clean(m[1]!)), cue: clean(m[2]!) }))
    .slice(0, 12);
}
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u00c0-\u024f\s]/g, ' ').split(/\s+/).filter(Boolean);
/** What he said back against the drill: digits all in order; a list, how many words he remembered; names, how many by their cue in order. */
export function memoryScore(d: MemoryDrill, answer: string): { right: number; of: number; said: string } {
  const up = Math.min(10, d.level + 1);
  if (d.kind === 'number') {
    const ok = answer.replace(/\D/g, '') === d.items.join('');
    return { right: ok ? 1 : 0, of: 1, said: ok ? `Right: all ${d.items.length} digits. Level ${d.level} done; try ${up}.` : `Not quite. It was ${d.items.join(' ')}. Try again at this level, or one below.` };
  }
  let right: number;
  if (d.kind === 'names') {
    const parts = answer.split(/[,;\n]+/).map((x) => clean(x).toLowerCase());
    right = d.items.filter((n, i) => !!parts[i] && levenshtein(parts[i]!, n.toLowerCase()) <= (n.length > 4 ? 1 : 0)).length;
  } else {
    const got = new Set(norm(answer));
    right = d.items.filter((w) => got.has(w.toLowerCase())).length;
  }
  const of = d.items.length;
  return { right, of, said: `${right} of ${of} remembered${right === of ? `: level ${d.level} done, try ${up}` : right >= of - 1 ? ': nearly, so stay on this level' : ': go back one level or look a little longer'}.` };
}

// ---------------------------------------------------------------- mental maths

export interface Sum {
  q: string;
  a: number;
}
/** A drill by level, the same for the same seed: 1 up to 20; 2 up to 100; 3 times tables; 4 two-digit times one digit, and a share of a number; 5 brackets and squares. */
export function mathsDrill(level: number, seed: number, n = 20): Sum[] {
  const r = rng(seed * 7 + level);
  const lv = Math.max(1, Math.min(5, Math.round(level)));
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  return Array.from({ length: n }, (): Sum => {
    if (lv === 1) {
      const a = int(2, 19);
      const b = int(1, 20 - a > 1 ? 20 - a : 1);
      return r() < 0.5 ? { q: `${a} + ${b}`, a: a + b } : { q: `${a + b} − ${b}`, a };
    }
    if (lv === 2) {
      const a = int(11, 89);
      const b = int(5, 99 - a > 5 ? 99 - a : 5);
      return r() < 0.5 ? { q: `${a} + ${b}`, a: a + b } : { q: `${a + b} − ${b}`, a };
    }
    if (lv === 3) {
      const a = int(2, 12);
      const b = int(2, 12);
      return r() < 0.7 ? { q: `${a} × ${b}`, a: a * b } : { q: `${a * b} ÷ ${a}`, a: b };
    }
    if (lv === 4) {
      if (r() < 0.5) {
        const a = int(12, 49);
        const b = int(3, 9);
        return { q: `${a} × ${b}`, a: a * b };
      }
      const p = pick(r, [10, 25, 50, 20] as const);
      const base = int(2, 20) * (p === 25 ? 4 : p === 20 ? 5 : 10);
      return { q: `${p}% of ${base}`, a: (base * p) / 100 };
    }
    const k = int(0, 2);
    if (k === 0) {
      const a = int(2, 9);
      const b = int(2, 9);
      const c = int(2, 9);
      return { q: `(${a} + ${b}) × ${c}`, a: (a + b) * c };
    }
    if (k === 1) {
      const a = int(11, 19);
      return { q: `${a}²`, a: a * a };
    }
    const a = int(3, 12);
    const b = int(3, 12);
    const c = int(2, 30);
    return { q: `${a} × ${b} + ${c}`, a: a * b + c };
  });
}
/** The next level to try: up when the last two sessions at this level were 90% or better, down when the last was under 50%. */
export function nextLevel(level: number, recent: number[]): number {
  if (recent.length >= 2 && recent.slice(-2).every((s) => s >= 90)) return Math.min(5, level + 1);
  if (recent.length && recent[recent.length - 1]! < 50) return Math.max(1, level - 1);
  return level;
}

// ---------------------------------------------------------------- spelling: the slips in his own messages

export const SLIPS: Record<string, string> = Object.fromEntries(
  `recieve:receive|definately:definitely|definatly:definitely|seperate:separate|occured:occurred|untill:until|wich:which|alot:a lot|thier:their|becuase:because|becasue:because|begining:beginning|beleive:believe|calender:calendar|collegue:colleague|comming:coming|concious:conscious|embarass:embarrass|enviroment:environment|existance:existence|foriegn:foreign|freind:friend|goverment:government|grammer:grammar|harrass:harass|immediatly:immediately|independant:independent|knowlege:knowledge|liason:liaison|lenght:length|neccessary:necessary|necesary:necessary|noticable:noticeable|occassion:occasion|persistant:persistent|posession:possession|prefered:preferred|publically:publicly|realy:really|reccomend:recommend|recomend:recommend|refered:referred|relevent:relevant|religous:religious|rythm:rhythm|secratary:secretary|sieze:seize|succesful:successful|successfull:successful|suprise:surprise|tommorow:tomorrow|tomorow:tomorrow|tounge:tongue|truely:truly|twelth:twelfth|tyrany:tyranny|unforseen:unforeseen|vaccum:vacuum|wierd:weird|writting:writing|adress:address|accomodate:accommodate|acheive:achieve|agressive:aggressive|apparant:apparent|arguement:argument|basicly:basically|buisness:business|catagory:category|cemetary:cemetery|comitted:committed|completly:completely|decieve:deceive|dissapoint:disappoint|excercise:exercise|experiance:experience|finaly:finally|gaurd:guard|happend:happened|hieght:height|humourous:humorous|interupt:interrupt|libary:library|maintainance:maintenance|millenium:millennium|mischievious:mischievous|neice:niece|ocurred:occurred|pasttime:pastime|peice:piece|plesant:pleasant|priviledge:privilege|pronounciation:pronunciation|questionaire:questionnaire|recieved:received|resistence:resistance|responsability:responsibility|restaraunt:restaurant|scedule:schedule|speach:speech|strenght:strength|sucess:success|tecnology:technology|temperture:temperature|threshhold:threshold|tomatos:tomatoes|upto:up to|wensday:Wednesday|whereever:wherever|wich:which|writen:written|absense:absence|accross:across|aquire:acquire|aweful:awful|begginning:beginning|bizzare:bizarre|carrer:career|cieling:ceiling|comission:commission|commitee:committee|concensus:consensus|desparate:desperate|dilema:dilemma|discription:description|disapear:disappear|eigth:eighth|embarassed:embarrassed|exagerate:exaggerate|facinating:fascinating|fourty:forty|futher:further|gratefull:grateful|guidence:guidance|heighth:height|hipocrite:hypocrite|imediately:immediately|incidently:incidentally|intresting:interesting|irresistable:irresistible|lollypop:lollipop|mispell:misspell|neccesary:necessary|nieghbour:neighbour|occurence:occurrence|ocasion:occasion|oppurtunity:opportunity|orignal:original|parliment:parliament|particulary:particularly|percieve:perceive|perseverence:perseverance|politican:politician|potatos:potatoes|probly:probably|proffesional:professional|rediculous:ridiculous|remeber:remember|resturant:restaurant|rhythym:rhythm|saftey:safety|sentance:sentence|similiar:similar|sincerley:sincerely|suceed:succeed|supercede:supersede|supress:suppress|tendancy:tendency|thourough:thorough|unfortunatly:unfortunately|unneccessary:unnecessary|vegtable:vegetable|visable:visible|wellcome:welcome|yeild:yield|yesturday:yesterday|accomodation:accommodation|assasinate:assassinate|athiest:atheist|changable:changeable|cheif:chief|embarasing:embarrassing|developement:development`
    .split('|')
    .map((p) => p.split(':') as [string, string]),
);
/** Slips in some text of his own: only the ones I know, said so (I do not catch every typo). */
export function findSlips(text: string): { wrong: string; right: string }[] {
  const seen = new Set<string>();
  const out: { wrong: string; right: string }[] = [];
  for (const m of text.toLowerCase().matchAll(/[a-z']+/g)) {
    const right = SLIPS[m[0]];
    if (right && !seen.has(m[0])) {
      seen.add(m[0]);
      out.push({ wrong: m[0], right });
    }
  }
  return out;
}
export interface Word {
  right: string;
  /** How he wrote it. */
  wrong: string[];
  seen: number;
  state: Sm2State;
}
export function addSlips(list: Word[], slips: { wrong: string; right: string }[], now: number): { list: Word[]; added: number } {
  const next = list.map((w) => ({ ...w, wrong: [...w.wrong] }));
  let added = 0;
  for (const s of slips) {
    const w = next.find((x) => x.right === s.right);
    if (w) {
      if (!w.wrong.includes(s.wrong)) w.wrong.push(s.wrong);
      w.seen++;
    } else {
      next.push({ right: s.right, wrong: [s.wrong], seen: 1, state: freshCard(now) });
      added++;
    }
  }
  return { list: next.slice(-200), added };
}
export const spellingDue = (list: Word[], now: number): Word[] => list.filter((w) => w.state.due <= now).sort((a, b) => a.state.due - b.state.due);

// ---------------------------------------------------------------- first aid: the NHS's steps, as practice

export interface Scenario {
  id: string;
  title: string;
  /** In the order to do them. */
  steps: string[];
}
export const FIRST_AID_SOURCE = 'NHS first aid guidance (nhs.uk/conditions/first-aid)';
export const FIRST_AID: Scenario[] = [
  { id: 'cpr', title: 'An adult who is not breathing normally (CPR)', steps: ['Shout for help and call 999, or get someone else to', 'Put the heel of one hand on the centre of the chest, the other hand on top', 'Push down hard and fast, about 5 to 6 cm, 100 to 120 times a minute', 'Keep going until help arrives or they start breathing normally'] },
  { id: 'choking', title: 'An adult who is choking', steps: ['Encourage them to keep coughing', 'If that fails, lean them forward and give up to 5 back blows between the shoulder blades', 'Still choking: give up to 5 abdominal thrusts, a fist above the belly button pulled sharply in and up', 'Not cleared: call 999 and keep alternating 5 back blows and 5 thrusts'] },
  { id: 'bleeding', title: 'Severe bleeding', steps: ['Press firmly on the wound with a clean pad, cloth or your hand', 'Call 999', 'Keep pressing; put a second pad on top rather than lifting the first', 'Lay them down, raise the injured limb if you can, and keep them warm'] },
  { id: 'burn', title: 'A burn', steps: ['Cool the burn under cool or lukewarm running water for at least 20 minutes', 'Take off jewellery and clothing near it, unless stuck to the skin', 'Cover it loosely with cling film or a clean non-fluffy cloth', 'Get medical help for a large or deep burn; call 999 for a severe one'] },
  { id: 'recovery', title: 'Someone unconscious but breathing', steps: ['Check they are breathing and call 999', 'Kneel beside them and bring their nearest arm out at a right angle', 'Bring the far arm across their chest, the back of the hand against their cheek', 'Bend the far knee up and roll them towards you onto their side', 'Tilt the head back and open the mouth to keep the airway clear'] },
  { id: 'stroke', title: 'A suspected stroke', steps: ['Face: has their face fallen on one side, can they smile?', 'Arms: can they raise both and keep them there?', 'Speech: is it slurred, or are they confused?', 'Time to call 999 straight away if any of these'] },
  { id: 'heart', title: 'A suspected heart attack', steps: ['Call 999 at once', 'Sit them down and keep them calm and still', 'If they are not allergic and you have one, give a 300 mg aspirin to chew slowly', 'Stay with them and be ready to start CPR if they stop breathing normally'] },
  { id: 'seizure', title: 'Someone having a seizure', steps: ['Clear space round them and do not hold them down', 'Cushion their head with something soft', 'Note the time it started', 'Call 999 if it lasts more than 5 minutes or they are hurt; put them on their side when it stops'] },
];
export const FIRST_AID_LINE = 'This is practice from the NHS’s published steps, not training: a St John Ambulance or Red Cross course is how to learn it properly. For a real one, call 999.';
export function scenarioFor(ymd: string, named = ''): Scenario {
  const w = named.toLowerCase();
  return FIRST_AID.find((s) => w && (w.includes(s.id) || s.title.toLowerCase().split(' ').some((t) => t.length > 4 && w.includes(t)))) ?? FIRST_AID[dayNo(ymd) % FIRST_AID.length]!;
}
/** An order of steps (indexes into the right order) against the right one: the share in the right place. */
export function orderScore(sc: Scenario, order: number[]): { right: number; of: number } {
  return { right: order.filter((v, i) => v === i).length, of: sc.steps.length };
}

// ---------------------------------------------------------------- a four-week plan, ten minutes a day

const KINDS: [string, RegExp, string[]][] = [
  ['an instrument', /\b(guitar|piano|ukulele|violin|drums?|bass|keyboard|flute|saxophone|trumpet|cello|sing(?:ing)?)\b/i, ['Tune up and play the easiest thing you know, slowly', 'One new chord, note or pattern: play it ten times, slowly', 'Put it together with what you knew: two things in a row', 'Play along with a slow metronome', 'Play a short piece or riff all the way through', 'Play for fun, anything you like', 'Rest or just listen to a piece you want to play']],
  ['a language', /\b(spanish|french|german|italian|portuguese|polish|arabic|mandarin|chinese|urdu|punjabi|language|welsh)\b/i, ['Ten new words, said aloud', 'Revise yesterday’s words, then say three sentences with them', 'A phrase for a real situation, said aloud five times', 'Listen to something short in the language and catch one word', 'Write four sentences about your day', 'Talk to yourself in the language for ten minutes', 'Easy review: the words you find hardest']],
  ['a sport or fitness', /\b(run|running|swim|swimming|cycle|cycling|gym|yoga|press-?ups?|squats?|fitness|football|tennis|badminton|boxing|climbing)\b/i, ['Warm up and do the basic move slowly with good form', 'Repeat the basic move for time, resting when you need to', 'Add one new variation', 'Easy day: stretch and move gently', 'Repeat the week’s best session', 'Play or do it for fun', 'Rest, and note how you feel']],
  ['coding', /\b(code|coding|program(?:ming)?|python|javascript|html|css|web ?dev)\b/i, ['Read a short example and type it in by hand', 'Change one thing in it and see what happens', 'Write a tiny program from nothing', 'Fix a bug you put in on purpose', 'Add one feature to your tiny program', 'Build something you would use', 'Read other people’s code for ten minutes']],
  ['drawing', /\b(draw(?:ing)?|sketch(?:ing)?|paint(?:ing)?|art|watercolou?r)\b/i, ['Warm-up: ten circles and ten straight lines', 'Draw one object in front of you, outline only', 'Add shading to yesterday’s object', 'Draw the same object from another side', 'Copy a simple picture you like', 'Draw anything for fun', 'Look at three drawings you admire and say why']],
  ['cooking', /\b(cook(?:ing)?|bak(?:e|ing)|knife skills|recipe)\b/i, ['Learn one technique: read how it is done, then try it', 'Practise the technique on its own', 'Use it in a simple dish', 'Cook a dish you know, and change one thing', 'Cook for someone else', 'Try a new recipe', 'Plan next week’s meals']],
  ['chess', /\b(chess|draughts|checkers|go\b)\b/i, ['Set up the pieces and say how each one moves', 'Solve three simple puzzles', 'Play a game against a computer, slowly', 'Look back over yesterday’s game for one mistake', 'Learn one opening idea', 'Play a longer game', 'Review the week’s mistakes']],
  ['a new skill', /./, ['Find out the basics: write down three key words or steps', 'Do the simplest exercise slowly for ten minutes', 'Learn one new thing and try it straight away', 'Repeat yesterday’s exercise and notice what is easier', 'Use it for something real, however small', 'Practise for fun, with no rules', 'Look back: what has improved, what is next?']],
];
export const WEEKS = ['slow and simple', 'a little harder', 'use it for something real', 'polish it and test yourself'];
export interface Plan {
  id: string;
  skill: string;
  start: string;
  minutes: number;
  days: number;
}
export function skillKind(skill: string): string {
  return (KINDS.find(([, re]) => re.test(skill)) ?? KINDS[KINDS.length - 1]!)[0];
}
/** The line for day `n` (1 to 28) of a plan. */
export function planLine(p: Pick<Plan, 'skill' | 'minutes'>, n: number): string {
  const kind = KINDS.find(([, re]) => re.test(p.skill)) ?? KINDS[KINDS.length - 1]!;
  const wk = Math.floor((n - 1) / 7);
  return `Day ${n} of 28 (week ${wk + 1}: ${WEEKS[wk]}): ${kind[2][(n - 1) % 7]}. ${p.minutes} minutes.`;
}
/** Which day of the plan a calendar day is (1–28), 0 before it starts, 29+ after it ends. */
export const planDay = (p: Pick<Plan, 'start'>, ymd: string): number => dayNo(ymd) - dayNo(p.start) + 1;
export function newPlan(skill: string, start: string, minutes = 10): Plan {
  return { id: skill.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24), skill: clean(skill).slice(0, 40), start, minutes: Math.max(5, Math.min(60, Math.round(minutes))), days: 28 };
}
/** “a plan for learning guitar” → “guitar”; “get better at the piano in 4 weeks” → “piano”. */
export function skillIn(words: string): string {
  const t = clean(words).replace(/[.!?]+$/, '');
  const re = /\b(?:learn(?:ing)?(?: how)?(?: to)?|get(?:ting)? better at|improv(?:e|ing)(?: my)?|practi[sc]e|study(?:ing)?|master(?:ing)?|pick(?:ing)? up|tak(?:e|ing) up|plan for|plan to)\s+/gi;
  let end = -1;
  for (const m of t.matchAll(re)) end = m.index! + m[0].length;
  if (end < 0) return '';
  const rest = t.slice(end).split(/\s+(?:in|for|over|every|each|with|by|within|using|at|so)\b|[,;]| - /i)[0] ?? '';
  return clean(rest.replace(/^(?:to\s+)?(?:play(?:ing)?|speak(?:ing)?|do(?:ing)?)\s+/i, '').replace(/^(?:the|a|an|my|some)\s+/i, '')).slice(0, 40);
}

// ---------------------------------------------------------------- the log: streaks and bests

export interface LogEntry {
  skill: string;
  on: string;
  score?: number;
  /** Out of how many (maths: right of tried). */
  of?: number;
  unit?: string;
  detail?: string;
}
export const SKILLS: Record<string, { name: string; unit: string; best: 'max' | 'none' }> = {
  words: { name: 'Words', unit: 'words', best: 'max' },
  review: { name: 'Deck reviews', unit: 'cards', best: 'max' },
  draw: { name: 'Drawing', unit: '% overlap', best: 'max' },
  typing: { name: 'Typing', unit: 'wpm', best: 'max' },
  hand: { name: 'Handwriting', unit: '% legible', best: 'max' },
  readfast: { name: 'Speed reading', unit: 'wpm', best: 'max' },
  memory: { name: 'Memory', unit: 'items', best: 'max' },
  maths: { name: 'Mental maths', unit: 'right', best: 'max' },
  spelling: { name: 'Spelling', unit: 'right', best: 'max' },
  firstaid: { name: 'First aid', unit: '% in order', best: 'max' },
  converse: { name: 'Conversation', unit: '', best: 'none' },
};
export interface SkillRow {
  skill: string;
  name: string;
  count: number;
  streak: number;
  longest: number;
  today: boolean;
  best: number | null;
  unit: string;
  last: string;
}
/** Every skill he has logged: how many times, the streak (a day behind is not lost yet), the longest, and the best score. */
export function progressRows(log: LogEntry[], today: string): SkillRow[] {
  const by = new Map<string, LogEntry[]>();
  for (const e of log) by.set(e.skill, [...(by.get(e.skill) ?? []), e]);
  return [...by].map(([skill, es]) => {
    let s: Streak = { days: [], best: 0 };
    for (const e of [...es].sort((a, b) => a.on.localeCompare(b.on))) s = markDay(s, e.on);
    const st = streakOf(s, today);
    const meta = SKILLS[skill] ?? { name: skill.startsWith('plan:') ? `Plan: ${skill.slice(5)}` : cap(skill), unit: '', best: 'none' as const };
    const scores = es.map((e) => e.score).filter((x): x is number => typeof x === 'number');
    return { skill, name: meta.name, count: es.length, streak: st.current, longest: st.best, today: st.today, best: meta.best === 'max' && scores.length ? Math.max(...scores) : null, unit: meta.unit, last: es.map((e) => e.on).sort().pop()! };
  }).sort((a, b) => b.streak - a.streak || b.count - a.count);
}
export function progressLine(r: SkillRow): string {
  return `${r.name}: ${r.streak ? `${r.streak} day${r.streak === 1 ? '' : 's'} in a row${r.today ? '' : ' (do one today to keep it)'}` : 'no run right now'}, longest ${r.longest}; ${r.count} session${r.count === 1 ? '' : 's'}${r.best !== null ? `; best ${r.best}${r.unit ? ` ${r.unit}` : ''}` : ''}`;
}
export const lastDays = (today: string, n: number): string[] => Array.from({ length: n }, (_, i) => addDays(today, -i));
/** Any practice at all, as one run of days. */
export function overall(log: LogEntry[], today: string): { current: number; best: number; today: boolean } {
  let s: Streak = emptyStreak();
  for (const e of [...log].sort((a, b) => a.on.localeCompare(b.on))) s = markDay(s, e.on);
  return streakOf(s, today);
}
/** “did my guitar practice” → “guitar”; “just finished typing” → “typing”. */
export function doneSkill(words: string): string {
  let t = clean(words).toLowerCase().replace(/[.!?]+$/, '');
  t = t.replace(/^(?:i\s+)?(?:just\s+)?(?:did|done|do|finished|completed|log(?:ged)?|practi[sc]ed|practi[sc]e)(?:\s+|$)/, '').replace(/^(?:my|the|some|a|an)\s+/, '');
  for (let i = 0; i < 2; i++) t = t.replace(/\s+(?:practice|practise|session|drill|test|today|again|for today)$/, '');
  return clean(t);
}
/** A skill's name as it is logged: his own word kept short ("Guitar" → guitar), the known ones by their id. */
export function skillId(words: string): string {
  const w = clean(words).toLowerCase().replace(/[^a-z0-9 :'-]/g, '');
  const known: [string, RegExp][] = [
    ['words', /^(?:words?|vocab\w*|language|languages|spanish|french|german|italian|portuguese|polish|arabic|mandarin|chinese)$/],
    ['review', /^(?:review|deck|flash ?cards?|cards?)$/],
    ['draw', /^(?:draw\w*|sketch\w*|trace)$/],
    ['typing', /^(?:typing|typing test|keyboard)$/],
    ['hand', /^(?:hand|handwriting|writing)$/],
    ['readfast', /^(?:readfast|speed[- ]?read\w*|reading)$/],
    ['memory', /^(?:memory|memory drill)$/],
    ['maths', /^(?:maths?|mental maths?|arithmetic|sums)$/],
    ['spelling', /^(?:spelling|spellings)$/],
    ['firstaid', /^(?:first ?aid|firstaid)$/],
    ['converse', /^(?:converse|conversation)$/],
  ];
  const hit = known.find(([, re]) => re.test(w));
  return hit ? hit[0] : w.replace(/\s+/g, '-').slice(0, 30);
}
/** Strokes from a tool argument: lists of [x, y] on the 0–100 square, at most 3,000 points in all; anything else is dropped. */
export function strokesOf(v: unknown): Stroke[] {
  if (!Array.isArray(v)) return [];
  let n = 0;
  const out: Stroke[] = [];
  for (const s of v.slice(0, 80)) {
    if (!Array.isArray(s)) continue;
    const pts: Stroke = [];
    for (const p of s) {
      if (n >= 3000) break;
      if (Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))) {
        pts.push([Math.max(0, Math.min(100, Number(p[0]))), Math.max(0, Math.min(100, Number(p[1])))]);
        n++;
      }
    }
    if (pts.length) out.push(pts);
  }
  return out;
}
/** Numbers from a tool argument, a blank or a word kept as a gap (NaN) so the places stay. */
export const numbersOf = (v: unknown, max = 120): number[] => (Array.isArray(v) ? v.slice(0, max).map((x) => (x === null || x === '' || typeof x === 'boolean' ? NaN : Number(x))) : []);

// ---------------------------------------------------------------- the phone's own phrases

export type LearningView = 'words' | 'typing' | 'draw' | 'maths' | 'memory' | 'hand' | 'readfast' | 'firstaid' | 'progress' | 'spelling';
/** What the phone answers by opening the sheet at the right page, with no model (assistant/phrases.ts). */
export function learningAsked(text: string): { view: LearningView; lang?: LangId; shape?: string } | null {
  const t = text.trim().replace(/[’‘]/g, "'").replace(/[?!.]+$/, '');
  const names = LANGS.map((l) => l.name.toLowerCase()).join('|') + '|chinese';
  const w = new RegExp(`^(?:(?:teach me|give me|show me|learn) )?(?:ten|10) (?:new )?(?:(${names}) words|words (?:in|of) (${names}))(?: (?:today|a day))?$|^(?:(?:the|today's|my) )?(?:(${names}) )?word(?:s)? of the day$`, 'i').exec(t);
  if (w) return { view: 'words', ...(langOf(w[1] ?? w[2] ?? w[3] ?? '') ? { lang: langOf(w[1] ?? w[2] ?? w[3] ?? '')!.id } : {}) };
  if (/^(?:(?:start|take|do|give me|run) )?(?:a |the |my )?typing (?:test|speed test|practice)$|^(?:test my typing|how fast do i type)$/i.test(t)) return { view: 'typing' };
  // (other features' phrases also take "typing test"; "a words per minute test" is this pack's own door to the same test)
  if (/^(?:(?:start|take|do|give me|run) )?(?:a |the |my )?(?:wpm|words[- ]per[- ]minute|words a minute) (?:test|check)$|^(?:test my wpm|how many words a minute (?:do|can) i type)$/i.test(t)) return { view: 'typing' };
  if (/^(?:(?:start|do|give me|run) )?(?:a |my |the |today's )?(?:daily )?(?:mental )?maths (?:drill|practice|test|quiz)$|^(?:mental maths|quick maths)$/i.test(t)) return { view: 'maths' };
  if (/^(?:(?:start|do|give me|run) )?(?:a |my )?memory (?:drill|test|game|training)$|^test my memory$/i.test(t)) return { view: 'memory' };
  const tr = /^trace (?:the |a |an )?([a-z ]{2,20})$/i.exec(t);
  if (/^(?:(?:start|open|join) )?(?:a |the )?drawing class$|^draw with me$/i.test(t)) return { view: 'draw' };
  if (tr && LESSONS.some((l) => new RegExp(`\\b${l.id}\\b`).test(tr[1]!.toLowerCase()))) return { view: 'draw', shape: tr[1]!.trim() };
  if (/^(?:test my handwriting|handwriting (?:test|check|practice)|how (?:neat|legible) is my handwriting)$/i.test(t)) return { view: 'hand' };
  if (/^(?:speed[- ]?read(?:ing)?(?: (?:test|practice|drill))?|read faster|help me read faster)$/i.test(t)) return { view: 'readfast' };
  if (/^(?:first aid|first aid (?:drill|practice|quiz|test)|practi[sc]e first aid)$/i.test(t)) return { view: 'firstaid' };
  if (/^(?:spelling (?:drill|practice|test|quiz)|test my spelling)$/i.test(t)) return { view: 'spelling' };
  if (/^(?:how am i doing|my (?:learning )?(?:streaks?|progress)|learning progress|show my streaks?)$/i.test(t)) return { view: 'progress' };
  return null;
}
