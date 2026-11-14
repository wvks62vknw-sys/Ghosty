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
