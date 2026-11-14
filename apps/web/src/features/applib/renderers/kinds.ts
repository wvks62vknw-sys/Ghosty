/**
 * THE PRO ROUND, lane KINDS (docs/build-plan/APPLIB-PRO.md): every small kind of app laid out like the best app of its sort.
 *   - calc: one big live answer first, said in words from its bands with its tone, the meaning under it; the other answers as
 *     tiles; each input a slider with steppers and unit chips (typing still works); a yes-or-no flag never shows as 0 or 1;
 *     KEEP saves to a history; the estimate and source lines quiet at the foot.
 *   - checklist: a progress ring, sections as cards, a tick that lands, and the fresh start said kindly.
 *   - timer: a big ring countdown with the step's name, the next step, rounds as dots, a chime or the step said aloud; a reload
 *     carries on where it was.
 *   - counter: big tallies, tap to add and a long press to take one off, the leader shown.
 *   - deck: a card that flips, swipe right (knew it) or left (again), the next interval on each key, and a session summary.
 *   - guide: an article to read, with a contents sheet and search that highlights.
 *   - the game launcher: an art tile with PLAY, then best, streak and today (the boards are the PLAY & MAKE lane's).
 * Every class is al-, every colour a token. Things he keeps go through the kit, so undo and Recently deleted hold.
 */
import { h } from '../../../core/dom';
import { key } from '../../../ui/machine';
import { listRow, stateCard, type KitApp, type KitItem } from '../../../ui/appkit';
import type { AppDef, CalcConfig, CalcInput, CalcOutput } from '../../../../../../packages/shared/src/applib/types';
import { runCalc } from '../../../../../../packages/shared/src/applib/expr';
import { freshCard, nextText, rate, type Rating, type Sm2State } from '../../../../../../packages/shared/src/sm2';
import { registerRenderer, redraw, toolKey } from '../registry';
import { appIcon, extra, num, queryOf, sectionHead, today } from '../engine';
import { ask, outWords, periodKey, whereAt, clock, chime, say } from './simple';

const PLUS = '<path d="M12 5v14M5 12h14"/>';
const MINUS = '<path d="M5 12h14"/>';
const LIST = '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>';
const SVG = 'http://www.w3.org/2000/svg';
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* (no vibration here) */ } };

/** A progress ring (0 to 1) with words in its middle: the track, the arc in the accent (or a tone), and a label for VoiceOver. */
export function ring(frac: number, label: string, mid: Node[], cls = ''): HTMLElement {
  const s = document.createElementNS(SVG, 'svg');
  s.setAttribute('viewBox', '0 0 100 100');
  s.setAttribute('aria-hidden', 'true');
  const c = (k: string) => {
    const e = document.createElementNS(SVG, 'circle');
    e.setAttribute('cx', '50'); e.setAttribute('cy', '50'); e.setAttribute('r', '44');
    e.setAttribute('pathLength', '100'); e.setAttribute('class', k);
    return e;
  };
  const arc = c('al-ringarc');
  arc.style.strokeDasharray = `${Math.max(0, Math.min(100, frac * 100)).toFixed(2)} 100`;
  s.append(c('al-ringtrack'), arc);
  return h(`div.al-bigring${cls ? `.${cls}` : ''}` as 'div', { role: 'img', 'aria-label': label }, s, h('div.al-ringmid', ...mid));
}
const setRing = (el: HTMLElement, frac: number) => {
  const arc = el.querySelector<SVGCircleElement>('.al-ringarc');
  if (arc) arc.style.strokeDasharray = `${Math.max(0, Math.min(100, frac * 100)).toFixed(2)} 100`;
};

// ── calc ────────────────────────────────────────────────────────────────────────────────

/** The band a value falls in: the first whose upTo it is at most (the last may leave upTo out). */
export function bandOf(o: CalcOutput, v: number): NonNullable<CalcOutput['bands']>[number] | undefined {
  if (!o.bands?.length || !Number.isFinite(v)) return undefined;
  return o.bands.find((b) => b.upTo == null || v <= b.upTo) ?? o.bands[o.bands.length - 1];
}

/**
 * A yes-or-no output (a comparison, or if(…, 1, 0)): its number means nothing to him, so it never shows unless bands say it in words.
 * It is a flag when its expression compares and every value it gives (at the start and in every test) is 0 or 1.
 */
