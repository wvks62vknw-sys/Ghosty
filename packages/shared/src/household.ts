/**
 * QUIET HOUSEHOLD MODE, on the phone (NEXT ROUND, voice.s1; his rules: "faces and voices only me and people I introduce … my voice is
 * never a lock on its own"). When the phone hears a voice he introduced (or one it doesn't know, or isn't sure of) asking about his
 * private things — his money, health, messages, diary, notes, passwords, where he has been, what Ghosty remembers about him — the
 * phone answers at once, kindly, that it keeps that to him; no table and no brain sees the ask. The brain's own side (prompt.ts notHis,
 * agent.ts) leaves his private picture out of any other turn such a voice says, and keeps that turn out of his memory.
 * It is a courtesy, never a lock: he can always type, and his voice opens nothing on its own.
 */

/** The private things: his money, health, messages, diary, notes, passwords, places, and what is remembered about him. */
export const PRIVATE_ASK =
  /\b(?:money|bank|balance|spend(?:ing|t)?|budgets?|salary|wages?|debts?|bills?|cards?|payments?|savings|finances?|accounts?|transactions?|statements?|health|weight|weigh|sleep|steps|medic(?:ine|ines|ation|al)|doctor|gp|symptoms?|mood|blood|heart rate|water intake|messages?|texts?|e-?mails?|inbox|mail|whatsapp|dms?|voicemails?|calendar|diary|agenda|appointments?|meetings?|schedule|notes?|journal|passwords?|pins?|codes?|location|where (?:is|was|has|have) (?:he|my (?:son|dad|husband|boyfriend|partner)|the owner)(?: been)?|memories|memory|remember about|know about (?:him|me)|his (?:secrets?|private|stuff|things|phone|photos|pictures|files|documents))\b/i;

/** Is this ask about his private things? */
export const privateAsk = (text: string): boolean => text.trim().length > 0 && PRIVATE_ASK.test(text.replace(/[’]/g, "'"));

/** The reply to someone else asking about his private things: kind, short, and no hint of what is there. */
export const keptLine = (owner: string, who: string | null): string =>
  `${who ? `Sorry ${who}, that’s` : 'That’s'} ${!owner || owner.toLowerCase() === 'boss' ? 'his' : `${owner}’s`} to see, so I keep it to him.`;
