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
import type { ScreenContext } from '../../../../packages/shared/src/awareness';
import { carContext } from './awareness';
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { costWords, faultFor, symptomOf, type FaultPick } from './faults';
import { ESTIMATE, PARTS, VIEWS, isPart, money, motFor, viewOf, type MotLine, type View } from './parts';
import { closeGuide, openGuide } from './guide';
import { CarScene, labelOf } from './scene';
import { carNow, motOf, setFault } from './state';
import { shapeWords, specFrom, standInLine, type CarFacts, type CarSpec } from './spec';
import { engineLine, engineModel, factsOf, firingWords, nameFor, numbersFor, partWords, STROKES, STROKE_WORDS, type Stroke } from './engine';
import { ESTIMATE as ENGINE_ESTIMATE } from '../engine3d/scene';

export interface CarPane {
  /** What goes in the Studio's panel. */
  el: HTMLElement;
  scene: CarScene;
  enter(): Promise<void>;
  leave(): void;
  /** What is on the pane (BRIEF-AWARENESS), null while it is not showing. */
  context(): ScreenContext | null;
}

/** The MOT history's defects for this car, newest test first (from the record held this session). */
export const motLines = (spec: CarSpec | null): MotLine[] => (spec?.plate ? motOf(spec.plate) : []);

