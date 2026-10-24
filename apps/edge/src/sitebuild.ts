/**
 * Websites, built on Ghosty's own from one request ("build a website for my friend's barber shop in
 * Walsall"). The request becomes a project (projects.ts, kind 'site') of six background steps that run
 * one per alarm, resume where they stopped, and use the quota engine's background lane:
 *   1. Brief, map and pictures — the request read into facts (sitekit/brief.ts), the address found on
 *      OpenStreetMap, free credited photos chosen (the vetted library, else Openverse / Wikimedia
 *      Commons / the owner's Unsplash or Pexels key, else make_picture's model)
 *   2. Plan and look — the template for the trade (sitekit/templates.ts), art-directed by a model
 *   3. Words — every page rewritten in the business's voice, checked so no fact is invented
 *   4. Build and check — assembled from the blocks, then the quality gates (sitekit/gates.ts) and
 *      check_html (the publish gate)
 *   5. Publish and look — published at /s/<name> when nothing is left to confirm (screenshots taken by a
 *      free keyless service at phone and laptop widths and critiqued by a vision model; else the critique
 *      is done from the layout analysis, and the report says so); with typical hours, prices or promises
 *      the owner has not confirmed, kept as a DRAFT that is not public, critiqued from the layout analysis
 *   6. Polish and report — the safe fixes applied, checked again, republished (or kept as the draft), and a
 *      short report: the live link, or the draft and the list the owner confirms to put it live
 * Nothing goes public without the owner's word: a draft goes live only when the owner confirms its list
 * (build_website again with confirm, which asks for approval naming the list: `confirmSite`).
 * With no model free (or after waiting once), every step has a plain fallback: the template's own words
 * and look, the gates, and the layout analysis — so a decent site always arrives.
 */
import type { Project, ProjectStep } from '../../../packages/shared/src/protocol';
import { assemble, type Assembled } from '../../../packages/shared/src/sitekit/assemble';
import { briefFrom, emailOf, missing, PLACELESS } from '../../../packages/shared/src/sitekit/brief';
import type { Hours, Service } from '../../../packages/shared/src/sitekit/types';
import { formTarget } from '../../../packages/shared/src/sitekit/blocks/formkit';
import { whatsappOf } from '../../../packages/shared/src/sitekit/blocks/hero';
import { formatGates, runGates, type GateReport } from '../../../packages/shared/src/sitekit/gates';
import { addressLine } from '../../../packages/shared/src/sitekit/html';
import { fromCommons, fromOpenverse, fromPexels, fromUnsplash, KIND_QUERIES, uncredited, type OpenverseHit } from '../../../packages/shared/src/sitekit/images';
import { STOCK, stockFor, type StockSet } from '../../../packages/shared/src/sitekit/stock-data';
import { planFrom, TEMPLATES } from '../../../packages/shared/src/sitekit/templates';
import type { Brief, ImageRef, Plan, Review } from '../../../packages/shared/src/sitekit/types';
import { applyFixes, applyPlan, applyWrites, critiquePrompt, jsonIn, planPrompt, writePrompt } from '../../../packages/shared/src/sitekit/write';
import { durableDelete, durableGet, durablePut } from './kv';
import { countToday, LensError, PICTURES_PER_DAY, storeImage } from './lens';
import { textOf, withImages } from './llm/content';
import type { Msg } from './llm/router';
import { cost, neurons } from './neurons';
import { modelUnavailable, startProject, type ProjectDeps } from './projects';
import { toBase64, fromBase64 } from './speech';
import { checkHtml } from './tools/check';
import { PICTURE_COUNT } from './tools/pictures';
import { prepareSite, siteLink, siteSlug, siteStore } from './tools/sites';
import { geocode } from './tools/travel';
import { arg, type ToolContext } from './tools/types';

/** The six steps, as the project's plan (the owner approves these words). */
export const SITE_STEPS = [
  { title: 'Brief, map and pictures', instruction: 'Read the request into facts, find the address on the map, and choose free, credited photos (or make some).' },
  { title: 'Plan and look', instruction: 'Pick the template for the trade, the pages and sections, the colours, fonts and voice.' },
  { title: 'Words', instruction: 'Write every page in the business’s own voice, without inventing prices, reviews or awards.' },
  { title: 'Build and check', instruction: 'Assemble the pages from the blocks and run the quality gates: accessibility, contrast, links, size, link previews, phone layout.' },
  { title: 'Publish and look', instruction: 'Publish the site, take screenshots on a phone and a laptop, and critique them like a designer.' },
  { title: 'Polish and report', instruction: 'Apply the fixes, check again, republish, and report with the live link.' },
];
/**
 * Steps follow each other quickly: the slow part is waiting for free model room, which the quota engine handles.
 * (Was 15 s between steps — 75 s of a two-minute build spent waiting on nothing; measured in BRIEF-WEBSITES-LIFT.)
 */
export const SITE_STEP_MS = 2_000;
/** How many pages the writer asks for at once (free models allow a few calls side by side). */
const WRITE_AT_ONCE = 3;
/** How often each step waits for a model before it carries on without one. */
const MAX_WAITS = 1;
// (Openverse asks callers to say who they are and how to reach them: the public repository, never the owner's address)
const UA = { 'User-Agent': 'Ghosty/2.0 (personal assistant; website builder; +https://github.com/wvks62vknw-sys/Ghosty)' };

/** Everything a site project carries between its steps (kept in the database AND KV, like the project). */
export interface SiteJob {
  id: string;
  name: string;
  /** The brief the site is drawn from: after step 2, with the typical hours, prices and services filled in. */
  brief: Brief;
  /**
   * What the owner actually gave, never filled in: the plan (and its "please confirm" list) is made from it
   * again whenever step 2 runs, the writers and the critic are given only these facts, and the gates check
   * the page's claims against it. (Jobs started before it existed: the brief stands in.)
   */
  facts?: Brief;
  stock?: StockSet;
  plan?: Plan;
  link?: string;
  /** Model waits so far, in all; `waited` counts them per step (each step may wait once). */
  waits: number;
  waited?: Record<string, number>;
  /** Pages the writer has finished (a resumed step 3 starts after them). */
  wrote?: number;
  /** Screenshots were tried for this build (a resumed step 5 does not take them again). */
  shotsTried?: boolean;
  /** Problems the checks found that keep the site from going public (made-up claims, placeholder text, uncredited photos). */
  blocked?: string[];
  /** Steps that went ahead without a model (said in the report). */
  plain: string[];
  /** Public at its link (false or missing: a draft, built and checked but not public). */
  live?: boolean;
  /** The owner confirmed the plan's "please confirm" list (or there was nothing on it). */
  confirmed?: boolean;
  gates?: { score: number; errors: number; warnings: number; text: string };
  critique?: { how: 'screenshots' | 'layout'; verdict: string; applied: string[]; skipped: string[]; shots: string[] };
  pictures?: string;
  geocoded?: boolean;
  /** How long each step's own work took (ms, by step number): the report says the total. */
  timings?: Record<string, number>;
  /** The plan's key when it was built and checked (a step run again with the same plan is not built twice). */
  builtKey?: string;
}
const JOB = (id: string) => `sitejob:${id}`;
/** A site built and waiting for the owner to confirm it (finding 10): its title and project, by link name. */
const DRAFT_AT = (name: string) => `sitedraft:${name}`;
type Store = { env: ToolContext['env']; storage: DurableObjectStorage };
export const loadSiteJob = (s: Store, id: string) => durableGet<SiteJob>(s.env, s.storage, JOB(id));
const saveJob = (s: Store, j: SiteJob) => durablePut(s.env, s.storage, JOB(j.id), j);

