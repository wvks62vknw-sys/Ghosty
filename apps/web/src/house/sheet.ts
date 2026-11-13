/**
 * THE HOUSE SHEET (BRIEF-REST-D 2): his house as Home Assistant has it, room by room, each thing a card in plain words with
 * its control — a light's switch and brightness, the heating's temperature and mode, a blind's position, a TV's play and
 * volume, a sensor's reading with its unit and when it last changed — and the whole house in a line at the top. A lock, an
 * alarm, a garage door or gate, or a switch he marked "needs my word" asks his confirm on every tap; nothing here acts on a
 * schedule. Every action is kept in WHY (the brain keeps it: apps/edge/src/house.ts). Unlinked, the steps to link it.
 * Opened from LINKS → HOME ASSISTANT, the chat ("the house", a house reply's button) and its command.
 */
import { clear, h } from '../core/dom';
import { button, confirmSheet, modal, toast } from '../ui/components';
import { DOWN_LINE, glance, HOUSE_STEPS, isDown, isOnNow, offWords, roomOff, sinceWords, stateWords, type HouseEntity } from '../../../../packages/shared/src/house';
import { BOX_STALE, BRAIN_OUT, BRAIN_STALE, HOUSE_NONE, PINS_KEY, READING, SCENES_NOTE } from '../features/house/words';
import { waiting } from '../ui/wait';
import { act, houseNow, loadHouse, mark, type ActOut, type HouseView } from './api';

let open: { close(): void } | null = null;
/** The "Reading your house…" line on show, taken down at the next paint. */
let stopRead: (() => void) | null = null;
/** The sheet's name (its title, and its panel on the HOUSE screen: features/house/index.ts). */
export const HOUSE_TITLE = 'HOUSE';

const VERBS: Record<string, string> = { turn_on: 'turn on', turn_off: 'turn off', toggle: 'switch', open_cover: 'open', close_cover: 'close', stop_cover: 'stop', set_cover_position: 'move', lock: 'lock', unlock: 'unlock', open: 'open', alarm_disarm: 'disarm', alarm_arm_home: 'arm', alarm_arm_away: 'arm', media_play: 'play', media_pause: 'pause', set_temperature: 'set', set_hvac_mode: 'set', start: 'start', return_to_base: 'send home' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** His pinned things (kept on the phone, his own): shown first, in the order he pinned them. */
export function pins(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(PINS_KEY) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 40) : [];
  } catch {
    return [];
  }
}
function setPin(id: string, on: boolean): void {
  const now = pins().filter((x) => x !== id);
  try {
    localStorage.setItem(PINS_KEY, JSON.stringify(on ? [...now, id] : now));
  } catch {
    /* storage refused (a private window): the pin lasts until the page closes */
  }
  houseNow.set({});
}

/** ALL OFF: each light, fan and TV on in the room ('' the whole house), one after another; never the guarded set, never a switch. */
async function allOff(list: HouseEntity[], room: string): Promise<void> {
  const done: string[] = [];
  const failed: string[] = [];
  for (const c of roomOff(list, room)) ((await act(c.entity.id, c.service, {}, { origin: 'tap', why: `ALL OFF${room ? ` in the ${room}` : ''} on the HOUSE sheet` })).ok ? done : failed).push(c.entity.name);
  toast(offWords(room, done, failed), failed.length ? 'warn' : 'ok');
}

/** One action from his tap: the guarded set asks his confirm first, every time. */
export async function houseDo(e: Pick<HouseEntity, 'id' | 'name' | 'domain'> & { guarded?: boolean }, service: string, data: Record<string, unknown> = {}, said = ''): Promise<ActOut | null> {
  let confirm = false;
  if (e.guarded) {
    const verb = e.domain === 'scene' ? 'run' : (VERBS[service] ?? service.replace(/_/g, ' '));
    const ok = e.domain === 'scene'
      ? await confirmSheet(`Run ${e.name}?`, `${e.name} sets a lock, the alarm, a garage door or gate, or a switch you marked: it needs your tap and this confirm every time, and no scheduled job ever runs it.`, 'RUN IT')
      : await confirmSheet(`${cap(verb)} the ${e.name}?`, `The ${e.name} is in the guarded set (a lock, an alarm, a garage door or gate, or a switch you marked): it needs your tap and this confirm every time, and no scheduled job ever touches it.`, `${verb.toUpperCase()} IT`);
    if (!ok) return null;
    confirm = true;
  }
  const why = said ? `your tap after “${said.slice(0, 120)}”` : 'a tap on the HOUSE sheet';
  let r = await act(e.id, service, data, { origin: 'tap', confirm, why });
  // the brain knows it guarded (a switch marked since): his confirm, then once more
  if (!r.ok && r.needs === 'confirm' && !confirm) {
    if (!(await confirmSheet(`${cap(VERBS[service] ?? service.replace(/_/g, ' '))} the ${e.name}?`, `The ${e.name} needs your tap and this confirm every time.`, 'DO IT'))) return null;
    r = await act(e.id, service, data, { origin: 'tap', confirm: true, why });
  }
  toast(r.text, r.ok ? 'ok' : 'warn');
  return r;
}

