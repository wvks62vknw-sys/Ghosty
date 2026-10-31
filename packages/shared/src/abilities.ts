/**
 * ABILITIES (OWNER-ISSUES 68, 67b, 67d, 68c): everything Ghosty can do, said in his own voice and always true, because
 * it is made from the registries that really exist — the brain's tool groups (apps/edge/src/tools/index.ts, rendered by
 * apps/edge/src/abilities.ts) and the app's own screens, deck lines, GYM games, Lens modes and SCHOOL stages
 * (apps/web/src/abilities/registry.ts). Nothing here is a claim of its own: these are the shapes and the plain words.
 *
 * Pure (no DOM, no storage), shared by the brain and the phone, tested in apps/edge/test/abilities.test.mjs:
 *  - `iCan`, `askOf`: a group's line for the model ("You can … (tool_name)") as his ("I can …"), a tool's name as an ask;
 *  - `searchAbilities`: "can you …?" over the abilities by their words — a hit, the nearest (a near miss), or none;
 *  - `canYouAsked`, `whyAsked`, `todayAsked`: the three questions answered with no model, in chat and on Telegram;
 *  - `whyLines`: a reply's trail (the tools that ran, their arguments, how they went, the reason) in plain words;
 *  - `dayLines`: what he did today, newest first.
 */

/** The eight ways the owner thinks about what Ghosty does (the tab's groups, in this order). */
export type AbilityCat = 'see' | 'know' | 'build' | 'watch' | 'play' | 'learn' | 'do' | 'talk';
export const CATS: { id: AbilityCat; label: string }[] = [
  { id: 'see', label: 'SEE' },
  { id: 'know', label: 'KNOW' },
  { id: 'build', label: 'BUILD' },
  { id: 'watch', label: 'WATCH OVER YOU' },
  { id: 'play', label: 'PLAY' },
  { id: 'learn', label: 'LEARN' },
  { id: 'do', label: 'DO FOR YOU' },
  { id: 'talk', label: 'TALK' },
];

/** What GO does: open a screen (and a panel on it), run a command of the app, or put an example ask into the chat. */
export type AbilityGo = { open: string; panel?: string } | { run: string; args?: Record<string, unknown> } | { ask: string };

export interface Ability {
  /** Stable: 'g:<group>' for the brain's, 's:<screen>:<n>', 'gym:<game>', 'lens:<mode>' … for the app's. */
  id: string;
  cat: AbilityCat;
  /** One plain line in his voice ("I can …"). */
  line: string;
  /** Example asks in plain words (a tool's name said as an ask, or the deck's own example). */
  asks: string[];
  go: AbilityGo;
  /** Why it cannot work yet, honestly ("needs a key: SYSTEM → KEYS → GitHub"); GO then goes there. */
  off?: string;
  /** More words it is found by (the tools' descriptions, the words that turn the group on); never shown. */
  words?: string;
  from: 'brain' | 'app';
  /** The brain's tools in this ability (for WHY: which ability a tool that ran belongs to). */
  tools?: string[];
}

/** A learning goal the owner asked for ("Want me to learn it?" → YES), as GET /api/abilities lists it. */
export interface LearningGoal {
  id: string;
  /** His own words. */
  ask: string;
  title: string;
  at: number;
}

/** What GET /api/abilities returns. */
export interface AbilitiesInfo {
  abilities: Ability[];
  /** The owner's learning goals, newest first. */
  goals: LearningGoal[];
  /** The upgrade roadmap's open steps, in order ('' goal when there is none). */
  roadmap: { goal: string; steps: string[] };
  /** Abilities already offered in context (`abilities:offered`), and the brain's tool groups ever used. */
  offered: string[];
  used: string[];
}

// ---------------------------------------------------------------- words

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const clip = (s: string, n: number) => {
  const t = clean(s);
  return t.length > n ? `${t.slice(0, n - 1).replace(/[\s,;:.—-]+$/, '')}…` : t;
};

/** Emphasis written for the model, said plainly to the owner. */
const SHOUTED = /\b(PUBLISH|DO IT|ONE|ALWAYS|OWN|NEVER|ONLY|ANY|NOT)\b/g;

