/**
 * SPACE → DESIGN MY HOME (OWNER-ISSUES 7, part 2): the owner describes the home in plain words, DESIGN
 * sends them to Ghosty as their own chat message (the brain's design_home draws it: code, not a model, so
 * every size is measured or said to be assumed), and the plan comes back whole as the `home_plan` command.
 * The phone keeps the last plan ('ghosty.homeplan'): its first floor goes straight into the planner (the
 * plan that was there is kept for PUT BACK MY PLAN), the card shows "Drawn from your words · 6 rooms ·
 * 55.8 m²", what was assumed one tap away, SEE IN 3-D and, for a house, a floor switch; the chat gets a
 * plan card under the reply (features/core/homecard.ts). DESIGN stays on SPACE and shows "Drawing…" until
 * the plan arrives — the plan appears where it was asked for, with no jump to the chat and back; if Ghosty
 * answers in words instead (a question back), the card says so with OPEN CHAT. Offline the button says the
 * brain is needed. The pure parts are in space/homeplan.ts.
 */
import { clear, h } from '../../core/dom';
import { createStore } from '../../core/store';
import { go } from '../../shell/tabs';
import { settings, ui } from '../../state/app';
import { button, panel, toast } from '../../ui/components';
import { holdsStorey, homeLine, readHomePlan, type KeptHome } from '../../space/homeplan';
import type { Plan } from '../../space/plan';
import { planToRoom, roomToPlan } from '../../space/roomjson';
import { space } from '../../space/store';

/** The three examples: a chip fills the words with one. */
export const HOME_EXAMPLES: { label: string; words: string }[] = [
  { label: 'A flat', words: 'A flat with a kitchen, living room, bathroom, two bedrooms and a hall. The living room is 4 by 3.5 m with a sofa and a TV.' },
  { label: 'A 3-bed semi', words: 'A three-bed semi. Downstairs: a hall, a living room 4.5 by 3.6 m with a sofa against the long wall, and a kitchen diner 5 by 3 m at the back with a table for 4. Upstairs: a main bedroom 3.8 by 3.2 m with a double bed, a second bedroom 3 by 2.8 m, a small third bedroom and a bathroom.' },
  { label: 'One L-shaped room', words: 'One L-shaped living room, 6 by 5 metres, with a corner sofa, a coffee table and a dining table for 6.' },
];

/**
 * The kept plan, which floor the planner shows, the planner's plan from before it came (PUT BACK MY
 * PLAN), the words being written, and the DESIGN in progress (`drawing`: when it was pressed; `outcome`:
 * 'chat' when the turn ended without a plan).
 */
export const homePlan = createStore(
  { home: null as KeptHome | null, shown: 0, before: null as Plan | null, words: '', drawing: 0, outcome: '' as '' | 'chat' },
  { persist: 'ghosty.homeplan', keys: ['home', 'shown', 'before', 'words'] },
);

/** The kept storey into the planner (the floor shown before it is saved back first, if the planner still holds it). */
export function showStorey(i: number): void {
  const st = homePlan.get();
  const home = st.home;
  if (!home?.storeys[i]) return;
  const now = space.get().plan;
  const cur = home.storeys[st.shown];
  // the owner's changes to the floor on screen are kept with it before another floor is shown
  if (cur && i !== st.shown && holdsStorey(now, cur)) cur.plan = planToRoom(now) as unknown as Record<string, unknown>;
  const plan = roomToPlan(home.storeys[i]!.plan);
  if (!plan) return void toast('That floor could not be read', 'bad');
  // a plan of the owner's own on screen (none of this home's floors) is kept for PUT BACK MY PLAN
  const theirs = !home.storeys.some((s) => holdsStorey(now, s));
  homePlan.set({ home: { ...home }, shown: i, ...(theirs ? { before: now } : {}) });
  if (!holdsStorey(now, home.storeys[i]!)) space.setPlan(plan);
}

/** The `home_plan` command: the plan design_home drew, kept, its first floor put in the planner, its card in the chat. */
export function receiveHomePlan(args: Record<string, unknown> | undefined): void {
  const home = readHomePlan(args);
  if (!home) return void toast('Ghosty sent a plan this phone could not read whole, so it was not shown', 'bad');
  const plan = roomToPlan(home.storeys[0]!.plan);
  if (!plan) return;
  homePlan.set({ home, shown: 0, before: space.get().plan, drawing: 0, outcome: '' });
  space.setPlan(plan);
  void import('../../assistant/session').then((s) => s.addHomeCard({ id: home.id, rooms: home.rooms, m2: home.m2, storeys: home.storeys.length }));
}

