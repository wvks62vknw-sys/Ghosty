/**
 * THE WORKBENCH: beams and columns (OWNER-ISSUES 61b), pure and total. A beam simply supported, cantilevered (fixed at the
 * left end) or fixed at both ends, with a point load anywhere, a uniform load, or both (superposed), on a rectangle, a solid
 * round, a round tube or an I-beam, in one of five materials; and Euler's buckling load of a column with its end conditions.
 *
 * Every formula is the textbook closed form (Roark's Formulas for Stress and Strain; any statics text): the moment and the
 * deflection are sampled along the span from those closed forms and superposed, so a point load plus a uniform load gives
 * the true maximum, not the sum of two maxima at different places. Inputs and `values` are SI (m, N, N/m, Pa).
 */
import { caveatFor, confidenceOf, problemEstimate, type Estimate, type EstLine } from './estimate';
import { fmt, num, show, type UnitSystem } from './units';

export type Support = 'simple' | 'cantilever' | 'fixed';
export type SectionShape = 'rect' | 'round' | 'tube' | 'ibeam';
export type MaterialId = 's275' | 's355' | 'al6061' | 'c24' | 'c30';

export interface SectionIn {
  shape: SectionShape;
  /** Width and depth (rect, I-beam), m. */
  b?: number;
  h?: number;
  /** Outside diameter (round, tube), m. */
  d?: number;
  /** Wall thickness (tube), m. */
  t?: number;
  /** Web and flange thickness (I-beam), m. */
  tw?: number;
  tf?: number;
}

export interface SectionProps {
  /** Area m², second moments m⁴ (y: the strong axis, bending in the vertical plane; z: the weak axis), elastic modulus m³. */
  A: number;
  Iy: number;
  Iz: number;
  Zy: number;
  /** Depth (for span/depth), m. */
  depth: number;
  name: string;
}

export interface Material {
  id: MaterialId;
  name: string;
  /** Young's modulus, Pa. */
  E: number;
  /** The strength bending is checked against, Pa, and what it is. */
  f: number;
  fName: string;
  /** Density, kg/m³. */
  rho: number;
  /** The stated partial factor on the strength. */
  gammaM: number;
  /** Where the figures come from. */
  origin: string;
}

/**
 * The five materials. Steel: EN 10025-2 (yield for thicknesses up to 16 mm), E from EN 1993-1-1, γM0 = 1.0. Aluminium
 * 6061-T6: EN 1999-1-1 (0.2 % proof strength of extrusions), γM1 = 1.1. Timber C24: EN 338 (mean E parallel to the grain,
 * characteristic bending strength), γM = 1.3 from EN 1995-1-1, no kmod. Concrete C30/37: EN 1992-1-1 Table 3.1 (Ecm, and
 * fctm because plain concrete fails in tension when it bends), γC = 1.5.
 */
export const MATERIALS: Record<MaterialId, Material> = {
  s275: { id: 's275', name: 'steel S275', E: 210e9, f: 275e6, fName: 'yield strength', rho: 7850, gammaM: 1.0, origin: 'EN 10025-2, EN 1993-1-1' },
  s355: { id: 's355', name: 'steel S355', E: 210e9, f: 355e6, fName: 'yield strength', rho: 7850, gammaM: 1.0, origin: 'EN 10025-2, EN 1993-1-1' },
  al6061: { id: 'al6061', name: 'aluminium 6061-T6', E: 69e9, f: 240e6, fName: '0.2 % proof strength', rho: 2700, gammaM: 1.1, origin: 'EN 1999-1-1' },
  c24: { id: 'c24', name: 'timber C24', E: 11e9, f: 24e6, fName: 'bending strength', rho: 420, gammaM: 1.3, origin: 'EN 338, EN 1995-1-1' },
  c30: { id: 'c30', name: 'plain concrete C30/37', E: 33e9, f: 2.9e6, fName: 'tensile strength (fctm)', rho: 2400, gammaM: 1.5, origin: 'EN 1992-1-1 Table 3.1' },
};

