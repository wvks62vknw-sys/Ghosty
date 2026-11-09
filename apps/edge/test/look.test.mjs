// THE DESIGN SYSTEM (BRIEF-DESIGN-SYSTEM; his pick, W1 THE SCAN, OWNER-ISSUES 139): apps/web/src/design/tokens.css and what is
// built from it, held to its rules. Every check fails on the code before the system (there was no tokens.css):
//  - every required token is present, and every token has its one-line job beside it;
//  - NOT SO DARK: the canvas is a lit graphite (never true black, between #0b0d10 and #111419 or a hair over), the plates a step up;
//  - the twelve themes are accent blocks (Reactor and Graphite as they were, BRIEF-THEMES' ten exactly as rendered), each swaps
//    the accent block and nothing else, and has every accent token; theme.ts names the same twelve with their tag lines;
//  - THE READABILITY FLOOR in every theme: every ink 4.5:1 on every surface, every line 3:1, the accent as text 4.5:1 (its text
//    variant where the accent fails) and as a line 3:1 — the numbers printed per theme for the report;
//  - the type: body 17, a reading 15, a tag and a caption 13, nothing under 12, every line height on the 4-point line, numerals
//    tabular; the spaces on the 8-point grid (the half step 4); square corners (2 on keys, 0 on marks), the orb the one circle;
//    three durations and two curves by name, Reduce Motion honoured; the 44 pt target;
//  - today's aliases keep their values (no existing screen changes in this PR), styles.css imports the tokens first;
//  - the Machine's marks (ui/machine.ts) are all there, and machine.ts, the swatches, THE LOOK and the system's CSS section name
//    no colour of their own.
// THEMES THAT MEAN SOMETHING (BRIEF-THEMES-2; his words, OWNER-ISSUES 141): a theme is a recipe — a ground, a colour, a world and
// the switches — and every check below fails on the code before it (there were no grounds, no worlds, no recipe; each was run
// against that code once):
//  - EVERY GROUND × EVERY COLOUR (sixty pairs) clears the floor on every surface: inks 4.5:1, lines 3:1, the accent as text 4.5:1
//    and as a line 3:1 (on Paper, the colour's own ink: the accent moved towards the ink until it clears 5:1) — printed as a table;
//  - every world defines every drawing token (the floor, the corners, the glow, the marks' and plates' drawing, the face I talk
//    in), The Scan is the :root's own; the switches keep the floor (body never under 17, every size on the 4-point line);
//  - every preset resolves to a full recipe (the twelve, then The Scan, The Map, The Eye, One Ink, Glass, as the brief names them);
//  - a bare colour key reads as the compatible recipe (Graphite + the colour + The Scan, the default switches);
//  - today's radius aliases (--card, --rad) and canvas (--bg) follow the world and the night ground;
//  - the sun times for his home give Paper by day and his night ground after, from the clock and his saved home, never GPS;
//  - the look by words with no model: "black background", "lighter", "paper", the directions, "calm", "bigger text", "follow
//    the day", and nothing that only looks like them.
//   node --test test/look.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

