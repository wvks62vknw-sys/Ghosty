/**
 * THE HOME ASSISTANT BRIDGE's rules and words (BRIEF-REST-D 2), shared by the Worker (apps/edge/src/house.ts) and the phone
 * (apps/web/src/house/). Pure.
 *
 *  - THE ALLOWLIST, as code: light, switch, climate (his underfloor and central heating: current and target temperature,
 *    mode), fan, cover (blinds and curtains), media_player (his TVs and speakers), scene, script, input_boolean, vacuum,
 *    water_heater; sensor and binary_sensor read only. Anything else is refused with its domain named.
 *  - THE GUARDED SET: any lock, any alarm, a cover whose device class is garage or gate, and a switch he marks "needs my
 *    word". Only his own tap with a confirm may touch them; a scheduled job never may, and the chat's words only offer the
 *    button.
 *  - Each service call shaped from a short list of the fields it may carry, every number held to its range.
 *  - His words, read with no model: "turn (on|off) the …", "dim the … to 40", "set the heating to 21", "is the … (on|off|
 *    open|closed)?", "what's the temperature in the …?", "pause the telly", "close the blinds", "unlock the back door"; the
 *    names matched to his entities' friendly names and rooms, with "which one?" when two match.
 */

/** A state as Home Assistant's REST API gives it (GET /api/states). */
export interface HaState {
  entity_id: string;
  state: string;
  attributes?: Record<string, unknown>;
  last_changed?: string;
}

/** One thing in his house as the phone sees it: plain fields, never the address or the token. */
export interface HouseEntity {
  id: string;
  domain: string;
  name: string;
  /** The room, as Home Assistant has it ('' when it has none). */
  area: string;
  state: string;
  /** When it last changed (ms). */
  changed: number;
  unit?: string;
  cls?: string;
  /** A light's brightness (0–100) and whether it dims. */
  brightness?: number;
  dimmable?: boolean;
  /** Heating: the room's temperature, the one asked for, the mode and the modes it has. */
  current?: number;
  target?: number;
  mode?: string;
  modes?: string[];
  /** A blind: how open (0–100), and whether it can stop part way. */
  position?: number;
  positionable?: boolean;
  /** A TV or speaker: its volume (0–1) and what is on. */
  volume?: number;
  title?: string;
  /** Needs his own tap and a confirm, every time. */
  guarded?: boolean;
}

export type Origin = 'tap' | 'chat' | 'job';

/** The domains and the services I may call, as code. */
export const ALLOWED: Record<string, string[]> = {
  light: ['turn_on', 'turn_off', 'toggle'],
  switch: ['turn_on', 'turn_off', 'toggle'],
  input_boolean: ['turn_on', 'turn_off', 'toggle'],
  climate: ['set_temperature', 'set_hvac_mode', 'turn_on', 'turn_off'],
  fan: ['turn_on', 'turn_off', 'toggle', 'set_percentage'],
  cover: ['open_cover', 'close_cover', 'stop_cover', 'set_cover_position'],
  media_player: ['media_play', 'media_pause', 'media_play_pause', 'media_stop', 'volume_set', 'volume_mute', 'media_next_track', 'media_previous_track', 'turn_on', 'turn_off'],
  scene: ['turn_on'],
  script: ['turn_on'],
  vacuum: ['start', 'pause', 'stop', 'return_to_base'],
  water_heater: ['set_temperature', 'set_operation_mode', 'turn_on', 'turn_off'],
};
/** Read, never touched. */
export const READ_ONLY = ['sensor', 'binary_sensor'];
/** Always guarded: his tap and a confirm, never a job. */
export const GUARDED_SERVICES: Record<string, string[]> = {
  lock: ['lock', 'unlock', 'open'],
  alarm_control_panel: ['alarm_disarm', 'alarm_arm_home', 'alarm_arm_away', 'alarm_arm_night'],
};
/** A cover of these device classes is guarded too. */
export const GUARD_CLASSES = ['garage', 'gate'];
export const HVAC_MODES = ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only'];

/** What each domain is, in his words. */
export const DOMAIN_WORDS: Record<string, string> = {
  light: 'a light', switch: 'a switch', input_boolean: 'a switch', climate: 'the heating', fan: 'a fan', cover: 'a blind', media_player: 'a TV or speaker',
  scene: 'a scene', script: 'a script', vacuum: 'the vacuum', water_heater: 'the hot water', sensor: 'a sensor', binary_sensor: 'a sensor', lock: 'a lock', alarm_control_panel: 'the alarm',
};
const ALLOWED_WORDS = 'lights, switches, the heating, fans, blinds and curtains, TVs and speakers, scenes, scripts, the vacuum and the hot water; sensors I only read';

