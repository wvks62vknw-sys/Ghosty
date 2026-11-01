/**
 * THE WORK PACK (BRIEF-PACKS-2; OWNER-ISSUES 92 ④): ONE tool, `work`, its abilities an `action` enum — described in full only
 * when his words turn the group on, named "work pack" otherwise (tools/index.ts). A CV from the facts he tells and pastes, a
 * cover letter for a job ad he pastes (his facts only; the gaps said), the ad read and checked for scams, interview practice
 * and a plain critique of an answer, a meeting summed up, a to-do from a long message, an email in his voice (shown, never
 * sent), a timesheet, pay after tax (a first estimate), a pomodoro on his timers, "what did I say I'd do", a word count and
 * reading level, and a shift rota the Brief shows. Documents open in a sheet on his phone to copy or share. His facts only:
 * nothing is invented, nothing is sent, nothing is searched for. The pure parts: packages/shared/src/work.ts.
 */
import { localDay } from '../../../../packages/shared/src/cadence';
import { toneOf, toneWords, VOICE_KEY } from '../../../../packages/shared/src/people';
import { addDays, daysBetween, prettyDay } from '../../../../packages/shared/src/packs';
import {
  addToCv,
  adWords,
  coverLetter,
  critique,
  cvGaps,
  emailDraft,
  emptyCv,
  hoursCard,
  hoursWords,
  keysOf,
  mailtoOf,
  MAX_TEXT,
  meetingNotes,
  meetingWords,
  parseHours,
  parsePay,
  parseRota,
  payAfterTax,
  payCard,
  payWords,
  pomodoroPlan,
  questionsFor,
  readAd,
  renderCv,
  rotaCard,
  rotaLines,
  rotaStart,
  rotaWords,
  textStats,
  textWords,
  todoCard,
  todoOrder,
  todosFrom,
  todoWords,
  type Cv,
  type Hours,
  type Rota,
  type Todo,
} from '../../../../packages/shared/src/work';
import { card } from '../../../../packages/shared/src/cards';
import { loadJobs } from '../schedule';
import { zoned } from '../time';
import { load, packTool, save, todayOf, wordsOf, type ActionFn, type PackDeps } from '../packs/base';
import { loadMemory } from './memory';
import { arg, type Tool } from './types';

export const WORK_KEYS = { cv: 'work:cv', todo: 'work:todo', hours: 'work:hours', rota: 'work:rota', pomo: 'work:pomo' } as const;

