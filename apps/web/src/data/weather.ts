/** Weather for the owner's location (Open-Meteo, no key). */
import { Feed, fetchJson } from '../api/feed';
import { home, settings } from '../state/app';

export interface WeatherData {
  place: string;
  current: { temperature_2m: number; apparent_temperature: number; relative_humidity_2m: number; weather_code: number; wind_speed_10m: number; wind_direction_10m: number; pressure_msl: number };
  hourly: { temperature_2m: number[]; precipitation_probability: number[] };
  daily: { temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; sunrise: string[]; sunset: string[]; uv_index_max: number[] };
}

export const WMO = (c: number) =>
  c === 0 ? 'Clear sky' : c < 3 ? 'Partly cloudy' : c === 3 ? 'Overcast' : c < 50 ? 'Fog' : c < 58 ? 'Drizzle' : c < 68 ? 'Rain' : c < 78 ? 'Snow' : c < 83 ? 'Showers' : c < 87 ? 'Snow showers' : c < 95 ? 'Thunderstorm' : 'Severe thunderstorm';

export const temp = (c: number) => (settings.get().units === 'imperial' ? `${Math.round((c * 9) / 5 + 32)}°F` : `${Math.round(c)}°C`);
export const speed = (kmh: number) => (settings.get().units === 'imperial' ? `${Math.round(kmh / 1.609)} mph` : `${Math.round(kmh)} km/h`);

export const weather = new Feed<WeatherData>(
  'weather',
  async () => {
    const L = home();
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${L.lat.toFixed(3)}&longitude=${L.lon.toFixed(3)}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&hourly=temperature_2m,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max&forecast_days=3&timezone=auto`;
    const j = await fetchJson<Omit<WeatherData, 'place'>>(u, 600);
    return { ...j, place: L.name };
  },
  600_000,
);
