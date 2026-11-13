// THE WALL (BRIEF-MACHINE-WALL; STARS 165; OWNER-ISSUES 176, 178): a second screen of the same Ghosty. Two pages against the preview's real brain
// (apps/edge/src/wall.ts, under /guardian/wall): one at 1920 × 1080 as the wall (`?wall=1` on its address), one at 440 × 956 (and 390 × 844) as the
// owner's phone, whose chat stream is faked as showme.spec does (the brain's replies are not under test: what the wall shows of them is).
//  a. PAIRING: the wall shows "I am the wall." and a six-letter code in the Machine's type with PAIR (44 pt); the phone's Settings → THE WALL
//     pairs with it (a wrong code three times waits and says so); the wall says "Paired with your phone." and rests with the orb and the hour.
//  b. A CHART: "show me a chart of my bills" on the phone, then WALL on its Stage: the wall draws the chart within 1.5 s (measured), every label
//     inside the screen, the sentence along the foot in one line.
//  c. A MAP: "where is Lisbon?" then "on the wall": the map on the wall and the phone's chat clear of the picture; "…, on the wall" in one go too.
//  d. WHAT STAYS: the Lens with a face in it, "show that on the wall": nothing goes, and he is told "That stays on the phone."; a named thing does.
//  e. THE REMOTE: "clear the wall" rests it; LEAVE by a one-second press anywhere (a count ring shows; a short press does nothing) unpairs both.
//  f. LOST: the wall with its route failing says its lost line and keeps the last picture dim, and comes back; the phone without the brain: the
//     WALL key says "No wall right now" and the picture stays on the phone.
//  g. THE SIZES: the wall at 1280 × 720 and 1920 × 1080 clips nothing in any face or kind; the phone at 440 and 390 has no sideways scroll and
//     every key 44 pt; Reduce Motion: no transition class on the picture's arrival (and one with motion).
// Everything it adds is taken away again. Screenshots go to the output directory.
//   BASE=http://localhost:8788 node tests/wall.spec.mjs [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));
const SCAN = { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} };
const BIG = { width: 1920, height: 1080 };
const SMALL = { width: 1280, height: 720 };
const PHONE_390 = { width: 390, height: 844 };
const REPLY_BILLS = 'You spent the most in March, at £140.\n- January: £120\n- February: £95\n- March: £140\n- April: £80\n- May: £110\n- June: £99';
const timings = {};
let shot = null;
process.on('uncaughtException', async (e) => {
  console.log(`WALL run stopped by: ${String(e?.message ?? e).split('\n')[0]}\n- ${problems.join('\n- ')}`);
  if (shot) await shot.screenshot({ path: `${out}/wall-failure.png` }).catch(() => undefined);
  process.exit(1);
});

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const api = (page, path, init = {}) => page.evaluate(async ([p, i, k]) => (await fetch(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), [path, init, KEY]);
const until = (page, fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
const reset = () => fetch(`${base}/__test/wall?reset=1`).then((r) => r.json());

/** The wall: a 1920 × 1080 (or `viewport`) browser tab made the wall by its address; its stream held short so it answers quickly. */
async function openWall({ viewport = BIG, reduced = false, hold = 4000, screen = `wall${Math.random().toString(16).slice(2, 12)}` } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block', ...(reduced ? { reducedMotion: 'reduce' } : {}) });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[wall] pageerror: ${e.message}`));
  await page.addInitScript(({ key, hold, screen }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: {} }, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    localStorage.setItem('ghosty.wall.role', JSON.stringify({ on: true, screen }));
    window.__ghostyWallHold = hold;
    window.__ghostyHero = true;
  }, { key: KEY, hold, screen });
  await page.goto(`${base}/?wall=1`, { waitUntil: 'domcontentloaded' });
  await until(page, () => !!document.querySelector('#thewall'), null, 40000, '[wall] the wall never appeared');
  return { ctx, page, screen };
}

/** The owner's phone, signed in, SHOW ME on, in the look asked for. */
async function openPhone({ viewport = PHONE } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', (e) => webkitNoise(e) || (console.log('pageerror', e.message), problems.push(`[phone] pageerror: ${e.message}`)));
  await page.addInitScript(({ key, look }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.themes1', '1');
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', speak: false, sounds: false, theme: 'reactor', look, home: { name: 'Birmingham', lat: 52.48, lon: -1.9 } }));
    window.__ghostyShow = true;
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, look: SCAN });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => problems.push('[phone] the boot never ended'));
  await until(page, () => !!window.__ghosty?.wallphone, null, 30000, '[phone] window.__ghosty.wallphone never appeared');
  return { ctx, page };
}

