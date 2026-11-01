// Vehicle check: UK plate formats (current, prefix, suffix, Northern Ireland, dateless) and plates
// found in text read off a picture; the DVSA key as the owner pastes it; the Microsoft Entra token
// (asked for once, kept in memory, refreshed when DVSA turns it down) and the MOT request's headers;
// the report (MOT valid until, last mileage, advisories, the mileage-went-down warning, a new car's
// first MOT); DVLA's record with the plate in the body; no key → the free GOV.UK links; and the
// no-store rule: after a check from the chat and from POST /api/vehicle, nothing in the brain's
// database or KV holds the plate or the record. Responses are shaped like DVSA's published API
// (test/vehicle.fixture.json); the network is faked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';

const B = './.build';
const P = await import(`${B}/vehicle/plates.mjs`);
const V = await import(`${B}/integrations/vehicle.mjs`);
const T = await import(`${B}/tools/index.mjs`);
const C = await import(`${B}/context.mjs`);
const mod = await import(`${B}/brain.mjs`);
const worker = mod.default;
const { GhostyAgent } = mod;
const FX = JSON.parse(readFileSync(new URL('./vehicle.fixture.json', import.meta.url), 'utf8'));

const TOKEN_URL = 'https://login.microsoftonline.com/6f504113-6b64-43f2-ade9-242e05780007/oauth2/v2.0/token';
const KEY_LINES = ['Client ID: 3fa85f64-5717-4562-b3fc-2c963f66afa6', 'Client secret: s3cr3t~Value.With-Bits_9', 'API key: AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd', `Token URL: ${TOKEN_URL}`, 'Scope URL: https://tapi.dvsa.gov.uk/.default'].join('\n');
const TODAY = '2026-10-17';

const jsonRes = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** DVSA, Microsoft and DVLA as documented; every call is logged with its method, headers and body. */
function network(over = {}) {
  const calls = [];
  let tokenNo = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    const headers = Object.fromEntries(new Headers(init.headers ?? {}).entries());
    const body = typeof init.body === 'string' ? init.body : '';
    calls.push({ url, method: init.method ?? 'GET', headers, body });
    assert.ok(init.signal, `no timeout on ${url}`);
    for (const [k, v] of Object.entries(over)) if (url.includes(k)) return typeof v === 'function' ? v(url, init, calls) : v.clone();
    if (url === TOKEN_URL) return jsonRes({ ...FX.token, access_token: `issued-access-token-${++tokenNo}` });
    if (url === `${V.MOT_API}AB12CDE`) return jsonRes(FX.withMot);
    if (url === `${V.MOT_API}XY25ABC`) return jsonRes(FX.newReg);
    if (url.startsWith(V.MOT_API)) return jsonRes(FX.notFound, 404);
    if (url === V.VES_API) return jsonRes(FX.ves);
    throw new TypeError(`fetch failed: no fake for ${url}`);
  };
  return calls;
}

test('UK plate formats: current, prefix, suffix, Northern Ireland and dateless; written as on the car', () => {
  const cases = [
    ['AB12 CDE', 'current', 'AB12 CDE'],
    ['ab12cde', 'current', 'AB12 CDE'],
    ['BD51 SMR', 'current', 'BD51 SMR'],
    ['LV75 XYZ', 'current', 'LV75 XYZ'],
    ['A123 BCD', 'prefix', 'A123 BCD'],
    ['P7 ABC', 'prefix', 'P7 ABC'],
    ['ABC 123D', 'suffix', 'ABC 123D'],
    ['XYZ 9K', 'suffix', 'XYZ 9K'],
    ['ABZ 1234', 'ni', 'ABZ 1234'],
    ['OIL 5000', 'ni', 'OIL 5000'],
    ['IA 123', 'ni', 'IA 123'],
    ['A 1', 'dateless', 'A 1'],
    ['1234 AB', 'dateless', '1234 AB'],
    ['ABC 1234', 'dateless', 'ABC 1234'],
  ];
  for (const [raw, format, shown] of cases) {
    assert.equal(P.plateFormat(raw), format, raw);
    assert.equal(P.formatPlate(raw), shown, raw);
    assert.ok(P.isPlate(raw));
  }
  for (const bad of ['', 'HELLO', 'AB12CDEF', 'QB12 CDE', 'AB00 CDE', 'AB12 CQE', '12345', 'ABCD', 'I123 ABC', 'AB1 2CD 3']) assert.equal(P.plateFormat(bad), null, bad);
  assert.equal(P.normalisePlate(' ab-12 cde '), 'AB12CDE');
});

