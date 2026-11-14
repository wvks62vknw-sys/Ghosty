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

// [ports] The browser run has one preview brain, on 8788 (check.yml starts `node tests/preview-server.mjs` with no port). Five pass specs
// defaulted BASE to the port their builder previewed on (8829, 8832, 8838, 8840, 8841), so on CI every page they opened was refused and the
// combined landing's check went red on all five. A spec may take another port from BASE; its default is the run's own.
test('every browser spec that reads BASE defaults to the run\'s preview port, 8788', () => {
  const dir = fileURLToPath(new URL('../../../tests/', import.meta.url));
  const bad = [];
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.spec.mjs'))) {
    for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/process\.env\.BASE \?\? '([^']*)'/g)) {
      if (m[1] !== 'http://localhost:8788' && !(f === 'apps.spec.mjs' && m[1] === 'http://localhost:0')) bad.push(`${f}: ${m[1]}`);
    }
  }
  assert.deepEqual(bad, [], `specs that would open a port the run never serves: ${bad.join(', ')}`);
});

// THE STATES RATCHET (BRIEF-QUALITY-LIFE; the same shape as the colour ratchet above, but upward): for each screen of the eight packs of
// the LIFE room, how many of the four states (empty, loading, error, offline) are designed, read from the source by the marker kept where
// each is drawn: a `/* state: <screen> <kind> */` comment (the element itself also carries `data-state="<kind>"`, which the lifepass spec
// reads on the page). A screen that loses a state fails here. `base` is what the packs drew before the quality pass (each read from the
// code as it was), `now` what they draw after it: the count only goes up, a pass that adds states writes its new number here.
import { readdirSync } from 'node:fs';
const FEATURES = new URL('../../web/src/features/', import.meta.url);
const SRC = new URL('../../web/src/', import.meta.url);
export const STATES = {
  'money.statement': { dir: 'money', base: 2, now: 4 },
  // FINAL ROUND (the money lane): the MONEY screen as a budgeting app of its own (features/money/app.ts), each page with all four states
  'money.month': { dir: 'money', base: 0, now: 4 },
  'money.budgets': { dir: 'money', base: 0, now: 4 },
  'money.bills': { dir: 'money', base: 0, now: 4 },
  'money.trends': { dir: 'money', base: 0, now: 4 },
  'body.reps': { dir: 'body', base: 2, now: 3 },
  'body.run': { dir: 'body', base: 1, now: 1 },
  'body.breathe': { dir: 'body', base: 0, now: 1 },
  'body.stretch': { dir: 'body', base: 0, now: 1 },
  'body.health': { dir: 'body', base: 2, now: 4 },
  'body.water': { dir: 'body', base: 2, now: 4 },
  // FINAL ROUND, BODY lane: the four new trackers kept on the phone (features/body/track.ts), each its empty and its error
  'body.sleep': { dir: 'body', base: 0, now: 2 },
  'body.steps': { dir: 'body', base: 0, now: 2 },
  'body.weight': { dir: 'body', base: 0, now: 2 },
  'body.mood': { dir: 'body', base: 0, now: 2 },
  'kitchen.timers': { dir: 'kitchen', base: 1, now: 3 },
  'kitchen.shopping': { dir: 'kitchen', base: 2, now: 4 },
  'kitchen.plan': { dir: 'kitchen', base: 1, now: 3 },
  // FINAL ROUND, BODY AND KITCHEN lane: the pantry and the recipe book kept on the phone (features/kitchen/larder.ts)
  'kitchen.pantry': { dir: 'kitchen', base: 0, now: 3 },
  'kitchen.recipes': { dir: 'kitchen', base: 0, now: 3 },
  'people.who': { dir: 'people', base: 2, now: 4 },
  'people.plan': { dir: 'people', base: 1, now: 4 },
  'people.coming': { dir: 'people', base: 0, now: 4 },
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
  // HOME (BRIEF-QUALITY-HOME): the same table, the same marker, the rows for the first screen and the line that holds the house.
  // `at` names where the screen's files are when it is not under features/ (the shell's own). `base` is what each drew before that pass.
  'core.home': { dir: 'core', base: 2, now: 3 },
  'core.today': { dir: 'core', base: 3, now: 3 },
  'core.ask': { dir: 'core', base: 1, now: 1 },
  'brief.day': { dir: 'brief', base: 3, now: 3 },
  'brief.say': { dir: 'brief', base: 0, now: 1 },
  'shell.jump': { at: 'shell', dir: '', base: 1, now: 2 },
  // BRIEF-QUALITY-BOOT-ORB: the boot (the held landing's line = loading, the offline stamp = offline, No feeds yet = empty, the fault = error), the orb
  // (its line for the first listening/thinking = loading, the brain gone = offline, the models cooling = error) and the ribbon (— = loading,
  // Nothing next = empty, the brain gone and no signal = offline, a turn that did not land = error). The film (features/core/scan/film.ts) draws
  // no words and no states of its own, so it has no row; its held landing is the boot's `loading`.
  'shell.boot': { at: 'shell', dir: '', base: 1, now: 4 },
  'core.orb': { dir: 'core', base: 1, now: 3 },
  'core.ribbon': { dir: 'core', base: 1, now: 4 },
  // SEE (BRIEF-QUALITY-SEE): God's Eye, the Machine view, each of the Lens's modes, THREATS (the list, NEAR HOME), the offline eyes' pack rows.
  // `base` is what each drew, in words of its own, before that pass (a toast that was gone is not a state).
  'eye.globe': { dir: 'eye', base: 0, now: 1 },
  'eye.search': { dir: 'eye', base: 0, now: 2 },
  'eye.cams': { dir: 'eye', base: 0, now: 1 },
  'eye.cam': { dir: 'eye', base: 2, now: 2 },
  'eye.roadahead': { dir: 'eye', base: 1, now: 1 },
  'machine.view': { dir: 'eye', base: 0, now: 2 },
  // the camera wall (NEXT ROUND, see.u2): its empty wall and a camera that will not come
  'eye.wall': { dir: 'eye', base: 0, now: 2 },
  // the full-screen rain radar (see.s3): fetching, unreachable, no signal
  'eye.rain': { dir: 'eye', base: 0, now: 3 },
  'lens.camera': { dir: 'lens', base: 3, now: 3 },
  'lens.see': { dir: 'lens', base: 0, now: 1 },
  'lens.read': { dir: 'lens', base: 0, now: 1 },
  'lens.hands': { dir: 'lens', base: 0, now: 1 },
  'lens.ask': { dir: 'lens', base: 0, now: 2 },
  'lens.name': { dir: 'lens', base: 0, now: 2 },
  'lens.people': { dir: 'lens', base: 0, now: 2 },
  'lens.measure': { dir: 'lens', base: 1, now: 1 },
  // PHOTO TOOLS: a job the free online tools did not do (BACKGROUND offers the cut-out on this phone; SHARPER and ERASE say they wait)
  'lens.photo': { dir: 'lens', base: 1, now: 2 },
  // [lens.u6] SCAN's DOCUMENT AUTO, new (base 0): no page in view, holding still, a page it could not keep, no signal (and none needed)
  'lens.scan': { dir: 'lens', base: 0, now: 4 },
  'threats.signals': { dir: 'threats', base: 2, now: 4 },
  'threats.nearhome': { dir: 'threats', base: 2, now: 4 },
  'settings.packs': { dir: 'settings', base: 3, now: 3 },
  // MAKE (BRIEF-QUALITY-MAKE): the Workshop (the draft card, WHAT'S NEW, the projects), the 3D studio (the scene, the catalogue, MAKE · PHOTO,
  // the engine's pane), REVERSE, SPACE (WILL IT FIT?, DESIGN MY HOME, a room from a photo), the Workbench (the panels, the tunnel), CONVERT, HOUSE.
  // `base` is what each drew, in words of its own, before that pass (a toast that was gone is not a state, nor a line the page never said).
  'workshop.draft': { dir: 'workshop', base: 2, now: 4 },
  'workshop.whatsnew': { dir: 'workshop', base: 0, now: 1 },
  'workshop.projects': { dir: 'workshop', base: 2, now: 3 },
  'studio.scene': { dir: 'studio', base: 2, now: 2 },
  'studio.catalogue': { dir: 'studio', base: 3, now: 4 },
  'studio.photo': { dir: 'studio', base: 2, now: 4 },
  'studio.engine': { at: 'engine3d', dir: '', base: 1, now: 1 },
  'reverse.reports': { dir: 'reverse', base: 3, now: 4 },
  'reverse.report': { dir: 'reverse', base: 2, now: 2 },
  'reverse.start': { dir: 'reverse', base: 3, now: 4 },
  'space.fit': { dir: 'space', base: 0, now: 1 },
  'space.home': { dir: 'space', base: 2, now: 4 },
  'space.photo': { dir: 'space', base: 3, now: 3 },
  // FINAL ROUND (MAKE lane): MATERIALS says what it needs when there is no room to work from
  'space.materials': { dir: 'space', base: 0, now: 1 },
  // NEXT ROUND (MAKE lane): MATERIALS' makeover set against his own statements, all four states (new, so base 0)
  'space.budget': { dir: 'space', base: 0, now: 4 },
  'workbench.panels': { dir: 'workbench', base: 1, now: 2 },
  'workbench.tunnel': { dir: 'workbench', base: 1, now: 2 },
  'convert.units': { at: 'convert', dir: '', base: 1, now: 2 },
  'convert.files': { at: 'convert', dir: '', base: 3, now: 3 },
  'house.house': { at: 'house', dir: '', base: 4, now: 4 },
  // PLAN AND ME (BRIEF-QUALITY-PLAN-ME): base read from the code at 08a5337a, now what the pass draws
  'spending.statement': { dir: 'agenda', base: 2, now: 4 },
  'markets.prices': { dir: 'markets', base: 3, now: 4 },
  'radio.stations': { dir: 'radio', base: 3, now: 4 },
  'memory.timeline': { dir: 'memory', base: 2, now: 4 },
  // NEXT ROUND (MEMORY lane): YOUR WORD, new, draws its loading, empty, error and offline states
  'memory.keep': { dir: 'memory', base: 0, now: 4 },
  'settings.faces': { dir: 'settings', base: 1, now: 2 },
  'settings.principles': { dir: 'settings', base: 1, now: 3 },
  'system.loops': { dir: 'system', base: 1, now: 2 },
  'system.ledger': { dir: 'system', base: 2, now: 3 },
  'system.foresight': { dir: 'system', base: 2, now: 3 },
  'links.account': { dir: 'links', base: 1, now: 2 },
  'links.notes': { dir: 'links', base: 1, now: 2 },
  'social.queue': { dir: 'social', base: 3, now: 4 },
  // PLAN AND HOME (FINAL ROUND, planlane): the agenda's to-do list and the radio's RECENT list, new screens (base 0)
  'agenda.todo': { dir: 'agenda', base: 0, now: 1 },
  'radio.recent': { dir: 'radio', base: 0, now: 1 },
  // [planlane:links] each connection's state in his words (checking, can't reach the brain, linked but not working, nothing linked yet)
  'links.connections': { dir: 'links', base: 0, now: 4 },
  // [planlane:social] SOCIAL's WRITE A POST (no account linked, the brain not answering, a draft not made) and SENT TODAY (new parts, base 0)
  'social.compose': { dir: 'social', base: 0, now: 3 },
  'social.sent': { dir: 'social', base: 0, now: 3 },
  // [planlane:markets] YOUR COINS (his holdings), a coin's chart ranges and YOUR WATCHLIST's search: new parts (base 0)
  'markets.holdings': { dir: 'markets', base: 0, now: 2 },
  'markets.chart': { dir: 'markets', base: 0, now: 3 },
  'markets.watchlist': { dir: 'markets', base: 0, now: 4 },
  // [planlane:brief] the Brief's weather (on its way, Open-Meteo not answering with TRY AGAIN) and its headlines (the BBC not answering, a way on)
  'brief.weather': { dir: 'brief', base: 0, now: 2 },
  'brief.news': { dir: 'brief', base: 0, now: 1 },
  // [planlane:radio] the sleep timer a reload ended (said once, honestly), and FAVOURITES with none kept yet
  'radio.sleep': { dir: 'radio', base: 0, now: 1 },
  'radio.favs': { dir: 'radio', base: 0, now: 1 },
  // [planlane:agenda] the diary (loading, the brain out of reach with the phone's copy said so, offline with no copy, empty) and the chat's month
  'agenda.diary': { dir: 'agenda', base: 0, now: 4 },
  'agenda.month': { dir: 'agenda', base: 0, now: 1 },
  // LEARN (BRIEF-QUALITY-LEARN): COURSES, the Arcade's shelf, the GYM's cards, SCHOOL's ladder, the Library's shelf and reader, LEARNING's pills and
  // the Coach's tuner. `base` is what each drew, in words of its own, before that pass (a toast that was gone, or a raw worker message, is not a state).
  'learn.courses': { dir: 'learn', base: 3, now: 4 },
  'arcade.shelf': { dir: 'arcade', base: 3, now: 4 },
  'gym.cards': { dir: 'gym', base: 1, now: 3 },
  'school.ladder': { dir: 'school', base: 4, now: 4 },
  'library.shelf': { dir: 'library', base: 3, now: 4 },
  'library.reader': { dir: 'library', base: 4, now: 4 },
  'learning.pills': { dir: 'learning', base: 2, now: 3 },
  'coach.tuner': { at: 'coach', dir: '', base: 3, now: 3 },
  // THE CHAT (BRIEF-QUALITY-CHAT): the log (its first open, with and without a signal), a turn's one line (its wait, its cut stream), the talk bar (its
  // listening, the microphone refused, no signal to hear him with), the Stage (its wait, no picture, a picture that could not be drawn), the sources
  // (a source that will not open), the phone's own answers (nothing found, no brain to ask, a note that could not be kept) and the HUD's call-outs
  // (not answering, no signal). `base` is what each drew, in words of its own, before that pass (a bare "thinking…", a word on a toast that went, a
  // dash or a made-up figure is not a state).
  'core.log': { dir: 'core', base: 1, now: 2 },
  'core.turn': { dir: 'core', base: 0, now: 2 },
  'core.talk': { dir: 'core', base: 1, now: 3 },
  'show.stage': { at: 'show', dir: '', base: 1, now: 3 },
  'core.cited': { dir: 'core', base: 0, now: 1 },
  'core.local': { at: 'assistant', dir: '', base: 1, now: 3 },
  'core.hud': { dir: 'core', base: 1, now: 2 },
  // THE COMIC (FINAL ROUND, lane COMIC): its own screen, new; base 0 since nothing was drawn before it.
  'comic.shelf': { dir: 'comic', base: 0, now: 3 },
  'comic.maker': { dir: 'comic', base: 0, now: 4 },
  'comic.reader': { dir: 'comic', base: 0, now: 2 },
  'comic.library': { dir: 'comic', base: 0, now: 4 },
  // SECURITY (NEXT ROUND, lane SECURITY): its own screen, new; base 0 since nothing was drawn before it.
  'security.locks': { dir: 'security', base: 0, now: 2 },
  'security.approvals': { dir: 'security', base: 0, now: 2 },
};
const KINDS = ['empty', 'loading', 'error', 'offline'];
function sourceOf(dir, at) {
  const root = at ? new URL(`${at}/`, SRC) : new URL(`${dir}/`, FEATURES);
  return readdirSync(root).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(new URL(f, root), 'utf8')).join('\n');
}
function statesOf(screen, dir, at) {
  const src = sourceOf(dir, at);
  const found = new Set();
  for (const m of src.matchAll(/\/\*\s*state:\s*([a-z]+\.[a-z]+)\s+(empty|loading|error|offline)\s*\*\//g)) if (m[1] === screen) found.add(m[2]);
  return [...found].sort();
}
test('THE STATES RATCHET: each screen of the eight packs and of Home keeps every state it has been given (equal or more, never fewer)', () => {
  const rows = [];
  for (const [screen, { dir, at, base, now }] of Object.entries(STATES)) {
    const have = statesOf(screen, dir, at);
    rows.push(`${screen}: ${base} → ${have.length} (${have.join(', ') || 'none'})`);
    assert.ok(now >= base, `${screen}: the pinned number (${now}) is under what the pass began with (${base})`);
    assert.ok(have.length >= now, `${screen} has lost a state: ${have.length} drawn (${have.join(', ')}), ${now} pinned. Put back what was drawn there (a "state: ${screen} <kind>" marker where each is drawn).`);
  }
  console.log(`states ratchet:\n${rows.join('\n')}`);
});
test('the state markers name real screens and real kinds, and the screens named here are all of them', () => {
  const named = new Set(Object.keys(STATES));
  for (const [dir, at] of [['money'], ['body'], ['kitchen'], ['people'], ['work'], ['creative'], ['outside'], ['homeadmin'], ['core'], ['brief'], ['', 'shell'], ['eye'], ['lens'], ['threats'], ['settings'], ['workshop'], ['studio'], ['reverse'], ['space'], ['workbench'], ['', 'engine3d'], ['', 'convert'], ['', 'house'], ['agenda'], ['markets'], ['radio'], ['memory'], ['system'], ['links'], ['social'], ['learn'], ['arcade'], ['gym'], ['school'], ['library'], ['learning'], ['', 'coach'], ['comic'], ['security']]) {
    const src = sourceOf(dir, at);
    for (const m of src.matchAll(/\/\*\s*state:\s*(\S+)\s+(\S+)\s*\*\//g)) {
      assert.ok(named.has(m[1]), `${dir}: a state marker for "${m[1]}" that the ratchet does not list`);
      assert.ok(KINDS.includes(m[2]), `${dir}: a state marker of kind "${m[2]}" (use ${KINDS.join(', ')})`);
    }
  }
});

// THE WORDS RATCHET (POLISH 3; the same shape as the colour ratchet: the old shape goes down, never grows): for each of the four screens that
// were cut to one sentence, how many string literals over 90 characters its files hold (comments left out; a template counts by its own
// text outside ${ }). `base` is what each held on the code before POLISH 3 (read from it), `now` what it holds after: equal or lower from then on.
// A sentence that is long on purpose goes behind its "?" in two literals (ui/oneline.ts para), never back into one.
export function longLiterals(src, min = 90) {
  const out = [];
  const n = src.length;
  let i = 0;
  function code(stopAtBrace) {
    let depth = 0;
    while (i < n) {
      const c = src[i], d = src[i + 1];
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2); i = i < 0 ? n : i + 2; continue; }
      if (c === "'" || c === '"') { const q = c; let s = ''; i++; while (i < n && src[i] !== q && src[i] !== '\n') { if (src[i] === '\\') { s += src[i + 1]; i += 2; } else s += src[i++]; } i++; if (s.length > min) out.push(s); continue; }
      if (c === '`') { i++; template(); continue; }
      if (c === '{') depth++;
      if (c === '}') { if (stopAtBrace && depth === 0) { i++; return; } depth--; }
      i++;
    }
  }
  function template() {
    let s = '';
    while (i < n && src[i] !== '`') {
      if (src[i] === '\\') { s += src[i + 1]; i += 2; continue; }
      if (src[i] === '$' && src[i + 1] === '{') { i += 2; code(true); continue; }
      s += src[i++];
    }
    i++;
    if (s.length > min) out.push(s);
  }
  code(false);
  return out;
}
export const WORDS = {
  settings: { files: () => readdirSync(new URL('settings/', FEATURES)).filter((f) => f.endsWith('.ts') && f !== 'packs.ts').map((f) => `settings/${f}`), base: 67, now: 61 },
  system: { files: () => readdirSync(new URL('system/', FEATURES)).filter((f) => f.endsWith('.ts')).map((f) => `system/${f}`), base: 57, now: 40 },
  look: { files: () => ['look/index.ts'], base: 13, now: 6 },
  packs: { files: () => ['settings/packs.ts'], base: 7, now: 6 },
};
test('THE WORDS RATCHET: Settings, System, the Theme page and the packs\' cards hold no more long literals than they were cut to', () => {
  const rows = [];
  for (const [screen, { files, base, now }] of Object.entries(WORDS)) {
    const have = files().reduce((t, f) => t + longLiterals(readFileSync(new URL(f, FEATURES), 'utf8')).length, 0);
    rows.push(`${screen}: ${base} → ${have} (pinned ${now})`);
    assert.ok(now <= base, `${screen}: the pinned number (${now}) is over what the pass began with (${base})`);
    assert.ok(have <= now, `${screen} has ${have} string literals over 90 characters, ${now} pinned: cut the new one to a sentence (its fact behind a "?": ui/oneline.ts)`);
  }
  console.log(`words ratchet:\n${rows.join('\n')}`);
});
