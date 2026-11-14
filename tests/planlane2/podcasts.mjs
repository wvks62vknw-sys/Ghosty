// [planlane2:podcasts] THE SLEEP TIMER AFTER A RELOAD (plan.u7): the stop time is kept on the phone, and after a reload the Radio offers to
// carry on (PLAY AND KEEP THE TIMER, one tap) instead of only saying it was lost; the time left shows in the top bar's now-playing chip
// ("Spec Lane FM · stops 23:10"). PLAY on its own plays without the timer, and then a reload offers nothing. At 440 × 956 and 390 × 844 with
// BODY 21, and the offer in the seven looks. The stream is stood in by the harness (Spec Lane FM).

const FM = { name: 'Spec Lane FM', url: 'https://spec-lane.test-radio.example/one', info: 'UK · News · 128 kbps' };
// (the page shows London's time, whatever zone node runs in)
const hhmm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });

/** A stand-in stream long enough for the walk (the harness's tone runs out after 30 s, and a stream that ends is said as ended). */
function longTone(sec = 240, rate = 8000) {
  const n = sec * rate;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 9) * 2000), 44 + i * 2);
  return b;
}
const LONG = longTone();
async function radioPhone(H, vp, world, seed = {}) {
  const p = await H.phone(vp, world, { 'ghosty.radio.last': JSON.stringify(FM), ...seed }, 21);
  await p.page.route(/^https:\/\/spec-lane\.test-radio\.example\//, (r) => r.fulfill({ status: 200, contentType: 'audio/wav', body: LONG }));
  return p;
}
/** Put a sleep timer on the phone as a page that was playing would have left it, and reload (the reload is what stopped the radio). */
async function leftByReload(H, page, at, kind = '30') {
  await page.evaluate(({ at, kind, name }) => localStorage.setItem('ghosty.radio.sleep', JSON.stringify({ at, kind, name })), { at, kind, name: FM.name });
  await page.reload();
  await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
  await H.open(page, 'radio');
}
const onAir = (page) => page.waitForFunction(() => /ON AIR/i.test(document.querySelector('#pg-radio .pn.nowp .nptx small')?.textContent ?? '') || navigator.mediaSession?.playbackState === 'playing', null, { timeout: 15000 }).then(() => true, () => false);
/** The chip once it reads `want` (a stream that buffers says Connecting for a moment), else what it reads. */
const chipSays = (page, want) => page.waitForFunction((w) => document.querySelector('#top .nowplaying')?.textContent === w, want, { timeout: 8000 }).then(() => want, () => chipText(page));
const chipText = (page) => page.evaluate(() => { const b = document.querySelector('#top .nowplaying'); return b && !b.hidden ? b.textContent ?? '' : ''; });

export async function run(H) {
  const { check, log } = H;
  // ---- 1. the words, pure
  const W = await H.pure('apps/web/src/features/radio/words.ts');
  const t23 = new Date(2026, 10, 13, 23, 10).getTime();
  check(W.lostLine(t23, 'Radio 4') === 'The page reloaded, so Radio 4 stopped. Its sleep timer for 23:10 is kept: tap PLAY AND KEEP THE TIMER to carry on.', `the reload's line: ${W.lostLine(t23, 'Radio 4')}`);
  check(W.CARRY_ON === 'PLAY AND KEEP THE TIMER', 'the key in his words');
  check(W.chipStops(t23) === 'stops 23:10', `the chip's part: ${W.chipStops(t23)}`);
  check(W.carriedOn(t23, t23 - 25 * 60_000) === 'Playing again: the radio still goes quiet at 23:10 (in 25 min), then stops.', `the toast: ${W.carriedOn(t23, t23 - 25 * 60_000)}`);
  check(W.carriedOn(t23, t23 - 25 * 60_000, 'Radio 4') === 'Playing Radio 4 again: it still goes quiet at 23:10 (in 25 min), then stops.', `the chat's line: ${W.carriedOn(t23, t23 - 25 * 60_000, 'Radio 4')}`);
  const A = await H.pure('apps/web/src/features/radio/asks.ts');
  for (const w of ['carry on with the sleep timer', 'play and keep the sleep timer', 'Play the radio again and keep the sleep timer', 'keep the sleep timer', 'put the sleep timer back on', 'bring back the sleep timer', 'carry on with the radio and the timer'])
    check(A.radioAsked(w)?.what === 'carryOn', `"${w}" carries on: ${JSON.stringify(A.radioAsked(w))}`);
  // never VOICE's words, and the old ones keep their meaning
  // (nor a bare "it" or "timer": the Reader and a video have their own)
  for (const w of ['play music', 'play the radio', 'stop the radio', 'open the radio', 'keep the radio on', 'play my podcast', 'play it and keep the timer', 'play and keep the timer', 'play it again and keep the sleep timer'])
    check(A.radioAsked(w)?.what !== 'carryOn', `"${w}" is not the carry-on: ${JSON.stringify(A.radioAsked(w))}`);
  check(A.radioAsked('keep the radio on')?.what === 'sleepOff', '"keep the radio on" still takes the timer off');
  check(W.notCarried('offline', 'Radio 4', t23) === 'You’re offline, so Radio 4 can’t play. Its sleep timer for 23:10 is still kept.', `offline: ${W.notCarried('offline', 'Radio 4', t23)}`);
  check(W.notCarried('refused', 'Radio 4', t23) === 'Radio 4 wouldn’t play on this phone. Its sleep timer for 23:10 is still kept.', `refused: ${W.notCarried('refused', 'Radio 4', t23)}`);
  check(W.keptOff(t23) === 'Sleep timer off: the one for 23:10 that the reload kept is gone.', `off: ${W.keptOff(t23)}`);
  check(W.keptPassed(t23) === 'The 23:10 timer has passed. Tap PLAY to play without it.', `passed: ${W.keptPassed(t23)}`);
  log('podcasts: the sleep timer words');

  // ---- 2. the phone: the offer after a reload, one tap carries on with the same stop time, the chip shows it; PLAY alone drops it
  for (const vp of [H.PHONE, H.PHONE2]) {
    const { ctx, page } = await radioPhone(H, vp, 'scan');
    await H.open(page, 'radio');
    const at = Date.now() + 40 * 60_000;
    await leftByReload(H, page, at);
    const line = await page.waitForSelector('#pg-radio .pn.nowp .nplost', { timeout: 8000 }).then((e) => e.textContent(), () => '');
    check(line === `The page reloaded, so Spec Lane FM stopped. Its sleep timer for ${hhmm(at)} is kept: tap PLAY AND KEEP THE TIMER to carry on.`, `[${vp.width}] after a reload the timer is offered back: ${line}`);
    const keep = page.locator('#pg-radio .pn.nowp .npcarry');
    check((await keep.textContent().catch(() => ''))?.trim() === '▶ PLAY AND KEEP THE TIMER', `[${vp.width}] the key: ${await keep.textContent().catch(() => '')}`);
    check(await page.isVisible('#pg-radio .pn.nowp .keyrow button:not(.npcarry):text-is("▶ PLAY")'), `[${vp.width}] PLAY without the timer is there too`);
    const fo = await H.fit(page, '#pg-radio .pn.nowp');
    check(!fo.small.length && !fo.sideways && !fo.cut.length, `[${vp.width}] the offer fits at BODY 21: ${JSON.stringify(fo)}`);
    const kh = await keep.evaluate((e) => e.getBoundingClientRect().height).catch(() => 0);
    check(kh >= 43.5, `[${vp.width}] the key is 44 pt: ${kh}`);
    const own = await page.evaluate(() => {
      const k = document.querySelector('#pg-radio .pn.nowp .npcarry')?.getBoundingClientRect();
      const r = document.querySelector('#pg-radio .pn.nowp .npcarry')?.parentElement?.getBoundingClientRect();
      const pl = [...document.querySelectorAll('#pg-radio .pn.nowp .keyrow button:not(.npcarry)')].find((b) => b.textContent?.trim() === '▶ PLAY')?.getBoundingClientRect();
      return k && r && pl ? { wide: k.width >= 0.9 * r.width, above: k.bottom <= pl.top + 0.5, kw: k.width, rw: r.width } : null;
    });
    check(!!own && own.wide && own.above, `[${vp.width}] PLAY AND KEEP THE TIMER is on its own line, above ▶ PLAY: ${JSON.stringify(own)}`);
    if (vp === H.PHONE) await page.screenshot({ path: `${H.out}/planlane2-podcasts-offer-${vp.width}.png` });
    // one tap: it plays again, the timer set to the very same stop time, the 30 MIN key lit, the chip says when it stops
    await keep.click();
    check(await onAir(page), `[${vp.width}] PLAY AND KEEP THE TIMER plays`);
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.radio.sleep') ?? 'null'));
    check(kept?.at === at, `[${vp.width}] the same stop time is kept on the phone: ${JSON.stringify(kept)} vs ${at}`);
    await page.waitForFunction((t) => (document.querySelector('#pg-radio .npsleepl')?.textContent ?? '').startsWith(`Goes quiet at ${t}`), hhmm(at), { timeout: 5000 }).catch(async () => check(false, `[${vp.width}] the timer's line: ${await page.textContent('#pg-radio .npsleepl').catch(() => '')}`));
    check((await page.getAttribute('#pg-radio .npsleepk button[aria-label="Stop the radio in 30 minutes"]', 'aria-pressed').catch(() => '')) === 'true', `[${vp.width}] the key that set it is still lit`);
    check(!(await page.$('#pg-radio .pn.nowp .nplost')), `[${vp.width}] the offer goes once it plays`);
    const chip = await chipSays(page, `♪ Spec Lane FM · stops ${hhmm(at)}`);
    check(chip === `♪ Spec Lane FM · stops ${hhmm(at)}`, `[${vp.width}] the top bar's chip: ${chip}`);
    const cf = await page.evaluate(() => {
      const c = document.querySelector('#top .nowplaying')?.getBoundingClientRect();
      const s = document.querySelector('#top .nowplaying .npstops')?.getBoundingClientRect();
      return c && s ? { inside: s.left >= c.left - 0.5 && s.right <= c.right + 0.5, w: s.width, cw: c.width, over: document.documentElement.scrollWidth > innerWidth } : null;
    });
    check(!!cf && cf.inside && cf.w > 20 && !cf.over, `[${vp.width}] the stop time is whole inside the chip, nothing sideways: ${JSON.stringify(cf)}`);
    // the space before the dot is drawn (a space at the start of a flex item collapses: "Spec Lane FM· stops")
    const gap = await page.evaluate(() => {
      const t = document.querySelector('#top .nowplaying .npstops')?.firstChild;
      if (!t || t.nodeType !== 3 || t.data[0] !== ' ') return -1;
      const r = document.createRange();
      r.setStart(t, 0);
      r.setEnd(t, 1);
      return r.getBoundingClientRect().width;
    });
    check(gap > 2, `[${vp.width}] the space before "· stops" is drawn: ${gap}`);
    const title = await page.evaluate(() => { const t = document.querySelector('#top .navtitle'); return t ? { text: t.textContent, cut: t.scrollWidth > t.clientWidth + 1 } : null; });
    check(!!title && !title.cut, `[${vp.width}] the screen's title is not squeezed by the chip: ${JSON.stringify(title)}`);
    if (vp === H.PHONE) await page.screenshot({ path: `${H.out}/planlane2-podcasts-chip-${vp.width}.png` });
    // a long name is cut before the time ever is: the last station a long-named one, the reload, PLAY AND KEEP THE TIMER
    await page.evaluate(() => window.__specActions.stop?.());
    await page.evaluate((fm) => localStorage.setItem('ghosty.radio.last', JSON.stringify({ ...fm, name: 'Spec Lane FM with a very long station name for the chip' })), FM);
    const atLong = Date.now() + 50 * 60_000;
    await leftByReload(H, page, atLong);
    await page.click('#pg-radio .pn.nowp .npcarry').catch(() => check(false, `[${vp.width}] no offer for the long name`));
    await page.waitForFunction(() => /very long/.test(document.querySelector('#top .nowplaying')?.textContent ?? '') && !!document.querySelector('#top .nowplaying .npstops'), null, { timeout: 8000 }).catch(async () => check(false, `[${vp.width}] the long name never reached the chip: ${await chipText(page)}`));
    const lf = await page.evaluate(() => {
      const c = document.querySelector('#top .nowplaying')?.getBoundingClientRect();
      const st = document.querySelector('#top .nowplaying .npstops');
      const nm = document.querySelector('#top .nowplaying .npname');
      const s = st?.getBoundingClientRect();
      return c && s && nm ? { inside: s.left >= c.left - 0.5 && s.right <= c.right + 0.5, whole: st.scrollWidth <= st.clientWidth + 1, cut: nm.scrollWidth > nm.clientWidth, text: st.textContent } : null;
    });
    check(!!lf && lf.inside && lf.whole && lf.cut && lf.text === ` · stops ${hhmm(atLong)}`, `[${vp.width}] with a long name the name is cut and the stop time stays whole: ${JSON.stringify(lf)}`);
    await page.evaluate((fm) => localStorage.setItem('ghosty.radio.last', JSON.stringify(fm)), FM);
    // TIMER OFF: the chip says the name alone again
    await H.open(page, 'radio');
    await page.click('#pg-radio .npsleepk button:text-is("TIMER OFF")').catch(() => check(false, `[${vp.width}] no TIMER OFF`));
    await page.waitForFunction(() => !document.querySelector('#top .nowplaying .npstops'), null, { timeout: 5000 }).catch(() => check(false, `[${vp.width}] the chip still says when it stops after TIMER OFF`));
    // PLAY alone: it plays without the timer, and the next reload offers nothing
    await page.evaluate(() => window.__specActions.stop?.());
    await leftByReload(H, page, Date.now() + 25 * 60_000, 'hour');
    await page.waitForSelector('#pg-radio .pn.nowp .npcarry', { timeout: 8000 }).catch(() => check(false, `[${vp.width}] the second offer`));
    await page.click('#pg-radio .pn.nowp .keyrow button:not(.npcarry):text-is("▶ PLAY")');
    check(await onAir(page), `[${vp.width}] PLAY plays`);
    check((await page.evaluate(() => localStorage.getItem('ghosty.radio.sleep'))) === null, `[${vp.width}] PLAY alone drops the kept timer`);
    check(!/stops/.test(await chipText(page)), `[${vp.width}] no stop time in the chip without a timer: ${await chipText(page)}`);
    await page.reload();
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    await H.open(page, 'radio');
    await page.waitForSelector('#pg-radio .pn.nowp .nphero', { timeout: 8000 });
    check(!(await page.$('#pg-radio .pn.nowp .nplost')) && !(await page.$('#pg-radio .pn.nowp .npcarry')), `[${vp.width}] no offer after a reload with no timer`);
    // a timer whose time has passed is never offered
    await leftByReload(H, page, Date.now() - 60_000);
    await page.waitForSelector('#pg-radio .pn.nowp .nphero', { timeout: 8000 });
    check(!(await page.$('#pg-radio .pn.nowp .npcarry')), `[${vp.width}] a timer that would have ended is not offered`);
    await ctx.close();
  }
  log('podcasts: the sleep timer after a reload, the phone');

  // ---- 2b. the same by chat, with no model: how long is left says it is kept; "carry on with the sleep timer" plays on with it
  {
    const vp = H.PHONE2;
    const { ctx, page } = await radioPhone(H, vp, 'scan');
    await H.open(page, 'radio');
    const at = Date.now() + 35 * 60_000;
    await leftByReload(H, page, at, '45');
    const left = await H.ask(page, 'how long until the radio stops', /sleep timer for \d\d:\d\d is kept/);
    check(left.ok && left.text.includes(`The page reloaded, so Spec Lane FM stopped. Its sleep timer for ${hhmm(at)} is kept: say “carry on with the sleep timer” or tap PLAY AND KEEP THE TIMER to carry on.`), `[chat] how long is left, after a reload: ${left.text}`);
    const go = await H.ask(page, 'carry on with the sleep timer', /again: it still goes quiet/);
    check(go.ok && new RegExp(`Playing Spec Lane FM again: it still goes quiet at ${hhmm(at)} \\(in 3\\d min\\), then stops\\.`).test(go.text) && !H.RAW.test(go.text), `[chat] carry on: ${go.text}`);
    check(await onAir(page), '[chat] it plays');
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.radio.sleep') ?? 'null'));
    check(kept?.at === at && kept?.kind === '45', `[chat] the same timer, the 45 MIN key's: ${JSON.stringify(kept)}`);
    const cc = await chipSays(page, `♪ Spec Lane FM · stops ${hhmm(at)}`);
    check(cc === `♪ Spec Lane FM · stops ${hhmm(at)}`, `[chat] the chip: ${cc}`);
    const again = await H.ask(page, 'carry on with the sleep timer', /already on/);
    check(again.ok && new RegExp(`Spec Lane FM is already on, and stops at ${hhmm(at)}, in 3\\d min\\.`).test(again.text), `[chat] asked again while it plays: ${again.text}`);
    await page.evaluate(() => window.__specActions.stop?.());
    const none = await H.ask(page, 'carry on with the sleep timer', /no sleep timer to carry on/);
    check(none.ok, `[chat] with nothing kept: ${none.text}`);
    await ctx.close();
  }
  log('podcasts: the carry-on by chat');

  // ---- 2c. when it cannot start: offline, or an address the phone refuses. No "Playing again", the timer stays kept and unset, the
  // offer stays; the chat says why and keeps it; "sleep timer off" drops it; STOP drops it from the screen and the phone together;
  // the key tapped after its time passed plays nothing and says so
  {
    const vp = H.PHONE2;
    const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.radio.sleep') ?? 'null'));
    const toasts = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent ?? '').join(' | '));
    const { ctx, page } = await radioPhone(H, vp, 'scan');
    await H.open(page, 'radio');
    let at = Date.now() + 30 * 60_000;
    await leftByReload(H, page, at);
    // offline (the phone says so): the tap does not start it
    await page.evaluate(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false }); window.dispatchEvent(new Event('offline')); });
    await page.click('#pg-radio .pn.nowp .npcarry');
    await page.waitForFunction(() => /offline, so Spec Lane FM can’t play/.test(document.querySelector('#pg-radio .pn.nowp')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => check(false, '[offline] the screen does not say why'));
    check(!/Playing again/.test(await toasts()), `[offline] no "Playing again": ${await toasts()}`);
    check((await kept())?.at === at, `[offline] the timer stays kept on the phone: ${JSON.stringify(await kept())}`);
    check(await page.isVisible('#pg-radio .pn.nowp .npcarry'), '[offline] the offer stays');
    check(!/stops/.test(await chipText(page)), `[offline] no stop time in the chip: ${await chipText(page)}`);
    const off1 = await H.ask(page, 'carry on with the sleep timer', /still kept/);
    check(off1.ok && off1.text.includes(`You’re offline, so Spec Lane FM can’t play. Its sleep timer for ${hhmm(at)} is still kept.`) && !/Playing/.test(off1.text), `[offline chat] ${off1.text}`);
    const off2 = await H.ask(page, 'carry on with the sleep timer', /still kept|no sleep timer/);
    check(off2.ok && /still kept/.test(off2.text), `[offline chat] said again, it is still kept: ${off2.text}`);
    // "sleep timer off": the kept one is dropped, truthfully
    const offT = await H.ask(page, 'sleep timer off', /Sleep timer off|no sleep timer/);
    check(offT.ok && offT.text.includes(`Sleep timer off: the one for ${hhmm(at)} that the reload kept is gone.`), `[chat] sleep timer off after a reload: ${offT.text}`);
    check((await kept()) === null, `[chat] the kept timer is gone from the phone: ${JSON.stringify(await kept())}`);
    await H.open(page, 'radio');
    check(!(await page.$('#pg-radio .pn.nowp .npcarry')) && !(await page.$('#pg-radio .pn.nowp .nplost')), '[chat] the offer goes with it');
    await ctx.close();
  }
  {
    // a remembered address that is not https: refused the same way
    const { ctx, page } = await radioPhone(H, H.PHONE2, 'scan', { 'ghosty.radio.last': JSON.stringify({ ...FM, url: 'http://spec-lane.test-radio.example/one' }) });
    const kept = () => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.radio.sleep') ?? 'null'));
    await H.open(page, 'radio');
    const at = Date.now() + 30 * 60_000;
    await leftByReload(H, page, at);
    await page.click('#pg-radio .pn.nowp .npcarry');
    await page.waitForFunction(() => /wouldn’t play on this phone/.test(document.querySelector('#pg-radio .pn.nowp')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => check(false, '[refused] the screen does not say why'));
    check(!/Playing again/.test(await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '))), '[refused] no "Playing again"');
    check((await kept())?.at === at && (await page.isVisible('#pg-radio .pn.nowp .npcarry')), `[refused] the timer stays kept and offered: ${JSON.stringify(await kept())}`);
    const r = await H.ask(page, 'carry on with the sleep timer', /still kept/);
    check(r.ok && r.text.includes(`Spec Lane FM wouldn’t play on this phone. Its sleep timer for ${hhmm(at)} is still kept.`), `[refused chat] ${r.text}`);
    // STOP (the palette's Stop radio, the brain's stop_audio): the kept timer goes from the screen and the phone together
    await page.evaluate(() => window.__specActions.stop?.());
    await H.open(page, 'radio');
    await page.waitForSelector('#pg-radio .pn.nowp .nphero', { timeout: 8000 });
    check((await kept()) === null && !(await page.$('#pg-radio .pn.nowp .npcarry')) && !(await page.$('#pg-radio .pn.nowp .nplost')), `[stop] the kept timer is gone everywhere: ${JSON.stringify(await kept())}`);
    await ctx.close();
  }
  {
    // the key tapped just after the kept stop time passed: nothing plays, and he is told
    const { ctx, page } = await radioPhone(H, H.PHONE2, 'scan');
    await H.open(page, 'radio');
    const at = Date.now() + 10 * 60_000;
    await leftByReload(H, page, at);
    await page.waitForSelector('#pg-radio .pn.nowp .npcarry', { timeout: 8000 });
    await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 11 * 60_000; });
    await page.click('#pg-radio .pn.nowp .npcarry');
    const said = await page.waitForFunction((w) => [...document.querySelectorAll('.toast')].some((t) => (t.textContent ?? '').includes(w)), `The ${hhmm(at)} timer has passed. Tap PLAY to play without it.`, { timeout: 5000 }).then(() => true, () => false);
    check(said, '[passed] the tap says the timer has passed');
    check(!(await chipText(page)), `[passed] nothing plays: ${await chipText(page)}`);
    check(!(await page.$('#pg-radio .pn.nowp .npcarry')) && (await page.isVisible('#pg-radio .pn.nowp .keyrow button:text-is("▶ PLAY")')), '[passed] the offer goes; ▶ PLAY stays');
    await ctx.close();
  }
  log('podcasts: when it cannot carry on');

  // ---- 3. the offer in the seven looks, at BODY 21
  for (const world of H.WORLDS) {
    // (the timer a reload left, put on the phone before it opens: the same as a reload, one load fewer)
    const { ctx, page } = await radioPhone(H, H.PHONE2, world, { 'ghosty.radio.sleep': JSON.stringify({ at: Date.now() + 40 * 60_000, kind: '30', name: FM.name }) });
    await H.open(page, 'radio');
    await page.waitForSelector('#pg-radio .pn.nowp .npcarry', { timeout: 8000 }).catch(() => check(false, `[${world}] no offer`));
    const f = await H.fit(page, '#pg-radio .pn.nowp');
    check(!f.small.length && !f.sideways && !f.cut.length, `[${world}] the offer fits: ${JSON.stringify(f)}`);
    const vis = await page.evaluate(() => { const e = document.querySelector('#pg-radio .pn.nowp .npcarry'); const s = e && getComputedStyle(e); return !!s && s.visibility !== 'hidden' && s.opacity !== '0' && e.getBoundingClientRect().height >= 43.5; });
    check(vis, `[${world}] PLAY AND KEEP THE TIMER is seen, 44 pt`);
    await ctx.close();
  }
  log('podcasts: the offer in the seven looks');
}
