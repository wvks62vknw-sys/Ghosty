/**
 * [editors.c4] TO-DO · FROM MY WORKSPACE (built into the PLAN lane's agenda by the EDITORS lane, small and additive): the due dates in his
 * Workspace databases, under his own to-do list, read-only. Late ones first; a tap opens the row's page in the Workspace, where it is changed.
 * Read from the workspace kept on this phone (workspace/deadlines.ts), so it needs no signal; it repaints when the agenda is opened.
 */
import { clear } from '../../core/dom';
import { panel, row } from '../../ui/components';

export const WORKDUE_EMPTY = 'Nothing due in your workspace in the next 14 days. A date called Due in a workspace database shows here.';

export function workDuePanel(): { el: HTMLElement; paint(): void } {
  const p = panel('TO-DO · FROM MY WORKSPACE', { grow: false, cls: 'workdue' });
  const paint = (): void => {
    void Promise.all([import('../../workspace/store'), import('../../workspace/deadlines'), import('../../workspace/db')]).then(([st, dl, db]) => {
      const today = db.isoOf(new Date());
      const list = dl.deadlines(st.loadWorkspace(), today);
      const late = list.filter((d) => d.late).length;
      p.setStatus(list.length ? (late ? `${late} LATE` : `${list.length} DUE`) : 'CLEAR', late ? 'mid' : 'ok');
      /* state: agenda.todo empty */
      if (!list.length) return void clear(p.body, row(null, WORKDUE_EMPTY, null, { wrap: true, onClick: () => void import('../../workspace/sheet').then((m) => m.openWorkspace({})) }));
      clear(p.body, ...list.slice(0, 12).map((d) => {
        const r = row(dl.whenWords(d.date, today).toUpperCase(), d.title, d.where, { wrap: true, sev: d.late ? 2 : undefined, onClick: () => void import('../../workspace/sheet').then((m) => m.openWorkspace({ id: d.id })) });
        r.dataset.id = d.id;
        r.dataset.late = d.late ? '1' : '';
        r.setAttribute('aria-label', `${d.title}, ${dl.whenWords(d.date, today)}, in ${d.where}. Open it in the workspace`);
        return r;
      }), ...(list.length > 12 ? [row(null, `${list.length - 12} more in your workspace`, '›', { onClick: () => void import('../../workspace/sheet').then((m) => m.openWorkspace({ what: 'due' })) })] : []));
    }).catch(() => {
      /* state: agenda.todo error */
      clear(p.body, row(null, 'I could not read your workspace on this phone just now. It tries again when you next open the agenda.', null, { wrap: true }));
    });
  };
  return { el: p.el, paint };
}
