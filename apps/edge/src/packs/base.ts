/**
 * THE PACKS, the brain's common part (BRIEF-PACKS-1): what a pack's actions run with (his storage, a fetch, the clock and
 * his time zone), his kept lists, a capped page read, and `packTool` — ONE tool per pack with an `action` enum
 * (tools/money.ts, body.ts, kitchen.ts). A pack's cards go out as `pack_card` screen commands, so the chat's live cards are
 * drawn from them by code (packages/shared/src/cards.ts `cardsFromTool`), never from the model's words.
 */
import { localDay } from '../../../../packages/shared/src/cadence';
import type { Card } from '../../../../packages/shared/src/cards';
import type { PackOut } from '../../../../packages/shared/src/packs';
import { zoneOf } from '../guardstate';
import { arg, type Tool } from '../tools/types';

export interface PackDeps {
  storage: DurableObjectStorage;
  fetch: typeof fetch;
  now: () => number;
  /** His time zone (the phone's, kept by the brain). */
  tz: string;
}
export type ActionFn = (a: Record<string, unknown>, d: PackDeps) => Promise<PackOut>;

/** His local day (YYYY-MM-DD). */
export const todayOf = (d: Pick<PackDeps, 'now' | 'tz'>): string => localDay(d.now(), d.tz);

export async function load<T>(d: Pick<PackDeps, 'storage'>, key: string, fallback: T): Promise<T> {
  const v = await d.storage.get<T>(key).catch(() => undefined);
  return v === undefined || v === null ? fallback : v;
}
export const save = (d: Pick<PackDeps, 'storage'>, key: string, v: unknown): Promise<void> => d.storage.put(key, v);

export const UA = 'Mozilla/5.0 (compatible; GhostyAssistant/2.0; personal assistant)';

/** A page's text, at most `max` bytes, given up after `ms`. Throws in plain words. */
export async function getText(d: Pick<PackDeps, 'fetch'>, url: string, max = 1_500_000, ms = 9000): Promise<string> {
  const r = await d.fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json;q=0.9,*/*;q=0.5' }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`the page answered ${r.status}`);
  if (!r.body) return '';
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  while (size < max) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    parts.push(value);
    size += value.byteLength;
  }
  reader.cancel().catch(() => undefined);
  const all = new Uint8Array(Math.min(size, max));
  let at = 0;
  for (const p of parts) {
    const piece = p.subarray(0, Math.max(0, all.length - at));
    all.set(piece, at);
    at += piece.length;
  }
  return new TextDecoder().decode(all);
}
export const getJson = async (d: Pick<PackDeps, 'fetch'>, url: string, max?: number, ms?: number): Promise<unknown> => JSON.parse(await getText(d, url, max, ms));

/** The words he gave for an action (the `words` argument), trimmed; '' when none. */
export const wordsOf = (a: Record<string, unknown>): string => arg.str(a, 'words', false).trim().slice(0, 600);

/**
 * One pack as one tool: `action` picks the ability; its answer is the text the model reads, its cards go to the chat (and
 * Telegram, as text), and a screen it opens (open_body, open_kitchen, kitchen_timer) is sent to the phone. `pure`: the
 * actions that only read.
 */
export function packTool(o: { name: string; description: string; actions: Record<string, ActionFn>; properties: Record<string, unknown>; reads: string[] }): Tool {
  const names = Object.keys(o.actions);
  return {
    name: o.name,
    description: o.description,
    parameters: { type: 'object', properties: { action: { type: 'string', enum: names }, ...o.properties }, required: ['action'] },
    risk: 'auto',
    pure: (a) => o.reads.includes(String(a.action)),
    async run(a, ctx) {
      const action = String(a.action ?? '');
      const fn = o.actions[action];
      if (!fn) throw new Error(`${o.name} has no action "${action}": ${names.join(', ')}`);
      // unattended (a scheduled task, a project's step): only the actions that read — nothing kept, watched or reminded
      if (ctx.unattended && !o.reads.includes(action)) throw new Error(`${o.name} ${action} changes what he keeps, so it waits for him: not from a scheduled task`);
      const out = await fn(a, { storage: ctx.storage, fetch: (u, i) => fetch(u, i), now: () => Date.now(), tz: await zoneOf(ctx.storage) });
      for (const c of out.cards ?? []) ctx.emit({ t: 'client', name: 'pack_card', args: { card: c } });
      if (out.open) ctx.emit({ t: 'client', name: out.open.name, args: out.open.args });
      return out.text;
    },
  };
}

/** Run one pack action with no model (the phone's buttons: UNDO, a glass of water, a tick): POST /packs/do. */
export async function runAction(packs: Record<string, Record<string, ActionFn>>, pack: string, action: string, a: Record<string, unknown>, d: PackDeps): Promise<PackOut> {
  const fn = packs[pack]?.[action];
  if (!fn) throw new Error(`no ${pack} action "${action}"`);
  return fn(a, d);
}

export type { Card, PackOut };
