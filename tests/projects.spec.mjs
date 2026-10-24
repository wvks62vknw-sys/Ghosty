// The Workshop tab's PROJECTS panel: two projects from a stubbed brain (progress bar, status,
// steps, a done step's result in a modal, PAUSE / RESUME / CANCEL / RUN NEXT NOW reaching the
// brain) — then a real project started from chat, approved, and worked through by the preview
// brain's alarm with the scripted model.
//   node tests/projects.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { DESKTOP, PHONE, UK } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

const projects = () => [
  {
    id: 'aaaa111111', title: 'Family recipe site', goal: 'A site of the family recipes.', status: 'active', pace: 'steady', created: Date.now() - 7200_000, updated: Date.now() - 600_000, fails: 0, docId: 'project_aaaa111111',
    steps: [
      { n: 1, title: 'Gather the recipes', instruction: 'x', status: 'done', result: 'Found 12 recipes in the notes. Sources: https://example.com/recipes', at: Date.now() - 3600_000 },
      { n: 2, title: 'Design the pages', instruction: 'x', status: 'doing' },
      { n: 3, title: 'Build the site', instruction: 'x', status: 'todo' },
      { n: 4, title: 'Publish', instruction: 'x', status: 'todo' },
    ],
  },
  {
    id: 'bbbb222222', title: 'Compare electric cars', goal: 'Which car.', status: 'paused', pace: 'fast', created: Date.now() - 86400_000, updated: Date.now() - 1800_000, fails: 3, docId: 'project_bbbb222222', note: 'step 2 failed (3 of 3): boom',
    steps: [
      { n: 1, title: 'List the options', instruction: 'x', status: 'done', result: 'Five cars.', at: Date.now() - 80000_000 },
      { n: 2, title: 'Compare running costs', instruction: 'x', status: 'failed' },
      { n: 3, title: 'Recommend one', instruction: 'x', status: 'todo' },
    ],
  },
];

