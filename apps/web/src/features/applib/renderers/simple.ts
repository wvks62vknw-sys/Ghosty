/**
 * THE APP LIBRARY's smaller renderers: checklist (fresh each day or week), calc (live answers, units, the estimate and the source),
 * timer (steps and rounds, a chime and the step said aloud, surviving a reload), deck (spaced repetition, or a quiz), counter,
 * guide (searchable) and screen (opens Ghosty's own screen). Each keeps its things through the kit, so undo and Recently deleted hold.
 */
import { h } from '../../../core/dom';
import { key } from '../../../ui/machine';
import { listRow, stateCard, type KitApp, type KitItem } from '../../../ui/appkit';
import type { AppDef, CalcOutput } from '../../../../../../packages/shared/src/applib/types';
import { runCalc } from '../../../../../../packages/shared/src/applib/expr';
import { freshCard, rate, type Rating, type Sm2State } from '../../../../../../packages/shared/src/sm2';
import { registerRenderer, redraw, toolKey } from '../registry';
import { appIcon, extra, mins, money, num, queryOf, sectionHead, today } from '../engine';

const PLUS = '<path d="M12 5v14M5 12h14"/>';

/** The key of the current day or week (Monday first), for fresh starts. */
export function periodKey(repeat: 'never' | 'daily' | 'weekly', now = new Date()): string {
  if (repeat === 'never') return 'all';
  if (repeat === 'daily') return today(now);
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return `w${today(mon)}`;
}

/** A small sheet asking for one line of words (a new item or tally), with SAVE and CANCEL. */
function ask(k: KitApp, label: string, done: (words: string) => void): void {
  k.el.querySelector('.al-edit')?.remove();
  const inp = h('input.al-in', { type: 'text', maxLength: 80, 'aria-label': label, placeholder: label }) as HTMLInputElement;
  const sheet = h('form.ak-sheet.al-edit', { role: 'dialog', 'aria-label': label });
  const close = () => sheet.remove();
  sheet.addEventListener('submit', (e) => {
    e.preventDefault();
    const w = inp.value.trim();
    if (!w) return k.notice('Type a few words first.', { tone: 'warn' });
    close();
    done(w);
  });
  const save = key('Save', () => sheet.requestSubmit(), { kind: 'fill' });
  sheet.append(h('h3.ak-sheethead', label), inp, h('div.al-sheetkeys', save, key('Cancel', close)));
  k.el.append(sheet);
  inp.focus({ preventScroll: true });
}

// ── checklist ────────────────────────────────────────────────────────────────────────────

registerRenderer('checklist', (root, def, k) => {
  const c = def.checklist!;
  const st = extra(def.id, 'period', '');
  const now = periodKey(c.repeat);
  if (c.repeat !== 'never' && st.get() && st.get() !== now) {
    for (const x of k.items()) if (x.done) k.update(x.id, { done: false });
    k.notice(c.repeat === 'daily' ? 'A fresh list for today.' : 'A fresh list for this week.');
  }
  st.set(now);
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
      return h('section.al-group', sectionHead(n, `${rows.filter((x) => x.done).length} of ${rows.length}`), h('div.al-list', { role: 'list' }, ...rows.map((x) => {
        const b = h('button.al-tick', { type: 'button', role: 'checkbox', 'aria-checked': String(!!x.done) }, h('i', { 'aria-hidden': 'true' }), h('span', x.title));
        b.addEventListener('click', () => k.update(x.id, { done: !x.done }));
        const del = listRow(x, { onDelete: () => k.remove(x.id) }).querySelector('.ak-rowdel')!;
        return h('div.ak-row.al-tickrow', { role: 'listitem', dataset: { id: x.id } }, b, del);
      })));
    }).filter((x): x is HTMLElement => !!x);
    const frac = all.length ? done / all.length : 0;
    root.replaceChildren(
      h('div.al-progress', { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(all.length), 'aria-valuenow': String(done), 'aria-label': `${done} of ${all.length} done` },
        h('b', `${done} of ${all.length}`), h('small', c.repeat === 'daily' ? 'today' : c.repeat === 'weekly' ? 'this week' : 'done'), h('span.al-bar1', h('i', { style: `width:${Math.round(frac * 100)}%` }))),
      ...(groups.length ? groups : [stateCard('empty', q ? `Nothing matches “${q}”.` : 'The list is empty. Add an item with the key below.')]),
    );
  };
  return redraw(k, draw);
});

