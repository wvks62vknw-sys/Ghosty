/**
 * NEW ABILITIES GO HERE. Ghosty may edit this file freely.
 *
 * Add tools to `extraTools` (define them here, or in a new file and import them).
 * They are registered automatically by tools/index.ts. A tool whose name clashes with a
 * built-in tool is ignored, so core tools such as ship_change can't be replaced.
 *
 * Example:
 *   import { arg, type Tool } from './types';
 *   export const extraTools: Tool[] = [{
 *     name: 'dad_joke', description: 'Fetch a random dad joke.',
 *     parameters: { type: 'object', properties: {} }, risk: 'auto',
 *     async run() { const r = await fetch('https://icanhazdadjoke.com/', { headers: { Accept: 'text/plain' } }); return r.text(); },
 *   }];
 */
import type { Tool } from './types';

import { detect_crime } from './detect_crime';
import { stageById, STAGE_IDS, SUBJECT_LABEL, weakSpots, type StageId } from '../../../../packages/shared/src/school';
import { hasPapers, stageName } from '../school/papers';
import { latestFor, loadState } from '../school/state';

/** SCHOOL (apps/edge/src/school): "how's school going?" — his stage, what he passed, this stage's grades, weak spots. */
const school_status: Tool = {
  name: 'school_status',
  description: "How the offline brain (the model on the owner's phone) is doing at school: his stage, stages passed, grades, weak spots.",
  parameters: { type: 'object', properties: {} },
  risk: 'auto',
  pure: true,
  async run(_args, ctx) {
    const st = await loadState({ env: ctx.env, storage: ctx.storage });
    const stage = stageById(st.stage)!;
    const latest = latestFor(st.results, st.stage);
    const passed = STAGE_IDS.filter((id) => st.passed[id]).map((id) => `${stageName(id)}${st.passed[id]!.placement ? ' (placement)' : ''}`);
    const grades = stage.subjects.map((s) => `${SUBJECT_LABEL[s] ?? s}: ${latest[s] ? `${latest[s]!.grade}, ${latest[s]!.raw}/${latest[s]!.max}${latest[s]!.marked.pending ? ' (marks pending)' : latest[s]!.top ? ' ✓' : ''}` : 'not sat'}`);
    const weak = weakSpots(st.results, 3).map((w) => `${w.topic} (${stageName(w.stage)} ${(SUBJECT_LABEL[w.subject] ?? w.subject).toLowerCase()}: lost ${w.lost} of ${w.of})`);
    return [
      `Now at ${stage.label} (${stage.years}). To move up: ${stage.pass}.${hasPapers(st.stage) ? '' : ' Papers for this stage are not written yet.'}`,
      `Passed: ${passed.length ? passed.join(', ') : 'nothing yet'}.`,
      `This stage: ${grades.join('; ')}.`,
      weak.length ? `Weak spots: ${weak.join('; ')}.` : '',
      `Papers sat: ${st.results.length}. Nightly school report: ${st.nightly ? 'on' : 'off'}. The SCHOOL tab on the phone has the report card.`,
    ].filter(Boolean).join('\n');
  },
};

/** The exam runs on the phone's own model, which the brain cannot reach: this says where to start it. */
const sit_exam: Tool = {
  name: 'sit_exam',
  description: "Start a school exam for the offline brain. It runs on the owner's phone, so this says how (SCHOOL tab). Any stage may be sat as a placement test.",
  parameters: { type: 'object', properties: { stage: { type: 'string', description: 'nursery, reception, ks1, ks2, …' }, subject: { type: 'string' } } },
  risk: 'auto',
  pure: true,
  async run(args, ctx) {
    const st = await loadState({ env: ctx.env, storage: ctx.storage });
    const want = String(args.stage ?? '').trim().toLowerCase();
    const id = (STAGE_IDS.find((s) => s === want || stageById(s)!.label.toLowerCase().startsWith(want)) ?? (want ? null : st.stage)) as StageId | null;
    if (!id) return `No stage called "${want}". The stages: ${STAGE_IDS.map((s) => stageById(s)!.label).join(', ')}.`;
    const stage = stageById(id)!;
    const sub = String(args.subject ?? '').trim().toLowerCase();
    const subject = sub ? stage.subjects.find((s) => s === sub || (SUBJECT_LABEL[s] ?? '').toLowerCase().startsWith(sub)) : undefined;
    if (sub && !subject) return `${stage.label} has no subject "${sub}". Its subjects: ${stage.subjects.map((s) => SUBJECT_LABEL[s] ?? s).join(', ')}.`;
    if (!hasPapers(id)) return `Papers for ${stageName(id)} are not written yet (so far: nursery to Key Stage 2).`;
    const what = subject ? `SIT next to ${SUBJECT_LABEL[subject]}` : 'SIT THE EXAM (every subject in turn)';
    const placement = STAGE_IDS.indexOf(id) > STAGE_IDS.indexOf(st.stage) ? ` It is above his stage (${stageName(st.stage)}), so it is a placement test: SIT A PLACEMENT TEST, pick ${stage.label}. If he gets top grades in every subject, that stage and everything below it is done at once.` : '';
    return `Exams run on the offline brain on the owner's phone, which I cannot reach from here. Open the SCHOOL tab on the phone (open_tab school) and press ${what} for ${stage.label}; keep Ghosty open while he sits it.${placement}`;
  },
};

// The transit, motorway, recon and reverse-image tools live in tools/index.ts as their own
// keyword-gated groups (their descriptions on every turn would cost more than a free model's
// per-minute allowance is worth). Tools here are described on every turn.
export const extraTools: Tool[] = [detect_crime];

/**
 * SCHOOL's two tools, kept out of `extraTools` on purpose: everything there is described on every turn, and a plain
 * chat turn's tool descriptions are already at their budget (apps/edge/test/prompt.test.mjs). They go live as their
 * own keyword-gated group in tools/index.ts (protected), like the transit and recon groups.
 */
export const schoolTools: Tool[] = [school_status, sit_exam];