/** Home, from wherever the phone is (a pushed Settings page is popped first). */
async function toCore(page) {
  for (let i = 0; i < 3; i++) {
    // (a pushed page is popped by its back key first, and given a moment: the pop must not land after the hash)
    if (await page.evaluate(() => { document.activeElement?.blur?.(); const b = document.querySelector('#top .navback'); const on = !!b && !b.hidden && b.getClientRects().length > 0; if (on) b.click(); return on; })) await page.waitForTimeout(700);
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForFunction(() => document.body.dataset.tab === 'core', null, { timeout: 4000 }).catch(() => undefined);
    await page.waitForTimeout(700);
    if (await page.evaluate(() => document.body.dataset.tab === 'core')) return;
  }
  problems.push('[phone] could not get back to Home');
}
async function chatOpen(page) {
  const open = () => page.evaluate(() => !!document.querySelector('#pg-core .hud.core.logopen'));
  for (let i = 0; i < 8 && !(await open()); i++) {
    if (i === 0) await toCore(page);
    await page.waitForTimeout(i ? 600 : 300);
    if (process.env.DBG) console.log('chatOpen', i, await page.evaluate(() => `${document.body.dataset.tab} ${location.hash} ${!!document.querySelector('#pg-core .hud.core.logopen')}`));
    await page.locator('.logbtn:visible').first().click({ timeout: 3000 }).catch(() => undefined);
    if (!(await open())) await page.evaluate(() => document.querySelector('.logbtn')?.click());
    await page.waitForTimeout(400);
  }
}
/** Ask in the chat with the brain's stream faked; `reply` is the sentence. */
async function say(page, ask, reply, extra = []) {
  shot = page;
  const body = ndjson([{ t: 'status', text: 'thinking…' }, ...extra, ...(reply ? [{ t: 'text', text: reply }] : []), { t: 'done', model: 'Mock · scripted' }]);
  await page.unroute('**/api/chat').catch(() => undefined);
  await page.route('**/api/chat', (r) => r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(body).toString('base64'))}` }));
  await toCore(page);
  await chatOpen(page);
  await page.fill('#cin', ask);
  await page.keyboard.press('Enter');
}
const stageKind = (page) => page.evaluate(() => document.querySelector('#thestage')?.dataset.kind ?? null);
const lastReply = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .log .msg')].map((m) => m.textContent ?? '').slice(-3).join(' | '));
const wallOf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.thewall)));
const phoneStore = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.wallphone.store.get())));

/** Everything the wall draws is inside the screen, and no line of words runs past its box. */
async function unclipped(page, vp, what) {
  const bad = await page.evaluate(({ w, h }) => {
    const wall = document.getElementById('thewall');
    const found = [];
    const seen = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.display !== 'none' && st.visibility !== 'hidden';
    };
    for (const el of wall.querySelectorAll('*')) {
      if (!seen(el) || el.closest('.wallring') || el.closest('.stgtiles')) continue;
      const isSvgPart = el instanceof SVGElement && !(el instanceof SVGSVGElement);
      const r = el.getBoundingClientRect();
      const text = isSvgPart ? el.tagName === 'text' : el.children.length === 0 && (el.textContent ?? '').trim();
      if (!(text || el.matches('svg, .wallletter, .wallpic, .wallframe, .stgpage, .wallkeys .g-key, .wallmap'))) continue;
      if (r.left < -1 || r.top < -1 || r.right > w + 1 || r.bottom > h + 1) found.push(`${el.tagName}.${(el.getAttribute('class') ?? '').split(' ')[0]} "${(el.textContent ?? '').trim().slice(0, 24)}" out of the screen: ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}`);
      if (!isSvgPart && text && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== 'visible' && !el.matches('.walltitle')) found.push(`${el.className} "${(el.textContent ?? '').trim().slice(0, 24)}" is cut: ${el.scrollWidth} > ${el.clientWidth}`);
    }
    const pic = wall.querySelector('.stgpage');
    if (pic && pic.scrollHeight > pic.clientHeight + 2) found.push(`the page is cut: ${pic.scrollHeight} > ${pic.clientHeight}`);
    const foot = wall.querySelector('.wallfoot');
    if (foot && getComputedStyle(foot).display !== 'none' && foot.textContent && foot.scrollWidth > foot.clientWidth + 1) found.push(`the foot sentence is cut: ${foot.scrollWidth} > ${foot.clientWidth}`);
    if (document.documentElement.scrollWidth > w + 1 || document.documentElement.scrollHeight > h + 1) found.push('the wall scrolls');
    return found;
  }, { w: vp.width, h: vp.height });
  for (const b of bad) problems.push(`[wall ${what}] ${b}`);
}

await reset();

// ================================================================ a. pairing
const wall = await openWall();
const W = wall.page;
const budgetOf = async (page) => {
  await page.waitForFunction(() => !!window.__ghosty?.thewall, null, { timeout: 8000 }).catch(() => undefined);
  return page.evaluate(() => ({ mount: window.__ghosty?.thewall?.mountMs, code: window.__ghosty?.thewall?.codeMs }));
};
await until(W, () => document.querySelectorAll('#thewall[data-face="unpaired"] .wallletter').length === 6, null, 15000, '[a] the wall showed no six-letter code');
const first = await W.evaluate(() => {
  const g = document.getElementById('thewall');
  const letters = [...g.querySelectorAll('.wallletter')];
  const key = g.querySelector('.wallkeys .g-key');
  const tokenMono = getComputedStyle(document.documentElement).getPropertyValue('--g-font-mono').split(',')[0].trim().replace(/["']/g, '');
  return {
    code: letters.map((l) => l.textContent).join(''),
    say: g.querySelector('.wallsay')?.textContent,
    how: g.querySelector('.wallhow')?.textContent,
    mono: getComputedStyle(letters[0]).fontFamily.replace(/["']/g, '').includes(tokenMono),
    letterPx: parseFloat(getComputedStyle(letters[0]).fontSize),
    keyH: key?.getBoundingClientRect().height,
    keyWord: key?.textContent,
    orb: !!g.querySelector('.wallorb svg.g-eye'),
    aria: g.querySelector('.wallcode')?.getAttribute('aria-label'),
  };
});
check(/^[ACDEFGHJKMNPQRTUVWXYZ]{6}$/.test(first.code), `[a] the code is not six unambiguous letters: ${first.code}`);
check(first.say === 'I am the wall.', `[a] the wall's first words: ${first.say}`);
check(first.mono, '[a] the code is not in the Machine’s mono type');
check(first.letterPx >= 56, `[a] the code is not at television size: ${first.letterPx}px`);
check(first.keyWord === 'PAIR' && first.keyH >= 43.5, `[a] the wall's PAIR key: ${first.keyWord} ${first.keyH}`);
check(first.orb, '[a] no orb on the wall');
check(/On your phone: Settings, THE WALL, PAIR\./.test(first.how ?? ''), `[a] the line under the code: ${first.how}`);
check((first.aria ?? '').startsWith('Code '), `[a] the code is not spoken to VoiceOver: ${first.aria}`);
const b1 = await budgetOf(W);
timings.wallFirstScreen = b1;
check(b1.mount > 0 && b1.mount <= 1000, `[a] the wall's own first screen took ${b1.mount} ms (budget 1000)`);
await W.screenshot({ path: `${out}/wall-unpaired-1920.png` });
await unclipped(W, BIG, 'unpaired 1920');

