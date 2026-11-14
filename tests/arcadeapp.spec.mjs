// THE ARCADE, console-class (docs/build-plan/apps/polish3.md), at 440 × 956 and 390 × 844:
//   a. A fresh phone: no CONTINUE PLAYING, THE TROPHY ROOM says nothing is earned yet; a fetchable game's page shows GET with its
//      size, no screenshots yet, how to play by touch, controller and keyboard, its licence and credit, and nothing is fetched by
//      looking; every key 44 pt, nothing sideways, no word cut, in all seven worlds and at BODY 21.
//   b. A phone that has played: CONTINUE PLAYING lists the games newest first with when, sittings and time; THE TROPHY ROOM counts
//      what is earned; a game's page shows its screenshots, its record and its five trophies; FORGET MY RECORD asks first.
//   c. Playing for real: the runner played and quit leaves a record, CONTINUE PLAYING and a first trophy.
//   BASE=http://localhost:8788 node tests/arcadeapp.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE = { width: 440, height: 956 };
const PHONE2 = { width: 390, height: 844 };
const WORLDS = ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass'];
const RAW = /\b(undefined|NaN|null|\[object Object\])\b|\$\{/;
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 280)}`);
  }
};
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--disable-dev-shm-usage'] });
const live = [];
process.on('uncaughtException', async (e) => {
  problems.push(`crashed: ${String(e.message).split('\n')[0]} ${String(e.stack ?? '').split('\n').filter((l) => l.includes('.spec.mjs')).slice(0, 2).join(' ')}`);
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
});

/** One phone, paired, in a world and a text size; `store` seeds localStorage once; `status` replaces the brain's /api/status answer. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', acceptDownloads: true });
  live.push(ctx);
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  if (o.status) await ctx.route('**/api/status', async (route) => {
    const r = await route.fetch().catch(() => null);
    const real = r ? await r.json().catch(() => ({})) : {};
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...real, ...o.status }) });
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, world, store }) => {
    if (sessionStorage.getItem('sn.seeded')) return;
    sessionStorage.setItem('sn.seeded', '1');
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    for (const [k, v] of Object.entries(store ?? {})) localStorage.setItem(k, v);
  }, { key: KEY, body: o.body ?? 0, world: o.world ?? 'scan', store: o.store ?? {} });
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  return { ctx, page };
}
const until = (page, fn, arg, ms = 10000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const text = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
/** Every key in `root` at 44 pt, nothing sideways on the page, no word cut inside `root`, no raw string. */
async function fit(page, tag, root) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  const r = await page.evaluate((root) => {
    const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]');
    const all = [...document.querySelectorAll(root)].flatMap((x) => [x, ...x.querySelectorAll('*')]).filter(vis);
    const small = all.filter((e) => e.matches('button, summary, input:not([type=hidden]):not([type=file]), select, [role=button]')).map((e) => {
      const b = e.getBoundingClientRect();
      return b.width >= 43.5 && b.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(b.width)}×${Math.round(b.height)}`;
    }).filter(Boolean);
    const sideways = document.documentElement.scrollWidth > innerWidth + 1;
    const cut = all.filter((e) => !e.matches('input, select, textarea') && e.textContent.trim() && e.scrollWidth > e.clientWidth + 1 && /(hidden|clip)/.test(getComputedStyle(e).overflowX)).map((e) => e.textContent.trim().slice(0, 30));
    return { small: small.slice(0, 6), sideways, cut: cut.slice(0, 4), words: [...document.querySelectorAll(root)].map((x) => x.innerText).join(' ') };
  }, root);
  check(!r.small.length, `${tag}: under 44 pt: ${r.small.join(', ')}`);
  check(!r.sideways, `${tag}: sideways`);
  check(!r.cut.length, `${tag}: words cut: ${r.cut.join(' | ')}`);
  check(!RAW.test(r.words), `${tag}: a raw string: ${(RAW.exec(r.words) ?? [''])[0]}`);
}

