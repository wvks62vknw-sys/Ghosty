/**
 * The 3D STUDIO's CAR pane (BRIEF-CAR): the car drawn over the Studio's view (car/scene.ts), its name and the one honest
 * line (the stand-in, said once), DAY / NIGHT, and under it what the car is and what was tapped. The Studio
 * (features/studio/index.ts) shows it for the `car` sample and the CAR · FIX IT pane, and stops it when it is left.
 * A test reads and drives it through window.__ghosty.car.
 */
import { h, clear } from '../core/dom';
import { button } from '../ui/components';
import { CarScene } from './scene';
import { carNow } from './state';
import { shapeWords, specFrom, standInLine, type CarFacts, type CarSpec } from './spec';

export interface CarPane {
  /** What goes in the Studio's panel. */
  el: HTMLElement;
  scene: CarScene;
  enter(): Promise<void>;
  leave(): void;
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

  const facts = h('div.carfacts');
  const picked = h('p.note.carpicked', 'Tap any part of the car to see its name.');
  const el = h('div.studiopane.carpane', facts, picked);

  let shown: CarSpec | null = null;
  let on = false;

  const paintHud = () => {
    const s = shown;
    nightBtn.textContent = scene.night ? 'DAY' : 'NIGHT';
    nightBtn.setAttribute('aria-label', scene.night ? 'Show the car by day' : 'Show the car at night, lamps on');
    if (!s) return;
    const whose = carNow.get().whose;
    name.textContent = whose ? `${whose === 'me' ? 'Your' : `${whose}'s`} car · ${s.title}` : s.title;
    line.textContent = standInLine(s);
    clear(
      facts,
      h('b', s.title),
      h('span', [shapeWords(s), s.paint.name, s.year ? String(s.year) : '', s.fuel, s.plate].filter(Boolean).join(' · ')),
    );
  };

  scene.onPick = (_id, label) => {
    picked.textContent = label;
  };

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
    }
    paintHud();
    if (on) scene.start();
  };
  const leave = () => {
    on = false;
    stage.hidden = true;
    scene.stop();
  };
  // a car shown while the pane is open replaces the one on the stage
  carNow.subscribe((s, prev) => {
    if (on && s.spec && s.spec !== prev.spec) void enter();
  });

  const g = window as unknown as { __ghosty?: Record<string, unknown> };
  (g.__ghosty ??= {}).car = {
    state: () => ({ ...scene.state(), spec: shown, standIn: line.textContent, on }),
    screenOf: (id: string) => scene.screenOf(id),
    show: (f: CarFacts | null) => carNow.set({ spec: specFrom(f), whose: '' }),
    night: (v: boolean) => (scene.setNight(v), paintHud()),
    /** Turn the camera round the car by some degrees (a test's second frame; a look from behind). */
    turn: (deg: number) => scene.turn(deg),
  };
  return { el, scene, enter, leave };
}
