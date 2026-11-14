/**
 * THE BEST HOUR FOR A WALK TODAY (NEXT ROUND, BODY AND KITCHEN lane, body.s10), worked out on the phone from the public forecast
 * the phone already reads (Open-Meteo, no key): the chance of rain and the temperature each hour, the day's sunrise and sunset,
 * and the air now. Only daylight hours still to come count. Nothing is sent anywhere for it. A rough guide, never a promise.
 */
export interface WalkHour {
  hour: number;
  rain: number;
  temp: number;
  /** Sunset, "16:21". */
  sunset: string;
}
const hmOf = (iso: string) => iso.slice(11, 16);
/** The best hour left today: the least rain, then the nearest to a comfortable 15°C; null when no daylight hour is left. */
export function bestWalkHour(hourly: { temperature_2m: number[]; precipitation_probability: number[] }, sunrise: string, sunset: string, nowHour: number): WalkHour | null {
  const up = Number(hmOf(sunrise).slice(0, 2));
  const down = Number(hmOf(sunset).slice(0, 2));
  let best: WalkHour | null = null;
  let score = Infinity;
  for (let hr = Math.max(nowHour + 1, up + 1); hr < down; hr++) {
    const rain = hourly.precipitation_probability[hr];
    const temp = hourly.temperature_2m[hr];
    if (typeof rain !== 'number' || typeof temp !== 'number') continue;
    const s = rain * 2 + Math.abs(temp - 15) * 3;
    if (s < score) {
      score = s;
      best = { hour: hr, rain, temp, sunset: hmOf(sunset) };
    }
  }
  return best;
}
export function walkHourWords(w: WalkHour | null, air: string | null): string {
  if (!w) return 'No daylight left for a walk today. Tomorrow’s best hour shows in the morning.';
  return `Best hour for a walk today: ${String(w.hour).padStart(2, '0')}:00, a ${Math.round(w.rain)}% chance of rain and about ${Math.round(w.temp)}°C, before sunset at ${w.sunset}.${air ? ` The air is ${air.toLowerCase()} now.` : ''} From the public forecast, a rough guide.`;
}

/** The line for the Walk page: read from the forecast the phone already holds, or read once now (no position is sent: the forecast is for his home). */
export async function walkHourLine(nowHour = new Date().getHours()): Promise<{ words: string; hour: number | null }> {
  const w = await import('../../data/weather');
  const d = w.weather.data ?? (await w.weather.refresh().catch(() => null));
  if (!d?.hourly || !d.daily?.sunset?.[0]) return { words: '', hour: null };
  const a = w.air.data ?? null;
  const aqi = (a as { current?: { european_aqi?: number } } | null)?.current?.european_aqi;
  const best = bestWalkHour(d.hourly, d.daily.sunrise[0]!, d.daily.sunset[0]!, nowHour);
  return { words: walkHourWords(best, typeof aqi === 'number' ? w.airBand(aqi).label : null), hour: best?.hour ?? null };
}
