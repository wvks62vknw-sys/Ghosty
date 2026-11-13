// THE RADIO (planlane, FINAL ROUND): the radio by chat with no model (the sleep timer by a length, by a clock time and to the end of the
// hour; how long is left; off; next and previous; his favourites by place; save this one; what's on), the END OF THE HOUR key, the
// sleep timer on the lock screen's line, a reload that ended a timer said honestly, and FAVOURITES in his own order (REORDER, ↑ ↓,
// kept on the phone, followed by "play my second favourite"). At 440 × 956 and 390 × 844 with BODY 21, and the seven looks.
// The directory and the streams are stood in by the harness (Spec Lane FM and Spec Lane Two).

const FAVS = JSON.stringify([
  { name: 'Spec Lane FM', url: 'https://spec-lane.test-radio.example/one', info: 'UK · News · 128 kbps' },
  { name: 'Spec Lane Two', url: 'https://spec-lane.test-radio.example/two', info: 'UK · News · 128 kbps' },
]);
const lastReply = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? '');
/** Say it in the chat and wait for a reply that matches `re`; the reply. */
async function say(H, page, words, re) {
  const before = await page.evaluate(() => document.querySelectorAll('#pg-core .msg:not(.me)').length).catch(() => 0);
  await H.chat(page, words);
  const ok = await page.waitForFunction(({ n, src }) => {
    const l = [...document.querySelectorAll('#pg-core .msg:not(.me)')];
    return l.length > n && new RegExp(src).test(l.at(-1)?.textContent ?? '');
  }, { n: before, src: re.source }, { timeout: 12000 }).then(() => true, () => false);
  const r = await lastReply(page);
  H.check(ok && !H.RAW.test(r), `chat "${words}" → ${re}: ${r.slice(0, 200)}`);
  return r;
}
const onAir = (page) => page.waitForFunction(() => /ON AIR/i.test(document.querySelector('#pg-radio .pn.nowp .nptx small')?.textContent ?? '') || navigator.mediaSession?.playbackState === 'playing', null, { timeout: 15000 }).then(() => true, () => false);
const titled = (page, name) => page.waitForFunction((n) => navigator.mediaSession?.metadata?.title === n, name, { timeout: 10000 }).then(() => true, () => false);

