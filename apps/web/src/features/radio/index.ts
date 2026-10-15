/** RADIO tab: search internet radio by name, genre or country; favourites; now playing. */
import { fetchJson } from '../../api/feed';
import { favourites, player, playStation, setVolume, stopAudio, type NowPlaying } from '../../assistant/media';
import { clear, h } from '../../core/dom';
import type { TabDef } from '../../shell/tabs';
import { button, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';

interface RawStation {
  name: string;
  url_resolved: string;
  country: string;
  tags: string;
  codec: string;
  bitrate: number;
}

const GENRES = ['news', 'pop', 'rock', 'jazz', 'classical', 'lofi', 'chillout', 'dance', 'hip hop', 'talk', 'ambient', 'country'];

async function search(q: { name?: string; tag?: string; country?: string }): Promise<NowPlaying[]> {
  const u = new URL('https://de1.api.radio-browser.info/json/stations/search');
  if (q.name) u.searchParams.set('name', q.name);
  if (q.tag) u.searchParams.set('tag', q.tag);
  if (q.country) u.searchParams.set('country', q.country);
  u.searchParams.set('hidebroken', 'true');
  u.searchParams.set('order', 'clickcount');
  u.searchParams.set('reverse', 'true');
  u.searchParams.set('limit', '60');
  const j = await fetchJson<RawStation[]>(u.toString(), 1800);
  const seen = new Set<string>();
  return j
    .filter((s) => /^https:\/\//i.test(s.url_resolved ?? '') && !seen.has(s.name.trim().toLowerCase()) && seen.add(s.name.trim().toLowerCase()))
    .slice(0, 30)
    .map((s) => ({ name: s.name.trim().slice(0, 80), url: s.url_resolved, info: [s.country, (s.tags ?? '').split(',').slice(0, 3).join(', '), s.bitrate ? `${s.bitrate} kbps` : ''].filter(Boolean).join(' · ') }));
}

export const radioTab: TabDef = {
  id: 'radio',
  title: 'RADIO',
  icon: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8l10-5"/><circle cx="15.5" cy="14" r="3"/><path d="M6 12h4M6 15h4"/>',
  scene: 'backdrop',
  blurb: 'internet radio stations',
  mount(root) {
    const P = page(root, { tag: 'RADIO', rightLabel: 'FAVOURITES', leftLabel: 'STATIONS' });
    const sp = panel('STATIONS', { cls: 'scroll' });
    P.left.append(sp.el);
    const np = panel('NOW PLAYING', { grow: false });
    const fp = panel('FAVOURITES', { cls: 'scroll' });
    P.right.append(np.el, fp.el);

    const q = h('input', { placeholder: 'Station, genre or country…', 'aria-label': 'Search radio' });
    const results: NowPlaying[] = [];
    const go = async (query: { name?: string; tag?: string; country?: string }, label: string) => {
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
      const star = r.firstChild as HTMLElement;
      star.title = fav ? 'Remove from favourites' : 'Add to favourites';
      star.addEventListener('click', (e) => {
        e.stopPropagation();
        toast(favourites.toggle(s) ? `★ ${s.name} saved` : `Removed ${s.name}`);
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
        sp.body.append(h('div.note', label ? `Nothing playable found for "${label}".` : 'Search above or pick a genre. You can also just say "play BBC Radio 4" or "play some jazz".'));
        return;
      }
      for (const s of results) sp.body.append(stationRow(s));
    };
    const paintFavs = () => {
      clear(fp.body);
      const l = favourites.list();
      if (!l.length) fp.body.append(h('div.note', 'Tap ☆ next to a station to keep it here.'));
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
    paintNow();
    paintFavs();
    paintResults();

    return {
      enter() {
        paintFavs();
        if (!results.length) void go({ tag: 'news', country: 'United Kingdom' }, 'UK news');
      },
      describe: () => `Radio: ${player.get().now ? `playing ${player.get().now!.name}` : 'nothing playing'}; ${favourites.list().length} favourites.`,
    };
  },
};
