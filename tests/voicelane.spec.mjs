// THE FINAL ROUND'S VOICE LANE, in the real app at 440 × 956 and 390 × 844, against the preview's own brain:
//  - COLOURS NAMED PLAINLY (his words: "if i say to him red he doesn't change the theme to red because it's named like crimson"):
//    "make it red", "change the colour to blue", "crimson theme" change the colour on the phone with no model, and the reply says
//    what changed; "make it white" asks one short question with both as keys, and a key does what it says; Settings › Theme shows
//    every colour by its plain name;
//  - MANY WORDINGS, ONE MEANING ("if i say play music it should play the radio"): "put some tunes on" is the radio, "log a pint"
//    is a pint of water (his words kept in the chat), "show me the map" opens the map, "play something" asks music or a game, and
//    "is it gonna chuck it down" goes to the brain with the meaning noted beside his words;
//  - HIS OWN WORDINGS (NEXT ROUND, voice.u1): a miss, then his tap to the screen he meant, offers REMEMBER IT / NO; the taught wording
//    opens that screen at once, "my wordings" lists them with FORGET, NO is never asked again, a sending ask is never learned;
//  - HIS VOICE, KNOWN IN THE CHAT ("the actual chat says he has no way of recognising me"): "do you know it's me?" is answered on
//    the phone from what it really knows, and every chat turn carries what the phone knows of voices (`heard`), never a number.
// Every key it shows is 44 pt and nothing goes sideways.
//   BASE=http://localhost:8788 node tests/voicelane.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 260)}`);
  }
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
await standDown(base, KEY);

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

async function phone(viewport) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  return { ctx, page };
}