test('plates found in text read off a picture: one or two words, a misread letter mended, nothing from ordinary words', () => {
  assert.deepEqual(P.findPlates('FORD\nAB12 CDE\nwww.dealer.co.uk'), ['AB12CDE']);
  assert.deepEqual(P.findPlates('reg AB12CDE seen'), ['AB12CDE']);
  // a 0 read where a letter must be, and an O where a digit must be
  assert.deepEqual(P.findPlates('AB12 C0E'), ['AB12COE']);
  assert.deepEqual(P.findPlates('AB1O CDE'), ['AB10CDE']);
  assert.deepEqual(P.findPlates('A123 BCD and ABC 123D'), ['A123BCD', 'ABC123D']);
  assert.deepEqual(P.findPlates('ABZ 1234'), ['ABZ1234']);
  assert.deepEqual(P.findPlates('Turn left at the M6 junction 7, then A38 for 2 miles'), []);
  assert.deepEqual(P.findPlates('The quick brown fox jumps over 13 lazy dogs'), []);
  assert.deepEqual(P.findPlates('ab12 cde in lower case is not a plate on a picture'), []);
  assert.ok(P.mentionsPlate("what's the mot on ab12 cde?"));
  assert.ok(!P.mentionsPlate('what is the capital of france?'));
  assert.equal(P.OFFICIAL_CHECKS[0].url, 'https://www.gov.uk/check-mot-history');
});

