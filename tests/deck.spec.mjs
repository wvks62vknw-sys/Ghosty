// The Every screen deck (BRIEF-DECK-BUILD.md; shell/launcher.ts, shell/deckcopy.ts) and the icon language without app
// icons (OWNER-ISSUES 32–34), on the iPhone 18 Pro Max (440 × 956, en-GB, Europe/London):
//  - the deck opens (tests/nav.mjs openDeck) with its four groups and all twenty cards, each promise whole (two
//    lines at most, never cut), Core's live line lit ("you are here"), nothing sticking out sideways;
//  - tapping Lens opens it in place: the miniature of the real screen, at least three YOU CAN rows, DID YOU KNOW and
//    OPEN; only one card is open at a time; a YOU CAN row deep-links (Lens → SCAN on TRANSLATE, read from
//    window.__ghosty.lens and .scan);
//  - TRY THIS NOW has three picks, and an "Ask Ghosty" pick puts its words in the chat;
//  - typing "ag" in the pill leaves Agenda showing; return with no match sends the words to the chat;
//  - no glyph has a filled square behind it (computed background alpha 0, no background image): the deck's card
//    glyphs, the Me sheet's rows, Settings' list rows, Search's results and the hubs' tiles;
//  - the Me sheet still opens and its rows still go where they say.
//   BASE=http://localhost:8788 node tests/deck.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { openDeck } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined });
const ctx = await browser.newContext({ viewport: { width: 440, height: 956 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true, locale: 'en-GB', timezoneId: 'Europe/London' });
await ctx.addInitScript(([k]) => {
  localStorage.setItem('ghosty.ownerKey', k);
  if (!localStorage.getItem('ghosty.settings')) localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Boss', home: { name: 'Birmingham', lat: 52.4862, lon: -1.8904 }, units: 'metric' }));
}, [KEY]);
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
await page.waitForFunction(() => document.body.dataset.tab === 'core', null, { timeout: 20000 }).catch(() => problems.push('Home did not open'));
await page.waitForTimeout(2500);

const until = (fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => (problems.push(why), false));
const deck = () => page.evaluate(() => window.__ghosty?.deck ?? null);
/** Glyph wrappers under `sel` whose background is filled (any alpha, or an image). */
const filled = (sel) => page.$$eval(sel, (els) => els.filter((e) => e.getClientRects().length).map((e) => {
  const cs = getComputedStyle(e);
  const a = /rgba?\(([^)]+)\)/.exec(cs.backgroundColor)?.[1].split(',').map((x) => x.trim());
  const alpha = !a ? 0 : a.length === 4 ? Number(a[3]) : 1;
  return alpha > 0 || cs.backgroundImage !== 'none' ? `${e.className} (${cs.backgroundColor} ${cs.backgroundImage.slice(0, 40)})` : '';
}).filter(Boolean));

// ---- the deck: four groups, twenty cards, each promise whole
await openDeck(page);
await until(() => document.querySelector('#deck.on') && window.__ghosty?.deck?.open, null, 5000, 'the deck did not open');
await page.waitForTimeout(700);
const look = await page.evaluate(() => ({
  title: document.querySelector('#deck .dktitle')?.textContent,
  kick: document.querySelector('#deck .dkhead .dkk')?.textContent,
  sub: document.querySelector('#deck .dksub')?.textContent,
  groups: [...document.querySelectorAll('#deck .dksec')].map((x) => x.textContent),
  cards: [...document.querySelectorAll('#deck .dkcard')].map((c) => c.dataset.id),
  cut: [...document.querySelectorAll('#deck .dkcard .dkpr')].filter((p) => p.scrollHeight > p.clientHeight + 1 || p.getBoundingClientRect().height > 2 * parseFloat(getComputedStyle(p).lineHeight) + 1).map((p) => `${p.closest('.dkcard').dataset.id}: ${p.textContent}`),
  core: { live: document.querySelector('#deck .dkcard[data-id="core"] .dklive')?.textContent ?? '', hot: !!document.querySelector('#deck .dkcard[data-id="core"] .dklive.hot') },
  wide: document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('#deck .dkcard, #deck .dkgo, #deck .dkhead')].some((e) => { const r = e.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }),
}));
if (look.kick !== 'Every screen' || look.title !== 'At your service, Boss' || look.sub !== 'Tap any screen to find out what it can do.') problems.push(`the deck's header reads ${JSON.stringify([look.kick, look.title, look.sub])}`);
if (look.groups.join(',') !== 'Ask and see,Make,Learn and plan,Me') problems.push(`the deck's groups are ${look.groups.join(', ')}`);
const ALL = ['core', 'brief', 'eye', 'lens', 'studio', 'workshop', 'reverse', 'space', 'learn', 'gym', 'school', 'library', 'agenda', 'markets', 'threats', 'radio', 'memory', 'settings', 'system', 'links'];
if (look.cards.length !== 20 || ALL.some((id) => !look.cards.includes(id))) problems.push(`the deck has ${look.cards.length} cards: ${look.cards.join(', ')}`);
for (const c of look.cut) problems.push(`a promise runs past two lines: ${c}`);
if (!/^Online/.test(look.core.live) || !look.core.hot) problems.push(`Core's live line is "${look.core.live}" (lit: ${look.core.hot})`);
if (look.wide) problems.push('the deck sticks out sideways');
for (const f of await filled('#deck :is(.dkg, .sq, .rctile)')) problems.push(`a deck glyph has a filled background: ${f}`);
await page.screenshot({ path: `${out}/deck-440-closed.png` });