function range(label: string, value: number, max: number, onSet: (v: number) => void): HTMLElement {
  const i = h('input.houserange', { type: 'range', min: '0', max: String(max), step: '1', value: String(Math.round(value)), 'aria-label': label });
  i.addEventListener('change', () => onSet(Number(i.value)));
  return i;
}
function btn(label: string, aria: string, fn: () => void, cls = ''): HTMLButtonElement {
  const b = button(label, fn, cls);
  b.setAttribute('aria-label', aria);
  b.dataset.case = 'keep';
  return b;
}

/** A thing's card: its name, what it is doing, when that changed, and its control. */
function card(e: HouseEntity, marked: string[]): HTMLElement {
  const on = e.state === 'on';
  const n = e.name;
  const ctl: (HTMLElement | null)[] = [];
  const doIt = (service: string, data: Record<string, unknown> = {}) => void houseDo(e, service, data);
  switch (e.domain) {
    case 'light':
      ctl.push(btn(on ? 'TURN OFF' : 'TURN ON', `${on ? 'Turn off' : 'Turn on'} the ${n}`, () => doIt(on ? 'turn_off' : 'turn_on'), on ? 'on' : ''));
      if (e.dimmable) ctl.push(range(`Brightness of the ${n}, in percent`, e.brightness ?? (on ? 100 : 0), 100, (v) => doIt(v ? 'turn_on' : 'turn_off', v ? { brightness_pct: v } : {})));
      break;
    case 'switch':
    case 'input_boolean':
    case 'fan': {
      ctl.push(btn(on ? 'TURN OFF' : 'TURN ON', `${on ? 'Turn off' : 'Turn on'} the ${n}`, () => doIt(on ? 'turn_off' : 'turn_on'), on ? 'on' : ''));
      if (e.domain !== 'fan') {
        const tick = h('input', { type: 'checkbox', checked: marked.includes(e.id), 'aria-label': `The ${n} needs my word: a confirm on every tap, never a scheduled job` });
        tick.addEventListener('change', () => void mark(e.id, tick.checked).then((m) => m && toast(tick.checked ? `The ${n} now needs your word, every time` : `The ${n} no longer needs your word`, 'ok')));
        ctl.push(h('label.housetick', tick, h('span', 'Needs my word')));
      }
      break;
    }
    case 'climate': {
      const t = e.target ?? e.current ?? 20;
      ctl.push(btn('−', `Lower the ${n} to ${t - 0.5} degrees`, () => doIt('set_temperature', { temperature: t - 0.5 })), h('b.housetarget', `${t} °C`), btn('+', `Raise the ${n} to ${t + 0.5} degrees`, () => doIt('set_temperature', { temperature: t + 0.5 })));
      if (e.modes?.length) {
        const sel = h('select.housemode', { 'aria-label': `The ${n}’s mode` }, ...e.modes.map((m) => h('option', { value: m, selected: m === e.mode }, cap(m.replace(/_/g, ' ')))));
        sel.addEventListener('change', () => doIt('set_hvac_mode', { hvac_mode: sel.value }));
        ctl.push(sel);
      }
      break;
    }
    case 'water_heater': {
      const t = e.target ?? 50;
      ctl.push(btn('−', `Lower the ${n} to ${t - 1} degrees`, () => doIt('set_temperature', { temperature: t - 1 })), h('b.housetarget', `${t} °C`), btn('+', `Raise the ${n} to ${t + 1} degrees`, () => doIt('set_temperature', { temperature: t + 1 })));
      break;
    }
    case 'cover':
      ctl.push(btn('OPEN', `Open the ${n}`, () => doIt('open_cover')), btn('CLOSE', `Close the ${n}`, () => doIt('close_cover')));
      if (e.positionable && !e.guarded) ctl.push(range(`How far the ${n} is open, in percent`, e.position ?? 0, 100, (v) => doIt('set_cover_position', { position: v })));
      break;
    case 'media_player': {
      const playing = e.state === 'playing';
      ctl.push(btn(playing ? 'PAUSE' : 'PLAY', `${playing ? 'Pause' : 'Play'} the ${n}`, () => doIt(playing ? 'media_pause' : 'media_play'), playing ? 'on' : ''));
      if (e.volume !== undefined) ctl.push(range(`Volume of the ${n}, in percent`, e.volume * 100, 100, (v) => doIt('volume_set', { volume_level: v / 100 })));
      break;
    }
    case 'scene':
    case 'script':
      ctl.push(btn('RUN', `Run ${n}`, () => doIt('turn_on')));
      break;
    case 'vacuum':
      ctl.push(btn('START', `Start the ${n}`, () => doIt('start')), btn('HOME', `Send the ${n} home`, () => doIt('return_to_base')));
      break;
    case 'lock':
      ctl.push(btn('LOCK', `Lock the ${n}`, () => doIt('lock')), btn('UNLOCK', `Unlock the ${n} (asks your confirm)`, () => doIt('unlock'), 'warn'));
      break;
    case 'alarm_control_panel':
      ctl.push(btn('ARM', `Arm the ${n} at home (asks your confirm)`, () => doIt('alarm_arm_home')), btn('DISARM', `Disarm the ${n} (asks your confirm)`, () => doIt('alarm_disarm'), 'warn'));
      break;
    default:
  }
  const when = sinceWords(e);
  const down = isDown(e);
  const pinned = pins().includes(e.id);
  const pin = btn(pinned ? '★' : '☆', pinned ? `Unpin the ${n}` : `Pin the ${n} to the top`, () => setPin(e.id, !pinned), `housepin${pinned ? ' on' : ''}`);
  pin.setAttribute('aria-pressed', String(pinned));
  return h(`div.housecard${e.guarded ? '.guarded' : ''}${down ? '.down' : ''}` as 'div', { dataset: { entity: e.id, domain: e.domain }, role: 'group', 'aria-label': `${n}: ${stateWords(e)}${e.guarded ? ', needs your tap and a confirm' : ''}` },
    h('div.househd', h('div.househead', h('b', n), h('span.housestate', stateWords(e)), when && !down ? h('small', when) : null), pin),
    e.guarded ? h('small.houseguard', 'Your tap and a confirm, every time; never a scheduled job') : null,
    down ? h('small.housedown', DOWN_LINE) : ctl.length ? h('div.housectl', ...ctl) : null,
  );
}

