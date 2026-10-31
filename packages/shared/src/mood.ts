/**
 * His mood (OWNER-ISSUES 70b, 63, 69d): honest, lingering, tied to real state — and never a lever. Kept by the brain (one key,
 * apps/edge/src/mood.ts) and mirrored to the phone with the status; pure here, so the phone and the brain read it alike.
 *
 * Triggers are real state only, and only ever from the owner (his words, his stop, his praise or telling-off, a GYM win, a
 * paper being sat, a long job): a telling-off or a harsh dismissal → subdued; praise, being taught something, a kind word
 * after a sharp one, a GYM win → pleased; the owner saying he may be in danger or showing a possible scam → protective; his
 * "go dark" / "get angry" → cross; a paper or a long job → focused. Each lingers for minutes to an hour or two, and a new
 * real trigger replaces the old. "Stand down", "calm down", "it's fine", "I'm sorry" and any stop put him back to calm at
 * once, over everything (a harsh stop leaves him subdued: he stops, and it stung).
 *
 * The guardrail: a mood changes how he sounds, never what he does. Subdued is fewer words, no jokes, a cooler register —
 * never help withheld, never sulking to win an argument, never guilt. A generic "cheer up" does nothing; only what fits him.
 */

export type MoodKind = 'calm' | 'focused' | 'protective' | 'pleased' | 'cross' | 'subdued';

export interface Mood {
  kind: MoodKind;
  /** When it began (ms). */
  since: number;
  /** Why, in a few words of his ("you told me off"). */
  cause: string;
  /** When it fades back to calm (ms); 0 for calm. */
  until: number;
}

export const CALM: Mood = { kind: 'calm', since: 0, cause: '', until: 0 };

/** What happened, as the mood reads it. `weight`: how strongly (1–3), from intent.ts raising. */
export type MoodEvent =
  | { kind: 'stop'; harsh: boolean }
  | { kind: 'standDown' }
  | { kind: 'discipline'; weight: number }
  | { kind: 'reward'; weight: number }
  | { kind: 'taught' }
  | { kind: 'kindWord' }
  | { kind: 'danger'; scam?: boolean }
  | { kind: 'goDark' }
  | { kind: 'task'; what: string; minutes: number }
  | { kind: 'gymWin'; what: string };

const MIN = 60_000;

/** The mood as it is at `now`: past its time, calm again. */
export function moodNow(m: Mood | null | undefined, now = Date.now()): Mood {
  if (!m || typeof m !== 'object' || m.kind === 'calm' || !(Number(m.until) > now)) return CALM;
  return m;
}

const lasting = (kind: Exclude<MoodKind, 'calm'>, cause: string, now: number, minutes: number): Mood => ({ kind, since: now, cause, until: now + minutes * MIN });

/** The mood after `ev`. A new real trigger replaces the old; a stop or a stand-down is calm at once, over everything. */
export function moodAfter(prev: Mood | null | undefined, ev: MoodEvent, now = Date.now()): Mood {
  const was = moodNow(prev, now);
  switch (ev.kind) {
    case 'standDown':
      return CALM;
    case 'stop':
      return ev.harsh ? lasting('subdued', 'you shut me up', now, 45) : CALM;
    case 'discipline':
      return lasting('subdued', 'you told me off', now, ev.weight >= 3 ? 90 : ev.weight === 2 ? 45 : 15);
    case 'reward':
      return lasting('pleased', 'you said I did well', now, ev.weight >= 3 ? 90 : ev.weight === 2 ? 40 : 20);
    case 'taught':
      return lasting('pleased', 'you taught me something', now, 30);
    case 'kindWord':
      // warmth after sharpness; at any other time a kind word is just a kind word
      return was.kind === 'subdued' ? lasting('pleased', 'a kind word after a sharp one', now, 30) : was;
    case 'danger':
      return lasting('protective', ev.scam ? 'a scam you showed me' : 'you may be in danger', now, 90);
    case 'goDark':
      return lasting('cross', 'you said go dark', now, 60);
    case 'task':
      return lasting('focused', ev.what, now, Math.max(5, Math.min(180, ev.minutes)));
    case 'gymWin':
      return lasting('pleased', ev.what, now, 40);
  }
}

// ---------------------------------------------------------------- his words → what happened