// ── starting ────────────────────────────────────────────────────────────────────────

const list = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).map((x) => x.trim()) : typeof v === 'string' && v.trim() ? v.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean) : []);

/** The tool's arguments as a Brief: the request read for facts, and whatever the model passed on explicitly. */
export function briefOf(a: Record<string, unknown>): Brief {
  const request = arg.str(a, 'request');
  const reviews: Review[] = Array.isArray(a.reviews)
    ? (a.reviews as Record<string, unknown>[]).filter((r) => r && typeof r.quote === 'string' && typeof r.name === 'string').slice(0, 8).map((r) => ({ quote: String(r.quote).slice(0, 400), name: String(r.name).slice(0, 60), ...(typeof r.detail === 'string' ? { detail: r.detail.slice(0, 60) } : {}), ...(typeof r.rating === 'number' ? { rating: r.rating } : {}) }))
    : [];
  const extra = [a.hours, a.services].filter((x) => typeof x === 'string').join('\n');
  const base = briefFrom(`${request}\n${extra}`);
  const s = (k: string) => (typeof a[k] === 'string' && (a[k] as string).trim() ? (a[k] as string).trim().slice(0, 400) : undefined);
  const b: Brief = {
    ...base,
    request: request.slice(0, 2000),
    ...(s('name') ? { name: s('name')! } : {}),
    ...(s('town') ? { town: s('town') } : {}),
    ...(s('address') ? { address: s('address') } : {}),
    ...(s('postcode') ? { postcode: s('postcode')!.toUpperCase() } : {}),
    ...(s('phone') ? { phone: s('phone') } : {}),
    // exactly one address, nothing after it ("owner@x.example?bcc=…" is refused)
    ...(s('email') && emailOf(s('email')!) === s('email') ? { email: s('email') } : {}),
    ...(s('whatsapp') ? { whatsapp: s('whatsapp') } : {}),
    ...(s('about') ? { about: s('about') } : {}),
    ...(s('extras') ? { extras: s('extras') } : {}),
    ...(s('tagline') ? { tagline: s('tagline') } : {}),
    ...(s('booking_url') && /^https:\/\//.test(s('booking_url')!) ? { bookingUrl: s('booking_url') } : {}),
    ...(formTarget(s('form_endpoint')) ? { formEndpoint: formTarget(s('form_endpoint'))!.action } : {}),
    ...(s('date') ? { date: s('date') } : {}),
    ...(s('venue') ? { venue: s('venue') } : {}),
    ...(reviews.length ? { reviews } : {}),
    ...(list(a.accreditations).length ? { accreditations: list(a.accreditations).slice(0, 8) } : {}),
    ...(list(a.areas).length ? { areas: list(a.areas).slice(0, 24) } : {}),
    ...(experienceOf(a.experience).length ? { experience: experienceOf(a.experience) } : {}),
    ...(typeof a.instagram === 'string' && a.instagram.trim() ? { socials: { instagram: a.instagram.trim() } } : {}),
    ...(Number.isInteger(Number(a.established)) && Number(a.established) > 1800 && Number(a.established) <= new Date().getFullYear() ? { established: Number(a.established) } : {}),
  };
  const kind = s('kind');
  if (kind && kind in TEMPLATES) b.kind = kind as Brief['kind'];
  return b;
}

/** A CV's jobs as the owner gave them: when, what, and a line (anything else is dropped). */
const experienceOf = (v: unknown): NonNullable<Brief['experience']> =>
  Array.isArray(v)
    ? (v as Record<string, unknown>[])
        .filter((e) => e && typeof e.when === 'string' && typeof e.title === 'string' && e.when.trim() && e.title.trim())
        .slice(0, 12)
        .map((e) => ({ when: String(e.when).trim().slice(0, 24), title: String(e.title).trim().slice(0, 60), ...(typeof e.text === 'string' && e.text.trim() ? { text: e.text.trim().slice(0, 200) } : {}) }))
    : [];

/** A short, stable tag from words: the same name always gives the same link, two names almost never one. */
const tagOf = (s: string) => ([...s].reduce((h, c) => (Math.imul(h, 31) + c.codePointAt(0)!) | 0, 7) >>> 0).toString(36).slice(-4);

/**
 * The link name: what the owner asked for, else from the business name, else the town and the trade. A name
 * a link cannot spell (Arabic, Chinese, emoji: almost nothing of it survives as a-z, 0-9) gets the trade and a
 * short tag made from the name, so two such businesses never share — and overwrite — one link.
 */
export const siteNameOf = (a: Record<string, unknown>, b: Brief): string => {
  const from = arg.str(a, 'link_name', false) || b.name || `${b.town ?? ''} ${b.kind}`;
  const plain = from.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const slug = siteSlug(plain);
  const latin = (plain.match(/[a-z0-9]/gi) ?? []).length;
  const all = (plain.match(/[\p{L}\p{N}\p{Extended_Pictographic}]/gu) ?? []).length;
  if (slug && latin * 2 >= all) return slug;
  return `${(slug || siteSlug(`${b.town ?? ''} ${b.kind}`) || 'site').slice(0, 40)}-${tagOf(from || b.request)}`;
};

/**
 * The link the build will use, looked up first: a page already there from another business moves this one
 * to the next free number (-2, -3…); the same business (or a link the owner named) replaces it, and the
 * approval says so. Never a silent overwrite.
 */
export async function siteNameFor(a: Record<string, unknown>, b: Brief, ctx: Pick<ToolContext, 'env' | 'storage'>): Promise<{ name: string; replaces?: string }> {
  const base = siteNameOf(a, b);
  const store = siteStore(ctx.env, ctx.storage);
  const at = async (n: string) => (await store.get(n).catch(() => undefined))?.title ?? (await durableGet<{ title: string }>(ctx.env, ctx.storage, DRAFT_AT(n)).catch(() => undefined))?.title;
  const had = await at(base);
  if (!had) return { name: base };
  const same = !!b.name && had.toLowerCase().includes(b.name.toLowerCase());
  if (arg.str(a, 'link_name', false) || same) return { name: base, replaces: had };
  for (let i = 2; i < 10; i++) {
    const n = `${base.slice(0, 45)}-${i}`;
    if (!(await at(n))) return { name: n };
  }
  return { name: base, replaces: had };
}

/** The owner's personal details the page will show to anyone, said plainly before anything is built or published. */
export function publicDetails(b: Brief): string {
  const shown = [b.phone && `phone ${b.phone}`, b.email && `email ${b.email}`, addressLine(b) && `address ${addressLine(b)}`].filter(Boolean);
  const wa = whatsappOf(b);
  const forms = [formTarget(b.formEndpoint) && 'your Formspree form', wa && `WhatsApp ${wa}`, b.email && `email ${b.email}`].filter(Boolean);
  return `${shown.length ? ` Public on the page: ${shown.join(', ')}.` : ''}${forms.length ? ` Its forms send to ${forms.join(' or ')}.` : ''}`;
}

/** What the owner approves: what will be built, where it will go, what will be assumed, and what it replaces. The link is fixed in the arguments. */
export async function siteApproval(a: Record<string, unknown>, ctx: ToolContext): Promise<{ args: Record<string, unknown>; reason: string }> {
  const draft = await confirmingDraft(a, ctx);
  if (draft) {
    const confirm = draft.plan!.confirm;
    return { args: { ...a, link_name: draft.name, confirm: true }, reason: `Publish the website "${draft.plan!.pages[0]!.title || draft.brief.name}" at ${siteLink(ctx.origin, ctx.env, draft.name)}?${confirm.length ? ` You are confirming what I assumed: ${confirm.join('; ')}.` : ''} Anyone with the link can open it.${publicDetails(draft.brief)}` };
  }
  if (a.confirm === true) throw new Error(`no draft website is waiting at ${siteLink(ctx.origin, ctx.env, siteNameOf(a, briefOf(a)))} — build one first`);
  const b = briefOf(a);
  const { name, replaces } = await siteNameFor(a, b, ctx);
  const t = TEMPLATES[b.kind];
  const gaps = missing(b).map((m) => m.key);
  const reason = `Build a website for ${b.name || `a ${b.kind}${b.town ? ` in ${b.town}` : ''}`} on my own and publish it at ${siteLink(ctx.origin, ctx.env, name)}?${replaces ? ` This replaces "${replaces}", which is at that link now.` : ''} Six background steps over about ${Math.round((SITE_STEPS.length * SITE_STEP_MS) / 60_000) + 2}–15 minutes: pictures, plan (${t.theme.palette} look to start), words, quality checks, screenshots and a designer's critique, then the link.${gaps.length ? ` I will use sensible defaults for: ${gaps.join(', ')} — and list them for you to confirm.` : ''} Reviews, team and awards appear only if you gave them.${publicDetails(b)}${arg.str(a, 'request').length > 2000 ? ' Your message was long: I read its first 2,000 characters.' : ''}`;
  return { args: { ...a, link_name: name }, reason };
}

/** Start the website project: the brief is kept with the job, the six steps go into a project of kind 'site'. */
export async function startSiteBuild(a: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  // The owner confirmed a waiting draft (the approval named its list and fixed confirm and the link): put it live.
  if (a.confirm === true) {
    const draft = await draftAt(ctx, siteNameOf(a, briefOf(a)));
    if (!draft) throw new Error(`no draft website is waiting at ${siteLink(ctx.origin, ctx.env, siteNameOf(a, briefOf(a)))} — build one first`);
    return confirmSite(draft, ctx);
  }
  const brief = briefOf(a);
  const name = siteNameOf(a, brief);
  const p = await startProject(ctx, { title: `Website: ${brief.name || name}`, goal: `A professional website for ${brief.name || `a ${brief.kind}`}${brief.town ? ` in ${brief.town}` : ''}, published at ${siteLink(ctx.origin, ctx.env, name)}. Request: ${brief.request}`.slice(0, 1900), steps: SITE_STEPS, pace: 'fast', kind: 'site' });
  await saveJob(ctx, { id: p.id, name, brief, facts: structuredClone(brief), waits: 0, plain: [] });
  return `Started building the website (project ${p.id}): ${SITE_STEPS.length} steps — ${SITE_STEPS.map((s) => s.title.toLowerCase()).join(', ')}. It goes live at ${siteLink(ctx.origin, ctx.env, name)} when it is done (about 5–15 minutes, longer if the free AI room is busy) — or, if I had to assume hours, prices or other details, it waits as a draft (not public) until the owner confirms them; I will send a notification with a short report. Tell the owner this, and that the Workshop's PROJECTS panel shows progress.`;
}

/** The owner's words confirm a waiting draft ("those are right, publish it"). */
const CONFIRM_WORDS = /\b(?:publish (?:it|my|the)|put it live|go live|those are (?:right|correct|fine)|that'?s (?:right|correct|fine)|all correct|confirm(?:ed)?)\b/i;

/** The draft waiting at a link, if any. */
async function draftAt(ctx: Pick<ToolContext, 'env' | 'storage'>, name: string): Promise<SiteJob | undefined> {
  const d = await durableGet<{ id: string; title: string }>(ctx.env, ctx.storage, DRAFT_AT(name)).catch(() => undefined);
  const job = d ? await loadSiteJob(ctx, d.id).catch(() => undefined) : undefined;
  return job && !job.live && job.plan ? job : undefined;
}

/** Is this call the owner confirming a waiting draft (confirm true, or their words), and which one? */
export async function confirmingDraft(a: Record<string, unknown>, ctx: Pick<ToolContext, 'env' | 'storage'>): Promise<SiteJob | undefined> {
  if (a.confirm !== true && !CONFIRM_WORDS.test(arg.str(a, 'request', false))) return undefined;
  return draftAt(ctx, siteNameOf(a, briefOf(a)));
}

/** Put a confirmed draft live: built and checked again from its plan, published, and the draft cleared. */
export async function confirmSite(job: SiteJob, ctx: ToolContext): Promise<string> {
  const { a, gates, publishErrors } = buildAndCheck(job.plan!, job.brief, factsOf(job));
  if (publishErrors.length) throw new Error(`the draft failed the publish check: ${publishErrors.slice(0, 3).join(' | ')}`);
  const stop = blocking(gates);
  if (stop.length) throw new Error(`not published — the checks found what must be fixed first: ${stop.slice(0, 3).join(' | ')}`);
  job.confirmed = true;
  await publish({ env: ctx.env, storage: ctx.storage, origin: ctx.origin }, job, a.html);
  job.gates = { score: gates.score, errors: gates.errors, warnings: gates.warnings, text: formatGates(gates).slice(0, 3000) };
  await saveJob(ctx, job);
  await durableDelete(ctx.env, ctx.storage, DRAFT_AT(job.name)).catch(() => undefined);
  return `Published "${job.plan!.pages[0]!.title || job.brief.name}" — live now at ${job.link}, with the details the owner confirmed (${job.plan!.confirm.join('; ') || 'nothing was assumed'}). Give the owner this exact link.`;
}

/** The owner's own facts (never the typical ones filled in for the plan). */
const factsOf = (job: SiteJob): Brief => job.facts ?? job.brief;

// ── models ──────────────────────────────────────────────────────────────────────────

/** Ask a model; null when none is free and this step has waited enough (it then goes ahead without). */
async function ask(deps: ProjectDeps, job: SiteJob, step: string, system: string, user: string | Msg['content'], opts: { code?: boolean; tier?: 'small' | 'big' } = {}): Promise<string | null> {
  try {
    const { message } = await deps.complete([{ role: 'system', content: system }, { role: 'user', content: user as Msg['content'] }], [], { priority: 'background', ...opts });
    return textOf(message.content);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (modelUnavailable(msg) || (e as { waitMs?: number })?.waitMs !== undefined) {
      job.waited ??= {};
      if ((job.waited[step] ?? 0) < MAX_WAITS) {
        job.waited[step] = (job.waited[step] ?? 0) + 1;
        job.waits++;
        await saveJob(deps, job);
        throw e; // the project waits a quarter of an hour, then this step runs again
      }
      return null;
    }
    return null; // a model that answered badly is not worth stopping the site for
  }
}

// ── pictures ────────────────────────────────────────────────────────────────────────

/** Free photos for a kind: Openverse first, then Wikimedia Commons; the owner's Unsplash or Pexels key when there is one. */
export async function findPictures(kind: Brief['kind'], want: number, keys: { unsplash?: string | null; pexels?: string | null } = {}): Promise<{ images: ImageRef[]; from: string[] }> {
  const out: ImageRef[] = [];
  const from: string[] = [];
  const seen = new Set<string>();
  const push = (i: ImageRef | undefined, src: string) => {
    if (i && !seen.has(i.src) && out.length < want) {
      seen.add(i.src);
      out.push(i);
      if (!from.includes(src)) from.push(src);
    }
  };
  // Every search at once (each provider for each query), then taken in the old order of preference — the owner's
  // own keys first, then Openverse, then Commons, query by query — so a slow service costs one wait, not nine.
  const json = <T>(url: string, init: RequestInit): Promise<T | null> => fetch(url, init).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null);
  const searches = KIND_QUERIES[kind].map((q) => {
    const alt = q[0]!.toUpperCase() + q.slice(1);
    return Promise.all([
      keys.unsplash ? json<{ results?: Parameters<typeof fromUnsplash>[0][] }>(`https://api.unsplash.com/search/photos?per_page=6&orientation=landscape&query=${encodeURIComponent(q)}`, { headers: { Authorization: `Client-ID ${keys.unsplash}`, 'Accept-Version': 'v1' } }).then((j) => (j?.results ?? []).map((p) => [fromUnsplash(p, alt), 'Unsplash'] as const)) : [],
      keys.pexels ? json<{ photos?: Parameters<typeof fromPexels>[0][] }>(`https://api.pexels.com/v1/search?per_page=6&orientation=landscape&query=${encodeURIComponent(q)}`, { headers: { Authorization: keys.pexels } }).then((j) => (j?.photos ?? []).map((p) => [fromPexels(p, alt), 'Pexels'] as const)) : [],
      json<{ results?: OpenverseHit[] }>(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license_type=commercial&category=photograph&size=large&mature=false&page_size=12`, { headers: UA }).then((j) => (j?.results ?? []).map((h) => [fromOpenverse(h, alt), 'Openverse'] as const)),
      json<{ query?: { pages?: Record<string, Parameters<typeof fromCommons>[0]> } }>(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(`${q} filetype:bitmap`)}&prop=imageinfo&iiprop=url|size|mime|extmetadata`, { headers: UA }).then((j) => Object.values(j?.query?.pages ?? {}).map((p) => [fromCommons(p, alt), 'Wikimedia Commons'] as const)),
    ]);
  });
  for (const found of await Promise.all(searches)) for (const hits of found) for (const [i, src] of hits) push(i, src);
  return { images: out, from };
}

/**
 * A picture made with Workers AI's flux (make_picture's model), kept for good: a published site must not lose
 * it. It goes through the shared free-AI ledger like make_picture (the reserve for hearing and answering the
 * owner is never touched), and nothing is spent unless the picture can be kept and shown: an https address
 * and room in today's picture count are checked before the model runs.
 */
export async function makePicture(ctx: Pick<ToolContext, 'env' | 'origin'>, prompt: string): Promise<ImageRef | null> {
  const ai = ctx.env.AI;
  const kv = ctx.env.SITES;
  const origin = ctx.origin || ctx.env.PUBLIC_ORIGIN || '';
  if (!ai || !kv || !/^https:/.test(origin)) return null;
  try {
    if ((await countToday(kv, PICTURE_COUNT, 'picture')) >= PICTURES_PER_DAY) return null;
    const n = cost.image(6);
    if (!(await neurons().room('image', n))) return null;
    await neurons().charge('image', n);
    const r = (await ai.run('@cf/black-forest-labs/flux-1-schnell', { prompt: prompt.slice(0, 600), steps: 6 })) as { image?: unknown } | null;
    if (!r || typeof r.image !== 'string') return null;
    const kept = await storeImage(kv, fromBase64(r.image), 'image/jpeg', { ttl: 10 * 365 * 86_400, counter: PICTURE_COUNT, limit: PICTURES_PER_DAY, noun: 'picture', verb: 'made' });
    return { src: `${origin}/i/${kept.id}`, width: 1024, height: 1024, alt: prompt.split('.')[0]!.slice(0, 120), generated: true };
  } catch (e) {
    if (e instanceof LensError) return null; // the store could not keep it (or count it): the site goes ahead without
    return null;
  }
}

const PICTURE_PROMPT: Record<Brief['kind'], string> = {
  barber: 'Editorial photograph of a modern barbershop interior, leather barber chairs, warm tungsten light, mirrors, shallow depth of field, no people facing camera, no text',
  salon: 'Editorial photograph of a calm bright hair salon interior, plants, soft daylight, styling chairs, no text',
  cafe: 'Editorial photograph of a cosy independent cafe counter with pastries and a flat white, morning window light, no text',
  restaurant: 'Editorial photograph of a beautifully plated seasonal dish on a rustic table, candlelight, restaurant ambience, no text',
  trades: 'Editorial photograph of a tradesperson\'s tools neatly laid out on a workbench in a clean modern home, daylight, no text, no faces',
  gym: 'Editorial photograph of a modern strength gym, barbells and plates, dramatic light, no people, no text',
  photographer: 'Fine art photograph of golden hour light over an English countryside landscape, no text',
  shop: 'Editorial photograph of an independent gift shop with wooden shelves of handmade goods, warm light, no text',
  clinic: 'Editorial photograph of a bright, calm modern clinic treatment room, plants, daylight, no people, no text',
  estate: 'Editorial photograph of a row of red brick Victorian terraced houses in England on a sunny day, no text',
  portfolio: 'Editorial photograph of a tidy designer desk with sketches, a laptop and coffee, soft daylight, no text',
  event: 'Photograph of a concert crowd with colourful stage lights and confetti, from behind, no text',
  charity: 'Photograph of community volunteers\' hands sorting food donations into boxes, warm light, no faces, no text',
  saas: 'Abstract soft gradient 3D shapes in indigo and cyan, clean product background, no text',
  tradesperson: 'Editorial photograph of a tidy toolbox, spirit level and drill on a workbench in a bright home, no text, no faces',
  takeaway: 'Editorial photograph of a hot takeaway meal on a wooden counter, steam, warm light, no text',
  cv: 'Minimal editorial photograph of a tidy desk with a notebook and a cup of coffee by a window, no text',
  invite: 'Photograph of a garden party table with flowers and string lights at golden hour, no people, no text',
  club: 'Photograph of a friendly community hall set up for a club evening, chairs and tables, warm light, no people, no text',
  launch: 'Minimal product photograph of an unbranded box on a soft gradient background, studio light, no text',
};

/** Step 1: the facts, the map, the pictures. */
async function stepBrief(deps: ProjectDeps, job: SiteJob): Promise<string> {
  const b = job.brief;
  // The map, the form address and the pictures do not wait for each other: all three at once.
  const place = async (): Promise<string> => {
    if (b.lat !== undefined || !(b.address || b.postcode || b.town || b.venue) || PLACELESS.includes(b.kind)) return '';
    const g = await geocode([b.venue, b.address, b.postcode, b.town, 'UK'].filter(Boolean).join(', ')).catch(() => null);
    if (!g) return 'could not place the address on the map — the map shows an "open the map" button instead';
    b.lat = Math.round(g.lat * 1e5) / 1e5;
    b.lon = Math.round(g.lon * 1e5) / 1e5;
    if (job.facts) Object.assign(job.facts, { lat: b.lat, lon: b.lon });
    job.geocoded = true;
    return `found it on the map (${b.lat}, ${b.lon})`;
  };
  // The owner's free form address from the keys (form_endpoint), when the request did not give one.
  const form = async (): Promise<string> => {
    if (b.formEndpoint) return '';
    const given = await deps.tctx.vault.get('form_endpoint').catch(() => null);
    const t = formTarget(given);
    if (!t) return given ? 'the form address in the keys is not a Formspree form (https://formspree.io/f/…), so the forms open WhatsApp or email' : '';
    b.formEndpoint = t.action;
    if (job.facts) job.facts.formEndpoint = t.action;
    return 'forms send to your Formspree form';
  };
  const pictures = async (): Promise<string> => {
    const stock = stockFor(b.kind);
    const own = STOCK[b.kind];
    if (own) {
      job.stock = own;
      return (job.pictures = `${1 + own.story.length + own.gallery.length} vetted free photos for a ${b.kind} (Wikimedia Commons, credited)`);
    }
    const [unsplash, pexels] = await Promise.all([deps.tctx.vault.get('unsplash').catch(() => null), deps.tctx.vault.get('pexels').catch(() => null)]);
    const found = await findPictures(b.kind, 9, { unsplash, pexels }).catch(() => ({ images: [] as ImageRef[], from: [] as string[] }));
    let images = found.images;
    if (images.length < 3) {
      const made = await makePicture(deps.tctx, PICTURE_PROMPT[b.kind]);
      if (made) images = [made, ...images];
    }
    if (images.length) {
      const hero = images.find((i) => (i.width ?? 0) >= (i.height ?? 0)) ?? images[0]!;
      const rest = images.filter((i) => i !== hero);
      job.stock = { hero, story: rest.slice(0, 2), gallery: rest.slice(2).length ? rest.slice(2) : rest };
      return (job.pictures = `${images.length} free photos (${found.from.join(', ') || 'made with the picture model'}), every one credited`);
    }
    if (stock) {
      job.stock = stock;
      return (job.pictures = 'vetted photos from a neighbouring trade (nothing better found)');
    }
    return (job.pictures = 'no photos found — the design works without them');
  };
  const notes = (await Promise.all([place(), form(), pictures()])).filter(Boolean);
  await saveJob(deps, job);
  return `Brief for ${b.name || b.kind}: ${b.kind}${b.town ? ` in ${b.town}` : ''}; ${notes.join('; ')}.`;
}

/** Step 2: the template, art-directed. */
async function stepPlan(deps: ProjectDeps, job: SiteJob): Promise<string> {
  const url = siteLink(deps.tctx.origin, deps.env, job.name);
  // Always from the owner's own facts: a step that waited for a model and runs again still knows what was assumed.
  const { plan, brief } = planFrom(factsOf(job), { url: /^https:/.test(url) ? url : undefined, stock: () => job.stock });
  job.brief = brief;
  const pr = planPrompt(plan, factsOf(job));
  const reply = await ask(deps, job, 'plan', pr.system, pr.user, { tier: 'small' });
  let notes: string[] = [];
  if (reply === null) job.plain.push('plan');
  else notes = applyPlan(plan, jsonIn(reply));
  job.plan = plan;
  await saveJob(deps, job);
  return `Plan: ${plan.pages.map((p) => `${p.label} (${p.sections.length} sections)`).join(', ')}; look ${plan.theme.palette} / ${plan.theme.fonts} / ${plan.theme.scheme}; voice "${plan.tone}".${notes.length ? ` Planner: ${notes.join(', ')}.` : reply === null ? ' (No model free: the template\'s own look.)' : ''}`;
}

/**
 * Step 3: the words, a few pages side by side (a page already written is not asked again when the step resumes).
 * The first page of each batch is asked alone first, so the step's one model wait works as before; the others go
 * at the same time, and any that fails is simply asked again (alone) in the next batch.
 */
async function stepWords(deps: ProjectDeps, job: SiteJob): Promise<string> {
  const plan = job.plan!;
  let changed = 0;
  let refused = 0;
  let asked = 0;
  // A page asked alongside: its answer, or the error when no model was free for it (then it waits like the first one).
  const quiet = (w: ReturnType<typeof writePrompt>): Promise<string | { wait: unknown } | null> =>
    deps
      .complete([{ role: 'system', content: w.system }, { role: 'user', content: w.user }], [], { priority: 'background', tier: 'big' })
      .then((r) => textOf(r.message.content))
      .catch((e: unknown) => (modelUnavailable(String((e as Error)?.message ?? e)) || (e as { waitMs?: number })?.waitMs !== undefined ? { wait: e } : null));
  const todo: number[] = [];
  for (let k = job.wrote ?? 0; k < plan.pages.length; k++) todo.push(k);
  while (todo.length) {
    const batch = todo.splice(0, WRITE_AT_ONCE).map((k) => ({ k, w: writePrompt(plan, factsOf(job), k) }));
    const live = batch.filter((x) => x.w.pieces.length);
    if (!live.length) {
      job.wrote = batch[batch.length - 1]!.k + 1;
      continue;
    }
    const [first, ...rest] = live;
    const others = Promise.all(rest.map((x) => quiet(x.w)));
    const reply = await ask(deps, job, 'words', first!.w.system, first!.w.user, { tier: 'big' });
    if (reply === null) {
      job.plain.push('words');
      await saveJob(deps, job);
      break;
    }
    const replies = [reply, ...(await others)];
    for (let n = 0; n < live.length; n++) {
      const r = replies[n];
      if (r && typeof r === 'object') {
        // No model free for this page: the step's one wait, as if it had been asked alone (the pages before it are kept).
        job.waited ??= {};
        if ((job.waited.words ?? 0) < MAX_WAITS) {
          job.waited.words = (job.waited.words ?? 0) + 1;
          job.waits++;
          await saveJob(deps, job);
          throw r.wait;
        }
      }
      if (r == null || typeof r === 'object') {
        todo.unshift(...live.slice(n).map((x) => x.k)); // asked again, alone first, in the next batch
        break;
      }
      asked++;
      const w = applyWrites(plan, live[n]!.w.pieces, jsonIn(r), factsOf(job));
      changed += w.changed;
      refused += w.refused.length;
      job.wrote = live[n]!.k + 1;
    }
    await saveJob(deps, job);
  }
  return asked ? `Words: ${changed} pieces rewritten across ${asked} pages${refused ? `; ${refused} rewrites refused (too long, new numbers or stock phrases)` : ''}.` : "Words: the template's own copy (no model was free).";
}

/** Assemble and check: the kit's gates and the publish gate (check_html). */
/** The last few builds, by what went in: steps 4, 5 and 6 (and a confirm) build the same plan again and again. */
const BUILT = new Map<string, { a: Assembled; gates: GateReport; publishErrors: string[] }>();
/** A short key for a plan and its facts (the same input always gives the same key). */
export const buildKey = (plan: Plan, brief: Brief, facts: Brief = brief): string => {
  const s = JSON.stringify([plan, brief, facts]);
  let h = 7;
  let g = 11;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    g = (Math.imul(g, 37) + s.charCodeAt(i)) | 0;
  }
  return `${s.length.toString(36)}-${(h >>> 0).toString(36)}-${(g >>> 0).toString(36)}`;
};

