/**
 * LINKS' kept checks (ghosty.links.checks): what the last TEST, or the check when he linked it, said per connection, kept on the phone
 * so a link whose check failed is never shown as working. Its own module so whatever else saves or removes one of these links (SYSTEM →
 * KEYS, the Spotify sign-in) can keep or clear the same check: keepCheck('traffic' | 'github' | 'email' | 'spotify' | 'telegram', …).
 */
import type { LinkCheck } from './words';

const CHECKS = 'ghosty.links.checks';

export function readChecks(): Record<string, LinkCheck> {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKS) ?? '{}') as Record<string, LinkCheck> | null;
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
}

/** Keep `c` as the last check of `id`, or forget it (null). */
export function keepCheck(id: string, c: LinkCheck | null): void {
  try {
    const all = readChecks();
    if (!c && !(id in all)) return;
    if (c) all[id] = c;
    else delete all[id];
    localStorage.setItem(CHECKS, JSON.stringify(all));
  } catch {
    /* the phone would not keep it: the line is right until the page closes */
  }
}

/** The last check of `id`, if it was about the account linked now (`who`). */
export function checkOf(id: string, who?: string | null): LinkCheck | null {
  const c = readChecks()[id];
  return c && typeof c.ok === 'boolean' && (!who || !c.who || c.who === who) ? c : null;
}
