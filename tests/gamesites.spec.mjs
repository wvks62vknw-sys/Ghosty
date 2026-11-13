// A GAME ON HIS SITES AS AN INSTALLABLE PAGE (BRIEF-KERNEL-3 item 6; the owner's yes, FINAL-ROUND 13 Nov), the real app at 440 × 956
// and 390 × 844, with the preview's scripted brain. (a) a game made from the chat opens in the studio; (b) AS AN APP's PUT IT ON MY
// SITES says the sentence that starts the chat turn; (c) its tap hands the game over and asks in the chat, and nothing is live
// before his APPROVE; (d) APPROVE: the link is given and the page is live at /s/<name>/; (e) the page: its exact policy pins its
// one script, no network, no camera, microphone or location; its manifest (standalone, its own scope, its icon once); its icon;
// (f) it plays (its own title card, a drawn game, no error and no policy refusal); (g) its saves are under its own key and a
// CONTINUE comes back after a reload; (h) its worker keeps it: offline, it opens and CONTINUE is still there; (i) the studio's
// keys are 44 pt, nothing sideways, BODY 21 clips nothing. UNDO: unpublish_site takes it down (the link stops working).
//   BASE=http://localhost:8788 node tests/gamesites.spec.mjs tests/.shots
import { devices } from 'playwright';
import { createHash } from 'node:crypto';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch();
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
};
const until = (page, fn, arg, timeout = 15000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const sha = (s) => createHash('sha256').update(s, 'utf8').digest('base64');
const pressBtn = (page, label) => page.evaluate((label) => [...document.querySelectorAll('#pg-gamestudio button')].find((b) => (b.getAttribute('aria-label') || '').trim() === label || b.textContent.trim() === label)?.click(), label);

async function open(size) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: size, screen: size, ...UK });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => !webkitNoise(e) && errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource|401|403/.test(m.text()) && errors.push(m.text()));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
  if (await page.$('.logbtn')) await page.click('.logbtn');
  return { ctx, page, errors };
}

