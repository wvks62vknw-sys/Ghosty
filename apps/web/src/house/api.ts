/**
 * The phone's side of THE HOME ASSISTANT BRIDGE (BRIEF-REST-D 2): it only ever talks to my brain (apps/edge/src/house.ts),
 * which alone talks to his box; the address and the token never come here. His things as the brain reads them (kept a few
 * seconds, so the sheet and the chat's words share one read), an action from his tap or his words, a switch marked "needs
 * my word". His things' names are handed to the words (packages/shared/src/house.ts `setHouseNames`) so his own names work.
 */
import { headers } from '../api/brain';
import { createStore } from '../core/store';
import { setHouseNames, type HouseEntity } from '../../../../packages/shared/src/house';

export interface HouseView {
  linked: boolean;
  entities: HouseEntity[];
  line: string;
  marked: string[];
  at: number;
  error?: string;
}
export interface ActOut {
  ok: boolean;
  text: string;
  needs?: 'confirm';
  refused?: boolean;
  entity?: string;
}

/** The house as last read, and whether the brain could be reached. */
export const houseNow = createStore<{ view: HouseView | null; at: number; offline: boolean }>({ view: null, at: 0, offline: false });

/** His house now (null: my brain cannot be reached). */
export async function loadHouse(fresh = false): Promise<HouseView | null> {
  const held = houseNow.get();
  if (!fresh && held.view && Date.now() - held.at < 8000) return held.view;
  try {
    const r = await fetch(`/api/house${fresh ? '?fresh=1' : ''}`, { headers: headers(), credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const v = (await r.json()) as HouseView;
    setHouseNames([...v.entities.map((e) => e.name), ...v.entities.map((e) => e.area).filter(Boolean)]);
    houseNow.set({ view: v, at: Date.now(), offline: false });
    return v;
  } catch {
    houseNow.set({ offline: true });
    return null;
  }
}

/** One action: from his tap (with his confirm for the guarded set) or his words. The house is read again after. */
export async function act(entity: string, service: string, data: Record<string, unknown>, o: { origin: 'tap' | 'chat'; confirm?: boolean; why?: string }): Promise<ActOut> {
  try {
    const r = await fetch('/api/house/act', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), credentials: 'same-origin', body: JSON.stringify({ entity, service, data, origin: o.origin, confirm: o.confirm === true, why: o.why ?? '' }) });
    const out = (await r.json()) as ActOut;
    void loadHouse(true);
    return out;
  } catch {
    return { ok: false, text: 'I can’t reach my brain right now, so I can’t reach your house.' };
  }
}

/** A switch that needs his word (or no longer does). */
export async function mark(entity: string, on: boolean): Promise<string[] | null> {
  try {
    const r = await fetch('/api/house/mark', { method: 'POST', headers: headers({ 'content-type': 'application/json' }), credentials: 'same-origin', body: JSON.stringify({ entity, on }) });
    const j = (await r.json()) as { marked?: string[] };
    void loadHouse(true);
    return j.marked ?? null;
  } catch {
    return null;
  }
}
