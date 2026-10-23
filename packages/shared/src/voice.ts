/**
 * Does a reply sound like a person, or like an AI? The owner hates it when Ghosty "talks like an AI"
 * (OWNER-ISSUES 12): "Great question!", "As an AI…", lists and headings in a casual chat, apologising twice,
 * padding, a sign-off, a page of text for a three-word ask, American spellings for a British owner.
 *
 * A score from 0 (a person) to 1 (an AI), from patterns with weights in whole points (a hundred points is 1),
 * so it is exact: the notebook's Python copy (training/kaggle/ghosty_weekly.py `voice_check`) gives the same
 * points and the same reasons on the same text, checked on the shared cases in training/kaggle/voice_cases.json
 * (60 replies labelled by hand, plus probes), which also hold every pattern below word for word.
 *
 * Used by the weekly training (selftrain/factory.ts: only human-sounding style examples and rewrites are kept),
 * the exam's SOUNDS LIKE A PERSON area (the notebook's `score_voice`), the phone's REPORT CARD (offline/bench.ts)
 * and the online models' polish (persona.ts). Pure.
 */

/** At or above this many points a reply sounds like an AI (`human` is false). */
export const HUMAN_BELOW = 30;

/**
 * Every pattern, as text (both languages compile the same sources: JavaScript with `i`, Python with re.I | re.A).
 * `phrases`: [id, pattern, points], each counted once however often it is said.
 */
