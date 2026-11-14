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
  // [ci] NEXT ci.u4
  { day: '2026-11-14', title: 'Screens rest when still', line: 'The quiet room behind the screens is drawn only as often as it moves, and the board games only when a piece or a highlight changes: a longer battery, a cooler phone, and no freeze just after a screen opens.' },
  // [ci] NEXT ci.u5
  { day: '2026-11-14', title: 'A soft tick when I hear you', line: 'When you finish speaking, a soft tick says I heard you, so you never wonder whether to say it again. It goes with the other sounds in Settings → VOICE & HOME.' },
  // [ci] NEXT ci.u1
  { day: '2026-11-14', title: 'I start talking sooner', line: 'On a long answer I start speaking as soon as its first sentence is written, while the rest is still coming, so you hear me about a third of a second sooner. The words are the same as before.' },
  // [security] NEXT ROUND, lane SECURITY: Settings → Security
  { day: '2026-11-14', title: 'Every lock on one screen', line: 'Settings → SECURITY: sign-in, your backup, your keys’ lock, faces, Telegram, previews, the demo and the public doors, each green, amber or red; every APPROVE and NOT NOW listed; and steps for the fixes in your Cloudflare account.' },
  // [sites] NEXT ROUND sites.c2 (with learn)
  { day: '2026-11-14', title: 'Your flash cards as an app', line: 'In LEARN, a course with cards has CARDS ON MY HOME SCREEN (or say “make my French verbs cards an app”): its cards become an app that revises offline, after your APPROVE.' },
  // [sites] NEXT ROUND sites.s2 (with u4)
  { day: '2026-11-14', title: 'QR codes and posters for your pages', line: 'Workshop → PUBLISHED PAGES → QR AND POSTER: a page’s QR code, and an A4 poster or A6 flyer with its title, code and address, made on your phone to save, share or print.' },
  // [sites] NEXT ROUND sites.s1
  { day: '2026-11-14', title: 'Add to calendar on event pages', line: 'An event or invitation site with a date now has buttons that put it in each guest’s own calendar: Google Calendar, or an iPhone or Outlook calendar file.' },
  // [sites] NEXT ROUND sites.u8
  { day: '2026-11-14', title: 'One home page for your sites', line: 'Workshop → PUBLISHED PAGES: tick ON MY HOME PAGE on the pages you want, then PUBLISH MY HOME PAGE: one link listing only those, live after your APPROVE.' },
  // [sites] NEXT ROUND sites.u6
  { day: '2026-11-14', title: 'Change an app after it is made', line: 'Ask “add stretching to my habits app” or “change my water goal to 10”: the app changes at the same link after your APPROVE, and what you saved on your phone stays.' },
  // [sites] NEXT ROUND sites.s4 (with s3)
  { day: '2026-11-14', title: 'Documents and decks at their own link', line: 'In DOCS or PRESENTATIONS, EXPORT → PUT IT ON MY SITES: a clean read-only page (a deck swipes like a book), live after your APPROVE in the chat.' },
  // [sites] NEXT ROUND sites.u2
  { day: '2026-11-14', title: 'Undo for your pages', line: 'Every page you publish keeps its last three versions. Workshop → PUBLISHED PAGES → UNDO LAST UPDATE, or “undo my last update to the party page”, puts the one before back at the same link.' },
  // [sites] NEXT ROUND sites.u12
  { day: '2026-11-14', title: 'Your own photos on your sites', line: 'Workshop → PHOTOS FOR YOUR SITES: add your own photos, made smaller on your phone with their location removed. Say “build a website for my café with my photos” and they replace the stock pictures.' },
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
