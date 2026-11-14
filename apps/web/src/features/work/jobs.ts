/**
 * JOB APPLICATIONS (THE NEXT ROUND, the money lane; money.s8): each job he applied for, with the day, where it stands (applied,
 * interview, offer, turned down, withdrawn) and a 9am reminder to follow up on the day he picks (the brain's Web Push, so it comes
 * with the phone locked). Kept in his brain (tools/moneyapp.ts `jobs`, POST /packs/do, no model). Nothing is sent to anyone.
 */
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { brain } from '../../api/brain';
import { sayError } from '../../ui/hisWords';
import { emptyState, lacksSignal, phrases, stateIn, stateLine, waitFor } from '../lifeui';

export const JOBS_TITLE = 'JOB APPLICATIONS';
interface JobRow {
  id: string;
  role: string;
  where: string;
  applied: string;
  stage: string;
  follow?: string;
}
const STAGE_SAY: Record<string, string> = { applied: 'Applied', interview: 'Interview', offer: 'Offer', rejected: 'Turned down', withdrawn: 'Withdrawn' };
export const jobsState = { jobs: [] as string[], state: '' };

const nice = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const label = (b: HTMLButtonElement, l: string) => (b.setAttribute('aria-label', l), b);

export function jobsScreen(): { el: HTMLElement; stop(): void } {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  if (w.__ghosty) w.__ghosty.jobs = jobsState;
  const slot = h('div.pkcol', { 'aria-live': 'polite' });
  const status = h('p.pknote', { 'aria-live': 'polite' });
  const today = new Date().toLocaleDateString('en-CA');
  const role = h('input', { type: 'text', placeholder: 'Warehouse supervisor', 'aria-label': 'The role', enterKeyHint: 'next' }) as HTMLInputElement;
  const where = h('input', { type: 'text', placeholder: 'Asda, Leeds', 'aria-label': 'Where (you can leave it)', enterKeyHint: 'next' }) as HTMLInputElement;
  const applied = h('input', { type: 'date', 'aria-label': 'The day you applied', value: today, max: today }) as HTMLInputElement;
  const follow = h('input', { type: 'date', 'aria-label': 'A day to follow up (you can leave it)', min: today }) as HTMLInputElement;
  const run = async (args: Record<string, unknown>): Promise<boolean> => {
    if (lacksSignal()) {
      stateIn(status, 'offline', 'No signal. Try again when the phone is back online.');
      return false;
    }
    try {
      const r = await brain.packDo('work', 'jobs', { today, ...args });
      if (args.op) stateIn(status, '', r.text);
      paint((r.data as { jobs: JobRow[] }).jobs);
      return true;
    } catch (e) {
      stateIn(status, 'error', sayError(e, 'keep that'));
      return false;
    }
  };
  const add = async () => {
    if (!role.value.trim()) return void stateIn(status, '', 'Say the role first, like “warehouse supervisor”.');
    if (await run({ op: 'add', role: role.value.trim(), where: where.value.trim(), applied: applied.value || today, follow: follow.value })) {
      role.value = '';
      where.value = '';
      follow.value = '';
    }
  };
  const form = h('div.pkcol.pkform', h('div.lab', 'ADD AN APPLICATION'), role, where, h('div.pkrow', applied, follow), h('div.pkrow', label(button('Keep it', () => void add(), 'on'), 'Keep this application')));
  const paint = (list: JobRow[]) => {
    jobsState.jobs = list.map((j) => `${j.role} ${j.stage}${j.follow ? ` ${j.follow}` : ''}`);
    jobsState.state = 'ready';
    const open = list.filter((j) => !['rejected', 'withdrawn'].includes(j.stage));
    const closed = list.filter((j) => ['rejected', 'withdrawn'].includes(j.stage));
    const row = (j: JobRow) => {
      const stage = h('select', { 'aria-label': `Where ${j.role} stands` }, ...Object.entries(STAGE_SAY).map(([v, t]) => h('option', { value: v, selected: v === j.stage }, t))) as HTMLSelectElement;
      stage.addEventListener('change', () => void run({ op: 'stage', id: j.id, stage: stage.value }));
      const fu = h('input', { type: 'date', 'aria-label': `A day to follow up on ${j.role}`, min: today, value: j.follow ?? '' }) as HTMLInputElement;
      fu.addEventListener('change', () => fu.value && void run({ op: 'follow', id: j.id, follow: fu.value }));
      const late = j.follow && j.follow < today && !['rejected', 'withdrawn', 'offer'].includes(j.stage);
      return h('div.pkperson.wkjob', { role: 'group', dataset: { id: j.id, stage: j.stage }, 'aria-label': `${j.role}${j.where ? ` at ${j.where}` : ''}, ${STAGE_SAY[j.stage] ?? j.stage}` },
        h('b', j.role),
        h('span.pklab', `${j.where ? `${j.where} · ` : ''}applied ${nice(j.applied)} · ${STAGE_SAY[j.stage] ?? j.stage}${j.follow ? ` · ${late ? 'follow-up was' : 'follow up'} ${nice(j.follow)}` : ''}`),
        h('div.pkrow', stage, fu),
        h('div.pkrow', label(button('Forget', () => void run({ op: 'remove', id: j.id })), `Forget ${j.role}`)));
    };
    slot.replaceChildren(
      ...(list.length
        ? [
            h('p.pknote', { dataset: { case: 'keep' } }, `${open.length} still open, ${list.filter((j) => j.stage === 'interview').length} at interview, ${list.filter((j) => j.stage === 'offer').length} offer${list.filter((j) => j.stage === 'offer').length === 1 ? '' : 's'}.`),
            ...open.map(row),
            ...(closed.length ? [h('div.lab', 'CLOSED'), ...closed.map(row)] : []),
          ]
        /* state: work.jobs empty */
        : [emptyState('No applications yet', 'Add each job you apply for below, with a day to follow up.')]),
    );
  };
  const el = h('div.pkcol', slot, form, status, phrases(['my job applications', 'jobs i applied for']));
  const load = async () => {
    if (lacksSignal()) {
      jobsState.state = 'offline';
      /* state: work.jobs offline */
      slot.replaceChildren(stateLine('offline', 'No signal. Your applications come back when the phone is online.'));
      return;
    }
    /* state: work.jobs loading */
    const done = waitFor(el, 'Opening your applications…');
    try {
      const r = await brain.packDo('work', 'jobs', { today });
      paint((r.data as { jobs: JobRow[] }).jobs);
    } catch (e) {
      jobsState.state = 'error';
      /* state: work.jobs error */
      slot.replaceChildren(stateLine('error', sayError(e, 'read your applications')), h('div.pkrow', label(button('Try again', () => void load()), 'Try reading your applications again')));
    } finally {
      done();
    }
  };
  void load();
  return { el, stop: () => undefined };
}
