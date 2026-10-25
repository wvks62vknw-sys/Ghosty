// The MARKETS tab on the owner's iPhone 18 Pro Max (440 × 956), at 390 × 844 and once at 1280 × 800, with CoinGecko
// stood in (its coins and its exchange rates; nothing else is fetched) and the chat's request caught before it
// reaches the brain (the preview is left as it was):
//  - the sources are free and keyless and still answer: no Stooq (a key since March 2026), no api.frankfurter.app
//    (it moved to a host the proxy refuses); gold and silver an ounce and what £1 buys come from CoinGecko's rates;
//  - every price says when it was read ("as of 14:02"); prices the phone cannot refresh are never called live;
//  - the top says what moved, in plain words: no "Risk on / Risk off", no unitless dials;
//  - a coin opens its week as a chart in place (its high and low, a week ago to now) with ASK WHY IT MOVED, which
//    asks for what happened, never whether to buy or sell; the tab is not left;
//  - a row's trace is the last 24 hours and agrees with its change; pence are kept; minus is a true minus;
//  - the Plan hub's card and the deck's line agree with the tab and are not LIVE when the prices are old;
//  - a source that cannot be reached is named; the currency switch is three 44 pt buttons;
//  - nothing sideways at 440 and 390; every button in the tab at least 44 pt.
import { launch } from './browser.mjs';
import { PHONE, UK, openDeck } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

// ---- the stand-ins: eight coins (hourly prices for a week) and the exchange rates (per bitcoin) ----
const UPDATED = Date.now() - 60_000;
const hhmm = (t) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
const week = (p, drift) => Array.from({ length: 168 }, (_, i) => p * (1 + drift * (i - 167) / 167 + 0.01 * Math.sin(i / 7)));
const COINS = [
  ['btc', 'Bitcoin', 60411, 0.2, -0.04], ['eth', 'Ethereum', 2894.2, -1.31, 0.03], ['sol', 'Solana', 141.7, 3.6, -0.02], ['xrp', 'XRP', 1.88, -0.4, 0.01],
  ['doge', 'Dogecoin', 0.1543, 5.2, -0.05], ['ada', 'Cardano', 0.512, -2.2, 0.02], ['link', 'Chainlink', 13.21, 0.9, 0], ['ltc', 'Litecoin', 71.3, -0.1, 0.01],
];
const USD = 1.3374;
const coinsBody = (cur) => JSON.stringify(COINS.map(([s, n, p, c, d]) => {
  const k = cur === 'usd' ? USD : 1;
  return { symbol: s, name: n, current_price: +(p * k).toPrecision(6), price_change_percentage_24h: c, high_24h: +(p * k * 1.02).toPrecision(6), low_24h: +(p * k * 0.98).toPrecision(6), last_updated: new Date(UPDATED).toISOString(), sparkline_in_7d: { price: week(p * k, d) } };
}));
const PER = { btc: 1, usd: 80671.78, gbp: 60317.65, eur: 72002.63, jpy: 12654575.9, aed: 296267.1, inr: 7659507.4, pkr: 22307971, chf: 66560.5, xau: 20.189, xag: 1496.74 };
const RATES = JSON.stringify({ rates: Object.fromEntries(Object.entries(PER).map(([k, v]) => [k, { name: k, unit: k, value: v, type: 'fiat' }])) });
const gbp = (x) => `£${x.toLocaleString('en-GB', { maximumFractionDigits: 0 })}`;
const GOLD = gbp(PER.gbp / PER.xau);
const DOLLAR = `$${(PER.usd / PER.gbp).toLocaleString('en-GB', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`;