// ---- Lens opens in place: the picture, YOU CAN, DID YOU KNOW, OPEN; one card at a time
await page.click('#deck .dkcard[data-id="core"]');
await page.waitForTimeout(400);
await page.click('#deck .dkcard[data-id="lens"]');
await until(() => document.querySelector('#deck .dkx[data-id="lens"] .dkmini img')?.complete, null, 8000, 'Lens did not open with its picture');
await page.waitForTimeout(800);
const lens = await page.evaluate(() => {
  const x = document.querySelector('#deck .dkx');
  const img = x?.querySelector('.dkmini img');
  return {
    open: document.querySelectorAll('#deck .dkx').length,
    sel: [...document.querySelectorAll('#deck .dkcard.sel')].map((c) => c.dataset.id),
    expanded: document.querySelector('#deck .dkcard[data-id="lens"]')?.getAttribute('aria-expanded'),
    picture: img ? `${img.naturalWidth}x${img.naturalHeight}` : '',
    shown: !!img && !img.closest('.dkmini.none') && img.getBoundingClientRect().width >= 90,
    rows: [...(x?.querySelectorAll('.dkcan .dkrow') ?? [])].map((r) => r.textContent),
    dyk: x?.querySelector('.dkdyk')?.textContent ?? '',
    open_: x?.querySelector('.dkopen')?.textContent ?? '',
    below: (() => { const c = document.querySelector('#deck .dkcard[data-id="lens"]').getBoundingClientRect(); const r = x?.getBoundingClientRect(); return !!r && r.top >= c.bottom - 1 && r.width > c.width * 1.8; })(),
  };
});
if (lens.open !== 1 || lens.sel.join() !== 'lens' || lens.expanded !== 'true') problems.push(`more than one card open, or not Lens: ${JSON.stringify(lens)}`);
if (lens.picture !== '220x478' || !lens.shown) problems.push(`Lens's picture: ${lens.picture} (shown: ${lens.shown})`);
if (lens.rows.length < 3) problems.push(`Lens has ${lens.rows.length} YOU CAN rows`);
if (!/^Did you know/i.test(lens.dyk) || lens.dyk.length < 30) problems.push(`Lens's DID YOU KNOW reads "${lens.dyk}"`);
if (lens.open_ !== 'Open Lens') problems.push(`Lens's OPEN reads "${lens.open_}"`);
if (!lens.below) problems.push('Lens did not open full width under its row');
for (const f of await filled('#deck .dkx :is(.dkg, .sq)')) problems.push(`an open card's glyph has a filled background: ${f}`);
await page.screenshot({ path: `${out}/deck-440-lens.png` });

// ---- a YOU CAN row deep-links: Lens on SCAN, TRANSLATE
await page.locator('#deck .dkx .dkrow', { hasText: 'Translate a sign or a menu' }).click();
await until(() => !document.querySelector('#deck.on') && document.body.dataset.tab === 'lens' && window.__ghosty?.lens?.mode === 'scan' && window.__ghosty?.scan?.sub === 'translate', null, 15000,
  `"Translate a sign or a menu" did not open the Lens on SCAN → TRANSLATE: ${JSON.stringify(await page.evaluate(() => [document.body.dataset.tab, window.__ghosty?.lens?.mode, window.__ghosty?.scan?.sub]))}`);
if (!(await page.locator('#pg-lens .scansubs button.on', { hasText: /translate/i }).count())) problems.push('the Lens did not show TRANSLATE chosen');

// ---- TRY THIS NOW: three picks; an "Ask Ghosty" pick says its words in the chat
await openDeck(page);
await until(() => !!document.querySelector('#deck.on'), null, 5000, 'the deck did not open again');
await page.waitForTimeout(500);
const picks = await page.$$eval('#deck .dkpick', (ps) => ps.map((p) => ({ id: p.dataset.id, act: p.dataset.act, words: p.querySelector('.dkwords')?.textContent ?? '', go: p.querySelector('.dkdo')?.textContent ?? '' })));
if (picks.length !== 3) problems.push(`TRY THIS NOW has ${picks.length} picks`);
const ask = picks.find((p) => p.act === 'ask');
if (!ask || ask.go !== 'Ask Ghosty ›') problems.push(`no "Ask Ghosty" pick today: ${JSON.stringify(picks)}`);
for (const p of picks.filter((x) => x.act === 'open')) if (!/^Open .+ ›$/.test(p.go)) problems.push(`a pick's action reads "${p.go}"`);
if (ask) {
  await page.click(`#deck .dkpick[data-act="ask"]`);
  await until((w) => document.body.dataset.tab === 'core' && [...document.querySelectorAll('#pg-core .log .msg.me')].some((m) => m.textContent.includes(w)), ask.words, 15000, `the pick's words "${ask.words}" did not reach the chat`);
}

