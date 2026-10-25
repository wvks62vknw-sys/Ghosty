// The RADIO tab (features/radio, the player in assistant/media.ts) at the owner's 440 × 956, once at 1280 × 800.
// Audio cannot be heard here, so this checks the player's state, the words and the controls: the station
// directory (radio-browser, through /api/proxy) and the streams are stood in with page.route. The spec's own
// stations are all named "Spec …"; the favourite it adds is removed and what it plays is stopped.
//   BASE=http://localhost:8788 node tests/radio.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const problems = [];
const check = (ok, msg) => ok || problems.push(msg);

// A few seconds of tone as a WAV: what a stream sends, as far as the audio element can tell.
function wav(sec = 30, rate = 8000) {
  const n = sec * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 9) * 2000), 44 + i * 2);
  return b;
}
const TONE = wav();
const UKL = 'The United Kingdom Of Great Britain And Northern Ireland';
const S = 'https://spec-stream.test-radio.example';
// The directory's answer, as radio-browser gives it (most listened to first).
const DIRECTORY = [
  // the BBC lists its national stations with http:// addresses; the same stream is served on https
  { name: 'Spec Radio Four (128k)', url_resolved: 'http://as-hls-ww-live.akamaized.net/pool_spec/live/ww/spec_four/spec_four.m3u8', country: UKL, countrycode: 'GB', tags: 'news,talk,drama', codec: 'UNKNOWN', bitrate: 0 },
  { name: 'Spec Radio Four', url_resolved: `${S}/four-copy`, country: UKL, countrycode: 'GB', tags: 'news', codec: 'MP3', bitrate: 128 },
  { name: 'Spec News HD (720P)', url_resolved: `${S}/tv`, country: UKL, countrycode: 'GB', tags: 'news', codec: 'UNKNOWN', bitrate: 0 },
  { name: 'Spec Paris Jazz', url_resolved: `${S}/paris`, country: 'France', countrycode: 'FR', tags: 'jazz', codec: 'MP3', bitrate: 128 },
  { name: 'Spec Plain FM', url_resolved: `${S}/plain`, country: UKL, countrycode: 'GB', tags: 'news,talk', codec: 'MP3', bitrate: 128 },
  { name: 'Spec Hang FM', url_resolved: `${S}/hang`, country: UKL, countrycode: 'GB', tags: 'news', codec: 'MP3', bitrate: 64 },
  { name: 'Spec Insecure FM', url_resolved: 'http://insecure.example/stream', country: UKL, countrycode: 'GB', tags: 'news', codec: 'MP3', bitrate: 64 },
];

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--autoplay-policy=no-user-gesture-required'] });

/** A context on the Radio tab with the directory and the streams stood in. `fixedVolume`: as an iPhone, which ignores a page's volume. */
async function open(viewport, { fixedVolume = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK });
  await ctx.addInitScript(({ fixedVolume }) => {
    // keep hold of the player's audio element (it is not in the page) and of the lock screen's handlers
    window.__specAudio = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (!window.__specAudio.includes(this)) window.__specAudio.push(this); return play.call(this); };
    window.__specActions = {};
    if (navigator.mediaSession) {
      const set = navigator.mediaSession.setActionHandler.bind(navigator.mediaSession);
      navigator.mediaSession.setActionHandler = (a, fn) => { window.__specActions[a] = fn; return set(a, fn); };
    }
    if (fixedVolume) Object.defineProperty(HTMLMediaElement.prototype, 'volume', { get: () => 1, set: () => undefined, configurable: true });
  }, { fixedVolume });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
  await page.route(/\/api\/proxy\?.*radio-browser/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(DIRECTORY) }));
  await page.route(/^https:\/\/(spec-stream\.test-radio\.example|as-hls-ww-live\.akamaized\.net\/pool_spec)\//, (r) => {
    if (/\/hang$/.test(r.request().url())) return; // a station that never answers
    return r.fulfill({ status: 200, contentType: 'audio/wav', body: TONE });
  });
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'radio'));
  await page.waitForSelector('#pg-radio .pn.stations .rw.station', { timeout: 15000 });
  return { ctx, page };
}
const rowOf = (page, name) => page.locator('#pg-radio .pn.stations .rw.station').filter({ has: page.locator('b', { hasText: new RegExp(`^${name}$`) }) });
const hero = (page) => page.$eval('#pg-radio .pn.nowp', (p) => ({ kicker: p.querySelector('.nptx small')?.textContent ?? '', name: p.querySelector('.nptx b')?.textContent ?? '', note: p.querySelector('.note.bad')?.textContent ?? '', buttons: [...p.querySelectorAll('.keyrow button')].map((b) => b.textContent.trim()), slider: !!p.querySelector('input[type=range]') }));
const waitHero = (page, re, ms = 5000) => page.waitForFunction((src) => new RegExp(src).test(document.querySelector('#pg-radio .pn.nowp .nptx small')?.textContent ?? ''), re.source, { timeout: ms }).then(() => true, () => false);
const session = (page) => page.evaluate(() => ({ title: navigator.mediaSession?.metadata?.title ?? null, state: navigator.mediaSession?.playbackState ?? null, actions: Object.keys(window.__specActions).sort().join(',') }));
// what shows: a label drawn from data-label (the empty state's words) in place of the text under it
const shown = (page, sel) => page.$eval(sel, (b) => [...b.querySelectorAll('*')].filter((e) => e.dataset.label || !e.children.length).map((e) => e.dataset.label ?? e.textContent).join(' '));
// a tap that cannot be made is a problem, not the end of the run
const tap = (loc, what) => loc.click({ timeout: 5000 }).then(() => true, () => (problems.push(`could not tap ${what}`), false));
const toasts = (page) => page.evaluate(() => document.getElementById('toasts')?.textContent ?? '');

