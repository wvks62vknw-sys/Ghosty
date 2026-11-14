/**
 * THE AGENDA BY CHAT (planlane): the words that work this screen from the chat, read on the phone with no model, in many wordings.
 * Pure (no DOM, no storage): the spec and the chat both read this. Returns null when the words are not for this screen, so the next
 * table (and then the brain) gets them. Never take words another table owns: "open the agenda" and "my diary" (the VOICE lane's
 * meanings), "remind me…" and "add dinner on Friday at 7" (the brain's own reminder and diary tools), the shopping list (the kitchen).
 *
 *   "add buy milk to my to-do list", "put call the bank on my list for tomorrow", "to-do: renew passport by Friday"   → add
 *   "what's on my to-do list", "what do I need to do today", "what's due this week"                                  → list
 *   "tick off buy milk", "I've done the passport", "cross the bank off my list", "mark buy milk as done"            → tick
 *   "take buy milk off my list", "remove the passport from my to-dos"                                               → remove
 *   "clear my done to-dos"                                                                                          → clear
 *   "show my month", "what's on this month", "what's on next month"                                                 → month
 */
import { dayOf, type Every } from './todowords';

export type AgendaAsk =
  | { what: 'add'; text: string; due: string; every?: Every; star?: boolean }
  | { what: 'list'; when: 'all' | 'today' | 'week' | 'late' | 'starred' }
  | { what: 'tick'; text: string; loose: boolean }
  | { what: 'remove'; text: string }
  | { what: 'clear' }
  | { what: 'month'; next: boolean; show: boolean }
  | { what: 'timeline'; view: 'today' | 'tomorrow' | 'week' };

const WEEK = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAYNAME = '(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?';
const ORD = '(\\d{1,2})(?:st|nd|rd|th)?';
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
// the list he means: his to-do list, his to-dos, his tasks, or plainly "my list" (never a bare "the list": that is the kitchen's
// shopping list, "add milk, eggs and bread to the list")
const LIST = '(?:(?:my|the)\\s+(?:to[- ]?do|todo|task)s?(?:\\s+list)?|my\\s+list)';
const NOT_MINE = /\b(?:shopping|grocery|groceries|reading|watch|play|bucket|wish|guest|packing)\s+list\b|\bremind\b|\bplaylist\b/i;

/** A day said in words, from `now`: "today", "tonight", "tomorrow", "Friday" (the next one; today's own name is a week on), "next week",
 * "in 3 days", "the 20th", "20 Nov", "Nov 20"; null when there is none. */
