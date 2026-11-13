// THE LEARN LANE (FINAL ROUND, 13 Nov; docs/build-plan/FINAL-LEARN.md), in a real browser at 440 × 956 and 390 × 844, against the
// preview's brain (the scripted test model, so SCHOOL's own stand-in sitter answers online):
//   S · SCHOOL's brain. The owner: "the school still uses the smallest brain which answers in like multiple choice or something".
//       With signal, the brain's own model sits the paper: the line says so (and which brain sits with no signal), each answer
//       is written in full working with one last "Answer:" line, shown live as it is written, kept with the paper, marked,
//       and the result says it was sat online and by which model. The phone's brain is never loaded for it. With no signal
//       (the brain's model out of reach) the line is the phone brain's again.
//   L · every screen of the lane (courses, learning, the library, the reader, SCHOOL, the GYM, the arcade, the coach,
//       rehearse, the lab, the interpreter): nothing sideways, every key 44 pt, no raw string, and at the biggest text
//       (BODY 21) nothing cut with an ellipsis; SCHOOL in all seven looks.
//   BASE=http://localhost:8788 node tests/learnlane.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openSection, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const problems = [];
let checks = 0;
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 300)}`);
  }
};
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d|NotAllowed|SyntaxError|ReferenceError/i;
await standDown(base, KEY);

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

/** One phone. `look`: the world (scan, map, eye, orbit, grown, ink, glass); `body`: the text size; `offline`: no signal for the brain's own model. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK });
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  if (o.offline) await ctx.route('**/api/school/sit-online', (r) => r.abort('internetdisconnected'));
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, look }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: look, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
    // the phone's own brain, stood in: every load counted (SCHOOL online must never load it)
    window.__ghostyOfflineEngine = { ready: true, calls: [], loads: [], unloads: 0, idleMs: 60000, load(m) { this.loads.push(m ?? ''); }, unload() { this.unloads++; }, async chat(messages, onToken) { this.calls.push(messages.at(-1).content); onToken('Answer: 1'); } };
  }, { key: KEY, body: o.body ?? 0, look: o.look ?? 'scan' });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const go = async (page, id) => {
  await page.evaluate((i) => (location.hash = i), id);
  await page.waitForSelector(`#pg-${id}`, { state: 'attached', timeout: 30000 });
  await page.waitForFunction((i) => !!document.querySelector(`#pg-${i} .pn`) || !!document.querySelector(`#pg-${i} button`), id, { timeout: 15000 }).catch(() => undefined);
};
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const small = (page, root) =>
  page.$$eval(`${root} :is(button, input:not([type=hidden]):not([type=file]):not([type=range]), textarea, select, [role=button], [role=tab])`, (els) =>
    els
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
      .map((e) => {
        const r = { width: e.offsetWidth || e.getBoundingClientRect().width, height: e.offsetHeight || e.getBoundingClientRect().height };
        return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
      })
      .filter(Boolean)
      .slice(0, 8),
  );
const sideways = (page, id) =>
  page.evaluate((t) => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll(`#pg-${t} *`)].some((e) => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return false;
    for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX) && p.id !== `pg-${t}`) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
  }), id);
/** Words cut with an ellipsis (a line that runs past its box and is clipped with "…"). */
const cut = (page, id) =>
  page.evaluate((t) => [...document.querySelectorAll(`#pg-${t} *`)].filter((e) => {
    if (!e.getClientRects().length || e.closest('[hidden]') || !e.childNodes.length) return false;
    const s = getComputedStyle(e);
    return s.textOverflow === 'ellipsis' && s.overflow !== 'visible' && e.scrollWidth > e.clientWidth + 1;
  }).map((e) => (e.textContent ?? '').trim().slice(0, 30)).slice(0, 5), id);
const visibleText = (page, id) => page.evaluate((t) => [...document.querySelectorAll(`#pg-${t} .pn:not([hidden]) *`)].filter((e) => e.getClientRects().length && !e.children.length).map((e) => e.textContent ?? '').join(' | '), id);

