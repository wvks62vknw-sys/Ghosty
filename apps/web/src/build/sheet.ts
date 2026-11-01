/**
 * DESIGN A BUILD's sheet (BRIEF-REST-D 1), opened from MAKE (the Studio's pane), from the chat ("design me a shed three by
 * two", "price the roof") and from a reply's buttons. His words in a box, or a kind to start from; the sizes and choices as
 * fields (a change redraws every face); then three sides:
 *  - THE PLAN: the dimensioned drawing (build/plan.ts), read aloud by VoiceOver from its words; SAVE THE PLAN as a PNG;
 *  - THE BILL: every part with its size, count, material and price, the cut list where boards are cut, the fixings counted,
 *    the total with the honest line, PRICE IT LIVE on any line (a shop page he gives becomes a money-pack price watch, so
 *    its number is real and dated; FIND ONE asks my brain for a page with its source), EXPORT as CSV or as text;
 *  - THE BUILD: the order of work, the tools, the hours for one person, the safety lines, the law as rules of thumb.
 * A PC adds its compatibility check and its parts as pickers (a part that cannot fit is refused, with why); a concept shows
 * its real parts and draws nothing. SHOW ME IN 3-D opens the Studio's pane.
 */
import { clear, h } from '../core/dom';
import { button, modal, toast } from '../ui/components';
import { lineTotal, priceFromWatch, toCsv, toText, totals } from './bom';
import { BUILDINGS, FURNITURE, glossFor, KIND_NAMES, planWords, type Design, type Kind, type Line, type Params, type PcSlot } from './kits';
import { PARTS, pickPart, PC_LINE, SLOTS, type PcBuild } from './pc';
import { drawPlan, planPng } from './plan';
import { cutWords, ESTIMATE, PRICE_LINE, pounds } from './prices';
import { buildNow, designNow, exposeBuild, setDesign, type Side } from './state';
import { applyChange, paramsFromWords, startFor } from './words';

let open: { close(): void } | null = null;

const KINDS: Kind[] = ['shed', 'gardenroom', 'garage', 'room', 'shelf', 'desk', 'bench', 'pc'];

/** Save a file the way the phone can: the share sheet, else a download; what it was is kept for the spec. */
async function save(name: string, blob: Blob, kind: string, head: string): Promise<void> {
  buildNow.set({ exported: { kind, bytes: blob.size, head: head.slice(0, 200) } });
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: name }).catch((e: unknown) => {
      if ((e as Error)?.name !== 'AbortError') toast('Could not share it', 'bad');
    });
    return;
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  toast(`Saved ${name}`, 'ok');
}
const fileName = (d: Design, ext: string) => `${d.title.replace(/[^\w ×.,-]+/g, '').replace(/\s+/g, ' ').trim()}.${ext}`;

/** A labelled select. */
function pick<T extends string>(label: string, value: T, options: [T, string][], onSet: (v: T) => void): HTMLElement {
  const s = h('select.buildselect', { 'aria-label': label }, ...options.map(([v, t]) => h('option', { value: v, selected: v === value }, t)));
  s.addEventListener('change', () => onSet(s.value as T));
  return h('label.buildfield', h('span', label), s);
}
function num(label: string, value: number, unit: string, step: string, onSet: (v: number) => void): HTMLElement {
  const i = h('input.buildsize', { type: 'number', inputMode: 'decimal', step, min: '0', value: String(value), 'aria-label': `${label}${unit ? ` in ${unit === 'm' ? 'metres' : unit === '£' ? 'pounds' : unit}` : ''}` });
  i.addEventListener('change', () => {
    const v = Number(i.value);
    if (Number.isFinite(v) && v >= 0) onSet(v);
  });
  return h('label.buildfield', h('span', label), i, unit ? h('small', unit) : null);
}
function tick(label: string, value: boolean, onSet: (v: boolean) => void): HTMLElement {
  const i = h('input', { type: 'checkbox', checked: value, 'aria-label': label });
  i.addEventListener('change', () => onSet(i.checked));
  return h('label.buildtick', i, h('span', label));
}