/** "steel" → S275, "timber" → C24 …: the material his words name (null: none of them). */
export function materialOf(words: string): MaterialId | null {
  const w = String(words ?? '').toLowerCase();
  if (/\bs\s?355\b/.test(w)) return 's355';
  if (/\bs\s?275\b|\bsteel\b|\brsj\b|\bub\b|\buc\b|\bi-?beam\b/.test(w)) return 's275';
  if (/\balu(?:minium|minum)?\b|\b6061\b|\balloy\b/.test(w)) return 'al6061';
  if (/\btimber\b|\bwood(?:en)?\b|\bjoists?\b|\bc\s?24\b|\bc\s?16\b|\bpine\b|\boak\b/.test(w)) return 'c24';
  if (/\bconcrete\b|\bc\s?30\b|\blintel\b/.test(w)) return 'c30';
  return null;
}

const G = 9.80665;

/** A section's area, second moments and elastic modulus; a string when its sizes cannot make that shape. */
export function sectionProps(s: SectionIn): SectionProps | string {
  const pos = (x: number | undefined) => typeof x === 'number' && Number.isFinite(x) && x > 0;
  const mm = (x: number) => `${num(x * 1000)}`;
  switch (s.shape) {
    case 'rect': {
      if (!pos(s.b) || !pos(s.h)) return 'a rectangle needs its width and depth';
      const b = s.b!;
      const h = s.h!;
      return { A: b * h, Iy: (b * h ** 3) / 12, Iz: (h * b ** 3) / 12, Zy: (b * h * h) / 6, depth: h, name: `${mm(b)} × ${mm(h)} mm rectangle` };
    }
    case 'round': {
      if (!pos(s.d)) return 'a round bar needs its diameter';
      const d = s.d!;
      const I = (Math.PI * d ** 4) / 64;
      return { A: (Math.PI * d * d) / 4, Iy: I, Iz: I, Zy: I / (d / 2), depth: d, name: `${mm(d)} mm round bar` };
    }
    case 'tube': {
      if (!pos(s.d) || !pos(s.t)) return 'a tube needs its outside diameter and wall thickness';
      const d = s.d!;
      const t = s.t!;
      if (2 * t >= d) return 'the wall is as thick as the tube: use a round bar';
      const di = d - 2 * t;
      const I = (Math.PI * (d ** 4 - di ** 4)) / 64;
      return { A: (Math.PI * (d * d - di * di)) / 4, Iy: I, Iz: I, Zy: I / (d / 2), depth: d, name: `${mm(d)} × ${mm(t)} mm tube` };
    }
    case 'ibeam': {
      if (!pos(s.b) || !pos(s.h) || !pos(s.tw) || !pos(s.tf)) return 'an I-beam needs its width, depth, web and flange thicknesses';
      const b = s.b!;
      const h = s.h!;
      const tw = s.tw!;
      const tf = s.tf!;
      if (2 * tf >= h) return 'the flanges are thicker than the beam is deep';
      if (tw >= b) return 'the web is wider than the flanges';
      const hw = h - 2 * tf;
      const Iy = (b * h ** 3 - (b - tw) * hw ** 3) / 12;
      const Iz = (2 * tf * b ** 3) / 12 + (hw * tw ** 3) / 12;
      return { A: 2 * b * tf + hw * tw, Iy, Iz, Zy: Iy / (h / 2), depth: h, name: `${mm(h)} × ${mm(b)} mm I-beam` };
    }
  }
  return 'an unknown section shape';
}

export interface BeamIn {
  support?: Support;
  /** m */
  span?: number;
  /** A point load, N. */
  load?: number;
  /** Where the point load is, m from the left support (the fixed end of a cantilever); default the middle (a cantilever: its tip). */
  at?: number;
  /** A uniform load along the whole span, N/m. */
  udl?: number;
  material?: MaterialId;
  section?: SectionIn;
  /** Add the beam's own weight as a uniform load. */
  selfWeight?: boolean;
}

/** The defaults: a 3 m simply supported steel S275 beam, 100 × 200 mm, 5 kN in the middle. */
export const BEAM_DEFAULTS: Required<Omit<BeamIn, 'at'>> & { at?: number } = {
  support: 'simple',
  span: 3,
  load: 5000,
  udl: 0,
  material: 's275',
  section: { shape: 'rect', b: 0.1, h: 0.2 },
  selfWeight: false,
};