test("the DVSA key as pasted: labelled lines, bare lines in any order, JSON; what is missing is named; the secret only goes to Microsoft", () => {
  const want = { clientId: '3fa85f64-5717-4562-b3fc-2c963f66afa6', clientSecret: 's3cr3t~Value.With-Bits_9', apiKey: 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd', tokenUrl: TOKEN_URL, scope: 'https://tapi.dvsa.gov.uk/.default' };
  assert.deepEqual(V.parseMotKey(KEY_LINES), want);
  // bare values, shuffled: recognised by shape; secret then API key in the order given
  assert.deepEqual(V.parseMotKey([TOKEN_URL, want.clientSecret, want.clientId, want.apiKey].join('\n')), want);
  assert.deepEqual(V.parseMotKey(JSON.stringify({ client_id: want.clientId, client_secret: want.clientSecret, api_key: want.apiKey, token_url: TOKEN_URL, scope: want.scope })), want);
  assert.deepEqual(V.parseMotKey(`Your client ID is: ${want.clientId}\nYour client secret is: ${want.clientSecret}\nX-API-Key = ${want.apiKey}\nAccess token URL: ${TOKEN_URL}`), want);
  assert.throws(() => V.parseMotKey(`Client ID: ${want.clientId}\nToken URL: ${TOKEN_URL}`), /missing the client secret, API key/);
  assert.throws(() => V.parseMotKey(KEY_LINES.replace(TOKEN_URL, 'https://evil.example/oauth2/v2.0/token')), /must be the Microsoft address/);
  assert.throws(() => V.parseMotKey('{"client_id": '), /JSON/);
});

test('the token: one request to Microsoft with the client credentials, kept in memory, then the MOT request with Bearer and X-API-Key', async () => {
  V.dropTokens();
  const calls = network();
  const a = await V.checkVehicle('ab12 cde', { mot: KEY_LINES, ves: null }, TODAY);
  assert.equal(a.ok, true, a.message);
  assert.equal(calls.length, 2);
  const [tok, mot] = calls;
  assert.equal(tok.method, 'POST');
  assert.equal(tok.headers['content-type'], 'application/x-www-form-urlencoded');
  const form = new URLSearchParams(tok.body);
  assert.equal(form.get('grant_type'), 'client_credentials');
  assert.equal(form.get('client_id'), '3fa85f64-5717-4562-b3fc-2c963f66afa6');
  assert.equal(form.get('client_secret'), 's3cr3t~Value.With-Bits_9');
  assert.equal(form.get('scope'), 'https://tapi.dvsa.gov.uk/.default');
  assert.equal(mot.url, 'https://history.mot.api.gov.uk/v1/trade/vehicles/registration/AB12CDE');
  assert.equal(mot.headers.authorization, 'Bearer issued-access-token-1');
  assert.equal(mot.headers['x-api-key'], 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd');
  // a second check reuses the token
  await V.checkVehicle('XY25 ABC', { mot: KEY_LINES, ves: null }, TODAY);
  assert.equal(calls.filter((c) => c.url === TOKEN_URL).length, 1);
  assert.equal(calls.at(-1).headers.authorization, 'Bearer issued-access-token-1');
});

test('a token DVSA turns down is replaced once; a refused API key, a busy service and a refused sign-in are said plainly', async () => {
  V.dropTokens();
  let n = 0;
  const calls = network({ [`${V.MOT_API}AB12CDE`]: () => (++n === 1 ? jsonRes({ errorCode: 'MOTH-FB-02', errorMessage: 'The access token sent with the request has expired' }, 403) : jsonRes(FX.withMot)) });
  const a = await V.checkVehicle('AB12CDE', { mot: KEY_LINES, ves: null }, TODAY);
  assert.equal(a.ok, true);
  assert.equal(calls.filter((c) => c.url === TOKEN_URL).length, 2);
  assert.equal(calls.at(-1).headers.authorization, 'Bearer issued-access-token-2');

  V.dropTokens();
  network({ [`${V.MOT_API}AB12CDE`]: jsonRes(FX.badKey, 403) });
  const k = await V.checkVehicle('AB12CDE', { mot: KEY_LINES, ves: null }, TODAY);
  assert.equal(k.ok, false);
  assert.equal(k.reason, 'no_key');
  assert.match(k.message, /API key is not recognised.*90 days/);

  network({ [`${V.MOT_API}AB12CDE`]: jsonRes({ errorCode: 'MOTH-RL-02', errorMessage: 'Too many requests' }, 429) });
  const b = await V.checkVehicle('AB12CDE', { mot: KEY_LINES, ves: null }, TODAY);
  assert.equal(b.reason, 'busy');

  V.dropTokens();
  network({ [TOKEN_URL]: jsonRes({ error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided.\r\nTrace ID: abc' }, 401) });
  const s = await V.checkVehicle('AB12CDE', { mot: KEY_LINES, ves: null }, TODAY);
  assert.equal(s.reason, 'no_key');
  assert.match(s.message, /AADSTS7000215: Invalid client secret provided\.$/);
  assert.doesNotMatch(s.message, /s3cr3t|Trace/);
});

test('the report: MOT valid until, last mileage, advisories at the last test, and the warning when the mileage went down', async () => {
  V.dropTokens();
  network();
  const a = await V.checkVehicle('AB12CDE', { mot: KEY_LINES, ves: null }, TODAY);
  const r = a.report;
  assert.equal(r.plate, 'AB12 CDE');
  assert.equal(r.make, 'FORD');
  assert.equal(r.model, 'FOCUS');
  assert.equal(r.colour, 'Silver');
  assert.equal(r.fuel, 'Petrol');
  assert.equal(r.firstUsed, '2012-03-28');
  assert.equal(r.engineCc, 1596);
  assert.equal(r.recall, 'No');
  assert.deepEqual(r.mot, { state: 'valid', date: '2027-03-19', text: 'MOT valid until 19 Mar 2027' });
  assert.equal(r.tests.length, 6);
  assert.equal(r.tests[0].date, '2026-03-20');
  assert.equal(r.tests[1].result, 'FAILED');
  assert.equal(r.tests[4].odometer, null, 'an unreadable odometer is no reading');
  assert.equal(r.advisories, 2);
  assert.equal(r.mileage.last, 71234);
  assert.equal(r.mileage.unit, 'mi');
  assert.deepEqual(r.mileage.points.map((p) => p.miles), [52010, 64500, 58100, 71230, 71234]);
  assert.deepEqual(r.mileage.drops, [{ date: '2025-03-14', from: 64500, to: 58100 }]);
  assert.match(r.verdict, /^MOT valid until 19 Mar 2027 · last recorded mileage 71,234 miles \(20 Mar 2026\) · 2 advisories at the last test · WARNING: the recorded mileage went down once \(64,500 → 58,100 on 14 Mar 2025\)/);
  assert.match(a.text, /^Vehicle AB12 CDE: Silver FORD FOCUS\nVerdict: MOT valid until/);
  assert.match(a.text, /18 Mar 2026 FAIL at 71,230 mi — major: Nearside Headlamp aim too high.*dangerous: Offside Front Brake pipe/);
  assert.match(a.text, /Source: DVSA MOT history\.$/);
  assert.deepEqual(a.links.map((l) => l.url), ['https://www.gov.uk/check-mot-history', 'https://vehicleenquiry.service.gov.uk/']);
  // kilometres are turned into miles for the line, and a small wobble is no warning
  const km = V.mileageOf([{ date: '2024-01-01', result: 'PASSED', odometer: 16093, unit: 'km', defects: [], expiry: null }, { date: '2023-01-01', result: 'PASSED', odometer: 10000, unit: 'mi', defects: [], expiry: null }]);
  assert.deepEqual(km.points.map((p) => p.miles), [10000, 10000]);
  assert.deepEqual(km.drops, []);
  // run out, and failed with no pass since
  assert.equal(V.buildReport('AB12CDE', FX.withMot, null, '2027-04-01').mot.state, 'expired');
  const failed = { ...FX.withMot, motTests: FX.withMot.motTests.slice(1) };
  assert.match(V.buildReport('AB12CDE', failed, null, TODAY).mot.text, /^MOT failed on 18 Mar 2026 — no current MOT$/);
});

test("a new car's first MOT, a plate DVSA does not know, a plate that is no plate, and no key at all", async () => {
  V.dropTokens();
  network();
  const n = await V.checkVehicle('XY25ABC', { mot: KEY_LINES, ves: null }, TODAY);
  assert.equal(n.ok, true);
  assert.deepEqual(n.report.mot, { state: 'first_due', date: '2028-05-01', text: 'New vehicle: first MOT due 1 May 2028' });
  assert.equal(n.report.tests.length, 0);
  assert.match(n.report.verdict, /^New vehicle: first MOT due 1 May 2028$/);

  const nf = await V.checkVehicle('LM68 XYZ', { mot: KEY_LINES, ves: null }, TODAY);
  assert.equal(nf.ok, false);
  assert.equal(nf.reason, 'not_found');
  assert.match(nf.message, /No vehicle with the plate LM68 XYZ/);

  const calls = network();
  const bad = await V.checkVehicle('HELLO', { mot: KEY_LINES, ves: null }, TODAY);
  assert.equal(bad.reason, 'invalid');
  const none = await V.checkVehicle('AB12CDE', { mot: null, ves: null }, TODAY);
  assert.equal(none.reason, 'no_key');
  assert.match(none.message, /System → Keys → DVSA MOT history/);
  assert.equal(none.links.length, 2);
  assert.equal(calls.length, 0, 'nothing leaves without a key or a plate');
  const half = await V.checkVehicle('AB12CDE', { mot: 'Client ID: 3fa85f64-5717-4562-b3fc-2c963f66afa6', ves: null }, TODAY);
  assert.equal(half.reason, 'no_key');
  assert.match(half.message, /not complete: missing the client secret/);
});

test("DVLA's record (when its key is set): the plate goes in the body, tax status joins the verdict; alone it still answers", async () => {
  V.dropTokens();
  const calls = network();
  const a = await V.checkVehicle('AB12CDE', { mot: KEY_LINES, ves: 'ves-key-123' }, TODAY);
  const ves = calls.find((c) => c.url === V.VES_API);
  assert.equal(ves.method, 'POST');
  assert.equal(ves.headers['x-api-key'], 'ves-key-123');
  assert.deepEqual(JSON.parse(ves.body), { registrationNumber: 'AB12CDE' });
  assert.deepEqual(a.report.dvla, { taxStatus: 'Taxed', taxDue: '2027-04-01', motStatus: 'Valid', co2: 135, engineCc: 1596, year: 2012, colour: 'Silver' });
  assert.match(a.report.verdict, /tax: Taxed \(due 1 Apr 2027\)/);
  assert.deepEqual(a.report.sources, ['DVSA MOT history', 'DVLA Vehicle Enquiry Service']);
  // DVLA failing never hides the MOT record
  network({ [V.VES_API]: jsonRes({ message: 'Forbidden' }, 403) });
  const b = await V.checkVehicle('AB12CDE', { mot: KEY_LINES, ves: 'wrong' }, TODAY);
  assert.equal(b.ok, true);
  assert.equal(b.report.dvla, undefined);
  // DVLA alone
  network();
  const c = await V.checkVehicle('AB12CDE', { mot: null, ves: 'ves-key-123' }, TODAY);
  assert.equal(c.ok, true);
  assert.equal(c.report.make, 'Ford');
  assert.equal(c.report.mot.text, 'MOT history not checked');
});

test('the saved conversation: the check, its record and the reply that gave it are left out, and the plate is [plate] everywhere', () => {
  const ctx = [
    { role: 'user', content: 'what is the weather' },
    { role: 'assistant', content: 'Sunny.' },
    { role: 'user', content: 'check ab12 cde for me' },
    { role: 'assistant', content: 'Checking AB12 CDE.', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'vehicle_check', arguments: '{"plate":"ab12 cde"}' } }] },
    { role: 'tool', tool_call_id: 'c1', content: 'Vehicle AB12 CDE: Silver FORD FOCUS\nVerdict: MOT valid until 19 Mar 2027' },
    { role: 'assistant', content: 'It is a silver Ford Focus, MOT valid until 19 March 2027.' },
    { role: 'user', content: 'thanks' },
    { role: 'assistant', content: 'You are welcome.' },
  ];
  const kept = C.trimContext(ctx);
  const text = JSON.stringify(kept);
  assert.doesNotMatch(text, /AB12|ab12|FOCUS|Focus|2027/);
  assert.equal(kept[2].content, 'check [plate] for me');
  assert.equal(kept[3].content, 'Checking [plate].');
  assert.equal(kept[3].tool_calls[0].function.arguments, '{"plate":"[plate]"}');
  assert.equal(kept[4].content, V.RECORD_GONE);
  assert.equal(kept[5].content, V.REPLY_GONE);
  assert.equal(kept[7].content, 'You are welcome.', 'the next exchange is kept as it was');
  assert.equal(kept[1].content, 'Sunny.');
  // nothing to forget: the very same array back
  const plain = [{ role: 'user', content: 'hi' }];
  assert.equal(V.forgetVehicleChecks(plain), plain);

  // the chat history: as a check runs, the owner's message gets [plate] and a mark; the reply to it is left out whenever it is saved
  const turns = [
    { role: 'user', text: 'my car is AB12CDE', at: 100 },
    { role: 'assistant', text: 'Noted.', at: 200 },
    { role: 'user', text: 'MOT check AB12-CDE please', at: 900 },
  ];
  const marked = V.forgetPlateInTurns(turns, 'ab12 cde');
  assert.deepEqual(marked.map((x) => x.text), ['my car is [plate]', 'Noted.', 'MOT check [plate] please']);
  assert.equal(marked[2].vehicle, true);
  assert.ok(!marked[0].vehicle);
  const t = V.forgetVehicleTurns([...marked, { role: 'assistant', text: 'Silver Ford Focus…', at: 2000 }, { role: 'user', text: 'and the weather?', at: 3000 }, { role: 'assistant', text: 'Sunny.', at: 4000 }]);
  assert.deepEqual(t.map((x) => x.text), ['my car is [plate]', 'Noted.', 'MOT check [plate] please', V.REPLY_GONE, 'and the weather?', 'Sunny.']);
  // the same from the saved data alone, however often and whenever it runs: no memory involved
  assert.deepEqual(V.forgetVehicleTurns(t), t);
  assert.equal(V.forgetVehicleTurns(turns), turns, 'nothing marked: the very same array back');
});

test('the [plate] marker and ordinary words are never taken for a plate, however often the context is saved', () => {
  assert.equal(P.redactPlates('mot check [plate]; the number plate is on the photo', ['PLATE', '[plate]', 'HELLO', '']), 'mot check [plate]; the number plate is on the photo');
  const ctx = [
    { role: 'user', content: 'mot check AB12 CDE' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'vehicle_check', arguments: '{"plate":"AB12 CDE"}' } }] },
    { role: 'tool', tool_call_id: 'c1', content: 'Vehicle AB12 CDE: Silver FORD FOCUS' },
    { role: 'assistant', content: 'A silver Ford Focus.' },
    { role: 'user', content: 'the number plate is on the photo' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'c2', type: 'function', function: { name: 'web_search', arguments: '{"query":"number plate fonts"}' } }] },
    { role: 'tool', tool_call_id: 'c2', content: 'Plate fonts: Charles Wright.' },
    { role: 'assistant', content: 'Plates use Charles Wright.' },
  ];
  const once = V.forgetVehicleChecks(ctx);
  assert.equal(once[0].content, 'mot check [plate]');
  let again = once;
  for (let i = 0; i < 4; i++) again = V.forgetVehicleChecks(again);
  assert.deepEqual(again, once, 'saving again changes nothing');
  assert.equal(again[4].content, 'the number plate is on the photo');
  assert.equal(again[5].tool_calls[0].function.arguments, '{"query":"number plate fonts"}');
  assert.equal(again[7].content, 'Plates use Charles Wright.');
});

