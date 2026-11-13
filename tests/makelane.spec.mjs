// THE FINAL ROUND, MAKE LANE (docs/build-plan/FINAL-MAKE.md): what the lane made, proved on the phone at 440 × 956 and 390 × 844.
//   CONVERT's UNIT PAD (U): the kind, the number, the two units, the answer as he types, SWAP, IN EVERY UNIT, COPY, RECENT kept on the
//     phone and back after a reload, a word that is not a number said in his words, and a capital K that is kelvin, never a kilometre.
//   SPACE's MATERIALS (M): paint in tins, flooring with 10% over, skirting and wallpaper for the plan on the phone, the same numbers the
//     pure file gives, said as a first estimate, never a quote, and following a change to the room at once.
//   THE WORKBENCH's COPY (B): under every estimate, and what it copies starts with FIRST ESTIMATE · NOT CERTIFIED.
//   THE 3D STUDIO's VIEW (S): SOLID, WIREFRAME and X-RAY change how the model is drawn, and SOLID puts the model's own look back.
//   THE BAR (every one of them): every key 44 pt, nothing sideways, no word cut, at both sizes, at BODY 21, and in all seven looks.
//   BASE=http://localhost:8788 node tests/makelane.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';
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
const on = (k) => !process.env.ML_ONLY || process.env.ML_ONLY.split(',').includes(k);
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

