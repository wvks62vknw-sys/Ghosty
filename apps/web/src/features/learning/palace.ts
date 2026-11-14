/**
 * MEMORY PALACE (learn.s7): the old trick for remembering a list in order. He names places along a walk through his own home
 * (kept on this phone, never sent), and the things he wants to remember (his own: a shopping list, a speech's points, names
 * with a cue). Each thing is put at a place with a line to picture; then they are hidden and he recalls each one by its place.
 * The score is kept with his streak like any other drill, on this phone.
 */
import { clear, h } from '../../core/dom';
import { button } from '../../ui/components';
import { palacePairs, palaceScore } from './palacepairs';

export { palacePairs, palaceScore };

const KEY = 'ghosty.palace';
export const palaceState = { places: 0, items: 0, step: 'set' as 'set' | 'look' | 'recall' | 'done', right: 0, of: 0 };

const load = (): { places: string; items: string } => {
  try {
    return { places: '', items: '', ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as object) };
  } catch {
    return { places: '', items: '' };
  }
};
const save = (v: { places: string; items: string }) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    /* blocked storage: the drill still runs */
  }
};

/** The MEMORY PALACE box under the memory drills. `logIt`: the drill's score kept with his streak. */
export function palaceBox(logIt: (score: number, of: number) => void): HTMLElement {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.palace = palaceState;
  const kept = load();
  const places = h('textarea', { rows: 3, 'aria-label': 'Places along a walk through your home, one per line or with commas', placeholder: 'front door, hall mirror, stairs, kitchen table, back door' }) as HTMLTextAreaElement;
  const items = h('textarea', { rows: 3, 'aria-label': 'The things to remember, in order', placeholder: 'milk, call the garage, Priya’s birthday, bin day' }) as HTMLTextAreaElement;
  places.value = kept.places;
  items.value = kept.items;
  const say = h('p.pknote', { role: 'status' });
  const stage = h('div.pkcol.pkpalace');
  const split = (t: string) => t.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
  const begin = () => {
    save({ places: places.value, items: items.value });
    const pairs = palacePairs(split(places.value), split(items.value));
    palaceState.places = split(places.value).length;
    palaceState.items = split(items.value).length;
    if (pairs.length < 3) return void (say.textContent = 'Give at least three places and three things to remember.');
    if (split(items.value).length > pairs.length) say.textContent = `Only the first ${pairs.length} things fit your ${pairs.length} places: add places for more.`;
    else say.textContent = '';
    palaceState.step = 'look';
    clear(stage, h('b.pklab', 'WALK THROUGH IT'), h('ol.pkpairs', ...pairs.map((p) => h('li', h('b', `${p.place}: ${p.item}`), h('small', p.picture)))), h('div.pkrow', button('I HAVE PICTURED THEM', () => recall(pairs), 'on')));
  };
  const recall = (pairs: ReturnType<typeof palacePairs>) => {
    palaceState.step = 'recall';
    const boxes = pairs.map((p) => h('input', { type: 'text', autocomplete: 'off', 'aria-label': `What is at the ${p.place}?`, placeholder: `What is at the ${p.place}?` }) as HTMLInputElement);
    clear(stage, h('b.pklab', 'WALK BACK THROUGH IT'), ...pairs.map((p, i) => h('label.pkfield', h('span.pklab', p.place), boxes[i]!)), h('div.pkrow', button('CHECK', () => {
      const got = palaceScore(pairs, boxes.map((b) => b.value));
      Object.assign(palaceState, { step: 'done', right: got, of: pairs.length });
      clear(stage, h('p.pkpass', `${got} of ${pairs.length} remembered.`), h('ol.pkpairs', ...pairs.map((p, i) => h('li', `${p.place}: ${p.item}${palaceScore([p], [boxes[i]!.value]) ? ' ✓' : ` (you said: ${boxes[i]!.value.trim() || 'nothing'})`}`))), h('div.pkrow', button('AGAIN', () => begin(), 'on')));
      logIt(got, pairs.length);
    }, 'on')));
    boxes[0]?.focus();
  };
  return h('div.pkpalacebox', h('b.pklab', 'MEMORY PALACE'), h('p.pknote', 'Put each thing you want to remember at a place on a walk through your home, picture it there, then walk back and say what is at each place. The places stay on this phone.'), h('label.pkfield', h('span.pklab', 'Places, in the order you walk'), places), h('label.pkfield', h('span.pklab', 'Things to remember, in order'), items), say, h('div.pkrow', button('START THE WALK', () => begin(), 'on')), stage);
}