export function buildAndCheck(plan: Plan, brief: Brief, facts: Brief = brief): { a: Assembled; gates: GateReport; publishErrors: string[] } {
  const key = buildKey(plan, brief, facts);
  const had = BUILT.get(key);
  if (had) return structuredClone(had);
  const out = buildOnce(plan, brief, facts);
  if (BUILT.size >= 4) BUILT.delete(BUILT.keys().next().value!);
  BUILT.set(key, structuredClone(out));
  return out;
}
function buildOnce(plan: Plan, brief: Brief, facts: Brief): { a: Assembled; gates: GateReport; publishErrors: string[] } {
  const a = assemble(plan, brief);
  const gates = runGates(a.html, plan, brief, facts);
  // Every picture credited, unless it is the owner's own or made by Ghosty.
  const bare = uncredited(a.images, (facts.photos ?? []).map((i) => i.src));
  if (bare.length) {
    gates.findings.push({ gate: 'honesty', level: 'error', text: `${bare.length} picture${bare.length === 1 ? ' has' : 's have'} no credit: ${bare[0]!.slice(0, 60)}` });
    gates.errors++;
    gates.score = Math.max(0, gates.score - 12);
  }
  let publishErrors: string[] = [];
  try {
    const formAction = formTarget(facts.formEndpoint)?.action;
    const prepared = prepareSite(a.html, '', { formAction });
    publishErrors = checkHtml(prepared.html, { formAction }).errors;
  } catch (e) {
    publishErrors = [String((e as Error)?.message ?? e)];
  }
  return { a, gates, publishErrors };
}

