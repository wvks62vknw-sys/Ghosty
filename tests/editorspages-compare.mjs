// THE EDITORS LANE, PAGES: COMPARE TWO VERSIONS SIDE BY SIDE (editors.u10, the workspace's HISTORY first), end to end on the phone.
//  1. HISTORY → a version → COMPARE WITH NOW: THEN beside NOW, the summary in his words, words gone struck and words come underlined.
//  2. BRING THIS BACK on one changed line brings back just that line; UNDO takes it away again; a gone block comes back in its place;
//     TAKE THIS OUT takes an added block out.
//  3. The compare view in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21.

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const now = Date.now();
  const then = [
    { id: 'b1', t: 'p', runs: [{ text: 'Order the blue tiles for the splashback' }] },
    { id: 'b2', t: 'p', runs: [{ text: 'Call the plumber on Monday' }] },
    { id: 'b3', t: 'todo', runs: [{ text: 'Measure the worktop' }] },
  ];
  const cur = [
    { id: 'b1', t: 'p', runs: [{ text: 'Order the white tiles for the splashback' }] },
    { id: 'b3', t: 'todo', runs: [{ text: 'Measure the worktop' }] },
    { id: 'b4', t: 'p', runs: [{ text: 'Pick up the grout' }] },
  ];
  const seed = { 'ghosty.workspace': { v: 1, at: now, versions: { kit: [{ at: now - 3 * 3600_000, title: 'Kitchen', icon: 'page', blocks: then }] }, pages: { kit: { id: 'kit', title: 'Kitchen', icon: 'page', parent: null, blocks: cur, at: now, created: now - 86_400_000, order: 0 } } } };
  const texts = (page) => page.evaluate(() => (JSON.parse(localStorage.getItem('ghosty.workspace') || '{"pages":{}}').pages.kit?.blocks ?? []).map((b) => b.runs.map((r) => r.text).join('')));
  const openCompare = async (page) => {
    await page.evaluate(() => (location.hash = 'workspace'));
    await page.waitForSelector('#pg-workspace .wssheet', { timeout: 40000 });
    if ((await page.evaluate(() => window.__ghosty.workspace.title)) !== 'Kitchen') await page.locator('#pg-workspace .wstree .wsopen', { hasText: 'Kitchen' }).first().click();
    await until(page, () => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'Kitchen');
    await page.locator('#pg-workspace button.wsmore').click();
    await page.locator('#pg-workspace button:visible', { hasText: /^HISTORY$/ }).click();
    await until(page, () => window.__ghosty.workspace.view === 'history' && !!document.querySelector('.wsver'));
    await page.locator('.wsver').first().click();
    await page.locator('#pg-workspace button:visible', { hasText: /^COMPARE WITH NOW$/ }).click();
    return until(page, () => !!document.querySelector('.wscmpsum'));
  };
  const part = (page, id) => page.locator(`.wscmp[data-id="${id}"]`);

  {
    const { ctx, page } = await open({ look: LOOKS.scan, seed });
    check(await openCompare(page), 'compare 1: HISTORY → a version → COMPARE WITH NOW');
    check((await page.locator('.wscmpsum').textContent()) === '3 changes: 1 changed, 1 gone, 1 added.', `compare 1: the summary in his words (${await page.locator('.wscmpsum').textContent()})`);
    check((await page.locator('.wscmphead b').allTextContents()).join(' ') === 'THEN NOW', 'compare 1: THEN beside NOW');
    const tb = await part(page, 'b1').locator('.wscmpthen').boundingBox();
    const nb = await part(page, 'b1').locator('.wscmpnow').boundingBox();
    check(tb && nb && nb.x > tb.x + 20 && Math.abs(nb.y - tb.y) < 4, 'compare 1: side by side');
    check((await part(page, 'b1').locator('del.wscmpgone').textContent()) === 'blue' && (await part(page, 'b1').locator('ins.wscmpcame').textContent()) === 'white', 'compare 1: the word gone struck, the word come underlined');
    check(await part(page, 'b2').getAttribute('data-kind') === 'gone' && await part(page, 'b4').getAttribute('data-kind') === 'came', 'compare 1: a gone block and an added block are marked');
    check(await page.locator('.wscmp[data-id="b3"]').count() === 0 && (await page.locator('.wsvpreview').textContent()).includes('1 block the same in both.'), 'compare 1: the same block is counted, not repeated');
    // 2. one part back
    await part(page, 'b1').locator('button', { hasText: /^BRING THIS BACK$/ }).click();
    check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.workspace')).pages.kit.blocks[0].runs[0].text === 'Order the blue tiles for the splashback'), 'compare 2: BRING THIS BACK brings back just that line');
    const after = await texts(page);
    check(after.includes('Pick up the grout') && !after.includes('Call the plumber on Monday'), 'compare 2: and nothing else');
    check(await until(page, () => window.__ghosty.workspace.said === 'Brought back from that version, just that part. UNDO takes it away again.'), 'compare 2: said in his words');
    check(await until(page, () => document.querySelector('.wscmpsum')?.textContent === '2 changes: 1 gone, 1 added.'), 'compare 2: the compare redraws with what is left');
    await page.locator('#pg-workspace .wsstatus button', { hasText: /^UNDO$/ }).click();
    check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.workspace')).pages.kit.blocks[0].runs[0].text === 'Order the white tiles for the splashback'), 'compare 2: UNDO takes it away again');
    check(await until(page, () => document.querySelector('.wscmpsum')?.textContent === '3 changes: 1 changed, 1 gone, 1 added.'), 'compare 2: after UNDO the compare stays open, as it was');
    await part(page, 'b2').locator('button', { hasText: /^BRING THIS BACK$/ }).click();
    check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.workspace')).pages.kit.blocks.map((b) => b.id).join(',') === 'b1,b2,b3,b4'), 'compare 2: a gone block comes back in its place');
    await part(page, 'b4').locator('button', { hasText: /^TAKE THIS OUT$/ }).click();
    check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.workspace')).pages.kit.blocks.map((b) => b.id).join(',') === 'b1,b2,b3'), 'compare 2: TAKE THIS OUT takes the added block out');
    await ctx.close();
  }

  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed });
    check(await openCompare(page), `compare ${r.name}: the compare view opens`);
    if (r.big) await body21(page);
    await settle(page);
    await measure(page, '#pg-workspace', `compare ${r.name}`);
    await ctx.close();
  }
}
