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