// ── calc ────────────────────────────────────────────────────────────────────────────────

/** An output's number as he reads it. */
export function outWords(o: CalcOutput, v: number): string {
  if (!Number.isFinite(v)) return '–';
  const dp = o.dp ?? 2;
  if (o.format === 'money') return money(v);
  if (o.format === 'percent') return `${num(v, dp)}%`;
  if (o.format === 'duration') return mins(v);
  return `${num(v, dp)}${o.unit ? ` ${o.unit}` : ''}`;
}

registerRenderer('calc', (root, def, k) => {
  const c = def.calc!;
  const st = extra<Record<string, number>>(def.id, 'inputs', {});
  const vals: Record<string, number> = { ...Object.fromEntries(c.inputs.map((i) => [i.id, i.default])), ...st.get() };
  const outs = new Map<string, HTMLElement>();
  const work = () => {
    const got = runCalc(c, vals);
    for (const o of c.outputs) outs.get(o.id)!.textContent = outWords(o, got[o.id]!);
    st.set(vals);
    return got;
  };
  const inputs = c.inputs.map((i) => {
    const id = `al-${def.id}-${i.id}`;
    let ctl: HTMLElement;
    if (i.choices?.length) {
      const sel = h('select.al-in', { id }, ...i.choices.map((ch) => h('option', { value: String(ch.value), selected: ch.value === vals[i.id] }, ch.label))) as HTMLSelectElement;
      sel.addEventListener('change', () => { vals[i.id] = Number(sel.value); work(); });
      ctl = sel;
    } else {
      const inp = h('input.al-in', { id, type: 'number', inputMode: 'decimal', value: String(vals[i.id]), step: i.step ?? 'any', ...(i.min != null ? { min: i.min } : {}), ...(i.max != null ? { max: i.max } : {}) }) as HTMLInputElement;
      inp.addEventListener('input', () => { if (inp.value.trim() !== '' && Number.isFinite(Number(inp.value))) { vals[i.id] = Number(inp.value); work(); } });
      ctl = inp;
    }
    return h('div.al-field', { dataset: { input: i.id } }, h('label.al-flabel', { htmlFor: id }, i.label), h('div.al-inrow', ctl, i.unit ? h('span.al-unit', i.unit) : null));
  });
  const answers = c.outputs.map((o, n) => {
    const v = h('b.al-outval', { 'aria-live': n === 0 ? 'polite' : 'off' });
    outs.set(o.id, v);
    return h('div.al-out', { dataset: { output: o.id, first: String(n === 0) } }, h('small', o.label), v);
  });
  toolKey(k, key('Keep', () => {
    const got = work();
    const first = c.outputs[0]!;
    k.add({ id: `k${Date.now().toString(36)}`, title: `${first.label}: ${outWords(first, got[first.id]!)}`, sub: c.inputs.map((i) => `${i.label} ${i.choices?.find((ch) => ch.value === vals[i.id])?.label ?? `${num(vals[i.id]!)}${i.unit ? ` ${i.unit}` : ''}`}`).join(' · '), meta: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
    k.notice('Kept below. Undo takes it back.', { tone: 'ok' });
  }, { label: 'Keep this answer' }));
  toolKey(k, key('Reset', () => {
    for (const i of c.inputs) vals[i.id] = i.default;
    st.set(vals);
    k.render();
  }, { label: 'Put the starting numbers back' }));
  const form = h('div.al-calc', h('div.al-outs', ...answers), h('div.al-ins', ...inputs),
    c.estimate ? h('p.al-estimate', 'A first estimate, never certified.') : null,
    c.source ? h('p.al-source', `Source: ${c.source}.`) : null);
  const draw = () => {
    // (the form keeps its focus: only the kept answers under it are drawn again)
    for (const i of c.inputs) { const el = form.querySelector<HTMLInputElement | HTMLSelectElement>(`#al-${def.id}-${i.id}`); if (el && document.activeElement !== el) el.value = String(vals[i.id]); }
    work();
    const kept = k.items();
    root.replaceChildren(form, ...(kept.length ? [sectionHead('Kept', String(kept.length)), h('div.al-list', { role: 'list' }, ...kept.map((x) => listRow(x, { onDelete: () => k.remove(x.id) })))] : []));
  };
  return redraw(k, draw);
});

// ── timer ───────────────────────────────────────────────────────────────────────────────

interface Run { at: number; paused: number; gone: number; on: boolean }

/** Where a run is: the step, the round, the seconds left in the step, and whether it is over. */
export function whereAt(steps: { name: string; secs: number }[], rounds: number, gone: number): { step: number; round: number; left: number; done: boolean } {
  const per = steps.reduce((a, s) => a + s.secs, 0);
  if (gone >= per * rounds) return { step: steps.length - 1, round: rounds, left: 0, done: true };
  const round = Math.floor(gone / per);
  let t = gone - round * per;
  let step = 0;
  while (t >= steps[step]!.secs) { t -= steps[step]!.secs; step++; }
  return { step, round: round + 1, left: steps[step]!.secs - t, done: false };
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let actx: AudioContext | null = null;
function chime(): void {
  try {
    actx ??= new AudioContext();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, actx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.6);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + 0.65);
  } catch {
    // (no sound on this phone: the step still changes on screen)
  }
}
function say(words: string): void {
  try {
    const u = new SpeechSynthesisUtterance(words);
    u.lang = 'en-GB';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    // (no voice on this phone: the chime and the screen say it)
  }
}

registerRenderer('timer', (root, def, k) => {
  const t = def.timer!;
  const run = extra<Run>(def.id, 'run', { at: 0, paused: 0, gone: 0, on: false });
  const voice = extra<boolean>(def.id, 'voice', true);
  const per = t.steps.reduce((a, s) => a + s.secs, 0);
  const goneNow = (r: Run) => (r.on ? r.gone + (Date.now() - r.at) / 1000 : r.gone);
  let lastStep = -1;
  const face = h('div.al-timer');
  const big = h('b.al-clock', { role: 'timer', 'aria-live': 'off' });
  const stepName = h('div.al-stepname', { 'aria-live': 'polite' });
  const roundWords = h('small.al-round');
  const bar = h('span.al-bar1', h('i'));
  const steps = h('ol.al-steps', ...t.steps.map((s) => h('li', h('span', s.name), h('small', clock(s.secs)))));
  face.append(stepName, big, roundWords, bar, steps);
  const startKey = key('Start', () => toggle(), { kind: 'fill' });
  const toggle = () => {
    const r = run.get();
    if (r.on) run.set({ ...r, on: false, gone: goneNow(r) });
    else {
      if (whereAt(t.steps, t.rounds, r.gone).done) r.gone = 0;
      run.set({ ...r, on: true, at: Date.now() });
      if (voice.get()) say(t.steps[whereAt(t.steps, t.rounds, r.gone).step]!.name);
    }
    tick();
  };
  toolKey(k, key('Reset', () => { run.set({ at: 0, paused: 0, gone: 0, on: false }); lastStep = -1; tick(); }));
  toolKey(k, startKey);
  const voiceKey = key(voice.get() ? 'Voice on' : 'Voice off', () => { voice.set(!voice.get()); voiceKey.querySelector('span')!.textContent = voice.get() ? 'Voice on' : 'Voice off'; }, { label: 'Say each step aloud' });
  toolKey(k, voiceKey);
  const tick = () => {
    const r = run.get();
    const gone = goneNow(r);
    const w = whereAt(t.steps, t.rounds, gone);
    const idx = (w.round - 1) * t.steps.length + w.step;
    if (r.on && lastStep >= 0 && idx !== lastStep) {
      chime();
      if (voice.get()) say(w.done ? 'Done' : t.steps[w.step]!.name);
    }
    lastStep = idx;
    if (r.on && w.done) {
      run.set({ at: 0, paused: 0, gone: per * t.rounds, on: false });
      k.add({ id: `t${Date.now().toString(36)}`, title: `${def.name}: ${t.rounds} ${t.rounds === 1 ? 'round' : 'rounds'}`, sub: new Date().toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), meta: clock(per * t.rounds) });
      k.notice('Done. Kept in your sessions.', { tone: 'ok' });
    }
    big.textContent = clock(Math.ceil(w.left));
    stepName.textContent = w.done ? 'Done' : t.steps[w.step]!.name;
    roundWords.textContent = t.rounds > 1 ? `Round ${Math.min(w.round, t.rounds)} of ${t.rounds}` : `Step ${w.step + 1} of ${t.steps.length}`;
    (bar.firstChild as HTMLElement).style.width = `${Math.min(100, (gone / (per * t.rounds)) * 100).toFixed(1)}%`;
    [...steps.children].forEach((li, i) => li.toggleAttribute('data-on', i === w.step && !w.done));
    startKey.querySelector('span')!.textContent = run.get().on ? 'Pause' : gone > 0 && !w.done ? 'Go on' : 'Start';
    face.dataset.on = String(run.get().on);
  };
  const draw = () => {
    const kept = k.items();
    root.replaceChildren(face, ...(kept.length ? [sectionHead('Sessions', String(kept.length)), h('div.al-list', { role: 'list' }, ...kept.map((x) => listRow(x, { onDelete: () => k.remove(x.id) })))] : []));
    tick();
  };
  const stop = redraw(k, draw);
  const iv = window.setInterval(tick, 250);
  return () => { clearInterval(iv); stop(); };
});

