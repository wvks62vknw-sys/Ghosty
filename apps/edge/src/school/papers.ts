/**
 * SCHOOL's own papers: the exams Ghosty writes for the offline brain at nursery, reception, Key Stage 1 and
 * Key Stage 2, in the style of the real thing (the early-years checks, the Key Stage 1 tests, the Year 6 SATs).
 * `makePaper(stage, subject, seed)` is deterministic: the same seed is the same paper, a new seed a new paper.
 * Paper seeds start at `PAPER_SEED_FLOOR` (1,000,000): practice never uses them, and a paper is never put in the
 * library, so study and the weekly training never see one (they are kept only under `school:paper:<id>`).
 *
 * Exact wherever the answer is exact (counting, letters and sounds, number bonds, times tables, arithmetic in the
 * SATs arithmetic style, word classes, punctuation, spelling as "which spelling is right"); reading is a short
 * passage followed by exact and short questions; writing has one longer piece marked by a stronger model against
 * a plain mark scheme. Every item names its topic, for weak spots.
 *
 * Texts: the passages are public domain (nursery rhymes; Aesop's fables, some as retold by Joseph Jacobs in 1894,
 * some retold here in plain words; Lewis Carroll 1865, Anna Sewell 1877, Beatrix Potter 1902, Kenneth Grahame
 * 1908, Frances Hodgson Burnett 1911). The spelling words come from the national curriculum in England's word
 * lists for Years 1–6 (Crown copyright, Open Government Licence v3.0). Part 2 adds the official papers: a paper
 * record says where it came from (state.ts `PaperRecord.from`), so both kinds are stored and sat the same way.
 */
import { bandsFor, normaliseText, parseNumber, stageById, SUBJECT_LABEL, type Paper, type PaperItem, type StageId } from '../../../../packages/shared/src/school';

/** Seeds at or above this are exam papers (never practice, never training). */
export const PAPER_SEED_FLOOR = 1_000_000;
/** The stages Ghosty can write papers for so far (part 2 adds the rest and the official papers). */
export const PAPER_STAGES: StageId[] = ['nursery', 'reception', 'ks1', 'ks2'];
export const hasPapers = (stage: StageId): boolean => PAPER_STAGES.includes(stage);

/** A reading passage, shown with the questions that use it. */
export interface Passage {
  id: string;
  title: string;
  text: string;
  source: string;
}
/** An item, with the passage it is about (reading). */
export interface SchoolItem extends PaperItem {
  passage?: string;
}
export interface SchoolPaper extends Paper {
  items: SchoolItem[];
  passages?: Passage[];
  /** Where it came from when not from the generators here: a checked question bank (banks.ts) or an official paper (official.ts). */
  from?: 'bank' | 'official';
  /** Official papers: the board (or the Standards and Testing Agency), the year, the paper's real total, and what its boundaries are. */
  board?: string;
  year?: number;
  fullMarks?: number;
  /** In plain words, e.g. "AQA's June 2023 boundaries for 8300/1H, scaled to the 74 marks he could sit". */
  boundaries?: string;
  /** Questions left out of the paper (and its total): a picture he cannot see, a part read aloud, a check that failed. */
  leftOut?: { what: string; marks: number; why: string }[];
}

// ---- seeded choices ------------------------------------------------------------------------------------------

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashText = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};

class Maker {
  readonly r: () => number;
  constructor(seed: number) {
    this.r = mulberry(seed);
  }
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.r() * (hi - lo + 1));
  }
  pick<T>(a: readonly T[]): T {
    return a[Math.floor(this.r() * a.length)]!;
  }
  shuffle<T>(a: readonly T[]): T[] {
    const out = [...a];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.r() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}

type Draft = Omit<SchoolItem, 'id'>;
type Gen = (m: Maker) => Draft | null;

const LETTERS = 'abcd';
function mcq(m: Maker, q: string, right: string, wrongs: readonly string[], topic: string, marks = 1): Draft {
  const opts = m.shuffle([right, ...m.shuffle(wrongs.filter((w) => w !== right)).slice(0, 3)]);
  return { q, type: 'mcq', marks, options: opts, answer: LETTERS[opts.indexOf(right)]!, topic };
}
const exact = (q: string, answer: string, topic: string, also: string[] = []): Draft => ({ q, type: 'exact', marks: 1, answer, ...(also.length ? { also } : {}), topic });
const num = (q: string, answer: number | string, topic: string, opts: { marks?: number; unit?: string } = {}): Draft => ({ q, type: 'number', marks: opts.marks ?? 1, answer: String(answer), ...(opts.unit ? { unit: opts.unit } : {}), topic });
const short = (q: string, model: string, rubric: string, topic: string, marks = 1): Draft => ({ q, type: 'short', marks, answer: model, rubric, topic });
const extended = (q: string, model: string, rubric: string, topic: string, marks: number): Draft => ({ q, type: 'extended', marks, answer: model, rubric, topic });
/** A letter or a sound written any of the ways a reply might: "s", "the letter s", "/s/", "s sound". */
const letterAlso = (l: string) => [`letter ${l}`, `/${l}/`, `${l} sound`, `sound ${l}`, `the sound ${l}`];

/** Questions asked of many words ("Which spelling is right?"): for these the choices make the question. */
const REPEATABLE = /^(Which spelling is right\?|Which sentence is written correctly\?|Which of these is a made-up word)/;
/** What makes two items the same question: the words, and for the repeatable ones the choices too. */
export const itemKey = (d: Pick<PaperItem, 'q' | 'options'>): string => (REPEATABLE.test(d.q) ? `${d.q}|${[...(d.options ?? [])].sort().join('|')}` : d.q);
/** `n` different items from the generators, in a seeded order (each generator may be used more than once). */
function fill(m: Maker, n: number, gens: Gen[], taken: Draft[] = []): Draft[] {
  const out: Draft[] = [];
  // An exact answer is asked for once per topic too ("bed" is not spelt twice with a different letter missing).
  const keys = (d: Draft) => [itemKey(d), ...(d.type === 'exact' ? [`=${d.topic}|${d.answer}`] : [])];
  const seen = new Set(taken.flatMap(keys));
  for (let tries = 0; gens.length && out.length < n && tries < n * 60; tries++) {
    const d = m.pick(gens)(m);
    if (!d || keys(d).some((k) => seen.has(k))) continue;
    for (const k of keys(d)) seen.add(k);
    out.push(d);
  }
  return out;
}

const commas = (n: number): string => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
const dec = (n: number, dp = 2): string => String(Number(n.toFixed(dp)));
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
function fracText(n: number, d: number): string {
  const g = gcd(n, d);
  const [p, q] = [n / g, d / g];
  if (q === 1) return String(p);
  return p > q ? `${Math.floor(p / q)} ${p % q}/${q}` : `${p}/${q}`;
}

// ---- spelling: "which spelling is right", from the national curriculum word lists ------------------------------

/** Years 1–2: common exception words (national curriculum in England, Crown copyright, OGL v3.0). */
const WORDS_Y12 = 'the said says are were was his has you your they here there where love come some one once friend school push pull full house our door floor poor because find kind mind behind child children wild climb most only both cold gold hold told every everybody even great break steak pretty beautiful after fast last past father class grass pass plant path bath hour move prove improve sure sugar could should would who whole any many clothes busy people water again half money parents Christmas'.split(' ');
/** Years 3–4 word list. */
const WORDS_Y34 = 'accident accidentally actual actually address answer appear arrive believe bicycle breath breathe build business calendar caught centre century certain circle complete consider continue decide describe different difficult disappear early earth eight eighth enough exercise experience experiment extreme famous favourite February forward fruit grammar group guard guide heard heart height history imagine increase important interest island knowledge learn length library material medicine mention minute natural naughty notice occasion occasionally often opposite ordinary particular peculiar perhaps popular position possess possession possible potatoes pressure probably promise purpose quarter question recent regular reign remember sentence separate special straight strange strength suppose surprise therefore though although thought through various weight woman women'.split(' ');
/** Years 5–6 word list. */
const WORDS_Y56 = 'accommodate accompany according achieve aggressive amateur ancient apparent appreciate attached available average awkward bargain bruise category cemetery committee communicate community competition conscience conscious controversy convenience correspond criticise curiosity definite desperate determined develop dictionary disastrous embarrass environment equipment especially exaggerate excellent existence explanation familiar foreign forty frequently government guarantee harass hindrance identity immediately individual interfere interrupt language leisure lightning marvellous mischievous muscle necessary neighbour nuisance occupy occur opportunity parliament persuade physical prejudice privilege profession programme pronunciation queue recognise recommend relevant restaurant rhyme rhythm sacrifice secretary shoulder signature sincerely soldier stomach sufficient suggest symbol system temperature thorough twelfth variety vegetable vehicle yacht'.split(' ');

/** Every word the spelling lists know, and some short ones a changed letter could land on: never offered as a wrong spelling. */
let REAL: Set<string> | null = null;
const REAL_WORDS = {
  [Symbol.iterator]: function* () {
    REAL ??= new Set([...WORDS_Y12, ...WORDS_Y34, ...WORDS_Y56, ...'resent lest list lust lost bust best bit bet but bat bad bed bid bud cat cot cut hat hot hut pin pen pan pun ten tin ton sit set sat fun fan fin fit fat hit his has hos dog dig dug log leg lag lot let mat met mud mad man men mun not net nut pit pot pet put rat rot red rid run ran sun sin son tap tip top want went wont when then than them this thus that what whit whom some same sore sure were wore where there their here hear heard hard heart hurt herd word ward worm warm form farm from fall fell fill full pull pall poll pole pool hole hold held weight wait white write right rite site sight cite reign rain rein main mane mean moan bear beer bare boar pore pour poor four for fore far'.split(' ')].map((w) => w.toLowerCase()));
    yield* REAL;
  },
};

/** Three different, plausible wrong spellings of a word (doubled or single letters, ie/ei, a vowel swapped, a silent letter dropped, two letters swapped). */
export function misspell(word: string, m: Maker): string[] {
  // Three tiers, most believable first: letters doubled or single, ie/ei and common sound-alike swaps; then one
  // vowel changed; then two letters swapped (only when the first two tiers are short).
  const tiers: Set<string>[] = [new Set(), new Set(), new Set()];
  let out = tiers[0]!;
  const w = word;
  const add = (s: string) => s !== w && s.length > 1 && out.add(s);
  for (let i = 1; i < w.length; i++) {
    if (w[i] === w[i - 1]) add(w.slice(0, i) + w.slice(i + 1)); // necessary → necesary
    else if (/[bcdfglmnprst]/.test(w[i]!) && i < w.length - 1) add(w.slice(0, i + 1) + w[i] + w.slice(i + 1)); // → neccessary
  }
  add(w.replace('ie', 'ei'));
  add(w.replace('ei', 'ie'));
  const swaps: [RegExp, string][] = [[/ou/, 'ow'], [/ph/, 'f'], [/ch/, 'tch'], [/ci/, 'si'], [/ce/, 'se'], [/se/, 'ce'], [/our$/, 'or'], [/ure$/, 'er'], [/tion$/, 'shun'], [/ous$/, 'us'], [/le$/, 'el'], [/ey$/, 'y'], [/y$/, 'ey'], [/ai/, 'ay'], [/ea/, 'ee'], [/ee/, 'ea'], [/wh/, 'w'], [/gu/, 'g'], [/k/, 'c'], [/c/, 'k'], [/e$/, '']];
  for (const [re, to] of swaps) add(w.replace(re, to));
  const vowel: Record<string, string> = { a: 'e', e: 'i', i: 'e', o: 'u', u: 'o' };
  out = tiers[1]!;
  for (let i = 1; i < w.length; i++) if (vowel[w[i]!]) add(w.slice(0, i) + vowel[w[i]!] + w.slice(i + 1));
  out = tiers[2]!;
  for (let i = 1; i < w.length - 1; i++) if (w[i] !== w[i + 1] && /[aeiou]/.test(w[i]! + w[i + 1]!)) add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  // Never a real word ("last" → "lest"): each must be wrong.
  const seen = new Set<string>(REAL_WORDS);
  const pool = tiers.flatMap((t) => m.shuffle([...t].filter((x) => !seen.has(x.toLowerCase()) && (seen.add(x.toLowerCase()), true))));
  // At least two from the believable tiers when they have them; the third may be any.
  return pool.slice(0, 3);
}
const spelling = (list: readonly string[], topic = 'spelling'): Gen => (m) => {
  const word = m.pick(list.filter((x) => x.length >= 4));
  const wrong = misspell(word, m);
  return wrong.length === 3 ? mcq(m, 'Which spelling is right?', word, wrong, topic) : null;
};

// ---- the passages ------------------------------------------------------------------------------------------------

interface PassageSet {
  passage: Passage;
  /** Its questions, in order (a paper takes them all). */
  items: (m: Maker) => Draft[];
}
const P = (id: string, title: string, text: string, source: string): Passage => ({ id, title, text, source });

