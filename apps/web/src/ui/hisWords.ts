/**
 * ONE ERROR VOICE. Anything thrown becomes his own words, in few words: what it means and what to do.
 * The thrown thing's raw text never reaches a screen or a voice: it goes to the WHY trail (kept here, and
 * on the console) and nowhere else. A lint (apps/edge/test/hisWords.test.mjs) fails on any new `e.message`,
 * `String(e)` or `${e}` outside this file.
 *
 *   sayError(e, 'save it')  → the sentence to show or speak (what = the thing he was doing, as a verb phrase)
 *   rawText(e)              → the raw text, ONLY for deciding what happened (a regex test), never for showing
 *   trail(e, where)         → put the raw text on the WHY trail
 */

export type ErrorKind = 'abort' | 'network' | 'timeout' | 'permission' | 'quota' | 'notfound' | 'memory' | 'rest';

/** The raw words of a thrown thing: for deciding, never for showing. */
export function rawText(e: unknown): string {
  if (e == null) return '';
  if (typeof e === 'string') return e;
  const m = (e as { message?: unknown }).message;
  if (typeof m === 'string') return m;
  try {
    return typeof e === 'object' ? JSON.stringify(e) ?? '' : `${e as string}`;
  } catch {
    return '';
  }
}

const TRAIL: { at: number; where: string; raw: string }[] = [];
/** The WHY trail: the last forty raw errors with where they came from, for the one who asks why. */
export function whyTrail(): readonly { at: number; where: string; raw: string }[] {
  return TRAIL;
}
export function trail(e: unknown, where: string): void {
  const raw = rawText(e).slice(0, 400);
  TRAIL.push({ at: Date.now(), where, raw });
  if (TRAIL.length > 40) TRAIL.shift();
  // (the console in a browser only: a Node tool that speaks on its stdout (the Gym's task runner) must never get a stray line)
  if (typeof document !== 'undefined') {
    try {
      console.debug('[why]', where, raw);
    } catch {
      /* no console */
    }
  }
}

const nameOf = (e: unknown): string => String((e as { name?: unknown })?.name ?? '');

export function kindOf(e: unknown): ErrorKind {
  const n = nameOf(e);
  const m = rawText(e);
  if (n === 'AbortError' || /\babort(ed)?\b|\bcancell?ed\b|\bsuperseded\b/i.test(m)) return /time(d)? ?out/i.test(m) ? 'timeout' : 'abort';
  if (n === 'TimeoutError' || /time(d)? ?out|took too long|deadline/i.test(m)) return 'timeout';
  if (n === 'NotAllowedError' || n === 'PermissionDeniedError' || n === 'SecurityError' || /permission|not allowed|denied|access_denied/i.test(m)) return 'permission';
  if (n === 'QuotaExceededError' || /quota|storage is full|no space|disk full/i.test(m)) return 'quota';
  if (n === 'NotFoundError' || /\b404\b|not found|no such|does not exist|isn.t on this phone/i.test(m)) return 'notfound';
  if (n === 'RangeError' || /out of memory|allocation failed|could not allocate|no available backend|device (?:was )?lost|buffer size/i.test(m)) return 'memory';
  if (/failed to fetch|fetch failed|load failed|network ?error|networkerror|network request|offline|econn|enotfound|err_internet|err_network|socket|unreachable|connection (?:was )?(?:lost|reset|closed)|\bHTTP 5\d\d\b/i.test(m)) return 'network';
  if (typeof navigator !== 'undefined' && navigator.onLine === false && n === 'TypeError') return 'network';
  return 'rest';
}

/** A message our own code threw in his voice (a plain Error, a few plain words, nothing technical in it). */
const TECHNICAL = /undefined|\bnull\b|\bNaN\b|\[object|TypeError|RangeError|SyntaxError|ReferenceError|DOMException|NetworkError|Failed to|Cannot |Can.t read propert|is not (?:a function|defined|an object|iterable)|Unexpected (?:token|end)|JSON|\bat \w+.*:\d+|\bHTTP \d{3}\b|\bstatus \d{3}\b|\b\d{3} \w+ error\b|\bfetch\b|\bpromise\b|\bstack\b|\bexception\b|\bLoad failed\b|\b[45]\d\d\b|\bERR_|\b[A-Z][A-Za-z]+Error\b|\bwasm\b|\bWebAssembly\b|\bGPUDevice\b|\bworker error\b/i;
function ownWords(e: unknown): string | null {
  // a refusal our own code wrote in his words on purpose (`refuse`, or `said`): kept whole, whatever its length
  const mark = e as { refuse?: unknown; said?: unknown } | null;
  if (e instanceof Error && (mark?.refuse === true || mark?.said === true) && e.message.trim()) return e.message.trim();
  if (!(e instanceof Error) || e.name !== 'Error') return null;
  const m = e.message.trim();
  if (m.length < 10 || m.length > 220 || m.split(/\s+/).length < 3 || /^[^A-Za-z]/.test(m) || TECHNICAL.test(m) || /[{}<>\\]/.test(m)) return null;
  return /[.!?…]$/.test(m) ? m : `${m}.`;
}

/** An error our own code throws in his own words (a refusal, an instruction): sayError says it whole. */
export const inHisWords = (message: string): Error => Object.assign(new Error(message), { refuse: true });

const trim = (what: string) => what.trim().replace(/[.:]+$/, '') || 'do that';

/**
 * Any thrown thing → his own words. `what` is what he was doing, as a verb phrase ("read that photo",
 * "open the camera"). Few words, what it means, what to do. Never the raw text.
 */
export function sayError(e: unknown, what = 'do that'): string {
  const w = trim(what);
  trail(e, w);
  // an error our own code wrote in his words on purpose (`inHisWords`) is said whole, whatever its words would be taken for
  const mark = e as { refuse?: unknown; said?: unknown } | null;
  if (e instanceof Error && (mark?.refuse === true || mark?.said === true) && e.message.trim()) return e.message.trim();
  switch (kindOf(e)) {
    case 'abort':
      return 'Stopped. Nothing was lost.';
    case 'timeout':
      return 'That took too long; I stopped it. Try again in a moment.';
    case 'network':
      return 'I lost the signal halfway. Try again when you have one.';
    case 'permission':
      return `The phone would not let me ${w}. Settings, Ghosty, and switch it on.`;
    case 'quota':
      return 'The phone has no room left for that. Free some space, then try again.';
    case 'memory':
      return 'That needed more memory than the phone could spare. Close other apps and try again.';
    case 'notfound':
      return `I could not find what I needed to ${w}. It may have moved or never been here.`;
    default:
      return ownWords(e) ?? `I could not ${w}. Try again in a moment.`;
  }
}
