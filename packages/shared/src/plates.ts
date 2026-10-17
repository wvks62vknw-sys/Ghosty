/**
 * UK number plates and the vehicle check's answer, shared by the brain (integrations/vehicle.ts)
 * and the phone (features/vehicle). A plate is only ever used to look up that one vehicle's
 * public record when the owner asks; nothing here identifies a person.
 *
 * Formats (GOV.UK "Vehicle registration numbers and number plates"):
 *   current  2001 on      AB12 CDE  — two area letters, a two-digit age (02–29 March, 51–79 September), three letters
 *   prefix   1983–2001    A123 BCD  — an age letter, 1–3 digits, three letters
 *   suffix   1963–1983    ABC 123D  — three letters, 1–3 digits, an age letter
 *   ni       Northern Ireland   ABZ 1234 — up to three letters whose last two are an NI code (with I or Z), 1–4 digits
 *   dateless before 1963  A 1, ABC 1234, 1234 AB — letters and digits either way round
 */

export type PlateFormat = 'current' | 'prefix' | 'suffix' | 'ni' | 'dateless';

/** "ab12 cde" → "AB12CDE": what the official services want (letters and digits only). */
export function normalisePlate(s: string): string {
  return String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Area letters never use I, Q or Z; the three random letters never use I or Q.
const CURRENT = /^[A-HJ-PR-Y]{2}(0[2-9]|[12]\d|5[1-9]|[67]\d)[A-HJ-PR-Z]{3}$/;
// The age letter of prefix and suffix plates was never I, O, Q, U or Z.
const PREFIX = /^[A-HJ-NPR-TV-Y][1-9]\d{0,2}[A-Z]{3}$/;
const SUFFIX = /^[A-Z]{3}[1-9]\d{0,2}[A-HJ-NPR-TV-Y]$/;
// Northern Ireland's area codes: every one has an I or a Z (AZ … YZ, IA, IB, IG, IJ, IL, IW, JI, OI, UI, XI).
const NI = /^[A-Z]?(?:[A-HJ-Y]Z|I[ABGJLW]|[JOUX]I)[1-9]\d{0,3}$/;
const DATELESS = /^(?:[A-Z]{1,3}[1-9]\d{0,3}|[1-9]\d{0,3}[A-Z]{1,3})$/;

/** Which UK format a plate is in, or null when it is none of them. */
export function plateFormat(s: string): PlateFormat | null {
  const p = normalisePlate(s);
  if (p.length < 2 || p.length > 7) return null;
  if (CURRENT.test(p)) return 'current';
  if (PREFIX.test(p)) return 'prefix';
  if (SUFFIX.test(p)) return 'suffix';
  if (NI.test(p)) return 'ni';
  if (DATELESS.test(p)) return 'dateless';
  return null;
}

export const isPlate = (s: string): boolean => plateFormat(s) !== null;

/** The plate as it is written on the car: "AB12 CDE", "A123 BCD", "ABC 123D", "ABZ 1234". */
export function formatPlate(s: string): string {
  const p = normalisePlate(s);
  switch (plateFormat(p)) {
    case 'current':
      return `${p.slice(0, 4)} ${p.slice(4)}`;
    case 'prefix': {
      const m = p.match(/^([A-Z]\d+)([A-Z]{3})$/)!;
      return `${m[1]} ${m[2]}`;
    }
    case 'suffix': {
      const m = p.match(/^([A-Z]{3})(\d+[A-Z])$/)!;
      return `${m[1]} ${m[2]}`;
    }
    case 'ni':
    case 'dateless': {
      const m = p.match(/^([A-Z]+)(\d+)$/) ?? p.match(/^(\d+)([A-Z]+)$/);
      return m ? `${m[1]} ${m[2]}` : p;
    }
    default:
      return p;
  }
}

// What a reader most often mistakes on a plate: a digit where a letter must be, and the other way round.
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '8': 'B' };
const TO_DIGIT: Record<string, string> = { O: '0', D: '0', Q: '0', I: '1', L: '1', Z: '2', S: '5', G: '6', B: '8' };

/** A seven-character reading put right where a current plate must have letters or digits (only when one age digit was read as a digit). */
function mendCurrent(p: string): string | null {
  if (p.length !== 7 || !/\d/.test(p.slice(2, 4))) return null;
  const fixed = [...p].map((c, i) => (i === 2 || i === 3 ? TO_DIGIT[c] ?? c : TO_LETTER[c] ?? c)).join('');
  return CURRENT.test(fixed) ? fixed : null;
}

/**
 * UK plates in text read off a picture (the Lens's READ), best first and without repeats.
 * Only the dated formats and Northern Ireland's count: a dateless "A 1" or "M6" is everywhere
 * in ordinary text. Plates are written in capitals, so lower-case words never make one.
 */
