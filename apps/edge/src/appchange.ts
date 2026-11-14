/**
 * CHANGE A MINI-APP AFTER IT IS MADE (NEXT ROUND sites.u6). "Add a habit to my habits app", "change my water goal to 10", "rename it":
 * build_app with change true and the app's link name. Only what he named changes; the app keeps its link and its kind, so what is saved
 * on his phone (kept under the app's own name and kind) stays. The change is said before his APPROVE, built on the kit, checked by
 * the kit's gates, and published at the same link; the version before is kept, so UNDO LAST UPDATE puts it back (tools/sites.ts).
 */
import { APP_SHAPES, describe, renderApp, runAppGates, type AppConfig } from '../../../packages/shared/src/appkit/index';
import { siteLink, siteSlug, siteStore, type Site } from './tools/sites';
import type { ToolContext } from './tools/types';

const words = (v: unknown, max = 40): string[] =>
  (Array.isArray(v) ? v : typeof v === 'string' && v.trim() ? [v] : [])
    .map((x) => (typeof x === 'string' ? x.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : ''))
    .filter(Boolean);
const same = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();
const list = (xs: string[]) => (xs.length ? xs.map((x) => `“${x}”`).join(', ') : 'none');
const MAX_ITEMS = 24;

/** The app's config with his change in it, and the change in words; an error when nothing he said applies to this app. */
export function changedConfig(old: AppConfig, a: Record<string, unknown>): { cfg: AppConfig; said: string[] } {
  const cfg: AppConfig = structuredClone(old);
  const said: string[] = [];
  if (typeof a.shape === 'string' && (APP_SHAPES as string[]).includes(a.shape) && a.shape !== old.shape) throw new Error(`a ${old.shape} app cannot become a ${a.shape}: make a new app for that (build_app without change)`);
  const title = words(a.title, 40)[0];
  if (title && title !== old.title) {
    cfg.title = title;
    cfg.short = title.slice(0, 12);
    said.push(`renamed from “${old.title}” to “${title}”`);
  }
  const tag = words(a.tagline, 90)[0];
  if (tag && tag !== old.tagline) {
    cfg.tagline = tag;
    said.push(`its line under the title: “${tag}”`);
  }
  // the named things a list, a habit grid or a scoreboard holds
  const add = words(a.add_items);
  const drop = words(a.remove_items);
  const items = words(a.items);
  const named = (cur: string[], what: string): string[] => {
    let next = items.length ? items.slice(0, MAX_ITEMS) : cur.slice();
    // a name said in lower case reads like the others ("stretch" → "Stretch")
    const added = add.filter((x) => !next.some((y) => same(x, y))).map((x) => (x === x.toLowerCase() ? x.charAt(0).toUpperCase() + x.slice(1) : x));
    next = [...next, ...added];
    const gone = next.filter((x) => drop.some((y) => same(x, y)));
    next = next.filter((x) => !drop.some((y) => same(x, y)));
    if (next.length > MAX_ITEMS) throw new Error(`that would be ${next.length} ${what}; the app holds ${MAX_ITEMS}`);
    if (items.length || added.length || gone.length) said.push(`${what}: ${list(cur)} → ${list(next)}`);
    return next;
  };
  if (add.length || drop.length || items.length) {
    if (cfg.habits) cfg.habits.names = named(cfg.habits.names, 'habits');
    else if (cfg.list) cfg.list.items = named(cfg.list.items, 'items');
    else if (cfg.counter) cfg.counter.names = named(cfg.counter.names, 'players');
    else throw new Error(`a ${old.shape} app has no list of names to add to or take from`);
  }
  if (a.goal !== undefined) {
    const g = Number(a.goal);
    if (!cfg.tracker) throw new Error(`a ${old.shape} app has no goal`);
    if (!Number.isFinite(g) || g <= 0 || g > 1e7) throw new Error('the goal must be a number above nothing');
    if (g !== cfg.tracker.goal) {
      said.push(`goal: ${cfg.tracker.goal} → ${g} ${cfg.tracker.unit}`.trim());
      cfg.tracker.goal = g;
    }
  }
  if (Array.isArray(a.amounts) && cfg.tracker) {
    const am = (a.amounts as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 6);
    if (am.length) {
      said.push(`quick-add buttons: ${am.join(', ')}`);
      cfg.tracker.amounts = am;
    }
  }
  if (Array.isArray(a.steps)) {
    if (!cfg.timer) throw new Error(`a ${old.shape} app has no timer steps`);
    const steps = (a.steps as { name?: unknown; secs?: unknown }[]).map((s) => ({ name: words(s?.name, 30)[0] ?? '', secs: Math.round(Number(s?.secs)) })).filter((s) => s.name && s.secs > 0 && s.secs <= 6 * 3600).slice(0, 20);
    if (!steps.length) throw new Error('give the steps with a name and a length in seconds');
    said.push(`steps: ${steps.map((s) => `${s.name} ${s.secs} s`).join(', ')}`);
    cfg.timer.steps = steps;
  }
  if (a.rounds !== undefined && cfg.timer) {
    const r = Math.round(Number(a.rounds));
    if (r >= 1 && r <= 50 && r !== cfg.timer.rounds) {
      said.push(`rounds: ${cfg.timer.rounds} → ${r}`);
      cfg.timer.rounds = r;
    }
  }
  if (Array.isArray(a.cards)) {
    if (!cfg.cards) throw new Error(`a ${old.shape} app has no cards`);
    const more = (a.cards as { q?: unknown; a?: unknown }[]).map((c) => ({ q: words(c?.q, 200)[0] ?? '', a: words(c?.a, 200)[0] ?? '' })).filter((c) => c.q && c.a);
    const fresh = more.filter((c) => !cfg.cards!.cards.some((x) => same(x.q, c.q)));
    if (cfg.cards.cards.length + fresh.length > 200) throw new Error('the cards app holds 200 cards');
    if (fresh.length) {
      cfg.cards.cards = [...cfg.cards.cards, ...fresh];
      said.push(`${fresh.length} more card${fresh.length === 1 ? '' : 's'}`);
    }
  }
  if (!said.length) throw new Error('nothing to change: say what to add, remove or change (add_items, remove_items, goal, steps, rounds, cards, title)');
  const d = describe(cfg);
  cfg.does = d.does;
  cfg.saves = d.saves;
  return { cfg, said };
}