const RHYMES: PassageSet[] = [
  {
    passage: P('humpty', 'Humpty Dumpty', "Humpty Dumpty sat on a wall,\nHumpty Dumpty had a great fall.\nAll the king's horses and all the king's men\nCouldn't put Humpty together again.", 'Traditional nursery rhyme (public domain)'),
    items: (m) => [
      mcq(m, 'Where did Humpty Dumpty sit?', 'on a wall', ['on a chair', 'in a boat', 'under a tree'], 'listening to a rhyme'),
      mcq(m, 'What happened to Humpty Dumpty?', 'he had a great fall', ['he went to sleep', 'he ate his dinner', 'he sang a song'], 'listening to a rhyme'),
      exact("Which word in the rhyme rhymes with 'wall'?", 'fall', 'rhyming words'),
      mcq(m, 'Who tried to put Humpty together again?', "the king's horses and men", ['a cat and a dog', 'his mum and dad', 'a farmer'], 'listening to a rhyme'),
      mcq(m, 'Could they put Humpty together again?', 'no, they could not', ['yes, straight away', 'yes, with glue', 'only his hat'], 'listening to a rhyme'),
    ],
  },
  {
    passage: P('jackjill', 'Jack and Jill', 'Jack and Jill went up the hill\nTo fetch a pail of water.\nJack fell down and broke his crown,\nAnd Jill came tumbling after.', 'Traditional nursery rhyme (public domain)'),
    items: (m) => [
      mcq(m, 'Where did Jack and Jill go?', 'up the hill', ['to the shops', 'into the sea', 'to school'], 'listening to a rhyme'),
      exact('What did Jack and Jill go to fetch?', 'water', 'listening to a rhyme', ['a pail of water', 'pail of water', 'a bucket of water']),
      exact('Who fell down first?', 'Jack', 'listening to a rhyme'),
      mcq(m, "Which word rhymes with 'Jill'?", 'hill', ['water', 'crown', 'after'], 'rhyming words'),
      mcq(m, 'What is a pail?', 'a bucket', ['a hat', 'a hill', 'a horse'], 'word meanings'),
    ],
  },
  {
    passage: P('twinkle', 'Twinkle, Twinkle, Little Star', 'Twinkle, twinkle, little star,\nHow I wonder what you are!\nUp above the world so high,\nLike a diamond in the sky.', 'Jane Taylor, 1806 (public domain)'),
    items: (m) => [
      mcq(m, 'What is the rhyme about?', 'a little star', ['a big ship', 'a little dog', 'a rainy day'], 'listening to a rhyme'),
      mcq(m, 'Where is the star?', 'up above the world', ['under the sea', 'in a box', 'behind the door'], 'listening to a rhyme'),
      exact('What does the rhyme say the star is like?', 'a diamond', 'listening to a rhyme', ['diamond', 'like a diamond', 'a diamond in the sky']),
      exact("Which word in the rhyme rhymes with 'star'?", 'are', 'rhyming words'),
      exact("Which word in the rhyme rhymes with 'high'?", 'sky', 'rhyming words'),
    ],
  },
  {
    passage: P('crow', 'The Crow and the Jug', 'A thirsty crow found a jug with a little water at the bottom. Her beak could not reach it. So she dropped in pebbles, one by one. The water came up and up, until at last she could drink.', "Aesop's fable, retold in plain words (public domain)"),
    items: (m) => [
      mcq(m, 'Why did the crow want the water?', 'she was thirsty', ['she was cold', 'she wanted a bath', 'she was lost'], 'listening to a story'),
      exact('What did the crow drop into the jug?', 'pebbles', 'listening to a story', ['stones', 'little stones', 'small stones', 'pebbles one by one']),
      mcq(m, 'Could her beak reach the water at first?', 'no', ['yes', 'only on Sunday', 'yes, easily'], 'listening to a story'),
      mcq(m, 'What happened to the water when she dropped the pebbles in?', 'it came up', ['it went down', 'it turned blue', 'it froze'], 'listening to a story'),
    ],
  },
];

const RECEPTION_READING: PassageSet[] = [
  {
    passage: P('baabaa', 'Baa, Baa, Black Sheep', 'Baa, baa, black sheep,\nHave you any wool?\nYes, sir, yes, sir,\nThree bags full;\nOne for the master,\nAnd one for the dame,\nAnd one for the little boy\nWho lives down the lane.', 'Traditional nursery rhyme (public domain)'),
    items: (m) => [
      exact('What colour is the sheep?', 'black', 'finding information'),
      num('How many bags of wool does the sheep have?', 3, 'finding information'),
      exact('What does the sheep have in the bags?', 'wool', 'finding information'),
      mcq(m, 'Who lives down the lane?', 'the little boy', ['the master', 'the dame', 'the sheep'], 'finding information'),
      mcq(m, "Which word rhymes with 'dame'?", 'lane', ['wool', 'sheep', 'full'], 'rhyme'),
      short('Why do you think the sheep gave one bag to each person?', 'To share the wool out fairly, so everyone got some.', '1 mark for any sensible reason about sharing or giving the wool fairly.', 'inference'),
    ],
  },
  {
    passage: P('diddle', 'Hey Diddle Diddle', 'Hey diddle diddle,\nThe cat and the fiddle,\nThe cow jumped over the moon;\nThe little dog laughed\nTo see such sport,\nAnd the dish ran away with the spoon.', 'Traditional nursery rhyme (public domain)'),
    items: (m) => [
      exact('What did the cow jump over?', 'the moon', 'finding information', ['moon']),
      exact('Who laughed?', 'the little dog', 'finding information', ['little dog', 'dog', 'the dog']),
      exact('What did the dish run away with?', 'the spoon', 'finding information', ['spoon']),
      exact("Which word rhymes with 'diddle'?", 'fiddle', 'rhyme'),
      mcq(m, 'Could a cow really jump over the moon?', 'no, it is a silly rhyme', ['yes, every day', 'yes, if it is windy', 'only at night'], 'real and made-up'),
      short('What makes this rhyme funny?', 'Silly things happen that could not really happen, like a cow jumping over the moon and a dish running away with a spoon.', '1 mark for naming something silly or impossible in the rhyme.', 'inference'),
    ],
  },
  {
    passage: P('lionmouse', 'The Lion and the Mouse', "A lion was asleep in the sun. A little mouse ran over his nose and woke him up. The lion caught the mouse in his big paw. 'Please let me go,' said the mouse, 'and one day I will help you.' The lion laughed, but he let the mouse go. Later, the lion was caught in a hunter's net. He roared and roared. The little mouse heard him. She ran to the net and nibbled the ropes until the lion was free.", "Aesop's fable, retold in plain words (public domain)"),
    items: (m) => [
      mcq(m, 'What woke the lion up?', 'a mouse ran over his nose', ['a loud bang', 'the rain', 'a bird sang'], 'finding information'),
      exact('What did the lion catch the mouse with?', 'his paw', 'finding information', ['paw', 'his big paw', 'big paw', 'a paw']),
      mcq(m, 'What did the lion do when the mouse said she would help him?', 'he laughed', ['he cried', 'he ran away', 'he went to sleep'], 'finding information'),
      exact('What caught the lion later?', 'a net', 'finding information', ['net', "a hunter's net", "hunter's net"]),
      mcq(m, 'How did the mouse set the lion free?', 'she nibbled the ropes', ['she called for help', 'she pushed the net', 'she sang to him'], 'finding information'),
      short('What does this story teach us?', 'That even someone small can help someone big, so we should be kind to everyone.', '1 mark for a lesson about small friends helping, or about kindness being repaid.', 'inference'),
    ],
  },
  {
    passage: P('tortoise', 'The Tortoise and the Hare', "A hare laughed at a tortoise for being slow. 'Let us have a race,' said the tortoise. The hare ran off very fast. He was so far ahead that he lay down for a nap. The tortoise kept walking, slowly and steadily. When the hare woke up, he ran as fast as he could, but the tortoise had already crossed the finish line.", "Aesop's fable, retold in plain words (public domain)"),
    items: (m) => [
      exact('Who was the fast animal?', 'the hare', 'finding information', ['hare']),
      mcq(m, 'What did the hare do when he was far ahead?', 'he lay down for a nap', ['he ate a carrot', 'he went home', 'he waited for the tortoise'], 'finding information'),
      exact('Who won the race?', 'the tortoise', 'finding information', ['tortoise']),
      mcq(m, 'How did the tortoise walk?', 'slowly and steadily', ['very fast', 'backwards', 'with a hop'], 'finding information'),
      short('Why did the hare lose the race?', 'He was so sure he would win that he stopped for a nap, and the tortoise kept going.', '1 mark for: he stopped / went to sleep / was too sure of winning.', 'inference'),
    ],
  },
];

const KS1_READING: PassageSet[] = [
  {
    passage: P('foxgrapes', 'The Fox and the Grapes', "One hot summer's day a Fox was strolling through an orchard till he came to a bunch of Grapes just ripening on a vine which had been trained over a lofty branch. \"Just the thing to quench my thirst,\" quoth he. Drawing back a few paces, he took a run and a jump, and just missed the bunch. Turning round again with a One, Two, Three, he jumped up, but with no greater success. Again and again he tried after the tempting morsel, but at last had to give it up, and walked away with his nose in the air, saying: \"I am sure they are sour.\"", "Aesop's Fables, retold by Joseph Jacobs, 1894 (public domain)"),
    items: (m) => [
      exact('Where was the Fox walking?', 'through an orchard', 'retrieval', ['an orchard', 'orchard', 'in an orchard']),
      exact('What did the Fox want?', 'the grapes', 'retrieval', ['grapes', 'a bunch of grapes', 'bunch of grapes']),
      mcq(m, 'Why did the Fox want them?', 'to quench his thirst', ['to give to his friends', 'to make jam', 'to sell them'], 'retrieval'),
      exact('Find and copy one word that tells you the branch was high.', 'lofty', 'vocabulary'),
      exact('What time of year was it?', 'summer', 'retrieval', ["a hot summer's day", "hot summer's day", "summer's day"]),
      mcq(m, "What does 'morsel' mean in the story?", 'a small piece of food', ['a kind of fox', 'a big jump', 'a tree branch'], 'vocabulary'),
      mcq(m, 'How did the Fox walk away at the end?', 'with his nose in the air', ['with a smile', 'very slowly', 'with the grapes'], 'retrieval'),
      mcq(m, 'Which word best describes how the Fox felt at the end?', 'disappointed', ['delighted', 'frightened', 'sleepy'], 'inference'),
      short('Why did the Fox say the grapes were sour?', 'He could not reach them, so he pretended he did not want them anyway.', '1 mark: he could not reach or get them. 1 mark: he pretended / made himself feel better / would not admit he had failed.', 'inference', 2),
    ],
  },
  {
    passage: P('antgrass', 'The Ant and the Grasshopper', "In a field one summer's day a Grasshopper was hopping about, chirping and singing to its heart's content. An Ant passed by, bearing along with great toil an ear of corn he was taking to the nest. \"Why not come and chat with me,\" said the Grasshopper, \"instead of toiling and moiling in that way?\" \"I am helping to lay up food for the winter,\" said the Ant, \"and recommend you to do the same.\" \"Why bother about winter?\" said the Grasshopper; \"we have got plenty of food at present.\" But the Ant went on its way and continued its toil. When the winter came the Grasshopper had no food and found itself dying of hunger, while it saw the ants distributing every day corn and grain from the stores they had collected in the summer.", "Aesop's Fables, retold by Joseph Jacobs, 1894 (public domain)"),
    items: (m) => [
      mcq(m, 'What was the Grasshopper doing at the start?', 'hopping about, chirping and singing', ['carrying corn', 'sleeping in the sun', 'building a nest'], 'retrieval'),
      exact('What was the Ant carrying?', 'an ear of corn', 'retrieval', ['ear of corn', 'corn']),
      mcq(m, 'Why was the Ant working so hard?', 'to store food for the winter', ['to win a race', 'to build a house', 'to help the Grasshopper'], 'retrieval'),
      exact('Find and copy one word that means hard work.', 'toil', 'vocabulary', ['toiling']),
      exact('In which season does the story begin?', 'summer', 'retrieval', ["a summer's day", "summer's day"]),
      mcq(m, 'What happened to the Grasshopper in the winter?', 'it had no food', ['it went to sleep', 'it found a new home', 'it moved to the town'], 'retrieval'),
      mcq(m, "What does 'at present' mean?", 'now', ['later', 'as a gift', 'last year'], 'vocabulary'),
      short('What lesson does this story teach?', 'It is best to get ready for hard times while you can.', '1 mark for: plan ahead / prepare for the future / work now so you have enough later.', 'inference'),
      short('Do you think the Ant was a good friend to the Grasshopper? Explain your answer.', 'Yes: he warned the Grasshopper to save food for the winter. (Or no: he did not share his food when winter came.)', '1 mark for an opinion. 1 mark for a reason taken from the story.', 'inference', 2),
    ],
  },
  {
    passage: P('peter', 'The Tale of Peter Rabbit', "Once upon a time there were four little Rabbits, and their names were Flopsy, Mopsy, Cotton-tail, and Peter. They lived with their Mother in a sand-bank, underneath the root of a very big fir-tree. \"Now, my dears,\" said old Mrs. Rabbit one morning, \"you may go into the fields or down the lane, but don't go into Mr. McGregor's garden: your Father had an accident there; he was put in a pie by Mrs. McGregor. Now run along, and don't get into mischief. I am going out.\" Then old Mrs. Rabbit took a basket and her umbrella, and went through the wood to the baker's. She bought a loaf of brown bread and five currant buns. Flopsy, Mopsy, and Cotton-tail, who were good little bunnies, went down the lane to gather blackberries: But Peter, who was very naughty, ran straight away to Mr. McGregor's garden, and squeezed under the gate!", 'Beatrix Potter, 1902 (public domain)'),
    items: (m) => [
      num('How many little rabbits were there?', 4, 'retrieval'),
      mcq(m, 'Where did the rabbits live?', 'in a sand-bank under a fir-tree', ['in a hutch', "in Mr. McGregor's garden", 'in a house in the town'], 'retrieval'),
      exact('Where were the rabbits told NOT to go?', "Mr. McGregor's garden", 'retrieval', ["mr mcgregor's garden", "mcgregor's garden", "into mr. mcgregor's garden", "into mr mcgregor's garden"]),
      mcq(m, 'What happened to Father Rabbit?', 'he was put in a pie', ['he went on holiday', 'he got lost in the wood', 'he became a baker'], 'retrieval'),
      mcq(m, 'What did Mrs. Rabbit buy at the baker\'s?', 'a loaf of brown bread and five currant buns', ['a cake and some carrots', 'three apples', 'a pie'], 'retrieval'),
      exact('What did the good bunnies go to gather?', 'blackberries', 'retrieval'),
      exact('Which rabbit was naughty?', 'Peter', 'retrieval'),
      mcq(m, "What does 'mischief' mean?", 'naughty behaviour', ['a kind of food', 'a garden tool', 'a long walk'], 'vocabulary'),
      short('How do you know Peter was naughty?', "He ran straight to Mr. McGregor's garden even though his mother told him not to.", "1 mark for: he went to Mr. McGregor's garden / did what he was told not to / squeezed under the gate.", 'inference'),
      short('Why do you think Mrs. Rabbit did not want them to go into the garden?', 'Because it was dangerous: their father was caught there and put in a pie.', '1 mark for: it was dangerous / Father was put in a pie there.', 'inference'),
    ],
  },
];

