/** GPX files (tracks from a watch, a bike computer or a running app's export), read as a stream into activities. */
import { Sax } from './xml';
import type { Activity, Pt } from './route';

/** Streams GPX text; each <trk> (or a lone <rte>) becomes one activity. */
export function gpxReader(): { push(t: string): void; end(): Activity[] } {
  const out: Activity[] = [];
  const stack: string[] = [];
  let cur: Activity | null = null;
  let pt: Pt | null = null;
  let meta = '';
  const local = (n: string) => n.slice(n.indexOf(':') + 1);
  const sax = new Sax({
    open(name, a, self) {
      const n = local(name);
      if (n === 'trk' || n === 'rte') cur = { sport: '', pts: [] };
      else if ((n === 'trkpt' || n === 'rtept') && cur) {
        pt = { lat: Number(a.lat), lon: Number(a.lon) };
        if (self) { cur.pts.push(pt); pt = null; }
      }
      if (!self) stack.push(n);
    },
    close(name) {
      const n = local(name);
      if (stack[stack.length - 1] === n) stack.pop();
      if ((n === 'trkpt' || n === 'rtept') && cur && pt) { cur.pts.push(pt); pt = null; }
      else if ((n === 'trk' || n === 'rte') && cur) {
        if (!cur.name && meta) cur.name = meta;
        if (cur.pts.length) out.push(cur);
        cur = null;
      }
    },
    text(t) {
      const n = stack[stack.length - 1];
      const parent = stack[stack.length - 2];
      if (pt) {
        if (n === 'ele') pt.ele = Number(t);
        else if (n === 'time') pt.t = Date.parse(t);
        else if (n === 'hr') pt.hr = Number(t);
      } else if (cur && (parent === 'trk' || parent === 'rte')) {
        if (n === 'name') cur.name = t.trim();
        else if (n === 'type') cur.sport = t.trim();
      } else if (n === 'name' && parent === 'metadata') meta = t.trim();
    },
  });
  return { push: (t) => sax.push(t), end: () => { sax.end(); return out; } };
}
