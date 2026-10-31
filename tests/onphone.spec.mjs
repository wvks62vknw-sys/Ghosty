// The on-device choice fails CLOSED (OWNER-ISSUES 72), by the commenter's method: a fictional statement with a distinctive
// marker, the on-device route forced, the local model made unavailable (the stand-in at window.__ghostyOfflineEngine says it
// is not on this phone). Every request leaving the page is watched (every /api/* call, the cloud chat, Ghosty's voice):
//  A. the offline brain on "always", no local model: the task stops with the plain explanation on screen, the marker is
//     in no request, and the cloud is reachable only by a tap (ASK THE BIG BRAIN on that message) — which then sends it;
//  B. "always" with the local model: answered on the phone and read out in the phone's own voice; later, in "only when
//     needed", the brain's chat never carries that private turn among its recent turns;
//  C. "only when needed" with ON THIS PHONE for one message, no local model: the same stop, nothing sent; the switch is
//     off again for the next message, which goes to the brain without the private one;
//  D. ON THIS PHONE with the local model: answered on the phone, nothing sent; THINK HARDER on that answer stays private
//     too (the next message to the brain never carries "Think harder: <the private question>").
// The switch is at least 44 pt to the touch, and nothing scrolls sideways.
//   BASE=http://localhost:8788 node tests/onphone.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { mkdirSync } from 'node:fs';
import { PHONE, UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
// Fictional, and nothing a reply or a page would ever contain by chance.
const MARK = { a: 'Quillon Vexmoor-7731', b: 'Tamsin Orrowgate-5512', c: 'Bexley Quorndrake-2207', d: 'Ilsa Prendergrue-9046' };

// The service worker is blocked: once it controls the page, Chromium reports none of the page's requests to the test (the
// worker's network events are off by default), so the watch below would go blind. It only passes the page's own requests
// on, so what a turn sends is the same without it.
const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, ...UK, serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.addInitScript(() => {
  // The phone's model, stood in for: on this phone (ready) or not, as each part needs.
  window.__ghostyOfflineEngine = {
    ready: true,
    calls: [],
    idleMs: 60000,
    load() {},
    unload() {},
    async chat(messages, onToken) {
      this.calls.push(messages.at(-1)?.content ?? '');
      for (const w of ['Kept ', 'between ', 'us.']) {
        await new Promise((r) => setTimeout(r, 30));
        onToken(w);
      }
    },
  };
  // The phone's own voice, recorded (headless Chromium has none).
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  speechSynthesis.getVoices = () => [{ name: 'Daniel', lang: 'en-GB', localService: true, default: true, voiceURI: 'Daniel' }];
  speechSynthesis.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend?.(), 10); };
});
// Every request that leaves the page, with what it carries: each one is held at the door, written down, then sent on as it
// was. (Not the 'request' event: after a streamed chat reply Chromium's request events stall, and the watch would go blind.)
const sent = [];
await ctx.route('**/*', (route) => {
  const r = route.request();
  sent.push({ url: r.url(), path: new URL(r.url()).pathname, body: r.postData() ?? '' });
  return route.continue();
});
const carrying = (mark) => sent.filter((r) => r.url.includes(mark) || r.body.includes(mark));
const chats = () => sent.filter((r) => r.path === '/api/chat').length;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
/** Until no request has left for 2.5 s (at most 60 s): the opening's library copy, or anything a step set off. */
async function quiet() {
  for (let n = sent.length, since = Date.now(), end = Date.now() + 60_000; Date.now() < end; await pause(250)) {
    if (sent.length !== n) [n, since] = [sent.length, Date.now()];
    else if (Date.now() - since >= 2500) return;
  }
}
/** Until the brain's chat has been asked `n` times in all (the record can trail the page by a moment). */
async function chatsReach(n, ms = 15000) {
  for (const end = Date.now() + ms; chats() < n && Date.now() < end; ) await pause(100);
  await quiet();
}