async function run(name, viewport) {
  const ctx = await browser.newContext({ viewport, ...UK });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${name}] pageerror: ${e.message}`));
  const state = { list: projects(), actions: [] };
  const stub = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const m = url.pathname.match(/^\/api\/projects\/([a-z0-9]+)\/(pause|resume|cancel|run)$/);
    if (m && req.method() === 'POST') {
      state.actions.push(`${m[1]}:${m[2]}`);
      const p = state.list.find((x) => x.id === m[1]);
      if (m[2] === 'pause') p.status = 'paused';
      if (m[2] === 'resume') p.status = 'active';
      if (m[2] === 'cancel') p.status = 'cancelled';
      if (m[2] === 'run') {
        const s = p.steps.find((x) => x.status !== 'done');
        if (s) { s.status = 'done'; s.result = 'Done now.'; s.at = Date.now(); }
      }
      return json({ project: p, did: 'step' });
    }
    if (url.pathname === '/api/projects' && req.method() === 'GET') return json({ projects: state.list });
    return route.continue();
  };
  await page.route('**/api/projects**', stub);
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  await page.evaluate(() => (location.hash = 'workshop'));
  const jp = page.locator('#pg-workshop .pn', { has: page.locator('h3:has-text("PROJECTS")') });
  await jp.waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForFunction(() => document.querySelector('#pg-workshop')?.textContent?.includes('Family recipe site'), null, { timeout: 10000 }).catch(() => problems.push(`[${name}] the PROJECTS panel did not list the projects`));
  const text = (await jp.textContent()) ?? '';
  if (!/1 RUNNING/.test(text)) problems.push(`[${name}] status should say 1 RUNNING: ${text.slice(0, 80)}`);
  if (!/1\/4/.test(text) || !/1\/3/.test(text)) problems.push(`[${name}] progress bars missing (1/4 and 1/3): ${text.slice(0, 300)}`);
  if (!/RUNNING · a step every 20 min/.test(text) || !/PAUSED · a step every 3 min/.test(text)) problems.push(`[${name}] status and pace lines missing (in plain words: RUNNING, PAUSED)`);
  // the note in plain words: what happened, what happens next, and why
  if (!/Step 2 didn’t work 3 times, so Ghosty paused it\. RESUME tries it again\. Why: boom/.test(text)) problems.push(`[${name}] the project's note is not shown in plain words: ${text.slice(-220)}`);
  if (/\b(ACTIVE|TODO|DOING)\b|failed \(3 of 3\)/.test(text)) problems.push(`[${name}] the projects speak jargon (ACTIVE / TODO / DOING / "failed (3 of 3)")`);
  for (const [label, re] of [['NOW', /Design the pages\s*NOW/], ['TO DO', /Build the site\s*TO DO/], ['DIDN’T WORK', /Compare running costs\s*DIDN’T WORK/]]) if (!re.test(text)) problems.push(`[${name}] a step does not say ${label}`);
  const cards = jp.locator('.change.project');
  if ((await cards.count()) !== 2) problems.push(`[${name}] expected 2 project cards, got ${await cards.count()}`);
  const first = cards.first();
  if (await cards.nth(1).evaluate((c) => c.classList.contains('failed'))) problems.push(`[${name}] a paused project is drawn as a failure`);
  for (const label of ['PAUSE', 'RUN NEXT NOW', 'CANCEL']) if (!(await first.locator(`button:has-text("${label}")`).count())) problems.push(`[${name}] the running project has no ${label} button`);
  if (!(await cards.nth(1).locator('button:has-text("RESUME")').count())) problems.push(`[${name}] the paused project has no RESUME button`);
  await page.waitForTimeout(600); // the panes settle into place with a short animation
  await page.screenshot({ path: `${out}/${name}-projects.png` });
  // a done step opens its result
  await first.locator('.rw', { hasText: 'Gather the recipes' }).click();
  const modalText = await page.locator('.modal .mbody').textContent({ timeout: 5000 }).catch(() => '');
  if (!/Found 12 recipes/.test(modalText ?? '')) problems.push(`[${name}] the step result did not open in a modal`);
  await page.keyboard.press('Escape');
  // the buttons reach the brain and the card follows
  await first.locator('button:has-text("PAUSE")').click();
  await page.waitForFunction(() => /PAUSED · a step every 20 min/.test(document.querySelector('#pg-workshop')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] PAUSE did not change the card`));
  await jp.locator('.change.project').first().locator('button:has-text("RESUME")').click();
  await page.waitForFunction(() => /RUNNING · a step every 20 min/.test(document.querySelector('#pg-workshop')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] RESUME did not change the card`));
  await jp.locator('.change.project').first().locator('button:has-text("RUN NEXT NOW")').click();
  await page.waitForFunction(() => /2\/4/.test(document.querySelector('#pg-workshop')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] RUN NEXT NOW did not advance the bar to 2/4`));
  // CANCEL asks first in a one-tap confirm (a cancelled project cannot be started again)
  await jp.locator('.change.project').nth(1).locator('button:has-text("CANCEL")').click();
  await page.locator('.modal .confirm.sure button.sureyes').click({ timeout: 5000 }).catch(() => problems.push(`[${name}] CANCEL did not ask first`));
  await page.waitForFunction(() => /CANCELLED/.test(document.querySelector('#pg-workshop')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] CANCEL did not change the card`));
  const expected = ['aaaa111111:pause', 'aaaa111111:resume', 'aaaa111111:run', 'bbbb222222:cancel'];
  if (JSON.stringify(state.actions) !== JSON.stringify(expected)) problems.push(`[${name}] the brain saw ${JSON.stringify(state.actions)}, expected ${JSON.stringify(expected)}`);
  await page.unroute('**/api/projects**', stub);

  // the real thing: a project from chat, approved, step 1 by the preview brain's alarm, step 2 by RUN NEXT NOW
  const narrow = viewport.width < 900;
  await page.evaluate(() => (location.hash = 'core'));
  if (narrow) await page.click('.logbtn');
  // a name of its own each run: the preview brain keeps earlier projects, and the card is found by its title
  const title = `Weekend site ${name} ${Date.now().toString(36).slice(-4)}`;
  await page.fill('#cin', `start project ${title}`);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.approval button.on', { timeout: 10000 }).catch(() => problems.push(`[${name}] no approval card for the plan`));
  const plan = (await page.locator('.approval').textContent().catch(() => '')) ?? '';
  if (!/1\. Research the options/.test(plan)) problems.push(`[${name}] the approval does not show the plan: ${plan.slice(0, 160)}`);
  await page.click('.approval button.on');
  await page.waitForFunction((t) => document.body.innerText.includes(`Started "${t.toLowerCase()}"`), title, { timeout: 10000 }).catch(() => problems.push(`[${name}] the project did not start`));
  if (narrow) await page.click('.logbtn');
  await page.evaluate(() => (location.hash = 'workshop'));
  // the first step runs about five seconds after the start (the preview server emulates the alarm); the panel looks again every 15 s while a project runs
  const low = title.toLowerCase();
  await page.waitForFunction((t) => {
    const card = [...document.querySelectorAll('#pg-workshop .change.project')].find((c) => c.textContent?.includes(t));
    return !!card && /1\/3/.test(card.textContent ?? '');
  }, low, { timeout: 45000 }).catch(() => problems.push(`[${name}] step 1 of the real project did not finish on its own`));
  const real = page.locator('#pg-workshop .change.project', { hasText: low });
  await real.locator('button:has-text("RUN NEXT NOW")').click();
  await page.waitForFunction((t) => {
    const card = [...document.querySelectorAll('#pg-workshop .change.project')].find((c) => c.textContent?.includes(t));
    return !!card && /2\/3/.test(card.textContent ?? '');
  }, low, { timeout: 15000 }).catch(() => problems.push(`[${name}] RUN NEXT NOW did not run step 2 of the real project`));
  await real.locator('.rw', { hasText: 'Research the options' }).click();
  const done = await page.locator('.modal .mbody').textContent({ timeout: 5000 }).catch(() => '');
  if (!/Step 1 \(Research the options\) is done/.test(done ?? '')) problems.push(`[${name}] the real step's result is not shown: ${(done ?? '').slice(0, 120)}`);
  await page.keyboard.press('Escape');
  await page.screenshot({ path: `${out}/${name}-projects-real.png` });
  await ctx.close();
}

