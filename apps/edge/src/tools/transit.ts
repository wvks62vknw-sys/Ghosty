/**
 * Live buses and trams near a place (transit_now). The vehicles come from integrations/transit.ts:
 * TfWM's feed with its free key (West Midlands buses and Metro trams), the Bus Open Data Service
 * with its free key (every bus in England), or bustimes.org's community feed with no key at all.
 * The tool also asks God's Eye to show the live transport layer there. National Rail trains are
 * not in any of these feeds, and the answer says so.
 */
import { asData } from '../kernel/permissions';
import { km, knownPlace } from '../integrations/traffic';
import { vehiclesIn, type Bbox, type Vehicle } from '../integrations/transit';
import { geocode, ownerPlace } from './travel';
import { arg, clip, type Tool, type ToolContext } from './types';

async function where(a: Record<string, unknown>, ctx: ToolContext): Promise<{ name: string; lat: number; lon: number }> {
  // Real numbers only: models often send null for optional fields, and Number(null) is 0 (0°N 0°E).
  const lat = a.lat;
  const lon = a.lon;
  if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) return { name: arg.str(a, 'place', false) || `${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon };
  const place = arg.str(a, 'place', false).trim();
  if (!place) {
    const home = await ownerPlace(ctx);
    if (home) return home;
    throw new Error('say which place');
  }
  const known = knownPlace(place);
  if (known) return { ...known, name: /[A-Z]/.test(place) && place.length <= 40 ? place : known.name };
  const g = await geocode(place, await ownerPlace(ctx).catch(() => null)).catch(() => null);
  if (!g) throw new Error(`I couldn't find "${place}" on the map`);
  return g;
}

const TRAINS = 'National Rail trains are not in these feeds (they come from bus and tram operators only), so a train is never listed here.';

/** A square box of `r` km around a point. */
function boxAround(lat: number, lon: number, r: number): Bbox {
  const dLat = r / 111;
  const dLon = r / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

/** "3 min late", "on time", "2 min early" — or '' when the feed does not say. */
export function delayWords(s: number | null): string {
  if (s === null || !Number.isFinite(s)) return '';
  if (Math.abs(s) < 60) return 'on time';
  const m = Math.round(Math.abs(s) / 60);
  return `${m} min ${s > 0 ? 'late' : 'early'}`;
}

const normLine = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export const transitTools: Tool[] = [
  {
    name: 'transit_now',
    description:
      "Live buses and trams near a place right now, shown on God's Eye (e.g. \"what buses are running in Birmingham city centre?\", \"is the 11A near me late?\"). West Midlands with TfWM's free key: National Express West Midlands buses and West Midlands Metro trams; anywhere in England with the free Bus Open Data (BODS) key; otherwise bustimes.org's community feed. Says which lines are running, how many vehicles there are, and the nearest ones with destination and delay. National Rail trains are not in these feeds.",
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'e.g. "Birmingham city centre", "Wolverhampton bus station"' },
        lat: { type: 'number' },
        lon: { type: 'number' },
        radius_km: { type: 'number', description: 'default 2, max 10' },
        line: { type: 'string', description: 'optional: only this line, e.g. 11A, X1, MM1' },
      },
    },
    risk: 'auto',
    async run(a, ctx) {
      const p = await where(a, ctx);
      const r = Math.max(0.3, Math.min(10, arg.num(a, 'radius_km', 2)));
      const want = normLine(arg.str(a, 'line', false));
      const [tfwm, bods] = await Promise.all([ctx.vault.get('tfwm'), ctx.vault.get('bods')]);
      // The globe shows the layer whatever the feed says, so the owner sees what there is.
      ctx.emit({ t: 'client', name: 'show_transit', args: { place: p.name, lat: p.lat, lon: p.lon, range_km: r } });
      const res = await vehiclesIn(boxAround(p.lat, p.lon, r), { tfwm, bods });
      const near = res.vehicles
        .map((v) => ({ v, m: km(p.lat, p.lon, v.lat, v.lon) * 1000 }))
        .filter((x) => x.m <= r * 1000)
        .sort((x, y) => x.m - y.m);
      const picked = want ? near.filter((x) => normLine(x.v.line) === want) : near;

      const lines: string[] = [];
      lines.push(`Live buses and trams within ${r} km of ${p.name}${res.src ? ` (${res.src})` : ''}`);
      if (res.credit) lines.push(res.credit);
      if (res.note) lines.push(res.note);
      if (!res.src) lines.push(TRAINS);
      else if (!near.length) lines.push(`No buses or trams are reported within ${r} km of ${p.name} right now. ${TRAINS}`);
      else {
        const count = (list: { v: Vehicle }[], kind: Vehicle['kind']) => list.filter((x) => x.v.kind === kind).length;
        const parts = [plural(count(picked, 'bus'), 'bus', 'buses')];
        const trams = count(picked, 'tram');
        if (trams || res.src === 'TfWM') parts.push(plural(trams, 'tram'));
        const other = count(picked, 'other');
        if (other) parts.push(`${other} other`);
        if (want && !picked.length) lines.push(`${plural(near.length, 'vehicle')} nearby, but none on line ${arg.str(a, 'line', false).trim()} right now.`);
        else lines.push(`${plural(picked.length, 'vehicle')} right now: ${parts.join(', ')}.${want ? ` (line ${arg.str(a, 'line', false).trim()} only)` : ''}`);
        if (res.src !== 'bustimes.org') lines.push('Lines are the route codes in the feed; delays are only known where the feed gives them.');
        // Lines running, busiest first.
        const byLine = new Map<string, number>();
        for (const x of picked) byLine.set(x.v.line || '?', (byLine.get(x.v.line || '?') ?? 0) + 1);
        const top = [...byLine].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 12);
        if (top.length) lines.push(`Lines running (vehicles): ${top.map(([l, n]) => `${l} (${n})`).join(', ')}${byLine.size > 12 ? `, and ${byLine.size - 12} more` : ''}.`);
        // The ten nearest.
        if (picked.length) lines.push('Nearest:');
        for (const { v, m } of picked.slice(0, 10)) {
          const bits = [`${v.line || 'unknown line'}${v.kind === 'tram' ? ' tram' : ''}${v.dest ? ` to ${v.dest}` : ''}`, `${metres(m)} away`];
          const d = delayWords(v.delayS);
          if (d) bits.push(d);
          if (v.operator) bits.push(v.operator);
          lines.push(`- ${bits.join(', ')}`);
        }
        lines.push(TRAINS);
      }
      return clip(asData('live transport', lines.join('\n')), 4000);
    },
  },
];
