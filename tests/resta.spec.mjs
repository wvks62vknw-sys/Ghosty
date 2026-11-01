// BRIEF-REST-A (batch ⑧ part A) on the preview, a 390 × 844 phone:
//  1. WIKIPEDIA, OFFLINE (the Library, under its Ask pill): the two files offered with their sizes; GET on (stubbed) mobile
//     data waits, then on Wi-Fi fetches the file in pieces through /api/zim (stubbed here to serve the fixture ZIM made
//     from our own words, tests/fixtures/zim) into the Cache API; OFFLINE and the file's own date; the search finds a
//     title as he types, the article renders in its script-free frame with its picture from the file, a link opens
//     another article in place, BACK, READ IT TO ME speaks (the voice stub); with the network off the search and the
//     articles (zstd and xz) still work, and so does "offline wikipedia black holes" in the chat (its card's OPEN), and
//     "what is a volcano?", which the brain cannot be reached for, offers the article; DELETE (after its UNDO bar)
//     empties the store.
//  2. SIRI SHORTCUTS: ?say=what is a cat sends; ?do=open:lens opens the Lens; a stranger's link shows the sign-in and runs
//     nothing; SETTINGS → SHORTCUTS: twelve ready ones, COPY, a link of his own made.
//  3. MORSE: "SOS in morse" opens the sheet, PLAY plays it, a tapped letter is read.
// Nothing sideways at 390 × 844; VoiceOver names on every control; no security-policy refusal.
//   BASE=http://localhost:8744 node tests/resta.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { openPanel, openSection, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { buildZim } from './fixtures/zim/fixture.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SIZE = { width: 390, height: 844 };
const ZIM = buildZim();
const TASTER = 'wikipedia_en_physics_mini_2026-10.zim';

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  return ok;
};
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

/** The phone's own voice and clipboard, stood in for (what was said and copied is kept on the page). */
const STUBS = () => {
  window.__said = [];
  window.__copied = [];
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 });
    }
  };
  const synth = window.SpeechSynthesis?.prototype ?? window.speechSynthesis;
  synth.getVoices = () => [{ name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel', localService: true, default: true }];
  synth.speak = (u) => {
    if (u.text.trim()) window.__said.push(u.text);
    setTimeout(() => {
      u.onstart?.();
      setTimeout(() => u.onend?.(), 20);
    }, 5);
  };
  synth.cancel = () => undefined;
  synth.resume = () => undefined;
  try {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => void window.__copied.push(t) }, configurable: true });
  } catch {
    /* kept as it is */
  }
};

const sideways = (page, sel) =>
  page.$$eval(sel, (els) =>
    els
      .filter((e) => {
        if (!e.getClientRects().length || getComputedStyle(e).visibility === 'hidden') return false;
        const r = e.getBoundingClientRect();
        if (!r.width || r.bottom < 0 || r.top > innerHeight) return false;
        for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) {
          if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) {
            const pr = p.getBoundingClientRect();
            if (pr.left >= -1 && pr.right <= innerWidth + 1) return false;
          }
        }
        return r.left < -1 || r.right > innerWidth + 1;
      })
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${(e.textContent || '').trim().slice(0, 24)}"`),
  );
const wide = (page) => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1);
/** Every button, field and frame in `sel` has a name VoiceOver reads. */
const unnamed = (page, sel) =>
  page.$$eval(`${sel} :is(button, input, select, textarea, iframe)`, (els) =>
    els.filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() || e.closest('label'))).map((e) => e.outerHTML.slice(0, 80)),
  );

async function phone({ pair = true, stranger = false, url = base } = {}) {
  const ctx = await browser.newContext({ viewport: SIZE, screen: SIZE, deviceScaleFactor: 3, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', permissions: ['camera', 'microphone'] });
  await ctx.addInitScript(STUBS);
  const page = await ctx.newPage();
  const policy = [];
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => /Refused to|Content Security Policy/.test(m.text()) && policy.push(m.text().slice(0, 200)));
  await page.goto(stranger ? url : base, { waitUntil: 'domcontentloaded' });
  if (pair) {
    await page.waitForSelector('#pair input', { timeout: 20000 });
    await page.fill('#pair input', KEY);
    await page.click('#pair button.on');
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  }
  return { ctx, page, policy };
}
/** A fresh page in the same (signed-in) phone, opened on a link. */
async function opened(ctx, url) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
  return page;
}
const say = async (page, words) => {
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
};
const replies = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? ''));

