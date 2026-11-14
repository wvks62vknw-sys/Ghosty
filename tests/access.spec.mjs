// ACCESSIBILITY (APPS ROUND, consistency; packages/shared/src/themes.ts EASY, ui/dials.ts, state/theme.ts easyArgs): one switch for
// the easiest reading, checked in all seven looks at 440 and 390.
// - On THE LOOK's dials, Accessibility is the first switch row. ON sets the reading switches together: body 21, calm motion, no
//   glow, no floor, the phone's own type, and the colour-blind-safe colours.
// - The words grow, nothing pokes out sideways, and every key stays 44 pt.
// - OFF puts back the switches he had before, not the defaults.
// - Said in the chat ("accessibility on" / "accessibility off"), answered on the phone with no model.
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
const until = (page, fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(what), false));
// (his own switches before: a body of 19 and mono readings, which OFF must give back)
const MINE = { glow: 'on', floor: 'on', corners: 'world', readings: 'mono', body: 19, motion: 'alive', sound: 'tone', day: 'off', safe: 'off' };

async function open(viewport, world) {
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${world}] pageerror: ${e.message}`));
  await page.addInitScript(([world, mine]) => {
    localStorage.setItem('ghosty.ownerKey', 'preview-owner-key-0123456789');
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, look: { ground: 'graphite', world, night: 'graphite', switches: mine } }));
  }, [world, MINE]);
  await page.goto(`${base}/#look`);
  await page.waitForFunction(() => document.body.dataset.tab === 'look' && !!document.querySelector('#pg-look .secpill[data-sec="themes"]'), null, { timeout: 30000 });
  await page.click('#pg-look .secpill[data-sec="themes"]');
  await until(page, () => !!document.querySelector('#pg-look .gswitch[data-switch="easy"]'), null, 8000, `[${world}] no Accessibility row on THE LOOK`);
  return { ctx, page };
}
const html = (page) => page.evaluate(() => { const d = document.documentElement.dataset; return { body: d.body, motion: d.motion, glow: d.glow, floor: d.floor, readings: d.readings, safe: d.safe }; });
const tap = async (page, val) => {
  const b = page.locator(`#pg-look .gswitch[data-switch="easy"] button[data-val="${val}"]`);
  await b.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => undefined);
  await b.click({ timeout: 6000 });
};

for (const vp of [PHONE, { width: 390, height: 844 }]) {
  for (const world of WORLDS) {
    const tag = `${world} ${vp.width}`;
    const { ctx, page } = await open(vp, world);
    const first = await page.evaluate(() => document.querySelector('#pg-look .gdial[data-dial="switches"] .gswitch')?.dataset.switch);
    check(first === 'easy', `[${tag}] the first switch row is ${first}, not Accessibility`);
    const sizeBefore = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#pg-look .gswitch[data-switch="easy"] .gswitch-line')).fontSize));
    await tap(page, 'on');
    await until(page, () => document.documentElement.dataset.body === '21', null, 4000, `[${tag}] ON did not set the body to 21`);
    const on = await html(page);
    check(JSON.stringify(on) === JSON.stringify({ body: '21', motion: 'calm', glow: 'off', floor: 'off', readings: 'system', safe: 'on' }), `[${tag}] ON set ${JSON.stringify(on)}`);
    const m = await page.evaluate(() => {
      const row = document.querySelector('#pg-look .gswitch[data-switch="easy"]');
      const keys = [...row.querySelectorAll('button')].map((b) => b.getBoundingClientRect());
      const root = document.getElementById('pg-look');
      const wide = [...root.querySelectorAll('.gdial *')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 0.5).length;
      return { size: parseFloat(getComputedStyle(row.querySelector('.gswitch-line')).fontSize), small: keys.filter((r) => r.height < 43.5 || r.width < 43.5).length, wide, sideways: document.documentElement.scrollWidth > innerWidth, chosen: row.querySelector('button[data-val="on"]').getAttribute('aria-checked') };
    });
    check(m.size > sizeBefore, `[${tag}] the words did not grow (${sizeBefore} → ${m.size})`);
    check(!m.small && !m.wide && !m.sideways && m.chosen === 'true', `[${tag}] with Accessibility on: ${JSON.stringify(m)}`);
    if (vp.width === 390) await page.screenshot({ path: `${out}/access-${world}-390.png` });
    await tap(page, 'off');
    await until(page, () => document.documentElement.dataset.body === '19', null, 4000, `[${tag}] OFF did not put his body of 19 back`);
    const off = await html(page);
    check(off.readings === 'mono' && off.motion === 'alive' && off.glow === 'on' && off.safe === 'off', `[${tag}] OFF gave ${JSON.stringify(off)}, not his own switches`);
    await ctx.close();
  }
}

// ---- by words, in the chat, answered on the phone
{
  const { ctx, page } = await open(PHONE, 'glass');
  await page.goto(`${base}/#core`);
  await page.waitForSelector('#cin', { timeout: 20000 });
  const say = async (words, re) => {
    await page.fill('#cin', words);
    await page.press('#cin', 'Enter');
    return until(page, (src) => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => new RegExp(src).test(m.textContent ?? '')), re.source, 8000, `[chat] "${words}" had no reply like ${re}`);
  };
  await say('accessibility on', /Accessibility on: body text at 21 points/);
  check((await html(page)).body === '21', '[chat] "accessibility on" did not set the body to 21');
  await say('accessibility off', /Accessibility off: your own switches are back/);
  check((await html(page)).body === '19', '[chat] "accessibility off" did not put his 19 back');
  await ctx.close();
}

await browser.close();
const s = Math.round((Date.now() - T0) / 1000);
if (problems.length) {
  console.log(`access: ${problems.length} problem(s) in ${s} s`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log(`access: OK (one Accessibility switch, the first row of THE LOOK's switches, in all seven looks at 440 and 390: on sets body 21, calm motion, no glow or floor, the phone's type and colour-blind-safe colours, the words grow, nothing sideways, every key 44 pt; off puts his own switches back; "accessibility on" and "off" in the chat with no model; ${s} s)`);
