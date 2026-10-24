/** THREATS tab: earthquakes, natural events, space weather and launches, worst first. */
import { flyTo } from '../../commands/builtin';
import { clear, fmt, h } from '../../core/dom';
import { events, kp, launches, launchStatus, liveEvents, quakes, signals, threatLevel, type Launch, type Signal } from '../../data/hazards';
import { GEO } from '../../engine/geo';
import { air } from '../../engine/layers/air';
import { sats } from '../../engine/layers/sats';
import { go, type TabDef } from '../../shell/tabs';
import { home, settings } from '../../state/app';
import { bar, empty, pager, panel, row, SEV_COLORS } from '../../ui/components';
import { page } from '../../ui/page';
import { reconPanel } from './recon';

/** A distance in plain kilometres: "340 km", "5,410 km" (not "5.4k km"). */
const km = (x: number): string => `${Math.round(x >= 1000 ? Math.round(x / 10) * 10 : x).toLocaleString('en-GB')} km`;

export const threatsTab: TabDef = {
  id: 'threats',
  title: 'THREATS',
  icon: '<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  scene: 'backdrop',
  blurb: 'quakes · storms · space weather',
  now() {
    if (!quakes.data && !events.data) return '';
    const list = signals();
    const lvl = threatLevel(list).label;
    return `${lvl.charAt(0)}${lvl.slice(1).toLowerCase()} · ${fmt.n(list.length)} live signals`;
  },
  mount(root) {
    const P = page(root, { tag: 'THREAT ASSESSMENT', sub: 'quakes · natural events · space weather', rightLabel: 'NEAR YOU', leftLabel: 'ALERTS', stack: true });
    const sp = panel('ACTIVE SIGNALS', { footer: true, cls: 'signals' });
    // every row says when (a quake's magnitude is already in its text)
    const sg = pager(sp, 50, (s: Signal) => row(s.kind, s.text, fmt.ago(s.at), { sev: s.sev, wrap: true, onClick: () => void flyTo({ lat: s.lat, lon: s.lon, range_km: 1200 }) }), () => quakes.status);
    P.left.append(sp.el);
    const near = panel('NEAR YOU', { grow: false, cls: 'near' });
    const space = panel('SPACE WEATHER', { grow: false, cls: 'spacewx' });
    const lp = panel('LAUNCH WINDOW', { footer: true, cls: 'launches' });
    const lg = pager(lp, 46, (l: Launch) => row(launchStatus(l.status), l.name.replace(/\s*\|\s*/g, ' · '), new Date(l.net).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), { wrap: true, onClick: () => void flyTo({ lat: l.lat, lon: l.lon, range_km: 600 }) }), () => launches.status, 'No launches listed for the coming days; it checks again by itself.');
    P.right.append(near.el, space.el, lp.el, reconPanel());

    const paint = () => {
      const list = signals();
      const lv = threatLevel(list);
      P.big.textContent = lv.label;
      P.big.style.color = lv.known ? SEV_COLORS[lv.n]! : lv.label === 'CHECKING' ? '' : 'var(--amber)';
      P.sub.textContent = lv.known ? `${list.length} live signals · ${lv.why}` : `${lv.why.charAt(0).toUpperCase()}${lv.why.slice(1)}`;
      sp.setStatus(quakes.status, quakes.status === 'LIVE' ? 'ok' : 'off');
      sg.set(list);
      const L = home();
      clear(near.body);
      const nq = (quakes.data ?? []).map((q) => ({ q, d: GEO.hav(L.lat, L.lon, q.lat, q.lon) })).sort((a, b) => a.d - b.d)[0];
      // (no feed is not "none": say which it is)
      const unknown = (f: typeof quakes | typeof events) => (f.status === 'NO FEED' ? 'can’t reach the feed' : 'checking…');
      // every tile is a tap: the nearest quake or event on the globe, or God's Eye itself
      const eye = { onClick: () => go('eye') };
      near.body.append(row('QUAKE', nq ? `M${nq.q.mag.toFixed(1)} · ${km(nq.d)} away` : quakes.data ? 'none in 48h' : unknown(quakes), null, nq ? { onClick: () => void flyTo({ lat: nq.q.lat, lon: nq.q.lon, range_km: 1200 }) } : eye));
      const ne = liveEvents().map((e) => ({ e, d: GEO.hav(L.lat, L.lon, e.lat, e.lon) })).sort((a, b) => a.d - b.d)[0];
      near.body.append(row('EVENT', ne ? `${ne.e.catName} · ${km(ne.d)} away` : events.data ? 'none in the last 2 weeks' : unknown(events), null, ne ? { onClick: () => void flyTo({ lat: ne.e.lat, lon: ne.e.lon, range_km: 1200 }) } : eye));
      near.body.append(row('AIR', air.list.size ? `${air.nearby(L.lat, L.lon, 60).length} aircraft within 60 km` : 'tap to scan in God’s Eye', null, eye));
      const iss = sats.list.find((s) => /ISS \(ZARYA\)/.test(s.name));
      const pass = iss ? sats.nextPass(iss, L.lat, L.lon) : null;
      near.body.append(row('ISS', pass ? `rises ${fmt.time(new Date(pass.rise))} · max ${Math.round(pass.max)}°` : iss ? 'no pass in 24h' : 'tap to find it in God’s Eye', null, eye));
      // where "near" is measured from: his home, or a guess from the phone's time zone until he sets one
      near.body.append(h('div.note.nearfrom', settings.get().home ? `Measured from ${L.name}.` : `Measured from ${L.name}, a guess from the phone’s time zone: set your home city in Settings.`));
      clear(space.body);
      const k = kp.data && Number.isFinite(kp.data.v) ? kp.data : null;
      if (k) {
        space.body.append(bar('KP INDEX', k.v / 9, k.v.toFixed(1), k.v >= 5 ? '#ff4d6a' : k.v >= 4 ? '#ffd24d' : undefined));
        const at = Date.parse(/Z$|[+-]\d\d:\d\d$/.test(k.t) ? k.t : `${k.t}Z`); // (NOAA's times are UTC, written without the Z)
        space.body.append(h('div.note', `${k.v >= 5 ? 'Geomagnetic storm: aurora likely at high latitudes, GPS may wobble.' : k.v >= 4 ? 'Active conditions. Aurora possible far north.' : 'Quiet. No disturbance expected.'}${Number.isFinite(at) ? ` Measured ${fmt.time(new Date(at))} (every 3 hours).` : ''}`));
      } else space.body.append(empty(kp.status === 'NO FEED' || kp.data ? 'NO FEED' : 'LOADING')); // (a reading that is not a number is no reading)
      lg.set(launches.data ?? []);
      P.dials([
        ['SIGNALS', list.length / 60, String(list.length)],
        ['MAJOR', list.filter((x) => x.sev >= 2).length / 8, String(list.filter((x) => x.sev >= 2).length), '#ff9a3c'],
        ['KP', k ? k.v / 9 : 0, k ? k.v.toFixed(1) : '--', '#ffd24d'],
      ]);
    };
    for (const f of [quakes, events, launches, kp]) f.onChange(paint);
    paint();
    return {
      enter() {
        for (const f of [quakes, events, launches, kp]) f.start();
        paint();
      },
      describe: () => `Threats: level ${P.big.textContent}; ${P.sub.textContent}`,
    };
  },
};
