// The ARCADE on the owner's iPhone 18 Pro Max (440 × 956): the tab opens from the systems deck and from #arcade; the
// shelf lists its games, each with its size on GET; GET on a (stubbed) mobile-data connection waits with its line and
// goes on once the phone is on Wi-Fi; with the Archive stubbed to serve a tiny valid fixture (tests/fixtures/arcade:
// FLASH.COM, a 131-byte DOS program written for these tests, public domain), PLAY opens the player on the real DOS
// engine, frames render (two canvas snapshots differ), the touch layer shows and its stick and buttons reach the game,
// PAUSE shows RESUME · QUIT · SOUND · CONTROLS, QUIT returns to the shelf and the best score is written; the program's
// own save file comes back after a reload (it counts its visits); DELETE takes the game off the phone in one tap;
// every control has a VoiceOver label; nothing sticks out sideways at 440 × 956 or 390 × 844; the page's security
// policy blocks nothing.
//   BASE=http://localhost:8855 node tests/arcade.spec.mjs tests/.shots
import { launch, webkitNoise, engine } from './browser.mjs';
import { PHONE, UK, openScreen } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
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
await page.addInitScript((fixture) => {
  window.__csp = [];
  document.addEventListener('securitypolicyviolation', (e) => window.__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  window.__ghostyArcadeShelf = [fixture];
  // the phone's connection, stubbed: mobile data until the spec says Wi-Fi
  const net = new EventTarget();
  net.type = sessionStorage.getItem('arcnet') ?? 'cellular';
  window.__net = net;
  Object.defineProperty(Navigator.prototype, 'connection', { configurable: true, get: () => window.__net });
}, FIXTURE);
// the Archive: the fixture only (no real game is ever fetched by a spec)
const asked = [];
await page.route('https://archive.org/**', (route) => {
  const u = route.request().url();
  asked.push(u);
  if (u === FIXTURE.data.url[0]) return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/zip' }, body: pkg });
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
      const g = r.result.transaction('saves').objectStore('saves').get(['test-flash', 'changes.zip']);
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

// ---------- the shelf: every game with its size on GET (nothing is on this phone yet)
const shelf = await page.evaluate(() => [...document.querySelectorAll('#pg-arcade .arccard')].map((c) => ({ id: c.dataset.id, title: c.querySelector('.arctitle')?.textContent ?? '', act: c.querySelector('.arcact')?.textContent ?? '', line: c.querySelector('.arcline')?.textContent ?? '', ghosty: c.querySelector('.arcghost')?.textContent ?? '' })));
if (shelf.length < 2) problems.push(`the shelf has ${shelf.length} games`);
for (const g of shelf) {
  if (!/^GET · \d+(\.\d)? (MB|KB)$/.test(g.act)) problems.push(`${g.id}: its button reads "${g.act}"`);
  if (!g.line || !/^Ghosty /.test(g.ghosty)) problems.push(`${g.id}: no line or no line of Ghosty's`);
}
if (!shelf.some((g) => g.id === 'test-flash')) problems.push('the fixture is not on the shelf');
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

// ---------- ⋯ → DELETE in one tap; labels; 390 × 844
await page.click(`${card('test-flash')} .arcmore`);
const shelfLabels = await unlabelled('#pg-arcade button');
if (shelfLabels.length) problems.push(`shelf controls without a VoiceOver label: ${shelfLabels.join(', ')}`);
await page.click(`${card('test-flash')} .arcdel`);
await until((s) => /^GET · /.test(document.querySelector(s)?.textContent ?? ''), 5000, 'DELETE did not take the game off this phone', `${card('test-flash')} .arcact`);
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
console.log(`arcade: ok (${shelf.length} games on the shelf; the fixture played, paused, quit, saved and came back after a reload)`);
