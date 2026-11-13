/**
 * ASK GHOSTY in an editor (BRIEF-KERNEL-3): his words go to the brain with the open editor as the message's data, and the tool's
 * proposals come back as client events, each handed to `onProposal` to be marked in the editor. Nothing is applied here. The cloud
 * only: the phone's own brain has no such tool (said in his words when the cloud is off-limits).
 */
import { brain } from '../api/brain';
import { settings, timeZone } from '../state/app';
import type { WorkKind } from '../../../../packages/shared/src/openwork';
import { EVENT } from './live';

export async function askWork(kind: WorkKind, words: string, data: string, onProposal: (args: Record<string, unknown>) => void): Promise<{ proposed: number; text: string }> {
  if (settings.get().offlineBrain === 'always') throw new Error('this phone keeps everything on it (Offline brain: always), so my brain is not asked: use the editor’s own keys');
  let proposed = 0;
  let text = '';
  let failed = '';
  await brain.chat(words + data, { tz: timeZone, tab: kind, name: settings.get().name, now: new Date().toLocaleString('en-GB') }, (ev) => {
    if (ev.t === 'client' && ev.name === EVENT[kind]) {
      proposed++;
      onProposal((ev.args ?? {}) as Record<string, unknown>);
    } else if (ev.t === 'text') text += (text ? '\n\n' : '') + ev.text;
    else if (ev.t === 'error') failed = ev.message;
  });
  if (!proposed && !text && failed) throw new Error(failed);
  return { proposed, text: text.trim() };
}
