/**
 * THE WORKBENCH tab (OWNER-ISSUES 61b; MAKE area): engineering first estimates on the phone, by the in-house solvers
 * (packages/shared/src/workbench) — no model, no fetch. Sections (ui/sections.ts): STRUCTURE (BEAM, COLUMN) · DRIVE (GEARS,
 * ENGINE) · FLIGHT (WING & CAR, PROJECTILE, ORBIT) · HOME (HEAT, SUN & SHADOW, CIRCUIT). Each panel is a compact form in his
 * units (settings.units) with sensible defaults; a change answers at once (no button) on the card below it, which always
 * carries FIRST ESTIMATE · NOT CERTIFIED (features/workbench/card.ts). Nothing goes to the brain; the last inputs of every
 * panel are kept on this phone (`ghosty.workbench`) so a reload keeps his problem.
 *
 * The chat reaches it with no model (assistant/local.ts → `openWorkbench`): "beam calculator" opens BEAM; "3 m steel beam 5 kN
 * in the middle" fills BEAM from his words and answers with the estimate. Not the Workshop (Ghosty editing himself).
 */
import { estimateSpoken, fromSI, num, parseQuantity, solve, type Estimate, type Panel, type Problem, type UnitSystem } from '../../../../../packages/shared/src/workbench';
import { clear, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { home, settings } from '../../state/app';
import { panel as mkPanel } from '../../ui/components';
import { page } from '../../ui/page';
import { revealPanel, sections } from '../../ui/sections';
import { estimateCard } from './card';
import { modeFor, PANELS, type Field, type Mode, type PanelSpec, type Values } from './panels';

const KEY = 'ghosty.workbench';

interface PanelState {
  mode: string;
  v: Values;
}
interface Saved {
  panels: Record<string, PanelState>;
  /** The panel he last changed. */
  last?: string;
}

function load(): Saved {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Saved>;
    return { panels: s.panels && typeof s.panels === 'object' ? s.panels : {}, last: typeof s.last === 'string' ? s.last : undefined };
  } catch {
    return { panels: {} };
  }
}
function save(s: Saved): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage unavailable: kept for this visit only */
  }
}

/** The panel he last used, for the hub card ("Beam"), or null. */
export function lastPanel(): string | null {
  const id = load().last;
  const t = PANELS.find((p) => p.id === id)?.title;
  return t ? `${t.charAt(0)}${t.slice(1).toLowerCase()}` : null;
}

/** What the screen shows, for the specs (window.__ghosty.workbench) and describe(). */
export const workbenchState = {
  ready: false,
  /** The panel last changed or opened. */
  panel: '' as string,
  units: 'metric' as UnitSystem,
  /** The estimate on each panel's card. */
  estimates: {} as Record<string, Estimate>,
  /** Each panel's mode and values (SI). */
  values: {} as Record<string, PanelState>,
};

let api: { fill(panel: Panel | '', problem: Problem | null): Estimate | null } | null = null;

/**
 * From the chat: the Workbench opened on `panel` and, with a problem from his words, its form filled from them; the estimate
 * the card then shows (null when it only opened).
 */
export function openWorkbench(panel: Panel | '', problem: Problem | null): Estimate | null {
  if (!go(panel ? `workbench?${panel}` : 'workbench')) return null;
  return api?.fill(panel, problem) ?? null;
}

const ctx = () => {
  const hm = home();
  return { home: { lat: hm.lat, lon: hm.lon, name: hm.name || 'home' } };
};
const units = (): UnitSystem => (settings.get().units === 'imperial' ? 'imperial' : 'metric');

/** A problem's inputs as a panel's values (the section's sizes, the teeth as text, the layers as words…). */
function valuesFrom(p: Problem): Values {
  const out: Values = {};
  for (const [k, x] of Object.entries(p.inputs)) {
    if (k === 'section' && x && typeof x === 'object') Object.assign(out, x);
    else if (k === 'stages' && Array.isArray(x)) out.teeth = (x as { kind?: string; driver: number; driven: number }[]).map((s) => (s.kind === 'ratio' ? `${s.driven}:1` : `${s.driver}:${s.driven}`)).join(', ');
    else if (k === 'layers' && Array.isArray(x)) out.layers = (x as { mat: string; thickness: number }[]).map((l) => `${l.mat} ${Math.round(l.thickness * 1000)}`).join(', ');
    else if (k === 'rs' && Array.isArray(x)) out.rs = (x as number[]).join(', ');
    else if (k === 'date' && typeof x === 'string') out.date = `${new Date().getFullYear()}-${x}`;
    else if (k === 'time' && typeof x === 'string') out.time = x === 'noon' ? '12:00' : x;
    else if (k === 'tariff' && typeof x === 'number') out.tariff = x * 100;
    else if (k !== 'mode') out[k] = x;
  }
  return out;
}

