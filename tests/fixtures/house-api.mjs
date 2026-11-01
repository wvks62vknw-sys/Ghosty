// Test only: a stand-in for his own Home Assistant box (BRIEF-REST-D 2), for the preview server (tests/preview-server.mjs)
// and the node test (apps/edge/test/restd.test.mjs). Three rooms — the Hall, the Kitchen, the Living room — with lights, one
// climate (the heating), a temperature sensor, the back door's sensor, a TV, a lock and a garage door (no room of its own),
// and a camera (a domain the bridge never shows or touches). It answers the REST API's own paths — /api/, /api/states,
// /api/template (the rooms, as the bridge's template asks), /api/services/<domain>/<service> — only to the right token,
// changes its states as a real box would, and records every service call it is sent.
export const HOUSE_URL = 'https://house.example.test';
export const HOUSE_TOKEN = 'mock-long-lived-token.0123456789abcdef.ghosty';

const ago = (min) => new Date(Date.now() - min * 60_000).toISOString();
const fresh = () => [
  { entity_id: 'light.hall_light', state: 'on', attributes: { friendly_name: 'Hall light', brightness: 204, supported_color_modes: ['brightness'] }, last_changed: ago(40), area: 'Hall' },
  { entity_id: 'light.kitchen_light', state: 'off', attributes: { friendly_name: 'Kitchen light', supported_color_modes: ['onoff'] }, last_changed: ago(90), area: 'Kitchen' },
  { entity_id: 'light.living_room_lamp', state: 'on', attributes: { friendly_name: 'Living room lamp', brightness: 102, supported_color_modes: ['brightness'] }, last_changed: ago(15), area: 'Living room' },
  { entity_id: 'climate.heating', state: 'heat', attributes: { friendly_name: 'Heating', current_temperature: 19.5, temperature: 20, hvac_modes: ['off', 'heat', 'auto'] }, last_changed: ago(300), area: 'Hall' },
  { entity_id: 'sensor.living_room_temperature', state: '18.5', attributes: { friendly_name: 'Living room temperature', unit_of_measurement: '°C', device_class: 'temperature' }, last_changed: ago(5), area: 'Living room' },
  { entity_id: 'binary_sensor.back_door', state: 'on', attributes: { friendly_name: 'Back door', device_class: 'door' }, last_changed: ago(12), area: 'Kitchen' },
  { entity_id: 'media_player.living_room_tv', state: 'playing', attributes: { friendly_name: 'Living room TV', device_class: 'tv', volume_level: 0.3, media_title: 'The News' }, last_changed: ago(25), area: 'Living room' },
  { entity_id: 'lock.back_door_lock', state: 'locked', attributes: { friendly_name: 'Back door lock' }, last_changed: ago(600), area: 'Kitchen' },
  { entity_id: 'cover.garage_door', state: 'closed', attributes: { friendly_name: 'Garage door', device_class: 'garage' }, last_changed: ago(1200) },
  { entity_id: 'camera.front_door', state: 'idle', attributes: { friendly_name: 'Front door camera' }, last_changed: ago(1) },
];

let states = fresh();
let calls = [];
/** Back as it was, nothing called. */
export function resetHouse() {
  states = fresh();
  calls = [];
}
/** What reached the box: each service call, in order. */
export const houseCalls = () => calls.map((c) => ({ ...c }));

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json' } });
const auth = (init) => {
  const h = new Headers(init?.headers ?? {});
  return h.get('authorization') === `Bearer ${HOUSE_TOKEN}`;
};

/** The box's answer to a request for its address, or null for any other host. */
export function houseApi(u, init) {
  if (u.origin !== HOUSE_URL) return null;
  if (!auth(init)) return json({ message: 'Unauthorized' }, 401);
  const method = (init?.method ?? 'GET').toUpperCase();
  if (u.pathname === '/api/' && method === 'GET') return json({ message: 'API running.' });
  if (u.pathname === '/api/states' && method === 'GET') return json(states.map(({ area, ...s }) => s));
  if (u.pathname === '/api/template' && method === 'POST') {
    const body = JSON.parse(init?.body ?? '{}');
    if (!/area_name/.test(body.template ?? '')) return new Response('', { status: 400 });
    return new Response(JSON.stringify(states.filter((s) => s.area).map((s) => [s.entity_id, s.area])), { headers: { 'content-type': 'text/plain' } });
  }
  const m = /^\/api\/services\/([a-z_]+)\/([a-z_]+)$/.exec(u.pathname);
  if (m && method === 'POST') {
    const body = JSON.parse(init?.body ?? '{}');
    calls.push({ domain: m[1], service: m[2], body });
    const s = states.find((x) => x.entity_id === body.entity_id);
    if (!s) return json([], 200);
    const at = new Date().toISOString();
    const set = (state, attrs = {}) => Object.assign(s, { state, attributes: { ...s.attributes, ...attrs }, last_changed: state !== s.state ? at : s.last_changed });
    switch (`${m[1]}.${m[2]}`) {
      case 'light.turn_on': set('on', body.brightness_pct ? { brightness: Math.round((body.brightness_pct / 100) * 255) } : {}); break;
      case 'light.turn_off': set('off'); break;
      case 'climate.set_temperature': set(body.hvac_mode ?? s.state, { temperature: body.temperature }); break;
      case 'climate.set_hvac_mode': set(body.hvac_mode); break;
      case 'media_player.media_pause': set('paused'); break;
      case 'media_player.media_play': set('playing'); break;
      case 'media_player.volume_set': set(s.state, { volume_level: body.volume_level }); break;
      case 'cover.open_cover': set('open'); break;
      case 'cover.close_cover': set('closed'); break;
      case 'lock.unlock': set('unlocked'); break;
      case 'lock.lock': set('locked'); break;
      default:
    }
    return json([s]);
  }
  return json({ message: 'Not found' }, 404);
}
