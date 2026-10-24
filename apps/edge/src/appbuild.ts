/**
 * Mini-apps, made on Ghosty's own from one request ("make me an app that tracks my water intake", "a tip
 * calculator for the group"): build_app (registered in tools/sites.ts) reads the request into an app
 * (packages/shared/src/appkit), asks the owner once — the approval says what the app does, what it saves,
 * what it cannot do and up to two questions with the answers it will use — and then runs five quick,
 * resumable steps inside the call:
 *   1. Brief and plan — the request read into a kind of app, its words and options (the model's choices
 *      arrive as the tool's arguments: words and options only; every line of logic is the kit's)
 *   2. Build on the kit — the page drawn from the config, and its Home Screen icon (a PNG of its glyph)
 *   3. Check — check_html and the kit's gates (contrast, words, honesty, options, the pinned script, size):
 *      any error stops here, nothing is published
 *   4. Publish — kept like a site at /s/<name>; the Worker serves it as a direct page with its own strict
 *      security policy, its manifest, icon and service worker (sites.ts appResponse / appAsset)
 *   5. Report — the link, WHAT IT DOES, what it saves, how to put it on the Home Screen, its honest limits
 * Each step is saved as it finishes (appjob:<name>), so a call cut short carries on where it stopped when
 * build_app is called again with the same request. UNDO is unpublish_site.
 */
import { appBase, encodePng, iconPixels, planApp, renderApp, runAppGates, type AppConfig } from '../../../packages/shared/src/appkit/index';
import { durableGet, durablePut } from './kv';
import { checkHtml } from './tools/check';
import { siteLink, siteSlug, siteStore } from './tools/sites';
import { arg, type ToolContext } from './tools/types';

export const APP_STEPS = ['Brief and plan', 'Build on the kit', 'Check', 'Publish', 'Report'];

/** What a build carries between its steps (kept in the database AND KV, like the page). */
export interface AppJob {
  name: string;
  request: string;
  /** The arguments it was asked with (a different call starts again). */
  args: string;
  /** The next step to run (0–4); done when the report was given. */
  step: number;
  cfg?: AppConfig;
  limits?: string[];
  /** The Home Screen icon, a 512 px PNG as base64. */
  icon?: string;
  gates?: { score: number; warnings: string[] };
  link?: string;
  done?: boolean;
  at: number;
}
const JOB = (name: string) => `appjob:${name}`;
type Ctx = Pick<ToolContext, 'env' | 'storage' | 'origin'> & Partial<Pick<ToolContext, 'emit' | 'progress'>>;
export const loadAppJob = (ctx: Ctx, name: string) => durableGet<AppJob>(ctx.env, ctx.storage, JOB(name));
const saveJob = (ctx: Ctx, j: AppJob) => durablePut(ctx.env, ctx.storage, JOB(j.name), j);

/** A short, stable tag from words (a name a link cannot spell still gets its own link). */
const tagOf = (s: string) => ([...s].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)!) | 0, 7) >>> 0).toString(36).slice(-4);

/**
 * The link name: the one asked for, else from the app's title. Another page already there moves this one
 * to the next free number; the same app (or a link the owner named) is replaced, and the approval says so.
 */
export async function appNameFor(a: Record<string, unknown>, title: string, ctx: Ctx): Promise<{ name: string; replaces?: string }> {
  const asked = arg.str(a, 'link_name', false);
  const from = (asked || title).normalize('NFKD').replace(/[̀-ͯ]/g, '');
  let base = siteSlug(from);
  const latin = (from.match(/[a-z0-9]/gi) ?? []).length;
  const all = (from.match(/[\p{L}\p{N}\p{Extended_Pictographic}]/gu) ?? []).length;
  if (!base || latin * 2 < all) base = `${(base || 'app').slice(0, 40)}-${tagOf(asked || title || arg.str(a, 'request', false))}`;
  const store = siteStore(ctx.env, ctx.storage);
  const had = await store.get(base).catch(() => undefined);
  if (!had) return { name: base };
  if (asked || (had.app && had.title === title)) return { name: base, replaces: had.title };
  for (let i = 2; i < 10; i++) {
    const n = `${base.slice(0, 45)}-${i}`;
    const there = await store.get(n).catch(() => undefined);
    if (!there || (there.app && there.title === title)) return there ? { name: n, replaces: there.title } : { name: n };
  }
  return { name: base, replaces: had.title };
}

/** The plan for a call, or the honest reason it cannot be made (said to the model, which tells the owner). */
function planned(a: Record<string, unknown>, name: string) {
  const request = arg.str(a, 'request');
  const plan = planApp(request, a, name);
  if (plan.brief.refuse) throw new Error(`not built — ${plan.brief.refuse} Tell the owner this plainly and offer the nearest app that works offline.`);
  const block = plan.questions.filter((q) => q.fallback === undefined);
  if (block.length) throw new Error(`not built yet — ask the owner first, in plain words, then call build_app again with the answer: ${block.map((q) => q.text).join(' ')}`);
  return plan;
}

const link = (ctx: Ctx, name: string) => `${siteLink(ctx.origin, ctx.env, name)}/`;

