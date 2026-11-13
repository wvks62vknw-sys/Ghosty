/**
 * Everything Ghosty says in the Telegram app, in one pure file (no network, no storage, no clock it is not handed): the
 * pairing's words, the stranger's line, what a failed voice note or photo asks him to do, the card for an approval, a
 * notification's head and body, the brain's own errors turned into words of his, and the shapes of a reply (markdown made
 * plain, split at a sentence's end). telegram.ts sends them; apps/edge/test/telegram.test.mjs imports them from the bundle of
 * telegram.ts, which re-exports this file. Every line is one sentence in the voice of the prompt: "I", plain, nothing a
 * developer would say (no "webhook", "token", "status", no raw error text).
 */

// ---- who and when ----

/** The one line a stranger gets (once an hour; nothing about them is kept). */
export const STRANGER = "I only answer to my owner, so I can't help in this chat.";
export const GROUP_PAIR = 'Pair me in a private chat with you, not in a group.';
/** The first message after pairing: what he can send. */
export const PAIRED = "Paired. You can send me a message, a voice note or a photo, and I'll answer right here.";
/** UNPAIR, from Telegram (/unpair) or from the phone: what stops. */
export const UNPAIRED = "Unpaired. I've stopped answering this chat and I'll send nothing more here; to pair again, open LINKS → TELEGRAM in Ghosty and send me the new code.";
export const STOPPED = 'Stopped.';
export const TEST_LINE = 'Ghosty here. I can reach you on Telegram now.';
export const NEEDS_INPUT = 'Send me a message, a voice note or a photo.';
export const NO_ANSWER = "I don't have an answer to that. Try asking it another way.";
/** A turn from his phone holds the brain: said with what to do, whether the message waits or a button was pressed. */
export const BUSY = "I'm still answering something from your phone. Send /stop to stop it, or ask me again in a minute.";
export const BUSY_BUTTON = "I'm still answering something from your phone. Send /stop to stop it, then press the button again.";
export const OTHER_FILE = 'I can read photos and pictures sent as files here; other files go in the Library tab in the app.';

/** How long a pairing code lives, in words: "about 15 minutes". */
export function codeLife(ms: number): string {
  const min = Math.max(1, Math.ceil(ms / 60_000));
  return min === 1 ? 'about a minute' : `about ${min} minutes`;
}

/** The code's message in the app (SYSTEM → KEYS after SAVE): the three taps in order, then the code. */
export const codeInfo = (bot: string, code: string, ms: number): string => `Connected to @${bot}. Open it in Telegram, tap START, then send it this code: ${code}. It lasts ${codeLife(ms)}.`;
export const stillPaired = (bot: string, name: string): string => `Connected to @${bot}. You're still paired with ${name} on Telegram.`;
export const KEY_BAD = "That doesn't look like a bot key. It's numbers, a colon, then letters, and @BotFather gives it to you.";
export const KEY_NO_ADDRESS = "I saved the key, but I don't know my own web address yet, so I couldn't connect the bot. Set my public address in the deploy settings, then save the key again.";
export const KEY_NOT_CONNECTED = "I saved the key, but I couldn't connect the bot. Check the key and save it again.";
export const KEY_REMOVED = 'Removed. The bot is disconnected.';

/** What the routes the phone calls say when they cannot do it (the phone draws them as they are: his words, one sentence). */
export const ROUTE = {
  notConnectedYet: "Telegram isn't connected yet; paste your bot's key in SYSTEM → KEYS first.",
  alreadyPaired: "You're already paired; press UNPAIR first to pair another chat.",
  notConnected: "Telegram isn't connected.",
  notPaired: "Telegram isn't paired yet.",
  nothingWaiting: 'Nothing is waiting for your approval.',
  noChat: 'No chat is paired yet; send the bot its code first.',
  noKey: "My bot key isn't saved yet.",
  cannotReach: "I couldn't reach Telegram just now; check the bot key and try again.",
  notFound: "I don't know that one.",
} as const;

// ---- what could not be taken in ----