const at = (p) => new URL(p, import.meta.url).pathname;
const read = (p) => readFileSync(at(p), 'utf8');
await build({
  entryPoints: [at('../../web/src/design/tokens.ts'), at('../../web/src/design/contrast.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outdir: at('./.build/look'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const T = await import('./.build/look/tokens.mjs');
const K = await import('./.build/look/contrast.mjs');
// the recipe's pure model (packages/shared/src/themes.ts: grounds, worlds, switches, presets, the sun, the words); the code before
// the recipe has none, and every check that needs it says so
let TH = null;
try {
  await build({ entryPoints: [at('../../../packages/shared/src/themes.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile: at('./.build/look/themes.mjs'), logLevel: 'silent' });
  TH = await import('./.build/look/themes.mjs');
} catch {
  /* no recipe in this code */
}
const needRecipe = () => assert.ok(TH, 'packages/shared/src/themes.ts: there is no recipe (no grounds, worlds, switches or presets)');

const css = read('../../web/src/design/tokens.css');
const tokens = T.parseTokens(css);
const byName = Object.fromEntries(tokens.map((t) => [t.name, t]));
const themes = T.parseThemes(css);
const styles = read('../../web/styles.css');

/** BRIEF-THEMES, exactly as rendered on 2 Nov (and the two before them, as they were in state/theme.ts). */
const BRIEF = {
  reactor: { label: 'Reactor', tag: 'Reactor cyan, bright and alive', c: '#64d2ff', pale: '#bff0ff', glow: 1 },
  graphite: { label: 'Graphite', tag: 'Cool steel, a quieter light', c: '#9db7cc', pale: '#dbe6ef', glow: 0.55 },
  ember: { label: 'Ember', tag: 'Forge orange, warm and bright', c: '#ff7a3d', pale: '#ffd2bd', glow: 1 },
  gold: { label: 'Gold', tag: 'The armour’s gold, amber light', c: '#ffc53d', pale: '#ffeab8', glow: 0.95 },
  crimson: { label: 'Crimson', tag: 'Deep red, the suit at night', c: '#ff3b4a', pale: '#ffc2c6', glow: 0.9 },
  violet: { label: 'Violet', tag: 'Electric purple', c: '#b18cff', pale: '#e0d2ff', glow: 0.9 },
  emerald: { label: 'Emerald', tag: 'Green glass, calm and alive', c: '#3ddc97', pale: '#bff4dc', glow: 0.85 },
  ice: { label: 'Ice', tag: 'Pale blue-white, a low cold glow', c: '#cfe9ff', pale: '#f0f8ff', glow: 0.45 },
  rose: { label: 'Rose', tag: 'Coral pink, soft', c: '#ff7eb6', pale: '#ffd0e4', glow: 0.8 },
  lime: { label: 'Lime', tag: 'Acid green, the loud one', c: '#c6ff3d', pale: '#eaffb8', glow: 1 },
  sunset: { label: 'Sunset', tag: 'Orange into pink', c: '#ff7f6e', pale: '#ffd3c8', glow: 0.9 },
  mono: { label: 'Mono', tag: 'White light, glow off, the quietest', c: '#ffffff', pale: '#ffffff', glow: 0.25 },
};

const REQUIRED = [
  // colour: the surfaces, bone ink at four strengths, the lines, the accent block, meaning only
  '--g-canvas', '--g-canvas-rgb', '--g-plate', '--g-plate-strong', '--g-scrim',
  '--g-bone-rgb', '--g-ink-1', '--g-ink-2', '--g-ink-3', '--g-ink-4', '--g-line', '--g-line-faint',
  ...T.ACCENT_BLOCK, '--g-amber', '--g-amber-rgb', '--g-red', '--g-ok',
  // type: the phone's faces and the scale with its tracking, numerals tabular
  '--g-font-text', '--g-font-display', '--g-font-mono', '--g-font-serif',
  '--g-t-display', '--g-t-say', '--g-t-head', '--g-t-body', '--g-t-value', '--g-t-reading', '--g-t-tag', '--g-t-truth', '--g-t-key', '--g-t-caption', '--g-t-fine', '--g-t-page',
  '--g-tr-display', '--g-tr-say', '--g-tr-body', '--g-tr-mono', '--g-tr-tag', '--g-tr-truth', '--g-tr-key', '--g-num',
  // the grid, the gutter, the safe areas
  '--g-unit', '--g-s-half', '--g-s-1', '--g-s-2', '--g-s-3', '--g-s-4', '--g-s-6', '--g-gutter', '--g-safe-top', '--g-safe-bottom', '--g-safe-left', '--g-safe-right',
  // corners, lines, elevation, motion, icons, the target
  '--g-radius-key', '--g-radius-mark', '--g-radius-orb', '--g-stroke', '--g-hair', '--g-ret-arm', '--g-lift-plate', '--g-lift-front',
  '--g-dur-lock', '--g-dur-turn', '--g-dur-bring', '--g-ease-bring', '--g-ease-lock', '--g-icon', '--g-icon-small', '--g-icon-stroke', '--g-target',
];

const rgb = (v) => {
  const c = K.parseColour(v);
  assert.ok(c, `"${v}" is a plain colour`);
  return c;
};
const SURFACES = ['--g-canvas', '--g-plate', '--g-plate-strong'];
const surfaces = () => SURFACES.map((n) => rgb(byName[n].value));

test('every required token is in tokens.css, each with its one-line job, and nothing is defined twice', () => {
  assert.ok(tokens.length >= REQUIRED.length, `${tokens.length} tokens read`);
  const missing = REQUIRED.filter((n) => !byName[n]);
  assert.deepEqual(missing, [], `missing: ${missing.join(', ')}`);
  for (const t of tokens) {
    assert.ok(t.job.length >= 12, `${t.name} has no job beside it ("${t.job}")`);
    assert.ok(t.group, `${t.name} sits under no heading`);
    assert.ok(t.name.startsWith('--g-'), `${t.name}: every system token starts --g- (none can meet today's aliases)`);
  }
  assert.equal(new Set(tokens.map((t) => t.name)).size, tokens.length, 'a token defined twice');
  // the triplets are the colours they stand for
  for (const [hex, trip] of [['--g-canvas', '--g-canvas-rgb'], ['--g-accent', '--g-accent-rgb'], ['--g-accent-pale', '--g-accent-pale-rgb'], ['--g-amber', '--g-amber-rgb']]) {
    assert.deepEqual(rgb(byName[trip].value), rgb(byName[hex].value), `${trip} is ${hex} as a triplet`);
  }
  assert.deepEqual(rgb(byName['--g-bone-rgb'].value), rgb(byName['--g-ink-1'].value), 'ink 1 is bone at full strength');
});

test('NOT SO DARK: the canvas is a lit graphite, never true black, and the plates are a step up from it', () => {
  const [canvas, plate, strong] = surfaces();
  const L = K.luminance;
  assert.ok(canvas.some((v) => v > 0), 'the canvas is true black');
  // between #0b0d10 and #111419 (his "around"; the eye decides within a hair of it)
  assert.ok(L(canvas) >= L(rgb('#0b0d10')) && L(canvas) <= L(rgb('#141820')), `the canvas ${byName['--g-canvas'].value} is not the lit graphite (#0b0d10 to #111419)`);
  assert.ok(canvas[2] >= canvas[0], 'the canvas is a cool graphite (its blue at least its red)');
  assert.ok(L(plate) > L(canvas) && L(strong) > L(plate), 'the plates are not a step and two steps up');
  // a step you can see: at least 3 of CIE lightness (L*) each, canvas → plate → strong (a just-visible step is about 1)
  const Lstar = (c) => { const y = L(c); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };
  const steps = [Lstar(plate) - Lstar(canvas), Lstar(strong) - Lstar(plate)];
  console.log(`the lift: canvas L* ${Lstar(canvas).toFixed(1)} (today's #050607 is ${Lstar(rgb('#050607')).toFixed(1)}), plate +${steps[0].toFixed(1)}, strong +${steps[1].toFixed(1)}`);
  assert.ok(steps.every((d) => d >= 3), `the steps are too small to see (L* +${steps.map((d) => d.toFixed(1)).join(', +')})`);
  // today's canvas stays today's until the shell pass (no existing screen changes): the system's is the lift
  assert.ok(L(canvas) > L(rgb('#050607')) * 2, 'the canvas is no lighter than today\'s near-black');
});

test('the twelve themes: accent blocks that swap the accent and nothing else, exactly BRIEF-THEMES\' colours, named in theme.ts', () => {
  assert.deepEqual(themes.map((t) => t.key), Object.keys(BRIEF), 'the twelve, Reactor first, in BRIEF-THEMES\' order');
  for (const t of themes) {
    const b = BRIEF[t.key];
    assert.deepEqual(Object.keys(t.values).sort(), [...T.ACCENT_BLOCK].sort(), `${t.key}: swaps exactly the accent block`);
    assert.match(t.selector, new RegExp(`^:root\\[data-theme="${t.key}"\\], \\[data-accent="${t.key}"\\]$`), `${t.key}: the page's block and a swatch's`);
    assert.equal(t.values['--g-accent'].toLowerCase(), b.c, `${t.key}: the accent`);
    assert.equal(t.values['--g-accent-pale'].toLowerCase(), b.pale, `${t.key}: the pale tint`);
    assert.equal(Number(t.values['--g-accent-glow']), b.glow, `${t.key}: the glow`);
    assert.deepEqual(rgb(t.values['--g-accent-rgb']), rgb(b.c), `${t.key}: the accent's triplet`);
    assert.deepEqual(rgb(t.values['--g-accent-pale-rgb']), rgb(b.pale), `${t.key}: the pale tint's triplet`);
  }
  // the :root block carries Reactor's, so the first frame is Reactor
  for (const n of T.ACCENT_BLOCK) assert.equal(byName[n].value, themes[0].values[n], `:root's ${n} is Reactor's`);
  // theme.ts: the same twelve, their labels and tag lines; its fallback is Reactor's block (the moment before the stylesheet)
  const src = read('../../web/src/state/theme.ts');
  const listed = [...src.slice(src.indexOf('export const THEMES')).matchAll(/^ {2}(\w+): \{ label: '([^']+)', tag: '([^']+)' \},$/gm)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(listed, Object.entries(BRIEF).map(([k, b]) => [k, b.label, b.tag]), 'theme.ts THEMES: the twelve with their labels and tag lines');
  assert.match(src, /FALLBACK: Light = \{ c: '#64d2ff', pale: '#bff0ff', glow: 1 \}/, 'theme.ts FALLBACK is Reactor\'s block');
  assert.doesNotMatch(src.slice(src.indexOf('export const THEMES'), src.indexOf('export const DEFAULT_THEME')), /#[0-9a-f]{6}/i, 'theme.ts holds no theme colour: tokens.css is the one source');
  // the brain can switch to any of them by name
  const ui = read('../src/tools/ui.ts');
  const desc = /client\('set_theme', '([^']+)'/.exec(ui)?.[1] ?? '';
  for (const k of Object.keys(BRIEF)) assert.match(desc, new RegExp(`\\b${k}\\b`), `set_theme's description names ${k}`);
});

test('THE READABILITY FLOOR in every theme: inks 4.5:1 on every surface, lines 3:1, the accent as text 4.5:1 and as a line 3:1 (printed)', () => {
  const S = surfaces();
  const worst = (c) => Math.min(...S.map((s) => K.contrast(c, s)));
  const inks = ['--g-ink-1', '--g-ink-2', '--g-ink-3', '--g-ink-4', '--g-amber', '--g-red', '--g-ok'];
  const lines = ['--g-line', '--g-line-faint'];
  const rows = [];
  for (const n of inks) {
    const r = worst(rgb(byName[n].value));
    rows.push(`${n.replace('--g-', '')} ${K.ratioWords(r)}`);
    assert.ok(r >= K.FLOOR.text, `${n} is ${r.toFixed(2)}:1 on its weakest surface (the floor is ${K.FLOOR.text}:1)`);
  }
  for (const n of lines) {
    const r = worst(rgb(byName[n].value));
    rows.push(`${n.replace('--g-', '')} ${K.ratioWords(r)}`);
    assert.ok(r >= K.FLOOR.line, `${n} is ${r.toFixed(2)}:1 on its weakest surface (a line's floor is ${K.FLOOR.line}:1)`);
  }
  // the inks step down in order: ink 1 the strongest, ink 4 the weakest (four strengths, not four names for one)
  const L = inks.slice(0, 4).map((n) => K.luminance(rgb(byName[n].value)));
  assert.ok(L.every((v, i) => i === 0 || v < L[i - 1]), 'the four inks do not step down in strength');
  console.log(`the floor on the weakest surface (every theme): ${rows.join(' · ')}`);
  const per = [];
  for (const t of themes) {
    const accent = rgb(t.values['--g-accent']);
    const text = rgb(t.values['--g-accent-text']);
    const pale = rgb(t.values['--g-accent-pale']);
    const asText = worst(text);
    const asLine = worst(accent);
    per.push(`${t.key} text ${K.ratioWords(asText)} line ${K.ratioWords(asLine)}`);
    assert.ok(asText >= K.FLOOR.text, `${t.key}: its accent as text is ${asText.toFixed(2)}:1 (the floor is ${K.FLOOR.text}:1)`);
    assert.ok(asLine >= K.FLOOR.line, `${t.key}: its accent as a line is ${asLine.toFixed(2)}:1 (a line's floor is ${K.FLOOR.line}:1)`);
    // the text variant: the accent itself where it clears the system's margin (5:1) everywhere, else exactly the variant the
    // phone works out for a mood (contrast.ts textVariant), so the stylesheet and the moods agree
    assert.equal(K.toHex(text), K.toHex(K.textVariant(accent, pale, S)), `${t.key}: --g-accent-text is not its text variant`);
  }
  console.log(`each theme's accent on the weakest surface: ${per.join(' · ')}`);
  // Crimson is the one whose accent sits on the floor itself as text: it carries a lighter text variant
  const crimson = themes.find((t) => t.key === 'crimson');
  assert.notEqual(crimson.values['--g-accent-text'], crimson.values['--g-accent'], 'Crimson needs its text variant');
});

test('the type: body 17, a reading 15, a tag and a caption 13, nothing under 12; line heights on the 4-point line; numerals tabular', () => {
  const type = tokens.filter((t) => t.name.startsWith('--g-t-'));
  assert.ok(type.length >= 12, `${type.length} type styles`);
  const size = (n) => T.typeParts(byName[n].value)?.size;
  assert.equal(size('--g-t-body'), 17, 'the body is 17');
  assert.equal(size('--g-t-head'), 17, 'a row\'s title is 17');
  assert.equal(size('--g-t-reading'), 15, 'a reading is 15');
  for (const n of ['--g-t-tag', '--g-t-truth', '--g-t-key', '--g-t-caption']) assert.equal(size(n), 13, `${n} is 13`);
  for (const t of type) {
    const p = T.typeParts(t.value);
    assert.ok(p, `${t.name}: "${t.value}" is weight size/line family`);
    assert.ok(p.size >= 12, `${t.name} is ${p.size} pt (nothing under 12)`);
    assert.equal(p.line % 4, 0, `${t.name}: its line height ${p.line} is off the 4-point line`);
    assert.ok(p.line >= p.size * 1.15, `${t.name}: its line height ${p.line} is too tight for ${p.size}`);
    assert.ok([400, 500, 600, 700].includes(p.weight), `${t.name}: weight ${p.weight}`);
    assert.match(p.family, /^var\(--g-font-(text|display|mono|serif)\)$/, `${t.name}: one of the four faces`);
  }
  // the phone's own faces first, then their stand-ins
  assert.match(byName['--g-font-text'].value, /^-apple-system, BlinkMacSystemFont, 'SF Pro Text'/);
  assert.match(byName['--g-font-display'].value, /'SF Pro Display'/);
  assert.match(byName['--g-font-mono'].value, /^ui-monospace, 'SF Mono'.*Menlo/);
  assert.match(byName['--g-font-serif'].value, /^ui-serif, 'New York'/);
  assert.equal(byName['--g-num'].value, 'tabular-nums');
  for (const n of ['--g-t-value', '--g-t-reading', '--g-t-tag', '--g-t-truth']) assert.match(byName[n].value, /var\(--g-font-mono\)$/, `${n} is the Machine's mono`);
});

test('the grid, the corners, the motion, the targets: 8 points (the half step 4), square, three durations and two curves, 44 pt', () => {
  const px = (n) => {
    const m = /^(\d+(?:\.\d+)?)px$/.exec(byName[n].value);
    assert.ok(m, `${n}: "${byName[n].value}" is in px`);
    return Number(m[1]);
  };
  assert.equal(px('--g-unit'), 8);
  assert.equal(px('--g-s-half'), 4);
  for (const n of tokens.map((t) => t.name).filter((n) => /^--g-s-\d$/.test(n))) assert.equal(px(n) % 8, 0, `${n} is off the 8-point grid`);
  assert.equal(px('--g-gutter') % 8, 0, 'the gutter is off the grid');
  assert.match(css, /@media \(min-width: 428px\) \{ :root \{ --g-gutter: 24px; \} \}/, 'the gutter is 24 at his 440');
  for (const s of ['top', 'bottom', 'left', 'right']) assert.equal(byName[`--g-safe-${s}`].value, `env(safe-area-inset-${s}, 0px)`, `the safe area ${s}`);
  assert.equal(px('--g-radius-key'), 2, 'a key is square, softened by a hair');
  assert.equal(byName['--g-radius-mark'].value, '0', 'a mark is drawn square');
  assert.equal(byName['--g-radius-orb'].value, '50%', 'the orb is the one circle');
  assert.equal(px('--g-target'), 44, 'the least a thing he can press may be');
  assert.ok(px('--g-icon') >= 16 && px('--g-icon-small') >= 12, 'icon sizes');
  const ms = (n) => Number(/^(\d+)ms$/.exec(byName[n].value)?.[1]);
  assert.ok(ms('--g-dur-lock') < ms('--g-dur-turn') && ms('--g-dur-turn') < ms('--g-dur-bring'), 'three durations, short to long');
  for (const n of ['--g-ease-bring', '--g-ease-lock']) assert.match(byName[n].value, /^cubic-bezier\(/, `${n} is a named curve`);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{ :root \{ --g-dur-lock: 0ms; --g-dur-turn: 0ms; --g-dur-bring: 0ms; \} \}/, 'Reduce Motion takes the durations to nothing');
});

test('today\'s aliases keep their values underneath (the world and the night ground redefine --card, --rad and --bg on top: THEMES-2), and styles.css imports the tokens first', () => {
  assert.match(styles, /^@import url\('src\/design\/tokens\.css'\);/, 'styles.css starts with the import of the tokens');
  const build = read('../../web/build.mjs');
  assert.match(build, /TOKENS_IMPORT/, 'the build puts the tokens in place of the import (one stylesheet)');
  // the values today's screens are drawn with (route C), unchanged in this PR: the shell pass moves them onto the system
  for (const v of [
    '--c: #64d2ff; --cr: 100,210,255; --c2: #bff0ff;',
    '--a: #ffb340; --ar: 255,179,64; --r: #ff6961;',
    '--bg: #050607; --bgr: 5,6,7;',
    "--sf: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Inter', system-ui, 'Helvetica Neue', sans-serif;",
    '--ink: #f4f6f8; --ink2: rgba(235,240,245,.64); --ink3: rgba(235,240,245,.4); --ink4: rgba(235,240,245,.2);',
    '--hair: rgba(255,255,255,.08); --hair2: rgba(255,255,255,.13);',
    '--t1: 700 34px/41px var(--sfd); --t2: 600 17px/22px var(--sf); --t3: 400 17px/24px var(--sf); --t4: 400 15px/20px var(--sf); --t5: 400 13px/18px var(--sf);',
    '--rcglass: linear-gradient(180deg, rgba(255,255,255,.072), rgba(255,255,255,.034));',
    'html, html body { background: #050607; }',
  ]) assert.ok(styles.includes(v), `today's alias changed: ${v}`);
});

/** A colour written as a colour: a hex, rgb()/hsl() with numbers in it, or a colour's name. A token's triplet at an alpha
 *  (`rgba(var(--g-bone-rgb), .14)`) is the token's colour, not one of its own. */
const RAW = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(\s*[\d.]|\b(?:white|black|red|green|blue|cyan|orange|yellow|grey|gray|purple|pink|silver|gold)\b(?=\s*[;,)])/i;
const rawIn = (text) => text.split('\n').map((l, i) => [i + 1, l.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/, '')]).filter(([, l]) => RAW.test(l)).map(([n, l]) => `${n}: ${l.trim().slice(0, 120)}`);

test('the Machine\'s marks are all there, and machine.ts, the swatches, THE LOOK and the system\'s CSS name no colour of their own', () => {
  const machine = read('../../web/src/ui/machine.ts');
  const marks = [...machine.matchAll(/\{ id: '([a-z]+)', name: '([^']+)', rule: '/g)].map((m) => m[1]);
  for (const id of ['stamp', 'reticle', 'tag', 'truth', 'plate', 'key', 'sight', 'typed', 'recognise']) assert.ok(marks.includes(id), `the mark ${id} (BRIEF-DESIGN-SYSTEM 2)`);
  for (const fn of ['stampLine', 'reticle', 'tag', 'truthLine', 'plate', 'key', 'lineOfSight', 'typedLine', 'recognise', 'search', 'index']) assert.match(machine, new RegExp(`export (?:async )?function ${fn}\\(`), `ui/machine.ts exports ${fn}`);
  // the moment of recognition plays the sound set's own tone, through his setting (assistant/sfx.ts)
  assert.match(machine, /sfx\('lock'\)/, 'recognise() plays the lock tone');
  assert.match(read('../../web/src/assistant/sfx.ts'), /kind === 'lock'/, 'the sound set has the lock tone');
  for (const [file, text] of [
    ['ui/machine.ts', machine],
    ['ui/swatches.ts', read('../../web/src/ui/swatches.ts')],
    ['features/look/index.ts', read('../../web/src/features/look/index.ts')],
    // (the dials of THEMES-2 draw from the tokens they stand on, as the swatches do)
    ...(TH ? [['ui/dials.ts', read('../../web/src/ui/dials.ts')]] : []),
  ]) assert.deepEqual(rawIn(text), [], `${file} names a colour of its own`);
  const from = styles.indexOf('THE SYSTEM (BRIEF-DESIGN-SYSTEM');
  const to = styles.indexOf('/* ==== end THE SYSTEM ==== */');
  assert.ok(from > 0 && to > from, 'styles.css has THE SYSTEM\'s section, start and end marked');
  const section = styles.slice(from, to);
  assert.ok(section.length > 4000, 'the section holds the marks, the swatches and THE LOOK');
  assert.deepEqual(rawIn(section), [], 'THE SYSTEM\'s CSS names a colour of its own');
  for (const cls of ['.g-tag', '.g-truth', '.g-stamp', '.g-plate', '.g-key', '.g-ret', '.g-ret-frame', '.g-lock', '.g-sight', '.g-typed', '.g-cursor', '.g-eye', '.g-orb', '.g-index', 'button.swatch']) assert.ok(section.includes(cls), `the section draws ${cls}`);
  // the old swatches' own colours are gone with them (Settings → Theme is the system's now)
  assert.doesNotMatch(styles, /html #pg-settings \.swatch\b/, 'the old swatch rules are still in styles.css');
});

test('THE LOOK has its five sections in the order the brief names, and its top line in his voice', () => {
  const src = read('../../web/src/features/look/index.ts');
  const secs = /sections\(root, 'look', \[([\s\S]*?)\]\)/.exec(src)?.[1] ?? '';
  assert.deepEqual([...secs.matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]), ['tokens', 'type', 'marks', 'mind', 'themes']);
  for (const p of ['TOKENS', 'TYPE', 'MARKS', 'MIND', 'THEMES']) assert.match(src, new RegExp(`panel\\('${p}'`), `the ${p} panel`);
  assert.ok(src.includes('This is how I draw everything from here. Tap a mark to see it work.'), 'his line at the top');
  assert.ok(src.includes("import tokensCss from '../../design/tokens.css'"), 'the tokens are read from the file itself');
  assert.match(read('../../web/src/features/index.ts'), /settingsTab, lookTab,/, 'THE LOOK is a tab, after Settings');
  assert.match(read('../../web/src/features/settings/index.ts'), /goRow\('THE LOOK', 'look'/, 'Settings has the row that opens it');
});

// BRIEF-LIBRARY-READER, the 7 Nov addendum: the reader is drawn in the system, so the look test's floor applies to it too: its
// code and the Shelf's name no colour of their own, its CSS is THE READER inside THE SYSTEM's section (tokens only), and its
// text starts at 17 pt with nothing under 12.
test('THE READER is drawn from the tokens alone: no colour of its own in its code or its CSS, body text 17 pt, nothing under 12', () => {
  for (const f of ['features/library/reader.ts', 'features/reader/index.ts', 'library/book.ts', 'library/listen.ts', 'library/place.ts', 'library/covers.ts']) assert.deepEqual(rawIn(read(`../../web/src/${f}`)), [], `${f} names a colour of its own`);
  const from = styles.indexOf('THE SYSTEM (BRIEF-DESIGN-SYSTEM');
  const to = styles.indexOf('/* ==== end THE SYSTEM ==== */');
  const reader = styles.indexOf('/* ---- THE READER');
  assert.ok(reader > from && reader < to, 'THE READER is a part of THE SYSTEM\'s section');
  for (const cls of ['#pg-reader .grd-page', '.grd-litframe', '.grd-flow', '.grd-cover', '.grd-bar', '#pg-library .pn.shelf .rw.link.bookrow']) assert.ok(styles.slice(reader, to).includes(cls), `THE READER draws ${cls}`);
  const place = read('../../web/src/library/place.ts');
  assert.match(place, /SIZES = \[12, 14, 15, 17, 19, 21, 24, 28\]/, 'the sizes: never under 12');
  assert.match(place, /DEFAULT_SIZE = 17\b/, 'the book\'s words start at 17 pt');
  assert.match(styles.slice(reader, to), /--rd-size: 17px/, 'and the page draws them at 17 until he picks');
});

// ================================================================ THEMES THAT MEAN SOMETHING (BRIEF-THEMES-2)

const GROUND_ORDER = ['black', 'graphite', 'slate', 'warm', 'paper'];
const WORLD_ORDER = ['scan', 'map', 'eye', 'ink', 'glass'];
const blocks = (attr) => {
  assert.equal(typeof T.parseAttrBlocks, 'function', 'tokens.ts reads no recipe blocks: there are no grounds, worlds or switches');
  return T.parseAttrBlocks(css, attr);
};
const Lstar = (c) => { const y = K.luminance(c); return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y; };

test('THEMES-2: every ground × every colour clears the floor on every surface — sixty pairs, the weakest text and line printed', () => {
  const grounds = blocks('ground');
  assert.deepEqual(grounds.map((g) => g.key), GROUND_ORDER, 'the five grounds, darkest first, Paper last');
  const table = [];
  let pairs = 0;
  for (const g of grounds) {
    assert.deepEqual(T.GROUND_BLOCK.filter((n) => g.values[n] == null), [], `${g.key}: a surface token missing from its block`);
    const v = (n) => g.values[n];
    const S = SURFACES.map((n) => rgb(v(n)));
    const worst = (c) => Math.min(...S.map((s) => K.contrast(c, s)));
    const inks = ['--g-ink-1', '--g-ink-2', '--g-ink-3', '--g-ink-4', '--g-amber', '--g-red', '--g-ok'].map((n) => [n, worst(rgb(v(n)))]);
    for (const [n, r] of inks) assert.ok(r >= K.FLOOR.text, `${g.key}: ${n} is ${r.toFixed(2)}:1 on its weakest surface (the floor is 4.5:1)`);
    const lines = ['--g-line', '--g-line-faint'].map((n) => [n, worst(rgb(v(n)))]);
    for (const [n, r] of lines) assert.ok(r >= K.FLOOR.line, `${g.key}: ${n} is ${r.toFixed(2)}:1 on its weakest surface (a line's floor is 3:1)`);
    // four strengths, strongest first (on Paper, the darkest first)
    const contrastOf = ['--g-ink-1', '--g-ink-2', '--g-ink-3', '--g-ink-4'].map((n) => worst(rgb(v(n))));
    assert.ok(contrastOf.every((x, i) => i === 0 || x < contrastOf[i - 1]), `${g.key}: the four inks do not step down in strength`);
    // the plates a step you can see from the canvas: up on a dark ground, DOWN on Paper (at least 3 of L* each)
    const [c, p, st] = S.map(Lstar);
    const up = g.key !== 'paper';
    assert.ok(up ? p - c >= 3 && st - p >= 3 : c - p >= 3 && p - st >= 3, `${g.key}: the plates are not a step ${up ? 'up' : 'down'} (L* ${c.toFixed(1)}, ${p.toFixed(1)}, ${st.toFixed(1)})`);
    // every colour on it: as text and as a line (on Paper, the colour's own ink)
    const cells = [];
    for (const t of themes) {
      const light = g.key === 'paper';
      const text = rgb(light ? t.values['--g-accent-ink'] : t.values['--g-accent-text']);
      const line = rgb(light ? t.values['--g-accent-ink'] : t.values['--g-accent']);
      const asText = worst(text);
      const asLine = worst(line);
      assert.ok(asText >= K.FLOOR.text, `${g.key} × ${t.key}: the accent as text is ${asText.toFixed(2)}:1 (the floor is 4.5:1)`);
      assert.ok(asLine >= K.FLOOR.line, `${g.key} × ${t.key}: the accent as a line is ${asLine.toFixed(2)}:1 (the floor is 3:1)`);
      pairs++;
      cells.push(`${t.key} ${K.ratioWords(asText)}/${K.ratioWords(asLine)}`);
    }
    const weakInk = inks.reduce((a, b) => (b[1] < a[1] ? b : a));
    const weakLine = lines.reduce((a, b) => (b[1] < a[1] ? b : a));
    table.push(`${g.key}: weakest ink ${weakInk[0].replace('--g-', '')} ${K.ratioWords(weakInk[1])}, weakest line ${weakLine[0].replace('--g-', '')} ${K.ratioWords(weakLine[1])}; accent text/line: ${cells.join(' · ')}`);
  }
  assert.equal(pairs, 60, 'every ground with every colour: sixty pairs');
  console.log(`the floor on every ground × colour (weakest surface):\n  ${table.join('\n  ')}`);
  // Graphite's block is the :root's own (the default ground)
  const graphite = grounds.find((g) => g.key === 'graphite');
  for (const n of T.GROUND_BLOCK) assert.equal(graphite.values[n], byName[n].value, `Graphite's ${n} is the :root's own`);
  // only Black is true black (his rule: not so dark is HIS choice, Black one ground among five)
  for (const g of grounds) assert.equal(rgb(g.values['--g-canvas']).every((x) => x === 0), g.key === 'black', `${g.key}: true black only on Black`);
  // Paper draws every colour in its ink: the block maps the accent to it; each theme's ink is its ink variant on Paper, exactly
  const paper = grounds.find((g) => g.key === 'paper');
  for (const n of ['--g-accent', '--g-accent-text', '--g-accent-pale']) assert.equal(paper.values[n], 'var(--g-accent-ink)', `Paper's ${n} is the colour's ink`);
  assert.equal(Number(paper.values['--g-glow-floor']), 0, 'nothing glows on paper');
  const PS = SURFACES.map((n) => rgb(paper.values[n]));
  const ink = rgb(paper.values['--g-ink-1']);
  for (const t of themes) {
    assert.equal(t.values['--g-accent-ink'].toLowerCase(), K.toHex(K.inkVariant(rgb(t.values['--g-accent']), ink, PS)), `${t.key}: --g-accent-ink is not its ink variant on Paper`);
    assert.deepEqual(rgb(t.values['--g-accent-ink-rgb']), rgb(t.values['--g-accent-ink']), `${t.key}: its ink's triplet`);
  }
  // a swatch in a colour of its own on a Paper page takes its ink too
  assert.match(css, /\[data-ground="paper"\] \[data-accent\]:not\(\[data-ground\]\) \{[^}]*--g-accent: var\(--g-accent-ink\)/);
});

test('THEMES-2: every world defines every drawing token; The Scan is the :root\'s own; each draws as its direction did', () => {
  const worlds = blocks('world');
  assert.deepEqual(worlds.map((w) => w.key), WORLD_ORDER, 'the five worlds');
  const W = Object.fromEntries(worlds.map((w) => [w.key, w.values]));
  for (const w of worlds) {
    assert.deepEqual(T.WORLD_BLOCK.filter((n) => !w.values[n]), [], `${w.key}: a drawing token missing from its block`);
    // a world draws; it never touches a surface (One Ink alone keeps its accent off the words)
    for (const n of Object.keys(w.values)) assert.ok(T.WORLD_BLOCK.includes(n) || (w.key === 'ink' && n === '--g-accent-text'), `${w.key} touches ${n}, which is not a drawing token`);
  }
  for (const n of T.WORLD_BLOCK) {
    assert.ok(byName[n]?.job, `${n}: no job beside it in the :root block`);
    assert.equal(W.scan[n], byName[n].value, `The Scan's ${n} is the :root's own (the default world)`);
  }
  // the floor: The Scan's points, The Map's grid with its crosshair, The Eye's grain; none in One Ink and Glass
  assert.match(W.scan['--g-floor-mask'], /^url\("data:image\/svg\+xml,.*circle/, 'The Scan: a field of points');
  assert.match(W.map['--g-floor-mask'], /^url\("data:image\/svg\+xml,.*M32 40\.5H49M40\.5 32V49/, 'The Map: a grid and a crosshair every five squares');
  assert.match(W.eye['--g-floor-mask'], /^url\("data:image\/svg\+xml,.*rect/, 'The Eye: grain');
  for (const k of ['ink', 'glass']) {
    assert.equal(W[k]['--g-floor-mask'], 'none', `${k}: no floor pattern`);
    assert.equal(Number(W[k]['--g-floor-a']), 0, `${k}: no floor`);
  }
  for (const k of ['scan', 'map', 'eye']) assert.ok(Number(W[k]['--g-floor-a']) > 0 && Number(W[k]['--g-floor-a']) <= 0.35, `${k}: the floor shows, never louder than a word`);
  // the corners: The Scan 2, The Map 0, The Eye 2, One Ink 0, Glass 20 on cells (today's cards) and 26 on capsules
  const corners = (k) => ['--g-radius-key', '--g-radius-cell', '--g-radius-chip', '--g-radius-capsule'].map((n) => W[k][n]);
  assert.deepEqual(corners('scan'), ['2px', '2px', '2px', '2px']);
  assert.deepEqual(corners('map'), ['0px', '0px', '0px', '0px']);
  assert.deepEqual(corners('eye'), ['2px', '2px', '2px', '2px']);
  assert.deepEqual(corners('ink'), ['0px', '0px', '0px', '0px']);
  assert.deepEqual([W.glass['--g-radius-cell'], W.glass['--g-radius-capsule']], ['20px', '26px']);
  // the glow: none in One Ink; only Glass's marks glow
  assert.equal(Number(W.ink['--g-glow']), 0, 'One Ink: no glow');
  for (const k of ['scan', 'map', 'eye', 'glass']) assert.equal(Number(W[k]['--g-glow']), 1, `${k}: the glow`);
  for (const k of WORLD_ORDER) assert.equal(W[k]['--g-mark-glow'] !== '0px', k === 'glass', `${k}: a glow round a lit mark only in Glass`);
  // the marks: The Map's square pins (the arm as thick as it is long), The Eye's one sharp box with its line of sight, One Ink's rules
  assert.equal(W.map['--g-ret-arm'], W.map['--g-ret-weight'], 'The Map: square pins at the corners');
  assert.equal(W.scan['--g-ret-arm'], '10px', 'The Scan: corner marks');
  assert.equal(W.eye['--g-ret-arm'], '0px', 'The Eye: no corners, the sharp box alone');
  assert.notEqual(W.eye['--g-ret-sight'], '0px', 'The Eye: the line of sight drawn on the box');
  for (const k of ['scan', 'map', 'ink', 'glass']) assert.equal(W[k]['--g-ret-sight'], '0px', `${k}: no line of sight on the box`);
  assert.equal(W.ink['--g-ret-side'], '0', 'One Ink: a reticle is a rule above and below');
  assert.equal(W.ink['--g-plate-side'], '0', 'One Ink: a plate is a rule above and below');
  assert.equal(W.map['--g-plate-edge'], 'dashed', 'The Map: dashed plates');
  assert.equal(W.eye['--g-plate-edge'], 'dotted', 'The Eye: plates at reduced ink');
  assert.equal(W.eye['--g-plate-shadow'], 'none');
  assert.notEqual(W.glass['--g-blur'], '0px', 'Glass: frosted glass');
  for (const k of ['scan', 'map', 'eye', 'ink']) assert.equal(W[k]['--g-blur'], '0px', `${k}: no blur`);
  // One Ink says it in the serif, and its accent is never text
  assert.equal(W.ink['--g-face-say'], 'var(--g-font-serif)');
  assert.equal(W.ink['--g-accent-text'], 'var(--g-ink-1)');
  // the hologram orb is not redrawn: the worlds govern its floor and glow only (no world names the orb's draw)
  for (const w of worlds) assert.ok(!Object.keys(w.values).some((n) => /orb|mind|hologram/.test(n)), `${w.key} touches the orb's draw`);
});

test('THEMES-2: every preset resolves to a full recipe — the twelve on Graphite in The Scan, then The Scan, The Map, The Eye, One Ink, Glass', () => {
  needRecipe();
  const P = TH.presets();
  assert.deepEqual(P.map((p) => p.key), [...Object.keys(BRIEF), 'scan', 'map', 'eye', 'oneink', 'glass'], 'the presets in Settings\' order');
  for (const p of P) {
    const r = TH.presetRecipe(p);
    assert.ok(TH.GROUND_KEYS.includes(r.ground) && TH.COLOUR_KEYS.includes(r.colour) && TH.WORLD_KEYS.includes(r.world), `${p.key}: ${JSON.stringify(r)}`);
    assert.ok(TH.GROUND_KEYS.includes(r.night) && r.night !== 'paper', `${p.key}: its night ground`);
    for (const d of TH.SWITCHES) assert.ok(d.options.some((o) => o.value === r.switches[d.key]), `${p.key}: the switch ${d.key} is ${r.switches[d.key]}`);
    assert.equal(TH.presetOf(r)?.key, p.key, `${p.key} is a recipe of its own`);
    if (!p.from) assert.deepEqual([r.ground, r.colour, r.world, r.switches], ['graphite', p.key, 'scan', TH.SWITCH_DEFAULTS], `${p.key}: Graphite + ${p.key} + The Scan + the default switches`);
  }
  const R = (k) => TH.presetRecipe(P.find((p) => p.key === k));
  const brief = (k) => { const r = R(k); return [r.ground, r.colour, r.world]; };
  assert.deepEqual(brief('scan'), ['black', 'reactor', 'scan']);
  assert.equal(R('scan').switches.glow, 'off', 'THE SCAN: glow off, W1 as rendered');
  assert.deepEqual(brief('map'), ['slate', 'reactor', 'map']);
  assert.deepEqual(brief('eye'), ['black', 'reactor', 'eye']);
  assert.deepEqual(brief('oneink'), ['warm', 'gold', 'ink']);
  assert.equal(R('oneink').switches.readings, 'system', 'ONE INK: mono off');
  assert.deepEqual(brief('glass'), ['graphite', 'reactor', 'glass']);
  // a dial changed under a preset makes Custom
  assert.equal(TH.presetOf({ ...R('ember'), switches: { ...R('ember').switches, glow: 'off' } }), null, 'a changed dial is Custom');
  assert.equal(TH.presetOf({ ...R('glass'), ground: 'black' }), null, 'a changed ground is Custom');
  // the presets carry theme.ts's own tag lines for the twelve; every ground and world has its sentence in my voice
  assert.match(read('../../web/src/state/theme.ts'), /export const PRESETS: Preset\[\] = presets\(Object\.fromEntries\(Object\.entries\(THEMES\)/);
  for (const g of TH.GROUNDS) assert.ok(/^[A-Z].{12,}[.]$/.test(g.line) && !/\bthe owner\b/.test(g.line), `${g.key}: "${g.line}"`);
  for (const w of TH.WORLDS) assert.ok(/^[A-Z].{12,}[.]$/.test(w.line), `${w.key}: "${w.line}"`);
  assert.match(TH.GROUNDS[0].line, /^Nothing lit but what I’m looking at\.$/, 'Black: his sentence');
  // Orbit is not a world, and says so where it is found
  assert.ok(!TH.WORLD_KEYS.includes('orbit'));
  assert.equal(TH.ORBIT_LINE, 'Orbit is a way round, not a look; it comes with the shell.');
  assert.equal(TH.ROOMS_LINE, 'Every room follows the world fully with the shell.');
  assert.deepEqual(TH.DIRECTIONS.map((d) => [d.key, d.preset]), [['scan', true], ['map', true], ['eye', true], ['oneink', true], ['glass', true], ['orbit', false]]);
});

test('THEMES-2: a bare colour key (every phone before) reads as Graphite + the colour + The Scan, and what is kept comes back exactly', () => {
  needRecipe();
  assert.deepEqual(TH.recipeFrom('ember'), { ground: 'graphite', colour: 'ember', world: 'scan', night: 'graphite', switches: TH.SWITCH_DEFAULTS });
  assert.deepEqual(TH.recipeFrom('ember', null), TH.recipeFrom('ember'));
  assert.equal(TH.recipeFrom('stark').colour, 'reactor', 'a classic look\'s name is Reactor');
  const kept = { ground: 'paper', world: 'map', night: 'black', switches: { glow: 'off', body: 21, day: 'on' } };
  const back = TH.recipeFrom('gold', kept);
  assert.deepEqual(back, { ground: 'paper', colour: 'gold', world: 'map', night: 'black', switches: { ...TH.SWITCH_DEFAULTS, glow: 'off', body: 21, day: 'on' } });
  assert.deepEqual(TH.recipeFrom('gold', TH.keptLook(back)), back, 'kept and read back, the same recipe');
  // a dark ground chosen is the night ground too
  assert.equal(TH.recipeFrom('gold', { ground: 'slate', night: 'black' }).night, 'slate');
  // anything it cannot be falls back, nothing breaks
  assert.deepEqual(TH.recipeFrom('violet', { ground: 'neon', world: 'orbit', night: 'paper', switches: { body: 12, corners: 'wobbly', sound: 'loud' } }),
    { ground: 'graphite', colour: 'violet', world: 'scan', night: 'graphite', switches: TH.SWITCH_DEFAULTS });
  // the phone keeps it beside `theme` in ghosty.settings (the daily backup carries that key whole, so another phone restored
  // from it opens in the same recipe) and opens in it at the start
  assert.match(read('../../web/src/state/app.ts'), /look: KeptLook \| null;/);
  assert.match(read('../../web/src/features/system/backup.ts'), /\{ key: 'ghosty\.settings', label: 'settings', whole: true \}/);
  assert.match(read('../../web/src/main.ts'), /applyRecipe\(keptRecipe\(settleTheme\(\)\)\)/);
  assert.match(read('../../web/src/shell/boot.ts'), /bootState\.recipe = \{ theme: dd\.theme/, 'the boot records the recipe it plays in, as it records the accent');
});

test('THEMES-2: today\'s corners and canvas follow the world and the night ground; the world\'s floor is behind every screen; the marks draw from its tokens', () => {
  const from = styles.indexOf('THE SYSTEM (BRIEF-DESIGN-SYSTEM');
  const section = styles.slice(from, styles.indexOf('/* ==== end THE SYSTEM ==== */'));
  assert.ok(section.includes('html[data-world] { --bg: var(--g-room-canvas); --bgr: var(--g-room-canvas-rgb); --card: var(--g-radius-cell); --rad: var(--g-radius-chip); }'), 'the radius aliases and the canvas follow the world');
  assert.ok(section.includes('html[data-world], html[data-world] body { background: var(--g-room-canvas); }'), 'the floor behind every screen is the night ground\'s canvas');
  assert.match(section, /html\[data-world\] body::before \{[^}]*rgba\(var\(--g-room-points-rgb\), var\(--g-floor-a\)\)[^}]*var\(--g-floor-mask\)/, 'the world\'s floor over every screen');
  assert.match(section, /html\[data-world\] body\[data-tab="eye"\]::before \{ display: none; \}/, 'God\'s eye keeps its globe as its floor');
  assert.match(section, /html\[data-world\] #boot:not\(\.playing\), html\[data-world\] #boot \.bveil \{ background: var\(--g-room-canvas\); \}/, 'the boot plays on the ground');
  // the night grounds: each dark ground, its canvas and its points the ground's own; never Paper
  const grounds = Object.fromEntries(blocks('ground').map((g) => [g.key, g.values]));
  const nights = blocks('night');
  assert.deepEqual(nights.map((n) => n.key), ['black', 'graphite', 'slate', 'warm']);
  for (const n of nights) {
    assert.equal(n.values['--g-room-canvas'], grounds[n.key]['--g-canvas'], `${n.key}: the room's canvas is the ground's`);
    assert.equal(n.values['--g-room-points-rgb'], grounds[n.key]['--g-bone-rgb'], `${n.key}: the floor's points`);
    assert.equal(n.values['--g-room-glow'], grounds[n.key]['--g-glow-floor'], `${n.key}: its glow`);
  }
  // the marks and plates are drawn from the world's tokens (so every world reaches them, and a tile shows its own world)
  for (const t of ['var(--g-ret-arm) var(--g-ret-weight)', 'border: var(--g-hair) var(--g-ret-edge) var(--g-line-faint)', 'background: var(--g-plate-fill)', 'var(--g-plate-edge)', 'calc(var(--g-hair) * var(--g-plate-side))', 'stroke-dasharray: var(--g-sight-dash)', 'width: var(--g-ret-sight)', 'box-shadow: 0 0 calc(var(--g-mark-glow) * var(--g-glow-floor))', 'backdrop-filter: blur(var(--g-blur))', 'font-family: var(--g-face-say)']) assert.ok(section.includes(t), `the system's CSS does not draw with ${t}`);
  // the pages drawn in the system stand on the ground in force, their bar too
  assert.match(section, /html body:is\(\[data-tab="look"\], \.g-themepage\) #top \{ background: var\(--g-canvas\); \}/);
  assert.match(section, /html #pg-settings \.pn\.themepn\.pushed \{ background: var\(--g-canvas\); color: var\(--g-ink-1\); \}/);
  // the glow reaches today's halos and Mind's (state/theme.ts, features/core/mind.ts): a world governs the orb's glow, never its draw
  assert.match(read('../../web/src/state/theme.ts'), /rgba\(\$\{cr\}, \$\{\+\(v \* t\.glow \* roomGlow\)\.toFixed\(3\)\}\)/);
  assert.match(read('../../web/src/features/core/mind.ts'), /P\.h2\.material\.opacity = 0\.45 \* p\.bright \* b\.core \* halo;/);
});

test('THEMES-2: the sun times for his home give Paper by day and his night ground after — the clock and his saved home, never GPS', () => {
  needRecipe();
  const was = process.env.TZ;
  process.env.TZ = 'Europe/London';
  try {
    const home = { lat: 52.4862, lon: -1.8904 }; // Birmingham, as he saved it in the specs
    const hm = (ms) => new Date(ms).toISOString().slice(11, 16);
    const near = (got, h, m, what) => assert.ok(Math.abs(got - Date.UTC(...what, h, m)) <= 4 * 60_000, `${what.join('-')}: ${hm(got)} (the almanac's ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} GMT)`);
    // the almanac for Birmingham: midsummer 03:44 and 20:34 GMT, midwinter 08:16 and 15:55, the equinox 06:12 and 18:20
    for (const [ymd, rise, set] of [[[2026, 5, 21], [3, 44], [20, 34]], [[2026, 11, 21], [8, 16], [15, 55]], [[2026, 2, 20], [6, 12], [18, 20]]]) {
      const t = TH.sunTimes(Date.UTC(...ymd, 12), home.lat, home.lon);
      near(t.rise, ...rise, ymd);
      near(t.set, ...set, ymd);
    }
    const noon = Date.UTC(2026, 10, 7, 12);
    const sun = TH.sunTimes(noon, home.lat, home.lon);
    assert.ok(sun.rise > Date.UTC(2026, 10, 7, 7, 5) && sun.rise < Date.UTC(2026, 10, 7, 7, 25) && sun.set > Date.UTC(2026, 10, 7, 16, 15) && sun.set < Date.UTC(2026, 10, 7, 16, 40), `7 Nov: ${hm(sun.rise)} to ${hm(sun.set)}`);
    const r = { ...TH.recipeFrom('reactor', { ground: 'black' }), switches: { ...TH.SWITCH_DEFAULTS, day: 'on' } };
    assert.equal(TH.groundAt(r, noon, home), 'paper', 'by day: Paper');
    assert.equal(TH.groundAt(r, Date.UTC(2026, 10, 7, 20), home), 'black', 'after sunset: his night ground');
    assert.equal(TH.groundAt(r, Date.UTC(2026, 10, 7, 6), home), 'black', 'before sunrise: his night ground');
    assert.equal(TH.groundAt(r, sun.set - 60_000, home), 'paper');
    assert.equal(TH.groundAt(r, sun.set + 60_000, home), 'black', 'it flips at sunset');
    assert.equal(TH.groundAt({ ...r, switches: { ...r.switches, day: 'off' } }, noon, home), 'black', 'not following the day: the ground as chosen');
    // when it flips is said on the Theme row
    const dl = TH.daylight(noon, home);
    assert.deepEqual([dl.day, dl.flipAt], [true, sun.set]);
    assert.equal(TH.recipeWords(r, { now: noon, home }), `Reactor · Paper till ${TH.clockWords(sun.set)} · The Scan`);
    assert.match(TH.recipeWords(r, { now: Date.UTC(2026, 10, 7, 20), home }), /^Reactor · Black till 07:\d\d · The Scan$/);
    // no home saved: 08:00 to 18:00 on the phone's clock
    const at = (h, m) => new Date(2026, 10, 7, h, m).getTime();
    assert.deepEqual([at(7, 59), at(8, 1), at(17, 59), at(18, 1)].map((t) => TH.groundAt(r, t, null)), ['black', 'paper', 'paper', 'black']);
    // the far north: no sunrise in December (never Paper), no sunset at midsummer (Paper all day)
    const tromso = { lat: 69.65, lon: 18.96 };
    assert.equal(TH.groundAt(r, Date.UTC(2026, 11, 15, 11), tromso), 'black');
    assert.equal(TH.groundAt(r, Date.UTC(2026, 5, 21, 23, 30), tromso), 'paper');
  } finally {
    if (was === undefined) delete process.env.TZ;
    else process.env.TZ = was;
  }
  // never GPS: the phone reads his saved home, not its position
  const src = read('../../web/src/state/theme.ts');
  assert.match(src, /const h = settings\.get\(\)\.home;/);
  assert.doesNotMatch(src, /geolocation|getCurrentPosition|watchPosition/);
});

test('THEMES-2: the look by words, with no model — his asks taken and said in a sentence, everything else left alone', () => {
  needRecipe();
  const A = TH.lookAsked;
  for (const [text, want] of [
    ['black background', { ground: 'black' }], ['Black background.', { ground: 'black' }], ['make the background black', { ground: 'black' }],
    ['can you make it paper please', { ground: 'paper' }], ['paper', { ground: 'paper' }], ['light mode', { ground: 'paper' }], ['slate background', { ground: 'slate' }],
    ['dark mode', { night: true }], ['lighter', { step: 'lighter' }], ['a bit darker', { step: 'darker' }],
    ['the scan', { direction: 'scan' }], ['switch to the map', { direction: 'map' }], ['the eye look', { direction: 'eye' }], ['one ink', { direction: 'oneink' }], ['glass', { direction: 'glass' }],
    ['calm', { switches: { motion: 'calm' } }], ['bigger text', { body: 'bigger' }], ['make the text bigger', { body: 'bigger' }], ['follow the day', { switches: { day: 'on' } }],
    ['glow off', { switches: { glow: 'off' } }], ['turn the glow off', { switches: { glow: 'off' } }], ['sharp corners', { switches: { corners: 'sharp' } }], ['switch to ember', { colour: 'ember' }],
  ]) assert.deepEqual(A(text), want, `"${text}"`);
  for (const text of ["what's the map of london", 'the eye of the storm', 'paper towels on my shopping list', 'calm down', 'is it black friday', 'show me the map of Birmingham', 'glass of water', 'ember is a nice name', 'when is sunset', 'make it rain', 'lighter fluid', 'bigger picture', 'graphite', 'open the door']) assert.equal(A(text), null, `"${text}" is not about the look`);
  // applied, and said: what changed, what stayed, the honest edge
  const r = TH.recipeFrom('ember');
  const black = TH.applyAsk(r, A('black background'));
  assert.deepEqual([black.recipe.ground, black.recipe.night, black.recipe.colour, black.recipe.world], ['black', 'black', 'ember', 'scan']);
  assert.equal(black.said, 'Black: nothing lit but what I’m looking at.');
  const map = TH.applyAsk(r, A('the map'));
  assert.deepEqual([map.recipe.ground, map.recipe.world, map.recipe.colour], ['slate', 'map', 'ember']);
  assert.match(map.said, /^The Map: .* On Slate, still in Ember\. Say “reactor” for its own colour\.$/);
  const paper = TH.applyAsk(r, A('lighter'));
  assert.equal(paper.recipe.ground, 'paper', 'lighter from Graphite: Paper');
  assert.equal(paper.recipe.night, 'graphite', 'the night ground kept under Paper');
  assert.equal(TH.applyAsk(paper.recipe, A('lighter')).said, 'Paper is the lightest ground I have.');
  assert.equal(TH.applyAsk(paper.recipe, A('a bit darker')).recipe.ground, 'graphite');
  assert.equal(TH.applyAsk(TH.recipeFrom('ember', { ground: 'slate' }), A('a bit darker')).recipe.ground, 'black');
  assert.equal(TH.applyAsk(TH.recipeFrom('ember', { ground: 'black' }), A('lighter')).recipe.ground, 'graphite', 'lighter from Black: the lit graphite, his "lighter one"');
  const big = TH.applyAsk(r, A('bigger text'));
  assert.equal(big.recipe.switches.body, 19);
  assert.equal(TH.applyAsk(TH.applyAsk(big.recipe, A('bigger text')).recipe, A('bigger text')).said, 'Body text is at 21 points already, my biggest.');
  assert.equal(TH.applyAsk(r, { body: 'smaller' }).said, 'Body text is at 17 points already: I never go under it.');
  assert.match(TH.applyAsk(r, A('follow the day'), { now: Date.UTC(2026, 10, 7, 12), home: { lat: 52.4862, lon: -1.8904 } }).said, /^Ground follows the day: Paper till \d\d:\d\d, then Graphite\. From your home’s sun times, never your live location\.$/);
  // the phone answers them before the brain hears them (no model); the brain's set_theme takes the same words
  // (the gallery's words, BRIEF-THEME-GALLERY: the same table also hears the looks and the bare colours: looksAsked)
  assert.match(read('../../web/src/assistant/phrases.ts'), /\{ id: 'look', test: \(t: string\) => lookAsked\(t\) !== null(?: \|\| looksAsked\(t\) !== null)? \}/);
  assert.match(read('../../web/src/assistant/local.ts'), /async look\(text, opts\) \{[\s\S]*?applyAsk\(theme\.recipe\(\), ask/);
  assert.match(read('../../web/src/commands/builtin.ts'), /lookAsked\(raw\) \?\? lookAsked\(`\$\{raw\} background`\)/);
  const desc = /client\('set_theme', '([^']+)'/.exec(read('../src/tools/ui.ts'))?.[1] ?? '';
  for (const w of ['black', 'slate', 'warm', 'paper', 'the scan', 'the map', 'the eye', 'one ink', 'glass', 'switch']) assert.ok(desc.includes(w), `set_theme's description names ${w}`);
});

test('THEMES-2: the switches each change one thing and keep the floor — body 17 / 19 / 21 with readings and tags growing, never under 12, on the 4-point line', () => {
  const block = (attr, key) => blocks(attr).find((b) => b.key === key)?.values;
  assert.deepEqual(block('glow', 'off'), { '--g-glow': '0', '--g-mark-glow': '0px' });
  assert.deepEqual(block('floor', 'off'), { '--g-floor-a': '0' });
  for (const n of ['--g-radius-key', '--g-radius-mark', '--g-radius-cell', '--g-radius-chip', '--g-radius-capsule']) assert.equal(block('corners', 'sharp')[n], '0px', `sharp: ${n}`);
  assert.deepEqual([block('corners', 'round')['--g-radius-cell'], block('corners', 'round')['--g-radius-capsule']], ['20px', '26px']);
  assert.equal(block('readings', 'system')['--g-font-mono'], 'var(--g-font-text)');
  assert.deepEqual(block('motion', 'calm'), { '--g-dur-lock': '0ms', '--g-dur-turn': '0ms', '--g-dur-bring': '0ms' });
  const size = (b, n) => T.typeParts(b[n])?.size ?? T.typeParts(byName[n].value).size;
  const sizes = {};
  for (const key of ['19', '21']) {
    const b = block('body', key);
    assert.ok(b, `no body ${key} block`);
    for (const [n, v] of Object.entries(b)) {
      const p = T.typeParts(v);
      assert.ok(p, `${key}: ${n} "${v}"`);
      assert.ok(p.size >= 12 && p.line % 4 === 0 && p.line >= p.size * 1.15, `${key}: ${n} is ${p.size}/${p.line} (nothing under 12, on the 4-point line)`);
      assert.match(p.family, /^var\(--g-font-(text|mono)\)$/);
    }
    assert.equal(size(b, '--g-t-body'), Number(key), `body ${key}`);
    sizes[key] = ['--g-t-reading', '--g-t-tag', '--g-t-caption'].map((n) => size(b, n));
  }
  const at17 = ['--g-t-reading', '--g-t-tag', '--g-t-caption'].map((n) => T.typeParts(byName[n].value).size);
  for (let i = 0; i < 3; i++) assert.ok(at17[i] < sizes['19'][i] && sizes['19'][i] <= sizes['21'][i], 'the readings, tags and captions grow with the body');
  needRecipe();
  assert.deepEqual(TH.SWITCHES.map((d) => d.key), ['glow', 'floor', 'corners', 'readings', 'body', 'motion', 'sound', 'day']);
  for (const d of TH.SWITCHES) for (const o of d.options) assert.ok(o.line.length >= 20 && /[.]$/.test(o.line), `${d.key} ${o.value}: "${o.line}"`);
  // the sound: a tone, a click or silence, on top of his sound setting; calm in the marks and the eye; Reduce Motion always wins
  const machine = read('../../web/src/ui/machine.ts');
  assert.match(machine, /if \(sound === 'tone'\) \{\s*if \(ms\) sfx\('lock', ms\);\s*else sfx\('lock'\);\s*\} else if \(sound === 'click'\) sfx\('click', ms\);/, 'the tone, the click, or silence; on the audio clock for the moment the box lands');
  assert.match(machine, /matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches\) \|\| \(typeof document !== 'undefined' && document\.documentElement\.dataset\.motion === 'calm'\)/);
  assert.match(read('../../web/src/features/core/mind.ts'), /dataset\.motion === 'calm'/, 'calm holds the orb still (one frame per change)');
  assert.match(read('../../web/src/assistant/sfx.ts'), /kind === 'click'/);
  assert.match(read('../../web/src/ui/dials.ts'), /Reduce Motion is on in your phone’s settings, so I hold still whatever this says: it always wins\./);
});