test('a dateless plate (A1) is blanked in the exchange that checked it, and ordinary text elsewhere is left alone', () => {
  assert.equal(P.plateFormat('A1'), 'dateless');
  assert.deepEqual(P.distinctivePlates(['A1', 'K 1', 'AB12CDE', 'PLATE']), ['AB12CDE']);
  const turns = [
    { role: 'user', text: 'a 1 hour wait for the A1 road, said K-1', at: 100 },
    { role: 'assistant', text: 'The A1 is busy; a 1 hour wait.', at: 200 },
    { role: 'user', text: 'mot check a1', at: 300 },
  ];
  const marked = V.forgetPlateInTurns(turns, 'A1');
  assert.deepEqual(marked.map((x) => x.text), ['a 1 hour wait for the A1 road, said K-1', 'The A1 is busy; a 1 hour wait.', 'mot check [plate]']);
  assert.equal(marked[2].vehicle, true);
  const ctx = [
    { role: 'user', content: 'a 1 hour wait on the A1' },
    { role: 'assistant', content: 'The A1 is slow.' },
    { role: 'user', content: 'mot check A 1' },
    { role: 'assistant', content: null, tool_calls: [{ id: 'd1', type: 'function', function: { name: 'vehicle_check', arguments: '{"plate":"A 1"}' } }] },
    { role: 'tool', tool_call_id: 'd1', content: 'Vehicle A 1: Black ROLLS ROYCE' },
    { role: 'assistant', content: 'A black Rolls-Royce.' },
  ];
  const kept = V.forgetVehicleChecks(ctx);
  assert.deepEqual(kept.map((m) => m.content), ['a 1 hour wait on the A1', 'The A1 is slow.', 'mot check [plate]', null, V.RECORD_GONE, V.REPLY_GONE]);
});

