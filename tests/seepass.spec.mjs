// QUALITY PASS: SEE (BRIEF-QUALITY-SEE): God's Eye, the Machine view, the Lens and THREATS (with the offline eyes' pack rows) measured and
// made right, nothing new added. One check for each fix, named for the rough spot it closes, grouped GOD'S EYE (E) · THE LENS (L) ·
// THREATS (T) · THE MACHINE VIEW and the packs (M, P), at 440 × 956 and 390 × 844, in THE SCAN, against the preview's real brain, with the
// feeds stood in (no internet), the camera refused or granted (Chromium's fake one), the signal cut and put back. The pure words (every
// line the three rooms say) are read from the very source files the page is built from, and the checks that need a source read it.
// Stills (440 only), before and after a fix pass: SEE_STILL=before|after names them tests/.shots/seepass-<name>-440-<before|after>.png.
//   BASE=http://localhost:8832 NO_GL_SHOTS=1 node tests/seepass.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel, openSection, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8832';
const KEY = 'preview-owner-key-0123456789';
const STILL = process.env.SEE_STILL ?? 'after';
const PHONE2 = { width: 390, height: 844 };
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 260)}`);
  }
};
const on = (k) => !process.env.SP_ONLY || process.env.SP_ONLY.split(',').includes(k);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const words = (s) => (s.trim().match(/\S+/g) ?? []).length;
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d|PROBLEM|NotAllowed|getUserMedia|Permission denied/i;
const src = (f) => readFileSync(new URL(`../apps/web/src/${f}`, import.meta.url), 'utf8');
await standDown(base, KEY);

/** A source file of the app, bundled and imported: the page's own words, read by the spec (pure files only). */
async function pure(entry) {
  const r = buildSync({ entryPoints: [new URL(`../${entry}`, import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'silent' });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString('base64')}`);
}
/** A section that may not run to its end (the old code lacks what it reaches for) says so as one red line instead of ending the spec. */
async function section(name, fn) {
  if (!on(name)) return;
  try {
    await fn();
  } catch (e) {
    check(false, `[${name}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 200)}`);
  }
}

