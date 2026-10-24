/**
 * From the owner's words to a Brief: what kind of business it is, the town, the name, and any
 * phone, email, hours or prices said in passing. Pure and offline (the phone uses it with no model;
 * the brain uses it first and lets a model add to it). What it cannot find stays empty and is listed
 * by `missing`, so nothing is made up.
 */
import type { Brief, Hours, KindId, Service } from './types';

export interface KindInfo {
  id: KindId;
  label: string;
  /** Words that mean this kind, tested in order (first match wins). */
  words: RegExp;
}

export const KINDS: KindInfo[] = [
  { id: 'cv', label: 'Personal CV', words: /\b(cv|c\.v\.|curriculum vitae|r[eé]sum[eé]|my (?:career|work history)|job (?:hunting|seeking|applications?))\b/i },
  { id: 'barber', label: 'Barber', words: /\b(barber|barbers|barbershop|barber'?s|fade|fades|beard trim|men'?s (?:hair|grooming))\b/i },
  { id: 'salon', label: 'Hair and beauty salon', words: /\b(salon|hairdress\w*|hair stylist|beauty|beautician|nails?|nail bar|lashes|brows|aesthetics|spa|massage|tanning)\b/i },
  { id: 'takeaway', label: 'Takeaway or restaurant with its menu', words: /\b(takeaway|take-away|take away|curry house|pizzeria|pizza|kebab|chippy|chip shop|fish (?:and|&) chips|burger (?:bar|joint|van)|food (?:truck|van)|street food|(?:restaurant|caf[eé]|diner) with (?:a |the |our |its |my )?menu|menu (?:site|website|page)|online menu)\b/i },
  { id: 'restaurant', label: 'Restaurant', words: /\b(restaurant|bistro|takeaway|take-away|curry house|pizzeria|pizza|grill|steakhouse|kitchen|diner|eatery|tapas|sushi|balti|gastropub|pub|bar and grill)\b/i },
  { id: 'cafe', label: 'Café', words: /\b(caf[eé]s?|coffee|tea ?room|bakery|bakers?|patisserie|brunch|sandwich bar|deli|cake shop|ice cream)\b/i },
  { id: 'tradesperson', label: 'Tradesperson (one person)', words: /\b(handy ?man|handy ?person|odd[- ]jobs?|man (?:and|&|with) (?:a )?van|sole trader|one-man band|tradesman|tradesperson|tradeswoman|self-employed)\b/i },
  { id: 'trades', label: 'Trades', words: /\b(plumb\w*|heating|boiler|gas safe|electric\w*|builder|building|construction|roof\w*|joiner\w*|carpent\w*|decorat\w*|painter|plaster\w*|tiler|tiling|locksmith|landscap\w*|gardener|gardening|handyman|cleaning|cleaner|removals?|driveways?|kitchen fitter|bathroom fitter|scaffold\w*|trades?(?:man|person|people)?|mechanic|garage|mot centre)\b/i },
  { id: 'club', label: 'Local club or society', words: /\b(club|society|choir|orchestra|chess|book group|reading group|running group|walking group|allotments?|bowls|cricket|football|rugby|netball|hockey|tennis|badminton|cycling group|youth group|juniors|league)\b/i },
  { id: 'gym', label: 'Gym or coach', words: /\b(gym|fitness|personal trainer|pt studio|coach(?:ing)?|crossfit|boxing|martial arts|karate|jiu ?jitsu|yoga|pilates|bootcamp|strength|spin)\b/i },
  { id: 'photographer', label: 'Photographer', words: /\b(photograph\w*|videograph\w*|wedding photo\w*|portraits?|headshots?)\b/i },
  { id: 'clinic', label: 'Clinic', words: /\b(dentist|dental|clinic|physio\w*|osteopath\w*|chiropract\w*|optician|podiatr\w*|therapist|therapy|counsell\w*|vet|veterinary|doctor|gp surgery|pharmacy|chemist)\b/i },
  { id: 'estate', label: 'Estate agent', words: /\b(estate agent|estate agency|lettings?|letting agent|property|properties|realtor|landlords?)\b/i },
  { id: 'invite', label: 'Occasion with directions (wedding, party, open day)', words: /\b(wedding(?: day| website| invitation)?|birthday|christening|naming day|baby shower|engagement party|anniversary|reunion|garden party|f[eê]te|open day|leaving do|retirement (?:do|party)|memorial|save the date|rsvp|invitation|party)\b/i },
  { id: 'launch', label: 'Product launch', words: /\b(product launch|launch(?:ing)? (?:my|our|a|the|an) (?:new )?(?:product|book|album|range|collection|game|brand|gadget|campaign)|launch page|pre-?orders?|coming soon|kickstarter|crowdfund\w*|waiting list|wait-?list)\b/i },
  { id: 'event', label: 'Event', words: /\b(event|festival|gig|concert|conference|wedding (?:day|website)|launch night|fundraiser night|open day|meet-?up|fair)\b/i },
  { id: 'charity', label: 'Charity or community group', words: /\b(charity|charities|non-?profit|community (?:group|centre|project)|foundation|food ?bank|volunteer\w*|mosque|church|temple|gurdwara|scouts|club for)\b/i },
  { id: 'saas', label: 'App or online product', words: /\b(app|saas|software|startup|platform|tool for|landing page for (?:my|an|a) (?:app|product))\b/i },
  { id: 'shop', label: 'Shop', words: /\b(shop|store|boutique|florist|flowers|gift shop|clothing|fashion|jewell\w*|candles?|crafts?|etsy|retail|grocer\w*|off licence|butcher\w*)\b/i },
  { id: 'portfolio', label: 'Portfolio', words: /\b(portfolio|freelanc\w*|designer|illustrat\w*|artist|developer|consultant|personal (?:site|website))\b/i },
];

