/**
 * NUMBERS BECOME A CHART (BRIEF-SHOW-ME-1): the label-and-number pairs a reply holds, read by code (a list, a table, "Jan £120,
 * Feb £95"), drawn as bars, or as a line when the labels run in time. Three pairs at least; two numbers are a sentence, not a
 * chart. Pure: show/stage.ts draws it. Nothing is added: every bar is a number the reply itself said.
 */
export interface Point {
  label: string;
  value: number;
}
export interface Series {
  kind: 'bars' | 'line';
  points: Point[];
  /** "£", "%", "kg" … as the reply wrote it ('' when none). */
  unit: string;
  /** Where the unit goes: before the figure (£, $, €) or after it. */
  before: boolean;
  /** One to three more series over the same labels (a table with more than one number column, the same unit), each named by its column. */
  more?: { name: string; values: number[] }[];
  /** The first series' own name (its column's head), when a table gave one. */
  name?: string;
}

const MONTHS = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?$/i;
const DAYS = /^(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\.?$/i;
const TIMEISH = (l: string) => MONTHS.test(l) || DAYS.test(l) || /^(?:19|20)\d\d$/.test(l) || /^q[1-4]$/i.test(l) || /^week \d+$/i.test(l) || /^\d{4}-(?:\d{2}(?:-\d{2})?|w\d{2})$/i.test(l) || /^(?:[01]?\d|2[0-3])(?::\d\d)?\s?(?:am|pm)?$/i.test(l);

const NUM = String.raw`(-?\d[\d,]*(?:\.\d+)?)`;
const UNIT = String.raw`(%|k|m|kg|km|mph|hrs?|hours?|mins?|minutes?|°c|c|p)?`;

const clean = (s: string) => s.replace(/\*\*|__|`/g, '').replace(/^[\s*•\-–—>\d.)]+(?=[A-Za-z£$€])/, '').trim();
const value = (s: string) => Number(s.replace(/,/g, ''));

/** A label that is a name for a thing: letters first, short, not a sentence. */
const labelOk = (l: string) => l.length >= 1 && l.length <= 28 && /^[A-Za-z0-9£$€][\w &/'().,-]*$/.test(l) && l.split(/\s+/).length <= 4 && !/^\d+$/.test(l);

function fromLines(text: string): { points: Point[]; cur: string; unit: string } | null {
  const points: Point[] = [];
  let cur = '';
  let unit = '';
  for (const raw of text.split('\n')) {
    const line = clean(raw);
    if (!line || line.length > 80) continue;
    const m = new RegExp(String.raw`^([A-Za-z][\w &/'().-]{0,27}?)\s*(?:[:\-–—=]|\s{2,}|\|)\s*([£$€])?\s*${NUM}\s*${UNIT}\b`, 'i').exec(line);
    if (!m || !labelOk(m[1]!.trim())) continue;
    if (m[2]) cur = m[2];
    if (m[4]) unit = m[4];
    points.push({ label: m[1]!.trim(), value: value(m[3]!) });
  }
  return points.length >= 3 ? { points, cur, unit } : null;
}

function fromTable(text: string): { points: Point[]; cur: string; unit: string; more?: { name: string; values: number[] }[]; name?: string } | null {
  const points: Point[] = [];
  let cur = '';
  let unit = '';
  const rows: { cells: string[]; nums: (RegExpExecArray | null)[] }[] = [];
  let head: string[] = [];
  for (const raw of text.split('\n')) {
    if (!/^\s*\|/.test(raw) || /^\s*\|[\s:|-]+\|?\s*$/.test(raw)) continue;
    const cells = raw.split('|').map((c) => clean(c)).filter((c) => c !== '');
    if (cells.length < 2) continue;
    const nums = cells.map((c, i) => (i === 0 ? null : new RegExp(String.raw`^([£$€])?\s*${NUM}\s*${UNIT}$`, 'i').exec(c)));
    if (!nums.some(Boolean)) {
      if (!head.length) head = cells;
      continue;
    }
    if (!labelOk(cells[0]!)) continue;
    rows.push({ cells, nums });
  }
  for (const r of rows) {
    const num = r.nums.find(Boolean)!;
    if (num[1]) cur = num[1];
    if (num[3]) unit = num[3];
    points.push({ label: r.cells[0]!, value: value(num[2]!) });
  }
  if (points.length < 3) return null;
  // more than one number column in the same unit: each is a series of its own (up to four in all)
  const first = rows[0]!;
  const cols = first.nums.map((n, i) => (n ? i : -1)).filter((i) => i > 0);
  const whole = cols.length > 1 && rows.every((r) => cols.every((i) => !!r.nums[i]));
  const more = whole
    ? cols.slice(1, 4).map((i) => ({ name: head[i] ?? `Series ${cols.indexOf(i) + 1}`, values: rows.map((r) => value(r.nums[i]![2]!)) }))
    : undefined;
  const same = !more || rows.every((r) => cols.every((i) => (r.nums[i]![1] ?? '') === (first.nums[cols[0]!]![1] ?? '') && (r.nums[i]![3] ?? '') === (first.nums[cols[0]!]![3] ?? '')));
  return { points, cur, unit, ...(more && same ? { more, ...(head[cols[0]!] ? { name: head[cols[0]!] } : {}) } : {}) };
}

function fromInline(text: string): { points: Point[]; cur: string; unit: string } | null {
  const points: Point[] = [];
  let cur = '';
  let unit = '';
  const body = text.replace(/\*\*|__|`/g, '');
  for (const m of body.matchAll(new RegExp(String.raw`(?:^|[:,;(]|\band\b)\s*([A-Za-z][A-Za-z ]{0,17}?)\s*[:=]?\s*([£$€])?\s*${NUM}\s*${UNIT}(?=\s*(?:[,;)]|\band\b|[.]?\s*$|\n))`, 'gi'))) {
    const label = m[1]!.trim();
    if (!labelOk(label) || /^(?:and|or|to|from|about|around|is|was|were|are|of|at|in|on|for|by|total|about)$/i.test(label)) continue;
    if (m[2]) cur = m[2];
    if (m[4]) unit = m[4];
    points.push({ label, value: value(m[3]!) });
  }
  return points.length >= 3 ? { points, cur, unit } : null;
}

/** The series the reply holds (at most twelve points), or null: three label-and-number pairs at least, no label twice. */
export function seriesFrom(reply: string): Series | null {
  const text = String(reply ?? '');
  if (text.length > 4000) return null;
  const got = fromTable(text) ?? fromLines(text) ?? fromInline(text);
  if (!got) return null;
  const seen = new Set<string>();
  const keep: number[] = [];
  got.points.forEach((p, i) => {
    if (Number.isFinite(p.value) && !seen.has(p.label.toLowerCase()) && !!seen.add(p.label.toLowerCase()) && keep.length < 12) keep.push(i);
  });
  const points = keep.map((i) => got.points[i]!);
  if (points.length < 3) return null;
  // a list of years, phone-number-like or id-like figures is not a series to draw
  if (points.every((p) => p.value >= 1900 && p.value <= 2100 && Number.isInteger(p.value)) && points.every((p) => TIMEISH(p.label) === false)) return null;
  const timeLike = points.filter((p) => TIMEISH(p.label)).length >= Math.ceil(points.length * 0.75);
  const more = (got as { more?: { name: string; values: number[] }[] }).more;
  const name = (got as { name?: string }).name;
  return { kind: timeLike ? 'line' : 'bars', points, unit: got.cur || got.unit.replace(/^p$/, 'p'), before: !!got.cur, ...(more ? { more: more.map((m) => ({ name: m.name, values: keep.map((i) => m.values[i]!) })) } : {}), ...(name ? { name } : {}) };
}

/** A figure as the reply wrote it: "£120", "42%", "7.5 kg". */
export function figure(v: number, s: Pick<Series, 'unit' | 'before'>): string {
  const n = Math.abs(v) >= 1000 ? v.toLocaleString('en-GB', { maximumFractionDigits: 1 }) : String(Math.round(v * 100) / 100);
  return !s.unit ? n : s.before ? `${s.unit}${n}` : /^[%°]/.test(s.unit) ? `${n}${s.unit}` : `${n} ${s.unit}`;
}

/** The number alone, as an axis tick writes it: thousands separated, never the unit (the axis says the unit once). */
export function tickText(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return Math.abs(r) >= 1000 ? r.toLocaleString('en-GB', { maximumFractionDigits: 3 }) : String(r);
}

/** Round ticks, steps of 1, 2 or 5 times a power of ten, covering lo to hi: the axis the chart is drawn on. */
export function niceTicks(lo: number, hi: number, want = 4): { ticks: number[]; lo: number; hi: number; step: number } {
  const a = Math.min(lo, hi);
  const b = Math.max(lo, hi);
  const span = b - a || Math.abs(b) || 1;
  const raw = span / Math.max(1, want);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const f = raw / pow;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pow;
  const nlo = Math.floor(a / step + 1e-9) * step;
  const nhi = Math.ceil(b / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = nlo; v <= nhi + step / 2 && ticks.length < 12; v += step) ticks.push(Math.round(v / step) * step);
  return { ticks, lo: ticks[0]!, hi: ticks[ticks.length - 1]!, step };
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** A label as he would say it: a stamp ("2026-03", "2026-03-14", a time in ms) is a month or a day in words; a word stays. */
export function humanLabel(l: string): string {
  const t = String(l).trim();
  let m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[T ].*)?$/.exec(t);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return m[3] ? `${Number(m[3])} ${MON[Number(m[2]) - 1]}` : MON[Number(m[2]) - 1]!;
  m = /^(\d{4})-W(\d{2})$/i.exec(t);
  if (m) return `Week ${Number(m[2])}`;
  if (/^\d{12,13}$/.test(t)) {
    const d = new Date(Number(t));
    return `${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
  }
  return t;
}

/** The question's own words as a title: "How have my bills gone this year?" is "Your bills this year". */
export function chartTitle(ask: string): string {
  const q = String(ask ?? '').trim().replace(/[?.!\s]+$/, '').replace(/\s+/g, ' ');
  const when = /\s+((?:this|last|so far this|over the (?:last|past)) (?:year|month|week|quarter|decade)|so far|lately|today|yesterday|in total)$/i.exec(q);
  const core = (when ? q.slice(0, when.index) : q).replace(/^(?:hey |ok |so |please |can you |could you )+/i, '');
  const m = /^(?:how (?:have|has|did|do|does|are|is|was|were)|what (?:is|are|was|were|has been|have been)|show me|give me|tell me|compare|chart|graph|plot)\s+(?:me\s+)?(my|our|the)?\s*(.+?)(?:\s+(?:gone|been|changed|done|doing|going|looked|looking|compare|compared|stacked up|varied|moved))?$/i.exec(core);
  if (!m || !m[2]) return q.length > 44 ? `${q.slice(0, 41).replace(/\s+\S*$/, '')}…` : q.charAt(0).toUpperCase() + q.slice(1);
  const lead = m[1] ? (/^(my|our)$/i.test(m[1]) ? 'Your' : 'The') : '';
  const noun = m[2]!.replace(/\s+(?:in|on|for|of)$/i, '');
  const words = lead ? `${lead} ${noun}` : noun.charAt(0).toUpperCase() + noun.slice(1);
  return `${words}${when ? ` ${when[1]!.toLowerCase()}` : ''}`;
}
