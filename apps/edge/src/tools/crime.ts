/**
 * Street crime around a place, from the Home Office's open police data (data.police.uk,
 * Open Government Licence; England, Wales and Northern Ireland). Free, no key. Monthly data,
 * about two months behind, snapped to nearby points — a picture of what was reported where,
 * never anything live and never anyone identified. Also flies God's Eye there with the
 * STREET CRIME layer on.
 */
import { knownPlace } from '../integrations/traffic';
import { geocode, ownerPlace } from './travel';
import { arg, type Tool, type ToolContext } from './types';

const LABEL: Record<string, string> = {
  'anti-social-behaviour': 'anti-social behaviour',
  'bicycle-theft': 'bicycle theft',
  burglary: 'burglary',
  'criminal-damage-arson': 'criminal damage and arson',
  drugs: 'drugs',
  'other-theft': 'other theft',
  'possession-of-weapons': 'possession of weapons',
  'public-order': 'public order',
  robbery: 'robbery',
  shoplifting: 'shoplifting',
  'theft-from-the-person': 'theft from the person',
  'vehicle-crime': 'vehicle crime',
  'violent-crime': 'violence and sexual offences',
  'other-crime': 'other crime',
};
/** A police.uk category in plain words ("violent-crime" → "violence and sexual offences"). */
export const crimeLabel = (c: string) => LABEL[c] ?? c.replace(/-/g, ' ');
const label = crimeLabel;

interface ApiCrime {
  category: string;
  month: string;
  location?: { latitude: string; longitude: string; street?: { name?: string } };
  outcome_status?: { category: string } | null;
}

export interface CrimeSummary {
  total: number;
  month: string;
  byCategory: [string, number][];
  streets: [string, number][];
  outcomes: { open: number; noSuspect: number; charged: number; other: number };
}

/** Totals by category, the streets that come up most, and how cases ended. */
export function summarise(list: ApiCrime[]): CrimeSummary {
  const cat = new Map<string, number>();
  const st = new Map<string, number>();
  const outcomes = { open: 0, noSuspect: 0, charged: 0, other: 0 };
  let month = '';
  for (const c of list) {
    cat.set(c.category, (cat.get(c.category) ?? 0) + 1);
    const s = (c.location?.street?.name ?? '').replace(/^On or near /i, '');
    if (s && !/^(supermarket|petrol station|shopping area|parking area|nightclub|sports\/recreation area|police station|hospital|further\/higher educational building|theatre\/concert hall|pedestrian subway|park\/open space|bus\/coach station|conference\/exhibition centre|prison|airport\/airfield|race track|theme\/adventure park)$/i.test(s)) st.set(s, (st.get(s) ?? 0) + 1);
    if (c.month > month) month = c.month;
    const o = (c.outcome_status?.category ?? '').toLowerCase();
    if (!o || /under investigation|awaiting court/.test(o)) outcomes.open++;
    else if (/no suspect/.test(o)) outcomes.noSuspect++;
    else if (/charged|summonsed|caution|penalty|community resolution|drugs possession warning/.test(o)) outcomes.charged++;
    else outcomes.other++;
  }
  return {
    total: list.length,
    month,
    byCategory: [...cat.entries()].sort((a, b) => b[1] - a[1]),
    streets: [...st.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    outcomes,
  };
}

export const inUK = (lat: number, lon: number) => lat > 49.8 && lat < 56 && lon > -8.7 && lon < 2;

async function where(a: Record<string, unknown>, ctx: ToolContext): Promise<{ name: string; lat: number; lon: number }> {
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

const monthName = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return y && m ? new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ym;
};

export const crimeTools: Tool[] = [
  {
    name: 'crime_near',
    description:
      'Reported street crime within a mile of a place in England, Wales or Northern Ireland (police.uk open data, latest published month, about two months behind): totals by type, the streets that come up most, and how cases ended. Also shows the STREET CRIME layer there on God\'s Eye. Use for "how safe is…", "crime in…", "what happens around…". Nothing live, nobody identified.',
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: 'e.g. "Moseley, Birmingham", "Digbeth", a postcode' },
        lat: { type: 'number' },
        lon: { type: 'number' },
        month: { type: 'string', description: 'YYYY-MM; omit for the latest' },
      },
    },
    risk: 'auto',
    async run(a, ctx) {
      const p = await where(a, ctx);
      if (!inUK(p.lat, p.lon)) return `${p.name} is outside England, Wales and Northern Ireland, and the open police data only covers those (Scotland and other countries publish nothing comparable).`;
      const u = new URL('https://data.police.uk/api/crimes-street/all-crime');
      u.searchParams.set('lat', p.lat.toFixed(5));
      u.searchParams.set('lng', p.lon.toFixed(5));
      const m = arg.str(a, 'month', false);
      if (/^\d{4}-\d{2}$/.test(m)) u.searchParams.set('date', m);
      const r = await fetch(u.toString(), { headers: { 'User-Agent': 'Ghosty/personal' } });
      if (r.status === 404 && m) return `The police data has no month "${m}" (it goes back about three years and ends two months ago).`;
      if (!r.ok) throw new Error(`police.uk answered ${r.status}`);
      const list = (await r.json()) as ApiCrime[];
      ctx.emit({ t: 'client', name: 'show_crime', args: { place: p.name, lat: p.lat, lon: p.lon } });
      if (!list.length) return `No crimes were reported within a mile of ${p.name}${m ? ` in ${monthName(m)}` : ' in the latest published month'}.`;
      const s = summarise(list);
      const top = s.byCategory.slice(0, 6).map(([c, n]) => `${label(c)} ${n}`).join(', ');
      const streets = s.streets.length ? ` Most often on or near: ${s.streets.map(([n, k]) => `${n} (${k})`).join(', ')}.` : '';
      const o = s.outcomes;
      return `${s.total} crimes reported within a mile of ${p.name} in ${monthName(s.month)}: ${top}${s.byCategory.length > 6 ? ', and others' : ''}.${streets} Outcomes so far: ${o.open} still open, ${o.noSuspect} closed with no suspect found, ${o.charged} with a charge, caution or other action, ${o.other} other. Locations are approximate (snapped to a nearby point) and the data is about two months behind; it is a monthly picture, not a live feed. God's Eye is showing the area with the STREET CRIME layer (red = against people, gold = property, violet = order).`;
    },
  },
];
