/**
 * A sheet's pages as a screen of its own (BRIEF-TABS 2; OWNER-ISSUES 119, his words: "can't we add tabs for everything we have
 * like all the tabs we already have"). The fourteen features that lived only in sheets over the chat (the nine packs, the
 * coach, his social self, the converter, the documents, the house) each get a tab drawn here as the other screens are: the
 * page (ui/page.ts) with its tag and its line, a panel for each of the sheet's pages, and the section pills (ui/sections.ts)
 * to move between them. What is in each panel is the sheet's own page, made by the sheet's own function (its module is
 * imported when the screen is first opened, as the sheet's is): nothing is drawn twice, and the chat's doors still open the
 * same sheet.
 *
 * A page is built when it comes on screen (its pill picked, or every one at once on a wide screen) and put away when it goes
 * (another pill, another tab): what it holds stops then, as when its sheet is closed — the camera, the GPS, the microphone,
 * a timer of its own. So a screen with the camera never starts it unasked, and nothing runs behind a page he cannot see.
 * `#<screen>?<section>` opens it on that section (or on the section holding that sheet page: `#body?run`).
 */
import { clear, h } from '../core/dom';
import type { TabInstance } from '../shell/tabs';
import { panel, type Panel } from './components';
import { page } from './page';
import { sections, type Sections } from './sections';

/** What a sheet's own function makes: the page, and what puts it away. */
export interface SheetScreen {
  el: HTMLElement;
  stop?(): void;
}

/** One of a sheet's pages, as a panel of the screen. */
export interface SheetPart {
  /** The panel's title: the page's name as the sheet shows it ("COUNT MY REPS", "SHOPPING LIST"). */
  title: string;
  /** The sheet's own wrapper (`.pk` with its pack and page), as its sheet draws it; left out for a sheet with a root of its own. */
  pack?: string;
  screen?: string;
  /** The sheet's own function for this page. */
  build?(): SheetScreen | Promise<SheetScreen>;
  /** Or a panel another screen makes too (LINKS' account panels), with what fills it. */
  made?: { panel: Panel; paint?(): unknown };
}

/** A pill and the pages it shows. */
export interface SheetSection {
  id: string;
  /** One or two plain words. */
  label: string;
  parts: SheetPart[];
}

export interface SheetPageOptions {
  /** The tab's id: the pill picked is remembered under it. */
  screen: string;
  tag: string;
  sub: string;
  /** The pills and their pages: given at once, or once the sheet's own module is in (its names are its own). */
  sections: SheetSection[] | (() => Promise<SheetSection[]>);
  /** The large line at the top: its card's reading (shell/hubcards.ts), worked out when the screen comes on. */
  big?(): string;
  /** The few reads that reading needs, made when the screen comes on. */
  load?(): Promise<unknown>;
}

