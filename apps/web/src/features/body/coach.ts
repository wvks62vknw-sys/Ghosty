/**
 * KITCHEN AND BODY AS ONE COACH (NEXT ROUND, BODY AND KITCHEN lane, which leads it): the chat's turn for every piece that joins
 * the kitchen and the body (./coachwords.ts says which), answered on the phone with no model:
 *  - the week's meal plan made from his recipe book, and its shopping put on the list less what the pantry has (body.u10);
 *  - tablets ticked and asked (./meds.ts, body.s1).
 * Patterns from his own numbers are said as what happened, never as advice or a forecast; every number is a rough estimate.
 */
import { brain } from '../../api/brain';
import { lacksSignal } from '../lifeui';
import { bodyCoachAsked } from './coachwords';

export interface CoachReply {
  reply: string;
  go?: { id: string; ask: number; label: string; run: string; args: Record<string, unknown> };
}
const kitchen = (what: string) => ({ id: 'kitchen', ask: -1, label: 'Open it', run: 'open_kitchen', args: { what } });
const body = (what: string) => ({ id: 'body', ask: -1, label: 'Open it', run: 'open_body', args: { what } });

export async function coachTurn(text: string): Promise<CoachReply | null> {
  const k = bodyCoachAsked(text);
  if (!k) return null;
  if (k === 'meds') {
    const r = (await import('./meds')).medsTurn(text);
    return r ? { reply: r.reply, go: body('meds') } : null;
  }
  if (k === 'weekshop' || k === 'fillweek') {
    if (lacksSignal()) return { reply: 'No signal: the meal plan and the shopping list are kept in my brain, so this waits until you’re back online.', go: kitchen('plan') };
    const larder = await import('../kitchen/larder');
    let days: string[] = [];
    try {
      const r = await brain.packDo('kitchen', 'plan', { words: '' });
      days = (r.data as { plan?: { days?: string[] } } | undefined)?.plan?.days ?? [];
    } catch {
      return { reply: 'My brain didn’t answer, so I can’t read the week’s plan just now. Try again in a moment.', go: kitchen('plan') };
    }
    if (k === 'fillweek') {
      const next = larder.fillWeek(days);
      const added = next.filter((d, i) => d && !days[i]?.trim()).length;
      if (!added) return { reply: 'Every day of the week already has a dinner. Say “shopping for the week” and I put what they need on the list.', go: kitchen('plan') };
      try {
        await brain.packDo('kitchen', 'plan', { days: next });
      } catch {
        return { reply: 'My brain didn’t answer, so the plan didn’t change. Try again in a moment.', go: kitchen('plan') };
      }
      const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return { reply: `Planned from your recipe book, the ones your pantry covers first: ${next.map((d, i) => (d && !days[i]?.trim() ? `${names[i]} ${d}` : '')).filter(Boolean).join(', ')}. Say “shopping for the week” for the list.`, go: kitchen('plan') };
    }
    const w = larder.weekShopping(days);
    if (!w.dishes.length && !w.unknown.length) return { reply: 'Nothing is planned this week yet. Say “plan my dinners” and I fill the week from your recipe book.', go: kitchen('plan') };
    const tail = `${w.have.length ? ` Already in your pantry: ${w.have.slice(0, 8).join(', ')}.` : ''}${w.unknown.length ? ` Not in your recipe book: ${w.unknown.join(', ')}.` : ''}`;
    if (!w.add.length) return { reply: `Your pantry has everything the week’s recipes need.${tail}`, go: kitchen('plan') };
    try {
      await brain.packDo('kitchen', 'shop', { words: `add ${w.add.join(', ')}` });
    } catch {
      return { reply: 'My brain didn’t answer, so the shopping list didn’t change. Try again in a moment.', go: kitchen('plan') };
    }
    return { reply: `On the shopping list for ${w.dishes.length} dinner${w.dishes.length === 1 ? '' : 's'}: ${w.add.map((n) => (w.count[n]! > 1 ? `${n} (×${w.count[n]})` : n)).join(', ')}.${tail}`, go: kitchen('shopping') };
  }
  if (k === 'review' || k === 'sleepscore' || k === 'patterns') {
    const t = await import('./track');
    const w = await import('./week');
    const data = t.load();
    const day = t.todayKey();
    if (k === 'sleepscore') {
      const sc = w.sleepScore(data, day);
      return { reply: sc ? `Your sleep score: ${sc.score} out of 100 from your last ${sc.nights} nights (how long ${sc.duration}, how regular ${sc.regularity}, sleep debt ${sc.debt}). ${w.ROUGH}` : 'Keep three nights in a week, with GOING TO BED and I’M UP or last night’s hours, and your sleep score shows.', go: body('week') };
    }
    if (k === 'patterns') {
      const tags = await import('./moodtags').then((m) => m.tagDays()).catch(() => []);
      const ps = w.patterns(data, day, { tags });
      return { reply: ps.length ? `${ps.map((p) => p.words).join(' ')} ${w.WHAT_HAPPENED}` : 'No pattern yet: each needs at least three days on each side in your own numbers.', go: body('week') };
    }
    const meds = await import('./meds').catch(() => null);
    const r = w.weekReview(data, day, { water: t.goalOf('water', data).v, sleep: t.goalOf('sleep', data).v, steps: t.goalOf('steps', data).v }, meds && meds.loadMeds().meds.length ? meds.weekOf() : undefined);
    if (!r.kept) return { reply: 'Nothing kept this week yet. Log water, sleep, steps or your mood and the week fills in.', go: body('week') };
    return { reply: `The last 7 days: ${r.cells.filter((c) => c.value !== 'none kept').map((c) => `${c.label.toLowerCase()} ${c.value}`).join('; ')}.${r.best ? ` Best day: ${r.best.words}` : ''} ${w.ROUGH}`, go: body('week') };
  }
  return null;
}
