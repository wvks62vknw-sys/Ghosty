/**
 * THE LENS GUIDE (BRIEF-CAR item 5): with the camera on the real car, a SIDE-BY-SIDE guide — the stand-in's picture of the
 * part he is looking for, lit, beside the live view, with its plain description ("a black box with a red cover on one
 * terminal, usually at a front corner"). Nothing is recognised: he matches it by eye, and one small line says so. The
 * camera opens on his tap (FIND IT ON THE CAR), is used here only, nothing of it leaves the phone, and it closes with
 * the guide.
 */
import { h } from '../core/dom';
import { button } from '../ui/components';
import { Camera, cameraMessage } from '../vision/camera';
import { PARTS, isPart } from './parts';
import type { CarScene } from './scene';
import { labelOf } from './scene';

let open: { el: HTMLElement; cam: Camera } | null = null;

export function closeGuide(): void {
  if (!open) return;
  open.cam.stop();
  open.el.remove();
  open = null;
}

/** Open the guide for a part: its picture from the car on the stage, the camera beside it. */
export async function openGuide(scene: CarScene, id: string): Promise<void> {
  closeGuide();
  const name = labelOf(id, scene.spec ?? undefined);
  const looks = isPart(id) ? PARTS[id].looks : '';
  const pic = h('img.carguidepic', { alt: `The stand-in’s picture of the ${name}, lit` });
  const video = h('video.carguidecam', { 'aria-label': 'What your camera sees' });
  const camNote = h('p.note.carguidecamnote');
  const cam = new Camera(video);
  const el = h(
    'div.carguide',
    { role: 'dialog', 'aria-label': `Find the ${name} on the car` },
    h('div.carguidehead', h('b', `Find the ${name}`), button('CLOSE', () => closeGuide(), 'carguideclose')),
    h('div.carguidepair', h('figure.carguidefig', pic, h('figcaption', 'THE STAND-IN')), h('figure.carguidefig', video, camNote, h('figcaption', 'YOUR CAMERA'))),
    h('p.carguidelooks', looks ? `Look for ${looks}.` : name),
    h('small.carguidehonest', 'I don’t recognise parts from the camera: match it by eye with the picture. Engine off and cool before you touch anything.'),
  );
  document.body.append(el);
  open = { el, cam };
  pic.src = scene.picture(id) ?? '';
  try {
    await cam.start('environment');
  } catch (e) {
    camNote.textContent = cameraMessage(e);
  }
}
