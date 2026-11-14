// THE TIMELINE (planlane2:timeline): the day by the hour, PLAN MY WEEK, the month on any month, and an event changed in place.
//  - the pure sums: free gaps (inside 08:00–22:00, from now on today, half an hour at least), side by side for overlaps, the week's line;
//  - at 440 × 956 and 390 × 844, BODY 21: tomorrow laid out (four events of the spec's own put in the shared preview brain and taken out at
//    the end: two at once side by side, one all day at the top), the free gaps said in exact words, a to-do due that day beside it, the
//    line at now when today is in the waking day; PLAN MY WEEK's seven days and its line; a tap on an event opens it whole in the diary;
//  - an event changed IN PLACE (the same id on the brain, its reminder moved), ALL DAY and the reminder picked, UNDO back as it was;
//  - the month stepped back and on past next month, each read for itself, THIS MONTH home, and said so when its read fails;
//  - every key 44 pt, nothing sideways, no word cut; the seven looks at BODY 21 with the day laid out.
// (dates are made on the phone's own clock, in London: a run at any hour, 00:00 to 01:00 too, lays out the same tomorrow)
import { openSection } from '../nav.mjs';

export async function run(H) {
  const { check, log, phone, open, fit, PHONE, PHONE2, WORLDS, RAW } = H;

  // ---- 1. the pure sums (a Friday, 13 Nov 2026, 09:00 London; the spec's clock runs on the phone's own zone in the page below)
  const T = await H.pure('apps/web/src/features/agenda/timeline.ts').catch((e) => (check(false, `[timeline] the pure part did not load: ${String(e).slice(0, 200)}`), null));
  if (T) {
    const day = new Date(2026, 10, 14).getTime();
    const hr = (h, m = 0) => new Date(2026, 10, 14, h, m).getTime();
    const evs = [{ start: hr(10), end: hr(11) }, { start: hr(10, 30), end: hr(12) }, { start: hr(14), end: hr(15) }, { start: hr(7), end: hr(8, 15) }, { start: hr(0), allDay: true }];
    const gaps = T.freeGaps(evs, day, 0).map((g) => T.gapWords(g, day));
    check(JSON.stringify(gaps) === JSON.stringify(['Free 08:15–10:00 (1 h 45 min)', 'Free 12:00–14:00 (2 h)', 'Free 15:00–22:00 (7 h)']), `[timeline pure] the free gaps: ${JSON.stringify(gaps)}`);
    check(T.gapWords(T.freeGaps([], day, 0)[0], day) === 'Free all day (08:00–22:00)', '[timeline pure] an empty day is free all day');
    check(JSON.stringify(T.freeGaps(evs, day, hr(14, 40)).map((g) => T.gapWords(g, day))) === JSON.stringify(['Free 15:00–22:00 (7 h)']), '[timeline pure] today counts from now on');
    check(T.freeGaps([{ start: hr(10), end: hr(10, 20) }, { start: hr(10, 40), end: hr(21, 45) }], day, 0).length === 1, '[timeline pure] a gap under half an hour is not said');
    const cols = T.columns(evs.filter((e) => !e.allDay)).map((c) => `${new Date(c.e.start).getHours()}:${c.col}/${c.cols}`);
    check(JSON.stringify(cols) === JSON.stringify(['7:0/1', '10:0/2', '10:1/2', '14:0/1']), `[timeline pure] two at once side by side, the rest whole: ${JSON.stringify(cols)}`);
    const w = T.weekPlan([{ id: 'a', title: 'A', start: hr(10), end: hr(11), source: 'mine' }], [{ text: 'Post it', due: '2026-11-15', done: false }], new Date(2026, 10, 13).getTime(), new Date(2026, 10, 13, 9).getTime());
    check(/^1 event and 1 to-do in the next seven days; \d+ h free in the daytime\. Freest: /.test(w.line) && w.days.length === 7, `[timeline pure] the week said: ${w.line}`);

    // an event running across three days (Sat 09:00 to Mon 17:00) and a holiday over the same days: the middle day is busy, not free
    const trip = { id: 't', title: 'Trip', start: hr(9), end: new Date(2026, 10, 16, 17).getTime(), source: 'mine' };
    const hol = { id: 'h', title: 'Holiday', start: day, end: new Date(2026, 10, 17).getTime(), allDay: true, source: 'mine' };
    const sun = new Date(2026, 10, 15).getTime();
    check(T.onDay(trip, sun) && T.onDay(hol, sun) && T.onDay(hol, new Date(2026, 10, 16).getTime()) && !T.onDay(hol, new Date(2026, 10, 17).getTime()), '[timeline pure] an event that began on an earlier day is on the days it runs through');
    const wk = T.weekPlan([trip, hol], [], day, day);
    check(wk.days[1].events.length === 2 && wk.days[1].free === 0 && wk.days[2].events.length === 2, `[timeline pure] the week counts the trip on Sunday and Monday: ${JSON.stringify(wk.days.map((d) => [d.events.length, d.free]))}`);
    // two half-hour events back to back sit side by side (a box is drawn at least an hour long), never one over the other's words
    const bb = T.columns([{ start: hr(10), end: hr(10, 30) }, { start: hr(10, 30), end: hr(11) }]).map((c) => `${c.col}/${c.cols}`);
    check(JSON.stringify(bb) === JSON.stringify(['0/2', '1/2']), `[timeline pure] back-to-back short events side by side: ${JSON.stringify(bb)}`);
  }

  // ---- 2. on the screen, both sizes, BODY 21
  const api = (page, method, path, body) => page.evaluate(async ({ method, path, body, key }) => {
    const r = await fetch(`/api${path}`, { method, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': key }, body: body ? JSON.stringify(body) : undefined });
    return r.json();
  }, { method, path, body, key: H.KEY });
  for (const vp of [PHONE, PHONE2]) {
    const W = vp.width;
    // tomorrow, on the phone's clock: a to-do due then, kept in his list
    const { ctx, page } = await phone(vp, 'scan', {}, 21);
    const tm = await page.evaluate(() => {
      const n = new Date();
      const at = (h, m = 0) => new Date(n.getFullYear(), n.getMonth(), n.getDate() + 1, h, m).getTime();
      const d = new Date(at(0));
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { s1: at(10), e1: at(11), s2: at(10, 30), e2: at(12), s3: at(14), e3: at(15), ad: at(0), key, hour: n.getHours() };
    });
    // the to-do goes into the ONE list (the brain's), the way any screen adds one: the phone's copy follows it on the next open
    await api(page, 'POST', '/packs/do', { pack: 'work', action: 'todo', args: { op: 'remove', id: 'tl1' } });
    const put = await api(page, 'POST', '/packs/do', { pack: 'work', action: 'todo', args: { op: 'add', item: { id: 'tl1', text: 'Spec timeline parcel', due: tm.key, done: false, at: 1 } } });
    check(/Spec timeline parcel/.test(JSON.stringify(put ?? '')), `[timeline ${W}] the to-do went into the one list: ${JSON.stringify(put).slice(0, 160)}`);
    const tag = `Spec ${W}`;
    const made = [];
    for (const [title, start, end, allDay] of [[`${tag} standup`, tm.s1, tm.e1], [`${tag} dentist`, tm.s2, tm.e2], [`${tag} gym`, tm.s3, tm.e3], [`${tag} holiday`, tm.ad, undefined, true]]) {
      const r = await api(page, 'POST', '/agenda/events', { title, start, end, allDay, remindMin: 15, tz: 'Europe/London' });
      if (r?.event?.id) made.push(r.event.id);
    }
    check(made.length === 4, `[timeline ${W}] the spec's four events went in: ${made.length}`);
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'Diary');
    await page.waitForSelector('#pg-agenda .pn.timeline .tlbar', { timeout: 8000 }).catch(() => check(false, `[timeline ${W}] no TIMELINE in the Diary`));
    await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TOMORROW")');
    await page.waitForFunction((t) => [...document.querySelectorAll('#pg-agenda .pn.timeline .tlev .tltitle')].some((b) => b.textContent === `${t} gym`), tag, { timeout: 8000 }).catch(() => check(false, `[timeline ${W}] tomorrow is not laid out`));
    const gaps = await page.$$eval('#pg-agenda .pn.timeline .tlgap', (s) => s.map((x) => x.textContent));
    check(JSON.stringify(gaps) === JSON.stringify(['Free 08:00–10:00 (2 h)', 'Free 12:00–14:00 (2 h)', 'Free 15:00–22:00 (7 h)']), `[timeline ${W}] tomorrow's free gaps in words: ${JSON.stringify(gaps)}`);
    const ad = await page.textContent('#pg-agenda .pn.timeline .tlallday').catch(() => '');
    check(new RegExp(`All day${tag} holiday`).test(ad ?? ''), `[timeline ${W}] the all-day one at the top: ${ad}`);
    const td = await page.textContent('#pg-agenda .pn.timeline .tltodo').catch(() => '');
    check(/To-doSpec timeline parcel/.test(td ?? ''), `[timeline ${W}] the to-do due that day beside it: ${td}`);
    const box = await page.$$eval('#pg-agenda .pn.timeline .tlev', (b) => b.map((x) => ({ t: x.querySelector('.tltitle')?.textContent, r: x.getBoundingClientRect().toJSON(), when: x.querySelector('.tlwhen')?.textContent })));
    const at = (n) => box.find((b) => b.t === `${tag} ${n}`)?.r;
    const [a, b, g] = [at('standup'), at('dentist'), at('gym')];
    check(a && b && g && Math.abs(a.left - b.left) > 20 && a.left + a.width <= b.left + 2 && Math.abs(a.width - b.width) < 2 && g.width > a.width * 1.8, `[timeline ${W}] two at once side by side, the gym whole: ${JSON.stringify({ a, b, g })}`);
    check(a && b && b.top > a.top && g && g.top > b.top, `[timeline ${W}] laid out by time: ${JSON.stringify([a?.top, b?.top, g?.top])}`);
    check(box.find((x) => x.t === `${tag} standup`)?.when === '10:00–11:00', `[timeline ${W}] its time said on it: ${JSON.stringify(box.map((x) => x.when))}`);
    const f1 = await fit(page, '#pg-agenda .pn.timeline');
    check(!f1.small.length && !f1.sideways && !f1.cut.length, `[timeline ${W}] tomorrow fits: ${JSON.stringify(f1)}`);
    if (vp === PHONE) await page.locator('#pg-agenda .pn.timeline').screenshot({ path: `${H.out}/planlane2-timeline-tomorrow-${W}.png` }).catch(() => undefined);
    // TODAY: the line at now, when now is in the waking day (the grid runs 08:00 to 22:00 unless something is earlier or later)
    await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TODAY")');
    await page.waitForSelector('#pg-agenda .pn.timeline button.tlkey.on:has-text("TODAY")', { timeout: 3000 });
    const nowLine = await page.textContent('#pg-agenda .pn.timeline .tlnow').catch(() => null);
    if (tm.hour >= 8 && tm.hour < 22) check(/^Now \d\d:\d\d$/.test(nowLine ?? ''), `[timeline ${W}] the line at now: ${nowLine}`);
    else check(nowLine === null, `[timeline ${W}] no line at now outside the day's hours: ${nowLine}`);
    const tgaps = await page.$$eval('#pg-agenda .pn.timeline .tlgap', (s) => s.map((x) => x.textContent));
    check(tgaps.length > 0 && tgaps.every((t) => /^(Free \d\d:\d\d–\d\d:\d\d \(.+\)|Free all day \(08:00–22:00\)|The day is over: nothing more to plan today\.|No free half hour left before 22:00\.|No free gap of half an hour or more between 08:00 and 22:00\.)$/.test(t)), `[timeline ${W}] today's free time said: ${JSON.stringify(tgaps)}`);
    // PLAN MY WEEK: seven days, each with its free slots, and the week in a line
    await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("PLAN MY WEEK")');
    await page.waitForSelector('#pg-agenda .pn.timeline .tlweek', { timeout: 3000 }).catch(() => check(false, `[timeline ${W}] PLAN MY WEEK did not open`));
    const wline = await page.textContent('#pg-agenda .pn.timeline .tlweekline').catch(() => '');
    check(/^\d+ events? and \d+ to-dos? in the next seven days; \d+ h free in the daytime\.( Freest: \w+ \(.+\)\.)?$/.test(wline ?? '') && !RAW.test(wline ?? ''), `[timeline ${W}] the week in a line: ${wline}`);
    const days = await page.$$eval('#pg-agenda .pn.timeline .tlday', (d) => d.map((x) => ({ key: x.dataset.day, t: x.innerText.replace(/\s+/g, ' ').trim() })));
    const tmw = days.find((d) => d.key === tm.key);
    check(days.length === 7 && /^Tomorrow /.test(tmw?.t ?? '') && tmw.t.includes(`${tag} standup`) && tmw.t.includes('Spec timeline parcel') && /Free 08:00–10:00, 12:00–14:00, 15:00–22:00 · 11 h in all$/.test(tmw.t), `[timeline ${W}] the week day by day, tomorrow's slots: ${tmw?.t}`);
    const f2 = await fit(page, '#pg-agenda .pn.timeline');
    check(!f2.small.length && !f2.sideways && !f2.cut.length, `[timeline ${W}] PLAN MY WEEK fits: ${JSON.stringify(f2)}`);
    if (vp === PHONE) await page.locator('#pg-agenda .pn.timeline').screenshot({ path: `${H.out}/planlane2-timeline-week-${W}.png` }).catch(() => undefined);

    // ---- an event changed IN PLACE: tap it on the timeline, the diary opens it whole; words, reminder; UNDO
    await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TOMORROW")');
    await page.locator('#pg-agenda .pn.timeline .tlev', { has: page.locator('.tltitle', { hasText: `${tag} gym` }) }).click();
    await page.waitForFunction((t) => document.querySelector('#pg-agenda .evcard .evcardt')?.textContent === t, `${tag} gym`, { timeout: 4000 }).catch(() => check(false, `[timeline ${W}] a tap on the timeline did not open the event whole`));
    const card = (await page.textContent('#pg-agenda .evcard').catch(() => '')) ?? '';
    check(/Saving changes it in place, and its reminder moves with it\. UNDO puts it back as it was\./.test(card) && !RAW.test(card), `[timeline ${W}] the change box says what saving does: ${card.slice(-140)}`);
    const fc = await fit(page, '#pg-agenda .evcard');
    check(!fc.small.length && !fc.sideways && !fc.cut.length, `[timeline ${W}] the change box with ALL DAY and the reminder fits: ${JSON.stringify(fc)}`);
    // (the change itself at 440 only, with the brain read back: the box and its fit are proved at both sizes above; this keeps the part short)
    if (vp === PHONE) {
    const gymId = made[2];
    await page.fill('#pg-agenda .evcard input[aria-label="Change the event"]', `${tag} gym moved`);
    await page.selectOption('#pg-agenda .evcard select[aria-label="Change the reminder"]', '30');
    await page.click('#pg-agenda .evcard button:has-text("Save changes")');
    await page.waitForFunction((t) => [...document.querySelectorAll('#pg-agenda .rw.ev .evt')].some((b) => b.textContent === t), `${tag} gym moved`, { timeout: 8000 }).catch(() => check(false, `[timeline ${W}] the change did not show in the diary`));
    let a1 = await api(page, 'GET', '/agenda?days=3');
    const g1 = a1.events.find((e) => e.id === gymId);
    check(g1?.title === `${tag} gym moved` && a1.events.filter((e) => e.title.startsWith(`${tag} gym`)).length === 1, `[timeline ${W}] changed in place, the same event: ${JSON.stringify(g1)}`);
    check(a1.jobs.find((j) => j.eventId === gymId)?.next === tm.s3 - 30 * 60_000, `[timeline ${W}] its reminder moved to 30 min before: ${JSON.stringify(a1.jobs.filter((j) => j.eventId === gymId))}`);
    await page.locator('#pg-agenda .pn:has(input[aria-label="Event title"]) .undo button').first().click({ timeout: 4000 }).catch(() => check(false, `[timeline ${W}] no UNDO after the change`));
    await page.waitForFunction((t) => [...document.querySelectorAll('#pg-agenda .rw.ev .evt')].some((b) => b.textContent === t), `${tag} gym`, { timeout: 8000 }).catch(() => check(false, `[timeline ${W}] UNDO did not put it back`));
    a1 = await api(page, 'GET', '/agenda?days=3');
    check(a1.events.find((e) => e.id === gymId)?.title === `${tag} gym` && a1.jobs.find((j) => j.eventId === gymId)?.next === tm.s3 - 15 * 60_000, `[timeline ${W}] UNDO: back as it was, its reminder too: ${JSON.stringify(a1.jobs.filter((j) => j.eventId === gymId))}`);
    // ALL DAY picked: the same event made all day, its end cleared; UNDO gives back its hours
    const dentId = made[1];
    await page.locator('#pg-agenda .rw.ev', { has: page.locator('.evt', { hasText: new RegExp(`^${tag} dentist$`) }) }).first().locator('.evt').click();
    await page.waitForSelector('#pg-agenda .evcard button.evallday', { timeout: 4000 });
    await page.click('#pg-agenda .evcard button.evallday');
    check((await page.getAttribute('#pg-agenda .evcard button.evallday', 'aria-pressed')) === 'true' && (await page.textContent('#pg-agenda .evcard button.evallday')) === '✓ ALL DAY', `[timeline ${W}] ALL DAY says it is on`);
    await page.click('#pg-agenda .evcard button:has-text("Save changes")');
    // (the brain's own copy read until it has the change: the real condition, polled, never a fixed sleep)
    const brainHas = (allDay) => page.waitForFunction(async ({ id, key, allDay }) => {
      const r = await fetch('/api/agenda?days=3', { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } }).then((x) => x.json(), () => null);
      const e = r?.events?.find((x) => x.id === id);
      return e && !!e.allDay === allDay ? e : null;
    }, { id: dentId, key: H.KEY, allDay }, { timeout: 8000, polling: 250 }).then((h) => h.jsonValue(), () => null);
    let d1 = await brainHas(true);
    check(d1?.allDay === true && d1.end === undefined, `[timeline ${W}] made all day in place: ${JSON.stringify(d1)}`);
    await page.locator('#pg-agenda .pn:has(input[aria-label="Event title"]) .undo button').first().click({ timeout: 4000 }).catch(() => check(false, `[timeline ${W}] no UNDO after ALL DAY`));
    d1 = await brainHas(false);
    check(!d1?.allDay && d1?.start === tm.s2 && d1?.end === tm.e2, `[timeline ${W}] UNDO gives back its hours: ${JSON.stringify(d1)}`);
    // an event's NOTES go with every change (the card's promise), on the paths that put it back as a new one too: UNDO when the brain's
    // edit can't be reached, and a change made with the edit out of reach (each is a re-add and a delete, queued like any change)
    const nTag = `${tag} notes`;
    const mk = await api(page, 'POST', '/agenda/events', { title: nTag, start: tm.s3 + 2 * 3600_000, end: tm.s3 + 3 * 3600_000, notes: 'Bring the blue folder', remindMin: 15, tz: 'Europe/London' });
    check(!!mk?.event?.id, `[timeline ${W}] the event with notes went in: ${JSON.stringify(mk).slice(0, 160)}`);
    // (where the change is kept: in the brain, or, when the phone has marked the brain out of reach, in the phone's own queue of changes
    // that goes when it's back: either way it is what he will get, so its notes are read from wherever it is)
    const brainTitled = async (title) => {
      // (polled from here: page.evaluate waits for the page's answer, which a waitForFunction with an async check would not)
      for (const until = Date.now() + 30000; Date.now() < until; await page.waitForTimeout(250)) {
        const got = await page.evaluate(async ({ title, key }) => {
          const r = await fetch('/api/agenda?days=3', { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } }).then((x) => x.json(), () => null);
          const inBrain = r?.events?.find((x) => x.title === title);
          if (inBrain) return inBrain;
          const box = JSON.parse(localStorage.getItem('ghosty.offline') ?? '{}')?.outbox ?? [];
          const queued = box.find((o) => o.kind === 'addEvent' && o.event?.title === title);
          return queued ? { ...queued.event, queued: true } : null;
        }, { title, key: H.KEY }).catch(() => null);
        if (got) return got;
      }
      return null;
    };
    const openEvent = async (title) => {
      await open(page, 'core');
      await open(page, 'agenda');
      await openSection(page, 'agenda', 'Diary');
      await page.waitForFunction((t) => [...document.querySelectorAll('#pg-agenda .rw.ev .evt')].some((b) => b.textContent === t), title, { timeout: 8000 }).catch(() => check(false, `[timeline ${W}] ${title} is not in the diary`));
      await page.locator('#pg-agenda .rw.ev', { has: page.locator('.evt', { hasText: new RegExp(`^${title}$`) }) }).first().locator('.evt').click();
      await page.waitForSelector('#pg-agenda .evcard input[aria-label="Change the event"]', { timeout: 4000 });
    };
    await openEvent(nTag);
    await page.fill('#pg-agenda .evcard input[aria-label="Change the event"]', `${nTag} moved`);
    await page.click('#pg-agenda .evcard button:has-text("Save changes")');
    const n1 = await brainTitled(`${nTag} moved`);
    check(n1?.notes === 'Bring the blue folder', `[timeline ${W}] changed in place, its notes kept: ${JSON.stringify(n1)}`);
    // the brain's edit out of reach from here on (its add and delete still answer): UNDO puts it back as a new one, notes and all
    const editDown = (r) => (r.request().method() === 'POST' ? r.abort('internetdisconnected') : r.continue());
    await page.route(/\/api\/agenda\/events\/[^/?]+$/, editDown);
    await page.locator('#pg-agenda .pn:has(input[aria-label="Event title"]) .undo button').first().click({ timeout: 4000 }).catch(() => check(false, `[timeline ${W}] no UNDO after the notes change`));
    const n2 = await brainTitled(nTag);
    check(n2?.notes === 'Bring the blue folder', `[timeline ${W}] UNDO with the brain's edit out of reach keeps the notes: ${JSON.stringify(n2)}`);
    // and a change made while the edit is out of reach: the changed one goes in as a new one, notes and all
    await openEvent(nTag);
    await page.fill('#pg-agenda .evcard input[aria-label="Change the event"]', `${nTag} offline`);
    await page.click('#pg-agenda .evcard button:has-text("Save changes")');
    const n3 = await brainTitled(`${nTag} offline`);
    const seen3 = n3 ? '' : await page.evaluate(async (key) => {
      const r = await fetch('/api/agenda?days=3', { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } }).then((x) => x.json(), () => null);
      const box = JSON.parse(localStorage.getItem('ghosty.offline') ?? '{}')?.outbox ?? [];
      return JSON.stringify({ brain: (r?.events ?? []).map((e) => e.title), queued: box.map((o) => `${o.kind}:${o.event?.title ?? o.eventId ?? ''}`), card: document.querySelector('#pg-agenda .evcard')?.textContent?.slice(0, 160) ?? null });
    }, H.KEY);
    check(n3?.notes === 'Bring the blue folder', `[timeline ${W}] a change with the brain's edit out of reach keeps the notes: ${JSON.stringify(n3)} ${seen3}`);
    await page.unroute(/\/api\/agenda\/events\/[^/?]+$/, editDown);
    // (whatever is still queued on this phone goes now the edit is back; then every one of them is taken out of the brain)
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await page.waitForFunction(() => !(JSON.parse(localStorage.getItem('ghosty.offline') ?? '{}')?.outbox ?? []).length, null, { timeout: 8000, polling: 250 }).catch(() => undefined);
    const left = await api(page, 'GET', '/agenda?days=3');
    for (const ev of left?.events ?? []) if (ev.title?.startsWith(nTag)) await api(page, 'DELETE', `/agenda/events/${ev.id}`);
    }

    // ---- THE MONTH on any month: ‹ twice back, › on past next month, THIS MONTH home; each month read for itself
    const names = await page.evaluate(() => [-2, 0, 2].map((k) => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() + k, 1); return `${d.toLocaleDateString('en-GB', { month: 'long' })} ${d.getFullYear()}`; }));
    const mon = () => page.textContent('#pg-agenda .pn.month .monname');
    for (let i = 0; i < 2; i++) await page.click('#pg-agenda .monbar button[aria-label="Last month"]');
    check((await mon()) === names[0], `[timeline ${W}] ‹ steps back as far as he likes: ${await mon()}`);
    await page.waitForFunction(() => !document.querySelector('#pg-agenda .pn.month .monread'), null, { timeout: 8000 }).catch(async () => check(false, `[timeline ${W}] the month two back was not read: ${await page.textContent('#pg-agenda .pn.month .monread').catch(() => '')}`));
    for (let i = 0; i < 4; i++) await page.click('#pg-agenda .monbar button[aria-label="Next month"]');
    check((await mon()) === names[2], `[timeline ${W}] › steps on past next month: ${await mon()}`);
    await page.click('#pg-agenda .pn.month button.monhome');
    check((await mon()) === names[1] && !(await page.$('#pg-agenda .pn.month button.monhome')), `[timeline ${W}] THIS MONTH goes home: ${await mon()}`);
    // a month the brain can't give: said, in his words
    await page.route(/\/api\/agenda\?.*from=/, (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"paused"}' }));
    for (let i = 0; i < 5; i++) await page.click('#pg-agenda .monbar button[aria-label="Next month"]');
    const bad = await page.waitForSelector('#pg-agenda .pn.month .monread.bad', { timeout: 8000 }).then((e) => e.textContent(), () => '');
    check(/^I couldn’t read \w+’s days from your brain, so this shows only what your diary already has\. Step away and back to try again\.$/.test(bad ?? ''), `[timeline ${W}] a month that can't be read says so: ${bad}`);
    await page.unroute(/\/api\/agenda\?.*from=/);
    const fm = await fit(page, '#pg-agenda .pn.month');
    check(!fm.small.length && !fm.sideways && !fm.cut.length, `[timeline ${W}] the month with THIS MONTH fits: ${JSON.stringify(fm)}`);
    if (vp === PHONE) await page.locator('#pg-agenda .pn.month').screenshot({ path: `${H.out}/planlane2-timeline-month-${W}.png` }).catch(() => undefined);

    // ---- the seven looks (390 only, BODY 21): the day laid out, in each world by its own command
    if (vp === PHONE2) {
      await page.click('#pg-agenda .pn.month button.monhome').catch(() => undefined);
      for (const world of WORLDS) {
        const on = await page.evaluate(async (w) => { await window.__ghosty.run(`world_${w}`); return window.__ghosty.theme.recipe().world; }, world).catch(() => '');
        check(on === world, `[timeline ${world}] the look is on: ${on}`);
        await open(page, 'agenda');
        await openSection(page, 'agenda', 'Diary');
        await page.waitForSelector('#pg-agenda .pn.timeline .tlev', { timeout: 5000 }).catch(() => check(false, `[timeline ${world}] the day is not laid out`));
        const f = await fit(page, '#pg-agenda .pn.timeline');
        check(!f.small.length && !f.sideways && !f.cut.length, `[timeline ${world}] the day fits: ${JSON.stringify(f)}`);
        const c = await page.$eval('#pg-agenda .pn.timeline .tlev .tltitle', (b) => ({ color: getComputedStyle(b).color, bg: getComputedStyle(b.closest('.tlev')).backgroundColor })).catch(() => null);
        check(c && c.color !== c.bg, `[timeline ${world}] an event's words stand off its block: ${JSON.stringify(c)}`);
        if (world === 'ink' || world === 'glass') await page.locator('#pg-agenda .pn.timeline').screenshot({ path: `${H.out}/planlane2-timeline-${world}-390.png` }).catch(() => undefined);
      }
    }
    // the chat reaches it: "plan my week" opens PLAN MY WEEK and says the week; "when am I free tomorrow?" says tomorrow's free time
    if (vp === PHONE2) {
      const wr = await H.ask(page, 'plan my week', /in the next seven days/);
      check(wr.ok, `[timeline chat] "plan my week" says the week: ${JSON.stringify(wr).slice(0, 300)}`);
      check(await page.evaluate(() => localStorage.getItem('ghosty.agenda.timeline')) === 'week', '[timeline chat] "plan my week" opens PLAN MY WEEK');
      const fr = await H.ask(page, 'When am I free tomorrow?', /Tomorrow: /);
      check(fr.ok && /Free /.test(fr.text), `[timeline chat] "when am I free tomorrow?" says tomorrow's free time: ${JSON.stringify(fr).slice(0, 300)}`);
    }
    for (const id of made) await api(page, 'DELETE', `/agenda/events/${id}`);
    await api(page, 'POST', '/packs/do', { pack: 'work', action: 'todo', args: { op: 'remove', id: 'tl1' } });
    await ctx.close();
  }
  // ---- the brain out of reach with no copy of the diary on this phone: the timeline says so, guesses no free time, keeps the to-dos
  {
    // (its own phone, the brain refused before the app even opens, so no copy of the diary is ever kept: the same set-up as H.phone)
    const ctx = await H.browser.newContext({ viewport: PHONE2, locale: 'en-GB', timezoneId: 'Europe/London', reducedMotion: 'reduce', serviceWorkers: 'block' });
    await ctx.addInitScript(({ key }) => {
      const d = new Date();
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      localStorage.setItem('ghosty.ownerKey', key);
      localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: { body: 21 } }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      localStorage.setItem('ghosty.agenda.todo', JSON.stringify([{ id: 'tl2', text: 'Spec offline parcel', due: day, done: false, at: 1 }]));
    }, { key: H.KEY });
    await ctx.route(/\/api\/agenda(\?|$)/, (r) => r.abort('internetdisconnected'));
    const page = await ctx.newPage();
    await page.goto(H.base, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
    await open(page, 'agenda');
    await openSection(page, 'agenda', 'Diary');
    await page.click('#pg-agenda .pn.timeline button.tlkey:has-text("TODAY")').catch(() => undefined);
    const said = await page.waitForSelector('#pg-agenda .pn.timeline .tlcopy', { timeout: 15000 }).then((e) => e.textContent(), () => '');
    check(said === 'I can’t reach your brain and this phone has no copy of your diary yet, so only your to-dos show here. It fills in when I can.', `[timeline offline] said in his words: ${said}`);
    check(!(await page.$('#pg-agenda .pn.timeline .tlgap')) && /Spec offline parcel/.test((await page.textContent('#pg-agenda .pn.timeline .tltodo').catch(() => '')) ?? ''), '[timeline offline] no free time guessed, the to-do due today kept');
    const f = await fit(page, '#pg-agenda .pn.timeline');
    check(!f.small.length && !f.sideways && !f.cut.length, `[timeline offline] fits: ${JSON.stringify(f)}`);
    // its to-do joined the one list when the phone first met the brain: take it out again, so no later part finds it
    await api(page, 'POST', '/packs/do', { pack: 'work', action: 'todo', args: { op: 'remove', id: 'tl2' } });
    await ctx.close();
  }
  log('timeline');
}
