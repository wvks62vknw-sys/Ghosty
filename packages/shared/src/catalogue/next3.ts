/**
 * The catalogue's words for SYSTEM AND SETTINGS in the next round (NEXT-POLISH3): how ready Ghosty is with no signal (System →
 * OFFLINE READY, and "how ready are you offline?" in the chat). Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-14';

export const NEXT3_WORDS: Record<string, CatValue> = {
  'panel:system:OFFLINE READY': {
    name: 'How ready I am offline',
    line: 'You can see one number for how much of me works with no signal right now, and the one download that would help most, with its size.',
    more: 'Each piece is counted by how much of me it carries: the offline brain, the offline map, the Lens’s eyes and the namer, search by meaning, the voice model and the photo tools. GET IT IN SETTINGS opens the place to fetch it; a download only ever starts on your tap, on Wi-Fi, with its size said first. What this phone cannot run is left out of the count and said.',
    say: ['How ready are you offline?', 'What works with no signal?'],
    scene: ['phone', 'behind'],
    cat: 'know',
    since: SINCE,
  },
  'panel:settings:SAVER': {
    name: 'Hold big downloads for later',
    line: 'You can switch on Saver to hold big downloads and the background feeds until you switch it off.',
    more: 'While it is on, the offline packs, the offline brain and search by meaning do not start downloading, and the feeds stop refreshing on their own (a tap still reads one). It lists what it held back. An iPhone web app cannot read the battery or tell mobile data from Wi-Fi, so it is a switch you flip.',
    say: ['Turn on the saver', 'Pause big downloads'],
    scene: ['phone', 'behind'],
    cat: 'know',
    since: SINCE,
  },
  'phrase:saver': {
    name: 'Turn the saver on or off',
    line: 'You can say "turn on the saver" and I hold big downloads and the background feeds until you say "saver off".',
    more: 'Done on the phone with no AI. The switch is in Settings, Saver, with what it held back.',
    say: ['Turn on the saver', 'Pause big downloads', 'Saver off'],
    scene: ['phone', 'talking'],
    cat: 'talk',
    go: { ask: 'Turn on the saver' },
    since: SINCE,
  },
  'phrase:offlineready': {
    name: 'How ready are you offline',
    line: 'You can ask "how ready are you offline?" and I say how much of me works with no signal and what to download next.',
    more: 'Worked out on the phone with no AI, from what is already kept here. The OFFLINE READY panel opens on System with every piece and its size.',
    say: ['How ready are you offline?', 'What works offline?', 'Offline readiness'],
    scene: ['phone', 'talking'],
    cat: 'talk',
    go: { ask: 'How ready are you offline?' },
    since: SINCE,
  },
};