/** Tap a confirm sheet's yes once its sheet has finished arriving (a tap mid-spring can land on the backdrop and close it). */
async function sayYes(page, word) {
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
  await page.locator('.sureyes', { hasText: word }).last().click();
}

async function openArcade(page) {
  await page.evaluate(() => (location.hash = 'arcade'));
  await page.waitForSelector('#pg-arcade .arccard .arcopen', { timeout: 30000 });
}
const DAY = 86_400_000;
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGNgYGD4z8DAwMDAwMAAAAQIAAEd2lVDAAAAAElFTkSuQmCC';
function played(now) {
  const days = [];
  for (let i = 0; i < 7; i++) days.push(new Date(now - i * DAY).toISOString().slice(0, 10));
  return {
    'ghosty.arcade.stats': JSON.stringify({
      runner: { title: 'THE RUNNER', plays: 6, seconds: 4000, first: now - 9 * DAY, last: now - 60_000 },
      flap: { title: 'FLAP', plays: 1, seconds: 90, first: now - 2 * DAY, last: now - 2 * DAY },
    }),
    'ghosty.arcade.lastsave': JSON.stringify({ freedoom: 'doomsav2.dsg' }),
    'ghosty.arcade.scores': JSON.stringify({ runner: { best: 1200, last: 800, when: new Date(now - 60_000).toISOString() } }),
    'ghosty.arcade.days': JSON.stringify(days),
    'ghosty.arcade.shots': JSON.stringify({ runner: [{ src: PIXEL, at: now - 60_000 }, { src: PIXEL, at: now - 120_000 }] }),
  };
}

