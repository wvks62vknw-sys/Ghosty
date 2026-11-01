/**
 * The 3D STUDIO's DESIGN A BUILD pane (BRIEF-REST-D 1b), the way CAR · FIX IT is one: the build drawn over the Studio's view
 * (build/scene.ts) with EXPLODE and ROOF; under it the build's name, the estimate line, its sizes as fields (a change redraws
 * every face), the parts by group — a tap on one lights it on the build, a tap on the build lights its lines here — and THE
 * PLAN, THE BILL, THE BUILD (the sheet, build/sheet.ts) and EXPORT. A concept shows its real parts and draws nothing. The
 * Studio (features/studio/index.ts) shows it for the `build` sample and the pane, and stops it when it is left. A test reads
 * and drives it through window.__ghosty.build.
 */
import { clear, h } from '../core/dom';
import { button } from '../ui/components';
import { BuildScene } from './scene';
import { buildNow, designNow, exposeBuild, paneHooks, setDesign } from './state';
import { applyChange, startFor } from './words';
import { BUILDINGS, FURNITURE, KIND_NAMES, type Design, type Kind } from './kits';
import { ESTIMATE, lowFirst, PRICE_LINE, pounds } from './prices';
import { totals } from './bom';

export interface BuildPane {
  el: HTMLElement;
  scene: BuildScene;
  enter(): Promise<void>;
  leave(): void;
}

/** A size field: metres, to the centimetre. */
function sizeField(label: string, value: number, onSet: (v: number) => void): HTMLElement {
  const input = h('input.buildsize', { type: 'number', inputMode: 'decimal', step: '0.05', min: '0.1', value: String(value), 'aria-label': `${label} in metres`, enterKeyHint: 'done' });
  input.addEventListener('change', () => {
    const v = Number(input.value);
    if (Number.isFinite(v) && v > 0) onSet(v);
  });
  return h('label.buildfield', h('span', label), input, h('small', 'm'));
}

