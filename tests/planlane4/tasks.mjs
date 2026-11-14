// CALENDAR AND TASKS, the to-do side (planlane4:tasks): the one list (the brain's work:todo) at the level of the best to-do apps.
//  1. TIMED TO-DOS THAT RING (plan.u4): a to-do with a day and a time gets one reminder job in the brain (Web Push, so it rings with the
//     phone locked); a tick stops it, a new time moves it; the change box has a time; the row says it; the chat and the add field read
//     "call the bank at 3pm".
//  2. QUICK ADD: one field reads "Call the bank tomorrow at 3pm p1 #Home @phone" (and "every Monday", "next Friday", "in 3 days", "by
//     the 20th"), shows chips of what it understood before ADD; a chip tapped is dropped. London days.
//  3. PRIORITIES P1 TO P4: P1 is the old star both ways; a coloured flag; late first, then priority, then day; the P1 view.
//  4. UPCOMING: the next fourteen days from tomorrow, each with its diary events and to-dos, quiet days in one line, then Later; a tap
//     opens an item; the diary on its way, out of reach, and nothing in two weeks, each said.
//  5. SUBTASKS AND NOTES: a to-do opened has its notes and a checklist (add, tick, remove, with UNDO), "2/5" on its row, all by the
//     brain's edit.
//  6. PROJECTS WITH SECTIONS, AND TAGS: PROJECTS lists each project and tag with its count; a project's page is grouped by section;
//     the section from the change box and from quick add ("#Home/Kitchen").
// Every part at 440 × 956 and 390 × 844, BODY 21; 44 pt keys, nothing sideways, no word cut; the seven looks for what is drawn.
import { openSection } from '../nav.mjs';

