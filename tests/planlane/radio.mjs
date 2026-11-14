// THE RADIO (planlane, FINAL ROUND): the radio by chat with no model (the sleep timer by a length, by a clock time and to the end of the
// hour; how long is left; off; next and previous; his favourites by place; save this one; what's on), the END OF THE HOUR key, the
// sleep timer on the lock screen's line, a reload that ended a timer said honestly, and FAVOURITES in his own order (REORDER, ↑ ↓,
// kept on the phone, followed by "play my second favourite"). At 440 × 956 and 390 × 844 with BODY 21, and the seven looks.
// The directory and the streams are stood in by the harness (Spec Lane FM and Spec Lane Two).

const FAVS = JSON.stringify([
  { name: 'Spec Lane FM', url: 'https://spec-lane.test-radio.example/one', info: 'UK · News · 128 kbps' },
  { name: 'Spec Lane Two', url: 'https://spec-lane.test-radio.example/two', info: 'UK · News · 128 kbps' },
]);
/** Say it in the chat and wait for a reply that matches `re`; the reply. */
async function say(H, page, words, re) {
  // (the reply to these words: the first after his own message that matches, waited for on that condition: H.ask)
  const { ok, text: r } = await H.ask(page, words, re);
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
    'turn the radio off in 20 minutes': { what: 'sleep', min: 20 },
    'stop the radio in half an hour please': { what: 'sleep', min: 30 },
    'stop the radio at 11': { what: 'sleepAt', h: 11, m: 0, half: '' },
    'turn the radio off at half eleven': { what: 'sleepAt', h: 11, m: 30, half: '' },
    'radio off at 11:30pm': { what: 'sleepAt', h: 11, m: 30, half: 'pm' },
    'sleep timer till midnight': { what: 'sleepAt', h: 0, m: 0, half: '' },
    'stop the radio at the end of the hour': { what: 'sleepHour' },
    'remove the sleep timer': { what: 'sleepOff' },
    "don't stop the radio": { what: 'sleepOff' },
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
    'add this to my favourites': { what: 'save', loose: true },
    'remove this from my favourites': { what: 'unsave', loose: true },
    'remove this station from my favourites': { what: 'unsave' },
    "what's playing": { what: 'now', loose: true },
    'what station is this?': { what: 'now' },
    "what's on the radio": { what: 'now' },
    'what am I listening to': { what: 'now', loose: true },
  };
  for (const [w, r] of Object.entries(want)) check(JSON.stringify(A.radioAsked(w)) === JSON.stringify(r), `radioAsked("${w}") = ${JSON.stringify(A.radioAsked(w))}, wanted ${JSON.stringify(r)}`);
  // the VOICE lane's meanings and the brain's play_radio are left alone
  // and a bare "it", "this" or "one" is whatever is on screen or the brain's ("save this" on a document, "skip it" on Spotify)
  for (const w of ['play music', 'play the radio', 'stop the radio', 'open the radio', 'play BBC Radio 4', 'play some jazz', 'turn the radio off', 'set a timer for 10 minutes', 'next song', "what's playing on spotify", 'stop',
    'play my favourite station', 'please play my favourite station', 'Play my favourite station!', 'hey ghosty play my favourite station', 'play my last station',
    'when will it stop', 'when does it end', 'how long until it goes off', 'turn it off in 20 minutes', 'stop it at 11', 'end it in 5 minutes',
    'save this', 'keep this', 'keep this one', 'bookmark this', 'star this', 'skip it', 'skip this', 'next one', 'skip one', 'back one', 'previous one', 'no music', 'no radio'])
    check(A.radioAsked(w) === null, `radioAsked("${w}") is left to its owner: ${JSON.stringify(A.radioAsked(w))}`);
  // the kitchen's timer table comes first and takes these (a kitchen timer named "sleep"): the radio never claims them in its words
  const K = await H.pure('packages/shared/src/kitchen.ts').catch(() => null);
  if (K?.timerAsked) for (const w of ['sleep timer 30 minutes', 'cancel the sleep timer']) check(K.timerAsked(w) !== null, `the kitchen takes "${w}" (so the radio's replies never suggest it)`);
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
    // "what station is this" with nothing on, then the sleep timer with nothing on: said, nothing set
    await say(H, page, 'what station is this', /Nothing is playing\.?/);
    if (vp === H.PHONE) {
      // "what's playing" names no radio: with the radio off it is the brain's (Spotify's now playing), never the radio's "Nothing is playing"
      // (any reply to these words, the first after his own message)
      const { text: r } = await H.ask(page, "what's playing");
      check(!/^Nothing is playing|The last station was/.test(r), `"what's playing" with the radio off is left to the brain: ${r.slice(0, 160)}`);
    }
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
    await say(H, page, 'how long until the radio stops', /There is no sleep timer: .* Say “turn the radio off in 30 minutes” to set one\./);
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
    const fs = await H.fit(page, '#pg-radio .pn.stations');
    check(!fs.small.length && !fs.sideways && !fs.cut.length && (await page.$eval('#pg-radio .radnear select', (e) => e.getBoundingClientRect().height).catch(() => 0)) >= 43.5, `[${vp.width}] STATIONS with NEAR ME fits at BODY 21: ${JSON.stringify(fs)}`);
    const fn = await H.fit(page, '#pg-radio .pn.nowp');
    check(!fn.small.length && !fn.sideways && !fn.cut.length, `[${vp.width}] NOW PLAYING with its timer fits at BODY 21: ${JSON.stringify(fn)}`);
    // FAVOURITES in his order: REORDER, ↓ on the first, DONE; kept across a reload; "play my favourites" follows it
    await page.click('#pg-radio .pn.favs .favorder button');
    await page.waitForSelector('#pg-radio .pn.favs .favmove', { timeout: 10000 }).catch(() => check(false, `[${vp.width}] REORDER showed no ↑ ↓`));
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

  // ---- NEXT and PREVIOUS through the stations he played lately (no favourites): a fixed order, every one reached; a favourite saved
  // from the chat shows on the open Radio at once; the reload's line names the station shown and goes once he plays again
  {
    const vp = H.PHONE2;
    const R = (n) => ({ name: `Lane ${n}`, url: `https://spec-lane.test-radio.example/${n.toLowerCase()}`, info: 'UK · News · 128 kbps' });
    const { ctx, page } = await radioPhone(H, vp, 'scan', { 'ghosty.radio.recent': JSON.stringify([R('C'), R('B'), R('A')]) });
    await H.open(page, 'radio');
    const walk = [['next station', 'Next', 'C'], ['previous station', 'Back', 'B'], ['previous station', 'Back', 'A'], ['next station', 'Next', 'B'], ['next station', 'Next', 'C']];
    for (const [w, k, n] of walk) {
      await say(H, page, w, new RegExp(`${k}: Lane ${n} \\(from your stations you played lately\\)`));
      check(await titled(page, `Lane ${n}`), `[recents] "${w}" plays Lane ${n}`);
    }
    await onAir(page);
    await say(H, page, 'turn the radio off in 20 minutes', /Sleep timer set/);
    await say(H, page, 'save this station', /Saved Lane C to your favourites/);
    const favNow = await page.$eval('#pg-radio .pn.favs', (e) => e.textContent ?? '').catch(() => '');
    check(/Lane C/.test(favNow), `[recents] the Radio's FAVOURITES shows the station saved from the chat without opening it again: ${favNow.slice(0, 120)}`);
    const star = await page.$$eval('#pg-radio button[aria-label="Keep Lane C in favourites"]', (b) => b.length).catch(() => -1);
    check(star === 0, `[recents] no star on the Radio still offers to keep Lane C: ${star}`);
    await say(H, page, 'remove this station from my favourites', /Took Lane C off your favourites/);
    check(!/Lane C/.test(await page.$eval('#pg-radio .pn.favs', (e) => e.textContent ?? '').catch(() => '')), '[recents] taken off FAVOURITES at once');
    await say(H, page, 'previous station', /Back: Lane B/);
    check(await titled(page, 'Lane B'), '[recents] stepped to Lane B with the timer still set');
    await page.reload();
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    await H.open(page, 'radio');
    const lost = await page.waitForSelector('#pg-radio .pn.nowp .nplost', { timeout: 8000 }).then((e) => e.textContent(), () => '');
    check(/^The page reloaded, so Lane B stopped/.test(lost ?? ''), `[recents] the reload's line names the station shown (Lane B, not Lane C where the timer was set): ${lost}`);
    await say(H, page, 'next station', /Next: Lane/);
    await onAir(page);
    await page.evaluate(() => window.__specActions.stop?.());
    await H.open(page, 'radio');
    // (the real condition: now playing drawn after the stop, before its lost-timer line is looked for)
    await page.waitForFunction(() => !!document.querySelector('#pg-radio .pn.nowp .nphero') && !/ON AIR/i.test(document.querySelector('#pg-radio .pn.nowp .nptx small')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
    check(!(await page.$('#pg-radio .pn.nowp .nplost')), '[recents] after he played again and stopped, the reload\'s line does not come back');
    await ctx.close();
  }
  log('radio: next and previous through recents');

  // ---- NEAR ME: the UK unless he changes it, kept on the phone, and where the radio starts
  {
    const vp = H.PHONE2;
    const { ctx, page } = await radioPhone(H, vp, 'scan', {});
    const asked = [];
    page.on('request', (r) => /radio-browser/.test(r.url()) && asked.push(decodeURIComponent(r.url())));
    await H.open(page, 'radio');
    await page.waitForSelector('#pg-radio .pn.stations .rw.station', { timeout: 15000 });
    check(asked.some((u) => /countrycode=GB/.test(u)) && (await page.inputValue('#pg-radio .radnear select')) === 'GB', `[${vp.width}] the radio starts near the UK: ${asked.join(' ').slice(0, 200)}`);
    const f = await H.fit(page, '#pg-radio .pn.stations');
    check(!f.small.length && !f.sideways && !f.cut.length, `[${vp.width}] STATIONS with NEAR ME fits at BODY 21: ${JSON.stringify(f)}`);
    const h = await page.$eval('#pg-radio .radnear select', (e) => e.getBoundingClientRect().height);
    check(h >= 43.5, `[${vp.width}] the country picker is 44 pt: ${h}`);
    await page.selectOption('#pg-radio .radnear select', 'FR');
    await page.waitForFunction(() => localStorage.getItem('ghosty.radio.country') === 'FR', null, { timeout: 3000 }).catch(() => check(false, `[${vp.width}] the country was not kept`));
    await page.waitForFunction(() => /popular in France|\d/.test(document.querySelector('#pg-radio .pn.stations')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
    check(asked.some((u) => /countrycode=FR/.test(u)), `[${vp.width}] France's stations were asked for`);
    // (the screen opens again by itself after the reload: what it asks for is counted from the reload on)
    asked.length = 0;
    await page.reload();
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    await H.open(page, 'radio');
    await page.waitForSelector('#pg-radio .pn.stations .rw.station', { timeout: 15000 }).catch(() => undefined);
    check((await page.inputValue('#pg-radio .radnear select')) === 'FR' && asked.some((u) => /countrycode=FR/.test(u)), `[${vp.width}] after a reload the radio starts near France: ${asked.join(' ').slice(0, 200)}`);
    await ctx.close();
  }
  log('radio: near me');

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
