/** RADIO tab: search internet radio by name, genre or country (UK first); favourites; now playing. */
import { fetchJson } from '../../api/feed';
import { favourites, player, playStation, setVolume, stopAudio, type NowPlaying } from '../../assistant/media';
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

export const radioTab: TabDef = {
  id: 'radio',
  title: 'RADIO',
  icon: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8l10-5"/><circle cx="15.5" cy="14" r="3"/><path d="M6 12h4M6 15h4"/>',
  scene: 'backdrop',
  blurb: 'internet radio stations',
  now() {
    const p = player.get();
    return p.state === 'playing' && p.now ? `Playing ${p.now.name}` : 'Off air';
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
    const go = async (query: Query, label: string) => {
      sp.setStatus('SEARCHING', 'mid');
      try {
        const r = await search(query);
        results.splice(0, results.length, ...r);
        sp.setStatus(`${r.length}`, 'ok');
        paintResults(label);
      } catch {
        sp.setStatus('NO FEED', 'off');
      }
    };
    const submit = () => {
      const v = q.value.trim();
      if (!v) return;
      void (async () => {
        await go({ name: v }, v);
        if (!results.length) await go({ tag: v.toLowerCase() }, v);
        if (!results.length) await go({ country: v }, v);
      })();
    };
    q.addEventListener('keydown', (e) => e.key === 'Enter' && submit());
    sp.el.insertBefore(h('div.keyrow.wrapit', q, button('SEARCH', submit)), sp.body);
    const chips = h('div.keyrow.wrapit.chips', ...GENRES.map((g) => button(g.toUpperCase(), () => void go({ tag: g }, g))));
    sp.el.insertBefore(chips, sp.body);

    const stationRow = (s: NowPlaying) => {
      const fav = favourites.has(s.url);
      const r = row(fav ? '★' : '☆', h('span', h('b', s.name), s.info ? h('br') : null, s.info ? h('small.note', s.info) : null), '▶', { wrap: true, onClick: () => void play(s) });
      r.classList.add('station');
      if (player.get().now?.url === s.url) r.classList.add('playing');
      (r.lastChild as HTMLElement).setAttribute('aria-label', `Play ${s.name}`);
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
    let lastLabel = '';
    const paintResults = (label = lastLabel) => {
      lastLabel = label;
      clear(sp.body);
      if (!results.length) {
        sp.body.append(label ? empty('NONE', 'Try another name, a genre chip above, or a country.', `Nothing playable for “${label}”`) : empty('NONE', 'Search above or pick a genre. You can also just say “play BBC Radio 4” or “play some jazz”.', 'Find a station'));
        return;
      }
      for (const s of results) sp.body.append(stationRow(s));
    };
    const paintFavs = () => {
      clear(fp.body);
      const l = favourites.list();
      if (!l.length) fp.body.append(empty('NONE', 'Tap ☆ next to a station to keep it here.', 'No favourites yet'));
      for (const s of l) fp.body.append(stationRow(s));
    };

    const vol = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(player.get().volume), 'aria-label': 'Volume' });
    vol.addEventListener('input', () => setVolume(Number(vol.value)));
    const paintNow = () => {
      const { now, state } = player.get();
      clear(np.body);
      np.setStatus(state === 'playing' ? 'ON AIR' : state === 'loading' ? 'TUNING' : state === 'error' ? 'NO SIGNAL' : 'OFF', state === 'playing' ? 'ok' : state === 'error' ? 'off' : 'mid');
      P.big.textContent = now ? (state === 'error' ? 'NO SIGNAL' : 'ON AIR') : 'OFF AIR';
      P.sub.textContent = now ? now.name : 'pick a station';
      // route C: now playing as a hero card — the station's tile (bars that move while it plays), its name and line
      const RADIO = '<rect x="3" y="8" width="18" height="12" rx="2.5"/><path d="M7 8l10-5"/><circle cx="15.5" cy="14" r="3"/><path d="M6.5 12.5h4M6.5 15.5h4"/>';
      np.el.dataset.state = now ? state : 'off';
      np.body.append(h('div.nphero', { dataset: { case: 'keep' } },
        h('div.npart', icon(RADIO), h('span.eq', { 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i'))),
        h('div.nptx', h('small', now ? (state === 'playing' ? 'On air' : state === 'loading' ? 'Tuning…' : state === 'error' ? 'No signal' : 'Stopped') : 'Off air'), h('b', now ? now.name : 'Nothing playing'), h('span', now ? now.info || '' : 'Pick a station below, or say “play some jazz”.'))));
      if (!now) {
        np.body.append(h('div.note', 'Nothing playing.'));
        return;
      }
      np.body.append(
        row('STATION', now.name),
        now.info ? row('INFO', now.info, null, { wrap: true }) : '',
        state === 'error' ? h('div.note.bad', 'This stream would not start. Tap ▶ to try again or pick another station (some only work on certain networks).') : '',
        h('div.keyrow', h('span.lab', 'VOL'), vol, button('■ STOP', () => stopAudio(), 'warn'), button('▶ RETRY', () => void play(now))),
      );
    };
    const play = async (s: NowPlaying) => {
      if (!(await playStation(s)) && player.get().state === 'error') toast(`Couldn't start ${s.name}`, 'warn');
    };
    player.subscribe(paintNow);
    // the playing station is marked in the lists
    let shownUrl = player.get().now?.url ?? '';
    player.subscribe((p) => {
      if ((p.now?.url ?? '') === shownUrl) return;
      shownUrl = p.now?.url ?? '';
      paintResults();
      paintFavs();
    });
    paintNow();
    paintFavs();
    paintResults();

    return {
      enter() {
        paintFavs();
        if (!results.length) void go({ tag: 'news', countrycode: 'GB' }, 'UK news');
      },
      describe: () => `Radio: ${player.get().now ? `playing ${player.get().now!.name}` : 'nothing playing'}; ${favourites.list().length} favourites.`,
    };
  },
};
