/**
 * AIM's night sky, worked out on the phone with no network at all: the Sun, the Moon (and its
 * phase), the five planets you can see by eye and about fifty of the brightest named stars, each
 * as a bearing from true north and a height above the horizon for a given moment and place.
 *
 * Sources (public): the planets from JPL's "Approximate Positions of the Planets" (Standish,
 * Keplerian elements and their rates, table 1, valid 1800–2050: a few arcminutes); the Moon from
 * the low-precision lunar series of the Astronomical Almanac (about 0.3°); the stars from their
 * catalogued J2000 positions and brightness (Yale Bright Star Catalogue values), carried to the
 * date by the IAU 1976 precession. Refraction near the horizon and the Moon's parallax are put in;
 * nutation and aberration (under 0.01°) are left out. Far better than the compass it is drawn by.
 *
 * Pure: no DOM, no fetch. The brain's tests run it (re-exported by targets.ts).
 */
import { DEG, RAD, wrap360 } from './project';

export type SkyKind = 'sun' | 'moon' | 'planet' | 'star';

export interface MoonPhase {
  /** 0–1, how much of the face is lit. */
  lit: number;
  waxing: boolean;
  /** The Moon's ecliptic longitude less the Sun's, 0–360 (0 new, 180 full). */
  age: number;
  /** "waxing gibbous, 78% lit". */
  words: string;
}

export interface SkyBody {
  /** 'sun', 'moon', 'jupiter', 'star:sirius'. */
  id: string;
  name: string;
  body: SkyKind;
  /** Right ascension and declination of the date, degrees. */
  ra: number;
  dec: number;
  /** Bearing from true north, degrees clockwise, 0–360. */
  az: number;
  /** Degrees above the horizon as it looks (refraction put in; the Moon from where the owner stands). */
  el: number;
  /** Visual magnitude (smaller is brighter), where it is known. */
  mag?: number;
  /** Kilometres from the Earth (the Sun, the Moon and the planets). */
  km?: number;
  /** A star's constellation. */
  con?: string;
  /** The Moon only. */
  phase?: MoonPhase;
}

const AU_KM = 149_597_870.7;
const EARTH_R_KM = 6378.14;

/** Days since 1 January 4713 BC noon (the astronomers' running day count). */
export const julianDay = (d: Date): number => d.getTime() / 86_400_000 + 2_440_587.5;
/** Julian centuries since J2000.0 (2000-01-01 12:00 TT; the few seconds TT is ahead of UTC do not matter here). */
const centuries = (jd: number): number => (jd - 2_451_545.0) / 36_525;

/** The tilt of the Earth's axis to its orbit at that moment, degrees. */
export const obliquity = (T: number): number => 23.439291 - 0.0130042 * T;
/** At J2000, the frame the planets' elements are given in. */
const OBL_J2000 = 23.43928;

type V3 = [number, number, number];

// ---- the planets: JPL "Approximate Positions of the Planets", table 1 (1800 AD – 2050 AD)
// [a (AU), e, I (°), L (°), long. perihelion ϖ (°), long. ascending node Ω (°)] and each one's rate per Julian century.
type Elements = [number, number, number, number, number, number];
const ELEMENTS: Record<'mercury' | 'venus' | 'emb' | 'mars' | 'jupiter' | 'saturn', [Elements, Elements]> = {
  mercury: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  ],
  venus: [
    [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  ],
  emb: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0],
  ],
  mars: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  ],
  jupiter: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  ],
  saturn: [
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  ],
};

