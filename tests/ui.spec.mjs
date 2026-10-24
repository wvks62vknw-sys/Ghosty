// Drives the built interface in Chromium against the preview server and saves screenshots.
//   node tests/ui.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { DESKTOP, PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...UK });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) problems.push(`[${name}] console: ${m.text()}`);
  });
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  // pairing screen (no Cloudflare Access locally)
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-core.png` });
  // talk to Ghosty (scripted model): memory tool + reply
  const narrow = viewport.width < 1240;
  if (narrow) await page.click('.logbtn');
  await page.fill('#cin', 'remember I like flat whites');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => /I’ll remember that|I already know that/.test(document.body.innerText), null, { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}-chat.png` });
  // approval flow
  await page.fill('#cin', 'forget everything');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.approval button.on', { timeout: 10000 });
  await page.screenshot({ path: `${out}/${name}-approval.png` });
  await page.click('.approval button.on');
  await page.waitForFunction(() => document.body.innerText.includes('Approved.') && /Erased \d+ fact/.test(document.body.innerText), null, { timeout: 10000 });
  if (narrow) await page.click('.logbtn');
  // a widget, opened in its sandbox
  await page.fill('#cin', 'make a widget');
  await page.keyboard.press('Enter');
  // it opens on screen straight away, running in its sandbox
  const opened = await page.waitForSelector('.modal iframe.sandbox', { timeout: 10000 }).then(() => true, () => false);
  if (!opened) problems.push(`[${name}] the new widget did not open on screen`);
  else {
    await page.waitForTimeout(1200);
    const t = await page.frameLocator('.modal iframe.sandbox').locator('h1').textContent({ timeout: 5000 }).catch(() => '');
    if (!/\d/.test(t ?? '')) problems.push(`[${name}] the opened widget is not running (got "${t}")`);
    await page.click('.modal .mhead button');
  }
  for (const tab of ['eye', 'brief', 'threats', 'markets', 'memory', 'workshop', 'system']) {
    await page.evaluate((t) => (location.hash = t), tab);
    await page.waitForTimeout(tab === 'eye' ? 4000 : 900);
    await page.screenshot({ path: `${out}/${name}-${tab}.png` });
  }
  // the stopwatch (core/stopwatch.ts) has the replies above and the tabs just opened, in plain words
  const speed = await page.evaluate(() => window.__ghosty?.stopwatch?.summary()).catch((e) => ({ error: String(e) }));
  const screens = new Set((speed?.screens ?? []).map((s) => s.id));
  // (today's, or last week's when the run crossed midnight)
  const timed = (k) => (speed?.replies?.today?.[k]?.n ?? 0) + (speed?.replies?.week?.[k]?.n ?? 0);
  if (!timed('first') || !timed('done')) problems.push(`[${name}] the stopwatch has no reply timed: ${String(JSON.stringify(speed)).slice(0, 300)}`);
  else if (!screens.has('eye') || !screens.has('brief')) problems.push(`[${name}] the stopwatch has no tab times for God's Eye and Brief: ${[...screens].join(', ')}`);
  else if (!speed.lines.some((l) => /^Replies: (first word in |none timed yet today · last week )/.test(l)) || !speed.lines.some((l) => /^Screens: /.test(l)) || !speed.lines.some((l) => /^Brain round trip /.test(l))) problems.push(`[${name}] the stopwatch's lines are missing: ${speed.lines.join(' | ')}`);
  // open the widget from the workshop
  await page.evaluate(() => (location.hash = 'workshop'));
  await page.waitForTimeout(800);
  if (viewport.width < 900) await page.click('#pg-workshop .swap');
  const w = page.locator('#pg-workshop .rw.link .v').first();
  // the list fills from the brain; on a slow runner that takes a moment
  await w.waitFor({ state: 'attached', timeout: 15000 }).catch(() => undefined);
  if (await w.count()) {
    await w.click();
    await page.waitForTimeout(1800);
    const frame = page.frameLocator('iframe.sandbox');
    const txt = await frame.locator('#t').textContent({ timeout: 5000 }).catch(() => '');
    if (!/\d/.test(txt ?? '')) problems.push(`[${name}] widget did not run its script (got "${txt}")`);
    await page.screenshot({ path: `${out}/${name}-widget.png` });
    await page.keyboard.press('Escape');
  } else problems.push(`[${name}] widget not listed in workshop`);
  // fly via the brain's client command
  await page.evaluate(() => (location.hash = 'core'));
  await page.fill('#cin', 'fly to tokyo');
  await page.keyboard.press('Enter');
  // the brain answers with a client command; wait for the camera to be sent there rather than a fixed pause
  const flew = await page.waitForFunction(() => {
    const t = window.__ghosty?.globe?.cam?.target;
    return !!t && Math.abs(t.lon - 139.7) < 1 && Math.abs(t.lat - 35.7) < 1;
  }, null, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!flew) problems.push(`[${name}] fly_to did not target Tokyo: ${JSON.stringify(await page.evaluate(() => window.__ghosty.globe.cam.target))}`);
  const hud = await page.evaluate(() => ({ readout: document.querySelector('.readout')?.textContent ?? '', targetHidden: document.querySelector('.eyeinfo')?.hidden }));
  if (!hud.readout.includes('ALT')) problems.push(`[${name}] globe readout empty`);
  await page.screenshot({ path: `${out}/${name}-fly.png` });
  const fps = await page.evaluate(() => document.querySelector('#pg-system') ? 'ok' : 'no');
  await ctx.close();
  return fps;
}

