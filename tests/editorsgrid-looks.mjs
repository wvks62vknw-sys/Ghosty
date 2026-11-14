// EDITORS GRID, THE LOOKS: every new screen of this round's spreadsheet and presentation tools in all seven looks at 440 × 956, The Scan at
// 390 × 844 and BODY 21: every key 44 pt, nothing sideways, no words cut.
//   - PRESENTATIONS: a slide's SLIDE keys (the transitions with MAGIC MOVE, the builds with their PowerPoint note); the talk ON A TV.
//   - SPREADSHEETS: RULES with a rule in its list (the kinds, the number, the colours, EDIT and DELETE); SUMMARY with a table's BY and OF.
export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const sh = (page) => page.locator('.slsheet');
  const key = (page, label) => sh(page).locator('button:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  const runs0 = [...Object.entries(LOOKS).map(([name, look]) => ({ name, look, viewport: PHONE })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  const runs = process.env.ONE ? runs0.slice(0, 1) : runs0;
  for (const r of runs) {
    const T = Date.now();
    const lap = (w) => process.env.LAPS && console.log(`  ${w}: ${Date.now() - T} ms`);
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport });
    lap('open');
    // PRESENTATIONS: the SLIDE keys
    await page.evaluate(() => (location.hash = 'slides'));
    await page.waitForSelector('#pg-slides .slsheet', { timeout: 15000 });
    await key(page, 'START BLANK').click();
    await until(page, () => window.__ghosty.slides.view === 'deck');
    await sh(page).locator('.slcard').nth(1).click();
    await until(page, () => window.__ghosty.slides.view === 'slide');
    await sh(page).locator('.slpill', { hasText: /^SLIDE$/ }).click();
    if (r.big) await body21(page);
    lap('slide');
    await settle(page);
    lap('settle');
    check(await key(page, 'MAGIC MOVE').count() === 1, `looks, ${r.name}: MAGIC MOVE is a key among the transitions`);
    await measure(page, '#pg-slides', `looks, ${r.name}: a slide's SLIDE keys with MAGIC MOVE and the builds`);
    // PRESENTATIONS: the talk with the slide ON A TV (the presenter's view: this slide, the next, notes, the time)
    await key(page, 'ALL SLIDES').click();
    await until(page, () => window.__ghosty.slides.view === 'deck');
    await key(page, 'PRESENT').click();
    await until(page, () => window.__ghosty.slides.present.on);
    const [pop] = await Promise.all([page.waitForEvent('popup', { timeout: 10000 }), page.locator('.slptop button', { hasText: /^ON A TV$/ }).click()]);
    check(await until(page, () => window.__ghosty.slides.present.tv === true), `looks, ${r.name}: the talk is ON A TV`);
    await measure(page, '.slpresent', `looks, ${r.name}: the presenter's view with the slide on a TV`);
    await pop.close();
    await page.locator('.slptop button', { hasText: /^EXIT$/ }).click();
    lap('measured');
    // SPREADSHEETS: RULES with a rule listed
    await page.evaluate(() => (location.hash = 'sheets'));
    await page.waitForSelector('#pg-sheets .shsheet', { timeout: 15000 });
    await page.locator('#pg-sheets .shbar button', { hasText: 'NEW' }).first().click();
    await until(page, () => window.__ghosty.sheets.view === 'book');
    await page.locator('.shaddr').fill('A1:A5');
    await page.locator('.shaddr').press('Enter');
    await page.locator('.shpill', { hasText: /^RULES$/ }).click();
    await page.locator('.shpanel:not([hidden]) button', { hasText: /^DUPLICATES$/ }).click();
    await page.locator('.shpanel:not([hidden]) button', { hasText: /^ADD THE RULE$/ }).click();
    await until(page, () => window.__ghosty.sheets.rules.length === 1);
    lap('rule');
    await page.locator('.shpanel:not([hidden]) button', { hasText: /^BETWEEN$/ }).click();
    await settle(page);
    check(await page.locator('.shrule').count() === 1, `looks, ${r.name}: the rule is listed`);
    await measure(page, '#pg-sheets', `looks, ${r.name}: SPREADSHEETS → RULES with a rule listed`);
    // SUMMARY with a little table's BY and OF keys
    for (const [a, t] of [['A1', 'Shop'], ['B1', 'Amount'], ['A2', 'Tesco'], ['B2', '12']]) {
      await page.locator('.shaddr').fill(a);
      await page.locator('.shaddr').press('Enter');
      await page.locator('.shline').fill(t);
      await page.locator('.shline').press('Enter');
    }
    await page.locator('.shaddr').fill('A1:B2');
    await page.locator('.shaddr').press('Enter');
    await page.locator('.shpill', { hasText: /^SUMMARY$/ }).click();
    check(await until(page, () => /The table: 2 columns/.test(document.querySelector('.shpanel:not([hidden])')?.textContent ?? '')), `looks, ${r.name}: SUMMARY reads the table`);
    await settle(page);
    await measure(page, '#pg-sheets', `looks, ${r.name}: SPREADSHEETS → SUMMARY with BY and OF`);
    await ctx.close();
  }
}
