/**
 * THE RUNNING COACH (BRIEF-PACKS-1 item 2): the phone's own GPS while the screen is on (a wake lock keeps it on), the
 * distance, the time and the pace now and on average, each kilometre said aloud; RUN SAVED puts the run in the chat as a
 * card and sends my brain the distance, the time and the splits — never a position. The route stays on this phone, in
 * memory only, and goes when the sheet closes. The sums: packages/shared/src/body.ts (runStep).
 */
import { clock, paces, runCard, runStart, runStep, runSummary, splitWords, type RunState } from '../../../../../packages/shared/src/body';
import { h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { speakIn } from '../../assistant/voice';
import { brain } from '../../api/brain';
import { bodyState, type Screen } from './index';

export function runScreen(): Screen {
  let s: RunState = runStart(Date.now());
  let watch: number | null = null;
  let tick = 0;
  let lock: { release(): Promise<void> } | null = null;
  const dist = h('b.pkbig', { 'aria-live': 'off' }, '0.00');
  const time = h('b.pkmid', '0:00');
  const pace = h('span.pklab', 'pace —');
  const splits = h('ol.pklist', { 'aria-label': 'Kilometre splits' });
  const status = h('p.pknote', { 'aria-live': 'polite' }, 'Your route stays on this phone. RUN SAVED sends my brain only the distance, time and splits.');
  const paint = () => {
    dist.textContent = s.km.toFixed(2);
    time.textContent = clock(s.secs);
    const p = paces(s);
    pace.textContent = `pace ${p.now ? clock(p.now) : '—'} now · ${p.avg ? clock(p.avg) : '—'} average (a km)`;
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
      status.textContent = 'This phone has no GPS I can use here.';
      return;
    }
    s = runStart(Date.now());
    splits.replaceChildren();
    bodyState.run.saved = false;
    try {
      lock = await (navigator as unknown as { wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock?.request('screen') ?? null;
    } catch {
      lock = null;
    }
    status.textContent = lock ? 'Running: keep the screen on (it stays on by itself).' : 'Running: keep the screen on — the GPS stops when the phone locks.';
    bodyState.run.on = true;
    watch = navigator.geolocation.watchPosition(
      (p) => {
        const r = runStep(s, { lat: p.coords.latitude, lon: p.coords.longitude, t: p.timestamp || Date.now(), acc: p.coords.accuracy });
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
        status.textContent = e.code === 1 ? 'The phone said no to the GPS: allow location for Ghosty in Settings.' : 'The GPS lost its fix: it carries on when it finds one.';
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    tick = window.setInterval(() => {
      s = { ...s, secs: (Date.now() - s.start) / 1000 };
      paint();
    }, 1000);
  }, 'on');
  start.setAttribute('aria-label', 'Start the run');
  const save = button('Run saved', async () => {
    stop();
    const sum = runSummary(s);
    if (sum.km < 0.05) {
      status.textContent = 'Not far enough to keep yet.';
      return;
    }
    bodyState.run.saved = true;
    void import('../core/cards').then((m) => m.postCard(runCard(sum))).catch(() => undefined);
    try {
      await brain.packDo('body', 'log', { run: sum });
      status.textContent = `Kept: ${sum.km.toFixed(2)} km in ${clock(sum.secs)}. The route stayed on this phone.`;
    } catch {
      toast('Saved here, but my brain didn’t answer: it isn’t kept there this time.', 'warn');
    }
  });
  save.setAttribute('aria-label', 'Run saved: keep the run');
  paint();
  const el = h('div.pkcol', h('div.pkhero', dist, h('span.pklab', 'kilometres')), h('div.pkhero', time, pace), h('div.pkrow', start, save), splits, status);
  return { el, stop };
}
