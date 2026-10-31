/**
 * What the owner means, read from his own words with no model at all: deterministic, instant and free (phrase families and
 * a light allowance for typos). Shared by the phone (typed and spoken stops, session.ts) and the brain (Telegram).
 *
 * `stopIntent` (OWNER-ISSUES 70a: "i should be able to tell him shut the fuck up and then he does exactly that"): the whole
 * message says stop — "enough", "leave it", "not now", "zip it", "shush", "stand down", with his name, swearing, "please",
 * typos and trailing words — and nothing else. "Stop the timer", "don't stop" and "it stopped raining" are not stops. It
 * is never answered; `harsh` (a "shut up", a swear) is a harsh dismissal, which leaves him subdued (mood.ts).
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
