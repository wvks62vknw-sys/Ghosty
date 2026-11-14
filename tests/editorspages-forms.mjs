// THE EDITORS LANE, PAGES: FORMS THAT FILL A DATABASE (editors.s1), end to end on the phone.
//  1. A database's FORM asks its columns (the worked-out one said as not asked); a wrong number is said in his words and nothing is added.
//  2. ADD THIS ANSWER makes a new row with every value, the table shows it, the form is clear for the next; a second answer, a second row.
//  3. UNDO takes the last answer back out.
//  4. The form in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21.

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const now = Date.now();
  const db = {
    props: [
      { id: 'pe', name: 'Email', kind: 'text' },
      { id: 'pg', name: 'Guests', kind: 'number' },
      { id: 'pm', name: 'Meal', kind: 'select', options: ['Meat', 'Veg'] },
      { id: 'pd', name: 'Days', kind: 'multi', options: ['Saturday', 'Sunday'] },
      { id: 'pa', name: 'Arrives', kind: 'date' },
      { id: 'pp', name: 'Paid', kind: 'check' },
      { id: 'pt', name: 'Seats', kind: 'formula', formula: 'prop("Guests") + 1' },
    ],
    views: [{ id: 'v1', name: 'Table', kind: 'table', hidden: [] }],
  };
  const seed = { 'ghosty.workspace': { v: 1, versions: {}, at: now, pages: { su: { id: 'su', title: 'Party sign-ups', icon: 'table', parent: null, blocks: [], at: now, created: now, order: 0, db } } } };
  const rows = (page) => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('ghosty.workspace') || '{"pages":{}}').pages).filter((p) => p.parent === 'su' && !p.deleted && p.vals));
  const openForm = async (page) => {
    await page.evaluate(() => (location.hash = 'workspace'));
    await page.waitForSelector('#pg-workspace .wssheet', { timeout: 40000 });
    if ((await page.evaluate(() => window.__ghosty.workspace.title)) !== 'Party sign-ups') {
      const row = page.locator('#pg-workspace .wstree .wsopen', { hasText: 'Party sign-ups' }).first();
      await row.scrollIntoViewIfNeeded();
      await row.click();
    }
    await until(page, () => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'Party sign-ups');
    await page.locator('#pg-workspace .wspagekeys button', { hasText: /^FORM$/ }).click();
    return until(page, () => !!document.querySelector('.wsformp'));
  };
  const fill = async (page, o) => {
    const f = page.locator('.wsformp');
    await f.locator('input[aria-label="Name"]').fill(o.name);
    if (o.email) await f.locator('input[aria-label="Email"]').fill(o.email);
    if (o.guests) await f.locator('input[aria-label="Guests"]').fill(o.guests);
    if (o.meal) await f.locator('select[aria-label="Meal"]').selectOption(o.meal);
    for (const d of o.days ?? []) await f.locator(`input[aria-label="Days: ${d}"]`).check();
    if (o.arrives) await f.locator('input[aria-label="Arrives"]').fill(o.arrives);
    if (o.paid) await f.locator('input[aria-label="Paid"]').check();
  };
  const add = (page) => page.locator('.wsformp button', { hasText: /^ADD THIS ANSWER$/ }).click();

  {
    const { ctx, page } = await open({ look: LOOKS.scan, seed });
    check(await openForm(page), 'forms 1: the database has FORM');
    const qs = await page.locator('.wsformp .wsfqn').allTextContents();
    check(qs.join(' | ') === 'Name | Email | Guests | Meal | Days | Arrives | Paid', `forms 1: the columns are the questions (${qs.join(' | ')})`);
    check((await page.locator('.wsformp').textContent()).includes('Not asked: Seats (worked out).'), 'forms 1: the worked-out column is said as not asked');
    await fill(page, { name: 'Sam', guests: 'lots' });
    await add(page);
    check(await until(page, () => document.querySelector('.wsferr')?.textContent === '“lots” is not a number: Guests wants a number.'), 'forms 1: a wrong number is said in his words');
    check((await rows(page)).length === 0, 'forms 1: and nothing is added');
    // 2. the answer becomes a row
    await fill(page, { name: 'Sam', email: 'sam@example.com', guests: '3', meal: 'Veg', days: ['Sunday'], arrives: '2026-11-21', paid: true });
    await add(page);
    check(await until(page, () => window.__ghosty.workspace.said === 'Added: “Sam” is a new row of Party sign-ups. The form is clear for the next one.'), `forms 2: added, said in his words (${await page.evaluate(() => window.__ghosty.workspace.said)})`);
    check(await until(page, () => Object.values(JSON.parse(localStorage.getItem('ghosty.workspace')).pages).some((p) => p.parent === 'su' && p.title === 'Sam')), 'forms 2: kept on this phone');
    const r1 = (await rows(page)).find((r) => r.title === 'Sam');
    check(JSON.stringify(r1?.vals) === JSON.stringify({ pe: 'sam@example.com', pg: 3, pm: 'Veg', pd: ['Sunday'], pa: '2026-11-21', pp: true }), `forms 2: every answer is in the row (${JSON.stringify(r1?.vals)})`);
    check(await until(page, () => [...document.querySelectorAll('#pg-workspace .wsview, #pg-workspace table')].some((t) => (t.textContent ?? '').includes('Sam'))), 'forms 2: the table shows the new row');
    check(await page.locator('.wsformp input[aria-label="Name"]').inputValue() === '' && !(await page.locator('.wsformp input[aria-label="Paid"]').isChecked()), 'forms 2: the form is clear for the next one');
    await fill(page, { name: 'Priya', meal: 'Meat' });
    await add(page);
    check(await until(page, () => Object.values(JSON.parse(localStorage.getItem('ghosty.workspace')).pages).filter((p) => p.parent === 'su' && p.vals && !p.deleted).length === 2), 'forms 2: a second answer, a second row');
    // 3. UNDO
    await page.locator('#pg-workspace .wsstatus button', { hasText: /^UNDO$/ }).click();
    check(await until(page, () => !Object.values(JSON.parse(localStorage.getItem('ghosty.workspace')).pages).some((p) => p.parent === 'su' && p.title === 'Priya' && !p.deleted)), 'forms 3: UNDO takes the last answer back out');
    check((await rows(page)).some((r) => r.title === 'Sam'), 'forms 3: the first stays');
    await ctx.close();
  }

  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed });
    check(await openForm(page), `forms ${r.name}: FORM opens`);
    if (r.big) await body21(page);
    await settle(page);
    await measure(page, '.wsformp', `forms ${r.name}`);
    await ctx.close();
  }
}