/** What the owner approves: the app in plain words, where it goes, what it saves and cannot do, and the questions. */
export async function appApproval(a: Record<string, unknown>, ctx: ToolContext): Promise<{ args: Record<string, unknown>; reason: string }> {
  const first = planned(a, 'app');
  const { name, replaces } = await appNameFor(a, first.cfg.title, ctx);
  const plan = planned(a, name);
  const c = plan.cfg;
  const asks = plan.questions.filter((q) => q.fallback !== undefined);
  const reason = [
    `Make the mini-app "${c.title}" and publish it at ${link(ctx, name)}?${replaces ? ` This replaces "${replaces}", which is at that link now.` : ''}`,
    `WHAT IT DOES: ${c.does}`,
    `WHAT IT SAVES: ${c.saves.replace(/\.$/, '')} — nothing is sent anywhere. Anyone with the link can open it and gets their own empty copy.`,
    'It installs to your Home Screen (Safari: Share → Add to Home Screen) and works offline after the first open. A web app on your Ghosty, not an App Store app: no notifications, nothing runs while it is closed.',
    plan.limits.length ? `What you asked for that it can't do: ${plan.limits.join('; ')}.` : '',
    asks.length ? `${asks.length === 1 ? 'One question' : 'Two questions'} (I use the answer in brackets unless you tell me otherwise): ${asks.map((q) => `${q.text} (${q.fallback})`).join(' ')}` : '',
    plan.assumed.length ? `Starting with: ${plan.assumed.join('; ')}.` : '',
    arg.str(a, 'request').length > 2000 ? 'Your message was long: I read its first 2,000 characters.' : '',
  ];
  return { args: { ...a, link_name: name }, reason: reason.filter(Boolean).join(' ') };
}

const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/** The report the owner gets with the link. */
export function appReport(job: AppJob): string {
  const c = job.cfg!;
  return [
    `Published the mini-app "${c.title}" — live at ${job.link} . Give the owner this exact link.`,
    `WHAT IT DOES: ${c.does}`,
    `WHAT IT SAVES: ${c.saves.replace(/\.$/, '')}; nothing is sent anywhere. Anyone else who opens the link gets their own empty copy.`,
    "INSTALL: on the iPhone, open the link in Safari, tap Share, then Add to Home Screen, then Add. It opens full screen from its own icon and works with no connection once it has been opened. On an iPhone the Home Screen copy keeps its own saved data, apart from Safari's, so install it first and use it from the icon. (Android: Chrome's menu → Install app.)",
    `GOOD TO KNOW: a web app on your Ghosty, not an App Store app — no notifications, and nothing runs while it is closed.${job.limits?.length ? ` It can't do what you asked here: ${job.limits.join('; ')}.` : ''}`,
    `CHECKS: page check clean; kit gates ${job.gates?.score ?? '?'}/100${job.gates?.warnings.length ? ` (${job.gates.warnings.join('; ')})` : ''}.`,
    `UNDO: say "take down ${job.name}" (unpublish_site) and the link stops working; an installed copy forgets itself the next time it opens online.`,
  ].join('\n');
}

/** Run the build from wherever it stopped. */
export async function buildApp(a: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const request = arg.str(a, 'request');
  const name = siteSlug(arg.str(a, 'link_name', false)) || (await appNameFor(a, planned(a, 'app').cfg.title, ctx)).name;
  const args = JSON.stringify({ ...a, link_name: name });
  let job = await loadAppJob(ctx, name).catch(() => undefined);
  if (!job || job.done || job.request !== request.slice(0, 2000) || job.args !== args) job = { name, request: request.slice(0, 2000), args, step: 0, at: Date.now() };
  const say = (s: string) => ctx.progress?.(s);
  if (job.step === 0) {
    say('reading the request into an app…');
    const plan = planned(a, name);
    job.cfg = plan.cfg;
    job.limits = plan.limits;
    job.step = 1;
    await saveJob(ctx, job);
  }
  const cfg = job.cfg!;
  if (job.step === 1) {
    say(`building "${cfg.title}" on the kit and drawing its icon…`);
    job.icon = b64(await encodePng(iconPixels(cfg.glyph, cfg.accent, 512), 512, 512));
    job.step = 2;
    await saveJob(ctx, job);
  }
  const html = renderApp(cfg);
  if (job.step === 2) {
    say('checking it…');
    const gates = runAppGates(cfg, html);
    const errors = [...checkHtml(html).errors, ...gates.errors];
    if (errors.length) throw new Error(`not published — the checks found: ${errors.slice(0, 4).join(' | ')}`);
    job.gates = { score: gates.score, warnings: gates.warnings };
    job.step = 3;
    await saveJob(ctx, job);
  }
  if (job.step === 3) {
    say(`publishing "${cfg.title}"…`);
    try {
      await siteStore(ctx.env, ctx.storage).put({ name, title: cfg.title, html, source: '', at: Date.now(), app: { config: cfg, icon: job.icon! } });
    } catch (e) {
      throw new Error(`publishing "${cfg.title}" did not finish (${String((e as Error)?.message ?? e).slice(0, 120)}) — call build_app again with the same request and link_name "${name}": it carries on from here`);
    }
    job.link = link(ctx, name);
    job.step = 4;
    await saveJob(ctx, job);
  }
  ctx.emit?.({ t: 'client', name: 'show_link', args: { url: job.link, title: cfg.title } });
  job.done = true;
  job.step = 5;
  await saveJob(ctx, job).catch(() => undefined);
  return appReport(job);
}