/** When the group is described in full: his words about work. */
export const WORK_WHEN =
  /\b(cv|résumé|resume|cover letter|job ad|job advert|job description|interview|meeting (?:notes|minutes)|minutes of|sum up (?:the |my )?meeting|to-?do list|my to-?do|timesheet|hours worked|worked \d|pay after tax|take[- ]home|after tax|net pay|pomodoro|focus timer|what did i (?:say|promise|tell you)\b|word count|reading level|reading time|how many words|my rota|shift rota|rota for|my shifts?|when am i working|email (?:to|for) my|draft an? email|write an? email)\b|\bi(?:'ll| will) (?:need to|have to) [a-z]+ and\b/i;
export const WORK_ABOUT =
  'You can run his work pack (work: cv, cover, ad, interview, critique, meeting, todo, email, hours, pay, pomodoro, said, words, rota): his facts only; drafts are shown, never sent.';

const textArg = (a: Record<string, unknown>, k = 'text'): string => arg.str(a, k, false).slice(0, MAX_TEXT);
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const doc = (title: string, text: string, kind: string, extra: Record<string, unknown> = {}) => ({ name: 'open_work', args: { what: 'doc', title, text, kind, ...extra } });
const hm = (d: PackDeps, ms = d.now()) => {
  const z = zoned(ms, d.tz);
  return `${String(z.h).padStart(2, '0')}:${String(z.mi).padStart(2, '0')}`;
};
const NOT_SENT = 'Shown for you to check; nothing is sent.';

// ---------------------------------------------------------------- the actions

const cv: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const text = textArg(a);
  const kept = await load<Cv>(d, WORK_KEYS.cv, emptyCv());
  if (/^(?:clear|delete|reset|wipe|forget)\s+(?:all of |everything in )?(?:my )?cv\b/i.test(words)) {
    await save(d, WORK_KEYS.cv, emptyCv());
    return { text: 'Your CV is cleared: nothing of it is kept.' };
  }
  const drop = /^(?:remove|delete|drop|forget|take off)\s+(?:the\s+)?(.+?)(?:\s+(?:line|bit|part|from my cv))*$/i.exec(words);
  if (drop && !text && !/\bcv\b/i.test(drop[1]!)) {
    const k = keysOf(drop[1]!);
    const hit = kept.facts.find((f) => [...k].some((w) => keysOf(f.text).has(w)));
    if (!hit) return { text: `I couldn’t find a line about "${drop[1]}" in your CV.` };
    kept.facts = kept.facts.filter((f) => f.id !== hit.id);
    await save(d, WORK_KEYS.cv, kept);
    return { text: `Removed from your CV: “${hit.text}”.` };
  }
  const showing = !text && (!words || /^(?:show|open|see|print|read|display|copy|export|give me|let me see)?\s*(?:me )?(?:my |the )?cv[?.!]*$|\bwhat(?:'s| is) (?:in|on) my cv\b|^my cv$/i.test(words));
  if (showing) {
    if (!kept.facts.length && !kept.name) return { text: 'Your CV is empty. Tell me about your work, where you studied and what you can do ("I worked at Tesco as a shelf stacker from 2019 to 2022"), or paste your old CV, and I’ll lay it out. I only write down what you tell me.' };
    const t = renderCv(kept);
    const gaps = cvGaps(kept);
    return { text: `${t}\n\n${gaps.length ? `Missing, and not made up: ${gaps.join('; ')}.` : 'Nothing obvious is missing.'} Every line is one you gave me.`, open: doc('YOUR CV', t, 'cv'), data: { cv: t } };
  }
  const up = addToCv(kept, [words, text].filter(Boolean).join('\n'), d.now());
  if (!up.added.length && !up.contact.length) return { text: 'I didn’t find anything to add. Say it in a sentence, like "I worked at Tesco as a shelf stacker from 2019 to 2022", "I studied catering at Leeds College" or "I have a full driving licence".' };
  await save(d, WORK_KEYS.cv, up.cv);
  const by = up.added.reduce<Record<string, number>>((k, f) => ({ ...k, [f.sec]: (k[f.sec] ?? 0) + 1 }), {});
  const gaps = cvGaps(up.cv);
  return {
    text: `Added to your CV: ${[...up.contact, ...Object.entries(by).map(([s, n]) => `${n} in ${s}`)].join(', ')}. ${gaps.length ? `Still missing: ${gaps.join('; ')}. ` : ''}Say "show my CV" to see it laid out, to copy or share. I write down only what you tell me.`,
    data: { added: up.added.length },
  };
};

const cover: ActionFn = async (a, d) => {
  const ad = textArg(a) || wordsOf(a);
  if (ad.length < 40) return { text: 'Paste the job ad (all of its text) and I’ll write the letter from the facts in your CV. I won’t say anything about you that you haven’t told me.' };
  const kept = await load<Cv>(d, WORK_KEYS.cv, emptyCv());
  if (!kept.facts.length) return { text: 'Your CV has nothing in it yet, so there’s nothing true for me to put in a letter. Tell me about your work and what you can do ("I worked at … as … from … to …") and paste the ad again.' };
  const parsed = readAd(ad);
  const l = coverLetter(parsed, kept);
  const flags = parsed.flags.length ? `\nBefore you apply: ${parsed.flags.join('; ')}.` : '';
  return {
    text: `Cover letter for ${parsed.title}${parsed.company ? ` at ${parsed.company}` : ''} (${NOT_SENT}):\n\n${l.text}\n\n${l.gaps.length ? `Left out, because your CV doesn’t say it: ${l.gaps.slice(0, 6).join('; ')}. If any of it is true, tell me ("I have …") and I’ll put it in.` : 'Every requirement in the ad is matched to something you told me.'}${flags}`,
    open: doc('COVER LETTER', l.text, 'cover'),
    data: { letter: l.text, matched: l.matched.length, gaps: l.gaps.length },
  };
};

const ad: ActionFn = async (a) => {
  const t = textArg(a) || wordsOf(a);
  if (t.length < 40) return { text: 'Paste the job ad and I’ll pull out the title, the pay, what it asks for, and anything that looks like a scam.' };
  return { text: adWords(readAd(t)) };
};

const interview: ActionFn = async (a) => {
  const role = [wordsOf(a), arg.str(a, 'role', false)].join(' ').trim() || textArg(a);
  const ad = textArg(a).length > 80 ? readAd(textArg(a)) : null;
  const q = questionsFor(`${role} ${ad?.title ?? ''}`.trim(), 6);
  return {
    text: `Interview practice for ${ad?.title ?? (role || 'any job')} (${q.kind}):\n${q.questions.map((x, i) => `${i + 1}. ${x}`).join('\n')}\nOn your phone: I ask each one aloud, you answer by voice or typing, I time it and give you a plain critique: length, specifics, filler words.`,
    open: { name: 'open_work', args: { what: 'interview', role: ad?.title ?? role, questions: q.questions } },
    data: { questions: q.questions },
  };
};

const critiqueAction: ActionFn = async (a) => {
  const answer = textArg(a) || wordsOf(a);
  if ((answer.match(/\S+/g) ?? []).length < 8) return { text: 'Give me your answer (a few sentences, typed or spoken) and how long it took in seconds, and I’ll say what works and what to fix.' };
  const c = critique(answer, Math.max(0, arg.num(a, 'secs', 0)));
  return { text: `${c.lines.join('\n')}\nNext time: ${c.next}\nA rough guide from your words, not a verdict on you.`, data: { critique: c } };
};

const meeting: ActionFn = async (a, d) => {
  const notes = textArg(a) || wordsOf(a);
  if (notes.length < 30) return { text: 'Paste the meeting notes (or speak them as a voice note) and I’ll sum up the decisions, the actions and who has them.' };
  const today = todayOf(d);
  const m = meetingNotes(notes, today);
  const summary = meetingWords(m, today);
  const mine = m.actions.filter((x) => !x.who || /^(?:me|i)$/i.test(x.who));
  return {
    text: `${summary}\nFrom your notes only; nothing is added.`,
    open: doc('MEETING SUMMARY', summary, 'meeting'),
    cards: mine.length
      ? [card({ id: `work:meeting:${m.actions.length}:${m.decisions.length}`, kind: 'brief', at: d.now(), title: 'Meeting summed up', line: `${m.decisions.length} decision${m.decisions.length === 1 ? '' : 's'}, ${m.actions.length} action${m.actions.length === 1 ? '' : 's'} (${mine.length} for you)`, brief: { icon: 'diary' }, acts: [{ label: 'ADD MINE TO TO-DO', run: { name: 'packs_do', args: { pack: 'work', action: 'todo', args: { words: `add: ${mine.map((x) => `${x.what}${x.due ? ` by ${x.due}` : ''}`).join('\n').slice(0, 540)}` } } } }] })]
      : [],
    data: { meeting: m },
  };
};

const todo: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const text = textArg(a);
  const today = todayOf(d);
  let list = await load<Todo[]>(d, WORK_KEYS.todo, []);
  const shown = (t: string) => ({ text: t, data: { list: todoOrder(list) }, cards: list.some((x) => !x.done) ? [todoCard(list, today, d.now())] : [] });
  const untick = /^untick\s+(?:the\s+)?(.+)$/i.exec(words);
  const tick = /^(?:tick(?: off)?|done|finished|completed|cross off|check off|did)\s+(?:the\s+)?(.+)$/i.exec(words);
  const drop = /^(?:remove|delete|drop|cancel|scrap)\s+(?:the\s+)?(.+)$/i.exec(words);
  const pick = (q: string, done = false) => {
    const k = keysOf(q);
    const open = list.filter((t) => !!t.done === done);
    return open.find((t) => t.id === q) ?? open.find((t) => t.text.toLowerCase().includes(q.toLowerCase())) ?? open.find((t) => [...k].some((w) => keysOf(t.text).has(w)));
  };
  if (/^clear\s+(?:the\s+)?(?:done|ticked|finished|completed)\b/i.test(words)) {
    const n = list.filter((t) => t.done).length;
    list = list.filter((t) => !t.done);
    await save(d, WORK_KEYS.todo, list);
    return shown(`Cleared ${n} done item${n === 1 ? '' : 's'}. ${todoWords(list, today)}`);
  }
  if (/^clear\s+(?:my |the |all )?(?:to-?do|list|everything)\b/i.test(words)) {
    await save(d, WORK_KEYS.todo, []);
    list = [];
    return shown('Your to-do list is cleared.');
  }
  if (untick) {
    const t = pick(untick[1]!, true);
    if (!t) return shown(`I couldn’t find “${untick[1]}” among the ticked ones.`);
    t.done = false;
    await save(d, WORK_KEYS.todo, list);
    return shown(`Back on the list: ${t.text}.`);
  }
  if (tick) {
    const t = pick(tick[1]!);
    if (!t) return shown(`I couldn’t find “${tick[1]}” on your list. ${todoWords(list, today)}`);
    t.done = true;
    await save(d, WORK_KEYS.todo, list);
    return shown(`Ticked off: ${t.text}. ${todoWords(list, today)}`);
  }
  if (drop && !/\bto-?do\b/i.test(drop[1]!)) {
    const t = pick(drop[1]!);
    if (!t) return shown(`I couldn’t find “${drop[1]}” on your list.`);
    list = list.filter((x) => x.id !== t.id);
    await save(d, WORK_KEYS.todo, list);
    return shown(`Removed: ${t.text}.`);
  }
  const body = text || words.replace(/^(?:add|put|note|jot down|make a list(?: of)?|to-?do)\s*(?:to my (?:to-?do|list))?\s*[:\-–]?\s*/i, '');
  if (!body || /^(?:what['’]?s|show|list|open|my|what do i)\b/i.test(words) || (!text && body.length < 3)) return shown(todoWords(list, today));
  const found = todosFrom(body, today, d.now());
  if (!found.length) return shown('I couldn’t find a job in that. Say what needs doing, like "send the invoice by Friday, book the van".');
  const fresh = found.filter((f) => !list.some((x) => !x.done && x.text.toLowerCase() === f.text.toLowerCase()));
  list = [...list, ...fresh].slice(-120);
  await save(d, WORK_KEYS.todo, list);
  return shown(`Added ${fresh.length} to your list:\n${fresh.map((t) => `- ${t.text}${t.due ? ` (${prettyDay(t.due, today.slice(0, 4))})` : ''}${t.high ? ' [urgent]' : ''}`).join('\n')}\nSay "tick the invoice" when it’s done.`);
};

const email: ActionFn = async (a, d) => {
  const purpose = [arg.str(a, 'purpose', false), wordsOf(a)].filter(Boolean).join(' ').trim();
  if (!purpose && !textArg(a)) return { text: 'What is the email for, and who to? Say "an email to my manager asking for Friday off".' };
  const kept = await load<Cv>(d, WORK_KEYS.cv, emptyCv());
  const tone = toneOf(await load<string[]>(d, VOICE_KEY, []));
  const to = arg.str(a, 'to', false) || /\b(?:to|for)\s+(?:my\s+)?([A-Za-z][\w.-]*(?:\s+[A-Z][a-z]+)?)/.exec(purpose)?.[1] || '';
  const e = emailDraft({ purpose, to, details: textArg(a), from: arg.str(a, 'from', false) || kept.name || '', subject: arg.str(a, 'subject', false) }, tone);
  return {
    text: `Email draft (${NOT_SENT} It opens in your mail app on your tap):\n\nSubject: ${e.subject}\n\n${e.body}\n\nYour tone: ${toneWords(tone)}. Tell me what to change.`,
    open: doc('EMAIL DRAFT', `Subject: ${e.subject}\n\n${e.body}`, 'email', { mailto: mailtoOf(e) }),
  };
};

const hours: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const h = await load<Hours>(d, WORK_KEYS.hours, { days: {} });
  const contract = /\bcontract(?:ed)?\s*(?:is|of|:)?\s*(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)/i.exec(words)?.[1];
  const rate = /\b(?:rate|paid|pay)\s*(?:is|of|:)?\s*£\s?(\d+(?:\.\d+)?)|£\s?(\d+(?:\.\d+)?)\s*(?:an|per|\/)\s*(?:hour|hr)/i.exec(words);
  if (contract || rate) {
    if (contract) h.contract = +contract;
    if (rate) h.rate = +(rate[1] ?? rate[2]!);
    await save(d, WORK_KEYS.hours, h);
    return { text: `Kept: ${[contract && `contract ${h.contract} hours a week`, rate && `£${h.rate} an hour`].filter(Boolean).join(', ')}. ${hoursWords(h, today, today)}`, cards: [hoursCard(h, today, d.now())] };
  }
  if (/^undo\b|^take (?:that|it) back\b/i.test(words)) {
    const last = Object.keys(h.days).sort().pop();
    if (!last) return { text: 'Nothing logged to take back.' };
    delete h.days[last];
    await save(d, WORK_KEYS.hours, h);
    return { text: `Took back ${prettyDay(last, today.slice(0, 4))}. ${hoursWords(h, today, today)}` };
  }
  const p = parseHours(words, today);
  const wk = /\blast week\b/i.test(words) ? addDays(today, -7) : today;
  if (!p || /^(?:what|how|show|my|this|last|total|timesheet|week)\b/i.test(words)) {
    const t = hoursWords(h, wk, today);
    return { text: t, cards: Object.keys(h.days).length ? [hoursCard(h, wk, d.now())] : [], open: Object.keys(h.days).length ? doc('TIMESHEET', t, 'timesheet') : undefined, data: { hours: h } };
  }
  h.days[p.date] = p.day;
  for (const k of Object.keys(h.days)) if (daysBetween(k, today) > 120) delete h.days[k];
  await save(d, WORK_KEYS.hours, h);
  return {
    text: `Logged ${prettyDay(p.date, today.slice(0, 4))}: ${p.day.kind === 'work' ? `${p.day.from ? `${p.day.from}–${p.day.to}${p.day.brk ? `, ${p.day.brk} min break` : ''} = ` : ''}${Math.floor(p.day.mins / 60)}h${p.day.mins % 60 ? ` ${p.day.mins % 60}m` : ''}` : p.day.kind}${p.assumed.length ? ` (${p.assumed.join('; ')})` : ''}.\n${hoursWords(h, p.date, today)}`,
    cards: [hoursCard(h, p.date, d.now())],
    data: { hours: h },
  };
};

const pay: ActionFn = async (a) => {
  const ask = parsePay(wordsOf(a));
  if (!ask) return { text: 'Say the pay, like "£30,000 a year", "£2,500 a month" or "£15.50 an hour for 37.5 hours a week" (and "5% pension" or "plan 2 student loan" if you have them).' };
  const p = payAfterTax({ annual: ask.annual, pensionPct: ask.pensionPct, ...(ask.loan ? { loan: ask.loan } : {}), ...(ask.code ? { code: ask.code } : {}) });
  return { text: payWords(ask, p), cards: [payCard(ask, p, Date.now())], data: { pay: p } };
};

const pomodoro: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  if (/\b(stop|cancel|end|finish|quit)\b/i.test(words)) return { text: 'Pomodoro stopped: its timers are cleared on your phone.', open: { name: 'kitchen_timer', args: { stop: 'pomodoro' } } };
  const plan = pomodoroPlan(words);
  const tally = await load<{ day: string; started: number }>(d, WORK_KEYS.pomo, { day: '', started: 0 });
  const today = todayOf(d);
  const started = (tally.day === today ? tally.started : 0) + plan.rounds;
  await save(d, WORK_KEYS.pomo, { day: today, started });
  const first = hm(d, d.now() + plan.focus * 60_000);
  return {
    text: `Pomodoro: ${plan.rounds} × ${plan.focus} minutes of focus with ${plan.rest}-minute breaks${plan.rounds >= 4 ? ` and a ${plan.long}-minute long break at the end` : ''}: about ${plan.totalMins} minutes in all. The first focus ends at ${first}. They ring on your phone one after another, while Ghosty is open (for a locked phone, ask for a reminder). ${started} focus session${started === 1 ? '' : 's'} started today. “Stop the pomodoro” clears them.`,
    open: { name: 'kitchen_timer', args: { timers: plan.timers } },
  };
};

const PROMISE = /\b(?:i(?:'ll| will| need to| have to| must| should| promised| said i(?:'d| would))|remind me|don'?t forget|promised|need to|going to|plan(?:ning)? to)\b/i;
const said: ActionFn = async (a, d) => {
  const who = (arg.str(a, 'who', false) || /\b(?:for|to|about|with)\s+([A-Z][a-z]+)/.exec(wordsOf(a))?.[1]) ?? '';
  const today = todayOf(d);
  const has = (t: string) => !who || t.toLowerCase().includes(who.toLowerCase());
  const todos = (await load<Todo[]>(d, WORK_KEYS.todo, [])).filter((t) => !t.done && has(t.text));
  const facts = (await loadMemory(d.storage)).filter((f) => PROMISE.test(f.text) && has(f.text) && !/^(?:My|.+'s) car:/.test(f.text));
  const reminders = (await loadJobs(d.storage)).filter((j) => j.kind === 'reminder' && j.next > d.now() && j.next < d.now() + 30 * 86_400_000 && has(`${j.title} ${j.text}`) && !/^(?:Birthday|Date|Warranty): /.test(j.title));
  const lines = [
    todos.length ? `On your to-do list:\n${todos.slice(0, 8).map((t) => `- ${t.text}${t.due ? ` (by ${prettyDay(t.due, today.slice(0, 4))})` : ''}`).join('\n')}` : '',
    reminders.length ? `Reminders you set:\n${reminders.slice(0, 8).map((j) => `- ${j.title} — ${prettyDay(localDay(j.next, d.tz), today.slice(0, 4))}`).join('\n')}` : '',
    facts.length ? `Things you told me:\n${facts.slice(0, 6).map((f) => `- ${f.text} (${prettyDay(localDay(f.at, d.tz), today.slice(0, 4))})`).join('\n')}` : '',
  ].filter(Boolean);
  return { text: lines.length ? `What you said you’d do${who ? ` about ${who}` : ''}, from your own notes:\n${lines.join('\n')}` : `I’ve nothing on your notes about what you said you’d do${who ? ` for ${who}` : ''}. Tell me a job (“add: send the invoice by Friday”) and I’ll keep it.` };
};

const words: ActionFn = async (a) => {
  const t = textArg(a) || wordsOf(a);
  const s = textStats(t);
  if (!s) return { text: 'Paste the text and I’ll count the words and tell you how hard it is to read.' };
  return { text: textWords(s), data: { stats: s } };
};

const rota: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  let r = await load<Rota>(d, WORK_KEYS.rota, {});
  if (/^(?:clear|delete|forget|remove)\b/i.test(words)) {
    await save(d, WORK_KEYS.rota, {});
    return { text: 'Your rota is cleared: the Brief stops showing shifts.' };
  }
  if (!words || /^(?:when|what|show|my|this|next|am i)\b.*\?*$/i.test(words)) {
    return { text: rotaWords(r, rotaStart(words, today), 7), cards: Object.keys(r).length ? [rotaCard(r, today, d.now())] : [], data: { rota: r } };
  }
  const p = parseRota(words, today);
  if (!Object.keys(p.rota).length) return { text: 'I didn’t catch the shifts. Say "Mon 9-5, Tue off, Wed 12-8, Thu 9-5" (add "next week" for the coming week).' };
  r = { ...r, ...p.rota };
  for (const k of Object.keys(r)) if (daysBetween(k, today) > 7) delete r[k];
  await save(d, WORK_KEYS.rota, r);
  const days = Object.keys(p.rota).sort();
  return {
    text: `Kept ${days.length} day${days.length === 1 ? '' : 's'}: ${days.map((k) => `${prettyDay(k)} ${p.rota[k]!.from ? `${p.rota[k]!.from}–${p.rota[k]!.to}` : p.rota[k]!.off ?? p.rota[k]!.note}`).join('; ')}. I read “9-5” as 09:00 to 17:00 (the second number as the afternoon when it is smaller)${p.assumed.length ? `; ${p.assumed.join('; ')}` : ''}. The Brief shows today’s and tomorrow’s shift.`,
    cards: [rotaCard(r, today, d.now())],
    data: { rota: r },
  };
};

export const WORK: Record<string, ActionFn> = { cv, cover, ad, interview, critique: critiqueAction, meeting, todo, email, hours, pay, pomodoro, said, words, rota };
export const WORK_ACTIONS = Object.keys(WORK);

export const workTools: Tool[] = [
  packTool({
    name: 'work',
    description:
      "His work pack: his facts only; drafts are shown to him, never sent. cv: keep what he says or pastes for his CV (words, text) or show it laid out. cover: a cover letter for a job ad (text = the ad), from his CV facts only, gaps said. ad: read an ad and check it for scams (text). interview: practice questions for a role (words, role), opens the practice on his phone. critique: a plain critique of an interview answer (text, secs). meeting: sum up pasted notes (text) into decisions, actions, who. todo: add jobs from a long message (text or words), or tick, remove, list. email: a draft in his voice (purpose, to, text). hours: log or show his hours (\"worked Monday 9 to 5, 30 min break\"). pay: take-home after UK tax (words: \"£30,000 a year\"). pomodoro: focus timers on his phone (words). said: what he said he'd do. words: word count and reading level (text). rota: keep or show his shifts (words).",
    actions: WORK,
    properties: {
      words: { type: 'string', description: 'his words for it, as he said them' },
      text: { type: 'string', description: 'cv, cover, ad, meeting, todo, critique, words: the pasted text (an ad, notes, an answer)' },
      role: { type: 'string', description: 'interview: the job' },
      secs: { type: 'number', description: 'critique: how long the answer took, in seconds' },
      purpose: { type: 'string', description: 'email: what it is for' },
      to: { type: 'string', description: 'email: who to (a name or address)' },
      from: { type: 'string', description: 'email: his name' },
      subject: { type: 'string', description: 'email: a subject, if he gave one' },
      who: { type: 'string', description: 'said: only things about this person' },
    },
    reads: ['cover', 'ad', 'interview', 'critique', 'meeting', 'email', 'pay', 'said', 'words'],
  }),
];

/** The Brief's work lines (mind.ts): today's and tomorrow's shift, and what is due on his to-do list. */
export async function workLines(d: PackDeps): Promise<string[]> {
  const today = todayOf(d);
  const out = rotaLines(await load<Rota>(d, WORK_KEYS.rota, {}), today);
  const open = (await load<Todo[]>(d, WORK_KEYS.todo, [])).filter((t) => !t.done);
  const due = open.filter((t) => t.due && t.due === today).length;
  const late = open.filter((t) => t.due && t.due < today).length;
  if (due || late) out.push(`To-do: ${[due && `${due} due today`, late && `${late} overdue`].filter(Boolean).join(', ')}`);
  return out;
}
