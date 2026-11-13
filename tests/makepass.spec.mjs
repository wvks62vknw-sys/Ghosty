// QUALITY PASS: MAKE (BRIEF-QUALITY-MAKE): the Workshop, the 3D studio, SPACE, the Workbench and its wind tunnel, REVERSE, CONVERT and HOUSE
// measured and made right, nothing new added. One check for each fix, named for the rough spot it closes, grouped THE WORKSHOP (W) · THE 3D
// STUDIO (S) · SPACE (P) · THE WORKBENCH (B) · REVERSE (R) · CONVERT and HOUSE (C, H), at 440 × 956 and 390 × 844, in THE SCAN, against the
// preview's real brain, with the things a state needs (projects, reports, the house, a dead worker, a model that will not come) stood in by
// routes. The pure words (every line the seven screens say) are read from the very source files the page is built from.
// Stills (440 only), before and after a fix pass: MAKE_STILL=before|after names them tests/.shots/makepass-<name>-440-<before|after>.png.
//   BASE=http://localhost:8838 NO_GL_SHOTS=1 node tests/makepass.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const { buildSync } = createRequire(new URL('../apps/web/package.json', import.meta.url))('esbuild');

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const STILL = process.env.MAKE_STILL ?? 'after';
const PHONE2 = { width: 390, height: 844 };
const problems = [];
let checks = 0;
const t0 = Date.now();
const check = (ok, msg) => {
  checks++;
  if (!ok) {
    problems.push(msg);
    console.log(`  red: ${msg.slice(0, 280)}`);
  }
};
const on = (k) => !process.env.MP_ONLY || process.env.MP_ONLY.split(',').includes(k);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const words = (s) => (s.trim().match(/\S+/g) ?? []).length;
const RAW = /aborted|fetch failed|undefined|\[object Object\]|TypeError|NetworkError|Failed to|Load failed|HTTP \d|NotAllowed|getUserMedia|Permission denied|SyntaxError|ReferenceError/i;
const src = (f) => readFileSync(new URL(`../apps/web/src/${f}`, import.meta.url), 'utf8');
const nocomments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
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
    check(false, `[${name}] stopped: ${String(e?.message ?? e).split('\n')[0].slice(0, 220)}`);
    // (a phone left open by the check that stopped would slow every one after it)
    for (const c of live.splice(0)) await c.close().catch(() => undefined);
  }
}
const live = [];

