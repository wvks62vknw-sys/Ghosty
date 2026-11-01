/**
 * THE WORKBENCH's units (OWNER-ISSUES 61b): a quantity in his words to SI and back. Pure, no packages, total (a value that
 * cannot be read is `null`, never a throw). Shared by the phone (the WORKBENCH forms, in his units: `settings.units`) and
 * the brain (the `estimate` tool).
 *
 * Every unit is a factor (and, for temperatures, an offset) to SI: si = value × f + o. A temperature DIFFERENCE is its own
 * kind (`deltaT`: K, °C, °F differences), so "20 K" across a wall is never read as −253 °C. Gallons are UK gallons.
 */

export type QtyKind =
  | 'length' | 'area' | 'volume' | 'mass' | 'force' | 'lineload' | 'pressure' | 'speed' | 'angle' | 'rpm' | 'torque' | 'power' | 'energy'
  | 'temperature' | 'deltaT' | 'time' | 'voltage' | 'current' | 'resistance' | 'capacitance' | 'density' | 'conductivity' | 'uvalue';

export type UnitSystem = 'metric' | 'imperial';

export interface UnitDef {
  /** As shown: "kN", "mm", "°C". */
  u: string;
  k: QtyKind;
  /** SI per one of this unit. */
  f: number;
  /** Added after the factor (temperatures only). */
  o?: number;
  /** Other ways he writes it (lower case; the shown form is matched too). */
  al?: string[];
}

const G = 9.80665;
const IN = 0.0254;
const FT = 0.3048;
const LB = 0.45359237;
const LBF = LB * G;