async function chatOpen(page) {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForFunction(() => document.querySelector('#pg-core #cin'), null, { timeout: 8000 }).catch(() => undefined);
  if (!(await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen')))) await page.click('.logbtn').catch(() => undefined);
  await page.waitForFunction(() => { const i = document.querySelector('#cin'); return i && i.getClientRects().length > 0; }, null, { timeout: 5000 }).catch(() => undefined);
}

/** Say something as he would; wait for a new reply matching `want`; its words, keys and what the chat shows of his own words. */
async function say(page, words, want, why) {
  await chatOpen(page);
  // the replies already there are marked, so only a new one counts (an earlier turn's reply can still be arriving)
  await page.evaluate(() => document.querySelectorAll('#pg-core .msg').forEach((m) => (m.dataset.vlSeen = '1')));
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
  const found = (re) => {
    const m = [...document.querySelectorAll('#pg-core .msg:not(.me):not([data-vl-seen])')].find((x) => new RegExp(re).test(x.querySelector(':scope > span')?.textContent ?? ''));
    return m ? (m.dataset.vlHit = '1') : null;
  };
  const ok = await page.waitForFunction(found, want.source, { timeout: 10000 }).then(() => true, () => false);
  const r = await page.evaluate(() => {
    const m = document.querySelector('#pg-core .msg[data-vl-hit]:not([data-vl-seen])') ?? [...document.querySelectorAll('#pg-core .msg:not(.me):not([data-vl-seen])')].at(-1);
    const me = [...document.querySelectorAll('#pg-core .msg.me:not([data-vl-seen])')].at(-1);
    return { text: m?.querySelector(':scope > span')?.textContent ?? '', keys: [...(m?.querySelectorAll('.localacts button.localgo') ?? [])].map((b) => b.textContent?.trim()), mine: me?.textContent ?? '' };
  });
  check(ok, `${why}: "${words}" was answered "${r.text}" (want ${want})`);
  return r;
}
const tap = (page, label) => page.locator('#pg-core .msg[data-vl-hit]:not([data-vl-seen]) .localacts button.localgo', { hasText: label }).click();
// (the laid-out size: a reply still easing in is drawn a touch smaller for a moment, and its keys are not)
const small = (page) => page.$$eval('#pg-core .msg:not(.me) .localacts button.localgo', (els) => els.filter((e) => e.getClientRects().length).map((e) => {
  const r = { width: e.offsetWidth, height: e.offsetHeight };
  return r.width < 44 || r.height < 44 ? `"${e.textContent?.trim()}" ${Math.round(r.width)}×${Math.round(r.height)}` : null;
}).filter(Boolean));
const sideways = (page) => page.$$eval('#pg-core .msg, #pg-core .localacts button', (els) => els.filter((e) => {
  if (!e.getClientRects().length) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
}).slice(0, 4).map((e) => `${e.className} "${(e.textContent ?? '').trim().slice(0, 30)}"`));
const theme = (page) => page.evaluate(() => document.documentElement.dataset.theme);

for (const viewport of [PHONE, { width: 390, height: 844 }]) {
  const W = viewport.width;
  const { ctx, page } = await phone(viewport);
  const sent = [];
  page.on('request', (r) => {
    if (!r.url().includes('/api/chat') || r.method() !== 'POST') return;
    try {
      sent.push(JSON.parse(r.postData() ?? '{}'));
    } catch {
      /* not JSON */
    }
  });
  const toBrain = (w) => sent.some((b) => String(b.message ?? '').startsWith(w));
  log(`[${W}] up`);

  // ---------------------------------------------------------------- colours named plainly
  await say(page, 'make it red', /^Red now, instead of /, `[${W}] [colours]`);
  check((await theme(page)) === 'crimson', `[${W}] [colours] "make it red" left the theme on ${await theme(page)}`);
  check(!toBrain('make it red'), `[${W}] [colours] "make it red" went to the model`);
  await say(page, 'change the colour to blue', /^Blue now, instead of red\. Only my colour changed\.$/, `[${W}] [colours]`);
  check((await theme(page)) === 'reactor', `[${W}] [colours] "change the colour to blue" left the theme on ${await theme(page)}`);
  await say(page, 'crimson theme', /^Red \(crimson\) now, instead of blue\./, `[${W}] [colours] a fancy name is said back beside the plain one`);
  check((await theme(page)) === 'crimson', `[${W}] [colours] "crimson theme" left the theme on ${await theme(page)}`);
  let r = await say(page, 'make it white', /^White light, or a white page\?$/, `[${W}] [colours] white is a colour and a page both`);
  check(JSON.stringify(r.keys) === '["WHITE LIGHT","WHITE PAGE"]', `[${W}] [colours] the question's keys: ${JSON.stringify(r.keys)}`);
  check((await theme(page)) === 'crimson', `[${W}] [colours] the question changed the colour before he chose`);
  for (const s of await small(page)) check(false, `[${W}] [colours] a key under 44 pt: ${s}`);
  for (const s of await sideways(page)) check(false, `[${W}] [colours] sideways: ${s}`);
  await tap(page, 'WHITE LIGHT');
  check(await page.waitForFunction(() => document.documentElement.dataset.theme === 'mono', null, { timeout: 8000 }).then(() => true, () => false), `[${W}] [colours] WHITE LIGHT left the theme on ${await theme(page)}`);
  await say(page, 'blue', /^Blue now/, `[${W}] [colours] a plain name alone`);
  check((await theme(page)) === 'reactor', `[${W}] [colours] back to blue: ${await theme(page)}`);
  await page.screenshot({ path: `${out}/voicelane-colours-${W}.png` });
  // Settings › Theme: every colour by its plain name
  await page.evaluate(() => (location.hash = 'settings'));
  await page.waitForFunction(() => document.querySelector('#pg-settings'), null, { timeout: 8000 }).catch(() => undefined);
  await openPanel(page, 'settings', 'THEME').catch(() => undefined);
  const names = await page.$$eval('#pg-settings .gg-sw', (bs) => bs.map((b) => b.getAttribute('aria-label')?.replace(/, chosen$/, '')));
  check(names.join(',') === 'Blue,Grey,Orange,Yellow,Red,Purple,Green,Light blue,Pink,Lime,Peach,White', `[${W}] [colours] Settings › Theme names them ${JSON.stringify(names)}`);
  log(`[${W}] colours: ${checks} checks`);

  // ---------------------------------------------------------------- many wordings, one meaning
  await page.evaluate(() => {
    try {
      localStorage.removeItem('ghosty.radio.last');
      localStorage.removeItem('ghosty.radio.favs');
    } catch {
      /* none kept */
    }
  });
  r = await say(page, 'put some tunes on', /^(?:No station yet|Playing |.* needs a tap first)/, `[${W}] [meanings] tunes are the radio`);
  check(r.mine.includes('put some tunes on'), `[${W}] [meanings] his words are what the chat shows: "${r.mine}"`);
  check(!toBrain('put some tunes on'), `[${W}] [meanings] "put some tunes on" went to the model`);
  check(/radio/.test(await page.evaluate(() => location.hash)) || /^Playing /.test(r.text), `[${W}] [meanings] with no station kept, the Radio opened to pick one (${await page.evaluate(() => location.hash)})`);
  r = await say(page, 'log a pint', /water|pint|glass|ml/i, `[${W}] [meanings] a pint is water`);
  check(r.mine.includes('log a pint'), `[${W}] [meanings] the chat shows what he said, not the table's words: "${r.mine}"`);
  check(!toBrain('log a pint') && !toBrain('I drank'), `[${W}] [meanings] "log a pint" went to the model`);
  r = await say(page, 'play something', /^Music, or a game\?$/, `[${W}] [meanings] two meanings ask`);
  check(JSON.stringify(r.keys) === '["MUSIC","A GAME"]', `[${W}] [meanings] the keys: ${JSON.stringify(r.keys)}`);
  for (const s of await small(page)) check(false, `[${W}] [meanings] a key under 44 pt: ${s}`);
  await tap(page, 'A GAME');
  check(await page.waitForFunction(() => /arcade/.test(location.hash), null, { timeout: 8000 }).then(() => true, () => false), `[${W}] [meanings] A GAME did not open the arcade (${await page.evaluate(() => location.hash)})`);
  await say(page, 'show me the map', /^Opening the map\.$/, `[${W}] [meanings] the map`);
  check(await page.waitForFunction(() => /eye/.test(location.hash), null, { timeout: 8000 }).then(() => true, () => false), `[${W}] [meanings] the map did not open (${await page.evaluate(() => location.hash)})`);
  check((await theme(page)) === 'reactor', `[${W}] [meanings] "show me the map" changed the look`);
  // an ask only the brain can answer: his words, with the meaning noted
  await chatOpen(page);
  await page.fill('#cin', 'is it gonna chuck it down');
  await page.press('#cin', 'Enter');
  const deadline = Date.now() + 8000;
  while (!toBrain('is it gonna chuck it down') && Date.now() < deadline) await page.waitForTimeout(100);
  const weather = sent.find((b) => String(b.message ?? '').startsWith('is it gonna chuck it down'));
  check(!!weather && String(weather.message).includes("(The phone read this as: what's the weather.)"), `[${W}] [meanings] the brain was sent ${JSON.stringify(weather?.message ?? null)}`);
  await page.waitForFunction(() => !window.__ghosty.ui.get().busy, null, { timeout: 15000 }).catch(() => undefined);
  log(`[${W}] meanings: ${checks} checks`);

  // ---------------------------------------------------------------- his voice, known in the chat
  r = await say(page, 'do you know it’s me?', /^(?:I don’t know your voice yet\.|You typed that, so I heard no voice\.)/, `[${W}] [voice] answered from what the phone knows`);
  check(!toBrain('do you know it'), `[${W}] [voice] "do you know it’s me?" went to the model`);
  check(!/no way|can.t recognise/i.test(r.text), `[${W}] [voice] it denied it: "${r.text}"`);
  const note = await page.evaluate(() => window.__ghosty.voiceknown.heardNote());
  check(note && typeof note.taught === 'boolean', `[${W}] [voice] what the phone knows of voices: ${JSON.stringify(note)}`);
  // every chat turn carries it, and a typed one carries no voice label
  check(!!weather?.context?.heard && typeof weather.context.heard.taught === 'boolean', `[${W}] [voice] the turn's context carried ${JSON.stringify(weather?.context?.heard ?? null)}`);
  check(weather?.context?.voice === undefined, `[${W}] [voice] a typed turn carried a voice label: ${JSON.stringify(weather?.context?.voice)}`);
  for (const s of await small(page)) check(false, `[${W}] [voice] a key under 44 pt: ${s}`);
  for (const s of await sideways(page)) check(false, `[${W}] [voice] sideways: ${s}`);
  await page.screenshot({ path: `${out}/voicelane-voice-${W}.png` });
  log(`[${W}] voice: ${checks} checks`);

  // ---------------------------------------------------------------- his own wordings, learned (NEXT ROUND, voice.u1)
  const miss = async (words, tab) => {
    await chatOpen(page);
    const n = sent.length;
    await page.fill('#cin', words);
    await page.press('#cin', 'Enter');
    const until = Date.now() + 8000;
    while (!sent.slice(n).some((b) => String(b.message ?? '').startsWith(words)) && Date.now() < until) await page.waitForTimeout(100);
    check(sent.slice(n).some((b) => String(b.message ?? '').startsWith(words)), `[${W}] [learn] "${words}" did not go to the brain (a miss)`);
    await page.waitForFunction(() => !window.__ghosty.ui.get().busy, null, { timeout: 15000 }).catch(() => undefined);
    // his own tap to the screen he meant (not the brain opening it)
    await page.evaluate((t) => (location.hash = t), tab);
  };
  const barShown = () => page.waitForFunction(() => { const b = document.querySelector('#wordbar'); return b && !b.hidden && b.getClientRects().length > 0; }, null, { timeout: 5000 }).then(() => true, () => false);
  await miss('wonga page', 'money');
  check(await barShown(), `[${W}] [learn] no offer after a miss and his tap to Money`);
  const bar = await page.evaluate(() => ({ text: document.querySelector('#wordbar span')?.textContent ?? '', keys: [...document.querySelectorAll('#wordbar button')].map((b) => ({ t: b.textContent, w: b.offsetWidth, h: b.offsetHeight, l: b.getBoundingClientRect().left, r: b.getBoundingClientRect().right })) }));
  check(bar.text === 'Next time you say “wonga page”, open Money?', `[${W}] [learn] the offer reads "${bar.text}"`);
  check(JSON.stringify(bar.keys.map((k) => k.t)) === '["REMEMBER IT","NO"]', `[${W}] [learn] the offer's keys: ${JSON.stringify(bar.keys.map((k) => k.t))}`);
  for (const k of bar.keys) {
    check(k.w >= 44 && k.h >= 44, `[${W}] [learn] "${k.t}" is ${k.w}×${k.h} (under 44 pt)`);
    check(k.l >= -1 && k.r <= W + 1, `[${W}] [learn] "${k.t}" is sideways`);
  }
  await page.screenshot({ path: `${out}/voicelane-learn-${W}.png` });
  await page.click('#wordbar button:has-text("REMEMBER IT")');
  check(await page.evaluate(() => window.__ghosty.learnwords.learned().some((l) => l.words === 'wonga page' && l.tab === 'money')), `[${W}] [learn] REMEMBER IT kept nothing: ${JSON.stringify(await page.evaluate(() => window.__ghosty.learnwords.learned()))}`);
  check(await page.evaluate(() => document.querySelector('#wordbar')?.hidden === true), `[${W}] [learn] the bar stayed after REMEMBER IT`);
  r = await say(page, 'wonga page', /^Opening Money: you taught me “wonga page”\.$/, `[${W}] [learn] the taught wording`);
  check(await page.waitForFunction(() => /money/.test(location.hash), null, { timeout: 8000 }).then(() => true, () => false), `[${W}] [learn] the taught wording did not open Money (${await page.evaluate(() => location.hash)})`);
  check(!toBrain('wonga page') || sent.filter((b) => String(b.message ?? '').startsWith('wonga page')).length === 1, `[${W}] [learn] once taught, it still went to the brain`);
  r = await say(page, 'my wordings', /^Your own wordings \(1\):\n“wonga page” opens Money$/, `[${W}] [learn] the list`);
  check(JSON.stringify(r.keys) === '["FORGET “wonga page”"]', `[${W}] [learn] the list's keys: ${JSON.stringify(r.keys)}`);
  for (const s of await small(page)) check(false, `[${W}] [learn] a key under 44 pt: ${s}`);
  await tap(page, 'FORGET');
  check(await page.waitForFunction(() => window.__ghosty.learnwords.learned().length === 0, null, { timeout: 5000 }).then(() => true, () => false), `[${W}] [learn] FORGET left ${JSON.stringify(await page.evaluate(() => window.__ghosty.learnwords.learned()))}`);
  await say(page, 'my wordings', /^I haven’t learned any of your own wordings yet\./, `[${W}] [learn] the empty list says how`);
  // NO is remembered: the same words are never offered again
  await miss('dosh corner', 'markets');
  check(await barShown(), `[${W}] [learn] no offer for "dosh corner"`);
  await page.click('#wordbar button:has-text("NO")');
  await miss('dosh corner', 'money');
  check(!(await barShown()), `[${W}] [learn] "dosh corner" was offered again after NO`);
  // a sending ask is never offered as a screen's name
  await miss('send the dosh to Sam', 'money');
  check(!(await barShown()), `[${W}] [learn] a sending ask was offered as a wording`);
  log(`[${W}] learn: ${checks} checks`);
  await ctx.close();
}

await browser.close();
await standDown(base, KEY);
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `VOICE LANE run clean at 440 × 956 and 390 × 844: ${checks} checks (colours by plain names, many wordings to one meaning, his voice known in the chat).`);
process.exit(problems.length ? 1 : 0);