test('the vehicle tool group: keyword gated, about line within budget, the tool not run in parallel or remembered', () => {
  const g = T.TOOL_GROUPS.find((x) => x.name === 'vehicle');
  assert.ok(g, 'a vehicle group');
  assert.ok(g.about.length <= 220, `about is ${g.about.length} chars`);
  const on = (s) => T.selectGroups(s, new Set()).on.some((x) => x.name === 'vehicle');
  for (const s of ['what is the MOT on this car', 'check AB12 CDE', 'is it taxed', 'number plate check', 'check this car', 'what does DVLA say']) assert.ok(on(s), s);
  for (const s of ['hello there', 'what is the weather', 'play some music']) assert.ok(!on(s), s);
  const tool = T.toolByName.get('vehicle_check');
  assert.equal(tool.risk, 'auto');
  assert.ok(!tool.pure, 'never several at once');
  assert.match(tool.description, /never remember it/);
});

class MemStorage {
  m = new Map();
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    if (Array.isArray(k)) return k.filter((x) => this.m.delete(x)).length;
    return this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, structuredClone(v)]));
  }
  async deleteAll() {
    this.m.clear();
  }
  async setAlarm() {}
  async getAlarm() {
    return null;
  }
}

/** A KV namespace that keeps everything written to it, to be searched afterwards. */
class MemKv {
  m = new Map();
  async get(k, type) {
    const v = this.m.get(k);
    return v === undefined ? null : type === 'json' ? JSON.parse(v) : v;
  }
  async put(k, v) {
    this.m.set(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
  async delete(k) {
    this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return { keys: [...this.m.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name })), list_complete: true };
  }
}

