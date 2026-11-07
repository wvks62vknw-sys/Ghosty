/**
 * What the owner means, read from his own words with no model at all: deterministic, instant and free (phrase families and
 * a light allowance for typos). Shared by the phone (typed and spoken stops, session.ts) and the brain (Telegram).
 *
 * `stopIntent` (OWNER-ISSUES 70a: "i should be able to tell him shut the fuck up and then he does exactly that"): the whole
 * message says stop — "enough", "leave it", "not now", "zip it", "shush", "stand down", with his name, swearing, "please",
 * typos and trailing words — and nothing else. "Stop the timer", "don't stop" and "it stopped raining" are not stops. It
 * is never answered; `harsh` (a "shut up", a swear) is a harsh dismissal, which leaves him subdued (mood.ts).
 *
 * `raising` (OWNER-ISSUES 64 RAISING HIM, 69c): praise ("good boy", "well done", "proud of you"), a telling-off ("that was
 * wrong", "out of order", "useless") and a standing rule about how he talks ("too long", "never call me that", "always tell
 * me the price first"), each recognised the same way: the brain records them (selftrain/ ratings, conduct lessons).
 */

/** Words that dress a stop without changing it: his name, "please", "now", "just", "mate", "for god's sake". */
const FILLER = new Set(
  "ghosty ghost mate bro man pal buddy dude kiddo son lad boss please pls plz just now right ok okay oi oy hey alright already will would could can you u ya yeah yes oh ah ahh for sake god's gods goodness christ jesus seriously honestly again then so and ffs omg bloody fucking fuckin effing frigging damn dammit goddamn".split(' '),
);

/** Slang and joined-up forms, read as the words they stand for. */
const SPELLED: Record<string, string> = {
  enuff: 'enough', enuf: 'enough', nuff: 'enough', shutup: 'shut up', shuddup: 'shut up', shaddap: 'shut up', shaddup: 'shut up', shurrup: 'shut up', shuttup: 'shut up', stfu: 'shut up',
  nevermind: 'never mind', nvm: 'never mind', thats: "that's", talkin: 'talking', speakin: 'speaking', stahp: 'stop', stawp: 'stop', uo: 'up', yp: 'up', upp: 'up', ti: 'it', iy: 'it',
};

/** The words a stop is made of: a typo of one (one letter off, or two swapped) is read as it. */
const VOCAB = ['stop', 'shut', 'enough', 'quiet', 'talking', 'speaking', 'silence', 'cancel', 'shush', 'leave', 'never', 'stand'];
/** Real words one letter from those, never "corrected" into a stop ("shop", "step", "quite", "cancer"). */
const REAL = new Set('step steps shop shops stomp stoop slop swop atop spot quite quit shot shit shout shun cancer leaves leafe lever fever sever stank'.split(' '));

