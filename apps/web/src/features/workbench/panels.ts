/**
 * THE WORKBENCH's panels (OWNER-ISSUES 61b), as data: each panel's modes, each mode's fields (what they hold, the unit each
 * shows in his system, what an empty one means), its defaults in SI and how its values become the shared solver's inputs
 * (packages/shared/src/workbench `solve`). The screen (index.ts) draws them; nothing here touches the page.
 */
import { MATERIALS, layersOf, parseProblem, parseQuantity, type Panel, type QtyKind, type WorkKind } from '../../../../../packages/shared/src/workbench';

export type Values = Record<string, unknown>;

export interface Field {
  key: string;
  label: string;
  type: 'num' | 'select' | 'check' | 'text' | 'date' | 'time';
  /** num: what it holds (none: a plain number) and the unit it shows in, [metric, imperial]. */
  q?: QtyKind;
  unit?: [string, string];
  options?: [string, string][];
  /** Shown in an empty field: what leaving it empty means ("middle", "none"). */
  hint?: string;
  /** May be left empty (the solver's default, said under ASSUMED). */
  optional?: boolean;
  /** Shown only when this says so (a tube's wall, an I-beam's web). */
  when?: (v: Values) => boolean;
}

export interface Ctx {
  home: { lat: number; lon: number; name: string };
}

export interface Mode {
  id: string;
  label: string;
  kind: WorkKind;
  fields: Field[];
  defaults: Values;
  inputs(v: Values, ctx: Ctx): Record<string, unknown>;
}

export interface PanelSpec {
  id: Exclude<Panel, 'tunnel'>;
  /** The panel's title (the sections match on it). */
  title: string;
  modes: Mode[];
}

const MAT_OPTIONS: [string, string][] = Object.values(MATERIALS).map((m) => [m.id, m.name.charAt(0).toUpperCase() + m.name.slice(1)]);
const SHAPES: [string, string][] = [['rect', 'Rectangle'], ['round', 'Round bar'], ['tube', 'Round tube'], ['ibeam', 'I-beam']];
const mm: [string, string] = ['mm', 'in'];
const section = (show: (s: string) => boolean): Field[] => [
  { key: 'shape', label: 'Section', type: 'select', options: SHAPES },
  { key: 'b', label: 'Width', type: 'num', q: 'length', unit: mm, when: (v) => show(String(v.shape)) && (v.shape === 'rect' || v.shape === 'ibeam') },
  { key: 'h', label: 'Depth', type: 'num', q: 'length', unit: mm, when: (v) => show(String(v.shape)) && (v.shape === 'rect' || v.shape === 'ibeam') },
  { key: 'd', label: 'Diameter', type: 'num', q: 'length', unit: mm, when: (v) => v.shape === 'round' || v.shape === 'tube' },
  { key: 't', label: 'Wall', type: 'num', q: 'length', unit: mm, when: (v) => v.shape === 'tube' },
  { key: 'tw', label: 'Web', type: 'num', q: 'length', unit: mm, when: (v) => v.shape === 'ibeam' },
  { key: 'tf', label: 'Flange', type: 'num', q: 'length', unit: mm, when: (v) => v.shape === 'ibeam' },
];
const sectionOf = (v: Values) => ({ shape: v.shape, b: v.b, h: v.h, d: v.d, t: v.t, tw: v.tw, tf: v.tf });
const SECTION_DEFAULTS = { shape: 'rect', b: 0.1, h: 0.2, d: 0.1143, t: 0.0036, tw: 0.0057, tf: 0.0078 };

/** "100, 100" or "4k7 + 10k" (ohms, a bare number in ohms) → the resistors; null if one cannot be read. */
export function resistorsOf(text: string): number[] | null {
  const parts = String(text ?? '').split(/[,;+&]|\band\b/).map((x) => x.trim()).filter(Boolean);
  const out = parts.map((x) => parseQuantity(x, 'resistance', 'Ω')?.si ?? NaN);
  return out.length && out.every((x) => x > 0) ? out : null;
}

