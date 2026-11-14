/**
 * A FEW SECONDS TO TAKE IT BACK (NEXT ROUND, lane SECURITY, security.u5): after APPROVE on anything that sends, posts, pays,
 * publishes or ships, the card counts down a few seconds with TAKE IT BACK before the answer goes to the brain. Taken back, the
 * card is as it was and nothing left. The countdown lives here, not in the card, so a repaint of the chat keeps it going.
 */

/** How long the card waits after APPROVE before anything leaves. */
export const TAKEBACK_MS = 4000;

/** The tools whose APPROVE gets the countdown: the same words the brain asks APPROVE for (kernel/permissions.ts SENSITIVE). */
const LEAVES = /(send|email|message|post|publish|pay|purchase|buy|transfer|book|ship|social)/i;
export const takesBack = (tool: string): boolean => LEAVES.test(tool);

const running = new Map<string, { until: number; timer: ReturnType<typeof setTimeout> }>();

/** Start the countdown for approval `id`; `go` runs when it ends untouched. */
export function startTakeBack(id: string, go: () => void, now = Date.now(), ms = TAKEBACK_MS): void {
  cancelTakeBack(id);
  const timer = setTimeout(() => {
    running.delete(id);
    go();
  }, ms);
  running.set(id, { until: now + ms, timer });
}

/** TAKE IT BACK: nothing leaves, and the card asks again. True when there was a countdown to stop. */
export function cancelTakeBack(id: string): boolean {
  const r = running.get(id);
  if (!r) return false;
  clearTimeout(r.timer);
  running.delete(id);
  return true;
}

/** Seconds left on approval `id`'s countdown, or null when there is none. */
export function takeBackLeft(id: string, now = Date.now()): number | null {
  const r = running.get(id);
  return r ? Math.max(0, Math.ceil((r.until - now) / 1000)) : null;
}

/** The countdown's words. */
export const takeBackWords = (s: number): string => `Approved. It leaves in ${s} second${s === 1 ? '' : 's'}: TAKE IT BACK stops it.`;
