/**
 * SEE: live object detection in the viewfinder — a box with the name and how sure the detector
 * is for each thing (80 everyday things), a scene line from the classifier (top 3, once a
 * second) and a running count per thing. Tap a box to pick it, then ASK GHOSTY about it, SEARCH
 * by picture, READ the text in it or SAVE a note. FREEZE holds the picture so a box is easy to
 * tap; the held frame is what gets cropped.
 */
import { clear, h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { countLine, cropRect, fromClassifier, fromMediaPipe, hitBox, iou, pct, sceneLine, type Category, type Detection } from '../../vision/boxes';
import { cropCanvas } from '../../vision/camera';
import { FrameBudget, fpsText } from '../../vision/frame';
import { classifier, detector, nextStamp, type ImageClassifierLike, type ObjectDetectorLike } from '../../vision/models';
import type { LensContext, Mode } from './index';

export function createSeeMode(L: LensContext): Mode {
  const S = L.state;
  const budget = new FrameBudget({ maxHz: 10, minHz: 2 });
  let det: ObjectDetectorLike | null = null;
  let cls: ImageClassifierLike | null = null;
  let loading: Promise<void> | null = null;
  let dets: Detection[] = [];
  let scene: Category[] = [];
  let selected = -1;
  let lastScene = 0;
  let lastStatus = 0;

  const selTitle = h('b');
  const card = h('div.lenssel');
  card.hidden = true;
  const hint = h('div.note', 'Each box names what the detector sees (80 everyday things) and how sure it is. Tap a box to pick it; FREEZE holds the picture so a box is easy to tap.');
  const root = h('div.stackf', hint, card);

  const paint = () => {
    if (!L.overlay()) return;
    dets.forEach((d, i) => L.drawBox(d.box, `${d.label} ${pct(d.score)}`, { on: i === selected }));
    S.detections = dets;
    S.scene = scene;
    S.selected = selected;
    S.counts = countLine(dets);
    L.lines(sceneLine(scene), S.counts);
  };
  const select = (i: number) => {
    selected = i >= 0 && i < dets.length ? i : -1;
    const d = selected >= 0 ? dets[selected] : undefined;
    card.hidden = !d;
    if (d) selTitle.textContent = `${d.label.toUpperCase()} · ${pct(d.score)} sure`;
    paint();
  };
  const picked = (): Detection | null => (selected >= 0 ? dets[selected] ?? null : null);
  /** The still (held, or captured now) and the crop around the picked thing. */
  const cropOf = (d: Detection): { still: HTMLCanvasElement; crop: HTMLCanvasElement; rect: ReturnType<typeof cropRect> } | null => {
    const still = L.still();
    if (!still) return null;
    const rect = cropRect(d.box, { w: still.width, h: still.height });
    return { still, crop: cropCanvas(still, rect), rect };
  };
  const needPick = (): Detection | null => {
    const d = picked();
    if (!d) toast('Tap a box first', 'warn');
    return d;
  };
  card.append(
    selTitle,
    h('div.row.wrap',
      button('ASK GHOSTY', () => {
        const d = needPick();
        const c = d && cropOf(d);
        if (!d || !c) return;
        S.lastAction = `ask about ${d.label}`;
        L.setMode('ask', { still: c.crop, question: `What is this ${d.label}? Tell me what you can see about it.`, send: true });
      }, 'warn'),
      button('SEARCH', () => {
        const d = needPick();
        const c = d && cropOf(d);
        if (!c) return;
        L.search(c.still, c.rect);
      }),
      button('READ', () => {
        const d = needPick();
        const c = d && cropOf(d);
        if (!c) return;
        S.lastAction = 'read the crop';
        L.setMode('read', { still: c.crop });
      }),
      button('SAVE', async () => {
        const d = needPick();
        if (!d) return;
        const when = new Date();
        const title = `Lens: ${S.counts || d.label} · ${when.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
        const body = [
          `Seen by the Lens on ${when.toLocaleString('en-GB')}.`,
          `Picked: ${d.label} (${pct(d.score)} sure).`,
          `In view: ${dets.map((x) => `${x.label} ${pct(x.score)}`).join(', ')}.`,
          scene.length ? `Scene: ${sceneLine(scene)}.` : '',
        ].filter(Boolean).join('\n');
        await L.saveNote(title, body, 'note');
      }),
      button('CLEAR', () => select(-1)),
    ),
  );

  const load = () => {
    loading ??= (async () => {
      try {
        det = await detector.get((s) => S.mode === 'see' && L.status(s, 'mid'));
        cls = await classifier.get((s) => S.mode === 'see' && L.status(s, 'mid'));
        if (S.mode === 'see') L.status(S.camera === 'on' ? 'looking…' : 'models ready · START the camera', 'ok');
      } catch (e) {
        loading = null;
        S.error = String((e as Error)?.message ?? e);
        if (S.mode === 'see') L.status(S.error, 'off');
      }
    })();
  };

  return {
    id: 'see',
    enter() {
      clear(L.panel);
      L.panel.append(root);
      load();
      paint();
    },
    leave() {
      select(-1);
      L.clearOverlay();
    },
    tick(now) {
      if (!det || S.frozen) return;
      if (budget.due(now)) {
        const t0 = performance.now();
        let fresh: Detection[];
        try {
          fresh = fromMediaPipe(det.detectForVideo(L.video, nextStamp(now)));
        } catch {
          return;
        }
        budget.record(performance.now() - t0, now);
        // keep the pick on the same thing while it is still there
        if (selected >= 0) {
          const prev = dets[selected];
          selected = prev ? fresh.findIndex((d) => d.label === prev.label && iou(d.box, prev.box) > 0.3) : -1;
          if (selected < 0) card.hidden = true;
        }
        dets = fresh;
        paint();
        S.fps = budget.rate(now);
        if (now - lastStatus > 500) {
          lastStatus = now;
          L.status(`${fpsText(S.fps)} · ${Math.round(budget.ms)} ms a look`, 'ok');
        }
      }
      if (cls && now - lastScene > 1000) {
        lastScene = now;
        try {
          scene = fromClassifier(cls.classifyForVideo(L.video, nextStamp(now)));
        } catch {
          /* the classifier skipped this frame */
        }
        S.scene = scene;
        L.lines(sceneLine(scene), S.counts);
      }
    },
    tap(x, y) {
      select(hitBox(dets, x, y));
    },
    froze(still) {
      // boxes for exactly the held frame
      if (det) {
        try {
          dets = fromMediaPipe(det.detectForVideo(still, nextStamp(performance.now())));
        } catch {
          /* keep the last boxes */
        }
      }
      select(-1);
    },
  };
}