// ================================================================ the sums and the words, read from the source
const UN = await pure('apps/web/src/convert/units.ts');
const PAD = await pure('apps/web/src/convert/unitpad.ts');
const MAT = await pure('apps/web/src/space/materials.ts');
const SW = await pure('apps/web/src/features/studio/words.ts');
const BW = await pure('apps/web/src/features/workbench/words.ts');
const ROOM = { id: 'r1', name: 'Lounge', poly: [[0, 0], [400, 0], [400, 300], [0, 300]] };
const OPENINGS = [
  { id: 'o1', type: 'door', room: 'r1', wall: 0, at: 20, w: 80, h: 200, sill: 0, hinge: 'start', swing: 'in' },
  { id: 'o2', type: 'window', room: 'r1', wall: 2, at: 100, w: 100, h: 120, sill: 90, hinge: 'start', swing: 'in' },
];
await section('words', async () => {
  log('the sums');
  // M · a 4 × 3 m room, 2.4 m high, one door and one window: by hand, floor 12 m², walls 14 × 2.4 − 1.6 − 1.2 = 30.8 m², paint
  // (30.8 + 12) × 2 coats ÷ 12 m²/L = 7.13 L, so a 5 L and a 2.5 L tin; flooring 13.2 m²; skirting 14 − 0.8 = 13.2 m; 25 drops of 53 cm,
  // four 2.5 m drops a 10.05 m roll, 7 rolls
  const m = MAT.materialsFor([ROOM], OPENINGS, 240);
  check(m.total.floor === 12 && m.total.walls === 30.8 && m.total.paint === 7.1 && m.total.flooring === 13.2 && m.total.skirting === 13.2 && m.total.rolls === 7, `[M sums] a 4 × 3 m room gives ${JSON.stringify(m.total)}`);
  check(m.tins === '1 × 5 L + 1 × 2.5 L' && MAT.tinsFor(0.4) === '1 × 1 L' && MAT.tinsFor(11) === '2 × 5 L + 1 × 1 L' && MAT.tinsFor(0) === 'none', `[M tins] 7.1 L is "${m.tins}", 0.4 L "${MAT.tinsFor(0.4)}", 11 L "${MAT.tinsFor(11)}"`);
  const w = MAT.materialsWords(m);
  check(/^Paint: about 7\.1 L/.test(w.head) && /13\.2 m²/.test(w.head) && /7 standard rolls/.test(w.head) && !w.lines.length, `[M words] one room says "${w.head}"`);
  check(MAT.materialsWords(MAT.materialsFor([], [], 240)).head.startsWith('Draw a room first'), '[M words] no room says nothing useful');
  check(/first estimate/i.test(MAT.MATERIALS_NOTE) && /never a quote/.test(MAT.MATERIALS_NOTE), `[M words] the note "${MAT.MATERIALS_NOTE}" does not say it is a first estimate`);
  const two = MAT.materialsFor([ROOM, { id: 'r2', name: 'Hall', poly: [[400, 0], [600, 0], [600, 300], [400, 300]] }], OPENINGS, 240);
  check(MAT.materialsWords(two).lines.length === 2 && two.total.floor === 18, `[M rooms] two rooms give ${two.total.floor} m² and ${MAT.materialsWords(two).lines.length} lines`);
  // U · by name, so a symbol never meets a word it shares
  check(UN.convertByName(1, 'K', '°C')?.text === '1 K is -272.1 °C' && UN.unitsAsked('300 K in C')?.text === '300 K is 26.85 °C' && UN.unitsAsked('5k in miles')?.text === '5 km is 3.107 miles', `[U kelvin] "300 K in C" is "${UN.unitsAsked('300 K in C')?.text}"`);
  check(UN.convertByName(100, '°F', '°C')?.text === '100 °F is 37.78 °C' && UN.convertByName(10, 'mile', 'km')?.text === '10 miles is 16.09 km', '[U by name] the pad\'s sums are not the chat\'s');
  check(UN.everyUnit(1, 'mile').length === UN.unitsOfKind('length').length - 1 && UN.UNIT_KINDS.length === 12 && UN.UNIT_KINDS.every(([k]) => UN.unitsOfKind(k).includes(UN.KIND_PAIR[k][0]) && UN.unitsOfKind(k).includes(UN.KIND_PAIR[k][1])), '[U kinds] a kind starts on a pair it does not have');
  check(PAD.padNumber('1,250.5') === 1250.5 && PAD.padNumber('−40') === -40 && PAD.padNumber('abc') === null && PAD.padNumber('') === null && PAD.padNumber('1e3') === 1000, '[U number] the pad reads a number wrong');
  check(UN.convertByName(0, 'mpg', 'l/100km') === null, '[U fuel] 0 mpg gives an answer (it has none)');
  // B and S · the words
  check(/first estimate, not certified/i.test(BW.COPY.done) && BW.COPY.key === 'COPY', `[B words] COPY says "${BW.COPY.done}"`);
  check(SW.SHADINGS.map((x) => x[1]).join() === 'SOLID,WIREFRAME,X-RAY' && SW.SHADINGS.every(([id]) => SW.SHADING_NOTE[id]?.length > 10), '[S words] VIEW has not its three looks');
});

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
    if (sessionStorage.getItem('ml.seeded')) return;
    sessionStorage.setItem('ml.seeded', '1');
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
const openUnits = async (page) => {
  await go(page, 'convert');
  await page.waitForSelector('#pg-convert .cvtoolbtn[data-id=units]', { timeout: 30000 });
  await page.locator('#pg-convert .cvtoolbtn[data-id=units]').click();
  await page.waitForSelector('#pg-convert .cvpad .cvpadval', { timeout: 10000 });
};
const ans = (page) => text(page, '#pg-convert .cvpadans');
const SPACE_STORE = { 'ghosty.space': JSON.stringify({ plan: { v: 2, room: { w: 400, d: 300 }, items: [], rooms: [ROOM], openings: OPENINGS, wall: 10, h: 240, north: 0 }, measures: [] }) };

