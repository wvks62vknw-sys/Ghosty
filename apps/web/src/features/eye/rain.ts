/**
 * RAIN RADAR, full screen (NEXT ROUND, see.s3, with see.u1's replay): the last two hours of rain over home played back frame by
 * frame (RainViewer's public radar, free and keyless: it gives past frames only), and one line for home from a free, keyless
 * forecast (Open-Meteo's quarter-hour rain): "Rain at home in about 20 minutes". Asked about his saved home, never about him.
 */
import { fetchJson } from '../../api/feed';
import { h } from '../../core/dom';
import { home } from '../../state/app';
import { button, modal } from '../../ui/components';
import { loadLeaflet } from '../../ui/flatmap';
import { rainLine } from './sets';
export { rainLine };

/* state: eye.rain loading */
export const RAIN_LOADING = 'Fetching the last two hours of radar…';
/* state: eye.rain error */
export const RAIN_DOWN = 'The rain radar is not reachable right now. Try again in a minute.';
/* state: eye.rain offline */
export const RAIN_OFFLINE = 'No signal, so I can’t show the rain radar right now.';

/** What the sheet shows, for the specs (window.__ghosty.rain). */
export const rainState = { open: false, frames: 0, frame: -1, line: '', state: '' as '' | 'loading' | 'ready' | 'error' | 'offline' };

const hm = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function openRainRadar(): void {
  const H = home();
  const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
  if (g) g.rain = rainState;
  Object.assign(rainState, { open: true, frames: 0, frame: -1, line: '', state: 'loading' });
  const host = h('div.rainmap');
  const note = h('p.note.rainnote', { dataset: { state: 'loading', case: 'keep' } }, RAIN_LOADING);
  const line = h('p.rainline', { dataset: { case: 'keep' } });
  line.hidden = true;
  const when = h('b.rainwhen', { dataset: { case: 'keep' } }, '');
  const slider = h('input.rainslider', { type: 'range', min: '0', max: '0', step: '1', value: '0', 'aria-label': 'Radar time' }) as HTMLInputElement;
  let timer = 0;
  const play = button('PAUSE', () => (timer ? stop() : start()));
  play.dataset.act = 'play';
  const controls = h('div.raincontrols', play, slider, when);
  controls.hidden = true;
  const body = h('div.rain', { dataset: { case: 'keep' } }, line, host, controls, note, h('small.dim', 'Radar: RainViewer (the last two hours). The next two hours at home: Open-Meteo’s forecast. Both free.'));
  let map: L.Map | null = null;
  const stop = () => {
    clearInterval(timer);
    timer = 0;
    play.textContent = 'PLAY';
  };
  const close = modal('RAIN RADAR', body, () => {
    clearInterval(timer);
    map?.remove();
    rainState.open = false;
  });
  let frames: { time: number; layer: L.TileLayer }[] = [];
  const show = (i: number) => {
    if (!frames.length || !map) return;
    i = ((i % frames.length) + frames.length) % frames.length;
    frames.forEach((f, k) => f.layer.setOpacity(k === i ? 0.75 : 0));
    slider.value = String(i);
    const f = frames[i]!;
    const ago = Math.round((Date.now() - f.time) / 60_000);
    when.textContent = `${hm(f.time)} · ${ago <= 1 ? 'now' : `${ago} min ago`}`;
    rainState.frame = i;
  };
  const start = () => {
    clearInterval(timer);
    play.textContent = 'PAUSE';
    timer = window.setInterval(() => show(rainState.frame + 1), 700);
  };
  slider.addEventListener('input', () => {
    stop();
    show(Number(slider.value));
  });
  if (navigator.onLine === false) {
    rainState.state = 'offline';
    note.textContent = RAIN_OFFLINE;
    note.dataset.state = 'offline';
    return;
  }
  // the line for home, alongside the radar
  void fetchJson<{ minutely_15?: { time: number[]; precipitation: number[] } }>(`https://api.open-meteo.com/v1/forecast?latitude=${H.lat.toFixed(3)}&longitude=${H.lon.toFixed(3)}&minutely_15=precipitation&forecast_minutely_15=12&timezone=GMT&timeformat=unixtime`, 300)
    .then((w) => {
      const m = w.minutely_15;
      const said = m ? rainLine(m.time.map((t, i) => ({ t: t * 1000, mm: m.precipitation[i] ?? 0 })), Date.now(), H.name || 'home') : '';
      if (!said) return;
      rainState.line = said;
      line.textContent = said;
      line.hidden = false;
    })
    .catch(() => undefined);
  void (async () => {
    try {
      const [Lf, j] = await Promise.all([loadLeaflet(), fetchJson<{ host: string; radar: { past: { time: number; path: string }[] } }>('https://api.rainviewer.com/public/weather-maps.json', 300, 15000)]);
      if (!rainState.open) return;
      const past = (j.radar?.past ?? []).slice(-13);
      if (!past.length) throw new Error('no frames');
      map = Lf.map(host, { zoomControl: false, attributionControl: true }).setView([H.lat, H.lon], 7);
      Lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 12, attribution: '© OpenStreetMap', className: 'osm-dark' }).addTo(map);
      Lf.circleMarker([H.lat, H.lon], { radius: 6, weight: 2 }).addTo(map).bindTooltip(H.name || 'Home');
      frames = past.map((f) => ({ time: f.time * 1000, layer: Lf.tileLayer(`${j.host || 'https://tilecache.rainviewer.com'}${f.path}/256/{z}/{x}/{y}/2/1_1.png`, { opacity: 0, maxZoom: 12, attribution: 'RainViewer' }).addTo(map!) }));
      slider.max = String(frames.length - 1);
      rainState.frames = frames.length;
      rainState.state = 'ready';
      note.hidden = true;
      controls.hidden = false;
      show(frames.length - 1);
      requestAnimationFrame(() => map?.invalidateSize());
      // played back once a moment after it opens (Reduce Motion keeps the newest frame still)
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) start();
      else stop();
    } catch {
      if (!rainState.open) return;
      rainState.state = 'error';
      note.textContent = RAIN_DOWN;
      note.dataset.state = 'error';
    }
  })();
  void close;
}

