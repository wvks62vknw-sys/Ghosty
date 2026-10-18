/**
 * WORD GUESS (Wordle-style) on a small built-in list of five-letter words: green = right letter, right
 * place; yellow = in the word elsewhere; grey = not in it (repeated letters counted the way Wordle does).
 * Ghosty learns a guessing policy (guess.ts, the same learner as CODE BREAKER). The yardstick is the
 * information-gain guesser (the guess that is expected to tell the most), played exhaustively over every
 * secret word. He starts naive (the first word that still fits); mastery = how much of the gap between that
 * start (0%) and the yardstick (100%) he has closed. Levels grow the word list (30 → all).
 */
import { type Cell, finalLine, type Env, type Frame, type Game, type Learner, lvl, type Problem, rng, savedFor, type Verdict } from './core';
import { WORDS as WORDS_META } from './meta';
import { closed, GuessPolicy, type GuessSave, infoGain, naiveAvg, playAll, playOne, type Space, split, weighted } from './guess';

/** Common five-letter words, most common first (duplicates and anything not five letters are dropped below). */
const RAW = `about other which their there would these could first after where those being under never every while still great since
again place right think small large found often house world might three water point state month money story young night heard
light today order early start hours black voice field paper group power women child human words given based level among class
taken party leave whole known table cause white sense plant south north means least short close music lower basis built fully
quite later death times shall local using front often began woman truth ready force simple study above along cases court final
trade value areas clear doing early happy heart major month price quick rapid round share sound space speak staff stand stone
sugar teeth thank theme thing third throw total touch tower track train treat trust under union until upper urban usual visit
watch waste wheel whose worth write wrong yield youth alarm alert agent apple award beach bench birth blade blank blind block
blood board boost brain brand bread break brick brief bring broad brown brush build cabin cable candy carry catch chain chair
chalk charm chart chase cheap check chest chief chill choir civil claim clean clerk click climb clock cloud coach coast color
couch count cover crack craft crane crash cream crime cross crowd crown curve cycle daily dance dealt delay depth dirty doubt
dozen draft drama drawn dream dress drink drive eager earth elbow elder empty enemy enjoy enter entry equal error event exact
exist extra faith false fancy fault favor feast fence fiber fifty fight flame flash fleet floor flour fluid focus fresh fruit
funny ghost giant glass globe glory grace grade grain grand grant grape grass grave green greet grief guard guess guest guide
habit hatch heavy hello hobby honey honor horse hotel humor ideal image index inner input issue jelly jewel joint judge juice
knife knock label labor laser laugh layer lemon limit linen logic loose lucky lunch magic maker march match mayor medal metal
meter minor model moral motor mount mouse mouth movie nerve noble noise novel nurse ocean offer olive onion opera orbit owner
paint panel panic peace pearl phase phone photo piano piece pilot pitch pizza plain plane plate plaza pound press pride prime
print prize proof proud prove queen quiet quote radio raise range ratio reach react relax reply rider ridge rifle river roast
robot rough route royal rural salad sauce scale scene scope score scout sheep sheet shelf shell shift shine shirt shock shoot
shore sight skill skirt sleep slice slope smart smell smile smoke snack snake solar solid solve spare spark spell spend spice
spine spoon sport spray squad stage stair stake steam steel steep stick stock storm stove straw strip stuck style sweet swing
sword syrup taste tiger toast token tooth topic torch truck tulip uncle unity vapor video vital vivid vocal wagon whale wheat
witch woman wound yacht zebra`;

export const WORDS: string[] = [...new Set(RAW.split(/\s+/).filter((w) => /^[a-z]{5}$/.test(w)))];

/** How many words each level uses. */
export const listSize = (level: number) => Math.min(WORDS.length, [30, 50, 80, 120, 160, 200, 250, 300, 360, 9999][lvl(level) - 1]!);

/** Wordle feedback as five marks: 2 green, 1 yellow, 0 grey. */
export function marks(guess: string, secret: string): number[] {
  const out = [0, 0, 0, 0, 0];
  const left: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === secret[i]) out[i] = 2;
    else left[secret[i]!] = (left[secret[i]!] ?? 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (out[i] === 2) continue;
    const ch = guess[i]!;
    if ((left[ch] ?? 0) > 0) {
      out[i] = 1;
      left[ch]!--;
    }
  }
  return out;
}

const code = (m: number[]) => m.reduce((a, x) => a * 3 + x, 0);
const marksText = (m: number[]) => m.map((x) => 'XYG'[x]).join('');

const spaces = new Map<number, Space>();
export function spaceFor(level: number): Space {
  const L = lvl(level);
  const hit = spaces.get(L);
  if (hit) return hit;
  const list = WORDS.slice(0, listSize(L));
  const n = list.length;
  const fb = new Uint8Array(n * n);
  for (let g = 0; g < n; g++) for (let s = 0; s < n; s++) fb[g * n + s] = code(marks(list[g]!, list[s]!));
  const sp = { n, fb, nf: 243, win: 242 };
  spaces.set(L, sp);
  return sp;
}

const yard = new Map<number, { avg: number; worst: number }>();
export function yardstick(level: number): { avg: number; worst: number } {
  const L = lvl(level);
  const hit = yard.get(L);
  if (hit) return hit;
  const s = spaceFor(L);
  const r = playAll(s, infoGain);
  const y = { avg: r.total / s.n, worst: r.worst };
  yard.set(L, y);
  return y;
}