const KS2_READING: PassageSet[] = [
  {
    passage: P('alice', "Alice's Adventures in Wonderland", "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, \"and what is the use of a book,\" thought Alice \"without pictures or conversations?\" So she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.", 'Lewis Carroll, 1865 (public domain)'),
    items: (m) => [
      mcq(m, 'Where was Alice sitting at the start?', 'by her sister on the bank', ['in her bedroom', 'in a classroom', 'under a tree in a forest'], 'retrieval'),
      exact('Find and copy the two things Alice thought a book should have.', 'pictures and conversations', 'retrieval', ['pictures or conversations', 'pictures, conversations', 'conversations and pictures']),
      mcq(m, 'Why was Alice getting tired?', 'she had nothing to do', ['she had run a race', 'she had been reading for hours', 'she was ill'], 'retrieval'),
      exact('What was Alice thinking of making?', 'a daisy-chain', 'retrieval', ['daisy-chain', 'daisy chain', 'a daisy chain']),
      mcq(m, 'What made Alice feel sleepy and stupid?', 'the hot day', ["her sister's book", 'the White Rabbit', 'picking daisies'], 'retrieval'),
      exact("What colour were the White Rabbit's eyes?", 'pink', 'retrieval'),
      mcq(m, "'She was considering in her own mind.' What does 'considering' mean here?", 'thinking about', ['forgetting', 'shouting about', 'writing down'], 'vocabulary'),
      mcq(m, 'Which word best describes how Alice feels at the start?', 'bored', ['frightened', 'excited', 'angry'], 'inference'),
      short("Why did Alice think her sister's book was no use?", 'Because it had no pictures or conversations in it.', '1 mark for: it had no pictures or conversations.', 'inference'),
      short('How can you tell that Alice is bored? Give two pieces of evidence from the text.', 'She is very tired of sitting on the bank with nothing to do, and she peeps into her sister\'s book.', '1 mark each, up to 2, for: tired of sitting / nothing to do / peeped into the book / wondering whether a daisy-chain is worth the trouble.', 'inference', 2),
      short('What do you think will happen next? Use the text to explain.', 'Alice will follow the White Rabbit, because it ran close by her and she was looking for something to do.', '1 mark for a sensible prediction linked to the White Rabbit or her boredom.', 'prediction'),
    ],
  },
  {
    passage: P('beauty', 'Black Beauty', 'The first place that I can well remember was a large pleasant meadow with a pond of clear water in it. Some shady trees leaned over the pond, and rushes and water-lilies grew at the deep end. Over the hedge on one side we looked into a ploughed field, and on the other we looked over a gate at our master\'s house, which stood by the roadside; at the top of the meadow was a grove of fir trees, and at the bottom a running brook overhung by a steep bank.', 'Anna Sewell, 1877 (public domain)'),
    items: (m) => [
      exact('What was in the meadow?', 'a pond', 'retrieval', ['pond', 'a pond of clear water', 'pond of clear water']),
      mcq(m, 'What grew at the deep end of the pond?', 'rushes and water-lilies', ['roses and daisies', 'apple trees', 'tall grass and nettles'], 'retrieval'),
      exact('Find and copy the word that tells you the field had been dug ready for planting.', 'ploughed', 'vocabulary'),
      mcq(m, "Where did the master's house stand?", 'by the roadside', ['on a hill', 'by the sea', 'in the wood'], 'retrieval'),
      exact('What was at the top of the meadow?', 'a grove of fir trees', 'retrieval', ['grove of fir trees', 'fir trees', 'a grove of fir-trees']),
      exact('What was at the bottom of the meadow?', 'a running brook', 'retrieval', ['running brook', 'a brook', 'brook']),
      mcq(m, "What does 'overhung' mean in the last sentence?", 'hung out over it', ['dried it up', 'ran under it', 'was far away from it'], 'vocabulary'),
      mcq(m, "Which word is closest in meaning to 'pleasant'?", 'nice', ['noisy', 'cold', 'empty'], 'vocabulary'),
      mcq(m, 'What kind of place is described?', 'a peaceful country meadow', ['a busy town', 'a stormy sea', 'a dark cave'], 'inference'),
      short('Find two words or phrases the writer uses to make the meadow sound pleasant.', 'large pleasant meadow; clear water', '1 mark each, up to 2, for: large pleasant meadow / clear water / shady trees / water-lilies / running brook.', 'language for effect', 2),
      short('How do you think the narrator feels about this place? Explain using the text.', 'Fond of it: it is the first place they remember and they describe it as pleasant and full of nice things.', '1 mark for a feeling (happy, fond, safe). 1 mark for evidence from the text.', 'inference', 2),
    ],
  },
  {
    passage: P('willows', 'The Wind in the Willows', 'The Mole had been working very hard all the morning, spring-cleaning his little home. First with brooms, then with dusters; then on ladders and steps and chairs, with a brush and a pail of whitewash; till he had dust in his throat and eyes, and splashes of whitewash all over his black fur, and an aching back and weary arms. Spring was moving in the air above and in the earth below and around him, penetrating even his dark and lowly little house with its spirit of divine discontent and longing.', 'Kenneth Grahame, 1908 (public domain)'),
    items: (m) => [
      exact('Who had been working very hard?', 'the Mole', 'retrieval', ['mole']),
      mcq(m, 'What job was he doing?', 'spring-cleaning his home', ['building a boat', 'digging a garden', 'cooking lunch'], 'retrieval'),
      exact('What did he use first?', 'brooms', 'retrieval', ['a broom', 'broom']),
      exact('Find and copy the word for what he was painting with.', 'whitewash', 'vocabulary'),
      exact("What colour was the Mole's fur?", 'black', 'retrieval'),
      exact('Which season is it?', 'spring', 'retrieval'),
      mcq(m, "What does 'weary' mean?", 'tired', ['wet', 'happy', 'strong'], 'vocabulary'),
      mcq(m, "'Spring was moving in the air.' What does this suggest?", 'spring was arriving and could be felt everywhere', ['it was very windy', 'winter was starting', 'the air was full of dust'], 'language for effect'),
      short('Give two signs that the Mole was tired.', 'He had an aching back and weary arms.', '1 mark each, up to 2, for: aching back / weary arms / dust in his throat and eyes / had worked all morning.', 'inference', 2),
      short("Why do you think the writer calls Mole's home 'dark and lowly'?", 'Because it is underground, small and simple.', '1 mark for: underground / small / humble or plain.', 'language for effect'),
      short('What do you think the Mole will do next? Explain.', 'Stop cleaning and go outside, because spring is calling him and he is tired of work.', '1 mark for a sensible prediction linked to spring or his discontent.', 'prediction'),
    ],
  },
  {
    passage: P('garden', 'The Secret Garden', 'When Mary Lennox was sent to Misselthwaite Manor to live with her uncle everybody said she was the most disagreeable-looking child ever seen. It was true, too. She had a little thin face and a little thin body, thin light hair and a sour expression. Her hair was yellow, and her face was yellow because she had been born in India and had always been ill in one way or another.', 'Frances Hodgson Burnett, 1911 (public domain)'),
    items: (m) => [
      exact("What is the girl's full name?", 'Mary Lennox', 'retrieval'),
      exact('Where was she sent to live?', 'Misselthwaite Manor', 'retrieval', ['to misselthwaite manor']),
      exact('Who was she sent to live with?', 'her uncle', 'retrieval', ['uncle', 'with her uncle']),
      exact('Find and copy the word that tells you her expression was unpleasant.', 'sour', 'vocabulary'),
      exact('Where was she born?', 'India', 'retrieval', ['in india']),
      mcq(m, 'What did everybody say about Mary?', 'she was the most disagreeable-looking child ever seen', ['she was the prettiest child in India', 'she was very clever', 'she was always laughing'], 'retrieval'),
      mcq(m, 'Why was her face yellow?', 'she was born in India and had always been ill', ['she had been painting', 'she ate too many lemons', 'she had been in the sun'], 'retrieval'),
      mcq(m, "What does 'disagreeable' mean?", 'unpleasant', ['friendly', 'tall', 'quiet'], 'vocabulary'),
      mcq(m, "'It was true, too.' What does this sentence tell us?", 'the narrator agrees with what everybody said', ['the narrator thinks everybody was lying', 'Mary is telling the story', 'Mary was happy'], 'inference'),
      short('Give one thing about how Mary looked.', 'She had a little thin face.', '1 mark for any one: thin face / thin body / thin light (yellow) hair / sour expression / yellow face.', 'retrieval'),
      short('Do you think the writer wants us to like Mary at first? Explain.', 'No: she describes her as disagreeable-looking and sour, and says everybody agreed.', '1 mark for an opinion. 1 mark for evidence from the text.', 'author\'s choices', 2),
    ],
  },
];

/** Word meanings, for a reading paper whose passage has fewer questions than the paper needs. */
const SYNONYMS_KS1: [string, string, string[]][] = [['big', 'large', ['tiny', 'slow', 'wet']], ['little', 'small', ['huge', 'loud', 'fast']], ['happy', 'glad', ['sad', 'cross', 'tired']], ['quick', 'fast', ['slow', 'heavy', 'old']], ['shout', 'yell', ['whisper', 'sleep', 'sit']], ['begin', 'start', ['finish', 'stop', 'lose']]];
const SYNONYMS_KS2: [string, string, string[]][] = [['ancient', 'very old', ['brand new', 'noisy', 'tiny']], ['furious', 'very angry', ['calm', 'pleased', 'sleepy']], ['timid', 'shy', ['bold', 'loud', 'rude']], ['vast', 'huge', ['narrow', 'tiny', 'thin']], ['gloomy', 'dark and dull', ['bright and cheerful', 'warm', 'busy']], ['peculiar', 'strange', ['ordinary', 'kind', 'easy']]];
const synonym = (bank: [string, string, string[]][]): Gen => (m) => {
  const [w, right, wrongs] = m.pick(bank);
  return mcq(m, `Which word or words mean the same as '${w}'?`, right, wrongs, 'vocabulary');
};
const readingPaper = (sets: PassageSet[], m: Maker, extra: Gen[], target: number): { items: Draft[]; passages: Passage[] } => {
  const set = m.pick(sets);
  const own = set.items(m).map((d) => ({ ...d, passage: set.passage.id }));
  return { items: [...own, ...fill(m, Math.max(0, target - own.length), extra, own)], passages: [set.passage] };
};

// ---- nursery ---------------------------------------------------------------------------------------------------------