const SUPPORT_WORDS: Record<Support, string> = { simple: 'simply supported', cantilever: 'cantilever (fixed at one end)', fixed: 'fixed at both ends' };

/** Bending moment (sagging +, N·m), shear (N) and deflection (down +, m) at x, for one load case; EI in N·m². */
interface Curves {
  M(x: number): number;
  V(x: number): number;
  y(x: number): number;
}

function pointCase(s: Support, L: number, P: number, a: number, EI: number): Curves {
  const b = L - a;
  if (s === 'simple') {
    return {
      M: (x) => (x <= a ? (P * b * x) / L : (P * a * (L - x)) / L),
      V: (x) => (x < a ? (P * b) / L : -(P * a) / L),
      y: (x) => (x <= a ? (P * b * x * (L * L - b * b - x * x)) / (6 * L * EI) : (P * a * (L - x) * (L * L - a * a - (L - x) ** 2)) / (6 * L * EI)),
    };
  }
  if (s === 'cantilever') {
    // fixed at x = 0, free at x = L; the load at a from the fixed end
    return {
      M: (x) => (x <= a ? -P * (a - x) : 0),
      V: (x) => (x < a ? P : 0),
      y: (x) => (x <= a ? (P * x * x * (3 * a - x)) / (6 * EI) : (P * a * a * (3 * x - a)) / (6 * EI)),
    };
  }
  // fixed at both ends (Roark: the end reactions and moments of a fixed-fixed beam with a load at a)
  const R1 = (P * b * b * (3 * a + b)) / L ** 3;
  const M1 = -(P * a * b * b) / (L * L);
  return {
    M: (x) => M1 + R1 * x - (x > a ? P * (x - a) : 0),
    V: (x) => R1 - (x > a ? P : 0),
    y: (x) => (x <= a ? (P * b * b * x * x * (3 * a * L - (3 * a + b) * x)) / (6 * EI * L ** 3) : (P * a * a * (L - x) ** 2 * (3 * b * L - (3 * b + a) * (L - x))) / (6 * EI * L ** 3)),
  };
}

function udlCase(s: Support, L: number, w: number, EI: number): Curves {
  if (s === 'simple') return { M: (x) => (w * x * (L - x)) / 2, V: (x) => w * (L / 2 - x), y: (x) => (w * x * (L ** 3 - 2 * L * x * x + x ** 3)) / (24 * EI) };
  if (s === 'cantilever') return { M: (x) => -(w * (L - x) ** 2) / 2, V: (x) => w * (L - x), y: (x) => (w * x * x * (6 * L * L - 4 * L * x + x * x)) / (24 * EI) };
  return { M: (x) => -(w * L * L) / 12 + (w * L * x) / 2 - (w * x * x) / 2, V: (x) => w * (L / 2 - x), y: (x) => (w * x * x * (L - x) ** 2) / (24 * EI) };
}

