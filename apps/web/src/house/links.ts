/**
 * LINKS → HOME ASSISTANT (BRIEF-REST-D 2): unlinked, his side in steps — his own free Home Assistant box, reachable over
 * HTTPS with the free DuckDNS and Let's Encrypt add-on, one port forwarded, a long-lived token, both pasted in SYSTEM → KEYS
 * → HOME ASSISTANT (the token stays in my vault) — and GO TO KEYS; linked, the house in a line and OPEN THE HOUSE.
 */
import { clear, h } from '../core/dom';
import { button, row, type Panel } from '../ui/components';
import { HOUSE_STEPS } from '../../../../packages/shared/src/house';
import { loadHouse } from './api';

const goKeys = () => void import('../shell/launcher').then((l) => l.perform({ open: 'system', panel: 'KEYS' }));
const openSheet = () => void import('./sheet').then((s) => s.openHouse());

export async function paintHouseLink(p: Panel): Promise<boolean> {
  const v = await loadHouse();
  const keys = button('GO TO KEYS', goKeys);
  keys.setAttribute('aria-label', 'Open SYSTEM, KEYS, for your Home Assistant address and token');
  const sheet = button('OPEN THE HOUSE', openSheet, 'on');
  clear(p.body);
  if (v?.linked && !v.error) {
    p.setStatus('LINKED', 'ok');
    p.body.append(
      row('YOUR HOUSE', v.line || `${v.entities.length} things`),
      h('div.note', 'Say “turn off the hall light”, “set the heating to 21” or “is the back door open?”. Locks, alarms, garage doors and gates need your own tap and a confirm, every time, and never act on a schedule.'),
      h('div.keyrow', sheet, keys),
    );
    return true;
  }
  p.setStatus(v ? (v.error ? 'CHECK' : 'NOT LINKED') : 'OFFLINE', 'mid');
  p.body.append(
    h('div.note', 'Anything smart in your house — lights, the heating (underfloor or central), blinds, the TV and speakers — through your own free Home Assistant box. Nothing paid is needed.'),
    ...(v?.error ? [h('div.note.bad', v.error)] : []),
    h('ol.housesteps', ...HOUSE_STEPS.map((s) => h('li', s))),
    h('div.keyrow', keys, ...(v?.linked ? [sheet] : [])),
  );
  return false;
}
