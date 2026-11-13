/**
 * The chat's words for FURTHER (BRIEF-OCT-IDEAS-3), answered on the phone with no model (the phrases registry, assistant/phrases.ts
 * `further`): "interpreter" and "translate for us", "what do you know?", "walk me through <screen>", "what changed?", "rehearse …".
 * Each opens the thing and says one sentence about it.
 */
import { navTo } from '../shell/areas';
import { langName } from '../../../../packages/shared/src/scan';
import { changedAsked, interpreterAsked, mapAsked, rehearseAsked, walkAsked } from './words';

type Opts = { voice?: boolean; private?: boolean };
type Go = { id: string; ask: number; label: string; open?: string };
type Answer = (text: string, reply: string, local: { kind: 'further'; go?: Go[] }, opts: Opts) => true;

export async function furtherTurn(text: string, opts: Opts, answer: Answer): Promise<boolean> {
  const interp = interpreterAsked(text);
  if (interp) {
    navTo(interp.to ? `interpreter?to=${interp.to}` : 'interpreter', 'push');
    const other = interp.to ? langName(interp.to) : 'their language';
    return answer(text, `The interpreter is open. Hold your key and speak; the far half writes it and says it in ${other}, and they answer on theirs. Nothing is recorded.`, { kind: 'further', go: [{ id: 'screen:interpreter', ask: -1, label: 'Open the interpreter', open: 'interpreter' }] }, opts);
  }
  if (mapAsked(text)) {
    const { openMindMap } = await import('../features/further/mindmap');
    openMindMap();
    return answer(text, 'This is what I know about you, as a map: the nearest subjects are the biggest. Tap a dot to read it; KEEP it or FORGET it, and FORGET has UNDO.', { kind: 'further' }, opts);
  }
  const walk = walkAsked(text);
  if (walk) {
    const { startWalk } = await import('../features/further/walk');
    const r = await startWalk(walk.what);
    if (!r.ok) return answer(text, `I don’t know a screen called “${walk.what}” to walk you through. Try “walk me through the library”, or “walk me through learn” for a whole room.`, { kind: 'further' }, opts);
    return answer(text, `Walking you through ${r.name}: ${r.said} Press NEXT for the next one, DONE to stop.`, { kind: 'further' }, opts);
  }
  if (changedAsked(text)) {
    const c = await import('../further/changed');
    const lines = await c.refreshChanged();
    return answer(text, c.changedWords(lines, !!c.yesterdayMarks()), { kind: 'further' }, opts);
  }
  const re = rehearseAsked(text);
  if (re) {
    navTo(re.talk ? 'rehearse?talk' : re.situation ? `rehearse?situation=${encodeURIComponent(re.situation)}` : 'rehearse', 'push');
    const said = re.talk
      ? 'REHEARSE is open on A TALK FOR A MINUTE: talk for a minute, or type what you would say, and I give you your filler words, your pace and the one line to cut. Nothing is kept.'
      : re.situation
        ? `REHEARSE is open with “${re.situation}” as the situation. Press START and I play the other side for three rounds, then give you notes. Nothing is kept unless you tap KEEP.`
        : 'REHEARSE is open. Tell it the situation, press START, and I play the other side for three rounds, then give you notes. Nothing is kept unless you tap KEEP.';
    return answer(text, said, { kind: 'further', go: [{ id: 'screen:rehearse', ask: -1, label: 'Open Rehearse', open: 'rehearse' }] }, opts);
  }
  return false;
}
