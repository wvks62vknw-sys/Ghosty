/**
 * Vehicle check: one UK plate → that one vehicle's public record, shown once and never kept.
 *
 * Sources (both free, both official):
 *   - DVSA MOT history API (https://documentation.history.mot.api.gov.uk/): make, model, colour,
 *     fuel, first used, recalls and every MOT test (date, result, mileage, expiry, defects). It
 *     needs a key set from the System tab (`dvsa_mot`): client id, client secret, API key, token
 *     address and scope from DVSA's registration email. Access tokens come from Microsoft Entra
 *     (client credentials, valid 60 minutes) and are kept in this worker's memory only.
 *   - DVLA Vehicle Enquiry Service (`dvla_ves`, for when DVLA reopens registrations): tax status
 *     and due date, MOT status, CO2, engine size, year. The plate goes in the request body, as
 *     DVLA asks (a plate is personal data in the ICO's view).
 * Without a key the owner gets the free GOV.UK checks as links (never scraped).
 *
 * Nothing about a check is stored: no library, memory or notes, and the conversation that is kept
 * between turns has the plate replaced with "[plate]" and the record itself left out (see
 * forgetVehicleChecks / forgetVehicleTurns, used where the brain saves its context and history).
 * The plates looked up are remembered in memory only, for an hour, so those can be found and
 * blanked. Never anything about a keeper: these services do not have it, and no other is asked.
 */
import { formatPlate, normalisePlate, OFFICIAL_CHECKS, PLATE_MARK, plateFormat, redactPlates, type MileageDrop, type MotDefect, type MotTest, type VehicleAnswer, type VehicleReport } from '../../../../packages/shared/src/plates';
import type { ChatTurn } from '../../../../packages/shared/src/protocol';
import type { Msg } from '../llm/router';

export { PLATE_MARK, redactPlates };

export const MOT_API = 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration/';
export const VES_API = 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles';
export const MOT_SCOPE = 'https://tapi.dvsa.gov.uk/.default';
const UA = 'Ghosty/2.0 (personal assistant; single user)';

/** What DVSA's registration email gives (all five are needed for a token and a lookup). */
export interface MotKey {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  tokenUrl: string;
  scope: string;
}

