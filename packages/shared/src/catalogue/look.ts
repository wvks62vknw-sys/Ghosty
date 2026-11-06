/**
 * The catalogue's words for the design system (BRIEF-DESIGN-SYSTEM; his pick, W1 THE SCAN): Settings → THE LOOK, its five
 * sections, the ten themes that joined Reactor and Graphite (BRIEF-THEMES, exactly as rendered on 2 Nov), and the deck's
 * Settings lines (the count named; THE LOOK one tap from the deck). Joined into APP_WORDS in app.ts.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-06';

const theme = (label: string, name: string, line: string, more: string): CatValue => ({
  name, line, more, say: [`Switch to ${label}`], scene: ['talking'], cat: 'talk', since: SINCE,
});

export const LOOK_WORDS: Record<string, CatValue> = {
  'screen:look': {
    name: 'The look: how I draw',
    line: 'You can see how I draw everything: my colours, my type, the marks I see with and my eye, each one live.',
    more: 'Settings → The look. Every token with its job, the type at its own sizes, the Machine’s marks working when you tap them, my eye breathing, and the twelve themes with their contrast measured.',
    say: ['Show me the look', 'How do you draw things?'], scene: ['talking'], cat: 'talk', since: SINCE,
  },
  'panel:look:TOKENS': {
    name: 'Every token I draw with',
    line: 'You can read every token I draw with: its name, its value and its job, with the contrast of each ink measured.',
    more: 'The lit graphite I sit on, the bone ink at four strengths, the lines, the accent a theme swaps, the type, the grid, the corners and the motion. Read from the file itself, so it can never be out of date.',
    say: ['Show me your tokens'], scene: ['talking'], cat: 'talk', since: SINCE,
  },
  'panel:look:TYPE': {
    name: 'My type, at its sizes',
    line: 'You can see my type scale, each style set in its own size, with the floor I never go under.',
    more: 'SF Pro for words, SF Mono for my tags and readings, New York for a book. Body 17, a reading 15, a tag 13, nothing under 12; numbers line up.',
    say: ['Show me your type'], scene: ['talking'], cat: 'talk', since: SINCE,
  },
  'panel:look:MARKS': {
    name: 'The marks I see with',
    line: 'You can try the marks I see with: tap a reticle, watch a line type out, hear the box lock on with one tone.',
    more: 'The stamp line, the reticle, the tag, the truth line, the plate, the key, the line of sight, the typed-out line, the moment of recognition, the search and the index: each numbered, with its rule.',
    say: ['Show me your marks'], scene: ['talking'], cat: 'talk', since: SINCE,
  },
  'panel:look:MIND': {
    name: 'My eye, as I see',
    line: 'You can see my eye: a sphere of points with what I know inside it, my core in your colour, breathing as I listen.',
    more: 'Tap Listening and it breathes; with Reduce Motion on it holds still. It lives here for now: Home keeps today’s Mind until the new shell.',
    say: ['Show me your eye'], scene: ['talking'], cat: 'talk', since: SINCE,
  },
  'panel:look:THEMES': {
    name: 'Twelve colours, contrast measured',
    line: 'You can pick any of my twelve colours here too, each with its contrast measured on screen.',
    more: 'The same swatches as Settings → Theme: a tap applies it at once, everywhere, and I wake up in it next time.',
    say: ['Switch to Ember'], scene: ['talking'], cat: 'talk', since: SINCE,
  },
  'section:look:tokens': { same: 'panel:look:TOKENS' },
  'section:look:type': { same: 'panel:look:TYPE' },
  'section:look:marks': { same: 'panel:look:MARKS' },
  'section:look:mind': { same: 'panel:look:MIND' },
  'section:look:themes': { same: 'panel:look:THEMES' },
  // ---- the deck's Settings card: the count named, and THE LOOK a tap away
  'deck:settings:pick-his-colour-twelve-themes': { same: 'panel:settings:THEME' },
  'deck:settings:the-look-how-he-draws-everything': { same: 'screen:look' },
  // ---- the ten themes (BRIEF-THEMES' colours exactly; their tag lines are the swatches' own)
  'theme:ember': theme('Ember', 'Ember, my forge orange', 'You can have me in Ember: forge orange, warm and bright.', 'A theme changes my colour and nothing else. Tap it in Settings → THEME and it applies at once.'),
  'theme:gold': theme('Gold', 'Gold, the armour’s colour', 'You can have me in Gold: the armour’s gold, amber light.', 'Readable in every place I draw text, held by a test. Settings → THEME, or just ask.'),
  'theme:crimson': theme('Crimson', 'Crimson, my night red', 'You can have me in Crimson: deep red, the suit at night.', 'Where its red is too dark to read as words, I use a lighter red of my own. Settings → THEME, or just ask.'),
  'theme:violet': theme('Violet', 'Violet, my electric purple', 'You can have me in Violet: electric purple.', 'A theme changes my colour and nothing else: every screen keeps its layout. Settings → THEME, or just ask.'),
  'theme:emerald': theme('Emerald', 'Emerald, my green glass', 'You can have me in Emerald: green glass, calm and alive.', 'A theme changes my colour and nothing else: every screen keeps its layout. Settings → THEME, or just ask.'),
  'theme:ice': theme('Ice', 'Ice, my cold light', 'You can have me in Ice: pale blue-white, a low cold glow.', 'One of my quiet ones, close to Graphite and Mono. Settings → THEME, or just ask.'),
  'theme:rose': theme('Rose', 'Rose, my coral pink', 'You can have me in Rose: coral pink, soft.', 'A theme changes my colour and nothing else: every screen keeps its layout. Settings → THEME, or just ask.'),
  'theme:lime': theme('Lime', 'Lime, my loud green', 'You can have me in Lime: acid green, the loud one.', 'Loud on purpose, and still readable everywhere. Settings → THEME, or just ask.'),
  'theme:sunset': theme('Sunset', 'Sunset, my orange pink', 'You can have me in Sunset: orange into pink.', 'A theme changes my colour and nothing else: every screen keeps its layout. Settings → THEME, or just ask.'),
  'theme:mono': theme('Mono', 'Mono, my quietest light', 'You can have me in Mono: white light, glow off, the quietest.', 'My light at its lowest: nothing glows, every line in white. Settings → THEME, or just ask.'),
};
