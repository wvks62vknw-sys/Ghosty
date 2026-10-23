// LINKS → NOTIFICATIONS in a real browser: a switch per kind that something sends today (reminders,
// flashcards due, upgrade ideas), kept by the brain (it checks them before every push) and still set
// after a reload; each switch drawn once even when paints overlap; a kind switched off gives no alert
// in the app either (the inbox item comes marked quiet); SEND A TEST; and on an iPhone in a Safari
// tab (not opened from the Home Screen) the plain sentence saying notifications need the Home Screen.
//   BASE=http://localhost:8852 node tests/notifications.spec.mjs [outDir]
//   (the iPhone part runs in WebKit when PLAYWRIGHT_BROWSERS_PATH has it: /tmp/claude-0/wk/browsers)
import { chromium, webkit } from 'playwright';
import { openPanel } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const HOME_ONLY = 'iPhone only allows notifications for apps on your Home Screen: Share → Add to Home Screen, then open Ghosty from there.';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

async function open(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'links'));
  await openPanel(page, 'links', 'NOTIFICATIONS');
  await page.waitForSelector('#pg-links button[data-kind]', { timeout: 15000 });
  return { ctx, page };
}
const prefs = (page) => page.evaluate(async (key) => (await (await fetch('/api/push/prefs', { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } })).json()).prefs, KEY);

// ---- the switches (Chromium, a computer: no Home Screen sentence)
const chrome = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined });
{
  const { page } = await open(chrome);
  const kinds = await page.$$eval('#pg-links button[data-kind]', (bs) => bs.map((b) => `${b.dataset.kind}:${b.textContent}`));
  check(JSON.stringify(kinds) === JSON.stringify(['reminders:ON', 'flashcards:ON', 'upgrades:ON']), `switches: ${kinds.join(', ')}`);
  const labels = await page.$$eval('#pg-links .rw', (rs) => rs.map((r) => r.querySelector('.k')?.textContent ?? ''));
  for (const l of ['REMINDERS', 'FLASHCARDS DUE', 'UPGRADE IDEAS']) check(labels.includes(l), `no ${l} switch`);
  for (const l of ['MORNING BRIEF', '3D MODEL READY', 'PRICE DROPS']) check(!labels.includes(l), `${l} is shown but nothing sends it`);
  check(/no Telegram message, no alert or voice in the app/.test((await page.textContent('#pg-links .notifyscope').catch(() => '')) ?? ''), 'the panel does not say what OFF stops');
  check(!(await page.$('#pg-links .homeonly')), 'Home Screen sentence shown on a computer');
  await page.click('#pg-links button[data-kind="reminders"]');
  await page.waitForFunction(() => document.querySelector('#pg-links button[data-kind="reminders"]')?.textContent === 'OFF', null, { timeout: 8000 }).catch(() => problems.push('REMINDERS did not switch off'));
  await page.click('#pg-links button[data-kind="upgrades"]');
  await page.waitForFunction(() => document.querySelector('#pg-links button[data-kind="upgrades"]')?.textContent === 'OFF', null, { timeout: 8000 }).catch(() => problems.push('UPGRADE IDEAS did not switch off'));
  const p = await prefs(page);
  check(p.reminders === false && p.upgrades === false && p.flashcards === true, `the brain did not keep the choices: ${JSON.stringify(p)}`);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await openPanel(page, 'links', 'NOTIFICATIONS');
  await page.waitForSelector('#pg-links button[data-kind="reminders"]', { timeout: 20000 });
  check((await page.textContent('#pg-links button[data-kind="reminders"]')) === 'OFF', 'REMINDERS came back ON after a reload');
  check(!!(await page.$('#pg-links button:has-text("SEND A TEST")')), 'no SEND A TEST');
  await page.click('#pg-links button:has-text("SEND A TEST")');
  await page.waitForSelector('#toasts :text("No device has notifications on yet")', { timeout: 8000 }).catch(() => problems.push('SEND A TEST gave no answer'));
  await page.locator('#pg-links section.pn:has(button[data-kind])').screenshot({ path: `${out}/notifications.png` });
  // put them back for other specs
  await page.click('#pg-links button[data-kind="reminders"]');
  await page.click('#pg-links button[data-kind="upgrades"]');
  await page.waitForTimeout(800);
}