// ================================================================ U · CONVERT's UNIT PAD
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  await section('units', async () => {
    log(`units ${vp.width}`);
    const { ctx, page } = await phone(vp, { clipboard: true });
    await openUnits(page);
    // a fresh phone starts on miles to kilometres, with 1 typed, and the answer is already there
    check((await ans(page)) === `${UN.convertByName(1, 'mile', 'km').text}.`, `${T} [U1 start] the pad opens on "${await ans(page)}"`);
    const val = page.locator('#pg-convert .cvpadval');
    await val.fill('10');
    check(await until(page, (w) => document.querySelector('#pg-convert .cvpadans')?.textContent === w, `${UN.convertByName(10, 'mile', 'km').text}.`, 5000), `${T} [U2 as he types] 10 says "${await ans(page)}"`);
    const rows = await page.locator('#pg-convert .cvpadrow').count();
    check(rows === UN.unitsOfKind('length').length - 2, `${T} [U3 every unit] ${rows} rows under the answer (want ${UN.unitsOfKind('length').length - 2})`);
    await page.locator('#pg-convert .cvpadswap').click();
    check((await ans(page)) === `${UN.convertByName(10, 'km', 'mile').text}.`, `${T} [U4 swap] SWAP says "${await ans(page)}"`);
    await page.selectOption('#pg-convert .cvpadkind', 'temp');
    await val.fill('212');
    check(await until(page, (w) => document.querySelector('#pg-convert .cvpadans')?.textContent === w, '212 °F is 100 °C.', 5000), `${T} [U5 kind] 212 in temperature says "${await ans(page)}"`);
    await page.selectOption('#pg-convert .cvpadfrom', 'K');
    check((await ans(page)) === `${UN.convertByName(212, 'K', '°C').text}.`, `${T} [U5 kelvin] K says "${await ans(page)}"`);
    await page.selectOption('#pg-convert .cvpadfrom', '°F');
    // his words, never a raw one: not a number, then nothing
    await val.fill('abc');
    check((await page.locator('#pg-convert .cvpadans[data-state=error]').count()) === 1 && (await ans(page)) === PAD.PAD_WORDS.bad('abc'), `${T} [U6 not a number] "abc" says "${await ans(page)}"`);
    await val.fill('');
    check((await page.locator('#pg-convert .cvpadans[data-state=empty]').count()) === 1 && (await ans(page)) === PAD.PAD_WORDS.empty, `${T} [U6 empty] nothing typed says "${await ans(page)}"`);
    // RECENT: Enter keeps it at once (a pause keeps it too), kept on the phone, each unit in its own case
    await val.fill('212');
    await val.press('Enter');
    check(await until(page, () => [...document.querySelectorAll('#pg-convert .cvpadrec')].some((b) => /212 °F is 100 °C/.test(b.textContent)), null, 5000), `${T} [U7 recent] RECENT shows "${await text(page, '#pg-convert .cvpadrecent')}"`);
    const tt = await page.evaluate(() => getComputedStyle(document.querySelector('#pg-convert .cvpadrec')).textTransform);
    check(tt === 'none', `${T} [U7 case] a recent key is drawn ${tt} ("°c" for "°C")`);
    // COPY puts the answer on the clipboard
    await page.locator('#pg-convert .cvpadcopy').click();
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => '(none)'));
    check(clip === '100 °C', `${T} [U8 copy] COPY put "${clip}"`);
    await bar(page, `${T} [U bar]`, 'convert', '#pg-convert .cvpad');
    if (vp.width === 440) await page.screenshot({ path: `${out}/makelane-units-440.png` }).catch(() => undefined);
    // a reload keeps the kind, the number and RECENT; a tap on a recent one brings it back
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
    await openUnits(page);
    check((await page.locator('#pg-convert .cvpadkind').inputValue()) === 'temp' && (await val.inputValue()) === '212' && (await page.locator('#pg-convert .cvpadrec').count()) >= 1, `${T} [U9 kept] after a reload: ${await page.locator('#pg-convert .cvpadkind').inputValue()}, "${await val.inputValue()}"`);
    await page.selectOption('#pg-convert .cvpadkind', 'mass');
    await page.locator('#pg-convert .cvpadrec').first().click();
    check((await page.locator('#pg-convert .cvpadkind').inputValue()) === 'temp' && (await ans(page)) === '212 °F is 100 °C.', `${T} [U9 recent tap] a recent one brings back "${await ans(page)}"`);
    // the sentence box is still there under it, for "5 ft 10 in cm"
    await page.locator('#pg-convert input.cvsayq').fill('5 ft 10 in cm');
    await page.locator('#pg-convert input.cvsayq').press('Enter');
    check(/5 ft 10 in is 177\.8 cm/.test(await text(page, '#pg-convert .cvans')), `${T} [U10 say it] the sentence box says "${await text(page, '#pg-convert .cvans')}"`);
    await ctx.close();
  });
}

