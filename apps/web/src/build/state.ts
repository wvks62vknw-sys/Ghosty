/**
 * The design on show (BRIEF-REST-D 1): his parameters, kept on this phone ('ghosty.build') so a reload keeps the build, the
 * lines he has priced live (by line id), the side of the sheet he was on and the part group lit. The design itself is made
 * from the parameters each time (kits.ts), so the plan, the 3-D, the bill and the build always agree.
 */
import { createStore } from '../core/store';
import { design, type Design, type Params } from './kits';
import { totals, type Live } from './bom';

export type Side = 'plan' | 'bill' | 'build';
export interface BuildNow {
  params: Params | null;
  live: Record<string, Live>;
  side: Side;
  /** The part group lit in the 3-D and the list ('' for none). */
  lit: string;
  /** What the last export was, for the spec and the console. */
  exported: { kind: string; bytes: number; head: string } | null;
}

export const buildNow = createStore<BuildNow>({ params: null, live: {}, side: 'plan', lit: '', exported: null }, { persist: 'ghosty.build', keys: ['params', 'live'] });

let memo: { p: Params; d: Design } | null = null;
/** The design for what is on show (made once per change of parameters). */
export function designNow(): Design | null {
  const p = buildNow.get().params;
  if (!p) return null;
  if (memo?.p !== p) memo = { p, d: design(p) };
  return memo.d;
}

/** A new design (or the same one changed): the live prices of lines it no longer has are dropped. */
export function setDesign(p: Params): Design {
  const d = design(p);
  const keep = new Set(d.lines.map((l) => l.id));
  const live = Object.fromEntries(Object.entries(buildNow.get().live).filter(([id]) => keep.has(id)));
  memo = { p: d.params, d };
  buildNow.set({ params: d.params, live, lit: '' });
  exposeBuild();
  return d;
}

/** What the Studio's pane adds to the console's view of the build, once it is mounted (build/pane.ts). */
export const paneHooks: { state?: () => Record<string, unknown>; screenOf?: (group: string) => { x: number; y: number } | null; explode?: (v: boolean) => void; roof?: (v: boolean) => void } = {};

/** What a test (and the console) reads and drives: window.__ghosty.build (set when the build is first used: boot makes __ghosty afresh). */
export function exposeBuild(): void {
  const g = globalThis as unknown as { __ghosty?: Record<string, unknown> };
  if (g.__ghosty?.build) return;
  (g.__ghosty ??= {}).build = {
    state: () => {
      const d = designNow();
      const s = buildNow.get();
      return { on: false, ready: false, ...(paneHooks.state?.() ?? {}), params: s.params, live: s.live, exported: s.exported, side: s.side, lit: s.lit, total: d ? totals(d, s.live).total : 0, lines: d?.lines.length ?? 0 };
    },
    screenOf: (group: string) => paneHooks.screenOf?.(group) ?? null,
    explode: (v: boolean) => paneHooks.explode?.(v),
    roof: (v: boolean) => paneHooks.roof?.(v),
  };
}
