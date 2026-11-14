// GOODNIGHT (planlane2, plan.c6 with boot.s1's wind-down): "goodnight" winds everything down in three seconds, then says each step in
// one line in the chat: his lights off (lights only; the guarded set listed with a LOCK UP key that asks his tap and his confirm), the
// radio's sleep timer, sleep tracking (the body lane's GOING TO BED) and the day ahead's first event. Each step that cannot run says
// why, and the rest still run; nothing sends or posts. His box, the diary and the radio are stood in on the page (page.route), so the
// part never changes the shared preview brain. Pure words first, then 440 × 956 at BODY 21 (everything working), 390 × 844 (each
// step failing in his words, and the Brief's GOODNIGHT key), and the reply in all seven looks.
const MIN = 60_000;
const FAVS = JSON.stringify([
  { name: 'Spec Lane FM', url: 'https://spec-lane.test-radio.example/one', info: 'UK · News · 128 kbps' },
  { name: 'Spec Lane Two', url: 'https://spec-lane.test-radio.example/two', info: 'UK · News · 128 kbps' },
]);

function house(now) {
  const at = (m) => now - m * MIN;
  return [
    { id: 'light.hall_light', domain: 'light', name: 'Hall light', area: 'Hall', state: 'on', changed: at(40), brightness: 80, dimmable: true },
    { id: 'light.kitchen_light', domain: 'light', name: 'Kitchen light', area: 'Kitchen', state: 'on', changed: at(20), dimmable: false },
    { id: 'light.kitchen_spots', domain: 'light', name: 'Kitchen spots', area: 'Kitchen', state: 'off', changed: at(300), dimmable: false },
    { id: 'switch.fridge_plug', domain: 'switch', name: 'Fridge plug', area: 'Kitchen', state: 'on', changed: at(5000) },
    { id: 'switch.heater', domain: 'switch', name: 'Heater', area: 'Office', state: 'on', changed: at(50) },
    { id: 'media_player.living_room_tv', domain: 'media_player', name: 'Living room TV', area: 'Living room', state: 'playing', changed: at(25) },
    { id: 'lock.front_door', domain: 'lock', name: 'Front door', area: 'Hall', state: 'unlocked', changed: at(600), guarded: true },
    { id: 'lock.back_door', domain: 'lock', name: 'Back door', area: 'Kitchen', state: 'locked', changed: at(600), guarded: true },
    { id: 'cover.garage_door', domain: 'cover', name: 'Garage door', area: '', state: 'open', cls: 'garage', changed: at(1200), guarded: true },
    { id: 'alarm_control_panel.house', domain: 'alarm_control_panel', name: 'Alarm', area: '', state: 'armed_home', changed: at(1200), guarded: true },
  ];
}

/** His box, his diary and nothing else stood in; `box.calls` is every house action asked for, `box.posts` every other write. */
async function standIn(page, mode = {}) {
  const box = { house: mode.house ?? 'ok', agenda: mode.agenda ?? 'ok', entities: house(Date.now()), calls: [], posts: [], events: [] };
  await page.route(/\/api\/house(\?|$|\/)/, async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const j = (v, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(v) });
    if (box.house === 'dead') return r.abort();
    if (url.pathname === '/api/house' && req.method() === 'GET') {
      if (box.house === 'unlinked') return j({ linked: false, entities: [], line: '', marked: [], at: Date.now() });
      return j({ linked: true, entities: box.entities, line: 'stood in', marked: ['switch.heater'], at: Date.now() });
    }
    if (url.pathname === '/api/house/act' && req.method() === 'POST') {
      const b = JSON.parse(req.postData() ?? '{}');
      box.calls.push(b);
      const e = box.entities.find((x) => x.id === b.entity);
      if ((e?.guarded || b.entity === 'switch.heater') && !(b.origin === 'tap' && b.confirm)) return j({ ok: false, needs: 'confirm', text: `The ${e?.name} needs your own tap, with a confirm.` });
      if (e && b.service === 'turn_off') e.state = 'off';
      if (e && b.service === 'lock') e.state = 'locked';
      return j({ ok: true, text: `Done: the ${e?.name ?? b.entity}.`, entity: b.entity });
    }
    return r.fallback();
  });
  await page.route(/\/api\/agenda\?/, (r) => {
    if (box.agenda === 'down') return r.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ tz: 'Europe/London', events: box.events, errors: [], jobs: [], feeds: [] }) });
  });
  // nothing goodnight does sends or posts: every write the page makes while it runs is kept here to be read
  page.on('request', (q) => {
    if (q.method() !== 'GET' && /\/api\//.test(q.url()) && !/\/api\/house\/act|\/api\/turns|\/api\/chat|\/api\/log|\/api\/why|\/api\/trail/.test(q.url())) box.posts.push(`${q.method()} ${new URL(q.url()).pathname}`);
  });
  return box;
}

