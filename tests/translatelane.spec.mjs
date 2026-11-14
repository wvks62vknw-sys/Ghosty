// TRANSLATE (THE APPS ROUND, the voice lane's flagship), at 440 and 390: the box answers as he types and finds the language, the
// answer with other ways to say it and a formal or casual choice, letters in another script, LISTEN, the star into the phrasebook
// under a trip, a country's ready phrasebook, the history kept on the phone (searched, cleared with an undo), CONVERSATION and
// CAMERA one tap away, opened by words, and every key the target's size with nothing off the side. The brain's translator is
// stubbed: nothing goes out.
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
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

/** The stand-in translator: what each language comes to, with other ways to say it when asked. */
const ANSWERS = {
  es: { text: '¿Dónde está la estación?', alts: ['¿Dónde queda la estación?', '¿La estación, por favor?'] },
  ru: { text: 'Где вокзал?', alts: [] },
  fr: { text: 'Merci.', alts: [] },
};

/** A stand-in recogniser that hears words as they are spoken (`window.__talk(t)`: interim, then final at the end), and a speaker. */
const fakeEars = () => {
  window.__rcs = [];
  window.__said = [];
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    constructor() {
      this.lang = '';
      this.text = '';
      this.over = false;
    }
    start() {
      window.__rcs.push(this);
    }
    stop() {
      setTimeout(() => {
        if (this.text) this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: this.text }], { isFinal: true })] });
        this.over = true;
        this.onend?.();
      }, 10);
    }
    abort() {
      this.over = true;
      this.onend?.();
    }
  };
  window.__talk = (t) => {
    const rc = window.__rcs.at(-1);
    rc.text = t;
    rc.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: false })] });
  };
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 });
    }
  };
  const synth = window.SpeechSynthesis?.prototype ?? window.speechSynthesis;
  synth.getVoices = () => [
    { name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel', localService: true, default: true },
    { name: 'Thomas', lang: 'fr-FR', voiceURI: 'Thomas', localService: true, default: false },
  ];
  synth.speak = (u) => {
    if (u.text.trim()) window.__said.push({ text: u.text, lang: u.lang });
    setTimeout(() => {
      u.onstart?.();
      setTimeout(() => u.onend?.(), 20);
    }, 5);
  };
};

async function phone(viewport, asked, init = null) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  if (init) await ctx.addInitScript(init);
  await ctx.route('**/api/translate', async (route) => {
    const b = route.request().postDataJSON();
    asked.push(b);
    const a = ANSWERS[b.to] ?? { text: `[${b.to}] ${b.text}`, alts: [] };
    const formal = b.style === 'formal' && b.to === 'es' ? '¿Dónde está la estación, por favor?' : a.text;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: formal, from: b.from || 'en', to: b.to, engine: b.alts ? 'model' : 'workers-ai', alts: b.alts ? a.alts : undefined, style: b.style ?? '' }) });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => {
    for (const k of ['ghosty.translate.history', 'ghosty.translate.book', 'ghosty.translate.trip', 'ghosty.translate.pair', 'ghosty.translate.seen']) localStorage.removeItem(k);
  });
  return { ctx, page };
}

