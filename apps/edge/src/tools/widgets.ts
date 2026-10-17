/**
 * Instant widgets: small self-contained HTML apps Ghosty writes and installs in seconds,
 * without a rebuild. The interface runs them in a locked-down sandbox (no access to
 * Ghosty's data, keys or page). Use these for quick tools; use propose_change for
 * changes to Ghosty's own interface.
 */
import type { Widget } from '../../../../packages/shared/src/protocol';
import { checkHtml, refusal } from './check';
import { arg, type Tool } from './types';

const PREFIX = 'widget:';

export async function loadWidgets(storage: DurableObjectStorage): Promise<Widget[]> {
  const map = await storage.list<Widget>({ prefix: PREFIX });
  return [...map.values()].sort((a, b) => b.at - a.at);
}

/** Save a widget (the create_widget tool, and widgets the interface kept while the database was paused). */
export async function saveWidget(storage: DurableObjectStorage, w: { name: string; title: string; html: string; at?: number }): Promise<Widget> {
  const name = slug(String(w.name ?? ''));
  if (!name) throw new Error('name must contain letters or numbers');
  const html = String(w.html ?? '');
  if (html.length > 100_000) throw new Error('widget is too large (100 KB max) — simplify it');
  if (!/<[a-z]/i.test(html)) throw new Error('html must be an HTML document');
  const widget: Widget = { name, title: String(w.title ?? name).slice(0, 120) || name, html, at: Number(w.at) || Date.now() };
  await storage.put(PREFIX + name, widget);
  return widget;
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
      'Install (or replace) an instant widget: ONE complete HTML document with inline CSS and JS — games, tools, trackers, mini dashboards. Build on the widget kit GK (<script src="/widget-kit.js"></script>: canvas, game loop, keyboard + touch controls, collisions, sound, particles, scenes, saving, app UI) — study "game kit" or "app widgets" first. Dark theme (#02070d background, #5ce1ff accents). It may fetch() public CORS-enabled APIs. Appears in the Widgets section of the Workshop tab immediately.',
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
      // The quality gate (tools/check.ts): a widget whose tags or scripts are broken shows a blank box, so it is not installed.
      const check = checkHtml(html, { kind: 'widget' });
      const broken = check.findings.filter((f) => f.level === 'error' && (f.kind === 'structure' || f.kind === 'script'));
      if (broken.length) throw new Error(refusal('not installed', broken.map((f) => `line ${f.line}: ${f.text}`)));
      const worth = check.warnings.length ? ` Worth fixing (check_html): ${check.warnings.slice(0, 3).join(' | ')}.` : '';
      const title = arg.str(a, 'title');
      let saved = true;
      try {
        await saveWidget(ctx.storage, { name, title, html });
      } catch {
        saved = false; // database paused: the interface keeps it and saves it here when memory is back
      }
      // Open it on screen straight away — the owner asked for it to play/use it.
      ctx.emit({ t: 'client', name: 'open_widget', args: { name, title, html, saved } });
      return (saved
        ? `Installed widget "${name}" and opened it on screen. It stays in Workshop → Widgets.`
        : `Opened "${title}" on screen and kept it in Workshop → Widgets on this device; it is saved to my memory automatically when the database is back (midnight UTC).`) + worth;
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