export function isFlag(c: CalcConfig, o: CalcOutput): boolean {
  if (o.bands?.length) return false;
  if (!/[<>]|==|!=|\band\b|\bor\b|\bnot\b|\bif\s*\(/.test(o.expr)) return false;
  const runs = [{}, ...c.tests.map((t) => t.in)].map((given) => runCalc(c, given)[o.id]);
  return runs.every((v) => v === 0 || v === 1);
}

/** The answer told first: the first output with bands, else the first that is not a flag. */
export function heroOf(c: CalcConfig): CalcOutput | undefined {
  return c.outputs.find((o) => o.bands?.length) ?? c.outputs.find((o) => !isFlag(c, o));
}

/** Other units he may think in, from the unit an input is kept in: [label, from kept to shown, from shown to kept]. */
const UNITS: Record<string, [string, (x: number) => number, (x: number) => number][]> = {
  kg: [['lb', (x) => x * 2.2046226, (x) => x / 2.2046226], ['st', (x) => x / 6.3502932, (x) => x * 6.3502932]],
  cm: [['in', (x) => x / 2.54, (x) => x * 2.54]],
  m: [['ft', (x) => x * 3.2808399, (x) => x / 3.2808399]],
  km: [['mi', (x) => x * 0.62137119, (x) => x / 0.62137119]],
  g: [['oz', (x) => x / 28.349523, (x) => x * 28.349523]],
  ml: [['fl oz', (x) => x / 28.413063, (x) => x * 28.413063]],
  '°C': [['°F', (x) => (x * 9) / 5 + 32, (x) => ((x - 32) * 5) / 9]],
  'km/h': [['mph', (x) => x * 0.62137119, (x) => x / 0.62137119]],
};

/** A slider's range and step when the app gives none: from the starting number, rounded to a kind step. */
export function rangeOf(i: CalcInput): { lo: number; hi: number; step: number } {
  const d = i.default;
  const lo = i.min ?? (d >= 0 ? 0 : d * 3);
  const span = Math.max(Math.abs(d) * 2.5, 10);
  let hi = i.max ?? (d >= 0 ? Math.max(d * 2.5, d + 10) : d + span);
  if (hi <= lo) hi = lo + span;
  const raw = (hi - lo) / 200;
  const p = 10 ** Math.floor(Math.log10(raw || 1));
  const nice = [1, 2, 5, 10].map((m) => m * p).find((m) => m >= raw) ?? p * 10;
  const step = i.step ?? (Number.isInteger(d) && nice < 1 ? 1 : nice);
  const hiR = i.max ?? Math.ceil(hi / step) * step;
  return { lo, hi: hiR, step };
}

registerRenderer('calc', (root, def, k) => {
  const c = def.calc!;
  const st = extra<Record<string, number>>(def.id, 'inputs', {});
  const unitSt = extra<Record<string, string>>(def.id, 'units', {});
  const vals: Record<string, number> = { ...Object.fromEntries(c.inputs.map((i) => [i.id, i.default])), ...st.get() };
  const units: Record<string, string> = { ...unitSt.get() };
  const hero = heroOf(c);
  const tiles = c.outputs.filter((o) => o !== hero && !isFlag(c, o));
  const heroVal = h('b.al-outval.al-heroval');
  const heroWords = h('span.al-herowords');
  const heroExplain = h('p.al-explain');
  const heroEl = hero
    ? h('section.al-out.al-hero', { dataset: { output: hero.id, first: 'true' }, 'aria-live': 'polite' },
      h('small.al-herolabel', hero.label), h('div.al-heroline', heroVal, heroWords), heroExplain)
    : null;
  const tileEls = new Map<string, { v: HTMLElement; w: HTMLElement; el: HTMLElement }>();
  const tileWrap = h('div.al-tiles', ...tiles.map((o) => {
    const v = h('b.al-outval');
    const w = h('small.al-tilewords');
    const el = h('div.al-out.al-tile', { dataset: { output: o.id } }, h('small', o.label), v, w);
    tileEls.set(o.id, { v, w, el });
    return el;
  }));
  const conv = (i: CalcInput) => (i.unit ? UNITS[i.unit]?.find((u) => u[0] === units[i.id]) : undefined);
  const shownOf = (i: CalcInput, v: number) => { const u = conv(i); return u ? u[1](v) : v; };
  const keptOf = (i: CalcInput, v: number) => { const u = conv(i); return u ? u[2](v) : v; };
  const syncers: (() => void)[] = [];
  let got: Record<string, number> = {};
  const work = () => {
    got = runCalc(c, vals);
    if (hero && heroEl) {
      const v = got[hero.id]!;
      const b = bandOf(hero, v);
      heroVal.textContent = outWords(hero, v);
      heroWords.textContent = b ? b.words : '';
      heroWords.hidden = !b;
      heroEl.dataset.tone = b?.tone ?? 'none';
      heroExplain.textContent = hero.explain ?? '';
      heroExplain.hidden = !hero.explain;
      heroEl.setAttribute('aria-label', `${hero.label}: ${outWords(hero, v)}${b ? `, ${b.words}` : ''}`);
    }
    for (const o of tiles) {
      const t = tileEls.get(o.id)!;
      const v = got[o.id]!;
      const b = bandOf(o, v);
      t.v.textContent = outWords(o, v);
      t.w.textContent = b?.words ?? o.explain ?? '';
      t.w.hidden = !t.w.textContent;
      t.el.dataset.tone = b?.tone ?? 'none';
    }
    st.set(vals);
    for (const s of syncers) s();
    return got;
  };
  const field = (i: CalcInput) => {
    const id = `al-${def.id}-${i.id}`;
    if (i.choices?.length) {
      if (i.choices.length <= 4) {
        const seg = h('div.al-segrow', { role: 'radiogroup', 'aria-label': i.label }, ...i.choices.map((ch) => {
          const b = h('button.al-segopt', { type: 'button', role: 'radio', 'aria-checked': String(ch.value === vals[i.id]) }, ch.label);
          b.addEventListener('click', () => { vals[i.id] = ch.value; for (const x of seg.children) x.setAttribute('aria-checked', String(x === b)); work(); });
          return b;
        }));
        return h('div.al-field.al-kfield', { dataset: { input: i.id } }, h('span.al-flabel', i.label), seg);
      }
      const sel = h('select.al-in', { id }, ...i.choices.map((ch) => h('option', { value: String(ch.value), selected: ch.value === vals[i.id] }, ch.label))) as HTMLSelectElement;
      sel.addEventListener('change', () => { vals[i.id] = Number(sel.value); work(); });
      return h('div.al-field.al-kfield', { dataset: { input: i.id } }, h('label.al-flabel', { htmlFor: id }, i.label), sel);
    }
    const r = rangeOf(i);
    const box = h('input.al-in.al-numbox', { id, type: 'number', inputMode: 'decimal', step: 'any', 'aria-label': `${i.label}${i.unit ? ` in ${i.unit}` : ''}` }) as HTMLInputElement;
    const slide = h('input.al-slider', { type: 'range', 'aria-label': `${i.label} slider` }) as HTMLInputElement;
    const dp = (x: number) => +x.toFixed(6);
    const setRange = () => {
      const u = conv(i);
      const lo = u ? u[1](r.lo) : r.lo;
      const hi = u ? u[1](r.hi) : r.hi;
      slide.min = String(Math.min(lo, hi)); slide.max = String(Math.max(lo, hi));
      slide.step = String(u ? Math.max(0.1, +((Math.abs(hi - lo)) / 200).toPrecision(1)) : r.step);
    };
    const sync = () => {
      const shown = shownOf(i, vals[i.id]!);
      if (document.activeElement !== box) box.value = String(+shown.toFixed(conv(i) ? 1 : 6));
      slide.value = String(shown);
      const f = (shown - Number(slide.min)) / ((Number(slide.max) - Number(slide.min)) || 1);
      slide.style.setProperty('--fill', `${Math.max(0, Math.min(1, f)) * 100}%`);
    };
    syncers.push(sync);
    setRange();
    slide.addEventListener('input', () => { vals[i.id] = dp(keptOf(i, Number(slide.value))); work(); });
    box.addEventListener('input', () => { if (box.value.trim() !== '' && Number.isFinite(Number(box.value))) { vals[i.id] = dp(keptOf(i, Number(box.value))); work(); } });
    const stepBy = (dir: number) => {
      const u = conv(i);
      const s = Number(slide.step) || r.step;
      let next = shownOf(i, vals[i.id]!) + dir * s;
      next = Math.round(next / s) * s;
      const kept = dp(keptOf(i, next));
      vals[i.id] = i.min != null ? Math.max(i.min, kept) : kept;
      if (i.max != null) vals[i.id] = Math.min(i.max, vals[i.id]!);
      if (!u) vals[i.id] = dp(vals[i.id]!);
      buzz(4);
      work();
    };
    const less = h('button.al-stepkey', { type: 'button', 'aria-label': `${i.label} down` }, '−');
    const more = h('button.al-stepkey', { type: 'button', 'aria-label': `${i.label} up` }, '+');
    less.addEventListener('click', () => stepBy(-1));
    more.addEventListener('click', () => stepBy(1));
    const alts = i.unit ? UNITS[i.unit] ?? [] : [];
    const chips = i.unit
      ? h('div.al-unitchips', { role: alts.length ? 'radiogroup' : undefined, 'aria-label': alts.length ? `${i.label} unit` : undefined },
        ...[i.unit, ...alts.map((a) => a[0])].map((u) => {
          if (!alts.length) return h('span.al-unitchip', { dataset: { on: 'true' } }, u);
          const b = h('button.al-unitchip', { type: 'button', role: 'radio', 'aria-checked': String((units[i.id] ?? i.unit) === u) }, u);
          b.addEventListener('click', () => {
            if (u === i.unit) delete units[i.id]; else units[i.id] = u;
            unitSt.set(units);
            for (const x of chips!.children) x.setAttribute('aria-checked', String(x === b));
            setRange();
            box.blur();
            sync();
          });
          return b;
        }))
      : null;
    return h('div.al-field.al-kfield', { dataset: { input: i.id } },
      h('div.al-fieldtop', h('label.al-flabel', { htmlFor: id }, i.label), chips),
      h('div.al-inrow', less, box, more),
      slide);
  };
  const inputs = h('section.al-ins.al-card', ...c.inputs.map(field));
  const keep = () => {
    work();
    const o = hero ?? c.outputs[0]!;
    const v = got[o.id]!;
    const b = bandOf(o, v);
    k.add({
      id: `k${Date.now().toString(36)}`,
      title: `${o.label}: ${outWords(o, v)}${b ? ` · ${b.words}` : ''}`,
      sub: c.inputs.map((i) => `${i.label} ${i.choices?.find((ch) => ch.value === vals[i.id])?.label ?? `${num(vals[i.id]!)}${i.unit ? ` ${i.unit}` : ''}`}`).join(' · '),
      meta: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    });
    buzz(12);
    k.notice('Saved to your history. Undo takes it back.', { tone: 'ok' });
  };
  toolKey(k, key('Keep', keep, { label: 'Keep this answer', kind: 'fill' }));
  toolKey(k, key('Reset', () => {
    for (const i of c.inputs) vals[i.id] = i.default;
    st.set(vals);
    k.render();
  }, { label: 'Put the starting numbers back' }));
  const foot = h('footer.al-calcfoot',
    c.estimate ? h('p.al-estimate', 'A first estimate, never certified.') : null,
    c.source ? h('p.al-source', `Source: ${c.source}.`) : null);
  const form = h('div.al-calc.al-kcalc', heroEl, tiles.length ? tileWrap : null, inputs);
  const draw = () => {
    work();
    const kept = k.items();
    root.replaceChildren(form,
      ...(kept.length ? [h('section.al-history', sectionHead('History', String(kept.length)), h('div.al-list.al-card', { role: 'list' }, ...kept.map((x) => listRow(x, { onDelete: () => k.remove(x.id) }))))] : []),
      foot);
  };
  return redraw(k, draw);
});

// ── checklist ────────────────────────────────────────────────────────────────────────────

registerRenderer('checklist', (root, def, k) => {
  const c = def.checklist!;
  const st = extra(def.id, 'period', '');
  const now = periodKey(c.repeat);
  if (c.repeat !== 'never' && st.get() && st.get() !== now) {
    const all = k.items();
    const had = all.filter((x) => x.done).length;
    for (const x of all) if (x.done) k.update(x.id, { done: false });
    const was = had ? ` Last time you finished ${had} of ${all.length}. Well done.` : '';
    k.notice(c.repeat === 'daily' ? `A fresh start for today.${was}` : `A fresh start for this week.${was}`, { tone: 'ok' });
  }
  st.set(now);
  let justTicked = '';
  toolKey(k, key('Add', () => ask(k, 'A new item', (w) => k.add({ id: `u${Date.now().toString(36)}`, title: w, sub: c.sections[0]?.name ?? 'Mine', done: false })), { glyph: PLUS, label: `Add to ${def.name}` }));
  toolKey(k, key('Clear ticks', () => {
    const on = k.items().filter((x) => x.done);
    if (!on.length) return k.notice('Nothing is ticked.');
    for (const x of on) k.update(x.id, { done: false });
    k.notice('All the ticks are cleared. Undo puts them back.');
  }));
  const draw = () => {
    const q = queryOf(k);
    const all = k.items();
    const done = all.filter((x) => x.done).length;
    const names = [...new Set([...c.sections.map((s) => s.name), ...all.map((x) => x.sub ?? '')])].filter(Boolean);
    const groups = names.map((n) => {
      const rows = all.filter((x) => x.sub === n && (!q || x.title.toLowerCase().includes(q)));
      if (!rows.length) return null;
      const d = rows.filter((x) => x.done).length;
      return h('section.al-group.al-card.al-tickcard', { dataset: { done: String(d === rows.length) } },
        h('div.al-cardhead', h('h3', n), h('small', d === rows.length ? 'All done' : `${d} of ${rows.length}`)),
        h('div.al-list', { role: 'list' }, ...rows.map((x) => {
          const b = h('button.al-tick', { type: 'button', role: 'checkbox', 'aria-checked': String(!!x.done), dataset: { pop: String(justTicked === x.id) } }, h('i', { 'aria-hidden': 'true' }), h('span', x.title));
          b.addEventListener('click', () => { justTicked = x.done ? '' : x.id; buzz(x.done ? 4 : 10); k.update(x.id, { done: !x.done }); });
          const del = listRow(x, { onDelete: () => k.remove(x.id) }).querySelector('.ak-rowdel')!;
          return h('div.ak-row.al-tickrow', { role: 'listitem', dataset: { id: x.id } }, b, del);
        })));
    }).filter((x): x is HTMLElement => !!x);
    justTicked = '';
    const frac = all.length ? done / all.length : 0;
    const when = c.repeat === 'daily' ? 'today' : c.repeat === 'weekly' ? 'this week' : 'done';
    const kind = c.repeat === 'daily' ? 'It starts fresh each morning, so tomorrow is a clean page.' : c.repeat === 'weekly' ? 'It starts fresh each Monday.' : '';
    const cheer = all.length && done === all.length ? 'Everything is done. Lovely work.' : done ? `${all.length - done} to go.` : 'One tick at a time.';
    root.replaceChildren(
      h('section.al-progress.al-khero', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(all.length), 'aria-valuenow': String(done), 'aria-label': `${done} of ${all.length} done ${when}`, dataset: { full: String(!!all.length && done === all.length) } },
        ring(frac, `${Math.round(frac * 100)}%`, [h('b', `${done} of ${all.length}`), h('small', when)]),
        h('div.al-herotext', h('strong', cheer), kind ? h('small', kind) : null)),
      ...(groups.length ? groups : [stateCard('empty', q ? `Nothing matches “${q}”.` : 'The list is empty. Add an item with the key below.')]),
    );
  };
  return redraw(k, draw);
});