// ---------- a. a fresh phone
for (const [vp, tag] of [[PHONE, '440'], [PHONE2, '390']]) {
  const { ctx, page } = await phone(vp);
  const fetched = [];
  page.on('request', (r) => /archive\.org|\/api\/arcade\//.test(r.url()) && fetched.push(r.url()));
  try {
    await openArcade(page);
    const s = await page.evaluate(() => ({
      cont: !!document.querySelector('#pg-arcade .arccont')?.closest('[hidden]') || document.querySelector('#pg-arcade .arccont')?.hidden,
      room: document.querySelector('#pg-arcade .arcroom')?.textContent ?? '',
    }));
    check(s.cont, `${tag} fresh: CONTINUE PLAYING shows with nothing played`);
    check(/Nothing earned yet/.test(s.room) && /0 OF 5/.test(s.room), `${tag} fresh: THE TROPHY ROOM says "${s.room.slice(0, 120)}"`);
    // SEARCH THE SHELF: by name as he types; nothing matching says so, with CLEAR SEARCH
    await page.fill('#pg-arcade .arcfind', 'freedoom');
    const found = await page.evaluate(() => [...document.querySelectorAll('#pg-arcade .arcshelf .arccard')].filter((c) => !c.hidden).map((c) => c.dataset.id));
    check(found.length >= 1 && found.every((id) => /freedoom/.test(id)), `${tag} search: "freedoom" shows ${found.join(',')}`);
    await page.fill('#pg-arcade .arcfind', 'zzzz');
    check(await until(page, () => !document.querySelector('#pg-arcade .arcnomatch').hidden && /No games match/.test(document.querySelector('#pg-arcade .arcnomatch').textContent)), `${tag} search: no "No games match" line`);
    await page.click('#pg-arcade .arcnomatch button');
    check(await until(page, () => ![...document.querySelectorAll('#pg-arcade .arcshelf .arccard')].some((c) => c.hidden) && document.querySelector('#pg-arcade .arcnomatch').hidden), `${tag} search: CLEAR SEARCH did not bring every game back`);
    const doom = await page.evaluate(() => [...document.querySelectorAll('#pg-arcade .arcshelf .arccard')].find((c) => /^GET · /.test(c.querySelector('.arcact')?.textContent ?? ''))?.dataset.id ?? '');
    check(!!doom, `${tag} fresh: no game with GET on the shelf`);
    if (doom) {
      await page.click(`#pg-arcade .arccard[data-id="${doom}"] .arcopen`);
      await page.waitForSelector('.modal .arcpage', { timeout: 10000 });
      const pg = await page.evaluate(() => {
        const p = document.querySelector('.modal .arcpage');
        const sec = (n) => p.querySelector(`[data-sec="${n}"]`)?.innerText ?? '';
        return { act: p.querySelector('.arcpageact')?.textContent ?? '', shots: sec('screenshots'), how: sec('how to play'), rec: sec('your record'), tro: p.querySelectorAll('.arctrophy').length, lic: sec('licence and credit'), forget: !!p.querySelector('.arcforget') };
      });
      check(/^GET · \d+(\.\d)? (MB|KB)$/.test(pg.act), `${tag} page: its key reads "${pg.act}"`);
      check(/appear here as you play/.test(pg.shots), `${tag} page: screenshots say "${pg.shots.slice(0, 80)}"`);
      check(/Left thumb/.test(pg.how) && /A controller/.test(pg.how) && /A keyboard/.test(pg.how), `${tag} page: how to play lacks touch, controller or keyboard: "${pg.how.slice(0, 200)}"`);
      check(/Not played yet/.test(pg.rec), `${tag} page: record says "${pg.rec.slice(0, 80)}"`);
      check(pg.tro === 5, `${tag} page: ${pg.tro} trophies, not 5`);
      check(/Licence/.test(pg.lic) && /Credit/.test(pg.lic) && /on Wi-Fi/.test(pg.lic), `${tag} page: licence and credit say "${pg.lic.slice(0, 160)}"`);
      check(!pg.forget, `${tag} page: FORGET MY RECORD with nothing to forget`);
      await fit(page, `${tag} page (scan)`, '.modal');
      if (tag === '440') await page.screenshot({ path: `${out}/arcadeapp-page-fresh-440.png` });
      await page.keyboard.press('Escape');
      await until(page, () => !document.querySelector('.modal .arcpage'));
    }
    if (doom && tag === '440') {
      // ASK GHOSTY: the page closes and the chat is asked about this game
      await page.click(`#pg-arcade .arccard[data-id="${doom}"] .arcopen`);
      await page.waitForSelector('.modal .arcask', { timeout: 10000 });
      await page.click('.modal .arcask');
      check(await until(page, () => !document.querySelector('.modal .arcpage') && location.hash === '#core' && [...document.querySelectorAll('#pg-core .msg.me')].some((m) => /How do I get better at/.test(m.textContent ?? '')), null, 15000), 'ASK GHOSTY did not ask the chat about the game');
    }
    check(!fetched.length, `${tag} fresh: looking fetched ${fetched[0] ?? ''}`);
  } finally {
    await ctx.close();
  }
}
log('a. fresh phone');

// ---------- b. a phone that has played, in all seven worlds (and BODY 21 once)
const now = Date.now();
for (const [i, world] of WORLDS.entries()) {
  for (const [vp, tag] of i === 0 ? [[PHONE, '440'], [PHONE2, '390']] : [[PHONE, '440']]) {
    const { ctx, page } = await phone(vp, { world, store: played(now) });
    try {
      await openArcade(page);
      const s = await page.evaluate(() => ({
        cont: [...document.querySelectorAll('#pg-arcade .arccontcard')].map((c) => ({ id: c.dataset.cont, act: c.querySelector('.arcact')?.textContent ?? '', line: c.querySelector('.arcscore')?.textContent ?? '' })),
        room: document.querySelector('#pg-arcade .arcroom')?.textContent ?? '',
        earned: [...document.querySelectorAll('#pg-arcade .arcroom .arctrophy[data-earned="true"]')].map((t) => t.dataset.trophy),
      }));
      check(s.cont.map((c) => c.id).join(',') === 'runner,flap', `${world} ${tag}: CONTINUE PLAYING lists ${s.cont.map((c) => c.id).join(',')}`);
      check(s.cont[0]?.act === 'CONTINUE' && /Last played today · 6 sittings · 1 h 7 min/.test(s.cont[0]?.line ?? ''), `${world} ${tag}: CONTINUE card reads "${s.cont[0]?.act}" "${s.cont[0]?.line}"`);
      for (const want of ['arcade:week', 'runner:first', 'runner:ten', 'runner:hour', 'runner:five', 'runner:best', 'flap:first']) check(s.earned.includes(want), `${world} ${tag}: THE TROPHY ROOM lacks ${want}`);
      check(/7 OF 15/.test(s.room), `${world} ${tag}: THE TROPHY ROOM counts "${s.room.slice(0, 80)}"`);
      await fit(page, `${world} ${tag} arcade`, '#pg-arcade .arccont, #pg-arcade .arcroom');
      if (i === 0 && tag === '440') {
        // by words: "show my trophies" answered on the phone, the arcade opened at THE TROPHY ROOM
        await page.evaluate(() => (location.hash = 'core'));
        await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
        const sent = await page.evaluate(() => Date.now());
        await page.fill('#cin', 'show my trophies');
        await page.keyboard.press('Enter');
        const reply = await page.waitForFunction(({ t }) => {
          const msgs = [...document.querySelectorAll('#pg-core .msg')];
          const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t).lastIndexOf(true);
          const r = mine < 0 ? null : msgs.slice(mine + 1).find((m) => !m.classList.contains('me') && /trophies/.test(m.textContent ?? ''));
          return r ? (r.textContent ?? '').replace(/\s+/g, ' ') : null;
        }, { t: sent }, { timeout: 20000 }).then((x) => x.jsonValue(), () => '');
        check(/You have earned 7 of 15 trophies\. Last you played THE RUNNER, today\./.test(reply), `"show my trophies" answered "${reply.slice(0, 160)}"`);
        check(await until(page, () => location.hash === '#arcade'), '"show my trophies" did not open the arcade');
        await page.waitForSelector('#pg-arcade .arccard .arcopen', { timeout: 15000 });
      }
      if (i === 0 || world === 'ink') {
        await page.click('#pg-arcade .arccontcard[data-cont="runner"] .arcmore');
        await page.waitForSelector('.modal .arcpage', { timeout: 10000 });
        const pg = await page.evaluate(() => {
          const p = document.querySelector('.modal .arcpage');
          return { act: p.querySelector('.arcpageact')?.textContent ?? '', shots: p.querySelectorAll('.arcshot').length, rec: p.querySelector('[data-sec="your record"]')?.innerText ?? '', earned: p.querySelectorAll('.arctrophy[data-earned="true"]').length };
        });
        check(pg.act === 'PLAY', `${world} ${tag} runner page: key reads "${pg.act}"`);
        check(pg.shots === 2, `${world} ${tag} runner page: ${pg.shots} screenshots, not 2`);
        check(/Sittings\s*6/.test(pg.rec) && /1 h 7 min/.test(pg.rec) && /1,200/.test(pg.rec), `${world} ${tag} runner page: record says "${pg.rec.replace(/\s+/g, ' ').slice(0, 160)}"`);
        check(pg.earned === 5, `${world} ${tag} runner page: ${pg.earned} trophies earned, not 5`);
        await fit(page, `${world} ${tag} runner page`, '.modal');
        if (tag === '440') await page.screenshot({ path: `${out}/arcadeapp-page-${world}-440.png` });
        if (i === 0 && tag === '440') {
          // FORGET MY RECORD asks first; keeping it changes nothing, forgetting it empties the page
          await page.click('.modal .arcforget');
          await page.waitForSelector('.modal .arcpage', { state: 'attached' });
          const asked = await until(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent === 'FORGET IT'));
          check(asked, 'FORGET MY RECORD did not ask first');
          if (asked) {
            await sayYes(page, 'FORGET IT');
            check(await until(page, () => /Not played yet/.test(document.querySelector('.modal [data-sec="your record"]')?.textContent ?? '')), 'FORGET MY RECORD left the record');
            const left = await page.evaluate(() => ({ st: JSON.parse(localStorage.getItem('ghosty.arcade.stats') ?? '{}'), sc: JSON.parse(localStorage.getItem('ghosty.arcade.scores') ?? '{}') }));
            check(!left.st.runner && !!left.st.flap && !!left.sc.runner, `FORGET MY RECORD: stats ${Object.keys(left.st)}; scores ${Object.keys(left.sc)}`);
          }
        }
        await page.keyboard.press('Escape');
        await until(page, () => !document.querySelector('.modal .arcpage'));
      }
      if (tag === '440' && (i === 0 || world === 'glass')) await page.screenshot({ path: `${out}/arcadeapp-${world}-440.png`, fullPage: false });
    } finally {
      await ctx.close();
    }
  }
}
{
  const { ctx, page } = await phone(PHONE, { body: 21, store: played(now) });
  try {
    await openArcade(page);
    await fit(page, 'BODY 21 arcade', '#pg-arcade .arccont, #pg-arcade .arcroom');
    await page.click('#pg-arcade .arccontcard[data-cont="runner"] .arcmore');
    await page.waitForSelector('.modal .arcpage', { timeout: 10000 });
    await fit(page, 'BODY 21 runner page', '.modal');
    await page.screenshot({ path: `${out}/arcadeapp-page-body21-440.png` });
  } finally {
    await ctx.close();
  }
}
log('b. a phone that has played');