test('nothing with the plate or the record reaches the database or KV: a check from the chat, then from POST /api/vehicle', async () => {
  V.dropTokens();
  const OWNER_KEY = 'test-owner-key-0123456789abcdef';
  const pending = [];
  const storage = new MemStorage();
  const kv = new MemKv();
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), MOCK_LLM: '1', SITES: kv };
  let agent;
  env.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
  const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };
  const call = (path, init = {}, key = OWNER_KEY) => worker.fetch(new Request(`https://ghosty.test${path}`, { ...init, headers: { 'x-ghosty': '1', 'content-type': 'application/json', ...(key ? { 'x-ghosty-key': key } : {}) } }), env, ctx);
  const calls = network();

  // the key, pasted as five lines: saved with its line breaks, checked with a token only (no vehicle looked up)
  const k = await call('/api/keys', { method: 'POST', body: JSON.stringify({ name: 'dvsa_mot', value: KEY_LINES }) });
  const kj = await k.json();
  assert.equal(kj.works, true, kj.info);
  assert.match(kj.info, /no vehicle was looked up/);
  assert.ok(!calls.some((c) => c.url.startsWith(V.MOT_API)));
  const st = await (await call('/api/status')).json();
  assert.equal(st.keys.find((x) => x.name === 'dvsa_mot').lines, 5);
  assert.equal(st.keys.find((x) => x.name === 'dvsa_mot').set, true);

  // a check from the chat (the scripted model calls vehicle_check, then repeats the record in its reply)
  const r = await call('/api/chat', { method: 'POST', body: JSON.stringify({ message: 'MOT check AB12 CDE' }) });
  const events = (await r.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
  await Promise.allSettled(pending.splice(0));
  const reply = events.find((e) => e.t === 'text')?.text ?? '';
  assert.match(reply, /FORD FOCUS/, 'the owner sees the record once');
  assert.ok(calls.some((c) => c.url === `${V.MOT_API}AB12CDE`));

  // a check from the phone's panel
  const v = await call('/api/vehicle', { method: 'POST', body: JSON.stringify({ plate: 'ab12 cde' }) });
  assert.equal(v.status, 200);
  assert.equal(v.headers.get('cache-control'), 'no-store');
  const vj = await v.json();
  assert.equal(vj.ok, true);
  assert.equal(vj.report.mot.text, 'MOT valid until 19 Mar 2027');
  assert.equal((await call('/api/vehicle', { method: 'POST', body: JSON.stringify({ plate: 'nope' }) })).status, 400);
  assert.equal((await call('/api/vehicle', { method: 'POST', body: JSON.stringify({ plate: 'AB12CDE' }) }, null)).status, 401, 'owner only');
  await Promise.allSettled(pending.splice(0));

  // every value the brain holds, and everything in KV, searched for the plate (any spacing) and the record
  const dump = JSON.stringify([...storage.m.entries()]) + JSON.stringify([...kv.m.entries()]);
  for (const needle of [/AB12\s?CDE/i, /FOCUS/i, /(?<!\d)71,?234(?!\d)/, /Nearside Headlamp/, /19 Mar 2027/]) assert.doesNotMatch(dump, needle, `stored: ${needle}`);
  // what is kept says what happened, without the details
  const h = await (await call('/api/history')).json();
  assert.deepEqual(h.turns.slice(-2).map((t) => t.text), ['MOT check [plate]', V.REPLY_GONE]);
  const kept = await storage.get('ctx');
  assert.ok(kept.some((m) => m.content === V.RECORD_GONE));
  // and the next message still works with the conversation as kept
  const next = await call('/api/chat', { method: 'POST', body: JSON.stringify({ message: 'hello again' }) });
  assert.match(await next.text(), /Mock reply to: hello again/);
  await Promise.allSettled(pending.splice(0));
});

