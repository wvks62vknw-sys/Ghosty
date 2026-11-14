/**
 * WORDGUESS (the guess-the-hidden-word-in-tries genre). Options the board reads from GameConfig.options:
 *   words:  string[] (the answers to draw from, all one length; default the built-in five-letter list)
 *   tries:  number (3 to 8, default 6)
 *   daily:  boolean (one word for the whole day, default true)
 *   strict: boolean (a guess must be in the word list; default false, any real-looking word of letters is taken)
 * Each guess marks every letter: 'hit' (right letter, right place), 'near' (in the word elsewhere) or 'miss'. Repeated
 * letters are marked fairly: a letter is only 'near' as many times as the word still has it unmatched.
 */
import { pick, rng } from './rng';

export type Mark = 'hit' | 'near' | 'miss';

export const WORDS5 = (
  'about above actor acute adapt admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone ' +
  'along alter amber angle angry ankle apple apply apron arena argue arise armed aroma arrow aside asset atlas audio avoid ' +
  'awake award aware bacon badge baker basic basin batch beach beard beast begin being bench berry birth black blade blame ' +
  'blank blast blaze blend bless blind block bloom board boast bonus boost booth brain brake brand brass brave bread break ' +
  'brick bride brief bring broad brook brown brush build bunch burst cabin cable camel candy canoe cargo carry catch cause ' +
  'cedar chain chair chalk charm chart chase cheap check cheek cheer chess chest chief child chill choir chord civic claim ' +
  'clash class clean clear clerk click cliff climb clock close cloth cloud coach coast cocoa coral couch cough count court ' +
  'cover craft crane crash cream creek crisp crowd crown crumb crust cycle daily dairy dance delta dense depth diary dough ' +
  'draft drain drama dream dress drift drink drive eager eagle early earth eight elbow elder empty enjoy enter equal error ' +
  'event exact extra fable faint fairy faith false feast fence ferry fever field fifty final flame flash fleet float flock ' +
  'flood floor flour fluid flute focus force forge forty forum frame fresh front frost fruit funny gauge giant glass gleam ' +
  'globe glory glove grace grain grand grape graph grass great green greet grill groan group grove guard guess guest guide ' +
  'habit happy harsh heart heavy hedge hello hinge hobby honey horse hotel house human humid humor ideal image inbox index ' +
  'inner input irony ivory jelly jewel joint judge juice jumbo kayak knife knock label lance large laser later laugh layer ' +
  'learn lemon level light lilac limit linen lodge logic loose lucky lunar lunch magic major maple march marsh match mayor ' +
  'medal melon mercy merry metal meter minor model money month moral motor mount mouse mouth movie music naval nerve never ' +
  'night noble noise north novel nurse oasis ocean offer olive onion opera orbit order organ other otter outer owner paint ' +
  'panel paper party pasta patch peace peach pearl pedal penny piano piece pilot pitch pizza place plain plane plant plate ' +
  'plaza plumb point polar pouch power press price pride prime print prize proof proud pulse punch pupil quiet quilt quote ' +
  'radar radio rally ranch range rapid raven reach ready realm relax reply ridge rifle right rigid river roast robin robot ' +
  'rocky rough round route royal rural sable salad sauce scale scarf scene scent scone scout screw seven shade shake shape ' +
  'share shark sharp sheep shelf shell shine shirt shock shore short shout sight silky skill skirt slate sleep slice slide ' +
  'slope smart smile smoke snack snail solar solid sound south space spade spare spark spell spend spice spine spoon sport ' +
  'squad stack staff stage stair stamp stand start steam steel steep stick still stone stool storm story stove straw strip ' +
  'study style sugar suite sunny sweet swift swing sword table taste teach thank theme thick thumb tiger toast token topic ' +
  'torch total touch tower trace track trade trail train treat trend trial tribe trick truck trunk trust truth tulip tutor ' +
  'twist ultra uncle under union unity upper urban usual valid value vapor vault verse video vigil viola visit vital vivid ' +
  'vocal voice wagon waltz watch water whale wheat wheel white whole width woman world worth wrist yacht yeast young youth zebra'
).split(' ').filter((w) => w !== 'humor' && w !== 'vapor' && w !== 'meter');

/** Mark a guess against the answer, fairly for repeated letters. */
export function marks(guess: string, answer: string): Mark[] {
  const g = guess.toLowerCase();
  const a = answer.toLowerCase();
  const out: Mark[] = Array(g.length).fill('miss');
  const left: Record<string, number> = {};
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) out[i] = 'hit';
    else left[a[i]!] = (left[a[i]!] ?? 0) + 1;
  }
  for (let i = 0; i < g.length; i++) {
    if (out[i] === 'hit') continue;
    const ch = g[i]!;
    if (left[ch]) {
      out[i] = 'near';
      left[ch]--;
    }
  }
  return out;
}

/** The answers in play: the option's words of one length (lower case), or the built-in list. */
export function wordsFrom(opt: string[]): string[] {
  const clean = opt.map((w) => w.toLowerCase()).filter((w) => /^[a-z]{3,8}$/.test(w));
  if (clean.length >= 3) {
    const len = clean[0]!.length;
    const same = clean.filter((w) => w.length === len);
    if (same.length >= 3) return same;
  }
  return WORDS5;
}

export const answerFor = (words: readonly string[], seed: number): string => pick(rng(seed), words);

/** Whether a guess may be played: right length, letters only, and in the list when strict. */
export function allowed(guess: string, words: readonly string[], strict: boolean): '' | 'short' | 'letters' | 'unknown' {
  const g = guess.toLowerCase();
  const len = words[0]?.length ?? 5;
  if (g.length !== len) return 'short';
  if (!/^[a-z]+$/.test(g)) return 'letters';
  if (strict && !words.includes(g)) return 'unknown';
  if (!strict && !/[aeiouy]/.test(g)) return 'unknown';
  return '';
}

/** Each key's best mark so far (hit beats near beats miss), for the keyboard. */
export function keyMarks(guesses: readonly string[], answer: string): Record<string, Mark> {
  const rank: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };
  const out: Record<string, Mark> = {};
  for (const g of guesses) {
    marks(g, answer).forEach((m, i) => {
      const ch = g[i]!.toLowerCase();
      if (!out[ch] || rank[m] > rank[out[ch]!]) out[ch] = m;
    });
  }
  return out;
}

/** Fewer tries is more: solved in one is 600, each try after costs 100. */
export const score = (triesUsed: number, maxTries: number): number => Math.max(50, (maxTries + 1 - triesUsed) * 100);
