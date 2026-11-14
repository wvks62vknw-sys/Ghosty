// THE CALENDAR (planlane4:calendar): drag to move on the timeline, EARLIER / LATER keys, the year, colour calendars to show or hide.
//  - the pure sums: a drag's new start on the quarter hour, a day on by the calendar, the words of where it goes;
//  - at 440 × 956 and 390 × 844, BODY 21: one of his own events tomorrow (put in the shared preview brain and taken out at the end) and one
//    calendar feed's event (stood in on the agenda read by page.route: the preview brain has no feed);
//  - DRAG TO MOVE by real pointer events: a mouse held and dragged (the ghost says the new time), released: changed IN PLACE on the brain
//    (the same id, its length kept, its reminder moved with it), UNDO puts it back; a finger held and dragged (CDP touch events) moves it
//    while the page stays still; a quick swipe is a scroll, never a drag; a feed's event held says it is read only and never moves;
//  - the 44 pt way: EARLIER / LATER / A DAY LATER in the event's sheet, each read back from the brain, UNDO;
//  - with no signal (the brain's edit refused as a lost connection): the move waits on this phone, said, drawn where it was dropped, and
//    goes to the brain (the same id) when Ghosty next opens;
//  - every key 44 pt, nothing sideways, no word cut; the seven looks at BODY 21.
// (dates are made on the phone's own clock, in London: a run at any hour lays out the same tomorrow)
import { openSection } from '../nav.mjs';

const FEED = 'Spec Football';

