// The REVERSE tab (features/reverse/index.ts) on the owner's iPhone 18 Pro Max (440 × 956), at 390 × 844 and once at
// 1280 × 800. The brain's job list is stood in (a finished report, one running, one that failed); the brain itself
// answers what it can with nothing kept: the status (GitHub not connected on the preview), START without GitHub (it
// refuses before anything is made) and SAVE TO LIBRARY (the document it files is removed again at the end).
//  - the top says what Reverse is for in his words, the same words as the Make hub's card; no developer jargon;
//  - what the box reads as is said while he types ("kettle" is a code package on npm; a real thing is for the chat);
//  - GitHub not connected is said before he types, with the way to connect it; a refusal stays on screen in a sentence;
//  - START shows the new report waiting in place: when it should be ready and that he can leave;
//  - each report a row in plain words (Website, Ready, Didn't finish), 44 pt tall;
//  - a tap on a report brings it on screen (it used to open out of sight under the form);
//  - the report readable on a phone: dates in his words, no raw markdown marks, no "(Ghosty baseline)", the raw
//    data folded away, 15 px text, names as written (example.com, GitHub);
//  - a report that did not finish says so and offers TRY AGAIN, which asks for the same thing again;
//  - SAVE TO LIBRARY saves it there and then, staying on the tab, no chat round trip;
//  - offline: said in words, START does not pretend;
//  - the Make hub's card agrees with the tab; every target 44 pt; nothing sideways at 440 and 390.
import { launch } from './browser.mjs';
import { PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const H = { 'x-ghosty': '1', 'x-ghosty-key': KEY };
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

// ---- the stand-in job list (its own names: nothing else on the preview is read or changed) ----
const REPORT = [
  '# Reverse engineering report', '',
  '**Target:** https://example.com  ', '**Kind:** web  ', '**Started:** 2026-10-25T01:00:00.000Z  ', '**Question:** what is it built with', '',
  '## Site overview (Ghosty baseline)', '',
  '- **Title:** Example Domain', '- **Technologies spotted:** Cloudflare, Google Analytics', '- **Third-party hosts:** www.googletagmanager.com',
  '', '**Security headers:**', '- content-security-policy: ✗ missing', '- strict-transport-security: ✓ max-age=31536000', '',
  '## REA · web page', '', '```json', JSON.stringify({ ok: true, title: 'Example Domain', scripts: [{ src: `https://www.googletagmanager.com/gtag/js?id=G-${'X'.repeat(120)}` }] }), '```', '',
  '> rea bundle: failed to fetch the bundle · exit 1', '', '---',
  '_Finished 2026-10-25T01:05:00.000Z · 1 problem(s) · REA by morluto (MIT) · for lawful research only_', '',
].join('\n');
const now = Date.now();
const JOBS = () => [
  { id: 'rspecrun', target: 'https://bbc.co.uk', kind: 'web', question: '', at: now - 2 * 60_000, status: 'running', runUrl: 'https://github.com/x/y/actions/runs/2' },
  { id: 'rspecdone', target: 'https://example.com', kind: 'web', question: 'what is it built with', at: now - 3_600_000, status: 'done', finishedAt: now - 3_300_000, reportChars: REPORT.length, runUrl: 'https://github.com/x/y/actions/runs/1' },
  { id: 'rspecfail', target: 'left-pad', kind: 'npm', question: 'is it safe', at: now - 86_400_000, status: 'failed', error: 'the run failure (see https://github.com/x/y/actions/runs/3)', finishedAt: now - 86_000_000 },
];
const saved = [];

async function open(viewport, { github = true } = {}) {
  const ctx = await browser.newContext({ viewport, ...UK, hasTouch: viewport.width < 900 });
  const page = await ctx.newPage();
  const st = { jobs: JOBS(), posts: [], chat: 0, offline: false, live: [] };
  page.on('pageerror', (e) => problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  // GitHub connected or not, as the brain's own status says it (the rest of the status is the preview's)
  await page.route('**/api/status', async (r) => {
    const res = await r.fetch().catch(() => null);
    if (!res) return r.abort();
    const j = await res.json().catch(() => ({}));
    return r.fulfill({ response: res, json: { ...j, repoReady: github } });
  });
  await page.route('**/api/reverse**', async (r) => {
    if (r.request().method() === 'DELETE') { st.deleted = (st.deleted ?? 0) + 1; return r.fulfill({ json: { removed: true } }); }
    if (st.offline) return r.abort('internetdisconnected');
    const req = r.request();
    const m = new URL(req.url()).pathname.match(/\/api\/reverse\/([\w-]+)$/);
    if (m) {
      const j = st.jobs.find((x) => x.id === m[1]);
      return j ? r.fulfill({ json: { job: { ...j, report: j.status === 'done' ? REPORT : undefined } } }) : r.fulfill({ status: 404, json: { error: 'no such job' } });
    }
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() ?? '{}');
      st.posts.push(body);
      // without GitHub the real brain answers (it refuses before it makes anything)
      if (!github) { st.live.push('POST /reverse'); return r.continue(); }
      const job = { id: `rspecnew${st.posts.length}`, target: /^https?:/.test(body.target) ? body.target : `https://${body.target}`, kind: 'web', question: body.question ?? '', at: Date.now(), status: 'queued' };
      st.jobs.unshift(job);
      return r.fulfill({ json: { job } });
    }
    return r.fulfill({ json: { jobs: st.jobs } });
  });
  // the chat is caught: Reverse should not need it to save a report
  await page.route('**/api/chat', (r) => { st.chat++; return r.abort(); });
  page.on('request', (q) => { if (q.method() === 'POST' && q.url().endsWith('/api/library/text')) saved.push(q.postData() ?? ''); });
  await page.goto(base);
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'reverse'));
  await page.waitForSelector('#pg-reverse .pn', { timeout: 10000 });
  await page.waitForTimeout(1200);
  return { ctx, page, st };
}
const text = (page, sel) => page.locator(sel).first().innerText().catch(() => '');
// a tap that, when it cannot happen, is a problem to report rather than the end of the spec
const tap = (loc, what) => loc.click({ timeout: 8000 }).then(() => true, () => (problems.push(`could not tap ${what}`), false));
const row = (page, name) => page.locator('#pg-reverse .rw.link', { hasText: name }).first();
const viewer = (page) => page.locator('#pg-reverse .cR .pn').first();
const sideways = (page, tag) => page.evaluate(() => ({ doc: document.documentElement.scrollWidth, vw: innerWidth, wide: [...document.querySelectorAll('#pg-reverse *')].filter((e) => e.offsetParent && e.getBoundingClientRect().right > innerWidth + 1 && !e.closest('details:not([open])')).slice(0, 4).map((e) => `${e.tagName}.${e.className}`) }))
  .then((s) => { if (s.doc > s.vw || s.wide.length) problems.push(`[${tag}] something goes sideways: page ${s.doc} wide on a ${s.vw} screen; ${s.wide.join(', ')}`); });
