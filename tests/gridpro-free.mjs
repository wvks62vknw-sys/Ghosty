// GRID PRO, PRESENTATIONS: free-form slides (APPS ROUND, editors: the pro edition), end to end on the phone with the real waits:
//  1. A slide → FREE: TEXT BOX, its words typed; ELLIPSE and ROUNDED shapes; a picture: four items, each listed and said; UNDO takes the
//     last off, REDO brings it back.
//  2. A drag of the ellipse to near the slide's middle: a guide line is drawn while it snaps, and it lands exactly on the centre.
//  3. SELECT MORE, ALIGN LEFT lines the chosen up; GROUP: a drag of one moves both; UNGROUP; TO BACK changes the drawing order.
//  4. The round trip: .pptx out (text boxes, shapes, a picture and a group as PowerPoint's own), IMPORTed back with every item the same.
import { readFileSync } from 'node:fs';


export default async function (h) {
  const { open, check, until, LOOKS } = h;
  const st = (page) => page.evaluate(() => ({ free: window.__ghosty.slides.free, sel: window.__ghosty.slides.freeSel, said: window.__ghosty.slides.said, lost: window.__ghosty.slides.lost }));
  const sh = (page) => page.locator('.slsheet');
  const key = (page, label) => sh(page).locator('.slfree-panel button:visible').filter({ hasText: new RegExp(`^${label}$`) }).first();
  const top = (page, label) => sh(page).locator('button:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  const pill = (page, name) => sh(page).locator('.slpill', { hasText: new RegExp(`^${name}$`, 'i') }).click();
  let n = 0;
  const blk = (t, text) => ({ id: `b${++n}`, t, runs: text ? [{ text }] : [] });
  const deck = { id: 'kfree', title: 'Free talk', theme: 'ghosty', master: { align: 'left', footer: true, numbers: true }, slides: [{ id: 'f1', layout: 'blank', title: blk('h1', ''), body: [], body2: [], shapes: [], notes: '', transition: 'none', builds: [] }], at: Date.now(), from: 'written with Ghosty' };
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.slides': [deck] } });
  await page.evaluate(() => (location.hash = 'slides'));
  await page.waitForSelector('.slsheet .slopen', { timeout: 15000 });
  await sh(page).locator('.slopen').first().click();
  await until(page, () => window.__ghosty.slides.view === 'deck');
  await sh(page).locator('.slcard').nth(0).click();
  await until(page, () => window.__ghosty.slides.view === 'slide');

  // 1. add
  await pill(page, 'FREE');
  check(/Nothing free on this slide yet/.test(await sh(page).locator('.slfree-panel').innerText()), 'free 1: an empty slide says so in his words');
  await key(page, 'TEXT BOX').click();
  check(await until(page, () => window.__ghosty.slides.free.length === 1 && window.__ghosty.slides.free[0].kind === 'text'), 'free 1: TEXT BOX lays one on the slide');
  const words = sh(page).locator('.slfree-panel input[aria-label="The words of the chosen text box"]');
  await words.fill('Sales are up');
  await words.press('Enter');
  check(await until(page, () => window.__ghosty.slides.free[0].text === 'Sales are up' && /Sales are up/.test(document.querySelector('.slbox .slfree')?.textContent ?? '')), 'free 1: its words typed and drawn');
  await key(page, 'ELLIPSE').click();
  await key(page, 'TEXT BOX').click();
  await key(page, 'ROUNDED').click();
  check(await until(page, () => window.__ghosty.slides.free.length === 4 && window.__ghosty.slides.free.filter((f) => f.kind === 'shape').length === 2), 'free 1: ELLIPSE and ROUNDED: shapes, as many as he likes');
  check(/A rounded shape is on the slide\. UNDO takes it off/.test((await st(page)).said), `free 1: said (${(await st(page)).said})`);
  await top(page, 'UNDO').click();
  check(await until(page, () => window.__ghosty.slides.free.length === 3), 'free 1: UNDO takes the last one off');
  await top(page, 'REDO').click();
  check(await until(page, () => window.__ghosty.slides.free.length === 4), 'free 1: REDO brings it back');
  // 2. drag with snapping
  await sh(page).locator('.slfreelist .slfreeitem').nth(1).click();
  const ell = (await st(page)).free[1];
  await sh(page).locator('.slbox').evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const box = await sh(page).locator('.slbox').boundingBox();
  const k = box.width / 1280;
  // grab the ellipse near its top left (the rounded shape lies over its middle) and aim its middle 7 slide pixels right of the slide's middle
  const gx = ell.x + 36;
  const gy = ell.y + 36;
  const cx = box.x + gx * k;
  const cy = box.y + gy * k;
  const tx = box.x + (gx + 640 + 7 - (ell.x + ell.w / 2)) * k;
  const ty = box.y + (gy + 250 - (ell.y + ell.h / 2)) * k;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move((cx + tx) / 2, (cy + ty) / 2, { steps: 4 });
  await page.mouse.move(tx, ty, { steps: 4 });
  check(await until(page, () => window.__ghosty.slides.guides.includes('x640') && document.querySelectorAll('.slbox .slguide').length >= 1), `free 2: a guide line is drawn at the slide's middle while it snaps (${(await page.evaluate(() => window.__ghosty.slides.guides)).join(', ')})`);
  await page.mouse.up();
  check(await until(page, (w) => { const f = window.__ghosty.slides.free[1]; return f.x + f.w / 2 === 640; }), `free 2: it lands exactly on the middle (${JSON.stringify((await st(page)).free[1])})`);
  check(/Moved\. UNDO puts it back/.test((await st(page)).said), 'free 2: said');

  // 3. align, group, layers
  await sh(page).locator('.slfreelist .slfreeitem').nth(0).click();
  await key(page, 'SELECT MORE').click();
  await sh(page).locator('.slfreelist .slfreeitem').nth(1).click();
  check(await until(page, () => window.__ghosty.slides.freeSel.length === 2), 'free 3: SELECT MORE chooses two');
  await key(page, 'LEFT').click();
  check(await until(page, () => window.__ghosty.slides.free[0].x === window.__ghosty.slides.free[1].x), 'free 3: ALIGN LEFT lines them up on one edge');
  await key(page, 'GROUP').click();
  check(await until(page, () => window.__ghosty.slides.free[0].group && window.__ghosty.slides.free[0].group === window.__ghosty.slides.free[1].group), 'free 3: GROUP makes them one');
  const g0 = (await st(page)).free;
  const t = g0[0];
  await sh(page).locator('.slbox').evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const b2 = await sh(page).locator('.slbox').boundingBox();
  const k2 = b2.width / 1280;
  const px = b2.x + (t.x + 20) * k2;
  const py = b2.y + (t.y + t.h / 2) * k2;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + 40 * k2, py + 30 * k2, { steps: 5 });
  await page.mouse.up();
  check(await until(page, ([a, b]) => { const f = window.__ghosty.slides.free; return f[0].y !== a && f[1].y - f[0].y === b; }, [g0[0].y, g0[1].y - g0[0].y]), 'free 3: a drag of one moves the whole group together');
  await key(page, 'UNGROUP').click();
  check(await until(page, () => !window.__ghosty.slides.free[0].group), 'free 3: UNGROUP lets them go');
  await key(page, 'SELECT MORE').click();
  await sh(page).locator('.slfreelist .slfreeitem').nth(3).click();
  const id3 = (await st(page)).free[3].id;
  await key(page, 'TO BACK').click();
  check(await until(page, (id) => window.__ghosty.slides.free[0].id === id, id3), 'free 3: TO BACK sends it under the rest');
  await sh(page).locator('.slfreelist .slfreeitem').nth(2).click();
  await key(page, 'SELECT MORE').click();
  await sh(page).locator('.slfreelist .slfreeitem').nth(3).click();
  await key(page, 'GROUP').click();
  await until(page, () => window.__ghosty.slides.free.filter((f) => f.group).length === 2);
  await pill(page, 'FREE');
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), key(page, 'PICTURE').click()]);
  const photo = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const g = c.getContext('2d');
    g.fillStyle = 'teal';
    g.fillRect(0, 0, 400, 300);
    return c.toDataURL('image/jpeg', 0.9).split(',')[1];
  }).then((b) => Buffer.from(b, 'base64'));
  await chooser.setFiles({ name: 'square.jpg', mimeType: 'image/jpeg', buffer: photo });
  check(await until(page, () => window.__ghosty.slides.free.length === 5 && window.__ghosty.slides.free[4].kind === 'pic' && !!document.querySelector('.slbox .slfree image'), null, 15000), 'free 1: PICTURE lays a photo on the slide');
  check(await sh(page).locator('.slfreelist .slfreeitem').count() === 5, 'free 1: all five listed, back to front');

  await page.screenshot({ path: `${h.out}/gridpro-free.png` });
  const before = (await st(page)).free;

  // 4. the round trip
  await top(page, 'ALL SLIDES').click();
  await until(page, () => window.__ghosty.slides.view === 'deck');
  await top(page, 'EXPORT').click();
  await top(page, 'POWERPOINT \\(\\.PPTX\\)').click();
  check(await until(page, () => /\.pptx/.test(document.querySelector('.slouts .cvoutt b')?.textContent ?? ''), null, 30000), 'round trip 4: EXPORT makes the PowerPoint file');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), sh(page).locator('.slouts button', { hasText: 'SAVE' }).click()]);
  const bytes = readFileSync(await dl.path());
  check(bytes.includes(Buffer.from('ppt/media/')), 'round trip 4: the picture is in the file');
  await top(page, 'MY SLIDES').click();
  await page.setInputFiles('.slsheet input[type=file][accept*=pptx]', { name: 'Free talk again.pptx', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', buffer: bytes });
  check(await until(page, () => window.__ghosty.slides.view === 'deck' && window.__ghosty.slides.kept === 2, null, 30000), 'round trip 4: IMPORTed back as its own deck');
  const back = await page.evaluate(() => JSON.parse(window.__ghosty.slides.json).slides[0].free ?? []);
  const shape = (list) => JSON.stringify(list.map((f) => `${f.kind} ${f.shape || ''} ${Math.round(f.x)},${Math.round(f.y)} ${Math.round(f.w)}x${Math.round(f.h)} ${f.text || ''} ${f.group ? 'g' : ''}`).sort());
  check(shape(back) === shape(before), `round trip 4: every item came back the same (${shape(back)} vs ${shape(before)})`);
  check(!/picture|drawing/.test((await st(page)).lost.join(' ')), `round trip 4: nothing said lost about them (${(await st(page)).lost.join('; ')})`);
  await ctx.close();
}
