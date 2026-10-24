/** BRIEF tab: what he reads first in the morning — the day's diary, the drive to work, the weather in detail, headlines by section, and a spoken briefing on request. */
import { brain } from '../../api/brain';
import { send } from '../../assistant/session';
import { speak, stopSpeaking } from '../../assistant/voice';
import { clear, fmt, h } from '../../core/dom';
import { GEO } from '../../engine/geo';
import { currentNewsFeed, NEWS_FEEDS, news, setNewsFeed, type Headline } from '../../data/news';
import { air, airBand, speed, temp, WMO, weather, type WeatherData } from '../../data/weather';
import { go, type TabDef } from '../../shell/tabs';
import { dayName, diarySentence, greeting, hhmm, isoDay, nextAfterToday, rainClause, rainWhen, spoken, summary, todayItems, type DayItem, type Facts } from './day';
import { home } from '../../state/app';
import { button, empty, pager, panel, row, spark } from '../../ui/components';
import { page } from '../../ui/page';

export const briefTab: TabDef = {
  id: 'brief',
  title: 'BRIEF',
  icon: '<rect x="3" y="4" width="18" height="14" rx="1"/><path d="M7 9h10M7 13h6M8 21h8"/>',
  scene: 'backdrop',
  blurb: 'news · weather · your day at a glance',
  now: () => (weather.data ? `${temp(weather.data.current.temperature_2m)} · ${WMO(weather.data.current.weather_code).toLowerCase()}` : ''),
  primary: true,
  mount(root) {
    const P = page(root, { tag: 'DAILY BRIEFING', rightLabel: 'HEADLINES', leftLabel: 'WEATHER', stack: true });
    // The hero: "Good morning · Monday 26 October", the temperature, and one plain sentence of the day (the rest of
    // today's weather, the diary, the drive to work) from what the phone already holds: the first useful line.
    const dateEl = h('div.brdate', { dataset: { case: 'keep' } });
    const say = h('p.brsay', { dataset: { case: 'keep' } });
    P.big.before(dateEl);
    P.sub.after(say);
    let commuteWords = '';
    // The last weather is kept on the phone (today's only): opened offline, or with Open-Meteo down, the Brief
    // still shows the morning's forecast, marked with when it was fetched, instead of a blank top.
    const KEPT = 'ghosty.brief.wx';
    let keptAt = 0;
    const keep = () => {
      if (weather.status !== 'LIVE' || !weather.data || weather.at === keptAt) return;
      keptAt = weather.at;
      try {
        localStorage.setItem(KEPT, JSON.stringify({ at: weather.at, w: weather.data }));
      } catch {
        /* storage full or blocked: nothing kept */
      }
    };
    const wxNow = (): { w: WeatherData | null; asOf: number } => {
      if (weather.data) return { w: weather.data, asOf: weather.status === 'STALE' ? weather.at : 0 };
      try {
        const k = JSON.parse(localStorage.getItem(KEPT) ?? 'null') as { at: number; w: WeatherData } | null;
        if (k?.w && isoDay(new Date(k.at)) === isoDay(new Date())) return { w: k.w, asOf: k.at };
      } catch {
        /* nothing kept */
      }
      return { w: null, asOf: 0 };
    };
    const facts = (spokenToo = false): Facts => {
      const { w } = wxNow();
      const f: Facts = {};
      if (w) {
        const d = w.daily;
        if (spokenToo) f.now = `${WMO(w.current.weather_code)}, ${temp(w.current.temperature_2m)}`;
        if (d.temperature_2m_min.length) f.range = `${temp(d.temperature_2m_min[0]!).replace(/°[CF]$/, '')} to ${temp(d.temperature_2m_max[0]!)}`;
        f.rain = rainClause(rainWhen(w.hourly.precipitation_probability, new Date().getHours()).line);
      }
      if (dayItems) f.diary = diarySentence(dayItems);
      if (commuteWords) f.commute = commuteWords;
      return f;
    };
    const paintSay = () => {
      const d = new Date();
      dateEl.textContent = `${greeting(d)} · ${dayName(d)}`;
      say.textContent = summary(facts());
    };
    // READ IT TO ME says the Brief aloud at once (no model: the greeting, the sentence, the top three headlines);
    // BRIEF ME asks Ghosty for a spoken briefing in the chat, handed the same facts so it needs no look-ups.
    const topHeadlines = () => (news.data ?? []).slice(0, 6).map((x) => x.title);
    let reading = false;
    const readBtn = button('READ IT TO ME', (b) => {
      if (reading) return void stopSpeaking();
      reading = true;
      b.textContent = 'STOP';
      void speak(spoken(new Date(), summary(facts(true)), topHeadlines())).finally(() => {
        reading = false;
        b.textContent = 'READ IT TO ME';
      });
    }, 'brread on');
    const briefBtn = button('BRIEF ME', () => {
      const d = new Date();
      const diary = dayItems ? (dayItems.length ? dayItems.slice(0, 6).map((x) => `${x.when} ${x.title}`).join('; ') : 'nothing') : 'not known';
      go('core');
      void send(`Give me a sharp spoken briefing in about 90 words from these facts (no need to look anything up), flagging anything that needs my attention. ${greeting(d)}, ${dayName(d)}. WEATHER: ${summary({ ...facts(true), diary: undefined, commute: undefined }) || 'not known'} DIARY TODAY: ${diary}. ${commuteWords ? `COMMUTE: ${commuteWords}. ` : ''}HEADLINES: ${topHeadlines().join(' | ') || 'none yet'}`);
    }, 'brme');
    say.after(h('div.bract', readBtn, briefBtn));
    // YOUR DAY: what is left of today in the diary, the reminders still to go off and anything new in the inbox,
    // first on the page (read from the Agenda's own routes; a tap opens the Agenda).
    const dp = panel('YOUR DAY', { cls: 'brday', grow: false });
    let dayItems: DayItem[] | null = null;
    const paintDay = async () => {
      if (dayItems === null) clear(dp.body, row(null, 'Checking your diary…', null));
      const [ag, inbox] = await Promise.all([brain.agenda(2).catch(() => null), brain.inbox().catch(() => null)]);
      const now = Date.now();
      if (!ag) {
        dp.setStatus('CAN’T CHECK', 'mid');
        clear(dp.body, row(null, 'Your diary can’t be reached right now. It tries again when you next open the Brief.', null, { wrap: true }));
        return;
      }
      dayItems = todayItems(ag.events, ag.jobs, now);
      const open = () => go('agenda');
      const rows = dayItems.slice(0, 5).map((x) => row(x.when, x.title, x.where ?? null, { wrap: true, onClick: open }));
      if (dayItems.length > 5) rows.push(row(null, `${dayItems.length - 5} more today`, '›', { onClick: open }));
      if (!dayItems.length) {
        rows.push(row(null, 'Nothing in your diary for the rest of today', null, { wrap: true, onClick: open }));
        const next = nextAfterToday(ag.events, now);
        if (next) rows.push(row('NEXT', next.title, next.allDay ? new Date(next.start).toLocaleDateString('en-GB', { weekday: 'short' }) : `${new Date(next.start).toLocaleDateString('en-GB', { weekday: 'short' })} ${hhmm(next.start)}`, { wrap: true, onClick: open }));
      }
      const unread = inbox?.unread ?? 0;
      if (unread) rows.push(row('INBOX', `${unread} new message${unread === 1 ? '' : 's'} from Ghosty`, '›', { onClick: open }));
      dp.setStatus(dayItems.length ? `${dayItems.length} LEFT` : 'CLEAR', 'ok');
      clear(dp.body, ...rows);
      paintSay();
    };
    const wp = panel('WEATHER', { cls: 'wx' });
    // THE COMMUTE: one line, home to work with the live traffic, only when both are saved (Memory → ME → PLACES).
    const commute = panel('COMMUTE', { cls: 'commute', grow: false });
    commute.el.hidden = true;
    P.left.append(dp.el, commute.el, wp.el);
    const paintCommute = async () => {
      try {
        const places = (await brain.places()).places ?? [];
        const home = places.find((p) => p.id === 'home');
        const work = places.find((p) => p.id === 'work');
        if (!home || !work) return void (commute.el.hidden = true);
        commute.el.hidden = false;
        // Offline the phone would answer with the last drive it was told (kept for every read): an old "LIVE"
        // time is not this morning's, so say it plainly instead.
        if (navigator.onLine === false) {
          commuteWords = '';
          commute.setStatus('OFFLINE', 'off');
          return void clear(commute.body, row('HOME → WORK', 'You’re offline: the drive time comes back with the connection.', null, { wrap: true }));
        }
        commute.setStatus('…', 'mid');
        const c = await brain.commute(home, work);
        commuteWords = `${c.minutes} min to work${c.live && c.delayMin >= 5 ? `, ${c.delayMin} min of it traffic` : ''}`;
        paintSay();
        commute.setStatus(c.live ? 'LIVE' : 'NO LIVE TRAFFIC', c.live ? 'ok' : 'mid');
        clear(commute.body, row('HOME → WORK', c.line, `${c.km} km`, { wrap: true, tone: c.delayMin >= 10 ? 'bad' : undefined }));
      } catch (e) {
        if (commute.el.hidden) return;
        commuteWords = '';
        paintSay();
        const msg = (e as Error).message;
        commute.setStatus('CAN’T TIME IT', 'mid');
        clear(commute.body, row('HOME → WORK', /no road route/i.test(msg) ? 'There’s no road route between home and work: check the two places in Memory → Me → Places.' : 'The drive can’t be timed right now. It tries again when you next open the Brief.', null, { wrap: true }));
      }
    };
    const np = panel('HEADLINES', { footer: true, status: 'BBC', cls: 'news' });
    const sections = h('div.tabs', ...Object.entries(NEWS_FEEDS).map(([id, [label]]) => button(label, (b) => {
      setNewsFeed(id);
      [...sections.children].forEach((x) => x.classList.toggle('on', x === b));
    }, id === currentNewsFeed() ? 'on' : '')));
    np.el.insertBefore(sections, np.body);
    const ng = pager(np, 62, (x: Headline) => row(null, x.title, x.at ? fmt.ago(x.at) : '', { wrap: true, onClick: () => { go('core'); void send(`Explain this headline in plain terms and why it matters: "${x.title}". ${x.desc}`); } }), () => news.status, 'Headlines come in by themselves; pick another section above meanwhile.');
    P.right.append(np.el);

    const paintWeather = () => {
      keep();
      paintSay();
      const { w, asOf } = wxNow();
      wp.title.textContent = `WEATHER · ${home().name.toUpperCase()}`;
      clear(wp.body);
      const offline = navigator.onLine === false;
      if (!w) {
        const down = weather.status === 'NO FEED';
        P.big.textContent = '';
        P.sub.textContent = !down ? 'Getting the weather…' : offline ? 'You’re offline: the weather comes back with the connection' : 'The weather can’t be reached right now: it tries again by itself';
        wp.setStatus(down ? (offline ? 'OFFLINE' : 'CAN’T REACH') : '…', down ? 'off' : 'mid');
        wp.body.append(empty(down ? 'NO FEED' : 'LOADING'));
        return;
      }
      const c = w.current;
      const d = w.daily;
      const when = asOf ? ` · as of ${hhmm(asOf)}` : '';
      wp.setStatus(asOf ? `${offline ? 'OFFLINE' : 'NOT UPDATING'} · ${hhmm(asOf)}` : 'LIVE', asOf ? 'mid' : 'ok');
      P.big.textContent = temp(c.temperature_2m);
      P.sub.textContent = `${WMO(c.weather_code)} · feels ${temp(c.apparent_temperature)}${when}`;
      // Today's range and when it will rain first (from the hour now: rain before he woke is not today's news),
      // then the rest; the air pressure in hPa is left out (a number he never asked for).
      const rain = rainWhen(w.hourly.precipitation_probability, new Date().getHours());
      const full = (r: HTMLElement) => (r.classList.add('full'), r);
      const uv = d.uv_index_max[0] ?? 0;
      wp.body.append(
        full(row('TODAY', `${temp(d.temperature_2m_min[0]!)} → ${temp(d.temperature_2m_max[0]!)}`)),
        full(row('RAIN', rain.line)),
        row('WIND', `${speed(c.wind_speed_10m)} ${GEO.card(c.wind_direction_10m)}`),
        row('HUMIDITY', `${c.relative_humidity_2m}%`),
        row('UV', `${uv.toFixed(0)} · ${uv < 3 ? 'low' : uv < 6 ? 'moderate' : uv < 8 ? 'high' : uv < 11 ? 'very high' : 'extreme'}`),
        row('SUN', `↑ ${d.sunrise[0]!.slice(11, 16)}   ↓ ${d.sunset[0]!.slice(11, 16)}`),
      );
      const q = air.data?.current;
      if (q) {
        const band = airBand(q.european_aqi);
        wp.body.append(row('AIR', `${band.label} · AQI ${Math.round(q.european_aqi)}`, `PM2.5 ${Math.round(q.pm2_5)} · NO₂ ${Math.round(q.nitrogen_dioxide)}`, { tone: band.tone === 'bad' ? 'bad' : band.tone === 'ok' ? 'up' : undefined }));
      }
      const h0 = new Date().getHours();
      const t24 = w.hourly.temperature_2m.slice(h0, h0 + 24);
      const r24 = w.hourly.precipitation_probability.slice(h0, h0 + 24);
      wp.body.append(h('div.lab', 'NEXT 24H TEMPERATURE'), h('div.wxspark.t', { dataset: { case: 'keep', lo: temp(Math.min(...t24)), hi: temp(Math.max(...t24)) } }, spark(t24, 300, 38)), h('div.lab', 'RAIN CHANCE'), h('div.wxspark.r', { dataset: { case: 'keep', lo: `${Math.min(...r24)}%`, hi: `${Math.max(...r24)}%` } }, spark(r24, 300, 26)));
      P.dials([
        ['RAIN', (d.precipitation_probability_max[0] ?? 0) / 100, `${d.precipitation_probability_max[0]}%`, '#5ce1ff'],
        ['UV', (d.uv_index_max[0] ?? 0) / 11, (d.uv_index_max[0] ?? 0).toFixed(0), '#ffd24d'],
        ['HUMID', c.relative_humidity_2m / 100, `${c.relative_humidity_2m}%`, '#52f2b5'],
      ]);
    };
    const paintNews = () => {
      ng.set(news.data ?? []);
      np.setStatus(news.status, news.status === 'LIVE' ? 'ok' : 'off');
    };
    weather.onChange(paintWeather);
    addEventListener('online', paintWeather);
    addEventListener('offline', paintWeather);
    air.onChange(paintWeather);
    news.onChange(paintNews);
    paintWeather();
    paintNews();
    return {
      enter() {
        void paintDay();
        void paintCommute();
        weather.start();
        air.start();
        news.start();
      },
      describe: () => `Brief: ${P.big.textContent} ${P.sub.textContent}. Top headline: ${news.data?.[0]?.title ?? 'none'}`,
    };
  },
};
