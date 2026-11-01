/**
 * ABILITIES — THE EVERYTHING TAB (BRIEF-EVERYTHING; OWNER-ISSUES 92 ①, his words: "you should be able to like click on
 * every single thing he is able to do in one tab and it like explains it there"). Every single thing Ghosty can do, from
 * the catalogue (packages/shared/src/catalogue.ts) joined with the registries the code runs on (abilities/registry.ts
 * `catalogue`: the brain's items as it last told this phone, the phone's own) — drawn with no model and no signal.
 *
 * Top: the search ("can you…?" is the same search, shared/abilities.ts searchAbilities with its synonyms): a yes with the
 * things that do it, the nearest, or "not yet" with YES to put it on my learning list. The count and what is NEW (14 days).
 * The eight CATS as chips that narrow the list. Then the SCENES, a panel each (a thing may sit in two), each card the
 * plain name and its one line; a tap opens its sheet: the explanation, SAY IT LIKE THIS, TRY IT (what it will do said on
 * the button), WHAT IT NEEDS, WHERE IT LIVES, SINCE, and for a brain tool WHY I MIGHT USE IT MYSELF. LEARNING at the end:
 * what he asked me to learn and my upgrade plan's open steps.
 *
 * Reached from the Me sheet (Abilities), the Every screen deck (Me group) and #abilities. What a spec reads is at
 * window.__ghosty.abilities.
 */
