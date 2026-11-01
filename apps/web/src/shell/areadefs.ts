/**
 * The tab bar's areas (each with its hub) and the Me sheet's rows and cards, as shell/areas.ts draws them. Pure, so the
 * ABILITIES catalogue reads the same lists (apps/web/src/abilities/sources.ts) and its test can too: an area, a row or a card
 * added here is listed there by itself, or the catalogue's test names it.
 */

export interface Area {
  id: string;
  title: string;
  /** One line under the hub's title, in Ghosty's voice ("I"): the plain line, for when the phone has no reading for
   *  the personal one (shell/hubcards.ts hubWords: his school stage, his next event, his city, his latest project). */
  sub: string;
  icon: string;
  /** Its tabs, in order; the first is where the tab bar goes when the area has no hub (ASK → the reactor). */
  tabs: string[];
  /** The area's own colour (its tab-bar glyph never uses it: tools are coloured by what they do, see TINT). */
  tint: string;
}

export const AREAS: Area[] = [
  { id: 'ask', title: 'Ask', sub: 'Talk to me, or get the day in one look.', icon: '<path d="M4.5 5.5h15a1.5 1.5 0 011.5 1.5v8.5a1.5 1.5 0 01-1.5 1.5H10l-4.5 3.5V17H4.5A1.5 1.5 0 013 15.5V7a1.5 1.5 0 011.5-1.5z"/><path d="M12 8.5v5M9.5 11h5"/>', tabs: ['core', 'brief'], tint: '#3fc3ff' },
  { id: 'see', title: 'See', sub: 'The world live, and the camera that understands it.', icon: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3.2"/>', tabs: ['eye', 'lens'], tint: '#0a84ff' },
  { id: 'make', title: 'Make', sub: 'Build, take apart and plan real things.', icon: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/><path d="M12.5 6.5l5 5"/>', tabs: ['studio', 'workshop', 'reverse', 'space', 'workbench'], tint: '#ff9f0a' },
  { id: 'learn', title: 'Learn', sub: 'Courses for you; games, school and a library for me.', icon: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.2c3 2.1 8 2.1 11 0v-4.2M21.5 9.5v5"/>', tabs: ['learn', 'gym', 'school', 'library'], tint: '#30d158' },
  { id: 'plan', title: 'Plan', sub: 'Your days, the markets, the world’s alerts and the radio.', icon: '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>', tabs: ['agenda', 'markets', 'threats', 'radio'], tint: '#ff375f' },
  { id: 'me', title: 'Me', sub: 'What I know, how I look and what I am linked to.', icon: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c1.2-4 4-6 7.5-6s6.3 2 7.5 6"/>', tabs: ['memory', 'settings', 'system', 'links', 'abilities'], tint: '#8e8e93' },
];

/** The Me sheet's rows, in their two groups: the screens (`group` 'screens') and the rest ('more'); `deck` opens Every screen. */
export const ME_ROWS: { id: string; label: string; sub: string; group: 'screens' | 'more' }[] = [
  { id: 'memory', label: 'Memory', sub: 'What I know about you', group: 'screens' },
  { id: 'settings', label: 'Settings', sub: 'Look, voice, home and about', group: 'screens' },
  { id: 'system', label: 'System', sub: 'Keys, models, storage and backups', group: 'screens' },
  { id: 'links', label: 'Links', sub: 'Email, Spotify and your phone', group: 'more' },
  // ABILITIES (OWNER-ISSUES 68): everything I can do, so he never has to remember it
  { id: 'abilities', label: 'Abilities', sub: 'Everything I can do for you', group: 'more' },
  { id: 'deck', label: 'Every screen', sub: 'All of Ghosty at once', group: 'more' },
];

/** The Me sheet's cards above its rows: the Status card and, for the guardian, WATCHING OVER YOU. */
export const ME_CARDS = [
  { id: 'status', label: 'Status' },
  { id: 'guardian', label: 'Watching over you' },
] as const;
