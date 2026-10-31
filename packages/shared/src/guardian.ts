/**
 * THE GUARDIAN (OWNER-ISSUES 55, 56, 58, 60: "protection as the first duty"), the parts the brain and the phone share: what
 * the watch over his places looks like, the walk home and its words, and the panic phrase — read from his own words with no
 * model, the same on the phone, in a voice note and on Telegram.
 *
 * The lines that hold here: only public warnings and public counts, shown as published and never extrapolated; no position
 * but his own, only while Ghosty is open, only for a walk he started, and only after he said yes; one named person, reached
 * by Telegram or his own email — never a text message (nothing may bill him). Pure: no storage, no network.
 */

/** The three public feeds the watch reads. */
export type FeedId = 'flood' | 'weather' | 'crime';

export const FEED_NAMES: Record<FeedId, { name: string; source: string }> = {
  flood: { name: 'flood warnings', source: 'Environment Agency' },
  weather: { name: 'weather warnings', source: 'Met Office' },
  crime: { name: 'street crime', source: 'police.uk' },
};

/** One public warning that touches a saved place, as its feed published it. */
export interface GuardWarning {
  /** The feed's own id ("ea:122WAF942", "mo:fb133494-…"). */
  id: string;
  feed: 'flood' | 'weather';
  /** "Flood alert: River Cole at Kings Heath", "Yellow warning of fog". */
  title: string;
  /** 1 the most severe … 3 the least (the Environment Agency's own levels; the Met Office: red 1, amber 2, yellow 3). */
  level: 1 | 2 | 3;
  /** When the feed says it began, or begins (ms). */
  since: number;
  /** When it ends, when the feed says (ms): it is gone from then on. */
  until?: number;
  /** The feed's own words about where, cut short. */
  detail?: string;
  link?: string;
}

/** A month of street crime around a place: the public count and its categories, nothing else. */
export interface CrimeMonth {
  /** "2026-08". */
  month: string;
  total: number;
  /** The biggest categories, in police.uk's words, biggest first. */
  top: [string, number][];
}

/** One saved place under watch. */
export interface PlaceWatch {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** What is active there now, worst first. */
  active: GuardWarning[];
  crime?: CrimeMonth;
  /** The Met Office region it is read for ("West Midlands"); '' outside the feeds' reach. */
  region?: string;
}

/** Where a walk home is. */
export type WalkStage = 'walking' | 'asked' | 'asked2' | 'alerted' | 'done';

export interface WalkInfo {
  id: string;
  startedAt: number;
  /** When he should be home (ms): "Home?" then. */
  eta: number;
  /** The saved place's label ("Home"). */
  to: string;
  stage: WalkStage;
  /** How it ended. */
  how?: 'home' | 'cancelled' | 'expired';
  endedAt?: number;
  /** When the last position came (ms): the position itself is never handed back. */
  posAt?: number;
  /** The named person was messaged (ms). */
  alertedAt?: number;
}

/** The named person, as the phone may see it. */
export interface PersonInfo {
  name: string;
  telegram: string;
  email: string;
  /** Their Telegram chat is known (they opened the bot with the invite). */
  linked: boolean;
  /** How a message would go now: '' when it could not go at all. */
  via: 'telegram' | 'email' | '';
  /** He opted in to his last known position going with a walk's message. */
  sharePos: boolean;
  /** The one-tap link that pairs them with his bot (t.me/<bot>?start=…), while it is valid. */
  invite?: string;
}

/** What a panic phrase is kept as: never the words, only a keyed hash of them and how many words it has. */
export interface PanicSecret {
  salt: string;
  hash: string;
  n: number;
}

/** GET /api/guardian: everything THREATS → NEAR HOME and Settings → GUARDIAN show. */
export interface GuardianInfo {
  places: PlaceWatch[];
  /** When each feed was last read (ms). */
  checked: Partial<Record<FeedId, number>>;
  /** A feed that could not be read last time, in plain words. */
  failed: Partial<Record<FeedId, string>>;
  person: PersonInfo | null;
  panic: PanicSecret | null;
  walk: WalkInfo | null;
  tz: string;
}

// ---------------------------------------------------------------- his words

