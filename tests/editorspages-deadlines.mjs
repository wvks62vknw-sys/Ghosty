// THE EDITORS LANE, PAGES: WORKSPACE DEADLINES ON THE AGENDA AND IN THE BRIEF (editors.c4, built into PLAN's agenda and brief), end to end.
//  1. The Agenda's To-do section has TO-DO · FROM MY WORKSPACE: the late one first, today's said TODAY, a done row and a far-off one left out,
//     read-only (no keys of its own); a tap opens the row's page in the Workspace.
//  2. The Brief's YOUR DAY says them in one line (WORKSPACE), and a tap opens the first.
//  3. With nothing due, the panel says so in his words.
//  4. The agenda's section in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21.
// Dates are anchored to London's midnight (the phone's own day), so a run between 00:00 and 01:00 still passes.
import { openSection } from './nav.mjs';

const london = (plus = 0) => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/London' }));
  d.setDate(d.getDate() + plus);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const now = Date.now();
  const pg = (id, title, parent, extra = {}) => ({ id, title, icon: 'page', parent, blocks: [], at: now, created: now, order: 0, ...extra });
  const db = { props: [{ id: 'ps', name: 'Start', kind: 'date' }, { id: 'pd', name: 'Due', kind: 'date' }, { id: 'pk', name: 'Done', kind: 'check' }], views: [{ id: 'v1', name: 'Table', kind: 'table', hidden: [] }] };
  const seed = {
    'ghosty.workspace': {
      v: 1, versions: {}, at: now, pages: {
        kit: pg('kit', 'Kitchen', null),
        tasks: pg('tasks', 'Tasks', 'kit', { icon: 'table', db }),
        r1: pg('r1', 'Book the tiler', 'tasks', { vals: { ps: london(-9), pd: london(0) } }),
        r2: pg('r2', 'Order the grout', 'tasks', { vals: { pd: london(-3) } }),
        r3: pg('r3', 'Paint the ceiling', 'tasks', { vals: { pd: london(4) } }),
        r4: pg('r4', 'Measure the worktop', 'tasks', { vals: { pd: london(0), pk: true } }),
        r5: pg('r5', 'Plan the garden', 'tasks', { vals: { pd: london(60) } }),
      },
    },
  };
  const panelSel = '#pg-agenda .pn.workdue';
  const goAgenda = async (page) => {
    await page.evaluate(() => (location.hash = 'agenda'));
    await page.waitForSelector('#pg-agenda .pn', { state: 'attached', timeout: 15000 });
    await openSection(page, 'agenda', 'To-do');
    return until(page, (sel) => {
      const p = document.querySelector(sel);
      if (!p) return false;
      p.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true }));
      return p.getBoundingClientRect().height > 0 && !!p.querySelector('.bd .rw');
    }, panelSel);
  };

  // ---------------------------------------------------------------- 1 and 2
  {
    const { ctx, page } = await open({ look: LOOKS.scan, seed });
    check(await goAgenda(page), 'deadlines 1: the agenda’s To-do has TO-DO · FROM MY WORKSPACE');
    const rows = await page.evaluate((sel) => [...document.querySelectorAll(`${sel} .bd .rw`)].map((r) => ({ id: r.dataset.id, late: r.dataset.late, k: r.querySelector('.k')?.textContent, v: r.querySelector('.v')?.textContent, n: r.querySelector('.n')?.textContent })), panelSel);
    check(rows.map((r) => r.v).join(' | ') === 'Order the grout | Book the tiler | Paint the ceiling', `deadlines 1: late first, then by date; the done one and the far-off one left out (${rows.map((r) => r.v).join(' | ')})`);
    check(rows[0]?.late === '1' && /^LATE, SINCE /.test(rows[0]?.k ?? ''), `deadlines 1: the late one says so (${rows[0]?.k})`);
    check(rows[1]?.k === 'TODAY' && rows[1]?.n === 'Tasks · Kitchen', `deadlines 1: today’s says TODAY, with where it lives (${rows[1]?.k} · ${rows[1]?.n})`);
    check(await page.locator(`${panelSel} .bd button`).count() === 0, 'deadlines 1: read-only (no keys of its own: it is changed in the Workspace)');
    check(/1 LATE/.test(await page.locator(`${panelSel} h3 small`).textContent()), 'deadlines 1: its light says 1 LATE');
    await page.locator(`${panelSel} .rw[data-id="r1"]`).click();
    check(await until(page, () => window.__ghosty.workspace?.open && window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'Book the tiler'), 'deadlines 1: a tap opens its page in the Workspace');
    await page.keyboard.press('Escape');
    // 2. the brief
    await page.evaluate(() => (location.hash = 'brief'));
    const said = await page.waitForSelector('#pg-brief .brworkdue', { timeout: 20000 }).then((e) => e.textContent(), () => '');
    check(/Order the grout is late in your workspace \(due .+\), and 2 more this week/.test(said ?? ''), `deadlines 2: the brief’s YOUR DAY says it in one line (${said})`);
    await page.locator('#pg-brief .brworkdue').click();
    check(await until(page, () => window.__ghosty.workspace?.open && window.__ghosty.workspace.title === 'Order the grout'), 'deadlines 2: a tap opens the first in the Workspace');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 3. nothing due
  {
    const { ctx, page } = await open({ look: LOOKS.scan });
    check(await goAgenda(page), 'deadlines 3: the panel is there with nothing due');
    check((await page.locator(`${panelSel} .bd .rw .v`).first().textContent()) === 'Nothing due in your workspace in the next 14 days. A date called Due in a workspace database shows here.', 'deadlines 3: it says so in his words');
    await page.evaluate(() => (location.hash = 'brief'));
    await page.waitForSelector('#pg-brief .brday .rw', { timeout: 20000 }).catch(() => undefined);
    check(!(await page.locator('#pg-brief .brworkdue').count()), 'deadlines 3: the brief says nothing of the workspace when nothing is due');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 4. every look, The Scan small, BODY 21
  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport, seed });
    check(await goAgenda(page), `deadlines ${r.name}: the agenda shows the workspace’s deadlines`);
    if (r.big) await body21(page);
    await settle(page);
    await measure(page, panelSel, `deadlines ${r.name}`);
    await ctx.close();
  }
}
