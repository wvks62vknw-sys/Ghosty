/**
 * THE LAB (BRIEF-OCT-IDEAS-3 item 4): experiments on free public data, each kept as a page: a question, the data's source (public only),
 * a chart and a table, what it showed, and the date it was run. RUN IT AGAIN reads the source again; EXPORT builds the page as a
 * document of its own, as a website draft does. Five are seeded, from the sources the daily digest and the Plan already read, so the
 * tab is never empty:
 *   quakes by month (USGS), the rain at Home against what the forecast said (Open-Meteo), the buses' punctuality near Home (the
 *   brain's transit feed: Transitous and the Bus Open Data Service), the markets' week (CoinGecko) and space weather (NOAA SWPC).
 * Nothing here costs money or needs a key; every source goes through the brain's caching proxy like the Plan's own feeds; nothing about
 * a person is read. A page is kept on this phone (`ghosty.lab`).
 */
import { fetchJson, fetchText } from '../api/feed';
import { headers } from '../api/brain';
import { home, settings } from '../state/app';

export const LAB_KEY = 'ghosty.lab';

export interface LabBar {
  label: string;
  v: number;
}
/** What one run of an experiment made: the chart, the table, the sentence and when. */
export interface LabResult {
  ran: number;
  showed: string;
  rows: [string, string][];
  bars?: LabBar[];
  /** The unit of the bars, said under the chart ("quakes", "mm", "%"). */
  unit?: string;
  /** What the experiment keeps between runs (the forecast it was told, the punctuality it saw). */
  kept?: Record<string, number>;
}

export interface Experiment {
  id: 'quakes' | 'rain' | 'bus' | 'markets' | 'space';
  title: string;
  /** The question, in his words, ending in a question mark. */
  question: string;
  /** Where the data comes from: the name, and a plain word on what it is. */
  source: string;
  /** What it cannot tell him (said on the page). */
  caveat: string;
  run(prev: LabResult | null, now: number): Promise<LabResult>;
}

const monthName = (d: Date) => d.toLocaleDateString('en-GB', { month: 'short' });
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const oneDp = (x: number) => (Math.round(x * 10) / 10).toString();

/** A list as words: "a, b and c". */
const and = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}` : (xs[0] ?? ''));

// ---------------------------------------------------------------------------------------------------------------- quakes
export const QUAKES: Experiment = {
  id: 'quakes',
  title: 'Quakes by month',
  question: 'How many big earthquakes does the world have each month?',
  source: 'Source: the US Geological Survey’s public earthquake catalogue (quakes of magnitude 5 or more), the last six full months.',
  caveat: 'It counts the quakes the survey has recorded; the latest weeks are sometimes revised later.',
  async run(_prev, now) {
    const t = new Date(now);
    const months = Array.from({ length: 6 }, (_, i) => new Date(t.getFullYear(), t.getMonth() - 6 + i, 1));
    const bars: LabBar[] = [];
    for (const m of months) {
      const next = new Date(m.getFullYear(), m.getMonth() + 1, 1);
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/count?format=text&starttime=${iso(m)}&endtime=${iso(next)}&minmagnitude=5`;
      const n = Number.parseInt((await fetchText(url, 3600)).trim(), 10);
      if (!Number.isFinite(n)) throw new Error('the survey answered with no number');
      bars.push({ label: monthName(m), v: n });
    }
    const hi = bars.reduce((a, b) => (b.v > a.v ? b : a));
    const lo = bars.reduce((a, b) => (b.v < a.v ? b : a));
    const showed = hi.v === lo.v ? `Every one of the six months had ${hi.v} quakes of magnitude 5 or more.` : `${hi.label} was the busiest of the six months with ${hi.v} quakes of magnitude 5 or more, and ${lo.label} the quietest with ${lo.v}.`;
    return { ran: now, showed, rows: bars.map((b) => [b.label, `${b.v} quakes`]), bars, unit: 'quakes of magnitude 5 or more' };
  },
};

