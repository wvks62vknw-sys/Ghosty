// The ARCADE on the owner's iPhone 18 Pro Max (440 × 956): the tab opens from the systems deck and from #arcade; the
// shelf lists its games, each with its size on GET; GET on a (stubbed) mobile-data connection waits with its line and
// goes on once the phone is on Wi-Fi; with the Archive stubbed to serve a tiny valid fixture (tests/fixtures/arcade:
// FLASH.COM, a 131-byte DOS program written for these tests, public domain), PLAY opens the player on the real DOS
// engine, frames render (two canvas snapshots differ), the touch layer shows and its stick and buttons reach the game,
// PAUSE shows RESUME · QUIT · SOUND · CONTROLS, QUIT returns to the shelf and the best score is written; the program's
// own save file comes back after a reload (it counts its visits); DELETE takes the game off the phone in one tap; with
// the Archive out of reach (his network's filter) GET asks this site for the same file under /api/arcade/, with his key,
// and its reason names both mirrors; every control has a VoiceOver label; nothing sticks out sideways at 440 × 956 or
// 390 × 844; the page's security policy blocks nothing.
// THE NATIVE ENGINES, with the real free data (fetched once by tests/fixtures/engines/fetch.sh, never committed; without
// it these checks skip with one line), each GOT through the store from the Archive's address (served here from the
// fetched file): DOOM's free episode on doomgeneric starts inside PLAY's tap, renders frames, FIRE from its title reaches
// E1M1, PAUSE shows the fps line and GAME MENU (which opens DOOM's own menu; the MENU key closes it), QUIT returns and
// the longest sitting is written; Freedoom Phase 1 the same (its one GET fills Phase 2's card too); Quake starts and
// renders. THE FREE LEVELS lists a dozen packs, each with its author and its size on GET (and the DeHackEd line where
// it ships one); a pack of the spec's own (one harmless lump in a PWAD, public domain) is GOT and PLAYED over Freedoom
// Phase 2 with DOOM's -file, to MAP01. THE GAMES MADE BY US play at once (PLAY on the card, no GET, no size): the
// runner opens full screen with its own overlay and none of the player's controls, and its own QUIT returns to the
// shelf with no score written by the player.
//   BASE=http://localhost:8855 node tests/arcade.spec.mjs tests/.shots
import { launch, webkitNoise, engine } from './browser.mjs';
import { PHONE, UK, openScreen } from './nav.mjs';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { crc32 } from 'node:zlib';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];

// ---------- the fixture package: FLASH.COM and its licence in a plain ZIP, as the Archive would serve a game
function zip(files) {
  const parts = [];
  const dir = [];
  let off = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name);
    const c = crc32(data) >>> 0;
    const head = (sig, central) => {
      const b = Buffer.alloc(central ? 46 : 30);
      b.writeUInt32LE(sig, 0);
      let p = 4;
      if (central) b.writeUInt16LE(20, p), (p += 2);
      b.writeUInt16LE(20, p); b.writeUInt16LE(0, p + 2); b.writeUInt16LE(0, p + 4); b.writeUInt16LE(0, p + 6); b.writeUInt16LE(0x21, p + 8);
      b.writeUInt32LE(c, p + 10); b.writeUInt32LE(data.length, p + 14); b.writeUInt32LE(data.length, p + 18); b.writeUInt16LE(n.length, p + 22);
      if (central) b.writeUInt32LE(off, 42);
      return b;
    };
    parts.push(head(0x04034b50, false), n, data);
    dir.push(head(0x02014b50, true), n);
    off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(dir);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}
const fx = new URL('./fixtures/arcade/', import.meta.url);
const pkg = zip([['FLASH.COM', readFileSync(new URL('FLASH.COM', fx))], ['LICENCE.TXT', readFileSync(new URL('LICENCE', fx))]]);
const FIXTURE = {
  id: 'test-flash',
  title: 'FLASH TEST',
  line: 'A tiny DOS program that flashes the screen.',
  engine: 'dos',
  data: {
    url: ['https://archive.org/cors/ghosty-test-fixture/flash.zip'],
    sha256: createHash('sha256').update(pkg).digest('hex'),
    bytes: pkg.length,
    licence: 'Public domain (CC0 1.0): written for Ghosty\'s tests; anyone may copy and pass it on.',
    credit: 'Ghosty\'s tests (tests/fixtures/arcade).',
    take: [{ name: 'flash.jsdos', from: [], bundle: true }],
  },
  controls: ['move', 'fire', 'use'],
  saves: true,
  since: '2026-11-01',
  ghosty: 'Sixteen colours a visit, counted in its own save file.',
  done: 'Flashed.',
  dos: {
    run: ['FLASH.COM'],
    cycles: 'max',
    controls: { stick: 'arrows', drag: 'none', buttons: [{ act: 'fire', key: 'ctrl', label: 'FIRE' }, { act: 'use', key: 'space', label: 'USE' }, { act: 'menu', key: 'esc', label: 'ESC', small: true }, { act: 'ok', key: 'enter', label: 'ENTER', small: true }] },
  },
};