/** A voice note he sent that could not be heard: one sentence, with the one thing to do. */
export const HEARD = {
  tooBig: (maxMb: number): string => `I couldn't hear that: the recording is too big for me (${maxMb} MB at most), so send a shorter one.`,
  noEars: "I couldn't hear that because nothing here can listen yet; add a free Groq key in SYSTEM → KEYS, or type it instead.",
  silent: "I couldn't make out any words in that voice note; try again a little closer to the phone.",
  failed: "I couldn't hear that just now; send it again, or type it.",
} as const;

/** A photo that could not be fetched: why in his words, never the raw error. */
export function photoFail(why: string): string {
  return /too big|over \d|\bMB\b/i.test(why)
    ? "I couldn't get that photo: it's too big for me (1.5 MB at most), so send a smaller one."
    : /JPEG|PNG|WebP|not a/i.test(why)
      ? "I couldn't get that photo because I can only read JPEG, PNG and WebP pictures; send it as a photo, not a file."
      : "I couldn't get that photo just now; send it again, or send it as a file.";
}

export const PICTURE_FILE_PREVIEW = "That file is too big or in a format I can't read whole, so I'm looking at its small preview. Send it as a photo, not a file, for more detail.";
export const PICTURE_FILE_FAILED = "I couldn't read that picture file (too big, or a format like HEIC). Send it as a photo, not a file.";

/** The plain line before a video, a GIF or a TikTok is answered: what of it came through. */
export const unwatchable = (kind: string, sound: boolean, over: string): string => `🎞 I can't watch ${kind}s yet: I'm going by one still frame of it${sound ? ", and I can't hear its sound" : ''}.${over}`;

// ---- an approval ----

/** What a waiting call asks, as the card quotes it: "forget all", "publish site (name: bakery)". */
export function approvalThing(reason: string): { thing: string; fromApp: boolean } {
  const fromApp = /\(asked in the app\)\s*$/.test(reason);
  const r = reason.replace(/\s*\(asked in the app\)\s*$/, '').trim();
  const m = /^Allow (.+?)\?\s*(.*)$/s.exec(r);
  const thing = m ? `${m[1]}${m[2] ? ` (${m[2].trim()})` : ''}` : r.replace(/[.?!\s]+$/, '');
  return { thing: thing.slice(0, 600), fromApp };
}

/** The card: the thing quoted, what APPROVE does and what NOT NOW does, in one line. */
export function approvalCard(reason: string): string {
  const { thing, fromApp } = approvalThing(reason);
  return `If you approve, I'll do exactly this: “${thing}”. APPROVE does it now; NOT NOW leaves it undone.${fromApp ? " It's waiting in the app too." : ''}`;
}

// ---- the brain's own errors, in words of his ----

const TECHNICAL = /undefined|\bnull\b|\bNaN\b|\[object|TypeError|RangeError|SyntaxError|ReferenceError|DOMException|NetworkError|Failed to|Cannot |Can.t read propert|Unexpected (?:token|end)|JSON|\bat \w+.*:\d+|\bHTTP \d{3}\b|\bstatus \d{3}\b|\bfetch\b|\bpromise\b|\bstack\b|\bexception\b|\bERR_|\b[A-Z][A-Za-z]+Error\b|\bECONN|\b[45]\d\d\b|[{}<>\\]|webhook|callback|payload/i;

export const PAUSED = "My database has used up its free allowance for today, so I'm paused until midnight UTC (1am UK summer time); nothing is lost.";
export const GENERIC_FAIL = "I couldn't finish that just now. Try again in a moment.";
export const NO_MODEL = 'None of my AI models answered just now. Try again in a minute; a free key in SYSTEM → KEYS gives me more room.';

/** "in about 20 seconds" / "in about 3 minutes" from the seconds the router names. */
function inAbout(seconds: number): string {
  return seconds < 90 ? `in about ${Math.max(1, Math.round(seconds))} seconds` : `in about ${Math.ceil(seconds / 60)} minutes`;
}

/** The cooling line: said once, with the time the first model is back, as the app says it. */
export function coolingLine(when?: string): string {
  return `All my models are busy right now. ${when ? `The first is back ${when}.` : "I'll be back soon."} Ask me again then.`;
}

/**
 * A brain error (`error` events, or whatever a turn threw) as the words he reads: the database's pause, every model
 * cooling or full, none answering, or a sentence already in his voice kept whole; anything technical becomes one plain line.
 */
export function sayBrain(raw: string): string {
  const m = String(raw ?? '').replace(/\s+/g, ' ').trim();
  if (!m) return GENERIC_FAIL;
  if (/^Answered, but not saved/i.test(m)) return m;
  if (/free daily allowance|database has used up|database is paused|rows (?:read|written)|free tier/i.test(m)) return PAUSED;
  const secs = /(?:frees up|back) in about (\d+) seconds?/i.exec(m)?.[1];
  const at = /first is back at ([^).]{2,30})\)/i.exec(m)?.[1];
  if (/cooling down|full for now|frees up in about|rate limit/i.test(m)) return coolingLine(secs ? inAbout(Number(secs)) : at ? `at ${at}` : undefined);
  if (/no ai model answered|every model i can reach/i.test(m)) return at ? coolingLine(`at ${at}`) : /too small/i.test(m) ? 'That was too big for the free models I can reach. Try a shorter message.' : NO_MODEL;
  const words = m.split(' ').length;
  if (m.length <= 240 && words >= 2 && !TECHNICAL.test(m) && /^[A-Z“"'‘]/.test(m)) return /[.!?…”"]$/.test(m) ? m : `${m}.`;
  return GENERIC_FAIL;
}