// the phone: Settings → THE WALL
const P1 = await openPhone();
const phone = P1.page;
const phoneUnpaired = await phone.evaluate(() => window.__ghosty.wallphone.store.get().paired);
check(phoneUnpaired === false, '[a] a phone that never paired thinks it has a wall');
// no WALL key on the Stage while no wall is paired
await say(phone, 'show me a chart of my bills', REPLY_BILLS);
await until(phone, () => document.querySelector('#thestage')?.dataset.kind === 'chart', null, 20000, '[b0] no chart on the phone’s Stage');
check((await phone.locator('#thestage [data-wall]').count()) === 0, '[a] the Stage has a WALL key with no wall paired');
await phone.evaluate(() => (location.hash = 'settings'));
await openPanel(phone, 'settings', 'THE WALL');
await until(phone, () => !!document.querySelector('.wallpn .wallcodein') && document.querySelector('.wallpn').getClientRects().length > 0, null, 15000, '[a] Settings has no THE WALL page');
await phone.locator('.wallpn').scrollIntoViewIfNeeded();
const pairRow = await phone.evaluate(() => {
  const i = document.querySelector('.wallpn .wallcodein').getBoundingClientRect();
  const k = [...document.querySelectorAll('.wallpn .g-key')].map((b) => ({ w: b.textContent, h: b.getBoundingClientRect().height, vis: b.getClientRects().length > 0 }));
  return { inputH: i.height, keys: k };
});
check(pairRow.inputH >= 43.5 && pairRow.keys.every((k) => !k.vis || k.h >= 43.5), `[a] THE WALL's controls are under 44 pt: ${JSON.stringify(pairRow)}`);
await phone.screenshot({ path: `${out}/wall-phone-settings.png` });
const typeCode = async (code) => {
  await phone.fill('.wallpn .wallcodein', code);
  await phone.locator('.wallpn .g-key', { hasText: /^PAIR$/ }).click();
};
const state = () => phone.evaluate(() => document.querySelector('.wallpn .wallstate')?.textContent ?? '');
const wrong = first.code === 'CCCCCC' ? 'DDDDDD' : 'CCCCCC';
await typeCode(wrong);
await until(phone, () => /isn.t the wall.s code/.test(document.querySelector('.wallpn .wallstate')?.textContent ?? ''), null, 8000, `[a] the first wrong code was not refused in words: ${await state()}`);
await typeCode(wrong);
await typeCode(wrong);
await until(phone, () => /Wait a minute/.test(document.querySelector('.wallpn .wallstate')?.textContent ?? ''), null, 8000, `[a] three wrong codes did not wait and say so: ${await state()}`);
const waiting = await phone.evaluate(() => ({ off: document.querySelector('.wallpn .g-key.fill')?.disabled, retry: window.__ghosty.wallphone.store.get().retryAt - Date.now() }));
check(waiting.off === true && waiting.retry > 30_000 && waiting.retry <= 61_000, `[a] PAIR is not held for the minute: ${JSON.stringify(waiting)}`);
await phone.screenshot({ path: `${out}/wall-phone-wait.png` });
// (the minute is the brain's clock: the preview forgets it here, as a minute would, and the phone's own hold is lifted with it)
const codeBefore = (await wallOf(W)).code;
await reset();
if (process.env.DBG) for (let i = 0; i < 8; i++) { const sv = await fetch(`${base}/api/guardian/wall/stream?screen=${wall.screen}&seq=-1&hold=0`, { headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY } }).then((r) => r.json()); const ws = await wallOf(W); console.log(i, 'server', JSON.stringify(sv), 'wall', ws.code, ws.frames, ws.polls); await new Promise((r) => setTimeout(r, 1500)); }
await phone.evaluate(() => window.__ghosty.wallphone.store.set({ retryAt: 0 }));
// (the preview forgets the pair without waking the wall's held request: it hears the new state when that request ends)
if (!(await until(W, (c) => window.__ghosty.thewall.code && window.__ghosty.thewall.code !== c && document.querySelectorAll('#thewall .wallletter').length === 6, codeBefore, 15000, '[a] the wall did not take the new code after the reset'))) problems.push(`[a] (wall state: ${JSON.stringify(await wallOf(W))}, before ${codeBefore})`);
const code2 = await W.evaluate(() => [...document.querySelectorAll('#thewall .wallletter')].map((l) => l.textContent).join(''));
// (the wall's words are written down as they change: the paired line is on screen for a moment, and a slow machine may look late)
await W.evaluate(() => { window.__said = []; const g = document.getElementById('thewall'); new MutationObserver(() => window.__said.push(`${g.dataset.face}|${g.querySelector('.wallsay')?.textContent}`)).observe(g, { attributes: true, subtree: true, childList: true, characterData: true }); });
await typeCode(code2.toLowerCase());
await until(phone, () => window.__ghosty.wallphone.store.get().paired === true, null, 8000, `[a] the phone did not pair with ${code2}: ${await state()}`);
check(/Paired with your phone\./.test(await state()), `[a] the phone says: ${await state()}`);
await until(W, () => window.__said.some((x) => x === 'paired|Paired with your phone.'), null, 20000, '[a] the wall did not say "Paired with your phone."');
await until(W, () => document.getElementById('thewall')?.dataset.face === 'rest', null, 9000, '[a] the wall did not rest after being paired');
const rest = await W.evaluate(() => {
  const g = document.getElementById('thewall');
  return { hour: g.querySelector('.wallhour')?.textContent, orb: !!g.querySelector('.wallorb svg'), day: g.querySelector('.wallday')?.textContent, breath: getComputedStyle(g.querySelector('.wallorb svg')).animationName, codeShown: getComputedStyle(g.querySelector('.wallcode')).display };
});
check(/^\d\d:\d\d$/.test(rest.hour ?? '') && rest.orb && rest.codeShown === 'none', `[a] the resting wall: ${JSON.stringify(rest)}`);
check(rest.breath === 'wallbreath', `[a] the orb does not breathe: ${rest.breath}`);
await W.screenshot({ path: `${out}/wall-rest-1920.png` });
await unclipped(W, BIG, 'rest 1920');
check((await phoneStore(phone)).paired === true, '[a] the phone does not know it is paired');
const info = await api(phone, '/guardian/wall');
check(info.paired === true, `[a] the brain does not say paired: ${JSON.stringify(info)}`);

