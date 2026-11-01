/**
 * UNITS AND NUMBERS (BRIEF-REST-E part 1): "3.5 miles in km", "100 F in C", "5 ft 10 in cm", base64 both ways, a Unix
 * time as a date and back — answered here with no model. Money is not: "£40 in euros" has no live rate on the phone, so
 * the chat asks the brain (which gives the rate with its source) and the sheet takes a rate he types. Pure.
 */
import { base64ToText, textToBase64 } from './bytes';

type Dim = 'length' | 'mass' | 'volume' | 'area' | 'speed' | 'time' | 'data' | 'temp' | 'energy' | 'pressure' | 'power' | 'fuel';
interface Unit {
  dim: Dim;
  /** How many of the dimension's base unit one is (metre, kilogram, litre, square metre, metre a second, second, byte). */
  k: number;
  name: string;
  plural?: string;
  words: string[];
}

const U = (dim: Dim, k: number, name: string, words: string[], plural?: string): Unit => ({ dim, k, name, words, ...(plural ? { plural } : {}) });
const UNITS: Unit[] = [
  U('length', 1e-3, 'mm', ['mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters']),
  U('length', 1e-2, 'cm', ['cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters']),
  U('length', 1, 'm', ['m', 'metre', 'metres', 'meter', 'meters']),
  U('length', 1000, 'km', ['km', 'kms', 'kilometre', 'kilometres', 'kilometer', 'kilometers', 'k']),
  U('length', 0.0254, 'inch', ['in', 'inch', 'inches', '"'], 'inches'),
  U('length', 0.3048, 'foot', ['ft', 'foot', 'feet', "'"], 'feet'),
  U('length', 0.9144, 'yard', ['yd', 'yds', 'yard', 'yards']),
  U('length', 1609.344, 'mile', ['mi', 'mile', 'miles']),
  U('length', 1852, 'nautical mile', ['nmi', 'nautical mile', 'nautical miles']),
  U('mass', 1e-3, 'g', ['g', 'gram', 'grams', 'gramme', 'grammes']),
  U('mass', 1, 'kg', ['kg', 'kgs', 'kilo', 'kilos', 'kilogram', 'kilograms']),
  U('mass', 1000, 'tonne', ['t', 'tonne', 'tonnes', 'metric ton']),
  U('mass', 0.028349523125, 'oz', ['oz', 'ounce', 'ounces']),
  U('mass', 0.45359237, 'lb', ['lb', 'lbs', 'pound', 'pounds']),
  U('mass', 6.35029318, 'stone', ['st', 'stone', 'stones'], 'stone'),
  U('volume', 1e-3, 'ml', ['ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters']),
  U('volume', 1, 'litre', ['l', 'litre', 'litres', 'liter', 'liters']),
  U('volume', 0.56826125, 'pint', ['pt', 'pint', 'pints', 'uk pint', 'uk pints']),
  U('volume', 4.54609, 'gallon', ['gal', 'gallon', 'gallons', 'uk gallon', 'uk gallons']),
  U('volume', 3.785411784, 'US gallon', ['us gallon', 'us gallons']),
  U('volume', 0.473176473, 'US pint', ['us pint', 'us pints']),
  U('volume', 0.0284130625, 'fl oz', ['fl oz', 'fluid ounce', 'fluid ounces']),
  U('volume', 0.24, 'cup', ['cup', 'cups']),
  U('volume', 0.015, 'tablespoon', ['tbsp', 'tablespoon', 'tablespoons']),
  U('volume', 0.005, 'teaspoon', ['tsp', 'teaspoon', 'teaspoons']),
  U('area', 1, 'm²', ['m2', 'm²', 'sq m', 'square metre', 'square metres', 'square meter', 'square meters']),
  U('area', 0.09290304, 'sq ft', ['sq ft', 'ft2', 'ft²', 'square foot', 'square feet']),
  U('area', 1e6, 'km²', ['km2', 'km²', 'sq km', 'square kilometre', 'square kilometres']),
  U('area', 2589988.110336, 'sq mile', ['sq mi', 'square mile', 'square miles']),
  U('area', 4046.8564224, 'acre', ['acre', 'acres']),
  U('area', 10000, 'hectare', ['ha', 'hectare', 'hectares']),
  U('speed', 1 / 3.6, 'km/h', ['km/h', 'kmh', 'kph', 'kilometres per hour', 'kilometers per hour']),
  U('speed', 0.44704, 'mph', ['mph', 'miles per hour', 'miles an hour']),
  U('speed', 1, 'm/s', ['m/s', 'metres per second', 'meters per second']),
  U('speed', 0.514444, 'knot', ['kn', 'kt', 'knot', 'knots']),
  U('time', 1, 'second', ['s', 'sec', 'secs', 'second', 'seconds']),
  U('time', 60, 'minute', ['min', 'mins', 'minute', 'minutes']),
  U('time', 3600, 'hour', ['h', 'hr', 'hrs', 'hour', 'hours']),
  U('time', 86400, 'day', ['day', 'days']),
  U('time', 604800, 'week', ['wk', 'week', 'weeks']),
  U('time', 31557600, 'year', ['yr', 'year', 'years']),
  U('data', 1, 'byte', ['b', 'byte', 'bytes']),
  U('data', 1e3, 'KB', ['kb', 'kilobyte', 'kilobytes']),
  U('data', 1e6, 'MB', ['mb', 'megabyte', 'megabytes']),
  U('data', 1e9, 'GB', ['gb', 'gigabyte', 'gigabytes']),
  U('data', 1e12, 'TB', ['tb', 'terabyte', 'terabytes']),
  U('energy', 1, 'joule', ['j', 'joule', 'joules']),
  U('energy', 4184, 'kcal', ['kcal', 'calorie', 'calories', 'kilocalorie', 'kilocalories']),
  U('energy', 3.6e6, 'kWh', ['kwh', 'kilowatt hour', 'kilowatt hours', 'unit', 'units']),
  U('energy', 1000, 'kJ', ['kj', 'kilojoule', 'kilojoules']),
  U('power', 1, 'watt', ['w', 'watt', 'watts']),
  U('power', 1000, 'kW', ['kw', 'kilowatt', 'kilowatts']),
  U('power', 745.69987, 'hp', ['hp', 'horsepower', 'bhp']),
  U('pressure', 1, 'pascal', ['pa', 'pascal', 'pascals']),
  U('pressure', 100000, 'bar', ['bar', 'bars']),
  U('pressure', 6894.757, 'psi', ['psi']),
  U('pressure', 101325, 'atmosphere', ['atm', 'atmosphere', 'atmospheres']),
  U('fuel', 1, 'mpg', ['mpg', 'miles per gallon']),
  U('fuel', -1, 'l/100km', ['l/100km', 'litres per 100 km', 'l/100 km']),
  U('temp', 0, '°C', ['c', '°c', 'celsius', 'centigrade', 'degrees c', 'degrees celsius']),
  U('temp', 0, '°F', ['f', '°f', 'fahrenheit', 'degrees f', 'degrees fahrenheit']),
  U('temp', 0, 'K', ['kelvin']),
];
const BY_WORD = new Map<string, Unit>();
for (const u of UNITS) for (const w of u.words) BY_WORD.set(w, u);

