/**
 * ABILITIES (OWNER-ISSUES 68; his words, 31 Oct: "you're gonna have to remind me of all the things he can do for me since
 * I'll basically forget"): everything Ghosty can do, in his voice, grouped the way the owner thinks — SEE · KNOW · BUILD ·
 * WATCH OVER YOU · PLAY · LEARN · DO FOR YOU · TALK. GENERATED, never written by hand: the brain's tool groups
 * (GET /api/abilities) and the app's own screens, games, Lens modes and school stages (abilities/registry.ts). Each one:
 * a plain line, its example asks (each tappable: where it goes, or into the chat box) and GO. One that cannot work yet
 * says so honestly ("needs a key: SYSTEM → KEYS") and GO goes there. LEARNING at the end: what he asked me to learn, and
 * the open steps of the upgrade roadmap.
 *
 * Reached from the Me sheet (Abilities), the Every screen deck (Me group) and #abilities. The state a spec reads is at
 * window.__ghosty.abilities.
 */
import { bestAsk, CATS, searchAbilities, whatAbout, type Ability } from '../../../../../packages/shared/src/abilities';
import { brain } from '../../api/brain';
import { allAbilities, brainSide, go, goKey, loadBrainSide } from '../../abilities/registry';
import { clear, fmt, h, icon } from '../../core/dom';
import { perform } from '../../shell/launcher';
import { tabs, type TabDef } from '../../shell/tabs';
import { allCommands } from '../../commands/registry';
import { button, empty, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';

const STAR = '<path d="M12 3.2l2.5 5.5 6 .6-4.5 4 1.3 5.9L12 16.2l-5.3 3 1.3-5.9-4.5-4 6-.6z"/>';
const CHEV = '<path d="M9.5 6l6 6-6 6"/>';
/** Asks shown on a card before MORE. */
const SHOWN = 3;

/** What the screen shows, for specs (window.__ghosty.abilities). */
export const abilitiesState = { count: 0, brain: 0, off: [] as string[], cats: [] as string[], goals: 0, steps: 0, broken: [] as string[], asked: '', answer: '' as '' | 'hit' | 'near' | 'none' | 'learned', found: [] as string[] };

/** Where a GO goes, checked against what this build really has: a screen that exists, a command that is registered. */
function lands(key: string): boolean {
  const [kind, rest = ''] = key.split(':');
  if (kind === 'ask') return true;
  if (kind === 'run') return allCommands().some((c) => c.id === rest);
  return tabs().some((t) => t.id === rest.split('/')[0]);
}

/** One ability: its line, its asks (each a tap), what is missing when it cannot work yet, and GO. `best`: the ask that fits what he asked (shown, marked). */
function card(a: Ability, best = -1): HTMLElement {
  const asks = a.asks.map((t, i) =>
    h(`button.abask${i === best ? '.best' : ''}` as 'button', { type: 'button', dataset: { case: 'keep', go: goKey(a, i) }, hidden: i >= SHOWN && i !== best, onclick: () => go(a, i) }, a.from === 'brain' ? `“${t}”` : t),
  );
  const hidden = asks.filter((b) => b.hidden).length;
  const more = hidden
    ? h('button.abmore', { type: 'button', dataset: { case: 'keep' }, 'aria-label': `${hidden} more ways to ask`, onclick: (e: Event) => {
        for (const b of asks) b.hidden = false;
        (e.currentTarget as HTMLElement).remove();
      } }, `+${hidden} more`)
    : null;
  return h('div.abil', { dataset: { id: a.id, cat: a.cat, from: a.from, ...(a.off ? { off: '1' } : {}) } },
    h('div.abtop',
      h('p.abline', a.line),
      h('button.abgo', { type: 'button', dataset: { case: 'keep', go: goKey(a) }, 'aria-label': a.off ? `Set it up: ${a.off}` : `Go: ${a.line}`, onclick: () => go(a) }, a.off ? 'Set up' : 'Go', icon(CHEV)),
    ),
    a.off ? h('small.aboff', { dataset: { case: 'keep' } }, a.off.charAt(0).toUpperCase() + a.off.slice(1)) : null,
    asks.length ? h('div.abasks', ...asks, more) : null,
  );
}

export const abilitiesTab: TabDef = {
  id: 'abilities',
  title: 'ABILITIES',
  icon: STAR,
  scene: 'backdrop',
  blurb: 'everything I can do, and what I am learning',
  now() {
    const n = abilitiesState.count || allAbilities().length;
    return n ? `${n} things I can do` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'ABILITIES', sub: 'Everything I can do for you. Go takes you straight there.', stack: true });
    root.classList.add('abilities');
    const panels = new Map(CATS.map((c) => [c.id, panel(c.label, { grow: false, cls: 'abcat' })]));
    for (const [id, p] of panels) p.el.dataset.cat = id;
    const lp = panel('LEARNING', { grow: false, cls: 'ablearn' });
    // "Can you …?" (OWNER-ISSUES 68): his words over everything above — the ability and GO, or "Not yet. Want me to learn it?"
    const cp = panel('CAN YOU…?', { grow: false, cls: 'abcan' });
    const input = h('input.canin', { type: 'search', placeholder: 'Can you…?', 'aria-label': 'Ask: can you…?', enterkeyhint: 'search', autocomplete: 'off', autocapitalize: 'sentences' });
    const ans = h('div.canans', { 'aria-live': 'polite' });
    const ask = () => {
      const words = whatAbout(input.value);
      abilitiesState.asked = words;
      if (!words) return void clear(ans);
      const list = allAbilities();
      const r = searchAbilities(list, words);
      abilitiesState.answer = r.kind;
      abilitiesState.found = r.hits.map((x) => x.ability.id);
      const offer = (lead: string) => {
        const yes = button('Yes, learn it', async (b) => {
          b.disabled = true;
          try {
            await brain.learnGoal(input.value.trim() || words);
          } catch {
            b.disabled = false;
            return toast('I couldn’t reach my brain to note it. Try again when you’re back online.', 'warn');
          }
          abilitiesState.answer = 'learned';
          clear(ans, h('p.canline', { dataset: { case: 'keep' } }, `On my learning list: “${words}”. I’ll work on it, and it shows below under Learning.`));
          void loadBrainSide();
        }, 'on');
        const no = button('No', () => {
          input.value = '';
          abilitiesState.answer = '';
          clear(ans);
        });
        for (const b of [yes, no]) b.dataset.case = 'keep';
        yes.classList.add('learnyes');
        no.classList.add('learnno');
        return [h('p.canline', { dataset: { case: 'keep' } }, lead), h('div.row.canoffer', yes, no)];
      };
      if (r.kind === 'hit') clear(ans, h('p.canline', { dataset: { case: 'keep' } }, 'Yes.'), ...r.hits.slice(0, 2).map((x) => card(x.ability, bestAsk(x.ability, words))));
      else if (r.kind === 'near') clear(ans, h('p.canline', { dataset: { case: 'keep' } }, 'Not quite. The nearest I’ve got:'), card(r.hits[0]!.ability, bestAsk(r.hits[0]!.ability, words)), ...offer('Want me to learn it properly?'));
      else clear(ans, ...offer('Not yet. Want me to learn it?'));
    };
    const form = h('form.canform', { role: 'search' }, input, button('ASK', () => ask(), 'on canask'));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      ask();
      input.blur();
    });
    input.addEventListener('input', () => !input.value.trim() && clear(ans));
    cp.body.append(form, ans);
    P.left.append(cp.el);
    P.left.append(...[...panels.values()].map((p) => p.el));
    P.right.append(lp.el);

    const paint = () => {
      const list = allAbilities();
      const info = brainSide.get().info;
      abilitiesState.count = list.length;
      abilitiesState.brain = list.filter((a) => a.from === 'brain').length;
      abilitiesState.off = list.filter((a) => a.off).map((a) => a.id);
      abilitiesState.cats = [];
      // every GO and every ask lands somewhere real (a spec reads this; nothing broken is ever drawn as working)
      abilitiesState.broken = list.flatMap((a) => [goKey(a), ...a.asks.map((_, i) => goKey(a, i))].filter((k) => !lands(k)).map((k) => `${a.id} → ${k}`));
      P.big.textContent = `${list.length} THINGS`;
      const off = abilitiesState.off.length;
      P.sub.textContent = !brainSide.get().at
        ? 'Everything on this phone I can do. My brain’s abilities show once it answers.'
        : `Everything I can do for you${off ? ` (${off} still need${off === 1 ? 's' : ''} something from you)` : ''}. Go takes you straight there.`;
      for (const c of CATS) {
        const p = panels.get(c.id)!;
        const mine = list.filter((a) => a.cat === c.id);
        p.setStatus(String(mine.length), mine.length ? 'ok' : 'off');
        p.el.hidden = !mine.length;
        if (mine.length) abilitiesState.cats.push(c.label);
        // what works first, then what is waiting on a key; the brain's before the screens', as listed
        clear(p.body, ...[...mine.filter((a) => !a.off), ...mine.filter((a) => a.off)].map((a) => card(a)));
      }
      // LEARNING: his learning goals ("Want me to learn it?" → YES) and the upgrade roadmap's open steps
      const goals = info.goals;
      const steps = info.roadmap.steps;
      abilitiesState.goals = goals.length;
      abilitiesState.steps = steps.length;
      lp.setStatus(goals.length || steps.length ? String(goals.length + steps.length) : 'NONE YET', goals.length || steps.length ? 'ok' : 'off');
      clear(lp.body,
        h('p.ablead', 'I can learn anything you teach me. Ask me “can you …?” above: what I can’t do yet, I put here and work on.'),
        ...(goals.length ? [h('small.abk', 'You asked me to learn'), ...goals.map((g) => h('div.abgoal', { dataset: { id: g.id } }, h('b', { dataset: { case: 'keep' } }, `“${g.ask}”`), h('small', fmt.ago(g.at))))] : []),
        ...(steps.length ? [h('small.abk', `Upgrading myself: ${info.roadmap.goal}`), h('ol.absteps', ...steps.map((s) => h('li', s)))] : []),
        !goals.length && !steps.length ? empty('NONE', 'Nothing yet. When I say “not yet”, tap YES and it lands here.', 'Nothing to learn yet') : null,
        h('div.row', button('UPGRADE IDEAS', () => perform({ open: 'workshop', panel: 'UPGRADE IDEAS' }), 'abideas')),
      );
    };
    paint();
    brainSide.subscribe(paint);
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.abilities = abilitiesState;
    return {
      enter: () => {
        if (w.__ghosty) w.__ghosty.abilities = abilitiesState;
        void loadBrainSide().then(paint);
      },
      describe: () => `Abilities: ${abilitiesState.count} things I can do; ${abilitiesState.goals} learning goals`,
    };
  },
};