// ── The rest of the Workshop on the owner's phone (the upgrade pass, 24 Oct): honest states, words, targets ──
async function pairOn(viewport) {
  const ctx = await browser.newContext({ viewport, ...UK, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[workshop] pageerror: ${e.message}`));
  // the browser's own boxes are never used: every confirm is the in-app sheet
  page.on('dialog', (d) => {
    problems.push(`[workshop] the browser's own ${d.type()} box came up: ${d.message().slice(0, 80)}`);
    void d.dismiss();
  });
  await page.goto(base);
  await page.fill('#pair input', 'preview-owner-key-0123456789');
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 15000 });
  return { ctx, page };
}
const panelOf = (page, title) => page.locator('#pg-workshop .pn', { has: page.locator(`h3:has-text("${title}")`) });
/** What a panel says, its route C words (data-label) included. */
const words = (loc) => loc.evaluate((e) => `${e.textContent} ${[...e.querySelectorAll('[data-label]')].map((x) => x.dataset.label).join(' ')}`).catch(() => '');

async function workshop() {
  const { ctx, page } = await pairOn(PHONE);
  // 1. Self-edit not set up, and the change list on its way: the headline never says "Offline" and nothing says GITHUB_REPO
  let notReady = null;
  await page.route('**/api/changes', async (r) => {
    await new Promise((ok) => (notReady = ok));
    await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ready: false, changes: [], versions: [] }) });
  });
  await page.evaluate(() => (location.hash = 'workshop'));
  await panelOf(page, 'PROPOSED CHANGES').waitFor({ state: 'attached', timeout: 10000 });
  await page.waitForTimeout(400);
  const big = () => page.$eval('#pg-workshop .bigv', (e) => e.textContent ?? '');
  const waiting = await words(panelOf(page, 'PROPOSED CHANGES'));
  if (/Offline/.test(await big())) problems.push(`[workshop 1] while the change list loads the headline says "${await big()}"`);
  if (/NOT CONNECTED|GITHUB_REPO|SETUP\.md/.test(waiting)) problems.push(`[workshop 1] while loading the changes panel says it is not connected: ${waiting.slice(0, 120)}`);
  notReady?.();
  await page.waitForFunction(() => !/Checking/.test(document.querySelector('#pg-workshop .bigv')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
  const off = await words(panelOf(page, 'PROPOSED CHANGES'));
  if (/Offline/.test(await big())) problems.push(`[workshop 1] with self-edit not set up the headline says "${await big()}" (Ghosty is online)`);
  if (/GITHUB_REPO|SETUP\.md|token/.test(off)) problems.push(`[workshop 1] the self-edit panel speaks jargon: ${off.slice(0, 160)}`);
  if (!/Self-editing is off/.test(off) || !(await panelOf(page, 'PROPOSED CHANGES').locator('button:has-text("SET IT UP")').count())) problems.push(`[workshop 1] the self-edit panel does not say it is off with a way to set it up: ${off.slice(0, 160)}`);
  await page.screenshot({ path: `${out}/workshop-selfedit-off.png` });
  await page.unroute('**/api/changes');
  await ctx.close();

  // 2. The change list held back (GitHub answers in several requests in a row): the widgets and the published
  //    pages come up without waiting for it, and no list says "nothing yet" before it has answered
  {
    const { ctx, page } = await pairOn(PHONE);
    const W = { name: 'spec-egg-timer', title: 'Spec egg timer', html: '<p>egg</p>', at: Date.now() };
    let release = null;
    await page.route('**/api/changes', async (r) => {
      await new Promise((ok) => (release = ok));
      await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ready: true, changes: [], versions: [] }) });
    });
    await page.route('**/api/widgets', async (r) => {
      if (r.request().method() !== 'GET') return r.continue();
      await new Promise((ok) => setTimeout(ok, 700));
      await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ widgets: [W] }) });
    });
    await page.route('**/api/sites', async (r) => {
      await new Promise((ok) => setTimeout(ok, 700));
      await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ sites: [{ name: 'spec-bakery', title: 'Spec Bakery', source: '', at: Date.now(), bytes: 4096 }], origin: '' }) });
    });
    await page.route('**/api/projects', async (r) => {
      await new Promise((ok) => setTimeout(ok, 700));
      await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ projects: [] }) });
    });
    const t0 = Date.now();
    await page.evaluate(() => (location.hash = 'workshop'));
    await panelOf(page, 'WIDGETS').waitFor({ state: 'attached', timeout: 10000 });
    await page.waitForTimeout(250);
    const early = { widgets: await words(panelOf(page, 'WIDGETS')), pages: await words(panelOf(page, 'PUBLISHED PAGES')), projects: await words(panelOf(page, 'PROJECTS')) };
    if (/No widgets yet/.test(early.widgets)) problems.push('[workshop 2] WIDGETS says "No widgets yet" before the list has answered');
    if (/Nothing published yet/.test(early.pages)) problems.push('[workshop 2] PUBLISHED PAGES says "Nothing published yet" before the list has answered');
    if (/Nothing running/.test(early.projects)) problems.push('[workshop 2] PROJECTS says "Nothing running" before the list has answered');
    const shown = await page.waitForFunction(() => /Spec egg timer/.test(document.querySelector('#pg-workshop')?.textContent ?? '') && /Spec Bakery/.test(document.querySelector('#pg-workshop')?.textContent ?? ''), null, { timeout: 6000 }).then(() => Date.now() - t0, () => null);
    // (the change list is held until after this look: waiting for it, they would never show)
    if (shown == null) problems.push('[workshop 2] the widgets and published pages waited for the change list (not shown 6 s in while it was held)');
    release?.();
    await ctx.close();
  }

  // 3. No connection: said once on the page (the lists kept, the hero says Offline), never a "Failed to fetch" toast
  {
    const { ctx, page } = await pairOn(PHONE);
    await page.evaluate(() => (location.hash = 'workshop'));
    await page.waitForFunction(() => !/Checking/.test(document.querySelector('#pg-workshop .bigv')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => undefined);
    await page.evaluate(() => {
      window.__toasts = [];
      new MutationObserver(() => document.querySelectorAll('#toasts > *').forEach((t) => window.__toasts.includes(t.textContent) || window.__toasts.push(t.textContent))).observe(document.body, { childList: true, subtree: true });
    });
    await ctx.setOffline(true);
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForTimeout(300);
    await page.evaluate(() => (location.hash = 'workshop'));
    await page.waitForTimeout(3000);
    const toasts = await page.evaluate(() => window.__toasts);
    if (toasts.some((t) => /fetch|Workshop:/i.test(t))) problems.push(`[workshop 3] offline, a toast says: ${toasts.join(' | ')}`);
    const hero = await page.$eval('#pg-workshop .hero', (e) => e.textContent ?? '');
    if (!/Offline/.test(hero) || !/what was here before/.test(hero)) problems.push(`[workshop 3] offline, the hero does not say so: ${hero.slice(0, 160)}`);
    await page.screenshot({ path: `${out}/workshop-offline.png` });
    await ctx.setOffline(false);
    await ctx.close();
  }

  // 4. A finished mini-app: its link and how to install it, then OPEN / COPY LINK / UNDO, at the top of a short card;
  //    the five steps and the rest of the report behind SHOW DETAILS (no tool names); a finished project folds too
  {
    const { ctx, page } = await pairOn(PHONE);
    const STEPS = ['Brief and plan', 'Build and icon', 'Check', 'Publish', 'Report'];
    const report = ['"Spec Water" is live at https://ghosty.example/s/spec-water/', 'WHAT IT DOES: Adds up glasses towards 8 glasses a day, with today’s entries, the last 7 days and a streak. A new day starts at midnight.', 'WHAT IT SAVES: Your entries, on this phone only; nothing is sent anywhere. Anyone else who opens the link gets their own empty copy.', 'INSTALL: on the iPhone, open the link in Safari, tap Share, then Add to Home Screen, then Add. It opens full screen from its own icon and works with no connection once it has been opened.', 'GOOD TO KNOW: a web app on your Ghosty, not an App Store app — no notifications, and nothing runs while it is closed.', 'CHECKS: page check clean; kit gates 100/100.', 'UNDO: say "take down spec-water" (unpublish_site) and the link stops working.'].join('\n');
    const list = [
      { id: 'cccc333333', kind: 'app', title: 'App: Spec Water', goal: 'x', status: 'done', pace: 'fast', created: Date.now() - 60_000, updated: Date.now() - 30_000, fails: 0, docId: 'p', link: 'https://ghosty.example/s/spec-water/', steps: STEPS.map((t, i) => ({ n: i + 1, title: t, instruction: 'x', status: 'done', result: i === 4 ? report : 'ok', at: Date.now() })) },
      { id: 'dddd444444', title: 'Spec holiday research', goal: 'x', status: 'done', pace: 'steady', created: Date.now() - 86400_000, updated: Date.now() - 3600_000, fails: 0, docId: 'p', steps: ['Look', 'Compare', 'Write it up'].map((t, i) => ({ n: i + 1, title: t, instruction: 'x', status: 'done', result: `${t} done.`, at: Date.now() })) },
    ];
    await page.route('**/api/projects', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ projects: list }) }));
    await page.evaluate(() => (location.hash = 'workshop'));
    const app = page.locator('#pg-workshop .change.project', { hasText: 'App: Spec Water' });
    await app.waitFor({ timeout: 10000 });
    await page.waitForTimeout(600);
    const box = await app.boundingBox();
    const open = await app.locator('button:has-text("OPEN")').boundingBox();
    if (!box || box.height > 460) problems.push(`[workshop 4] the finished app's card is ${Math.round(box?.height ?? 0)} px tall (a screen of steps and report)`);
    if (!open || !box || open.y - box.y > 300) problems.push(`[workshop 4] OPEN sits ${Math.round((open?.y ?? 0) - (box?.y ?? 0))} px down the finished app's card`);
    if (!(await app.locator('button:has-text("COPY LINK")').count())) problems.push('[workshop 4] the finished app has no COPY LINK');
    const seen = await app.evaluate((c) => c.innerText);
    if (!/is live at https:\/\/ghosty\.example\/s\/spec-water\//.test(seen) || !/INSTALL: on the iPhone/.test(seen)) problems.push(`[workshop 4] the folded app card does not show its link and how to install it: ${seen.slice(0, 200)}`);
    if (/Build and icon/.test(seen)) problems.push('[workshop 4] the finished app shows its five steps before SHOW DETAILS');
    await app.evaluate((e) => e.scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/workshop-app-folded.png` });
    await app.locator('button:has-text("SHOW DETAILS")').click().catch(() => problems.push('[workshop 4] no SHOW DETAILS on the finished app'));
    await page.waitForTimeout(300);
    const all = await app.evaluate((c) => c.innerText);
    if (!STEPS.every((t) => all.includes(t)) || !/WHAT IT SAVES/.test(all)) problems.push(`[workshop 4] SHOW DETAILS does not show the steps and the report: ${all.slice(0, 200)}`);
    if (/unpublish_site/.test(all)) problems.push('[workshop 4] the report shows a tool name (unpublish_site)');
    const research = page.locator('#pg-workshop .change.project', { hasText: 'Spec holiday research' });
    if (/Compare/.test(await research.evaluate((c) => c.innerText).catch(() => ''))) problems.push('[workshop 4] a finished project keeps its steps open');
    if (!(await research.locator('button:has-text("SHOW 3 STEPS")').count())) problems.push('[workshop 4] a finished project has no SHOW 3 STEPS');
    await ctx.close();
  }

  // 5 and 6. The self-edit view: a change whose checks passed, one that failed, one still being checked
  {
    const { ctx, page } = await pairOn(PHONE);
    const at = new Date(Date.now() - 600_000).toISOString();
    const change = (number, title, checks, preview, previewUrl = null) => ({ number, title, branch: `ghosty/spec-${number}`, sha: `${number}`.repeat(10).slice(0, 40), url: `https://github.com/x/y/pull/${number}`, previewUrl, checks, preview, createdAt: at });
    const shipped = [];
    const kernel = [];
    await page.route('**/api/changes', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ ready: true, changes: [change(941, 'Spec rain radar on the Brief', 'passed', 'ok', 'https://spec-941.ghosty.pages.dev'), change(942, 'Spec bigger clock', 'failed', 'failed'), change(943, 'Spec pomodoro', 'pending', 'pending')], versions: [{ sha: 'f00dfacecafe0000', message: 'Merge pull request #940 from owner/ghosty/brief-icons', date: at }, { sha: 'beadfeed12340000', message: 'Brief: bigger icons', date: at }] }) }));
    await page.route('**/api/changes/*/ship', (r) => (shipped.push(r.request().url().match(/changes\/(\d+)/)[1]), r.fulfill({ contentType: 'application/json', body: JSON.stringify({ result: 'Shipped' }) })));
    await page.route('**/api/kernel', (r) => (kernel.push(r.request().postData()), r.fulfill({ contentType: 'application/json', body: JSON.stringify({ kernelUnlockedUntil: 0 }) })));
    await page.evaluate(() => (location.hash = 'workshop'));
    const cp = panelOf(page, 'PROPOSED CHANGES');
    await cp.locator('.change', { hasText: 'Spec bigger clock' }).waitFor({ timeout: 10000 });
    await page.waitForTimeout(500);
    const sheet = page.locator('.modal .confirm.sure');
    // 5. SHIP IT before the checks pass asks in the in-app sheet: KEEP IT ships nothing, SHIP ANYWAY ships
    const failed = cp.locator('.change', { hasText: 'Spec bigger clock' });
    await failed.locator('button:has-text("SHIP IT")').click();
    if (!(await sheet.waitFor({ timeout: 3000 }).then(() => true, () => false))) problems.push('[workshop 5] SHIP IT on a failed change did not ask in the in-app sheet');
    else {
      if (!/could break Ghosty/.test((await sheet.textContent()) ?? '')) problems.push('[workshop 5] the failed-checks sheet does not say what could happen');
      await sheet.locator('button:has-text("KEEP IT")').click();
      await page.waitForTimeout(400);
      if (shipped.length) problems.push('[workshop 5] KEEP IT still shipped the failed change');
      await failed.locator('button:has-text("SHIP IT")').click();
      await sheet.locator('button.sureyes').click({ timeout: 3000 }).catch(() => undefined);
      await page.waitForTimeout(600);
      if (shipped.join() !== '942') problems.push(`[workshop 5] SHIP ANYWAY shipped ${JSON.stringify(shipped)}`);
    }
    await page.keyboard.press('Escape');
    // UNLOCK FOR 15 MIN asks in the sheet too (the lock is in the second column on the phone)
    await page.click('#pg-workshop button.swap');
    await page.waitForTimeout(500);
    await panelOf(page, 'KERNEL LOCK').locator('button:has-text("UNLOCK")').click();
    if (!(await sheet.waitFor({ timeout: 3000 }).then(() => true, () => false))) problems.push('[workshop 5] UNLOCK FOR 15 MIN did not ask in the in-app sheet');
    else {
      await sheet.locator('button:has-text("KEEP IT")').click();
      await page.waitForTimeout(300);
      if (kernel.length) problems.push('[workshop 5] KEEP IT still unlocked the kernel');
    }
    await page.click('#pg-workshop button.swap');
    await page.waitForTimeout(400);
    // 6. Each change says what its checks mean; a failed one leads with ASK TO FIX, SHIP IT is only the bright button once they pass
    const says = async (title) => (await cp.locator('.change', { hasText: title }).evaluate((c) => c.innerText).catch(() => '')) ?? '';
    if (!/Ready to ship/.test(await says('Spec rain radar'))) problems.push('[workshop 6] a change whose checks passed does not say it is ready to ship');
    if (!/doesn’t work yet/.test(await says('Spec bigger clock'))) problems.push('[workshop 6] a failed change does not say, in plain words, that something in it does not work yet');
    if (!/Ghosty is checking it/.test(await says('Spec pomodoro'))) problems.push('[workshop 6] a change being checked does not say so in plain words');
    const fix = await failed.locator('button:has-text("ASK TO FIX")').evaluate((b) => ({ quiet: b.classList.contains('quiet'), h: b.getBoundingClientRect().height }));
    const ship = await failed.locator('button:has-text("SHIP IT")').boundingBox();
    const fixBox = await failed.locator('button:has-text("ASK TO FIX")').boundingBox();
    if (fix.quiet || fix.h < 44 || !ship || !fixBox || fixBox.y > ship.y + 4 || (Math.abs(fixBox.y - ship.y) <= 4 && fixBox.x > ship.x)) problems.push(`[workshop 6] on a failed change ASK TO FIX is not the leading button (${JSON.stringify({ ...fix, fixBox, ship })})`);
    const bright = (title) => cp.locator('.change', { hasText: title }).locator('button:has-text("SHIP IT")').evaluate((b) => getComputedStyle(b).backgroundImage !== 'none');
    if (!(await bright('Spec rain radar'))) problems.push('[workshop 6] SHIP IT is not the bright button on a change whose checks passed');
    if (await bright('Spec pomodoro')) problems.push('[workshop 6] SHIP IT is the bright button while the checks are still running');
    await cp.locator('.change', { hasText: 'Spec bigger clock' }).evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${out}/workshop-changes.png` });
    await ctx.close();
  }

  // 7. RUN NEXT NOW on a step that did not work: said in plain words, not "Step not finished (retry)"
  {
    const { ctx, page } = await pairOn(PHONE);
    const p = { ...projects()[0], id: 'eeee555555', title: 'Spec retry project' };
    await page.route('**/api/projects**', (r) => {
      if (r.request().method() !== 'POST') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ projects: [p] }) });
      p.note = 'step 2 failed (1 of 3): HTTP 429 Too Many Requests';
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ project: p, did: 'retry' }) });
    });
    await page.evaluate(() => (location.hash = 'workshop'));
    const card = page.locator('#pg-workshop .change.project', { hasText: 'Spec retry project' });
    await card.waitFor({ timeout: 10000 });
    await page.evaluate(() => {
      window.__toasts = [];
      new MutationObserver(() => document.querySelectorAll('#toasts > *').forEach((t) => window.__toasts.includes(t.textContent) || window.__toasts.push(t.textContent))).observe(document.body, { childList: true, subtree: true });
    });
    await card.locator('button:has-text("RUN NEXT NOW")').click();
    await page.waitForTimeout(800);
    const said = (await page.evaluate(() => window.__toasts)).join(' | ');
    if (!/didn’t work/.test(said) || /\(retry\)/.test(said)) problems.push(`[workshop 7] RUN NEXT NOW on a step that did not work says: ${said}`);
    const note = (await card.locator('small.note').textContent().catch(() => '')) ?? '';
    if (!/Step 2 didn’t work \(try 1 of 3\): Ghosty tries again by itself/.test(note) || !/the free AI was busy/.test(note)) problems.push(`[workshop 7] the retry note is not in plain words: ${note}`);
    await ctx.close();
  }
}

await workshop();
await run('desktop', DESKTOP);
await run('phone', PHONE);
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Projects run clean: the PROJECTS panel and a real project work.');
process.exit(problems.length ? 1 : 0);
