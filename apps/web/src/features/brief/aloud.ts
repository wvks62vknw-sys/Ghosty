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
import { coins, fresh, money as moneyOf } from '../../data/markets';
import { fuelEstimate, nearPlaces, nearShort } from '../../further/spendnear';
import { passagesOf } from '../../library/local';
import { settings } from '../../state/app';
import { loadTodos } from '../agenda/todo';
import { dueToday } from '../agenda/todowords';
import { commuteLine, diarySentence, digestDay, isoDay, leaveFor, marketsClause, rainClause, rainWhen, spoken, stillToday, summary, todoClause, tomorrowClause, tonight, type Facts } from './day';

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

/**
 * The weather facts as the Brief says them (the weather feed's, else the morning's kept copy); {} when there is none. From 18:00
 * (planlane:brief) the day's range has gone by: tonight's rain, then tomorrow's range and rain instead.
 */
export function weatherFacts(w: WeatherData | null, spokenToo: boolean, hour: number): Facts {
  const f: Facts = {};
  if (!w) return f;
  const d = w.daily;
  const evening = hour >= 18;
  if (spokenToo) f.now = `${WMO(w.current.weather_code)}, ${temp(w.current.temperature_2m)}`;
  if (!evening && d.temperature_2m_min.length) f.range = `${temp(d.temperature_2m_min[0]!).replace(/°[CF]$/, '')} to ${temp(d.temperature_2m_max[0]!)}`;
  const rain = rainClause(rainWhen(w.hourly.precipitation_probability, hour).line);
  f.rain = evening ? tonight(rain) : rain;
  if (evening && d.temperature_2m_min.length > 1) f.tomorrow = tomorrowClause(temp(d.temperature_2m_min[1]!), temp(d.temperature_2m_max[1]!), w.hourly.precipitation_probability);
  return f;
}

/** [planlane:brief] His to-dos due today or late, as the day's sentence says them (kept on this phone; '' with none). */
export function todoFacts(now: number): string {
  try {
    return todoClause(dueToday(loadTodos(), now), isoDay(new Date(now)));
  } catch {
    return '';
  }
}

/**
 * The Brief's top headlines, as the page shows them: the BBC's live feed, else this morning's digest (the phone's own copy of the
 * library) when the feed can't be reached. An older day's digest is not said as today's news: none then.
 */
export async function briefHeadlines(now = Date.now(), n = 3): Promise<string[]> {
  if (news.data?.length) return news.data.slice(0, n).map((x) => x.title);
  const d = await within(passagesOf('m-notes_daily').then(digestDay), 3000);
  return d && d.day === isoDay(new Date(now)) ? d.headlines.slice(0, n).map((x) => x.title) : [];
}

/** The Brief's spoken line, put together from what the phone can reach in a few seconds (the page itself need not be open). */
export async function briefLine(now = Date.now()): Promise<string> {
  const [f, heads] = await Promise.all([briefFacts(now, true), briefHeadlines(now)]);
  return spoken(new Date(now), summary(f), heads);
}

/**
 * The Brief's facts, from the same sources the page reads, each given a few seconds: the weather, the diary, his to-dos, the drive
 * and its fuel, the money near a saved place, and the markets only from the Markets screen's own fresh prices (nothing fetched).
 */
export async function briefFacts(now = Date.now(), spokenToo = false): Promise<Facts> {
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
  const [w, mind, places, spend] = await Promise.all([
    within(weather.data ? Promise.resolve(weather.data) : weather.refresh(), 4500).then((x) => x ?? kept()),
    within(brain.mind(), 7000),
    within(brain.places().then((r) => r.places ?? []), 7000),
    within(brain.spending(), 7000),
  ]);
  const f = weatherFacts(w, spokenToo, new Date(now).getHours());
  const items = mind ? stillToday(mind.today, now) : null;
  if (items) f.diary = new Date(now).getHours() >= 18 ? tonight(diarySentence(items)) : diarySentence(items);
  const todo = todoFacts(now);
  if (todo) f.todo = todo;
  const home = places?.find((p) => p.id === 'home');
  const work = places?.find((p) => p.id === 'work');
  if (home && work && navigator.onLine !== false) {
    const c = await within(brain.commute(home, work), 7000);
    if (c) f.commute = commuteLine(c, items ? leaveFor(items, { label: work.label, query: work.query, address: work.address }, c.minutes, now) : null);
    const fuel = c ? fuelEstimate(c.km) : null;
    if (fuel) f.cost = fuel.line;
  }
  // (the page's paintMoney: this month's statement only, the first place it names)
  const d = new Date(now);
  const near = spend?.kept && spend.month === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` && places ? nearPlaces(spend.rows, places)[0] : undefined;
  if (near) f.money = nearShort(near);
  const coin = fresh(coins) ? coins.data?.[0] : undefined;
  const markets = coin ? marketsClause({ name: coin.name, price: moneyOf(coin.price, coin.cur), change: coin.change }) : '';
  if (markets) f.markets = markets;
  return f;
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