// ================================================================ b. a chart, by WALL on the Stage
// (the chart is still on the phone's Stage from before pairing: ask again now that a wall is paired, so the Stage grows its WALL key)
await say(phone, 'show me a chart of my bills', REPLY_BILLS);
await until(phone, () => !!document.querySelector('#thestage[data-kind="chart"] [data-wall]'), null, 20000, '[b] the Stage has no WALL key with a wall paired');
const wallKey = await phone.evaluate(() => {
  const b = document.querySelector('#thestage [data-wall]');
  const r = b.getBoundingClientRect();
  const st = document.querySelector('#thestage').getBoundingClientRect();
  return { word: b.textContent, h: r.height, w: r.width, inside: r.left >= st.left - 1 && r.right <= st.right + 1, label: b.getAttribute('aria-label') };
});
check(wallKey.word === 'WALL' && wallKey.h >= 43.5 && wallKey.inside, `[b] the WALL key: ${JSON.stringify(wallKey)}`);
await phone.screenshot({ path: `${out}/wall-phone-stage.png` });
const before = await wallOf(W);
const t0 = await phone.evaluate(() => Date.now());
await phone.locator('#thestage [data-wall]').click();
await until(W, (n) => window.__ghosty.thewall.kind === 'chart' && window.__ghosty.thewall.shownAt > n, before.shownAt, 8000, '[b] the chart never reached the wall');
const after = await wallOf(W);
const lag = after.shownAt - t0;
timings.phoneToWallChartMs = lag;
check(lag <= 1500, `[b] the wall drew the chart ${lag} ms after the tap (budget 1,500; its frame arrived ${after.frameAt - t0} ms after the tap)`);
await W.waitForTimeout(1200);
const chart = await W.evaluate(() => {
  const g = document.getElementById('thewall');
  const pic = g.querySelector('.wallpic').getBoundingClientRect();
  const texts = [...g.querySelectorAll('.wallpic svg text')].map((t) => ({ s: t.textContent, r: t.getBoundingClientRect() }));
  const foot = g.querySelector('.wallfoot');
  const lh = parseFloat(getComputedStyle(foot).lineHeight);
  return { dots: g.querySelectorAll('.wallpic [data-dot]').length, texts: texts.length, inside: texts.every((t) => t.r.left >= pic.left - 1 && t.r.right <= pic.right + 1 && t.r.top >= pic.top - 1 && t.r.bottom <= pic.bottom + 1), smallest: Math.min(...texts.map((t) => t.r.height)), foot: foot.textContent, oneLine: foot.getBoundingClientRect().height <= lh * 1.2 && foot.scrollWidth <= foot.clientWidth + 1, head: g.querySelector('.wallhead')?.textContent, face: g.dataset.face, fadeClass: !!g.querySelector('.wallframe.wallin') };
});
check(chart.dots === 6 && chart.texts >= 8, `[b] the chart on the wall: ${JSON.stringify(chart)}`);
check(chart.inside, '[b] a label of the chart is outside its frame on the wall');
check(chart.smallest >= 24, `[b] the chart's smallest label is ${chart.smallest}px tall on the wall (at least 24)`);
check(chart.foot === 'You spent the most in March, at £140.' && chart.oneLine, `[b] the sentence along the foot: ${JSON.stringify(chart.foot)} one line: ${chart.oneLine}`);
check(/SHOWING · CHART/.test(chart.head ?? '') && chart.face === 'show', `[b] the wall's head: ${chart.head} ${chart.face}`);
check(chart.fadeClass, '[b] the picture arrived with no transition class when motion is allowed');
await W.screenshot({ path: `${out}/wall-chart-1920.png` });
await unclipped(W, BIG, 'chart 1920');
// the phone's own Stage is still there (WALL sends a copy)
check((await stageKind(phone)) === 'chart', '[b] the Stage went from the phone when it was sent');
const sentKey = await phone.evaluate(() => document.querySelector('#thestage [data-wall]')?.dataset.wall);
check(sentKey === 'sent', `[b] the WALL key did not say it was sent: ${sentKey}`);

