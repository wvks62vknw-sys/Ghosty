// The Memory tab's ME and DIARY panels: the profile drawn from the brain (stubbed first, exact
// values), a line added and removed, a diary entry opened, REFLECT NOW's toast — then, through
// the preview brain's scripted model, a real reflection over two things the owner said.
//   node tests/memory.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

const profile = () => ({ summary: 'A bridge engineer in Kings Heath who likes flat whites.', sections: { about: ['bridge engineer'], likes: ['flat whites', 'rain on the window'], dislikes: [], people: ['Ann is my sister'], places: ['Kings Heath'], routines: [], goals: ['run a half marathon'], work: [], other: [] }, updatedAt: Date.now() });
const diary = [
  { heading: '2026-10-17', text: 'Today the owner told me about the race. We decided to train on Tuesdays. Follow up: a plan.', rid: 2 },
  { heading: '2026-10-16', text: 'A quiet day of questions about bridges.', rid: 1 },
];

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  const state = { profile: profile(), reflected: 0 };
  const stub = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/profile/reflect') {
      state.reflected++;
      return json({ ok: true, facts: ['runs on Tuesdays'], lines: [{ section: 'routines', text: 'trains on Tuesdays' }], diary: 'x', summary: state.profile.summary, profile: state.profile });
    }
    if (req.method() === 'GET') return json({ profile: state.profile, diary, lastReflect: Date.now() - 3600_000 });
    if (req.method() === 'POST') {
      const b = req.postDataJSON();
      state.profile.sections[b.section].push(b.text);
      return json({ profile: state.profile, added: true });
    }
    if (req.method() === 'DELETE') {
      state.profile.sections[url.searchParams.get('section')].splice(Number(url.searchParams.get('i')), 1);
      return json({ profile: state.profile, removed: true });
    }
    return route.continue();
  };
  await page.route('**/api/profile**', stub);
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.evaluate(() => (location.hash = 'memory'));
  const me = page.locator('#pg-memory .pn.me');
  await me.waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('#pg-memory .pn.me')?.textContent?.includes('flat whites'), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] the ME panel did not show the profile`));
  const text = (await me.textContent()) ?? '';
  if (!/A bridge engineer in Kings Heath/.test(text)) problems.push(`[${name}] no summary line in ME`);
  if (!/LIKES/i.test(text) || !/rain on the window/.test(text) || !/Ann is my sister/.test(text)) problems.push(`[${name}] ME is missing section lines: ${text.slice(0, 200)}`);
  if (!/6 LINES/.test(text)) problems.push(`[${name}] ME status should count 6 lines: ${text.slice(0, 120)}`);
  await page.waitForTimeout(600); // the panes settle into place with a short animation
  await page.screenshot({ path: `${out}/${name}-memory-me.png` });
  // add a line under ROUTINES
  await me.locator('select').selectOption('routines');
  await me.locator('input').fill('I run on Tuesdays');
  await me.locator('button:has-text("ADD")').click();
  await page.waitForFunction(() => document.querySelector('#pg-memory .pn.me')?.textContent?.includes('I run on Tuesdays'), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] the added line did not appear`));
  if (!/ROUTINES/i.test((await me.textContent()) ?? '')) problems.push(`[${name}] the ROUTINES section did not appear`);
  // remove it again (the ✕ on its row)
  const added = me.locator('.rw', { hasText: 'I run on Tuesdays' });
  await added.locator('.del').click();
  await page.waitForFunction(() => !document.querySelector('#pg-memory .pn.me')?.textContent?.includes('I run on Tuesdays'), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] the removed line is still there`));
  // the DIARY (other column on phones): newest first, opens in a modal; REFLECT NOW toasts what changed
  const narrow = viewport.width < 900;
  if (narrow) await page.click('#pg-memory .swap');
  const dp = page.locator('#pg-memory .pn', { has: page.locator('h3:has-text("DIARY")') });
  await dp.waitFor({ state: 'visible', timeout: 8000 });
  const rows = dp.locator('.rw');
  await rows.first().waitFor({ state: 'attached', timeout: 8000 }).catch(() => undefined);
  const first = (await rows.first().textContent()) ?? '';
  if (!/2026-10-17/.test(first)) problems.push(`[${name}] the diary is not newest first: "${first.slice(0, 60)}"`);
  await rows.first().click();
  const modalText = await page.locator('.modal .mbody').textContent({ timeout: 5000 }).catch(() => '');
  if (!/We decided to train on Tuesdays/.test(modalText ?? '')) problems.push(`[${name}] the diary entry did not open in a modal`);
  await page.screenshot({ path: `${out}/${name}-memory-diary.png` });
  await page.keyboard.press('Escape');
  await dp.locator('button:has-text("REFLECT NOW")').click();
  await page.waitForFunction(() => /Reflected: 1 new fact, 1 line about you/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] no toast after REFLECT NOW`));
  if (state.reflected !== 1) problems.push(`[${name}] REFLECT NOW called the brain ${state.reflected} times`);
  await page.unroute('**/api/profile**', stub);

  // the real thing: two things said in chat, then a reflection by the preview brain's scripted model
  if (narrow) await page.click('#pg-memory .swap');
  await page.evaluate(() => (location.hash = 'core'));
  if (narrow) await page.click('.logbtn');
  for (const line of ['I like flat whites', 'I like walks in Kings Heath']) {
    await page.fill('#cin', line);
    await page.keyboard.press('Enter');
    await page.waitForFunction((l) => document.body.innerText.includes(`Mock reply to: ${l.toLowerCase()}`), line, { timeout: 10000 }).catch(() => problems.push(`[${name}] no reply to "${line}"`));
  }
  if (narrow) await page.click('.logbtn');
  await page.evaluate(() => (location.hash = 'memory'));
  await page.waitForTimeout(600);
  if (narrow) await page.click('#pg-memory .swap');
  await dp.locator('button:has-text("REFLECT NOW")').click();
  await page.waitForFunction(() => /Reflected: /.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => problems.push(`[${name}] the real reflection gave no toast`));
  if (narrow) await page.click('#pg-memory .swap');
  await page.waitForFunction(() => /flat whites/.test(document.querySelector('#pg-memory .pn.me')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] the real reflection did not put "flat whites" in the profile`));
  const real = (await me.textContent()) ?? '';
  if (!/walks in Kings Heath/.test(real)) problems.push(`[${name}] the second thing said is missing from the profile: ${real.slice(0, 200)}`);
  await page.screenshot({ path: `${out}/${name}-memory-reflected.png` });
  await ctx.close();
}

await run('desktop', { width: 1440, height: 900 });
await run('phone', { width: 390, height: 844 });
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Memory run clean: ME, DIARY and REFLECT NOW work.');
process.exit(problems.length ? 1 : 0);