/** His words, as the phrases below read them: lower case, plain letters and digits, single spaces. */
export function plainWords(text: string): string {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Ghosty", "hey", "ok", "please" around a phrase change nothing. */
const DRESS = /^(?:(?:hey|ok|okay|oi|right|so|ghosty|ghost|mate|please|pls|can you|could you|will you|would you|you|just)\s+)*/;
const TAIL = /(?:\s+(?:please|pls|mate|ghosty|thanks|thank you|now|tonight))*$/;

/** "walk me home" and its family: the start of a walk (said as all of the message). */
export function walkAsked(text: string): boolean {
  const t = plainWords(text).replace(DRESS, '').replace(TAIL, '');
  return /^(?:walk me (?:home|back)|walk home with me|see me home(?: safe(?:ly)?)?|watch me (?:get |walk )?home|keep an eye on me (?:getting|walking|on the way) home|im walking home(?: keep an eye on me| watch me)?|walking home keep an eye on me)$/.test(t);
}

/** "I'm home", "home", "yes", "made it": the walk is over (read only while one is under way). */
export function homeSaid(text: string): boolean {
  const t = plainWords(text).replace(DRESS, '').replace(TAIL, '');
  return /^(?:(?:yes|yeah|yep|yup|ya|aye)(?: (?:im|i am) home| home| safe)?|home|home now|home safe|safe(?: and sound)?|im (?:home|in|back|safe|here)|i am (?:home|in|back|safe|here)|im home safe|made it(?: home)?|i made it(?: home)?|got home|i got home|back home|all good|im good|im fine|im ok|im okay|ok|okay|done|in)$/.test(t) || /^(?:👍|✅|🏠)+$/u.test(String(text ?? '').trim());
}

/** "Cancel the walk", "I'm not going home": the walk ends with nothing sent. */
export function walkCancelled(text: string): boolean {
  const t = plainWords(text).replace(DRESS, '').replace(TAIL, '');
  return /^(?:(?:cancel|stop|end|forget|drop) (?:the |my )?walk(?: home)?|(?:im|i am) not (?:going|walking) home(?: yet)?|no walk|never mind the walk)$/.test(t);
}

const NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fortyfive: 45, fifty: 50, sixty: 60, ninety: 90 };

/** "20 minutes", "20", "half an hour", "an hour and a half", "1h": how long, in minutes (null: not a duration). */
export function minutesIn(text: string): number | null {
  const t = plainWords(text).replace(/\bforty five\b/g, 'fortyfive').replace(/\btwenty five\b/g, '25').replace(/\bthirty five\b/g, '35').replace(DRESS, '').replace(/^(?:about|around|roughly|maybe|like|say|in|its|it is|about an?|takes|it takes)\s+/g, '').replace(/^(?:about|around|roughly)\s+/, '');
  if (!t || t.length > 40) return null;
  if (/^(?:half an hour|half hour|30 ?m(?:in(?:ute)?s?)?)$/.test(t)) return 30;
  if (/^(?:an? hour and a half|one and a half hours|1\.?5 ?h(?:ours?)?|ninety minutes)$/.test(t)) return 90;
  if (/^(?:an? hour|one hour|1 ?h(?:our|r)?)$/.test(t)) return 60;
  if (/^(?:quarter of an hour|a quarter of an hour|quarter hour)$/.test(t)) return 15;
  const m = t.match(/^(\d{1,3}|[a-z]+)\s*(m|mins?|minutes?|h|hrs?|hours?)?$/);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]!) ? Number(m[1]) : NUM[m[1]!];
  if (!n) return null;
  const mins = /^h/.test(m[2] ?? '') ? n * 60 : n;
  return mins >= 1 && mins <= 240 ? mins : null;
}

/** "walk me home", "walk me home, about 20 minutes": a walk starting, and how long he said it takes (null: not said). */
export function walkStart(text: string): { minutes: number | null } | null {
  if (walkAsked(text)) return { minutes: null };
  const w = plainWords(text).split(' ');
  for (let i = w.length - 1; i >= 3; i--) {
    if (!walkAsked(w.slice(0, i).join(' '))) continue;
    const m = minutesIn(w.slice(i).join(' '));
    if (m) return { minutes: m };
  }
  return null;
}

// ---------------------------------------------------------------- the panic phrase

/** The phrase as it is matched: his words, plain. */
export const panicWords = (phrase: string): string[] => plainWords(phrase).split(' ').filter(Boolean);

/** Words too ordinary to make a phrase on their own: a phrase of only these could be said by accident. */
const COMMON = new Set(
  'a an the i im me my you your we us our it its is are was be to of and or in on at for with home yes no ok okay help stop please ghosty hey hi hello thanks thank go come now here there this that what why how when walk going im fine good night bye love'.split(' '),
);

/**
 * Why a panic phrase would not do ('' when it will): never a word he says by accident — at least two words, enough
 * letters, not only everyday words, and none of his everyday commands ("stop", "walk me home", "I'm home").
 */