export async function run(H) {
  const { check, log, phone, open, fit, PHONE, PHONE2, WORLDS, RAW } = H;
  const tag0 = '[calendar';

  // ---- 1. the pure sums
  const D = await H.pure('apps/web/src/features/agenda/drag.ts').catch((e) => (check(false, `${tag0} pure] drag.ts did not load: ${String(e).slice(0, 200)}`), null));
  if (D) {
    const t = (h, m = 0, d = 14) => new Date(2026, 10, d, h, m).getTime();
    check(D.snapQuarter(t(10, 7)) === t(10) && D.snapQuarter(t(10, 8)) === t(10, 15), `${tag0} pure] onto the quarter hour`);
    check(D.dragStart(t(10), 75, 60) === t(11, 15), `${tag0} pure] a drag of 1¼ hours: ${new Date(D.dragStart(t(10), 75, 60)).toTimeString()}`);
    check(D.dragStart(t(10), 4, 60) === t(10) && D.dragStart(t(10), 8, 60) === t(10, 15), `${tag0} pure] under half a step stays, over it moves a step`);
    check(D.dragStart(t(10), -900, 60, 0, t(8)) === t(8) && D.dragStart(t(21), 300, 60, 0, -Infinity, t(21, 45)) === t(21, 45), `${tag0} pure] kept inside the hours drawn`);
    check(D.dragStart(t(10), 0, 60, 2) === t(10, 0, 16), `${tag0} pure] two days on, the same clock time`);
    // the clocks go back on 25 Oct 2026 in London: a day on from 24 Oct 10:00 is 25 Oct 10:00 (25 hours later), not 09:00
    check(D.shiftDays(new Date(2026, 9, 24, 10).getTime(), 1) === new Date(2026, 9, 25, 10).getTime(), `${tag0} pure] a day on across the clock change keeps the clock time`);
    check(D.whenWords(t(14, 15), t(15, 15), t(9)) === 'Today 14:15–15:15' && D.whenWords(t(9, 0, 15), undefined, t(9)) === 'Tomorrow 09:00' && /^\w{3} \d+ \w{3} 10:00$/.test(D.whenWords(t(10, 0, 20), undefined, t(9))), `${tag0} pure] where it goes, in words: ${D.whenWords(t(10, 0, 20), undefined, t(9))}`);
    check(D.movable({ source: 'mine', id: 'a' }) && D.movable({ source: 'this device (not saved yet)', id: 'local-x' }) && !D.movable({ source: FEED, id: 'f' }), `${tag0} pure] only his own move`);
  }

  // ---- 2. on the screen
  const api = (page, method, path, body) => page.evaluate(async ({ method, path, body, key }) => {
    const r = await fetch(`/api${path}`, { method, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': key }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  }, { method, path, body, key: H.KEY });
  // the brain read until `ok(event)` holds for the event `id` (polled from here: the real condition, never a fixed sleep)
  const brainUntil = async (page, id, ok, ms = 10000) => {
    let last = null;
    for (const until = Date.now() + ms; Date.now() < until; await page.waitForTimeout(200)) {
      const a = await api(page, 'GET', '/agenda?days=4').catch(() => null);
      const e = a?.events?.find((x) => x.id === id) ?? null;
      last = { e, job: a?.jobs?.find((j) => j.eventId === id) ?? null };
      if (e && ok(e, last.job)) return last;
    }
    return { ...last, timedOut: true };
  };

  const made = [];
  for (const vp of [PHONE, PHONE2]) {
    const W = vp.width;
    const tag = `${tag0} ${W}]`;
    const { ctx, page } = await phone(vp, 'scan', {}, 21);
    const tm = await page.evaluate(() => {
      const n = new Date();
      const at = (h, m = 0, d = 1) => new Date(n.getFullYear(), n.getMonth(), n.getDate() + d, h, m).getTime();
      return { s1: at(10), e1: at(11), f1: at(13), fe1: at(14), day2: at(10, 0, 2) };
    });
    const title = `Spec cal ${W} gym`;
    const r1 = await api(page, 'POST', '/agenda/events', { title, start: tm.s1, end: tm.e1, remindMin: 15, tz: 'Europe/London' });
    const id = r1?.event?.id;
    check(!!id, `${tag} his event went in: ${JSON.stringify(r1).slice(0, 160)}`);
    if (id) made.push(id);
    // a calendar feed's event, stood in on the agenda read (the preview brain has no feed of its own)
    await ctx.route(/\/api\/agenda\?/, async (route) => {
      const res = await route.fetch();
      const j = await res.json();
      const u = new URL(route.request().url());
      const from = Number(u.searchParams.get('from') ?? 0) || new Date(new Date().setHours(0, 0, 0, 0)).getTime();
      const to = from + Number(u.searchParams.get('days') ?? 14) * 86400_000;
      if (tm.f1 >= from && tm.f1 < to) j.events = [...(j.events ?? []), { id: 'spec-feed-1', title: 'Spec match', start: tm.f1, end: tm.fe1, source: FEED }].sort((a, b) => a.start - b.start);
      if (j.feeds) j.feeds = [...j.feeds, { id: 'spec-feed', name: FEED }];
      await route.fulfill({ response: res, json: j });
    });
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'Diary');
    await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TOMORROW")');
    const evSel = (t) => page.locator('#pg-agenda .pn.timeline .tlev', { has: page.locator('.tltitle', { hasText: new RegExp(`^${t}$`) }) });
    await evSel(title).waitFor({ timeout: 8000 }).catch(() => check(false, `${tag} tomorrow is not laid out with his event`));
    await evSel('Spec match').waitFor({ timeout: 8000 }).catch(() => check(false, `${tag} the feed's event is not laid out`));
    const hint = await page.textContent('#pg-agenda .pn.timeline .tlhint').catch(() => '');
    check(hint === 'Hold one of your events and drag it to a new time. Calendar feeds are read only.', `${tag} how to move one is said: ${hint}`);
    const label = await evSel(title).getAttribute('aria-label');
    check(/Hold and drag to move it\.$/.test(label ?? '') && /From Spec Football, read only\.$/.test((await evSel('Spec match').getAttribute('aria-label')) ?? ''), `${tag} VoiceOver hears which move: ${label}`);
    const grid = await page.$eval('#pg-agenda .pn.timeline .tlgrid', (g) => ({ h: g.getBoundingClientRect().height, span: Number(getComputedStyle(g).getPropertyValue('--tlhours')) }));
    const hourPx = grid.h / grid.span;
    const scroller = () => page.evaluate(() => {
      const el = document.querySelector('#pg-agenda .pn.timeline .tlgrid');
      for (let p = el?.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p).overflowY;
        if ((s === 'auto' || s === 'scroll') && p.scrollHeight > p.clientHeight) return p.scrollTop;
      }
      return document.scrollingElement?.scrollTop ?? 0;
    });
    // (the event brought into the middle of the screen first, so a drag never reaches the edge's slow scroll)
    const centre = async (t) => {
      await evSel(t).evaluate((b) => b.scrollIntoView({ block: 'center' }));
      const b = await evSel(t).boundingBox();
      return { x: b.x + Math.min(b.width / 2, 60), y: b.y + 18 };
    };

    // ---- DRAG TO MOVE with a mouse: held, the ghost says the new time, released: changed in place
    if (vp === PHONE) {
      let c = await centre(title);
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      const ghost = await page.waitForSelector('#pg-agenda .pn.timeline .agghost', { timeout: 3000 }).catch(() => null);
      check(!!ghost, `${tag} a hold shows the ghost`);
      for (let i = 1; i <= 5; i++) await page.mouse.move(c.x, c.y + (hourPx * 1.25 * i) / 5);
      const gl = await page.textContent('#pg-agenda .pn.timeline .agghost').catch(() => '');
      check(gl === minus(tm.s1 + 75 * 60_000, tm.e1 + 75 * 60_000), `${tag} the ghost says where it goes in 15-minute steps: ${gl}`);
      const f0 = await fit(page, '#pg-agenda .pn.timeline');
      check(!f0.small.length && !f0.sideways && !f0.cut.length, `${tag} the timeline mid-drag fits: ${JSON.stringify(f0)}`);
      await page.locator('#pg-agenda .pn.timeline').screenshot({ path: `${H.out}/planlane4-calendar-drag-${W}.png` }).catch(() => undefined);
      await page.mouse.up();
      let b = await brainUntil(page, id, (e) => e.start === tm.s1 + 75 * 60_000);
      check(!b.timedOut && b.e.end === tm.e1 + 75 * 60_000 && b.job?.next === tm.s1 + 60 * 60_000, `${tag} dropped: changed in place, its length kept, its reminder moved: ${JSON.stringify(b)}`);
      check(!(await page.$('#pg-agenda .evcard .evcardt')), `${tag} the release did not also open the event`);
      const ub = await page.textContent('#pg-agenda .pn.timeline .undo span').catch(() => '');
      check(ub === `Moved: ${title} to Tomorrow ${minus(tm.s1 + 75 * 60_000, tm.e1 + 75 * 60_000)}`, `${tag} the move said with UNDO: ${ub}`);
      await page.click('#pg-agenda .pn.timeline .undo button');
      b = await brainUntil(page, id, (e) => e.start === tm.s1);
      check(!b.timedOut && b.e.end === tm.e1 && b.job?.next === tm.s1 - 15 * 60_000, `${tag} UNDO: back where it was, its reminder too: ${JSON.stringify(b)}`);
      await page.waitForFunction(({ t, s }) => [...document.querySelectorAll('#pg-agenda .pn.timeline .tlev')].some((x) => x.querySelector('.tltitle')?.textContent === t && x.querySelector('.tlwhen')?.textContent?.startsWith(s)), { t: title, s: hmOf(tm.s1) }, { timeout: 8000 }).catch(() => check(false, `${tag} the timeline did not draw it back`));

      // ---- a finger: held still, then dragged; the page stays where it is under the finger
      const cdp = await ctx.newCDPSession(page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      c = await centre(title);
      const top0 = await scroller();
      await touch('touchStart', c.x, c.y);
      const tg = await page.waitForSelector('#pg-agenda .pn.timeline .agghost', { timeout: 3000 }).catch(() => null);
      check(!!tg, `${tag} a finger held shows the ghost`);
      for (let i = 1; i <= 6; i++) await touch('touchMove', c.x, c.y - (hourPx * 1.5 * i) / 6);
      const top1 = await scroller();
      await touch('touchEnd');
      check(Math.abs(top1 - top0) < 2, `${tag} the page does not scroll while a finger drags: ${top0} → ${top1}`);
      b = await brainUntil(page, id, (e) => e.start === tm.s1 - 90 * 60_000);
      check(!b.timedOut && b.e.end === tm.e1 - 90 * 60_000, `${tag} a finger's drag moved it 1½ hours earlier: ${JSON.stringify(b)}`);
      await page.click('#pg-agenda .pn.timeline .undo button').catch(() => check(false, `${tag} no UNDO after the finger's drag`));
      b = await brainUntil(page, id, (e) => e.start === tm.s1);
      check(!b.timedOut, `${tag} UNDO after the finger's drag: ${JSON.stringify(b)}`);
      await page.waitForFunction(({ t, s }) => [...document.querySelectorAll('#pg-agenda .pn.timeline .tlev')].some((x) => x.querySelector('.tltitle')?.textContent === t && x.querySelector('.tlwhen')?.textContent?.startsWith(s)), { t: title, s: hmOf(tm.s1) }, { timeout: 8000 }).catch(() => undefined);
      // a quick swipe that starts on the event is a scroll, never a drag
      c = await centre(title);
      await touch('touchStart', c.x, c.y);
      for (let i = 1; i <= 6; i++) await touch('touchMove', c.x, c.y - 20 * i);
      const swGhost = await page.$('#pg-agenda .pn.timeline .agghost');
      await touch('touchEnd');
      check(!swGhost, `${tag} a swipe across an event shows no ghost`);
      b = await brainUntil(page, id, () => true);
      check(b.e?.start === tm.s1, `${tag} a swipe never moves it: ${JSON.stringify(b.e)}`);
      await cdp.detach().catch(() => undefined);
    }

    // ---- a calendar feed's event is read only: a hold says so, and it never moves
    {
      const c = await centre('Spec match');
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      const said = await page.waitForSelector('#pg-agenda .pn.timeline .tlmovesay', { timeout: 3000 }).then((e) => e.textContent(), () => '');
      const g = await page.$('#pg-agenda .pn.timeline .agghost');
      await page.mouse.move(c.x, c.y + hourPx);
      await page.mouse.up();
      check(said === `Spec match is from your calendar “${FEED}”, which Ghosty only reads, so it can’t be moved here. Change it in that calendar.` && !g, `${tag} a feed's event held says it is read only: ${said}`);
      check(!(await page.$('#pg-agenda .evcard')), `${tag} the refused hold did not open it either`);
    }

    // ---- the 44 pt way: EARLIER / LATER / A DAY LATER in the event's sheet
    await evSel(title).click();
    await page.waitForFunction((t) => document.querySelector('#pg-agenda .evcard .evcardt')?.textContent === t, title, { timeout: 5000 }).catch(() => check(false, `${tag} a tap did not open the event's sheet`));
    const keys = await page.$$eval('#pg-agenda .evcard .agmove button', (bs) => bs.map((b) => b.textContent));
    check(JSON.stringify(keys) === JSON.stringify(['EARLIER', 'LATER', 'A DAY LATER']), `${tag} the move keys: ${JSON.stringify(keys)}`);
    const fk = await fit(page, '#pg-agenda .evcard');
    check(!fk.small.length && !fk.sideways && !fk.cut.length, `${tag} the sheet with the move keys fits: ${JSON.stringify(fk)}`);
    if (vp === PHONE) await page.locator('#pg-agenda .evcard').screenshot({ path: `${H.out}/planlane4-calendar-keys-${W}.png` }).catch(() => undefined);
    await page.click('#pg-agenda .evcard .agmove button:text-is("LATER")');
    let k = await brainUntil(page, id, (e) => e.start === tm.s1 + 15 * 60_000);
    check(!k.timedOut && k.e.end === tm.e1 + 15 * 60_000 && k.job?.next === tm.s1, `${tag} LATER: 15 minutes on, in place, its reminder too: ${JSON.stringify(k)}`);
    // (the sheet stays open on the moved event, so the keys can be pressed again)
    await page.waitForFunction((s) => /, \d\d:\d\d/.test(document.querySelector('#pg-agenda .evcard span')?.textContent ?? '') && document.querySelector('#pg-agenda .evcard span').textContent.includes(s), hmOf(tm.s1 + 15 * 60_000), { timeout: 8000 }).catch(() => check(false, `${tag} the sheet did not follow the move`));
    if (vp === PHONE) {
      await page.click('#pg-agenda .evcard .agmove button:text-is("A DAY LATER")');
      k = await brainUntil(page, id, (e) => e.start === tm.day2 + 15 * 60_000);
      check(!k.timedOut, `${tag} A DAY LATER: the same time the next day: ${JSON.stringify(k)}`);
      const said = await page.textContent('#pg-agenda .pn:has(input[aria-label="Event title"]) .undo span').catch(() => '');
      check(new RegExp(`^Moved: ${title} to \\w{3} \\d+ \\w{3} 10:15–11:15$`).test(said ?? ''), `${tag} the move said on the diary's UNDO bar: ${said}`);
      await page.click('#pg-agenda .pn:has(input[aria-label="Event title"]) .undo button');
      k = await brainUntil(page, id, (e) => e.start === tm.s1 + 15 * 60_000);
      check(!k.timedOut, `${tag} UNDO after A DAY LATER: ${JSON.stringify(k)}`);
      await page.waitForFunction((s) => document.querySelector('#pg-agenda .evcard span')?.textContent?.includes(s) && /^Tomorrow|\w+day/.test(document.querySelector('#pg-agenda .evcard span').textContent), hmOf(tm.s1 + 15 * 60_000), { timeout: 8000 }).catch(() => undefined);
    }
    await page.click('#pg-agenda .evcard .agmove button:text-is("EARLIER")').catch(() => check(false, `${tag} no EARLIER`));
    k = await brainUntil(page, id, (e) => e.start === tm.s1);
    check(!k.timedOut && k.job?.next === tm.s1 - 15 * 60_000, `${tag} EARLIER: back 15 minutes: ${JSON.stringify(k)}`);
    await page.click('#pg-agenda .evcard button:has-text("Close")').catch(() => undefined);

    // ---- with no signal: the move waits on this phone, said, drawn where it was dropped, and goes when Ghosty next opens
    if (vp === PHONE) {
      const down = (r) => (r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.continue());
      await page.route(/\/api\/agenda\/events\/[^/?]+$/, down);
      await page.waitForFunction(({ t, s }) => [...document.querySelectorAll('#pg-agenda .pn.timeline .tlev')].some((x) => x.querySelector('.tltitle')?.textContent === t && x.querySelector('.tlwhen')?.textContent?.startsWith(s)), { t: title, s: hmOf(tm.s1) }, { timeout: 8000 }).catch(() => undefined);
      const c = await centre(title);
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      await page.waitForSelector('#pg-agenda .pn.timeline .agghost', { timeout: 3000 }).catch(() => check(false, `${tag} offline: no ghost`));
      for (let i = 1; i <= 4; i++) await page.mouse.move(c.x, c.y + (hourPx * 2 * i) / 4);
      await page.mouse.up();
      const said = await page.waitForFunction(() => document.querySelector('#pg-agenda .pn.timeline .undo:not([hidden]) span')?.textContent ?? null, null, { timeout: 8000 }).then((h) => h.jsonValue(), () => '');
      check(said === `Moved on this phone: ${title} to Tomorrow ${minus(tm.s1 + 2 * 3600_000, tm.e1 + 2 * 3600_000)}. It goes to your brain when it’s back.`, `${tag} offline: the move is said to wait: ${said}`);
      // (the phone keeps its queue a moment after the change: read until it is there)
      let box = [];
      for (const until = Date.now() + 4000; Date.now() < until && !box.some((o) => o.kind === 'editEvent'); await page.waitForTimeout(150)) box = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.offline') ?? '{}')?.outbox ?? []);
      check(box.some((o) => o.kind === 'editEvent' && o.eventId === id && o.patch?.start === tm.s1 + 2 * 3600_000), `${tag} offline: kept on this phone by its id: ${JSON.stringify(box).slice(0, 200)}`);
      const drawn = await page.waitForFunction(({ t, s }) => [...document.querySelectorAll('#pg-agenda .pn.timeline .tlev')].some((x) => x.querySelector('.tltitle')?.textContent === t && x.querySelector('.tlwhen')?.textContent?.startsWith(s)), { t: title, s: hmOf(tm.s1 + 2 * 3600_000) }, { timeout: 8000 }).then(() => true, () => false);
      check(drawn, `${tag} offline: drawn where it was dropped`);
      await page.unroute(/\/api\/agenda\/events\/[^/?]+$/, down);
      // (Ghosty opened again: what waited goes to the brain, the same event)
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
      const sent = await brainUntil(page, id, (e) => e.start === tm.s1 + 2 * 3600_000, 15000);
      check(!sent.timedOut && sent.e.end === tm.e1 + 2 * 3600_000, `${tag} offline: sent when Ghosty opened again, in place: ${JSON.stringify(sent)}`);
      await api(page, 'POST', `/agenda/events/${id}`, { start: tm.s1, end: tm.e1, tz: 'Europe/London' });
      await open(page, 'agenda');
      await openSection(page, 'agenda', 'Diary');
      await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TOMORROW")');
      await evSel(title).waitFor({ timeout: 8000 }).catch(() => undefined);
    }

    // ---- the seven looks (390, BODY 21): his event and the feed's laid out, the hint, the move keys
    if (vp === PHONE2) {
      for (const world of WORLDS) {
        const on = await page.evaluate(async (w) => { await window.__ghosty.run(`world_${w}`); return window.__ghosty.theme.recipe().world; }, world).catch(() => '');
        check(on === world, `${tag0} ${world}] the look is on: ${on}`);
        await open(page, 'agenda');
        await openSection(page, 'agenda', 'Diary');
        await evSel(title).waitFor({ timeout: 8000 }).catch(() => check(false, `${tag0} ${world}] the day is not laid out`));
        const f = await fit(page, '#pg-agenda .pn.timeline');
        check(!f.small.length && !f.sideways && !f.cut.length, `${tag0} ${world}] the timeline fits: ${JSON.stringify(f)}`);
        const cc = await evSel(title).evaluate((b) => ({ color: getComputedStyle(b.querySelector('.tltitle')).color, bg: getComputedStyle(b).backgroundColor }));
        check(cc.color !== cc.bg, `${tag0} ${world}] his event's words stand off its block: ${JSON.stringify(cc)}`);
        if (world === 'ink' || world === 'glass') await page.locator('#pg-agenda .pn.timeline').screenshot({ path: `${H.out}/planlane4-calendar-${world}-390.png` }).catch(() => undefined);
      }
    }
    const raw = await page.textContent('#pg-agenda').catch(() => '');
    check(!RAW.test(raw ?? ''), `${tag} no raw words on the agenda: ${(raw ?? '').match(RAW)?.[0]}`);
    await ctx.close();
  }
  // (every event this part made, out again)
  {
    const { ctx, page } = await phone(PHONE2, 'scan', {}, 0);
    for (const id of made) await api(page, 'DELETE', `/agenda/events/${id}`).catch(() => undefined);
    const left = await api(page, 'GET', '/agenda?days=4').catch(() => null);
    for (const e of left?.events ?? []) if (/^Spec cal /.test(e.title)) await api(page, 'DELETE', `/agenda/events/${e.id}`);
    await ctx.close();
  }
  log('calendar');
}

/** "10:15" on the runner's clock, which the spec pins to London as the phone's is (the harness's UK context). */
function hmOf(ms) {
  return new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
}
function minus(a, b) {
  return `${hmOf(a)}–${hmOf(b)}`;
}