/** Every unit, by kind. The first of each kind is its SI unit. */
export const UNITS: UnitDef[] = [
  // length
  { u: 'm', k: 'length', f: 1, al: ['metre', 'metres', 'meter', 'meters', 'mtr', 'mtrs'] },
  { u: 'mm', k: 'length', f: 0.001, al: ['millimetre', 'millimetres', 'millimeter', 'millimeters'] },
  { u: 'cm', k: 'length', f: 0.01, al: ['centimetre', 'centimetres', 'centimeter', 'centimeters', 'cms'] },
  { u: 'km', k: 'length', f: 1000, al: ['kilometre', 'kilometres', 'kilometer', 'kilometers', 'kms'] },
  { u: 'in', k: 'length', f: IN, al: ['inch', 'inches', '"', '″'] },
  { u: 'ft', k: 'length', f: FT, al: ['foot', 'feet', "'", '′'] },
  { u: 'yd', k: 'length', f: 0.9144, al: ['yard', 'yards', 'yds'] },
  { u: 'mi', k: 'length', f: 1609.344, al: ['mile', 'miles'] },
  // area
  { u: 'm²', k: 'area', f: 1, al: ['m2', 'm^2', 'sqm', 'sq m', 'square metre', 'square metres', 'square meter', 'square meters'] },
  { u: 'mm²', k: 'area', f: 1e-6, al: ['mm2', 'mm^2', 'sq mm'] },
  { u: 'cm²', k: 'area', f: 1e-4, al: ['cm2', 'cm^2', 'sq cm'] },
  { u: 'ft²', k: 'area', f: FT * FT, al: ['ft2', 'ft^2', 'sqft', 'sq ft', 'square foot', 'square feet'] },
  { u: 'in²', k: 'area', f: IN * IN, al: ['in2', 'in^2', 'sq in', 'square inch', 'square inches'] },
  // volume
  { u: 'm³', k: 'volume', f: 1, al: ['m3', 'm^3', 'cubic metre', 'cubic metres', 'cubic meter', 'cubic meters'] },
  { u: 'L', k: 'volume', f: 0.001, al: ['l', 'litre', 'litres', 'liter', 'liters', 'ltr'] },
  { u: 'cc', k: 'volume', f: 1e-6, al: ['cm3', 'cm³', 'ml', 'millilitre', 'millilitres', 'milliliter', 'milliliters'] },
  { u: 'gal', k: 'volume', f: 0.00454609, al: ['gallon', 'gallons', 'uk gal'] },
  { u: 'cu in', k: 'volume', f: IN * IN * IN, al: ['cubic inch', 'cubic inches', 'ci'] },
  // mass
  { u: 'kg', k: 'mass', f: 1, al: ['kilo', 'kilos', 'kilogram', 'kilograms', 'kgs'] },
  { u: 'g', k: 'mass', f: 0.001, al: ['gram', 'grams', 'gm'] },
  { u: 't', k: 'mass', f: 1000, al: ['tonne', 'tonnes', 'metric ton'] },
  { u: 'lb', k: 'mass', f: LB, al: ['lbs', 'pound', 'pounds'] },
  // force
  { u: 'N', k: 'force', f: 1, al: ['newton', 'newtons'] },
  { u: 'kN', k: 'force', f: 1000, al: ['kilonewton', 'kilonewtons'] },
  { u: 'MN', k: 'force', f: 1e6, al: ['meganewton', 'meganewtons'] },
  { u: 'lbf', k: 'force', f: LBF, al: ['pound-force', 'pounds-force', 'pound force', 'pounds force'] },
  { u: 'kgf', k: 'force', f: G, al: ['kilogram-force', 'kg force'] },
  // a load along a beam
  { u: 'N/m', k: 'lineload', f: 1 },
  { u: 'kN/m', k: 'lineload', f: 1000 },
  { u: 'lbf/ft', k: 'lineload', f: LBF / FT, al: ['lb/ft', 'plf'] },
  // pressure and stress
  { u: 'Pa', k: 'pressure', f: 1, al: ['pascal', 'pascals', 'n/m2', 'n/m²'] },
  { u: 'kPa', k: 'pressure', f: 1000, al: ['kilopascal', 'kilopascals'] },
  { u: 'MPa', k: 'pressure', f: 1e6, al: ['megapascal', 'megapascals', 'n/mm2', 'n/mm²'] },
  { u: 'GPa', k: 'pressure', f: 1e9, al: ['gigapascal', 'gigapascals'] },
  { u: 'bar', k: 'pressure', f: 1e5, al: ['bars'] },
  { u: 'psi', k: 'pressure', f: LBF / (IN * IN), al: ['lb/in2', 'lbf/in2', 'lb/in²'] },
  { u: 'ksi', k: 'pressure', f: (1000 * LBF) / (IN * IN) },
  // speed
  { u: 'm/s', k: 'speed', f: 1, al: ['mps', 'metres per second', 'meters per second'] },
  { u: 'km/h', k: 'speed', f: 1000 / 3600, al: ['kmh', 'kph', 'km/hr', 'kilometres per hour', 'kilometers per hour'] },
  { u: 'mph', k: 'speed', f: 1609.344 / 3600, al: ['mi/h', 'miles per hour', 'miles an hour'] },
  { u: 'kn', k: 'speed', f: 1852 / 3600, al: ['kt', 'kts', 'knot', 'knots'] },
  { u: 'ft/s', k: 'speed', f: FT, al: ['fps', 'feet per second'] },
  // angle (SI: radians)
  { u: 'rad', k: 'angle', f: 1, al: ['radian', 'radians'] },
  { u: '°', k: 'angle', f: Math.PI / 180, al: ['deg', 'degree', 'degrees', 'º'] },
  // turning speed (SI kept as rpm: what every engine and gear is spoken in)
  { u: 'rpm', k: 'rpm', f: 1, al: ['r/min', 'revs', 'revs per minute', 'rev/min'] },
  { u: 'rps', k: 'rpm', f: 60, al: ['rev/s', 'revs per second'] },
  // torque
  { u: 'Nm', k: 'torque', f: 1, al: ['n m', 'n·m', 'n.m', 'newton metre', 'newton metres', 'newton meter', 'newton meters'] },
  { u: 'lbft', k: 'torque', f: LBF * FT, al: ['lb ft', 'lb-ft', 'lb·ft', 'ft lb', 'ft-lb', 'ftlb', 'foot-pounds', 'foot pounds', 'pound-feet', 'pound feet'] },
  { u: 'kNm', k: 'torque', f: 1000, al: ['kn m', 'kn·m', 'kn.m'] },
  // power
  { u: 'W', k: 'power', f: 1, al: ['watt', 'watts'] },
  { u: 'kW', k: 'power', f: 1000, al: ['kilowatt', 'kilowatts'] },
  { u: 'MW', k: 'power', f: 1e6, al: ['megawatt', 'megawatts'] },
  { u: 'hp', k: 'power', f: 745.69987, al: ['horsepower'] },
  { u: 'bhp', k: 'power', f: 745.69987, al: ['brake horsepower'] },
  { u: 'PS', k: 'power', f: 735.49875, al: ['ps', 'cv'] },
  // energy
  { u: 'J', k: 'energy', f: 1, al: ['joule', 'joules'] },
  { u: 'kJ', k: 'energy', f: 1000, al: ['kilojoule', 'kilojoules'] },
  { u: 'MJ', k: 'energy', f: 1e6, al: ['megajoule', 'megajoules'] },
  { u: 'Wh', k: 'energy', f: 3600, al: ['watt-hour', 'watt hours', 'watt-hours'] },
  { u: 'kWh', k: 'energy', f: 3.6e6, al: ['kilowatt-hour', 'kilowatt hours', 'kilowatt-hours', 'units'] },
  // temperature (SI: kelvin)
  { u: 'K', k: 'temperature', f: 1, o: 0, al: ['kelvin'] },
  { u: '°C', k: 'temperature', f: 1, o: 273.15, al: ['c', 'degc', 'deg c', 'celsius', 'centigrade', 'degrees c', 'degrees celsius', 'ºc'] },
  { u: '°F', k: 'temperature', f: 5 / 9, o: 273.15 - (32 * 5) / 9, al: ['f', 'degf', 'deg f', 'fahrenheit', 'degrees f', 'degrees fahrenheit', 'ºf'] },
  // a temperature difference (SI: kelvin)
  { u: 'K', k: 'deltaT', f: 1, al: ['kelvin', 'degrees'] },
  { u: '°C', k: 'deltaT', f: 1, al: ['c', 'degc', 'deg c', 'celsius', 'ºc'] },
  { u: '°F', k: 'deltaT', f: 5 / 9, al: ['f', 'degf', 'deg f', 'fahrenheit', 'ºf'] },
  // time
  { u: 's', k: 'time', f: 1, al: ['sec', 'secs', 'second', 'seconds'] },
  { u: 'ms', k: 'time', f: 0.001, al: ['millisecond', 'milliseconds'] },
  { u: 'min', k: 'time', f: 60, al: ['mins', 'minute', 'minutes'] },
  { u: 'h', k: 'time', f: 3600, al: ['hr', 'hrs', 'hour', 'hours'] },
  { u: 'day', k: 'time', f: 86400, al: ['days'] },
  // electricity
  { u: 'V', k: 'voltage', f: 1, al: ['volt', 'volts', 'v'] },
  { u: 'mV', k: 'voltage', f: 0.001, al: ['millivolt', 'millivolts'] },
  { u: 'kV', k: 'voltage', f: 1000, al: ['kilovolt', 'kilovolts'] },
  { u: 'A', k: 'current', f: 1, al: ['amp', 'amps', 'ampere', 'amperes', 'a'] },
  { u: 'mA', k: 'current', f: 0.001, al: ['milliamp', 'milliamps', 'ma'] },
  { u: 'µA', k: 'current', f: 1e-6, al: ['ua', 'microamp', 'microamps', 'μa'] },
  { u: 'Ω', k: 'resistance', f: 1, al: ['ohm', 'ohms', 'r', 'Ω', 'ω'] },
  { u: 'kΩ', k: 'resistance', f: 1000, al: ['k', 'kohm', 'kohms', 'kilohm', 'kilohms', 'kω'] },
  { u: 'MΩ', k: 'resistance', f: 1e6, al: ['m', 'mohm', 'mohms', 'megohm', 'megohms', 'mω'] },
  { u: 'F', k: 'capacitance', f: 1, al: ['farad', 'farads'] },
  { u: 'mF', k: 'capacitance', f: 1e-3 },
  { u: 'µF', k: 'capacitance', f: 1e-6, al: ['uf', 'μf', 'microfarad', 'microfarads', 'mfd'] },
  { u: 'nF', k: 'capacitance', f: 1e-9, al: ['nanofarad', 'nanofarads'] },
  { u: 'pF', k: 'capacitance', f: 1e-12, al: ['picofarad', 'picofarads'] },
  // materials
  { u: 'kg/m³', k: 'density', f: 1, al: ['kg/m3', 'kg/m^3'] },
  { u: 'lb/ft³', k: 'density', f: LB / (FT * FT * FT), al: ['lb/ft3', 'pcf'] },
  { u: 'W/mK', k: 'conductivity', f: 1, al: ['w/m.k', 'w/m·k', 'w/(m·k)', 'w/m k'] },
  { u: 'W/m²K', k: 'uvalue', f: 1, al: ['w/m2k', 'w/m2.k', 'w/m²·k', 'w/(m²·k)', 'w/m2 k'] },
  { u: 'BTU/h·ft²·°F', k: 'uvalue', f: 5.678263, al: ['btu/hft2f', 'btu'] },
];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

