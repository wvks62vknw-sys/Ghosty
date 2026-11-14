/**
 * RUN HISTORY WITH ROUTES DRAWN (NEXT ROUND, BODY AND KITCHEN lane, body.u8), kept on this phone only (`ghosty.body.runs`):
 * every run he keeps, with its route drawn small on the phone in pace bands (quicker, steady, slower than the run's own average),
 * its splits and his personal bests (the longest, the quickest kilometre, the quickest 5 km). My brain still gets only the
 * distance, the time and the splits (./run.ts), never a position: the route never leaves the phone.
 */
import { h, svgEl } from '../../core/dom';
import { button } from '../../ui/components';
import { clock } from '../../../../../packages/shared/src/body';

export interface Kept {
  id: string;
  at: number;
  km: number;
  secs: number;
  splits: number[];
  /** [lat, lon, seconds from the start], rounded: the phone's own. */
  route: [number, number, number][];
}
const KEY = 'ghosty.body.runs';
let cache: Kept[] | null = null;
export function loadRuns(): Kept[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    cache = (Array.isArray(raw) ? raw : []).filter((r) => r && Number.isFinite(r.km) && Number.isFinite(r.secs) && Array.isArray(r.route)).slice(-100);
  } catch {
    cache = [];
  }
  return cache;
}
/** Keeps a run (only on his STOP AND KEEP); false when the phone's storage would not take it. */
export function keepRun(km: number, secs: number, splits: number[], route: [number, number, number][]): boolean {
  const runs = loadRuns();
  const step = Math.max(1, Math.ceil(route.length / 1500));
  runs.push({ id: Math.random().toString(36).slice(2, 10), at: Date.now(), km: Math.round(km * 1000) / 1000, secs: Math.round(secs), splits: splits.slice(0, 100), route: route.filter((_, i) => i % step === 0).map(([a, b, t]) => [Math.round(a * 1e5) / 1e5, Math.round(b * 1e5) / 1e5, Math.round(t)]) });
  try {
    localStorage.setItem(KEY, JSON.stringify(runs.slice(-100)));
    return true;
  } catch {
    runs.pop();
    return false;
  }
}

/** The bests across his kept runs: the longest, the quickest single kilometre, the quickest 5 km (from the splits). */
export function runBests(runs = loadRuns()): { longest: number | null; km1: number | null; km5: number | null } {
  let km1: number | null = null;
  let km5: number | null = null;
  for (const r of runs) {
    r.splits.forEach((s, i) => {
      const one = s - (i ? r.splits[i - 1]! : 0);
      if (one > 0 && (km1 == null || one < km1)) km1 = one;
    });
    if (r.splits.length >= 5 && (km5 == null || r.splits[4]! < km5)) km5 = r.splits[4]!;
  }
  return { longest: runs.length ? Math.max(...runs.map((r) => r.km)) : null, km1, km5 };
}

const R = 6_371_000;
const rad = (d: number) => (d * Math.PI) / 180;
const metres = (a: [number, number, number], b: [number, number, number]) => {
  const x = rad(b[1] - a[1]) * Math.cos(rad((a[0] + b[0]) / 2));
  const y = rad(b[0] - a[0]);
  return Math.sqrt(x * x + y * y) * R;
};
/** The route drawn small: each stretch in its pace band against the run's own average. */
export function routeSvg(r: Kept): SVGElement {
  const svg = svgEl('svg', { viewBox: '0 0 100 100', class: 'br-route', role: 'img', 'aria-label': `The route of a ${r.km.toFixed(2)} km run, drawn on this phone` });
  const pts = r.route;
  if (pts.length < 2) return svg;
  const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const xs = pts.map((p) => p[1] * Math.cos(rad(lat0)));
  const ys = pts.map((p) => p[0]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const span = Math.max(x1 - x0, y1 - y0) || 1e-6;
  const X = (i: number) => 6 + ((xs[i]! - x0) / span) * 88 + (88 - ((x1 - x0) / span) * 88) / 2;
  const Y = (i: number) => 94 - ((ys[i]! - y0) / span) * 88 - (88 - ((y1 - y0) / span) * 88) / 2;
  const avg = r.secs / Math.max(0.001, r.km);
  for (let i = 1; i < pts.length; i++) {
    const m = metres(pts[i - 1]!, pts[i]!);
    const dt = pts[i]![2] - pts[i - 1]![2];
    const pace = m > 0 ? dt / (m / 1000) : avg;
    const band = pace < avg * 0.95 ? 'quick' : pace > avg * 1.05 ? 'slow' : 'steady';
    svg.append(svgEl('line', { x1: X(i - 1).toFixed(2), y1: Y(i - 1).toFixed(2), x2: X(i).toFixed(2), y2: Y(i).toFixed(2), class: `br-seg ${band}` }));
  }
  return svg;
}

/** The history under the running coach: the bests, each kept run, the open one's route and splits. */
export function historyBox(): HTMLElement {
  const box = h('section.br-history', { 'aria-label': 'Your runs' });
  let open = '';
  const draw = () => {
    const runs = loadRuns().slice().reverse();
    if (!runs.length) {
      box.replaceChildren(h('h3.bt-h', 'Your runs'), h('p.pknote', { dataset: { runs: '0' } }, 'Each run you keep shows here with its route, drawn on this phone, and your personal bests.'));
      return;
    }
    const b = runBests();
    const cur = runs.find((r) => r.id === open) ?? runs[0]!;
    box.replaceChildren(
      h('h3.bt-h', 'Your runs'),
      h('div.bc-grid', { dataset: { runs: String(runs.length) } },
        h('div.bc-cell', h('small', 'Longest'), h('b', `${b.longest!.toFixed(2)} km`), h('small', 'measured by the phone')),
        h('div.bc-cell', h('small', 'Quickest km'), h('b', b.km1 == null ? '—' : clock(b.km1)), h('small', 'from your splits')),
        h('div.bc-cell', h('small', 'Quickest 5 km'), h('b', b.km5 == null ? '—' : clock(b.km5)), h('small', b.km5 == null ? 'a 5 km run sets it' : 'from your splits'))),
      h('ul.pkitems', ...runs.slice(0, 10).map((r) => {
        const k = button(h('span.bt-entry', h('b', `${new Date(r.at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · ${r.km.toFixed(2)} km`), h('small', ` · ${clock(r.secs)} · ${clock(r.secs / Math.max(0.001, r.km))} min per km`)), () => {
          open = r.id;
          draw();
        }, r.id === cur.id ? 'on' : '');
        k.setAttribute('aria-pressed', String(r.id === cur.id));
        return h('li.pkitem', k);
      })),
      h('div.br-map', { dataset: { route: cur.id } }, routeSvg(cur)),
      h('p.pknote', 'Quicker than the run’s average in the accent, steadier in grey, slower in amber. Drawn on this phone: the route never leaves it.'),
      cur.splits.length ? h('ol.pklist', { 'aria-label': 'Its splits' }, ...cur.splits.map((s, i) => h('li', `${i + 1} km — ${clock(s - (i ? cur.splits[i - 1]! : 0))}`))) : h('p.pknote', 'Under a kilometre: no splits.'),
    );
  };
  draw();
  runsHooks.redraw = draw;
  return box;
}
export const runsHooks = { redraw: () => undefined as void };
