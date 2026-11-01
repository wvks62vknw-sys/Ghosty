// LIVE CARDS, THE TRIGGER TABLE, SPEAKING FIRST AND HOME AS HIS WALL (BRIEF-SIDEWAYS, batch ②) on the owner's iPhone 18
// Pro Max (440 × 956, en-GB, Europe/London), against the real brain with the scripted model:
//  - a plate typed → the CAR offer ("That's a plate"); one tap → the CAR card with the key line (no DVSA key here);
//    every card in the chat: a title of four words at most, one line, two buttons at most, 180 pt at most, its picture
//    hidden from VoiceOver and the title read before the line, nothing sticking out sideways;
//  - Dad introduced in Settings → GUARDIAN (as guardian.spec does); "my dad's car is RX15 KNG" → kept in his memory (one
//    locked line), the PERSON card for Dad shows it, and GUARDIAN → PEOPLE lists it under Dad;
//  - a saved place's name → its MAP card;
//  - a stop word silences the day (the piece due is held: "you said stop today"); the dial in Settings → CHARACTER
//    changes the cap (QUIET 0, CHATTY 8);
//  - a BRIEF card posts at its minute with the clock stub (the morning piece; /__test/speak-at);
//  - Home shows the wall in order (danger, due, today's pieces, people and cars, the rest, progress), six at most, and
//    ALL SCREENS opens the deck in one tap.
// The cards he did not ask for wait for a spec to ask under a test runner (window.__ghostyCards), as the offers do.
// Everything it adds is taken away again: the car, the person, the place, the dial, the stop.
//   BASE=http://localhost:8788 node tests/cards.spec.mjs [outDir]
import { mkdirSync } from 'node:fs';
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, openPanel } from './nav.mjs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: PHONE, ...UK, serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  window.__ghostyCards = true;
});
const page = await ctx.newPage();
page.on('pageerror', (e) => webkitNoise(e) || problems.push(`pageerror: ${e.message}`));

await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
const api = (path, init = {}) => page.evaluate(async ([p, i, k]) => (await fetch(`/api${p}`, { ...i, headers: { 'content-type': 'application/json', 'x-ghosty': '1', 'x-ghosty-key': k } })).json(), [path, init, KEY]);
const until = (fn, arg, ms, what) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => (problems.push(what), false));
const speakAt = (at, reset = false) => fetch(`${base}/__test/speak-at?at=${at}${reset ? '&reset=1' : ''}`).then((r) => r.json());

// his clock (London): a time today, whatever the hour the spec runs at
const london = (ms) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { month: `${p.year}-${p.month}`, h: Number(p.hour), mi: Number(p.minute) };
};
const todayAt = (h, mi) => {
  const now = Date.now();
  const l = london(now);
  return now + ((h - l.h) * 60 + (mi - l.mi)) * 60_000;
};
const nowL = london(Date.now());
const hour = nowL.h + nowL.mi / 60;
// a waking minute today (the stop and the dial are judged on his day), and the morning piece's minute (forward only)
const waking = hour < 7.6 ? todayAt(7, 40) : hour >= 22.9 ? todayAt(22, 50) : Date.now();
const morning = hour >= 7.5 && hour < 10.9 ? Date.now() : hour < 7.5 ? todayAt(8, 5) : todayAt(8, 5) + 86_400_000;

// ---- the stage: a saved place, a fresh record of what was said unasked, the default dial
const gym = { id: 'gym', label: 'Gym', query: 'PureGym Moseley', address: 'PureGym, Alcester Road, Moseley', lat: 52.4452, lon: -1.8886 };
await api('/profile/places', { method: 'POST', body: JSON.stringify({ found: gym }) });
await api('/cars/RX15KNG', { method: 'DELETE' }); // (CI's retry runs on the same brain)
await speakAt(0, true);
await api('/speak', { method: 'POST', body: JSON.stringify({ dial: 'some' }) });
await api('/speak/stop', { method: 'DELETE' });