// ================================================================ the words, read from the source (once)
await section('words', async () => {
  log('pure words');
  const T = await pure('apps/web/src/features/threats/words.ts');
  const now = Date.UTC(2026, 10, 12, 9, 40);
  // T1 · every row says when and from which feed
  check(T.whenWords('QUAKE', now - 12 * 60_000, now) === '12 minutes ago, from the USGS feed', `[T1 when] a quake 12 minutes old reads "${T.whenWords('QUAKE', now - 12 * 60_000, now)}"`);
  check(T.whenWords('WILDFIRES', now - 3 * 3_600_000, now) === '3 hours ago, from NASA’s feed' && T.agoWords(now - 30_000, now) === 'just now' && T.agoWords(now - 60_000, now) === '1 minute ago', `[T1 when] an event reads "${T.whenWords('WILDFIRES', now - 3 * 3_600_000, now)}"`);
  // T2, T3, T4 · the three states with their own words
  check(T.NOTHING.head === 'Nothing serious anywhere right now.', `[T2 empty] reads "${T.NOTHING.head}"`);
  check(/^No signal; this is from \d\d:\d\d\.$/.test(T.offlineWords(now)), `[T3 offline] reads "${T.offlineWords(now)}"`);
  check(words(T.NO_PLACES) <= 24 && /home/i.test(T.NO_PLACES), `[T4 near home] with no places says "${T.NO_PLACES}"`);
  const th = src('features/threats/index.ts');
  check(th.includes("from './words'") && th.includes('whenWords('), '[T1 when] THREATS does not draw its rows from the words');

  const E = await pure('apps/web/src/features/eye/words.ts');
  // E6 · a target card's numbers with their unit and where they came from
  check(E.cardWords.altitude(36000) === '36,000 feet · FL360' && E.cardWords.altitudeNote === 'from the feed', `[E6 card units] a plane at 36,000 feet reads "${E.cardWords.altitude(36000)}" · "${E.cardWords.altitudeNote}"`);
  check(E.cardWords.knots(412) === '412 knots' && E.cardWords.knots(12.34, 1) === '12.3 knots' && E.cardWords.knots(1) === '1 knot', `[E6 card units] speeds read "${E.cardWords.knots(412)}", "${E.cardWords.knots(12.34, 1)}"`);
  check(E.cardWords.hours(5 * 3_600_000) === '5 hours' && E.cardWords.hours(-1) === 'now' && E.cardWords.hours(10 * 60_000) === 'less than an hour', `[E7 launch] reads "${E.cardWords.hours(5 * 3_600_000)}"`);
  const ei = src('features/eye/index.ts');
  check(ei.includes('cardWords.altitude(') && ei.includes('cardWords.knots(v.sog, 1)') && !/`\$\{Math\.round\(a\.gs\)\} kt`|`\$\{v\.sog\.toFixed\(1\)\} kt`/.test(ei), '[E6 card units] the plane and ship cards still write "kt"');
  check(ei.includes("'worked out from its orbit'") && ei.includes('cardWords.hours(l.net'), '[E7 satellite and launch] the cards do not say where their numbers come from');
  // E3 · a search with nothing says what to try
  check(/couldn’t find “zzq”/.test(E.noFindWords('zzq')) && /town|flight|ship/.test(E.noFindWords('zzq')) && words(E.noFindWords('zzq')) <= 20, `[E3 search] reads "${E.noFindWords('zzq')}"`);
  check(/^No signal/.test(E.noSignalFindWords('x')), `[E3 search] with no signal reads "${E.noSignalFindWords('x')}"`);
  // E4 · the cameras' grid with none near, in one line
  check(words(E.noCamerasWords) <= 14 && /No public cameras/.test(E.noCamerasWords), `[E4 cameras] none near reads "${E.noCamerasWords}"`);
  // E5 · a camera that will not play
  check(!/SIGNAL LOST|CAMERA OFFLINE|CONNECTING…/.test(ei) && ei.includes("'TRY ANOTHER'") && !/not available right now/.test(ei), '[E5 camera] the card still says SIGNAL LOST or has no TRY ANOTHER');
  // E8 · developer words out of the globe's menus
  check(!/'LAYERS'|'SENSOR'|All layers/.test(ei) && ei.includes("'HOW IT SEES'"), '[E8 words] the globe still says LAYERS or SENSOR to him');
  const RA = src('data/roadahead.ts');
  check(!/Location permission was refused|Safari → Location/.test(RA) && RA.includes('Settings, Ghosty, Location'), '[E2 road ahead] the position refusal is not in his words');

  const L = await pure('apps/web/src/features/lens/words.ts');
  // L3 · the people rule's line, word for word
  check(L.STRANGER === 'Someone I don’t know. I never identify a stranger.', `[L3 stranger] reads "${L.STRANGER}"`);
  check(src('features/lens/people.ts').includes('STRANGER') && !/introduce us/.test(src('features/lens/people.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')), '[L3 stranger] PEOPLE does not say the rule’s line');
  // L4 · READ with no words
  check(L.NO_WORDS === 'No words in view. Hold the page flatter.' && src('features/lens/read.ts').includes('NO_WORDS') && !/No text found/.test(src('features/lens/read.ts')), `[L4 read] reads "${L.NO_WORDS}"`);
  // L5 · NAME's closest three, said as maybe, never one as fact
  const names = [{ label: 'robin', p: 0.5 }, { label: 'sparrow', p: 0.2 }, { label: 'wren', p: 0.1 }, { label: 'finch', p: 0.05 }];
  check(L.maybeWords(names) === 'Maybe robin, sparrow or wren. I’m guessing.' && L.maybeWords([names[0]]) === 'Maybe robin. I’m guessing.' && L.maybeWords([]) === '', `[L5 name] reads "${L.maybeWords(names)}"`);
  check(/Nothing I can name/.test(L.NO_NAME), `[L5 name] with no match reads "${L.NO_NAME}"`);
  // L6 · MEASURE's every number with its unit and "a first estimate"
  check(L.FIRST_ESTIMATE === 'a first estimate' && src('features/lens/measure.ts').includes('${FIRST_ESTIMATE}'), '[L6 measure] a result row does not say it is a first estimate');
  // L7 · the pill's helper never repeats the pill
  const tiles = await pure('apps/web/src/features/lens/tiles.ts');
  const repeats = tiles.TILES.filter((t) => t.hint.toLowerCase().split(/\W+/).includes(t.label.toLowerCase())).map((t) => `${t.label}: ${t.hint}`);
  check(repeats.length === 0, `[L7 helpers] a helper repeats its pill: ${repeats.join(' | ')}`);
  check(tiles.TILES.every((t) => words(t.hint) <= 8), '[L7 helpers] a helper is more than a few words');
  // L8, L9 · ASK, PHOTO TOOLS with nothing to ask on
  check(/^No picture yet/.test(L.NO_PICTURE) && /^No signal/.test(L.NO_SIGNAL_ASK), `[L8 ask] says "${L.NO_PICTURE}" / "${L.NO_SIGNAL_ASK}"`);
  check(src('features/lens/photo.ts').includes('I need my brain for ') && !/Needs the brain/.test(src('features/lens/photo.ts')), '[L9 photo tools] with no brain it does not say so in his words');
  // L10 · no "PROBLEM" label anywhere in the Lens
  const all = ['aim', 'ask', 'name', 'sound'].map((m) => src(`features/lens/${m}.ts`)).join('\n');
  check(!/'PROBLEM'/.test(all) && all.includes("'NO ANSWER'"), '[L10 label] a reply that failed is still labelled PROBLEM');
  // L1 · the camera's refusal, once, his words and how to allow it
  const C = await pure('apps/web/src/vision/camera.ts').catch(() => null);
  const refused = C?.cameraMessage(Object.assign(new Error(''), { name: 'NotAllowedError' })) ?? src('vision/camera.ts');
  check(/Settings, Ghosty, Camera/.test(refused) && !/Safari|browser/i.test(refused), `[L1 camera] the refusal reads "${refused.slice(0, 120)}"`);

  // M1 · the Machine view with no signal; P1 · a pack that stopped offers RETRY
  const M = await pure('apps/web/src/features/eye/machine.ts');
  check(/^No signal/.test(M.MACHINE_OFFLINE), `[M1 machine] with no signal reads "${M.MACHINE_OFFLINE}"`);
  const pk = src('features/settings/packs.ts');
  check(pk.includes("'RETRY'") && /Tap RETRY on Wi-Fi/.test(src('offline/pack.ts')) && !/GET again/i.test(src('offline/pack.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\*|\/\/).*$/gm, '')), '[P1 packs] a pack that stopped does not offer RETRY');
  const eyes = src('offline/eyes.ts');
  check(!/public\/vendor/.test(eyes.replace(/\/\*[\s\S]*?\*\//g, '')), '[P2 packs] a pack row shows a file path as its licence');
});

// the stand-in public feeds (no internet): cameras in London, no places, an empty or a full hazards feed
const png = (w, h, [r, g, b, a]) => {
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = table[(c ^ x) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) raw.set([r, g, b, a], y * (w * 4 + 1) + 1 + x * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};
const IMG = png(64, 48, [40, 200, 160, 255]);
const tfl = (id, name, lat, lon) => ({ id, commonName: name, lat, lon, additionalProperties: [{ key: 'available', value: 'true' }, { key: 'imageUrl', value: `https://s3-eu-west-1.amazonaws.com/jamcams.tfl.gov.uk/${id.slice(8)}.jpg` }] });
const H = 3_600_000;
const iso = (t) => new Date(t).toISOString();
const feedsFor = (full) => {
  const now = Date.now();
  const quake = (id, mag, place, ago, lat, lon) => ({ id, properties: { mag, place, time: now - ago, url: `https://earthquake.usgs.gov/${id}`, tsunami: 0, alert: null }, geometry: { coordinates: [lon, lat, 10] } });
  return [
    [/api\.tfl\.gov\.uk/, [tfl('JamCams_00001.01251', 'Trafalgar Sq / Strand', 51.5077, -0.1277), tfl('JamCams_00001.02000', 'Tower Bridge Rd', 51.5005, -0.0754)]],
    [/nominatim\.openstreetmap\.org/, []],
    [/earthquake\.usgs\.gov/, { features: full ? [quake('q1', 6.3, '170 km NW of Port-Olry, Vanuatu', 12 * 60_000, -14.5, 166.2)] : [] }],
    [/eonet\.gsfc\.nasa\.gov/, { events: full ? [{ id: 'e2', title: 'Fresh Fire, Portugal', link: 'https://eonet.gsfc.nasa.gov/e2', categories: [{ id: 'wildfires', title: 'Wildfires' }], geometry: [{ type: 'Point', date: iso(now - 3 * H), coordinates: [-8, 40] }] }] : [] }],
    [/services\.swpc\.noaa\.gov/, [{ time_tag: iso(now - 3 * H).slice(0, 19), Kp: 2.0, a_running: 7, station_count: 8 }]],
    [/ll\.thespacedevs\.com/, { count: 0, results: [] }],
  ];
};

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });

/** One phone. `full`: the hazards feeds have a quake and a fire. `img`: 'ok' | 'dead' (the camera pictures). `cam`: 'deny' refuses the camera. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: o.still ? 2 : 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block', permissions: o.cam === 'deny' ? [] : ['camera'] });
  const st = { img: 'ok', full: !!o.full };
  const feeds = feedsFor(!!o.full);
  await ctx.route('**/api/proxy?**', (route) => {
    const target = new URL(route.request().url()).searchParams.get('url') ?? '';
    if (/\.(jpg|jpeg)$/.test(target)) return st.img === 'dead' ? route.fulfill({ status: 404, body: '' }) : route.fulfill({ status: 200, headers: { 'content-type': 'image/png' }, body: IMG });
    const hit = feeds.find(([re]) => re.test(target));
    if (!hit) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(hit[1]) });
  });
  // no saved place, whatever an earlier spec left in the preview's brain
  await ctx.route(/\/api\/guardian$/, (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ places: [], checked: {}, failed: {}, tz: 'Europe/London', person: null, walk: null }) }) : route.fallback()));
  await ctx.route('**/api/ships?**', (route) => route.fulfill({ status: 200, headers: { 'content-type': 'application/json' }, body: '{"ships":[]}' }));
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    // the camera, refused when the check says so (as the phone's own refusal comes: a NotAllowedError)
    const gum = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
    if (gum) navigator.mediaDevices.getUserMedia = (c) => (window.__cam === 'deny' ? Promise.reject(new DOMException('Permission denied', 'NotAllowedError')) : gum(c));
    // every waiting line, as it came (ui/wait.ts)
    window.__waits = [];
    new MutationObserver((ms) => {
      const lines = (n) => (n.nodeType === 1 ? [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')] : []);
      for (const m of ms) for (const n of m.addedNodes) for (const l of lines(n)) window.__waits.push(l.dataset.wait);
    }).observe(document, { childList: true, subtree: true });
  }, { key: KEY, body: o.body ?? 0 });
  if (o.cam === 'deny') await page.addInitScript(() => (window.__cam = 'deny'));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(1200);
  return { ctx, page, st };
}

