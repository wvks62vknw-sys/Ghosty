// QUALITY PASS: PLAN AND ME (BRIEF-QUALITY-PLAN-ME): SPENDING, THE MARKETS, THE RADIO, MEMORY, SETTINGS' pages, SYSTEM's pages, LINKS and SOCIAL
// measured and made right, nothing new added. One check for each of the twenty-five fixes, named for the rough spot it closes, grouped
// SPENDING (S) · THE MARKETS (K) · THE RADIO (R) · MEMORY (M) · SETTINGS (E) · SYSTEM (Y) · LINKS (L) · SOCIAL (O), at 440 × 956 and 390 × 844, in
// THE SCAN, against the preview's real brain with the feeds, the radio list, the spending and the social drafts stood in where the check needs
// them. The pure words (every line these screens say) are read from the very source files the page is built from. Every screen also answers
// the bar: nothing sideways, every control 44 pt, no raw string, the chat phrase listed on it, BODY 21 clips nothing, and a post is never sent
// without APPROVE. Stills (440 only), before and after a fix pass: PM_STILL=before|after names them tests/.shots/planmepass-<name>-440-<before|after>.png.
//   BASE=http://localhost:8841 NO_GL_SHOTS=1 node tests/planmepass.spec.mjs [outDir]
process.env.TZ = 'Europe/London';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel, openSection, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const STILL = process.env.PM_STILL ?? 'after';
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
const on = (k) => !process.env.PM_ONLY || process.env.PM_ONLY.split(',').includes(k);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const words = (s) => (s.trim().match(/\S+/g) ?? []).length;
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d|PROBLEM|NotAllowed|getUserMedia|Permission denied/i;
const src = (f) => readFileSync(new URL(`../apps/web/src/${f}`, import.meta.url), 'utf8');
const nocomments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const JSONH = { 'content-type': 'application/json' };
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
  const now = Date.UTC(2026, 10, 12, 14, 2);
  // ---- SPENDING
  const SW = await pure('apps/web/src/features/agenda/spendwords.ts');
  check(SW.pounds(1234.5) === '£1,234.50' && SW.pounds(38) === '£38.00' && SW.pounds(-12.3) === '−£12.30' && SW.totalWords(1234.56, 2000).out === '£1,234.56 out', `[S1 penny] amounts read "${SW.pounds(1234.5)}", "${SW.pounds(38)}", "${SW.totalWords(1234.56, 2000).out}"`);
  const sp = src('features/agenda/spending.ts');
  check(sp.includes("from './spendwords'") && !/gbp\(c\.spent\)|gbp\(v\.out\)|gbp\(y\.out\)|gbp\(m\.out\)/.test(sp), '[S1 penny] SPENDING still writes a total or a category to whole pounds');
  const em = SW.emptyMonthWords('2026-09', true);
  check(em.head === 'Nothing spent in September.' && /earlier month/.test(em.next) && !/earlier/.test(SW.emptyMonthWords('2026-09', false).next) && words(`${em.head} ${em.next}`) <= 20, `[S2 empty month] reads "${em.head} ${em.next}"`);
  check(SW.NAV.earlier === 'Earlier month' && sp.includes('NAV.earlier') && sp.includes('emptyMonthWords('), '[S2 empty month] the month arrows are not named, or the empty month is not drawn from the words');
  const iw = SW.importWords({ added: 18, bank: 'Monzo', duplicates: 2, asked: 1, unplaced: 1 });
  check(iw === 'Added 18 rows from Monzo. 2 were here already. 1 sorted by the free AI. 1 to file: tap it.' && words(iw) <= 20 && SW.importWords({ added: 1 }) === 'Added 1 row.', `[S3 import] reads "${iw}"`);
  check(!/ · \$\{x\.duplicates\}/.test(sp) && sp.includes('importWords(r.result)') && sp.includes('waiting(p.body, READING)'), '[S3 import] the toast is still the run-on line, or the read has no wait said');

  // ---- THE MARKETS
  const KW = await pure('apps/web/src/features/markets/words.ts');
  const at = now - 12 * 60_000;
  check(KW.asOfLine(now, now, true) === 'As of 14:02.' && KW.asOfLine(at, now, false) === 'As of 13:50, 12 minutes ago.', `[K1 time] reads "${KW.asOfLine(now, now, true)}" · "${KW.asOfLine(at, now, false)}"`);
  const mk = src('features/markets/index.ts');
  check(mk.includes('asOfLine(coinsAt(), Date.now(), cs.live)'), '[K1 time] the top sentence of THE MARKETS has prices with no time');
  check(KW.ageWords(now - 30_000, now) === 'just now' && KW.ageWords(now - 3 * 3_600_000, now) === '3 hours ago' && KW.ageWords(now - 2 * 86_400_000, now) === '2 days ago' && /offline · As of 13:50, 12 minutes ago · from CoinGecko/.test(KW.sheetAsOf(false, 'You’re offline', at, now)), `[K2 age] a stale sheet reads "${KW.sheetAsOf(false, 'You’re offline', at, now)}"`);
  check(mk.includes('sheetAsOf(s.live, s.why, s.at'), '[K2 age] the coin sheet does not say how old the price is');
  check(KW.RETRY === 'RETRY' && mk.includes('button(RETRY') && mk.includes('waiting(el, RETRYING)'), '[K3 retry] a panel with nothing has no RETRY, or it asks without saying so');
  check(KW.NOT_READ === 'not read yet' && !/x == null \? '—'/.test(mk) && /^I have not read a week/.test(KW.WEEK_EMPTY) && words(KW.WEEK_EMPTY) <= 20, `[K4 not read] a rate not read says "${KW.NOT_READ}", a week "${KW.WEEK_EMPTY}"`);

  // ---- THE RADIO
  const RW = await pure('apps/web/src/features/radio/words.ts');
  const st = [{ url: 'a' }, { url: 'b' }, { url: 'c' }];
  check(RW.TUNING === 'Tuning…' && RW.FINDING === 'Finding stations…' && RW.TRY_ANOTHER === 'TRY ANOTHER', `[R1 tuning] says "${RW.TUNING}" / "${RW.FINDING}"`);
  const ri = src('features/radio/index.ts');
  check(!/Connecting…/.test(ri) && ri.includes('TUNING'), '[R1 tuning] the row or the hero still says Connecting…');
  check(RW.nextStation(st, 'a').url === 'b' && RW.nextStation(st, 'c').url === 'a' && RW.nextStation([{ url: 'a' }], 'a') === null && RW.nextStation(st, 'zz').url === 'a' && ri.includes('button(TRY_ANOTHER'), '[R2 try another] a dead station has no way on to the next one');
  check(ri.includes('waiting(sp.body, FINDING)') && ri.includes('searching = true'), '[R3 finding] the first list shows the cold empty state while it is searching');

  // ---- MEMORY
  const MW = await pure('apps/web/src/features/memory/words.ts');
  const noon = (d) => new Date(2026, 10, d, 12, 0).getTime();
  const n13 = new Date(2026, 10, 13, 9, 0).getTime();
  check(MW.dayWords(noon(13), n13) === 'Today' && MW.dayWords(noon(12), n13) === 'Yesterday' && /^[A-Z][a-z]{2} 10 Nov$/.test(MW.dayWords(noon(10), n13)) && /2025/.test(MW.dayWords(new Date(2025, 5, 3).getTime(), n13)), `[M1 days] read "${MW.dayWords(noon(13), n13)}", "${MW.dayWords(noon(12), n13)}", "${MW.dayWords(noon(10), n13)}"`);
  const tl = src('features/memory/timeline.ts');
  check(tl.includes('dayWords(at)') && !/const day = \(at: number\) => new Date\(at\)\.toLocaleDateString/.test(tl), '[M1 days] the timeline still heads each memory with a date alone');
  const nh = MW.noHitWords('zzqx', true);
  check(nh.head === 'Nothing matches “zzqx”' && /other words/.test(nh.next) && /Everything/.test(MW.noHitWords('zzqx', false).next), `[M2 no hit] reads "${nh.head}" / "${nh.next}"`);
  check(tl.includes('noHitWords(find.value'), '[M2 no hit] the timeline does not name what he typed');
  check(MW.LOADING === 'Reading your memory…' && tl.includes('waiting(p.el, LOADING)') && /Retry|RETRY/.test(tl) && /synced/.test(MW.PAGE_SUB) === false && !/synced/.test(nocomments(src('features/memory/index.ts'))), `[M3 wait] the page line reads "${MW.PAGE_SUB}"`);
  check(words(MW.PATTERNS_EMPTY) <= 20 && !/(?:never guessed|kept in your private brain)/.test(MW.PATTERNS_EMPTY) && /never guessed/.test(MW.PATTERNS_WHY) && tl.includes('details.patwhy'), `[M4 patterns] the empty state is ${words(MW.PATTERNS_EMPTY)} words`);

  // ---- SETTINGS
  const EW = await pure('apps/web/src/features/settings/words.ts');
  const offs = Object.entries(EW.SWITCHES).filter(([, v]) => !/; off, /.test(v)).map(([k]) => k);
  check(!offs.length && Object.values(EW.SWITCHES).every((v) => words(v) <= 20) && EW.SWITCHES.barge === 'I stop when you talk over me; off, only a tap stops me.', `[E1 switches] a switch does not say what changes when off: ${offs.join(', ') || EW.SWITCHES.barge}`);
  check(src('features/settings/voice.ts').includes('SWITCHES.barge') && src('features/settings/faces.ts').includes('SWITCHES.live') && src('features/settings/guardian.ts').includes('SWITCHES.share'), '[E1 switches] a page does not draw its switch from the words');
  check(/never identify a stranger/.test(EW.FACES_NONE) && /^None yet:/.test(EW.FACES_NONE) && src('features/settings/faces.ts').includes('FACES_NONE'), `[E2 faces] with none says "${EW.FACES_NONE}"`);
  check(words(EW.PRINCIPLES_EMPTY) <= 14 && /^Reading/.test(EW.PRINCIPLES_LOADING) && src('features/settings/principles.ts').includes('waiting(host, PRINCIPLES_LOADING)') && src('features/settings/principles.ts').includes('PRINCIPLES_ERROR'), `[E3 principles] empty reads "${EW.PRINCIPLES_EMPTY}"`);
  const longG = Object.entries(EW.GUARDIAN).filter(([, c]) => words(c.short) > 20).map(([k]) => k);
  check(!longG.length && src('features/settings/guardian.ts').includes('cut(G.intro)') && !/Typed or said/.test(src('features/settings/guardian.ts')) && !/try Safari/.test(src('features/settings/voiceknown.ts')), `[E4 guardian] a paragraph is over 20 words: ${longG.join(', ')}`);

  // ---- SYSTEM
  const YW = await pure('apps/web/src/features/system/words.ts');
  const since = Date.UTC(2026, 10, 9, 0, 0);
  check(/^This week, since Mon 9 Nov, as of 14:02: what each loop/.test(YW.loopsHead(since, now)) && words(YW.loopsHead(since, now)) <= 20 && /as of 14:02/.test(YW.ledgerHead(since, now)), `[Y2 units] LOOPS reads "${YW.loopsHead(since, now)}"`);
  check(YW.foreValue(0.62, 8) === '62% right · 8 scored' && YW.foreValue(0, 0) === 'none scored yet' && YW.ownBrainsValue(62) === '62% of answers', `[Y2 units] foresight reads "${YW.foreValue(0.62, 8)}", the meter "${YW.ownBrainsValue(62)}"`);
  check(/^Reading/.test(YW.WAIT.loops) && src('features/system/loops.ts').includes('waiting(p.body, WAIT.loops)') && src('features/system/ledger.ts').includes('WAIT.ledger') && src('features/system/foresight.ts').includes('WAIT.foresight'), '[Y1 waits] LOOPS, WHAT I LEARNED or FORESIGHT fetches with no wait said');
  check(YW.withSize('STORAGE: NOT PROTECTED — add Ghosty to your Home Screen', 12.4 * 1024 * 1024) === 'STORAGE: NOT PROTECTED — add Ghosty to your Home Screen · 12 MB used' && YW.withSize('STORAGE: PROTECTED · 3 MB used', 3 * 1024 * 1024) === 'STORAGE: PROTECTED · 3 MB used' && YW.withSize('x', -1) === 'x' && src('features/system/storage.ts').includes('withSize('), '[Y3 storage] the storage line does not say its size when it is not protected');

  // ---- LINKS
  const LW = await pure('apps/web/src/features/links/words.ts');
  check(LW.linkFailed('bluesky', 'Bluesky') === 'I couldn’t sign in to Bluesky. Check the handle and the app password, then tap LINK BLUESKY again.' && ['mastodon', 'discord', 'channel'].every((k) => /^I couldn’t sign in to X\. Check .* then tap LINK [A-Z]+ again\.$/.test(LW.linkFailed(k, 'X')) && words(LW.linkFailed(k, 'X')) <= 20), `[L1 link failed] reads "${LW.linkFailed('bluesky', 'Bluesky')}"`);
  check(!/sayError\(e, 'send that'\)/.test(src('features/links/social.ts')) && src('features/links/social.ts').includes('linkFailed('), '[L1 link failed] a failed link still says "I could not send that"');
  check(LW.sentTo(1) === 'Sent to 1 device.' && LW.sentTo(2) === 'Sent to 2 devices.' && !/device\(s\)/.test(src('features/links/notifications.ts') + src('features/links/index.ts')) && words(LW.NOTIFY_SCOPE.short) <= 20 && /no Telegram message, no alert or voice in the app/.test(LW.NOTIFY_SCOPE.short) && !/Could not send: /.test(src('features/links/index.ts')), `[L2 notifications] reads "${LW.sentTo(2)}"`);

  // ---- SOCIAL
  const OW = await pure('apps/web/src/features/social/words.ts');
  check(OW.sendKey('waiting') === 'APPROVE' && OW.sendKey('failed') === 'APPROVE' && OW.NO === 'NO' && /Nothing went out\. APPROVE sends it once\.$/.test(OW.failedWords('Bluesky was down')) && /^Not sent: Bluesky was down\./.test(OW.failedWords('Bluesky was down')) && !/undefined/.test(OW.failedWords(undefined)), `[O2 retry] a failed post reads "${OW.failedWords('Bluesky was down')}"`);
  check(OW.exactLine('post', 'Bluesky') === 'I will post exactly this on Bluesky, only when you tap APPROVE.' && /only when you tap APPROVE/.test(OW.exactLine('follow', 'Bluesky', '@a.bsky.social')) && OW.exactLine('post', 'Bluesky', undefined, 'APPROVE') === 'I will post exactly this on Bluesky, only when you tap APPROVE.' && words(OW.queueNote(2)) <= 20 && words(OW.queueNote(0)) <= 20, `[O1 exact] reads "${OW.exactLine('post', 'Bluesky')}"`);
  const dr = src('features/links/drafts.ts');
  check(dr.includes('sendKey(d.state)') && dr.includes('button(NO,') && dr.includes('exactLine(') && !/button\('NOT THIS'/.test(dr), '[O1 exact] the draft card does not say what leaves, or still has a key called NO');
  check(/brain\.socialApprove/.test(dr) && (dr.match(/socialApprove\(/g) ?? []).length === 1 && !/socialApprove/.test(src('features/social/queue.ts')), '[O3 rule] something other than the APPROVE key reaches the brain’s send');
});


