// THE LENS THAT KNOWS ITS JOB (FINAL-LENS), at 440 × 956 and 390 × 844. The owner points it and it does the job: every job proved on
// fixture frames (the page's own camera plays colour bars; the one view's fixture feed, window.__ghosty.oneFeed, puts what a frame
// holds in front of it: the words the reader read, a code, a thing with how sure, a face).
//   COLOUR   the picture is in true colour in all seven looks: the colour on screen is the camera's own (no grey filter, no wash)
//   STATES   the eyes not on the phone (the offer with its size, on Wi-Fi, never fetched without his tap), no signal: each in his words
//            (looking and waking the eyes need the eyes downloaded: lens.spec and offlineeyes prove those)
//   TEXT     read aloud, copied; its date ADD TO AGENDA (and UNDO), its number CALL, its address ON THE MAP, its link OPEN, its email WRITE
//   A SUM    solved and shown worked; an equation too
//   A SIGN   in French: said to be French, translated by itself, the request carrying the words and no picture
//   A BILL   the letter card, the plate's REMIND and FILE, and ADD TO MY BILLS (HOME keeps it, with its reminder)
//   A BUSINESS CARD  "add them to my contacts": a vCard made on the phone with the card's details; nobody looked up
//   A BUS STOP  "when's the next bus": the times by the stop's name on its sign, never where he is
//   A MEDICINE  its public NHS page on "open the NHS page", nothing sent before, never advice
//   A RATING PLATE  what an hour costs at 25p, then at his price kept on this phone; "what does it cost to run" says it
//   COMPARE  a second packet: "which is better" puts the two side by side per 100 g, the better figure marked
//   A RECEIPT  one tap into this month's spending (the month's rows hold it), one more keeps its warranty
//   UNNAMED  a Polish sign: TRANSLATE offered (the phone cannot name the language), done in place, the words sent once
//   PRINT    a parcel number to Royal Mail's page, 350°F in Celsius, two prices in pounds on his tap (today's public rate)
//   A MENU   in French: each line's English laid over that line, the card listing every line, the words only sent
//   AVOID    "I'm allergic to milk" lights the packet red; the WHAT I AVOID sheet adds peanuts; kept on this phone
//   A PAGE   SCAN IT FLAT opens SCAN's document part on the frame
//   PRODUCT  a shop barcode looked up on the open product databases through the brain: its grade, figures per 100 g and allergens;
//            a QR link opened; a Wi-Fi code's password copied
//   A THING  named with how sure; MEASURE IT opens the measure
//   LIVING   a robin: one tap on WHICH SPECIES names it European robin, Erithacus rubecula (the free model that sees), on his tap only
//   A PLACE  a clock tower: WHAT PLACE IS THIS names it (the free model that sees) with its encyclopedia summary
//   VOICE    "call that number" and "solve that" do the cards' jobs by his words
//   FACES    someone he introduced by the name he gave; a stranger said plainly, never named
//   LAYOUT   every key 44 pt both ways, nothing sideways, no card's words cut
// The bar keeps its four keys (START, FLIP, FREEZE as the shutter, MORE for "do something else instead").
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { UK } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-fake-ui-for-media-stream'] });
const problems = [];
const check = (ok, msg) => {
  if (!ok) problems.push(msg);
};

/** The page's own camera: six bars of strong colour, moving a little every frame (never steady, so no reader runs on it). */
function colourCamera() {
  const cv = document.createElement('canvas');
  cv.width = 640;
  cv.height = 480;
  const g = cv.getContext('2d');
  const bars = ['#e0302a', '#f0a020', '#e8e030', '#30b040', '#2a60e0', '#a040c0'];
  let n = 0;
  const draw = () => {
    n++;
    bars.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(i * 107 + (n % 6) - 3, 0, 110, 480);
    });
  };
  draw();
  setInterval(draw, 100);
  const stream = cv.captureStream(10);
  navigator.mediaDevices.getUserMedia = () => new Promise((ok) => setTimeout(() => ok(stream), 300));
  window.__spoke = [];
  const synth = window.speechSynthesis;
  if (synth) {
    synth.speak = (u) => void window.__spoke.push(u.text);
    synth.cancel = () => undefined;
  }
  // (a link a card opens is noted, not followed: the spec stays on the Lens)
  window.__opened = [];
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a.lc-link');
    if (a) {
      window.__opened.push(a.getAttribute('href'));
      e.preventDefault();
    }
  }, true);
}

const LOOKS = ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass'];