export const VOICE_RULES = {
  phrases: [
    ['great_question', String.raw`\b(?:great|excellent|fantastic|wonderful|brilliant|fascinating) question\b|\bwhat an? (?:great|good|interesting|excellent) question\b`, 45],
    ['good_question', String.raw`\b(?:good|interesting) question\b`, 20],
    ['as_an_ai', String.raw`\bas an ai\b|\bas a (?:large )?language model\b|\bi(?:'m| am) (?:just |only )?an ai\b|\bi(?:'m| am) not a (?:human|person)\b`, 60],
    ['hope_helps', String.raw`\b(?:i )?hope (?:this|that|it|the above|my answer) (?:helps|helped|was helpful|is helpful|answers your question|clears (?:things|it|that) up)\b|\bi hope (?:this|that) (?:information|brought|makes you)\b`, 40],
    ['certainly', String.raw`(?:^|\n)certainly[!,]|\bcertainly!`, 35],
    ['absolutely', String.raw`\babsolutely!|(?:^|\n)absolutely, (?:here|i)\b`, 20],
    ['happy_to', String.raw`\bi(?:'d| would) be (?:more than )?(?:happy|glad|delighted) to\b|\bhappy to help\b|\bglad (?:i could|to) help\b|\bi(?:'m| am) (?:always )?here (?:to help|for you|if you need)\b`, 40],
    ['let_me_know', String.raw`\blet me know if\b|\bfeel free to\b|\b(?:don't|do not) hesitate to\b`, 20],
    ['anything_else', String.raw`\b(?:is there )?anything else (?:i can|you(?:'d| would) like|you need)\b`, 30],
    ['important_note', String.raw`\bit(?:'s| is) (?:important|worth|crucial|essential|vital) (?:to note|noting|to remember|to mention|to keep in mind|to consider|to understand|to reach out)\b|\bplease note that\b|\bkeep in mind that\b`, 30],
    ['conclusion', String.raw`\bin conclusion\b|\bin summary\b|\bto sum up\b|\bto summari[sz]e\b`, 35],
    ['breakdown', String.raw`\bhere(?:'s| is) (?:a |the |your )?(?:quick |brief |comprehensive |detailed )?(?:breakdown|step-by-step|overview|rundown)\b|\blet(?:'s| us) (?:break (?:it|this|that) down|dive in|dive into|explore)\b`, 35],
    ['delve', String.raw`\bdelv(?:e|es|ed|ing)\b`, 30],
    ['ai_words', String.raw`\b(?:tapestry|a testament to|navigate the complexities|in today's (?:fast-paced|digital|modern) world|rest assured|embark on|a myriad of|plethora|seamless(?:ly)?|game-changer|the realm of|unlock the|elevate your|pro tip)\b`, 20],
    ['understand', String.raw`\bi (?:completely |totally |fully |definitely )?understand (?:your|how you|how frustrating|that you|why you|you(?:'re| are))\b`, 25],
    ['apology', String.raw`\b(?:i )?apologi[sz]e for (?:the|any) (?:confusion|inconvenience|misunderstanding|oversight|error|mistake)\b|\bsorry for (?:the|any) (?:confusion|inconvenience|misunderstanding)\b|\bmy apologies\b`, 35],
    ['sorry_to_hear', String.raw`\bi(?:'m| am) (?:so|very|really|truly) sorry to hear\b`, 25],
    ['no_access', String.raw`\bi (?:don't|do not) have (?:access to )?(?:real-time|live|current|up-to-date)\b|\bi (?:don't|do not) have the ability to\b|\bi(?:'m| am) (?:not able|unable) to (?:browse|access)\b`, 30],
    ['recommend', String.raw`\bi(?:'d| would)? (?:recommend|suggest) (?:checking|consulting|visiting|reaching out|contacting|speaking)\b`, 20],
    ['clarify', String.raw`\bcould you (?:please )?(?:provide|specify|clarify|let me know)\b|\bonce i have (?:that|this|more|the) (?:information|info|details?)\b`, 30],
    ['encourage', String.raw`\byou(?:'ve| have) got this\b|\bgreat job\b|\bkeep up the great work\b|\byou can do it\b`, 20],
    ['connective', String.raw`(?:^|[.!?] |\n)(?:interestingly|additionally|furthermore|moreover|notably|importantly),`, 20],
  ] as [string, string, number][],
  /** Hedges: two different ones are padding (25 points), three or more a lot of it (40). */
  hedges: [
    String.raw`\bit (?:really |all )?depends\b|\bdepends on (?:your|the|several|many|a number of|various)\b`,
    String.raw`\bgenerally(?: speaking)?,`,
    String.raw`\b(?:may|can|might) vary\b`,
    String.raw`\bit(?:'s| is) (?:always )?(?:a good idea|advisable|recommended|best) to\b`,
    String.raw`\bconsult(?:ing)? (?:a|an|your) (?:[a-z]+ )?(?:professional|doctor|expert|specialist|provider|advisor|adviser|gp)\b`,
    String.raw`\bin (?:some|many|most) cases\b`,
    String.raw`\b(?:could|might|may) potentially\b`,
    String.raw`\bthere (?:are|could be|can be|may be) (?:several|many|a few|various|a number of) (?:factors|ways|things|options|reasons|causes|considerations)\b`,
    String.raw`\bultimately,`,
    String.raw`\bhowever, (?:it|this|there)\b`,
  ],
  /** Sorry / apologise said twice or more (30 points). */
  apologies: String.raw`\b(?:sorry|apologi[sz]e[sd]?|apologies)\b`,
  /** Shape: a heading, list lines, table lines, bold — out of place in a casual exchange. */
  heading: String.raw`(?:^|\n)#{1,6} +[^ \n]|(?:^|\n)\*\*[^*\n]{1,80}\*\*:? *(?:\n|$)`,
  bullet: String.raw`(?:^|\n) *(?:[-*•]|\d{1,2}[.)]) +[^ \n]`,
  table: String.raw`(?:^|\n) *\|[^\n]*\|`,
  bold: String.raw`\*\*[^*\n]+\*\*`,
  /** Saying the question back before answering it. */
  restate: String.raw`^(?:so,? )?(?:you(?:'re| are) asking (?:about|how|whether|if|what|why|for)|you asked (?:about|how|whether|if|what|why|for)|you(?:'d| would) like to know|you want to know|you(?:'re| are) wondering|when it comes to|regarding your (?:question|query)|to answer your question|in response to your (?:question|query)|that(?:'s| is) a (?:common|very common|really common|popular) question)`,
  /** The last sentence a sign-off, or a stock closer (a real offer, "let me know if it's not there", is not one). */
  closing: String.raw`\blet me know if (?:you (?:have|need|want|'d like|would like) (?:any|anything|more|further|help|to)|there(?:'s| is) anything)|\bfeel free to (?:ask|reach out|adjust|let me know)\b|\b(?:is there )?anything else (?:i can|you(?:'d| would) like|you need)\b|\bhope (?:this|that) helps\b|\bhappy to help\b|\bi(?:'m| am) (?:always )?here (?:to help|for you|if you need)\b`,
  signoff: String.raw`^(?:have a (?:great|good|lovely|wonderful|nice|fantastic|brilliant) (?:day|evening|weekend|time|one|trip)|happy (?:cooking|baking|travels|travelling|traveling|coding|gardening|reading|shopping|listening|planning)|enjoy(?: your [a-z' -]+)?|safe travels|stay safe|take care|all the best|best of luck(?: with [a-z' -]+)?|good luck(?: with [a-z' -]+)?)[.!]*$`,
  /** An ask that wants a list or working (lists are fine then), or wants something long (length is fine then). */
  listAsk: String.raw`\b(?:list|lists|steps?|step by step|bullets?|points|options|ideas|recipe|ingredients|plan|planner|itinerary|schedule|compare|comparison|table|outline|agenda|pros and cons|think it through|show (?:your|the) working|show working)\b`,
  longAsk: String.raw`\b(?:explain|explanation|describe|tell me about|tell me more|essay|story|letter|email|write|draft|in detail|detailed|in depth|summar(?:y|ise|ize)|history of|how (?:does|do) [a-z ]{1,40}work|think it through|list|steps?|recipe|plan)\b`,
  /** American spellings and words (10 points each different one, 30 at most). */
  american: String.raw`\b(?:colors?|colored|colorful|favorites?|favored|flavors?|flavored|neighbors?|neighborhoods?|behaviors?|humor|honors?|honored|labor|centers?|centered|theaters?|realiz(?:e|es|ed|ing|ation)|organiz(?:e|es|ed|ing|ation|ations)|recogniz(?:e|es|ed|ing)|apologiz(?:e|es|ed|ing)|analyz(?:e|es|ed|ing)|prioritiz(?:e|es|ed|ing)|summariz(?:e|es|ed|ing)|minimiz(?:e|es|ed|ing)|maximiz(?:e|es|ed|ing)|optimiz(?:e|es|ed|ing)|emphasiz(?:e|es|ed|ing)|customiz(?:e|es|ed|ing)|personaliz(?:e|es|ed|ing)|memoriz(?:e|es|ed|ing)|criticiz(?:e|es|ed|ing)|trivializ(?:e|es|ed|ing)|utiliz(?:e|es|ed|ing)|visualiz(?:e|es|ed|ing)|traveling|traveled|traveler|travelers|canceled|canceling|jewelry|gray|aluminum|defense|catalog|moms?|vacations?|apartments?|cellphones?|sidewalks?|gasoline|faucets?|diapers?|elevators?|flashlights?|zip code|parking lots?|math|awesome|gotten|y'all|you guys|afterward|toward|fahrenheit)\b`,
  /** Words, sentences, and the words that say nothing about what a question is about. */
  words: String.raw`[a-z0-9]+(?:'[a-z]+)*`,
  sentences: String.raw`[^.!?\n]*[a-z0-9][^.!?\n]*[.!?]*`,
  stop: 'a an the and or but if then of to in on at for from by with without about into over under is are was were be been being do does did have has had i me my you your he she it we they them this that these those what which who how why when where can could would should will shall may might must not no so as than too very just also please tell give make write let get got some any one there here its it\'s i\'m i\'d you\'re what\'s how\'s',
};