/** One step of a slow turn, in his words, or '' to say nothing (the chat's own lines: "Asking my brain…", "Writing it now…"). */
export function stepWords(status: string): string {
  const s = String(status ?? '').replace(/\s+/g, ' ').trim();
  if (!s || /^(?:thinking|thinking about the results|processing|working)(?:…|\.\.\.)?$/i.test(s)) return 'Asking my brain…';
  if (/^waiting for free AI room|^cooling for/i.test(s)) return 'All my models are busy. Waiting for one…';
  if (s.length > 100 || TECHNICAL.test(s)) return 'Working on it…';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ---- sources ----

/** A cited answer's numbered addresses, after its text: "SOURCES", then one line each (a source never opened is left out). */
export function sourcesBlock(citations: { n: number; title?: string; url?: string; doc?: string; missing?: boolean }[]): string {
  const lines = citations
    .filter((c) => !c.missing && (c.url || c.doc))
    .map((c) => {
      const name = String((c.url ? c.title : c.doc || c.title) ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
      return c.url ? `${c.n}. ${name && name !== c.url ? `${name} — ` : ''}${c.url}` : `${c.n}. ${name} (in your library)`;
    });
  return lines.length ? `SOURCES\n${lines.join('\n')}` : '';
}

// ---- notifications ----

/** A time of day as he reads it ("14:30"), in his time zone when it is known, else UTC said so. */
export function clock(at: number, tz?: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz || 'UTC' }).format(at) + (tz ? '' : ' UTC');
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }).format(at) + ' UTC';
  }
}