// ================================================================ 1. WIKIPEDIA, OFFLINE
const { ctx, page, policy } = await phone();
const served = [];
await ctx.route('**/api/zim/**', async (route) => {
  const req = route.request();
  const m = /bytes=(\d+)-(\d+)/.exec(req.headers()['range'] ?? '');
  served.push({ file: new URL(req.url()).pathname.split('/').pop(), range: m?.[0] ?? '' });
  if (!m) return route.fulfill({ status: 416, body: '' });
  const a = Number(m[1]);
  const b = Math.min(ZIM.length - 1, Number(m[2]));
  await route.fulfill({ status: 206, body: Buffer.from(ZIM.slice(a, b + 1)), headers: { 'content-type': 'application/octet-stream', 'content-range': `bytes ${a}-${b}/${ZIM.length}`, 'content-length': String(b - a + 1) } });
});
await page.evaluate(() => (location.hash = 'library'));
await page.waitForSelector('#pg-library .pn.wiki', { state: 'attached', timeout: 20000 });
await openSection(page, 'library', 'Ask');
const wiki = page.locator('#pg-library .pn.wiki');
await wiki.scrollIntoViewIfNeeded();
await until(page, () => document.querySelectorAll('#pg-library .wikioffer').length === 2);
const offers = await page.$$eval('#pg-library .wikioffer', (els) => els.map((e) => e.textContent ?? ''));
check(/Physics on Wikipedia/.test(offers[0] ?? '') && /53 MB/.test(offers[0] ?? ''), `the taster is offered with its size: ${offers[0]?.slice(0, 120)}`);
check(/Simple English Wikipedia/.test(offers[1] ?? '') && /1\.1 GB/.test(offers[1] ?? '') && /without pictures/.test(offers[1] ?? ''), `Simple English is offered with its size: ${offers[1]?.slice(0, 120)}`);
const foot = await wiki.locator('.wikifoot').textContent();
check(/CC BY-SA/.test(foot ?? '') && /119 GB/.test(foot ?? ''), 'the licence and why never the whole English Wikipedia are said');
check(/never reads it/.test((await wiki.locator('.wikilead').textContent()) ?? ''), 'the panel says the brain never reads it');
check((await page.locator('#pg-library .secpill.on').textContent())?.trim() === 'Ask' && (await wiki.isVisible()), 'the section sits under the Library’s Ask pill');
await page.screenshot({ path: `${out}/resta-wiki-offers.png` });

// GET on mobile data waits (where the browser says so)
await page.evaluate((n) => {
  window.__ghostyWikiTest = { piece: 512, bytes: { physics: n } };
  const c = Object.assign(new EventTarget(), { type: 'cellular', saveData: false });
  Object.defineProperty(navigator, 'connection', { value: c, configurable: true });
}, ZIM.length);
await wiki.locator('.wikioffer[data-file="physics"] button', { hasText: 'GET' }).click();
await page.waitForTimeout(1200);
const waiting = (await wiki.locator('.wikioffer[data-file="physics"]').textContent()) ?? '';
check(/mobile data/.test(waiting) && /waits for Wi-Fi/.test(waiting) && served.length === 0, `GET on mobile data waits, fetching nothing (${served.length} pieces asked): ${waiting.slice(0, 140)}`);
// on Wi-Fi it goes by itself, in pieces, through the Worker's passthrough
await page.evaluate(() => {
  navigator.connection.type = 'wifi';
  navigator.connection.dispatchEvent(new Event('change'));
});
check(await until(page, () => !document.querySelector('#pg-library .wikihave')?.hidden, null, 30000), 'on Wi-Fi the file comes, and the section shows it');
const pieces = Math.ceil(ZIM.length / 512);
check(served.length === pieces && served.every((s, i) => s.file === TASTER && s.range === `bytes=${i * 512}-${Math.min(ZIM.length, (i + 1) * 512) - 1}`), `fetched in ${pieces} pieces by Range through /api/zim: ${JSON.stringify(served.slice(0, 4))}`);
const stored = await page.evaluate(async () => (await (await caches.open('ghosty-wiki-v1')).keys()).length);
check(stored === pieces, `each piece kept in the Cache API (${stored} of ${pieces})`);
const kept = (await wiki.locator('.wikikept').textContent()) ?? '';
check(/^Physics on Wikipedia, October 2026, \d+ KB on your phone$/.test(kept), `the file named with its own date and size: "${kept}"`);
check((await wiki.locator('.wikibadge').textContent()) === 'OFFLINE' && (await wiki.locator('.wikibadge').isVisible()), 'the OFFLINE badge');

