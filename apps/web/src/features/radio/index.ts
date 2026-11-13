/** RADIO tab: search internet radio by name, genre or country (UK first); favourites; now playing. */
import { fetchJson } from '../../api/feed';
import { canSetVolume, favourites, forgetRecent, lastPlayed, pauseAudio, player, playStation, recentStations, resumeAudio, setSleep, setSleepAt, setVolume, sleepLost, stopAudio, type NowPlaying, type Why } from '../../assistant/media';
import { clear, h, icon } from '../../core/dom';
import type { TabDef } from '../../shell/tabs';
import { screenSays } from '../../shell/awareness';
import { button, empty, panel, row, toast, undo } from '../../ui/components';
import { page } from '../../ui/page';
import { waiting } from '../../ui/wait';
import { clockWords, endOfHour, FINDING, hourKey, lostLine, nextStation, NO_OTHER, RECENT_EMPTY, REORDER, REORDER_DONE, REORDER_NOTE, SLEEP_CHOICES, SLEEP_OFF, sleepAtSet, sleepKey, sleepLine, sleepSet, TRY_ANOTHER, TUNING } from './words';
import { phrases } from '../lifeui';
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
    // RECENT: the stations he played lately, newest first, kept on this phone (one tap plays again)
    const rp = panel('RECENT', { cls: 'scroll.recent', grow: false });
    P.right.append(np.el, fp.el, rp.el);

    const q = h('input', { placeholder: 'Station, genre or country…', 'aria-label': 'Search radio' });
    const results: NowPlaying[] = [];
    let lastLabel = '';
    let lastQuery: Query | null = null;
    let failed = false;
    let searching = false;
    let stopFinding: (() => void) | null = null;
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
      searching = true;
      if (!results.length) paintResults(label);
      try {
        const r = await search(query);
        if (mine !== asked) return false;
        searching = false;
        failed = false;
        results.splice(0, results.length, ...r);
        sp.setStatus(`${r.length}`, r.length ? 'ok' : 'mid');
        paintResults(label);
        return true;
      } catch {
        if (mine !== asked) return false;
        searching = false;
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
    sp.el.insertBefore(phrases(['play BBC Radio 4', 'play some jazz']), sp.body);

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
      const line = p.now?.url === s.url ? (tuning ? TUNING : p.state === 'playing' ? 'Playing now' : p.state === 'paused' ? 'Paused' : p.state === 'error' ? 'Didn’t play' : '') : '';
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
      stopFinding?.();
      stopFinding = null;
      clear(sp.body);
      if (!results.length) {
        /* state: radio.stations loading */
        if (searching && !offline()) {
          stopFinding = waiting(sp.body, FINDING);
          return;
        }
        /* state: radio.stations offline */
        /* state: radio.stations error */
        /* state: radio.stations empty */
        if (offline()) sp.body.append(empty('OFFLINE', 'Stations come back when the phone is online. Your favourites are kept here.', 'You’re offline'));
        else if (failed) sp.body.append(empty('NONE', 'The station list didn’t answer. Tap SEARCH or a kind of radio to try again.', 'Can’t reach the station list'));
        else sp.body.append(label ? empty('NONE', 'Try another name, a kind of radio above, or a country.', `Nothing playable for “${label}”`) : empty('NONE', 'Search above or pick a kind of radio. You can also just say “play BBC Radio 4” or “play some jazz”.', 'Find a station'));
        return;
      }
      for (const s of results) sp.body.append(stationRow(s));
    };
    const paintRecent = () => {
      clear(rp.body);
      const l = recentStations();
      rp.setStatus(l.length ? `${l.length}` : '', 'mid');
      /* state: radio.recent empty */
      if (!l.length) return void rp.body.append(h('div.empty', { dataset: { case: 'keep', state: 'empty' } }, h('b', RECENT_EMPTY.head), h('span', RECENT_EMPTY.line)));
      for (const s of l) rp.body.append(stationRow(s));
      rp.body.append(h('div.keyrow', button('CLEAR RECENT', () => {
        const kept = recentStations();
        forgetRecent();
        paintRecent();
        undo('Cleared the stations you played lately', () => {
          try {
            localStorage.setItem('ghosty.radio.recent', JSON.stringify(kept));
          } catch {
            /* ignore */
          }
          paintRecent();
        });
      })));
    };
    /** FAVOURITES in his own order: REORDER shows ↑ and ↓ on each (⏭, ⏮ and "play my second favourite" follow it) */
    let reordering = false;
    const moveRow = (s: NowPlaying, i: number, n: number) => {
      const up = button('↑', () => {
        favourites.move(s.url, -1);
        paintFavs();
      });
      const down = button('↓', () => {
        favourites.move(s.url, 1);
        paintFavs();
      });
      up.setAttribute('aria-label', `Move ${s.name} up`);
      down.setAttribute('aria-label', `Move ${s.name} down`);
      up.disabled = i === 0;
      down.disabled = i === n - 1;
      return h('div.favmove', h('span.favno', String(i + 1)), h('span.favtx', h('b', s.name)), h('span.favkeys', up, down));
    };
    const paintFavs = () => {
      clear(fp.body);
      const l = favourites.list();
      if (l.length < 2) reordering = false;
      fp.setStatus(l.length ? `${l.length}` : '', 'mid');
      // kept on this phone, so the same words offline (the shared empty state would say "You're offline")
      /* state: radio.favs empty */
      if (!l.length) fp.body.append(h('div.empty', { dataset: { case: 'keep' } }, h('b', 'No favourites yet'), h('span', 'Tap ☆ next to a station to keep it here.')));
      if (reordering) {
        fp.body.append(h('small.note.favnote', REORDER_NOTE));
        l.forEach((s, i) => fp.body.append(moveRow(s, i, l.length)));
      } else for (const s of l) fp.body.append(stationRow(s));
      if (l.length > 1)
        fp.body.append(h('div.keyrow.favorder', button(reordering ? REORDER_DONE : REORDER, () => {
          reordering = !reordering;
          paintFavs();
        }, reordering ? 'on' : '')));
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
              : TUNING
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
      const lost = now ? null : sleepLost();
      /* state: radio.sleep error */
      if (lost) np.body.append(h('div.note.nplost', lostLine(lost.at, lost.name)));
      if (now && state === 'error') np.body.append(h('div.note.bad', whyWords(why, now.name)));
      else if (!now && offline()) np.body.append(h('div.note.bad', 'You’re offline. Radio needs a connection.'));
      const keys: (HTMLElement | string)[] = [];
      // an iPhone has only its own volume (a page's is ignored): no slider that does nothing
      const slider = !!now && state !== 'error' && canSetVolume();
      if (slider) keys.push(h('span.lab', 'VOL'), vol);
      if (!now) keys.push(button(`▶ PLAY`, () => void play(last!), 'on'));
      else if (state === 'playing' || state === 'loading') keys.push(button('❚❚ PAUSE', () => pauseAudio()), button('■ STOP', () => stopAudio(), 'warn'));
      else if (state === 'paused') keys.push(button('▶ PLAY', () => void resumeAudio(), 'on'), button('■ STOP', () => stopAudio(), 'warn'));
      else {
        keys.push(button(why === 'tap' ? '▶ PLAY' : '▶ TRY AGAIN', () => void resumeAudio(), 'on'));
        // a station that will not play: the next one in the list, one tap (the way on, never a dead end)
        if (why !== 'tap') {
          keys.push(button(TRY_ANOTHER, () => {
            const n = nextStation([...results, ...favourites.list()], now?.url);
            if (n) void play(n);
            else toast(NO_OTHER, 'warn');
          }));
        }
        keys.push(button('■ STOP', () => stopAudio(), 'warn'));
      }
      const kr = h('div.keyrow', ...keys);
      if (!slider) kr.classList.add('novol');
      np.body.append(kr);
      // THE SLEEP TIMER: while a station is on, when it should go quiet and stop (one tap each; TIMER OFF takes it off)
      if (now && state !== 'error') {
        const { sleepAt: at, sleepKind } = player.get();
        const t = Date.now();
        const hourAt = endOfHour(t);
        const hourB = button(hourKey(t), () => {
          setSleepAt(endOfHour(Date.now()), 'hour');
          toast(sleepAtSet(endOfHour(Date.now()), Date.now()), 'ok');
        }, at && sleepKind === 'hour' ? 'on' : '');
        hourB.setAttribute('aria-pressed', String(!!at && sleepKind === 'hour'));
        hourB.setAttribute('aria-label', `Stop the radio at ${clockWords(hourAt)}, the end of this hour`);
        np.body.append(h('div.npsleep', { dataset: { case: 'keep' } },
          h('small.npsleepl', { 'aria-live': 'polite' }, sleepLine(at, t)),
          h('div.keyrow.wrapit.npsleepk', { role: 'group', 'aria-label': 'Sleep timer' },
            ...SLEEP_CHOICES.map((m) => {
              const b = button(sleepKey(m), () => {
                setSleep(m);
                toast(sleepSet(m), 'ok');
              }, at && sleepKind === String(m) ? 'on' : '');
              b.setAttribute('aria-pressed', String(!!at && sleepKind === String(m)));
              b.setAttribute('aria-label', `Stop the radio in ${m} minutes`);
              return b;
            }),
            hourB,
            ...(at ? [button(SLEEP_OFF, () => {
              setSleep(0);
              toast('Sleep timer off', 'ok');
            })] : []))));
      }
    };
    // the sleep line counts down while the screen is on
    let sleepTick = 0;
    player.subscribe(paintNow);
    // the station sounding is marked in the lists, its button a stop
    let shownKey = '';
    const keyOf = () => `${player.get().now?.url ?? ''}|${player.get().state}`;
    player.subscribe(() => {
      if (keyOf() === shownKey) return;
      shownKey = keyOf();
      paintResults();
      paintFavs();
      paintRecent();
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
    paintRecent();
    paintResults();

    return {
      leave() {
        clearInterval(sleepTick);
      },
      enter() {
        clearInterval(sleepTick);
        sleepTick = window.setInterval(() => {
          const l = np.el.querySelector('.npsleepl');
          if (l && player.get().sleepAt) l.textContent = sleepLine(player.get().sleepAt, Date.now());
          // the end-of-hour key names the next o'clock once this hour has gone
          const hk = np.el.querySelector<HTMLButtonElement>('.npsleepk button[aria-label*="end of this hour"]');
          if (hk && hk.textContent !== hourKey(Date.now())) paintNow();
        }, 30_000);
        paintFavs();
        paintRecent();
        paintNow();
        if (!results.length) void go({ tag: 'news', countrycode: 'GB' }, 'UK news');
      },
      // (BRIEF-SHELL pass 1) the station
      context: () => {
        const p = player.get();
        const n = p.now;
        return screenSays('radio', 'Radio', n ? `the radio, ${p.state === 'paused' ? 'paused on' : 'playing'} ${n.name}` : 'the radio, nothing playing', {
          looking: 'the radio',
          ...(n ? { selected: { kind: 'item', id: 'station', label: n.name, detail: p.state === 'paused' ? 'paused' : 'playing' } } : {}),
        });
      },
      describe: () => `Radio: ${player.get().now ? `${player.get().state === 'paused' ? 'paused on' : 'playing'} ${player.get().now!.name}` : 'nothing playing'}; ${favourites.list().length} favourites; ${player.get().sleepAt > Date.now() ? sleepLine(player.get().sleepAt, Date.now()) : 'no sleep timer'}.`,
    };
  },
};