/** The body of something that went wrong: his own sentence when it is one, else one plain line (the details wait in the app). */
export function errorBody(text: string): string {
  const t = String(text ?? '').replace(/^This did not run:\s*/i, '').replace(/\s+/g, ' ').trim();
  return t && t.length <= 240 && !TECHNICAL.test(t) ? (/[.!?…”"]$/.test(t) ? t : `${t}.`) : "I couldn't finish it; the details are in your inbox in the app.";
}

/** A notification as Telegram shows it: a head in words, the body, and when it happened. */
export function notifyText(item: { kind: string; title: string; text: string }, at: number, tz?: string): string {
  const t = clock(at, tz);
  if (item.kind === 'reminder') return `Reminder: ${item.text}\nIt was due at ${t}.`;
  if (item.kind === 'task') return `Done: ${item.title}\n${item.text}\nFinished at ${t}.`;
  return `Something went wrong: ${item.title}\n${errorBody(item.text)}\nIt happened at ${t}.`;
}

/** What the app is told when a message could not reach Telegram (once; the newest one stands). */
export interface Missed {
  at: number;
  what: 'reminder' | 'task' | 'error';
  n: number;
}
export function missedLine(m: Missed, tz?: string): string {
  const what = m.what === 'reminder' ? 'a reminder' : m.what === 'task' ? 'a finished task' : 'a warning';
  return `${m.n > 1 ? `${m.n} messages did not reach you on Telegram, the last one` : "A message didn't reach you on Telegram"} at ${clock(m.at, tz)} (${what}); ${m.n > 1 ? 'they are' : 'it is'} in your inbox in the app.`;
}

// ---- a reply's shape ----

const strip = (s: string): string =>
  s
    .replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_m, alt: string, u: string) => (alt && alt !== u ? `${alt} (${u})` : u))
    .replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (_m, t: string, u: string) => (t === u ? u : `${t} (${u})`))
    .replace(/\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*/g, '$1')
    .replace(/(?<![\w])__(?!\s)([^_\n]+?)(?<!\s)__(?![\w])/g, '$1')
    .replace(/(?<![\w*])\*(?![\s*])([^*\n]+?)(?<![\s*])\*(?![\w*])/g, '$1')
    .replace(/(?<![\w])_(?!\s)([^_\n]+?)(?<!\s)_(?![\w])/g, '$1')
    .replace(/~~(?!\s)([^~\n]+?)(?<!\s)~~/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1');

/**
 * A reply the model wrote in markdown, as plain text Telegram shows cleanly: a heading as a line in capitals, bullets as "•",
 * bold, italics and code marks dropped, a link as "words (address)", a table as lines, a rule gone. Nothing is lost: every
 * word and address of the reply is still there.
 */
export function plainReply(md: string): string {
  const out: string[] = [];
  let fence = false;
  for (const raw of String(md ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*(```|~~~)/.test(raw)) {
      fence = !fence;
      continue;
    }
    if (fence) {
      out.push(raw);
      continue;
    }
    const line = raw;
    const h = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (h) {
      out.push(strip(h[1]!).toUpperCase());
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      out.push('');
      continue;
    }
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue; // the rule under a table's head
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => strip(c.trim()));
      out.push(cells.join(' · '));
      continue;
    }
    const b = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (b) {
      out.push(`${b[1]!.length >= 2 ? '  ◦' : '•'} ${strip(b[2]!)}`);
      continue;
    }
    out.push(strip(line.replace(/^\s{0,3}>\s?/, '')));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Words that end in a full stop without ending a sentence. */
const NOT_END = /^(?:e\.g|i\.e|vs|etc|mr|mrs|ms|dr|prof|st|no|fig|approx|cf|inc|ltd|[a-z])$/i;

/** Where in `slice` a part may end: a paragraph break, else the later of a sentence's end and a line break, else a space. */
function cutPoint(slice: string, max: number): number {
  const floor = max / 3;
  const para = slice.lastIndexOf('\n\n');
  if (para >= floor) return para;
  let best = 0;
  for (const m of slice.matchAll(/[.!?…]["'”’)\]]*(?=\s)/g)) {
    const end = m.index! + m[0].length;
    const before = slice.slice(0, m.index! + 1);
    const word = /(\S+)$/.exec(before)?.[1] ?? '';
    const bare = word.replace(/[.!?…]+$/, '').replace(/^[("'“‘[]+/, '');
    // a list's "12." at the start of a line, or "e.g.", "Dr.": not the end of a sentence
    if (/(?:^|\n)[ \t]*\d{1,3}[.)]$/.test(before) || NOT_END.test(bare)) continue;
    best = end;
  }
  const line = slice.lastIndexOf('\n');
  const cut = Math.max(best, line >= floor ? line : 0);
  if (cut >= floor) return cut;
  const space = slice.lastIndexOf(' ');
  return space >= floor ? space : max;
}

/** A reply cut into messages under `max`: at a paragraph, a sentence's end or a line, never in the middle of a word when a space is near. */
export function splitParts(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = String(text ?? '').trim();
  while (rest.length > max) {
    const cut = cutPoint(rest.slice(0, max + 1), max);
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}

/** "(1 of 3) " in front of each part, only when there are parts. */
export const partLabel = (i: number, n: number): string => (n > 1 ? `(${i + 1} of ${n}) ` : '');
/** Room kept in a part for its label. */
export const LABEL_ROOM = 12;
