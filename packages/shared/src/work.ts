/**
 * THE WORK PACK, the pure parts (BRIEF-PACKS-2; OWNER-ISSUES 92 ④): a CV from the facts he tells and pastes, a cover letter
 * for a job ad he pastes (his facts only, the gaps said), interview practice and a plain critique of an answer, a meeting
 * summed up from notes, a to-do from a long message, an email in his voice (shown, never sent), a timesheet from his hours,
 * pay after tax (UK bands, a first estimate), a pomodoro, a word count and reading level, a shift rota. Pure: no storage, no
 * network. Nothing is invented: every line of a CV or a letter is one he gave; every number says what it assumed.
 */
import { card, type Card } from './cards';
import { inTone, whenWords, type Tone } from './people';
import { addDays, dayWords, mondayOf, pounds, prettyDay, shortId, weekdayOf } from './packs';

const pad = (n: number) => String(n).padStart(2, '0');
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
/** A pasted text capped at what the packs read (a job ad, notes, an answer). */
export const MAX_TEXT = 12_000;

const STOP = new Set(
  ('a an the and or but of to in on at for with from by as is are was were be been being have has had do does did will would can could should may might must shall this that these those it its you your we our they their i me my he she his her them us not no yes ' +
    'about into over under more most some any all each every other such than then also just very much many well able etc job role work working company candidate candidates applicant applicants looking required requirements essential desirable experience skills ability knowledge will need needed ideal successful position post').split(' '),
);
const stem = (w: string) => w.replace(/(?:ing|ed|es|s|ly)$/, '');
/** The words that count when matching an ad to his facts. */
export const keysOf = (t: string): Set<string> => new Set((t.toLowerCase().match(/[a-z][a-z0-9+#]{2,}/g) ?? []).filter((w) => !STOP.has(w)).map(stem).filter((w) => w.length > 2));

/** Words that mean the same kind of work (so "retail experience" finds "served customers on the tills"); never a licence or a skill name he did not give. */
const GROUPS: string[][] = [
  ['retail', 'shop', 'store', 'supermarket', 'till', 'cashier', 'customer', 'stock', 'shelf', 'shelves', 'stacker', 'checkout'],
  ['care', 'carer', 'nurs', 'patient', 'resident', 'elderly'],
  ['driving', 'driver', 'van', 'lorry', 'delivery', 'courier'],
  ['team', 'teamwork', 'colleague', 'together', 'collaborat'],
  ['communicat', 'customer', 'talk', 'speak', 'liaise', 'friendly'],
  ['lift', 'carry', 'physical', 'warehouse', 'loading', 'manual'],
  ['cook', 'chef', 'kitchen', 'catering', 'food', 'baking'],
  ['admin', 'office', 'filing', 'reception', 'spreadsheet', 'data entry'],
  ['sales', 'target', 'selling', 'commission'],
  ['teach', 'tutor', 'classroom', 'pupil'],
];
const GENERIC = new Set(['licence', 'license', 'full', 'good', 'great', 'strong', 'excellent', 'previous', 'relevant', 'basic', 'valid', 'current', 'clean', 'minimum', 'person', 'people', 'work', 'worked']);
const GROUP_STEMS = GROUPS.map((g) => g.map((w) => stem(w)));
/** What a text is about: its words (a licence or a "good" does not count alone) and the kinds of work it names. */
export function conceptsOf(t: string): Set<string> {
  const keys = keysOf(t);
  const out = new Set([...keys].filter((k) => !GENERIC.has(k)));
  GROUP_STEMS.forEach((g, i) => {
    if ([...keys].some((k) => g.some((w) => k === w || k.startsWith(w)))) out.add(`#${i}`);
  });
  return out;
}

// ---------------------------------------------------------------- a CV from what he tells

export type CvSection = 'profile' | 'experience' | 'education' | 'skills' | 'other';
export interface CvFact {
  id: string;
  sec: CvSection;
  /** His own words, tidied. */
  text: string;
  at: number;
}
export interface Cv {
  name?: string;
  email?: string;
  phone?: string;
  place?: string;
  facts: CvFact[];
}
export const emptyCv = (): Cv => ({ facts: [] });

const SECTION_ORDER: [CvSection, string][] = [['profile', 'PROFILE'], ['experience', 'EXPERIENCE'], ['education', 'EDUCATION'], ['skills', 'SKILLS AND LICENCES'], ['other', 'OTHER']];

/** Which part of a CV a sentence belongs to. */
export function cvSection(text: string): CvSection {
  const t = clean(text).toLowerCase().replace(/^(?:add to my cv|for my cv|cv)\s*[:\-–]?\s*/, '');
  if (/^(?:i am an?\b|i'?m an?\b|looking for\b|seeking\b|about me\b|my aim\b|a (?:hard|reliable|keen|motivated|friendly))/.test(t)) return 'profile';
  if (/\b(studied|degree|bsc|b\.?a\b|msc|gcses?|a-?levels?|btec|nvq|diploma|college|university|school|apprenticeship|graduated|qualified in|certificate in|course in)\b/.test(t)) return 'education';
  if (/\b(skills?|licen[cs]e|certified|certificate|fluent|speak|proficient|good at|can use|first aid|forklift|cscs|dbs|excel|microsoft|word|python|javascript|sql|driving|languages?|typing)\b/.test(t)) return 'skills';
  if (/^(?:i\s+)?(?:[a-z]+ed|ran|led|sold|built|taught|made|took|kept|dealt|spoke|wrote|drove|gave|looked after|cared for|set up)\b/.test(t) && !/\b(?:studied|qualified)\b/.test(t)) return 'experience';
  if (/\b(worked|working|work as|job|role|employed|volunteer\w*|internship|placement|shift|manager|supervisor|assistant|cashier|driver|since 20\d\d|from 20\d\d|years? (?:at|in|as))\b|\b(?:19|20)\d\d\s*(?:to|-|–|until)\s*(?:(?:19|20)\d\d|present|now|today)\b/.test(t)) return 'experience';
  return 'other';
}
/** His sentence as a CV line: "I worked at Tesco as a shelf stacker from 2019 to 2022" → "Worked at Tesco as a shelf stacker from 2019 to 2022". */
export function cvLine(text: string): string {
  const t = clean(text).replace(/^(?:add to my cv|for my cv|cv)\s*[:\-–]?\s*/i, '').replace(/^i(?:'ve| have| am|'m)?\s+/i, '').replace(/^(?:also|and)\s+/i, '').replace(/[.]+$/, '');
  return cap(t);
}
export interface CvUpdate {
  cv: Cv;
  added: CvFact[];
  contact: string[];
}
/** What he said folded into his CV: a name, an email, a phone, a place, or sentences by section. Nothing is made up. */
export function addToCv(cv: Cv, words: string, now: number): CvUpdate {
  const out: Cv = { ...cv, facts: [...cv.facts] };
  const contact: string[] = [];
  let rest = words;
  const email = /(?:(?:my )?e-?mail(?: address)?\s*(?:is|:)?\s*)?([\w.+-]+@[\w-]+(?:\.[\w-]+)+)/i.exec(rest);
  if (email) (out.email = email[1]!.toLowerCase()), contact.push('email'), (rest = rest.replace(email[0], ' '));
  const phone = /(?:(?:my )?(?:phone|mobile|number|tel)(?: number)?\s*(?:is|:)?\s*)?(\+?\d[\d\s()-]{8,16}\d)/i.exec(rest);
  if (phone && /\d{9,}/.test(phone[1]!.replace(/\D/g, ''))) (out.phone = clean(phone[1]!)), contact.push('phone'), (rest = rest.replace(phone[0], ' '));
  const name = /\bmy name is ([\p{L}'’-]+(?:\s+[\p{L}'’-]+){0,3})/iu.exec(rest);
  if (name) (out.name = name[1]!.split(/\s+/).map(cap).join(' ')), contact.push('name'), (rest = rest.replace(name[0], ' '));
  const place = /\bi (?:live|am based|'m based) in ([\p{L}'’ -]{2,30})/iu.exec(rest);
  if (place) (out.place = clean(place[1]!).split(' ').map(cap).join(' ')), contact.push('place'), (rest = rest.replace(place[0], ' '));
  const added: CvFact[] = [];
  for (const s of rest.split(/(?<=[.!?])\s+|\n+|;\s*/).map(clean).filter((x) => x.length > 8 && x.split(/\s+/).length >= 3 && keysOf(x).size > 0 && !/^(?:[A-Z][A-Z\s&/]{3,30}|[A-Za-z ]{3,25}:)$/.test(x))) {
    const text = cvLine(s);
    if (!text || out.facts.some((f) => f.text.toLowerCase() === text.toLowerCase())) continue;
    const f: CvFact = { id: shortId(), sec: cvSection(s), text, at: now };
    out.facts.push(f);
    added.push(f);
  }
  out.facts = out.facts.slice(-80);
  return { cv: out, added, contact };
}
/** The CV as plain text he can copy, section by section, every line one he gave. */
export function renderCv(cv: Cv): string {
  const head = [(cv.name ?? '').toUpperCase() || '[YOUR NAME]', [cv.place, cv.phone, cv.email].filter(Boolean).join(' · ')].filter(Boolean).join('\n');
  const parts = SECTION_ORDER.flatMap(([sec, title]) => {
    const f = cv.facts.filter((x) => x.sec === sec);
    if (!f.length) return [];
    return [`${title}\n${sec === 'profile' ? f.map((x) => x.text).join('. ') + '.' : f.map((x) => `- ${x.text}`).join('\n')}`];
  });
  return [head, ...parts].join('\n\n');
}
/** What is missing from a CV, in plain words (it is never filled in for him). */
export function cvGaps(cv: Cv): string[] {
  const has = (s: CvSection) => cv.facts.some((f) => f.sec === s);
  return [
    !cv.name ? 'your name ("my name is …")' : '',
    !cv.email && !cv.phone ? 'a phone or an email, so they can reach you' : '',
    !has('experience') ? 'any work or volunteering ("I worked at … as … from 2019 to 2022")' : '',
    !has('education') ? 'where you studied or trained' : '',
    !has('skills') ? 'skills and licences (driving, first aid, languages…)' : '',
  ].filter(Boolean);
}

// ---------------------------------------------------------------- a job ad, read

export interface Ad {
  title: string;
  company: string;
  place: string;
  pay: string;
  closing: string;
  requirements: string[];
  duties: string[];
  /** Plain statements of what looks wrong with the ad (empty: nothing I could see). */
  flags: string[];
}
const HEAD_REQ = /^(?:requirements?|essential(?: criteria| skills)?|desirable|you(?:'ll| will) (?:have|need|bring)|must have|what we(?:'re| are) looking for|about you|the ideal candidate|skills(?: and experience)?|person specification|qualifications)\b/i;
const HEAD_DUTY = /^(?:responsibilities|duties|key (?:tasks|responsibilities)|what you(?:'ll| will) do|your role|main duties)\b/i;
/** Lines that end a list of requirements or duties even when no blank line does (a pasted ad is often one paragraph). */
const END_LIST = /^(?:closing date|closes?\b|deadline|apply (?:by|now|here|online|today)|how to apply|to apply|salary\b|pay\s*(?::|rate\b|is\b|£)|hours?\s*:|benefits?\s*:|contact (?:us|details|email)|contact:|job type|contract\s*(?::|type\b))/i;
const CUE_REQ = /\b(must|essential|required|requires?|experience (?:of|in|with)|ability to|knowledge of|proven|years?['’]? experience|licen[cs]e|qualification|good communication|team player|desirable)\b/i;

/** A pasted job ad (or its one flattened line) read in code: the title, the company, the pay, what it asks for and what looks wrong. */
export function readAd(raw: string): Ad {
  const text = raw.replace(/\r/g, '').slice(0, MAX_TEXT);
  let lines = text.split('\n').map((l) => clean(l.replace(/^[\s•·*▪●–—-]+/, '')));
  if (lines.filter(Boolean).length < 3) lines = clean(text).split(/(?<=[.!?:])\s+|\s[-–•·▪●]\s/).map(clean);
  const grab = (re: RegExp) => clean(re.exec(text)?.[1] ?? '').replace(/[.,;]+$/, '');
  const labelled = grab(/(?:job title|position|vacancy|role)\s*[:\-–]\s*([^\n]{3,80})/i);
  const seeking = grab(/\b(?:seeking|looking for|hiring|recruiting|wanted)[:\s]+(?:an?|the)?\s*([A-Z][\w &/-]{3,50}?)(?=\s+(?:to|for|who|with|in|at|based)\b|[.,\n]|$)/);
  const lead = lines.find(Boolean) ?? '';
  const first = lead && lead.length <= 80 && !/[.!?]$/.test(lead) ? lead : '';
  // "Customer Assistant at Fairfield Foods, Leeds." : the title, the company and the place in one line
  const atLead = /^(?!(?:we|looking|seeking|hiring|wanted|join|apply|about|are|is|the|an?)\b)([A-Z][\w&/'’-]*(?:\s+[\w&/'’-]+){0,4})\s+(?:at|for|with)\s+([A-Z][\w&'’ -]{1,40}?)(?:,\s*([A-Z][\p{L}' -]{2,30}))?[.!]?$/u.exec(lead);
  const title = labelled || atLead?.[1] || first || seeking || 'the role';
  const company = grab(/(?:company|employer|organisation|organization)\s*[:\-–]\s*([^\n]{2,60})/i) || atLead?.[2] || grab(/\bat\s+([A-Z][\w&'’ -]{2,40}?)(?=[,.\n]|\s+(?:is|are|we|in|based)\b)/) || grab(/\b([A-Z][\w&'’ -]{2,40}?)\s+(?:is|are)\s+(?:looking|seeking|hiring|recruiting)/) || grab(/\bAbout\s+([A-Z][\w&'’ -]{2,40}?)(?=[:\n.])/);
  const place = grab(/(?:location|based in|located in|where)\s*[:\-–]?\s*([A-Z][\p{L}', -]{2,40})/iu) || atLead?.[3] || '';
  const pay = grab(/(£\s?\d[\d,]*(?:\.\d+)?(?:\s?[kK])?(?:\s?(?:-|–|to)\s?£?\s?\d[\d,]*(?:\.\d+)?(?:\s?[kK])?)?(?:\s?(?:per|an?|\/)\s?(?:hour|hr|annum|year|week|day|month)|\s?p\.?a\.?)?)/);
  const closing = grab(/(?:closing date|deadline|apply by|applications close|closes?)\s*[:\-–]?\s*(?:on\s+)?([^\n.;]{3,40})/i);
  const requirements: string[] = [];
  const duties: string[] = [];
  let into: string[] | null = null;
  for (const l of lines) {
    if (!l) {
      into = null;
      continue;
    }
    const head = l.replace(/:$/, '');
    if (END_LIST.test(l)) into = null;
    else if (HEAD_REQ.test(head) && l.length <= 60) into = requirements;
    else if (HEAD_DUTY.test(head) && l.length <= 60) into = duties;
    else if ((/:$/.test(l) && l.length < 50) || (l === l.toUpperCase() && l.length < 40 && /[A-Z]{4}/.test(l))) into = null;
    else if (into) for (const part of l.split(/;\s+/)) if (part.length > 6 && part.length <= 200) into.push(part.replace(/[.;]+$/, ''));
  }
  if (!requirements.length) for (const l of lines.filter(Boolean)) if (CUE_REQ.test(l) && l.length <= 200 && !requirements.includes(l)) requirements.push(l.replace(/[.;]+$/, ''));
  const flags: string[] = [];
  const t = text.toLowerCase();
  if (/\b(?:pay|send|transfer|deposit)\b[^.\n]{0,40}\b(?:fee|deposit|registration|admin|uniform|equipment|training)\b|registration fee|security deposit|upfront (?:fee|payment|cost)/.test(t)) flags.push('it asks you to pay money first (a real employer never charges you to start)');
  if (/\b(?:whatsapp|telegram|signal)\b/.test(t) && /\b(?:contact|message|apply|reply|text)\b/.test(t)) flags.push('it sends you to WhatsApp or Telegram to apply (real employers use a company email or site)');
  if (/@(?:gmail|yahoo|outlook|hotmail|aol|icloud)\./.test(t)) flags.push('the contact is a free email address, not the company’s own');
  if (/\b(?:passport|national insurance number|bank details|driving licen[cs]e number)\b[^.\n]{0,50}\b(?:to apply|before|with your application|upfront|now)\b/.test(t)) flags.push('it wants your passport, NI or bank details before an interview');
  if (/no experience[^.\n]{0,60}£\s?\d{3,}|£\s?\d{3,}\s*(?:a|per)\s*day|earn (?:up to )?£\s?\d{4,}|guaranteed (?:income|earnings)|unlimited (?:earning|income)/.test(t)) flags.push('the pay sounds too good for no experience');
  if (/commission[- ]only|investment required|be your own boss|buy (?:a )?(?:starter )?(?:kit|stock)/.test(t)) flags.push('it is commission only, or asks you to buy something to start');
  return { title: cap(title.slice(0, 80)), company, place, pay, closing, requirements: requirements.slice(0, 12), duties: duties.slice(0, 8), flags };
}
export function adWords(a: Ad): string {
  const head = [a.title, a.company && `at ${a.company}`, a.place && `in ${a.place}`, a.pay && `(${a.pay})`].filter(Boolean).join(' ');
  return [
    `${head}${a.closing ? `. Closes: ${a.closing}` : ''}.`,
    a.requirements.length ? `It asks for:\n${a.requirements.map((r) => `- ${r}`).join('\n')}` : 'I couldn’t find a list of what it asks for in the text.',
    a.duties.length ? `You would be doing:\n${a.duties.map((r) => `- ${r}`).join('\n')}` : '',
    a.flags.length ? `Careful: ${a.flags.join('; ')}.` : 'Nothing in it looks like a scam to me, but check the company yourself before you share personal details.',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- a cover letter from his facts only

const lowerFirst = (s: string) => (/^[A-Z](?![A-Z])/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
/** A CV line as a sentence of his in a letter: "Served customers on the tills" → "I served customers on the tills" (nothing added to it). */
function firstPerson(line: string, sec?: CvSection): string {
  if (/^(?:a|an)\s/i.test(line)) return `${sec === 'profile' ? 'I am' : 'I have'} ${lowerFirst(line)}`;
  if (/^(?:[A-Z][a-z]+ed|Ran|Led|Sold|Built|Taught|Made|Took|Kept|Dealt|Spoke|Wrote|Drove|Gave)\b/.test(line)) return `I ${lowerFirst(line)}`;
  return line;
}
export interface Letter {
  text: string;
  matched: { need: string; fact: string }[];
  gaps: string[];
}
/** The letter: the ad's requirements matched to the facts he gave (one by one), the rest listed as gaps. Never a fact he did not give. */
export function coverLetter(ad: Ad, cv: Cv): Letter {
  const facts = cv.facts.filter((f) => f.sec !== 'other');
  const matched: Letter['matched'] = [];
  const gaps: string[] = [];
  for (const need of ad.requirements) {
    const nk = conceptsOf(need);
    let best: { f: CvFact; score: number; kind: boolean } | null = null;
    for (const f of facts) {
      const fk = conceptsOf(f.text);
      const shared = [...nk].filter((k) => fk.has(k));
      if (shared.length > (best?.score ?? 0)) best = { f, score: shared.length, kind: shared.some((k) => k.startsWith('#')) };
    }
    if (best && (best.score >= 2 || best.kind || best.score / Math.max(1, nk.size) >= 0.3) && !matched.some((m) => m.fact === best!.f.text)) matched.push({ need, fact: best.f.text });
    else gaps.push(need);
  }
  const profile = cv.facts.find((f) => f.sec === 'profile')?.text;
  const to = ad.company ? `Dear ${ad.company} hiring team,` : 'Dear Hiring Manager,';
  const para = matched.slice(0, 4).map((m) => `You ask for “${m.need.replace(/[.;]+$/, '')}”. ${firstPerson(m.fact, cv.facts.find((f) => f.text === m.fact)?.sec)}.`);
  const body = [
    `I am writing to apply for the ${ad.title} role${ad.company ? ` at ${ad.company}` : ''}.`,
    profile && !matched.some((m) => m.fact === profile) ? `${firstPerson(profile, 'profile')}.` : '',
    ...(para.length ? [`Here is how my experience fits what you are looking for. ${para.join(' ')}`] : []),
    'I would welcome the chance to talk about the role. Thank you for considering my application.',
  ].filter(Boolean);
  const text = [to, '', body.join('\n\n'), '', 'Yours sincerely,', cv.name ?? '[your name]'].join('\n');
  return { text, matched, gaps };
}

// ---------------------------------------------------------------- interview practice and a plain critique

const COMMON_Q = [
  'Tell me about yourself.',
  'Why do you want this job?',
  'What are your strengths?',
  'Tell me about a time you dealt with a difficult situation.',
  'What would you say is your weakness, and what are you doing about it?',
  'Tell me about a time you worked as part of a team.',
  'Why should we hire you?',
  'Where do you see yourself in five years?',
  'Do you have any questions for us?',
];
const ROLE_Q: [RegExp, string, string[]][] = [
  [/retail|shop|store|cashier|sales assistant|customer service|supermarket/, 'retail and customer service', ['Tell me about a time you helped an unhappy customer.', 'How would you handle a queue and a till that has stopped working?', 'What does good customer service mean to you?']],
  [/care|support worker|nurs|health|hospital|carer/, 'care', ['Why do you want to work in care?', 'How would you treat someone who is upset or confused with dignity?', 'Tell me about a time you had to stay calm under pressure.']],
  [/admin|office|reception|clerk|data entry|secretary|pa\b/, 'office and admin', ['How do you organise your day when everything is urgent?', 'Tell me about a time you spotted a mistake before it caused a problem.', 'Which software have you used, and how comfortable are you with it?']],
  [/driver|delivery|courier|van|hgv|lorry/, 'driving and delivery', ['How do you plan a route and handle a delay?', 'What do you do if a parcel is damaged or the address is wrong?', 'How do you keep safe and alert on long days?']],
  [/kitchen|chef|cook|waiter|waitress|bar|hospitality|cafe|café|restaurant|barista/, 'hospitality', ['How do you cope when it is busy and everyone wants something?', 'Tell me about a time you worked a long or late shift.', 'What does food safety mean to you in practice?']],
  [/warehouse|picker|packer|forklift|logistics|stock/, 'warehouse', ['How do you keep up speed without losing accuracy?', 'Tell me about a time you followed a safety rule when it was easier not to.', 'How do you feel about physical work and early shifts?']],
  [/teach|teaching assistant|ta\b|school|tutor|nursery/, 'teaching', ['How would you support a child who is falling behind?', 'Tell me about a time you explained something difficult simply.', 'How would you handle a disagreement between two pupils?']],
  [/developer|software|it support|helpdesk|tech|engineer|programmer|data analyst/, 'tech', ['Tell me about something you built or fixed, and what you would do differently.', 'How do you explain a technical problem to someone who is not technical?', 'How do you keep learning?']],
  [/sales|business development|account manager|recruit/, 'sales', ['Tell me about a time you hit, or missed, a target.', 'How do you handle hearing "no"?', 'How would you win back a customer who left?']],
  [/builder|labourer|plumber|electrician|joiner|trade|construction|site|apprentice/, 'the trades', ['Tell me about a job you finished that you are proud of.', 'How do you keep yourself and others safe on site?', 'What would you do if you spotted a problem that was not yours to fix?']],
];
/** The questions for a role: "Tell me about yourself", three for the role, then the common ones. Same role, same questions. */
export function questionsFor(role: string, n = 6): { questions: string[]; kind: string } {
  const hit = ROLE_Q.find(([re]) => re.test(role.toLowerCase()));
  const rest = COMMON_Q.slice(1);
  const qs = [COMMON_Q[0]!, ...(hit ? hit[2] : [rest[0]!, rest[2]!, rest[4]!]), ...rest.filter((q) => !(hit ? hit[2] : []).includes(q))];
  return { questions: [...new Set(qs)].slice(0, Math.max(3, Math.min(9, n))), kind: hit?.[1] ?? 'any job' };
}

const FILLERS: [RegExp, string][] = [
  [/\b(?:um+|uh+|er+m?|ah+)\b/gi, 'um'],
  [/(?:^|[,.]\s*|\b(?:was|is|were|are|and|so|but|it'?s)\s+)like(?=[,\s])/gi, 'like'],
  [/\byou know\b/gi, 'you know'],
  [/\bi mean\b/gi, 'I mean'],
  [/\b(?:kind|sort) of\b/gi, 'kind of'],
  [/\bbasically\b/gi, 'basically'],
  [/\bliterally\b/gi, 'literally'],
  [/\bactually\b/gi, 'actually'],
  [/\bhonestly\b/gi, 'honestly'],
  [/\b(?:and )?stuff\b/gi, 'stuff'],
  [/\bi guess\b/gi, 'I guess'],
];
export interface Critique {
  words: number;
  secs: number;
  wpm: number;
  length: 'short' | 'good' | 'long';
  numbers: number;
  names: number;
  example: boolean;
  star: { situation: boolean; task: boolean; action: boolean; result: boolean };
  fillers: [string, number][];
  we: number;
  me: number;
  lines: string[];
  next: string;
}
/** A plain critique of an answer by its words and how long it took: length, specifics, shape, filler words. A rough guide, never a verdict on him. */
export function critique(answer: string, secs = 0): Critique {
  const text = clean(answer);
  const ws = text.match(/[\p{L}\p{N}'’-]+/gu) ?? [];
  const words = ws.length;
  const wpm = secs > 0 ? Math.round((words / secs) * 60) : 0;
  const len = secs > 0 ? secs : (words / 150) * 60;
  const length: Critique['length'] = len < 30 ? 'short' : len > 120 ? 'long' : 'good';
  const numbers = (text.match(/\b\d[\d,.]*%?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|dozen)\b/gi) ?? []).length;
  const names = (text.replace(/(^|[.!?]\s+)[A-Z]/g, '$1x').match(/\b[A-Z][a-z]{2,}\b/g) ?? []).filter((w) => !['I', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].includes(w)).length;
  const example = /\b(for example|for instance|one time|last (?:year|week|month|summer)|in 20\d\d|when i (?:was|worked)|at my (?:last|previous))\b/i.test(text);
  const star = {
    situation: /\b(when|while|during|last (?:year|week|month)|in (?:19|20)\d\d|at my (?:last|previous)|working (?:at|in|for)|we had)\b/i.test(text),
    task: /\b(needed to|had to|my (?:job|role|task|responsibility)|was asked|the goal|the aim|target|supposed to)\b/i.test(text),
    action: /\bi (?:decided|started|set|made|led|organi[sz]ed|created|built|fixed|trained|spoke|asked|offered|suggested|checked|called|wrote|planned|handled|dealt|helped|took|chose|stayed|worked out|came up)\b|\bso i\b/i.test(text),
    result: /\b(as a result|which meant|so we|the result|ended up|in the end|saved|increased|reduced|improved|finished|won|got (?:a|the|good)|managed to|feedback|thanked|praised|promoted|fixed it)\b/i.test(text),
  };
  const fillers = FILLERS.map(([re, label]) => [label, (text.match(re) ?? []).length] as [string, number]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const we = (text.match(/\b(?:we|our|us)\b/gi) ?? []).length;
  const me = (text.match(/\b(?:i|my|me|i'm|i've|i'd|i'll)\b/gi) ?? []).length;
  const lines: string[] = [];
  lines.push(`Length: ${secs > 0 ? `${Math.round(secs)} seconds, ` : ''}${words} words: ${length === 'good' ? 'about right (aim for 45 to 90 seconds)' : length === 'short' ? 'short; add a real example (aim for 45 to 90 seconds)' : 'long; cut it to the best example (aim for 45 to 90 seconds)'}.`);
  if (secs > 0 && words >= 20) lines.push(`Pace: ${wpm} words a minute: ${wpm < 110 ? 'slow; fine if you are thinking, but don’t trail off' : wpm > 170 ? 'quick; slow down so they can follow' : 'comfortable'}.`);
  const spec = numbers + names + (example ? 1 : 0);
  lines.push(`Specifics: ${numbers} number${numbers === 1 ? '' : 's'}, ${names} name${names === 1 ? '' : 's'} of places or things${example ? ', and a real example' : ''}: ${spec >= 3 ? 'good' : spec >= 1 ? 'a start; add a figure or a name' : 'none yet; add a number, a place or a name'}.`);
  const have = (['situation', 'task', 'action', 'result'] as const).filter((k) => star[k]);
  const missing = (['situation', 'task', 'action', 'result'] as const).filter((k) => !star[k]);
  lines.push(`Shape: ${have.length === 4 ? 'situation, task, action and result are all there' : `you gave the ${have.join(', ') || 'start'}${missing.length ? `, but not the ${missing.join(' or ')}` : ''}`}.`);
  lines.push(fillers.length ? `Filler: ${fillers.slice(0, 4).map(([w, n]) => `“${w}” ×${n}`).join(', ')}: a short pause says the same thing better.` : 'Filler: none I could pick out.');
  if (we > 2 * me && me < 4) lines.push('You say “we” a lot: say what YOU did.');
  const next = !star.result && words > 25 ? 'End on the result: what changed because of what you did (a number if you have one).'
    : spec === 0 ? 'Add one number, place or name so it sounds like it really happened.'
    : fillers.reduce((k, [, n]) => k + n, 0) >= 4 ? `Cut “${fillers[0]![0]}”: pause instead.`
    : length === 'short' ? 'Add the situation and what you did, step by step.'
    : length === 'long' ? 'Trim it to one example and a clear ending.'
    : !star.action ? 'Say what you did, starting “I …”.'
    : 'Nothing big to fix: practise it once more out loud.';
  return { words, secs: Math.round(secs), wpm, length, numbers, names, example, star, fillers, we, me, lines, next };
}

// ---------------------------------------------------------------- a meeting, summed up

export interface Meeting {
  attendees: string[];
  decisions: string[];
  actions: { who: string; what: string; due: string }[];
  questions: string[];
  notes: string[];
}
/** Notes (pasted, or a voice note's words) sorted into decisions, actions (who, what, by when), open questions and the rest. */
export function meetingNotes(raw: string, today: string): Meeting {
  const m: Meeting = { attendees: [], decisions: [], actions: [], questions: [], notes: [] };
  const sentences = raw.replace(/\r/g, '').slice(0, MAX_TEXT).split('\n').flatMap((l) => l.split(/(?<=[.!?])\s+/)).map((l) => clean(l.replace(/^[\s•·*▪●–—-]+|^\d+[.)]\s+/g, ''))).filter((l) => l.length > 3);
  for (const s of sentences) {
    const att = /^(?:attendees|present|in attendance|attending|apologies|with)\s*[:\-]\s*(.+)$/i.exec(s);
    if (att) {
      if (!/^apolog/i.test(s)) m.attendees.push(...att[1]!.split(/,|\band\b/).map(clean).filter((x) => x && x.length < 30));
      continue;
    }
    const due = /\b(?:by|before|due|on)\s+((?:next\s+)?(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat|sun)[a-z]*|tomorrow|today|end of (?:the )?(?:day|week|month)|eod|eow|next week|\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+[A-Za-z]{3,9}|[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?)\b/i.exec(s);
    const dueText = due ? (dayWords(due[1]!, today) || whenWords(due[1]!, today, '00:00')?.date || due[1]!) : '';
    const act = /^(?:action(?: point| item)?|todo|to-?do|ai|task|follow[- ]?up)\s*[:\-–]\s*(.+)$/i.exec(s);
    const owner = /^(@?[A-Z][\p{L}'’-]+|I|We)\s+(?:to|will|'ll|should|needs? to|is going to|are going to|has to|have to|must|agreed to|can|shall)\s+(.+)$/u.exec(act ? act[1]! : s);
    const group = /^(?:we|the team|everyone|all|it was|they|management|the group|the committee)\b/i.test(s) && /\b(?:decided|agreed|approved|confirmed|resolved|signed off|will go with|going with|settled on)\b/i.test(s) && !act;
    if (!group && (act || owner || (due && /\b(?:send|book|draft|finish|prepare|share|update|check|call|email|review|sort|confirm|arrange|write|set up|follow up|chase)\b/i.test(s)))) {
      const body = owner ? owner[2]! : act ? act[1]! : s;
      const who = owner ? (owner[1] === 'I' ? 'me' : owner[1] === 'We' ? 'the team' : owner[1]!.replace(/^@/, '')) : /\bowner\s*[:\-]\s*(\w+)/i.exec(s)?.[1] ?? '';
      const plain = clean(body).replace(/[.!]+$/, '');
      m.actions.push({ who, what: cap(dueText ? plain.replace(/\s+\b(?:by|before|due)\s+[^,.]+$/i, '') : plain), due: dueText });
    } else if (/\b(?:decided|agreed|approved|confirmed|resolved|signed off|will go with|going with|settled on|decision)\b/i.test(s)) m.decisions.push(cap(s.replace(/[.]+$/, '')));
    else if (/\?$|^(?:question|open question|tbc|unclear)\b|\b(?:tbc|tbd|not sure|unclear|need to find out|to be confirmed)\b/i.test(s)) m.questions.push(cap(s.replace(/[.]+$/, '')));
    else m.notes.push(cap(s.replace(/[.]+$/, '')));
  }
  m.attendees = [...new Set(m.attendees)].slice(0, 12);
  return { ...m, decisions: m.decisions.slice(0, 8), actions: m.actions.slice(0, 10), questions: m.questions.slice(0, 6), notes: m.notes.slice(0, 4) };
}
export function meetingWords(m: Meeting, today: string): string {
  const day = (d: string) => (/^\d{4}-\d\d-\d\d$/.test(d) ? prettyDay(d, today.slice(0, 4)) : d);
  return [
    m.attendees.length ? `Who was there: ${m.attendees.join(', ')}.` : '',
    m.decisions.length ? `Decisions:\n${m.decisions.map((x) => `- ${x}`).join('\n')}` : 'Decisions: none I could pick out (look for “agreed” or “decided” in your notes).',
    m.actions.length ? `Actions:\n${m.actions.map((a) => `- ${a.who ? `${cap(a.who)}: ` : ''}${a.what}${a.due ? ` (by ${day(a.due)})` : ''}`).join('\n')}` : 'Actions: none I could pick out.',
    m.questions.length ? `Still open:\n${m.questions.map((x) => `- ${x}`).join('\n')}` : '',
    m.notes.length ? `Also said: ${m.notes.join('; ')}.` : '',
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- a to-do from a long message

export interface Todo {
  id: string;
  text: string;
  due?: string;
  high?: boolean;
  done?: boolean;
  at: number;
}
const LEAD = /^(?:(?:i|we)\s+(?:also\s+)?(?:need|have|want|must|should|ought)\s+to|need to|have to|got to|gotta|must|should|remember to|don'?t forget to|do not forget to|please|also|and|then|first(?:ly)?|next|finally|todo\s*:?|to-?do\s*:?)\s+/i;
const AND_JOB = /\s+and\s+(?=(?:ring|call|phone|text|email|message|send|buy|get|pick|book|pay|order|check|fix|write|clean|tidy|collect|return|cancel|renew|post|print|sort|find|make|take|ask|tell|remind|look|arrange|organise|organize|prepare|finish|start|update|submit|fill|sign|apply|wash|cook|water|feed|walk|charge|change|empty|put|drop|visit|meet|plan|reply|respond|chase|clear|cut|paint|measure|pack|hoover|vacuum|iron|drive|wrap|bring|confirm|speak|talk)\b)/i;
/** The jobs in a long message: one to a line, bullet or sentence; the cue words off the front; a deadline and an urgency picked out. */
export function todosFrom(raw: string, today: string, now: number): Todo[] {
  const chunks = raw.replace(/\r/g, '').slice(0, MAX_TEXT).split(/\n+|(?<=[.!?;])\s+|\s+(?:and then|then|after that)\s+|,\s+(?=(?:and\s+)?(?:remember to|don'?t forget|also|then)\b)/i).map((c) => clean(c.replace(/^[\s•·*▪●–—-]+|^\d+[.)]\s+/g, '')));
  const out: Todo[] = [];
  for (const c of chunks) {
    if (c.length < 4 || /\?$/.test(c) || /^(?:thanks|thank you|cheers|bye)\b/i.test(c)) continue;
    let t = c.replace(/^(?:(?:right|ok|okay|so|well|anyway|hi|hey|hello|ah)[,.!]?\s+)+/i, '');
    for (let i = 0; i < 3 && LEAD.test(t); i++) t = t.replace(LEAD, '');
    t = t.replace(/[.!]+$/, '');
    if (t.length < 3 || !/[a-z]/i.test(t)) continue;
    const high = /\b(urgent(?:ly)?|asap|important|immediately|right away)\b/i.test(t);
    const dm = /\b(?:by|before|on|for|until)\s+((?:next\s+)?(?:mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat|sun)[a-z]*|tomorrow|today|tonight|\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?(?:\s+of)?\s+[A-Za-z]{3,9}|[A-Za-z]{3,9}\s+\d{1,2}(?:st|nd|rd|th)?)\b/i.exec(t);
    const due = dm ? dayWords(dm[1]!, today) || whenWords(dm[1]!, today, '00:00')?.date || '' : /\btomorrow\b/i.test(t) ? addDays(today, 1) : /\btoday\b|\btonight\b/i.test(t) ? today : '';
    const text = cap(clean(t.replace(/\b(urgent(?:ly)?|asap)\b[:,!]?/gi, '').replace(dm && due ? new RegExp(`\\s*\\b${dm[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i') : /$^/, '')).replace(/\s*[-–,]\s*$/, '').replace(/!+$/, ''));
    // "ring the plumber and send the invoice by Friday": two jobs when both halves begin with a doing word; the day and the urgency go with both
    for (const part of text.split(AND_JOB)) {
      const one = cap(part.trim());
      if (one.length >= 3 && !out.some((x) => x.text.toLowerCase() === one.toLowerCase())) out.push({ id: shortId(), text: one, ...(due ? { due } : {}), ...(high ? { high: true } : {}), at: now });
    }
  }
  return out.slice(0, 30);
}
/** Open items first: urgent and due soonest on top. */
export const todoOrder = (list: Todo[]): Todo[] => [...list].sort((a, b) => Number(!!a.done) - Number(!!b.done) || (a.due && b.due ? (a.due < b.due ? -1 : a.due > b.due ? 1 : 0) : a.due ? -1 : b.due ? 1 : 0) || Number(!!b.high) - Number(!!a.high) || a.at - b.at);
export function todoWords(list: Todo[], today: string): string {
  const open = todoOrder(list).filter((t) => !t.done);
  if (!open.length) return 'Your to-do list is empty.';
  return `Your to-do list (${open.length} open):\n${open.map((t, i) => `${i + 1}. ${t.text}${t.due ? ` (${t.due < today ? 'was due ' : 'by '}${prettyDay(t.due, today.slice(0, 4))})` : ''}${t.high ? ' [urgent]' : ''}`).join('\n')}`;
}

// ---------------------------------------------------------------- an email in his voice

const PURPOSES: [RegExp, string, string][] = [
  [/\b(?:holiday|annual leave|time off|days? off|\w+day off|leave)\b/i, 'Request for time off', 'I would like to request time off. Please let me know if that works, and if you need anything else from me.'],
  [/\b(?:sick|unwell|ill|not well)\b/i, 'Off sick today', 'I am unwell and will not be able to work today. I will keep you updated, and I will let you know when I expect to be back.'],
  [/\b(?:late|delayed|running behind)\b/i, 'Running late', 'I am running late and will be with you as soon as I can. I am sorry for any inconvenience.'],
  [/\b(?:resign|resignation|notice)\b/i, 'Resignation', 'I am writing to give notice of my resignation. I am happy to help with a handover during my notice period.'],
  [/\b(?:invoice|payment|overdue|chase)\b/i, 'Payment reminder', 'I am following up on a payment that is still outstanding. Could you let me know when I can expect it?'],
  [/\b(?:complain|complaint)\b/i, 'Complaint', 'I am writing to complain. I would like it looked into and a reply telling me what you will do.'],
  [/\b(?:thank you for the interview|after (?:my|the) interview|interview)\b/i, 'Thank you for the interview', 'Thank you for taking the time to meet me. I enjoyed learning more about the role and I remain very interested.'],
  [/\b(?:reference|referee)\b/i, 'Reference request', 'I am applying for a role and would be grateful if you would act as a referee for me. Please let me know if you are happy to.'],
  [/\b(?:follow up|following up|checking in|any update)\b/i, 'Following up', 'I am following up on my earlier message. Do you have an update?'],
  [/\b(?:meet|meeting|catch up|call)\b/i, 'Request to meet', 'I would like to arrange a time to talk. Could you let me know when you are free?'],
  [/\b(?:decline|turn down|can'?t accept|no thank)/i, 'Thank you for the offer', 'Thank you for the offer. After careful thought I have decided not to take it forward. I appreciate your time.'],
];
export interface Email {
  subject: string;
  body: string;
  to: string;
}
/** An email: the purpose's plain wording, his own details added as he gave them, his greeting and sign-off. Shown to him; it sends nothing. */
export function emailDraft(o: { purpose: string; to?: string; details?: string; from?: string; subject?: string }, tone: Tone | null): Email {
  const hit = PURPOSES.find(([re]) => re.test(o.purpose));
  const details = clean(o.details ?? '');
  const subject = o.subject?.trim() || hit?.[1] || cap(clean(o.purpose).split(/[.!?]/)[0]!.slice(0, 60)) || 'Hello';
  const para = [hit?.[2] ?? '', details ? `${cap(details).replace(/[.]*$/, '.')}` : ''].filter(Boolean).join(' ') || cap(clean(o.purpose).replace(/[.]*$/, '.'));
  const casual = !!tone && !tone.formal;
  const raw = (o.to ?? '').replace(/@.*$/, '').trim();
  const name = /^(?:manager|boss|supervisor|hr|team|landlord|landlady|school|doctor|company|sir|madam|whoever|everyone|them)$/i.test(raw) ? '' : raw;
  const hello = casual ? `${cap(tone!.greet || 'Hi')}${name ? ` ${cap(name.split(/[\s.]/)[0]!)}` : ''},` : name ? `Dear ${cap(name)},` : 'Hello,';
  const sign = casual && tone!.signoff ? cap(tone!.signoff) : 'Kind regards';
  const body = `${hello}\n\n${para}\n\n${sign},\n${o.from ?? ''}`.trimEnd();
  return { subject, body: casual ? inTone(body, { ...tone!, signoff: '', emoji: false, kisses: false }) : body, to: /@/.test(o.to ?? '') ? o.to! : '' };
}
/** The link that opens the draft in his mail app on his tap (nothing is sent by it). */
export const mailtoOf = (e: Email): string => `mailto:${encodeURIComponent(e.to)}?subject=${encodeURIComponent(e.subject)}&body=${encodeURIComponent(e.body)}`;

// ---------------------------------------------------------------- hours and a timesheet

export interface DayHours {
  kind: 'work' | 'sick' | 'holiday' | 'off';
  /** Minutes worked (paid, after any break). */
  mins: number;
  from?: string;
  to?: string;
  brk?: number;
}
export interface Hours {
  contract?: number;
  rate?: number;
  days: Record<string, DayHours>;
}
const hmToMin = (h: number, m: number) => h * 60 + m;
const minText = (mins: number) => `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`;
export { minText };
const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
/** A time range in his words ("9 to 5", "8:30-16:30", "10am-6pm", "22:00 to 06:00") as minutes from midnight; the end is the afternoon when it is smaller. */
export function timeRange(words: string): { from: number; to: number } | null {
  const m = /\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:to|-|–|until|till)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\b/i.exec(words);
  if (!m) return null;
  let h1 = +m[1]!;
  let h2 = +m[4]!;
  const m1 = +(m[2] ?? 0);
  const m2 = +(m[5] ?? 0);
  if (h1 > 23 || h2 > 24 || m1 > 59 || m2 > 59) return null;
  if (m[3]?.toLowerCase() === 'pm' && h1 < 12) h1 += 12;
  if (m[3]?.toLowerCase() === 'am' && h1 === 12) h1 = 0;
  if (m[6]?.toLowerCase() === 'pm' && h2 < 12) h2 += 12;
  if (m[6]?.toLowerCase() === 'am' && h2 === 12) h2 = 0;
  const from = hmToMin(h1, m1);
  let to = hmToMin(h2, m2);
  if (to <= from) to += !m[6] && to + 12 * 60 > from ? 12 * 60 : 24 * 60;
  return { from, to };
}
const hhmm = (mins: number) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;
/** "worked Monday 9 to 5 with a 30 min break", "Tue 6 hours", "sick Thursday", "holiday Friday", "yesterday 8:30-16:30": the day and what he did. */
export function parseHours(words: string, today: string): { date: string; day: DayHours; assumed: string[] } | null {
  const w = words.toLowerCase();
  const assumed: string[] = [];
  let date = '';
  if (/\byesterday\b/.test(w)) date = addDays(today, -1);
  else if (/\btoday\b|\btonight\b/.test(w)) date = today;
  else {
    const d = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\b/.exec(w);
    if (d) {
      const target = WD.findIndex((x) => x.startsWith(d[1]!.slice(0, 3)));
      date = addDays(today, -((weekdayOf(today) - target + 7) % 7));
      if (date === today && !/\btoday\b/.test(w)) date = today;
    } else date = dayWords(words, today);
  }
  if (!date) return null;
  const kind: DayHours['kind'] = /\bsick\b|\bill\b|\bunwell\b/.test(w) ? 'sick' : /\bholiday\b|\bannual leave\b|\bleave\b/.test(w) ? 'holiday' : /\b(?:day off|off work|rest day)\b|^off\b/.test(w) ? 'off' : 'work';
  const r = timeRange(words);
  let brk = 0;
  const bm = /(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|h(?:ou)?rs?|h)\s*(?:unpaid\s*)?(?:break|lunch)/i.exec(words) ?? /(?:break|lunch)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(min(?:ute)?s?|h(?:ou)?rs?|h)\b/i.exec(words);
  if (bm) brk = /^h/i.test(bm[2]!) ? Math.round(+bm[1]! * 60) : Math.round(+bm[1]!);
  else if (/\bhalf (?:an )?hour (?:break|lunch)/.test(w)) brk = 30;
  else if (/\b(?:an )?hour (?:for )?(?:break|lunch)/.test(w)) brk = 60;
  if (r) {
    const mins = Math.max(0, r.to - r.from - brk);
    if (!brk && kind === 'work') assumed.push('no break taken off, as you mentioned none');
    return { date, day: { kind, mins, from: hhmm(r.from), to: hhmm(r.to), ...(brk ? { brk } : {}) }, assumed };
  }
  const hrs = /(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)\b/i.exec(words);
  if (hrs && kind === 'work') return { date, day: { kind, mins: Math.round(+hrs[1]! * 60) }, assumed };
  if (kind !== 'work') return { date, day: { kind, mins: 0 }, assumed };
  return null;
}
/** The week (Monday to Sunday) that holds a day: each day, the total, against his contract, and his pay if he gave a rate. */
export function hoursWeek(h: Hours, from: string): { monday: string; rows: { date: string; day?: DayHours }[]; total: number; sick: number; holiday: number } {
  const monday = mondayOf(from);
  const rows = Array.from({ length: 7 }, (_, i) => ({ date: addDays(monday, i), ...(h.days[addDays(monday, i)] ? { day: h.days[addDays(monday, i)]! } : {}) }));
  return { monday, rows, total: rows.reduce((k, r) => k + (r.day?.kind === 'work' ? r.day.mins : 0), 0), sick: rows.filter((r) => r.day?.kind === 'sick').length, holiday: rows.filter((r) => r.day?.kind === 'holiday').length };
}
export function hoursWords(h: Hours, from: string, today: string): string {
  const w = hoursWeek(h, from);
  const lines = w.rows.filter((r) => r.day).map((r) => `- ${prettyDay(r.date, today.slice(0, 4))}: ${r.day!.kind === 'work' ? `${r.day!.from ? `${r.day!.from}–${r.day!.to}${r.day!.brk ? `, ${r.day!.brk} min break` : ''} = ` : ''}${minText(r.day!.mins)}` : r.day!.kind === 'sick' ? 'sick' : r.day!.kind === 'holiday' ? 'holiday' : 'off'}`);
  if (!lines.length) return `Nothing logged for the week of ${prettyDay(w.monday, today.slice(0, 4))}. Say "worked Monday 9 to 5 with a 30 minute break".`;
  const over = h.contract ? w.total - Math.round(h.contract * 60) : 0;
  const pay = h.rate ? ` At ${pounds(h.rate)} an hour that is ${pounds(Math.round((w.total / 60) * h.rate * 100) / 100)} before tax.` : '';
  return `Week of ${prettyDay(w.monday, today.slice(0, 4))}:\n${lines.join('\n')}\nTotal ${minText(w.total)}${h.contract ? ` against ${h.contract} hours a week${over > 0 ? `: ${minText(over)} over` : over < 0 ? `: ${minText(-over)} under` : ': exactly'}` : ''}.${pay}`;
}

// ---------------------------------------------------------------- pay after tax

export const TAX_YEAR = '2026/27';
const PA = 12_570;
const BASIC_BAND = 37_700;
const ADD_THRESHOLD = 125_140;
const NI_PT = 12_570;
const NI_UEL = 50_270;
/** Student loan repayment thresholds a year as I have them for the tax year (check gov.uk): the share above is 9%, a postgraduate loan 6%. */
export const LOANS: Record<string, { threshold: number; rate: number; name: string }> = {
  '1': { threshold: 26_900, rate: 0.09, name: 'Plan 1' },
  '2': { threshold: 29_385, rate: 0.09, name: 'Plan 2' },
  '4': { threshold: 33_795, rate: 0.09, name: 'Plan 4' },
  '5': { threshold: 25_000, rate: 0.09, name: 'Plan 5' },
  pg: { threshold: 21_000, rate: 0.06, name: 'Postgraduate loan' },
};
export interface PayInput {
  /** Gross a year. */
  annual: number;
  pensionPct?: number;
  loan?: keyof typeof LOANS;
  /** A tax code's number (1257 for 1257L). */
  code?: number;
}
export interface Pay {
  gross: number;
  pension: number;
  tax: number;
  ni: number;
  loan: number;
  net: number;
  allowance: number;
}
const r2 = (n: number) => Math.round(n * 100) / 100;
/** Income tax and employee National Insurance on a yearly pay for England, Wales and Northern Ireland, and the rest of the pay to take home. */
export function payAfterTax(i: PayInput): Pay {
  const gross = Math.max(0, i.annual);
  const pension = r2(gross * Math.max(0, Math.min(100, i.pensionPct ?? 0)) / 100);
  const income = gross - pension;
  let allowance = i.code ? i.code * 10 + 9 : PA;
  if (income > 100_000) allowance = Math.max(0, allowance - (income - 100_000) / 2);
  const taxable = Math.max(0, income - allowance);
  const tax = r2(0.2 * Math.min(taxable, BASIC_BAND) + 0.4 * Math.max(0, Math.min(taxable, ADD_THRESHOLD) - BASIC_BAND) + 0.45 * Math.max(0, taxable - ADD_THRESHOLD));
  const ni = r2(0.08 * Math.max(0, Math.min(gross, NI_UEL) - NI_PT) + 0.02 * Math.max(0, gross - NI_UEL));
  const l = i.loan ? LOANS[i.loan] : undefined;
  const loan = l ? r2(l.rate * Math.max(0, gross - l.threshold)) : 0;
  return { gross, pension, tax, ni, loan, net: r2(gross - pension - tax - ni - loan), allowance };
}
export interface PayAsk {
  annual: number;
  perWeek: number;
  said: string;
  pensionPct: number;
  loan?: keyof typeof LOANS;
  code?: number;
  scotland: boolean;
  assumed: string[];
}
/** "£30,000 a year", "£2,500 a month", "£15.50 an hour for 37.5 hours", "£600 a week with 5% pension, plan 2": pay in his words. */
export function parsePay(words: string): PayAsk | null {
  const w = words.toLowerCase().replace(/,/g, '');
  const m = /£\s?(\d+(?:\.\d+)?)\s?(k)?|(\d+(?:\.\d+)?)\s?(k)\b|\b(\d{4,6}(?:\.\d+)?)\b/.exec(w);
  if (!m) return null;
  let amt = +(m[1] ?? m[3] ?? m[5]!);
  if (m[2] || m[4]) amt *= 1000;
  if (!(amt > 0)) return null;
  const assumed: string[] = [];
  const hours = +(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\s*(?:a|per|\/)\s*week|(\d+(?:\.\d+)?)\s*h\s*(?:a|per|\/)\s*week/.exec(w)?.[1] ?? NaN);
  const perWeek = Number.isFinite(hours) ? hours : 37.5;
  const period = /\b(?:an? )?hour(?:ly)?\b|\/\s?h(?:ou)?r\b|\bph\b/.test(w) ? 'hour' : /\b(?:per |a |every )?month(?:ly)?\b|\bpcm\b/.test(w) ? 'month' : /\b(?:per |a |every )?week(?:ly)?\b/.test(w) ? 'week' : /\b(?:per |a |every )?day\b|\bdaily\b/.test(w) ? 'day' : /\byear\b|\bannum\b|\bp\.?a\b|\bsalary\b/.test(w) ? 'year' : amt >= 1000 ? 'year' : 'hour';
  if (!/\byear\b|\bannum\b|\bmonth|\bweek|\bhour|\bday|\bpcm\b|\bsalary\b|\bph\b/.test(w)) assumed.push(`${amt >= 1000 ? 'a year' : 'an hour'}, as you gave no period`);
  let annual = period === 'year' ? amt : period === 'month' ? amt * 12 : period === 'week' ? amt * 52 : period === 'day' ? amt * 5 * 52 : amt * perWeek * 52;
  if (period === 'hour' && !Number.isFinite(hours)) assumed.push('37.5 hours a week, as you gave no hours');
  if (period === 'day') assumed.push('5 days a week');
  annual = r2(annual);
  const pension = /(\d+(?:\.\d+)?)\s*%\s*(?:into (?:a |my )?)?pension|pension\s*(?:of|at|:)?\s*(\d+(?:\.\d+)?)\s*%/.exec(w);
  const loan = /\bpost ?grad(?:uate)?\b/.test(w) ? 'pg' : (/\bplan\s*(1|2|4|5)\b/.exec(w)?.[1] as keyof typeof LOANS | undefined);
  const code = /\b(?:tax )?code\s*(\d{3,4})\s*l\b|\b(\d{3,4})l\b/.exec(w);
  return { annual, perWeek, said: `${pounds(amt)} ${period === 'year' ? 'a year' : period === 'month' ? 'a month' : period === 'week' ? 'a week' : period === 'day' ? 'a day' : `an hour for ${perWeek} hours a week`}`, pensionPct: pension ? +(pension[1] ?? pension[2]!) : 0, ...(loan ? { loan } : {}), ...(code ? { code: +(code[1] ?? code[2]!) } : {}), scotland: /\bscot/.test(w), assumed };
}
export function payWords(ask: PayAsk, p: Pay): string {
  const per = (n: number, d: number) => pounds(Math.round((n / d) * 100) / 100);
  const l = ask.loan ? LOANS[ask.loan] : undefined;
  return [
    `${ask.said}${ask.said.includes('a year') ? '' : ` is ${pounds(ask.annual)} a year`}, before tax. Take-home after tax and National Insurance${l ? `, ${l.name}` : ''}${ask.pensionPct ? ` and ${ask.pensionPct}% pension` : ''}:`,
    `- ${per(p.net, 12)} a month (${pounds(r2(p.net))} a year, ${per(p.net, 52)} a week)`,
    `- income tax ${pounds(p.tax)}, National Insurance ${pounds(p.ni)}${p.pension ? `, pension ${pounds(p.pension)}` : ''}${p.loan ? `, student loan ${pounds(p.loan)}` : ''} a year: ${p.gross ? Math.round(((p.tax + p.ni) / p.gross) * 100) : 0}% of your pay goes in tax and NI`,
    ask.scotland ? 'Scotland has its own income tax bands: this is the rest-of-the-UK figure, so yours will differ a little.' : '',
    `Assumed: England, Wales or Northern Ireland bands for ${TAX_YEAR} (personal allowance ${pounds(PA)}, 20% to ${pounds(NI_UEL)}, 40% to ${pounds(ADD_THRESHOLD)}, 45% above); employee National Insurance 8% to ${pounds(NI_UEL)} and 2% above; tax code ${ask.code ? `${ask.code}L` : '1257L'}; ${ask.pensionPct ? 'pension taken before tax (net pay), ' : 'no pension, '}${l ? `${l.name} paid at ${Math.round(l.rate * 100)}% above ${pounds(l.threshold)}` : 'no student loan'}, no other income or benefits${ask.assumed.length ? `; ${ask.assumed.join('; ')}` : ''}. A first estimate, not advice: your payslip is the truth.`,
  ].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- a pomodoro

/** The phone opens interview practice with no model ("interview practice for a care job", "mock interview"). */
export const INTERVIEW_ASK = /^(?:(?:let'?s |can we |i want to |i'?d like to |help me )?(?:do |start |have |run |try )?(?:an? |some )?(?:mock interview|interview practice|interview questions)|(?:help me )?practi[sc]e (?:for )?(?:my |an? )?interview)(?:\s+(?:for|as)\s+(?:an? |the )?(.+?))?[.!?]*$/i;
/** The phone sets (or stops) a pomodoro on its own timers with no model ("start a pomodoro", "pomodoro 2 rounds", "stop the pomodoro"). */
export const POMO_ASK = /^(?:(?:start|begin|set|do|run|put on)\s+)?(?:an?\s+|the\s+|my\s+)?(?:pomodoro|pomodoros|focus timer)\b(.*)$|^(?:stop|cancel|end)\s+(?:the\s+|my\s+)?pomodoro\b(.*)$/i;

export interface Pomo {
  rounds: number;
  focus: number;
  rest: number;
  long: number;
  /** For the phone's timers: cumulative seconds from now. */
  timers: { secs: number; name: string; say: string }[];
  totalMins: number;
}
/** "pomodoro", "pomodoro 4", "6 pomodoros", "focus 50 with 10 break", "30/5": the rounds as timers that ring one after another. */
export function pomodoroPlan(words: string): Pomo {
  const w = words.toLowerCase();
  const slash = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/.exec(w);
  const mins = [...w.matchAll(/(\d{1,3})\s*-?\s*min(?:ute)?s?(?:\s+(break|rest))?/g)];
  const focusM = /\b(?:focus|work|study)\s*(?:for\s*)?(\d{1,3})\b/.exec(w);
  const restM = /\b(?:break|rest)\s*(?:of\s*)?(\d{1,2})\b/.exec(w);
  const roundsM = /\b(\d{1,2})\s*(?:pomodoros?|rounds?|cycles?|sessions?)\b|\bpomodoro\s*(?:x|×)?\s*(\d{1,2})\b/.exec(w);
  const focusN = mins.find((x) => !x[2]);
  const restN = mins.find((x) => x[2]);
  const focus = Math.min(90, Math.max(5, slash ? +slash[1]! : focusN ? +focusN[1]! : focusM ? +focusM[1]! : 25));
  const rest = Math.min(30, Math.max(1, slash ? +slash[2]! : restN ? +restN[1]! : restM ? +restM[1]! : 5));
  const rounds = Math.min(8, Math.max(1, roundsM ? +(roundsM[1] ?? roundsM[2]!) : 4));
  const long = 15;
  const timers: Pomo['timers'] = [];
  let at = 0;
  for (let i = 1; i <= rounds; i++) {
    at += focus * 60;
    const last = i === rounds;
    const longBreak = last && rounds >= 4;
    timers.push({ secs: at, name: `pomodoro focus ${i}`, say: last && !longBreak ? `Focus ${i} of ${rounds} done. That’s the set: well done.` : `Focus ${i} of ${rounds} done. Take a ${longBreak ? long : rest} minute break.` });
    if (!last || longBreak) {
      at += (longBreak ? long : rest) * 60;
      timers.push({ secs: at, name: `pomodoro break ${i}`, say: last ? 'Long break over. That’s the set: well done.' : `Break over. Focus ${i + 1} of ${rounds}: back to it.` });
    }
  }
  return { rounds, focus, rest, long, timers, totalMins: Math.round(at / 60) };
}

// ---------------------------------------------------------------- a word count and a reading level

export const syllables = (word: string): number => {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  let n = (w.match(/[aeiouy]+/g) ?? []).length;
  if (/e$/.test(w) && !/(?:[^aeiou]le|ee)$/.test(w) && n > 1) n--;
  else if (/[^aeioutd]ed$/.test(w) && n > 1) n--;
  return Math.max(1, n);
};
export interface TextStats {
  words: number;
  sentences: number;
  chars: number;
  syllables: number;
  perSentence: number;
  longest: number;
  longWords: number;
  ease: number;
  grade: number;
  readMins: number;
  speakMins: number;
  readSecs: number;
  speakSecs: number;
}
/** Words, sentences, the reading ease (Flesch) and grade (Flesch-Kincaid), and how long it takes to read or say. */
export function textStats(text: string): TextStats | null {
  const t = text.slice(0, 60_000);
  const ws = t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  if (!ws.length) return null;
  const sents = t.split(/(?<=[.!?])\s+|\n{2,}/).map((s) => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? []).length).filter((n) => n > 0);
  const sentences = Math.max(1, sents.length);
  const syl = ws.reduce((k, w) => k + syllables(w), 0);
  const wps = ws.length / sentences;
  const spw = syl / ws.length;
  return {
    words: ws.length,
    sentences,
    chars: t.length,
    syllables: syl,
    perSentence: Math.round(wps * 10) / 10,
    longest: Math.max(0, ...sents),
    longWords: ws.filter((w) => syllables(w) >= 3).length,
    ease: Math.round((206.835 - 1.015 * wps - 84.6 * spw) * 10) / 10,
    grade: Math.round((0.39 * wps + 11.8 * spw - 15.59) * 10) / 10,
    readMins: Math.round((ws.length / 238) * 10) / 10,
    speakMins: Math.round((ws.length / 150) * 10) / 10,
    readSecs: Math.round((ws.length / 238) * 60),
    speakSecs: Math.round((ws.length / 150) * 60),
  };
}
const mins = (secs: number) => (secs < 60 ? `${Math.max(1, secs)} seconds` : `${Math.round(secs / 6) / 10 === 1 ? '1 minute' : `${Math.round(secs / 6) / 10} minutes`}`);
export function textWords(s: TextStats): string {
  const level = s.ease >= 90 ? 'very easy (about age 11)' : s.ease >= 80 ? 'easy (about age 12)' : s.ease >= 70 ? 'fairly easy (age 13 to 14)' : s.ease >= 60 ? 'plain English (age 15 to 17)' : s.ease >= 50 ? 'fairly difficult (A-level)' : s.ease >= 30 ? 'difficult (degree level)' : 'very difficult (academic)';
  return [
    `${s.words} words, ${s.sentences} sentence${s.sentences === 1 ? '' : 's'}, ${s.chars} characters.`,
    `Reading level: ${level}. Reading ease ${s.ease} out of 100; grade ${s.grade} (US), about Year ${Math.max(1, Math.round(s.grade) + 1)} in the UK.`,
    `Time: about ${mins(s.readSecs)} to read silently, ${mins(s.speakSecs)} to say aloud.`,
    `Sentences average ${s.perSentence} words; the longest is ${s.longest}.${s.perSentence > 20 || s.longest > 35 ? ' Split the longest one.' : ''}${s.longWords / s.words > 0.15 ? ` ${Math.round((s.longWords / s.words) * 100)}% are long words: swap a few for shorter ones.` : ''}`,
    'A rough guide from the formulas, not a verdict: syllables are counted by rule.',
  ].join('\n');
}

// ---------------------------------------------------------------- a shift rota

export interface Shift {
  from?: string;
  to?: string;
  off?: string;
  note?: string;
}
export type Rota = Record<string, Shift>;
/** "Mon 9-5, Tue off, Wed 12-8, Thu early, Fri off" (this week, or "next week", or "week of 9 Nov"; a date wins): each day's shift. */
export function parseRota(words: string, today: string): { rota: Rota; assumed: string[] } {
  const w = words.toLowerCase();
  const assumed: string[] = [];
  const weekOf = /\bweek (?:of|starting|commencing|beginning)\s+(.+?)(?::|,|$)/.exec(w);
  let base = mondayOf(today);
  if (/\bnext week\b/.test(w)) base = addDays(mondayOf(today), 7);
  else if (weekdayOf(today) === 0 && !weekOf && !/\bthis week\b/.test(w)) {
    base = addDays(mondayOf(today), 7);
    assumed.push('next week, as it is Sunday (say “this week” for the one that is ending)');
  }
  else if (weekOf) {
    const d = dayWords(weekOf[1]!, today);
    if (d) base = mondayOf(d);
  }
  const rota: Rota = {};
  const MON = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
  for (const chunk of words.split(/[,;\n]+/).map(clean).filter(Boolean)) {
    const range = timeRange(chunk);
    const c = (range ? chunk.replace(/\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?\s*(?:to|-|–|until|till)\s*\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)?\b/i, ' ') : chunk).toLowerCase();
    const wd = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues?|wed|thu(?:rs?)?|fri|sat)\b/.exec(c);
    const dated = new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MON}\\b|\\b${MON}\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`).test(c);
    const date = (dated ? dayWords(c, today) : '') || (wd ? addDays(base, (WD.findIndex((x) => x.startsWith(wd[1]!.slice(0, 3))) + 6) % 7) : '');
    if (!date) continue;
    const off = /\b(?:day off|off|holiday|annual leave|leave|sick|rest|n\/a)\b/.exec(c)?.[0];
    const note = /\b(early|late|night|opening|closing|open|close|split|on call)\b/.exec(c)?.[1];
    if (range) rota[date] = { from: hhmm(range.from), to: hhmm(range.to), ...(note ? { note } : {}) };
    else if (off) rota[date] = { off };
    else if (note) rota[date] = { note };
  }
  if (Object.keys(rota).length && !/\bnext week\b|\bweek (?:of|starting|commencing|beginning)\b/.test(w) && Object.keys(rota).every((d) => d < today)) assumed.push('this week, which has mostly gone: say “next week” for the coming one');
  return { rota, assumed };
}
/** The Monday the rota is shown from: this week's, or the coming one when he says "next week" or it is Sunday. */
export const rotaStart = (words: string, today: string): string => (/\bnext week\b/i.test(words) || (weekdayOf(today) === 0 && !/\bthis week\b/i.test(words)) ? addDays(mondayOf(today), 7) : mondayOf(today));
export const shiftWords = (s: Shift): string => (s.from ? `${s.from}–${s.to}${s.note ? ` (${s.note})` : ''}` : s.off ? (s.off === 'off' ? 'off' : s.off) : s.note ?? '—');
export function rotaWords(r: Rota, from: string, days = 7): string {
  const rows = Array.from({ length: days }, (_, i) => addDays(from, i)).filter((d) => r[d]).map((d) => `- ${prettyDay(d)}: ${shiftWords(r[d]!)}`);
  return rows.length ? `Your rota:\n${rows.join('\n')}` : 'No shifts kept for those days. Say "Mon 9-5, Tue off, Wed 12-8".';
}
/** The Brief's lines: today's shift and tomorrow's. */
export function rotaLines(r: Rota, today: string): string[] {
  const line = (d: string, label: string) => {
    const s = r[d];
    return s ? (s.from ? `Work ${label}: ${s.from}–${s.to}${s.note ? ` (${s.note})` : ''}` : s.off ? `${s.off === 'off' ? 'Off' : cap(s.off)} ${label}` : '') : '';
  };
  return [line(today, 'today'), line(addDays(today, 1), 'tomorrow')].filter(Boolean);
}

// ---------------------------------------------------------------- the cards

const brief = (id: string, title: string, line: string, at: number, acts: Card['acts'] = [], icon: 'diary' | 'reminder' = 'diary'): Card => card({ id, kind: 'brief', at, title, line, brief: { icon }, acts });
export const todoCard = (list: Todo[], today: string, at = Date.now()): Card => {
  const open = todoOrder(list).filter((t) => !t.done);
  const next = open[0];
  return brief('work:todo', `${open.length} to do`, next ? `Next: ${next.text}${next.due ? ` (${prettyDay(next.due, today.slice(0, 4))})` : ''}` : 'All done', at, [{ label: 'OPEN LIST', run: { name: 'open_work', args: { what: 'todo' } } }]);
};
export const payCard = (ask: PayAsk, p: Pay, at = Date.now()): Card => brief('work:pay', `${pounds(Math.round(p.net / 12))} a month`, `${ask.said} → take-home after tax and NI; a first estimate`, at, [{ label: 'ASK', ask: 'What if I got a £2,000 raise?' }]);
export const hoursCard = (h: Hours, from: string, at = Date.now()): Card => {
  const w = hoursWeek(h, from);
  return brief(`work:hours:${w.monday}`, `This week ${minText(w.total)}`, w.rows.filter((r) => r.day?.kind === 'work').map((r) => `${prettyDay(r.date).slice(0, 3)} ${minText(r.day!.mins)}`).join(' · ') || 'Nothing logged', at, [{ label: 'COPY IT', run: { name: 'open_work', args: { what: 'doc', title: 'TIMESHEET', text: hoursWords(h, from, from), kind: 'timesheet' } } }]);
};
export const rotaCard = (r: Rota, today: string, at = Date.now()): Card => brief('work:rota', 'Your rota', rotaLines(r, today).join(' · ') || 'Kept for the week', at, [{ label: 'SEE THE WEEK', ask: 'When am I working this week?' }], 'reminder');

