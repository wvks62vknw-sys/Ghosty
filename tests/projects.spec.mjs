// The Workshop tab's PROJECTS panel: two projects from a stubbed brain (progress bar, status,
// steps, a done step's result in a modal, PAUSE / RESUME / CANCEL / RUN NEXT NOW reaching the
// brain) — then a real project started from chat, approved, and worked through by the preview
// brain's alarm with the scripted model.
//   node tests/projects.spec.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
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
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`[${name}] pageerror: ${e.message}`));
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
  if (!/ACTIVE · a step every 20 min/.test(text) || !/PAUSED · a step every 3 min/.test(text)) problems.push(`[${name}] status and pace lines missing`);
  if (!/step 2 failed \(3 of 3\): boom/.test(text)) problems.push(`[${name}] the project's note is not shown`);
  const cards = jp.locator('.change.project');
  if ((await cards.count()) !== 2) problems.push(`[${name}] expected 2 project cards, got ${await cards.count()}`);
  const first = cards.first();
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
  await page.waitForFunction(() => /ACTIVE · a step every 20 min/.test(document.querySelector('#pg-workshop')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] RESUME did not change the card`));
  await jp.locator('.change.project').first().locator('button:has-text("RUN NEXT NOW")').click();
  await page.waitForFunction(() => /2\/4/.test(document.querySelector('#pg-workshop')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => problems.push(`[${name}] RUN NEXT NOW did not advance the bar to 2/4`));
  page.once('dialog', (d) => d.accept());
  await jp.locator('.change.project').nth(1).locator('button:has-text("CANCEL")').click();
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

await run('desktop', { width: 1440, height: 900 });
await run('phone', { width: 390, height: 844 });
await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Projects run clean: the PROJECTS panel and a real project work.');
process.exit(problems.length ? 1 : 0);