async function open(viewport, { down = false, clock = false } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, hasTouch: viewport.width < 900 });
  const page = await ctx.newPage();
  const st = { down, asked: [], chat: [] };
  page.on('pageerror', (e) => problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  if (clock) await page.clock.install();
  await page.route('**/api/proxy?**', (r) => {
    const t = new URL(new URL(r.request().url()).searchParams.get('url') ?? 'about:blank');
    st.asked.push(t.href);
    if (st.down) return r.abort();
    if (t.hostname === 'api.coingecko.com' && t.pathname.endsWith('/coins/markets')) return r.fulfill({ contentType: 'application/json', body: coinsBody(t.searchParams.get('vs_currency')) });
    if (t.hostname === 'api.coingecko.com' && t.pathname.endsWith('/exchange_rates')) return r.fulfill({ contentType: 'application/json', body: RATES });
    // every other feed (the weather, the news…) as down: this spec reads only the markets
    return r.abort();
  });
  // the chat is caught here: what the tab would ask, and nothing reaches the preview's brain
  await page.route('**/api/chat', (r) => {
    st.chat.push(r.request().postData() ?? '');
    return r.abort();
  });
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'markets'));
  await page.waitForSelector('#pg-markets .pn.coins', { timeout: 10000 });
  return { ctx, page, st };
}
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => '');
const coinRows = (page) => page.$$eval('#pg-markets .pn.coins .rw.link', (rs) => rs.map((r) => ({
  text: r.innerText.replace(/\s+/g, ' '),
  tone: r.querySelector('.n')?.classList.contains('dn') ? 'dn' : 'up',
  trace: r.querySelector('svg.spark')?.dataset.tone ?? '',
  points: (r.querySelector('svg.spark polyline')?.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean).length,
})));
const hubCard = async (page) => {
  await page.evaluate(() => (location.hash = 'area-plan'));
  await page.waitForSelector('.hubtile[data-id="markets"]', { timeout: 10000 }).catch(() => problems.push('the Plan hub has no Markets card'));
  await page.waitForTimeout(600);
  return page.$eval('.hubtile[data-id="markets"]', (c) => ({
    status: c.dataset.status ?? '',
    reads: [...c.querySelectorAll('.rd')].map((r) => `${r.querySelector('em')?.textContent ?? ''}=${r.querySelector('b')?.textContent ?? ''}`),
    dn: !!c.querySelector('.ins svg')?.classList.contains('dn'),
    points: (c.querySelector('.ins svg polyline')?.getAttribute('points') ?? '').trim().split(/\s+/).filter(Boolean).length,
  })).catch(() => null);
};
const deckLine = async (page) => {
  await openDeck(page);
  const t = await text(page, '#deck .dkcard[data-id="markets"]');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  return t.replace(/\s+/g, ' ');
};