/** A brain on its own storage; `fresh()` drops the instance, as when Cloudflare evicts it, keeping what was saved. */
async function brainOn() {
  const OWNER_KEY = 'test-owner-key-0123456789abcdef';
  const pending = [];
  const storage = new MemStorage();
  const kv = new MemKv();
  const state = { storage, waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), MOCK_LLM: '1', SITES: kv };
  let agent;
  env.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
  const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };
  const call = (path, init = {}) => worker.fetch(new Request(`https://ghosty.test${path}`, { ...init, headers: { 'x-ghosty': '1', 'content-type': 'application/json', 'x-ghosty-key': OWNER_KEY } }), env, ctx);
  const send = async (path, body) => {
    const r = await call(path, { method: 'POST', body: JSON.stringify(body) });
    const events = (await r.text()).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    await Promise.allSettled(pending.splice(0));
    return events;
  };
  const dump = () => JSON.stringify([...storage.m.entries()]) + JSON.stringify([...kv.m.entries()]);
  await send('/api/keys', { name: 'dvsa_mot', value: KEY_LINES });
  return { storage, call, send, dump, fresh: () => (agent = undefined) };
}

test('a check whose next step finds no model: the plate is not kept, and the next, unrelated reply is kept as it was', async () => {
  V.dropTokens();
  network();
  const b = await brainOn();
  const ev = await b.send('/api/chat', { message: 'mot check AB12 CDE then no model' });
  assert.ok(ev.some((e) => e.t === 'tool_result' && e.name === 'vehicle_check' && e.ok), 'the check ran');
  assert.ok(ev.some((e) => e.t === 'error'), 'then no model');
  assert.doesNotMatch(b.dump(), /AB12\s?CDE|FOCUS/i, 'nothing holds the plate after the failed step');
  const turns = await b.storage.get('turns');
  assert.equal(turns.at(-1).text, 'mot check [plate] then no model');
  // the next message (within minutes): its reply has nothing to do with the check and is kept
  await b.send('/api/chat', { message: 'hello again' });
  const h = await (await b.call('/api/history')).json();
  assert.deepEqual(h.turns.slice(-2).map((t) => t.text), ['hello again', 'Mock reply to: hello again']);
});

