/**
 * WHY did you do that (OWNER-ISSUES 67d): every turn's trail, kept by the brain from the events it already sends — the tools
 * that ran, their arguments in plain words, how each went, and what he said — so "why?" on Telegram (and anywhere the
 * brain is asked) is answered in plain words with no model and no new prompt line. The reason is derived, never asked for:
 * from the tool's ability ("you asked about “trains”, and I can plan door-to-door journeys…") and, when his reply gave one,
 * his own words (packages/shared/src/abilities.ts `whyLines`).
 *
 * `why:turns` keeps the last 30 turns of the last two days (one write per turn); what he did today reads it too (today.ts).
 * A turn that checked a number plate keeps no plate and none of the reply (the record is shown once and never kept).
 */
import type { ChatEvent } from '../../../packages/shared/src/protocol';
import { argWords, whyAsked, whyLines, type Trail } from '../../../packages/shared/src/abilities';
import { brainAbilities } from './abilities';

export const WHY_KEY = 'why:turns';
const KEEP = 30;
const KEEP_MS = 2 * 86_400_000;

/** One turn's trail as it happens: note every event the turn sends; `trail()` is what it did, when it is over. */
export function trailRecorder(asked: string, now = Date.now()) {
  const t: Trail = { at: now, asked: asked.replace(/\s+/g, ' ').trim().slice(0, 400), steps: [] };
  const byId = new Map<string, Trail['steps'][number]>();
  let said = '';
  let plate = false;
  return {
    note(ev: ChatEvent): void {
      if (ev.t === 'tool' || ev.t === 'approval') {
        if (ev.name === 'vehicle_check') plate = true;
        let s = byId.get(ev.id);
        if (!s) {
          s = { tool: ev.name, args: argWords(ev.args), ok: null };
          byId.set(ev.id, s);
          t.steps.push(s);
        }
        if (ev.t === 'approval') s.note = 'waiting for your approval';
      } else if (ev.t === 'tool_result') {
        const s = byId.get(ev.id) ?? { tool: ev.name, ok: null };
        if (!byId.has(ev.id)) {
          byId.set(ev.id, s);
          t.steps.push(s);
        }
        s.ok = ev.ok;
        s.note = ev.ok ? undefined : ev.summary.replace(/^Error:\s*/, '').replace(/\s+/g, ' ').slice(0, 160);
      } else if (ev.t === 'text') said = `${said}${said ? '\n' : ''}${ev.text}`.slice(0, 1200);
    },
    trail(): Trail {
      // a plate is never kept: not in the question, not in the reply
      return plate ? { ...t, asked: 'a question about a vehicle', said: undefined } : { ...t, ...(said ? { said } : {}) };
    },
  };
}

export async function loadTrails(storage: DurableObjectStorage): Promise<Trail[]> {
  return (await storage.get<Trail[]>(WHY_KEY)) ?? [];
}

/** Keep a finished turn's trail (the newest last; at most 30, none older than two days). */
export async function keepTrail(storage: DurableObjectStorage, t: Trail, now = Date.now()): Promise<void> {
  if (!t.asked && !t.steps.length) return;
  const list = (await loadTrails(storage)).filter((x) => now - x.at <= KEEP_MS);
  list.push(t);
  await storage.put(WHY_KEY, list.slice(-KEEP));
}

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });

/** GET /why: the kept trails, for the phone's WHY on a reply whose steps it no longer holds (it was closed since). */
export async function whyRoute(method: string, storage: DurableObjectStorage): Promise<Response> {
  if (method !== 'GET') return json({ error: 'not found' }, 404);
  return json({ trails: await loadTrails(storage) });
}

/**
 * "why?" answered from the last turn's trail, in plain words; null when it is better left to the model: a bare "why?" after a
 * reply that ran nothing (then it is about what was said, not what was done), or no turn kept at all.
 */
export async function whyReply(storage: DurableObjectStorage, text: string): Promise<string | null> {
  const asked = whyAsked(text);
  if (!asked) return null;
  const last = (await loadTrails(storage)).at(-1);
  if (!last || (asked === 'bare' && !last.steps.length)) return null;
  return [`Why I did that:`, ...whyLines(last, brainAbilities(() => true))].join('\n');
}
