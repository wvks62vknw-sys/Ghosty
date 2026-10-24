// LINKS → TELEGRAM in every state the brain can report (the brain's /api/telegram/* answers are
// stubbed here, since no Telegram bot exists on a test runner): not connected, waiting for the
// pairing code (shown big, with a countdown), paired (TEST, UNPAIR), and the Telegram
// bot key block in SYSTEM → KEYS. Phone and desktop sizes.
//   node tests/telegram.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { DESKTOP, PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [];

const NONE = { linked: false, bot: null, paired: false, name: null, token: false };
const WAITING = { linked: true, bot: 'GhostyTestBot', paired: false, name: null, code: '482913', codeUntil: Date.now() + 14 * 60_000, token: true };
const PAIRED = { linked: true, bot: 'GhostyTestBot', paired: true, name: 'Sam', token: true };

for (const [name, viewport] of [['desktop', DESKTOP], ['phone', PHONE]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  page.on('dialog', (d) => d.accept());
  let state = NONE;
  const asked = [];
  await page.route('**/api/telegram/**', (route) => {
    const u = new URL(route.request().url());
    asked.push(u.pathname);
    const json = (o, status = 200) => route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(o) });
    if (u.pathname.endsWith('/status')) return json(state);
    if (u.pathname.endsWith('/test')) return json({ sent: true });
    if (u.pathname.endsWith('/unpair')) return json((state = { ...WAITING, code: '770011', codeUntil: Date.now() + 15 * 60_000 }));
    if (u.pathname.endsWith('/code')) return json((state = { ...state, code: '990022', codeUntil: Date.now() + 15 * 60_000 }));
    return json({ error: 'not found' }, 404);
  });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  const open = async () => {
    // Leaving and coming back repaints the panels from the brain's answers.
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(300);
    await page.evaluate(() => (location.hash = 'links'));
    await page.waitForFunction(() => [...document.querySelectorAll('#pg-links .pn')].some((p) => p.querySelector('h3')?.textContent?.includes('TELEGRAM') && p.querySelector('.bd')?.children.length), null, { timeout: 10000 });
    await page.waitForTimeout(300);
  };
  const panelText = () => page.evaluate(() => {
    const p = [...document.querySelectorAll('#pg-links .pn')].find((x) => x.querySelector('h3')?.textContent?.includes('TELEGRAM'));
    return p ? { status: p.querySelector('h3 small')?.textContent ?? '', body: p.querySelector('.bd')?.innerText ?? '', code: p.querySelector('.tgcode')?.textContent ?? '', buttons: [...p.querySelectorAll('button')].map((b) => b.textContent) } : null;
  });
  /** The panel in view (on a phone it sits below EMAIL and SPOTIFY), settled, for a screenshot. */
  const shot = async (file) => {
    await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn')].find((x) => x.querySelector('h3')?.textContent?.includes('TELEGRAM'))?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${out}/${file}` });
  };

  // 1. nothing saved yet
  await open();
  let t = await panelText();
  if (!t) problems.push(`[${name}] no TELEGRAM panel in LINKS`);
  else {
    if (t.status !== 'NOT CONNECTED') problems.push(`[${name}] not-connected status reads "${t.status}"`);
    if (!/SYSTEM → KEYS → Telegram bot/.test(t.body)) problems.push(`[${name}] not-connected note does not point at SYSTEM → KEYS`);
  }
  await shot(`${name}-telegram-none.png`);

  // 2. connected, waiting for the code
  state = WAITING;
  await open();
  t = await panelText();
  if (t.status !== 'WAITING FOR PAIRING') problems.push(`[${name}] waiting status reads "${t.status}"`);
  if (t.code !== '482913') problems.push(`[${name}] the pairing code is not shown big (got "${t.code}")`);
  if (!/@GhostyTestBot/.test(t.body) || !/press START/.test(t.body)) problems.push(`[${name}] the waiting note does not say which bot to open and to press START`);
  if (!/valid for 1[34] min/.test(t.body)) problems.push(`[${name}] no countdown on the code: ${t.body.slice(0, 200)}`);
  if (!t.buttons.includes('NEW CODE')) problems.push(`[${name}] no NEW CODE button while waiting`);
  await shot(`${name}-telegram-waiting.png`);
  // NEW CODE asks the brain and shows the new one
  await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn button')].find((b) => b.textContent === 'NEW CODE')?.click());
  await page.waitForFunction(() => document.querySelector('#pg-links .tgcode')?.textContent === '990022', null, { timeout: 5000 }).catch(() => problems.push(`[${name}] NEW CODE did not show the new code`));
  if (!asked.some((p) => p.endsWith('/telegram/code'))) problems.push(`[${name}] NEW CODE did not call the brain`);
  // an expired code says so
  state = { ...WAITING, code: '111111', codeUntil: Date.now() - 1000 };
  await open();
  t = await panelText();
  if (!/expired/.test(t.body) || t.code === '111111') problems.push(`[${name}] an expired code is still shown as valid: ${t.code} / ${t.body.slice(0, 120)}`);

  // 3. paired
  state = PAIRED;
  await open();
  t = await panelText();
  if (!/^PAIRED/.test(t.status)) problems.push(`[${name}] paired status reads "${t.status}"`);
  if (!/PAIRED WITH\s*Sam/.test(t.body)) problems.push(`[${name}] paired panel does not name Sam: ${t.body.slice(0, 160)}`);
  for (const b of ['TEST', 'UNPAIR']) if (!t.buttons.includes(b)) problems.push(`[${name}] paired panel lacks ${b}`);
  // no NEW CODE while paired: a code the owner could not see would only let a stranger take the chat over (UNPAIR makes one)
  if (t.buttons.includes('NEW CODE')) problems.push(`[${name}] paired panel offers NEW CODE`);
  const hero = await page.evaluate(() => document.querySelector('#pg-links .bigv')?.textContent ?? '');
  if (!/\/ 7 ONLINE/.test(hero)) problems.push(`[${name}] the hero does not count Telegram: "${hero}"`);
  await shot(`${name}-telegram-paired.png`);
  await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn button')].find((b) => b.textContent === 'TEST')?.click());
  await page.waitForFunction(() => /Sent to your Telegram/.test(document.querySelector('#toasts')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => problems.push(`[${name}] TEST showed no confirmation`));
  if (!asked.some((p) => p.endsWith('/telegram/test'))) problems.push(`[${name}] TEST did not call the brain`);
  // UNPAIR (confirmed in its one-tap sheet) → back to waiting with the new code
  await page.evaluate(() => [...document.querySelectorAll('#pg-links .pn button')].find((b) => b.textContent === 'UNPAIR')?.click());
  // (it asks first, in a one-tap confirm)
  await page.locator('.modal .confirm.sure button.sureyes').click({ timeout: 5000 }).catch(() => problems.push(`[${name}] UNPAIR did not ask first`));
  await page.waitForFunction(() => document.querySelector('#pg-links .tgcode')?.textContent === '770011', null, { timeout: 5000 }).catch(() => problems.push(`[${name}] UNPAIR did not show the fresh pairing code`));
  if (!asked.some((p) => p.endsWith('/telegram/unpair'))) problems.push(`[${name}] UNPAIR did not call the brain`);
  await shot(`${name}-telegram-unpaired.png`);

  // 4. SYSTEM → KEYS has the Telegram bot block, with its steps
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForFunction(() => [...document.querySelectorAll('#pg-system .keyblock .lab')].some((l) => l.textContent === 'Telegram bot'), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] no Telegram bot key in SYSTEM → KEYS`));
  const block = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#pg-system .keyblock')].find((x) => x.querySelector('.lab')?.textContent === 'Telegram bot');
    if (!b) return null;
    b.querySelector('button')?.click(); // HOW TO GET IT
    return { note: b.querySelector('.note')?.textContent ?? '', steps: [...b.querySelectorAll('ol.steps li')].map((l) => l.textContent), link: b.querySelector('a.lnk')?.getAttribute('href') ?? '' };
  });
  if (!block) problems.push(`[${name}] Telegram key block missing`);
  else {
    if (!/Telegram/.test(block.note)) problems.push(`[${name}] key block has no why-line`);
    if (block.steps.length < 3 || !/BotFather/.test(block.steps[0])) problems.push(`[${name}] key steps do not start at BotFather: ${block.steps.join(' | ')}`);
    if (block.link !== 'https://t.me/BotFather') problems.push(`[${name}] key link is ${block.link}`);
  }
  await page.screenshot({ path: `${out}/${name}-telegram-key.png` });
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Telegram run clean: every LINKS state and the key block.');
process.exit(problems.length ? 1 : 0);
