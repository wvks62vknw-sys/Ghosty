/**
 * SPELLING AND GRAMMAR ON THE PHONE (APPS ROUND, documents pro): his document checked here, with nothing sent and nothing
 * downloaded: the words people most often misspell (British spelling kept: colour, organise and judgement are right), a word
 * typed twice, "a" or "an" before the wrong sound, a lone "i", "could of", a sentence that starts small, two spaces, a space
 * before a comma. Each finding comes with its fix for him to ACCEPT or IGNORE; a fix while TRACK CHANGES is on is tracked like
 * his typing. Pure: apps/edge/test/document.test.mjs.
 */
import { textOf, tidyRuns, type Block, type Doc, type Run } from './model';

export interface Issue {
  id: string;
  block: string;
  start: number;
  end: number;
  found: string;
  fix: string;
  kind: 'spelling' | 'grammar';
  why: string;
}

const WORDS: Record<string, string> = Object.fromEntries(
  ('teh:the recieve:receive recieved:received seperate:separate seperately:separately definately:definitely definatly:definitely occured:occurred ocurred:occurred '
    + 'untill:until wich:which accomodate:accommodate accomodation:accommodation adress:address beleive:believe belive:believe calender:calendar comittee:committee '
    + 'enviroment:environment existance:existence goverment:government freind:friend freinds:friends garantee:guarantee independant:independent neccessary:necessary '
    + 'necesary:necessary noticable:noticeable occassion:occasion posession:possession prefered:preferred publically:publicly reccomend:recommend recomend:recommend '
    + 'refered:referred relevent:relevant sincerly:sincerely succesful:successful sucessful:successful tommorow:tomorrow tomorow:tomorrow truely:truly wierd:weird '
    + 'thier:their becuase:because beacuse:because begining:beginning buisness:business completly:completely concious:conscious embarass:embarrass foriegn:foreign '
    + 'grammer:grammar happend:happened immediatly:immediately knowlege:knowledge liason:liaison maintainance:maintenance mispell:misspell peice:piece persue:pursue '
    + 'posible:possible remeber:remember responsable:responsible rythm:rhythm similiar:similar speach:speech strenght:strength suprise:surprise tounge:tongue '
    + 'writting:writing yeild:yield acheive:achieve agressive:aggressive apparant:apparent arguement:argument basicly:basically collegue:colleague dissapoint:disappoint '
    + 'dissapointed:disappointed febuary:February finaly:finally gaurd:guard hight:height interupt:interrupt libary:library millenium:millennium neice:niece '
    + 'paralell:parallel propably:probably realy:really reciept:receipt sieze:seize threshhold:threshold tomatos:tomatoes yesturday:yesterday accross:across '
    + 'wendesday:Wednesday wensday:Wednesday tuseday:Tuesday thursady:Thursday saturaday:Saturday freind:friend alot:a_lot aswell:as_well infact:in_fact '
    + 'everytime:every_time incase:in_case eachother:each_other abit:a_bit thankyou:thank_you ive:I’ve dont:don’t doesnt:doesn’t didnt:didn’t cant:can’t wont:won’t '
    + 'isnt:isn’t wasnt:wasn’t couldnt:couldn’t wouldnt:wouldn’t shouldnt:shouldn’t im:I’m youre:you’re theyre:they’re thats:that’s whats:what’s lets:let’s '
    + 'apologise:apologise appologise:apologise apologies:apologies dammage:damage damadge:damage repiar:repair repaire:repair landord:landlord landlrod:landlord '
    + 'enginer:engineer engineeer:engineer appointmnet:appointment appointement:appointment urgant:urgent emergancy:emergency inconvienience:inconvenience '
    + 'inconvenince:inconvenience convienient:convenient regaurds:regards reguards:regards faithfuly:faithfully sincerley:sincerely recieving:receiving')
    .split(' ').filter(Boolean).map((p) => p.replace(/_/g, ' ').split(':') as [string, string]).filter(([a, b]) => a !== b.toLowerCase()),
);
// "lets" and "im" read as ordinary words too often to call them wrong on sight
delete WORDS.lets;
delete WORDS.im;
delete WORDS.ive;