export const domainOf = (entity: string) => String(entity).split('.')[0] ?? '';

/** In the guarded set: any lock or alarm, a garage door or a gate, a switch he marked "needs my word". */
export function isGuarded(e: Pick<HouseEntity, 'id' | 'domain' | 'cls'>, marked: readonly string[] = []): boolean {
  if (e.domain in GUARDED_SERVICES) return true;
  if (e.domain === 'cover' && GUARD_CLASSES.includes(e.cls ?? '')) return true;
  return (e.domain === 'switch' || e.domain === 'input_boolean') && marked.includes(e.id);
}

export type Verdict = { ok: true; guarded: boolean } | { ok: false; why: string; needs?: 'confirm' };

/**
 * May this call be made, from here? A domain off the list is refused with its name; a sensor only read; the guarded set
 * never from a job, and only from his tap with a confirm.
 */
export function policy(e: Pick<HouseEntity, 'id' | 'domain' | 'cls' | 'name'>, service: string, o: { marked?: readonly string[]; origin: Origin; confirm?: boolean }): Verdict {
  const d = e.domain;
  if (READ_ONLY.includes(d)) return { ok: false, why: `The ${e.name || e.id} is a sensor: I only read sensors, I never change them.` };
  const guarded = isGuarded(e, o.marked);
  const known = (ALLOWED[d] ?? []).includes(service) || (GUARDED_SERVICES[d] ?? []).includes(service);
  if (!(d in ALLOWED) && !(d in GUARDED_SERVICES)) return { ok: false, why: `I don’t touch “${d}” things in your house. I only work ${ALLOWED_WORDS}.` };
  if (!known) return { ok: false, why: `That is not something I do to ${DOMAIN_WORDS[d] ?? d} (“${d}.${service}” is not on my list).` };
  if (guarded && o.origin === 'job') return { ok: false, why: `A scheduled job never touches the ${e.name || e.id} (${DOMAIN_WORDS[d] ?? d}${d === 'cover' ? ', a garage door or gate' : ''}): only your own tap, with a confirm, does.` };
  if (guarded && !(o.origin === 'tap' && o.confirm)) return { ok: false, why: `The ${e.name || e.id} needs your own tap, with a confirm.`, needs: 'confirm' };
  return { ok: true, guarded };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const numOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** The call, shaped: its path and a body of only the fields that service takes, each held to its range. */
export function shapeCall(domain: string, service: string, entity: string, data: Record<string, unknown> = {}, e?: Pick<HouseEntity, 'modes'>): { path: string; body: Record<string, unknown> } | { error: string } {
  if (!/^[a-z_]+$/.test(domain) || !/^[a-z_]+$/.test(service) || !/^[a-z_]+\.[a-z0-9_]+$/.test(entity) || domainOf(entity) !== domain) return { error: 'That is not a thing in your house I can name.' };
  const body: Record<string, unknown> = { entity_id: entity };
  const n = (k: string) => numOf(data[k]);
  switch (`${domain}.${service}`) {
    case 'light.turn_on':
      if (n('brightness_pct') !== null) body.brightness_pct = Math.round(clamp(n('brightness_pct')!, 1, 100));
      break;
    case 'climate.set_temperature': {
      const t = n('temperature');
      if (t === null) return { error: 'What temperature? Between 5 and 30 °C.' };
      if (t < 5 || t > 30) return { error: `${t} °C is outside what I will set: between 5 and 30 °C.` };
      body.temperature = Math.round(t * 2) / 2;
      const m = String(data.hvac_mode ?? '');
      if (m && HVAC_MODES.includes(m) && (!e?.modes || e.modes.includes(m))) body.hvac_mode = m;
      break;
    }
    case 'climate.set_hvac_mode': {
      const m = String(data.hvac_mode ?? '');
      if (!HVAC_MODES.includes(m) || (e?.modes && !e.modes.includes(m))) return { error: `The heating has no “${m}” mode.` };
      body.hvac_mode = m;
      break;
    }
    case 'cover.set_cover_position':
      if (n('position') === null) return { error: 'How far open? 0 to 100.' };
      body.position = Math.round(clamp(n('position')!, 0, 100));
      break;
    case 'media_player.volume_set':
      if (n('volume_level') === null) return { error: 'How loud? 0 to 100.' };
      body.volume_level = Math.round(clamp(n('volume_level')!, 0, 1) * 100) / 100;
      break;
    case 'media_player.volume_mute':
      body.is_volume_muted = data.is_volume_muted !== false;
      break;
    case 'fan.set_percentage':
      if (n('percentage') === null) return { error: 'How fast? 0 to 100.' };
      body.percentage = Math.round(clamp(n('percentage')!, 0, 100));
      break;
    case 'water_heater.set_temperature': {
      const t = n('temperature');
      if (t === null || t < 30 || t > 70) return { error: 'The hot water: between 30 and 70 °C.' };
      body.temperature = Math.round(t);
      break;
    }
    case 'water_heater.set_operation_mode':
      body.operation_mode = String(data.operation_mode ?? '').slice(0, 40);
      break;
    default:
  }
  return { path: `/api/services/${domain}/${service}`, body };
}

// ---------------------------------------------------------------- the states, plainly

const SENSOR_CLASSES = ['temperature', 'humidity', 'power', 'illuminance', 'carbon_dioxide', 'pm25'];
const BINARY_CLASSES = ['door', 'window', 'garage_door', 'opening', 'motion', 'occupancy', 'moisture', 'smoke', 'gas', 'lock'];
export const ROOM_WORDS = ['main bedroom', 'living room', 'sitting room', 'dining room', 'front room', 'kitchen', 'hallway', 'hall', 'landing', 'bedroom', 'lounge', 'bathroom', 'toilet', 'office', 'study', 'garage', 'garden', 'loft', 'utility', 'porch', 'conservatory', 'nursery'];
const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());

