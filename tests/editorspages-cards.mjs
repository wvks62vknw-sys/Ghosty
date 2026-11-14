// THE EDITORS LANE, PAGES: FLASHCARDS FROM HIS OWN NOTES (editors.c3, into LEARN's own revision), end to end on the phone.
//  1. A page's … → MAKE FLASHCARDS shows the cards before they are made: a "Term: meaning" line, a toggle, a heading with words under it.
//  2. Offline, nothing is made and it says so in his words; back online, MAKE 3 CARDS makes them in Learn (the brain's real tutor route),
//     each state said (making… 1 of 3, done), and they are in Learn's revision on this phone; REVISE NOW opens Learn's revision.
//  3. One of MY DOCUMENTS works too (read, never changed).
//  4. The panel in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21.

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const now = Date.now();
  const stamp = now.toString(36);
  const blocks = [
    { id: 'n1', t: 'h2', runs: [{ text: `Photosynthesis ${stamp}` }] },
    { id: 'n2', t: 'p', runs: [{ text: 'Plants turn light, water and carbon dioxide into sugar and oxygen.' }] },
    { id: 'n3', t: 'ul', runs: [{ text: `Mitochondria ${stamp}: the part of the cell that makes energy` }] },
    { id: 'n4', t: 'toggle', runs: [{ text: `What does osmosis mean ${stamp}?` }] },
    { id: 'n5', t: 'p', under: 'n4', runs: [{ text: 'Water moving through a membrane' }] },
  ];
  const seed = {
    'ghosty.workspace': { v: 1, versions: {}, at: now, pages: { bio: { id: 'bio', title: 'Biology', icon: 'book', parent: null, blocks, at: now, created: now, order: 0 } } },
    'ghosty.docs': [{ id: 'd1', title: 'French words', at: now, kind: 'document', blocks: [{ id: 'x1', t: 'p', runs: [{ text: `la pomme ${stamp}: the apple` }] }] }],
  };
  const openBio = async (page) => {
    await page.evaluate(() => (location.hash = 'workspace'));
    await page.waitForSelector('#pg-workspace .wssheet', { timeout: 15000 });
    if ((await page.evaluate(() => window.__ghosty.workspace.title)) !== 'Biology') {
      const row = page.locator('#pg-workspace .wstree .wsopen', { hasText: 'Biology' }).first();
      await row.scrollIntoViewIfNeeded();
      await row.click();
    }
    await until(page, () => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'Biology');
    await page.locator('#pg-workspace button.wsmore').click();
    await page.locator('#pg-workspace button:visible', { hasText: /^MAKE FLASHCARDS$/ }).click();
    return until(page, () => !!document.querySelector('.wscardsp'));
  };
  const out = (page) => page.evaluate(() => ({ state: document.querySelector('.wscardsout')?.dataset.state ?? '', text: document.querySelector('.wscardsout')?.textContent ?? '' }));

  {
    const { ctx, page } = await open({ look: LOOKS.scan, seed });
    check(await openBio(page), 'cards 1: … → MAKE FLASHCARDS opens');
    const fronts = await page.locator('.wscards li b').allTextContents();
    check(fronts.join(' | ') === `Photosynthesis ${stamp} | Mitochondria ${stamp} | What does osmosis mean ${stamp}?`, `cards 1: the cards are shown before they are made (${fronts.join(' | ')})`);
    check((await page.locator('.wscardsp > p.wsnote').first().textContent()).startsWith('3 cards from “Biology”'), 'cards 1: said in his words (3 cards from “Biology”…)');
    // 2. offline first
    await ctx.setOffline(true);
    await page.locator('.wscardsp button', { hasText: /^MAKE 3 CARDS$/ }).click();
    const off = await out(page);
    check(off.state === 'offline' && off.text === 'Offline: Learn keeps its cards with your brain, so I make them when you are back online. Your page is as it was.', `cards 2: offline, said in his words (${off.text})`);
    await ctx.setOffline(false);
    await page.evaluate(() => {
      window.__cardStates = [];
      const el = document.querySelector('.wscardsout');
      new MutationObserver(() => window.__cardStates.push(el.textContent)).observe(el, { childList: true, subtree: true, characterData: true });
    });
    await page.locator('.wscardsp button', { hasText: /^MAKE 3 CARDS$/ }).click();
    check(await until(page, () => document.querySelector('.wscardsout')?.dataset.state === 'done', null, 30000), `cards 2: the cards are made (${(await out(page)).text})`);
    check((await page.evaluate(() => window.__cardStates)).some((t) => t === 'Making your cards… 1 of 3.'), 'cards 2: the wait is said (Making your cards… 1 of 3.)');
    check((await out(page)).text.startsWith('Done: 3 cards are in Learn’s revision, from “Biology”.'), `cards 2: done, in his words (${(await out(page)).text})`);
    await until(page, (stamp) => (JSON.parse(localStorage.getItem('ghosty.learn') || '{}').cards ?? []).filter((c) => c.front.includes(stamp)).length === 3, stamp, 8000);
    const inLearn = await page.evaluate((stamp) => (JSON.parse(localStorage.getItem('ghosty.learn') || '{}').cards ?? []).filter((c) => c.front.includes(stamp)).map((c) => `${c.front} = ${c.back}`), stamp);
    check(inLearn.length === 3 && inLearn.includes(`What does osmosis mean ${stamp}? = Water moving through a membrane`), `cards 2: they are in Learn's revision on this phone (${inLearn.length})`);
    check((await page.evaluate(() => JSON.parse(window.__ghosty.workspace.json).blocks.length)) === 5, 'cards 2: the page is as it was');
    await page.locator('.wscardsout button', { hasText: /^REVISE NOW$/ }).click();
    check(await until(page, () => location.hash.includes('learn') && !!document.querySelector('#pg-learn')), 'cards 2: REVISE NOW opens Learn’s revision');
    // 3. a document
    check(await openBio(page), 'cards 3: back on the page');
    await page.locator('.wscardsp button[aria-label="Flashcards from my document French words"]').click();
    check(await until(page, (s) => [...document.querySelectorAll('.wscards li b')].map((b) => b.textContent).join('|') === `la pomme ${s}`, stamp), 'cards 3: one of MY DOCUMENTS gives its card');
    await page.locator('.wscardsp button', { hasText: /^MAKE 1 CARD$/ }).click();
    check(await until(page, () => document.querySelector('.wscardsout')?.dataset.state === 'done', null, 30000) && (await out(page)).text.startsWith('Done: 1 card is in Learn’s revision, from “French words”.'), `cards 3: made, in his words (${(await out(page)).text})`);
    await ctx.close();
  }

  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed });
    check(await openBio(page), `cards ${r.name}: MAKE FLASHCARDS opens`);
    if (r.big) await body21(page);
    await settle(page);
    await measure(page, '#pg-workspace', `cards ${r.name}`);
    await ctx.close();
  }
}
