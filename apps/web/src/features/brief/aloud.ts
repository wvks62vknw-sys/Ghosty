/**
 * THE BRIEF READ ALOUD ON THE FIRST OPEN OF THE DAY (BRIEF-OCT-IDEAS-2 2; Settings → VOICE → "Read me the Brief on the first
 * open of the day", off until he turns it on). The first open after 05:00 local, once a day (one flag in localStorage), says the
 * Brief's own spoken line (day.ts `spoken`: the greeting, the day, the drive with "leave by", the top headlines) once Home has
 * landed: never on the first frame (the boot's hand-over first, then a beat), never over a reply (the next quiet moment: the
 * same rule as a notice read out, assistant/notices.ts), and only with the voice on (the mute on Home is the same switch).
 * Nothing is asked of a model; what the Brief already reads is read again, here, without opening the Brief.
 */
import { brain } from '../../api/brain';
import { whenQuiet } from '../../assistant/notices';
import { speak } from '../../assistant/voice';
import { news } from '../../data/news';
import { WMO, temp, weather, type WeatherData } from '../../data/weather';
import { settings } from '../../state/app';
import { commuteLine, diarySentence, isoDay, leaveFor, rainClause, rainWhen, spoken, stillToday, summary, type Facts } from './day';

/** The day (it starts at 05:00, not midnight: a night owl's 02:00 is still yesterday's Brief) last read aloud. */
export const ALOUD_FLAG = 'ghosty.brief.aloud';
const START_HOUR = 5;
/** After Home has landed, a beat before the voice starts (never on the first frame). */
export const BEAT_MS = 1400;

/** "2026-11-12": the Brief's day for this moment: before 05:00 it is still the day before. */
export const briefDay = (now: number): string => isoDay(new Date(now - START_HOUR * 3_600_000));

/** May the Brief be read now: switched on, the voice on (not muted), the page showing, and not yet read today. Pure. */
export function mayRead(o: { on: boolean; voiceOn: boolean; hidden: boolean; flag: string | null; now: number }): boolean {
  return o.on && o.voiceOn && !o.hidden && o.flag !== briefDay(o.now);
}

const KEPT = 'ghosty.brief.wx';
const within = <T>(p: Promise<T>, ms: number): Promise<T | null> => Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]).catch(() => null);

/** The weather facts as the Brief says them (the weather feed's, else the morning's kept copy); {} when there is none. */
export function weatherFacts(w: WeatherData | null, spokenToo: boolean, hour: number): Facts {
  const f: Facts = {};
  if (!w) return f;
  const d = w.daily;
  if (spokenToo) f.now = `${WMO(w.current.weather_code)}, ${temp(w.current.temperature_2m)}`;
  if (d.temperature_2m_min.length) f.range = `${temp(d.temperature_2m_min[0]!).replace(/°[CF]$/, '')} to ${temp(d.temperature_2m_max[0]!)}`;
  f.rain = rainClause(rainWhen(w.hourly.precipitation_probability, hour).line);
  return f;
}

/** The Brief's spoken line, put together from what the phone can reach in a few seconds (the page itself need not be open). */
export async function briefLine(now = Date.now()): Promise<string> {
  const kept = (): WeatherData | null => {
    try {
      const k = JSON.parse(localStorage.getItem(KEPT) ?? 'null') as { at: number; w: WeatherData } | null;
      return k?.w && isoDay(new Date(k.at)) === isoDay(new Date(now)) ? k.w : null;
    } catch {
      return null;
    }
  };
  weather.start();
  news.start();
  const [w, mind, places] = await Promise.all([
    within(weather.data ? Promise.resolve(weather.data) : weather.refresh(), 4500).then((x) => x ?? kept()),
    within(brain.mind(), 7000),
    within(brain.places().then((r) => r.places ?? []), 7000),
  ]);
  const f = weatherFacts(w, true, new Date(now).getHours());
  const items = mind ? stillToday(mind.today, now) : null;
  if (items) f.diary = diarySentence(items);
  const home = places?.find((p) => p.id === 'home');
  const work = places?.find((p) => p.id === 'work');
  if (home && work && navigator.onLine !== false) {
    const c = await within(brain.commute(home, work), 7000);
    if (c) f.commute = commuteLine(c, items ? leaveFor(items, { label: work.label, query: work.query, address: work.address }, c.minutes, now) : null);
  }
  const heads = (news.data ?? []).slice(0, 3).map((x) => x.title);
  return spoken(new Date(now), summary(f), heads);
}

/**
 * Called once Ghosty is up (main.ts): waits for Home to land and a quiet moment, then reads the Brief once. Resolves with what
 * happened (the specs read it): 'spoke', or why not.
 */
export async function readOnFirstOpen(landed: Promise<void>): Promise<'spoke' | 'off' | 'read' | 'hidden' | 'busy'> {
  const flag = (): string | null => {
    try {
      return localStorage.getItem(ALOUD_FLAG);
    } catch {
      return null;
    }
  };
  const may = () => mayRead({ on: settings.get().briefAloud, voiceOn: settings.get().speak, hidden: document.hidden, flag: flag(), now: Date.now() });
  if (!may()) return !settings.get().briefAloud ? 'off' : flag() === briefDay(Date.now()) ? 'read' : 'hidden';
  await landed;
  await new Promise((r) => setTimeout(r, BEAT_MS));
  const ok = () => settings.get().briefAloud && settings.get().speak && !document.hidden;
  // (he may have switched it off, muted the phone or left meanwhile)
  if (!ok()) return 'hidden';
  // the line is put together while it waits for a quiet moment, so the voice starts as soon as there is one
  const line = briefLine();
  if (!(await whenQuiet()) || !ok()) return ok() ? 'busy' : 'hidden';
  // marked first: a second open the same day never reads it, even if this one is cut short
  try {
    localStorage.setItem(ALOUD_FLAG, briefDay(Date.now()));
  } catch {
    /* no storage: it may be read again on the next open */
  }
  await speak(await line).catch(() => undefined);
  return 'spoke';
}
