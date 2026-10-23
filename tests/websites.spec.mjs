// Websites on Ghosty's own, on an iPhone 13 (the brain's model is the scripted mock):
//  1. From chat to a published site: "build a website for my friend's barber shop in walsall" → one
//     approval naming the link → a six-step project in the Workshop → a DRAFT that is not public (typical
//     hours and prices were assumed) → the owner confirms ("those are right, publish it") on an approval
//     naming the list → the live site under Ghosty's bar: several pages that route, the writer's words, a
//     booking form, the map, photo credits, phone-width.
//  2. With no connection to the brain: the phone asks a few questions, builds the site from the website
//     kit itself, and PREVIEW shows it in a locked frame.
//   node tests/websites.spec.mjs [outDir]
import { devices } from 'playwright';
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];
const browser = await launch();

async function pair(ctx) {
  const ui = await ctx.newPage();
  ui.on('pageerror', (er) => webkitNoise(er) || problems.push(`pageerror: ${er.message}`));
  await ui.goto(base, { waitUntil: 'domcontentloaded' });
  await ui.waitForSelector('#pair input', { timeout: 15000 });
  await ui.fill('#pair input', 'preview-owner-key-0123456789');
  await ui.click('#pair button.on');
  await ui.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await ui.waitForTimeout(800);
  if (await ui.$('.logbtn')) await ui.click('.logbtn');
  return ui;
}