// ── timer ───────────────────────────────────────────────────────────────────────────────

interface Run { at: number; paused: number; gone: number; on: boolean }

registerRenderer('timer', (root, def, k) => {
  const t = def.timer!;
  const run = extra<Run>(def.id, 'run', { at: 0, paused: 0, gone: 0, on: false });
  const voice = { get: () => k.setting('voice') };
  const per = t.steps.reduce((a, s) => a + s.secs, 0);
  const goneNow = (r: Run) => (r.on ? r.gone + (Date.now() - r.at) / 1000 : r.gone);
  let lastStep = -1;
  const big = h('b.al-clock', { role: 'timer', 'aria-live': 'off' });
  const stepName = h('div.al-stepname', { 'aria-live': 'polite' });
  const roundWords = h('small.al-round');
  const face = ring(0, 'Time left in this step', [stepName, big, roundWords], 'al-timering');
  const next = h('p.al-next');
  const dots = h('div.al-dots', { 'aria-hidden': 'true' }, ...Array.from({ length: Math.min(t.rounds, 24) }, () => h('i')));
  const steps = h('ol.al-steps.al-card', ...t.steps.map((s) => h('li', h('span', s.name), h('small', clock(s.secs)))));
  const wrap = h('section.al-timer', face, next, t.rounds > 1 ? dots : null, steps);
  const startKey = key('Start', () => toggle(), { kind: 'fill' });
  const toggle = () => {
    const r = run.get();
    if (r.on) run.set({ ...r, on: false, gone: goneNow(r) });
    else {
      if (whereAt(t.steps, t.rounds, r.gone).done) r.gone = 0;
      run.set({ ...r, on: true, at: Date.now() });
      chime();
      if (voice.get()) say(t.steps[whereAt(t.steps, t.rounds, r.gone).step]!.name);
    }
    buzz(10);
    tick();
  };
  toolKey(k, key('Reset', () => { run.set({ at: 0, paused: 0, gone: 0, on: false }); lastStep = -1; tick(); }));
  toolKey(k, startKey);
  const tick = () => {
    const r = run.get();
    const gone = goneNow(r);
    const w = whereAt(t.steps, t.rounds, gone);
    const idx = (w.round - 1) * t.steps.length + w.step;
    if (r.on && lastStep >= 0 && idx !== lastStep) {
      chime();
      buzz(30);
      if (voice.get()) say(w.done ? 'Done' : t.steps[w.step]!.name);
    }
    lastStep = idx;
    if (r.on && w.done) {
      run.set({ at: 0, paused: 0, gone: per * t.rounds, on: false });
      k.add({ id: `t${Date.now().toString(36)}`, title: `${def.name}: ${t.rounds} ${t.rounds === 1 ? 'round' : 'rounds'}`, sub: new Date().toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), meta: clock(per * t.rounds) });
      k.notice('Done. Kept in your sessions.', { tone: 'ok' });
    }
    const secs = t.steps[w.step]!.secs;
    big.textContent = clock(Math.ceil(w.left));
    stepName.textContent = w.done ? 'Done' : t.steps[w.step]!.name;
    roundWords.textContent = t.rounds > 1 ? `Round ${Math.min(w.round, t.rounds)} of ${t.rounds}` : `Step ${w.step + 1} of ${t.steps.length}`;
    setRing(face, w.done ? 1 : 1 - w.left / secs);
    face.dataset.step = String(w.step);
    const nIdx = w.step + 1 < t.steps.length ? w.step + 1 : w.round < t.rounds ? 0 : -1;
    next.textContent = w.done ? `All ${t.rounds} ${t.rounds === 1 ? 'round' : 'rounds'} done. Well done.` : nIdx >= 0 ? `Next: ${t.steps[nIdx]!.name} · ${clock(t.steps[nIdx]!.secs)}` : 'Last step';
    [...dots.children].forEach((d, i) => (d as HTMLElement).dataset.on = i < w.round - 1 || w.done ? 'done' : i === w.round - 1 ? 'now' : '');
    [...steps.children].forEach((li, i) => li.toggleAttribute('data-on', i === w.step && !w.done));
    startKey.querySelector('span')!.textContent = run.get().on ? 'Pause' : gone > 0 && !w.done ? 'Go on' : 'Start';
    wrap.dataset.on = String(run.get().on);
  };
  const draw = () => {
    const kept = k.items();
    root.replaceChildren(wrap, ...(kept.length ? [sectionHead('Sessions', String(kept.length)), h('div.al-list.al-card', { role: 'list' }, ...kept.map((x) => listRow(x, { onDelete: () => k.remove(x.id) })))] : []));
    tick();
  };
  const stop = redraw(k, draw);
  const iv = window.setInterval(tick, 200);
  return () => { clearInterval(iv); stop(); };
});