const day = (iso = '') => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${Number(m[3])} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(m[2]) - 1]} ${m[1]}` : '';
};

/** FIND IT ON THE CAR: the Lens guide for a part (its picture beside the camera). */
function findBtn(scene: CarScene, id: string): HTMLButtonElement {
  const b = button('FIND IT ON THE CAR', () => void openGuide(scene, id), 'carfind');
  b.dataset.case = 'keep';
  b.setAttribute('aria-label', `Find the ${labelOf(id, scene.spec ?? undefined)} on the real car, with the camera`);
  return b;
}

/** A part's sheet, as the pane and the FIX IT list show it. */
export function sheetEl(id: string, spec: CarSpec | null, scene?: CarScene, inst = ''): HTMLElement {
  const model = spec && isPart(id) && viewOf(id) === 'bay' ? engineModel(factsOf(spec)) : null;
  const name = inst || (model && isPart(id) ? nameFor(model, id) : labelOf(id, spec ?? undefined));
  if (!isPart(id)) return h('section.carsheet', { 'aria-label': name }, h('h3', name));
  const p = PARTS[id];
  const what = id === 'engine_cover' && spec?.electric ? 'The electric motor and its electronics, under a cover.' : p.what;
  const mot = motFor(id, motLines(spec));
  const row = (k: string, v: string | Node) => [h('dt', k), h('dd', v)];
  return h(
    'section.carsheet',
    { 'aria-label': name, dataset: { part: id, ...(inst ? { inst } : {}) } },
    h('h3', name),
    h(
      'dl',
      ...row('WHAT IT IS', what),
      // the numbers of this engine, each with its word (an estimate, typical, or from the MOT record)
      ...(model && numbersFor(model, id).length ? row('THIS ENGINE', h('ul.carnums', ...numbersFor(model, id).map((n) => h('li', n)))) : []),
      ...row('A 30-SECOND CHECK', p.check),
      ...row('DIY OR GARAGE', p.diy),
      ...row('A ROUGH COST', `${money(p.cost)}: ${p.covers}. ${ESTIMATE.charAt(0).toUpperCase()}${ESTIMATE.slice(1)}.`),
      ...(mot.length ? row('THE MOT SAID', mot.map((m) => `“${m.text}” (${m.type.toLowerCase()}${m.date ? `, ${day(m.date)}` : ''})`).join(' · ')) : []),
    ),
    scene ? findBtn(scene, id) : null,
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
  const line = h('small.carstandin', { role: 'status' });
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
  // THE WORKING ENGINE (BRIEF-WORKING-ENGINE): under the bonnet-up view, the cover to lift, then the engine turning with its four strokes named,
  // REVS, PAUSE, STEP, TAKE APART, SECTION and MEASURE. Every size is an estimate and says so once; nothing is certified.
  const coverBtn = button('LIFT THE COVER', () => {
    const on = !((scene.engine?.cover ?? 0) > 0.5 || scene.engine?.cover === 1);
    scene.liftCover(on);
    paintEngine();
  }, 'e3tool carcover');
  coverBtn.dataset.case = 'keep';
  const estLine = h('p.e3est.carest', ENGINE_ESTIMATE);
  const intro = h('p.e3say.carengintro');
  const strokeName = h('b.carstroke');
  const strokeSay = h('span.carstrokesay');
  const crankSay = h('small.carcrank');
  const strokes = h('div.carstrokes', { 'aria-live': 'polite' }, strokeName, strokeSay, crankSay);
  const fireLabel = h('span.carfirelabel');
  const fireChips = h('span.carfirechips');
  const fire = h('div.carfire', fireLabel, fireChips);
  const rev = h('input', { type: 'range', min: '600', max: '6000', step: '100', value: '800', 'aria-label': 'Engine speed, revs a minute', class: 'carrevs' }) as HTMLInputElement;
  const revOut = h('output.carrevout');
  rev.addEventListener('input', () => scene.setRpm(Number(rev.value)));
  const revs = h('label.carrow', h('span.carrowl', 'REVS'), rev, revOut);
  const pauseBtn = button('PAUSE', () => {
    scene.pause(!scene.engine?.paused);
    paintEngine();
  }, 'e3tool carpause');
  const stepBtn = button('STEP', () => {
    scene.stepEngine(90);
    paintEngine();
  }, 'e3tool carstep');
  stepBtn.setAttribute('aria-label', 'Step: turn the crank a quarter turn');
  const apart = h('input', { type: 'range', min: '0', max: '100', step: '1', value: '0', 'aria-label': 'How far apart', class: 'carapart' }) as HTMLInputElement;
  const apartOut = h('output.carrevout', '0%');
  apart.addEventListener('input', () => {
    scene.setExplode(Number(apart.value) / 100);
    paintEngine();
  });
  const apartRow = h('label.carrow', h('span.carrowl', 'TAKE APART'), apart, apartOut);
  const sectionBtn = button('SECTION', () => {
    scene.setSection(!scene.engine?.section);
    paintEngine();
  }, 'e3tool carsection');
  const measureBtn = button('MEASURE', () => {
    scene.setMeasuring(!scene.engineState()?.measuring);
    paintEngine();
  }, 'e3tool carmeasure');
  const measureOut = h('span.carmeasured', { 'aria-live': 'polite' });
  const motion = h('p.e3note.carmotion');
  const ctl = h('div.carengctl', strokes, fire, revs, h('div.carengrow', pauseBtn, stepBtn), motion, apartRow, h('div.carengrow', sectionBtn, measureBtn), measureOut);
  const engBox = h('section.carengine', { 'aria-label': 'The engine' }, estLine, intro, coverBtn, ctl);
  engBox.hidden = true;
  const el = h('div.studiopane.carpane', views, engBox, fixit, facts, sheet);

  let shown: CarSpec | null = null;
  let on = false;
  let sheetId = '';

  const paintViews = () => {
    for (const b of viewBtns) {
      const at = b.dataset.view === scene.view;
      b.classList.toggle('on', at);
      b.setAttribute('aria-pressed', String(at));
    }
    paintEngine();
  };
  let engWas = '';
  /** The engine's controls and words: shown only with the bonnet up; the strokes line follows the crank. */
  function paintEngine(): void {
    const st = scene.engineState();
    engBox.hidden = scene.view !== 'bay' || !st;
    if (!st || engBox.hidden) return;
    const lifted = st.cover >= 0.99;
    const m = scene.engine!.model;
    intro.textContent = lifted ? '' : m.electric ? 'Under the cover is the motor. Lift it to see it turn.' : 'Under the cover is the engine. Lift it to see it work.';
    coverBtn.textContent = lifted ? 'PUT THE COVER BACK' : 'LIFT THE COVER';
    coverBtn.setAttribute('aria-pressed', String(lifted));
    ctl.hidden = st.cover < 0.05;
    if (ctl.hidden) return;
    // the strokes, cylinder one: named as they happen, with the firing order under it and the cylinder on its power stroke lit
    if (m.electric) {
      strokeName.textContent = 'ELECTRIC MOTOR';
      strokeSay.textContent = 'No strokes and no valves: it just turns.';
    } else {
      strokeName.textContent = `CYLINDER 1 · ${st.stroke1}`;
      strokeSay.textContent = `${STROKES.map((x) => (x === st.stroke1 ? `${x}` : x.toLowerCase())).join(' · ')}: ${STROKE_WORDS[st.stroke1 as Stroke](m.diesel)}.`;
    }
    crankSay.textContent = `Crank at ${Math.round(st.crank)}° of 720°${st.reduced ? ' · stepped' : st.paused ? ' · paused' : ''}`;
    fire.hidden = m.electric;
    fireLabel.textContent = `FIRING ORDER ${st.firing}`;
    const chipKey = `${st.firing}|${st.power.join(',')}`;
    if (chipKey !== engWas) {
      engWas = chipKey;
      clear(fireChips, ...st.firing.split('-').map((c) => h(st.power.includes(Number(c)) ? 'i.carfirechip.on' : 'i.carfirechip', { 'aria-label': `Cylinder ${c}${st.power.includes(Number(c)) ? ', on its power stroke' : ''}` }, c)));
    }
    if (document.activeElement !== rev) rev.value = String(st.rpm);
    revOut.textContent = `${st.rpm.toLocaleString('en-GB')} rpm · slowed ${20}×`;
    pauseBtn.textContent = st.paused && !st.reduced ? 'PLAY' : 'PAUSE';
    pauseBtn.hidden = st.reduced;
    pauseBtn.setAttribute('aria-pressed', String(st.paused));
    motion.textContent = st.reduced ? 'Reduce Motion is on, so it stays still: STEP turns it a quarter at a time.' : '';
    if (document.activeElement !== apart) apart.value = String(Math.round(st.explode * 100));
    apartOut.textContent = `${Math.round(st.explode * 100)}%`;
    sectionBtn.setAttribute('aria-pressed', String(st.section));
    sectionBtn.classList.toggle('on', st.section);
    measureBtn.setAttribute('aria-pressed', String(st.measuring));
    measureBtn.classList.toggle('on', st.measuring);
    measureBtn.textContent = st.measuring ? `MEASURING · TAP POINT ${Math.min(2, st.points + 1)} OF 2` : 'MEASURE';
    measureOut.textContent = st.cm !== null ? `${st.cm.toLocaleString('en-GB')} cm between the two points, an estimate` : '';
  }

  const paintHud = () => {
    const s = shown;
    nightBtn.textContent = scene.night ? 'DAY' : 'NIGHT';
    nightBtn.setAttribute('aria-label', scene.night ? 'Show the car by day' : 'Show the car at night, lamps on');
    paintViews();
    if (!s) return;
    const whose = carNow.get().whose;
    name.textContent = whose ? `${whose === 'me' ? 'Your' : `${whose}'s`} car · ${s.title}` : s.title;
    // the engine is the one honest line with the bonnet up (a typical engine for a car like this, an estimate); the stand-in's line elsewhere
    line.textContent = scene.view === 'bay' && scene.engine ? engineLine(scene.engine.model) : standInLine(s);
    clear(facts, h('b', s.title), h('span', [shapeWords(s), s.paint.name, s.year ? String(s.year) : '', s.fuel, s.plate].filter(Boolean).join(' · ')));
  };
  const showSheet = (id: string, name = '') => {
    sheetId = id;
    // a part of the working engine is named by its own name ("Piston 2"); anything else by its sheet
    clear(sheet, sheetEl(id, shown, scene, scene.engine && scene.view === 'bay' && name !== labelOf(id, shown ?? undefined) && name !== PARTS[id as keyof typeof PARTS]?.name ? name : ''));
  };
  const go = (v: View) => {
    scene.setView(v);
    carNow.set({ view: v });
    paintViews();
    paintHud();
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
            h('dd', findBtn(scene, x.parts[0]!)),
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

  scene.onPick = (id, name) => showSheet(id, name);
  scene.onEngine = () => paintEngine();

  // one at a time: the Studio's own enter and a pane change can both ask while the car is still being built
  let busy: Promise<void> = Promise.resolve();
  let want = false;
  const enter = () => {
    want = true;
    return (busy = busy.then(enterNow, enterNow));
  };
  const enterNow = async () => {
    // left again before its turn came
    if (!want) return;
    on = true;
    stage.hidden = false;
    const spec = carNow.get().spec ?? shown ?? specFrom(null);
    if (spec !== shown) {
      // a wait over half a second says what it is doing (three.js loading, then the car and its engine being built)
      const waiting = setTimeout(() => {
        if (want && shown !== spec) line.textContent = carNow.get().view === 'bay' ? 'Building the engine…' : 'Building the car…';
      }, 500);
      if (!(await scene.init())) {
        clearTimeout(waiting);
        line.textContent = '';
        clear(facts, h('p.note', scene.error));
        return;
      }
      shown = spec;
      scene.night = new Date().getHours() >= 19 || new Date().getHours() < 7;
      await scene.show(spec);
      clearTimeout(waiting);
      if (!want) return;
      litFor = null;
      sheetId = '';
      clear(sheet, h('p.note.carpicked', 'Tap any part of the car for what it is, a quick check and a rough cost.'));
    }
    if (carNow.get().view !== scene.view) scene.setView(carNow.get().view);
    // "how does an engine work": the bay opens with the cover already lifted and the engine turning
    if (carNow.get().cover) {
      carNow.set({ cover: false });
      scene.liftCover(true);
    }
    open = 0;
    lightFault();
    paintHud();
    paintFixit();
    if (on) scene.start();
  };
  const leave = () => {
    want = false;
    on = false;
    stage.hidden = true;
    scene.stop();
    // (left by a tab or by voice with FIND IT ON THE CAR open: its camera and its stage go with the pane)
    closeGuide();
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
    /** The working engine (BRIEF-WORKING-ENGINE): what it says, and the moves a test makes. */
    engine: {
      state: () => scene.engineState(),
      lift: (on: boolean) => (scene.liftCover(on), paintEngine()),
      pause: (on: boolean) => (scene.pause(on), paintEngine()),
      step: (deg = 90) => (scene.stepEngine(deg), paintEngine()),
      rpm: (n: number) => (scene.setRpm(n), paintEngine()),
      explode: (t: number) => (scene.setExplode(t), paintEngine()),
      section: (on: boolean) => (scene.setSection(on), paintEngine()),
      measure: (on: boolean) => (scene.setMeasuring(on), paintEngine()),
      /** A part's place on the screen by its id or its own name ("Piston 2"), page coordinates. */
      screenOf: (id: string) => scene.screenOf(id),
      /** Tap a part by name (as a tap on it would). */
      pick: (inst: string) => {
        const p = scene.engineState()?.parts.find((x) => x.inst === inst);
        if (p) scene.pick(p.id, undefined, inst);
      },
      /** The line the strokes block says now. */
      line: () => `${strokeName.textContent} | ${strokeSay.textContent} | ${crankSay.textContent}`,
      text: () => engBox.innerText,
    },
  };
  return { el, scene, enter, leave, context: () => (on ? carContext({ spec: shown, view: scene.view, picked: scene.state().picked, fault: carNow.get().fault, inst: scene.engine?.selected ?? '' }) : null) };
}
