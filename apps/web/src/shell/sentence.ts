/**
 * THE JUMP BAR UNDERSTANDS SENTENCES (NEXT-ROUND consistency.u5, voice.s4): "where do I paste a bank statement" finds Money, "put
 * some tunes on" the Radio. Two ways, on the phone, with no model:
 *   1. the meanings the chat already reads (packages/shared/src/meanings.ts: "play music" → the radio) when they name a screen;
 *   2. else his content words against what each screen and each panel says it does in the catalogue (its name, its line and the
 *      ways to say it): the screen with the most of his words, when at least two of them land.
 * Pure (no screen code), so the spec reads these very rules. shell/jump.ts puts the screen found at the head of the bar.
 */
import { CATALOGUE, isSame } from '../../../../packages/shared/src/catalogue';
import { isTwo, meaningOf } from '../../../../packages/shared/src/meanings';

/** Words that carry no meaning of their own in a question about where a thing is. */
const STOP = new Set(('a an the i me my mine you your to of for in on at and or is are was be do does did can could would should will how where what which who '
  + 'when why it its this that these those there here with from by up down out please want need get go find open show take some any thing things '
  + 'something somewhere put let lets just like so about into onto am im ive id has have had not no yes way ghosty').split(' '));

/** A word as compared: lower case, plain letters, a plural or -ing/-ed ending off ("statements" and "statement" are one). */
export const stem = (w: string): string => w.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(?:ings|ing|ies|ied|es|ed|s)$/, '');

export const contentWords = (q: string): string[] => [...new Set(q.toLowerCase().split(/[^a-z0-9']+/).map((w) => w.replace(/'/g, '')).filter((w) => w.length > 1 && !STOP.has(w)).map(stem).filter((w) => w.length > 1))];

interface Doc {
  screen: string;
  panel?: string;
  words: Set<string>;
  /** The words of its name alone (a sentence with one word that matters is matched on names only). */
  named: Set<string>;
  /** The words of the panel's own title on screen ("WEATHER"), or of the screen's id. */
  title: Set<string>;
}
let docs: Doc[] | null = null;
function index(): Doc[] {
  if (docs) return docs;
  docs = [];
  for (const [id, v] of Object.entries(CATALOGUE)) {
    const m = /^(screen|panel):([\w-]+)(?::(.+))?$/.exec(id);
    // (a panel whose words are another entry's — "the very thing it says" — is found by those words, where it is)
    let w: (typeof CATALOGUE)[string] | undefined = v;
    for (let i = 0; i < 3 && w && isSame(w); i++) w = CATALOGUE[w.same];
    if (!m || !w || isSame(w)) continue;
    const text = [w.name, w.line, ...(w.say ?? [])].join(' ');
    docs.push({ screen: m[2]!, ...(m[1] === 'panel' ? { panel: m[3]! } : {}), words: new Set(contentWords(text)), named: new Set(contentWords(w.name)), title: new Set(contentWords(m[3] ?? m[2]!)) });
  }
  return docs;
}

export interface SentenceFind {
  screen: string;
  panel?: string;
  /** How it was found: the chat's meanings, or his words in what a screen says it does. */
  by: 'meaning' | 'words';
  /** His words that landed (for words). */
  hits?: string[];
}

/** The screen a sentence means, or null (a word or two is the bar's own search: this is for sentences). */
/** `strict` (the help desk): no one-word guess, and two thirds of his words must land, so a real question ("how do I fix a leaking
 *  tap?") stays the brain's. */
export function screenForSentence(q: string, has: (screen: string) => boolean = () => true, strict = false): SentenceFind | null {
  const words = q.trim().split(/\s+/);
  if (words.length < 3 || q.length > 120) return null;
  const m = meaningOf(q);
  if (m && !isTwo(m) && m.open && has(m.open)) return { screen: m.open, ...(m.panel ? { panel: m.panel } : {}), by: 'meaning' };
  if (m && !isTwo(m) && m.id === 'radio' && has('radio')) return { screen: 'radio', by: 'meaning' };
  const mine = contentWords(q);
  if (!mine.length) return null;
  if (mine.length === 1) {
    if (strict) return null;
    // one word that matters ("I want to make a game"): a screen whose own name has it, before a panel whose name has it
    // (the most particular first: a title that is just that word — the Brief's WEATHER, before SPACE WEATHER — then the shorter name)
    const w1 = mine[0]!;
    const exact = (d: Doc) => (d.title.size === 1 && d.title.has(w1) ? 0 : 1);
    const named = index().filter((d) => has(d.screen) && (d.named.has(w1) || d.title.has(w1))).sort((a, b) => exact(a) - exact(b) || a.named.size - b.named.size || Number(!!a.panel) - Number(!!b.panel));
    const d = named[0];
    return d ? { screen: d.screen, ...(d.panel ? { panel: d.panel } : {}), by: 'words', hits: mine } : null;
  }
  let best: { d: Doc; hits: string[] } | null = null;
  for (const d of index()) {
    if (!has(d.screen)) continue;
    const hits = mine.filter((w) => d.words.has(w));
    // more of his words wins; on a tie the screen itself before one of its panels
    if (hits.length >= 2 && (!best || hits.length > best.hits.length || (hits.length === best.hits.length && !d.panel && best.d.panel))) best = { d, hits };
  }
  if (best && strict && best.hits.length * 3 < mine.length * 2) return null;
  return best ? { screen: best.d.screen, ...(best.d.panel ? { panel: best.d.panel } : {}), by: 'words', hits: best.hits } : null;
}