const likeCase = (found: string, fix: string): string => (/^[A-Z]/.test(found) && !/^[A-Z]/.test(fix) ? fix[0]!.toUpperCase() + fix.slice(1) : found === found.toUpperCase() && found.length > 1 ? fix.toUpperCase() : fix);
const AN_SOUND = /^(?:[aeio]|u(?!ni|s[aeiu]|r[aeiou]|t[aeiou]|k)|hour|honest|honou?r|heir|8|11|18|x-?ray|mp\b|fbi|mot\b)/i;
const A_SOUND = /^(?:one\b|once|uni|use|usu|ura|ure|uto|euro|eu|ewe|u-|ufo)/i;
const DOUBLE_OK = new Set(['had', 'that', 'is', 'really', 'very', 'bye', 'no', 'so', 'ha', 'knock', 'well']);

/** What is wrong in one paragraph's words (offsets in its letters). */
export function checkText(text: string, block = ''): Issue[] {
  const out: Issue[] = [];
  const add = (start: number, found: string, fix: string, kind: Issue['kind'], why: string) => out.push({ id: `${block}:${start}:${found}`, block, start, end: start + found.length, found, fix, kind, why });
  for (const m of text.matchAll(/\p{L}[\p{L}’']*/gu)) {
    const w = m[0];
    const fix = WORDS[w.toLowerCase()];
    if (fix) add(m.index!, w, likeCase(w, fix), 'spelling', 'Spelling');
    else if (w === 'i') add(m.index!, w, 'I', 'grammar', '“I” is always a capital');
  }
  for (const m of text.matchAll(/\b(\p{L}+)(\s+)(\1)\b/giu)) {
    if (DOUBLE_OK.has(m[1]!.toLowerCase())) continue;
    add(m.index!, m[0], m[1]!, 'grammar', 'The same word twice');
  }
  for (const m of text.matchAll(/\b([Aa]n?)\s+([\p{L}\d][\p{L}\d-]*)/gu)) {
    const art = m[1]!;
    const next = m[2]!;
    const wantsAn = AN_SOUND.test(next) && !A_SOUND.test(next);
    if (art.length === 1 && wantsAn) add(m.index!, `${art} ${next}`, `${art}n ${next}`, 'grammar', '“an” before a vowel sound');
    else if (art.length === 2 && !wantsAn && /^[\p{L}]/u.test(next)) add(m.index!, `${art} ${next}`, `${art[0]} ${next}`, 'grammar', '“a” before a consonant sound');
  }
  for (const m of text.matchAll(/\b(could|would|should|must|might)\s+of\b/giu)) add(m.index!, m[0], `${m[1]} have`, 'grammar', '“have”, not “of”');
  for (const m of text.matchAll(/\b([Yy]our)\s+welcome\b/g)) add(m.index!, m[0], `${m[1]![0] === 'Y' ? 'You' : 'you'}’re welcome`, 'grammar', '“you’re” (you are)');
  for (const m of text.matchAll(/([.!?])(\s+)(\p{Ll}[\p{L}’']*)/gu)) {
    if (/\b(?:e\.g|i\.e|etc|approx|no|vs|st|dr|mr|mrs|ms)\.$/i.test(text.slice(Math.max(0, m.index! - 7), m.index! + 1))) continue;
    add(m.index! + m[1]!.length + m[2]!.length, m[3]!, m[3]![0]!.toUpperCase() + m[3]!.slice(1), 'grammar', 'A sentence starts with a capital');
  }
  for (const m of text.matchAll(/(?<=\S) {2,}(?=\S)/g)) add(m.index!, m[0], ' ', 'grammar', 'Two spaces');
  for (const m of text.matchAll(/(?<=\p{L}) +([,;!?])(?=\s|$)/gu)) add(m.index!, m[0], m[1]!, 'grammar', 'A space before the punctuation');
  // the first finding at a place wins (a word typed twice that is also misspelt is one fix at a time)
  out.sort((a, b) => a.start - b.start || b.end - a.end);
  return out.filter((x, k) => !out.slice(0, k).some((y) => x.start < y.end && y.start < x.end));
}

/** Every finding in the document (struck words of a tracked change are left alone), less the ones he ignored. */
export function checkDoc(d: Doc, ignored: Set<string> = new Set()): Issue[] {
  const out: Issue[] = [];
  for (const b of d.blocks) {
    if (b.t === 'table' || b.t === 'img' || b.t === 'pb') continue;
    const struck: [number, number][] = [];
    let at = 0;
    for (const r of b.runs) {
      if (r.tc === 'del') struck.push([at, at + r.text.length]);
      at += r.text.length;
    }
    for (const i of checkText(textOf(b), b.id)) if (!ignored.has(ignoreKey(i)) && !struck.some(([s, e]) => i.start < e && s < i.end)) out.push(i);
  }
  return out;
}
/** What IGNORE remembers: the words in that paragraph (wherever they move to in it). */
export const ignoreKey = (i: Pick<Issue, 'block' | 'found' | 'fix'>): string => `${i.block}|${i.found}|${i.fix}`;

/** The words at [start, end) replaced by `fix`, keeping the marks they had; with `tat`, as his tracked change (the old struck, the fix put in). */
function replaced(runs: Run[], start: number, end: number, fix: string, tat?: number): Run[] {
  const out: Run[] = [];
  const old = (r: Run): Run[] => (tat === undefined ? [] : r.tc === 'ins' ? [] : [{ ...r, tc: 'del', tat: r.tc === 'del' ? r.tat : tat }]);
  const put1 = (r: Run): Run => {
    const { tc: _t, tat: _a, ...plain } = r;
    return tat === undefined ? { ...plain, text: fix } : { ...plain, text: fix, tc: 'ins', tat };
  };
  let n = 0;
  let put = false;
  for (const r of runs) {
    const a = n;
    const z = n + r.text.length;
    n = z;
    if (z <= start || a >= end) {
      if (a >= end && !put) (out.push(put1(r)), (put = true));
      out.push(r);
      continue;
    }
    if (a < start) out.push({ ...r, text: r.text.slice(0, start - a) });
    out.push(...old({ ...r, text: r.text.slice(Math.max(0, start - a), Math.min(r.text.length, end - a)) }));
    if (z >= end && !put) (out.push(put1(r)), (put = true));
    if (z > end) out.push({ ...r, text: r.text.slice(end - a) });
  }
  if (!put) out.push({ text: fix });
  return tidyRuns(out);
}

/** ACCEPT: the fix put in (tracked when TRACK CHANGES is on); a string when the words have changed since the check. */
export function applyIssue(d: Doc, i: Issue, now = Date.now()): Doc | string {
  const b = d.blocks.find((x) => x.id === i.block);
  if (!b || textOf(b).slice(i.start, i.end) !== i.found) return 'Those words have changed since the check: CHECK again.';
  const runs = replaced(b.runs, i.start, i.end, i.fix, d.track ? now : undefined);
  return { ...d, blocks: d.blocks.map((x): Block => (x.id === b.id ? { ...x, runs } : x)) };
}
/** ACCEPT ALL: every finding fixed, last first so the places of the others hold. */
export function applyAll(d: Doc, list: Issue[], now = Date.now()): { doc: Doc; done: number } {
  let doc = d;
  let done = 0;
  for (const i of [...list].sort((a, b) => b.start - a.start)) {
    const r = applyIssue(doc, i, now);
    if (typeof r !== 'string') (doc = r), done++;
  }
  return { doc, done };
}
/** A finding in his words: Spelling: “teh” → “the”. */
export const issueWords = (i: Issue): string => `${i.why}: “${i.found.replace(/ {2,}/g, '··')}” → “${i.fix}”`;
