// THE GUARDIAN on the owner's phone (440 × 956; OWNER-ISSUES 55, 56, 58, 60), against the preview brain with its public
// feeds stood in (tests/fixtures/guardian-feeds.mjs: never the live ones):
//  1. his home saved: THREATS → NEAR HOME says "Nothing active near Home." in his voice, the feeds' last look and the month's
//     street crime as police.uk published it (a count, never a forecast);
//  2. a flood alert and a weather warning appear: CHECK NOW tells him, the brain's ONE notification is in the inbox with
//     both lines, the card shows each with its source and since when; the same look again says nothing new; they lift:
//     the all-clear, once;
//  3. the Me sheet's WATCHING OVER YOU: the places, the three feeds' times, the named person;
//  4. Settings → GUARDIAN: a named person (an email; never a phone number), TEST MESSAGE says honestly why it cannot go
//     yet; the panic phrase set as a scrambled copy only — its words in no request (the marker method);
//  5. WALK ME HOME in the chat: "How long?", "20 minutes", the start in his words with the honest limit; at the ETA (the
//     brain's own alarm, brought forward) "Home?" in the inbox and the bar; I'M HOME ends it;
//  6. the panic phrase typed in the chat: handled at once, nothing of it in the chat, its words in no request;
//  7. a scam check through the chat: the verdict with its reasons, never "safe";
//  then everything is put back (the place, the person, the phrase, the feeds quiet, the inbox read) for the specs after it.
//   BASE=http://localhost:8788 node tests/guardian.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel, openSection } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const PHRASE = 'Purple Giraffe';

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: PHONE, ...UK, serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
const sent = [];
await ctx.route('**/*', (route) => {
  const r = route.request();
  sent.push({ url: r.url(), body: r.postData() ?? '' });
  return route.continue();
});
const feeds = (q) => fetch(`${base}/__test/guardian?${q}`).then((r) => r.json());
// quiet, and nothing told yet (CI retries a failed spec on the same brain)
await feeds('flood=0&weather=0&reset=1');
const t0 = Date.now() - 1000;

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
const api = (path, init = {}) => page.evaluate(async ([p, i, k]) => (await fetch(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), [path, init, KEY]);
const toasts = () => page.evaluate(() => document.querySelector('#toasts')?.textContent ?? '');
const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() ?? '', sel);

// his home, as Memory → ME → PLACES keeps it
const had = (await api('/profile/places')).places ?? [];
await api('/profile/places', { method: 'POST', body: JSON.stringify({ found: { id: 'home', label: 'Home', query: 'B13 8PX', address: 'B13 8PX, Moseley, Birmingham', lat: 52.443186, lon: -1.892525 } }) });