// the search, as he types
await wiki.locator('.wikiq').fill('bla');
check(await until(page, () => [...document.querySelectorAll('#pg-library .wikirow')].map((r) => r.textContent).join('|') === 'Black hole|Black holes'), 'the search finds the titles as he types (Black hole, Black holes)');
const rowH = await wiki.locator('.wikirow').first().evaluate((r) => r.getBoundingClientRect().height);
check(rowH >= 44, `a result row is ${Math.round(rowH)} pt high (44 at least)`);
await wiki.locator('.wikirow', { hasText: /^Black hole$/ }).click();
const frame = page.frameLocator('#pg-library .wikiframe');
check(await until(page, () => document.querySelector('#pg-library .wikiframe')?.contentDocument?.querySelector('h1')?.textContent === 'Black hole'), 'the article renders in its frame');
const fr = await page.evaluate(() => {
  const f = document.querySelector('#pg-library .wikiframe');
  const d = f.contentDocument;
  return { sandbox: f.getAttribute('sandbox'), scripts: d.querySelectorAll('script, iframe').length, img: d.querySelector('img[data-i="0"]')?.getAttribute('src') ?? '', title: f.title };
});
check(fr.sandbox === 'allow-same-origin' && fr.scripts === 0, `the frame runs no script (sandbox="${fr.sandbox}", ${fr.scripts} scripts or frames in it)`);
check(await until(page, () => (document.querySelector('#pg-library .wikiframe')?.contentDocument?.querySelector('img[data-i="0"]')?.naturalWidth ?? 0) === 2), `its picture comes from the file (${fr.img.slice(0, 30)})`);
check(fr.title === 'Article: Black hole', `the frame is named for VoiceOver: "${fr.title}"`);
const times = await page.evaluate(() => ({ ...window.__ghostyWiki }));
console.log(`     fixture: search ${times.search} ms (${times.results} titles), article ${times.open} ms`);
// a link opens another article in place, and BACK comes back
await frame.locator('a[data-zim="C/Star"]').click();
check(await until(page, () => document.querySelector('#pg-library .wikiarttitle')?.textContent === 'Star' && document.querySelector('#pg-library .wikiframe')?.contentDocument?.querySelector('h1')?.textContent === 'Star'), 'a link opens the other article in place');
await wiki.locator('.wikibar button', { hasText: 'BACK' }).click();
check(await until(page, () => document.querySelector('#pg-library .wikiframe')?.contentDocument?.querySelector('h1')?.textContent === 'Black hole'), 'BACK comes back to the article before');
// READ IT TO ME, through the phone's own voice (what it says from the tap on: a preview brain other specs used may have
// spoken its own notices before)
const from = await page.evaluate(() => window.__said.length);
await wiki.locator('.wikibar button', { hasText: 'READ IT TO ME' }).click();
check(await until(page, (n) => window.__said.slice(n).join(' ').includes('A black hole is a place in space'), from), 'READ IT TO ME speaks the article');
const said = await page.evaluate((n) => window.__said.slice(n).join(' '), from);
check(said.startsWith('Black hole.') && !/A book about space/.test(said), `it reads the title and the article, not its sources: "${said.slice(0, 80)}…"`);
await page.screenshot({ path: `${out}/resta-wiki-article.png` });
check(!(await wide(page)), 'the Library with an article open does not scroll sideways');
const sw1 = await sideways(page, '#pg-library .pn.wiki :is(div, button, input, iframe, b, span, small)');
check(!sw1.length, `nothing in the section sticks out sideways ${sw1.join(', ')}`);
const un1 = await unnamed(page, '#pg-library .pn.wiki');
check(!un1.length, `every control in the section has a name: ${un1.join(' ; ')}`);

