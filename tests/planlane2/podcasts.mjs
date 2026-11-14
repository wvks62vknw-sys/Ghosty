// [planlane2:podcasts] THE SLEEP TIMER AFTER A RELOAD (plan.u7): the stop time is kept on the phone, and after a reload the Radio offers to
// carry on (PLAY AND KEEP THE TIMER, one tap) instead of only saying it was lost; the time left shows in the top bar's now-playing chip
// ("Spec Lane FM · stops 23:10"). PLAY on its own plays without the timer, and then a reload offers nothing. At 440 × 956 and 390 × 844 with
// BODY 21, and the offer in the seven looks. The stream is stood in by the harness (Spec Lane FM).

const FM = { name: 'Spec Lane FM', url: 'https://spec-lane.test-radio.example/one', info: 'UK · News · 128 kbps' };
const hhmm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

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
async function radioPhone(H, vp, world) {
  const p = await H.phone(vp, world, { 'ghosty.radio.last': JSON.stringify(FM) }, 21);
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
    if (vp === H.PHONE) await page.screenshot({ path: `${H.out}/planlane2-podcasts-offer-${vp.width}.png` });
    // one tap: it plays again, the timer set to the very same stop time, the 30 MIN key lit, the chip says when it stops
    await keep.click();
    check(await onAir(page), `[${vp.width}] PLAY AND KEEP THE TIMER plays`);
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.radio.sleep') ?? 'null'));
    check(kept?.at === at, `[${vp.width}] the same stop time is kept on the phone: ${JSON.stringify(kept)} vs ${at}`);
    await page.waitForFunction((t) => (document.querySelector('#pg-radio .npsleepl')?.textContent ?? '').startsWith(`Goes quiet at ${t}`), hhmm(at), { timeout: 5000 }).catch(async () => check(false, `[${vp.width}] the timer's line: ${await page.textContent('#pg-radio .npsleepl').catch(() => '')}`));
    check((await page.getAttribute('#pg-radio .npsleepk button[aria-label="Stop the radio in 30 minutes"]', 'aria-pressed').catch(() => '')) === 'true', `[${vp.width}] the key that set it is still lit`);
    check(!(await page.$('#pg-radio .pn.nowp .nplost')), `[${vp.width}] the offer goes once it plays`);
    const chip = await chipText(page);
    check(chip === `♪ Spec Lane FM · stops ${hhmm(at)}`, `[${vp.width}] the top bar's chip: ${chip}`);
    const cf = await page.evaluate(() => {
      const c = document.querySelector('#top .nowplaying')?.getBoundingClientRect();
      const s = document.querySelector('#top .nowplaying .npstops')?.getBoundingClientRect();
      return c && s ? { inside: s.left >= c.left - 0.5 && s.right <= c.right + 0.5, w: s.width, cw: c.width, over: document.documentElement.scrollWidth > innerWidth } : null;
    });
    check(!!cf && cf.inside && cf.w > 20 && !cf.over, `[${vp.width}] the stop time is whole inside the chip, nothing sideways: ${JSON.stringify(cf)}`);
    const title = await page.evaluate(() => { const t = document.querySelector('#top .navtitle'); return t ? { text: t.textContent, cut: t.scrollWidth > t.clientWidth + 1 } : null; });
    check(!!title && !title.cut, `[${vp.width}] the screen's title is not squeezed by the chip: ${JSON.stringify(title)}`);
    if (vp === H.PHONE) await page.screenshot({ path: `${H.out}/planlane2-podcasts-chip-${vp.width}.png` });
    // a long name is cut before the time ever is
    await page.evaluate(() => window.__ghosty?.run?.('play_radio', { name: 'Spec Lane FM with a very long station name for the chip', url: 'https://spec-lane.test-radio.example/one', info: 'UK' }));
    await page.waitForFunction(() => /very long/.test(document.querySelector('#top .nowplaying')?.textContent ?? ''), null, { timeout: 5000 }).catch(() => undefined);
    const lf = await page.evaluate(() => {
      const c = document.querySelector('#top .nowplaying')?.getBoundingClientRect();
      const s = document.querySelector('#top .nowplaying .npstops')?.getBoundingClientRect();
      return c && s ? { inside: s.right <= c.right + 0.5, text: document.querySelector('#top .nowplaying .npstops')?.textContent } : null;
    });
    check(!!lf && lf.inside && lf.text === ` · stops ${hhmm(at)}`, `[${vp.width}] with a long name the stop time stays whole: ${JSON.stringify(lf)}`);
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

  // ---- 3. the offer in the seven looks, at BODY 21
  for (const world of H.WORLDS) {
    const { ctx, page } = await radioPhone(H, H.PHONE2, world);
    await H.open(page, 'radio');
    await leftByReload(H, page, Date.now() + 40 * 60_000);
    await page.waitForSelector('#pg-radio .pn.nowp .npcarry', { timeout: 8000 }).catch(() => check(false, `[${world}] no offer`));
    const f = await H.fit(page, '#pg-radio .pn.nowp');
    check(!f.small.length && !f.sideways && !f.cut.length, `[${world}] the offer fits: ${JSON.stringify(f)}`);
    const vis = await page.evaluate(() => { const e = document.querySelector('#pg-radio .pn.nowp .npcarry'); const s = e && getComputedStyle(e); return !!s && s.visibility !== 'hidden' && s.opacity !== '0' && e.getBoundingClientRect().height >= 43.5; });
    check(vis, `[${world}] PLAY AND KEEP THE TIMER is seen, 44 pt`);
    await ctx.close();
  }
  log('podcasts: the offer in the seven looks');
}
