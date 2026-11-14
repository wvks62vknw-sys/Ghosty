// GRID PRO, THE LOOKS: the pro edition's new panels in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21: every key 44 pt,
// nothing sideways, no words cut. SPREADSHEETS → CHART (the nine kinds, title, axis words, key, colours, sparklines) and CELLS (borders,
// merge, wrap, number formats, table style, input checks) with a checked cell's picker; PRESENTATIONS → FREE with an item chosen.
export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const runs0 = [...Object.entries(LOOKS).map(([name, look]) => ({ name, look, viewport: PHONE })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  const runs = process.env.ONE ? runs0.slice(0, 1) : runs0;
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport });
    // SPREADSHEETS
    await page.evaluate(() => (location.hash = 'sheets'));
    await page.waitForSelector('#pg-sheets .shsheet', { timeout: 15000 });
    await page.locator('#pg-sheets .shbar button', { hasText: 'NEW' }).first().click();
    await until(page, () => window.__ghosty.sheets.view === 'book');
    if (r.big) await body21(page);
    await page.locator('.shaddr').fill('B2:B4');
    await page.locator('.shaddr').press('Enter');
    await page.locator('.shpill', { hasText: /^CELLS$/ }).click();
    await page.locator('.shpanel:not([hidden]) button', { hasText: /^TICK BOXES$/ }).click();
    await page.locator('.shaddr').fill('B2');
    await page.locator('.shaddr').press('Enter');
    check(await until(page, () => !document.querySelector('.shvbox').hidden), `looks, ${r.name}: a tick box's picker is under the formula line`);
    await settle(page);
    await measure(page, '#pg-sheets', `looks, ${r.name}: SPREADSHEETS → CELLS with a checked cell's picker`);
    await page.locator('.shpill', { hasText: /^CHART$/ }).click();
    await settle(page);
    await measure(page, '#pg-sheets', `looks, ${r.name}: SPREADSHEETS → CHART, its kinds, words, key, colours and sparklines`);
    // PRESENTATIONS
    await page.evaluate(() => (location.hash = 'slides'));
    await page.waitForSelector('#pg-slides .slsheet', { timeout: 15000 });
    await page.locator('.slsheet button:visible').filter({ hasText: /^START BLANK$/ }).first().click();
    await until(page, () => window.__ghosty.slides.view === 'deck');
    await page.locator('.slsheet .slcard').nth(1).click();
    await until(page, () => window.__ghosty.slides.view === 'slide');
    await page.locator('.slsheet .slpill', { hasText: /^FREE$/ }).click();
    await page.locator('.slfree-panel button', { hasText: /^TEXT BOX$/ }).click();
    check(await until(page, () => window.__ghosty.slides.free.length === 1), `looks, ${r.name}: a text box on the slide`);
    await settle(page);
    await measure(page, '#pg-slides', `looks, ${r.name}: PRESENTATIONS → FREE with a text box chosen`);
    await ctx.close();
  }
}
