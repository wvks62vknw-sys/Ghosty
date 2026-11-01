/**
 * His house from the chat, with no model (BRIEF-REST-D 2; the phrases registry, assistant/phrases.ts `house`): "turn
 * (on|off) the …", "dim the … to 40", "set the heating to 21", "is the … (on|off|open|closed)?", "what's the temperature
 * in the …?", "pause the telly", "close the blinds", "the house". Names are matched to his things' names and rooms
 * (packages/shared/src/house.ts `resolveAsk`): two that match get "which one?" with a button each; a lock, an alarm, a
 * garage door or gate gets a button that asks his confirm, never an action from words alone. Unlinked: "Link your Home
 * Assistant first — it's in LINKS."
 */
import { houseAsked, NOT_LINKED, resolveAsk, type HouseEntity } from '../../../../packages/shared/src/house';
import { act, loadHouse } from './api';

type Opts = { voice?: boolean; private?: boolean };
type Go = { id: string; ask: number; label: string; run?: string; args?: Record<string, unknown>; open?: string };
type Answer = (text: string, reply: string, local: { kind: 'pack'; go?: Go[] }, opts: Opts) => true;

const OPEN: Go = { id: 'phrase:house', ask: -1, label: 'OPEN THE HOUSE', run: 'open_house', args: {} };
const VERB: Record<string, string> = { unlock: 'UNLOCK', lock: 'LOCK', open_cover: 'OPEN', close_cover: 'CLOSE', turn_on: 'TURN ON', turn_off: 'TURN OFF', alarm_disarm: 'DISARM' };

/** A button that does it on his tap (the guarded set asks his confirm first). */
const doGo = (e: HouseEntity, service: string, data: Record<string, unknown>, said: string, label: string): Go => ({ id: 'phrase:house', ask: -1, label, run: 'house_do', args: { entity: e.id, name: e.name, domain: e.domain, guarded: !!e.guarded, service, data, said } });

export async function houseTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const ask = houseAsked(text);
  if (!ask) return false;
  let v = await loadHouse();
  // (an "unlinked" read a moment old is read again: he may have just pasted the key)
  if (v && !v.linked) v = await loadHouse(true);
  if (!v) return answer(text, 'I can’t reach my brain right now, so I can’t reach your house.', { kind: 'pack' }, opts);
  if (!v.linked) return answer(text, NOT_LINKED, { kind: 'pack', go: [{ id: 'panel:links:HOME ASSISTANT', ask: -1, label: 'OPEN LINKS', open: 'links' }] }, opts);
  if (v.error) return answer(text, v.error, { kind: 'pack', go: [OPEN] }, opts);
  if (ask.kind === 'sheet') {
    void import('./sheet').then((s) => s.openHouse());
    return answer(text, `Your house: ${v.line}.`, { kind: 'pack', go: [OPEN] }, opts);
  }
  const r = resolveAsk(ask, v.entities, v.marked);
  if (r.kind === 'answer' || r.kind === 'none') return answer(text, r.text, { kind: 'pack', go: [OPEN] }, opts);
  if (r.kind === 'which') return answer(text, r.text, { kind: 'pack', go: r.options.map((o) => doGo(o.entity, o.service, o.data, text, `${o.entity.name}${o.entity.area && !o.entity.name.includes(o.entity.area) ? ` (${o.entity.area})` : ''}`.toUpperCase())) }, opts);
  // the guarded set: never from words alone; a button that asks his confirm
  if (r.guarded) return answer(text, `The ${r.entity.name} needs your own tap, with a confirm, every time: words alone never ${r.verb} it.`, { kind: 'pack', go: [doGo(r.entity, r.service, r.data, text, `${VERB[r.service] ?? r.verb.toUpperCase()} THE ${r.entity.name.toUpperCase()}`)] }, opts);
  const out = await act(r.entity.id, r.service, r.data, { origin: 'chat', why: text });
  return answer(text, out.text, { kind: 'pack', go: [OPEN] }, opts);
}