const TONES = ['miss', 'near', 'hit'];

class WordEnv implements Env {
  secret = 0;
  guesses: number[] = [];
  constructor(private level: number) {}
  reset(seed: number) {
    this.secret = Math.floor(rng(seed)() * listSize(this.level));
    this.guesses = [];
  }
  actions() {
    return [...Array(listSize(this.level)).keys()];
  }
  step(a: number) {
    this.guesses.push(a);
    return { reward: -1, done: a === this.secret || this.guesses.length >= 8 };
  }
  describe() {
    const lines = this.guesses.map((g) => `${WORDS[g]!.toUpperCase()} → ${marksText(marks(WORDS[g]!, WORDS[this.secret]!))}`);
    return `Guess the five-letter word (G = right place, Y = elsewhere in the word, X = not in it).${lines.length ? `\n${lines.join('\n')}` : ' No guesses yet.'}`;
  }
}

interface WordSave extends GuessSave {
  game: 'words';
  level: number;
}

class WordLearner implements Learner {
  pol: GuessPolicy;
  constructor(
    private level: number,
    seed: number,
    saved?: unknown,
  ) {
    const s = savedFor<WordSave>(saved, 'words');
    const same = s?.level === level;
    this.pol = new GuessPolicy(spaceFor(level), seed, s ? { ...s, avg: same ? s.avg : NaN, games: same ? s.games : 0 } : null);
    if (Number.isNaN(this.pol.avg)) this.pol.avg = this.pol.score(this.pol.w);
  }
  train(n: number) {
    return this.pol.train(n);
  }
  measure() {
    const y = yardstick(this.level);
    const his = this.pol.avg;
    return {
      mastery: closed(his, naiveAvg(spaceFor(this.level)), y.avg),
      detail: `${listSize(this.level)} words: he needs ${his.toFixed(2)} guesses on average over every word; the information-gain guesser needs ${y.avg.toFixed(2)} (worst ${y.worst}); guessing the first word that fits needs ${naiveAvg(spaceFor(this.level)).toFixed(2)} (0%).`,
    };
  }
  save(): WordSave {
    return { game: 'words', level: this.level, ...this.pol.save() };
  }
  view(): Frame {
    const names = ['biggest group left', 'average group', 'information left', 'not a possible word', 'few groups'];
    const w = this.pol.w;
    const mx = Math.max(...w.map(Math.abs)) || 1;
    return {
      bars: names.map((nm, i) => [nm, Math.abs(w[i]!) / mx, w[i]! > 0 ? 'avoids' : 'seeks'] as [string, number, string]),
      caption: 'What he looks at when choosing a word, and how much (avoids = counts against a guess).',
    };
  }
  watch(seed: number, secret?: string): Frame[] {
    const sp = spaceFor(this.level);
    const n = sp.n;
    let sec = secret ? WORDS.slice(0, n).indexOf(secret.trim().toLowerCase()) : -1;
    if (sec < 0) sec = Math.floor(rng(seed)() * n);
    const gs = playOne(sp, weighted(this.pol.w), sec);
    const cells: Cell[] = [];
    let cand = [...Array(n).keys()];
    return gs.map((g, i) => {
      const m = marks(WORDS[g]!, WORDS[sec]!);
      m.forEach((x, j) => cells.push({ t: WORDS[g]![j]!.toUpperCase(), c: TONES[x] }));
      cand = split(sp, g, cand).get(code(m)) ?? [];
      const done = g === sec;
      return { grid: { w: 5, h: i + 1, cells: cells.slice() }, caption: done ? `${WORDS[sec]!.toUpperCase()} in ${i + 1}.` : `Guess ${i + 1}: ${cand.length} word${cand.length === 1 ? '' : 's'} still possible.` };
    });
  }
}

function generate(level: number, seed: number): Problem {
  const L = lvl(level);
  const sp = spaceFor(L);
  for (let t = 0; ; t++) {
    const sec = Math.floor(rng(seed + t * 911)() * sp.n);
    let cand = [...Array(sp.n).keys()];
    const clues: string[] = [];
    while (cand.length > 1) {
      const g = infoGain(sp, cand, clues.length + 1);
      if (g === sec) break;
      clues.push(`${WORDS[g]!.toUpperCase()} → ${marksText(marks(WORDS[g]!, WORDS[sec]!))}`);
      cand = cand.filter((c) => sp.fb[g * sp.n + c] === sp.fb[g * sp.n + sec]);
    }
    if (cand.length !== 1 || !clues.length) continue;
    const list = WORDS.slice(0, sp.n).join(' ');
    const text = `Word guess. The secret is one of these words: ${list}.\nClues (G = right letter, right place; Y = in the word, elsewhere; X = not in the word):\n${clues.join('\n')}\nExactly one word fits. Which?`;
    return { game: 'words', level: L, seed, text, data: { answer: WORDS[sec] } };
  }
}

function check(p: Problem, answer: string): Verdict {
  const want = (p.data as { answer: string }).answer;
  const ok = (finalLine(answer).toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length === 5).pop() === want;
  return { correct: ok, score: ok ? 1 : 0, why: ok ? 'Right.' : `It is ${want.toUpperCase()}.` };
}

export const words: Game = {
  ...WORDS_META,
  env: (level) => new WordEnv(level),
  generate,
  check,
  learner: (level, seed, saved) => new WordLearner(level, seed, saved),
};