/** A field's value as the form shows it in his units ('' for an empty one). */
function shown(f: Field, x: unknown, sys: UnitSystem): string {
  if (f.type === 'check') return '';
  if (f.type !== 'num') return typeof x === 'string' ? x : '';
  if (typeof x !== 'number' || !Number.isFinite(x)) return '';
  if (!f.q || !f.unit) return num(x, 4).replace(/,/g, '');
  return num(fromSI(x, f.unit[sys === 'metric' ? 0 : 1], f.q), 4).replace(/,/g, '');
}

/** What he typed, read: a number in SI (with or without its unit), or undefined for an empty field; null when it cannot be read. */
function read(f: Field, text: string, sys: UnitSystem): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  if (!f.q || !f.unit) {
    const n = Number(t.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return parseQuantity(t, f.q, f.unit[sys === 'metric' ? 0 : 1])?.si ?? null;
}

interface Mounted {
  spec: PanelSpec;
  el: HTMLElement;
  render(): void;
  /** Worked out again from its values (in his units now) and shown. */
  estimate(): Estimate;
}

export const workbenchTab: TabDef = {
  id: 'workbench',
  title: 'Workbench',
  icon: '<path d="M3 20h18M5 20V9h14v11"/><path d="M8 9V5h8v4M9 13h6M9 16h6"/>',
  scene: 'backdrop',
  blurb: 'beams · gears · engines · flight · heat · sun · circuits',
  now() {
    const t = lastPanel();
    return t ? `Last: ${t}` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'WORKBENCH', sub: 'Engineering first estimates · never certified', leftLabel: 'STRUCTURE', rightLabel: 'FLIGHT & HOME', stack: true });
    const saved = load();
    workbenchState.units = units();
    const mounted: Mounted[] = [];

    const paintHero = (e: Estimate | undefined) => {
      const first = e && !e.problem ? e.lines[0] : undefined;
      P.big.textContent = first ? first.value : 'First estimates';
      P.sub.textContent = e ? `${e.title}${first ? ` · ${first.label.toLowerCase()}` : ''} · first estimate, not certified` : 'Engineering first estimates · never certified';
    };

    const mountPanel = (spec: PanelSpec): Mounted => {
      const pn = mkPanel(spec.title, { cls: `wb.wb-${spec.id}`, grow: false });
      const st: PanelState = saved.panels[spec.id] && spec.modes.some((m) => m.id === saved.panels[spec.id]!.mode) ? saved.panels[spec.id]! : { mode: spec.modes[0]!.id, v: { ...spec.modes[0]!.defaults } };
      workbenchState.values[spec.id] = st;
      const modeOf = (): Mode => spec.modes.find((m) => m.id === st.mode) ?? spec.modes[0]!;
      const modes = spec.modes.length > 1 ? h('div.wbmodes', { role: 'tablist', 'aria-label': `${spec.title} kind` }) : null;
      const form = h('div.wbform');
      const out = h('div.wbout', { 'aria-live': 'polite' });
      pn.body.append(...(modes ? [modes] : []), form, out);

      const estimate = (): Estimate => {
        const m = modeOf();
        const e = solve(m.kind, m.inputs(st.v, ctx()), units());
        workbenchState.estimates[spec.id] = e;
        clear(out, estimateCard(e));
        return e;
      };
      const changed = () => {
        saved.panels[spec.id] = st;
        saved.last = spec.id;
        save(saved);
        workbenchState.panel = spec.id;
        paintHero(estimate());
      };
      const render = () => {
        const sys = units();
        const m = modeOf();
        if (modes) {
          clear(modes, ...spec.modes.map((x) => h(`button${x.id === m.id ? '.on' : ''}` as 'button', {
            type: 'button', role: 'tab', 'aria-selected': String(x.id === m.id), dataset: { mode: x.id },
            onclick: () => {
              if (st.mode === x.id) return;
              // each mode keeps its own values: the old one's are put by, the new one's come back (else its defaults)
              saved.panels[`${spec.id}:${st.mode}`] = { mode: st.mode, v: st.v };
              const keep = saved.panels[`${spec.id}:${x.id}`]?.v;
              st.mode = x.id;
              st.v = keep ? { ...keep } : { ...x.defaults };
              render();
              changed();
            },
          }, x.label)));
        }
        const rows: HTMLElement[] = [];
        for (const f of m.fields) {
          if (f.when && !f.when(st.v)) continue;
          const id = `wb-${spec.id}-${m.id}-${f.key}`;
          const unit = f.unit ? f.unit[sys === 'metric' ? 0 : 1] : '';
          let input: HTMLInputElement | HTMLSelectElement;
          if (f.type === 'select') {
            const sel = h('select', { id, 'aria-label': f.label }, ...(f.options ?? []).map(([val, label]) => h('option', { value: val }, label)));
            sel.value = String(st.v[f.key] ?? f.options?.[0]?.[0] ?? '');
            sel.addEventListener('change', () => {
              st.v[f.key] = sel.value;
              render();
              changed();
            });
            input = sel;
          } else if (f.type === 'check') {
            const cb = h('input', { id, type: 'checkbox', 'aria-label': f.label });
            cb.checked = st.v[f.key] === true;
            cb.addEventListener('change', () => {
              st.v[f.key] = cb.checked;
              render();
              changed();
            });
            input = cb;
          } else {
            const box = h('input', {
              id,
              type: f.type === 'date' ? 'date' : f.type === 'time' ? 'time' : 'text',
              inputmode: f.type === 'num' ? 'decimal' : undefined,
              autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
              placeholder: f.hint ?? '',
              'aria-label': unit ? `${f.label}, in ${unit}` : f.label,
            });
            box.value = shown(f, st.v[f.key], sys);
            box.addEventListener('input', () => {
              const row = box.closest('.wbf');
              if (f.type !== 'num') {
                st.v[f.key] = box.value;
                row?.classList.remove('bad');
                return void changed();
              }
              const x = read(f, box.value, sys);
              if (x === null || (x === undefined && !f.optional)) {
                row?.classList.add('bad');
                box.setAttribute('aria-invalid', 'true');
                return;
              }
              row?.classList.remove('bad');
              box.removeAttribute('aria-invalid');
              if (x === undefined) delete st.v[f.key];
              else st.v[f.key] = x;
              changed();
            });
            input = box;
          }
          rows.push(h(`div.wbf${f.type === 'check' ? '.chk' : ''}` as 'div', { dataset: { key: f.key } }, h('label', { htmlFor: id }, f.label), input, h('span.wbu', { 'aria-hidden': 'true' }, unit)));
        }
        clear(form, ...rows);
      };
      render();
      estimate();
      return { spec, el: pn.el, render, estimate };
    };

    for (const spec of PANELS) {
      const m = mountPanel(spec);
      mounted.push(m);
      (['beam', 'column', 'gears', 'engine'].includes(spec.id) ? P.left : P.right).append(m.el);
    }
    sections(root, 'workbench', [
      { id: 'structure', label: 'Structure', match: /^(BEAM|COLUMN)/ },
      { id: 'drive', label: 'Drive', match: /^(GEARS|ENGINE)/ },
      { id: 'flight', label: 'Flight', match: /^(WING|PROJECTILE|ORBIT)/ },
      { id: 'home', label: 'Home', match: /^(HEAT|SUN|CIRCUIT)/ },
    ]);
    workbenchState.panel = saved.last ?? 'beam';
    paintHero(workbenchState.estimates[workbenchState.panel]);

    // his units changed in SETTINGS: every form and card in the new units, at once
    settings.subscribe((s, prev) => {
      if (s.units === prev.units) return;
      workbenchState.units = units();
      for (const m of mounted) {
        m.render();
        m.estimate();
      }
      paintHero(workbenchState.estimates[workbenchState.panel]);
    });

    const show = (id: string) => {
      const m = mounted.find((x) => x.spec.id === id);
      if (!m) return;
      revealPanel(m.el);
      requestAnimationFrame(() => m.el.scrollIntoView({ block: 'start', behavior: 'instant' as ScrollBehavior }));
    };
    api = {
      fill(panel, problem) {
        const found = problem ? modeFor(problem.kind, problem.inputs) : null;
        const id = found?.panel.id ?? panel;
        const m = mounted.find((x) => x.spec.id === id);
        if (!m) return null;
        if (found && problem) {
          const st = workbenchState.values[id]!;
          if (st.mode !== found.mode.id) {
            saved.panels[`${id}:${st.mode}`] = { mode: st.mode, v: st.v };
            st.mode = found.mode.id;
            st.v = { ...found.mode.defaults };
          }
          Object.assign(st.v, valuesFrom(problem));
          saved.panels[id] = st;
          saved.last = id;
          save(saved);
          m.render();
        }
        workbenchState.panel = id;
        const e = m.estimate();
        paintHero(e);
        show(id);
        return problem ? e : null;
      },
    };
    workbenchState.ready = true;
    expose();
    return {
      open(arg) {
        if (PANELS.some((p) => p.id === arg)) show(arg);
      },
      describe: () => {
        const e = workbenchState.estimates[workbenchState.panel];
        return e ? `Workbench, ${e.title}: ${e.problem ?? e.lines.slice(0, 3).map((l) => `${l.label} ${l.value}`).join('; ')} (first estimate, not certified)` : 'Workbench';
      },
    };
  },
};

/** The spoken line of the estimate a panel shows (for a reply said aloud). */
export const spokenOf = (e: Estimate) => estimateSpoken(e);

function expose(): void {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => {
    if (!w.__ghosty) return false;
    w.__ghosty.workbench = workbenchState;
    return true;
  };
  if (attach()) return;
  let n = 0;
  const t = setInterval(() => {
    if (attach() || ++n > 60) clearInterval(t);
  }, 250);
}