/** The problems that keep a site from going public: made-up claims or reviews, placeholder text, uncredited photos. */
export const blocking = (g: GateReport): string[] => g.findings.filter((f) => f.level === 'error' && (f.gate === 'honesty' || /placeholder/.test(f.text))).map((f) => f.text);

/** Step 4. */
async function stepBuild(deps: ProjectDeps, job: SiteJob): Promise<string> {
  const { a, gates, publishErrors } = buildAndCheck(job.plan!, job.brief, factsOf(job));
  const key = buildKey(job.plan!, job.brief, factsOf(job));
  // Run again with the same plan (a retry after a hiccup): the checks are already saved, nothing to save again.
  if (job.builtKey !== key || !job.gates) {
    job.gates = { score: gates.score, errors: gates.errors, warnings: gates.warnings, text: formatGates(gates).slice(0, 3000) };
    job.builtKey = key;
    await saveJob(deps, job);
  }
  if (publishErrors.length) throw new Error(`the page failed the publish check: ${publishErrors.slice(0, 3).join(' | ')}`);
  return `Built ${Math.round(a.html.length / 1024)} KB from ${a.blocks.length} blocks${a.dropped.length ? ` (left out: ${a.dropped.join('; ')})` : ''}. ${formatGates(gates).split('\n').slice(0, 6).join('\n')}`;
}

