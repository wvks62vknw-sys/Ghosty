/**
 * THE BOOT'S WORDS (BRIEF-QUALITY-BOOT-ORB 4): every line the boot cinematic shows that is not a fact read from the phone, as pure
 * functions with no screen in them, so shell/boot.ts and tests/bootpass.spec.mjs share one source. Each is one sentence, in his voice.
 */

/** The app could not start (shell/boot.ts bootFault): what happened and the next thing, and a tap anywhere on it does it. */
export const FAULT_WORDS = 'I couldn’t start this time. Tap to try again.';

/** The part of the day a greeting names: before 5 am it is still the night, as Home's own line says. */
export const dayPart = (hr: number): string => (hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening');

/**
 * His greeting: "Good evening, Tony." with the name he saved, "Good evening." with none. "Boss" is the name the app starts with, not one he
 * chose, so it is never said as if it were his.
 */
export function greetingFor(name: string, hr: number): string {
  const n = name.trim();
  return n && n.toLowerCase() !== 'boss' ? `${dayPart(hr)}, ${n}.` : `${dayPart(hr)}.`;
}

/** What the open is waiting for when the landing is held: no signal, the brain not answered yet, or only the app. One sentence. */
export function holdWords(f: { online: boolean; brain: boolean | null }): string {
  if (!f.online) return 'Still starting, waiting for a signal.';
  if (f.brain === null) return 'Still starting, waiting for my brain.';
  return 'Still starting, a moment more.';
}

/** The hold's line shows once the landing has been held this long, ms (the feel of a stall is a second and a half). */
export const HOLD_AFTER = 1000;

/**
 * The stamp's feeds word, settled: while the guardian has not answered the line says CHECKING FEEDS, but only until the recognition (the
 * storyboard's time for it); after that an unanswered guardian is "No feeds yet", which is true, and the line stops holding.
 */
export function settledFeeds<T extends { watching: number | null; offline?: boolean }>(f: T, pastRecognition: boolean): T {
  return f.watching === null && !f.offline && pastRecognition ? { ...f, watching: 0 } : f;
}

// ---------------------------------------------------------------- THE NEXT ROUND (docs/build-plan/next/boot.md)

/** How long the opening is, his choice in Settings (boot.u4): the whole film every time, the short cut every time, or the whole film on the day's first open. */
export type BootLength = 'full' | 'short' | 'daily';
export const LENGTHS: { key: BootLength; label: string; line: string }[] = [
  { key: 'full', label: 'FULL FILM', line: 'The whole seven-second film on every open.' },
  { key: 'short', label: 'SHORT', line: 'The five-second cut on every open.' },
  { key: 'daily', label: 'ONCE A DAY', line: 'The whole film on the day’s first open, the short cut after that.' },
];

/** Which cut a cold open plays by his choice: `previous` is when the open before this one last saw him (ms, 0 on a first open ever). */
export function lengthFor(choice: BootLength | undefined, previous: number, now: number): 'full' | 'short' {
  if (choice === 'short') return 'short';
  if (choice === 'daily' && previous > 0 && new Date(previous).toDateString() === new Date(now).toDateString()) return 'short';
  return 'full';
}

/** Away this long or more (ms), the greeting says how long it has been (boot.u8: "Welcome back, it's been three days"). */
export const AWAY_MS = 2 * 86_400_000;
/** His own opening lines are kept to this many characters each, and this many lines (boot.s9). */
export const LINE_MAX = 80;
export const LINES_MAX = 5;

/** His own opening lines (boot.s9), from what he typed: one a line, trimmed, empty ones dropped, at most LINES_MAX of LINE_MAX characters. */
export function ownLines(text: string): string[] {
  return text.split(/\n+/).map((l) => l.trim().slice(0, LINE_MAX)).filter(Boolean).slice(0, LINES_MAX);
}

/**
 * The opening's one line (boot.u8, boot.s9, boot.s7), from his own records only:
 *  - a guest he named himself ("Sam's turn") is greeted by name, once;
 *  - else his own line, taking turns when he wrote several;
 *  - else, away two days or more, "Welcome back, Tony. It's been three days.";
 *  - else the greeting by the hour ("Good evening, Tony.").
 */
export function openingLine(o: { name: string; hr: number; away: number; own: string[]; turn: number; guest: string }): string {
  const guest = o.guest.trim();
  if (guest) return `${dayPart(o.hr)}, ${guest}.`;
  if (o.own.length) return o.own[Math.abs(o.turn) % o.own.length]!;
  if (o.away >= AWAY_MS) {
    const days = Math.floor(o.away / 86_400_000);
    const n = o.name.trim();
    const who = n && n.toLowerCase() !== 'boss' ? `, ${n}` : '';
    return `Welcome back${who}. It’s been ${days < 10 ? ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'][days] : days} days.`;
  }
  return greetingFor(o.name, o.hr);
}

/** How smoothly the last opening ran (boot.u9), in one sentence: the cut, its length, its frame rate and its longest pause. */
export interface BootRun { kind: string; film: boolean; ms: number; frames: number; worst: number; long: number; at: number }
export function runWords(r: BootRun | null): string {
  if (!r || !(r.ms > 0)) return 'No opening has played on this phone yet. Close me fully and open me again to see one.';
  const what = r.kind === 'still' ? 'the calm opening' : r.kind === 'flat' ? 'the opening without 3-D' : r.kind === 'short' ? 'the short cut' : r.film ? 'the whole film' : 'the opening';
  const fps = Math.round(r.frames / (r.ms / 1000));
  const smooth = r.worst <= 50 ? 'with no stutter' : r.worst <= 120 ? `with one small catch (${r.worst} ms)` : `with a stutter of ${r.worst} ms`;
  return `The last opening played ${what} in ${(r.ms / 1000).toFixed(1)} seconds, ${fps} frames a second, ${smooth}.`;
}

/** What he can say about the opening (boot.u4, boot.u9, boot.s7), read here so the boot, the chat and the checks share one source. */
export type OpeningAsk = { kind: 'length'; length: BootLength } | { kind: 'run' } | { kind: 'guest'; name: string } | { kind: 'noguest' };
export function openingAsked(text: string): OpeningAsk | null {
  const t = text.trim().toLowerCase().replace(/[’]/g, "'").replace(/[.!?]+$/, '');
  if (/^(?:(?:always |play )?(?:the )?short (?:opening|boot|intro|film|version)(?: every time| always)?|make (?:the )?(?:opening|boot|intro) short(?:er)?)$/.test(t)) return { kind: 'length', length: 'short' };
  if (/^(?:(?:always |play )?(?:the )?(?:full|whole|long) (?:opening|boot|intro|film)(?: every time| always)?|make (?:the )?(?:opening|boot|intro) (?:full|long(?:er)?))$/.test(t)) return { kind: 'length', length: 'full' };
  if (/^(?:(?:the )?(?:full |whole )?(?:opening|boot|film|intro) once a day|(?:the )?(?:full |whole )?film only (?:on )?(?:the )?first open(?: of the day)?)$/.test(t)) return { kind: 'length', length: 'daily' };
  if (/^(?:how (?:did|smooth(?:ly)? (?:did|was)) (?:the |my )?(?:opening|boot|intro)(?: run| play| go)?|how smooth was (?:the |my )?(?:opening|boot|intro)|opening (?:frame rate|smoothness))$/.test(t)) return { kind: 'run' };
  if (/^(?:no guest|it's me again|i'm back|cancel (?:the )?guest)$/.test(t)) return { kind: 'noguest' };
  const g = /^(?:it's |now it's )?([a-z][a-z' -]{0,30}?)'s turn$/.exec(t);
  if (g && !/^(?:my|your|whose|his|her|their|it)$/.test(g[1]!)) return { kind: 'guest', name: g[1]!.replace(/\b[a-z]/g, (c) => c.toUpperCase()) };
  return null;
}