// ---------- a level pack of the spec's own: one harmless lump in a PWAD (public domain), played over Freedoom Phase 2
const wad = Buffer.alloc(32);
wad.write('PWAD', 0, 'latin1');
wad.writeInt32LE(1, 4);
wad.writeInt32LE(16, 8);
wad.write('GHST', 12, 'latin1');
wad.writeInt32LE(12, 16);
wad.writeInt32LE(4, 20);
wad.write('GHOSTYTS', 24, 'latin1');
const packZip = zip([['TESTMAP.WAD', wad], ['LICENCE.TXT', readFileSync(new URL('LICENCE', fx))]]);
const PACK = {
  id: 'test-pack',
  title: 'Test Pack',
  author: 'Ghosty\'s tests',
  line: 'One harmless lump, to prove a pack loads over Freedoom.',
  base: 'freedoom2',
  data: {
    url: ['https://archive.org/cors/ghosty-test-fixture/testpack.zip'],
    sha256: createHash('sha256').update(packZip).digest('hex'),
    bytes: packZip.length,
    licence: 'Public domain (CC0 1.0): written for Ghosty\'s tests; anyone may copy and pass it on.',
    credit: 'Ghosty\'s tests (tests/arcade.spec.mjs).',
    take: [{ name: 'testmap.wad', from: ['TESTMAP.WAD'] }],
  },
};

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: PHONE,
  ...UK,
  deviceScaleFactor: 2,
  isMobile: engine !== 'webkit' ? true : undefined,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/favicon|net::ERR|404|Failed to load resource|^[WI]\d{4} |^INFO:/.test(t)) problems.push(`console: ${t.slice(0, 200)}`);
});
await page.addInitScript(([fixture, pack]) => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  window.__ghostyArcadeShelf = [fixture];
  window.__ghostyArcadeLevels = [pack];
  // the phone's connection, stubbed: mobile data until the spec says Wi-Fi
  const net = new EventTarget();
  net.type = sessionStorage.getItem('arcnet') ?? 'cellular';
  window.__net = net;
  Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => window.__net });
}, [FIXTURE, PACK]);
// the Archive: the fixture, and the real free packages from fetch.sh's files when the native checks run (no game is
// ever fetched from the network by a spec)
const asked = [];
const served = new Map(); // a package's first mirror → the fetched file
await page.route('https://archive.org/**', (route) => {
  const u = route.request().url();
  asked.push(u);
  if (u === FIXTURE.data.url[0]) return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/zip' }, body: pkg });
  if (u === PACK.data.url[0]) return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/zip' }, body: packZip });
  if (served.has(u)) return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/zip' }, body: readFileSync(served.get(u)) });
  return route.abort('blockedbyclient');
});

