/**
 * From the owner's request (brief.ts) and the model's choices (build_app's arguments: the shape, the
 * words, the items and the options) to one AppConfig, plus what the approval says: what the app does,
 * what it saves, what was assumed, the questions still worth asking, and what it cannot do. The kit
 * writes "what it does" and "what it saves" itself, from the config, so they are always true.
 */
import { readApp, shapeNoun } from './brief';
import { ACCENT_IDS, GLYPH_IDS, type AccentId, type GlyphId } from './look';
import type { AppBrief, AppConfig, AppShape, CalcKind, ListKind, Question, TimerStep } from './types';
import { APP_SHAPES, CALC_KINDS } from './types';
import { cleanCards, cleanList, cleanText, cleanWords } from './write';

const SHAPE_LOOK: Record<AppShape, { accent: AccentId; glyph: GlyphId; title: string }> = {
  tracker: { accent: 'cyan', glyph: 'star', title: 'Tracker' },
  list: { accent: 'mint', glyph: 'list', title: 'Checklist' },
  timer: { accent: 'orange', glyph: 'clock', title: 'Timer' },
  calc: { accent: 'green', glyph: 'calc', title: 'Calculator' },
  counter: { accent: 'yellow', glyph: 'plus', title: 'Counter' },
  habits: { accent: 'purple', glyph: 'calendar', title: 'Habits' },
  notes: { accent: 'yellow', glyph: 'note', title: 'Notes' },
  cards: { accent: 'indigo', glyph: 'cards', title: 'Flash cards' },
  game: { accent: 'pink', glyph: 'die', title: 'Merge' },
};

export interface AppPlan {
  cfg: AppConfig;
  brief: AppBrief;
  /** Things the app starts with that the owner did not say (each can be changed in the app). */
  assumed: string[];
  /** Questions with the answer used unless the owner says otherwise (at most two, with the blocking ones). */
  questions: Question[];
  /** What it cannot do that the request asked for, in plain words. */
  limits: string[];
}

const nums = (v: unknown, max: number): number[] => (Array.isArray(v) ? v : typeof v === 'string' ? v.split(/[,\s]+/) : []).map((x) => (typeof x === 'number' ? x : parseFloat(String(x)))).filter((x) => Number.isFinite(x) && Math.abs(x) <= 1e7).slice(0, max);
const numOf = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? parseFloat(v.replace(/[£,]/g, '')) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString('en-GB');
const dur = (secs: number) => (secs >= 3600 && secs % 60 === 0 ? `${fmt(secs / 3600)} h` : secs >= 60 && secs % 60 === 0 ? `${secs / 60} min` : secs > 90 ? `${Math.floor(secs / 60)} min ${secs % 60} s` : `${secs} s`);
const listWords = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Steps the model sent ([{name, secs}] or "Plank 60s" lines). */
export function cleanSteps(v: unknown): TimerStep[] {
  const raw: unknown[] = Array.isArray(v) ? v : typeof v === 'string' ? v.split(/\n|,/) : [];
  const out: TimerStep[] = [];
  for (const x of raw) {
    let name = '';
    let secs = NaN;
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      name = cleanText(o.name, 40);
      secs = numOf(o.secs ?? o.seconds) ?? (numOf(o.minutes) ?? NaN) * 60;
    } else if (typeof x === 'string') {
      const m = x.trim().match(/^(.*?)\s*(\d+(?:\.\d+)?)\s*(s|secs?|seconds?|m|mins?|minutes?|h|hours?)?$/i);
      if (m) {
        name = cleanText(m[1]!.replace(/[:\-–]+$/, ''), 40);
        const n = parseFloat(m[2]!);
        const u = (m[3] ?? 's').toLowerCase();
        secs = u.startsWith('h') ? n * 3600 : u.startsWith('m') ? n * 60 : n;
      }
    }
    if (Number.isFinite(secs) && secs >= 1 && secs <= 86_400) out.push({ name: name || 'Step', secs: Math.round(secs) });
    if (out.length >= 20) break;
  }
  return out;
}

/** The Home Screen label: 12 characters at most, whole words where it can. */
export function shortName(title: string): string {
  if (title.length <= 12) return title;
  const words = title.split(/\s+/);
  let s = '';
  for (const w of words) {
    if ((s ? `${s} ${w}` : w).length > 12) break;
    s = s ? `${s} ${w}` : w;
  }
  return s || title.slice(0, 12);
}

