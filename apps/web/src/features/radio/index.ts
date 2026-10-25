/** RADIO tab: search internet radio by name, genre or country (UK first); favourites; now playing. */
import { fetchJson } from '../../api/feed';
import { canSetVolume, favourites, lastPlayed, pauseAudio, player, playStation, resumeAudio, setVolume, stopAudio, type NowPlaying, type Why } from '../../assistant/media';
import { clear, h, icon } from '../../core/dom';
import type { TabDef } from '../../shell/tabs';
import { button, empty, panel, row, toast, undo } from '../../ui/components';
import { page } from '../../ui/page';
import { tidyStations, type RawStation } from '../../../../../packages/shared/src/radio';

const GENRES = ['news', 'pop', 'rock', 'jazz', 'classical', 'lofi', 'chillout', 'dance', 'hip hop', 'talk', 'ambient', 'country'];

type Query = { name?: string; tag?: string; country?: string; countrycode?: string };

async function search(q: Query): Promise<NowPlaying[]> {
  const u = new URL('https://de1.api.radio-browser.info/json/stations/search');
  for (const k of ['name', 'tag', 'country', 'countrycode'] as const) if (q[k]) u.searchParams.set(k, q[k]!);
  u.searchParams.set('hidebroken', 'true');
  u.searchParams.set('order', 'clickcount');
  u.searchParams.set('reverse', 'true');
  u.searchParams.set('limit', '80');
  return tidyStations(await fetchJson<RawStation[]>(u.toString(), 1800));
}

const offline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** Why a station is not playing, said to him by its name. */
export function whyWords(why: Why, name: string): string {
  switch (why) {
    case 'silent':
      return `${name} isn’t answering. Try again in a minute, or pick another station.`;
    case 'tap':
      return 'The phone needs a tap before it plays sound. Tap PLAY.';
    case 'offline':
      return `You’re offline, so ${name} can’t play. It will when the phone is back online.`;
    case 'ended':
      return `${name} stopped sending. Tap TRY AGAIN to tune in again.`;
    default:
      return `${name} wouldn’t play on this phone. Some stations only play in their own app; pick another one.`;
  }
}

