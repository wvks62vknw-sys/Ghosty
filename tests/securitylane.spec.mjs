// THE SECURITY LANE (NEXT ROUND, 14 Nov; docs/build-plan/NEXT-SECURITY.md): "Safe, private and in your hands".
// SETTINGS → SECURITY, one screen with every lock as a green, amber or red line, every approval listed, and the STEPS for the
// fixes that live in his Cloudflare account. Checked on the owner's 440 × 956 and a 390 × 844 phone:
//   a. THE ROW: Settings has a SECURITY row under Ghosty; one tap opens the screen, ‹ Settings goes back;
//   b. THE LOCKS: nine lines, each green, amber or red with a word (OK, LOOK, FIX), the brain's facts filled in from GET /api/security,
//      the count at the top; an amber line with a guide opens STEPS at that guide;
//   c. THE APPROVALS: the list in his words (what, after which page, from where, when), and the empty state;
//   d. THE STEPS: four guides; MAKE ONE makes a key in the form it needs (shown once); DONE turns PUBLIC DOORS green;
//   e. OFFLINE: the brain unreachable, the phone's own locks still show and the brain's say they can't be checked;
//   f. THE BAR: every key 44 pt, nothing sideways, no word cut, at both sizes, at BODY 21 and in all seven looks.
//   BASE=http://localhost:8788 node tests/securitylane.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const WORLDS = ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass'];
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 280)}`);
  }
  return ok;
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const RAW = /aborted|fetch failed|undefined|NaN|\[object Object\]|TypeError|NetworkError|Failed to|HTTP \d|SyntaxError|ReferenceError/i;
await standDown(base, KEY);

const live = [];
async function section(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(false, `[${name}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 220)}`);
    for (const c of live.splice(0)) await c.close().catch(() => undefined);
  }
}

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const NOW = Date.now();
const APPROVALS = [
  { tool: 'send_email', what: 'Send an email to Sam about Friday', allow: true, from: 'telegram', at: NOW - 2 * 3_600_000 },
  { tool: 'post_social', what: 'Post on Bluesky', allow: false, from: 'phone', at: NOW - 3_600_000, after: 'https://shop.example/deal' },
];

/** One phone. `world`: the look; `body`: the text size; `security`: a stand-in answer for GET /api/security ('fail' refuses it). */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  live.push(ctx);
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  if (o.security === 'fail') await ctx.route(/\/api\/security$/, (route) => route.abort('internetdisconnected'));
  else if (o.security) await ctx.route(/\/api\/security$/, (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o.security) }));
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base }).catch(() => undefined);
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world, last }) => {
    if (sessionStorage.getItem('sl.seeded')) return;
    sessionStorage.setItem('sl.seeded', '1');
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    localStorage.removeItem('ghosty.security.doorsRule');
    window.__ghostyHero = true;
  }, { key: KEY, body: o.body ?? 0, world: o.world ?? 'scan' });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const go = async (page, id) => {
  await page.evaluate((i) => (location.hash = i), id);
  await page.waitForSelector(`#pg-${id}`, { state: 'attached', timeout: 30000 });
};
/** The screen with the brain's answer in (or its refusal said). */
const openSecurity = async (page) => {
  await go(page, 'security');
  await page.waitForSelector('#pg-security .seclocks .rw[data-lock]', { timeout: 15000 });
  return until(page, () => (window.__ghosty?.security?.at ?? 0) > 0, null, 15000);
};
const locks = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-security .seclocks .rw[data-lock]')].map((r) => ({ id: r.dataset.lock, level: r.dataset.level, word: r.querySelector('.n')?.textContent ?? '', line: r.querySelector('.v')?.textContent ?? '' })));
/** Every key in `root` at 44 pt, nothing sideways on the page, no word cut inside `root`, no raw string. */
async function bar(page, tag, root) {
  // the panels' entrance has finished (a key measured mid-animation reads a point short)
  await until(page, (r) => !document.getAnimations().some((a) => a.playState === 'running' && a.effect?.target instanceof Element && a.effect.target.closest(r)), root, 5000);
  const r = await page.evaluate((root) => {
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
    const els = [...document.querySelectorAll(root)];
    const all = els.flatMap((x) => [x, ...x.querySelectorAll('*')]).filter(vis);
    const small = all.filter((e) => e.matches('button, input:not([type=hidden]):not([type=file]):not([type=range]), select, textarea, [role=button]')).map((e) => {
      const b = e.getBoundingClientRect();
      return b.width >= 43.5 && b.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(b.width)}×${Math.round(b.height)}`;
    }).filter(Boolean);
    const sideways = document.documentElement.scrollWidth > innerWidth + 1 || all.some((e) => {
      for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX) && p.id !== 'pg-security') return false;
      const b = e.getBoundingClientRect();
      return b.width > 0 && (b.left < -1 || b.right > innerWidth + 1);
    });
    const cs = (e) => getComputedStyle(e);
    // cut sideways, or clipped to a few lines (a line clamp ends in "…")
    const cut = all.filter((e) => !e.matches('input, select, textarea') && e.textContent.trim() && ((e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(cs(e).overflowX)) || (cs(e).webkitLineClamp !== 'none' && cs(e).webkitLineClamp && e.scrollHeight > e.clientHeight + 1))).map((e) => e.textContent.trim().slice(0, 30));
    return { small: small.slice(0, 6), sideways, cut: cut.slice(0, 4), words: els.map((x) => x.innerText).join(' ') };
  }, root);
  check(!r.small.length, `${tag}: under 44 pt: ${r.small.join(', ')}`);
  check(!r.sideways, `${tag}: sideways`);
  check(!r.cut.length, `${tag}: words cut: ${r.cut.join(' | ')}`);
  check(!RAW.test(r.words), `${tag}: a raw string: ${(RAW.exec(r.words) ?? [''])[0]}`);
}
const showSteps = async (page) => {
  // (stacked, both sides show and the swap key is not drawn: the steps are already there to scroll to)
  const shown = () => page.evaluate(() => !!document.querySelector('#pg-security .secsteps .secguide')?.getClientRects().length && getComputedStyle(document.querySelector('#pg-security .secsteps')).visibility !== 'hidden');
  if (!(await shown()) && !(await page.locator('#pg-security .hud.alt').count())) await page.locator('#pg-security .hero .swap').click();
  await page.waitForSelector('#pg-security .secsteps .secguide', { state: 'visible', timeout: 5000 });
};

// ================================================================ a–d · the row, the locks, the approvals, the steps
for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;
  await section(`screen ${vp.width}`, async () => {
    log(`screen ${vp.width}`);
    const { ctx, page } = await phone(vp, { world: 'glass' });
    // a. the row under Ghosty (Glass draws the list), one tap away
    await go(page, 'settings');
    const row = page.locator('#pg-settings .pn[data-go="security"]');
    await row.waitFor({ state: 'attached', timeout: 15000 });
    check(/security/i.test((await row.locator('.ptitle').textContent()) ?? ''), `${T} the Settings row is not called Security`);
    check(/every lock/i.test((await row.locator('h3 small').textContent()) ?? ''), `${T} the Settings row does not say what it holds`);
    await page.evaluate(() => document.querySelector('#pg-settings .pn[data-go="security"]')?.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true })));
    await row.locator(':scope > h3').click();
    check(await until(page, () => location.hash.replace('#', '') === 'security', null, 10000), `${T} one tap on the row did not open Security (${await page.evaluate(() => location.hash)})`);
    check(await until(page, () => (window.__ghosty?.security?.at ?? 0) > 0, null, 15000), `${T} the brain's facts never filled in`);
    // b. nine locks, each with a level and its word
    const L = await locks(page);
    check(L.map((l) => l.id).join() === 'signin,backup,vault,faces,telegram,previews,demo,doors,approvals', `${T} the locks are ${L.map((l) => l.id).join()}`);
    const WORD = { green: 'OK', amber: 'LOOK', red: 'FIX' };
    check(L.every((l) => WORD[l.level] === l.word && l.line.length > 10), `${T} a lock without its level word: ${JSON.stringify(L.find((l) => WORD[l.level] !== l.word))}`);
    const sec = await page.evaluate(() => window.__ghosty.security.brain);
    check(sec && typeof sec.vaultKey === 'boolean' && typeof sec.demoOpen === 'boolean', `${T} the brain's locks did not come from GET /api/security: ${JSON.stringify(sec)}`);
    check(L.find((l) => l.id === 'signin')?.level === 'amber' && /28 characters/.test(L.find((l) => l.id === 'signin')?.line ?? ''), `${T} a 28-character owner key is not amber with its length said: ${JSON.stringify(L[0])}`);
    check(L.find((l) => l.id === 'doors')?.level === 'amber', `${T} PUBLIC DOORS is not amber before the rule is marked done`);
    const big = (await page.locator('#pg-security .hero .bigv').textContent()) ?? '';
    check(big === `${L.filter((l) => l.level === 'green').length}/9`, `${T} the count at the top says "${big}"`);
    // the empty approvals state (the preview brain has none)
    const empty = (await page.locator('#pg-security .secapprovals .bd').textContent()) ?? '';
    check(/Nothing has asked for your APPROVE yet/.test(empty) || /Approved|Turned down/.test(empty), `${T} the approvals panel says "${empty.slice(0, 80)}"`);
    await bar(page, `${T} [locks]`, '#pg-security');
    if (vp === PHONE) await page.screenshot({ path: `${out}/securitylane-locks-${vp.width}.png` }).catch(() => undefined);
    // an amber lock with a guide opens STEPS at it
    await page.locator('#pg-security .seclocks .rw[data-lock="doors"]').click();
    check(await until(page, () => !!document.querySelector('#pg-security .hud.alt') && !!document.querySelector('#pg-security .secguide[data-guide="doors"]')?.getClientRects().length, null, 5000), `${T} tapping PUBLIC DOORS did not open its steps`);
    // d. the steps
    await showSteps(page);
    const guides = await page.evaluate(() => [...document.querySelectorAll('#pg-security .secguide')].map((g) => g.dataset.guide));
    check(guides.join() === 'doors,previews,vault,ownerkey', `${T} the guides are ${guides.join()}`);
    await page.locator('#pg-security .secguide[data-guide="vault"] button', { hasText: 'MAKE ONE' }).click();
    const vk = (await page.locator('#pg-security .secguide[data-guide="vault"] .secmade').textContent()) ?? '';
    check(Buffer.from(vk, 'base64').length === 32 && /^[A-Za-z0-9+/]+=*$/.test(vk), `${T} MAKE ONE made "${vk}" for VAULT_KEY (want 32 random bytes in base64)`);
    await page.locator('#pg-security .secguide[data-guide="ownerkey"] button', { hasText: 'MAKE ONE' }).click();
    const ok = (await page.locator('#pg-security .secguide[data-guide="ownerkey"] .secmade').textContent()) ?? '';
    check(/^[A-Za-z0-9]{40}$/.test(ok), `${T} MAKE ONE made "${ok}" for the owner key`);
    await page.locator('#pg-security .secguide[data-guide="doors"] button', { hasText: 'DONE' }).click();
    check(await until(page, () => document.querySelector('#pg-security .rw[data-lock="doors"]')?.dataset.level === 'green', null, 5000), `${T} DONE did not turn PUBLIC DOORS green`);
    check(await page.evaluate(() => localStorage.getItem('ghosty.security.doorsRule') === '1'), `${T} DONE is not kept on the phone`);
    await bar(page, `${T} [steps]`, '#pg-security');
    if (vp === PHONE) await page.screenshot({ path: `${out}/securitylane-steps-${vp.width}.png` }).catch(() => undefined);
    // back to Settings
    const back = await page.evaluate(() => (document.querySelector('#top .back, .backkey, [data-back]')?.textContent ?? '').trim());
    check(!back || /settings/i.test(back), `${T} the way back says "${back}"`);
    await ctx.close();
  });
}

// c. the approvals list, from a stand-in answer
await section('approvals', async () => {
  log('approvals');
  const { ctx, page } = await phone(PHONE, { security: { locks: { vaultKey: false, demoOpen: true, previews: 'x-ghosty.me.workers.dev', access: false, keyByHash: true }, approvals: APPROVALS } });
  await openSecurity(page);
  const lines = await page.evaluate(() => [...document.querySelectorAll('#pg-security .secapprovals .secapproval')].map((r) => r.textContent.replace(/\s+/g, ' ')));
  check(lines.length === 2, `[approvals] ${lines.length} lines shown`);
  check(/Approved · Send an email to Sam about Friday · from Telegram · 2 hours ago/.test(lines[0] ?? ''), `[approvals] the first line says "${lines[0]}"`);
  check(/Turned down · Post on Bluesky · after reading https:\/\/shop\.example\/deal · from the phone/.test(lines[1] ?? ''), `[approvals] the second line says "${lines[1]}"`);
  const L = await locks(page);
  for (const id of ['vault', 'previews', 'demo']) check(L.find((l) => l.id === id)?.level === 'amber', `[approvals] ${id} is not amber when the brain says so`);
  check(/1 approved, 1 turned down/.test(L.find((l) => l.id === 'approvals')?.line ?? ''), `[approvals] the week's count says "${L.find((l) => l.id === 'approvals')?.line}"`);
  check(await page.locator('#pg-security .secapprovals button', { hasText: 'CLEAR LIST' }).count() === 1, '[approvals] no CLEAR LIST key');
  await bar(page, '[approvals]', '#pg-security');
  await ctx.close();
});

// h. has this password leaked: only five characters of the fingerprint go out (SHA-1 of "password" starts 5BAA6)
await section('leaked', async () => {
  log('leaked');
  const { ctx, page } = await phone(PHONE);
  const asked = [];
  await ctx.route(/\/api\/security\/pwned\//, (route) => {
    asked.push(route.request().url());
    route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ list: '1E4C9B93F3F0682250B6CF8331B7EE68FD8:9545824\n0018A45C4D1DEF81644B54AB7F969B88D65:0' }) });
  });
  await openSecurity(page);
  await showSteps(page);
  const box = page.locator('#pg-security .secpwned input[type=password]');
  await box.fill('password');
  await page.locator('#pg-security .secpwned button', { hasText: 'CHECK' }).click();
  check(await until(page, () => /9,545,824 times/.test(document.querySelector('#pg-security .secpwnedsaid')?.textContent ?? ''), null, 8000), `[leaked] the answer says "${await page.locator('#pg-security .secpwnedsaid').textContent()}"`);
  check(asked.length === 1 && /\/api\/security\/pwned\/5BAA6$/.test(asked[0]), `[leaked] what left the phone: ${asked.join(', ')}`);
  check((await box.inputValue()) === '', '[leaked] the box still holds the password after the check');
  await box.fill('a long random one nobody has 8c1f');
  await box.press('Enter');
  check(await until(page, () => /^Not in the public list/.test(document.querySelector('#pg-security .secpwnedsaid')?.textContent ?? ''), null, 8000), `[leaked] a password not in the list says "${await page.locator('#pg-security .secpwnedsaid').textContent()}"`);
  await bar(page, '[leaked]', '#pg-security');
  await ctx.close();
});