// ---------------------------------------------------------------------------------------------------------------- rain
interface Daily {
  daily?: { time?: string[]; precipitation_sum?: (number | null)[] };
}
/** A day counts as a rain day at 1 mm, as the Met Office counts it. */
const WET = 1;
export const RAIN: Experiment = {
  id: 'rain',
  title: 'Rain against the forecast',
  question: 'Did it rain at Home when the forecast said it would?',
  source: 'Source: Open-Meteo’s free forecast and its record of the days just gone, at your saved Home.',
  caveat: 'What fell is a model’s record of the day, not a rain gauge at your door. The forecast record starts the first time this runs, so it grows from here.',
  async run(prev, now) {
    const at = home();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${at.lat.toFixed(3)}&longitude=${at.lon.toFixed(3)}&daily=precipitation_sum&past_days=7&forecast_days=3&timezone=auto`;
    const j = await fetchJson<Daily>(url, 1800);
    const days = j.daily?.time ?? [];
    const mm = j.daily?.precipitation_sum ?? [];
    if (!days.length) throw new Error('the weather service answered with no days');
    const today = iso(new Date(now));
    const fell = new Map<string, number>();
    const told = new Map<string, number>();
    days.forEach((d, i) => {
      const v = Number(mm[i] ?? 0);
      if (d < today) fell.set(d, v);
      else told.set(d, v);
    });
    // what the forecast said on earlier runs, for the days that have since happened
    const kept = { ...(prev?.kept ?? {}) } as Record<string, number>;
    const rows: [string, string][] = [];
    let matched = 0;
    let compared = 0;
    for (const [d, was] of Object.entries(kept).sort(([a], [b]) => a.localeCompare(b))) {
      const f = fell.get(d);
      if (f === undefined) continue;
      compared++;
      const same = (was >= WET) === (f >= WET);
      if (same) matched++;
      rows.push([new Date(`${d}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), `forecast ${oneDp(was)} mm · fell ${oneDp(f)} mm${same ? '' : ' · not as forecast'}`]);
    }
    for (const [d, v] of told) kept[d] = v;
    for (const d of Object.keys(kept)) if (d < new Date(now - 30 * 86_400_000).toISOString().slice(0, 10)) delete kept[d];
    const bars: LabBar[] = [...fell].map(([d, v]) => ({ label: new Date(`${d}T12:00`).toLocaleDateString('en-GB', { weekday: 'short' }), v }));
    const wetDays = bars.filter((b) => b.v >= WET).length;
    const ahead = [...told].filter(([, v]) => v >= WET).map(([d]) => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { weekday: 'long' }));
    let showed: string;
    if (compared) showed = `Of the ${compared} ${compared === 1 ? 'day' : 'days'} I had a forecast for, ${matched} turned out as forecast (rain or dry). It rained on ${wetDays} of the last seven.`;
    else showed = `It rained on ${wetDays} of the last seven days at ${at.name || 'Home'}. I have kept today’s forecast${ahead.length ? ` (rain expected ${and(ahead)})` : ' (dry for the next three days)'}; run it again in a few days and I’ll set it against what fell.`;
    return { ran: now, showed, rows: rows.length ? rows : bars.map((b) => [b.label, `${oneDp(b.v)} mm fell`] as [string, string]), bars, unit: 'mm of rain', kept };
  },
};

// ---------------------------------------------------------------------------------------------------------------- bus
interface Veh {
  delayS?: number | null;
  line?: string;
}
/** On time, as the Traffic Commissioner counts it: from a minute early to under six minutes late. */
export const onTime = (s: number): boolean => s >= -60 && s <= 359;
export const BUS: Experiment = {
  id: 'bus',
  title: 'How punctual the buses are',
  question: 'How punctual are the buses near Home?',
  source: 'Source: the live bus feed my brain reads (Transport for West Midlands or the Bus Open Data Service when they are linked, bustimes.org’s public feed otherwise), within about 5 km of Home.',
  caveat: 'It is a look at this moment, not a timetable record; it grows a point each time you run it. On time is a minute early to under six minutes late.',
  async run(prev, now) {
    const at = home();
    const d = 0.045;
    const dl = d / Math.max(0.2, Math.cos((at.lat * Math.PI) / 180));
    const box = [at.lon - dl, at.lat - d, at.lon + dl, at.lat + d].map((x) => x.toFixed(3)).join(',');
    const r = await fetch(`/api/transit?bbox=${box}`, { headers: headers() });
    if (!r.ok) throw new Error(`the bus feed answered ${r.status}`);
    const j = (await r.json()) as { vehicles?: Veh[]; error?: string };
    if (j.error) throw new Error(j.error);
    const all = j.vehicles ?? [];
    const timed = all.filter((v) => typeof v.delayS === 'number') as { delayS: number }[];
    const history = Object.entries(prev?.kept ?? {}).filter(([k]) => /^t\d+$/.test(k)).map(([k, v]) => [Number(k.slice(1)), v] as [number, number]);
    if (!timed.length) {
      return { ran: now, showed: all.length ? `I can see ${all.length} ${all.length === 1 ? 'vehicle' : 'vehicles'} near Home, but this feed gives no delay times, so I can’t say how punctual they are.` : 'I can see no buses near Home just now.', rows: [['Vehicles seen', String(all.length)], ['With a delay time', '0']], kept: prev?.kept };
    }
    const good = timed.filter((v) => onTime(v.delayS)).length;
    const pct = Math.round((good / timed.length) * 100);
    const late = timed.filter((v) => v.delayS > 359).length;
    const early = timed.filter((v) => v.delayS < -60).length;
    const kept: Record<string, number> = Object.fromEntries([...history, [now, pct] as [number, number]].slice(-12).map(([t, v]) => [`t${t}`, v]));
    const bars: LabBar[] = Object.entries(kept).map(([k, v]) => ({ label: new Date(Number(k.slice(1))).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), v }));
    return {
      ran: now,
      showed: `${pct}% of the ${timed.length} buses with a delay time were on time just now: ${late} late, ${early} early.`,
      rows: [['On time', `${good} of ${timed.length}`], ['Late (6 minutes or more)', String(late)], ['Early (over a minute)', String(early)], ['Seen near Home', String(all.length)]],
      bars,
      unit: '% on time, one point for each run',
      kept,
    };
  },
};