const RHYME_FAMILIES = [['cat', 'hat', 'mat', 'bat'], ['dog', 'log', 'frog', 'fog'], ['sun', 'run', 'bun', 'fun'], ['bed', 'red', 'ted', 'fed'], ['pig', 'wig', 'big', 'dig'], ['hen', 'ten', 'pen', 'men'], ['cake', 'lake', 'snake', 'bake'], ['bee', 'tree', 'see', 'knee'], ['star', 'car', 'jar', 'far'], ['boat', 'coat', 'goat', 'float']];
const OPPOSITES: [string, string, string[]][] = [['big', 'small', ['little']], ['hot', 'cold', []], ['up', 'down', []], ['day', 'night', []], ['happy', 'sad', []], ['wet', 'dry', []], ['fast', 'slow', []], ['open', 'closed', ['shut']], ['full', 'empty', []], ['tall', 'short', []]];
const rhymeItem = (topic: string): Gen => (m) => {
  const fam = m.pick(RHYME_FAMILIES);
  const [a, b] = m.shuffle(fam);
  const others = RHYME_FAMILIES.filter((f) => f !== fam).map((f) => m.pick(f));
  return mcq(m, `Which word rhymes with '${a}'?`, b!, m.shuffle(others), topic);
};
const oppositeItem: Gen = (m) => {
  const [w, o, also] = m.pick(OPPOSITES);
  return exact(`What is the opposite of '${w}'?`, o, 'opposites', also);
};

const START_WORDS: [string, string][] = [['apple', 'a'], ['ball', 'b'], ['cat', 'c'], ['dog', 'd'], ['egg', 'e'], ['fish', 'f'], ['goat', 'g'], ['hat', 'h'], ['ink', 'i'], ['jam', 'j'], ['kite', 'k'], ['lion', 'l'], ['moon', 'm'], ['nest', 'n'], ['orange', 'o'], ['pen', 'p'], ['queen', 'q'], ['rain', 'r'], ['sun', 's'], ['tree', 't'], ['umbrella', 'u'], ['van', 'v'], ['web', 'w'], ['yo-yo', 'y'], ['zebra', 'z']];
const ABC = 'abcdefghijklmnopqrstuvwxyz';
const letterGens: Gen[] = [
  (m) => {
    const [w, l] = m.pick(START_WORDS);
    return exact(`What sound does the word '${w}' start with?`, l, 'first sounds', letterAlso(l));
  },
  (m) => {
    const i = m.int(0, 24);
    return exact(`Which letter comes after '${ABC[i]}' in the alphabet?`, ABC[i + 1]!, 'the alphabet', letterAlso(ABC[i + 1]!));
  },
  (m) => {
    const i = m.int(1, 25);
    return exact(`Which letter comes before '${ABC[i]}' in the alphabet?`, ABC[i - 1]!, 'the alphabet', letterAlso(ABC[i - 1]!));
  },
  (m) => {
    const w = m.pick(['cat', 'dog', 'sun', 'frog', 'fish', 'hat', 'tree', 'moon', 'duck', 'apple', 'zebra', 'bus']);
    return num(`How many letters are in the word '${w}'?`, w.length, 'counting letters');
  },
  (m) => {
    const [w, l] = m.pick(START_WORDS.filter(([, x]) => 'bcdfghlmnprst'.includes(x)));
    const same = START_WORDS.filter(([x, y]) => y === l && x !== w);
    const right = same.length ? m.pick(same)[0] : { b: 'bus', c: 'cup', d: 'duck', f: 'fox', g: 'gate', h: 'hen', l: 'leg', m: 'mug', n: 'nut', p: 'pig', r: 'red', s: 'sock', t: 'tap' }[l]!;
    const wrongs = START_WORDS.filter(([, y]) => y !== l).map(([x]) => x);
    return mcq(m, `Which word starts with the same sound as '${w}'?`, right, m.shuffle(wrongs), 'first sounds');
  },
];

const OBJ = ['★', '●', '♥', '▲'];
const numberGensNursery: Gen[] = [
  (m) => {
    const n = m.int(1, 10);
    const o = m.pick(OBJ);
    return num(`How many are there? ${Array(n).fill(o).join(' ')}`, n, 'counting');
  },
  (m) => {
    const n = m.int(1, 9);
    return num(`What number comes after ${n}?`, n + 1, 'counting on');
  },
  (m) => {
    const n = m.int(2, 10);
    return num(`What number comes before ${n}?`, n - 1, 'counting back');
  },
  (m) => {
    const a = m.int(1, 10);
    let b = m.int(1, 10);
    if (b === a) b = a === 10 ? 9 : a + 1;
    return num(`Which number is bigger, ${a} or ${b}?`, Math.max(a, b), 'comparing numbers');
  },
  (m) => {
    const a = m.int(2, 4);
    const thing = m.pick(['apples', 'sweets', 'teddies', 'balls']);
    return num(`You have ${a} ${thing}. You get 1 more. How many ${thing} do you have now?`, a + 1, 'one more');
  },
  (m) => {
    const a = m.int(2, 5);
    const thing = m.pick(['biscuits', 'grapes', 'cakes', 'buttons']);
    return num(`There are ${a} ${thing}. You eat 1. How many are left?`, a - 1, 'one less');
  },
  (m) => {
    const [s, n] = m.pick([['triangle', 3], ['square', 4], ['rectangle', 4]] as const);
    return num(`How many sides does a ${s} have?`, n, 'shapes');
  },
  (m) => {
    const a = m.int(1, 6);
    return num(`Count on: ${a}, ${a + 1}, ${a + 2}, … What comes next?`, a + 3, 'counting on');
  },
  (m) => mcq(m, 'Which shape is round?', 'a circle', ['a square', 'a triangle', 'a rectangle'], 'shapes'),
];

const WORLD: [string, string, string[]][] = [
  ["Which animal says 'moo'?", 'a cow', ['a dog', 'a duck', 'a sheep']],
  ["Which animal says 'baa'?", 'a sheep', ['a cow', 'a cat', 'a pig']],
  ["Which animal says 'quack'?", 'a duck', ['a horse', 'a dog', 'a cow']],
  ["Which animal says 'woof'?", 'a dog', ['a cat', 'a hen', 'a sheep']],
  ['Where does a fish live?', 'in water', ['in a tree', 'in a nest', 'under a bed']],
  ['What colour is grass?', 'green', ['blue', 'red', 'purple']],
  ['What colour is the sky on a sunny day?', 'blue', ['green', 'brown', 'pink']],
  ['What do we wear on our feet?', 'shoes', ['gloves', 'hats', 'scarves']],
  ['What do we use to brush our teeth?', 'a toothbrush', ['a spoon', 'a comb', 'a pencil']],
  ['When is it dark outside?', 'at night', ['at lunchtime', 'in the morning', 'in the middle of the day']],
  ['What falls from the clouds when it rains?', 'water', ['sand', 'sweets', 'feathers']],
  ['Which season is the coldest?', 'winter', ['summer', 'spring', 'autumn']],
  ['What do bees make?', 'honey', ['milk', 'bread', 'eggs']],
  ['Which of these is a fruit?', 'a banana', ['a carrot', 'some bread', 'some cheese']],
  ['Which one can fly?', 'a bird', ['a fish', 'a cat', 'a cow']],
  ['What do plants need to grow?', 'water and light', ['sweets and toys', 'shoes and socks', 'only darkness']],
  ['What is a puppy?', 'a baby dog', ['a baby cat', 'a baby cow', 'a baby duck']],
  ['What does a chick grow up to be?', 'a hen', ['a dog', 'a frog', 'a horse']],
  ['Which part of your body do you see with?', 'your eyes', ['your ears', 'your nose', 'your feet']],
  ['Which part of your body do you hear with?', 'your ears', ['your eyes', 'your hands', 'your knees']],
  ['Where do we keep food cold?', 'in a fridge', ['in an oven', 'in a bath', 'on a radiator']],
  ['What should you wear when it rains?', 'a raincoat', ['sunglasses', 'a swimsuit', 'slippers']],
  ['Which one is hot?', 'the sun', ['an ice cube', 'snow', 'an ice lolly']],
  ['Which animal has a long trunk?', 'an elephant', ['a giraffe', 'a lion', 'a zebra']],
  ['Which animal has a very long neck?', 'a giraffe', ['a pig', 'a rabbit', 'a mouse']],
  ['Who helps us when we are poorly?', 'a doctor', ['a builder', 'a pilot', 'a baker']],
];
const factGen = (bank: [string, string, string[]][], topic: (q: string) => string): Gen => (m) => {
  const [q, right, wrongs] = m.pick(bank);
  return mcq(m, q, right, wrongs, topic(q));
};
const worldTopic = (q: string) => (/animal|puppy|chick|bees|fish/.test(q) ? 'animals' : /season|dark|rain|sun|sky|hot/i.test(q) ? 'weather and seasons' : /body|eyes|ears|teeth|feet|poorly|wear/.test(q) ? 'ourselves' : 'the world around us');

// ---- reception -------------------------------------------------------------------------------------------------------

const CVC = ['cat', 'dog', 'sun', 'pig', 'hat', 'bed', 'cup', 'map', 'hen', 'fox', 'bus', 'net', 'pin', 'jam', 'log', 'rug', 'web', 'zip', 'van', 'mud'];
const DIGRAPH: [string, string[]][] = [['ship', ['sh', 'i', 'p']], ['chip', ['ch', 'i', 'p']], ['thin', ['th', 'i', 'n']], ['shop', ['sh', 'o', 'p']], ['chop', ['ch', 'o', 'p']], ['fish', ['f', 'i', 'sh']], ['ring', ['r', 'i', 'ng']], ['boat', ['b', 'oa', 't']], ['rain', ['r', 'ai', 'n']], ['seed', ['s', 'ee', 'd']], ['moon', ['m', 'oo', 'n']], ['car', ['c', 'ar']], ['fork', ['f', 'or', 'k']], ['frog', ['f', 'r', 'o', 'g']], ['stop', ['s', 't', 'o', 'p']], ['lamp', ['l', 'a', 'm', 'p']]];
const ALIEN = ['zort', 'vap', 'blim', 'steck', 'quemp', 'chab', 'thrip', 'jund', 'ploof', 'grend'];
const phonicsGens: Gen[] = [
  (m) => {
    const w = m.pick(CVC);
    return exact(`Blend these sounds into a word: ${[...w].join(' - ')}`, w, 'blending');
  },
  (m) => {
    const [w, s] = m.pick(DIGRAPH);
    return exact(`Blend these sounds into a word: ${s.join(' - ')}`, w, 'blending');
  },
  (m) => {
    const [w, s] = m.pick(DIGRAPH);
    return exact(`What is the first sound in '${w}'?`, s[0]!, 'first sounds', letterAlso(s[0]!));
  },
  (m) => {
    const w = m.pick(CVC);
    return exact(`What is the last sound in '${w}'?`, w.at(-1)!, 'last sounds', letterAlso(w.at(-1)!));
  },
  (m) => {
    const [w, s] = m.pick(DIGRAPH);
    return num(`How many sounds are in the word '${w}'?`, s.length, 'segmenting');
  },
  (m) => {
    const [sound, right, wrongs] = m.pick([['ee', 'seed', ['sock', 'man', 'cup']], ['sh', 'shop', ['cat', 'dog', 'pen']], ['ch', 'chin', ['tap', 'leg', 'fox']], ['oo', 'moon', ['rat', 'sit', 'bed']], ['ai', 'rain', ['hot', 'fun', 'lip']], ['ar', 'park', ['web', 'mix', 'pot']]] as const);
    return mcq(m, `Which word has the '${sound}' sound in it?`, right, wrongs, 'digraphs');
  },
  (m) => mcq(m, 'Which of these is a made-up word (not a real word)?', m.pick(ALIEN), m.shuffle(CVC), 'real and made-up words'),
  rhymeItem('rhyming words'),
];

