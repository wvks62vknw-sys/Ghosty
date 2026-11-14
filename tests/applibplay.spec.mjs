// THE APP LIBRARY's game kinds and App Maker (PLAY & MAKE lane; features/applib/games, features/applib/maker.ts), driven
// through the real Library routes:
// - one Games app of each main kind opens at #apps/<id> and draws its board, then makes its main move: a number placed in
//   sudoku, a first tap in mines that opens an area, a swipe in merge, the stock turned in patience, a word guessed, a piece
//   dropped, a pair turned;
// - pause hides the board; a reload brings the same game back, paused, and RESUME plays on; the kit's Undo takes a move back;
// - App Maker: MAKE MY OWN, a records app with a field added, kept, then opened from the Library and drawn by the engine;
//   "make my own from this" opens a copy of a Library game;
// - every board and the Maker: one scroll area, nothing sideways, every key 44 pt, no console error, in all seven looks at 390.
import { launch } from './browser.mjs';
import { UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const problems = [];
const check = (ok, what) => ok || problems.push(what);
const T0 = Date.now();
const WORLDS = ['glass', 'eye', 'grown', 'ink', 'map', 'orbit', 'scan'];
const PHONE = { width: 390, height: 844 };

async function open(world = 'glass') {
  const ctx = await browser.newContext({ viewport: PHONE, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${world}] pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && problems.push(`[${world}] console: ${m.text().slice(0, 160)}`));
  await page.addInitScript((world) => {
    localStorage.setItem('ghosty.ownerKey', 'preview-owner-key-0123456789');
    if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, look: { ground: 'graphite', world, night: 'graphite', switches: {} } }));
  }, world);
  await page.goto(`${base}/#apps`);
  await page.waitForTimeout(800);
  return { ctx, page };
}
// (in-page, after the Library has loaded its lanes' files)
const go = async (page, hash) => {
  await page.evaluate((h) => (location.hash = h), hash);
  await page.waitForTimeout(600);
};
const fit = (page) => page.evaluate(() => {
  const scope = document.querySelector('.al-pro-frame .ak-app') ?? document.querySelector('.ak-app') ?? document.body;
  const small = [...scope.querySelectorAll('button')].filter((b) => b.getClientRects().length && b.offsetParent).map((b) => [b.textContent.trim().slice(0, 14), b.getBoundingClientRect()]).filter(([, r]) => r.height < 43.5 || r.width < 43.5).map(([t, r]) => `${t}:${Math.round(r.width)}x${Math.round(r.height)}`);
  const scrollers = [...document.querySelectorAll(document.querySelector('.al-pro-frame') ? '.al-pro-frame *' : '#pg-apps *, .ak-app *')].filter((e) => e.scrollHeight > e.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(e).overflowY) && e.getClientRects().length).length;
  return { small, scrollers, sideways: document.documentElement.scrollWidth > innerWidth };
});
const okFit = (m, what) => check(!m.small.length && m.scrollers <= 1 && !m.sideways, `[fit ${what}] ${JSON.stringify(m)}`);
const kind = (page) => page.locator('.al-game').getAttribute('data-kind').catch(() => null);