export function findPlates(text: string): string[] {
  const tokens = String(text ?? '').split(/[^A-Za-z0-9]+/).filter((t) => /^[A-Z0-9]+$/.test(t));
  const found: string[] = [];
  const consider = (raw: string) => {
    if (raw.length < 3 || raw.length > 8) return;
    let p: string | null = raw;
    const f = plateFormat(p);
    if (!f || f === 'dateless') p = mendCurrent(raw);
    if (p && !found.includes(p)) found.push(p);
  };
  for (let i = 0; i < tokens.length; i++) {
    const a = tokens[i]!;
    const b = tokens[i + 1];
    // a plate is one word ("AB12CDE") or two ("AB12 CDE"); two words are tried first
    if (b !== undefined && a.length <= 4 && b.length <= 4) {
      const before = found.length;
      consider(a + b);
      if (found.length > before) {
        i++;
        continue;
      }
    }
    if (/\d/.test(a) && /[A-Z]/.test(a)) consider(a);
  }
  return found;
}

/** Whether text (typed in any case) mentions a UK plate in a dated or Northern Ireland format: such words are never kept for later (e.g. as a study question). */
export function mentionsPlate(text: string): boolean {
  return findPlates(String(text ?? '').toUpperCase()).length > 0;
}

export const PLATE_MARK = '[plate]';

/**
 * Every way a plate may be written ("AB12CDE", "ab12 cde", "AB 12-CDE") → "[plate]", for the plates
 * given. Only what is a UK plate counts: "[plate]" itself (read back as "PLATE") or any other word
 * is never one, so text already blanked stays as it is.
 */
export function redactPlates(text: string, plates: Iterable<string>): string {
  let out = text;
  for (const raw of plates) {
    const p = normalisePlate(raw);
    if (!isPlate(p)) continue;
    const re = new RegExp(`(?<![A-Za-z0-9])${[...p].join('[\\s-]?')}(?![A-Za-z0-9])`, 'gi');
    out = out.replace(re, PLATE_MARK);
  }
  return out;
}

/**
 * The plates that may be blanked across the whole saved history: a dateless plate ("A1", "K 1",
 * "M6") is also ordinary text ("a 1 hour wait", "the M6"), so it is blanked only in the exchange
 * that checked it.
 */
export function distinctivePlates(plates: Iterable<string>): string[] {
  return [...plates].map(normalisePlate).filter((p) => {
    const f = plateFormat(p);
    return f !== null && f !== 'dateless';
  });
}

/** The free official checks anyone can use in a browser: offered when there is no key, and always alongside a result. */
export const OFFICIAL_CHECKS = [
  { title: 'MOT history (GOV.UK)', url: 'https://www.gov.uk/check-mot-history' },
  { title: 'Vehicle tax and details (DVLA)', url: 'https://vehicleenquiry.service.gov.uk/' },
] as const;

export interface MotDefect {
  /** ADVISORY, MINOR, MAJOR, DANGEROUS, FAIL, PRS, USER ENTERED… as the MOT record has it. */
  type: string;
  text: string;
  dangerous: boolean;
}

export interface MotTest {
  /** YYYY-MM-DD */
  date: string;
  result: 'PASSED' | 'FAILED';
  /** YYYY-MM-DD, when the test gave one. */
  expiry: string | null;
  odometer: number | null;
  unit: 'mi' | 'km' | null;
  defects: MotDefect[];
}

/** A drop in the recorded mileage between two tests (the odometer went backwards). */
export interface MileageDrop {
  date: string;
  from: number;
  to: number;
}

export interface VehicleReport {
  /** As written on the car ("AB12 CDE"). */
  plate: string;
  make: string;
  model: string;
  colour: string;
  fuel: string;
  /** YYYY-MM-DD */
  firstUsed: string;
  engineCc: number | null;
  /** From DVSA's recalls service: Yes (one not fixed), No, Unknown, Unavailable. */
  recall: string;
  mot: {
    state: 'valid' | 'expired' | 'failed' | 'first_due' | 'none';
    /** valid: until; expired/failed: the date it ran out; first_due: when the first test is due. */
    date: string | null;
    text: string;
  };
  /** Newest first. */
  tests: MotTest[];
  mileage: {
    last: number | null;
    unit: 'mi' | 'km' | null;
    at: string | null;
    /** Readings oldest first, in miles, for the sparkline. */
    points: { date: string; miles: number }[];
    drops: MileageDrop[];
  };
  /** Advisories on the latest test. */
  advisories: number;
  /** From DVLA's Vehicle Enquiry Service, when its key is set. */
  dvla?: { taxStatus: string; taxDue: string; motStatus: string; co2: number | null; engineCc: number | null; year: number | null; colour: string };
  /** One line: MOT state, last mileage, advisories, any mileage warning. */
  verdict: string;
  sources: string[];
}

export type VehicleAnswer =
  | { ok: true; report: VehicleReport; text: string; links: { title: string; url: string }[] }
  | { ok: false; reason: 'invalid' | 'no_key' | 'not_found' | 'busy' | 'failed'; message: string; links: { title: string; url: string }[] };
