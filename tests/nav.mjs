// Ways around the interface that differ between the looks, for the specs.
// The classic looks open the systems deck (every screen) from the GHOSTY logo in the top bar; the calm
// looks (Graphite, Reactor — the default) from the avatar's "Me" sheet, row "Every screen".
export async function openDeck(page) {
  if (await page.locator('#top .logo').isVisible().catch(() => false)) return page.click('#top .logo');
  // the avatar sits on the roots' navigation bar: go to the reactor screen if this one has none
  if (!(await page.locator('#top .you').isVisible().catch(() => false))) {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
  }
  await page.click('#top .you');
  await page.click('#mesheet .merow[data-id="deck"]');
}
