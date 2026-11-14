// EDITORS GRID, THE LOOKS: every new screen of this round's spreadsheet and presentation tools in all seven looks at 440 × 956, The Scan at
// 390 × 844 and BODY 21: every key 44 pt, nothing sideways, no words cut.
//   - PRESENTATIONS: a slide's SLIDE keys (the transitions with MAGIC MOVE, the builds with their PowerPoint note).
export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const sh = (page) => page.locator('.slsheet');
  const key = (page, label) => sh(page).locator('button:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  const runs = [...Object.entries(LOOKS).map(([name, look]) => ({ name, look, viewport: PHONE })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport });
    // PRESENTATIONS: the SLIDE keys
    await page.evaluate(() => (location.hash = 'slides'));
    await page.waitForSelector('#pg-slides .slsheet', { timeout: 15000 });
    await key(page, 'START BLANK').click();
    await until(page, () => window.__ghosty.slides.view === 'deck');
    await sh(page).locator('.slcard').nth(1).click();
    await until(page, () => window.__ghosty.slides.view === 'slide');
    await sh(page).locator('.slpill', { hasText: /^SLIDE$/ }).click();
    if (r.big) await body21(page);
    await settle(page);
    check(await key(page, 'MAGIC MOVE').count() === 1, `looks, ${r.name}: MAGIC MOVE is a key among the transitions`);
    await measure(page, '#pg-slides', `looks, ${r.name}: a slide's SLIDE keys with MAGIC MOVE and the builds`);
    await ctx.close();
  }
}
