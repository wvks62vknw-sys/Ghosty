/**
 * WEATHER (the APPS ROUND, SEE's flagship): a weather app of its own, full screen. For each of his saved places (Memory → ABOUT YOU →
 * PLACES) and any city he adds:
 *   - now: the temperature, what it feels like, the sky, today's high and low, and Ghosty's dry line on it;
 *   - the next hour's rain, quarter hour by quarter hour;
 *   - the next 24 hours as a graph: temperature, rain, wind or UV;
 *   - ten days, each with its range against the week's;
 *   - the details: feels like, dew point, humidity, pressure and its trend, visibility, wind and gusts, UV, sunrise and sunset, the
 *     daylight gained on yesterday, the moon, and today against yesterday;
 *   - the air: its quality and the pollen;
 *   - the rain radar (features/eye/rain.ts) a tap away.
 * Free and keyless: Open-Meteo's forecast and air quality. Asked only about saved places and named cities, never about where he is
 * (the brain never gets live GPS). Each place's last forecast is kept on the phone, so with no signal it still shows, with its age.
 */
import { brain } from '../api/brain';
import { fetchJson } from '../api/feed';
import { clear, h } from '../core/dom';
import { airBand, temp, WMO } from '../data/weather';
import { rainLine } from '../features/eye/sets';
import { home } from '../state/app';
import { button, modal } from '../ui/components';
import * as W from './words';

interface Place { id: string; label: string; lat: number; lon: number; city?: boolean }
interface Forecast {
  at: number;
  current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; dew_point_2m: number; weather_code: number; wind_speed_10m: number; wind_gusts_10m: number; wind_direction_10m: number; pressure_msl: number; visibility: number; uv_index: number };
  minutely_15?: { time: number[]; precipitation: number[] };
  hourly: { time: number[]; temperature_2m: number[]; precipitation_probability: (number | null)[]; precipitation: number[]; wind_speed_10m: number[]; uv_index: number[]; pressure_msl: number[] };
  daily: { time: number[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: (number | null)[]; sunrise: number[]; sunset: number[]; uv_index_max: number[]; daylight_duration: number[] };
  air?: { european_aqi?: number; pm2_5?: number; alder_pollen?: number | null; birch_pollen?: number | null; grass_pollen?: number | null };
}

const CITIES = 'ghosty.weather.cities';
const KEPT = 'ghosty.weather.kept';
const read = <T>(k: string, d: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? d;
  } catch {
    return d;
  }
};
const write = (k: string, v: unknown): void => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* not kept: the screen still shows it */
  }
};
const hm = (s: number) => new Date(s * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const dir = (d: number) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(d / 45) % 8];

/** What the app shows, for the specs (window.__ghosty.weatherApp). */
export const weatherState = { open: false, place: '', state: '' as '' | 'loading' | 'ready' | 'offline' | 'error', days: 0, hours: 0, rain: '', line: '' };

async function getForecast(p: Place): Promise<Forecast> {
  const q = `latitude=${p.lat.toFixed(3)}&longitude=${p.lon.toFixed(3)}`;
  const f = await fetchJson<Forecast>(`https://api.open-meteo.com/v1/forecast?${q}&current=temperature_2m,apparent_temperature,relative_humidity_2m,dew_point_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl,visibility,uv_index&minutely_15=precipitation&forecast_minutely_15=8&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,uv_index,pressure_msl&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max,daylight_duration&forecast_days=10&past_days=1&timezone=auto&timeformat=unixtime`, 600);
  const air = await fetchJson<{ current?: Forecast['air'] }>(`https://air-quality-api.open-meteo.com/v1/air-quality?${q}&current=european_aqi,pm2_5,alder_pollen,birch_pollen,grass_pollen&timezone=auto`, 1800).catch(() => null);
  return { ...f, at: Date.now(), air: air?.current };
}

