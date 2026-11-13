/**
 * THE WORKSPACE (BRIEF-EDITOR-WORKSPACE; MAKE): the core of Notion on the phone. Its page is the sheet's (workspace/sheet.ts): his pages as a tree,
 * pages inside pages, databases with a table, a board, a calendar, a timeline and a gallery over the same rows, formulas the spreadsheet's engine works,
 * backlinks, comments, version history, search, and a project the brain can read whole. "my workspace" and the Stage's ADD TO A PROJECT open it from
 * the chat.
 */
import type { TabDef } from '../../shell/tabs';
import { cardBig, cardLoad, cardNow } from '../../shell/cardline';
import { sheetPage } from '../../ui/sheetpage';

export const workspaceTab: TabDef = {
  id: 'workspace',
  title: 'THE WORKSPACE',
  icon: '<rect x="4" y="4.5" width="16" height="15" rx="1.8"/><path d="M4 9.5h16M9.5 9.5v10M13 13h4M13 16h3"/>',
  scene: 'backdrop',
  blurb: 'pages in pages · boards, calendars, timelines · projects the brain reads whole · kept on this phone',
  now: () => cardNow('workspace'),
  mount: (root) => {
    const page = sheetPage(root, {
      screen: 'workspace',
      tag: 'MAKE // THE WORKSPACE',
      sub: 'Pages, lists and projects in one place, with a brain that has read all of it.',
      big: () => cardBig('workspace'),
      load: () => cardLoad('workspace'),
      sections: async () => {
        const m = await import('../../workspace/sheet');
        return [{
          id: 'workspace',
          label: 'The workspace',
          parts: [{
            title: m.WORKSPACE_TITLE,
            build: () => {
              // (the line over the page says how many pages are kept: it is read again when that changes)
              const d = m.workspaceParts({ onChange: () => page.repaint() });
              void d.start({});
              return { el: d.el, stop: d.stop };
            },
          }],
        }];
      },
    });
    return page;
  },
};
