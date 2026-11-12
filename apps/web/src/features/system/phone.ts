/**
 * THIS PHONE (SYSTEM → STATUS, under SPEED; BRIEF-PHONE-HARDWARE): what the phone's hardware lets Ghosty do, each line measured or
 * read, none guessed. The display's refresh rate as the one frame loop measures it (engine/refresh.ts: 120 on a ProMotion phone, 60 on
 * an older one), what the phone reports of its memory, cores and WebGPU, which way the GYM's training runs, and the offline brain: how
 * long each size took to load here and what the page gained, with the three sizes' guidance (offline/measure.ts). MEASURE THE BRAIN
 * loads the brain in use once more under a stopwatch, and only when it is already on the phone: nothing is ever downloaded for it.
 */
import { sayError } from '../../ui/hisWords';
import { clear, h } from '../../core/dom';
import { refresh } from '../../engine/refresh';
import { probeCaps, capsWords, type Caps } from '../../offline/capability';
import { currentModel, offlineBrain, loadOffline, unloadOffline } from '../../offline/brain';
import { brainMeasure, guidance, heapNow, measureWords } from '../../offline/measure';
import { PICKER } from '../../offline/models';
import { button } from '../../ui/components';
import { trainingChoice } from '../gym/path';

export function phoneCard(): HTMLElement {
  const rows = h('div.pcrows');
  const note = h('p.pcnote', { role: 'status' });
  const el = h('section.phonecard', { dataset: { phone: 'card', case: 'keep' } }, h('div.pchead', 'This phone'), rows, note);
  let caps: Caps | null = null;
  let path = '';
  const row = (k: string, v: string, key: string) => h('div.pcrow', { dataset: { phone: key } }, h('span.k', k), h('span.v', v));

  const draw = () => {
    const mem = caps?.memoryGB ?? null;
    const g = guidance(PICKER.filter((m) => !m.alone), mem, brainMeasure.get().by);
    clear(
      rows,
      row('Refresh', refresh.words(), 'refresh'),
      row('Hardware', caps ? capsWords(caps) : 'Checking…', 'caps'),
      row('GYM training', path || 'Checking…', 'gym'),
      row('Offline brain', measureWords(brainMeasure.get().by[currentModel().id]), 'brain'),
      ...g.map((x) => h('div.pcrow', { dataset: { phone: 'size', size: x.id, tone: x.tone } }, h('span.k', x.label), h('span.v', x.line))),
    );
  };
  const measure = button('MEASURE THE BRAIN', async (b) => {
    const st = offlineBrain.get();
    if (st.busy) {
      note.textContent = 'The brain is busy just now. Try again in a moment.';
      return;
    }
    if (!st.downloaded) {
      note.textContent = 'The offline brain is not on this phone, so there is nothing to time. Nothing is downloaded for this: GET one in SETTINGS first.';
      return;
    }
    b.disabled = true;
    note.textContent = `Loading ${currentModel().label} under a stopwatch…`;
    try {
      unloadOffline();
      await loadOffline();
      note.textContent = `${currentModel().label} ${measureWords(brainMeasure.get().by[currentModel().id])}${heapNow() === null ? '' : `; heap now ${Math.round(heapNow()!)} MB`}.`;
    } catch (e) {
      note.textContent = sayError(e, 'load that');
    }
    b.disabled = false;
    draw();
  });
  measure.dataset.act = 'measure-brain';
  el.append(measure);

  void probeCaps().then((c) => {
    caps = c;
    draw();
  });
  void trainingChoice().then((c) => {
    path = c.message;
    draw();
  });
  brainMeasure.subscribe(draw);
  draw();
  // the refresh line moves while the measure settles; it stops when the card is not on the page
  const tick = window.setInterval(() => {
    if (!el.isConnected) return void clearInterval(tick);
    const v = rows.querySelector('[data-phone="refresh"] .v');
    if (v) v.textContent = refresh.words();
  }, 1000);
  return el;
}