// ── deck ────────────────────────────────────────────────────────────────────────────────

registerRenderer('deck', (root, def, k) => {
  const d = def.deck!;
  let showing = false;
  let mode: 'learn' | 'list' = 'learn';
  let quiz = { right: 0, seen: 0 };
  const sess = { seen: 0, knew: 0, again: 0 };
  const due = () => k.items().filter((x) => d.mode === 'quiz' || ((x.s as Sm2State | undefined)?.due ?? 0) <= Date.now());
  toolKey(k, key('Cards', () => { mode = mode === 'learn' ? 'list' : 'learn'; k.render(); }, { glyph: LIST, label: 'Switch between learning and the card list' }));
  const answer = (card: KitItem, r: Rating) => {
    showing = false;
    sess.seen++;
    if (r === 'again') sess.again++; else sess.knew++;
    buzz(r === 'again' ? 20 : 8);
    if (d.mode === 'quiz') { quiz = { right: quiz.right + (r === 'again' ? 0 : 1), seen: quiz.seen + 1 }; draw(); return; }
    k.update(card.id, { s: rate((card.s as Sm2State) ?? freshCard(Date.now()), r, Date.now()) });
  };
  const draw = () => {
    const q = queryOf(k);
    if (mode === 'list' || q) {
      const rows = k.items().filter((x) => !q || `${x.title} ${x.sub}`.toLowerCase().includes(q));
      root.replaceChildren(sectionHead('All cards', String(rows.length)), rows.length ? h('div.al-list.al-card', { role: 'list' }, ...rows.map((x) => listRow(x, { onDelete: () => k.remove(x.id) }))) : stateCard('empty', `No cards match “${q}”.`));
      return;
    }
    const pool = due();
    const total = k.items().length;
    if (!pool.length) {
      const next = Math.min(...k.items().map((x) => (x.s as Sm2State).due));
      const when = Number.isFinite(next) ? new Date(next).toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : 'later';
      root.replaceChildren(total
        ? h('section.al-summary.al-card', h('small', sess.seen ? 'Session done' : 'All caught up'),
          h('b', sess.seen ? `${sess.seen} reviewed` : `${total} cards learnt`),
          sess.seen ? h('div.al-sumrow', h('span', { dataset: { tone: 'good' } }, `${sess.knew} knew it`), h('span', { dataset: { tone: 'warn' } }, `${sess.again} again`)) : null,
          h('p', `The next card is due ${when}.`))
        : stateCard('empty', 'No cards. Undo puts back any you deleted.'));
      return;
    }
    const card = d.mode === 'quiz' ? pool[quiz.seen % pool.length]! : pool[0]!;
    const s = (card.s as Sm2State) ?? freshCard(Date.now());
    const inner = h('div.al-flipin', h('div.al-face.al-front', h('small', 'Question'), h('p.al-q', card.title), h('small.al-hint', 'Tap to turn over')),
      h('div.al-face.al-back', h('small', 'Answer'), showing ? h('p.al-a', card.sub ?? '') : null, h('small.al-hint', 'Swipe right if you knew it, left for again')));
    const flash = h('div.al-flash.al-flip', { role: 'button', tabIndex: 0, 'aria-label': showing ? `Answer: ${card.sub ?? ''}` : `Question: ${card.title}. Tap to see the answer`, dataset: { side: showing ? 'back' : 'front' } }, inner);
    // (a drag sideways: right is knew it, left is again; a tap turns the card)
    let x0 = 0; let dx = 0; let down = false;
    flash.addEventListener('pointerdown', (e) => { down = true; x0 = e.clientX; dx = 0; flash.setPointerCapture?.(e.pointerId); flash.dataset.drag = 'true'; });
    flash.addEventListener('pointermove', (e) => {
      if (!down) return;
      dx = e.clientX - x0;
      flash.style.transform = `translateX(${dx}px) rotate(${dx / 24}deg)`;
      flash.dataset.lean = dx > 40 ? 'right' : dx < -40 ? 'left' : '';
    });
    const end = () => {
      if (!down) return;
      down = false;
      delete flash.dataset.drag;
      if (Math.abs(dx) > 80) {
        const r: Rating = dx > 0 ? 'good' : 'again';
        flash.style.transform = `translateX(${dx > 0 ? 120 : -120}%) rotate(${dx > 0 ? 12 : -12}deg)`;
        flash.style.opacity = '0';
        window.setTimeout(() => answer(card, r), reduced() ? 0 : 160);
        return;
      }
      flash.style.transform = '';
      flash.dataset.lean = '';
      if (Math.abs(dx) < 8) { showing = !showing; draw(); }
    };
    flash.addEventListener('pointerup', end);
    flash.addEventListener('pointercancel', () => { down = false; flash.style.transform = ''; });
    flash.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showing = !showing; draw(); } });
    const rk = (r: Rating, word: string, kind: 'fill' | 'line') => {
      const b = key(word, () => answer(card, r), { kind, label: word === 'Again' || d.mode === 'quiz' ? word : `${word}, next in ${nextText(s, r, Date.now())}` });
      if (d.mode !== 'quiz') b.append(h('small.al-ival', nextText(s, r, Date.now())));
      b.dataset.rate = r;
      return b;
    };
    const keys = !showing
      ? h('div.al-sheetkeys', key('Show answer', () => { showing = true; draw(); }, { kind: 'fill' }))
      : d.mode === 'quiz'
        ? h('div.al-sheetkeys', key('I was right', () => answer(card, 'good'), { kind: 'fill' }), key('I was wrong', () => answer(card, 'again')))
        : h('div.al-sheetkeys.al-ratekeys', rk('again', 'Again', 'line'), rk('hard', 'Hard', 'line'), rk('good', 'Good', 'fill'), rk('easy', 'Easy', 'line'));
    const frac = total ? 1 - pool.length / total : 0;
    root.replaceChildren(
      h('div.al-progress.al-deckbar', h('b', d.mode === 'quiz' ? `${quiz.right} of ${quiz.seen}` : `${pool.length} due`), h('small', d.mode === 'quiz' ? 'right so far' : `of ${total} cards${sess.seen ? ` · ${sess.seen} reviewed` : ''}`), h('span.al-bar1', h('i', { style: `width:${Math.round(frac * 100)}%` }))),
      h('div.al-stack', pool.length > 1 ? h('div.al-under', { 'aria-hidden': 'true' }) : null, flash), keys);
  };
  return redraw(k, draw);
});

