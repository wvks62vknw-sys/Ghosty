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
import { arg, type Tool } from './types';

import { detect_crime } from './detect_crime';
import { summariseVideo } from '../integrations/youtube';
import { tutorDepsFor } from '../tutor';
import { stageById, STAGE_IDS, SUBJECT_LABEL, weakSpots, type StageId } from '../../../../packages/shared/src/school';
import { stageName } from '../school/papers';
import { gapBySubject, loadRemote, ONLINE_LABEL, remoteView } from '../school/remote';
import { sourcesFor } from '../school/routes';
import { latestFor, loadState } from '../school/state';
import { isBankStage } from '../school/banks';

const subjectWord = (s: string) => (SUBJECT_LABEL[s] ?? s).toLowerCase();

/**
 * SCHOOL (apps/edge/src/school): "how's school going?" — his stage, what he passed, this stage's grades and where its
 * papers come from (official, his checked question bank, written by Ghosty), weak spots, the paper on the free GPU
 * and the honest gap with the strongest free online model.
 */
const school_status: Tool = {
  name: 'school_status',
  description: "How the offline brain (the model on the owner's phone) is doing at school: his stage, passes, grades, papers, weak spots, the gap.",
  parameters: { type: 'object', properties: {} },
  risk: 'auto',
  pure: true,
  async run(_args, ctx) {
    const st = await loadState({ env: ctx.env, storage: ctx.storage });
    const stage = stageById(st.stage)!;
    const latest = latestFor(st.results, st.stage);
    // Where each subject's next paper comes from (an official paper, his checked bank, Ghosty's own), or none yet.
    const src = (await sourcesFor({ env: ctx.env, storage: ctx.storage }, st).catch(() => null))?.[st.stage] ?? {};
    const none = stage.subjects.filter((s) => !src[s]?.source);
    const from = new Map<string, string[]>();
    for (const s of stage.subjects) if (src[s]?.source) from.set(src[s]!.line, [...(from.get(src[s]!.line) ?? []), subjectWord(s)]);
    const papers = !none.length
      ? `Papers: ${from.size === 1 ? `every subject ${[...from.keys()][0]}` : [...from].map(([line, subs]) => `${subs.join(', ')} ${line}`).join('; ')}.`
      : none.length === stage.subjects.length
        ? `Papers for this stage are not written yet${isBankStage(st.stage) ? ': WRITE THE PAPERS on the SCHOOL tab writes its question banks' : ''}.`
        : `Not written yet: ${none.map(subjectWord).join(', ')}; the rest can be sat.`;
    const gap = Object.values(gapBySubject(st)).map((g) => `${SUBJECT_LABEL[g.subject] ?? g.subject} ${g.line}`);
    const remote = await loadRemote(ctx.storage).catch(() => null);
    const passed = STAGE_IDS.filter((id) => st.passed[id]).map((id) => `${stageName(id)}${st.passed[id]!.placement ? ' (placement)' : ''}`);
    const grades = stage.subjects.map((s) => `${SUBJECT_LABEL[s] ?? s}: ${latest[s] ? `${latest[s]!.grade}, ${latest[s]!.raw}/${latest[s]!.max}${latest[s]!.marked.pending ? ' (marks pending)' : latest[s]!.top ? ' ✓' : ''}` : 'not sat'}`);
    const weak = weakSpots(st.results, 3).map((w) => `${w.topic} (${stageName(w.stage)} ${(SUBJECT_LABEL[w.subject] ?? w.subject).toLowerCase()}: lost ${w.lost} of ${w.of})`);
    return [
      `Now at ${stage.label} (${stage.years}). To move up: ${stage.pass}.`,
      papers,
      `Passed: ${passed.length ? passed.join(', ') : 'nothing yet'}.`,
      `This stage: ${grades.join('; ')}.`,
      weak.length ? `Weak spots: ${weak.join('; ')}.` : '',
      gap.length ? `The gap with ${ONLINE_LABEL} on the same paper: ${gap.join('; ')}.` : '',
      remote && remote.phase !== 'idle' ? `On the free GPU now: ${remoteView(remote, Date.now()).note}` : '',
      `Papers sat: ${st.results.length}. Nightly school report: ${st.nightly ? 'on' : 'off'}. The SCHOOL tab on the phone has the report card.`,
    ].filter(Boolean).join('\n');
  },
};