export const unitOf = (w: string): Unit | null => BY_WORD.get(w.trim().toLowerCase().replace(/\.$/, '')) ?? null;

const toC = (v: number, u: string) => (u === '°F' ? ((v - 32) * 5) / 9 : u === 'K' ? v - 273.15 : v);
const fromC = (c: number, u: string) => (u === '°F' ? (c * 9) / 5 + 32 : u === 'K' ? c + 273.15 : c);

/** A number as he would read it: four significant figures at most, commas in thousands. */
export function nice(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const a = Math.abs(n);
  const r = a >= 1000 ? Math.round(n * 100) / 100 : a >= 1 ? Number(n.toPrecision(4)) : Number(n.toPrecision(3));
  return r.toLocaleString('en-GB', { maximumFractionDigits: a >= 1000 ? 2 : a >= 1 ? 3 : 8 });
}

export interface UnitAnswer {
  value: number;
  from: string;
  to: string;
  text: string;
}

/** A value in one unit as another of the same kind (null: different kinds, or unknown units). */
export function convertUnits(value: number, fromWord: string, toWord: string): UnitAnswer | null {
  const f = unitOf(fromWord);
  const t = unitOf(toWord);
  if (!f || !t || f.dim !== t.dim) return null;
  let v: number;
  if (f.dim === 'temp') v = fromC(toC(value, f.name), t.name);
  else if (f.dim === 'fuel') v = f.name === t.name ? value : 282.4809363 / value; // UK mpg and l/100km are each other's reciprocal
  else v = (value * f.k) / t.k;
  // a word takes an s (miles, feet); a symbol never does (km, mph, °C)
  const name = (u: Unit, n: number) => (Math.abs(n) === 1 || !/^(?:US |sq |nautical )?[a-z]{3,}$/.test(u.name) || ['kcal', 'mph', 'psi', 'mpg'].includes(u.name) ? u.name : u.plural ?? `${u.name}s`);
  const text = `${nice(value)} ${name(f, value)} is ${nice(v)} ${name(t, v)}`;
  return { value: v, from: f.name, to: t.name, text };
}