/** Publish (or update) the site. */
async function publish(s: Store & { origin?: string }, job: SiteJob, html: string): Promise<string> {
  if (!job.confirmed) throw new Error('not published — the owner has not confirmed what was assumed');
  const formAction = formTarget(factsOf(job).formEndpoint)?.action;
  const { html: ready } = prepareSite(html, '', { formAction });
  const errors = checkHtml(ready, { formAction }).errors;
  if (errors.length) throw new Error(`not published — ${errors.slice(0, 3).join(' | ')}`);
  const title = job.plan!.pages[0]!.title || job.brief.name;
  await siteStore(s.env, s.storage).put({ name: job.name, title, html: ready, source: '', at: Date.now(), ...(formAction ? { formAction } : {}) });
  job.link = siteLink(s.origin, s.env, job.name);
  job.live = true;
  return job.link;
}

/** Keep the site as a draft: checked, not public; the pointer lets the owner's "publish it" find it. */
async function keepDraft(deps: ProjectDeps, job: SiteJob): Promise<string> {
  job.live = false;
  job.link = siteLink(deps.tctx.origin, deps.env, job.name);
  await durablePut(deps.env, deps.storage, DRAFT_AT(job.name), { id: job.id, title: job.plan!.pages[0]!.title || job.brief.name, at: Date.now() });
  return job.link;
}
const pub = (deps: ProjectDeps) => ({ env: deps.env, storage: deps.storage, origin: deps.tctx.origin });

