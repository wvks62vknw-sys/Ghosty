// THE EVERYTHING TAB (BRIEF-EVERYTHING; OWNER-ISSUES 92 ①): every single thing Ghosty can do is in the catalogue
// (packages/shared/src/catalogue.ts), GENERATED from the registries the code runs on, never written as a claim.
//  - every registry item has its words, and every word entry has its registry item (nothing missing, nothing stale) —
//    the brain's: every tool in TOOLS, Telegram's commands and what it does there, the no-model asks, the jobs on the
//    clock; the phone's: every screen, every panel and section (pill) in the screens' source, the deck's lines, the Lens's modes, the GYM's
//    games, SCHOOL's stages, the Workbench's modes, the studio's samples and panes, the chat's controls and phrases, the
//    Me sheet, the hub cards, the themes, the moods; a `same` always lands on an entry of its own;
//  - his words keep the rules: one line of at most 140 characters starting "I " or "You ", no tool name and no code word
//    anywhere he reads, an explanation, one to four ways to say it, a scene; every entry has a TRY IT that lands on a
//    screen this build has, a panel that screen has, a command the app registers, or words for the chat;
//  - every tool group has its WHY I MIGHT USE IT MYSELF; GET /api/abilities serves the brain's items, a missing key said;
//  - the counts are printed (tools, screens, panels, phrases, games, modes, entries).
// Bundles are built here, with esbuild's API, like school.test.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const at = (p) => new URL(p, import.meta.url).pathname;
const web = at('../../web/src');
await build({
  entryPoints: [at('../src/abilities.ts'), at('../src/tools/index.ts'), at('../../web/src/abilities/sources.ts'), at('../../../packages/shared/src/catalogue.ts'), at('../../web/src/features/workbench/panels.ts'), at('../src/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  external: ['cloudflare:sockets'],
  outdir: at('./.build/catalogue'),
  outbase: at('../../..'),
  outExtension: { '.js': '.mjs' },
  logLevel: 'warning',
});
const load = (f) => import(`./.build/catalogue/${f}.mjs`);
const A = await load('apps/edge/src/abilities');
const T = await load('apps/edge/src/tools/index');
const S = await load('apps/web/src/abilities/sources');
const C = await load('packages/shared/src/catalogue');
const B = await load('apps/web/src/features/workbench/panels');
const brain = await load('apps/edge/src/index');

// ---------------------------------------------------------------- the registries, read from the code

/** The phone's tabs: features/index.ts TABS, each feature's own id, and the hubs (shell/areadefs.ts AREAS). */
function tabsOfSource() {
  const idx = readFileSync(join(web, 'features/index.ts'), 'utf8');
  const imports = Object.fromEntries([...idx.matchAll(/import \{ (\w+) \} from '\.\/(\w+)';/g)].map((m) => [m[1], m[2]]));
  const names = /TABS: TabDef\[\] = \[([^\]]*)\]/.exec(idx)[1].split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('...'));
  assert.ok(names.length >= 20, `TABS read from features/index.ts: ${names.join(', ')}`);
  const tabs = names.map((n) => {
    assert.ok(imports[n], `TABS' ${n} is imported from a feature folder`);
    const m = /TabDef = \{\s*id: '([^']+)'/.exec(readFileSync(join(web, 'features', imports[n], 'index.ts'), 'utf8'));
    assert.ok(m, `features/${imports[n]}/index.ts names its tab's id`);
    return { id: m[1] };
  });
  assert.match(idx, /\.\.\.HUB_TABS\]/, 'the hubs are the last of TABS');
  for (const m of readFileSync(join(web, 'shell/areadefs.ts'), 'utf8').matchAll(/\{ id: '(\w+)', title: '/g)) tabs.push({ id: `area-${m[1]}` });
  return tabs;
}
/** The hub cards: shell/hubcards.ts CARDS, by their keys. */
function hubsOfSource() {
  const src = readFileSync(join(web, 'shell/hubcards.ts'), 'utf8');
  return [...src.slice(src.indexOf('export const CARDS')).matchAll(/^ {2}([a-z0-9]+): \{$/gm)].map((m) => m[1]);
}
/** Every panel the screens make, by its literal title (features/<screen>/…), and the Workbench's from its PANELS list. */
function panelsOfSource() {
  const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
  const out = new Set();
  for (const f of walk(join(web, 'features')).filter((f) => f.endsWith('.ts'))) {
    const screen = f.slice(join(web, 'features').length + 1).split('/')[0];
    for (const m of readFileSync(f, 'utf8').matchAll(/\bpanel\(\s*(['"`])((?:(?!\1).)*)\1/g)) out.add(`panel:${screen}:${m[2]}`);
  }
  for (const p of B.PANELS) out.add(`panel:workbench:${p.title}`);
  return out;
}
/** Every screen's sections (its pills): the `sections(root, '<screen>', [...])` list in features/<screen>/index.ts. */
function sectionsOfSource() {
  const out = new Set();
  for (const d of readdirSync(join(web, 'features'))) {
    const f = join(web, 'features', d, 'index.ts');
    if (!statSync(join(web, 'features', d)).isDirectory() || !readdirSync(join(web, 'features', d)).includes('index.ts')) continue;
    for (const m of readFileSync(f, 'utf8').matchAll(/\bsections\(\s*root,\s*'([^']+)',\s*\[([\s\S]*?)\]\s*\)/g)) {
      for (const s of m[2].matchAll(/\bid: '([^']+)'/g)) out.add(`section:${m[1]}:${s[1]}`);
    }
  }
  return out;
}

const tabs = tabsOfSource();
const hubs = hubsOfSource();
const brainItems = A.brainItems(() => true);
const appItems = S.appItems({ tabs, hubs });
const items = [...brainItems, ...appItems];
const toolNames = T.TOOLS.map((t) => t.name);
const screenName = (id) => ({ core: 'Home', eye: 'God’s eye', area: '' })[id] ?? id;
const joined = C.joinCatalogue(items, { screenName });

// ---------------------------------------------------------------- every item has its words, every word its item

test('every registry item, brain and phone, has its words in the catalogue (nothing he can do is missing)', () => {
  assert.deepEqual(joined.missing, [], `with no words: ${joined.missing.join(', ')}`);
  // every tool in TOOLS is an item of its own, under its group
  const tools = brainItems.filter((i) => i.kind === 'tool');
  assert.deepEqual(tools.map((i) => i.id.slice(5)).sort(), [...toolNames].sort(), 'every tool of TOOLS is an item, once');
  const grouped = new Map(T.TOOL_GROUPS.flatMap((g) => g.tools.map((t) => [t.name, g.name])));
  for (const i of tools) assert.equal(i.group, grouped.get(i.id.slice(5)) ?? 'extra', `${i.id}: its group`);
  // ids are unique across every registry
  const ids = items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, `an id twice: ${ids.filter((x, k) => ids.indexOf(x) !== k).join(', ')}`);
});

test('every word entry has its registry item, and a same lands on an entry of its own (nothing stale, nothing claimed)', () => {
  const ids = new Set(items.map((i) => i.id));
  const stale = Object.keys(C.CATALOGUE).filter((k) => !ids.has(k));
  assert.deepEqual(stale, [], `words with no registry item: ${stale.join(', ')}`);
  for (const [k, v] of Object.entries(C.CATALOGUE)) {
    if (!('same' in v)) continue;
    const to = C.CATALOGUE[v.same];
    assert.ok(to && !('same' in to), `${k}: same as ${v.same}, which is not an entry of its own`);
    assert.notEqual(v.same, k, `${k} is the same as itself`);
  }
});

test('the panels in the catalogue are exactly the panels in the screens’ source, both ways', () => {
  const src = panelsOfSource();
  const keys = new Set(Object.keys(C.CATALOGUE).filter((k) => k.startsWith('panel:')));
  assert.deepEqual([...src].filter((p) => !keys.has(p)), [], 'panels with no words');
  assert.deepEqual([...keys].filter((k) => !src.has(k)), [], 'words for panels no screen makes');
  // and each panel's screen is a tab this build has
  const have = new Set(tabs.map((t) => t.id));
  for (const k of keys) assert.ok(have.has(k.split(':')[1]), `${k}: no such screen`);
});

test('the sections (each screen’s pills) are exactly the screens’ own lists, both ways, and each is a panel of its screen', () => {
  const src = sectionsOfSource();
  assert.ok(src.size >= 40, `sections read from the screens' source: ${[...src].join(', ')}`);
  const keys = new Set(Object.keys(C.CATALOGUE).filter((k) => k.startsWith('section:')));
  assert.deepEqual([...src].filter((s) => !keys.has(s)), [], 'sections with no words');
  assert.deepEqual([...keys].filter((k) => !src.has(k)), [], 'words for sections no screen has');
  for (const k of keys) {
    assert.ok('same' in C.CATALOGUE[k], `${k}: a pill is the panel it opens on (same), not an entry of its own`);
    const e = joined.entries.find((x) => x.items.includes(k));
    assert.ok(e, `${k}: on no entry`);
    // it lands on a panel of its own screen (Settings' Ghosty pill holds the two rows that open SYSTEM and LINKS)
    const screen = k.split(':')[1];
    assert.ok(e.items.some((i) => i.startsWith(`panel:${screen}:`)) || (k === 'section:settings:ghosty' && e.id === 'screen:system'), `${k}: lands on ${e.id}, not a panel of ${screen}`);
  }
});

// ---------------------------------------------------------------- his words

test('his words: one line of 140 at most starting "I " or "You ", no tool name or code word he can read, an explanation, ways to say it', () => {
  const problems = Object.entries(C.CATALOGUE).filter(([, v]) => !('same' in v)).flatMap(([k, v]) => C.wordProblems(k, v, toolNames));
  assert.deepEqual(problems, []);
  // the same rules hold for every word he sees on the tab, made ones too (TRY IT's label, where it lives, why)
  const code = /\b[a-z]+_[a-z0-9_]+\b/;
  for (const e of joined.entries) {
    for (const s of [e.tryLabel, e.where, e.why ?? '', ...(e.needs ?? []).map((n) => C.NEEDS[n].words)]) {
      assert.doesNotMatch(s, code, `${e.id}: "${s}"`);
      for (const t of toolNames) if (t.includes('_')) assert.ok(!s.toLowerCase().includes(t), `${e.id}: the tool name ${t} in "${s}"`);
    }
    assert.ok(e.line.length <= 140 && /^(?:I|You) /.test(e.line), `${e.id}: "${e.line}"`);
    assert.ok(e.say.length >= 1, `${e.id}: no way to say it`);
    assert.ok(e.go && (('open' in e.go) || ('run' in e.go) || ('ask' in e.go && e.go.ask.trim())), `${e.id}: no TRY IT`);
    assert.match(e.since, /^2026-\d\d-\d\d$/, `${e.id}: since ${e.since}`);
    assert.ok(Date.parse(e.since) <= Date.now(), `${e.id}: since ${e.since} is in the future`);
    assert.ok(e.scene.every((s) => C.SCENES.some((x) => x.id === s)), `${e.id}: a scene that is not one: ${e.scene}`);
    assert.ok(C.CATS.some((c) => c.id === e.cat), `${e.id}: the chip ${e.cat}`);
  }
});

test('every TRY IT lands somewhere real: a screen this build has, a panel that screen has, a command the app registers, or words', () => {
  const have = new Set(tabs.map((t) => t.id));
  const panelsOf = (screen) => Object.keys(C.CATALOGUE).filter((k) => k.startsWith(`panel:${screen}:`)).map((k) => k.split(':').slice(2).join(':').toUpperCase());
  // the commands the app registers (commands/builtin.ts, the launcher's, the Me sheet's)
  const cmdSrc = ['commands/builtin.ts', 'shell/launcher.ts', 'shell/areas.ts'].map((f) => readFileSync(join(web, f), 'utf8')).join('\n');
  const commands = new Set([...cmdSrc.matchAll(/\bid: '([a-z_0-9]+)'/g)].map((m) => m[1]));
  for (const e of joined.entries) {
    const g = e.go;
    if ('open' in g) {
      const screen = g.open.split('?')[0];
      assert.ok(have.has(screen), `${e.id}: TRY IT opens "${g.open}", which this build does not have`);
      if (g.panel) assert.ok(panelsOf(screen).some((p) => p.startsWith(g.panel.toUpperCase())), `${e.id}: TRY IT opens ${screen} on "${g.panel}", which it has no panel for`);
    } else if ('run' in g) assert.ok(commands.has(g.run), `${e.id}: TRY IT runs "${g.run}", which the app does not register`);
  }
});

test('WHY I MIGHT USE IT MYSELF: every tool group has its words, and nothing else has', () => {
  const groups = T.TOOL_GROUPS.filter((g) => g.tools.length).map((g) => g.name);
  assert.deepEqual(Object.keys(C.GROUP_WHY).sort(), [...groups].sort());
  for (const [g, w] of Object.entries(C.GROUP_WHY)) {
    assert.ok(w.length > 20 && w.length <= 160, `${g}: "${w}"`);
    assert.doesNotMatch(w, /\b[a-z]+_[a-z0-9_]+\b/, `${g}: a code word`);
  }
  // a brain tool's entry carries its group's words
  for (const e of joined.entries.filter((x) => x.kind === 'tool')) assert.ok(e.why, `${e.id}: no WHY I MIGHT USE IT MYSELF`);
});

test('a tool that needs a key says so, and its TRY IT goes to where the key is set', () => {
  const none = A.brainItems(() => false);
  const repo = none.find((i) => i.id === 'tool:propose_change');
  assert.match(repo.off, /GitHub token/);
  assert.deepEqual(repo.offGo, { open: 'system', panel: 'KEYS' });
  const j = C.joinCatalogue([...none, ...appItems], { screenName }).entries.find((e) => e.id === 'tool:propose_change');
  assert.deepEqual(j.go, { open: 'system', panel: 'KEYS' });
  assert.match(j.tryLabel, /^Set it up: needs a key/);
  // with the key, it is the words' own TRY IT
  assert.equal(joined.entries.find((e) => e.id === 'tool:propose_change').off, undefined);
});

test('GET /api/abilities serves every item of the brain’s registries for the phone to keep', async () => {
  const pending = [];
  const env = { MOCK_LLM: '1', VAULT_KEY: Buffer.alloc(32, 7).toString('base64') };
  const m = new Map();
  const storage = {
    async get(k) { return Array.isArray(k) ? new Map(k.filter((x) => m.has(x)).map((x) => [x, m.get(x)])) : m.get(k); },
    async put(k, v) { if (typeof k === 'object') for (const [a, b] of Object.entries(k)) m.set(a, b); else m.set(k, v); },
    async delete(k) { return Array.isArray(k) ? k.filter((x) => m.delete(x)).length : m.delete(k); },
    async list({ prefix = '' } = {}) { return new Map([...m].filter(([k]) => k.startsWith(prefix))); },
    async setAlarm() {}, async getAlarm() { return null; },
    sql: { exec: () => ({ toArray: () => [], one: () => null, raw: () => [] }) },
  };
  const agent = new brain.GhostyAgent({ storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() }, env);
  const r = await agent.fetch(new Request('https://ghosty.test/api/abilities', { headers: { 'x-ghosty-key': 'owner-key-for-tests-0123456789' } }));
  await Promise.allSettled(pending.splice(0));
  assert.equal(r.status, 200);
  const info = await r.json();
  assert.equal(info.catalogue.length, brainItems.length);
  assert.deepEqual(info.catalogue.map((i) => i.id).sort(), brainItems.map((i) => i.id).sort());
  // no keys on this brain: changing my own code says what it needs
  assert.match(info.catalogue.find((i) => i.id === 'tool:repo_tree').off, /GitHub token/);
});

// ---------------------------------------------------------------- the packs (BRIEF-PACKS-1)

test('every action of every pack is a registry item with its own words, its group’s WHY, and a TRY IT', () => {
  const packs = T.TOOL_GROUPS.filter((g) => g.short);
  assert.ok(packs.length >= 1, 'a pack group');
  for (const g of packs) {
    const acts = A.actionsOf(g.tools[0]);
    assert.ok(acts.length >= 12, `${g.name}: ${acts.length} actions`);
    for (const a of acts) {
      const id = `act:${g.name}:${a}`;
      assert.ok(brainItems.some((i) => i.id === id && i.kind === 'act' && i.group === g.name), `${id} is an item of its group`);
      assert.ok(C.CATALOGUE[id] && !('same' in C.CATALOGUE[id]), `${id} has words of its own`);
      const e = joined.entries.find((x) => x.id === id);
      assert.ok(e?.why && e.go, `${id}: WHY and TRY IT`);
    }
    // the pack's tool itself is the same entry as one of its actions (the tab lists the abilities, not the tool)
    assert.ok(C.CATALOGUE[`tool:${g.tools[0].name}`] && 'same' in C.CATALOGUE[`tool:${g.tools[0].name}`], `tool:${g.tools[0].name} lands on an action`);
  }
});

// ---------------------------------------------------------------- the counts

test('the counts (printed for the report): tools, screens, panels, phrases, games, modes, entries', () => {
  const n = (kind) => items.filter((i) => i.kind === kind).length;
  const counts = {
    tools: n('tool'),
    'pack actions': n('act'),
    groups: T.TOOL_GROUPS.filter((g) => g.tools.length).length,
    telegram: n('telegram'),
    'no-model asks': n('say'),
    jobs: n('job'),
    screens: n('screen'),
    panels: n('panel'),
    sections: n('section'),
    'deck lines': n('deck'),
    phrases: n('phrase'),
    'chat controls': n('chat'),
    games: n('game'),
    'lens modes': n('lens'),
    'workbench modes': B.PANELS.reduce((s, p) => s + p.modes.length, 0),
    stages: n('stage'),
    studio: n('studio'),
    'me sheet': n('me'),
    hubs: n('hub'),
    themes: n('theme'),
    moods: n('mood'),
    'app-wide': n('app'),
    'registry items': items.length,
    entries: joined.entries.length,
  };
  console.log(`catalogue counts: ${JSON.stringify(counts)}`);
  assert.equal(counts.tools, T.TOOLS.length);
  assert.ok(counts.entries >= 250, `${counts.entries} entries (the tab promises every single thing)`);
  assert.ok(counts.entries <= counts['registry items']);
});