export function panicProblem(phrase: string): string {
  const w = panicWords(phrase);
  if (w.length < 2) return 'Make it at least two words: one word could be said by accident.';
  if (w.length > 8) return 'Keep it to eight words or fewer, so you can say it quickly.';
  if (w.join('').length < 8) return 'Make it a little longer: at least eight letters in all.';
  if (w.every((x) => COMMON.has(x))) return 'Use at least one unusual word: everyday words get said by accident.';
  const t = w.join(' ');
  if (walkAsked(t) || homeSaid(t) || walkCancelled(t)) return 'That is one of my everyday phrases: pick something you would never say by chance.';
  return '';
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** A keyed hash of the phrase's words (HMAC-SHA-256 with the salt): what is kept, on the phone and in the brain. */
export async function panicHash(salt: string, words: string[]): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(`ghosty-panic\n${salt}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(words.join(' '))));
}

/** A new secret for a phrase he chose (the phrase itself is not kept anywhere). */
export async function panicSecret(phrase: string): Promise<PanicSecret> {
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer as ArrayBuffer);
  const w = panicWords(phrase);
  return { salt, hash: await panicHash(salt, w), n: w.length };
}

/**
 * Did he say his panic phrase? The whole message, or the phrase inside a short message ("Ghosty, blue pineapple"): every
 * run of n words is hashed and compared. A long message never counts (a phrase buried in a paragraph is not a call).
 */
export async function panicSaid(text: string, secret: PanicSecret | null | undefined): Promise<boolean> {
  if (!secret || !secret.salt || !secret.hash || !(secret.n >= 2)) return false;
  const w = panicWords(text);
  if (w.length < secret.n || w.length > secret.n + 6) return false;
  for (let i = 0; i + secret.n <= w.length; i++) if ((await panicHash(secret.salt, w.slice(i, i + secret.n))) === secret.hash) return true;
  return false;
}

// ---------------------------------------------------------------- the watch, in his voice

const andList = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** NEAR HOME's line (THREATS): "I'm watching Home and Work. Nothing active. Last look 14:05." */
export function watchLine(info: Pick<GuardianInfo, 'places' | 'checked' | 'tz'>): string {
  if (!info.places.length) return "I'm not watching any places yet: save home in Memory → ME → PLACES.";
  const active = info.places.reduce((n, p) => n + p.active.length, 0);
  const last = Math.max(info.checked.flood ?? 0, info.checked.weather ?? 0);
  return `I'm watching ${andList(info.places.map((p) => p.label))}. ${active ? `${active} warning${active === 1 ? '' : 's'} active.` : 'Nothing active.'}${last ? ` Last look ${clockIn(last, info.tz)}.` : ''}`;
}

// ---------------------------------------------------------------- the words that go out

/** "22:10" in his zone. */
export function clockIn(t: number, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || 'Europe/London' }).format(t);
  } catch {
    return new Date(t).toISOString().slice(11, 16);
  }
}

/** A map link to a position (OpenStreetMap: no account, no key, no tracking). */
export const mapLink = (p: { lat: number; lon: number }) => `https://www.openstreetmap.org/?mlat=${p.lat.toFixed(5)}&mlon=${p.lon.toFixed(5)}#map=17/${p.lat.toFixed(5)}/${p.lon.toFixed(5)}`;

export interface MessageFacts {
  /** What he is called ("Aqis"). */
  owner: string;
  /** The named person's name. */
  person: string;
  tz: string;
  /** His last known position and when, only when he opted in (or for the panic phrase). */
  pos?: { lat: number; lon: number; at: number } | null;
}

const posLine = (f: MessageFacts) => (f.pos ? `His last known position (${clockIn(f.pos.at, f.tz)}): ${mapLink(f.pos)}` : '');

/** The message when a walk home goes unanswered: who, when he set off, that he has not answered — and his position only if he opted in. */
export function walkAlert(f: MessageFacts & { startedAt: number; eta: number; to: string }): string {
  return [
    `Hi ${f.person}, this is Ghosty, ${f.owner}'s assistant.`,
    `${f.owner} set off for ${f.to.toLowerCase() === 'home' ? 'home' : f.to} at ${clockIn(f.startedAt, f.tz)} and should have been there by ${clockIn(f.eta, f.tz)}. I've asked him twice since and he hasn't answered.`,
    posLine(f),
    `You're the person he chose for this. Could you give him a call? If you can't reach him and you're worried, call 999.`,
  ].filter(Boolean).join('\n');
}

/** The message when he says his panic phrase: at once, with his position when the phone has it. */
export function panicAlert(f: MessageFacts & { at: number }): string {
  return [
    `${f.person}, this is Ghosty, ${f.owner}'s assistant. ${f.owner} has just used his emergency phrase with me (${clockIn(f.at, f.tz)}).`,
    posLine(f) || 'I do not have his position right now.',
    `Please call him now. If you can't reach him, call 999.`,
  ].join('\n');
}

/** The all-clear to the named person, once, when he answers after they were told. */
export function safeNote(f: MessageFacts & { at: number }): string {
  return `${f.person}, this is Ghosty again: ${f.owner} has answered me (${clockIn(f.at, f.tz)}) and is fine. Sorry for the worry.`;
}

/** The test message from Settings → GUARDIAN. */
export function testNote(f: Pick<MessageFacts, 'owner' | 'person'>): string {
  return `Hi ${f.person}, this is Ghosty, ${f.owner}'s assistant — a test, nothing is wrong. ${f.owner} has named you as the one person I message if he doesn't answer me on a walk home, or if he uses his emergency phrase. You don't need to do anything.`;
}