const SENTENCES_RECEPTION = ['The dog ran.', 'I can see a cat.', 'We went to the park.', 'My mum has a red hat.', 'The sun is hot.', 'I like to play.', 'The pig is in the mud.', 'Sam has a big bag.'];
const SENTENCES_KS1 = ['The children played in the park.', 'My dog likes to dig holes.', 'We had fish and chips for tea.', 'The wind blew the leaves off the tree.', 'Grandad planted some seeds in the garden.', 'The train was late this morning.'];
/** "Which sentence is written correctly?": the sentence, then three versions that are each wrong in a different way. */
function sentenceCheck(m: Maker, s: string, topic: string): Draft | null {
  const words = s.split(' ');
  const low = s[0]!.toLowerCase() + s.slice(1);
  const noStop = s.replace(/\.$/, '');
  const i = m.int(1, words.length - 1);
  const midCap = [words[0]!.toLowerCase(), ...words.slice(1).map((w, j) => (j + 1 === i ? w[0]!.toUpperCase() + w.slice(1) : w))].join(' ');
  const wrongs = [...new Set([low, noStop, midCap])].filter((x) => x !== s);
  return wrongs.length === 3 ? mcq(m, 'Which sentence is written correctly?', s, wrongs, topic) : null;
}
const RECEPTION_TASKS: [string, string][] = [
  ['Write two sentences about your favourite animal.', 'My favourite animal is a cat. It is soft and it likes to sleep in the sun.'],
  ['Write two sentences about what you did at the weekend.', 'At the weekend I went to the park. I went on the swings with my dad.'],
  ['Write two sentences about a day at the seaside.', 'We went to the seaside. I made a big sand castle.'],
  ['Write two sentences about a teddy who got lost.', 'Ted got lost in the shop. Mum found him under a box.'],
];
const RECEPTION_RUBRIC = '4 marks in all, 1 mark for each: (1) writes about what was asked; (2) at least two sentences that make sense; (3) capital letters at the start and full stops at the end; (4) simple words spelt so they can be read (sounding out is fine at this age).';
const writingGensReception: Gen[] = [
  (m) => sentenceCheck(m, m.pick(SENTENCES_RECEPTION), 'capital letters and full stops'),
  spelling(WORDS_Y12.filter((w) => w.length >= 4 && w.length <= 6), 'spelling tricky words'),
  (m) => {
    const [q, right, wrongs] = m.pick([["I ___ a cat.", 'have', ['has', 'haves', 'having']], ['She ___ to school.', 'went', ['goed', 'go', 'wented']], ['We ___ happy.', 'are', ['is', 'am', 'be']], ['The dogs ___ barking.', 'were', ['was', 'is', 'am']]] as const);
    return mcq(m, `Which word fits in the gap? '${q}'`, right, wrongs, 'making sense');
  },
  (m) => {
    const [clue, w] = m.pick([['a pet that says miaow', 'cat'], ['you sleep in it', 'bed'], ['it shines in the sky', 'sun'], ['you drink from it', 'cup'], ['a farm animal that says oink', 'pig'], ['it has a lid and you put things in it', 'box']] as const);
    const gap = m.int(0, w.length - 1);
    return exact(`Fill in the missing letter and write the whole word: ${w.slice(0, gap)}_${w.slice(gap + 1)} (${clue})`, w, 'spelling simple words');
  },
];

const mathsGensReception: Gen[] = [
  (m) => {
    const n = m.int(8, 20);
    return num(`How many are there? ${Array(n).fill(m.pick(OBJ)).join(' ')}`, n, 'counting to 20');
  },
  (m) => {
    const n = m.int(5, 19);
    return num(`What is one more than ${n}?`, n + 1, 'one more and one less');
  },
  (m) => {
    const n = m.int(6, 20);
    return num(`What is one less than ${n}?`, n - 1, 'one more and one less');
  },
  (m) => {
    const a = m.int(1, 6);
    const b = m.int(1, 10 - a);
    return num(`${a} + ${b} =`, a + b, 'adding');
  },
  (m) => {
    const a = m.int(4, 10);
    const b = m.int(1, a - 1);
    return num(`${a} − ${b} =`, a - b, 'taking away');
  },
  (m) => {
    const a = m.int(1, 9);
    return num(`${a} + ___ = 10. What is the missing number?`, 10 - a, 'number bonds to 10');
  },
  (m) => {
    const a = m.int(1, 5);
    return num(`What is double ${a}?`, a * 2, 'doubling');
  },
  (m) => {
    const a = m.pick([2, 4, 6, 8, 10]);
    return num(`What is half of ${a}?`, a / 2, 'halving');
  },
  (m) => {
    const n = m.pick([4, 6, 8, 10]);
    return num(`Share ${n} sweets equally between 2 children. How many does each child get?`, n / 2, 'sharing');
  },
  (m) => {
    const a = m.int(11, 19);
    return num(`Which number is between ${a - 1} and ${a + 1}?`, a, 'numbers to 20');
  },
  (m) => {
    const start = m.pick([2, 4, 6]);
    return num(`What comes next? ${start}, ${start + 2}, ${start + 4}, ___`, start + 6, 'patterns');
  },
  (m) => {
    const [s, right, wrongs] = m.pick([['Which shape has 3 sides?', 'a triangle', ['a square', 'a circle', 'a rectangle']], ['Which shape has 4 equal sides?', 'a square', ['a triangle', 'a circle', 'an oval']], ['Which shape has no corners?', 'a circle', ['a square', 'a triangle', 'a rectangle']]] as const);
    return mcq(m, s, right, wrongs, 'shapes');
  },
  (m) => {
    const [s, n] = m.pick([['square', 4], ['triangle', 3], ['rectangle', 4]] as const);
    return num(`How many corners does a ${s} have?`, n, 'shapes');
  },
];

// ---- Key Stage 1 ----------------------------------------------------------------------------------------------------

type Tagged = [string, string][];
const S = (words: string): Tagged => words.split(' ').map((w) => w.split('/') as [string, string]);
const KS1_SENTS: Tagged[] = [
  S('The/x happy/adjective dog/noun ran/verb quickly./adverb'),
  S('A/x tall/adjective girl/noun kicked/verb the/x red/adjective ball./noun'),
  S('My/x little/adjective brother/noun sang/verb loudly./adverb'),
  S('The/x old/adjective man/noun slowly/adverb opened/verb the/x gate./noun'),
  S('Seven/x green/adjective frogs/noun jumped/verb into/x the/x pond./noun'),
];
const KS2_SENTS: Tagged[] = [
  S('She/pronoun hid/verb the/determiner key/noun under/preposition the/determiner old/adjective mat/noun because/conjunction she/pronoun was/x worried./adjective'),
  S('Although/conjunction the/determiner storm/noun was/x fierce,/adjective the/determiner sailors/noun bravely/adverb continued./verb'),
  S('We/pronoun waited/verb patiently/adverb outside/preposition the/determiner cinema/noun until/conjunction it/pronoun opened./verb'),
  S('Those/determiner enormous/adjective elephants/noun walked/verb slowly/adverb towards/preposition the/determiner river./noun'),
  S('Every/determiner child/noun in/preposition the/determiner class/noun wrote/verb a/x poem/noun about/preposition winter./noun'),
  S('They/pronoun quickly/adverb finished/verb their/x homework/noun before/preposition dinner./noun'),
];
const clean = (w: string) => w.replace(/[.,]/g, '');
const wordClass = (sents: Tagged[], classes: string[]): Gen => (m) => {
  const s = m.pick(sents);
  const cls = m.pick(classes.filter((c) => s.some(([, t]) => t === c)));
  const right = clean(m.pick(s.filter(([, t]) => t === cls))[0]);
  const wrongs = [...new Set(s.filter(([, t]) => t !== cls && t !== 'x').map(([w]) => clean(w)))].filter((w) => !s.some(([x, t]) => clean(x) === w && t === cls));
  if (wrongs.length < 3) return null;
  const text = s.map(([w]) => w).join(' ');
  return mcq(m, `Which word in this sentence is ${/^[aeiou]/.test(cls) ? 'an' : 'a'} ${cls}? '${text}'`, right, wrongs, 'word classes');
};
const mcqBank = (bank: readonly (readonly [string, string, readonly string[], string])[]): Gen => (m) => {
  const [q, right, wrongs, topic] = m.pick(bank);
  return mcq(m, q, right, wrongs, topic);
};
const exactBank = (bank: readonly (readonly [string, string, string, (readonly string[])?])[]): Gen => (m) => {
  const [q, a, topic, also] = m.pick(bank);
  return exact(q, a, topic, [...(also ?? [])]);
};

const KS1_GPS_MCQ = [
  ['Which sentence is a question?', 'Where is my coat?', ['Shut the door.', 'What a lovely day it is!', 'The bus is late.'], 'sentence types'],
  ['Which sentence is a command?', 'Put your shoes on.', ['Are your shoes on?', 'My shoes are new.', 'How shiny your shoes are!'], 'sentence types'],
  ['Which sentence is an exclamation?', 'What a huge cake that is!', ['Is that a huge cake?', 'Eat the cake.', 'The cake is on the table.'], 'sentence types'],
  ["Which punctuation mark should end this sentence? 'Can we go to the park'", 'a question mark', ['a full stop', 'an exclamation mark', 'a comma'], 'punctuation'],
  ["Which punctuation mark should end this sentence? 'The cat is asleep'", 'a full stop', ['a question mark', 'a comma', 'an apostrophe'], 'punctuation'],
  ["Which word should have a capital letter? 'My friend sam has a dog.'", 'sam', ['friend', 'has', 'dog'], 'capital letters'],
  ["Which word should have a capital letter? 'We went to london on the train.'", 'london', ['went', 'train', 'on'], 'capital letters'],
  ['Which sentence is in the past tense?', 'I walked to school.', ['I walk to school.', 'I am walking to school.', 'I will walk to school.'], 'tense'],
  ["Which word joins the two parts? 'I was cold ___ I put my coat on.'", 'so', ['but', 'or', 'because'], 'joining words'],
  ["Which word joins the two parts? 'I like apples ___ I do not like pears.'", 'but', ['so', 'or', 'because'], 'joining words'],
  ["Which word joins the two parts? 'Do you want milk ___ juice?'", 'or', ['but', 'so', 'because'], 'joining words'],
  ["Which word joins the two parts? 'I stayed inside ___ it was raining.'", 'because', ['but', 'or', 'so'], 'joining words'],
  ['Which of these is an expanded noun phrase?', 'the big, fluffy cat', ['the cat sat', 'cats can run', 'it was'], 'noun phrases'],
  ['Which sentence uses commas in a list correctly?', 'I bought eggs, milk, bread and cheese.', ['I bought, eggs milk bread and cheese.', 'I bought eggs milk, bread, and, cheese.', 'I, bought eggs milk bread and cheese.'], 'commas in lists'],
  ['Which sentence uses an apostrophe correctly?', "Sam's bike is red.", ["Sams' bike is red.", "Sams bike's is red.", "Sam's bike's is red."], 'apostrophes'],
] as const;
const KS1_GPS_EXACT = [
  ["Write the short form (contraction) of 'do not'.", "don't", 'contractions'],
  ["Write the short form (contraction) of 'I am'.", "I'm", 'contractions'],
  ["Write the short form (contraction) of 'it is'.", "it's", 'contractions'],
  ["Write the short form (contraction) of 'did not'.", "didn't", 'contractions'],
  ["Write the short form (contraction) of 'we will'.", "we'll", 'contractions'],
  ["Write the short form (contraction) of 'is not'.", "isn't", 'contractions'],
  ["Add -ing to 'run'.", 'running', 'suffixes'],
  ["Add -ing to 'hop'.", 'hopping', 'suffixes'],
  ["Add -ing to 'make'.", 'making', 'suffixes'],
  ["Add -ed to 'skip'.", 'skipped', 'suffixes'],
  ["Add -ed to 'smile'.", 'smiled', 'suffixes'],
  ["Add -er to 'big'.", 'bigger', 'suffixes'],
  ["Add -est to 'happy'.", 'happiest', 'suffixes'],
  ["Add -ful to 'help'.", 'helpful', 'suffixes'],
  ["Add -less to 'care'.", 'careless', 'suffixes'],
  ["Add -ness to 'kind'.", 'kindness', 'suffixes'],
  ["Add -ment to 'enjoy'.", 'enjoyment', 'suffixes'],
  ["Add -ly to 'slow'.", 'slowly', 'suffixes'],
  ["Write the plural of 'fox'.", 'foxes', 'plurals'],
  ["Write the plural of 'box'.", 'boxes', 'plurals'],
  ["Write the plural of 'wish'.", 'wishes', 'plurals'],
  ["Write the plural of 'baby'.", 'babies', 'plurals'],
  ["Write the plural of 'church'.", 'churches', 'plurals'],
] as const;
const KS1_TASKS: [string, string][] = [
  ['Write a short story about an animal who gets lost. Write at least four sentences.', 'One sunny morning, a little brown rabbit hopped too far from home. He looked around but everything was strange. He felt scared because it was getting dark. Then he saw his mum by the big oak tree and ran to her as fast as he could.'],
  ['Write about a day at the seaside. Write at least four sentences.', 'Last summer we went to the seaside. First, we built a huge sandcastle with a moat. Then we paddled in the cold, blue sea. At the end of the day we had ice creams because it was so hot.'],
  ['Write a letter to a friend about your birthday party. Write at least four sentences.', 'Dear Ali, I had a brilliant birthday party on Saturday. We played games and ate a chocolate cake. My best present was a red bike. I wish you could have come! From Sam'],
];
const KS1_RUBRIC = '8 marks in all, 1 mark for each: Composition — (1) answers the task; (2) events or ideas in a sensible order, with a beginning and an end; (3) joins ideas with words like and, but, because, when or so; (4) some describing words, e.g. expanded noun phrases. Transcription — (5) capital letters and full stops in most sentences; (6) some question marks, exclamation marks or commas in a list used correctly; (7) past or present tense kept the same; (8) Year 1–2 words and common exception words mostly spelt right.';
const KS1_WRITING_MCQ = [
  ["Which word is the best way to start the next sentence? 'First, we packed our bags. ___, we got on the train.'", 'Next', ['First', 'Because', 'But'], 'ordering ideas'],
  ['Which of these is an expanded noun phrase?', 'a tiny, shiny shell', ['a shell', 'shells are hard', 'it shone'], 'noun phrases'],
  ["Which word could replace 'big' to make the sentence more interesting? 'The big giant stamped.'", 'enormous', ['small', 'quick', 'happy'], 'choosing words'],
  ["Which sentence joins the ideas with 'because' correctly?", 'I wore my coat because it was cold.', ['I wore my coat because.', 'Because I wore my coat.', 'I wore because my coat it was cold.'], 'joining words'],
] as const;

