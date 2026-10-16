/**
 * Reverse engineering with REA (Reverse Engineer Anything, github.com/morluto/rea, MIT).
 * REA needs a computer with Node and a browser, so the brain runs it on GitHub's free runners
 * (.github/workflows/reverse.yml) and reads the report back from the `reports` branch.
 *
 * Works from a phone: the owner gives Ghosty a link, Ghosty starts the job, checks on it
 * a few minutes later and sends the findings as a push notification.
 *
 * Lawful research only: the owner is responsible for having the right to analyse a target.
 */
import type { Env } from '../env';
import { durableGet, durablePut } from '../kv';
import { addJob } from '../schedule';
import { arg, type Tool, type ToolContext } from './types';

export interface ReverseJob {
  id: string;
  target: string;
  kind: string;
  question: string;
  at: number;
  status: 'queued' | 'running' | 'done' | 'failed';
  runId?: number;
  runUrl?: string;
  /** The report (markdown) once finished. */
  report?: string;
  summary?: string;
  error?: string;
  finishedAt?: number;
}

const KEY = 'reverse.jobs';
const MAX_JOBS = 40;
const KINDS = ['auto', 'web', 'npm', 'repo', 'artifact'];

/** The job list lives in the database AND in KV, so REA keeps working while the database is paused. */
export async function loadReverseJobs(env: Pick<Env, 'SITES'> | undefined, storage: DurableObjectStorage): Promise<ReverseJob[]> {
  return (await durableGet<ReverseJob[]>(env, storage, KEY)) ?? [];
}

async function saveJobs(env: Pick<Env, 'SITES'> | undefined, storage: DurableObjectStorage, jobs: ReverseJob[]): Promise<void> {
  await durablePut(env, storage, KEY, jobs.slice(-MAX_JOBS));
}

/** A target is a URL, an npm package name or owner/repo. */
export function normaliseTarget(raw: string): { target: string; kind: string } | null {
  const t = raw.trim();
  if (!t || t.length > 400 || /\s/.test(t)) return null;
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname) || !u.hostname.includes('.')) return null;
      return { target: u.href, kind: 'auto' };
    } catch {
      return null;
    }
  }
  if (/^[\w.-]+\/[\w.-]+$/.test(t)) return { target: t, kind: 'repo' };
  // "example.com" or "shop.example.co.uk/path" → a website; "lodash.merge" → an npm package
  if (/^[\w-]+(\.[\w-]+)*\.(com|net|org|io|co|uk|de|fr|es|it|nl|se|no|fi|dk|pl|ch|at|eu|app|dev|ai|me|info|xyz|gov|edu|ac|tv|cc|us|ca|au|nz|in|jp|kr|br|mx|ru|cn|hk|sg|ie|tech|site|online|store|cloud|page)(\/.*)?$/i.test(t)) {
    return { target: `https://${t}`, kind: 'web' };
  }
  if (/^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(t)) return { target: t, kind: 'npm' };
  return null;
}