// ---- 1. the phone, every source answering ----
{
  const { ctx, page, st } = await open(PHONE);
  await page.waitForFunction(() => document.querySelectorAll('#pg-markets .pn.coins .rw.link').length >= 8, null, { timeout: 15000 }).catch(() => problems.push('[440] the eight coins never showed'));
  await page.waitForFunction(() => /Gold/.test(document.querySelector('#pg-markets')?.innerText ?? ''), null, { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/markets-440.png` });
  const all = await text(page, '#pg-markets');

  // free, keyless sources that still answer
  for (const dead of ['stooq.com', 'api.frankfurter.app']) if (st.asked.some((u) => new URL(u).hostname === dead)) problems.push(`[440] still asks ${dead} (it no longer answers for free: ${dead === 'stooq.com' ? 'a key since March 2026' : 'moved to a host the proxy refuses'})`);
  if (!st.asked.some((u) => /api\.coingecko\.com\/api\/v3\/exchange_rates/.test(u))) problems.push('[440] gold, silver and the currencies are not read from CoinGecko\'s exchange rates');
  if (!new RegExp(`Gold[\\s\\S]{0,40}${GOLD.replace(/[$£,.]/g, '\\$&')} an ounce`).test(all)) problems.push(`[440] gold is not shown an ounce in pounds (${GOLD} an ounce): ${all.slice(0, 600)}`);
  if (!/Silver[\s\S]{0,40}£\d+\.\d\d an ounce/.test(all)) problems.push('[440] silver is not shown an ounce in pounds');
  if (!new RegExp(`US dollar[\\s\\S]{0,20}${DOLLAR.replace(/[$.]/g, '\\$&')}`).test(all)) problems.push(`[440] the currencies do not say what £1 buys in plain words (US dollar ${DOLLAR})`);
  if (/GBP\/USD|INDICES|Indices & commodities|NO FEED/i.test(all)) problems.push('[440] the old jargon or the dead indices panel is still there ("GBP/USD", "Indices & commodities", "NO FEED")');

  // when every price was read
  const coinStatus = await text(page, '#pg-markets .pn.coins > h3 small');
  const shown = await page.$eval('#pg-markets .pn.coins > h3 small', (e) => getComputedStyle(e, '::before').content + e.textContent).catch(() => '');
  if (!new RegExp(`as of ${hhmm(UPDATED)}`, 'i').test(shown)) problems.push(`[440] the crypto panel does not say when CoinGecko last updated its prices ("as of ${hhmm(UPDATED)}"): "${coinStatus}"`);
  for (const cls of ['metals', 'fx']) {
    const s = await page.$eval(`#pg-markets .pn.${cls} > h3 small`, (e) => e.textContent).catch(() => '');
    if (!/as of \d\d:\d\d/i.test(s ?? '')) problems.push(`[440] the ${cls} panel does not say when its rates were read: "${s}"`);
  }
  const hero = (await text(page, '#pg-markets .hero')).replace(/\s+/g, ' ');
  if (!new RegExp(`as of ${hhmm(UPDATED)}`, 'i').test(hero)) problems.push(`[440] the top does not say when the prices were read: "${hero}"`);

  // what moved, in plain words
  if (/risk (on|off)/i.test(hero) || /\bBEST\b|\bWORST\b/i.test(all)) problems.push(`[440] the top still says "Risk on/off" or has unitless BEST / WORST dials: "${hero}"`);
  if (!/(Quiet day|Mostly up|Mostly down|Mixed)/.test(hero)) problems.push(`[440] the top does not say in a word how the day went: "${hero}"`);
  if (!/Dogecoin moved most, up 5\.20%/.test(hero)) problems.push(`[440] the top does not say what moved most ("Dogecoin moved most, up 5.20%"): "${hero}"`);
  if (!/Gold £[\d,]+ an ounce/.test(hero) && !/£1 buys \$1\.34/.test(hero)) problems.push(`[440] the top's sentence leaves out gold or the dollar: "${hero}"`);
  if (/buy (it|now)|sell (it|now)|good time to/i.test(all)) problems.push('[440] the tab gives buy/sell advice');

  // the rows: pence kept, a true minus, the trace is the last day and agrees with the change
  const rows = await coinRows(page);
  const rt = rows.map((r) => r.text).join(' | ');
  for (const want of ['£60,411', '£2,894', '£141.70', '£1.88', '£0.1543', '£0.512', '£13.21', '£71.30']) if (!rt.includes(want)) problems.push(`[440] a price lost its pence or its form: ${want} not in "${rt}"`);
  if (!rt.includes('−1.31%') || /-\d/.test(rt)) problems.push(`[440] a fall is not written with a true minus ("−1.31%"): "${rt}"`);
  for (const r of rows) {
    if (r.trace !== r.tone) problems.push(`[440] a row's trace disagrees with its change: ${r.text} (trace ${r.trace || 'uncoloured'}, change ${r.tone})`);
    if (r.points !== 25) problems.push(`[440] a row's trace is not the last 24 hours (25 hourly points): ${r.points} in ${r.text}`);
  }
  const title = await page.$eval('#pg-markets .pn.coins .ptitle', (e) => e.dataset.label ?? e.textContent).catch(() => '');
  if (!/24 hours/i.test(title ?? '')) problems.push(`[440] the crypto panel does not say its changes and traces are the last 24 hours: "${title}"`);

  // the currency switch: three 44 pt buttons, the one in use marked; $ refetches in dollars, gold follows
  const cur = await page.$$eval('#pg-markets .mkcur button', (bs) => bs.map((b) => ({ t: b.textContent, on: b.getAttribute('aria-pressed'), w: b.offsetWidth, h: b.offsetHeight })));
  if (cur.length !== 3 || cur.some((b) => b.w < 44 || b.h < 44) || cur.find((b) => b.on === 'true')?.t !== '£') problems.push(`[440] the currency switch is not three 44 pt buttons with £ marked: ${JSON.stringify(cur)}`);
  else {
    await page.click('#pg-markets .mkcur button:nth-child(2)');
    await page.waitForFunction(() => /\$60,|\$80,/.test(document.querySelector('#pg-markets .pn.coins')?.innerText ?? ''), null, { timeout: 10000 }).catch(() => undefined);
    const usd = await text(page, '#pg-markets');
    if (!st.asked.some((u) => /vs_currency=usd/.test(u))) problems.push('[440] $ did not fetch the prices in dollars');
    if (!/\$80,79\d/.test(usd) || !/Gold[\s\S]{0,40}\$[\d,]+ an ounce/.test(usd)) problems.push(`[440] after $, Bitcoin and gold are not in dollars: ${usd.slice(0, 500)}`);
    await page.click('#pg-markets .mkcur button:nth-child(1)');
    await page.waitForFunction(() => /£60,411/.test(document.querySelector('#pg-markets .pn.coins')?.innerText ?? ''), null, { timeout: 10000 }).catch(() => problems.push('[440] back to £ did not show pounds again'));
  }

  // a coin opens its week in place, with an honest axis, and ASK WHY IT MOVED asks for what happened only
  await page.click('#pg-markets .pn.coins .rw.link >> nth=0');
  await page.waitForSelector('.modal .mkcoin', { timeout: 5000 }).catch(() => problems.push('[440] tapping Bitcoin did not open its chart'));
  await page.waitForTimeout(400);
  if (!/markets/.test(await page.evaluate(() => location.hash))) problems.push('[440] tapping a coin left the Markets tab');
  const sheet = (await text(page, '.modal')).replace(/\s+/g, ' ');
  await page.screenshot({ path: `${out}/markets-440-coin.png` });
  const pts = await page.$eval('.modal .mkcoin svg.mkchart polyline', (p) => p.getAttribute('points').trim().split(/\s+/).length).catch(() => 0);
  if (pts < 100) problems.push(`[440] the coin's chart is not its week (${pts} points)`);
  const hi = Math.max(...week(60411, -0.04)), lo = Math.min(...week(60411, -0.04));
  if (!sheet.includes(gbp(hi)) || !sheet.includes(gbp(lo))) problems.push(`[440] the chart's axis does not give its high and low (${gbp(hi)}, ${gbp(lo)}): "${sheet}"`);
  if (!/7 days ago/.test(sheet) || !/\bNow\b/i.test(sheet)) problems.push(`[440] the chart's time axis is not labelled (7 days ago … now): "${sheet}"`);
  if (!new RegExp(`as of ${hhmm(UPDATED)}`, 'i').test(sheet)) problems.push(`[440] the coin's sheet does not say when its price was read: "${sheet}"`);
  const ask = page.locator('.modal button', { hasText: /ask why it moved/i });
  const sz = await ask.boundingBox().catch(() => null);
  if (!sz) problems.push('[440] the coin has no ASK WHY IT MOVED');
  else {
    if (sz.height < 44) problems.push(`[440] ASK WHY IT MOVED is ${Math.round(sz.height)} pt tall`);
    await ask.click();
    await page.waitForTimeout(1200);
    const msg = st.chat.map((b) => { try { return JSON.parse(b).message ?? ''; } catch { return b; } }).join(' ');
    if (!/Bitcoin/.test(msg) || !/not whether to buy or sell/i.test(msg) || /quick take/i.test(msg)) problems.push(`[440] ASK WHY IT MOVED asked "${msg}" (wants what happened to Bitcoin, never whether to buy or sell)`);
  }
  await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => m.remove()));
  await page.evaluate(() => (location.hash = 'markets'));
  await page.waitForTimeout(500);

  // every button in the tab is at least 44 pt (its laid-out size: the screen's entrance may still be scaling it); nothing sideways
  const small = await page.$$eval('#pg-markets button', (bs) => bs.filter((b) => b.offsetParent).map((b) => [b.textContent?.trim(), { width: b.offsetWidth, height: b.offsetHeight }]).filter(([, r]) => r.width && (r.width < 44 || r.height < 44)).map(([t, r]) => `${t} ${r.width}×${r.height}`));
  if (small.length) problems.push(`[440] buttons under 44 pt: ${small.join(', ')}`);
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push('[440] the page scrolls sideways');

  // the Plan hub's card and the deck agree with the tab
  const card = await hubCard(page);
  if (!card || card.status !== 'live' || !card.reads.includes('Bitcoin=£60,411') || !card.reads.some((r) => /^24 h=\+0\.20%$/i.test(r))) problems.push(`[440] the hub's Markets card does not agree with the tab (LIVE, Bitcoin £60,411, 24 h +0.20%): ${JSON.stringify(card)}`);
  else if (card.dn || card.points !== 25) problems.push(`[440] the hub's trace is not the last 24 hours in the colour of the change: ${JSON.stringify(card)}`);
  const line = await deckLine(page);
  if (/today/i.test(line) || !/Bitcoin \+0\.20% · 24 h/.test(line)) problems.push(`[440] the deck's Markets line does not say what it measures ("Bitcoin +0.20% · 24 h"): "${line}"`);
  await ctx.close();
}