/** The planner on the floor shown (put back if the owner has opened something else since). */
function ensureShown(): boolean {
  const { home, shown } = homePlan.get();
  const st = home?.storeys[shown];
  if (!st) return false;
  if (!holdsStorey(space.get().plan, st)) showStorey(shown);
  return true;
}

/** OPEN IN SPACE (the chat card): the kept plan in the planner. `id`: the card's plan, which a newer one may have replaced. */
export function openHome(id?: string): void {
  const home = homePlan.get().home;
  if (!home) return void toast('That plan is no longer on this phone: describe it again in SPACE → DESIGN MY HOME', 'warn');
  if (id && id !== home.id) toast('A newer plan replaced that one: showing the newest', 'warn');
  ensureShown();
  go('space');
}

/** SEE IN 3-D: the floor shown, built in the 3D STUDIO (the planner's own export). */
export async function seeHome3d(id?: string): Promise<void> {
  const home = homePlan.get().home;
  if (!home) return void toast('That plan is no longer on this phone: describe it again in SPACE → DESIGN MY HOME', 'warn');
  if (id && id !== home.id) toast('A newer plan replaced that one: showing the newest', 'warn');
  ensureShown();
  const { openStudio } = await import('../studio');
  openStudio({ room: planToRoom(space.get().plan) });
}

const offline = () => ui.get().connected === false || navigator.onLine === false;
const unitWords = () => (settings.get().units === 'imperial' ? 'feet and inches' : 'metres');

/** What a test reads (window.__ghosty.space.home). */
export interface HomeState {
  /** The kept plan's id ('' when none). */
  id: string;
  line: string;
  storeys: string[];
  shown: number;
  assumed: number;
  drawing: boolean;
  outcome: string;
  offline: boolean;
}

