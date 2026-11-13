// CONSISTENCY (FINAL-ROUND, the CONSISTENCY lane; docs/build-plan/FINAL-CONSISTENCY.md): what Ghosty says about itself is
// what the code does, read from the code itself (nothing typed twice here):
//  [claims]   every place a word sends him (the catalogue's TRY IT and its WHAT IT NEEDS, the brain's "needs a key / needs
//             linking", the deck's YOU CAN lines) opens a screen this build has, and the panel or pill it names is there;
//  [keys]     every "SYSTEM → KEYS → …" names a key System really has, and says OPTIONAL exactly when the key sits under the
//             OPTIONAL fold;
//  [names]    no two screens share one name in the deck (the first screen is "Home": nothing else is);
//  [about]    every tool group's line, said in his voice ("I can …"), is a sentence ("what me expect" was not);
//  [counts]   every hub's cards are its area's screens, one card each (the editors folded as one), in order;
//  [deadkeys] no key on any screen is drawn without something listening to it (the check plants a dead one and must find it);
//  [errors]   no console error and no unhandled error or rejection on any screen at 440 and 390, nor sideways scroll, nor on
//             Home or any hub in any of the seven looks (FULL=1: every screen in every look).
//   node tests/consistency.spec.mjs [outDir]   (ONLY=claims,keys,names,about,counts,deadkeys,errors)
import { launch, webkitNoise } from './browser.mjs';
import { UK, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const HOME = { name: 'Birmingham', lat: 52.4862, lon: -1.8904 };
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const on = (s) => !ONLY || ONLY.has(s);
const problems = [];
const check = (ok, why) => ok || problems.push(why);
const started = Date.now();

/** A source file, bundled and imported (pure files only), so the spec reads the very words the app shows. */
function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['cloudflare:sockets'], logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const src = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

const C = await pure('packages/shared/src/catalogue.ts');
const A = await pure('apps/edge/src/abilities.ts');
const K = await pure('apps/edge/src/keys.ts');
const AD = await pure('apps/web/src/shell/areadefs.ts');
const AB = await pure('packages/shared/src/abilities.ts');
const T = await pure('apps/edge/src/tools/index.ts');

// ---------------------------------------------------------------- the deck's words, read from its source (it reads the phone's state)
const deckSrc = src('apps/web/src/shell/deckcopy.ts');
/** Each screen of the deck: its name and its YOU CAN lines' links. */
const DECK = {};
{
  const body = deckSrc.slice(deckSrc.indexOf('export const DECK'));
  for (const m of body.matchAll(/^ {2}(\w+): \{\n {4}name: '([^']+)'/gm)) DECK[m[1]] = { name: m[2], acts: [] };
  for (const m of body.matchAll(/\{ text: [`'][^`']*[`'], act: \{ open: '([\w?-]+)'(?:, panel: '([^']+)')? \} \}/g)) {
    const owner = [...body.slice(0, m.index).matchAll(/^ {2}(\w+): \{\n/gm)].pop()?.[1];
    if (owner && DECK[owner]) DECK[owner].acts.push({ open: m[1], ...(m[2] ? { panel: m[2] } : {}) });
  }
  check(Object.keys(DECK).length >= 40, `[names] the deck's screens were not read from deckcopy.ts (${Object.keys(DECK).length})`);
}

// ---------------------------------------------------------------- [keys] the key paths his words give
if (on('keys')) {
  const paths = [
    ...Object.entries(C.NEEDS).map(([k, n]) => [`NEEDS ${k}`, n.words]),
    ...Object.entries(A.GROUP_NEEDS).map(([k, n]) => [`GROUP_NEEDS ${k}`, n.where]),
  ];
  let n = 0;
  for (const [who, words] of paths) {
    const m = /SYSTEM → KEYS → (OPTIONAL → )?([^.:(]+?)(?:\s*\(|\.|$)/.exec(words);
    if (!m) continue;
    n++;
    const label = m[2].trim();
    const key = K.KEYS.find((d) => d.label.toLowerCase().startsWith(label.toLowerCase()));
    if (!check(!!key, `[keys] ${who} says "SYSTEM → KEYS → ${label}", and System has no such key`)) continue;
    check(!!m[1] === (key.need === 'optional'), `[keys] ${who} says ${m[1] ? 'OPTIONAL' : 'no OPTIONAL'} for "${label}", a key System files as ${key.need}`);
  }
  check(n >= 10, `[keys] only ${n} key paths were read`);
}

// ---------------------------------------------------------------- [names] one name, one screen
if (on('names')) {
  const byName = new Map();
  for (const [id, d] of Object.entries(DECK)) byName.set(d.name.toLowerCase(), [...(byName.get(d.name.toLowerCase()) ?? []), id]);
  for (const [name, ids] of byName) check(ids.length === 1, `[names] "${name}" names ${ids.length} screens: ${ids.join(', ')}`);
  // the first screen is "Home" wherever he is told where a thing lives (abilities/registry.ts screenName): no other screen is
  check(!byName.has('home'), `[names] the deck calls ${byName.get('home')} "Home", the first screen's name`);
}

// ---------------------------------------------------------------- [about] every group's line in his voice is a sentence
if (on('about')) {
  for (const g of T.TOOL_GROUPS) {
    if (!g.about) continue;
    const said = AB.iCan(g.about);
    check(!/\b(?:what|that|when|if) me\b|\bme (?:expect|want|need|ask|say|tell)\b/.test(said), `[about] ${g.name} reads "${said}"`);
    check(/^I can \S/.test(said), `[about] ${g.name} reads "${said}"`);
  }
}

// ---------------------------------------------------------------- the browser
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
await standDown(base, KEY);
const errs = [];

async function phone(viewport, world) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  await ctx.addInitScript(([k, home, world]) => {
    localStorage.setItem('ghosty.ownerKey', k);
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ home, units: 'metric', ...(world ? { look: { ground: 'graphite', world, night: 'graphite', switches: {} } } : {}) }));
  }, [KEY, HOME, world ?? null]);
  const page = await ctx.newPage();
  const tag = `${viewport.width}${world ? ` ${world}` : ''}`;
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::|status of 4\d\d|status of 5\d\d/.test(m.text())) errs.push(`[errors ${tag} ${page.url().split('#')[1] ?? 'core'}] console: ${m.text().slice(0, 200)}`);
  });
  page.on('pageerror', (e) => webkitNoise(e) || errs.push(`[errors ${tag} ${page.url().split('#')[1] ?? 'core'}] ${e.message.slice(0, 200)}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  return { ctx, page };
}
/** Opens a screen by its link, as a deep link does; true once it is the screen shown and drawn. */
async function go(page, link) {
  await page.evaluate((h) => (location.hash = h), link);
  // (a link may carry a mode: "eye?machine" opens God's eye in Machine view)
  const id = link.split('?')[0];
  return page.waitForFunction((id) => document.body.dataset.tab === id && !!document.querySelector(`#pg-${id}`)?.children.length, id, { timeout: 10000 }).then(() => true, () => false);
}
const TABS = () => [...new Set(Object.keys(DECK).concat(AD.AREAS.map((a) => `area-${a.id}`)))];

// ---------------------------------------------------------------- [claims] every link a word gives lands where it says
if (on('claims')) {
  const targets = new Map();
  const add = (who, g) => {
    if (!g || typeof g !== 'object' || !('open' in g)) return;
    const k = `${g.open}|${g.panel ?? ''}`;
    if (!targets.has(k)) targets.set(k, { open: g.open, panel: g.panel, who });
  };
  for (const [id, w] of Object.entries(C.CATALOGUE)) if (!C.isSame(w)) add(`catalogue ${id}`, w.go);
  for (const [k, n] of Object.entries(C.NEEDS)) add(`NEEDS ${k}`, n.go);
  for (const [k, n] of Object.entries(A.GROUP_NEEDS)) add(`GROUP_NEEDS ${k}`, n.open);
  for (const [id, d] of Object.entries(DECK)) for (const a of d.acts) add(`deck ${id}`, a);
  check(targets.size >= 60, `[claims] only ${targets.size} links were read`);
  const { ctx, page } = await phone({ width: 440, height: 956 });
  const byScreen = new Map();
  for (const t of targets.values()) byScreen.set(t.open, [...(byScreen.get(t.open) ?? []), t]);
  for (const [open, ts] of byScreen) {
    if (!(await go(page, open))) {
      for (const t of ts) problems.push(`[claims] ${t.who} opens "${open}", and no such screen opens`);
      continue;
    }
    for (const t of ts.filter((x) => x.panel)) {
      // the panel the words name: a panel whose title starts with it (as the deck's reveal finds it), or a pill of that name
      const found = await page.waitForFunction(({ open, panel }) => {
        const root = document.getElementById(`pg-${open.split('?')[0]}`);
        const up = (s) => (s ?? '').trim().toUpperCase();
        return [...(root?.querySelectorAll('.pn .ptitle') ?? [])].some((e) => up(e.textContent).startsWith(panel))
          || [...(root?.querySelectorAll('.secpill, .sheetpill, [role="tab"]') ?? [])].some((e) => up(e.textContent).startsWith(panel));
      }, { open, panel: t.panel }, { timeout: 6000 }).then(() => true, () => false);
      check(found, `[claims] ${t.who} sends him to ${open} → ${t.panel}, and that screen has no such panel or pill`);
    }
  }
  await ctx.close();
}

// ---------------------------------------------------------------- [counts] every hub's cards are its screens
if (on('counts')) {
  const { ctx, page } = await phone({ width: 440, height: 956 }, 'glass');
  // the hubs' own extra cards that are not screens, read from where they are added (ASK's microphone: shell/areas.ts)
  const extra = {};
  for (const m of src('apps/web/src/shell/areas.ts').matchAll(/if \(a\.id === '(\w+)'\) tools\.push\(\['(\w+)'/g)) extra[m[1]] = [...(extra[m[1]] ?? []), m[2]];
  for (const a of AD.AREAS) {
    const want = [...AD.hubTabs(a), ...(extra[a.id] ?? [])];
    if (!(await go(page, `area-${a.id}`))) { problems.push(`[counts] the ${a.id} hub does not open`); continue; }
    await page.waitForFunction((id) => document.querySelectorAll(`#pg-area-${id} .hubgrid > *`).length > 0, a.id, { timeout: 8000 }).catch(() => undefined);
    const got = await page.$$eval(`#pg-area-${a.id} .hubgrid > *`, (els) => els.map((e) => e.dataset.id));
    check(got.join(',') === want.join(','), `[counts] the ${a.id} hub draws ${got.length} cards (${got.join(',')}), its area has ${want.length} (${want.join(',')})`);
  }
  // the EDITORS card: one pill per editor, each the screen it names
  if (await go(page, 'area-make')) {
    const pills = await page.$$eval('#pg-area-make .hubtile[data-id="editors"] .hubpill', (b) => b.map((x) => x.dataset.editor));
    if (AD.folds(AD.AREAS.find((a) => a.id === 'make'))) check(pills.join(',') === AD.EDITORS.map((e) => e.id).join(','), `[counts] the EDITORS card's pills are ${pills.join(',')}, want ${AD.EDITORS.map((e) => e.id).join(',')}`);
  }
  await ctx.close();
}

// ---------------------------------------------------------------- [deadkeys] every key drawn has something listening to it
if (on('deadkeys')) {
  const { ctx, page } = await phone({ width: 440, height: 956 });
  const cdp = await ctx.newCDPSession(page);
  let plantedFound = false;
  await cdp.send('DOM.enable');
  await cdp.send('Runtime.enable');
  for (const id of TABS()) {
    if (!(await go(page, id))) { problems.push(`[deadkeys] ${id} does not open`); continue; }
    await page.waitForTimeout(700);
    // (this walk is the 440 sweep of [errors] too: its page's errors are counted, and nothing may scroll sideways)
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `[errors 440] ${id} scrolls sideways`);
    // (the check checks itself: on the first screen a key no one listens to is planted, and must be found)
    const planted = id === TABS()[0] && (await page.evaluate((id) => { const b = document.createElement('button'); b.className = 'planted'; b.textContent = 'PLANTED'; document.getElementById(`pg-${id}`)?.prepend(b); return true; }, id));
    // every visible button of the screen, marked so CDP can reach it
    const n = await page.evaluate((id) => {
      const els = [...document.querySelectorAll(`#pg-${id} button, #pg-${id} [role="button"]`)].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && !e.disabled && e.getAttribute('aria-disabled') !== 'true' && getComputedStyle(e).visibility !== 'hidden';
      });
      els.forEach((e, i) => (e.dataset.ckey = String(i)));
      return els.length;
    }, id);
    for (let i = 0; i < Math.min(n, 80); i++) {
      const { result } = await cdp.send('Runtime.evaluate', { expression: `document.querySelector('[data-ckey="${i}"]')` });
      if (!result.objectId) continue;
      // a listener on the key or on what it sits in (a list delegates to its rows), up to four steps; a key in a form submits it.
      // (the screen's own page listens for every tap to reveal its sections: a listener there hears nothing in particular, so
      // the walk stops below it)
      const heard = await (async () => {
        let obj = result.objectId;
        for (let up = 0; up < 5 && obj; up++) {
          const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: obj, depth: 0 });
          if (listeners.some((l) => /^(click|pointerdown|pointerup|mousedown|touchstart|touchend|submit|keydown)$/.test(l.type))) return true;
          const { result: p } = await cdp.send('Runtime.callFunctionOn', { objectId: obj, functionDeclaration: 'function(){ const p = this.parentElement; return !p || (p.id && p.id.startsWith("pg-")) ? null : p; }' });
          obj = p.objectId;
        }
        return false;
      })();
      if (!heard && planted && (await page.$eval(`[data-ckey="${i}"]`, (e) => e.classList.contains('planted')))) { plantedFound = true; continue; }
      if (!heard) {
        const what = await page.$eval(`[data-ckey="${i}"]`, (e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${(e.textContent ?? '').trim().slice(0, 30) || e.getAttribute('aria-label') || ''}"`);
        problems.push(`[deadkeys] ${id}: ${what} is drawn as a key and nothing listens to it`);
      }
    }
    await page.evaluate(() => { document.querySelectorAll('[data-ckey]').forEach((e) => delete e.dataset.ckey); document.querySelector('button.planted')?.remove(); });
  }
  check(plantedFound, '[deadkeys] the planted dead key was not found: the check cannot see a dead key');
  await ctx.close();
}

// ---------------------------------------------------------------- [errors] every screen at 440 and 390; Home and every hub in all seven looks
if (on('errors')) {
  // (440 is walked by [deadkeys] when it runs, screen by screen)
  for (const viewport of on('deadkeys') ? [{ width: 390, height: 844 }] : [{ width: 440, height: 956 }, { width: 390, height: 844 }]) {
    const { ctx, page } = await phone(viewport);
    for (const id of TABS()) {
      if (!(await go(page, id))) { problems.push(`[errors ${viewport.width}] ${id} does not open`); continue; }
      await page.waitForTimeout(500);
      check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `[errors ${viewport.width}] ${id} scrolls sideways`);
    }
    await page.screenshot({ path: `${out}/consistency-${viewport.width}.png` });
    await ctx.close();
  }
  const LOOKS = (await pure('packages/shared/src/looks.ts')).LOOKS;
  for (const look of LOOKS) {
    const { ctx, page } = await phone({ width: 390, height: 844 }, look.world);
    for (const id of process.env.FULL ? TABS() : ['core', ...AD.AREAS.map((a) => `area-${a.id}`)]) {
      if (!(await go(page, id))) problems.push(`[errors ${look.world}] ${id} does not open`);
      else await page.waitForTimeout(350);
    }
    await page.screenshot({ path: `${out}/consistency-${look.world}.png` });
    await ctx.close();
  }
}
problems.push(...[...new Set(errs)]);

await browser.close();
const secs = Math.round((Date.now() - started) / 1000);
if (problems.length) {
  console.log(`consistency: ${problems.length} problem(s) in ${secs} s`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log(`consistency: OK (every link a word gives lands on its screen and panel, every key path is a real key, one name per screen, every group's line a sentence, every hub's cards its screens, no dead keys, no errors on any screen at 440 and 390 or on any hub in the seven looks; ${secs} s)`);