/** Where a planet is around the Sun: J2000 ecliptic coordinates, AU. */
function heliocentric(which: keyof typeof ELEMENTS, T: number): V3 {
  const [e0, e1] = ELEMENTS[which];
  const a = e0[0] + e1[0] * T;
  const e = e0[1] + e1[1] * T;
  const I = (e0[2] + e1[2] * T) * RAD;
  const L = e0[3] + e1[3] * T;
  const peri = e0[4] + e1[4] * T;
  const node = e0[5] + e1[5] * T;
  const w = (peri - node) * RAD;
  const O = node * RAD;
  // the mean anomaly, -180..180, and Kepler's equation by Newton's method
  let M = wrap360(L - peri);
  if (M > 180) M -= 360;
  const m = M * RAD;
  let E = m + e * Math.sin(m);
  for (let i = 0; i < 12; i++) {
    const dE = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  const xp = a * (Math.cos(E) - e);
  const yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const cO = Math.cos(O);
  const sO = Math.sin(O);
  const cI = Math.cos(I);
  const sI = Math.sin(I);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

/** Ecliptic to equatorial coordinates, turning about the x axis by the obliquity (degrees). */
function eclToEq(v: V3, obl: number): V3 {
  const c = Math.cos(obl * RAD);
  const s = Math.sin(obl * RAD);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

/** RA and declination (degrees) of a direction. */
function raDec(v: V3): { ra: number; dec: number; r: number } {
  const r = Math.hypot(v[0], v[1], v[2]);
  return { ra: wrap360(Math.atan2(v[1], v[0]) * DEG), dec: Math.asin(v[2] / r) * DEG, r };
}

/** J2000 RA/Dec carried to the date by the IAU 1976 precession (Lieske; Meeus ch. 21), degrees. */
export function precess(ra: number, dec: number, T: number): { ra: number; dec: number } {
  const zeta = ((2306.2181 + (0.30188 + 0.017998 * T) * T) * T) / 3600;
  const z = ((2306.2181 + (1.09468 + 0.018203 * T) * T) * T) / 3600;
  const theta = ((2004.3109 - (0.42665 + 0.041833 * T) * T) * T) / 3600;
  const d0 = dec * RAD;
  const a0 = (ra + zeta) * RAD;
  const th = theta * RAD;
  const A = Math.cos(d0) * Math.sin(a0);
  const B = Math.cos(th) * Math.cos(d0) * Math.cos(a0) - Math.sin(th) * Math.sin(d0);
  const C = Math.sin(th) * Math.cos(d0) * Math.cos(a0) + Math.cos(th) * Math.sin(d0);
  return { ra: wrap360(Math.atan2(A, B) * DEG + z), dec: Math.asin(Math.max(-1, Math.min(1, C))) * DEG };
}

/** Equatorial (of the date) to ecliptic longitude and latitude (of the date), degrees. */
export function toEcliptic(ra: number, dec: number, date: Date): { lon: number; lat: number } {
  const e = obliquity(centuries(julianDay(date))) * RAD;
  const a = ra * RAD;
  const d = dec * RAD;
  const lon = Math.atan2(Math.sin(a) * Math.cos(e) + Math.tan(d) * Math.sin(e), Math.cos(a));
  const lat = Math.asin(Math.sin(d) * Math.cos(e) - Math.cos(d) * Math.sin(e) * Math.sin(a));
  return { lon: wrap360(lon * DEG), lat: lat * DEG };
}

/** The angle between two bodies on the sky, degrees (from their RA/Dec). */
export function separation(a: { ra: number; dec: number }, b: { ra: number; dec: number }): number {
  const c = Math.sin(a.dec * RAD) * Math.sin(b.dec * RAD) + Math.cos(a.dec * RAD) * Math.cos(b.dec * RAD) * Math.cos((a.ra - b.ra) * RAD);
  return Math.acos(Math.max(-1, Math.min(1, c))) * DEG;
}

/** Greenwich mean sidereal time, degrees (IAU 1982). */
export function siderealDeg(jd: number): number {
  const T = centuries(jd);
  return wrap360(280.46061837 + 360.98564736629 * (jd - 2_451_545.0) + 0.000387933 * T * T - (T * T * T) / 38_710_000);
}

/** Bearing from north and height above the horizon (no refraction) of an RA/Dec seen from a place. */
export function horizontal(ra: number, dec: number, lat: number, lon: number, jd: number): { az: number; el: number } {
  const H = (siderealDeg(jd) + lon - ra) * RAD;
  const p = lat * RAD;
  const d = dec * RAD;
  const el = Math.asin(Math.max(-1, Math.min(1, Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H)))) * DEG;
  const az = wrap360(Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(H) * Math.sin(p)) * DEG);
  return { az, el };
}

/** How much the air lifts something near the horizon, degrees (Sæmundsson; standard air). */
export function refraction(el: number): number {
  if (el < -1.5) return 0;
  return 1.02 / Math.tan((el + 10.3 / (el + 5.11)) * RAD) / 60;
}

// ---- the Moon: the Astronomical Almanac's low-precision series (ecliptic of the date)
function moonEcliptic(T: number): { lon: number; lat: number; parallax: number } {
  const s = (a: number, b: number) => Math.sin((a + b * T) * RAD);
  const c = (a: number, b: number) => Math.cos((a + b * T) * RAD);
  const lon =
    218.32 + 481267.881 * T + 6.29 * s(135.0, 477198.87) - 1.27 * s(259.3, -413335.36) + 0.66 * s(235.7, 890534.22) + 0.21 * s(269.9, 954397.74) - 0.19 * s(357.5, 35999.05) - 0.11 * s(186.5, 966404.03);
  const lat = 5.13 * s(93.3, 483202.02) + 0.28 * s(228.2, 960400.89) - 0.28 * s(318.3, 6003.15) - 0.17 * s(217.6, -407332.21);
  const parallax = 0.9508 + 0.0518 * c(135.0, 477198.87) + 0.0095 * c(259.3, -413335.36) + 0.0078 * c(235.7, 890534.22) + 0.0028 * c(269.9, 954397.74);
  return { lon: wrap360(lon), lat, parallax };
}

/** The Moon's phase in words from its age (its longitude less the Sun's) and how much is lit. */
export function phaseWords(age: number, lit: number): string {
  const a = wrap360(age);
  const pct = `${Math.round(lit * 100)}% lit`;
  if (a < 7 || a >= 353) return `new moon (${pct})`;
  if (a < 83) return `waxing crescent, ${pct}`;
  if (a < 97) return `first quarter, ${pct}`;
  if (a < 173) return `waxing gibbous, ${pct}`;
  if (a < 187) return `full moon (${pct})`;
  if (a < 263) return `waning gibbous, ${pct}`;
  if (a < 277) return `last quarter, ${pct}`;
  return `waning crescent, ${pct}`;
}

// ---- the stars: name, J2000 RA (hours), J2000 Dec (degrees), visual magnitude, constellation
const STARS: readonly [string, number, number, number, string][] = [
  ['Sirius', 6.7525, -16.7161, -1.46, 'Canis Major'],
  ['Canopus', 6.3992, -52.6957, -0.74, 'Carina'],
  ['Rigil Kentaurus', 14.6601, -60.8340, -0.27, 'Centaurus'],
  ['Arcturus', 14.261, 19.1825, -0.05, 'Boötes'],
  ['Vega', 18.6156, 38.7837, 0.03, 'Lyra'],
  ['Capella', 5.2782, 45.998, 0.08, 'Auriga'],
  ['Rigel', 5.2423, -8.2016, 0.13, 'Orion'],
  ['Procyon', 7.655, 5.225, 0.34, 'Canis Minor'],
  ['Achernar', 1.6286, -57.2368, 0.46, 'Eridanus'],
  ['Betelgeuse', 5.9195, 7.4071, 0.5, 'Orion'],
  ['Hadar', 14.0637, -60.373, 0.61, 'Centaurus'],
  ['Altair', 19.8464, 8.8683, 0.77, 'Aquila'],
  ['Acrux', 12.4433, -63.0991, 0.76, 'Crux'],
  ['Aldebaran', 4.5987, 16.5093, 0.86, 'Taurus'],
  ['Antares', 16.4901, -26.432, 0.96, 'Scorpius'],
  ['Spica', 13.4199, -11.1613, 0.97, 'Virgo'],
  ['Pollux', 7.7553, 28.0262, 1.14, 'the Twins'],
  ['Fomalhaut', 22.9608, -29.6222, 1.16, 'Piscis Austrinus'],
  ['Deneb', 20.6905, 45.2803, 1.25, 'Cygnus'],
  ['Mimosa', 12.7954, -59.6888, 1.25, 'Crux'],
  ['Regulus', 10.1395, 11.9672, 1.35, 'Leo'],
  ['Adhara', 6.9771, -28.9721, 1.5, 'Canis Major'],
  ['Castor', 7.5767, 31.8883, 1.58, 'the Twins'],
  ['Shaula', 17.5601, -37.1038, 1.62, 'Scorpius'],
  ['Gacrux', 12.5194, -57.1132, 1.64, 'Crux'],
  ['Bellatrix', 5.4189, 6.3497, 1.64, 'Orion'],
  ['Elnath', 5.4382, 28.6074, 1.65, 'Taurus'],
  ['Miaplacidus', 9.22, -69.7172, 1.67, 'Carina'],
  ['Alnilam', 5.6036, -1.2019, 1.69, 'Orion'],
  ['Alnair', 22.1372, -46.9611, 1.74, 'Grus'],
  ['Alnitak', 5.6793, -1.9426, 1.77, 'Orion'],
  ['Alioth', 12.9005, 55.9598, 1.77, 'Ursa Major (the Plough)'],
  ['Dubhe', 11.0621, 61.7511, 1.79, 'Ursa Major (the Plough)'],
  ['Mirfak', 3.4054, 49.8612, 1.79, 'Perseus'],
  ['Wezen', 7.1399, -26.3932, 1.84, 'Canis Major'],
  ['Kaus Australis', 18.4029, -34.3846, 1.85, 'Sagittarius'],
  ['Alkaid', 13.7923, 49.3133, 1.86, 'Ursa Major (the Plough)'],
  ['Menkalinan', 5.9921, 44.9474, 1.9, 'Auriga'],
  ['Alhena', 6.6285, 16.3993, 1.93, 'the Twins'],
  ['Polaris', 2.5303, 89.2641, 1.98, 'Ursa Minor'],
  ['Mirzam', 6.3783, -17.9559, 1.98, 'Canis Major'],
  ['Alphard', 9.4598, -8.6586, 1.98, 'Hydra'],
  ['Hamal', 2.1196, 23.4624, 2.0, 'Aries'],
  ['Nunki', 18.9211, -26.2967, 2.05, 'Sagittarius'],
  ['Kochab', 14.8451, 74.1555, 2.08, 'Ursa Minor'],
  ['Rasalhague', 17.5822, 12.56, 2.08, 'Ophiuchus'],
  ['Algol', 3.1361, 40.9556, 2.12, 'Perseus'],
  ['Denebola', 11.8177, 14.572, 2.14, 'Leo'],
  ['Mizar', 13.3988, 54.9254, 2.23, 'Ursa Major (the Plough)'],
  ['Schedar', 0.6751, 56.5373, 2.24, 'Cassiopeia'],
];
/** How many named stars AIM knows. */
export const STAR_COUNT = STARS.length;

const PLANETS: readonly { id: 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'; name: string; mag: (rd: number, i: number) => number }[] = [
  // magnitudes: the Astronomical Almanac's phase-angle formulas (Saturn's rings left out: within half a magnitude)
  { id: 'mercury', name: 'Mercury', mag: (rd, i) => -0.42 + 5 * Math.log10(rd) + 0.038 * i - 0.000273 * i * i + 0.000002 * i * i * i },
  { id: 'venus', name: 'Venus', mag: (rd, i) => -4.4 + 5 * Math.log10(rd) + 0.0009 * i + 0.000239 * i * i - 0.00000065 * i * i * i },
  { id: 'mars', name: 'Mars', mag: (rd, i) => -1.52 + 5 * Math.log10(rd) + 0.016 * i },
  { id: 'jupiter', name: 'Jupiter', mag: (rd, i) => -9.4 + 5 * Math.log10(rd) + 0.005 * i },
  { id: 'saturn', name: 'Saturn', mag: (rd) => -8.88 + 5 * Math.log10(rd) },
];

/**
 * Every body AIM knows, for a moment and a place: where each one is (bearing from true north and
 * height, refraction put in; below the horizon too, negative), with its brightness where known.
 * Nothing leaves the phone: this is arithmetic on the date and the owner's own position.
 */
export function skyAt(date: Date, lat: number, lon: number): SkyBody[] {
  const jd = julianDay(date);
  const T = centuries(jd);
  const out: SkyBody[] = [];
  const place = (b: Omit<SkyBody, 'az' | 'el'>, parallax = 0): SkyBody => {
    const h = horizontal(b.ra, b.dec, lat, lon, jd);
    // the Moon is near enough for where on the Earth one stands to lower it (up to about a degree)
    const geo = parallax ? h.el - Math.asin(Math.sin(parallax * RAD) * Math.cos(h.el * RAD)) * DEG : h.el;
    return { ...b, az: h.az, el: geo + refraction(geo) };
  };

  // the Sun: where the Earth (the Earth–Moon barycentre) is not, seen from it
  const earth = heliocentric('emb', T);
  const sunGeo: V3 = [-earth[0], -earth[1], -earth[2]];
  const sunJ2000 = raDec(eclToEq(sunGeo, OBL_J2000));
  const sunEq = precess(sunJ2000.ra, sunJ2000.dec, T);
  const R = sunJ2000.r;
  out.push(place({ id: 'sun', name: 'Sun', body: 'sun', ra: sunEq.ra, dec: sunEq.dec, mag: -26.7, km: R * AU_KM }));

  // the Moon, and its phase from the Sun
  const m = moonEcliptic(T);
  const obl = obliquity(T);
  const mv: V3 = [Math.cos(m.lat * RAD) * Math.cos(m.lon * RAD), Math.cos(m.lat * RAD) * Math.sin(m.lon * RAD), Math.sin(m.lat * RAD)];
  const moonEq = raDec(eclToEq(mv, obl));
  const sunEcl = toEcliptic(sunEq.ra, sunEq.dec, date);
  const age = wrap360(m.lon - sunEcl.lon);
  const elong = separation(moonEq, sunEq);
  const lit = (1 - Math.cos(elong * RAD)) / 2;
  const phaseAngle = 180 - elong;
  out.push(
    place(
      {
        id: 'moon',
        name: 'Moon',
        body: 'moon',
        ra: moonEq.ra,
        dec: moonEq.dec,
        mag: -12.73 + 0.026 * Math.abs(phaseAngle) + 4e-9 * phaseAngle ** 4,
        km: EARTH_R_KM / Math.sin(m.parallax * RAD),
        phase: { lit, waxing: age < 180, age, words: phaseWords(age, lit) },
      },
      m.parallax,
    ),
  );

  // the planets, from the Earth
  for (const p of PLANETS) {
    const hv = heliocentric(p.id, T);
    const g: V3 = [hv[0] - earth[0], hv[1] - earth[1], hv[2] - earth[2]];
    const j = raDec(eclToEq(g, OBL_J2000));
    const eq = precess(j.ra, j.dec, T);
    const r = Math.hypot(hv[0], hv[1], hv[2]);
    const d = j.r;
    const i = Math.acos(Math.max(-1, Math.min(1, (r * r + d * d - R * R) / (2 * r * d)))) * DEG;
    out.push(place({ id: p.id, name: p.name, body: 'planet', ra: eq.ra, dec: eq.dec, mag: Math.round(p.mag(r * d, i) * 10) / 10, km: d * AU_KM }));
  }

  // the stars
  for (const [name, raH, dec, mag, con] of STARS) {
    const eq = precess(raH * 15, dec, T);
    out.push(place({ id: `star:${name.toLowerCase().replace(/\s+/g, '-')}`, name, body: 'star', ra: eq.ra, dec: eq.dec, mag, con }));
  }
  return out;
}

/** Stars show once the Sun is this far below the horizon (the end of civil twilight). */
export const DARK_ENOUGH = -6;

/**
 * What AIM labels of the sky: only what is above the horizon; the Sun, the Moon and the planets
 * whenever they are up; stars only once it is dark enough, and then only the brighter ones (the
 * brightest dozen or so in twilight, the rest of the list once it is properly dark), Polaris
 * always then, since it marks north.
 */
export function skyShown(bodies: SkyBody[]): SkyBody[] {
  const sun = bodies.find((b) => b.id === 'sun');
  const sunEl = sun ? sun.el : -90;
  const faintest = sunEl < -12 ? 2.0 : sunEl < DARK_ENOUGH ? 1.0 : -Infinity;
  return bodies.filter((b) => b.el > 0 && (b.body !== 'star' || (sunEl < DARK_ENOUGH && ((b.mag ?? 9) <= faintest || b.id === 'star:polaris'))));
}

/** A direction in words: "north", "south-east", "west-north-west". */
export function directionWords(az: number): string {
  const W = ['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east', 'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west'];
  return W[Math.round(wrap360(az) / 22.5) % 16]!;
}

/** A height in words: "just above the horizon", "low", "halfway up", "high", "almost overhead". */
export function heightWords(el: number): string {
  if (el < 0) return 'below the horizon';
  if (el < 8) return 'just above the horizon';
  if (el < 25) return 'low in the sky';
  if (el < 55) return 'halfway up the sky';
  if (el < 80) return 'high in the sky';
  return 'almost overhead';
}

/** Where to look, in words: "south-east, low in the sky (18° up)". */
export const whereToLook = (az: number, el: number): string => `${directionWords(az)}, ${heightWords(el)} (${Math.round(el)}° up)`;

/** Brightness in words, with the magnitude. */
export function brightnessWords(mag: number): string {
  const m = mag.toFixed(1).replace('-', '−');
  if (mag < -1.5) return `brighter than any star (magnitude ${m})`;
  if (mag < 0.5) return `very bright (magnitude ${m})`;
  if (mag < 1.5) return `bright (magnitude ${m})`;
  return `easy to see in a dark sky (magnitude ${m})`;
}

/** A distance far away in words: "384,400 km", "628 million km". */
export function farText(km: number): string {
  if (km < 10_000_000) return `${(Math.round(km / 100) * 100).toLocaleString('en-GB')} km`;
  return `${Math.round(km / 1_000_000).toLocaleString('en-GB')} million km`;
}