// ── screenshots ─────────────────────────────────────────────────────────────────────

/** Screenshots go to free outside services: never from the preview, with the scripted model, or when switched off (NO_SCREENSHOTS=1). */
export const noShots = (env: ToolContext['env']): boolean => env.IS_PREVIEW === '1' || env.MOCK_LLM === '1' || (env as { NO_SCREENSHOTS?: string }).NO_SCREENSHOTS === '1';

/**
 * Screenshots of the live page from free, keyless services (Microlink: 50 a day; thum.io as a second try).
 * The brain cannot run a browser itself. Null for a size that could not be had.
 */
export async function screenshot(url: string, width: number, height: number): Promise<string | null> {
  const toData = async (r: Response | null): Promise<string | null> => {
    if (!r?.ok) return null;
    const type = (r.headers.get('content-type') ?? '').split(';')[0]!;
    if (!/^image\/(png|jpeg)$/.test(type)) return null;
    const buf = await r.arrayBuffer();
    if (buf.byteLength < 8_000 || buf.byteLength > 1_400_000) return null;
    return `data:${type};base64,${toBase64(buf)}`;
  };
  const mobile = width < 600;
  const ml = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&waitForTimeout=2500&screenshot.type=jpeg&viewport.width=${width}&viewport.height=${height}&viewport.deviceScaleFactor=1${mobile ? '&viewport.isMobile=true' : ''}`, { headers: UA }).catch(() => null);
  const j = ml?.ok ? ((await ml.json().catch(() => null)) as { status?: string; data?: { screenshot?: { url?: string } } } | null) : null;
  const shot = j?.status === 'success' ? j.data?.screenshot?.url : undefined;
  if (shot && /^https:\/\//.test(shot)) {
    const d = await toData(await fetch(shot).catch(() => null));
    if (d) return d;
  }
  // thum.io answers with a "generating" picture first; a few tries a few seconds apart.
  for (let k = 0; k < 3; k++) {
    const d = await toData(await fetch(`https://image.thum.io/get/width/${width}/crop/${height}/viewportWidth/${width}/noanimate/${url}`).catch(() => null));
    if (d) return d;
    await new Promise((r) => setTimeout(r, 4000));
  }
  return null;
}

