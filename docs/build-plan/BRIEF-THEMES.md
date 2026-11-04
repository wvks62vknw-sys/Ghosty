# BRIEF: THE THEMES — the ten rendered on 2 Nov, built in to the bar

The owner asked "what we thinking for the themes?" then "show me" (2 Nov). All twelve were rendered on the real app at
390 × 844 (Home and the Plan hub each) from a local patch and shown to him as one contact sheet. He has not struck any; the
default is all ten built, Paper (a daytime light look) not. Queue position: third after Friday's reset (STATUS section 4).

## What a theme is (state/theme.ts)
A theme is `{ label, tag, c (the accent), pale (its tint), glow (how strongly it lights the room; Reactor 1) }`. Every
instrument line, Mind's constellation, the boot's colour, the switcher and the chat's highlights take the accent; layout, type
and spacing never change. Reactor (`#64d2ff`, glow 1) and Graphite (`#9db7cc`, glow 0.55) exist; Graphite is the quiet one.
Mood colours (MOOD_LIGHT) still override a theme while a mood lasts.

## The ten, exactly as rendered (THEMES entries)
```
ember:   { label: 'Ember',   tag: 'Forge orange, warm and bright',         c: '#ff7a3d', pale: '#ffd2bd', glow: 1 },
gold:    { label: 'Gold',    tag: 'The armour’s gold, amber light',        c: '#ffc53d', pale: '#ffeab8', glow: 0.95 },
crimson: { label: 'Crimson', tag: 'Deep red, the suit at night',           c: '#ff3b4a', pale: '#ffc2c6', glow: 0.9 },
violet:  { label: 'Violet',  tag: 'Electric purple',                       c: '#b18cff', pale: '#e0d2ff', glow: 0.9 },
emerald: { label: 'Emerald', tag: 'Green glass, calm and alive',           c: '#3ddc97', pale: '#bff4dc', glow: 0.85 },
ice:     { label: 'Ice',     tag: 'Pale blue-white, a low cold glow',      c: '#cfe9ff', pale: '#f0f8ff', glow: 0.45 },
rose:    { label: 'Rose',    tag: 'Coral pink, soft',                      c: '#ff7eb6', pale: '#ffd0e4', glow: 0.8 },
lime:    { label: 'Lime',    tag: 'Acid green, the loud one',              c: '#c6ff3d', pale: '#eaffb8', glow: 1 },
sunset:  { label: 'Sunset',  tag: 'Orange into pink',                      c: '#ff7f6e', pale: '#ffd3c8', glow: 0.9 },
mono:    { label: 'Mono',    tag: 'White light, glow off, the quietest',   c: '#ffffff', pale: '#ffffff', glow: 0.25 },
```
What the sheet showed: Ember, Gold, Crimson, Violet, Emerald and Rose each read as their own room; Lime is loud on purpose;
Ice and Mono sit close to Graphite on the dark glass (the owner may keep one of the three); the markets line stays orange in
every theme by design (data, not decoration).

## To the bar (STANDARD.md)
1. **Readable in every theme.** A contrast check per theme in the routec spec (or a themes spec): body text, the instrument
   readings, the kicker text and the chat's text against the glass they sit on, at least 4.5:1 for text and 3:1 for the
   instrument lines; a theme whose accent fails as text gets a darker text variant of its accent (`text` token) rather than a
   weaker rule. Gold, Lime, Ice and Mono are the ones to watch.
2. **Settings → Theme** shows all twelve as live swatches with their tag lines, applies at once with the toast, keeps the pick on
   the phone (as now), and the boot plays in the picked colour on the next open.
3. **Mind and the 3-D engine** take the accent (as now); the deck pictures do not change (they are drawings).
4. **A catalogue entry per theme** (`theme:<key>`: the two exist); the deck's Settings card names the count.
5. **Paper** (a light daytime look: warm paper glass, dark text, sunrise-to-sunset switching with a manual override, Europe/London)
   is a separate brief and a day's work; built only if the owner asks.

## Tests
The themes spec (or routec's theme part): each theme applies its accent to the instruments and the boot colour; the contrast
numbers per theme are printed and held; the pick survives a reload; a screenshot of Home per theme into the shots folder.

## The owner's phone check
Settings → Theme: twelve swatches with their lines; tap Ember: everything turns at once, the toast says so; close Ghosty fully
and reopen: the boot is orange and the pick held; tap Gold, then Lime: every reading is still readable; tap Mono: the glow is
almost off.

## Size
An afternoon (3–4 h) for one builder, plus one checks run.
