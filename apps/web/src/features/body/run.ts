/**
 * THE RUNNING COACH (BRIEF-PACKS-1 item 2): the phone's own GPS while the screen is on (a wake lock keeps it on), the
 * distance, the time and the pace now and on average, each kilometre said aloud; RUN SAVED puts the run in the chat as a
 * card and sends my brain the distance, the time and the splits — never a position. The route stays on this phone, in
 * memory only, and goes when the sheet closes. The sums: packages/shared/src/body.ts (runStep).
 */
import { clock, paces, runCard, runStart, runStep, runSummary, splitWords, type RunState } from '../../../../../packages/shared/src/body';
import { h } from '../../core/dom';
import { button } from '../../ui/components';
import { speakIn } from '../../assistant/voice';
import { brain } from '../../api/brain';
import { bodyState, type Screen } from './sheet';
import { phrases, stateIn } from '../lifeui';
import { historyBox, keepRun, runsHooks } from './runs';

export function runScreen(): Screen {
  let s: RunState = runStart(Date.now());
  let watch: number | null = null;
  let tick = 0;
  let lock: { release(): Promise<void> } | null = null;
  // the route, for RUN HISTORY (./runs.ts): kept on this phone only when he taps STOP AND KEEP, never sent
  let route: [number, number, number][] = [];
  const dist = h('b.pkbig', { 'aria-live': 'off' }, '0.00');
  const time = h('b.pkmid', '0:00');
  const pace = h('span.pklab', 'pace — now · — average (min per km)');
  const splits = h('ol.pklist', { 'aria-label': 'Kilometre splits' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Your route stays on this phone. My brain gets only the distance, time and splits.');
  const paint = () => {
    dist.textContent = s.km.toFixed(2);
    time.textContent = clock(s.secs);
    const p = paces(s);
    pace.textContent = `pace ${p.now ? clock(p.now) : '—'} now · ${p.avg ? clock(p.avg) : '—'} average (min per km)`;
    Object.assign(bodyState.run, { km: Math.round(s.km * 1000) / 1000, secs: Math.round(s.secs), splits: s.splits.length });
  };
  const stop = () => {
    if (watch !== null) navigator.geolocation?.clearWatch(watch);
    watch = null;
    clearInterval(tick);
    bodyState.run.on = false;
    void lock?.release().catch(() => undefined);
    lock = null;
  };
  const start = button('Start', async () => {
    if (watch !== null) return;
    if (!navigator.geolocation) {
      /* state: body.run error */
      stateIn(status, 'error', 'This phone has no GPS I can use here.');
      return;
    }
    s = runStart(Date.now());
    route = [];
    splits.replaceChildren();
    bodyState.run.saved = false;
    try {
      lock = await (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null;
    } catch {
      lock = null;
    }
    stateIn(status, '', lock ? 'Running. The screen stays on by itself.' : 'Running. Keep the screen on: the GPS stops when the phone locks.');
    bodyState.run.on = true;
    watch = navigator.geolocation.watchPosition(
      (p) => {
        const r = runStep(s, { lat: p.coords.latitude, lon: p.coords.longitude, t: p.timestamp || Date.now(), acc: p.coords.accuracy });
        if (r.s.last !== s.last && r.s.last) route.push([p.coords.latitude, p.coords.longitude, ((p.timestamp || Date.now()) - r.s.start) / 1000]);
        s = r.s;
        if (r.split) {
          const words = splitWords(r.split.n, s.splits[s.splits.length - 1] ?? s.secs, r.split.secs);
          splits.append(h('li', `${r.split.n} km — ${clock(r.split.secs)}`));
          speakIn(words, 'en');
          navigator.vibrate?.([60, 80, 60]);
        }
        paint();
      },
      (e) => {
        stateIn(status, 'error', e.code === 1 ? 'The phone would not give me the GPS. Settings, Ghosty, Location, then press Start.' : 'The GPS lost its fix. It carries on when it finds one.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    tick = window.setInterval(() => {
      s = { ...s, secs: (Date.now() - s.start) / 1000 };
      paint();
    }, 1000);
  }, 'on');
  start.setAttribute('aria-label', 'Start the run');
  const save = button('Stop and keep', async () => {
    stop();
    const sum = runSummary(s);
    if (sum.km < 0.05) {
      stateIn(status, '', 'Not far enough to keep yet: under 50 metres, measured by the phone.');
      return;
    }
    bodyState.run.saved = true;
    const kept = keepRun(sum.km, sum.secs, s.splits, route);
    runsHooks.redraw();
    void import('../core/cards').then((m) => m.postCard(runCard(sum))).catch(() => undefined);
    try {
      await brain.packDo('body', 'log', { run: sum });
      status.textContent = `Kept: ${sum.km.toFixed(2)} km in ${clock(sum.secs)}, measured by the phone. ${kept ? 'The route is in Your runs below, on this phone only.' : 'The route stayed on this phone.'}`;
    } catch {
      stateIn(status, 'error', `Saved here (${sum.km.toFixed(2)} km, measured by the phone), but my brain didn’t answer, so it isn’t kept there this time.`);
    }
  });
  save.setAttribute('aria-label', 'Stop the run and keep it');
  paint();
  const el = h('div.pkcol', h('div.pkhero', dist, h('span.pklab', 'kilometres, measured by the phone')), h('div.pkhero', time, pace), h('div.pkrow', start, save), splits, status, historyBox(), phrases(['start a run']));
  return { el, stop };
}
