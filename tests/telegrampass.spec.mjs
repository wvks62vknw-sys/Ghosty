// QUALITY PASS: TELEGRAM (BRIEF-QUALITY-TELEGRAM): LINKS → TELEGRAM in every state the brain can report, in words of his, and SYSTEM → KEYS'
// Telegram block, at 440 × 956 and 390 × 844, in the three looks (THE SCAN, GLASS, ONE INK), and at BODY 21. The brain's /api/telegram/*
// answers are stubbed (no Telegram bot exists on a test runner); the words are read from the very file the panel is built from
// (apps/web/src/features/links/words.ts). Checks: the four states and the two between (key saved but not connected, the code run out),
// the code's sentence with its three taps in order, the countdown's "about", the expired line with NEW CODE as a 44 pt key, TEST and
// UNPAIR (its sheet says what stops; its toast says it), a message that did not reach Telegram said once, a failing TEST in his words,
// every control 44 pt, nothing sideways or cut, no developer word, the panel there within two seconds. Stills (440 only), before and
// after a fix pass: TG_STILL=before|after names them tests/.shots/telegrampass-<state>-440-<before|after>.png.
//   BASE=http://localhost:8843 NO_GL_SHOTS=1 node tests/telegrampass.spec.mjs [outDir]
process.env.TZ = 'Europe/London';
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const STILL = process.env.TG_STILL ?? 'after';
const BEFORE = STILL === 'before';
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
const RAW = /webhook|callback|payload|\btoken\b|\bstatus\b|undefined|\[object|TypeError|HTTP \d|fetch failed|Could not send|\bnull\b|\bAPI\b/i;

async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const W = await pure('apps/web/src/features/links/words.ts');
const TG = W?.TELEGRAM;

const NONE = { linked: false, bot: null, paired: false, name: null, token: false };
const SAVED = { linked: false, bot: null, paired: false, name: null, token: true };
const waiting = (min = 14) => ({ linked: true, bot: 'GhostyTestBot', paired: false, name: null, code: '482913', codeUntil: Date.now() + min * 60_000 - 5_000, token: true });
const PAIRED = { linked: true, bot: 'GhostyTestBot', paired: true, name: 'Sam', token: true };
const LOOKS = { scan: { ground: 'graphite', world: 'scan', night: 'graphite' }, glass: { ground: 'graphite', world: 'glass', night: 'graphite' }, ink: { ground: 'warm', world: 'ink', night: 'warm' } };

async function open(viewport, look, body = 0, down = false) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}/${look}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, lk, body }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ...lk, switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, lk: LOOKS[look], body });
  const s = { state: NONE, asked: [], testFails: false, down };
  await page.route('**/api/telegram/**', (route) => {
    const u = new URL(route.request().url());
    s.asked.push(u.pathname);
    const json = (o, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (s.down) return route.abort('failed');
    if (u.pathname.endsWith('/status')) return json(s.state);
    if (u.pathname.endsWith('/test')) return s.testFails ? json({ sent: false, error: "I couldn't reach Telegram just now; check the bot key and try again." }, 502) : json({ sent: true });
    if (u.pathname.endsWith('/unpair')) return json((s.state = { ...waiting(15), code: '770011' }));
    if (u.pathname.endsWith('/code')) return json((s.state = { ...s.state, code: '990022', codeUntil: Date.now() + 15 * 60_000 }));
    return json({ error: 'not found' }, 404);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(1200);
  return { ctx, page, s };
}
const panel = (page) => page.evaluate(() => {
  const p = [...document.querySelectorAll('#pg-links .pn')].find((x) => x.querySelector('h3')?.textContent?.includes('TELEGRAM') && !x.querySelector('h3')?.textContent?.includes('CHANNEL'));
  if (!p) return null;
  const small = [...p.querySelectorAll('button, a.btn, a[href]')].filter((e) => e.getClientRects().length).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.textContent ?? '').trim(), w: Math.round(r.width), h: Math.round(r.height) }; });
  return {
    status: p.querySelector('h3 small')?.textContent ?? '',
    notes: [...p.querySelectorAll('.note')].map((n) => (n.textContent ?? '').replace(/\s+/g, ' ').trim()),
    body: (p.querySelector('.bd')?.innerText ?? '').replace(/\s+/g, ' ').trim(),
    code: p.querySelector('.tgcode')?.textContent ?? '',
    buttons: small,
    cut: [...p.querySelectorAll('*')].filter((e) => e.getClientRects().length && (e.textContent ?? '').trim() && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1) && /hidden|clip/.test(getComputedStyle(e).overflowX + getComputedStyle(e).overflowY)).map((e) => `${e.tagName.toLowerCase()}.${e.className} "${(e.textContent ?? '').trim().slice(0, 24)}"`).slice(0, 3),
    sideways: document.documentElement.scrollWidth > innerWidth + 1,
  };
});
/** Leaving and coming back repaints the panel from the brain's answer; says how long it took to be there. */
async function show(page, tag, want) {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(250);
  const t = Date.now();
  await page.evaluate(() => (location.hash = 'links'));
  const ok = await page.waitForFunction((w) => [...document.querySelectorAll('#pg-links .pn')].some((p) => p.querySelector('h3')?.textContent?.includes('TELEGRAM') && !p.querySelector('h3')?.textContent?.includes('CHANNEL') && (p.querySelector('h3 small')?.textContent ?? '').startsWith(w)), want, { timeout: 8000 }).then(() => true, () => false);
  const ms = Date.now() - t;
  // (the first visit of a phone builds LINKS' panels: it has a second more)
  const first = !page.__seen;
  page.__seen = true;
  check(ok && ms < (first ? 3000 : 2000), `[${tag}] the panel was not "${want}" within ${first ? 'three' : 'two'} seconds (${ok ? `${ms} ms` : 'never'})`);
  // on a phone the panel is a row in LINKS' list: one tap opens it as its own page (ui/listmode.ts)
  if (!(await page.evaluate(() => !!document.querySelector('#pg-links .pn.pushed')))) {
    await page.locator('#pg-links .pn[data-row] > h3', { hasText: 'TELEGRAM' }).filter({ hasNotText: 'CHANNEL' }).first().click().catch(() => undefined);
    await page.waitForTimeout(700);
  }
  return panel(page);
}
const still = async (page, name, vp) => {
  if (vp.width !== 440) return;
  await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn')].find((x) => x.querySelector('h3')?.textContent?.includes('TELEGRAM') && !x.querySelector('h3')?.textContent?.includes('CHANNEL'))?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/telegrampass-${name}-440-${STILL}.png` }).catch(() => undefined);
};
const sound = (t, tag, o = {}) => {
  if (!t) return check(false, `[${tag}] no TELEGRAM panel in LINKS`);
  check(!RAW.test(t.body), `[${tag}] a developer word in the panel: ${t.body.slice(0, 160)}`);
  check(!t.sideways, `[${tag}] the page goes sideways`);
  check(!t.cut.length, `[${tag}] words cut: ${t.cut.join(', ')}`);
  const sm = t.buttons.filter((b) => b.h < 43.5 || b.w < 43.5);
  check(!sm.length, `[${tag}] a control under 44 pt: ${sm.map((b) => `${b.t} ${b.w}×${b.h}`).join(', ')}`);
  if (o.keys) for (const k of o.keys) check(t.buttons.some((b) => b.t === k), `[${tag}] no ${k} key (${t.buttons.map((b) => b.t).join(', ')})`);
};
const sentences = (s) => (s.match(/[.!?](?=\s|$)/g) ?? []).length;

