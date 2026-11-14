/**
 * SETTINGS AS A PLATE BROUGHT TO THE FRONT (BRIEF-SHELL-2; settings.png): in The Scan the grouped list of Settings is drawn as one
 * plate: rows numbered 01, 02, 03 and grouped under THE LOOK, YOU, THE BRAIN, GHOSTY and ABOUT, each with its name, its one line and
 * its value at the right, a chevron, ‹ ME to go back (shell/layout.ts). Nothing is taken out: every panel of today's list (ui/listmode.ts)
 * keeps its row here, and a tap on a row is the tap on that panel's own row (it pushes in, or goes to its screen: System, Links). A
 * panel no group names (one added since) goes in a last group, so none is ever left out. Glass keeps today's list (the CSS shows one).
 */
import { h, icon } from '../core/dom';
import { index } from '../ui/machine';
import { niceCase } from '../ui/components';

interface Group {
  title: string;
  match: RegExp;
}
export const SETTINGS_GROUPS: Group[] = [
  { title: 'The look', match: /^(THEME|THE LOOK|READING)/ },
  { title: 'You', match: /^(NAME|PERMISSIONS|CHARACTER|GUARDIAN|VOICE|MY VOICE|PEOPLE I)/ },
  { title: 'The brain', match: /^OFFLINE/ },
  // [editors] WORKSPACE beside them, as the Sections pill has it (features/settings/index.ts: Ghosty)
  { title: 'Ghosty', match: /^(SECURITY|SYSTEM|LINKS|SHORTCUTS|THE WALL|WORKSPACE)/ },
  { title: 'About', match: /^(ABOUT|PRIVACY|HELP)/ },
];
/** Each panel's name as he says it, and the one line under it (what it is for, in my voice). */
const SAID: [RegExp, string, string][] = [
  [/^THEME/, 'Theme', 'The HUD, the colour and the switches'],
  [/^THE LOOK/, 'The look', 'How I draw everything'],
  [/^READING/, 'Reading', 'How a book is shown and who reads it'],
  [/^NAME/, 'Name & units', 'What I call you, how I measure'],
  [/^PERMISSIONS/, 'Permissions', 'What the phone lets me use, and what I never do with it'],
  [/^CHARACTER/, 'Character', 'How I talk to you: drier, briefer, warmer'],
  [/^GUARDIAN/, 'Guardian', 'Who I tell if you do not answer'],
  [/^VOICE/, 'Voice & home', 'My voice, my manner, your saved place'],
  [/^MY VOICE/, 'My voice', 'The voice I know as yours'],
  [/^PEOPLE I/, 'People I’ve introduced', 'Faces you told me by name'],
  [/^OFFLINE MAPS/, 'Offline maps', 'The map of your area, with no signal'],
  [/^OFFLINE EYES/, 'Offline eyes', 'What the Lens reads with, with no signal'],
  [/^OFFLINE/, 'Offline brain', 'Answers on this phone with no signal'],
  [/^WORKSPACE/, 'Workspace', 'Pages and databases kept on this phone'],
  [/^SECURITY/, 'Security', 'Every lock, every approval'],
  [/^SYSTEM/, 'System', 'Keys, models, storage and backups'],
  [/^LINKS/, 'Links', 'Email, Spotify and your phone'],
  [/^SHORTCUTS/, 'Shortcuts', 'Siri'],
  [/^THE WALL/, 'The wall', 'A second screen that shows what we talk about'],
  [/^WORKSPACE/, 'Workspace', 'Your pages and databases, and where they are kept'],
  [/^ABOUT/, 'About', 'Which build this is'],
  [/^PRIVACY/, 'Privacy', 'What stays on this phone'],
  [/^HELP/, 'Help', 'Tips'],
];
const CHEV = '<path d="M9.5 6l6 6-6 6"/>';

/** Build (once) and keep drawn the plate of a list page: `root` is the page (#pg-settings), already a list (ui/listmode.ts). */
export function scanList(root: HTMLElement, groups: Group[] = SETTINGS_GROUPS): void {
  if (root.dataset.scanned) return;
  root.dataset.scanned = '1';
  const hud = root.querySelector<HTMLElement>('.hud');
  if (!hud) return;
  const plate = h('div.scanset', { role: 'list', 'aria-label': 'Settings', dataset: { case: 'keep' } });
  hud.prepend(plate);
  root.classList.add('scanned');
  const panels = () => [...root.querySelectorAll<HTMLElement>('.pn[data-row]')];
  const titleOf = (pn: HTMLElement) => pn.querySelector('.ptitle')?.textContent ?? '';
  let last = '';
  const draw = () => {
    const list = panels();
    // the signature of what is shown: a repaint only when a name or a value changed
    const sig = list.map((p) => `${titleOf(p)}=${p.querySelector('h3 small')?.textContent ?? ''}`).join('|');
    if (sig === last) return;
    last = sig;
    let n = 0;
    const taken = new Set<HTMLElement>();
    const groupsOf = [...groups.map((g) => ({ title: g.title, rows: list.filter((p) => g.match.test(titleOf(p))) })), { title: 'More', rows: [] as HTMLElement[] }];
    for (const p of list) if (!groups.some((g) => g.match.test(titleOf(p)))) groupsOf[groupsOf.length - 1]!.rows.push(p);
    const out = groupsOf.filter((g) => g.rows.length).map((g) => h('section.setgroup', { role: 'group', 'aria-label': g.title, dataset: { group: g.title.toLowerCase() } },
      h('div.sethead', h('span.settitle', g.title), h('span.setcount', String(g.rows.length))),
      ...g.rows.map((pn) => {
        taken.add(pn);
        n += 1;
        const t = titleOf(pn);
        const said = SAID.find(([re]) => re.test(t));
        const name = said?.[1] ?? niceCase(t);
        const raw = pn.querySelector('h3 small')?.textContent?.trim() ?? '';
        // (the value is what the row already says: its status, said as a sentence)
        const value = raw && raw.toLowerCase() !== (said?.[2] ?? '').toLowerCase() ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}` : '';
        const line = said?.[2] ?? (raw && !value ? raw : '');
        const row = h('button.srow', { type: 'button', role: 'listitem', dataset: { title: t, n: String(n).padStart(2, '0'), case: 'keep' }, 'aria-label': `${String(n).padStart(2, '0')} ${name}${value ? `, ${value}` : ''}` },
          index(n), h('span.srwords', h('b.srname', name), line ? h('span.srline', line) : null), value ? h('span.srvalue', value) : null, icon(CHEV, 'ic srchev'));
        row.addEventListener('click', () => {
          // the panel's own row: shown first (its section), then tapped (it pushes in, or goes to its screen)
          pn.dispatchEvent(new CustomEvent('ghosty:reveal', { bubbles: true }));
          pn.querySelector<HTMLElement>(':scope > h3')?.click();
        });
        return row;
      })));
    plate.replaceChildren(...out);
  };
  draw();
  let raf = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-label', 'hidden'] });
}
