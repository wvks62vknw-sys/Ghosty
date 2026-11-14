/**
 * THE DIY JOBS panel (NEXT ROUND, make.s3) on the Workbench's PROJECTS section: pick a job (or say it: "put up a shelf"), give
 * its few numbers, and get the load check first (the Workbench's own card and curve for a shelf or a pole; each fixing's share
 * for every job), then the tools, the materials with typical prices, and the steps. The job and its numbers are kept on this
 * phone (`ghosty.workbench.diy`). The sums are diyjobs.ts.
 */
import { clear, h } from '../../core/dom';
import { curveOf } from '../../../../../packages/shared/src/workbench/curves';
import { button, panel } from '../../ui/components';
import { estimateCard, labelRow } from './card';
import { DIY_NOTE, JOBS, planJob, type JobId, type JobIn, type JobPlan, type Wall } from './diyjobs';

const KEY = 'ghosty.workbench.diy';

interface Kept {
  job: JobId;
  v: Partial<Record<JobId, JobIn>>;
}

const FIELDS: Record<JobId, { key: keyof JobIn; label: string; unit: string }[]> = {
  shelf: [
    { key: 'length', label: 'Length', unit: 'm' },
    { key: 'depth', label: 'Depth', unit: 'mm' },
    { key: 'thick', label: 'Board thickness', unit: 'mm' },
    { key: 'count', label: 'Brackets', unit: '' },
    { key: 'kg', label: 'Load a metre', unit: 'kg' },
  ],
  pole: [
    { key: 'length', label: 'Length', unit: 'm' },
    { key: 'thick', label: 'Pole thickness', unit: 'mm' },
    { key: 'count', label: 'Brackets', unit: '' },
    { key: 'kg', label: 'Curtains', unit: 'kg' },
  ],
  tv: [
    { key: 'kg', label: 'The TV', unit: 'kg' },
    { key: 'count', label: 'Fixings', unit: '' },
  ],
  picture: [
    { key: 'kg', label: 'Its weight', unit: 'kg' },
    { key: 'count', label: 'Hooks', unit: '' },
  ],
};

/** What the panel shows, for the specs (window.__ghosty.workbench.diy). */
export const diyState = { job: 'shelf' as JobId, plan: null as JobPlan | null };

function load(): Kept {
  try {
    const k = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Kept | null;
    if (k && JOBS.some((j) => j.id === k.job) && k.v && typeof k.v === 'object') return k;
  } catch {
    /* nothing kept */
  }
  return { job: 'shelf', v: {} };
}

export function diyPanel(): { el: HTMLElement; open(job: JobId | null): void } {
  const pn = panel('DIY JOBS', { cls: 'wb.wb-diy', grow: false });
  const kept = load();
  const keep = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(kept));
    } catch {
      /* kept for this visit */
    }
  };
  const chips = h('div.row.wrap.wbdiyjobs', { role: 'tablist', 'aria-label': 'The job' });
  const form = h('div.wbform');
  const out = h('div.wbdiyout', { 'aria-live': 'polite' });
  pn.body.append(h('p.note', 'Say “put up a shelf”, or pick a job: the load check, the tools, the materials and the steps.'), chips, form, out);

  const v = () => (kept.v[kept.job] ??= {});
  function paint(): void {
    clear(chips, ...JOBS.map((j) => {
      const b = button(j.label, () => {
        kept.job = j.id;
        keep();
        paint();
      }, j.id === kept.job ? 'on' : '');
      b.dataset.job = j.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(j.id === kept.job));
      return b;
    }));
    const d = JOBS.find((j) => j.id === kept.job)!.defaults;
    const rows: HTMLElement[] = FIELDS[kept.job].map((f) => {
      const id = `wb-diy-${kept.job}-${f.key}`;
      const box = h('input', { id, type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: String(d[f.key]), 'aria-label': f.unit ? `${f.label}, in ${f.unit}` : f.label });
      const now = v()[f.key];
      box.value = typeof now === 'number' ? String(now) : '';
      box.addEventListener('input', () => {
        const n = Number(box.value.replace(',', '.'));
        if (box.value.trim() === '') delete v()[f.key];
        else if (Number.isFinite(n) && n > 0) (v() as Record<string, number>)[f.key] = n;
        else return;
        keep();
        answer();
      });
      return h('div.wbf', { dataset: { key: f.key } }, h('label', { htmlFor: id }, f.label), box, h('span.wbu', { 'aria-hidden': 'true' }, f.unit));
    });
    const wallId = `wb-diy-${kept.job}-wall`;
    const wall = h('select', { id: wallId, 'aria-label': 'The wall' }, h('option', { value: 'masonry' }, 'Brick or block'), h('option', { value: 'stud' }, 'Plasterboard on studs'), h('option', { value: 'plasterboard' }, 'Plasterboard alone'));
    wall.value = v().wall ?? d.wall;
    wall.addEventListener('change', () => {
      v().wall = wall.value as Wall;
      keep();
      answer();
    });
    rows.push(h('div.wbf', { dataset: { key: 'wall' } }, h('label', { htmlFor: wallId }, 'The wall'), wall, h('span.wbu', { 'aria-hidden': 'true' }, '')));
    clear(form, ...rows);
    answer();
  }
  function answer(): void {
    const p = planJob(kept.job, v());
    diyState.job = kept.job;
    diyState.plan = p;
    const fix = h('div.wbcard.wbdiyfix', { role: 'group', 'aria-label': 'The fixings, first estimate, not certified' },
      labelRow(),
      h('div.wbtitle', 'The fixings'),
      h('div.wblines', ...p.fixing.lines.map((l) => h('div.wbline', h('span.k', h('span', l.label)), h('span.v', l.value)))),
      h('p.wbcaveat', 'With a margin of two. The fixing’s own packet says what it holds: choose one rated for at least this.'),
    );
    clear(out,
      h('div.wbdiytitle', p.title),
      ...(p.beam ? [estimateCard(p.beam.estimate, curveOf(p.beam.estimate, p.beam.raw))] : []),
      fix,
      h('div.lab', 'TOOLS'),
      h('ul.wbdiylist', ...p.tools.map((t) => h('li', t))),
      h('div.lab', 'MATERIALS'),
      h('div.wbdiymats', ...p.materials.map((m) => h('div.spaceprice', h('span.k', h('span', m.what), h('small', m.qty)), h('span.v', m.gbp != null ? `£${m.gbp.toFixed(2).replace(/\.00$/, '')}` : '')))),
      h('div.lab', 'STEPS'),
      h('ol.wbdiylist', ...p.steps.map((s) => h('li', s))),
      ...(p.assumed.length ? [h('p.note', `Taken as: ${p.assumed.join('; ')}. Change any number above.`)] : []),
      h('p.note.wbdiynote', DIY_NOTE),
    );
  }
  paint();
  return {
    el: pn.el,
    open(job) {
      if (job) {
        kept.job = job;
        keep();
      }
      paint();
    },
  };
}