const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.textContent ?? '').join(' | '), sel);
const small = (page, sel) =>
  page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button])`, (els) =>
    els
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
      .filter((e) => e.type !== 'range')
      .map((e) => {
        // (a control's hit area is its box and the room its ::after reaches beyond it: the way chips are drawn all over the app)
        const a = getComputedStyle(e, '::after');
        const reach = (p) => (a.position === 'absolute' && a.content !== 'none' ? Math.max(0, -(parseFloat(a[p]) || 0)) : 0);
        const r = { width: (e.offsetWidth || e.getBoundingClientRect().width) + reach('left') + reach('right'), height: (e.offsetHeight || e.getBoundingClientRect().height) + reach('top') + reach('bottom') };
        return r.width >= 43.5 && r.height >= 43.5 ? '' : `${e.tagName.toLowerCase()} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)}`;
      })
      .filter(Boolean)
      .slice(0, 6),
  );
const sideways = (page, id) =>
  page.evaluate((t) => document.documentElement.scrollWidth > innerWidth + 1 || [...document.querySelectorAll(`#pg-${t} *`)].some((e) => {
    if (!e.getClientRects().length || e.closest('[hidden]')) return false;
    for (let p = e.parentElement; p; p = p.parentElement) if (/(auto|scroll|hidden)/.test(getComputedStyle(p).overflowX) && p.id !== `pg-${t}`) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
  }), id);
