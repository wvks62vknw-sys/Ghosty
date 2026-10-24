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
import { brain, isPaused, lastSeen } from '../../api/brain';
import { send } from '../../assistant/session';
import { clear, fmt, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { bar, button, confirmSheet, empty, modal, panel, pill, progressRing, row, sandboxFrame, toast, undo, type Light } from '../../ui/components';
import { page } from '../../ui/page';
import { forgetWidget, keepWidget, mergeWidgets, syncLocalWidgets } from '../../state/widgets';
import { failureReport, runTests } from '../../training/runner';
import { WHATS_NEW, whatsNewDue, whatsNewSeen } from '../../state/whatsnew';
import { draftCard } from './draftcard';

const CHECK_LABEL: Record<ChangeSummary['checks'], string> = { passed: 'CHECKS OK', failed: 'CHECKS FAILED', pending: 'CHECKING…', none: 'WAITING FOR CHECKS' };
/** No connection (the phone offline, or the brain out of reach): fetch's own TypeError, or the phone says so. */
const unreachable = (e: unknown) => e instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
/** Why something did not happen, in plain words (never "Failed to fetch"). */
const why = (e: unknown) => (unreachable(e) ? 'you’re offline, or Ghosty can’t be reached. Try again when you’re back online' : String((e as Error)?.message ?? e));
/** A project and its steps in plain words (the brain's own names are active / todo / doing / failed). */
const PROJECT_WORD: Record<Project['status'], string> = { active: 'RUNNING', paused: 'PAUSED', done: 'FINISHED', cancelled: 'CANCELLED' };
const STEP_WORD: Record<ProjectStep['status'], string> = { done: 'DONE', doing: 'NOW', todo: 'TO DO', failed: 'DIDN’T WORK' };
/** Why a step went wrong, said plainly when it is a common one. */
const plainWhy = (m: string) => (/\b429\b|rate.?limit|quota|too many requests/i.test(m) ? 'the free AI was busy' : /time(d)? ?out|took too long/i.test(m) ? 'it took too long' : m);
/** The brain's note on a project (projects.ts), in plain words: what happened, what happens next, then why. */
function projectNote(p: Pick<Project, 'note' | 'status'>): string {
  const n = p.note ?? '';
  const failed = n.match(/^step (\d+) failed \((\d+) of (\d+)\): ([\s\S]*)$/);
  if (failed) return p.status === 'paused' ? `Step ${failed[1]} didn’t work ${failed[3]} times, so Ghosty paused it. RESUME tries it again. Why: ${plainWhy(failed[4]!)}` : `Step ${failed[1]} didn’t work (try ${failed[2]} of ${failed[3]}): Ghosty tries again by itself in a few minutes. Why: ${plainWhy(failed[4]!)}`;
  if (/^waiting for a free model/.test(n)) return 'Waiting for a free AI: Ghosty carries on by itself as soon as one is free.';
  return n;
}
/** What RUN NEXT NOW did, in plain words. */
const RUN_SAID: Record<string, string> = {
  step: 'Step done',
  done: 'Step done: the project is finished',
  waiting: 'Waiting: no AI is free right now (or Ghosty is busy); it tries again by itself',
  retry: 'That step didn’t work: Ghosty tries it again by itself in a few minutes',
  paused: 'That step didn’t work again, so the project is paused: RESUME tries again',
  nothing: 'Nothing to run: this project isn’t running',
};
/**
 * A version's line in plain words: GitHub's "Merge pull request #40 from owner/ghosty/brief-icons" is
 * "Brief icons · change #40"; a roll-back says so; anything else as it was written.
 */
function versionWords(m: string): string {
  const merge = m.match(/^Merge pull request #(\d+) from \S*?([^/\s]+)$/);
  if (merge) {
    const what = merge[2]!.replace(/[-_]+/g, ' ').trim();
    return `${what.charAt(0).toUpperCase()}${what.slice(1)} · change #${merge[1]}`;
  }
  const back = m.match(/^Restore Ghosty to [0-9a-f]{7,} \((.*)\)$/);
  return back ? `Rolled back to: ${versionWords(back[1]!)}` : m;
}
const SUB = 'Ghosty changes its own code. You decide what goes live.';
const PREVIEW_LABEL: Record<ChangeSummary['preview'], string> = { ok: 'preview ready', failed: 'preview didn’t build', pending: 'preview on its way', none: 'no preview yet' };
/** What a change's checks mean, and what to do next, in one plain sentence. */
const CHECK_SAYS: Record<ChangeSummary['checks'], string> = {
  passed: 'Checks passed: Ghosty built it and its tests all pass. Ready to ship.',
  failed: 'A check failed: something in it doesn’t work yet. Tap Ask to fix and Ghosty mends it.',
  pending: 'Ghosty is checking it: building it and running its tests, a few minutes.',
  none: 'Not checked yet: the checks start in a minute or two.',
};

export const workshopTab: TabDef = {
  id: 'workshop',
  title: 'WORKSHOP',
  icon: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  scene: 'backdrop',
  blurb: 'self-edits · training ground · widgets',
  now() {
    const st = lastSeen.get().status;
    return st ? `Self-edit ${st.repoReady ? 'on' : 'off'}` : '';
  },
  primary: true,
  mount(root) {
    const P = page(root, { tag: 'WORKSHOP // SELF-EVOLUTION', sub: SUB, rightLabel: 'PAGES & WIDGETS', leftLabel: 'BUILD' });

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
    /** CLEARed with the UNDO bar still up: not shown, not yet dropped by the brain. */
    let roadmapGoing = false;
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
      // CLEAR: off the screen with UNDO; the brain drops the roadmap only when the bar goes
      rp.foot!.append(button('CLEAR', () => {
        const was = roadmap;
        roadmapGoing = true;
        roadmap = null;
        paintRoadmap();
        undo(
          'Roadmap cleared',
          () => {
            roadmapGoing = false;
            roadmap = was;
            paintRoadmap();
          },
          async () => {
            await brain.clearRoadmap().catch(() => toast('Could not clear the roadmap', 'bad'));
            roadmapGoing = false;
            void loadRoadmap();
          },
        );
      }));
    };
    const loadRoadmap = async () => {
      try {
        const r = (await brain.roadmap()).roadmap;
        if (!roadmapGoing) roadmap = r;
      } catch {
        /* the rest of the Workshop reports connection problems */
      }
      paintRoadmap();
    };
    paintRoadmap();

    // projects that run for days (projects.ts): one step every few minutes on Ghosty's own schedule
    const jp = panel('PROJECTS', { status: '' });
    let projects: Project[] = [];
    /** The list has answered at least once (until then the panel says Loading, not "Nothing running"). */
    let projectsKnown = false;
    /** Each website's DRAFT card, kept between repaints (the list repaints every 15 s while a project runs). */
    const draftCards = new Map<string, HTMLElement>();
    /** Finished projects whose steps the owner opened (a finished one shows folded: what it made first, then SHOW STEPS). */
    const unfolded = new Set<string>();
    const PSTEP_TONE: Record<ProjectStep['status'], 'up' | 'bad' | undefined> = { done: 'up', failed: 'bad', doing: undefined, todo: undefined };
    const PROJECT_LIGHT: Record<Project['status'], Light> = { active: 'ok', paused: 'mid', done: 'ok', cancelled: 'off' };
    const act = (id: string, action: 'pause' | 'resume' | 'cancel' | 'run', ask?: string) => async (b: HTMLButtonElement) => {
      if (ask && !(await confirmSheet('Cancel this project?', ask, 'CANCEL IT'))) return;
      b.disabled = true;
      try {
        const r = await brain.projectAction(id, action);
        projects = projects.map((p) => (p.id === id ? r.project : p));
        if (action === 'run') toast(RUN_SAID[r.did] ?? 'Step not finished: Ghosty tries again by itself', r.did === 'step' || r.did === 'done' ? 'ok' : 'warn');
      } catch (e) {
        toast(`Could not ${action}: ${why(e)}`, 'bad');
      }
      paintProjects();
      void loadProjects();
    };
    const paintProjects = () => {
      clear(jp.body);
      const running = projects.filter((p) => p.status === 'active').length;
      jp.setStatus(projects.length ? (running ? `${running} RUNNING` : `${projects.length}`) : '', running ? 'ok' : projects.some((p) => p.status === 'paused') ? 'mid' : 'ok');
      if (!projects.length) {
        jp.body.append(projectsKnown ? empty('NONE', 'Ask Ghosty for something that takes days — “research the options over the next few days, then build it” — and it works through a plan step by step on its own, a step every few minutes, without burning through a day’s free models.', 'Nothing running') : empty('LOADING'));
        return;
      }
      for (const p of projects) {
        const done = p.steps.filter((s) => s.status === 'done').length;
        // a mini-app (build_app) runs its five steps in one go; anything else at its pace
        const pace = p.kind === 'app' ? 'a mini-app, built in one go' : p.pace === 'fast' ? 'a step every 3 min' : 'a step every 20 min';
        const ct = h('div.ct', h('b', p.title), h('small', `${PROJECT_WORD[p.status]} · ${pace} · ${fmt.ago(p.updated)}`));
        // the live step: the one running, else the next one
        const now = p.status === 'active' ? (p.steps.find((s) => s.status === 'doing') ?? p.steps.find((s) => s.status === 'todo')) : undefined;
        if (now) ct.append(h('small.pnow', `NOW: step ${now.n} · ${now.title}`));
        const finished = p.status === 'done' || p.status === 'cancelled';
        // paused is waiting for the owner, not broken: its own amber edge
        const card = h(`div.change.project${p.status === 'done' ? '.passed' : p.status === 'paused' ? '.paused' : ''}` as 'div', ct);
        // route C: a progress ring with the steps done, beside the title
        const ring = progressRing(46);
        ring.set(done / Math.max(1, p.steps.length), 0, `${done}/${p.steps.length}`, p.status === 'done');
        ring.el.classList.add('projring');
        card.prepend(ring.el);
        card.append(bar('STEPS', done / Math.max(1, p.steps.length), `${done}/${p.steps.length}`, p.status === 'paused' ? '#ffd24d' : undefined));
        for (const s of p.steps) {
          const r = row(`${s.n}`, s.title, STEP_WORD[s.status], { wrap: true, tone: PSTEP_TONE[s.status] });
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
        if (p.note) card.append(h('small.note', projectNote(p)));
        // a finished mini-app: its report (the link, what it does and saves, INSTALL, UNDO) on the card itself — the
        // link and how to install it first, the rest (and the steps) behind SHOW DETAILS; tool names left out
        const report = p.kind === 'app' && p.status === 'done' ? p.steps[p.steps.length - 1]?.result?.replace(/\s*\((?:[a-z0-9]+_)+[a-z0-9]+\)/g, '') : undefined;
        const lines = report?.split(/\n+/) ?? [];
        if (report) card.append(h('div.preport', ...lines.map((line) => h('p', line))));
        // A website that reached its draft (or went live): the DRAFT card, as a phone and a laptop, with CHANGE.
        if (p.kind === 'site' && p.steps.some((s) => s.n >= 5 && s.status === 'done')) card.append(draftCards.get(p.id) ?? draftCards.set(p.id, draftCard(p.id)).get(p.id)!);
        const actions = h('div.row.wrap');
        const link = p.link;
        if (report && link) {
          actions.append(
            button('OPEN', () => void window.open(link, '_blank', 'noopener'), 'on'),
            button('COPY LINK', async () => {
              try {
                await navigator.clipboard.writeText(link);
                toast('Link copied: paste it into Safari to install', 'ok');
              } catch {
                toast(link, 'ok');
              }
            }),
            button('UNDO', async (b) => {
              if (!(await confirmSheet('Take it down?', `“${p.title.replace(/^App: /, '')}” comes off the web: its link stops working for everyone, for good. Ghosty can build it again, at a new link.`, 'TAKE IT DOWN'))) return;
              b.disabled = true;
              try {
                await brain.unpublishSite(link.replace(/\/$/, '').split('/').pop()!);
                toast('Taken down: the link no longer works', 'ok');
                void load();
              } catch (e) {
                b.disabled = false;
                toast(`Could not take it down: ${why(e)}`, 'warn');
              }
            }, 'warn'),
          );
        }
        if (finished) {
          const open = unfolded.has(p.id);
          card.classList.toggle('folded', !open);
          actions.append(button(open ? 'HIDE DETAILS' : report ? 'SHOW DETAILS' : `SHOW ${p.steps.length} STEPS`, () => {
            if (!unfolded.delete(p.id)) unfolded.add(p.id);
            paintProjects();
          }, 'fold'));
          // what it made, then the buttons, before the steps: the link and how to install it, not five DONE rows
          const lead = h('div.plead', ...lines.filter((l, i) => i === 0 || /^INSTALL:/.test(l)).map((line) => h('p', line)));
          if (lead.childElementCount) ct.after(lead);
          (lead.childElementCount ? lead : ct).after(actions);
        }
        if (p.status === 'active') actions.append(button('PAUSE', act(p.id, 'pause')), button('RUN NEXT NOW', act(p.id, 'run'), 'on'));
        if (p.status === 'paused') actions.append(button('RESUME', act(p.id, 'resume'), 'on'), button('RUN NEXT NOW', act(p.id, 'run')));
        if (p.status === 'active' || p.status === 'paused') actions.append(button('CANCEL', act(p.id, 'cancel', `“${p.title}” stops for good: it cannot be started again (ask Ghosty for it afresh). What it already produced stays in the library.`), 'warn'));
        if (actions.childElementCount && !finished) card.append(actions);
        jp.body.append(card);
      }
    };
    const loadProjects = async () => {
      try {
        projects = (await brain.projects()).projects;
        projectsKnown = true;
      } catch {
        /* paused or offline: the last list stays */
      }
      paintProjects();
    };
    paintProjects();
    // upgrade ideas (the brain's upgrades.ts): proposed every morning; BUILD hands one to the chat, DISMISS drops it
    const ip = panel('UPGRADE IDEAS', { footer: true, status: '' });
    let ideas: UpgradeIdea[] = [];
    /** Dismissed with the UNDO bar still up. */
    const ideasGoing = new Set<string>();
    let ideasNext: number | null = null;
    const nextNote = h('span.note', '');
    const buildIdea = (i: UpgradeIdea) => {
      go('core');
      void send(`Build this upgrade: ${i.title}. ${i.why ? `${i.why.replace(/[.\s]+$/, '')}. ` : ''}Steps: ${i.steps.map((s, n) => `${n + 1}. ${s.replace(/[.\s]+$/, '')}`).join('. ')}.`);
    };
    const paintIdeas = () => {
      const shown = ideas.filter((x) => !ideasGoing.has(x.id));
      clear(ip.body);
      ip.setStatus(shown.length ? `${shown.length}` : 'NONE YET', shown.length ? 'ok' : 'off');
      nextNote.textContent = ideasNext ? `next look ${new Date(ideasNext).toLocaleDateString([], { weekday: 'short' })} ${fmt.time(new Date(ideasNext))}` : 'every morning';
      if (!shown.length) ip.body.append(empty('NONE', 'Every morning Ghosty looks at what you asked, what it could not answer and what went wrong, and proposes upgrades it can build for itself. THINK NOW asks him now.', 'No ideas yet'));
      for (const i of shown) {
        const card = h('div.idea', h('b', i.title), i.why ? h('div.note', i.why) : null, h('ol', ...i.steps.map((s) => h('li', s))));
        card.append(
          // DISMISS: off the list with UNDO; the brain drops it only when the bar goes
          h('div.row', button('BUILD', () => buildIdea(i), 'on'), button('DISMISS', () => {
            ideasGoing.add(i.id);
            paintIdeas();
            undo(
              `Dismissed: ${i.title}`,
              () => {
                ideasGoing.delete(i.id);
                paintIdeas();
              },
              async () => {
                try {
                  await brain.dismissUpgrade(i.id);
                  ideas = ideas.filter((x) => x.id !== i.id);
                } catch (e) {
                  if (!isPaused(e)) toast(`Could not dismiss it: ${why(e)}`, 'warn');
                }
                ideasGoing.delete(i.id);
                paintIdeas();
              },
            );
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
          if (!isPaused(e)) toast(`Could not think about upgrades: ${why(e)}`, 'warn');
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
    // what he made first (his pages and apps, his widgets), then the versions; the coding practice and the lock last
    P.right.append(pp.el, wp.el, vp.el, tp.el, kp.el);

    let changes: ChangeSummary[] = [];
    let versions: VersionSummary[] = [];
    let widgets: Widget[] = [];
    let sites: PublishedSite[] = [];
    /** Each list has answered at least once: until then it says Loading, never "nothing yet". */
    let sitesKnown = false;
    let widgetsKnown = false;
    let siteOrigin = '';
    const siteUrl = (name: string) => `${siteOrigin || location.origin}/s/${name}`;
    const paintSites = () => {
      clear(pp.body);
      pp.setStatus(sites.length ? `${sites.length} LIVE` : '', 'ok');
      if (!sites.length) {
        pp.body.append(!sitesKnown ? empty('LOADING') : empty('NONE', 'Ask Ghosty to “make me a website for…” or to rebuild one from a link: it goes live at a public link here.', 'Nothing published yet'));
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
        // Cannot be put back (the page is gone from the web): a one-tap confirm that says so.
        const down = button('UNPUBLISH', async () => {
          if (!(await confirmSheet('Take this page down?', `“${s.title}” comes off the web: ${siteUrl(s.name).replace(/^https?:\/\//, '')} stops working for everyone, for good. Ghosty can publish it again, but anyone with the old link will find nothing.`, 'TAKE IT DOWN'))) return;
          try {
            await brain.unpublishSite(s.name);
            sites = sites.filter((x) => x.name !== s.name);
            toast(`${s.title} taken down`, 'ok');
            paintSites();
          } catch (e) {
            toast(`Could not take it down: ${why(e)}`, 'warn');
          }
        }, 'warn');
        pp.body.append(h('div.site', open, h('div.keyrow', copy, down)));
      }
    };
    /** Self-editing set up on the brain (GitHub): null until the change list first answers. */
    let ready: boolean | null = null;
    let kernelUntil = 0;
    /** The last look found no connection: the lists are what was here before, and the hero says so (no toasts). */
    let offline = false;
    /** The last problem told in a toast: the same one is not told again every 20 s. */
    let toldErr = '';

    const paint = () => {
      clear(cp.body);
      if (ready === null) {
        cp.setStatus('', 'off');
        cp.body.append(empty('LOADING'));
      } else if (!ready) {
        // not set up: said plainly, with the one place to set it up (LINKS → GITHUB · SELF-EDIT takes the key)
        cp.setStatus('OFF', 'mid');
        cp.body.append(h('div.note.rcwarn', 'Self-editing is off, so Ghosty can’t change its own code yet. Projects, apps, widgets and pages all work without it.'), h('div.row', button('SET IT UP', () => go('links'), 'on')));
      } else {
        cp.setStatus(`${changes.length} OPEN`, changes.length ? 'mid' : 'ok');
        if (!changes.length) cp.body.append(empty('NONE', 'Ask Ghosty to build something: what he changes waits here for you to SHIP IT.', 'No open changes'));
        for (const c of changes) {
          const meta = h('small', `${CHECK_LABEL[c.checks]} · ${PREVIEW_LABEL[c.preview ?? 'none']} · ${fmt.ago(Date.parse(c.createdAt))}`);
          // route C: the checks as a pill, the rest of the line in words
          meta.dataset.label = `${PREVIEW_LABEL[c.preview ?? 'none'].replace(/^./, (x) => x.toUpperCase())} · ${fmt.ago(Date.parse(c.createdAt))}`;
          const checks = pill(c.checks === 'passed' ? 'Checks passed' : c.checks === 'failed' ? 'Checks failed' : c.checks === 'pending' ? 'Checking' : 'No checks yet', c.checks === 'passed' ? 'live' : c.checks === 'failed' ? 'warn' : 'idle', 'chk');
          const card = h(`div.change.${c.checks}` as 'div', h('div.ct', h('b', `#${c.number} ${c.title}`), checks, meta), h('small.chksays', CHECK_SAYS[c.checks]));
          const actions = h('div.row.wrap');
          if (c.previewUrl) actions.append(button('PREVIEW ↗', () => window.open(c.previewUrl!, '_blank', 'noopener'), 'prev'), h('small.note.prevnote', 'view only — previews never ask for your password'));
          actions.append(
            button('SHIP IT', async (b) => {
              // SHIP IT's own confirm, before checks have passed: the in-app sheet, in plain words
              if (c.checks === 'failed' && !(await confirmSheet('Ship it with failed checks?', `Ghosty’s own checks found a problem in change #${c.number}, so shipping it could break Ghosty. Ask to fix lets Ghosty mend it first.`, 'SHIP ANYWAY'))) return;
              if ((c.checks === 'pending' || c.checks === 'none') && !(await confirmSheet('Ship before the checks finish?', `Ghosty is still checking change #${c.number}. Shipping now goes live without knowing whether it works.`, 'SHIP NOW'))) return;
              b.disabled = true;
              try {
                toast((await brain.ship(c.number, c.sha)).result, 'ok');
              } catch (e) {
                toast(`Not shipped: ${why(e)}`, 'bad');
              }
              void load();
            }, 'on ship'),
            // a failed check: mending it is the one big button, SHIP IT steps back
            button('ASK TO FIX', () => {
              go('core');
              void send(`Check change #${c.number} with change_status and fix anything that failed.`);
            }, c.checks === 'failed' ? 'on fixit' : 'quiet'),
            button('DISCARD', async () => {
              if (!(await confirmSheet('Discard this change?', `Change #${c.number} “${c.title}” is closed and never shipped. To have it again, ask Ghosty to build it afresh.`, 'DISCARD'))) return;
              await brain.discard(c.number).catch((e) => toast(`Not discarded: ${why(e)}`, 'bad'));
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
        const said = versionWords(v.message);
        const r = row(v.sha.slice(0, 7), said, i === 0 ? 'LIVE' : '↶', { wrap: true });
        (r.querySelector('.k') as HTMLElement).dataset.case = 'keep';
        r.classList.add(i === 0 ? 'live' : 'old');
        if (i > 0) (r.lastChild as HTMLElement).setAttribute('aria-label', `Restore "${said}"`);
        if (i > 0) {
          const back = r.lastChild as HTMLElement;
          back.classList.add('del');
          back.title = 'Restore this version';
          back.addEventListener('click', async () => {
            if (!(await confirmSheet('Roll Ghosty back?', `Ghosty goes back to “${said}”. It becomes a new version, so you can roll forward again the same way.`, 'ROLL BACK'))) return;
            try {
              toast((await brain.restore(v.sha)).result, 'ok');
            } catch (e) {
              toast(`Not rolled back: ${why(e)}`, 'bad');
            }
            void load();
          });
        }
        vp.body.append(r);
      });
      clear(wp.body);
      wp.setStatus(`${widgets.length}`, 'ok');
      if (!widgets.length) wp.body.append(!widgetsKnown ? empty('LOADING') : empty('NONE', 'Try “make me a pomodoro timer widget”: it installs here at once.', 'No widgets yet'));
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
            if (!isPaused(e)) toast(`Could not delete it from Ghosty: ${why(e)}`, 'warn');
          }
          widgets = widgets.filter((x) => x.name !== w.name);
          paint();
          // UNDO saves the very same widget back (kept on this phone too, sent to the brain later if it is paused)
          undo(`Deleted: ${w.title}`, async () => {
            const saved = await brain.saveWidget(w).then(() => true, () => false);
            keepWidget(w, saved);
            widgets = mergeWidgets([w, ...widgets.filter((x) => x.name !== w.name)]);
            paint();
            toast(`Back: ${w.title}`, 'ok');
          });
        });
        wp.body.append(r);
      }
      clear(kp.body);
      const open = kernelUntil > Date.now();
      kp.setStatus(open ? 'UNLOCKED' : 'LOCKED', open ? 'off' : 'ok');
      kp.body.append(
        h('div.note', open ? `Ghosty may edit its own security and self-edit code until ${fmt.time(new Date(kernelUntil))}.` : 'Ghosty cannot change its login lock, permission rules or self-edit pipeline. Only you can unlock this, for a short time.'),
        open ? button('LOCK NOW', () => void setKernel(0), 'on') : button('UNLOCK FOR 15 MIN', async () => {
          if (await confirmSheet('Unlock for 15 minutes?', 'For 15 minutes Ghosty may change its own login lock, permission rules and self-edit pipeline. It locks again by itself after that, or when you tap LOCK NOW.', 'UNLOCK')) void setKernel(15);
        }, 'warn'),
      );
      // route C: the version that is live, its id kept as it is
      P.big.dataset.case = 'keep';
      P.sub.textContent = offline ? 'You’re offline: this is what was here before. It updates by itself when you’re back.' : SUB;
      P.big.textContent = offline ? 'Offline' : ready === null ? 'Checking…' : ready ? (versions.length ? `Live · ${versions[0]!.sha.slice(0, 7)}` : 'Live') : 'Code edits off';
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
      // Each part on its own, painted as soon as it answers: the change list (GitHub: several requests in a row)
      // no longer holds up the widgets, the published pages and the lock, and one failing (e.g. the database
      // paused) doesn't blank the others.
      const parts = await Promise.allSettled([
        brain.changes().then((c) => {
          ready = c.ready;
          changes = c.changes;
          versions = c.versions;
          paint();
        }),
        brain.widgets().then(async (w) => {
          const { saved, removed } = await syncLocalWidgets(w.widgets, { save: (x) => brain.saveWidget(x), remove: (n) => brain.deleteWidget(n) });
          // The list fetched above is out of date if anything was saved or deleted just now.
          widgets = saved || removed ? (await brain.widgets()).widgets : w.widgets;
          widgetsKnown = true;
          if (saved) toast(`Saved ${saved} widget${saved === 1 ? '' : 's'} kept on this device to Ghosty`, 'ok');
        }).finally(() => {
          // Widgets kept on this device that the brain doesn't have yet (or a newer version of) show
          // too; deletions not yet carried out in the brain are hidden.
          widgets = mergeWidgets(widgets);
          paint();
        }),
        brain.status().then((st) => {
          kernelUntil = st.kernelUnlockedUntil;
          paint();
        }),
        brain.sites().then((p) => {
          sites = p.sites;
          siteOrigin = p.origin;
          sitesKnown = true;
          paintSites();
        }),
      ]);
      const failed = parts.slice(0, 3).find((r): r is PromiseRejectedResult => r.status === 'rejected');
      // No connection: said once, on the page itself; anything else in a toast, once until it changes.
      const wasOffline = offline;
      offline = !!failed && unreachable(failed.reason);
      if (offline !== wasOffline) paint();
      const err = failed && !offline && !isPaused(failed.reason) ? String((failed.reason as Error)?.message ?? failed.reason) : '';
      if (err && err !== toldErr) toast(`Workshop: ${err}`, 'warn');
      toldErr = err;
    };
    paint();
    paintSites();
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