// ================================================================ c. a map, "on the wall"
// (this turn's own picture: the chart before it is still on the phone, leaving, when the ask is sent, and "on the wall" must not be said
// before Lisbon's answer is in, or its stream would be the next say's; the chart's Stage is marked so the wait is for a new one)
await phone.evaluate(() => document.getElementById('thestage')?.setAttribute('data-spec-before', '1'));
await say(phone, 'where is Lisbon?', 'Lisbon is the capital of Portugal, on the Atlantic coast.');
await until(phone, () => !!document.querySelector('#thestage:not(.leaving):not([data-spec-before])'), null, 20000, '[c] no picture for Lisbon on the phone');
check((await stageKind(phone)) === 'eye', `[c] Lisbon on the phone is ${await stageKind(phone)}`);
const mapBefore = (await wallOf(W)).shownAt;
await say(phone, 'on the wall', '');
await until(W, (n) => window.__ghosty.thewall.kind === 'map' && window.__ghosty.thewall.shownAt > n, mapBefore, 8000, '[c] the map never reached the wall');
await W.waitForTimeout(800);
const map = await W.evaluate(() => {
  const g = document.getElementById('thewall');
  const place = g.querySelector('.wallplace')?.getBoundingClientRect();
  const pic = g.querySelector('.wallpic').getBoundingClientRect();
  return { place: g.querySelector('.wallplace')?.textContent, inside: !!place && place.left >= pic.left && place.right <= pic.right, tiles: g.querySelectorAll('.stgtiles img').length, pin: !!g.querySelector('.stgpin'), foot: g.querySelector('.wallfoot').textContent, head: g.querySelector('.wallhead').textContent };
});
check(map.place === 'Lisbon' && map.inside && map.pin, `[c] the map on the wall: ${JSON.stringify(map)}`);
check(/MAP/.test(map.head) && /capital of Portugal/.test(map.foot), `[c] the map's head and foot: ${map.head} / ${map.foot}`);
await W.screenshot({ path: `${out}/wall-map-1920.png` });
await unclipped(W, BIG, 'map 1920');
check(!(await stageKind(phone)), '[c] the phone still has the picture after "on the wall"');
const chatSaid = await lastReply(phone);
check(/On the wall\./.test(chatSaid), `[c] the phone's chat after "on the wall": ${chatSaid}`);
// in one go: "…, on the wall"
const before2 = (await wallOf(W)).shownAt;
await say(phone, 'where is Lisbon, on the wall', 'Lisbon is on the Tagus, on Portugal’s Atlantic coast.');
await until(W, (n) => window.__ghosty.thewall.kind === 'map' && window.__ghosty.thewall.shownAt > n, before2, 12000, '[c] "where is Lisbon, on the wall" never reached the wall');
await phone.waitForTimeout(1200);
check(!(await stageKind(phone)), `[c] the phone kept its own picture when asked "on the wall": ${await stageKind(phone)}`);
check(/Tagus/.test((await wallOf(W)).sentence), `[c] the wall's sentence for the one-go ask: ${(await wallOf(W)).sentence}`);

// ================================================================ d. what stays on the phone
// (the Lens with a face in it: the Lens's own tags are the fixture; nothing of the camera is used)
const requests = [];
phone.on('request', (r) => /guardian\/wall\/show/.test(r.url()) && requests.push(r.postData() ?? ''));
await phone.evaluate(() => (location.hash = 'lens'));
await until(phone, () => document.body.dataset.tab === 'lens' && !!window.__ghosty?.one && !!window.__ghosty?.send, null, 25000, '[d] the Lens never opened');
const tag = (kind, truth) => ({ id: Math.floor(Math.random() * 1e6), kind, tag: kind.toUpperCase(), truth, acts: [], box: { x: 0.2, y: 0.2, w: 0.3, h: 0.3 }, fade: 1, selected: false, label: kind, greyed: [] });
await phone.evaluate((t) => { window.__ghosty.one.tags.length = 0; window.__ghosty.one.tags.push(t); }, tag('face', 'someone I know'));
const kept = await wallOf(W);
const sentBefore = requests.length;
await phone.evaluate(() => window.__ghosty.send('show that on the wall'));
await until(phone, () => /That stays on the phone\./.test(document.body.textContent ?? ''), null, 8000, `[d] the face did not stay with the refusing words: ${await lastReply(phone)}`);
await W.waitForTimeout(700);
const kept2 = await wallOf(W);
check(kept2.shownAt === kept.shownAt && kept2.kind === kept.kind, `[d] the wall changed after a face: ${kept.kind} -> ${kept2.kind}`);
check(requests.length === sentBefore, `[d] the phone sent something to the wall with a face in the Lens: ${requests.slice(sentBefore).join(' ').slice(0, 120)}`);
// a stranger too, and a face beside a lemon: still stays
await phone.evaluate((t) => { window.__ghosty.one.tags.length = 0; window.__ghosty.one.tags.push(t[0], t[1]); }, [tag('stranger', 'someone I do not know'), tag('object', 'looks like a lemon')]);
await phone.evaluate(() => window.__ghosty.send('put it on the wall'));
await phone.waitForTimeout(900);
check(requests.length === sentBefore, '[d] a stranger beside a lemon went to the wall');
// a named thing alone goes: its name, never the frame
await phone.evaluate((t) => { window.__ghosty.one.tags.length = 0; window.__ghosty.one.tags.push(t); }, tag('object', 'looks like a lemon'));
const thingBefore = (await wallOf(W)).shownAt;
await phone.evaluate(() => window.__ghosty.send('show that on the wall'));
await until(W, (n) => window.__ghosty.thewall.kind === 'thing' && window.__ghosty.thewall.shownAt > n, thingBefore, 8000, '[d] the Lens’s named thing never reached the wall');
check(/lemon/.test((await wallOf(W)).sentence), `[d] the wall's sentence for the lemon: ${(await wallOf(W)).sentence}`);
const thingBody = requests[requests.length - 1] ?? '';
check(/"kind":"thing"/.test(thingBody) && !/image|frame|data:|face|base64/i.test(thingBody), `[d] what the phone sent for the thing: ${thingBody.slice(0, 200)}`);
await W.screenshot({ path: `${out}/wall-thing-1920.png` });
// the brain refuses too (the same gate, once more)
const refused = await api(phone, '/guardian/wall/show', { method: 'POST', body: JSON.stringify({ kind: 'camera', data: { label: 'x' }, sentence: 'x' }) });
check(refused.error === 'That stays on the phone.' && refused.refused === true, `[d] the brain accepted a kind off the list: ${JSON.stringify(refused)}`);
await phone.evaluate(() => (location.hash = 'core'));

