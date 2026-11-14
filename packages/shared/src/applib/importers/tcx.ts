/** TCX files (a training centre export: laps of trackpoints), read as a stream into activities. */
import { Sax } from './xml';
import type { Activity, Pt } from './route';

export function tcxReader(): { push(t: string): void; end(): Activity[] } {
  const out: Activity[] = [];
  const stack: string[] = [];
  let cur: (Activity & { lapSecs: number; lapMetres: number; lapKcal: number }) | null = null;
  let pt: Pt | null = null;
  const local = (n: string) => n.slice(n.indexOf(':') + 1);
  const sax = new Sax({
    open(name, a, self) {
      const n = local(name);
      if (n === 'Activity') cur = { sport: a.Sport ?? '', pts: [], lapSecs: 0, lapMetres: 0, lapKcal: 0 };
      else if (n === 'Lap' && cur && cur.start == null && a.StartTime) cur.start = Date.parse(a.StartTime);
      else if (n === 'Trackpoint' && cur) pt = {};
      if (!self) stack.push(n);
    },
    close(name) {
      const n = local(name);
      if (stack[stack.length - 1] === n) stack.pop();
      if (n === 'Trackpoint' && cur && pt) { cur.pts.push(pt); pt = null; }
      else if (n === 'Activity' && cur) {
        const { lapSecs, lapMetres, lapKcal, ...a } = cur;
        if (lapSecs) a.moving = lapSecs;
        if (lapMetres) a.distance = lapMetres;
        if (lapKcal) a.kcal = lapKcal;
        if (a.pts.length || lapSecs) out.push(a);
        cur = null;
      }
    },
    text(t) {
      if (!cur) return;
      const n = stack[stack.length - 1];
      const parent = stack[stack.length - 2];
      if (pt) {
        if (n === 'Time') pt.t = Date.parse(t);
        else if (n === 'LatitudeDegrees') pt.lat = Number(t);
        else if (n === 'LongitudeDegrees') pt.lon = Number(t);
        else if (n === 'AltitudeMeters') pt.ele = Number(t);
        else if (n === 'DistanceMeters') pt.d = Number(t);
        else if (n === 'Value' && parent === 'HeartRateBpm') pt.hr = Number(t);
      } else if (parent === 'Lap') {
        if (n === 'TotalTimeSeconds') cur.lapSecs += Number(t) || 0;
        else if (n === 'DistanceMeters') cur.lapMetres += Number(t) || 0;
        else if (n === 'Calories') cur.lapKcal += Number(t) || 0;
      } else if (n === 'Id' && parent === 'Activity' && cur.start == null) cur.start = Date.parse(t);
      else if (n === 'Notes' && parent === 'Activity') cur.name = t.trim();
    },
  });
  return { push: (t) => sax.push(t), end: () => { sax.end(); return out; } };
}