/** "Stand down", "calm down", "it's fine", "I'm sorry", at the start of what he said or as all of it. */
const STAND_DOWN = /^(?:(?:ok(?:ay)?|alright|right|hey|ghosty|mate)[,.!]?\s+)*(?:stand down|calm down|chill(?: out)?|relax|easy(?: now| tiger)?|it'?s (?:fine|ok(?:ay)?|alright|all good)|(?:i'?m |i am )?(?:so |really )?sorry|my bad|no worries|we'?re (?:fine|good|ok(?:ay)?)|forget it,? (?:it'?s|we'?re) fine)\b/i;
/** "Go dark", "get angry": his command for cross. */
const GO_DARK = /\b(?:go dark|get angry|get mad|be angry|go evil|go cold|turn (?:evil|dark))\b/i;
/** Warmth: a kind word (only lifts him after a sharp one; a bare "cheer up" is not one). */
const KIND = /\b(?:you'?re (?:alright|ok(?:ay)?|good|great|the best)|love you|appreciate (?:you|it)|thanks?,? (?:mate|lad|pal|buddy|kiddo|ghosty)|(?:i'?m |i am )?not (?:angry|mad|cross) (?:any ?more|at you)|didn'?t mean (?:it|that)|i was (?:harsh|out of order|too harsh)|good lad|good boy|well done)\b/i;
/** Being taught something new: "remember …", "did you know", "TIL", "fun fact". */
const TAUGHT = /^(?:remember (?:that )?|did you know\b|til\b|today i learned\b|fun fact\b|here'?s (?:something|a thing) (?:new|for you)\b|learn this\b)/i;
/** He may be in danger: in his own words, about himself. */
const DANGER = /\b(?:(?:someone|somebody|a (?:guy|man|car|van))(?:'s| is)? (?:following|watching|outside|behind) me|i(?:'m| am) (?:scared|frightened|being followed|in danger|not safe|unsafe)|i (?:don'?t|do not) feel safe|help me,? (?:please|now)|call (?:the police|999|911)|there'?s someone (?:outside|in (?:my|the) house))\b/i;
/** A possible scam he shows me. */
const SCAM = /\b(?:is (?:this|it|that) (?:a )?(?:scam|legit|real|phishing|fake)|scam(?:mer|med)?\b|phishing|(?:text|email|call|message) (?:from|saying it'?s from) (?:my |the )?(?:bank|hmrc|royal mail|dpd|evri|amazon|paypal))/i;

/**
 * What his words did to the mood (one event, the strongest), or null. Only his own message is read here: never a page, a
 * search, a file, a tool's result or what the phone's camera read (owner-only). A bare "cheer up" is nothing.
 */
export function moodEvent(text: string): MoodEvent | null {
  const t = String(text ?? '').trim();
  if (!t || t.length > 600) return null;
  if (STAND_DOWN.test(t)) return { kind: 'standDown' };
  if (GO_DARK.test(t)) return { kind: 'goDark' };
  if (DANGER.test(t)) return { kind: 'danger' };
  if (SCAM.test(t)) return { kind: 'danger', scam: true };
  if (KIND.test(t)) return { kind: 'kindWord' };
  if (TAUGHT.test(t)) return { kind: 'taught' };
  return null;
}

// ---------------------------------------------------------------- how it shows

/** "just now", "20 min ago", "1 h ago" (`short`, for the prompt: "20m ago", "1h ago"). */
const ago = (since: number, now: number, short = false) => {
  const m = Math.max(0, Math.round((now - since) / MIN));
  return m < 2 ? 'just now' : m < 60 ? `${m}${short ? 'm' : ' min'} ago` : `${Math.round(m / 60)}${short ? 'h' : ' h'} ago`;
};

/** How each mood sounds — and, in every one, that it never changes what he does. */
const HOW: Record<Exclude<MoodKind, 'calm'>, string> = {
  subdued: 'few words, no jokes; help fully, never sulk',
  pleased: 'a touch warmer, no gushing',
  protective: 'steady, plain, his safety first',
  cross: 'cold and clipped; still help fully',
  focused: 'steady, few words',
};

/** The ONE line the prompt carries (prompt.ts), or '' when calm: "MOOD: subdued (you told me off, 20 min ago): fewer words…". */
export function moodLine(m: Mood | null | undefined, now = Date.now()): string {
  const x = moodNow(m, now);
  if (x.kind === 'calm') return '';
  return `MOOD: ${x.kind} (${x.cause.replace(/\byou\b/g, 'he').replace(/\bme\b/g, 'you').replace(/\bI\b/g, 'you')}, ${ago(x.since, now, true)}): ${HOW[x.kind]}.`;
}

/** For the Me sheet and STATUS: the word, why and when — never colour alone (SMALL-GAPS L). */
export function moodWords(m: Mood | null | undefined, now = Date.now()): { word: string; why: string } {
  const x = moodNow(m, now);
  if (x.kind === 'calm') return { word: 'Calm', why: '' };
  return { word: x.kind[0]!.toUpperCase() + x.kind.slice(1), why: `${x.cause[0]!.toUpperCase()}${x.cause.slice(1)}, ${ago(x.since, now)}` };
}