// ---- the pill: "ag" leaves Agenda; return with no match asks Ghosty
await openDeck(page);
await until(() => !!document.querySelector('#deck.on'), null, 5000, 'the deck did not open a third time');
await page.fill('#deck .dkin', 'ag');
await page.waitForTimeout(400);
const ag = await page.evaluate(() => ({
  agenda: !!document.querySelector('#deck .dkcard[data-id="agenda"]')?.getClientRects().length,
  lens: !!document.querySelector('#deck .dkcard[data-id="lens"]')?.getClientRects().length,
  shown: window.__ghosty?.deck?.shown ?? [],
  tryShown: !!document.querySelector('#deck .dktry')?.getClientRects().length,
}));
if (!ag.agenda) problems.push('typing "ag" hid Agenda');
if (ag.lens || ag.shown.length > 4) problems.push(`typing "ag" left ${ag.shown.join(', ')} showing`);
if (ag.tryShown) problems.push('TRY THIS NOW stayed while typing');
await page.screenshot({ path: `${out}/deck-440-ag.png` });
const words = 'How far is the Moon from Birmingham';
await page.fill('#deck .dkin', words);
await page.waitForTimeout(300);
const noneShown = await page.evaluate(() => window.__ghosty?.deck?.shown?.length ?? -1);
if (noneShown !== 0) problems.push(`"${words}" matched ${noneShown} cards`);
await page.press('#deck .dkin', 'Enter');
await until((w) => !document.querySelector('#deck.on') && [...document.querySelectorAll('#pg-core .log .msg.me')].some((m) => m.textContent.includes(w)), words, 15000, 'return with no match did not send the words to the chat');

// ---- Escape and ✕ close the deck
await openDeck(page);
await page.waitForTimeout(400);
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
if ((await deck())?.open) problems.push('Escape did not close the deck');
await openDeck(page);
await page.waitForTimeout(400);
await page.click('#deck .dkclose');
await page.waitForTimeout(300);
if ((await deck())?.open) problems.push('✕ did not close the deck');

// ---- the Me sheet: still opens, rows bare glyphs, rows go where they say
const me = async () => {
  if (!(await page.locator('#top .you').isVisible().catch(() => false))) {
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(600);
  }
  await page.click('#top .you');
  await page.waitForSelector('#mesheet .merow', { timeout: 5000 }).catch(() => problems.push('the Me sheet did not open'));
  await page.waitForTimeout(900);
};
await me();
for (const f of await filled('#mesheet :is(.rctile, .sq, .rowic)')) problems.push(`a Me sheet glyph has a filled background: ${f}`);
const rows = await page.$$eval('#mesheet .merow', (rs) => rs.map((r) => r.dataset.id));
if (rows.join(',') !== 'memory,settings,system,links,deck') problems.push(`the Me sheet's rows are ${rows.join(', ')}`);
await page.screenshot({ path: `${out}/deck-440-me.png` });
for (const id of ['memory', 'settings', 'links']) {
  if (id !== 'memory') await me();
  await page.click(`#mesheet .merow[data-id="${id}"]`);
  await until((want) => document.body.dataset.tab === want && !document.querySelector('#mesheet'), id, 6000, `the Me sheet's ${id} row did not open ${id}`);
  await page.waitForTimeout(700);
  if (id === 'settings') for (const f of await filled('#pg-settings :is(.rowic, .sq)')) problems.push(`a Settings row glyph has a filled background: ${f}`);
}
await me();
await page.click('#mesheet .merow[data-id="deck"]');
await until(() => !!document.querySelector('#deck.on'), null, 5000, 'the Me sheet\'s Every screen row did not open the deck');
await page.keyboard.press('Escape');

// ---- Search's results and the hubs' tiles: bare glyphs too
await page.evaluate(() => (location.hash = 'area-learn'));
await page.waitForTimeout(1200);
for (const f of await filled('#pg-area-learn :is(.sq, .rowic)')) problems.push(`a hub glyph has a filled background: ${f}`);
await page.keyboard.press('Control+k');
await page.waitForSelector('#palette .gic', { timeout: 5000 }).catch(() => problems.push('Search showed no results'));
await page.fill('#palette input', 'lens').catch(() => undefined);
await page.waitForTimeout(500);
for (const f of await filled('#palette .gic')) problems.push(`a Search result glyph has a filled background: ${f}`);
await page.keyboard.press('Escape');

await browser.close();
if (problems.length) {
  console.error(`FAIL deck\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('deck: OK (20 cards in four groups, Lens opens in place with its picture, Translate deep link, an Ask pick and no-match return reach the chat, "ag" leaves Agenda, bare glyphs on the deck, the Me sheet, Settings, Search and the hubs; Me rows navigate)');