// ================================================================ the words, read from the source (once)
let W, S, P, B, R, C, H;
// (the words files, read always: the page sections below use them as their expected lines; each is a pure file with no DOM)
try {
  W = await pure('apps/web/src/features/workshop/words.ts');
  S = await pure('apps/web/src/features/studio/words.ts');
  P = await pure('apps/web/src/features/space/words.ts');
  B = await pure('apps/web/src/features/workbench/words.ts');
  R = await pure('apps/web/src/features/reverse/words.ts');
  C = await pure('apps/web/src/features/convert/words.ts');
  H = await pure('apps/web/src/features/house/words.ts');
} catch (e) {
  console.log(`  the words files could not be read: ${String(e?.message ?? e).split('\n')[0]}`);
  problems.push(`[words] the words files are not all there: ${String(e?.message ?? e).split('\n')[0].slice(0, 160)}`);
}
await section('words', async () => {
  log('pure words');
  const now = Date.UTC(2026, 10, 12, 12, 0);
  // W1/W2 · the draft card's states
  check(W.DRAFT.opening === 'Opening the website…' && /RETRY/.test(W.DRAFT.failed) && /RETRY/.test(W.DRAFT.offline) && /^No draft yet/.test(W.DRAFT.nothing), `[W1 draft] its words read "${W.DRAFT.opening}" / "${W.DRAFT.failed}"`);
  const dc = nocomments(src('features/workshop/draftcard.ts'));
  check(dc.includes('waiting(card, DRAFT.opening)') && dc.includes('button(DRAFT.retry') && !/Loading the website|not ready to show yet/.test(dc), '[W1 draft] the draft card is not drawn from the words');
  // W3 · WHAT'S NEW counts the week and says when nothing is new
  const list = [{ day: '2026-11-10' }, { day: '2026-11-05' }, { day: '2026-10-31' }];
  const sp = W.splitWeek(list, now);
  check(sp.week.length === 2 && sp.earlier.length === 1 && W.newCount(2) === '2 THIS WEEK' && W.newCount(0) === 'NOTHING NEW' && W.NOTHING_NEW === 'Nothing new since you last looked.', `[W3 whats new] splits ${sp.week.length}/${sp.earlier.length}; reads "${W.newCount(0)}" / "${W.NOTHING_NEW}"`);
  check(W.earlierWords(11, false) === 'Show 11 earlier' && W.earlierWords(11, true) === 'Show fewer', `[W3 whats new] the key reads "${W.earlierWords(11, false)}"`);
  // W4 · a project says where it has got to
  const run = { status: 'active', pace: 'slow', updated: now - 3 * 60_000, steps: [{ status: 'done' }, { status: 'doing' }, { status: 'todo' }] };
  check(W.projectWords(run, now) === 'RUNNING · step 2 of 3 · a step every 20 minutes · 3 minutes ago', `[W4 project] a running one reads "${W.projectWords(run, now)}"`);
  check(W.projectWords({ ...run, status: 'paused', steps: [{ status: 'done' }, { status: 'failed' }, { status: 'todo' }] }, now) === 'PAUSED · step 2 didn’t work · a step every 20 minutes · 3 minutes ago' && W.projectWords({ ...run, status: 'done', kind: 'app' }, now).startsWith('FINISHED · 1 of 3 done'), `[W4 project] a stopped one reads "${W.projectWords({ ...run, status: 'paused', steps: [{ status: 'done' }, { status: 'failed' }, { status: 'todo' }] }, now)}"`);
  // W5 · nothing being made: the one next thing
  check(words(W.PROJECTS_NONE.line) <= 20 && W.PROJECTS_NONE.key === 'ASK FOR ONE' && /^No signal; this is from \d\d:\d\d\.$/.test(W.offlineWords(now)), `[W5 projects] none reads "${W.PROJECTS_NONE.head} ${W.PROJECTS_NONE.line}"`);
  const wi = nocomments(src('features/workshop/index.ts'));
  check(wi.includes('projectWords(p)') && wi.includes('PROJECTS_NONE.key') && wi.includes('splitWeek(WHATS_NEW)') && !/Nothing running|THIS WEEK`/.test(wi), '[W3 W4 W5] the Workshop is not drawn from the words');

  // S1 · one loading line; S2 · a fetch with its size; S4 · the no-hit line; S5 · the credit line
  check(S.LOADING === 'Loading the studio…', `[S1 loading] reads "${S.LOADING}"`);
  check(S.fetchWords('Oak chair', 2400) === 'Fetching “Oak chair”, 2.4 MB…' && S.fetchWords('Mug', 800) === 'Fetching “Mug”, 800 KB…' && S.fetchWords('Kettle', 0) === 'Fetching “Kettle”…', `[S2 fetch] reads "${S.fetchWords('Oak chair', 2400)}" / "${S.fetchWords('Kettle', 0)}"`);
  const nh = S.noHitWords('zzqx', '');
  check(/“zzqx”/.test(nh) && /Try a plainer word/.test(nh) && words(nh) <= 20 && /EVERY SHELF/.test(S.noHitWords('zzqx', 'Furniture')), `[S4 no hit] reads "${nh}"`);
  check(S.cardCredit({ author: 'SV Garip', licence: 'CC BY 4.0' }) === 'by SV Garip · CC BY 4.0', `[S5 credit] reads "${S.cardCredit({ author: 'SV Garip', licence: 'CC BY 4.0' })}"`);
  check(/^I couldn’t open “Kettle”\./.test(S.openFailWords('Kettle', 'x')) && S.OPEN_FAIL_TRY === 'TRY AGAIN' && !/WebGL/.test(S.NO_3D), `[S3 open fails] reads "${S.openFailWords('Kettle', 'x')}"`);
  const si = nocomments(src('features/studio/index.ts'));
  check(si.includes('waiting(view, LOADING)') && si.includes('waiting(view, fetchWords(') && si.includes('cardCredit(it)') && si.includes('noHitWords(q, group)') && !/loading the lab|Opening the studio…|fetching \$\{it\.name\}/.test(si), '[S1 S2 S4 S5] the studio is not drawn from the words');
  check(!/toast\(errText\(e, `open the model`\)/.test(si) && si.includes('OPEN_FAIL_TRY'), '[S3 open fails] a failed open still toasts what the screen already says');
  const pn = (t) => t.split(/(?<=[.!?])\s+/).filter((x) => words(x) > 20);
  check(!pn(`${S.MAKE_NOTE} ${S.PHOTO_NOTE}`).length && !/Hugging|TRELLIS|Stable Fast|token|generator|queue/.test(`${S.MAKE_NOTE} ${S.PHOTO_NOTE} ${S.MAKE_WAIT} ${S.PHOTO_WAIT}`), '[S7 make notes] a MAKE · PHOTO line is long or says a maker’s name');

  // P1 · the walkway with its number and the rule; P2 · WILL IT FIT? says why; P3 · DESIGN refuses and tells the two outs apart; P4 · no room says what to try
  const gw = P.gapWords([{ a: 'a', b: 'b', cm: 62 }, { a: 'b', b: 'c', cm: 66 }], (id) => ({ a: 'sofa', b: 'TV unit', c: 'chair' })[id]);
  check(gw === '62 cm between the sofa and the TV unit: under the 70 cm a walkway needs (red). 1 more gap is tight too.' && /^Walkways clear/.test(P.gapWords([], () => '')), `[P1 walkway] reads "${gw}"`);
  check(/^Its 900 cm side is longer than the room’s longest, 420 cm\.$/.test(P.fitWhy(900, 60, { w: 420, d: 360 })) && /wider than the room’s shortest, 360/.test(P.fitWhy(400, 380, { w: 420, d: 360 })) && words(P.FIT_EMPTY) <= 14, `[P2 fit] says why: "${P.fitWhy(900, 60, { w: 420, d: 360 })}"`);
  check(words(P.DESIGN_EMPTY) <= 20 && /brain/.test(P.DESIGN_BRAIN_OUT) && !/phone is offline/.test(P.DESIGN_BRAIN_OUT) && /this phone is offline/.test(P.DESIGN_OFFLINE), `[P3 design] reads "${P.DESIGN_EMPTY}" / "${P.DESIGN_BRAIN_OUT}"`);
  check(['No walls found: is it a floor plan?', 'Walls found, but no closed rooms: x', 'No floor in view: x', 'No walls in view: x', 'No walls could be measured in those photos', 'The plan found could not be made into rooms'].every((e) => /^I /.test(P.noRoomWords(e) ?? '')) && P.noRoomWords('boom') === null, `[P4 no room] reads "${P.noRoomWords('No walls found: is it a floor plan?')}"`);
  const sx = nocomments(src('features/space/index.ts'));
  check(sx.includes('gapWords(gaps') && sx.includes('fitWhy(') && !/under \$\{WALKWAY\} cm \(red\)/.test(sx) && !/toast\('Type its width and depth in cm', 'warn'\);\s*\n\s*const \{ room, items \}/.test(sx), '[P1 P2] SPACE is not drawn from the words');

  // P5 · a refusal in his words stays whole (space.spec's own check was red on the base: 400 cm read as an error code)
  const HW = await pure('apps/web/src/ui/hisWords.ts');
  const rr = src('space/rooms.ts');
  // (rooms.ts marks it through POLISH 1's helper, inHisWords, which is the same mark: the throw itself and the helper are both checked)
  check(/throw inHisWords\(`\$\{room\.name\} at \$\{W\} × \$\{D\} cm would run into/.test(rr) && /would run into/.test(HW.sayError(HW.inHisWords('Room 1 at 600 × 400 cm would run into Room 2: move or resize Room 2 first'), 'do that in the room')), '[P5 refusal] growing a room into the next says "I could not do that" instead of why');
  // B1 · a wrong number beside its field; B2 · no number without its unit; B3/B4 · the tunnel
  check(B.badNumber('Span', 'abc', 'm') === '“abc” isn’t a number I can read. Type the span in m, like 12.' && B.badNumber('Span', '', 'm') === 'Span is empty. Type a number in m.', `[B1 wrong input] reads "${B.badNumber('Span', 'abc', 'm')}"`);
  check(B.unitNote('Cl', '0.499') === 'a coefficient, no unit' && B.unitNote('Slenderness KL/r', '76.6') === 'a ratio, no unit' && B.unitNote('Max moment', '3.75 kNm') === '' && B.unitNote('Steps', '147') === '' && B.noteWith('the lattice’s', 'a ratio, no unit') === 'the lattice’s · a ratio, no unit', '[B2 units] a bare number does not say it has no unit');
  check(B.TUNNEL.starting === 'Starting the wind…' && /RETRY/.test(B.TUNNEL.stopped) && /RETRY/.test(B.TUNNEL.cannot), `[B3 B4 tunnel] reads "${B.TUNNEL.starting}" / "${B.TUNNEL.stopped}"`);
  const wc = nocomments(src('features/workbench/card.ts'));
  check(wc.includes('unitNote(l.label, l.value)') && nocomments(src('features/workbench/tunnel.ts')).includes('unitNote(label, value)'), '[B2 units] the cards are not drawn from the words');

  // R1 · a report's state with when; R2 · empty and loading; R3 · GitHub missing in his words
  const nowR = Date.UTC(2026, 10, 12, 12, 0);
  check(R.jobState({ status: 'failed', at: nowR - 7_200_000 }, nowR) === 'Didn’t finish · 12 Nov' && R.jobState({ status: 'queued', at: nowR - 20_000 }, nowR) === 'Starting · just now' && R.jobState({ status: 'running', at: nowR - 240_000 }, nowR) === 'Running · 4 min' && /^Ready · 11 Nov$/.test(R.jobState({ status: 'done', at: nowR - 86_400_000, finishedAt: nowR - 80_000_000 }, nowR)), `[R1 rows] read "${R.jobState({ status: 'failed', at: nowR - 7_200_000 }, nowR)}" / "${R.jobState({ status: 'queued', at: nowR - 20_000 }, nowR)}"`);
  check(R.REPORTS_NONE.key === 'PASTE A LINK' && /^Looking/.test(R.REPORTS_LOADING) && !/System → Keys|REA by/.test(R.GITHUB_NOTE), `[R2 empty] reads "${R.REPORTS_NONE.head} ${R.REPORTS_NONE.line}"`);
  check(/System, then Keys/.test(R.GITHUB_NOTE) && /CONNECT GITHUB/.test(R.START_REFUSED) && R.GITHUB_NOTE !== R.START_REFUSED && words(R.REVERSE_SUB) <= 20, `[R3 github] reads "${R.GITHUB_NOTE}" / "${R.START_REFUSED}"`);
  const rv = nocomments(src('features/reverse/index.ts'));
  check(rv.includes('jobState(j)') && rv.includes('START_REFUSED') && rv.includes('REPORTS_NONE.key') && !/GitHub is not connected yet, so a report/.test(rv), '[R1 R2 R3] REVERSE is not drawn from the words');

  // C1 · the unit named back; C2 · a file it cannot read; the phrases that open CONVERT and HOUSE
  check(/^I don’t know “furlongs”\. I know these lengths: mm, cm, m, km, inches, feet, yards, miles/.test(C.unitsWhy('12 furlongs to km')) && /^kg is a weight and km is a length/.test(C.unitsWhy('5 kg in km')) && /nearest I know: km\./.test(C.unitsWhy('5 kilometrs in miles')) && C.unitsWhy('') === C.UNITS_HINT, `[C1 units] reads "${C.unitsWhy('12 furlongs to km')}" / "${C.unitsWhy('5 kilometrs in miles')}"`);
  check(/^I can’t read “mystery\.xyz”\./.test(C.unreadable('mystery.xyz')) && words(C.unreadable('x')) <= 20, `[C2 unreadable] reads "${C.unreadable('mystery.xyz')}"`);
  // H1 · an empty house says what to do
  check(/^Nothing in your house yet/.test(H.HOUSE_NONE.head) && /REFRESH/.test(H.HOUSE_NONE.line) && /^Reading/.test(H.READING) && /my brain/.test(H.BRAIN_OUT), `[H1 house] reads "${H.HOUSE_NONE.head} ${H.HOUSE_NONE.line}"`);
  // the phrases are answered on the phone, not by the brain: every one is a local ask
  const WB = await pure('packages/shared/src/workbench/index.ts');
  const HS = await pure('packages/shared/src/house.ts');
  const CV = await pure('apps/web/src/convert/asks.ts');
  const UN = await pure('apps/web/src/convert/units.ts');
  const notLocal = [...B.PHRASES.filter((x) => !WB.workbenchAsked(x)), ...C.PHRASES.filter((x) => !(CV.convertAsked(x) || UN.unitsAsked(x))), ...H.PHRASES.filter((x) => !HS.houseAsked(x))];
  check(!notLocal.length && B.PHRASES.length >= 2 && C.PHRASES.length >= 2 && H.PHRASES.length >= 2, `[phrases] a listed phrase is not answered on the phone: ${notLocal.join(' | ')}`);
});

