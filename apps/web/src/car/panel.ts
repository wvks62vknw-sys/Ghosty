/**
 * The 3D STUDIO's CAR pane (BRIEF-CAR): the car drawn over the Studio's view (car/scene.ts), its name and the one honest
 * line (the stand-in, said once), DAY / NIGHT; under it the views — CAR, BONNET UP, WHEEL OFF, UNDERNEATH — then FIX IT
 * (item 4): the safety line first when there is one, WHAT'S WRONG? in his words, NEXT STEP (the check to do first) and the
 * suspects in order, each opening to its check, DIY or garage and cost, its parts lit on the car; and the sheet
 * of whatever part was tapped: WHAT IT IS, A 30-SECOND CHECK, DIY OR GARAGE, A ROUGH COST (a first estimate, never a
 * quote) and what the MOT said about it when it said something. The Studio (features/studio/index.ts) shows it for the
 * `car` sample and the CAR · FIX IT pane, and stops it when it is left. A test reads and drives it through
 * window.__ghosty.car.
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { costWords, faultFor, symptomOf, type FaultPick } from './faults';
import { ESTIMATE, PARTS, VIEWS, isPart, money, motFor, viewOf, type MotLine, type View } from './parts';
import { CarScene, labelOf } from './scene';
import { carNow, motOf, setFault } from './state';
import { shapeWords, specFrom, standInLine, type CarFacts, type CarSpec } from './spec';

export interface CarPane {
  /** What goes in the Studio's panel. */
  el: HTMLElement;
  scene: CarScene;
  enter(): Promise<void>;
  leave(): void;
}

/** The MOT history's defects for this car, newest test first (from the record held this session). */
export const motLines = (spec: CarSpec | null): MotLine[] => (spec?.plate ? motOf(spec.plate) : []);

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

/** The view a part is seen in (anything else is on the outside). */
const viewOfPart = (id: string): View => (isPart(id) ? viewOf(id) : 'car');

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
  // FIX IT: what is wrong, in his words; the suspects in order
  const fixit = h('section.carfixit', { 'aria-label': 'Fix it' });
  const wrongIn = h('input.carwrong', { type: 'text', placeholder: 'What’s wrong? “grinding when I brake”', 'aria-label': 'What’s wrong with the car? In your own words', enterKeyHint: 'go', autocomplete: 'off', maxLength: 200 });
  const wrongNote = h('p.note.carwrongnote');
  const wrongForm = h('form.carwrongform', { onsubmit: (e: Event) => {
    e.preventDefault();
    const t = wrongIn.value.trim();
    if (!t) return;
    const sp = shown ?? specFrom(null);
    const sym = symptomOf(t, true);
    if (!sym) {
      wrongNote.textContent = 'I don’t know that one yet: try “grinding when I brake”, “won’t start, just clicks” or “the battery light is on”.';
      return;
    }
    wrongNote.textContent = '';
    const pick = faultFor(sym, { lines: motLines(sp), electric: sp.electric });
    const card = carNow.get().card || 'car:standin';
    setFault(card, { text: t, pick });
    carNow.set({ fault: pick, view: pick.view, card });
  } }, wrongIn);
  const el = h('div.studiopane.carpane', views, fixit, facts, sheet);

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

  /** How likely, in words (no numbers unless asked). */
  const odds = (p: number, i: number) => (i === 0 ? 'Most likely' : p >= 0.2 ? 'Possible' : 'Less likely');
  let open = 0;
  let litFor: FaultPick | null = null;
  const paintFixit = () => {
    const f = carNow.get().fault;
    if (!f) {
      clear(fixit, h('h3.carfixhead', 'FIX IT'), wrongForm, wrongNote);
      return;
    }
    const rows = f.suspects.map((x, i) => {
      const head = button(h('span.fixrowin', h('b.fixnum', String(i + 1)), h('span.fixlabel', x.label), h('small.fixodds', odds(x.likely, i))), () => {
        open = open === i ? -1 : i;
        paintFixit();
        scene.pick(x.parts[0]!);
      }, 'fixrow');
      head.setAttribute('aria-expanded', String(open === i));
      head.dataset.case = 'keep';
      const body = open === i
        ? h(
            'dl.fixbody',
            h('dt', 'A 30-SECOND CHECK'), h('dd', x.check),
            h('dt', 'DIY OR GARAGE'), h('dd', x.diy),
            h('dt', 'A ROUGH COST'), h('dd', costWords(x)),
            ...(x.mot ? [h('dt', 'THE MOT SAID'), h('dd', `“${x.mot.text}” (${x.mot.type.toLowerCase()})`)] : []),
            h('dt', 'ON THE CAR'),
            h('dd.fixparts', ...x.parts.map((id) => {
              const b = button(PARTS[id].name, () => {
                const v = viewOfPart(id);
                if (v !== scene.view) go(v);
                scene.pick(id);
              }, 'fixpart');
              b.dataset.case = 'keep';
              return b;
            })),
          )
        : null;
      return h('li', head, body);
    });
    clear(
      fixit,
      // the safety line is said first, and once here
      f.safety ? h('p.carsafe', f.safety) : null,
      h('h3.carfixhead', `FIX IT · ${f.symptom.title}`),
      h('p.carnext', h('b', 'NEXT STEP '), f.next),
      h('ol.fixlist', ...rows),
      wrongForm,
      wrongNote,
      h('p.note.carcostnote', `Every cost here is ${ESTIMATE}.`),
    );
  };
  /** Light the fault's suspects on the car (once the car is built and the view chosen). */
  const lightFault = () => {
    const f = carNow.get().fault;
    if (f === litFor) return;
    litFor = f;
    scene.light(f ? f.lit : []);
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
      litFor = null;
      sheetId = '';
      clear(sheet, h('p.note.carpicked', 'Tap any part of the car for what it is, a quick check and a rough cost.'));
    }
    if (carNow.get().view !== scene.view) scene.setView(carNow.get().view);
    open = 0;
    lightFault();
    paintHud();
    paintFixit();
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
    if (s.spec && s.spec !== prev.spec) return void enter();
    if (s.view !== scene.view) go(s.view);
    if (s.fault !== prev.fault) {
      open = 0;
      lightFault();
      paintFixit();
    }
  });

  const g = window as unknown as { __ghosty?: Record<string, unknown> };
  (g.__ghosty ??= {}).car = {
    state: () => {
      const f = carNow.get().fault;
      return { ...scene.state(), spec: shown, standIn: line.textContent, on, sheet: sheetId, fault: f ? { symptom: f.symptom.id, safety: f.safety ?? '', next: f.next, suspects: f.suspects.map((x) => x.label), lit: f.lit } : null };
    },
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
