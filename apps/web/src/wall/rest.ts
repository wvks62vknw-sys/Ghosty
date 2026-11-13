/**
 * What the wall says when it rests (BRIEF-MACHINE-WALL): the day's next thing from his own diary, and the weather at Home if he saved
 * one. Both are quiet reads of his own data, asked once in a while; either one that cannot be had is simply left out (a resting wall
 * never shows an error). Nothing here is another person's message, a position or a spending line.
 */
import { brain } from '../api/brain';
import { fetchJson } from '../api/feed';
import { WMO, temp } from '../data/weather';

const hhmm = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

/** The next thing in today's diary ("09:30 · Dentist"), "Nothing else in your diary today." or '' when the diary could not be read. */
export async function firstThing(now = Date.now()): Promise<string> {
  try {
    const { events } = await brain.agenda(1);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const today = events.filter((e) => e.start <= end.getTime() && (e.end ?? e.start) >= new Date(now).setHours(0, 0, 0, 0)).sort((a, b) => a.start - b.start);
    const next = today.find((e) => (e.allDay ? true : e.start >= now - 15 * 60_000));
    if (!next) return today.length ? 'Nothing else in your diary today.' : 'Nothing in your diary today.';
    const title = next.title.replace(/\s+/g, ' ').trim().slice(0, 60);
    return next.allDay ? `Today · ${title}` : `${hhmm(next.start)} · ${title}`;
  } catch {
    return '';
  }
}

/** "Home · 12°C · light rain" from the place he saved as Home, or '' (no Home saved, no weather). */
export async function homeWeather(): Promise<string> {
  try {
    const { places } = await brain.places();
    const home = places.find((p) => /^home$/i.test(p.label) && Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (!home) return '';
    const j = await fetchJson<{ current: { temperature_2m: number; weather_code: number } }>(`https://api.open-meteo.com/v1/forecast?latitude=${home.lat.toFixed(3)}&longitude=${home.lon.toFixed(3)}&current=temperature_2m,weather_code`, 600);
    return `Home · ${temp(j.current.temperature_2m)} · ${WMO(j.current.weather_code).toLowerCase()}`;
  } catch {
    return '';
  }
}