const today = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:00` };
};

export const PANELS: PanelSpec[] = [
  {
    id: 'beam',
    title: 'BEAM',
    modes: [{
      id: 'beam', label: 'Beam', kind: 'beam',
      fields: [
        { key: 'support', label: 'Supports', type: 'select', options: [['simple', 'Simply supported'], ['cantilever', 'Cantilever'], ['fixed', 'Fixed both ends']] },
        { key: 'span', label: 'Span', type: 'num', q: 'length', unit: ['m', 'ft'] },
        { key: 'load', label: 'Point load', type: 'num', q: 'force', unit: ['kN', 'lbf'], optional: true, hint: 'none' },
        { key: 'at', label: 'Load at', type: 'num', q: 'length', unit: ['m', 'ft'], optional: true, hint: 'middle' },
        { key: 'udl', label: 'Spread load', type: 'num', q: 'lineload', unit: ['kN/m', 'lbf/ft'], optional: true, hint: 'none' },
        { key: 'material', label: 'Material', type: 'select', options: MAT_OPTIONS },
        ...section(() => true),
        { key: 'selfWeight', label: 'Add its own weight', type: 'check' },
      ],
      defaults: { support: 'simple', span: 3, load: 5000, material: 's275', ...SECTION_DEFAULTS, selfWeight: false },
      inputs: (v) => ({ support: v.support, span: v.span, load: v.load, at: v.at, udl: v.udl, material: v.material, section: sectionOf(v), selfWeight: v.selfWeight === true }),
    }],
  },
  {
    id: 'column',
    title: 'COLUMN',
    modes: [{
      id: 'column', label: 'Column', kind: 'column',
      fields: [
        { key: 'ends', label: 'Ends', type: 'select', options: [['pinned', 'Pinned both ends'], ['fixed-free', 'Fixed foot, free top'], ['fixed-pinned', 'Fixed and pinned'], ['fixed', 'Fixed both ends']] },
        { key: 'length', label: 'Length', type: 'num', q: 'length', unit: ['m', 'ft'] },
        { key: 'load', label: 'Load on it', type: 'num', q: 'force', unit: ['kN', 'lbf'], optional: true, hint: 'none' },
        { key: 'material', label: 'Material', type: 'select', options: MAT_OPTIONS },
        ...section(() => true),
      ],
      defaults: { ends: 'pinned', length: 3, load: 50_000, material: 's275', ...SECTION_DEFAULTS, shape: 'tube' },
      inputs: (v) => ({ ends: v.ends, length: v.length, load: v.load, material: v.material, section: sectionOf(v) }),
    }],
  },
  {
    id: 'gears',
    title: 'GEARS',
    modes: [
      {
        id: 'train', label: 'Gear train', kind: 'gears',
        fields: [
          { key: 'teeth', label: 'Teeth, driver:driven', type: 'text', hint: '20:60, 15:45' },
          { key: 'rpm', label: 'Input speed', type: 'num', q: 'rpm', unit: ['rpm', 'rpm'] },
          { key: 'torque', label: 'Input torque', type: 'num', q: 'torque', unit: ['Nm', 'lbft'] },
        ],
        defaults: { teeth: '20:60', rpm: 1500, torque: 10 },
        inputs: (v) => ({ stages: parseProblem(`gears ${String(v.teeth ?? '')}`, 'gears')?.inputs.stages, rpm: v.rpm, torque: v.torque }),
      },
      {
        id: 'bike', label: 'Bicycle', kind: 'bike',
        fields: [
          { key: 'chainring', label: 'Chainring teeth', type: 'num' },
          { key: 'sprocket', label: 'Sprocket teeth', type: 'num' },
          { key: 'wheel', label: 'Wheel across', type: 'num', q: 'length', unit: mm },
          { key: 'cadence', label: 'Pedalling', type: 'num', q: 'rpm', unit: ['rpm', 'rpm'] },
        ],
        defaults: { chainring: 50, sprocket: 11, wheel: 0.672, cadence: 90 },
        inputs: (v) => ({ chainring: v.chainring, sprocket: v.sprocket, wheel: v.wheel, cadence: v.cadence }),
      },
    ],
  },
  {
    id: 'engine',
    title: 'ENGINE',
    modes: [{
      id: 'engine', label: 'Engine', kind: 'engine',
      fields: [
        { key: 'type', label: 'Kind', type: 'select', options: [['na', 'Petrol, no turbo'], ['turbo', 'Turbo petrol'], ['diesel', 'Turbo diesel']] },
        { key: 'displacement', label: 'Size', type: 'num', q: 'volume', unit: ['L', 'cu in'] },
        { key: 'rpm', label: 'Peak-power speed', type: 'num', q: 'rpm', unit: ['rpm', 'rpm'] },
        { key: 'cr', label: 'Compression ratio', type: 'num', optional: true, hint: 'typical' },
        { key: 'power', label: 'Claimed power', type: 'num', q: 'power', unit: ['kW', 'hp'], optional: true, hint: 'to check one' },
      ],
      defaults: { type: 'na', displacement: 0.002, rpm: 6000 },
      inputs: (v) => ({ type: v.type, displacement: v.displacement, rpm: v.rpm, cr: v.cr, power: v.power }),
    }],
  },
  {
    id: 'wing',
    title: 'WING & CAR',
    modes: [
      {
        id: 'wing', label: 'Wing', kind: 'wing',
        fields: [
          { key: 'naca', label: 'NACA section', type: 'text', hint: '2412' },
          { key: 'alpha', label: 'Angle of attack', type: 'num', q: 'angle', unit: ['°', '°'] },
          { key: 'speed', label: 'Airspeed', type: 'num', q: 'speed', unit: ['km/h', 'mph'] },
          { key: 'area', label: 'Wing area', type: 'num', q: 'area', unit: ['m²', 'ft²'] },
          { key: 'span', label: 'Wingspan', type: 'num', q: 'length', unit: ['m', 'ft'] },
          { key: 'altitude', label: 'Altitude', type: 'num', q: 'length', unit: ['m', 'ft'] },
          { key: 'mass', label: 'Aircraft mass', type: 'num', q: 'mass', unit: ['kg', 'lb'], optional: true, hint: 'none' },
        ],
        defaults: { naca: '2412', alpha: (4 * Math.PI) / 180, speed: 50, area: 16.2, span: 11, altitude: 0 },
        inputs: (v) => ({ naca: v.naca, alpha: v.alpha, speed: v.speed, area: v.area, span: v.span, altitude: v.altitude, mass: v.mass }),
      },
      {
        id: 'car', label: 'Car', kind: 'car',
        fields: [
          { key: 'speed', label: 'Speed', type: 'num', q: 'speed', unit: ['km/h', 'mph'] },
          { key: 'cd', label: 'Drag coefficient', type: 'num' },
          { key: 'area', label: 'Frontal area', type: 'num', q: 'area', unit: ['m²', 'ft²'] },
          { key: 'mass', label: 'Mass', type: 'num', q: 'mass', unit: ['kg', 'lb'] },
          { key: 'wingArea', label: 'Rear wing area', type: 'num', q: 'area', unit: ['m²', 'ft²'], optional: true, hint: 'none' },
        ],
        defaults: { speed: 31.2928, cd: 0.3, area: 2.2, mass: 1300 },
        inputs: (v) => ({ speed: v.speed, cd: v.cd, area: v.area, mass: v.mass, wingArea: v.wingArea }),
      },
      {
        id: 'fall', label: 'Falling', kind: 'fall',
        fields: [
          { key: 'mass', label: 'Mass', type: 'num', q: 'mass', unit: ['kg', 'lb'] },
          { key: 'cd', label: 'Drag coefficient', type: 'num' },
          { key: 'area', label: 'Area facing the air', type: 'num', q: 'area', unit: ['m²', 'ft²'] },
        ],
        defaults: { mass: 80, cd: 1, area: 0.7 },
        inputs: (v) => ({ mass: v.mass, cd: v.cd, area: v.area }),
      },
    ],
  },
  {
    id: 'projectile',
    title: 'PROJECTILE',
    modes: [{
      id: 'projectile', label: 'Projectile', kind: 'projectile',
      fields: [
        { key: 'speed', label: 'Launch speed', type: 'num', q: 'speed', unit: ['km/h', 'mph'] },
        { key: 'angle', label: 'Angle up', type: 'num', q: 'angle', unit: ['°', '°'] },
        { key: 'height', label: 'Launched from', type: 'num', q: 'length', unit: ['m', 'ft'] },
        { key: 'drag', label: 'Through air', type: 'check' },
        { key: 'mass', label: 'Its mass', type: 'num', q: 'mass', unit: ['kg', 'lb'], when: (v) => v.drag !== false },
        { key: 'diameter', label: 'Across', type: 'num', q: 'length', unit: mm, when: (v) => v.drag !== false },
        { key: 'cd', label: 'Drag coefficient', type: 'num', when: (v) => v.drag !== false },
      ],
      defaults: { speed: 25, angle: Math.PI / 4, height: 0, drag: true, mass: 0.43, diameter: 0.22, cd: 0.25 },
      inputs: (v) => ({ speed: v.speed, angle: v.angle, height: v.height, drag: v.drag !== false, mass: v.mass, diameter: v.diameter, cd: v.cd }),
    }],
  },
  {
    id: 'orbit',
    title: 'ORBIT',
    modes: [{
      id: 'orbit', label: 'Orbit', kind: 'orbit',
      fields: [
        { key: 'body', label: 'Around', type: 'select', options: [['earth', 'The Earth'], ['moon', 'The Moon'], ['mars', 'Mars']] },
        { key: 'altitude', label: 'Height above it', type: 'num', q: 'length', unit: ['km', 'mi'] },
        { key: 'to', label: 'Transfer up to', type: 'num', q: 'length', unit: ['km', 'mi'], optional: true, hint: 'none' },
      ],
      defaults: { body: 'earth', altitude: 420_000 },
      inputs: (v) => ({ body: v.body, altitude: v.altitude, to: v.to }),
    }],
  },
  {
    id: 'heat',
    title: 'HEAT',
    modes: [{
      id: 'heat', label: 'Heat loss', kind: 'heat',
      fields: [
        { key: 'layers', label: 'Wall, inside out (mm)', type: 'text', hint: 'brick 225, plaster 13' },
        { key: 'floor', label: 'Floor area', type: 'num', q: 'area', unit: ['m²', 'ft²'] },
        { key: 'height', label: 'Ceiling height', type: 'num', q: 'length', unit: ['m', 'ft'] },
        { key: 'wall', label: 'Outside wall', type: 'num', q: 'area', unit: ['m²', 'ft²'] },
        { key: 'window', label: 'Window in it', type: 'num', q: 'area', unit: ['m²', 'ft²'] },
        { key: 'windowU', label: 'Window U-value', type: 'num' },
        { key: 'ach', label: 'Air changes an hour', type: 'num' },
        { key: 'inside', label: 'Inside', type: 'num', q: 'temperature', unit: ['°C', '°F'] },
        { key: 'outside', label: 'Outside', type: 'num', q: 'temperature', unit: ['°C', '°F'] },
        { key: 'fuel', label: 'Heated by', type: 'select', options: [['gas', 'Gas boiler'], ['electric', 'Electric heaters'], ['heatpump', 'Heat pump']] },
        { key: 'tariff', label: 'Tariff, pence a kWh', type: 'num' },
      ],
      defaults: { layers: 'brick 225, plaster 13', floor: 20, height: 2.4, wall: 10, window: 2, windowU: 2.8, ach: 1.5, inside: 294.15, outside: 274.15, fuel: 'gas', tariff: 6 },
      inputs: (v) => ({ layers: layersOf(String(v.layers ?? '')) ?? undefined, floor: v.floor, height: v.height, wall: v.wall, window: v.window, windowU: v.windowU, ach: v.ach, inside: v.inside, outside: v.outside, fuel: v.fuel, tariff: typeof v.tariff === 'number' ? v.tariff / 100 : undefined }),
    }],
  },
  {
    id: 'sun',
    title: 'SUN & SHADOW',
    modes: [{
      id: 'sun', label: 'Sun', kind: 'sun',
      fields: [
        { key: 'date', label: 'Day', type: 'date' },
        { key: 'time', label: 'Time', type: 'time' },
        { key: 'height', label: 'Building height', type: 'num', q: 'length', unit: ['m', 'ft'] },
      ],
      defaults: { ...today(), height: 10 },
      inputs: (v, ctx) => {
        const at = new Date(`${String(v.date ?? today().date)}T${String(v.time ?? '12:00')}`).getTime();
        return { lat: ctx.home.lat, lon: ctx.home.lon, place: ctx.home.name, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, at: Number.isFinite(at) ? at : undefined, height: v.height };
      },
    }],
  },
  {
    id: 'circuit',
    title: 'CIRCUIT',
    modes: [
      {
        id: 'led', label: 'LED', kind: 'circuit',
        fields: [
          { key: 'supply', label: 'Supply', type: 'num', q: 'voltage', unit: ['V', 'V'] },
          { key: 'vf', label: 'LED forward voltage', type: 'num', q: 'voltage', unit: ['V', 'V'] },
          { key: 'current', label: 'Current', type: 'num', q: 'current', unit: ['mA', 'mA'] },
        ],
        defaults: { supply: 5, vf: 2, current: 0.02 },
        inputs: (v) => ({ mode: 'led', supply: v.supply, vf: v.vf, current: v.current }),
      },
      {
        id: 'ohm', label: "Ohm's law", kind: 'circuit',
        fields: [
          { key: 'v', label: 'Volts', type: 'num', q: 'voltage', unit: ['V', 'V'], optional: true, hint: 'work it out' },
          { key: 'i', label: 'Current', type: 'num', q: 'current', unit: ['A', 'A'], optional: true, hint: 'work it out' },
          { key: 'r', label: 'Resistance', type: 'num', q: 'resistance', unit: ['Ω', 'Ω'], optional: true, hint: 'work it out' },
        ],
        defaults: { v: 12, r: 4 },
        inputs: (v) => ({ mode: 'ohm', v: v.v, i: v.i, r: v.r }),
      },
      {
        id: 'resistors', label: 'Resistors', kind: 'circuit',
        fields: [{ key: 'rs', label: 'Resistors (Ω)', type: 'text', hint: '100, 220, 4k7' }],
        defaults: { rs: '100, 100' },
        inputs: (v) => ({ mode: 'resistors', rs: resistorsOf(String(v.rs ?? '')) ?? [] }),
      },
      {
        id: 'divider', label: 'Divider', kind: 'circuit',
        fields: [
          { key: 'vin', label: 'Volts in', type: 'num', q: 'voltage', unit: ['V', 'V'] },
          { key: 'r1', label: 'Top resistor', type: 'num', q: 'resistance', unit: ['kΩ', 'kΩ'] },
          { key: 'r2', label: 'Bottom resistor', type: 'num', q: 'resistance', unit: ['kΩ', 'kΩ'] },
        ],
        defaults: { vin: 9, r1: 10_000, r2: 5_000 },
        inputs: (v) => ({ mode: 'divider', vin: v.vin, r1: v.r1, r2: v.r2 }),
      },
      {
        id: 'rc', label: 'RC', kind: 'circuit',
        fields: [
          { key: 'r', label: 'Resistor', type: 'num', q: 'resistance', unit: ['kΩ', 'kΩ'] },
          { key: 'c', label: 'Capacitor', type: 'num', q: 'capacitance', unit: ['µF', 'µF'] },
        ],
        defaults: { r: 10_000, c: 100e-6 },
        inputs: (v) => ({ mode: 'rc', r: v.r, c: v.c }),
      },
      {
        id: 'power', label: 'Running cost', kind: 'circuit',
        fields: [
          { key: 'watts', label: 'Power', type: 'num', q: 'power', unit: ['W', 'W'] },
          { key: 'hours', label: 'Hours a day', type: 'num' },
          { key: 'tariff', label: 'Tariff, pence a kWh', type: 'num' },
        ],
        defaults: { watts: 100, hours: 4, tariff: 25 },
        inputs: (v) => ({ mode: 'power', watts: v.watts, hours: v.hours, tariff: typeof v.tariff === 'number' ? v.tariff / 100 : undefined }),
      },
    ],
  },
];

/** The panel and mode that solve `kind` (the bicycle is GEARS's second mode, a car WING & CAR's; a circuit by its mode). */
export function modeFor(kind: WorkKind, inputs: Record<string, unknown> = {}): { panel: PanelSpec; mode: Mode } | null {
  for (const panel of PANELS) {
    const mode = panel.modes.find((m) => m.kind === kind && (kind !== 'circuit' || m.id === (inputs.mode ?? 'led')));
    if (mode) return { panel, mode };
  }
  return null;
}