export async function run(H) {
  const { check, log, phone, open, fit, ask, PHONE, PHONE2, WORLDS, RAW } = H;
  const W = await H.pure('packages/shared/src/work.ts');
  const T = await H.pure('apps/web/src/features/agenda/todowords.ts');
  const A = await H.pure('apps/web/src/features/agenda/asks.ts');
  const post = async (path, body) => (await fetch(`${H.base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': H.KEY }, body: JSON.stringify(body) })).json();
  const brain = (args) => post('/api/packs/do', { pack: 'work', action: 'todo', args });
  const brainList = async () => (await brain({ op: 'list' })).data?.list ?? [];
  const jobs = async () => ((await (await fetch(`${H.base}/api/agenda?days=1&tz=Europe%2FLondon`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': H.KEY } })).json()).jobs ?? []);
  /** wait (polling, never a fixed sleep) until `get()` says `ok` */
  const until = async (get, ok, ms = 8000) => {
    const end = Date.now() + ms;
    let v;
    while (Date.now() < end) {
      v = await get();
      if (ok(v)) return v;
      await new Promise((r) => setTimeout(r, 150));
    }
    return v;
  };
  // London's day and clock (the owner's), whatever the machine's own zone is
  const london = (t = Date.now()) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(t).map((p) => [p.type, p.value]));
  const lday = (t = Date.now()) => { const p = london(t); return `${p.year}-${p.month}-${p.day}`; };
  const addDay = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const x = new Date(Date.UTC(y, m - 1, dd + n)); return x.toISOString().slice(0, 10); };
  const today = lday();
  const tomorrow = addDay(today, 1);
  const row = (page, text) => page.locator('#pg-agenda .todoit', { has: page.locator('.todotx b', { hasText: new RegExp(`^${text}$`) }) }).first();

  // ---- 1. the pure parts
  const now = Date.now();
  check(T.whenWords({ due: T.dayOf(now + 86400_000), time: '08:30', done: false }, now) === 'Due tomorrow · rings at 08:30', `[tasks pure] a timed one's row words: ${T.whenWords({ due: T.dayOf(now + 86400_000), time: '08:30', done: false }, now)}`);
  check(T.whenWords({ due: T.dayOf(now - 2 * 86400_000), time: '08:30', done: false }, now) === '2 days late' && T.whenWords({ due: '', time: '', done: false }, now) === '', '[tasks pure] a late one says only how late; no day says nothing');
  const noon = new Date(2026, 10, 14, 12, 0).getTime();
  check(T.ringDayOf('15:00', noon) === '2026-11-14' && T.ringDayOf('09:00', noon) === '2026-11-15', '[tasks pure] a time with no day rings today while it is ahead, else tomorrow');
  check(T.whenWords({ due: '2026-11-14', time: '09:00', done: false }, noon) === 'Due today · rang at 09:00', `[tasks pure] a time gone today is said as rung: ${T.whenWords({ due: '2026-11-14', time: '09:00', done: false }, noon)}`);
  const a1 = A.agendaAsked('add call the bank at 3pm to my to-do list', noon);
  check(a1?.what === 'add' && a1.text === 'Call the bank' && a1.time === '15:00' && a1.due === '', `[tasks pure] "add call the bank at 3pm to my to-do list": ${JSON.stringify(a1)}`);
  const a2 = A.agendaAsked('put call the bank on my list for tomorrow at 3', noon);
  check(a2?.what === 'add' && a2.text === 'Call the bank' && a2.time === '15:00' && a2.due === '2026-11-15', `[tasks pure] "… for tomorrow at 3": ${JSON.stringify(a2)}`);
  const a3 = A.agendaAsked('to-do: ring the vet at half 9 on Friday', noon);
  check(a3?.what === 'add' && a3.text === 'Ring the vet' && a3.time === '09:30' && a3.due === '2026-11-20', `[tasks pure] "to-do: ring the vet at half 9 on Friday": ${JSON.stringify(a3)}`);
  check(A.agendaAsked('add buy 3 eggs to my list', noon)?.time === undefined, '[tasks pure] a number that is not a time stays in the words');
  const rings = W.todoRings([{ id: 'x', text: 'Call the bank', due: '2026-11-14', time: '15:00', at: 1 }, { id: 'y', text: 'No time', due: '2026-11-14', at: 1 }, { id: 'z', text: 'Done', due: '2026-11-14', time: '15:00', at: 1, done: true }]);
  check(rings.length === 1 && rings[0].title === 'To-do: Call the bank', `[tasks pure] only an open one with a day and a time rings: ${JSON.stringify(rings)}`);
  log('tasks: pure');

  // ---- 2. 440 × 956, BODY 21: the chat's timed to-do rings by the brain's reminder; the change box moves it; a tick stops it
  await brain({ words: 'clear my to-do list' });
  {
    const { ctx, page } = await phone(PHONE, 'scan', {}, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    let r = await ask(page, 'add call the bank at 3pm to my to-do list', /Added to your to-do list: Call the bank/);
    check(r.ok && /It rings at 15:00; tap NOTIFY THIS DEVICE under Reminders so it rings with the phone locked\./.test(r.text) && !RAW.test(r.text), `[tasks chat] "add call the bank at 3pm to my to-do list" → ${r.text.slice(0, 200)}`);
    const want = london().hour * 60 + Number(london().minute) < 15 * 60 ? today : tomorrow;
    let l = await until(brainList, (x) => x.some((t) => t.text === 'Call the bank' && t.time === '15:00'));
    const bank = l.find((t) => t.text === 'Call the bank');
    check(bank?.time === '15:00' && bank?.due === want, `[tasks 440] the brain keeps its time and day (${want}): ${JSON.stringify(bank)}`);
    let j = await until(jobs, (x) => x.some((y) => y.title === 'To-do: Call the bank'));
    const job = j.find((y) => y.title === 'To-do: Call the bank');
    const at = job ? london(job.next) : null;
    check(job && at.hour === '15' && at.minute === '00' && `${at.year}-${at.month}-${at.day}` === want, `[tasks 440] one reminder job rings it at 15:00 on its day: ${JSON.stringify(job ?? j.map((y) => y.title))}`);
    // the row says its time; the line under the list says how to make it ring locked
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    await row(page, 'Call the bank').waitFor({ timeout: 8000 }).catch(() => check(false, '[tasks 440] the timed to-do is not on the list'));
    const words = await row(page, 'Call the bank').locator('.todotx small').textContent().catch(() => '');
    check(new RegExp(`^Due (today|tomorrow) · rings at 15:00$`).test(words ?? ''), `[tasks 440] the row says when it rings: ${words}`);
    check(/^Timed to-dos ring by notification\. Tap NOTIFY THIS DEVICE under Reminders so they ring with the phone locked\.$/.test((await page.textContent('#pg-agenda .tdringoff').catch(() => '')) ?? ''), '[tasks 440] with no notifications on this phone, said under the list');
    // the change box: a new day and time move the ring; UNDO puts it back
    await row(page, 'Call the bank').locator('button.todotx').click();
    await page.waitForSelector('#pg-agenda .todoedit input[aria-label="Change the time it rings"]', { timeout: 3000 }).catch(() => check(false, '[tasks 440] the change box has no time'));
    const fe = await fit(page, '#pg-agenda .pn.todo');
    check(!fe.small.length && !fe.sideways && !fe.cut.length, `[tasks 440] the change box with its time fits: ${JSON.stringify(fe)}`);
    await page.fill('#pg-agenda .todoedit input[aria-label="Change the day"]', addDay(today, 2));
    await page.fill('#pg-agenda .todoedit input[aria-label="Change the time it rings"]', '08:30');
    await page.click('#pg-agenda .todoedit button:has-text("Save")');
    await page.waitForFunction(() => [...document.querySelectorAll('#pg-agenda .todoit .todotx small')].some((s) => /rings at 08:30$/.test(s.textContent ?? '')), null, { timeout: 4000 }).catch(() => check(false, '[tasks 440] the new time did not show on the row'));
    j = await until(jobs, (x) => x.some((y) => y.title === 'To-do: Call the bank' && london(y.next).hour === '08'));
    const moved = j.find((y) => y.title === 'To-do: Call the bank');
    check(moved && london(moved.next).hour === '08' && london(moved.next).minute === '30' && lday(moved.next) === addDay(today, 2) && j.filter((y) => y.title === 'To-do: Call the bank').length === 1, `[tasks 440] the ring moved with it (one job, not two): ${JSON.stringify(j.filter((y) => /^To-do/.test(y.title)))}`);
    await page.locator('.undofloat button').first().click({ timeout: 3000 }).catch(() => check(false, '[tasks 440] no UNDO after changing the time'));
    l = await until(brainList, (x) => x.find((t) => t.text === 'Call the bank')?.time === '15:00');
    check(l.find((t) => t.text === 'Call the bank')?.time === '15:00', `[tasks 440] UNDO put its time back: ${JSON.stringify(l.find((t) => t.text === 'Call the bank'))}`);
    // the add field reads a time too
    await page.fill('#pg-agenda .todoadd input[aria-label="To-do"]', 'Ring the dentist at 4pm');
    await page.click('#pg-agenda .todoadd button');
    l = await until(brainList, (x) => x.some((t) => t.text === 'Ring the dentist'));
    check(l.find((t) => t.text === 'Ring the dentist')?.time === '16:00', `[tasks 440] "Ring the dentist at 4pm" typed in the add field rings at 16:00: ${JSON.stringify(l.find((t) => /dentist/i.test(t.text)))}`);
    // a tick stops the ring
    await row(page, 'Call the bank').locator('button.todotick').click();
    j = await until(jobs, (x) => !x.some((y) => y.title === 'To-do: Call the bank'));
    check(!j.some((y) => y.title === 'To-do: Call the bank'), `[tasks 440] a tick takes its ring away: ${JSON.stringify(j.filter((y) => /^To-do/.test(y.title)).map((y) => y.title))}`);
    await page.screenshot({ path: `${H.out}/planlane4-tasks-ring-440.png` });
    await ctx.close();
  }
  log('tasks: rings');

  // ---- 4. QUICK ADD: the pure reading, then the field's chips at 440, BODY 21 (one tapped away), and what ADD keeps
  const Q = await H.pure('apps/web/src/features/agenda/quickadd.ts');
  {
    const D = '2026-11-14'; // a Saturday
    const q = (s, drop) => { const r = Q.quickParse(s, D, '14:00', drop ? new Set(drop) : undefined); return [r.text, r.due, r.time, r.p, r.project, r.tags.join(','), r.every ?? '', Q.quickLine(r)].join('|'); };
    const cases = [
      ['Call the bank tomorrow at 3pm p1 #Home @phone', 'Call the bank|2026-11-15|15:00|1|Home|phone||Tomorrow · 15:00 · P1 · #Home · @phone'],
      ['Bins out every Monday', 'Bins out|2026-11-16||0|||weekly|Every Monday'],
      ['Pay rent next Friday', 'Pay rent|2026-11-20||0||||Fri 20 Nov'],
      ['Renew passport in 3 days', 'Renew passport|2026-11-17||0||||Tue 17 Nov'],
      ['Send the invoice by the 20th', 'Send the invoice|2026-11-20||0||||Fri 20 Nov'],
      ['Send the invoice by the 2nd', 'Send the invoice|2026-12-02||0||||Wed 2 Dec'],
      ['Water the plants daily', 'Water the plants|||0|||daily|Every day'],
      ['Gym every weekday at 7am', 'Gym||07:00|0|||weekdays|07:00 · Weekdays'],
      ['Ring mum at half 4', 'Ring mum||16:30|0||||16:30 today'],
      ['Call the vet at 9', 'Call the vet||09:00|0||||09:00 tomorrow'],
      ['Dentist 20 Nov 15:30', 'Dentist|2026-11-20|15:30|0||||Fri 20 Nov · 15:30'],
      ['Book the holiday end of the month p4', 'Book the holiday|2026-11-30||0||||Mon 30 Nov · No priority'],
      ['Buy 2 tickets for the show', 'Buy 2 tickets for the show|||0||||'],
      ['Email bob@example.com about Friday’s match', 'Email bob@example.com about Friday’s match|||0||||'],
      ['Call the bank tomorrow at 3pm p1', 'Call the bank tomorrow||15:00|1||||15:00 today · P1', ['due']],
    ];
    for (const [s, want, drop] of cases) check(q(s, drop) === want, `[tasks pure] quick add "${s}"${drop ? ` (${drop} tapped away)` : ''}: ${q(s, drop)} (want ${want})`);
    check(Q.londonNow(Date.UTC(2026, 6, 1, 23, 30)).day === '2026-07-02' && Q.londonNow(Date.UTC(2026, 0, 1, 23, 30)).day === '2026-01-01', '[tasks pure] days are London days (summer time too)');
  }
  await brain({ words: 'clear my to-do list' });
  {
    const { ctx, page } = await phone(PHONE, 'scan', {}, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    await page.fill('#pg-agenda .todoadd input[aria-label="To-do"]', 'Call the plumber tomorrow at 3pm p2 #Home @phone @errands');
    const chipText = () => page.$$eval('#pg-agenda .tqchips button.tqchip span', (s) => s.map((x) => x.textContent).join(' · '));
    await page.waitForFunction(() => document.querySelectorAll('#pg-agenda .tqchips button.tqchip').length === 6, null, { timeout: 3000 }).catch(() => undefined);
    check((await chipText()) === 'Tomorrow · 15:00 · P2 · #Home · @phone · @errands', `[tasks 440] the chips say what it understood: ${await chipText()}`);
    check((await page.getAttribute('#pg-agenda .tqchips button.tqchip.tq-due', 'aria-label')) === 'Keep Tomorrow as words', '[tasks 440] a chip says what a tap does');
    const fq = await fit(page, '#pg-agenda .pn.todo');
    check(!fq.small.length && !fq.sideways && !fq.cut.length, `[tasks 440] the field with its chips fits: ${JSON.stringify(fq)}`);
    await page.click('#pg-agenda .tqchips button.tqchip:has-text("@errands")');
    check((await chipText()) === 'Tomorrow · 15:00 · P2 · #Home · @phone', `[tasks 440] a chip tapped is dropped: ${await chipText()}`);
    await page.click('#pg-agenda .todoadd button');
    let l = await until(brainList, (x) => x.some((t) => /^Call the plumber/.test(t.text)));
    const pl = l.find((t) => /^Call the plumber/.test(t.text));
    check(pl && pl.text === 'Call the plumber @errands' && pl.due === tomorrow && pl.time === '15:00' && pl.p === 2 && !pl.high && pl.project === 'Home' && pl.tags?.join() === 'phone', `[tasks 440] ADD keeps what the chips said (the dropped one stays words): ${JSON.stringify(pl)}`);
    check(await page.$eval('#pg-agenda .tqchips', (c) => c.hidden).catch(() => false) && (await page.inputValue('#pg-agenda .todoadd input[aria-label="To-do"]')) === '', '[tasks 440] after ADD the field and its chips are empty again');
    await row(page, 'Call the plumber @errands').waitFor({ timeout: 6000 }).catch(() => check(false, '[tasks 440] the quick-added one is not on the list'));
    const small = await row(page, 'Call the plumber @errands').locator('.todotx small').textContent().catch(() => '');
    check(small === 'Due tomorrow · rings at 15:00 · #Home · @phone', `[tasks 440] its row says its day, time, project and tags: ${small}`);
    // "every Monday" and "by the 20th", typed and sent with Enter
    await page.fill('#pg-agenda .todoadd input[aria-label="To-do"]', 'Put the bins out every Monday');
    await page.press('#pg-agenda .todoadd input[aria-label="To-do"]', 'Enter');
    await page.fill('#pg-agenda .todoadd input[aria-label="To-do"]', 'Send the invoice by the 20th');
    await page.press('#pg-agenda .todoadd input[aria-label="To-do"]', 'Enter');
    l = await until(brainList, (x) => x.some((t) => t.text === 'Put the bins out') && x.some((t) => t.text === 'Send the invoice'));
    const bins = l.find((t) => t.text === 'Put the bins out');
    const inv = l.find((t) => t.text === 'Send the invoice');
    check(bins?.every === 'weekly' && bins.due === Q.quickParse('every Monday', today, '00:00').due, `[tasks 440] "every Monday" repeats weekly from Monday: ${JSON.stringify(bins)}`);
    check(inv?.due === Q.dayFrom('the 20th', today) && !inv.every, `[tasks 440] "by the 20th": ${JSON.stringify(inv)}`);
    // an empty line is said, never added
    await page.fill('#pg-agenda .todoadd input[aria-label="To-do"]', 'p1 #Home');
    await page.click('#pg-agenda .todoadd button');
    const said = await page.waitForFunction(() => [...document.querySelectorAll('#toasts > *')].map((t) => t.textContent ?? '').find((t) => /Type what needs doing first/.test(t)) ?? null, null, { timeout: 4000 }).then((h) => h.jsonValue(), () => '');
    check(/Type what needs doing first/.test(said), `[tasks 440] a line with only a priority and a project asks for the words: ${said}`);
    await page.fill('#pg-agenda .todoadd input[aria-label="To-do"]', '');
    await page.screenshot({ path: `${H.out}/planlane4-tasks-quickadd-440.png` });
    await ctx.close();
  }
  log('tasks: quick add');

  // ---- 5. PRIORITIES P1 to P4: the order (late, then priority, then day), the flags, P1 both ways with the old star, the P1 view
  {
    const now2 = Date.now();
    const L = [
      { id: 'n', text: 'None', due: T.dayOf(now2), done: false, at: 1 },
      { id: 'a', text: 'P3', due: T.dayOf(now2 + 86400_000), done: false, at: 2, p: 3 },
      { id: 'b', text: 'P2', due: T.dayOf(now2 + 3 * 86400_000), done: false, at: 3, p: 2 },
      { id: 'c', text: 'P1', due: '', done: false, at: 4, star: true },
      { id: 'l', text: 'Late', due: T.dayOf(now2 - 86400_000), done: false, at: 5 },
    ];
    check(T.sortTodos(L, now2).map((t) => t.id).join('') === 'lcban', `[tasks pure] late first, then P1, P2, P3, then none: ${T.sortTodos(L, now2).map((t) => t.id).join('')}`);
    check(T.prioOf({ star: true, p: 3 }) === 1 && T.prioOf({}) === 4 && L.filter((t) => T.inView(t, 'starred', now2)).map((t) => t.id).join('') === 'c', '[tasks pure] P1 is the star; the P1 view shows it alone');
  }
  await brain({ words: 'clear my to-do list' });
  await brain({ op: 'add', item: { id: 'tpx1', text: 'Book the MOT', high: true } });
  await brain({ op: 'add', item: { id: 'tpx2', text: 'Order the new filters', p: 3 } });
  await brain({ op: 'add', item: { id: 'tpx3', text: 'Tidy the garage' } });
  await brain({ op: 'add', item: { id: 'tpx4', text: 'Pay the parking fine', due: addDay(today, -2) } });
  {
    const { ctx, page } = await phone(PHONE2, 'scan', {}, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    const order = () => page.$$eval('#pg-agenda .todoit', (e) => e.map((x) => x.dataset.id).join(','));
    await page.waitForFunction(() => document.querySelectorAll('#pg-agenda .todoit').length === 4, null, { timeout: 8000 }).catch(() => undefined);
    check((await order()) === 'tpx4,tpx1,tpx2,tpx3', `[tasks 390] late first, then P1 (the brain's star), P3, none: ${await order()}`);
    const flag = (id) => page.$eval(`#pg-agenda .todoit[data-id="${id}"] button.todostar`, (b) => ({ t: b.textContent, cls: b.className, label: b.getAttribute('aria-label'), pressed: b.getAttribute('aria-pressed'), color: getComputedStyle(b).color }));
    const f1 = await flag('tpx1');
    const f3 = await flag('tpx2');
    const f4 = await flag('tpx3');
    check(f1.t === '⚑' && /tdp1/.test(f1.cls) && f1.pressed === 'true' && f1.label === 'Take priority 1 off Book the MOT', `[tasks 390] the brain's star shows as the P1 flag: ${JSON.stringify(f1)}`);
    check(f3.t === '⚑' && /tdp3/.test(f3.cls) && f3.label === 'Make Order the new filters priority 1 (now priority 3)' && f4.t === '⚐' && f4.label === 'Make Tidy the garage priority 1', `[tasks 390] P3 and none flagged: ${JSON.stringify([f3, f4])}`);
    check(new Set([f1.color, f3.color, f4.color]).size === 3, `[tasks 390] each priority its own colour of the look: ${[f1.color, f3.color, f4.color]}`);
    // P2 set in the change box: the brain keeps p 2 and no star
    await page.click('#pg-agenda .todoit[data-id="tpx3"] button.todotx');
    await page.selectOption('#pg-agenda .todoedit select[aria-label="Priority"]', '2');
    const fe = await fit(page, '#pg-agenda .pn.todo');
    check(!fe.small.length && !fe.sideways && !fe.cut.length, `[tasks 390] the change box with priority, project and tags fits: ${JSON.stringify(fe)}`);
    await page.fill('#pg-agenda .todoedit input[aria-label="Project"]', 'Home');
    await page.fill('#pg-agenda .todoedit input[aria-label="Tags"]', '@weekend diy');
    await page.click('#pg-agenda .todoedit button:has-text("Save")');
    let l = await until(brainList, (x) => x.find((t) => t.id === 'tpx3')?.p === 2);
    const g = l.find((t) => t.id === 'tpx3');
    check(g?.p === 2 && !g.high && g.project === 'Home' && g.tags?.join() === 'weekend,diy', `[tasks 390] P2, a project and tags from the change box reach the brain: ${JSON.stringify(g)}`);
    await page.waitForFunction(() => document.querySelector('#pg-agenda .todoit[data-id="tpx3"] button.todostar')?.classList.contains('tdp2'), null, { timeout: 4000 }).catch(() => check(false, '[tasks 390] the P2 flag did not show'));
    check((await order()) === 'tpx4,tpx1,tpx3,tpx2', `[tasks 390] P2 now sorts above P3: ${await order()}`);
    // UNDO takes it back to none
    await page.locator('.undofloat button').first().click({ timeout: 3000 }).catch(() => check(false, '[tasks 390] no UNDO after a priority change'));
    l = await until(brainList, (x) => !x.find((t) => t.id === 'tpx3')?.p);
    check(!l.find((t) => t.id === 'tpx3')?.p && !l.find((t) => t.id === 'tpx3')?.project, `[tasks 390] UNDO took its priority and project back: ${JSON.stringify(l.find((t) => t.id === 'tpx3'))}`);
    // the flag tapped on a P3: P1 (the brain's star); tapped again: none
    await page.click('#pg-agenda .todoit[data-id="tpx2"] button.todostar');
    l = await until(brainList, (x) => x.find((t) => t.id === 'tpx2')?.high === true);
    check(l.find((t) => t.id === 'tpx2')?.high === true && !l.find((t) => t.id === 'tpx2')?.p, `[tasks 390] the flag tapped makes it P1, the star WORK and the Brief read: ${JSON.stringify(l.find((t) => t.id === 'tpx2'))}`);
    await page.click('#pg-agenda .todoviews button:has-text("P1")');
    check((await order()) === 'tpx1,tpx2' || (await order()) === 'tpx2,tpx1', `[tasks 390] the P1 view: ${await order()}`);
    await page.click('#pg-agenda .todoit[data-id="tpx2"] button.todostar');
    l = await until(brainList, (x) => !x.find((t) => t.id === 'tpx2')?.high);
    check(!l.find((t) => t.id === 'tpx2')?.high && !l.find((t) => t.id === 'tpx2')?.p, `[tasks 390] tapped again, no priority: ${JSON.stringify(l.find((t) => t.id === 'tpx2'))}`);
    await page.click('#pg-agenda .todoviews button:has-text("All")');
    await page.screenshot({ path: `${H.out}/planlane4-tasks-priorities-390.png` });
    await ctx.close();
  }
  log('tasks: priorities');

  // ---- 6. UPCOMING: the next fourteen days from tomorrow, each with its diary events and to-dos, quiet days in one line, then Later
  {
    const base = new Date(2026, 10, 14, 12, 0).getTime(); // Saturday 14 Nov, noon
    const at = (d, h, m = 0) => new Date(2026, 10, 14 + d, h, m).getTime();
    const L = [
      { id: 't1', text: 'Tomorrow job', due: '2026-11-15', done: false, at: 1 },
      { id: 't2', text: 'Later job', due: '2026-12-10', done: false, at: 2 },
      { id: 't3', text: 'No day', due: '', done: false, at: 3 },
      { id: 't4', text: 'Today job', due: '2026-11-14', done: false, at: 4 },
      { id: 't5', text: 'Done job', due: '2026-11-16', done: true, at: 5 },
    ];
    const E = [{ id: 'e1', title: 'Dentist', start: at(1, 9, 30), end: at(1, 10) }, { id: 'e2', title: 'Birthday', start: at(3, 0), end: at(4, 0), allDay: true }, { id: 'e3', title: 'Today', start: at(0, 15) }];
    const u = T.upcoming(L, E, base);
    check(u.days.length === 14 && u.days[0].day === '2026-11-15' && u.days[13].day === '2026-11-28', `[tasks pure] upcoming: fourteen days from tomorrow: ${u.days[0]?.day}…${u.days[13]?.day}`);
    check(u.days[0].events.map((e) => e.id).join() === 'e1' && u.days[0].todos.map((t) => t.id).join() === 't1' && u.days[2].events.map((e) => e.id).join() === 'e2' && u.days[3].events.length === 0, '[tasks pure] each day has its events (an all-day one on its own day only) and its to-dos');
    check(u.later.map((t) => t.id).join() === 't2' && !u.days.some((d) => d.todos.some((t) => ['t3', 't4', 't5'].includes(t.id))), '[tasks pure] Later holds what is further on; no day, today and done are in neither');
    check(T.upDayWords('2026-11-15', base) === 'Tomorrow' && T.upDayWords('2026-11-17', base) === 'Tue 17 Nov' && T.upEventWhen(E[0]) === '09:30–10:00' && T.upEventWhen(E[1]) === 'All day', `[tasks pure] day and time words: ${T.upDayWords('2026-11-17', base)} ${T.upEventWhen(E[0])}`);
    check(T.quietWords('2026-11-16', '2026-11-16', base) === 'Mon 16 Nov: nothing on' && T.quietWords('2026-11-18', '2026-11-20', base) === 'Wed 18 – Fri 20 Nov: nothing on' && T.quietWords('2026-11-29', '2026-12-02', base) === 'Sun 29 Nov – Wed 2 Dec: nothing on', `[tasks pure] quiet days in one line: ${T.quietWords('2026-11-18', '2026-11-20', base)}`);
  }
  await brain({ words: 'clear my to-do list' });
  await brain({ op: 'add', item: { id: 'tu1', text: 'Post the birthday card', due: tomorrow } });
  await brain({ op: 'add', item: { id: 'tu2', text: 'Pick up the suit', due: addDay(today, 3), time: '12:00', p: 2 } });
  await brain({ op: 'add', item: { id: 'tu3', text: 'Renew the car insurance', due: addDay(today, 30) } });
  await brain({ op: 'add', item: { id: 'tu4', text: 'Sort the loft one day' } });
  await brain({ op: 'add', item: { id: 'tu5', text: 'Water the plants', due: today } });
  {
    const { ctx, page } = await phone(PHONE, 'scan', { 'ghosty.agenda.todoview': 'upcoming' }, 21);
    // his diary as the brain gives it (its jobs and calendars), its events stood in by two of the spec's own in the next days (so no other
    // screen or part sees them, and none of theirs is here), made on the phone's own London clock; held back a moment first, so the view
    // shows it is reading
    const ev = await page.evaluate((day) => {
      const [y, mo, d] = day.split('-').map(Number);
      return [
        { id: 'spec-up-1', title: 'Dentist check-up', start: new Date(y, mo - 1, d, 9, 30).getTime(), end: new Date(y, mo - 1, d, 10).getTime(), source: 'local' },
        { id: 'spec-up-2', title: 'Mum’s birthday', start: new Date(y, mo - 1, d + 2).getTime(), end: new Date(y, mo - 1, d + 3).getTime(), allDay: true, source: 'local' },
      ];
    }, tomorrow);
    let hold = true;
    await page.route(/\/api\/agenda\?/, async (r) => {
      while (hold) await new Promise((ok) => setTimeout(ok, 50));
      const res = await r.fetch();
      const j = await res.json();
      await r.fulfill({ response: res, json: { ...j, events: ev } });
    });
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    const note = await page.waitForSelector('#pg-agenda .tdupnote[data-state="loading"]', { timeout: 8000 }).then((e) => e.textContent(), () => '');
    check(note === 'Reading your diary for the next two weeks…' && !!(await page.$('#pg-agenda .tdup .ak-skel')), `[tasks 440] UPCOMING says it is reading the diary, with skeleton rows: ${note}`);
    hold = false;
    await page.waitForFunction(() => !document.querySelector('#pg-agenda .tdupnote') && document.querySelector('#pg-agenda .tdup .ak-row'), null, { timeout: 10000 }).catch(() => check(false, '[tasks 440] UPCOMING never laid the diary out'));
    const view = await page.$$eval('#pg-agenda .tdup > *', (els) => els.map((e) => e.classList.contains('tdupday') ? `[${e.querySelector('.tduphead')?.textContent}] ${[...e.querySelectorAll('.ak-row, .todoit')].map((r) => r.classList.contains('ak-row') ? `ev:${r.querySelector('.ak-rowtitle')?.textContent} ${r.querySelector('.ak-rowsub')?.textContent}` : `todo:${r.dataset.id}`).join(', ')}` : e.textContent));
    check(view[0] === '[Tomorrow] ev:Dentist check-up 09:30–10:00, todo:tu1', `[tasks 440] tomorrow first, its event then its to-do: ${view[0]}`);
    check(/^\w{3} \d{1,2} \w{3}: nothing on$/.test(view[1] ?? '') && /^\[\w{3} \d{1,2} \w{3}\] ev:Mum’s birthday All day, todo:tu2$/.test(view[2] ?? ''), `[tasks 440] a quiet day in one line, then the birthday with the timed to-do: ${view.slice(1, 3)}`);
    check(/^\w{3} \d{1,2}(?: \w{3})? – \w{3} \d{1,2} \w{3}: nothing on$/.test(view[3] ?? '') && view.at(-1) === '[Later] todo:tu3' && view.length === 5, `[tasks 440] the quiet rest in one line, then Later: ${JSON.stringify(view)}`);
    check(!view.join().includes('tu4') && !view.join().includes('tu5'), '[tasks 440] a to-do with no day, and today’s, are not in UPCOMING');
    const fu = await fit(page, '#pg-agenda .pn.todo');
    check(!fu.small.length && !fu.sideways && !fu.cut.length, `[tasks 440] UPCOMING fits: ${JSON.stringify(fu)}`);
    await page.screenshot({ path: `${H.out}/planlane4-tasks-upcoming-440.png` });
    // a to-do tapped opens its change box; an event tapped opens it whole in the diary
    await page.click('#pg-agenda .tdup .todoit[data-id="tu2"] button.todotx');
    await page.waitForSelector('#pg-agenda .tdup .todoit[data-id="tu2"] .todoedit', { timeout: 3000 }).catch(() => check(false, '[tasks 440] tapping a to-do in UPCOMING did not open it'));
    await page.click('#pg-agenda .tdup .ak-row[data-id="spec-up-1"] button.ak-rowmain');
    await page.waitForFunction(() => /Dentist check-up/.test(document.querySelector('#pg-agenda .evcard')?.textContent ?? '') && !!document.querySelector('#pg-agenda .evcard')?.offsetParent, null, { timeout: 5000 }).catch(() => check(false, '[tasks 440] tapping an event in UPCOMING did not open it in the diary'));
    await ctx.close();
  }
  {
    // the brain out of reach (the phone read the diary as it started, so it holds a copy): UPCOMING says its days are that copy
    const { ctx, page } = await phone(PHONE2, 'scan', { 'ghosty.agenda.todoview': 'upcoming' }, 21);
    await page.route(/\/api\/agenda\?/, (r) => r.abort());
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    const off = await page.waitForSelector('#pg-agenda .tdupnote[data-state="offline"]', { timeout: 10000 }).then((e) => e.textContent(), () => '');
    check(off === 'Ghosty’s brain is out of reach, so these days show your diary from the last copy on this phone.', `[tasks 390] UPCOMING with the brain out of reach says so: ${off}`);
    await page.waitForSelector('#pg-agenda .tdup .todoit[data-id="tu1"]', { timeout: 8000 }).catch(() => check(false, '[tasks 390] the to-dos still show with no diary'));
    const fo = await fit(page, '#pg-agenda .pn.todo');
    check(!fo.small.length && !fo.sideways && !fo.cut.length, `[tasks 390] UPCOMING with no diary fits: ${JSON.stringify(fo)}`);
    // nothing in two weeks: said, with what to do
    await brain({ words: 'clear my to-do list' });
    await brain({ op: 'add', item: { id: 'tu6', text: 'Sort the loft one day' } });
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => /Nothing in the next two weeks/.test(document.querySelector('#pg-agenda .tdupempty')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => check(false, '[tasks 390] an empty UPCOMING did not say so'));
    check((await page.textContent('#pg-agenda .tdupempty').catch(() => '')) === 'Nothing in the next two weeks: no events and no to-dos with a day. Give a to-do a day and it shows here.', '[tasks 390] an empty UPCOMING in his words');
    await ctx.close();
  }
  log('tasks: upcoming');

  // ---- 7. SUBTASKS AND NOTES: a to-do opened has its notes and a checklist (add, tick, remove, each with UNDO); "2/5" on its row
  check(T.stepsWords({ steps: [{ id: 'a', text: 'A', done: true }, { id: 'b', text: 'B' }] }) === '1/2' && T.stepsWords({}) === '', '[tasks pure] a checklist said on the row as done of all');
  await brain({ words: 'clear my to-do list' });
  await brain({ op: 'add', item: { id: 'tst', text: 'Pack for the Lisbon trip', due: addDay(today, 4) } });
  {
    const { ctx, page } = await phone(PHONE, 'scan', {}, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    const it = '#pg-agenda .todoit[data-id="tst"]';
    await page.waitForSelector(it, { timeout: 8000 }).catch(() => check(false, '[tasks steps] the to-do is not on the list'));
    await page.click(`${it} button.todotx`);
    const none = await page.waitForSelector(`${it} .tdstepnone[data-state="empty"]`, { timeout: 3000 }).then((e) => e.textContent(), () => '');
    check(none === 'No steps yet. Break it down: add the first one below.', `[tasks steps] an empty checklist says what to do: ${none}`);
    for (const s of ['Passport', 'Phone charger', 'Euros']) {
      await page.fill(`${it} input[aria-label="Add a step"]`, s);
      await page.press(`${it} input[aria-label="Add a step"]`, 'Enter');
      await page.waitForFunction(({ it, s }) => [...document.querySelectorAll(`${it} .tdstep .tdsteptx`)].some((x) => x.textContent === s), { it, s }, { timeout: 3000 }).catch(() => check(false, `[tasks steps] the step "${s}" did not go in`));
    }
    check(await page.evaluate((it) => document.activeElement === document.querySelector(`${it} input[aria-label="Add a step"]`), it), '[tasks steps] after a step goes in, the step box keeps the focus for the next');
    await page.click(`${it} .tdstep:has-text("Passport") button.tdsteptick`);
    await page.waitForFunction((it) => /1\/3/.test(document.querySelector(`${it} .todotx small`)?.textContent ?? ''), it, { timeout: 3000 }).catch(() => undefined);
    const small = await page.textContent(`${it} .todotx small`).catch(() => '');
    check(/^Due \w{3} \d{1,2} \w{3} · 1\/3$/.test(small ?? ''), `[tasks steps] the row says 1/3: ${small}`);
    check((await page.textContent(`${it} .tdstepshead`)) === 'Checklist · 1/3 done', '[tasks steps] the checklist says how far along it is');
    let l = await until(brainList, (x) => x.find((t) => t.id === 'tst')?.steps?.length === 3 && x.find((t) => t.id === 'tst')?.steps?.[0]?.done);
    check(l.find((t) => t.id === 'tst')?.steps?.map((s) => `${s.text}${s.done ? '✓' : ''}`).join() === 'Passport✓,Phone charger,Euros', `[tasks steps] the brain keeps the checklist: ${JSON.stringify(l.find((t) => t.id === 'tst')?.steps)}`);
    // a step removed, then UNDO brings it back
    await page.click(`${it} .tdstep:has-text("Euros") button.todox`);
    await page.waitForFunction((it) => document.querySelectorAll(`${it} .tdstep`).length === 2, it, { timeout: 3000 }).catch(() => check(false, '[tasks steps] the step was not removed'));
    await page.locator('.undofloat button').first().click({ timeout: 3000 }).catch(() => check(false, '[tasks steps] no UNDO after removing a step'));
    l = await until(brainList, (x) => x.find((t) => t.id === 'tst')?.steps?.length === 3);
    check(l.find((t) => t.id === 'tst')?.steps?.length === 3 && (await page.$$(`${it} .tdstep`)).length === 3, '[tasks steps] UNDO put the step back, on the phone and in the brain');
    // notes, kept with SAVE
    await page.fill(`${it} textarea[aria-label="Notes"]`, 'Flight at 07:10 from Gatwick.\nTaxi booked.');
    const fd = await fit(page, '#pg-agenda .pn.todo');
    check(!fd.small.length && !fd.sideways && !fd.cut.length, `[tasks steps 440] the open to-do with its notes and checklist fits: ${JSON.stringify(fd)}`);
    await page.screenshot({ path: `${H.out}/planlane4-tasks-steps-440.png` });
    await page.click(`${it} .todoedit button:has-text("Save")`);
    l = await until(brainList, (x) => !!x.find((t) => t.id === 'tst')?.notes);
    check(l.find((t) => t.id === 'tst')?.notes === 'Flight at 07:10 from Gatwick.\nTaxi booked.', `[tasks steps] the notes reach the brain: ${JSON.stringify(l.find((t) => t.id === 'tst')?.notes)}`);
    await page.click(`${it} button.todotx`);
    check((await page.inputValue(`${it} textarea[aria-label="Notes"]`)) === 'Flight at 07:10 from Gatwick.\nTaxi booked.', '[tasks steps] opened again, the notes are there');
    await ctx.close();
  }
  log('tasks: steps and notes');

  // ---- 8. PROJECTS WITH SECTIONS, AND TAGS: each project and tag with its count; a project's page grouped by section; the section in
  // the change box and in quick add ("#Home/Kitchen")
  {
    const r = Q.quickParse('Fix the tap #Home/Kitchen @diy', '2026-11-14', '14:00');
    check(r.text === 'Fix the tap' && r.project === 'Home' && r.section === 'Kitchen' && Q.quickLine(r) === '#Home / Kitchen · @diy', `[tasks pure] "#Home/Kitchen" is a project and its section: ${JSON.stringify(r)}`);
    const L = [
      { id: 'a', text: 'A', due: '', done: false, at: 1, project: 'Home', section: 'Kitchen' },
      { id: 'b', text: 'B', due: '', done: false, at: 2, project: 'home' },
      { id: 'c', text: 'C', due: '', done: false, at: 3, project: 'Home', section: 'Garden', tags: ['diy'] },
      { id: 'd', text: 'D', due: '', done: false, at: 4, tags: ['diy', 'phone'] },
      { id: 'e', text: 'E', due: '', done: true, at: 5, project: 'Work' },
    ];
    const pr = T.projectsOf(L, Date.now());
    check(JSON.stringify(pr.projects.map((x) => [x.name, x.open, x.sections])) === '[["Home",3,2]]' && pr.loose === 1 && pr.tags.map((x) => `${x.name}${x.open}`).join() === 'diy2,phone1', `[tasks pure] projects and tags with their counts (a done one is not counted): ${JSON.stringify(pr)}`);
    check(T.bySection(L, 'HOME', Date.now()).map((g) => `${g.section}:${g.todos.map((t) => t.id).join('')}`).join(' ') === ':b Garden:c Kitchen:a' && T.projectSub(pr.projects[0]) === '2 sections', '[tasks pure] a project grouped by section, those in none first, then by name');
  }
  await brain({ words: 'clear my to-do list' });
  await brain({ op: 'add', item: { id: 'tj1', text: 'Fix the dripping tap', project: 'Home', section: 'Kitchen' } });
  await brain({ op: 'add', item: { id: 'tj2', text: 'Descale the kettle', project: 'Home', section: 'Kitchen', tags: ['diy'] } });
  await brain({ op: 'add', item: { id: 'tj3', text: 'Book the boiler service', project: 'Home', due: addDay(today, -1) } });
  await brain({ op: 'add', item: { id: 'tj4', text: 'Send the invoice', project: 'Work', tags: ['phone'] } });
  await brain({ op: 'add', item: { id: 'tj5', text: 'Buy stamps' } });
  {
    const { ctx, page } = await phone(PHONE2, 'scan', {}, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    await page.waitForSelector('#pg-agenda .todoit[data-id="tj5"]', { timeout: 8000 }).catch(() => check(false, '[tasks projects] the list did not arrive'));
    await page.click('#pg-agenda .todoviews button:has-text("Projects")');
    const rows = () => page.$$eval('#pg-agenda .tdproj .ak-row', (r) => r.map((x) => [x.querySelector('.ak-rowtitle')?.textContent, x.querySelector('.ak-rowsub')?.textContent ?? '', x.querySelector('.ak-rowmeta')?.textContent].join('|')));
    await page.waitForSelector('#pg-agenda .tdproj .ak-row', { timeout: 3000 }).catch(() => undefined);
    check((await rows()).join(' / ') === 'Home|1 late · 1 section|3 / Work||1 / @diy||1 / @phone||1', `[tasks projects] each project and tag with its count: ${(await rows()).join(' / ')}`);
    check(/^1 more in no project: All has them\.$/.test((await page.textContent('#pg-agenda .tdproj .tdupquiet').catch(() => '')) ?? ''), '[tasks projects] the to-dos in no project are said');
    const fp = await fit(page, '#pg-agenda .pn.todo');
    check(!fp.small.length && !fp.sideways && !fp.cut.length, `[tasks projects 390] PROJECTS fits: ${JSON.stringify(fp)}`);
    await page.click('#pg-agenda .tdproj .ak-row[data-id="project:Home"] button.ak-rowmain');
    const groups = () => page.$$eval('#pg-agenda .tdproj .tdupday', (g) => g.map((x) => `${x.querySelector('.tduphead')?.textContent ?? ''}:${[...x.querySelectorAll('.todoit')].map((t) => t.dataset.id).join(',')}`));
    await page.waitForSelector('#pg-agenda .tdprojname', { timeout: 3000 }).catch(() => undefined);
    check((await page.textContent('#pg-agenda .tdprojname')) === 'Home' && (await groups()).join(' ') === 'No section:tj3 Kitchen:tj1,tj2', `[tasks projects] the Home page, grouped by section: ${(await groups()).join(' ')}`);
    const fg = await fit(page, '#pg-agenda .pn.todo');
    check(!fg.small.length && !fg.sideways && !fg.cut.length, `[tasks projects 390] a project's page fits: ${JSON.stringify(fg)}`);
    await page.screenshot({ path: `${H.out}/planlane4-tasks-project-390.png` });
    // the section from the change box: the boiler goes in a section of its own
    await page.click('#pg-agenda .tdproj .todoit[data-id="tj3"] button.todotx');
    await page.fill('#pg-agenda .todoedit input[aria-label="Section"]', 'Heating');
    await page.click('#pg-agenda .todoedit button:has-text("Save")');
    const l = await until(brainList, (x) => x.find((t) => t.id === 'tj3')?.section === 'Heating');
    check(l.find((t) => t.id === 'tj3')?.section === 'Heating', `[tasks projects] the section reaches the brain: ${JSON.stringify(l.find((t) => t.id === 'tj3'))}`);
    await page.waitForFunction(() => [...document.querySelectorAll('#pg-agenda .tdproj .tduphead')].some((x) => x.textContent === 'Heating'), null, { timeout: 4000 }).catch(() => undefined);
    check((await groups()).join(' ') === 'Heating:tj3 Kitchen:tj1,tj2', `[tasks projects] the page follows, its sections by name: ${(await groups()).join(' ')}`);
    // back, then a tag's page
    await page.click('#pg-agenda .tdproj button.tdprojback');
    await page.click('#pg-agenda .tdproj .ak-row[data-id="tag:phone"] button.ak-rowmain');
    await page.waitForFunction(() => document.querySelector('#pg-agenda .tdprojname')?.textContent === '@phone', null, { timeout: 3000 }).catch(() => undefined);
    check((await groups()).join(' ') === ':tj4', `[tasks projects] the @phone page: ${(await groups()).join(' ')}`);
    // a project whose to-dos are all ticked says so
    await page.click('#pg-agenda .tdproj .todoit[data-id="tj4"] button.todotick');
    const done = await page.waitForSelector('#pg-agenda .tdprojnone[data-state="empty"]', { timeout: 4000 }).then((e) => e.textContent(), () => '');
    check(done === 'Nothing open in @phone: everything here is done.', `[tasks projects] all ticked, said: ${done}`);
    await ctx.close();
  }
  log('tasks: projects');

  // ---- 9. 390 × 844, BODY 21, the seven looks: a timed P2 to-do with its project, tags, notes and checklist open, and quick add's chips
  await brain({ op: 'add', item: { id: 'tlook', text: 'Ring the dentist about the crown', due: tomorrow, time: '16:00', p: 2, project: 'Health', tags: ['phone'], notes: 'Ask about the temporary crown and the cost.', steps: [{ id: 'k1', text: 'Find the appointment letter', done: true }, { id: 'k2', text: 'Ask about the cost' }] } });
  {
    const { ctx, page } = await phone(PHONE2, 'scan', {}, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    await page.locator('#pg-agenda .todoit[data-id="tlook"]').waitFor({ timeout: 8000 }).catch(() => check(false, '[tasks looks] the one list did not reach this phone'));
    await page.click('#pg-agenda .todoit[data-id="tlook"] button.todotx').catch(() => undefined);
    await page.fill('#pg-agenda .todoadd input[aria-label="To-do"]', 'Call the bank tomorrow at 3pm p1 #Home @phone');
    for (const world of WORLDS) {
      const on = await page.evaluate(async (w) => { await window.__ghosty.run(`world_${w}`); return window.__ghosty.theme.recipe().world; }, world).catch(() => '');
      check(on === world, `[tasks ${world}] the look is on: ${on}`);
      await page.waitForSelector('#pg-agenda .todoedit input[aria-label="Change the time it rings"]', { timeout: 3000 }).catch(() => check(false, `[tasks ${world}] no time in the change box`));
      const f = await fit(page, '#pg-agenda .pn.todo');
      check(!f.small.length && !f.sideways && !f.cut.length && (await page.$$('#pg-agenda .todoit[data-id="tlook"] .tdstep')).length === 2, `[tasks ${world} 390] the list, the chips and the open to-do with its checklist fit: ${JSON.stringify(f)}`);
      const c = await page.evaluate(() => {
        const bg = getComputedStyle(document.body).backgroundColor;
        const col = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).color : ''; };
        return { bg, chip: col('#pg-agenda .tqchip.tq-due'), flag: col('#pg-agenda .todoit[data-id="tlook"] button.todostar') };
      });
      check(c.chip && c.flag && c.chip !== c.bg && c.flag !== c.bg, `[tasks ${world}] the chips and the flag are drawn in colours of the look: ${JSON.stringify(c)}`);
      if (world === 'ink' || world === 'glass') await page.screenshot({ path: `${H.out}/planlane4-tasks-${world}-390.png` });
      // PROJECTS and a project's page in the same look, then back to All with the open to-do
      await page.click('#pg-agenda .todoviews button:has-text("Projects")');
      await page.click('#pg-agenda .tdproj .ak-row[data-id="project:Health"] button.ak-rowmain').catch(() => check(false, `[tasks ${world}] no Health project`));
      await page.waitForSelector('#pg-agenda .tdprojname', { timeout: 3000 }).catch(() => undefined);
      const fpj = await fit(page, '#pg-agenda .pn.todo');
      const pc = await page.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, head: getComputedStyle(document.querySelector('#pg-agenda .tdprojname') ?? document.body).color }));
      check(!fpj.small.length && !fpj.sideways && !fpj.cut.length && pc.head !== pc.bg, `[tasks ${world} 390] a project's page fits, in a colour of the look: ${JSON.stringify({ fpj, pc })}`);
      await page.click('#pg-agenda .todoviews button:has-text("All")');
    }
    await ctx.close();
  }
  log('tasks: the seven looks');
}
