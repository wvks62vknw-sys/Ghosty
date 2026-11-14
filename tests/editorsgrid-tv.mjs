// EDITORS GRID, PRESENTATIONS: present with a TV and the phone (NEXT ROUND, editors.u5), end to end:
//  1. PRESENT, then ON A TV: the slide opens in a window of its own (the TV's), filled by the slide; the phone becomes the presenter's view:
//     this slide and the next one side by side, the notes, the time, NEXT and BACK; said in his words.
//  2. NEXT on the phone moves the TV to slide 2; BACK brings it back.
//  3. The TV window closed: the phone says so and the talk carries on on the phone.
//  4. A phone that cannot open a second screen: said plainly, and the phone-only presenter view stays.
//  (and the sweep's rehearsal times: EXIT says how long the talk took and how long each slide was up)
export default async function (h) {
  const { open, check, until, LOOKS } = h;
  const st = (page) => page.evaluate(() => window.__ghosty.slides.present);
  const said = (page) => page.evaluate(() => window.__ghosty.slides.said);
  let n = 0;
  const blk = (t, text) => ({ id: `t${++n}`, t, runs: text ? [{ text }] : [] });
  const slide = (i, title, notes) => ({ id: `v${i}`, layout: 'bullets', title: blk('h1', title), body: [blk('ul', `Point ${i}`)], body2: [], shapes: [], notes, transition: 'none', builds: [] });
  const deck = { id: 'ktv', title: 'TV talk', theme: 'ghosty', master: { align: 'left', footer: true, numbers: true }, slides: [slide(1, 'Welcome', 'Say hello'), slide(2, 'The plan', 'Three steps'), slide(3, 'Thanks', '')], at: Date.now(), from: 'written with Ghosty' };
  const start = async (page) => {
    await page.evaluate(() => (location.hash = 'slides'));
    await page.waitForSelector('.slsheet .slopen', { timeout: 15000 });
    await page.locator('.slsheet .slopen').first().click();
    await until(page, () => window.__ghosty.slides.view === 'deck');
    await page.locator('.slsheet button:visible', { hasText: /^PRESENT$/ }).first().click();
    return until(page, () => window.__ghosty.slides.present.on && window.__ghosty.slides.present.i === 0);
  };

  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.slides': [deck] } });
  check(await start(page), 'tv 1: the talk starts on slide 1');
  const [tvPage] = await Promise.all([page.waitForEvent('popup', { timeout: 10000 }), page.locator('.slptop button', { hasText: /^ON A TV$/ }).click()]);
  check(await until(page, () => window.__ghosty.slides.present.tv === true && window.__ghosty.slides.present.tvSlide === 1), 'tv 1: ON A TV opens the slide in a window of its own');
  check(await tvPage.locator('#tv svg').count() === 1 && /Welcome/.test(await tvPage.locator('#tv').innerText()), 'tv 1: the TV’s window is filled by slide 1');
  check(/second screen|window of its own/.test(await said(page)) && /notes/.test(await said(page)), `tv 1: said in his words (${await said(page)})`);
  check(await page.locator('.slpnextbox svg').count() === 1 && /The plan/.test(await page.locator('.slpnextbox').getAttribute('aria-label')), 'tv 1: the phone shows the next slide beside this one');
  check(/Say hello/.test(await page.locator('.slpnotes').innerText()) && await page.locator('.slptop .sltime').count() === 1, 'tv 1: and the notes and the time');
  check(await page.locator('.slptop button', { hasText: /^TV OFF$/ }).getAttribute('aria-pressed') === 'true', 'tv 1: the key now says TV OFF');

  // 2. NEXT and BACK drive the TV
  await page.locator('.slpkeys button', { hasText: /^NEXT$/ }).click();
  check(await until(page, () => window.__ghosty.slides.present.tvSlide === 2) && /The plan/.test(await tvPage.locator('#tv').innerText()), 'tv 2: NEXT on the phone puts slide 2 on the TV');
  check(/Thanks/.test(await page.locator('.slpnextbox').getAttribute('aria-label')), 'tv 2: and the phone shows slide 3 as the next');
  await page.locator('.slpkeys button', { hasText: /^BACK$/ }).click();
  check(await until(page, () => window.__ghosty.slides.present.tvSlide === 1) && /Welcome/.test(await tvPage.locator('#tv').innerText()), 'tv 2: BACK brings slide 1 back on the TV');

  // 3. the TV window closed
  await tvPage.close();
  check(await until(page, () => window.__ghosty.slides.present.tv === false, null, 5000), 'tv 3: the TV window closed: the phone knows within a second');
  check(/TV window was closed; the talk carries on on the phone/.test(await said(page)), `tv 3: said (${await said(page)})`);
  check(await page.locator('.slptop button', { hasText: /^ON A TV$/ }).count() === 1 && await page.locator('.slpnextbox').isHidden(), 'tv 3: the key offers ON A TV again; the phone view is as before');
  check((await st(page)).on, 'tv 3: the talk is still on');
  // (the sweep) rehearsal times: EXIT says how long the talk took and each slide was up
  await page.locator('.slptop button', { hasText: /^EXIT$/ }).click();
  check(await until(page, () => /^The talk is over, \d+:\d\d in all: slide 1 \d+:\d\d/.test(window.__ghosty.slides.said)), `sweep: EXIT says the talk’s time and each slide’s (${await said(page)})`);
  await ctx.close();

  // 4. no second screen to be had
  const { ctx: c2, page: p2 } = await open({ look: LOOKS.scan, seed: { 'ghosty.slides': [deck] }, init: () => { window.open = () => null; } });
  check(await start(p2), 'tv 4: the talk starts');
  await p2.locator('.slptop button', { hasText: /^ON A TV$/ }).click();
  check(await until(p2, () => /can’t open a second screen/.test(window.__ghosty.slides.said)), `tv 4: no second screen is said plainly (${await said(p2)})`);
  check(/stays on the phone/.test(await p2.locator('.slpsaid').innerText()) && !(await st(p2)).tv, 'tv 4: on the talk itself, and the phone-only presenter view stays');
  await c2.close();
}