/** A room from a name when Home Assistant gives none ("Kitchen light" → "Kitchen"). */
export function guessArea(name: string): string {
  const t = name.toLowerCase();
  const w = ROOM_WORDS.find((r) => new RegExp(`\\b${r}\\b`).test(t));
  return w ? cap(w) : '';
}

/** A Home Assistant state as one of his things, or null when it is not one I show (a domain off the list, a sensor of no use). */
export function toEntity(s: HaState, area: string): HouseEntity | null {
  const id = String(s.entity_id ?? '');
  const domain = domainOf(id);
  if (!(domain in ALLOWED) && !(domain in GUARDED_SERVICES) && !READ_ONLY.includes(domain)) return null;
  const a = s.attributes ?? {};
  if (a.hidden === true) return null;
  const cls = typeof a.device_class === 'string' ? a.device_class : undefined;
  const unit = typeof a.unit_of_measurement === 'string' ? a.unit_of_measurement : undefined;
  if (domain === 'sensor' && !SENSOR_CLASSES.includes(cls ?? '') && unit !== '°C') return null;
  if (domain === 'binary_sensor' && !BINARY_CLASSES.includes(cls ?? '')) return null;
  const name = String(a.friendly_name ?? id.split('.')[1]?.replace(/_/g, ' ') ?? id).slice(0, 60);
  const e: HouseEntity = { id, domain, name, area: area || guessArea(name), state: String(s.state ?? ''), changed: Date.parse(s.last_changed ?? '') || 0 };
  if (cls) e.cls = cls;
  if (unit) e.unit = unit;
  if (domain === 'light') {
    const b = numOf(a.brightness);
    if (b !== null) e.brightness = Math.round((b / 255) * 100);
    const modes = Array.isArray(a.supported_color_modes) ? a.supported_color_modes.map(String) : [];
    e.dimmable = b !== null || modes.some((m) => m !== 'onoff');
  }
  if (domain === 'climate' || domain === 'water_heater') {
    const c = numOf(a.current_temperature);
    const t = numOf(a.temperature);
    if (c !== null) e.current = c;
    if (t !== null) e.target = t;
    e.mode = domain === 'climate' ? e.state : String(a.operation_mode ?? e.state);
    const modes = Array.isArray(a.hvac_modes) ? a.hvac_modes : Array.isArray(a.operation_list) ? a.operation_list : [];
    e.modes = modes.map(String).slice(0, 8);
  }
  if (domain === 'cover') {
    const p = numOf(a.current_position);
    if (p !== null) {
      e.position = Math.round(p);
      e.positionable = true;
    }
  }
  if (domain === 'media_player') {
    const v = numOf(a.volume_level);
    if (v !== null) e.volume = v;
    if (typeof a.media_title === 'string') e.title = a.media_title.slice(0, 80);
  }
  return e;
}

const MODE_WORDS: Record<string, string> = { heat: 'heating', off: 'off', auto: 'on auto', cool: 'cooling', heat_cool: 'heating or cooling', dry: 'drying', fan_only: 'fan only' };
const deg = (v: number) => `${Math.round(v * 10) / 10} °C`;

