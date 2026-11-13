// THE LENS THAT KNOWS ITS JOB (FINAL-LENS), at 440 × 956 and 390 × 844. The owner points it and it does the job: every job proved on
// fixture frames (the page's own camera plays colour bars; the one view's fixture feed, window.__ghosty.oneFeed, puts what a frame
// holds in front of it: the words the reader read, a code, a thing with how sure, a face).
//   COLOUR   the picture is in true colour in all seven looks: the colour on screen is the camera's own (no grey filter, no wash)
//   STATES   the eyes not on the phone (the offer with its size, on Wi-Fi, on his tap), looking, no signal: each in his words
//   TEXT     read aloud, copied; its date ADD TO AGENDA, its number CALL, its address ON THE MAP, its link OPEN, its email WRITE
//   A SUM    solved and shown worked; an equation too
//   A SIGN   in French: said to be French, translated by itself (the words only)
//   A BILL   the letter card, and the plate's REMIND and FILE
//   A PAGE   SCAN IT FLAT opens SCAN's document part on the frame
//   PRODUCT  a shop barcode looked up on the open product databases through the brain; a QR link opened
//   A THING  named with how sure; MEASURE IT opens the measure
//   LIVING   a robin: WHICH SPECIES takes the picture to NAME (the free model that sees), on his tap only
//   A PLACE  a clock tower: WHAT PLACE IS THIS names it (the free model that sees) with its encyclopedia summary
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
  await page.route('**/api/lookup/barcode?code=5000159484695', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ code: '5000159484695', kind: 'product', source: 'Open Food Facts', credit: 'Open Food Facts, ODbL', title: 'Digestive biscuits', brand: 'Fixture Bakery', quantity: '400 g', nutriscore: 'e' }) }));
  await page.route('**/api/aim/about?title=*', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ title: 'Big Ben', extract: 'Big Ben is the nickname for the Great Bell of the Great Clock of Westminster, at the north end of the Palace of Westminster in London.', url: 'https://en.wikipedia.org/wiki/Big_Ben' }) }));
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'lens'));
  await page.waitForSelector('#pg-lens .lensbar', { timeout: 15000 });
  const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(`${T} ${what}`), false));

  // ---- STATES before anything: the eyes are not on the phone: the offer, with its size, on Wi-Fi, done on his tap only
  const offer = ((await page.locator('#pg-lens .lensknow .lensget').textContent().catch(() => '')) ?? '').trim();
  check(/GET THE EYES/.test(offer) && /18 MB/.test(offer) && /WI-FI/.test(offer), `${T} [states] the pack offer says "${offer}": want GET THE EYES with its size, on Wi-Fi`);
  check((await page.evaluate(() => window.__ghosty.one.finder)) === 'off', `${T} [states] the eyes started downloading without his tap`);
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
    await page.evaluate((w) => (document.documentElement.dataset.world = w), look);
    await page.waitForTimeout(150);
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
  const call = await keyIn('phone', 'CALL').getAttribute('href');
  check(call === 'tel:01214960123', `${T} [phone] CALL dials ${call}`);
  await keyIn('link', 'OPEN').click();
  check((await page.evaluate(() => window.__opened)).includes('https://www.example.org'), `${T} [link] OPEN did not open https://www.example.org`);
  check((await keyIn('email', 'WRITE').getAttribute('href')) === 'mailto:hello@example.org', `${T} [email] WRITE does not write to hello@example.org`);
  await layout('text');
  await page.screenshot({ path: `${out}/lens2-text-${viewport.width}.png`, fullPage: false });
  await keyIn('address', 'ON THE MAP').click();
  await until(() => /^map: 12 High Street, Birmingham B1 1AA/.test(window.__ghosty.cards.done), null, 3000, '[address] ON THE MAP did not take the address to the map');
  // (the map finds the place itself, through the brain's geocoder: on a runner with no outside network it says it could not; the address reaching it is the Lens's part)
  await letGo();
  await page.evaluate(() => (location.hash = 'lens'));
  await until(() => window.__ghosty.lens.camera === 'on' && window.__ghosty.lens.mode === 'lens' && !!window.__ghosty.oneFeed, null, 20000, '[back] the Lens did not open again after the map');
  await reset();

  // ---- A SUM: solved and shown worked; an equation too
  await words('12 + 7 × 3 =\n2x + 3 = 11');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.cards.filter((c) => c.job === 'sum').length === 2, null, 4000, '[sum] the two sums were not solved');
  const sums = await page.evaluate(() => [...document.querySelectorAll('#pg-lens .lenscard[data-job="sum"]')].map((c) => ({ steps: [...c.querySelectorAll('.lc-steps li')].map((l) => l.textContent), answer: c.querySelector('.lc-answer')?.textContent })));
  check(sums[0]?.steps.join(' | ') === '7 × 3 = 21 | 12 + 21 = 33' && sums[0]?.answer === '= 33', `${T} [sum] 12 + 7 × 3 worked as ${JSON.stringify(sums[0])}`);
  check(sums[1]?.steps.join(' | ') === '2x = 11 − 3 = 8 | x = 8 ÷ 2 = 4' && sums[1]?.answer === 'x = 4', `${T} [sum] 2x + 3 = 11 worked as ${JSON.stringify(sums[1])}`);
  await layout('sum');
  await letGo();
  await reset();

  // ---- A SIGN in French: said to be French, its English by itself (the words only)
  await words('SORTIE DE SECOURS\nNe pas bloquer cette issue');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'text' && /FRENCH/.test(c.head)), null, 4000, `[sign] the French sign's card does not say FRENCH: ${JSON.stringify((await cards()).cards.map((c) => c.head))}`);
  await until(() => window.__ghosty.one.translate.runs >= 1, null, 8000, '[sign] the French words were not sent to be translated');
  await letGo();
  await reset();

  // ---- A BILL: the letter card and the plate's REMIND and FILE
  await words('BRITISH GAS\nYour balance is £84.20.\nPlease pay by 14 December 2026.\nReference 4471 2290');
  await hold([TEXT_BOX]);
  await until(() => window.__ghosty.cards.jobs[0] === 'letter', null, 4000, `[bill] the job for a bill is ${(await cards()).jobs[0]}`);
  await until(() => [...document.querySelectorAll('#pg-lens .lensplate button')].map((b) => b.textContent.trim()).join(',').includes('REMIND'), null, 4000, '[bill] the plate does not offer REMIND');
  check((await page.locator('#pg-lens .lensplate button', { hasText: 'FILE' }).count()) === 1, `${T} [bill] the plate does not offer FILE`);
  await letGo();
  await reset();

  // ---- A PAGE: scanned flat
  const page60 = Array.from({ length: 12 }, (_, i) => `Line ${i + 1} of the long page about the harbour and its boats`).join('\n');
  await words(page60);
  await hold([{ ...TEXT_BOX, box: { x: 16, y: 16, w: 608, h: 448 } }]);
  await until(() => window.__ghosty.cards.jobs[0] === 'document', null, 4000, `[page] the job for a full page is ${(await cards()).jobs[0]}`);
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
  check(/Digestive biscuits · Fixture Bakery · 400 g · Nutri-Score E\. From Open Food Facts/.test(prod?.line ?? ''), `${T} [product] the card says "${prod?.line}"`);
  await letGo();
  await reset();
  await hold([{ kind: 'code', box: { x: 200, y: 140, w: 200, h: 200 }, score: 0.95, truth: 'a code', data: { text: 'https://example.org/menu', format: 'qr_code', codeKind: 'url' } }]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'code' && c.head === 'A LINK CODE'), null, 4000, '[qr] the QR link has no card');
  await keyIn('code', 'OPEN').click();
  check((await page.evaluate(() => window.__opened)).includes('https://example.org/menu'), `${T} [qr] OPEN did not open the QR code's link`);
  await letGo();
  await reset();

  // ---- A THING: named with how sure; MEASURE IT
  const thing = (label, score) => ({ kind: 'object', box: { x: 180, y: 120, w: 280, h: 240 }, score, truth: `looks like a ${label}`, data: { label, named: true } });
  await hold([thing('mug', 0.82)]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'thing' && c.head === 'A MUG' && /^82% sure/.test(c.line)), null, 4000, `[thing] the mug's card: ${JSON.stringify((await cards()).cards)}`);
  await keyIn('thing', 'MEASURE IT').click();
  await until(() => window.__ghosty.lens.mode === 'measure', null, 5000, '[thing] MEASURE IT did not open the measure');
  await letGo();
  await backToLens();
  await page.evaluate(() => window.__ghosty.lens.frozen && document.querySelector('#pg-lens .lensbar button.on')?.click());
  await reset();

  // ---- A LIVING THING: the species, from the free model that sees, on his tap
  await hold([thing('robin', 0.78)]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'living' && c.head === 'A ROBIN · 78% SURE'), null, 4000, `[living] the robin's card: ${JSON.stringify((await cards()).cards.map((c) => c.head))}`);
  await keyIn('living', 'WHICH SPECIES').click();
  await until(() => window.__ghosty.lens.mode === 'name', null, 5000, '[living] WHICH SPECIES did not take the picture to NAME');
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

  // ---- FACES: only someone he introduced, by the name he gave; a stranger said plainly and never named
  await hold([{ kind: 'stranger', box: { x: 220, y: 100, w: 160, h: 200 }, score: 0.9, truth: 'someone I don’t know' }]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'stranger' && /I never identify a stranger/.test(c.line)), null, 4000, '[faces] the stranger is not said plainly');
  check(!(await cards()).cards.some((c) => c.job === 'known'), `${T} [faces] a stranger was given a name`);
  await letGo();
  await reset();
  await hold([{ kind: 'face', box: { x: 220, y: 100, w: 160, h: 200 }, score: 0.9, truth: 'Mum', data: { label: 'Mum' } }]);
  await until(() => window.__ghosty.cards.cards.some((c) => c.job === 'known' && c.head === 'MUM'), null, 4000, '[faces] someone he introduced is not named as he named them');
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
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'lens2 clean at 440 and 390: the picture in true colour in all seven looks; the pack offered with its size on Wi-Fi and no signal said in his words; a notice read aloud, copied, its date in the agenda, its number to call, its link opened, its email to write and its address on the map; two sums worked; a French sign said and sent as words; a bill on the letter card with REMIND and FILE; a page scanned flat; a barcode looked up on Open Food Facts and a QR link opened; a mug named 82% sure and measured; a robin taken for its species; a clock tower named Big Ben with its summary; a stranger never named and Mum named as he named her; every key 44 pt, nothing sideways, no words cut.');
process.exit(problems.length ? 1 : 0);
