// THE HOUSE as a home app of its own (planlane:house): the whole house at a glance (lights on, the heating, doors open and for how
// long, what is not answering, what changed lately), his own scenes and scripts run on his tap (a scene that sets a lock asks his
// confirm first), things pinned to the top (kept on the phone), ALL OFF for a room (lights, fans and TVs only: never a switch, never
// the guarded set), a thing not answering said as that with the next thing to do, his box out of reach with the last-read house kept
// and said as that; and the chat's new wordings ("which lights are on?", "turn everything off in the kitchen", "is the front door
// locked?", "what's the temperature inside?", "is anything open?", "run movie night"). His Home Assistant is stood in by page.route on
// the phone's own /api/house calls (house/api.ts): GET /api/house, POST /api/house/act. At 440 × 956 and 390 × 844 at BODY 21, and
// the glance in all seven looks.

const MIN = 60_000;
function world(now) {
  const at = (m) => now - m * MIN;
  return [
    { id: 'light.hall_light', domain: 'light', name: 'Hall light', area: 'Hall', state: 'on', changed: at(40), brightness: 80, dimmable: true },
    { id: 'light.kitchen_light', domain: 'light', name: 'Kitchen light', area: 'Kitchen', state: 'on', changed: at(20), dimmable: false },
    { id: 'light.kitchen_spots', domain: 'light', name: 'Kitchen spots', area: 'Kitchen', state: 'off', changed: at(300), dimmable: false },
    { id: 'light.landing_light', domain: 'light', name: 'Landing light', area: 'Landing', state: 'unavailable', changed: at(90), dimmable: false },
    { id: 'switch.fridge_plug', domain: 'switch', name: 'Fridge plug', area: 'Kitchen', state: 'on', changed: at(5000) },
    { id: 'media_player.living_room_tv', domain: 'media_player', name: 'Living room TV', area: 'Living room', state: 'playing', title: 'The News', volume: 0.3, changed: at(25) },
    { id: 'climate.heating', domain: 'climate', name: 'Heating', area: 'Hall', state: 'heat', current: 19.5, target: 20, mode: 'heat', modes: ['off', 'heat', 'auto'], changed: at(300) },
    { id: 'sensor.living_room_temperature', domain: 'sensor', name: 'Living room temperature', area: 'Living room', state: '18.5', unit: '°C', cls: 'temperature', changed: at(5) },
    { id: 'sensor.bathroom_humidity', domain: 'sensor', name: 'Bathroom humidity', area: 'Bathroom', state: '62', unit: '%', cls: 'humidity', changed: at(8) },
    { id: 'binary_sensor.back_door', domain: 'binary_sensor', name: 'Back door', area: 'Kitchen', state: 'on', cls: 'door', changed: at(120) },
    { id: 'lock.front_door', domain: 'lock', name: 'Front door', area: 'Hall', state: 'locked', changed: at(600), guarded: true },
    { id: 'cover.garage_door', domain: 'cover', name: 'Garage door', area: '', state: 'closed', cls: 'garage', changed: at(1200), guarded: true },
    { id: 'scene.movie_night', domain: 'scene', name: 'Movie night', area: '', state: 'scening', changed: at(3000), members: ['light.hall_light', 'media_player.living_room_tv'] },
    { id: 'scene.goodnight', domain: 'scene', name: 'Goodnight', area: '', state: 'scening', changed: at(3000), members: ['light.hall_light', 'lock.front_door'], guarded: true },
    { id: 'script.warm_the_house', domain: 'script', name: 'Warm the house', area: '', state: 'off', changed: at(3000) },
  ];
}