/** The 24-hour graph, drawn in SVG from the tokens: a line for temperature and wind, bars for rain and UV. */
function graph(f: Forecast, kind: 'temp' | 'rain' | 'wind' | 'uv'): SVGSVGElement {
  const now = Date.now() / 1000;
  const start = f.hourly.time.findIndex((t) => t >= now - 1800);
  const idx = Array.from({ length: 24 }, (_, i) => start + i).filter((i) => i >= 0 && i < f.hourly.time.length);
  const vals = idx.map((i) => (kind === 'temp' ? f.hourly.temperature_2m[i]! : kind === 'rain' ? f.hourly.precipitation_probability[i] ?? 0 : kind === 'wind' ? f.hourly.wind_speed_10m[i]! : f.hourly.uv_index[i]!));
  const Wd = 340;
  const Hd = 120;
  const lo = kind === 'temp' ? Math.min(...vals) - 1 : 0;
  const hi = kind === 'rain' ? 100 : Math.max(lo + 1, ...vals) + (kind === 'temp' ? 1 : 0.5);
  const x = (i: number) => 8 + (i * (Wd - 16)) / Math.max(1, vals.length - 1);
  const y = (v: number) => Hd - 22 - ((v - lo) / (hi - lo)) * (Hd - 40);
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${Wd} ${Hd}`);
  svg.setAttribute('class', `wxgraph wx-${kind}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${kind === 'temp' ? 'Temperature' : kind === 'rain' ? 'Chance of rain' : kind === 'wind' ? 'Wind' : 'UV'} for the next 24 hours`);
  const add = (tag: string, a: Record<string, string | number>, text?: string) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(a)) e.setAttribute(k, String(v));
    if (text) e.textContent = text;
    svg.append(e);
  };
  if (kind === 'rain' || kind === 'uv') vals.forEach((v, i) => add('rect', { x: x(i) - 5, y: y(v), width: 10, height: Math.max(1, Hd - 22 - y(v)), rx: 2, class: 'wxbar' }));
  else add('polyline', { points: vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' '), class: 'wxline', fill: 'none' });
  // labels every six hours: the hour under, the value over
  idx.forEach((t, i) => {
    if (i % 6) return;
    // (the first label starts at the edge rather than centring on it, so nothing is cut)
    const anchor = i ? 'middle' : 'start';
    const lx = i ? x(i) : 2;
    add('text', { x: lx, y: Hd - 6, class: 'wxlab', 'text-anchor': anchor }, i ? hm(f.hourly.time[t]!) : 'Now');
    const v = vals[i]!;
    add('text', { x: lx, y: Math.max(12, y(v) - 6), class: 'wxval', 'text-anchor': anchor }, kind === 'temp' ? `${Math.round(v)}°` : kind === 'rain' ? `${Math.round(v)}%` : kind === 'wind' ? `${Math.round(v)}` : `${Math.round(v)}`);
  });
  return svg;
}

export async function openWeather(want?: string): Promise<void> {
  const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
  if (g) g.weatherApp = weatherState;
  Object.assign(weatherState, { open: true, state: 'loading', days: 0, hours: 0, rain: '', line: '' });
  const chips = h('div.wxplaces', { role: 'tablist', 'aria-label': 'Places' });
  const body = h('div.wxbody', { dataset: { case: 'keep' } });
  const status = h('p.note.wxstatus', { role: 'status', dataset: { case: 'keep' } });
  status.hidden = true;
  const cityIn = h('input.wxcity', { placeholder: 'Add a town or city', 'aria-label': 'Add a town or city', autocomplete: 'off', enterKeyHint: 'search' }) as HTMLInputElement;
  const addBtn = button('ADD', () => void addCity());
  const root = h('div.wxapp', { dataset: { case: 'keep' } }, chips, h('div.wxadd', cityIn, addBtn), status, body, h('small.dim.wxcredit', 'Forecast and air: Open-Meteo (free, no key), asked about the place shown, never about where you are.'));
  modal('WEATHER', root, () => (weatherState.open = false));
  let graphKind: 'temp' | 'rain' | 'wind' | 'uv' = 'temp';
  let places: Place[] = [];
  let current: Place | null = null;
  const H = home();
  try {
    const saved = (await brain.places()).places ?? [];
    places = saved.map((p) => ({ id: p.id, label: p.label, lat: p.lat, lon: p.lon }));
  } catch {
    places = [];
  }
  if (!places.some((p) => p.id === 'home')) places.unshift({ id: 'home', label: H.name || 'Home', lat: H.lat, lon: H.lon });
  places.push(...read<Place[]>(CITIES, []).map((c) => ({ ...c, city: true })));
  const paintChips = () => {
    clear(chips);
    for (const p of places) {
      const b = button(p.label, () => void show(p));
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(current?.id === p.id));
      b.classList.toggle('on', current?.id === p.id);
      b.dataset.place = p.id;
      chips.append(b);
    }
  };
  const say = (words: string, state: string) => {
    status.textContent = words;
    status.dataset.state = state;
    status.hidden = !words;
  };
  async function addCity(): Promise<void> {
    const q = cityIn.value.trim();
    if (!q) return;
    try {
      const r = await fetchJson<{ results?: { name: string; latitude: number; longitude: number; country?: string }[] }>(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=en&format=json`, 86400);
      const c = r.results?.[0];
      if (!c) return say(W.WX_CITY_NONE(q), 'empty');
      const p: Place = { id: `city-${c.name.toLowerCase()}-${c.latitude.toFixed(2)}`, label: c.name, lat: c.latitude, lon: c.longitude, city: true };
      if (!places.some((x) => x.id === p.id)) {
        places.push(p);
        write(CITIES, places.filter((x) => x.city).map(({ city: _c, ...x }) => x));
      }
      cityIn.value = '';
      await show(p);
    } catch {
      say(navigator.onLine === false ? W.WX_NONE_OFFLINE : W.WX_DOWN, navigator.onLine === false ? 'offline' : 'error');
    }
  }
  cityIn.addEventListener('keydown', (e) => e.key === 'Enter' && void addCity());
  async function show(p: Place): Promise<void> {
    current = p;
    weatherState.place = p.label;
    paintChips();
    const kept = read<Record<string, Forecast>>(KEPT, {});
    let f: Forecast | null = null;
    if (navigator.onLine !== false) {
      say(W.WX_LOADING, 'loading');
      weatherState.state = 'loading';
      try {
        f = await getForecast(p);
        kept[p.id] = f;
        write(KEPT, kept);
        say('', '');
      } catch {
        f = kept[p.id] ?? null;
        say(f ? W.WX_OFFLINE(new Date(f.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) : W.WX_DOWN, f ? 'offline' : 'error');
      }
    } else {
      f = kept[p.id] ?? null;
      say(f ? W.WX_OFFLINE(new Date(f.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })) : W.WX_NONE_OFFLINE, 'offline');
    }
    if (current !== p) return;
    if (!f) {
      weatherState.state = navigator.onLine === false ? 'offline' : 'error';
      clear(body, button('TRY AGAIN', () => void show(p), 'on'));
      return;
    }
    weatherState.state = status.dataset.state === 'offline' ? 'offline' : 'ready';
    paint(f);
  }
  function paint(f: Forecast): void {
    const c = f.current;
    const now = Date.now();
    const d0 = f.daily.time.findIndex((t) => new Date(t * 1000).toDateString() === new Date().toDateString());
    const today = d0 >= 0 ? d0 : 1;
    const slots = (f.minutely_15?.time ?? []).map((t, i) => ({ t: t * 1000, mm: f.minutely_15!.precipitation[i] ?? 0 }));
    const rain = rainLine(slots, now, current!.label) || '';
    weatherState.rain = rain;
    const line = W.dryLine({ code: c.weather_code, tempC: c.temperature_2m, feelsC: c.apparent_temperature, windKmh: c.wind_speed_10m, rainNext: slots.slice(0, 4).some((s) => s.mm >= 0.1), uv: c.uv_index });
    weatherState.line = line;
    const hero = h('section.wxhero', h('b.wxtemp', temp(c.temperature_2m)), h('span.wxsky', WMO(c.weather_code)), h('span.wxhl', `H ${temp(f.daily.temperature_2m_max[today]!)} · L ${temp(f.daily.temperature_2m_min[today]!)} · feels like ${temp(c.apparent_temperature)}`), h('em.wxdry', line));
    // the next hour, quarter by quarter
    const next = slots.filter((s) => s.t + 15 * 60_000 > now).slice(0, 4);
    const hour = h('section.wxsec', h('div.lab', 'NEXT HOUR'), h('p.wxrain', rain || 'No rain timing for this place right now.'), h('div.wxquarters', ...next.map((s) => h('span.wxq', { style: { '--mm': String(Math.min(1, s.mm / 2)) } as unknown as Record<string, string>, title: `${s.mm.toFixed(1)} mm` }, h('i'), h('small', new Date(s.t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))))));
    // the next 24 hours
    const seg = h('div.chips.wxseg', { role: 'group', 'aria-label': 'What the graph shows' });
    const holder = h('div.wxgraphbox');
    const drawGraph = () => {
      clear(holder, graph(f, graphKind));
      for (const b of seg.children) b.classList.toggle('on', (b as HTMLElement).dataset.kind === graphKind);
    };
    for (const [k, n] of [['temp', 'TEMPERATURE'], ['rain', 'RAIN'], ['wind', 'WIND'], ['uv', 'UV']] as const) {
      const b = button(n, () => ((graphKind = k), drawGraph()));
      b.dataset.kind = k;
      seg.append(b);
    }
    drawGraph();
    weatherState.hours = 24;
    const hours = h('section.wxsec', h('div.lab', 'NEXT 24 HOURS'), seg, holder);
    // ten days, each range against the whole fortnight's
    const days = f.daily.time.map((t, i) => ({ t, i })).filter((d) => d.i >= today).slice(0, 10);
    const lo = Math.min(...days.map((d) => f.daily.temperature_2m_min[d.i]!));
    const hi = Math.max(...days.map((d) => f.daily.temperature_2m_max[d.i]!));
    weatherState.days = days.length;
    const tenDays = h('section.wxsec', h('div.lab', `${days.length} DAYS`), ...days.map((d, k) => {
      const mn = f.daily.temperature_2m_min[d.i]!;
      const mx = f.daily.temperature_2m_max[d.i]!;
      const span = Math.max(1, hi - lo);
      return h('div.wxday', h('b', k === 0 ? 'Today' : new Date(d.t * 1000).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })), h('span.wxdsky', WMO(f.daily.weather_code[d.i]!)), h('span.wxdrain', `${f.daily.precipitation_probability_max[d.i] ?? 0}%`), h('span.wxdlo', temp(mn)), h('span.wxbarbox', h('i', { style: { left: `${((mn - lo) / span) * 100}%`, right: `${100 - ((mx - lo) / span) * 100}%` } })), h('span.wxdhi', temp(mx)));
    }));
    // the details
    const nowH = f.hourly.time.findIndex((t) => t * 1000 >= now - 1800_000);
    const p3 = nowH >= 3 ? f.hourly.pressure_msl[nowH - 3]! : c.pressure_msl;
    const y24 = nowH >= 24 ? f.hourly.temperature_2m[nowH - 24]! : c.temperature_2m;
    const moon = W.moonPhase(now);
    const cell = (k: string, v: string, s = '') => h('div.wxcell', h('small', k), h('b', v), s ? h('span', s) : null);
    const details = h('section.wxsec', h('div.lab', 'DETAILS'), h('div.wxgrid',
      cell('FEELS LIKE', temp(c.apparent_temperature), c.apparent_temperature < c.temperature_2m - 1 ? 'the wind takes the edge off' : ''),
      cell('DEW POINT', temp(c.dew_point_2m), `${Math.round(c.relative_humidity_2m)}% humidity`),
      cell('PRESSURE', `${Math.round(c.pressure_msl)} hPa`, W.pressureTrend(c.pressure_msl, p3)),
      cell('VISIBILITY', c.visibility >= 10000 ? `${Math.round(c.visibility / 1000)} km+` : `${(c.visibility / 1000).toFixed(1)} km`),
      cell('WIND', `${Math.round(c.wind_speed_10m)} km/h ${dir(c.wind_direction_10m)}`, `gusts ${Math.round(c.wind_gusts_10m)} km/h`),
      cell('UV', String(Math.round(c.uv_index)), W.uvWord(c.uv_index)),
      cell('SUNRISE', hm(f.daily.sunrise[today]!), `sunset ${hm(f.daily.sunset[today]!)}`),
      cell('DAYLIGHT', `${Math.floor(f.daily.daylight_duration[today]! / 3600)} h ${Math.round((f.daily.daylight_duration[today]! % 3600) / 60)} min`, today > 0 ? W.daylightLine(f.daily.daylight_duration[today]!, f.daily.daylight_duration[today - 1]!) : ''),
      cell('MOON', moon.name, `${Math.round(moon.lit * 100)}% lit`),
      cell('AGAINST YESTERDAY', W.againstYesterday(c.temperature_2m, y24).replace(/ at this time\.$/, '')),
    ));
    const a = f.air;
    const air = a?.european_aqi != null ? h('section.wxsec', h('div.lab', 'AIR'), h('div.wxgrid',
      cell('AIR QUALITY', airBand(a.european_aqi).label, `index ${Math.round(a.european_aqi)}${a.pm2_5 != null ? ` · PM2.5 ${Math.round(a.pm2_5)}` : ''}`),
      cell('POLLEN', `grass ${W.pollenWord(a.grass_pollen)}`, `birch ${W.pollenWord(a.birch_pollen)} · alder ${W.pollenWord(a.alder_pollen)}`),
    )) : null;
    const radar = button('RAIN RADAR', () => void import('../features/eye/rain').then((m) => m.openRainRadar()));
    radar.dataset.act = 'radar';
    clear(body, hero, hour, hours, tenDays, details, air ?? '', h('div.row.wrap.wxacts', radar));
  }
  const first = (want && places.find((p) => p.label.toLowerCase() === want.toLowerCase())) || places[0]!;
  await show(first);
}