async function run(viewport, all) {
  const T = `[${viewport.width}]`;
  const ctx = await browser.newContext({ viewport, ...UK, deviceScaleFactor: 1, isMobile: true, hasTouch: true, permissions: ['camera', 'clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${T} pageerror: ${e.message}`));
  await page.addInitScript(colourCamera);
  // the open product databases and the encyclopedia, as fixtures (the brain's own routes, answered here so no outside call is made)
  // (lens.u8) a second packet, to put side by side with the first
  await page.route('**/api/lookup/barcode?code=5012345678900', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: '5012345678900', kind: 'product', source: 'Open Food Facts', credit: 'Open Food Facts, ODbL', title: 'Oat bars', brand: 'Fixture Mill', quantity: '5 x 30 g', nutriscore: 'b', nutrition: { kcal: 410, sugars: 12, fat: 10.5, saturates: 2.1, salt: 0.2, protein: 8.4 }, allergens: ['gluten', 'oats'] }) }));
  await page.route('**/api/lookup/barcode?code=5000159484695', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: '5000159484695', kind: 'product', source: 'Open Food Facts', credit: 'Open Food Facts, ODbL', title: 'Digestive biscuits', brand: 'Fixture Bakery', quantity: '400 g', nutriscore: 'e', nutrition: { kcal: 474, sugars: 16.6, fat: 20.9, saturates: 9.6, salt: 0.95, protein: 7.1 }, allergens: ['gluten', 'milk'] }) }));
  // the map's geocoder (through the brain's proxy) answers with the address's place; nothing else outside is reached
  await page.route('**/api/proxy?**', (r) => {
    const target = new URL(r.request().url()).searchParams.get('url') ?? '';
    // (the sweep) today's rates for IN POUNDS: per bitcoin, as the public feed gives them (so €1 = £50000/58000)
    if (/api\.coingecko\.com\/api\/v3\/exchange_rates/.test(target)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ rates: { btc: { value: 1 }, gbp: { value: 50000 }, eur: { value: 58000 }, usd: { value: 64000 } } }) });
    if (/nominatim\.openstreetmap\.org\/search/.test(target)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ lat: '52.4797', lon: '-1.9026', display_name: '12 High Street, Birmingham, B1 1AA, England' }]) });
    return r.fulfill({ status: 404, body: '' });
  });
  // what the Lens sends to the brain, kept to check that a sign's translation carries its words and never a picture
  const chats = [];
  page.on('request', (q) => {
    if (q.method() === 'POST' && /\/api\/chat$/.test(new URL(q.url()).pathname)) chats.push(q.postData() ?? '');
  });
  // (lens.u1) a menu's line-for-line translation, answered here: one English line for each line; every other chat goes on to the brain
  await page.route('**/api/chat', (r) => {
    const b = r.request().postData() ?? '';
    // (lens.s7) the next buses from the stop the sign names, as the brain's free timetables would answer
    // (the sweep) a Polish sign, a language the phone cannot name: put into English when he asks
    if (/Wyj/.test(b) && /Translate this into English/.test(b)) return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: [{ t: 'text', text: 'Emergency exit. Do not block the door.' }, { t: 'done', model: 'mock' }].map((e) => JSON.stringify(e)).join('\n') + '\n' });
    if (/next buses from Oxford Circus/.test(b)) return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: [{ t: 'text', text: 'Next departures from Oxford Circus:\n25 to Holborn — 2 min\nN8 to Hainault — 6 min\n73 to Stoke Newington — 9 min' }, { t: 'done', model: 'mock' }].map((e) => JSON.stringify(e)).join('\n') + '\n' });
    if (!/Translate each line into English/.test(b)) return r.continue();
    return r.fulfill({ status: 200, contentType: 'application/x-ndjson', body: [{ t: 'text', text: 'STARTERS\nSoup of the day\nNiçoise salad\nMAINS\nBeef bourguignon' }, { t: 'done', model: 'mock' }].map((e) => JSON.stringify(e)).join('\n') + '\n' });
  });
  await page.route('**/api/aim/about?title=*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: 'Big Ben', extract: 'Big Ben is the nickname for the Great Bell of the Great Clock of Westminster, at the north end of the Palace of Westminster in London.', url: 'https://en.wikipedia.org/wiki/Big_Ben' }) }));
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'lens'));
  await page.waitForSelector('#pg-lens .lensbar', { timeout: 15000 });
  // (polled on a timer, not on animation frames: God's Eye's globe, drawn in software on CI, can hold the frames for seconds)
  const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms, polling: 100 }).then(() => true).catch(() => (problems.push(`${T} ${what}`), false));

  // ---- STATES before anything: the eyes are not on the phone: the offer, with its size, on Wi-Fi, done on his tap only
  const offer = ((await page.locator('#pg-lens .lensknow .lensget').textContent().catch(() => '')) ?? '').trim();
  check(/GET THE EYES/.test(offer) && /18 MB/.test(offer) && /WI-FI/.test(offer), `${T} [states] the pack offer says "${offer}": want GET THE EYES with its size, on Wi-Fi`);
  check((await page.evaluate(() => window.__ghosty.one.finder)) === 'off', `${T} [states] the eyes started downloading without his tap`);
  // on mobile data his tap does not start the download: it waits for Wi-Fi, and says so
  await page.evaluate(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { type: 'cellular', saveData: false, addEventListener() {}, removeEventListener() {} } }));
  await page.locator('#pg-lens .lensknow .lensget').click();
  await page.waitForTimeout(300);
  check((await page.evaluate(() => window.__ghosty.one.finder)) === 'off' && /wait for Wi-Fi: you’re on mobile data/.test(await page.evaluate(() => window.__ghosty.one.stepSaid)), `${T} [states] on mobile data GET THE EYES started (${await page.evaluate(() => window.__ghosty.one.finder)}) or said "${await page.evaluate(() => window.__ghosty.one.stepSaid)}"`);
  await page.evaluate(() => delete navigator.connection);
  if ((await page.evaluate(() => window.__ghosty.lens.camera)) !== 'on') {
    if ((await page.evaluate(() => window.__ghosty.lens.camera)) === 'off') await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
  }
  await until(() => window.__ghosty.lens.camera === 'on' && document.querySelector('#pg-lens video')?.videoWidth > 0, null, 20000, '[camera] the camera did not open');
  const bar = await page.evaluate(() => [...document.querySelectorAll('#pg-lens .lensbar button')].filter((b) => !b.hidden && b.offsetParent !== null).map((b) => b.textContent.trim()));
  check(bar.join(',') === 'STOP,FLIP,FREEZE,MORE', `${T} [keys] the bar is ${JSON.stringify(bar)}: want STOP, FLIP, FREEZE, MORE and no more`);

  // ---- COLOUR: what is on screen is the camera's own colour, in every look (the cause was a grey filter over the video)
  const colourOf = async () => {
    const r = await page.evaluate(() => {
      const v = document.querySelector('#pg-lens .lensview video').getBoundingClientRect();
      return { x: v.left + v.width * 0.1, y: v.top + v.height * 0.35, width: v.width * 0.8, height: v.height * 0.3 };
    });
    const png = (await page.screenshot({ clip: r })).toString('base64');
    return page.evaluate(async (src) => {
      const img = new Image();
      img.src = `data:image/png;base64,${src}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let sat = 0;
      let n = 0;
      for (let i = 0; i < d.length; i += 16) {
        const mx = Math.max(d[i], d[i + 1], d[i + 2]);
        const mn = Math.min(d[i], d[i + 1], d[i + 2]);
        sat += mx ? (mx - mn) / mx : 0;
        n++;
      }
      // the camera's own frame, drawn straight from the stream: what the screen should match
      const v = document.querySelector('#pg-lens video');
      const s = document.createElement('canvas');
      s.width = 160;
      s.height = 120;
      const sg = s.getContext('2d');
      sg.drawImage(v, 0, 0, 160, 120);
      const e = sg.getImageData(0, 0, 160, 120).data;
      let src2 = 0;
      let m = 0;
      for (let i = 0; i < e.length; i += 16) {
        const mx = Math.max(e[i], e[i + 1], e[i + 2]);
        const mn = Math.min(e[i], e[i + 1], e[i + 2]);
        src2 += mx ? (mx - mn) / mx : 0;
        m++;
      }
      return { screen: Math.round((sat / n) * 100) / 100, camera: Math.round((src2 / m) * 100) / 100, filter: getComputedStyle(v).filter };
    }, png);
  };
  for (const look of all ? LOOKS : ['scan', 'glass']) {
    // the look changed, then two frames painted with it (the real condition: what is measured is what the screen shows in that look)
    await page.evaluate((w) => new Promise((ok) => { document.documentElement.dataset.world = w; requestAnimationFrame(() => requestAnimationFrame(() => ok())); }), look);
    const c = await colourOf();
    check(c.filter === 'none', `${T} [colour ${look}] the video has a filter: ${c.filter}`);
    check(c.screen >= 0.6 && c.screen >= c.camera * 0.85, `${T} [colour ${look}] the picture is greyed: on screen ${c.screen}, the camera's own ${c.camera} (want true colour)`);
    if (look === 'scan' && viewport.width === 440) await page.screenshot({ path: `${out}/lens2-colour.png` });
  }
  await page.evaluate(() => (document.documentElement.dataset.world = 'scan'));

  const feed = (fn, arg) => page.evaluate(fn, arg);
  const cards = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.cards)));
  const keyIn = (job, word) => page.locator(`#pg-lens .lenscard[data-job="${job}"] .lc-keys > *`, { hasText: word }).first();
  const backToLens = async () => {
    await page.evaluate(() => window.__ghosty.lens.setMode('lens'));
    await until(() => window.__ghosty.lens.mode === 'lens', null, 5000, '[back] the Lens did not come back to the one view');
  };
  const reset = () => feed(() => { const f = window.__ghosty.oneFeed; for (const k of ['text', 'code', 'object', 'face', 'stranger']) f.drop(k); });
  /** Keep what the fixture frame holds in view (a tag lives two seconds after its last sighting). */
  const hold = (sightings) => feed((s) => { clearInterval(window.__hold); const f = () => window.__ghosty.oneFeed.see(s); f(); window.__hold = setInterval(f, 400); }, sightings);
  const letGo = () => feed(() => clearInterval(window.__hold));
  const TEXT_BOX = { kind: 'text', box: { x: 32, y: 48, w: 576, h: 240 }, score: 0.95, truth: 'I see text — tap to read it' };
  const words = (w, big = false) => feed(([w, b]) => window.__ghosty.oneFeed.text(w, b), [w, big]);

  // ---- STATES: no signal, said in his words, with nothing in view
  await feed(() => window.__ghosty.oneFeed.online(false));
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'nothing' && /No signal/.test(c.line)), null, 4000, '[states] with no signal and nothing in view, no card says so');
  await layout('no signal');
  await feed(() => window.__ghosty.oneFeed.online(true));

  // ---- TEXT: an event notice; read aloud, copied, and each thing in it acted on
  const notice = 'Quiz Night at the Village Hall\nFriday 4 December 2026, doors at 7\nTickets: call 0121 496 0123\nwww.example.org\n12 High Street\nBirmingham B1 1AA\nhello@example.org';
  await words(notice);
  await hold([TEXT_BOX]);
  await until(() => ['date', 'phone', 'link', 'address', 'email'].every((j) => window.__ghosty.cards.cards.some((c) => c.job === j)), null, 4000, `[text] the cards for the notice are missing: ${JSON.stringify((await cards()).cards.map((c) => c.job))}`);
  let cs = await cards();
  check(cs.jobs[0] === 'text', `${T} [text] the job for the notice is ${cs.jobs[0]}`);
  check(cs.cards.find((c) => c.job === 'date')?.head === 'A DATE · 4 DECEMBER 2026', `${T} [text] the date card says ${cs.cards.find((c) => c.job === 'date')?.head}`);
  await keyIn('text', 'READ ALOUD').click();
  await until(() => window.__spoke.some((t) => /Quiz Night/.test(t)), null, 3000, '[text] READ ALOUD said nothing');
  await keyIn('text', 'COPY').click();
  await until(() => /copied/i.test(window.__ghosty.cards.done), null, 3000, '[text] COPY did not copy');
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check(/Quiz Night/.test(clip), `${T} [text] the clipboard holds "${clip.slice(0, 40)}"`);
  await keyIn('date', 'ADD TO AGENDA').click();
  await until(() => /In your agenda for 4 December 2026/.test(window.__ghosty.cards.done), null, 20000, `[date] ADD TO AGENDA did not put it in the agenda: ${(await cards()).done}`);
  // (the sweep) a misread date is taken back: UNDO takes it out of the agenda, and the card offers it again
  await page.locator('.undofloat button', { hasText: 'UNDO' }).click({ timeout: 5000 }).catch(() => problems.push(`${T} [date] no UNDO after ADD TO AGENDA`));
  await until(() => /^taken out of your agenda: .*4 December 2026/.test(window.__ghosty.cards.done), null, 10000, `[date] UNDO did not take it out: ${(await cards()).done}`);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'date' && c.keys.includes('ADD TO AGENDA')), null, 4000, '[date] after UNDO the card does not offer ADD TO AGENDA again');
  const call = await keyIn('phone', 'CALL').getAttribute('href');
  check(call === 'tel:01214960123', `${T} [phone] CALL dials ${call}`);
  await keyIn('link', 'OPEN').click();
  check((await page.evaluate(() => window.__opened)).includes('https://www.example.org/'), `${T} [link] OPEN did not open https://www.example.org/`);
  check((await keyIn('email', 'WRITE').getAttribute('href')) === 'mailto:hello@example.org', `${T} [email] WRITE does not write to hello@example.org`);
  // by his words, with the Lens on screen: "call that number" calls it
  await page.evaluate(() => window.__ghosty.send('call that number'));
  await until(() => window.__opened.includes('tel:01214960123'), null, 5000, '[voice] "call that number" did not call it');
  await layout('text');
  await page.screenshot({ path: `${out}/lens2-text-${viewport.width}.png`, fullPage: false });
  await keyIn('address', 'ON THE MAP').click();
  // (the tap itself hands the address to the map, before anything loads: read straight after it)
  const mapAct = await page.evaluate(() => window.__ghosty.cards.done);
  check(/^map: 12 High Street, Birmingham B1 1AA/.test(mapAct), `${T} [address] ON THE MAP did not take the address to the map: the last act was "${mapAct}"`);
  await letGo();
  // the map opens on the place (God's Eye, the map sheet titled with it)
  await until(() => !!document.querySelector('.modal .mapsheet') && /BIRMINGHAM/i.test(document.querySelector('.modal .mbox')?.getAttribute('aria-label') ?? ''), null, 15000, `[address] the map did not open on the address: ${await page.evaluate(() => document.querySelector('.modal .mbox')?.getAttribute('aria-label') ?? 'no sheet')}`);
  await page.locator('.modal .mhead button', { hasText: 'CLOSE' }).first().click();
  await until(() => !document.querySelector('.modal .mapsheet'), null, 5000, '[address] the map sheet did not close');
  // back to the Lens, as he would: the camera opens from his tap (START, when the tab did not open it)
  await page.evaluate(() => (location.hash = 'lens'));
  await until(() => window.__ghosty.lens.mode === 'lens' && !!window.__ghosty.oneFeed && document.querySelector('#pg-lens .lensbar')?.offsetParent !== null, null, 15000, '[back] the Lens did not come back after the map');
  if ((await page.evaluate(() => window.__ghosty.lens.camera)) === 'off') await page.locator('#pg-lens .lensbar button', { hasText: 'START' }).click();
  await until(() => window.__ghosty.lens.camera === 'on', null, 20000, '[back] the camera did not open again after the map');
  await reset();

  // ---- A SUM: solved and shown worked; an equation too
  await words('12 + 7 × 3 =\n2x + 3 = 11');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.cards.filter((c) => c.job === 'sum').length === 2, null, 4000, '[sum] the two sums were not solved');
  const sums = await page.evaluate(() => [...document.querySelectorAll('#pg-lens .lenscard[data-job="sum"]')].map((c) => ({ steps: [...c.querySelectorAll('.lc-steps li')].map((l) => l.textContent), answer: c.querySelector('.lc-answer')?.textContent })));
  check(sums[0]?.steps.join(' | ') === '7 × 3 = 21 | 12 + 21 = 33' && sums[0]?.answer === '= 33', `${T} [sum] 12 + 7 × 3 worked as ${JSON.stringify(sums[0])}`);
  check(sums[1]?.steps.join(' | ') === '2x = 11 − 3 = 8 | x = 8 ÷ 2 = 4' && sums[1]?.answer === 'x = 4', `${T} [sum] 2x + 3 = 11 worked as ${JSON.stringify(sums[1])}`);
  // "solve that": the working, said
  await page.evaluate(() => window.__ghosty.send('solve that'));
  await until(() => /^7 × 3 = 21; 12 \+ 21 = 33\. So it’s 33\.$/.test(window.__ghosty.one.said), null, 5000, `[voice] "solve that" said "${await page.evaluate(() => window.__ghosty.one.said)}"`);
  await layout('sum');
  await letGo();
  await reset();

  // ---- A SIGN in French: said to be French, its English by itself (the words only)
  await words('SORTIE DE SECOURS\nNe pas bloquer cette issue');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'text' && /FRENCH/.test(c.head)), null, 4000, `[sign] the French sign's card does not say FRENCH: ${JSON.stringify((await cards()).cards.map((c) => c.head))}`);
  await until(() => window.__ghosty.one.translate.runs >= 1, null, 8000, '[sign] the French words were not sent to be translated');
  const sent = chats.filter((b) => /SORTIE DE SECOURS/.test(b));
  check(sent.length >= 1, `${T} [sign] no request carried the sign's words`);
  check(sent.every((b) => !/data:image|"images":\s*\[/.test(b)), `${T} [sign] the translation request carried a picture`);
  await layout('sign');
  await letGo();
  await reset();

  // ---- A SIGN in a language the phone cannot name (the sweep): TRANSLATE offered, done in place, the words only, once
  await words('Wyjście ewakuacyjne\nNie blokować drzwi');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'text' && c.head === 'TEXT' && c.keys.includes('TRANSLATE')), null, 4000, `[unnamed] a Polish sign has no TRANSLATE: ${JSON.stringify((await cards()).cards.map((c) => [c.head, c.keys]))}`);
  check(!chats.some((b) => /Wyj/.test(b)), `${T} [unnamed] the words went before he asked: ${JSON.stringify(await page.evaluate(() => window.__ghosty.one.translate))}`);
  await keyIn('text', 'TRANSLATE').click({ timeout: 5000 }).catch(async () => problems.push(`${T} [unnamed] no TRANSLATE to tap: ${JSON.stringify(await page.evaluate(() => ({ cards: window.__ghosty.cards.cards, ocr: window.__ghosty.one.ocr, tr: window.__ghosty.one.translate })))}`));
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'text' && c.head === 'TEXT · IN ENGLISH' && /^Emergency exit\. Do not block the door\./.test(c.line)), null, 8000, `[unnamed] the English is not on the card: ${JSON.stringify((await cards()).cards.map((c) => [c.head, c.line]))}`);
  const polish = chats.filter((b) => /Wyj/.test(b));
  check(polish.length === 1 && !/data:image/.test(polish[0]), `${T} [unnamed] the Polish went ${polish.length} time(s), and no picture: ${!/data:image/.test(polish[0] ?? '')}`);
  check((await page.evaluate(() => window.__ghosty.lens.mode)) === 'lens', `${T} [unnamed] TRANSLATE left the one view for ${await page.evaluate(() => window.__ghosty.lens.mode)}`);
  await letGo();
  await reset();

  // ---- PRINT HE CAN USE (the sweep, as Live Text does): a parcel to track, a temperature in Celsius, prices in pounds on his tap
  await words('Parcel AB123456789GB\nBake at 350°F\nDinner €14,50 or US$20');
  await hold([TEXT_BOX]);
  await until(() => ['parcel', 'unit', 'price'].every((j) => window.__ghosty.cards.cards.some((c) => c.job === j)), null, 4000, `[print] the cards: ${JSON.stringify((await cards()).cards.map((c) => [c.job, c.head]))}`);
  const pc = (await cards()).cards;
  check(pc.some((c) => c.job === 'parcel' && c.head === 'A PARCEL · AB123456789GB' && c.keys.includes('TRACK')), `${T} [print] the parcel card: ${JSON.stringify(pc.filter((c) => c.job === 'parcel'))}`);
  check((await keyIn('parcel', 'TRACK').getAttribute('href')) === 'https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB', `${T} [print] TRACK does not open Royal Mail's page for it`);
  check(pc.some((c) => c.job === 'unit' && c.line === '350°F ≈ 177 °C'), `${T} [print] the measure: ${JSON.stringify(pc.filter((c) => c.job === 'unit'))}`);
  check(pc.some((c) => c.job === 'price' && c.head === '2 PRICES · EUR, USD' && c.keys.includes('IN POUNDS')), `${T} [print] the prices: ${JSON.stringify(pc.filter((c) => c.job === 'price'))}`);
  await layout('print');
  await keyIn('price', 'IN POUNDS').click();
  await until(() => window.__ghosty.cards.pounds.join(' · ') === '€14,50 ≈ £12.50 · US$20 ≈ £15.63', null, 8000, `[print] IN POUNDS gave ${JSON.stringify((await cards()).pounds)}`);
  await letGo();
  await reset();

  // ---- A MENU in French (lens.u1): each line's English laid over that line, and the card lists each line with its English
  await words('ENTREES\nSoupe du jour\nSalade niçoise\nPLATS\nBoeuf bourguignon');
  await hold([{ ...TEXT_BOX, box: { x: 32, y: 48, w: 576, h: 300 } }]);
  await until(() => window.__ghosty.one.lines.english.length === 5 && window.__ghosty.one.lines.drawn === 5, null, 10000, `[menu] the menu was not laid over line by line: ${JSON.stringify(await page.evaluate(() => window.__ghosty.one.lines))}`);
  await until(() => window.__ghosty.cards.cards.some((c) => c.head === 'A MENU · FRENCH · 5 LINES IN ENGLISH'), null, 4000, `[menu] the menu card: ${JSON.stringify((await cards()).cards.map((c) => c.head))}`);
  const overlay = await page.evaluate(() => [...document.querySelectorAll('#pg-lens .lensline')].map((e) => ({ t: e.textContent, r: e.getBoundingClientRect() })));
  check(overlay.map((o) => o.t).join('|') === 'STARTERS|Soup of the day|Niçoise salad|MAINS|Beef bourguignon', `${T} [menu] the lines laid over read ${JSON.stringify(overlay.map((o) => o.t))}`);
  check(overlay.every((o, i) => i === 0 || o.r.top > overlay[i - 1].r.top), `${T} [menu] the English lines are not in the menu's order down the picture`);
  check((await page.evaluate(() => document.querySelector('#pg-lens .lensplate')?.hidden ?? true)), `${T} [menu] the plate stands over the menu's own English`);
  const asked = chats.filter((b) => /Translate each line into English/.test(b));
  check(asked.length >= 1 && asked.every((b) => !/data:image|"images":\s*\[/.test(b)), `${T} [menu] the menu went line for line ${asked.length} time(s), and no picture: ${asked.every((b) => !/data:image/.test(b))}`);
  await layout('menu');
  await letGo();
  await reset();

  // ---- A BILL: the letter card and the plate's REMIND and FILE
  const due = new Date(Date.now() + 30 * 86_400_000).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/London' });
  await words(`BRITISH GAS\nYour balance is £84.20.\nPlease pay by ${due}.\nReference 4471 2290`);
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.jobs[0] === 'letter', null, 4000, `[bill] the job for a bill is ${(await cards()).jobs[0]}`);
  await until(() => [...document.querySelectorAll('#pg-lens .lensplate button')].map((b) => b.textContent.trim()).join(',').includes('REMIND'), null, 4000, '[bill] the plate does not offer REMIND');
  check((await page.locator('#pg-lens .lensplate button', { hasText: 'FILE' }).count()) === 1, `${T} [bill] the plate does not offer FILE`);
  await layout('letter');
  // (lens.c1, money.c3) the bill into his bills, with its reminder: HOME's own reading of it answers
  check((await cards()).cards.some((c) => c.job === 'letter' && c.head === 'A BILL'), `${T} [bill] the card is not headed A BILL: ${JSON.stringify((await cards()).cards.map((c) => c.head))}`);
  await keyIn('letter', 'ADD TO MY BILLS').click();
  await until(() => /^bill: /.test(window.__ghosty.cards.done), null, 10000, `[bill] ADD TO MY BILLS did not keep the bill: ${(await cards()).done}`);
  check(/British Gas|BRITISH GAS/i.test((await cards()).done) && /84\.20/.test((await cards()).done), `${T} [bill] HOME kept "${(await cards()).done.slice(0, 160)}"`);
  await letGo();
  await reset();

  // ---- A RECEIPT (lens.c1): one tap into this month's spending, by the rules alone; one more keeps its warranty
  const pence = String(10 + (Date.now() % 89)).padStart(2, '0');
  const total = `${viewport.width === 440 ? 4 : 6}.${pence}`;
  await words(`TESCO EXTRA\nKettle 1.7L 2.${pence}\nBread 1.10\nApples 0.80\nTOTAL ${total}\nVISA CONTACTLESS\nCHANGE 0.00\nThank you`);
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.jobs[0] === 'receipt', null, 4000, `[receipt] the job for a receipt is ${(await cards()).jobs[0]}`);
  check((await cards()).cards.some((c) => c.job === 'receipt' && c.head === `A RECEIPT · TESCO EXTRA · £${total}`), `${T} [receipt] the card: ${JSON.stringify((await cards()).cards.map((c) => c.head))}`);
  await layout('receipt');
  await keyIn('receipt', 'INTO SPENDING').click();
  await until(() => window.__ghosty.cards.spent.state === 'added', null, 10000, `[receipt] INTO SPENDING did not add it: ${JSON.stringify((await cards()).spent)}`);
  check(new RegExp(`^In your spending: £${total.replace('.', '\\.')} at Tesco Extra, `).test((await cards()).spent.line), `${T} [receipt] said "${(await cards()).spent.line}"`);
  await until(() => !document.querySelector('#pg-lens .lenscard[data-job="receipt"] .lc-keys > button')?.textContent?.includes('INTO SPENDING'), null, 3000, '[receipt] INTO SPENDING is still offered for a receipt already in his spending');
  const month = await page.evaluate(() => fetch('/api/profile/spending', { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } }).then((r) => r.json()).catch(() => null));
  check(month?.rows?.some((r) => Math.abs(r.a + Number(total)) < 0.005 && /tesco/i.test(r.t)), `${T} [receipt] the month's spending has no £${total} at Tesco: ${JSON.stringify(month?.rows?.slice(-3) ?? month)}`);
  await keyIn('receipt', 'KEEP A WARRANTY').click();
  await until(() => /^warranty: /.test(window.__ghosty.cards.done), null, 10000, `[receipt] KEEP A WARRANTY did not keep one: ${(await cards()).done}`);
  check(/warranty/i.test((await cards()).done), `${T} [receipt] HOME said "${(await cards()).done.slice(0, 160)}"`);
  await letGo();
  await reset();

  // ---- A BUSINESS CARD (lens.s1): its details as printed, into his phone's contacts as a vCard made here; nobody looked up
  await words('Sarah J. Okafor\nSenior Project Manager\nBrightline Consulting Ltd\nT: 020 7946 0321\nsarah.okafor@brightline.co.uk\nwww.brightline.co.uk');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.jobs[0] === 'contact', null, 4000, `[contact] the job for a business card is ${(await cards()).jobs[0]}`);
  const bc = (await cards()).cards.find((c) => c.job === 'contact');
  check(bc?.head === 'A BUSINESS CARD · SARAH J. OKAFOR' && ['ADD TO CONTACTS', 'CALL', 'WRITE', 'COPY'].every((k) => bc.keys.includes(k)), `${T} [contact] the card: ${JSON.stringify(bc)}`);
  await layout('contact');
  const vcfFile = page.waitForEvent('download', { timeout: 6000 }).catch(() => null);
  await page.evaluate(() => window.__ghosty.send('add them to my contacts'));
  await until(() => !!window.__ghosty.cards.contact.state, null, 6000, `[contact] "add them to my contacts" made no contact: ${JSON.stringify((await cards()).contact)}`);
  const ct = (await cards()).contact;
  check(['saved', 'shared'].includes(ct.state) && /FN:Sarah J\. Okafor\r\n/.test(ct.vcf) && /TEL;TYPE=WORK:02079460321/.test(ct.vcf) && /EMAIL;TYPE=INTERNET:sarah\.okafor@brightline\.co\.uk/.test(ct.vcf), `${T} [contact] the vCard: ${JSON.stringify(ct)}`);
  if (ct.state === 'saved') check(/\.vcf$/.test((await vcfFile)?.suggestedFilename() ?? ''), `${T} [contact] no .vcf file was handed to the phone`);
  check(!chats.some((b) => /Okafor/.test(b)), `${T} [contact] the card's person went to the brain`);
  await letGo();
  await reset();

  // ---- A BUS STOP (lens.s7): the next buses by the stop's name on its sign, on his word; never where he is
  await words('Oxford Circus\nStop OB\n25 N8 73 390\ntowards Holborn\nText 47589 to 87287');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.jobs[0] === 'stop', null, 4000, `[stop] the job for a bus stop is ${(await cards()).jobs[0]}`);
  check((await cards()).cards.some((c) => c.job === 'stop' && c.head === 'A BUS STOP · OXFORD CIRCUS · STOP OB' && c.keys.includes('NEXT BUSES') && /Buses 25, N8, 73, 390 towards Holborn/.test(c.line)), `${T} [stop] the card: ${JSON.stringify((await cards()).cards.filter((c) => c.job === 'stop'))}`);
  await page.evaluate(() => window.__ghosty.send("when's the next bus"));
  await until(() => window.__ghosty.cards.buses.state === 'found', null, 10000, `[stop] "when's the next bus" did not bring the times: ${JSON.stringify((await cards()).buses)}`);
  await until(() => /25 to Holborn — 2 min/.test(document.querySelector('#pg-lens .lenscard[data-job="stop"] .lc-times')?.textContent ?? ''), null, 4000, '[stop] the times are not on the card');
  const askedBus = chats.filter((b) => /next buses from Oxford Circus/.test(b));
  check(askedBus.length === 1 && askedBus.every((b) => !/"lat"|"lon"|"latitude"|data:image/.test(b)), `${T} [stop] the stop went ${askedBus.length} time(s), by its name alone: ${askedBus.map((b) => b.slice(0, 200)).join(' | ')}`);
  await layout('stop');
  await letGo();
  await reset();

  // ---- A MEDICINE BOX (lens.s2): read aloud, its public NHS page on his word; nothing sent before, no advice ever
  await ctx.route('https://www.nhs.uk/**', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>NHS</title><p>NHS</p>' }));
  await words('Paracetamol 500mg Tablets\n16 tablets\nFor oral use\nRead the enclosed leaflet\nPL 12345/0001');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.jobs[0] === 'medicine', null, 4000, `[medicine] the job for a medicine box is ${(await cards()).jobs[0]}`);
  const med = (await cards()).cards.find((c) => c.job === 'medicine');
  check(med?.head === 'A MEDICINE · PARACETAMOL 500MG' && ['OPEN THE NHS PAGE', 'READ ALOUD', 'COPY'].every((k) => med.keys.includes(k)) && /I don’t give medical advice/.test(med.line), `${T} [medicine] the card: ${JSON.stringify(med)}`);
  check(await page.evaluate(() => document.querySelector('#pg-lens .lenscard[data-job="medicine"] a.lc-link')?.getAttribute('href') === 'https://www.nhs.uk/search/results?q=Paracetamol'), `${T} [medicine] OPEN THE NHS PAGE does not lead to the NHS's public search for it`);
  await layout('medicine');
  const nhsTab = ctx.waitForEvent('page', { timeout: 6000 }).catch(() => null);
  await page.evaluate(() => window.__ghosty.send('open the NHS page'));
  await until(() => window.__ghosty.cards.done === 'open the nhs page: https://www.nhs.uk/search/results?q=Paracetamol', null, 5000, `[medicine] "open the NHS page" did ${JSON.stringify((await cards()).done)}`);
  await (await nhsTab)?.close();
  check(!chats.some((b) => /Paracetamol/.test(b)), `${T} [medicine] the box went to the brain`);
  await letGo();
  await reset();

  // ---- A RATING PLATE (lens.s3): what an hour costs at his price, a first estimate; his price kept on this phone
  await words('Model HX200\n220-240V~ 50Hz\n1850-2200W\nMade in China');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.jobs[0] === 'rating', null, 4000, `[rating] the job for a rating plate is ${(await cards()).jobs[0]}`);
  const plate = (await cards()).cards.find((c) => c.job === 'rating');
  check(plate?.head === 'A RATING PLATE · 2.2 kW · 220-240 V' && /^About 55p an hour at full power, at 25p a unit \(kWh\): £2\.75 for five hours\. A first estimate/.test(plate.line) && plate.keys.includes('SET MY PRICE'), `${T} [rating] the card: ${JSON.stringify(plate)}`);
  await layout('rating');
  await keyIn('rating', 'SET MY PRICE').click();
  await page.waitForSelector('.modal .lc-price', { timeout: 5000 });
  await until(() => document.querySelector('.modal .mbox')?.getAnimations().every((a) => a.playState === 'finished') ?? false, null, 3000, '[rating] the sheet did not settle');
  const priceSmall = await page.evaluate(() => [...document.querySelectorAll('.modal .lc-price, .modal .lc-avoid button')].map((e) => e.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
  check(!priceSmall, `${T} [rating] ${priceSmall} control(s) on the price sheet under 44 pt`);
  await page.fill('.modal .lc-price', '30');
  await page.locator('.modal .lc-avoid button', { hasText: 'KEEP MY PRICE' }).click();
  await until(() => window.__ghosty.cards.cost.price === 30 && /^About 66p an hour at full power, at 30p a unit/.test(window.__ghosty.cards.cost.line), null, 4000, `[rating] his price did not cost the plate: ${JSON.stringify((await cards()).cost)}`);
  await page.evaluate(() => window.__ghosty.send('what does it cost to run'));
  await until(() => /^About 66p an hour at full power/.test(window.__ghosty.one.said), null, 5000, `[rating] "what does it cost to run" said "${await page.evaluate(() => window.__ghosty.one.said)}"`);
  await page.evaluate(() => localStorage.removeItem('ghosty.lens.kwh'));
  await letGo();
  await reset();

  // ---- A PAGE: scanned flat
  const page60 = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of the long page about the harbour and its boats`).join('\n');
  await words(page60);
  await hold([{ ...TEXT_BOX, box: { x: 16, y: 16, w: 608, h: 448 } }]);
  await until(() => window.__ghosty.cards.jobs[0] === 'document', null, 4000, `[page] the job for a full page is ${(await cards()).jobs[0]}`);
  await layout('page');
  await keyIn('document', 'SCAN IT FLAT').click();
  await until(() => window.__ghosty.lens.mode === 'scan', null, 5000, '[page] SCAN IT FLAT did not open SCAN');
  await letGo();
  await backToLens();
  await reset();

  // ---- A PRODUCT: a shop barcode looked up on the open databases; a QR code's link opened
  await hold([{ kind: 'code', box: { x: 200, y: 140, w: 240, h: 160 }, score: 0.95, truth: 'a code', data: { text: '5000159484695', format: 'ean_13', codeKind: 'product' } }]);
  await until(() => window.__ghosty.cards.product.state === 'found', null, 8000, `[product] the barcode was not looked up: ${JSON.stringify((await cards()).product)}`);
  cs = await cards();
  const prod = cs.cards.find((c) => c.job === 'product');
  // what a specialist food app shows: what it is, its grade, the figures per 100 g, the allergens, and whose data it is
  const want = 'Digestive biscuits · Fixture Bakery · 400 gNutri-Score EPer 100 g: 474 kcal · sugars 16.6 g MEDIUM · fat 20.9 g HIGH · saturates 9.6 g HIGH · salt 0.95 g MEDIUM · protein 7.1 gContains: gluten, milkFrom Open Food Facts (Open Food Facts, ODbL).';
  check(prod?.line === want, `${T} [product] the card says "${prod?.line}", want "${want}"`);
  await layout('product');
  // (lens.u7) what he avoids, by his words while the Lens is open: kept on this phone, and the packet gets its line
  check(prod?.keys.includes('WHAT I AVOID'), `${T} [avoid] the product card has no WHAT I AVOID: ${JSON.stringify(prod?.keys)}`);
  await page.evaluate(() => window.__ghosty.send("I'm allergic to milk"));
  await until(() => window.__ghosty.cards.verdict.tone === 'red', null, 6000, `[avoid] "I'm allergic to milk" did not light the packet red: ${JSON.stringify((await cards()).verdict)}`);
  check((await cards()).verdict.line === 'Not for you: it has milk.', `${T} [avoid] the line reads "${(await cards()).verdict.line}"`);
  check((await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.lens.avoid') ?? '[]'))).join(',') === 'milk', `${T} [avoid] the list is not kept on this phone`);
  // the list by its own sheet: every tick a 44 pt row; peanuts added, kept
  await keyIn('product', 'WHAT I AVOID').click();
  await page.waitForSelector('.modal .lc-avoid', { timeout: 5000 });
  await until(() => document.querySelector('.modal .mbox')?.getAnimations().every((a) => a.playState === 'finished') ?? false, null, 3000, '[avoid] the sheet did not settle');
  const tickSmall = await page.evaluate(() => [...document.querySelectorAll('.modal .lc-avoid .lc-tick, .modal .lc-avoid button')].map((e) => e.getBoundingClientRect()).filter((r) => r.width < 43.5 || r.height < 43.5).length);
  check(!tickSmall, `${T} [avoid] ${tickSmall} control(s) on the list under 44 pt`);
  check(await page.evaluate(() => document.querySelector('.modal input[data-avoid="milk"]')?.checked === true), `${T} [avoid] the sheet does not show milk ticked`);
  await page.locator('.modal input[data-avoid="peanuts"]').check();
  await page.locator('.modal .lc-avoid button', { hasText: 'KEEP THIS LIST' }).click();
  await until(() => JSON.parse(localStorage.getItem('ghosty.lens.avoid') ?? '[]').sort().join(',') === 'milk,peanuts', null, 4000, '[avoid] the sheet did not keep peanuts');
  await until(() => /^Not for you: it has milk\.$/.test(window.__ghosty.cards.verdict.line), null, 4000, `[avoid] after the sheet the line reads "${(await cards()).verdict.line}"`);
  await letGo();
  await reset();
  // (lens.u8) a second packet: COMPARE puts the two side by side per 100 g, the better figure marked, one line said
  await hold([{ kind: 'code', box: { x: 200, y: 140, w: 240, h: 160 }, score: 0.95, truth: 'a code', data: { text: '5012345678900', format: 'ean_13', codeKind: 'product' } }]);
  await until(() => window.__ghosty.cards.product.state === 'found' && window.__ghosty.cards.product.name === 'Oat bars', null, 8000, `[compare] the second packet was not looked up: ${JSON.stringify((await cards()).product)}`);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'product' && c.keys.includes('COMPARE')), null, 3000, `[compare] the second packet's card has no COMPARE: ${JSON.stringify((await cards()).cards.map((c) => c.keys))}`);
  await page.evaluate(() => window.__ghosty.send('which is better'));
  await page.waitForSelector('.modal .lc-compare', { timeout: 5000 });
  await until(() => document.querySelector('.modal .mbox')?.getAnimations().every((a) => a.playState === 'finished') ?? false, null, 3000, '[compare] the sheet did not settle');
  check((await cards()).compare.line === 'Oat bars has less sugar, fat, saturated fat and salt per 100 g.', `${T} [compare] the line reads "${(await cards()).compare.line}"`);
  const cmp = await page.evaluate(() => { const t = document.querySelector('.modal .lc-compare'); const box = document.querySelector('.modal .mbox'); return { rows: [...t.querySelectorAll('tbody tr')].map((r) => [...r.children].map((c) => c.textContent.trim()).join('|')), marked: t.querySelectorAll('td[data-better]').length, sideways: box.scrollWidth > box.clientWidth + 1, small: [...document.querySelectorAll('.modal .lc-avoid button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5; }).length }; });
  check(cmp.rows[0] === 'Nutri-Score|B ✓|E' && cmp.rows.includes('Sugars|12 g ✓|16.6 g') && cmp.rows.includes('Protein|8.4 g ✓|7.1 g') && cmp.marked === 7, `${T} [compare] the table: ${JSON.stringify(cmp.rows)} (${cmp.marked} marked)`);
  check(!cmp.sideways && !cmp.small, `${T} [compare] the sheet is sideways (${cmp.sideways}) or has ${cmp.small} small key(s)`);
  await page.locator('.modal .lc-avoid button', { hasText: 'DONE' }).click();
  await letGo();
  await reset();
  await hold([{ kind: 'code', box: { x: 200, y: 140, w: 200, h: 200 }, score: 0.95, truth: 'a code', data: { text: 'https://example.org/menu', format: 'qr_code', codeKind: 'url' } }]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'code' && c.head === 'A LINK CODE'), null, 4000, '[qr] the QR link has no card');
  await layout('qr');
  await keyIn('code', 'OPEN').click();
  check((await page.evaluate(() => window.__opened)).includes('https://example.org/menu'), `${T} [qr] OPEN did not open the QR code's link`);
  await letGo();
  await reset();
  // a Wi-Fi code: its network said, its password copied
  await hold([{ kind: 'code', box: { x: 200, y: 140, w: 200, h: 200 }, score: 0.95, truth: 'a code', data: { text: 'WIFI:T:WPA;S:HomeNet;P:secret123;;', format: 'qr_code', codeKind: 'wifi' } }]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'code' && c.head === 'A WI-FI CODE' && /^Network HomeNet · WPA/.test(c.line)), null, 4000, `[wifi] the Wi-Fi code's card: ${JSON.stringify((await cards()).cards)}`);
  await layout('wifi');
  await keyIn('code', 'COPY PASSWORD').click();
  await until(() => /copied the Wi-Fi password/i.test(window.__ghosty.cards.done), null, 3000, '[wifi] COPY PASSWORD did not copy');
  check((await page.evaluate(() => navigator.clipboard.readText().catch(() => ''))) === 'secret123', `${T} [wifi] the clipboard does not hold the password`);
  await letGo();
  await reset();
  // a link that looks wrong (a bare number, not encrypted) is OPEN ANYWAY, its warnings said, as SCAN's card does
  await hold([{ kind: 'code', box: { x: 200, y: 140, w: 200, h: 200 }, score: 0.95, truth: 'a code', data: { text: 'http://192.168.4.20/login', format: 'qr_code', codeKind: 'url' } }]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'code' && c.keys.includes('OPEN ANYWAY') && !c.keys.includes('OPEN') && /Careful: Not secure/.test(c.line)), null, 4000, `[qr risky] the risky link's card: ${JSON.stringify((await cards()).cards)}`);
  await layout('risky link');
  await letGo();
  await reset();

  // ---- A THING: named with how sure; MEASURE IT
  const thing = (label, score) => ({ kind: 'object', box: { x: 180, y: 120, w: 280, h: 240 }, score, truth: `looks like a ${label}`, data: { label, named: true } });
  await hold([thing('mug', 0.82)]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'thing' && c.head === 'A MUG' && /^82% sure/.test(c.line)), null, 4000, `[thing] the mug's card: ${JSON.stringify((await cards()).cards)}`);
  await layout('thing');
  await keyIn('thing', 'MEASURE IT').click();
  await until(() => window.__ghosty.lens.mode === 'measure', null, 5000, '[thing] MEASURE IT did not open the measure');
  await letGo();
  await backToLens();
  await page.evaluate(() => window.__ghosty.lens.frozen && document.querySelector('#pg-lens .lensbar button.on')?.click());
  await reset();

  // ---- A LIVING THING: the species, from the free model that sees, on his tap
  await hold([thing('robin', 0.78)]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'living' && c.head === 'A ROBIN · 78% SURE'), null, 4000, `[living] the robin's card: ${JSON.stringify((await cards()).cards.map((c) => c.head))}`);
  await layout('living');
  await keyIn('living', 'WHICH SPECIES').click();
  await until(() => window.__ghosty.lens.mode === 'name', null, 5000, '[living] WHICH SPECIES did not take the picture to NAME');
  // one tap: the species, from the free model that sees (the test model's robin), with how sure, and nothing kept unless he saves it
  await until(() => window.__ghosty.lens.card.what === 'living' && /European robin/.test(window.__ghosty.lens.card.text), null, 20000, `[living] the species never came: ${JSON.stringify(await page.evaluate(() => window.__ghosty.lens.card))}`);
  const sp = await page.evaluate(() => window.__ghosty.lens.card.text);
  check(/NAME IT · BIRD/.test(sp) && /Erithacus rubecula/.test(sp) && /SAVE/.test(sp), `${T} [living] the species card says "${sp.slice(0, 160)}"`);
  await letGo();
  await backToLens();
  await reset();

  // ---- A PLACE: named by the free model that sees, with its encyclopedia summary
  await hold([thing('clock tower', 0.64)]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'place'), null, 4000, '[place] the clock tower has no card');
  await keyIn('place', 'WHAT PLACE IS THIS').click();
  await until(() => window.__ghosty.cards.place.state === 'found' && window.__ghosty.cards.place.name === 'Big Ben', null, 20000, `[place] the place was not named: ${JSON.stringify((await cards()).place)}`);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'place' && c.head === 'BIG BEN' && /Great Bell/.test(c.line)), null, 3000, '[place] the card does not show the summary');
  await layout('place');
  await letGo();
  await reset();
  // another clock tower (another thing in view) is not Big Ben: the answer belonged to the one it was asked about
  await hold([{ ...thing('clock tower', 0.66), box: { x: 120, y: 80, w: 300, h: 300 } }]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'place' && /^A CLOCK TOWER/.test(c.head) && c.keys.includes('WHAT PLACE IS THIS')), null, 4000, `[place] a second clock tower was shown as the first: ${JSON.stringify((await cards()).cards.map((c) => c.head))}`);
  await letGo();
  await reset();

  // ---- FACES: only someone he introduced, by the name he gave; a stranger said plainly and never named
  await hold([{ kind: 'stranger', box: { x: 220, y: 100, w: 160, h: 200 }, score: 0.9, truth: 'someone I don’t know' }]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'stranger' && /I never identify a stranger/.test(c.line)), null, 4000, '[faces] the stranger is not said plainly');
  check(!(await cards()).cards.some((c) => c.job === 'known'), `${T} [faces] a stranger was given a name`);
  await layout('stranger');
  await letGo();
  await reset();
  await hold([{ kind: 'face', box: { x: 220, y: 100, w: 160, h: 200 }, score: 0.9, truth: 'Mum', data: { label: 'Mum' } }]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'known' && c.head === 'MUM'), null, 4000, '[faces] someone he introduced is not named as he named them');
  await layout('face');
  await letGo();
  await reset();

  // ---- with nothing in view the cards go
  await until(() => !window.__ghosty.cards.cards.some((c) => c.job !== 'nothing'), null, 5000, '[gone] the cards stayed after the things left the picture');

  async function layout(what) {
    const small = await page.evaluate(() => [...document.querySelectorAll('#pg-lens .lenscards :is(button, a)')].filter((b) => b.offsetParent !== null).map((b) => ({ t: b.textContent.trim().slice(0, 24), r: b.getBoundingClientRect() })).filter((x) => x.r.width < 43.5 || x.r.height < 43.5).map((x) => `${x.t} ${Math.round(x.r.width)}×${Math.round(x.r.height)}`));
    check(!small.length, `${T} [layout ${what}] keys under 44 pt: ${small.join(', ')}`);
    check(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), `${T} [layout ${what}] the page scrolls sideways`);
    const cut = await page.evaluate(() => [...document.querySelectorAll('#pg-lens .lenscard :is(.lc-head, .lc-line, li, .lc-answer, .lc-keys > *)')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 30)));
    check(!cut.length, `${T} [layout ${what}] words cut: ${cut.join(' | ')}`);
    const wide = await page.evaluate(() => [...document.querySelectorAll('#pg-lens .lenscard')].filter((e) => e.getBoundingClientRect().right > innerWidth + 0.5).length);
    check(!wide, `${T} [layout ${what}] a card runs off the screen`);
  }
  await ctx.close();
}