// i. a few seconds to take it back: APPROVE on a post counts down; TAKE IT BACK sends nothing and the card asks again
await section('takeback', async () => {
  log('take it back');
  const { ctx, page } = await phone(PHONE);
  const approves = [];
  await ctx.route(/\/api\/history/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ turns: [], pending: { id: 'tb1', name: 'social', args: { action: 'post', text: 'Hello from me' } } }) }));
  await ctx.route(/\/api\/approve$/, (r) => {
    approves.push(r.request().postData());
    r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: `${JSON.stringify({ t: 'done', model: 'test' })}\n` });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.click('.logbtn').catch(() => undefined);
  const card = await page.waitForSelector('.log .approval button.apkey', { timeout: 15000 }).then(() => true, () => false);
  check(card, '[takeback] no approval card');
  if (card) {
    await page.click('.log .approval button.apkey >> nth=0');
    const words = (await page.locator('.log .approval .aptakeback').textContent().catch(() => '')) ?? '';
    check(/^Approved\. It leaves in [1-4] seconds?: TAKE IT BACK stops it\.$/.test(words), `[takeback] the countdown says "${words}"`);
    await page.locator('.log .approval button.apback').click();
    check(await until(page, () => !!document.querySelector('.log .approval[data-state="waiting"] button.apkey') && !document.querySelector('.log .approval .apback'), null, 3000), '[takeback] TAKE IT BACK did not bring the card back');
    await page.waitForTimeout(4600); // (the length of the countdown: proving nothing leaves after it, a fixed wait is the condition)
    check(approves.length === 0, `[takeback] something left after TAKE IT BACK: ${approves.join(', ')}`);
    await page.click('.log .approval button.apkey >> nth=0');
    check(await until(page, () => !!document.querySelector('.log .approval:not([data-state="waiting"])'), null, 12000), '[takeback] APPROVE untouched never answered');
    check(approves.length === 1 && /"allow":true/.test(approves[0] ?? ''), `[takeback] what was sent: ${approves.join(', ')}`);
  }
  await ctx.close();
});

