/**
 * Ghosty's character, in one place, for every channel: the brain's system prompt (app chat,
 * Telegram, voice turns, background tasks and projects that write notifications), the phone's
 * offline brain, and whatever free model happens to answer. Plus `polish`, a cheap,
 * deterministic post-filter that takes out the stock chatbot phrases when a model slips
 * anyway — leaving code, links and quoted words exactly as they were.
 *
 * The character is short on purpose: the prompt goes with every call and free models count
 * every token (apps/edge/test/prompt.test.mjs holds the budget). The owner tunes three dials in
 * SETTINGS → CHARACTER (how dry, how brief, how warm); the brain keeps them in the profile
 * (profile.ts) and they change the words below, never the rules.
 */

/** Each dial: 0 = less, 1 = the default, 2 = more. */
export type Dial = 0 | 1 | 2;

export interface PersonaSettings {
  /** Wit: plain-spoken → dry → very dry. */
  dry: Dial;
  /** Length: fuller → short → terse. */
  brief: Dial;
  /** Warmth: cool → warm underneath → openly warm. */
  warm: Dial;
}

export const DEFAULT_PERSONA: PersonaSettings = { dry: 1, brief: 1, warm: 1 };

/** The words that open the character in every prompt; the router's post-filter looks for them. */
export const CHARACTER_MARK = 'CHARACTER:';

/** The three dials as SETTINGS shows them: the label, then what 0, 1 and 2 are called. */
export const PERSONA_DIALS: { key: keyof PersonaSettings; label: string; steps: [string, string, string] }[] = [
  { key: 'dry', label: 'HOW DRY', steps: ['PLAIN', 'DRY', 'VERY DRY'] },
  { key: 'brief', label: 'HOW BRIEF', steps: ['FULLER', 'SHORT', 'TERSE'] },
  { key: 'warm', label: 'HOW WARM', steps: ['COOL', 'WARM', 'WARMER'] },
];

const dial = (v: unknown): Dial | null => (v === 0 || v === 1 || v === 2 ? v : null);

/** Settings from storage or a request, every dial checked; anything missing or odd is the default. */
export function readPersona(v: unknown): PersonaSettings {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
  return { dry: dial(o.dry) ?? DEFAULT_PERSONA.dry, brief: dial(o.brief) ?? DEFAULT_PERSONA.brief, warm: dial(o.warm) ?? DEFAULT_PERSONA.warm };
}

const DRY = ['plain-spoken', 'sharp, dry', 'very dry, deadpan'];
const WARM = ['businesslike', 'warm underneath', 'openly warm'];
const BRIEF = ['Short by default, fuller when it helps.', 'Short by default: a sentence or three.', 'As short as it can be.'];

/**
 * The character for the prompt: one compact paragraph. `short`: the offline brain's version
 * (a 0.6B model on the phone with a tight budget) — the same person in fewer words.
 */
export function character(s: PersonaSettings = DEFAULT_PERSONA, opts: { short?: boolean } = {}): string {
  const p = readPersona(s);
  const who = `${DRY[p.dry]}, quietly confident, ${WARM[p.warm]}`;
  if (opts.short) return `${CHARACTER_MARK} ${who}. Plain British English. Answer first, no preamble. ${BRIEF[p.brief]} No chatbot phrases ("Great question", "I hope this helps"), no emoji, no forced jokes. Unsure? Say so plainly.`;
  return (
    `${CHARACTER_MARK} ${who}. Plain British English. Answer first, no preamble. ${BRIEF[p.brief]} ` +
    `Never chatbot filler ("Great question", "I'd be happy to", "As an AI", "Certainly!", "I hope this helps", "Let me know if…", "delve"), emoji, or bullet lists for a simple answer. ` +
    `No forced jokes or catchphrases. Unsure? Say so, plainly.`
  );
}

/** A turn that will be heard, not read (the app's microphone, a Telegram voice note). */
export const SPOKEN = 'SPOKEN: this reply will be heard: one to three short sentences, no lists, links or markdown.';

// ---------------------------------------------------------------- the post-filter

//
// Conservative by design: a lost fact is far worse than a stray "I hope this helps". So it only
// ever takes (1) a filler opener off the very start of the reply, (2) pure-filler sign-off
// sentences off the very end, (3) "delve" in lower case, and (4) decorative emoji trailing a
// sentence when a reply is scattered with them. It never touches a sentence with a number, a
// ";" or ":", or a link; nothing inside a list item; nothing in a letter or a long piece; and
// nothing in code, quotes, block quotes or links. A reply nothing applies to comes back exactly
// as it was, and running it twice changes nothing more.

/** Words a filler "Sure," / "Of course," may stand before (and only these). */
const FILLER_NEXT = String.raw`(?:here(?:'|’)?s|here (?:is|are)|i(?:'|’)ll|i will|let me|i can|i(?:'|’)ve|i have)\b`;

/** Openers, tried at the very start of the reply only, again and again while one matches. */
const OPENERS: RegExp[] = [
  // "Great question!" / "What a good question." — the whole sentence, when something follows
  /^(?:(?:great|good|excellent|fantastic|brilliant|interesting|lovely) question|what an? (?:great|good|excellent|fantastic|interesting) question)[!.]+[ \t]+(?=\S)/i,
  // "I'd be happy to help with that!" — the whole sentence; "I'd be glad to explain: …" — up to the colon
  /^I(?:'|’| woul)d be (?:happy|glad|delighted|more than happy) to (?:help|assist)(?: you)?(?: with (?:that|this|it))?[!.]+[ \t]+(?=\S)/i,
  /^I(?:'|’| woul)d be (?:happy|glad|delighted|more than happy) to (?:explain|help|assist)(?: you)?(?: with (?:that|this|it))?[!:][ \t]+(?=\S)/i,
  // "Certainly! …" / "Sure thing! …" — the stock exclamations, whatever follows
  /^(?:certainly|sure thing)![ \t]+(?=\S)/i,
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

/** Capitalise the first letter of `s` — unless that word is not a plain lower-case word ("iPhone", "eBay", "npm…"). */
function capitalise(s: string): string {
  const w = /^[a-z]+(?:['’][a-z]+)?(?=[\s,.!?;:]|$)/.exec(s);
  if (!w || /^(?:npm|git|ls|cd|pip|curl|sudo|yarn|node)$/.test(w[0])) return s;
  return s[0]!.toUpperCase() + s.slice(1);
}

/**
 * A model's reply with the stock chatbot phrases taken out — conservatively (see above). Returns
 * `text` itself, untouched, whenever nothing applies.
 */
export function polish(text: string): string {
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

  if (t === held.trim()) return text;
  return t.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => kept[Number(i)] ?? '');
}