// ── 1. chat → published site ─────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const ui = await pair(ctx);
  await ui.fill('#cin', "build a website for my friend's barber shop in walsall");
  await ui.keyboard.press('Enter');
  const approve = await ui.waitForSelector('.approval button.on', { timeout: 20000 }).catch(() => null);
  if (!approve) problems.push('Ghosty did not ask before building and publishing the site');
  else {
    const reason = (await ui.$eval('.approval b', (b) => b.textContent)) ?? '';
    if (!/Build a website for Fade & Co\. Barbers on my own and publish it at .*\/s\/fade-co-barbers/.test(reason)) problems.push(`approval says: ${reason}`);
    if (!/Reviews, team and awards appear only if you gave them/.test(reason)) problems.push('the approval does not promise not to invent reviews');
    await ui.screenshot({ path: `${out}/websites-approval.png` });
    await approve.tap();
    const said = await ui.waitForFunction(() => /Started building the website/.test(document.querySelector('#pg-core')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => null);
    if (!said) problems.push('no word that the build started');
    // The project runs on its own (a step every 15 s in the alarm) and finishes with the report.
    let done = false;
    for (let i = 0; i < 100 && !done; i++) {
      await ui.evaluate(() => (location.hash = 'workshop'));
      await ui.waitForTimeout(3000);
      done = await ui.evaluate(() => [...document.querySelectorAll('#pg-workshop .project')].some((p) => /Website: Fade & Co\. Barbers/.test(p.textContent ?? '') && /DONE/.test(p.textContent ?? '')));
    }
    if (!done) problems.push('the website project did not finish in the Workshop');
    else {
      const steps = await ui.evaluate(() => [...document.querySelectorAll('#pg-workshop .project')].find((p) => /Website: Fade/.test(p.textContent ?? ''))?.textContent ?? '');
      for (const s of ['Brief, map and pictures', 'Plan and look', 'Words', 'Build and check', 'Publish and look', 'Polish and report']) if (!steps.includes(s)) problems.push(`the Workshop does not show the step "${s}"`);
      await ui.screenshot({ path: `${out}/websites-workshop.png` });
    }
    // Typical hours and prices were assumed: a draft, not public, until the owner confirms them.
    const early = await ctx.request.get(`${base}/s/fade-co-barbers`, { headers: { 'cache-control': 'no-cache' } });
    if (early.status() === 200) problems.push('the site went public before the owner confirmed what was assumed');
    await ui.evaluate(() => (location.hash = 'core'));
    await ui.waitForTimeout(800);
    await ui.fill('#cin', "build a website for my friend's barber shop in walsall — those are right, publish it");
    await ui.keyboard.press('Enter');
    const confirm = await ui.waitForSelector('.approval button.on', { timeout: 20000 }).catch(() => null);
    let live = false;
    if (!confirm) problems.push('confirming the draft did not ask for approval');
    else {
      const why = (await ui.$$eval('.approval b', (bs) => bs.map((b) => b.textContent).join(' | '))) ?? '';
      if (!/Publish the website .*\/s\/fade-co-barbers\? You are confirming what I assumed: .*opening hours/.test(why)) problems.push(`the confirm approval says: ${why}`);
      await ui.screenshot({ path: `${out}/websites-confirm.png` });
      await confirm.tap();
      for (let i = 0; i < 20 && !live; i++) {
        await ui.waitForTimeout(1000);
        const r = await ctx.request.get(`${base}/s/fade-co-barbers`, { headers: { 'cache-control': 'no-cache' } });
        live = r.status() === 200;
      }
    }
    if (!live) problems.push('the site was never published after the owner confirmed');
    if (live) {
      const site = await ctx.newPage();
      site.on('pageerror', (er) => webkitNoise(er) || problems.push(`site pageerror: ${er.message}`));
      await site.goto(`${base}/s/fade-co-barbers`, { waitUntil: 'domcontentloaded' });
      const frame = await site.waitForSelector('iframe').then((f) => f.contentFrame()).catch(() => null);
      if (!frame) problems.push('the site is not in its frame');
      else {
        await frame.waitForSelector('h1', { timeout: 15000 }).catch(() => problems.push('no h1 on the site'));
        await site.waitForTimeout(1500);
        const r = await frame.evaluate(() => ({
          h1: document.querySelector('.page.on h1')?.textContent ?? '',
          pages: [...document.querySelectorAll('.page')].map((p) => p.getAttribute('data-page')),
          nav: [...document.querySelectorAll('.nav-plinks a')].map((a) => a.textContent),
          eyebrow: document.querySelector('.page.on .eyebrow')?.textContent ?? '',
          form: !!document.querySelector('form.ghost-form'),
          map: document.querySelector('.b-map iframe, .b-map .nomap') ? 'yes' : 'no',
          credits: document.querySelectorAll('#credits li').length,
          wide: document.documentElement.scrollWidth > innerWidth + 1,
          w: innerWidth,
          ld: [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => [JSON.parse(s.textContent)].flat().map((x) => x['@type'])),
        }));
        if (!r.h1) problems.push('the home page has no headline');
        if (r.pages.length < 4) problems.push(`only ${r.pages.length} pages: ${r.pages}`);
        if (!/✓/.test(r.eyebrow)) problems.push(`the writer's words did not reach the page (eyebrow: ${r.eyebrow})`);
        if (r.map !== 'yes') problems.push('no map section');
        if (r.credits < 3) problems.push(`photo credits missing (${r.credits})`);
        if (r.wide) problems.push('the site scrolls sideways on the phone');
        if (r.w !== 390) problems.push(`not phone width: ${r.w}`);
        if (!r.ld.includes('HairSalon')) problems.push(`no business data for search engines: ${r.ld}`);
        await site.screenshot({ path: `${out}/websites-live-home.png` });
        // The menu button opens the pages; tapping one routes to it.
        await frame.click('.nav-toggle');
        await frame.waitForSelector('.nav.open .nav-panel', { timeout: 5000 }).catch(() => problems.push('the phone menu does not open'));
        await site.screenshot({ path: `${out}/websites-live-menu.png` });
        await frame.click('.nav-plinks a[data-route="prices"]');
        await site.waitForTimeout(600);
        const prices = await frame.evaluate(() => ({ on: document.querySelector('.page.on')?.getAttribute('data-page'), title: document.title, h1: document.querySelector('.page.on h1')?.textContent ?? '' }));
        if (prices.on !== 'prices' || !/Prices — Fade & Co\. Barbers/.test(prices.title)) problems.push(`routing to Prices failed: ${JSON.stringify(prices)}`);
        await site.screenshot({ path: `${out}/websites-live-prices.png` });
        // The booking page's form tells the visitor where the message goes.
        await frame.evaluate(() => (location.hash = '#/book'));
        await site.waitForTimeout(600);
        const note = await frame.evaluate(() => document.querySelector('.page.on .form-note')?.textContent ?? '');
        if (!/WhatsApp|email app|call/i.test(note)) problems.push(`the form does not say how it sends: ${note}`);
        await frame.click('.page.on form.ghost-form button[data-via]');
        await site.waitForTimeout(300);
        const bad = await frame.evaluate(() => document.querySelector('.page.on .form-note')?.className ?? '');
        if (!/bad/.test(bad)) problems.push('an empty booking form was not stopped with a message');
        await site.screenshot({ path: `${out}/websites-live-book.png` });
      }
      await site.close();
    }
  }
  await ctx.close();
}

