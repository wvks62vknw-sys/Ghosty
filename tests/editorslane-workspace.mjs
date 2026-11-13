// THE EDITORS LANE, THE WORKSPACE (against Notion): the new everyday tools, end to end on the phone.
//  1. CALLOUT from ADD A BLOCK (and "/"): a note in a tinted box; its 44 pt mark tapped makes it a tip, then a warning, each kept.
//  2. UNDO and REDO step the callout's kind back and forth.
//  3. STRIKE (S) on chosen words of a line, kept as a mark.
//  4. Round trip: EXPORT's zip holds `> [!WARNING] …` and `~~…~~`; the app's own IMPORT reads the zip back with the same callout and mark.
//  5. A page with a callout of each kind in all seven looks at 440 × 956, The Scan at 390 × 844, and at BODY 21: every key 44 pt, nothing sideways.
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
  const mk = (id, title, parent, extra) => ({ id, title, icon: 'page', parent, blocks: [], at: now, created: now, order: 0, ...extra });
  const seed = (blocks) => ({ 'ghosty.workspace': { v: 1, versions: {}, at: now, pages: { kit: mk('kit', 'Kitchen', null, { blocks }) } } });
  const goWorkspace = async (page) => {
    await page.evaluate(() => (location.hash = 'area-make'));
    const pill = '#pg-area-make .hubtile[data-id="editors"] .hubpill[data-editor="workspace"]';
    if (await page.waitForSelector(pill, { timeout: 6000 }).then(() => true, () => false)) await page.click(pill);
    else await page.evaluate(() => (location.hash = 'workspace'));
    await page.waitForSelector('#pg-workspace .wssheet', { timeout: 15000 });
  };
  const sh = (page) => page.locator('#pg-workspace .wssheet').first();
  const key = (page, label) => sh(page).locator('button:visible').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
  const openKitchen = async (page) => {
    await goWorkspace(page);
    if ((await page.evaluate(() => window.__ghosty.workspace.title)) !== 'Kitchen' || (await page.evaluate(() => window.__ghosty.workspace.view)) !== 'page') {
      const row = sh(page).locator('.wstree .wsopen', { hasText: 'Kitchen' }).first();
      await row.scrollIntoViewIfNeeded();
      await row.click();
    }
    return until(page, () => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'Kitchen');
  };
  const blocks = (page) => page.evaluate(() => JSON.parse(window.__ghosty.workspace.json || 'null')?.blocks ?? []);

  // ---------------------------------------------------------------- 1 to 4, one phone, The Scan
  {
    const { ctx, page } = await open({ look: LOOKS.scan, seed: seed([{ id: 'w1', t: 'p', runs: [{ text: 'Order the tiles on Monday' }] }]) });
    check(await openKitchen(page), 'workspace: the Kitchen page opens');
    // 1. a callout from ADD A BLOCK
    await key(page, 'ADD A BLOCK').click();
    check(await until(page, () => !!document.querySelector('.wskind[data-kind="callout"]')), 'workspace: ADD A BLOCK offers CALLOUT');
    await page.locator('.wskind[data-kind="callout"]').click();
    check(await until(page, () => !!document.querySelector('.wsblock[data-t="callout"] .wsedit')), 'workspace: a callout is on the page');
    await page.locator('.wsblock[data-t="callout"] .wsedit').first().click();
    await page.keyboard.type('Measure twice, cut once');
    check(await until(page, () => JSON.parse(window.__ghosty.workspace.json).blocks.some((b) => b.t === 'callout' && b.runs.map((r) => r.text).join('') === 'Measure twice, cut once')), 'workspace: the callout’s words are kept');
    const tone = page.locator('.wsblock[data-t="callout"] .wstone').first();
    const tb = await tone.boundingBox();
    check(tb && tb.width >= 43.5 && tb.height >= 43.5, `workspace: the callout’s mark is 44 pt (${tb ? `${Math.round(tb.width)}×${Math.round(tb.height)}` : 'none'})`);
    check((await tone.getAttribute('aria-label'))?.startsWith('Note: tap to make it a tip'), 'workspace: the mark says what it is and what a tap does');
    await tone.click();
    check(await until(page, () => JSON.parse(window.__ghosty.workspace.json).blocks.find((b) => b.t === 'callout')?.tone === 'tip'), 'workspace: a tap makes it a tip');
    await page.locator('.wsblock[data-t="callout"] .wstone').first().click();
    check(await until(page, () => JSON.parse(window.__ghosty.workspace.json).blocks.find((b) => b.t === 'callout')?.tone === 'warn'), 'workspace: another makes it a warning');
    check(await until(page, () => document.querySelector('.wsblock[data-t="callout"]')?.dataset.tone === 'warn'), 'workspace: the box is drawn as a warning');
    check(await until(page, () => Object.values(JSON.parse(localStorage.getItem('ghosty.workspace') || '{"pages":{}}').pages).some((p) => p.blocks.some((b) => b.t === 'callout' && b.tone === 'warn'))), 'workspace: kept on this phone');
    // 2. undo and redo
    await key(page, 'UNDO').click();
    check(await until(page, () => JSON.parse(window.__ghosty.workspace.json).blocks.find((b) => b.t === 'callout')?.tone === 'tip'), 'workspace: UNDO takes it back to a tip');
    await key(page, 'REDO').click();
    check(await until(page, () => JSON.parse(window.__ghosty.workspace.json).blocks.find((b) => b.t === 'callout')?.tone === 'warn'), 'workspace: REDO makes it a warning again');
    // 3. strike on chosen words
    await page.locator('.wsblock[data-t="p"] .wsedit', { hasText: 'Order the tiles' }).click();
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('.wsblock .wsedit')].find((e) => e.textContent.includes('Order the tiles'));
      el.focus();
      const n = [...el.childNodes].find((x) => x.nodeType === 3 && x.textContent.includes('tiles'));
      const i = n.textContent.indexOf('tiles');
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 5);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    });
    await page.locator('#pg-workspace button[aria-label="Strikethrough"]:visible').first().click();
    check(await until(page, () => JSON.parse(window.__ghosty.workspace.json).blocks.some((b) => b.runs?.some((r) => r.s && r.text === 'tiles'))), 'workspace: S strikes through the chosen word, kept as a mark');
    await page.locator('.wstitle').click();
    // 4. the zip out and in
    await page.evaluate(() => document.querySelector('#pg-workspace .wscrumb')?.click());
    await until(page, () => window.__ghosty.workspace.view !== 'page');
    await key(page, 'EXPORT').click();
    await key(page, 'MAKE THE ZIP').click();
    check(await until(page, () => !!document.querySelector('.wsouts .cvout'), null, 20000), 'workspace: EXPORT makes the zip');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.wsouts button', { hasText: /^SAVE$/ }).click()]);
    const zip = readFileSync(await dl.path());
    const md = unzipStored(zip)['Kitchen.md']?.toString() ?? '';
    check(/^> \[!WARNING\] Measure twice, cut once$/m.test(md) && /~~tiles~~/.test(md), `workspace: the Markdown holds the warning callout and the struck word (${md.split('\n').slice(2, 6).join(' / ')})`);
    await key(page, 'IMPORT').click().catch(() => undefined);
    await page.setInputFiles('#pg-workspace input[type=file]', { name: 'Kitchen.zip', mimeType: 'application/zip', buffer: zip });
    check(await until(page, () => /^Read \d+ pages?/.test(window.__ghosty.workspace.imported ?? ''), null, 20000), 'workspace: IMPORT reads the zip');
    const back = await until(page, () => {
      const kits = Object.values(JSON.parse(localStorage.getItem('ghosty.workspace') || '{"pages":{}}').pages).filter((p) => p.title === 'Kitchen' && !p.deleted);
      return kits.length === 2 && kits.every((p) => p.blocks.some((b) => b.t === 'callout' && b.tone === 'warn' && b.runs.map((r) => r.text).join('') === 'Measure twice, cut once') && p.blocks.some((b) => b.runs?.some((r) => r.s && r.text === 'tiles')));
    });
    check(back, 'workspace: the page read back has the same warning callout and the same struck word');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 5. every look, The Scan small, BODY 21
  const page5 = [
    { id: 'c1', t: 'callout', runs: [{ text: 'The plumber comes on Thursday morning between eight and ten' }] },
    { id: 'c2', t: 'callout', tone: 'tip', runs: [{ text: 'Keep the receipts in the drawer by the door' }] },
    { id: 'c3', t: 'callout', tone: 'warn', runs: [{ text: 'Turn the water off at the stopcock first' }] },
    { id: 'c4', t: 'p', runs: [{ text: 'Old worktop', s: true }, { text: ' goes to the tip.' }] },
  ];
  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed: seed(page5) });
    check(await openKitchen(page) && await until(page, () => document.querySelectorAll('.wsblock[data-t="callout"]').length === 3), `workspace ${r.name}: the page opens with its three callouts`);
    if (r.big) await body21(page);
    await settle(page);
    await measure(page, '#pg-workspace', `workspace ${r.name}`);
    await ctx.close();
  }
}
