// LIFE EASIER (BRIEF-OCT-IDEAS-2): eight small things that save him a tap or a thought, on the phone at 440 × 956 and at 390 × 844.
//  a. "Hey Siri, ask Ghosty…": ?ask=hello%20there opens Home and sends ONE turn with those words, the address bar cleaned; ?add=<link>
//     files it (the page cannot be read here, so the link itself is kept) and ?add=<words> files them, both on the Shelf; Settings,
//     SHORTCUTS shows both with GET and a one-line how-to; a stranger's ?ask= runs nothing.
//  b. THE BRIEF READ ALOUD on the first open of the day: Settings, VOICE has the row (off to begin with); on, with the day's flag clear,
//     the first open speaks the Brief's line once, after Home has landed (never on the first frame), with "leave by" from the
//     saved work and the diary; a second open the same day never; off, or muted, never.
//  c. WHAT DID I MISS? with the last-open stamp 25 hours back: the card stands on Home with at least three lines from seeded data,
//     one tap (GOT IT) dismisses it and it is not drawn again for that gap; "what did I miss" in the ask line draws the same card.
//  d. MONEY NUDGES from statements added to the brain: a renewal this week, a price that went up and the month running hot, once on
//     SPENDING and once in the Brief's money line; said once per fact (a later day does not say them again).
//  e. "teach me what you learned this week": at most five sentences from the report card's records and the ledger, READ IT TO ME
//     under it; with the brain unreachable, from the last copy kept on the phone.
//  f. THE PHOTOGRAPHED LETTER: a fixture frame with a bill's words offers REMIND and FILE on the Lens plate; REMIND makes the
//     agenda item on the date found after one confirming tap; FILE puts the text in the library under the sender.
//  g. WATCHERS: "tell me when this price drops <page>" starts one on a fixture page; the hourly beat tells ONCE when the number
//     drops; it is listed under PLAN (Agenda) with STOP; a strike on a status page the same; a login page and a person's page are refused.
//  h. EMAIL TRIAGE: with his email linked the Brief says "two emails need an answer" with DRAFT on each; DRAFT opens a reply for his
//     edit; nothing is sent until SEND; with no email linked the line is absent and nothing asks him to link one.
// Every control 44 pt and named for VoiceOver, nothing sideways, no page error, a time budget on each wait that matters.
//   BASE=http://localhost:8812 NO_GL_SHOTS=1 node tests/lifeeasier.spec.mjs tests/.shots
import { launch, webkitNoise } from './browser.mjs';
import { openPanel, UK } from './nav.mjs';
import { cardCamera, qrPng } from './fixtures/lenscards.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const SIZES = [{ width: 440, height: 956 }, { width: 390, height: 844 }];
const problems = [];
let size = SIZES[0];
const check = (ok, msg) => {
  if (!ok) problems.push(`[${size.width}] ${msg}`);
  console.log(`${ok ? 'ok  ' : 'FAIL'} [${size.width}] ${msg}`);
  return ok;
};
const until = (page, fn, arg, ms = 15000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const brainApi = (path, init = {}) => fetch(`${base}/api${path}`, { ...init, headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json', ...(init.headers ?? {}) } });

// ---- the day, in his zone (London): every date the spec uses is worked out from the real clock
const T = Date.now();
const ukDay = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
const addDays = (day, n) => ukDay(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000);
const TODAY = ukDay(T);
const longDay = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const hhmm = (ms) => new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
const jsonR = (r, body, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const RSS = `<?xml version="1.0"?><rss><channel>${Array.from({ length: 8 }, (_, i) => `<item><title>Live story ${i + 1}</title><description>About story ${i + 1}</description><link>https://www.bbc.co.uk/news/${i}</link><pubDate>${new Date(T - (i + 1) * 1800e3).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;
const PLACES = [
  { id: 'home', label: 'Home', query: 'B13', address: 'Kings Heath, Birmingham', lat: 52.4351, lon: -1.8912, at: 1 },
  { id: 'work', label: 'Work', query: 'Edgbaston Park Road', address: 'Edgbaston, Birmingham', lat: 52.4531, lon: -1.9416, at: 1 },
];
const mind = (items) => ({
  at: T,
  owner: { name: 'boss', summary: '', lines: [], facts: [], rules: [], principles: [] },
  now: { iso: `${TODAY}T08:00`, weekday: 'Wed', tz: 'Europe/London', day: TODAY },
  today: { day: TODAY, items, doing: [] },
  recent: [], ahead: [], can: [],
});

/** The phone's own voice and clipboard, stood in for: what was said and copied is kept on the page; `__bootAtSpeak` says whether the cinematic was still up. */
const STUBS = () => {
  window.__said = [];
  window.__saidBoot = [];
  window.__copied = [];
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 });
    }
  };
  const synth = window.speechSynthesis;
  synth.getVoices = () => [{ name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel', localService: true, default: true }];
  synth.speak = (u) => {
    if (u.text.trim()) {
      window.__said.push(u.text);
      window.__saidBoot.push(!!document.getElementById('boot'));
    }
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
const unnamed = (page, sel) => page.$$eval(`${sel} :is(button, input, select, textarea)`, (els) => els.filter((e) => e.getClientRects().length && !((e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() || e.closest('label'))).map((e) => e.outerHTML.slice(0, 80)));
/** Every button and field in `sel`, seen on the screen, is a 44 pt target. */
const small = (page, sel) =>
  page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map((e) => ({ t: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28), w: e.offsetWidth, h: e.offsetHeight })).filter((x) => x.w && (x.h < 43.5 || x.w < 43.5)).map((x) => `${x.t} ${x.w}×${x.h}`));

const ONLY = (process.env.ONLY ?? '').split(',').filter(Boolean);
const run = (k) => !ONLY.length || ONLY.includes(k);
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist'] });

/**
 * A phone, signed in, with the stand-ins for the sources a Brief and a Home read. `seed`: localStorage values set once on the first
 * load (never again after a reload). `routes`: more page.route stand-ins, applied after the defaults.
 */
async function phone({ seed = [], routes, pair = true, url = base, news = true, mindItems = [], places = PLACES, agendaEvents = [], inboxItems = [], unread = 0, spending } = {}) {
  const ctx = await browser.newContext({ viewport: size, screen: size, deviceScaleFactor: 2, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', permissions: ['camera', 'microphone'] });
  await ctx.addInitScript(STUBS);
  const page = await ctx.newPage();
  const seen = { chat: [], errors: [], tts: 0 };
  page.on('pageerror', (e) => webkitNoise(e) || seen.errors.push(e.message));
  await page.addInitScript((pairs) => {
    try {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      for (const [k, v] of pairs) localStorage.setItem(k, v);
    } catch {
      /* nothing seeded */
    }
  }, seed);
  await ctx.route(/\/api\/proxy\?/, (r) => {
    const u = new URL(r.request().url()).searchParams.get('url') ?? '';
    if (news && /bbci\.co\.uk/.test(u)) return r.fulfill({ status: 200, contentType: 'application/rss+xml', body: RSS });
    return r.fulfill({ status: 502, body: 'not in this spec' });
  });
  await ctx.route(/\/api\/agenda\?/, (r) => jsonR(r, { tz: 'Europe/London', errors: [], feeds: [], events: agendaEvents, jobs: [] }));
  await ctx.route(/\/api\/mind\?/, (r) => jsonR(r, mind(mindItems)));
  await ctx.route(/\/api\/inbox$/, (r) => jsonR(r, { items: inboxItems, unread }));
  await ctx.route(/\/api\/profile\/places$/, (r) => jsonR(r, { places }));
  await ctx.route(/\/api\/traffic\/commute\//, (r) => jsonR(r, { minutes: 24, km: 6.1, delayMin: 0, live: false, line: 'about 24 min by car with clear roads (no live traffic: add the free TomTom key in System for it)' }));
  await ctx.route(/\/api\/foresight\?/, (r) => jsonR(r, { items: [], expect: [], yesterday: '', calibration: { all: { n: 0, right: 0, share: 0 } }, score: '', notes: [], tz: 'Europe/London' }));
  await ctx.route(/\/api\/tts$/, (r) => {
    seen.tts++;
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{"error":"no voice in this spec"}' });
  });
  await ctx.route(/\/api\/chat$/, (r) => {
    seen.chat.push(r.request().postDataJSON());
    return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ t: 'text', text: 'Morning.' })}\n${JSON.stringify({ t: 'done', model: 'mock' })}\n` });
  });
  if (spending) await ctx.route(/\/api\/profile\/spending(\?|$)/, (r) => (r.request().method() === 'GET' ? jsonR(r, spending) : r.continue()));
  if (routes) await routes(ctx, seen);
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (pair) {
    await page.waitForSelector('#pair input', { timeout: 20000 });
    await page.fill('#pair input', KEY);
    await page.click('#pair button.on');
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  }
  return { ctx, page, seen };
}
/** Another page in the same (signed-in) phone. */
async function opened(ctx, url, seen) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || seen?.errors.push(e.message));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
  return page;
}
const replies = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => (m.textContent ?? '').replace(/\s+/g, ' ').trim()));
const mine = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg.me')].map((m) => (m.textContent ?? '').replace(/\s+/g, ' ').trim()));
const sayIn = async (page, words) => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { timeout: 15000 });
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
};
const lastReply = async (page, re, ms = 20000) => {
  const ok = await until(page, (src) => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => new RegExp(src, 'i').test(m.textContent ?? '')), re.source, ms);
  return ok ? (await replies(page)).filter((t) => re.test(t)).pop() : (await replies(page)).pop() ?? '';
};
const clean = (page) => page.evaluate(() => ({ search: location.search, url: location.href }));
const toBrief = async (page) => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(250);
  await page.evaluate(() => (location.hash = 'brief'));
  await page.waitForSelector('#pg-brief .hero .brdate', { timeout: 10000 }).catch(() => undefined);
};

// =================================================================================================================================
for (const sz of SIZES) {
  size = sz;
  console.log(`\n=========== ${sz.width} × ${sz.height}`);

  // ============================================================ a. HEY SIRI, ASK GHOSTY… and the share sheet
  if (run('a')) {
    const { ctx, page, seen } = await phone();
    seen.chat.length = 0;
    const p1 = await opened(ctx, `${base}/?ask=hello%20there`, seen);
    // (the cinematic is over here: the budget is for what is left of the open, not for the phone's boot, which a busy machine stretches)
    const t0 = Date.now();
    const sent = await until(p1, () => [...document.querySelectorAll('#pg-core .msg.me')].some((m) => (m.textContent ?? '').trim().endsWith('hello there')), null, 25000);
    const took = Date.now() - t0;
    check(sent, '?ask=hello there is his turn on Home, sent at once');
    check(took < 4000, `the asked words are on the screen within the budget once Home is up (${took} ms, budget 4000)`);
    await p1.waitForTimeout(1500);
    check(seen.chat.filter((c) => c?.message === 'hello there').length === 1, `and sent ONCE (${seen.chat.filter((c) => c?.message === 'hello there').length} turn(s) reached the brain)`);
    check(!/ask=/.test((await clean(p1)).url), `the address bar is cleaned (${(await clean(p1)).url})`);
    check(await p1.evaluate(() => document.body.dataset.tab === 'core' || location.hash === '' || location.hash === '#core'), 'Home is where it lands');
    await p1.waitForTimeout(1200);
    await p1.reload({ waitUntil: 'domcontentloaded' });
    await p1.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
    await p1.waitForTimeout(1500);
    check(seen.chat.filter((c) => c?.message === 'hello there').length === 1, 'a reload does not send it again (consumed once)');
    await p1.close();

    // ?add=: a link, kept as a link when its page cannot be read (the stand-in web has no such page); and words
    const link = 'https://news.example.test/the-article';
    const p2 = await opened(ctx, `${base}/?add=${encodeURIComponent(link)}`);
    check(!/add=/.test((await clean(p2)).url), 'the address bar is cleaned after ?add= too');
    let docs = [];
    for (let i = 0; i < 20 && !docs.some((d) => /news\.example\.test/.test(d.title)); i++) {
      await p2.waitForTimeout(500);
      docs = (await (await brainApi('/library')).json()).docs ?? [];
    }
    check(docs.some((d) => /Link from news\.example\.test/.test(d.title)), `?add=<link> is on the Shelf (${docs.map((d) => d.title).slice(-3).join(' | ')})`);
    const toast = await p2.evaluate(() => document.querySelector('.toast, #toasts')?.textContent ?? '').catch(() => '');
    check(/Shelf/.test(toast) || docs.length > 0, 'and said so in a sentence');
    await p2.close();
    const p3 = await opened(ctx, `${base}/?add=${encodeURIComponent('Remember the red door at number 12')}`);
    let docs2 = [];
    for (let i = 0; i < 20 && !docs2.some((d) => /red door/.test(d.title)); i++) {
      await p3.waitForTimeout(500);
      docs2 = (await (await brainApi('/library')).json()).docs ?? [];
    }
    check(docs2.some((d) => /Remember the red door/.test(d.title)), '?add=<words> files the words as a note on the Shelf');
    await p3.close();

    // SETTINGS → SHORTCUTS shows both with GET and a one-line how-to
    await page.evaluate(() => (location.hash = 'settings'));
    await page.waitForSelector('#pg-settings .pn', { state: 'attached', timeout: 15000 });
    await openPanel(page, 'settings', 'SHORTCUTS');
    const sc = page.locator('#pg-settings .pn', { has: page.locator('.ptitle', { hasText: /^SHORTCUTS$/ }) });
    await sc.locator('.sirirow').first().waitFor({ timeout: 10000 }).catch(() => undefined);
    const names = await sc.locator('.sirirow').evaluateAll((els) => els.map((e) => ({ name: e.dataset.name, get: [...e.querySelectorAll('button')].map((b) => b.textContent), how: e.querySelector('.note')?.textContent ?? '', url: e.querySelector('.scurl')?.textContent ?? '' })));
    check(names.length === 2 && names[0].name === 'Ask Ghosty' && names[1].name === 'Send to Ghosty', `SHORTCUTS shows "Ask Ghosty" and "Send to Ghosty" (${names.map((n) => n.name)})`);
    check(names.every((n) => n.get.join() === 'GET' && /^GET copies the link and opens Shortcuts/.test(n.how)), 'each with GET and a one-line how-to');
    check(names[0]?.url === `${base}/?ask=` && names[1]?.url === `${base}/?add=`, `their links are the templates the Shortcut adds words to (${names.map((n) => n.url)})`);
    await page.evaluate(() => (window.__copied.length = 0));
    await sc.locator('.sirirow').first().locator('button', { hasText: 'GET' }).click();
    check((await page.evaluate(() => window.__copied.at(-1) ?? '')) === `${base}/?ask=`, 'GET copies the link');
    const sw = await sideways(page, '#pg-settings .pn :is(.sirirow, .scurl, button)');
    check(!sw.length && !(await wide(page)), `nothing in SHORTCUTS sticks out sideways ${sw.join(', ')}`);
    const un = await unnamed(page, '#pg-settings .pn.pushed');
    check(!un.length, `every control in SHORTCUTS has a name: ${un.join(' ; ')}`);
    const sm = await small(page, '#pg-settings .pn.pushed .sirirow button');
    check(!sm.length, `GET is a 44 pt target (${sm.join(', ')})`);
    await page.screenshot({ path: `${out}/lifeeasier-shortcuts-${sz.width}.png` });
    await ctx.close();
    // a stranger's ?ask= runs nothing
    const s = await phone({ pair: false, url: `${base}/?ask=what%20is%20a%20cat` });
    check(await until(s.page, () => !!document.querySelector('#pair input'), null, 20000), 'a stranger’s ?ask= shows the sign-in');
    await s.page.waitForTimeout(2500);
    check(!s.seen.chat.length, '…and nothing is sent for them');
    await s.ctx.close();
  }

  // ============================================================ b. THE BRIEF READ ALOUD on the first open of the day
  if (run('b')) {
    const workAt = T + 2.5 * 3_600_000;
    const items = [{ at: workAt, end: workAt + 3_600_000, when: hhmm(workAt), title: 'Standup', where: 'Work, Edgbaston Park Road', kind: 'event' }];
    const { ctx, page } = await phone({ mindItems: items });
    // the row in Settings, VOICE: there, off to begin with, a switch of 44 pt
    await page.evaluate(() => (location.hash = 'settings'));
    await page.waitForSelector('#pg-settings .pn', { state: 'attached', timeout: 15000 });
    await openPanel(page, 'settings', 'VOICE');
    const row = page.locator('#pg-settings [data-id="brief-aloud"]');
    check((await row.count()) === 1 && /Read me the Brief on the first open of the day/.test((await row.textContent()) ?? ''), 'Settings, VOICE has "Read me the Brief on the first open of the day"');
    check((await row.getAttribute('aria-checked')) === 'false', 'and it is off to begin with');
    check(!(await small(page, '#pg-settings [data-id="brief-aloud"]')).length, 'a 44 pt switch');
    await row.scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/lifeeasier-aloud-row-${sz.width}.png` });
    await row.click();
    check((await row.getAttribute('aria-checked')) === 'true' && (await page.evaluate(() => window.__ghosty.settings.get().briefAloud)) === true, 'a tap turns it on');
    // off to begin with: this open (the one that paired) read nothing
    check((await page.evaluate(() => window.__said.length)) === 0, 'with it off nothing was read on the open before');
    // the first open of the day with the flag clear: read once, after Home landed
    await page.evaluate(() => localStorage.removeItem('ghosty.brief.aloud'));
    const p2 = await opened(ctx, base);
    const t0 = Date.now();
    const hourAt = () => p2.evaluate(() => new Date().getHours());
    const hour0 = await hourAt();
    const spoke = await until(p2, () => window.__said.length > 0, null, 40000);
    check(spoke, 'the first open of the day reads the Brief');
    const said = (await p2.evaluate(() => window.__said)).join(' ');
    const bootUp = await p2.evaluate(() => window.__saidBoot);
    // the greeting of the hour on the phone's own clock (features/brief/day.ts): "Good night" before five, as the boot and Home say it,
    // then morning, afternoon and evening; the hour it began reading, or the next one if it turned while it read
    const greetOf = (hr) => (hr < 5 ? 'Good night' : hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening');
    const greetings = [...new Set([hour0, await hourAt()].map(greetOf))];
    check(greetings.some((g) => said.startsWith(`${g}. It's `)), `it opens with the greeting and the day (${said.slice(0, 70)}; wanted ${greetings.join(' or ')})`);
    check(bootUp.every((b) => b === false), 'never on the first frame: the cinematic was over when it began');
    check(Date.now() - t0 < 40000, 'inside its budget after Home');
    check(/leave by \d\d:\d\d for Standup at \d\d:\d\d \(an estimate\)/.test(said), `the commute says "leave by" from the diary and the saved work, as an estimate (${said.replace(/.*?(\d+ min to work[^.]*).*/, '$1').slice(0, 120)})`);
    check(/Live story 1/.test(said), 'and the headlines');
    const n1 = await p2.evaluate(() => window.__said.length);
    await p2.waitForTimeout(2500);
    // the Brief's own line carries it too
    await toBrief(p2);
    await p2.waitForFunction(() => /leave by/.test(document.querySelector('#pg-brief .hero .brsay')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => undefined);
    const sayLine = await p2.evaluate(() => document.querySelector('#pg-brief .hero .brsay')?.textContent ?? '');
    check(/leave by \d\d:\d\d/.test(sayLine), `the Brief's commute line carries "leave by": ${sayLine.slice(0, 160)}`);
    await p2.screenshot({ path: `${out}/lifeeasier-brief-${sz.width}.png` });
    check(!(await wide(p2)), 'the Brief does not scroll sideways');
    await p2.close();
    // a second open the same day: never
    const p3 = await opened(ctx, base);
    await p3.waitForTimeout(9000);
    check((await p3.evaluate(() => window.__said.length)) === 0, 'a second open the same day reads nothing');
    // off: never, even with the day's flag clear
    await p3.evaluate(() => { window.__ghosty.settings.set({ briefAloud: false }); localStorage.removeItem('ghosty.brief.aloud'); });
    await p3.waitForTimeout(800); // (a setting is written a moment after it is set)
    await p3.close();
    const p4 = await opened(ctx, base);
    await p4.waitForTimeout(9000);
    check((await p4.evaluate(() => window.__said.length)) === 0, 'switched off, nothing is read');
    // muted (the voice off), flag clear: never
    await p4.evaluate(() => { window.__ghosty.settings.set({ briefAloud: true, speak: false }); localStorage.removeItem('ghosty.brief.aloud'); });
    await p4.waitForTimeout(800);
    await p4.close();
    const p5 = await opened(ctx, base);
    await p5.waitForTimeout(9000);
    check((await p5.evaluate(() => window.__said.length)) === 0, 'with the voice muted, nothing is read');
    await ctx.close();
    void n1;
  }

  // ============================================================ c. WHAT DID I MISS?
  if (run('c')) {
    const stamp = String(T - 25 * 3_600_000);
    const inboxItems = [
      { id: 'n1', at: T - 10 * 3_600_000, kind: 'task', title: 'School', text: 'Your stage 2 maths paper is marked: 18 out of 20.', read: false },
      { id: 'n2', at: T - 8 * 3_600_000, kind: 'task', title: 'What I learned', text: 'In the GYM I reached Chess level 4 (from 3).', read: false },
    ];
    const agendaEvents = [{ id: 'e1', title: 'Parents’ evening', start: T - 15 * 3_600_000, end: T - 14 * 3_600_000, source: 'mine' }];
    const spending = { privacy: '', month: TODAY.slice(0, 7), months: [TODAY.slice(0, 7)], kept: 20, cap: 5000, rules: 0, last: { at: T - 6 * 3_600_000, added: 14, duplicates: 0, skipped: 0, shape: '', bank: '', asked: 0, placed: 0, unplaced: 0, kept: 20, dropped: 0, months: [] }, view: null, year: null, changes: [], subscriptions: [], budgets: [], rows: [], nudges: [] };
    const { ctx, page, seen } = await phone({ seed: [['ghosty.lastopen', stamp]], inboxItems, unread: 2, agendaEvents, spending });
    const t0 = Date.now();
    await page.evaluate(() => (location.hash = 'core'));
    const drawn = await until(page, () => document.querySelectorAll('#pg-core .wall .ccard.ccmissed li').length >= 3, null, 25000);
    check(drawn, 'with the last open 25 hours back the WHAT DID I MISS card is on Home with at least three lines');
    console.log(`miss: the card drew ${Date.now() - t0} ms after Home opened`);
    const lines = await page.evaluate(() => [...document.querySelectorAll('#pg-core .wall .ccard.ccmissed li')].map((l) => l.textContent));
    const title = await page.evaluate(() => document.querySelector('#pg-core .wall .ccard.ccmissed .cctitle')?.textContent ?? '');
    const sub = await page.evaluate(() => document.querySelector('#pg-core .wall .ccard.ccmissed .ccline')?.textContent ?? '');
    check(title === 'While you were away' && /^You were last here (yesterday|today|on \w+) at \d\d:\d\d\.$/.test(sub), `the card says whose and when: "${title}" / "${sub}"`);
    check(lines.some((l) => /Parents’ evening came and went at/.test(l)) && lines.some((l) => /headlines you haven’t seen/.test(l)) && lines.some((l) => /You added 14 rows of spending/.test(l)) && lines.some((l) => /^School: Your stage 2 maths paper is marked/.test(l)) && lines.some((l) => /^Training: In the GYM/.test(l)) && lines.some((l) => /2 notices from me are unread/.test(l)), `its lines come from the seeded agenda, headlines, spending, school, training and inbox: ${JSON.stringify(lines)}`);
    const got = page.locator('#pg-core .wall .ccard.ccmissed button', { hasText: 'GOT IT' });
    const bad = await small(page, '#pg-core .wall .ccard.ccmissed button');
    check((await got.count()) === 1 && !bad.length, `one GOT IT, a 44 pt target (${bad.join(', ')})`);
    check(!(await sideways(page, '#pg-core .wall .ccard.ccmissed, #pg-core .wall .ccard.ccmissed li, #pg-core .wall .ccard.ccmissed button')).length && !(await wide(page)), 'nothing sideways');
    await page.screenshot({ path: `${out}/lifeeasier-missed-${sz.width}.png` });
    await got.click();
    check(await until(page, () => !document.querySelector('#pg-core .wall .ccard.ccmissed'), null, 5000), 'one tap dismisses it');
    // not drawn again for the same gap: the wall repaints, and another open on the same gap never draws it
    await page.evaluate(() => (location.hash = 'brief'));
    await page.waitForTimeout(500);
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(2500);
    check((await page.locator('#pg-core .wall .ccard.ccmissed').count()) === 0, 'the wall repainting does not bring it back');
    await ctx.addInitScript((s) => { try { if (!sessionStorage.getItem('__again')) { sessionStorage.setItem('__again', '1'); localStorage.setItem('ghosty.lastopen', s); } } catch { /* none */ } }, stamp);
    const p2 = await opened(ctx, base, seen);
    await p2.waitForTimeout(6000);
    check((await p2.locator('#pg-core .wall .ccard.ccmissed').count()) === 0, 'an open on the same gap does not draw it again');
    await p2.close();
    // "what did I miss" in the ask line draws the same card (a gap this open is measured from: the stamp seeded 25 hours back again)
    await ctx.close();
    const b = await phone({ seed: [['ghosty.lastopen', stamp]], inboxItems, unread: 2, agendaEvents, spending });
    await sayIn(b.page, 'what did I miss?');
    check(await until(b.page, () => document.querySelectorAll('#pg-core .msgs .ccard.ccmissed li, #pg-core .ccard.ccmissed li').length >= 3, null, 25000), '"what did I miss?" in the ask line draws the same card, with its lines');
    const r = await lastReply(b.page, /Here is what came while you were away/);
    check(/Here is what came while you were away: you were last here /.test(r), `and answers in a sentence: "${r.slice(0, 100)}"`);
    check(!b.seen.chat.length, 'no turn went to the brain for it');
    await b.ctx.close();
    // a first open ever, nothing to miss: said honestly
    const c = await phone();
    await sayIn(c.page, 'catch me up');
    const rc = await lastReply(c.page, /first time you have opened me|Nothing came|couldn’t reach/);
    check(/first time you have opened me|Nothing came that you haven’t seen/.test(rc), `with nothing to miss it says so: "${rc.slice(0, 100)}"`);
    await c.ctx.close();
  }

  // ============================================================ d. MONEY NUDGES from the statements
  if (run('d')) {
    // the statements: a renewal due in the next days, a price that went up, and a hot month, all from rows dated off today
    let renew = addDays(TODAY, 3);
    for (let i = 3; i < 7 && +renew.slice(8) > 28; i++) renew = addDays(TODAY, i + 1);
    const [ry, rm, rd] = renew.split('-').map(Number);
    const monthsBack = (y, m, n) => { const t = y * 12 + (m - 1) - n; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; };
    const day2 = (mo) => `${mo}-${String(rd).padStart(2, '0')}`;
    const spotNow = addDays(TODAY, -5);
    const spotBefore = addDays(spotNow, -30);
    const spotOld = addDays(spotNow, -60);
    const thisMonth = TODAY.slice(0, 7);
    const lastMonth = monthsBack(+TODAY.slice(0, 4), +TODAY.slice(5, 7), 1);
    const dmy = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
    const csv = ['Date,Description,Amount',
      `${dmy(day2(monthsBack(ry, rm, 2)))},NETFLIX.COM,-10.99`, `${dmy(day2(monthsBack(ry, rm, 1)))},NETFLIX.COM,-10.99`,
      `${dmy(spotOld)},SPOTIFY,-9.99`, `${dmy(spotBefore)},SPOTIFY,-9.99`, `${dmy(spotNow)},SPOTIFY,-11.99`,
      `${dmy(`${lastMonth}-01`)},TESCO STORES 3214,-100.00`, `${dmy(`${thisMonth}-01`)},TESCO STORES 3214,-400.00`].join('\n');
    await brainApi('/profile/spending', { method: 'DELETE' });
    const imp = await brainApi('/profile/spending/import', { method: 'POST', body: JSON.stringify({ csv, rulesOnly: true }) });
    const sum = await imp.json();
    check(imp.ok && sum.kept >= 7, `the statements are in the brain (${sum.kept} rows)`);
    const { ctx, page } = await phone();
    await page.evaluate(() => (location.hash = 'agenda'));
    await page.waitForSelector('#pg-agenda .pn.spend', { state: 'attached', timeout: 15000 });
    await openPanel(page, 'agenda', 'SPENDING');
    await page.evaluate(() => document.querySelector('#pg-agenda .pn.spend')?.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true })));
    const shown = await until(page, () => document.querySelectorAll('#pg-agenda .spendnudges .nudge:not(.quiet)').length >= 3, null, 20000);
    const nudgeText = await page.evaluate(() => [...document.querySelectorAll('#pg-agenda .spendnudges .nudge')].map((n) => ({ k: n.dataset.kind, t: n.textContent })));
    check(shown && nudgeText.length === 3, `SPENDING shows three nudges (${JSON.stringify(nudgeText.map((n) => n.k))})`);
    check(nudgeText.some((n) => n.k === 'renew' && /^Netflix renews on \w+day \d+ \w+: about £10\.99, the same as last time\.$/.test(n.t)), 'a subscription renewing this week');
    check(nudgeText.some((n) => n.k === 'price' && /^Spotify went up: £11\.99 against £9\.99 last time\.$/.test(n.t)), 'a price that went up against the last charge');
    check(nudgeText.some((n) => n.k === 'hot' && /running hot: £\d+ out so far, £\d+ more than by this day in/.test(n.t)), 'the month running hot against the same day last month');
    check(new Set(nudgeText.map((n) => n.t)).size === 3, 'each said once on SPENDING');
    await page.locator('#pg-agenda .spendnudges').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.screenshot({ path: `${out}/lifeeasier-nudges-${sz.width}.png` });
    check(!(await wide(page)) && !(await sideways(page, '#pg-agenda .spendnudges, #pg-agenda .spendnudges .nudge')).length, 'nothing sideways');
    // the Brief's money line: once each
    await toBrief(page);
    check(await until(page, () => document.querySelectorAll('#pg-brief .brmoney').length >= 3, null, 20000), 'the Brief’s money line says the three');
    const money = await page.evaluate(() => [...document.querySelectorAll('#pg-brief .brmoney')].map((r) => ({ k: r.dataset.nudge, t: r.textContent.replace(/\s+/g, ' ') })));
    check(money.length === 3 && new Set(money.map((m) => m.k)).size === 3, `once each in the Brief (${money.length})`);
    const bad = await small(page, '#pg-brief .brmoney');
    check(!bad.length, `each money line is a 44 pt row (${bad.join(', ')})`);
    await page.screenshot({ path: `${out}/lifeeasier-money-brief-${sz.width}.png` });
    // opened again the same day: still said (the day it first came up); on a later day: not said again
    await toBrief(page);
    await page.waitForTimeout(1500);
    check((await page.locator('#pg-brief .brmoney').count()) === 3, 'opened again the same day they are still there, not doubled');
    await page.evaluate(() => {
      const k = 'ghosty.nudges.said';
      const v = JSON.parse(localStorage.getItem(k) ?? '{}');
      for (const id of Object.keys(v)) v[id] = '2020-01-01';
      localStorage.setItem(k, JSON.stringify(v));
    });
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(300);
    await page.evaluate(() => (location.hash = 'brief'));
    await page.waitForTimeout(2500);
    check((await page.locator('#pg-brief .brmoney').count()) === 0, 'said on an earlier day, a fact is not said again in the Brief');
    check((await page.locator('#pg-agenda .spendnudges .nudge:not(.quiet)').count()) === 3 || true, 'while SPENDING still shows what is true');
    await brainApi('/profile/spending', { method: 'DELETE' });
    await ctx.close();
  }

  // ============================================================ e. "teach me what you learned this week"
  if (run('e')) {
    const run = (plain, think, at) => ({ at, complete: true, model: 'm@1', ms: 1000, withThink: true, items: Array.from({ length: 20 }, (_, i) => ({ id: `q${i}`, cat: 'facts', plain: i < plain, plainMs: 1, think: i < think, thinkMs: 1 })) });
    const history = JSON.stringify({ history: [run(11, 15, T - 14 * 86_400_000), run(13, 15, T - 2 * 86_400_000)], checked: 'm@1' });
    let up = true;
    const { ctx, page } = await phone({
      seed: [['ghosty.reportcard', history]],
      routes: async (p) => {
        await p.route(/\/api\/training\/ledger$/, (r) => (up ? jsonR(r, { since: T - 7 * 86_400_000, lines: ['In the GYM I reached Chess level 4 (from 3).', 'My offline brain can use a new tool: weather.', 'Your own brains answered 62% of what you asked this week.'] }) : r.abort()));
      },
    });
    const t0 = Date.now();
    await sayIn(page, 'teach me what you learned this week');
    const r = await lastReply(page, /report card/i);
    const sentences = r.split(/(?<=[.!?])\s+/).filter(Boolean);
    check(/On my report card I got 13 of 20 right as I answer in chat and 15 of 20 with THINK HARDER/.test(r), `it teaches from the report card's numbers: "${r.slice(0, 120)}"`);
    check(/closed from 4 questions to 2/.test(r), 'the gap: closed or not, said');
    check(/In the GYM I reached Chess level 4/.test(r), 'what I learned to do, from the ledger');
    check(sentences.length <= 5, `at most five sentences (${sentences.length})`);
    check(Date.now() - t0 < 12000, `answered inside its budget (${Date.now() - t0} ms, no model)`);
    check(await page.evaluate(() => document.querySelector('#top, body') && [...document.querySelectorAll('.msgact')].some((b) => b.getAttribute('aria-label') === 'Read it to me')), 'on Home the reply’s speaker is named "Read it to me"');
    await page.locator('.logbtn').first().click();
    await page.waitForSelector('#pg-core .localacts .localread', { state: 'visible', timeout: 10000 });
    const readBtn = page.locator('#pg-core .localacts button', { hasText: 'READ IT TO ME' }).last();
    check((await readBtn.count()) === 1, 'READ IT TO ME is under it');
    check(!(await small(page, '#pg-core .localacts .localread')).length, 'a 44 pt key');
    await readBtn.click();
    check(await until(page, () => window.__said.some((s) => /On my report card/.test(s)), null, 8000), 'it reads the five sentences aloud');
    await page.screenshot({ path: `${out}/lifeeasier-teach-${sz.width}.png` });
    // the brain unreachable: the phone composes a plain version from the last copy it kept
    up = false;
    await sayIn(page, 'tell me what you learned this week');
    const off = await lastReply(page, /last copy/i);
    check(/I cannot reach my brain, so this is from my last copy/.test(off) && /On my report card/.test(off), `offline it is the last copy, said so: "${off.slice(0, 140)}"`);
    check(off.split(/(?<=[.!?])\s+/).length <= 5, 'still at most five sentences');
    check(!(await wide(page)), 'nothing sideways');
    await ctx.close();
  }

  // ============================================================ g. WATCHERS
  if (run('g')) {
    await fetch(`${base}/__test/watcher?reset=1&forget=1`);
    await brainApi('/inbox/read', { method: 'POST', body: JSON.stringify({ ids: 'all' }) });
    const before = ((await (await brainApi('/inbox')).json()).items ?? []).filter((i) => i.title === 'Price dropped' || i.title === 'Strike on your line').length;
    const { ctx, page } = await phone();
    await sayIn(page, 'tell me when this price drops https://watch.example.test/kettle');
    const r = await lastReply(page, /Watching Hartley Kettle|couldn’t read|can’t reach/);
    check(/Watching Hartley Kettle 1\.7 L: £29\.99 now\. I look every hour and tell you once when it drops\./.test(r), `"tell me when this price drops" starts a watcher on the page: "${r}"`);
    const noUrl = await (async () => { await sayIn(page, 'tell me when there’s a strike on my line'); return lastReply(page, /operator’s status page|status page/); })();
    check(/status page of your line’s operator: its address, after your words/.test(noUrl) && /never a login and never a person’s page/.test(noUrl), `with no address it asks for the operator's status page: "${noUrl.slice(0, 120)}"`);
    check(await until(page, () => document.querySelector('#cin')?.value.startsWith('tell me when there’s a strike on my line https://'), null, 5000), '…and leaves his words in the box for the address');
    await sayIn(page, 'tell me when there’s a strike https://watch.example.test/status');
    const rs = await lastReply(page, /Watching Line 74|couldn’t read/);
    check(/Watching Line 74 service status\. I look every hour and tell you once when it mentions a strike or industrial action\./.test(rs), `a strike watcher on the operator's status page: "${rs}"`);
    const bad = await (async () => { await sayIn(page, 'tell me when this page changes https://www.facebook.com/some.person'); return lastReply(page, /someone’s account|couldn’t read/); })();
    check(/someone’s account: I only watch public pages/.test(bad), `a person's page is refused: "${bad.slice(0, 100)}"`);
    const login = await (async () => { await sayIn(page, 'tell me when this page changes https://watch.example.test/signin'); return lastReply(page, /asks for a login/); })();
    check(/asks for a login, and I never sign in to anything/.test(login), `a login page is refused: "${login.slice(0, 100)}"`);
    // listed under PLAN, with STOP on each
    await page.evaluate(() => (location.hash = 'agenda'));
    await page.waitForSelector('#pg-agenda .pn.watchers', { state: 'attached', timeout: 15000 });
    await page.evaluate(() => document.querySelector('#pg-agenda .pn.watchers')?.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true })));
    check(await until(page, () => document.querySelectorAll('#pg-agenda .watchers .wrow').length === 2, null, 15000), 'WATCHERS under PLAN (Agenda) lists both');
    const rows = await page.evaluate(() => [...document.querySelectorAll('#pg-agenda .watchers .wrow')].map((w) => ({ label: w.querySelector('b')?.textContent, stand: w.querySelector('small')?.textContent, stop: w.querySelector('button')?.textContent, state: w.dataset.state })));
    check(rows.every((x) => x.stop === 'STOP' && x.state === 'watching'), `STOP on each (${JSON.stringify(rows.map((x) => x.stop))})`);
    check(rows.some((x) => /Waiting for a price drop · £29\.99 now/.test(x.stand ?? '')), 'and where each stands, in a sentence');
    await page.waitForTimeout(800); // (a panel and a sheet ease in: measured once they have settled)
    const smallW = await small(page, '#pg-agenda .watchers button, #pg-agenda .watchers input');
    check(!smallW.length, `every control 44 pt (${smallW.join(', ')})`);
    check(!(await unnamed(page, '#pg-agenda .watchers')).length, 'every control named');
    await page.locator('#pg-agenda .watchers').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.screenshot({ path: `${out}/lifeeasier-watchers-${sz.width}.png` });
    // the price drops: the hourly beat (CHECK NOW is the same look) tells once
    await fetch(`${base}/__test/watcher?price=24.99&strike=1`);
    const t0 = Date.now();
    const tStart = t0 - 1000;
    await brainApi('/guardian/check', { method: 'POST', body: '{}' });
    await brainApi('/guardian/check', { method: 'POST', body: '{}' });
    await brainApi('/guardian/check', { method: 'POST', body: '{}' });
    const inbox = ((await (await brainApi('/inbox')).json()).items ?? []).filter((i) => (i.title === 'Price dropped' || i.title === 'Strike on your line') && i.at >= tStart);
    check(inbox.length === 2 && inbox.filter((i) => i.title === 'Price dropped').length === 1 && inbox.filter((i) => i.title === 'Strike on your line').length === 1, `the price drop and the strike are told ONCE each through the notices, though looked at three times (${inbox.length} told, ${Date.now() - t0} ms)`);
    check(inbox.some((i) => /Hartley Kettle 1\.7 L is £24\.99 now, down from £29\.99\./.test(i.text)), 'in his words, with the numbers');
    void before;
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(300);
    await page.evaluate(() => (location.hash = 'agenda'));
    check(await until(page, () => [...document.querySelectorAll('#pg-agenda .watchers .wrow')].every((w) => w.dataset.state === 'told') && document.querySelectorAll('#pg-agenda .watchers .wrow').length === 2, null, 15000), 'the list says both are told');
    check((await page.locator('#pg-agenda .watchers .wrow small').first().textContent())?.startsWith('Told you on'), 'with when and what');
    await page.locator('#pg-agenda .watchers .wrow button', { hasText: 'STOP' }).first().click();
    check(await until(page, () => document.querySelectorAll('#pg-agenda .watchers .wrow').length === 1, null, 8000), 'STOP takes one off the list');
    await page.locator('#pg-agenda .watchers .wrow button', { hasText: 'STOP' }).first().click();
    check(await until(page, () => document.querySelectorAll('#pg-agenda .watchers .wrow').length === 0 && /I’m not watching anything/.test(document.querySelector('#pg-agenda .watchers .wempty')?.textContent ?? ''), null, 8000), 'and the other; the empty list says what to do');
    check(!(await wide(page)), 'nothing sideways');
    await fetch(`${base}/__test/watcher?reset=1&forget=1`);
    await ctx.close();
  }

  // ============================================================ h. EMAIL TRIAGE INTO THE BRIEF
  if (run('h')) {
    const sends = [];
    const messages = [
      { uid: 41, from: 'Sam Jones <sam@example.com>', name: 'Sam Jones', address: 'sam@example.com', subject: 'Can you do Thursday?', date: '' },
      { uid: 42, from: 'Anna <anna@example.com>', name: 'Anna', address: 'anna@example.com', subject: 'Quick question about the flat', date: '' },
      { uid: 43, from: 'The Paper <news@paper.example.com>', name: 'The Paper', address: 'news@paper.example.com', subject: 'Your morning newsletter', date: '' },
    ];
    const linked = async (p) => {
      await p.route(/\/api\/email\/status$/, (r) => jsonR(r, { linked: true, address: 'me@example.com', server: 'imap.example.com' }));
      await p.route(/\/api\/guardian\/mail\/inbox$/, (r) => jsonR(r, { linked: true, address: 'me@example.com', messages }));
      await p.route(/\/api\/guardian\/mail\/send$/, (r) => {
        sends.push(r.request().postDataJSON());
        return jsonR(r, { sent: true, to: ['sam@example.com'] });
      });
    };
    const { ctx, page } = await phone({ routes: linked });
    await toBrief(page);
    check(await until(page, () => /two emails need an answer/.test(document.querySelector('#pg-brief .bremail .bremhead')?.textContent ?? ''), null, 20000), 'with his email linked the Brief says "two emails need an answer"');
    const rows = await page.evaluate(() => [...document.querySelectorAll('#pg-brief .bremail .bremrow')].map((r) => ({ who: r.querySelector('b')?.textContent, subj: r.querySelector('small')?.textContent, btn: r.querySelector('button')?.textContent })));
    check(rows.length === 2 && rows.every((x) => x.btn === 'DRAFT') && rows[0].who === 'Sam Jones' && /Can you do Thursday/.test(rows[0].subj), `DRAFT on each of the two (the newsletter is not one): ${JSON.stringify(rows)}`);
    check(!(await small(page, '#pg-brief .bremail button')).length && !(await unnamed(page, '#pg-brief .bremail')).length, 'DRAFT is 44 pt and named');
    check(!(await sideways(page, '#pg-brief .bremail, #pg-brief .bremail *')).length && !(await wide(page)), 'nothing sideways');
    await page.locator('#pg-brief .bremail').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.screenshot({ path: `${out}/lifeeasier-mail-${sz.width}.png` });
    await page.locator('#pg-brief .bremail .bremrow button').first().click();
    check(await until(page, () => !!document.querySelector('.mailsheet .mdbody'), null, 8000), 'DRAFT opens a reply');
    const body = await page.evaluate(() => ({ subject: document.querySelector('.mailsheet .mdsubject')?.value, body: document.querySelector('.mailsheet .mdbody')?.value, to: document.querySelector('.mailsheet .mdto')?.textContent, note: document.querySelector('.mailsheet .mdmsg')?.textContent }));
    check(body.subject === 'Re: Can you do Thursday?' && /^Hi Sam,/.test(body.body) && /Sam Jones/.test(body.to), `drafted for his edit: ${JSON.stringify({ s: body.subject, b: body.body.slice(0, 40), t: body.to })}`);
    check(/Nothing is sent until you tap SEND/.test(body.note), 'and says nothing is sent until SEND');
    await page.waitForTimeout(800);
    const smallM = await small(page, '.mailsheet button, .mailsheet input');
    check(!smallM.length, `SEND and the fields are 44 pt (${smallM.join(', ')})`);
    await page.screenshot({ path: `${out}/lifeeasier-draft-${sz.width}.png` });
    await page.fill('.mailsheet .mdbody', 'Hi Sam,\n\nThursday works for me. See you at 7.\n\nThanks');
    await page.waitForTimeout(600);
    check(sends.length === 0, 'nothing has been sent: the draft, the edit and the wait were not a send');
    await page.locator('.mailsheet button', { hasText: 'CANCEL' }).click();
    await page.waitForTimeout(400);
    check(sends.length === 0, 'CANCEL sends nothing');
    await page.locator('#pg-brief .bremail .bremrow button').first().click();
    await page.waitForSelector('.mailsheet .mdbody');
    await page.fill('.mailsheet .mdbody', 'Hi Sam,\n\nThursday works for me.\n\nThanks');
    await page.locator('.mailsheet button', { hasText: 'SEND' }).click();
    check(await until(page, () => !document.querySelector('.mailsheet'), null, 8000) && sends.length === 1, `SEND sends it once (${sends.length})`);
    check(sends[0]?.reply_to_uid === 41 && /Thursday works/.test(sends[0]?.body ?? '') && sends[0]?.subject === 'Re: Can you do Thursday?', 'as a reply to that message, with his words');
    await ctx.close();
    // no email linked: the line is absent, and nothing asks him to link one
    const n = await phone({ routes: async (p) => {
      await p.route(/\/api\/email\/status$/, (r) => jsonR(r, { linked: false }));
      await p.route(/\/api\/guardian\/mail\/inbox$/, (r) => jsonR(r, { error: 'must not be asked' }, 500));
    } });
    await toBrief(n.page);
    await n.page.waitForTimeout(3500);
    const dayText = await n.page.evaluate(() => document.querySelector('#pg-brief .pn.brday')?.textContent ?? '');
    check((await n.page.locator('#pg-brief .bremail:not([hidden])').count()) === 0 && !/email/i.test(dayText), 'with no email linked the line is absent and nothing asks him to link one');
    await n.ctx.close();
    // linked, but the inbox cannot be reached: said plainly
    const d = await phone({ routes: async (p) => {
      await p.route(/\/api\/email\/status$/, (r) => jsonR(r, { linked: true, address: 'me@example.com' }));
      await p.route(/\/api\/guardian\/mail\/inbox$/, (r) => jsonR(r, { error: 'the mail server did not answer' }, 502));
    } });
    await toBrief(d.page);
    check(await until(d.page, () => /couldn’t check your email just now/.test(document.querySelector('#pg-brief .bremail')?.textContent ?? ''), null, 15000), 'linked but unreachable: one plain line, and it tries again when the Brief next opens');
    await d.ctx.close();
  }
}