export const kindLabel = (k: KindId) => KINDS.find((x) => x.id === k)?.label ?? k;

/** The kind of business in a request ('shop' when nothing fits better: most small businesses sell something). */
export function kindOf(text: string): KindId {
  for (const k of KINDS) if (k.words.test(text)) return k.id;
  return 'shop';
}

const TOWN_STOP = /^(the|my|our|a|an|this|that|london road|town|city|centre|center|area|uk|england)$/i;

/** "… in Walsall", "… based in Sutton Coldfield", "… on Park Street, Bilston". */
export function townOf(text: string): string | undefined {
  const m = text.match(/\b(?:in|based in|located in|near|around|serving)\s+((?:[A-Z][a-zA-Z'’-]+)(?:[ -](?:upon|on|under|in|le|de|by|[A-Z][a-zA-Z'’-]+))*)/);
  const t = m?.[1]?.replace(/\s+(?:called|named|which|that|and|for|with)$/i, '').trim();
  if (t && !TOWN_STOP.test(t)) return t;
  // typed in lower case on a phone: "… barber shop in walsall" (one word, at the end or before a comma)
  const low = text.match(/\b(?:in|based in)\s+([a-z][a-z'’-]{2,})\s*(?:[,.!?]|$)/);
  return low && !TOWN_STOP.test(low[1]!) && !/^(town|the|my|our|business|london)$/i.test(low[1]!) ? low[1]![0]!.toUpperCase() + low[1]!.slice(1) : undefined;
}

/** "called Fade & Co", "named 'The Daily Grind'", or a quoted name. */
export function nameOf(text: string): string | undefined {
  const q = text.match(/["“]([^"”]{2,48})["”]/) ?? text.match(/(?:^|[\s(])['‘]([^'’]{2,48})['’](?=[\s,.!?)]|$)/);
  if (q) return q[1]!.trim();
  const m = text.match(/\b(?:called|named|name is|business is)\s+([A-Z0-9][\w&'’.-]*(?:\s+(?:&|and|of|the|[A-Z0-9][\w&'’.-]*)){0,5})/);
  return m?.[1]?.replace(/\s+(?:in|on|at|for|and)$/i, '').trim();
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** "Saturday 12th July 2026", "12 Jul", "July 12" → "Saturday 12 July 2026" (as said, tidied); undefined when no date is said. */
export function dateOf(text: string): string | undefined {
  const mon = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const wd = '(?:(mon|tues|wednes|thurs|fri|satur|sun)day,?\\s+)?';
  const a = text.match(new RegExp(`\\b${wd}(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${mon}\\b,?(?:\\s+(20\\d\\d))?`, 'i'));
  const b = a ? null : text.match(new RegExp(`\\b${wd}${mon}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b,?(?:\\s+(20\\d\\d))?`, 'i'));
  const m = a ? { w: a[1], d: a[2]!, mo: a[3]!, y: a[4] } : b ? { w: b[1], d: b[3]!, mo: b[2]!, y: b[4] } : null;
  if (!m || Number(m.d) < 1 || Number(m.d) > 31) return undefined;
  const month = MONTHS.find((x) => x.startsWith(m.mo.toLowerCase().slice(0, 3)))!;
  const cap = (x: string) => x[0]!.toUpperCase() + x.slice(1);
  return [m.w ? `${cap(m.w.toLowerCase())}day` : '', String(Number(m.d)), cap(month), m.y ?? ''].filter(Boolean).join(' ');
}

/** A person's name for a CV: "a cv website for Priya Shah" (two or three capitalised words after "for" or "I'm"). */
export const personOf = (text: string): string | undefined => text.match(/\b(?:for|I'?m|I am|my name is)\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){1,2})\b/)?.[1];

export const phoneOf = (text: string): string | undefined => text.match(/(?:\+44\s?\(?0?\)?\s?|\b0)(?:\d[\s-]?){9,10}\b/)?.[0]?.replace(/\s+$/, '').trim();
export const emailOf = (text: string): string | undefined => text.match(/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/)?.[0];
export const postcodeOf = (text: string): string | undefined => text.match(/\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i)?.slice(1, 3).join(' ').toUpperCase();

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const dayNo = (s: string) => DAYS.indexOf(s.slice(0, 3).toLowerCase());
const LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Mon-Fri 9-6, Sat 9-4, Sun closed" → hours rows (days read, so "open now" works). */
export function hoursOf(text: string): Hours[] | undefined {
  const re = /\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*(?:\s*(?:-|–|to)\s*(mon|tue|wed|thu|fri|sat|sun)[a-z]*)?:?\s+(?:(closed)|(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?)\s*(?:-|–|to)\s*(\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?))/gi;
  const out: Hours[] = [];
  for (const m of text.matchAll(re)) {
    const a = dayNo(m[1]!);
    const b = m[2] ? dayNo(m[2]) : a;
    const days: number[] = [];
    for (let d = a; ; d = (d + 1) % 7) {
      days.push(d);
      if (d === b || days.length > 7) break;
    }
    const label = a === b ? LABEL[a]! : `${LABEL[a]!.slice(0, 3)}–${LABEL[b]!.slice(0, 3)}`;
    out.push(m[3] ? { label, closed: true, days } : { label, open: fixTime(m[4]!, false), close: fixTime(m[5]!, true), days });
  }
  return out.length ? out : undefined;
}
/** "9" → "9:00", "6" as a closing time → "18:00" (nobody closes at 6 in the morning), "5.30pm" → "17:30". */
function fixTime(t: string, closing: boolean): string {
  const m = t.trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/);
  if (!m) return t.trim();
  let h = Number(m[1]);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (!m[3] && closing && h <= 11) h += 12;
  return `${h}:${m[2] ?? '00'}`;
}

/** "skin fade £20, beard trim £10" → services with prices. */
export function servicesOf(text: string): Service[] | undefined {
  const out: Service[] = [];
  for (const m of text.matchAll(/([A-Za-z][A-Za-z &'’/-]{2,40}?)\s*(?:[-–:]|for|is|at)?\s*(£\s?\d+(?:\.\d{2})?)/g)) {
    const name = m[1]!.replace(/^(and|with|a|an|the|plus|,)\s+/i, '').trim();
    if (name.length >= 3 && !/^(only|just|from|about|around|costs?|price|prices)$/i.test(name)) out.push({ name: name[0]!.toUpperCase() + name.slice(1), price: m[2]!.replace(/\s/g, '') });
  }
  return out.length ? out : undefined;
}

/** Everything a request says, as a Brief (kind always set; the rest only when it was said). */
export function briefFrom(text: string, base: Partial<Brief> = {}): Brief {
  const kind = base.kind ?? kindOf(text);
  const b: Brief = {
    request: text.slice(0, 2000),
    kind,
    name: base.name || nameOf(text) || (kind === 'cv' ? personOf(text) : undefined) || '',
    ...pick({ town: townOf(text), phone: phoneOf(text), email: emailOf(text), postcode: postcodeOf(text), hours: hoursOf(text), services: servicesOf(text), date: DATED.includes(kind) ? dateOf(text) : undefined, formEndpoint: formEndpointOf(text) }),
    ...pick(base as Record<string, unknown>),
  } as Brief;
  return b;
}
/** The kinds with a day of their own (an event, an occasion, a launch): a date in the words is theirs. */
const DATED: KindId[] = ['event', 'invite', 'launch'];
/** Kinds with no shop door: no town or street address is asked for, and no map is drawn. */
export const PLACELESS: KindId[] = ['saas', 'portfolio', 'cv', 'launch'];
/** The owner's free form address said in passing: a Formspree form (https://formspree.io/f/…) only — a Web3Forms key is given in the keys. */
export const formEndpointOf = (text: string): string | undefined => text.match(/https:\/\/formspree\.io\/f\/[A-Za-z0-9]{4,20}\b/)?.[0];
const pick = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)));

/** The facts worth asking for before building, most useful first (the phone asks; the brain fills sensible defaults and lists them). */
export function missing(b: Brief): { key: keyof Brief; ask: string }[] {
  const out: { key: keyof Brief; ask: string }[] = [];
  if (!b.name) out.push({ key: 'name', ask: "What's the business called?" });
  if (!b.town && !PLACELESS.includes(b.kind)) out.push({ key: 'town', ask: 'Which town or area is it in?' });
  if (!b.date && (b.kind === 'invite' || b.kind === 'event')) out.push({ key: 'date', ask: 'When is it? (e.g. Saturday 12 July 2026)' });
  if (!b.phone && !b.email && !b.whatsapp) out.push({ key: 'phone', ask: 'A phone number or email for customers?' });
  if (!b.hours && ['cafe', 'restaurant', 'takeaway', 'barber', 'salon', 'gym', 'shop', 'clinic'].includes(b.kind)) out.push({ key: 'hours', ask: 'Opening hours? (e.g. Mon–Fri 9–6, Sat 9–4, Sun closed)' });
  if (!b.services?.length && ['barber', 'salon', 'trades', 'tradesperson', 'clinic', 'gym', 'photographer'].includes(b.kind)) out.push({ key: 'services', ask: 'The main services and prices? (e.g. skin fade £20, beard trim £10)' });
  if (!b.about) out.push({ key: 'about', ask: 'Anything that makes it special — how long it has been going, who runs it, what people love about it?' });
  return out;
}

/**
 * Is this a request for a website FOR something ("build me a website for…", "make a site for my café", "I
 * need a landing page for my app")? A site somebody else has ("the NHS website", "that site we found"), a
 * site visit or a home page widget is not: the site must be asked for (a, my, new…) and be for something.
 */
export const siteAsk = (text: string): boolean =>
  /\b(?:build|make|create|design|set up|do|need|needs|want|get|start)\b(?:\s+(?:me|us|him|her|them|you))?(?:\s+(?:a|an|my|our|their|his|her|new|simple|proper|small|nice|quick|one-page|business))+\s+(?:web ?site|site|web ?page|landing page|home ?page)\b(?=\s+(?:for|about|that|where|with|to (?:sell|show|promote))\b|\s*[:.!]|\s*(?:please)?\s*$)/i.test(text) &&
  !/\b(unpublish|take (it|.{0,20}) down|list (my )?sites)\b/i.test(text);

/**
 * Does a message read as the answers to the phone's website questions? Only when it gives a fact (a phone,
 * an email, a postcode, hours, prices, "name: …"), says to go ahead, or is short with no question and no
 * request of its own — never "remind me to ring Dr Patel at 4pm…", which is a message for the brain.
 */
export function looksLikeAnswers(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\b(just build( it)?|go ahead|use (the )?defaults|don'?t ask)\b/i.test(t)) return true;
  const f = briefFrom(t);
  if (f.phone || f.email || f.postcode || f.hours || f.services || /\b(?:name|called|town|area)\s*[:=]/i.test(t)) return true;
  if (t.length > 160 || t.split(/\s+/).length > 24) return false;
  if (/\?/.test(t)) return false;
  return !/^(?:please\s+|can you\s+|could you\s+|will you\s+|hey\s+|ok(?:ay)?\s+)?(?:remind|set|tell|what|when|where|who|why|how|play|call|ring|text|message|send|email|show|open|find|search|look|turn|add|book|delete|remove|check|navigate|take|translate|read|start|stop|cancel|pause|make|build|write|give|get|is|are|do|does|did|should|would|could|can|will)\b/i.test(t);
}

/**
 * The owner's answers to the questions `missing` asked, folded into the brief: anything recognisable
 * (a phone, an email, a postcode, hours, prices) wherever it is, then the plain pieces in the order the
 * questions were asked ("Fade & Co, Walsall, been going since 2016" → name, town, about).
 */
export function mergeAnswers(b: Brief, text: string, asked: (keyof Brief)[]): Brief {
  const found = briefFrom(text, { kind: b.kind });
  const out: Brief = { ...b };
  for (const k of ['phone', 'email', 'postcode', 'hours', 'services'] as const) if (found[k] && !out[k]) (out as unknown as Record<string, unknown>)[k] = found[k];
  const labelled = (re: RegExp) => text.match(re)?.[1]?.trim();
  const name = labelled(/\b(?:name|called)\s*[:=-]?\s*([^\n,;]+)/i);
  const town = labelled(/\b(?:town|area)\s*[:=-]\s*([^\n,;]+)/i) ?? found.town;
  if (name && !out.name) out.name = name;
  if (town && !out.town) out.town = town;
  // The rest, piece by piece, for the questions still open (in the order they were asked).
  const pieces = text
    .split(/[\n,;]/)
    .map((p) => p.trim())
    .filter((p) => p && !phoneOf(p) && !emailOf(p) && !postcodeOf(p) && !hoursOf(p) && !servicesOf(p) && !/^(name|town|area|called)\s*[:=-]?\s/i.test(p) && !(town && p.replace(/^(in|at)\s+/i, '') === town));
  for (const k of asked) {
    if (k === 'name' && !out.name && pieces.length) out.name = pieces.shift()!.replace(/^(it'?s|we'?re|called)\s+/i, '').slice(0, 60);
    else if (k === 'town' && !out.town && pieces.length && pieces[0]!.split(/\s+/).length <= 4) out.town = pieces.shift()!.replace(/^(in|at)\s+/i, '').slice(0, 40);
    else if (k === 'about' && !out.about && pieces.length) out.about = pieces.splice(0).join('. ').slice(0, 600);
  }
  return out;
}
