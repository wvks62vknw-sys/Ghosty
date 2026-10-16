/**
 * Live cameras and live traffic for a place. show_cameras checks where God's Eye has public
 * cameras and says honestly when a place has none (then shows live traffic there instead);
 * around Birmingham the city's own streets have none, but National Highways' motorway cameras
 * (M6, M5, M42, M54, A38(M)) are public stills, so the nearest of those is shown instead;
 * traffic_now opens the live traffic map (Waze's own embeddable map: jams and hazards drivers report
 * right now — free, no key), shows the nearest public cameras, and with the free TomTom key adds
 * speeds and incidents; street_view opens Google Street View (free, no key) at a place.
 * No tool here identifies people or vehicles: no number-plate reading, face recognition or tracking.
 */
import { asData } from '../kernel/permissions';
import { cameraCoverage, flowAt, incidentsNear, knownPlace } from '../integrations/traffic';
import { geocode, ownerPlace } from './travel';
import { arg, clip, type Tool, type ToolContext } from './types';

const NO_KEY = 'For the numbers too — speed on the roads vs normal and the list of incidents with delays — add the free TomTom key once in System → Keys → "TomTom traffic" (developer.tomtom.com → sign up → copy the default API key; about two minutes).';

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

const mins = (s: number) => (s >= 90 ? `${Math.round(s / 60)} min` : `${Math.round(s)} s`);

export const trafficTools: Tool[] = [
  {
    name: 'show_cameras',
    description:
      "Show live public traffic/road CCTV for a place on God's Eye (e.g. \"cameras in Birmingham city centre\", \"M6 at junction 6\"). Public cameras exist on the West Midlands motorways (National Highways: M6, M5, M42, M54, A38(M) — stills refreshed every 20–30 s), in London, County Durham, New York City, California, Finland, Ontario, British Columbia, Sydney/NSW and Calgary. Birmingham's own streets have none (the council doesn't publish its CCTV): there the nearest motorway camera is shown, with live traffic and the mapped ANPR/speed camera locations. Elsewhere with none, this says so and shows how far the nearest are. Repeat its answer honestly.",
    parameters: { type: 'object', properties: { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } } },
    risk: 'auto',
    async run(a, ctx) {
      const p = await where(a, ctx);
      const cov = cameraCoverage(p.lat, p.lon);
      const traffic = !!(await ctx.vault.get('tomtom'));
      if (cov.away < 5) {
        ctx.emit({ t: 'client', name: 'show_cameras', args: { place: p.name, lat: p.lat, lon: p.lon } });
        if (/National Highways/.test(cov.area)) {
          // The motorways around Birmingham: public stills, Crown copyright, for the owner's own viewing.
          ctx.emit({ t: 'client', name: 'show_traffic', args: { place: p.name, lat: p.lat, lon: p.lon } });
          const local = /birmingham|west midlands|solihull|wolverhampton|walsall|dudley|sandwell|coventry/i.test(p.name);
          const detail = `M6, M5, M42, M54 and the A38(M) around the city have public stills (a new frame every 20–30 seconds); the four nearest are in the CCTV grid, with live traffic and the mapped camera locations. ${traffic ? '' : NO_KEY}`;
          // the honest part first: a model that shortens the answer still keeps it
          if (local) return `${p.name}'s own streets have no public cameras (the council doesn't publish its CCTV), so the nearest National Highways motorway camera to ${p.name} is open on God's Eye. ${detail}`;
          return `Showing the nearest National Highways motorway camera to ${p.name} on God's Eye. ${detail}`;
        }
        return `Showing the nearest live public camera to ${p.name} (${cov.area}) on God's Eye; the four nearest are in the CCTV grid.`;
      }
      ctx.emit({ t: 'client', name: 'traffic_map', args: { place: p.name, lat: p.lat, lon: p.lon } });
      ctx.emit({ t: 'client', name: 'show_traffic', args: { place: p.name, lat: p.lat, lon: p.lon } });
      return `There are no public live cameras in ${p.name}: the operators there don't publish their CCTV. The nearest public cameras are ${cov.area}, about ${Math.round(cov.away)} km away. The live traffic map (Waze) for ${p.name} is open on God's Eye instead. ${traffic ? `I've flown God's Eye to ${p.name} with live traffic speeds on the roads (green = flowing, red = jammed) and the mapped ANPR, speed and red-light camera locations; call traffic_now for speeds and incidents.` : `I've flown God's Eye there and marked the mapped ANPR, speed and red-light camera locations. ${NO_KEY}`}`;
    },
  },
  {
    name: 'traffic_now',
    description: "Live road traffic around a place right now. Opens the live traffic map on God's Eye (Waze: jams, slow roads, hazards and crashes drivers report now — free, no key), shows the nearest public cameras if there are any, and with the free TomTom key adds speed on the nearest main road vs normal and current incidents (crashes, closures, queues, roadworks) with delays. For the motorways (M6, M42, M5…) and their junctions, motorway_now gives National Highways' own live incident list with no key.",
    parameters: { type: 'object', properties: { place: { type: 'string', description: 'e.g. "Birmingham city centre", "M6 junction 6"' }, lat: { type: 'number' }, lon: { type: 'number' }, radius_km: { type: 'number', description: 'default 5, max 40' } } },
    risk: 'auto',
    async run(a, ctx) {
      const p = await where(a, ctx);
      const r = Math.max(1, Math.min(40, arg.num(a, 'radius_km', 5)));
      // The live map first (Waze: what drivers report right now, no key), then the nearest public
      // cameras if there are any, then TomTom's numbers.
      ctx.emit({ t: 'client', name: 'traffic_map', args: { place: p.name, lat: p.lat, lon: p.lon } });
      const cov = cameraCoverage(p.lat, p.lon);
      if (cov.away < 5) ctx.emit({ t: 'client', name: 'show_cameras', args: { place: p.name, lat: p.lat, lon: p.lon } });
      const shown = `The live traffic map for ${p.name} is open on God's Eye (Waze: red and orange roads are slow or jammed right now, with the hazards and crashes drivers reported)${cov.away < 5 ? ', and the nearest public cameras are in the CCTV grid' : ''}.`;
      const key = await ctx.vault.get('tomtom');
      if (!key) return `${shown} ${NO_KEY}`;
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
      return `${shown}\n\n${clip(asData('TomTom traffic', lines.join('\n')), 5000)}`;
    },
  },
  {
    name: 'street_view',
    description:
      "Open Google Street View at a place on God's Eye: the owner can look around and walk along the street (free, no key), with satellite imagery and the live traffic map a tap away in the same view. Use for \"what does X look like\", \"show me the street\", \"look around X\". Street View was photographed on an earlier date — it is not live.",
    parameters: { type: 'object', properties: { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } } },
    risk: 'auto',
    async run(a, ctx) {
      const p = await where(a, ctx);
      ctx.emit({ t: 'client', name: 'street_view', args: { place: p.name, lat: p.lat, lon: p.lon } });
      return `Street View of ${p.name} is open on God's Eye: drag to look around, tap the arrows to move along the street; SATELLITE and LIVE TRAFFIC are a tap away in the same view. (Google's imagery, photographed on an earlier date — not live.)`;
    },
  },
];
