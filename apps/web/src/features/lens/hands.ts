/**
 * HANDS: the gesture recogniser draws the 21 landmarks of each hand and names the gesture and
 * the hand; gestures drive the Lens — thumbs up captures and saves a SEE note, an open palm
 * freezes or unfreezes, two fingers flip the camera, pointing up switches to READ and captures,
 * a closed fist stops the camera. A gesture must be held for about 600 ms, acts once, then
 * nothing counts for 1.5 s (vision/gestures.ts). The HOW row explains the five.
 */
import { clear, h } from '../../core/dom';
import { countLine, fromMediaPipe, pct, sceneLine, type Detection } from '../../vision/boxes';
import { FrameBudget } from '../../vision/frame';
import { GESTURE_HELP, GestureDebouncer, gestureWords, HAND_CONNECTIONS, handSide, type GestureEvent } from '../../vision/gestures';
import { detector, gestures, nextStamp, type GestureRecognizerLike, type MPGestureResult } from '../../vision/models';
import type { LensContext, Mode } from './index';

export function createHandsMode(L: LensContext): Mode {
  const S = L.state;
  const deb = new GestureDebouncer();
  const budget = new FrameBudget({ maxHz: 15, minHz: 3 });
  let rec: GestureRecognizerLike | null = null;
  let loading: Promise<void> | null = null;
  let lastStatus = 0;
  let acting = false;
  /** recognizeForVideo failures in a row (see failed()). */
  let failures = 0;
  /** Bumped on leave: a load still in flight then belongs to a past visit and is dropped. */
  let visit = 0;

  const bigName = h('span', 'no hand in view');
  const bigHand = h('small');
  const holdFill = h('i');
  const how = h('div.lenshow', ...GESTURE_HELP.flatMap((g) => [h('b', g.sign), h('span', g.does)]));
  const root = h('div.stackf',
    h('div.lensgesture', bigName, bigHand),
    h('div.lenshold', holdFill),
    h('div.lab', 'HOW'),
    how,
    h('div.note', 'Hold a gesture for about half a second: it acts once, then the Lens waits a moment. Let go before the next one. Thumbs up needs the SEE models for the labels; they load in the background.'),
  );

  const draw = (r: MPGestureResult) => {
    const c = L.overlay();
    if (!c) return;
    const { frame } = L.view();
    for (const hand of r.landmarks ?? []) {
      const pts = hand.map((p) => L.viewPoint(p.x * frame.w, p.y * frame.h));
      c.strokeStyle = 'rgba(98, 228, 255, .85)';
      c.lineWidth = 2;
      c.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        const pa = pts[a];
        const pb = pts[b];
        if (!pa || !pb) continue;
        c.moveTo(pa.x, pa.y);
        c.lineTo(pb.x, pb.y);
      }
      c.stroke();
      c.fillStyle = '#ffb23e';
      for (const p of pts) {
        c.beginPath();
        c.arc(p.x, p.y, 3, 0, Math.PI * 2);
        c.fill();
      }
    }
  };

  const saveSeeNote = async () => {
    const still = L.still();
    if (!still) return void L.status('nothing to save: the camera is off', 'off');
    let dets: Detection[] = [];
    const d = detector.loaded;
    if (d) {
      try {
        dets = fromMediaPipe(d.detectForVideo(still, nextStamp(performance.now())));
      } catch {
        /* no labels this time */
      }
    }
    const when = new Date();
    const counts = countLine(dets);
    const title = `Lens: ${counts || 'a capture'} · ${when.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
    const body = [
      `Captured by the Lens with a thumbs-up on ${when.toLocaleString('en-GB')}.`,
      dets.length ? `In view: ${dets.map((x) => `${x.label} ${pct(x.score)}`).join(', ')}.` : d ? 'In view: nothing the detector knows by name.' : 'In view: the detector was not loaded yet, so no labels.',
      S.scene.length ? `Scene: ${sceneLine(S.scene)}.` : '',
    ].filter(Boolean).join('\n');
    await L.saveNote(title, body, 'note');
  };

  const act = async (ev: GestureEvent) => {
    if (acting) return;
    acting = true;
    S.lastAction = ev.action;
    try {
      switch (ev.action) {
        case 'freeze':
          L.freeze(!S.frozen);
          break;
        case 'flip':
          await L.flip();
          break;
        case 'read':
          L.setMode('read', { capture: true });
          break;
        case 'stop':
          L.stopCamera();
          L.status('stopped by a closed fist · START opens the camera again', 'mid');
          break;
        case 'save':
          await saveSeeNote();
          break;
      }
    } finally {
      acting = false;
    }
  };

  const progress = (s: string) => S.mode === 'hands' && L.status(s, 'mid');
  const load = () => {
    loading ??= (async () => {
      const v = visit;
      try {
        const r = await gestures.get(progress);
        // left meanwhile (leave() dropped the task, the Lens closed it): the next enter loads again
        if (v !== visit) return;
        rec = r;
        if (S.mode === 'hands') L.status(S.camera === 'on' ? 'show a hand' : 'recogniser ready · START the camera', 'ok');
        // for the thumbs-up note's labels
        void detector.get(() => undefined).catch(() => undefined);
      } catch (e) {
        if (v !== visit) return;
        loading = null;
        S.error = String((e as Error)?.message ?? e);
        if (S.mode === 'hands') L.status(S.error, 'off');
      }
    })();
  };
  /** The recogniser threw on a frame; a few in a row → made again on the CPU (as SEE does for the detector), else the owner is told. */
  const failed = (e: unknown) => {
    if (++failures < 3 || !rec) return;
    failures = 0;
    rec = null;
    const msg = String((e as Error)?.message ?? e);
    if (gestures.delegate === 'CPU') {
      S.error = `The hand recogniser keeps failing: ${msg}`;
      if (S.mode === 'hands') L.status(S.error, 'off');
      return;
    }
    const v = visit;
    void gestures.recreate('CPU', progress).then((r) => {
      if (v !== visit) return;
      rec = r;
      if (S.mode === 'hands') L.status('show a hand (on the CPU: the GPU could not run the recogniser)', 'ok');
    }).catch((e2: unknown) => {
      S.error = `The hand recogniser cannot run here: ${String((e2 as Error)?.message ?? e2)}`;
      if (S.mode === 'hands') L.status(S.error, 'off');
    });
  };

  return {
    id: 'hands',
    enter() {
      clear(L.panel);
      L.panel.append(root);
      load();
      deb.reset();
    },
    leave() {
      L.clearOverlay();
      deb.reset();
      S.gesture = '';
      S.hand = '';
      // the task is taken on entering, every time: leaving the Lens closes it (index.ts)
      visit++;
      rec = null;
      loading = null;
      failures = 0;
    },
    tick(now) {
      if (!rec || !budget.due(now)) return;
      const t0 = performance.now();
      let r: MPGestureResult;
      try {
        r = rec.recognizeForVideo(L.video, nextStamp(now));
      } catch (e) {
        failed(e);
        return;
      }
      failures = 0;
      budget.record(performance.now() - t0, now);
      draw(r);
      const hands = r.landmarks?.length ?? 0;
      const g = r.gestures?.[0]?.[0];
      const name = g?.categoryName ?? '';
      const score = g?.score ?? 0;
      const hand = handSide(r.handedness?.[0]?.[0]?.categoryName);
      S.gesture = hands && name && name !== 'None' ? name : '';
      S.hand = hands ? hand : '';
      bigName.textContent = hands ? gestureWords(name) : 'no hand in view';
      bigHand.textContent = hands ? `${hand}${hands > 1 ? ` + ${hands - 1} more` : ''}` : '';
      const ev = deb.feed(hands ? name : null, score, now);
      holdFill.style.width = `${Math.round(deb.progress(now) * 100)}%`;
      if (ev) {
        // the action's own status line (stopped, frozen…) stands; the rate line below would overwrite it
        void act(ev);
        return;
      }
      S.fps = budget.rate(now);
      if (now - lastStatus > 500 && S.camera === 'on' && !S.frozen) {
        lastStatus = now;
        L.status(deb.coolingDown(now) ? 'done · let go' : hands ? 'hold the gesture' : 'show a hand', 'ok');
      }
    },
  };
}