// ---- 2. the prices go old: CoinGecko stops answering after the first read ----
{
  const { ctx, page, st } = await open(PHONE, { clock: true });
  await page.waitForFunction(() => /£60,411/.test(document.querySelector('#pg-markets .pn.coins')?.innerText ?? ''), null, { timeout: 15000 }).catch(() => problems.push('[stale] the first prices never showed'));
  st.down = true;
  await page.clock.fastForward('11:00');
  await page.waitForTimeout(1500);
  const hero = (await text(page, '#pg-markets .hero')).replace(/\s+/g, ' ');
  const status = await page.$eval('#pg-markets .pn.coins > h3 small', (e) => e.textContent).catch(() => '');
  // (the faked clock can hold the frame a screenshot waits for: the picture is a nice-to-have here)
  await page.screenshot({ path: `${out}/markets-440-stale.png`, timeout: 8000 }).catch(() => undefined);
  if (!/CoinGecko can.t be reached/i.test(hero) || !new RegExp(`as of ${hhmm(UPDATED)}`, 'i').test(hero)) problems.push(`[stale] the top does not say the prices are from ${hhmm(UPDATED)} and CoinGecko can't be reached: "${hero}"`);
  if (/live/i.test(status ?? '') || !/as of/i.test(status ?? '')) problems.push(`[stale] old prices are still called live: "${status}"`);
  if (/Mostly|Mixed|Quiet day/.test(await text(page, '#pg-markets .bigv'))) problems.push('[stale] the top still sums up the day from old prices as if they were now');
  // the switch while CoinGecko is down: the pounds stay pounds (never £ numbers with a $ sign)
  await page.click('#pg-markets .mkcur button:nth-child(2)').catch(() => undefined);
  await page.waitForTimeout(1500);
  const rt = (await coinRows(page)).map((r) => r.text).join(' | ');
  if (/\$60,411/.test(rt)) problems.push(`[stale] pounds shown with a dollar sign after $ with the source down: "${rt.slice(0, 200)}"`);
  await page.click('#pg-markets .mkcur button:nth-child(1)').catch(() => undefined);
  const card = await hubCard(page);
  if (!card || card.status === 'live' || !card.reads.some((r) => new RegExp(`^As of=${hhmm(UPDATED)}$`, 'i').test(r))) problems.push(`[stale] the hub's Markets card calls old prices live or hides their time: ${JSON.stringify(card)}`);
  await ctx.close();
}

