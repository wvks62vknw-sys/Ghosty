// Ways around the interface, for the specs.

// The owner's phone is an iPhone 18 Pro Max: 440 × 956 CSS points. Every spec's main phone context is this size.
export const PHONE = { width: 440, height: 956 };
// The owner is in the UK: en-GB dates (24/10/2026) and the 24-hour clock, on London time. Spread into every newContext.
export const UK = { locale: 'en-GB', timezoneId: 'Europe/London' };
// The desktop size the specs check besides the phone.
export const DESKTOP = { width: 1440, height: 900 };

// The systems deck (every screen) opens from the avatar's "Me" sheet, row "Every screen".
export async function openDeck(page) {
  // the avatar sits on the roots' navigation bar: go to the reactor screen if this one has none
  if (!(await page.locator('#top .you').isVisible().catch(() => false))) {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
  }
  await page.click('#top .you');
  await page.click('#mesheet .merow[data-id="deck"]');
}

// The Every screen deck (shell/launcher.ts) opens a card in place; its OPEN button goes to the screen.
export async function openScreen(page, id) {
  await openDeck(page);
  await page.click(`#deck .dkcard[data-id="${id}"]`);
  await page.click(`#deck .dkx[data-id="${id}"] .dkopen`);
}

// Settings, System and Links are grouped lists: a panel shows its contents once its row is tapped (it is
// pushed in as its own screen; "‹ back" pops it). Open the panel whose title starts with `title` (a pushed
// one is popped first).
export async function openPanel(page, tab, title) {
  await page.waitForSelector(`#pg-${tab} .pn`, { state: 'attached', timeout: 15000 }).catch(() => undefined);
  // wait until the page has become a list and the row is there (a slow machine draws it late)
  await page.waitForFunction(({ tab, src }) => [...(document.getElementById(`pg-${tab}`)?.querySelectorAll('.pn[data-row]') ?? [])].some((p) => new RegExp(src).test(p.querySelector('.ptitle')?.textContent ?? '')), { tab, src: `^${title}` }, { timeout: 10000 }).catch(() => undefined);
  const done = await page.evaluate(({ tab, src }) => {
    const re = new RegExp(src);
    const root = document.getElementById(`pg-${tab}`);
    if (!root?.classList.contains('listmode')) return true;
    const pn = [...root.querySelectorAll('.pn[data-row]')].find((p) => re.test(p.querySelector('.ptitle')?.textContent ?? ''));
    // a screen in sections (ui/sections.ts) shows the section that holds the panel first, as a deep link does
    pn?.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true }));
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

// System and Agenda are in sections on a phone (ui/sections.ts): a row of pills under the title, one section shown at a
// time. Tap the pill named `label` (nothing to do on a wide screen, where every panel shows).
export async function openSection(page, tab, label) {
  const pill = page.locator(`#pg-${tab} .secpills .secpill`, { hasText: label });
  if (!(await pill.count()) || !(await pill.isVisible().catch(() => false))) return false;
  await pill.click();
  await page.waitForTimeout(250);
  return true;
}
