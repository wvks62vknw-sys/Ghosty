// GHOSTY'S PHOTO CHANGES, ONE BY ONE (NEXT ROUND, editors.u7; against Lightroom's and Snapseed's suggestions, with the documents' trust model):
// a change in his words becomes marked changes inside the Photo editor ("warmer +600 K", "crop to 4:5"), each with ACCEPT and REJECT, and
// ACCEPT ALL / NO THANKS under them. Proved end to end: the BRAIN tray's words and its FIX IT key, one accept and one reject, each accept one
// UNDO step (UNDO and REDO), ACCEPT ALL and NO THANKS, words it cannot use said plainly, the chat's "make this photo brighter" marking the
// change on the photo open (no hop to the Lens), and the accepted change kept when the app is opened again. Then the editor with the marked
// changes up in all seven looks at 440 × 956, The Scan at 390 × 844 and at BODY 21. Run by tests/editorsmedia.spec.mjs (PARTS=approve).
import { ask, jpeg, photoKit, still } from './mediakit.mjs';

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const rows = (page) => page.$$eval('.pesugg:not([hidden]) .pesuggrow .pesugglabel', (els) => els.map((e) => e.textContent ?? ''));
  const suggest = async (page, words) => {
    await page.fill('.peaskin', words);
    await page.click('.pesuggask');
  };

  {
    const { ctx, page } = await open({ look: LOOKS.scan, viewport: PHONE });
    const P = photoKit(h, page);
    await P.toPhoto();
    await page.waitForSelector('.peshelf:not([hidden])', { timeout: 15000 });
    check(await P.openFile('IMG_DIM.jpg', await jpeg(page, 800, 600, 0, 0.55)), 'approve: a dim photo opens and is drawn');
    await P.tool('brain');
    const intro = (await page.locator('.peaskline').textContent()) ?? '';
    check(/accept or reject/.test(intro) && /stays on the phone/.test(intro), `approve: the BRAIN tray says what ASK GHOSTY does and that it stays on the phone ("${intro}")`);

    // nothing typed, then words it cannot use: said plainly, nothing marked
    await page.fill('.peaskin', '');
    await page.click('.pesuggask');
    check(/Type a change first/.test((await page.locator('.peaskline').textContent()) ?? ''), 'approve: SUGGEST with nothing typed asks for a change in his words');
    await suggest(page, 'make it sing');
    check(await until(page, () => /could not turn that into a change/.test(document.querySelector('.peaskline')?.textContent ?? ''), null, 5000), 'approve: words it cannot use are said plainly, with examples');
    check(await page.locator('.pesugg').isHidden(), 'approve: and nothing is marked');

    // two changes: one accepted, one rejected
    const r0 = await P.recipe();
    const at0 = (await P.st()).at;
    await suggest(page, 'warmer and crop to 4:5');
    check(await until(page, () => window.__ghosty.photoedit.changes.length === 2, null, 5000), 'approve: “warmer and crop to 4:5” marks two changes');
    const labels = await rows(page);
    check(labels[0] === 'warmer +600 K' && labels[1] === 'crop to 4:5', `approve: each change is marked in the sliders’ words (${labels.join(' · ')})`);
    const said = (await page.locator('.pesuggline').textContent()) ?? '';
    check(/I suggest 2 changes\. Accept or reject each; nothing changes the photo until you accept it\./.test(said), `approve: the line says how many and that nothing changes until he accepts ("${said}")`);
    check(JSON.stringify(await P.recipe()) === JSON.stringify(r0), 'approve: marking them changed nothing yet');
    await page.getByRole('button', { name: 'Accept warmer +600 K' }).click();
    check(await until(page, (t) => window.__ghosty.photoedit.recipe().wb.temp === t + 600, r0.wb.temp, 5000), 'approve: ACCEPT puts that one change on the photo (600 K warmer)');
    check((await P.st()).at === at0 + 1, 'approve: and it is one step in the history');
    check(/Accepted: warmer \+600 K\. UNDO takes it back\./.test((await page.locator('.pesuggline').textContent()) ?? ''), 'approve: the accept is said in his words');
    check((await rows(page)).join() === 'crop to 4:5', 'approve: the crop is still waiting');
    await page.getByRole('button', { name: 'Reject crop to 4:5' }).click();
    check(await until(page, () => document.querySelector('.pesugg')?.hidden === true, null, 5000), 'approve: once each is answered the marked list goes');
    const r1 = await P.recipe();
    check(r1.crop.w === r0.crop.w && r1.crop.h === r0.crop.h && r1.crop.ratio === r0.crop.ratio, 'approve: REJECT leaves the crop as it was');
    check(/Done: 1 accepted, 1 left out/.test((await P.st()).status), `approve: the end is said: "${(await P.st()).status}"`);
    await page.getByRole('button', { name: /^undo$/i }).click();
    check(await until(page, (t) => window.__ghosty.photoedit.recipe().wb.temp === t, r0.wb.temp, 5000), 'approve: UNDO takes the accepted change back, one step');
    check(/Undone: Ghosty: warmer \+600 K\./.test((await P.st()).status), `approve: UNDO names Ghosty’s change ("${(await P.st()).status}")`);
    await page.getByRole('button', { name: /^redo$/i }).click();
    check(await until(page, (t) => window.__ghosty.photoedit.recipe().wb.temp === t + 600, r0.wb.temp, 5000), 'approve: REDO puts it back');

    // FIX IT reads the dim picture: a lift in exposure among its changes; ACCEPT ALL is one step each
    await page.click('.pequick[data-ask="fix it"]');
    check(await until(page, () => window.__ghosty.photoedit.changes.length >= 2, null, 5000), `approve: FIX IT marks its changes (${(await rows(page)).join(' · ')})`);
    const fix = await rows(page);
    check(fix.some((l) => /^\+\d\.\d exposure$/.test(l)), 'approve: on a dim photo FIX IT lifts the exposure');
    const at1 = (await P.st()).at;
    const all = page.locator('.pesuggall');
    check(new RegExp(`ACCEPT ALL ${fix.length}`).test((await all.textContent()) ?? ''), 'approve: ACCEPT ALL says how many');
    await all.click();
    check(await until(page, (n) => window.__ghosty.photoedit.at === n, at1 + fix.length, 5000), `approve: ACCEPT ALL is one UNDO step for each change (${fix.length})`);
    check((await P.recipe()).light.exposure > 0, 'approve: the exposure is lifted');
    await page.getByRole('button', { name: /^undo$/i }).click();
    check(await until(page, (n) => window.__ghosty.photoedit.at === n, at1 + fix.length - 1, 5000), 'approve: UNDO takes back only the last of them');
    await page.getByRole('button', { name: /^redo$/i }).click();

    // NO THANKS: all of them left out, the photo as it was
    const r2 = JSON.stringify(await P.recipe());
    await page.click('.pequick[data-ask="crop to 4:5"]');
    await until(page, () => window.__ghosty.photoedit.changes.length === 1, null, 5000);
    check((await page.locator('.pesuggall').textContent())?.trim() === 'ACCEPT IT', 'approve: with one change the key says ACCEPT IT');
    await page.click('.pesuggnone');
    check(await until(page, () => document.querySelector('.pesugg')?.hidden === true, null, 5000) && JSON.stringify(await P.recipe()) === r2, 'approve: NO THANKS leaves the photo as it was');
    check(/Nothing changed: the photo is as it was\./.test((await P.st()).status), 'approve: and says so');

    // the chat: "make this photo brighter" marks the change in the Photo editor, on this photo, with no hop to the Lens
    const exp0 = (await P.recipe()).light.exposure;
    const rep = await ask(page, 'make this photo brighter', /marked one change in the Photo editor/);
    check(rep.ok && /IMG_DIM\.jpg|the photo you edited last/.test(rep.text) && /nothing changes the photo until you accept it/.test(rep.text), `approve: the chat says the change is marked in the Photo editor ("${rep.text.slice(0, 160)}")`);
    check(await until(page, () => document.body.dataset.tab === 'photo' && window.__ghosty.photoedit.changes.join() === '+0.3 exposure', null, 15000), 'approve: the Photo editor opens with “+0.3 exposure” marked, never the Lens');
    const saves0 = (await P.st()).saves;
    await page.getByRole('button', { name: 'Accept +0.3 exposure' }).click();
    check(await until(page, (e) => Math.abs(window.__ghosty.photoedit.recipe().light.exposure - e - 0.3) < 1e-6, exp0, 5000), 'approve: accepted, the exposure is up by 0.3');
    // the round trip: the save after the accept written, the app opened again, the photo reopened with the accepted changes
    check(await until(page, (n) => window.__ghosty.photoedit.saves > n, saves0, 15000), 'approve: the edit is saved on the phone');
    // (and that save is of the recipe with the accepted change in it, not an earlier save finishing late)
    check(await until(page, () => window.__ghosty.photoedit.savedJson === JSON.stringify(window.__ghosty.photoedit.recipe()), null, 15000), 'approve: the recipe written to the phone is the one with the accepted change');
    const kept = JSON.stringify(await P.recipe());
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => undefined);
    await P.toPhoto();
    // (the editor opens on the photo he had open, or the shelf shows it: either way, IMG_DIM.jpg opened from where he left it)
    await page.waitForSelector('.pe:not([hidden]) .pestage, .peshelf:not([hidden]) .peshelfgrid button', { timeout: 20000 });
    if (await page.locator('.peshelf:not([hidden])').count()) await page.locator('.peshelfgrid button', { hasText: 'IMG_DIM.jpg' }).first().click();
    await until(page, () => window.__ghosty?.photoedit?.open && window.__ghosty.photoedit.name === 'IMG_DIM.jpg', null, 20000);
    await P.drawn();
    check(JSON.stringify(await P.recipe()) === kept, 'approve: opened again, the photo keeps every accepted change');
    await ctx.close();
  }
}