// ---- 3. CoinGecko down from the start: said, by name, with nothing made up ----
{
  const { ctx, page } = await open(PHONE, { down: true });
  await page.waitForTimeout(3500);
  const all = (await text(page, '#pg-markets')).replace(/\s+/g, ' ');
  const big = await text(page, '#pg-markets .bigv');
  await page.screenshot({ path: `${out}/markets-440-down.png` });
  if (/^-+$/.test(big.trim()) || /NO FEED|no signal/i.test(all)) problems.push(`[down] the top shows "--" or "NO FEED" instead of words: "${big}" / "${all.slice(0, 200)}"`);
  if (!/CoinGecko can.t be reached/i.test(all)) problems.push(`[down] the tab does not name the source it cannot reach: "${all.slice(0, 400)}"`);
  if (/Mostly|Mixed|Quiet day|Risk/.test(all)) problems.push('[down] the top sums up a day it has no prices for');
  await ctx.close();
}

// ---- 4. the smaller phone and the desktop: nothing sideways, the sentence shown ----
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  const { ctx, page } = await open(vp);
  await page.waitForFunction(() => document.querySelectorAll('#pg-markets .pn.coins .rw.link').length >= 8, null, { timeout: 15000 }).catch(() => problems.push(`[${vp.width}] the coins never showed`));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/markets-${vp.width}.png` });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`[${vp.width}] the page scrolls sideways`);
  const say = await page.locator('#pg-markets .mksay').first().isVisible().catch(() => false);
  if (!say) problems.push(`[${vp.width}] the sentence on what moved is not shown`);
  const small = await page.$$eval('#pg-markets button', (bs) => bs.filter((b) => b.offsetParent).map((b) => [b.textContent?.trim(), { width: b.offsetWidth, height: b.offsetHeight }]).filter(([, r]) => r.width && (r.width < 44 || r.height < 44)).map(([t, r]) => `${t} ${r.width}×${r.height}`));
  if (small.length) problems.push(`[${vp.width}] buttons under 44 pt: ${small.join(', ')}`);
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.error(`markets: ${problems.length} problem(s)\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log('markets: ok');
