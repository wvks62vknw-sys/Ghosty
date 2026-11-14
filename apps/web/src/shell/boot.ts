/**
 * The boot cinematic (docs/build-plan/BRIEF-ORB-AND-BOOT.md and its storyboard, docs/build-plan/mockups/boot/2026-11-07;
 * before it BRIEF-BOOT.md, BRIEF-BOOT2.md; OWNER-ISSUES 43, 45 and 142, his words: "really cinematic and cool", "on every boot
 * up", then "the cinematic btw which can be a lot lot lot better"). The orb waking on the ground, in the world, in his colour;
 * 2,880 ms to a usable Home on every cold open (a launch from the Home Screen, a fresh tab). The cut (cut.js, the storyboard's
 * numbers), each shot true of its moment: nothing on it is decoration that lies:
 *   1. the ground, nothing else, one breath: the room's light breathing in where the orb will be                 0 ms
 *   2. the world's floor forms, drawn from its tokens as it arrives: The Scan's points sampled in from the top-left
 *      corner; The Map's grid line by line and the one crosshair finding the orb's centre; The Eye's grain settling
 *      and one box; One Ink's one rule drawn; Glass's blur clearing                                             240 ms
 *   3. the orb forms from his library's points (today's gather, kept: the drift out of the point of light, the trails,
 *      the sweep refracting at the equator, the push-in), then the sphere resolves from the inside out             560 ms
 *   4. the stamp line types itself in mono with a block cursor: the day · the time · his saved place · CHECKING FEEDS
 *      (ui/machine.ts stampWords, the real facts; 10 ms a character)                                           1,240 ms
 *   5. the feeds answer, one truth line each as they connect, a lock-length apart, only the ones that really did
 *      (the guardian's info: checked and not failed); the stamp becomes WATCHING n FEEDS; offline it says so     1,700 ms
 *   6. the recognition: the reticle snaps onto the orb with the tone (ui/machine.ts recognise: the lock's duration and
 *      curve from the tokens, the sound on top of his sound setting and the sound switch), G H O S T Y under it  2,180 ms
 *   7. the greeting, his line, under the stamp where Home's first line lives; spoken now when the phone allows   2,460 ms
 *   8. the orb eases up into Home's hero (the same Mind, never a copy); a beat after it lands the HUD slides in  2,640 ms
 *      a usable Home                                                                                              2,880 ms
 * A small TAP TO SKIP shows from the orb's first light to the recognition; a tap skips it at any moment. It never delays
 * the app: main.ts keeps booting underneath and calls bootReady(); the cinematic lands when both are done, and its own part
 * is over 2,880 ms after its first frame (if the app is still starting then, the orb keeps turning quietly, with no words,
 * until it is). Every frame is held to a budget (a long frame: over 12 ms at 120 Hz, over 20 at 60): long frames are counted
 * in __bootState.budget, and a phone that cannot keep up gets less: the short version (the floor and the orb fade in whole,
 * no gather, trails, sweep or push-in; the stamp, the feeds and the recognition kept) when even the ground's breath stutters
 * or one draw of Mind overruns a frame, or, mid-flight, the lean cut (the trails and the refraction dropped, the rest
 * quickened) once a quarter of the recent frames ran long or one frame stalled a quarter of a second. With no 3-D at all (the flat kind): the ground, the floor, the
 * stamp, the feeds, the box snapping onto the point of light where the 2-D fallback lives, the greeting. Reduce Motion, and
 * MOTION set to calm: two frames, 1.2 s, nothing travels (the ground, the floor, the orb, the stamp and the feeds whole; then
 * the box, the name and the greeting; the tone still plays once if his sounds are on: a sound, not a motion).
 * Coming back to a running app (a tab switch, the app resumed in the same page life, a page restored from the back-forward
 * cache) and a deep link (a notification, Spotify's way back): no cinematic; Mind's light breathes out once (400 ms;
 * 150 ms with Reduce Motion). "reboot" (said or typed) and SYSTEM → REBOOT HIM play it again.
 * The ground (BRIEF-THEMES-2): it plays on the ground in force in the theme's colour and world; under Paper on his night
 * ground (the boot lands on Home, a room still drawn light on dark), the layer carrying the night ground's tokens and the
 * theme's accent block (data-ground, data-accent), and bootState.recipe says so.
 * Sound: a low hum, made here with WebAudio (no file), quiet, only with the voice setting on, only where the phone allows
 * sound (never on a resume); the recognition's tone through the sound set (assistant/sfx.ts) on top of his sound setting.
 * The greeting is spoken in his voice with the voice setting on: at once if the phone allows it, else on the first tap
 * (iOS keeps a cold open silent until a tap); once.
 * Automated checks see none of it (it would slow every check that opens the app) unless one asks: tests/boot.spec.mjs.
 *
 * THE FILM (BRIEF-HUD-SCAN-1 6; features/core/scan/film.ts): when THE LOOK's world is The Scan the picture is round two's film with
 * the descent: the eye first, the scan a sphere of light growing out of it over his desk and sampling the world as the camera comes
 * down from the sky over the city to rest on THE WHOLE OF IT, each thing locking into its reticle as the front reaches it, the orb
 * forming from his library's points, the feeds answering, the recognition's wave, the greeting, the search locking on tonight's
 * thing, the landing. Home usable at 7,000 ms (the short cut about 4,800); the same six kinds, the same budget, the same skip (a tap
 * plays the landing), the same greeting rules, `__bootSeek` for the check. The world is drawn in Home's one context (mind.ts, staged
 * full-screen) and Home takes the stage at the landing, so the landing is no cut: the film's last frame is Home's first.
 * THE FILM ON HIS PHONE (FINAL-BOOT, 13 Nov: "the boot-up cinematic is like non-existent"): the film decides its version at its scan
 * (500 ms), the first shot that needs Mind, and holds there with the room breathing until Mind draws: by 1,500 ms the full film, by
 * 2,700 the short cut, the wait made up by the pace so Home is still usable at 7,000; only a phone with no 3-D, or Mind later than
 * that, gets the flat cut. It judges the phone by its own draw (a 60 Hz frame), never by the app starting underneath (the ground's
 * stutter, a late first frame, one stalled frame); a lean sheds the trails and the refraction and keeps the film's length. A cold
 * open under three minutes after he last had Ghosty on screen (state/lastopen.ts: the phone closed it behind him) plays the short
 * cut, ending by its own 4,800; every other cold open, the whole film. tests/bootfilm.spec.mjs opens it with no version picked.
 */
import { h } from '../core/dom';
import { BOOT_DONE, currentMind, mindFor, webglWorks, type BootLook, type Mind, type MindState } from '../features/core/mind';
import { home, settings, ui } from '../state/app';
import { guardian, loadGuardian } from '../state/guardian';
import { tvNow } from '../tv/setting'; // [restc] a television gets the short cut
import { previousOpen } from '../state/lastopen';
import { lockBox, marksState, recognise, release, stampTyped, stampWords, truthLine, type TruthPart } from '../ui/machine';
import { sfxAllowed } from '../assistant/sfx';
import { feedsAnswered, stampFacts } from './awareness';
import { FAULT_WORDS, FILM_SHOTS, HOLD_AFTER, STORY_SHOTS, greetingFor, holdWords, lengthFor, offlineLine, openingLine, ownLines, settledFeeds, shotWords, type BootRun } from './bootwords';
import { Film, FILM, FILM_SHORT, type FilmCut, type FilmState } from '../features/core/scan/film';
import { resetScoreState, scoreState, scoreTuning, startScore, type Score } from '../features/core/scan/score';
import { litByHour, scanHooks, scanScene } from '../features/core/scan/home';
import { worldDesc, ORB_FILL } from '../features/core/scan/world';
import { eyeShot, type EyeShot, type EyeShotState } from '../features/core/eye/film';
import { FEED_NAMES, type FeedId, type GuardianInfo } from '../../../../packages/shared/src/guardian';

type Kind = 'full' | 'short' | 'still' | 'flat' | 'warm' | 'quiet';
type Phase = 'ground' | 'floor' | 'orb' | 'stamp' | 'feeds' | 'recognise' | 'greeting' | 'land' | 'done';
type Timeline = Record<Exclude<Phase, 'done'> | 'end', number>;

