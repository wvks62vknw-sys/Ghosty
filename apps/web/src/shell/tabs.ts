/**
 * Tab registry and navigation. Each feature registers a tab; tabs are built the first time
 * they are opened (not at boot), and get enter()/leave() calls.
 *
 * Add a tab: create apps/web/src/features/<name>/index.ts exporting a TabDef, then add it
 * to the list in apps/web/src/features/index.ts.
 */
import { sfx } from '../assistant/sfx';
import { h } from '../core/dom';
import { stopwatch } from '../core/stopwatch';
import { backdrop } from '../engine/backdrop';
import { globe } from '../engine/globe';
import { setScene } from '../engine/scheduler';
import { ui } from '../state/app';
import type { Readout, StatusWord } from './hubcards';

export interface TabInstance {
  enter?(): void;
  leave?(): void;
  /** One line describing what is on screen, sent to Ghosty as context. */
  describe?(): string;
}

export interface TabDef {
  id: string;
  title: string;
  /** SVG path markup for the dock icon (24×24 viewBox). */
  icon: string;
  /** Which 3D scene renders behind the tab. */
  scene: 'globe' | 'backdrop';
  /** A few words under the tab's name in the systems deck. */
  blurb?: string;
  /** An area's hub (shell/areas.ts): left out of the systems deck. */
  hub?: boolean;
  /** Shown in the dock on phones (the rest are one tap away in the systems deck). */
  primary?: boolean;
  /**
   * One live line for the Every screen deck ("8°C · partly cloudy"), read from what this phone already holds
   * (a feed, a store, the last answer it had); '' when it holds nothing yet. Never fetches. A line ending
   * "in N min" is due within the hour and lights in the accent.
   */
  now?(): string;
  /**
   * Its card on its area's hub (shell/hubcards.ts has the default for every tool, so these are only for a tab that
   * draws its own): the instrument drawn from real state (null: none), the readouts (a value the phone has not got
   * is null, shown as "Not yet", never a sample) and one status word.
   */
  instrument?(): Element | null;
  readouts?(): Readout[];
  status?(): StatusWord;
  mount(root: HTMLElement): TabInstance;
}

const defs: TabDef[] = [];
const mounted = new Map<string, { root: HTMLElement; inst: TabInstance }>();
let stage: HTMLElement;

export function registerTabs(list: TabDef[], stageEl: HTMLElement): void {
  defs.push(...list);
  stage = stageEl;
}

export const tabs = () => defs;

export function currentTab(): { def: TabDef; inst: TabInstance } | null {
  const id = ui.get().tab;
  const def = defs.find((d) => d.id === id);
  const m = mounted.get(id);
  return def && m ? { def, inst: m.inst } : null;
}

/** Build a tab once (its page stays, hidden, while another is on screen). */
function build(def: TabDef): { root: HTMLElement; inst: TabInstance } {
  let m = mounted.get(def.id);
  if (!m) {
    const root = h('div.pg', { id: `pg-${def.id}` });
    stage.append(root);
    let inst: TabInstance = {};
    try {
      inst = def.mount(root);
    } catch (e) {
      console.error('tab mount', def.id, e);
      root.append(h('div.note', `This tab failed to load: ${String((e as Error)?.message ?? e)}`));
    }
    m = { root, inst };
    mounted.set(def.id, m);
  }
  return m;
}

/**
 * Build a tab off screen without going to it (NIGHT SCHOOL runs the GYM's TRAIN ALL from any screen). Nothing changes
 * on screen; false when there is no such tab or the tabs are not registered yet.
 */
export function ensureMounted(id: string): boolean {
  const def = defs.find((d) => d.id === id);
  if (!def || !stage) return false;
  build(def).root.classList.toggle('on', ui.get().tab === def.id);
  return true;
}

export function go(id: string): boolean {
  const def = defs.find((d) => d.id === id || d.title.toLowerCase() === id.toLowerCase());
  if (!def) return false;
  const prev = ui.get().tab;
  if (prev === def.id && mounted.has(def.id)) return true;
  const switching = mounted.has(prev);
  // The stopwatch (core/stopwatch.ts): from here to the first paint after the tab is on screen.
  const timed = stopwatch.tab(def.id, def.title, !mounted.has(def.id));
  mounted.get(prev)?.inst.leave?.();
  const m = build(def);
  for (const [k, v] of mounted) v.root.classList.toggle('on', k === def.id);
  if (switching) sfx('tab');
  setScene(def.scene === 'globe' ? globe : backdrop);
  document.body.dataset.scene = def.scene;
  ui.set({ tab: def.id });
  try {
    history.replaceState(null, '', `#${def.id}`);
  } catch {
    /* ignore */
  }
  m.inst.enter?.();
  timed();
  return true;
}