// j. one tap to lock everything: the confirm, the locked state, a wrong key keeps it locked, his key unlocks it; and "lock everything" said
await section('lock', async () => {
  log('lock everything');
  const { ctx, page } = await phone(PHONE);
  const sent = [];
  await ctx.route(/\/api\/security\/(lock|unlock)$/, (r) => {
    sent.push(new URL(r.request().url()).pathname.split('/').pop());
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sent.at(-1) === 'lock' ? { locked: true, at: Date.now(), telegram: false } : { locked: false }) });
  });
  await openSecurity(page);
  check(/Open/i.test((await page.locator('#pg-security .seclockdown h3 small').textContent()) ?? ''), '[lock] the panel does not say it is open');
  await page.locator('#pg-security .seclockdown button', { hasText: 'LOCK EVERYTHING' }).click();
  await page.locator('.confirm.sure button', { hasText: /^LOCK$/ }).click();
  check(await until(page, () => document.querySelector('#pg-security .seclockdown')?.dataset.locked === '1', null, 5000), '[lock] LOCK did not show the locked state');
  check(sent.join() === 'lock', `[lock] asked the brain: ${sent.join()}`);
  check(/Locked since .*Telegram unpaired, and nothing that publishes/.test((await page.locator('#pg-security .seclockdown .bd').textContent()) ?? ''), '[lock] the locked panel does not say what is locked');
  const keyBox = page.locator('#pg-security .seclockdown input[type=password]');
  await keyBox.fill('not-my-key-at-all-0000000000');
  await page.locator('#pg-security .seclockdown button', { hasText: 'UNLOCK' }).click();
  check(sent.join() === 'lock' && (await page.locator('#pg-security .seclockdown').getAttribute('data-locked')) === '1', '[lock] a wrong key unlocked it');
  await keyBox.fill(KEY);
  await page.locator('#pg-security .seclockdown button', { hasText: 'UNLOCK' }).click();
  check(await until(page, () => !document.querySelector('#pg-security .seclockdown')?.dataset.locked, null, 5000) && sent.join() === 'lock,unlock', `[lock] his key did not unlock it (${sent.join()})`);
  await bar(page, '[lock]', '#pg-security');
  // said in the chat: the confirm opens, the lock is still his tap
  await go(page, 'core');
  await page.click('.logbtn').catch(() => undefined);
  await page.fill('#cin', 'lock everything');
  await page.keyboard.press('Enter');
  check(await until(page, () => location.hash.startsWith('#security') && !!document.querySelector('.confirm.sure'), null, 10000), '[lock] "lock everything" did not open the lock\'s confirm on Security');
  check(sent.join() === 'lock,unlock', '[lock] saying it locked without his tap');
  await page.locator('.confirm.sure button', { hasText: 'KEEP IT' }).click().catch(() => undefined);
  await ctx.close();
});