/** The unit `u` of `kind` (or of any kind when none is given): by its shown form first, then its other names. */
export function unitOf(u: string, kind?: QtyKind): UnitDef | null {
  const raw = u.trim();
  const n = norm(raw);
  if (!n) return null;
  const pool = kind ? UNITS.filter((x) => x.k === kind) : UNITS;
  // exact case first ("MΩ" vs "mΩ", "mF" vs "MF"), then any case, then the other names
  return pool.find((x) => x.u === raw) ?? pool.find((x) => x.u.toLowerCase() === n) ?? pool.find((x) => x.al?.includes(n)) ?? null;
}

/** A value in unit `u` → SI (NaN for a unit it does not know). */
export function toSI(value: number, u: string, kind?: QtyKind): number {
  const d = unitOf(u, kind);
  return d ? value * d.f + (d.o ?? 0) : NaN;
}

/** An SI value → unit `u` (NaN for a unit it does not know). */
export function fromSI(si: number, u: string, kind?: QtyKind): number {
  const d = unitOf(u, kind);
  return d ? (si - (d.o ?? 0)) / d.f : NaN;
}

export interface Quantity {
  /** In SI (K for temperatures, rad for angles, rpm for turning speeds). */
  si: number;
  /** The number as written, and its unit. */
  value: number;
  unit: string;
  kind: QtyKind;
}

