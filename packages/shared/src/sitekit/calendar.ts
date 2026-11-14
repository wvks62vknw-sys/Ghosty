/**
 * [sites] ADD TO CALENDAR on an event page (NEXT ROUND sites.s1). Two ways in, both free and keyless: Google Calendar's own public
 * "new event" address, and a calendar file (.ics) the Worker serves from the page itself at /s/<name>/event.ics, which an iPhone
 * adds to its Calendar. Both are made from the event as the page describes it (its start, its place, its name); nothing is sent
 * anywhere by the page.
 */
export interface CalEvent {
  name: string;
  /** "2026-06-14T20:00" (UK time) or "2026-06-14" (all day). */
  start: string;
  place?: string;
  url?: string;
}
const ISO = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?$/;
export const isStart = (s: unknown): s is string => typeof s === 'string' && ISO.test(s);

/** The day after an all-day start (a calendar's end is the next day), as YYYYMMDD. */
const nextDay = (y: number, m: number, d: number): string => new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, '');

/** Start and end as a calendar writes them: a timed event lasts three hours; an all-day one, the day. */
function span(start: string): { start: string; end: string; allDay: boolean } {
  const m = ISO.exec(start)!;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (m[4] === undefined) return { start: `${m[1]}${m[2]}${m[3]}`, end: nextDay(y, mo, d), allDay: true };
  const t = new Date(Date.UTC(y, mo - 1, d, Number(m[4]), Number(m[5])) + 3 * 3600_000);
  const iso = (x: Date) => x.toISOString().slice(0, 16).replace(/[-:]/g, '');
  return { start: `${m[1]}${m[2]}${m[3]}T${m[4]}${m[5]}00`, end: `${iso(t)}00`, allDay: false };
}

/** Google Calendar's public "new event" address, filled in (nothing is sent until the guest saves it in their own calendar). */
export function googleCalendarUrl(e: CalEvent): string {
  const s = span(e.start);
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.name, dates: `${s.start}/${s.end}`, ...(s.allDay ? {} : { ctz: 'Europe/London' }), ...(e.place ? { location: e.place } : {}), ...(e.url ? { details: e.url } : {}) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

const icsText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
/** The calendar file (RFC 5545), lines folded at 75 octets. */
export function icsOf(e: CalEvent, uid: string, now = new Date()): string {
  const s = span(e.start);
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ghosty//Sites//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    s.allDay ? `DTSTART;VALUE=DATE:${s.start}` : `DTSTART;TZID=Europe/London:${s.start}`,
    s.allDay ? `DTEND;VALUE=DATE:${s.end}` : `DTEND;TZID=Europe/London:${s.end}`,
    `SUMMARY:${icsText(e.name)}`,
    ...(e.place ? [`LOCATION:${icsText(e.place)}`] : []),
    ...(e.url ? [`URL:${e.url.replace(/[\r\n]/g, '')}`, `DESCRIPTION:${icsText(e.url)}`] : []), // (review fix) no line break can ride in on the URL
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const fold = (l: string) => {
    const out: string[] = [];
    let rest = l;
    while (new TextEncoder().encode(rest).length > 75) {
      let n = 74;
      while (new TextEncoder().encode(rest.slice(0, n)).length > 74) n--;
      out.push(rest.slice(0, n));
      rest = ` ${rest.slice(n)}`;
    }
    out.push(rest);
    return out.join('\r\n');
  };
  return `${lines.map(fold).join('\r\n')}\r\n`;
}

/** The event a published page describes (its search listing, application/ld+json, @type Event with a start a calendar can read). */
export function eventIn(html: string): CalEvent | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let v: unknown;
    try {
      v = JSON.parse(m[1]!);
    } catch {
      continue;
    }
    for (const x of Array.isArray(v) ? v : [v]) {
      const o = x as { '@type'?: string; name?: unknown; startDate?: unknown; url?: unknown; location?: { name?: unknown; address?: unknown } };
      if (o?.['@type'] !== 'Event' || !isStart(o.startDate)) continue;
      const place = [o.location?.name, o.location?.address].filter((p): p is string => typeof p === 'string' && !!p.trim()).join(', ');
      return { name: typeof o.name === 'string' && o.name ? o.name.slice(0, 200) : 'Event', start: o.startDate, ...(place ? { place: place.slice(0, 300) } : {}), ...(typeof o.url === 'string' && /^https:/.test(o.url) ? { url: o.url } : {}) };
    }
  }
  return null;
}
