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
  /\b(?:money|bank|balance|spend(?:ing|t)?|budgets?|salary|wages?|debts?|bills?|(?:bank|credit|debit) cards?|card (?:details|number)|payments?|savings|finances?|bank accounts?|my accounts?|his accounts?|transactions?|(?:bank )?statements?|health|weight|weigh|(?:my|his|how did (?:i|he)) sleep|sleep (?:score|data|last night)|(?:my|his) steps|steps today|medic(?:ine|ines|ation|al)|doctor|gp|symptoms?|mood|blood|heart rate|water intake|messages?|texts?|e-?mails?|inbox|mail|whatsapp|dms?|voicemails?|calendar|diary|agenda|appointments?|meetings?|schedule|(?:my|his) notes?|journal|passwords?|pins?|passcodes?|(?:door|alarm|safe|lock) codes?|location|where (?:is|was|has|have) (?:he|my (?:son|dad|husband|boyfriend|partner)|the owner)(?: been)?|memories|memory|remember about|know about (?:him|me)|his (?:secrets?|private|stuff|things|phone|photos|pictures|files|documents))\b/i;

/**
 * His data asked in any person ("how long did he sleep", "how many steps has he walked", "read me dad's notes", "the code for the
 * front door"), kept narrow enough that "set the sleep timer", "the steps to make pancakes" and "the morse code" stay anyone's.
 */
const HIS_DATA = [
  /\b(?:how|did|has|have|does|do|what time)\b[^.?!]{0,40}\b(?:sleep|slept)\b(?! (?:timer|sounds?|music|mode|story|stories))/,
  /\bsleep (?:did|has|have|does) (?:he|i|she|the owner|[a-z]+) (?:get|got|had|have)\b/,
  /\bhow many steps\b/,
  /\bsteps (?:did|has|have|does|is) (?:he|i|she|the owner|[a-z]+)\b/,
  /\bsteps (?:has|have|had) (?:he|i|she|the owner|[a-z]+) (?:walked|done|taken|made)\b/,
  /\b[a-z]+'s (?:notes?|journal|diary)\b/,
  /\bcodes? (?:for|to|of|on) (?:the |my |his |our )?(?:front |back |side |garage |main |house )?(?:door|alarm|safe|lock|gate|garage|house)\b/,
  /\b(?:door|alarm|safe|lock|gate|garage|house|entry|key ?safe) ?codes?\b/,
];

/** Is this ask about his private things? */
export const privateAsk = (text: string): boolean => {
  const t = text.trim().toLowerCase().replace(/[’]/g, "'");
  return t.length > 0 && (PRIVATE_ASK.test(t) || HIS_DATA.some((re) => re.test(t)));
};

/**
 * [review fix] The phone's own tables that answer from his private things (his body log, money, recall and notes, diary, brief,
 * messages he missed or is chasing): another voice is never answered by them, whatever the wording (assistant/session.ts).
 */
export const PRIVATE_TABLES: readonly string[] = ['track', 'moneyapp', 'statement', 'recall', 'chase', 'missed', 'planagenda', 'planbrief'];

/** The reply to someone else asking about his private things: kind, short, and no hint of what is there. */
export const keptLine = (owner: string, who: string | null): string =>
  `${who ? `Sorry ${who}, that’s` : 'That’s'} ${!owner || owner.toLowerCase() === 'boss' ? 'his' : `${owner}’s`} to see, so I keep it to him.`;
