// THE EDITORS LANE, PAGES: MIND MAPS IN THE WORKSPACE (editors.s8), end to end on the phone.
//  1. "make a mind map" in the chat opens a new mind map page; the idea in the middle is a 44 pt key.
//  2. Its panel renames it and ADD A BRANCH grows the map (drawn as a tree from the left, each branch a line in the accent).
//  3. MAKE 2 TO-DOS puts a branch's branches under the map as to-dos; UNDO takes them away; DELETE THIS BRANCH takes a branch with what grew on it.
//  4. Round trip: EXPORT's zip holds the map as a nested list; IMPORT reads it back as a map.
//  5. A map in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21.
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
  const mind = (page) => page.evaluate(() => JSON.parse(window.__ghosty.workspace.json || 'null')?.blocks.find((b) => b.t === 'mind')?.mind ?? []);
  const node = (page, text) => page.locator('.wsmindnode', { hasText: new RegExp(`^${text}$`) }).first();
  const panelKey = (page, label) => page.locator('.wsmindp button', { hasText: new RegExp(`^${label}$`) }).first();
  const typeIdea = async (page, words) => {
    const inp = page.locator('.wsmindp input[aria-label="The idea"]');
    await inp.fill(words);
    await inp.press('Enter');
  };

  {
    const { ctx, page } = await open({ look: LOOKS.scan });
    // 1. the chat's words
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
    const t0 = await page.evaluate(() => Date.now());
    await page.fill('#cin', 'make a mind map');
    await page.keyboard.press('Enter');
    check(await until(page, (t0) => {
      const msgs = [...document.querySelectorAll('#pg-core .msg')];
      const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0).lastIndexOf(true);
      return mine >= 0 && msgs.slice(mine + 1).some((m) => !m.classList.contains('me') && /A mind map page is open in your workspace/.test(m.textContent ?? ''));
    }, t0, 20000), 'mind 1: “make a mind map” is answered in his words');
    check(await until(page, () => window.__ghosty.workspace?.view === 'page' && window.__ghosty.workspace.title === 'Mind map' && !!document.querySelector('.wsmindnode')), 'mind 1: a mind map page opens');
    await ctx.close();
  }
  {
    // (on THE WORKSPACE screen: NEW PAGE → A MIND MAP)
    const { ctx, page } = await open({ look: LOOKS.scan });
    await page.evaluate(() => (location.hash = 'workspace'));
    await page.waitForSelector('#pg-workspace .wssheet', { timeout: 40000 });
    await page.locator('#pg-workspace .wssheet button:visible', { hasText: /^NEW PAGE$/ }).first().click();
    await page.locator('#pg-workspace button[aria-label="A new page with a mind map"]').click();
    check(await until(page, () => window.__ghosty.workspace?.view === 'page' && window.__ghosty.workspace.title === 'Mind map' && !!document.querySelector('#pg-workspace .wsmindnode')), 'mind 1: NEW PAGE → A MIND MAP opens a mind map page');
    await settle(page);
    const nb = await node(page, 'My idea').boundingBox();
    check(nb && nb.height >= 43.5 && nb.width >= 43.5, `mind 1: the idea in the middle is a 44 pt key (${nb ? `${Math.round(nb.width)}×${Math.round(nb.height)}` : 'none'})`);
    // 2. rename and grow
    await node(page, 'My idea').click();
    await typeIdea(page, 'Garden');
    check(await until(page, () => JSON.parse(window.__ghosty.workspace.json).blocks.find((b) => b.t === 'mind')?.mind[0]?.text === 'Garden'), 'mind 2: the idea is renamed');
    await panelKey(page, 'ADD A BRANCH').click();
    await typeIdea(page, 'Plants');
    await node(page, 'Plants').click();
    for (const w of ['Roses', 'Tulips']) {
      await panelKey(page, 'ADD A BRANCH').click();
      await typeIdea(page, w);
      await node(page, 'Plants').click();
    }
    await node(page, 'Garden').click();
    await panelKey(page, 'ADD A BRANCH').click();
    await typeIdea(page, 'Shed');
    check(await until(page, () => (JSON.parse(window.__ghosty.workspace.json).blocks.find((b) => b.t === 'mind')?.mind ?? []).length === 5 && document.querySelectorAll('.wsmindnode').length === 5), `mind 2: the map has grown to five ideas (${(await mind(page)).map((n) => n.text).join(', ')})`);
    check(await page.locator('.wsmindlines path').count() === 4, 'mind 2: four branches drawn');
    const xs = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wsmindnode')].map((b) => [b.textContent, b.getBoundingClientRect().left])));
    check(xs.Garden < xs.Plants && xs.Plants < xs.Roses && xs.Roses === xs.Tulips, 'mind 2: drawn as a tree from the left');
    check(await until(page, () => Object.values(JSON.parse(localStorage.getItem('ghosty.workspace') || '{"pages":{}}').pages).some((p) => p.blocks.some((b) => b.t === 'mind' && b.mind.length === 5))), 'mind 2: kept on this phone');
    // 3. a branch into to-dos
    await node(page, 'Plants').click();
    await panelKey(page, 'MAKE 2 TO-DOS').click();
    check(await until(page, () => JSON.parse(window.__ghosty.workspace.json).blocks.filter((b) => b.t === 'todo').map((b) => b.runs[0]?.text).join('|') === 'Roses|Tulips'), 'mind 3: MAKE 2 TO-DOS puts Roses and Tulips under the map as to-dos');
    check(await until(page, () => window.__ghosty.workspace.said === '2 to-dos are under the map: “Roses”, “Tulips”.'), 'mind 3: said in his words');
    await page.locator('#pg-workspace .wsstatus button', { hasText: /^UNDO$/ }).click();
    check(await until(page, () => !JSON.parse(window.__ghosty.workspace.json).blocks.some((b) => b.t === 'todo')), 'mind 3: UNDO takes them away');
    await node(page, 'Shed').click();
    await panelKey(page, 'DELETE THIS BRANCH').click();
    check(await until(page, () => (JSON.parse(window.__ghosty.workspace.json).blocks.find((b) => b.t === 'mind')?.mind ?? []).length === 4 && !document.querySelector('.wsmindp')), 'mind 3: DELETE THIS BRANCH takes it off');
    // 4. the zip out and in
    await page.evaluate(() => document.querySelector('#pg-workspace .wscrumb')?.click());
    await until(page, () => window.__ghosty.workspace.view === 'home');
    await page.locator('#pg-workspace .wssheet button:visible', { hasText: /^EXPORT$/ }).first().click();
    await page.locator('#pg-workspace .wssheet button:visible', { hasText: /^MAKE THE ZIP$/ }).first().click();
    check(await until(page, () => !!document.querySelector('.wsouts .cvout'), null, 20000), 'mind 4: EXPORT makes the zip');
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator('.wsouts button', { hasText: /^SAVE$/ }).click()]);
    const zip = readFileSync(await dl.path());
    const md = unzipStored(zip)['Mind map.md']?.toString() ?? '';
    check(md.includes('- Garden\n  - Plants\n    - Roses\n    - Tulips'), `mind 4: the Markdown holds the map as a nested list (${md.split('\n').slice(2, 7).join(' / ')})`);
    await page.locator('#pg-workspace .wssheet button:visible', { hasText: /^IMPORT$/ }).first().click().catch(() => undefined);
    await page.setInputFiles('#pg-workspace input[type=file]', { name: 'Mind.zip', mimeType: 'application/zip', buffer: zip });
    check(await until(page, () => {
      const maps = Object.values(JSON.parse(localStorage.getItem('ghosty.workspace') || '{"pages":{}}').pages).filter((p) => !p.deleted && p.blocks.some((b) => b.t === 'mind'));
      return maps.length === 2 && maps.every((p) => p.blocks.find((b) => b.t === 'mind').mind.map((n) => n.text).join('|') === 'Garden|Plants|Roses|Tulips');
    }, null, 20000), 'mind 4: IMPORT reads it back as the same map');
    await ctx.close();
  }

  const now = Date.now();
  const big = [{ id: 'a', text: 'Moving house in the spring', parent: null }, { id: 'b', text: 'Boxes and the van for the Saturday', parent: 'a' }, { id: 'c', text: 'Tell the bank', parent: 'a' }, { id: 'd', text: 'Book the van', parent: 'b' }, { id: 'e', text: 'Ask Sam', parent: 'b' }];
  const seed = { 'ghosty.workspace': { v: 1, versions: {}, at: now, pages: { mm: { id: 'mm', title: 'Moving', icon: 'page', parent: null, blocks: [{ id: 'k', t: 'mind', runs: [], mind: big }], at: now, created: now, order: 0 } } } };
  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed });
    await page.evaluate(() => (location.hash = 'workspace'));
    await page.waitForSelector('#pg-workspace .wssheet', { timeout: 40000 });
    if ((await page.evaluate(() => window.__ghosty.workspace.title)) !== 'Moving') await page.locator('#pg-workspace .wstree .wsopen', { hasText: 'Moving' }).first().click();
    check(await until(page, () => document.querySelectorAll('.wsmindnode').length === 5), `mind ${r.name}: the map is drawn`);
    if (r.big) await body21(page);
    await node(page, 'Boxes and the van for the Saturday').click();
    await settle(page);
    await measure(page, '#pg-workspace', `mind ${r.name}`);
    await ctx.close();
  }
}
