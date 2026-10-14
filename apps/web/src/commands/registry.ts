/**
 * Command registry: the single place actions live. Buttons, hotkeys, the command palette
 * and Ghosty's brain (client tools) all run commands through here.
 *
 * Add a command:  register({ id: 'my_thing', title: 'Do my thing', run: () => … })
 */
import { h, clear } from '../core/dom';

export interface Command {
  id: string;
  title: string;
  group?: string;
  /** Single-key hotkey (ignored while typing) or 'mod+k' style. */
  keys?: string;
  /** Hidden commands still run, but are not listed in the palette. */
  hidden?: boolean;
  run: (args?: Record<string, unknown>) => void | Promise<void>;
}

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

function fuzzy(q: string, s: string): number {
  q = q.toLowerCase();
  s = s.toLowerCase();
  if (!q) return 1;
  if (s.includes(q)) return 2 + (s.startsWith(q) ? 1 : 0);
  let i = 0;
  for (const ch of s) if (ch === q[i]) i++;
  return i === q.length ? 0.5 : 0;
}

/** Extra palette rows computed from the query (e.g. "Fly to …", "Ask Ghosty …"). */
const providers: ((q: string) => Command[])[] = [];
export function addPaletteProvider(fn: (q: string) => Command[]): void {
  providers.push(fn);
}

export function togglePalette(): void {
  if (!pal) {
    const input = h('input', { placeholder: 'Command, place or question…', 'aria-label': 'Command', autocomplete: 'off', spellcheck: false });
    const list = h('div.ls');
    pal = h('div#palette', h('div.bx', { role: 'dialog', 'aria-label': 'Command palette' }, input, list, h('div.hint', h('span', '↑↓ select'), h('span', '⏎ run'), h('span', 'esc close'))));
    document.body.append(pal);
    let items: Command[] = [];
    let sel = 0;
    const render = () => {
      const q = input.value.trim();
      items = allCommands()
        .filter((c) => !c.hidden)
        .map((c) => ({ c, s: fuzzy(q, `${c.title} ${c.group ?? ''}`) }))
        .filter((o) => o.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((o) => o.c)
        .slice(0, 8);
      if (q.length > 1) for (const p of providers) items = [...p(q), ...items];
      items = items.slice(0, 10);
      sel = Math.min(sel, Math.max(0, items.length - 1));
      clear(list);
      items.forEach((c, i) => {
        const it = h(`div.it${i === sel ? '.sel' : ''}` as 'div', h('small', c.group ?? ''), h('span', c.title), c.keys ? h('em', c.keys) : null);
        it.addEventListener('click', () => pick(i));
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