await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
await page.evaluate(() => (location.hash = 'core'));
await page.waitForSelector('#cin', { state: 'visible', timeout: 10000 });
await page.evaluate(() => window.__ghosty.settings.set({ speak: true }));
await quiet(); // the opening's copy of the library is in: from here on, every request is this test's doing
const setMode = (m) => page.evaluate((x) => window.__ghosty.settings.set({ offlineBrain: x }), m);
const setLocal = (ready) => page.evaluate((x) => (window.__ghostyOfflineEngine.ready = x), ready);
const say = async (text) => {
  await page.fill('#cin', text);
  await page.keyboard.press('Enter');
};
const openLog = async () => {
  if (!(await page.locator('.hud.core.logopen').count())) await page.click('#cbar .logbtn, .logbtn');
  await page.waitForSelector('.hud.core.logopen', { timeout: 5000 }).catch(() => problems.push('the conversation did not open'));
};
const closeLog = async () => {
  if (await page.locator('.hud.core.logopen').count()) await page.click('#top .logbtn').catch(() => undefined);
};
const stopLine = /^I can't do this on the phone right now: .+\. Nothing of it left the phone\.$/;
/** The last "kept on this phone" stop in the log: its words, and its ASK THE BIG BRAIN. */
const lastStop = () => page.evaluate(() => {
  const m = [...document.querySelectorAll('.msg.err')].at(-1);
  return { label: m?.querySelector('small')?.textContent ?? '', text: m?.querySelector('span')?.textContent ?? '', ask: !!m?.querySelector('button.bigbrain') };
});
const target44 = (sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length).map((e) => {
  const r = e.getBoundingClientRect();
  const x = r.left + r.width / 2;
  const y = r.top + r.height / 2;
  const hits = [[x, y - 20], [x, y + 20], [x - 20, y], [x + 20, y]].map(([px, py]) => { const t = document.elementFromPoint(px, py); return !!t && (t === e || e.contains(t)); });
  return hits.every(Boolean) ? '' : `${Math.round(r.width)}×${Math.round(r.height)} (${hits.map(Number).join('')})`;
}).filter(Boolean));