function paint(root: HTMLElement): void {
  const st = houseNow.get();
  const v: HouseView | null = st.view;
  const refresh = btn('REFRESH', 'Read the house again', () => void loadHouse(true));
  stopRead?.();
  stopRead = null;
  if (!v) {
    /* state: house.house loading */
    /* state: house.house offline */
    clear(root, refresh);
    if (st.offline) root.prepend(h('p.note', { dataset: { state: 'offline', case: 'keep' }, role: 'status' }, BRAIN_OUT));
    else stopRead = waiting(root, READING);
    return;
  }
  if (!v.linked) {
    clear(root,
      h('p.houseintro', 'Anything smart in your house — lights, the heating (underfloor or central), blinds, the TV and speakers — through your own free Home Assistant box. Nothing paid is needed.'),
      h('ol.housesteps', ...HOUSE_STEPS.map((s) => h('li', s))),
      h('div.row.wrap.houseacts', btn('GO TO KEYS', 'Open SYSTEM, KEYS, to paste your address and token', () => void import('../shell/launcher').then((l) => {
        open?.close();
        l.perform({ open: 'system', panel: 'KEYS' });
      }))),
    );
    return;
  }
  const list = v.entities;
  const room = (e: HouseEntity) => e.area || 'Elsewhere';
  const rooms = new Map<string, HouseEntity[]>();
  for (const e of list) if (e.domain !== 'scene' && e.domain !== 'script') rooms.set(room(e), [...(rooms.get(room(e)) ?? []), e]);
  const names = [...rooms.keys()].sort((a, b) => (a === 'Elsewhere' ? 1 : b === 'Elsewhere' ? -1 : a.localeCompare(b)));
  const scenes = list.filter((e) => e.domain === 'scene' || e.domain === 'script');
  const mine = pins();
  const pinned = mine.map((id) => list.find((e) => e.id === id)).filter((e): e is HouseEntity => !!e);
  const offKey = (where: string, label: string) => {
    const b = btn('ALL OFF', label, () => void allOff(list, where), 'houseoff');
    return b;
  };
  const glanceRows = glance(list);
  const anyOn = list.some(isOnNow);
  clear(root,
    h('div.housetop', h('p.houseline', { role: 'status' }, v.line || 'Your house'), refresh),
    st.offline ? h('p.note', { dataset: { state: 'offline', case: 'keep' }, role: 'status' }, BRAIN_STALE) : null,
    /* state: house.house error */
    v.error ? h('p.note.bad', { dataset: { state: 'error', case: 'keep' }, role: 'status' }, v.stale ? `${v.error} ${BOX_STALE}` : v.error) : null,
    /* state: house.house empty */
    !list.length && !v.error ? h('div.empty', { dataset: { state: 'empty', case: 'keep' } }, h('b', HOUSE_NONE.head), h('span', HOUSE_NONE.line)) : null,
    glanceRows.length
      ? h('section.houseglance', { 'aria-label': 'Your house at a glance' },
          h('div.houseglhead', h('h4', 'AT A GLANCE'), anyOn ? offKey('', 'Turn off every light, fan and TV on in the house (never a lock, the alarm, a garage door or a switch)') : null),
          ...glanceRows.map((g) => h(`div.houseglrow.gl-${g.key}` as 'div', { dataset: { glance: g.key } }, h('small', g.label), h('span', g.line))))
      : null,
    scenes.length
      ? h('section.housescenes', { 'aria-label': 'Scenes and scripts' },
          h('h4', 'SCENES'),
          h('div.housescenerow', ...scenes.map((e) => {
            const b = btn(e.name, `Run ${e.name}${e.guarded ? ' (asks your confirm)' : ''}`, () => void houseDo(e, 'turn_on'), `housescene${e.guarded ? ' guarded' : ''}`);
            b.dataset.entity = e.id;
            return b;
          })),
          h('small.housescenenote', SCENES_NOTE))
      : null,
    pinned.length ? h('section.houseroom.housepins', { 'aria-label': 'Pinned' }, h('h4', h('span', 'PINNED')), ...pinned.map((e) => card(e, v.marked))) : null,
    ...names.map((r) => {
      const things = rooms.get(r)!;
      const temp = things.find((e) => e.domain === 'sensor' && (e.cls === 'temperature' || e.unit === '°C'));
      const on = r !== 'Elsewhere' && roomOff(things, '').length > 0;
      return h('section.houseroom', { 'aria-label': r }, h('h4', h('span', r), temp ? h('small', stateWords(temp)) : null, on ? offKey(r, `Turn off every light, fan and TV on in the ${r}`) : null), ...things.map((e) => card(e, v.marked)));
    }),
    h('p.note.housefoot', 'Locks, alarms, garage doors and gates — and any switch you mark — need your tap and a confirm, every time, and never act on a schedule. A scene that sets one asks too. ALL OFF turns off lights, fans and TVs only. Everything I do here is in WHY and in “what did you do today”.'),
  );
}

/** Open the HOUSE sheet (read fresh). */
export function openHouse(): void {
  if (open) return void loadHouse(true);
  const s = houseScreen();
  open = modal(HOUSE_TITLE, s.el, () => {
    s.stop();
    open = null;
  });
}

/** The house, read fresh and kept up to date while it is shown (the sheet's page, and the HOUSE screen's: features/house/index.ts). */
export function houseScreen(): { el: HTMLElement; stop(): void } {
  const root = h('div.house');
  const off = houseNow.subscribe(() => paint(root));
  paint(root);
  void loadHouse(true);
  return { el: root, stop: off };
}
