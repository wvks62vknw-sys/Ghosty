/** Live world data the brain can look up directly. */
import { arg, type Tool } from './types';

async function geocode(place: string): Promise<{ name: string; lat: number; lon: number } | null> {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&name=${encodeURIComponent(place)}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { results?: { name: string; country?: string; latitude: number; longitude: number }[] };
  const g = j.results?.[0];
  return g ? { name: `${g.name}${g.country ? ', ' + g.country : ''}`, lat: g.latitude, lon: g.longitude } : null;
}

export const dataTools: Tool[] = [
  {
    name: 'weather',
    description: 'Current weather, air quality and 3-day forecast for a place name (or the owner\'s location if no place given).',
    parameters: { type: 'object', properties: { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } } },
    risk: 'auto',
    pure: true,
    async run(a) {
      let name = 'requested location';
      let lat = arg.num(a, 'lat', NaN);
      let lon = arg.num(a, 'lon', NaN);
      const place = arg.str(a, 'place', false);
      if (place) {
        const g = await geocode(place);
        if (!g) throw new Error(`I could not find "${place}"`);
        ({ name, lat, lon } = g);
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('give a place or lat/lon');
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code&forecast_days=3&timezone=auto`;
      const r = await fetch(u);
      if (!r.ok) throw new Error(`weather service ${r.status}`);
      const j = (await r.json()) as { current: Record<string, number>; daily: Record<string, (number | string)[]> };
      const c = j.current;
      const d = j.daily;
      const days = (d.time ?? []).map((t, i) => `${t}: ${d.temperature_2m_min?.[i]}–${d.temperature_2m_max?.[i]}°C, rain ${d.precipitation_probability_max?.[i]}%, code ${d.weather_code?.[i]}`);
      // Air quality rides along (same provider, no key); a miss here never fails the weather.
      let airLine = '';
      try {
        const q = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,nitrogen_dioxide&timezone=auto`);
        if (q.ok) {
          const aq = ((await q.json()) as { current?: Record<string, number> }).current;
          const i = aq?.european_aqi;
          if (aq && typeof i === 'number' && Number.isFinite(i)) {
            const band = i <= 20 ? 'good' : i <= 40 ? 'fair' : i <= 60 ? 'moderate' : i <= 80 ? 'poor' : i <= 100 ? 'very poor' : 'extremely poor';
            airLine = `\nAir quality: ${band} (European AQI ${Math.round(i)}, PM2.5 ${Math.round(aq.pm2_5 ?? 0)} µg/m³, NO2 ${Math.round(aq.nitrogen_dioxide ?? 0)} µg/m³).`;
          }
        }
      } catch {
        /* no air data: the forecast still answers */
      }
      return `${name}: now ${c.temperature_2m}°C (feels ${c.apparent_temperature}°C), wind ${c.wind_speed_10m} km/h, humidity ${c.relative_humidity_2m}%, WMO code ${c.weather_code}.${airLine}\n${days.join('\n')}`;
    },
  },
  {
    name: 'earthquakes',
    description: 'Recent earthquakes worldwide from USGS (last 24 hours, magnitude 2.5+), biggest first.',
    parameters: { type: 'object', properties: { min_magnitude: { type: 'number' } } },
    risk: 'auto',
    pure: true,
    async run(a) {
      const min = arg.num(a, 'min_magnitude', 4);
      const r = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson');
      if (!r.ok) throw new Error(`USGS ${r.status}`);
      const j = (await r.json()) as { features: { properties: { mag: number; place: string; time: number } }[] };
      const list = j.features
        .map((f) => f.properties)
        .filter((p) => p.mag >= min)
        .sort((x, y) => y.mag - x.mag)
        .slice(0, 15)
        .map((p) => `M${p.mag.toFixed(1)} ${p.place} (${new Date(p.time).toISOString().slice(0, 16)}Z)`);
      return list.length ? list.join('\n') : `No earthquakes of M${min}+ in the last 24 hours.`;
    },
  },
];