const until = (fn, ms, what, arg = null) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => { problems.push(what); return false; });
const boot = async () => {
  await page.goto(base);
  await page.waitForFunction(() => !!document.querySelector('#pair input') || !document.querySelector('#boot'), null, { timeout: 20000 }).catch(() => undefined);
  if (await page.locator('#pair input').isVisible().catch(() => false)) {
    await page.fill('#pair input', 'preview-owner-key-0123456789');
    await page.click('#pair button.on');
  }
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
};
const sideways = (where) => page.evaluate((where) => {
  const W = innerWidth;
  const over = [...document.querySelectorAll(where)].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > W + 1); });
  return { page: document.documentElement.scrollWidth > W + 1, over: over.slice(0, 3).map((e) => `${e.tagName}.${e.className}`) };
}, where);
const unlabelled = (where) => page.evaluate((where) => [...document.querySelectorAll(where)].filter((b) => b.getClientRects().length && !(b.getAttribute('aria-label') || b.textContent.trim())).map((b) => `${b.tagName}.${b.className}`), where);
const card = (id) => `#pg-arcade .arccard[data-id="${id}"]`;
const saved = () => page.evaluate(() => new Promise((resolve) => {
  const r = indexedDB.open('ghosty-arcade-saves');
  r.onsuccess = () => {
    try {
      // the saves store (engines/saves.ts): one object store, each file under '<game>/<name>'
      const g = r.result.transaction('files').objectStore('files').get('test-flash/changes.zip');
      g.onsuccess = () => resolve(g.result ? [...g.result] : null);
      g.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  };
  r.onerror = () => resolve(null);
}));
// SAVE.DAT's one byte in the saved bundle (a stored ZIP: the byte after its local header)
const visits = (bytes) => {
  if (!bytes) return null;
  const b = Buffer.from(bytes);
  for (let p = 0; p + 30 < b.length && b.readUInt32LE(p) === 0x04034b50;) {
    const n = b.readUInt16LE(p + 26);
    const x = b.readUInt16LE(p + 28);
    const size = b.readUInt32LE(p + 18);
    const name = b.subarray(p + 30, p + 30 + n).toString();
    if (/SAVE\.DAT$/i.test(name)) return b[p + 30 + n + x];
    p += 30 + n + x + size;
  }
  return null;
};

await boot();
// ---------- the tab opens from the deck, and from #arcade
await openScreen(page, 'arcade');
await until(() => location.hash === '#arcade' && !!document.querySelector('#pg-arcade .arccard'), 15000, 'the deck\'s ARCADE card did not open the arcade');
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(400);
await page.evaluate(() => (location.hash = 'arcade'));
await until(() => !!document.querySelector('#pg-arcade .arccard') && getComputedStyle(document.getElementById('pg-arcade')).display !== 'none', 10000, '#arcade did not open the arcade');

// ---------- the shelf: every game with its size on GET (nothing is on this phone yet); the games made by us: PLAY
const MADE = ['block-world', 'runner', 'kart-racer', 'hopper', 'arena'];
const shelf = await page.evaluate(() => [...document.querySelectorAll('#pg-arcade .arccard:not(.arcpack)')].map((c) => ({ id: c.dataset.id, title: c.querySelector('.arctitle')?.textContent ?? '', act: c.querySelector('.arcact')?.textContent ?? '', line: c.querySelector('.arcline')?.textContent ?? '', ghosty: c.querySelector('.arcghost')?.textContent ?? '' })));
if (shelf.length < 2) problems.push(`the shelf has ${shelf.length} games`);
for (const g of shelf) {
  if (MADE.includes(g.id) ? g.act !== 'PLAY' : !/^GET · \d+(\.\d)? (MB|KB)$/.test(g.act)) problems.push(`${g.id}: its button reads "${g.act}"`);
  if (!g.line || !/^Ghosty /.test(g.ghosty)) problems.push(`${g.id}: no line or no line of Ghosty's`);
}
if (!shelf.some((g) => g.id === 'test-flash')) problems.push('the fixture is not on the shelf');
// ---------- THE FREE LEVELS: a dozen packs for DOOM, each with its author and its size on GET; the DeHackEd line where
// a pack ships one (this engine does not read it)
const packs = await page.evaluate(() => [...document.querySelectorAll('#pg-arcade .arcpack')].map((c) => ({ id: c.dataset.level, by: c.querySelector('.arcby')?.textContent ?? '', act: c.querySelector('.arcact')?.textContent ?? '', over: c.querySelector('.arcover')?.textContent ?? '', deh: !!c.querySelector('.arcdeh') })));
const realPacks = packs.filter((p) => p.id !== PACK.id);
if (realPacks.length !== 12) problems.push(`THE FREE LEVELS lists ${realPacks.length} packs, not a dozen`);
for (const p of packs) {
  if (!/^GET · \d+(\.\d)? (MB|KB)$/.test(p.act)) problems.push(`level pack ${p.id}: its button reads "${p.act}"`);
  if (!/^by \S/.test(p.by) || !/^Plays over Freedoom: Phase [12]\.$/.test(p.over)) problems.push(`level pack ${p.id}: its card says "${p.by}" / "${p.over}"`);
}
const dehs = realPacks.filter((p) => p.deh).map((p) => p.id).sort().join();
if (dehs !== '1klinecp,btsx1,d2twid,dtwid,intercep') problems.push(`the packs saying their DeHackEd patch is not read: ${dehs}`);
await page.screenshot({ path: `${out}/arcade-shelf-440.png` });
let wide = await sideways('#pg-arcade .arccard, #pg-arcade .arcact');
if (wide.page || wide.over.length) problems.push(`the shelf sticks out sideways at 440 px: ${wide.over.join(', ')}`);

// ---------- GET on mobile data waits, with its line; on Wi-Fi it goes on
await page.click(`${card('test-flash')} .arcact`);
await until((s) => /mobile data/i.test(document.querySelector(s)?.textContent ?? ''), 5000, 'GET on mobile data did not say it waits for Wi-Fi', `${card('test-flash')} .arcstatus`);
await page.waitForTimeout(1500);
const waiting = await page.evaluate((s) => ({ act: document.querySelector(`${s} .arcact`)?.textContent, fetched: performance.getEntriesByType('resource').some((r) => r.name.includes('ghosty-test-fixture')) }), card('test-flash'));
if (waiting.act !== 'STOP') problems.push(`while waiting for Wi-Fi the button reads "${waiting.act}"`);
if (asked.length || waiting.fetched) problems.push('GET fetched on mobile data');
await page.screenshot({ path: `${out}/arcade-waits-440.png` });
await page.evaluate(() => {
  window.__net.type = 'wifi';
  window.__net.dispatchEvent(new Event('change'));
});
await until((s) => document.querySelector(s)?.textContent === 'PLAY', 15000, 'GET did not finish on Wi-Fi', `${card('test-flash')} .arcact`);
if (asked.length !== 1) problems.push(`GET asked the Archive ${asked.length} times: ${asked.join(', ')}`);

// ---------- PLAY: the player, frames, the touch layer
await page.click(`${card('test-flash')} .arcact`);
await until(() => !!document.querySelector('.arcplayer') && (window.__ghosty?.arcade?.stats?.frames ?? 0) > 20, 30000, 'PLAY did not start the game (no frames)');
const snap = () => page.evaluate(() => document.querySelector('.arcplayer canvas').toDataURL());
const s1 = await snap();
await page.waitForTimeout(400);
const s2 = await snap();
if (s1 === s2) problems.push('two canvas snapshots are the same (no frames render)');
const layer = await page.evaluate(() => ({
  touch: !!document.querySelector('.arcplayer .arctouch')?.getClientRects().length,
  stick: !!document.querySelector('.arcplayer .arcstick')?.getClientRects().length,
  buttons: [...document.querySelectorAll('.arcplayer .arcbtn')].map((b) => b.textContent),
  keys: [...document.querySelectorAll('.arcplayer .arckey')].map((b) => b.textContent),
  pause: !!document.querySelector('.arcplayer .arcpause')?.getClientRects().length,
  loading: !!document.querySelector('.arcplayer .arcloading')?.getClientRects().length,
  size: [document.querySelector('.arcplayer canvas').width, document.querySelector('.arcplayer canvas').height],
}));
if (!layer.touch || !layer.stick || !layer.pause) problems.push(`the touch layer is not all there: ${JSON.stringify(layer)}`);
if (layer.buttons.join() !== 'FIRE,USE' || !layer.keys.includes('ESC') || !layer.keys.includes('ENTER')) problems.push(`the buttons read ${layer.buttons.join(', ')}; the keys ${layer.keys.join(', ')}`);
if (layer.loading) problems.push('the loading line stayed up once the game played');
if (layer.size.join('x') !== '320x200') problems.push(`the picture is ${layer.size.join('x')}, not the program's 320x200`);
// the stick and a button reach the shared Intent the engine reads
const st = await page.locator('.arcplayer .arcstick').boundingBox();
await page.dispatchEvent('.arcplayer .arcstick', 'pointerdown', { pointerId: 7, clientX: st.x + 80, clientY: st.y + 200, isPrimary: true, pointerType: 'touch' });
await page.dispatchEvent('.arcplayer .arcstick', 'pointermove', { pointerId: 7, clientX: st.x + 80, clientY: st.y + 140, isPrimary: true, pointerType: 'touch' });
await page.dispatchEvent('.arcplayer .arcbtn[data-act="fire"]', 'pointerdown', { pointerId: 8, isPrimary: false, pointerType: 'touch' });
await page.waitForTimeout(100);
const held = await page.evaluate(() => ({ y: window.__ghosty.arcade.intent?.moveY, held: [...(window.__ghosty.arcade.intent?.held ?? [])] }));
if (!(held.y > 0.9) || !held.held.includes('fire')) problems.push(`the stick and FIRE did not reach the game: ${JSON.stringify(held)}`);
await page.dispatchEvent('.arcplayer .arcstick', 'pointerup', { pointerId: 7, pointerType: 'touch' });
await page.dispatchEvent('.arcplayer .arcbtn[data-act="fire"]', 'pointerup', { pointerId: 8, pointerType: 'touch' });
await page.screenshot({ path: `${out}/arcade-player-440.png` });
wide = await sideways('.arcplayer .arcscreen, .arcplayer .arcbtn, .arcplayer .arckey, .arcplayer .arcpause');
if (wide.page || wide.over.length) problems.push(`the player sticks out sideways at 440 px: ${wide.over.join(', ')}`);

// ---------- PAUSE → RESUME · QUIT · SOUND · CONTROLS
await page.click('.arcplayer .arcpause');
await until(() => !document.querySelector('.arcplayer .arcmenu')?.hidden, 3000, 'PAUSE did not open its sheet');
const menu = await page.evaluate(() => [...document.querySelectorAll('.arcplayer .arcmenu button')].map((b) => b.textContent));
for (const w of ['RESUME', 'QUIT', 'SOUND', 'CONTROLS']) if (!menu.some((t) => t.startsWith(w))) problems.push(`PAUSE has no ${w}: ${menu.join(', ')}`);
const f1 = await page.evaluate(() => window.__ghosty.arcade.stats.frames);
await page.waitForTimeout(600);
const f2 = await page.evaluate(() => window.__ghosty.arcade.stats.frames);
if (f2 - f1 > 3) problems.push(`the game ran on behind PAUSE (${f2 - f1} frames)`);
const sound0 = await page.getAttribute('.arcplayer .arcmenu [role="switch"]', 'aria-checked');
await page.click('.arcplayer .arcmenu [role="switch"]');
const sound1 = await page.getAttribute('.arcplayer .arcmenu [role="switch"]', 'aria-checked');
if (sound0 === sound1) problems.push('SOUND did not switch');
await page.click('.arcplayer .arcmenu [role="switch"]');
await page.click('.arcplayer .arcmenu button[aria-expanded]');
const ctl = await page.evaluate(() => [...document.querySelectorAll('.arcplayer .arcmenu .arcctl li')].map((l) => l.textContent));
if (!ctl.some((l) => /FIRE — CTRL/.test(l)) || !ctl.some((l) => /controller/i.test(l))) problems.push(`CONTROLS says ${ctl.join(' | ')}`);
await page.screenshot({ path: `${out}/arcade-pause-440.png` });
const playerLabels = await unlabelled('.arcplayer button, .arcplayer [role="application"], .arcplayer input');
if (playerLabels.length) problems.push(`player controls without a VoiceOver label: ${playerLabels.join(', ')}`);
await page.click('.arcplayer .arcmenu button.quit');
await until(() => !document.querySelector('.arcplayer') && !window.__ghosty.arcade.playing, 15000, 'QUIT did not return to the shelf');
const score = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.arcade.scores') ?? '{}')['test-flash'] ?? null);
if (!score || !Number.isFinite(score.best) || !score.when) problems.push(`QUIT wrote no best score: ${JSON.stringify(score)}`);
const after = await page.evaluate((s) => ({ score: document.querySelector(`${s} .arcscore`)?.textContent ?? '', status: document.querySelector(`${s} .arcstatus`)?.textContent ?? '' }), card('test-flash'));
if (!/Longest sitting/.test(after.score) || !/Flashed\./.test(after.status)) problems.push(`after QUIT the card reads "${after.score}" / "${after.status}"`);
const first = visits(await saved());
if (first !== 1) problems.push(`the program's save file was not kept (SAVE.DAT reads ${first})`);

// ---------- its own save comes back after a reload
await page.evaluate(() => sessionStorage.setItem('arcnet', 'wifi'));
await page.reload();
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 }).catch(() => undefined);
await page.evaluate(() => (location.hash = 'arcade'));
await until((s) => document.querySelector(s)?.textContent === 'PLAY', 15000, 'after a reload the fixture was not still on this phone', `${card('test-flash')} .arcact`);
await page.click(`${card('test-flash')} .arcact`);
await until(() => (window.__ghosty?.arcade?.stats?.frames ?? 0) > 20, 30000, 'PLAY after a reload did not start');
await page.click('.arcplayer .arcpause');
await page.click('.arcplayer .arcmenu button.quit');
await until(() => !document.querySelector('.arcplayer'), 15000, 'the second QUIT did not return');
const second = visits(await saved());
if (second !== 2) problems.push(`after a reload the program did not find its save (SAVE.DAT reads ${second}, not 2)`);

