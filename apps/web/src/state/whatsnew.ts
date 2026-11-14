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
  // [ci] NEXT ci.u5
  { day: '2026-11-14', title: 'A soft tick when I hear you', line: 'When you finish speaking, a soft tick says I heard you, so you never wonder whether to say it again. It goes with the other sounds in Settings → VOICE & HOME.' },
  // [ci] NEXT ci.u1
  { day: '2026-11-14', title: 'I start talking sooner', line: 'On a long answer I start speaking as soon as its first sentence is written, while the rest is still coming, so you hear me about a third of a second sooner. The words are the same as before.' },
  // [voice lane] the next round: Talk to it your own way
  { day: '2026-11-14', title: 'Put it back, calm colours, your stations', line: '“Put it back” returns the look before; “calm colours”, “focus colours” or “lively colours” set a colour and look together; “call this my morning station”, then “put on my morning station”. When I’m not sure it’s you, I say why.' },
  { day: '2026-11-14', title: 'Private when others talk', line: 'When someone you introduced (or a voice I don’t know) asks about your money, health, messages or diary, I keep it to you; their other questions leave your private things out of my answer, and their turns stay out of your memory.' },
  { day: '2026-11-14', title: 'Every screen, your way', line: 'Every screen opens from everyday names (“bring up the game maker”, “open the translator”, “show me my portfolio”); amounts are understood exactly (“log half a litre”, “a quarter of an hour”); “how much paint for my lounge” opens Materials.' },
  { day: '2026-11-14', title: 'I learn your own words', line: 'Say something your own way, then tap the screen you meant: I offer to remember it, and next time it opens straight away. “My wordings” lists them, each with FORGET; nothing that sends or pays is ever learned.' },
  // [voice lane] the final round, unsaid until now
  { day: '2026-11-13', title: 'Say it your way, colours by name', line: '“Put some tunes on”, “log a pint” or “give us a shout in ten minutes” just work; “make it red” changes my colour, and every colour now has a plain name. Ask “do you know it’s me?” and I answer from what this phone heard.' },
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