/** When each beat starts, in ms from the first frame: the storyboard's cut (mockups/boot/2026-11-07/cut.js). */
const FULL: Timeline = { ground: 0, floor: 240, orb: 560, stamp: 1240, feeds: 1700, recognise: 2180, greeting: 2460, land: 2640, end: 2880 };
/** A slow phone, a late Mind or a television: the floor and the orb fade in whole (no gather, trails, sweep or push-in); the rest kept. */
const SHORT: Timeline = { ground: 0, floor: 160, orb: 400, stamp: 760, feeds: 1200, recognise: 1600, greeting: 1800, land: 1960, end: 2200 };
/** Reduce Motion, or MOTION calm: two frames, nothing moves (A: the ground, the floor, the orb, the stamp, the feeds; B: the box, the name, the greeting). */
const STILL: Timeline = { ground: 0, floor: 0, orb: 200, stamp: 200, feeds: 200, recognise: 600, greeting: 600, land: 1000, end: 1200 };
/** No 3-D here: the ground, the floor, the stamp, the feeds, the box on the point of light, the greeting, then Home's own hero. */
const FLAT: Timeline = { ground: 0, floor: 160, orb: 400, stamp: 520, feeds: 900, recognise: 1200, greeting: 1360, land: 1500, end: 1700 };
const LINES: Record<'full' | 'short' | 'still' | 'flat', Timeline> = { full: FULL, short: SHORT, still: STILL, flat: FLAT };
/** THE FILM's cuts as timelines (features/core/scan/film.ts): the full film, Home usable at 7,000; the short cut about 4,800. */
const asTimeline = (c: FilmCut): Timeline => ({ ground: c.ground, floor: c.scan, orb: c.orb, stamp: c.stamp, feeds: c.feeds, recognise: c.recognise, greeting: c.greeting, land: c.land, end: c.end });
const FILM_LINES: Record<'full' | 'short' | 'still' | 'flat', Timeline> = { full: asTimeline(FILM), short: asTimeline(FILM_SHORT), still: STILL, flat: FLAT };
const PHASES: Exclude<Phase, 'done'>[] = ['ground', 'floor', 'orb', 'stamp', 'feeds', 'recognise', 'greeting', 'land'];
/** The cinematic's own part is over this long after its first frame, whatever happens (the cut's own end: 2,880, or the film's 7,000). */
const capOf = (lines: Record<'full', Timeline>) => lines.full.end;
/** A beat between Mind landing in the hero and the HUD sliding in round it, ms. */
const BEAT = 110;
/** The lock's length (the tokens' --g-dur-lock): the feeds' lines come one of these apart. */
const LOCK = 160;
/** The stamp line's pace at boot: three times the brain's 33 ms a character (ui/machine.ts). */
const TYPE_MS = 10;
/** The floor forms over this long, ms. */
const FLOOR_MS = 400;
/** The orb's light is first seen this long after its beat starts; TAP TO SKIP shows from then to the recognition. */
const FIRST_LIGHT = 400;
/** A long frame, ms: over 12 at 120 Hz, over 20 at 60 (the frame and a half that the eye reads as a stutter). */
const LONG_120 = 12;
const LONG_60 = 20;
/** Mid-flight: a quarter of the last WINDOW frames long (LEAN_AT of them; from LEAN_MIN frames on, a quarter of those seen, three
 *  at least), and the full cut leans (its extras go, the rest quickens). */
const WINDOW = 24;
const LEAN_AT = 6;
const LEAN_MIN = 8;
/** One frame this long mid-flight (ms: fifteen 60 Hz frames) says the same by itself: the phone cannot keep up. */
const STALL = 250;
/** Mind (three.js) must be drawing by then for the full version, and by SHORT_BY for the short one. */
const FULL_BY = 900;
const SHORT_BY = 1700;
/**
 * THE FILM decides at its scan (the first shot that needs Mind), not at the orb: Mind must be drawing by FILM_FULL_BY for the full
 * film and by FILM_SHORT_BY for its short cut. The wait is made up by the pace, so Home is still usable 7,000 ms after the first
 * frame (FINAL-BOOT: the film used to decide at the orb's 2,000 ms, which is always after SHORT_BY, so every real cold open fell to
 * the flat cut and the film never played; only the checks, which pick the version, ever saw it).
 */
const FILM_FULL_BY = 1500;
const FILM_SHORT_BY = 2700;
/** A cold open this soon after he last had Ghosty on screen (the phone closed it behind him) plays the short cut (FINAL-BOOT's rule). */
export const QUICK_REOPEN_MS = 3 * 60_000;
/** The most the short cut started at a quick reopen is quickened to make up a wait for Mind (a quarter: never rushed). */
const QUICK_PACE = 1.25;
/** The three feeds the guardian reads, in the order their lines come (packages/shared/src/guardian.ts). */
const FEED_WORD: Record<FeedId, string> = { flood: 'Flood', weather: 'Weather', crime: 'Crime' };

/** What happened, for tests/boot.spec.mjs and the console (window.__bootState; __ghosty.boot once that exists). */
export const bootState = {
  kind: '' as Kind | '',
  /** The accent the cinematic plays in: the picked theme's (state/theme.ts writes it as --c before the first frame). */
  accent: '',
  /**
   * The recipe it plays in (BRIEF-THEMES-2), as state/theme.ts set it on <html> before the first frame: the colour, the ground in
   * force, the world, and the floor it plays on (the night ground's canvas: the boot lands on Home, a room still drawn light on
   * dark, so under Paper it plays on the night ground and says so here).
   */
  recipe: { theme: '', ground: '', night: '', world: '', floor: '', glow: '' },
  phase: '' as Phase | '',
  /** When each phase began, in ms after the first frame. */
  marks: {} as Record<string, number>,
  /** From the page starting to the cinematic's first frame, ms. */
  firstFrame: 0,
  /** When the app underneath was ready, and when the cinematic ended, in ms after its first frame (-1: not yet). */
  appReady: -1,
  ended: -1,
  skipped: false,
  frames: 0,
  /** The longest gap between two of its frames, ms. */
  worstGap: 0,
  /**
   * The frame budget: the display's rate as its frames show it (120 or 60; 0 before three gaps), what a long frame is
   * here (ms), how many came, the gaps themselves (ms, the first 600), the most and the mean one frame's own work took
   * (ms: Mind's draw, the floor, the marks, not the app booting underneath), and where the full cut leaned because the
   * phone could not keep up ('' if it never did).
   */
  budget: { hz: 0, ms: LONG_60, long: 0, gaps: [] as number[], work: 0, avg: 0, lean: '' as Phase | '' },
  /** The cut that played (when each phase starts, ms), and the pace it ran at from the orb on (1: real time;
   *  more after Mind was waited for, or once it leaned), for the timings the check compares against. */
  timeline: null as Timeline | null,
  pace: 1,
  /** What one full draw of Mind cost when it decided which version to play, ms (after a first draw that warms it up). */
  drawMs: -1,
  /** How long it held before landing, waiting for the app underneath and Home's hero, ms. */
  held: 0,
  /** The line the held landing showed for a late app ('' if it never was held that long). */
  holdLine: '',
  /** Passes of the sweep made while the film was held for a slow Home (one every 1.3 s: the last shot never stands still). */
  heldSweeps: 0,
  /** Whether Mind (three.js) drew it. */
  mind: false,
  /** Whether the hum played (the voice setting on and the phone allowing sound). */
  sound: false,
  /** What the recognition played: the sound switch's tone or click, off (the switch), or quiet (his sounds off, or a cold
   *  open the phone has not been tapped: iOS allows no sound until then); '' before the recognition. */
  tone: '' as '' | 'tone' | 'click' | 'off' | 'quiet',
  /** The stamp line's words as typed (stampWords: the day, the time, his saved place, the feeds' state). */
  stamp: [] as string[],
  /** The feeds' lines as shown, one per feed that answered (none offline, none for a feed that failed). */
  feedLines: [] as string[],
  /** The world whose floor was drawn forming ('' when the recipe has no floor: One Ink's rule, Glass's blur count as theirs). */
  floorDrawn: '',
  greeting: '',
  /** How the greeting was spoken: at once, on the first tap, or not (voice off, or no tap came). */
  spoken: '' as '' | 'now' | 'tap' | 'waiting' | 'off',
  /** How many times the greeting was handed to his voice (once at most). */
  said: 0,
  /** When the HUD began to slide in, ms after the first frame (a beat after Mind landed; -1: not yet). */
  hudAt: -1,
  /** Where the sphere was on its last frame in the air, and Home's hero box, as [x, y, width, height]. */
  landed: null as null | { flight: number[]; hero: number[] },
  /** Resumes (and deep links) answered with a breath of Mind's light. */
  warm: 0,
  /** How many times it has played since the page opened (a reboot adds one). */
  plays: 0,
  /** How long ago he last had Ghosty on screen when this cold open began (ms; -1: never on this phone), and whether that was
   *  soon enough (QUICK_REOPEN_MS) for the short cut. */
  reopen: -1,
  quick: false,
  /** Start-up jobs that waited for the landing (afterLanding), and when (ms after the first frame) they were let go (-1: none waited). */
  deferred: 0,
  deferredAt: -1,
  /** The offline opening's line (boot.s10), '' with a signal. */
  offlineLine: '',
  /** What matters today, the line the search ends on (boot.u2: the diary's next thing, a to-do due, rain); '' when there is none. */
  todayLine: '',
  /** THE FILM played (the world is The Scan and Mind drew it): the descent, the things found, the orb's viewport (film.ts). */
  film: false,
  scan: null as FilmState | null,
  /** THE EYE's last second (features/core/eye/film.ts): the wall resolving from grain, one feed sharpening into the accent box, the line of sight drawn; null in the other worlds. */
  eyewall: null as EyeShotState | null,
  /** THE SCORE (B) under the film: whether it sounded and which cues came (score.ts); A (the one tone) when he chose it or the phone allows no sound yet. */
  score: scoreState,
};

const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Nothing travels: the phone's Reduce Motion (it always wins), or MOTION set to calm (state/theme.ts writes data-motion). */
const calmWanted = () => reduced() || document.documentElement.dataset.motion === 'calm';
const clamp = (k: number) => (k <= 0 ? 0 : k >= 1 ? 1 : k);
const easeOut = (k: number) => 1 - Math.pow(1 - clamp(k), 3);
const easeInOut = (k: number) => {
  const x = clamp(k);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
type Flags = { __ghostyBoot?: boolean; __ghostyBootKind?: Kind; __ghostyBootLean?: boolean; __ghostyBootManual?: boolean; __bootSeek?: (ms: number) => void; __bootFault?: () => void; __bootState?: typeof bootState; __ghosty?: Record<string, unknown> };
const flags = () => window as unknown as Flags;

/** "Good evening, Tony." from the clock and the name in Settings; with none saved (or the app's own "Boss"), "Good evening." alone (bootwords.ts). */
export function greetingLine(d = new Date()): string {
  return greetingFor(settings.get().name, d.getHours());
}

/** Where the last opening's run is kept on this phone (boot.u9: how smoothly it ran), and the turn his own lines take. */
export const RUN_KEY = 'ghosty.lastboot';
const TURN_KEY = 'ghosty.bootturn';
/** The last opening's run as this phone kept it (null before any). */
export function lastRun(): BootRun | null {
  try {
    const r = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null') as BootRun | null;
    return r && typeof r.ms === 'number' ? r : null;
  } catch {
    return null;
  }
}

/**
 * The opening's line (boot.u8, boot.s9, boot.s7): a guest he named, once; else his own line, taking turns; else, away two days or more,
 * how long it has been; else the greeting by the hour. Only from this phone's own records. `use`: this is an opening, so a guest's
 * greeting is spent and his lines take their next turn.
 */
export function openingWords(use: boolean, d = new Date()): string {
  const s = settings.get();
  const guest = s.bootGuest && s.bootGuest.until > d.getTime() ? s.bootGuest.name : '';
  let turn = 0;
  try {
    turn = Number(localStorage.getItem(TURN_KEY) ?? 0) || 0;
    if (use && s.bootLines?.trim() && !guest) localStorage.setItem(TURN_KEY, String(turn + 1));
  } catch {
    /* no storage: the first line every time */
  }
  const line = openingLine({ name: s.name, hr: d.getHours(), away: bootState.reopen, own: ownLines(s.bootLines ?? ''), turn, guest });
  if (use && guest) settings.set({ bootGuest: { name: '', until: 0 } });
  return line;
}

/** "2026-08" → "Aug". */
const monthWord = (m: string) => {
  const n = Number(m.split('-')[1]);
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][n - 1] ?? m;
};

