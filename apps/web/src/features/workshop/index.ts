/**
 * WORKSHOP tab: where Ghosty changes itself.
 *  - Tell Ghosty what to build or change
 *  - Follow (and continue) Ghosty's upgrade roadmap for bigger self-upgrades
 *  - Review its proposed changes (preview link, build checks) and ship or discard them
 *  - Roll back to any earlier version
 *  - Open, or remove, instant widgets
 *  - Unlock the protected kernel for a limited time (only you can do this)
 */
import type { ChangeSummary, Roadmap, RoadmapStep, VersionSummary, Widget } from '../../../../../packages/shared/src/protocol';
import { brain } from '../../api/brain';
import { send } from '../../assistant/session';
import { clear, fmt, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { button, modal, panel, row, sandboxFrame, toast } from '../../ui/components';
import { page } from '../../ui/page';

const CHECK_LABEL: Record<ChangeSummary['checks'], string> = { passed: 'CHECKS OK', failed: 'CHECKS FAILED', pending: 'CHECKING…', none: 'WAITING FOR CHECKS' };
const PREVIEW_LABEL: Record<ChangeSummary['preview'], string> = { ok: 'preview ready', failed: 'preview build failed', pending: 'preview building…', none: 'no preview yet' };

export const workshopTab: TabDef = {
  id: 'workshop',
  title: 'WORKSHOP',
  icon: '<path d="M14.7 6.3a4 4 0 00-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 005.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  scene: 'backdrop',
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

    // changes
    const cp = panel('PROPOSED CHANGES', { status: '' });
    // versions
    const vp = panel('VERSIONS', { status: '' });
    // widgets
    const wp = panel('WIDGETS', { status: '' });
    // kernel
    const kp = panel('KERNEL LOCK', { grow: false });
    P.left.append(ask.el, rp.el, cp.el);
    P.right.append(wp.el, vp.el, kp.el);

    let changes: ChangeSummary[] = [];
    let versions: VersionSummary[] = [];
    let widgets: Widget[] = [];
    let ready = false;
    let kernelUntil = 0;

    const paint = () => {
      clear(cp.body);
      if (!ready) {
        cp.setStatus('NOT CONNECTED', 'off');
        cp.body.append(h('div.note', 'Self-editing needs GITHUB_REPO on the brain and a GitHub token in the System tab. See SETUP.md.'));
      } else {
        cp.setStatus(`${changes.length} OPEN`, changes.length ? 'mid' : 'ok');
        if (!changes.length) cp.body.append(h('div.note', 'No open changes. Ask Ghosty to build something.'));
        for (const c of changes) {
          const card = h(`div.change.${c.checks}` as 'div', h('div.ct', h('b', `#${c.number} ${c.title}`), h('small', `${CHECK_LABEL[c.checks]} · ${PREVIEW_LABEL[c.preview ?? 'none']} · ${fmt.ago(Date.parse(c.createdAt))}`)));
          const actions = h('div.row.wrap');
          if (c.previewUrl) actions.append(button('PREVIEW ↗', () => window.open(c.previewUrl!, '_blank', 'noopener')), h('small.note', 'view only — previews never ask for your password'));
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
            }, 'on'),
            button('ASK TO FIX', () => {
              go('core');
              void send(`Check change #${c.number} with change_status and fix anything that failed.`);
            }),
            button('DISCARD', async () => {
              await brain.discard(c.number).catch((e) => toast(String(e.message), 'bad'));
              void load();
            }, 'warn'),
            button('GITHUB ↗', () => window.open(c.url, '_blank', 'noopener')),
          );
          card.append(actions);
          cp.body.append(card);
        }
      }
      clear(vp.body);
      vp.setStatus(versions.length ? `${versions.length}` : '', 'ok');
      versions.slice(0, 10).forEach((v, i) => {
        const r = row(v.sha.slice(0, 7), v.message, i === 0 ? 'LIVE' : '↶', { wrap: true });
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
      if (!widgets.length) wp.body.append(h('div.note', 'No widgets yet. Try "make me a pomodoro timer widget".'));
      for (const w of widgets) {
        const r = row(fmt.ago(w.at), w.title, '✕');
        r.classList.add('link');
        (r.querySelector('.v') as HTMLElement).addEventListener('click', () => modal(w.title, sandboxFrame(w.html)));
        const x = r.lastChild as HTMLElement;
        x.classList.add('del');
        x.addEventListener('click', async () => {
          await brain.deleteWidget(w.name);
          void load();
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
        const [c, w, s] = await Promise.all([brain.changes(), brain.widgets(), brain.status()]);
        ready = c.ready;
        changes = c.changes;
        versions = c.versions;
        widgets = w.widgets;
        kernelUntil = s.kernelUnlockedUntil;
      } catch (e) {
        toast(`Workshop: ${String((e as Error).message)}`, 'warn');
      }
      paint();
    };
    paint();
    let timer = 0;
    return {
      enter() {
        void load();
        void loadRoadmap();
        timer = window.setInterval(() => {
          void load();
          void loadRoadmap();
        }, 20000);
      },
      leave() {
        clearInterval(timer);
      },
      describe: () => `Workshop: ${roadmap ? `upgrade roadmap "${roadmap.goal}" ${roadmap.steps.filter((s) => s.status === 'done').length}/${roadmap.steps.length} done; ` : ''}${changes.length} open changes (${changes.map((c) => `#${c.number} ${c.title} ${c.checks}`).join('; ')}), ${widgets.length} widgets.`,
    };
  },
};