/** The DESIGN MY HOME card, at the top of SPACE. `onState` is told what it shows. */
export function createHomePanel(onState: (s: HomeState) => void): { el: HTMLElement } {
  const p = panel('DESIGN MY HOME', { status: 'from your words', cls: 'spacehome' });
  const words = h('textarea.spacehomewords', { rows: 4, maxlength: '4000', 'aria-label': 'Describe your home', placeholder: "Describe your home in plain words: the rooms, their sizes in feet or metres, what's where…" });
  words.value = homePlan.get().words;
  let saveWords = 0;
  words.addEventListener('input', () => {
    clearTimeout(saveWords);
    saveWords = window.setTimeout(() => homePlan.set({ words: words.value }), 300);
  });
  const chips = h('div.lenschips.spacehomechips');
  for (const ex of HOME_EXAMPLES) {
    const b = button(ex.label.toUpperCase(), () => {
      words.value = ex.words;
      homePlan.set({ words: ex.words });
      for (const c of chips.querySelectorAll('button')) c.classList.toggle('on', c === b);
    });
    b.dataset.label = ex.label; // route C: the words as written
    chips.append(b);
  }
  const unitLine = h('div.note.spacehomeunit');
  const designBtn = button('DESIGN', () => void design(), 'on spacehomego');
  const status = h('div.spacehomestatus', { role: 'status', 'aria-live': 'polite' });
  const result = h('div.spacehomeresult');

  const design = async () => {
    const said = words.value.trim();
    if (offline()) return;
    if (said.length < 6) return void toast('Describe your home first: the rooms, and their sizes if you know them', 'warn');
    if (ui.get().busy) return void toast('Ghosty is still busy with the last thing: try again in a moment', 'warn');
    clearTimeout(saveWords);
    const since = Date.now();
    homePlan.set({ words: said, drawing: since, outcome: '' });
    const { send } = await import('../../assistant/session');
    // the owner's own message, so the brain's own tool runs (and the plan comes back as `home_plan`)
    await send(`Design my home (sizes in ${unitWords()}): ${said}`, { cloud: true }).catch(() => undefined);
    // the turn is over: no plan came (Ghosty asked something back, or could not draw it)
    if (homePlan.get().drawing === since) homePlan.set({ drawing: 0, outcome: 'chat' });
  };

  // the list of assumptions stays open across repaints once opened; the card repaints for the plan below only when it stops (or starts) being this one
  let assumedOpen = false;
  let lastOnPlan: boolean | null = null;
  const onPlanNow = () => !!homePlan.get().home?.storeys.some((x) => holdsStorey(space.get().plan, x));
  const paint = () => {
    lastOnPlan = onPlanNow();
    const st = homePlan.get();
    const off = offline();
    const unit = settings.get().units === 'imperial' ? 'imperial' : 'metric';
    unitLine.textContent = `Sizes shown in ${unitWords()}, as set in Settings.`;
    designBtn.disabled = off || !!st.drawing;
    designBtn.textContent = off ? 'NEEDS THE BRAIN · OFFLINE' : st.drawing ? 'DRAWING…' : 'DESIGN';
    delete designBtn.dataset.label;
    if (off) designBtn.dataset.label = 'Needs the brain · offline';
    clear(status);
    if (off) status.append(h('span.note', 'Drawing a plan from your words needs Ghosty’s brain, and this phone is offline. Your words stay here for when you are back.'));
    else if (st.drawing) status.append(h('span.spacehomelive', h('i'), h('span', 'Drawing… Ghosty is reading your words and working out the plan.')));
    else if (st.outcome === 'chat') status.append(h('span.note', 'Ghosty answered in the chat instead of drawing: it may need a word more from you.'), button('OPEN CHAT', () => go('core')));
    clear(result);
    const home = st.home;
    if (home) {
      const line = h('b.spacehomeline', homeLine(home, unit));
      result.append(line);
      // the planner below may hold another plan now (PUT BACK MY PLAN, IMPORT): said, with the way back
      const onPlan = !!lastOnPlan;
      if (home.storeys.length > 1) {
        const seg = h('div.row.spacehomefloors', { role: 'group', 'aria-label': 'Which floor' });
        home.storeys.forEach((x, i) => seg.append(button(x.name.toUpperCase(), () => showStorey(i), onPlan && i === st.shown ? 'on' : '')));
        result.append(seg);
      }
      if (!onPlan) result.append(h('div.row.wrap.spacehomestatus', h('span.note', 'The plan below is another one now.'), button('SHOW IT ON THE PLAN', () => showStorey(st.shown))));
      const notes = [...home.assumed, ...home.cannot.map((c) => `Could not: ${c}`)];
      if (notes.length) {
        const d = h('details.spacehomeassumed', h('summary', `What I assumed (${home.assumed.length})${home.cannot.length ? ` · could not do (${home.cannot.length})` : ''}`), h('ul', ...notes.map((n) => h('li', n))));
        d.open = assumedOpen;
        d.addEventListener('toggle', () => (assumedOpen = d.open));
        result.append(d);
      }
      const see = button('SEE IN 3-D', () => void seeHome3d(), 'on');
      see.dataset.label = 'See in 3-D';
      const row = h('div.row.wrap.spacehomeacts', see);
      if (st.before) {
        row.append(button('PUT BACK MY PLAN', () => {
          const b = homePlan.get().before;
          if (!b) return;
          space.setPlan(b);
          homePlan.set({ before: null });
          toast('Your plan from before is back; the drawn one is still here to open again', 'ok');
        }));
      }
      result.append(row, h('div.note.spacehomehonest', 'Drawn from your words: where you didn’t give a size, Ghosty chose a usual one and says so above. A sketch to plan with, not a survey — it says nothing about planning permission or building regulations.'));
    }
    onState({ id: home?.id ?? '', line: home ? homeLine(home, unit) : '', storeys: home?.storeys.map((s) => s.name) ?? [], shown: st.shown, assumed: home?.assumed.length ?? 0, drawing: !!st.drawing, outcome: st.outcome, offline: off });
  };

  p.body.append(words, chips, unitLine, h('div.row.spacehomebar', designBtn), status, result);
  homePlan.subscribe(paint);
  space.subscribe(() => void (onPlanNow() !== lastOnPlan && paint()));
  ui.subscribe((u, prev) => void (u.connected !== prev.connected && paint()));
  settings.subscribe((s, prev) => void (s.units !== prev.units && paint()));
  window.addEventListener('online', paint);
  window.addEventListener('offline', paint);
  paint();
  return { el: p.el };
}