/** The layout analysis the critic reads when there are no screenshots (and alongside them when there are). */
export function layoutAnalysis(plan: Plan, a: Assembled, gates: GateReport): string {
  const pages = plan.pages.map((p) => `${p.label}: ${p.sections.map((s) => `${s.block}${s.tone && s.tone !== 'base' ? `(${s.tone})` : ''}`).join(' → ')}`);
  const words = plan.pages.map((p) => {
    const t = JSON.stringify(p.sections.map((s) => s.data)).replace(/"(src|href|srcset)":"[^"]*"/g, '');
    return `${p.label} ≈ ${Math.round(t.length / 6)} words`;
  });
  return [`Pages in order:\n${pages.join('\n')}`, `Amount of text: ${words.join('; ')}`, `Pictures: ${a.images.length} (${a.images.filter((i) => i.generated).length} made by the picture model)`, formatGates(gates)].join('\n\n');
}

/** Step 5: publish, then look at it. */
async function stepLook(deps: ProjectDeps, job: SiteJob): Promise<string> {
  const { a, gates } = buildAndCheck(job.plan!, job.brief, factsOf(job));
  // Live only with nothing left to confirm and nothing the checks must stop; otherwise a draft, not public.
  job.blocked = blocking(gates);
  if (!job.plan!.confirm.length && !job.blocked.length) job.confirmed = true;
  const link = job.confirmed && !job.blocked.length ? await publish(pub(deps), job, a.html) : await keepDraft(deps, job);
  const sizes: string[] = [];
  const images: string[] = [];
  const SHOTS = `${JOB(job.id)}:shots`;
  let why = job.live ? 'no screenshot service answered' : 'a draft is not public, so no screenshots';
  if (job.live && noShots(deps.env)) why = 'screenshots are switched off here';
  else if (job.live && job.shotsTried) {
    // A resumed step: the screenshots already taken (if they could be kept), never a second round of requests.
    const kept = await durableGet<{ sizes: string[]; images: string[] }>(deps.env, deps.storage, SHOTS).catch(() => undefined);
    if (kept) sizes.push(...kept.sizes), images.push(...kept.images);
  } else if (job.live && /^https:\/\//.test(link)) {
    // The phone and the laptop at once (each free service can take several seconds).
    const shots = await Promise.all(([[390, 844], [1280, 900]] as const).map(([w, h]) => screenshot(link, w, h).catch(() => null).then((shot) => ({ w, shot }))));
    for (const { w, shot } of shots) {
      if (shot) {
        sizes.push(String(w));
        images.push(shot);
      }
    }
    job.shotsTried = true;
    await durablePut(deps.env, deps.storage, SHOTS, { sizes, images }).catch(() => undefined);
    await saveJob(deps, job);
  }
  const how = images.length ? 'screenshots' : 'layout';
  const pr = critiquePrompt(job.plan!, factsOf(job), layoutAnalysis(job.plan!, a, gates), how === 'screenshots');
  let reply = await ask(deps, job, 'critique', pr.system, how === 'screenshots' ? withImages(pr.user, images) : pr.user, { tier: 'big' });
  let how2: 'screenshots' | 'layout' = how;
  if (reply === null && how === 'screenshots') {
    // No model that can see is free: the critique from the layout analysis instead.
    const text = critiquePrompt(job.plan!, factsOf(job), layoutAnalysis(job.plan!, a, gates), false);
    reply = await ask(deps, job, 'critique', text.system, text.user, { tier: 'big' });
    how2 = 'layout';
  }
  if (reply === null) job.plain.push('critique');
  const answer = reply === null ? null : jsonIn(reply);
  job.critique = { how: how2, verdict: typeof answer?.verdict === 'string' ? answer.verdict.slice(0, 300) : '', applied: [], skipped: [], shots: how2 === 'screenshots' ? sizes : [] };
  // The fixes are applied in the next step; kept as JSON so a resumed step does not ask again.
  await durablePut(deps.env, deps.storage, `${JOB(job.id)}:fixes`, answer ?? {});
  await saveJob(deps, job);
  return `${job.live ? `Published at ${link}` : `Kept as a draft (not public) for ${link} until the owner confirms: ${job.plan!.confirm.join('; ')}`}. Critique from ${how2 === 'screenshots' ? `screenshots at ${job.critique.shots.join(' and ')} px` : `the layout analysis (${why})`}${job.critique.verdict ? `: ${job.critique.verdict}` : reply === null ? ': no model free, the quality gates stand in.' : '.'}`;
}

/** Step 6: the fixes, checked; republished only when it is no worse. */
async function stepPolish(deps: ProjectDeps, job: SiteJob): Promise<string> {
  const answer = (await durableGet<Record<string, unknown>>(deps.env, deps.storage, `${JOB(job.id)}:fixes`)) ?? null;
  const before = buildAndCheck(job.plan!, job.brief, factsOf(job));
  const trial = structuredClone(job.plan!);
  const fx = applyFixes(trial, factsOf(job), answer && Object.keys(answer).length ? answer : null);
  // Nothing applied: the trial is the plan itself, so it is not built a second time.
  const after = fx.applied.length ? buildAndCheck(trial, job.brief, factsOf(job)) : before;
  let kept = false;
  if (fx.applied.length && !after.publishErrors.length && after.gates.errors <= before.gates.errors) {
    job.plan = trial;
    if (job.live) await publish(pub(deps), job, after.a.html);
    kept = true;
  } else if (!job.link) {
    if (job.confirmed) await publish(pub(deps), job, before.a.html);
    else await keepDraft(deps, job);
  }
  const final = kept ? after.gates : before.gates;
  job.blocked = blocking(final);
  job.gates = { score: final.score, errors: final.errors, warnings: final.warnings, text: formatGates(final).slice(0, 3000) };
  job.critique = { ...(job.critique ?? { how: 'layout', verdict: '', shots: [] }), applied: kept ? fx.applied : [], skipped: fx.skipped };
  await saveJob(deps, job);
  return siteReport(job);
}

/** The short report the owner gets with the link. */
export function siteReport(job: SiteJob): string {
  const plan = job.plan!;
  const c = job.critique;
  const lines = [
    job.live
      ? `Live: ${job.link}${job.gates?.errors ? ` — published with ${job.gates.errors} problem${job.gates.errors === 1 ? '' : 's'} the checks found (in the Workshop)` : ''}`
      : job.blocked?.length
        ? `Draft — not public. The checks found what must be fixed before it can go live at ${job.link}: ${job.blocked.slice(0, 3).join('; ')}.`
        : `Draft — not public yet. It goes live at ${job.link} once you confirm what I had to assume (listed below): say "publish my website" (or tell me what to change).`,
    `${plan.pages.length} pages (${plan.pages.map((p) => p.label).join(', ')}), ${plan.theme.palette} look with ${plan.theme.fonts} fonts.`,
    `Quality checks: ${job.gates?.score ?? '?'}/100 (${job.gates?.errors ?? 0} problems, ${job.gates?.warnings ?? 0} small things).`,
    c ? `Design review from ${c.how === 'screenshots' ? 'screenshots on a phone and a laptop' : 'a layout analysis (no screenshots were possible)'}${c.verdict ? `: ${c.verdict}` : ''}${c.applied.length ? ` Fixed: ${c.applied.slice(0, 4).join('; ')}.` : ''}` : '',
    job.pictures ? `Pictures: ${job.pictures}.` : '',
    plan.confirm.length ? `Please confirm: ${plan.confirm.join('; ')}.` : '',
    job.plain.length ? `Done without an AI model (none was free): ${[...new Set(job.plain)].join(', ')} — the template's own words and look were used.` : '',
    formTarget(factsOf(job).formEndpoint)
      ? 'Forms send straight to your Formspree form (its free plan: 50 messages a month) and can also open WhatsApp or email; the page may send to that one address and nowhere else.'
      : 'Forms open the visitor\'s WhatsApp or email with the message filled in (published pages cannot store anything). For a form that really sends, put a free Formspree form address (https://formspree.io/f/…) in SYSTEM → KEYS as form_endpoint.',
  ];
  return lines.filter(Boolean).join('\n');
}

