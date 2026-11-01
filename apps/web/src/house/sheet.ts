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
import { HOUSE_STEPS, stateWords, type HouseEntity } from '../../../../packages/shared/src/house';
import { act, houseNow, loadHouse, mark, type ActOut, type HouseView } from './api';

let open: { close(): void } | null = null;

const VERBS: Record<string, string> = { turn_on: 'turn on', turn_off: 'turn off', toggle: 'switch', open_cover: 'open', close_cover: 'close', stop_cover: 'stop', set_cover_position: 'move', lock: 'lock', unlock: 'unlock', open: 'open', alarm_disarm: 'disarm', alarm_arm_home: 'arm', alarm_arm_away: 'arm', media_play: 'play', media_pause: 'pause', set_temperature: 'set', set_hvac_mode: 'set', start: 'start', return_to_base: 'send home' };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const ago = (ms: number) => {
  if (!ms) return '';
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? 'changed just now' : m < 60 ? `changed ${m} min ago` : m < 1440 ? `changed ${Math.round(m / 60)} h ago` : `changed ${Math.round(m / 1440)} days ago`;
};

/** One action from his tap: the guarded set asks his confirm first, every time. */
export async function houseDo(e: Pick<HouseEntity, 'id' | 'name' | 'domain'> & { guarded?: boolean }, service: string, data: Record<string, unknown> = {}, said = ''): Promise<ActOut | null> {
  let confirm = false;
  if (e.guarded) {
    const verb = VERBS[service] ?? service.replace(/_/g, ' ');
    const ok = await confirmSheet(`${cap(verb)} the ${e.name}?`, `The ${e.name} is in the guarded set (a lock, an alarm, a garage door or gate, or a switch you marked): it needs your tap and this confirm every time, and no scheduled job ever touches it.`, `${verb.toUpperCase()} IT`);
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
  const when = ago(e.changed);
  return h(`div.housecard${e.guarded ? '.guarded' : ''}` as 'div', { dataset: { entity: e.id, domain: e.domain }, role: 'group', 'aria-label': `${n}: ${stateWords(e)}${e.guarded ? ', needs your tap and a confirm' : ''}` },
    h('div.househead', h('b', n), h('span.housestate', stateWords(e)), when ? h('small', when) : null),
    e.guarded ? h('small.houseguard', 'Your tap and a confirm, every time; never a scheduled job') : null,
    ctl.length ? h('div.housectl', ...ctl) : null,
  );
}

function paint(root: HTMLElement): void {
  const st = houseNow.get();
  const v: HouseView | null = st.view;
  const refresh = btn('REFRESH', 'Read the house again', () => void loadHouse(true));
  if (!v) {
    clear(root, h('p.note', st.offline ? 'I can’t reach my brain right now, so I can’t reach your house.' : 'Reading your house…'), refresh);
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
  const rooms = new Map<string, HouseEntity[]>();
  for (const e of v.entities) rooms.set(e.area || 'Elsewhere', [...(rooms.get(e.area || 'Elsewhere') ?? []), e]);
  const names = [...rooms.keys()].sort((a, b) => (a === 'Elsewhere' ? 1 : b === 'Elsewhere' ? -1 : a.localeCompare(b)));
  clear(root,
    h('div.housetop', h('p.houseline', { role: 'status' }, v.line || 'Your house'), refresh),
    v.error ? h('p.note.bad', v.error) : null,
    ...names.map((room) => {
      const list = rooms.get(room)!;
      const temp = list.find((e) => e.domain === 'sensor' && (e.cls === 'temperature' || e.unit === '°C'));
      return h('section.houseroom', { 'aria-label': room }, h('h4', h('span', room), temp ? h('small', stateWords(temp)) : null), ...list.map((e) => card(e, v.marked)));
    }),
    h('p.note.housefoot', 'Locks, alarms, garage doors and gates — and any switch you mark — need your tap and a confirm, every time, and never act on a schedule. Everything I do here is in WHY and in “what did you do today”.'),
  );
}

/** Open the HOUSE sheet (read fresh). */
export function openHouse(): void {
  if (open) return void loadHouse(true);
  const root = h('div.house');
  const off = houseNow.subscribe(() => paint(root));
  paint(root);
  open = modal('HOUSE', root, () => {
    off();
    open = null;
  });
  void loadHouse(true);
}