// ---- 1. NEAR HOME, quiet
await page.evaluate(() => (location.hash = 'threats'));
await openSection(page, 'threats', 'Near you');
const card = '#pg-threats .pn.nearhome';
await page.waitForSelector(card, { timeout: 10000 });
const checkNow = () => page.locator(`${card} button`, { hasText: 'CHECK NOW' }).click();
await checkNow();
await until((s) => /I'm watching Home\. Nothing active\. Last look \d\d:\d\d\./.test(document.querySelector(`${s} .watchline`)?.textContent ?? ''), card, 15000, `NEAR HOME's line: "${await text(`${card} .watchline`)}"`);
const quiet = await text(card);
check(/HOME\s*Nothing active near Home\./.test(quiet), `NEAR HOME does not say "Nothing active near Home.": ${quiet}`);
check(/Street crime near Home, \w+: 3 reported within a mile — anti-social behaviour 2, vehicle crime 1\. A count as police\.uk published it/.test(quiet), `the month's crime: ${quiet}`);
check(/Last looked: Environment Agency \d\d:\d\d · Met Office \d\d:\d\d · police\.uk \d\d:\d\d\./.test(quiet), `the feeds' last look: ${quiet}`);
/** This run's inbox items (CI's one preview brain keeps every earlier run's). */
const mine = async () => ((await api('/inbox')).items ?? []).filter((i) => i.at >= t0);
const inboxCount = async (title) => (await mine()).filter((i) => i.title === title).length;

// ---- 2. a flood alert and a weather warning appear: told once; the all-clear once
await feeds('flood=1&weather=1');
await checkNow();
await until((s) => (document.querySelector(s)?.textContent ?? '').includes('River Cole'), card, 15000, `the warnings did not come: ${await text(card)}`);
const loud = await text(card);
check(/Flood alert: River Cole at Kings Heath and Moseley · Environment Agency · since \d\d:\d\d/.test(loud), `the flood row: ${loud}`);
check(/Yellow warning of wind · Met Office · since \d\d:\d\d · until \d\d:\d\d/.test(loud), `the weather row: ${loud}`);
check(/I'm watching Home\. 2 warnings active\./.test(loud), `the line with warnings: ${loud}`);
check(/Flood alert near Home|Yellow warning of wind near Home/.test(await toasts()), `CHECK NOW did not tell him: "${await toasts()}"`);
const told = (await mine()).filter((i) => i.title === '2 warnings near your places');
check(told.length === 1 && /Flood alert near Home: River Cole/.test(told[0]?.text ?? '') && /Yellow warning of wind near Home \(Met Office, since/.test(told[0]?.text ?? '') && told[0]?.kind === 'error', `the notification: ${JSON.stringify(told)}`);
await page.screenshot({ path: `${out}/guardian-nearhome.png` });
await checkNow();
await page.waitForTimeout(800);
check((await inboxCount('2 warnings near your places')) === 1, 'the same warnings were told twice');

// ---- 3. the Me sheet: WATCHING OVER YOU
await page.click('#top .you');
await page.waitForSelector('#mesheet .meguard', { timeout: 8000 }).catch(() => problems.push('no WATCHING OVER YOU card on the Me sheet'));
await page.waitForTimeout(600);
const me = await text('#mesheet .meguard');
check(/^Watching over you\s*I'm watching Home\. 2 warnings active\. Last look \d\d:\d\d\./.test(me), `the card: ${me}`);
check(/Feeds\s*Floods \d\d:\d\d · Weather \d\d:\d\d · Crime \d\d:\d\d/.test(me) && /Named person\s*Nobody yet/.test(me), `the card's rows: ${me}`);
const parts = await page.evaluate(() => [...document.querySelectorAll('#mesheet [data-part]')].map((x) => x.dataset.part));
check(parts[0] === 'head' && parts[1] === 'status' && parts[2] === 'guardian', `the sheet's order: ${parts.join(', ')}`);
await page.screenshot({ path: `${out}/guardian-me.png` });
await page.keyboard.press('Escape');
await page.waitForTimeout(400);

// they lift: the all-clear, once
await feeds('flood=0&weather=0');
await checkNow();
await until((s) => /Nothing active near Home\./.test(document.querySelector(s)?.textContent ?? ''), card, 15000, 'the card did not go quiet');
const clear = (await mine()).filter((i) => i.title === 'All clear');
check(clear.length === 1 && /The flood alert near Home has lifted \(Environment Agency\)\./.test(clear[0]?.text ?? '') && /The yellow wind warning near Home has lifted \(Met Office\)\./.test(clear[0]?.text ?? ''), `the all-clear: ${JSON.stringify(clear)}`);
await checkNow();
await page.waitForTimeout(800);
check((await inboxCount('All clear')) === 1, 'the all-clear was said twice');

// ---- 4. Settings → GUARDIAN
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'GUARDIAN');
const gp = '#pg-settings .pn.pushed';
await page.waitForSelector(`${gp} input[aria-label="Your named person"]`, { timeout: 8000 });
await page.fill(`${gp} input[aria-label="Your named person"]`, 'Sam');
await page.fill(`${gp} input[aria-label="Their Telegram handle"]`, '07700 900123');
await page.locator(`${gp} button`, { hasText: 'SAVE' }).click();
await until(() => /Telegram handle is 5 to 32 letters/.test(document.querySelector('#toasts')?.textContent ?? ''), null, 6000, `a phone number was taken as a handle: "${await toasts()}"`);
await page.fill(`${gp} input[aria-label="Their Telegram handle"]`, '');
await page.fill(`${gp} input[aria-label="Their email address"]`, 'sam@example.com');
await page.fill(`${gp} input[aria-label="Your name for them"]`, 'Aqis');
await page.locator(`${gp} button`, { hasText: 'SAVE' }).click();
await until(() => /Sam is your named person/.test(document.querySelector('#toasts')?.textContent ?? ''), null, 6000, `SAVE: "${await toasts()}"`);
await until((s) => /Sam can't be reached yet: link your email in LINKS → EMAIL\./.test(document.querySelector(`${s} .guardstate`)?.textContent ?? ''), gp, 6000, `the state line: "${await text(`${gp} .guardstate`)}"`);
await page.locator(`${gp} button`, { hasText: 'TEST MESSAGE' }).click();
await until(() => /It didn't go: your email is not linked/.test(document.querySelector('#toasts')?.textContent ?? ''), null, 8000, `TEST MESSAGE: "${await toasts()}"`);
check(/never a text|Never a text/i.test(await text(gp)) && /only know where you are while I’m open/.test(await text(gp)), 'GUARDIAN does not say its limits');
// the panic phrase: an everyday word is refused, then his phrase is kept as a scrambled copy only
await page.fill(`${gp} input[aria-label="Your panic phrase"]`, 'help');
await page.locator(`${gp} button`, { hasText: /^SET$/ }).click();
await until(() => /at least two words/.test(document.querySelector('#toasts')?.textContent ?? ''), null, 5000, `a one-word phrase was not refused: "${await toasts()}"`);
await page.fill(`${gp} input[aria-label="Your panic phrase"]`, PHRASE);
await page.locator(`${gp} button`, { hasText: /^SET$/ }).click();
await until((s) => /^Set \(2 words\)/.test(document.querySelector(`${s} .panicstate`)?.textContent ?? ''), gp, 8000, `the phrase: "${await text(`${gp} .panicstate`)}"`);
check((await page.inputValue(`${gp} input[aria-label="Your panic phrase"]`)) === '', 'the phrase stayed on screen');
const box = await page.locator(`${gp} input[aria-label="Your panic phrase"]`).getAttribute('type');
check(box === 'password', 'the phrase is typed in the open');
await page.screenshot({ path: `${out}/guardian-settings.png` });

// ---- 5. WALK ME HOME in the chat
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { state: 'visible', timeout: 10000 });
const replies = () => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent?.replace(/\s+/g, ' ').trim() ?? ''));
const lastReply = async () => (await replies()).at(-1) ?? '';
const say = async (t) => {
  await page.fill('#cin', t);
  await page.keyboard.press('Enter');
};
await say('walk me home');
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /How long will it take you\?/.test(m.textContent ?? '')), null, 15000, `"walk me home" → "${await lastReply()}"`);
await say('20 minutes');
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /Walking you home: about 20 minutes/.test(m.textContent ?? '')), null, 15000, `"20 minutes" → "${await lastReply()}"`);
const started = (await replies()).find((r) => /Walking you home/.test(r)) ?? '';
check(/so I'll ask at \d\d:\d\d\. Say "home" when you're in\. \(I can't reach Sam yet: Settings → GUARDIAN\.\) I only know where you are while I’m open\./.test(started), `the start: ${started}`);
// the ETA, as the brain's clock runs it
await fetch(`${base}/__test/walk-due`).then((r) => r.json());
await page.evaluate(() => window.__ghosty.guardian.load());
await page.waitForSelector('#walkask', { timeout: 10000 }).catch(() => problems.push('no "Home?" bar at the ETA'));
check(/^Home\?/.test(await text('#walkask')), `the bar: ${await text('#walkask')}`);
check((await inboxCount('Home?')) === 1, '"Home?" is not in the inbox');
await page.screenshot({ path: `${out}/guardian-home.png` });
await page.locator('#walkask button', { hasText: "I'M HOME" }).click();
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /(?:^|\s|AI|s)Good\.( Night\.)?$/.test(m.textContent?.trim() ?? '')), null, 10000, `I'M HOME → ${JSON.stringify((await replies()).slice(-3))}`);
check(!(await page.locator('#walkask').count()), 'the bar stayed after I\'M HOME');
check((await api('/guardian')).walk?.stage === 'done', 'the walk is not over');

