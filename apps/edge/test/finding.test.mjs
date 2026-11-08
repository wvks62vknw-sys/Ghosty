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
  entryPoints: [at('../../web/src/commands/rank.ts'), at('../../web/src/shell/areadefs.ts'), at('../../web/src/shell/deckcopy.ts'), at('../../web/src/abilities/sources.ts'), at('../../../packages/shared/src/catalogue.ts')],
  bundle: true, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], outdir: at('./.build/finding'), outbase: at('../../..'), outExtension: { '.js': '.mjs' }, logLevel: 'warning',
}).catch((e) => { throw new Error(`the finding test's bundle did not build (the jump bar's ranking must be a pure module, commands/rank.ts): ${e.message}`); });
const load = (f) => import(`./.build/finding/${f}.mjs`);
const R = await load('apps/web/src/commands/rank');
const D = await load('apps/web/src/shell/areadefs');
const K = await load('apps/web/src/shell/deckcopy');
const S = await load('apps/web/src/abilities/sources');

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
const deckOf = (id) => K.DECK_GROUPS.find(([, ids]) => ids.includes(id))?.[0];

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
    return [`tap ${D.AREAS.find((a) => `area-${a.id}` === id).title} in the bar`];
  }
  if (t.inside) {
    const parent = byId.get(t.inside);
    const via = parent.id === 'settings' ? 'the row' : 'a book';
    return [...pathOf(t.inside), `tap ${via} to open ${nice(t)}`];
  }
  const a = areaOfTab(id);
  if (!a) return null;
  // the Me sheet's row: your initial, then the row (two taps, the same as the bar and a card)
  if (a.id === 'me' && rowOf(id)) return ['tap your initial (top right)', `tap ${rowOf(id).label} on the Me sheet`];
  return [`tap ${a.title} in the bar`, `tap its card${t.cardTo ? ` (opens ${t.cardTo.replace('?', ' on its ')})` : ''}`];
}

const SCREENS = S.appItems({ tabs: tabs.map((t) => ({ id: t.id })), hubs: [...hubCards] }).filter((i) => i.kind === 'screen').map((i) => i.screen);
const table = SCREENS.map((id) => ({ id, path: pathOf(id) }));

test('the screens of the catalogue are the screens of the code (the table below is every one)', () => {
  assert.deepEqual([...SCREENS].sort(), tabs.map((t) => t.id).sort());
  assert.ok(SCREENS.length >= 45, `${SCREENS.length} screens`);
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