/** What the screens show, for specs (window.__ghosty.sheetpages): each one's built pages, by panel title. */
export const sheetPages: Record<string, { on: boolean; ready: boolean; built: string[]; section: string; pages: string[] }> = {};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Draw a sheet's pages into `root` (the tab's page) and return the tab's instance. */
export function sheetPage(root: HTMLElement, o: SheetPageOptions): TabInstance & { repaint(): void } {
  const P = page(root, { tag: o.tag, sub: o.sub, stack: true });
  root.classList.add('sheetpg');
  P.big.dataset.case = 'keep';
  const state: (typeof sheetPages)[string] = { on: false, ready: false, built: [], section: '', pages: [] };
  sheetPages[o.screen] = state;
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.sheetpages = sheetPages;

  type Slot = { part: SheetPart; pn: Panel; live: SheetScreen | null; want: number };
  const slots: Slot[] = [];
  let list: SheetSection[] = [];
  let pills: Sections | null = null;
  /** A section asked for (`#body?run`) before the pages were in. */
  let asked = '';
  let on = false;

  const record = () => {
    state.on = on;
    state.built = slots.filter((x) => x.live || (x.part.made && x.want)).map((x) => x.part.title);
    state.section = pills?.current() ?? '';
  };
  /** A page comes on screen: the sheet's own function draws it (a page asked for again while it is being made is made once). */
  const show = (x: Slot) => {
    if (x.part.made) {
      if (!x.want) {
        x.want = 1;
        void Promise.resolve(x.part.made.paint?.()).catch(() => undefined);
      }
      return;
    }
    if (x.live || x.want || !x.part.build) return;
    const ticket = (x.want = Date.now() + Math.random());
    void Promise.resolve()
      .then(() => x.part.build!())
      .then((made) => {
        // gone again while it was being made (another pill, another tab): put away at once
        if (x.want !== ticket || !on || x.pn.el.hidden) {
          made.stop?.();
          return;
        }
        x.live = made;
        clear(x.pn.body, x.part.pack ? h('div.pk', { dataset: { pack: x.part.pack, screen: x.part.screen ?? '' } }, made.el) : made.el);
        record();
      })
      .catch((e: Error) => {
        if (x.want === ticket) clear(x.pn.body, h('p.note', `This page did not open: ${e?.message ?? e}`));
      })
      .finally(() => {
        if (x.want === ticket && !x.live) x.want = 0;
      });
  };
  /** A page goes: what it holds stops, as when its sheet is closed, and it is made afresh when it comes back. */
  const hide = (x: Slot) => {
    x.want = 0;
    if (!x.live) return;
    try {
      x.live.stop?.();
    } catch {
      /* already stopped */
    }
    x.live = null;
    clear(x.pn.body);
  };
  const sync = () => {
    for (const x of slots) (on && !x.pn.el.hidden ? show : hide)(x);
    record();
  };
  const pick = (arg: string) => {
    const a = arg.toLowerCase();
    const s = list.find((x) => x.id === a) ?? list.find((x) => x.parts.some((p) => p.screen === a));
    if (s) pills?.select(s.id);
  };

  /** The panels and the pills, once the sheet's names are in. */
  const setup = (got: SheetSection[]) => {
    list = got;
    // the first half of the pills in the left column, the rest in the right (side by side on a wide screen, one after the
    // other on the phone, where the pills show one section at a time)
    const half = Math.ceil(list.length / 2);
    list.forEach((s, i) => {
      for (const part of s.parts) {
        const pn = part.made?.panel ?? panel(part.title, { grow: false, cls: 'sheetpn' });
        pn.el.dataset.part = part.screen ?? s.id;
        (i < half || list.length === 1 ? P.left : P.right).append(pn.el);
        slots.push({ part, pn, live: null, want: 0 });
      }
    });
    pills = sections(root, o.screen, list.map((s) => ({ id: s.id, label: s.label, match: new RegExp(`^(?:${s.parts.map((p) => esc(p.title)).join('|')})$`) })));
    state.pages = slots.map((x) => x.part.title);
    state.ready = true;
    if (asked) pick(asked);
    asked = '';
    // the pills hide and show the panels (their `hidden`): a page follows its panel
    new MutationObserver((recs) => {
      if (recs.some((r) => slots.some((x) => x.pn.el === r.target))) sync();
    }).observe(root, { attributes: true, attributeFilter: ['hidden'], subtree: true });
    sync();
  };
  if (Array.isArray(o.sections)) setup(o.sections);
  else
    void o.sections().then(setup, (e: Error) => {
      P.left.append(h('p.note', `This screen did not open: ${e?.message ?? e}`));
    });

  const paintBig = () => {
    const t = o.big?.() ?? '';
    if (P.big.textContent !== t) P.big.textContent = t;
  };
  return {
    /** The top's reading again (a practice kept, a draft answered). */
    repaint: paintBig,
    enter() {
      on = true;
      sync();
      paintBig();
      void o.load?.().then(paintBig).catch(() => undefined);
    },
    leave() {
      on = false;
      sync();
    },
    /** `#body?run`: the section by its id, or the one holding that sheet page. */
    open(arg) {
      if (!pills) asked = arg;
      else {
        pick(arg);
        sync();
      }
    },
    describe: () => `${o.tag}: ${o.sub} Showing ${slots.filter((x) => !x.pn.el.hidden).map((x) => x.part.title).join(', ') || 'nothing yet'}.`,
  };
}
