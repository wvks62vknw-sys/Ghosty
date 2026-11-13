// THE FINDING RULE, HELD BY A TEST (BRIEF-SHELL pass 1; OWNER-ISSUES 143, his words: "I still want every thing we have to like a thing
// where you can use it and like easy to find and navigate"; the rule he agreed in 139 and 143: "recents and favourites in two taps,
// everything else in three taps or one typed word, every screen reachable from a visible list").
//  - for EVERY `screen:` of the catalogue the shortest path from Home by taps on visible things is worked out from the code that
//    draws them (the bar's areas, a hub's cards, the Me sheet's rows, the one row or pill inside a screen for the two screens that
//    sit inside another, a card's `cardTo`), printed as a table (screen -> taps -> path), and the test fails on any over three;
//  - every screen is on a visible list: a hub's cards, the Me sheet, the Every screen deck, or inside a screen that is;
//  - every screen is found by one typed word: the word is typed into the jump bar's own ranking (commands/rank.ts, the function
//    the bar draws) and the screen's row must be on the first screenful (six rows) and among the first three screens;
//  - recents and favourites are two taps: tap the search, tap the row (a pinned screen is the first row, six at most, in his order);
//  - the Abilities page is not a way in (OWNER-ISSUES 130, 143): no tab, no row, no card, no catalogue screen.
// Imported from the end of catalogue.test.mjs (which already holds the registry parse); builds its own small bundle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const at = (p) => new URL(p, import.meta.url).pathname;
const web = at('../../web/src');
const read = (f) => readFileSync(join(web, f), 'utf8');

await build({
  entryPoints: [at('../../web/src/commands/rank.ts'), at('../../web/src/shell/areadefs.ts'), at('../../web/src/shell/deckcopy.ts'), at('../../web/src/shell/rooms.ts'), at('../../web/src/abilities/sources.ts'), at('../../../packages/shared/src/catalogue.ts')],
  bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/finding'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning',
}).catch((e) => { throw new Error(`the finding test's bundle did not build (the jump bar's ranking must be a pure module, commands/rank.ts): ${e.message}`); });
const load = (f) => import(`./.build/finding/${f}.mjs`);
const R = await load('apps/web/src/commands/rank');
const D = await load('apps/web/src/shell/areadefs');
const K = await load('apps/web/src/shell/deckcopy');
const S = await load('apps/web/src/abilities/sources');
const RM = await load('apps/web/src/shell/rooms');