// ================================================================ e. the remote: clear the wall, LEAVE
await phone.evaluate(() => window.__ghosty.send('clear the wall'));
await until(W, () => document.getElementById('thewall')?.dataset.face === 'rest', null, 8000, '[e] "clear the wall" did not rest the wall');
check(/The wall is resting\./.test(await lastReply(phone)), `[e] the phone's answer to "clear the wall": ${await lastReply(phone)}`);
// a short press does nothing; a hold shows its ring and, at one second, unpairs
const cx = BIG.width / 2;
const cy = BIG.height / 2;
await W.mouse.move(cx, cy);
await W.mouse.down();
await W.waitForTimeout(350);
await W.mouse.up();
await W.waitForTimeout(900);
check((await api(phone, '/guardian/wall')).paired === true, '[e] a short press unpaired the wall');
await W.mouse.move(cx, cy);
await W.mouse.down();
await W.waitForTimeout(600);
const ring = await W.evaluate(() => { const r = document.querySelector('#thewall .wallring'); const c = r?.querySelector('.wallring-fg'); return { on: r?.classList.contains('on'), offset: parseFloat(c?.style.strokeDashoffset ?? '100'), w: r?.getBoundingClientRect().width }; });
check(ring.on && ring.offset < 100 && ring.offset > 0 && ring.w >= 100, `[e] the count ring while holding: ${JSON.stringify(ring)}`);
await W.screenshot({ path: `${out}/wall-leave-ring.png`, clip: { x: cx - 160, y: cy - 160, width: 320, height: 320 } });
await W.waitForTimeout(700);
await W.mouse.up();
await until(W, () => document.getElementById('thewall')?.dataset.face === 'unpaired' && document.querySelectorAll('#thewall .wallletter').length === 6, null, 8000, '[e] a one-second hold did not unpair the wall');
const afterLeave = await W.evaluate(() => [...document.querySelectorAll('#thewall .wallletter')].map((l) => l.textContent).join(''));
check(afterLeave !== code2, `[e] the wall asked for no new code after LEAVE: ${afterLeave}`);
check((await api(phone, '/guardian/wall')).paired === false, '[e] the brain still says paired after the wall left');
await phone.evaluate(() => window.__ghosty.wallphone.refresh());
await until(phone, () => window.__ghosty.wallphone.store.get().paired === false, null, 8000, '[e] the phone still thinks it is paired after the wall left');
// "on the wall" with none paired says so
await phone.evaluate(() => window.__ghosty.send('show that on the wall'));
await until(phone, () => /No wall is paired yet/.test(document.body.textContent ?? ''), null, 8000, `[e] the phone did not say no wall is paired: ${await lastReply(phone)}`);
await W.screenshot({ path: `${out}/wall-afterleave-1920.png` });

