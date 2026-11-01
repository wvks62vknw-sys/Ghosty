/**
 * THE WORKBENCH: gear trains and ratios (OWNER-ISSUES 61b), pure and total. A train of stages — spur gear pairs by their
 * teeth, a belt or a chain by its pulleys' diameters (or sprockets' teeth), or a bare ratio — gives the overall ratio, the
 * output speed and torque from the input, and which way the output turns; a bicycle's gear in inches and metres is the
 * familiar case.
 *
 * The ratio of a stage is driven ÷ driver (above 1: slower and stronger). Each gear mesh is taken at 98 % efficient and each
 * belt at 97 % (said, as the guess they are); an external gear pair reverses the direction, a belt or chain keeps it.
 */
import { caveatFor, confidenceOf, problemEstimate, type Estimate, type EstLine } from './estimate';
import { num, show, type UnitSystem } from './units';

/** A spur gear pair by its teeth, a belt or chain by its pulleys or sprockets, or a bare ratio (taken as one gear pair). */
export type StageKind = 'gear' | 'belt' | 'chain' | 'ratio';

export interface Stage {
  kind?: StageKind;
  /** The driving gear's teeth (or pulley's diameter, any unit, as long as both match). */
  driver: number;
  driven: number;
}

export interface GearsIn {
  stages?: Stage[];
  /** Input speed, rpm. */
  rpm?: number;
  /** Input torque, N·m. */
  torque?: number;
  /** Efficiency of one gear mesh (0.98 unless he says). */
  mesh?: number;
}

export const MESH = 0.98;
export const BELT = 0.97;
export const GEARS_DEFAULTS = { stages: [{ kind: 'gear', driver: 20, driven: 60 }] as Stage[], rpm: 1500, torque: 10 };

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

/** "36 : 1" for a reduction, "1 : 4.55" for a speed-up. */
export function ratioWords(r: number): string {
  return r >= 1 ? `${num(r, 3)} : 1` : `1 : ${num(1 / r, 3)}`;
}

export function solveGears(input: GearsIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Gear train';
  let defaulted = false;
  const stages = input.stages?.length ? input.stages : ((defaulted = true), GEARS_DEFAULTS.stages);
  for (const s of stages) {
    if (!ok(s.driver) || !ok(s.driven)) return problemEstimate('gears', title, 'every stage needs a driver and a driven size above zero');
    if ((s.kind ?? 'gear') === 'gear' && (s.driver < 6 || s.driven < 6 || !Number.isInteger(s.driver) || !Number.isInteger(s.driven))) {
      return problemEstimate('gears', title, 'a spur gear has a whole number of teeth, at least 6 (12 or more in practice)');
    }
  }
  if (stages.length > 12) return problemEstimate('gears', title, 'more than twelve stages is not one gearbox');
  const rpm = ok(input.rpm) ? input.rpm : ((defaulted = true), GEARS_DEFAULTS.rpm);
  const torque = ok(input.torque) ? input.torque : ((defaulted = true), GEARS_DEFAULTS.torque);
  const mesh = ok(input.mesh) && input.mesh <= 1 ? input.mesh : MESH;
  const ratio = stages.reduce((r, s) => r * (s.driven / s.driver), 1);
  const gearsN = stages.filter((s) => (s.kind ?? 'gear') === 'gear' || s.kind === 'ratio').length;
  const beltsN = stages.length - gearsN;
  const eff = mesh ** gearsN * BELT ** beltsN;
  const outRpm = rpm / ratio;
  const outTorque = torque * ratio * eff;
  const reversed = gearsN % 2 === 1;
  const lines: EstLine[] = [
    { label: 'Overall ratio', value: ratioWords(ratio), note: ratio >= 1 ? 'slower and stronger' : 'faster and weaker' },
    { label: 'Output speed', value: `${num(outRpm, 3)} rpm`, note: `from ${num(rpm, 3)} rpm` },
    { label: 'Output torque', value: show(outTorque, 'torque', system), note: `from ${show(torque, 'torque', system)}, after losses` },
    { label: 'Efficiency', value: `${num(eff * 100, 3)} %`, note: `${gearsN} mesh${gearsN === 1 ? '' : 'es'}${beltsN ? `, ${beltsN} belt${beltsN === 1 ? '' : 's'}` : ''}` },
    { label: 'Output turns', value: reversed ? 'the other way' : 'the same way', note: gearsN ? `${gearsN} external mesh${gearsN === 1 ? '' : 'es'}` : 'belts keep the direction' },
  ];
  if (stages.length > 1) stages.forEach((s, i) => lines.push({ label: `Stage ${i + 1}`, value: ratioWords(s.driven / s.driver), note: `${num(s.driver, 4)} → ${num(s.driven, 4)}${(s.kind ?? 'gear') === 'gear' ? ' teeth' : s.kind === 'ratio' ? ' (a ratio)' : ` (${s.kind})`}` }));
  return {
    kind: 'gears',
    title: `${title}: ${stages.length} stage${stages.length === 1 ? '' : 's'}`,
    lines,
    assumptions: [
      ...(input.stages?.length ? [] : ['one pair: a 20-tooth gear driving a 60']),
      ...(ok(input.rpm) ? [] : [`an input of ${num(rpm, 4)} rpm`]),
      ...(ok(input.torque) ? [] : [`an input torque of ${show(torque, 'torque', system)}`]),
      `${num(mesh * 100, 3)} % per gear mesh, ${num(BELT * 100, 3)} % per belt or chain`,
      'external spur gears (an idler or an internal ring changes the direction, not the ratio)',
      'no slip: a belt can creep 1–2 %',
    ],
    method: 'ratio = product of driven ÷ driver; output speed = input ÷ ratio; output torque = input × ratio × efficiency',
    confidence: confidenceOf(defaulted),
    changes: ['worn or poorly lubricated gears lose more (90–95 % a mesh)', 'a slipping belt lowers the output speed', 'a gearbox at part load is less efficient than at full load'],
    caveat: caveatFor('gears'),
    values: { ratio, outRpm, outTorque, efficiency: eff, reversed: reversed ? 1 : 0, meshes: gearsN },
  };
}