// ── counter ─────────────────────────────────────────────────────────────────────────────

registerRenderer('counter', (root, def, k) => {
  const c = def.counter!;
  const st = extra(def.id, 'period', '');
  const now = periodKey(c.reset);
  if (c.reset !== 'never' && st.get() && st.get() !== now) { for (const x of k.items()) if (x.n) k.update(x.id, { n: 0 }); k.notice(c.reset === 'daily' ? 'Every tally starts again today. A fresh go.' : 'Every tally starts again this week. A fresh go.'); }
  st.set(now);
  toolKey(k, key('Add', () => ask(k, 'A new tally', (w) => k.add({ id: `u${Date.now().toString(36)}`, title: w.slice(0, 40), n: 0 })), { glyph: PLUS, label: 'Add a tally' }));
  let bumped = '';
  const set = (x: KitItem, n: number) => { bumped = x.id; k.update(x.id, { n: Math.max(0, +n.toFixed(6)) }); };
  const draw = () => {
    const q = queryOf(k);
    const items = k.items();
    const rows = items.filter((x) => !q || x.title.toLowerCase().includes(q));
    const top = Math.max(0, ...items.map((x) => Number(x.n) || 0));
    const leaders = items.filter((x) => top > 0 && (Number(x.n) || 0) === top);
    const total = items.reduce((a, x) => a + (Number(x.n) || 0), 0);
    const lead = items.length > 1 && top > 0
      ? h('section.al-leader.al-card', h('small', leaders.length > 1 ? 'Level at the top' : 'In the lead'), h('b', leaders.length > 1 ? leaders.map((x) => x.title).join(' and ') : leaders[0]!.title), h('span', `${num(top)} · ${num(total)} in all`))
      : null;
    const tiles = rows.map((x) => {
      const n = Number(x.n) || 0;
      const isLead = items.length > 1 && top > 0 && n === top;
      const tap = h('button.al-tally', { type: 'button', 'aria-label': `${x.title} up by ${c.step}`, dataset: { bump: String(bumped === x.id) } }, h('span.al-tallyname', x.title), h('b.al-countval', num(n)), h('small', 'Tap to add · hold to take off'));
      let timer = 0; let held = false;
      tap.addEventListener('pointerdown', () => { held = false; timer = window.setTimeout(() => { held = true; buzz(25); set(x, n - c.step); }, 520); });
      const cancel = () => clearTimeout(timer);
      tap.addEventListener('pointerup', cancel);
      tap.addEventListener('pointerleave', cancel);
      tap.addEventListener('pointercancel', cancel);
      tap.addEventListener('contextmenu', (e) => e.preventDefault());
      tap.addEventListener('click', () => { if (held) { held = false; return; } buzz(6); set(x, n + c.step); });
      const minus = key('', () => set(x, n - c.step), { glyph: MINUS, label: `${x.title} down by ${c.step}` });
      minus.classList.add('al-tallyminus');
      const del = listRow(x, { onDelete: () => k.remove(x.id) }).querySelector('.ak-rowdel')!;
      return h('div.al-count.al-card', { role: 'group', 'aria-label': `${x.title}: ${num(n)}`, dataset: { id: x.id, lead: String(isLead) } },
        tap, h('div.al-tallykeys', minus, isLead ? h('span.al-leadchip', 'Leader') : h('span'), del));
    });
    bumped = '';
    root.replaceChildren(...(rows.length ? [...(lead ? [lead] : []), h('div.al-tallies', ...tiles)] : [stateCard('empty', q ? `Nothing matches “${q}”.` : 'No tallies. Add one with the key below.')]));
  };
  return redraw(k, draw);
});