const openChat = async () => {
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(600);
  if (!(await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen')))) await page.click('.logbtn').catch(() => undefined);
  await page.waitForTimeout(400);
};
const say = async (words) => {
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
};
const chatCards = (kind) =>
  page.evaluate((k) => [...document.querySelectorAll(`#pg-core .ccard:not(.wall)${k ? `[data-kind="${k}"]` : ''}`)].map((c) => {
    const r = c.getBoundingClientRect();
    const t = c.querySelector('.cctitle');
    const l = c.querySelector('.ccline');
    return {
      id: c.dataset.id, kind: c.dataset.kind, title: t?.textContent ?? '', line: l?.textContent ?? '', why: c.querySelector('.ccwhy')?.textContent ?? '',
      buttons: [...c.querySelectorAll('.ccacts button')].map((b) => b.textContent ?? ''), h: Math.round(r.height), right: Math.round(r.right), left: Math.round(r.left),
      // VoiceOver: the picture hidden, the title before the line
      hidden: c.querySelector('.ccvis')?.getAttribute('aria-hidden') === 'true', order: !!t && !!l && !!(t.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING),
    };
  }), kind);

// ---- 1. Dad, introduced in Settings → GUARDIAN (as guardian.spec does)
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'GUARDIAN');
const gp = '#pg-settings .pn.pushed';
await page.waitForSelector(`${gp} input[aria-label="Your named person"]`, { timeout: 8000 });
await page.fill(`${gp} input[aria-label="Your named person"]`, 'Dad');
await page.fill(`${gp} input[aria-label="Their Telegram handle"]`, '');
await page.fill(`${gp} input[aria-label="Their email address"]`, 'dad@example.com');
await page.locator(`${gp} button`, { hasText: 'SAVE' }).click();
await until(() => /Dad is your named person/.test(document.querySelector('#toasts')?.textContent ?? ''), null, 8000, 'Dad was not saved as the named person');

// ---- 2. a plate typed → the CAR offer → one tap → the CAR card with the key line
await openChat();
await say('AB12 CDE');
await until(() => [...document.querySelectorAll('#pg-core .ccard[data-kind="car"]')].some((c) => /That's a plate/.test(c.textContent ?? '')), null, 20000, 'a plate typed: no CAR offer');
const offer = (await chatCards('car')).at(-1);
check(offer?.line === 'Want the car? Make, colour, MOT and tax from the public record.' && offer.buttons.join('|') === 'SHOW THE CAR', `the CAR offer: ${JSON.stringify(offer)}`);
await page.locator('#pg-core .ccard[data-kind="car"]:not(.wall) .ccacts button', { hasText: 'SHOW THE CAR' }).last().click();
await until(() => [...document.querySelectorAll('#pg-core .ccard[data-kind="car"]')].some((c) => /DVSA MOT history key: System → Keys/.test(c.textContent ?? '')), null, 15000, `the CAR card has no key line: ${JSON.stringify(await chatCards('car'))}`);
const carCard = (await chatCards('car')).at(-1);
check(carCard?.title === 'AB12 CDE' && carCard.line === 'Needs the free DVSA MOT history key: System → Keys.' && carCard.buttons.join('|') === 'OPEN KEYS', `the CAR card: ${JSON.stringify(carCard)}`);

// ---- 3. "my dad's car is RX15 KNG" → kept, the PERSON card for Dad shows it
await say("my dad's car is RX15 KNG");
await until(() => [...document.querySelectorAll('#pg-core .ccard[data-kind="person"]')].some((c) => /RX15 KNG/.test(c.textContent ?? '')), null, 20000, `no PERSON card for Dad with his car: ${JSON.stringify(await chatCards())}`);
const dad = (await chatCards('person')).at(-1);
check(dad?.title === 'Dad' && /^Your named person · .* · car RX15 KNG$/.test(dad.line) && dad.buttons.join('|') === 'OPEN|ASK', `the PERSON card: ${JSON.stringify(dad)}`);
const kept = await api('/cars');
check(kept.cars?.length === 1 && kept.cars[0].whose === 'Dad' && kept.cars[0].plate === 'RX15 KNG', `the car kept: ${JSON.stringify(kept)}`);
const memory = await api('/memory');
const fact = (memory.facts ?? memory.items ?? []).find((f) => /RX15 KNG/.test(f.text ?? ''));
check(fact?.text === "Dad's car: RX15 KNG" && fact.locked === true, `the memory line: ${JSON.stringify(fact ?? memory).slice(0, 300)}`);
// …and GUARDIAN → PEOPLE lists it under Dad
await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'GUARDIAN');
await until(() => /RX15 KNG/.test(document.querySelector('#pg-settings .guardperson[data-name="Dad"]')?.textContent ?? ''), null, 10000, `GUARDIAN → PEOPLE does not list Dad's car: "${await page.evaluate(() => document.querySelector('#pg-settings .guardpeople')?.textContent ?? '(no PEOPLE)')}"`);
await openChat();

// ---- 4. a saved place's name → MAP
await say('is the gym busy at the moment');
await until(() => [...document.querySelectorAll('#pg-core .ccard[data-kind="map"]')].some((c) => c.dataset.id === 'map:Gym'), null, 20000, `the gym: no MAP card (${JSON.stringify(await chatCards())})`);
const map = (await chatCards('map')).find((c) => c.id === 'map:Gym');
check(map?.title === 'Gym' && map.line === gym.address && map.buttons.join('|') === 'OPEN MAP|ASK', `the MAP card: ${JSON.stringify(map)}`);
await page.waitForTimeout(600);
await page.screenshot({ path: `${out}/cards-chat.png` });

// every card in the chat: four words, one line, two buttons, 180 pt, VoiceOver's order, nothing sideways
for (const c of await chatCards()) {
  const words = c.title.trim().split(/\s+/).length;
  if (words > 4 || c.buttons.length > 2 || c.h > 180 || !c.hidden || !c.order || c.right > PHONE.width + 1 || c.left < -1) problems.push(`a card breaks the kit's rules: ${JSON.stringify(c)}`);
}

// ---- 5. the stop word silences the day; the dial changes the cap
await api('/cars/months', { method: 'POST', body: JSON.stringify({ plate: 'RX15 KNG', mot: london(waking).month }) });
const before = (await chatCards('brief')).length;
await say('stop');
await page.waitForTimeout(1200);
const stopped = await api('/speak');
check(stopped.stopped === true, `a stop word did not silence the day: ${JSON.stringify(stopped)}`);
const held = await speakAt(waking);
const last = held.cadence?.log?.at(-1);
check(held.job && last?.held === 'you said stop today' && /^brief:(mot|morning)/.test(last.id ?? ''), `a piece due after "stop" was not held: ${JSON.stringify(held).slice(0, 400)}`);
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(1500);
check((await chatCards('brief')).length === before, 'a card came after "stop"');
await api('/speak/stop', { method: 'DELETE' });

await page.evaluate(() => (location.hash = 'settings'));
await openPanel(page, 'settings', 'CHARACTER');
const dial = '#pg-settings .character [data-dial="speak"]';
await page.waitForSelector(`${dial} button`, { timeout: 8000 });
const steps = await page.$$eval(`${dial} button`, (bs) => bs.map((b) => b.textContent));
check(steps.join('|') === 'QUIET|SOME|CHATTY', `the dial's steps: ${steps.join('|')}`);
check((await page.textContent(`${dial} button.on`)) === 'SOME', 'SOME is not the default');
const small = await page.$$eval(`${dial} button`, (bs) => bs.filter((b) => b.offsetHeight < 44).map((b) => `${b.textContent} ${b.offsetHeight}`));
check(!small.length, `dial steps under 44 pt: ${small.join(', ')}`);
await page.locator(`${dial} button`, { hasText: 'QUIET' }).click();
await until((s) => document.querySelector(`${s} button.on`)?.textContent === 'QUIET', dial, 8000, 'QUIET did not take');
check((await api('/speak')).cap === 0, 'QUIET: the cap is not 0');
const quiet = await speakAt(waking);
check(quiet.cadence?.log?.at(-1)?.held === 'the dial is on QUIET', `QUIET did not hold the piece: ${JSON.stringify(quiet.cadence?.log?.at(-1))}`);
await page.locator(`${dial} button`, { hasText: 'CHATTY' }).click();
await until((s) => document.querySelector(`${s} button.on`)?.textContent === 'CHATTY', dial, 8000, 'CHATTY did not take');
const chatty = await api('/speak');
check(chatty.dial === 'chatty' && chatty.cap === 8, `CHATTY: ${JSON.stringify(chatty).slice(0, 200)}`);
check(/up to eight times a day/.test((await page.textContent('#pg-settings .character .speaknow')) ?? ''), 'the dial does not say what CHATTY means');
await page.locator(`${dial} button`, { hasText: 'SOME' }).click();
await until((s) => document.querySelector(`${s} button.on`)?.textContent === 'SOME', dial, 8000, 'SOME did not take');

// ---- 6. a BRIEF card posts at its minute, with the clock stub: the morning piece
await speakAt(0, true);
const said = await speakAt(morning);
check(said.cadence?.log?.some((s) => s.id.startsWith('brief:morning:') && !s.held), `the morning piece was not said at its minute: ${JSON.stringify(said).slice(0, 400)}`);
await openChat();
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await until(() => [...document.querySelectorAll('#pg-core .ccard[data-kind="brief"]')].some((c) => /Good morning/.test(c.textContent ?? '')), null, 15000, 'the morning piece did not post its BRIEF card in the chat');
const brief = (await chatCards('brief')).find((c) => c.title === 'Good morning');
check(/diary/.test(brief?.line ?? '') && brief?.why === 'Why: the morning piece: your diary and the rain at Home', `the BRIEF card: ${JSON.stringify(brief)}`);

// ---- 7. Home shows the wall in order, six at most, ALL SCREENS one tap
await page.evaluate(() => (location.hash = 'brief'));
await page.waitForTimeout(500);
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(600);
if (await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.contains('logopen'))) await page.click('#top .logbtn').catch(() => undefined);
await page.click('#ccap').catch(() => undefined);
await until(() => !!document.querySelector('#pg-core .wall .walllist .ccard') && getComputedStyle(document.querySelector('#pg-core section.wall')).display !== 'none', null, 30000, 'Home shows no wall');
const wall = await page.evaluate(() => ({ ...window.__ghosty?.wall, shown: [...document.querySelectorAll('#pg-core .wall .walllist .ccard')].map((c) => ({ id: c.dataset.id, h: Math.round(c.getBoundingClientRect().height), right: Math.round(c.getBoundingClientRect().right) })), more: !document.querySelector('#pg-core section.wall .wallmore')?.hidden }));
const ranks = wall.ranks ?? [];
check(ranks.length && ranks.every((r, i) => !i || ranks[i - 1] <= r), `the wall is out of order: ${JSON.stringify(wall)}`);
for (const id of ['person:dad', 'map:Gym']) check((wall.ids ?? []).includes(id), `the wall lacks ${id}: ${JSON.stringify(wall.ids)}`);
check((wall.ids ?? []).indexOf('person:dad') < (wall.ids ?? []).indexOf('map:Gym'), 'the people’s news is not above the rest of today');
check(wall.shown.length <= 6 && wall.shown.length === Math.min(6, wall.ids.length) && wall.more === wall.ids.length > 6, `six at most, with MORE: ${JSON.stringify(wall)}`);
check(!wall.ids.some((id) => id === 'car:AB12CDE'), 'a vehicle record is on the wall');
for (const c of wall.shown) if (c.h < 44 || c.right > PHONE.width + 1) problems.push(`a wall card is under 44 pt or sideways: ${JSON.stringify(c)}`);
await page.locator('#pg-core section.wall').scrollIntoViewIfNeeded();
await page.screenshot({ path: `${out}/cards-wall.png` });
await page.click('#pg-core section.wall .wallall');
await until(() => document.querySelector('#deck')?.classList.contains('on'), null, 6000, 'ALL SCREENS did not open the deck');
await page.keyboard.press('Escape');

// ---- put back what it added
await api('/cars/RX15KNG', { method: 'DELETE' });
await api('/guardian/person', { method: 'DELETE' });
await api('/profile/places?id=gym', { method: 'DELETE' });
await api('/speak', { method: 'POST', body: JSON.stringify({ dial: 'some' }) });
await api('/speak/stop', { method: 'DELETE' });
await speakAt(0, true);
const left = await api('/cars');
check(!left.cars?.length, `a car was left behind: ${JSON.stringify(left)}`);

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Cards clean: a plate → the offer → the CAR card with the key line; Dad’s car kept and on his PERSON card and in GUARDIAN → PEOPLE; the gym → MAP; the stop word held the day; the dial changed the cap; the morning piece posted at its minute; Home’s wall in order, six at most, ALL SCREENS one tap.');
process.exit(problems.length ? 1 : 0);
