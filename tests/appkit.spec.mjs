// THE APP KIT (APPS ROUND, consistency; apps/web/src/ui/appkit.ts): the frame every app is built from, checked through its worked
// example (kitDemo, a packing list).
// - The first run shows sample data and a three-step tour, never an empty screen.
// - Search inside the app, with its own empty words.
// - A delete goes to RECENTLY DELETED with a calm notice under the header; Undo and Redo; a restore from the settings sheet.
// - Export as CSV and JSON; the loading (skeleton), empty and error states in plain words.
// - Kept on the phone across a reload.
// - One scroll area: the page never scrolls sideways, and every key is 44 pt, in all seven looks at 440 and 390.
import { launch } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const problems = [];
const check = (ok, what) => ok || problems.push(what);
const T0 = Date.now();
const WORLDS = ['glass', 'eye', 'grown', 'ink', 'map', 'orbit', 'scan'];

async function open(viewport, world) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${world}] pageerror: ${e.message}`));
  await page.addInitScript((world) => {
    localStorage.setItem('ghosty.ownerKey', 'preview-owner-key-0123456789');
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, look: { ground: 'graphite', world, night: 'graphite', switches: {} } }));
  }, world);
  await page.goto(`${base}/#core`);
  await page.waitForFunction(() => !!window.__ghosty?.appkit, null, { timeout: 30000 });
  return { ctx, page };
}
const demo = (page) => page.evaluate(() => { window.__kit = window.__ghosty.appkit.demo(); return true; });
const st = (page) => page.evaluate(() => ({ ...window.__ghosty.appkit.state.kitdemo }));
const rows = (page) => page.$$eval('.ak-demo .ak-row .ak-rowtitle', (e) => e.map((x) => x.textContent));

// ---- the whole app, once, at 440 in Glass
{
  const { ctx, page } = await open(PHONE, 'glass');
  await demo(page);
  check((await rows(page)).join() === 'Passport,Phone charger,Walking boots', `[first run] the sample: ${await rows(page)}`);
  const tour = await page.textContent('.ak-demo .ak-tour').catch(() => '');
  check(/1 of 3/.test(tour), `[first run] the tour: "${tour}"`);
  for (let i = 0; i < 3; i++) await page.click('.ak-demo .ak-tour button');
  check(await page.locator('.ak-demo .ak-tour').isHidden(), '[first run] the tour did not end after three steps');
  // search
  await page.click('.ak-demo .ak-head button[aria-label="Search"]');
  await page.fill('.ak-demo .ak-find', 'boot');
  check((await rows(page)).join() === 'Walking boots', `[search] "boot" shows ${await rows(page)}`);
  await page.fill('.ak-demo .ak-find', 'zzz');
  check(/No items match/.test(await page.textContent('.ak-demo .ak-body')), '[search] no match has no words of its own');
  await page.click('.ak-demo .ak-state button');
  check((await rows(page)).length === 3, '[search] Clear search did not bring the list back');
  // delete, notice, undo, redo
  await page.click('.ak-demo .ak-row[data-id="s1"] .ak-rowdel');
  const note = await page.textContent('.ak-demo .ak-notice');
  check(/Deleted “Passport”.*Recently deleted/.test(note) && (await st(page)).bin === 1, `[delete] the notice: "${note}"`);
  const nb = await page.evaluate(() => { const n = document.querySelector('.ak-demo .ak-notice').getBoundingClientRect(); const h = document.querySelector('.ak-demo .ak-head').getBoundingClientRect(); return { top: n.top, headBottom: h.bottom, height: n.height }; });
  check(nb.top >= nb.headBottom - 1 && nb.top - nb.headBottom < 24 && nb.height < 60, `[notice] not small and under the header: ${JSON.stringify(nb)}`);
  await page.click('.ak-demo .ak-tools button[aria-label="Undo"]');
  check((await rows(page))[0] === 'Passport', `[undo] Undo did not put it back: ${await rows(page)}`);
  await page.click('.ak-demo .ak-tools button[aria-label="Redo"]');
  check(!(await rows(page)).includes('Passport'), '[redo] Redo did not delete it again');
  await page.click('.ak-demo .ak-tools button[aria-label="Add"]');
  check((await rows(page))[0] === 'New item 3', `[add] Add: ${await rows(page)}`);
  // settings: a switch, export, recently deleted and its restore
  await page.click('.ak-demo .ak-head button[aria-label="Settings"]');
  await page.click('.ak-demo .ak-switch[data-id="done"]');
  check((await page.getAttribute('.ak-demo .ak-switch[data-id="done"]', 'aria-checked')) === 'false', '[settings] the switch did not turn off');
  await page.click('.ak-demo .ak-bin .ak-rowmain');
  check((await rows(page)).includes('Passport') && (await st(page)).bin === 0, '[bin] Recently deleted did not put Passport back');
  const csv = await page.evaluate(() => window.__kit.exportAs('csv'));
  check(csv.name === 'kitdemo.csv' && /^id,title,sub,meta/.test(csv.text) && /Walking boots/.test(csv.text), `[export] CSV: ${JSON.stringify(csv).slice(0, 160)}`);
  const json = await page.evaluate(() => JSON.parse(window.__kit.exportAs('json').text).length);
  check(json === 4, `[export] JSON holds ${json} items`);
  // the states, in plain words
  await page.evaluate(() => window.__kit.state('loading', 'Loading your items'));
  check((await page.locator('.ak-demo .ak-skel .ak-skelrow').count()) === 4, '[states] loading shows no skeleton');
  await page.evaluate(() => window.__kit.state('error', 'Could not read the list. Try again.', { word: 'Try again', run: () => window.__kit.state('ready') }));
  check(await page.locator('.ak-demo .ak-error[role="alert"] button').isVisible(), '[states] the error has no fix key');
  await page.click('.ak-demo .ak-error button');
  check((await rows(page)).length === 4, '[states] the fix did not bring the list back');
  // kept on the phone
  await page.reload();
  await page.waitForFunction(() => !!window.__ghosty?.appkit, null, { timeout: 30000 });
  await demo(page);
  check((await rows(page)).length === 4 && (await page.locator('.ak-demo .ak-tour').isHidden()), `[kept] after a reload: ${await rows(page)}`);
  await page.screenshot({ path: `${out}/appkit-glass-440.png` });
  await ctx.close();
}

