// THE BRIEF (planlane:brief): the morning briefing as a specialist app, proved at 440 × 956 and 390 × 844 at BODY 21, and in the seven looks.
//  - the pure words: the chat's wordings (and what it leaves to the brain), what to wear, tomorrow, the to-dos, the sources with their time;
//  - the page by day: TODAY, RAIN, WEAR and SUN in words, the weather named with its source and time, the commute's one place to save
//    home and work (the tap lands on Memory → ME → PLACES), the headlines down with TRY AGAIN, then back with "BBC · HH:MM";
//  - the page in the evening: tonight's rain, then TOMORROW, what to wear tomorrow, tomorrow's sunrise, and the sentence says "Tomorrow";
//  - the chat with no model: "good morning" and "what's my day look like" open the Brief and say its one line from the page's own data;
//  - every key 44 pt, nothing sideways, no word cut, in every look.
// Open-Meteo, the BBC and his saved places are stood in (page routes); the clock is moved to 08:05 or 20:05 today (the timers stay real).

const hours = (f) => Array.from({ length: 72 }, (_, i) => f(i % 24, i));
const day = (k) => {
  const d = new Date(Date.now() + k * 86400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
// a cold day, rain likely from 15:00 today; tomorrow dry and 2 to 9°C, its sunrise 07:30
const forecast = () => ({
  latitude: 52.48, longitude: -1.9, timezone: 'Europe/London',
  current: { time: `${day(0)}T08:00`, temperature_2m: 4.2, apparent_temperature: 1.1, relative_humidity_2m: 80, weather_code: 2, wind_speed_10m: 12, wind_direction_10m: 270, pressure_msl: 1010 },
  hourly: { time: hours((h, i) => `${day(Math.floor(i / 24))}T${String(h).padStart(2, '0')}:00`), temperature_2m: hours((h) => 2 + Math.round(6 * Math.sin(((h - 6) / 24) * Math.PI))), precipitation_probability: hours((h, i) => (i < 24 ? (h >= 15 && h <= 22 ? 70 : 10) : 5)) },
  daily: { time: [day(0), day(1), day(2)], temperature_2m_max: [8.2, 9.1, 10], temperature_2m_min: [0.4, 2.2, 3], precipitation_probability_max: [70, 5, 10], sunrise: [`${day(0)}T07:25`, `${day(1)}T07:30`, `${day(2)}T07:32`], sunset: [`${day(0)}T16:17`, `${day(1)}T16:15`, `${day(2)}T16:14`], uv_index_max: [1, 1, 1] },
});
const RSS = () => `<?xml version="1.0"?><rss><channel>${Array.from({ length: 6 }, (_, i) => `<item><title>Brief lane story ${i + 1}</title><description>About it</description><link>https://www.bbc.co.uk/news/${i}</link><pubDate>${new Date(Date.now() - (i + 1) * 1800e3).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`;

export async function run(H) {
  const { check, log } = H;
  // ---- 1. the pure words
  const A = await H.pure('apps/web/src/features/brief/asks.ts');
  const D = await H.pure('apps/web/src/features/brief/day.ts');
  {
    const yes = ['good morning', 'Good morning, Ghosty!', 'morning', "what's my day look like?", 'What does my day look like today', 'how is my day looking', 'give me the rundown', 'Give me a rundown please', 'what do I need to know today?', 'anything I need to know this morning', 'brief me', 'my morning briefing', 'Daily brief', 'catch me up'];
    const no = ['brief me on the election', 'give me the rundown on the new phones', 'good morning to the team, write them a note', 'what is the weather', 'play music', 'open the agenda', 'Give me a sharp spoken briefing in about 90 words from these facts (no need to look anything up). Good morning.', 'what do I need to know about tax'];
    const missed = yes.filter((t) => !A.briefAsked(t));
    const took = no.filter((t) => A.briefAsked(t));
    check(!missed.length, `[brief] the chat's wordings for the day open the Brief: missed ${JSON.stringify(missed)}`);
    check(!took.length, `[brief] the chat leaves a subject ("brief me on X") and other screens' words to the rest: took ${JSON.stringify(took)}`);
    const w1 = D.wearLine({ max: 6, feels: 2, rain: 70, wind: 10, uv: 1 });
    const w2 = D.wearLine({ max: 3, feels: -1, rain: 0, wind: 10, uv: 0 });
    const w3 = D.wearLine({ max: 24, feels: 22, rain: 10, wind: 45, uv: 7 });
    check(w1 === 'A warm coat and an umbrella' && w2 === 'A warm coat, hat and gloves' && w3 === 'Something light and sun cream: it’s windy', `[brief] what to wear, from the forecast only: "${w1}" / "${w2}" / "${w3}"`);
    const dry = Array.from({ length: 72 }, () => 5);
    const wet = Array.from({ length: 72 }, (_, i) => (i >= 33 ? 80 : 5));
    check(D.tomorrowClause('2°C', '9°C', dry) === 'Tomorrow 2 to 9°C, dry' && D.tomorrowClause('2°C', '9°C', wet) === 'Tomorrow 2 to 9°C, rain likely from 09:00', `[brief] tomorrow in words: "${D.tomorrowClause('2°C', '9°C', dry)}" / "${D.tomorrowClause('2°C', '9°C', wet)}"`);
    check(D.tonight('dry for the rest of today') === 'dry tonight', '[brief] tonight, not "the rest of today", in the evening');
    check(D.todoClause([{ due: '2026-11-13' }], '2026-11-13') === '1 to-do due today' && D.todoClause([{ due: '2026-11-12' }, { due: '2026-11-13' }, { due: '2026-11-13' }], '2026-11-13') === '3 to-dos due today, 1 of them late' && D.todoClause([{ due: '2026-11-01' }], '2026-11-13') === '1 to-do late' && D.todoClause([], '2026-11-13') === '', '[brief] the to-dos in the day\'s sentence');
    const s = D.summary({ rain: 'dry tonight', tomorrow: 'Tomorrow 2 to 9°C, dry', diary: 'Nothing in your diary for the rest of today', todo: '1 to-do due today' });
    check(s === 'Dry tonight. Tomorrow 2 to 9°C, dry. Nothing in your diary for the rest of today. 1 to-do due today.', `[brief] the evening's order: tonight, then tomorrow, then the diary and the to-dos: "${s}"`);
    const now = new Date(2026, 10, 13, 9, 0).getTime();
    check(D.sourceAt('OPEN-METEO', now - 5 * 60_000, now) === 'OPEN-METEO · 08:55' && /^BBC · 12 Nov 09:00$/.test(D.sourceAt('BBC', now - 86400_000, now)), `[brief] every source with its time: ${D.sourceAt('BBC', now - 86400_000, now)}`);
    check(D.marketsClause({ name: 'Bitcoin', price: '£71,234', change: 2.14 }) === 'Bitcoin £71,234, up 2.1% in a day' && D.marketsClause(null) === '', '[brief] the markets in one line, only when there are prices');
    check(D.eveningNow(new Date(2026, 10, 13, 18, 0)) && !D.eveningNow(new Date(2026, 10, 13, 17, 59)), '[brief] the Brief looks ahead from 18:00');
  }
  log('brief: pure words');

  // ---- the page, stood in: the clock at `hour`:05 today, the forecast above, the BBC down until `bbc.up`, no places saved
  // (its own phone, as the harness's phone() makes one, but with the clock and the stand-ins in place before the first load: no reload)
  async function brief(vp, world, hour, seed = {}, wx = { up: true }) {
    const ctx = await H.browser.newContext({ viewport: vp, locale: 'en-GB', timezoneId: 'Europe/London' });
    const bbc = { up: false };
    await ctx.addInitScript(({ world, seed, hour }) => {
      if (!localStorage.getItem('ghosty.settings'))
        localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: { body: 21 } }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
      for (const [k, v] of Object.entries(seed)) if (!localStorage.getItem(k)) localStorage.setItem(k, v);
      const Real = Date;
      const t = new Real();
      t.setHours(hour, 5, 0, 0);
      const off = t.getTime() - Real.now();
      globalThis.Date = class extends Real {
        constructor(...a) {
          super(...(a.length ? a : [Real.now() + off]));
        }
        static now() {
          return Real.now() + off;
        }
      };
    }, { world, seed, hour });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => check(false, `[brief ${world} ${vp.width}] pageerror: ${e.message}`));
    await page.route(/\/api\/proxy\?/, (r) => {
      const u = new URL(r.request().url()).searchParams.get('url') ?? '';
      if (/air-quality-api\.open-meteo/.test(u)) return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ current: { european_aqi: 20, pm2_5: 4, pm10: 7, nitrogen_dioxide: 12, ozone: 40 } }) });
      if (/api\.open-meteo\.com/.test(u)) return wx.up ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(forecast()) }) : r.fulfill({ status: 502, body: 'down' });
      if (/bbci\.co\.uk/.test(u)) return bbc.up ? r.fulfill({ status: 200, contentType: 'application/rss+xml', body: RSS() }) : r.fulfill({ status: 502, body: 'down' });
      return r.fallback();
    });
    await page.route(/\/api\/profile\/places$/, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ places: [] }) }));
    await page.goto(H.base);
    await page.fill('#pair input', H.KEY);
    await page.click('#pair button.on');
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    await H.open(page, 'brief');
    if (wx.up) await page.waitForSelector('#pg-brief .pn.wx .brwear', { timeout: 15000 }).catch(() => check(false, `[brief ${world} ${vp.width}] the weather card never showed WEAR`));
    return { ctx, page, bbc };
  }
  const txt = (page, sel) => page.evaluate((s) => document.querySelector(s)?.innerText?.replace(/\s+/g, ' ').trim() ?? '', sel);
  const fits = async (page, tag) => {
    for (const sel of ['#pg-brief .hero', '#pg-brief .pn.brday', '#pg-brief .pn.commute', '#pg-brief .pn.wx', '#pg-brief .pn.news']) {
      const f = await H.fit(page, sel);
      check(!f.small.length && !f.sideways && !f.cut.length, `[brief ${tag}] ${sel} fits at BODY 21: ${JSON.stringify(f)}`);
    }
  };

  // ---- 2. by day, at both sizes: the weather in words with its source, the commute's one path, the headlines down then back, the chat
  const todo = { 'ghosty.agenda.todo': JSON.stringify([{ id: 'b1', text: 'Post the parcel', due: H.today(), done: false, at: 1 }]) };
  for (const vp of [H.PHONE, H.PHONE2]) {
    const { ctx, page, bbc } = await brief(vp, 'scan', 8, todo);
    const wx = await txt(page, '#pg-brief .pn.wx');
    check(/TODAY\s*0°C → 8°C/i.test(wx) && /RAIN\s*Likely from 15:00 · 70%/i.test(wx), `[brief ${vp.width}] by day the card starts with TODAY and RAIN: ${wx.slice(0, 200)}`);
    check(/WEAR\s*A warm coat, hat and gloves, and an umbrella/i.test(wx), `[brief ${vp.width}] WEAR from the forecast: ${wx.slice(0, 300)}`);
    check(/SUN\s*Sunrise 07:25 · sunset 16:17/i.test(wx) && !/[↑↓]/.test(wx), `[brief ${vp.width}] SUN in words: ${wx.slice(0, 400)}`);
    const wst = await txt(page, '#pg-brief .pn.wx .pst, #pg-brief .pn.wx h3');
    check(/OPEN-METEO · \d\d:\d\d/i.test(wst), `[brief ${vp.width}] the weather names its source and time: ${wst}`);
    const say = await txt(page, '#pg-brief .hero .brsay');
    check(/^0 to 8°C today, rain likely from 15:00\./.test(say) && /1 to-do due today/.test(say), `[brief ${vp.width}] the morning's sentence: ${say}`);
    // the commute: one place to save home and work, the same words as Foresight's, and the tap lands on it
    const com = await txt(page, '#pg-brief .pn.commute');
    check(/Save home and work in Memory → ME → PLACES and the drive to work shows here\./.test(com) && !/each morning/.test(com), `[brief ${vp.width}] the commute's line: ${com}`);
    const fore = await txt(page, '#pg-brief .pn.foresight');
    check(!/Memory → Me → Places/.test(fore + com), `[brief ${vp.width}] one spelling of the path: ${fore.slice(0, 200)}`);
    // the headlines down: in his words, with TRY AGAIN; back: the BBC named with its time
    await page.waitForSelector('#pg-brief .pn.news .brnewsdown', { timeout: 15000 }).catch(() => undefined);
    const down = await txt(page, '#pg-brief .pn.news');
    check(/CAN’T REACH THE BBC/i.test(down) && /isn’t answering/.test(down) && /TRY AGAIN/i.test(down) && !H.RAW.test(down) && !/NO FEED/.test(down), `[brief ${vp.width}] the headlines down say so with a way on: ${down.slice(0, 300)}`);
    await fits(page, `${vp.width} morning`);
    if (vp === H.PHONE) await page.screenshot({ path: `${H.out}/planlane-brief-morning-${vp.width}.png`, fullPage: true });
    bbc.up = true;
    await page.click('#pg-brief .pn.news button.brnewsagain');
    await page.waitForFunction(() => /Brief lane story 1/.test(document.querySelector('#pg-brief .pn.news')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => check(false, `[brief ${vp.width}] TRY AGAIN did not bring the headlines back`));
    const back = await txt(page, '#pg-brief .pn.news');
    check(/BBC · \d\d:\d\d/i.test(back), `[brief ${vp.width}] the headlines name the BBC and the time they were read: ${back.slice(0, 160)}`);
    // the tap on the commute's line lands on Memory → ME, its PLACES on screen
    await page.click('#pg-brief .pn.commute .rw');
    await page.waitForFunction(() => location.hash === '#memory', null, { timeout: 8000 }).catch(() => check(false, `[brief ${vp.width}] the commute's line does not open Memory`));
    const places = await page.waitForSelector('#pg-memory .places', { state: 'visible', timeout: 8000 }).then(() => true, () => false);
    check(places, `[brief ${vp.width}] the tap lands where PLACES is on screen`);
    // the chat with no model: "good morning" opens the Brief and says its one line
    await H.chat(page, 'Good morning, Ghosty');
    const opened = await page.waitForFunction(() => document.body.dataset.tab === 'brief', null, { timeout: 15000 }).then(() => true, () => false);
    check(opened, `[brief ${vp.width}] "good morning" opens the Brief`);
    await page.evaluate(() => (location.hash = 'core'));
    const reply = await page.waitForFunction(() => {
      const t = [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? '';
      return /Good morning\./.test(t) ? t : '';
    }, null, { timeout: 15000 }).then((h) => h.jsonValue(), () => '');
    check(/Good morning\..*Partly cloudy, 4°C, 0 to 8°C today, rain likely from 15:00\..*1 to-do due today/.test(reply) && !H.RAW.test(reply), `[brief ${vp.width}] the chat says the Brief's one line: ${String(reply).slice(0, 300)}`);
    await ctx.close();
  }
  log('brief: by day, both sizes');

  // ---- 3. the evening: tonight, then tomorrow, in the card, the sentence and the chat
  {
    const { ctx, page } = await brief(H.PHONE, 'scan', 20);
    const wx = await txt(page, '#pg-brief .pn.wx');
    check(/TONIGHT\s*Likely now, easing by 23:00/i.test(wx) && /TOMORROW\s*2 to 9°C, dry/i.test(wx) && wx.search(/TONIGHT/i) < wx.search(/TOMORROW/i), `[brief evening] the card: tonight, then tomorrow: ${wx.slice(0, 260)}`);
    check(!/TODAY\s*0°C/i.test(wx), `[brief evening] today's range, gone by, is not first: ${wx.slice(0, 120)}`);
    check(/WEAR\s*Tomorrow: A warm coat/i.test(wx) && /SUN\s*Sunrise tomorrow 07:30 · sunset 16:15/i.test(wx), `[brief evening] what to wear tomorrow and tomorrow's sunrise: ${wx.slice(0, 400)}`);
    const say = await txt(page, '#pg-brief .hero .brsay');
    check(/^Rain likely now, easing by 23:00\. Tomorrow 2 to 9°C, dry\./.test(say) && !/for the rest of today/.test(say), `[brief evening] the sentence looks ahead, and says tonight, not "the rest of today": ${say}`);
    check(/^Good evening/.test(await txt(page, '#pg-brief .brdate')), '[brief evening] the greeting of the hour');
    await fits(page, '440 evening');
    await page.screenshot({ path: `${H.out}/planlane-brief-evening-440.png`, fullPage: true });
    await H.chat(page, "what's my day look like?");
    await page.waitForFunction(() => document.body.dataset.tab === 'brief', null, { timeout: 15000 }).catch(() => check(false, '[brief evening] "what\'s my day look like" does not open the Brief'));
    await page.evaluate(() => (location.hash = 'core'));
    const reply = await page.waitForFunction(() => {
      const t = [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? '';
      return /Good evening\./.test(t) ? t : '';
    }, null, { timeout: 15000 }).then((h) => h.jsonValue(), () => '');
    check(/Good evening\..*Tomorrow 2 to 9°C, dry/.test(reply), `[brief evening] the chat looks ahead too: ${String(reply).slice(0, 300)}`);
    await ctx.close();
  }
  log('brief: evening');

  // ---- 3b. the forecast unreachable (and nothing kept today): said in his words, with TRY AGAIN, and back when it answers
  {
    const wx = { up: false };
    const { ctx, page } = await brief(H.PHONE2, 'scan', 8, {}, wx);
    await page.waitForSelector('#pg-brief .pn.wx button.brwxagain', { timeout: 20000 }).catch(() => check(false, '[brief weather down] no TRY AGAIN on the weather card'));
    const down = await txt(page, '#pg-brief .pn.wx');
    check(/Open-Meteo, where the forecast comes from, isn’t answering/.test(down) && !H.RAW.test(down) && !/NO FEED/.test(down), `[brief weather down] the card says so in his words: ${down.slice(0, 200)}`);
    const f = await H.fit(page, '#pg-brief .pn.wx');
    check(!f.small.length && !f.sideways && !f.cut.length, `[brief weather down] the card fits: ${JSON.stringify(f)}`);
    wx.up = true;
    await page.click('#pg-brief .pn.wx button.brwxagain');
    await page.waitForSelector('#pg-brief .pn.wx .brwear', { timeout: 15000 }).catch(() => check(false, '[brief weather down] TRY AGAIN did not bring the forecast back'));
    await ctx.close();
  }
  log('brief: weather down');

  // ---- 4. the seven looks (390 wide, BODY 21): the card, the commute and the headlines' way on hold in every world
  for (const world of H.WORLDS) {
    const { ctx, page } = await brief(H.PHONE2, world, 8);
    await page.waitForSelector('#pg-brief .pn.news .brnewsdown', { timeout: 15000 }).catch(() => undefined);
    await fits(page, world);
    const c = await page.$eval('#pg-brief .pn.wx .brwear', (r) => {
      const t = r.querySelector('b, span, .v') ?? r;
      return { color: getComputedStyle(t).color, bg: getComputedStyle(document.body).backgroundColor };
    }).catch(() => null);
    check(c && c.color !== c.bg, `[brief ${world}] WEAR is drawn in a colour of the look: ${JSON.stringify(c)}`);
    if (world === 'ink' || world === 'glass') await page.screenshot({ path: `${H.out}/planlane-brief-${world}.png` });
    await ctx.close();
  }
  log('brief: seven looks');
}
