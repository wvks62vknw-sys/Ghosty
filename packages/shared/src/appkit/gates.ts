/**
 * The mini-app kit's gates, run before anything is published (alongside check_html): the colours read
 * (WCAG AA), the words are clean and claim nothing the app cannot do, the options are in range, the
 * page carries exactly the kit's script (the one its CSP pins) and its config round-trips, nothing in
 * the script reaches the network or evaluates text, and the page stays small. Errors stop the publish.
 */
import { contrast } from '../sitekit/tokens';
import { CARD, colours, INK2 } from './look';
import { appScript, safeJson, appBase } from './render';
import type { AppConfig } from './types';
import { claims, placeholder } from './write';

export interface AppGates {
  errors: string[];
  warnings: string[];
  score: number;
}

export function runAppGates(cfg: AppConfig, html: string): AppGates {
  const errors: string[] = [];
  const warnings: string[] = [];
  const c = colours(cfg.accent);
  if (contrast(c.ink, CARD) < 4.5) errors.push(`contrast: the accent text ${c.ink} on the cards is ${contrast(c.ink, CARD).toFixed(2)}:1 (4.5 needed)`);
  if (contrast(c.on, c.acc) < 4.5) errors.push(`contrast: button words on ${c.acc} are ${contrast(c.on, c.acc).toFixed(2)}:1 (4.5 needed)`);
  if (contrast(INK2, CARD) < 4.5) errors.push('contrast: the secondary text is too faint on the cards');
  // words
  if (!cfg.title.trim() || cfg.title.length > 28) errors.push('words: the title must be 1–28 characters');
  if (cfg.short.length > 12) errors.push('words: the Home Screen name is longer than 12 characters');
  if (cfg.tagline.length > 90) errors.push('words: the line under the title is longer than 90 characters');
  for (const [what, t] of [['title', cfg.title], ['line under it', cfg.tagline]] as const) {
    if (claims(t)) errors.push(`honesty: the ${what} claims something a web mini-app cannot do ("${t}")`);
    if (placeholder(t)) errors.push(`words: the ${what} is placeholder text ("${t}")`);
  }
  if (/App Store/.test(cfg.does + cfg.saves) || !/on this phone only/.test(cfg.saves)) errors.push('honesty: what it does and saves must be the kit’s own plain words');
  // options in range
  const o = cfg.tracker;
  if (cfg.shape === 'tracker' && (!o || !(o.goal >= 0) || o.amounts.length > 6 || o.amounts.some((x) => !Number.isFinite(x)) || !o.unit)) errors.push('options: the tracker needs a unit, a goal of 0 or more and up to six quick amounts');
  if (cfg.shape === 'list' && (!cfg.list || cfg.list.items.length > 500 || cfg.list.items.some((x) => !x || x.length > 120))) errors.push('options: list items must be 1–120 characters, 500 at most');
  if (cfg.shape === 'timer' && (!cfg.timer || !cfg.timer.steps.length || cfg.timer.steps.length > 20 || cfg.timer.steps.some((s) => !(s.secs >= 1 && s.secs <= 86_400)) || !(cfg.timer.rounds >= 1 && cfg.timer.rounds <= 99))) errors.push('options: a timer needs 1–20 steps of 1 second to 24 hours, and 1–99 rounds');
  if (cfg.shape === 'counter' && (!cfg.counter || !cfg.counter.names.length || cfg.counter.names.length > 8)) errors.push('options: a counter needs 1–8 names');
  if (cfg.shape === 'habits' && (!cfg.habits || cfg.habits.names.length > 12)) errors.push('options: 12 habits at most');
  if (cfg.shape === 'cards' && (!cfg.cards || cfg.cards.cards.length > 1000)) errors.push('options: 1,000 cards at most');
  if (cfg.shape === 'calc' && !cfg.calc) errors.push('options: the calculator has no kind');
  // the page itself
  const { script } = appScript(cfg.shape);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  const runnable = scripts.filter((m) => !/type\s*=\s*["']?application\/json/i.test(m[1]!));
  if (runnable.length !== 1 || runnable[0]![2] !== script) errors.push("script: the page must carry exactly the kit's script (the one its security policy allows)");
  const data = scripts.find((m) => /id\s*=\s*["']?app-cfg/.test(m[1]!))?.[2];
  if (data !== safeJson({ ...cfg, base: appBase(cfg.id) })) errors.push('script: the app’s settings in the page do not match its config');
  if (/\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|\bimport\s*\(|\beval\s*\(|new Function|innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(script)) errors.push('script: the kit script reaches the network or writes markup');
  if (/\son[a-z]+\s*=/i.test(html.replace(/<script[\s\S]*?<\/script>/gi, ''))) errors.push('script: an inline event handler in the page (its security policy would block it)');
  if (html.length > 150_000) errors.push(`size: the page is ${Math.round(html.length / 1024)} KB (150 KB at most)`);
  else if (html.length > 90_000) warnings.push(`size: the page is ${Math.round(html.length / 1024)} KB`);
  const score = Math.max(0, 100 - errors.length * 20 - warnings.length * 4);
  return { errors, warnings, score };
}