for (const vp of [{ width: 440, height: 956 }, { width: 390, height: 844 }]) {
  const wd = vp.width;
  for (const look of ['scan', 'glass', 'ink']) {
    const tag = (s) => `${wd}/${look}/${s}`;
    const { ctx, page, s } = await open(vp, look);
    const full = look === 'scan';

    // 1. nothing saved yet
    s.state = NONE;
    let t = await show(page, tag('not connected'), 'NOT CONNECTED');
    sound(t, tag('not connected'), { keys: ['SYSTEM → KEYS'] });
    if (full && TG) {
      check(t.notes[0] === TG.noKey, `[${tag('not connected')}] the note reads "${t.notes[0]}"`);
      check(/SYSTEM → KEYS → Telegram bot/.test(t.body) && /voice note/.test(t.body), `[${tag('not connected')}] the note does not point at SYSTEM → KEYS or say what Telegram is for`);
    }
    if (full) await still(page, 'none', vp);
    // 2. the key is saved, the bot is not connected
    if (full) {
      s.state = SAVED;
      t = await show(page, tag('key saved'), 'NOT CONNECTED');
      sound(t, tag('key saved'), { keys: ['SYSTEM → KEYS'] });
      if (TG) check(t.notes[0] === TG.keyNotConnected, `[${tag('key saved')}] the note reads "${t.notes[0]}"`);
    }
    // 3. waiting for the code: three taps in order, "about N minutes", NEW CODE under the thumb
    s.state = waiting(14);
    t = await show(page, tag('waiting'), 'WAITING FOR PAIRING');
    sound(t, tag('waiting'), { keys: ['NEW CODE', 'OPEN THE BOT ↗'] });
    check(t.code === '482913', `[${tag('waiting')}] the code is not shown big (got "${t.code}")`);
    if (TG) {
      check(t.notes[0] === TG.steps('GhostyTestBot') && /tap START, then send it this code/.test(t.notes[0]), `[${tag('waiting')}] the code's sentence reads "${t.notes[0]}"`);
      check(/Open @GhostyTestBot in Telegram, tap START, then send/.test(t.notes[0]) && t.notes[0].indexOf('Open') < t.notes[0].indexOf('START') && t.notes[0].indexOf('START') < t.notes[0].indexOf('send'), `[${tag('waiting')}] the three taps are not in order`);
      check(/^valid for about 1[34] minutes$/.test(t.notes[1] ?? ''), `[${tag('waiting')}] the countdown reads "${t.notes[1]}"`);
    }
    if (full) await still(page, 'waiting', vp);
    // NEW CODE asks the brain and shows the new one
    if (full) {
      await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn button')].find((b) => b.textContent === 'NEW CODE')?.click());
      await page.waitForFunction(() => document.querySelector('#pg-links .tgcode')?.textContent === '990022', null, { timeout: 5000 }).catch(() => check(false, `[${tag('waiting')}] NEW CODE did not show the new code`));
      check(s.asked.some((p) => p.endsWith('/telegram/code')), `[${tag('waiting')}] NEW CODE did not call the brain`);
    }
    // 4. the code has run out: said in words, NEW CODE a 44 pt key
    s.state = { ...waiting(14), code: '111111', codeUntil: Date.now() - 1000 };
    t = await show(page, tag('expired'), 'WAITING FOR PAIRING');
    sound(t, tag('expired'), { keys: ['NEW CODE'] });
    check(t.code !== '111111', `[${tag('expired')}] an expired code is still shown`);
    if (TG) check(t.notes.includes(TG.left(0, false)) && /run out/.test(t.body) && /NEW CODE/.test(t.body), `[${tag('expired')}] the expired line reads "${t.notes.join(' | ')}"`);
    if (full) await still(page, 'expired', vp);
    // 5. paired
    s.state = PAIRED;
    t = await show(page, tag('paired'), 'PAIRED');
    sound(t, tag('paired'), { keys: ['TEST', 'UNPAIR'] });
    check(!t.buttons.some((b) => b.t === 'NEW CODE'), `[${tag('paired')}] paired panel offers NEW CODE`);
    if (TG) check(t.notes.includes(TG.pairedNote) && /PAIRED WITH\s*Sam/i.test(t.body), `[${tag('paired')}] the paired panel reads "${t.body.slice(0, 200)}"`);
    if (full) await still(page, 'paired', vp);
    if (full) {
      // a message that did not reach Telegram: said once, in words, under the panel
      s.state = { ...PAIRED, missed: { at: Date.now() - 60_000, what: 'reminder', n: 1 } };
      t = await show(page, tag('missed'), 'PAIRED');
      sound(t, tag('missed'));
      if (TG && W) check(t.notes.includes(W.missedWords(s.state.missed)) && /didn't reach you on Telegram/.test(t.body) && /in your inbox in the app/.test(t.body), `[${tag('missed')}] the missed line reads "${t.notes.join(' | ')}"`);
      s.state = { ...PAIRED, missed: { at: Date.now() - 60_000, what: 'task', n: 3 } };
      t = await show(page, tag('missed3'), 'PAIRED');
      check(/3 messages did not reach you/.test(t.body), `[${tag('missed3')}] a count of missed messages is not said: ${t.body.slice(0, 200)}`);
      s.state = PAIRED;
      await show(page, tag('paired again'), 'PAIRED');
      // TEST: the toast says it was sent; a failing TEST is in his words, never "Could not send: …"
      await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn button')].find((b) => b.textContent === 'TEST')?.click());
      await page.waitForFunction(() => /Look in your Telegram/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => check(false, `[${tag('test')}] TEST showed no "Sent. Look in your Telegram."`));
      check(s.asked.some((p) => p.endsWith('/telegram/test')), `[${tag('test')}] TEST did not call the brain`);
      await page.waitForTimeout(4200);
      s.testFails = true;
      await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn button')].find((b) => b.textContent === 'TEST')?.click());
      await page.waitForFunction(() => /couldn't reach Telegram/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => check(false, `[${tag('test fails')}] a failing TEST did not say it in his words`));
      const toast = await page.evaluate(() => document.querySelector('#toasts')?.textContent ?? '');
      check(!RAW.test(toast) && !/Could not send/.test(toast), `[${tag('test fails')}] the toast is raw: ${toast}`);
      s.testFails = false;
      await page.waitForTimeout(4200);
      // UNPAIR: the sheet says what stops, one tap, the toast says it, the new code and its three taps follow
      await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn button')].find((b) => b.textContent === 'UNPAIR')?.click());
      await page.waitForSelector('.modal .confirm.sure', { timeout: 5000 }).catch(() => check(false, `[${tag('unpair')}] UNPAIR did not ask first`));
      await page.waitForTimeout(700); // (the sheet's own slide-in is over)
      const sheet = await page.evaluate(() => ({ text: (document.querySelector('.modal')?.textContent ?? '').replace(/\s+/g, ' '), yes: (() => { const b = document.querySelector('.modal .confirm.sure button.sureyes'); const r = b?.getBoundingClientRect(); return { t: b?.textContent ?? '', h: Math.round(r?.height ?? 0), w: Math.round(r?.width ?? 0) }; })() }));
      if (TG) check(sheet.text.includes(TG.unpairTitle) && sheet.text.includes(TG.unpairBody) && /stop answering/.test(sheet.text) && /send nothing more/.test(sheet.text), `[${tag('unpair')}] the sheet reads "${sheet.text}"`);
      check(sheet.yes.t === 'UNPAIR' && sheet.yes.h >= 43.5 && sheet.yes.w >= 43.5, `[${tag('unpair')}] the sheet's key is ${JSON.stringify(sheet.yes)}`);
      await page.locator('.modal .confirm.sure button.sureyes').click({ timeout: 5000 }).catch(() => undefined);
      await page.waitForFunction(() => document.querySelector('#pg-links .tgcode')?.textContent === '770011', null, { timeout: 5000 }).catch(() => check(false, `[${tag('unpair')}] UNPAIR did not show the fresh pairing code`));
      if (TG) check((await page.evaluate(() => document.querySelector('#toasts')?.textContent ?? '')).includes(TG.unpaired), `[${tag('unpair')}] the toast does not say "${TG.unpaired}"`);
      check(s.asked.some((p) => p.endsWith('/telegram/unpair')), `[${tag('unpair')}] UNPAIR did not call the brain`);
      t = await panel(page);
      if (TG) check(t.notes[0] === TG.steps('GhostyTestBot'), `[${tag('unpair')}] after UNPAIR the code's sentence reads "${t.notes[0]}"`);
      await still(page, 'unpaired', vp);
      // paused: not known; offline: the brain is not reachable — each in his words
      s.state = { linked: false, bot: null, paired: false, name: null, unknown: true, token: true };
      t = await show(page, tag('paused'), 'NOT KNOWN WHILE PAUSED');
      sound(t, tag('paused'));
      if (TG) check(t.notes[0] === TG.paused, `[${tag('paused')}] the note reads "${t.notes[0]}"`);
    }
    await ctx.close();
    if (full) {
      // the brain not reachable, on a phone that has never had an answer from it
      const dead = await open(vp, look, 0, true);
      const t = await show(dead.page, tag('offline'), 'OFFLINE');
      sound(t, tag('offline'));
      if (TG) check(t.notes[0] === TG.offline, `[${tag('offline')}] the note reads "${t.notes[0]}"`);
      await dead.ctx.close();
    }
  }

  // the panel at its biggest text (BODY 21): the code's sentence, the expired line and the paired panel cut nothing
  {
    const { ctx, page, s } = await open(vp, 'scan', 21);
    for (const [name, st, want] of [['waiting', waiting(14), 'WAITING FOR PAIRING'], ['expired', { ...waiting(14), code: '111111', codeUntil: Date.now() - 1000 }, 'WAITING FOR PAIRING'], ['paired + missed', { ...PAIRED, missed: { at: Date.now() - 60_000, what: 'task', n: 3 } }, 'PAIRED']]) {
      s.state = st;
      const t = await show(page, `${wd}/BODY 21/${name}`, want);
      sound(t, `${wd}/BODY 21/${name}`);
    }
    await ctx.close();
  }

  // SYSTEM → KEYS: the Telegram block says where the key comes from and that it never leaves the vault, in one sentence
  {
    const { ctx, page } = await open(vp, 'scan');
    await page.evaluate(() => (location.hash = 'system'));
    await page.waitForFunction(() => [...document.querySelectorAll('#pg-system .keyblock .lab')].some((l) => l.textContent === 'Telegram bot'), null, { timeout: 10000 }).catch(() => check(false, `[${wd}/keys] no Telegram bot key in SYSTEM → KEYS`));
    const block = await page.evaluate(() => {
      const b = [...document.querySelectorAll('#pg-system .keyblock')].find((x) => x.querySelector('.lab')?.textContent === 'Telegram bot');
      if (!b) return null;
      b.querySelector('button')?.click(); // HOW TO GET IT
      b.scrollIntoView({ block: 'center' });
      const r = [...b.querySelectorAll('button, a')].filter((e) => e.getClientRects().length).map((e) => { const q = e.getBoundingClientRect(); return `${(e.textContent ?? '').trim().slice(0, 14)} ${Math.round(q.width)}×${Math.round(q.height)}`; });
      return { note: (b.querySelector('.note')?.textContent ?? '').replace(/\s+/g, ' ').trim(), steps: [...b.querySelectorAll('ol.steps li')].map((l) => l.textContent), link: b.querySelector('a.lnk')?.getAttribute('href') ?? '', controls: r, sideways: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    if (!block) check(false, `[${wd}/keys] Telegram key block missing`);
    else {
      check(/@BotFather/.test(block.note) && /never leaves my vault/.test(block.note) && /^Talk to me/.test(block.note) && sentences(block.note) === 1 && !/\btoken\b/i.test(block.note), `[${wd}/keys] the why-line reads "${block.note}"`);
      check(block.steps.length >= 3 && /BotFather/.test(block.steps[0]) && block.steps.every((x) => !/\btoken\b/i.test(x) || /API Token/.test(x)), `[${wd}/keys] the steps read ${block.steps.join(' | ')}`);
      check(/tap START/.test(block.steps.at(-1) ?? ''), `[${wd}/keys] the last step does not say tap START`);
      check(block.link === 'https://t.me/BotFather' && !block.sideways, `[${wd}/keys] link ${block.link} sideways ${block.sideways}`);
      const small = block.controls.filter((c) => { const m = /(\d+)×(\d+)$/.exec(c); return m && (Number(m[2]) < 43.5); });
      check(!small.length, `[${wd}/keys] a control under 44 pt: ${small.join(', ')}`);
    }
    await page.screenshot({ path: `${out}/telegrampass-key-${wd}-${STILL}.png` }).catch(() => undefined);
    await ctx.close();
  }
}
await browser.close();
console.log(`(telegrampass spec: ${((Date.now() - t0) / 1000).toFixed(1)} s, ${checks} checks)`);
if (problems.length) {
  console.log(`TELEGRAM pass: ${problems.length} PROBLEMS of ${checks} checks:\n${problems.map((p) => ` - ${p}`).join('\n')}`);
  process.exit(1);
}
console.log(`TELEGRAM pass run clean: ${checks} checks at 440 × 956 and 390 × 844 (every LINKS → TELEGRAM state, the missed-message line, TEST, UNPAIR, the keys block) in the three looks and at BODY 21.`);
