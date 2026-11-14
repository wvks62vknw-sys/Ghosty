/**
 * FORM TIPS WHILE COUNTING REPS (NEXT ROUND, BODY AND KITCHEN lane, body.u6), worked out on the phone from the joints the pose
 * model already sees, nothing kept or sent: through each rep the watcher keeps the deepest bend and, for push-ups, the straightest
 * back; as the rep lands it may give one short tip ("go a little deeper", "keep your back straight"). At most one tip every
 * three reps, never the same one twice running, so it coaches without nagging. A rough guide, never medical advice.
 */
import { angleAt, type Exercise, type Mark } from '../../../../../packages/shared/src/body';

const SIDE = [{ sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27 }, { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28 }];
const seen = (m: Mark | undefined): m is Mark => !!m && (m.visibility ?? 1) >= 0.5;

export interface FormWatch {
  ex: Exercise;
  /** The deepest bend this rep (degrees at the knee or the elbow). */
  low: number;
  /** For push-ups: the least straight the body line got (shoulder, hip, ankle). */
  back: number;
  since: number;
  lastTip: string;
}
export const formStart = (ex: Exercise): FormWatch => ({ ex, low: 180, back: 180, since: 3, lastTip: '' });

/** One frame: the deepest bend and the body line so far this rep. */
export function formFrame(w: FormWatch, p: Mark[] | null, aspect = 1): FormWatch {
  if (!p || w.ex === 'jacks') return w;
  let low = w.low;
  let back = w.back;
  for (const s of SIDE) {
    const joint = w.ex === 'squats' ? [p[s.hip], p[s.kn], p[s.an]] : [p[s.sh], p[s.el], p[s.wr]];
    if (joint.every(seen)) low = Math.min(low, angleAt(joint[0]!, joint[1]!, joint[2]!, aspect));
    if (w.ex === 'pushups') {
      const line = [p[s.sh], p[s.hip], p[s.an]];
      if (line.every(seen)) back = Math.min(back, angleAt(line[0]!, line[1]!, line[2]!, aspect));
    }
  }
  return { ...w, low, back };
}

/** As a rep lands: the tip to say (or ''), and the watcher reset for the next rep. */
export function formRep(w: FormWatch): { tip: string; w: FormWatch } {
  let tip = '';
  if (w.ex === 'squats' && w.low > 90) tip = 'Go a little deeper.';
  else if (w.ex === 'pushups' && w.back < 155) tip = 'Keep your back straight.';
  else if (w.ex === 'pushups' && w.low > 85) tip = 'A little lower.';
  const since = w.since + 1;
  const say = tip && since >= 3 && tip !== w.lastTip ? tip : '';
  return { tip: say, w: { ...formStart(w.ex), since: say ? 0 : since, lastTip: say || (tip ? w.lastTip : '') } };
}
