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
import { speaker, type Label } from './voiceknown';
import type { LocalAnswer } from './local';

type Answer = (text: string, reply: string, local: LocalAnswer, opts: { voice?: boolean; private?: boolean }) => true;

const day = (now: number) => new Date(now).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export async function noteTurn(text: string, opts: { voice?: boolean; private?: boolean; who?: Label }, answer: Answer, now = Date.now()): Promise<boolean> {
  const m = NOTE_ASK.exec(text.trim());
  const note = m?.[1]?.trim().replace(/[.!]+$/, '');
  if (!note) return false;
  const go: LocalAnswer['go'] = [{ id: 'screen:memory', ask: -1, label: 'Open Memory', open: 'memory' }];
  if (opts.voice) {
    // (the turn's own label, as the phone judged it; else the talk bar's tag for this turn)
    const h = speaker.get().heard;
    const who: Label | undefined = opts.who ?? (h ? (h.label === 'unknown' && h.sure === false ? 'unsure' : h.label) : undefined);
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
