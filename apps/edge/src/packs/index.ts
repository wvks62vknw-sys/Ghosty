/**
 * THE PACKS on the brain's clock and the phone's buttons (BRIEF-PACKS-1): the phone runs a pack action with no model
 * (POST /packs/do — a card's UNDO, a glass of water, a tick on the shopping list, a run saved), the follow job reads the
 * watched prices (tools/money.ts), the Brief gets the packs' lines (mind.ts `packs`), and speaking first (speak.ts) gets
 * their pieces under the cadence. Nothing here asks a model.
 *   POST /packs/do { pack, action, args } → { text, cards?, data? }
 */
import type { Card } from '../../../../packages/shared/src/cards';
import { PACKS } from '../../../../packages/shared/src/packs';
import { zoneOf } from '../guardstate';
import { followTick, MONEY, moneyLines } from '../tools/money';
import { runAction, type ActionFn, type PackDeps } from './base';

/** Every pack's actions, by pack: what /packs/do may run. */
export const PACK_ACTIONS: Record<string, Record<string, ActionFn>> = { money: MONEY };

export interface PacksDeps {
  storage: DurableObjectStorage;
  /** agent.ts notify: the inbox, his phone and his Telegram, with the card. */
  notify(item: { kind: 'task'; title: string; text: string; card: Card }): Promise<unknown>;
  fetch?: typeof fetch;
  now?: () => number;
}

async function depsOf(d: Pick<PacksDeps, 'storage' | 'fetch' | 'now'>): Promise<PackDeps> {
  return { storage: d.storage, fetch: d.fetch ?? ((u, i) => fetch(u, i)), now: d.now ?? (() => Date.now()), tz: await zoneOf(d.storage) };
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function packsRoute(req: Request, path: string, method: string, d: PacksDeps): Promise<Response> {
  if (path === '/packs/do' && method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { pack?: unknown; action?: unknown; args?: unknown };
    const pack = String(b.pack ?? '');
    if (!(PACKS as readonly string[]).includes(pack)) return json({ error: 'no such pack' }, 400);
    try {
      const out = await runAction(PACK_ACTIONS, pack, String(b.action ?? ''), b.args && typeof b.args === 'object' ? (b.args as Record<string, unknown>) : {}, await depsOf(d));
      return json(out);
    } catch (e) {
      return json({ error: (e as Error).message }, 400);
    }
  }
  return json({ error: 'not found' }, 404);
}

/** The follow job's look (agent.ts): the watched prices; says when to come back. */
export async function packsTick(d: PacksDeps): Promise<number> {
  return followTick(await depsOf(d), (title, text, card) => d.notify({ kind: 'task', title, text, card }));
}

/** The Brief's lines from the packs (mind.ts): payday, a renewal tomorrow, a warranty ending soon… Never in the prompt. */
export async function packLines(d: Pick<PacksDeps, 'storage' | 'now'>): Promise<string[]> {
  const deps = await depsOf(d);
  const all = await Promise.all([moneyLines(deps)].map((p) => p.catch(() => [] as string[])));
  return all.flat().slice(0, 6);
}