// ── 2. no connection: built on the phone ─────────────────────────────────────────
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const ui = await pair(ctx);
  // The brain is unreachable from here on (the connection drops: fetch fails as it would offline).
  await ui.route('**/api/chat**', (r) => r.abort('internetdisconnected'));
  await ui.fill('#cin', 'build me a website for my cafe in Bilston');
  await ui.keyboard.press('Enter');
  const asked = await ui.waitForFunction(() => /A few quick answers first/.test(document.querySelector('#pg-core')?.textContent ?? ''), null, { timeout: 20000 }).catch(() => null);
  if (!asked) problems.push('offline: the phone did not ask its questions');
  await ui.fill('#cin', "Little Fern, 01902 000512, Mon-Fri 8-4, Sat 9-3, Sun closed, flat white £3.20, everything's baked here every morning");
  await ui.keyboard.press('Enter');
  const row = await ui.waitForSelector('.siterow button:has-text("PREVIEW")', { timeout: 30000 }).catch(() => null);
  if (!row) problems.push('offline: no site was built on the phone');
  else {
    const text = await ui.evaluate(() => [...document.querySelectorAll('#pg-core .msg')].map((m) => m.textContent).join('\n'));
    if (!/Built "Little Fern/.test(text)) problems.push('offline: the reply does not name the site');
    if (!/No AI model was used/.test(text)) problems.push('offline: the reply does not say no model was used');
    await ui.screenshot({ path: `${out}/websites-offline-built.png` });
    await row.tap();
    const frame = await ui.waitForSelector('iframe.sitepreview').then((f) => f.contentFrame()).catch(() => null);
    if (!frame) problems.push('offline: PREVIEW did not open');
    else {
      await frame.waitForSelector('h1', { timeout: 15000 }).catch(() => problems.push('offline: the preview shows no page'));
      const r = await frame.evaluate(() => ({ name: document.querySelector('.brand .name')?.textContent, hours: document.querySelector('.hours')?.textContent ?? '', phone: [...document.querySelectorAll('a[href^="tel:"]')].length }));
      if (r.name !== 'Little Fern') problems.push(`offline: the preview names ${r.name}`);
      if (!/8:00–16:00/.test(r.hours)) problems.push(`offline: the owner's hours are not on the site (${r.hours.slice(0, 80)})`);
      if (!r.phone) problems.push('offline: the phone number is not a tap-to-call link');
      await ui.waitForTimeout(800);
      await ui.screenshot({ path: `${out}/websites-offline-preview.png` });
    }
  }
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Websites run clean: from one chat message to a published multi-page site (approval naming the link, six steps in the Workshop, routing, the writer\'s words, form, map, credits, phone width, business data); with no connection the phone asked its questions, built the site itself and previewed it.');
process.exit(problems.length ? 1 : 0);