const until = (page, fn, arg, ms = 8000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const still = (page, name, vp) => (vp.width === 440 ? page.screenshot({ path: `${out}/seepass-${name}-440-${STILL}.png` }).catch(() => undefined) : undefined);
const waits = (page) => page.evaluate(() => window.__waits.slice());

/** The bar every screen answers to: nothing sideways, every control 44 pt, no raw string on the page. */
async function bar(page, tag, id, vp) {
  check(!(await sideways(page, id)), `${tag}: sideways`);
  const s = await small(page, `#pg-${id}`);
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `#pg-${id} .pn:not([hidden]) *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}

// ================================================================ GOD'S EYE and the MACHINE VIEW
for (const vp of [PHONE, PHONE2]) {
  if (!on('eye')) break;
  const T = `[${vp.width}]`;
  await section('eye', async () => {
    log(`eye ${vp.width}`);
    const { ctx, page, st } = await phone(vp, { still: vp.width === 440 });
    await page.evaluate(() => (location.hash = 'eye'));
    await page.waitForSelector('#pg-eye .eyebot .btns', { timeout: 20000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => (window.__ghosty.globe.cam.autoSpin = false));
    // E1 · the first draw said once
    // (what the page said, counted by ui/wait.ts itself: a line that a layout moves in the page is not said twice)
    const w1 = await page.evaluate(() => window.__ghosty.wait?.said ?? []);
    check(w1.filter((x) => x === 'Drawing the world…').length === 1, `${T} [E1 first draw] the globe's first draw said ${w1.filter((x) => x === 'Drawing the world…').length} times (want once): ${w1.filter((x) => /Draw/.test(x)).join(' | ') || 'nothing'}`);
    check(!(await page.evaluate(() => !!document.querySelector('#pg-eye [data-wait="Drawing the world…"]'))), `${T} [E1 first draw] the line is still up after the globe has drawn`);
    await still(page, 'eye', vp);
    // E8 · every control 44 pt, the words of the menus
    await bar(page, `${T} [E8 controls] God's Eye`, 'eye', vp);
    check(!/\bLAYERS\b|\bSENSOR\b/i.test(await txt(page, '#pg-eye .eyelay .ptitle, #pg-eye .eyelay h3, #pg-eye .eyechips button')), `${T} [E8 words] LAYERS or SENSOR on the globe`);
    // E3 · a search with nothing says what to try (and the toast says the miss once)
    await page.fill('#pg-eye .search input', 'zzqxqzz');
    await page.keyboard.press('Enter');
    check(await until(page, () => /zzqxqzz/.test(document.querySelector('#pg-eye .searchnote:not([hidden])')?.textContent ?? ''), null, 10000), `${T} [E3 search] the search that found nothing said nothing under the box`);
    const note = await txt(page, '#pg-eye .searchnote:not([hidden])');
    check(/town, a flight number or a ship/.test(note) && (await page.evaluate(() => document.querySelector('#pg-eye .searchnote')?.dataset.state)) === 'empty', `${T} [E3 search] reads "${note}"`);
    await ctx.setOffline(true);
    await page.fill('#pg-eye .search input', 'Little Snoring');
    await page.keyboard.press('Enter');
    check(await until(page, () => /^No signal/.test(document.querySelector('#pg-eye .searchnote:not([hidden])')?.textContent ?? ''), null, 8000), `${T} [E3 search] with no signal the box says: "${await txt(page, '#pg-eye .searchnote')}"`);
    await ctx.setOffline(false);
    await page.fill('#pg-eye .search input', '');
    // E4 · cameras on, close in, none near
    await page.evaluate(() => window.__ghosty.run('set_layer', { layer: 'cams', on: true }));
    await page.evaluate(() => window.__ghosty.globe.cam.flyTo({ lat: 51.53, lon: -0.2, range: 3, tilt: 0, hd: 0 }));
    check(await until(page, () => document.querySelectorAll('#pg-eye .camgrid:not([hidden]) .camview').length > 0, null, 30000), `${T} [E4 cameras] the grid never showed the London cameras`);
    await page.evaluate(() => window.__ghosty.globe.cam.flyTo({ lat: 10, lon: -30, range: 5, tilt: 0, hd: 0 }));
    const none = await until(page, () => /No public cameras near here/.test(document.querySelector('#pg-eye .camgrid:not([hidden]) .camnone')?.textContent ?? ''), null, 30000);
    check(none, `${T} [E4 cameras] over the sea the grid says: "${await txt(page, '#pg-eye .camgrid')}" (hidden: ${await page.evaluate(() => document.querySelector('#pg-eye .camgrid')?.hidden)})`);
    await still(page, 'eye-cams', vp);
    // E5 · a camera that will not play: his words and TRY ANOTHER
    await page.evaluate(() => window.__ghosty.globe.cam.flyTo({ lat: 51.53, lon: -0.2, range: 3, tilt: 0, hd: 0 }));
    await until(page, () => document.querySelectorAll('#pg-eye .camgrid:not([hidden]) .camview').length > 0, null, 30000);
    st.img = 'dead';
    await page.locator('#pg-eye .camgrid .camview').first().click({ force: true }).catch(() => undefined);
    check(await until(page, () => /^I can’t reach this camera just now\.$/.test(document.querySelector('#pg-eye .eyeinfo .camstamp')?.textContent ?? ''), null, 15000), `${T} [E5 camera] a camera that will not come says: "${await txt(page, '#pg-eye .eyeinfo .camstamp')}"`);
    const another = page.locator('#pg-eye .eyeinfo button', { hasText: /^try another$/i });
    check((await another.count()) === 1 && (await another.first().isVisible()), `${T} [E5 camera] no TRY ANOTHER on the dead camera's card`);
    const was = await txt(page, '#pg-eye .eyeinfo .rw .v');
    await another.first().click({ force: true }).catch(() => undefined);
    check(await until(page, (w) => document.querySelector('#pg-eye .eyeinfo .rw .v')?.textContent !== w, was, 8000), `${T} [E5 camera] TRY ANOTHER did not open another camera`);
    st.img = 'ok';
    await page.locator('#pg-eye .eyeinfo button', { hasText: '✕' }).click().catch(() => undefined);
    // E2 · no position: ROAD AHEAD says why and offers the search
    await page.evaluate(() => {
      const geo = { getCurrentPosition: (_ok, bad) => bad({ code: 1, message: 'User denied Geolocation' }), watchPosition: (_ok, bad) => (bad({ code: 1, message: 'User denied Geolocation' }), 1), clearWatch: () => undefined };
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geo });
    });
    await page.locator('#pg-eye .eyebot button', { hasText: /^road ahead$/i }).click({ force: true });
    check(await until(page, () => !!document.querySelector('#pg-eye .roadahead [data-state="empty"]'), null, 8000), `${T} [E2 no position] ROAD AHEAD with no position drew no state: "${await txt(page, '#pg-eye .roadahead')}"`);
    const ra = await txt(page, '#pg-eye .roadahead [data-state="empty"]');
    check(/Settings, Ghosty, Location/.test(ra) && !RAW.test(ra) && !/Safari/.test(ra), `${T} [E2 no position] reads "${ra}"`);
    const find = page.locator('#pg-eye .roadahead button', { hasText: /^search a place$/i });
    check((await find.count()) === 1, `${T} [E2 no position] no SEARCH A PLACE key`);
    await find.first().click({ force: true }).catch(() => undefined);
    check(await page.evaluate(() => document.activeElement === document.querySelector('#pg-eye .search input')), `${T} [E2 no position] SEARCH A PLACE did not put him in the search box`);
    await page.locator('#pg-eye .roadahead button', { hasText: /^stop$/i }).click({ force: true }).catch(() => undefined);
    // the words that open it from the chat, and they do (the Machine view, answered on the phone)
    const says = await page.evaluate(() => document.querySelector('#pg-eye .pkphrases')?.dataset.says ?? '');
    check(says.includes('machine view') && words(await txt(page, '#pg-eye .pkphrases')) <= 12, `${T} [phrases] God's Eye lists no phrase in one line: "${says}"`);
    // M2 · the Machine view's first look, said; M1 · and its numbers with no signal
    const nw = (await waits(page)).length;
    await page.evaluate((s) => window.__ghosty.send(s.split('|')[0]), says || 'machine view');
    check(await until(page, () => window.__ghosty.machine?.on === true, null, 12000), `${T} [phrases] saying "machine view" did not open the mode`);
    const w2 = (await waits(page)).slice(nw);
    check(w2.some((x) => /^Looking round .+…$/.test(x)), `${T} [M2 machine first look] the Machine view's first look said nothing: ${w2.join(' | ') || 'no waiting line'}`);
    check(await until(page, () => window.__ghosty.machine?.ready === true, null, 15000), `${T} [M2 machine first look] the first line never came`);
    check(!(await page.evaluate(() => !!document.querySelector('#pg-eye .mchview [data-wait]'))), `${T} [M2 machine first look] the waiting line is still up after the first line`);
    await still(page, 'machine', vp);
    await ctx.setOffline(true);
    check(await until(page, () => document.querySelector('#pg-eye .mchnote')?.dataset.state === 'offline' && /No signal: these counts are the last I saw\./.test(document.querySelector('#pg-eye .mchnote')?.textContent ?? ''), null, 12000), `${T} [M1 machine no signal] reads "${await txt(page, '#pg-eye .mchnote')}"`);
    await ctx.setOffline(false);
    await bar(page, `${T} [machine] the Machine view`, 'eye', vp);
    await ctx.close();
  });
}