// ---------- THE GAMES MADE BY US: the runner plays at once, full screen, its own overlay, its own QUIT
if (!MADE.every((id) => shelf.some((g) => g.id === id))) problems.push(`the games made by us are not on the shelf: ${shelf.map((g) => g.id).join(', ')}`);
else {
  await page.click(`${card('runner')} .arcact`);
  if (await until(() => !!document.querySelector('.arcplayer .g2ui .g2menu') && !!document.querySelector('.arcplayer canvas')?.width, 30000, 'THE RUNNER: PLAY did not open the game with its own menu')) {
    const view = await page.evaluate(() => {
      const c = document.querySelector('.arcplayer canvas').getBoundingClientRect();
      return { w: Math.round(c.width), h: Math.round(c.height), W: innerWidth, H: innerHeight, ours: ['.arcstick', '.arclook', '.arcbtn', '.arckey', '.arcpause', '.arcmenu'].filter((s) => document.querySelector(`.arcplayer ${s}`)), menu: [...document.querySelectorAll('.arcplayer .g2menu .g2btns button')].map((b) => b.textContent) };
    });
    if (view.w !== view.W || view.h < view.H - 60) problems.push(`THE RUNNER: its canvas is ${view.w} × ${view.h} on a ${view.W} × ${view.H} screen (not full screen)`);
    if (view.ours.length) problems.push(`THE RUNNER: the player's own controls over a game that draws its own: ${view.ours.join(', ')}`);
    await page.screenshot({ path: `${out}/arcade-runner-440.png` });
    // its own QUIT (the game's title menu) ends it: back to the shelf, the picture let go
    await page.locator('.arcplayer .g2menu .g2btns button', { hasText: 'QUIT' }).click();
    await until(() => !document.querySelector('.arcplayer') && !window.__ghosty.arcade.playing, 15000, "THE RUNNER: its own QUIT did not return to the shelf");
    const after = await page.evaluate(() => ({ scores: Object.keys(JSON.parse(localStorage.getItem('ghosty.arcade.scores') ?? '{}')).filter((k) => k.startsWith('runner')), canvases: document.querySelectorAll('canvas.arccanvas').length }));
    if (after.scores.length || after.canvases) problems.push(`THE RUNNER: after its QUIT, scores ${after.scores.join(', ') || 'none'}; ${after.canvases} game canvas(es) left`);
  }
}