/**
 * One truth line per feed that answered: what it knows now (FLOOD · ENVIRONMENT AGENCY · NOTHING ACTIVE; WEATHER · MET OFFICE ·
 * NO WARNINGS; CRIME · POLICE.UK · SEP · 14 WITHIN A MILE: police.uk publishes a month's count about two months behind, a
 * count and never a forecast). Nothing for a feed that failed, nothing offline.
 */
export function feedLines(info: GuardianInfo | null): { id: FeedId; parts: TruthPart[] }[] {
  const answered = feedsAnswered(info);
  if (!info || !answered) return [];
  return answered.map((f) => {
    const parts: TruthPart[] = [{ text: FEED_WORD[f], tone: 'strong' }, FEED_NAMES[f].source];
    if (f === 'crime') {
      const c = info.places.find((p) => p.crime)?.crime;
      if (c) parts.push(monthWord(c.month), `${c.total} within a mile`);
      else parts.push('No count yet');
    } else {
      const n = info.places.reduce((k, p) => k + p.active.filter((a) => a.feed === f).length, 0);
      parts.push(f === 'flood' ? (n ? `${n} active` : 'Nothing active') : n ? `${n} ${n === 1 ? 'warning' : 'warnings'}` : 'No warnings');
    }
    return { id: f, parts };
  });
}

// ---------------------------------------------------------------- the app underneath
let appIsReady = false;
let started = 0;
/** The app could not start: the cinematic stops where it is and the fault's words stay. */
let faulted = false;

/** main.ts: the app is up underneath (the first screen is open and the frame loop runs). */
export function bootReady(): void {
  appIsReady = true;
  if (started) bootState.appReady = Math.round(performance.now() - started);
  // a plain open: the black layer goes as soon as the app is there
  const el = document.getElementById('boot');
  if (el && (bootState.kind === 'quiet' || bootState.kind === 'warm' || !bootState.kind)) {
    el.classList.add('out');
    setTimeout(() => el.remove(), bootState.kind === 'warm' ? 200 : 300);
    if (bootState.kind === 'warm') breatheWhenReady();
    watchReturns();
  }
}

/**
 * main.ts: start-up jobs that can wait (the notices, push, the library's copy, the queued sends) start once the opening film has landed,
 * on the next idle moment, so the film's frames and Home's first second have the phone to themselves; with no film playing (a resume,
 * a deep link, the automated checks) they start at once, as always. `bootState.deferred` counts what waited.
 */
export function afterLanding(fn: () => void): void {
  const playing = () => !!document.getElementById('boot') && (bootState.kind === 'full' || bootState.kind === 'short' || bootState.kind === 'still' || bootState.kind === 'flat');
  if (!playing()) return fn();
  bootState.deferred++;
  const idle = (cb: () => void) => ((window as unknown as { requestIdleCallback?: (f: () => void, o: { timeout: number }) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 1)))(cb, { timeout: 1500 });
  const look = () => (playing() ? void setTimeout(look, 100) : idle(() => {
    bootState.deferredAt = bootState.ended >= 0 ? bootState.ended : -1;
    fn();
  }));
  look();
}

/** main.ts: the app could not start. Plain words and a way out; nothing technical, no numbers. */
export function bootFault(): void {
  faulted = true;
  document.body.classList.remove('booting', 'bootland', 'bootwait');
  const el = document.getElementById('boot') ?? document.body.appendChild(h('div#boot'));
  el.classList.remove('out');
  /* state: shell.boot error */
  el.classList.add('fault');
  // the words say the next thing and the tap does it: the button, and the whole layer behind it
  const again = () => location.reload();
  el.addEventListener('click', again);
  el.replaceChildren(h('div.bfault', { role: 'alert' }, h('p', FAULT_WORDS), h('button.on', { type: 'button', onclick: again }, 'TRY AGAIN')));
}

/** The very start of main.ts's boot: decide what this open shows, and start it. */
export function startBoot(): void {
  const f = flags();
  f.__bootState = bootState;
  f.__bootFault = bootFault; // (a check shows the fault's words: tests/bootpass.spec.mjs)
  const el = document.getElementById('boot') ?? document.body.appendChild(h('div#boot'));
  const automated = navigator.webdriver && !f.__ghostyBoot;
  const hash = location.hash.slice(1);
  // never over a notification he tapped, a deep link or the way back from Spotify's sign-in: those open their screen
  const toHome = (!hash || hash === 'core') && !/[?&]code=/.test(location.search);
  // every cold open plays it (the page is new: nothing of the app was running); a resume never reaches here
  // [restc] on a television (TV MODE) the short cut: the orb and the words, nothing that needs WebGPU; with no 3-D at all it is the flat one
  // a quick reopen (he had it on screen under three minutes ago, and the phone closed it behind him): the short cut, not the whole film again
  bootState.reopen = previousOpen > 0 ? Math.max(0, Date.now() - previousOpen) : -1;
  bootState.quick = bootState.reopen >= 0 && bootState.reopen < QUICK_REOPEN_MS;
  // his choice of length (Settings → THE OPENING): the short cut every time, or the whole film only on the day's first open
  const chosen = lengthFor(settings.get().bootLength, previousOpen, Date.now());
  let kind: Kind = automated ? 'quiet' : !toHome ? 'warm' : calmWanted() ? 'still' : tvNow() || bootState.quick || chosen === 'short' ? 'short' : 'full';
  // a check may pick which version plays (software WebGL is too slow for the full one to choose itself)
  if (f.__ghostyBoot && f.__ghostyBootKind && kind !== 'quiet' && kind !== 'warm') kind = f.__ghostyBootKind;
  bootState.kind = kind;
  el.classList.add(kind);
  if (kind === 'quiet' || kind === 'warm') return;
  play(el, kind, false);
}

/** "reboot" and SYSTEM → REBOOT HIM: Home, then the whole cinematic again over it. */
export async function reboot(): Promise<void> {
  if (document.getElementById('boot')) return;
  const { go } = await import('./tabs');
  go('core');
  // let Home lay out first, so the landing has its hero to land on
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const el = document.body.appendChild(h('div#boot'));
  // (a replay is not a reopen: no "welcome back", and the readings say so)
  bootState.reopen = -1;
  bootState.quick = false;
  const kind: Kind = calmWanted() ? 'still' : 'full';
  bootState.kind = kind;
  el.classList.add(kind);
  play(el, kind, true);
}

/**
 * THE DIRECTOR'S MODE (NEXT ROUND boot.u12): the opening again over Home, one named shot at a time: PREV and NEXT (and the arrow keys)
 * step, DONE lands on Home as the film does. The bar sits outside the boot's layer, so its keys never count as a tap to skip. False when an
 * opening is already on screen.
 */
export const directorState = { on: false, shot: -1, shots: 0, line: '' };
export async function director(): Promise<boolean> {
  if (document.getElementById('boot') || directorState.on) return false;
  const f = flags();
  f.__ghostyBootManual = true;
  await reboot();
  const seek = f.__bootSeek;
  if (!seek || !document.getElementById('boot')) {
    f.__ghostyBootManual = false;
    return false;
  }
  // (the first step decides which cut plays: the film's shots, or the storyboard's in the other looks)
  seek(0);
  const shots = bootState.film ? FILM_SHOTS : STORY_SHOTS;
  const end = bootState.timeline?.end ?? 7000;
  directorState.on = true;
  directorState.shots = shots.length;
  const line = h('p.bdline', { role: 'status', dataset: { case: 'keep' } });
  const go = (i: number) => {
    const k = Math.max(0, Math.min(shots.length - 1, i));
    directorState.shot = k;
    directorState.line = shotWords(k, shots);
    line.textContent = directorState.line;
    // (each shot photographed half way through, so what it does is on screen)
    const next = k + 1 < shots.length ? shots[k + 1]![1] : end;
    seek(Math.round((shots[k]![1] + next) / 2));
  };
  const done = () => {
    removeEventListener('keydown', onKey);
    bar.remove();
    seek(end);
    f.__ghostyBootManual = false;
    directorState.on = false;
    directorState.shot = -1;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') go(directorState.shot + 1);
    else if (e.key === 'ArrowLeft') go(directorState.shot - 1);
    else if (e.key === 'Escape') done();
  };
  const bar = h('div#bdirector', { role: 'group', 'aria-label': 'The opening, shot by shot' }, line,
    h('div.bdkeys', h('button', { type: 'button', onclick: () => go(directorState.shot - 1) }, 'PREV'), h('button', { type: 'button', onclick: () => go(directorState.shot + 1) }, 'NEXT'), h('button.on', { type: 'button', onclick: done }, 'DONE')));
  document.body.append(bar);
  addEventListener('keydown', onKey);
  go(0);
  return true;
}