// ---- paints that overlap: Ghosty starts on LINKS, so the tab paints while the phone's notification state is
// still being found out (each change paints again) and the brain answers slowly — each switch is drawn once.
{
  const ctx = await chrome.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript((key) => localStorage.setItem('ghosty.ownerKey', key), KEY);
  await ctx.route('**/api/push/prefs', async (r) => {
    if (r.request().method() !== 'GET') return r.continue();
    await new Promise((ok) => setTimeout(ok, 1500));
    return r.continue();
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto(`${base}/#links`, { waitUntil: 'domcontentloaded' });
  await openPanel(page, 'links', 'NOTIFICATIONS');
  await page.waitForSelector('#pg-links button[data-kind]', { timeout: 20000 }).catch(() => problems.push('LINKS opened at start-up showed no switches'));
  await page.waitForTimeout(3000);
  const drawn = await page.$$eval('#pg-links button[data-kind]', (bs) => bs.map((b) => b.dataset.kind));
  check(drawn.length > 0 && new Set(drawn).size === drawn.length, `switches drawn more than once: ${drawn.join(', ')}`);
  await ctx.close();
}

// ---- a kind switched off: no toast or voice in the app (the brain marks its inbox item quiet)
{
  const ctx = await chrome.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  const now = Date.now();
  await page.route('**/api/inbox', (r) =>
    r.request().method() !== 'GET'
      ? r.continue()
      : r.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            unread: 2,
            items: [
              { id: 'q1', at: now - 5000, kind: 'reminder', title: 'QUIETMARK', text: 'QUIETMARK water the plants', pushKind: 'reminders', quiet: true },
              { id: 'l1', at: now - 4000, kind: 'task', title: 'Write a design brief · done', text: 'LOUDMARK the brief is ready' },
            ],
          }),
        }),
  );
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('#toasts :text("LOUDMARK")', { timeout: 10000 }).catch(() => problems.push('an ordinary inbox item gave no alert'));
  await page.waitForTimeout(500);
  check(!(await page.$('#toasts :text("QUIETMARK")')), 'an item whose kind is switched off still popped up in the app');
  await ctx.close();
}
// ---- fixes A2: toasts never pile up over the screen. Four long project notifications (and one of them twice)
// arrive at once: at most two are on screen, each cut at three lines, the same one twice shows once, they keep
// off the chat bar and the tab bar (the composer stays usable), a tap on a long one opens all of its words, and
// the box still announces them (aria-live). At the specs' 390 × 844 and the owner's 440 × 956.
for (const [w, hgt] of [[390, 844], [440, 956]]) {
  const tag = `[toasts ${w}]`;
  const ctx = await chrome.newContext({ viewport: { width: w, height: hgt } });
  await ctx.addInitScript((key) => {
    localStorage.setItem('ghosty.ownerKey', key);
    // every toast ever put up (seen as it is added, before any is taken away), and the most on screen at once
    window.__a2 = { made: [], most: 0 };
    const append = Element.prototype.append;
    Element.prototype.append = function (...nodes) {
      if (this.id === 'toasts') for (const n of nodes) if (n.classList?.contains('toast')) window.__a2.made.push(n.textContent);
      return append.apply(this, nodes);
    };
    new MutationObserver(() => {
      const box = document.getElementById('toasts');
      if (box) window.__a2.most = Math.max(window.__a2.most, box.querySelectorAll('.toast:not(.out)').length);
    }).observe(document, { childList: true, subtree: true });
  }, KEY);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${tag} pageerror: ${e.message}`));
  const now = Date.now();
  const long = (n) => `PILEMARK${n} All 3 steps are done: the weekend site has a home page, a gallery and a contact form, each checked on a phone and on a computer. ${'It is published at the address in the report, with a short note on what to change next and what each page costs to keep running. '.repeat(3)}ENDMARK${n}`;
  const items = [1, 2, 3, 4].map((n) => ({ id: `p${n}`, at: now - 9000 + n * 1000, kind: 'task', title: `weekend site ${n} · done`, text: long(n) }));
  items.push({ ...items[0], id: 'p1again', at: now - 3000 });
  await page.route('**/api/inbox', (r) => (r.request().method() !== 'GET' ? r.continue() : r.fulfill({ contentType: 'application/json', body: JSON.stringify({ unread: items.length, items: [...items].reverse() }) })));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.waitForSelector('#toasts .toast', { timeout: 10000 }).catch(() => problems.push(`${tag} no toast for the project notifications`));
  await page.waitForTimeout(300);
  const seen = await page.evaluate(() => window.__a2);
  check(seen.most <= 2, `${tag} ${seen.most} toasts on screen at once (at most two)`);
  check(seen.made.filter((t) => t.includes('PILEMARK1')).length === 1, `${tag} the same notification twice within a minute popped up ${seen.made.filter((t) => t.includes('PILEMARK1')).length} times`);
  check(seen.made.filter((t) => t.includes('PILEMARK')).length === 4, `${tag} expected the 4 different notifications to pop up once each, got ${seen.made.length}`);
  check((await page.getAttribute('#toasts', 'aria-live')) === 'polite', `${tag} the toasts are no longer announced (aria-live)`);
  const m = await page.evaluate(() => {
    const box = (s) => document.querySelector(s)?.getBoundingClientRect();
    const toasts = [...document.querySelectorAll('#toasts .toast:not(.out)')].map((t) => {
      const span = t.querySelector('span');
      // one line of the same text style, measured with a one-word copy
      const one = t.cloneNode(true);
      const s1 = one.querySelector('span');
      s1.textContent = 'x';
      if (s1.dataset.label) s1.dataset.label = 'x';
      one.style.position = 'absolute';
      one.style.visibility = 'hidden';
      t.parentElement.append(one);
      const line = s1.getBoundingClientRect().height;
      one.remove();
      const r = t.getBoundingClientRect();
      return { lines: span.getBoundingClientRect().height / line, chars: span.textContent.length, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    });
    const bar = box('#cbar');
    const tabs = box('#dock .tabcap') ?? box('#dock');
    return { toasts, bar: bar && { top: bar.top, bottom: bar.bottom }, tabs: tabs && { top: tabs.top } };
  });
  check(m.toasts.length > 0 && m.toasts.length <= 2, `${tag} ${m.toasts.length} toasts visible`);
  for (const [i, t] of m.toasts.entries()) {
    check(t.lines <= 3.2, `${tag} toast ${i + 1} is ${t.lines.toFixed(1)} lines tall (at most 3)`);
    check(t.chars > 200, `${tag} toast ${i + 1} is not a long one (${t.chars} characters): the test proves nothing`);
    if (m.bar) check(t.bottom <= m.bar.top + 1 || t.top >= m.bar.bottom - 1, `${tag} toast ${i + 1} covers the chat bar`);
    if (m.tabs) check(t.bottom <= m.tabs.top + 1, `${tag} toast ${i + 1} covers the tab bar`);
    check(t.left >= 0 && t.right <= w, `${tag} toast ${i + 1} runs off the side`);
  }
  // the composer stays usable with the toasts up
  const typed = await page.fill('#cin', 'still typing', { timeout: 3000 }).then(() => page.inputValue('#cin')).catch((e) => `blocked: ${e.message.split('\n')[0]}`);
  check(typed === 'still typing', `${tag} the chat box could not be used with toasts up (${typed})`);
  await page.fill('#cin', '').catch(() => undefined);
  await page.screenshot({ path: `${out}/a2-toasts-${w}.png` });
  // a tap on a long one opens all of it
  await page.locator('#toasts .toast:not(.out)').last().click({ timeout: 3000 }).catch((e) => problems.push(`${tag} a long toast cannot be tapped: ${e.message.split('\n')[0]}`));
  const sheet = await page.waitForSelector('.modal .mbody', { timeout: 3000 }).then((el) => el.textContent()).catch(() => '');
  check(/ENDMARK4/.test(sheet ?? ''), `${tag} tapping a long toast did not open its whole text`);
  await page.screenshot({ path: `${out}/a2-toast-opened-${w}.png` });
  await ctx.close();
}
await chrome.close();

// ---- an iPhone in a Safari tab (WebKit, iPhone user agent, not opened from the Home Screen)
let wk = null;
try {
  wk = await webkit.launch();
} catch {
  console.log('(WebKit not installed here: iPhone part skipped)');
}
if (wk) {
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
  const { page } = await open(wk, { userAgent: ua });
  await openPanel(page, 'links', 'NOTIFICATIONS');
  await page.waitForSelector('#pg-links .homeonly', { timeout: 8000 }).catch(() => problems.push('no Home Screen sentence on an iPhone in a Safari tab'));
  check((await page.textContent('#pg-links .homeonly').catch(() => '')) === HOME_ONLY, 'the Home Screen sentence is not word for word');
  check((await page.$$('#pg-links button[data-kind]')).length === 3, 'the switches are missing on the iPhone');
  await page.locator('#pg-links section.pn:has(button[data-kind])').screenshot({ path: `${out}/notifications-iphone.png` });
  await wk.close();
}

console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Notifications run clean: three switches kept by the brain, drawn once, quiet items give no alert, SEND A TEST, toasts kept to two short ones that open in full, Home Screen sentence on iPhone.');
process.exit(problems.length ? 1 : 0);
