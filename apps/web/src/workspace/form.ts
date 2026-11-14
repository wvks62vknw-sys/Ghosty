/**
 * FORMS THAT FILL A DATABASE (editors.s1): a database's columns as a form he fills on the phone, each answer becoming a new row (a sign-up
 * sheet, a checklist, a survey of his own). The questions are the database's properties he can type (text, a number, a choice, several
 * choices, a date, a tick, a person); the worked-out ones (formulas, rollups) and links to other lists are left out, and the form says so.
 * Reading one answer into a row's values, with what is wrong said in his words, is here. Pure: apps/edge/test/workspace.test.mjs.
 */
import { dateTyped } from './db';
import type { Database, Prop, PVal } from './model';

export const ASKABLE = new Set(['text', 'number', 'select', 'multi', 'date', 'check', 'person']);
/** The questions a form asks, in the database's order. */
export const formQuestions = (db: Database): Prop[] => db.props.filter((p) => ASKABLE.has(p.kind));
/** The columns a form cannot ask, by name ("Total (worked out)"). */
export const formSkipped = (db: Database): string[] => db.props.filter((p) => !ASKABLE.has(p.kind)).map((p) => `${p.name} (${p.kind === 'relation' ? 'a link to another list' : 'worked out'})`);

export type FormRaw = Record<string, string | boolean | string[]>;
/** One answer read into a row: its name and its values, or what is wrong. Empty answers are left empty. */
export function formAnswer(db: Database, name: string, raw: FormRaw): { title: string; vals: Record<string, PVal> } | { error: string } {
  const title = name.trim();
  if (!title) return { error: 'Give it a name first: the first box.' };
  const vals: Record<string, PVal> = {};
  for (const p of formQuestions(db)) {
    const v = raw[p.id];
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) continue;
    if (p.kind === 'number') {
      const n = Number(String(v).replace(/[£$€,\s]/g, ''));
      if (!Number.isFinite(n)) return { error: `“${String(v)}” is not a number: ${p.name} wants a number.` };
      vals[p.id] = n;
    } else if (p.kind === 'date') {
      const d = dateTyped(String(v));
      if (!d) return { error: `I could not read “${String(v)}” as a date for ${p.name}.` };
      vals[p.id] = d;
    } else if (p.kind === 'check') vals[p.id] = v === true;
    else if (p.kind === 'multi') vals[p.id] = (Array.isArray(v) ? v : [String(v)]).filter((x) => (p.options ?? []).includes(x));
    else if (p.kind === 'select') {
      if (!(p.options ?? []).includes(String(v))) return { error: `“${String(v)}” is not one of ${p.name}’s choices.` };
      vals[p.id] = String(v);
    } else vals[p.id] = String(v).trim().slice(0, 2000);
  }
  return { title: title.slice(0, 200), vals };
}