// ---------------------------------------------------------------- the resume
let watching = false;
function watchReturns(): void {
  if (watching) return;
  watching = true;
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt > 3000 && !document.getElementById('boot')) breatheWhenReady();
  });
  // a page the browser kept whole and showed again (the back-forward cache): the same page life, so a resume
  addEventListener('pageshow', (e) => {
    if (e.persisted && !document.getElementById('boot')) breatheWhenReady();
  });
}
/** Mind's light breathes out once behind whatever is on screen (when Mind is there to breathe). */
function breatheWhenReady(): void {
  let n = 0;
  const tryIt = () => {
    const m = currentMind();
    if (m?.active && !m.booting) {
      m.breathe(reduced() ? 0.15 : 0.4);
      bootState.warm++;
    } else if (++n < 40) setTimeout(tryIt, 150);
  };
  tryIt();
}

// ---------------------------------------------------------------- sound: a low hum under the orb's waking, gone at the recognition
function hum(tl: Timeline = FULL): (() => void) | null {
  if (!settings.get().speak) return null;
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  // a cold open has had no tap: the phone would refuse (and Safari says so); nothing is queued for later
  if (ua && !ua.hasBeenActive) return null;
  let a: AudioContext;
  try {
    a = new AudioContext();
  } catch {
    return null;
  }
  void a.resume().catch(() => undefined);
  const t = a.currentTime + 0.05;
  const out = a.createGain();
  out.gain.value = 0.5;
  const lp = a.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(260, t);
  lp.frequency.linearRampToValueAtTime(900, t + tl.recognise / 1000);
  lp.connect(out).connect(a.destination);
  // the hum: two low tones a hair apart (a slow beat between them), rising a little as the orb wakes, gone as the box lands
  // (the recognition's own tone, ui/machine.ts, is the sound of that moment)
  for (const [f, v] of [[55, 0.05], [55.6, 0.04], [110, 0.018]] as const) {
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 1.19, t + tl.recognise / 1000);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + (tl.orb + 560) / 1000);
    g.gain.setValueAtTime(v, t + tl.feeds / 1000);
    g.gain.exponentialRampToValueAtTime(0.0001, t + tl.recognise / 1000);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + tl.recognise / 1000 + 0.1);
  }
  bootState.sound = true;
  setTimeout(() => void a.close().catch(() => undefined), tl.end + 1000);
  // skipped: the sound goes with it
  return () => {
    try {
      out.gain.setTargetAtTime(0, a.currentTime, 0.05);
    } catch {
      /* closed already */
    }
  };
}

// ---------------------------------------------------------------- the greeting, in his voice
function sayGreeting(text: string, cold: boolean): void {
  if (!settings.get().speak) {
    bootState.spoken = 'off';
    return;
  }
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  const say = () => {
    bootState.said++;
    void import('../assistant/voice').then((v) => v.speak(text)).catch(() => undefined);
  };
  if (!cold || !ua || ua.hasBeenActive) {
    bootState.spoken = 'now';
    say();
    return;
  }
  // iOS keeps a cold open silent until a tap: the first tap says it (within the gesture, so the phone allows it),
  // unless he is typing or signing in, or it comes much later. A tap on a card or a button still greets him: Home is
  // his wall now (batch ②), so the first tap lands on something tappable more often than not.
  bootState.spoken = 'waiting';
  const until = Date.now() + 30_000;
  const onTap = (e: PointerEvent) => {
    removeEventListener('pointerup', onTap, true);
    const tgt = e.target as Element | null;
    const busy = !!tgt?.closest?.('input, textarea, select, #pairform') && !tgt?.closest?.('#boot');
    if (Date.now() > until || busy || ui.get().voice !== 'idle') {
      bootState.spoken = 'off';
      return;
    }
    bootState.spoken = 'tap';
    say();
  };
  addEventListener('pointerup', onTap, true);
}

// ---------------------------------------------------------------- the world's floor, drawn from its tokens as it forms
/** The Eye's grain as one tile, kept between frames. */
let eyeTile: HTMLCanvasElement | null = null;
/** A fixed pseudo-random number from a place on the floor, so each point's moment is the same every open. */
const hash2 = (x: number, y: number) => {
  const v = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/**
 * The floor of the world forming at `k` (0..1) on a 2-D canvas the size of the screen, in the room's points at the floor's
 * strength (the tokens on the layer: --g-room-points-rgb, --g-floor-a, --g-line); `at` is the orb's centre, for The Map's
 * crosshair and The Eye's box; `rule` where One Ink's rule sits (under the stamp). What every screen stands on after the boot
 * (styles.css body::before: the same mask tile, so the floor drawn here is the floor Home stands on), drawn as it arrives.
 */
function drawFloor(g: CanvasRenderingContext2D, world: string, k: number, W: number, H: number, dpr: number, tok: { pts: string; a: number; line: string }, at: { x: number; y: number; r: number }, rule: { x1: number; x2: number; y: number }, kc: number): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W * dpr, H * dpr);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const { pts, a, line } = tok;
  if (k <= 0 || a <= 0 && world !== 'ink') return;
  if (world === 'scan') {
    // the points sampled in from the top-left corner: a front crossing the screen, each point a little early or late; the ones
    // just sampled a step brighter, then settling to the floor's own strength
    for (let y = 8; y < H; y += 16)
      for (let x = 8; x < W; x += 16) {
        const when = (x / W) * 0.55 + (y / H) * 0.45 + (hash2(x, y) - 0.5) * 0.1;
        const d = k * 1.1 - Math.max(0, when);
        if (d <= 0) continue;
        const fresh = d < 0.08 ? 1 - d / 0.08 : 0;
        g.fillStyle = `rgba(${pts}, ${(a + fresh * 0.5).toFixed(3)})`;
        g.beginPath();
        g.arc(x, y, 1.1 + fresh * 0.5, 0, Math.PI * 2);
        g.fill();
      }
  } else if (world === 'map') {
    // the plotting grid drawn line by line: the verticals from the left, the horizontals from the top (the tile: lines every
    // 16 px at .4, a crosshair of 17 px at 1.5 every five squares), then the one crosshair finding the orb's centre
    const ln = (x1: number, y1: number, x2: number, y2: number, w: number, al: number) => {
      g.strokeStyle = `rgba(${pts}, ${al.toFixed(3)})`;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x1, y1);
      g.lineTo(x2, y2);
      g.stroke();
    };
    const kv = clamp(k / 0.45);
    const kh = clamp((k - 0.4) / 0.4);
    const kx = clamp((k - 0.75) / 0.25);
    for (let x = 8.5; x < W; x += 16) if (x / W <= kv) ln(x, 0, x, H * (k >= 1 ? 1 : Math.min(1, (kv - x / W) * 6 + 0.2)), 1, a * 0.4);
    for (let y = 8.5; y < H; y += 16) if (y / H <= kh) ln(0, y, W * (k >= 1 ? 1 : Math.min(1, (kh - y / H) * 6 + 0.2)), y, 1, a * 0.4);
    for (let y = 40.5; y < H; y += 80)
      for (let x = 40.5; x < W; x += 80)
        if (kx > 0) {
          ln(x - 8.5, y, x + 8.5, y, 1.5, a * kx);
          ln(x, y - 8.5, x, y + 8.5, 1.5, a * kx);
        }
    if (kc > 0) {
      const cx = 40.5 + (at.x - 40.5) * easeInOut(kc);
      const cy = 40.5 + (at.y - 40.5) * easeInOut(kc);
      g.strokeStyle = line;
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(cx - 14, cy);
      g.lineTo(cx + 14, cy);
      g.moveTo(cx, cy - 14);
      g.lineTo(cx, cy + 14);
      g.stroke();
    }
  } else if (world === 'eye') {
    // the grain settling: the mask's tile (six grains in 8 px, each at its own strength), each grain a few pixels off its place
    // at first and settling onto it, drawn as one 64 px tile and repeated (forty thousand grains a frame is too many fills);
    // then the one sharp box where the orb forms, the thing The Eye looks at
    const grains: [number, number, number][] = [[0, 0, 1], [4, 2, 0.6], [2, 5, 0.8], [6, 6, 0.5], [5, 0, 0.35], [1, 3, 0.45]];
    const settle = easeOut(k);
    const TILE = 64;
    if (!eyeTile) eyeTile = document.createElement('canvas');
    eyeTile.width = eyeTile.height = Math.round(TILE * dpr);
    const tg = eyeTile.getContext('2d');
    if (tg) {
      tg.setTransform(dpr, 0, 0, dpr, 0, 0);
      tg.clearRect(0, 0, TILE, TILE);
      const strength = a * Math.min(1, k * 2);
      for (let y = 0; y < TILE; y += 8)
        for (let x = 0; x < TILE; x += 8)
          for (const [gx, gy, op] of grains) {
            const jx = (hash2(x + gx, y + gy) - 0.5) * 6 * (1 - settle);
            const jy = (hash2(y + gy, x + gx) - 0.5) * 6 * (1 - settle);
            tg.fillStyle = `rgba(${pts}, ${(strength * op).toFixed(3)})`;
            tg.fillRect(x + gx + jx, y + gy + jy, 1, 1);
          }
      const pat = g.createPattern(eyeTile, 'repeat');
      if (pat) {
        // (the tile is drawn at device pixels: the pattern is scaled back to CSS pixels)
        pat.setTransform?.(new DOMMatrix().scale(1 / dpr));
        g.fillStyle = pat;
        g.fillRect(0, 0, W, H);
      }
    }
    if (kc > 0) {
      const r = at.r * easeOut(kc);
      g.strokeStyle = line;
      g.lineWidth = 1;
      g.strokeRect(at.x - r + 0.5, at.y - r + 0.5, 2 * r - 1, 2 * r - 1);
    }
  } else if (world === 'ink') {
    // One Ink has no floor: one rule, drawn from the left, under where the stamp line will sit
    g.strokeStyle = line;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(rule.x1, rule.y + 0.5);
    g.lineTo(rule.x1 + (rule.x2 - rule.x1) * easeOut(k), rule.y + 0.5);
    g.stroke();
  }
  // Glass has no floor pattern: its blur clearing is the layer's own filter (play())
}