/** Every way the whole message can say stop (after the dressing is gone). `?`: a question mark makes these a question, not a stop. */
const STOP = new RegExp(
  '^(?:' +
    [
      'stop(?: (?:it|that|this|there|talking|speaking))?',
      "(?:that's |that is )?enough(?: (?:of that|of this|talking))?",
      'shut (?:up|it|(?:your|ur) (?:mouth|face|trap|gob))',
      'leave it(?: (?:there|out))?',
      'not_now',
      'drop it',
      'zip it',
      '(?:be |keep |go )?quiet(?: down)?',
      'quieten down',
      'be silent',
      'silence',
      's+h+',
      'shush',
      'hush',
      'cancel',
      'stand down',
      'never mind',
      'pipe down',
      'button it',
      'can_it',
      'give it a rest',
      'give over',
      'put a sock in it',
      'knock it off',
      'cut it out',
      'pack it in',
      'quit it',
      'wind (?:your|ur) neck in',
      "that'll do",
      'no more',
      'go away',
      'leave me alone',
      '(?:fuck|piss|bugger|sod) off',
      'get lost',
    ].join('|') +
    ')$',
);
/** Families that are only a stop when they are not asked ("enough?", "stop?" are questions). */
const ASKABLE = /^(?:stop|(?:that's |that is )?enough|quiet|silence|cancel|not_now|no more|never mind|stand down)$/;
/** A harsh dismissal: a "shut up", telling him to go, or a swear anywhere in it. */
const HARSH_PHRASE = /^(?:shut |go away|leave me alone|(?:fuck|piss|bugger|sod) off|get lost|wind )/;
const SWEAR = /\b(?:fuck\w*|f+k+|ffs|stfu|shite?|bloody|piss\w*|bollocks|twat|wanker|crap|damn\w*|bastard|arse\w*|bugger|sod)\b/;

/** One letter off (a swap of two neighbours counts as one). */
function oneOff(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff = [...a].map((c, i) => (c === b[i] ? -1 : i)).filter((i) => i >= 0);
    return diff.length === 1 || (diff.length === 2 && diff[1] === diff[0]! + 1 && a[diff[0]!] === b[diff[1]!] && a[diff[1]!] === b[diff[0]!]);
  }
  const [s, l] = a.length < b.length ? [a, b] : [b, a];
  for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
  return false;
}

/** A word as the stop families know it: slang spelled out, a typo of a stop word read as it. */
function word(w: string): string {
  if (SPELLED[w]) return SPELLED[w]!;
  if (w.length < 4 || REAL.has(w) || FILLER.has(w) || VOCAB.includes(w)) return w;
  return VOCAB.find((v) => oneOff(w, v)) ?? w;
}

/**
 * The owner said stop, by intent: `{ harsh }` when he did, else null. Only his own words are ever read here (the phone's
 * field and microphone, his Telegram chat), so a stop is owner-only; it is absolute — whatever he was doing or arguing.
 */
export function stopIntent(text: string): { harsh: boolean } | null {
  const raw = String(text ?? '').toLowerCase().replace(/[’‘]/g, "'").trim();
  if (!raw || raw.length > 80) return null;
  const asked = /\?\s*$/.test(raw);
  const harsh = SWEAR.test(raw);
  let t = raw
    .replace(/🤫/gu, ' shh ')
    .replace(/🤐/gu, ' zip it ')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\b(?:the (?:fuck|hell|heck|f|frick)|for (?:fuck'?s?|god'?s?|pete'?s?|christ'?s?) sake)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  t = t.split(' ').map(word).join(' ').replace(/\b(be|keep|go) quite\b/g, '$1 quiet');
  t = t.replace(/\bnot (?:right )?now\b/g, 'not_now').replace(/^can it$/, 'can_it').replace(/^i (?:said|told you) /, '');
  const words = t.split(' ').filter((w) => w && !FILLER.has(w));
  if (!words.length) return null;
  // "stop stop stop", "shut up shut up": one stop said again
  let said = words.join(' ');
  for (const n of [2, 3]) {
    if (words.length % n) continue;
    const part = words.slice(0, words.length / n).join(' ');
    if (Array.from({ length: n }, (_, i) => words.slice((i * words.length) / n, ((i + 1) * words.length) / n).join(' ')).every((p) => p === part)) said = part;
  }
  if (!STOP.test(said) || (asked && ASKABLE.test(said))) return null;
  return { harsh: harsh || HARSH_PHRASE.test(said) };
}

// ---------------------------------------------------------------- carrying on, and ending a conversation (BRIEF-TALK-1A)

/** Words that dress a "go on" or a "bye" without changing it: his name, sorry, thanks, yes or no, a filler sound. */
const DRESS = new Set('ghosty ghost mate bro man pal buddy boss sorry soz apologies please pls ok okay oh ah um uh erm er hmm well right alright yeah yes yep no nope so anyway anyways thanks thx cheers ta just'.split(' '));
const plainWords = (text: string): string[] =>
  String(text ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\b(?:my bad|sorry about that|sorry for that|excuse me|thank you(?: very much)?|thanks a lot)\b/g, ' ')
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
/** The message without the dressing at either end ("sorry, go on mate" → "go on"). */
function undressed(text: string): string {
  const w = plainWords(text);
  while (w.length && DRESS.has(w[0]!)) w.shift();
  while (w.length && DRESS.has(w[w.length - 1]!)) w.pop();
  return w.join(' ');
}

/** Every way the whole message asks him to carry on with what he was saying. */
const CARRY = new RegExp(
  '^(?:' +
    [
      "(?:do |you can )?(?:go on|carry on|continue|keep going|keep talking|resume|go ahead and finish)(?: then| with it| with that| what you were saying)?(?: i'?m listening)?",
      'and(?: then| what else| after that)?',
      'then(?: what)?',
      'what (?:then|next|else)',
      "(?:you were saying|as you were saying|what were you saying|what were you going to say|where were you|where was i)",
      'finish (?:what you were saying|that|it|your sentence|the sentence|your point)',
      'pick up where you left off',
      'back to what you were saying',
      "i'?m (?:still )?listening(?: go on| carry on)?",
      'say (?:the rest|that again from where you stopped)',
      'the rest',
    ].join('|') +
    ')$',
);

/**
 * He wants the reply he cut off carried on, not a new answer (BRIEF-TALK-1A 2; STARS 2): "go on", "and then?", "sorry,
 * continue", "you were saying", "finish what you were saying" — the whole message, dressed or not. The phone only reads it
 * when a reply he cut off is still the latest; anywhere else these are ordinary words for the brain.
 */
export function continueIntent(text: string): boolean {
  if (String(text ?? '').length > 80) return false;
  const b = undressed(text);
  return !!b && CARRY.test(b);
}

/** Every way the whole message ends a spoken conversation. */
const CLOSE = new RegExp(
  '^(?:' +
    [
      "that(?:'s| is| will be|'ll be) (?:all|it|everything)(?: for (?:now|today|tonight))?",
      "(?:that'?s )?all (?:done|good)(?: for now)?",
      '(?:bye|goodbye|good bye)(?: bye)?(?: for now| then| now)?',
      'bye bye',
      '(?:see|catch) (?:you|ya|u)(?: later| soon| tomorrow| in a bit)?',
      '(?:talk|speak) (?:to you )?(?:later|soon|tomorrow)',
      'ta ra|tara|cheerio|ttyl',
      '(?:good ?)?night(?: night)?|nighty night|night then',
      "(?:we'?re|i'?m|we are|i am) (?:done|finished)(?: here| for now| talking)?",
      "that'?s me(?: done)?",
      '(?:you can )?stop listening(?: now)?',
      'end (?:the |this )?(?:conversation|call|chat)',
      'hang up',
      "i'?ll (?:talk|speak) to you (?:later|soon|tomorrow)",
    ].join('|') +
    ')$',
);

/**
 * He is ending a spoken conversation (BRIEF-TALK-1A 4; STARS 10): "that's all", "bye", "see you later", "good night", "stop
 * listening", "we're done" — the whole message, dressed or not ("thanks, that's all", "okay bye Ghosty"). Read only in a
 * voice conversation; typed, the same words are a message like any other.
 */
export function endIntent(text: string): boolean {
  if (String(text ?? '').length > 80) return false;
  const b = undressed(text);
  return !!b && CLOSE.test(b);
}

// ---------------------------------------------------------------- raising him

/**
 * Raising him (OWNER-ISSUES 64 RAISING HIM, 69c): a reward, a telling-off and a standing rule, from the owner's words.
 * `kind` and `weight` (1–3) are recorded on his last reply for the weekly training (selftrain/); `rule` is a conduct lesson
 * in the owner's own words ("too long", "never call me that", "always tell me the price first"); `rest` is whatever else
 * the message asks, answered as usual ('' when the message was only this).
 */
export interface Raising {
  kind?: 'reward' | 'discipline';
  weight?: 1 | 2 | 3;
  rule?: string;
  /** The rule is about length ("too long", "shorter"). */
  length?: boolean;
  rest: string;
}

/** Praise, by strength: 1 "good", 2 "good boy", "well done", "spot on", 3 "proud of you", "legend". */
const REWARD: [RegExp, 1 | 2 | 3][] = [
  [/^(?:(?:i'?m |i am )?(?:so |really )?proud of you|(?:you(?:'re| are)? )?(?:an? |the )?(?:absolute )?(?:legend|genius|best)|love you|superb|outstanding)$/, 3],
  [/^(?:good (?:boy|lad|man|job|work|stuff|one)|well done|nice (?:one|work|job)|(?:that'?s|that is) (?:it|the one|more like it|right|perfect|spot on)|spot on|bang on|(?:you )?nailed it|smashed it|love (?:it|that)|brilliant|excellent|top (?:man|work|job)|much better|better|exactly right|perfect answer)$/, 2],
  [/^(?:good|nice|great|perfect|exactly|correct|lovely|ace|class|mint|sweet|brill)$/, 1],
];
/** A telling-off, by strength: 1 "wrong", 2 "bad", "out of order", 3 "useless", "what the fuck was that". */
const DISCIPLINE: [RegExp, 1 | 2 | 3][] = [
  [/^(?:you(?:'re| are) )?(?:(?:fucking|bloody|so|absolutely) )?(?:useless|pathetic|terrible|awful|stupid|garbage|disgraceful)$|^(?:wtf|what the (?:fuck|hell) (?:was that|is this|is that))$/, 3],
  [/^(?:bad(?: boy| lad| ghosty)?|naughty|(?:that(?:'s| is| was) )?(?:not ok(?:ay)?|out of order|out of line|unacceptable|rubbish|poor|sloppy|not good enough)|(?:that was|that'?s|that is) wrong|(?:don'?t|never) (?:ever )?do that again|what was that|behave(?: yourself)?|do better|not cool)$/, 2],
  [/^(?:(?:that(?:'s| is| was)|it(?:'s| is| was)) )?(?:wrong|not quite|not right|not great|not good)$|^meh$/, 1],
];
/** "Thanks", "ok", "mate": a clause that adds nothing to what the message asks. */
const NOTHING = /^(?:thanks|thank you|cheers|ta|ok|okay|right|yes|yeah|yep|no|nope|and|but|so|now|then)?$/;

/** What a standing rule is about: how he talks and acts (not a task: "always remind me", "don't forget the milk"). */
const CONDUCT = /\b(?:say(?:ing)?|said|call(?:ing)?|use|using|talk(?:ing)?|speak(?:ing)?|answer(?:ing)?|repl(?:y|ying)|tell(?:ing)?|giv(?:e|ing)|ask(?:ing)?|writ(?:e|ing)|start(?:ing)?|end(?:ing)?|put(?:ting)?|add(?:ing)?|swear(?:ing)?|apologi[sz](?:e|ing)|explain(?:ing)?|mention(?:ing)?|list(?:ing)?|repeat(?:ing)?|guess(?:ing)?|l(?:ie|ying)|interrupt(?:ing)?|rambl(?:e|ing)|waffl(?:e|ing)|read(?:ing)?|show(?:ing)?|suggest(?:ing)?|recommend(?:ing)?|offer(?:ing)?|emojis?|bullets?|headings?|lists|do (?:that|this|it)|that again)\b/;
/** His length: "too long", "shorter", "get to the point". */
const LENGTH = /^(?:(?:that(?:'s| is| was)|it(?:'s| is| was)|way|far|a bit|bit|much|so) )*(?:too (?:long|much|wordy|waffly|chatty|formal|stiff)|(?:shorter|briefer|less words)(?: please)?|less (?:waffle|rambling|chat|text)|get to the point|keep it (?:short|brief)|tl ?;? ?dr|stop (?:waffling|rambling)|you(?:'re| are) (?:waffling|rambling))$/;

/** A clause as the families read it: his name and the dressing gone. */
const bare = (c: string) =>
  c
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' ;]+/gu, ' ')
    .replace(/(?:^|\s)(?:ghosty|ghost|mate|bro|man|pal|buddy|kiddo|lad|son|boss|very|really|just|honestly|seriously|bloody|fucking|fuckin|effing|absolutely|totally|completely)(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The strongest family a clause belongs to, or 0. */
const strength = (c: string, fam: [RegExp, 1 | 2 | 3][]): 0 | 1 | 2 | 3 => fam.find(([re]) => re.test(c))?.[1] ?? 0;

/** A standing rule about his conduct, in the clause as he said it. */
const isRule = (b: string): boolean =>
  LENGTH.test(b) ||
  (/^(?:always|never|don'?t ever|do not ever|from now on|in future|next time|no more|stop|quit)\b/.test(b) && CONDUCT.test(b)) ||
  (/^(?:don'?t|do not)\b/.test(b) && /\b(?:that|this)\b/.test(b) && CONDUCT.test(b)) ||
  /^(?:(?:don'?t|do not) (?:ever )?)?call me\b/.test(b);

/** A reply that asked him something or offered something: "good" or "great" after it is an answer, not praise. */
const OFFERED = /\?|\b(?:i can|i could|shall i|should i|want me|i'll|would you like|do you want)\b/i;

/**
 * Praise, a telling-off and a standing rule in the owner's words, with no model. `last`: his own last reply (after a
 * question or an offer, a bare "good" is an answer). null when the message holds none of them, or is a stop.
 */
export function raising(text: string, last = ''): Raising | null {
  const raw = String(text ?? '').trim();
  if (!raw || raw.length > 400 || stopIntent(raw)) return null;
  const swore = SWEAR.test(raw.toLowerCase());
  const clauses = raw
    .replace(/^(from now on|in future|next time),\s*/i, '$1 ')
    .split(/(?<=[,.!?;:])\s+|\s+[-–—]\s+|(?<!\bfrom)\s+(?=(?:now|but|and now|so now)\s)/i)
    .map((c) => c.trim())
    .filter(Boolean);
  let reward = 0;
  let discipline = 0;
  let rule = '';
  let length = false;
  const rest: string[] = [];
  for (const c of clauses) {
    const b = bare(c);
    const r = strength(b, REWARD);
    const d = strength(b, DISCIPLINE);
    // a rule leads what he says ("too long", "never call me that, and …"): one deep in a longer message ("learn … Rule:
    // always use arr[i]!") is part of that message, not a rule about how I talk
    const ruled = !rest.length && raw.length <= 200 && isRule(b);
    if (ruled) {
      rule = c.replace(/[.!]+$/, '');
      length ||= LENGTH.test(b);
    }
    if (d) discipline = Math.max(discipline, d);
    else if (r) reward = Math.max(reward, r);
    else if (!ruled && !NOTHING.test(b)) rest.push(c);
  }
  // "good" or "great" after his question or offer is an answer (yes), not praise; a bare "Good." leading into the next thing
  // ("Good. Now what about the trains?") is a pivot, not praise: the weakest praise counts only when it is the whole message
  if (reward === 1 && !discipline && !rule && (rest.length || OFFERED.test(last))) return null;
  if (!reward && !discipline && !rule) return null;
  // a telling-off wins over praise in the same breath; a swear makes it sharper
  const kind = discipline ? 'discipline' : reward ? 'reward' : undefined;
  const weight = (discipline ? Math.min(3, discipline + (swore ? 1 : 0)) : reward) as 1 | 2 | 3;
  return { ...(kind ? { kind, weight } : {}), ...(rule ? { rule: rule.slice(0, 160), length } : {}), rest: rest.join(' ').trim() };
}

// ---------------------------------------------------------------- reading a book to him (BRIEF-LIBRARY-READER 4)

/**
 * What he asks of a book, by words, with no model (the phone knows the shelf and his place in each book):
 *  - `book`: "read me The Hobbit", "can you read the lighthouse keeper to me", "read chapter 3 of the hobbit": `words` is the
 *    title as he said it (matched loosely against the shelf by `titleMatch`), with a chapter or page where he named one, and
 *    `plain` when the words could only be a book (not "the news", "my emails", "this page": those stay the brain's);
 *  - `resume`: "carry on reading", "where were we", "keep reading", "back to the book", "read me something";
 *  - `chapter` / `page`: "read chapter 3", "read from page 40" (the book open now, or the last one he read);
 *  - `only`: "just this chapter" (read to the chapter's end, then stop and say where);
 *  - `stop`: "stop reading", "close the book" (stop and say the page).
 * `only` on a chapter: "just chapter 3", "read chapter 3 only".
 */
export type ReadingAsk =
  | { kind: 'book'; words: string; plain: boolean; chapter?: number; page?: number; only?: boolean }
  | { kind: 'resume' }
  | { kind: 'chapter'; n: number; only?: boolean }
  | { kind: 'page'; n: number }
  | { kind: 'only' }
  | { kind: 'stop' };

const NUMBER_WORDS = 'zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty'.split(' ');
const ORDINALS = 'zeroth first second third fourth fifth sixth seventh eighth ninth tenth eleventh twelfth thirteenth fourteenth fifteenth sixteenth seventeenth eighteenth nineteenth twentieth'.split(' ');
/** "3", "three", "third", "3rd" → 3; null when it is not a number he would say. */
function numberOf(w: string): number | null {
  const t = w.toLowerCase().replace(/(?<=\d)(?:st|nd|rd|th)$/, '');
  if (/^\d{1,4}$/.test(t)) return Number(t);
  const i = NUMBER_WORDS.indexOf(t);
  if (i >= 0) return i;
  const j = ORDINALS.indexOf(t);
  return j >= 0 ? j : null;
}
const NUM = `(\\d{1,4}(?:st|nd|rd|th)?|${[...NUMBER_WORDS, ...ORDINALS].join('|')})`;

/** The message as the reading families read it: lower case, plain apostrophes, his name and politeness gone at either end. */
function readingWords(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”"]/g, '')
    .replace(/[.!?,;:]+$/g, '')
    .replace(/^(?:hey |ok |okay |oi |right |so )?(?:ghosty|ghost)[, ]+/, '')
    .replace(/^(?:please |can you |could you |will you |would you |can u |pls )+/, '')
    .replace(/(?:,? (?:please|pls|ghosty|mate|thanks|thank you))+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Words after "read me" that are anything but a book: the brain's, as ever (news, his messages, what is on the screen…). */
const NOT_BOOK = /^(?:the |my |this |that |your |a |an |some |today'?s |tonight'?s |latest |last |new )*(?:news|headlines?|weather|forecast|e-?mails?|mail|messages?|texts?|notifications?|inbox|agenda|calendar|diary|schedule|reminders?|to-?do(?: list)?|lists?|shopping list|label|sign|menu|receipt|screen|page|paragraph|sentence|line|word|words|reply|answer|summary|results?|score|scores|lyrics|horoscope|stars|time|joke|jokes|poem|poems|riddle|recipe|instructions|article|post|tweet|link|website|site|notes?|letter|card|clue|question|this|that|it|everything|all of it|what (?:you|it|they|he|she) (?:said|says|wrote|write)|what'?s (?:on|written)(?: .*)?)(?: (?:out|again|back|aloud|out loud|to me|for me))*$/;
/** Words that ask for whatever book he is in: "read me something", "read me a story", "read me more". */
const ANY_BOOK = /^(?:something|anything|a book|my book|the book|my story|a story|a bit|a little|some more|more|on|it again|the rest|the next bit)$/;

/** What he asks of a book, by words; null when it is not about reading a book to him (the brain answers it as ever). */
export function readingIntent(text: string): ReadingAsk | null {
  if (String(text ?? '').length > 140) return null;
  const t = readingWords(text);
  if (!t) return null;
  // stop: "stop reading", "stop the book", "close the book", "that's enough reading", "no more reading"
  if (/^(?:(?:ok |okay |right )?(?:stop|pause|quit|end|finish) (?:reading|the book|the story)(?: now| for now| there| here)?|close the book|put the book down|(?:that'?s |that is )?enough reading(?: for (?:now|today|tonight))?|no more reading(?: for (?:now|today|tonight))?|(?:let'?s )?stop there)$/.test(t)) return { kind: 'stop' };
  // just this chapter: read to the chapter's end, then stop
  if (/^(?:(?:read )?(?:just|only) (?:this|the|to the end of (?:this|the)) chapter|(?:read )?(?:to|till|until) the end of (?:this|the) chapter(?: then stop)?|stop at the end of (?:this|the) chapter|(?:just )?finish (?:this|the) chapter)$/.test(t)) return { kind: 'only' };
  // carry on: "carry on reading", "keep reading", "where were we", "back to the book", "continue the book"
  if (/^(?:(?:carry on|keep|go on|continue|resume|start|get back to|go back to) (?:reading|with the book|with the story|the book|the story)(?: (?:to me|for me|then|again|now))*|read on|(?:back|let'?s get back) to (?:the|my) book|where were we|where did we (?:get to|stop|leave off|leave it)|where was i in the book|where did i (?:get to|stop|leave off) in the book|pick up (?:the book )?where we (?:left off|stopped))$/.test(t)) return { kind: 'resume' };
  // a chapter or a page of the book in hand: "read chapter 3", "read me the third chapter", "read from page 40", "go to page 40"
  const only = /\b(?:just|only)\b/.test(t);
  const plainT = t.replace(/\b(?:just|only)\b ?/g, '').replace(/\s+/g, ' ').trim();
  const ch = new RegExp(`^(?:read|start|play|go to|jump to|skip to|turn to)(?: me| to me)?(?: from)?(?: (?:chapter|ch) ${NUM}| the ${NUM} chapter)(?: (?:of|from|in) (.+?))?(?: (?:to me|for me|aloud|out loud))*$`).exec(plainT);
  if (ch) {
    const n = numberOf(ch[1] ?? ch[2] ?? '');
    if (n !== null && n > 0) return ch[3] ? { kind: 'book', words: ch[3].trim(), plain: true, chapter: n, ...(only ? { only: true } : {}) } : { kind: 'chapter', n, ...(only ? { only: true } : {}) };
  }
  const pg = new RegExp(`^(?:read|start|start reading|carry on|go to|jump to|skip to|turn to)(?: me| to me)?(?: (?:from|at|on))? page ${NUM}(?: (?:of|from|in) (.+?))?(?: (?:to me|for me|aloud|out loud))*$`).exec(t);
  if (pg) {
    const n = numberOf(pg[1] ?? '');
    if (n !== null && n > 0) return pg[2] ? { kind: 'book', words: pg[2].trim(), plain: true, page: n } : { kind: 'page', n };
  }
  // a book by its name: "read me The Hobbit", "read the lighthouse keeper to me", "read aloud night walks", "start reading X"
  const bk = /^(?:read|reed|start reading|begin reading|read aloud|read out|carry on reading|continue reading|keep reading)(?: me| to me| us| aloud| out loud| out)?(?: (?:the book|my book|the novel|my novel|the story)(?: called| named))? (.+?)(?: (?:to me|for me|to us|aloud|out loud|again|tonight|now))*$/.exec(t);
  if (!bk) return null;
  const words = bk[1]!.trim();
  // "read about black holes", "read up on it", "read through this": a look-up, not a book
  if (!words || /^(?:about|up|up on|up about|into|through|over|between|around) /.test(words)) return null;
  if (ANY_BOOK.test(words)) return { kind: 'resume' };
  return { kind: 'book', words, plain: !NOT_BOOK.test(words) };
}

/** A title as the shelf's matching reads it: lower case, no punctuation, no "the", "a" or "an" in front. */
const titleKey = (s: string): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[’‘']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/^(?:the|a|an) /, '');

/**
 * The book on his shelf his words name, matched loosely as the jump bar matches (commands/registry.ts): the whole title, its
 * start, a part of it, every word he said starting a word of it, or (five letters or more) its letters in order, so a word
 * misheard by a letter still finds it. The best match wins; null when nothing is close enough. `score` 5 is the title exactly.
 */
export function titleMatch<T extends { title: string }>(words: string, books: T[]): { book: T; score: number } | null {
  const q = titleKey(words);
  if (q.length < 2) return null;
  const qWords = q.split(' ').filter((w) => w.length >= 2);
  const flat = q.replace(/ /g, '');
  let best: { book: T; score: number } | null = null;
  let ties = 0;
  for (const b of books) {
    const k = titleKey(b.title);
    if (!k) continue;
    let s = 0;
    if (k === q) s = 5;
    else if ((k.startsWith(q) && q.length >= 4) || (q.startsWith(k) && k.length >= 4)) s = 4;
    else if ((k.includes(q) && q.length >= 4) || (q.includes(k) && k.length >= 4)) s = 3;
    else if (qWords.length && qWords.every((w) => k.split(' ').some((kw) => kw.startsWith(w) || (w.length >= 5 && kw.startsWith(w.slice(0, -1)))))) s = 2;
    else if (flat.length >= 5) {
      let i = 0;
      for (const c of k.replace(/ /g, '')) if (c === flat[i]) i++;
      if (i === flat.length) s = 1;
    }
    if (!s) continue;
    if (!best || s > best.score) {
      best = { book: b, score: s };
      ties = 0;
    } else if (s === best.score) ties++;
  }
  // a loose match only counts when nothing else on the shelf is as close (two "letters in order" matches: ask, never guess)
  if (!best || (best.score <= 1 && ties > 0)) return null;
  return best;
}