// ── guide ───────────────────────────────────────────────────────────────────────────────

/** Words with every match of `q` wrapped in a highlight (text only, never HTML). */
function marked(text: string, q: string): (string | HTMLElement)[] {
  if (!q) return [text];
  const out: (string | HTMLElement)[] = [];
  const low = text.toLowerCase();
  let at = 0;
  for (let i = low.indexOf(q); i >= 0; i = low.indexOf(q, i + q.length)) {
    out.push(text.slice(at, i), h('mark.al-hit', text.slice(i, i + q.length)));
    at = i + q.length;
  }
  out.push(text.slice(at));
  return out;
}

registerRenderer('guide', (root, def, k) => {
  const g = def.guide!;
  const contents = () => {
    k.el.querySelector('.al-edit')?.remove();
    const sheet = h('div.ak-sheet.al-edit.al-contents', { role: 'dialog', 'aria-label': 'Contents' });
    const close = () => sheet.remove();
    sheet.append(h('h3.ak-sheethead', 'Contents'), h('ol.al-toc', ...g.sections.map((s, i) => {
      const b = h('button.al-tocrow', { type: 'button' }, h('span', String(i + 1)), h('b', s.title));
      b.addEventListener('click', () => {
        close();
        root.querySelector(`.al-guide[data-i="${i}"]`)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      });
      return h('li', b);
    })), h('div.al-sheetkeys', key('Close', close)));
    k.el.append(sheet);
  };
  toolKey(k, key('Contents', contents, { glyph: LIST, label: 'Contents' }));
  const words = g.sections.reduce((a, s) => a + s.body.split(/\s+/).length, 0);
  const draw = () => {
    const q = queryOf(k);
    const hits = g.sections.map((s, i) => ({ s, i })).filter(({ s }) => !q || `${s.title} ${s.body} ${(s.tags ?? []).join(' ')}`.toLowerCase().includes(q));
    root.replaceChildren(
      h('header.al-guidetop', h('span.al-guideicon', appIcon(def)), h('div', h('h2', def.name), h('small', q ? `${hits.length} of ${g.sections.length} sections match` : `${g.sections.length} sections · ${Math.max(1, Math.round(words / 220))} min read`))),
      ...(hits.length ? hits.map(({ s, i }) => h('article.al-guide', { dataset: { i: String(i) } },
        h('h3.al-guidetitle', ...marked(s.title, q)),
        s.tags?.length ? h('div.al-guidetags', ...s.tags.map((t) => h('span', t))) : null,
        h('div.al-guidebody', ...s.body.split(/\n{2,}/).map((p) => h('p', ...marked(p, q))))))
        : [stateCard('empty', `Nothing in the guide matches “${q}”.`, { word: 'Clear search', run: () => { const f = k.el.querySelector<HTMLInputElement>('.ak-find'); if (f) f.value = ''; k.search(''); } })]),
      h('p.al-source', 'Source: ', h('a', { href: g.source.url, target: '_blank', rel: 'noopener noreferrer' }, g.source.name), '.'),
    );
  };
  return redraw(k, draw);
});