// ================================================================ M · SPACE's MATERIALS
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  await section('materials', async () => {
    log(`materials ${vp.width}`);
    const { ctx, page } = await phone(vp, { store: SPACE_STORE });
    await go(page, 'space');
    check(await until(page, () => (window.__ghosty?.space?.materials?.paint ?? 0) > 0, null, 15000), `${T} [M1 drawn] MATERIALS has no paint`);
    const st = await page.evaluate(() => ({ m: window.__ghosty.space.materials, openings: window.__ghosty.space.openings }));
    const want = MAT.materialsFor([ROOM], st.openings, 240);
    check(st.m.paint === want.total.paint && st.m.flooring === want.total.flooring && st.m.skirting === want.total.skirting && st.m.rolls === want.total.rolls && st.m.tins === want.tins, `${T} [M2 sums] the page has ${JSON.stringify(st.m)}, the sums ${JSON.stringify(want.total)} ${want.tins}`);
    const head = await text(page, '#pg-space .spacemathead');
    check(head === MAT.materialsWords(want).head, `${T} [M3 words] MATERIALS says "${head}"`);
    check((await text(page, '#pg-space .spacematerials')).includes(MAT.MATERIALS_NOTE), `${T} [M3 note] the first-estimate note is not under it`);
    // a change to the room follows at once: 5 × 4 m
    const before = st.m.paint;
    await page.fill('#pg-space .spaceroom input >> nth=0', '500');
    await page.fill('#pg-space .spaceroom input >> nth=1', '400');
    await page.locator('#pg-space .spaceroom button').click();
    check(await until(page, (b) => (window.__ghosty?.space?.materials?.paint ?? 0) > b && (window.__ghosty?.space?.materials?.flooring ?? 0) === 22, before, 8000), `${T} [M4 follows] after 5 × 4 m: ${JSON.stringify(await page.evaluate(() => window.__ghosty.space.materials))}`);
    await bar(page, `${T} [M bar]`, 'space', '#pg-space .spacematerials');
    if (vp.width === 440) await page.locator('#pg-space .spacematerials').screenshot({ path: `${out}/makelane-materials-440.png` }).catch(() => undefined);
    await ctx.close();
  });
}

// ================================================================ B · THE WORKBENCH's COPY
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  await section('bench', async () => {
    log(`workbench ${vp.width}`);
    const { ctx, page } = await phone(vp, { clipboard: true });
    await go(page, 'workbench');
    await openSection(page, 'workbench', 'Structure');
    check(await until(page, () => [...document.querySelectorAll('#pg-workbench .wbcard .wbcopy')].some((b) => b.getClientRects().length), null, 15000), `${T} [B1 copy] no COPY under the beam's estimate`);
    await page.locator('#pg-workbench .wbcard .wbcopy').first().click();
    check(await until(page, (w) => [...document.querySelectorAll('#pg-workbench .wbcopied')].some((x) => x.textContent === w), BW.COPY.done, 5000), `${T} [B2 said] COPY says "${await text(page, '#pg-workbench .wbcopied')}"`);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
    check(/^\S.*FIRST ESTIMATE · NOT CERTIFIED/.test(clip.split('\n')[0] ?? '') && /Confidence:/.test(clip), `${T} [B3 label] the copied estimate starts "${clip.split('\n')[0]}"`);
    await bar(page, `${T} [B bar]`, 'workbench', '#pg-workbench .wbcard');
    // the HOME section's six circuit keys, each whole (they wrap to two rows here, not cut)
    await openSection(page, 'workbench', 'Home');
    await bar(page, `${T} [B modes]`, 'workbench', '#pg-workbench .wbmodes');
    await ctx.close();
  });
}