// ================================================================ f. lost: the wall without the brain, the phone without the brain
const code3 = afterLeave;
await phone.evaluate(() => window.__ghosty.wallphone.store.set({ retryAt: 0 }));
await phone.evaluate(async (c) => { const m = window.__ghosty; await fetch('/api/guardian/wall/pair', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' }, body: JSON.stringify({ code: c }) }); await m.wallphone.refresh(); }, code3);
await until(phone, () => window.__ghosty.wallphone.store.get().paired === true, null, 8000, '[f] could not pair again');
await until(W, () => document.getElementById('thewall')?.dataset.face === 'paired' || document.getElementById('thewall')?.dataset.face === 'rest', null, 9000, '[f] the wall did not follow the second pairing');
await until(W, () => document.getElementById('thewall')?.dataset.face === 'rest', null, 9000, '[f] the wall did not rest');
await api(phone, '/guardian/wall/show', { method: 'POST', body: JSON.stringify({ kind: 'chart', data: { series: { kind: 'bars', points: [{ label: 'Jan', value: 1 }, { label: 'Feb', value: 2 }, { label: 'Mar', value: 3 }], unit: '', before: false }, title: 'Counting' }, sentence: 'One, two, three.' }) });
await until(W, () => window.__ghosty.thewall.kind === 'chart' && document.getElementById('thewall').dataset.face === 'show', null, 8000, '[f] no picture on the wall before the brain went');
await W.route('**/guardian/wall/stream*', (r) => r.abort());
await until(W, () => window.__ghosty.thewall.lost === true && document.getElementById('thewall').dataset.face === 'lost', null, 20000, '[f] the wall did not say it lost its brain');
const lostSay = await W.evaluate(() => {
  const g = document.getElementById('thewall');
  const note = g.querySelector('.wallnote');
  const pic = g.querySelector('.wallpic');
  return { text: note.textContent, shown: getComputedStyle(note).display, op: parseFloat(getComputedStyle(pic).opacity), kept: !!pic.querySelector('svg'), foot: g.querySelector('.wallfoot').textContent, note: note.getBoundingClientRect().toJSON() };
});
check(lostSay.text === 'I lost my brain. The phone’s picture will come back when it does.' && lostSay.shown !== 'none', `[f] the lost line: ${JSON.stringify(lostSay)}`);
check(lostSay.kept && lostSay.op < 0.6 && lostSay.foot === 'One, two, three.', `[f] the last picture is not kept dim: ${JSON.stringify(lostSay)}`);
await W.screenshot({ path: `${out}/wall-lost-1920.png` });
await unclipped(W, BIG, 'lost 1920');
await W.unroute('**/guardian/wall/stream*');
await until(W, () => window.__ghosty.thewall.lost === false && document.getElementById('thewall').dataset.face === 'show', null, 20000, '[f] the wall did not come back when the brain did');
// the phone without the brain: the WALL key says so and the picture stays
await phone.evaluate(() => (location.hash = 'core'));
await say(phone, 'show me a chart of my bills', REPLY_BILLS);
await until(phone, () => !!document.querySelector('#thestage[data-kind="chart"] [data-wall]'), null, 20000, '[f] no WALL key for the offline test');
await phone.route('**/guardian/wall/show', (r) => r.abort());
await phone.locator('#thestage [data-wall]').click();
await until(phone, () => /NO WALL RIGHT NOW/.test(document.querySelector('#thestage [data-wall]')?.textContent ?? ''), null, 8000, `[f] the WALL key did not say "No wall right now": ${await phone.evaluate(() => document.querySelector('#thestage [data-wall]')?.textContent)}`);
check((await stageKind(phone)) === 'chart', '[f] the picture left the phone when the wall could not be reached');
await phone.screenshot({ path: `${out}/wall-phone-nowall.png` });
await phone.unroute('**/guardian/wall/show');
// asked "…, on the wall" with the brain out: the picture stays on the phone and he is told
await phone.route('**/guardian/wall/show', (r) => r.abort());
await say(phone, 'where is Lisbon, on the wall', 'Lisbon is on the Tagus.');
await until(phone, () => !!document.querySelector('#thestage'), null, 20000, '[f] "on the wall" with no brain left the phone with no picture');
await phone.unroute('**/guardian/wall/show');
await phone.evaluate(() => document.getElementById('thestage')?.remove());

// ================================================================ g. the sizes
const SENT = {
  chart: { kind: 'chart', data: { series: { kind: 'line', points: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((label, i) => ({ label, value: 90 + ((i * 37) % 80) })), unit: '£', before: true }, title: 'Bills this year' }, sentence: 'Your bills peaked in October, at £164, and have eased since then, which is the first time this year.' },
  map: { kind: 'map', data: { lat: 38.7223, lon: -9.1393, label: 'Lisbon', zoom: 11 }, sentence: 'Lisbon is on the Tagus.' },
  document: { kind: 'document', data: { title: 'Letter to my landlord about the damp in the bedroom', paragraphs: [{ t: 'h1', text: 'Letter to my landlord about the damp in the bedroom' }, ...Array.from({ length: 9 }, (_, i) => ({ t: i % 3 === 2 ? 'ul' : 'p', text: `Paragraph ${i + 1}: the damp in the bedroom has got worse since October and needs to be looked at this month, before the cold sets in properly again.` }))] }, sentence: 'Here is the letter, laid out.' },
  room: { kind: 'room', data: { room: { w: 400, d: 300, things: [{ kind: 'sofa', n: 1 }, { kind: 'bed', n: 1 }, { kind: 'desk', n: 1 }], sized: true }, title: 'Room 4 × 3 m' }, sentence: 'A room four by three with a sofa, a bed and a desk.' },
  part: { kind: 'part', data: { part: { kind: 'desk', name: 'Desk', dims: { w: 140, d: 70, h: 75 } }, title: 'Desk 140 × 70 × 75 cm' }, sentence: 'A desk, 140 by 70.' },
  thing: { kind: 'thing', data: { name: 'a lemon' }, sentence: 'It looks like a lemon.' },
  car: { kind: 'car', data: { name: 'My Golf', lines: ['MOT due 3 March', 'Tax due 1 April'] }, sentence: 'Your Golf’s MOT is due in March.' },
  waveform: { kind: 'waveform', data: { title: 'Morning tune', peaks: Array.from({ length: 120 }, (_, i) => Math.abs(Math.sin(i / 7)) * 0.9 + 0.05) }, sentence: 'The tune’s waveform.' },
};
const post = (path, body) => fetch(`${base}/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': KEY }, body: JSON.stringify(body) }).then((r) => r.json());
async function everyKind(_page, vp, tag) {
  for (const [kind, body] of Object.entries(SENT)) {
    const r = await post('/guardian/wall/show', body);
    if (r.error) {
      problems.push(`[g ${tag}] the brain refused ${kind}: ${JSON.stringify(r)}`);
      continue;
    }
    await until(W, (k) => window.__ghosty.thewall.kind === k && document.getElementById('thewall').dataset.face === 'show', kind, 20000, `[g ${tag}] the wall did not show ${kind}`);
    await W.waitForTimeout(kind === 'chart' || kind === 'document' || kind === 'room' ? 1100 : 250);
    await unclipped(W, vp, `${kind} ${tag}`);
    if (kind === 'chart' || kind === 'document' || kind === 'room') await W.screenshot({ path: `${out}/wall-${kind}-${tag}.png` });
  }
}
// the first wall is at 1920 × 1080 already: every kind there, then the same page at 1280 × 720 (the phone is put away: it draws a 3-D hero that
// would only slow the wall down under test)
await P1.ctx.close();
await everyKind(phone, BIG, '1920');
await W.setViewportSize(SMALL);
await W.waitForTimeout(500);
await everyKind(phone, SMALL, '1280');
await post('/guardian/wall/clear', {});
await until(W, () => document.getElementById('thewall').dataset.face === 'rest', null, 20000, '[g] rest at 1280');
await W.screenshot({ path: `${out}/wall-rest-1280.png` });
await unclipped(W, SMALL, 'rest 1280');
await post('/guardian/wall/leave', {});
await until(W, () => document.getElementById('thewall').dataset.face === 'unpaired' && document.querySelectorAll('#thewall .wallletter').length === 6, null, 20000, '[g] unpaired at 1280');
await W.screenshot({ path: `${out}/wall-unpaired-1280.png` });
await unclipped(W, SMALL, 'unpaired 1280');
const keyAt = await W.evaluate(() => document.querySelector('#thewall .wallkeys .g-key').getBoundingClientRect().height);
check(keyAt >= 43.5, `[g] the PAIR key is ${keyAt} px at 1280 × 720`);
// lost, at 1280, with nothing on it
await W.route('**/guardian/wall/stream*', (r) => r.abort());
await until(W, () => window.__ghosty.thewall.lost === true, null, 30000, '[g] no lost line at 1280');
await W.screenshot({ path: `${out}/wall-lost-1280.png` });
await unclipped(W, SMALL, 'lost 1280');
await W.unroute('**/guardian/wall/stream*');
await wall.ctx.close();

// ---------------- the phone at 440 and 390
for (const vp of [PHONE, PHONE_390]) {
  const p = await openPhone({ viewport: vp });
  await p.page.evaluate(() => (location.hash = 'settings'));
  await openPanel(p.page, 'settings', 'THE WALL');
  await until(p.page, () => !!document.querySelector('.wallpn .wallcodein') && document.querySelector('.wallpn').getClientRects().length > 0, null, 15000, `[g ${vp.width}] no THE WALL page`);
  await p.page.locator('.wallpn').scrollIntoViewIfNeeded();
  const sideways = await p.page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth, keys: [...document.querySelectorAll('.wallpn .g-key, .wallpn input')].filter((e) => e.getClientRects().length).map((e) => Math.round(e.getBoundingClientRect().height)) }));
  check(sideways.sw <= sideways.iw + 1 && sideways.keys.every((h) => h >= 43), `[g ${vp.width}] THE WALL's page: ${JSON.stringify(sideways)}`);
  await p.page.screenshot({ path: `${out}/wall-phone-settings-${vp.width}.png` });
  // with a wall paired, the Stage's keys fit at this width
  const w2 = await openWall({ viewport: SMALL });
  await until(w2.page, () => document.querySelectorAll('#thewall .wallletter').length === 6, null, 40000, `[g ${vp.width}] no code`);
  const code = await w2.page.evaluate(() => [...document.querySelectorAll('#thewall .wallletter')].map((l) => l.textContent).join(''));
  await p.page.evaluate(async (c) => { await fetch('/api/guardian/wall/pair', { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' }, body: JSON.stringify({ code: c }) }); await window.__ghosty.wallphone.refresh(); }, code);
  await p.page.evaluate(() => (location.hash = 'core'));
  await say(p.page, 'show me a chart of my bills', REPLY_BILLS);
  await until(p.page, () => !!document.querySelector('#thestage[data-kind="chart"] [data-wall]'), null, 20000, `[g ${vp.width}] no WALL key`);
  const stage = await p.page.evaluate(() => {
    const st = document.querySelector('#thestage').getBoundingClientRect();
    return { keys: [...document.querySelectorAll('#thestage .g-key')].map((b) => { const r = b.getBoundingClientRect(); return { h: Math.round(r.height), inside: r.left >= st.left - 1 && r.right <= st.right + 1 }; }), sw: document.documentElement.scrollWidth, iw: window.innerWidth };
  });
  check(stage.sw <= stage.iw + 1 && stage.keys.every((k) => k.h >= 43 && k.inside), `[g ${vp.width}] the Stage with a WALL key: ${JSON.stringify(stage)}`);
  await p.page.screenshot({ path: `${out}/wall-phone-stage-${vp.width}.png` });
  await api(p.page, '/guardian/wall/leave', { method: 'POST', body: '{}' });
  await w2.ctx.close();
  await p.ctx.close();
}

// ---------------- Reduce Motion: no transition class on the picture's arrival
await reset();
{
  const w3 = await openWall({ reduced: true, viewport: SMALL });
  await until(w3.page, () => document.querySelectorAll('#thewall .wallletter').length === 6, null, 40000, '[g reduced] no code');
  const code = await w3.page.evaluate(() => [...document.querySelectorAll('#thewall .wallletter')].map((l) => l.textContent).join(''));
  const post = (path, body) => fetch(`${base}/api${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': KEY }, body: JSON.stringify(body) }).then((r) => r.json());
  await post('/guardian/wall/pair', { code });
  await until(w3.page, () => ['paired', 'rest'].includes(document.getElementById('thewall')?.dataset.face), null, 20000, '[g reduced] not paired');
  await until(w3.page, () => document.getElementById('thewall').dataset.face === 'rest', null, 20000, '[g reduced] not resting');
  await post('/guardian/wall/show', SENT.chart);
  await until(w3.page, () => window.__ghosty.thewall.kind === 'chart', null, 8000, '[g reduced] no picture');
  const calm = await w3.page.evaluate(() => ({ fadeClass: !!document.querySelector('#thewall .wallframe.wallin'), flag: window.__ghosty.thewall.fade, anim: getComputedStyle(document.querySelector('#thewall .wallframe')).animationName, breath: getComputedStyle(document.querySelector('#thewall .wallorb svg')).animationName }));
  check(!calm.fadeClass && calm.flag === false && calm.anim === 'none', `[g reduced] the picture arrived with a transition: ${JSON.stringify(calm)}`);
  await w3.page.screenshot({ path: `${out}/wall-reduced-1280.png` });
  await post('/guardian/wall/leave', {});
  await w3.ctx.close();
}

await reset();
writeFileSync(`${out}/wall-timings.json`, JSON.stringify(timings, null, 2));
await browser.close();
if (problems.length) {
  console.log(`WALL run found ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`WALL run clean: the wall pairs by a six-letter code (a wrong one three times waits), draws a chart ${timings.phoneToWallChartMs} ms after the phone's tap, a map for "on the wall", keeps a face on the phone, rests and unpairs by a one-second hold, says it lost its brain and keeps the last picture dim, and clips nothing at 1920 × 1080 and 1280 × 720; the phone's page and Stage fit at 440 and 390; Reduce Motion brings no transition.`);