// ── the game launcher ────────────────────────────────────────────────────────────────────

interface Played { best?: number; bests?: Record<string, number>; streak?: number; played?: number; save?: unknown }

/**
 * A game app's front: a big art tile with its glyph and PLAY, then its best, its streak and today's games. PLAY hands over to
 * the board (`start`, the PLAY & MAKE lane's frame). A game left part-way goes straight back to its board.
 */
export function launcher(k: KitApp, def: AppDef, start: () => void | (() => void)): () => void {
  let stop: void | (() => void);
  let kept: Played = {};
  try { kept = (JSON.parse(localStorage.getItem(`ghosty.app.${def.id}.play`) ?? 'null') as Played | null) ?? {}; } catch { /* (a private window) */ }
  if (kept.save) return start() ?? (() => {});
  const day = extra(def.id, 'today', { day: '', n: 0 });
  const t = day.get().day === today() ? day.get().n : 0;
  const best = kept.best ?? (kept.bests && Object.values(kept.bests).length ? Math.max(...Object.values(kept.bests)) : undefined);
  let unhook = () => {};
  const play = key('Play', () => {
    day.set({ day: today(), n: t + 1 });
    buzz(12);
    unhook();
    k.body.replaceChildren();
    stop = start();
  }, { kind: 'fill', label: `Play ${def.name}` });
  play.classList.add('al-playkey');
  const chip = (label: string, v: string) => h('div.al-gchip', h('small', label), h('b', v));
  const front = h('section.al-launch', { dataset: { kind: def.game?.kind ?? '' } },
    h('div.al-art', { 'aria-hidden': 'true' }, h('span.al-artglyph', appIcon(def)), h('span.al-artglyph.al-artghost', appIcon(def))),
    h('div.al-launchtext', h('h2', def.name), h('p', def.pitch)),
    play,
    h('div.al-gchips', chip('Best', best != null ? Math.round(best).toLocaleString('en-GB') : '–'), chip('Streak', String(kept.streak ?? 0)), chip('Today', t ? `${t} ${t === 1 ? 'game' : 'games'}` : 'Not yet')));
  // (drawn after each of the kit's own renders until PLAY, so the tour and the kit's redraws keep it)
  unhook = redraw(k, () => k.body.replaceChildren(front));
  return () => stop?.();
}