for (const [W, size, animal] of [[440, PHONE, 'fox'], [390, { width: 390, height: 844 }, 'hare']]) {
  if (process.env.ONLY && process.env.ONLY !== String(W)) continue;
  console.log(`\n== ${W}`);
  const { ctx, page, errors } = await open(size);
  const name = `${animal[0].toUpperCase()}${animal.slice(1)} Run`;

  // (a) a game made from the chat (the brain's `game` tool) opens in the studio
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', `make me a platformer about a ${animal}`);
  await page.keyboard.press('Enter');
  check(await until(page, (n) => location.hash.startsWith('#gamestudio') && document.querySelector('#pg-gamestudio .stPills') && window.__ghostyStudio?.game?.().name === n, name, 30000), `${W}: (a) "make me a platformer about a ${animal}" opens the studio on ${name}`);

  // (b) AS AN APP: the sentence that starts the chat turn
  await page.evaluate(() => document.querySelector('#pg-gamestudio .secpill[data-sec="app"]')?.click());
  check(await until(page, () => document.querySelector('#pg-gamestudio .stSitesLine'), null, 8000), `${W}: (b) AS AN APP is open`);
  const line = await page.locator('#pg-gamestudio .stSitesLine').textContent();
  check(line === `Ask me in the chat: “put ${name} on my sites” and I’ll ask your APPROVE.`, `${W}: (b) PUT IT ON MY SITES says the sentence that starts the chat turn: ${line}`);
  const said = await page.evaluate(() => document.querySelector('#pg-gamestudio .stSites')?.closest('section.stSec')?.textContent ?? '');
  check(/installs to a Home Screen, plays offline and keeps its saves/.test(said) && !/can’t put this on your sites yet/.test(said), `${W}: (b) it says what the page will be, and no longer that it cannot`);
  // (i) the studio's keys: 44 pt, nothing sideways, BODY 21 clips nothing
  for (const body of ['', '21']) {
    await page.evaluate((b) => (b ? (document.documentElement.dataset.body = b) : delete document.documentElement.dataset.body), body);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const box = document.querySelector('#pg-gamestudio .stSites')?.parentElement;
      const small = [...(box?.querySelectorAll('button') ?? [])].filter((b) => b.getClientRects().length).filter((b) => b.getBoundingClientRect().height < 43.4 || b.getBoundingClientRect().width < 43.4).map((b) => b.textContent);
      const cut = [...(box?.querySelectorAll('button, p') ?? [])].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible').map((e) => e.textContent.slice(0, 20));
      return { small, cut, sideways: document.documentElement.scrollWidth > innerWidth };
    });
    check(!r.small.length && !r.cut.length && !r.sideways, `${W}: (i) BODY ${body || 'default'}: the sites keys are 44 pt, nothing cut, nothing sideways ${JSON.stringify(r)}`);
  }
  await page.evaluate(() => delete document.documentElement.dataset.body);
  await page.screenshot({ path: `${out}/gamesites-${W}-studio.png` });

  // (c) the tap: the game handed over, the chat asked, and his APPROVE waited for
  await pressBtn(page, 'Put the page on my sites');
  const card = await page.waitForSelector('.approval button.on', { timeout: 30000 }).catch(() => null);
  check(!!card, `${W}: (c) the tap asks in the chat, and the chat stops for his APPROVE`);
  if (!card) {
    await page.screenshot({ path: `${out}/gamesites-${W}-noapproval.png` });
    await ctx.close();
    continue;
  }
  const asked = await page.evaluate((n) => (document.querySelector('#pg-core')?.textContent ?? '').includes(`Put ${n} on my sites`), name);
  check(asked, `${W}: (c) his words in the chat are "Put ${name} on my sites"`);
  const reason = await card.evaluate((b) => b.closest('.approval')?.textContent ?? '');
  const slug = reason.match(/\/s\/([a-z0-9-]+)\/\?/)?.[1] ?? '';
  check(!!slug && new RegExp(`(Put|Update) your game "${name}" on your sites at`).test(reason) && /installs to a Home Screen, plays offline and keeps its saves/.test(reason), `${W}: (c) the approval says what goes live and where: ${reason.slice(0, 200)}`);
  const link = `${base}/s/${slug}/`;
  const before = await page.request.get(link, { headers: { 'sec-fetch-dest': 'document' } });
  const was = before.status() === 200 ? await before.text() : '';
  check(before.status() === 404, `${W}: (c) nothing is live before his APPROVE (${before.status()})`);
  await page.screenshot({ path: `${out}/gamesites-${W}-approve.png` });

  // (d) APPROVE: the link given, the page live
  await card.tap();
  check(await until(page, (s) => document.querySelector(`#pg-core a.sitelink[href$="/s/${s}/"]`), slug, 30000), `${W}: (d) after APPROVE the chat gives the link /s/${slug}/, as a card he taps`);
  let live = null;
  for (let i = 0; i < 40 && !live; i++) {
    const r = await page.request.get(link, { headers: { 'sec-fetch-dest': 'document' } });
    if (r.status() === 200 && (await r.text()) !== was) live = r;
    else await page.waitForTimeout(250);
  }
  check(!!live, `${W}: (d) the page is live at /s/${slug}/`);
  if (!live) {
    await ctx.close();
    continue;
  }

  // (e) the page's own policy, manifest and icon
  const html = await live.text();
  const h = live.headers();
  const script = /<script>([\s\S]*)<\/script><\/body>/.exec(html)?.[1] ?? '';
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? '';
  const expect = `default-src 'none'; script-src 'sha256-${sha(script)}'; style-src 'sha256-${sha(style)}'; img-src 'self' data: blob:; manifest-src 'self'; worker-src 'self'; connect-src 'none'; media-src 'none'; font-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'`;
  check(h['content-security-policy'] === expect, `${W}: (e) its policy is exactly its one script and style by hash, no network, never framed`);
  check(/camera=\(\), microphone=\(\), geolocation=\(\)/.test(h['permissions-policy'] ?? ''), `${W}: (e) no camera, microphone or location`);
  check((html.match(/<script(?![^>]*application\/json)/g) ?? []).length === 1 && script.length > 10000, `${W}: (e) one script runs, and it is the studio's player (${script.length} chars)`);
  check(html.includes(`data-save="ghosty-site:${slug}"`), `${W}: (e) its saves are under its own key, ghosty-site:${slug}`);
  const man = await page.request.get(`${base}/s/${slug}/page`, { headers: { 'sec-fetch-dest': 'manifest' } });
  const m = await man.json().catch(() => ({}));
  check(/manifest\+json/.test(man.headers()['content-type'] ?? '') && m.name === name && m.display === 'standalone' && m.start_url === `/s/${slug}/` && m.scope === `/s/${slug}/` && m.icons?.length === 1 && m.icons[0].src === `/s/${slug}/page` && m.icons[0].sizes === '512x512', `${W}: (e) its manifest: ${name}, standalone, its own scope, its icon once`);
  const icon = await page.request.get(`${base}/s/${slug}/page`, { headers: { 'sec-fetch-dest': 'image' } });
  const png = await icon.body();
  check(icon.headers()['content-type'] === 'image/png' && png[1] === 80 && png.readUInt32BE(16) === 512, `${W}: (e) its icon is a 512 px PNG`);

  // (f) it plays: on his phone, in its own page
  const game = await ctx.newPage();
  const gameErrors = [];
  game.on('pageerror', (e) => !webkitNoise(e) && gameErrors.push(e.message));
  game.on('console', (c) => (c.type() === 'error' || /Content Security Policy|Refused/.test(c.text())) && gameErrors.push(c.text()));
  await game.goto(link, { waitUntil: 'load' });
  check(await until(game, () => document.querySelector('.gpEnd button'), null, 10000), `${W}: (f) the page opens on its own title card`);
  const words = await game.$$eval('.gpEnd button', (b) => b.map((x) => x.textContent));
  check(words.includes('Play') && !words.includes('Continue'), `${W}: (f) a first visit has PLAY and no CONTINUE (${words.join(', ')})`);
  await game.click('.gpEnd button');
  await game.waitForSelector('.gpPad', { timeout: 8000 }).catch(() => undefined);
  await game.waitForTimeout(500);
  const lit = await game.evaluate(() => { const c = document.getElementById('c'); const g = c.getContext('2d'); const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4 * 97) if (d[i] || d[i + 1] || d[i + 2]) n++; return n; });
  check(lit > 50, `${W}: (f) it draws its game (${lit} lit samples)`);
  await game.screenshot({ path: `${out}/gamesites-${W}-play.png` });

  // (g) its saves: its own key, and a CONTINUE after a reload (the save is the shape the player writes at a save point)
  const keys = await game.evaluate((s) => {
    const g = JSON.parse(document.getElementById('game').textContent);
    const start = g.rooms.find((r) => r.id === g.start) ?? g.rooms[0];
    let at = [2, 2];
    start.rows.forEach((row, y) => { const x = row.indexOf('P'); if (x >= 0) at = [x, y]; });
    localStorage.setItem(`ghosty-site:${s}`, JSON.stringify({ v: 1, game: g.id, rid: start.id, x: at[0] * 16, y: at[1] * 16, face: 1, hearts: 3, lives: 3, coins: 7, inv: {}, opened: [], gone: [], chests: [], seen: [start.id], quests: {}, picked: {}, kills: {}, talked: [], ready: [], spawn: null, timeLeft: 0, power: null }));
    return Object.keys(localStorage).filter((k) => k.startsWith('ghosty-site:') || k.startsWith('ghostygame:'));
  }, slug);
  check(keys.includes(`ghosty-site:${slug}`) && !keys.some((k) => k.startsWith('ghostygame:')), `${W}: (g) the page keeps no save but its own key (${keys.join(', ')})`);
  await game.reload({ waitUntil: 'load' });
  check(await until(game, () => [...document.querySelectorAll('.gpEnd button')].some((b) => b.textContent === 'Continue'), null, 10000), `${W}: (g) after a reload its save is there: CONTINUE`);
  await game.evaluate(() => [...document.querySelectorAll('.gpEnd button')].find((b) => b.textContent === 'Continue')?.click());
  check(await until(game, () => document.querySelector('.gpPad'), null, 8000), `${W}: (g) CONTINUE plays on from the save`);

  // (h) offline: its worker keeps the page; it opens and the save is still there
  const kept = await game.evaluate(async (scope) => {
    const end = Date.now() + 10000;
    while (Date.now() < end) {
      const r = await navigator.serviceWorker.getRegistration(scope);
      if (r?.active) return true;
      await new Promise((ok) => setTimeout(ok, 200));
    }
    return false;
  }, `/s/${slug}/`);
  check(kept, `${W}: (h) its offline worker is running, scoped to /s/${slug}/`);
  await game.reload({ waitUntil: 'load' }); // now controlled by it
  await game.waitForTimeout(500);
  await ctx.setOffline(true);
  await game.reload({ waitUntil: 'load' }).catch(() => undefined);
  check(await until(game, () => [...document.querySelectorAll('.gpEnd button')].some((b) => b.textContent === 'Continue'), null, 10000), `${W}: (h) offline it opens, with CONTINUE`);
  await ctx.setOffline(false);
  check(gameErrors.length === 0, `${W}: (f) the page runs with no error and no policy refusal${gameErrors.length ? `: ${gameErrors[0]}` : ''}`);
  await game.close();

  check(errors.length === 0, `${W}: no page error in the app${errors.length ? `: ${errors.slice(0, 3).join(' | ')}` : ''}`);
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `\nFAIL gamesites: ${problems.length} problem(s)\n- ${problems.join('\n- ')}` : '\nPASS gamesites: a studio game on his sites, behind his APPROVE, installable, offline, its saves its own');
process.exit(problems.length ? 1 : 0);
