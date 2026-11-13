// THE AGENDA (planlane:agenda): the to-do list as a whole to-do app and the agenda by chat, with no model.
//  - the pure words: the chat's wordings (and the words it leaves to others), a repeat's next day, a to-do found by his words, the views;
//  - by chat at 440 × 956, BODY 21: add (with a day, a repeat), read the list and today's, tick off (exact and loose), clear the done ones,
//    the month opened and said;
//  - on the screen at 440 × 956 and 390 × 844, BODY 21: a star (and the order it makes), ALL · TODAY · UPCOMING · STARRED, a tap on the
//    words to change them and their day (with UNDO), a repeating one ticked makes the next; the diary says it is reading, then what it has;
//  - every key 44 pt, nothing sideways, no word cut; the seven looks with the change box open.
import { openSection } from '../nav.mjs';

export async function run(H) {
  const { check, log, phone, open, fit, chat, PHONE, PHONE2, WORLDS, RAW } = H;
  const A = await H.pure('apps/web/src/features/agenda/asks.ts');
  const T = await H.pure('apps/web/src/features/agenda/todowords.ts');

  // ---- 1. the pure words (a Friday morning: 13 Nov 2026)
  const now = new Date(2026, 10, 13, 9, 0).getTime();
  const said = (w) => JSON.stringify(A.agendaAsked(w, now));
  const want = [
    ['add buy milk to my to-do list', { what: 'add', text: 'Buy milk', due: '' }],
    ['put call the bank on my list for tomorrow', { what: 'add', text: 'Call the bank', due: '2026-11-14' }],
    ['to-do: renew passport by Friday', { what: 'add', text: 'Renew passport', due: '2026-11-20' }],
    ['Can you add book a haircut to my to do list for next week please?', { what: 'add', text: 'Book a haircut', due: '2026-11-16' }],
    ['add take the bins out to my list every Monday', { what: 'add', text: 'Take the bins out', due: '2026-11-16', every: 'weekly' }],
    ["new to-do: email Sam, it's important", { what: 'add', text: 'Email Sam', due: '', star: true }],
    ["what's on my to-do list", { what: 'list', when: 'all' }],
    ['what are my todos', { what: 'list', when: 'all' }],
    ['what do I need to do today', { what: 'list', when: 'today' }],
    ['what is late', { what: 'list', when: 'late' }],
    ['tick off buy milk', { what: 'tick', text: 'buy milk', loose: false }],
    ['cross the bank off my list', { what: 'tick', text: 'the bank', loose: false }],
    ['mark buy milk as done', { what: 'tick', text: 'buy milk', loose: false }],
    ["I've done the passport", { what: 'tick', text: 'the passport', loose: true }],
    ['take buy milk off my list', { what: 'remove', text: 'buy milk' }],
    ['clear my done to-dos', { what: 'clear' }],
    ['show my month', { what: 'month', next: false, show: true }],
    ["what's on this month", { what: 'month', next: false, show: false }],
    ["what's on next month?", { what: 'month', next: true, show: false }],
  ];
  for (const [w, x] of want) check(said(w) === JSON.stringify(x), `[agenda] "${w}" → ${said(w)}`);
  // the words owned elsewhere are left alone: the VOICE lane's, the brain's reminders and diary, the kitchen's list, the weather
  for (const w of ['open the agenda', 'my diary', 'remind me to call mum at 6', 'add dinner on Friday at 7', 'add eggs to my shopping list', 'check the weather', 'what is on today'])
    check(A.agendaAsked(w, now) === null, `[agenda] "${w}" is not the agenda's: ${said(w)}`);
  check(T.nextDue('2026-11-13', 'daily', now) === '2026-11-14' && T.nextDue('2026-11-13', 'weekdays', now) === '2026-11-16' && T.nextDue('2026-11-13', 'weekly', now) === '2026-11-20', `[agenda] a repeat's next day: ${T.nextDue('2026-11-13', 'weekdays', now)}`);
  check(T.nextDue('2026-01-31', 'monthly', new Date(2026, 0, 31).getTime()) === '2026-02-28', `[agenda] monthly from the 31st lands on the month's last day: ${T.nextDue('2026-01-31', 'monthly', new Date(2026, 0, 31).getTime())}`);
  check(T.nextDue('2026-11-01', 'daily', now) === '2026-11-14', `[agenda] a daily one ticked days late comes back tomorrow, not in the past: ${T.nextDue('2026-11-01', 'daily', now)}`);
  const L = [
    { id: 'p', text: 'Renew passport', due: '2026-11-20', done: false, at: 1 },
    { id: 'm', text: 'Buy milk', due: '', done: false, at: 2 },
    { id: 's', text: 'Email Sam', due: '', done: false, at: 3, star: true },
    { id: 'l', text: 'Pay the gas bill', due: '2026-11-10', done: false, at: 4 },
  ];
  check(T.findTodo(L, 'the passport')?.id === 'p' && T.findTodo(L, 'milk')?.id === 'm' && T.findTodo(L, 'gas bill')?.id === 'l' && T.findTodo(L, 'washing up') === null, '[agenda] a to-do found by his words, and nothing found for words not on it');
  check(T.sortTodos(L, now).map((t) => t.id).join('') === 'lspm', `[agenda] late first, then starred, then by day: ${T.sortTodos(L, now).map((t) => t.id).join('')}`);
  check(T.weekWords([], 0) === 'Nothing on' && T.weekWords(['Dentist 10:00'], 1) === 'Dentist 10:00 · 1 to-do' && T.weekWords(['A 09:00', 'B 10:00', 'C 11:00'], 2) === 'A 09:00 and 2 more · 2 to-dos', `[agenda] a day of the week in a line: ${T.weekWords(['A 09:00', 'B 10:00', 'C 11:00'], 2)}`);
  check(L.filter((t) => T.inView(t, 'today', now)).map((t) => t.id).join('') === 'l' && L.filter((t) => T.inView(t, 'upcoming', now)).map((t) => t.id).join('') === 'p' && L.filter((t) => T.inView(t, 'starred', now)).map((t) => t.id).join('') === 's', '[agenda] the views: today (and late), upcoming, starred');
  log('agenda: pure words');

  // ---- 2. by chat, at 440 × 956, BODY 21 (the preview's diary is empty)
  {
    const { ctx, page } = await phone(PHONE, 'scan', {}, 21);
    const reply = async (words, re) => {
      await chat(page, words);
      const got = await page.waitForFunction(({ words, src }) => {
        const msgs = [...document.querySelectorAll('#pg-core .msg')];
        const me = msgs.map((m) => m.classList.contains('me') && (m.textContent ?? '').includes(words)).lastIndexOf(true);
        const r = me >= 0 ? msgs.slice(me + 1).find((m) => !m.classList.contains('me')) : null;
        // the reply's own words (its span), not the name line above it or the keys under it
        const said = r ? [...r.querySelectorAll(':scope > span')].map((s) => s.textContent ?? '').find((s) => new RegExp(src).test(s)) : null;
        return said ?? null;
      }, { words, src: re.source }, { timeout: 10000 }).then((h) => h.jsonValue(), () => '');
      const last = got || (await page.evaluate(() => [...document.querySelectorAll('#pg-core .msg')].slice(-3).map((m) => `${m.className}: ${m.textContent}`).join(' | ')));
      check(!!got && !RAW.test(got), `[agenda chat] "${words}" → ${got || `(no reply matching ${re}; the chat shows: ${last.slice(0, 300)})`}`);
      return got;
    };
    const todos = () => page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.agenda.todo') ?? '[]'));
    await reply('add buy milk to my to-do list', /Added to your to-do list: Buy milk\. 1 to do\./);
    await reply('put call the bank on my list for tomorrow', /Added to your to-do list: Call the bank, due tomorrow\./);
    await reply('to-do: renew passport by Friday', /Added to your to-do list: Renew passport, due \w{3},? \d+ \w{3}\./);
    await reply('add water the plants to my todo list every day', /^Added to your to-do list: Water the plants, due today, repeats every day\. 4 to do\.$/);
    const l = await todos();
    check(l.length === 4 && l.find((t) => t.text === 'Call the bank')?.due === (() => { const d = new Date(Date.now() + 86400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(), `[agenda chat] the to-dos are on the phone's list: ${JSON.stringify(l.map((t) => [t.text, t.due, t.every]))}`);
    await reply("what's on my to-do list", /^4 to do: Water the plants \(due today\); Call the bank \(due tomorrow\); Renew passport \(due \w{3},? \d+ \w{3}\); and Buy milk\.$/);
    check(await page.evaluate(() => document.body.dataset.tab === 'agenda' && !!document.querySelector('#pg-agenda .pn.todo')?.offsetParent).catch(() => false), '[agenda chat] reading the whole list opens it on the screen');
    await reply('what do I need to do today', /^Due today: Water the plants\.$/);
    await reply('tick off buy milk', /^Ticked off: Buy milk\. 3 left to do\.$/);
    await reply("I've done the passport", /^Ticked off: Renew passport\. 2 left to do\.$/);
    await reply('water the plants is done', /^Ticked off: Water the plants\. It repeats: the next one is due tomorrow\. 2 left to do\.$/);
    await reply('tick off walk the dog', /^I can’t find “walk the dog” on your to-do list\. On it: /);
    await reply('clear my done to-dos', /^Cleared 3 done to-dos\. UNDO brings them back\.$/);
    check((await todos()).every((t) => !t.done) && (await todos()).length === 2, `[agenda chat] the done ones are gone: ${JSON.stringify((await todos()).map((t) => t.text))}`);
    await reply('show my month', /^\w+ \(from today\): \d+ events?/);
    await page.waitForFunction(() => document.body.dataset.tab === 'agenda' && !!document.querySelector('#pg-agenda .pn.month')?.offsetParent, null, { timeout: 5000 }).catch(() => check(false, '[agenda chat] "show my month" did not open the month'));
    await reply('show me next month', /^\w+: \d+ events?/);
    check(await page.evaluate(() => /\d{4}/.test(document.querySelector('#pg-agenda .monname')?.textContent ?? '') && document.querySelector('#pg-agenda .monbar button[aria-label="Next month"]')?.disabled === true), '[agenda chat] "next month" turns the month on to it');
    await ctx.close();
  }
  log('agenda: chat');

  // ---- 3. on the screen, at both sizes, BODY 21
  const day = (n) => { const d = new Date(Date.now() + n * 86400_000); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const seed = { 'ghosty.agenda.todo': JSON.stringify([
    { id: 'a1', text: 'Renew the passport before the summer holiday comes round', due: day(5), done: false, at: 1 },
    { id: 'a2', text: 'Buy a kettle', due: '', done: false, at: 2 },
    { id: 'a3', text: 'Take the bins out', due: day(0), done: false, at: 3, every: 'weekly' },
  ]) };
  for (const vp of [PHONE, PHONE2]) {
    const { ctx, page } = await phone(vp, 'scan', seed, 21);
    // the diary says it is reading before it has read (the brain held back a moment), then what it has
    await page.route(/\/api\/agenda\?/, async (r) => { await new Promise((ok) => setTimeout(ok, 1200)); await r.continue(); });
    await open(page, 'agenda');
    const first = await page.textContent('#pg-agenda .pn.scroll:not(.feeds) .bd').catch(() => '');
    check(/Reading your diary/.test(first ?? '') || /Nothing in the next two weeks/.test(first ?? ''), `[agenda ${vp.width}] the diary says it is reading: ${first?.slice(0, 80)}`);
    await page.waitForFunction(() => !/Reading your diary/.test(document.querySelector('#pg-agenda .pn')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => check(false, `[agenda ${vp.width}] the diary never finished reading`));
    await page.unroute(/\/api\/agenda\?/);
    await openSection(page, 'agenda', 'To-do');
    await page.waitForSelector('#pg-agenda .todoit', { timeout: 5000 });
    const order = () => page.$$eval('#pg-agenda .todoit', (e) => e.map((x) => x.dataset.id).join(','));
    check((await order()) === 'a3,a1,a2', `[agenda ${vp.width}] today's first, then by day, then no day: ${await order()}`);
    check(/repeats every week/.test(await page.textContent('#pg-agenda .todoit[data-id="a3"]')), `[agenda ${vp.width}] a repeating one says so`);
    // a star puts it right after the late ones
    await page.click('#pg-agenda .todoit[data-id="a2"] button.todostar');
    await page.waitForFunction(() => document.querySelector('#pg-agenda .todoit')?.dataset.id === 'a2', null, { timeout: 3000 }).catch(() => undefined);
    check((await order()) === 'a2,a3,a1' && (await page.getAttribute('#pg-agenda .todoit[data-id="a2"] button.todostar', 'aria-pressed')) === 'true', `[agenda ${vp.width}] a starred one comes first: ${await order()}`);
    // the views
    await page.click('#pg-agenda .todoviews button:has-text("Starred")');
    check((await order()) === 'a2', `[agenda ${vp.width}] STARRED shows the starred one only: ${await order()}`);
    await page.click('#pg-agenda .todoviews button:has-text("Upcoming")');
    check((await order()) === 'a1', `[agenda ${vp.width}] UPCOMING shows the one with a day ahead: ${await order()}`);
    await page.click('#pg-agenda .todoviews button:has-text("Today")');
    check((await order()) === 'a3', `[agenda ${vp.width}] TODAY shows the one due today: ${await order()}`);
    const fv = await fit(page, '#pg-agenda .pn.todo');
    check(!fv.small.length && !fv.sideways && !fv.cut.length, `[agenda ${vp.width}] the views fit: ${JSON.stringify(fv)}`);
    // a repeating one ticked: the next one comes, a week on
    await page.click('#pg-agenda .todoit[data-id="a3"] button.todotick');
    await page.click('#pg-agenda .todoviews button:has-text("All")');
    const next = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.agenda.todo')).filter((t) => t.text === 'Take the bins out'));
    check(next.length === 2 && next.some((t) => t.done) && next.some((t) => !t.done && t.every === 'weekly'), `[agenda ${vp.width}] ticking a weekly one makes the next: ${JSON.stringify(next.map((t) => [t.due, t.done]))}`);
    check(await page.$$eval('#pg-agenda .todoit:not(.done)', (e) => e.some((x) => /Take the bins out/.test(x.textContent) && /Due \w{3},? \d+ \w{3}/.test(x.textContent))), `[agenda ${vp.width}] the next one shows with its day`);
    // tap the words: change them and the day, SAVE, then UNDO
    await page.click('#pg-agenda .todoit[data-id="a2"] button.todotx');
    await page.waitForSelector('#pg-agenda .todoit[data-id="a2"] .todoedit', { timeout: 3000 }).catch(() => check(false, `[agenda ${vp.width}] tapping the words did not open the change box`));
    const fe = await fit(page, '#pg-agenda .pn.todo');
    check(!fe.small.length && !fe.sideways && !fe.cut.length, `[agenda ${vp.width}] the change box fits: ${JSON.stringify(fe)}`);
    await page.fill('#pg-agenda .todoedit input[aria-label="Change the words"]', 'Buy a steel kettle');
    await page.fill('#pg-agenda .todoedit input[aria-label="Change the day"]', day(1));
    await page.click('#pg-agenda .todoedit button:has-text("Save")');
    await page.waitForFunction(() => /Buy a steel kettle\s*Due tomorrow/.test(document.querySelector('#pg-agenda .todoit[data-id="a2"]')?.innerText ?? ''), null, { timeout: 3000 }).catch(async () => check(false, `[agenda ${vp.width}] the change did not show: ${await page.textContent('#pg-agenda .todoit[data-id="a2"]')}`));
    await page.locator('.undofloat button').first().click({ timeout: 3000 }).catch(() => check(false, `[agenda ${vp.width}] no UNDO after a change`));
    await page.waitForFunction(() => /^Buy a kettle/.test(document.querySelector('#pg-agenda .todoit[data-id="a2"] .todotx')?.innerText ?? ''), null, { timeout: 3000 }).catch(() => check(false, `[agenda ${vp.width}] UNDO did not bring the words back`));
    if (vp === PHONE) await page.screenshot({ path: `${H.out}/planlane-agenda-todo-${vp.width}.png` });

    // THE DIARY: an event tapped open whole, changed (taken out and put back changed, and it says so), then UNDO; removed at the end
    await openSection(page, 'agenda', 'Diary');
    const name = `Spec dentist ${vp.width}`;
    await page.fill('#pg-agenda input[aria-label="Event title"]', name);
    await page.click('#pg-agenda .addev:has(input[aria-label="Event title"]) button');
    const row = (n) => page.locator('#pg-agenda .rw.ev', { has: page.locator('.evt', { hasText: new RegExp(`^${n}$`) }) });
    await row(name).first().waitFor({ timeout: 8000 }).catch(() => check(false, `[agenda ${vp.width}] the event did not go in`));
    await row(name).first().locator('.evt').click();
    await page.waitForSelector('#pg-agenda .evcard', { timeout: 3000 }).catch(() => check(false, `[agenda ${vp.width}] tapping the event did not open it whole`));
    const card = (await page.textContent('#pg-agenda .evcard').catch(() => '')) ?? '';
    check(new RegExp(`^${name}\\w+day \\d+ \\w+, \\d\\d:\\d\\dIn your diary · (reminder 15 min before|no reminder)`).test(card) && /puts it back changed/.test(card) && !RAW.test(card), `[agenda ${vp.width}] the event whole: ${card.slice(0, 160)}`);
    check((await row(name).first().getAttribute('aria-expanded')) === 'true', `[agenda ${vp.width}] the open event says it is open`);
    const fc = await fit(page, '#pg-agenda .evcard');
    check(!fc.small.length && !fc.sideways && !fc.cut.length, `[agenda ${vp.width}] the open event fits: ${JSON.stringify(fc)}`);
    await page.fill('#pg-agenda .evcard input[aria-label="Change the event"]', `${name} moved`);
    await page.fill('#pg-agenda .evcard input[aria-label="Change where"]', 'High Street surgery');
    await page.click('#pg-agenda .evcard button:has-text("Save changes")');
    await row(`${name} moved`).first().waitFor({ timeout: 8000 }).catch(() => check(false, `[agenda ${vp.width}] the change did not show in the diary`));
    check(/High Street surgery/.test(await row(`${name} moved`).first().textContent().catch(() => '')) && (await row(name).count()) === 0, `[agenda ${vp.width}] the diary has the changed event and not the old one`);
    await page.locator('#pg-agenda .pn:has(input[aria-label="Event title"]) .undo button').first().click({ timeout: 4000 }).catch(() => check(false, `[agenda ${vp.width}] no UNDO after changing an event`));
    await row(name).first().waitFor({ timeout: 8000 }).catch(() => check(false, `[agenda ${vp.width}] UNDO did not put the event back as it was`));
    check((await row(`${name} moved`).count()) === 0, `[agenda ${vp.width}] UNDO took the changed one out`);
    // THIS WEEK under the month: seven days, today lit, each with what it holds; a tap says the day whole under the grid
    const wk = await page.$$eval('#pg-agenda .monweek button.monwk', (b) => b.map((x) => ({ t: x.innerText.replace(/\s+/g, ' ').trim(), today: x.classList.contains('today'), label: x.getAttribute('aria-label') })));
    check(wk.length === 7 && wk.filter((d) => d.today).length === 1 && wk.every((d) => /^\w{3} \d{1,2} .+/.test(d.t) && !RAW.test(d.t)), `[agenda ${vp.width}] this week, seven days, today lit: ${JSON.stringify(wk.map((d) => d.t))}`);
    // (the event went in at the box's own time, the next hour but one: its day's line names it when that day is this week)
    const evDay = new Date(Math.ceil(Date.now() / 3600_000) * 3600_000 + 3600_000);
    const evIdx = (evDay.getDay() + 6) % 7;
    const sameWeek = Math.round((new Date(evDay.getFullYear(), evDay.getMonth(), evDay.getDate()) - new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())) / 86400_000) <= 6 - ((new Date().getDay() + 6) % 7);
    if (sameWeek) check(new RegExp(`^\\w{3} \\d{1,2} ${name} \\d\\d:\\d\\d$`).test(wk[evIdx]?.t ?? ''), `[agenda ${vp.width}] the event's day in this week names it: ${wk[evIdx]?.t}`);
    const pickAt = wk.findIndex((d) => !d.today);
    await page.locator('#pg-agenda .monweek button.monwk').nth(pickAt).click();
    check((await page.textContent('#pg-agenda .mdayline')) === wk[pickAt].label, `[agenda ${vp.width}] a day of the week tapped is said under the grid: ${await page.textContent('#pg-agenda .mdayline')}`);
    const fw = await fit(page, '#pg-agenda .pn.month');
    check(!fw.small.length && !fw.sideways && !fw.cut.length, `[agenda ${vp.width}] the month with this week fits: ${JSON.stringify(fw)}`);
    await row(name).first().locator('.del').click();
    await row(name).first().waitFor({ state: 'detached', timeout: 8000 }).catch(() => check(false, `[agenda ${vp.width}] the spec's event was not removed`));
    await ctx.close();
  }
  log('agenda: the screen');

  // ---- 4. the seven looks, all at BODY 21 (390 wide): the list with its views, a done one and the change box open; one phone, the
  // world changed in place by its own command (the jump bar's "World: …"), as he would
  {
    const l = JSON.parse(seed['ghosty.agenda.todo']);
    l.push({ id: 'a4', text: 'Post the parcel', due: '', done: true, at: 4, doneAt: 5 });
    const { ctx, page } = await phone(PHONE2, 'scan', { 'ghosty.agenda.todo': JSON.stringify(l), 'ghosty.agenda.todoview': 'all' }, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    await page.waitForSelector('#pg-agenda .todoit', { timeout: 8000 }).catch(() => check(false, '[agenda looks] no to-dos'));
    await page.click('#pg-agenda .todoit[data-id="a1"] button.todotx').catch(() => undefined);
    // an event of his own opened whole in the diary, over the month and this week
    const evName = 'Spec looks event with a long enough name to wrap';
    await openSection(page, 'agenda', 'Diary');
    await page.fill('#pg-agenda input[aria-label="Event title"]', evName);
    await page.click('#pg-agenda .addev:has(input[aria-label="Event title"]) button');
    const evRow = page.locator('#pg-agenda .rw.ev', { has: page.locator('.evt', { hasText: evName }) }).first();
    await evRow.waitFor({ timeout: 8000 }).catch(() => check(false, '[agenda looks] the event did not go in'));
    await evRow.locator('.evt').click().catch(() => undefined);
    for (const world of WORLDS) {
      await openSection(page, 'agenda', 'Diary');
      const d = await fit(page, '#pg-agenda .evcard');
      const mo = await fit(page, '#pg-agenda .pn.month');
      check((await page.$('#pg-agenda .evcard')) && !d.small.length && !d.sideways && !d.cut.length && !mo.small.length && !mo.cut.length, `[agenda ${world}] the open event and the month with this week fit: ${JSON.stringify({ d, mo })}`);
      await openSection(page, 'agenda', 'To-do');
      const on = await page.evaluate(async (w) => { await window.__ghosty.run(`world_${w}`); return window.__ghosty.theme.recipe().world; }, world).catch(() => '');
      check(on === world, `[agenda ${world}] the look is on: ${on}`);
      await page.waitForSelector('#pg-agenda .todoedit', { timeout: 3000 }).catch(() => check(false, `[agenda ${world}] no change box`));
      const f = await fit(page, '#pg-agenda .pn.todo');
      check(!f.small.length && !f.sideways && !f.cut.length, `[agenda ${world}] TO-DO with the change box and CLEAR DONE fits: ${JSON.stringify(f)}`);
      const c = await page.$eval('#pg-agenda .todoviews button.on', (b) => { const s = getComputedStyle(b); return { color: s.color, bg: getComputedStyle(document.body).backgroundColor }; }).catch(() => null);
      check(c && c.color !== c.bg, `[agenda ${world}] the view that is on is drawn in a colour of the look: ${JSON.stringify(c)}`);
      if (world === 'ink') await page.screenshot({ path: `${H.out}/planlane-agenda-ink-390.png` });
    }
    await openSection(page, 'agenda', 'Diary');
    await page.screenshot({ path: `${H.out}/planlane-agenda-event-390.png` });
    await evRow.locator('.del').click().catch(() => check(false, '[agenda looks] the spec event could not be removed'));
    await ctx.close();
  }
  log('agenda: seven looks');
}
