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
 * The build is also a project (projects.ts, kind 'app') in the Workshop's PROJECTS panel, like a website:
 * the five steps with their progress, the step running now, and the report with the link at the end. Its
 * steps run here, in the call, not by the alarm; a build that failed or was cut short carries on from its
 * record when the owner taps RESUME or RUN NEXT NOW there (projects.ts runProjectStep → resumeAppBuild).
 */
import { appBase, encodePng, iconPixels, planApp, renderApp, runAppGates, type AppConfig } from '../../../packages/shared/src/appkit/index';
import type { Project, ProjectStep } from '../../../packages/shared/src/protocol';
import { durableGet, durablePut } from './kv';
import { cancelProject, loadProject, saveProject, startProject } from './projects';
import { checkHtml } from './tools/check';
import { siteLink, siteSlug, siteStore } from './tools/sites';
import { arg, type ToolContext } from './tools/types';

/** The five steps, as the project's plan in the Workshop (the same words the owner sees there). */
export const APP_STEPS = [
  { title: 'Brief and plan', instruction: 'Read the request into a kind of app, its words and options.' },
  { title: 'Build and icon', instruction: 'Draw the page on the app kit and make its Home Screen icon.' },
  { title: 'Check', instruction: "Run the page check and the kit's gates: contrast, words, honesty, options, the pinned script, size." },
  { title: 'Publish', instruction: 'Publish it at its own link, with its manifest, icon and offline copy.' },
  { title: 'Report', instruction: 'Report with the link: what it does and saves, how to install it, and how to take it down.' },
];

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
  /** Its project in the Workshop (projects.ts, kind 'app'). */
  project?: string;
  at: number;
}
const JOB = (name: string) => `appjob:${name}`;
type Ctx = Pick<ToolContext, 'env' | 'storage' | 'origin'> & Partial<Pick<ToolContext, 'emit' | 'progress'>>;
export const loadAppJob = (ctx: Ctx, name: string) => durableGet<AppJob>(ctx.env, ctx.storage, JOB(name));
const saveJob = (ctx: Ctx, j: AppJob) => durablePut(ctx.env, ctx.storage, JOB(j.name), j);
/** Which build a project is (its id → the link name), so RESUME in the Workshop finds the record. */
const OF_PROJECT = (id: string) => `appjob:project:${id}`;

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

/** The report: for the model (it gives the owner the link) or, in the Workshop, for the owner. */
export function appReport(job: AppJob, owner = false): string {
  const c = job.cfg!;
  return [
    owner ? `"${c.title}" is live at ${job.link}` : `Published the mini-app "${c.title}" — live at ${job.link} . Give the owner this exact link.`,
    `WHAT IT DOES: ${c.does}`,
    `WHAT IT SAVES: ${c.saves.replace(/\.$/, '')}; nothing is sent anywhere. Anyone else who opens the link gets their own empty copy.`,
    "INSTALL: on the iPhone, open the link in Safari, tap Share, then Add to Home Screen, then Add. It opens full screen from its own icon and works with no connection once it has been opened. On an iPhone the Home Screen copy keeps its own saved data, apart from Safari's, so install it first and use it from the icon. (Android: Chrome's menu → Install app.)",
    `GOOD TO KNOW: a web app on your Ghosty, not an App Store app — no notifications, and nothing runs while it is closed.${job.limits?.length ? ` It can't do what you asked here: ${job.limits.join('; ')}.` : ''}`,
    `CHECKS: page check clean; kit gates ${job.gates?.score ?? '?'}/100${job.gates?.warnings.length ? ` (${job.gates.warnings.join('; ')})` : ''}.`,
    `UNDO: say "take down ${job.name}" (unpublish_site) and the link stops working; an installed copy forgets itself the next time it opens online.`,
  ].join('\n');
}

/** The build's project in the Workshop: the one it already has (a resumed build), else a new one. */
async function projectFor(ctx: Ctx, job: AppJob, title: string): Promise<Project> {
  const had = job.project ? await loadProject(ctx, job.project).catch(() => undefined) : undefined;
  if (had && had.kind === 'app' && (had.status === 'active' || had.status === 'paused' || job.done)) return had;
  const p = await startProject(ctx, { title: `App: ${title}`, goal: `A mini-app for the Home Screen, published at ${link(ctx, job.name)}. Request: ${job.request}`.slice(0, 1900), steps: APP_STEPS, pace: 'fast', kind: 'app' });
  job.project = p.id;
  await durablePut(ctx.env, ctx.storage, OF_PROJECT(p.id), job.name);
  return p;
}

/**
 * Run the build from wherever it stopped, moving its project along step by step (the step running now,
 * each result, the report at the end). A step that fails pauses the project with the reason, and the error
 * goes on to the caller. The Workshop is a view: trouble saving the project never stops the build.
 */
