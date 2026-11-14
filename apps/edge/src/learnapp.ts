/**
 * YOUR LEARN FLASH CARDS AS AN OFFLINE APP (NEXT ROUND sites.c2, built into Learn's area). "Make my French verbs cards an app" (or the
 * course's ON MY HOME SCREEN key): build_app with from_learn names a course; its cards, as the brain already keeps them (tutor.ts), become
 * a flash-cards mini-app that installs to the Home Screen and revises offline on the bus. Only the course's own cards; said before his
 * APPROVE like every app; the cards themselves stay out of the approval card's arguments (they are read again when it is built).
 */
import { loadCards, loadIndex } from './tutor';
import type { ToolContext } from './tools/types';

const fold = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();
export const MAX_APP_CARDS = 200;

/** The arguments with the course's cards filled in, and what to say about them; the arguments unchanged without from_learn. */
export async function withLearn(a: Record<string, unknown>, ctx: Pick<ToolContext, 'storage'>): Promise<{ args: Record<string, unknown>; said: string }> {
  const asked = typeof a.from_learn === 'string' ? a.from_learn.trim() : '';
  if (!asked) return { args: a, said: '' };
  const index = await loadIndex(ctx.storage).catch(() => []);
  const want = fold(asked).replace(/\b(cards?|course|flash ?cards?|deck)\b/g, '').trim();
  const c = index.find((x) => x.id === asked) ?? index.find((x) => fold(x.topic) === want || fold(x.title) === want) ?? index.find((x) => want && (fold(x.topic).includes(want) || fold(x.title).includes(want) || want.includes(fold(x.topic))));
  if (!c) throw new Error(`no Learn course called "${asked}"${index.length ? ` (his courses: ${index.slice(0, 6).map((x) => x.topic).join(', ')})` : ' — he has no courses yet'}`);
  const cards = (await loadCards(ctx.storage, c.id).catch(() => [])).filter((x) => x.front && x.back);
  if (!cards.length) throw new Error(`the course "${c.topic}" has no cards yet: wrong quiz answers and + CARD make them`);
  const kept = cards.slice(0, MAX_APP_CARDS).map((x) => ({ q: x.front, a: x.back }));
  return {
    args: { ...a, shape: 'cards', title: typeof a.title === 'string' && a.title ? a.title : c.topic.slice(0, 40), topic: c.topic, cards: kept },
    said: ` From your Learn course "${c.topic}": ${kept.length} card${kept.length === 1 ? '' : 's'}${cards.length > kept.length ? ` (the first ${MAX_APP_CARDS} of ${cards.length})` : ''}.`,
  };
}