test('an approval answered hours later on a fresh instance: the plate and the reply are not kept', async () => {
  V.dropTokens();
  network();
  const b = await brainOn();
  const ev = await b.send('/api/chat', { message: 'mot check AB12 CDE then daily hello' });
  const ask = ev.find((e) => e.t === 'approval');
  assert.ok(ask, 'the daily task waits for approval');
  assert.ok(ev.some((e) => e.t === 'tool_result' && e.name === 'vehicle_check' && e.ok), 'the check ran first');
  const realNow = Date.now;
  Date.now = () => realNow() + 3 * 3600_000;
  try {
    b.fresh();
    const done = await b.send('/api/approve', { id: ask.id, allow: true });
    assert.ok(done.some((e) => e.t === 'text'), 'the turn carried on');
  } finally {
    Date.now = realNow;
  }
  assert.doesNotMatch(b.dump(), /AB12\s?CDE|FOCUS/i, 'nothing holds the plate or the record');
  const h = await (await b.call('/api/history')).json();
  assert.deepEqual(h.turns.slice(-2).map((t) => t.text), ['mot check [plate] then daily hello', V.REPLY_GONE]);
});

test('a dateless plate checked from the chat: the earlier, unrelated history keeps its words', async () => {
  V.dropTokens();
  network();
  const b = await brainOn();
  await b.send('/api/chat', { message: 'a 1 hour wait for the A1 road' });
  const ev = await b.send('/api/chat', { message: 'mot check A1' });
  assert.ok(ev.some((e) => e.t === 'tool_result' && e.name === 'vehicle_check'), 'the check ran');
  const h = await (await b.call('/api/history')).json();
  assert.deepEqual(h.turns.map((t) => t.text), ['a 1 hour wait for the A1 road', 'Mock reply to: a 1 hour wait for the a1 road', 'mot check [plate]', V.REPLY_GONE]);
});