/** What the app does, in one or two plain sentences, from its config. */
export function describe(cfg: AppConfig): { does: string; saves: string } {
  const here = 'on this phone only';
  switch (cfg.shape) {
    case 'tracker': {
      const o = cfg.tracker!;
      const per = o.period === 'week' ? 'a week' : 'a day';
      const unit = o.money ? 'money' : o.unit;
      const goal = o.goal > 0 ? (o.money ? `£${fmt(o.goal)}` : `${fmt(o.goal)} ${o.unit}`) : '';
      const aim = !goal ? (o.mode === 'last' ? '' : ` ${o.period === 'week' ? 'each week' : 'each day'}`) : o.mode === 'last' ? ` against a target of ${goal}` : o.dir === 'limit' ? ` and keeps you under ${goal} ${per}` : ` towards ${goal} ${per}`;
      return { does: `${o.mode === 'last' ? `Keeps a ${o.period === 'week' ? 'weekly' : 'daily'} reading of ${unit}` : `Adds up ${unit} ${per}`}${aim}, with ${o.period === 'week' ? 'this week' : 'today'}’s entries, the last 7 ${o.period === 'week' ? 'weeks' : 'days'} and a streak.${o.period === 'day' ? ' A new day starts at midnight.' : ''}`, saves: `Your entries, ${here}.` };
    }
    case 'list': {
      const o = cfg.list!;
      return { does: `A ${o.kind === 'todo' ? 'to-do' : o.kind} list: add things, tick them off, reorder them and clear what is done${o.kind === 'packing' ? ', then start again for the next trip' : ''}.${o.items.length ? ` It starts with ${o.items.length} ${o.items.length === 1 ? 'item' : 'items'}.` : ''}`, saves: `Your list, ${here}.` };
    }
    case 'timer': {
      const o = cfg.timer!;
      return { does: `Times ${listWords(o.steps.slice(0, 4).map((s) => `${s.name.toLowerCase()} ${dur(s.secs)}`))}${o.steps.length > 4 ? ' and more' : ''}${o.rounds > 1 ? `, ${o.rounds} rounds` : ''}, with a bell at each change while it is open on screen.`, saves: `Your steps and how many times you finished, ${here}.` };
    }
    case 'calc': {
      const k = cfg.calc!.kind;
      const does: Record<CalcKind, string> = {
        tip: 'Works out the tip and splits the bill between people, to the penny.',
        units: 'Converts lengths, weights, cooking measures (UK), temperatures and speeds.',
        fuel: 'Works out what a journey costs in fuel from the miles, your miles per gallon and the pump price.',
        vat: 'Adds VAT to a price or takes it off.',
        loan: 'Works out the monthly payment on a repayment loan or mortgage, and the interest in it.',
        percent: 'Works out percentages: X% of Y, what share X is of Y, and the change from X to Y.',
      };
      return { does: does[k], saves: `Your last numbers and any answers you save, ${here}.` };
    }
    case 'counter': {
      const n = cfg.counter!.names;
      return { does: n.length > 1 ? `Keeps score for ${listWords(n)} with big + and − buttons, and shows who is ahead.` : `Counts with a big + and − button${cfg.counter!.step !== 1 ? ` (by ${fmt(cfg.counter!.step)})` : ''}.`, saves: `The ${n.length > 1 ? 'scores' : 'count'}, ${here}.` };
    }
    case 'habits':
      return { does: `Tick off ${cfg.habits!.names.length ? listWords(cfg.habits!.names.map((x) => x.toLowerCase())) : 'your habits'} each day, with the last 7 days and a streak for each.`, saves: `What you ticked off, ${here}.` };
    case 'notes':
      return { does: 'Write notes and find them again: search, pin the important ones, delete with UNDO.', saves: `Your notes, ${here}.` };
    case 'cards': {
      const o = cfg.cards!;
      return { does: `Flash cards${o.topic ? ` on ${o.topic}` : ''} with spaced repetition: tap to turn a card over; ones you know come back less often.${o.cards.length ? ` It starts with ${o.cards.length} ${o.cards.length === 1 ? 'card' : 'cards'}.` : ' You add the cards.'}`, saves: `Your cards and how well you know each one, ${here}.` };
    }
    default:
      return { does: 'Merge, the sliding-tiles number game: join equal tiles to reach 2048.', saves: `The game in progress and your best score, ${here}.` };
  }
}

/**
 * The app for a request: the brief read from the owner's words, the model's choices on top where they are
 * valid (its words cleaned), and the kit's defaults for the rest. `id` is the link name.
 */
