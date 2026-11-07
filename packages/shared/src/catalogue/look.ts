/**
 * The catalogue's words for the design system (BRIEF-DESIGN-SYSTEM; his pick, W1 THE SCAN): Settings → THE LOOK, its five
 * sections, the ten themes that joined Reactor and Graphite (BRIEF-THEMES, exactly as rendered on 2 Nov), and the deck's
 * Settings lines (the count named; THE LOOK one tap from the deck). Joined into APP_WORDS in app.ts.
 * THEMES THAT MEAN SOMETHING (BRIEF-THEMES-2, 7 Nov): each ground, each world, each switch, the six directions (five presets,
 * and Orbit said as it is: a way round, not a look) and the look by words, with no model. Spread last into APP_WORDS, so the
 * THEME panel's words are said again here for the recipe.
 */
import type { CatValue } from '../catalogue';

const SINCE = '2026-11-06';

const theme = (label: string, name: string, line: string, more: string): CatValue => ({
  name, line, more, say: [`Switch to ${label}`], scene: ['talking'], cat: 'talk', since: SINCE,
});

/** When the recipe arrived (BRIEF-THEMES-2). */
const T2 = '2026-11-07';
const ground = (name: string, line: string, more: string, say: string): CatValue => ({
  name, line, more: `${more} Settings → Theme → Ground, or just say it.`, say: [say], scene: ['talking'], cat: 'talk', since: T2,
});
const world = (name: string, line: string, more: string, say: string): CatValue => ({
  name, line, more: `${more} Every room follows it fully with the shell. Settings → Theme → World.`, say: [say, `Switch to ${say.toLowerCase()}`], scene: ['talking'], cat: 'talk', since: T2,
});
const sw = (name: string, line: string, say: string): CatValue => ({
  name, line, more: 'One of my switches: it changes one thing you can see, and I keep it. Settings → Theme → Switches, or just say it.', say: [say], scene: ['talking'], cat: 'talk', since: T2,
});
const preset = (name: string, line: string, more: string, say: string): CatValue => ({
  name, line, more, say: [say], scene: ['talking'], cat: 'talk', since: T2,
});