const mathsGensKS1: Gen[] = [
  (m) => {
    const a = m.int(21, 79);
    const b = m.int(11, 99 - a);
    return num(`${a} + ${b} =`, a + b, 'adding 2-digit numbers');
  },
  (m) => {
    const a = m.int(40, 99);
    const b = m.int(11, a - 10);
    return num(`${a} − ${b} =`, a - b, 'subtracting 2-digit numbers');
  },
  (m) => {
    const t = m.pick([2, 5, 10]);
    const n = m.int(2, 12);
    return num(`${n} × ${t} =`, n * t, 'times tables (2, 5 and 10)');
  },
  (m) => {
    const t = m.pick([2, 5, 10]);
    const n = m.int(2, 12);
    return num(`${n * t} ÷ ${t} =`, n, 'dividing');
  },
  (m) => {
    const a = m.int(3, 9);
    const sum = m.int(a + 5, 20);
    return num(`___ + ${a} = ${sum}. What is the missing number?`, sum - a, 'missing numbers');
  },
  (m) => {
    const t = m.int(1, 9);
    const o = m.int(1, 9);
    return num(`How many tens are in ${t * 10 + o}?`, t, 'place value');
  },
  (m) => {
    const t = m.int(2, 9);
    const o = m.int(1, 9);
    return num(`What is ${t * 10} + ${o}?`, t * 10 + o, 'place value');
  },
  (m) => {
    const n = m.pick([8, 10, 12, 14, 16, 18, 20]);
    return num(`What is half of ${n}?`, n / 2, 'fractions');
  },
  (m) => {
    const n = m.pick([8, 12, 16, 20, 24]);
    return num(`What is 1/4 of ${n}?`, n / 4, 'fractions');
  },
  (m) => {
    const n = m.pick([8, 12, 16]);
    return num(`What is 3/4 of ${n}?`, (n * 3) / 4, 'fractions');
  },
  (m) => {
    const a = m.pick([10, 20, 30, 40]);
    const b = m.pick([5, 10, 20, 50]);
    return num(`How much is ${a}p + ${b}p? (in pence)`, a + b, 'money', { unit: 'p' });
  },
  (m) => {
    const spend = m.int(11, 45);
    return num(`You pay with a 50p coin for something that costs ${spend}p. How much change do you get? (in pence)`, 50 - spend, 'money', { unit: 'p' });
  },
  (m) => {
    const [q, a] = m.pick([['How many minutes are in an hour?', 60], ['How many days are in a week?', 7], ['How many months are in a year?', 12], ['How many centimetres are in a metre?', 100]] as const);
    return num(q, a, 'measures');
  },
  (m) => {
    const h = m.int(1, 11);
    return mcq(m, `Which clock time shows half past ${h}?`, `${h}:30`, [`${h}:00`, `${h - 1 || 12}:30`, `${h}:15`], 'time');
  },
  (m) => {
    const [s, k, n] = m.pick([['cube', 'faces', 6], ['pentagon', 'sides', 5], ['hexagon', 'sides', 6], ['triangle', 'vertices (corners)', 3], ['square-based pyramid', 'faces', 5]] as const);
    return num(`How many ${k} does a ${s} have?`, n, 'shapes');
  },
  (m) => {
    const a = m.int(11, 19);
    const b = m.int(4, 9);
    return num(`Sam has ${a} marbles. He gets ${b} more. How many does he have now?`, a + b, 'word problems');
  },
  (m) => {
    const bags = m.int(2, 6);
    const each = m.pick([2, 5, 10]);
    return num(`There are ${bags} bags with ${each} apples in each. How many apples are there altogether?`, bags * each, 'word problems');
  },
  (m) => {
    const step = m.pick([2, 3, 5, 10]);
    const s = step * m.int(1, 4);
    return num(`Count in ${step}s: ${s}, ${s + step}, ${s + 2 * step}, ___`, s + 3 * step, 'counting in steps');
  },
  (m) => {
    const a = m.int(20, 89);
    let b = m.int(20, 89);
    if (a === b) b += 1;
    return mcq(m, `Which sign goes in the gap? ${a} ___ ${b}`, a < b ? 'less than (<)' : 'greater than (>)', [a < b ? 'greater than (>)' : 'less than (<)', 'equals (=)', 'plus (+)'], 'comparing numbers');
  },
];

const SCIENCE_KS1: [string, string, string[], string][] = [
  ['What do plants need to grow well?', 'water, light and warmth', ['darkness and salt', 'sweets and juice', 'only soil'], 'plants'],
  ['Which part of a plant takes in water from the soil?', 'the roots', ['the petals', 'the flower', 'the seeds'], 'plants'],
  ['What does a seed grow into?', 'a plant', ['a rock', 'a bird', 'a cloud'], 'plants'],
  ['Which tree loses its leaves in autumn?', 'a deciduous tree', ['an evergreen tree', 'a pine tree', 'a holly tree'], 'plants'],
  ['Which animal is a mammal?', 'a dog', ['a robin', 'a goldfish', 'a frog'], 'animals'],
  ['Which animal is a bird?', 'a robin', ['a bat', 'a bee', 'a mouse'], 'animals'],
  ['Which animal is an amphibian?', 'a frog', ['a snake', 'a shark', 'a horse'], 'animals'],
  ['Which animal is a reptile?', 'a lizard', ['a cat', 'a salmon', 'a duck'], 'animals'],
  ['What does a herbivore eat?', 'plants only', ['meat only', 'plants and meat', 'nothing'], 'animals'],
  ['What does a carnivore eat?', 'meat', ['only grass', 'only fruit', 'only seeds'], 'animals'],
  ['What do we call an animal that eats plants and meat?', 'an omnivore', ['a herbivore', 'a carnivore', 'a vegetarian'], 'animals'],
  ['What do all animals need to stay alive?', 'water, food and air', ['toys, games and books', 'only sunlight', 'only sleep'], 'animals'],
  ['What does a caterpillar turn into?', 'a butterfly', ['a beetle', 'a worm', 'a bee'], 'life cycles'],
  ['What is a baby frog called?', 'a tadpole', ['a kitten', 'a cub', 'a calf'], 'life cycles'],
  ['What is a baby sheep called?', 'a lamb', ['a foal', 'a chick', 'a puppy'], 'life cycles'],
  ['Why should we wash our hands before eating?', 'to get rid of germs', ['to make them warm', 'to make them grow', 'to change their colour'], 'ourselves'],
  ['Which sense do we use our tongue for?', 'taste', ['sight', 'hearing', 'smell'], 'ourselves'],
  ['Which material is transparent (see-through)?', 'glass', ['wood', 'metal', 'brick'], 'materials'],
  ['Which material is best for a raincoat?', 'plastic', ['paper', 'cotton wool', 'cardboard'], 'materials'],
  ['Which material is flexible (bendy)?', 'rubber', ['glass', 'stone', 'brick'], 'materials'],
  ['Which of these is a natural material?', 'wood', ['plastic', 'nylon', 'glass'], 'materials'],
  ['What happens to chocolate when it gets hot?', 'it melts', ['it freezes', 'it grows', 'it turns to stone'], 'materials'],
  ['In which season do most trees lose their leaves?', 'autumn', ['spring', 'summer', 'winter'], 'seasons'],
  ['Which season has the longest days?', 'summer', ['winter', 'autumn', 'spring'], 'seasons'],
  ['Which of these is living?', 'a tree', ['a rock', 'a chair', 'a cup'], 'living things and habitats'],
  ['Where does a polar bear live?', 'in icy Arctic places', ['in a hot desert', 'in a rainforest', 'in a pond'], 'living things and habitats'],
  ['What does a food chain show?', 'what eats what', ['how food is cooked', 'where food is sold', 'how plants drink'], 'living things and habitats'],
];
const SCIENCE_KS2: [string, string, string[], string][] = [
  ['What force pulls objects towards the Earth?', 'gravity', ['friction', 'magnetism', 'air resistance'], 'forces'],
  ['Which force slows down a falling parachute?', 'air resistance', ['gravity', 'magnetism', 'upthrust from the ground'], 'forces'],
  ['Which force acts between two surfaces rubbing together?', 'friction', ['gravity', 'magnetism', 'upthrust'], 'forces'],
  ['What do levers, pulleys and gears let us do?', 'move things using a smaller force', ['make things heavier', 'stop gravity', 'make light'], 'forces'],
  ['How long does the Earth take to orbit the Sun?', 'about 365 days', ['24 hours', 'about 28 days', '7 days'], 'Earth and space'],
  ['Why do we have day and night?', 'the Earth spins on its axis', ['the Sun moves round the Earth', 'the Moon blocks the Sun', 'clouds cover the Sun'], 'Earth and space'],
  ['Which planet is closest to the Sun?', 'Mercury', ['Venus', 'Mars', 'Earth'], 'Earth and space'],
  ['What shape are the Sun, the Earth and the Moon (roughly)?', 'spheres', ['cubes', 'flat discs', 'cones'], 'Earth and space'],
  ['How do we see objects?', 'light travels from the object into our eyes', ['light travels from our eyes to the object', 'our eyes make their own light', 'sound bounces off the object'], 'light'],
  ['How is a shadow formed?', 'an object blocks the light', ['light shines through glass', 'the object gives out darkness', 'a mirror reflects the light'], 'light'],
  ['How does light travel?', 'in straight lines', ['in circles', 'in zigzags only', 'round corners'], 'light'],
  ['How is sound made?', 'by something vibrating', ['by light reflecting', 'by magnets', 'by gravity'], 'sound'],
  ['What happens to a sound as you move further away from it?', 'it gets fainter', ['it gets louder', 'it gets higher', 'nothing changes'], 'sound'],
  ['Through which of these can sound NOT travel?', 'a vacuum (empty space)', ['water', 'air', 'wood'], 'sound'],
  ['Which material is a good electrical conductor?', 'copper', ['plastic', 'wood', 'rubber'], 'electricity'],
  ['What happens to a bulb when the switch in its circuit is opened?', 'it goes off', ['it gets brighter', 'it flashes', 'nothing changes'], 'electricity'],
  ['What happens to a bulb if you add more cells (batteries) to the circuit?', 'it gets brighter', ['it gets dimmer', 'it goes off', 'it changes colour'], 'electricity'],
  ['What is it called when liquid water changes into water vapour?', 'evaporation', ['condensation', 'freezing', 'melting'], 'states of matter'],
  ['What is it called when water vapour turns back into liquid water?', 'condensation', ['evaporation', 'melting', 'dissolving'], 'states of matter'],
  ['At what temperature does pure water freeze?', '0 °C', ['100 °C', '10 °C', '−50 °C'], 'states of matter'],
  ['At what temperature does pure water boil at sea level?', '100 °C', ['0 °C', '50 °C', '212 °C'], 'states of matter'],
  ['Which of these is a gas?', 'oxygen', ['ice', 'sand', 'wood'], 'states of matter'],
  ['What is the job of the heart?', 'to pump blood around the body', ['to digest food', 'to help us breathe', 'to help us think'], 'the human body'],
  ['Which organs do we breathe with?', 'the lungs', ['the kidneys', 'the stomach', 'the liver'], 'the human body'],
  ['What carries oxygen around the body?', 'the blood', ['the bones', 'the muscles', 'the skin'], 'the human body'],
  ['What is the process by which green plants make their food using sunlight?', 'photosynthesis', ['evaporation', 'respiration only', 'pollination'], 'plants'],
  ['Which part of a flower makes pollen?', 'the stamen', ['the petal', 'the sepal', 'the stem'], 'plants'],
  ['What are fossils?', 'the remains or traces of living things from long ago', ['rocks made from cooled lava', 'crystals that grow in caves', 'seeds that never grew'], 'evolution and inheritance'],
  ['Who is famous for the theory of evolution by natural selection?', 'Charles Darwin', ['Isaac Newton', 'Albert Einstein', 'Marie Curie'], 'evolution and inheritance'],
  ['Offspring are not exactly like their parents. What is this called?', 'variation', ['evaporation', 'gravity', 'friction'], 'evolution and inheritance'],
  ['What do we call animals with a backbone?', 'vertebrates', ['invertebrates', 'amphibians only', 'insects'], 'classification'],
  ['Which of these is NOT a mammal?', 'a penguin', ['a whale', 'a bat', 'a dolphin'], 'classification'],
  ['Which type of rock forms when lava cools?', 'igneous', ['sedimentary', 'chalk', 'fossil'], 'rocks'],
  ['Which metal is attracted to a magnet?', 'iron', ['copper', 'aluminium', 'gold'], 'magnets'],
  ['What happens when two north poles of magnets are pushed together?', 'they repel (push apart)', ['they attract (pull together)', 'they melt', 'nothing happens'], 'magnets'],
  ['Which of these changes can be reversed?', 'melting ice', ['burning wood', 'baking a cake', 'frying an egg'], 'materials and changes'],
  ['What happens when sugar is stirred into warm water?', 'it dissolves', ['it melts', 'it evaporates', 'it freezes'], 'materials and changes'],
];