/** What it is doing, in his words: "on, 60%", "19.5 °C, set to 21 °C, heating", "open", "playing The News". */
export function stateWords(e: HouseEntity): string {
  const s = e.state;
  if (s === 'unavailable' || s === 'unknown') return 'not answering';
  switch (e.domain) {
    case 'light': return s === 'on' ? (e.brightness !== undefined ? `on, ${e.brightness}%` : 'on') : 'off';
    case 'switch': case 'input_boolean': case 'fan': return s;
    case 'climate': return [e.current !== undefined ? deg(e.current) : '', e.target !== undefined ? `set to ${deg(e.target)}` : '', MODE_WORDS[s] ?? s].filter(Boolean).join(', ');
    case 'water_heater': return [e.current !== undefined ? deg(e.current) : '', e.target !== undefined ? `set to ${deg(e.target)}` : '', e.mode ?? ''].filter(Boolean).join(', ');
    case 'cover': return e.positionable && s === 'open' && (e.position ?? 100) < 100 ? `${e.position}% open` : s;
    case 'media_player': return s === 'playing' && e.title ? `playing “${e.title}”` : s;
    case 'sensor': return `${Math.round(Number(s) * 10) / 10 || s}${e.unit ? ` ${e.unit}` : ''}`;
    case 'binary_sensor': {
      const on = s === 'on';
      if (['door', 'window', 'garage_door', 'opening'].includes(e.cls ?? '')) return on ? 'open' : 'closed';
      if (['motion', 'occupancy'].includes(e.cls ?? '')) return on ? 'someone there' : 'clear';
      if (e.cls === 'moisture') return on ? 'wet' : 'dry';
      if (e.cls === 'lock') return on ? 'unlocked' : 'locked';
      return on ? 'detected' : 'clear';
    }
    case 'alarm_control_panel': return s.replace(/_/g, ' ');
    default: return s.replace(/_/g, ' ');
  }
}

/** A temperature an entity reads (a temperature sensor, or the heating's own thermometer). */
const tempOf = (e: HouseEntity): number | null => (e.domain === 'sensor' && (e.cls === 'temperature' || e.unit === '°C') ? numOf(e.state) : e.domain === 'climate' && e.current !== undefined ? e.current : null);

/** The coldest room and its temperature. */
export function coldest(list: HouseEntity[]): { room: string; temp: number } | null {
  let best: { room: string; temp: number } | null = null;
  for (const e of list) {
    const t = tempOf(e);
    if (t === null) continue;
    const room = e.area || e.name;
    if (!best || t < best.temp) best = { room, temp: t };
  }
  return best;
}

/** The whole house in a line: "3 lights on · coldest: Bedroom 17.5 °C · heating: 19.5 °C, set to 21 °C, heating". */
export function houseLine(list: HouseEntity[]): string {
  const lights = list.filter((e) => e.domain === 'light' && e.state === 'on').length;
  const c = coldest(list);
  const heat = list.find((e) => e.domain === 'climate');
  return [`${lights} ${lights === 1 ? 'light' : 'lights'} on`, c ? `coldest: ${c.room} ${deg(c.temp)}` : '', heat ? `heating: ${stateWords(heat)}` : ''].filter(Boolean).join(' · ');
}

