// THE CUT: when each beat of the new boot starts, in ms from the first frame, and what is on screen at each shot's moment.
// Shared by frame.html (which draws a frame at any T) and render.mjs (which photographs the shots and writes the sheets), so
// the storyboard's captions and its pictures come from the same numbers. Run two writes these into shell/boot.ts's FULL
// timeline and re-cuts tests/boot.spec.mjs to them.

/** The full cut (the phone keeps up): a usable Home at END. The HUD's slide (a beat after the landing, 110 ms, then 300) ends after it. */
export const CUT = {
  ground: 0,      // (1) the ground, nothing else, one breath (the room's light breathing in where the orb will be)
  floor: 240,     // (2) the world's floor forms: The Scan's points sampled in from the top-left corner, over 400 ms
  orb: 560,       // (3) the orb forms from his library's points (today's gather, trails, the sweep and its refraction), on the floor
  stamp: 1240,    // (4) the stamp line types itself in mono: the day · the time · his saved place · CHECKING FEEDS
  feeds: 1700,    // (5) the feeds answer, one truth line each as they connect, one lock-length (160 ms) apart; the stamp becomes WATCHING 3 FEEDS
  recognise: 2180,// (6) the recognition: the reticle snaps onto the orb (160 ms, the lock curve) with the tone, G H O S T Y under it
  greeting: 2460, // (7) the greeting, his line, under the stamp where Home's first line lives; spoken now when the phone allows
  land: 2640,     // (8) the orb eases up into Home's hero (the same Mind), 240 ms
  end: 2880,      // a usable Home: the cinematic is over, taps reach Home; the HUD slides in from BEAT after
};
export const BEAT = 110;
export const HUD_MS = 300;
/** The lock's duration from the tokens (--g-dur-lock), and the typed-out line's pace at boot: three times the brain's 33 ms a character. */
export const LOCK = 160;
export const TYPE_MS = 10;

/** The stamp's facts at a boot (ui/machine.ts stampWords): the day and the time from the clock, the place from his saved home. */
export const NOW = { day: 'Sat 7 Nov', time: '21:08', place: 'Birmingham' };
/** What the stamp says of the feeds, before and after they answer, and offline (the real strings from stampWords). */
export const WATCH = { checking: 'Checking feeds', watching: 'Watching 3 feeds', offline: 'Offline, feeds paused' };
/** The feeds the guardian reads (packages/shared/src/guardian.ts FEED_NAMES), each answering with what it knows now. */
export const FEEDS = [
  { feed: 'Flood', source: 'Environment Agency', says: 'Nothing active' },
  { feed: 'Weather', source: 'Met Office', says: 'No warnings' },
  { feed: 'Crime', source: 'police.uk', says: 'Sep · 14 within a mile' },
];
export const GREETING = 'Good evening, Boss.';