// ── deck ────────────────────────────────────────────────────────────────────────────────

registerRenderer('deck', (root, def, k) => {
  const d = def.deck!;
  let showing = false;
  let mode: 'learn' | 'list' = 'learn';
  let quiz = { right: 0, seen: 0 };
  const due = () => k.items().filter((x) => d.mode === 'quiz' || ((x.s as Sm2State | undefined)?.due ?? 0) <= Date.now());
  toolKey(k, key('Cards', () => { mode = mode === 'learn' ? 'list' : 'learn'; k.render(); }, { label: 'Switch between learning and the card list' }));
  const draw = () => {
    const q = queryOf(k);
    if (mode === 'list' || q) {
      const rows = k.items().filter((x) => !q || `${x.title} ${x.sub}`.toLowerCase().includes(q));
      root.replaceChildren(sectionHead('All cards', String(rows.length)), rows.length ? h('div.al-list', { role: 'list' }, ...rows.map((x) => listRow(x, { onDelete: () => k.remove(x.id) }))) : stateCard('empty', `No cards match “${q}”.`));
      return;
    }
    const pool = due();
    if (!pool.length) {
      const next = Math.min(...k.items().map((x) => (x.s as Sm2State).due));
      root.replaceChildren(stateCard('empty', k.items().length ? `All done for now. The next card is due ${Number.isFinite(next) ? new Date(next).toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) : 'later'}.` : 'No cards. Undo puts back any you deleted.'));
      return;
    }
    const card = d.mode === 'quiz' ? pool[quiz.seen % pool.length]! : pool[0]!;
    const front = h('div.al-flash', { dataset: { side: showing ? 'back' : 'front' } }, h('p.al-q', card.title), showing ? h('p.al-a', card.sub ?? '') : null);
    const keys = !showing
      ? h('div.al-sheetkeys', key('Show answer', () => { showing = true; draw(); }, { kind: 'fill' }))
      : d.mode === 'quiz'
        ? h('div.al-sheetkeys', key('I was right', () => { quiz = { right: quiz.right + 1, seen: quiz.seen + 1 }; showing = false; draw(); }, { kind: 'fill' }), key('I was wrong', () => { quiz = { ...quiz, seen: quiz.seen + 1 }; showing = false; draw(); }))
        : h('div.al-sheetkeys', ...(['again', 'hard', 'good', 'easy'] as Rating[]).map((r) => key(r[0]!.toUpperCase() + r.slice(1), () => {
          showing = false;
          k.update(card.id, { s: rate((card.s as Sm2State) ?? freshCard(Date.now()), r, Date.now()) });
        }, { kind: r === 'good' ? 'fill' : 'line' })));
    root.replaceChildren(
      h('div.al-progress', h('b', d.mode === 'quiz' ? `${quiz.right} of ${quiz.seen}` : `${pool.length} due`), h('small', d.mode === 'quiz' ? 'right so far' : `of ${k.items().length} cards`)),
      front, keys);
  };
  return redraw(k, draw);
});