const NUM = String.raw`(-?\d[\d,]*(?:\.\d+)?|-?\.\d+|a|an|one|half a|half an)`;
const UNIT = String.raw`([a-z°'"²/][a-z°'"²/0-9 .]*?)`;
const ASK = new RegExp(String.raw`^(?:what(?:'s|’s| is)\s+|how (?:many|much) (?:\w+ )?(?:is|are)\s+|convert\s+)?${NUM}\s*${UNIT}\s+(?:in|to|into|as)\s+(?:the\s+)?${UNIT}\s*\??$`, 'i');
const COMPOUND = /^(?:what(?:'s|’s| is)\s+|convert\s+)?(\d+)\s*(?:ft|foot|feet|')\s*(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")?\s+(?:in|to|into)\s+(cm|centimetres?|centimeters?|m|metres?|meters?)\s*\??$/i;
const STONES = /^(?:what(?:'s|’s| is)\s+|convert\s+)?(\d+)\s*(?:st|stone)\s*(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)?\s+(?:in|to|into)\s+(kg|kgs|kilos?|kilograms?)\s*\??$/i;

const amount = (w: string): number => (/^an?$|^one$/i.test(w) ? 1 : /^half/i.test(w) ? 0.5 : Number(w.replace(/,/g, '')));

/** "3.5 miles in km", "5 ft 10 in cm", "11 stone 4 in kg": the answer, or null when the words are not a unit question. */
export function unitsAsked(text: string): UnitAnswer | null {
  const t = text.trim().replace(/\s+/g, ' ');
  const c = COMPOUND.exec(t);
  if (c) {
    const inches = Number(c[1]) * 12 + Number(c[2]);
    const r = convertUnits(inches, 'inch', c[3]!);
    return r && { ...r, text: `${c[1]} ft ${c[2]} in is ${r.text.split(' is ')[1]}` };
  }
  const s = STONES.exec(t);
  if (s) {
    const pounds = Number(s[1]) * 14 + Number(s[2]);
    const r = convertUnits(pounds, 'lb', s[3]!);
    return r && { ...r, text: `${s[1]} st ${s[2]} lb is ${r.text.split(' is ')[1]}` };
  }
  const m = ASK.exec(t);
  if (!m) return null;
  const v = amount(m[1]!);
  if (!Number.isFinite(v)) return null;
  return convertUnits(v, m[2]!, m[3]!);
}

/** Money: "£40 in euros", "40 GBP to USD". The phone has no live rate: the brain is asked (with its source), or he types one. */
const CUR = String.raw`(?:£|\$|€|¥|gbp|usd|eur|euros?|pounds? sterling|quid|dollars?|yen|rupees?|pkr|inr|aed|dirhams?|riyals?|sar|zloty|pln|lira|try|cad|aud)`;
export const MONEY_ASK = new RegExp(String.raw`^(?:what(?:'s|’s| is)\s+|convert\s+|how much is\s+)?(?:${CUR}\s?\d[\d,.]*|\d[\d,.]*\s?(?:k\s)?${CUR})\s+(?:in|to|into)\s+${CUR}`, 'i');
export const moneyAsked = (text: string): boolean => MONEY_ASK.test(text.trim());

/** "base64 of hello", "hello in base64", "decode base64 aGVsbG8=": the answer, or null. */
export function base64Asked(text: string): { text: string; out: string } | null {
  const t = text.trim();
  let m = /^(?:encode\s+|what(?:'s|’s| is)\s+)?(?:"|“)?(.+?)(?:"|”)?\s+(?:in|to|as)\s+base\s?64\??$/i.exec(t) ?? /^(?:encode\s+)?base\s?64\s+(?:of|encode)\s+(?:"|“)?(.+?)(?:"|”)?$/i.exec(t);
  if (m && !/^decode\b/i.test(t)) return { text: `“${m[1]}” in base64 is ${textToBase64(m[1]!)}`, out: textToBase64(m[1]!) };
  m = /^(?:decode\s+(?:base\s?64\s+)?|base\s?64\s+decode\s+|what does\s+)(\S+)(?:\s+say(?: in base\s?64)?)?\??$/i.exec(t);
  if (m) {
    const words = base64ToText(m[1]!);
    return words === null ? { text: `${m[1]} isn’t base64 that holds words (it may be a file: drop it on the converter).`, out: '' } : { text: `${m[1]} decodes to “${words}”`, out: words };
  }
  return null;
}

/** A Unix time (seconds, or milliseconds when it is that long) as a UK date and time in words. */
export function unixToDate(n: number, tz = 'Europe/London'): string {
  const ms = Math.abs(n) >= 1e11 ? n : n * 1000;
  return new Date(ms).toLocaleString('en-GB', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });
}

/** A date he types (ISO, or "1 March 2025 14:30") as a Unix time in seconds; null when it is not a date. */
export function dateToUnix(words: string): number | null {
  const s = words.trim();
  const iso = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(s);
  const ms = iso ? Date.parse(s.includes('T') || s.length <= 10 ? s : s.replace(' ', 'T')) : Date.parse(s);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/** "1700000000 as a date", "unix time 1700000000", "what's the unix time now", "2025-03-01 in unix time": the answer, or null. */
export function unixAsked(text: string, now = Date.now(), tz = 'Europe/London'): { text: string; out: string } | null {
  const t = text.trim().replace(/\?$/, '');
  let m = /^(?:what(?:'s|’s| is)\s+)?(?:unix time|epoch|timestamp)\s+(-?\d{9,13})(?:\s+(?:as|in) a date)?$/i.exec(t) ?? /^(?:what(?:'s|’s| is)\s+)?(-?\d{9,13})\s+(?:as|in|to)\s+(?:a\s+)?(?:date|time)$/i.exec(t);
  if (m) return { text: `${m[1]} is ${unixToDate(Number(m[1]), tz)}.`, out: unixToDate(Number(m[1]), tz) };
  if (/^(?:what(?:'s|’s| is)\s+)?(?:the\s+)?(?:unix time|epoch time|unix timestamp)(?:\s+now)?$/i.test(t)) return { text: `The Unix time now is ${Math.floor(now / 1000)}.`, out: String(Math.floor(now / 1000)) };
  m = /^(.+?)\s+(?:as|in|to)\s+(?:a\s+)?unix(?:\s+time)?$/i.exec(t);
  if (m) {
    const u = dateToUnix(m[1]!);
    if (u !== null) return { text: `${m[1]} is Unix time ${u}.`, out: String(u) };
  }
  return null;
}
