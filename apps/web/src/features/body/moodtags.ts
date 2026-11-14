/**
 * WORDS AND TAGS WITH HIS MOOD (NEXT ROUND, BODY AND KITCHEN lane, body.u13), kept on this phone only (`ghosty.body.moodtags`):
 * a few tags for the day (work, family, slept badly…) and a line of his own, beside the mood he tapped; then which tags turned up
 * on his good days this month, told as what happened (./week.ts patterns says it too). Never read into, never advice.
 */
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { shift } from './trackcore';

export const TAGS = ['Work', 'Family', 'Friends', 'Exercise', 'Outdoors', 'Slept badly', 'Stressed', 'Unwell', 'Rest'];
interface Day {
  tags: string[];
  words: string;
}
const KEY = 'ghosty.body.moodtags';
let cache: Record<string, Day> | null = null;

function load(): Record<string, Day> {
  if (cache) return cache;
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
  } catch {
    raw = {};
  }
  cache = {};
  for (const [d, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !v || typeof v !== 'object') continue;
    const x = v as Partial<Day>;
    cache[d] = { tags: (Array.isArray(x.tags) ? x.tags : []).filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 24)).slice(0, 8), words: typeof x.words === 'string' ? x.words.slice(0, 200) : '' };
  }
  return cache;
}
function save(): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(load()));
    return true;
  } catch {
    return false;
  }
}
/** Every tagged day, for the patterns. */
export const tagDays = (): { d: string; tags: string[] }[] => Object.entries(load()).map(([d, v]) => ({ d, tags: v.tags }));

/** The tags that came with good days (Good or Great) in the last 30 days, most first. */
export function goodTags(moodOf: (d: string) => number | null, today: string): { tag: string; n: number }[] {
  const n = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = shift(today, -i);
    const day = load()[d];
    if (!day || (moodOf(d) ?? 0) < 4) continue;
    for (const t of day.tags) n.set(t, (n.get(t) ?? 0) + 1);
  }
  return [...n.entries()].map(([tag, k]) => ({ tag, n: k })).sort((a, b) => b.n - a.n).slice(0, 5);
}

/** Today's tags and line under the mood keys. */
export function tagBox(today: string, moodOf: (d: string) => number | null, say: (w: string) => void): HTMLElement {
  const data = load();
  const day = data[today] ?? { tags: [], words: '' };
  const box = h('section.bc-tags', { 'aria-label': 'What came with today' });
  const draw = () => {
    const row = h('div.pkrow.bt-moods', { role: 'group', 'aria-label': 'Tags for today' }, ...TAGS.map((t) => {
      const on = day.tags.includes(t);
      const b = button(t, () => {
        day.tags = on ? day.tags.filter((x) => x !== t) : [...day.tags, t].slice(0, 8);
        data[today] = day;
        say(save() ? (on ? `${t}: off today.` : `${t}: kept with today.`) : 'I couldn’t keep that on this phone: its storage is full or switched off.');
        draw();
      }, on ? 'on' : '');
      b.setAttribute('aria-pressed', String(on));
      return b;
    }));
    const words = h('input', { type: 'text', maxlength: '200', value: day.words, placeholder: 'A line about today', 'aria-label': 'A line about today' }) as HTMLInputElement;
    const keep = button('Keep', () => {
      day.words = words.value.trim().slice(0, 200);
      data[today] = day;
      say(save() ? (day.words ? 'Your line is kept with today.' : 'Today’s line cleared.') : 'I couldn’t keep that on this phone.');
    });
    keep.setAttribute('aria-label', 'Keep the line');
    const good = goodTags(moodOf, today);
    box.replaceChildren(h('h3.bt-h', 'What came with today'), row, h('div.pkadd', words, keep),
      h('p.pknote', { dataset: { goodtags: String(good.length) } }, good.length ? `On your good days this month: ${good.map((g) => `${g.tag.toLowerCase()} (${g.n})`).join(', ')}. What happened, not advice.` : 'Tag a few days and the tags that came with your good ones show here.'));
  };
  draw();
  return box;
}