// ---------- THE NATIVE ENGINES with the real free data: DOOM, Freedoom Phase 1, Quake
const DATA = new URL('./fixtures/engines/data/', import.meta.url);
const REAL = {
  'https://archive.org/cors/doom19s_202607/doom19s.zip': 'doom19s.zip',
  'https://archive.org/cors/freedoom-0.13.0/freedoom-0.13.0.zip': 'freedoom-0.13.0.zip',
  'https://archive.org/cors/msdos_Quake106_shareware/msdos_Quake106_shareware.zip': 'msdos_Quake106_shareware.zip',
};
const realMissing = Object.values(REAL).filter((f) => !existsSync(new URL(f, DATA)));
const numbers = [];
if (realMissing.length) {
  console.log(`arcade: the native engines' checks skipped: the free game data is not here (${realMissing.join(', ')}). Fetch it once with: sh tests/fixtures/engines/fetch.sh`);
} else {
  for (const [url, file] of Object.entries(REAL)) served.set(url, new URL(file, DATA));
  const probe = () => page.evaluate(() => window.__ghosty.arcade.probe?.() ?? null);
  // a fingerprint of the whole picture, read in the frame the engine drew it (a WebGL canvas keeps no copy after)
  const fingerprint = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => {
    const c = document.querySelector('.arcplayer canvas');
    if (!c || !c.width) return resolve('');
    const small = document.createElement('canvas');
    small.width = 96;
    small.height = 72;
    const g = small.getContext('2d', { willReadFrequently: true });
    g.drawImage(c, 0, 0, 96, 72);
    const px = g.getImageData(0, 0, 96, 72).data;
    let a = 2166136261;
    for (let i = 0; i < px.length; i++) a = Math.imul(a ^ px[i], 16777619);
    resolve((a >>> 0).toString(16));
  })));
  /** A touch button (or small key) held for a moment and for at least three of the engine's frames (a busy machine can
   *  stall a frame longer than the moment), then let go. */
  const press = async (act, ms = 250) => {
    const sel = `.arcplayer [data-act="${act}"]`;
    const f0 = (await probe())?.frames ?? 0;
    await page.dispatchEvent(sel, 'pointerdown', { pointerId: 21, isPrimary: false, pointerType: 'touch' });
    await page.waitForTimeout(ms);
    await page.waitForFunction((f) => (window.__ghosty.arcade.probe?.()?.frames ?? 0) >= f + 3, f0, { timeout: 3000 }).catch(() => undefined);
    await page.dispatchEvent(sel, 'pointerup', { pointerId: 21, pointerType: 'touch' });
  };
  // a card by its id: a shelf game's, or a level pack's ('level:<id>'); the pack's scores are kept under its own id
  const sel = (id) => (id.startsWith('level:') ? `#pg-arcade .arcpack[data-level="${id.slice(6)}"]` : card(id));
  const scoreId = (id) => id.replace(/^level:/, '');
  const getGame = async (id, tag) => {
    await page.click(`${sel(id)} .arcact`);
    return until((s) => document.querySelector(s)?.textContent === 'PLAY', 120000, `${tag}: GET did not finish`, `${sel(id)} .arcact`);
  };
  /** PLAY: the finger lands and stays a moment (the files are read meanwhile), then lifts: the engine starts in the tap. */
  const playNative = async (id, tag) => {
    await page.dispatchEvent(`${sel(id)} .arcact`, 'pointerdown', { pointerId: 30, isPrimary: true, pointerType: 'touch' });
    await page.waitForTimeout(2000);
    await page.click(`${sel(id)} .arcact`);
    if (!(await until(() => (window.__ghosty?.arcade?.probe?.()?.frames ?? 0) > 30, 60000, `${tag}: PLAY did not start its engine (no frames)`))) return false;
    const started = await page.evaluate(() => window.__ghosty.arcade.started);
    if (started !== 'tap') problems.push(`${tag}: the engine started ${started || 'nowhere'}, not inside PLAY's tap`);
    const cls = await page.evaluate(() => document.querySelector('.arcplayer .arcscreen')?.className ?? '');
    if (!cls.includes(id.startsWith('quake') ? 'quake' : 'doom')) problems.push(`${tag}: the picture's box is "${cls}"`);
    return true;
  };
  /** Frames render (two pictures 0.7 s apart differ); in a level, the stick walks the player and a drag turns him. */
  const dist = (a, b) => (a && b ? Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) : 0);
  const plays = async (tag, inLevel) => {
    const st = await page.locator('.arcplayer .arcstick').boundingBox();
    if (inLevel) {
      await page.dispatchEvent('.arcplayer .arcstick', 'pointerdown', { pointerId: 17, clientX: st.x + 80, clientY: st.y + 200, isPrimary: true, pointerType: 'touch' });
      await page.dispatchEvent('.arcplayer .arcstick', 'pointermove', { pointerId: 17, clientX: st.x + 80, clientY: st.y + 140, isPrimary: true, pointerType: 'touch' });
    }
    const p0 = await probe();
    const a = await fingerprint();
    await page.waitForTimeout(700);
    const b = await fingerprint();
    const p1 = await probe();
    if (inLevel) await page.dispatchEvent('.arcplayer .arcstick', 'pointerup', { pointerId: 17, pointerType: 'touch' });
    if (!a || a === b) problems.push(`${tag}: two pictures 0.7 s apart are the same (no frames render)`);
    if (!inLevel) return;
    if (!(dist(p0.pos, p1.pos) > 8)) problems.push(`${tag}: the stick held forward walked the player ${dist(p0.pos, p1.pos).toFixed(1)} units`);
    // a drag of 100 points on the right half turns him about 23° to the right (the look adds up in the one Intent)
    await page.waitForTimeout(300);
    const a0 = (await probe()).angle;
    const lz = await page.locator('.arcplayer .arclook').boundingBox();
    const y = st.y + 120;
    await page.dispatchEvent('.arcplayer .arclook', 'pointerdown', { pointerId: 18, clientX: lz.x + 20, clientY: y, isPrimary: false, pointerType: 'touch' });
    await page.dispatchEvent('.arcplayer .arclook', 'pointermove', { pointerId: 18, clientX: lz.x + 70, clientY: y, isPrimary: false, pointerType: 'touch' });
    await page.dispatchEvent('.arcplayer .arclook', 'pointermove', { pointerId: 18, clientX: lz.x + 120, clientY: y, isPrimary: false, pointerType: 'touch' });
    await page.dispatchEvent('.arcplayer .arclook', 'pointerup', { pointerId: 18, pointerType: 'touch' });
    await page.waitForTimeout(500);
    const a1 = (await probe()).angle;
    const turned = ((((a0 - a1) % 360) + 540) % 360) - 180;
    if (Math.abs(turned - 23) > 3) problems.push(`${tag}: a 100-point drag turned the player ${turned.toFixed(1)}° (want 23°)`);
  };
  /** FIRE alone, from the title: the menu, NEW GAME, the episode, the skill, then the first level. */
  const fireToLevel = async (tag, levelName) => {
    for (let i = 0; i < 6 && (await probe())?.level !== levelName; i++) {
      await press('fire');
      await page.waitForTimeout(450);
    }
    return until((n) => window.__ghosty.arcade.probe()?.level === n, 10000, `${tag}: FIRE from the title did not reach ${levelName} (${JSON.stringify(await probe())})`, levelName);
  };
  /** PAUSE: the sheet, its one fps line and GAME MENU (said back for the report). */
  const pauseSheet = async (tag) => {
    await page.click('.arcplayer .arcpause');
    await until(() => !document.querySelector('.arcplayer .arcmenu')?.hidden, 3000, `${tag}: PAUSE did not open its sheet`);
    const sheet = await page.evaluate(() => ({ fps: document.querySelector('.arcplayer .arcfps')?.textContent ?? '', buttons: [...document.querySelectorAll('.arcplayer .arcmenu button')].map((b) => b.textContent) }));
    if (!/^\d+ fps\b/.test(sheet.fps)) problems.push(`${tag}: PAUSE's fps line reads "${sheet.fps}"`);
    for (const w of ['RESUME', 'GAME MENU', 'QUIT', 'SOUND', 'CONTROLS']) if (!sheet.buttons.some((t) => t.startsWith(w))) problems.push(`${tag}: PAUSE has no ${w}: ${sheet.buttons.join(', ')}`);
    return sheet.fps;
  };
  /** QUIT from PAUSE: back to the shelf, the picture let go, the longest sitting written and said on the card. */
  const quitNative = async (id, tag) => {
    await page.click('.arcplayer .arcmenu button.quit');
    await until(() => !document.querySelector('.arcplayer') && !window.__ghosty.arcade.playing && !document.querySelector('canvas.arccanvas'), 15000, `${tag}: QUIT did not return to the shelf and let the picture go`);
    const sit = await page.evaluate((k) => JSON.parse(localStorage.getItem('ghosty.arcade.scores') ?? '{}')[k] ?? null, `${scoreId(id)}/sitting`);
    if (!sit || !(sit.best > 0) || !sit.when) problems.push(`${tag}: QUIT wrote no longest sitting: ${JSON.stringify(sit)}`);
    const words = await page.evaluate((s) => document.querySelector(`${s} .arcscore`)?.textContent ?? '', sel(id));
    if (!/sitting \d+ (s|min)/i.test(words)) problems.push(`${tag}: after QUIT the card's score reads "${words}"`);
  };

  // DOOM, the free episode, on doomgeneric
  if (await getGame('doom-shareware', 'DOOM')) {
    if (await playNative('doom-shareware', 'DOOM')) {
      const title = (await probe())?.level ?? null;
      if (title !== null) problems.push(`DOOM: no title screen first (${title})`);
      if (await fireToLevel('DOOM', 'E1M1')) {
        await page.waitForTimeout(1500); // past the screen melt
        await plays('DOOM', true);
        await page.waitForTimeout(2000); // whole seconds of play counted for the fps
        await page.screenshot({ path: `${out}/arcade-doom-440.png` });
        const p = await probe();
        const fps = await pauseSheet('DOOM');
        // GAME MENU opens DOOM's own menu over the game; the MENU key closes it again
        await page.click('.arcplayer .arcmenu .gamemenu');
        await until(() => window.__ghosty.arcade.probe()?.menu === true, 3000, "DOOM: GAME MENU did not open DOOM's own menu");
        await page.waitForTimeout(400);
        await press('menu');
        if (!(await until(() => window.__ghosty.arcade.probe()?.menu === false, 3000, "DOOM: the MENU key did not close DOOM's menu"))) problems.push(`DOOM: then ${JSON.stringify(await page.evaluate(() => ({ probe: window.__ghosty.arcade.probe(), held: [...window.__ghosty.arcade.intent.held], keys: [...document.querySelectorAll('.arcplayer .arckey')].map((k) => `${k.dataset.act}${k.classList.contains('on') ? '+' : ''}`) })))}`);
        await page.click('.arcplayer .arcpause');
        numbers.push(`DOOM E1M1: ${p.fps} fps (the engine's own work ${p.workMs} ms a frame), on screen ${p.loadMs} ms after start; PAUSE said "${fps}"`);
        await quitNative('doom-shareware', 'DOOM');
      }
    }
  }

  // Freedoom Phase 1: one GET for both phases
  const fdAsked = () => asked.filter((u) => u.includes('freedoom-0.13.0')).length;
  if (await getGame('freedoom', 'FREEDOOM')) {
    const phase2 = await page.evaluate((s) => document.querySelector(s)?.textContent ?? '', `${card('freedoom2')} .arcact`);
    if (phase2 !== 'PLAY' || fdAsked() !== 1) problems.push(`FREEDOOM: one GET did not fill Phase 2's card too (it reads "${phase2}"; the Archive asked ${fdAsked()} times)`);
    if (await playNative('freedoom', 'FREEDOOM')) {
      if (await fireToLevel('FREEDOOM', 'E1M1')) {
        await page.waitForTimeout(1500);
        await plays('FREEDOOM', true);
        await page.waitForTimeout(2000);
        await page.screenshot({ path: `${out}/arcade-freedoom-440.png` });
        const p = await probe();
        const fps = await pauseSheet('FREEDOOM');
        numbers.push(`Freedoom Phase 1 E1M1: ${p.fps} fps (work ${p.workMs} ms), on screen ${p.loadMs} ms after start; PAUSE said "${fps}"`);
        await quitNative('freedoom', 'FREEDOOM');
      }
    }
  }

  // a level pack over Freedoom Phase 2: GET (its own few bytes; Freedoom is here), then PLAY hands DOOM its Freedoom
  // phase and the pack's WAD (-file); FIRE from the title reaches MAP01
  if (await getGame('level:test-pack', 'LEVEL PACK')) {
    if (await playNative('level:test-pack', 'LEVEL PACK')) {
      const args = await page.evaluate(() => window.__ghosty.arcade.args.join(' '));
      if (args !== '-iwad freedoom2.wad -file testmap.wad') problems.push(`LEVEL PACK: DOOM was given "${args}"`);
      if (await fireToLevel('LEVEL PACK', 'MAP01')) {
        await page.waitForTimeout(1500);
        await plays('LEVEL PACK', true);
        const fps = await pauseSheet('LEVEL PACK');
        numbers.push(`A level pack over Freedoom Phase 2, MAP01: PAUSE said "${fps}"`);
        await quitNative('level:test-pack', 'LEVEL PACK');
      }
    }
  }

  // Quake: it starts and renders (its demos), PAUSE as the others, QUIT
  if (await getGame('quake-shareware', 'QUAKE')) {
    if (await playNative('quake-shareware', 'QUAKE')) {
      await page.waitForTimeout(2000);
      await plays('QUAKE', false);
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${out}/arcade-quake-440.png` });
      const p = await probe();
      const size = await page.evaluate(() => { const c = document.querySelector('.arcplayer canvas'); return `${c.width} × ${c.height}`; });
      const fps = await pauseSheet('QUAKE');
      numbers.push(`Quake (its demo): ${p.fps} fps on this machine's software GPU at ${size} (the engine's own work ${p.workMs} ms a frame); PAUSE said "${fps}"`);
      await quitNative('quake-shareware', 'QUAKE');
    }
  }
}

// ---------- ⋯ → DELETE in one tap; labels; 390 × 844
await page.click(`${card('test-flash')} .arcmore`);
const shelfLabels = await unlabelled('#pg-arcade button');
if (shelfLabels.length) problems.push(`shelf controls without a VoiceOver label: ${shelfLabels.join(', ')}`);
await page.click(`${card('test-flash')} .arcdel`);
await until((s) => /^GET · /.test(document.querySelector(s)?.textContent ?? ''), 5000, 'DELETE did not take the game off this phone', `${card('test-flash')} .arcact`);
// ---------- the Archive out of reach (his network's filter: the phone's fetch of archive.org gets no answer): GET asks this
// site for the same file under /api/arcade/, with his key; the Worker has never heard of the fixture's item, so it answers
// 404 (not 401: the key was let in) and the reason names both mirrors
{
  const own = [];
  const onRequest = (r) => r.url().includes('/api/arcade/') && own.push({ url: r.url(), key: r.headers()['x-ghosty-key'] ?? '' });
  const blocked = (route) => route.abort('blockedbyclient');
  page.on('request', onRequest);
  await page.route('https://archive.org/**', blocked);
  await page.click(`${card('test-flash')} .arcact`);
  await until((s) => /Could not get it/.test(document.querySelector(s)?.textContent ?? ''), 15000, 'GET with the Archive out of reach did not give its reason', `${card('test-flash')} .arcstatus`);
  const said = await page.textContent(`${card('test-flash')} .arcstatus`);
  if (!/^Could not get it: No mirror gave the right file \(archive\.org: [^;]+; this site: answered 404\)\.$/.test(said ?? '')) problems.push(`with the Archive out of reach, GET said "${said}"`);
  if (own.length !== 1 || own[0].url !== `${base}/api/arcade/ghosty-test-fixture/flash.zip` || own[0].key !== 'preview-owner-key-0123456789') problems.push(`this site's copy was asked as ${JSON.stringify(own)}`);
  page.off('request', onRequest);
  await page.unroute('https://archive.org/**', blocked);
}
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
wide = await sideways('#pg-arcade .arccard, #pg-arcade .arcact, #pg-arcade .arcmore, #pg-arcade .arcdetails');
if (wide.page || wide.over.length) problems.push(`the shelf sticks out sideways at 390 px: ${wide.over.join(', ')}`);
await page.screenshot({ path: `${out}/arcade-shelf-390.png` });
const csp = await page.evaluate(() => window.__csp);
if (csp.length) problems.push(`the security policy blocked: ${csp.join(', ')}`);

await browser.close();
if (problems.length) {
  console.error(`arcade: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
if (numbers.length) console.log(numbers.join('\n'));
console.log(`arcade: ok (${shelf.length} games on the shelf; the fixture played, paused, quit, saved and came back after a reload${numbers.length ? `; ${numbers.length} native games played` : ''})`);