/** Reactions at the two ends (a cantilever: all at the fixed end), N, and the end moments of a fixed end, N·m. */
function reactions(s: Support, L: number, P: number, a: number, w: number): { R1: number; R2: number; M1: number; M2: number } {
  const b = L - a;
  if (s === 'simple') return { R1: (P * b) / L + (w * L) / 2, R2: (P * a) / L + (w * L) / 2, M1: 0, M2: 0 };
  if (s === 'cantilever') return { R1: P + w * L, R2: 0, M1: -(P * a + (w * L * L) / 2), M2: 0 };
  return {
    R1: (P * b * b * (3 * a + b)) / L ** 3 + (w * L) / 2,
    R2: (P * a * a * (a + 3 * b)) / L ** 3 + (w * L) / 2,
    M1: -(P * a * b * b) / (L * L) - (w * L * L) / 12,
    M2: -(P * a * a * b) / (L * L) - (w * L * L) / 12,
  };
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A beam, as his card shows it. */
export function solveBeam(input: BeamIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Beam';
  // `used`: the defaults it took that the assumptions would not otherwise say; `defaulted`: any default at all (confidence)
  const used: string[] = [];
  let defaulted = false;
  const pick = <K extends keyof BeamIn>(k: K, dflt: BeamIn[K], say?: string): NonNullable<BeamIn[K]> => {
    const v = input[k];
    if (v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v))) {
      defaulted = true;
      if (say) used.push(say);
      return dflt as NonNullable<BeamIn[K]>;
    }
    return v as NonNullable<BeamIn[K]>;
  };
  const support = pick('support', BEAM_DEFAULTS.support);
  const L = pick('span', BEAM_DEFAULTS.span, `a span of ${show(BEAM_DEFAULTS.span, 'length', system)}`);
  const noLoad = !isNum(input.load) && !isNum(input.udl);
  const P = isNum(input.load) ? input.load : noLoad ? BEAM_DEFAULTS.load : 0;
  if (noLoad) {
    defaulted = true;
    used.push(`a point load of ${show(BEAM_DEFAULTS.load, 'force', system)}`);
  }
  const w0 = isNum(input.udl) ? input.udl : 0;
  const matId = pick('material', BEAM_DEFAULTS.material);
  const mat = MATERIALS[matId] ?? MATERIALS.s275;
  const sec = pick('section', BEAM_DEFAULTS.section);
  if (!(L > 0) || L > 100) return problemEstimate('beam', title, `a span of ${show(L, 'length', system)} is outside what these formulae are for (0.1 to 100 m)`);
  if (P < 0 || w0 < 0) return problemEstimate('beam', title, 'a load pulling upwards is not what this panel solves: give the loads as weights, pressing down');
  const props = sectionProps(sec);
  if (typeof props === 'string') return problemEstimate('beam', title, props);
  const atDefault = support === 'cantilever' ? L : L / 2;
  const a = isNum(input.at) ? input.at : atDefault;
  if (P > 0 && !isNum(input.at)) {
    defaulted = true;
    used.push(support === 'cantilever' ? 'the point load at the free end' : 'the point load in the middle');
  }
  if (a < 0 || a > L) return problemEstimate('beam', title, `the load is ${show(a, 'length', system)} along a ${show(L, 'length', system)} span: it must be on the beam`);
  const sw = input.selfWeight ? mat.rho * G * props.A : 0;
  const w = w0 + sw;
  const EI = mat.E * props.Iy;
  const cases: Curves[] = [];
  if (P > 0) cases.push(pointCase(support, L, P, a, EI));
  if (w > 0) cases.push(udlCase(support, L, w, EI));
  if (!cases.length) return problemEstimate('beam', title, 'there is no load on it: give a point load or a uniform load');
  // sample the span (and the load point itself, where the moment peaks)
  const N = 400;
  const xs = Array.from({ length: N + 1 }, (_, i) => (L * i) / N);
  if (P > 0) xs.push(a);
  let Mmax = 0;
  let Mx = 0;
  let ymax = 0;
  let yx = 0;
  for (const x of xs) {
    const M = cases.reduce((s, c) => s + c.M(x), 0);
    const y = cases.reduce((s, c) => s + c.y(x), 0);
    if (Math.abs(M) > Math.abs(Mmax)) {
      Mmax = M;
      Mx = x;
    }
    if (Math.abs(y) > Math.abs(ymax)) {
      ymax = y;
      yx = x;
    }
  }
  const R = reactions(support, L, P, a, w);
  const Vmax = Math.max(Math.abs(R.R1), Math.abs(R.R2));
  const sigma = Math.abs(Mmax) / props.Zy;
  const design = mat.f / mat.gammaM;
  const util = sigma / design;
  const limit = L / 250;
  const defl = Math.abs(ymax);
  if (defl > L / 20) {
    return problemEstimate('beam', title, `it would bend ${show(defl, 'length', system)}, more than a twentieth of its span — far past where the small-deflection formulae hold; it has failed long before this. Choose a much stiffer section`);
  }
  const lines: EstLine[] = [
    { label: 'Max deflection', value: show(defl, 'length', system), note: `span/${num(L / Math.max(defl, 1e-12), 3)} at ${show(yx, 'length', system)}` },
    { label: 'Span/250 check', value: defl <= limit ? 'within' : 'over', note: `limit ${show(limit, 'length', system)}` },
    { label: 'Max bending stress', value: show(sigma, 'pressure', system, system === 'metric' ? 'MPa' : 'psi') },
    { label: 'Utilisation', value: `${num(util * 100, 2)} %`, note: `against ${mat.fName} ${fmt(mat.f, 'MPa')} ÷ γM ${mat.gammaM.toFixed(1)}` },
    { label: 'Max moment', value: show(Math.abs(Mmax), 'torque', system, system === 'metric' ? 'kNm' : 'lbft'), note: `at ${show(Mx, 'length', system)}` },
    { label: 'Max shear', value: show(Vmax, 'force', system) },
    support === 'cantilever'
      ? { label: 'Reaction at the fixed end', value: show(R.R1, 'force', system), note: `and a moment of ${show(Math.abs(R.M1), 'torque', system, system === 'metric' ? 'kNm' : 'lbft')}` }
      : { label: 'Reactions', value: `${show(R.R1, 'force', system)} left, ${show(R.R2, 'force', system)} right` },
  ];
  if (util > 1) lines.splice(4, 0, { label: 'Strength', value: 'over', note: 'it would yield or break before carrying this' });
  if (input.selfWeight) lines.push({ label: 'Its own weight', value: show(sw, 'lineload', system), note: 'added as a uniform load' });
  const assumptions = [
    ...used,
    `${SUPPORT_WORDS[support]}`,
    `${props.name}, ${mat.name}: E ${fmt(mat.E, 'GPa')}, ${mat.fName} ${fmt(mat.f, 'MPa')} (${mat.origin})`,
    `partial factor γM ${mat.gammaM.toFixed(1)}; loads as given, unfactored`,
    'bending about the strong axis; the section stays straight (no twisting or local buckling)',
    ...(props.name.includes('I-beam') ? ['root fillets ignored (properties 1–2 % low)'] : []),
    ...(input.selfWeight ? [] : ['its own weight left out']),
    ...(mat.id === 'c30' ? ['plain concrete: a real concrete beam is reinforced, and this is not a reinforced design'] : []),
    ...(mat.id === 'c24' ? ['no kmod for load duration or moisture (they lower timber further)'] : []),
  ];
  const changes = [
    'a longer span adds deflection with the cube of the length (the fourth power under a spread load)',
    'a deeper section stiffens it with the cube of its depth',
    ...(P > 0 && support !== 'cantilever' ? ['moving the load towards a support lowers the moment'] : []),
    ...(mat.id === 'c24' ? ['wet or long-loaded timber creeps: deflection grows over years'] : []),
    'notches, holes, a support that settles or a sideways twist change everything',
  ];
  return {
    kind: 'beam',
    title: `Beam: ${show(L, 'length', system)}, ${SUPPORT_WORDS[support].split(' (')[0]}`,
    lines,
    assumptions,
    method: `superposed closed forms (Roark): deflection from E·I = ${num(EI / 1000, 3)} kN·m², stress = M ÷ Z with Z = ${num(props.Zy * 1e6, 3)} cm³`,
    confidence: confidenceOf(defaulted),
    changes,
    caveat: caveatFor('beam'),
    values: { deflection: defl, deflectionAt: yx, moment: Math.abs(Mmax), momentAt: Mx, shear: Vmax, stress: sigma, utilisation: util, R1: R.R1, R2: R.R2, M1: R.M1, M2: R.M2, I: props.Iy, Z: props.Zy, A: props.A, selfWeight: sw, limit },
  };
}