/** The morning's one house line (short: it shares the morning's line). */
export function morningHouse(list: HouseEntity[]): string | null {
  const c = coldest(list);
  const heat = list.find((e) => e.domain === 'climate');
  const parts = [c ? `${c.room} ${deg(c.temp)} (the coldest)` : '', heat ? (heat.state === 'off' ? 'heating off' : heat.target !== undefined ? `heating set to ${deg(heat.target)}` : `heating ${MODE_WORDS[heat.state] ?? heat.state}`) : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** The house as a fact for one brain turn: the line, then each room's things and what they are doing. */
export function houseFacts(list: HouseEntity[], max = 1400): string {
  const rooms = new Map<string, HouseEntity[]>();
  for (const e of list) rooms.set(e.area || 'Elsewhere', [...(rooms.get(e.area || 'Elsewhere') ?? []), e]);
  const out = [houseLine(list)];
  for (const [room, es] of rooms) out.push(`${room}: ${es.map((e) => `${e.name} ${stateWords(e)}`).join('; ')}`);
  const text = out.join('\n');
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// ---------------------------------------------------------------- his words

export type HouseAsk =
  | { kind: 'sheet' }
  | { kind: 'power'; on: boolean; name: string }
  | { kind: 'dim'; name: string; pct: number }
  | { kind: 'heat'; temp: number; name: string }
  | { kind: 'is'; name: string; want: 'on' | 'off' | 'open' | 'closed' | 'locked' | 'unlocked' }
  | { kind: 'temp'; room: string }
  | { kind: 'media'; act: 'pause' | 'play' | 'stop' | 'mute' | 'unmute'; name: string }
  | { kind: 'cover'; open: boolean; name: string }
  | { kind: 'lock'; lock: boolean; name: string };

const DEVICE = /\b(?:lights?|lamps?|heating|thermostat|radiators?|underfloor|boiler|hot water|telly|tv|television|speakers?|sonos|blinds?|curtains?|shutters?|garage(?: door)?|gate|fans?|plugs?|sockets?|switch|hoover|vacuum|door|lock|alarm|heater)\b/;
const HEAT = /^(?:the |my )?(?:central heating|underfloor heating|underfloor|heating|thermostat|temperature|radiators?)(?: (?:in|on) (?:the |my )?(.+))?$/;
let known = new Set<string>();
/** His own things' names and rooms, so "turn off the christmas tree" is his when it is one of them (the phone sets these). */
export function setHouseNames(names: string[]): void {
  known = new Set(names.map((n) => n.toLowerCase().trim()).filter((n) => n.length > 1));
}
const mine = (name: string) => DEVICE.test(name) || known.has(name) || [...known].some((k) => k.length > 3 && name.endsWith(k));
const roomy = (name: string) => ROOM_WORDS.some((r) => new RegExp(`\\b${r}\\b`).test(name)) || known.has(name) || /^(?:the )?(?:house|home)$/.test(name);
/** The thing's name alone: no "the", and no time or courtesy after it ("the hall light at 11pm", "… every night", "… please"). */
const TAIL = /\s+(?:please|now|for me|tonight|at night|at (?:midnight|noon|\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)|every (?:night|day|morning|evening)|each (?:night|day|morning|evening)|in the (?:morning|evening))$/;
const clean = (s: string) => {
  let t = s.replace(/^(?:the|my|our)\s+/, '').trim();
  while (TAIL.test(t)) t = t.replace(TAIL, '').trim();
  return t;
};

/** His words as a house ask, or null (the brain's, as ever). */
export function houseAsked(text: string): HouseAsk | null {
  let t = String(text ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '');
  // (a time after the words is when, not what: "turn the heating off every night")
  while (TAIL.test(t)) t = t.replace(TAIL, '').trim();
  if (!t || t.length > 120) return null;
  // ("turn on TV mode" is the app's own big layout for a television, never his telly)
  if (/\btv (?:mode|layout)\b|\btelevision mode\b/.test(t)) return null;
  if (/^(?:(?:show me|open) )?(?:the |my )?(?:house|home assistant|smart home)(?: sheet| status)?$/.test(t) || /^how(?:'s| is) the house$/.test(t) || /^what'?s on in the house$/.test(t)) return { kind: 'sheet' };
  let m = /^(?:please )?(?:set|turn|put) (?:the |my )?(.+?) (?:up |down )?to (\d{1,2}(?:\.5)?)\s*(?:°c?|degrees?(?: c)?|c)?$/.exec(t) ?? /^make it (\d{1,2}(?:\.5)?) degrees(?: in (?:the |my )?(.+))?$/.exec(t);
  if (m) {
    const words = /^make it/.test(t) ? `heating${m[2] ? ` in ${m[2]}` : ''}` : m[1]!;
    const temp = Number(/^make it/.test(t) ? m[1] : m[2]);
    const h = HEAT.exec(words);
    if (h) return { kind: 'heat', temp, name: clean(h[1] ?? '') };
    if (!/^make it/.test(t) && mine(clean(m[1]!)) && temp <= 100) return { kind: 'dim', name: clean(m[1]!), pct: temp };
  }
  m = /^(?:please )?(?:dim|brighten|set) (?:the |my )?(.+?) (?:to|at) (\d{1,3})\s*(?:%|percent)?$/.exec(t);
  if (m && mine(clean(m[1]!)) && Number(m[2]) <= 100) return { kind: 'dim', name: clean(m[1]!), pct: Number(m[2]) };
  m = /^(?:please )?(?:turn|switch|put) (on|off) (?:the |my )?(.+)$/.exec(t) ?? /^(?:please )?(?:turn|switch|put) (?:the |my )?(.+?) (on|off)$/.exec(t);
  if (m) {
    const on = m[1] === 'on' || m[1] === 'off' ? m[1] === 'on' : m[2] === 'on';
    const name = clean(m[1] === 'on' || m[1] === 'off' ? m[2]! : m[1]!);
    if (mine(name)) return { kind: 'power', on, name };
  }
  m = /^(?:is|are) (?:the |my )?(.+?) (on|off|open|closed|shut|locked|unlocked)$/.exec(t) ?? /^did i leave (?:the |my )?(.+?) (on|open|unlocked)$/.exec(t);
  if (m && mine(clean(m[1]!))) return { kind: 'is', name: clean(m[1]!), want: (m[2] === 'shut' ? 'closed' : m[2]) as 'on' };
  m = /^(?:what(?:'s| is) the )?temperature (?:in|of) (?:the |my )?(.+)$/.exec(t) ?? /^how (?:warm|cold|hot) is (?:it )?(?:in )?(?:the |my )?(.+)$/.exec(t);
  if (m && roomy(clean(m[1]!))) return { kind: 'temp', room: clean(m[1]!) };
  m = /^(?:please )?(pause|play|resume|stop|mute|unmute) (?:the |my )?(telly|tv|television|speakers?|sonos|.+? (?:tv|telly|speakers?))$/.exec(t);
  if (m) return { kind: 'media', act: (m[1] === 'resume' ? 'play' : m[1]) as 'pause', name: clean(m[2]!) };
  m = /^(?:please )?(open|close|shut|raise|lower|draw) (?:the |my )?(.+)$/.exec(t);
  if (m && /\b(?:blinds?|curtains?|shutters?|garage(?: door)?|gate|awning)\b/.test(m[2]!)) return { kind: 'cover', open: m[1] === 'open' || m[1] === 'raise', name: clean(m[2]!) };
  m = /^(?:please )?(lock|unlock) (?:the |my )?(.+)$/.exec(t);
  if (m && /\b(?:door|lock|gate|garage)\b/.test(m[2]!)) return { kind: 'lock', lock: m[1] === 'lock', name: clean(m[2]!) };
  return null;
}

/** The domains an ask can mean. */
function domainsFor(a: HouseAsk, name: string): string[] {
  const heat = /\b(?:heating|thermostat|radiators?|underfloor|boiler)\b/.test(name);
  const water = /\bhot water\b/.test(name);
  switch (a.kind) {
    case 'power': return heat ? ['climate'] : water ? ['water_heater'] : /\b(?:tv|telly|television|speakers?)\b/.test(name) ? ['media_player'] : /\b(?:hoover|vacuum)\b/.test(name) ? ['vacuum'] : ['light', 'switch', 'input_boolean', 'fan', 'media_player', 'climate', 'water_heater', 'scene', 'script', 'vacuum'];
    case 'dim': return ['light'];
    case 'heat': return water ? ['water_heater'] : ['climate'];
    case 'is': return ['light', 'switch', 'input_boolean', 'fan', 'binary_sensor', 'cover', 'lock', 'media_player', 'climate', 'alarm_control_panel'];
    case 'temp': return ['sensor', 'climate'];
    case 'media': return ['media_player'];
    case 'cover': return ['cover'];
    case 'lock': return ['lock'];
    default: return [];
  }
}

const SYN: Record<string, string> = { telly: 'tv', television: 'tv', lamp: 'light', lamps: 'light', lights: 'light', blinds: 'blind', curtains: 'curtain', speakers: 'speaker', hoover: 'vacuum', plug: 'switch', plugs: 'switch', socket: 'switch', sockets: 'switch', thermostat: 'heating', radiators: 'heating', radiator: 'heating', lounge: 'living', hallway: 'hall' };
const TYPE_WORD: Record<string, string> = { light: 'light', climate: 'heating', media_player: 'tv', cover: 'blind', lock: 'lock', binary_sensor: 'door', switch: 'switch', fan: 'fan', vacuum: 'vacuum', water_heater: 'water' };
const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(' ').filter((w) => w && !['the', 'my', 'in', 'on', 'of', 'a', 'room'].includes(w)).map((w) => SYN[w] ?? w);

/** His things that his words name, best first: exact names, then the most words in common (name, room, kind). */
export function matchEntities(name: string, list: HouseEntity[], domains: string[]): HouseEntity[] {
  const want = tokens(name);
  const pool = list.filter((e) => domains.includes(e.domain));
  if (!want.length) return pool.length === 1 ? pool : [];
  const scored = pool.map((e) => {
    // a garage door or a gate is never "the blinds"
    const type = e.domain === 'cover' && GUARD_CLASSES.includes(e.cls ?? '') ? (e.cls ?? '') : (TYPE_WORD[e.domain] ?? '');
    const have = new Set([...tokens(e.name), ...tokens(e.area), type, ...(e.cls && e.domain !== 'cover' ? [e.cls] : [])]);
    const exact = e.name.toLowerCase() === name.toLowerCase() ? 100 : 0;
    const hits = want.filter((w) => have.has(w)).length;
    // every word he said must be in its name, room or kind
    return { e, s: hits === want.length ? exact + hits * 10 - [...tokens(e.name)].filter((w) => !want.includes(w)).length : -1 };
  }).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s);
  if (!scored.length) return [];
  const top = scored[0]!.s;
  return scored.filter((x) => x.s === top).map((x) => x.e);
}

export type Resolved =
  | { kind: 'act'; entity: HouseEntity; service: string; data: Record<string, unknown>; guarded: boolean; verb: string }
  | { kind: 'answer'; text: string }
  | { kind: 'which'; text: string; options: { entity: HouseEntity; service: string; data: Record<string, unknown> }[] }
  | { kind: 'none'; text: string };

const ago = (ms: number, now: number) => {
  if (!ms) return '';
  const m = Math.round((now - ms) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} days ago`;
};

/** The call an ask makes on one of his things (or the answer it reads from it). */
function callFor(a: HouseAsk, e: HouseEntity): { service: string; data: Record<string, unknown>; verb: string } | null {
  switch (a.kind) {
    case 'power':
      if (e.domain === 'climate') return { service: 'set_hvac_mode', data: { hvac_mode: a.on ? (e.modes?.includes('heat') ? 'heat' : (e.modes?.find((x) => x !== 'off') ?? 'heat')) : 'off' }, verb: a.on ? 'turn on' : 'turn off' };
      if (e.domain === 'vacuum') return { service: a.on ? 'start' : 'return_to_base', data: {}, verb: a.on ? 'start' : 'send home' };
      if (e.domain === 'scene' || e.domain === 'script') return a.on ? { service: 'turn_on', data: {}, verb: 'run' } : null;
      return { service: a.on ? 'turn_on' : 'turn_off', data: {}, verb: a.on ? 'turn on' : 'turn off' };
    case 'dim': return { service: a.pct === 0 ? 'turn_off' : 'turn_on', data: a.pct === 0 ? {} : { brightness_pct: a.pct }, verb: `dim to ${a.pct}%` };
    case 'heat': return { service: 'set_temperature', data: { temperature: a.temp, ...(e.domain === 'climate' && e.state === 'off' && e.modes?.includes('heat') ? { hvac_mode: 'heat' } : {}) }, verb: `set to ${a.temp} °C` };
    case 'media': return a.act === 'mute' || a.act === 'unmute' ? { service: 'volume_mute', data: { is_volume_muted: a.act === 'mute' }, verb: a.act } : { service: a.act === 'pause' ? 'media_pause' : a.act === 'play' ? 'media_play' : 'media_stop', data: {}, verb: a.act };
    case 'cover': return { service: a.open ? 'open_cover' : 'close_cover', data: {}, verb: a.open ? 'open' : 'close' };
    case 'lock': return { service: a.lock ? 'lock' : 'unlock', data: {}, verb: a.lock ? 'lock' : 'unlock' };
    default: return null;
  }
}

/** His ask against his things: the call to make, the answer, "which one?", or that nothing matches. */
export function resolveAsk(a: HouseAsk, list: HouseEntity[], marked: readonly string[] = [], now = Date.now()): Resolved {
  if (a.kind === 'sheet') return { kind: 'answer', text: houseLine(list) };
  if (a.kind === 'temp') {
    const want = tokens(a.room);
    const inRoom = list.filter((e) => tempOf(e) !== null && (want.every((w) => tokens(e.area).includes(w)) || want.every((w) => tokens(e.name).includes(w))));
    const pick = inRoom.find((e) => e.domain === 'sensor') ?? inRoom[0];
    if (!pick) return { kind: 'none', text: `I can’t find a thermometer in “${a.room}” in your house.` };
    return { kind: 'answer', text: `It’s ${deg(tempOf(pick)!)} in the ${(pick.area || a.room).toLowerCase()}${pick.changed ? ` (${pick.name}, ${ago(pick.changed, now)})` : ''}.` };
  }
  const name = a.name || (a.kind === 'heat' ? 'heating' : '');
  const found = matchEntities(name || 'heating', list, domainsFor(a, name || 'heating'));
  const label = (e: HouseEntity) => `${e.name}${e.area && !e.name.toLowerCase().includes(e.area.toLowerCase()) ? ` (${e.area})` : ''}`;
  if (!found.length) return { kind: 'none', text: `I can’t find “${name}” in your house.` };
  if (a.kind === 'is') {
    if (found.length > 1) return { kind: 'answer', text: found.slice(0, 4).map((e) => `${label(e)}: ${stateWords(e)}`).join('; ') };
    const e = found[0]!;
    const now2 = stateWords(e);
    const yes = now2 === a.want || now2.startsWith(`${a.want},`) || (a.want === 'open' && /% open$/.test(now2));
    return { kind: 'answer', text: `${yes ? 'Yes' : 'No'}: the ${e.name} is ${now2}${e.changed ? ` (since ${ago(e.changed, now)})` : ''}.` };
  }
  const calls = found.map((e) => ({ e, c: callFor(a, e) })).filter((x): x is { e: HouseEntity; c: NonNullable<ReturnType<typeof callFor>> } => !!x.c);
  if (!calls.length) return { kind: 'none', text: `I can’t do that to the ${found[0]!.name}.` };
  if (calls.length > 1) return { kind: 'which', text: `Which one? ${calls.slice(0, 4).map((x) => label(x.e)).join(', or ')}?`, options: calls.slice(0, 4).map((x) => ({ entity: x.e, service: x.c.service, data: x.c.data })) };
  const { e, c } = calls[0]!;
  return { kind: 'act', entity: e, service: c.service, data: c.data, guarded: isGuarded(e, marked), verb: c.verb };
}

/** What was done, in his words: "the Hall light is off", "the Heating is set to 21 °C". */
export function doneWords(e: Pick<HouseEntity, 'name' | 'domain'>, service: string, body: Record<string, unknown>): string {
  const n = `the ${e.name}`;
  switch (service) {
    case 'turn_on': return body.brightness_pct !== undefined ? `${n} is on at ${body.brightness_pct}%` : e.domain === 'scene' || e.domain === 'script' ? `${n} has run` : `${n} is on`;
    case 'turn_off': return `${n} is off`;
    case 'toggle': return `${n} is switched`;
    case 'set_temperature': return `${n} is set to ${body.temperature} °C${body.hvac_mode ? `, ${MODE_WORDS[String(body.hvac_mode)] ?? body.hvac_mode}` : ''}`;
    case 'set_hvac_mode': return `${n} is ${MODE_WORDS[String(body.hvac_mode)] ?? body.hvac_mode}`;
    case 'open_cover': return `${n} is opening`;
    case 'close_cover': return `${n} is closing`;
    case 'stop_cover': return `${n} has stopped`;
    case 'set_cover_position': return `${n} is going to ${body.position}% open`;
    case 'media_pause': return `${n} is paused`;
    case 'media_play': return `${n} is playing`;
    case 'media_stop': return `${n} has stopped`;
    case 'volume_set': return `${n} is at ${Math.round(Number(body.volume_level) * 100)}% volume`;
    case 'volume_mute': return body.is_volume_muted ? `${n} is muted` : `${n} is unmuted`;
    case 'lock': return `${n} is locking`;
    case 'unlock': return `${n} is unlocking`;
    case 'start': return `${n} has started`;
    case 'return_to_base': return `${n} is going home`;
    default: return `${n}: ${service.replace(/_/g, ' ')} done`;
  }
}

/** A house action as a WHY step's tool for this thing ("set_lights" → "Set lights"; a garage door is never "blinds"). */
export const trailTool = (e: Pick<HouseEntity, 'domain' | 'cls'>) => (e.domain === 'cover' && GUARD_CLASSES.includes(e.cls ?? '') ? `set_${e.cls}` : (TRAIL_TOOL[e.domain] ?? 'set_house'));
/** A house action as a WHY step's tool, said as done ("set_lights" → "Set lights"). */
export const TRAIL_TOOL: Record<string, string> = { light: 'set_lights', switch: 'set_switch', input_boolean: 'set_switch', climate: 'set_heating', fan: 'set_fan', cover: 'set_blinds', media_player: 'set_tv', scene: 'set_scene', script: 'set_script', vacuum: 'set_vacuum', water_heater: 'set_hot_water', lock: 'set_lock', alarm_control_panel: 'set_alarm' };

/** His side, step by step: said on the LINKS card and in SYSTEM → KEYS (nothing paid is needed). */
export const HOUSE_STEPS = [
  'Home Assistant runs free on a Raspberry Pi or any old computer at home: install it (home-assistant.io/installation) and add your lights, heating and the rest in it.',
  'Make it reachable over HTTPS, for free: in Home Assistant open Settings → Add-ons → Add-on store, install “Duck DNS”, make a free name at duckdns.org, put its token in the add-on and turn on Let’s Encrypt in it. (Nabu Casa does this too, if you ever pay for it: not needed.)',
  'On your router, forward one port (443, or 8123) to the Home Assistant box.',
  'In Home Assistant open your profile (your name, bottom left) → Security → Long-lived access tokens → CREATE TOKEN, call it Ghosty and copy it: it is shown once.',
  'Paste your address (https://yourname.duckdns.org) on the first line of SYSTEM → KEYS → HOME ASSISTANT and the token on the second, then SAVE. I check it once; the token stays in my vault, never on this phone.',
];

/** "Link your Home Assistant first — it's in LINKS." */
export const NOT_LINKED = 'Link your Home Assistant first — it’s in LINKS.';
/** His words that make the house's state worth a fact on a brain turn. */
export const HOUSE_WORDS = /\b(?:house|home|heating|thermostat|radiators?|underfloor|boiler|hot water|lights?|lamps?|blinds?|curtains?|telly|tv|speakers?|locked|lock|door|garage|gate|alarm|temperature|warm|cold|chilly|freezing|kitchen|bedroom|lounge|living room|hall|landing|bathroom)\b/i;
