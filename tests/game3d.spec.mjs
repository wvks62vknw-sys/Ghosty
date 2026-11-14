// THE APPS ROUND, MAKE LANE: GAME STUDIO 3D (docs/build-plan/APPS-MAKE.md), proved on the phone at 440 × 956 and 390 × 844.
//   LOGIC (L): the six templates and their when→then rules, worked by hand: a coin scores and goes, the flag wins, a fall costs a life,
//     the kart's goal stays shut until its three gates, every gem wins, the clock running out loses, a crate on a pad scores.
//   PLAY (P): a template plays in one tap on three.js and Rapier, under software rendering; the stick and JUMP are read at once; the
//     player reaching a coin and the flag scores and wins; PLAY AGAIN races the last run's ghost; the frame-rate guard holds detail down.
//   DESCRIBE (D): "a night platformer with 10 coins and low gravity" drafted as three marked changes, one rejected, the rest made.
//   EDIT (E): a thing added on the grid, moved and coloured; a rule added and said as a sentence; kept on the phone after a reload.
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const WORLDS = ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass'];
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 280)}`);
  }
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const on = (k) => !process.env.G3_ONLY || process.env.G3_ONLY.split(',').includes(k);
const RAW = /aborted|fetch failed|undefined|NaN|\[object Object\]|TypeError|NetworkError|Failed to|HTTP \d|SyntaxError|ReferenceError/i;
await standDown(base, KEY);

/** A source file of the app, bundled and imported: the page's own words and sums, read by the spec (pure files only). */
async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const live = [];
async function section(name, fn) {
  if (!on(name)) return;
  try {
    await fn();
  } catch (e) {
    check(false, `[${name}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 220)}`);
    for (const c of live.splice(0)) await c.close().catch(() => undefined);
  }
}

const ROOM = { id: 'r1', name: 'Lounge', poly: [[0, 0], [400, 0], [400, 300], [0, 300]] };
const OPENINGS = [
  { id: 'o1', type: 'door', room: 'r1', wall: 0, at: 20, w: 80, h: 200, sill: 0, hinge: 'start', swing: 'in' },
  { id: 'o2', type: 'window', room: 'r1', wall: 2, at: 100, w: 100, h: 120, sill: 90, hinge: 'start', swing: 'in' },
];
// ================================================================ the phone
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/** One phone. `world`: the look; `body`: the text size; `store`: localStorage to start with. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  live.push(ctx);
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  if (o.clipboard) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base }).catch(() => undefined);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world, store }) => {
    if (sessionStorage.getItem('g3.seeded')) return;
    sessionStorage.setItem('g3.seeded', '1');
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    for (const [k, v] of Object.entries(store ?? {})) localStorage.setItem(k, v);
    window.__ghostyHero = true;
  }, { key: KEY, body: o.body ?? 0, world: o.world ?? 'scan', store: o.store ?? {} });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const go = async (page, id) => {
  await page.evaluate((i) => (location.hash = i), id);
  await page.waitForSelector(`#pg-${id}`, { state: 'attached', timeout: 30000 });
};
const text = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
/** Every key in `root` at 44 pt, nothing sideways on the page, no word cut inside `root`, no raw string. */
async function bar(page, tag, id, root) {
  // the screen finishes opening first: it scales in from 98.5 % (.pg.on, proswitch), so on a slow runner a 44 pt key measured
  // mid-animation reads 43 (CI's ink flake on #119); the sizes are read once the screen is still
  await page.waitForFunction((t) => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.target === document.querySelector(`#pg-${t}`)), id, { timeout: 5000 }).catch(() => undefined);
  const r = await page.evaluate(({ t, root }) => {
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
    const els = [...document.querySelectorAll(root)];
    const all = els.flatMap((x) => [x, ...x.querySelectorAll('*')]).filter(vis);
    const small = all.filter((e) => e.matches('button, input:not([type=hidden]):not([type=file]):not([type=range]), select, textarea, [role=button]')).map((e) => {
      const b = e.getBoundingClientRect();
      return b.width >= 43.5 && b.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(b.width)}×${Math.round(b.height)}`;
    }).filter(Boolean);
    const sideways = document.documentElement.scrollWidth > innerWidth + 1 || all.some((e) => {
      for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX) && p.id !== `pg-${t}`) return false;
      const b = e.getBoundingClientRect();
      return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1);
    });
    const cut = all.filter((e) => !e.matches('input, select, textarea') && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(getComputedStyle(e).overflowX)).map((e) => e.textContent.trim().slice(0, 30));
    return { small: small.slice(0, 6), sideways, cut: cut.slice(0, 4), words: els.map((x) => x.innerText).join(' ') };
  }, { t: id, root });
  check(!r.small.length, `${tag}: under 44 pt: ${r.small.join(', ')}`);
  check(!r.sideways, `${tag}: sideways`);
  check(!r.cut.length, `${tag}: words cut: ${r.cut.join(' | ')}`);
  check(!RAW.test(r.words), `${tag}: a raw string: ${(RAW.exec(r.words) ?? [''])[0]}`);
}
const M = await pure('apps/web/src/game3d/model.ts');

// ================================================================ L · THE LOGIC, worked by hand
await section('words', async () => {
  log('the templates and the rules');
  check(M.KINDS.length === 6 && M.KINDS.every((k) => { const g = M.template(k, 1); return g.things.length >= 4 && g.rules.length >= 1 && g.kind === k; }), '[L1 six] six templates, each a stage and its rules');
  const p = M.template('platformer', 1);
  let s = M.startState(p);
  const coin = p.things.find((t) => t.kind === 'coin');
  s = M.react(p, s, { e: 'touch', thing: coin });
  check(s.score === 1 && s.gone.has(coin.id), `[L2 coin] a coin scores 1 and goes: ${s.score}`);
  check(M.react(p, s, { e: 'touch', thing: coin }).score === 1, '[L2 once] a coin taken counts once');
  const fell = M.react(p, s, { e: 'fall' });
  check(fell.lives === 2 && fell.respawn, `[L3 fall] a fall costs one of three lives: ${fell.lives}`);
  check(M.react(p, s, { e: 'touch', thing: p.things.find((t) => t.kind === 'goal') }).over === 'won', '[L4 flag] the flag wins');
  const k = M.template('kart', 1);
  let ks = M.startState(k);
  const goal = k.things.find((t) => t.kind === 'goal');
  check(M.react(k, ks, { e: 'touch', thing: goal }).over === '', '[L5 shut] the kart\'s line does nothing before its gates');
  for (const pad of k.things.filter((t) => t.kind === 'pad')) ks = M.react(k, ks, { e: 'touch', thing: pad });
  check(ks.score === 3 && ks.open.has('goal') && M.react(k, ks, { e: 'touch', thing: goal }).over === 'won', `[L5 lap] three gates open the line, and it wins: ${ks.score}`);
  const ex = M.template('explorer', 1);
  let es = M.startState(ex);
  for (const gem of ex.things.filter((t) => t.kind === 'gem')) es = M.react(ex, es, { e: 'touch', thing: gem });
  check(es.over === 'won' && es.score === 5, `[L6 gems] every gem wins: ${es.over} ${es.score}`);
  check(M.react(ex, M.startState(ex), { e: 'tick', dt: 200 }).over === 'lost', '[L7 clock] the clock running out loses');
  const pz = M.template('puzzle', 1);
  let ps = M.react(pz, M.startState(pz), { e: 'start' });
  check(/crates/.test(ps.said), `[L8 say] the puzzle says "${ps.said}"`);
  for (const pad of pz.things.filter((t) => t.kind === 'pad')) ps = M.react(pz, ps, { e: 'cover', thing: pad });
  check(ps.over === 'won', '[L8 pads] both crates on their pads win');
  const sh = M.template('shooter', 1);
  let ss = M.startState(sh);
  for (const en of sh.things.filter((t) => t.kind === 'enemy')) ss = M.react(sh, ss, { e: 'shot', thing: en });
  check(ss.over === 'won' && ss.score === 4, '[L9 shooter] every enemy shot wins');
  check(M.ruleWords(p.rules[0]) === 'When the player touches a coin, add 1 to the score.', `[L10 words] "${M.ruleWords(p.rules[0])}"`);
  const g = M.template('platformer', 1);
  const t = M.addThing(g, 'crate', { x: 2.4, z: -1.6 });
  check(t.x === 2 && t.z === -2 && t.y === 0.5 && t.body === 'dynamic', `[L11 grid] a crate lands on the grid: ${JSON.stringify(t)}`);
  // DESCRIBE A GAME: the words read into a template and its changes; only what he accepts is made
  const d = M.draftFromWords('a night platformer with 10 coins and low gravity');
  const kinds = d.changes.map((c) => c.kind).sort().join(',');
  check(d.kind === 'platformer' && kinds === 'count,gravity,sky' && d.changes.find((c) => c.kind === 'count').n === 10, `[L13 draft] ${JSON.stringify(d)}`);
  const all = M.makeDraft(d, new Set(d.changes.map((c) => c.id)), 1);
  const noGrav = M.makeDraft(d, new Set(d.changes.filter((c) => c.kind !== 'gravity').map((c) => c.id)), 1);
  check(all.things.filter((t) => t.kind === 'coin').length === 10 && all.gravity === 1.62 && all.sky === 0x0d1620 && noGrav.gravity === 9.81, `[L14 accept] all: ${all.things.filter((t) => t.kind === 'coin').length} coins, gravity ${all.gravity}; gravity rejected: ${noGrav.gravity}`);
  const race = M.draftFromWords('race round a track for 2 minutes');
  check(race.kind === 'kart' && race.changes.some((c) => c.kind === 'time' && c.n === 120), `[L15 race] ${JSON.stringify(race)}`);
  check(M.draftFromWords('hi') === null && M.draftFromWords('something fun').kind === 'platformer', '[L16 vague] too short is nothing; no kind named is a platformer');
  check(M.readGames('nonsense').length === 0 && M.readGames(JSON.stringify([g, { id: 1 }])).length === 1, '[L12 read] what is not a game is left out');
});

// ================================================================ P · PLAY, and E · EDIT
const play = async (page, kind) => {
  await page.locator(`#pg-gamestudio .gs3card[data-kind=${kind}]`).click();
  return until(page, () => window.__ghosty?.game3d?.run?.info?.mode === 'play' && window.__ghosty.game3d.run.info.frames > 2, null, 60000);
};
const lastRule = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-gamestudio .gs3rulewords')].pop()?.textContent ?? '');
const info = (page) => page.evaluate(() => { const i = window.__ghosty.game3d.run?.info; return i ? { mode: i.mode, error: i.error, frames: i.frames, pr: i.pixelRatio, ghost: i.ghost, score: i.state?.score, over: i.state?.over, player: i.player } : null; });
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  await section('play', async () => {
    log(`play ${vp.width}`);
    const { ctx, page } = await phone(vp);
    await go(page, 'gamestudio');
    check(await until(page, () => document.querySelectorAll('#pg-gamestudio .gs3card').length === 6, null, 30000), `${T} [P1 shelf] six templates on the shelf`);
    check(/No 3-D games of your own yet/.test(await text(page, '#pg-gamestudio .gs3none')), `${T} [P1 empty] "${await text(page, '#pg-gamestudio .gs3none')}"`);
    await bar(page, `${T} [P shelf bar]`, 'gamestudio', '#pg-gamestudio .gs3shelf, #pg-gamestudio .gs3mine');
    const started = await play(page, 'platformer');
    const i1 = await info(page);
    check(started, `${T} [P2 plays] the platformer did not start: ${JSON.stringify(i1)}`);
    check(/^Score 0 · Lives 3$/.test(await text(page, '#pg-gamestudio .gs3hud')), `${T} [P2 hud] "${await text(page, '#pg-gamestudio .gs3hud')}"`);
    check(i1 && i1.pr <= 1.5, `${T} [P3 guard] the drawing resolution is ${i1?.pr}`);
    // the stick and JUMP are read the moment they are touched, not on the next frame
    const box = await page.locator('#pg-gamestudio .gs3stick').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + 4);
    const sy = await page.evaluate(() => window.__ghosty.game3d.run.input.sy);
    await page.mouse.up();
    check(sy > 0.8, `${T} [P4 stick] pushing the stick up reads ${sy}`);
    await page.locator('#pg-gamestudio .gs3act').dispatchEvent('pointerdown');
    const jumping = await page.evaluate(() => window.__ghosty.game3d.run.input.jump);
    await page.locator('#pg-gamestudio .gs3act').dispatchEvent('pointerup');
    check(jumping === true, `${T} [P4 jump] JUMP read ${jumping}`);
    // reaching a coin scores; reaching the flag wins
    await page.evaluate(() => { const g = window.__ghosty.game3d.games[0]; const c = g.things.find((t) => t.kind === 'coin'); window.__ghosty.game3d.run.teleport({ x: c.x, y: c.y, z: c.z }); });
    check(await until(page, () => window.__ghosty.game3d.run.info.state?.score === 1, null, 30000), `${T} [P5 coin] the score after a coin: ${JSON.stringify(await info(page))}`);
    await page.evaluate(() => { const g = window.__ghosty.game3d.games[0]; const c = g.things.find((t) => t.kind === 'goal'); window.__ghosty.game3d.run.teleport({ x: c.x, y: c.y, z: c.z }); });
    check(await until(page, () => window.__ghosty.game3d.run.info.state?.over === 'won', null, 30000), `${T} [P6 flag] not won at the flag: ${JSON.stringify(await info(page))}`);
    check(await until(page, () => /^You won! Score 1\./.test(document.querySelector('#pg-gamestudio .gs3banner')?.textContent ?? ''), null, 5000), `${T} [P6 banner] "${await text(page, '#pg-gamestudio .gs3banner')}"`);
    await bar(page, `${T} [P play bar]`, 'gamestudio', '#pg-gamestudio .gs3top, #pg-gamestudio .gs3banner');
    // PLAY AGAIN races the last run's ghost
    await page.locator('#pg-gamestudio .gs3banner button', { hasText: 'PLAY AGAIN' }).click();
    check(await until(page, () => window.__ghosty.game3d.run?.info?.mode === 'play' && window.__ghosty.game3d.run.info.ghost > 0, null, 60000), `${T} [P7 ghost] no ghost on the second run: ${JSON.stringify(await info(page))}`);
    // EDIT: a coin added on the grid, moved, coloured; a rule added; kept after a reload
    await page.locator('#pg-gamestudio .gs3top button', { hasText: 'STOP' }).click();
    await page.locator('#pg-gamestudio .gs3game button', { hasText: 'EDIT' }).first().click();
    check(await until(page, () => window.__ghosty.game3d.view === 'edit' && !window.__ghosty.game3d.run, null, 10000), `${T} [E1 edit] the editor did not open`);
    const before = await page.evaluate(() => window.__ghosty.game3d.games[0].things.length);
    await page.locator('#pg-gamestudio .gs3add button[data-add=coin]').click();
    const added = await page.evaluate(() => { const g = window.__ghosty.game3d.games[0]; const t = g.things.find((x) => x.id === window.__ghosty.game3d.selected); return { n: g.things.length, t }; });
    check(added.n === before + 1 && added.t?.kind === 'coin' && Number.isInteger(added.t.x) && Number.isInteger(added.t.z), `${T} [E2 add] ${JSON.stringify(added)}`);
    await page.locator('#pg-gamestudio .gs3nudge button', { hasText: 'RIGHT' }).click();
    const moved = await page.evaluate(() => window.__ghosty.game3d.games[0].things.find((x) => x.id === window.__ghosty.game3d.selected).x);
    check(moved === added.t.x - 1, `${T} [E3 move] RIGHT moved it to x ${moved}`);
    const rules = await page.evaluate(() => window.__ghosty.game3d.games[0].rules.length);
    await page.locator('#pg-gamestudio .gs3edit button', { hasText: '+ ADD A RULE' }).click();
    check((await page.evaluate(() => window.__ghosty.game3d.games[0].rules.length)) === rules + 1 && /When the player touches a coin, add 1 to the score\./.test(await lastRule(page)), `${T} [E4 rule] "${await lastRule(page)}"`);
    await bar(page, `${T} [E bar]`, 'gamestudio', '#pg-gamestudio .gs3edit');
    // PLAY FROM HERE: the run starts just above the thing picked
    const from = await page.evaluate(() => window.__ghosty.game3d.games[0].things.find((x) => x.id === window.__ghosty.game3d.selected));
    await page.locator('#pg-gamestudio .gs3thing button', { hasText: 'PLAY FROM HERE' }).click();
    check(await until(page, (f) => { const i = window.__ghosty.game3d.run?.info; return i?.mode === 'play' && Math.abs(i.player.x - f.x) < 1.5 && Math.abs(i.player.z - f.z) < 1.5; }, from, 60000), `${T} [E7 from here] the run did not start at the coin: ${JSON.stringify(await info(page))} vs ${JSON.stringify(from)}`);
    await page.locator('#pg-gamestudio .gs3top button', { hasText: 'STOP' }).click();
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.game3d'))[0]);
    check(kept.things.length === before + 1 && kept.rules.length === rules + 1, `${T} [E5 kept] the phone holds ${kept.things.length} things, ${kept.rules.length} rules`);
    await page.evaluate(() => (location.hash = 'core'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
    await go(page, 'gamestudio');
    check(await until(page, () => document.querySelectorAll('#pg-gamestudio .gs3game').length === 1, null, 30000), `${T} [E6 reload] the game is not on the shelf after a reload`);
    await ctx.close();
  });
}
// every other template plays in one tap
await section('kinds', async () => {
  const { ctx, page } = await phone(PHONE);
  await go(page, 'gamestudio');
  await until(page, () => document.querySelectorAll('#pg-gamestudio .gs3card').length === 6, null, 30000);
  // from the chat: "make a 3d kart race for 3 minutes" opens 3-D GAMES with the draft waiting there
  await page.evaluate(() => (location.hash = 'core'));
  await page.evaluate(() => window.__ghosty.send('make a 3d kart race for 3 minutes', false));
  check(await until(page, () => document.body.dataset.tab === 'gamestudio' && window.__ghosty.game3d?.draft?.kind === 'kart' && window.__ghosty.game3d.draft.changes.some((c) => c.kind === 'time' && c.n === 180), null, 20000), `[C1 chat] the draft from the chat: ${JSON.stringify(await page.evaluate(() => window.__ghosty.game3d?.draft))}`);
  await page.locator('#pg-gamestudio .gs3draft button', { hasText: 'CANCEL' }).click();
  // DESCRIBE A GAME on the page: the draft's three marked changes, one rejected, MAKE IT makes and plays the rest
  await page.locator('#pg-gamestudio input[aria-label="Describe a game"]').fill('a night platformer with 10 coins and low gravity');
  await page.locator('#pg-gamestudio .gs3shelf button', { hasText: 'DRAFT IT' }).click();
  check(await until(page, () => document.querySelectorAll('#pg-gamestudio .gs3draft [data-change][data-state=accepted]').length === 3, null, 5000), `[D1 draft] "${await text(page, '#pg-gamestudio .gs3draft')}"`);
  await bar(page, '[440] [D bar]', 'gamestudio', '#pg-gamestudio .gs3shelf');
  const grav = await page.evaluate(() => window.__ghosty.game3d.draft.changes.find((c) => c.kind === 'gravity').id);
  await page.locator(`#pg-gamestudio .gs3draft button[data-change=${grav}]`).click();
  check((await page.locator(`#pg-gamestudio .gs3draft [data-change=${grav}][data-state=rejected]`).count()) === 1, '[D2 reject] the gravity change is not shown rejected');
  await page.locator('#pg-gamestudio .gs3draft button', { hasText: 'MAKE IT' }).click();
  check(await until(page, () => window.__ghosty.game3d.run?.info?.mode === 'play', null, 60000), `[D3 make] the draft did not play: ${JSON.stringify(await info(page))}`);
  const made = await page.evaluate(() => window.__ghosty.game3d.games[0]);
  check(made.things.filter((t) => t.kind === 'coin').length === 10 && made.gravity === 9.81 && made.sky === 0x0d1620, `[D3 made] ${made.things.filter((t) => t.kind === 'coin').length} coins, gravity ${made.gravity}, sky ${made.sky}`);
  await page.locator('#pg-gamestudio .gs3top button', { hasText: 'STOP' }).click();
  await until(page, () => window.__ghosty.game3d.view === 'shelf', null, 10000);
  for (const kind of ['explorer', 'kart', 'puzzle', 'marble', 'shooter']) {
    log(`plays: ${kind}`);
    const ok = await play(page, kind);
    check(ok, `[P8 ${kind}] did not start: ${JSON.stringify(await info(page))}`);
    await page.locator('#pg-gamestudio .gs3top button', { hasText: 'STOP' }).click();
    await until(page, () => window.__ghosty.game3d.view === 'shelf', null, 10000);
  }
  await ctx.close();
});

// ================================================================ BODY 21 and the seven looks: the shelf
await section('body21', async () => {
  log('body 21');
  const { ctx, page } = await phone(PHONE, { body: 21 });
  await go(page, 'gamestudio');
  await until(page, () => document.querySelectorAll('#pg-gamestudio .gs3card').length === 6, null, 30000);
  await bar(page, '[440] [BODY 21]', 'gamestudio', '#pg-gamestudio .gs3shelf, #pg-gamestudio .gs3mine');
  await ctx.close();
});
await section('looks', async () => {
  for (const world of WORLDS) {
    log(`look ${world}`);
    const { ctx, page } = await phone(PHONE, { world });
    await go(page, 'gamestudio');
    await until(page, () => document.querySelectorAll('#pg-gamestudio .gs3card').length === 6, null, 30000);
    await bar(page, `[440] [${world}]`, 'gamestudio', '#pg-gamestudio .gs3shelf, #pg-gamestudio .gs3mine');
    await ctx.close();
  }
});

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `GAME STUDIO 3D run clean: ${checks} checks in ${secs} s: six templates and their rules, play on three.js and Rapier with the stick, JUMP, a coin, the flag and a ghost, the editor and its rules kept on the phone, at 440 and 390, at BODY 21 and in all seven looks`);
process.exit(problems.length ? 1 : 0);