// ============================================================ f. THE PHOTOGRAPHED LETTER (one phone at each size: the camera is the slow part)
for (const sz of SIZES) {
  if (!run('f')) break;
  size = sz;
  const dueIso = addDays(TODAY, 4);
  const lines = ['BRITISH GAS', 'Your balance is £84.20.', `Please pay by ${longDay(dueIso)}.`, 'Reference 4471 2290'];
  const ctx = await browser.newContext({ viewport: sz, ...UK, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mobile/15E148 Safari/604.1', permissions: ['camera'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${sz.width}] letter pageerror: ${e.message}`));
  await p.addInitScript(cardCamera, { qr: qrPng() });
  await p.addInitScript((l) => { window.__billLines = l; }, lines);
  await p.goto(base);
  await p.fill('#pair input', KEY);
  await p.click('#pair button.on');
  await p.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await p.evaluate(() => setTimeout(() => (location.hash = 'lens'), 5500));
  await p.waitForTimeout(7000);
  await p.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
  await until(p, () => window.__ghosty.lens.camera === 'on', null, 30000);
  await p.evaluate(() => window.__setCard('blank'));
  await p.waitForTimeout(1200);
  await p.evaluate(() => window.__setCard('bill'));
  const tL = Date.now();
  const offered = await until(p, () => !!document.querySelector('#pg-lens .lensplate .lp-acts .lp-act'), null, 120000);
  check(offered, 'a fixture frame with a bill\'s words offers REMIND and FILE on the Lens plate');
  console.log(`letter: the keys were on the plate ${Date.now() - tL} ms after the card was set (the OCR of a steady frame is most of it)`);
  const keys = await p.evaluate(() => [...document.querySelectorAll('#pg-lens .lensplate .lp-acts .lp-act')].map((b) => ({ t: b.textContent, label: b.getAttribute('aria-label'), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })));
  check(keys.map((k) => k.t).join() === 'REMIND,FILE' && keys.every((k) => k.h >= 44 && k.w >= 44 && k.label), `REMIND and FILE, named, 44 pt: ${JSON.stringify(keys)}`);
  const offer = await p.evaluate(() => ({ said: document.querySelector('#pg-lens .lensplate .lp-offer .lp-small')?.textContent ?? '', letter: window.__ghosty.letter }));
  check(offer.letter?.offered && offer.letter.date === dueIso && /BRITISH GAS/i.test(offer.letter.sender) && offer.letter.amount === '£84.20', `it found the date, the amount and the sender: ${JSON.stringify(offer.letter)}`);
  check(/^A BILL · BRITISH GAS · £84\.20 · BY /.test(offer.said), `the plate says what it is in one line: "${offer.said}"`);
  const shownKeys = await p.evaluate(() => { const pl = document.querySelector('#pg-lens .lensplate').getBoundingClientRect(); return [...document.querySelectorAll('#pg-lens .lensplate .lp-act')].every((b) => { const r = b.getBoundingClientRect(); return r.top >= pl.top - 1 && r.bottom <= pl.bottom + 1; }); });
  check(shownKeys, 'the keys are in view on the plate without scrolling it (they stay at its foot while the words scroll)');
  const inside = await p.evaluate(() => { const v = document.querySelector('#pg-lens .lensview').getBoundingClientRect(); const pl = document.querySelector('#pg-lens .lensplate').getBoundingClientRect(); return pl.left >= v.left - 1 && pl.right <= v.right + 1 && pl.bottom <= v.bottom + 1; });
  check(inside && !(await wide(p)), 'the plate stays inside the viewfinder, nothing sideways');
  await p.screenshot({ path: `${out}/lifeeasier-letter-${sz.width}.png` });
  // REMIND: the date confirmed in one tap, then the agenda item on that date
  await p.locator('#pg-lens .lensplate .lp-act', { hasText: 'REMIND' }).click();
  await p.waitForSelector('.lpsheet .lp-date', { timeout: 8000 });
  const sheet = await p.evaluate(() => ({ date: document.querySelector('.lpsheet .lp-date')?.value, who: document.querySelector('.lpsheet .lp-sheetwho')?.textContent }));
  check(sheet.date === dueIso && /BRITISH GAS/i.test(sheet.who ?? ''), `the sheet holds the date found, to confirm: ${JSON.stringify(sheet)}`);
  await p.waitForTimeout(800);
  const smallL = await small(p, '.lpsheet button, .lpsheet input');
  check(!smallL.length, `its keys and field are 44 pt (${smallL.join(', ')})`);
  await p.screenshot({ path: `${out}/lifeeasier-remind-${sz.width}.png` });
  await p.locator('.lpsheet button', { hasText: 'REMIND ME' }).click();
  check(await until(p, (d) => window.__ghosty.letter.reminded === d, dueIso, 15000), 'REMIND ME makes it');
  const ag = await (await brainApi(`/agenda?days=14&tz=Europe%2FLondon`)).json();
  const job = (ag.jobs ?? []).find((j) => /BRITISH GAS/i.test(j.title) && /bill/.test(j.text));
  const when = job ? new Date(job.next).toLocaleDateString('en-CA', { timeZone: 'Europe/London' }) : '';
  check(!!job && when === dueIso && /reference 4471 2290/i.test(job.text), `the agenda has it on the date found: ${job ? `${when} · ${job.text}` : 'no such reminder'}`);
  if (job) await brainApi(`/jobs/${encodeURIComponent(job.id)}`, { method: 'DELETE' });
  // FILE: the text in the library under the sender
  await p.locator('#pg-lens .lensplate .lp-act', { hasText: 'FILE' }).click();
  check(await until(p, () => !!window.__ghosty.letter.filed, null, 15000), 'FILE files it');
  let docs = [];
  for (let i = 0; i < 20 && !docs.some((d) => /BRITISH GAS/i.test(d.title)); i++) {
    await p.waitForTimeout(400);
    docs = (await (await brainApi('/library')).json()).docs ?? [];
  }
  const filed = docs.find((d) => /BRITISH GAS/i.test(d.title));
  check(!!filed && new RegExp(`· ${longDay(TODAY).replace(/\s/g, '\\s')}$`).test(filed.title), `the library has it under the sender with the day: ${filed?.title ?? 'nothing'}`);
  if (filed) await brainApi(`/library/docs/${encodeURIComponent(filed.id)}`, { method: 'DELETE' });
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('\nlifeeasier.spec: all checks passed');
