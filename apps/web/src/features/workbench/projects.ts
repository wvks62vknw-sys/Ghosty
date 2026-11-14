/**
 * NAMED WORKBENCH PROJECTS (NEXT ROUND, make.u5): a set of Workbench answers saved under his own name ("the shed beam") and
 * opened again later with every number as he left it: each panel's kind and every value he typed. Kept on this phone only
 * (`ghosty.workbench.projects`, newest first, twenty at most). Opening one puts its numbers back in every panel it holds; the
 * estimates are worked out again by the same formulae, so each is still a first estimate, never certified.
 */
import { clear, h } from '../../core/dom';
import { button, panel, toast } from '../../ui/components';

export interface PanelSnap {
  mode: string;
  v: Record<string, unknown>;
}
export interface Project {
  id: string;
  name: string;
  at: number;
  /** The panel he was on when it was saved. */
  last?: string;
  panels: Record<string, PanelSnap>;
  /** What it said, for the list: "Beam: 3 m, simply supported · 0.201 mm". */
  gist: string;
}

export const PROJECTS_KEY = 'ghosty.workbench.projects';
export const MAX_PROJECTS = 20;

export const PROJECT_WORDS = {
  none: 'No projects yet. Type a name like “the shed beam” and tap SAVE: every panel’s numbers are kept just as they are.',
  noName: 'Give it a name first, like “the shed beam”.',
  saved: (name: string) => `Saved “${name}”. Open it any time to get every number back.`,
  opened: (name: string) => `Opened “${name}”: every number as you left it. Each answer is worked out again, still a first estimate.`,
  replaced: (name: string) => `Saved over “${name}” with the numbers as they are now.`,
  gone: (name: string) => `Deleted “${name}”.`,
};

/** The list as kept on the phone (anything that is not a project is left out). */
export function readProjects(raw: string | null): Project[] {
  try {
    const v = JSON.parse(raw ?? '[]') as unknown;
    if (!Array.isArray(v)) return [];
    return v
      .filter((p): p is Project => !!p && typeof p === 'object' && typeof (p as Project).id === 'string' && typeof (p as Project).name === 'string' && (p as Project).name.trim() !== '' && !!(p as Project).panels && typeof (p as Project).panels === 'object')
      .map((p) => ({ ...p, gist: typeof p.gist === 'string' ? p.gist : '', at: Number.isFinite(p.at) ? p.at : 0 }))
      .slice(0, MAX_PROJECTS);
  } catch {
    return [];
  }
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The list with this project saved first (a project of the same name is saved over, not doubled). */
export function saveProject(list: Project[], name: string, panels: Record<string, PanelSnap>, gist: string, last: string | undefined, now: number): { list: Project[]; project: Project; replaced: boolean } {
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 60);
  const old = list.find((p) => same(p.name, clean));
  const project: Project = { id: old?.id ?? `p${now.toString(36)}`, name: clean, at: now, panels: JSON.parse(JSON.stringify(panels)) as Record<string, PanelSnap>, gist, ...(last ? { last } : {}) };
  return { list: [project, ...list.filter((p) => p.id !== project.id)].slice(0, MAX_PROJECTS), project, replaced: !!old };
}

export const dropProject = (list: Project[], id: string): Project[] => list.filter((p) => p.id !== id);

/** "today", "yesterday", "3 Nov". */
export function whenWords(at: number, now: number): string {
  const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { timeZone: 'Europe/London' });
  if (day(at) === day(now)) return 'today';
  if (day(at) === day(now - 86_400_000)) return 'yesterday';
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Europe/London' });
}

function load(): Project[] {
  try {
    return readProjects(localStorage.getItem(PROJECTS_KEY));
  } catch {
    return [];
  }
}
function store(list: Project[]): boolean {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

/** The PROJECTS panel: a name and SAVE, then each project with OPEN and DELETE. */
export function projectsPanel(io: { snapshot(): { panels: Record<string, PanelSnap>; gist: string; last?: string }; restore(p: Project): void }): { el: HTMLElement; list(): Project[] } {
  const pn = panel('PROJECTS', { cls: 'wb.wb-projects', grow: false });
  let list = load();
  const name = h('input', { type: 'text', placeholder: 'Name it: “the shed beam”', 'aria-label': 'A name for this project', autocomplete: 'off', enterKeyHint: 'done' });
  const said = h('p.note.wbprojsaid', { 'aria-live': 'polite' });
  const rows = h('div.wbprojlist');
  const save = () => {
    const n = name.value.trim();
    if (!n) {
      said.textContent = PROJECT_WORDS.noName;
      return name.focus();
    }
    const snap = io.snapshot();
    const got = saveProject(list, n, snap.panels, snap.gist, snap.last, Date.now());
    if (!store(got.list)) return void toast('This phone would not keep it (its storage is full or private).', 'warn');
    list = got.list;
    said.textContent = got.replaced ? PROJECT_WORDS.replaced(got.project.name) : PROJECT_WORDS.saved(got.project.name);
    name.value = '';
    paint();
  };
  name.addEventListener('keydown', (e) => e.key === 'Enter' && save());
  function paint(): void {
    const now = Date.now();
    if (!list.length) {
      /* state: workbench.projects empty */
      return void clear(rows, h('p.note.wbprojnone', { dataset: { state: 'empty' } }, PROJECT_WORDS.none));
    }
    clear(rows, ...list.map((p) => h('div.wbproj', { dataset: { project: p.id } },
      h('div.wbprojtext', h('b', p.name), h('small', `${p.gist ? `${p.gist} · ` : ''}saved ${whenWords(p.at, now)}`)),
      h('div.row.wrap', button('OPEN', () => {
        io.restore(p);
        said.textContent = PROJECT_WORDS.opened(p.name);
      }, 'on'), button('DELETE', () => {
        list = dropProject(list, p.id);
        store(list);
        said.textContent = PROJECT_WORDS.gone(p.name);
        paint();
      })),
    )));
  }
  pn.body.append(h('div.keyrow', name, button('SAVE', save, 'on')), said, rows);
  paint();
  return { el: pn.el, list: () => list };
}
