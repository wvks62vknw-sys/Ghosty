// THE CALENDAR (planlane4:calendar): drag to move on the timeline, EARLIER / LATER keys, the year, colour calendars to show or hide.
//  - COLOUR CALENDARS: the CALENDARS sheet lists his diary and the feed, a colour picked marks the feed's event, a hidden calendar leaves the
//    timeline, the diary and the month (said where it is left out) and is kept on the phone; shown again; no signal, only his diary, and a
//    change the phone could not keep, each said in his words;
//  - A WEEK TIMELINE: WEEK's seven days by the hour, today first, free time shaded, a drag two days on and an hour later read back, UNDO;
//  - ANY YEAR: YEAR's twelve months, a dot on a day with events, today marked, ‹ › without limit, THIS YEAR, a month opened, every state;
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
    // (one an earlier run left behind, if it stopped half-way, out first: this part's events are its own)
    for (const e of (await api(page, 'GET', '/agenda?days=6').catch(() => null))?.events ?? []) if (/^Spec cal /.test(e.title)) await api(page, 'DELETE', `/agenda/events/${e.id}`);
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
    // (a click on what is not there waits half a minute: only what is there is pressed)
    if (await page.$('#pg-agenda .evcard')) await page.click('#pg-agenda .evcard button:has-text("Close")', { timeout: 3000 }).catch(() => undefined);

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
      // (this page may send what waited as soon as the brain answers again: given a moment to, and to keep that it did, so the page opened
      // next never finds the same move still waiting and sends it twice)
      for (const until = Date.now() + 4000; Date.now() < until; await page.waitForTimeout(200)) if (!(await page.evaluate(() => (JSON.parse(localStorage.getItem('ghosty.offline') ?? '{}')?.outbox ?? []).length))) break;
      // (Ghosty opened again: what waited goes to the brain, the same event)
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
      const sent = await brainUntil(page, id, (e) => e.start === tm.s1 + 2 * 3600_000, 15000);
      check(!sent.timedOut && sent.e.end === tm.e1 + 2 * 3600_000, `${tag} offline: sent when Ghosty opened again, in place: ${JSON.stringify(sent)}`);
      // (the phone's queue empty first, so nothing it still holds lands after the spec puts the event back)
      for (const until = Date.now() + 10000; Date.now() < until; await page.waitForTimeout(200)) if (!(await page.evaluate(() => (JSON.parse(localStorage.getItem('ghosty.offline') ?? '{}')?.outbox ?? []).length))) break;
      const reset = await api(page, 'POST', `/agenda/events/${id}`, { start: tm.s1, end: tm.e1, tz: 'Europe/London' });
      check(reset?.event?.start === tm.s1, `${tag} put back for what follows: ${JSON.stringify(reset).slice(0, 160)}`);
      await open(page, 'agenda');
      await openSection(page, 'agenda', 'Diary');
      await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TOMORROW")');
      await evSel(title).waitFor({ timeout: 8000 }).catch(() => undefined);
    }

    // ---- COLOUR CALENDARS TO SHOW OR HIDE: the CALENDARS sheet, a colour picked, a calendar hidden from every view and shown again
    {
      if (!(await page.$('#pg-agenda .pn.timeline button.tlkey.on:has-text("TOMORROW")'))) await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TOMORROW")');
      await evSel('Spec match').waitFor({ timeout: 8000 }).catch(() => check(false, `${tag} the feed's event is not laid out before CALENDARS`));
      const key = page.locator('#pg-agenda .pn.timeline button.calkey');
      check((await key.textContent()) === 'CALENDARS', `${tag} the CALENDARS key: ${await key.textContent()}`);
      await key.click();
      await page.waitForSelector('.mbox .calsheet .calrow', { timeout: 5000 }).catch(() => check(false, `${tag} the CALENDARS sheet did not open`));
      const rows = await page.$$eval('.mbox .calsheet .calrow', (r) => r.map((x) => ({ cal: x.dataset.cal, name: x.querySelector('.calname')?.textContent, sub: x.querySelector('.calsub')?.textContent, on: x.querySelector('.caltoggle')?.textContent })));
      const mineRow = rows.find((r) => r.cal === 'mine');
      const feedRow = rows.find((r) => r.cal === FEED);
      check(rows[0]?.cal === 'mine' && mineRow?.name === 'Your diary' && /^(\d+ coming up|Nothing coming up) · you can move and change these$/.test(mineRow?.sub ?? '') && mineRow?.on === 'SHOWN', `${tag} his diary first, said: ${JSON.stringify(mineRow)}`);
      check(feedRow?.name === FEED && feedRow?.sub === '1 coming up · read only' && feedRow?.on === 'SHOWN', `${tag} the feed listed, read only: ${JSON.stringify(feedRow)}`);
      const fs = await fit(page, '.modal .calsheet');
      check(!fs.small.length && !fs.sideways && !fs.cut.length, `${tag} the CALENDARS sheet fits: ${JSON.stringify(fs)}`);
      await page.locator('.mbox').screenshot({ path: `${H.out}/planlane4-calendar-calendars-${W}.png` }).catch(() => undefined);
      // a colour picked for the feed: it marks its event on the timeline
      const red = `.mbox .calsheet .calrow[data-cal="${FEED}"] button.calswatch[aria-label^="Red"]`;
      await page.click(red);
      check((await page.getAttribute(red, 'aria-checked')) === 'true' && (await page.getAttribute(red, 'aria-label')) === 'Red, in use', `${tag} Red picked, said in use`);
      const cv = await evSel('Spec match').evaluate((b) => b.style.getPropertyValue('--c')).catch(() => '');
      const sh = await page.evaluate(() => [...document.querySelectorAll('#pg-agenda .pn.timeline .tlev')].map((b) => getComputedStyle(b).boxShadow));
      check(cv === 'var(--g-red)' && new Set(sh).size > 1, `${tag} the feed's event in its colour on the timeline: ${cv}`);
      // hidden: out of the timeline, the diary and the month, and said
      await page.click(`.mbox .calsheet .calrow[data-cal="${FEED}"] button.caltoggle`);
      const tg = await page.$eval(`.mbox .calsheet .calrow[data-cal="${FEED}"]`, (r) => ({ t: r.querySelector('.caltoggle').textContent, a: r.querySelector('.caltoggle').getAttribute('aria-checked'), sub: r.querySelector('.calsub').textContent }));
      check(tg.t === 'HIDDEN' && tg.a === 'false' && tg.sub === 'Hidden from the timeline, the month, the year and the diary.', `${tag} the switch says HIDDEN: ${JSON.stringify(tg)}`);
      await page.click('.mbox .mhead button');
      await page.waitForFunction(() => ![...document.querySelectorAll('#pg-agenda .pn.timeline .tlev .tltitle')].some((b) => b.textContent === 'Spec match'), null, { timeout: 4000 }).catch(() => check(false, `${tag} the hidden feed's event is still on the timeline`));
      const hid = await page.textContent('#pg-agenda .pn.timeline .agcalhid').catch(() => '');
      check(hid === `Hidden: ${FEED}. CALENDARS shows it again.`, `${tag} the timeline says what is hidden: ${hid}`);
      check((await key.textContent()) === 'CALENDARS · 1 HIDDEN', `${tag} the key says how many are hidden: ${await key.textContent()}`);
      check(!(await page.$$eval('#pg-agenda .rw.ev .evt', (e) => e.some((x) => x.textContent === 'Spec match'))) && (await page.$$eval('#pg-agenda .rw.ev .evt', (e, t) => e.some((x) => x.textContent === t), title)), `${tag} the diary leaves the hidden feed out, his own kept`);
      check((await page.textContent('#pg-agenda .pn.month .agcalhid').catch(() => '')) === `Hidden: ${FEED}. CALENDARS shows it again.`, `${tag} the month says it too`);
      const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.agenda.calendars') ?? '{}'));
      check(kept[FEED]?.hidden === true && kept[FEED]?.colour === 'red', `${tag} kept on this phone: ${JSON.stringify(kept)}`);
      const edge = await page.locator('#pg-agenda .rw.ev', { has: page.locator('.evt', { hasText: new RegExp(`^${title}$`) }) }).first().evaluate((r) => r.style.getPropertyValue('--agcal')).catch(() => '');
      check(edge === 'var(--g-accent)', `${tag} his diary's rows in his diary's colour: ${edge}`);
      // shown again, from the month's CALENDARS
      await page.click('#pg-agenda .pn.month button.calkey');
      await page.click(`.mbox .calsheet .calrow[data-cal="${FEED}"] button.caltoggle`);
      await page.click('.mbox .mhead button');
      await evSel('Spec match').waitFor({ timeout: 4000 }).catch(() => check(false, `${tag} shown again, the feed's event is not back`));
      check(!(await page.$('#pg-agenda .pn.timeline .agcalhid')) && (await key.textContent()) === 'CALENDARS', `${tag} shown again: nothing said hidden`);
      // the phone could not keep it (storage full or private): said
      if (vp === PHONE2) {
        await page.evaluate(() => {
          const o = Storage.prototype.setItem;
          window.__specSet = o;
          Storage.prototype.setItem = function (k, v) {
            if (k === 'ghosty.agenda.calendars') throw new Error('QuotaExceededError');
            return o.call(this, k, v);
          };
        });
        await key.click();
        await page.click(`.mbox .calsheet .calrow[data-cal="${FEED}"] button.calswatch[aria-label^="Amber"]`);
        const err = await page.waitForSelector('.mbox .calsheet .calsay[data-state="error"]', { timeout: 3000 }).then((e) => e.textContent(), () => '');
        check(err === 'This phone could not keep that (its storage is full or private), so it lasts until Ghosty is closed.', `${tag} a change the phone could not keep says so: ${err}`);
        await page.evaluate(() => (Storage.prototype.setItem = window.__specSet));
        await page.click(`.mbox .calsheet .calrow[data-cal="${FEED}"] button.calswatch[aria-label^="Red"]`);
        check(!(await page.$('.mbox .calsheet .calsay[data-state="error"]')), `${tag} kept again: the error goes`);
        await page.click('.mbox .mhead button');
      }
      // no signal: the sheet lists what the phone's copy has, and says so
      if (vp === PHONE) {
        await page.route(/\/api\/agenda(\?|$)/, (r) => r.abort('internetdisconnected'));
        await open(page, 'core');
        await open(page, 'agenda');
        await openSection(page, 'agenda', 'Diary');
        await page.waitForSelector('#pg-agenda .pn.timeline .tlcopy', { timeout: 10000 }).catch(() => check(false, `${tag} the timeline did not say it is the copy`));
        await key.click();
        const off = await page.waitForSelector('.mbox .calsheet .calsay[data-state="offline"]', { timeout: 4000 }).then((e) => e.textContent(), () => '');
        check(off === 'I can’t reach your brain, so this lists the calendars in the copy on this phone. Colours and switches still work: they live on this phone.', `${tag} no signal: said: ${off}`);
        check(!!(await page.$(`.mbox .calsheet .calrow[data-cal="${FEED}"]`)), `${tag} no signal: the feed still listed from the copy`);
        await page.click('.mbox .mhead button');
        await page.unroute(/\/api\/agenda(\?|$)/);
        // (the signal back: the diary read afresh, so what follows is drawn from the brain, not the copy)
        await open(page, 'core');
        await open(page, 'agenda');
        await openSection(page, 'agenda', 'Diary');
        await page.waitForFunction(() => !document.querySelector('#pg-agenda .pn.timeline .tlcopy'), null, { timeout: 10000 }).catch(() => check(false, `${tag} the diary did not come back from the brain`));
      }
      // only his own diary (no feed linked): said, with what to do
      if (vp === PHONE2) {
        await ctx.unroute(/\/api\/agenda\?/);
        await open(page, 'core');
        await open(page, 'agenda');
        await openSection(page, 'agenda', 'Diary');
        await page.waitForFunction(() => ![...document.querySelectorAll('#pg-agenda .pn.timeline .tlev .tltitle')].some((b) => b.textContent === 'Spec match'), null, { timeout: 8000 }).catch(() => undefined);
        await key.click();
        const none = await page.waitForSelector('.mbox .calsheet .calsay[data-state="empty"]', { timeout: 4000 }).then((e) => e.textContent(), () => '');
        check(none === 'Only your own diary so far. Link a calendar under Calendars (its secret iCal link) and it shows here with a colour of its own.', `${tag} only his diary: said: ${none}`);
        await page.click('.mbox .mhead button');
      }
    }

    // ---- A WEEK TIMELINE: the seven days side by side by the hour, today first, free time shaded; a drag across days and hours
    {
      await page.click('#pg-agenda .pn.timeline button.tlkey[aria-label="The week by the hour"]');
      await page.waitForSelector('#pg-agenda .pn.timeline .tlgrid.tlwk', { timeout: 4000 }).catch(() => check(false, `${tag} WEEK did not open the week by the hour`));
      const heads = await page.$$eval('#pg-agenda .pn.timeline .tlwkday', (d) => d.map((x) => ({ t: x.textContent, today: x.classList.contains('today') })));
      const names = await page.evaluate(() => Array.from({ length: 7 }, (_, i) => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + i); return `${d.toLocaleDateString('en-GB', { weekday: 'short' })}${d.getDate()}`; }));
      check(heads.length === 7 && heads[0].today && JSON.stringify(heads.map((x) => x.t)) === JSON.stringify(names), `${tag} seven days, today first: ${JSON.stringify(heads)}`);
      const wk = (t) => page.locator(`#pg-agenda .pn.timeline .tlwkev[data-day="1"][aria-label^="${t},"]`);
      // (at 390 the feed was taken away above, for the sheet's "only your diary")
      check((await wk(title).count()) === 1 && (await wk('Spec match').count()) === (vp === PHONE ? 1 : 0), `${tag} tomorrow's events in tomorrow's column`);
      const wl = await wk(title).getAttribute('aria-label');
      check(/^Spec cal \d+ gym, \w+day \d\d:\d\d–\d\d:\d\d\. Tap to see it whole or change it\. Hold and drag to move it to another time or day\.$/.test(wl ?? ''), `${tag} VoiceOver hears a week block: ${wl}`);
      check((await page.$$('#pg-agenda .pn.timeline .tlwk .tlband')).length >= 7, `${tag} the free time shaded in each day`);
      const fw = await fit(page, '#pg-agenda .pn.timeline');
      check(!fw.small.length && !fw.sideways && !fw.cut.length, `${tag} the week by the hour fits: ${JSON.stringify(fw)}`);
      await page.locator('#pg-agenda .pn.timeline').screenshot({ path: `${H.out}/planlane4-calendar-week-${W}.png` }).catch(() => undefined);
      if (vp === PHONE) {
        // held and dragged two days on and an hour later
        const g = await page.$eval('#pg-agenda .pn.timeline .tlgrid.tlwk', (x) => ({ h: x.getBoundingClientRect().height, span: Number(getComputedStyle(x).getPropertyValue('--tlhours')), w: x.getBoundingClientRect().width, gut: x.querySelector('.tlwkcol').offsetLeft }));
        const colPx = (g.w - g.gut) / 7;
        const hpx = g.h / g.span;
        await wk(title).evaluate((b) => b.scrollIntoView({ block: 'center' }));
        const bb = await wk(title).boundingBox();
        const c = { x: bb.x + bb.width / 2, y: bb.y + 16 };
        await page.mouse.move(c.x, c.y);
        await page.mouse.down();
        await page.waitForSelector('#pg-agenda .pn.timeline .agghost', { timeout: 3000 }).catch(() => check(false, `${tag} week: no ghost`));
        for (let i = 1; i <= 5; i++) await page.mouse.move(c.x + (colPx * 2 * i) / 5, c.y + (hpx * i) / 5);
        // (from where the brain has it now: the phone's queue above may have sent its move a second time, which changes nothing it would not)
        const was = (await brainUntil(page, id, () => true)).e;
        const target = await page.evaluate((s) => { const n = new Date(s); const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 2, n.getHours() + 1, n.getMinutes()); return { ms: d.getTime(), label: `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` }; }, was.start);
        const gl = await page.textContent('#pg-agenda .pn.timeline .agghost').catch(() => '');
        check(gl === target.label, `${tag} week: the ghost says the new day and time: ${gl}`);
        await page.mouse.up();
        const b = await brainUntil(page, id, (e) => e.start === target.ms);
        check(!b.timedOut && b.e.end === target.ms + (was.end - was.start) && b.job?.next === target.ms - 15 * 60_000, `${tag} week: moved two days on and an hour later, in place, its reminder too: ${JSON.stringify(b)}`);
        const moved = await page.waitForFunction((t) => [...document.querySelectorAll('#pg-agenda .pn.timeline .tlwkev[data-day="3"]')].some((x) => x.getAttribute('aria-label')?.startsWith(`${t},`)), title, { timeout: 8000 }).then(() => true, () => false);
        check(moved, `${tag} week: drawn in its new day`);
        await page.click('#pg-agenda .pn.timeline .undo button');
        const back = await brainUntil(page, id, (e) => e.start === was.start);
        check(!back.timedOut, `${tag} week: UNDO puts it back: ${JSON.stringify(back)}`);
      }
      await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TOMORROW")');
      await evSel(title).waitFor({ timeout: 8000 }).catch(() => undefined);
    }

    // ---- ANY YEAR: YEAR in the month, twelve small months, a dot on a day with events, today marked, ‹ › without limit, a month opens
    {
      const yrs = await page.evaluate(() => { const n = new Date(); const t = new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1); return { y: n.getFullYear(), ty: t.getFullYear(), tm: t.getMonth() + 1, td: t.getDate(), m: n.getMonth() + 1, d: n.getDate(), tname: t.toLocaleDateString('en-GB', { month: 'long' }) }; });
      if (await page.$('#pg-agenda .pn.month button.monhome')) await page.click('#pg-agenda .pn.month button.monhome', { timeout: 3000 }).catch(() => undefined);
      await page.click('#pg-agenda .pn.month button.monyear');
      await page.waitForFunction(() => document.querySelectorAll('#pg-agenda .pn.month .yrmon').length === 12, null, { timeout: 5000 }).catch(() => check(false, `${tag} YEAR did not open twelve months`));
      const yline = () => page.waitForFunction(() => { const s = document.querySelector('#pg-agenda .pn.month .yrsay'); return s && s.dataset.state !== 'loading' ? s.textContent : null; }, null, { timeout: 10000 }).then((x) => x.jsonValue(), () => null);
      const l0 = await yline();
      check(new RegExp(`^${yrs.y}: \\d+ days? with something on\\.$`).test(l0 ?? ''), `${tag} the year in a line: ${l0}`);
      check((await page.textContent('#pg-agenda .pn.month .yrnum')) === String(yrs.y), `${tag} this year shown`);
      const today = await page.$eval(`#pg-agenda .pn.month .yrmon[data-month="${yrs.m}"]`, (b) => [...b.querySelectorAll('.yrday.today')].map((x) => x.textContent).join()).catch(() => '');
      check(today === String(yrs.d), `${tag} today marked in this month: ${today}`);
      if (yrs.ty === yrs.y) {
        const dot = await page.$eval(`#pg-agenda .pn.month .yrmon[data-month="${yrs.tm}"]`, (b, d) => [...b.querySelectorAll('.yrday.has')].some((x) => x.textContent === d), String(yrs.td)).catch(() => false);
        check(dot, `${tag} a dot on tomorrow, the day with his event`);
      }
      const lab = await page.getAttribute(`#pg-agenda .pn.month .yrmon[data-month="${yrs.m}"]`, 'aria-label');
      check(new RegExp(`^\\w+ ${yrs.y}, this month: (\\d+ days? with something on|nothing on)\\. Tap to open it\\.$`).test(lab ?? ''), `${tag} VoiceOver hears each month: ${lab}`);
      const fy = await fit(page, '#pg-agenda .pn.month');
      check(!fy.small.length && !fy.sideways && !fy.cut.length, `${tag} the year fits: ${JSON.stringify(fy)}`);
      await page.locator('#pg-agenda .pn.month').screenshot({ path: `${H.out}/planlane4-calendar-year-${W}.png` }).catch(() => undefined);
      // ‹ › without limit, THIS YEAR home
      for (let i = 0; i < 2; i++) await page.click('#pg-agenda .pn.month .yrbar button[aria-label="Next year"]');
      check((await page.textContent('#pg-agenda .pn.month .yrnum')) === String(yrs.y + 2) && !!(await page.$('#pg-agenda .pn.month button.yrhome')), `${tag} › steps on, THIS YEAR offered`);
      const l3 = await yline();
      check(new RegExp(`^(${yrs.y + 2}: \\d+ days? with something on\\.|Nothing in your diary in ${yrs.y + 2}\\.)$`).test(l3 ?? ''), `${tag} a far year read and said: ${l3}`);
      for (let i = 0; i < 3; i++) await page.click('#pg-agenda .pn.month .yrbar button[aria-label="Last year"]');
      check((await page.textContent('#pg-agenda .pn.month .yrnum')) === String(yrs.y - 1), `${tag} ‹ steps back past this year`);
      await page.click('#pg-agenda .pn.month button.yrhome');
      check((await page.textContent('#pg-agenda .pn.month .yrnum')) === String(yrs.y) && !(await page.$('#pg-agenda .pn.month button.yrhome')), `${tag} THIS YEAR comes home`);
      // a year the brain can't give, and no signal: said, in his words
      if (vp === PHONE) {
        await page.route(/\/api\/agenda\?.*from=/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"paused"}' }));
        for (let i = 0; i < 4; i++) await page.click('#pg-agenda .pn.month .yrbar button[aria-label="Next year"]');
        const bad = await page.waitForSelector('#pg-agenda .pn.month .yrsay[data-state="error"]', { timeout: 10000 }).then((e) => e.textContent(), () => '');
        check(bad === 'I couldn’t read January, February, March, April, May, June, July, August, September, October, November, December from your brain. Step away and back to try again.', `${tag} a year the brain can't give says so: ${bad}`);
        await page.unroute(/\/api\/agenda\?.*from=/);
        await page.route(/\/api\/agenda\?.*from=/, (r) => r.abort('internetdisconnected'));
        await page.click('#pg-agenda .pn.month .yrbar button[aria-label="Next year"]');
        const off = await page.waitForSelector('#pg-agenda .pn.month .yrsay[data-state="offline"]', { timeout: 10000 }).then((e) => e.textContent(), () => '');
        check(off === 'I can’t reach your brain, so the months marked not read show only what your diary already has. Step away and back to try again.', `${tag} no signal: said: ${off}`);
        const notRead = await page.getAttribute('#pg-agenda .pn.month .yrmon[data-month="3"]', 'aria-label');
        check(/: not read\. Tap to open it\.$/.test(notRead ?? ''), `${tag} a month not read says so: ${notRead}`);
        await page.unroute(/\/api\/agenda\?.*from=/);
        await page.click('#pg-agenda .pn.month button.yrhome');
        await yline();
      }
      // a tap on a month opens it in MONTH
      await page.click(`#pg-agenda .pn.month .yrmon[data-month="${yrs.tm}"]`);
      const mn = await page.textContent('#pg-agenda .pn.month .monname').catch(() => '');
      check(mn === `${yrs.tname} ${yrs.ty}` || yrs.ty !== yrs.y, `${tag} a month tapped opens in MONTH: ${mn}`);
      if (await page.$('#pg-agenda .pn.month button.monhome')) await page.click('#pg-agenda .pn.month button.monhome', { timeout: 3000 }).catch(() => undefined);
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
        // (read from the block as drawn: a repaint between the wait and the read leaves a detached block, whose style reads empty, so it is
        // read again from the one on screen)
        let cc = { color: '', bg: '' };
        for (let i = 0; i < 20 && !cc.color; i++) {
          cc = await evSel(title).evaluate((b) => (b.isConnected ? { color: getComputedStyle(b.querySelector('.tltitle')).color, bg: getComputedStyle(b).backgroundColor } : { color: '', bg: '' })).catch(() => ({ color: '', bg: '' }));
          if (!cc.color) await page.waitForTimeout(100);
        }
        check(cc.color !== cc.bg, `${tag0} ${world}] his event's words stand off its block: ${JSON.stringify(cc)}`);
        if (world === 'ink' || world === 'glass') await page.locator('#pg-agenda .pn.timeline').screenshot({ path: `${H.out}/planlane4-calendar-${world}-390.png` }).catch(() => undefined);
        await page.click('#pg-agenda .pn.timeline button.tlkey[aria-label="The week by the hour"]');
        await page.waitForSelector('#pg-agenda .pn.timeline .tlgrid.tlwk', { timeout: 4000 }).catch(() => check(false, `${tag0} ${world}] no week by the hour`));
        const fw = await fit(page, '#pg-agenda .pn.timeline');
        check(!fw.small.length && !fw.sideways && !fw.cut.length, `${tag0} ${world}] the week by the hour fits: ${JSON.stringify(fw)}`);
        if (world === 'glass') await page.locator('#pg-agenda .pn.timeline').screenshot({ path: `${H.out}/planlane4-calendar-week-${world}-390.png` }).catch(() => undefined);
        await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TOMORROW")');
        // the year in each look (its months read already: kept for the visit)
        await page.click('#pg-agenda .pn.month button.monyear');
        await page.waitForFunction(() => document.querySelectorAll('#pg-agenda .pn.month .yrmon').length === 12, null, { timeout: 5000 }).catch(() => check(false, `${tag0} ${world}] no year`));
        const fy = await fit(page, '#pg-agenda .pn.month');
        check(!fy.small.length && !fy.sideways && !fy.cut.length, `${tag0} ${world}] the year fits: ${JSON.stringify(fy)}`);
        const ty = await page.$eval('#pg-agenda .pn.month .yrday.today', (d) => ({ color: getComputedStyle(d).color, bg: getComputedStyle(d).backgroundColor })).catch(() => null);
        check(ty && ty.color !== ty.bg, `${tag0} ${world}] today stands off its mark in the year: ${JSON.stringify(ty)}`);
        if (world === 'grown') await page.locator('#pg-agenda .pn.month').screenshot({ path: `${H.out}/planlane4-calendar-year-${world}-390.png` }).catch(() => undefined);
        await page.click('#pg-agenda .pn.month button.yrback');
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