// ---- every look, at 440 and 390: one scroll area, nothing sideways, every key a finger's
for (const vp of [PHONE, { width: 390, height: 844 }]) {
  for (const world of WORLDS) {
    const { ctx, page } = await open(vp, world);
    await demo(page);
    await page.evaluate(() => { for (let i = 0; i < 30; i++) window.__kit.add({ id: `x${i}`, title: `A long item name that wraps on a phone ${i}`, sub: 'Other', meta: `${i}` }); });
    const m = await page.evaluate(() => {
      const app = document.querySelector('.ak-demo .ak-app');
      const body = app.querySelector('.ak-body');
      const scrollers = [...app.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      const small = [...app.querySelectorAll('button')].filter((b) => b.getClientRects().length).map((b) => b.getBoundingClientRect()).filter((r) => r.height < 43.5 || r.width < 43.5).length;
      const wide = [...app.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).length;
      // (a row's words never run under its number or its delete key)
      const over = [...app.querySelectorAll('.ak-row')].filter((r) => { const t = r.querySelector('.ak-rowtitle').getBoundingClientRect(); const m = (r.querySelector('.ak-rowmeta') ?? r.querySelector('.ak-rowdel')).getBoundingClientRect(); return t.right > m.left + 0.5; }).length;
      return { over, scrollers: scrollers.length, body: scrollers[0] === body, small, wide, sideways: document.documentElement.scrollWidth > innerWidth, toolsBottom: Math.round(innerHeight - app.querySelector('.ak-tools').getBoundingClientRect().bottom) };
    });
    check(m.scrollers === 1 && m.body, `[scroll ${world} ${vp.width}] scroll areas: ${JSON.stringify(m)}`);
    check(!m.small && !m.wide && !m.sideways && !m.over, `[fit ${world} ${vp.width}] ${JSON.stringify(m)}`);
    check(m.toolsBottom >= 0 && m.toolsBottom < 60, `[thumb ${world} ${vp.width}] the keys are not at the bottom: ${m.toolsBottom}`);
    if (vp.width === 390) await page.screenshot({ path: `${out}/appkit-${world}-390.png` });
    await ctx.close();
  }
}

await browser.close();
const s = Math.round((Date.now() - T0) / 1000);
if (problems.length) {
  console.log(`appkit: ${problems.length} problem(s) in ${s} s`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log(`appkit: OK (the kit's example app: first run with sample data and a three-step tour, search, delete to Recently deleted with a calm notice, undo and redo, settings, export CSV and JSON, loading, empty and error states, kept across a reload; one scroll area, nothing sideways and every key 44 pt in all seven looks at 440 and 390; ${s} s)`);