// ---- Key Stage 2 ----------------------------------------------------------------------------------------------------

const KS2_GPS_MCQ = [
  ['Which sentence is written in the present perfect?', 'She has finished her homework.', ['She finished her homework.', 'She is finishing her homework.', 'She will finish her homework.'], 'verb tenses'],
  ['Which sentence is written in the passive voice?', 'The window was broken by the ball.', ['The ball broke the window.', 'The ball is breaking the window.', 'The ball will break the window.'], 'active and passive'],
  ["Which word completes the sentence? 'The boy ___ won the race was delighted.'", 'who', ['which', 'where', 'when'], 'relative clauses'],
  ["Which word completes the sentence? 'This is the house ___ I was born.'", 'where', ['who', 'which', 'whose'], 'relative clauses'],
  ['Which sentence contains a relative clause?', 'The cake, which Mum baked, was delicious.', ['The cake was delicious.', 'Mum baked a delicious cake.', 'The cake was baked and eaten.'], 'relative clauses'],
  ['Which sentence is written in Standard English?', 'We were going to the shops.', ['We was going to the shops.', 'We is going to the shops.', 'We be going to the shops.'], 'Standard English'],
  ['Which sentence uses inverted commas correctly?', '"Come here," said Mum.', ['"Come here, said Mum."', 'Come here, "said Mum."', '"Come here" said, Mum.'], 'inverted commas'],
  ['Which sentence uses a comma correctly after a fronted adverbial?', 'After lunch, we went swimming.', ['After, lunch we went swimming.', 'After lunch we, went swimming.', 'After lunch we went, swimming.'], 'commas'],
  ['Which sentence uses a colon correctly?', 'You will need three things: a pen, a ruler and a rubber.', ['You will need: three things a pen, a ruler and a rubber.', 'You will need three: things a pen, a ruler and a rubber.', 'You will: need three things a pen, a ruler and a rubber.'], 'colons'],
  ['Which sentence uses a semi-colon correctly?', 'It was raining; we stayed inside.', ['It was; raining we stayed inside.', 'It; was raining we stayed inside.', 'It was raining we; stayed inside.'], 'semi-colons'],
  ['Which sentence uses brackets correctly?', 'My aunt (who lives in Leeds) is visiting us.', ['My aunt who (lives in Leeds) is visiting us.', 'My (aunt who lives) in Leeds is visiting us.', 'My aunt who lives in (Leeds is visiting) us.'], 'parenthesis'],
  ['Which sentence uses an apostrophe to show possession correctly?', "The dog's bone was buried in the garden.", ['The dogs bone was buried in the garden.', "The dog's bone's was buried in the garden.", "The do'gs bone was buried in the garden."], 'apostrophes'],
  ['Which sentence uses an apostrophe correctly?', "The children's coats were wet.", ["The childrens' coats were wet.", "The childrens coat's were wet.", "The children's coat's were wet."], 'apostrophes'],
  ["Which word is a modal verb in this sentence? 'We might go to the beach tomorrow.'", 'might', ['go', 'beach', 'tomorrow'], 'modal verbs'],
  ["Which part is the subordinate clause? 'Although it was raining, we played outside.'", 'Although it was raining', ['we played outside', 'played outside', 'it was'], 'clauses'],
  ['Which sentence is the most formal?', 'I would be grateful if you could reply soon.', ['Can you get back to me soon?', 'Hurry up and reply, will you?', 'Reply soon, yeah?'], 'formal language'],
  ["Which word means the opposite of 'generous'?", 'selfish', ['kind', 'giving', 'helpful'], 'antonyms'],
  ["Which word is closest in meaning to 'enormous'?", 'huge', ['tiny', 'noisy', 'quick'], 'synonyms'],
  ['Which sentence uses the subjunctive form?', 'If I were you, I would apologise.', ['If I was you, I would apologise.', 'If I am you, I would apologise.', 'If I be you, I would apologise.'], 'subjunctive'],
  ['Which sentence uses a hyphen correctly to make the meaning clear?', 'We saw a man-eating shark.', ['We saw a man eating-shark.', 'We-saw a man eating shark.', 'We saw a-man eating shark.'], 'hyphens'],
  ['Which sentence begins with a fronted adverbial?', 'Later that day, the rain stopped.', ['The rain stopped later that day.', 'The rain stopped.', 'It rained, then it stopped.'], 'adverbials'],
] as const;
const KS2_GPS_EXACT = [
  ["Add a prefix to 'possible' to make a word that means the opposite.", 'impossible', 'prefixes'],
  ["Add a prefix to 'appear' to make a word that means the opposite.", 'disappear', 'prefixes'],
  ["Add a prefix to 'legal' to make a word that means the opposite.", 'illegal', 'prefixes'],
  ["Add a prefix to 'regular' to make a word that means the opposite.", 'irregular', 'prefixes'],
  ["Add a prefix to 'polite' to make a word that means the opposite.", 'impolite', 'prefixes'],
  ["Add a prefix to 'agree' to make a word that means the opposite.", 'disagree', 'prefixes'],
  ["Add the suffix -ous to 'danger'.", 'dangerous', 'suffixes'],
  ["Add the suffix -ous to 'poison'.", 'poisonous', 'suffixes'],
  ["Add the suffix -ous to 'fame'.", 'famous', 'suffixes'],
  ["Add the suffix -tion to 'invent'.", 'invention', 'suffixes'],
  ["Add the suffix -able to 'adore'.", 'adorable', 'suffixes'],
  ["Write 'a' or 'an' to go before 'hour'.", 'an', 'determiners'],
  ["Write 'a' or 'an' to go before 'unicorn'.", 'a', 'determiners'],
  ["Write 'a' or 'an' to go before 'honest man'.", 'an', 'determiners'],
  ["Write 'a' or 'an' to go before 'European city'.", 'a', 'determiners'],
  ["Write the past tense of 'swim'.", 'swam', 'verb tenses'],
  ["Write the past tense of 'catch'.", 'caught', 'verb tenses'],
  ["Write the past tense of 'teach'.", 'taught', 'verb tenses'],
  ["Write the past tense of 'bring'.", 'brought', 'verb tenses'],
  ["Write the past tense of 'freeze'.", 'froze', 'verb tenses'],
  ["Write the plural of 'knife'.", 'knives', 'plurals'],
  ["Write the plural of 'mouse'.", 'mice', 'plurals'],
  ["Write the plural of 'potato'.", 'potatoes', 'plurals'],
  ["Write the plural of 'cactus'.", 'cacti', 'plurals', ['cactuses']],
  ["What word class is 'quickly' in 'She ran quickly.'?", 'adverb', 'word classes', ['an adverb']],
] as const;
const KS2_WRITING_MCQ = [
  ["Which word is the best fronted adverbial for this sentence? '___, the fox crept towards the henhouse.'", 'Silently', ['Silent', 'Silence', 'Silents'], 'sentence openers'],
  ["Which word best links these paragraphs? '___, the castle was quiet again.'", 'Eventually', ['Because', 'Although', 'Unless'], 'cohesion'],
  ['Which opening would you use in a letter to your headteacher?', 'I am writing to ask whether we could have a longer playtime.', ['Hiya! Can we have more playtime?', 'Oi, more playtime please.', 'Playtime is too short, sort it out.'], 'formal and informal writing'],
  ["Which word could replace 'said' to show that the character is angry?", 'snapped', ['whispered', 'giggled', 'sighed'], 'choosing words'],
  ['Which sentence has the most precise, interesting description?', 'The ancient oak creaked as the icy wind tore at its branches.', ['The tree was there and it was windy.', 'There was a tree and some wind.', 'It was a tree in the wind.'], 'description'],
  ['Which sentence keeps the tense the same all the way through?', 'She opened the door and stepped into the dark hall.', ['She opened the door and steps into the dark hall.', 'She opens the door and stepped into the dark hall.', 'She will open the door and stepped into the dark hall.'], 'consistent tense'],
  ['Which sentence uses a relative clause to add detail?', 'The girl, who had never seen snow, gasped at the window.', ['The girl gasped at the window.', 'The girl gasped. She had never seen snow.', 'The girl and the window and the snow.'], 'sentence structure'],
] as const;
const KS2_TASKS: [string, string][] = [
  ['Write the opening of a story set in a forest at night. Aim for three short paragraphs.', 'The forest was silent except for the crunch of frost under Mia\'s boots. Above her, the moon hung like a silver coin, its light catching on twisted branches.\n\nSuddenly, a lantern flickered between the trees. Who would be out here at midnight? Holding her breath, she crept closer, her heart thudding against her ribs.\n\n"Is someone there?" she whispered. Nobody answered, but the lantern began to move away, deeper into the wood, as if it wanted her to follow.'],
  ['Write a persuasive letter to your headteacher asking for a longer playtime. Give at least three reasons.', 'Dear Mrs Patel,\n\nI am writing to ask whether our playtime could be ten minutes longer. Firstly, children who have had a chance to run around concentrate much better in lessons.\n\nSecondly, many of us spend half of playtime queuing for the toilets, so we hardly get to play. Furthermore, a longer break would give us more time to make friends with children in other classes.\n\nI hope you will consider this request. Thank you for reading my letter.\n\nYours sincerely,\nSam'],
  ['Write a diary entry as a character who has just found a secret door. Aim for three paragraphs.', 'Dear Diary,\n\nToday something astonishing happened. While I was helping Gran tidy the attic, I moved an old wardrobe and found a tiny wooden door, no taller than my knee, hidden behind it.\n\nAlthough Gran said it was probably just a cupboard, I could hear a faint ticking on the other side, like a hundred clocks. I tried the handle, but it was locked.\n\nTomorrow I am going to look for the key. I have a feeling it is somewhere in this house, waiting for me.'],
];
const KS2_RUBRIC = '10 marks in all, 1 mark for each: Composition and effect — (1) suits the purpose and the reader; (2) organised in paragraphs; (3) ideas developed with detail, e.g. description, dialogue or reasons; (4) vocabulary chosen for effect. Sentence structure — (5) a range of sentences, including subordinate and relative clauses; (6) varied openers, e.g. fronted adverbials; (7) tense used consistently. Punctuation and spelling — (8) sentence punctuation (capitals, full stops, question marks) mostly right; (9) a range of punctuation used correctly, e.g. commas, inverted commas, apostrophes; (10) Year 3–6 words mostly spelt right.';