// ================================================================ THREATS
for (const vp of [PHONE, PHONE2]) {
  if (!on('threats')) break;
  const T = `[${vp.width}]`;
  await section('threats', async () => {
    log(`threats ${vp.width}`);
    // the hazards feeds with a quake and a fire
    {
      const { ctx, page } = await phone(vp, { full: true, still: vp.width === 440 });
      await page.evaluate(() => (location.hash = 'threats'));
      await page.waitForSelector('#pg-threats .pn.signals', { state: 'attached', timeout: 20000 });
      check(await until(page, () => document.querySelectorAll('#pg-threats .pn.signals .rw').length >= 2, null, 20000), `${T} [T1 when] the list never filled`);
      const when = await page.$$eval('#pg-threats .pn.signals .rw .when', (els) => els.map((e) => e.textContent.trim()));
      check(when.length >= 2 && when.every((t) => /^(just now|\d+ (minutes?|hours?|days?) ago), from (the USGS feed|NASA’s feed)$/.test(t)), `${T} [T1 when] the rows read: ${when.join(' | ') || 'nothing'}`);
      check(when.some((t) => /^1[0-5] minutes ago, from the USGS feed$/.test(t)), `${T} [T1 when] the 12-minute quake reads: ${when.join(' | ')}`);
      await still(page, 'threats', vp);
      await bar(page, `${T} [threats] signals`, 'threats', vp);
      // T3 · no signal with the list in hand: the time it is from
      await ctx.setOffline(true);
      await page.evaluate(() => (location.hash = 'core'));
      await page.waitForTimeout(500);
      await page.evaluate(() => (location.hash = 'threats'));
      check(await until(page, () => /^No signal; this is from \d\d:\d\d\.$/.test(document.querySelector('#pg-threats .sigoff:not([hidden])')?.textContent ?? ''), null, 12000), `${T} [T3 offline] the list with no signal says: "${await txt(page, '#pg-threats .sigoff')}"`);
      await ctx.setOffline(false);
      // T4 · NEAR HOME with no places offers the one next thing
      await openSection(page, 'threats', 'Near you');
      check(await until(page, () => !!document.querySelector('#pg-threats .nearhome .watchline[data-state="empty"]'), null, 15000), `${T} [T4 near home] with no places the panel drew no empty state: "${await txt(page, '#pg-threats .nearhome .watchline')}"`);
      const nh = await txt(page, '#pg-threats .nearhome .watchline');
      check(/save your home/i.test(nh) && !RAW.test(nh), `${T} [T4 near home] reads "${nh}"`);
      const key = page.locator('#pg-threats .nearhome button', { hasText: /^save my home$/i });
      check((await key.count()) === 1 && (await key.first().isVisible()) && !(await page.locator('#pg-threats .nearhome button', { hasText: /^check now$/i }).first().isVisible().catch(() => false)), `${T} [T4 near home] the one next thing (SAVE MY HOME, not CHECK NOW) is not what is offered`);
      await still(page, 'threats-near', vp);
      await bar(page, `${T} [threats] near home`, 'threats', vp);
      await ctx.close();
    }
    // the feeds answer with nothing at all: nothing serious, in his words
    {
      const { ctx, page } = await phone(vp, { full: false });
      await page.evaluate(() => (location.hash = 'threats'));
      await page.waitForSelector('#pg-threats .pn.signals', { state: 'attached', timeout: 20000 });
      check(await until(page, () => /^Nothing serious anywhere right now\./.test(document.querySelector('#pg-threats .pn.signals [data-state="empty"]')?.textContent ?? ''), null, 25000), `${T} [T2 empty] an empty feed says: "${await txt(page, '#pg-threats .pn.signals .empty')}"`);
      await bar(page, `${T} [threats] empty`, 'threats', vp);
      await ctx.close();
    }
  });
}