/** A problem the owner can read as it is; `reason` is what the phone shows it as. */
export class VehicleError extends Error {
  constructor(
    message: string,
    readonly reason: 'invalid' | 'no_key' | 'not_found' | 'busy' | 'failed',
  ) {
    super(message);
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// The token address must be Microsoft's sign-in service: the client secret goes nowhere else.
const TOKEN_URL = /^https:\/\/login\.microsoftonline\.com\/[A-Za-z0-9.-]+\/oauth2\/v2\.0\/token$/;

/**
 * The `dvsa_mot` key as the owner pasted it: a small JSON object ({"client_id", "client_secret",
 * "api_key", "token_url", "scope"} — other spellings of the names too), or the five lines from the
 * email, labelled ("Client ID: …") or not. Unlabelled lines are recognised by their shape: the
 * Microsoft address is the token address, the "/.default" address the scope, the GUID the client
 * id; what is left is the client secret, then the API key, in that order. The scope may be left
 * out (it is DVSA's documented one). Throws a plain explanation when something is missing.
 */
export function parseMotKey(value: string): MotKey {
  const raw = String(value ?? '').trim();
  const got: Partial<MotKey> = {};
  const assign = (label: string, v: string) => {
    const k = label.toLowerCase().replace(/[^a-z]/g, '');
    const val = v.trim().replace(/^["']|["',]$/g, '').trim();
    if (!val) return false;
    // "Client ID", "client_id", "Your client secret is", "x-api-key", "Access token URL", "Scope URL"…
    if (k.includes('secret')) got.clientSecret = val;
    else if (k.includes('scope')) got.scope = val;
    else if (k.includes('token') || k === 'url') got.tokenUrl = val;
    else if (k.includes('apikey') || k === 'key') got.apiKey = val;
    else if (k.includes('clientid') || /^(id|appid|applicationid)$/.test(k)) got.clientId = val;
    else return false;
    return true;
  };
  if (raw.startsWith('{')) {
    let o: Record<string, unknown>;
    try {
      o = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error('that looks like JSON but is not complete: check the brackets and quotes, or paste the five lines instead');
    }
    for (const [k, v] of Object.entries(o)) if (typeof v === 'string') assign(k, v);
  } else {
    const loose: string[] = [];
    for (const line of raw.split(/\r?\n|\s{2,}|\t/).map((l) => l.trim()).filter(Boolean)) {
      const m = line.match(/^([A-Za-z][A-Za-z -]{1,30}?)\s*[:=]\s*(\S.*)$/);
      if (m && !/^https?$/i.test(m[1]!) && assign(m[1]!, m[2]!)) continue;
      // one line may hold several values separated by spaces
      loose.push(...line.split(/\s+/));
    }
    for (const v of loose) {
      if (TOKEN_URL.test(v) && !got.tokenUrl) got.tokenUrl = v;
      else if (/^(https:\/\/|api:\/\/)\S+\/\.default$/.test(v) && !got.scope) got.scope = v;
      else if (GUID.test(v) && !got.clientId) got.clientId = v;
      else if (!got.clientSecret) got.clientSecret = v;
      else if (!got.apiKey) got.apiKey = v;
    }
  }
  got.scope ||= MOT_SCOPE;
  const missing = [!got.clientId && 'client ID', !got.clientSecret && 'client secret', !got.apiKey && 'API key', !got.tokenUrl && 'token URL'].filter(Boolean);
  if (missing.length) throw new Error(`missing the ${missing.join(', ')} — paste all five lines from DVSA's email (client ID, client secret, API key, token URL, scope)`);
  if (!TOKEN_URL.test(got.tokenUrl!)) throw new Error('the token URL must be the Microsoft address from the email (https://login.microsoftonline.com/…/oauth2/v2.0/token)');
  return got as MotKey;
}

// ---------- the access token: in memory only ----------

const tokens = new Map<string, { token: string; until: number }>();

/** Forget every token (tests; and after DVSA turns one down). */
export function dropTokens(): void {
  tokens.clear();
}

/** A bearer token for the MOT API: from memory while it has more than a minute left, else a fresh one from Microsoft Entra. */
export async function motToken(key: MotKey): Promise<string> {
  const id = `${key.tokenUrl}|${key.clientId}`;
  const hit = tokens.get(id);
  if (hit && hit.until > Date.now() + 60_000) return hit.token;
  const r = await fetch(key.tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: key.clientId, client_secret: key.clientSecret, scope: key.scope }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await r.json().catch(() => ({}))) as { access_token?: string; expires_in?: number | string; error?: string; error_description?: string };
  if (!r.ok || typeof j.access_token !== 'string') {
    // Microsoft's own words, first sentence only (no trace ids); they never echo the secret.
    const why = String(j.error_description ?? j.error ?? `HTTP ${r.status}`).split(/\r?\n|Trace ID/)[0]!.trim().slice(0, 200);
    throw new VehicleError(`DVSA's sign-in (Microsoft) refused the key: ${why}`, 'no_key');
  }
  const secs = Math.max(60, Math.min(3600, Number(j.expires_in) || 3600));
  tokens.set(id, { token: j.access_token, until: Date.now() + secs * 1000 });
  return j.access_token;
}

// ---------- the plates looked up from the chat: in memory only, for an hour ----------

const LOOKED_MS = 3600_000;
const looked: { plate: string; at: number }[] = [];

/** A plate the chat just looked up: its words are blanked wherever the conversation is saved. */
export function noteLookup(plate: string, at = Date.now()): void {
  const p = normalisePlate(plate);
  if (!p) return;
  looked.push({ plate: p, at });
  while (looked.length > 20) looked.shift();
}

/** The plates looked up in the last hour (tests read it too). */
export function recentLookups(now = Date.now()): { plate: string; at: number }[] {
  while (looked.length && now - looked[0]!.at > LOOKED_MS) looked.shift();
  return looked.slice();
}

/** Forget them all (tests). */
export function clearLookups(): void {
  looked.length = 0;
}

/** What the kept context and history say instead of a vehicle check's record and the reply that gave it. */
export const RECORD_GONE = 'Vehicle record shown to the owner once; it is not kept. Look it up again if the owner asks.';
export const REPLY_GONE = '[A vehicle check was shown here once. Its details are not kept.]';

const isCheck = (name: string) => name === 'vehicle_check';
const plateArg = (raw: string): string => {
  try {
    const a = JSON.parse(raw) as { plate?: unknown };
    return typeof a.plate === 'string' ? normalisePlate(a.plate) : '';
  } catch {
    return '';
  }
};

/**
 * The conversation as it is saved between turns: each vehicle check's arguments and record are
 * replaced, what the model wrote after a check in that exchange (which repeats the record) is
 * replaced, and every plate checked is "[plate]" wherever it appears. The model still had the
 * record for the turn itself; nothing is lost but what was meant to go.
 */
export function forgetVehicleChecks(msgs: Msg[], now = Date.now()): Msg[] {
  const plates = new Set(recentLookups(now).map((l) => l.plate));
  const ids = new Set<string>();
  for (const m of msgs) {
    for (const c of m.tool_calls ?? []) {
      if (!isCheck(c.function.name)) continue;
      ids.add(c.id);
      const p = plateArg(c.function.arguments);
      if (p) plates.add(p);
    }
  }
  if (!ids.size && !plates.size) return msgs;
  const red = (c: Msg['content']): Msg['content'] => (typeof c === 'string' ? redactPlates(c, plates) : c);
  let after = false;
  return msgs.map((m): Msg => {
    if (m.role === 'user') {
      after = false;
      return { ...m, content: red(m.content) };
    }
    if (m.role === 'tool') return { ...m, content: m.tool_call_id && ids.has(m.tool_call_id) ? RECORD_GONE : red(m.content) };
    if (m.role !== 'assistant') return m;
    const content = after && typeof m.content === 'string' && m.content.trim() ? REPLY_GONE : red(m.content);
    const tool_calls = m.tool_calls?.map((c) => ({ ...c, function: { ...c.function, arguments: isCheck(c.function.name) ? JSON.stringify({ plate: PLATE_MARK }) : redactPlates(c.function.arguments, plates) } }));
    if (m.tool_calls?.some((c) => isCheck(c.function.name))) after = true;
    return { ...m, content, ...(tool_calls ? { tool_calls } : {}) };
  });
}

/**
 * The chat history as it is saved: the plates looked up in the last hour are "[plate]" in every
 * turn, and the first reply after each lookup (which gave the record) is replaced.
 */
export function forgetVehicleTurns(turns: ChatTurn[], now = Date.now()): ChatTurn[] {
  const recent = recentLookups(now);
  if (!recent.length) return turns;
  const plates = recent.map((l) => l.plate);
  const blank = new Set<number>();
  for (const l of recent) {
    // the reply that answered it comes within the turn: ten minutes is ample
    const i = turns.findIndex((t) => t.role === 'assistant' && t.at >= l.at && t.at - l.at < 10 * 60_000);
    if (i >= 0) blank.add(i);
  }
  return turns.map((t, i) => (blank.has(i) ? { ...t, text: REPLY_GONE } : { ...t, text: redactPlates(t.text, plates) }));
}

// ---------- the lookups ----------

const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const day = (v: unknown): string => (typeof v === 'string' ? (v.match(/^(\d{4})[-.](\d{2})[-.](\d{2})/)?.slice(1).join('-') ?? '') : '');

interface RawTest {
  completedDate?: string;
  testResult?: string;
  expiryDate?: string | null;
  odometerValue?: string | number | null;
  odometerUnit?: string | null;
  odometerResultType?: string;
  defects?: { text?: string | null; type?: string | null; dangerous?: boolean | null }[] | null;
}
export interface RawMot {
  registration?: string | null;
  make?: string | null;
  model?: string | null;
  firstUsedDate?: string | null;
  registrationDate?: string | null;
  manufactureDate?: string | null;
  manufactureYear?: string | null;
  fuelType?: string | null;
  primaryColour?: string | null;
  engineSize?: string | null;
  hasOutstandingRecall?: string | null;
  motTestDueDate?: string | null;
  motTests?: RawTest[] | null;
}
export interface RawVes {
  registrationNumber?: string;
  taxStatus?: string;
  taxDueDate?: string;
  motStatus?: string;
  co2Emissions?: number;
  engineCapacity?: number;
  yearOfManufacture?: number;
  colour?: string;
  make?: string;
  fuelType?: string;
  monthOfFirstRegistration?: string;
}

/** The MOT API's tests, tidied: newest first, mileage as a number with its unit (none when the odometer was not read). */
export function motTests(raw: RawTest[] | null | undefined): MotTest[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((t) => t && (t.testResult === 'PASSED' || t.testResult === 'FAILED') && day(t.completedDate))
    .map((t): MotTest => {
      const read = t.odometerResultType === undefined || t.odometerResultType === 'READ';
      const odo = read ? num(t.odometerValue) : null;
      const unit = odo == null ? null : String(t.odometerUnit ?? '').toUpperCase() === 'KM' ? 'km' : 'mi';
      const defects = (Array.isArray(t.defects) ? t.defects : []).filter((d) => d && str(d.text)).map((d): MotDefect => ({ type: str(d.type, 30).toUpperCase() || 'NOTE', text: str(d.text, 300), dangerous: d.dangerous === true }));
      return { date: day(t.completedDate), result: t.testResult as 'PASSED' | 'FAILED', expiry: day(t.expiryDate) || null, odometer: odo, unit, defects };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const KM_PER_MILE = 1.609344;

/** Mileage over the tests, oldest first in miles, and every time the reading went down from the one before. */
export function mileageOf(tests: MotTest[]): VehicleReport['mileage'] {
  const read = tests.filter((t) => t.odometer != null).slice().reverse();
  const points = read.map((t) => ({ date: t.date, miles: Math.round(t.unit === 'km' ? t.odometer! / KM_PER_MILE : t.odometer!) }));
  const drops: MileageDrop[] = [];
  let top = -1;
  for (const p of points) {
    // A fall of more than a mile from the highest reading so far: an odometer does not run backwards.
    if (top >= 0 && p.miles < top - 1) drops.push({ date: p.date, from: top, to: p.miles });
    top = Math.max(top, p.miles);
  }
  const last = read.at(-1);
  return { last: last?.odometer ?? null, unit: last?.unit ?? null, at: last?.date ?? null, points, drops };
}

const nice = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : '');
/** "2027-03-14" → "14 Mar 2027" (dates on the records are UK calendar dates). */
export function ukDate(iso: string | null | undefined): string {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${Number(m[3])} ${months[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** The record from the MOT API (and DVLA, when there is one) as the report the phone and the model read. `today`: YYYY-MM-DD. */
export function buildReport(plate: string, mot: RawMot | null, ves: RawVes | null, today: string): VehicleReport {
  const tests = motTests(mot?.motTests);
  const mileage = mileageOf(tests);
  const latest = tests[0];
  const lastPass = tests.find((t) => t.result === 'PASSED' && t.expiry);
  let state: VehicleReport['mot']['state'];
  let date: string | null = null;
  if (lastPass?.expiry && lastPass.expiry >= today) {
    state = 'valid';
    date = lastPass.expiry;
  } else if (!tests.length && mot?.motTestDueDate) {
    state = day(mot.motTestDueDate) >= today ? 'first_due' : 'expired';
    date = day(mot.motTestDueDate);
  } else if (latest?.result === 'FAILED' && (!lastPass || latest.date >= lastPass.date)) {
    state = 'failed';
    date = latest.date;
  } else if (lastPass) {
    state = 'expired';
    date = lastPass.expiry;
  } else state = 'none';
  const text =
    state === 'valid' ? `MOT valid until ${ukDate(date)}` :
    state === 'first_due' ? `New vehicle: first MOT due ${ukDate(date)}` :
    state === 'failed' ? `MOT failed on ${ukDate(date)}${lastPass?.expiry && lastPass.expiry >= today ? '' : ' — no current MOT'}` :
    state === 'expired' ? `MOT expired on ${ukDate(date)}` :
    mot ? 'No MOT test on record' : 'MOT history not checked';
  const advisories = latest ? latest.defects.filter((d) => d.type === 'ADVISORY').length : 0;
  const dvla = ves
    ? { taxStatus: str(ves.taxStatus, 40), taxDue: day(ves.taxDueDate), motStatus: str(ves.motStatus, 60), co2: num(ves.co2Emissions), engineCc: num(ves.engineCapacity), year: num(ves.yearOfManufacture), colour: nice(str(ves.colour, 30)) }
    : undefined;
  const miles = mileage.last != null ? `last recorded mileage ${mileage.last.toLocaleString('en-GB')} ${mileage.unit === 'km' ? 'km' : 'miles'} (${ukDate(mileage.at)})` : '';
  const verdict = [
    text,
    miles,
    latest ? `${advisories} advisor${advisories === 1 ? 'y' : 'ies'} at the last test` : '',
    mileage.drops.length ? `WARNING: the recorded mileage went down ${mileage.drops.length === 1 ? 'once' : `${mileage.drops.length} times`} (${mileage.drops.map((d) => `${d.from.toLocaleString('en-GB')} → ${d.to.toLocaleString('en-GB')} on ${ukDate(d.date)}`).join('; ')}) — ask why before buying` : '',
    dvla?.taxStatus ? `tax: ${dvla.taxStatus}${dvla.taxDue ? ` (due ${ukDate(dvla.taxDue)})` : ''}` : '',
    /^yes$/i.test(str(mot?.hasOutstandingRecall)) ? 'a safety recall is outstanding' : '',
  ].filter(Boolean).join(' · ');
  return {
    plate: formatPlate(plate),
    make: str(mot?.make) || nice(str(ves?.make)),
    model: str(mot?.model),
    colour: str(mot?.primaryColour) || dvla?.colour || '',
    fuel: str(mot?.fuelType) || nice(str(ves?.fuelType)),
    firstUsed: day(mot?.firstUsedDate) || day(mot?.registrationDate) || '',
    engineCc: num(mot?.engineSize) ?? dvla?.engineCc ?? null,
    recall: str(mot?.hasOutstandingRecall, 20),
    mot: { state, date, text },
    tests,
    mileage,
    advisories,
    ...(dvla ? { dvla } : {}),
    verdict,
    sources: [mot ? 'DVSA MOT history' : '', ves ? 'DVLA Vehicle Enquiry Service' : ''].filter(Boolean),
  };
}

/** The report in plain words for the model (and Telegram): the verdict first, then the facts and the last few tests. */
export function renderReport(r: VehicleReport): string {
  const lines = [
    `Vehicle ${r.plate}: ${[r.colour, r.make, r.model].filter(Boolean).join(' ') || 'make and model not on record'}`,
    `Verdict: ${r.verdict}`,
    [r.fuel && `Fuel: ${r.fuel}`, r.firstUsed && `first used ${ukDate(r.firstUsed)}`, r.engineCc && `${r.engineCc} cc`, r.recall && `outstanding recall: ${r.recall}`].filter(Boolean).join(' · '),
  ];
  if (r.dvla) lines.push(`DVLA: tax ${r.dvla.taxStatus || '?'}${r.dvla.taxDue ? ` (due ${ukDate(r.dvla.taxDue)})` : ''} · MOT ${r.dvla.motStatus || '?'}${r.dvla.co2 != null ? ` · CO2 ${r.dvla.co2} g/km` : ''}${r.dvla.year ? ` · made ${r.dvla.year}` : ''}`);
  for (const t of r.tests.slice(0, 6)) {
    const d = t.defects.length ? ` — ${t.defects.slice(0, 6).map((x) => `${x.type.toLowerCase()}: ${x.text}`).join('; ')}${t.defects.length > 6 ? `; +${t.defects.length - 6} more` : ''}` : '';
    lines.push(`${ukDate(t.date)} ${t.result === 'PASSED' ? 'PASS' : 'FAIL'}${t.odometer != null ? ` at ${t.odometer.toLocaleString('en-GB')} ${t.unit === 'km' ? 'km' : 'mi'}` : ''}${d}`);
  }
  if (r.tests.length > 6) lines.push(`…and ${r.tests.length - 6} older tests.`);
  lines.push(`Source: ${r.sources.join(' and ') || 'none'}.`);
  return lines.filter(Boolean).join('\n');
}

/** The MOT record for one plate (null when DVSA has none). One retry with a fresh token if DVSA turns the token down. */
export async function fetchMot(plate: string, key: MotKey): Promise<RawMot | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await motToken(key);
    const r = await fetch(MOT_API + encodeURIComponent(plate), {
      headers: { Authorization: `Bearer ${token}`, 'X-API-Key': key.apiKey, Accept: 'application/json', 'User-Agent': UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (r.ok) return (await r.json()) as RawMot;
    const j = (await r.json().catch(() => ({}))) as { errorCode?: string; errorMessage?: string };
    if (r.status === 404 || j.errorCode === 'MOTH-NF-01') return null;
    if ((r.status === 401 || r.status === 403) && attempt === 0 && j.errorCode !== 'MOTH-FB-03') {
      // An expired or refused token: forget it and ask Microsoft for another, once.
      dropTokens();
      continue;
    }
    if (r.status === 429) throw new VehicleError(`DVSA is busy (${j.errorCode === 'MOTH-RL-01' ? "the key's daily allowance is used up" : 'too many checks in a short time'}): try again in a few minutes`, 'busy');
    if (r.status === 400) throw new VehicleError(`DVSA did not accept that plate (${j.errorMessage ?? j.errorCode ?? 'bad request'})`, 'invalid');
    if (r.status === 401 || r.status === 403) throw new VehicleError(`DVSA refused the key (${j.errorCode === 'MOTH-FB-03' ? 'the API key is not recognised — keys unused for 90 days are revoked' : (j.errorMessage ?? `HTTP ${r.status}`)}): check it in System → Keys`, 'no_key');
    throw new VehicleError(`DVSA's MOT service answered ${r.status}; try again in a minute`, 'failed');
  }
  throw new VehicleError("DVSA's MOT service refused the token twice: check the key in System → Keys", 'no_key');
}

/** DVLA's record for one plate (null when DVLA has none). */
export async function fetchVes(plate: string, apiKey: string): Promise<RawVes | null> {
  const r = await fetch(VES_API, {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'content-type': 'application/json', Accept: 'application/json', 'User-Agent': UA },
    body: JSON.stringify({ registrationNumber: plate }),
    signal: AbortSignal.timeout(10_000),
  });
  if (r.ok) return (await r.json()) as RawVes;
  // Not awaited: the body is not needed, and letting it go must never hold up the answer.
  void r.body?.cancel().catch(() => undefined);
  if (r.status === 404) return null;
  if (r.status === 429) throw new VehicleError('DVLA is busy: try again in a few minutes', 'busy');
  if (r.status === 401 || r.status === 403) throw new VehicleError('DVLA refused the key: check it in System → Keys', 'no_key');
  throw new VehicleError(`DVLA answered ${r.status}`, 'failed');
}

export interface VehicleKeys {
  /** The `dvsa_mot` value, as pasted. */
  mot: string | null;
  /** The `dvla_ves` value. */
  ves: string | null;
}

const NO_KEY = 'Vehicle checks need the free DVSA MOT history key: System → Keys → DVSA MOT history (DVSA takes up to 5 working days to send it). Meanwhile the free GOV.UK checks below work in any browser.';

/**
 * Check one plate: the MOT record and DVLA's (whichever keys there are) side by side, two to three
 * outbound requests in all. `today` (YYYY-MM-DD) decides whether the MOT is current.
 */
export async function checkVehicle(plateIn: string, keys: VehicleKeys, today = new Date().toISOString().slice(0, 10)): Promise<VehicleAnswer> {
  const links = OFFICIAL_CHECKS.map((l) => ({ ...l }));
  const plate = normalisePlate(plateIn);
  if (!plateFormat(plate)) return { ok: false, reason: 'invalid', message: `"${String(plateIn ?? '').slice(0, 12)}" is not a UK number plate (like AB12 CDE, A123 BCD, ABC 123D or ABZ 1234).`, links };
  let motKey: MotKey | null = null;
  if (keys.mot) {
    try {
      motKey = parseMotKey(keys.mot);
    } catch (e) {
      return { ok: false, reason: 'no_key', message: `The DVSA MOT history key is not complete: ${(e as Error).message}. Fix it in System → Keys.`, links };
    }
  }
  if (!motKey && !keys.ves) return { ok: false, reason: 'no_key', message: NO_KEY, links };
  try {
    const [mot, ves] = await Promise.all([
      motKey ? fetchMot(plate, motKey) : Promise.resolve(null),
      // DVLA is a bonus: its failure never hides the MOT record.
      keys.ves ? fetchVes(plate, keys.ves.trim()).catch((e) => (motKey ? null : Promise.reject(e))) : Promise.resolve(null),
    ]);
    if (!mot && !ves) return { ok: false, reason: 'not_found', message: `No vehicle with the plate ${formatPlate(plate)} is on record. Check the plate (0 and O, 1 and I look alike).`, links };
    const report = buildReport(plate, mot, ves, today);
    return { ok: true, report, text: renderReport(report), links };
  } catch (e) {
    if (e instanceof VehicleError) return { ok: false, reason: e.reason, message: e.message, links };
    const why = (e as Error)?.name === 'TimeoutError' ? 'it did not answer in time' : String((e as Error)?.message ?? e).slice(0, 160);
    return { ok: false, reason: 'failed', message: `The vehicle check failed: ${why}. Try again in a minute.`, links };
  }
}

/** The owner's keys for a check; a vault that cannot be read (database paused, no copy) counts as no key. */
export async function vehicleKeys(vault: { get(name: string): Promise<string | null> }): Promise<VehicleKeys> {
  const [mot, ves] = await Promise.all([vault.get('dvsa_mot').catch(() => null), vault.get('dvla_ves').catch(() => null)]);
  return { mot, ves };
}

/**
 * POST /api/vehicle {plate}: the phone's VEHICLE CHECK panel and the Lens's chip. The answer is
 * for that screen only: `no-store` so no cache keeps it, and nothing about it is saved here.
 */
export async function vehicleRoute(req: Request, vault: { get(name: string): Promise<string | null> }): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { plate?: unknown };
  const answer = await checkVehicle(typeof body.plate === 'string' ? body.plate : '', await vehicleKeys(vault));
  const status = answer.ok ? 200 : answer.reason === 'invalid' ? 400 : answer.reason === 'not_found' ? 404 : answer.reason === 'busy' ? 429 : answer.reason === 'no_key' ? 412 : 502;
  return new Response(JSON.stringify(answer), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
}