const mathsGensKS2: Gen[] = [
  (m) => {
    const a = m.int(1200, 8999);
    const b = m.int(1100, 9999 - a);
    return num(`${commas(a)} + ${commas(b)} =`, a + b, 'addition');
  },
  (m) => {
    const a = m.int(4000, 9999);
    const b = m.int(1001, a - 500);
    return num(`${commas(a)} − ${commas(b)} =`, a - b, 'subtraction');
  },
  (m) => {
    const a = m.int(120, 899);
    const b = m.int(3, 9);
    return num(`${a} × ${b} =`, a * b, 'short multiplication');
  },
  (m) => {
    const a = m.int(1200, 3999);
    const b = m.int(12, 39);
    return num(`${commas(a)} × ${b} =`, a * b, 'long multiplication', { marks: 2 });
  },
  (m) => {
    const b = m.int(3, 9);
    const q = m.int(102, 399);
    return num(`${commas(q * b)} ÷ ${b} =`, q, 'short division');
  },
  (m) => {
    const b = m.int(13, 32);
    const q = m.int(105, 299);
    return num(`${commas(q * b)} ÷ ${b} =`, q, 'long division', { marks: 2 });
  },
  (m) => {
    const d = m.pick([4, 6, 8, 10, 12]);
    const half = d / 2;
    const a = m.int(1, half - 1);
    const b = m.int(1, d - 2 * a - 1 > 0 ? d - 2 * a - 1 : 1);
    return num(`${a}/${half} + ${b}/${d} =`, fracText(2 * a + b, d), 'adding fractions');
  },
  (m) => {
    const d = m.pick([3, 4, 5, 8]);
    const n = m.int(1, d - 1);
    const w = m.int(2, 9);
    return num(`${n}/${d} × ${w} =`, fracText(n * w, d), 'multiplying fractions');
  },
  (m) => {
    const d = m.pick([4, 5, 8]);
    const n = m.int(1, d - 1);
    const whole = d * m.int(15, 60);
    return num(`What is ${n}/${d} of ${whole}?`, (whole / d) * n, 'fractions of amounts');
  },
  (m) => {
    const p = m.pick([10, 15, 20, 25, 30, 40, 45, 60, 75]);
    const of = m.pick([80, 120, 200, 240, 300, 360, 400]);
    return num(`${p}% of ${of} =`, (p * of) / 100, 'percentages');
  },
  (m) => {
    const a = m.int(11, 99) | 1; // never a whole number (9.0 × 9 is not a decimals question)
    const b = m.int(3, 9);
    return num(`${dec(a / 10, 1)} × ${b} =`, dec((a * b) / 10, 1), 'decimals');
  },
  (m) => {
    const a = m.int(510, 999);
    const b = m.int(101, a - 100);
    return num(`${dec(a / 100)} − ${dec(b / 100)} =`, dec((a - b) / 100), 'decimals');
  },
  (m) => {
    const [x, k] = m.pick([[7, 2], [9, 2], [11, 2], [12, 2], [13, 2], [3, 3], [4, 3], [5, 3], [10, 3]] as const);
    return num(`${x}${k === 2 ? '²' : '³'} =`, x ** k, 'squares and cubes');
  },
  (m) => {
    const a = m.int(20, 40);
    const b = m.int(2, 6);
    const c = m.int(2, 5);
    return num(`${a} − ${b} × ${c} =`, a - b * c, 'order of operations');
  },
  (m) => {
    const v = m.int(11, 99);
    const k = m.pick([10, 100, 1000]);
    return m.r() < 0.5 ? num(`${dec(v / 10, 1)} × ${commas(k)} =`, (v * k) / 10, 'multiplying by 10, 100 and 1,000') : num(`${v} ÷ ${commas(k)} =`, dec(v / k, 3), 'dividing by 10, 100 and 1,000');
  },
  (m) => {
    const pence = m.int(320, 895);
    const n = m.int(3, 6);
    return num(`A cinema ticket costs £${(pence / 100).toFixed(2)}. How much do ${n} tickets cost, in pounds?`, dec((pence * n) / 100), 'money problems', { unit: '£' });
  },
  (m) => {
    const a = m.int(35, 80);
    const b = m.int(30, 140 - a);
    return num(`Two angles of a triangle are ${a}° and ${b}°. What is the third angle, in degrees?`, 180 - a - b, 'angles', { unit: '°' });
  },
  (m) => {
    const w = m.int(4, 12);
    const l = m.int(5, 15);
    return num(`A rectangle is ${l} cm long and ${w} cm wide. What is its area in cm²?`, w * l, 'area and perimeter');
  },
  (m) => {
    const w = m.int(4, 12);
    const l = m.int(5, 15);
    return num(`A rectangle is ${l} cm long and ${w} cm wide. What is its perimeter in cm?`, 2 * (w + l), 'area and perimeter', { unit: 'cm' });
  },
  (m) => {
    const mean = m.int(5, 12);
    const k = m.int(1, 4);
    const [a, b, c] = m.shuffle([mean - k, mean, mean + k]);
    return num(`What is the mean of ${a}, ${b} and ${c}?`, mean, 'statistics');
  },
  (m) => {
    const n = m.int(1100, 9899);
    return num(`Round ${commas(n)} to the nearest hundred.`, Math.round(n / 100) * 100, 'rounding');
  },
  (m) => {
    const [r, b] = m.pick([[2, 3], [3, 4], [1, 5], [3, 5]] as const);
    const k = m.int(2, 6);
    return num(`For every ${r} red beads on a necklace there are ${b} blue beads. There are ${r * k} red beads. How many blue beads are there?`, b * k, 'ratio');
  },
  (m) => {
    const t = -m.int(2, 9);
    const up = m.int(5, 15);
    return num(`The temperature is ${t} °C. It rises by ${up} degrees. What is the temperature now, in °C?`, t + up, 'negative numbers', { unit: '°C' });
  },
  (m) => {
    const h = m.int(2, 6);
    return num(`How many minutes are there in ${h} hours?`, h * 60, 'time');
  },
];

// ---- the papers -------------------------------------------------------------------------------------------------------

const STYLE: Record<string, string> = { nursery: 'the early-years style', reception: 'the early-years style', ks1: 'the Key Stage 1 test style', ks2: 'the SATs style' };
const NAME: Record<string, string> = { nursery: 'Nursery', reception: 'Reception', ks1: 'Key Stage 1', ks2: 'Key Stage 2' };
/** The stage as a short name ("Key Stage 2", without "(SATs)"). */
export const stageName = (stage: StageId): string => NAME[stage] ?? stageById(stage)?.label.replace(/\s*\(.*\)$/, '') ?? stage;
const SPELLING_NOTE = 'spelling words from the national curriculum word lists (Crown copyright, Open Government Licence v3.0)';

type Built = { items: Draft[]; passages?: Passage[]; notes?: string[] };
const writingPaper = (m: Maker, gens: Gen[], n: number, task: [string, string], rubric: string, marks: number): Built => ({
  items: [...fill(m, n, gens), extended(task[0], task[1], rubric, 'extended writing', marks)],
  notes: [SPELLING_NOTE],
});

const BUILD: Record<string, Record<string, (m: Maker) => Built>> = {
  nursery: {
    talk: (m) => readingPaper(RHYMES, m, [rhymeItem('rhyming words'), oppositeItem], 10),
    letters: (m) => ({ items: fill(m, 10, letterGens) }),
    numbers: (m) => ({ items: fill(m, 10, numberGensNursery) }),
    world: (m) => ({ items: fill(m, 10, [factGen(WORLD, worldTopic)]) }),
  },
  reception: {
    phonics: (m) => ({ items: fill(m, 12, phonicsGens) }),
    reading: (m) => readingPaper(RECEPTION_READING, m, [rhymeItem('rhyme'), (mm) => mcq(mm, 'Which word is a colour?', mm.pick(['red', 'blue', 'green', 'yellow']), ['run', 'sit', 'cup', 'dog'], 'reading words'), (mm) => mcq(mm, 'Which word is an animal?', mm.pick(['cat', 'duck', 'horse', 'pig']), ['jump', 'red', 'spoon', 'hat'], 'reading words')], 10),
    writing: (m) => writingPaper(m, writingGensReception, 9, m.pick(RECEPTION_TASKS), RECEPTION_RUBRIC, 4),
    maths: (m) => ({ items: fill(m, 14, mathsGensReception) }),
  },
  ks1: {
    reading: (m) => readingPaper(KS1_READING, m, [synonym(SYNONYMS_KS1)], 11),
    gps: (m) => ({ items: fill(m, 16, [mcqBank(KS1_GPS_MCQ), mcqBank(KS1_GPS_MCQ), exactBank(KS1_GPS_EXACT), exactBank(KS1_GPS_EXACT), wordClass(KS1_SENTS, ['noun', 'verb', 'adjective', 'adverb']), spelling(WORDS_Y12)]), notes: [SPELLING_NOTE] }),
    writing: (m) => writingPaper(m, [mcqBank(KS1_WRITING_MCQ), (mm) => sentenceCheck(mm, mm.pick(SENTENCES_KS1), 'capital letters and full stops'), spelling(WORDS_Y12), mcqBank(KS1_GPS_MCQ.filter((x) => x[3] === 'joining words' || x[3] === 'commas in lists'))], 9, m.pick(KS1_TASKS), KS1_RUBRIC, 8),
    maths: (m) => ({ items: fill(m, 16, mathsGensKS1) }),
    science: (m) => ({ items: fill(m, 14, [factGen(SCIENCE_KS1.map(([q, a, w]) => [q, a, w]), (q) => SCIENCE_KS1.find((x) => x[0] === q)![3])]) }),
  },
  ks2: {
    reading: (m) => readingPaper(KS2_READING, m, [synonym(SYNONYMS_KS2)], 12),
    gps: (m) => ({ items: fill(m, 18, [mcqBank(KS2_GPS_MCQ), mcqBank(KS2_GPS_MCQ), exactBank(KS2_GPS_EXACT), exactBank(KS2_GPS_EXACT), wordClass(KS2_SENTS, ['noun', 'verb', 'adjective', 'adverb', 'preposition', 'determiner', 'pronoun', 'conjunction']), spelling([...WORDS_Y34, ...WORDS_Y56])]), notes: [SPELLING_NOTE] }),
    writing: (m) => writingPaper(m, [mcqBank(KS2_WRITING_MCQ), mcqBank(KS2_WRITING_MCQ), spelling([...WORDS_Y34, ...WORDS_Y56]), mcqBank(KS2_GPS_MCQ.filter((x) => ['inverted commas', 'commas', 'apostrophes', 'parenthesis'].includes(x[3])))], 9, m.pick(KS2_TASKS), KS2_RUBRIC, 10),
    maths: (m) => ({ items: fill(m, 18, mathsGensKS2) }),
    science: (m) => ({ items: fill(m, 15, [factGen(SCIENCE_KS2.map(([q, a, w]) => [q, a, w]), (q) => SCIENCE_KS2.find((x) => x[0] === q)![3])]) }),
  },
};

/** The paper id for a stage, subject and seed. */
export const paperId = (stage: StageId, subject: string, seed: number): string => `${stage}-${subject}-${seed}`;

/**
 * A paper Ghosty writes: deterministic per seed (seeds start at `PAPER_SEED_FLOOR`), every subject of nursery,
 * reception, Key Stage 1 and Key Stage 2. Throws for a stage it cannot write for yet, a subject the stage does not
 * have, or a seed below the floor (those are for practice, never exams).
 */
export function makePaper(stage: StageId, subject: string, seed: number): SchoolPaper {
  const build = BUILD[stage]?.[subject];
  if (!build) throw new Error(hasPapers(stage) ? `${stageName(stage)} has no subject "${subject}".` : `Papers for ${stageName(stage)} are not written yet.`);
  if (!Number.isInteger(seed) || seed < PAPER_SEED_FLOOR) throw new Error(`A paper's seed is a whole number from ${PAPER_SEED_FLOOR} up.`);
  const m = new Maker(seed ^ hashText(`${stage}|${subject}`));
  const built = build(m);
  const items: SchoolItem[] = built.items.map((d, i) => ({ id: `q${i + 1}`, ...d }));
  const maxMarks = items.reduce((s, it) => s + it.marks, 0);
  const label = (SUBJECT_LABEL[subject] ?? subject).toLowerCase();
  const sources = [...(built.passages ?? []).map((p) => `passage: ${p.title}, ${p.source}`), ...(built.notes ?? [])];
  return {
    id: paperId(stage, subject, seed),
    stage,
    subject,
    title: `${stageName(stage)} ${label} · written by Ghosty in ${STYLE[stage]}`,
    official: false,
    source: `Written by Ghosty${sources.length ? `; ${sources.join('; ')}` : ''}`,
    licence: built.passages?.length ? 'Passage in the public domain' : built.notes?.length ? 'Open Government Licence v3.0 (word lists)' : undefined,
    items,
    maxMarks,
    bands: bandsFor(stage, maxMarks),
    seed,
    ...(built.passages?.length ? { passages: built.passages } : {}),
  };
}

/** Problems with a paper (empty when it is sound): the checks the tests run on every paper. */
export function paperProblems(p: SchoolPaper): string[] {
  const out: string[] = [];
  const ids = new Set(p.items.map((i) => i.id));
  if (ids.size !== p.items.length) out.push('item ids are not unique');
  const [lo, hi] = p.stage === 'nursery' ? [8, 12] : [10, 20];
  if (p.items.length < lo || p.items.length > hi) out.push(`${p.items.length} items (want ${lo}–${hi})`);
  if (new Set(p.items.map(itemKey)).size !== p.items.length) out.push('a question appears twice');
  for (const it of p.items) {
    if (!it.topic) out.push(`${it.id}: no topic`);
    if (!Number.isInteger(it.marks) || it.marks < 1) out.push(`${it.id}: marks ${it.marks}`);
    if (it.type === 'number' && parseNumber(it.answer ?? '') == null) out.push(`${it.id}: number answer "${it.answer}" does not parse`);
    if (it.type === 'exact' && !normaliseText(it.answer ?? '')) out.push(`${it.id}: empty exact answer`);
    if (it.type === 'mcq') {
      if (it.options?.length !== 4 || new Set(it.options).size !== 4) out.push(`${it.id}: wants four different options`);
      if (!/^[a-d]$/.test(it.answer ?? '')) out.push(`${it.id}: mcq answer "${it.answer}" is not A–D`);
    }
    if ((it.type === 'short' || it.type === 'extended') && (!it.rubric || !it.answer)) out.push(`${it.id}: no mark scheme or model answer`);
    if (it.passage && !p.passages?.some((x) => x.id === it.passage)) out.push(`${it.id}: passage ${it.passage} missing`);
  }
  if (p.maxMarks !== p.items.reduce((s, i) => s + i.marks, 0)) out.push('maxMarks does not add up');
  return out;
}
