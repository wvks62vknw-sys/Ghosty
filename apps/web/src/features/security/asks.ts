/**
 * What he can say for SECURITY (NEXT ROUND, lane SECURITY), answered on the phone with no model: the screen opened where it helps,
 * and one line. "Lock everything" opens the lock's own confirm: the lock itself is always his tap.
 */
export type SecurityAsk = 'lock' | 'leaked' | 'approvals' | 'locks';

export function securityAsked(t: string): SecurityAsk | null {
  const s = t.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(please )?(lock (everything|it all( down)?|ghosty( down)?|down everything)|panic button|lockdown)$/.test(s)) return 'lock';
  if (/\b(has|have|is) (my|this|a) password (been )?(leaked|pwned|breached|in a (leak|breach))\b|^check (a|my) password$/.test(s)) return 'leaked';
  if (/^(show|list|what are|what were) (me )?(my )?approvals$|^what (have|did) i approved?\b/.test(s)) return 'approvals';
  if (/^(how safe am i|show (me )?my security|open security|are my locks (all )?green|is everything locked|my locks)$/.test(s)) return 'locks';
  return null;
}

export const SECURITY_SAID: Record<SecurityAsk, string> = {
  lock: 'Here is LOCK EVERYTHING: tap LOCK to unpair Telegram and pause anything that publishes, sends, pays or ships. You unlock it with your owner key.',
  leaked: 'Type the password under HAS IT LEAKED? and tap CHECK: only five characters of its scrambled fingerprint leave the phone.',
  approvals: 'Here is every APPROVE and NOT NOW you gave, with what, when and where from.',
  locks: 'Here are your locks, each green, amber or red, with what to do about any that are not green.',
};