async function runBuild(ctx: Ctx, job: AppJob): Promise<string> {
  const a = JSON.parse(job.args) as Record<string, unknown>;
  const name = job.name;
  const say = (s: string) => ctx.progress?.(s);
  let p: Project | undefined;
  try {
    p = await projectFor(ctx, job, job.cfg?.title ?? planned(a, name).cfg.title);
    await saveJob(ctx, job);
  } catch {
    /* built all the same; only the panel misses it */
  }
  const track = async (change: (p: Project, st: ProjectStep) => void, i: number) => {
    if (!p) return;
    try {
      change(p, p.steps[i]!);
      p.updated = Date.now();
      await saveProject(ctx, p);
    } catch {
      /* the build goes on; the panel catches up next time */
    }
  };
  const step = async (i: number, work: () => Promise<string>) => {
    if (job.step !== i) return;
    await track((p, st) => {
      st.status = 'doing';
      p.status = 'active';
      delete p.note;
    }, i);
    let result: string;
    try {
      result = await work();
      job.step = i + 1;
      await saveJob(ctx, job);
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      await track((p, st) => {
        st.status = 'failed';
        p.status = 'paused';
        p.fails++;
        p.note = `step ${st.n} "${st.title}" stopped: ${msg.replace(/ — call build_app again.*$/, '').slice(0, 200)}. RESUME carries on from here.`;
      }, i);
      throw e;
    }
    await track((p, st) => {
      st.status = 'done';
      st.result = result;
      st.at = Date.now();
      p.fails = 0;
    }, i);
  };

  await step(0, async () => {
    say('reading the request into an app…');
    const plan = planned(a, name);
    job.cfg = plan.cfg;
    job.limits = plan.limits;
    return `"${plan.cfg.title}": ${plan.cfg.does}${plan.limits.length ? ` It can't do: ${plan.limits.join('; ')}.` : ''}`;
  });
  const cfg = job.cfg!;
  await step(1, async () => {
    say(`building "${cfg.title}" on the kit and drawing its icon…`);
    job.icon = b64(await encodePng(iconPixels(cfg.glyph, cfg.accent, 512), 512, 512));
    return 'The page is drawn on the app kit, with its own 512 px Home Screen icon.';
  });
  const html = renderApp(cfg);
  await step(2, async () => {
    say('checking it…');
    const gates = runAppGates(cfg, html);
    const errors = [...checkHtml(html).errors, ...gates.errors];
    if (errors.length) throw new Error(`not published — the checks found: ${errors.slice(0, 4).join(' | ')}`);
    job.gates = { score: gates.score, warnings: gates.warnings };
    return `Page check clean; kit gates ${gates.score}/100${gates.warnings.length ? ` (${gates.warnings.join('; ')})` : ''}.`;
  });
  await step(3, async () => {
    say(`publishing "${cfg.title}"…`);
    try {
      await siteStore(ctx.env, ctx.storage).put({ name, title: cfg.title, html, source: '', at: Date.now(), app: { config: cfg, icon: job.icon! } });
    } catch (e) {
      throw new Error(`publishing "${cfg.title}" did not finish (${String((e as Error)?.message ?? e).slice(0, 120)}) — call build_app again with the same request and link_name "${name}": it carries on from here`);
    }
    job.link = link(ctx, name);
    return `Live at ${job.link}`;
  });
  if (job.step === 4) {
    await track((p, st) => {
      st.status = 'doing';
      p.status = 'active';
    }, 4);
    ctx.emit?.({ t: 'client', name: 'show_link', args: { url: job.link, title: cfg.title } });
    job.done = true;
    job.step = 5;
    await saveJob(ctx, job).catch(() => undefined);
  }
  // Done: every step ticked, the report with the link on the last one.
  await track((p) => {
    for (const st of p.steps) if (st.status !== 'done') Object.assign(st, { status: 'done', at: Date.now() });
    p.steps[4]!.result = appReport(job, true);
    p.status = 'done';
    p.link = job.link;
    p.fails = 0;
    delete p.note;
  }, 4);
  return appReport(job);
}

/** Run the build from wherever it stopped (a new request, or new arguments, starts a new build and project). */
export async function buildApp(a: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const request = arg.str(a, 'request');
  const name = siteSlug(arg.str(a, 'link_name', false)) || (await appNameFor(a, planned(a, 'app').cfg.title, ctx)).name;
  const args = JSON.stringify({ ...a, link_name: name });
  let job = await loadAppJob(ctx, name).catch(() => undefined);
  if (!job || job.done || job.request !== request.slice(0, 2000) || job.args !== args) {
    // An unfinished build of this link asked for differently: its project gives way to the new one.
    if (job && !job.done && job.project) await loadProject(ctx, job.project).then((p) => p && cancelProject(ctx, p)).catch(() => undefined);
    job = { name, request: request.slice(0, 2000), args, step: 0, at: Date.now() };
  }
  return runBuild(ctx, job);
}

/**
 * RESUME / RUN NEXT NOW on a mini-app's project (projects.ts runProjectStep): the build carries on from its
 * record to the end — or stops again, paused, with the reason on the project.
 */
export async function resumeAppBuild(deps: { env: ToolContext['env']; storage: DurableObjectStorage; tctx: Pick<ToolContext, 'origin'> }, p: Project): Promise<Project> {
  const ctx: Ctx = { env: deps.env, storage: deps.storage, origin: deps.tctx.origin };
  const name = await durableGet<string>(ctx.env, ctx.storage, OF_PROJECT(p.id)).catch(() => undefined);
  const job = name ? await loadAppJob(ctx, name).catch(() => undefined) : undefined;
  if (!job || job.project !== p.id) {
    p.status = 'paused';
    p.note = 'This build has no record to carry on from (a newer build of the same link took its place): ask for the app again in the chat.';
    p.updated = Date.now();
    await saveProject(ctx, p);
    return p;
  }
  await runBuild(ctx, job).catch(() => undefined); // a failure is on the project, paused, with its reason
  return (await loadProject(ctx, p.id)) ?? p;
}
