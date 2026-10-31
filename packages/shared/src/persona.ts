/**
 * Ghosty's character, in one place, for every channel: the brain's system prompt (app chat,
 * Telegram, voice turns, background tasks and projects that write notifications), the phone's
 * offline brain, and whatever free model happens to answer. Plus `polish`, a cheap,
 * deterministic post-filter that takes out the stock chatbot phrases when a model slips
 * anyway — leaving code, links and quoted words exactly as they were.
 *
 * The character is short on purpose: the prompt goes with every call and free models count
 * every token (apps/edge/test/prompt.test.mjs holds the budget). The owner tunes four dials in
 * SETTINGS → CHARACTER (how dry, how brief, how warm, how fiery); the brain keeps them in the profile
 * (profile.ts) and they change the words below, never the rules.
 */
import { VOICE_RULES } from './voice';

/** Each dial: 0 = less, 1 = the default, 2 = more. */
export type Dial = 0 | 1 | 2;

export interface PersonaSettings {
  /** Wit: plain-spoken → dry → very dry. */
  dry: Dial;
  /** Length: fuller → his own length (the default: `lengthBand`, from his last messages) → terse. */
  brief: Dial;
  /** Warmth: cool → warm underneath → openly warm. */
  warm: Dial;
  /** Conviction (OWNER-ISSUES 69a): says his view once → disagrees openly and holds it → blunt, passionate, rude back. */
  fire: Dial;
}

export const DEFAULT_PERSONA: PersonaSettings = { dry: 1, brief: 1, warm: 1, fire: 1 };

/** The words that open the character in every prompt; the router's post-filter looks for them. */
export const CHARACTER_MARK = 'CHARACTER:';

/** The three dials as SETTINGS shows them: the label, then what 0, 1 and 2 are called. */
export const PERSONA_DIALS: { key: keyof PersonaSettings; label: string; steps: [string, string, string] }[] = [
  { key: 'dry', label: 'HOW DRY', steps: ['PLAIN', 'DRY', 'VERY DRY'] },
  { key: 'brief', label: 'HOW BRIEF', steps: ['FULLER', 'LIKE YOU', 'TERSE'] },
  { key: 'warm', label: 'HOW WARM', steps: ['COOL', 'WARM', 'WARMER'] },
  { key: 'fire', label: 'HOW FIERY', steps: ['MILD', 'FIRM', 'FIERY'] },
];

const dial = (v: unknown): Dial | null => (v === 0 || v === 1 || v === 2 ? v : null);

/** Settings from storage or a request, every dial checked; anything missing or odd is the default. */
export function readPersona(v: unknown): PersonaSettings {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { dry: dial(o.dry) ?? DEFAULT_PERSONA.dry, brief: dial(o.brief) ?? DEFAULT_PERSONA.brief, warm: dial(o.warm) ?? DEFAULT_PERSONA.warm, fire: dial(o.fire) ?? DEFAULT_PERSONA.fire };
}

const DRY = ['plain-spoken', 'sharp, dry', 'very dry, deadpan'];
const WARM = ['businesslike', 'warm underneath', 'openly warm'];
const BRIEF = ['Short by default, fuller when it helps.', 'Short by default: a sentence or three.', 'As short as it can be.'];
/** How hard he argues: one line per step (the offline brain's in fewer words). A stop ends any argument (intent.ts). */
const FIRE = ['Give your view once, then let it go.', 'Disagree openly; hold your view till he gives a reason.', 'Argue hard and blunt, rude back if he is.'];
const FIRE_SHORT = ['Say your view once.', 'Hold your view.', 'Argue hard.'];

/**
 * The character for the prompt: one compact paragraph. `short`: the offline brain's version
 * (a 0.6B model on the phone with a tight budget) — the same person in fewer words. `band`: his own
 * length from his last messages (`lengthBand`), which stands in for the words of the default HOW BRIEF.
 */
