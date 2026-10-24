/** The mini-app kit's types: what the owner asked for (AppBrief) and what one app is (AppConfig). */
import type { AccentId, GlyphId } from './look';

/** The kinds of app the kit makes: each is a template with real logic (runtime/*.ts). */
export type AppShape = 'tracker' | 'list' | 'timer' | 'calc' | 'counter' | 'habits' | 'notes' | 'cards' | 'game';
export const APP_SHAPES: AppShape[] = ['tracker', 'list', 'timer', 'calc', 'counter', 'habits', 'notes', 'cards', 'game'];
export type CalcKind = 'tip' | 'units' | 'fuel' | 'vat' | 'loan' | 'percent';
export const CALC_KINDS: CalcKind[] = ['tip', 'units', 'fuel', 'vat', 'loan', 'percent'];
export type ListKind = 'todo' | 'shopping' | 'packing' | 'checklist';

export interface TrackerOptions {
  /** What one entry counts in, plural and singular ("glasses", "glass"); '£' for money. */
  unit: string;
  unit1: string;
  goal: number;
  /** reach: at least the goal is good (water, steps); limit: at most (spending, coffee). */
  dir: 'reach' | 'limit';
  /** sum: entries add up (water); last: the latest entry is the reading (weight). */
  mode: 'sum' | 'last';
  period: 'day' | 'week';
  /** The quick-add buttons. */
  amounts: number[];
  money: boolean;
}
export interface TimerStep {
  name: string;
  secs: number;
}

/** One mini-app: everything the page is drawn from (kept with the published page; the page is drawn from it each time). */
export interface AppConfig {
  v: 1;
  /** The link name (…/s/<id>/): also the key its saved state lives under on the phone. */
  id: string;
  shape: AppShape;
  title: string;
  /** The Home Screen label (12 characters at most). */
  short: string;
  tagline: string;
  /** What it does and what it saves, in plain words (the page's About and the manifest's description). */
  does: string;
  saves: string;
  accent: AccentId;
  glyph: GlyphId;
  tracker?: TrackerOptions;
  list?: { kind: ListKind; items: string[] };
  timer?: { steps: TimerStep[]; rounds: number };
  calc?: { kind: CalcKind };
  counter?: { names: string[]; step: number };
  habits?: { names: string[] };
  cards?: { topic: string; cards: { q: string; a: string }[] };
}

/** A question for the owner: with a fallback it is asked in the approval (the fallback is used unless they answer); without one the app cannot be made until it is answered. */
export interface Question {
  key: string;
  text: string;
  fallback?: string;
}
/** Something the request asks for that a web mini-app cannot do, said plainly. */
export interface Limit {
  key: 'sync' | 'live' | 'notify' | 'login' | 'background' | 'store' | 'camera' | 'payment';
  text: string;
}

/** The owner's request read into an app (brief.ts). */
export interface AppBrief {
  request: string;
  shape?: AppShape;
  /** What it is about, in the owner's words ("water", "French verbs"). */
  subject?: string;
  title?: string;
  items: string[];
  goal?: number;
  unit?: string;
  money?: boolean;
  dir?: 'reach' | 'limit';
  mode?: 'sum' | 'last';
  period?: 'day' | 'week';
  calc?: CalcKind;
  list?: ListKind;
  steps?: TimerStep[];
  rounds?: number;
  accent?: AccentId;
  glyph?: GlyphId;
  questions: Question[];
  limits: Limit[];
  /** Set when nothing a mini-app can be meets the request (it needs live data, a server…): the honest answer. */
  refuse?: string;
}