const NUM = /^([-+−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?:e[-+]?\d+)?|[-+−]?\.\d+)\s*(.*)$/i;

/**
 * A quantity as he writes it: "5 kN", "5kN", "3.5 m", "1,200 mm", "70 mph", "-5 °C", "6 ft 2 in", "20 mA", "4k7" (a resistor
 * code: 4.7 kΩ). With `kind`, only that kind's units count; `bare` is the unit a lone number is in (the form's own unit).
 * Null when it cannot be read: never a guess.
 */
export function parseQuantity(text: string, kind?: QtyKind, bare?: string): Quantity | null {
  let t = String(text ?? '').trim().replace(/[−–]/g, '-');
  if (!t) return null;
  // feet and inches together: 6 ft 2 in, 6' 2", 6ft2
  const ftin = /^(\d+(?:\.\d+)?)\s*(?:ft|feet|foot|'|′)\s*(\d+(?:\.\d+)?)\s*(?:in|inch|inches|"|″)?$/i.exec(t);
  if (ftin && (!kind || kind === 'length')) {
    const ft = Number(ftin[1]);
    const inch = Number(ftin[2]);
    return { si: ft * FT + inch * IN, value: ft + inch / 12, unit: 'ft', kind: 'length' };
  }
  // a resistor code: 4k7, 2R2, 1M5
  const code = /^(\d+)([rkm])(\d+)$/i.exec(t);
  if (code && (!kind || kind === 'resistance')) {
    const mult = { r: 1, k: 1000, m: 1e6 }[code[2]!.toLowerCase() as 'r' | 'k' | 'm'];
    const v = Number(`${code[1]}.${code[3]}`);
    return { si: v * mult, value: v * mult, unit: 'Ω', kind: 'resistance' };
  }
  t = t.replace(/^(?:about|around|roughly|approx\.?|~)\s*/i, '');
  const m = NUM.exec(t);
  if (!m) return null;
  const value = Number(m[1]!.replace(/,/g, '').replace('−', '-'));
  if (!Number.isFinite(value)) return null;
  const rest = m[2]!.trim().replace(/\.$/, '');
  if (!rest) {
    if (!bare) return null;
    const d = unitOf(bare, kind);
    return d ? { si: value * d.f + (d.o ?? 0), value, unit: d.u, kind: d.k } : null;
  }
  const d = unitOf(rest, kind) ?? unitOf(rest.replace(/^degrees?\s+/, '°'), kind);
  if (!d) return null;
  return { si: value * d.f + (d.o ?? 0), value, unit: d.u, kind: d.k };
}

/**
 * A number to a few significant figures (three: a first estimate claims no more), in the owner's way of writing it: "0.201",
 * "4.55", "123", "1,120", "12,300" (never "1.23e+5"); −0 is 0.
 */
export function num(x: number, sig = 3): string {
  if (!Number.isFinite(x)) return '—';
  if (x === 0) return '0';
  const mag = Math.floor(Math.log10(Math.abs(x)));
  const places = Math.max(0, Math.min(6, sig - 1 - mag));
  const step = places > 0 ? 1 : 10 ** Math.max(0, mag - sig + 1);
  const r = places > 0 ? Number(x.toFixed(places)) : Math.round(x / step) * step;
  if (r === 0) return '0';
  return r.toLocaleString('en-GB', { maximumFractionDigits: places, minimumFractionDigits: 0 });
}

/** An SI value shown in unit `u`: fmt(5000, 'kN') → "5 kN"; `places` fixes the decimals, else three significant figures. */
export function fmt(si: number, u: string, places?: number, kind?: QtyKind): string {
  const d = unitOf(u, kind);
  if (!d || !Number.isFinite(si)) return '—';
  const v = (si - (d.o ?? 0)) / d.f;
  const s = places == null ? num(v) : (Number(v.toFixed(places)) || 0).toLocaleString('en-GB', { minimumFractionDigits: places, maximumFractionDigits: places });
  return d.u === '°' ? `${s}°` : `${s} ${d.u}`;
}

/** The unit a kind is shown in, in his system, for a value of this size (null: let the kind's default decide). */
export function unitFor(kind: QtyKind, system: UnitSystem, si = 1): string {
  const a = Math.abs(si);
  const metric = system === 'metric';
  switch (kind) {
    case 'length':
      return metric ? (a < 1 ? 'mm' : a < 10_000 ? 'm' : 'km') : a < FT ? 'in' : a < 1609.344 ? 'ft' : 'mi';
    case 'area':
      return metric ? (a < 1e-2 ? 'mm²' : 'm²') : a < FT * FT ? 'in²' : 'ft²';
    case 'volume':
      return metric ? (a < 1e-3 ? 'cc' : a < 10 ? 'L' : 'm³') : a < 1e-3 ? 'cu in' : 'gal';
    case 'mass':
      return metric ? (a < 1 ? 'g' : a < 10_000 ? 'kg' : 't') : 'lb';
    case 'force':
      return metric ? (a < 1000 ? 'N' : a < 1e6 ? 'kN' : 'MN') : 'lbf';
    case 'lineload':
      return metric ? (a < 1000 ? 'N/m' : 'kN/m') : 'lbf/ft';
    case 'pressure':
      return metric ? (a < 1000 ? 'Pa' : a < 1e6 ? 'kPa' : a < 1e9 ? 'MPa' : 'GPa') : a < 1e7 ? 'psi' : 'ksi';
    case 'speed':
      return metric ? 'km/h' : 'mph';
    case 'angle':
      return '°';
    case 'rpm':
      return 'rpm';
    case 'torque':
      return metric ? 'Nm' : 'lbft';
    case 'power':
      return metric ? (a < 1000 ? 'W' : a < 1e6 ? 'kW' : 'MW') : a < 745.69987 ? 'W' : 'hp';
    case 'energy':
      return a < 3.6e6 && a >= 1 ? (a < 3600 ? 'J' : 'Wh') : 'kWh';
    case 'temperature':
      return metric ? '°C' : '°F';
    case 'deltaT':
      return metric ? 'K' : '°F';
    case 'time':
      return a < 1 ? 'ms' : a < 120 ? 's' : a < 7200 ? 'min' : a < 3 * 86400 ? 'h' : 'day';
    case 'voltage':
      return a < 1 ? 'mV' : a < 1000 ? 'V' : 'kV';
    case 'current':
      return a < 1e-3 ? 'µA' : a < 1 ? 'mA' : 'A';
    case 'resistance':
      return a < 1000 ? 'Ω' : a < 1e6 ? 'kΩ' : 'MΩ';
    case 'capacitance':
      return a < 1e-9 ? 'pF' : a < 1e-6 ? 'nF' : a < 1e-3 ? 'µF' : 'F';
    case 'density':
      return metric ? 'kg/m³' : 'lb/ft³';
    case 'conductivity':
      return 'W/mK';
    case 'uvalue':
      return 'W/m²K';
  }
}

/** An SI value of `kind` shown in his system: show(0.0002, 'length', 'metric') → "0.2 mm"; show(5000, 'force', 'imperial') → "1,120 lbf". */
export function show(si: number, kind: QtyKind, system: UnitSystem = 'metric', u?: string): string {
  return fmt(si, u ?? unitFor(kind, system, si), undefined, kind);
}

/** The kinds a form field can take, each with the units offered in each system (the first is the form's own). */
export const FORM_UNITS: Partial<Record<QtyKind, Record<UnitSystem, string>>> = {
  length: { metric: 'm', imperial: 'ft' },
  area: { metric: 'm²', imperial: 'ft²' },
  volume: { metric: 'L', imperial: 'cu in' },
  mass: { metric: 'kg', imperial: 'lb' },
  force: { metric: 'kN', imperial: 'lbf' },
  lineload: { metric: 'kN/m', imperial: 'lbf/ft' },
  pressure: { metric: 'MPa', imperial: 'psi' },
  speed: { metric: 'km/h', imperial: 'mph' },
  torque: { metric: 'Nm', imperial: 'lbft' },
  power: { metric: 'kW', imperial: 'hp' },
  temperature: { metric: '°C', imperial: '°F' },
  deltaT: { metric: 'K', imperial: '°F' },
};