/** A stand-in stream long enough for the whole walk (the harness's tone runs out after 30 s, and a stream that ends is said as ended). */
function longTone(sec = 300, rate = 8000) {
  const n = sec * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 9) * 2000), 44 + i * 2);
  return b;
}
const LONG = longTone();
async function radioPhone(H, vp, world, seed) {
  const p = await H.phone(vp, world, seed, 21);
  await p.page.route(/^https:\/\/spec-lane\.test-radio\.example\//, (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: LONG }));
  return p;
}

export async function run(H) {
  const { check, log } = H;
  // ---- 1. the words, pure
  const A = await H.pure('apps/web/src/features/radio/asks.ts');
  const W = await H.pure('apps/web/src/features/radio/words.ts');
  const want = {
    'sleep timer 30 minutes': { what: 'sleep', min: 30 },
    'Set a sleep timer for an hour': { what: 'sleep', min: 60 },
    'turn the radio off in 20 minutes': { what: 'sleep', min: 20 },
    'stop the radio in half an hour please': { what: 'sleep', min: 30 },
    'stop the radio at 11': { what: 'sleepAt', h: 11, m: 0, half: '' },
    'turn the radio off at half eleven': { what: 'sleepAt', h: 11, m: 30, half: '' },
    'radio off at 11:30pm': { what: 'sleepAt', h: 11, m: 30, half: 'pm' },
    'sleep timer till midnight': { what: 'sleepAt', h: 0, m: 0, half: '' },
    'stop the radio at the end of the hour': { what: 'sleepHour' },
    'cancel the sleep timer': { what: 'sleepOff' },
    'sleep timer off': { what: 'sleepOff' },
    'how long until the radio stops?': { what: 'sleepLeft' },
    'when does the radio stop': { what: 'sleepLeft' },
    'next station': { what: 'step', dir: 1 },
    'skip this station': { what: 'step', dir: 1 },
    'previous station': { what: 'step', dir: -1 },
    'play my favourites': { what: 'favs' },
    'play my second favourite': { what: 'fav', n: 2 },
    'play favourite number 3': { what: 'fav', n: 3 },
    'save this station': { what: 'save' },
    'add this to my favourites': { what: 'save' },
    'remove this from my favourites': { what: 'unsave' },
    "what's playing": { what: 'now' },
    'what station is this?': { what: 'now' },
    'what am I listening to': { what: 'now' },
  };
  for (const [w, r] of Object.entries(want)) check(JSON.stringify(A.radioAsked(w)) === JSON.stringify(r), `radioAsked("${w}") = ${JSON.stringify(A.radioAsked(w))}, wanted ${JSON.stringify(r)}`);
  // the VOICE lane's meanings and the brain's play_radio are left alone
  for (const w of ['play music', 'play the radio', 'stop the radio', 'open the radio', 'play BBC Radio 4', 'play some jazz', 'turn the radio off', 'set a timer for 10 minutes', 'next song', "what's playing on spotify", 'stop'])
    check(A.radioAsked(w) === null, `radioAsked("${w}") is left to its owner: ${JSON.stringify(A.radioAsked(w))}`);
  const t0 = new Date(2026, 10, 13, 22, 15).getTime();
  check(W.endOfHour(t0) === new Date(2026, 10, 13, 23, 0).getTime() && W.hourKey(t0) === 'AT 23:00', `the end of the hour at 22:15: ${W.hourKey(t0)}`);
  check(W.nextClock(11, 0, t0) === new Date(2026, 10, 13, 23, 0).getTime(), '"at 11" at 22:15 is 23:00 tonight');
  check(W.nextClock(11, 0, new Date(2026, 10, 13, 23, 30).getTime()) === new Date(2026, 10, 14, 11, 0).getTime(), '"at 11" at 23:30 is 11:00 tomorrow');
  check(W.nextClock(0, 0, t0) === new Date(2026, 10, 14, 0, 0).getTime(), '"midnight" at 22:15 is tonight\'s midnight');
  check(W.sleepAtSet(new Date(2026, 10, 13, 23, 0).getTime(), t0) === 'Sleep timer set: the radio goes quiet at 23:00 (in 45 min), then stops.', W.sleepAtSet(new Date(2026, 10, 13, 23, 0).getTime(), t0));
  check(W.sleepLine(t0 + 90 * 60_000, t0) === 'Goes quiet at 23:45 (in 1 h 30 min), then stops.', `90 min said in hours: ${W.sleepLine(t0 + 90 * 60_000, t0)}`);
  check(/^The page reloaded, so Spec Lane FM stopped and its sleep timer for 23:00 went with it\./.test(W.lostLine(new Date(2026, 10, 13, 23, 0).getTime(), 'Spec Lane FM')), 'the reload said honestly');
  log('radio: the words');

  // ---- 2. the phone, at both sizes and BODY 21
  for (const vp of [H.PHONE, H.PHONE2]) {
    const { ctx, page } = await radioPhone(H, vp, 'scan', { 'ghosty.radio.favs': FAVS });
    await H.open(page, 'radio');
    await page.waitForSelector('#pg-radio .pn.stations .rw.station', { timeout: 15000 });
    // "what's playing" with nothing on, then the sleep timer with nothing on: said, nothing set
    await say(H, page, "what's playing", /Nothing is playing\.?/);
    await say(H, page, 'turn the radio off in 20 minutes', /nothing to stop/);
    // his favourites by place, from the chat
    await say(H, page, 'play my second favourite', /Playing Spec Lane Two, your second favourite/);
    check(await titled(page, 'Spec Lane Two'), `[${vp.width}] "play my second favourite" plays it`);
    await say(H, page, 'next station', /Next: Spec Lane FM \(from your favourites\)/);
    check(await titled(page, 'Spec Lane FM'), `[${vp.width}] "next station" steps to the next favourite`);
    await say(H, page, 'previous station', /Back: Spec Lane Two/);
    check(await titled(page, 'Spec Lane Two'), `[${vp.width}] "previous station" steps back`);
    // the sleep timer by chat: a length, how long is left, the lock screen's line, a clock time, off
    await onAir(page);
    await say(H, page, 'turn the radio off in 20 minutes', /Sleep timer set: the radio goes quiet at \d\d:\d\d \(in 20 min\), then stops\./);
    await say(H, page, 'how long until the radio stops', /Spec Lane Two stops at \d\d:\d\d, in (20|19) min\./);
    const artist = await page.evaluate(() => navigator.mediaSession?.metadata?.artist ?? '');
    check(/^Stops at \d\d:\d\d · UK/.test(artist), `[${vp.width}] the lock screen's line says when it stops: ${artist}`);
    await say(H, page, 'stop the radio at 11', /Sleep timer set: the radio goes quiet at 11:00 \(in |Sleep timer set: the radio goes quiet at 23:00 \(in /);
    await say(H, page, 'sleep timer off', /Sleep timer off: Spec Lane Two keeps playing/);
    await say(H, page, 'how long until the radio stops', /There is no sleep timer/);
    await say(H, page, "what's playing", /Spec Lane Two is on air|Tuning in to Spec Lane Two/);
    await say(H, page, 'save this station', /already in your favourites \(your second\)/);
    // the screen agrees with the chat: AT hh:00 (the end of this hour) lit when tapped, its line said
    await H.open(page, 'radio');
    await page.waitForSelector('#pg-radio .npsleepk button', { timeout: 8000 }).catch(() => check(false, `[${vp.width}] no sleep keys while a station plays`));
    const hourB = page.locator('#pg-radio .npsleepk button[aria-label*="end of this hour"]');
    const hk = (await hourB.textContent().catch(() => '')) ?? '';
    check(/^AT \d\d:00$/i.test(hk.trim()), `[${vp.width}] the end-of-the-hour key: ${hk}`);
    await hourB.click();
    await page.waitForFunction(() => /^Goes quiet at \d\d:00 \(in /.test(document.querySelector('#pg-radio .npsleepl')?.textContent ?? ''), null, { timeout: 3000 }).catch(async () => check(false, `[${vp.width}] the line after AT hh:00: ${await page.textContent('#pg-radio .npsleepl')}`));
    check((await hourB.getAttribute('aria-pressed')) === 'true', `[${vp.width}] AT hh:00 is marked as the one set`);
    const fn = await H.fit(page, '#pg-radio .pn.nowp');
    check(!fn.small.length && !fn.sideways && !fn.cut.length, `[${vp.width}] NOW PLAYING with its timer fits at BODY 21: ${JSON.stringify(fn)}`);
    // FAVOURITES in his order: REORDER, ↓ on the first, DONE; kept across a reload; "play my favourites" follows it
    await page.click('#pg-radio .pn.favs .favorder button');
    await page.waitForSelector('#pg-radio .pn.favs .favmove', { timeout: 3000 }).catch(() => check(false, `[${vp.width}] REORDER showed no ↑ ↓`));
    check(await page.isDisabled('#pg-radio .pn.favs .favmove:first-of-type button[aria-label^="Move"][aria-label$="up"]').catch(() => false), `[${vp.width}] the first one cannot go up`);
    const ff = await H.fit(page, '#pg-radio .pn.favs');
    check(!ff.small.length && !ff.sideways && !ff.cut.length, `[${vp.width}] REORDER fits at BODY 21: ${JSON.stringify(ff)}`);
    await page.click('#pg-radio .pn.favs button[aria-label="Move Spec Lane FM down"]');
    const order = await page.$$eval('#pg-radio .pn.favs .favmove .favtx b', (b) => b.map((x) => x.textContent).join(' | '));
    check(order === 'Spec Lane Two | Spec Lane FM', `[${vp.width}] ↓ moved it: ${order}`);
    await page.click('#pg-radio .pn.favs .favorder button');
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.radio.favs') ?? '[]').map((s) => s.name).join(' | '));
    check(kept === 'Spec Lane Two | Spec Lane FM', `[${vp.width}] the order is kept on the phone: ${kept}`);
    // a reload while the timer runs: the radio stops (the browser ends it), and the screen says the timer went with it
    await page.reload();
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    await H.open(page, 'radio');
    const lost = await page.waitForSelector('#pg-radio .pn.nowp .nplost', { timeout: 8000 }).then((e) => e.textContent(), () => '');
    check(/^The page reloaded, so Spec Lane Two stopped and its sleep timer for \d\d:00 went with it\./.test(lost ?? ''), `[${vp.width}] after a reload, the timer's end said honestly: ${lost}`);
    check(await page.isVisible('#pg-radio .pn.nowp .nplost'), `[${vp.width}] that line is shown`);
    const favs = await page.$$eval('#pg-radio .pn.favs .rw.station .v b', (b) => b.map((x) => x.textContent).join(' | '));
    check(favs === 'Spec Lane Two | Spec Lane FM', `[${vp.width}] the order after a reload: ${favs}`);
    await say(H, page, 'play my favourites', /Playing Spec Lane Two, your first favourite/);
    await H.open(page, 'radio');
    await page.waitForFunction(() => !document.querySelector('#pg-radio .pn.nowp .nplost'), null, { timeout: 8000 }).catch(() => check(false, `[${vp.width}] the reload's line stays once he plays again`));
    if (vp === H.PHONE) await page.screenshot({ path: `${H.out}/planlane-radio-${vp.width}.png` });
    await page.evaluate(() => window.__specActions.stop?.());
    await ctx.close();
  }
  log('radio: the phone');

  // ---- 3. the seven looks at BODY 21: now playing with its timer, and REORDER
  for (const world of H.WORLDS) {
    const { ctx, page } = await radioPhone(H, H.PHONE2, world, { 'ghosty.radio.favs': FAVS });
    await H.open(page, 'radio');
    await page.waitForSelector('#pg-radio .pn.favs .rw.station', { timeout: 15000 }).catch(() => undefined);
    await page.locator('#pg-radio .pn.favs .rw.station', { hasText: 'Spec Lane FM' }).locator('.n').click();
    await page.waitForSelector('#pg-radio .npsleepk button', { timeout: 8000 }).catch(() => check(false, `[${world}] no sleep keys`));
    await page.click('#pg-radio .npsleepk button[aria-label*="end of this hour"]').catch(() => undefined);
    await page.click('#pg-radio .pn.favs .favorder button').catch(() => check(false, `[${world}] no REORDER`));
    const a = await H.fit(page, '#pg-radio .pn.nowp');
    const b = await H.fit(page, '#pg-radio .pn.favs');
    check(!a.small.length && !a.sideways && !a.cut.length && !b.small.length && !b.sideways && !b.cut.length, `[${world}] the timer and REORDER fit: ${JSON.stringify({ a, b })}`);
    const c = await page.$eval('#pg-radio .pn.favs .favmove .favtx b', (e) => ({ fg: getComputedStyle(e).color, bg: getComputedStyle(document.body).backgroundColor })).catch(() => null);
    check(c && c.fg !== c.bg, `[${world}] the names are drawn in a colour of the look: ${JSON.stringify(c)}`);
    await page.evaluate(() => window.__specActions.stop?.());
    await ctx.close();
  }
  log('radio: the seven looks');
}