// ---------- CONTINUE for DOOM's engine: a Freedoom kept on the phone and saved in slot 2 continues with -loadgame 2
{
  const { ctx, page } = await phone(PHONE, { store: { ...played(now), 'ghosty.arcade.stats': JSON.stringify({ freedoom: { title: 'FREEDOOM: PHASE 1', plays: 2, seconds: 900, first: now - DAY, last: now - 1000 } }) } });
  try {
    await openArcade(page);
    // as if its package were here: the card's key reads PLAY once a GET has kept it (the spec only flips the key's words)
    await page.evaluate(() => {
      const act = document.querySelector('#pg-arcade .arccard[data-id="freedoom"] .arcact');
      if (act) act.textContent = 'PLAY';
      window.dispatchEvent(new Event('ghosty:studio-imported'));
    });
    const resume = await until(page, () => document.querySelector('#pg-arcade .arccontcard[data-cont="freedoom"] .arcact')?.dataset.resume === '-loadgame 2');
    check(resume, `CONTINUE for Freedoom does not carry -loadgame 2: ${await page.evaluate(() => JSON.stringify(document.querySelector('#pg-arcade .arccontcard[data-cont="freedoom"] .arcact')?.dataset ?? null))}`);
  } finally {
    await ctx.close();
  }
}
log('continue for DOOM');

