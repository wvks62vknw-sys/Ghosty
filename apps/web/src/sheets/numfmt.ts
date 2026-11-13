/**
 * HOW A NUMBER IS SHOWN (BRIEF-EDITOR-SPREADSHEETS): Excel's own format codes ("#,##0.00", "0.0%", "£#,##0.00", "dd/mm/yyyy", "d mmm yyyy"),
 * read and applied here, so the TEXT function, the cell's FORMAT keys and a .xlsx's number formats all go through one thing; dates as the
 * serial numbers Excel keeps (days since 30 Dec 1899, with Excel's own mistake that 1900 had a 29 February); and General, which shows what
 * fits in eleven characters. Pure.
 */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const EPOCH = Date.UTC(1899, 11, 30);

/** The serial of a date (month 1 to 12; days and months may run over, as DATE lets them). */
export function serialOf(y: number, m: number, d: number): number {
  const raw = Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000);
  return raw >= 61 ? raw : raw - 1;
}
/** The date a serial stands for (UTC fields), the day of the week (0 = Sunday) and the part of the day. */
export function dateOf(serial: number): { y: number; m: number; d: number; dow: number; secs: number } {
  const whole = Math.floor(serial);
  const raw = whole >= 61 ? whole : whole + 1;
  const dt = new Date(EPOCH + raw * 86_400_000);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), dow: dt.getUTCDay(), secs: Math.round((serial - whole) * 86_400) };
}
/** Today's serial from the phone's own clock (its own time zone), with the time of day as a fraction. */
export function nowSerial(date = new Date()): number {
  return serialOf(date.getFullYear(), date.getMonth() + 1, date.getDate()) + (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) / 86_400;
}

/** Round half away from zero at a number of decimals, the way Excel does (0.285 to 2 places is 0.29, not 0.28). */
export function roundHalf(x: number, digits: number): number {
  if (!Number.isFinite(x)) return x;
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const k = 10 ** digits;
  const scaled = Number((a * k).toPrecision(15));
  const r = Math.floor(scaled + 0.5);
  return sign * (digits >= 0 ? r / k : r * 10 ** -digits);
}

/** General: what fits in eleven characters (1/3 is 0.333333333, 2^70 is 1.18059E+21). */
export function general(n: number): string {
  if (!Number.isFinite(n)) return '#NUM!';
  if (n === 0) return '0';
  const a = Math.abs(n);
  if (a >= 1e11 || a < 1e-9) return n.toExponential(5).replace(/\.?0+e/, 'E').replace('e', 'E').replace(/E([+-])(\d)$/, 'E$10$2');
  for (let p = 10; p >= 1; p--) {
    const s = String(Number(n.toPrecision(p)));
    if (s.length <= 11 || p === 1) return s.includes('e') ? n.toFixed(0) : s;
  }
  return String(n);
}
/** A number as text in a formula (&, CONCAT): up to fifteen digits, as Excel joins them. */
export function plain(n: number): string {
  const s = String(Number(n.toPrecision(15)));
  return s.replace(/e([+-])(\d+)/, (_, sg: string, d: string) => `E${sg}${d.padStart(2, '0')}`);
}

interface Piece {
  kind: 'lit' | 'digit' | 'dot' | 'comma' | 'pct' | 'sci' | 'text';
  s: string;
}
/** The format code cut into its sections at the semicolons outside quotes. */
function sections(code: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < code.length; i++) {
    const ch = code[i]!;
    if (ch === '"') q = !q;
    if (ch === '\\' && !q) {
      cur += ch + (code[++i] ?? '');
      continue;
    }
    if (ch === ';' && !q) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}
