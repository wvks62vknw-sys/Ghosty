// A MEMORY THAT KEEPS YOUR WORD (NEXT ROUND, MEMORY lane), at 440 × 956 and 390 × 844, and at BODY 21:
//  (a) "the spare key is in the blue tin" is kept on the phone and the brain; "where's the spare key?" answers with no signal;
//  (b) "I'll send Jo the photos tomorrow", said to the brain, is caught as his promise; "what did I say I'd do?" lists it with DONE;
//  (c) "I picked the canal flat because it's quieter"; "why did I pick the canal flat?" gives his reason back;
//  (d) "what did I never get an answer to?" lists the question whose answer was "I couldn't find…", with ASK AGAIN;
//  (e) "what did I do yesterday?" rebuilds the day from his own turns; "what did I ask last week about trains?" keeps to last week;
//  (f) MEMORY → YOUR WORD shows the promise, the place, the reason and the week; every key 44 pt, nothing sideways, nothing cut at BODY 21;
//  (g) "how was my week?" says the week in a line or two.
// Dates are anchored to London's day (CI runs at any hour).
//   node tests/keepword.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { openSection, PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const PHONE2 = { width: 390, height: 844 };
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];
const check = (ok, msg) => ok || problems.push(msg);
const log = (m) => console.log(`keepword: ${m}`);