// k. check a link: pasted, checked from public records (a stand-in answer), said in his words; nothing opened
await section('link', async () => {
  log('check a link');
  const { ctx, page } = await phone(PHONE2);
  const asked = [];
  await ctx.route(/\/api\/security\/linkcheck$/, (r) => {
    asked.push(r.request().postData());
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ verdict: 'scam', words: 'This looks like a scam.\n• The address imitates Royal Mail, but it is not Royal Mail’s.', links: ['https://royalmaii-parcel.example/'] }) });
  });
  await openSecurity(page);
  await showSteps(page);
  await page.locator('#pg-security .seclinkcheck input').fill('Your parcel is waiting: https://royalmaii-parcel.example/pay');
  await page.locator('#pg-security .seclinkcheck button', { hasText: 'CHECK' }).click();
  check(await until(page, () => /imitates Royal Mail/.test(document.querySelector('#pg-security .seclinksaid')?.textContent ?? ''), null, 8000), `[link] the answer says "${await page.locator('#pg-security .seclinksaid').textContent()}"`);
  check(asked.length === 1 && /royalmaii-parcel\.example/.test(asked[0] ?? ''), `[link] what was asked: ${asked.join(', ')}`);
  check(/scam/i.test((await page.locator('#pg-security .seclinkcheck h3 small').textContent()) ?? ''), '[link] the panel does not say it looks like a scam');
  await bar(page, '[link]', '#pg-security');
  await ctx.close();
});