/** The shots as photographed: the moment (ms), the beat, and what is true on screen then. */
export const SHOTS = [
  { n: 1, at: 160, name: 'The ground', what: 'The ground, nothing else, one breath: the room’s light breathing in where the orb will be.', truth: 'The ground is his recipe’s (data-ground on <html> before the first frame; Paper: the night ground). The light is theme.ts’s --room: the accent at .09 × the colour’s glow × the world’s glow, so GLOW off and One Ink show the bare ground.' },
  { n: 2, at: 420, name: 'The floor forms', what: 'The Scan’s field of points sampled in from the top-left corner, the sampling front a little brighter.', truth: 'The points are the world’s floor (--g-floor-mask, 16 px, r 1.1, at --g-floor-a .14 in the room’s points): what every screen stands on after the boot, drawn as it arrives.' },
  { n: 3, at: 900, name: 'The orb forms', what: 'His library’s points drift out of the point of light and gather into the constellation, each leaving a short trail; the sweep passes down through them and refracts at the equator; the camera pushes in.', truth: 'One node per 20 passages, lit when that share of its field is read (mind.ts plan(): today 4,186 passages, 209 nodes, 66 lit, 8 fields, from the numbers saved on this phone). The drift is today’s gather, kept. The sphere has not resolved yet.' },
  { n: 4, at: 1560, name: 'The stamp line', what: 'The sphere has resolved: the haze, the meridians one after another, the rim last. At the top the stamp line types itself in mono with a block cursor.', truth: 'SAT 7 NOV · 21:08 · BIRMINGHAM · CHECKING FEEDS: the clock, his saved home (never his live position) and the feeds’ real state (stampWords: Checking feeds while they are still being asked).' },
  { n: 5, at: 2060, name: 'The feeds answer', what: 'One truth line each as they connect, 160 ms apart; the stamp’s last segment turns to WATCHING 3 FEEDS when the third has answered.', truth: 'FLOOD · ENVIRONMENT AGENCY · NOTHING ACTIVE; WEATHER · MET OFFICE · NO WARNINGS; CRIME · POLICE.UK · SEP · 14 WITHIN A MILE (police.uk publishes a month’s count about two months behind; it is a count, never a forecast). Only the feeds that really answered get a line (guardian info.checked without info.failed); offline, none, and the stamp says OFFLINE, FEEDS PAUSED.' },
  { n: 6, at: 2440, name: 'The recognition', what: 'The reticle snaps onto the orb from 14 px wider, closing on it over the lock’s 160 ms in the accent, with one short tone; G H O S T Y under it. The feeds’ lines have gone: the stamp holds their truth.', truth: 'ui/machine.ts recognise(): the lock’s duration and curve from the tokens (--g-dur-lock, --g-ease-lock), the tone from assistant/sfx.ts on top of his sound setting (tone / click / off), scheduled on the audio clock.' },
  { n: 7, at: 2600, name: 'The greeting', what: 'His line under the stamp, where Home’s first line lives; the box and the name still on the orb.', truth: 'greetingLine(): the part of the day from the clock and the name from Settings (Boss when there is none). Spoken in his voice now if the phone allows sound, else on the first tap (iOS); once.' },
  { n: 8, at: 3060, name: 'Home', what: 'The orb eases up into Home’s hero (the same Mind, never a copy); the box and the name have gone; the HUD slides up a beat after it lands.', truth: 'The landing is on Home’s real hero box (boot.ts heroRect()); Home is usable at 2,880 ms. The stamp line stays as Home’s own, now LOOKING AT HOME; the HUD is the plan of the house and the ask line (the shell pass’s Home, drawn in the system’s marks).' },
];
/** The two extra frames: the world and the ground in it. */
export const EXTRA = [
  { key: 'map', world: 'map', ground: 'graphite', night: 'graphite', at: 520, name: 'The Map · the floor forms', what: 'The plotting grid drawn line by line (the verticals from the left, then the horizontals from the top), the small crosshairs every five squares, and the one crosshair finding centre where the orb will form.', truth: 'The Map’s floor from its tokens (--g-floor-mask: an 80 px tile, lines every 16 px at .4, a crosshair of 17 px at 1.5; --g-floor-a .3); the reticle later has the Map’s square pins (--g-ret-weight 5 px).' },
  { key: 'paper', world: 'scan', ground: 'paper', night: 'graphite', at: 2440, name: 'Paper · the recognition, on the night ground', what: 'The same recognition under Paper: the boot plays on his night ground (Graphite by default), in his colour, and Home lands on it too.', truth: 'BRIEF-THEMES-2: the boot lands on Home, a room still drawn light on dark until the shell pass, so under Paper it plays on the night ground (data-night) and the Paper row says so; bootState.recipe records {ground: paper, night: graphite, floor: the night canvas}. The orb is in the theme’s own accent (theme.ts writes --c whatever the ground).' },
];
/** The five states of the orb (mind.ts TARGET, plus attending for the recognition), each one visible change. */
export const STATES = [
  { key: 'idle', name: 'Idle', line: 'Turns once in about 70 s and breathes 6 %; four slow pulses on the lit links.' },
  { key: 'listening', name: 'Listening', line: 'Opens 8 %, the rim 1.6× brighter; a pale ring round it grows with your voice.' },
  { key: 'attending', name: 'Attending', line: 'Holds still (the turn to a third) and brightens its core; the reticle is on the thing it attends to.' },
  { key: 'thinking', name: 'Thinking', line: 'Thirty-six fast pulses run along the links and it turns twice as fast.' },
  { key: 'saying', name: 'Saying', line: 'Opens half way and brightens; ten pulses keep time with the words while it speaks.' },
];