/**
 * A group's line for the model, as his: "You can remember lasting facts he tells you (remember), list them …" →
 * "I can remember lasting facts you tell me, list them…". The tool names in brackets go (they are shown as asks), the
 * model's own instructions after a colon, a semicolon or a dash go, and "the owner" is "you".
 */
export function iCan(about: string): string {
  let s = clean(about);
  // brackets hold tool names and rules for the model: out, innermost first
  for (let i = 0; i < 4 && /\([^()]*\)/.test(s); i++) s = s.replace(/\s*\([^()]*\)/g, '');
  // the first part only: what follows a colon, a semicolon, a dash or a full stop is detail for the model
  s = s.split(/\s*(?:;|:\s|\s[—–-]\s|\.\s)/)[0] ?? s;
  s = s.replace(/[.\s]+$/, '');
  // a tool named as the means ("with check_html") goes; one named in a list is said in words ("uk_postcode" → "UK postcode")
  s = s.replace(/\s+(?:with|using|via)\s+[a-z]+(?:_[a-z0-9]+)+\b/g, '').replace(/\b[a-z]+(?:_[a-z0-9]+)+\b/g, (w) => toolWords(w));
  s = s.replace(SHOUTED, (w) => w.toLowerCase());
  // his voice: Ghosty is "I", the owner is "you" (the owner's words are marked first, so the two are never confused)
  s = s
    .replace(/^You can\b/i, 'I can')
    .replace(/\byourself\b/g, 'myself')
    .replace(/\byour\b/g, 'my')
    .replace(/\bYour\b/g, 'My')
    .replace(/\byou are\b/g, 'I am')
    .replace(/\bhe tells you\b/g, `${YOU} tell me`)
    .replace(/\byou\b/g, 'me')
    .replace(/\b(?:the )?owner's\b/gi, YOUR)
    .replace(/\b(?:the )?owner\b/gi, YOU)
    .replace(/\b(?:his|their)\b/g, YOUR)
    .replace(/\b(?:him|he)\b/g, YOU)
    .replace(/\bas them\b/g, `as ${YOU}`)
    // "when the owner asks", said to him: "when you ask"
    .replace(AGREE, (_m, v: string) => `${YOU} ${PLAIN[v] ?? v.replace(/s$/, '')}`)
    .split(YOU)
    .join('you')
    .split(YOUR)
    .join('your');
  s = s.replace(/\s+,/g, ',').replace(/,\s*$/, '').replace(/\s{2,}/g, ' ').trim();
  if (!/^I can\b/.test(s)) s = `I can ${s.charAt(0).toLowerCase()}${s.slice(1)}`;
  return `${s}.`;
}
const YOU = '\u0001';
const YOUR = '\u0002';
const AGREE = /\u0001 (owns|asks|tells|says|wants|needs|likes|gives|uses|lives|has|is|does|goes)\b/g;
const PLAIN: Record<string, string> = { has: 'have', is: 'are', does: 'do', goes: 'go' };

/** Initials said as initials ("uk_postcode" → "UK postcode", "make_3d" → "Make 3D"). */
const INITIALS: Record<string, string> = { uk: 'UK', dns: 'DNS', html: 'HTML', ip: 'IP', http: 'HTTP', rdap: 'RDAP', '3d': '3D', mot: 'MOT', gcse: 'GCSE', pdf: 'PDF' };
const toolWords = (tool: string) => tool.split('_').map((w) => INITIALS[w] ?? w).join(' ');

/** A tool's name said as an ask: "get_directions" → "Get directions". */
export function askOf(tool: string): string {
  const w = toolWords(tool.trim());
  return w.charAt(0).toUpperCase() + w.slice(1);
}

/** The literal words of a `when` pattern (the words that turn a group on), for search: never shown. */
export function patternWords(src: string): string {
  return src
    .replace(/\\[bBdDsSwW]/g, ' ')
    .replace(/\(\?[:=!<]+/g, ' ')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{\d+(?:,\d*)?\}/g, '')
    .replace(/[^a-zA-Z' -]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .join(' ');
}

// ---------------------------------------------------------------- "can you …?": the search

/** Words that never decide what is being asked for. */
const STOP = new Set(
  ('can could would will you u ya do does did please pls me my mine i im a an the to too for of on in at and or is are be it its this that these those with by ' +
    'from your yourself how what which some any thing things stuff really actually even ever also just still able know knew help let us we our up out ' +
    'about into there here then than so if when where who whom why like want wanna gonna get got make made give one ones way something anything everything ' +
    'bit lot lots more most much many all every each other new good best better well yes no not now ok okay hey ghosty mate bro thanks thank')
    .split(' '),
);
/** Verbs that say little on their own ("check my car's MOT" is about the car and the MOT): dropped when other words remain. */
const WEAK = new Set(['check', 'track', 'see', 'show', 'find', 'look', 'give', 'keep', 'use', 'tell', 'say', 'put', 'take', 'run', 'go', 'have', 'need']);
/** A few everyday words for what the registries call by another name: search recall, never a claim. */
const SYN: Record<string, string> = {
  beat: 'play', game: 'play', against: 'play', vs: 'play', versus: 'play', watch: 'see', film: 'video', movie: 'video', clip: 'video',
  tube: 'train', song: 'music', tune: 'music', snap: 'photo', pic: 'picture', image: 'picture', remind: 'reminder', email: 'mail', car: 'vehicle',
  motor: 'vehicle', reg: 'plate', sign: 'translate', menu: 'translate', language: 'translate', french: 'translate', spanish: 'translate',
  german: 'translate', italian: 'translate', polish: 'translate', urdu: 'translate', arabic: 'translate', chinese: 'translate', punjabi: 'translate',
  cctv: 'camera', webcam: 'camera', plane: 'aircraft', worried: 'watch', worry: 'watch', money: 'spending', spend: 'spending', receipt: 'spending',
  bank: 'spending', site: 'website', page: 'website', app: 'build', code: 'build', teach: 'tutor', homework: 'tutor', revise: 'learn', exam: 'school',
  quiz: 'learn',
};

/** One word as the search compares it: lower case, no possessive, the plain ending (cars → car, translating → translat). */
export function stem(word: string): string {
  let w = word.toLowerCase().replace(/[’']s$/, '').replace(/[^a-z0-9]/g, '');
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(?:ches|shes|sses|xes|zes|uses)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  return w;
}

const tokens = (s: string) => (s.toLowerCase().match(/[a-z0-9’']+/g) ?? []).map((w) => w.replace(/[’']/g, "'"));
/** The words of a question that decide it (stop words out; a weak verb too, when anything else is left), each with its everyday other name. */
export function queryWords(q: string): string[][] {
  const out: (string[] & { weak?: boolean })[] = [];
  for (const w of tokens(q)) {
    const bare = w.replace(/'s$/, '').replace(/'/g, '');
    if (STOP.has(bare) || bare.length < 2) continue;
    const forms: string[] & { weak?: boolean } = [stem(bare)];
    const syn = SYN[bare] ?? SYN[stem(bare)];
    if (syn) forms.push(stem(syn));
    if (WEAK.has(bare)) forms.weak = true;
    if (!out.some((o) => o[0] === forms[0])) out.push(forms);
  }
  return out.some((f) => !f.weak) ? out.filter((f) => !f.weak) : out;
}

/** Does a word of the question match a word of the ability (the same stem, or one a short ending of the other)? */
const like = (q: string, w: string) => q === w || (q.length >= 3 && w.startsWith(q) && w.length - q.length <= 3) || (w.length >= 4 && q.startsWith(w) && q.length - w.length <= 2);

export interface AbilityHit {
  ability: Ability;
  /** How many of the question's words it matched, and how strongly (the line counts most). */
  matched: number;
  score: number;
}

/** Asked for something said in words alone (a poem, a joke, an explanation, a plan): the chat itself is that ability. */
const IN_WORDS = /^(?:(?:can|could) (?:you|u) )?(?:write|tell|explain|say|describe|summari[sz]e|draft|answer|chat|talk|think|suggest|recommend|advise|calculate|solve|compare|brainstorm|help|proofread|rewrite|define|spell|joke|reason|argue|debate|discuss)\b/i;
/** The chat's own ability (the deck's CORE screen): what a words-only ask is answered with. */
export const TALK_ID = 's:core';

/**
 * "can you …?" over the abilities: `hit` when one covers most of what was asked (more than half of its words, and not
 * only by the words it is found by), `near` when the best covers only part of it (the nearest are shown, with the offer to
 * learn it properly), `none` when nothing does ("Not yet. Want me to learn it?"). Something asked for in words alone ("a
 * poem", "a joke") is the chat's own ability when it is in the list. Best first; at most `max`.
 */
export function searchAbilities(list: Ability[], q: string, max = 3): { kind: 'hit' | 'near' | 'none'; hits: AbilityHit[] } {
  const r = searchOnly(list, q, max);
  const talk = r.kind === 'hit' ? null : list.find((a) => a.id === TALK_ID);
  if (talk && IN_WORDS.test(clean(q))) return { kind: 'hit', hits: [{ ability: talk, matched: 1, score: 3 }] };
  return r;
}

function searchOnly(list: Ability[], q: string, max: number): { kind: 'hit' | 'near' | 'none'; hits: AbilityHit[] } {
  const want = queryWords(q);
  if (!want.length) return { kind: 'none', hits: [] };
  const scored: AbilityHit[] = [];
  for (const a of list) {
    const fields: [string[], number][] = [
      [tokens(a.line).map(stem), 3],
      [tokens(a.asks.join(' ')).map(stem), 2],
      [tokens(a.words ?? '').map(stem), 1],
    ];
    let matched = 0;
    let score = 0;
    for (const forms of want) {
      let best = 0;
      for (const [words, weight] of fields) if (weight > best && forms.some((f) => words.some((w) => like(f, w)))) best = weight;
      if (best) {
        matched++;
        score += best;
      }
    }
    if (matched) scored.push({ ability: a, matched, score });
  }
  // most of the question first, then how strongly; a working ability before one that needs a key; then the one whose
  // fitting ask is the most precise ("Play me at Chess" before "Watch me play: mazes, sudoku, chess, Go")
  const askLen = (a: Ability) => {
    const i = bestAsk(a, q);
    return i < 0 ? Infinity : a.asks[i]!.length;
  };
  scored.sort((x, y) => y.matched - x.matched || y.score - x.score || Number(!!x.ability.off) - Number(!!y.ability.off) || askLen(x.ability) - askLen(y.ability));
  const top = scored[0];
  if (!top) return { kind: 'none', hits: [] };
  const need = want.length === 1 ? 1 : Math.floor(want.length / 2) + 1;
  // a hit needs the words of the question in its line or its asks, not only in what it is found by
  const kind = top.matched >= need && top.score >= 2 * need ? 'hit' : 'near';
  return { kind, hits: scored.filter((s) => (kind === 'hit' ? s.matched >= need && s.score >= 2 * need : true)).slice(0, max) };
}

/** Which of an ability's asks fits the question best (its index), or -1 when none of them says any of it. */
export function bestAsk(a: Ability, q: string): number {
  const want = queryWords(q);
  let best = -1;
  let most = 0;
  a.asks.forEach((ask, i) => {
    const words = tokens(ask).map(stem);
    const n = want.filter((forms) => forms.some((f) => words.some((w) => like(f, w)))).length;
    if (n > most) {
      most = n;
      best = i;
    }
  });
  return best;
}

// ---------------------------------------------------------------- the three questions answered with no model

/** The dressing around a question ("hey ghosty, …", "so …", "…?!") that does not change it. */
const lead = /^(?:(?:hey|hi|so|ok|okay|oi|and|but|ghosty|mate)[,!]?\s+)*/i;

/** Asked for something now, not whether he can: "remind me to …", "tell me …", "play me …". */
const REQUEST = /^(?:remind|tell|send|show|give|find|get|book|text|call|e-?mail|ping|wake|bring|take|help|write|draw|make|build|play|put|read|sing|teach|quiz|test|order|buy|pick|grab|sort|check)\s+(?:me|us)\b/i;
/** Anything that makes it about one particular thing now: a number, a link, a time, "this", a name. */
const SPECIFIC = /\d|https?:|www\.|["“”]|\b(?:this|that|these|those|it|them|today|tonight|tomorrow|now|later|morning|afternoon|evening|asap|right away|at once|monday|tuesday|wednesday|thursday|friday|saturday|sunday|next|in an? (?:hour|minute)|o'?clock|am|pm)\b/i;

/**
 * A question about what he can do, typed in chat: "can you translate signs?", "are you able to check my car's MOT",
 * "do you know how to play chess" → what was asked about ("translate signs"). A polite request is left alone ("can you
 * remind me at 5 to call mum", "could you check the weather in Leeds?", "can you summarise this?"): those are for doing.
 */
export function canYouAsked(text: string): string | null {
  const t = clean(text).replace(lead, '');
  if (!t || t.length > 120 || /[.!?]\s+\S/.test(t)) return null;
  const firm = /^(?:are you (?:able|capable) (?:to|of)|do you know how to|is it possible for you to|is there a way (?:for you )?to|do you have a way to|have you got a way to|can you even|could you ever|can you ever)\s+(.+?)[\s?!.]*$/i.exec(t);
  const soft = firm ? null : /^(?:can|could) (?:you|u|ya)\s+(.+?)[\s?!.]*$/i.exec(t);
  const thing = clean((firm ?? soft)?.[1] ?? '');
  if (!thing) return null;
  // "can you …" is a request as often as a question: only a short, general one is taken as a question about him
  if (soft) {
    const words = thing.split(' ');
    if (words.length > 8 || REQUEST.test(thing) || SPECIFIC.test(thing)) return null;
    // a name or a place in the middle ("in Leeds", "to Sarah"): something particular, so a request (a shouted MOT is not a name)
    if (/\s(?:[A-Z][a-z]+)/.test(` ${words.slice(1).join(' ')}`)) return null;
  }
  return thing;
}

/** What a "can you …?" typed in the ABILITIES box is about, whatever its shape ("can you check my car's MOT?" → "check my car's MOT"). */
export function whatAbout(text: string): string {
  return clean(text)
    .replace(lead, '')
    .replace(/^(?:(?:can|could|would) (?:you|u|ya)(?: (?:ever|even|actually|also))?|are you (?:able|capable) (?:to|of)|do you know how to|is it possible for you to|is there a way (?:for you )?to|do you have a way to)\s+/i, '')
    .replace(/[\s?!.]+$/, '');
}

/** "why?" (bare: answered from the trail only when the last reply ran something), or "why did you do that?" (full). */
export function whyAsked(text: string): 'bare' | 'full' | null {
  const t = clean(text).replace(lead, '').replace(/[\s?!.]+$/, '').toLowerCase();
  if (/^(?:why|how come|but why|why tho|why though)$/.test(t)) return 'bare';
  if (/^(?:why did you do (?:that|this|it)|why'?d you do (?:that|this|it)|why did you (?:say|run|use|check|open|send|pick|choose|look (?:that|it) up) (?:that|this|it)?|what made you do (?:that|this|it)|why (?:that|this) one|why did you do what you did|show me why|what was (?:that|this) for)$/.test(t)) return 'full';
  return null;
}

// ---------------------------------------------------------------- WHY: a reply's trail in plain words

/** One tool at work in a reply: its name, its arguments in plain words, and how it went (null: stopped or still working). */
export interface TrailStep {
  /** The tool's name ('' when only its label is known: an entry kept from before tools were named in it). */
  tool: string;
  /** How the chat labelled it ("Searching the web: cats"), for when the name is not known. */
  label?: string;
  args?: string;
  ok: boolean | null;
  /** Why it failed, or "waiting for your approval". */
  note?: string;
}
/** A reply's trail: what he was asked, what ran, and what he said (kept short). */
export interface Trail {
  at: number;
  asked: string;
  steps: TrailStep[];
  said?: string;
}

const IRREGULAR: Record<string, string> = {
  get: 'got', find: 'found', make: 'made', read: 'read', send: 'sent', run: 'ran', set: 'set', put: 'put', build: 'built', draw: 'drew', take: 'took',
  give: 'gave', see: 'saw', say: 'said', write: 'wrote', keep: 'kept', tell: 'told', think: 'thought', sit: 'sat', begin: 'began', do: 'did', show: 'showed',
  study: 'studied', stop: 'stopped', plan: 'planned', ship: 'shipped', drop: 'dropped', identify: 'identified', summarise: 'summarised', forget: 'forgot',
};
const VERBS = new Set([...Object.keys(IRREGULAR), 'check', 'search', 'list', 'open', 'play', 'add', 'publish', 'remember', 'start', 'translate', 'look', 'lookup', 'track', 'pause', 'resume', 'cancel', 'save', 'schedule', 'design', 'review', 'ask', 'fly', 'measure', 'reload', 'remove', 'delete', 'propose', 'update', 'wait', 'discard', 'restore', 'focus', 'export', 'import', 'push', 'create', 'learn', 'report', 'unpublish', 'detect', 'reverse', 'tutor']);

/** A tool that ran, said as done: "plan_journey" → "Planned journey", "web_search" → "Used web search". */
export function doneOf(tool: string): string {
  const [first = '', ...rest] = tool.split('_');
  if (!VERBS.has(first)) return `Used ${tool.replace(/_/g, ' ')}`;
  const past = IRREGULAR[first] ?? (first.endsWith('e') ? `${first}d` : /[^aeiou]y$/.test(first) ? `${first.slice(0, -1)}ied` : `${first}ed`);
  const words = [past, ...rest].join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A tool's arguments in plain words, the few that say what it was about ("to: London · when: 07:00"); never a blob. */
export function argWords(args: Record<string, unknown> | undefined): string {
  if (!args) return '';
  const out: string[] = [];
  for (const [k, v] of Object.entries(args)) {
    // never a blob, and never a number plate, a key or a password (the trail is kept on the phone and in the brain)
    if (/^(?:html|code|content|files?|edits?|data|image|images|picture|body|text_full|parts?|steps|answers?|svg|json|plate|plates|reg|registration|key|token|password|secret|api_?key)$/i.test(k)) continue;
    if (v == null || v === '' || typeof v === 'object') continue;
    const s = clean(String(v));
    if (!s || s.length > 80 || /^data:/.test(s)) continue;
    out.push(`${k.replace(/_/g, ' ')}: ${clip(s, 48)}`);
    if (out.length === 3) break;
  }
  return out.join(' · ');
}

/** The ability a tool belongs to, and the first word of the question it was about (stems compared). */
function reasonOf(asked: string, a: Ability | undefined): string {
  if (!a) return 'it was the way to answer you';
  const can = clip(a.line.replace(/^I can\s+/i, '').replace(/\.$/, ''), 110);
  const hay = tokens(`${a.line} ${a.asks.join(' ')} ${a.words ?? ''}`).map(stem);
  const word = tokens(asked).find((w) => !STOP.has(w.replace(/'/g, '')) && w.length > 2 && hay.some((h) => like(stem(w), h)));
  return word ? `you asked about “${word.replace(/'s$/, '')}”, and I can ${can}` : `of what you asked, and I can ${can}`;
}

/** The reason in his own words, when the reply gave one ("…because the M6 is closed at junction 6"). */
export function ownReason(said: string): string {
  for (const s of clean(said).split(/(?<=[.!?])\s+/)) if (/\b(?:because|since|so that|in order to|as you (?:asked|said|wanted))\b/i.test(s) && s.length <= 220) return s;
  return '';
}

/**
 * A reply's trail in plain words: what he was asked, each tool with its arguments and how it went, and why — a reason
 * from the tool's ability ("you asked about “trains”, and I can plan door-to-door journeys…") and, when his reply gave
 * one, his own. Nothing is asked of a model.
 */
export function whyLines(t: Trail, abilities: Ability[]): string[] {
  const out = t.asked ? [`You asked: “${clip(t.asked, 140)}”`] : [];
  const byTool = new Map<string, Ability>();
  for (const a of abilities) for (const name of a.tools ?? []) if (!byTool.has(name)) byTool.set(name, a);
  if (!t.steps.length) out.push('I didn’t run anything for that one: I answered from what I know.');
  t.steps.forEach((s, i) => {
    const how = s.ok === true ? 'it worked' : s.ok === false ? `it didn’t work${s.note ? ` (${clip(s.note, 90)})` : ''}` : s.note ? clip(s.note, 90) : 'it stopped before it finished';
    out.push(`${i + 1}. ${s.tool ? doneOf(s.tool) : clip(s.label ?? 'Worked on it', 80)}${s.args ? ` — ${s.args}` : ''}: ${how}.`);
    out.push(`   Why: ${reasonOf(t.asked, byTool.get(s.tool))}.`);
  });
  const own = t.said ? ownReason(t.said) : '';
  if (own) out.push(`In my words: “${clip(own, 200)}”`);
  return out;
}