// ================================================================ THE LENS
for (const vp of [PHONE, PHONE2]) {
  if (!on('lens')) break;
  const T = `[${vp.width}]`;
  await section('lens', async () => {
    log(`lens ${vp.width}`);
    const { ctx, page } = await phone(vp, { cam: 'deny', still: vp.width === 440 });
    await page.evaluate(() => (location.hash = 'lens'));
    await page.waitForSelector('#pg-lens .lensmodes', { state: 'attached', timeout: 20000 });
    await page.waitForTimeout(1500);
    // L1 · the camera refused: his words once, how to allow it, never the browser's string
    await page.locator('#pg-lens button', { hasText: /^start$/i }).first().click({ force: true });
    check(await until(page, () => window.__ghosty.lens?.camera === 'error', null, 10000), `${T} [L1 camera] the refused camera never showed as refused`);
    const empty = await txt(page, '#pg-lens .lensempty, #pg-lens [data-state="error"]');
    check(/The phone would not give me the camera\. Settings, Ghosty, Camera/.test(empty) && !RAW.test(empty) && !/Safari/.test(empty), `${T} [L1 camera] the viewfinder says: "${empty.slice(0, 200)}"`);
    const l = await page.evaluate(() => ({ status: window.__ghosty.lens.status, error: window.__ghosty.lens.error }));
    check(l.status !== l.error && !l.status.includes('Settings, Ghosty'), `${T} [L1 camera] the bar repeats the refusal: "${l.status}"`);
    const toastsN = await page.evaluate(() => [...document.querySelectorAll('#toasts > *')].filter((t) => /Settings, Ghosty, Camera/.test(t.textContent ?? '')).length);
    check(toastsN === 0, `${T} [L1 camera] the refusal is said ${toastsN + 1} times (want once)`);
    await still(page, 'lens-refused', vp);
    await page.locator('#pg-lens button', { hasText: /^more$/i }).first().click({ force: true }).catch(() => undefined);
    // every mode: 44 pt, nothing sideways, no raw string
    const modes = ['lens', 'see', 'read', 'hands', 'ask', 'name', 'people', 'scan', 'aim', 'measure'];
    for (const m of modes) {
      const n = (await waits(page)).length;
      await page.evaluate((m) => window.__ghosty.lens.setMode(m), m);
      await page.waitForTimeout(700);
      await still(page, `lens-${m}`, vp);
      await bar(page, `${T} [lens ${m}] every control`, 'lens', vp);
      const w = (await waits(page)).slice(n);
      // L2 · every model's first load says what for
      if (m === 'see') check(w.includes('Waking the eyes…'), `${T} [L2 first load] SEE's first load said: ${w.join(' | ') || 'nothing'}`);
      if (m === 'hands') check(w.includes('Waking the eyes…'), `${T} [L2 first load] HANDS' first load said: ${w.join(' | ') || 'nothing'}`);
      if (m === 'name') check(w.includes('Loading the names…'), `${T} [L2 first load] NAME's first load said: ${w.join(' | ') || 'nothing'}`);
    }
    // L8 · ASK with no picture, and with no signal
    await page.evaluate(() => window.__ghosty.lens.setMode('ask'));
    await page.waitForTimeout(500);
    await page.fill('#pg-lens textarea.lensq', 'What is this?');
    await page.locator('#pg-lens button', { hasText: /^ask ghosty$/i }).first().click({ force: true });
    check(await until(page, () => document.querySelector('#pg-lens .askstate[data-state="empty"]')?.textContent === 'No picture yet. Tap START to take one.', null, 8000), `${T} [L8 ask] with no picture ASK says: "${await txt(page, '#pg-lens .askstate')}"`);
    await ctx.setOffline(true);
    await page.locator('#pg-lens button', { hasText: /^ask ghosty$/i }).first().click({ force: true });
    check(await until(page, () => document.querySelector('#pg-lens .askstate[data-state="offline"]')?.textContent === 'No signal, so I can’t ask my brain. READ, NAME and SEE still work on this phone.', null, 8000), `${T} [L8 ask] with no signal ASK says: "${await txt(page, '#pg-lens .askstate')}"`);
    await ctx.setOffline(false);
    // L7 · the helpers under the pills, as drawn
    const hints = await page.$$eval('#pg-lens .lensmodes button', (bs) => bs.map((b) => b.textContent ?? ''));
    check(hints.length >= 10 && !hints.some((h) => /^NAMEname anything/i.test(h)), `${T} [L7 helpers] a pill repeats itself: ${hints.filter((h) => /name anything/i.test(h)).join(' | ')}`);
    await ctx.close();
  });
  // L3 · the people rule's line, said on the page: PEOPLE with a camera and a stranger in view is the faces spec's; here the words are the rule's
  // (the pure check above reads them from the file PEOPLE says them from; faces.spec asks "who's this?" and gets exactly them)
}

