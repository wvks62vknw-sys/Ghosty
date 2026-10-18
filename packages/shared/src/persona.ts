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

const DRY = ['plain-spoken (no wit)', 'sharp, dry', 'sharp, very dry, deadpan'];
const WARM = ['cool and businesslike', 'warm underneath', 'openly warm and kind'];
const BRIEF = ['Short by default, fuller when it helps.', 'Short by default: a sentence or three.', 'As short as it can be: often one sentence.'];

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

/** Openers that only ever stand at the start of a reply or a line. */
const OPENERS: RegExp[] = [
  // "Great question!" / "What a good question." — the whole sentence goes
  /^(?:(?:great|good|excellent|fantastic|brilliant|interesting|lovely) question|what an? (?:great|good|excellent|fantastic|interesting) question)\b(?:[^.!?\n]|[.!?](?=\S))*[.!?]+[ \t]*/gim,
  // "I'd be happy to help with that!" — the whole sentence; "I'd be glad to explain: …" — up to the colon
  /^I(?:'|’| woul)d be (?:happy|glad|delighted|more than happy) to (?:help|assist)\b(?:[^.!?\n]|[.!?](?=\S))*[.!?:]+[ \t]*/gim,
  /^I(?:'|’| woul)d be (?:happy|glad|delighted|more than happy) to\b[^.!?:\n]*[!:][ \t]+(?=\S)/gim,
  // "Certainly! …" / "Sure, …" / "Absolutely. …" — only when something follows
  /^(?:certainly|absolutely|of course|sure thing|sure|definitely|gladly)(?:[!.]+|,)[ \t]+(?=\S)/gim,
  // "As an AI, I can't …" → "I can't …"
  /^as (?:an ai(?: language model| assistant| model)?|a (?:large )?language model),[ \t]*/gim,
];

/** Sentences that go wherever they stand: the stock sign-offs and offers. */
const SENTENCES = [
  'i hope (?:this|that|it) (?:helps|was helpful|is helpful|answers)',
  'hope (?:this|that) helps',
  'let me know if',
  'feel free to',
  "(?:don'?t|do not) hesitate to",
  '(?:is there )?anything else (?:i can|you(?:\'d| would) like|you need)',
  'happy to help',
  "i(?:'|’)?m (?:always )?here to help",
  'if you have any (?:other |more |further )?questions',
];
const SENTENCE_RE = new RegExp(`(^|[.!?…][ \\t]+)(?:${SENTENCES.join('|')})\\b(?:[^.!?\\n]|[.!?](?=\\S))*(?:[.!?]+|$)[ \\t]*`, 'gim');

/** "delve" and friends, with the case of the first letter kept. */
const DELVE: Record<string, string> = { delve: 'dig', delves: 'digs', delved: 'dug', delving: 'digging' };

/** Pictographic emoji (not ✓ ✗ or arrows, which Ghosty's own lines use). */
const EMOJI = /(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2728}\u{2764}\u{2705}\u{274C}\u{2B50}])\u{FE0F}?(?:\u{200D}(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2764}])\u{FE0F}?)*/gu;

const capFirst = (s: string): string => s.replace(/^(\s*)([a-z])/, (_m, sp: string, c: string) => sp + c.toUpperCase());

/**
 * A model's reply with the chatbot phrases taken out: the openers ("Great question!",
 * "Certainly!", "I'd be happy to help"), "As an AI", the sign-offs ("I hope this helps",
 * "Let me know if…", "Feel free to…"), "delve", and a scatter of emoji (two or more; a single
 * one stays). Code (fenced or inline), quoted words, block quotes and links are never touched.
 * A reply that would be left empty comes back as it was.
 */
export function polish(text: string): string {
  if (!text || !text.trim()) return text;
  const kept: string[] = [];
  const hold = (s: string) => `\u0000${kept.push(s) - 1}\u0000`;
  let t = text
    .replace(/```[\s\S]*?(?:```|$)/g, hold)
    .replace(/`[^`\n]+`/g, hold)
    .replace(/^>.*$/gm, hold)
    .replace(/"[^"\n]{1,400}"|“[^”\n]{1,400}”/g, hold)
    .replace(/https?:\/\/[^\s)\]]*[^\s)\].,!?;:'"]/g, hold);
  const before = t;
  for (const re of OPENERS) t = t.replace(re, '');
  // An opener taken off the start of a line leaves its next word to be capitalised.
  if (t !== before) t = t.replace(/(^|\n)([ \t]*)([a-z])/g, (_m, nl: string, sp: string, c: string) => nl + sp + c.toUpperCase());
  // Again until nothing changes: a removed sentence takes the boundary the next one needs.
  for (let i = 0, was = ''; i < 4 && was !== t; i++) [was, t] = [t, t.replace(SENTENCE_RE, '$1')];
  t = t.replace(/,[ \t]*as an ai(?: language model| assistant| model)?,/gi, ',');
  t = t.replace(/\b([Dd])elv(e|es|ed|ing)\b/g, (_m, d: string, end: string) => {
    const w = DELVE[`delv${end}`]!;
    return d === 'D' ? w[0]!.toUpperCase() + w.slice(1) : w;
  });
  if ((t.match(EMOJI) ?? []).length >= 2) t = t.replace(EMOJI, '').replace(/[ \t]+([.,!?])/g, '$1');
  t = t
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  t = capFirst(t);
  const out = t.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => kept[Number(i)] ?? '');
  return /[\p{L}\p{N}]/u.test(out) ? out : text.trim();
}