export function character(s: PersonaSettings = DEFAULT_PERSONA, opts: { short?: boolean; band?: string } = {}): string {
  const p = readPersona(s);
  const who = `${DRY[p.dry]}, quietly confident, ${WARM[p.warm]}`;
  const brief = p.brief === 1 && opts.band ? opts.band : BRIEF[p.brief];
  if (opts.short) return `${CHARACTER_MARK} ${who}. Plain British English. Answer first, no preamble. ${brief} No chatbot phrases ("Great question", "I hope this helps"), no emoji, no forced jokes. Unsure? Say so plainly. ${FIRE_SHORT[p.fire]}`;
  return (
    `${CHARACTER_MARK} ${who}. Plain British English. Answer first, no preamble. ${brief} ` +
    // The owner's rule (OWNER-ISSUES 12) in one line; voice.ts is the detector that holds the training and polish to it.
    `Sound like a person, not an AI. Never chatbot filler ("Great question", "I'd be happy to", "As an AI", "Certainly!", "I hope this helps", "Let me know if", "delve"), emoji, padding, over-apologising, or unasked lists, tables or headings. ` +
    `No forced jokes or catchphrases. Unsure? Say so. ${FIRE[p.fire]}`
  );
}

/** An ask that wants something long, or a list (the AI-sounding detector's own patterns, voice.ts): his length gives way. */
const LONG_ASK = new RegExp(VOICE_RULES.longAsk, 'i');
const LIST_ASK = new RegExp(VOICE_RULES.listAsk, 'i');
const WORDS = new RegExp(VOICE_RULES.words, 'gi');

/**
 * His length (OWNER-ISSUES 64b: "not everything has to be paragraphs"): one line for the prompt, from the words in his
 * last few messages (oldest first; the last is the one being answered). He writes a line, he gets a line or two back; he
 * writes a paragraph, a paragraph is fine. Asking for more ("explain properly", "in detail", a letter, the steps) wins
 * for that message. '' when there is nothing to go on.
 */
export function lengthBand(owner: string[]): string {
  const said = owner.map((t) => String(t ?? '').trim()).filter(Boolean).slice(-5);
  if (!said.length) return '';
  if (LONG_ASK.test(said[said.length - 1]!)) return 'He asked for more: give it in full.';
  const words = said.reduce((n, t) => n + (t.toLowerCase().match(WORDS) ?? []).length, 0) / said.length;
  return words <= 12 ? 'He writes short: reply in a line or two.' : words <= 40 ? 'He writes a few lines: reply in kind.' : 'He writes at length: a paragraph is fine.';
}

/** A turn that will be heard, not read (the app's microphone, a Telegram voice note). */
export const SPOKEN = 'SPOKEN: heard, not read: 1–3 short sentences; no lists, links, markdown.';

// ---------------------------------------------------------------- the post-filter

//
// Conservative by design: a lost fact is far worse than a stray "I hope this helps". So it only
// ever takes (1) a filler opener off the very start of the reply, (2) pure-filler sign-off
// sentences off the very end, (3) "delve" in lower case, (4) decorative emoji trailing a
// sentence when a reply is scattered with them, and (5) the AI-sounding detector's lead-ins
// (voice.ts: "It's important to note that", "In conclusion,") off the front of a sentence, the
// sentence itself kept word for word, (6) a short bulleted list in an ordinary chat said as one
// sentence (only when the ask is known and wanted no list), and (7) a heading over a line or two.
// It never touches a sentence with a number, a ";" or ":",
// or a link (except to take a lead-in off it); nothing inside a list item; nothing in a letter or
// a long piece (a lead-in goes only outside them too); and nothing in code, quotes, block quotes
// or links. A reply nothing applies to comes back exactly as it was, and running it twice changes
// nothing more.

/** Words a filler "Sure," / "Of course," may stand before (and only these). */
const FILLER_NEXT = String.raw`(?:here(?:'|’)?s|here (?:is|are)|i(?:'|’)ll|i will|let me|i can|i(?:'|’)ve|i have)\b`;