export type Ends = 'pinned' | 'fixed-free' | 'fixed-pinned' | 'fixed';

/** The theoretical effective-length factors (codes use larger: 0.85 and 0.7 for the last two, 2.1 for a flagpole). */
export const K_FACTOR: Record<Ends, number> = { pinned: 1, 'fixed-free': 2, 'fixed-pinned': 0.699, fixed: 0.5 };
const ENDS_WORDS: Record<Ends, string> = { pinned: 'pinned at both ends', 'fixed-free': 'fixed at the foot, free at the top', 'fixed-pinned': 'fixed at one end, pinned at the other', fixed: 'fixed at both ends' };

export interface ColumnIn {
  /** m */
  length?: number;
  ends?: Ends;
  /** The axial load it carries, N (optional: without one, only its capacity). */
  load?: number;
  material?: MaterialId;
  section?: SectionIn;
}

export const COLUMN_DEFAULTS = { length: 3, ends: 'pinned' as Ends, material: 's275' as MaterialId, section: { shape: 'tube', d: 0.1143, t: 0.0036 } as SectionIn };

/** Euler's buckling load π²EI/(KL)² about the weak axis, the squash load A·f, and which comes first. */
export function solveColumn(input: ColumnIn = {}, system: UnitSystem = 'metric'): Estimate {
  const title = 'Column';
  const used: string[] = [];
  let defaulted = false;
  const L = isNum(input.length) ? input.length : ((defaulted = true), used.push(`a length of ${show(COLUMN_DEFAULTS.length, 'length', system)}`), COLUMN_DEFAULTS.length);
  const ends = input.ends && K_FACTOR[input.ends] ? input.ends : ((defaulted = true), COLUMN_DEFAULTS.ends);
  const matId = input.material && MATERIALS[input.material] ? input.material : ((defaulted = true), COLUMN_DEFAULTS.material);
  const sec = input.section ?? ((defaulted = true), COLUMN_DEFAULTS.section);
  if (!(L > 0) || L > 60) return problemEstimate('column', title, `a length of ${show(L, 'length', system)} is outside what this is for (up to 60 m)`);
  const props = sectionProps(sec);
  if (typeof props === 'string') return problemEstimate('column', title, props);
  const mat = MATERIALS[matId];
  const K = K_FACTOR[ends];
  const I = Math.min(props.Iy, props.Iz);
  const Pcr = (Math.PI ** 2 * mat.E * I) / (K * L) ** 2;
  const squash = (props.A * mat.f) / mat.gammaM;
  const r = Math.sqrt(I / props.A);
  const slender = (K * L) / r;
  const governs = Pcr < squash ? 'buckling' : 'crushing';
  const capacity = Math.min(Pcr, squash);
  const lines: EstLine[] = [
    { label: 'Euler buckling load', value: show(Pcr, 'force', system), note: `about the weak axis, K = ${K}` },
    { label: 'Squash load', value: show(squash, 'force', system), note: `area × ${mat.fName} ÷ ${mat.gammaM}` },
    { label: 'Slenderness KL/r', value: num(slender, 3) },
    { label: 'Comes first', value: governs },
  ];
  if (isNum(input.load) && input.load > 0) lines.unshift({ label: 'Utilisation', value: `${num((input.load / capacity) * 100, 2)} %`, note: `${show(input.load, 'force', system)} of ${show(capacity, 'force', system)}` });
  const assumptions = [
    ...used,
    ENDS_WORDS[ends],
    `${props.name}, ${mat.name}: E ${fmt(mat.E, 'GPa')} (${mat.origin})`,
    'perfectly straight, the load exactly on its axis',
    ...(mat.id === 'c30' ? ['plain concrete: real columns are reinforced'] : []),
  ];
  const changes = [
    'twice the length gives a quarter of the buckling load',
    'fixing the ends (K from 1 to 0.5) gives four times the buckling load',
    'a real column is a little crooked: it buckles well below Euler at middling slenderness (the Eurocode buckling curves)',
  ];
  if (slender < 40) changes.unshift('a column this stocky crushes before it buckles: Euler is not the limit here');
  return {
    kind: 'column',
    title: `Column: ${show(L, 'length', system)} ${ENDS_WORDS[ends].split(',')[0]}`,
    lines,
    assumptions,
    method: `Euler: P = π²·E·I ÷ (K·L)² with I = ${num(I * 1e8, 3)} cm⁴ about the weak axis; squash = A·f ÷ γM`,
    confidence: confidenceOf(defaulted),
    changes,
    caveat: caveatFor('column'),
    values: { euler: Pcr, squash, slenderness: slender, I, K, capacity, ...(isNum(input.load) ? { utilisation: input.load / capacity } : {}) },
  };
}