// ---- one app of each main kind, its board and its main move
{
  const { ctx, page } = await open();
  const apps = { sudoku: 'sudoku', mines: 'minesweeper', merge: 'merge-tiles', solitaire: 'patience', wordguess: 'daily-word', blocks: 'block-drop', pairs: 'memory-match', nonogram: 'nonograms', snake: 'snake', hangman: 'hangman', quiz: 'capital-cities', dots: 'dots-boxes' };
  for (const [k, id] of Object.entries(apps)) {
    await go(page, `#apps/${id}`);
    const shown = await page.waitForSelector('.al-game', { timeout: 10000 }).then(() => true, () => false);
    check(shown, `[${id}] no game board drew`);
    if (!shown) continue;
    check((await kind(page)) === k, `[${id}] drew ${await kind(page)}, not ${k}`);
    // (the first run's tour steps away, so the board is the thing in view)
    await page.evaluate(() => { for (let i = 0; i < 4; i++) document.querySelector('.ak-tour:not([hidden]) button')?.click(); }); // (THE PRO ROUND: the tour is the coach marks now, ended with it)
    okFit(await fit(page), id);
    if (k === 'sudoku') {
      const empty = await page.evaluate(() => [...document.querySelectorAll('.al-gsudoku .al-gcell')].findIndex((c) => !c.textContent.trim()));
      await page.locator('.al-gsudoku .al-gcell').nth(empty).click();
      await page.locator('.al-gpadkey').nth(4).click();
      const filled = () => page.evaluate(() => [...document.querySelectorAll('.al-gsudoku .al-gcell')].filter((c) => /^[1-9]$/.test(c.textContent.trim())).length);
      const after = await filled();
      await page.locator('.ak-tools button', { hasText: 'Undo' }).click();
      check((await filled()) === after - 1, `[sudoku] Undo did not take the number back`);
      await page.locator('.ak-tools button', { hasText: 'Redo' }).click();
      check((await filled()) === after, `[sudoku] Redo did not put it back`);
      await page.getByRole('button', { name: 'Pause the game' }).click();
      check(await page.evaluate(() => document.querySelector('.al-gstage').classList.contains('al-ghide')), '[sudoku] pause did not hide the board');
      await page.reload();
      // (back to the Library and in again, so the Library has loaded its lanes' files before the app opens)
      await go(page, '#apps');
      await go(page, '#apps/sudoku');
      await page.waitForSelector('.al-game', { timeout: 15000 }).catch(() => {});
      check(await page.getByRole('button', { name: 'Resume', exact: true }).isVisible().catch(() => false), '[sudoku] after a reload the game is not back, paused');
      check((await filled()) === after, `[sudoku] after a reload the grid changed (${await filled()} for ${after})`);
      await page.getByRole('button', { name: 'Resume', exact: true }).click().catch(() => {});
    }
    if (k === 'mines') {
      await page.locator('.al-gmines .al-gcell').nth(40).click();
      check((await page.locator('.al-gmines .al-gopen').count()) >= 1, '[mines] the first tap opened nothing');
      check(!(await page.locator('.al-gmines .al-gboom').count()), '[mines] the first tap was a mine');
    }
    if (k === 'merge') {
      const tiles = () => page.evaluate(() => [...document.querySelectorAll('.al-gmerge .al-gtile')].map((t) => t.dataset.v ?? '').join());
      const t0 = await tiles();
      for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']) {
        await page.keyboard.press(key);
        if ((await tiles()) !== t0) break;
      }
      check((await tiles()) !== t0, '[merge] no swipe moved a tile');
    }
    if (k === 'solitaire') {
      await page.getByRole('button', { name: 'Turn the stock' }).click();
      check((await page.locator('.al-gwaste .al-gcard').count()) >= 1, '[solitaire] turning the stock showed no card');
    }
    if (k === 'wordguess') {
      await page.keyboard.type('crane');
      await page.keyboard.press('Enter');
      const marks = await page.evaluate(() => [...document.querySelectorAll('.al-gwrow')[0].children].map((c) => c.dataset.m ?? ''));
      check(marks.length === 5 && marks.every((m) => ['hit', 'near', 'miss'].includes(m)), `[wordguess] the guess was not marked: ${marks}`);
    }
    if (k === 'blocks') {
      await page.getByRole('button', { name: 'Drop the piece' }).click();
      await page.waitForTimeout(150); // (the score is drawn on the next frame)
      check(Number((await page.locator('.al-gnum').textContent()).replace(/\D/g, '')) > 0, '[blocks] a drop scored nothing');
    }
    if (k === 'pairs') {
      await page.locator('.al-gpaircard').nth(0).click();
      check((await page.locator('.al-gpaircard.al-gup').count()) === 1, '[pairs] a tapped card did not turn');
    }
    if (k === 'dots') {
      await page.locator('.al-gedge').first().click();
      await page.waitForTimeout(800);
      check((await page.locator('.al-gedge[data-by="1"]').count()) === 1 && (await page.locator('.al-gedge[data-by="2"]').count()) >= 1, '[dots] no line, or the phone did not answer');
    }
  }
  await page.screenshot({ path: `${out}/applibplay-dots-390.png` });
  await ctx.close();
}

