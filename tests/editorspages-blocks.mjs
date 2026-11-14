// THE EDITORS LANE, PAGES: FOLD-AWAY AND SYNCED BLOCKS, AND SAVE AS TEMPLATE (editors.u6), end to end on the phone.
//  1. ADD A BLOCK → TOGGLE; its + puts a line inside; its 44 pt fold key folds the line away and opens it again; UNDO folds it back.
//  2. SYNC on a line puts it on another page too ("SYNCED · ON 2 PAGES"); his words typed on one page land on the other.
//  3. … → SAVE AS TEMPLATE; NEW PAGE → MY TEMPLATES makes a fresh copy, toggle and all; DELETE lets the template go.
//  4. Round trip: EXPORT's zip holds the toggle as <details> and the synced mark; the app's own IMPORT reads them back folded, inside and synced.
//  5. A page with a toggle and a synced block in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21.
import { readFileSync } from 'node:fs';

function unzipStored(b) {
  const o = {};
  let e = b.length - 22;
  while (e > 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  let p = b.readUInt32LE(e + 16);
  for (let n = 0; n < b.readUInt16LE(e + 10); n++) {
    const size = b.readUInt32LE(p + 24);
    const nl = b.readUInt16LE(p + 28);
    const el = b.readUInt16LE(p + 30);
    const cl = b.readUInt16LE(p + 32);
    const local = b.readUInt32LE(p + 42);
    const start = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    o[b.subarray(p + 46, p + 46 + nl).toString()] = b.subarray(start, start + size);
    p += 46 + nl + el + cl;
  }
  return o;
}

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const now = Date.now();
  const mk = (id, title, blocks, order) => ({ id, title, icon: 'page', parent: null, blocks, at: now, created: now, order });
  const seed = (kit, shed = []) => ({ 'ghosty.workspace': { v: 1, versions: {}, at: now, pages: { kit: mk('kit', 'Kitchen', kit, 0), shed: mk('shed', 'Shed', shed, 1) } } });
  const sh = (page) => page.locator('#pg-workspace .wssheet').first();
  const key = (page, label) => sh(page).locator('button:visible').filter({ hasText: new RegExp(`^${label}$`) }).first();
  const kept = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.workspace') || '{"pages":{}}').pages);
  const blocks = (page) => page.evaluate(() => JSON.parse(window.__ghosty.workspace.json || 'null')?.blocks ?? []);
  const openTitled = async (page, title) => {
    await page.evaluate(() => (location.hash = 'workspace'));
    await page.waitForSelector('#pg-workspace .wssheet', { timeout: 40000 });
    if ((await page.evaluate(() => window.__ghosty.workspace.view)) === 'page') await page.evaluate(() => document.querySelector('#pg-workspace .wscrumb')?.click());
    await until(page, () => window.__ghosty.workspace.view === 'home');
    const row = sh(page).locator('.wstree .wsopen', { hasText: title }).first();
    await row.scrollIntoViewIfNeeded();
    await row.click();
    return until(page, (t) => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === t, title);
  };

  // ---------------------------------------------------------------- 1 to 4, one phone, The Scan
  {
    const { ctx, page } = await open({ look: LOOKS.scan, seed: seed([{ id: 'k1', t: 'p', runs: [{ text: 'Order the tiles' }] }], [{ id: 's1', t: 'p', runs: [{ text: 'Oil the hinges' }] }]) });
    check(await openTitled(page, 'Kitchen'), 'blocks: the Kitchen page opens');
    // 1. a toggle
    await key(page, 'ADD A BLOCK').click();
    await page.locator('.wskind[data-kind="toggle"]').click();
    check(await until(page, () => !!document.querySelector('.wsblock[data-t="toggle"] .wsedit')), 'blocks 1: ADD A BLOCK → TOGGLE puts a toggle on the page');
    await page.locator('.wsblock[data-t="toggle"] .wsedit').first().click();
    await page.keyboard.type('Spring jobs');
    await page.locator('.wsblock[data-t="toggle"] button.wsaddin').click();
    check(await until(page, () => !!document.activeElement?.closest('.wsblock[data-under]')), 'blocks 1: + puts a line inside the toggle, ready to type');
    await page.keyboard.type('Prune the roses');
    check(await until(page, () => {
      const bs = JSON.parse(window.__ghosty.workspace.json).blocks;
      const t = bs.find((b) => b.t === 'toggle');
      return t?.runs[0]?.text === 'Spring jobs' && bs.some((b) => b.under === t.id && b.runs[0]?.text === 'Prune the roses');
    }), 'blocks 1: the toggle and the line inside it are kept');
    const fold = page.locator('.wsblock[data-t="toggle"] button.wsfold');
    const fb = await fold.boundingBox();
    check(fb && fb.width >= 43.5 && fb.height >= 43.5, `blocks 1: the fold key is 44 pt (${fb ? `${Math.round(fb.width)}×${Math.round(fb.height)}` : 'none'})`);
    check((await fold.getAttribute('aria-label')) === 'Fold this toggle: 1 line inside' && (await fold.getAttribute('aria-expanded')) === 'true', 'blocks 1: the fold key says what it does');
    await fold.click();
    check(await until(page, () => !document.querySelector('.wsblock[data-under]') && JSON.parse(window.__ghosty.workspace.json).blocks.find((b) => b.t === 'toggle').folded === true), 'blocks 1: folded, the line inside is out of sight');
    check(await until(page, () => window.__ghosty.workspace.said === 'Folded away: 1 line inside.' && document.querySelector('.wsblock[data-t="toggle"] .wsinside')?.textContent === '1 inside'), 'blocks 1: said in his words, and “1 inside” shows');
    await page.locator('.wsblock[data-t="toggle"] button.wsfold').click();
    check(await until(page, () => !!document.querySelector('.wsblock[data-under]')), 'blocks 1: opened, the line is back');
    await key(page, 'UNDO').click();
    check(await until(page, () => !document.querySelector('.wsblock[data-under]') && JSON.parse(window.__ghosty.workspace.json).blocks.find((b) => b.t === 'toggle').folded === true), 'blocks 1: UNDO folds it back');
    await key(page, 'REDO').click();
    check(await until(page, () => !!document.querySelector('.wsblock[data-under]')), 'blocks 1: REDO opens it again');

    // 2. a synced block
    await page.locator('.wsblock .wsedit', { hasText: 'Order the tiles' }).click();
    await page.locator('#pg-workspace .wslinebar button[aria-label="Show this block on another page too, kept the same"]').click();
    check(await until(page, () => !!document.querySelector('.wssyncp')), 'blocks 2: SYNC opens the page list');
    await page.locator('.wssyncp button[aria-label="Sync to Shed"]').click();
    check(await until(page, () => window.__ghosty.workspace.said === 'Synced: it is on “Shed” too, and changing it on either page changes both.'), 'blocks 2: synced, said in his words');
    check(await until(page, () => document.querySelector('.wsblock[data-sync] .wssynced')?.textContent === 'SYNCED · ON 2 PAGES'), 'blocks 2: the block says SYNCED · ON 2 PAGES');
    const ed = page.locator('.wsblock[data-sync] .wsedit').first();
    await ed.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' for the splashback');
    check(await until(page, () => Object.values(JSON.parse(localStorage.getItem('ghosty.workspace')).pages).find((p) => p.title === 'Shed').blocks.some((b) => b.sync && b.runs.map((r) => r.text).join('') === 'Order the tiles for the splashback')), 'blocks 2: typed on Kitchen, the words land on Shed too');
    check(await openTitled(page, 'Shed'), 'blocks 2: Shed opens');
    check(await until(page, () => [...document.querySelectorAll('.wsblock[data-sync] .wsedit')].some((e) => e.textContent === 'Order the tiles for the splashback')), 'blocks 2: Shed shows the same words');
    await page.locator('.wsblock[data-sync] .wsedit').first().click();
    await page.keyboard.press('End');
    await page.keyboard.type(' today');
    check(await until(page, () => Object.values(JSON.parse(localStorage.getItem('ghosty.workspace')).pages).find((p) => p.title === 'Kitchen').blocks.some((b) => b.sync && b.runs.map((r) => r.text).join('') === 'Order the tiles for the splashback today')), 'blocks 2: typed on Shed, Kitchen has it too');

    // 3. save as template
    check(await openTitled(page, 'Kitchen'), 'blocks 3: back on Kitchen');
    await page.locator('#pg-workspace button.wsmore').click();
    await key(page, 'SAVE AS TEMPLATE').click();
    check(await until(page, () => window.__ghosty.workspace.said === 'Saved as a template: NEW PAGE → MY TEMPLATES makes a fresh “Kitchen” whenever you like.'), 'blocks 3: saved as a template, said in his words');
    await page.evaluate(() => document.querySelector('#pg-workspace .wscrumb')?.click());
    await until(page, () => window.__ghosty.workspace.view === 'home');
    await key(page, 'NEW PAGE').click();
    check(await until(page, () => !!document.querySelector('.wstemplates button[data-own]')), 'blocks 3: NEW PAGE lists MY TEMPLATES beside the five');
    check(await page.locator('.wstemplates button[data-template]').count() === 5, 'blocks 3: the five built in are still there');
    await page.locator('.wstemplates button[data-own]').first().click();
    check(await until(page, () => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'Kitchen' && window.__ghosty.workspace.said.startsWith('“Kitchen” is made from your template')), 'blocks 3: a fresh Kitchen opens from it');
    const fresh = await blocks(page);
    check(fresh.some((b) => b.t === 'toggle') && fresh.some((b) => b.under), 'blocks 3: the copy has the toggle and its line');
    const pagesNow = Object.values(await kept(page)).filter((p) => p.title === 'Kitchen' && !p.deleted);
    check(pagesNow.length === 2, `blocks 3: two Kitchens now (${pagesNow.length})`);
    await page.evaluate(() => document.querySelector('#pg-workspace .wscrumb')?.click());
    await until(page, () => window.__ghosty.workspace.view === 'home');
    if (!(await page.locator('.wstemplates').isVisible().catch(() => false))) await key(page, 'NEW PAGE').click();
    await page.locator('.wsownt button[aria-label="Delete my template Kitchen"]').click();
    check(await until(page, () => !document.querySelector('.wstemplates button[data-own]') && window.__ghosty.workspace.said === 'Your template “Kitchen” is deleted. Pages made from it stay as they are.'), 'blocks 3: DELETE lets the template go, said in his words');

    // 4. the zip out and in
    await key(page, 'EXPORT').click();
    check(await sh(page).locator('.wsmdlimits').isVisible(), 'blocks 4: EXPORT says what Markdown cannot carry');
    await key(page, 'MAKE THE ZIP').click();
    check(await until(page, () => !!document.querySelector('.wsouts .cvout'), null, 20000), 'blocks 4: EXPORT makes the zip');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.wsouts button', { hasText: /^SAVE$/ }).click()]);
    const zip = readFileSync(await dl.path());
    const files = unzipStored(zip);
    const md = files['Shed.md']?.toString() ?? '';
    const kitMd = Object.entries(files).filter(([k]) => /^Kitchen.*\.md$/.test(k)).map(([, v]) => v.toString());
    check(kitMd.some((t) => /^<details open><summary>Spring jobs<\/summary>$/m.test(t) && /^<\/details>$/m.test(t)), 'blocks 4: the Markdown holds the toggle as <details>');
    check(/^<!--ghosty:synced [\w-]+-->\nOrder the tiles for the splashback today$/m.test(md), `blocks 4: the synced line goes out with its mark (${md.split('\n').slice(2, 5).join(' / ')})`);
    const before = Object.values(await kept(page)).filter((p) => !p.deleted).length;
    await key(page, 'IMPORT').click().catch(() => undefined);
    await page.setInputFiles('#pg-workspace input[type=file]', { name: 'My workspace.zip', mimeType: 'application/zip', buffer: zip });
    check(await until(page, () => /^Read \d+ pages?/.test(window.__ghosty.workspace.imported ?? ''), null, 20000), 'blocks 4: IMPORT reads the zip');
    const back = Object.values(await kept(page)).filter((p) => !p.deleted);
    const newOnes = back.filter((p) => p.from === 'Markdown');
    const kits2 = newOnes.filter((p) => p.title === 'Kitchen');
    const kit2 = kits2[0];
    check(kits2.length === 2 && kits2.every((k) => { const t = k.blocks.find((b) => b.t === 'toggle'); return t && k.blocks.some((b) => b.under === t.id); }), 'blocks 4: both Kitchens (the page and the one from the template) read back with the line inside');
    const shed2 = newOnes.find((p) => p.title === 'Shed');
    const t2 = kit2?.blocks.find((b) => b.t === 'toggle');
    check(back.length > before && !!t2 && kit2.blocks.some((b) => b.under === t2.id && b.runs[0]?.text === 'Prune the roses'), 'blocks 4: read back, the line is inside its toggle');
    const sy = kit2?.blocks.find((b) => b.sync)?.sync;
    check(!!sy && shed2?.blocks.some((b) => b.sync === sy), 'blocks 4: read back, the two copies are synced with each other');
    const old = back.find((p) => p.title === 'Shed' && p.from !== 'Markdown')?.blocks.find((b) => b.sync)?.sync;
    check(sy !== old, 'blocks 4: and never with the pages they were written from');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 5. every look, The Scan small, BODY 21
  const kit = [
    { id: 'c1', t: 'toggle', runs: [{ text: 'What the plumber said about the pipes under the sink' }] },
    { id: 'c2', t: 'p', under: 'c1', runs: [{ text: 'The joint by the trap is weeping and wants a new washer before the winter' }] },
    { id: 'c3', t: 'toggle', folded: true, runs: [{ text: 'Old quotes' }] },
    { id: 'c4', t: 'p', under: 'c3', runs: [{ text: 'Hidden line' }] },
    { id: 'c5', t: 'p', sync: 'sx', runs: [{ text: 'Keep the receipts in the drawer by the door' }] },
  ];
  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed: seed(kit, [{ id: 's9', t: 'p', sync: 'sx', runs: [{ text: 'Keep the receipts in the drawer by the door' }] }]) });
    check(await openTitled(page, 'Kitchen') && await until(page, () => document.querySelectorAll('.wsblock[data-t="toggle"]').length === 2 && document.querySelectorAll('.wsblock[data-under]').length === 1 && !!document.querySelector('.wsblock[data-sync]')), `blocks ${r.name}: the page opens with its toggles (one folded) and its synced line`);
    if (r.big) await body21(page);
    await page.locator('.wsblock[data-sync] .wsedit').first().click();
    await settle(page);
    await measure(page, '#pg-workspace', `blocks ${r.name}`);
    await ctx.close();
  }
}
