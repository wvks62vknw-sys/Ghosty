/**
 * What is happening on the motorways and main roads right now: National Highways' live
 * incidents (crashes, queues, closures, roadworks — with delays, lanes closed and when they
 * should clear), pinned to West Midlands junctions so God's Eye can draw them, plus the usual
 * speed at this time of day on the nearest counted stretch (past traffic counts; not live).
 * No tool here identifies people or vehicles.
 */
import { WM_JUNCTIONS } from '../../../web/src/data/wm/junctions';
import { HIGHWAYS_CREDIT, inWestMidlands, liveEvents, roadName, typicalAt, typicalSites, ukSlot, ukTime, type RoadEvent, type TypicalSite } from '../integrations/highways';
import { km, knownPlace } from '../integrations/traffic';
import { asData } from '../kernel/permissions';
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

/** The middle of a road's known junctions, for "what's on the M6" with no place. */
function roadCentre(road: string): { name: string; lat: number; lon: number } | null {
  const pts = Object.values(WM_JUNCTIONS[road] ?? {});
  if (!pts.length) return null;
  return { name: `the ${road}`, lat: pts.reduce((s, p) => s + p[0], 0) / pts.length, lon: pts.reduce((s, p) => s + p[1], 0) / pts.length };
}

/** 'AbnormalTraffic' → 'abnormal traffic'. */
const typeWords = (t: string) => t.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
/** 'Congestion' → 'congestion', but 'RTC' stays. */
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s);

/** "2 lanes closed" from the site's text, or from a figure like "2|0|2" (lanes closed first). */
function lanesText(v: string): string {
  if (!v) return '';
  if (/lane/i.test(v)) return v.toLowerCase();
  const n = parseInt(v, 10);
  return n > 0 ? `${n} lane${n === 1 ? '' : 's'} closed` : '';
}

function clearText(v: string): string {
  if (!v) return '';
  const m = v.match(/(\d{1,2}:\d{2})(?:\s*(?:and|to|-)\s*(\d{1,2}:\d{2}))?/);
  if (m) return `clear by ${m[1]}${m[2] ? ` to ${m[2]}` : ''}`;
  return lowerFirst(v);
}

/** One line per incident, like: M6 southbound J6 to J5: congestion, 19 min delay, 2 lanes closed, clear by 13:45 */
export function eventLine(e: RoadEvent): string {
  const head = e.from ? [e.road, e.direction, `${e.from}${e.to && e.to !== e.from ? ` to ${e.to}` : ''}`].filter(Boolean).join(' ') : e.title || [e.road, e.direction].filter(Boolean).join(' ');
  const bits = [lowerFirst(e.reason) || (e.type && e.type !== 'alert' ? typeWords(e.type) : '') || 'incident'];
  if (e.delayS >= 60) bits.push(`${Math.round(e.delayS / 60)} min delay`);
  const lanes = lanesText(e.lanesClosed);
  if (lanes) bits.push(lanes);
  const clear = clearText(e.normalBy);
  if (clear) bits.push(clear);
  return `${head}: ${bits.join(', ')}${e.lat === null ? ' (exact spot not given)' : ''}`;
}

/** "M6 J6 southbound" without repeating the road when the site's name already starts with it. */
function siteLabel(t: { name: string; road: string; dir: string }): string {
  const name = t.name && t.road && t.name.toUpperCase().startsWith(t.road.toUpperCase()) ? t.name : [t.road, t.name].filter(Boolean).join(' at ');
  const dir = t.dir && !name.toLowerCase().includes(t.dir.toLowerCase()) ? ` ${t.dir}` : '';
  return `${name}${dir}`.trim();
}

const WM_REGION = 'West Midlands';
const BIRMINGHAM = { name: 'the West Midlands', lat: 52.48, lon: -1.9 };

