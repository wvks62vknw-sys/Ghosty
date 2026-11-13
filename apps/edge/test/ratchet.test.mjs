// THE RATCHET (BRIEF-SHELL, BRIEF-SHELL-2; the old look goes, never grows): the count of hard-coded hex colours, rgba() calls and px radii in
// the declarations of styles.css OUTSIDE THE SYSTEM section (which holds THE SCAN's and the shell's own drawing, all tokens) only goes down.
// Each pass writes its new number here. Before BRIEF-SHELL-2: 506 hex, 1,023 rgba, 475 px radii = 2,004; after: 506, 1,016, 470 = 1,992.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CEILING = { hex: 506, rgba: 1016, radiusPx: 470, total: 1992 };
const css = readFileSync(new URL('../../web/styles.css', import.meta.url), 'utf8');

export function count(text) {
  const a = text.indexOf('THE SYSTEM (BRIEF-DESIGN-SYSTEM');
  const start = text.lastIndexOf('/* ===', a);
  const end = text.indexOf('/* ==== end THE SYSTEM ==== */');
  const outside = (text.slice(0, start) + text.slice(end + 30)).replace(/\/\*[\s\S]*?\*\//g, '');
  const decls = [...outside.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]).join(';');
  const hex = (decls.match(/(?<![\w-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/g) ?? []).length;
  const rgba = (decls.match(/rgba?\(/g) ?? []).length;
  const radiusPx = decls.split(';').filter((d) => /border(-[a-z]+)*-radius\s*:/.test(d)).reduce((n, d) => n + (d.match(/\d*\.?\d+px/g) ?? []).length, 0);
  return { hex, rgba, radiusPx, total: hex + rgba + radiusPx };
}

test('the old look only goes down: hex colours, rgba() calls and px radii outside THE SYSTEM', () => {
  const now = count(css);
  console.log(`ratchet: ${JSON.stringify(now)} (ceiling ${JSON.stringify(CEILING)})`);
  for (const k of Object.keys(CEILING)) assert.ok(now[k] <= CEILING[k], `${k}: ${now[k]} is over ${CEILING[k]}; the old look must not grow (put new drawing in THE SYSTEM, in tokens)`);
});
test('the section the count leaves out holds no raw colour of its own', () => {
  const a = css.indexOf('THE SYSTEM (BRIEF-DESIGN-SYSTEM');
  const sys = css.slice(css.lastIndexOf('/* ===', a), css.indexOf('/* ==== end THE SYSTEM ==== */'));
  const shell = sys.slice(sys.indexOf('THE SHELL IN THE SCAN (BRIEF-SHELL-2'));
  assert.ok(shell.length > 1000);
  assert.equal((shell.replace(/\/\*[\s\S]*?\*\//g, '').match(/(?<![\w-])#[0-9a-fA-F]{3,8}(?![\w-])/g) ?? []).length, 0, 'a hex colour in the shell section');
});

// [markers] No file git tracks carries a merge-conflict marker line. One stray "=======" sat in styles.css from PR 86 until the POLISH 2 landing and
// made the rule after it invalid, on the live site, with every check green; this reads every tracked text file so none can come back unseen.
test('no tracked file carries a merge-conflict marker line', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean);
  assert.ok(files.length > 100, `git listed only ${files.length} files`);
  const bad = [];
  for (const f of files) {
    let buf;
    try {
      buf = readFileSync(join(root, f));
    } catch {
      continue; // (a tracked file deleted in the working tree has nothing to read)
    }
    if (buf.includes(0)) continue; // binary: no lines
    buf.toString('utf8').split('\n').forEach((line, i) => {
      if (/^(<{7}|\|{7}|={7}|>{7})( |$)/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, [], `merge-conflict marker lines: ${bad.join(', ')}`);
});

// THE STATES RATCHET (BRIEF-QUALITY-LIFE; the same shape as the colour ratchet above, but upward): for each screen of the eight packs of
// the LIFE room, how many of the four states (empty, loading, error, offline) are designed, read from the source by the marker kept where
// each is drawn: a `/* state: <screen> <kind> */` comment (the element itself also carries `data-state="<kind>"`, which the lifepass spec
// reads on the page). A screen that loses a state fails here. `base` is what the packs drew before the quality pass (each read from the
// code as it was), `now` what they draw after it: the count only goes up, a pass that adds states writes its new number here.
import { readdirSync } from 'node:fs';
const FEATURES = new URL('../../web/src/features/', import.meta.url);
export const STATES = {
  'money.statement': { dir: 'money', base: 2, now: 4 },
  'body.reps': { dir: 'body', base: 2, now: 3 },
  'body.run': { dir: 'body', base: 1, now: 1 },
  'body.breathe': { dir: 'body', base: 0, now: 1 },
  'body.stretch': { dir: 'body', base: 0, now: 1 },
  'body.health': { dir: 'body', base: 2, now: 4 },
  'body.water': { dir: 'body', base: 2, now: 4 },
  'kitchen.timers': { dir: 'kitchen', base: 1, now: 3 },
  'kitchen.shopping': { dir: 'kitchen', base: 2, now: 4 },
  'kitchen.plan': { dir: 'kitchen', base: 1, now: 3 },
  'people.who': { dir: 'people', base: 2, now: 4 },
  'people.plan': { dir: 'people', base: 1, now: 4 },
  'work.todo': { dir: 'work', base: 2, now: 4 },
  'work.interview': { dir: 'work', base: 2, now: 3 },
  'work.doc': { dir: 'work', base: 1, now: 1 },
  'creative.song': { dir: 'creative', base: 1, now: 2 },
  'creative.poster': { dir: 'creative', base: 0, now: 4 },
  'creative.card': { dir: 'creative', base: 0, now: 2 },
  'creative.comic': { dir: 'creative', base: 0, now: 2 },
  'creative.logo': { dir: 'creative', base: 0, now: 2 },
  'creative.palette': { dir: 'creative', base: 2, now: 4 },
  'creative.beat': { dir: 'creative', base: 1, now: 2 },
  'outside.walk': { dir: 'outside', base: 2, now: 3 },
  'outside.nearby': { dir: 'outside', base: 2, now: 4 },
  'outside.car': { dir: 'outside', base: 1, now: 4 },
  'outside.lost': { dir: 'outside', base: 2, now: 3 },
  'outside.split': { dir: 'outside', base: 1, now: 3 },
  'home.due': { dir: 'homeadmin', base: 2, now: 4 },
  'home.bins': { dir: 'homeadmin', base: 3, now: 4 },
  'home.bills': { dir: 'homeadmin', base: 2, now: 4 },
  'home.meter': { dir: 'homeadmin', base: 2, now: 4 },
  'home.things': { dir: 'homeadmin', base: 2, now: 3 },
};
const KINDS = ['empty', 'loading', 'error', 'offline'];
function statesOf(screen, dir) {
  const src = readdirSync(new URL(`${dir}/`, FEATURES)).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(new URL(`${dir}/${f}`, FEATURES), 'utf8')).join('\n');
  const found = new Set();
  for (const m of src.matchAll(/\/\*\s*state:\s*([a-z]+\.[a-z]+)\s+(empty|loading|error|offline)\s*\*\//g)) if (m[1] === screen) found.add(m[2]);
  return [...found].sort();
}
test('THE STATES RATCHET: each screen of the eight packs keeps every state it has been given (equal or more, never fewer)', () => {
  const rows = [];
  for (const [screen, { dir, base, now }] of Object.entries(STATES)) {
    const have = statesOf(screen, dir);
    rows.push(`${screen}: ${base} → ${have.length} (${have.join(', ') || 'none'})`);
    assert.ok(now >= base, `${screen}: the pinned number (${now}) is under what the pass began with (${base})`);
    assert.ok(have.length >= now, `${screen} has lost a state: ${have.length} drawn (${have.join(', ')}), ${now} pinned. Put back what was drawn there (a "state: ${screen} <kind>" marker where each is drawn).`);
  }
  console.log(`states ratchet:\n${rows.join('\n')}`);
});
test('the state markers name real screens and real kinds, and the pack screens named here are all of them', () => {
  const named = new Set(Object.keys(STATES));
  for (const dir of ['money', 'body', 'kitchen', 'people', 'work', 'creative', 'outside', 'homeadmin']) {
    const src = readdirSync(new URL(`${dir}/`, FEATURES)).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(new URL(`${dir}/${f}`, FEATURES), 'utf8')).join('\n');
    for (const m of src.matchAll(/\/\*\s*state:\s*(\S+)\s+(\S+)\s*\*\//g)) {
      assert.ok(named.has(m[1]), `${dir}: a state marker for "${m[1]}" that the ratchet does not list`);
      assert.ok(KINDS.includes(m[2]), `${dir}: a state marker of kind "${m[2]}" (use ${KINDS.join(', ')})`);
    }
  }
});