const DAY = 86_400_000;
// London's day, at noon (a moment safely inside it whatever the hour of the run)
const londonNoon = (() => {
  const d = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
  return Date.parse(`${d}T12:00:00Z`);
})();
const yesterday = londonNoon - DAY;
const dow = (new Date(londonNoon).getUTCDay() + 6) % 7; // Monday 0
const lastWeekWed = londonNoon - (dow + 5) * DAY;
const now = Date.now();
const TURNS = [
  { at: now - 3 * 3600_000 > londonNoon - 12 * 3600_000 ? now - 3 * 3600_000 : now - 60_000 * 30, q: 'how do I fix a squeaky door?', a: 'I couldn’t find anything useful on that.' },
  { at: yesterday, q: "what's the best paint for a fence", a: 'An oil-based wood stain lasts longest.' },
  { at: lastWeekWed, q: 'are there trains to York on Saturday', a: 'Yes, every half hour from New Street.' },
  { at: lastWeekWed - 14 * DAY, q: 'trains to Bristol next month', a: 'From £24 if you book ahead.' },
  { at: yesterday - 3 * 3600_000, q: 'why is my Octopus Energy bill so high this month', a: 'It is 12% up on the same month last year.' },
  { at: yesterday - 5 * 3600_000, q: 'the hedge at the back has grown over the footpath again', a: 'The council can ask the owner to cut it back.' },
];
// (j) a bill on his HOME screen, from the same supplier as one of his questions
const H = { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' };
const pk = (pack, action, args = {}) => fetch(`${base}/api/packs/do`, { method: 'POST', headers: H, body: JSON.stringify({ pack, action, args }) }).then((r) => r.json()).catch(() => ({}));
{
  const had = (await pk('homeadmin', 'bills', {})).data?.bills ?? [];
  await Promise.all(had.filter((b) => /octopus/i.test(b.supplier ?? '')).map((b) => pk('homeadmin', 'paid', { id: b.id, remove: true })));
  const due = new Date(Date.now() + 9 * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  await pk('homeadmin', 'bill', { text: `Octopus Energy\nElectricity bill\nAmount due £84.20\nPay by ${due}` });
  // (the bills page draws once a statement is kept: one line of one, if none is kept yet)
  const kept = await fetch(`${base}/api/profile/spending`, { headers: H }).then((r) => r.json()).catch(() => ({}));
  if (!kept?.kept) {
    const ym = new Date().toISOString().slice(0, 7);
    await fetch(`${base}/api/profile/spending/import`, { method: 'POST', headers: H, body: JSON.stringify({ csv: `Date,Description,Amount\n${ym}-01,TESCO STORES,-12.40\n`, rulesOnly: true }) }).catch(() => undefined);
  }
}

const fit = (page, sel) =>
  page.evaluate((sel) => {
    const small = [...document.querySelectorAll(`${sel} button, ${sel} summary`)].filter((b) => {
      const r = b.getBoundingClientRect();
      return r.width && r.height && (r.width < 43.5 || r.height < 43.5) && getComputedStyle(b).visibility !== 'hidden' && !b.closest('[hidden]');
    }).map((b) => `"${(b.textContent ?? '').trim().slice(0, 20)}" ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`);
    const cut = [...document.querySelectorAll(`${sel} b, ${sel} small, ${sel} p, ${sel} button`)].filter((e) => e.getClientRects().length && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible').map((e) => (e.textContent ?? '').slice(0, 30));
    return { small: small.slice(0, 5), sideways: document.documentElement.scrollWidth > innerWidth + 1, cut: cut.slice(0, 5) };
  }, sel);

async function run(vp, body) {
  const T = `[${vp.width}${body ? ` body ${body}` : ''}]`;
  const ctx = await browser.newContext({ viewport: vp, ...UK, reducedMotion: 'reduce' });
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`${T} pageerror: ${e.message}`));
  await page.addInitScript(({ key, turns, body }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, favourites: [], look: { ground: 'graphite', world: 'scan', night: 'graphite', switches: body ? { body } : {} }, home: { name: 'London', lat: 51.5, lon: -0.12 } }));
    if (!localStorage.getItem('ghosty.keep.seeded')) {
      localStorage.setItem('ghosty.keep.seeded', '1');
      localStorage.setItem('ghosty.chat', JSON.stringify({ entries: turns.flatMap((t) => [{ kind: 'user', text: t.q, at: t.at }, { kind: 'assistant', text: t.a, at: t.at + 4000 }]) }));
      // (l) a letter he read with the Lens yesterday
      localStorage.setItem('ghosty.lens.read', JSON.stringify([{ at: Date.now() - 86_400_000, text: 'PENALTY CHARGE NOTICE. Westshire Council. A penalty charge of £70 is now payable for parking in a restricted zone on Mill Lane. Pay within 14 days and it is reduced to £35.' }]));
      // (k) a letter of his
      localStorage.setItem('ghosty.docs', JSON.stringify([{ id: 'doc-council', title: 'Letter to the council', kind: 'letter', at: Date.now() - 86_400_000, blocks: [{ id: 'b1', t: 'p', runs: [{ text: 'Dear Sir or Madam,' }] }, { id: 'b2', t: 'p', runs: [{ text: 'I am writing about the path behind my house.' }] }] }]));
      // (i) a workbook of his, its match four rows down
      localStorage.setItem('ghosty.sheets', JSON.stringify([{ id: 'bk-bills', title: 'House bills', at: Date.now() - 86_400_000, sheets: [{ name: 'Sheet1', cells: { A1: { v: 'Item' }, B1: { v: 'Cost' }, A2: { v: 'Council tax' }, B2: { v: 160 }, A3: { v: 'Water' }, B3: { v: 38 }, A4: { v: 'Boiler service' }, B4: { v: 95 } }, widths: {}, heights: {}, frozen: false }], names: {}, charts: [], view: { sheet: 0, sel: 'A1' } }]));
    }
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, turns: TURNS, body });
  // the brain holds the same turns (the log is read back from it when Ghosty opens)
  await page.goto(`${base}/api/health`).catch(() => undefined);
  await page.evaluate(async ({ key, turns }) => {
    const hd = { 'x-ghosty': '1', 'x-ghosty-key': key, 'content-type': 'application/json' };
    await fetch('/api/history', { method: 'DELETE', headers: hd }).catch(() => undefined);
    await fetch('/api/history', { method: 'POST', headers: hd, body: JSON.stringify({ turns: turns.flatMap((t) => [{ role: 'user', text: t.q, at: t.at }, { role: 'assistant', text: t.a, at: t.at + 4000 }]) }) }).catch(() => undefined);
  }, { key: KEY, turns: TURNS });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.waitForFunction(() => window.__ghosty?.recall?.state === 'warm' && window.__ghosty.recall.items >= 4, null, { timeout: 20000 }).catch(() => problems.push(`${T} the recall index never built`));

  /** His words to the chat; the first reply after his own message (found by its time) that matches. */
  const ask = async (words, re = /\S/, ms = 20000) => {
    await page.evaluate(() => (location.hash = 'core'));
    const t0 = await page.evaluate(() => Date.now());
    await page.evaluate((w) => window.__ghosty.send(w), words);
    const find = ({ t0, src, flags, any }) => {
      const rx = new RegExp(src, flags);
      const msgs = [...document.querySelectorAll('#pg-core .msg')];
      const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0 - 50).lastIndexOf(true);
      if (mine < 0) return null;
      const replies = msgs.slice(mine + 1).filter((m) => !m.classList.contains('me'));
      const r = any ? replies.at(-1) : replies.find((m) => rx.test(m.textContent ?? ''));
      return r ? (r.textContent ?? '').replace(/\s+/g, ' ') : null;
    };
    const arg = { t0, src: re.source, flags: re.flags, any: false };
    const got = await page.waitForFunction(find, arg, { timeout: ms }).then((h) => h.jsonValue(), () => null);
    return got ?? `(no match) ${(await page.evaluate(find, { ...arg, any: true }).catch(() => '')) ?? ''}`.slice(0, 220);
  };

  if (!body) {
    // (a) where he put it, kept here and on the brain; asked with no signal
    const kept = await ask('the spare key is in the blue tin', /Got it: the spare key is in the blue tin/);
    check(/Got it: the spare key is in the blue tin\. Ask me “where’s the spare key\?” any time, even offline\./.test(kept), `${T} [a] said "${kept}"`);
    await ctx.setOffline(true);
    const where = await ask("where's the spare key?", /You told me the spare key is in the blue tin/);
    check(/You told me the spare key is in the blue tin \(/.test(where), `${T} [a offline] said "${where}"`);
    await ctx.setOffline(false);

    // (b) a promise said to the brain, then listed with DONE
    await ask("I'll send Jo the photos tomorrow");
    const list = await ask("what did I say I'd do?", /You said you’d .*send Jo the photos \(tomorrow\)/);
    check(/send Jo the photos \(tomorrow\)/.test(list), `${T} [b] said "${list}"`);
    const done = page.locator('#pg-core .keepcard .recallrow[data-kind="promise"]').filter({ hasText: 'send Jo the photos' }).last().locator('button');
    // (on a phone the log is folded under Home: opened, as a tap on it does)
    await page.evaluate(() => document.querySelector('#pg-core .hud.core')?.classList.add('logopen'));
    if (await done.count()) {
      await done.scrollIntoViewIfNeeded().catch(() => undefined);
      const box = await done.boundingBox();
      check(box && box.height >= 43.5 && box.width >= 43.5, `${T} [b] DONE is ${box?.width}×${box?.height}`);
      await done.click();
      const ticked = await page.waitForFunction(() => [...document.querySelectorAll('#pg-core .keepcard .recallrow.kept')].some((r) => /send Jo the photos/.test(r.textContent ?? '')), null, { timeout: 8000 }).then(() => true, () => false);
      check(ticked, `${T} [b] DONE did not tick the promise off`);
    } else check(false, `${T} [b] no DONE key under the list`);

    // (c) why he chose
    await ask("I picked the canal flat because it's quieter");
    const why = await ask('why did I pick the canal flat?', /You chose the canal flat because it(?:'|’)s quieter/);
    check(/You chose the canal flat because it(?:'|’)s quieter/.test(why), `${T} [c] said "${why}"`);

    // (d) the question that never got a real answer
    const open = await ask('what did I never get an answer to?', /never got a real answer/);
    check(/never got a real answer: .*“how do I fix a squeaky door\?”/.test(open), `${T} [d] said "${open}"`);
    check(await page.locator('#pg-core .localgo', { hasText: /^Ask again: how do I fix a squeaky/ }).count() > 0, `${T} [d] no ASK AGAIN key`);

    // (e) the day rebuilt, and recall kept to last week
    const day = await ask('what did I do yesterday?', /Yesterday: /);
    check(/^.*Yesterday: .*you asked “what's the best paint for a fence/.test(day) && !/York|Bristol|squeaky/.test(day.split('FORGET')[0]), `${T} [e day] said "${day}"`);
    const dated = await ask('what did I ask last week about trains?', /about “trains”/);
    check(/York/.test(dated) && !/Bristol/.test(dated), `${T} [e last week] said "${dated}"`);

    // (g) the week
    const week = await ask('how was my week?', /this week|quiet week/);
    check(/You asked me \d+ things? this week|A quiet week/.test(week), `${T} [g] said "${week}"`);
  }

  // (h) the Brief's email line: CHASE on a mail that needs an answer sets the chase in one tap; a chase due today shows as its own line
  if (!body) {
    const json = (route, data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    await page.route(/\/api\/email\/status$/, (r) => json(r, { linked: true, address: 'tony@example.com', server: 'imap.example.com' }));
    await page.route(/\/api\/guardian\/mail\/inbox$/, (r) => json(r, { linked: true, address: 'tony@example.com', messages: [{ uid: 41, from: 'Sam Jones <sam@example.com>', name: 'Sam Jones', address: 'sam@example.com', subject: 'Can you do Thursday?', date: '' }] }));
    let chaseBody = null;
    await page.route(/\/api\/guardian\/watchers$/, (r) => {
      if (r.request().method() === 'POST') {
        chaseBody = r.request().postDataJSON();
        return json(r, { watcher: { id: 'c1', kind: 'reply', url: '', label: 'Chase Sam: Can you do Thursday?', created: Date.now(), checked: Date.now(), ok: true, state: 'watching', who: 'Sam', by: Date.now() + 2 * DAY, mail: true }, said: "If nothing comes from Sam by Thursday 9 am, I'll remind you to chase it." });
      }
      return json(r, { watchers: [{ id: 'c0', kind: 'reply', url: '', label: 'Chase Ann', created: Date.now() - DAY, checked: Date.now(), ok: true, state: 'watching', who: 'Ann', about: 'the invoice', by: Date.now() + 60_000, mail: true }], max: 8 });
    });
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(250);
    await page.evaluate(() => (location.hash = 'brief'));
    const rowUp = await page.waitForFunction(() => !!document.querySelector('#pg-brief .bremail .bremrow .bremchasekey'), null, { timeout: 20000 }).then(() => true, () => false);
    check(rowUp, `${T} [h] no CHASE key on the Brief's email row`);
    const due = await page.evaluate(() => document.querySelector('#pg-brief .bremail .bremchase')?.textContent ?? '');
    check(/Chasing today: Ann \(the invoice\)\./.test(due), `${T} [h] the chases due today read "${due}"`);
    if (rowUp) {
      const key = page.locator('#pg-brief .bremail .bremchasekey').first();
      await key.scrollIntoViewIfNeeded().catch(() => undefined);
      const box = await key.boundingBox();
      check(box && box.height >= 43.5 && box.width >= 43.5, `${T} [h] CHASE is ${box?.width}×${box?.height}`);
      await key.click();
      const set = await page.waitForFunction(() => document.querySelector('#pg-brief .bremail .bremchasekey')?.textContent === 'CHASING', null, { timeout: 8000 }).then(() => true, () => false);
      check(set && chaseBody?.kind === 'reply' && chaseBody.who === 'Sam' && chaseBody.from === 'sam@example.com' && chaseBody.about === 'Can you do Thursday?' && /^(monday|tuesday|wednesday|thursday|friday)$/.test(chaseBody.day), `${T} [h] CHASE set ${JSON.stringify(chaseBody)}`);
    }
    await page.unroute(/\/api\/email\/status$/);
    await page.unroute(/\/api\/guardian\/mail\/inbox$/);
    await page.unroute(/\/api\/guardian\/watchers$/);
  }

  // (i) FIND lands on the cell (memory.u9): MEMORY's search for "boiler service" finds the workbook's row; a tap opens it at A4
  if (!body) {
    await page.evaluate(() => (location.hash = 'memory'));
    await page.waitForSelector('#pg-memory', { state: 'attached', timeout: 10000 });
    await openSection(page, 'memory', 'Timeline');
    const box = page.locator('#pg-memory input[type=search]').first();
    await box.fill('boiler service');
    const row = page.locator('#pg-memory .recallfind .recallrow[data-kind="sheet"] .recallgo').first();
    const seen = await row.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
    check(seen, `${T} [i] FIND did not find the workbook's row`);
    if (seen) {
      await row.click();
      const landed = await page.waitForFunction(() => window.__ghosty?.sheets?.view === 'book' && window.__ghosty.sheets.sel === 'A4', null, { timeout: 10000 }).then(() => true, () => false);
      check(landed, `${T} [i] the workbook did not open at A4: ${JSON.stringify(await page.evaluate(() => ({ view: window.__ghosty?.sheets?.view, sel: window.__ghosty?.sheets?.sel })))}`);
      await page.keyboard.press('Escape').catch(() => undefined);
      await page.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 5000 }).catch(() => undefined);
    }
    await box.fill('');
  }

  // (j) a bill shows what he asked about it before (memory.c3), one tap from the exchange
  if (!body) {
    await page.evaluate(() => (location.hash = 'money'));
    await page.waitForSelector('#pg-money', { state: 'attached', timeout: 10000 });
    await openSection(page, 'money', 'Bills');
    const asked = page.locator('#pg-money .mndue[data-kind="bill"] .mnasked').first();
    const seen = await asked.waitFor({ state: 'visible', timeout: 12000 }).then(() => true, () => false);
    check(seen && /^You asked me about this yesterday ›$/.test((await asked.textContent()) ?? ''), `${T} [j] under the bill: "${seen ? await asked.textContent() : '(nothing)'}"`);
    if (seen) {
      const box = await asked.boundingBox();
      check(box && box.height >= 43.5, `${T} [j] the line is ${box?.height} pt high`);
      await asked.click();
      const shown = await page.waitForFunction(() => /You: why is my Octopus Energy bill so high/.test(document.querySelector('.modal .exchange')?.textContent ?? ''), null, { timeout: 6000 }).then(() => true, () => false);
      check(shown, `${T} [j] the tap did not show the exchange`);
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }

  // (k) his past words while he writes (memory.c1): in the letter, FROM WHAT YOU SAID finds the hedge, and PUT IT IN puts it in the letter
  if (!body) {
    await page.evaluate(() => (location.hash = 'memory'));
    await openSection(page, 'memory', 'Timeline');
    const box = page.locator('#pg-memory input[type=search]').first();
    await box.fill('path behind my house');
    const doc = page.locator('#pg-memory .recallfind .recallrow[data-kind="doc"] .recallgo').first();
    if (await doc.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) {
      await doc.click();
      const mineIn = page.locator('.dcminebox input').first();
      const up = await mineIn.waitFor({ state: 'attached', timeout: 10000 }).then(() => true, () => false);
      check(up, `${T} [k] the letter has no FROM WHAT YOU SAID`);
      if (up) {
        await mineIn.scrollIntoViewIfNeeded().catch(() => undefined);
        await mineIn.fill('the hedge');
        await page.locator('.dcminebox button', { hasText: 'SEARCH MY WORDS' }).click();
        const line = page.locator('.dcminebox .dcmine').filter({ hasText: 'grown over the footpath' }).first();
        const found = await line.waitFor({ state: 'visible', timeout: 6000 }).then(() => true, () => false);
        check(found, `${T} [k] FROM WHAT YOU SAID did not find the hedge: "${await page.evaluate(() => document.querySelector('.dcminebox')?.textContent ?? '')}"`);
        if (found) {
          const put = line.locator('button');
          const bx = await put.boundingBox();
          check(bx && bx.height >= 43.5 && bx.width >= 43.5, `${T} [k] PUT IT IN is ${bx?.width}×${bx?.height}`);
          await put.click();
          const inDoc = await page.waitForFunction(() => [...document.querySelectorAll('.dcpage .dcb')].some((b) => /grown over the footpath again/.test(b.textContent ?? '')), null, { timeout: 6000 }).then(() => true, () => false);
          check(inDoc, `${T} [k] PUT IT IN did not put the words in the letter`);
        }
      }
      await page.keyboard.press('Escape').catch(() => undefined);
      await page.waitForFunction(() => !document.querySelector('.modal'), null, { timeout: 5000 }).catch(() => undefined);
    } else check(false, `${T} [k] FIND did not find the letter`);
    await box.fill('');
  }

  // (l) the letter he photographed (memory.s1): FIND "parking fine" finds what the Lens read, and a tap shows it whole
  if (!body) {
    await page.evaluate(() => (location.hash = 'memory'));
    await openSection(page, 'memory', 'Timeline');
    const box = page.locator('#pg-memory input[type=search]').first();
    await box.fill('parking penalty charge');
    const row = page.locator('#pg-memory .recallfind .recallrow[data-kind="scan"] .recallgo').first();
    const seen = await row.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false);
    check(seen && /Read with the Lens/.test((await row.textContent()) ?? ''), `${T} [l] FIND did not find the letter the Lens read: "${await page.evaluate(() => document.querySelector('#pg-memory .recallfind')?.textContent?.slice(0, 200) ?? '')}"`);
    if (seen) {
      await row.click();
      const whole = await page.waitForFunction(() => /Mill Lane/.test(document.querySelector('.modal .exchange')?.textContent ?? '') && /the photo itself was not kept/.test(document.querySelector('.modal .exchange')?.textContent ?? ''), null, { timeout: 6000 }).then(() => true, () => false);
      check(whole, `${T} [l] the tap did not show what the Lens read`);
      await page.keyboard.press('Escape').catch(() => undefined);
    }
    await box.fill('');
  }

  // (f) MEMORY → YOUR WORD
  await page.evaluate(() => (location.hash = 'memory'));
  await page.waitForSelector('#pg-memory', { state: 'attached', timeout: 10000 });
  await openSection(page, 'memory', 'Your word');
  const shown = await page.waitForFunction(() => window.__ghosty?.keep?.state === 'shown' && /spare key/.test(document.querySelector('#pg-memory .pn.keep')?.textContent ?? ''), null, { timeout: 12000 }).then(() => true, () => false);
  const panelText = await page.evaluate(() => (document.querySelector('#pg-memory .pn.keep')?.textContent ?? '').replace(/\s+/g, ' '));
  check(shown, `${T} [f] YOUR WORD did not show: "${panelText.slice(0, 200)}"`);
  for (const [what, re] of [['the heading', /You said you’d/], ['the place', /The spare key in the blue tin/], ['the reason', /The canal flat: it(?:'|’)s quieter/], ['the week', /Your week/]]) check(re.test(panelText), `${T} [f] ${what} is not in YOUR WORD: "${panelText.slice(0, 260)}"`);
  check(/send Jo the photos/.test(panelText), `${T} [f] the promise is not in YOUR WORD (open or done)`);
  const f = await fit(page, '#pg-memory .pn.keep');
  check(!f.small.length, `${T} [f] under 44 pt: ${f.small.join(', ')}`);
  check(!f.sideways, `${T} [f] the page goes sideways`);
  check(!f.cut.length, `${T} [f] words cut: ${JSON.stringify(f.cut)}`);
  await page.screenshot({ path: `${out}/keepword-${vp.width}${body ? '-b' : ''}.png` }).catch(() => undefined);
  await ctx.close();
}

for (const vp of [PHONE, PHONE2]) await run(vp, 0);
await run(PHONE2, 21);

// (m) YOUR WORD in all seven looks at 390: drawn, every key 44 pt, nothing sideways, no word cut
for (const world of ['scan', 'map', 'eye', 'orbit', 'grown', 'ink', 'glass']) {
  const T = `[390 ${world}]`;
  const ctx = await browser.newContext({ viewport: PHONE2, ...UK, reducedMotion: 'reduce' });
  await ctx.route(/^https:\/\/(?!localhost)/, (route) => route.fulfill({ status: 404, body: '' }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`${T} pageerror: ${e.message}`));
  await page.addInitScript(({ key, world }) => {
    localStorage.setItem('ghosty.ownerKey', key);
    localStorage.setItem('ghosty.settings', JSON.stringify({ name: 'Tony', speak: false, sounds: false, favourites: [], look: { ground: 'graphite', world, night: 'graphite', switches: {} }, home: { name: 'London', lat: 51.5, lon: -0.12 } }));
    window.__ghostyHero = true;
    window.__ghostyPlace = { none: true };
  }, { key: KEY, world });
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 60000 });
  await page.evaluate(() => (location.hash = 'memory'));
  await page.waitForSelector('#pg-memory', { state: 'attached', timeout: 10000 });
  await openSection(page, 'memory', 'Your word');
  const shown = await page.waitForFunction(() => window.__ghosty?.keep?.state === 'shown', null, { timeout: 12000 }).then(() => true, () => false);
  check(shown, `${T} [m] YOUR WORD did not show`);
  const f = await fit(page, '#pg-memory .pn.keep');
  check(!f.small.length, `${T} [m] under 44 pt: ${f.small.join(', ')}`);
  check(!f.sideways, `${T} [m] the page goes sideways`);
  check(!f.cut.length, `${T} [m] words cut: ${JSON.stringify(f.cut)}`);
  await ctx.close();
}

await browser.close();
if (problems.length) {
  console.log(`keepword spec: ${problems.length} problem(s)`);
  for (const p of problems) console.log(`  - ${p}`);
  process.exit(1);
}
console.log('keepword spec: all good');