// ---------------------------------------------------------------------------------------------------------------- markets
interface Coin {
  symbol: string;
  name: string;
  current_price: number;
  sparkline_in_7d?: { price?: number[] };
}
export const MARKETS: Experiment = {
  id: 'markets',
  title: 'The markets’ week',
  question: 'How did the markets move this week?',
  source: 'Source: CoinGecko’s free prices for eight coins, their seven days of prices to now (no free source gives share prices any more).',
  caveat: 'Coins only, and a week is a short time: this is what happened, not what will.',
  async run(_prev, now) {
    const cur = settings.get().currency;
    const j = await fetchJson<Coin[]>(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${cur}&ids=bitcoin,ethereum,solana,ripple,dogecoin,cardano,chainlink,litecoin&price_change_percentage=24h&sparkline=true`, 90);
    const rows = (Array.isArray(j) ? j : [])
      .map((c) => {
        const p = (c.sparkline_in_7d?.price ?? []).filter((x) => Number.isFinite(x));
        return p.length > 1 && p[0] ? { name: c.symbol.toUpperCase(), change: ((p.at(-1)! - p[0]!) / p[0]!) * 100 } : null;
      })
      .filter((x): x is { name: string; change: number } => !!x)
      .sort((a, b) => b.change - a.change);
    if (!rows.length) throw new Error('no prices came back');
    const sign = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(1)}%`;
    const best = rows[0]!;
    const worst = rows.at(-1)!;
    const showed = rows.length === 1 ? `${best.name} moved ${sign(best.change)} over the week.` : `Over the week ${best.name} led at ${sign(best.change)} and ${worst.name} lagged at ${sign(worst.change)}.`;
    return { ran: now, showed, rows: rows.map((r) => [r.name, sign(r.change)] as [string, string]), bars: rows.map((r) => ({ label: r.name, v: Math.round(r.change * 10) / 10 })), unit: '% over seven days' };
  },
};

// ---------------------------------------------------------------------------------------------------------------- space
/** NOAA's scale: Kp 5 is a minor storm (G1) and 9 an extreme one (G5). */
export function kpWords(kp: number): string {
  if (kp < 4) return 'quiet';
  if (kp < 5) return 'active, but not a storm';
  const g = Math.min(5, Math.floor(kp) - 4);
  return `a ${['minor', 'moderate', 'strong', 'severe', 'extreme'][g - 1]} geomagnetic storm (G${g})`;
}
export const SPACE: Experiment = {
  id: 'space',
  title: 'Space weather today',
  question: 'How stormy is space weather today?',
  source: 'Source: the US NOAA Space Weather Prediction Center’s public planetary K index, one reading every three hours.',
  caveat: 'Kp measures how disturbed the Earth’s magnetic field is; it is a record of the last day, not a forecast.',
  async run(_prev, now) {
    const j = await fetchJson<string[][]>('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', 600);
    const rows = (Array.isArray(j) ? j : []).filter((r) => r[0] !== 'time_tag' && Number.isFinite(Number(r[1]))).slice(-8);
    if (!rows.length) throw new Error('no readings came back');
    const bars = rows.map((r) => ({ label: new Date(`${r[0]!.replace(' ', 'T').replace(/\.\d+$/, '')}Z`).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }), v: Number(r[1]) }));
    const top = bars.reduce((a, b) => (b.v > a.v ? b : a));
    return {
      ran: now,
      showed: `The highest reading of the last ${rows.length * 3} hours was Kp ${oneDp(top.v)}: ${kpWords(top.v)}.`,
      rows: bars.map((b) => [b.label, `Kp ${oneDp(b.v)}`] as [string, string]),
      bars,
      unit: 'Kp, 0 quiet to 9 extreme',
    };
  },
};