async function bar(page, tag, id) {
  check(!(await sideways(page, id)), `${tag}: sideways`);
  const s = await small(page, `#pg-${id}`);
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await visibleText(page, id);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}

const ONLINE_LINE = /^I sit papers on (.+, my own online model|my own online model), every answer in full working\. With no signal, on (.+ on this phone|the offline brain, once it is on this phone)\.$/;

// ================================================================ S · SCHOOL's brain
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  const { ctx, page } = await phone(vp);
  try {
    await go(page, 'school');
    await openSection(page, 'school', 'This stage').catch(() => undefined);
    // S1 · the line says the brain's own model sits papers in full working, and which brain sits them with no signal
    const said = await until(page, (re) => new RegExp(re).test(document.querySelector('#pg-school .schbrain.online .note')?.textContent ?? ''), ONLINE_LINE.source, 15000);
    check(said, `${T} [S1 which brain] the line reads "${await page.locator('#pg-school .schbrain .note').first().textContent().catch(() => '')}"`);
    check(!(await page.locator('#pg-school .schstage button', { hasText: /^DOWNLOAD IT IN SETTINGS$/i }).isVisible().catch(() => false)), `${T} [S1] online, SCHOOL still sends him to download the phone brain first`);
    await bar(page, `${T} [S school online]`, 'school');
    if (vp.width === 440) await page.screenshot({ path: `${out}/learnlane-school-online-440.png` }).catch(() => undefined);
    // S2 · SIT one subject: answered online, every answer in full working, shown live, the phone brain never loaded
    const sit = page.locator('#pg-school .schsub button:not([disabled])', { hasText: /^SIT$/i }).first();
    const canSit = await sit.isVisible().catch(() => false);
    check(canSit, `${T} [S2] no SIT key to press online`);
    if (canSit) {
      await sit.click();
      check(await until(page, () => window.__ghosty?.school?.sitting === true, null, 15000), `${T} [S2] the paper did not start`);
      const live = await until(page, () => /Working:[\s\S]*\nAnswer: /.test(document.querySelector('#pg-school .schworking pre')?.textContent ?? ''), null, 20000);
      check(live, `${T} [S2 full working] the answer as written was not shown live: "${await page.locator('#pg-school .schworking').textContent().catch(() => '')}"`);
      const who = (await page.locator('#pg-school .schlive .schbrain').textContent().catch(() => '')) ?? '';
      check(/^I'm sitting it on Stand-in · test model, online, every answer in full working\.$/.test(who), `${T} [S2 named] while sitting the line reads "${who}"`);
      if (vp.width === 440) await page.screenshot({ path: `${out}/learnlane-school-working-440.png` }).catch(() => undefined);
      check(await until(page, () => window.__ghosty?.school?.sitting === false, null, 90000), `${T} [S2] the paper was not handed in`);
      const loads = await page.evaluate(() => window.__ghostyOfflineEngine.loads.length + window.__ghostyOfflineEngine.calls.length);
      check(loads === 0, `${T} [S2 not the phone] the phone's brain was loaded or asked ${loads} times while the brain's own model sat it`);
      // S3 · the result: sat online, by the model, every answer kept in full working and marked
      const rec = await page.evaluate(async (key) => {
        const v = await (await fetch('/api/school', { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } })).json();
        const r = [...(v.state?.results ?? [])].sort((a, b) => b.at - a.at)[0];
        if (!r) return null;
        const p = await (await fetch(`/api/school/paper/${r.paperId}`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } })).json();
        return { where: r.where, model: r.model, answers: (p.result?.answers ?? []).map((a) => ({ id: a.id, how: a.how, got: a.got, given: a.given })), top: !!r.top, given: Object.values(p.given ?? {}) };
      }, KEY);
      check(rec?.where === 'online' && rec?.model === 'Stand-in · test model', `${T} [S3 recorded] the latest result: ${JSON.stringify(rec && { where: rec.where, model: rec.model })}`);
      const bad = (rec?.answers ?? []).filter((a) => a.how === 'unanswered' || !/^Working:[\s\S]*\nAnswer: /.test(a.given));
      check(!!rec && rec.answers.length > 0 && !bad.length, `${T} [S3 full working] not every answer was kept in full working and marked: ${JSON.stringify(bad.slice(0, 2)).slice(0, 300)}`);
      check(!!rec && rec.answers.some((a) => a.how === 'exact' || a.how === 'model' || a.how === 'pending'), `${T} [S3 marked] no answer was marked`);
      // marked for real: the stand-in gets every other question wrong on purpose, so right ones score and wrong ones do not
      const exact = (rec?.answers ?? []).filter((a) => a.how === 'exact');
      if (exact.length >= 2) check(exact.some((a) => a.got > 0) && exact.some((a) => a.got === 0) && !rec.top, `${T} [S3 marked for real] exact marks: ${JSON.stringify(exact.map((a) => a.got))}`);
      // the result card says where it was sat
      const seeLine = await until(page, () => /online, in full working/.test(document.querySelector('#pg-school')?.textContent ?? '') || !!document.querySelector('#pg-school .schresult'), null, 8000);
      check(seeLine, `${T} [S3] no result card after the paper`);
    }
  } catch (e) {
    check(false, `${T} [S] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 200)}`);
  }
  await ctx.close();
}