export interface BikeIn {
  chainring?: number;
  sprocket?: number;
  /** The wheel's outside diameter, m (700c × 25 mm tyre = 0.672 m; a 27-inch wheel = 0.6858 m). */
  wheel?: number;
  /** Pedalling rate, rpm. */
  cadence?: number;
}

export const BIKE_DEFAULTS = { chainring: 50, sprocket: 11, wheel: 0.672, cadence: 90 };

/** A bicycle's gear: inches (the wheel's diameter × the ratio), development (metres a crank turn) and the speed at a cadence. */
export function solveBike(input: BikeIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Bicycle gear';
  let defaulted = false;
  const used: string[] = [];
  const cr = ok(input.chainring) ? input.chainring : ((defaulted = true), used.push('a 50-tooth chainring'), BIKE_DEFAULTS.chainring);
  const sp = ok(input.sprocket) ? input.sprocket : ((defaulted = true), used.push('an 11-tooth sprocket'), BIKE_DEFAULTS.sprocket);
  const wheel = ok(input.wheel) ? input.wheel : ((defaulted = true), used.push('a 700c wheel with a 25 mm tyre (672 mm across)'), BIKE_DEFAULTS.wheel);
  const cadence = ok(input.cadence) ? input.cadence : ((defaulted = true), used.push('pedalling at 90 rpm'), BIKE_DEFAULTS.cadence);
  if (cr < 10 || sp < 9 || cr > 80 || sp > 60) return problemEstimate('bike', title, 'chainrings run from about 22 to 60 teeth and sprockets from 9 to 52: check the numbers');
  if (wheel < 0.2 || wheel > 1) return problemEstimate('bike', title, `a wheel ${show(wheel, 'length', system)} across is not a bicycle's`);
  const ratio = cr / sp;
  const inches = (wheel / 0.0254) * ratio;
  const dev = Math.PI * wheel * ratio;
  const speed = (dev * cadence) / 60;
  return {
    kind: 'bike',
    title: `${title}: ${num(cr, 3)}/${num(sp, 3)}`,
    lines: [
      { label: 'Gear', value: `${num(inches, 3)} inches`, note: 'wheel diameter × chainring ÷ sprocket' },
      { label: 'Development', value: `${num(dev, 3)} m`, note: 'travelled per turn of the cranks' },
      { label: 'Ratio', value: `${num(ratio, 3)} : 1` },
      { label: `Speed at ${num(cadence, 3)} rpm`, value: show(speed, 'speed', system) },
    ],
    assumptions: [...used, 'the tyre at its nominal size (pressure and wear change it by a few millimetres)'],
    method: 'gear inches = wheel diameter in inches × chainring ÷ sprocket; development = π × wheel diameter × chainring ÷ sprocket',
    confidence: confidenceOf(defaulted),
    changes: ['a bigger tyre raises both a little', 'a smaller sprocket raises the gear in steps of about 8–10 %'],
    caveat: caveatFor('bike'),
    values: { inches, development: dev, ratio, speed },
  };
}
