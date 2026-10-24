/**
 * Journeys by public transport (plan_journey) and the next departures from a stop
 * (next_departures), anywhere, free and keyless: Transitous and the open timetables operators
 * publish (integrations/transitous.ts). A planned journey also goes to the phone as the
 * show_journey command, which draws it on the map leg by leg with its steps.
 */
import type { JourneyAnswer } from '../../../../packages/shared/src/protocol';
import { asData } from '../kernel/permissions';
import { CREDIT, departures, format, formatDepartures, geocode, KINDS, plan, resolvePlace, whenToTime } from '../integrations/transitous';
import { savedPlace } from '../places';
import { fmtLocal, safeTz } from '../time';
import { ownerPlace } from './travel';
import { arg, clip, type Tool, type ToolContext } from './types';

const FOOT = `Times marked "live" come from the operator's live feed; the rest are the timetable. ${CREDIT}`;

/** The owner's time zone, as their phone last said (UTC when the database is paused and it is not known). */
async function ownerTz(ctx: Pick<ToolContext, 'storage'>): Promise<string> {
  const c = await ctx.storage.get<{ tz?: string }>('owner:ctx').catch(() => undefined);
  return safeTz(c?.tz);
}

const HERE = /^(here|my (?:location|position)|where i am|current location)$/i;
const normLine = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const journeyTools: Tool[] = [
  {
    name: 'plan_journey',
    description:
      'Plan a journey by public transport, door to door: walking plus bus, tram, train, metro, coach or ferry, anywhere in the world, with live times where the operator publishes them (free, no key). Answers with up to five options as numbered lines (leave and arrive times, how long, changes, which line towards where, where to get on and off, how many stops) and draws the chosen journey on the map on the phone. "from" defaults to the owner\'s location. Use for "how do I get to X", "take me to X by bus", "train to Y at 9", "get me home by 6", "journey from A to B tomorrow morning". For driving, cycling or walking directions use get_directions instead.',
    parameters: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Where to: a stop or station, an address, a place name, or "lat,lon".' },
        from: { type: 'string', description: 'Where from (default: the owner\'s location, "here").' },
        when: { type: 'string', description: 'When to leave: "now" (default), "08:30", "5pm", "tomorrow 07:45", "in 20 minutes", "2026-10-17T08:30"; or when to be there: "arrive by 09:00".' },
        arrive_by: { type: 'boolean', description: 'true when "when" is the time to arrive by.' },
        max_changes: { type: 'number', description: 'At most this many changes (optional).' },
        modes: { type: 'array', items: { type: 'string', enum: ['bus', 'tram', 'train', 'metro', 'ferry', 'coach'] }, description: 'Only these kinds of transport (optional; default all).' },
      },
      required: ['to'],
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const tz = await ownerTz(ctx);
      const when = whenToTime(arg.str(a, 'when', false), tz, arg.bool(a, 'arrive_by'));
      const from = await resolvePlace(arg.str(a, 'from', false), ctx);
      const to = await resolvePlace(arg.str(a, 'to'), ctx, from);
      const modes = (Array.isArray(a.modes) ? a.modes : []).flatMap((m) => KINDS[String(m).toLowerCase().trim()] ?? []);
      const maxChanges = typeof a.max_changes === 'number' && Number.isFinite(a.max_changes) ? Math.max(0, Math.round(a.max_changes)) : undefined;
      const itineraries = await plan({ from, to, time: when.time, arriveBy: when.arriveBy, maxTransfers: maxChanges, modes });
      const answer: JourneyAnswer = { from: { name: from.name, lat: from.lat, lon: from.lon }, to: { name: to.name, lat: to.lat, lon: to.lon }, tz, time: new Date(when.time).toISOString(), arriveBy: when.arriveBy, itineraries };
      // The phone draws the options on the map and lists the steps of the first one.
      if (itineraries.length) ctx.emit({ t: 'client', name: 'show_journey', args: answer as unknown as Record<string, unknown> });
      const head = `Journeys from ${from.name} to ${to.name}, ${when.arriveBy ? 'arriving by' : 'leaving'} ${fmtLocal(when.time, tz)} (${tz}):`;
      const body = itineraries.length ? `${format(itineraries, tz)}\n(Shown on the map on the phone.)` : `No journeys found between ${from.name} and ${to.name} at that time: try another time, or a different place name.`;
      return clip(asData('Transitous journey planner', `${head}\n${body}\n${FOOT}`), 7000);
    },
  },
  {
    name: 'next_departures',
    description:
      'The next departures from a stop or station — buses, trams, trains, metro, ferries — with the line, where it is going, the stand or platform, and live times where the operator publishes them (free, no key, anywhere). "stop" is a stop or station name, or "here" for every stop within 400 m of the owner. Use for "when is the next bus from X", "next trains from New Street", "departures from the stop near me", "is the 50 running".',
    parameters: {
      type: 'object',
      properties: {
        stop: { type: 'string', description: 'A stop or station name, or "here" (default) for the stops around the owner.' },
        line: { type: 'string', description: 'Only this line, e.g. 50, X1, MM1 (optional).' },
        count: { type: 'number', description: 'How many departures (default 10, max 20).' },
        when: { type: 'string', description: 'From when (default now): "08:30", "tomorrow 07:45"…' },
      },
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const tz = await ownerTz(ctx);
      const stop = arg.str(a, 'stop', false).trim();
      const want = normLine(arg.str(a, 'line', false));
      const n = Math.max(1, Math.min(20, Math.round(arg.num(a, 'count', 10))));
      const when = arg.str(a, 'when', false).trim();
      const time = when && !/^now$/i.test(when) ? whenToTime(when, tz).time : undefined;
      let title: string;
      let found: Awaited<ReturnType<typeof departures>>;
      const coords = stop.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
      // "the stops near home": a saved place (places.ts) counts as a spot, like "here".
      const mine = await savedPlace(ctx.storage, stop);
      if (!stop || HERE.test(stop) || coords || mine) {
        const at = mine ? { name: mine.label, lat: mine.lat, lon: mine.lon } : coords ? { name: `${Number(coords[1]).toFixed(4)}, ${Number(coords[2]).toFixed(4)}`, lat: Number(coords[1]), lon: Number(coords[2]) } : await ownerPlace(ctx);
        if (!at) throw new Error("I don't know where you are yet: open God's Eye once so I know where you are, or name the stop.");
        // Every stop within 400 m, more when asked for more departures than ten stops' worth would give.
        found = await departures({ lat: at.lat, lon: at.lon }, n * 2, { time, radiusM: 400 });
        title = `Next departures from the stops within 400 m of ${at.name}`;
      } else {
        const near = await ownerPlace(ctx).catch(() => null);
        const stops = await geocode(stop, near, 'STOP');
        const s = stops[0];
        if (!s?.stopId) throw new Error(`I couldn't find a stop or station called "${stop}".`);
        found = await departures({ stopId: s.stopId }, n * 2, { time });
        title = `Next departures from ${s.name}${s.area ? `, ${s.area}` : ''}`;
      }
      const list = (want ? found.list.filter((d) => normLine(d.line) === want) : found.list).slice(0, n);
      const lines = [`${title}${want ? ` (line ${arg.str(a, 'line', false).trim()} only)` : ''}${time ? `, from ${fmtLocal(time, tz)}` : ''} (${tz}):`];
      if (!list.length) lines.push(want && found.list.length ? `${found.list.length} departures found, but none on line ${arg.str(a, 'line', false).trim()} in that window.` : 'No departures found in the timetable for that stop right now.');
      else lines.push(formatDepartures(list, tz));
      lines.push(FOOT);
      return clip(asData('Transitous departures', lines.join('\n')), 5000);
    },
  },
];
