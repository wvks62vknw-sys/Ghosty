/**
 * SPOKEN NOTES KEPT AS HIS (NEXT ROUND, voice.s9, with ci.s4 "voice notes turned into text"). "Note: buy milk", "note to self, call the
 * garage", "jot this down: the boiler code is in the drawer" — written down and kept in his memory (Memory → Things you told me):
 *   - said aloud, and the phone sure the voice was his: kept, marked "by you, said aloud";
 *   - typed: kept as he typed it;
 *   - said in a voice he introduced, one it doesn't know, or one it isn't sure of: not kept, and said why (never a lock: he can type it).
 * Kept through the brain's memory queue, so a note said with no signal is kept when the brain is back.
 */
import { NOTE_ASK } from './phrases';
import { brain } from '../api/brain';
import type { Label } from './voiceknown';
import type { LocalAnswer } from './local';

type Answer = (text: string, reply: string, local: LocalAnswer, opts: { voice?: boolean; private?: boolean }) => true;

const day = (now: number) => new Date(now).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export async function noteTurn(text: string, opts: { voice?: boolean; private?: boolean; who?: Label }, answer: Answer, now = Date.now()): Promise<boolean> {
  const m = NOTE_ASK.exec(text.trim());
  const note = m?.[1]?.trim().replace(/[.!]+$/, '');
  if (!note) return false;
  // (a turn kept on the phone, the offline brain set to "always" or asked here: nothing of it goes to the brain, not even as a note, so
  // the phone's own model answers it as before; onphone.spec's marker proves nothing leaves)
  if (opts.private) return false;
  const go: LocalAnswer['go'] = [{ id: 'screen:memory', ask: -1, label: 'Open Memory', open: 'memory' }];
  if (opts.voice) {
    // (this turn's own label only: the talk bar's tag can still be an earlier turn's when this one was too short to judge, review fix)
    const who: Label | undefined = opts.who;
    if (who !== 'owner') {
      /* state: core.note unsure */
      const why = !who ? 'I couldn’t tell whose voice that was' : who === 'unsure' ? 'I wasn’t sure that was you' : who === 'unknown' ? 'that wasn’t a voice I know' : 'that was someone else’s voice';
      return answer(text, `Not kept: ${why}, and I only keep a spoken note when I’m sure it’s you. Type it and I’ll keep it.`, { kind: 'can' }, opts);
    }
  }
  const kept = opts.voice ? `${note} (a note by you, said aloud on ${day(now)})` : `${note} (a note you typed on ${day(now)})`;
  try {
    await brain.addMemory(kept);
  } catch {
    /* state: core.note error */
    return answer(text, 'I couldn’t keep that note just now. Say it again in a moment.', { kind: 'can' }, opts);
  }
  return answer(text, opts.voice ? `Kept, by you: “${note}”. It’s in Memory.` : `Kept: “${note}”. It’s in Memory.`, { kind: 'can', go }, opts);
}