// ================================================================ S · THE 3D STUDIO's VIEW (440: the scene is drawn in software on CI)
await section('studio', async () => {
  log('studio 440');
  const { ctx, page } = await phone(PHONE);
  await go(page, 'studio');
  const drawn = await until(page, () => window.__ghosty?.studio?.state?.().running && window.__ghosty.studio.state().parts.length > 0 && window.__ghosty.studio.state().look, null, 60000);
  if (!drawn) {
    const err = await page.evaluate(() => window.__ghosty?.studio?.state?.().error ?? '');
    check(/WebGL|3-D|graphics/i.test(err), `[S0 scene] no model drawn and no reason said ("${err}")`);
    console.log(`  (no WebGL here: VIEW checked by its keys only) ${err}`);
  }
  await page.evaluate(() => window.__ghosty.studio.show('tools'));
  await page.waitForSelector('#pg-studio .studioshade button[data-shade="wire"]', { timeout: 10000 });
  const own = await page.evaluate(() => window.__ghosty.studio.state().look);
  for (const [id] of SW.SHADINGS) {
    await page.locator(`#pg-studio .studioshade button[data-shade="${id}"]`).click();
    const st = await page.evaluate(() => ({ s: window.__ghosty.studio.state().shading, look: window.__ghosty.studio.state().look }));
    check(st.s === id, `[S1 ${id}] the studio draws "${st.s}"`);
    check((await page.locator(`#pg-studio .studioshade button[data-shade="${id}"][aria-pressed="true"]`).count()) === 1 && (await text(page, '#pg-studio .studiopane .note')).includes(SW.SHADING_NOTE[id]), `[S1 ${id}] the key is not shown on, or its line is missing`);
    if (drawn && id === 'wire') check(st.look.wireframe === true, `[S2 wire] the model is not drawn as lines: ${JSON.stringify(st.look)}`);
    if (drawn && id === 'xray') check(st.look.transparent === true && st.look.opacity <= 0.3 && st.look.wireframe === own.wireframe, `[S2 x-ray] the model is not see-through: ${JSON.stringify(st.look)}`);
    if (drawn && id === 'solid') check(JSON.stringify(st.look) === JSON.stringify(own), `[S3 solid] SOLID did not put the model's own look back: ${JSON.stringify(st.look)} (was ${JSON.stringify(own)})`);
  }
  await bar(page, '[440] [S bar]', 'studio', '#pg-studio .studioseg, #pg-studio .studioshade');
  await ctx.close();
});

// ================================================================ BODY 21: the biggest text cuts nothing
await section('body21', async () => {
  log('body 21');
  const { ctx, page } = await phone(PHONE, { body: 21, store: SPACE_STORE });
  await openUnits(page);
  await page.locator('#pg-convert .cvpadval').fill('3.5');
  await bar(page, '[440] [BODY 21] [U]', 'convert', '#pg-convert .cvpad');
  await go(page, 'space');
  await until(page, () => (window.__ghosty?.space?.materials?.paint ?? 0) > 0, null, 15000);
  await bar(page, '[440] [BODY 21] [M]', 'space', '#pg-space .spacematerials');
  await go(page, 'workbench');
  await openSection(page, 'workbench', 'Home');
  await until(page, () => !!document.querySelector('#pg-workbench .wbmodes'), null, 10000);
  await bar(page, '[440] [BODY 21] [B]', 'workbench', '#pg-workbench .wbmodes, #pg-workbench .wbcopyrow');
  await ctx.close();
});

// ================================================================ the seven looks: the pad and MATERIALS whole and readable in each
await section('looks', async () => {
  for (const world of WORLDS) {
    log(`look ${world}`);
    const { ctx, page } = await phone(PHONE, { world, store: SPACE_STORE });
    await openUnits(page);
    await bar(page, `[440] [${world}] [U]`, 'convert', '#pg-convert .cvpad');
    // the answer is drawn in a colour that is not its background's (a token that resolved to nothing would leave it invisible)
    const seen = await page.evaluate(() => {
      const a = document.querySelector('#pg-convert .cvpadans');
      const c = getComputedStyle(a).color;
      let p = a;
      let bg = 'rgba(0, 0, 0, 0)';
      while (p && /rgba\(0, 0, 0, 0\)|transparent/.test(bg)) {
        bg = getComputedStyle(p).backgroundColor;
        p = p.parentElement;
      }
      return { c, bg, ok: c !== bg && !/rgba\(0, 0, 0, 0\)/.test(c) };
    });
    check(seen.ok, `[440] [${world}] the pad's answer is ${seen.c} on ${seen.bg}`);
    await go(page, 'space');
    await until(page, () => (window.__ghosty?.space?.materials?.paint ?? 0) > 0, null, 15000);
    await bar(page, `[440] [${world}] [M]`, 'space', '#pg-space .spacematerials');
    await ctx.close();
  }
});

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `MAKE lane run clean: ${checks} checks in ${secs} s: the unit pad, MATERIALS, the Workbench's COPY and the studio's VIEW, at 440 and 390, at BODY 21 and in all seven looks`);
process.exit(problems.length ? 1 : 0);