/** Open the sheet (or bring it to a side, a part group lit, his words designed). */
export function openBuild(o: { side?: Side; lit?: string; words?: string } = {}): void {
  exposeBuild();
  if (o.words) {
    const p = paramsFromWords(o.words);
    if (p) setDesign(p);
  }
  buildNow.set({ ...(o.side ? { side: o.side } : {}), ...(o.lit !== undefined ? { lit: o.lit } : {}) });
  if (open) return;
  const root = h('div.build');
  const wordsIn = h('input.buildwords', { type: 'text', placeholder: 'Say it: “a garden shed 3 m by 2 m”', 'aria-label': 'What to build, in your own words', enterKeyHint: 'go', autocomplete: 'off', maxLength: 200 });
  const wordsNote = h('p.note.buildwordsnote');
  const form = h('form.buildform', { onsubmit: (e: Event) => {
    e.preventDefault();
    const p = paramsFromWords(wordsIn.value);
    if (!p) {
      wordsNote.textContent = 'Say what it is: a shed, a garden room, a garage, a room, a bookshelf, a desk, a bench or a PC; a car, a robot or a TV as a concept.';
      return;
    }
    wordsNote.textContent = '';
    setDesign(p);
  } }, wordsIn, button('DESIGN', () => form.requestSubmit(), 'on'));
  const chips = h('div.buildchips', { role: 'group', 'aria-label': 'Start from' }, ...KINDS.map((k) => {
    const b = button(KIND_NAMES[k].toUpperCase(), () => setDesign(startFor(k)), 'buildkind');
    b.dataset.case = 'keep';
    b.dataset.kind = k;
    return b;
  }));
  const head = h('div.buildhead');
  const fields = h('div.buildfields');
  const tabs = h('div.buildtabs', { role: 'tablist', 'aria-label': 'The plan, the bill, the build' });
  const body = h('div.buildbody');
  const foot = h('div.buildfoot');
  root.append(form, wordsNote, chips, head, fields, tabs, body, foot);

  const change = (c: Partial<Params>) => {
    const p = buildNow.get().params;
    if (p) setDesign(applyChange(p, c));
  };

  const paintFields = (d: Design) => {
    const p = d.params;
    const out: HTMLElement[] = [];
    if (BUILDINGS.includes(d.kind) || FURNITURE.includes(d.kind)) {
      out.push(num(FURNITURE.includes(d.kind) ? 'Width' : 'Width (front)', p.w, 'm', '0.05', (v) => change({ w: v })), num('Depth', p.d, 'm', '0.05', (v) => change({ d: v })), num(d.kind === 'shed' ? 'Height (front)' : 'Height', p.h, 'm', '0.05', (v) => change({ h: v })));
    }
    if (d.kind === 'shed') out.push(pick('Roof', p.roof === 'apex' ? 'apex' : 'pent', [['pent', 'Pent (one slope)'], ['apex', 'Apex (two slopes)']], (v) => change({ roof: v })), pick('Door', p.doors, [['single', 'Single'], ['double', 'Double']], (v) => change({ doors: v })));
    if (d.kind === 'shed' || d.kind === 'gardenroom' || d.kind === 'room' || d.kind === 'garage') out.push(num('Windows', p.windows, '', '1', (v) => change({ windows: Math.round(v) })));
    if (d.kind === 'garage') out.push(pick('Walls', p.walls, [['block', 'Concrete block'], ['timber', 'Timber frame']], (v) => change({ walls: v })));
    if (d.kind === 'gardenroom') out.push(tick('A desk', p.desk, (v) => change({ desk: v })));
    if (d.kind === 'room') out.push(pick('Floor', p.floor, [['carpet', 'Carpet'], ['laminate', 'Laminate']], (v) => change({ floor: v })), pick('Heat', p.heat, [['radiator', 'A radiator'], ['underfloor', 'Underfloor (electric)'], ['none', 'None']], (v) => change({ heat: v })), tick('A wardrobe wall', p.wardrobe, (v) => change({ wardrobe: v })));
    if (FURNITURE.includes(d.kind)) out.push(pick('Wood', p.material, [['pine', 'Pine'], ['mdf', 'MDF'], ['oak', 'Oak'], ['ply', 'Birch plywood']], (v) => change({ material: v })));
    if (d.kind === 'pc') {
      out.push(num('Budget', p.budget, '£', '50', (v) => change({ budget: v })), pick('For', p.use, [['gaming', 'Gaming'], ['editing', 'Editing'], ['school', 'School']], (v) => change({ use: v })));
      const refused = h('p.note.buildrefused', { role: 'status' });
      const build = p.pc as PcBuild;
      for (const s of SLOTS) {
        out.push(pick(s.name, build[s.id], PARTS.filter((x) => x.slot === s.id).map((x) => [x.id, `${x.name}${x.gbp ? ` · £${x.gbp}` : ''}`] as [string, string]), (v) => {
          const r = pickPart(build, s.id as PcSlot, v);
          if ('refused' in r) {
            refused.textContent = `Refused: ${r.refused}`;
            paint();
            refused.textContent = `Refused: ${r.refused}`;
            fields.append(refused);
            return;
          }
          change({ pc: r.build });
          if (r.said) toast(r.said, 'ok');
        }));
      }
    }
    clear(fields, ...out);
  };

  const side = () => buildNow.get().side;
  const paintTabs = (d: Design) => {
    const sides: [Side, string][] = d.concept ? [['bill', 'THE PARTS'], ['build', 'THE BUILD']] : [['plan', 'THE PLAN'], ['bill', 'THE BILL'], ['build', 'THE BUILD']];
    if (d.concept && side() === 'plan') buildNow.set({ side: 'bill' });
    clear(tabs, ...sides.map(([id, label]) => {
      const b = button(label, () => buildNow.set({ side: id }), side() === id ? 'on' : '');
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(side() === id));
      b.dataset.side = id;
      b.dataset.case = 'keep';
      return b;
    }));
  };

  const planSide = (d: Design) => {
    const c = h('canvas.buildplan', { role: 'img', 'aria-label': planWords(d) });
    const box = h('div.buildplanbox', c);
    requestAnimationFrame(() => drawPlan(c, d, Math.max(260, Math.min(720, box.clientWidth || root.clientWidth - 8))));
    return [
      box,
      h('p.note.buildplanwords', planWords(d)),
      button('SAVE THE PLAN (PNG)', async () => {
        const png = await planPng(d);
        if (png) await save(fileName(d, 'png'), png, 'png', planWords(d));
      }, 'buildexport'),
    ];
  };

  const lineRow = (d: Design, l: Line) => {
    const lv = buildNow.get().live[l.id];
    const url = h('input.buildurl', { type: 'url', placeholder: 'A shop page for it (https://…)', 'aria-label': `A shop page for ${l.name}`, inputMode: 'url', autocomplete: 'off', value: lv?.url ?? '' });
    const said = h('small.buildlivenote', { role: 'status' });
    const watch = button('PRICE IT LIVE', async (b) => {
      const u = url.value.trim();
      if (!/^https:\/\//i.test(u)) {
        said.textContent = 'Paste the shop page’s full https:// address first.';
        return;
      }
      b.disabled = true;
      said.textContent = 'Reading the page…';
      try {
        const { brain } = await import('../api/brain');
        const r = await brain.packDo('money', 'watch', { url: u });
        const gbp = priceFromWatch(r.text);
        if (gbp === null) {
          said.textContent = r.text;
          return;
        }
        buildNow.set({ live: { ...buildNow.get().live, [l.id]: { url: u, gbp, at: Date.now() } } });
        toast(`${l.name}: ${pounds(gbp)} from the shop page, watched twice a day`, 'ok');
      } catch {
        said.textContent = 'I couldn’t reach my brain to read the page. Try again when you’re online.';
      } finally {
        b.disabled = false;
      }
    }, 'buildlive');
    watch.setAttribute('aria-label', `Price ${l.name} live from the shop page`);
    const find = button('FIND ONE', async () => {
      const { send } = await import('../assistant/session');
      const { openChat } = await import('../shell/launcher');
      open?.close();
      openChat();
      void send(`Find me a UK shop page with the price of: ${l.name}${l.size ? `, ${l.size}` : ''}. With sources: the link and its price.`);
    });
    find.setAttribute('aria-label', `Ask me to find a shop page for ${l.name}, with its source`);
    const total = lineTotal(l, lv);
    return h('li.buildbomline', { dataset: { line: l.id, group: l.group } },
      h('div.buildbomtop', h('b', l.name), h('span.buildbomprice', pounds(total))),
      h('div.buildbommeta', [l.size, l.material, `${l.n} ${l.unit}`, l.per === 'm' ? `${l.qty.toFixed(1)} m at ${pounds(l.rate)} a metre` : l.rate ? `${pounds(l.rate)} ${l.per === 'each' || l.per === 'job' ? 'each' : `a ${l.per}`}` : ''].filter(Boolean).join(' · ')),
      l.cut ? h('div.buildcut', `Cut list: ${cutWords(l.cut)}`) : null,
      l.note ? h('div.buildbomnote', l.note) : null,
      lv ? h('div.buildlivegot', `Live: ${pounds(lv.gbp)} each, read ${new Date(lv.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · watched twice a day`) : null,
      d.kind === 'pc' && !l.total ? null : h('div.buildliverow', url, watch, find),
      said,
    );
  };

  const billSide = (d: Design) => {
    if (d.concept) {
      return [
        h('p.buildconcept', 'A concept with real parts, not a build plan.'),
        h('ol.buildparts', ...(d.parts ?? []).map((x) => h('li', h('b', x.role), h('span', ` ${x.name}. ${x.why}.`), h('small', ` Typically ${x.typical} (October 2026).`)))),
      ];
    }
    const t = totals(d, buildNow.get().live);
    const lit = buildNow.get().lit;
    const out: (HTMLElement | null)[] = [];
    if (d.compat) out.push(h('ul.buildcompat', { 'aria-label': 'Does it all fit?' }, ...d.compat.map((c) => h(`li.${c.ok ? 'ok' : 'bad'}` as 'li', `${c.ok ? '✓' : '✗'} ${c.text}`))));
    for (const g of d.groups) {
      const ls = d.lines.filter((l) => l.group === g.id);
      if (!ls.length) continue;
      const sum = t.byGroup.find((x) => x.group === g.id)?.total ?? 0;
      out.push(h(`section.buildbomgroup${lit === g.id ? '.lit' : ''}` as 'section', { dataset: { group: g.id }, 'aria-label': `${g.name}: ${pounds(sum)}` }, h('h4', h('span', g.name), h('span', pounds(sum))), h('ul', ...ls.map((l) => lineRow(d, l)))));
    }
    out.push(h('div.buildtotal', h('b', `Total ${pounds(t.total)}`), h('span', d.kind === 'pc' ? PC_LINE : `${PRICE_LINE}${t.liveLines ? `; ${t.liveLines} ${t.liveLines === 1 ? 'line' : 'lines'} priced live from shop pages, dated` : ''}.`), h('span.buildcert', ESTIMATE)));
    out.push(glossBox(d));
    out.push(h('div.row.wrap.buildexports', button('EXPORT CSV', () => void save(fileName(d, 'csv'), new Blob([toCsv(d, buildNow.get().live)], { type: 'text/csv' }), 'csv', toCsv(d, buildNow.get().live)), 'buildexport'), button('EXPORT TEXT', () => void save(fileName(d, 'txt'), new Blob([toText(d, buildNow.get().live)], { type: 'text/plain' }), 'text', toText(d, buildNow.get().live)), 'buildexport')));
    return out;
  };

  /** What the trade words mean, folded away under the bill and the build. */
  const glossBox = (d: Design) => {
    const g = glossFor(d);
    return g.length ? h('details.buildgloss', h('summary', 'WHAT THE WORDS MEAN'), h('dl', ...g.flatMap((x) => [h('dt', x.term), h('dd', x.gloss)]))) : null;
  };

  const buildSide = (d: Design) => [
    ...(d.load ? [h('p.buildload', h('b', 'WHAT IT CARRIES '), d.load)] : []),
    ...(d.heat ? [h('p.buildload', h('b', 'THE HEAT '), d.heat)] : []),
    ...(d.steps.length ? [h('h4', 'THE ORDER OF WORK'), h('ol.buildsteps', ...d.steps.map((s) => h('li', s)))] : []),
    ...(d.tools.length ? [h('h4', 'TOOLS'), h('ul.buildtools', ...d.tools.map((s) => h('li', s)))] : []),
    ...(d.hours ? [h('p.buildtime', h('b', 'TIME '), `About ${d.hours} hours for one person (${Math.max(1, Math.round((d.hours / 7) * 2) / 2)} working days); a second pair of hands for anything heavy.`)] : []),
    ...(d.safety.length ? [h('h4', 'SAFETY'), h('ul.buildsafety', ...d.safety.map((s) => h('li', s)))] : []),
    ...(d.law.length ? [h('h4', 'THE RULES (RULES OF THUMB)'), h('ul.buildlaw', ...d.law.map((l) => h('li', h('b', `${l.title}. `), l.words, h('small', ` (${l.source})`)))), h('p.note', 'Rules of thumb, not advice: check with your council before you build.')] : []),
    ...(d.notes.length ? [h('h4', 'NOTES'), h('ul.buildnotes', ...d.notes.map((n) => h('li', n)))] : []),
    glossBox(d),
  ];

  const paint = () => {
    const d = designNow();
    if (!d) {
      clear(head, h('p.note', 'Say what you want to build, or start from one of these. Every number I give is a first estimate, never certified.'));
      clear(fields);
      clear(tabs);
      clear(body);
      clear(foot);
      return;
    }
    clear(head, h('h3.buildtitle', d.title), h('p.buildsum', d.summary), h('p.buildcert', ESTIMATE), ...d.params.notes.map((n) => h('p.note', n)));
    paintFields(d);
    paintTabs(d);
    const s = side();
    clear(body, ...(s === 'plan' && !d.concept ? planSide(d) : s === 'build' ? buildSide(d) : billSide(d)));
    body.dataset.side = s;
    clear(foot, d.concept ? h('p.note', 'Nothing is drawn: a concept is not a build plan.') : (() => {
      const b = button('SHOW ME IN 3-D', () => {
        open?.close();
        void import('../commands/registry').then((r) => r.run('open_studio', { sample: 'build' }));
      }, 'on');
      b.dataset.case = 'keep';
      return b;
    })());
    // a lit group comes into view on THE BILL
    const lit = buildNow.get().lit;
    if (s === 'bill' && lit) requestAnimationFrame(() => body.querySelector(`[data-group="${lit}"]`)?.scrollIntoView({ block: 'start' }));
  };
  const off = buildNow.subscribe((st, prev) => {
    if (st.params !== prev.params || st.side !== prev.side || st.lit !== prev.lit || st.live !== prev.live) paint();
  });
  paint();
  open = modal('DESIGN A BUILD', root, () => {
    off();
    open = null;
  });
}

/** The kind names for the chips and the catalogue. */
export const BUILD_KINDS = KINDS;
