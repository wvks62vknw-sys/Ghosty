/**
 * THE WORLD IN THE MORNING BRIEF (NEXT ROUND, see.c2; built small into PLAN's Brief): one card that says, before he leaves,
 *   - the threat level (THREATS' own reading of the quake and storm feeds),
 *   - any road reports on his commute (National Highways, between his saved home and work, West Midlands motorways),
 *   - a fresh picture from the public camera nearest home, a tap opening it live on God's Eye.
 * His saved places only (Memory → ME → PLACES): no position, nothing about him leaves the phone but the public feeds' own asks.
 */
import { brain } from '../../api/brain';
import { fetchImage } from '../../api/feed';
import { clear, h } from '../../core/dom';
import { cams, loadCameras, nearestCameras } from '../../data/cameras';
import { events, quakes, signals, threatLevel } from '../../data/hazards';
import { delayWords, incidents, severity } from '../../data/incidents';
import { home as homeOf } from '../../state/app';
import { panel, row } from '../../ui/components';

/* state: world.brief loading */
export const WORLD_LOADING = 'Looking at the world outside…';
/* state: world.brief offline */
export const WORLD_OFFLINE = 'You’re offline: the world outside comes back with the connection.';
/* state: world.brief empty */
export const WORLD_NO_COMMUTE = 'Save home and work in Memory → ME → PLACES and the road reports on your commute show here.';
export const WORLD_NO_CAMERA = 'No public camera near home.';

const km = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) => {
  const r = Math.PI / 180;
  return Math.hypot((b.lon - a.lon) * r * Math.cos(((a.lat + b.lat) / 2) * r), (b.lat - a.lat) * r) * 6371;
};
const inWestMidlands = (p: { lat: number; lon: number }) => p.lat > 52.2 && p.lat < 52.8 && p.lon > -2.5 && p.lon < -1.2;

/** What the card said, for the Brief's spoken line and the specs (window.__ghosty.briefWorld). */
export const worldState = { threat: '', commute: '', camera: '' };

export function briefWorld(): { el: HTMLElement; paint(): Promise<void> } {
  const p = panel('THE WORLD', { cls: 'brworld', grow: false });
  let url = '';
  const paint = async (): Promise<void> => {
    const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
    if (g) g.briefWorld = worldState;
    if (navigator.onLine === false) {
      p.setStatus('OFFLINE', 'off');
      return void clear(p.body, h('p.note', { dataset: { state: 'offline', case: 'keep' } }, WORLD_OFFLINE));
    }
    p.setStatus('…', 'mid');
    clear(p.body, h('p.note', { dataset: { state: 'loading', case: 'keep' } }, WORLD_LOADING));
    quakes.start();
    events.start();
    loadCameras();
    const places = await brain.places().then((r) => r.places ?? []).catch(() => []);
    const H = places.find((x) => x.id === 'home') ?? (() => { const s = homeOf(); return { lat: s.lat, lon: s.lon, label: s.name || 'Home' }; })();
    const W = places.find((x) => x.id === 'work');
    // the threat level, once the feeds have spoken (a few seconds at most)
    for (let i = 0; i < 40 && !(quakes.data || events.data) && quakes.status !== 'NO FEED'; i++) await new Promise((r) => setTimeout(r, 200));
    const lv = threatLevel(signals());
    worldState.threat = lv.known ? `${lv.label[0]}${lv.label.slice(1).toLowerCase()}: ${lv.why}.` : `${lv.label[0]}${lv.label.slice(1).toLowerCase()}: ${lv.why}`;
    // the commute's road reports
    if (!W) worldState.commute = WORLD_NO_COMMUTE;
    else if (!inWestMidlands(H) && !inWestMidlands(W)) worldState.commute = 'Road reports cover the motorways in the West Midlands; your commute is outside them.';
    else {
      await incidents.refresh('West Midlands').catch(() => undefined);
      const steps = 12;
      const line = Array.from({ length: steps + 1 }, (_, i) => ({ lat: H.lat + ((W.lat - H.lat) * i) / steps, lon: H.lon + ((W.lon - H.lon) * i) / steps }));
      const near = [...incidents.list.values()].filter((i) => line.some((q) => km(q, i) < 3)).sort((a, b) => severity(b) - severity(a));
      worldState.commute = near.length ? `${near.length} on your commute: ${near.slice(0, 2).map((i) => `${i.road} ${i.direction}, ${i.reason || 'incident'}${i.delayS ? ` (${delayWords(i.delayS)})` : ''}`).join('; ')}.` : 'No road reports on your commute.';
    }
    // the public camera nearest home
    for (let i = 0; i < 30 && cams.status === 'SYNC' && !cams.list.length; i++) await new Promise((r) => setTimeout(r, 200));
    const cam = nearestCameras(H.lat, H.lon, 1, 3)[0];
    worldState.camera = cam ? `${cam.name}, ${cam.km < 1 ? `${Math.round(cam.km * 1000)} m` : `${cam.km.toFixed(1)} km`} from home` : WORLD_NO_CAMERA;
    p.setStatus(lv.known ? lv.label : '', lv.n >= 2 ? 'off' : lv.n === 1 ? 'mid' : 'ok');
    const rows: HTMLElement[] = [row('THREAT', worldState.threat, null, { wrap: true, onClick: () => void import('../../shell/tabs').then((t) => t.go('threats')) }), row('COMMUTE', worldState.commute, null, { wrap: true })];
    if (cam) {
      const img = h('img', { alt: `A fresh picture: ${cam.name}` });
      const tile = h('button.brcam', { type: 'button', 'aria-label': `Watch ${cam.name} live on God’s eye` }, img, h('span', worldState.camera));
      tile.addEventListener('click', () => void import('../../commands/registry').then((r) => r.run('show_cameras', { lat: cam.lat, lon: cam.lon, place: cam.name })));
      void fetchImage(cam.image, 30)
        .then((u) => {
          if (url) URL.revokeObjectURL(url);
          url = u;
          img.src = u;
        })
        .catch(() => tile.classList.add('dead'));
      rows.push(h('div.lab', 'YOUR ROAD'), tile);
    } else rows.push(row('YOUR ROAD', WORLD_NO_CAMERA, null, { wrap: true }));
    clear(p.body, ...rows);
  };
  return { el: p.el, paint };
}