import { CATS, searchAbilities, whatAbout, type AbilityCat } from '../../../../../packages/shared/src/abilities';
import { countLine, isNew, NEEDS, SCENES, searchable, type CatEntry, type CatKind, type Scene } from '../../../../../packages/shared/src/catalogue';
import { brain } from '../../api/brain';
import { brainSide, catalogue, loadBrainSide, tryIt, tryKey } from '../../abilities/registry';
import { APP_WIDE, CHAT_CONTROLS } from '../../abilities/sources';
import { allCommands } from '../../commands/registry';
import { clear, fmt, h, icon } from '../../core/dom';
import { CARDS } from '../../shell/hubcards';
import { perform } from '../../shell/launcher';
import { tabs, type TabDef } from '../../shell/tabs';
import { button, empty, modal, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';

const STAR = '<path d="M12 3.2l2.5 5.5 6 .6-4.5 4 1.3 5.9L12 16.2l-5.3 3 1.3-5.9-4.5-4 6-.6z"/>';
const CHEV = '<path d="M9.5 6l6 6-6 6"/>';
/** Cards a scene shows before "Show all"; with a chip on or a search, all of them. */
const SHOWN = 8;
/** Search results shown at most. */
const FOUND = 12;
/** A scene's order: the screens and their panels first, then what to say and tap, the brain's tools, what runs by itself. */
const RANK: Partial<Record<CatKind, number>> = { screen: 0, panel: 1, deck: 1, lens: 1, game: 1, studio: 1, stage: 1, bench: 2, phrase: 2, chat: 2, me: 2, hub: 2, theme: 3, mood: 3, app: 3, tool: 4, say: 4, telegram: 5, job: 6 };

/** What the screen shows, for specs (window.__ghosty.abilities). */
export const abilitiesState = {
  /** Entries shown (distinct things), the registry items they stand for, and the items with no words (should be none). */
  count: 0,
  items: 0,
  missing: [] as string[],
  /** The brain's items as last heard (0 before it ever answered). */
  brain: 0,
  fresh: 0,
  /** The entries that are NEW (arrived within 14 days), and how many there are of each chip. */
  newIds: [] as string[],
  perCat: {} as Record<string, number>,
  scenes: [] as string[],
  cat: '' as '' | AbilityCat,
  /** TRY ITs that land nowhere this build has (a screen, a panel title, a command): should be none. */
  broken: [] as string[],
  /** The sheet open now, and the last TRY IT tapped (its id and where it went). */
  open: '',
  tried: '',
  triedGo: '',
  goals: 0,
  steps: 0,
  asked: '',
  answer: '' as '' | 'hit' | 'near' | 'none' | 'learned',
  found: [] as string[],
  /** The chat's controls and what works everywhere, by the element each is (abilities/sources.ts), for the spec to find. */
  controls: [] as { id: string; sel: string }[],
};

/** Where a TRY IT goes, checked against what this build really has. */
function lands(e: CatEntry): boolean {
  const g = e.go;
  if ('ask' in g) return !!g.ask.trim();
  if ('run' in g) return allCommands().some((c) => c.id === g.run);
  return tabs().some((t) => t.id === g.open.split('?')[0]);
}

const day = (since: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(`${since}T12:00:00Z`));

/** One card: the plain name, then the one line (VoiceOver reads them in that order), NEW when it is. */
function card(e: CatEntry, open: (e: CatEntry) => void): HTMLElement {
  const fresh = isNew(e.since);
  return h('button.catcard', { type: 'button', 'aria-label': `${e.name}. ${e.line}${fresh ? ' New.' : ''}`, dataset: { id: e.id, kind: e.kind, cat: e.cat, case: 'keep', ...(e.off ? { off: '1' } : {}) }, onclick: () => open(e) },
    h('span.cattxt',
      h('b.catname', e.name),
      h('span.catline', e.line),
    ),
    fresh ? h('i.catnew', 'NEW') : null,
    icon(CHEV),
  );
}

/** The sheet: what it does, how to say it, TRY IT, what it needs, where it lives, since when, and why I might use it. */
function sheet(e: CatEntry): void {
  abilitiesState.open = e.id;
  const sec = (k: string, ...kids: (Node | string | null)[]) => h('section.catsec', h('small.catk', k), ...kids);
  let m: { close(): void } | null = null;
  const tryBtn = h('button.cattry.on', { type: 'button', dataset: { case: 'keep', go: tryKey(e.go) }, onclick: () => {
    abilitiesState.tried = e.id;
    abilitiesState.triedGo = tryKey(e.go);
    m?.close();
    tryIt(e.go);
  } }, e.tryLabel);
  const body = h('div.catbody', { dataset: { id: e.id } },
    h('p.catlead', e.line),
    h('p.catmore', e.more),
    e.off ? h('p.catoff', `Not set up yet: ${e.off.replace(/^needs/, 'it needs')}.`) : null,
    sec('SAY IT LIKE THIS', h('ul.catsay', ...e.say.map((s) => h('li', s)))),
    sec('TRY IT', tryBtn),
    e.needs?.length
      ? sec('WHAT IT NEEDS', ...e.needs.map((n) => {
          const need = NEEDS[n];
          const go = need.go;
          return h('div.catneed', h('span', need.words), go ? h('button.catset', { type: 'button', dataset: { case: 'keep' }, onclick: () => (m?.close(), tryIt(go)) }, 'Set up') : null);
        }))
      : null,
    sec('WHERE IT LIVES', h('p', e.where)),
    sec('SINCE', h('p', `${day(e.since)}${isNew(e.since) ? ' · new' : ''}`)),
    e.why ? sec('WHY I MIGHT USE IT MYSELF', h('p', e.why)) : null,
  );
  m = modal(e.name, body, () => (abilitiesState.open = ''));
  // the name as he wrote it (MOT, Telegram, God’s eye): never set in sentence case
  const head = [...document.querySelectorAll<HTMLElement>('.modal .mhead b')].at(-1);
  if (head) head.dataset.case = 'keep';
}

export const abilitiesTab: TabDef = {
  id: 'abilities',
  title: 'ABILITIES',
  icon: STAR,
  scene: 'backdrop',
  blurb: 'everything I can do, and what I am learning',
  now() {
    const n = abilitiesState.count;
    return n ? `${n} things I can do` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'ABILITIES', sub: 'Everything I can do. Tap any one: it explains itself.', stack: true });
    root.classList.add('abilities');
    const hubs = Object.keys(CARDS);
    let list: CatEntry[] = [];

    // ---- the search ("can you…?" is the same search)
    const cp = panel('CAN YOU…?', { grow: false, cls: 'abcan' });
    const input = h('input.canin', { type: 'search', placeholder: 'Anything: “train”, “scam”…', 'aria-label': 'Search everything I can do, or ask: can you…?', enterkeyhint: 'search', autocomplete: 'off', autocapitalize: 'sentences' });
    const ans = h('div.canans', { 'aria-live': 'polite' });
    const chips = h('div.catchips', { role: 'group', 'aria-label': 'Show only' });
    const offer = (lead: string, words: string) => {
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
        abilitiesState.asked = '';
        clear(ans);
        paintScenes();
      });
      for (const b of [yes, no]) b.dataset.case = 'keep';
      yes.classList.add('learnyes');
      no.classList.add('learnno');
      return [h('p.canline', { dataset: { case: 'keep' } }, lead), h('div.row.canoffer', yes, no)];
    };
    const ask = () => {
      const words = whatAbout(input.value);
      abilitiesState.asked = words;
      if (!words) {
        abilitiesState.answer = '';
        abilitiesState.found = [];
        clear(ans);
        return paintScenes();
      }
      const r = searchAbilities(list.map(searchable), words, FOUND);
      abilitiesState.answer = r.kind;
      abilitiesState.found = r.hits.map((x) => x.ability.id);
      const byId = new Map(list.map((e) => [e.id, e]));
      const cards = r.hits.map((x) => byId.get(x.ability.id)).filter((e): e is CatEntry => !!e).map((e) => card(e, sheet));
      if (r.kind === 'hit') clear(ans, h('p.canline', { dataset: { case: 'keep' } }, r.hits.length > 1 ? `Yes. ${r.hits.length} ways:` : 'Yes.'), h('div.catlist', ...cards));
      else if (r.kind === 'near') clear(ans, h('p.canline', { dataset: { case: 'keep' } }, 'Not quite. The nearest I’ve got:'), h('div.catlist', ...cards.slice(0, 4)), ...offer('Want me to learn it properly?', words));
      else clear(ans, ...offer('Not yet. Want me to learn it?', words));
      // while something is asked, the scenes step aside: the answer is the list
      paintScenes();
    };
    let typing: ReturnType<typeof setTimeout> | null = null;
    input.addEventListener('input', () => {
      if (typing) clearTimeout(typing);
      typing = setTimeout(ask, input.value.trim() ? 220 : 0);
    });
    const form = h('form.canform', { role: 'search' }, input, button('ASK', () => ask(), 'on canask'));
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (typing) clearTimeout(typing);
      ask();
      input.blur();
    });
    cp.body.append(form, chips, ans);
    P.left.append(cp.el);

    // ---- the scenes, a panel each
    const scenePanels = new Map(SCENES.map((s) => [s.id, panel(s.label, { grow: false, cls: 'catscene' })]));
    const expanded = new Set<Scene>();
    for (const [id, p] of scenePanels) p.el.dataset.scene = id;
    P.left.append(...[...scenePanels.values()].map((p) => p.el));
    const lp = panel('LEARNING', { grow: false, cls: 'ablearn' });
    P.right.append(lp.el);

    const paintChips = () => {
      const all = [{ id: '' as const, label: 'All' }, ...CATS];
      clear(chips, ...all.map((c) => {
        const on = abilitiesState.cat === c.id;
        const n = c.id ? list.filter((e) => e.cat === c.id).length : list.length;
        return h(`button.catchip${on ? '.on' : ''}` as 'button', {
          type: 'button', dataset: { cat: c.id, case: 'keep' }, 'aria-pressed': String(on), 'aria-label': `${c.label === 'All' ? 'Everything' : c.label}: ${n}`,
          onclick: () => {
            abilitiesState.cat = abilitiesState.cat === c.id ? '' : c.id;
            paintChips();
            paintScenes();
          },
        }, c.label === 'All' ? 'All' : c.label.charAt(0) + c.label.slice(1).toLowerCase());
      }));
    };

    const paintScenes = () => {
      const searching = !!abilitiesState.asked;
      abilitiesState.scenes = [];
      for (const s of SCENES) {
        const p = scenePanels.get(s.id)!;
        const mine = list.filter((e) => e.scene.includes(s.id) && (!abilitiesState.cat || e.cat === abilitiesState.cat));
        p.el.hidden = searching || !mine.length;
        p.setStatus(String(mine.length), mine.length ? 'ok' : 'off');
        if (p.el.hidden) continue;
        abilitiesState.scenes.push(s.label);
        // the screens and their panels first, then what to say and tap, then the brain's tools, then what runs by itself
        const sorted = [...mine].sort((a, b) => (RANK[a.kind] ?? 3) - (RANK[b.kind] ?? 3));
        const all = !!abilitiesState.cat || expanded.has(s.id) || sorted.length <= SHOWN + 2;
        const shown = all ? sorted : sorted.slice(0, SHOWN);
        clear(p.body, h('div.catlist', ...shown.map((e) => card(e, sheet))),
          all ? null : h('button.catmore', { type: 'button', dataset: { case: 'keep' }, onclick: () => (expanded.add(s.id), paintScenes()) }, `Show all ${sorted.length}`));
      }
    };

    const paintLearning = () => {
      const info = brainSide.get().info;
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

    const paint = () => {
      const c = catalogue(hubs);
      // (an answer on screen is asked again only when what I can do changed: never under his finger, never over "On my list")
      const changed = c.entries.length !== list.length;
      list = c.entries;
      abilitiesState.count = list.length;
      abilitiesState.items = c.items;
      abilitiesState.missing = c.missing;
      abilitiesState.brain = brainSide.get().info.catalogue?.length ?? 0;
      abilitiesState.newIds = list.filter((e) => isNew(e.since)).map((e) => e.id);
      abilitiesState.fresh = abilitiesState.newIds.length;
      abilitiesState.perCat = Object.fromEntries(CATS.map((c) => [c.id, list.filter((e) => e.cat === c.id).length]));
      abilitiesState.broken = list.filter((e) => !lands(e)).map((e) => `${e.id} → ${tryKey(e.go)}`);
      abilitiesState.controls = [...CHAT_CONTROLS, ...APP_WIDE].map((x) => ({ id: x.id, sel: x.sel }));
      clear(P.big, h('span', { dataset: { case: 'keep' } }, `${list.length} things`));
      P.sub.textContent = `${countLine(list.length, abilitiesState.fresh)} Tap any one: it explains itself.`;
      paintChips();
      if (abilitiesState.asked && changed && abilitiesState.answer !== 'learned') ask();
      else paintScenes();
      paintLearning();
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
      describe: () => `Abilities: ${abilitiesState.count} things I can do, ${abilitiesState.fresh} new; ${abilitiesState.goals} learning goals`,
    };
  },
};
