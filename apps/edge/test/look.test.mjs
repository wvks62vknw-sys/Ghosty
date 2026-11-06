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

test('no existing screen changes: today\'s aliases keep their values, and styles.css imports the tokens first', () => {
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