export const LOOK_WORDS: Record<string, CatValue> = {
  'screen:look': {
    name: 'The look: how I draw',
    line: 'You can see how I draw everything: my colours, my type, the marks I see with and my eye, each one live.',
    more: 'Settings → The look. Every token with its job, the type at its own sizes, the marks I see with, working when you tap them, and my eye breathing. Then the presets and the dials: ground, colour, world and switches, each live.',
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
    name: 'My looks, contrast measured',
    line: 'You can pick a whole look here, or turn its dials: ground, colour, world and switches, each with its contrast measured.',
    more: 'The same presets and dials as Settings → Theme, applied at once and kept. Every ground holds the floor with every colour, measured on screen. Orbit is a way round, not a look: it comes with the shell.',
    say: ['Switch to Ember', 'Black background'], scene: ['talking'], cat: 'talk', since: SINCE,
  },
  'section:look:tokens': { same: 'panel:look:TOKENS' },
  'section:look:type': { same: 'panel:look:TYPE' },
  'section:look:marks': { same: 'panel:look:MARKS' },
  'section:look:mind': { same: 'panel:look:MIND' },
  'section:look:themes': { same: 'panel:look:THEMES' },
  // ---- the deck's Settings card: the count named, and THE LOOK a tap away
  'deck:settings:pick-his-look-seventeen-presets-and': { same: 'panel:settings:THEME' },
  'deck:settings:the-look-how-he-draws-everything': { same: 'screen:look' },
  // ---- THEMES THAT MEAN SOMETHING (BRIEF-THEMES-2): the THEME panel said again for the recipe
  'panel:settings:THEME': {
    name: 'Pick my look', line: 'You can pick a whole look from seventeen presets, or turn the dials: ground, colour, world and switches.',
    more: 'The presets first: the twelve colours, then the directions you saw along the way. Change any dial under a preset and I keep it as Custom. Every choice applies at once and I wake up in it.',
    say: ['Black background', 'Switch to Graphite'], scene: ['talking'], cat: 'talk', since: T2,
  },
  // ---- the grounds: what everything sits on
  'theme:ground:black': ground('Black, nothing lit but this', 'You can have me on black: nothing lit but what I’m looking at.', 'True black, the screen off between the points, as The Scan was first drawn. Every word still clears the floor on it.', 'Black background'),
  'theme:ground:graphite': ground('Graphite, my lit everyday ground', 'You can have me on Graphite: a lit room, never true black, my everyday.', 'The lit graphite I was built on, a step lighter than black so nothing feels like night. It is where every look starts.', 'Graphite background'),
  'theme:ground:slate': ground('Slate, my cold night room', 'You can have me on Slate: a cold blue-black, the night room.', 'A cooler dark than Graphite, with the bone ink a touch cooler to sit on it. The Map is drawn on it.', 'Slate background'),
  'theme:ground:warm': ground('Warm black for night reading', 'You can have me on Warm: a warm black and bone ink, for reading at night.', 'One Ink’s warm black, lifted so it is never true black, with its bone ink at four strengths.', 'Warm background'),
  'theme:ground:paper': ground('Paper, for reading in daylight', 'You can have me on Paper: bone paper and dark ink, for reading in daylight.', 'Every colour is drawn in a darker ink of itself so it reads on bone. It reaches the pages I draw in the new system first: THE LOOK, the Theme page and the reader; the other rooms stay on your night ground until the shell.', 'Paper'),
  // ---- the worlds: what each direction did
  'theme:world:scan': world('The Scan, a field of points', 'You can have me in The Scan: everything sampled as points, hairline edges, corner marks round what I watch.', 'Your pick from the second round of directions. The floor behind every screen is a field of points and my corners are square.', 'The scan'),
  'theme:world:map': world('The Map, a plotting grid', 'You can have me in The Map: a plotting grid with a crosshair every five squares, square pins round what I watch.', 'The second world of round two. The grid is behind every screen, plates have dashed edges and every corner is square.', 'The map'),
  'theme:world:eye': world('The Eye, grain and one box', 'You can have me in The Eye: grain everywhere but the one sharp box I’m looking at, my line of sight drawn to it.', 'The third world of round two. Plates carry less ink, so what I attend to stands out sharp.', 'The eye'),
  'theme:world:ink': world('One Ink, rules not boxes', 'You can have me in One Ink: one ink, rules instead of boxes, and a serif when I talk.', 'From the first round of directions. No floor pattern, no glow, square corners; what is lit is a line, never the words.', 'One ink'),
  'theme:world:glass': world('Glass, my look before', 'You can have me in Glass: blurred glass, rounded corners and the glow, the look I had before.', 'No floor pattern, frosted plates, round corners and my glow: the look before the design system, kept as a choice.', 'Glass'),
  // ---- the switches: each one visible thing
  'theme:switch:glow': sw('My glow, on or off', 'You can turn my glow off: no halo round my orb or the room, every light a clean line.', 'Glow off'),
  'theme:switch:floor': sw('The floor behind every screen', 'You can turn the floor off: no points, grid or grain behind the screens, just the ground.', 'Floor off'),
  'theme:switch:corners': sw('Sharp or round corners', 'You can have every corner sharp or every corner round, whatever the world draws.', 'Round corners'),
  'theme:switch:readings': sw('My readings in mono or not', 'You can have my readings and tags in mono, like an instrument, or in the phone’s own type.', 'Mono off'),
  'theme:switch:body': sw('Bigger text, never smaller', 'You can make my text bigger: 17, 19 or 21 points, never under, with readings growing too.', 'Bigger text'),
  'theme:switch:motion': sw('Calm or alive motion', 'You can make me calm: my eye holds still, lines appear whole, boxes land where they land.', 'Calm'),
  'theme:switch:sound': sw('A tone, a click or silence', 'You can choose what you hear when I recognise a thing: a tone, a click, or nothing.', 'The click sound'),
  'theme:switch:day': sw('Ground follows the day', 'You can have Paper by day and your night ground after sunset, from your home’s sun times.', 'Follow the day'),
  // ---- the six directions seen along the way: five presets, and Orbit as it is
  'theme:preset:scan': preset('The Scan, as rendered', 'You can have The Scan as you saw it: true black, the field of points, no glow.', 'The direction you picked, exactly as it was drawn: Black, Reactor, The Scan, glow off. Tap it in Settings → Theme, or just say it.', 'The scan'),
  'theme:preset:map': preset('The Map on Slate', 'You can have The Map: Slate, the plotting grid and square pins round what I watch.', 'Slate, Reactor and The Map. The grid sits behind every screen; plates have dashed edges and square corners.', 'The map'),
  'theme:preset:eye': preset('The Eye on black', 'You can have The Eye: black, grain, and the one sharp box I’m looking at.', 'Black, Reactor and The Eye. What I attend to is a sharp box with my line of sight; the rest is grain.', 'The eye'),
  'theme:preset:oneink': preset('One Ink, warm and gold', 'You can have One Ink: warm black, bone ink, one gold light, rules instead of boxes.', 'Warm, Gold for the one light, One Ink, and my readings in the phone’s own type. My words stay in the ink.', 'One ink'),
  'theme:preset:glass': preset('Glass, the look before', 'You can have Glass: the look before back, with its glass, round corners and the glow.', 'Graphite, Reactor and Glass: the look you had before the design system, kept as a preset.', 'Glass'),
  'theme:preset:orbit': {
    name: 'Orbit, a way round', line: 'You can’t pick Orbit as a look: it is a way round my screens, and it comes with the shell.',
    more: 'Orbit was the first round’s navigation, the areas standing on my orb’s orbit. It changes how you move, not how I draw, so it is not a preset. THE LOOK says so.',
    say: ['Show me the look'], scene: ['talking'], cat: 'talk', since: T2,
  },
  // ---- by words, with no model
  'phrase:look': {
    name: 'Change my look by words', line: 'You can say “black background”, “paper”, “the map”, “calm” or “bigger text” and my look changes at once, with no AI.',
    more: 'A ground, a world, a colour after “switch to”, or a switch by name: I apply it and say in a sentence what changed and what stayed. “Lighter” and “darker” step the ground.',
    say: ['Black background', 'Lighter', 'Follow the day', 'Bigger text'], scene: ['talking'], cat: 'talk',
    go: { ask: 'Black background', send: false }, since: T2,
  },
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
