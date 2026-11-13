/**
 * COLOURS NAMED PLAINLY (FINAL ROUND, the voice lane; his words, 13 Nov: "Colours should be named like red, blue, green because
 * if i say to him red he doesn't change the theme to red because it's named like crimson"). Every colour the app offers has a
 * plain name, shown that way (Settings, THE LOOK, the slides' themes), and every fancy name and common synonym maps to it both
 * ways: "red", "crimson", "scarlet" and "ruby" are all the same colour, and the colour called Red answers to all of them.
 *
 * Pure: no DOM. themes.ts reads `colourWord` to hear a colour in his words; the pages read `PLAIN` to name one.
 */

/** The theme colours' keys (themes.ts COLOUR_KEYS: the keys never change, so a kept setting still reads). */
export type ThemeColour = 'reactor' | 'graphite' | 'ember' | 'gold' | 'crimson' | 'violet' | 'emerald' | 'ice' | 'rose' | 'lime' | 'sunset' | 'mono';

/** Each colour's plain name, as shown. */
export const PLAIN: Record<ThemeColour, string> = {
  reactor: 'Blue',
  graphite: 'Grey',
  ember: 'Orange',
  gold: 'Yellow',
  crimson: 'Red',
  violet: 'Purple',
  emerald: 'Green',
  ice: 'Light blue',
  rose: 'Pink',
  lime: 'Lime',
  sunset: 'Peach',
  mono: 'White',
};

/** The name each colour had before (still heard, and said beside the plain one where it helps). */
export const FANCY: Record<ThemeColour, string> = {
  reactor: 'Reactor', graphite: 'Graphite', ember: 'Ember', gold: 'Gold', crimson: 'Crimson', violet: 'Violet',
  emerald: 'Emerald', ice: 'Ice', rose: 'Rose', lime: 'Lime', sunset: 'Sunset', mono: 'Mono',
};

/**
 * Every word that means a colour, to the colour it means. Plain names, the old fancy names, and the common synonyms (British
 * and American spellings, shades a person says). Longest first when matched, so "light blue" is never read as "blue".
 */
export const COLOUR_SYNONYMS: Record<ThemeColour, string[]> = {
  reactor: ['blue', 'reactor', 'cyan', 'aqua', 'azure', 'sky blue', 'sky', 'cobalt', 'sapphire', 'navy', 'navy blue', 'royal blue', 'electric blue', 'bright blue', 'dark blue', 'deep blue', 'teal', 'turquoise', 'blue green', 'blue-green', 'ocean', 'indigo', 'denim', 'cerulean'],
  graphite: ['grey', 'gray', 'graphite', 'steel', 'silver', 'slate grey', 'slate gray', 'charcoal', 'gunmetal', 'pewter', 'dark grey', 'dark gray', 'blue grey', 'blue gray'],
  ember: ['orange', 'ember', 'amber orange', 'burnt orange', 'tangerine', 'rust', 'copper', 'bronze', 'pumpkin', 'bright orange'],
  gold: ['yellow', 'gold', 'golden', 'amber', 'mustard', 'honey', 'lemon', 'sunflower', 'butter', 'canary', 'banana', 'bright yellow'],
  crimson: ['red', 'crimson', 'scarlet', 'ruby', 'cherry', 'maroon', 'burgundy', 'wine', 'blood red', 'dark red', 'deep red', 'bright red', 'fire engine red', 'cardinal', 'vermilion', 'claret'],
  violet: ['purple', 'violet', 'lilac', 'lavender', 'mauve', 'plum', 'magenta', 'amethyst', 'grape', 'orchid', 'dark purple', 'light purple'],
  emerald: ['green', 'emerald', 'jade', 'mint', 'forest green', 'forest', 'dark green', 'bottle green', 'sea green', 'racing green', 'british racing green', 'kelly green', 'grass green', 'grass', 'sage', 'olive', 'pine'],
  ice: ['light blue', 'ice', 'icy', 'ice blue', 'pale blue', 'baby blue', 'powder blue', 'frost', 'frosty', 'arctic', 'glacier', 'pastel blue', 'blue white', 'blue-white'],
  rose: ['pink', 'rose', 'hot pink', 'pastel pink', 'baby pink', 'bubblegum', 'fuchsia', 'blush', 'light pink', 'bright pink', 'rose pink'],
  lime: ['lime', 'lime green', 'light green', 'bright green', 'neon green', 'acid green', 'chartreuse', 'neon', 'toxic green', 'pea green', 'apple green'],
  sunset: ['peach', 'sunset', 'coral', 'salmon', 'apricot', 'orange pink', 'pinky orange', 'terracotta'],
  mono: ['white', 'mono', 'monochrome', 'black and white', 'black white', 'snow', 'bone', 'no colour', 'no color', 'colourless', 'colorless', 'pure white'],
};

const ALL: [string, ThemeColour][] = (Object.entries(COLOUR_SYNONYMS) as [ThemeColour, string[]][])
  .flatMap(([k, ws]) => ws.map((w) => [w, k] as [string, ThemeColour]))
  .sort((a, b) => b[0].length - a[0].length);

/** A colour word (or a few) alone → its colour, or null. "Crimson" → crimson, "navy" → reactor, "light blue" → ice. */
export function colourWord(text: string): ThemeColour | null {
  const t = text.toLowerCase().replace(/[’']/g, "'").replace(/-/g, ' ').replace(/[.!?,]+/g, '').replace(/\s+/g, ' ').trim().replace(/^(?:a |an |the |some |more |nice |lovely |proper |bit of |bit more )+/, '').replace(/ (?:one|ish|y)$/, '').trim();
  for (const [w, k] of ALL) if (t === w.replace(/-/g, ' ')) return k;
  return null;
}

/** The words a theme colour answers to, for its key's aria label and the brain: "Red (crimson, scarlet, ruby…)". */
export const saysAlso = (k: ThemeColour, n = 3): string => COLOUR_SYNONYMS[k].filter((w) => w !== PLAIN[k].toLowerCase()).slice(0, n).join(', ');

/**
 * A word that names both a colour and something else on the screen ("white": the White light, or the white page of Paper;
 * "black": the black ground, there is no black light; "grey": the Grey light, or the Graphite ground). The look table asks one
 * short question with both as keys when the words do not say which.
 */
export const TWO_WAYS: Record<string, { colour: ThemeColour; ground: 'paper' | 'graphite' | 'black'; q: string; a: [string, string] }> = {
  white: { colour: 'mono', ground: 'paper', q: 'White light, or a white page?', a: ['WHITE LIGHT', 'WHITE PAGE'] },
  grey: { colour: 'graphite', ground: 'graphite', q: 'Grey light, or a grey background?', a: ['GREY LIGHT', 'GREY BACKGROUND'] },
};