// e. offline: the brain refused
await section('offline', async () => {
  log('offline');
  const { ctx, page } = await phone(PHONE2, { security: 'fail' });
  await openSecurity(page);
  const L = await locks(page);
  check(/can’t ask the brain/.test(L.find((l) => l.id === 'vault')?.line ?? ''), `[offline] YOUR KEYS says "${L.find((l) => l.id === 'vault')?.line}"`);
  check(L.find((l) => l.id === 'signin')?.line.length > 10 && L.find((l) => l.id === 'backup')?.line.length > 10, '[offline] the phone\'s own locks did not show');
  check(/can’t read the list of approvals/.test((await page.locator('#pg-security .secapprovals .bd').textContent()) ?? ''), '[offline] the approvals panel does not say it can\'t be read');
  await bar(page, '[offline]', '#pg-security');
  await ctx.close();
});

// g. the nightly self-check, told once in the Brief: a lock that slipped is one SECURITY row that opens the screen
await section('brief', async () => {
  log('brief');
  const yday = Date.now() - 86_400_000;
  const { ctx, page } = await phone(PHONE, { security: { locks: { vaultKey: true, demoOpen: true, previews: null, access: false, keyByHash: false }, approvals: [{ tool: 'send_email', what: 'Send an email to Sam', allow: true, from: 'phone', at: yday }, { tool: 'post', what: 'Post on Bluesky', allow: false, from: 'telegram', at: yday }] } });
  await go(page, 'brief');
  // security.c1: yesterday's approvals, one row, beside the self-check
  check(await until(page, () => !!document.querySelector('#pg-brief .brday .brapprovals'), null, 20000), '[brief] no APPROVALS row for yesterday');
  const al = (await page.locator('#pg-brief .brday .brapprovals .v').textContent().catch(() => '')) ?? '';
  check(/^Yesterday you approved 1 and turned down 1\.$/.test(al), `[brief] the approvals row says "${al}"`);
  const shown = await until(page, () => !!document.querySelector('#pg-brief .brday .brsecurity'), null, 20000);
  check(shown, '[brief] no SECURITY row in YOUR DAY when locks slipped');
  if (shown) {
    const line = (await page.locator('#pg-brief .brday .brsecurity .v').textContent()) ?? '';
    check(/^Security: \d+ locks need a look, first /.test(line) || /^Security: [a-z -]+ needs a look\./.test(line), `[brief] the row says "${line}"`);
    check(await page.evaluate(() => document.querySelectorAll('#pg-brief .brsecurity').length === 1), '[brief] the row is there more than once');
    await page.locator('#pg-brief .brday .brsecurity').click();
    check(await until(page, () => location.hash.replace('#', '') === 'security', null, 8000), '[brief] the row does not open Security');
    const told = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.security.told') ?? 'null'));
    check(told && told.levels && told.levels.demo === 'amber' && told.line, `[brief] what was told is not kept on the phone: ${JSON.stringify(told)}`);
  }
  await ctx.close();
});

