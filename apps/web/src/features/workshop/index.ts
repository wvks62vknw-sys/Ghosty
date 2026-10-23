/**
 * WORKSHOP tab: where Ghosty changes itself.
 *  - Tell Ghosty what to build or change
 *  - Follow (and continue) Ghosty's upgrade roadmap for bigger self-upgrades
 *  - Review its proposed changes (preview link, build checks) and ship or discard them
 *  - Roll back to any earlier version
 *  - Open, or remove, instant widgets
 *  - Unlock the protected kernel for a limited time (only you can do this)
 *  - Training ground: Ghosty solves verified coding exercises until every hidden test passes
 *  - Projects that run for days: progress, steps and results, pause / resume / cancel / run next now
 *  - Upgrade ideas: what Ghosty proposed for itself this morning; BUILD starts one in the chat
 */
import type { ChangeSummary, Project, ProjectStep, PublishedSite, Roadmap, RoadmapStep, UpgradeIdea, VersionSummary, Widget } from '../../../../../packages/shared/src/protocol';
import { brain, isPaused } from '../../api/brain';
import { send } from '../../assistant/session';
import { clear, fmt, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { bar, button, empty, modal, panel, pill, progressRing, row, sandboxFrame, toast, type Light } from '../../ui/components';
import { proLook } from '../../state/theme';
import { page } from '../../ui/page';
import { forgetWidget, mergeWidgets, syncLocalWidgets } from '../../state/widgets';
import { failureReport, runTests } from '../../training/runner';
import { WHATS_NEW, whatsNewDue, whatsNewSeen } from '../../state/whatsnew';

const CHECK_LABEL: Record<ChangeSummary['checks'], string> = { passed: 'CHECKS OK', failed: 'CHECKS FAILED', pending: 'CHECKING…', none: 'WAITING FOR CHECKS' };
const PREVIEW_LABEL: Record<ChangeSummary['preview'], string> = { ok: 'preview ready', failed: 'preview build failed', pending: 'preview building…', none: 'no preview yet' };

export const workshopTab: TabDef = {
  id: 'workshop',
  title: 'WORKSHOP',
  icon: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  scene: 'backdrop',
  blurb: 'self-edits · training ground · widgets',
  primary: true,
  mount(root) {
    const P = page(root, { tag: 'WORKSHOP // SELF-EVOLUTION', sub: 'Ghosty changes its own code. You decide what goes live.', rightLabel: 'WIDGETS & VERSIONS', leftLabel: 'CHANGES' });

    // ask box
    const ask = panel('TELL GHOSTY WHAT TO BUILD', { grow: false });
    const input = h('textarea', { rows: 3, placeholder: 'e.g. "Add a rain radar panel to the Brief tab" or "Make me a pomodoro timer widget"', 'aria-label': 'What should Ghosty build' });
    const go2 = () => {
      const t = input.value.trim();
      if (!t) return;
      input.value = '';
      go('core');
      void send(t);
    };
    ask.body.append(input, h('div.row', button('BUILD IT', go2, 'on'), h('span.note', 'Bigger changes become a reviewable change; quick tools install instantly as widgets.')));

    // upgrade roadmap
    const STEP_TONE: Record<RoadmapStep['status'], 'up' | 'dn' | 'bad' | undefined> = { done: 'up', doing: undefined, todo: undefined, blocked: 'bad' };
    const rp = panel('UPGRADE ROADMAP', { footer: true, status: '' });
    let roadmap: Roadmap | null = null;
    const paintRoadmap = () => {
      clear(rp.body);
      clear(rp.foot!);
      if (!roadmap) {
        rp.setStatus('NONE', 'off');
        rp.body.append(h('div.note', 'Ask Ghosty to upgrade itself: it audits what it has, plans the upgrade as small shippable steps, and builds them one by one.'));
        rp.foot!.append(button('UPGRADE YOURSELF', () => {
          go('core');
          void send('Audit yourself and plan an upgrade that makes you a better version of yourself: the improvements worth most to me, as small shippable steps. Then start building step 1.');
        }, 'on'));
        return;
      }
      const r = roadmap;
      const done = r.steps.filter((s) => s.status === 'done').length;
      rp.setStatus(`${done}/${r.steps.length}`, done === r.steps.length ? 'ok' : 'mid');
      rp.body.append(h('div.note', r.goal));
      for (const s of r.steps) rp.body.append(row(`${s.id}`, s.note ? `${s.title} — ${s.note}` : s.title, s.pr ? `#${s.pr} ${s.status.toUpperCase()}` : s.status.toUpperCase(), { wrap: true, tone: STEP_TONE[s.status] }));
      if (done < r.steps.length) {
        rp.foot!.append(button('CARRY ON', () => {
          go('core');
          void send('Carry on with the upgrade roadmap: build the next step.');
        }, 'on'));
      }
      rp.foot!.append(button('CLEAR', async () => {
        await brain.clearRoadmap().catch(() => toast('Could not clear the roadmap', 'bad'));
        roadmap = null;
        paintRoadmap();
      }));
    };
    const loadRoadmap = async () => {
      try {
        roadmap = (await brain.roadmap()).roadmap;
      } catch {
        /* the rest of the Workshop reports connection problems */
      }
      paintRoadmap();
    };
    paintRoadmap();

    // projects that run for days (projects.ts): one step every few minutes on Ghosty's own schedule
    const jp = panel('PROJECTS', { status: '' });
    let projects: Project[] = [];
    const PSTEP_TONE: Record<ProjectStep['status'], 'up' | 'bad' | undefined> = { done: 'up', failed: 'bad', doing: undefined, todo: undefined };
    const PROJECT_LIGHT: Record<Project['status'], Light> = { active: 'ok', paused: 'mid', done: 'ok', cancelled: 'off' };
    const act = (id: string, action: 'pause' | 'resume' | 'cancel' | 'run', ask?: string) => async (b: HTMLButtonElement) => {
      if (ask && !confirm(ask)) return;
      b.disabled = true;
      try {
        const r = await brain.projectAction(id, action);
        projects = projects.map((p) => (p.id === id ? r.project : p));
        if (action === 'run') toast(r.did === 'step' || r.did === 'done' ? 'Step done' : r.did === 'waiting' ? 'Waiting: no model is free right now (or Ghosty is busy); it tries again on its own' : `Step not finished (${r.did})`, r.did === 'step' || r.did === 'done' ? 'ok' : 'warn');
      } catch (e) {
        toast(`Could not ${action}: ${String((e as Error).message)}`, 'bad');
      }
      paintProjects();
      void loadProjects();
    };
    const paintProjects = () => {
      clear(jp.body);
      const running = projects.filter((p) => p.status === 'active').length;
      jp.setStatus(projects.length ? (running ? `${running} RUNNING` : `${projects.length}`) : '', running ? 'ok' : projects.some((p) => p.status === 'paused') ? 'mid' : 'ok');
      if (!projects.length) {
        jp.body.append(empty('NONE', 'Ask Ghosty for something that takes days — “research the options over the next few days, then build it” — and it works through a plan step by step on its own, a step every few minutes, without burning through a day’s free models.', 'Nothing running'));
        return;
      }
      for (const p of projects) {
        const done = p.steps.filter((s) => s.status === 'done').length;
        const card = h(`div.change.project${p.status === 'done' ? '.passed' : p.status === 'paused' ? '.failed' : ''}` as 'div', h('div.ct', h('b', p.title), h('small', `${p.status.toUpperCase()} · ${p.pace === 'fast' ? 'a step every 3 min' : 'a step every 20 min'} · ${fmt.ago(p.updated)}`)));
        // route C: a progress ring with the steps done, beside the title
        const ring = progressRing(46);
        ring.set(done / Math.max(1, p.steps.length), 0, `${done}/${p.steps.length}`, p.status === 'done');
        ring.el.classList.add('projring');
        card.prepend(ring.el);
        card.append(bar('STEPS', done / Math.max(1, p.steps.length), `${done}/${p.steps.length}`, p.status === 'paused' ? '#ffd24d' : undefined));
        for (const s of p.steps) {
          const r = row(`${s.n}`, s.title, s.status.toUpperCase(), { wrap: true, tone: PSTEP_TONE[s.status] });
          r.classList.add(`st-${s.status}`);
          if (s.result) {
            // a done step opens what it produced (its own class, not .link: the widgets list is the tab's .rw.link)
            r.classList.add('open');
            r.tabIndex = 0;
            const open = () => modal(`Step ${s.n}: ${s.title}`, h('div.readwrap', h('div.note', `${p.title} · ${s.at ? fmt.ago(s.at) : ''}`), h('div.reader', ...s.result!.split(/\n+/).map((line) => h('p', line)))));
            r.addEventListener('click', open);
            r.addEventListener('keydown', (e) => e.key === 'Enter' && open());
          }
          card.append(r);
        }
        if (p.note) card.append(h('small.note', p.note));
        const actions = h('div.row.wrap');
        if (p.status === 'active') actions.append(button('PAUSE', act(p.id, 'pause')), button('RUN NEXT NOW', act(p.id, 'run'), 'on'));
        if (p.status === 'paused') actions.append(button('RESUME', act(p.id, 'resume'), 'on'), button('RUN NEXT NOW', act(p.id, 'run')));
        if (p.status === 'active' || p.status === 'paused') actions.append(button('CANCEL', act(p.id, 'cancel', `Cancel "${p.title}"? What it already produced stays in the library.`), 'warn'));
        if (actions.childElementCount) card.append(actions);
        jp.body.append(card);
      }
    };
    const loadProjects = async () => {
      try {
        projects = (await brain.projects()).projects;
      } catch {
        /* paused or offline: the last list stays */
      }
      paintProjects();
    };
    paintProjects();
    // upgrade ideas (the brain's upgrades.ts): proposed every morning; BUILD hands one to the chat, DISMISS drops it
    const ip = panel('UPGRADE IDEAS', { footer: true, status: '' });
    let ideas: UpgradeIdea[] = [];
    let ideasNext: number | null = null;
    const nextNote = h('span.note', '');
    const buildIdea = (i: UpgradeIdea) => {
      go('core');
      void send(`Build this upgrade: ${i.title}. ${i.why ? `${i.why.replace(/[.\s]+$/, '')}. ` : ''}Steps: ${i.steps.map((s, n) => `${n + 1}. ${s.replace(/[.\s]+$/, '')}`).join('. ')}.`);
    };
    const paintIdeas = () => {
      clear(ip.body);
      ip.setStatus(ideas.length ? `${ideas.length}` : 'NONE YET', ideas.length ? 'ok' : 'off');
      nextNote.textContent = ideasNext ? `next look ${new Date(ideasNext).toLocaleDateString([], { weekday: 'short' })} ${fmt.time(new Date(ideasNext))}` : 'every morning';
      if (!ideas.length) ip.body.append(empty('NONE', 'Every morning Ghosty looks at what you asked, what it could not answer and what went wrong, and proposes upgrades it can build for itself. THINK NOW asks him now.', 'No ideas yet'));
      for (const i of ideas) {
        const card = h('div.idea', h('b', i.title), i.why ? h('div.note', i.why) : null, h('ol', ...i.steps.map((s) => h('li', s))));
        card.append(
          h('div.row', button('BUILD', () => buildIdea(i), 'on'), button('DISMISS', async () => {
            try {
              await brain.dismissUpgrade(i.id);
              ideas = ideas.filter((x) => x.id !== i.id);
              paintIdeas();
            } catch (e) {
              if (!isPaused(e)) toast(`Could not dismiss it: ${String((e as Error).message)}`, 'warn');
            }
          }), h('small.note', fmt.ago(i.at))),
        );
        ip.body.append(card);
      }
    };
    ip.foot!.append(
      button('THINK NOW', async (b) => {
        b.disabled = true;
        b.textContent = 'THINKING…';
        try {
          const r = await brain.thinkUpgrades();
          ideas = r.ideas;
          paintIdeas();
          toast(r.added ? `${r.added} new upgrade idea${r.added === 1 ? '' : 's'}` : r.note, r.added ? 'ok' : '');
        } catch (e) {
          if (!isPaused(e)) toast(`Could not think about upgrades: ${String((e as Error).message)}`, 'warn');
        } finally {
          b.disabled = false;
          b.textContent = 'THINK NOW';
        }
      }, 'on'),
      nextNote,
    );
    const loadIdeas = async () => {
      try {
        const r = await brain.upgrades();
        ideas = r.ideas;
        ideasNext = r.next;
      } catch {
        /* the rest of the Workshop reports connection problems */
      }
      paintIdeas();
    };
    paintIdeas();

    // changes
    const cp = panel('PROPOSED CHANGES', { status: '' });
    // versions
    const vp = panel('VERSIONS', { status: '' });
    // widgets
    const wp = panel('WIDGETS', { status: '' });
    // published pages (publish_site): every live link, to open, copy or take down
    const pp = panel('PUBLISHED PAGES', { status: '' });
    // kernel
    const kp = panel('KERNEL LOCK', { grow: false });
    // WHAT'S NEW: this week's merges, once per build (state/whatsnew.ts), above everything else until GOT IT
    if (whatsNewDue()) {
      const wn = panel("WHAT'S NEW", { grow: false, cls: 'whatsnew', status: `${WHATS_NEW.length} THIS WEEK` });
      // Route C: a card — the newest three, "Show all" for the rest, GOT IT as a small pill in its corner.
      const rows = WHATS_NEW.map((n, i) => h(`div.wnrow${i >= 3 ? '.more' : ''}` as 'div', { dataset: { case: 'keep' } }, h('b', n.title), h('span', n.line)));
      const all = h('button.wnall', { type: 'button', dataset: { case: 'keep' }, 'aria-expanded': 'false' }, `Show all ${WHATS_NEW.length}`);
      all.hidden = WHATS_NEW.length <= 3;
      all.addEventListener('click', () => {
        const open = !wn.el.classList.contains('wnopen');
        wn.el.classList.toggle('wnopen', open);
        all.setAttribute('aria-expanded', String(open));
        all.textContent = open ? 'Show fewer' : `Show all ${WHATS_NEW.length}`;
      });
      const got = button('GOT IT', () => {
        whatsNewSeen();
        wn.el.remove();
      }, 'on wngot');
      got.dataset.label = 'Got it';
      wn.el.querySelector('h3')?.append(got);
      wn.body.append(...rows, all);
      P.left.append(wn.el);
    }
    P.left.append(ask.el, rp.el, jp.el, ip.el, cp.el);
    // training ground
    const tp = panel('TRAINING GROUND', { footer: true, grow: false });
    const tStats = h('div.note', 'Ghosty writes a solution, hidden tests run it in a locked sandbox, and it must fix every failure until all tests pass.');
    const tNow = h('div.trainnow');
    const tLog = h('div.liblog');
    const tLevel = h('select', { 'aria-label': 'Exercise level' }, h('option', { value: '0' }, 'All levels'), h('option', { value: '1' }, 'Level 1'), h('option', { value: '2' }, 'Level 2'), h('option', { value: '3' }, 'Level 3'));
    const MAX_TRIES = 6;
    let training = false;
    const tLine = (text: string, kind: '' | 'ok' | 'bad' = '') => {
      tLog.prepend(h(`div.note${kind ? `.${kind}` : ''}` as 'div', text));
      while (tLog.children.length > 8) tLog.lastChild!.remove();
    };
    const paintTraining = async () => {
      try {
        const t = await brain.training();
        const recs = Object.values(t.records);
        const solved = recs.filter((r) => r.solved).length;
        const first = recs.filter((r) => r.firstSolve === 1).length;
        tp.setStatus(`${solved}/${t.exercises.length} SOLVED`, solved === t.exercises.length ? 'ok' : 'mid');
        tStats.textContent = `${solved} of ${t.exercises.length} exercises solved · ${first} first time · every solution is verified by hidden tests and saved to the library.`;
      } catch {
        tp.setStatus('OFFLINE', 'off');
      }
    };
    /** One exercise: attempt → run tests → feed failures back → repeat until it passes (or the limit). */
    const trainOne = async (id: string): Promise<boolean> => {
      const ex = await brain.trainingExercise(id);
      const history: { code: string; report: string }[] = [];
      let firstReport = '';
      for (let attempt = 1; attempt <= MAX_TRIES && training; attempt++) {
        tNow.textContent = `${ex.title} · level ${ex.level} · attempt ${attempt}/${MAX_TRIES}: writing…`;
        let code = '';
        let model = '';
        try {
          ({ code, model } = await brain.trainingAttempt(id, history));
        } catch (e) {
          tLine(`✕ ${ex.title}: no AI available (${(e as Error).message}) — stopping`, 'bad');
          training = false;
          return false;
        }
        tNow.textContent = `${ex.title} · attempt ${attempt}: running ${ex.tests.length} hidden tests…`;
        const r = await runTests(code, ex.entry, ex.tests);
        const passed = 'results' in r && r.results.every((x) => x.ok);
        if (passed) {
          tLine(`✓ ${ex.title} — all ${ex.tests.length} tests pass (attempt ${attempt}, ${model})`, 'ok');
          const res = await brain.trainingResult({ id, solved: true, attempts: attempt, code, model, firstReport: firstReport || undefined }).catch(() => ({ lesson: '' }));
          if (res.lesson) tLine(`lesson learned: ${res.lesson}`);
          return true;
        }
        const report = failureReport(r, ex.tests);
        if (!firstReport) firstReport = report;
        tLine(`… ${ex.title} attempt ${attempt}: ${report.split('\n')[0]}`);
        history.push({ code, report });
      }
      if (training) {
        tLine(`✕ ${ex.title}: not solved in ${MAX_TRIES} attempts — it will come back`, 'bad');
        await brain.trainingResult({ id, solved: false, attempts: MAX_TRIES, code: history.at(-1)?.code ?? '', model: '' }).catch(() => undefined);
      }
      return false;
    };
    const startBtn = button('TRAIN', async (b) => {
      if (training) {
        training = false;
        b.textContent = 'TRAIN';
        return;
      }
      training = true;
      b.textContent = 'STOP';
      try {
        const t = await brain.training();
        const lv = Number(tLevel.value);
        // unsolved first, easiest first; then everything again for practice
        const order = t.exercises.filter((e) => !lv || e.level === lv).sort((a, c) => Number(!!t.records[a.id]?.solved) - Number(!!t.records[c.id]?.solved) || a.level - c.level);
        for (const e of order) {
          if (!training) break;
          await trainOne(e.id);
          void paintTraining();
        }
      } finally {
        training = false;
        b.textContent = 'TRAIN';
        tNow.textContent = '';
        void paintTraining();
      }
    }, 'on');
    tp.body.append(tStats, tNow, tLog);
    tp.foot!.append(tLevel, startBtn);
    P.right.append(tp.el, pp.el, wp.el, vp.el, kp.el);

    let changes: ChangeSummary[] = [];
    let versions: VersionSummary[] = [];
    let widgets: Widget[] = [];
    let sites: PublishedSite[] = [];
    let siteOrigin = '';
    const siteUrl = (name: string) => `${siteOrigin || location.origin}/s/${name}`;
    const paintSites = () => {
      clear(pp.body);
      pp.setStatus(sites.length ? `${sites.length} LIVE` : '', 'ok');
      if (!sites.length) {
        pp.body.append(empty('NONE', 'Ask Ghosty to “make me a website for…” or to rebuild one from a link: it goes live at a public link here.', 'Nothing published yet'));
        return;
      }
      for (const s of sites) {
        const open = h('a.sitelink', { href: siteUrl(s.name), target: '_blank', rel: 'noopener' }, h('b', s.title), h('small', `${siteUrl(s.name).replace(/^https?:\/\//, '')} · ${fmt.ago(s.at)} · ${Math.max(1, Math.round(s.bytes / 1024))} KB${s.source ? ` · from ${s.source.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}` : ''}`));
        const copy = button('COPY LINK', async () => {
          try {
            await navigator.clipboard.writeText(siteUrl(s.name));
            toast('Link copied', 'ok');
          } catch {
            toast(siteUrl(s.name), 'ok');
          }
        });
        const down = button('UNPUBLISH', async () => {
          if (!confirm(`Take "${s.title}" down? Its link stops working.`)) return;
          try {
            await brain.unpublishSite(s.name);
            sites = sites.filter((x) => x.name !== s.name);
            toast(`${s.title} taken down`, 'ok');
            paintSites();
          } catch (e) {
            toast(`Could not take it down: ${String((e as Error).message)}`, 'warn');
          }
        }, 'warn');
        pp.body.append(h('div.site', open, h('div.keyrow', copy, down)));
      }
    };
    let ready = false;
    let kernelUntil = 0;

    const paint = () => {
      clear(cp.body);
      if (!ready) {
        cp.setStatus('NOT CONNECTED', 'off');
        cp.body.append(h('div.note.rcwarn', 'Self-editing needs GITHUB_REPO on the brain and a GitHub token in the System tab. See SETUP.md.'));
      } else {
        cp.setStatus(`${changes.length} OPEN`, changes.length ? 'mid' : 'ok');
        if (!changes.length) cp.body.append(empty('NONE', 'Ask Ghosty to build something: what he changes waits here for you to SHIP IT.', 'No open changes'));
        for (const c of changes) {
          const meta = h('small', `${CHECK_LABEL[c.checks]} · ${PREVIEW_LABEL[c.preview ?? 'none']} · ${fmt.ago(Date.parse(c.createdAt))}`);
          // route C: the checks as a pill, the rest of the line in words
          meta.dataset.label = `${PREVIEW_LABEL[c.preview ?? 'none'].replace(/^./, (x) => x.toUpperCase())} · ${fmt.ago(Date.parse(c.createdAt))}`;
          const checks = pill(c.checks === 'passed' ? 'Checks passed' : c.checks === 'failed' ? 'Checks failed' : c.checks === 'pending' ? 'Checking' : 'No checks yet', c.checks === 'passed' ? 'live' : c.checks === 'failed' ? 'warn' : 'idle', 'chk');
          const card = h(`div.change.${c.checks}` as 'div', h('div.ct', h('b', `#${c.number} ${c.title}`), checks, meta));
          const actions = h('div.row.wrap');
          if (c.previewUrl) actions.append(button('PREVIEW ↗', () => window.open(c.previewUrl!, '_blank', 'noopener'), 'prev'), h('small.note.prevnote', 'view only — previews never ask for your password'));
          actions.append(
            button('SHIP IT', async (b) => {
              if (c.checks === 'failed' && !confirm(`The code checks FAILED for #${c.number}: shipping it could break Ghosty.\n\nAsk Ghosty to "fix change #${c.number}" instead.\n\nShip anyway?`)) return;
              if ((c.checks === 'pending' || c.checks === 'none') && !confirm('The checks have not finished yet. Ship without waiting?')) return;
              b.disabled = true;
              try {
                toast((await brain.ship(c.number, c.sha)).result, 'ok');
              } catch (e) {
                toast(String((e as Error).message), 'bad');
              }
              void load();
            }, 'on ship'),
            button('ASK TO FIX', () => {
              go('core');
              void send(`Check change #${c.number} with change_status and fix anything that failed.`);
            }, 'quiet'),
            button('DISCARD', async () => {
              await brain.discard(c.number).catch((e) => toast(String(e.message), 'bad'));
              void load();
            }, 'warn quiet'),
            button('GITHUB ↗', () => window.open(c.url, '_blank', 'noopener'), 'quiet'),
          );
          card.append(actions);
          cp.body.append(card);
        }
      }
      clear(vp.body);
      vp.setStatus(versions.length ? `${versions.length}` : '', 'ok');
      versions.slice(0, 10).forEach((v, i) => {
        const r = row(v.sha.slice(0, 7), v.message, i === 0 ? 'LIVE' : '↶', { wrap: true });
        (r.querySelector('.k') as HTMLElement).dataset.case = 'keep';
        r.classList.add(i === 0 ? 'live' : 'old');
        if (i > 0) (r.lastChild as HTMLElement).setAttribute('aria-label', `Restore "${v.message}"`);
        if (i > 0) {
          const back = r.lastChild as HTMLElement;
          back.classList.add('del');
          back.title = 'Restore this version';
          back.addEventListener('click', async () => {
            if (!confirm(`Roll Ghosty back to "${v.message}"? This becomes a new version, so you can undo it too.`)) return;
            try {
              toast((await brain.restore(v.sha)).result, 'ok');
            } catch (e) {
              toast(String((e as Error).message), 'bad');
            }
            void load();
          });
        }
        vp.body.append(r);
      });
      clear(wp.body);
      wp.setStatus(`${widgets.length}`, 'ok');
      if (!widgets.length) wp.body.append(empty('NONE', 'Try “make me a pomodoro timer widget”: it installs here at once.', 'No widgets yet'));
      for (const w of widgets) {
        const r = row(fmt.ago(w.at), w.title, '✕');
        r.classList.add('link');
        (r.querySelector('.v') as HTMLElement).addEventListener('click', () => modal(w.title, sandboxFrame(w.html)));
        const x = r.lastChild as HTMLElement;
        x.classList.add('del');
        x.addEventListener('click', async () => {
          try {
            await brain.deleteWidget(w.name);
            forgetWidget(w.name, false);
          } catch (e) {
            // Paused: delete here now and in the brain when it's back. Anything else: say so.
            forgetWidget(w.name, isPaused(e));
            if (!isPaused(e)) toast(`Could not delete it from Ghosty: ${String((e as Error).message)}`, 'warn');
          }
          widgets = widgets.filter((x) => x.name !== w.name);
          paint();
        });
        wp.body.append(r);
      }
      clear(kp.body);
      const open = kernelUntil > Date.now();
      kp.setStatus(open ? 'UNLOCKED' : 'LOCKED', open ? 'off' : 'ok');
      kp.body.append(
        h('div.note', open ? `Ghosty may edit its own security and self-edit code until ${fmt.time(new Date(kernelUntil))}.` : 'Ghosty cannot change its login lock, permission rules or self-edit pipeline. Only you can unlock this, for a short time.'),
        open ? button('LOCK NOW', () => void setKernel(0), 'on') : button('UNLOCK FOR 15 MIN', () => confirm('Let Ghosty edit its protected kernel for 15 minutes?') && void setKernel(15), 'warn'),
      );
      P.big.textContent = ready ? `v${versions.length ? versions[0]!.sha.slice(0, 7) : '—'}` : 'OFFLINE';
      // route C: the version that is live, its id kept as it is
      P.big.dataset.case = 'keep';
      if (proLook()) P.big.textContent = ready ? (versions.length ? `Live · ${versions[0]!.sha.slice(0, 7)}` : 'Live') : 'Offline';
      P.dials([
        ['CHANGES', changes.length / 5, String(changes.length), '#ffd24d'],
        ['WIDGETS', widgets.length / 10, String(widgets.length), '#52f2b5'],
      ]);
    };
    const setKernel = async (minutes: number) => {
      kernelUntil = (await brain.kernel(minutes)).kernelUnlockedUntil;
      paint();
    };
    const load = async () => {
      try {
        // Each part on its own: one failing (e.g. the database paused) doesn't blank the others.
        const [c, w, s, p] = await Promise.allSettled([brain.changes(), brain.widgets(), brain.status(), brain.sites()]);
        if (p.status === 'fulfilled') {
          sites = p.value.sites;
          siteOrigin = p.value.origin;
          paintSites();
        }
        if (c.status === 'fulfilled') {
          ready = c.value.ready;
          changes = c.value.changes;
          versions = c.value.versions;
        }
        if (w.status === 'fulfilled') {
          const { saved, removed } = await syncLocalWidgets(w.value.widgets, { save: (x) => brain.saveWidget(x), remove: (n) => brain.deleteWidget(n) });
          // The list fetched above is out of date if anything was saved or deleted just now.
          widgets = saved || removed ? (await brain.widgets()).widgets : w.value.widgets;
          if (saved) toast(`Saved ${saved} widget${saved === 1 ? '' : 's'} kept on this device to Ghosty`, 'ok');
        }
        if (s.status === 'fulfilled') kernelUntil = s.value.kernelUnlockedUntil;
        const failed = [c, w, s].find((r): r is PromiseRejectedResult => r.status === 'rejected');
        if (failed && !isPaused(failed.reason)) toast(`Workshop: ${String((failed.reason as Error)?.message ?? failed.reason)}`, 'warn');
      } catch (e) {
        if (!isPaused(e)) toast(`Workshop: ${String((e as Error).message)}`, 'warn');
      }
      // Widgets kept on this device that the brain doesn't have yet (or a newer version of) show
      // too; deletions not yet carried out in the brain are hidden.
      widgets = mergeWidgets(widgets);
      paint();
    };
    paint();
    let timer = 0;
    let ptimer = 0;
    return {
      enter() {
        void load();
        void loadRoadmap();
        void loadIdeas();
        void paintTraining();
        void loadProjects();
        timer = window.setInterval(() => {
          void load();
          void loadRoadmap();
          void loadIdeas();
        }, 20000);
        // a running project moves every few minutes: a look every 15 s while one runs, once a minute otherwise (each look reads every listed project)
        let ticks = 0;
        ptimer = window.setInterval(() => {
          if (projects.some((p) => p.status === 'active') || ++ticks % 4 === 0) void loadProjects();
        }, 15000);
      },
      leave() {
        clearInterval(timer);
        clearInterval(ptimer);
      },
      describe: () => `Workshop: ${roadmap ? `upgrade roadmap "${roadmap.goal}" ${roadmap.steps.filter((s) => s.status === 'done').length}/${roadmap.steps.length} done; ` : ''}${projects.length ? `projects: ${projects.slice(0, 4).map((p) => `"${p.title}" ${p.status} ${p.steps.filter((s) => s.status === 'done').length}/${p.steps.length}`).join('; ')}; ` : ''}${ideas.length} upgrade ideas${ideas.length ? ` (${ideas.slice(0, 3).map((i) => i.title).join('; ')})` : ''}, ${changes.length} open changes (${changes.map((c) => `#${c.number} ${c.title} ${c.checks}`).join('; ')}), ${widgets.length} widgets, ${sites.length} published pages${sites.length ? ` (${sites.slice(0, 5).map((s) => `${s.title} at ${siteUrl(s.name)}`).join('; ')})` : ''}.`,
    };
  },
};