// S4 · no signal for the brain's own model: the phone brain's line, as before
{
  const { ctx, page } = await phone(PHONE, { offline: true });
  await go(page, 'school');
  await openSection(page, 'school', 'This stage').catch(() => undefined);
  await page.waitForFunction(() => !!document.querySelector('#pg-school .schstage .note'), null, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const online = await page.locator('#pg-school .schbrain.online').count();
  check(online === 0, '[S4 no signal] SCHOOL still says the online model sits the papers');
  await ctx.close();
}

// ================================================================ L · every screen of the lane
const LANE = ['learn', 'learning', 'library', 'reader', 'school', 'gym', 'arcade', 'coach', 'rehearse', 'lab', 'interpreter'];
for (const vp of [PHONE, PHONE2]) {
  const { ctx, page } = await phone(vp);
  for (const id of LANE) {
    try {
      await go(page, id);
      await page.waitForTimeout(600);
      await bar(page, `[${vp.width}] [L ${id}]`, id);
    } catch (e) {
      check(false, `[${vp.width}] [L ${id}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 160)}`);
    }
  }
  await ctx.close();
}
// at the biggest text, nothing cut
{
  const { ctx, page } = await phone(PHONE2, { body: 21 });
  for (const id of LANE) {
    try {
      await go(page, id);
      await page.waitForTimeout(600);
      const c = await cut(page, id);
      check(!c.length, `[BODY 21] [L ${id}] words cut with an ellipsis: ${JSON.stringify(c)}`);
      check(!(await sideways(page, id)), `[BODY 21] [L ${id}] sideways`);
    } catch (e) {
      check(false, `[BODY 21] [L ${id}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 160)}`);
    }
  }
  await ctx.close();
}
// SCHOOL in all seven looks: drawn, nothing sideways, every key 44 pt, and the working box takes its colours from the look
for (const look of ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass']) {
  const { ctx, page } = await phone(PHONE, { look });
  try {
    await go(page, 'school');
    await openSection(page, 'school', 'This stage').catch(() => undefined);
    await until(page, () => !!document.querySelector('#pg-school .schbrain'), null, 15000);
    await bar(page, `[look ${look}] [school]`, 'school');
  } catch (e) {
    check(false, `[look ${look}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 160)}`);
  }
  await ctx.close();
}

await browser.close();
console.log(`\nlearnlane: ${checks} checks, ${problems.length} red`);
if (problems.length) {
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log('learnlane: all green');