// ---- A. "always", no local model: it stops, says why, sends nothing; the cloud only by a tap ---------------------------
await setMode('always');
await setLocal(false);
if (!(await page.locator('#cbar .herebtn').isHidden())) problems.push('[always] ON THIS PHONE shows although every message stays on the phone');
if ((await page.locator('#cin').getAttribute('placeholder')) !== 'Ask on this phone only') problems.push('[always] the field does not say it stays on the phone');
let chats0 = chats();
await say(`My neighbour ${MARK.a} hid the spare key under the blue pot.`);
await openLog();
await page.waitForFunction(() => /I can't do this on the phone right now/.test([...document.querySelectorAll('.msg.err')].at(-1)?.textContent ?? ''), null, { timeout: 30000 }).catch(() => problems.push('[always] the task did not stop with the explanation'));
await pause(3000);
await quiet(); // anything that would follow it (a retry, a fallback, a sync) has had its chance
let s = await lastStop();
if (!stopLine.test(s.text) || !/isn't on this phone yet[\s\S]*DOWNLOAD/.test(s.text)) problems.push(`[always] the explanation reads "${s.text}"`);
if (s.label !== 'KEPT ON THIS PHONE') problems.push(`[always] the stop is labelled "${s.label}"`);
if (!s.ask) problems.push('[always] the cloud is not offered (ASK THE BIG BRAIN)');
if (carrying(MARK.a).length) problems.push(`[always] the marker left the page: ${carrying(MARK.a).map((r) => r.path).join(', ')}`);
if (chats() !== chats0) problems.push(`[always] the brain's chat was asked ${chats() - chats0} time(s) without a tap`);
if (await target44('.msg.err button.bigbrain').then((x) => x.length)) problems.push('[always] ASK THE BIG BRAIN is under 44 pt');
await page.screenshot({ path: `${out}/onphone-stopped.png` });
// the tap, and only the tap, sends it to the brain
chats0 = chats();
await page.locator('.msg.err button.bigbrain').last().click();
await page.waitForFunction((m) => /mock reply to: my neighbour/i.test(document.body.innerText) && document.body.innerText.toLowerCase().includes(m.toLowerCase()), MARK.a, { timeout: 30000 }).catch(() => problems.push('[always] ASK THE BIG BRAIN did not get the brain\'s answer'));
await chatsReach(chats0 + 1);
if (chats() !== chats0 + 1 || !carrying(MARK.a).some((r) => r.path === '/api/chat')) problems.push(`[always] the tap did not send it to the brain once (${chats() - chats0} chat requests)`);

// ---- B. "always" with the local model: answered here, in the phone's voice; never among the brain's recent turns ------
await setLocal(true);
const asked = await page.evaluate(() => window.__ghostyOfflineEngine.calls.length);
await say(`Note that ${MARK.b} is my locker code holder.`);
await page.waitForFunction(() => /Kept between us\./.test([...document.querySelectorAll('.msg.off')].at(-1)?.textContent ?? ''), null, { timeout: 30000 }).catch(() => problems.push('[always + model] no answer from the phone'));
await pause(1500);
await quiet();
if ((await page.evaluate(() => window.__ghostyOfflineEngine.calls.length)) <= asked) problems.push('[always + model] the phone\'s model was not asked');
if (carrying(MARK.b).length) problems.push(`[always + model] the marker left the page: ${carrying(MARK.b).map((r) => r.path).join(', ')}`);
if (!(await page.evaluate(() => window.__spoken.some((t) => /Kept between us/.test(t))))) problems.push('[always + model] the answer was not read out in the phone\'s own voice');
if (sent.some((r) => /\/api\/(tts|speak|voice)/.test(r.path) && r.body.includes('Kept between us'))) problems.push('[always + model] the private answer went to the brain to be spoken');
if (await page.locator('.msg.off').last().locator('.rateb').count()) problems.push('[always + model] the private answer can be rated (a rating sends it to the brain)');
// "only when needed" again: an ordinary message goes to the brain, without the private turn among its recent ones
await setMode('auto');
chats0 = chats();
await say('what day is it today');
await page.waitForFunction(() => document.body.innerText.includes('Mock reply to: what day is it today'), null, { timeout: 30000 }).catch(() => problems.push('[auto] the brain did not answer an ordinary message'));
await chatsReach(chats0 + 1);
if (chats() !== chats0 + 1) problems.push(`[auto] ${chats() - chats0} chat requests for one ordinary message`);
if (carrying(MARK.b).length) problems.push(`[auto] the private turn went to the brain later: ${carrying(MARK.b).map((r) => r.path).join(', ')}`);

// ---- C. ON THIS PHONE for one message, no local model: the same stop, nothing sent; off again after ------------------
await setLocal(false);
await closeLog();
const here = page.locator('#cbar .herebtn');
if (!(await here.isVisible())) problems.push('[switch] no ON THIS PHONE by the microphone');
for (const t of await target44('#cbar .herebtn')) problems.push(`[switch] ON THIS PHONE is under 44 pt: ${t}`);
await here.click();
if ((await here.getAttribute('aria-pressed')) !== 'true' || (await page.locator('#cin').getAttribute('placeholder')) !== 'Ask on this phone only') problems.push('[switch] it does not show that it is on');
await page.locator('#cbar').screenshot({ path: `${out}/onphone-switch.png` });
chats0 = chats();
await say(`Keep this private: ${MARK.c} is my bank's security answer.`);
await openLog();
await page.waitForFunction((m) => [...document.querySelectorAll('.msg')].some((x) => x.textContent.includes(m)) && /I can't do this on the phone right now/.test([...document.querySelectorAll('.msg')].at(-1)?.textContent ?? ''), MARK.c, { timeout: 30000 }).catch(() => problems.push('[switch] the task did not stop with the explanation'));
await pause(3000);
await quiet();
s = await lastStop();
if (!stopLine.test(s.text) || !s.ask) problems.push(`[switch] the stop reads "${s.text}" (offer: ${s.ask})`);
if (carrying(MARK.c).length) problems.push(`[switch] the marker left the page: ${carrying(MARK.c).map((r) => r.path).join(', ')}`);
if (chats() !== chats0) problems.push(`[switch] the brain's chat was asked ${chats() - chats0} time(s) without a tap`);
if ((await here.getAttribute('aria-pressed')) !== 'false' || (await page.locator('#cin').getAttribute('placeholder')) !== 'Talk to me') problems.push('[switch] it stayed on after the message (it is for one message)');
await page.screenshot({ path: `${out}/onphone-switch-stopped.png` });
chats0 = chats();
await say('and what is the weather like');
await page.waitForFunction(() => document.body.innerText.includes('Mock reply to: and what is the weather like'), null, { timeout: 30000 }).catch(() => problems.push('[switch] the next ordinary message did not go to the brain'));
await chatsReach(chats0 + 1);
if (chats() !== chats0 + 1) problems.push(`[switch] ${chats() - chats0} chat requests for the next ordinary message`);
if (carrying(MARK.c).length || carrying(MARK.b).length) problems.push('[switch] a private turn went to the brain with the next message');

// ---- D. ON THIS PHONE with the local model: answered on the phone, nothing sent ---------------------------------------
await setLocal(true);
await closeLog();
await page.locator('#cbar .herebtn').click();
chats0 = chats();
const off = await page.locator('.msg.off').count();
await say(`Between us: ${MARK.d} borrowed my ladder.`);
await page.waitForFunction((n) => document.querySelectorAll('.msg.off').length > n && /Kept between us\./.test([...document.querySelectorAll('.msg.off')].at(-1)?.textContent ?? ''), off, { timeout: 30000 }).catch(() => problems.push('[switch + model] no answer from the phone'));
await pause(1500);
await quiet();
if (carrying(MARK.d).length) problems.push(`[switch + model] the marker left the page: ${carrying(MARK.d).map((r) => r.path).join(', ')}`);
if (chats() !== chats0) problems.push('[switch + model] the brain\'s chat was asked');
// THINK HARDER under that private answer: thought about on the phone, and still private — read in the phone's voice, and
// the next ordinary message to the brain never carries "Think harder: <the private question>"
await openLog();
const think = page.locator('.msg .thinkbtn').last();
if (await think.isVisible().catch(() => false)) {
  await think.click();
  await page.waitForFunction(() => document.querySelectorAll('.msg.think').length > 0 && !document.querySelector('.msg.think .thinkline.live'), null, { timeout: 60000 }).catch(() => problems.push('[think] THINK HARDER did not finish'));
  await quiet();
  if (carrying(MARK.d).length) problems.push('[think] THINK HARDER sent the private question somewhere');
  chats0 = chats();
  await say('and one more ordinary thing');
  await page.waitForFunction(() => document.body.innerText.includes('Mock reply to: and one more ordinary thing'), null, { timeout: 30000 }).catch(() => problems.push('[think] the ordinary message after it got no answer'));
  await chatsReach(chats0 + 1);
  if (carrying(MARK.d).length) problems.push('[think] the private question went to the brain with the next message (as "Think harder: …")');
} else problems.push('[think] no THINK HARDER under the private answer');
// the whole run, once more: the private markers in no request at all; the one sent by a tap only ever to the chat
if (carrying(MARK.b).length + carrying(MARK.c).length + carrying(MARK.d).length) problems.push('a private marker left the page during the run');
if (!carrying(MARK.a).every((r) => r.path === '/api/chat')) problems.push(`the tapped message went somewhere other than the chat: ${carrying(MARK.a).map((r) => r.path).join(', ')}`);
const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
if (wide > 1) problems.push(`the page scrolls sideways (${wide}px)`);
await page.screenshot({ path: `${out}/onphone-answered.png` });

await browser.close();
if (problems.length) {
  console.error(`ON THIS PHONE: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log(`ON THIS PHONE: run clean · ${sent.length} requests watched, none carrying a private marker · screenshots in ${out}`);