export function planApp(request: string, a: Record<string, unknown>, id: string): AppPlan {
  const brief = readApp(request);
  const assumed: string[] = [];
  const questions = brief.questions.slice();
  const pick = typeof a.shape === 'string' && (APP_SHAPES as string[]).includes(a.shape) ? (a.shape as AppShape) : undefined;
  const shape: AppShape = pick ?? brief.shape ?? 'list';
  // A question about the kind of app is answered once the model picked one.
  const qs = pick ? questions.filter((q) => q.key !== 'shape' && !(q.key === 'subject' && cleanWords(a.title, 28))) : questions;
  const look = SHAPE_LOOK[shape];
  const shapeChanged = !!brief.shape && shape !== brief.shape;
  const title = cleanWords(a.title, 28) || (!shapeChanged && brief.title) || look.title;
  const accent = (typeof a.accent === 'string' && (ACCENT_IDS as string[]).includes(a.accent) ? a.accent : brief.accent ?? look.accent) as AccentId;
  const glyph = (typeof a.glyph === 'string' && (GLYPH_IDS as string[]).includes(a.glyph) ? a.glyph : (!shapeChanged && brief.glyph) || look.glyph) as GlyphId;
  const items = cleanList(a.items, 60, 120);
  const cfg: AppConfig = { v: 1, id, shape, title, short: shortName(cleanWords(a.short_name, 12) || title), tagline: cleanWords(a.tagline, 90), does: '', saves: '', accent, glyph };
  const same = !shapeChanged;
  switch (shape) {
    case 'tracker': {
      const money = typeof a.unit === 'string' ? /^£|pounds?$|money/i.test(a.unit) : same && !!brief.money;
      const unit = money ? '£' : cleanText(a.unit, 16) || (same && brief.unit) || 'times';
      const unit1 = money ? '£' : cleanText(a.unit_one, 16) || (unit === 'glasses' ? 'glass' : unit === 'times' ? 'time' : unit.replace(/(?<=..)s$/, ''));
      const goal = numOf(a.goal) ?? (same ? brief.goal : undefined);
      const mode = a.mode === 'last' || a.mode === 'sum' ? a.mode : (same && brief.mode) || 'sum';
      const amounts = nums(a.amounts, 6).filter((x) => x > 0);
      const briefAmounts = same ? brief.items.map(Number).filter((x) => Number.isFinite(x) && x > 0) : [];
      cfg.tracker = {
        unit,
        unit1,
        goal: goal !== undefined && goal > 0 ? goal : 0,
        dir: a.direction === 'limit' || a.direction === 'reach' ? a.direction : (same && brief.dir) || 'reach',
        mode,
        period: a.period === 'week' || a.period === 'day' ? a.period : (same && brief.period) || 'day',
        amounts: amounts.length ? amounts : briefAmounts.length ? briefAmounts : mode === 'last' ? [] : money ? [1, 5, 10] : [1],
        money,
      };
      if (numOf(a.goal) !== undefined) {
        const i = qs.findIndex((q) => q.key === 'goal');
        if (i >= 0) qs.splice(i, 1);
      }
      break;
    }
    case 'list':
      cfg.list = { kind: (['todo', 'shopping', 'packing', 'checklist'] as ListKind[]).includes(a.list_kind as ListKind) ? (a.list_kind as ListKind) : (same && brief.list) || 'checklist', items: items.length ? items : same ? brief.items : [] };
      break;
    case 'timer': {
      const steps = cleanSteps(a.steps);
      const r = numOf(a.rounds);
      cfg.timer = { steps: steps.length ? steps : same && brief.steps?.length ? brief.steps : [{ name: 'Timer', secs: 600 }], rounds: r !== undefined && r >= 1 ? Math.min(99, Math.round(r)) : (same && brief.rounds) || 1 };
      if (steps.length) {
        const i = qs.findIndex((q) => q.key === 'steps');
        if (i >= 0) qs.splice(i, 1);
      }
      break;
    }
    case 'calc': {
      const k = typeof a.calc === 'string' && (CALC_KINDS as string[]).includes(a.calc) ? (a.calc as CalcKind) : (same && brief.calc) || 'tip';
      cfg.calc = { kind: k };
      if (typeof a.calc === 'string' && (CALC_KINDS as string[]).includes(a.calc)) {
        const i = qs.findIndex((q) => q.key === 'calc');
        if (i >= 0) qs.splice(i, 1);
      }
      break;
    }
    case 'counter': {
      const names = items.length ? items.slice(0, 8).map((x) => x.slice(0, 24)) : same && brief.items.length ? brief.items : qs.some((q) => q.key === 'players') ? ['Home', 'Away'] : [title === 'Counter' ? 'Count' : title];
      const step = numOf(a.step);
      cfg.counter = { names, step: step !== undefined && step > 0 && step <= 1000 ? step : 1 };
      if (items.length) {
        const i = qs.findIndex((q) => q.key === 'players');
        if (i >= 0) qs.splice(i, 1);
      }
      break;
    }
    case 'habits': {
      const names = items.length ? items.slice(0, 12).map((x) => x.slice(0, 40)) : same && brief.items.length ? brief.items : ['Walk', 'Read', 'Drink water'];
      cfg.habits = { names };
      if (items.length) {
        const i = qs.findIndex((q) => q.key === 'habits');
        if (i >= 0) qs.splice(i, 1);
      }
      break;
    }
    case 'cards': {
      const cards = cleanCards(a.cards);
      const topic = cleanWords(a.topic, 40) || (same ? brief.subject : '') || '';
      cfg.cards = { topic, cards };
      if (topic || cards.length) {
        const i = qs.findIndex((q) => q.key === 'topic');
        if (i >= 0) qs.splice(i, 1);
      }
      break;
    }
    default:
      break;
  }
  const d = describe(cfg);
  cfg.does = d.does;
  cfg.saves = d.saves;
  if (shape === 'cards' && !cfg.cards!.cards.length) assumed.push('the deck starts empty: you add the cards in the app');
  return { cfg, brief, assumed, questions: qs.slice(0, 2), limits: brief.limits.map((l) => l.text) };
}

export { shapeNoun };