export const highwaysTools: Tool[] = [
  {
    name: 'motorway_now',
    description:
      "What is happening on the motorways and main roads around a place or on a road right now: National Highways' live incidents (crashes, queues, closures, roadworks, delays in minutes, lanes closed, when it should clear), the bottlenecks ordered by delay, and the usual speed at this time of day on the nearest stretch (from past traffic counts; not live). Pins the incidents on God's Eye. Best around the West Midlands (M6, M5, M42, M54, M6 Toll, A38(M), M69), where it knows the junctions; elsewhere in England it lists incidents but cannot place them on the map.",
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'e.g. "Birmingham", "Walsall", "Spaghetti Junction"' },
        road: { type: 'string', description: 'e.g. M6, M42, A38(M), M6 Toll' },
        lat: { type: 'number' },
        lon: { type: 'number' },
        radius_km: { type: 'number', description: 'default 15, max 60' },
      },
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const road = arg.str(a, 'road', false).trim() ? roadName(arg.str(a, 'road', false)) : '';
      let p: { name: string; lat: number; lon: number } | null = null;
      let placeGiven = true;
      let note = '';
      try {
        p = await where(a, ctx);
      } catch (e) {
        if (!road) throw e;
        placeGiven = false; // "what's on the M6" with no place: look along the whole road
        if (arg.str(a, 'place', false).trim()) note = ` ${e instanceof Error ? e.message : String(e)}, so this is the whole ${road}.`;
        p = roadCentre(road) ?? BIRMINGHAM;
      }
      const r = Math.max(1, Math.min(60, arg.num(a, 'radius_km', placeGiven ? 15 : 60)));
      const wm = inWestMidlands(p.lat, p.lon);
      const live = await liveEvents(road ? (wm ? { region: WM_REGION, road } : { road }) : wm ? { region: WM_REGION } : {});
      const byDelay = (x: RoadEvent, y: RoadEvent) => y.delayS - x.delayS || (x.lat === null ? 1 : 0) - (y.lat === null ? 1 : 0);
      const placed = live.events.filter((e): e is RoadEvent & { lat: number; lon: number } => e.lat !== null && e.lon !== null);
      const near = placed.filter((e) => km(p!.lat, p!.lon, e.lat, e.lon) <= r);
      // In the West Midlands (or on a named road) incidents the site gave no junction for still count: they are somewhere on the region's roads.
      const unplaced = wm || road ? live.events.filter((e) => e.lat === null) : [];
      const shown = [...near, ...unplaced].sort(byDelay);

      // God's Eye draws the ones with a spot, nearest first.
      const pick = (e: RoadEvent) => ({ id: e.id, road: e.road, direction: e.direction, title: e.title, reason: e.reason, delayS: e.delayS, lanesClosed: e.lanesClosed, lat: e.lat, lon: e.lon, normalBy: e.normalBy });
      const drawn = [...placed].sort((x, y) => km(p!.lat, p!.lon, x.lat, x.lon) - km(p!.lat, p!.lon, y.lat, y.lon)).slice(0, 60).map(pick);
      ctx.emit({ t: 'client', name: 'show_incidents', args: { place: p.name, lat: p.lat, lon: p.lon, range_km: r, events: drawn } });

      const src = live.src === 'rss' ? "National Highways' breaking-news feed — major incidents only, as their live incident list is not answering" : "National Highways' live list";
      const stale = Date.now() - live.at > 10 * 60_000 ? `; this is the last answer I got, at ${ukTime(live.at)}, as National Highways is not answering now` : '';
      const n = (k: number) => `${k} incident${k === 1 ? '' : 's'}`;
      const lines = [HIGHWAYS_CREDIT];
      const scope = road ? `on the ${road}${placeGiven ? ` within ${r} km of ${p.name}` : ''}` : `on the roads around ${p.name} (within ${r} km)`;
      if (wm || road) {
        lines.push(`${n(shown.length)} ${scope} right now (${src}${unplaced.length ? `; ${unplaced.length} of them ${road ? 'on the road' : 'in the West Midlands region'} with no exact spot given` : ''}${stale}).${note}`);
      } else {
        lines.push(`${n(near.length)} placed within ${r} km of ${p.name} right now (${src}${stale}). I can only pin National Highways incidents to the map around the West Midlands (I know those junctions), so for ${p.name} here are the worst across England by delay instead:`);
        shown.push(...live.events.filter((e) => !near.includes(e as RoadEvent & { lat: number; lon: number })).sort(byDelay));
      }
      if (!shown.length) lines.push('No incidents reported right now.');
      for (const e of shown.slice(0, 12)) lines.push(`- ${eventLine(e)}`);
      if (shown.length > 12) lines.push(`…and ${shown.length - 12} more with smaller or no delays.`);

      // The usual speed at this time of day: the phone's static file of past traffic counts.
      const origin = ctx.env?.PUBLIC_ORIGIN || ctx.origin || '';
      const assets = ctx.env?.ASSETS;
      const typ = origin ? await typicalSites(origin, assets ? (u) => assets.fetch(new Request(u)) : undefined) : null;
      if (!typ) lines.push(origin ? "Typical speeds for this time of day are not available: the phone's West Midlands traffic-count file (/data/wm-typical.json) is missing." : "Typical speeds for this time of day are not available: Ghosty's public address (PUBLIC_ORIGIN) is not set.");
      else {
        const onRoad: TypicalSite[] = road ? typ.sites.filter((s) => roadName(s.road) === road) : [];
        const usual = typicalAt(onRoad.length ? onRoad : typ.sites, p.lat, p.lon);
        if (!usual.length) lines.push(`No typical-speed figure for this time of day near ${p.name}.`);
        else lines.push(`Usually at this time: ${usual.map((t) => `${siteLabel(t)} about ${t.mph} mph${t.vol ? `, ${t.vol} vehicles in that quarter-hour` : ''}`).join('; ')} (${ukSlot().label} average${typ.period ? `, ${typ.period}` : ''}; from past traffic counts, not live).`);
      }
      lines.push('The live map (Waze) and TomTom give road-by-road speeds right now: traffic_now opens them.');
      return clip(asData('National Highways', lines.join('\n')), 4500);
    },
  },
];