// ── counter ─────────────────────────────────────────────────────────────────────────────

registerRenderer('counter', (root, def, k) => {
  const c = def.counter!;
  const st = extra(def.id, 'period', '');
  const now = periodKey(c.reset);
  if (c.reset !== 'never' && st.get() && st.get() !== now) { for (const x of k.items()) if (x.n) k.update(x.id, { n: 0 }); k.notice(c.reset === 'daily' ? 'Every tally starts again today.' : 'Every tally starts again this week.'); }
  st.set(now);
  toolKey(k, key('Add', () => ask(k, 'A new tally', (w) => k.add({ id: `u${Date.now().toString(36)}`, title: w.slice(0, 40), n: 0 })), { glyph: PLUS, label: 'Add a tally' }));
  const draw = () => {
    const q = queryOf(k);
    const rows = k.items().filter((x) => !q || x.title.toLowerCase().includes(q));
    const top = Math.max(...k.items().map((x) => Number(x.n) || 0));
    root.replaceChildren(...(rows.length ? rows.map((x) => {
      const n = Number(x.n) || 0;
      const minus = key('Less', () => k.update(x.id, { n: Math.max(0, +(n - c.step).toFixed(6)) }), { label: `${x.title} down by ${c.step}` });
      const plus = key('More', () => k.update(x.id, { n: +(n + c.step).toFixed(6) }), { kind: 'fill', label: `${x.title} up by ${c.step}` });
      const del = listRow(x, { onDelete: () => k.remove(x.id) }).querySelector('.ak-rowdel')!;
      return h('div.al-count', { role: 'group', 'aria-label': `${x.title}: ${num(n)}`, dataset: { id: x.id, lead: String(top > 0 && n === top && k.items().length > 1) } }, h('div.al-countname', h('span', x.title), del), h('b.al-countval', num(n)), h('div.al-sheetkeys', minus, plus));
    }) : [stateCard('empty', q ? `Nothing matches “${q}”.` : 'No tallies. Add one with the key below.')]));
  };
  return redraw(k, draw);
});