// with the network off: the search and the articles (both kinds of cluster) still work, and so does the chat
await ctx.setOffline(true);
await wiki.locator('.wikibar button', { hasText: 'CLOSE' }).click();
await wiki.locator('.wikiq').fill('vol');
check(await until(page, () => [...document.querySelectorAll('#pg-library .wikirow')].some((r) => r.textContent === 'Volcano')), 'offline: the search still finds a title');
await wiki.locator('.wikirow', { hasText: /^Volcano$/ }).click();
check(await until(page, () => document.querySelector('#pg-library .wikiframe')?.contentDocument?.querySelector('h1')?.textContent === 'Volcano'), 'offline: an article opens');
await wiki.locator('.wikiq').fill('cats');
await wiki.locator('.wikirow', { hasText: /^Cats$/ }).click({ timeout: 10000 }).catch(() => undefined);
check(await until(page, () => document.querySelector('#pg-library .wikiframe')?.contentDocument?.querySelector('h1')?.textContent === 'Cat'), 'offline: a redirect opens its article from the xz cluster');
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { timeout: 10000 });
await say(page, 'offline wikipedia black holes');
check(await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /From Physics on Wikipedia, on this phone/.test(m.textContent) && /A black hole is a place in space/.test(m.textContent))), 'offline: "offline wikipedia black holes" answers with the first paragraph, no model');
check(await until(page, () => !!document.querySelector('#pg-core article.ccard[data-id="wiki:C/Black_hole"]')), 'offline: with a card');
await say(page, 'what is a volcano?');
check(await until(page, () => !!document.querySelector('#pg-core article.ccard[data-id="wiki:C/Volcano"]'), null, 25000), 'offline: a "what is …?" the brain cannot be reached for offers the article');
const vol = (await replies(page)).join('\n');
check(/opening in the ground|library on this device/i.test(vol), `…said in the chat: "${vol.split('\n').pop()?.slice(0, 120)}"`);
// (the chat's log sits behind its own button on a phone: the card's OPEN is pressed as a tap would)
await page.evaluate(() => [...document.querySelectorAll('#pg-core article.ccard[data-id="wiki:C/Black_hole"] button')].find((b) => b.textContent === 'OPEN')?.click());
check(await until(page, () => document.body.dataset.tab === 'library' && document.querySelector('#pg-library .wikiframe')?.contentDocument?.querySelector('h1')?.textContent === 'Black hole'), 'the card’s OPEN shows the article in the Library');
await ctx.setOffline(false);

// DELETE: gone from the phone (the UNDO bar first)
await wiki.locator('.wikihead button', { hasText: 'DELETE' }).click();
check(await until(page, () => document.querySelector('#pg-library .wikihave')?.hidden === true && document.querySelectorAll('#pg-library .wikioffer').length === 2), 'DELETE: the file leaves the section at once, and both are offered again');
check(await until(page, async () => !(await caches.has('ghosty-wiki-v1')) || (await (await caches.open('ghosty-wiki-v1')).keys()).length === 0, null, 20000), 'DELETE: every piece leaves the phone once the UNDO bar goes');
check(!policy.length, `no security-policy refusal on the way: ${policy.join(' | ')}`);
await ctx.close();

// ================================================================ 2. SIRI SHORTCUTS
{
  const { ctx, page } = await phone();
  // ?say= that asks something: sent
  const p1 = await opened(ctx, `${base}/?say=what%20is%20a%20cat`);
  check(await until(p1, () => [...document.querySelectorAll('#pg-core .msg.me')].some((m) => m.textContent?.includes('what is a cat')), null, 20000), '?say=what is a cat is sent');
  check(!/say=/.test(p1.url()), `the address is cleaned after (${p1.url()})`);
  await p1.close();
  // ?say= that would start something: left in the box
  const p2 = await opened(ctx, `${base}/?say=remind%20me%20to%20call%20mum`);
  check(await until(p2, () => document.querySelector('#cin')?.value === 'remind me to call mum', null, 15000), '?say= that would start something waits in the chat box');
  check(!(await p2.evaluate(() => [...document.querySelectorAll('#pg-core .msg.me')].some((m) => m.textContent?.includes('remind me to call mum')))), '…and is not sent');
  await p2.close();
  // ?do=open:lens
  const p3 = await opened(ctx, `${base}/?do=open:lens`);
  check(await until(p3, () => document.body.dataset.tab === 'lens' || !!document.querySelector('#pg-lens.on'), null, 15000), '?do=open:lens opens the Lens');
  await p3.close();
  // SETTINGS → SHORTCUTS
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForSelector('#pg-settings .pn', { state: 'attached', timeout: 15000 });
  await openSection(page, 'settings', 'Ghosty');
  await openPanel(page, 'settings', 'SHORTCUTS');
  const sc = page.locator('#pg-settings .pn', { has: page.locator('.ptitle', { hasText: /^SHORTCUTS$/ }) });
  await sc.locator('.scrow').first().waitFor({ timeout: 10000 }).catch(() => undefined);
  const rows = await sc.locator('.scrow').count();
  check(rows === 12, `twelve ready shortcuts (${rows})`);
  const text = (await sc.textContent()) ?? '';
  check(/Open URLs/.test(text) && /Hey Siri, Ghosty timer/.test(text) && /iPhone lets no web page add a shortcut/.test(text), 'the plain steps once, and that nothing is installed by us');
  await sc.locator('.scrow').first().locator('button', { hasText: 'COPY' }).click();
  const copied = await page.evaluate(() => window.__copied.at(-1) ?? '');
  check(copied === `${base}/?do=timer:10m`, `COPY gives the link: ${copied}`);
  check((await sc.locator('.scrow').first().locator('button').textContent()) === 'COPIED', 'COPY says COPIED');
  await sc.locator('.scpick').selectOption('agenda');
  check((await sc.locator('.scown .scurl').textContent()) === `${base}/?open=agenda`, 'MAKE YOUR OWN: a screen picked makes its link');
  await sc.locator('.scpick').selectOption('');
  await sc.locator('.scwords').fill('weather tomorrow');
  check((await sc.locator('.scown .scurl').textContent()) === `${base}/?say=weather%20tomorrow`, 'MAKE YOUR OWN: words typed make their link');
  await page.screenshot({ path: `${out}/resta-shortcuts.png` });
  check(!(await wide(page)), 'SHORTCUTS does not scroll sideways');
  const sw2 = await sideways(page, '#pg-settings .pn :is(.scrow, .scurl, button, select, input)');
  check(!sw2.length, `nothing in SHORTCUTS sticks out sideways ${sw2.join(', ')}`);
  const un2 = await unnamed(page, '#pg-settings .pn.pushed');
  check(!un2.length, `every control in SHORTCUTS has a name: ${un2.join(' ; ')}`);
  await ctx.close();
}
{
  // a stranger's link: the sign-in, and nothing run
  const { ctx, page } = await phone({ pair: false, stranger: true, url: `${base}/?say=what%20is%20a%20cat` });
  check(await until(page, () => !!document.querySelector('#pair input'), null, 20000), 'a stranger’s link shows the sign-in');
  await page.locator('#pair button', { hasText: /continue offline/i }).click().catch(() => undefined);
  await page.waitForTimeout(3000);
  check(!(await page.evaluate(() => [...document.querySelectorAll('#pg-core .msg.me')].some((m) => m.textContent?.includes('what is a cat')))), '…and nothing is sent for them');
  await ctx.close();
}

