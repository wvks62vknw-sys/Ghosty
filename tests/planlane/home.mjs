// THE PLAN AND HOME LANE, HOME (planlane:home): Home's own checks, at 440 × 956 and 390 × 844, BODY 21, and in the seven looks.
//  - the pure words of the Today card and the free squares (apps/web/src/features/core/todaywords.ts, the file the page is built from);
//  - GLASS's Today card: a to-do due today shows in its head ("1 to-do") and on its own line, and a tap opens the TO-DO list when
//    to-dos are all that is left today; its words wrap, never "…"; a diary the brain cannot read says so in his words and the
//    to-do (kept on this phone) still shows; every key 44 pt, nothing sideways;
//  - ONE INK: RECENT and FAVOURITES are whole words at BODY 21 (not "FAVOURITE / S");
//  - THE MAP and GOD'S EYE: a free square says what fills it once, never "nothing yet" in every square;
//  - the hour's thing (ONE INK, THE MAP, GOD'S EYE, GROWN UP, ORBIT): with no book and nothing next, the to-do due today, not the Brief;
//  - every look's Home at 390 and BODY 21: nothing sideways, no word cut with "…", no made-up word (undefined, NaN …).
const TODO_KEY = 'ghosty.agenda.todo';

export async function run(H) {
  const { check, log } = H;
  const W = await H.pure('apps/web/src/features/core/todaywords.ts');
  check(W.todayCount(2, 1) === '2 left · 1 to-do' && W.todayCount(0, 3) === '3 to-dos' && W.todayCount(1, 0) === '1 left' && W.todayCount(0, 0) === '', `[home] the Today head counts: ${W.todayCount(2, 1)} / ${W.todayCount(0, 3)}`);
  check(W.todoSummary(['Bins']) === 'Bins' && W.todoSummary(['Bins', 'Passport']) === '2 due: Bins, Passport' && W.todoSummary(['A', 'B', 'C', 'D']) === '4 due: A, B and 2 more' && W.todoSummary([]) === '', `[home] the to-do line: ${W.todoSummary(['A', 'B', 'C', 'D'])}`);
  check(W.todayTap(0, 2) === 'todo' && W.todayTap(1, 2) === 'diary' && W.todayTap(0, 0) === 'diary' && W.todayTap(-1, 2) === 'diary', '[home] the Today card opens the to-do list only when to-dos are all that is left today');
  check(W.freeSquare(0) && W.freeSquare(1) && W.freeSquare(2) === '' && !/nothing yet/i.test(W.freeSquare(0) + W.freeSquare(1)), `[home] the free squares: ${W.freeSquare(0)} / ${W.freeSquare(1)}`);
  check(Object.values(W.TODAY_WORDS).every((s) => s.split(/\s+/).length <= 20 && !H.RAW.test(s)), '[home] the Today card states are short and plain');
  log('home: pure words');

  const today = H.today();
  const seed = { [TODO_KEY]: JSON.stringify([{ id: 'home-spec-1', text: 'Renew the passport before the trip to the coast', due: today, done: false, at: Date.now() }]) };
  const card = (page) => page.evaluate(() => {
    const c = document.querySelector('.rctoday');
    return c ? { head: (c.querySelector('.rcthead em')?.textContent ?? '').trim(), text: c.innerText.replace(/\s+/g, ' ').trim(), to: c.dataset.to, aria: c.getAttribute('aria-label'), state: c.querySelector('[data-state]')?.dataset.state ?? '', todo: (c.querySelector('.rctodo .nm')?.textContent ?? '').trim() } : null;
  });

  // ---- GLASS: the Today card with a to-do due today, at both sizes, BODY 21
  for (const vp of [H.PHONE, H.PHONE2]) {
    const { ctx, page } = await H.phone(vp, 'glass', seed, 21);
    await H.open(page, 'core');
    await page.waitForFunction(() => /to-do/.test(document.querySelector('.rctoday .rcthead em')?.textContent ?? '') && !document.querySelector('.rctoday [data-state="loading"]'), null, { timeout: 15000 }).catch(() => undefined);
    const c = await card(page);
    check(c && /(^|· )1 to-do$/.test(c.head), `[home ${vp.width}] the Today head counts the to-do due today: ${JSON.stringify(c)}`);
    check(c && c.todo === 'Renew the passport before the trip to the coast', `[home ${vp.width}] the to-do shows on the Today card in full: ${c?.todo}`);
    check(c && !H.RAW.test(c.text), `[home ${vp.width}] the Today card has no made-up word: ${c?.text}`);
    const wrap = await page.$eval('.rctoday .rctodo .nm', (e) => ({ cut: e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis', ws: getComputedStyle(e).whiteSpace })).catch(() => null);
    check(wrap && !wrap.cut && wrap.ws !== 'nowrap', `[home ${vp.width}] the to-do wraps, never "…": ${JSON.stringify(wrap)}`);
    const f = await H.fit(page, '#pg-core .rcbelow');
    check(!f.small.length && !f.sideways && !f.cut.length, `[home ${vp.width}] Home's cards fit at BODY 21: ${JSON.stringify(f)}`);
    // a tap opens what the card shows: with no events left today and a to-do due, the TO-DO list
    if (c?.to === 'todo') {
      await page.click('.rctoday');
      await page.waitForFunction(() => document.body.dataset.tab === 'agenda', null, { timeout: 10000 }).catch(() => undefined);
      const shown = await page.waitForSelector('#pg-agenda .pn.todo .todoit', { state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
      check(shown, `[home ${vp.width}] a tap on Today (to-dos only) opens the TO-DO list with the to-do on it`);
    } else check(c && /left/.test(c.head), `[home ${vp.width}] the card goes to the diary only when events are left today: ${JSON.stringify(c)}`);
    await ctx.close();
  }
  log('home: glass Today');

  // ---- GLASS: the diary cannot be read: said in his words, and the to-do (on this phone) still shows
  {
    const { ctx, page } = await H.phone(H.PHONE2, 'glass', seed, 21);
    await page.route(/\/api\/agenda/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"down"}' }));
    // (Home read the diary while the phone paired, before the route: a reload reads it again through the route)
    await page.reload();
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
    await H.open(page, 'core');
    await page.waitForSelector('.rctoday [data-state="error"], .rctoday [data-state="offline"]', { timeout: 15000 }).catch(() => undefined);
    const c = await card(page);
    check(c && c.state === 'error' && c.text.includes(W.TODAY_WORDS.error), `[home] a diary the brain cannot read says so: ${JSON.stringify(c)}`);
    check(c && c.todo.startsWith('Renew the passport'), `[home] the to-do still shows when the diary cannot be read: ${c?.todo}`);
    check(c && c.to === 'diary', `[home] with the diary unread, a tap goes to the agenda (it says its own state): ${c?.to}`);
    await ctx.close();
  }
  log('home: glass Today error');

  // ---- the seven looks at 390, BODY 21: nothing sideways, no word cut, no made-up word; and each look's own part
  for (const world of H.WORLDS) {
    const { ctx, page } = await H.phone(H.PHONE2, world, seed, 21);
    await H.open(page, 'core');
    await page.waitForTimeout(world === 'scan' ? 2500 : 1500);
    // the hour's thing: with no book and nothing next in the diary, the to-do due today (not the Brief) in every look that draws one
    const st = { ink: 'ink', map: 'map', eye: 'eyehome', grown: 'grownHome', orbit: 'orbitHome' }[world];
    if (st) {
      await page.waitForFunction((k) => window.__ghosty?.[k]?.tonight?.kind === 'todo', st, { timeout: 8000 }).catch(() => undefined);
      const t = await page.evaluate((k) => window.__ghosty?.[k]?.tonight ?? null, st);
      const shown = await page.evaluate(() => document.querySelector('#pg-core')?.innerText.includes('Renew the passport before the trip to the coast'));
      check(t?.kind === 'todo' && shown, `[home ${world}] the hour's thing is the to-do due today, in his words: ${JSON.stringify(t)} shown=${shown}`);
    }
    const f = await H.fit(page, '#pg-core');
    check(!f.sideways && !f.cut.length, `[home ${world}] Home at 390, BODY 21: nothing sideways, no word cut: ${JSON.stringify({ sideways: f.sideways, cut: f.cut })}`);
    const text = await page.evaluate(() => document.querySelector('#pg-core')?.innerText ?? '');
    check(!H.RAW.test(text) || !/undefined|NaN|\[object Object\]/.test(text), `[home ${world}] a made-up word on Home: ${(text.match(/.{0,30}(undefined|NaN|\[object Object\]).{0,30}/) ?? [''])[0]}`);
    if (world === 'ink') {
      const labels = await page.$$eval('.inkl > .g-truth', (l) => l.map((e) => { const r = document.createRange(); r.selectNodeContents(e); return { t: e.textContent, lines: new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size }; }));
      check(labels.length >= 2 && labels.every((l) => l.lines === 1), `[home ink] RECENT and FAVOURITES are whole words on one line: ${JSON.stringify(labels)}`);
    }
    if (world === 'grown' || world === 'orbit') {
      const k = await page.$eval('button.gnhourgo, button.orbhourgo', (b) => { const r = b.getBoundingClientRect(); const card = b.parentElement.getBoundingClientRect(); const w = b.firstElementChild?.getBoundingClientRect(); return { t: b.innerText.trim(), inside: r.right <= card.right + 1 && r.left >= card.left - 1, words: !w || (w.left >= r.left - 1 && w.right <= r.right + 1), w: Math.round(r.width), h: Math.round(r.height) }; }).catch(() => null);
      check(k && k.inside && k.words && k.w >= 44 && k.h >= 44, `[home ${world}] the hour card's key holds its words inside the card at BODY 21: ${JSON.stringify(k)}`);
    }
    if (world === 'eye') {
      const l = await page.textContent('.eyefeed.abil .eyeline').catch(() => '');
      check(l && !/…|\.\.\./.test(l), `[home eye] the ABILITIES feed says whole words: ${l}`);
    }
    if (world === 'map' || world === 'eye') {
      const sel = world === 'map' ? '.mapcell.free' : '.eyefeed.free';
      const free = await page.$$eval(sel, (l) => l.map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
      check(!free.some((t) => /nothing yet/i.test(t)), `[home ${world}] a free square says what fills it, never "nothing yet": ${JSON.stringify(free)}`);
      check(free.length < 2 || (free.filter((t) => /lands here/i.test(t)).length === 1 && free.filter((t) => /pin it/i.test(t)).length === 1), `[home ${world}] the free squares say it once each: ${JSON.stringify(free)}`);
    }
    await ctx.close();
  }
  log('home: seven looks');
}