// ── guide ───────────────────────────────────────────────────────────────────────────────

registerRenderer('guide', (root, def, k) => {
  const g = def.guide!;
  const open = new Set<number>();
  const draw = () => {
    const q = queryOf(k);
    const hits = g.sections.map((s, i) => ({ s, i })).filter(({ s }) => !q || `${s.title} ${s.body} ${(s.tags ?? []).join(' ')}`.toLowerCase().includes(q));
    root.replaceChildren(
      ...(hits.length ? hits.map(({ s, i }) => {
        const on = open.has(i) || !!q;
        const head = h('button.al-guidehead', { type: 'button', 'aria-expanded': String(on) }, h('b', s.title), s.tags?.length ? h('small', s.tags.join(' · ')) : null);
        head.addEventListener('click', () => { if (open.has(i)) open.delete(i); else open.add(i); draw(); });
        return h('section.al-guide', { dataset: { i: String(i) } }, head, on ? h('div.al-guidebody', ...s.body.split(/\n{2,}/).map((p) => h('p', p))) : null);
      }) : [stateCard('empty', `Nothing in the guide matches “${q}”.`, { word: 'Clear search', run: () => { const f = k.el.querySelector<HTMLInputElement>('.ak-find'); if (f) f.value = ''; k.search(''); } })]),
      h('p.al-source', 'Source: ', h('a', { href: g.source.url, target: '_blank', rel: 'noopener noreferrer' }, g.source.name), '.'),
    );
  };
  return redraw(k, draw);
});

// ── screen ──────────────────────────────────────────────────────────────────────────────

registerRenderer('screen', (root, def, k) => {
  const go = () => { location.hash = `#${def.screen!.hash}`; };
  const draw = () => root.replaceChildren(h('div.al-screen', h('span.al-bigicon', appIcon(def)), h('p', def.pitch), key(`Open ${def.name}`, go, { kind: 'fill' })));
  return redraw(k, draw);
});