// ================================================================ the offline eyes' pack rows
for (const vp of [PHONE, PHONE2]) {
  if (!on('packs')) break;
  const T = `[${vp.width}]`;
  await section('packs', async () => {
    log(`packs ${vp.width}`);
    const { ctx, page } = await phone(vp, { still: vp.width === 440 });
    // every file refused: the first piece stops it
    await ctx.route('**/vendor/**', (r) => r.fulfill({ status: 500, body: 'no' }));
    await page.evaluate(() => (location.hash = 'settings'));
    await page.waitForSelector('#pg-settings .scanset button.srow, #pg-settings.listmode .pn[data-row]', { timeout: 20000 });
    await openPanel(page, 'settings', 'OFFLINE EYES');
    await page.waitForSelector('#pg-settings .wikioffer[data-pack="eyes-lens"]', { timeout: 10000 });
    const row = page.locator('#pg-settings .wikioffer[data-pack="eyes-lens"]');
    const before = ((await row.innerText()) ?? '').replace(/\s+/g, ' ');
    check(/get · \d+(\.\d)? MB/i.test(before) && !/public\/vendor/.test(before), `${T} [P1 packs] the offer reads: ${before.slice(0, 200)}`);
    await row.locator('button[data-act="get"]').click({ force: true });
    check(await until(page, () => document.querySelector('.wikioffer[data-pack="eyes-lens"]')?.dataset.state === 'failed', null, 15000), `${T} [P1 packs] a pack that stopped never showed as failed: "${await txt(page, '.wikioffer[data-pack="eyes-lens"]')}"`);
    const after = ((await row.innerText()) ?? '').replace(/\s+/g, ' ');
    check(/RETRY · \d+(\.\d)? MB/i.test(after) && /I could not|Tap RETRY/.test(after) && !RAW.test(after), `${T} [P1 packs] a stopped pack reads: ${after.slice(0, 260)}`);
    check((await row.locator('button[data-act="get"]').getAttribute('aria-label'))?.startsWith('Retry '), `${T} [P1 packs] RETRY's VoiceOver label is "${await row.locator('button[data-act="get"]').getAttribute('aria-label')}"`);
    await still(page, 'packs', vp);
    const s = await small(page, '#pg-settings .offeyes');
    check(!s.length, `${T} [P1 packs] under 44 pt: ${s.join(', ')}`);
    check(!(await sideways(page, 'settings')), `${T} [P1 packs] sideways`);
    await ctx.close();
  });
}