// fixes A2, at a narrow 390 × 844 phone and the owner's iPhone 18 Pro Max (440 × 956):
// - the God's eye chip (Home's suggestions) and God's Eye's own bar and LOOK chips start inside the screen;
// - System opens on its Status card, before the Brain group;
// - grouped lists (Settings, System, Links): no row's name or value is cut ("Unsupport", "Offline brain report…").
async function fixesA2(viewport) {
  const name = `a2 ${viewport.width}`;
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...UK });
  await ctx.addInitScript((k) => localStorage.setItem('ghosty.ownerKey', k), 'preview-owner-key-0123456789');
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.waitForTimeout(1200);
  const outside = (sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => {
    const r = e.getBoundingClientRect();
    return r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 ? `"${(e.dataset.label || e.textContent || '').trim().slice(0, 30)}" at ${Math.round(r.left)}–${Math.round(r.right)} × ${Math.round(r.top)}–${Math.round(r.bottom)}` : '';
  }).filter(Boolean));
  // Home: every suggestion chip, God's eye included, on screen without scrolling the strip
  const chips = await page.$$eval('#suggest > button', (bs) => bs.map((b) => b.dataset.label || b.textContent.trim()));
  if (!chips.some((c) => /God/.test(c))) problems.push(`[${name}] no God's eye chip on Home (${chips.join(', ')})`);
  for (const o of await outside('#suggest > button')) problems.push(`[${name}] a Home chip starts off-screen: ${o}`);
  await page.screenshot({ path: `${out}/a2-${viewport.width}-home.png` });
  // God's Eye: THIS SPOT and VIEW, and the LOOK menu's chips
  await page.evaluate(() => (location.hash = 'eye'));
  await page.waitForSelector('#pg-eye .bgroup', { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(2500);
  for (const o of await outside('#pg-eye .bgroup, #pg-eye .bgroup > *')) problems.push(`[${name}] God's Eye bar starts off-screen: ${o}`);
  await page.screenshot({ path: `${out}/a2-${viewport.width}-eye.png` });
  await page.locator('#pg-eye .bgroup button', { hasText: /^look$/i }).click().catch(() => problems.push(`[${name}] no LOOK on God's Eye`));
  await page.waitForTimeout(400);
  for (const o of await outside('#pg-eye .lookmenu .chips button')) problems.push(`[${name}] a LOOK chip starts off-screen: ${o}`);
  await page.keyboard.press('Escape');
  // System: Status first
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForFunction(() => document.querySelector('#pg-system.listmode .pn.keepcard'), null, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(1500);
  const order = await page.$$eval('#pg-system .pn', (ps) => ps.map((p) => ({ t: p.querySelector('.ptitle')?.textContent ?? '', top: p.getBoundingClientRect().top })));
  if (order[0]?.t !== 'STATUS') problems.push(`[${name}] System opens on ${order[0]?.t}, not STATUS (${order.map((o) => o.t).join(', ')})`);
  const st = order.find((o) => o.t === 'STATUS');
  const keys = order.find((o) => o.t === 'KEYS');
  if (st && keys && !(st.top < keys.top)) problems.push(`[${name}] the Status card is drawn below the Brain group`);
  await page.screenshot({ path: `${out}/a2-${viewport.width}-system.png` });
  // grouped lists: a row's name and value, and the Status card's values, are whole
  for (const tab of ['settings', 'system', 'links']) {
    await page.evaluate((t) => (location.hash = t), tab);
    await page.waitForSelector(`#pg-${tab} .pn[data-row]`, { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const cut = await page.$$eval(`#pg-${tab} :is(.pn[data-row] > h3 :is(.ptitle, small), .keepcard .rw .v)`, (els) => els.filter((e) => e.getClientRects().length && e.getBoundingClientRect().width).map((e) => {
      const what = (e.dataset.label || e.textContent || '').trim();
      return what && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) ? `"${what.slice(0, 40)}" (${e.scrollWidth}×${e.scrollHeight} in ${e.clientWidth}×${e.clientHeight})` : '';
    }).filter(Boolean));
    for (const c of cut) problems.push(`[${name} ${tab}] a grouped-list row is cut off: ${c}`);
    // each group's title (and footer) once: a group's rows share one card
    const heads = await page.$$eval(`#pg-${tab} .lgrp > .lgt`, (hs) => hs.map((x) => x.textContent));
    for (const t of new Set(heads)) if (heads.filter((x) => x === t).length > 1) problems.push(`[${name} ${tab}] the group "${t}" is drawn ${heads.filter((x) => x === t).length} times`);
    if (tab === 'system') {
      // the lower rows, after scrolling the list to its end
      await page.evaluate(() => document.querySelector('#pg-system .hud')?.scrollTo(0, 1e6));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/a2-${viewport.width}-system-end.png` });
    } else await page.screenshot({ path: `${out}/a2-${viewport.width}-${tab}.png` });
  }
  await ctx.close();
}

// A YouTube summary (the brain's summarise_video): the reply shows a video card (title, channel, length) and its
// MOMENTS as links that open the video at that second (features/core/ytcard.ts). The brain's stream is faked.
async function videoCard() {
  const name = 'video card';
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 1, ...UK });
  await ctx.addInitScript((k) => localStorage.setItem('ghosty.ownerKey', k), 'preview-owner-key-0123456789');
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  const reply = '▶ Home batteries explained · The Energy Shed · 18:32\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\nTwo small home batteries can beat one big one.\n\nMoments:\n[0:15] what a home battery does — https://youtu.be/dQw4w9WgXcQ?t=15\n[12:40] why the second battery matters — https://youtu.be/dQw4w9WgXcQ?t=760\n[18:00] the advice — https://youtu.be/dQw4w9WgXcQ?t=1080';
  const body = [
    { t: 'tool', id: 'v1', name: 'summarise_video', args: { url: 'https://youtu.be/dQw4w9WgXcQ' } },
    { t: 'tool_result', id: 'v1', name: 'summarise_video', ok: true, summary: 'Home batteries explained' },
    { t: 'text', text: reply },
    { t: 'done', model: 'Mock · scripted' },
  ].map((e) => JSON.stringify(e)).join('\n') + '\n';
  await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(body).toString('base64'))}` }));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(900);
  await page.fill('#cin', 'summarise https://youtu.be/dQw4w9WgXcQ');
  await page.keyboard.press('Enter');
  const shown = await page.waitForSelector('.msg .ytcard', { state: 'attached', timeout: 10000 }).then(() => true, () => false);
  if (!shown) problems.push(`[${name}] the reply has no video card`);
  else {
    const card = await page.$eval('.msg .ytcard .ytlink', (a) => ({ href: a.getAttribute('href'), text: a.textContent }));
    if (card.href !== 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' || !/Home batteries explained/.test(card.text) || !/18:32/.test(card.text)) problems.push(`[${name}] the card reads ${JSON.stringify(card)}`);
    const moments = await page.$$eval('.msg .ytmoments a.ytmoment', (as) => as.map((a) => `${a.querySelector('em')?.textContent} ${a.querySelector('span')?.textContent} ${a.getAttribute('href')}`));
    const want = ['0:15 what a home battery does https://youtu.be/dQw4w9WgXcQ?t=15', '12:40 why the second battery matters https://youtu.be/dQw4w9WgXcQ?t=760', '18:00 the advice https://youtu.be/dQw4w9WgXcQ?t=1080'];
    if (JSON.stringify(moments) !== JSON.stringify(want)) problems.push(`[${name}] the moments are ${JSON.stringify(moments)}`);
    const words = await page.$eval('.msg:has(.ytcard)', (m) => m.textContent);
    if (!/Two small home batteries can beat one big one/.test(words)) problems.push(`[${name}] the summary is missing`);
    if (/▶ Home batteries|Moments:/.test(words)) problems.push(`[${name}] the card line or the Moments heading is still in the words`);
    await page.locator('.logbtn').first().click().catch(() => undefined);
    await page.waitForTimeout(500);
    await page.locator('.msg .ytcard').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.screenshot({ path: `${out}/video-card.png` });
  }
  await ctx.close();
}

await videoCard();
await run('desktop', DESKTOP);
await run('phone', PHONE);
await fixesA2({ width: 390, height: 844 });
await fixesA2(PHONE);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'UI run clean: no page errors.');
process.exit(problems.length ? 1 : 0);