/** The day ahead on the page's own clock (London's midnight, as the phone keeps it): its label and 9:30 on it, and its first event. */
const ahead = (page) => page.evaluate(() => {
  const d = new Date();
  const early = d.getHours() < 5;
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (early ? 0 : 1));
  return { label: early ? 'Later today' : 'Tomorrow', at930: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 30).getTime(), at14: new Date(day.getFullYear(), day.getMonth(), day.getDate(), 14, 0).getTime(), day: day.getTime(), hour: d.getHours() };
});

/** The chat's log open (the reply's keys live under it in the log; the Scan's Home shows only the reply's words over the orb). */
async function logOpen(page) {
  if (await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen') ?? true)) return;
  if (!(await page.locator('.logbtn').first().isVisible().catch(() => false))) return;
  await page.click('.logbtn').catch(() => undefined);
  await page.waitForFunction(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen'), null, { timeout: 4000 }).catch(() => undefined);
}
/** The goodnight reply's keys (the newest reply's GO keys in the log), by their words. */
const keys = async (page, back = 0) => {
  await logOpen(page);
  return page.evaluate((back) => {
    const m = [...document.querySelectorAll('#pg-core .msg:not(.me)')].filter((x) => /Winding everything down/.test(x.textContent ?? '')).at(-1 - back);
    return [...(m?.querySelectorAll('button.localgo') ?? [])].map((b) => (b.textContent ?? '').trim());
  }, back);
};
/**
 * In a look whose Home keeps the chat's box out of sight (the Ink's page, the Orbit's ring…), his words sent as the chat sends them
 * (window.__ghosty.send, the same path as typing) and the reply waited for as H.ask does: the first after his own message (by data-at).
 */
async function sendAsk(page, words, re, ms = 30000) {
  const t0 = await page.evaluate(() => Date.now());
  await page.evaluate((w) => window.__ghosty.send(w), words);
  const got = await page.waitForFunction(({ t0, src }) => {
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0).lastIndexOf(true);
    if (mine < 0) return null;
    const r = msgs.slice(mine + 1).find((m) => !m.classList.contains('me') && new RegExp(src).test(m.textContent ?? ''));
    return r ? r.textContent : null;
  }, { t0, src: re.source }, { timeout: ms }).then((h) => h.jsonValue(), () => null);
  return { ok: !!got, text: got ?? '' };
}
/** Each line said, in the reply's words (its line breaks, or where the chat folded a long reply, kept as one text: read by `has`). */
const has = (text, line) => text.includes(line);

export async function run(H) {
  const { check, log } = H;

  // ---- 1. the words, pure
  const W = await H.pure('apps/web/src/features/core/goodnightwords.ts');
  const R = await H.pure('apps/web/src/features/radio/asks.ts');
  const yes = ['goodnight', 'Good night!', 'good night ghosty', 'night night', 'Nighty night', 'nighty-night', 'time for bed', 'bedtime', 'okay goodnight', 'goodnight then'];
  // the bed and sleep forms are the body lane's GOING TO BED (features/body/trackcore.ts), never two owners for one wording
  const bedWords = ["I'm off to bed", 'going to bed', 'I’m going to bed now', 'going to sleep', 'heading to bed', "I'm off to bed, ghosty", 'going to sleep now'];
  const no = [...bedWords, 'run goodnight', 'activate the goodnight scene', 'night mode', 'good morning', 'goodnight moon is a lovely book', 'what time should I go to bed', 'turn the radio off in 30 minutes'];
  check(yes.every((w) => W.goodnightAsked(w)) && no.every((w) => !W.goodnightAsked(w)), `[goodnight] the words: ${yes.filter((w) => !W.goodnightAsked(w)).join(' | ')} missed; ${no.filter((w) => W.goodnightAsked(w)).join(' | ')} taken`);
  check(R.radioAsked('goodnight')?.what === 'goodnight' && R.radioAsked('time for bed')?.what === 'goodnight' && R.radioAsked('turn the radio off in 30 minutes')?.what === 'sleep', '[goodnight] the chat reaches it through the radio\'s table, which keeps its own words');
  // the chat's route: the first table in LOCAL_ASKS that takes each wording (local.ts stops at the first answer)
  {
    const P = await H.pure('apps/web/src/assistant/phrases.ts').catch(() => null);
    const first = (t) => P?.LOCAL_ASKS.find((a) => a.test(t))?.id ?? null;
    const gn = ['goodnight', 'good night', 'night night', 'nighty night', 'time for bed', 'bedtime', 'okay goodnight'];
    const bed = ["i'm off to bed", 'going to bed', 'going to sleep now', "i'm going to bed"];
    check(P && gn.every((w) => first(w) === 'planradio') && bed.every((w) => first(w) === 'track'), `[goodnight] the chat's route: goodnight words reach GOODNIGHT, bed words the body's tracker: ${[...gn, ...bed].map((w) => `${w}→${first(w)}`).join(', ')}`);
  }
  // "goodnight" to the mic: the conversation's end words take it, so the voice turn runs GOODNIGHT before any sign-off (core/index.ts)
  {
    const I = await H.pure('packages/shared/src/intent.ts');
    check(['goodnight', 'Good night!', 'night night', 'nighty night'].every((w) => I.endIntent(w) && W.goodnightAsked(w)) && !W.goodnightAsked('bye') && !W.goodnightAsked("that's all"), '[goodnight] spoken goodnight: an end word GOODNIGHT takes (so it runs, not the sign-off); "bye" still signs off');
  }
  const late = new Date(2026, 10, 14, 23, 10).getTime();
  const small = new Date(2026, 10, 15, 1, 20).getTime();
  const tom = (h, m) => new Date(2026, 10, 15, h, m).getTime();
  check(W.dayAhead(late).label === 'Tomorrow' && W.dayAhead(late).from === new Date(2026, 10, 15).getTime() && W.dayAhead(small).label === 'Later today' && W.dayAhead(small).from === small, '[goodnight] the day ahead: tomorrow in the evening, the rest of today after midnight');
  const ev = [{ title: 'Gym', start: tom(18, 0) }, { title: 'Dentist', start: tom(9, 30) }, { title: 'Bin day', start: new Date(2026, 10, 15).getTime(), allDay: true }, { title: 'Tonight’s film', start: late + 20 * MIN }];
  check(W.aheadLine(ev, late) === 'Tomorrow: Dentist at 9:30, then 1 more (and Bin day, all day).', `[goodnight] tomorrow's first event: ${W.aheadLine(ev, late)}`);
  check(W.aheadLine([{ title: 'Dentist', start: tom(9, 30) }], late) === 'Tomorrow: Dentist at 9:30.' && W.aheadLine([], late) === 'Tomorrow is clear: nothing in your diary.' && W.aheadLine(null, late) === 'Tomorrow: I can’t reach my brain right now, so I can’t read your diary.', '[goodnight] one event, a clear day, the brain out of reach');
  check(W.aheadLine([{ title: 'Dentist', start: tom(9, 30) }], small) === 'Later today: Dentist at 9:30.' && W.aheadLine([], small, { calendarsDown: true }) === 'The rest of today is clear: nothing in your diary, though one of your calendars didn’t answer.', '[goodnight] after midnight it is later today; a calendar that did not answer is said');
  const g = (domain, state, cls) => W.openGuard({ id: `${domain}.x`, name: 'X', domain, state, cls });
  check(g('lock', 'unlocked')?.service === 'lock' && g('lock', 'locked') === null && g('cover', 'open', 'garage')?.service === 'close_cover' && g('cover', 'closed', 'garage') === null && g('alarm_control_panel', 'disarmed')?.service === 'alarm_arm_home' && g('alarm_control_panel', 'armed_away') === null && g('alarm_control_panel', 'armed_night') === null, '[goodnight] the guarded set: only what is open is offered, each with what LOCK UP would do (the alarm: the HOUSE sheet\'s own ARM)');
  // never "all locked" from a lock, a garage door or an alarm that is not answering or still moving
  {
    const odd = [{ id: 'lock.f', name: 'Front Door', domain: 'lock', state: 'unavailable' }, { id: 'cover.g', name: 'Garage Door', domain: 'cover', state: 'closing' }, { id: 'alarm_control_panel.h', name: 'House Alarm', domain: 'alarm_control_panel', state: 'unknown' }];
    const open = odd.map(W.openGuard).filter((x) => x !== null);
    const line = W.lockLine(open, odd.length);
    check(open.length === 3 && open.every((o) => !o.service) && line === 'Locks and doors: the Front Door is not answering, so I can’t say it’s locked, the Garage Door is still closing and the House Alarm is not answering, so I can’t say it’s set. I never touch those from words.', `[goodnight] not answering or still moving: said, never "all locked", no key that nothing would answer: ${line}`);
    const two = [W.openGuard({ id: 'lock.b', name: 'Back Door', domain: 'lock', state: 'locking' }), W.openGuard({ id: 'alarm_control_panel.h', name: 'Alarm', domain: 'alarm_control_panel', state: 'triggered' })];
    check(two.every((o) => o && !o.service) && /still locking/.test(two[0].now) && two[1].now === 'sounding' && W.lockLine([], 2) === 'Locks and doors: all locked and closed.', '[goodnight] locking and a sounding alarm are not "locked"; all locked only when every one is');
  }
  check(W.sleepLine({ kind: 'unkept' }) === 'Sleep: I couldn’t keep that on this phone (its storage is full or off), so tap GOING TO BED in BODY, SLEEP.', '[goodnight] sleep not kept on this phone: said, never "tracking"');
  check(W.aheadLine([], late, { copy: true }) === 'Tomorrow: my brain is out of reach and the copy on this phone shows nothing, so I can’t say it’s clear.' && W.aheadLine([{ title: 'Dentist', start: tom(9, 30) }], late, { copy: true }) === 'Tomorrow: Dentist at 9:30 (from the copy on this phone: my brain is out of reach).', '[goodnight] from the phone\'s copy: said as the copy, never "clear"');
  check(W.lightsLine('ok', ['Hall light', 'Kitchen light'], ['Porch light']) === 'Lights off: Hall light and Kitchen light. Porch light didn’t answer, so it’s still on.' && W.lightsLine('ok') === 'Lights: none were on.' && /isn’t linked/.test(W.lightsLine('unlinked')) && /can’t reach my brain/.test(W.lightsLine('out')) && /didn’t answer/.test(W.lightsLine('down')), '[goodnight] the lights in every case');
  check(W.radioLine({ kind: 'set', name: 'Spec Lane FM', at: tom(0, 5), min: 30 }) === 'Radio: Spec Lane FM stops in 30 minutes, at 0:05.' && /nothing is playing/.test(W.radioLine({ kind: 'nothing' })) && W.nightKeyAt(new Date(2026, 10, 14, 18, 0)) && W.nightKeyAt(new Date(2026, 10, 15, 2, 0)) && !W.nightKeyAt(new Date(2026, 10, 14, 17, 59)) && !W.nightKeyAt(new Date(2026, 10, 15, 5, 0)), '[goodnight] the radio line, and the key from six till five');

  // ---- 2. 440 × 956 at BODY 21: everything working
  {
    const { ctx, page } = await H.phone(H.PHONE, 'scan', { 'ghosty.radio.favs': FAVS }, 21);
    const box = await standIn(page);
    const A = await ahead(page);
    box.events = [{ id: 'e1', title: 'Dentist', start: A.at930, source: 'ghosty' }, { id: 'e2', title: 'Gym', start: A.at14, source: 'ghosty' }];
    // his own look on Paper (kept), and a station playing
    const paper = await H.ask(page, 'paper', /Paper/);
    check(paper.ok && (await page.evaluate(() => document.documentElement.dataset.ground)) === 'paper', `[goodnight 440] on Paper first: ${paper.text.slice(0, 120)}`);
    const play = await H.ask(page, 'play my first favourite', /Playing Spec Lane FM/);
    check(play.ok, `[goodnight 440] Spec Lane FM playing: ${play.text.slice(0, 120)}`);
    const t0 = Date.now();
    const sent = H.ask(page, 'goodnight', /Sleep well/, 30000);
    // the wind-down: the screen settles first, before any line is said
    const down = await page.waitForFunction(() => document.documentElement.dataset.goodnight === 'down', null, { timeout: 5000 }).then(() => true, () => false);
    check(down, '[goodnight 440] the wind-down starts: the screen settles (data-goodnight="down")');
    const r = await sent;
    const took = Date.now() - t0;
    log(`goodnight 440: ${took} ms`);
    const T = r.text;
    check(r.ok && has(T, 'Goodnight, Tony. Winding everything down:'), `[goodnight 440] said: ${T.slice(0, 600)}`);
    check(took >= 2900, `[goodnight 440] three seconds of wind-down before the lines (${took} ms)`);
    check(has(T, 'Lights off: Hall light and Kitchen light.'), '[goodnight 440] the lights that were on, off');
    const offs = box.calls.filter((c) => c.service === 'turn_off').map((c) => c.entity).sort().join(',');
    check(offs === 'light.hall_light,light.kitchen_light' && box.calls.length === 2 && box.calls.every((c) => c.origin === 'chat' && /^light\./.test(c.entity)), `[goodnight 440] only the lights that were on, and nothing else (never a lock, a garage door, a switch or the TV): ${JSON.stringify(box.calls)}`);
    check(has(T, 'Locks and doors: the Front door is unlocked and the Garage door is open. I never touch those from words: LOCK UP needs your own tap and a confirm, every time.'), '[goodnight 440] the guarded set listed, never touched');
    const radio = /Radio: [^\n]*?\.(?=\s|$)/.exec(T)?.[0] ?? '';
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.radio.sleep') ?? 'null'));
    check(/^Radio: Spec Lane FM stops in 30 minutes, at \d{1,2}:\d{2}\.$/.test(radio) && kept && Math.abs(kept.at - (t0 + 30 * MIN)) < 2 * MIN, `[goodnight 440] the radio's sleep timer, 30 minutes: ${radio} ${JSON.stringify(kept)}`);
    const bed = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.body.track') ?? 'null')?.set?.bedAt ?? 0);
    check(has(T, 'Sleep: tracking from now. Say “I’m up now” when you wake.') && Math.abs(bed - Date.now()) < 2 * MIN, `[goodnight 440] sleep tracking started (the body's GOING TO BED): ${bed}`);
    check(has(T, `${A.label}: Dentist at 9:30, then 1 more.`), `[goodnight 440] the day ahead's first event (${A.label})`);
    check(has(T, 'The night look is on. Nothing was sent or posted. Sleep well.'), '[goodnight 440] the close: the night look, nothing sent');
    check(T.indexOf('Lights off') < T.indexOf('Locks and doors') && T.indexOf('Locks and doors') < T.indexOf('Radio:') && T.indexOf('Radio:') < T.indexOf('Sleep:') && T.indexOf('Sleep:') < T.indexOf(`${A.label}:`) && T.indexOf(`${A.label}:`) < T.indexOf('Sleep well'), '[goodnight 440] in turn: the house, the radio, sleep, the day ahead');
    const look = await page.evaluate(() => ({ g: document.documentElement.dataset.goodnight, ground: document.documentElement.dataset.ground, kept: JSON.parse(localStorage.getItem('ghosty.settings') ?? '{}').look?.ground, day: JSON.parse(localStorage.getItem('ghosty.settings') ?? '{}').look?.switches?.day }));
    check(look.g === 'rest' && look.ground === 'graphite' && look.kept === 'paper', `[goodnight 440] the night look on (his night ground) while his own choice stays kept: ${JSON.stringify(look)}`);
    check(!box.posts.length, `[goodnight 440] nothing sent or posted: ${box.posts.join(', ')}`);
    // a second goodnight: nothing on to turn off, the timer and the night kept
    const r2 = await H.ask(page, 'night night', /Sleep well/, 30000);
    const T2 = r2.text;
    check(has(T2, 'Lights: none were on.') && /Radio: Spec Lane FM already stops at \d{1,2}:\d{2}, sooner than that, so I kept its timer\./.test(T2) && /Sleep: already tracking since \d{1,2}:\d{2}\./.test(T2) && has(T2, 'Locks and doors: the Front door is unlocked and the Garage door is open.') && box.calls.length === 2, `[goodnight 440] again: nothing on, the timer and the night kept, the guarded set still only listed: ${T2.slice(0, 500)}`);
    check(has(T2, 'The night look was already on. Nothing was sent or posted. Sleep well.'), '[goodnight 440] the night look already on');
    const k = await keys(page);
    check(k.includes('LOCK UP: FRONT DOOR') && k.includes('LOCK UP: GARAGE DOOR') && !k.some((x) => /BACK DOOR|ALARM/.test(x)), `[goodnight 440] a LOCK UP key for each one open: ${k.filter((x) => /LOCK UP/.test(x)).join(' | ')}`);
    const fit = await H.fit(page, '#pg-core .localacts');
    check(!fit.small.length && !fit.sideways && !fit.cut.length, `[goodnight 440] BODY 21: keys 44 pt, nothing sideways, no word cut: ${JSON.stringify(fit)}`);
    await page.screenshot({ path: `${H.out}/planlane2-goodnight-440.png` });
    // LOCK UP asks his confirm, every time: nothing happens until he confirms
    await page.locator('#pg-core .msg button.localgo', { hasText: 'LOCK UP: FRONT DOOR' }).last().click();
    const sheet = await page.waitForSelector('.confirm.sure', { timeout: 5000 }).then(() => true, () => false);
    check(sheet && box.calls.length === 2, `[goodnight 440] LOCK UP opens his confirm and touches nothing first: ${JSON.stringify(box.calls.slice(2))}`);
    await page.click('.confirm.sure button.sureyes');
    await page.waitForFunction(() => !document.querySelector('.confirm.sure'), null, { timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(0);
    const lockCall = await (async () => { for (let i = 0; i < 40 && box.calls.length < 3; i++) await page.waitForTimeout(100); return box.calls[2]; })();
    check(lockCall?.entity === 'lock.front_door' && lockCall.service === 'lock' && lockCall.origin === 'tap' && lockCall.confirm === true, `[goodnight 440] confirmed, the front door locks on his tap: ${JSON.stringify(lockCall)}`);
    // tonight's night look is never saved: his next look change keeps Paper and his follow-the-day as they were, and shows his own look again
    const dayBefore = look.day;
    const bigger = await H.ask(page, 'smaller text', /text|Text|size|Size|smaller|Smaller/);
    const after = await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('ghosty.settings') ?? '{}').look ?? {}; return { ground: l.ground, day: l.switches?.day, shown: document.documentElement.dataset.ground }; });
    check(bigger.ok && after.ground === 'paper' && after.day === dayBefore && after.shown === 'paper', `[goodnight 440] after goodnight, a look change saves his own look (Paper, follow-the-day ${dayBefore}), never the night look: ${JSON.stringify(after)} ${bigger.text.slice(0, 80)}`);
    await ctx.close();
  }

  log('goodnight: 440 done');
  // ---- 3. 390 × 844: each step that cannot run says why, and the rest still run; the Brief's GOODNIGHT key
  {
    const { ctx, page } = await H.phone(H.PHONE2, 'ink');
    const box = await standIn(page, { house: 'unlinked', agenda: 'down' });
    const A = await ahead(page);
    const r = await sendAsk(page, 'time for bed', /Sleep well/);
    const T = r.text;
    check(r.ok && has(T, 'Lights: your house isn’t linked yet, so I left them. Link your Home Assistant in LINKS.') && has(T, 'Radio: nothing is playing, so there’s no timer to set.') && has(T, 'Sleep: tracking from now. Say “I’m up now” when you wake.') && has(T, `${A.label}: I can’t reach my brain right now, so I can’t read your diary.`), `[goodnight 390] unlinked, nothing playing, the diary out of reach: each said, the rest run: ${r.text.slice(0, 600)}`);
    box.house = 'dead';
    box.agenda = 'ok';
    box.events = [];
    const r2 = await sendAsk(page, 'goodnight', /Sleep well/);
    const T2 = r2.text;
    check(has(T2, 'Lights: I can’t reach my brain right now, so I left your lights as they are.') && has(T2, A.label === 'Tomorrow' ? 'Tomorrow is clear: nothing in your diary.' : 'The rest of today is clear: nothing in your diary.'), `[goodnight 390] the brain out of reach for the house, a clear day ahead: ${r2.text.slice(0, 500)}`);
    check(!/Locks and doors/.test(T) && (await keys(page, 1)).includes('OPEN LINKS'), '[goodnight 390] unlinked: no locks claimed, OPEN LINKS offered');
    const fit = await H.fit(page, '#pg-core .localacts');
    check(!fit.small.length && !fit.sideways && !fit.cut.length, `[goodnight 390] keys 44 pt, nothing sideways, no word cut: ${JSON.stringify(fit)}`);
    check(!box.posts.length, `[goodnight 390] nothing sent or posted: ${box.posts.join(', ')}`);
    await page.screenshot({ path: `${H.out}/planlane2-goodnight-390.png` });
    // the Brief's GOODNIGHT key: from six in the evening till five in the morning (the page's own clock), never by day
    await H.open(page, 'brief');
    await page.waitForSelector('#pg-brief .bract button.brme', { timeout: 15000 });
    const night = A.hour >= 18 || A.hour < 5;
    const keyUp = await page.locator('#pg-brief .bract button.brnight:not([hidden])').count();
    check(keyUp === (night ? 1 : 0), `[goodnight 390] the Brief's GOODNIGHT key ${night ? 'shows' : 'hides'} at ${A.hour}:00 (${keyUp})`);
    if (night) {
      const bf = await H.fit(page, '#pg-brief .bract');
      check(!bf.small.length && !bf.sideways && !bf.cut.length, `[goodnight 390] the key fits: ${JSON.stringify(bf)}`);
      const t0 = await page.evaluate(() => Date.now());
      await page.click('#pg-brief .bract button.brnight');
      const got = await page.waitForFunction((t0) => {
        const msgs = [...document.querySelectorAll('#pg-core .msg')];
        const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0).lastIndexOf(true);
        return mine >= 0 && msgs.slice(mine + 1).some((m) => !m.classList.contains('me') && /Winding everything down/.test(m.textContent ?? ''));
      }, t0, { timeout: 30000 }).then(() => true, () => false);
      check(got && (await page.evaluate(() => document.body.dataset.tab)) === 'core', '[goodnight 390] GOODNIGHT on the Brief runs it in the chat');
    }
    await ctx.close();
  }

  log('goodnight: 390 done');
  // ---- 4. the reply in all seven looks (390 × 844 at BODY 21; one phone, the look changed and the page reloaded): said whole, the
  // wind-down resting, the keys at 44 pt, nothing sideways, no word cut
  {
    const { ctx, page } = await H.phone(H.PHONE2, H.WORLDS[0], {}, 21);
    await standIn(page);
    for (const world of H.WORLDS) {
      if (world !== H.WORLDS[0]) {
        await page.evaluate((w) => { const s = JSON.parse(localStorage.getItem('ghosty.settings') ?? '{}'); s.look = { ...(s.look ?? {}), world: w }; localStorage.setItem('ghosty.settings', JSON.stringify(s)); }, world);
        await page.reload();
        await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
      }
      const t = Date.now();
      const r = await sendAsk(page, 'goodnight', /Sleep well/);
      // (read before the log is opened: his touch ends the rest, as it should)
      const st = await page.evaluate(() => ({ g: document.documentElement.dataset.goodnight, w: document.documentElement.dataset.world }));
      await logOpen(page);
      const fit = await H.fit(page, '#pg-core .localacts');
      log(`goodnight ${world}: ${Date.now() - t} ms`);
      check(r.ok && /LOCK UP needs your own tap/.test(r.text) && st.g === 'rest' && st.w === world && !fit.small.length && !fit.sideways && !fit.cut.length, `[goodnight ${world}] the reply whole in this look: ${JSON.stringify(st)} ${JSON.stringify(fit)} ${r.text.slice(0, 120)}`);
      if (world === 'glass' || world === 'ink') await page.screenshot({ path: `${H.out}/planlane2-goodnight-${world}.png` });
    }
    await ctx.close();
  }
}