const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (check(false, why), false));
const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && !e.closest('[hidden]'); }, sel);
/** Keys under 44 pt, and anything off the side, in the Translate screen now. */
const small = (page) => page.$$eval('#pg-translate button, #pg-translate select, #pg-translate input', (els) => els.filter((e) => e.getClientRects().length && !e.closest('[hidden]')).map((e) => (e.offsetWidth < 44 || e.offsetHeight < 44 ? `${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30)}" ${e.offsetWidth}×${e.offsetHeight}` : null)).filter(Boolean));
const sideways = (page) => page.$$eval('#pg-translate *', (els) => els.filter((e) => { if (!e.getClientRects().length || e.closest('[hidden]')) return false; const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1); }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${e.className} "${(e.textContent ?? '').trim().slice(0, 30)}"`));
const tapKey = (page, label) => page.evaluate((l) => { const b = [...document.querySelectorAll('#pg-translate button')].find((x) => x.getClientRects().length && !x.closest('[hidden]') && x.textContent.trim() === l); b?.click(); return !!b; }, label);

for (const viewport of [PHONE, { width: 390, height: 844 }]) {
  const W = viewport.width;
  const asked = [];
  const { ctx, page } = await phone(viewport, asked);

  // ---- opened by words, at its own screen
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForFunction(() => window.__ghosty?.send, null, { timeout: 8000 }).catch(() => undefined);
  await page.evaluate(() => void window.__ghosty.send('open the translate app'));
  await until(page, () => document.body.dataset.tab === 'translate', null, 10000, `[${W}] [words] "open the translate app" did not open Translate (${await page.evaluate(() => document.body.dataset.tab)})`);
  await until(page, () => document.querySelector('#pg-translate #tlxin'), null, 8000, `[${W}] [screen] the box did not draw`);
  check(await page.evaluate(() => /^Type or paste above/.test(document.querySelector('#pg-translate .tlxstate')?.textContent ?? '')), `[${W}] [empty] the empty state does not say what to do`);
  check(JSON.stringify(await page.$$eval('#pg-translate .tlxseg:not(.tlxstyle) button', (b) => b.map((x) => x.textContent.trim()))) === '["TRANSLATE","PHRASEBOOK","HISTORY"]', `[${W}] [screen] the three views`);
  // ---- the first run: the App Kit's three-step tour, once
  check(await page.evaluate(() => /^1 of 3/.test(document.querySelector('#pg-translate .ak-tour')?.textContent ?? '') && !document.querySelector('#pg-translate .ak-tour').hidden), `[${W}] [tour] the first run's tour does not show step 1 of 3`);
  for (let i = 0; i < 3; i++) await page.click('#pg-translate .ak-tour button');
  check(await page.evaluate(() => document.querySelector('#pg-translate .ak-tour').hidden && localStorage.getItem('ghosty.translate.seen') === 'true'), `[${W}] [tour] GOT IT did not end the tour for good`);

  // ---- answers as he types, finds the language, other ways to say it
  await page.evaluate(() => { const s = document.querySelector('#tlxto'); s.value = 'es'; s.dispatchEvent(new Event('change')); });
  await page.fill('#tlxin', 'Where is the station?');
  await until(page, () => window.__ghosty.translate.state === 'done' && document.querySelector('#tlxout')?.textContent === '¿Dónde está la estación?', null, 8000, `[${W}] [type] no answer as he typed (${await page.evaluate(() => window.__ghosty.translate.state)})`);
  const first = asked.at(-1);
  check(first && first.alts === true && !first.from && first.to === 'es', `[${W}] [type] the ask: ${JSON.stringify(first)}`);
  check(await page.evaluate(() => /^From English \(found it\) · into Spanish$/i.test(document.querySelector('.tlxfound')?.textContent ?? '')), `[${W}] [type] the language found: "${await page.evaluate(() => document.querySelector('.tlxfound')?.textContent)}"`);
  check(JSON.stringify(await page.$$eval('.tlxalt', (b) => b.map((x) => x.textContent))) === JSON.stringify(ANSWERS.es.alts), `[${W}] [alts] other ways: ${JSON.stringify(await page.$$eval('.tlxalt', (b) => b.map((x) => x.textContent)))}`);
  await page.click('.tlxalt >> nth=0');
  check(await page.evaluate(() => document.querySelector('#tlxout')?.textContent === '¿Dónde queda la estación?'), `[${W}] [alts] tapping another way did not make it the answer`);
  check(await page.evaluate(() => [...document.querySelectorAll('.tlxalt')].some((b) => b.textContent === '¿Dónde está la estación?')), `[${W}] [alts] the first answer did not stay among the other ways`);

  // ---- formal
  await tapKey(page, 'FORMAL');
  await until(page, () => document.querySelector('#tlxout')?.textContent === '¿Dónde está la estación, por favor?', null, 8000, `[${W}] [formal] FORMAL did not change the answer`);
  check(asked.at(-1)?.style === 'formal', `[${W}] [formal] the ask did not carry formal: ${JSON.stringify(asked.at(-1))}`);
  check(await page.evaluate(() => document.querySelector('.tlxstyle button[data-style="formal"]')?.getAttribute('aria-checked') === 'true'), `[${W}] [formal] FORMAL not shown chosen`);
  await tapKey(page, 'AS IT IS');

  // ---- listen
  await page.waitForFunction(() => window.__ghosty.translate.state === 'done', null, { timeout: 8000 }).catch(() => undefined);
  await page.click('#pg-translate [data-act="listen"]');
  check(await page.evaluate(() => window.__ghosty.translate.spoken.at(-1)?.lang === 'es'), `[${W}] [listen] LISTEN did not say it in Spanish: ${JSON.stringify(await page.evaluate(() => window.__ghosty.translate.spoken.at(-1)))}`);

  // ---- star into the phrasebook under a trip
  await tapKey(page, 'PHRASEBOOK');
  await page.fill('#tlxtrip', 'Spain in May');
  await page.dispatchEvent('#tlxtrip', 'change');
  await tapKey(page, 'TRANSLATE');
  await page.click('#pg-translate .tlxcard [data-act="star"]');
  check(await page.evaluate(() => window.__ghosty.translate.book.length === 1 && window.__ghosty.translate.book[0].trip === 'Spain in May'), `[${W}] [star] not kept under the trip: ${JSON.stringify(await page.evaluate(() => window.__ghosty.translate.book))}`);
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.translate.book') ?? '[]').length === 1), `[${W}] [star] the phrasebook is not kept on the phone`);
  check(await page.evaluate(() => document.querySelector('#pg-translate .tlxcard [data-act="star"]')?.getAttribute('aria-pressed') === 'true'), `[${W}] [star] the star does not show starred`);
  await tapKey(page, 'PHRASEBOOK');
  check(await page.evaluate(() => /^Spain in May · 1$/.test(document.querySelector('.tlxbook .fxhead')?.textContent ?? '')), `[${W}] [book] the trip's heading: "${await page.evaluate(() => document.querySelector('.tlxbook .fxhead')?.textContent)}"`);
  check(await page.evaluate(() => document.querySelector('.tlxbook .tlxcame')?.textContent?.startsWith('¿Dónde')), `[${W}] [book] the starred line is not listed`);
  for (const s of await small(page)) check(false, `[${W}] [book] a key under 44 pt: ${s}`);
  // (taken out, then put back with the undo)
  await page.click('.tlxbook .tlxstar');
  check(await page.evaluate(() => window.__ghosty.translate.book.length === 0), `[${W}] [book] taking it out did not`);
  await page.click('#undo button, .undo button').catch(() => undefined);
  await until(page, () => window.__ghosty.translate.book.length === 1, null, 4000, `[${W}] [book] the undo did not put it back`);

  // ---- a country's ready phrasebook
  await page.selectOption('#tlxcountry', 'France');
  check(await page.evaluate(() => [...document.querySelectorAll('.tlxready .fxhead')].map((e) => e.textContent).join(',') === 'BASICS,GETTING AROUND,EATING,SHOPPING,HELP'), `[${W}] [country] the phrasebook's groups`);
  await page.click('.tlxready button.tlxline >> nth=1');
  await until(page, () => [...document.querySelectorAll('.tlxready .tlxcame')].some((e) => e.textContent === 'Merci.'), null, 8000, `[${W}] [country] "Thank you." was not put into French`);
  check(asked.some((b) => b.to === 'fr' && b.from === 'en' && b.text === 'Thank you.'), `[${W}] [country] the line was not asked from English into French`);
  await page.click('.tlxready .tlxrow .tlxstar');
  check(await page.evaluate(() => window.__ghosty.translate.book.some((p) => p.trip === 'France' && p.came === 'Merci.')), `[${W}] [country] starring the line did not keep it under France`);
  for (const s of await sideways(page)) check(false, `[${W}] [country] off the side: ${s}`);

  // ---- letters in another script
  await tapKey(page, 'TRANSLATE');
  await page.evaluate(() => { const s = document.querySelector('#tlxto'); s.value = 'ru'; s.dispatchEvent(new Event('change')); });
  await until(page, () => document.querySelector('#tlxout')?.textContent === 'Где вокзал?', null, 8000, `[${W}] [letters] no Russian answer`);
  check(await page.evaluate(() => document.querySelector('[data-act="letters"]')?.textContent === 'IN ENGLISH LETTERS'), `[${W}] [letters] the key: "${await page.evaluate(() => document.querySelector('[data-act="letters"]')?.textContent)}"`);
  await page.click('[data-act="letters"]');
  check(await page.evaluate(() => document.querySelector('.tlxletters')?.textContent === 'Gde vokzal?' && !document.querySelector('.tlxletters').hidden), `[${W}] [letters] in English letters: "${await page.evaluate(() => document.querySelector('.tlxletters')?.textContent)}"`);
  check(!(await page.evaluate(() => document.querySelector('.tlxaltbox').hidden === false)), `[${W}] [letters] an empty OTHER WAYS box shows`);
  for (const s of await small(page)) check(false, `[${W}] [translate] a key under 44 pt: ${s}`);
  for (const s of await sideways(page)) check(false, `[${W}] [translate] off the side: ${s}`);
  await page.screenshot({ path: `${out}/translate-${W}.png` });

  // ---- the history: kept, searched, cleared with an undo
  await tapKey(page, 'HISTORY');
  const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.translate.history') ?? '[]').map((d) => d.to));
  check(hist.includes('es') && hist.includes('ru'), `[${W}] [history] not kept on the phone: ${JSON.stringify(hist)}`);
  await page.fill('#tlxsearch', 'gde');
  await page.fill('#tlxsearch', 'вокзал');
  check(await page.evaluate(() => document.querySelectorAll('#pg-translate .tlxview:not([hidden]) .ak-row').length === 1), `[${W}] [history] the search did not find the one`);
  await page.fill('#tlxsearch', 'zzzz');
  check(await page.evaluate(() => /^No translations match “zzzz”\.$/.test(document.querySelector('#pg-translate .tlxview:not([hidden]) .ak-state p')?.textContent ?? '')), `[${W}] [history] no match is not said`);
  await page.fill('#tlxsearch', '');
  await tapKey(page, 'CLEAR HISTORY');
  check(await page.evaluate(() => window.__ghosty.translate.history.length === 0 && /^No translations yet/.test(document.querySelector('#pg-translate .tlxview:not([hidden]) .ak-state p')?.textContent ?? '')), `[${W}] [history] CLEAR HISTORY did not clear it, or the empty state is not said`);
  await page.click('#undo button, .undo button').catch(() => undefined);
  await until(page, () => window.__ghosty.translate.history.length >= 2, null, 4000, `[${W}] [history] the undo did not bring it back`);
  for (const s of await small(page)) check(false, `[${W}] [history] a key under 44 pt: ${s}`);
  await page.click('#pg-translate .tlxview:not([hidden]) .ak-row .ak-rowmain');
  check(await page.evaluate(() => window.__ghosty.translate.view === 'translate' && document.querySelector('#tlxin').value.length > 0), `[${W}] [history] OPEN did not bring it back into the box`);

  // ---- a failure is said in his words, never raw
  await ctx.route('**/api/translate', (route) => route.abort('internetdisconnected'));
  await page.fill('#tlxin', 'Good morning');
  await until(page, () => window.__ghosty.translate.state === 'failed' || window.__ghosty.translate.state === 'done', null, 10000, `[${W}] [no signal] nothing was said`);
  const said = await page.evaluate(() => document.querySelector('#pg-translate .ak-state.ak-error p')?.textContent ?? document.querySelector('#pg-translate .tlxstate')?.textContent ?? '');
  check(/\.$/.test(said) && !/TypeError|fetch|HTTP|undefined/.test(said), `[${W}] [no signal] the words: "${said}"`);
  check(await page.evaluate(() => window.__ghosty.translate.state !== 'failed' || !!document.querySelector('#pg-translate .ak-state.ak-error button')), `[${W}] [no signal] the error has no TRY AGAIN`);

  // ---- CONVERSATION and CAMERA one tap away
  await tapKey(page, 'CONVERSATION');
  await until(page, () => document.body.dataset.tab === 'interpreter', null, 8000, `[${W}] [modes] CONVERSATION did not open the interpreter`);
  log(`[${W}] translate: ${checks} checks`);
  await ctx.close();

  // ---- INTERPRET's AUTO: no key to hold. It listens for whoever's turn it is, translates at their pause, says it, then listens
  // for the other; holding a key, STOP AUTO or leaving the screen ends it.
  const asked2 = [];
  const two = await phone(viewport, asked2, fakeEars);
  const p2 = two.page;
  await p2.evaluate(() => (location.hash = 'interpreter'));
  await until(p2, () => document.querySelector('#pg-interpreter [data-act="auto"]'), null, 8000, `[${W}] [auto] no AUTO key`);
  await p2.evaluate(() => { const s = document.querySelector('#fxb'); s.value = 'fr'; s.dispatchEvent(new Event('change')); });
  await p2.click('#pg-interpreter [data-act="auto"]');
  await until(p2, () => window.__ghosty.interpreter.auto && window.__ghosty.interpreter.autoSide === 'near' && window.__rcs.at(-1)?.lang === 'en', null, 5000, `[${W}] [auto] AUTO did not start listening for him in English: ${JSON.stringify(await p2.evaluate(() => ({ auto: window.__ghosty.interpreter.auto, side: window.__ghosty.interpreter.autoSide, langs: window.__rcs.map((r) => r.lang) })))}`);
  check(await p2.evaluate(() => document.querySelector('#pg-interpreter [data-act="auto"]').getAttribute('aria-pressed') === 'true' && document.querySelector('#pg-interpreter [data-act="auto"]').textContent === 'STOP AUTO'), `[${W}] [auto] the key does not show AUTO on`);
  await p2.evaluate(() => window.__talk('Thank you'));
  await until(p2, () => window.__ghosty.interpreter.lines.length === 1 && window.__ghosty.interpreter.lines[0].came === 'Merci.', null, 8000, `[${W}] [auto] his pause did not end the turn and translate it: ${JSON.stringify(await p2.evaluate(() => window.__ghosty.interpreter.lines))}`);
  await until(p2, () => window.__said.some((x) => x.text === 'Merci.'), null, 5000, `[${W}] [auto] the French was not said aloud`);
  await until(p2, () => window.__ghosty.interpreter.autoSide === 'far' && window.__rcs.at(-1)?.lang === 'fr' && !window.__rcs.at(-1).over, null, 8000, `[${W}] [auto] it did not then listen for them in French: ${JSON.stringify(await p2.evaluate(() => ({ side: window.__ghosty.interpreter.autoSide, langs: window.__rcs.map((r) => r.lang) })))}`);
  await p2.evaluate(() => window.__talk('Derrière vous'));
  await until(p2, () => window.__ghosty.interpreter.lines.length === 2 && window.__ghosty.interpreter.lines[1].from === 'far', null, 8000, `[${W}] [auto] their turn was not translated`);
  await until(p2, () => window.__ghosty.interpreter.autoSide === 'near', null, 8000, `[${W}] [auto] it did not go back to listening for him`);
  check(asked2.some((b) => b.text === 'Derrière vous' && b.to === 'en' && b.from === 'fr'), `[${W}] [auto] their words were not asked from French into English: ${JSON.stringify(asked2.at(-1))}`);
  await p2.click('#pg-interpreter [data-act="auto"]');
  check(await p2.evaluate(() => !window.__ghosty.interpreter.auto && window.__rcs.at(-1).over && !document.querySelector('#pg-interpreter .fxhalf.hearing')), `[${W}] [auto] STOP AUTO left it listening`);
  for (const s of await p2.$$eval('#pg-interpreter [data-act="auto"]', (els) => els.filter((e) => e.offsetHeight < 44).map((e) => `${e.offsetWidth}×${e.offsetHeight}`))) check(false, `[${W}] [auto] the AUTO key is under 44 pt: ${s}`);
  // (leaving the screen ends it, and nothing of the other person is kept)
  await p2.click('#pg-interpreter [data-act="auto"]');
  await until(p2, () => window.__ghosty.interpreter.auto, null, 4000, `[${W}] [auto] AUTO did not start again`);
  await p2.evaluate(() => (location.hash = 'core'));
  await until(p2, () => !window.__ghosty.interpreter.auto && window.__rcs.at(-1).over && window.__ghosty.interpreter.lines.length === 0, null, 5000, `[${W}] [auto] leaving the screen did not stop AUTO and let the lines go`);
  log(`[${W}] auto: ${checks} checks`);
  await two.ctx.close();
}

await browser.close();
await standDown(base, KEY);
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : `TRANSLATE run clean at 440 × 956 and 390 × 844: ${checks} checks (as he types, other ways, formal, letters, listen, the phrasebook by trip, a country's phrasebook, the history, the modes, and Interpret's AUTO).`);
process.exit(problems.length ? 1 : 0);