export function dayIn(words: string, now: number): string | null {
  const w = words.toLowerCase().trim();
  const at = (d: Date) => dayOf(d.getTime());
  const base = new Date(now);
  const plus = (n: number) => at(new Date(base.getFullYear(), base.getMonth(), base.getDate() + n));
  if (/^(?:today|tonight|this (?:morning|afternoon|evening))$/.test(w)) return plus(0);
  if (/^tomorrow(?: (?:morning|afternoon|evening|night))?$/.test(w)) return plus(1);
  if (/^the day after tomorrow$/.test(w)) return plus(2);
  if (/^(?:this )?weekend$/.test(w)) return plus((6 - base.getDay() + 7) % 7 || (base.getDay() === 6 ? 0 : 7));
  if (/^next week$/.test(w)) return plus(((8 - base.getDay()) % 7) || 7);
  if (/^end of (?:the )?month$/.test(w)) return at(new Date(base.getFullYear(), base.getMonth() + 1, 0));
  let m = /^in (\d{1,3}|a|one|two|three|four|five|six|seven) (day|week)s?$/.exec(w);
  if (m) {
    const n = /^\d/.test(m[1]!) ? Number(m[1]) : ['a', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'].indexOf(m[1]!) || 1;
    return plus(n * (m[2] === 'week' ? 7 : 1));
  }
  m = new RegExp(`^(next |this )?(${DAYNAME})$`).exec(w);
  if (m) {
    const want = WEEK.findIndex((d) => d.startsWith(m![2]!.slice(0, 3)));
    let n = (want - base.getDay() + 7) % 7 || 7;
    return plus(n);
  }
  // a number is a day only with "the", an ordinal or a month ("the 6", "6th", "6 Dec"): a bare "6" is a time or a count
  m = new RegExp(`^(?:${DAYNAME} )?(?:the )?${ORD}(?: of)?(?: ${MONTH})?$`).exec(w) ?? null;
  if (m && !m[2] && !/^(?:\S+ )?the |\d(?:st|nd|rd|th)\b/.test(w) && !new RegExp(`^${DAYNAME} `).test(w)) m = null;
  const m2 = m ? null : new RegExp(`^(?:${DAYNAME} )?${MONTH} (?:the )?${ORD}$`).exec(w);
  if (m || m2) {
    const day = Number(m ? m[1] : m2![2]);
    const mon = m ? m[2] : m2![1];
    if (day < 1 || day > 31) return null;
    let month = mon ? MONTHS.indexOf(mon.slice(0, 3)) : base.getMonth();
    let year = base.getFullYear();
    let d = new Date(year, month, day);
    // a day already gone this month (or this year) is the next one
    if (at(d) < at(base)) {
      if (mon) year += 1;
      else month += 1;
      d = new Date(year, month, day);
    }
    return d.getDate() === day ? at(d) : null;
  }
  return null;
}

/** A repeat said in words ("every day", "daily", "every weekday", "every week", "every month"); "every Monday" is weekly from Monday. */
function everyIn(w: string): { every: Every; from?: string } | null {
  const s = w.toLowerCase().trim();
  if (/^(?:every ?day|daily|each day)$/.test(s)) return { every: 'daily' };
  if (/^(?:every weekday|weekdays|on weekdays|each weekday)$/.test(s)) return { every: 'weekdays' };
  if (/^(?:every week|weekly|each week)$/.test(s)) return { every: 'weekly' };
  if (/^(?:every month|monthly|each month)$/.test(s)) return { every: 'monthly' };
  const m = new RegExp(`^(?:every|each) (${DAYNAME})$`).exec(s);
  if (m) return { every: 'weekly', from: m[1] };
  return null;
}

/** The day and repeat said at the end of `text` ("renew passport by Friday", "bins every Monday"), and the words without them. */
export function splitWhen(text: string, now: number): { text: string; due: string; every?: Every } {
  let t = text.trim().replace(/[.!]+$/, '');
  let due = '';
  let every: Every | undefined;
  for (let i = 0; i < 2; i++) {
    const rep = /\s*,?\s+((?:every|each)\s+\w+|daily|weekly|monthly|weekdays|on weekdays)$/i.exec(t);
    const ev = rep ? everyIn(rep[1]!) : null;
    if (rep && ev && !every) {
      every = ev.every;
      if (ev.from) due = dayIn(ev.from, now) ?? due;
      t = t.slice(0, rep.index);
      continue;
    }
    const when = /\s*,?\s+(?:(?:by|on|for|due|before|until|this|from)\s+)?((?:the day after )?tomorrow(?: (?:morning|afternoon|evening|night))?|today|tonight|this (?:morning|afternoon|evening)|(?:this )?weekend|next week|end of (?:the )?month|in \w+ (?:days?|weeks?)|(?:next |this )?(?:mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?|sun)(?:day)?(?: (?:the )?\d{1,2}(?:st|nd|rd|th)?(?: of)?(?: \w+)?)?|the \d{1,2}(?:st|nd|rd|th)?(?: of)?(?: [a-z]{3,9})?|\d{1,2}(?:st|nd|rd|th)(?: of)?(?: [a-z]{3,9})?|\d{1,2} [a-z]{3,9}|[a-z]{3,9} (?:the )?\d{1,2}(?:st|nd|rd|th)?)$/i.exec(t);
    const day = when ? dayIn(when[1]!, now) : null;
    if (when && day && !due) {
      // keep "Friday" in "pick up Friday's parcel" and the number in "buy 2": only a day that stands on its own at the end
      const before = t.slice(0, when.index).trim();
      if (before && !/\b(?:for|by|on)$/i.test(before)) {
        due = day;
        t = before;
        continue;
      }
    }
    break;
  }
  return { text: t.replace(/\s*,\s*$/, '').trim(), due, ...(every ? { every } : {}) };
}

const clean = (t: string) => t.trim().replace(/^(?:hey |ok(?:ay)? |hi )?(?:ghosty[, ]+)?/i, '').replace(/^(?:please |can you |could you |would you |will you )+/i, '').replace(/\s*(?:please|thanks|thank you)[.!?]*$/i, '').replace(/[?!.]+$/, '').trim();
const strip = (s: string) => s.replace(/^["“‘']|["”’']$/g, '').trim();

export function agendaAsked(text: string, now = Date.now()): AgendaAsk | null {
  if (!text || text.length > 220) return null;
  const t = clean(text);
  if (!t || NOT_MINE.test(t)) return null;
  const lc = t.toLowerCase();

  // ── [planlane2:timeline] the day by the hour and the week to plan: "plan my week", "show my day by the hour", "when am I free tomorrow"
  if (/^(?:help me )?plan (?:my|the) week$/.test(lc)) return { what: 'timeline', view: 'week' };
  const tl = /^(?:show|open|see)(?: me)? (?:my|the) (day|today|tomorrow) by the hour$|^when am i free (today|tomorrow)$/.exec(lc);
  if (tl) return { what: 'timeline', view: (tl[1] ?? tl[2]) === 'tomorrow' ? 'tomorrow' : 'today' };

  // ── the month: "show my month", "what's on this month", "what have I got next month"
  let m = /^(?:show|open|see)(?: me)? (?:my|the) (?:month|calendar month)$|^(?:my month|the month(?: ahead)?|month view)$/.exec(lc);
  if (m) return { what: 'month', next: false, show: true };
  m = /^(?:show|open|see)(?: me)? (this|next) month$/.exec(lc);
  if (m) return { what: 'month', next: m[1] === 'next', show: true };
  m = /^(?:what(?:'s|’s| is)|whats) (?:on|happening|coming up|in my diary|in my calendar)(?: for me)? (this|next) month$|^what(?: have| do)? i(?:'ve| have)? (?:got )?(?:on )?(this|next) month$|^(?:anything|what) on (this|next) month$|^how(?:'s|’s| is) (this|next) month looking$/.exec(lc);
  if (m) return { what: 'month', next: (m[1] ?? m[2] ?? m[3] ?? m[4]) === 'next', show: false };

  // ── clear the done ones: "clear my done to-dos", "clear the done ones", "clear completed tasks"
  if (/^(?:clear|remove|delete|tidy|get rid of)(?: up)?(?: all)? (?:my |the )?(?:done|completed|finished|ticked(?: off)?|crossed off)(?: ones| items| things)?(?: (?:to[- ]?dos?|todos?|tasks?))?(?: (?:from|off|on) (?:my|the) (?:(?:to[- ]?do|todo|task) )?list)?$/.test(lc) ||
    /^(?:clear|tidy)(?: up)? (?:my |the )?(?:to[- ]?do|todo|task) list$/.test(lc))
    return { what: 'clear' };

  // ── read the list
  if (/^(?:what(?:'s|’s| is)|whats) (?:on|in) (?:my (?:(?:to[- ]?do|todo|task)s? )?list|the (?:to[- ]?do|todo|task)s? list)(?: today)?$/.test(lc) ||
    /^(?:show|read|tell|give|list|open)(?: me)?(?: out)? (?:(?:my|the) (?:to[- ]?do|todo|task)s?(?: list)?|my list)$/.test(lc) ||
    /^(?:my )?(?:to[- ]?do|todo) list$|^my (?:to[- ]?dos|todos|tasks)$|^what (?:are|r) my (?:to[- ]?dos|todos|tasks)$|^what(?:'s|’s| is) (?:left|still) (?:to do|on my list)$|^what(?:'s|’s| is) left on my (?:(?:to[- ]?do|todo|task) )?list$/.test(lc)) {
    if (/today$/.test(lc)) return { what: 'list', when: 'today' };
    return { what: 'list', when: 'all' };
  }
  if (/^what (?:do|have|should) i (?:need to|have to|got to|gotta|got) do(?: today)?$|^what (?:do|should) i do today$|^what(?:'s|’s| is) (?:due|on my to-?do list) today$|^(?:anything|what(?:'s|’s| is)) (?:due|to do) today$|^what(?:'s|’s| is) on today's (?:to[- ]?do )?list$|^(?:my )?(?:to[- ]?dos|todos|tasks) (?:for )?today$/.test(lc))
    return { what: 'list', when: 'today' };
  if (/^what(?:'s|’s| is) (?:due|on my (?:to[- ]?do )?list) this week$|^what (?:do|have) i (?:need to|have to|got to) do this week$|^(?:my )?(?:to[- ]?dos|todos|tasks) (?:for )?this week$/.test(lc)) return { what: 'list', when: 'week' };
  if (/^what(?:'s|’s| is| am i) (?:late|overdue|behind on)$|^(?:any(?:thing)?|what) (?:to[- ]?dos? )?(?:is |are )?(?:late|overdue)$|^what (?:to[- ]?dos?|tasks?) (?:are|is) (?:late|overdue)$/.test(lc)) return { what: 'list', when: 'late' };
  if (/^what(?:'s|’s| is) (?:starred|important)(?: on my list)?$|^(?:show|read)(?: me)? (?:my )?(?:starred|important) (?:to[- ]?dos|todos|tasks|ones)$/.test(lc)) return { what: 'list', when: 'starred' };

  // ── tick one off: "tick off buy milk", "tick buy milk off (my list)", "cross off X", "mark X (as) done", "I've done X"
  // ("check" only with "off": "check the weather" is not his list's)
  m = new RegExp(`^(?:(?:tick|cross|strike)(?: off)?|check off) (.+?)( off)?(?: (?:from|on|off) ${LIST})?$`).exec(lc);
  if (m && !/^(?:off )?(?:my|the) list$/.test(m[1]!)) return { what: 'tick', text: strip(t.slice(lc.indexOf(m[1]!), lc.indexOf(m[1]!) + m[1]!.length)), loose: !/\boff\b/.test(lc) && !/\blist\b/.test(lc) };
  m = new RegExp(`^mark (.+?) (?:as )?(?:done|complete|completed|finished)(?: (?:on|in) ${LIST})?$`).exec(lc);
  // (loose unless "list" is said: a brain tool's "mark step 2 of the upgrade as done" and the learning pack's "done: typing 52"
  // are theirs when nothing on his list is named)
  if (m) return { what: 'tick', text: strip(t.slice(lc.indexOf(m[1]!), lc.indexOf(m[1]!) + m[1]!.length)), loose: !/\blist\b/.test(lc) };
  m = /^(?:done|finished|completed)\s*[:–-]\s*(.+)$/.exec(lc);
  if (m) return { what: 'tick', text: strip(t.slice(lc.indexOf(m[1]!))), loose: true };
  m = /^(?:i(?:'ve|’ve| have)? (?:done|finished|completed|sorted|did)|i(?:'m|’m| am) done with) (.+)$/.exec(lc);
  if (m && !/\b(?:today|yesterday|workout|run|walk|exercise|steps|reps|water|my best)\b/.test(m[1]!)) return { what: 'tick', text: strip(t.slice(lc.indexOf(m[1]!))), loose: true };
  m = /^(.+?) (?:is|are) (?:done|sorted|finished)$/.exec(lc);
  if (m && m[1]!.split(' ').length <= 6) return { what: 'tick', text: strip(t.slice(0, m[1]!.length)), loose: true };

  // ── take one off: "take buy milk off my list", "remove X from my to-do list", "delete X from my to-dos"
  m = new RegExp(`^(?:take|remove|delete|drop) (.+?) (?:off|from) ${LIST}$`).exec(lc);
  if (m) return { what: 'remove', text: strip(t.slice(lc.indexOf(m[1]!), lc.indexOf(m[1]!) + m[1]!.length)) };

  // ── add one: "add X to my to-do list (for tomorrow)", "put X on my list for tomorrow", "to-do: X by Friday", "new to-do X"
  let item: string | null = null;
  let star = false;
  m = new RegExp(`^(?:add|put|stick|pop|write|jot(?: down)?|note(?: down)?|get) (.+?) (?:to|on|onto|in|into) ${LIST}(.*)$`).exec(lc);
  if (m) item = t.slice(lc.indexOf(m[1]!), lc.indexOf(m[1]!) + m[1]!.length) + t.slice(lc.length - m[2]!.length);
  if (!item) {
    m = new RegExp(`^(?:add|put) (?:to|on) ${LIST}\\s*[:,–-]?\\s*(.+)$`).exec(lc);
    // several jobs in one ("send the invoice by Friday, book the van, ring the landlord") are the work pack's: the brain splits them
    if (m && !/[,;]|\band\b/.test(m[1]!)) item = t.slice(lc.length - m[1]!.length);
  }
  if (!item) {
    m = /^(?:(?:new|add an?|another|one more|make an?|create an?) )?(?:to[- ]?do|todo|task)(?: item)?\s*[:–-]\s*(.+)$|^(?:new|add an?|another|one more) (?:to[- ]?do|todo|task)(?: item)?\s+(?:to\s+)?(.+)$/.exec(lc);
    if (m) item = t.slice(lc.length - (m[1] ?? m[2])!.length);
  }
  if (!item) return null;
  item = item.trim();
  if (/,?\s*(?:it'?s |that'?s |mark it )?(?:important|urgent|starred|star it)$/i.test(item)) {
    star = true;
    item = item.replace(/,?\s*(?:it'?s |that'?s |mark it )?(?:important|urgent|starred|star it)$/i, '');
  }
  const w = splitWhen(item, now);
  const words = strip(w.text);
  if (!words || /^(?:it|that|this|something)$/i.test(words)) return null;
  return { what: 'add', text: words.charAt(0).toUpperCase() + words.slice(1), due: w.due, ...(w.every ? { every: w.every } : {}), ...(star ? { star: true } : {}) };
}