type Ctx = Pick<ToolContext, 'env' | 'storage' | 'origin'>;
async function appAt(ctx: Ctx, a: Record<string, unknown>): Promise<{ name: string; site: Site & { app: NonNullable<Site['app']> } }> {
  const name = siteSlug(typeof a.link_name === 'string' ? a.link_name : '');
  if (!name) throw new Error('say which app: its link name (list_sites shows them)');
  const site = await siteStore(ctx.env, ctx.storage).get(name);
  if (!site?.app) throw new Error(`no mini-app is published at /s/${name}/ (list_sites shows his apps)`);
  return { name, site: site as Site & { app: NonNullable<Site['app']> } };
}

/** appApproval's shape for a change: what changes, where, and that what is saved stays. */
export async function changeApproval(a: Record<string, unknown>, ctx: Ctx): Promise<{ args: Record<string, unknown>; reason: string }> {
  const { name, site } = await appAt(ctx, a);
  const { said } = changedConfig(site.app.config, a);
  return {
    args: { ...a, link_name: name, change: true },
    reason: `Change the mini-app "${site.app.config.title}" at ${siteLink(ctx.origin, ctx.env, name)}/: ${said.join('; ')}? Same link; what is saved on your phone stays. The version before is kept, so UNDO LAST UPDATE puts it back.`,
  };
}

/** The change, built on the kit, checked by its gates and published at the same link. */
export async function changeApp(a: Record<string, unknown>, ctx: Ctx & Partial<Pick<ToolContext, 'emit'>>): Promise<string> {
  const { name, site } = await appAt(ctx, a);
  const { cfg, said } = changedConfig({ ...site.app.config, id: name }, a);
  const html = renderApp(cfg);
  const gates = runAppGates(cfg, html);
  if (gates.errors.length) throw new Error(`not changed: the kit's checks found ${gates.errors.slice(0, 2).join(' | ')}`);
  await siteStore(ctx.env, ctx.storage).put({ ...site, title: cfg.title, html, at: Date.now(), app: { config: cfg, icon: site.app.icon } });
  const link = `${siteLink(ctx.origin, ctx.env, name)}/`;
  ctx.emit?.({ t: 'client', name: 'show_link', args: { url: link, title: cfg.title } });
  return `Changed "${cfg.title}" at ${link}: ${said.join('; ')}. Same link; what is saved on his phone stays (it opens with the change next time, online). UNDO LAST UPDATE puts the version before back. Give him this exact link.`;
}