export const EXPERIMENTS: Experiment[] = [QUAKES, RAIN, BUS, MARKETS, SPACE];

// ---------------------------------------------------------------------------------------------------------------- kept pages
export interface LabStore {
  pages: Partial<Record<Experiment['id'], LabResult>>;
}
export function loadLab(): LabStore {
  try {
    const v = JSON.parse(localStorage.getItem(LAB_KEY) ?? 'null') as LabStore | null;
    if (v && typeof v.pages === 'object' && v.pages) return { pages: v.pages };
  } catch {
    /* the lab starts empty */
  }
  return { pages: {} };
}
export function saveLab(s: LabStore): void {
  try {
    localStorage.setItem(LAB_KEY, JSON.stringify(s));
  } catch {
    /* kept for this visit only */
  }
}

/** Why a run did not work, in his words. */
export const labWhy = (e: unknown): string =>
  e instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false)
    ? 'I can’t reach the source with no signal. Run it again when you’re back online.'
    : `The source didn’t answer (${String((e as Error)?.message ?? e).slice(0, 80)}). Run it again in a little while.`;

/** The date a page was run, as he reads it. */
export const ranWords = (t: number): string => new Date(t).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** A bar chart as SVG markup (for the exported page): bars from a zero line, the largest filling the height. */
export function barsSvg(bars: LabBar[], w = 560, hgt = 180): string {
  if (!bars.length) return '';
  const lo = Math.min(0, ...bars.map((b) => b.v));
  const hi = Math.max(0, ...bars.map((b) => b.v));
  const span = hi - lo || 1;
  const gap = 8;
  const bw = Math.max(6, (w - gap * (bars.length + 1)) / bars.length);
  const zero = hgt - 22 - ((0 - lo) / span) * (hgt - 44);
  const out = bars.map((b, i) => {
    const x = gap + i * (bw + gap);
    const y1 = hgt - 22 - ((b.v - lo) / span) * (hgt - 44);
    return `<rect x="${x.toFixed(1)}" y="${Math.min(y1, zero).toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(1, Math.abs(zero - y1)).toFixed(1)}"/><text x="${(x + bw / 2).toFixed(1)}" y="${hgt - 6}" text-anchor="middle" font-size="11">${esc(b.label)}</text><text x="${(x + bw / 2).toFixed(1)}" y="${(Math.min(y1, zero) - 4).toFixed(1)}" text-anchor="middle" font-size="11">${esc(String(b.v))}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${hgt}" role="img" aria-label="Chart" width="100%" fill="currentColor">${out.join('')}</svg>`;
}

/** The page, built as a document of its own (no script, no outside address; the browser's own colours and fonts). */
export function pageHtml(e: Experiment, r: LabResult): string {
  return `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(e.title)}</title>
<style>:root{color-scheme:light dark}body{font:16px/1.5 system-ui,sans-serif;margin:0 auto;padding:24px 16px;max-width:42rem;background:Canvas;color:CanvasText}h1{font-size:1.4rem;line-height:1.25;margin:0 0 .5rem}p,li{overflow-wrap:anywhere}small,.fine{opacity:.7}table{border-collapse:collapse;width:100%;margin:1rem 0}td{padding:.35rem 0;border-bottom:1px solid currentColor}td+td{text-align:right}</style></head>
<body><h1>${esc(e.question)}</h1><p>${esc(e.source)}</p>${r.bars ? barsSvg(r.bars) : ''}${r.unit ? `<p class="fine">${esc(r.unit)}</p>` : ''}
<table>${r.rows.map(([a, b]) => `<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`).join('')}</table>
<p><b>What it showed.</b> ${esc(r.showed)}</p><p class="fine">${esc(e.caveat)}</p><p class="fine">Run ${esc(ranWords(r.ran))}, from Ghosty’s lab. Free public data only.</p></body></html>`;
}