/** Start a run. Returns the job (status queued). */
export async function startReverse(ctx: ToolContext, raw: string, kind = 'auto', question = ''): Promise<ReverseJob> {
  const g = await ctx.github();
  if (!g) throw new Error('reverse engineering runs on GitHub: add the GitHub token in the System tab first');
  const n = normaliseTarget(raw);
  if (!n) throw new Error('give a public https:// link, an npm package name or owner/repo');
  const k = KINDS.includes(kind) ? kind : 'auto';
  const id = `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await g.dispatchWorkflow('reverse.yml', { job: id, target: n.target, kind: k === 'auto' ? n.kind : k, question: question.slice(0, 500) });
  const job: ReverseJob = { id, target: n.target, kind: k === 'auto' ? n.kind : k, question: question.slice(0, 500), at: Date.now(), status: 'queued' };
  const jobs = await loadReverseJobs(ctx.env, ctx.storage);
  jobs.push(job);
  await saveJobs(ctx.env, ctx.storage, jobs);
  return job;
}

/** Refresh one job from GitHub; loads the report when the run has finished. */
export async function refreshReverse(ctx: ToolContext, id: string): Promise<ReverseJob | null> {
  const jobs = await loadReverseJobs(ctx.env, ctx.storage);
  const job = jobs.find((j) => j.id === id);
  if (!job) return null;
  if (job.status === 'done' || job.status === 'failed') return job;
  const g = await ctx.github();
  if (!g) return job;
  const run = await g.findRun('reverse.yml', `reverse ${id}`);
  if (run) {
    job.runId = run.id;
    job.runUrl = run.url;
    if (run.status === 'completed') {
      const md = await g.read(`reverse/${id}/report.md`, 'reports');
      if (md) {
        job.status = 'done';
        job.report = md.slice(0, 400_000);
        job.finishedAt = Date.now();
      } else {
        job.status = 'failed';
        job.error = run.conclusion === 'success' ? 'the run finished but wrote no report' : `the run ${run.conclusion ?? 'failed'} (see ${run.url})`;
        job.finishedAt = Date.now();
      }
    } else job.status = 'running';
  } else if (Date.now() - job.at > 15 * 60_000) {
    job.status = 'failed';
    job.error = 'GitHub never started the run (is the reverse workflow in the repository, and does the token have Actions access?)';
    job.finishedAt = Date.now();
  }
  await saveJobs(ctx.env, ctx.storage, jobs);
  return job;
}

const describe = (j: ReverseJob) => `${j.id} · ${j.target} · ${j.kind} · ${j.status}${j.error ? ` (${j.error})` : ''}`;

export const reverseTools: Tool[] = [
  {
    name: 'reverse_engineer',
    description:
      'Reverse-engineer software with REA on GitHub\'s runners: a website (structure, scripts, frameworks, API endpoints, security headers, web bundle), an npm package, a public GitHub repository (owner/repo), or a direct link to a file (.apk, .dll, .exe, .zip, .asar, .jar). Takes 3–8 minutes; the findings arrive as a notification and in the Reverse tab. Only for software the owner owns or is allowed to test.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'https:// link, npm package name, or owner/repo' },
        kind: { type: 'string', enum: KINDS, description: 'auto unless the owner says otherwise' },
        question: { type: 'string', description: 'what the owner wants to find out (shapes the summary)' },
      },
      required: ['target'],
    },
    risk: 'confirm',
    async run(a, ctx) {
      const job = await startReverse(ctx, arg.str(a, 'target'), arg.str(a, 'kind', false) || 'auto', arg.str(a, 'question', false));
      // Come back in a few minutes and tell the owner what was found.
      try {
        await addJob(ctx.storage, {
          kind: 'task',
          title: `Reverse: ${job.target.slice(0, 60)}`,
          text: `Call reverse_status with job "${job.id}". If it is still running, call it again after wait_minutes (up to 3 times). When the report is in, write the owner a clear summary of the most useful findings${job.question ? ` with their question in mind: "${job.question}"` : ''} — what the software is built with, what it talks to, anything surprising — in under 200 words. If it failed, say why in one line.`,
          next: Date.now() + 6 * 60_000,
          tz: 'UTC',
        });
      } catch {
        /* the owner can still ask */
      }
      return `Started reverse-engineering job ${job.id} for ${job.target} (${job.kind}) on GitHub. It takes 3–8 minutes; I will check it and send a notification with the findings. The owner can also watch it in the Reverse tab.`;
    },
  },
  {
    name: 'reverse_status',
    description: 'Check a reverse-engineering job (or the latest one) and read its report when finished.',
    parameters: { type: 'object', properties: { job: { type: 'string', description: 'job id; omit for the latest' }, section: { type: 'string', description: 'optional: only the section whose title contains this' } } },
    risk: 'auto',
    async run(a, ctx) {
      const jobs = await loadReverseJobs(ctx.env, ctx.storage);
      const want = arg.str(a, 'job', false);
      const j0 = want ? jobs.find((j) => j.id === want) : jobs[jobs.length - 1];
      if (!j0) return 'No reverse-engineering jobs yet.';
      const j = (await refreshReverse(ctx, j0.id)) ?? j0;
      if (j.status !== 'done') return `Job ${describe(j)}. ${j.status === 'running' || j.status === 'queued' ? `Started ${Math.round((Date.now() - j.at) / 60000)} min ago${j.runUrl ? `, ${j.runUrl}` : ''}.` : ''}`;
      const sec = arg.str(a, 'section', false).toLowerCase();
      let text = j.report ?? '';
      if (sec) {
        const parts = text.split(/\n(?=## )/);
        text = parts.filter((p) => p.toLowerCase().startsWith(`## ${sec}`) || p.toLowerCase().includes(sec)).join('\n') || `no section containing "${sec}"; sections: ${parts.map((p) => p.split('\n')[0]).join(' | ')}`;
      }
      return `Report for ${j.target} (${j.kind}, ${Math.round(text.length / 1000)}k chars${text.length > 9000 ? ', truncated here — ask for a section by name' : ''}):\n${text.slice(0, 9000)}`;
    },
  },
  {
    name: 'reverse_jobs',
    description: 'List reverse-engineering jobs and their status.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const jobs = await loadReverseJobs(ctx.env, ctx.storage);
      return jobs.length ? jobs.slice(-15).reverse().map(describe).join('\n') : 'No reverse-engineering jobs yet.';
    },
  },
];