const clock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export const radioTab: TabDef = {
  id: 'radio',
  title: 'RADIO',
  icon: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8l10-5"/><circle cx="15.5" cy="14" r="3"/><path d="M6 12h4M6 15h4"/>',
  scene: 'backdrop',
  blurb: 'internet radio stations',
  now() {
    const p = player.get();
    if (!p.now) return 'Off air';
    return p.state === 'playing' ? `Playing ${p.now.name}` : p.state === 'loading' ? `Tuning in to ${p.now.name}` : p.state === 'paused' ? `${p.now.name} paused` : 'Off air';
  },
  mount(root) {
    const P = page(root, { tag: 'RADIO', rightLabel: 'FAVOURITES', leftLabel: 'STATIONS', stack: true });
    const sp = panel('STATIONS', { cls: 'scroll.stations' });
    P.left.append(sp.el);
    const np = panel('NOW PLAYING', { grow: false, cls: 'nowp' });
    const fp = panel('FAVOURITES', { cls: 'scroll.favs' });
    P.right.append(np.el, fp.el);

    const q = h('input', { placeholder: 'Station, genre or country…', 'aria-label': 'Search radio' });
    const results: NowPlaying[] = [];
    let lastLabel = '';
    let lastQuery: Query | null = null;
    let failed = false;
    // only the newest search may fill the list (an older, slower one finishing later would replace it)
    let asked = 0;
    const go = async (query: Query, label: string): Promise<boolean> => {
      const mine = ++asked;
      lastQuery = query;
      if (offline()) {
        results.length = 0;
        sp.setStatus('OFFLINE', 'off');
        paintResults(label);
        return false;
      }
      sp.setStatus('SEARCHING', 'mid');
      try {
        const r = await search(query);
        if (mine !== asked) return false;
        failed = false;
        results.splice(0, results.length, ...r);
        sp.setStatus(`${r.length}`, r.length ? 'ok' : 'mid');
        paintResults(label);
        return true;
      } catch {
        if (mine !== asked) return false;
        failed = true;
        results.length = 0;
        sp.setStatus(offline() ? 'OFFLINE' : 'NO ANSWER', 'off');
        paintResults(label);
        return false;
      }
    };
    const submit = () => {
      const v = q.value.trim();
      if (!v) return;
      void (async () => {
        if (!(await go({ name: v }, v)) || results.length) return;
        if ((await go({ tag: v.toLowerCase() }, v)) && !results.length) await go({ country: v }, v);
      })();
    };
    q.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    sp.el.insertBefore(h('div.keyrow.wrapit', q, button('SEARCH', submit)), sp.body);
    const chips = h('div.keyrow.wrapit.chips', ...GENRES.map((g) => button(g.toUpperCase(), () => void go({ tag: g }, g))));
    sp.el.insertBefore(chips, sp.body);

    const play = async (s: NowPlaying) => {
      await playStation(s);
    };
    /** This station is the one connecting or on air: its button stops it. */
    const sounding = (s: NowPlaying) => {
      const p = player.get();
      return p.now?.url === s.url && (p.state === 'playing' || p.state === 'loading');
    };
    const stationRow = (s: NowPlaying) => {
      const fav = favourites.has(s.url);
      const on = sounding(s);
      const p = player.get();
      const tuning = on && p.state === 'loading';
      const line = p.now?.url === s.url ? (tuning ? 'Connecting…' : p.state === 'playing' ? 'Playing now' : p.state === 'paused' ? 'Paused' : p.state === 'error' ? 'Didn’t play' : '') : '';
      const info = [line, s.info].filter(Boolean).join(' · ');
      const r = row(fav ? '★' : '☆', h('span', h('b', s.name), info ? h('br') : null, info ? h('small.note', info) : null), on ? '■' : '▶', { wrap: true, onClick: () => (sounding(s) ? stopAudio() : void play(s)) });
      r.classList.add('station');
      if (p.now?.url === s.url) r.classList.add('playing');
      if (tuning) r.classList.add('tuning');
      const btn = r.lastChild as HTMLElement;
      btn.setAttribute('role', 'button');
      btn.setAttribute('aria-label', on ? `Stop ${s.name}` : `Play ${s.name}`);
      const star = r.firstChild as HTMLElement;
      star.setAttribute('role', 'button');
      star.setAttribute('aria-label', fav ? `Remove ${s.name} from favourites` : `Keep ${s.name} in favourites`);
      star.title = fav ? 'Remove from favourites' : 'Add to favourites';
      star.addEventListener('click', (e) => {
        e.stopPropagation();
        const at = favourites.indexOf(s.url);
        if (favourites.toggle(s)) toast(`★ ${s.name} saved`);
        else
          undo(`Removed ${s.name} from favourites`, () => {
            favourites.put(s, at);
            paintResults();
            paintFavs();
          });
        paintResults();
        paintFavs();
      });
      return r;
    };
    const paintResults = (label = lastLabel) => {
      lastLabel = label;
      clear(sp.body);
      if (!results.length) {
        if (offline()) sp.body.append(empty('OFFLINE', 'Stations come back when the phone is online. Your favourites are kept here.', 'You’re offline'));
        else if (failed) sp.body.append(empty('NONE', 'The station list didn’t answer. Tap SEARCH or a kind of radio to try again.', 'Can’t reach the station list'));
        else sp.body.append(label ? empty('NONE', 'Try another name, a kind of radio above, or a country.', `Nothing playable for “${label}”`) : empty('NONE', 'Search above or pick a kind of radio. You can also just say “play BBC Radio 4” or “play some jazz”.', 'Find a station'));
        return;
      }
      for (const s of results) sp.body.append(stationRow(s));
    };
    const paintFavs = () => {
      clear(fp.body);
      const l = favourites.list();
      // kept on this phone, so the same words offline (the shared empty state would say "You're offline")
      if (!l.length) fp.body.append(h('div.empty', { dataset: { case: 'keep' } }, h('b', 'No favourites yet'), h('span', 'Tap ☆ next to a station to keep it here.')));
      for (const s of l) fp.body.append(stationRow(s));
    };

    const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(player.get().volume), 'aria-label': 'Volume' });
    vol.addEventListener('input', () => setVolume(Number(vol.value)));
    const RADIO = '<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M7 8l10-5"/><circle cx="15.5" cy="14" r="3"/><path d="M6.5 12.5h4M6.5 15.5h4"/>';
    const paintNow = () => {
      const { now, state, since, why } = player.get();
      const last = now ? null : lastPlayed();
      const shown = now ?? last;
      clear(np.body);
      np.setStatus(!now ? 'OFF' : state === 'playing' ? 'ON AIR' : state === 'loading' ? 'TUNING' : state === 'paused' ? 'PAUSED' : state === 'error' ? 'NOT PLAYING' : 'OFF', state === 'playing' && now ? 'ok' : state === 'error' && now ? 'off' : 'mid');
      const kicker = !now
        ? last
          ? 'Last played'
          : 'Off air'
        : state === 'playing'
          ? since
            ? `On air · since ${clock(since)}`
            : 'On air'
          : state === 'loading'
            ? since
              ? 'Buffering…'
              : 'Connecting…'
            : state === 'paused'
              ? 'Paused'
              : state === 'error'
                ? 'Didn’t play'
                : 'Stopped';
      P.big.textContent = !now ? 'Off air' : state === 'playing' ? 'On air' : kicker;
      P.sub.textContent = shown ? shown.name : 'Pick a station';
      // route C: now playing as a hero card — the station's tile (bars that move while it plays), its name and line
      np.el.dataset.state = now ? state : 'off';
      const line = shown ? shown.info || '' : offline() ? 'You’re offline. Radio needs a connection; your favourites are kept here.' : 'Pick a station, or say “play BBC Radio 4”.';
      np.body.append(h('div.nphero', { dataset: { case: 'keep' } },
        h('div.npart', icon(RADIO), h('span.eq', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'))),
        h('div.nptx', h('small', kicker), h('b', shown ? shown.name : 'Nothing playing'), line ? h('span', line) : '')));
      if (!shown) return;
      if (now && state === 'error') np.body.append(h('div.note.bad', whyWords(why, now.name)));
      else if (!now && offline()) np.body.append(h('div.note.bad', 'You’re offline. Radio needs a connection.'));
      const keys: (HTMLElement | string)[] = [];
      // an iPhone has only its own volume (a page's is ignored): no slider that does nothing
      const slider = !!now && state !== 'error' && canSetVolume();
      if (slider) keys.push(h('span.lab', 'VOL'), vol);
      if (!now) keys.push(button(`▶ PLAY`, () => void play(last!), 'on'));
      else if (state === 'playing' || state === 'loading') keys.push(button('❚❚ PAUSE', () => pauseAudio()), button('■ STOP', () => stopAudio(), 'warn'));
      else if (state === 'paused') keys.push(button('▶ PLAY', () => void resumeAudio(), 'on'), button('■ STOP', () => stopAudio(), 'warn'));
      else keys.push(button(why === 'tap' ? '▶ PLAY' : '▶ TRY AGAIN', () => void resumeAudio(), 'on'), button('■ STOP', () => stopAudio(), 'warn'));
      const kr = h('div.keyrow', ...keys);
      if (!slider) kr.classList.add('novol');
      np.body.append(kr);
    };
    player.subscribe(paintNow);
    // the station sounding is marked in the lists, its button a stop
    let shownKey = '';
    const keyOf = () => `${player.get().now?.url ?? ''}|${player.get().state}`;
    player.subscribe(() => {
      if (keyOf() === shownKey) return;
      shownKey = keyOf();
      paintResults();
      paintFavs();
    });
    const onNet = () => {
      paintNow();
      if (!offline() && !results.length && lastQuery) void go(lastQuery, lastLabel);
      else if (offline() && !results.length) paintResults();
    };
    addEventListener('online', onNet);
    addEventListener('offline', onNet);
    paintNow();
    paintFavs();
    paintResults();

    return {
      enter() {
        paintFavs();
        paintNow();
        if (!results.length) void go({ tag: 'news', countrycode: 'GB' }, 'UK news');
      },
      describe: () => `Radio: ${player.get().now ? `${player.get().state === 'paused' ? 'paused on' : 'playing'} ${player.get().now!.name}` : 'nothing playing'}; ${favourites.list().length} favourites.`,
    };
  },
};
