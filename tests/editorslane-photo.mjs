// THE EDITORS LANE, PHOTO (against Lightroom / Snapseed): COPY EDITS on one photo and PASTE EDITS on another (the look carried, the
// second photo's own crop kept), one step that UNDO takes back and REDO puts again, the paste kept and reopened equal after the editor is
// left, and the BRAIN tray's line saying the photo goes only on his press. Then the editor with its LOOKS tray (where COPY and PASTE live) in
// all seven looks at 440 × 956, The Scan at 390 × 844, and at BODY 21: every key 44 pt, nothing sideways, no words cut.
// Run by tests/editorslane.spec.mjs (PARTS=photo).

/** A small JPEG drawn in the page (a sky over grass, `tint` to tell the photos apart), as the photo specs make theirs. */
async function jpeg(page, w, h, tint = 0) {
  const b64 = await page.evaluate(async ({ w, h, tint }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, `rgb(${30 + tint}, 90, 205)`);
    sky.addColorStop(1, `rgb(${185 + tint}, 215, 245)`);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgb(60, 130, 70)';
    g.fillRect(0, h * 0.6, w, h * 0.4);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    return btoa(s);
  }, { w, h, tint });
  return Buffer.from(b64, 'base64');
}

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const st = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.photoedit, (k, v) => (typeof v === 'function' ? undefined : v))));
  const recipe = (page) => page.evaluate(() => window.__ghosty.photoedit.recipe());
  /** The picture drawn and nothing waiting to be drawn (the editor's own flag, never a clock). */
  const drawn = (page) => until(page, () => window.__ghosty?.photoedit?.ready === true && window.__ghosty.photoedit.draws > 0 && !window.__ghosty.photoedit.pending, null, 60000);
  const goPhoto = async (page) => {
    await page.evaluate(() => (location.hash = 'area-make'));
    await page.waitForSelector('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]', { timeout: 20000 });
    await page.click('#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="photo"]');
    await page.waitForFunction(() => document.body.dataset.tab === 'photo', null, { timeout: 15000 });
  };
  /** The screen has finished coming in: its drawn width equals its laid-out width (no entrance scale left on it). */
  const still = (page, sel) => until(page, (sel) => {
    const el = document.querySelector(sel);
    return !!el && el.offsetWidth > 0 && Math.abs(el.getBoundingClientRect().width - el.offsetWidth) < 0.25;
  }, sel, 10000);
  const toShelf = async (page) => {
    if (await page.locator('.pe:not([hidden])').count()) await page.click('.peback');
    await page.waitForSelector('.peshelf:not([hidden])', { timeout: 10000 });
  };
  const openFile = async (page, name, buffer) => {
    await toShelf(page);
    await page.setInputFiles('.peshelf input[type=file]', [{ name, mimeType: 'image/jpeg', buffer }]);
    await page.waitForSelector('.pe:not([hidden]) .pestage', { timeout: 30000 });
    await until(page, (n) => window.__ghosty?.photoedit?.name === n, name, 30000);
    return drawn(page);
  };
  const tool = async (page, t) => {
    await page.click(`.pepill[data-tool="${t}"]`);
    await until(page, (t) => window.__ghosty.photoedit.tool === t, t, 8000);
  };
  const slide = (page, id, v) => page.evaluate(([id, v]) => {
    const i = document.querySelector(`#pe-s-${id}`);
    i.value = String(v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, v]);

  // ---- COPY EDITS → PASTE EDITS, undo, redo, the round trip
  {
    const { ctx, page } = await open({ look: LOOKS.scan, viewport: PHONE });
    await goPhoto(page);
    await page.waitForSelector('.peshelf:not([hidden])', { timeout: 15000 });
    const a = await jpeg(page, 800, 600, 0);
    const b = await jpeg(page, 800, 600, 40);
    check(await openFile(page, 'IMG_A.jpg', a), 'photo: the first photo opens and is drawn');
    await tool(page, 'light');
    await slide(page, 'exposure', 1.2);
    await tool(page, 'color');
    await slide(page, 'temp', 8000);
    await drawn(page);
    const lookA = await recipe(page);
    await tool(page, 'looks');
    const pasteOff = await page.locator('.pepaste').isDisabled();
    check(pasteOff, 'photo: PASTE EDITS is greyed before anything is copied');
    await page.click('.pecopy');
    const copied = await until(page, () => window.__ghosty.photoedit.copied === 'IMG_A.jpg' && !!localStorage.getItem('ghosty.photo.copiedEdits'), null, 5000);
    const line1 = await page.locator('.pelookline').textContent();
    check(copied && /Copied the light, colour, curves, detail and effects of IMG_A\.jpg/.test(line1), `photo: COPY EDITS keeps the look and says so ("${line1}")`);

    check(await openFile(page, 'IMG_B.jpg', b), 'photo: a second photo opens');
    await tool(page, 'crop');
    await page.getByRole('button', { name: /^1:1$/ }).first().click();
    check(await until(page, () => window.__ghosty.photoedit.recipe().crop.w < 0.99, null, 5000), 'photo: the second photo is cropped square');
    const cropB = JSON.stringify((await recipe(page)).crop);
    await tool(page, 'looks');
    check(!(await page.locator('.pepaste').isDisabled()), 'photo: PASTE EDITS is live on the second photo');
    const stepsBefore = (await st(page)).at;
    await page.click('.pepaste');
    await until(page, (n) => window.__ghosty.photoedit.at === n + 1, stepsBefore, 5000);
    await drawn(page);
    let r = await recipe(page);
    check(r.light.exposure === lookA.light.exposure && r.wb.temp === lookA.wb.temp, `photo: the paste carries the look (exposure ${r.light.exposure}, ${r.wb.temp} K; copied ${lookA.light.exposure}, ${lookA.wb.temp} K)`);
    check(JSON.stringify(r.crop) === cropB, 'photo: the paste keeps the second photo’s own crop');
    const line2 = await page.locator('.pelookline').textContent();
    check(/Pasted the edits of IMG_A\.jpg/.test(line2) && /UNDO/.test(line2), `photo: the paste is said in his words ("${line2}")`);
    await page.getByRole('button', { name: /^undo$/i }).click();
    await until(page, () => window.__ghosty.photoedit.recipe().light.exposure === 0, null, 5000);
    r = await recipe(page);
    check(r.light.exposure === 0 && JSON.stringify(r.crop) === cropB, `photo: UNDO takes the paste off and keeps the crop (exposure ${r.light.exposure})`);
    await page.getByRole('button', { name: /^redo$/i }).click();
    await until(page, (v) => window.__ghosty.photoedit.recipe().light.exposure === v, lookA.light.exposure, 5000);
    check((await recipe(page)).light.exposure === lookA.light.exposure, 'photo: REDO puts the paste back');
    // the round trip: kept, the editor left, the photo reopened from the shelf, the same recipe
    await until(page, () => window.__ghosty.photoedit.saved === 'SAVED', null, 10000);
    const kept = JSON.stringify(await recipe(page));
    await toShelf(page);
    await page.locator('.peshelfgrid button', { hasText: 'IMG_A.jpg' }).first().click();
    await until(page, () => window.__ghosty.photoedit.name === 'IMG_A.jpg', null, 15000);
    await drawn(page);
    await toShelf(page);
    await page.locator('.peshelfgrid button', { hasText: 'IMG_B.jpg' }).first().click();
    await until(page, () => window.__ghosty.photoedit.name === 'IMG_B.jpg', null, 15000);
    await drawn(page);
    const back = JSON.stringify(await recipe(page));
    check(back === kept, 'photo: the pasted photo reopens with the same recipe, crop and all');
    // the BRAIN tray says the photo goes only on his press, in the present tense (it had said it "went")
    await tool(page, 'brain');
    const bl = await page.locator('.pebrainline').textContent();
    check(!/WENT TO THE BRAIN/.test(bl), `photo: the BRAIN tray never says the photo went before he pressed ("${bl}")`);
    await ctx.close();
  }

  // ---- every look at 440, The Scan at 390 and at BODY 21: the shelf and the editor on its LOOKS tray
  const runs = [...Object.keys(LOOKS).map((k) => ({ k, vp: PHONE, big: false })), { k: 'scan', vp: SMALL, big: false }, { k: 'scan', vp: PHONE, big: true }];
  for (const { k, vp, big } of runs) {
    const where = `photo ${k} ${vp.width}${big ? ' BODY 21' : ''}`;
    const { ctx, page } = await open({ look: LOOKS[k], viewport: vp });
    // every look reaches PHOTO by its own address (The Eye draws MAKE its own way; the MAKE pill is proved above on The Scan)
    await page.evaluate(() => (location.hash = 'photo'));
    await page.waitForSelector('.peshelf:not([hidden])', { timeout: 15000 });
    if (big) await body21(page);
    const empty = await page.locator('.peempty').textContent();
    check(/No photos yet/.test(empty), `${where}: the empty shelf says so in his words`);
    await settle(page);
    await still(page, '.peopen');
    await measure(page, '#pg-photo', `${where} shelf`);
    const ok = await openFile(page, 'IMG_L.jpg', await jpeg(page, 480, 360, 20));
    check(ok, `${where}: the photo opens`);
    await tool(page, 'looks');
    await page.waitForSelector('.pecopyrow', { timeout: 8000 });
    await settle(page);
    await still(page, '.pe:not([hidden]) .pestage');
    await measure(page, '#pg-photo .pe', `${where} editor, LOOKS`);
    await page.screenshot({ path: `${h.out}/editorslane-photo-${k}-${vp.width}${big ? '-b21' : ''}.png` }).catch(() => undefined);
    await ctx.close();
  }
}