// ================================================================ BODY 21 clips nothing (the biggest text, at 440)
await section('body21', async () => {
  log('body 21');
  const { ctx, page } = await phone(PHONE, { body: 21, full: true });
  for (const id of ['eye', 'lens', 'threats']) {
    await page.evaluate((t) => (location.hash = t), id);
    await page.waitForTimeout(2200);
    check(!(await sideways(page, id)), `[440] [BODY 21] ${id}: sideways at the biggest text`);
    const cut = await page.$$eval(`#pg-${id} :is(.rw .v, .rw .k, .note, .empty b, .empty span, .searchnote, .when, .watchline)`, (els) => els.filter((e) => e.getClientRects().length && !e.closest('[hidden]') && (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX === 'hidden')).slice(0, 3).map((e) => (e.textContent ?? '').slice(0, 30)));
    check(!cut.length, `[440] [BODY 21] ${id}: text cut off: ${cut.join(' | ')}`);
  }
  await ctx.close();
});

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `SEE pass clean: ${checks} checks in ${secs} s: THREATS says when and from which feed, nothing serious, no signal and NEAR HOME's one next thing; God's Eye draws once with words, searches say what to try, cameras say when they will not play, cards carry unit and source; the Lens says the camera's refusal once, every load says what for, the stranger line is the rule's; the Machine view and the pack rows say what they are doing.`);
process.exit(problems.length ? 1 : 0);