/** His box stood in on this phone's /api/house calls; `box.calls` is every action the page asked for. */
async function standIn(page) {
  const box = { mode: 'ok', entities: world(Date.now()), calls: [] };
  await page.route(/\/api\/house(\?|$|\/)/, async (r) => {
    const req = r.request();
    const url = new URL(req.url());
    const j = (v, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(v) });
    if (box.mode === 'dead') return r.abort();
    if (url.pathname === '/api/house' && req.method() === 'GET') {
      if (box.mode === 'unlinked') return j({ linked: false, entities: [], line: '', marked: [], at: Date.now() });
      if (box.mode === 'boxdown') return j({ linked: true, entities: [], line: '', marked: [], at: Date.now(), error: 'I couldn’t reach your Home Assistant just now: is it on, and reachable over HTTPS from outside your house?' });
      return j({ linked: true, entities: box.entities, line: `${box.entities.filter((e) => e.domain === 'light' && e.state === 'on').length} lights on · coldest: Living room 18.5 °C`, marked: [], at: Date.now() });
    }
    if (url.pathname === '/api/house/act' && req.method() === 'POST') {
      const b = JSON.parse(req.postData() ?? '{}');
      box.calls.push(b);
      const e = box.entities.find((x) => x.id === b.entity);
      if (e?.guarded && !(b.origin === 'tap' && b.confirm)) return j({ ok: false, needs: 'confirm', text: `The ${e.name} needs your own tap, with a confirm.` });
      if (e && b.service === 'turn_off') e.state = 'off';
      return j({ ok: true, text: `Done: the ${e?.name ?? b.entity} ${b.service === 'turn_off' ? 'is off' : 'has run'}.`, entity: b.entity });
    }
    return r.fallback();
  });
  return box;
}

const reply = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].at(-1)?.textContent ?? '');
async function said(H, page, words, re, ms = 15000) {
  const before = await page.evaluate(() => document.querySelectorAll('#pg-core .msg:not(.me)').length);
  await H.chat(page, words);
  const ok = await page
    .waitForFunction(({ n, src }) => { const all = [...document.querySelectorAll('#pg-core .msg:not(.me)')]; return all.length > n && new RegExp(src).test(all.at(-1)?.textContent ?? ''); }, { n: before, src: re.source }, { timeout: ms })
    .then(() => true, () => false);
  return { ok, text: await reply(page) };
}