export function buildPane(view: HTMLElement): BuildPane {
  const stage = h('div.buildstage');
  stage.hidden = true;
  view.append(stage);
  const scene = new BuildScene(stage);
  const name = h('b.buildname');
  const explode = button('EXPLODE', () => {
    scene.setExplode(!scene.exploded);
    paintHud();
  });
  explode.dataset.case = 'keep';
  const roof = button('ROOF OFF', () => {
    scene.setRoof(!scene.roof);
    paintHud();
  });
  roof.dataset.case = 'keep';
  const note = h('small.buildnote');
  stage.append(h('div.buildhud', name, h('div.buildchips', explode, roof)), note);

  const head = h('div.buildhead');
  const fields = h('div.buildfields');
  const list = h('div.buildlist', { role: 'list', 'aria-label': 'The parts of the build' });
  const acts = h('div.buildacts');
  const el = h('div.studiopane.buildpane', head, fields, list, acts);
  let on = false;
  let shown: Design | null = null;

  const paintHud = () => {
    explode.textContent = scene.exploded ? 'TOGETHER' : 'EXPLODE';
    explode.setAttribute('aria-label', scene.exploded ? 'Put the build back together' : 'Explode the build to see its frame');
    explode.setAttribute('aria-pressed', String(scene.exploded));
    const lid = shown?.kind === 'pc' ? 'SIDE' : shown?.kind === 'room' ? 'CEILING' : 'ROOF';
    roof.textContent = scene.roof ? `${lid} OFF` : `${lid} ON`;
    roof.setAttribute('aria-label', scene.roof ? `Take the ${lid.toLowerCase()} off` : `Put the ${lid.toLowerCase()} back`);
    roof.setAttribute('aria-pressed', String(!scene.roof));
  };

  const change = (c: Parameters<typeof applyChange>[1]) => {
    const p = buildNow.get().params;
    if (!p) return;
    setDesign(applyChange(p, c));
  };

  const paint = () => {
    const d = designNow();
    if (!d) {
      clear(head, h('h3.buildtitle', 'DESIGN A BUILD'), h('p.note', 'Pick one to start, or say it in the chat: “design me a shed three by two”.'));
      clear(fields, ...(['shed', 'gardenroom', 'garage', 'room', 'shelf', 'desk', 'bench', 'pc'] as Kind[]).map((k) => {
        const b = button(KIND_NAMES[k].toUpperCase(), () => setDesign(startFor(k)), 'buildkind');
        b.dataset.case = 'keep';
        b.dataset.kind = k;
        return b;
      }));
      clear(list);
      clear(acts);
      return;
    }
    const t = totals(d, buildNow.get().live);
    clear(head,
      h('h3.buildtitle', d.title),
      h('p.buildsum', d.summary),
      h('p.buildest', d.concept ? 'A concept with real parts, not a build plan.' : `${pounds(t.total)} · ${d.kind === 'pc' ? 'prices move weekly' : lowFirst(PRICE_LINE)}${t.liveLines ? ` · ${t.liveLines} priced live` : ''}`),
      h('p.buildcert', ESTIMATE),
    );
    const p = d.params;
    if (BUILDINGS.includes(d.kind) || FURNITURE.includes(d.kind)) {
      clear(fields,
        sizeField(d.kind === 'shelf' || FURNITURE.includes(d.kind) ? 'Width' : 'Width (front)', p.w, (v) => change({ w: v })),
        sizeField('Depth', p.d, (v) => change({ d: v })),
        sizeField(d.kind === 'shed' ? 'Height (front)' : 'Height', p.h, (v) => change({ h: v })),
      );
    } else if (d.kind === 'pc') {
      const budget = h('input.buildsize', { type: 'number', inputMode: 'numeric', step: '50', min: '300', value: String(p.budget), 'aria-label': 'Budget in pounds' });
      budget.addEventListener('change', () => Number(budget.value) > 0 && change({ budget: Number(budget.value) }));
      clear(fields, h('label.buildfield', h('span', 'Budget'), budget, h('small', '£')));
    } else clear(fields);
    // the parts by group: each lights its part on the build
    const lit = buildNow.get().lit;
    if (d.concept) {
      clear(list, ...(d.parts ?? []).map((x) => h('div.buildrow', { role: 'listitem' }, h('b', x.role), h('span', x.name), h('small', x.typical))));
    } else {
      clear(list, ...d.groups.filter((g) => d.lines.some((l) => l.group === g.id)).map((g) => {
        const ls = d.lines.filter((l) => l.group === g.id);
        const sum = t.byGroup.find((x) => x.group === g.id)?.total ?? 0;
        const b = button(h('span.buildrowin', h('b', g.name), h('small', `${ls.length} ${ls.length === 1 ? 'line' : 'lines'} · ${pounds(sum)}`)), () => {
          const on2 = buildNow.get().lit === g.id ? '' : g.id;
          buildNow.set({ lit: on2 });
          if (on2) scene.pick(on2);
          else scene.light('');
        }, 'buildrow');
        b.dataset.case = 'keep';
        b.dataset.group = g.id;
        b.setAttribute('role', 'listitem');
        b.setAttribute('aria-pressed', String(lit === g.id));
        b.setAttribute('aria-label', `${g.name}: ${ls.length} ${ls.length === 1 ? 'line' : 'lines'}, ${pounds(sum)}. Tap to light it on the build.`);
        b.classList.toggle('on', lit === g.id);
        const lines = lit === g.id ? h('div.buildlines', ...ls.map((l) => h('div.buildline', { dataset: { line: l.id } }, h('span', `${l.name}${l.size ? `, ${l.size}` : ''}`), h('small', `${l.n} ${l.unit}`)))) : null;
        return h('div.buildgroup', b, lines);
      }));
    }
    const sheetBtn = (label: string, side: 'plan' | 'bill' | 'build') => {
      const b = button(label, () => void import('./sheet').then((s) => s.openBuild({ side })), 'buildopen');
      b.dataset.case = 'keep';
      return b;
    };
    clear(acts, ...(d.concept ? [sheetBtn('THE PARTS', 'bill')] : [sheetBtn('THE PLAN', 'plan'), sheetBtn('THE BILL', 'bill'), sheetBtn('THE BUILD', 'build')]), (() => {
      const b = button('NEW', () => {
        buildNow.set({ params: null, lit: '' });
      });
      b.setAttribute('aria-label', 'Start a new design');
      return b;
    })());
  };

  scene.onPick = (group) => {
    if (buildNow.get().lit !== group) buildNow.set({ lit: group });
  };

  const draw = async () => {
    const d = designNow();
    name.textContent = d ? d.title : 'DESIGN A BUILD';
    note.textContent = d?.concept ? 'A concept with real parts, not a build plan: nothing is drawn.' : d ? `${ESTIMATE} · a person 1.75 m tall for scale` : '';
    if (!d || d === shown) return;
    if (!(await scene.init())) {
      note.textContent = scene.error;
      return;
    }
    shown = d;
    await scene.show(d);
    paintHud();
    if (buildNow.get().lit) scene.light(buildNow.get().lit);
  };

  let want = false;
  const enter = async () => {
    want = true;
    on = true;
    stage.hidden = false;
    paint();
    await draw();
    if (want) scene.start();
  };
  const leave = () => {
    want = false;
    on = false;
    stage.hidden = true;
    scene.stop();
  };
  buildNow.subscribe((s, prev) => {
    if (s.params !== prev.params || s.lit !== prev.lit || s.live !== prev.live) paint();
    if (on && s.params !== prev.params) void draw();
    if (on && s.lit !== prev.lit && s.lit !== scene.lit) scene.light(s.lit);
  });

  paneHooks.state = () => ({ ...scene.state(), on });
  exposeBuild();
  paneHooks.screenOf = (group) => scene.screenOf(group);
  paneHooks.explode = (v) => (scene.setExplode(v), paintHud());
  paneHooks.roof = (v) => (scene.setRoof(v), paintHud());
  return { el, scene, enter, leave };
}