const isDateCode = (sec: string): boolean => /[ymdhs]/i.test(sec.replace(/"[^"]*"/g, '').replace(/\\./g, '').replace(/\[[^\]]*\]/g, '').replace(/E[+-]/gi, ''));

function dateText(serial: number, sec: string): string {
  const dt = dateOf(serial);
  const hh = Math.floor(dt.secs / 3600);
  const mi = Math.floor((dt.secs % 3600) / 60);
  const ss = dt.secs % 60;
  const ampm = /AM\/PM|A\/P/i.test(sec);
  let out = '';
  let i = 0;
  let lastWasHour = false;
  const toks: { s: string; lit?: boolean }[] = [];
  while (i < sec.length) {
    const rest = sec.slice(i);
    const ch = rest[0]!;
    let m: RegExpExecArray | null;
    if (ch === '"') {
      const end = rest.indexOf('"', 1);
      toks.push({ s: rest.slice(1, end < 0 ? undefined : end), lit: true });
      i += (end < 0 ? rest.length : end + 1);
    } else if (ch === '\\') {
      toks.push({ s: rest[1] ?? '', lit: true });
      i += 2;
    } else if (ch === '[') {
      i += rest.indexOf(']') + 1 || rest.length;
    } else if ((m = /^(AM\/PM|A\/P)/i.exec(rest))) {
      toks.push({ s: m[0] });
      i += m[0].length;
    } else if ((m = /^(yyyy|yy|mmmmm|mmmm|mmm|mm|m|dddd|ddd|dd|d|hh|h|ss|s)/i.exec(rest))) {
      toks.push({ s: m[0] });
      i += m[0].length;
    } else {
      toks.push({ s: ch, lit: true });
      i++;
    }
  }
  toks.forEach((t, k) => {
    if (t.lit) {
      out += t.s;
      return;
    }
    const s = t.s.toLowerCase();
    if (s === 'yyyy') out += String(dt.y).padStart(4, '0');
    else if (s === 'yy') out += String(dt.y % 100).padStart(2, '0');
    else if (s === 'dddd') out += DAYS[dt.dow];
    else if (s === 'ddd') out += DAYS[dt.dow]!.slice(0, 3);
    else if (s === 'dd') out += String(dt.d).padStart(2, '0');
    else if (s === 'd') out += dt.d;
    else if (s === 'mmmm') out += MONTHS[dt.m - 1];
    else if (s === 'mmmmm') out += MONTHS[dt.m - 1]![0];
    else if (s === 'mmm') out += MONTHS[dt.m - 1]!.slice(0, 3);
    else if (s === 'hh' || s === 'h') {
      const h = ampm ? ((hh + 11) % 12) + 1 : hh;
      out += s === 'hh' ? String(h).padStart(2, '0') : h;
      lastWasHour = true;
      return;
    } else if (s === 'ss' || s === 's') out += s === 'ss' ? String(ss).padStart(2, '0') : ss;
    else if (s === 'mm' || s === 'm') {
      // minutes after an hour or before the seconds, else the month
      const after = lastWasHour;
      const next = toks.slice(k + 1).find((x) => !x.lit);
      const minutes = after || (next && /^s/i.test(next.s));
      const v = minutes ? mi : dt.m;
      out += s === 'mm' ? String(v).padStart(2, '0') : v;
    } else if (/^(am\/pm|a\/p)$/.test(s)) out += hh < 12 ? (s === 'a/p' ? 'A' : 'AM') : s === 'a/p' ? 'P' : 'PM';
    lastWasHour = false;
  });
  return out;
}

function numberText(x: number, sec: string, negAuto: boolean): string {
  const pieces: Piece[] = [];
  let i = 0;
  while (i < sec.length) {
    const ch = sec[i]!;
    if (ch === '"') {
      const end = sec.indexOf('"', i + 1);
      pieces.push({ kind: 'lit', s: sec.slice(i + 1, end < 0 ? undefined : end) });
      i = end < 0 ? sec.length : end + 1;
    } else if (ch === '\\') {
      pieces.push({ kind: 'lit', s: sec[i + 1] ?? '' });
      i += 2;
    } else if (ch === '_') {
      pieces.push({ kind: 'lit', s: ' ' });
      i += 2;
    } else if (ch === '*') i += 2;
    else if (ch === '[') i += sec.slice(i).indexOf(']') + 1 || sec.length;
    else if ('0#?'.includes(ch)) {
      pieces.push({ kind: 'digit', s: ch });
      i++;
    } else if (ch === '.') {
      pieces.push({ kind: 'dot', s: ch });
      i++;
    } else if (ch === ',') {
      pieces.push({ kind: 'comma', s: ch });
      i++;
    } else if (ch === '%') {
      pieces.push({ kind: 'pct', s: ch });
      i++;
    } else if (/^E[+-]/i.test(sec.slice(i))) {
      pieces.push({ kind: 'sci', s: sec.slice(i, i + 2) });
      i += 2;
    } else if (ch === '@') {
      pieces.push({ kind: 'text', s: ch });
      i++;
    } else {
      pieces.push({ kind: 'lit', s: ch });
      i++;
    }
  }
  const first = pieces.findIndex((p) => p.kind === 'digit');
  let last = -1;
  pieces.forEach((p, k) => p.kind === 'digit' && (last = k));
  let v = x;
  for (const p of pieces) if (p.kind === 'pct') v *= 100;
  // trailing commas after the last digit scale by a thousand each
  let k = last + 1;
  while (last >= 0 && pieces[k]?.kind === 'comma') {
    v /= 1000;
    k++;
  }
  const head = first < 0 ? pieces : pieces.slice(0, first);
  const tail = first < 0 ? [] : pieces.slice(last + 1).filter((p) => p.kind !== 'comma');
  const core = first < 0 ? [] : pieces.slice(first, last + 1);
  const text = (ps: Piece[]) => ps.map((p) => (p.kind === 'pct' ? '%' : p.kind === 'sci' ? '' : p.s)).join('');
  let body = '';
  const sci = core.find((p) => p.kind === 'sci');
  if (first >= 0) {
    const dotAt = core.findIndex((p) => p.kind === 'dot');
    const intPat = core.slice(0, dotAt < 0 ? undefined : dotAt).filter((p) => p.kind === 'digit');
    const decPat = dotAt < 0 ? [] : core.slice(dotAt + 1).filter((p) => p.kind === 'digit');
    const thousands = dotAt < 0 ? core.some((p) => p.kind === 'comma') : core.slice(0, dotAt).some((p) => p.kind === 'comma');
    const dec = decPat.length;
    const a = Math.abs(v);
    if (sci) {
      const exp = a === 0 ? 0 : Math.floor(Math.log10(a));
      const mant = a / 10 ** exp;
      body = `${roundHalf(mant, dec).toFixed(dec)}E${exp < 0 ? '-' : '+'}${String(Math.abs(exp)).padStart(2, '0')}`;
    } else {
      const rounded = roundHalf(a, dec);
      let [ip = '0', fp = ''] = rounded.toFixed(dec).split('.');
      const minInt = intPat.filter((p) => p.s === '0').length;
      ip = ip.replace(/^0+/, '');
      ip = ip.padStart(minInt, '0');
      if (intPat.some((p) => p.s === '?')) ip = ip.padStart(intPat.length, ' ');
      if (thousands) ip = ip.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      const chars = fp.split('');
      for (let n = dec - 1; n >= 0; n--) {
        if (decPat[n]!.s === '#' && chars[n] === '0' && chars.slice(n + 1).every((c) => c === '' || c === ' ')) chars[n] = '';
        else if (decPat[n]!.s === '?' && chars[n] === '0' && chars.slice(n + 1).every((c) => c === '' || c === ' ')) chars[n] = ' ';
        else break;
      }
      fp = chars.join('');
      body = dec > 0 && fp.replace(/ /g, '') !== '' ? `${ip}.${fp}` : ip;
    }
  }
  const neg = negAuto && v < 0 && Number(body.replace(/[^0-9.]/g, '')) !== 0;
  return `${neg ? '-' : ''}${text(head)}${body}${text(tail)}`;
}

/** A number shown by an Excel format code. "General" and "" give General. */
export function applyCode(x: number, code: string): string {
  if (!code || /^general$/i.test(code)) return general(x);
  const secs = sections(code);
  let sec = secs[0]!;
  let neg = true;
  if (secs.length > 1 && x < 0) {
    sec = secs[1]!;
    neg = false;
  } else if (secs.length > 2 && x === 0) sec = secs[2]!;
  if (/^@$/.test(sec)) return general(x);
  if (isDateCode(sec)) return dateText(x < 0 ? 0 : x, sec);
  return numberText(neg && secs.length === 1 ? x : Math.abs(x), sec, neg && secs.length === 1);
}
export const hasDateCode = (code: string): boolean => !!code && !/^general$/i.test(code) && isDateCode(sections(code)[0]!);
