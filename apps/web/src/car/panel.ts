/**
 * The 3D STUDIO's CAR pane (BRIEF-CAR): the car drawn over the Studio's view (car/scene.ts), its name and the one honest
 * line (the stand-in, said once), DAY / NIGHT; under it the views — CAR, BONNET UP, WHEEL OFF, UNDERNEATH — and the sheet
 * of whatever part was tapped: WHAT IT IS, A 30-SECOND CHECK, DIY OR GARAGE, A ROUGH COST (a first estimate, never a
 * quote) and what the MOT said about it when it said something. The Studio (features/studio/index.ts) shows it for the
 * `car` sample and the CAR · FIX IT pane, and stops it when it is left. A test reads and drives it through
 * window.__ghosty.car.
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { ESTIMATE, PARTS, VIEWS, isPart, money, motFor, type MotLine, type View } from './parts';
import { CarScene, labelOf } from './scene';
import { carNow, recordOf } from './state';
import { shapeWords, specFrom, standInLine, type CarFacts, type CarSpec } from './spec';

export interface CarPane {
  /** What goes in the Studio's panel. */
  el: HTMLElement;
  scene: CarScene;
  enter(): Promise<void>;
  leave(): void;
}

/** The MOT history's defects for this car, newest test first (from the record held this session). */
export function motLines(spec: CarSpec | null): MotLine[] {
  const a = spec?.plate ? recordOf(spec.plate) : null;
  if (!a?.ok) return [];
  return a.report.tests.slice(0, 2).flatMap((t) => t.defects.map((d) => ({ type: d.type, text: d.text, dangerous: d.dangerous, date: t.date })));
}

const day = (iso = '') => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]} ${m[1]}` : '';
};

/** A part's sheet, as the pane and the FIX IT list show it. */
export function sheetEl(id: string, spec: CarSpec | null): HTMLElement {
  const name = labelOf(id, spec ?? undefined);
  if (!isPart(id)) return h('section.carsheet', { 'aria-label': name }, h('h3', name));
  const p = PARTS[id];
  const what = id === 'engine_cover' && spec?.electric ? 'The electric motor and its electronics, under a cover.' : p.what;
  const mot = motFor(id, motLines(spec));
  const row = (k: string, v: string | Node) => [h('dt', k), h('dd', v)];
  return h(
    'section.carsheet',
    { 'aria-label': name, dataset: { part: id } },
    h('h3', name),
    h(
      'dl',
      ...row('WHAT IT IS', what),
      ...row('A 30-SECOND CHECK', p.check),
      ...row('DIY OR GARAGE', p.diy),
      ...row('A ROUGH COST', `${money(p.cost)}: ${p.covers}. ${ESTIMATE.charAt(0).toUpperCase()}${ESTIMATE.slice(1)}.`),
      ...(mot.length ? row('THE MOT SAID', mot.map((m) => `“${m.text}” (${m.type.toLowerCase()}${m.date ? `, ${day(m.date)}` : ''})`).join(' · ')) : []),
    ),
  );
}

export function carPane(view: HTMLElement): CarPane {
  const stage = h('div.carstage');
  stage.hidden = true;
  view.append(stage);
  const scene = new CarScene(stage);
  const name = h('b.carname');
  const line = h('small.carstandin');
  const nightBtn = button('NIGHT', () => {
    scene.setNight(!scene.night);
    paintHud();
  });
  nightBtn.classList.add('carnight');
  stage.append(h('div.carhud', name, h('div.carchips', nightBtn)), line);

  // the views, one tap each
  const viewBtns = VIEWS.map((v) => {
    const b = button(v.label, () => go(v.id));
    b.dataset.view = v.id;
    b.dataset.case = 'keep';
    return b;
  });
  const views = h('div.carviews', { role: 'group', 'aria-label': 'Look at the car' }, ...viewBtns);
  const facts = h('div.carfacts');
  const sheet = h('div.carsheetbox', h('p.note.carpicked', 'Tap any part of the car for what it is, a quick check and a rough cost.'));
  const el = h('div.studiopane.carpane', views, facts, sheet);

  let shown: CarSpec | null = null;
  let on = false;
  let sheetId = '';

  const paintViews = () => {
    for (const b of viewBtns) {
      const at = b.dataset.view === scene.view;
      b.classList.toggle('on', at);
      b.setAttribute('aria-pressed', String(at));
    }
  };
  const paintHud = () => {
    const s = shown;
    nightBtn.textContent = scene.night ? 'DAY' : 'NIGHT';
    nightBtn.setAttribute('aria-label', scene.night ? 'Show the car by day' : 'Show the car at night, lamps on');
    paintViews();
    if (!s) return;
    const whose = carNow.get().whose;
    name.textContent = whose ? `${whose === 'me' ? 'Your' : `${whose}'s`} car · ${s.title}` : s.title;
    line.textContent = standInLine(s);
    clear(facts, h('b', s.title), h('span', [shapeWords(s), s.paint.name, s.year ? String(s.year) : '', s.fuel, s.plate].filter(Boolean).join(' · ')));
  };
  const showSheet = (id: string) => {
    sheetId = id;
    clear(sheet, sheetEl(id, shown));
  };
  const go = (v: View) => {
    scene.setView(v);
    carNow.set({ view: v });
    paintViews();
  };

  scene.onPick = (id) => showSheet(id);

  const enter = async () => {
    on = true;
    stage.hidden = false;
    const spec = carNow.get().spec ?? shown ?? specFrom(null);
    if (spec !== shown) {
      if (!(await scene.init())) {
        clear(facts, h('p.note', scene.error));
        return;
      }
      shown = spec;
      scene.night = new Date().getHours() >= 19 || new Date().getHours() < 7;
      await scene.show(spec);
      sheetId = '';
      clear(sheet, h('p.note.carpicked', 'Tap any part of the car for what it is, a quick check and a rough cost.'));
    }
    if (carNow.get().view !== scene.view) scene.setView(carNow.get().view);
    paintHud();
    if (on) scene.start();
  };
  const leave = () => {
    on = false;
    stage.hidden = true;
    scene.stop();
  };
  // a car shown while the pane is open replaces the one on the stage; a view asked for is gone to
  carNow.subscribe((s, prev) => {
    if (!on) return;
    if (s.spec && s.spec !== prev.spec) void enter();
    else if (s.view !== scene.view) go(s.view);
  });

  const g = window as unknown as { __ghosty?: Record<string, unknown> };
  (g.__ghosty ??= {}).car = {
    state: () => ({ ...scene.state(), spec: shown, standIn: line.textContent, on, sheet: sheetId }),
    screenOf: (id: string) => scene.screenOf(id),
    show: (f: CarFacts | null) => carNow.set({ spec: specFrom(f), whose: '' }),
    night: (v: boolean) => (scene.setNight(v), paintHud()),
    view: (v: View) => go(v),
    light: (ids: string[]) => scene.light(ids),
    /** Turn the camera round the car by some degrees (a test's second frame; a look from behind). */
    turn: (deg: number) => scene.turn(deg),
  };
  return { el, scene, enter, leave };
}
