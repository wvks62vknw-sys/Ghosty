/**
 * Live cameras and live traffic for a place. show_cameras checks where God's Eye has public
 * cameras and says honestly when a place has none (then shows live traffic there instead);
 * traffic_now reads current speeds and incidents from TomTom (free key "tomtom").
 * No tool here identifies people or vehicles: no number-plate reading, face recognition or tracking.
 */
import { asData } from '../kernel/permissions';
import { cameraCoverage, flowAt, incidentsNear, knownPlace } from '../integrations/traffic';
import { geocode, ownerPlace } from './travel';
import { arg, clip, type Tool, type ToolContext } from './types';

const NO_KEY = 'Live traffic needs the free TomTom key: the owner adds it in System → Keys → "TomTom traffic" (developer.tomtom.com → sign up → copy the default API key). It takes about two minutes.';

async function where(a: Record<string, unknown>, ctx: ToolContext): Promise<{ name: string; lat: number; lon: number }> {
  const lat = Number(a.lat);
  const lon = Number(a.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon) && a.lat !== undefined) return { name: arg.str(a, 'place', false) || `${lat.toFixed(3)}, ${lon.toFixed(3)}`, lat, lon };
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

const mins = (s: number) => (s >= 90 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

export const trafficTools: Tool[] = [
  {
    name: 'show_cameras',
    description:
      "Show live public traffic/road CCTV for a place on God's Eye (e.g. \"cameras in Birmingham city centre\"). Public cameras exist in London, County Durham, New York City, California, Finland, Ontario, British Columbia, Sydney/NSW and Calgary. If the place has none (e.g. Birmingham — its council and National Highways don't publish theirs), this says so, shows how far the nearest are, and shows live traffic plus mapped ANPR/speed camera locations there instead. Repeat its answer honestly.",
    parameters: { type: 'object', properties: { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } } },
    risk: 'auto',
    async run(a, ctx) {
      const p = await where(a, ctx);
      const cov = cameraCoverage(p.lat, p.lon);
      const traffic = !!(await ctx.vault.get('tomtom'));
      if (cov.away < 5) {
        ctx.emit({ t: 'client', name: 'show_cameras', args: { place: p.name, lat: p.lat, lon: p.lon } });
        return `Showing the nearest live public camera to ${p.name} (${cov.area}) on God's Eye; the four nearest are in the CCTV grid.`;
      }
      ctx.emit({ t: 'client', name: 'show_traffic', args: { place: p.name, lat: p.lat, lon: p.lon } });
      return `There are no public live cameras in ${p.name}: the operators there don't publish their CCTV (Birmingham City Council and National Highways only share theirs with control rooms and media partners). The nearest public cameras are ${cov.area}, about ${Math.round(cov.away)} km away. ${traffic ? `I've flown God's Eye to ${p.name} with live traffic speeds on the roads (green = flowing, red = jammed) and the mapped ANPR, speed and red-light camera locations; call traffic_now for speeds and incidents.` : `I've flown God's Eye there and marked the mapped ANPR, speed and red-light camera locations. ${NO_KEY}`}`;
    },
  },
  {
    name: 'traffic_now',
    description: 'Live road traffic around a place right now: speed on the nearest main road vs normal, and current incidents (crashes, closures, queues, roadworks) with delays. Also shows the live traffic layer on God\'s Eye. Needs the free TomTom key.',
    parameters: { type: 'object', properties: { place: { type: 'string', description: 'e.g. "Birmingham city centre", "M6 junction 6"' }, lat: { type: 'number' }, lon: { type: 'number' }, radius_km: { type: 'number', description: 'default 5, max 40' } } },
    risk: 'auto',
    async run(a, ctx) {
      const key = await ctx.vault.get('tomtom');
      if (!key) return NO_KEY;
      const p = await where(a, ctx);
      const r = Math.max(1, Math.min(40, arg.num(a, 'radius_km', 5)));
      ctx.emit({ t: 'client', name: 'show_traffic', args: { place: p.name, lat: p.lat, lon: p.lon, range_km: Math.max(6, r * 3) } });
      const [flow, inc] = await Promise.all([flowAt(key, p.lat, p.lon), incidentsNear(key, p.lat, p.lon, r)]);
      const lines = [`Live traffic around ${p.name} (within ${r} km):`];
      if (flow) {
        const pct = flow.freeKmh ? Math.round((flow.currentKmh / flow.freeKmh) * 100) : 100;
        lines.push(flow.closed ? 'Nearest main road: CLOSED.' : `Nearest main road: ${flow.currentKmh} km/h now vs ${flow.freeKmh} km/h when clear (${pct}%${flow.delaySec > 30 ? `, about ${mins(flow.delaySec)} slower along that stretch` : ''}).`);
      }
      if (!inc.length) lines.push('No incidents reported right now.');
      else {
        lines.push(`${inc.length} incident${inc.length === 1 ? '' : 's'}:`);
        for (const i of inc.slice(0, 12)) lines.push(`- ${i.kind}${i.roads ? ` on ${i.roads}` : ''}${i.from ? `: ${i.from}${i.to && i.to !== i.from ? ` → ${i.to}` : ''}` : ''}${i.what ? ` — ${i.what}` : ''}${i.delaySec ? ` (delay ${mins(i.delaySec)})` : ''}`);
      }
      return clip(asData('TomTom traffic', lines.join('\n')), 5000);
    },
  },
];
