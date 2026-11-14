// CALENDAR AND TASKS, the to-do side (planlane4:tasks): the one list (the brain's work:todo) at the level of the best to-do apps.
//  1. TIMED TO-DOS THAT RING (plan.u4): a to-do with a day and a time gets one reminder job in the brain (Web Push, so it rings with the
//     phone locked); a tick stops it, a new time moves it; the change box has a time; the row says it; the chat and the add field read
//     "call the bank at 3pm".
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

  // ---- 3. 390 × 844, BODY 21, and the seven looks: the list with a timed to-do and its change box open
  {
    const { ctx, page } = await phone(PHONE2, 'scan', {}, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    await row(page, 'Ring the dentist').waitFor({ timeout: 8000 }).catch(() => check(false, '[tasks 390] the one list did not reach this phone'));
    await row(page, 'Ring the dentist').locator('button.todotx').click().catch(() => undefined);
    for (const world of WORLDS) {
      const on = await page.evaluate(async (w) => { await window.__ghosty.run(`world_${w}`); return window.__ghosty.theme.recipe().world; }, world).catch(() => '');
      check(on === world, `[tasks ${world}] the look is on: ${on}`);
      await page.waitForSelector('#pg-agenda .todoedit input[aria-label="Change the time it rings"]', { timeout: 3000 }).catch(() => check(false, `[tasks ${world}] no time in the change box`));
      const f = await fit(page, '#pg-agenda .pn.todo');
      check(!f.small.length && !f.sideways && !f.cut.length, `[tasks ${world} 390] the list with a timed to-do and its change box fits: ${JSON.stringify(f)}`);
      if (world === 'ink') await page.screenshot({ path: `${H.out}/planlane4-tasks-ink-390.png` });
    }
    await ctx.close();
  }
  log('tasks: 390 and the seven looks');
}