// ---------- the phone ----------
{
  const { ctx, page } = await open(PHONE);
  await page.screenshot({ path: `${out}/radio-phone.png` });

  // 1. the directory in plain words: the BBC's http-listed stream offered (made https), one row a station, no TV channel, UK first
  const rows = await page.$$eval('#pg-radio .pn.stations .rw.station', (rs) => rs.map((r) => ({ name: r.querySelector('b').textContent, info: r.querySelector('.note')?.textContent ?? '' })));
  const mine = rows.filter((r) => r.name.startsWith('Spec '));
  const four = mine.filter((r) => /^Spec Radio Four/.test(r.name));
  check(four.length === 1 && four[0].name === 'Spec Radio Four', `the BBC's station (listed with an http:// address, served on https too) should be one row "Spec Radio Four": ${JSON.stringify(four)}`);
  check(!mine.some((r) => /720P|Insecure/i.test(r.name)), `a TV channel or an http-only stream was listed: ${mine.map((r) => r.name).join(', ')}`);
  check(mine.every((r) => !r.info.includes('United Kingdom Of')) && /^UK · News, talk/.test(mine.find((r) => r.name === 'Spec Plain FM')?.info ?? ''), `station lines should read "UK · News, talk · 128 kbps": ${mine.map((r) => r.info).join(' | ')}`);
  const paris = mine.findIndex((r) => r.name === 'Spec Paris Jazz');
  check(paris === mine.length - 1, `UK stations should come before the rest: ${mine.map((r) => r.name).join(', ')}`);

  // 2. every control 44 pt (measured once the screen's entry animation has finished: mid-way, every control reads a fraction short)
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  const small = await page.$$eval('#pg-radio :is(.keyrow button, .rw.station .k, .rw.station .n, input)', (es) => es.filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.width < 44 || r.height < 44) && e.type !== 'range'; }).map((e) => `${(e.getAttribute('aria-label') ?? e.textContent).trim().slice(0, 24)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`));
  check(!small.length, `controls under 44 pt: ${small.slice(0, 6).join(', ')}${small.length > 6 ? ` … (${small.length})` : ''}`);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the page scrolls sideways at 440');

  // 3. one tap plays: the row's button becomes its stop, the hero says since when, the lock screen has the station
  await tap(rowOf(page, 'Spec Radio Four').locator('.n'), 'Spec Radio Four ▶/■');
  await waitHero(page, /^On air/);
  const src = await page.evaluate(() => window.__specAudio.at(-1)?.src ?? '');
  check(src.startsWith('https://as-hls-ww-live.akamaized.net/pool_spec/'), `the BBC's own stream (listed as http://, served on https) should be the one played: ${src}`);
  await tap(rowOf(page, 'Spec Plain FM').locator('.n'), 'Spec Plain FM ▶/■');
  check(await waitHero(page, /^On air · since \d\d:\d\d$/), `after a tap the hero should say "On air · since 14:02": ${JSON.stringify(await hero(page))}`);
  const btn = await rowOf(page, 'Spec Plain FM').locator('.n').evaluate((e) => `${e.textContent}|${e.getAttribute('aria-label')}`, null, { timeout: 5000 }).catch(() => '');
  check(btn === '■|Stop Spec Plain FM', `the playing row's button should be its stop: ${btn}`);
  const ms = await session(page);
  check(ms.title === 'Spec Plain FM' && ms.state === 'playing' && /pause/.test(ms.actions) && /play/.test(ms.actions) && /stop/.test(ms.actions), `the lock screen should show the station with play, pause and stop: ${JSON.stringify(ms)}`);
  await page.screenshot({ path: `${out}/radio-phone-playing.png` });

  // 4. paused from the lock screen or AirPods: said here; play from there carries on
  await page.evaluate(() => window.__specAudio.at(-1).pause());
  check(await waitHero(page, /^Paused$/), `a pause from the lock screen should show as Paused: ${JSON.stringify(await hero(page))}`);
  check((await session(page)).state === 'paused', 'the lock screen should know it is paused');
  await page.evaluate(() => window.__specActions.play?.());
  check(await waitHero(page, /^On air/), `PLAY from the lock screen should play again: ${JSON.stringify(await hero(page))}`);

  // 5. the hub card agrees with the tab
  await page.evaluate(() => (location.hash = 'area-plan'));
  await page.waitForTimeout(900);
  const card = await page.$eval('#pg-area-plan .hubtile[data-id="radio"]', (e) => e.textContent).catch(() => '');
  check(/LIVE/i.test(card) && card.includes('Spec Plain FM'), `the Plan hub's Radio card should say LIVE and the station: ${card}`);
  await page.evaluate(() => (location.hash = 'radio'));
  await page.waitForTimeout(500);

  // 6. one tap stops: the playing row's button
  await tap(rowOf(page, 'Spec Plain FM').locator('.n'), 'Spec Plain FM ▶/■');
  await page.waitForTimeout(400);
  const stopped = await hero(page);
  check(stopped.kicker === 'Last played' && stopped.name === 'Spec Plain FM' && stopped.buttons.some((b) => /PLAY/i.test(b)), `the playing row's button should stop it, leaving "Last played" with PLAY: ${JSON.stringify(stopped)}`);
  check(await page.evaluate(() => document.querySelector('.nowplaying')?.hidden !== false), 'the top bar still shows a station after stop');

  // 7. switching station while one is still connecting is not a failure of anything
  await tap(rowOf(page, 'Spec Hang FM').locator('.n'), 'Spec Hang FM ▶/■');
  await page.waitForTimeout(600);
  const tuning = await rowOf(page, 'Spec Hang FM').evaluate((r) => `${r.querySelector('.n').textContent}|${r.querySelector('.note')?.textContent ?? ''}`, null, { timeout: 5000 }).catch(() => '');
  check(/^■\|Connecting…/.test(tuning), `a station connecting should say so on its row, its button a stop: ${tuning}`);
  await tap(rowOf(page, 'Spec Plain FM').locator('.n'), 'Spec Plain FM ▶/■');
  check(await waitHero(page, /^On air/), `the station switched to should play: ${JSON.stringify(await hero(page))}`);
  await page.waitForTimeout(800);
  check(!/couldn.t start spec hang/i.test(await toasts(page)), `switching away from a station still connecting said it failed: ${await toasts(page)}`);
  check((await hero(page)).name === 'Spec Plain FM', 'the station switched to was replaced');

  // 8. a station that never answers says so by name (not "Tuning…" for ever)
  await tap(rowOf(page, 'Spec Hang FM').locator('.n'), 'Spec Hang FM ▶/■');
  check(await waitHero(page, /^Didn’t play$/, 20000), `a station that never answers should stop trying: ${JSON.stringify(await hero(page))}`);
  const hang = await hero(page);
  check(/Spec Hang FM isn’t answering/.test(hang.note) && hang.buttons.some((b) => /TRY AGAIN/i.test(b)), `it should say "Spec Hang FM isn’t answering" with TRY AGAIN: ${JSON.stringify(hang)}`);
  await page.screenshot({ path: `${out}/radio-phone-noanswer.png` });
  await tap(page.locator('#pg-radio .pn.nowp .keyrow button', { hasText: /stop/i }), 'STOP');

  // 9. what played last is there after a reload, one tap away
  await page.reload();
  await page.waitForSelector('#pg-radio .pn.nowp', { timeout: 20000 });
  await page.waitForTimeout(800);
  const after = await hero(page);
  check(after.kicker === 'Last played' && after.name === 'Spec Hang FM', `after a reload the hero should offer the last station: ${JSON.stringify(after)}`);

  // 10. favourites: add, remove with UNDO (back where it was), and the spec's own removed at the end
  await page.waitForSelector('#pg-radio .pn.stations .rw.station', { timeout: 15000 });
  await tap(rowOf(page, 'Spec Paris Jazz').locator('.k'), 'Spec Paris Jazz ☆');
  await tap(rowOf(page, 'Spec Plain FM').locator('.k'), 'Spec Plain FM ☆');
  const favs = () => page.$$eval('#pg-radio .pn.favs .rw.station b', (bs) => bs.map((b) => b.textContent).filter((t) => t.startsWith('Spec ')));
  check((await favs()).join() === 'Spec Plain FM,Spec Paris Jazz', `favourites after adding two: ${await favs()}`);
  await tap(page.locator('#pg-radio .pn.favs .rw.station').filter({ hasText: 'Spec Plain FM' }).locator('.k'), 'the favourite Spec Plain FM ★');
  const bar = page.locator('.undofloat:not([hidden])');
  const barText = await bar.textContent({ timeout: 2000 }).catch(() => '');
  check(/Removed Spec Plain FM/.test(barText), `removing a favourite should offer UNDO: "${barText}"`);
  if (barText) await bar.locator('button').click();
  await page.waitForTimeout(300);
  check((await favs()).join() === 'Spec Plain FM,Spec Paris Jazz', `UNDO should put the favourite back where it was: ${await favs()}`);
  await page.evaluate(() => localStorage.setItem('ghosty.radio.favs', JSON.stringify(JSON.parse(localStorage.getItem('ghosty.radio.favs') ?? '[]').filter((s) => !s.name.startsWith('Spec ')))));
  // away and back: the tab shows the favourites as they are now
  await page.evaluate(() => (location.hash = 'agenda'));
  await page.waitForTimeout(500);
  await page.evaluate(() => (location.hash = 'radio'));
  await page.waitForTimeout(500);

  // 11. offline: said, and nothing pretends to play
  await ctx.setOffline(true);
  await page.evaluate(() => dispatchEvent(new Event('offline')));
  await page.fill('#pg-radio input[aria-label="Search radio"]', 'jazz');
  await tap(page.locator('#pg-radio .pn.stations button', { hasText: /search/i }), 'SEARCH');
  await page.waitForTimeout(800);
  const offList = await shown(page, '#pg-radio .pn.stations .bd');
  check(/offline/i.test(offList), `searching offline should say the phone is offline: "${offList.slice(0, 120)}"`);
  // opened again while offline: the favourites are drawn afresh
  await page.evaluate(() => (location.hash = 'agenda'));
  await page.waitForTimeout(400);
  await page.evaluate(() => (location.hash = 'radio'));
  await page.waitForTimeout(400);
  const favWords = await shown(page, '#pg-radio .pn.favs .bd');
  check(/No favourites yet/.test(favWords) && !/offline/i.test(favWords), `favourites are kept on the phone, so offline is not their empty state: "${favWords}"`);
  await tap(page.locator('#pg-radio .pn.nowp .keyrow button', { hasText: /play|try again|retry/i }).first(), 'PLAY');
  await page.waitForTimeout(400);
  const off = await hero(page);
  check(/You’re offline, so Spec Hang FM can’t play/.test(off.note), `PLAY offline should say why by name: ${JSON.stringify(off)}`);
  await page.screenshot({ path: `${out}/radio-phone-offline.png` });
  await ctx.setOffline(false);
  await page.evaluate(() => dispatchEvent(new Event('online')));
  await page.evaluate(() => window.__ghosty.run('stop_audio', {}));

  // 12. nothing sideways at 390 either
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the page scrolls sideways at 390');
  await ctx.close();
}

// ---------- an iPhone ignores a page's volume: no slider that does nothing ----------
{
  const { ctx, page } = await open(PHONE, { fixedVolume: true });
  await tap(rowOf(page, 'Spec Plain FM').locator('.n'), 'Spec Plain FM ▶/■');
  await waitHero(page, /^On air/);
  const h = await hero(page);
  check(!h.slider && h.buttons.some((b) => /STOP/i.test(b)), `with the phone's own volume, no slider should show: ${JSON.stringify(h)}`);
  await page.evaluate(() => window.__ghosty.run('stop_audio', {}));
  await ctx.close();
}

// ---------- a laptop ----------
{
  const { ctx, page } = await open({ width: 1280, height: 800 });
  await page.waitForTimeout(500);
  check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'the page scrolls sideways at 1280');
  const words = await page.$eval('#pg-radio .pn.nowp', (p) => p.textContent);
  check(!/below/.test(words), `the hero points "below" though the stations sit beside it on a laptop: ${words}`);
  await page.screenshot({ path: `${out}/radio-desktop.png` });
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Radio run clean.');
process.exit(problems.length ? 1 : 0);
