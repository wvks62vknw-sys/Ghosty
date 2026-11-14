/**
 * WHAT'S NEW (chunk A0): this week's merges in plain words, newest first, shown once per build at the top of
 * the Workshop (features/workshop) until the owner taps GOT IT. Which build was last seen is kept on this
 * device (`ghosty.whatsNew`, the build's commit). Add a line here with every merge worth telling him about.
 */
import { BUILD } from './build';

export interface NewThing {
  /** The day it was merged (YYYY-MM-DD). */
  day: string;
  title: string;
  /** One line on what changed for him. */
  line: string;
}

export const WHATS_NEW: NewThing[] = [
  // [moneynext] money and papers handled for you (NEXT-MONEY)
  { day: '2026-11-14', title: 'Safe to spend until payday', line: 'Life → MONEY: tell me your payday and the top of your month shows what is safe to spend until then, after the bills still due. Plain sums, not a forecast.' },
  { day: '2026-11-14', title: 'A money calendar, goals and your year', line: 'MONEY → CALENDAR puts every bill and payday on its day; BUDGETS keeps savings goals with what each needs a month; TRENDS adds your year in money, ready to print.' },
  { day: '2026-11-14', title: 'Shared bills and your sorting rules', line: 'MONEY → BILLS splits household bills and says who owes whom; YOUR MONTH lists the rules that sort your payments, to change or take away. Nothing is paid or sent.' },
  { day: '2026-11-14', title: 'Paid bills kept, documents kept', line: 'HOUSEHOLD → BILLS keeps the paid ones with what each supplier cost this year and last. WORK → DOCUMENT keeps every CV, letter and email I write, with older versions.' },
  // [consistency] the list stopped at 31 Oct while every November landing went unsaid (FINAL-CONSISTENCY)
  { day: '2026-11-13', title: 'Seven editors under EDITORS', line: 'Make → EDITORS: documents, spreadsheets, presentations, the workspace, a photo editor, a video editor and THE GAME STUDIO, each a pill of its own, each kept on your phone.' },
  { day: '2026-11-13', title: 'Photo and video, done properly', line: 'PHOTO opens RAW photos, cuts out a subject and removes an object; VIDEO steadies a clip, finds the best ones, cuts on the beat, reverses and ramps the speed. Every download waits for your tap on Wi-Fi.' },
  { day: '2026-11-13', title: 'Games of your own', line: 'THE GAME STUDIO makes a game from its own kit; it plays in the Arcade under MY GAMES. In the GYM you can play me at poker and WORDS too.' },
  { day: '2026-11-13', title: 'I can work on what you have open', line: 'Ask me about the deck, the video, the workspace or the game you have open: I read it, and any change I make is only proposed, marked for you to accept or reject.' },
  { day: '2026-11-13', title: 'Chat and Telegram in my own words', line: 'The chat, its states and the talk bar, and everything I say in Telegram, now in one plain voice.' },
  { day: '2026-11-13', title: 'THE WALL and THE EYE', line: 'THE WALL fits your words to the television; THE EYE draws the room as the wall, with the ask line at the biggest text.' },
  { day: '2026-11-13', title: 'Every screen says what is happening', line: 'Home, the packs, the Workshop, Settings, System, Links, the learning screens and the camera screens now say every wait and every problem in plain words, one line each.' },
  { day: '2026-11-13', title: 'Is it working?', line: 'Every ability has a mark for whether it works, the brain’s health is one tap away, and “that felt off” tells me to look.' },
  { day: '2026-11-13', title: 'The two looks', line: 'The orb now opens the Mind, and Grown up shows today with less on it. Both are whole screens of their own.' },
  { day: '2026-11-12', title: 'Training and the phone’s own parts', line: 'Training runs and reports in plain words; the phone’s camera, microphone, motion and battery are used where they help; the speaker is only ever you or people you introduce.' },
  { day: '2026-11-11', title: 'The map and God’s Eye', line: 'The map is a screen of its own, and the Eye shows every camera and what I can see in one view.' },
  { day: '2026-11-07', title: 'Looks that mean something', line: 'Settings → THEME: seven whole looks and twelve colours. Grounds, switches and presets are on THE LOOK → THEMES, and every one answers to your words (“paper”, “glow off”).' },
  { day: '2026-11-01', title: 'The Arcade and LIFE', line: 'The Arcade plays real classics, free, kept on your phone. LIFE holds eight everyday screens: money, body, kitchen, people, work, creative, outside and home.' },
  { day: '2026-10-31', title: 'Sources, weighed', line: 'Cited answers now say how far each source can be trusted (PRIMARY, CREDIBLE, PRESS, REFERENCE, LEAD) and label every claim: established fact, documented allegation, contested, rumour. Questions about genocide, war crimes, the courts or a cover-up are cited without asking, and the morning digest now reads the UN, the ICC, GOV.UK and the investigative newsrooms too.' },
  { day: '2026-10-31', title: 'The Workbench', line: 'Make → Workbench: first engineering estimates on your phone — a live wind tunnel (draw your own shape), beams, gears, engines, wings and cars, orbits, heat loss, sun and shadow, circuits. Every number says how it was worked out, and that it is a first estimate, never certified.' },
  { day: '2026-10-24', title: 'One look, your colour', line: 'The new look arrived. Settings → Theme changed its colour: Reactor, the cyan you know, or Graphite, a cooler and quieter steel (since 7 Nov: seven looks and twelve colours). Mind and every screen follow at once.' },
  { day: '2026-10-23', title: 'A new look', line: 'Calm glass, one light, and live instruments around the reactor: free AI left today, the library, school and the link to the brain.' },
  { day: '2026-10-23', title: 'His mind on Home', line: 'The centrepiece of Home is a 3-D hologram of what he knows and does, drawn from his real counts; the reactor stands in where a phone cannot draw it.' },
  { day: '2026-10-23', title: 'Ghosty goes to school', line: 'The SCHOOL tab (Learn): stages from nursery up, papers he sits on this phone, marked exactly, top grades unlock the next stage.' },
  { day: '2026-10-23', title: 'Home shows your day', line: 'Today’s diary, the roads near you and the Gym on the first screen; the Me sheet opens on a Status card with three dials.' },
  { day: '2026-10-23', title: 'Tidier lists and messages', line: 'Settings, System and Links never cut a word in half; at most two short messages pop up at once, tap one for all of it.' },
  { day: '2026-10-23', title: 'Gym: he carries on by himself', line: 'WATCH keeps playing round after round, TRAIN ALL trains every game in turn, KEEP AWAKE holds the screen on while he trains.' },
  { day: '2026-10-23', title: 'Study at scale', line: 'Self-study reads one field at a time, hundreds of topics a day, from a curriculum that grows on its own.' },
  { day: '2026-10-23', title: 'Sturdier weekly training', line: 'The offline brain’s weekly training on Kaggle checks the free GPU time first and recovers from a failed run.' },
];

const KEY = 'ghosty.whatsNew';

/** Whether this build's list is still to be shown here. */
export function whatsNewDue(): boolean {
  try {
    return localStorage.getItem(KEY) !== BUILD.sha;
  } catch {
    return true;
  }
}

/** Seen: not shown again until the next build. */
export function whatsNewSeen(): void {
  try {
    localStorage.setItem(KEY, BUILD.sha);
  } catch {
    /* storage unavailable: shown again next visit */
  }
}
