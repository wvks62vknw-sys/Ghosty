/**
 * THE LENS GUIDE (BRIEF-CAR item 5): with the camera on the real car, a SIDE-BY-SIDE guide — the stand-in's picture of the
 * part he is looking for, lit, beside the live view, with its plain description ("a black box with a red cover on one
 * terminal, usually at a front corner"). The picture is the car's own stage moved into the guide with its camera
 * brought close to the part, still live (he can turn it), so nothing is read back from it. Nothing is recognised: he
 * matches it by eye, and one small line says so. The camera opens on his tap (FIND IT ON THE CAR), is used here only,
 * nothing of it leaves the phone, and it closes with the guide.
 */
import { h } from '../core/dom';
import { button } from '../ui/components';
import { Camera, cameraMessage } from '../vision/camera';
import { PARTS, isPart } from './parts';
import type { CarScene } from './scene';
import { labelOf } from './scene';

let open: { el: HTMLElement; cam: Camera; stage: HTMLElement; home: Node | null; next: Node | null; scene: CarScene } | null = null;

export function closeGuide(): void {
  if (!open) return;
  const o = open;
  open = null;
  o.cam.stop();
  // the stage goes back where it was, the camera back where it looked
  o.stage.classList.remove('inguide');
  if (o.home) o.home.insertBefore(o.stage, o.next);
  o.scene.unfocus();
  o.el.remove();
}

/** Open the guide for a part: the stand-in's picture of it (the car's stage, brought close, still live), the camera beside it. */
export async function openGuide(scene: CarScene, id: string): Promise<void> {
  closeGuide();
  const name = labelOf(id, scene.spec ?? undefined);
  const looks = isPart(id) ? PARTS[id].looks : '';
  const stage = scene.host;
  const home = stage.parentNode;
  const next = stage.nextSibling;
  const video = h('video.carguidecam', { 'aria-label': 'What your camera sees' });
  const camNote = h('p.note.carguidecamnote');
  const cam = new Camera(video);
  const pic = h('figure.carguidefig.carguidepic');
  const el = h(
    'div.carguide',
    { role: 'dialog', 'aria-label': `Find the ${name} on the car` },
    h('div.carguidehead', h('b', `Find the ${name}`), button('CLOSE', () => closeGuide(), 'carguideclose')),
    h('div.carguidepair', pic, h('figure.carguidefig', video, camNote, h('figcaption', 'YOUR CAMERA'))),
    h('p.carguidelooks', looks ? `Look for ${looks}.` : name),
    h('small.carguidehonest', 'I don’t recognise parts from the camera: match it by eye with the picture. Engine off and cool before you touch anything.'),
  );
  document.body.append(el);
  stage.classList.add('inguide');
  pic.append(stage, h('figcaption', 'THE STAND-IN'));
  open = { el, cam, stage, home, next, scene };
  scene.focus(id);
  try {
    await cam.start('environment');
  } catch (e) {
    camNote.textContent = cameraMessage(e);
  }
}
