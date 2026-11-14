// ONE TO-DO LIST EVERYWHERE (planlane2:onelist, plan.u1): the brain's list is the one store; the Agenda's TO-DO is its copy on the phone.
//  - the pure parts: a repeat's next day, the phone's old list merged (no duplicates, nothing lost), a tick and its next, the waiting words;
//  - at 440 × 956, BODY 21: the phone's old list joins the brain's once, said in one line; the WORK wording's job shows on the Agenda;
//    the chat's wordings ("add … to my to-do list", "add to my to-do: …, …", "tick off …", "what's on my to-do list") all reach the
//    one list; WORK's to-do screen shows the same list; with no signal a tick is kept and said, and goes when the signal is back;
//  - at 390 × 844, BODY 21: a second phone with nothing of its own opens on the same one list;
//  - every key 44 pt, nothing sideways, no word cut; the seven looks with the waiting line showing.
import { openSection } from '../nav.mjs';

export async function run(H) {
  const { check, log, phone, open, fit, ask, PHONE, PHONE2, WORLDS, RAW } = H;
  const W = await H.pure('packages/shared/src/work.ts');
  const T = await H.pure('apps/web/src/features/agenda/todowords.ts');
  /** the one list in the preview brain, straight from it */
  const brain = async (args) => {
    const r = await fetch(`${H.base}/api/packs/do`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': H.KEY }, body: JSON.stringify({ pack: 'work', action: 'todo', args }) });
    return r.json();
  };
  const brainList = async () => (await brain({ op: 'list' })).data?.list ?? [];
  /** wait (polling the brain, never a fixed sleep) until the brain's list says `ok` */
  const brainUntil = async (ok, ms = 8000) => {
    const end = Date.now() + ms;
    let l = [];
    while (Date.now() < end) {
      l = await brainList();
      if (ok(l)) return l;
      await new Promise((r) => setTimeout(r, 150));
    }
    return l;
  };
  const texts = (l) => l.map((t) => `${t.text}${t.done ? ' ✓' : ''}`).join(', ');

  // ---- 1. the pure parts
  check(W.nextTodoDue('2026-11-13', 'weekdays', '2026-11-13') === '2026-11-16', `[onelist pure] a weekday one ticked on a Friday comes back on Monday: ${W.nextTodoDue('2026-11-13', 'weekdays', '2026-11-13')}`);
  check(W.nextTodoDue('2026-01-31', 'monthly', '2026-01-31') === '2026-02-28', '[onelist pure] a monthly one on the 31st comes back at the end of a short month');
  const m = W.mergeTodos([{ id: 'b1', text: 'Send the invoice', at: 1 }], [{ id: 'p1', text: 'send the INVOICE' }, { id: 'p2', text: 'Buy milk', star: true, every: 'daily' }, { id: 'b1', text: 'Send the invoice' }, { text: '' }], 5);
  check(m.added.length === 1 && m.list.length === 2 && m.list[1].high === true && m.list[1].every === 'daily', `[onelist pure] the phone's old list merged: no duplicates, its star and repeat kept: ${JSON.stringify(m.list)}`);
  const tk = W.tickTodoIn([{ id: 'r', text: 'Bins', due: '2026-11-13', every: 'weekly', at: 1 }], 'r', '2026-11-13', 9, true, 'rnext');
  check(tk.next?.id === 'rnext' && tk.next.due === '2026-11-20' && W.tickTodoIn(tk.list, 'r', '2026-11-13', 9, false).list.length === 1, '[onelist pure] a repeating one ticked makes its next (with the id the phone gave it); ticked back on, it goes again');
  check(T.todoWaitWords(1, true) === '1 change kept on this phone: it goes to your one list when the signal is back.' && /2 changes kept on this phone: they go to your one list when Ghosty’s brain answers again\./.test(T.todoWaitWords(2, false)), `[onelist pure] the waiting words: ${T.todoWaitWords(1, true)}`);
  log('onelist: pure');

  // ---- 2. 440 × 956, BODY 21: the phone's old list joins the brain's once; the WORK wording's job shows on the Agenda
  await brain({ words: 'clear my to-do list' });
  await brain({ words: 'add: send the invoice by Friday' });
  const today = H.today();
  const old = [
    { id: 'o1', text: 'Buy milk', due: today, done: false, at: 1, star: true },
    { id: 'o2', text: 'Send the invoice', due: '', done: false, at: 2 },
    { id: 'o3', text: 'Water the plants', due: today, done: false, at: 3, every: 'daily' },
  ];
  {
    const { ctx, page } = await phone(PHONE, 'scan', { 'ghosty.agenda.todo': JSON.stringify(old) }, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    const said = await page.waitForFunction(() => [...document.querySelectorAll('#toasts > *')].map((t) => t.textContent ?? '').find((t) => /One to-do list now/.test(t)) ?? null, null, { timeout: 10000 }).then((h) => h.jsonValue(), () => '');
    check(/^One to-do list now: 2 from this phone joined the one WORK and the chat use\./.test(said.trim()), `[onelist 440] the old list joining is said in one line: "${said}"`);
    let l = await brainUntil((x) => x.length === 3);
    check(l.length === 3 && l.filter((t) => /invoice/i.test(t.text)).length === 1 && l.find((t) => t.id === 'o1')?.high === true && l.find((t) => t.id === 'o3')?.every === 'daily', `[onelist 440] the brain's list: nothing lost, no duplicates, the star and the repeat kept: ${JSON.stringify(l)}`);
    await page.waitForFunction(() => [...document.querySelectorAll('#pg-agenda .todoit b')].some((b) => /^Send the invoice$/.test(b.textContent ?? '')) && document.querySelectorAll('#pg-agenda .todoit').length === 3, null, { timeout: 8000 }).catch(() => undefined);
    const shown = await page.$$eval('#pg-agenda .todoit b', (b) => b.map((x) => x.textContent));
    check(shown.length === 3 && shown.includes('Send the invoice') && shown.includes('Buy milk'), `[onelist 440] the Agenda shows the one list (WORK's job too): ${shown.join(', ')}`);
    // a second open says nothing again (once)
    check(await page.evaluate(() => localStorage.getItem('ghosty.agenda.todo.one')) === 'true', '[onelist 440] the joining is kept as done, so it happens once');

    // the chat's wordings all reach the one list
    let r = await ask(page, 'add buy bread to my to-do list', /Added to your to-do list: Buy bread/);
    check(r.ok && !RAW.test(r.text), `[onelist chat] "add buy bread to my to-do list" → ${r.text.slice(0, 120)}`);
    l = await brainUntil((x) => x.some((t) => t.text === 'Buy bread'));
    check(l.some((t) => t.text === 'Buy bread'), `[onelist chat] … and it is on the brain's list: ${texts(l)}`);
    // WORK's advertised wording ("add to my to-do: …") is the brain's work pack's (phrases.ts leaves it to the brain, which the
    // preview's scripted model does not call): sent as the model's tool call sends it, it lands on the one list
    const work1 = await brain({ words: 'add to my to-do: post the parcel by Friday' });
    check(/^Added 1 to your list:\n- Post the parcel \(/.test(work1.text ?? ''), `[onelist brain] "add to my to-do: post the parcel by Friday" → ${work1.text}`);
    // several jobs in one message are the brain's to split
    const split = await brain({ words: 'add: book the van and ring the landlord' });
    check(/^Added 2 to your list/.test(split.text ?? ''), `[onelist brain] several jobs in one go: ${split.text}`);
    r = await ask(page, 'tick off buy bread', /Ticked off: Buy bread/);
    check(r.ok, `[onelist chat] "tick off buy bread" → ${r.text.slice(0, 120)}`);
    l = await brainUntil((x) => x.find((t) => t.text === 'Buy bread')?.done === true);
    check(l.find((t) => t.text === 'Buy bread')?.done === true, `[onelist chat] … ticked on the brain's list: ${texts(l)}`);
    // the jobs the brain added show on the Agenda (the copy follows the one list as the agenda opens)
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    const both = await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('#pg-agenda .todoit b')].map((x) => x.textContent);
      return b.includes('Book the van') && b.includes('Ring the landlord');
    }, null, { timeout: 8000 }).then(() => true, () => false);
    check(both, `[onelist 440] the jobs added by the brain's wording show on the Agenda: ${(await page.$$eval('#pg-agenda .todoit b', (b) => b.map((x) => x.textContent))).join(', ')}`);
    r = await ask(page, "what's on my to-do list", /to do:/);
    check(r.ok && /Book the van/.test(r.text) && /Post the parcel/.test(r.text) && /Buy milk/.test(r.text), `[onelist chat] "what's on my to-do list" reads the one list: ${r.text.slice(0, 260)}`);

    // WORK's to-do screen: the same list
    await page.evaluate(() => (location.hash = 'work'));
    await page.waitForFunction(() => document.body.dataset.tab === 'work' && window.__ghosty?.sheetpages?.work?.ready, null, { timeout: 15000 }).catch(() => undefined);
    await page.locator('#pg-work .secpills .secpill', { hasText: /^To-do$/ }).first().click().catch(() => check(false, '[onelist 440] WORK has no To-do pill'));
    const wk = '#pg-work .pn:not([hidden]) .pk';
    await page.waitForFunction((s) => document.querySelectorAll(`${s} .pkitem`).length >= 7, wk, { timeout: 10000 }).catch(() => undefined);
    const work = await page.$$eval(`${wk} .pkitem`, (l) => l.map((x) => x.textContent.trim()));
    check(['Buy milk', 'Water the plants', 'Send the invoice', 'Post the parcel', 'Book the van', 'Ring the landlord'].every((w) => work.some((x) => x.startsWith(w))), `[onelist 440] WORK's to-do shows the one list (the Agenda's too): ${work.join(' | ')}`);
    // a tick on WORK's screen reaches the Agenda's copy
    await page.locator(`${wk} .pkitem label`, { hasText: /^Ring the landlord/ }).first().click();
    const followed = await page.waitForFunction(() => JSON.parse(localStorage.getItem('ghosty.agenda.todo') ?? '[]').find((t) => t.text === 'Ring the landlord')?.done === true, null, { timeout: 8000 }).then(() => true, () => false);
    check(followed, '[onelist 440] a tick on WORK\'s screen reaches the Agenda\'s copy');

    // no signal: a tick is kept on the phone and said, and goes when the signal is back
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    await ctx.setOffline(true);
    await page.click('#pg-agenda .todoit[data-id="o1"] .todotick');
    const wait = await page.waitForFunction(() => { const w = document.querySelector('#pg-agenda .todowait'); return w && !w.hidden ? w.textContent : null; }, null, { timeout: 5000 }).then((h) => h.jsonValue(), () => '');
    check(wait === '1 change kept on this phone: it goes to your one list when the signal is back.', `[onelist offline] the tick is kept and said: "${wait}"`);
    check(await page.$eval('#pg-agenda .todowait', (e) => e.dataset.state) === 'offline', '[onelist offline] the waiting line is marked offline');
    check((await brainList()).find((t) => t.id === 'o1')?.done !== true, '[onelist offline] nothing reached the brain with no signal');
    for (const vp of [PHONE]) {
      const f = await fit(page, '#pg-agenda');
      check(!f.small.length && !f.sideways && !f.cut.length, `[onelist ${vp.width}] the to-do list with the waiting line: keys ${f.small.join(', ') || 'ok'}; sideways ${f.sideways}; cut ${f.cut.join(', ') || 'none'}`);
    }
    await page.screenshot({ path: `${H.out}/onelist-offline-440.png` });
    await ctx.setOffline(false);
    l = await brainUntil((x) => x.find((t) => t.id === 'o1')?.done === true);
    check(l.find((t) => t.id === 'o1')?.done === true, `[onelist offline] back online, the tick reached the one list: ${texts(l)}`);
    const gone = await page.waitForFunction(() => document.querySelector('#pg-agenda .todowait')?.hidden === true, null, { timeout: 5000 }).then(() => true, () => false);
    check(gone, '[onelist offline] the waiting line goes once it is sent');
    await ctx.close();
  }
  log('onelist: 440, the chat, WORK, no signal');

  // ---- 3. 390 × 844, BODY 21: a second phone with nothing of its own opens on the same one list
  {
    const { ctx, page } = await phone(PHONE2, 'scan', {}, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    const ok = await page.waitForFunction(() => {
      const b = [...document.querySelectorAll('#pg-agenda .todoit b')].map((x) => x.textContent);
      return b.includes('Book the van') && b.includes('Buy milk') && b.includes('Send the invoice');
    }, null, { timeout: 10000 }).then(() => true, () => false);
    check(ok, `[onelist 390] a second phone opens on the same one list: ${(await page.$$eval('#pg-agenda .todoit b', (b) => b.map((x) => x.textContent))).join(', ')}`);
    const f = await fit(page, '#pg-agenda');
    check(!f.small.length && !f.sideways && !f.cut.length, `[onelist 390] keys ${f.small.join(', ') || 'ok'}; sideways ${f.sideways}; cut ${f.cut.join(', ') || 'none'}`);
    await ctx.close();
  }
  log('onelist: 390, a second phone');

  // ---- 4. the seven looks, the waiting line showing (no signal), 390 × 844
  for (const world of WORLDS) {
    const { ctx, page } = await phone(PHONE2, world, { 'ghosty.agenda.todo.one': 'true' }, 21);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'To-do');
    await page.waitForSelector('#pg-agenda .todoit', { timeout: 8000 }).catch(() => undefined);
    await ctx.setOffline(true);
    await page.fill('#pg-agenda .todoadd input[aria-label="To-do"]', `A to-do added with no signal in the ${world} look`);
    await page.keyboard.press('Enter');
    const shown = await page.waitForFunction(() => document.querySelector('#pg-agenda .todowait')?.hidden === false, null, { timeout: 5000 }).then(() => true, () => false);
    const f = await fit(page, '#pg-agenda');
    const box = await page.$eval('#pg-agenda .todowait', (e) => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e).color; return { w: r.width, h: r.height, c }; }).catch(() => null);
    check(shown && box && box.w > 100 && box.h > 10 && box.c !== 'rgba(0, 0, 0, 0)', `[onelist ${world}] the waiting line shows: ${JSON.stringify(box)}`);
    check(!f.small.length && !f.sideways && !f.cut.length, `[onelist ${world}] keys ${f.small.join(', ') || 'ok'}; sideways ${f.sideways}; cut ${f.cut.join(', ') || 'none'}`);
    await page.screenshot({ path: `${H.out}/onelist-${world}.png` });
    await ctx.setOffline(false);
    await brainUntil((x) => x.some((t) => t.text.includes(`in the ${world} look`)));
    await ctx.close();
  }
  await brain({ words: 'clear my to-do list' });
  log('onelist: seven looks');
}
