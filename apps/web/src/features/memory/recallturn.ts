/**
 * [recall] The chat's two asks of BRIEF-DEPTH-MEMORY, answered on the phone (assistant/local.ts dispatches here):
 *  - "what did I ask you about trains?" / "find garden in my things": the phone's own index (recall.ts), no model, no network.
 *    Cold (never built) and online: it lets the brain answer with its `recall` tool instead (false), so the question is never lost;
 *    cold and offline: "Still reading your things; ask me again in a minute.";
 *  - "remind me to chase this if Sam doesn't reply by Thursday": a chase on the brain (the one watcher system, kind `reply`), its
 *    one sentence back, WATCHERS under PLAN listing it.
 */
import { chaseAsked, chasingAsked, chaseDay, recallAsked } from '../../../../../packages/shared/src/recall';
import { findAsked } from '../../assistant/phrases';
import type { LocalAnswer } from '../../assistant/local';
import { brain } from '../../api/brain';
import { needsAnswer } from '../../../../../packages/shared/src/lifeeasier';
import { timeZone } from '../../state/app';
import { sayError } from '../../ui/hisWords';
import { buildIndex, findLocal, recallWarm } from './recall';
import { CHASE_LIST_OFFLINE, CHASE_OFFLINE, CHASING_NONE, chasingLine, findHead, findNone, RECALL_COLD, recallHead, recallNone } from './words';

type Opts = { voice?: boolean; private?: boolean };
type Answer = (text: string, reply: string, local: LocalAnswer, opts: Opts) => true;

export async function recallTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const about = recallAsked(text);
  const q = about ?? findAsked(text);
  if (!q) return false;
  if (!(await recallWarm())) {
    // cold: online, the brain's `recall` answers; offline, say so plainly and start reading
    void buildIndex().catch(() => undefined);
    if (navigator.onLine && about) return false;
    return answer(text, RECALL_COLD, { kind: 'recall' }, opts);
  }
  const found = await findLocal(q, { turns: !!about });
  const rows = found.map((f) => ({ key: f.key, ...(f.bid ? { bid: f.bid } : {}), kind: f.kind, id: f.id, title: f.title, line: f.line, at: f.at, stamp: f.stamp, day: f.day }));
  if (about) {
    if (!found.length) return answer(text, recallNone(about), { kind: 'recall' }, opts);
    const top = found.slice(0, 3).map((f) => `${f.day[0]!.toUpperCase()}${f.day.slice(1)} (${f.stamp}): “${f.line.slice(0, 80)}”`);
    return answer(text, [recallHead(found.length, about), ...top].join('\n'), { kind: 'recall', found: rows }, opts);
  }
  if (!found.length) return answer(text, findNone(q), { kind: 'recall' }, opts);
  return answer(text, findHead(found.length, q), { kind: 'recall', found: rows }, opts);
}

/** The Brief's mail from the person he named (by name or address), the newest first; with no name, the one mail needing an answer if there is just one. */
async function mailFrom(who: string): Promise<{ name: string; address: string; subject: string } | null> {
  const r = await Promise.race([brain.mailInbox().catch(() => null), new Promise<null>((ok) => setTimeout(() => ok(null), 4000))]);
  if (!r?.linked || !r.messages.length) return null;
  const w = who.toLowerCase();
  const hit = w ? r.messages.find((m) => `${m.name} ${m.address}`.toLowerCase().split(/[^a-z0-9.'-]+/).includes(w) || m.name.toLowerCase().startsWith(w)) : r.messages.filter(needsAnswer).length === 1 ? r.messages.filter(needsAnswer)[0] : undefined;
  return hit ? { name: (hit.name || hit.address).split(/\s+/)[0]!, address: hit.address, subject: hit.subject } : null;
}

export async function chaseTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const go: LocalAnswer['go'] = [{ id: 'screen:agenda', ask: -1, label: 'See my watchers', open: 'agenda', panel: 'WATCHERS' }];
  // "what are you chasing?": the chases still waiting, each with its morning
  if (chasingAsked(text)) {
    const r = await Promise.race([brain.watchers().catch(() => null), new Promise<null>((ok) => setTimeout(() => ok(null), 6000))]);
    if (!r) return answer(text, CHASE_LIST_OFFLINE, { kind: 'watcher' }, opts);
    const live = r.watchers.filter((w) => w.kind === 'reply' && w.state === 'watching');
    return answer(text, live.length ? chasingLine(live.map((w) => `${w.who || 'a reply'} by ${w.by ? chaseDay(w.by, timeZone) : 'its day'}`)) : CHASING_NONE, { kind: 'watcher', go }, opts);
  }
  const c = chaseAsked(text);
  if (!c) return false;
  // "this": the mail the Brief shows from the person he named (the same inbox the Brief reads; nothing new is fetched or read)
  const mail = await mailFrom(c.who);
  try {
    const r = await Promise.race([brain.chaseAdd({ kind: 'reply', who: c.who || mail?.name || '', day: c.day, about: mail?.subject ?? '', ...(mail?.address ? { from: mail.address } : {}), tz: timeZone }), new Promise<null>((ok) => setTimeout(() => ok(null), 8000))]);
    if (!r) return answer(text, CHASE_OFFLINE, { kind: 'watcher' }, opts);
    return answer(text, r.said, { kind: 'watcher', go }, opts);
  } catch (e) {
    return answer(text, navigator.onLine ? sayError(e, 'set that chase') : CHASE_OFFLINE, { kind: 'watcher' }, opts);
  }
}