// ---------- c. playing for real: the runner, played and quit, leaves its record, CONTINUE PLAYING and a first trophy
{
  const { ctx, page } = await phone(PHONE);
  try {
    await openArcade(page);
    await page.click('#pg-arcade .arccard[data-id="runner"] .arcact');
    const open = await until(page, () => !!document.querySelector('.arcplayer .g2ui .g2menu') && !!document.querySelector('.arcplayer canvas')?.width, null, 30000);
    check(open, 'the runner did not open');
    if (open) {
      // a sitting under two seconds is not counted: this one is a real sitting
      const from = await page.evaluate(() => performance.now());
      await page.waitForFunction((t) => performance.now() > t + 2600, from, { timeout: 10000 });
      await page.locator('.arcplayer .g2menu .g2btns button', { hasText: 'QUIT' }).click();
      check(await until(page, () => !document.querySelector('.arcplayer')), 'the runner did not quit');
      const after = await page.evaluate(() => ({
        st: JSON.parse(localStorage.getItem('ghosty.arcade.stats') ?? '{}').runner ?? null,
        cont: [...document.querySelectorAll('#pg-arcade .arccontcard')].map((c) => c.dataset.cont),
        status: document.querySelector('#pg-arcade .arccard[data-id="runner"] .arcstatus')?.textContent ?? '',
        first: !!document.querySelector('#pg-arcade .arcroom .arctrophy[data-trophy="runner:first"][data-earned="true"]'),
      }));
      check(after.st?.plays === 1 && after.st.seconds >= 2, `after playing: the record is ${JSON.stringify(after.st)}`);
      check(after.cont[0] === 'runner', `after playing: CONTINUE PLAYING lists ${after.cont.join(',')}`);
      check(/Trophy: First go/.test(after.status), `after playing: the card says "${after.status}"`);
      check(after.first, 'after playing: THE TROPHY ROOM lacks First go');
    }
  } finally {
    await ctx.close();
  }
}
log('c. playing for real');

