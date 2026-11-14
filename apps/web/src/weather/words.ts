/**
 * WEATHER (the APPS ROUND, SEE's flagship): the words and the sums, pure, so the seeweather spec reads exactly what the app says.
 */
/* (the app's states, said in his words) */
export const WX_LOADING = 'Getting the forecast…';
export const WX_OFFLINE = (when: string): string => `No signal: this is the forecast from ${when}.`;
export const WX_NONE_OFFLINE = 'No signal, and no forecast kept for this place yet. It comes with the connection.';
export const WX_DOWN = 'The forecast service didn’t answer. Pull down or tap TRY AGAIN in a minute.';
export const WX_CITY_NONE = (q: string): string => `I couldn’t find “${q}”. Try a town or city name.`;

/** The moon tonight from the date alone (a mean synodic month from a known new moon): its phase name and how lit, 0 to 1. */
export function moonPhase(ms: number): { name: string; lit: number } {
  const days = (ms - Date.UTC(2000, 0, 6, 18, 14)) / 86400000;
  const age = ((days % 29.530588853) + 29.530588853) % 29.530588853;
  const f = age / 29.530588853;
  const lit = (1 - Math.cos(2 * Math.PI * f)) / 2;
  const name = f < 0.03 || f > 0.97 ? 'New moon' : f < 0.22 ? 'Waxing crescent' : f < 0.28 ? 'First quarter' : f < 0.47 ? 'Waxing gibbous' : f < 0.53 ? 'Full moon' : f < 0.72 ? 'Waning gibbous' : f < 0.78 ? 'Last quarter' : 'Waning crescent';
  return { name, lit };
}
/** Daylight gained or lost against yesterday: "+2 min 3 s of daylight", "−1 min 50 s". */
export function daylightLine(todayS: number, yesterdayS: number): string {
  const d = Math.round(todayS - yesterdayS);
  const a = Math.abs(d);
  const m = Math.floor(a / 60);
  const s = a % 60;
  return `${d >= 0 ? '+' : '−'}${m ? `${m} min ` : ''}${s} s of daylight on yesterday`;
}
/** The pressure's trend over the last three hours, as a forecaster says it. */
export function pressureTrend(nowHpa: number, threeHoursAgo: number): string {
  const d = nowHpa - threeHoursAgo;
  return d >= 1.5 ? 'rising' : d <= -1.5 ? 'falling' : 'steady';
}
/** Today against yesterday, at the same hour: "3° warmer than yesterday", "about the same as yesterday". */
export function againstYesterday(nowC: number, yesterdayC: number): string {
  const d = Math.round(nowC - yesterdayC);
  return d === 0 ? 'About the same as yesterday at this time.' : `${Math.abs(d)}° ${d > 0 ? 'warmer' : 'colder'} than yesterday at this time.`;
}
/** Pollen in words from grains per m³ (the UK's bands, as the Met Office counts grass). */
export const pollenWord = (g: number | null | undefined): string => (g == null ? 'no count' : g < 30 ? 'low' : g < 50 ? 'moderate' : g < 150 ? 'high' : 'very high');
/** UV in words (the WHO's bands). */
export const uvWord = (u: number): string => (u < 3 ? 'low' : u < 6 ? 'moderate' : u < 8 ? 'high' : u < 11 ? 'very high' : 'extreme');
/** Ghosty's dry line on the weather: one sentence, plainly his. */
export function dryLine(o: { code: number; tempC: number; feelsC: number; windKmh: number; rainNext: boolean; uv: number }): string {
  if (o.code >= 95) return 'Thunder about. Maybe admire it from indoors.';
  if (o.rainNext) return 'Rain on its way. The umbrella earns its keep today.';
  if (o.code >= 71 && o.code <= 86) return 'Snow. Everything goes slower, so leave earlier.';
  if (o.windKmh >= 50) return 'Properly windy. Hold on to anything you like.';
  if (o.feelsC <= 0) return 'Freezing. Gloves are not optional.';
  if (o.tempC >= 25) return o.uv >= 6 ? 'Hot, and the sun has teeth: sun cream.' : 'Warm. Make the most of it.';
  if (o.code >= 45 && o.code <= 48) return 'Fog. The world ends about a street away.';
  if (o.code === 0) return 'Clear skies. No excuses.';
  return o.code <= 3 ? 'Nothing dramatic. A jacket covers it.' : 'Grey and damp. Very on brand.';
}
/** His words for the app: "weather app", "open the weather", "10 day forecast", "hourly forecast". */
export const WEATHER_ASK = /^(?:(?:hey |ok )?(?:ghosty,? )?)(?:(?:open|show)(?: me)? (?:the )?weather(?: app)?|(?:the )?weather app|(?:show me )?(?:the |a )?(?:10|ten)[- ]day forecast|(?:show me )?(?:the )?hourly forecast)$/i;