const re = (src: string) => new RegExp(src, 'i');
const reg = (src: string) => new RegExp(src, 'gi');
const PHRASES = VOICE_RULES.phrases.map(([id, src, pts]) => ({ id, re: re(src), pts }));
const HEDGES = VOICE_RULES.hedges.map(re);
const R = {
  apologies: reg(VOICE_RULES.apologies),
  heading: re(VOICE_RULES.heading),
  bullet: reg(VOICE_RULES.bullet),
  table: reg(VOICE_RULES.table),
  bold: re(VOICE_RULES.bold),
  restate: re(VOICE_RULES.restate),
  closing: re(VOICE_RULES.closing),
  signoff: re(VOICE_RULES.signoff),
  listAsk: re(VOICE_RULES.listAsk),
  longAsk: re(VOICE_RULES.longAsk),
  american: reg(VOICE_RULES.american),
  words: reg(VOICE_RULES.words),
  sentences: reg(VOICE_RULES.sentences),
};
const STOP = new Set(VOICE_RULES.stop.split(' '));
/** Pictographs shown as emoji (not ★ ☐ ✓ or flags): two or more is decoration. */
const EMOJI = /[\u{1F300}-\u{1FAFF}]/gu;
/** Spaces of every width, read as a plain space (so both languages see the same text). */
const SPACES = /[\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/g;

/**
 * The text as the detector reads it: one kind of line break, space and quote mark; a <think> block, code and
 * quoted words left out (a reply may quote "Great question" without saying it).
 */
export function voiceText(s: string): string {
  return (s ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(SPACES, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/<think>[\s\S]*?<\/think>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/```[\s\S]*/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/"[^"\n]*"/g, ' ')
    .replace(/^[ \t\n\v\f]+|[ \t\n\v\f]+$/g, '');
}

const all = (r: RegExp, t: string): string[] => t.match(r) ?? [];
const content = (t: string): string[] => [...new Set(all(R.words, t).map((w) => w.toLowerCase()).filter((w) => w.length >= 3 && !STOP.has(w)))];

export interface VoiceCheck {
  /** 0–100: how much it sounds like an AI (`score` is points / 100). */
  points: number;
  score: number;
  /** Why, in a fixed order: the ids of the patterns that counted. */
  hits: string[];
}

/** How much `reply` (to `ask`, when known) sounds like an AI, and why. */
export function voiceCheck(reply: string, ask = ''): VoiceCheck {
  const t = voiceText(reply);
  const a = voiceText(ask);
  const hits: string[] = [];
  let points = 0;
  const add = (id: string, n: number) => {
    hits.push(id);
    points += n;
  };
  const sentences = all(R.sentences, t).map((x) => x.replace(/^ +| +$/g, ''));
  const last = sentences[sentences.length - 1] ?? '';
  for (const p of PHRASES) if (p.re.test(t)) add(p.id, p.pts);
  const hedges = HEDGES.filter((h) => h.test(t)).length;
  if (hedges >= 3) add('hedges', 40);
  else if (hedges === 2) add('hedges', 25);
  if (all(R.apologies, t).length >= 2) add('apology_stack', 30);
  // Shape: in a casual exchange (an ask that wants no list or working), a heading, list or table is a chatbot's.
  const casual = !R.listAsk.test(a);
  if (R.heading.test(t)) add('heading', casual ? 35 : 10);
  else if (casual && R.bold.test(t)) add('bold', 15);
  if (casual && all(R.bullet, t).length >= 2) add('list', 30);
  if (all(R.table, t).length >= 2) add('table', casual ? 30 : 10);
  const bangs = t.split('!').length - 1;
  if (bangs >= 4) add('exclaim', 30);
  else if (bangs >= 2 && bangs * 3 >= sentences.length) add('exclaim', 20);
  if (R.restate.test(t)) add('restate', 30);
  // The question said back as the reply's first sentence.
  const asked = content(a);
  if (asked.length >= 3 && sentences[0]?.endsWith('?')) {
    const first = new Set(content(sentences[0]));
    if (asked.filter((w) => first.has(w)).length * 10 >= asked.length * 7) add('echo', 25);
  }
  if (sentences.length > 1 && R.signoff.test(last)) add('signoff', 15);
  if (sentences.length > 1 && R.closing.test(last)) add('closing', 10);
  // A page of text for a short ask that did not want one.
  const aw = all(R.words, a).length;
  const rw = all(R.words, t).length;
  if (aw > 0 && !R.longAsk.test(a) && ((aw <= 8 && rw > 50) || (aw <= 20 && rw > 100))) add('long', 30);
  const us = new Set(all(R.american, t).map((w) => w.toLowerCase())).size;
  if (us) add('american', Math.min(30, 10 * us));
  if (all(EMOJI, t).length >= 2) add('emoji', 15);
  points = Math.min(100, points);
  return { points, score: points / 100, hits };
}

/** 0–1: how much a reply sounds like an AI. */
export const aiScore = (reply: string, ask = ''): number => voiceCheck(reply, ask).score;

/** A reply that says something and sounds like a person (below HUMAN_BELOW points). */
export function human(reply: string, ask = ''): boolean {
  return /[a-z0-9]/i.test(voiceText(reply)) && voiceCheck(reply, ask).points < HUMAN_BELOW;
}

/** The share of replies that sound like a person (0 with none): the exam's SOUNDS LIKE A PERSON area. */
export function voiceShare(items: { ask: string; reply: string }[]): number {
  return items.length ? items.filter((x) => human(x.reply, x.ask)).length / items.length : 0;
}