// ---------- d. SAVE SLOTS: the block world's save kept under a name, loaded (what was there kept as "Before loading"), deleted
{
  const { ctx, page } = await phone(PHONE);
  try {
    await openArcade(page);
    const page1 = () => page.waitForSelector('.modal .arcpage [data-sec="save slots"]', { timeout: 10000 });
    await page.click('#pg-arcade .arccard[data-id="block-world"] .arcopen');
    await page1();
    check(await until(page, () => /Nothing saved in this game yet/.test(document.querySelector('.modal [data-sec="save slots"]')?.textContent ?? '')), 'slots: no line for a game with nothing saved');
    await page.keyboard.press('Escape');
    // the game's own save, as its engine writes it
    await page.evaluate(() => new Promise((res, rej) => {
      const r = indexedDB.open('ghosty-arcade-saves', 1);
      r.onupgradeneeded = () => r.result.objectStoreNames.contains('files') || r.result.createObjectStore('files');
      r.onsuccess = () => {
        const t = r.result.transaction('files', 'readwrite');
        t.objectStore('files').put(new Uint8Array([7, 7, 7]), 'block-world/world.sav');
        t.oncomplete = () => res(true);
        t.onerror = () => rej(t.error);
      };
      r.onerror = () => rej(r.error);
    }));
    await page.click('#pg-arcade .arccard[data-id="block-world"] .arcopen');
    await page1();
    await page.waitForSelector('.modal .arcslotname', { timeout: 10000 });
    await page.fill('.modal .arcslotname', 'My castle');
    await page.click('.modal .arcslotkeep');
    check(await until(page, () => !!document.querySelector('.modal .arcslot[data-slot="My castle"]') && /Kept “My castle”/.test(document.querySelector('.modal .arcslotmsg')?.textContent ?? '')), 'slots: KEEP A SLOT did not keep "My castle"');
    await page.click('.modal .arcslot[data-slot="My castle"] button:has-text("LOAD")');
    check(await until(page, () => document.querySelectorAll('.modal .arcslot').length === 2 && /Before loading/.test(document.querySelector('.modal .arcslotmsg')?.textContent ?? '')), 'slots: LOAD did not keep what was there as "Before loading"');
    await fit(page, 'slots', '.modal');
    await page.screenshot({ path: `${out}/arcadeapp-slots-440.png` });
    await page.click('.modal .arcslot[data-slot="My castle"] button:has-text("DELETE")');
    const asked = await until(page, () => [...document.querySelectorAll('button')].some((b) => b.textContent === 'DELETE IT'));
    check(asked, 'slots: DELETE did not ask first');
    if (asked) {
      await sayYes(page, 'DELETE IT');
      check(await until(page, () => !document.querySelector('.modal .arcslot[data-slot="My castle"]') && !!document.querySelector('.modal .arcslot')), 'slots: DELETE did not remove only that slot');
    }
  } finally {
    await ctx.close();
  }
}
log('d. save slots');

await browser.close();
console.log(`${checks} checks`);
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('arcadeapp: all green');