/** Openers, tried at the very start of the reply only, again and again while one matches. */
const OPENERS: RegExp[] = [
  // "Great question!" / "What a good question." / "That's a really good question." — the whole sentence, when something follows
  /^(?:(?:that(?:'|’)?s|that is) (?:a )?(?:really |very )?)?(?:(?:great|good|excellent|fantastic|brilliant|interesting|lovely) question|what an? (?:great|good|excellent|fantastic|interesting) question)[!.]+[ \t]+(?=\S)/i,
  // "Sorry for the confusion." / "I apologise for any inconvenience!" — the stock apology, as a whole first sentence
  /^(?:(?:i(?:'|’)?m |i am )?(?:so |very )?sorry|i apologi[sz]e|my apologies|apologies) for (?:the|any) (?:confusion|inconvenience|misunderstanding|oversight)(?: (?:earlier|caused))?[!.]+[ \t]+(?=\S)/i,
  // "I'd be happy to help with that!" — the whole sentence; "I'd be glad to explain: …" — up to the colon
  /^I(?:'|’| woul)d be (?:happy|glad|delighted|more than happy) to (?:help|assist)(?: you)?(?: with (?:that|this|it))?[!.]+[ \t]+(?=\S)/i,
  /^I(?:'|’| woul)d be (?:happy|glad|delighted|more than happy) to (?:explain|help|assist)(?: you)?(?: with (?:that|this|it))?[!:][ \t]+(?=\S)/i,
  // "Certainly! …" / "Sure thing! …" / "Of course! …" — the stock exclamations, whatever follows
  /^(?:certainly|sure thing|of course)![ \t]+(?=\S)/i,
  // "Sure, here's …" / "Of course! I'll …" — a yes-word only before filler ("Definitely. It is half price" keeps its yes)
  // (or before another of these openers: "Of course, sure, certainly! The answer is 4" → "The answer is 4").
  new RegExp(String.raw`^(?:certainly|absolutely|of course|sure|definitely|gladly)[!.,][ \t]+(?=${FILLER_NEXT}|(?:certainly|absolutely|of course|sure thing|sure|definitely|gladly)[!.,])`, 'i'),
  // "As an AI, I can't …" → "I can't …"
  /^as (?:an ai(?: language model| assistant| model)?|a (?:large )?language model),[ \t]*(?=\S)/i,
];

/** Sign-offs that are filler from first word to last: only these whole sentences, only at the end. */
const SIGNOFF = new RegExp(
  '^(?:' +
    [
      "i hope (?:this|that|it) (?:helps|was helpful|is helpful)(?: you)?",
      'hope (?:this|that) helps',
      'let me know if you (?:have any (?:other |more |further )?questions|need anything else|need (?:any )?(?:more|further) help|need anything more)',
      'feel free to (?:ask|reach out)(?: if you have any (?:other |more |further )?questions)?',
      'if you have any (?:other |more |further )?questions,? (?:feel free to ask|let me know|just ask)',
      "(?:don(?:'|’)?t|do not) hesitate to (?:ask|reach out)(?: if you need anything else)?",
      '(?:is there )?anything else (?:i can help (?:you )?with|you(?:(?:\'|’)d| would) like(?: me to (?:help with|do|add))?|you need)',
      'happy to help',
      "i(?:'|’)?m (?:always )?here (?:to help|if you need (?:me|anything))",
      // the detector's closers (voice.ts) that are filler from first word to last
      "i hope (?:this|that|the above|my answer) (?:information )?(?:answers your question|clears (?:things|it|that) up)",
      "let me know if (?:there(?:'|’)?s|there is) anything else(?: i can (?:do|help with)(?: for you)?)?",
      "let me know if you(?:(?:'|’)d| would) like (?:any )?(?:more|further) (?:details|help|information|ideas)",
      'have a (?:great|wonderful|fantastic) day',
      "you(?:'|’)?ve got this",
      // the service desk's closing offer (OWNER-ISSUES 67a: "no 'how can I help'") — a presence, not a service
      '(?:so,? )?how (?:can|may) i (?:help|assist)(?: you)?(?: (?:today|further|with anything else))?',
      'what (?:else )?can i do for you(?: today)?',
    ].join('|') +
    ')[.!?…]*$',
  'i',
);

/** A letter or a note to someone ("Dear …", "Hi Sam," … "Best, Sam"): its lines are the writer's. */
const LETTER = /^(?:dear|hi|hello|hey)\b[^\n]{0,60}[,\n]|\n[ \t]*(?:best|regards|kind regards|best wishes|many thanks|thanks|cheers|yours(?: sincerely| faithfully)?|sincerely)\b[^\n]{0,40}$/i;

/** Decorative emoji: pictographs shown as emoji — never the text symbols (U+2600–26FF: ★ ☐ ♯ ☀), nor flags. */
const EMO = String.raw`(?:(?![☀-⛿\u{1F1E6}-\u{1F1FF}])(?:\p{Emoji_Presentation}|\p{Extended_Pictographic}️)(?:\p{Emoji_Modifier}|‍\p{Extended_Pictographic}️?)*)`;
const EMO_ANY = new RegExp(EMO, 'gu');
/** A run of them straight after a sentence's end, or at the end of a line. */
const EMO_AFTER_STOP = new RegExp(String.raw`([.!?])[ \t]*(?:${EMO}[ \t]*)+`, 'gu');
const EMO_BEFORE_STOP = new RegExp(String.raw`[ \t]*(?:${EMO}[ \t]*)+(?=[.!?])`, 'gu');
const EMO_LINE_END = new RegExp(String.raw`(\S)[ \t]*(?:${EMO}[ \t]*)+$`, 'gmu');

/**
 * The AI-sounding detector's lead-ins (packages/shared/src/voice.ts), at the start of the reply, a line or a sentence:
 * filler from first word to last, whatever the sentence after them says (and that is kept).
 */
const LEAD_IN = new RegExp(
  String.raw`(^|[.!?]["')\]]?[ \t]+|\n)(?:(?:it(?:'|’)?s|it is) (?:important|worth|crucial|essential) (?:to note|noting|to remember|to mention|to keep in mind) that|please note that|keep in mind that|in conclusion,|in summary,|to summari[sz]e,|to sum up,)[ \t]+([\p{L}\p{N}]\S*)`,
  'giu',
);
const lead = (_m: string, pre: string, word: string): string => pre + capitalise(word);

/** Capitalise the first letter of `s` — unless that word is not a plain lower-case word ("iPhone", "eBay", "npm…"). */
function capitalise(s: string): string {
  const w = /^[a-z]+(?:['’][a-z]+)?(?=[\s,.!?;:]|$)/.exec(s);
  if (!w || /^(?:npm|git|ls|cd|pip|curl|sudo|yarn|node)$/.test(w[0])) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}

/** The detector's heading (voice.ts: a "#" line or a bold-only line); one such line, a bold-only line, a bulleted line. */
const HEADING = new RegExp(VOICE_RULES.heading);
const HEADING_LINE = /^#{1,6}[ \t]+(.*)$/;
const BOLD_LINE = /^\*\*([^*\n]{1,80})\*\*(:?)[ \t]*$/;
const BULLET_LINE = /^[ \t]*[-*•][ \t]+(.+)$/;

/**
 * The assistant's shape in a short answer: a "## Heading" over a line or two goes (a title with no number in it), a
 * bold-only line loses its stars (its words stay).
 */
function plainShape(t: string): string {
  const lines = t.split('\n');
  const body = lines.filter((l) => l.trim() && !HEADING_LINE.test(l.trim()) && !BOLD_LINE.test(l.trim()));
  if (!HEADING.test(t) || body.length > 2) return t;
  const out = lines
    .filter((l) => !(HEADING_LINE.test(l.trim()) && !/\d/.test(l) && (HEADING_LINE.exec(l.trim())![1]!.match(/\S+/g) ?? []).length <= 8))
    .map((l) => l.replace(BOLD_LINE, '$1$2'));
  return body.length ? out.join('\n').replace(/^\n+/, '').replace(/\n{3,}/g, '\n\n') : t;
}

/**
 * A short bulleted list in an ordinary chat, said as a person says it: "Three left: the 7:15, the 7:45 and the 8:10."
 * Every word kept; only a list of 2–6 short plain items (no number list, no "label: value", nothing indented) after a
 * line that leads into it or none, and only when the ask wanted no list or anything long (the detector's listAsk/longAsk).
 */
function proseList(t: string): string {
  const lines = t.split('\n');
  const first = lines.findIndex((l) => BULLET_LINE.test(l));
  if (first < 0) return t;
  let end = first;
  while (end < lines.length && BULLET_LINE.test(lines[end]!)) end++;
  const items = lines.slice(first, end).map((l) => BULLET_LINE.exec(l)![1]!.trim());
  if (items.length < 2 || items.length > 6 || lines.slice(first, end).some((l) => /^[ \t]/.test(l)) || lines.slice(end).some((l) => BULLET_LINE.test(l))) return t;
  // (links, code and quotes are held as \u0000n\u0000 here: a list of those stays a list)
  if (items.some((x) => x.length > 90 || /:(?:\s|$)|[|;\u0000]|\*\*/.test(x))) return t;
  const sentences = items.some((x) => /[.!?]$/.test(x) || (x.match(/\S+/g) ?? []).length > 9);
  const said = sentences
    ? items.map((x) => capitalise(/[.!?]$/.test(x) ? x : `${x}.`)).join(' ')
    : `${items.slice(0, -1).map((x) => x.replace(/[,.]$/, '')).join(', ')} and ${items[items.length - 1]!.replace(/[,.]$/, '')}.`;
  // "Three left:" leads into it, so the sentence follows on its line; anything else stays a line of its own above it.
  const into = first > 0 && /:$/.test(lines[first - 1]!.trimEnd());
  const joined = into ? `${lines[first - 1]!.trimEnd()} ${said}` : capitalise(said);
  return [...lines.slice(0, into ? first - 1 : first), joined, ...lines.slice(end)].join('\n');
}

/**
 * A model's reply with the stock chatbot phrases taken out — conservatively (see above). Returns
 * `text` itself, untouched, whenever nothing applies. `ask`: the owner's message it answers, when known
 * (a short bulleted list becomes a sentence only when the ask wanted no list).
 */
export function polish(text: string, ask?: string): string {
  if (!text || !text.trim()) return text;
  const kept: string[] = [];
  const hold = (s: string) => `\u0000${kept.push(s) - 1}\u0000`;
  const held = text
    .replace(/```[\s\S]*?(?:```|$)/g, hold)
    .replace(/`[^`\n]+`/g, hold)
    .replace(/^>.*$/gm, hold)
    .replace(/https?:\/\/[^\s)\]]*[^\s)\].,!?;:'"]/g, hold)
    .replace(/"[^"\n]*"|“[^”]*”/g, hold);
  let t = held.trim();

  // 1. openers, at the very start only; stacked ones all go.
  let opened = false;
  for (let again = true; again; ) {
    again = false;
    for (const re of OPENERS) {
      const next = t.replace(re, '');
      if (next !== t && /[\p{L}\p{N}]/u.test(next)) {
        t = next;
        opened = again = true;
      }
    }
  }
  if (opened) t = capitalise(t);

  // 2. pure-filler sign-offs, at the very end only — never in a letter, a long piece or a list item.
  const longForm = t.length > 1200 || t.split(/\n[ \t]*\n/).length > 4;
  if (!LETTER.test(t) && !longForm) {
    for (;;) {
      // The last sentence: after the last stop on the last line.
      const start = t.lastIndexOf('\n') + 1;
      const line = t.slice(start);
      if (/^[ \t]*(?:[-*•]|\d+[.)])[ \t]/.test(line)) break;
      const m = /(^|[.!?…]["')\]]?[ \t]+)([^.!?…\n]*[.!?…]*)[ \t]*$/.exec(line);
      const sentence = (m?.[2] ?? '').trim();
      if (!m || !sentence || /[\d;:]|\u0000/.test(sentence) || !SIGNOFF.test(sentence)) break;
      const rest = t.slice(0, start + m.index + m[1]!.length).trimEnd();
      if (!/[\p{L}\p{N}]/u.test(rest.replace(/\u0000\d+\u0000/g, 'x'))) break;
      t = rest;
    }
  }

  // 3. "delve", lower case anywhere; capitalised only to start a sentence before a lower-case word (not "Delve Labs").
  t = t.replace(/\bdelv(e|es|ed|ing)\b/g, (_m, end: string) => ({ e: 'dig', es: 'digs', ed: 'dug', ing: 'digging' })[end]!);
  t = t.replace(/(^|[.!?][ \t]+|\n)Delv(e|es|ed|ing)\b(?=[ \t]+[a-z])/g, (_m, pre: string, end: string) => pre + ({ e: 'Dig', es: 'Digs', ed: 'Dug', ing: 'Digging' })[end]!);

  // 4. a scatter of emoji (two or more): only the decorative ones trailing a sentence go.
  if ((t.match(EMO_ANY) ?? []).length >= 2) t = t.replace(EMO_BEFORE_STOP, '').replace(EMO_AFTER_STOP, '$1 ').replace(EMO_LINE_END, '$1').replace(/[ \t]+$/gm, '').trim();

  // 5. the detector's lead-ins off the front of a sentence, its first word capitalised; the sentence itself stays word
  // for word. Never in a letter or a long piece, never in a list item (the lead-in must start the reply, a line or a sentence).
  if (!LETTER.test(t) && !longForm) for (let next = t.replace(LEAD_IN, lead); next !== t; next = t.replace(LEAD_IN, lead)) t = next;

  // 6. a short bulleted list in an ordinary chat (OWNER-ISSUES 64c: the ask is known and wanted no list or anything long):
  // said as a sentence, every word kept. Then 7. a heading over a line or two goes, a bold-only line loses its stars.
  if (ask !== undefined && !LIST_ASK.test(ask) && !LONG_ASK.test(ask) && !LETTER.test(t) && !longForm) t = proseList(t);
  if (!LETTER.test(t) && !longForm) t = plainShape(t);

  if (t === held.trim()) return text;
  return t.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => kept[Number(i)] ?? '');
}