/** The exam runs on the phone's own model (or the same weights on Kaggle's free GPU), started from SCHOOL: this says how. */
const sit_exam: Tool = {
  name: 'sit_exam',
  description: "Start a school exam for the offline brain: on the owner's phone or the free GPU, from the SCHOOL tab, so this says how. Any stage may be a placement test.",
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
    // Sittable: an official paper, Ghosty's own (nursery to Key Stage 2) or a finished question bank (Key Stage 3 up).
    const src = (await sourcesFor({ env: ctx.env, storage: ctx.storage }, st).catch(() => null))?.[id] ?? {};
    const missing = (subject ? [subject] : stage.subjects).filter((s) => !src[s]?.source);
    if (missing.length === (subject ? 1 : stage.subjects.length)) return `Papers for ${subject ? `${stageName(id)} ${subjectWord(subject)}` : stageName(id)} are not written yet${isBankStage(id) ? `: on the SCHOOL tab, WRITE THE PAPERS (pick ${stage.label} under SIT A PLACEMENT TEST if it is not his stage) has a stronger model write and check its question banks first` : ''}.`;
    const what = subject ? `SIT next to ${SUBJECT_LABEL[subject]}` : 'SIT THE EXAM (every subject in turn)';
    const placement = STAGE_IDS.indexOf(id) > STAGE_IDS.indexOf(st.stage) ? ` It is above his stage (${stageName(st.stage)}), so it is a placement test: SIT A PLACEMENT TEST, pick ${stage.label}. If he gets top grades in every subject, that stage and everything below it is done at once.` : '';
    const gpu = ` Or SIT ON THE FREE GPU beside it: the same brain sits the paper on Kaggle's free GPU in about 10 minutes, with no phone time (it needs the Kaggle key saved in SYSTEM → KEYS).`;
    const part = missing.length ? ` Not written yet: ${missing.map(subjectWord).join(', ')}.` : '';
    return `Exams run on the offline brain on the owner's phone, which I cannot reach from here. Open the SCHOOL tab on the phone (open_tab school) and press ${what} for ${stage.label}; keep Ghosty open while he sits it.${gpu}${placement}${part}`;
  },
};

/** A YouTube link → a plain summary with timestamped moments, filed in the library; quiz: 5 LEARN cards (integrations/youtube.ts). */
const summarise_video: Tool = {
  name: 'summarise_video',
  description: 'A YouTube link: title, length, plain summary, timestamped moments linking back. quiz: true ("quiz me on this") adds 5 LEARN cards. transcript: what the owner pasted when YouTube refused.',
  parameters: { type: 'object', properties: { url: { type: 'string' }, quiz: { type: 'boolean' }, transcript: { type: 'string' } }, required: ['url'] },
  risk: 'auto',
  async run(a, ctx) {
    const deps = await tutorDepsFor(ctx);
    return summariseVideo({ ...deps, progress: ctx.progress }, { url: arg.str(a, 'url'), quiz: arg.bool(a, 'quiz'), transcript: arg.str(a, 'transcript', false) });
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

/**
 * The YouTube tool, kept out of `extraTools` for the same reason (a plain turn's tool descriptions are within 100
 * characters of their 6,500 budget). It goes live as its own keyword-gated group in tools/index.ts (protected):
 * `{ name: 'video', tools: videoTools, when: /\b(youtube|youtu\.be|videos?|transcripts?)\b/i, about: … }`.
 */
export const videoTools: Tool[] = [summarise_video];

/**
 * Saved places (tools/places.ts: remember_place, forget_place) and spending (tools/spending.ts: spending_summary,
 * set_budget), kept out of `extraTools` for the same budget. They go live as two keyword-gated groups in
 * tools/index.ts (protected): `import { placesTools, spendingTools } from './extra';`, `...placesTools,
 * ...spendingTools` in CORE, and the `places` and `spending` groups (the words are in the builder's report).
 * Without them, "take me home" still works: plan_journey and get_directions read the saved places themselves.
 */
export { placesTools } from './places';