export async function run(H) {
  const { check, log } = H;
  // ---- the pure words, from the very files the page is built from
  const S = await H.pure('packages/shared/src/house.ts');
  const W = await H.pure('apps/web/src/features/house/words.ts');
  const now = Date.now();
  const list = world(now);
  const asks = {
    'which lights are on?': 'lightson', 'turn everything off in the kitchen': 'alloff', 'turn off all the lights': 'alloff', 'all off in the lounge': 'alloff',
    'is the front door locked?': 'is', 'what’s the temperature inside?': 'inside', 'how warm is it in the house': 'inside', 'is anything open?': 'opens',
    'activate the goodnight scene': 'run', 'turn off the hall light': 'power', 'set the heating to 21': 'heat',
  };
  for (const [w, k] of Object.entries(asks)) check(S.houseAsked(w)?.kind === k, `[house words] "${w}" is a ${k} ask: ${JSON.stringify(S.houseAsked(w))}`);
  check(S.houseAsked('turn off all notifications') === null && S.houseAsked('run a bath') === null, '[house words] not the house: "turn off all notifications", "run a bath"');
  S.setHouseNames(list.map((e) => e.name));
  check(S.houseAsked('run movie night')?.kind === 'run', `[house words] "run movie night" runs his scene once his names are known: ${JSON.stringify(S.houseAsked('run movie night'))}`);
  const r0 = S.resolveAsk(S.houseAsked('turn off the lights'), list, [], now);
  check(r0.kind === 'many' && r0.calls.map((c) => c.entity.id).join() === 'light.hall_light,light.kitchen_light' && S.houseAsked('turn off the lights in the hall')?.kind === 'power', `[house words] "turn off the lights" turns off every light on (never the TV), not "which one?"; with a room it is as before: ${JSON.stringify(r0.calls?.map((c) => c.entity.id) ?? r0)}`);
  const r1 = S.resolveAsk(S.houseAsked('turn everything off in the kitchen'), list, [], now);
  check(r1.kind === 'many' && r1.calls.map((c) => c.entity.id).join() === 'light.kitchen_light', `[house words] kitchen ALL OFF turns off the light that is on, never the fridge's switch: ${JSON.stringify(r1.calls?.map((c) => c.entity.id))}`);
  const r2 = S.resolveAsk(S.houseAsked('is the front door locked?'), list, [], now);
  check(r2.kind === 'answer' && /^Yes: the Front door is locked/.test(r2.text), `[house words] "is the front door locked?" asks the lock, not the door's sensor: ${r2.text}`);
  const r3 = S.resolveAsk(S.houseAsked('what’s the temperature inside?'), list, [], now);
  check(r3.kind === 'answer' && /^Inside: Living room 18\.5 °C, Hall 19\.5 °C\. The heating is set to 20 °C\.$/.test(r3.text), `[house words] inside: ${r3.text}`);
  const r4 = S.resolveAsk(S.houseAsked('which lights are on?'), list, [], now);
  check(r4.kind === 'answer' && r4.text === '2 lights are on: Hall light (80%), Kitchen light.', `[house words] lights on: ${r4.text}`);
  const r5 = S.resolveAsk(S.houseAsked('is anything open?'), list, [], now);
  check(r5.kind === 'answer' && r5.text === 'Open: the Back door (open for 2 h).', `[house words] open: ${r5.text}`);
  const r6 = S.resolveAsk(S.houseAsked('run goodnight'), list, [], now);
  check(r6.kind === 'act' && r6.guarded === true, `[house words] a scene that sets the lock is guarded: ${JSON.stringify({ kind: r6.kind, guarded: r6.guarded })}`);
  check(S.isGuarded({ id: 'scene.goodnight', domain: 'scene', members: ['lock.front_door'] }) && S.isGuarded({ id: 'scene.out', domain: 'scene', members: ['cover.garage_door'] }) && !S.isGuarded({ id: 'scene.movie', domain: 'scene', members: ['light.hall_light'] }), '[house rules] a scene is guarded when it sets a lock or a garage door, never otherwise');
  check(S.policy({ id: 'scene.goodnight', domain: 'scene', name: 'Goodnight', members: ['lock.front_door'] }, 'turn_on', { origin: 'job' }).ok === false && S.policy({ id: 'scene.goodnight', domain: 'scene', name: 'Goodnight', members: ['lock.front_door'] }, 'turn_on', { origin: 'chat' }).needs === 'confirm', '[house rules] that scene is never run by a job, and words alone only offer the button');
  const g = S.glance(list, now);
  const gl = Object.fromEntries(g.map((x) => [x.key, x.line]));
  check(gl.lights === '2 on: Hall light, Kitchen light' && /^19\.5 °C, set to 20 °C, heating$/.test(gl.heating) && gl.open === 'Back door open for 2 h' && gl.down === 'Landing light' && /^Hall light on, 80%, 40 min ago/.test(gl.lately ?? '') === false, `[house glance] ${JSON.stringify(gl)}`);
  check(/Kitchen light on, 20 min ago/.test(gl.lately ?? ''), `[house glance] lately: ${gl.lately}`);
  check(S.sinceWords(list.find((e) => e.id === 'binary_sensor.back_door'), now) === 'open for 2 h' && S.sinceWords(list.find((e) => e.id === 'light.kitchen_spots'), now) === 'changed 5 h ago', '[house words] a door open for 2 h; a light changed 5 h ago');
  check(S.offWords('Kitchen', ['Kitchen light', 'Kitchen TV']) === 'Kitchen: the Kitchen light and the Kitchen TV are off.' && S.offWords('Kitchen', []) === 'Kitchen: nothing is on in there.', `[house words] ALL OFF said: ${S.offWords('Kitchen', ['Kitchen light', 'Kitchen TV'])}`);
  check(W.PHRASES.every((p) => S.houseAsked(p)), `[house words] every phrase the screen lists works: ${W.PHRASES.filter((p) => !S.houseAsked(p)).join(' | ')}`);
  log('house words');

  // ---- the screen, at both sizes, BODY 21
  for (const vp of [H.PHONE, H.PHONE2]) {
    const T = `[house ${vp.width}]`;
    const { ctx, page } = await H.phone(vp, 'scan', {}, 21);
    const box = await standIn(page);
    await H.open(page, 'house');
    check(await page.waitForSelector('#pg-house .houseglance', { timeout: 20000 }).then(() => true, () => false), `${T} the glance is drawn`);
    const rows = await page.$$eval('#pg-house .houseglrow', (els) => els.map((e) => e.textContent.trim()));
    check(rows.some((r) => /^LIGHTS\s*2 on: Hall light, Kitchen light$/.test(r)) && rows.some((r) => /^DOORS\s*Back door open for 2 h$/.test(r)) && rows.some((r) => /^NOT ANSWERING\s*Landing light$/.test(r)) && rows.some((r) => /^HEATING/.test(r)) && rows.some((r) => /^LATELY/.test(r)), `${T} the glance: ${rows.join(' | ')}`);
    const down = await page.textContent('#pg-house .housecard[data-entity="light.landing_light"]').catch(() => '');
    check(down.includes('not answering') && down.includes('Check it has power, then REFRESH') && !(await page.$('#pg-house .housecard[data-entity="light.landing_light"] .housectl')), `${T} a thing not answering says so, with the next thing to do, and offers no dead keys: ${down}`);
    check((await page.textContent('#pg-house .housecard[data-entity="binary_sensor.back_door"]').catch(() => '')).includes('open for 2 h'), `${T} the back door says how long it has been open`);
    // scenes: a tap runs one; the one that sets the lock asks first
    const scenes = await page.$$eval('#pg-house .housescene', (b) => b.map((x) => x.textContent.trim()));
    check(scenes.join('|') === 'Movie night|Goodnight|Warm the house' && !(await page.$('#pg-house .houseroom .housecard[data-domain="scene"]')), `${T} his scenes and scripts on their own row, not in a room: ${scenes.join(', ')}`);
    await page.click('#pg-house .housescene[data-entity="scene.movie_night"]');
    await page.waitForFunction(() => /Movie night has run/.test(document.body.textContent ?? ''), null, { timeout: 5000 }).catch(() => undefined);
    check(box.calls.some((c) => c.entity === 'scene.movie_night' && c.service === 'turn_on' && c.origin === 'tap'), `${T} Movie night ran on his tap: ${JSON.stringify(box.calls)}`);
    box.calls.length = 0;
    await page.click('#pg-house .housescene[data-entity="scene.goodnight"]');
    const sheetUp = await page.waitForSelector('.confirm.sure', { timeout: 5000 }).then(() => true, () => false);
    const conf = await page.evaluate(() => `${[...document.querySelectorAll('body *')].some((e) => !e.children.length && e.textContent.trim() === 'Run Goodnight?') ? 'Run Goodnight? ' : ''}${document.querySelector('.confirm.sure')?.textContent ?? ''}`);
    check(sheetUp && /^Run Goodnight\? Goodnight sets a lock/.test(conf) && box.calls.length === 0, `${T} Goodnight (it sets the lock) asks his confirm before anything: ${conf.slice(0, 160)}`);
    await page.getByRole('button', { name: /^run it$/i }).click({ timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    check(box.calls.length === 1 && box.calls[0].entity === 'scene.goodnight' && box.calls[0].confirm === true, `${T} confirmed, Goodnight runs with his confirm: ${JSON.stringify(box.calls)}`);
    box.calls.length = 0;
    // pin the hall light: PINNED at the top, kept on the phone through a reload
    await page.click('#pg-house .houseroom:not(.housepins) .housecard[data-entity="light.hall_light"] .housepin');
    check(await page.waitForSelector('#pg-house .housepins .housecard[data-entity="light.hall_light"]', { timeout: 5000 }).then(() => true, () => false), `${T} the hall light pinned shows under PINNED`);
    await page.reload();
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
    await H.open(page, 'house');
    check(await page.waitForSelector('#pg-house .housepins .housecard[data-entity="light.hall_light"]', { timeout: 20000 }).then(() => true, () => false), `${T} the pin is kept on the phone through a reload`);
    const order = await page.$$eval('#pg-house .house > *', (els) => els.map((e) => e.className.split(' ')[0]));
    check(order.indexOf('houseglance') < order.indexOf('housescenes') && order.indexOf('housescenes') < order.findIndex((c, i) => c === 'houseroom' && i > 0), `${T} the glance, then scenes, then PINNED and the rooms: ${order.join(' ')}`);
    // ALL OFF in the kitchen: the light that is on, never the fridge's switch
    box.calls.length = 0;
    const kOff = page.locator('#pg-house section.houseroom[aria-label="Kitchen"] .houseoff');
    check((await kOff.count()) === 1 && (await page.locator('#pg-house section.houseroom[aria-label="Bathroom"] .houseoff').count()) === 0, `${T} ALL OFF is offered where something is on, and only there`);
    await kOff.click();
    await page.waitForFunction(() => /Kitchen: the Kitchen light is off/.test(document.body.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
    check(box.calls.map((c) => `${c.entity}:${c.service}`).join() === 'light.kitchen_light:turn_off', `${T} kitchen ALL OFF turned off only the light: ${JSON.stringify(box.calls.map((c) => c.entity))}`);
    check(/Kitchen: the Kitchen light is off\./.test(await page.evaluate(() => document.body.textContent ?? '')), `${T} and said so in his words`);
    // every key 44 pt, nothing sideways, no word cut, at BODY 21
    const f = await H.fit(page, '#pg-house');
    check(!f.small.length && !f.sideways && !f.cut.length, `${T} fit: small ${f.small.join(' | ')} · sideways ${f.sideways} · cut ${f.cut.join(' | ')}`);
    const raw = await page.textContent('#pg-house');
    check(!H.RAW.test(raw), `${T} no raw error words: ${(raw.match(H.RAW) ?? [])[0]}`);
    await page.screenshot({ path: `${H.out}/planlane-house-${vp.width}.png` });
    // his box out of reach: the last-read house kept, said as that; never "Nothing in your house yet"
    box.mode = 'boxdown';
    await page.locator('#pg-house .housetop button').click();
    const err = await page.waitForSelector('#pg-house [data-state="error"]', { timeout: 8000 }).then((e) => e.textContent(), () => '');
    check(/couldn’t reach your Home Assistant/.test(err) && err.includes('This is your house as I last saw it.') && (await page.locator('#pg-house .housecard').count()) > 3 && !(await page.$('#pg-house [data-state="empty"]')), `${T} the box out of reach keeps the house as last seen, said as that: ${err}`);
    // my brain out of reach too
    box.mode = 'dead';
    await page.locator('#pg-house .housetop button').click();
    check(await page.waitForFunction(() => /as I last saw it/.test(document.querySelector('#pg-house [data-state="offline"]')?.textContent ?? ''), null, { timeout: 8000 }).then(() => true, () => false), `${T} my brain out of reach is said as that`);
    // not linked (yet): said as that, then his steps and the key to KEYS
    box.mode = 'unlinked';
    await page.locator('#pg-house .housetop button').click();
    const un = await page.waitForSelector('#pg-house [data-state="unlinked"]', { timeout: 8000 }).then((e) => e.textContent(), () => '');
    check(un === W.NOT_LINKED_HEAD && (await page.locator('#pg-house .housesteps li').count()) === 5 && (await page.locator('#pg-house button', { hasText: /go to keys/i }).count()) === 1 && !(await page.$('#pg-house .housecard')), `${T} unlinked is said, with the five steps and GO TO KEYS: ${un}`);
    box.mode = 'ok';
    // the chat's new wordings, on the same stood-in house
    if (vp.width === 440) {
      box.entities = world(Date.now());
      await page.evaluate(() => localStorage.removeItem('ghosty.house.pins'));
      let a = await said(H, page, 'which lights are on?', /lights? (?:is|are) on|No lights are on/);
      check(a.ok && /2 lights are on: Hall light \(80%\), Kitchen light\./.test(a.text), `${T} chat "which lights are on?": ${a.text.slice(-120)}`);
      a = await said(H, page, 'is the front door locked?', /the Front door is/);
      check(a.ok && /Yes: the Front door is locked/.test(a.text), `${T} chat "is the front door locked?": ${a.text.slice(-120)}`);
      a = await said(H, page, 'what’s the temperature inside?', /Inside:/);
      check(a.ok && /Inside: Living room 18\.5 °C, Hall 19\.5 °C/.test(a.text), `${T} chat "what’s the temperature inside?": ${a.text.slice(-120)}`);
      a = await said(H, page, 'is anything open?', /Open:|shut and locked/);
      check(a.ok && /Open: the Back door \(open for 2 h\)\./.test(a.text), `${T} chat "is anything open?": ${a.text.slice(-120)}`);
      box.calls.length = 0;
      a = await said(H, page, 'turn everything off in the kitchen', /Kitchen:/);
      check(a.ok && /Kitchen: the Kitchen light is off\./.test(a.text) && box.calls.map((c) => `${c.entity}:${c.service}:${c.origin}`).join() === 'light.kitchen_light:turn_off:chat', `${T} chat "turn everything off in the kitchen": ${a.text.slice(-120)} · ${JSON.stringify(box.calls.map((c) => c.entity))}`);
      box.calls.length = 0;
      a = await said(H, page, 'run movie night', /Movie night/);
      check(a.ok && box.calls.some((c) => c.entity === 'scene.movie_night' && c.service === 'turn_on'), `${T} chat "run movie night": ${a.text.slice(-120)} · ${JSON.stringify(box.calls)}`);
      box.calls.length = 0;
      a = await said(H, page, 'run goodnight', /Goodnight/);
      check(a.ok && /needs your own tap, with a confirm/.test(a.text) && box.calls.length === 0, `${T} chat "run goodnight" (it sets the lock) only offers the button: ${a.text.slice(-140)} · ${JSON.stringify(box.calls)}`);
    }
    await ctx.close();
  }
  log('house screen and chat');

  // ---- the seven looks: the glance, the scenes and a card drawn right, nothing sideways, every key 44 pt
  // (one phone, its look changed in its own settings and the page read again: the same as his tap in THE LOOK, and faster than a new phone each)
  const lk = await H.phone(H.PHONE, H.WORLDS[0], { 'ghosty.house.pins': JSON.stringify(['climate.heating']) }, 21);
  await standIn(lk.page);
  for (const w of H.WORLDS) {
    const { page } = lk;
    if (w !== H.WORLDS[0]) {
      await page.evaluate((w) => { const s = JSON.parse(localStorage.getItem('ghosty.settings') ?? '{}'); s.look = { ...(s.look ?? {}), world: w }; localStorage.setItem('ghosty.settings', JSON.stringify(s)); }, w);
      await page.reload();
      await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 }).catch(() => undefined);
    }
    await H.open(page, 'house');
    const look = await page.evaluate(() => document.documentElement.dataset.world ?? document.body.dataset.world ?? '');
    const ok = await page.waitForSelector('#pg-house .housepins .housecard', { timeout: 20000 }).then(() => true, () => false);
    const f = await H.fit(page, '#pg-house');
    const seen = await page.evaluate(() => {
      const g = document.querySelector('#pg-house .houseglance');
      const r = g?.getBoundingClientRect();
      const s = g ? getComputedStyle(g.querySelector('.houseglrow span')) : null;
      return { w: r?.width ?? 0, colour: s?.color ?? '', vis: s?.visibility ?? '' };
    });
    check(ok && look === w && seen.w > 200 && seen.vis === 'visible' && !/rgba?\(0, 0, 0, 0\)/.test(seen.colour) && !f.small.length && !f.sideways && !f.cut.length, `[house ${w}] drawn (${look}): ${JSON.stringify(seen)} · small ${f.small.join(' | ')} · sideways ${f.sideways} · cut ${f.cut.join(' | ')}`);
    await page.screenshot({ path: `${H.out}/planlane-house-${w}.png` });
  }
  await lk.ctx.close();
  log('house looks');
}
