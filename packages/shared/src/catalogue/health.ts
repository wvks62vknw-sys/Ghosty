/**
 * The catalogue's words for BRIEF-RELIABILITY: SYSTEM → HEALTH (a mark on every ability, the crash records, what felt off, the
 * brain's own page), SETTINGS → PERMISSIONS, and THAT FELT OFF under a reply. Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-12';

export const HEALTH_WORDS: Record<string, CatValue> = {
  'panel:system:HEALTH': {
    name: 'What works and what does not',
    line: 'You can see every thing I can do marked WORKING, DEGRADED, NEEDS KEY or OFFLINE, with the one reason and the one fix.',
    more: 'The marks are worked out from what really happened: a failed run, an old feed, a missing key, no signal. Never written by hand. A mark clears itself when the next run goes right, and says back since when. RETRY runs the thing’s own check.',
    say: ['Is everything working?', 'What is not working?'],
    scene: ['behind', 'phone'],
    cat: 'do',
    since: SINCE,
  },
  'panel:system:CRASHES': {
    name: 'Anything that fell over',
    line: 'You can see anything that crashed this week: which screen, at what hour, in plain words, never a stack trace.',
    more: 'A screen that falls over shows RELOAD IT and HOME in its own frame, never a blank. A drawing that freezes says so after two seconds. Each record has THAT FELT OFF ready to send.',
    say: ['Did anything crash?'],
    scene: ['behind'],
    cat: 'do',
    since: SINCE,
  },
  'panel:system:FELT OFF': {
    name: 'The moments that felt off',
    line: 'You can see every moment you marked THAT FELT OFF, with the screen and your own words, and how many this week.',
    more: 'Each keeps the screen, your last three moves, the words on the screen, how my abilities were doing and the hour. Never a picture, the camera or a face. I read them on Sundays and fix the screen with the most.',
    say: ['What felt off this week?'],
    scene: ['behind'],
    cat: 'do',
    since: SINCE,
  },
  'panel:system:THE BRAIN': {
    name: 'How my brain is doing',
    line: 'You can read how my brain is: reachable, its store, each job on its clock with its last run, and which keys it has.',
    more: 'One sentence a line, every number with its unit and the time it is as of. The keys are named, never shown. The report card links here and does not repeat it.',
    say: ['How is your brain?', 'Did your jobs run?'],
    scene: ['behind'],
    cat: 'do',
    since: SINCE,
  },
  'section:system:health': { same: 'panel:system:HEALTH' },
  'panel:settings:PERMISSIONS': {
    name: 'What the phone lets me use',
    line: 'You can see the nine things the phone can be asked for, what I use each for, what I never do with it, and how to change it.',
    more: 'Camera, microphone, location, notifications, motion, the clipboard, kept storage, the Home Screen app and Wi-Fi downloads. Each says its state as the phone tells it, or what it was last time. Nothing here asks for anything.',
    say: ['What can you use on my phone?', 'Why did you need the camera?'],
    scene: ['phone', 'behind'],
    cat: 'talk',
    since: SINCE,
  },
  'chat:felt': {
    name: 'That felt off, tell me',
    line: 'You can tap THAT FELT OFF under any reply, and I keep the moment with its screen so I can fix it.',
    more: 'It counts as a thumbs down for that reply too. Press and hold the house line on any other screen. Add a few words of your own if you like; no picture, camera or face is ever kept.',
    say: ['(tap THAT FELT OFF under a reply)'],
    scene: ['talking', 'behind'],
    cat: 'talk',
    since: SINCE,
  },
};