// ================================================================ the live screens
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

/** One phone. `routes`: stood-in answers (regex → handler) before the page loads. `body`: the biggest text when 21. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  for (const [re, fn] of o.routes ?? []) await ctx.route(re, fn);
  // the public feeds are not reachable from here: markets and the radio list say so unless a check stands them in
  await ctx.route('**/api/proxy?**', (route) => {
    const target = new URL(route.request().url()).searchParams.get('url') ?? '';
    const hit = (o.feeds ?? []).find(([re]) => re.test(target));
    if (hit) return hit[1](route);
    return route.fulfill({ status: 502, body: '' });
  });
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'London', lat: 51.5, lon: -0.12 } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
    // every waiting line, as it came (ui/wait.ts)
    window.__waits = [];
    new MutationObserver((ms) => {
      const lines = (n) => (n.nodeType === 1 ? [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')] : []);
      for (const m of ms) for (const n of m.addedNodes) for (const l of lines(n)) window.__waits.push(l.dataset.wait);
    }).observe(document, { childList: true, subtree: true });
  }, { key: KEY, body: o.body ?? 0 });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(1200);
  return { ctx, page };
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
const still = (page, name, vp) => (vp.width === 440 ? page.screenshot({ path: `${out}/planmepass-${name}-440-${STILL}.png` }).catch(() => undefined) : undefined);
const waits = (page) => page.evaluate(() => window.__waits.slice());
const go = async (page, id, ms = 1800) => {
  await page.evaluate((t) => (location.hash = t), id);
  await page.waitForTimeout(ms);
};
/** The bar every screen answers to: nothing sideways, every control 44 pt, no raw string on the page. */
async function bar(page, tag, id) {
  check(!(await sideways(page, id)), `${tag}: sideways`);
  const s = await small(page, `#pg-${id}`);
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `#pg-${id} .pn:not([hidden]) *, #pg-${id} .pn.pushed *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}
const phrasesOf = (page, id) => page.$$eval(`#pg-${id} .pkphrases`, (els) => els.map((e) => e.dataset.says ?? ''));

// the radio list stood in, slow (a search the phone waits for)
const STATIONS = [
  { name: 'Spec One FM', url_resolved: 'https://spec.invalid/one', tags: 'news', countrycode: 'GB', bitrate: 64, codec: 'MP3', votes: 10, clickcount: 100, lastcheckok: 1 },
  { name: 'Spec Two FM', url_resolved: 'https://spec.invalid/two', tags: 'jazz', countrycode: 'GB', bitrate: 128, codec: 'MP3', votes: 9, clickcount: 90, lastcheckok: 1 },
];
const radioFeed = (delay) => [/radio-browser/, async (route) => {
  await new Promise((r) => setTimeout(r, delay));
  return route.fulfill({ status: 200, headers: JSONH, body: JSON.stringify(STATIONS) });
}];

for (const vp of [PHONE, PHONE2]) {
  const T = `[${vp.width}]`;

  // ---------------------------------------------------------------- THE RADIO
  await section('radio', async () => {
    log(`radio ${vp.width}`);
    const { ctx, page } = await phone(vp, { feeds: [radioFeed(1800)] });
    await go(page, 'radio', 600);
    const said = await waits(page);
    check(said.includes('Finding stations…'), `${T} [R3 finding] the first list said ${JSON.stringify(said)} while it searched`);
    const ok = await until(page, () => document.querySelectorAll('#pg-radio .station').length >= 2, null, 9000);
    check(ok, `${T} [R3 finding] the stood-in stations never drew`);
    check(!(await page.$('#pg-radio .g-wait, #pg-radio .waiting')), `${T} [R3 finding] the waiting line stayed after the list drew`);
    const says = await phrasesOf(page, 'radio');
    check(says.some((x) => /play BBC Radio 4/.test(x)), `${T} [phrases] THE RADIO lists no chat phrase: ${JSON.stringify(says)}`);
    await bar(page, `${T} [radio]`, 'radio');
    await still(page, 'radio', vp);
    await ctx.close();
  });

  // ---------------------------------------------------------------- THE MARKETS
  await section('markets', async () => {
    log(`markets ${vp.width}`);
    const { ctx, page } = await phone(vp);
    await go(page, 'markets', 2500);
    const retry = await until(page, () => !!document.querySelector('#pg-markets .mkretry'), null, 8000);
    check(retry, `${T} [K3 retry] a panel with nothing has no RETRY: ${(await txt(page, '#pg-markets .coins')).slice(0, 160)}`);
    if (retry) {
      const box = await page.locator('#pg-markets .mkretry').first().boundingBox();
      check(box && box.height >= 44, `${T} [K3 retry] RETRY is ${box?.height} pt high`);
      await page.locator('#pg-markets .mkretry').first().click();
      await page.waitForTimeout(300);
      check((await waits(page)).includes('Asking again…'), `${T} [K3 retry] RETRY did not say it was asking again`);
    }
    const body = await txt(page, '#pg-markets .coins, #pg-markets .metals, #pg-markets .fx');
    check(/can’t be reached|You’re offline|Loading the prices/.test(body) && !RAW.test(body), `${T} [markets] with no feed it reads "${body.slice(0, 160)}"`);
    await bar(page, `${T} [markets]`, 'markets');
    await still(page, 'markets', vp);
    await ctx.close();
  });

  // ---------------------------------------------------------------- MEMORY
  await section('memory', async () => {
    log(`memory ${vp.width}`);
    const { ctx, page } = await phone(vp);
    const seed = `Spec memory ${Date.now() % 100000}: my favourite colour is teal`;
    await page.evaluate(async ({ text, key }) => fetch('/api/memory', { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': key, 'content-type': 'application/json' }, body: JSON.stringify({ text }) }), { text: seed, key: KEY });
    await go(page, 'memory', 2200);
    const sub = (await page.locator('#pg-memory .sub').first().textContent()) ?? '';
    check(!/synced/i.test(sub), `${T} [M3 page line] reads "${sub}"`);
    await openSection(page, 'memory', 'Timeline');
    await page.waitForTimeout(600);
    const heads = await page.$$eval('#pg-memory .tl .mi .mih .k', (els) => els.map((e) => e.textContent));
    check(heads.length > 0 && heads.includes('Today'), `${T} [M1 days] the timeline heads its memories ${JSON.stringify(heads.slice(0, 4))}, not "Today"`);
    const find = page.locator('#pg-memory input[aria-label="Find a memory"]');
    await find.fill('zzqxqzz');
    await page.waitForTimeout(300);
    const nohit = await txt(page, '#pg-memory .tl .empty');
    check(/Nothing matches “zzqxqzz”/.test(nohit) && /other words/.test(nohit), `${T} [M2 no hit] a search with no hit reads "${nohit}"`);
    await find.fill(seed.slice(0, 22));
    await page.waitForTimeout(300);
    // FORGET, then UNDO puts the memory back
    const item = page.locator('#pg-memory .tl .mi', { hasText: seed.slice(0, 22) }).first();
    check(await item.count(), `${T} [forget] the seeded memory is not in the timeline`);
    if (await item.count()) {
      await item.locator('button', { hasText: /^FORGET$/ }).click();
      await page.waitForTimeout(500);
      const gone = (await page.locator('#pg-memory .tl .mi', { hasText: seed.slice(0, 22) }).count()) === 0;
      const undo = page.locator('.undo.undofloat:not([hidden])');
      check(gone && /Forgotten: “Spec memory/.test((await undo.textContent().catch(() => '')) ?? ''), `${T} [forget] after FORGET: gone ${gone}, the bar says "${await undo.textContent().catch(() => '')}"`);
      await undo.locator('button', { hasText: 'UNDO' }).click().catch(() => undefined);
      const back = await until(page, (t) => [...document.querySelectorAll('#pg-memory .tl .mi')].some((e) => e.textContent.includes(t)), seed.slice(0, 22), 6000);
      check(back, `${T} [forget] UNDO did not put the memory back`);
      // clean up: forget it for good
      await page.evaluate(async ({ text, key }) => {
        const r = await (await fetch('/api/memory', { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } })).json();
        for (const f of r.facts.filter((x) => x.text === text)) await fetch(`/api/memory/${encodeURIComponent(f.id)}`, { method: 'DELETE', headers: { 'x-ghosty': '1', 'x-ghosty-key': key } });
      }, { text: seed, key: KEY });
    }
    await find.fill('');
    const says = await phrasesOf(page, 'memory');
    check(says.some((x) => /remember/.test(x)), `${T} [phrases] MEMORY lists no chat phrase: ${JSON.stringify(says)}`);
    await openSection(page, 'memory', 'Patterns');
    const pe = await page.$eval('#pg-memory .pats .patempty', (e) => [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('') + (e.querySelector('details.patwhy') ? '?' : '')).catch(() => '');
    check(!pe || (words(pe.replace(/\?/g, '')) <= 20 && /\?/.test(pe)), `${T} [M4 patterns] the empty state reads "${pe}"`);
    await openSection(page, 'memory', 'Me');
    await bar(page, `${T} [memory]`, 'memory');
    await still(page, 'memory', vp);
    await ctx.close();
  });

  // ---------------------------------------------------------------- SETTINGS' pages
  await section('settings', async () => {
    log(`settings ${vp.width}`);
    const { ctx, page } = await phone(vp);
    await go(page, 'settings', 1800);
    await openPanel(page, 'settings', 'VOICE');
    await page.waitForTimeout(500);
    const sw = await txt(page, '#pg-settings .pn.pushed .setsw');
    check(/; off, only a tap stops me\./.test(sw), `${T} [E1 switches] the voice switch reads "${sw}"`);
    await bar(page, `${T} [settings voice]`, 'settings');
    await still(page, 'settings', vp);
    await openPanel(page, 'settings', 'PRIVACY');
    await page.waitForTimeout(700);
    const faces = await txt(page, '#pg-settings .pn.pushed .facecount');
    check(!faces || /never identify a stranger/.test(faces) || /^\d+ face/.test(faces), `${T} [E2 faces] faces reads "${faces}"`);
    const live = await txt(page, '#pg-settings .pn.pushed .livesw');
    check(!live || /; off, I save it without\./.test(live), `${T} [E1 switches] CHECK IT’S LIVE reads "${live}"`);
    await bar(page, `${T} [settings privacy]`, 'settings');
    await openPanel(page, 'settings', 'GUARDIAN');
    await page.waitForTimeout(600);
    const g = await page.$$eval('#pg-settings .pn.pushed p.note', (els) => els.map((e) => ({ t: [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim(), more: !!e.querySelector('details.patwhy') })));
    check(g.filter((x) => x.more).length === 4 && g.filter((x) => x.more).every((x) => words(x.t) <= 20), `${T} [E4 guardian] the guardian paragraphs: ${JSON.stringify(g.filter((x) => x.more).map((x) => words(x.t)))}`);
    await bar(page, `${T} [settings guardian]`, 'settings');
    await ctx.close();
  });

  // ---------------------------------------------------------------- SYSTEM's pages
  await section('system', async () => {
    log(`system ${vp.width}`);
    const { ctx, page } = await phone(vp);
    await go(page, 'system', 1800);
    await openPanel(page, 'system', 'LOOPS');
    await page.waitForTimeout(1500);
    check((await waits(page)).includes('Reading this week…'), `${T} [Y1 waits] LOOPS said ${JSON.stringify(await waits(page))}`);
    const head = await txt(page, '#pg-system .loopshead');
    check(/^This week, since .+, as of \d\d:\d\d: /.test(head) || /not reachable/.test(head), `${T} [Y2 units] LOOPS reads "${head}"`);
    await bar(page, `${T} [system loops]`, 'system');
    await still(page, 'system', vp);
    await openPanel(page, 'system', 'INDEPENDENCE');
    await page.waitForTimeout(600);
    const says = await phrasesOf(page, 'system');
    check(says.some((x) => /how independent are you\?/.test(x)), `${T} [phrases] INDEPENDENCE lists no chat phrase: ${JSON.stringify(says)}`);
    await bar(page, `${T} [system independence]`, 'system');
    await ctx.close();
  });

  // ---------------------------------------------------------------- LINKS
  await section('links', async () => {
    log(`links ${vp.width}`);
    const linkCalls = [];
    const { ctx, page } = await phone(vp, { routes: [[/\/api\/social\/link$/, async (route) => { linkCalls.push(1); return route.fulfill({ status: 400, headers: JSONH, body: JSON.stringify({ ok: false, error: 'it did not work' }) }); }], [/\/api\/social$/, (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 200, headers: JSONH, body: JSON.stringify({ accounts: [{ id: 'bluesky', name: 'Bluesky', who: null }, { id: 'mastodon', name: 'Mastodon', who: null }, { id: 'discord', name: 'Discord', who: null }, { id: 'channel', name: 'Telegram channel', who: null }], drafts: [], sent: [] }) }) : route.fallback())]] });
    await go(page, 'links', 1800);
    await openPanel(page, 'links', 'NOTIFICATIONS');
    await page.waitForTimeout(1200);
    await bar(page, `${T} [links notifications]`, 'links');
    const scope = await page.$$eval('#pg-links .notifyscope', (els) => els.map((e) => ({ t: e.textContent ?? '', q: !!e.querySelector('details.patwhy') })));
    check(!scope.length || (scope[0].q && /no Telegram message, no alert or voice in the app/.test(scope[0].t)), `${T} [L2 notifications] the scope line: ${JSON.stringify(scope).slice(0, 200)}`);
    await still(page, 'links', vp);
    await openPanel(page, 'links', 'BLUESKY');
    await page.waitForTimeout(800);
    const lnk = await page.$$eval('#pg-links .pn.pushed a.lnk', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    check(lnk.length > 0 && lnk.every((h) => h >= 44), `${T} [L2 notifications] the app-password link is ${JSON.stringify(lnk)} pt high`);
    await page.locator('#pg-links .pn.pushed input[aria-label="Bluesky handle"]').fill('spec.bsky.social');
    await page.locator('#pg-links .pn.pushed input[aria-label="Bluesky app password"]').fill('abcd-efgh-ijkl-mnop');
    await page.locator('#pg-links .pn.pushed button', { hasText: 'LINK BLUESKY' }).click();
    const failed = await until(page, () => /couldn’t sign in/.test(document.querySelector('#pg-links .pn.pushed small.note.bad, #pg-links .pn.pushed .note.bad')?.textContent ?? ''), null, 6000);
    const msg = await txt(page, '#pg-links .pn.pushed small.note, #pg-links .pn.pushed .note.bad');
    check(failed && /Check the handle and the app password, then tap LINK BLUESKY again\./.test(msg) && !/did not work/i.test(msg) && !/send that/.test(msg), `${T} [L1 link failed] a failed link reads "${msg.slice(-200)}"`);
    check(linkCalls.length === 1, `${T} [L1 link failed] the link was tried ${linkCalls.length} times`);
    await bar(page, `${T} [links bluesky]`, 'links');
    await ctx.close();
  });

  // ---------------------------------------------------------------- SOCIAL (and a post is never sent without APPROVE)
  await section('social', async () => {
    log(`social ${vp.width}`);
    const calls = { approve: [], no: [] };
    const now = Date.now();
    const drafts = [
      { id: 'dwait001', account: 'bluesky', kind: 'post', text: 'Testing my own account, exactly these words.', from: 'chat', at: now - 60_000, expires: now + 20 * 3_600_000, state: 'waiting' },
      { id: 'dfail002', account: 'bluesky', kind: 'post', text: 'This one did not go the first time.', from: 'chat', at: now - 120_000, expires: now + 20 * 3_600_000, state: 'failed', fault: 'Bluesky was down' },
    ];
    const info = { accounts: [{ id: 'bluesky', name: 'Bluesky', who: '@spec.bsky.social' }], drafts, sent: [] };
    const { ctx, page } = await phone(vp, { routes: [
      [/\/api\/social$/, (route) => (route.request().method() === 'GET' ? route.fulfill({ status: 200, headers: JSONH, body: JSON.stringify(info) }) : route.fallback())],
      [/\/api\/social\/approve$/, (route) => { calls.approve.push(route.request().postDataJSON()?.id); return route.fulfill({ status: 200, headers: JSONH, body: JSON.stringify({ error: 'Bluesky is not answering.' }) }); }],
      [/\/api\/social\/no$/, (route) => { calls.no.push(route.request().postDataJSON()?.id); return route.fulfill({ status: 200, headers: JSONH, body: JSON.stringify({ error: 'Not now.' }) }); }],
    ] });
    await go(page, 'social', 2500);
    await openSection(page, 'social', 'Waiting');
    await page.waitForTimeout(800);
    const cards = await page.$$eval('#pg-social .draftcard', (els) => els.map((e) => ({ id: e.dataset.id, state: e.dataset.state, keys: [...e.querySelectorAll('button')].map((b) => b.textContent), exact: e.querySelector('.drexact')?.textContent ?? '', st: e.querySelector('.drstate')?.textContent ?? '', words: e.querySelector('.drwords')?.textContent ?? '' })));
    check(cards.length === 2, `${T} [O1 exact] ${cards.length} draft cards on the queue`);
    const w = cards.find((c) => /dwait001/.test(c.id)), f = cards.find((c) => /dfail002/.test(c.id));
    check(w?.keys.join(' · ') === 'APPROVE · EDIT · NO' && /^I will post exactly this on Bluesky, only when you tap APPROVE\.$/.test(w.exact) && w.words === 'Testing my own account, exactly these words.', `${T} [O1 exact] the waiting draft: ${JSON.stringify(w)}`);
    check(f?.keys.join(' · ') === 'APPROVE · EDIT · NO' && /only when you tap APPROVE\.$/.test(f.exact) && /^Not sent: Bluesky was down\. Nothing went out\. APPROVE sends it once\.$/.test(f.st), `${T} [O2 retry] the failed draft: ${JSON.stringify(f)}`);
    check(calls.approve.length === 0 && calls.no.length === 0, `${T} [O3 rule] the brain was asked to send or drop before any tap: ${JSON.stringify(calls)}`);
    const small44 = await small(page, '#pg-social .draftcard');
    check(!small44.length, `${T} [O2 retry] a draft key is under 44 pt: ${small44.join(', ')}`);
    await page.locator('#pg-social .draftcard[data-id$="dfail002"] button', { hasText: 'APPROVE' }).first().click();
    await page.waitForTimeout(700);
    check(calls.approve.length === 1 && calls.approve[0] === 'dfail002', `${T} [O3 rule] APPROVE on the failed one sent ${JSON.stringify(calls.approve)} (one tap, one send)`);
    await page.locator('#pg-social .draftcard[data-id$="dwait001"] button', { hasText: /^NO$/ }).first().click();
    await page.waitForTimeout(500);
    check(calls.no.length === 1 && calls.approve.length === 1, `${T} [O3 rule] NO: dropped ${JSON.stringify(calls.no)}, sent ${JSON.stringify(calls.approve)}`);
    const note = await txt(page, '#pg-social .socq, #pg-social .pknote');
    check(/waiting for your APPROVE\. Nothing goes out until you tap it/.test(note), `${T} [O1 exact] the queue reads "${note.slice(0, 160)}"`);
    const says = await phrasesOf(page, 'social');
    check(says.some((x) => /post that to Bluesky/.test(x)), `${T} [phrases] SOCIAL lists no chat phrase: ${JSON.stringify(says)}`);
    await bar(page, `${T} [social]`, 'social');
    await still(page, 'social', vp);
    await ctx.close();
  });

  // ---------------------------------------------------------------- SPENDING
  await section('spending', async () => {
    log(`spending ${vp.width}`);
    const mkSummary = (empty) => ({
      privacy: 'No bank access, ever.', month: '2026-10', months: ['2026-09', '2026-10'], kept: 3, cap: 3000, rules: 0, last: null,
      view: { month: '2026-10', out: empty ? 0 : 1234.5, in: empty ? 0 : 2000, categories: empty ? [] : [{ c: 'groceries', spent: 120.5 }] },
      year: null, changes: [], subscriptions: [], budgets: [],
      rows: empty ? [] : [{ d: '2026-10-03', t: 'TESCO', k: 'TESCO', a: -120.5, c: 'groceries', by: 'rule' }],
    });
    let mode = 'none';
    const { ctx, page } = await phone(vp, { routes: [[/\/api\/profile\/spending(\?.*)?$/, (route) => route.request().method() === 'GET' ? route.fulfill({ status: 200, headers: JSONH, body: JSON.stringify(mode === 'none' ? { ...mkSummary(true), kept: 0, months: [], month: '', view: null } : mkSummary(mode === 'empty')) }) : route.fallback()]] });
    await go(page, 'agenda', 2000);
    await openSection(page, 'agenda', 'Spending');
    await page.waitForTimeout(800);
    const t0txt = await txt(page, '#pg-agenda .spend');
    check(/ADD STATEMENT/.test(t0txt) && /No statement yet|NONE/i.test(t0txt), `${T} [spending] with no statement it reads "${t0txt.slice(0, 160)}"`);
    const says = await phrasesOf(page, 'agenda');
    check(says.some((x) => /paste a statement/.test(x)), `${T} [phrases] SPENDING lists no chat phrase: ${JSON.stringify(says)}`);
    mode = 'full';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
    await go(page, 'agenda', 2000);
    await openSection(page, 'agenda', 'Spending');
    await page.waitForTimeout(1000);
    const full = await txt(page, '#pg-agenda .spend');
    check(/£1,234\.50 out · £2,000\.00 in/.test(full) && /£120\.50/.test(full) && !/£1,235/.test(full), `${T} [S1 penny] the month reads "${full.slice(0, 220)}"`);
    const labels = await page.$$eval('#pg-agenda .spendnav button', (els) => els.map((e) => e.getAttribute('aria-label')));
    check(labels[0] === 'Earlier month' && /^Later month\./.test(labels[1] ?? ''), `${T} [S2 empty month] the arrows are named ${JSON.stringify(labels)}`);
    await still(page, 'spending', vp);
    mode = 'empty';
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
    await go(page, 'agenda', 2000);
    await openSection(page, 'agenda', 'Spending');
    await page.waitForTimeout(1000);
    const emptyM = await txt(page, '#pg-agenda .emptymonth');
    check(/Nothing spent in October\. Tap ‹ for an earlier month/.test(emptyM), `${T} [S2 empty month] a month with nothing reads "${emptyM}"`);
    await bar(page, `${T} [spending]`, 'agenda');
    await ctx.close();
  });
}

// ================================================================ offline's words (the signal cut with the screens open)
await section('offline', async () => {
  log('offline');
  const { ctx, page } = await phone(PHONE, { feeds: [radioFeed(100)] });
  for (const [id, re, what] of [['radio', /You’re offline/, 'THE RADIO'], ['markets', /You’re offline/, 'THE MARKETS'], ['memory', /You’re offline: this is what I knew before/, 'MEMORY']]) {
    await go(page, id, 2200);
    await ctx.setOffline(true);
    await page.evaluate(() => dispatchEvent(new Event('offline')));
    await page.waitForTimeout(900);
    const t = await txt(page, `#pg-${id} .sub, #pg-${id} .nptx, #pg-${id} .empty, #pg-${id} .note`);
    check(re.test(t) && !RAW.test(t), `[440] [offline] ${what} with no signal reads "${t.slice(0, 200)}"`);
    await ctx.setOffline(false);
    await page.evaluate(() => dispatchEvent(new Event('online')));
    await page.waitForTimeout(400);
  }
  await ctx.close();
});

// ================================================================ BODY 21 clips nothing (the biggest text, at 440)
await section('body21', async () => {
  log('body 21');
  const { ctx, page } = await phone(PHONE, { body: 21, feeds: [radioFeed(200)] });
  for (const id of ['radio', 'markets', 'memory', 'social', 'agenda', 'settings', 'system', 'links']) {
    await go(page, id, 2200);
    check(!(await sideways(page, id)), `[440] [BODY 21] ${id}: sideways at the biggest text`);
    const cut = await page.$$eval(`#pg-${id} :is(.rw .v, .rw .k, .note, .empty b, .empty span, .mksay, .pknote, .mkasof)`, (els) => els.filter((e) => e.getClientRects().length && !e.closest('[hidden]') && (e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 2) && getComputedStyle(e).overflow !== 'visible').map((e) => (e.textContent ?? '').slice(0, 40)).slice(0, 4));
    check(!cut.length, `[440] [BODY 21] ${id}: text cut off: ${cut.join(' | ')}`);
  }
  await ctx.close();
});

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `PLAN AND ME pass clean: ${checks} checks in ${secs} s: SPENDING to the penny, THE MARKETS with their time and RETRY, THE RADIO tuning and TRY ANOTHER, MEMORY's days and its undo, SETTINGS, SYSTEM, LINKS and SOCIAL in his words, a post never sent without APPROVE.`);
process.exit(problems.length ? 1 : 0);