// ---------------------------------------------------------------- the screens, from the code
/** Every tab of features/index.ts TABS, with the fields that place it. */
function tabsOfSource() {
  const idx = read('features/index.ts');
  const imports = Object.fromEntries([...idx.matchAll(/import \{ (\w+) \} from '\.\/(\w+)';/g)].map((m) => [m[1], m[2]]));
  const names = /TABS: TabDef\[\] = \[([^\]]*)\]/.exec(idx)[1].split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('...'));
  const tabs = names.map((n) => {
    const src = readFileSync(join(web, 'features', imports[n], 'index.ts'), 'utf8');
    const block = src.slice(src.search(/TabDef = \{\s*id: '/));
    const head = block.slice(0, block.search(/\n\s*(mount|now|instrument)\b/) > 0 ? block.search(/\n\s*(mount|now|instrument)\b/) : 1500);
    const f = (k) => new RegExp(`\\b${k}: '([^']*)'`).exec(head)?.[1];
    return { id: f('id'), title: f('title') ?? f('id').toUpperCase(), blurb: f('blurb'), inside: f('inside'), cardTo: f('cardTo') };
  });
  for (const a of D.AREAS) tabs.push({ id: `area-${a.id}`, title: a.title.toUpperCase(), blurb: a.sub, hub: true });
  return tabs;
}
const tabs = tabsOfSource();
const byId = new Map(tabs.map((t) => [t.id, t]));
const hubCards = (() => {
  const src = read('shell/hubcards.ts');
  return new Set([...src.slice(src.indexOf('export const CARDS')).matchAll(/^ {2}([a-z0-9]+): \{$/gm)].map((m) => m[1]));
})();
const areaOfTab = (id) => D.AREAS.find((a) => a.tabs.includes(id));
const nice = (t) => t.title.charAt(0) + t.title.slice(1).toLowerCase();
const rowOf = (id) => D.ME_ROWS.find((r) => r.id === id);
// (Every screen's groups are the house's rooms since BRIEF-SHELL-2: shell/rooms.ts, the one list the plan, a room and the deck all read)
const deckOf = (id) => RM.roomOf(id)?.key;

/**
 * The shortest path from Home by taps on visible things. A tap is one finger on one thing that is on screen when it is tapped.
 * THE LOOK is the one row under Settings' first pill (Appearance), which Settings opens on: its row is there on arrival.
 */
function pathOf(id) {
  const t = byId.get(id);
  if (id === 'core') return [];
  if (t.hub) {
    // (the Me area is not on the bar: its hub is reached by its row on the Me sheet, which must be there)
    if (id === 'area-me') return rowOf('area-me') ? ['tap your initial (top right)', `tap "${rowOf('area-me').label}" on the Me sheet`] : null;
    return [`tap ${D.AREAS.find((a) => `area-${a.id}` === id).title} in the house (the bar in Glass)`];
  }
  if (t.inside) {
    const parent = byId.get(t.inside);
    const via = parent.id === 'settings' || parent.id === 'workshop' ? 'the row' : 'a book';
    return [...pathOf(t.inside), `tap ${via} to open ${nice(t)}`];
  }
  const a = areaOfTab(id);
  if (!a) return null;
  // the Me sheet's row: your initial, then the row (two taps, the same as the bar and a card)
  if (a.id === 'me' && rowOf(id)) return ['tap your initial (top right)', `tap ${rowOf(id).label} on the Me sheet`];
  return [`tap ${a.title} in the house (the bar in Glass)`, `tap its card${t.cardTo ? ` (opens ${t.cardTo.replace('?', ' on its ')})` : ''}`];
}

const SCREENS = S.appItems({ tabs: tabs.map((t) => ({ id: t.id })), hubs: [...hubCards] }).filter((i) => i.kind === 'screen').map((i) => i.screen);
const table = SCREENS.map((id) => ({ id, path: pathOf(id) }));

test('the screens of the catalogue are the screens of the code (the table below is every one)', () => {
  assert.deepEqual([...SCREENS].sort(), tabs.map((t) => t.id).sort());
  assert.ok(SCREENS.length >= 48, `${SCREENS.length} screens`);
});

test('THE RULE: every screen is at most three taps from Home, by visible things (the table is printed)', () => {
  const lines = table.map(({ id, path }) => `${id.padEnd(11)} ${path ? path.length : '?'} taps  ${path ? ['Home', ...path].join(' > ') : 'NOT ON ANY VISIBLE LIST'}`);
  console.log(`finding: screen -> taps -> path (from Home), ${table.length} screens\n${lines.join('\n')}`);
  const longest = Math.max(...table.map((x) => x.path?.length ?? 99));
  const by = [0, 1, 2, 3].map((n) => `${table.filter((x) => x.path?.length === n).length} at ${n}`).join(', ');
  console.log(`finding: ${by}; the longest path is ${longest} taps (${table.filter((x) => x.path?.length === longest).map((x) => x.id).join(', ')})`);
  const none = table.filter((x) => !x.path).map((x) => x.id);
  assert.deepEqual(none, [], `on no visible list: ${none.join(', ')}`);
  const over = table.filter((x) => x.path.length > 3).map((x) => `${x.id} ${x.path.length} taps`);
  assert.deepEqual(over, [], `over the rule (three taps): ${over.join(', ')}`);
});

test('every screen is on a visible list: a hub card, the Me sheet, the Every screen deck, or inside a screen that is', () => {
  for (const t of tabs.filter((x) => !x.hub && x.id !== 'core')) {
    if (t.inside) {
      assert.ok(byId.get(t.inside) && !byId.get(t.inside).inside, `${t.id} sits inside ${t.inside}, which is not a screen of its own`);
      continue;
    }
    assert.ok(areaOfTab(t.id), `${t.id} is on no area's hub`);
    const area = areaOfTab(t.id);
    if (area.id === 'me') assert.ok(rowOf(t.id), `${t.id} is under Me but has no row on the Me sheet`);
    assert.ok(deckOf(t.id), `${t.id} is not in a group of Every screen`);
  }
  for (const a of D.AREAS) for (const id of a.tabs) assert.ok(byId.has(id), `${a.id} lists ${id}, which is no screen`);
  for (const r of D.ME_ROWS) if (r.id !== 'deck' && r.id !== 'origin') assert.ok(byId.has(r.id), `the Me sheet's row ${r.id} opens no screen`);
  // the two inside another each have their one row, said where it is
  const settings = read('features/settings/index.ts');
  assert.match(settings, /goRow\('THE LOOK', 'look'/, "Settings has THE LOOK's row");
  assert.match(settings, /id: 'appearance', label: 'Appearance', match: \/\^\(THEME\|THE LOOK/, "THE LOOK's row is under Settings' first pill, the one it opens on");
  assert.match(read('features/library/index.ts'), /cardTo: 'library\?shelf'/, "the Library's card opens the Shelf, where the books are");
  // THE LAB sits inside the Workshop: one row, under the Workshop's first pill (Build), which it opens on (the Scan's rooms hold eight things at most)
  const workshop = read('features/workshop/index.ts');
  assert.match(workshop, /panel\('THE LAB'/, "the Workshop has THE LAB's row");
  assert.match(workshop, /id: 'build', label: 'Build', match: \/\^\(TELL GHOSTY\|PROJECTS\|THE LAB\)\//, "THE LAB's row is under the Workshop's first pill");
});

test('every screen is one typed word in the jump bar (the word is typed into the bar\'s own ranking; its row is on the first screenful)', () => {
  const cmds = tabs.map((t) => R.tabCommand(t, K.DECK, () => undefined));
  const ask = (q) => ({ id: 'ask', title: `Ask Ghosty: ${q}`, group: 'ASK', run: () => undefined });
  const used = [];
  const bad = [];
  for (const t of tabs) {
    const name = K.DECK[t.id]?.name ?? nice(t);
    // the screen's own name, a word of it, or its title: the first single word that puts its row on the first screenful
    const candidates = [...new Set([name, ...name.split(/\s+/).sort((a, b) => b.length - a.length), t.title, nice(t), t.id].map((w) => w.toLowerCase().replace(/[“”"’']/g, '')).filter((w) => w && !/\s/.test(w) && w.length > 1))];
    const found = candidates.find((w) => {
      const rows = R.rankRows(cmds, w, { extra: [ask(w)] });
      const i = rows.findIndex((c) => c.id === `tab_${t.id}`);
      return i >= 0 && i < 6 && rows.filter((c) => c.group === 'GO').findIndex((c) => c.id === `tab_${t.id}`) < 3;
    });
    if (found) used.push(`${t.id}: "${found}"`);
    else bad.push(`${t.id} (tried ${candidates.join(', ')})`);
  }
  console.log(`finding: one typed word for every screen; ${used.length} of ${tabs.length} found:\n${used.join('  ')}`);
  assert.deepEqual(bad, [], `no single typed word puts these on the first screenful: ${bad.join('; ')}`);
});

test('recents and favourites are two taps: tap the search, tap the row (the first rows, his pins first, six at most, then his recents)', () => {
  const cmds = tabs.map((t) => R.tabCommand(t, K.DECK, () => undefined));
  const row = (t, group) => ({ id: `tab_${t.id}`, title: nice(t), group, run: () => undefined });
  const screens = tabs.filter((t) => !t.hub && t.id !== 'core');
  // every screen, pinned alone, is the first row
  for (const t of screens) {
    const rows = R.rankRows(cmds, '', { rec: [row(t, 'FAVOURITES')] });
    assert.equal(rows[0].id, `tab_${t.id}`, `${t.id} pinned is not the first row`);
    assert.equal(rows[0].group, 'FAVOURITES');
  }
  // six pins, then four recents: all ten on the first screenful of twelve rows, in his order
  const pins = screens.slice(3, 9).map((t) => row(t, 'FAVOURITES'));
  const lately = screens.slice(10, 14).map((t) => row(t, 'RECENT'));
  const rows = R.rankRows(cmds, '', { rec: [...pins, ...lately] });
  assert.deepEqual(rows.slice(0, 10).map((c) => c.id), [...pins, ...lately].map((c) => c.id), 'his pins in his order, then his recents, first');
  // and the code behind it: six at most, kept in his settings, listed first by the bar, pinned by a long press from the three lists
  assert.match(read('shell/favourites.ts'), /MAX_FAVOURITES = 6/);
  assert.match(read('state/app.ts'), /favourites: string\[\];/, 'kept in ghosty.settings');
  assert.match(read('state/app.ts'), /persist: 'ghosty\.settings'/);
  const areas = read('shell/areas.ts');
  assert.ok(areas.indexOf("'FAVOURITES'") > 0 && areas.indexOf("'FAVOURITES'") < areas.indexOf("'RECENT'"), "FAVOURITES come before RECENT in the bar's rows");
  assert.match(areas, /pinOnHold\(el, id\)/, 'a hub card pins on a long press');
  assert.match(read('shell/launcher.ts'), /pinOnHold\(b, t\.id\)/, 'a deck card pins on a long press');
  assert.match(read('shell/areas.ts'), /hold: \(c, el\) => pinOnHold/, 'a jump-bar row pins on a long press');
  assert.match(read('shell/favourites.ts'), /key\(pinned \? 'UNPIN' : 'PIN'/, "the Machine's key says PIN or UNPIN");
  assert.ok(S.APP_WIDE.some((a) => a.id === 'favourites'), 'said in the catalogue');
});

test('the Abilities page is not a way in: no tab, no row, no card, no deck card, no catalogue screen', () => {
  assert.ok(!byId.has('abilities'), 'a tab called abilities');
  assert.ok(!D.AREAS.some((a) => a.tabs.includes('abilities')), "an area's hub lists it");
  assert.ok(!D.ME_ROWS.some((r) => r.id === 'abilities'), 'the Me sheet has its row');
  assert.ok(!K.DECK_GROUPS.some(([, ids]) => ids.includes('abilities')), 'Every screen has its card');
  assert.ok(!hubCards.has('abilities'), 'a hub card');
  assert.ok(!SCREENS.includes('abilities'), "the catalogue's screen:abilities");
});

// ---------------------------------------------------------------- THE HOUSE AND ITS PLAN (BRIEF-SHELL-2): one list for the plan, a room, Every screen and this test
test('THE PLAN: seven rooms, every thing numbered 01, 02, 03 in its room, from the one list (shell/rooms.ts); all 53 screens are on it or inside it', () => {
  assert.deepEqual(RM.ROOMS.map((r) => r.title), ['HOME', 'SEE', 'MAKE', 'LEARN', 'PLAN', 'LIFE', 'ME']);
  const counts = Object.fromEntries(RM.ROOMS.map((r) => [r.key, r.things.length]));
  assert.deepEqual(counts, { home: 1, see: 3, make: 13, learn: 8, plan: 4, life: 8, me: 7 });
  for (const r of RM.ROOMS) assert.deepEqual(r.things.map((t) => t.n), r.things.map((_, i) => i + 1), `${r.key} is numbered 01, 02, 03 in order`);
  // the things are the screens of the areas (hub order), plus the two things under ME that are not screens of their own
  for (const a of D.AREAS) {
    const room = RM.ROOMS.find((r) => r.area === a.id);
    const screens = room.things.filter((t) => t.screen).map((t) => t.screen);
    assert.deepEqual(screens, a.tabs.filter((t) => t !== 'core'), `${a.id}'s room lists its area's screens in the hub's order`);
  }
  assert.deepEqual(RM.ROOMS.find((r) => r.key === 'me').things.filter((t) => !t.screen).map((t) => t.id), ['origin', 'deck']);
  // every screen of the catalogue is on the plan: a thing (35), a room's own key (Home, and the six hubs), or inside another screen (THE LOOK, the reader)
  const onPlan = new Set([...RM.THINGS.map((t) => t.screen).filter(Boolean), 'core', ...RM.ROOMS.map((r) => r.screen), ...Object.keys({ look: 1, reader: 1, lab: 1 })]);
  const missing = SCREENS.filter((id) => !onPlan.has(id) && !byId.get(id)?.hub);
  assert.deepEqual(missing, [], `screens on no plan: ${missing.join(', ')}`);
  assert.equal(SCREENS.length, 53, 'the 53 screens (the interpreter, the lab and REHEARSE joined on 11 Nov; Spreadsheets, Presentations, the Workspace, Photo and Video with their landings)');
  assert.equal(RM.THINGS.length, 44, 'forty-four numbered things: the 42 screens of the rooms, the origin and Every screen');
  console.log(`plan: 7 rooms, ${RM.THINGS.length} numbered things (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}); with the 7 room keys, THE LOOK and the reader all ${SCREENS.length} screens are on it`);
  // each thing has one name, said as in the mock
  assert.deepEqual(RM.ROOMS.find((r) => r.key === 'learn').things.map((t) => t.name), ['Courses', 'Arcade', 'Gym', 'School', 'Library', 'Learning', 'Coach', 'Rehearse']);
  assert.equal(RM.thingName('homeadmin'), 'Household');
});

test('a number said or typed: "two", "open two", "02", "the second one" and "learn 5" are numbers; a word is not', () => {
  for (const [t, n] of [['2', 2], ['02', 2], ['two', 2], ['open two', 2], ['Open Two.', 2], ['number 3', 3], ['the second one', 2], ['go to seven', 7], ['ten', 10]]) assert.equal(RM.numberIn(t), n, `"${t}"`);
  for (const t of ['radio', 'open the radio', 'two hundred', 'play two songs', '', 'open']) assert.equal(RM.numberIn(t), null, `"${t}" is not a number`);
  assert.deepEqual([RM.roomNumberIn('learn 5')?.room.key, RM.roomNumberIn('learn 5')?.n], ['learn', 5]);
  assert.equal(RM.roomNumberIn('open plan four')?.n, 4);
  assert.equal(RM.roomNumberIn('learn 5')?.room.things[4].id, 'library');
  assert.equal(RM.roomNumberIn('radio'), null);
});

test('the house is drawn from that one list on every screen: the plan, the jump bar, a room and Every screen read it, and Glass keeps its own', () => {
  const house = read('shell/house.ts');
  assert.match(house, /import \{ ROOMS, roomOf/, 'the plan reads the rooms');
  // (the width is read on a resize, not at every call: `innerWidth` forces a layout and the house asks on every screen it enters)
  assert.match(house, /narrow && \['scan', 'ink', 'map', 'eye', 'orbit'\]\.includes\(document\.documentElement\.dataset\.world \?\? ''\)/, 'the house is The Scan, The Map, The Eye, One Ink or Orbit on a phone, and only those');
  assert.match(house, /narrow = innerWidth < 900/, 'a phone is under 900 px, read when the window resizes');
  assert.match(house, /The house · 7 rooms/);
  assert.match(read('shell/launcher.ts'), /for \(const r of ROOMS\)/, 'Every screen lists the rooms');
  assert.match(read('shell/areas.ts'), /const room = ROOMS\.find\(\(r\) => r\.area === a\.id\)/, 'a hub draws its room from the same list');
  assert.match(read('shell/areas.ts'), /^ {2}jump,$/m, 'the palette hands the jump bar its drawing');
  assert.match(read('commands/registry.ts'), /decor\?\.jump\?\.on\(\)/, 'and draws it only when the Scan is on');
  // Settings: every panel keeps its row (a panel no group names goes in a last group)
  assert.match(read('shell/scanlist.ts'), /title: 'More'/);
});

// ---------------------------------------------------------------- THE FINDING RULE IN EVERY WORLD (BRIEF-ONE-INK, BRIEF-ORBIT-HUD): The Scan, One Ink, Orbit, Glass (The Map and The Eye keep today's bar until their own shells land)
// The rule is proved above on the lists (the bar's areas, a hub's cards, the Me sheet, the deck, the jump bar's ranking); what each world adds is
// only HOW the lists are drawn and reached, so the way in is checked per world from the code that draws it: every screen is still on a visible
// list (a room is a key in the bar, its things are the room's cards: two taps), recents and favourites are two taps, and a typed word finds the rest.
test('the finding rule holds in all seven worlds: The Scan, The Map, The Eye, One Ink, Orbit, Grown Up and Glass reach the same lists (two taps for recents and favourites, three or one typed word for the rest)', () => {
  const house = read('shell/house.ts');
  const areas = read('shell/areas.ts');
  const ink = read('features/core/ink/home.ts');
  const orbit = read('shell/orbit.ts');
  const orbitHome = read('features/core/orbit/home.ts');
  const css = readFileSync(join(web, '../styles.css'), 'utf8');
  const worlds = {
    scan: { housed: /'scan'/.test(house), keys: 'the house along the bottom' },
    map: { housed: /'map'/.test(house) && /scaleOn/.test(house), keys: 'the scale' },
    eye: { housed: /'eye'/.test(house) && /eyeOn/.test(house), keys: 'the instruments' },
    ink: { housed: /=== 'ink'/.test(house), keys: 'the foot' },
    orbit: { housed: /=== 'orbit'/.test(house), keys: 'the orb and its line' },
    grown: { housed: /export const grownOn = /.test(house) && /=== 'grown'/.test(house), keys: 'the capsule and THE ROOMS layer' },
    glass: { housed: !/=== 'glass'/.test(house), keys: "today's bar" },
  };
  // the seven keys: the one bar is built once from the areas (six) and the house's ME key joins in the two housed worlds; Glass keeps its six
  assert.match(areas, /for \(const a of AREAS\.filter\(\(x\) => x\.id !== 'me'\)\)/, 'the bar is the areas, six keys, in every world');
  assert.match(house, /const meKey = h\('button\.scanme'/, 'the seventh room, ME, joins the bar in the housed worlds');
  assert.match(css, /html body:not\(\.housed\) #dock \.tabcap \.scanme \{ display: none; \}/, 'and Glass has no ME key in its bar');
  assert.ok(worlds.scan.housed && worlds.map.housed && worlds.eye.housed && worlds.ink.housed && worlds.orbit.housed && worlds.grown.housed && worlds.glass.housed, JSON.stringify(worlds));
  // each room's hub lists its things (the same cards), in all three: a room is one tap from Home, its thing the second
  assert.match(areas, /const room = ROOMS\.find\(\(r\) => r\.area === a\.id\)!/, "a room's hub is drawn from the one list in every world");
  // recents and favourites: THE SCAN's and Glass's jump bar read pinnedAndRecent; ONE INK's Home lists the same two as words (a tap opens: two taps from Home, one from the page)
  assert.match(areas, /export function pinnedAndRecent\(\)/, 'the jump bar and ONE INK read one pair of lists');
  assert.match(areas, /const \{ pinned, lately \} = pinnedAndRecent\(\);/, "the jump bar's rows come from it");
  assert.match(ink, /pinnedAndRecent\(\)/, "ONE INK's Home lists them as words");
  assert.match(ink, /pinOnHold\(b, t\.id\)/, 'a long press on one of its words pins or unpins it');
  assert.match(ink, /field\.addEventListener\('click', \(\) => togglePalette\(\)\)/, "ONE INK's ask line is the jump bar, one typed word for anything");
  // the plan: THE SCAN's house label opens it, ONE INK's eye opens it on a long press and "the plan" typed, both from the one rooms list
  assert.match(areas, /if \(footOn\(\) && a\.id === 'ask'\) return void housePlan\(\)\?\.open\(\)/, "ONE INK's eye held opens the plan");
  assert.match(areas, /\(\?:plan\|house\)\$\/i\.test\(text\.trim\(\)\)/, '"the plan" typed in the jump bar opens it');
  // ONE INK's foot has no label row and no second ask line, and nothing else in the house is kept twice
  assert.match(css, /html\[data-world="ink"\] #dock :is\(\.housekick, \.houseask\) \{ display: none !important; \}/, "ONE INK's foot has no label row and no ask line");
  assert.ok(!/class .*inkfoot|buildFoot|inkRooms/.test(ink + house), 'one source: the foot is the house, not a copy');
  // THE MAP: the house is its scale (the same seven keys as ticks on a ruler), its Home lists the same two as cells of the square of nine
  // (a tap opens, a long press pins) and as districts it reaches every room; its ask line is the jump bar; the plan opens from the same kick
  const map = read('features/core/map/home.ts');
  assert.match(map, /pinnedAndRecent\(\)/, "THE MAP's square lists his recents and favourites");
  assert.match(map, /pinOnHold\(b, t\.id\)/, 'a long press on one of its cells pins or unpins it');
  assert.match(map, /field\.addEventListener\('click', \(\) => togglePalette\(\)\)/, "THE MAP's ask line is the jump bar, one typed word for anything");
  assert.match(map, /ROOMS\.filter\(\(r\) => r\.key !== 'home'\)/, "THE MAP's districts are the rooms of the one list");
  assert.match(css, /html\[data-world="map"\] body\.maphome #dock \.houseask \{ display: none; \}/, "THE MAP's Home draws its own ask line");
  assert.ok(!/class .*mapscale|buildScale|mapRooms/.test(map + house), 'one source: the scale is the house, not a copy');
  // THE EYE: the house is its instruments (the same seven keys as seven small feeds), its Home lists the same two as feeds at the edge of its attention
  // (a tap opens, a long press pins); the rooms are feeds that reach every room; its ask line is the jump bar; the plan opens from the same kick
  const eye = read('features/core/eye/home.ts');
  assert.match(eye, /pinnedAndRecent\(\)/, "THE EYE's wall lists his recents and favourites");
  assert.match(eye, /pinOnHold\(b, t\.id\)/, 'a long press on one of its feeds pins or unpins it');
  assert.match(eye, /field\.addEventListener\('click', \(\) => togglePalette\(\)\)/, "THE EYE's ask line is the jump bar, one typed word for anything");
  assert.match(eye, /ROOMS\.filter\(\(r\) => r\.key !== 'home'\)/, "THE EYE's room feeds are the rooms of the one list");
  assert.match(css, /html\[data-world="eye"\] body\.eyehome #dock \.houseask \{ display: none; \}/, "THE EYE's Home draws its own ask line");
  assert.ok(!/class .*eyebar|buildInstruments|eyeRooms/.test(eye + house), 'one source: the instruments are the house, not a copy');
  // ORBIT has no bar: the six rooms are the orb's fan (hold, slide, let go: a room's hub) and the stations on Home's ring (one tap), the bar's keys stay in the DOM
  // for the lists above and are not drawn; recents and favourites are the orb pressed (the typed word: pinnedAndRecent) and Home's capsule (one tap on Home), a typed word
  // finds the rest, and the plan is a tap on the line's left end
  assert.match(orbit, /export const ORBIT_ROOMS: Area\[\] = AREAS\.filter\(\(a\) => a\.id !== 'ask'\)/, "the orb's six rooms are the areas, one source");
  assert.match(orbit, /navTo\(roomHub\(a\), 'switch'\)/, 'a room on the fan opens its hub');
  assert.match(orbit, /sw\.open\(orb, 'Rooms', list, \{[^}]*stay: false/, 'the fan opens from the held orb and a let-go on none is nothing');
  assert.match(orbit, /export function pressOrb\(\): void \{[\s\S]*togglePalette\(\)/, 'a press on the orb is the typed word (the jump bar: his Recent and Starred, then what was found)');
  assert.match(orbit, /plan\.addEventListener\('click', \(\) => housePlan\(\)\?\.toggle\(\)\)/, "the plan is a tap on the line's left end");
  assert.match(orbitHome, /pinnedAndRecent\(\)/, "ORBIT's Home lists his recents and favourites in its capsule, from the same two lists");
  assert.match(orbitHome, /pinOnHold\(b, t\.id\)/, 'a long press on a capsule item pins or unpins it');
  assert.match(orbitHome, /navTo\(roomHub\(a\), 'push'\)/, 'a station opens its room: one tap from Home');
  assert.match(areas, /isHub\(tab\)\) return orbitOn\(\)/, 'a hub has its way back to Home where there is no Home key');
  assert.match(css, /html\[data-world="orbit"\] body\.housed #dock :is\(\.tabblur, \.tabcap, \.housekick, \.houseask\) \{ display: none !important; \}/, "ORBIT draws no bar, no label row and no ask line");
  // GROWN UP has one capsule on every screen (the rooms key, the one field, the small Mind): THE ROOMS layer is the plan and the deck folded in, so recents and
  // favourites are two taps from anywhere (the field's jump bar, or Home's chips: one), any screen is two (the rooms key, its chip) and any ability is a word in the field
  const capsule = read('shell/capsule.ts');
  const drops = read('shell/drops.ts');
  const grownHome = read('features/core/grown/home.ts');
  assert.match(capsule, /rooms\.addEventListener\('click', \(\) => housePlan\(\)\?\.toggle\(\)\)/, 'the rooms key opens THE ROOMS layer (the plan)');
  assert.match(capsule, /field\.addEventListener\('click', \(\) => \{[\s\S]*togglePalette\(\)/, 'the one field is the jump bar: recents and favourites first, a typed word finds the rest');
  assert.match(capsule, /switchItems\(a\)/, "the small Mind's hold fans the room's tools (the quick switcher)");
  assert.match(house, /const layerChip = /, "THE ROOMS layer's screens are chips");
  assert.match(house, /const things = r\.things\.filter\(\(t\) => t\.id !== 'deck'\)/, 'every room lists its screens (the one list), the deck being the layer itself');
  assert.match(house, /pinnedAndRecent\(\)/, 'recent and starred are on top of the layer, from the deck\'s two lists');
  assert.match(house, /if \(t\.id === 'deck'\) return grownOn\(\) \? thePlan\?\.open\(\) : deckOpener\(\)/, 'Every screen is THE ROOMS layer in this world');
  assert.match(grownHome, /pinnedAndRecent\(\)/, "GROWN UP's Home lists his recents and favourites as chips, from the same two lists");
  assert.match(grownHome, /pinOnHold\(b, t\.id\)/, 'a long press on a chip pins or unpins it');
  assert.match(grownHome, /dots\.addEventListener\('click', \(\) => housePlan\(\)\?\.open\(\)\)/, 'the three dots are THE ROOMS layer: the rest is two taps');
  assert.match(areas, /isHub\(tab\)\) return orbitOn\(\) \|\| grownOn\(\)/, 'a hub has its way back to Home where there is no Home key');
  assert.match(css, /html\[data-world="grown"\] body\.grown #dock :is\(\.tabblur, \.tabcap, \.housekick, \.houseask\) \{ display: none !important; \}/, 'GROWN UP draws no tab bar, no label row and no ask line: the capsule is the one bar');
  // what each dense screen drops is folded, never removed: its key is one tap and the things keep their place
  assert.match(drops, /els\[0\]!\.before\(holder\)/, 'a dropped thing keeps its place: the key stands before it');
  assert.match(css, /\[data-gdrop\]\[data-gstate="closed"\] \{ display: none !important; \}/, 'a dropped thing is only closed');
  for (const id of ['gym', 'school', 'library', 'eye', 'settings', 'system']) assert.match(drops, new RegExp(`tab: '${id}'`), `${id} drops one thing into a fold`);
  // every screen is a thing on the plan (the rule's own test above), so in each world a screen is reached by its room's key and its card, or by its word
  const per = Object.keys(worlds).map((w) => `${w}: ${worlds[w].keys}`).join('; ');
  console.log(`finding in all seven worlds: ${per}; ${RM.THINGS.length} things on one list; recents and favourites two taps in each`);
});
