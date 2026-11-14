// The paper tools' own helpers for tests/editorspaper-*.mjs (the kit itself is tests/editorsharness.mjs).

/** Say `words` in the chat and wait for the first reply after his own message (found by its `data-at`) that matches `re`. */
export async function ask(page, words, re = /\S/, ms = 20000) {
  const t0 = await page.evaluate(() => Date.now());
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
  const find = ({ t0, src, flags, any }) => {
    const rx = new RegExp(src, flags);
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0).lastIndexOf(true);
    if (mine < 0) return null;
    const replies = msgs.slice(mine + 1).filter((m) => !m.classList.contains('me'));
    const r = any ? replies.at(-1) : replies.find((m) => rx.test(m.textContent ?? ''));
    return r ? { text: r.textContent ?? '' } : null;
  };
  const arg = { t0, src: re.source, flags: re.flags.replace('g', ''), any: false };
  const got = await page.waitForFunction(find, arg, { timeout: ms }).then((h) => h.jsonValue(), () => null);
  if (got) return { ok: true, ...got };
  const seen = await page.evaluate(find, { ...arg, any: true }).catch(() => null);
  return { ok: false, text: seen?.text ?? '' };
}

/** DOCUMENTS, by MAKE → EDITORS where the look draws the pill, or its own address. */
export async function goDocs(page) {
  await page.evaluate(() => (location.hash = 'area-make'));
  const pill = '#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="docs"]';
  if (await page.waitForSelector(pill, { timeout: 6000 }).then(() => true, () => false)) await page.click(pill);
  else await page.evaluate(() => (location.hash = 'docs'));
  await page.waitForSelector('#pg-docs .dcsheet', { timeout: 15000 });
}

/** The open document, as the editor keeps it. */
export const docOf = (page) => page.evaluate(() => JSON.parse(window.__ghosty.docs.json || 'null'));

/** A file saved from the editor's export row (the key, then SAVE), as bytes. */
export async function exported(page, label, sel = '.dcouts') {
  const { readFileSync } = await import('node:fs');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), (async () => {
    await page.locator('.dcexport button', { hasText: label }).first().click();
    await page.waitForSelector(`${sel} .cvoutt b`);
    await page.locator(`${sel} button`, { hasText: 'SAVE' }).first().click();
  })()]);
  return { bytes: readFileSync(await dl.path()), name: dl.suggestedFilename() };
}