// ── the DRAFT card (Workshop): the page as a phone and a laptop, CHANGE in words, then PUBLISH ─────

/** What the DRAFT card shows: the page itself (to draw in two locked frames), its state and what to confirm. */
export interface DraftView {
  name: string;
  title: string;
  html: string;
  live: boolean;
  link: string;
  confirm: string[];
  /** The words the card's PUBLISH sends to the chat (the owner then approves, naming the list: confirmSite). */
  publish: string;
}
export async function draftView(s: Store & { origin?: string }, id: string): Promise<DraftView | null> {
  const job = await loadSiteJob(s, id).catch(() => undefined);
  if (!job?.plan) return null;
  const { a } = buildAndCheck(job.plan, job.brief, factsOf(job));
  const link = job.link ?? siteLink(s.origin, s.env, job.name);
  return { name: job.name, title: job.plan.pages[0]!.title || job.brief.name, html: a.html, live: !!job.live, link, confirm: job.plan.confirm, publish: `Publish my draft website at ${link} — those are right, publish it` };
}

/**
 * The owner's change, in his words, folded into his facts: whatever can be read for sure (a phone, an email, a
 * postcode, hours, prices, a date, "name: …", "town: …", "about: …") replaces what was there; the rest is kept
 * word for word with his other notes and said back, never guessed at.
 */
export function changeFacts(facts: Brief, words: string): { facts: Brief; changed: string[]; kept: string } {
  const out: Brief = structuredClone(facts);
  const found = briefFrom(words, { kind: facts.kind });
  const changed: string[] = [];
  const set = <K extends keyof Brief>(k: K, v: Brief[K] | undefined, label: string) => {
    if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return;
    (out as unknown as Record<string, unknown>)[k] = v;
    changed.push(label);
  };
  set('phone', found.phone, 'phone');
  if (found.email && emailOf(found.email) === found.email) set('email', found.email, 'email');
  set('postcode', found.postcode, 'postcode');
  set('hours', found.hours as Hours[] | undefined, 'opening hours');
  set('services', found.services as Service[] | undefined, 'prices');
  set('date', found.date, 'date');
  if (formTarget(found.formEndpoint)) set('formEndpoint', formTarget(found.formEndpoint)!.action, 'form address');
  const label = (re: RegExp) => words.match(re)?.[1]?.trim().slice(0, 120);
  set('name', label(/\b(?:name|called)\s*[:=-]?\s*([^\n,;.]+)/i), 'name');
  set('town', label(/\b(?:town|area)\s*[:=-]\s*([^\n,;.]+)/i), 'town');
  set('address', label(/\baddress\s*[:=-]\s*([^\n;]+)/i), 'address');
  set('tagline', label(/\b(?:tagline|slogan)\s*[:=-]\s*([^\n;]+)/i), 'tagline');
  set('about', label(/\babout\s*[:=-]\s*([^\n]+)/i), 'about');
  const kept = changed.length ? '' : words.trim().slice(0, 400);
  if (kept) out.extras = [out.extras, kept].filter(Boolean).join('\n').slice(0, 1200);
  return { facts: out, changed, kept };
}

/** CHANGE on the DRAFT card: the facts changed, the draft drawn again from them (still a draft, not public). */
export async function changeDraft(s: Store & { origin?: string }, id: string, words: string): Promise<{ view: DraftView; said: string }> {
  const job = await loadSiteJob(s, id);
  if (!job?.plan) throw new Error('no draft website for this project');
  if (job.live) throw new Error('this website is already public — ask Ghosty in the chat to change it');
  const w = words.trim().slice(0, 600);
  if (!w) throw new Error('say what to change');
  const { facts, changed, kept } = changeFacts(factsOf(job), w);
  const url = siteLink(s.origin, s.env, job.name);
  const { plan, brief } = planFrom(facts, { url: /^https:/.test(url) ? url : undefined, stock: () => job.stock });
  plan.theme = job.plan.theme; // the look the planner chose stays
  job.facts = facts;
  job.brief = brief;
  job.plan = plan;
  delete job.builtKey;
  const { gates } = buildAndCheck(plan, brief, facts);
  job.blocked = blocking(gates);
  job.gates = { score: gates.score, errors: gates.errors, warnings: gates.warnings, text: formatGates(gates).slice(0, 3000) };
  await saveJob(s, job);
  const said = changed.length
    ? `Changed: ${changed.join(', ')}. The draft is drawn again from your facts (the wording is the template's own again); still not public.`
    : `I could not read that as a fact I can change by myself, so I kept it with your notes: "${kept.slice(0, 120)}". Tell Ghosty in the chat and it will rebuild with it.`;
  return { view: (await draftView(s, id))!, said };
}

/** "Built in 9.4 s of work (pictures 1.3 s, plan 1.2 s, words 2.4 s, checks 0.1 s, publish and look 1.3 s, polish 0.1 s)." */
export function buildTime(t: Record<string, number> = {}): string {
  const s = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
  const names = ['pictures', 'plan', 'words', 'checks', 'publish and look', 'polish'];
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  return `Built in ${s(total)} of work (${names.map((x, i) => (t[i + 1] !== undefined ? `${x} ${s(t[i + 1]!)}` : '')).filter(Boolean).join(', ')}), plus ${SITE_STEP_MS / 1000} s between steps and any wait for free AI room.`;
}

/** One step of a site project (projects.ts runs it from the alarm and files the result). */
export async function runSiteStep(deps: ProjectDeps, p: Project, step: ProjectStep): Promise<{ text: string; sources: string[] }> {
  const job = await loadSiteJob(deps, p.id);
  if (!job) throw new Error('the website project lost its brief — start it again');
  const n = step.n;
  if (n > 1 && !job.plan && n !== 2) throw new Error('the plan is missing — run the earlier steps again');
  const t0 = Date.now();
  let text = n === 1 ? await stepBrief(deps, job) : n === 2 ? await stepPlan(deps, job) : n === 3 ? await stepWords(deps, job) : n === 4 ? await stepBuild(deps, job) : n === 5 ? await stepLook(deps, job) : await stepPolish(deps, job);
  // The stopwatch: each step's own work, kept in the job; the report ends with the total.
  job.timings = { ...job.timings, [n]: Date.now() - t0 };
  await saveJob(deps, job);
  if (n === SITE_STEPS.length) {
    // (after the link, the pages and the checks: the report is kept to 1,200 characters, so not at the very end)
    const lines = text.split('\n');
    lines.splice(3, 0, buildTime(job.timings));
    text = lines.join('\n');
  }
  return { text, sources: job.link ? [job.link] : [] };
}
