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

// Settings, System and Links are grouped lists in the calm looks: a panel shows its contents once its row
// is tapped (it is pushed in as its own screen; "‹ back" pops it). Open the panel whose title starts with
// `title` (a pushed one is popped first). The classic looks show every panel already: nothing to do.
export async function openPanel(page, tab, title) {
  await page.waitForSelector(`#pg-${tab} .pn`, { state: 'attached', timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(300);
  const done = await page.evaluate(({ tab, src }) => {
    const re = new RegExp(src);
    const root = document.getElementById(`pg-${tab}`);
    if (!root?.classList.contains('listmode')) return true;
    const pn = [...root.querySelectorAll('.pn[data-row]')].find((p) => re.test(p.querySelector('.ptitle')?.textContent ?? ''));
    return !pn || pn.classList.contains('pushed');
  }, { tab, src: `^${title}` });
  if (done) return;
  if (await page.locator(`#pg-${tab}.haspush`).count()) {
    await page.click('#top .navback');
    await page.waitForTimeout(300);
  }
  await page.locator(`#pg-${tab} .pn[data-row] > h3`).filter({ has: page.locator('.ptitle', { hasText: new RegExp(`^${title}`) }) }).first().click();
  await page.waitForTimeout(400);
}