await run({ width: 440, height: 956 }, true);
await run({ width: 390, height: 844 }, false);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'lens2 clean at 440 and 390: the picture in true colour in all seven looks; the pack offered with its size on Wi-Fi and no signal said in his words; a notice read aloud, copied, its date in the agenda, its number called (by tap and by "call that number"), its link opened, its email to write and its address opened on the map; two sums worked (and said for "solve that"); a French sign said and sent as words with no picture; a Polish sign put into English in place on his tap; a parcel to track, a temperature in Celsius and prices in pounds; a French menu laid over line by line in English; a bill on the letter card with REMIND and FILE, kept in his bills; a receipt in this month’s spending in one tap and its warranty kept; a business card into his contacts, made on the phone; a bus stop’s next buses by its name; a medicine box to its NHS page; a rating plate costed at his price; a page scanned flat; a barcode looked up with its grades, figures per 100 g and allergens, lit red for a milk allergy said in his words, and a second packet compared side by side; a QR link opened, a Wi-Fi password copied and a risky link only OPEN ANYWAY; a mug named 82% sure and measured; a robin named European robin in one tap; a clock tower named Big Ben with its summary, and another clock tower not taken for it; a stranger never named and Mum named as he named her; every card’s keys 44 pt, nothing sideways, no words cut.');
process.exit(problems.length ? 1 : 0);