// ---------------------------------------------------------------- the cinematic
function play(el: HTMLElement, first: Kind, rebooting: boolean): void {
  bootState.plays++;
  bootState.marks = {};
  bootState.phase = '';
  bootState.ended = -1;
  bootState.skipped = false;
  bootState.landed = null;
  bootState.frames = 0;
  bootState.worstGap = 0;
  bootState.held = 0;
  bootState.heldSweeps = 0;
  bootState.holdLine = '';
  bootState.said = 0;
  bootState.hudAt = -1;
  bootState.pace = 1;
  bootState.tone = '';
  bootState.stamp = [];
  bootState.feedLines = [];
  bootState.floorDrawn = '';
  bootState.budget = { hz: 0, ms: LONG_60, long: 0, gaps: [], work: 0, avg: 0, lean: '' };
  bootState.film = false;
  bootState.scan = null;
  bootState.eyewall = null;
  const B = bootState.budget;
  if (rebooting) appIsReady = true;
  let kind = first as 'full' | 'short' | 'still' | 'flat';
  const dd = document.documentElement.dataset;
  // THE FILM: The Scan's world gets round two's film with the descent (features/core/scan/film.ts); the other worlds today's picture
  const filmWanted = dd.world === 'scan' && kind !== 'flat' && webglWorks();
  const L = filmWanted ? FILM_LINES : LINES;
  // (the short cut chosen at the start, a quick reopen's or a television's, aims to end by its own length, a wait for Mind made up inside
  // it but never rushed: QUICK_PACE at most, so a late Mind ends it a little later instead; every other cut aims at the full cut's end)
  const CAP = kind === 'short' ? L.short.end : capOf(L);
  const startedShort = kind === 'short';
  let tl = L[kind];
  bootState.timeline = tl;
  /** Where the cut first needs Mind, and holds (the room breathing) until it is drawing: the film's scan, else the orb's gather. */
  const needAt = () => (filmWanted && (kind === 'full' || kind === 'short') ? tl.floor : tl.orb);
  const vw = innerWidth;
  const vh = innerHeight;
  // under Paper the boot plays on his night ground in his colour: the layer carries the night ground's tokens and the theme's
  // accent block (as a swatch does), so its marks are the night ground's and the orb keeps the theme's own light
  if (dd.ground === 'paper') {
    el.dataset.ground = dd.night || 'graphite';
    el.dataset.accent = dd.theme || '';
  }
  // the stage: the orb in a square box a little above the middle; the stamp at the top; the name under the orb's box
  const side = Math.round(Math.min(vw * 0.8, vh * 0.42, 380));
  const box = { x: Math.round((vw - side) / 2), y: Math.round(vh * 0.4 - side / 2), w: side, h: side };
  const cx = box.x + side / 2;
  const cy = box.y + side / 2;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const ground = h('div.bveil');
  const room = h('i.broom');
  const floor = h('canvas.bfloor', { width: Math.round(vw * dpr), height: Math.round(vh * dpr), 'aria-hidden': 'true' });
  const glass = h('i.bglass');
  ground.append(room, floor, glass);
  el.prepend(ground);
  // THE EYE (BRIEF-EYE-HUD-2): its last second is the wall resolving from grain onto Home's own rectangles (features/core/eye/film.ts); created here, in the ground layer, for the eye only
  let eyeFilm: EyeShot | null = null;
  const dot = el.querySelector<HTMLElement>('.bdot') ?? el.appendChild(h('i.bdot'));
  dot.style.left = `${cx}px`;
  dot.style.top = `${cy}px`;
  // the orb's box, the thing the reticle lands on: the sphere's radius is 0.9 × 0.74 of the half side (mind.ts size()), the
  // box 5 px outside it (the point of light with no 3-D)
  const orbBox = h('i.borb', { 'aria-hidden': 'true' });
  const stamp = h('p.g-stamp.bstamp', { dataset: { g: 'stamp', case: 'keep' } });
  const greet = h('p.bgreet', { dataset: { case: 'keep' }, hidden: true }, openingWords(true));
  const feeds = h('div.bfeeds');
  // a slow open (the network slow, the brain cold): after six seconds the film says so, in its own voice, and keeps moving
  const slow = h('p.bslow', { dataset: { case: 'keep' }, role: 'status', hidden: true }, 'Still waking. The signal is slow.');
  // the landing held for a late app: after a second, in the stamp's small type, what it waits for (never a frozen frame)
  const hold = h('p.bhold.g-truth', { dataset: { case: 'keep' }, role: 'status', hidden: true });
  // no signal at the open: one line says so, and what still works on this phone (boot.s10)
  const off = h('p.boffline.g-truth', { dataset: { case: 'keep' }, role: 'status', hidden: true });
  bootState.offlineLine = '';
  if (navigator.onLine === false) {
    off.textContent = offlineLine(false);
    bootState.offlineLine = off.textContent;
    void import('../offline/brain').then((b) => {
      off.textContent = offlineLine(!!b.offlineBrain.get().downloaded);
      bootState.offlineLine = off.textContent;
    }).catch(() => undefined);
  }
  // what matters today (boot.u2): looked up now, shown from the greeting on, where the search ends
  const today = h('p.btoday.g-truth', { dataset: { case: 'keep' }, hidden: true });
  bootState.todayLine = '';
  void import('./bootday').then((d) => d.dayFocus()).then((line) => {
    today.textContent = line;
    bootState.todayLine = line;
  }).catch(() => undefined);
  const top = h('div.btop', stamp, greet, today, feeds, hold, off, slow);
  const name = h('p.bname', { dataset: { case: 'keep' } }, 'GHOSTY');
  const skip = h('p.bskip', { dataset: { case: 'keep' } }, 'Tap to skip');
  bootState.greeting = greet.textContent ?? '';
  el.append(orbBox, top, name, skip);
  const lock = lockBox(el);
  el.classList.add('playing');
  document.body.classList.add('booting');
  const cs0 = getComputedStyle(el);
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--c').trim() || '#64d2ff';
  bootState.accent = accent;
  bootState.recipe = { theme: dd.theme ?? '', ground: dd.ground ?? '', night: dd.night ?? '', world: dd.world ?? '', floor: cs0.getPropertyValue('--g-room-canvas').trim(), glow: dd.glow ?? '' };
  const world = dd.world ?? '';
  if (world === 'eye' && !filmWanted && innerWidth < 900) {
    eyeFilm = eyeShot(ground, vw, vh, dpr, accent);
    bootState.eyewall = eyeFilm.state;
  }
  const floorTok = { pts: cs0.getPropertyValue('--g-room-points-rgb').trim() || cs0.getPropertyValue('--g-bone-rgb').trim() || '236, 232, 223', a: parseFloat(cs0.getPropertyValue('--g-floor-a')) || 0, line: cs0.getPropertyValue('--g-line').trim() || `rgba(${accent}, .4)` };
  const gutter = parseFloat(cs0.getPropertyValue('--g-gutter')) || 16;
  // (the top block sits under the status bar: styles.css places it from the safe area; One Ink's rule is drawn under it)
  const topY = Math.round(top.getBoundingClientRect().top);
  const fctx = floor.getContext('2d');
  let floorAt = -1;
  // (the film draws the world itself: the floor forming is the scan's points, so the 2-D floor stays out of its way)
  const floorHas = filmWanted ? false : world === 'scan' || world === 'map' || world === 'eye' ? floorTok.a > 0 : world === 'ink' || world === 'glass' || world === 'orbit' || world === 'grown';
  if (floorHas || filmWanted) bootState.floorDrawn = world;

  // Mind: the one the hero will use (woken here, or taken from the hero on a reboot)
  let mind: Mind | null = null;
  let mindState: 'wait' | 'ready' | 'none' = 'none';
  // the film's world: built once Mind is in (the scene is Home's too: the same buffers at every altitude), lean on a phone that cannot keep up
  const lit = litByHour();
  let film: Film | null = null;
  let worldBuilt: '' | 'full' | 'lean' = '';
  const buildWorld = (lean: boolean) => {
    const want = lean ? 'lean' : 'full';
    if (worldBuilt === want) return;
    scanScene().build(worldDesc(lit === 'r-alice' ? 'alice' : 'brief', lean));
    worldBuilt = want;
  };
  if (kind !== 'flat' && webglWorks()) {
    mind = mindFor(null);
    mindState = mind.active ? 'ready' : 'wait';
    if (filmWanted && mind.active) buildWorld(kind === 'short');
    if (!mind.active)
      void mind.start().then((ok) => {
        if (mindState === 'wait') mindState = ok ? 'ready' : 'none';
        if (ok && filmWanted && !worldBuilt) buildWorld(kind === 'short');
      });
  }
  if (!mind && kind !== 'flat') {
    // no 3-D at all: the flat cut from the first frame (its own timeline, not the full one's)
    kind = 'flat';
    tl = L[kind];
    bootState.timeline = tl;
    bootState.kind = kind;
    el.classList.remove('full', 'short', 'still');
    el.classList.add(kind);
  }
  let mindIn = false;
  const takeMind = () => {
    if (!mind || mindIn) return;
    mindIn = true;
    bootState.mind = true;
    if (filmWanted) {
      // the film: the one context staged full-screen in the boot's layer; the world first, the orb into its viewport
      buildWorld(kind === 'short');
      film = new Film(el, kind === 'short' ? FILM_SHORT : FILM, mind, lit, worldBuilt === 'lean');
      bootState.film = true;
      bootState.scan = film.state;
      mind.bootBeginStaged(el, film.draw);
      return;
    }
    mind.bootBegin(el, side, side);
    const c = mind.canvas;
    Object.assign(c.style, { position: 'fixed', left: `${box.x}px`, top: `${box.y}px`, transformOrigin: '0 0', opacity: '0', zIndex: '1' });
  };

  // THE SOUND: under the film, B, the short score (his Sounds setting and the platform's cold-open rule honoured by score.ts, said nowhere);
  // A, the one tone, when he chose it; today's hum under the other worlds' picture
  resetScoreState();
  // (in his colour's key, with the hour's texture: boot.u7)
  const score: Score | null = filmWanted && settings.get().bootScore !== false ? startScore(scoreTuning(dd.theme ?? 'reactor', new Date().getHours())) : null;
  if (score?.on) bootState.sound = true;
  const stopSound = score ? () => score.stop() : hum(tl);
  let said = false;
  let heardThings = 0;
  let heardFeeds = 0;
  let heardChars = 0;
  let sphereCued = false;

  // ---- the stamp's facts and the feeds' answers: asked now (the guardian's own first look comes later than the boot)
  void loadGuardian();
  const facts = () => stampFacts('Home');
  /** The stamp's four segments at this moment (the fifth, LOOKING AT, is Home's own once it lands). */
  /* state: shell.boot empty */
  const stampNow = () => stampWords(settledFeeds(facts(), T >= tl.recognise)).slice(0, 4);
  let lines: { id: FeedId; parts: TruthPart[]; el: HTMLElement }[] = [];
  let linesFrom: GuardianInfo | null | undefined;
  const refreshLines = () => {
    /* state: shell.boot offline */
    const info = navigator.onLine === false ? null : guardian.get().info;
    if (info === linesFrom) return;
    linesFrom = info;
    feeds.replaceChildren();
    lines = feedLines(info).map((l) => {
      const p = truthLine(l.parts);
      p.style.opacity = '0';
      feeds.append(p);
      return { ...l, el: p };
    });
    bootState.feedLines = lines.map((l) => l.el.textContent?.replace(/\s+/g, ' ').trim() ?? '');
  };

  // ---- the clock: timeline ms (T) runs with real time, held while Mind loads (the ground keeps breathing) and before the
  // landing until the app is up; after a hold it runs faster so its own part still ends 2,880 ms after the first frame.
  // It never falls behind the wall clock: on a phone whose frames come late it skips ahead (shorter, never slower).
  let t0 = 0;
  let last = 0;
  let T = 0;
  let rate = 1;
  /** Where the pace was last set: from this moment (ms after the first frame) T runs from paceT at `rate`. */
  let paceE = 0;
  let paceT = 0;
  let decided = kind === 'flat';
  let gaps = 0;
  let gapSum = 0;
  let heroWait = 0;
  let quietHold = false;
  let done = false;
  let locked = false;
  let released = false;
  /** THE FILM's search (shot 8): its own box, and whether it has locked on tonight's thing. */
  const searchBox = lockBox(el);
  searchBox.classList.add('bsearch');
  let searchLocked = false;
  const marksLocked = () => {
    // the lock on the thing found: the box lands in the accent (the tone is the recognition's, once, on the orb)
    marksState.searches++;
  };
  /** The frame budget: gaps quicker than a 60 Hz frame (two say the display runs at 120), the last WINDOW frames' long
   *  ones (counted from the moment Mind takes the stage), the work each frame took. */
  let quick = 0;
  let recent: number[] = [];
  let workSum = 0;
  /** The lean cut: the phone could not keep up mid-flight, so the trails and the refraction go. */
  let lean = false;
  // a check may pick the version (software WebGL is too slow for the full one to choose itself); then the cut holds
  // steady too, unless the check asks to see it lean
  const forced = () => !!flags().__ghostyBootKind;
  const steady = () => forced() && !flags().__ghostyBootLean;
  const elapsed = (now: number) => now - t0;
  const enter = (p: Phase, at: number) => {
    if (bootState.marks[p] !== undefined) return;
    // a skip jumps to the landing: what it skipped never happened
    if (bootState.skipped && p !== 'land' && p !== 'done' && p !== 'ground') return;
    bootState.marks[p] = Math.round(at);
    bootState.phase = p;
    // the score's cues at the phases: the scan begins (the pad rises), the voice has the floor at the greeting
    if (p === 'floor') score?.scan();
    if (p === 'greeting') score?.voice();
    // the HUD waits out of sight while Mind flies; it slides in a beat after Mind lands (finish)
    if (p === 'land') document.body.classList.add('bootwait');
    if (p === 'greeting' && !said) {
      said = true;
      // skipped before it showed: he wants Home, not a greeting
      if (bootState.skipped) bootState.spoken = 'off';
      else sayGreeting(greet.textContent ?? '', !rebooting);
    }
  };
  // Home's hero, once its reactor canvas has taken this Mind (the first frame of Home's loop)
  const heroRect = (): DOMRect | null => {
    if (!mind || ui.get().tab !== 'core') return null;
    const a = mind.hero;
    const r = a?.isConnected ? a.getBoundingClientRect() : null;
    return r && r.width > 20 && r.height > 20 ? r : null;
  };
  const decide = (now: number) => {
    // where Mind stands decides the version; the late phone gets the short one, no 3-D gets the flat one
    const e = elapsed(now);
    // even the ground's breath stuttered (its frames came over a 60 Hz frame and a third apart, on average)
    const slow = gaps >= 4 && gapSum / gaps > 22;
    // (the film judges the phone by its own draw: the ground's stutter and a late first frame are the app starting underneath, which
    // every phone does on a cold open, not the phone failing the film; the wait for Mind is made up by the pace)
    const late = filmWanted ? e > FILM_FULL_BY : slow || e > FULL_BY || bootState.firstFrame > 2500;
    const tooLate = e > (filmWanted ? FILM_SHORT_BY : SHORT_BY);
    if (mindState === 'ready') {
      if (kind === 'full' && late && !forced()) kind = tooLate ? 'flat' : 'short';
      else if (kind === 'full' && mind) {
        // one draw to warm it up (its shaders), then the quicker of two timed: a phone that cannot draw MIND inside one of its frames
        // gets the short version (no gather, no push-in) rather than a cinematic that stutters (the film: inside a 60 Hz frame,
        // the rate Safari draws a page at)
        takeMind();
        mind.bootFrame(e / 1000, BOOT_DONE);
        let best = Infinity;
        for (let i = 0; i < 2; i++) {
          const t1 = performance.now();
          mind.bootFrame(e / 1000, BOOT_DONE);
          best = Math.min(best, performance.now() - t1);
        }
        bootState.drawMs = Math.round(best * 10) / 10;
        if (bootState.drawMs > (B.hz === 120 && !filmWanted ? 1000 / 120 : 1000 / 60) && !forced()) kind = 'short';
      }
    } else if (mindState === 'none' || (tooLate && !forced())) kind = 'flat';
    else return false;
    tl = L[kind];
    bootState.timeline = tl;
    bootState.kind = kind;
    el.classList.remove('full', 'short', 'still', 'flat');
    el.classList.add(kind);
    if (kind !== 'flat') takeMind();
    // (the short cut chosen after the film began: its shots move closer together)
    if (film && kind === 'short') film.setCut(FILM_SHORT);
    // whatever was waited, its own part still ends by 2,880 ms (the film's by 7,000)
    const from = needAt();
    const left = tl.end - from;
    rate = Math.max(1, left / Math.max(300, CAP - e - 1));
    if (startedShort) rate = Math.min(rate, QUICK_PACE);
    paceE = e;
    paceT = from;
    bootState.pace = Math.round(rate * 1000) / 1000;
    decided = true;
    // from here the budget judges the cinematic's own frames (not the ground's, which share the phone with the app starting)
    recent = [];
    return true;
  };

  /** The HUD (the ribbon, the tab bar, Home's cards) slides in, a beat after Mind has landed. */
  const hudIn = () => {
    document.body.classList.remove('bootwait');
    document.body.classList.add('bootland');
    bootState.hudAt = Math.round(elapsed(performance.now()));
    setTimeout(() => document.body.classList.remove('bootland'), 900);
  };
  const letGo = () => {
    if (released) return;
    released = true;
    release(lock);
  };
  const finish = () => {
    if (done) return;
    done = true;
    const now = performance.now();
    enter('done', elapsed(now));
    bootState.ended = Math.round(elapsed(now));
    stopSound?.();
    letGo();
    // how smoothly it ran, kept on this phone for Settings and "how did the opening run?" (boot.u9)
    try {
      const run: BootRun = { kind, film: !!film, ms: Math.max(0, bootState.ended - bootState.held), frames: bootState.frames, worst: bootState.worstGap, long: bootState.budget.long, at: Date.now() };
      localStorage.setItem(RUN_KEY, JSON.stringify(run));
    } catch {
      /* no storage: nothing kept */
    }
    if (mindIn && mind) {
      // (the film: the orb's viewport is where it flew to; Home's hero sits on the same place, so the landing is no cut)
      const q = film ? film.orbRect() : null;
      const flight = q ? { x: q.x, y: q.y, width: q.w, height: q.h } : mind.canvas.getBoundingClientRect();
      const hr = heroRect();
      bootState.landed = { flight: [flight.x, flight.y, flight.width, flight.height].map((v) => Math.round(v * 10) / 10), hero: hr ? [hr.x, hr.y, hr.width, hr.height].map((v) => Math.round(v * 10) / 10) : [] };
      mind.bootEnd();
      if (film) {
        film.end();
        // Home takes the stage (the phone's frame); where it does not (a desk's three-column Home), the canvas goes back over the hero
        if (!scanHooks.landed()) mind.unstage();
      }
      if (kind === 'still' && mind.canvas.isConnected && !film) mind.canvas.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
    }
    el.classList.add('out');
    setTimeout(() => {
      el.remove();
      document.body.classList.remove('booting');
    }, 40);
    if (document.body.classList.contains('bootwait')) setTimeout(hudIn, kind === 'still' ? 0 : BEAT);
    watchReturns();
  };

  // a tap skips it, at any moment: straight to the landing when the app is up (quickly), else to a quiet wait for it
  const skipIt = (e: Event) => {
    e.preventDefault();
    if (done || bootState.skipped) return;
    bootState.skipped = true;
    // no more words; if the app is not up yet, the orb turns quietly until it is
    quietHold = true;
    if (!said) bootState.spoken = 'off';
    said = true;
    stopSound?.();
    const now = performance.now();
    if (!decided) {
      // Mind still loading: it is not waited for (Home shows it when it is ready)
      if (mindState !== 'ready') mindState = 'none';
      decide(now);
    }
    if (T < tl.land) {
      T = tl.land - 1;
      rate = 2;
      paceE = elapsed(now);
      paceT = T;
    }
  };
  el.addEventListener('pointerdown', skipIt);
  // (as the best launches: a key skips it too, Escape, Enter or the space bar, and VoiceOver is told what this is and how to skip it;
  // never while the director's mode steps it by hand)
  const onKey = (e: KeyboardEvent) => {
    if (done) return removeEventListener('keydown', onKey);
    if (!flags().__ghostyBootManual && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) skipIt(e);
  };
  addEventListener('keydown', onKey);
  el.setAttribute('role', 'status');
  el.setAttribute('aria-label', 'Ghosty is starting. Tap anywhere to skip.');

  /** The recognition: the box snaps onto the orb's box with the tone, once (ui/machine.ts recognise: the lock's duration and
   *  curve from the tokens, the sound set's own tone on top of his sound setting). */
  const recogniseOrb = (push: number) => {
    if (locked) return;
    locked = true;
    const q = film?.orbRect();
    const ox = q ? q.x + q.w / 2 : cx;
    const oy = q ? q.y + q.h / 2 : cy;
    const R = kind === 'flat' ? 22 : q ? (ORB_FILL * q.w) / 2 + 5 : (0.9 * 0.74 * (side / 2)) / push + 5;
    Object.assign(orbBox.style, { left: `${ox - R}px`, top: `${oy - R}px`, width: `${2 * R}px`, height: `${2 * R}px` });
    name.style.top = `${oy + R + 14}px`;
    bootState.tone = sfxAllowed() ? ((document.documentElement.dataset.sound ?? 'tone') as 'tone' | 'click' | 'off') : 'quiet';
    // the chord stops dead with the tone; the wave follows it out
    score?.lock();
    void recognise(lock, orbBox, { name: 'Ghosty' });
  };

  const render = (now: number) => {
    const e = elapsed(now);
    // Reduce Motion and calm: nothing moves (with or without 3-D)
    const calm = kind === 'still' || (kind === 'flat' && calmWanted());
    const seg = (a: number, b: number) => clamp((T - a) / (b - a));
    const textsOut = (1 - seg(tl.land, tl.land + 150)) * (quietHold ? 0 : 1);
    // 1. the ground: the room's light breathing in where the orb will be (held while Mind loads: it keeps breathing)
    const held = !decided && T >= needAt() - 1;
    const roomOn = calm ? 1 : easeOut(seg(tl.ground, tl.floor)) * (held ? 0.88 + 0.12 * Math.sin(((e - needAt()) / 1600) * Math.PI * 2) : 1);
    room.style.opacity = roomOn.toFixed(3);
    // 2. the world's floor forming, drawn once per change (whole at once when nothing moves)
    const fk = calm ? 1 : seg(tl.floor, tl.floor + FLOOR_MS);
    const kc = calm ? 1 : world === 'map' ? seg(tl.floor + 160, tl.orb) : world === 'eye' ? seg(tl.floor + 200, tl.orb + 100) * (1 - seg(tl.orb + 200, tl.orb + 500)) : 0;
    const fkey = Math.round(fk * 400) + kc;
    if (fctx && floorHas && fkey !== floorAt) {
      floorAt = fkey;
      drawFloor(fctx, world, fk, vw, vh, dpr, floorTok, { x: cx, y: cy, r: 0.9 * 0.74 * (side / 2) + 5 }, { x1: gutter, x2: vw - gutter, y: topY + 24 }, kc);
      // Glass: the blur over the ground clearing as the floor's moment passes
      if (world === 'glass' || world === 'grown') {
        const blur = 18 * (1 - fk);
        glass.style.opacity = (1 - fk).toFixed(3);
        const f = blur > 0.2 ? `blur(${blur.toFixed(1)}px)` : '';
        glass.style.backdropFilter = f;
        glass.style.setProperty('-webkit-backdrop-filter', f);
      }
    }
    // (THE EYE: the wall resolving onto Home's own feeds, in the last second of the cut; the floor's grain is already there)
    eyeFilm?.frame(T, tl, { calm, manual: !!flags().__ghostyBootManual });
    // 3. the orb: his library's points gather and the sphere resolves (the full cut); whole, fading in (the rest)
    const G = tl.orb;
    const S = tl.orb + 560;
    const N = tl.feeds;
    // (the film: the camera stays where the descent puts it; the orb's push-in is the sphere's own, not the camera's)
    const push = kind === 'full' && !film ? 1 + 0.45 * (1 - easeInOut(seg(G, N))) : 1;
    // THE FILM's own frame: the descent, the things locking in as the front reaches them, the orb's viewport, the search's line of sight
    if (film) {
      const C = kind === 'short' ? FILM_SHORT : FILM;
      const nowLocked = T >= C.now + 320 && !bootState.skipped;
      film.frame(T, { calm, nowLocked, textsOut, lean });
      // one soft tick per thing found, each a semitone lower; the pad opens to the chord as the sphere resolves
      while (heardThings < film.state.locked.length) {
        heardThings++;
        score?.thing();
      }
      if (!sphereCued && T >= S + 250) {
        sphereCued = true;
        score?.sphere();
      }
      // the search (shot 8): the box checks the shelf, then the station, then locks on tonight's thing (this morning's Brief by the hour)
      const stops: [string, number][] = [['r-shelf', C.now], ['r-station', C.now + 160], [lit, C.now + 320]];
      let at: [string, number] | null = null;
      for (const st of stops) if (T >= st[1]) at = st;
      const searching = !!at && T < tl.land && !bootState.skipped;
      searchBox.hidden = !searching;
      if (searching && at) {
        const target = film.markEl(at[0]);
        const rr = target?.getBoundingClientRect();
        const hb = el.getBoundingClientRect();
        if (rr && rr.width) {
          const pad = 6;
          const landedNow = at[0] === lit;
          searchBox.dataset.state = landedNow ? 'attend' : 'watch';
          Object.assign(searchBox.style, { left: `${rr.left - hb.left - pad}px`, top: `${rr.top - hb.top - pad}px`, width: `${rr.width + 2 * pad}px`, height: `${rr.height + 2 * pad}px`, opacity: textsOut.toFixed(3) });
          if (landedNow && !searchLocked) {
            searchLocked = true;
            marksLocked();
          }
        }
      }
    }
    const orbState: MindState = T >= tl.greeting ? 'speaking' : T >= tl.recognise ? 'attending' : 'idle';
    // held at the landing for a Home that is late: how long this hold has lasted, and whether the line for a slow open is up
    const holding = T >= tl.land - 1 && T < tl.land + 1 && bootState.held > 0 && !bootState.skipped;
    const heldFor = bootState.held;
    if (holding) bootState.heldSweeps = Math.floor(heldFor / 1300);
    /* state: shell.boot loading */
    const holdOn = holding && heldFor >= HOLD_AFTER;
    if (holdOn) hold.textContent = holdWords({ online: navigator.onLine !== false, brain: ui.get().connected });
    hold.hidden = !holdOn;
    bootState.holdLine = holdOn ? hold.textContent ?? '' : bootState.holdLine;
    slow.hidden = !(holding && e > 6000);
    slow.style.opacity = slow.hidden ? '0' : '1';
    if (mindIn && mind) {
      let look: BootLook = BOOT_DONE;
      let fade = 1;
      if (kind === 'full') {
        look = {
          gather: seg(G, S),
          links: seg(G + 320, S + 50),
          // from the inside out: the haze, the meridians one after another, the latitudes and the tilted ring, the rim
          haze: easeOut(seg(S - 150, S + 250)),
          mer: seg(S + 80, S + 640),
          sphere: easeInOut(seg(S + 250, S + 650)),
          rim: easeInOut(seg(S + 420, S + 820)),
          scale: seg(S + 300, N),
          core: 1,
          turn: -0.35 * (1 - easeInOut(seg(S, N))),
          push,
          // the sweep: down through the gathering constellation once, crossing the equator half-way; while the film is held for a slow
          // Home it goes on passing, a pass every 1.3 s, so the last shot never stands still (the landing then needs no cut)
          sweep: holding ? (heldFor % 1300 < 1200 ? 1.1 - 2.2 * ((heldFor % 1300) / 1200) : NaN) : T >= G + 240 && T <= G + 540 ? 1.1 - 2.2 * seg(G + 240, G + 540) : NaN,
          trails: lean ? 0 : 1,
          refract: lean ? 0 : 1,
        };
        fade = seg(G, G + 120);
      } else fade = easeOut(seg(G, G + (kind === 'still' ? 300 : 450)));
      const c = mind.canvas;
      // 8. the flight: from the stage up into the hero's box (the same canvas; it is Home's from the landing on)
      const hr = T >= tl.land && !film ? heroRect() : null;
      if (hr && kind !== 'still') {
        const k = easeInOut(seg(tl.land, tl.end));
        const s = 1 + (hr.width / side - 1) * k;
        c.style.transform = `translate(${((hr.left - box.x) * k).toFixed(2)}px, ${((hr.top - box.y) * k).toFixed(2)}px) scale(${s.toFixed(4)})`;
      } else if (kind === 'still' && !film) fade *= 1 - seg(tl.land, tl.end);
      // (the film's canvas holds the world too: it never fades; the orb's own light is the film's to bring up)
      c.style.opacity = film ? '1' : fade.toFixed(3);
      // (stepped by hand, a check's photographs follow the cut's own clock, not the time the photographs take)
      mind.bootFrame((flags().__ghostyBootManual ? T : e) / 1000, look, orbState);
    }
    // no 3-D: the point of light where the 2-D fallback lives, breathing once, gone as Home takes over
    const dotOn = kind === 'flat' ? easeOut(seg(G, G + 300)) * (1 - seg(tl.land, tl.land + 150)) : 0;
    dot.style.opacity = dotOn.toFixed(3);
    dot.style.transform = `translate(-50%, -50%) scale(${(calm || kind !== 'flat' ? 1 : 1 + 0.25 * Math.sin(Math.PI * seg(G, G + 600))).toFixed(3)})`;
    // 4. the stamp line types itself: the day, the time, his saved place, the feeds' state (whole at once when nothing moves)
    const words = stampNow();
    const chars = calm ? Infinity : (T - tl.stamp) / TYPE_MS;
    if (T >= tl.stamp) {
      stampTyped(stamp, words, chars);
      bootState.stamp = words;
      // a faint typing tick under the cursor
      const n = Math.min(words.join(' · ').length, Math.floor(chars));
      while (heardChars < n) {
        heardChars++;
        score?.typing();
      }
    }
    stamp.style.opacity = ((T >= tl.stamp ? 1 : 0) * textsOut).toFixed(3);
    // 5. the feeds answer, one line each as they connect (only the ones that did), a lock apart; gone at the recognition
    refreshLines();
    const gone = T >= tl.recognise ? 1 - seg(tl.recognise, tl.recognise + LOCK) : 1;
    lines.forEach((l, i) => {
      const at = tl.feeds + i * LOCK;
      const on = calm ? (T >= tl.feeds ? 1 : 0) : seg(at, at + LOCK);
      l.el.style.opacity = (on * gone * textsOut).toFixed(3);
      // a soft tick per feed as its line lands, rising
      if (on > 0 && heardFeeds <= i) {
        heardFeeds = i + 1;
        score?.feed();
      }
    });
    feeds.hidden = gone <= 0;
    today.hidden = !bootState.todayLine || T < tl.greeting || bootState.skipped;
    today.style.opacity = (today.hidden ? 0 : seg(tl.greeting, tl.greeting + 200) * textsOut).toFixed(3);
    // (offline: its line from the feeds' moment, where the feeds would have answered, until the words go)
    off.hidden = !bootState.offlineLine || T < tl.feeds;
    off.style.opacity = (off.hidden ? 0 : textsOut).toFixed(3);
    // 6. the recognition: the box snaps onto the orb with the tone, G H O S T Y under it
    // (on a phone whose frame jumped past it to the landing, the recognition still happens on the cut's clock: the box is gone with the words)
    if (T >= tl.recognise && !bootState.skipped) recogniseOrb(push);
    lock.style.opacity = textsOut.toFixed(3);
    if (T >= tl.land && locked) letGo();
    name.style.opacity = ((calm ? seg(tl.recognise, tl.recognise + 200) : seg(tl.recognise + LOCK, tl.recognise + LOCK + 120)) * textsOut).toFixed(3);
    // 7. the greeting, his line, under the stamp
    const Gr = tl.greeting;
    greet.hidden = T < Gr;
    greet.style.opacity = ((calm ? seg(Gr, Gr + 200) : seg(Gr, Gr + 160)) * textsOut).toFixed(3);
    greet.style.transform = `translateY(${calm ? 0 : ((1 - easeOut(seg(Gr, Gr + 160))) * 6).toFixed(2)}px)`;
    // TAP TO SKIP, small, from the orb's first light to the recognition (not on the two still frames: the orb is whole there)
    const skipOn = calm ? (T >= G && T < tl.recognise ? 1 : 0) : seg(G + FIRST_LIGHT, G + FIRST_LIGHT + 200) * (1 - seg(tl.recognise - 120, tl.recognise));
    skip.style.opacity = (skipOn * (bootState.skipped ? 0 : 1)).toFixed(3);
    // 8. the ground goes and Home is there
    ground.style.opacity = (1 - easeInOut(seg(tl.land, tl.end))).toFixed(3);
  };

  /** Each frame against the budget: the gap since the last one (long: over 12 ms at 120 Hz, over 20 at 60). */
  const budget = (gap: number) => {
    if (B.gaps.length < 600) B.gaps.push(Math.round(gap * 10) / 10);
    if (gap < 11.5) quick++;
    const hz = B.gaps.length < 3 ? 0 : quick >= 2 ? 120 : 60;
    if (hz !== B.hz) {
      B.hz = hz;
      B.ms = hz === 120 ? LONG_120 : LONG_60;
      B.long = B.gaps.filter((g) => g > B.ms).length;
    } else if (gap > B.ms) B.long++;
    recent.push(gap > B.ms ? 1 : 0);
    if (recent.length > WINDOW) recent.shift();
  };
  /** Mid-flight, the full cut on a phone that cannot keep up: it leans (no trails or refraction) and quickens. */
  const strain = (now: number, gap: number) => {
    if (lean || kind !== 'full' || !decided || steady() || bootState.skipped || T < tl.orb || T >= tl.land) return;
    // (a phone whose frames come a tenth of a second apart shows its quarter in eight frames: it need not wait for twenty-four;
    // one stalled frame says it alone)
    // (the film: one stalled frame is the app starting underneath, not the phone failing the film: only the quarter counts)
    const n = recent.length;
    const quarter = n >= LEAN_MIN && recent.reduce((a, b) => a + b, 0) >= Math.min(LEAN_AT, Math.max(3, Math.ceil(n / 4)));
    if (!quarter && (filmWanted || gap < STALL)) return;
    lean = true;
    B.lean = bootState.phase as Phase;
    // the film keeps its length (his seven seconds): it sheds its extras and plays on at its pace; the storyboard's cut quickens
    if (filmWanted) return;
    paceE = elapsed(now);
    paceT = T;
    rate *= 1.5;
    bootState.pace = Math.round(rate * 1000) / 1000;
  };

  /** A frame that throws (a driver quirk, a shader that will not compile) must never keep the app behind the ground (it
   *  plays on every cold open now): the cinematic bails straight to Home, Mind handed to the hero if it can be. */
  const bail = (err: unknown) => {
    if (done) return;
    done = true;
    console.warn('boot cinematic stopped early:', err);
    try {
      stopSound?.();
    } catch {
      /* the sound is already gone */
    }
    try {
      letGo();
      if (mindIn && mind) mind.bootEnd();
    } catch {
      /* Home wakes its own Mind */
    }
    el.remove();
    document.body.classList.remove('booting', 'bootland', 'bootwait');
    bootState.phase = 'done';
    bootState.ended = Math.round(elapsed(performance.now()));
    watchReturns();
  };
  const step = (now: number) => {
    try {
      frame(now);
    } catch (err) {
      bail(err);
    }
  };
  const frame = (now: number) => {
    if (done || faulted) return;
    const w0 = performance.now();
    if (!t0) {
      t0 = now;
      last = now;
      started = performance.now();
      bootState.firstFrame = Math.round(performance.now());
      if (appIsReady && bootState.appReady < 0) bootState.appReady = 0;
      enter('ground', 0);
    }
    // a long gap is not made up in one jump (no stutter), but the end still comes on time (the rate after a hold)
    const gap = now - last;
    const dt = Math.min(250, gap);
    if (now > last) {
      bootState.worstGap = Math.max(bootState.worstGap, Math.round(now - last));
      budget(gap);
      if (T < tl.orb) {
        gaps++;
        gapSum += now - last;
      }
    }
    last = now;
    bootState.frames++;
    if (!flags().__ghostyBootManual) {
      strain(now, gap);
      advance(now, dt, gap);
    }
    render(now);
    const work = performance.now() - w0;
    workSum += work;
    B.work = Math.max(B.work, Math.round(work * 10) / 10);
    B.avg = Math.round((workSum / bootState.frames) * 10) / 10;
    if (T >= tl.end) return finish();
    requestAnimationFrame(step);
  };

  const advance = (now: number, dt: number, gap: number) => {
    const e = elapsed(now);
    let next = Math.max(T + dt * rate, paceT + (e - paceE) * rate);
    // the ground holds until Mind is drawing (or it is clear it won't be in time)
    if (!decided && next >= needAt() && !decide(now)) next = needAt() - 1;
    // the landing waits for the app underneath and for Home's hero; after 2,880 ms the words go and the orb turns quietly
    if (next >= tl.land && T < tl.land + 1) {
      const ready = appIsReady && (!mindIn || !!heroRect() || heroWait > 1500);
      if (!ready) {
        if (appIsReady) heroWait += gap;
        bootState.held += Math.round(gap);
        next = tl.land - 1;
        if (e > capOf(L)) quietHold = true;
        // the landing then runs from the moment the app is there
        paceE = e;
        paceT = next;
        if (!bootState.skipped) rate = 1;
      }
    }
    for (const p of PHASES) if (next >= tl[p]) enter(p, e);
    T = next;
  };

  // a test steps the cinematic by hand to photograph each moment (tests/boot.spec.mjs)
  if (flags().__ghostyBootManual)
    flags().__bootSeek = (ms: number) => {
      const now = performance.now();
      if (!t0) step(now);
      if (!decided) decide(now);
      T = Math.min(ms, tl.end);
      for (const p of PHASES) if (T >= tl[p]) enter(p, T);
      render(now);
      // the last photograph: it lands for real (Home's hero takes Mind; the HUD comes in a beat later)
      if (T >= tl.end) finish();
    };

  requestAnimationFrame(step);
}
