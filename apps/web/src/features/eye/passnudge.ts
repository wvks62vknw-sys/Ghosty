/**
 * A NUDGE BEFORE THE SPACE STATION PASSES (NEXT ROUND, see.u4): the next pass over home goes into his own diary with a reminder ten
 * minutes before. The reminder is the diary's own, sent by the brain's Web Push, so it comes with the phone locked (a timer on the phone
 * would not). The pass is worked out on the phone from the satellite's public orbit and his saved home.
 */
import { brain } from '../../api/brain';
import { sayError } from '../../ui/hisWords';
import { passSaid, passTitle } from './sets';

export async function nudgePass(name: string, pass: { rise: number; max: number }): Promise<string> {
  if (pass.rise - Date.now() < 11 * 60_000) return 'That pass is less than ten minutes away: look up now.';
  try {
    await brain.addEvent({ title: passTitle(name, pass.max), start: pass.rise, end: pass.rise + 6 * 60_000, remindMin: 10 });
    return passSaid(name, pass.rise);
  } catch (e) {
    return sayError(e, 'add that pass to your diary');
  }
}
