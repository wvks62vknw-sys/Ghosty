// SYSTEM → AI ROOM and the new key slot, in a real browser (Chromium, or WebKit with BROWSER=webkit):
//  - the gauge shows one line for the whole lot ("Plenty of room · N providers ready") and a row per
//    provider: room now, used today, when it resets, and READY / BUSY / FULL / OUT TODAY;
//  - after a Gemini key is saved through the KEYS panel, Gemini and Google Gemma (which uses the Gemini
//    key) appear in the gauge;
//  - the optional "Google Gemma" key slot is there with its one plain help line, and the GitHub token
//    no longer promises GitHub Models (retired by GitHub on 30 July 2026);
//  - nothing scrolls sideways at iPhone width.
//   BASE=http://localhost:8871 node tests/airoom.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { openPanel } from './nav.mjs';
import { engine, launch, webkitNoise } from './browser.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('dialog', (d) => void d.accept());
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
await page.evaluate(() => (location.hash = 'system'));
await openPanel(page, 'system', 'AI ROOM');
await page.waitForSelector('#pg-system .airoom .roomsum', { timeout: 15000 });

const gauge = () =>
  page.evaluate(() => ({
    summary: document.querySelector('#pg-system .airoom .roomsum')?.textContent ?? '',
    light: document.querySelector('#pg-system .airoom h3 small')?.textContent ?? '',
    rows: [...document.querySelectorAll('#pg-system .airoom .rw')].map((r) => ({ k: r.querySelector('.k')?.textContent ?? '', v: r.querySelector('.v')?.textContent ?? '', n: r.querySelector('.n')?.textContent ?? '', state: r.dataset.room })),
  }));

// ---- 1. before any key: the open endpoint only (the preview has no Workers AI binding)
let g = await gauge();
// (In CI the specs share one brain: count from what is there, the open endpoint at least.)
const readyBefore = Number(g.summary.match(/^Plenty of room · (\d+) providers? ready$/)?.[1] ?? NaN);
check(readyBefore >= 1, `summary before the Gemini key: "${g.summary}"`);
check(g.light === 'PLENTY', `panel status: ${g.light}`);
const poll = g.rows.find((r) => r.k === 'POLLINATIONS');
check(!!poll && /^room now 2 of 2 a minute · used today 0 · rolling day$/.test(poll.v) && poll.n === 'READY', `Pollinations row: ${JSON.stringify(poll)}`);
await page.screenshot({ path: `${out}/airoom-${engine}-empty.png`, fullPage: false });

// ---- 2. the keys: the Google Gemma slot (optional, one plain line) and the GitHub token's honest line
await openPanel(page, 'system', 'KEYS');
await page.evaluate(() => [...document.querySelectorAll('#pg-system button')].find((b) => /OPTIONAL KEYS/.test(b.textContent ?? ''))?.click());
await page.waitForFunction(() => [...document.querySelectorAll('#pg-system .keyblock .lab')].some((l) => l.textContent === 'Google Gemma'), null, { timeout: 5000 }).catch(() => undefined);
const blocks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#pg-system .keyblock')].map((b) => [b.querySelector('.lab')?.textContent ?? '', b.querySelector(':scope > .note')?.textContent ?? ''])));
check(/Gemini key/.test(blocks['Google Gemma'] ?? ''), `Google Gemma help line: "${blocks['Google Gemma']}"`);
check(!!blocks['GitHub token'] && !/GPT-4\.1|GitHub Models/.test(blocks['GitHub token']), `GitHub token line: "${blocks['GitHub token']}"`);

// ---- 3. save a Gemini key through the panel: Gemini and Google Gemma join the gauge
const gem = page.locator('#pg-system .keyblock', { has: page.locator('.lab', { hasText: /^Gemini$/ }) });
await gem.locator('input').fill('AIzaPreviewKeyForTheGauge000000000000');
await gem.locator('button', { hasText: 'SAVE' }).click();
await page.waitForFunction(() => [...document.querySelectorAll('#pg-system .airoom .rw .k')].some((k) => k.textContent === 'GEMINI'), null, { timeout: 15000 }).catch(() => undefined);
g = await gauge();
const gemini = g.rows.find((r) => r.k === 'GEMINI');
const gemma = g.rows.find((r) => r.k === 'GOOGLE GEMMA');
check(!!gemini && /^room now \d+ of \d+ a minute · used today 0 · best model [\d,]+ left today · resets /.test(gemini.v), `Gemini row: ${JSON.stringify(gemini)}`);
check(!!gemma && gemma.n === 'READY' && /^small jobs only · /.test(gemma.v), `Google Gemma row (Gemini key): ${JSON.stringify(gemma)}`);
check(g.summary === `Plenty of room · ${readyBefore + 1} providers ready`, `summary with a Gemini key (Gemma, small jobs only, not counted): "${g.summary}"`);

// ---- 4. iPhone width: nothing scrolls sideways, every row inside the panel
const fit = await page.evaluate(() => {
  const pn = document.querySelector('#pg-system .airoom');
  const w = pn?.getBoundingClientRect();
  const over = [...(pn?.querySelectorAll('.rw') ?? [])].filter((r) => r.getBoundingClientRect().right > (w?.right ?? 0) + 1).length;
  return { doc: document.documentElement.scrollWidth, vw: innerWidth, over };
});
check(fit.doc <= fit.vw && fit.over === 0, `sideways: ${JSON.stringify(fit)}`);
await openPanel(page, 'system', 'AI ROOM');
await page.locator('#pg-system .airoom').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/airoom-${engine}.png`, fullPage: false });

await browser.close();
if (problems.length) {
  console.error(`FAIL (${engine}):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`ok (${engine}): AI ROOM gauge, the Google Gemma key slot and the GitHub token line`);