const smallTargets = (page, tag) => page.$$eval('#pg-reverse :is(button, select, input, summary, .rw.link)', (els) => els.filter((e) => e.offsetParent && !e.closest('[hidden]')).map((e) => { const r = e.getBoundingClientRect(); return { t: (e.innerText || e.getAttribute('aria-label') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((x) => x.h < 44 || x.w < 44))
  .then((l) => { if (l.length) problems.push(`[${tag}] targets under 44 pt: ${l.map((x) => `${x.t} ${x.w}×${x.h}`).join('; ')}`); });

// ---- 1. the phone, GitHub not connected (the preview's own brain) ----
{
  const { ctx, page, st } = await open(PHONE, { github: false });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/reverse-first-440.png` });
  const all = await text(page, '#pg-reverse');
  const big = (await text(page, '#pg-reverse .hero .bigv')).trim();
  if (!/^See how any app works$/i.test(big)) problems.push(`[440] the top does not say what Reverse is for in his words ("See how any app works", as the Make hub's card says): "${big}"`);
  for (const jargon of [/REA runs on/, /Ghidra/, /entry points/, /\.NET assemblies/, /web bundle/, /Work it out/]) if (jargon.test(all)) problems.push(`[440] developer jargon on the tab: ${jargon}`);
  if (!all.includes('Only analyse software you own or are allowed to test.')) problems.push('[440] the line about only analysing software he owns or may test is gone or reworded');
  const ph = await page.getAttribute('#pg-reverse input[aria-label="What to look at"]', 'placeholder').catch(() => null);
  if (!ph || ph.length > 32) problems.push(`[440] the box for the link has no short example he can read whole: "${ph}"`);
  // what the box reads as while he types, by the brain's own rules: a bare word is a code package, a real thing is not for Reverse
  for (const [typed, want] of [['kettle', /code package on npm: “kettle”/], ['a bicycle pump', /ask Ghosty in the chat/], ['bbc.co.uk', /Reads as a website: bbc\.co\.uk/]]) {
    await page.locator('#pg-reverse input').first().fill(typed);
    const r = (await text(page, '#pg-reverse .revreads')).trim();
    if (!want.test(r)) problems.push(`[440] typing "${typed}" does not say what it reads as (${want}): "${r}"`);
  }
  await page.locator('#pg-reverse input').first().fill('');
  // GitHub not connected: said up front, with the way to connect it
  const gh = await text(page, '#pg-reverse .revgh');
  if (!/GitHub/.test(gh) || !/connect/i.test(gh)) problems.push(`[440] GitHub not being connected is not said before he starts: "${gh}"`);
  if (!(await page.locator('#pg-reverse .revgh button').count())) problems.push('[440] no button to go and connect GitHub');
  // START anyway: the brain's refusal stays on screen, as a sentence
  await page.locator('#pg-reverse input').first().fill('bbc.co.uk');
  await tap(page.locator('#pg-reverse button', { hasText: /^start$/i }).first(), 'START');
  await page.waitForTimeout(5200);
  const said = (await text(page, '#pg-reverse .revsay')).trim();
  if (!/^[A-Z]/.test(said) || !/GitHub/.test(said)) problems.push(`[440] START without GitHub: the reason does not stay on screen as a sentence: "${said}"`);
  if (!st.live.length) problems.push('[440] START without GitHub never asked the brain');
  await ctx.close();
}

// ---- 2. the phone, GitHub connected (the job list stood in) ----
{
  const { ctx, page, st } = await open(PHONE);
  await page.waitForFunction(() => document.querySelectorAll('#pg-reverse .rw.link').length >= 3, null, { timeout: 10000 }).catch(() => problems.push('[440] the three reports never listed'));
  await page.screenshot({ path: `${out}/reverse-list-440.png` });
  if (await page.locator('#pg-reverse .revgh').isVisible().catch(() => false)) problems.push('[440] says GitHub is not connected when it is');
  // the rows in plain words
  const rows = await page.$$eval('#pg-reverse .rw.link', (rs) => rs.map((r) => ({ t: r.innerText.replace(/\s+/g, ' ').trim(), h: Math.round(r.getBoundingClientRect().height) })));
  const rt = rows.map((r) => r.t).join(' | ');
  if (!/Website/.test(rt) || /\bWeb\b|\bNpm\b/.test(rt)) problems.push(`[440] the rows say what each is in jargon ("Web", "Npm"), not "Website", "Code package": ${rt}`);
  if (!/example\.com[\s\S]*Ready/.test(rt)) problems.push(`[440] a finished report's row does not say "Ready": ${rt}`);
  if (!/left-pad[\s\S]*Didn.t finish/.test(rt)) problems.push(`[440] a failed report's row does not say "Didn't finish": ${rt}`);
  if (/\bREPORT\b|\bFAILED\b/.test(rt)) problems.push(`[440] the rows still shout REPORT / FAILED: ${rt}`);

  // REMOVE on a finished report: the row goes at once, the floating bar's UNDO brings it back, and the brain is told
  // only when the bar closes (so nothing was sent here)
  {
    const r = row(page, 'left-pad');
    await r.locator('button.revremove').click().catch(() => problems.push('[440] no REMOVE on a failed report\'s row'));
    await page.waitForTimeout(300);
    if (await r.isVisible().catch(() => true)) problems.push('[440] REMOVE did not take the row off the list at once');
    const bar = page.locator('.undo.rcundo:not([hidden])');
    if (!/Removed left-pad/.test((await bar.innerText().catch(() => '')))) problems.push(`[440] the UNDO bar does not say what went: "${await bar.innerText().catch(() => '')}"`);
    await bar.locator('button', { hasText: 'UNDO' }).click().catch(() => problems.push('[440] no UNDO on the bar'));
    await page.waitForTimeout(300);
    if (!(await r.isVisible().catch(() => false))) problems.push('[440] UNDO did not bring the row back');
    if (st.deleted) problems.push(`[440] REMOVE told the brain before the UNDO bar closed (${st.deleted} DELETE)`);
  }

  // a tap on the finished one brings the report on screen
  await tap(row(page, 'example.com'), 'the example.com report');
  await page.waitForTimeout(1200);
  const top = await viewer(page).evaluate((e) => e.getBoundingClientRect().top).catch(() => 9999);
  if (!(top >= 0 && top < PHONE.height / 2)) problems.push(`[440] tapping a report opens it out of sight (its top at ${Math.round(top)} px on a ${PHONE.height} px screen)`);
  await page.screenshot({ path: `${out}/reverse-report-440.png` });
  const rep = await text(page, '#pg-reverse .cR .pn');
  if (/\d{4}-\d\d-\d\dT\d\d:\d\d/.test(rep)) problems.push('[440] the report shows raw machine times (2026-10-25T01:00:00.000Z)');
  if (/(^|\s)_\S|\S_(\s|$)|\*\*/.test(rep)) problems.push('[440] the report shows raw markdown marks (_…_ or **)');
  if (/Ghosty baseline/i.test(rep)) problems.push('[440] the report says "(Ghosty baseline)"');
  if (!/example\.com/.test(rep)) problems.push(`[440] the report's name is not shown as written ("example.com"): ${rep.slice(0, 120)}`);
  // a button shows its words from data-label when it has one (sentence case otherwise turns GitHub into "Github")
  const shown = await page.$$eval('#pg-reverse .cR button', (bs) => bs.map((b) => b.dataset.label || b.innerText).join(' | '));
  if (/github/i.test(shown) && (!/GitHub/.test(shown) || /Github|github/.test(shown))) problems.push(`[440] "GitHub" is not written as GitHub on the report's buttons: ${shown}`);
  if (!/github/i.test(shown)) problems.push(`[440] the report has no way to see the run on GitHub: ${shown}`);
  if (!/25 Oct/.test(rep)) problems.push('[440] the report does not say when it was made in his words ("25 Oct …")');
  const raw = await page.$eval('#pg-reverse .cR .mdreport', (r) => {
    const pre = r.querySelector('pre');
    return { pre: !!pre, folded: !!pre?.closest('details:not([open])'), summary: pre?.closest('details')?.querySelector('summary')?.textContent ?? '' };
  }).catch(() => ({ pre: false }));
  if (!raw.pre) problems.push('[440] the raw data is gone from the report (it should be folded, not dropped)');
  else if (!raw.folded) problems.push('[440] the raw JSON is open in the middle of the report (it should be folded away)');
  const fs = await page.$eval('#pg-reverse .cR .mdreport li', (e) => parseFloat(getComputedStyle(e).fontSize)).catch(() => 0);
  if (fs < 15) problems.push(`[440] the report's text is ${fs} px: too small to read on the phone (15 at least)`);
  await smallTargets(page, '440 report');
  await sideways(page, '440');

  // SAVE TO LIBRARY: saved there and then, the tab kept, no chat
  await tap(page.locator('#pg-reverse button', { hasText: /save to library/i }).first(), 'SAVE TO LIBRARY');
  await page.waitForTimeout(2500);
  const hash = await page.evaluate(() => location.hash);
  if (hash !== '#reverse') {
    problems.push(`[440] SAVE TO LIBRARY leaves the tab (${hash})`);
    await page.evaluate(() => (location.hash = 'reverse'));
    await page.waitForTimeout(1200);
  }
  if (st.chat) problems.push('[440] SAVE TO LIBRARY goes through the chat');
  if (!saved.some((b) => /example\.com/.test(b))) problems.push('[440] SAVE TO LIBRARY did not file the report in the Library');
  const conf = await text(page, '#pg-reverse .revsaved');
  if (!/Saved/i.test(conf)) problems.push(`[440] SAVE TO LIBRARY does not say it is saved: "${conf}"`);

  // the running one: when to expect it, and that he can leave
  await tap(row(page, 'bbc.co.uk'), 'the bbc.co.uk report');
  await page.waitForTimeout(1000);
  const run = await text(page, '#pg-reverse .cR .pn');
  if (!/ready by about \d\d:\d\d/i.test(run)) problems.push(`[440] a running report does not say when it should be ready ("ready by about 14:08"): ${run.slice(0, 200)}`);
  if (!/leave/i.test(run)) problems.push('[440] a running report does not say he can leave the screen');
  await page.screenshot({ path: `${out}/reverse-running-440.png` });

  // the one that did not finish: in words, and TRY AGAIN asks for the same thing
  await tap(row(page, 'left-pad'), 'the left-pad report');
  await page.waitForTimeout(1000);
  const failed = await text(page, '#pg-reverse .cR .pn');
  if (!/didn.t finish/i.test(failed)) problems.push(`[440] a failed report does not say in words that it did not finish: ${failed.slice(0, 200)}`);
  if (!/\bThe run failure/.test(failed)) problems.push('[440] the reason a report failed does not start as a sentence');
  const again = viewer(page).locator('button', { hasText: /try again/i }).first();
  if (!(await again.count())) problems.push('[440] a failed report has no TRY AGAIN');
  else {
    await tap(again, 'TRY AGAIN');
    await page.waitForTimeout(1500);
    const p = st.posts.at(-1);
    if (!p || p.target !== 'left-pad' || p.kind !== 'npm' || p.question !== 'is it safe') problems.push(`[440] TRY AGAIN did not ask for the same thing again: ${JSON.stringify(p)}`);
  }
  await page.screenshot({ path: `${out}/reverse-failed-440.png` });

  // START: the new report waits in place, with when and that he can leave
  await page.evaluate(() => document.querySelector('#pg-reverse input[aria-label="What to look at"]')?.scrollIntoView());
  await page.locator('#pg-reverse input').first().fill('kettle-shop.co.uk');
  await tap(page.locator('#pg-reverse button', { hasText: /^start$/i }).first(), 'START');
  await page.waitForTimeout(1500);
  const started = await text(page, '#pg-reverse .cR .pn');
  if (!/kettle-shop\.co\.uk/.test(started) || !/ready by about \d\d:\d\d/i.test(started)) problems.push(`[440] after START the new report is not shown waiting, with when to expect it: ${started.slice(0, 200)}`);

  // offline: said, and START does not pretend
  await ctx.setOffline(true);
  st.offline = true;
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForTimeout(400);
  await page.evaluate(() => (location.hash = 'reverse'));
  await page.waitForTimeout(1500);
  const off = await text(page, '#pg-reverse');
  if (!/offline|no connection/i.test(off)) problems.push('[440] offline is not said on the tab');
  const before = st.posts.length;
  await page.evaluate(() => document.querySelector('#pg-reverse input[aria-label="What to look at"]')?.scrollIntoView());
  await page.locator('#pg-reverse input').first().fill('example.org');
  await tap(page.locator('#pg-reverse button', { hasText: /^start$/i }).first(), 'START');
  await page.waitForTimeout(800);
  const offSaid = await text(page, '#pg-reverse .revsay');
  if (!/offline|no connection/i.test(offSaid)) problems.push(`[440] START offline does not say why nothing started: "${offSaid}"`);
  if (st.posts.length !== before) problems.push('[440] START offline still sent the request');
  await page.screenshot({ path: `${out}/reverse-offline-440.png` });
  await ctx.setOffline(false);
  st.offline = false;

  // the Make hub's card agrees with the tab
  await page.evaluate(() => (location.hash = 'area-make'));
  await page.waitForSelector('.hubtile[data-id="reverse"]', { timeout: 10000 }).catch(() => problems.push('the Make hub has no Reverse card'));
  await page.waitForTimeout(800);
  const card = await page.$eval('.hubtile[data-id="reverse"]', (c) => ({ reads: [...c.querySelectorAll('.rd')].map((r) => `${r.querySelector('em')?.textContent ?? ''}=${r.querySelector('b')?.textContent ?? ''}`).join(' '), text: c.innerText })).catch(() => null);
  const done = st.jobs.filter((j) => j.status === 'done').length;
  const running = st.jobs.filter((j) => j.status === 'running' || j.status === 'queued').length;
  if (!card || !new RegExp(`Reports=${done}\\b`, 'i').test(card.reads) || !new RegExp(`Running=${running}\\b`, 'i').test(card.reads)) problems.push(`[440] the Make hub's card does not agree with the tab (${done} ready, ${running} running): ${card?.reads}`);
  await ctx.close();
}

// ---- 3. a smaller phone and a laptop ----
for (const vp of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
  const { ctx, page } = await open(vp);
  await page.waitForFunction(() => document.querySelectorAll('#pg-reverse .rw.link').length >= 3, null, { timeout: 10000 }).catch(() => undefined);
  await tap(row(page, 'example.com'), 'the example.com report');
  await page.waitForTimeout(1200);
  const top = await viewer(page).evaluate((e) => e.getBoundingClientRect().top).catch(() => 9999);
  if (!(top >= 0 && top < vp.height / 2)) problems.push(`[${vp.width}] the report opened out of sight (top ${Math.round(top)})`);
  await sideways(page, String(vp.width));
  if (vp.width < 900) await smallTargets(page, String(vp.width));
  const cut = await page.$$eval('#pg-reverse .rw.link .v', (vs) => vs.filter((v) => v.scrollWidth > v.clientWidth + 1).map((v) => v.textContent));
  if (cut.length) problems.push(`[${vp.width}] report names cut short in the list: ${cut.join(', ')}`);
  await page.screenshot({ path: `${out}/reverse-report-${vp.width}.png` });
  await ctx.close();
}

// ---- leave the preview as it was: the report SAVE TO LIBRARY filed is removed ----
{
  const lib = await fetch(`${base}/api/library`, { headers: H }).then((r) => r.json()).catch(() => ({}));
  for (const d of lib.docs ?? []) if (/^Reverse report: example\.com/.test(d.title)) await fetch(`${base}/api/library/docs/${encodeURIComponent(d.id)}`, { method: 'DELETE', headers: H }).catch(() => undefined);
}

await browser.close();
if (problems.length) {
  console.log(`REVERSE: ${problems.length} problem(s)`);
  for (const p of problems) console.log(` - ${p}`);
  process.exit(1);
}
console.log('REVERSE: ok');
