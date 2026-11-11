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
}

const MONTHS = /^(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?$/i;
const DAYS = /^(?:mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)\.?$/i;
const TIMEISH = (l: string) => MONTHS.test(l) || DAYS.test(l) || /^(?:19|20)\d\d$/.test(l) || /^q[1-4]$/i.test(l) || /^week \d+$/i.test(l) || /^(?:[01]?\d|2[0-3])(?::\d\d)?\s?(?:am|pm)?$/i.test(l);

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

function fromTable(text: string): { points: Point[]; cur: string; unit: string } | null {
  const points: Point[] = [];
  let cur = '';
  let unit = '';
  for (const raw of text.split('\n')) {
    if (!/^\s*\|/.test(raw) || /^\s*\|[\s:|-]+\|?\s*$/.test(raw)) continue;
    const cells = raw.split('|').map((c) => clean(c)).filter((c) => c !== '');
    if (cells.length < 2) continue;
    const num = cells.slice(1).map((c) => new RegExp(String.raw`^([£$€])?\s*${NUM}\s*${UNIT}$`, 'i').exec(c)).find(Boolean);
    if (!num || !labelOk(cells[0]!)) continue;
    if (num[1]) cur = num[1];
    if (num[3]) unit = num[3];
    points.push({ label: cells[0]!, value: value(num[2]!) });
  }
  return points.length >= 3 ? { points, cur, unit } : null;
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
  const points = got.points.filter((p) => Number.isFinite(p.value) && !seen.has(p.label.toLowerCase()) && !!seen.add(p.label.toLowerCase())).slice(0, 12);
  if (points.length < 3) return null;
  // a list of years, phone-number-like or id-like figures is not a series to draw
  if (points.every((p) => p.value >= 1900 && p.value <= 2100 && Number.isInteger(p.value)) && points.every((p) => TIMEISH(p.label) === false)) return null;
  const timeLike = points.filter((p) => TIMEISH(p.label)).length >= Math.ceil(points.length * 0.75);
  return { kind: timeLike ? 'line' : 'bars', points, unit: got.cur || got.unit.replace(/^p$/, 'p'), before: !!got.cur };
}

/** A figure as the reply wrote it: "£120", "42%", "7.5 kg". */
export function figure(v: number, s: Pick<Series, 'unit' | 'before'>): string {
  const n = Math.abs(v) >= 1000 ? v.toLocaleString('en-GB', { maximumFractionDigits: 1 }) : String(Math.round(v * 100) / 100);
  return !s.unit ? n : s.before ? `${s.unit}${n}` : /^[%°]/.test(s.unit) ? `${n}${s.unit}` : `${n} ${s.unit}`;
}