// ================================================================ the phone
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const j = (v, status = 200) => ({ status, contentType: 'application/json', body: JSON.stringify(v) });

/** One phone in The Scan: every waiting line counted (window.__waits), outside hosts shut. `store`: localStorage to start with. `body`: the text size. */
async function phone(viewport, o = {}) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: o.still ? 2 : 1, isMobile: true, hasTouch: true, ...UK, serviceWorkers: 'block' });
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.addInitScript(({ key, body, store }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, theme: 'reactor', favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    for (const [k, v] of Object.entries(store ?? {})) localStorage.setItem(k, v);
    window.__ghostyHero = true;
    window.__waits = [];
    new MutationObserver((ms) => {
      const lines = (n) => (n.nodeType === 1 ? [...(n.matches?.('[data-wait]') ? [n] : []), ...n.querySelectorAll('[data-wait]')] : []);
      for (const m of ms) for (const n of m.addedNodes) for (const l of lines(n)) window.__waits.push(l.dataset.wait);
    }).observe(document, { childList: true, subtree: true });
  }, { key: KEY, body: o.body ?? 0, store: o.store ?? {} });
  return { ctx, page, boot: async () => { await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60000 }); await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 }); await page.waitForTimeout(900); } };
}
const open = async (vp, o = {}) => {
  const p = await phone(vp, o);
  live.push(p.ctx);
  await o.before?.(p);
  await p.boot();
  return p;
};
const go = async (page, id, ms = 1800) => {
  await page.evaluate((i) => (location.hash = i), id);
  await page.waitForSelector(`#pg-${id}`, { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(ms);
};
const txt = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length).map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()).join(' | '), sel);
const small = (page, sel) =>
  page.$$eval(`${sel} :is(button, input:not([type=hidden]):not([type=file]), textarea, select, [role=button], [role=tab])`, (els) =>
    els
      .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
      .map((e) => {
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
const GL = process.env.NO_GL_SHOTS === '1' && process.env.MAKE_GL !== '1';
const still = (page, name, vp, gl = false) => (vp.width === 440 && !(gl && GL) ? page.screenshot({ path: `${out}/makepass-${name}-440-${STILL}.png`, timeout: 20000 }).catch(() => undefined) : undefined);
const waits = (page) => page.evaluate(() => window.__waits.slice());
const said = (page) => page.evaluate(() => window.__ghosty.wait?.said ?? []);

/** The bar every screen answers to: nothing sideways, every control 44 pt, no raw string on the page. */
async function bar(page, tag, id, root = `#pg-${id}`) {
  check(!(await sideways(page, id)), `${tag}: sideways`);
  const s = await small(page, root);
  check(!s.length, `${tag}: under 44 pt: ${s.join(', ')}`);
  const t = await txt(page, `${root} .pn:not([hidden]) *`);
  check(!RAW.test(t), `${tag}: a raw string on the page: ${(RAW.exec(t) ?? [''])[0]}`);
}
const step = (n, status) => ({ n, title: `Step ${n}`, instruction: 'x', status });

// ================================================================ THE WORKSHOP
for (const vp of [PHONE, PHONE2]) {
  if (!on('workshop')) break;
  const T = `[${vp.width}]`;
  await section('workshop', async () => {
    log(`workshop ${vp.width}`);
    const now = Date.now();
    let drafts = 0;
    const list = [
      { id: 'p1', kind: 'research', title: 'Compare kettles', status: 'active', pace: 'slow', updated: now - 180000, steps: [step(1, 'done'), step(2, 'doing'), step(3, 'todo')] },
      { id: 'p2', kind: 'research', title: 'A thing that failed', status: 'paused', pace: 'slow', updated: now - 3600000, note: 'step 2 failed (3 of 3): HTTP 429 rate limit', steps: [step(1, 'done'), step(2, 'failed'), step(3, 'todo')] },
      { id: 'p3', kind: 'site', title: 'Site: Fade and Co', status: 'done', pace: 'fast', updated: now - 86400000, steps: [1, 2, 3, 4, 5].map((n) => step(n, 'done')) },
    ];
    const { ctx, page } = await open(vp, {
      still: vp.width === 440,
      before: async ({ ctx }) => {
        await ctx.route('**/api/projects', (r) => (r.request().method() === 'GET' ? r.fulfill(j({ projects: list })) : r.fallback()));
        await ctx.route('**/api/projects/p3/draft', (r) => (drafts++, r.fulfill(j({ error: 'boom' }, 500))));
      },
    });
    await go(page, 'workshop', 2500);
    // W3 · WHAT'S NEW: the week's count told truly, nothing-new said, the earlier ones behind a key that says how many; GOT IT 44 pt
    const WN = await pure('apps/web/src/state/whatsnew.ts');
    const wnList = WN.WHATS_NEW;
    const sp = W.splitWeek(wnList, Date.now());
    const wnPanel = await page.evaluate(() => { const p = document.querySelector('#pg-workshop .pn.whatsnew'); return p ? { status: p.querySelector('h3 small')?.textContent ?? '', none: p.querySelector('.wnnone')?.textContent ?? '', noneState: p.querySelector('.wnnone')?.dataset.state ?? '', all: p.querySelector('.wnall')?.textContent ?? '', got: (() => { const r = p.querySelector('.wngot')?.getBoundingClientRect(); return r ? Math.round(r.height) : 0; })() } : null; });
    check(!!wnPanel, `${T} [W3 whats new] no WHAT'S NEW panel on a fresh phone`);
    if (wnPanel) {
      check(wnPanel.status.toUpperCase() === W.newCount(sp.week.length), `${T} [W3 whats new] the count reads "${wnPanel.status}" for ${sp.week.length} this week (the list has ${wnList.length})`);
      if (!sp.week.length) check(wnPanel.none === W.NOTHING_NEW && wnPanel.noneState === 'empty', `${T} [W3 whats new] with nothing this week it reads "${wnPanel.none}" (${wnPanel.noneState})`);
      if (sp.earlier.length) check(wnPanel.all === W.earlierWords(sp.earlier.length, false), `${T} [W3 whats new] the key to the earlier ones reads "${wnPanel.all}"`);
      check(wnPanel.got >= 44, `${T} [W3 whats new] GOT IT is ${wnPanel.got} high`);
    }
    // W4 · a project says where it has got to; W5 · a paused one says its step didn't work
    const lines = await page.$$eval('#pg-workshop .change.project .ct small:not(.pnow)', (els) => els.map((e) => e.textContent ?? ''));
    check(lines.some((l) => /^RUNNING · step 2 of 3 · a step every 20 minutes · 3 minutes ago$/.test(l)), `${T} [W4 project] a running project reads: ${lines.join(' | ')}`);
    check(lines.some((l) => /^PAUSED · step 2 didn’t work · a step every 20 minutes · /.test(l)), `${T} [W4 project] a stopped project reads: ${lines.join(' | ')}`);
    // W1/W2 · the draft card: a wait said, a failure said in his words with RETRY, the same asked again
    const card = '#pg-workshop .draftcard';
    check(await until(page, (s) => document.querySelector(s)?.dataset.state === 'error', card, 15000), `${T} [W2 draft] a draft that would not come drew no error state: "${await txt(page, card)}"`);
    const dtext = await txt(page, card);
    check(dtext.includes(W.DRAFT.failed.split(' Tap')[0]) && /RETRY/.test(dtext) && !RAW.test(dtext), `${T} [W2 draft] reads "${dtext}"`);
    check((await page.locator(`${card} button`, { hasText: /^retry$/i }).count()) === 1, `${T} [W2 draft] no RETRY key`);
    const before = drafts;
    await page.locator(`${card} button`, { hasText: /^retry$/i }).click({ force: true, timeout: 5000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    check((await waits(page)).filter((x) => x === W.DRAFT.opening).length >= 2, `${T} [W1 draft] RETRY did not say the wait again: ${(await waits(page)).filter((x) => /website/.test(x)).join(' | ')}`);
    check(drafts > before, `${T} [W2 draft] RETRY never asked the brain again`);
    // W5 · none being made: the one next thing is the box above it
    await ctx.unroute('**/api/projects');
    await ctx.route('**/api/projects', (r) => (r.request().method() === 'GET' ? r.fulfill(j({ projects: [] })) : r.fallback()));
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(500);
    await go(page, 'workshop', 2000);
    check(await until(page, () => !!document.querySelector('#pg-workshop .empty[data-state="empty"]'), null, 8000), `${T} [W5 projects] with none being made the panel drew no empty state: "${(await txt(page, '#pg-workshop .pn')).slice(0, 200)}"`);
    const none = await txt(page, '#pg-workshop .empty[data-state="empty"]');
    check(none.includes(W.PROJECTS_NONE.head) && none.includes(W.PROJECTS_NONE.line) && /ASK FOR ONE/i.test(none), `${T} [W5 projects] none reads "${none}"`);
    await page.locator('#pg-workshop .empty[data-state="empty"] button').click({ force: true, timeout: 5000 }).catch(() => undefined);
    check(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'What should Ghosty build'), `${T} [W5 projects] ASK FOR ONE did not put him in the box`);
    await still(page, 'workshop', vp);
    await bar(page, `${T} [workshop]`, 'workshop');
    // no signal with a list kept: said, and when
    await ctx.unroute('**/api/projects');
    await ctx.route('**/api/projects', (r) => (r.request().method() === 'GET' ? r.fulfill(j({ projects: list })) : r.fallback()));
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(400);
    await go(page, 'workshop', 1800);
    await ctx.setOffline(true);
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(400);
    await page.evaluate(() => (location.hash = 'workshop'));
    check(await until(page, () => /^No signal; this is from \d\d:\d\d\.$/.test(document.querySelector('#pg-workshop .pn [data-state="offline"]')?.textContent ?? ''), null, 10000), `${T} [W5 projects] with no signal the projects said: "${(await txt(page, '#pg-workshop [data-state="offline"]')) || 'nothing'}"`);
    await ctx.setOffline(false);
    await ctx.close();
  });
}

// ================================================================ THE 3D STUDIO
for (const vp of [PHONE, PHONE2]) {
  if (!on('studio')) break;
  const T = `[${vp.width}]`;
  await section('studio', async () => {
    log(`studio ${vp.width}`);
    const ov = 'ov:' + (await (await fetch(`${base}/data/models3d.json`)).json()).items[0][0];
    let hf = 0;
    const { ctx, page } = await open(vp, {
      still: vp.width === 440,
      before: async ({ ctx }) => {
        await ctx.route(/huggingface\.co|\.hf\.co/, (r) => (hf++, r.abort()));
      },
    });
    await go(page, 'studio', 300);
    // S1 · three.js's load said once, in one voice
    check(await until(page, () => !!window.__ghosty?.studio?.state().running, null, 40000), `${T} [S1 loading] the studio never drew`);
    await page.waitForTimeout(1500);
    const w1 = await said(page);
    check(w1.filter((x) => x === S.LOADING).length === 1 && !w1.includes('Opening the studio…'), `${T} [S1 loading] said ${w1.filter((x) => /studio/.test(x)).join(' | ') || 'nothing'} (want "${S.LOADING}" once)`);
    check(!(await page.evaluate(() => !!document.querySelector('#pg-studio [data-wait="Loading the studio…"]'))), `${T} [S1 loading] the line is still up after the first scene`);
    check(!/loading the lab/i.test(await txt(page, '#pg-studio .studiostat')), `${T} [S1 loading] a second voice says the same wait in the HUD`);
    // S6 · TAKE APART's slider 44 pt, and the bar's keys
    const sl = await page.evaluate(() => Math.round(document.querySelector('#pg-studio .studioslider').getBoundingClientRect().height));
    check(sl >= 44, `${T} [S6 slider] the slider is ${sl} pt high`);
    await bar(page, `${T} [S6 controls] the studio`, 'studio');
    // S5 · the card's credit and licence in one plain line
    await page.evaluate(() => window.__ghosty.studio.search('kettle'));
    check(await until(page, () => document.querySelectorAll('#pg-studio .studiocard').length > 0, null, 15000), `${T} [S5 credit] a search for kettle showed no card`);
    const by = await page.$eval('#pg-studio .studiocard .studiocardby', (e) => e.textContent ?? '');
    check(/^by .+ · (CC0|CC BY 4\.0)$/.test(by), `${T} [S5 credit] a card reads "${by}"`);
    await still(page, 'studio', vp, true);
    // S4 · a search with no hit says what to try
    await page.evaluate(() => window.__ghosty.studio.search('zzqxqzz'));
    check(await until(page, () => document.querySelector('#pg-studio .studiopane .note[data-state="empty"]') !== null, null, 8000), `${T} [S4 no hit] a search with no hit drew no empty state`);
    const nh = await txt(page, '#pg-studio .studiopane .note[data-state="empty"]');
    check(nh === S.noHitWords('zzqxqzz', ''), `${T} [S4 no hit] reads "${nh}"`);
    // S2 · a fetch said with its size; S3 · a model that will not come: said once, in his words, with TRY AGAIN and its own page
    await page.evaluate(() => window.__ghosty.studio.search('', ''));
    const w0 = (await waits(page)).length;
    await page.evaluate((i) => window.__ghosty.studio.openCatalog(i), ov).catch(() => undefined);
    check(await until(page, () => !!document.querySelector('#pg-studio .studiofail'), null, 20000), `${T} [S3 open fails] a model that would not come drew no failure: "${await txt(page, '#pg-studio .studiocredits')}"`);
    const fetched = (await waits(page)).slice(w0).find((x) => /^Fetching “/.test(x)) ?? '';
    check(/^Fetching “.+”, \d+(\.\d)? (KB|MB)…$/.test(fetched), `${T} [S2 fetch] the fetch said "${fetched || 'nothing'}"`);
    const ft = await txt(page, '#pg-studio .studiofail');
    check(/^I couldn’t open “/.test(ft) && !RAW.test(ft) && words(ft.split('TRY AGAIN')[0]) <= 30, `${T} [S3 open fails] reads "${ft}"`);
    check((await page.locator('#pg-studio .studiofail button', { hasText: /^try again$/i }).count()) === 1 && (await page.locator('#pg-studio .studiofail a.studiosource').count()) === 1, `${T} [S3 open fails] no TRY AGAIN or no link to the model’s own page`);
    check((await page.locator('#toasts .toast', { hasText: /couldn’t open|lost the signal/ }).count()) === 0, `${T} [S3 open fails] a toast says the same words again`);
    const hf1 = hf;
    await page.locator('#pg-studio .studiofail button', { hasText: /^try again$/i }).click({ force: true, timeout: 5000 }).catch(() => undefined);
    check((await until(page, () => !!document.querySelector('#pg-studio .studiofail'), null, 15000)) && hf > hf1, `${T} [S3 open fails] TRY AGAIN did not fetch again (${hf1} → ${hf})`);
    // S7 · MAKE · PHOTO with no photo says so, and its lines are short
    await page.evaluate(() => window.__ghosty.studio.show('make'));
    await page.waitForTimeout(400);
    const makeTxt = await txt(page, '#pg-studio .studiopane > .note');
    check(!/Hugging|TRELLIS|Stable Fast|token|generator|queue/.test(makeTxt), `${T} [S7 make notes] the lines still name a maker: ${makeTxt.slice(0, 160)}`);
    page.on('filechooser', (fc) => fc.setFiles([]).catch(() => undefined));
    await page.locator('#pg-studio button', { hasText: /^make 3-d$/i }).click({ force: true, timeout: 5000 }).catch(() => undefined);
    check((await txt(page, '#pg-studio .studioreadout[data-state="empty"]')) === S.NO_PHOTO, `${T} [S7 make photo] with no photo it says: "${await txt(page, '#pg-studio .studioreadout')}"`);
    await bar(page, `${T} [S6 controls] MAKE · PHOTO`, 'studio');
    // the 3-D engine's pane, read through the page's own state as engine3d.spec does
    await page.evaluate(() => window.__ghosty.studio.show('engine'));
    await page.waitForTimeout(1500);
    const eng = await txt(page, '#pg-studio .studiopanel');
    check(/FIRST ESTIMATE, NEVER CERTIFIED/i.test(eng) && /Nothing saved yet/.test(eng), `${T} [engine] the pane's first-estimate line or its empty scene went: ${eng.slice(0, 160)}`);
    await ctx.close();
  });
}

// ================================================================ SPACE
for (const vp of [PHONE, PHONE2]) {
  if (!on('space')) break;
  const T = `[${vp.width}]`;
  await section('space', async () => {
    log(`space ${vp.width}`);
    const plan = { plan: { v: 1, room: { w: 420, d: 360 }, items: [{ id: 'a', kind: 'sofa3', label: 'Sofa, 3-seater', w: 150, d: 90, x: 0, y: 0, rot: 0 }, { id: 'b', kind: 'tv', label: 'TV unit', w: 150, d: 40, x: 212, y: 0, rot: 0 }] }, measures: [] };
    const { ctx, page } = await open(vp, { still: vp.width === 440, store: { 'ghosty.space': JSON.stringify(plan) } });
    await go(page, 'space', 2000);
    // P1 · a piece too close: the centimetres and the rule
    const info = await txt(page, '#pg-space .spaceinfo');
    check(/62 cm between the sofa and the TV unit: under the 70 cm a walkway needs \(red\)\./.test(info), `${T} [P1 walkway] the planner reads "${info}"`);
    await still(page, 'space', vp);
    // P2 · WILL IT FIT?
    await page.locator('#pg-space .spacefit button', { hasText: /^check$/i }).click({ force: true, timeout: 5000 }).catch(() => undefined);
    check((await txt(page, '#pg-space .spacefitout[data-state="empty"]')) === P.FIT_EMPTY && (await page.locator('#toasts .toast', { hasText: /width and depth/ }).count()) === 0, `${T} [P2 fit] with nothing typed it says "${await txt(page, '#pg-space .spacefitout')}"`);
    await page.fill('#pg-space .spacefitin input >> nth=0', '900');
    await page.fill('#pg-space .spacefitin input >> nth=1', '60');
    await page.locator('#pg-space .spacefit button', { hasText: /^check$/i }).click({ force: true, timeout: 5000 }).catch(() => undefined);
    const fit = await txt(page, '#pg-space .spacefitout');
    check(/^No: 900 × 60 cm is bigger than the room \(420 × 360 cm\)\. Its 900 cm side is longer than the room’s longest, 420 cm\.$/.test(fit), `${T} [P2 fit] a thing too big reads "${fit}"`);
    // P3 · DESIGN MY HOME: empty words refuse in the card; a dead brain is not a phone with no signal
    await page.evaluate(() => { document.querySelector('.spacehomewords').value = ''; });
    await page.locator('#pg-space .spacehomego').click({ force: true, timeout: 5000 }).catch(() => undefined);
    check((await txt(page, '#pg-space .spacehomestatus[data-state="empty"]')) === P.DESIGN_EMPTY && (await page.locator('#toasts .toast', { hasText: /Describe your home/ }).count()) === 0, `${T} [P3 design] empty words say "${await txt(page, '#pg-space .spacehomestatus')}"`);
    await page.evaluate(() => window.__ghosty.ui.set({ connected: false }));
    await page.waitForTimeout(400);
    check((await txt(page, '#pg-space .spacehomestatus[data-state="error"]')) === P.DESIGN_BRAIN_OUT && /OUT OF REACH/i.test(await txt(page, '#pg-space .spacehomego')), `${T} [P3 design] a dead brain says "${await txt(page, '#pg-space .spacehomestatus')}" on "${await txt(page, '#pg-space .spacehomego')}"`);
    await page.evaluate(() => window.__ghosty.ui.set({ connected: true }));
    await ctx.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForTimeout(400);
    check((await txt(page, '#pg-space .spacehomestatus[data-state="offline"]')) === P.DESIGN_OFFLINE, `${T} [P3 design] no signal says "${await txt(page, '#pg-space .spacehomestatus')}"`);
    await ctx.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    // P4 · a photo that finds no room says what to try
    await page.locator('#pg-space .spacephotokind button', { hasText: /^drawn plan$/i }).click({ force: true, timeout: 5000 }).catch(() => undefined);
    const blank = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
    await page.setInputFiles('#pg-space input[type=file][aria-label="Pick photos of a floor plan or of the room"]', { name: 'wall.png', mimeType: 'image/png', buffer: blank });
    check(await until(page, () => document.querySelector('#pg-space .spacephotonotes')?.dataset.state === 'error', null, 120000), `${T} [P4 no room] a photo with no room in it drew no error: "${await txt(page, '#pg-space .spacephotonotes')}"`);
    const nr = await txt(page, '#pg-space .spacephotonotes');
    check(nr === P.noRoomWords('No walls found'), `${T} [P4 no room] reads "${nr}"`);
    await bar(page, `${T} [space]`, 'space');
    await ctx.close();
  });
}

// ================================================================ THE WORKBENCH
for (const vp of [PHONE, PHONE2]) {
  if (!on('workbench')) break;
  const T = `[${vp.width}]`;
  await section('workbench', async () => {
    log(`workbench ${vp.width}`);
    const { ctx, page } = await open(vp, { still: vp.width === 440 });
    await go(page, 'workbench', 300);
    // B3 · the wind says it is starting, and the line goes with the first numbers
    check(await until(page, () => window.__ghosty?.tunnel?.ready === true, null, 40000), `${T} [B3 tunnel] the wind never gave its first numbers`);
    const w = await waits(page);
    check(w.includes(B.TUNNEL.starting), `${T} [B3 tunnel] the start said ${w.filter((x) => /wind|tunnel/i.test(x)).join(' | ') || 'nothing'} (want "${B.TUNNEL.starting}")`);
    check(!(await page.evaluate(() => !!document.querySelector('#pg-workbench [data-wait="Starting the wind…"]'))), `${T} [B3 tunnel] the starting line is still up after the first numbers`);
    check(/FIRST ESTIMATE · NOT CERTIFIED/.test(await txt(page, '#pg-workbench .wb-tunnel .wblabel')), `${T} [B3 tunnel] the tunnel's card lost FIRST ESTIMATE · NOT CERTIFIED`);
    await still(page, 'tunnel', vp);
    // B5 · the phrases that open it
    const says = await page.evaluate(() => document.querySelector('#pg-workbench .pkphrases')?.dataset.says ?? '');
    check(B.PHRASES.every((x) => says.split('|').includes(x)) && words(await txt(page, '#pg-workbench .pkphrases')) <= 16, `${T} [B5 phrases] the Workbench lists "${says}"`);
    // B2 · no number without its unit, or its words for having none; and the card keeps FIRST ESTIMATE · NOT CERTIFIED everywhere
    const rows = await page.$$eval('#pg-workbench .wbcard .wbline', (els) => els.map((e) => ({ k: e.querySelector('.k span')?.textContent ?? '', n: e.querySelector('.n')?.textContent ?? '', v: e.querySelector('.v')?.textContent ?? '' })));
    const bare = rows.filter((r) => !/[A-Za-zΩ°%µ£]/.test(r.v) && !/no unit/.test(r.n) && !/^steps$/i.test(r.k) && !/^[\d.,\s]*:\s*\d+$/.test(r.v) && r.v !== '—' && r.v !== '--' && !/^\d\d:\d\d/.test(r.v));
    check(rows.length > 40 && !bare.length, `${T} [B2 units] ${rows.length} numbers; without a unit or its words: ${bare.map((r) => `${r.k}=${r.v}`).join(', ')}`);
    const cards = await page.$$eval('#pg-workbench .wbcard', (els) => els.filter((e) => !/FIRST ESTIMATE · NOT CERTIFIED/.test(e.querySelector('.wblabel')?.textContent ?? '')).length);
    check(cards === 0, `${T} [B2 units] ${cards} card(s) without FIRST ESTIMATE · NOT CERTIFIED`);
    // B1 · a number typed wrong is said beside its field
    await page.evaluate(() => (location.hash = 'workbench?beam'));
    await page.waitForTimeout(1200);
    const span = page.locator('#pg-workbench .wb-beam .wbf[data-key] input[inputmode=decimal]').first();
    const why = '#pg-workbench .wb-beam .wbwhy:not([hidden])';
    await still(page, 'workbench', vp);
    await span.fill('abc');
    const label = await span.evaluate((e) => e.closest('.wbf')?.querySelector('label')?.textContent ?? '');
    const unitW = await span.evaluate((e) => e.closest('.wbf')?.querySelector('.wbu')?.textContent ?? '');
    check((await txt(page, why)) === B.badNumber(label, 'abc', unitW), `${T} [B1 wrong input] "abc" reads "${await txt(page, why)}" (want "${B.badNumber(label, 'abc', unitW)}")`);
    check((await span.getAttribute('aria-invalid')) === 'true' && !!(await span.getAttribute('aria-describedby')), `${T} [B1 wrong input] the field is not marked invalid and described`);
    await span.fill('');
    check((await txt(page, why)) === B.badNumber(label, '', unitW) && (await page.locator(`${why}[data-state="empty"]`).count()) === 1, `${T} [B1 wrong input] blank reads "${await txt(page, why)}"`);
    await span.fill('3');
    check((await page.locator(why).count()) === 0, `${T} [B1 wrong input] the line stays after a good number`);
    await bar(page, `${T} [workbench]`, 'workbench');
    await ctx.close();
    // B4 · the tunnel with the worker dead: said, with RETRY; RETRY brings the wind back when the worker does
    let dead = true;
    const c2 = await open(vp, { before: async ({ ctx }) => { await ctx.route('**/textures.worker.js', (r) => (dead ? r.fulfill({ status: 200, contentType: 'application/javascript', body: 'throw new Error("dead");' }) : r.fallback())); } });
    await go(c2.page, 'workbench', 300);
    check(await until(c2.page, () => document.querySelector('#pg-workbench .wb-tunnel .wbout')?.dataset.state === 'error', null, 25000), `${T} [B4 tunnel dead] a worker that died left: "${(await txt(c2.page, '#pg-workbench .wb-tunnel .wbout')).slice(0, 160)}"`);
    const tf = await txt(c2.page, '#pg-workbench .wb-tunnel .tunfail');
    check(tf === B.TUNNEL.stopped && !RAW.test(tf), `${T} [B4 tunnel dead] reads "${tf}"`);
    check((await small(c2.page, '#pg-workbench .wb-tunnel .tunfail ~ .row')).length === 0 && /FIRST ESTIMATE · NOT CERTIFIED/.test(await txt(c2.page, '#pg-workbench .wb-tunnel .wblabel')), `${T} [B4 tunnel dead] RETRY is under 44 pt or the label went`);
    dead = false;
    await c2.page.locator('#pg-workbench .wb-tunnel button', { hasText: /^retry$/i }).click({ force: true, timeout: 5000 }).catch(() => undefined);
    check(await until(c2.page, () => window.__ghosty?.tunnel?.ready === true && document.querySelector('#pg-workbench .wb-tunnel .wbout')?.dataset.state !== 'error', null, 30000), `${T} [B4 tunnel dead] RETRY did not bring the wind back`);
    await c2.ctx.close();
  });
}

// ================================================================ REVERSE
for (const vp of [PHONE, PHONE2]) {
  if (!on('reverse')) break;
  const T = `[${vp.width}]`;
  await section('reverse', async () => {
    log(`reverse ${vp.width}`);
    const now = Date.now();
    let jobs = [
      { id: 'j1', target: 'https://bbc.co.uk/', kind: 'web', status: 'running', at: now - 240000 },
      { id: 'j2', target: 'left-pad', kind: 'npm', status: 'failed', at: now - 7200000, error: 'workflow failed' },
      { id: 'j3', target: 'https://example.com/', kind: 'web', status: 'done', at: now - 86400000, finishedAt: now - 86000000 },
      { id: 'j4', target: 'a/b', kind: 'repo', status: 'queued', at: now - 20000 },
    ];
    let delay = 0;
    let openFails = true;
    const { ctx, page } = await open(vp, {
      still: vp.width === 440,
      before: async ({ ctx }) => {
        await ctx.route('**/api/reverse', async (r) => {
          if (r.request().method() !== 'GET') return r.fallback();
          if (delay) await new Promise((x) => setTimeout(x, delay));
          return r.fulfill(j({ jobs }));
        });
        await ctx.route('**/api/reverse/j*', (r) => (openFails ? r.fulfill(j({ error: 'boom' }, 500)) : r.fulfill(j({ job: jobs.find((x) => r.request().url().endsWith(x.id)) }))));
      },
    });
    // R2 · the list not yet read says it is looking (not that there are none)
    delay = 7000;
    await page.evaluate(() => (location.hash = 'reverse'));
    check(await until(page, () => !!document.querySelector('#pg-reverse .empty[data-state="loading"]'), null, 12000), `${T} [R2 empty] before the brain answered the list drew no loading state: "${await txt(page, '#pg-reverse .stackf')}"`);
    check((await txt(page, '#pg-reverse .empty[data-state="loading"]')) === R.REPORTS_LOADING, `${T} [R2 empty] looking reads "${await txt(page, '#pg-reverse .empty[data-state="loading"]')}"`);
    delay = 0;
    await page.waitForFunction(() => document.querySelectorAll('#pg-reverse .rw.link').length >= 4, null, { timeout: 25000 }).catch(() => undefined);
    // R1 · each row says its state and when
    const rows = await page.$$eval('#pg-reverse .rw.link .n', (els) => els.map((e) => e.textContent ?? ''));
    check(rows.some((x) => /^Running · \d+ min$/.test(x)) && rows.some((x) => /^Didn’t finish · \d+ \w{3}$/.test(x)) && rows.some((x) => /^Ready · \d+ \w{3}$/.test(x)) && rows.some((x) => /^Starting · /.test(x)), `${T} [R1 rows] the rows read: ${rows.join(' | ')}`);
    await still(page, 'reverse', vp);
    // R4 · a report that will not open: a wait said, his words, RETRY
    await page.locator('#pg-reverse .rw.link').nth(1).click({ force: true, timeout: 5000 }).catch(() => undefined);
    check(await until(page, () => !!document.querySelector('#pg-reverse .revview [data-state="error"]'), null, 8000), `${T} [R4 report] a report that would not open said: "${await txt(page, '#pg-reverse .revview')}"`);
    check((await waits(page)).includes(R.OPENING) && (await txt(page, '#pg-reverse .revview [data-state="error"]')) === R.OPEN_FAILED && (await page.locator('#pg-reverse .revview button', { hasText: /^retry$/i }).count()) === 1, `${T} [R4 report] the open said ${(await waits(page)).filter((x) => /report/.test(x)).join(' | ') || 'nothing'}, then "${await txt(page, '#pg-reverse .revview')}"`);
    openFails = false;
    await page.locator('#pg-reverse .revview button', { hasText: /^retry$/i }).click({ force: true, timeout: 5000 }).catch(() => undefined);
    check(await until(page, () => /This one didn’t finish/.test(document.querySelector('#pg-reverse .revview')?.textContent ?? ''), null, 8000), `${T} [R4 report] RETRY did not open the report`);
    // R3 · GitHub missing: said once before he types, and, shorter, if he taps START
    await page.locator('#pg-reverse input[aria-label="What to look at"]').fill('');
    await page.locator('#pg-reverse button', { hasText: /^start$/i }).first().click({ force: true, timeout: 5000 }).catch(() => undefined);
    check((await txt(page, '#pg-reverse .revsay[data-state="empty"]')) === `${R.START_EMPTY}.`, `${T} [R3 github] START with nothing says "${await txt(page, '#pg-reverse .revsay')}"`);
    const gh = await txt(page, '#pg-reverse .revgh p');
    check(gh === R.GITHUB_NOTE, `${T} [R3 github] before he types it reads "${gh}"`);
    await page.locator('#pg-reverse input[aria-label="What to look at"]').fill('bbc.co.uk');
    await page.locator('#pg-reverse button', { hasText: /^start$/i }).first().click({ force: true, timeout: 5000 }).catch(() => undefined);
    check(await until(page, () => document.querySelector('#pg-reverse .revsay')?.dataset.state === 'error', null, 12000), `${T} [R3 github] START without GitHub drew no error: "${await txt(page, '#pg-reverse .revsay')}"`);
    check((await txt(page, '#pg-reverse .revsay')) === R.START_REFUSED, `${T} [R3 github] START reads "${await txt(page, '#pg-reverse .revsay')}"`);
    // R2 · none: the one next thing
    jobs = [];
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(400);
    await go(page, 'reverse', 1500);
    check(await until(page, () => !!document.querySelector('#pg-reverse .empty[data-state="empty"]'), null, 8000), `${T} [R2 empty] no reports drew no empty state: "${await txt(page, '#pg-reverse .stackf')}"`);
    const nr = await txt(page, '#pg-reverse .empty[data-state="empty"]');
    check(nr.includes(R.REPORTS_NONE.head) && nr.includes(R.REPORTS_NONE.line) && /PASTE A LINK/i.test(nr), `${T} [R2 empty] none reads "${nr}"`);
    await page.locator('#pg-reverse .empty[data-state="empty"] button').click({ force: true, timeout: 5000 }).catch(() => undefined);
    check(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'What to look at'), `${T} [R2 empty] PASTE A LINK did not put him in the box`);
    await bar(page, `${T} [reverse]`, 'reverse');
    await ctx.close();
  });
}

// ================================================================ CONVERT and HOUSE
for (const vp of [PHONE, PHONE2]) {
  if (!on('convert')) break;
  const T = `[${vp.width}]`;
  await section('convert', async () => {
    log(`convert ${vp.width}`);
    const { ctx, page } = await open(vp, { still: vp.width === 440 });
    await go(page, 'convert', 1800);
    await still(page, 'convert', vp);
    // C3 · the phrases that open it, listed in one line
    const says = await page.evaluate(() => document.querySelector('#pg-convert .pkphrases')?.dataset.says ?? '');
    check(C.PHRASES.every((x) => says.split('|').includes(x)) && words(await txt(page, '#pg-convert .pkphrases')) <= 14, `${T} [C3 phrases] CONVERT lists "${says}"`);
    // C1 · a unit it does not know
    await page.locator('#pg-convert .cvtoolbtn[data-id=units]').click({ force: true, timeout: 5000 }).catch(() => undefined);
    const q = page.locator('#pg-convert .cvtool input');
    await q.fill('');
    await page.keyboard.press('Enter');
    check((await txt(page, '#pg-convert .cvans[data-state="empty"]')) === C.UNITS_HINT, `${T} [C1 units] nothing typed says "${await txt(page, '#pg-convert .cvans')}"`);
    await q.fill('12 furlongs to km');
    await page.keyboard.press('Enter');
    check((await txt(page, '#pg-convert .cvans[data-state="error"]')) === C.unitsWhy('12 furlongs to km') && /“furlongs”/.test(await txt(page, '#pg-convert .cvans')), `${T} [C1 units] "12 furlongs to km" says "${await txt(page, '#pg-convert .cvans')}"`);
    await q.fill('5 kg in km');
    await page.keyboard.press('Enter');
    check(/kg is a weight and km is a length/.test(await txt(page, '#pg-convert .cvans')), `${T} [C1 units] "5 kg in km" says "${await txt(page, '#pg-convert .cvans')}"`);
    await q.fill('12 furlongs to km');
    await page.keyboard.press('Enter');
    // C2 · a file it cannot read
    await page.setInputFiles('#pg-convert input[type=file]', { name: 'mystery.xyz', mimeType: 'application/octet-stream', buffer: Buffer.from([0, 159, 146, 150, 1, 2, 200, 201, 202, 0, 0, 7, 8, 9, 255, 254, 253, 0, 31, 30]) });
    check(await until(page, () => document.querySelector('#pg-convert .cvconvs .cvnote[data-state="error"]') !== null, null, 8000), `${T} [C2 unreadable] a file it cannot read drew no error: "${await txt(page, '#pg-convert .cvconvs')}"`);
    check((await txt(page, '#pg-convert .cvconvs .cvnote[data-state="error"]')) === C.unreadable('mystery.xyz'), `${T} [C2 unreadable] reads "${await txt(page, '#pg-convert .cvconvs')}"`);
    await bar(page, `${T} [convert]`, 'convert');
    await ctx.close();
  });
}
for (const vp of [PHONE, PHONE2]) {
  if (!on('house')) break;
  const T = `[${vp.width}]`;
  await section('house', async () => {
    log(`house ${vp.width}`);
    let mode = 'dead';
    const { ctx, page } = await open(vp, {
      still: vp.width === 440,
      before: async ({ ctx }) => {
        await ctx.route('**/api/house**', async (r) => {
          if (r.request().method() !== 'GET') return r.fallback();
          if (mode === 'dead') return r.abort();
          if (mode === 'slow-empty') await new Promise((x) => setTimeout(x, 3000));
          return r.fulfill(j({ linked: true, entities: [], line: '', marked: [], at: Date.now() }));
        });
      },
    });
    // H1 · my brain out of reach, nothing read yet: said as that, with REFRESH
    await page.evaluate(() => (location.hash = 'house'));
    check(await until(page, () => document.querySelector('#pg-house [data-state="offline"]') !== null, null, 15000), `${T} [H1 house] with my brain out of reach the house said: "${(await txt(page, '#pg-house .house')).slice(0, 160)}"`);
    check((await txt(page, '#pg-house [data-state="offline"]')) === H.BRAIN_OUT && (await page.locator('#pg-house button', { hasText: /^refresh$/i }).count()) >= 1, `${T} [H1 house] reads "${await txt(page, '#pg-house [data-state="offline"]')}"`);
    // the house read with a wait said; then empty, with the one next thing
    mode = 'slow-empty';
    await page.locator('#pg-house button', { hasText: /^refresh$/i }).first().click({ force: true, timeout: 5000 }).catch(() => undefined);
    check(await until(page, () => !!document.querySelector('#pg-house [data-wait="Reading your house…"]') || (window.__waits ?? []).includes('Reading your house…'), null, 8000), `${T} [H1 house] reading the house said nothing: ${(await waits(page)).filter((x) => /house/i.test(x)).join(' | ') || (await txt(page, '#pg-house .house')).slice(0, 100)}`);
    check(await until(page, () => !!document.querySelector('#pg-house .empty[data-state="empty"]'), null, 15000), `${T} [H1 house] a house with nothing in it drew no empty state: "${(await txt(page, '#pg-house .house')).slice(0, 160)}"`);
    const hn = await txt(page, '#pg-house .empty[data-state="empty"]');
    check(hn.includes(H.HOUSE_NONE.head) && hn.includes(H.HOUSE_NONE.line), `${T} [H1 house] empty reads "${hn}"`);
    check(!(await page.evaluate(() => !!document.querySelector('#pg-house [data-wait="Reading your house…"]'))), `${T} [H1 house] the reading line is still up once the house has answered`);
    const says = await page.evaluate(() => document.querySelector('#pg-house .pkphrases')?.dataset.says ?? '');
    check(H.PHRASES.every((x) => says.split('|').includes(x)), `${T} [H1 phrases] HOUSE lists "${says}"`);
    await still(page, 'house', vp);
    await bar(page, `${T} [house]`, 'house');
    // out of reach again, with a house already on the screen: what is shown is said to be what I last saw
    mode = 'dead';
    await page.locator('#pg-house button', { hasText: /^refresh$/i }).first().click({ force: true, timeout: 5000 }).catch(() => undefined);
    check(await until(page, (w) => document.querySelector('#pg-house [data-state="offline"]')?.textContent === w, H.BRAIN_STALE, 15000), `${T} [H1 house] out of reach with a house shown it said: "${await txt(page, '#pg-house [data-state="offline"]')}"`);
    await ctx.close();
  });
}

// ================================================================ BODY 21 clips nothing (the biggest text, at 440)
await section('body21', async () => {
  log('body 21');
  const { ctx, page } = await open(PHONE, { body: 21 });
  for (const id of ['workshop', 'studio', 'reverse', 'space', 'workbench', 'convert', 'house']) {
    await page.evaluate((t) => (location.hash = t), id);
    await page.waitForTimeout(2200);
    check(!(await sideways(page, id)), `[440] [BODY 21] ${id}: sideways at the biggest text`);
    const cut = await page.$$eval(`#pg-${id} :is(.rw .v, .rw .k, .note, .empty b, .empty span, .wbwhy, .studiofail p, .revsay, .cvans, .cvnote, .spaceinfo, .spacefitout, .wnnone, .tunfail, .houseline)`, (els) => els.filter((e) => e.getClientRects().length && !e.closest('[hidden]') && (e.scrollWidth > e.clientWidth + 1) && /(hidden|clip)/.test(getComputedStyle(e).overflowX)).map((e) => (e.textContent ?? '').trim().slice(0, 30)).slice(0, 4));
    check(!cut.length, `[440] [BODY 21] ${id}: text cut off: ${cut.join(' | ')}`);
  }
  await ctx.close();
});

await browser.close();
const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(problems.length ? `PROBLEMS (${problems.length} of ${checks} checks):\n${problems.join('\n')}` : `MAKE pass run clean: ${checks} checks in ${secs} s: the Workshop, the 3D studio, SPACE, the Workbench and its tunnel, REVERSE, CONVERT and HOUSE say their waits, their empties and their failures in his words, with the one next thing, at both widths`);
process.exit(problems.length ? 1 : 0);
