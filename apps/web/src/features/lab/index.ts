/**
 * THE LAB (BRIEF-OCT-IDEAS-3 item 4; MAKE): experiments on free public data, each kept as a page with its question, its source, a chart
 * and a table, what it showed and the date it was run (further/lab.ts). RUN IT AGAIN reads the source again and the date moves; EXPORT
 * builds the page as a document of its own, as a website draft does, and saves it: nothing is posted. Five are there from the start, so
 * the tab is never empty; a page that has never run is run once when the Lab first opens. Every wait says what for; a source that
 * does not answer says so and leaves the last run as it was.
 */
import { clear, h, svgEl } from '../../core/dom';
import { screenSays } from '../../shell/awareness';
import type { TabDef } from '../../shell/tabs';
import { button, empty, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { barsSvg, EXPERIMENTS, labWhy, loadLab, pageHtml, ranWords, saveLab, type Experiment, type LabBar, type LabResult } from '../../further/lab';

export const LAB_ICON = '<path d="M9.5 3.5h5M10.5 3.5v5.2L5 18.2a1.6 1.6 0 001.4 2.3h11.2a1.6 1.6 0 001.4-2.3l-5.5-9.5V3.5"/><path d="M7.8 14.5h8.4"/>';

/** What a test can read (window.__ghosty.lab). */
export const labState = { pages: [] as { id: string; ran: number; running: boolean; error: string }[] };

/** A bar chart drawn in the tokens (the accent for the bars, the ink for the words); a negative bar hangs below the zero line. */
function chart(bars: LabBar[], unit: string): SVGSVGElement {
  const w = 560;
  const hgt = 170;
  const svg = svgEl('svg', { viewBox: `0 0 ${w} ${hgt}`, class: 'labsvg', role: 'img', 'aria-label': `Chart: ${bars.map((b) => `${b.label} ${b.v}`).join(', ')}${unit ? `, ${unit}` : ''}` });
  const lo = Math.min(0, ...bars.map((b) => b.v));
  const hi = Math.max(0, ...bars.map((b) => b.v));
  const span = hi - lo || 1;
  const gap = 8;
  const bw = Math.max(6, (w - gap * (bars.length + 1)) / bars.length);
  const zero = hgt - 24 - ((0 - lo) / span) * (hgt - 48);
  bars.forEach((b, i) => {
    const x = gap + i * (bw + gap);
    const y1 = hgt - 24 - ((b.v - lo) / span) * (hgt - 48);
    svg.append(svgEl('rect', { x: x.toFixed(1), y: Math.min(y1, zero).toFixed(1), width: bw.toFixed(1), height: Math.max(1, Math.abs(zero - y1)).toFixed(1), class: 'labbar' }));
    const t1 = svgEl('text', { x: (x + bw / 2).toFixed(1), y: String(hgt - 6), 'text-anchor': 'middle', class: 'labtx' });
    t1.textContent = b.label;
    const t2 = svgEl('text', { x: (x + bw / 2).toFixed(1), y: (Math.min(y1, zero) - 4).toFixed(1), 'text-anchor': 'middle', class: 'labtx v' });
    t2.textContent = String(b.v);
    svg.append(t1, t2);
  });
  return svg;
}

export const labTab: TabDef = {
  id: 'lab',
  title: 'LAB',
  icon: LAB_ICON,
  scene: 'backdrop',
  // inside the Workshop (Make → Workshop → THE LAB: three taps; "the lab" in the jump bar: one word): the Scan's rooms hold eight things at most
  inside: 'workshop',
  blurb: 'experiments on free public data · each kept as a page',
  now: () => {
    const kept = Object.keys(loadLab().pages).length;
    return kept ? `${kept} of ${EXPERIMENTS.length} run` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'MAKE // THE LAB', sub: 'Questions I can answer from free public data: each one a page I keep, run again whenever you like.', stack: true });
    root.classList.add('labpg');
    P.big.dataset.case = 'keep';
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.lab = labState;
    const pn = panel('EXPERIMENTS', { grow: false, status: `${EXPERIMENTS.length} PAGES` });
    P.left.append(pn.el);
    P.right.hidden = true;
    (P.big.parentElement?.querySelector('.swap') as HTMLElement | null)?.setAttribute('hidden', '');
    P.big.textContent = `${EXPERIMENTS.length} experiments`;

    const store = loadLab();
    const running = new Set<string>();
    const errors = new Map<string, string>();
    const cards = new Map<string, HTMLElement>();

    const paintCard = (e: Experiment) => {
      const card = cards.get(e.id)!;
      const r = store.pages[e.id] ?? null;
      const busy = running.has(e.id);
      const said = errors.get(e.id) ?? '';
      const again = button(busy ? 'READING…' : r ? 'RUN IT AGAIN' : 'RUN IT', () => void runOne(e), r ? '' : 'on');
      again.dataset.act = 'again';
      again.dataset.case = 'keep';
      again.disabled = busy;
      const exp = button('EXPORT', () => doExport(e));
      exp.dataset.act = 'export';
      exp.dataset.case = 'keep';
      exp.disabled = !r;
      const date = h('small.labdate', { dataset: { ran: String(r?.ran ?? 0), case: 'keep' } }, r ? `Run ${ranWords(r.ran)}` : 'Not run yet');
      const showed = busy && !r ? `Reading the source for you…` : r ? r.showed : said || 'Not run yet. RUN IT and I read the source and tell you what it showed.';
      clear(
        card,
        h('b.labq', e.question),
        h('p.labsrc', e.source),
        r?.bars?.length ? h('div.labchart', chart(r.bars, r.unit ?? ''), r.unit ? h('small.labunit', r.unit) : null) : null,
        r?.rows.length ? h('div.labtable', ...r.rows.map(([a, b]) => h('div.labrow', h('span', a), h('b', b)))) : null,
        h('p.labshowed', showed),
        said && r ? h('p.laberr', { role: 'status' }, `${said} This is the last run.`) : busy && r ? h('p.laberr', { role: 'status' }, 'Reading the source again…') : null,
        h('small.labcaveat', e.caveat),
        date,
        h('div.row.wrap', again, exp),
      );
      labState.pages = EXPERIMENTS.map((x) => ({ id: x.id, ran: store.pages[x.id]?.ran ?? 0, running: running.has(x.id), error: errors.get(x.id) ?? '' }));
    };

    async function runOne(e: Experiment): Promise<void> {
      if (running.has(e.id)) return;
      running.add(e.id);
      errors.delete(e.id);
      paintCard(e);
      try {
        const r: LabResult = await e.run(store.pages[e.id] ?? null, Date.now());
        store.pages[e.id] = r;
        saveLab(store);
      } catch (err) {
        errors.set(e.id, labWhy(err));
      } finally {
        running.delete(e.id);
        paintCard(e);
      }
    }

    function doExport(e: Experiment): void {
      const r = store.pages[e.id];
      if (!r) return;
      try {
        const blob = new Blob([pageHtml(e, r)], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = h('a', { href: url, download: `lab-${e.id}.html` });
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
        toast(`Saved lab-${e.id}.html: a page of its own. Nothing was posted.`, 'ok');
      } catch {
        toast('I couldn’t build that page just now. Try again.', 'bad');
      }
    }

    for (const e of EXPERIMENTS) {
      const card = h('article.labpage', { dataset: { id: e.id } });
      cards.set(e.id, card);
      pn.body.append(card);
      paintCard(e);
    }
    if (!EXPERIMENTS.length) pn.body.append(empty('NONE'));
    let first = true;
    return {
      enter() {
        pn.setStatus(`${EXPERIMENTS.length} PAGES`, 'ok');
        if (!first) return;
        first = false;
        // a page that has never run is run once (one at a time, gently); one that has is left until he taps RUN IT AGAIN
        void (async () => {
          for (const e of EXPERIMENTS) if (!store.pages[e.id]) await runOne(e);
        })();
      },
      context: () => screenSays('lab', 'The lab', `the lab, ${Object.keys(store.pages).length} of ${EXPERIMENTS.length} pages run`),
    };
  },
};
