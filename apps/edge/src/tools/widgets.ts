/**
 * Instant widgets: small self-contained HTML apps Ghosty writes and installs in seconds,
 * without a rebuild. The interface runs them in a locked-down sandbox (no access to
 * Ghosty's data, keys or page). Use these for quick tools; use propose_change for
 * changes to Ghosty's own interface.
 */
import type { Widget } from '../../../../packages/shared/src/protocol';
import { arg, type Tool } from './types';

const PREFIX = 'widget:';

export async function loadWidgets(storage: DurableObjectStorage): Promise<Widget[]> {
  const map = await storage.list<Widget>({ prefix: PREFIX });
  return [...map.values()].sort((a, b) => b.at - a.at);
}

export async function deleteWidget(storage: DurableObjectStorage, name: string): Promise<boolean> {
  return storage.delete(PREFIX + slug(name));
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40);

export const widgetTools: Tool[] = [
  {
    name: 'create_widget',
    description:
      'Install (or replace) an instant widget: ONE complete HTML document with inline CSS and JS, no external scripts. Dark theme (#02070d background, #5ce1ff accents). It may fetch() public CORS-enabled APIs. Appears in the Widgets section of the Workshop tab immediately.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'short id like pomodoro_timer' }, title: { type: 'string' }, html: { type: 'string' } },
      required: ['name', 'title', 'html'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const name = slug(arg.str(a, 'name'));
      if (!name) throw new Error('name must contain letters or numbers');
      const html = arg.str(a, 'html');
      if (html.length > 100_000) throw new Error('widget is too large (100 KB max) — simplify it');
      if (!/<[a-z]/i.test(html)) throw new Error('html must be an HTML document');
      await ctx.storage.put(PREFIX + name, { name, title: arg.str(a, 'title'), html, at: Date.now() } satisfies Widget);
      ctx.emit({ t: 'client', name: 'notify', args: { text: `Widget installed: ${name}` } });
      return `Installed widget "${name}". The owner can open it from Workshop → Widgets.`;
    },
  },
  {
    name: 'list_widgets',
    description: 'List installed widgets.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const list = await loadWidgets(ctx.storage);
      return list.length ? list.map((w) => `${w.name}: ${w.title}`).join('\n') : 'No widgets installed.';
    },
  },
  {
    name: 'delete_widget',
    description: 'Remove an installed widget by name.',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    risk: 'auto',
    async run(a, ctx) {
      const name = arg.str(a, 'name');
      return (await deleteWidget(ctx.storage, name)) ? `Removed ${name}.` : `No widget called ${name}.`;
    },
  },
];
