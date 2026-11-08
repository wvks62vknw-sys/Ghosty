/**
 * Command registry: the single place actions live. Buttons, hotkeys, the command palette
 * and Ghosty's brain (client tools) all run commands through here.
 *
 * Add a command:  register({ id: 'my_thing', title: 'Do my thing', run: () => … })
 */
import { h, clear, icon } from '../core/dom';
import { niceCase } from '../ui/components';
import { GROUP_NAMES, matchText, rankRows, score, type Command } from './rank';

/** Each group of results has a heading and a glyph (SF Symbols-like line icons). */
const GROUPS: Record<string, { icon: string }> = {
  ASK: { icon: '<path d="M4.5 5.5h15a1.5 1.5 0 011.5 1.5v8.5a1.5 1.5 0 01-1.5 1.5H10l-4.5 3.5V17H4.5A1.5 1.5 0 013 15.5V7a1.5 1.5 0 011.5-1.5z"/>' },
  FLY: { icon: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0113 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>' },
  GO: { icon: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>' },
  THEME: { icon: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17M12 3.5a8.5 8.5 0 010 17"/>' },
  SYSTEM: { icon: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>' },
  EYE: { icon: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>' },
  MEDIA: { icon: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>' },
  TOOLS: { icon: '<path d="M14.5 4.5l5 5L9 20H4v-5z"/>' },
};
const groupOf = (g?: string) => ({ name: GROUP_NAMES[g ?? ''] ?? (g ? g.charAt(0) + g.slice(1).toLowerCase() : 'More'), icon: (GROUPS[g ?? ''] ?? GROUPS.TOOLS!).icon });

/** How a result is dressed (shell/areas.ts): its colour and glyph, and the recent screens shown before anything is typed. */
interface Decor {
  look(c: Command): { tint: string; glyph: string | null };
  /** What is listed before anything is typed: his FAVOURITES (BRIEF-SHELL), then the screens opened last. */
  recents(): Command[];
  /** A long press on one of those rows (a pinned screen or a recent) opens its pin sheet (shell/favourites.ts). */
  hold?(c: Command, el: HTMLElement): void;
}
let decor: Decor | null = null;
export function addPaletteDecor(d: Decor): void {
  decor = d;
}
export type { Command };

const commands = new Map<string, Command>();

export function register(...cmds: Command[]): void {
  for (const c of cmds) commands.set(c.id, c);
}

export async function run(id: string, args: Record<string, unknown> = {}): Promise<boolean> {
  const c = commands.get(id);
  if (!c) return false;
  try {
    await c.run(args);
  } catch (e) {
    console.error('command', id, e);
  }
  return true;
}

export const allCommands = () => [...commands.values()];

// ---------- hotkeys ----------
const typing = () => /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? '') || (document.activeElement as HTMLElement | null)?.isContentEditable;

addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    togglePalette();
    return;
  }
  if (mod || e.altKey || typing() || paletteOpen()) return;
  if (e.key === '/') {
    e.preventDefault();
    togglePalette();
    return;
  }
  for (const c of commands.values()) {
    if (c.keys && c.keys === e.key) {
      e.preventDefault();
      void run(c.id);
      return;
    }
  }
});

// ---------- palette ----------
let pal: HTMLElement | null = null;
const paletteOpen = () => !!pal?.classList.contains('on');

/** Extra palette rows computed from the query (e.g. "Fly to …", "Ask Ghosty …"). */
const providers: ((q: string) => Command[])[] = [];
export function addPaletteProvider(fn: (q: string) => Command[]): void {
  providers.push(fn);
}

export function togglePalette(): void {
  if (!pal) {
    const input = h('input', { placeholder: 'Ask, or jump to a screen or place', 'aria-label': 'Command', autocomplete: 'off', spellcheck: false, type: 'search', enterKeyHint: 'go' });
    const list = h('div.ls');
    const clearBtn = h('button.pclear', { type: 'button', 'aria-label': 'Clear' }, '×');
    const cancel = h('button.pcancel', { type: 'button' }, 'Cancel');
    clearBtn.addEventListener('click', () => {
      input.value = '';
      render();
      input.focus();
    });
    cancel.addEventListener('click', () => close());
    pal = h('div#palette', h('div.bx', { role: 'dialog', 'aria-label': 'Command palette' }, h('div.prow', h('span.pglass', icon('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>')), input, clearBtn, cancel), list, h('div.hint', h('span', '↑↓ select'), h('span', '⏎ run'), h('span', 'esc close'))));
    document.body.append(pal);
    let items: Command[] = [];
    let sel = 0;
    const render = () => {
      const q = input.value.trim();
      // Nothing typed yet: his FAVOURITES and the screens opened last come first (commands/rank.ts holds the order: the finding test reads it)
      const rec = !q && decor ? decor.recents() : [];
      items = rankRows(allCommands(), q, { extra: q.length > 1 ? providers.flatMap((p) => p(q)) : [], rec });
      sel = Math.min(sel, Math.max(0, items.length - 1));
      clear(list);
      let last: string | null = null;
      clearBtn.hidden = !input.value;
      items.forEach((c, i) => {
        if ((c.group ?? '') !== last) {
          last = c.group ?? '';
          list.append(h('div.grp', groupOf(c.group).name));
        }
        const look = decor?.look(c);
        const it = h(`div.it${i === sel ? '.sel' : ''}` as 'div', h('i.gic', { style: look ? `--tint:${look.tint}` : '' }, icon(look?.glyph ?? groupOf(c.group).icon)), h('small', c.group ?? ''), h('span', c.group === 'GO' && c.title === c.title.toUpperCase() ? niceCase(c.title) : c.title.replace(/^Theme: /, '')), c.keys ? h('em', c.keys) : null);
        it.addEventListener('click', () => pick(i));
        if (c.group === 'FAVOURITES' || c.group === 'RECENT') decor?.hold?.(c, it);
        list.append(it);
      });
    };
    const pick = (i: number) => {
      const c = items[i];
      close();
      if (c) void c.run();
    };
    const close = () => pal?.classList.remove('on');
    input.addEventListener('input', () => {
      sel = 0;
      render();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        sel = Math.min(items.length - 1, sel + 1);
        render();
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        sel = Math.max(0, sel - 1);
        render();
        e.preventDefault();
      } else if (e.key === 'Enter') pick(sel);
      else if (e.key === 'Escape') close();
    });
    pal.addEventListener('click', (e) => {
      if (e.target === pal) close();
    });
    (pal as HTMLElement & { render?: () => void }).render = render;
  }
  if (paletteOpen()) {
    pal.classList.remove('on');
    return;
  }
  pal.classList.add('on');
  const input = pal.querySelector('input')!;
  input.value = '';
  (pal as HTMLElement & { render?: () => void }).render?.();
  setTimeout(() => input.focus(), 20);
}