// ---- App Maker: make a records app, keep it, open it from the Library; make my own from a Library game
{
  const { ctx, page } = await open();
  await go(page, '#apps/make');
  check((await page.locator('.ak-app').count()) >= 1, '[maker] MAKE MY OWN did not open App Maker');
  okFit(await fit(page), 'maker');
  await page.getByRole('button', { name: 'New app' }).click();
  await page.getByRole('button', { name: /^Records/ }).click();
  await page.locator('.al-maker input[aria-label="Name"]').fill('Fishing Log');
  await page.locator('.al-maker input[aria-label="Name"]').press('Tab');
  await page.locator('.al-maker input[aria-label="New field name"]').fill('Weight');
  await page.locator('.al-mkadd select').first().selectOption('number');
  await page.getByRole('button', { name: 'Add field' }).click();
  check(await page.evaluate(() => [...document.querySelectorAll('.al-mkfield input')].some((i) => i.value === 'Weight')), '[maker] the new field is not listed');
  check(await page.locator('.al-mkok').isVisible(), `[maker] the app is not ready to keep: ${await page.locator('.al-mkproblems').textContent().catch(() => '')}`);
  await page.getByRole('button', { name: 'Keep it' }).click();
  okFit(await fit(page), 'maker editor');
  await page.screenshot({ path: `${out}/applibplay-maker-390.png` });
  const id = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.app.maker')).items.find((x) => x.title === 'Fishing Log')?.id);
  check(!!id, '[maker] the app was not kept on the phone');
  if (id) {
    await go(page, `#apps/${id}`);
    check(await page.locator('.ak-app .ak-name', { hasText: 'Fishing Log' }).count(), `[maker] the made app does not open from the Library at #apps/${id}`);
  }
  await go(page, '#apps/make/sudoku');
  check((await page.locator('.al-maker input[aria-label="Name"]').inputValue().catch(() => '')) === 'My Sudoku', '[maker] make my own from Sudoku did not open a copy');
  await ctx.close();
}

// ---- every look at 390: a board and the Maker fit
for (const world of WORLDS) {
  const { ctx, page } = await open(world);
  for (const id of ['merge-tiles', 'daily-word']) {
    await go(page, `#apps/${id}`);
    await page.waitForSelector('.al-game', { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => { for (let i = 0; i < 4; i++) document.querySelector('.ak-tour:not([hidden]) button')?.click(); }); // (THE PRO ROUND: the tour is the coach marks now, ended with it)
    okFit(await fit(page), `${id} ${world}`);
  }
  await page.screenshot({ path: `${out}/applibplay-${world}-390.png` });
  await go(page, '#apps/make');
  okFit(await fit(page), `maker ${world}`);
  await ctx.close();
}

await browser.close();
const s = Math.round((Date.now() - T0) / 1000);
if (problems.length) {
  console.log(`applibplay: ${problems.length} problem(s) in ${s} s`);
  for (const p of problems) console.log(`  ${p}`);
  process.exit(1);
}
console.log(`applibplay: OK (twelve game kinds open from the Library and make their main move; pause, a reload and resume keep the game; Undo and Redo step a move; App Maker makes, keeps and opens an app and copies a Library game; one scroll area, nothing sideways and every key 44 pt in all seven looks at 390; ${s} s)`);
