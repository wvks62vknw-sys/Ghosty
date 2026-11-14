// CALENDAR AND TASKS, the to-do side (planlane4:tasks): the one list (the brain's work:todo) at the level of the best to-do apps.
//  1. TIMED TO-DOS THAT RING (plan.u4): a to-do with a day and a time gets one reminder job in the brain (Web Push, so it rings with the
//     phone locked); a tick stops it, a new time moves it; the change box has a time; the row says it; the chat and the add field read
//     "call the bank at 3pm".
//  2. QUICK ADD: one field reads "Call the bank tomorrow at 3pm p1 #Home @phone" (and "every Monday", "next Friday", "in 3 days", "by
//     the 20th"), shows chips of what it understood before ADD; a chip tapped is dropped. London days.
//  3. PRIORITIES P1 TO P4: P1 is the old star both ways; a coloured flag; late first, then priority, then day; the P1 view.
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

  // ---- 9. 390 × 844, BODY 21, the seven looks: a timed P2 to-do with its project and tags, its change box open, and quick add's chips
  await brain({ op: 'add', item: { id: 'tlook', text: 'Ring the dentist about the crown', due: tomorrow, time: '16:00', p: 2, project: 'Health', tags: ['phone'] } });
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
      check(!f.small.length && !f.sideways && !f.cut.length, `[tasks ${world} 390] the list, the chips and the change box fit: ${JSON.stringify(f)}`);
      const c = await page.evaluate(() => {
        const bg = getComputedStyle(document.body).backgroundColor;
        const col = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).color : ''; };
        return { bg, chip: col('#pg-agenda .tqchip.tq-due'), flag: col('#pg-agenda .todoit[data-id="tlook"] button.todostar') };
      });
      check(c.chip && c.flag && c.chip !== c.bg && c.flag !== c.bg, `[tasks ${world}] the chips and the flag are drawn in colours of the look: ${JSON.stringify(c)}`);
      if (world === 'ink' || world === 'glass') await page.screenshot({ path: `${H.out}/planlane4-tasks-${world}-390.png` });
    }
    await ctx.close();
  }
  log('tasks: the seven looks');
}