// ================================================================ 3. MORSE
{
  const { ctx, page } = await phone();
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { timeout: 10000 });
  await say(page, 'SOS in morse');
  check(await until(page, () => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => m.textContent?.includes('“SOS” in Morse: ... --- ...'))), '"SOS in morse" answers in the chat');
  check(await until(page, () => document.querySelector('.modal .morseout')?.value === '... --- ...'), 'and opens the Morse sheet with it');
  await page.locator('.modal .morseplay button', { hasText: 'PLAY' }).click();
  check(await until(page, () => window.__ghostyMorse?.playing === true, null, 5000), 'PLAY plays it on the synth');
  check(await until(page, () => window.__ghostyMorse?.playing === false && window.__ghostyMorse.played === '... --- ...', null, 15000), '…to the end');
  await page.locator('.modal .morsetabs button', { hasText: 'TAP' }).click();
  // a short press and a long one, timed on the page: A
  await page.evaluate(async () => {
    const pad = document.querySelector('.modal .morsepad');
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const press = async (ms) => {
      pad.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 }));
      await wait(ms);
      pad.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    };
    await press(60);
    await wait(40);
    await press(480);
  });
  const tapped = await page.evaluate(() => ({ code: window.__ghostyMorse.taps, text: document.querySelector('.modal .morsetaptext')?.textContent }));
  check(tapped.code === '.-' && tapped.text === 'A', `a tapped letter is read: ${JSON.stringify(tapped)}`);
  await page.locator('.modal .morsetabs button', { hasText: 'CHART' }).click();
  check((await page.locator('.modal .morsecell').count()) === 36, 'the chart: every letter and figure');
  await page.locator('.modal .morsetabs button', { hasText: 'LEARN' }).click();
  check(/today’s letter/.test((await page.locator('.modal .morseside[data-side="learn"]').textContent()) ?? ''), 'LEARN: today’s letter');
  await page.screenshot({ path: `${out}/resta-morse.png` });
  check(!(await wide(page)), 'the Morse sheet does not scroll sideways');
  const sw3 = await sideways(page, '.modal .morse :is(div, button, textarea, input, section)');
  check(!sw3.length, `nothing in the Morse sheet sticks out sideways ${sw3.join(', ')}`);
  const un3 = await unnamed(page, '.modal .morse');
  check(!un3.length, `every control in the Morse sheet has a name: ${un3.join(' ; ')}`);
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log(`\n${problems.length} problem(s):\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log('\nresta: all green');
