/** A calendar file (.ics, exported from any calendar): his events. Who else was invited is left out. */
import { localDay, localTime, propLine, unescapeText, unfold, type Rec } from './input';

/** An iCalendar date or date-time as his day and time (UTC values moved to the phone's time zone). */
export function icsWhen(value: string): { date: string; time: string; ms: number } | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(value);
  if (!m) return null;
  if (!m[4]!) return { date: `${m[1]!}-${m[2]!}-${m[3]!}`, time: '', ms: Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) };
  if (m[7]) {
    const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!, +(m[6]! ?? 0)));
    return { date: localDay(d), time: localTime(d), ms: +d };
  }
  return { date: `${m[1]!}-${m[2]!}-${m[3]!}`, time: `${m[4]!}:${m[5]!}`, ms: Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +m[4]!, +m[5]!) };
}

/** "PT1H30M" → 90. */
export function isoMinutes(d: string): number {
  const m = /^-?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(d.trim());
  if (!m) return 0;
  return (+(m[1] ?? 0)) * 10080 + (+(m[2] ?? 0)) * 1440 + (+(m[3] ?? 0)) * 60 + (+(m[4] ?? 0)) + Math.round((+(m[5] ?? 0)) / 60);
}

/** Events: date, time, title, mins, place, repeats, allday. */
export function eventRecords(text: string): Rec[] {
  const out: Rec[] = [];
  let ev: Record<string, string> | null = null;
  let depth = 0;
  for (const line of unfold(text)) {
    const p = propLine(line);
    if (!p) continue;
    if (p.name === 'BEGIN') { if (p.value === 'VEVENT') { ev = {}; depth = 0; } else if (ev) depth++; continue; }
    if (p.name === 'END') {
      if (p.value === 'VEVENT' && ev) {
        const s = icsWhen(ev.DTSTART ?? '');
        if (s) {
          const e = ev.DTEND ? icsWhen(ev.DTEND) : null;
          const mins = ev.DURATION ? isoMinutes(ev.DURATION) : e ? Math.round((e.ms - s.ms) / 60000) : 0;
          const r: Rec = { _key: `${ev.UID ?? ev.SUMMARY ?? ''}|${ev.DTSTART}`, date: s.date, title: unescapeText(ev.SUMMARY ?? '') || 'Event' };
          if (s.time) r.time = s.time; else r.allday = true;
          if (mins > 0 && s.time) r.mins = mins;
          if (ev.LOCATION) r.place = unescapeText(ev.LOCATION);
          if (ev.RRULE) r.repeats = true;
          if (!/^CANCELLED$/i.test(ev.STATUS ?? '')) out.push(r);
        }
        ev = null;
      } else if (ev) depth--;
      continue;
    }
    if (ev && depth === 0 && !(p.name in ev)) ev[p.name] = p.value;
  }
  return out;
}