// ---- 6. the panic phrase in the chat: at once, nothing of it in the chat
const before = (await page.evaluate(() => document.querySelectorAll('#pg-core .msg').length));
await say(PHRASE.toLowerCase());
await until(() => /It couldn't go: your email is not linked|Sent\./.test(document.querySelector('#toasts')?.textContent ?? ''), null, 10000, `the panic phrase: "${await toasts()}"`);
await page.waitForTimeout(500);
check((await page.evaluate(() => document.querySelectorAll('#pg-core .msg').length)) === before, 'the panic phrase showed in the chat');
const leaked = sent.filter((r) => /giraffe/i.test(r.url) || /giraffe/i.test(r.body));
check(!leaked.length, `the panic phrase's words left the phone: ${leaked.map((r) => r.url).join(', ')}`);
check(sent.some((r) => r.url.endsWith('/api/guardian/panic')), 'the panic message was not asked for');

// ---- 7. a scam check through the chat
await say('is this a scam? Evri: your parcel is on hold. Pay the £1.45 fee within 24 hours at evri-parcel-fee.live/pay');
await until(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].some((m) => /That looks like a scam\./.test(m.textContent ?? '')), null, 20000, `the scam check: "${await lastReply()}"`);
check(!/\bsafe\b/i.test(await lastReply()), `the verdict said "safe": ${await lastReply()}`);
for (const s of await page.evaluate(() => [...document.querySelectorAll('#pg-core :is(button, input)')].filter((e) => e.getClientRects().length).map((e) => e.getBoundingClientRect().right))) if (s > PHONE.width + 1) problems.push(`something sticks out sideways at ${Math.round(s)} px`);

// ---- put back what this spec changed, for the specs after it on the same brain
await api('/guardian/person', { method: 'DELETE' });
await api('/guardian/panic-phrase', { method: 'DELETE' });
if (!had.some((p) => p.id === 'home')) await api('/profile/places?id=home', { method: 'DELETE' });
await feeds('flood=0&weather=0');
await api('/inbox/read', { method: 'POST', body: JSON.stringify({ ids: 'all' }) });

await browser.close();
if (problems.length) {
  console.error(`FAIL guardian:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log('ok: THE GUARDIAN — NEAR HOME quiet, a warning told once with its notification, the all-clear once; WATCHING OVER YOU; GUARDIAN set up honestly with the phrase kept scrambled; WALK ME HOME to "Home?" and I\'M HOME; the panic phrase never in the chat or a request; a scam checked');