// f. BODY 21 and the seven looks
await section('body21', async () => {
  log('body 21');
  const { ctx, page } = await phone(PHONE2, { body: 21, security: { locks: { vaultKey: false, demoOpen: true, previews: 'x-ghosty.me.workers.dev', access: false, keyByHash: true }, approvals: APPROVALS } });
  await openSecurity(page);
  await bar(page, '[body 21] [locks]', '#pg-security');
  await showSteps(page);
  await bar(page, '[body 21] [steps]', '#pg-security');
  await ctx.close();
});
await section('looks', async () => {
  const { ctx, page } = await phone(PHONE, { security: { locks: { vaultKey: true, demoOpen: false, previews: null, access: false, keyByHash: false }, approvals: APPROVALS } });
  for (const world of WORLDS) {
    log(`look ${world}`);
    const WORDS = { scan: 'the scan', map: 'the map', eye: 'the eye', orbit: 'orbit', grown: 'grown up', ink: 'one ink', glass: 'glass' };
    await page.evaluate((w) => window.__ghosty.run('set_theme', { theme: w }), WORDS[world]);
    await until(page, (w) => document.documentElement.dataset.world === w, world, 5000);
    await openSecurity(page);
    const L = await locks(page);
    check(L.length === 9, `[${world}] ${L.length} locks drawn`);
    const seen = await page.evaluate(() => {
      const v = document.querySelector('#pg-security .seclocks .rw .v');
      const c = v ? getComputedStyle(v).color : '';
      return { c, ok: !!c && !/rgba\(0, 0, 0, 0\)/.test(c) };
    });
    check(seen.ok, `[${world}] a lock's words have no ink (${seen.c})`);
    await bar(page, `[${world}]`, '#pg-security');
    if (world === 'scan' || world === 'orbit') await page.screenshot({ path: `${out}/securitylane-${world}.png` }).catch(() => undefined);
  }
  await ctx.close();
});

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `SECURITY lane run clean: ${checks} checks in ${secs} s: the row, the nine locks, the approvals, the steps and offline, at 440 and 390, at BODY 21 and in all seven looks`);
process.exit(problems.length ? 1 : 0);
