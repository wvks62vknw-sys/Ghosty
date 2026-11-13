/** BRIEF tab: what he reads first in the morning — the day's diary, the drive to work, the weather in detail, headlines by section, and a spoken briefing on request. */
import { brain } from '../../api/brain';
import { send } from '../../assistant/session';
import { speak, stopSpeaking } from '../../assistant/voice';
import { clear, fmt, h } from '../../core/dom';
import { GEO } from '../../engine/geo';
import { currentNewsFeed, NEWS_FEEDS, news, setNewsFeed, type Headline } from '../../data/news';
import { air, airBand, speed, temp, WMO, weather, type WeatherData } from '../../data/weather';
import { go, type TabDef } from '../../shell/tabs';
import { screenSays } from '../../shell/awareness';
import { commuteLine, dayName, diarySentence, digestDay, greeting, hhmm, isoDay, leaveFor, rainClause, rainWhen, spoken, stillToday, summary, type DayItem, type Facts, type PlaceWords } from './day';
import { briefForesight } from './foresight';
import { briefIndependence } from '../system/independence';
import { briefNudges } from '../money/nudges';
import { briefMail } from './mail';
import { goToPanel } from '../../ui/sections';
import { onLibraryChange, passagesOf } from '../../library/local';
import { fuelEstimate, nearPlaces, nearShort } from '../../further/spendnear';
import { home, ui } from '../../state/app';
import { markSeen } from '../core/missed';
import { button, empty, pager, panel, row, spark } from '../../ui/components';
import { page } from '../../ui/page';
import { rawText } from '../../ui/hisWords';

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
    // [offline2] the week's independence in one line, when a brain sits on the phone (features/system/independence.ts)
    say.after(briefIndependence());
    let commuteWords = '';
    // [further] the drive's fuel, a first estimate, and this week's money near a saved place (further/spendnear.ts); '' until known
    let commuteCost = '';
    let moneyWords = '';
    // the drive and the work it is to, kept so "leave by" follows whichever of the diary and the drive arrives last
    let drive: { minutes: number; delayMin: number; live: boolean } | null = null;
    let workPlace: PlaceWords | null = null;
    const setCommuteWords = () => {
      commuteWords = drive ? commuteLine(drive, workPlace && dayItems ? leaveFor(dayItems, workPlace, drive.minutes, Date.now()) : null) : '';
    };
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
      if (commuteCost) f.cost = commuteCost;
      if (moneyWords) f.money = moneyWords;
      return f;
    };
    const paintSay = () => {
      const d = new Date();
      dateEl.textContent = `${greeting(d)} · ${dayName(d)}`;
      say.textContent = summary(facts());
    };
    // READ IT TO ME says the Brief aloud at once (no model: the greeting, the sentence, the top three headlines);
    // BRIEF ME asks Ghosty for a spoken briefing in the chat, handed the same facts so it needs no look-ups.
    const topHeadlines = () => (news.data?.length ? news.data : (digest?.headlines ?? [])).slice(0, 6).map((x) => x.title);
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
      // (the one shared mind: the same picture of today the chat's context is made from)
      // (and his statements' nudges: a renewal this week, a price up, the month running hot, each said once: money/nudges.ts)
      const [mind, inbox, money] = await Promise.all([brain.mind().catch(() => null), brain.inbox().catch(() => null), brain.spending(undefined, isoDay(new Date())).catch(() => null)]);
      const items = mind ? stillToday(mind.today, Date.now()) : null;
      if (!mind || !items) {
        dp.setStatus('CAN’T CHECK', 'mid');
        clear(dp.body, row(null, 'Your diary can’t be reached right now. It tries again when you next open the Brief.', null, { wrap: true }));
        return;
      }
      dayItems = items;
      setCommuteWords();
      const open = () => go('agenda');
      const rows = dayItems.slice(0, 5).map((x) => row(x.when, x.title, x.where ?? null, { wrap: true, onClick: open }));
      if (dayItems.length > 5) rows.push(row(null, `${dayItems.length - 5} more today`, '›', { onClick: open }));
      if (!dayItems.length) {
        rows.push(row(null, 'Nothing in your diary for the rest of today', null, { wrap: true, onClick: open }));
        const next = mind.today.next;
        if (next) rows.push(row('NEXT', next.title, next.when, { wrap: true, onClick: open }));
      }
      // [packs] the packs' lines (BRIEF-PACKS-1): payday, a renewal tomorrow, a warranty ending, water so far…
      for (const l of mind.packs ?? []) rows.push(row(null, l, null, { wrap: true }));
      for (const n of briefNudges(money?.nudges ?? [], isoDay(new Date()))) {
        const r = row('MONEY', n.line, '›', { wrap: true, onClick: () => goToPanel('agenda', 'SPENDING') });
        r.classList.add('brmoney');
        r.dataset.nudge = n.kind;
        rows.push(r);
      }
      const unread = inbox?.unread ?? 0;
      if (unread) rows.push(row('INBOX', `${unread} new message${unread === 1 ? '' : 's'} from Ghosty`, '›', { onClick: open }));
      dp.setStatus(dayItems.length ? `${dayItems.length} LEFT` : 'CLEAR', 'ok');
      clear(dp.body, ...rows);
      paintSay();
    };
    // [lifeeasier] EMAIL TRIAGE: "two emails need an answer", with DRAFT on each, only with his own email linked (brief/mail.ts)
    const mail = briefMail();
    dp.el.append(mail.el);
    const wp = panel('WEATHER', { cls: 'wx' });
    // THE COMMUTE: one line, home to work with the live traffic, when both are saved (Memory → ME → PLACES; until
    // then one line saying where to save them).
    const commute = panel('COMMUTE', { cls: 'commute', grow: false });
    commute.el.hidden = true;
    // FORESIGHT (foresight.ts): today's expectations, yesterday's score and his questions on record, after the drive to work.
    const fore = briefForesight();
    P.left.append(dp.el, commute.el, fore.el, wp.el);
    const paintCommute = async () => {
      try {
        const places = (await brain.places()).places ?? [];
        const home = places.find((p) => p.id === 'home');
        const work = places.find((p) => p.id === 'work');
        commute.el.hidden = false;
        // Not saved yet: one quiet line on where to save them (he would never find the commute otherwise).
        if (!home || !work) {
          drive = null;
          commuteWords = '';
          commuteCost = '';
          commute.setStatus('');
          return void clear(commute.body, row(null, `Save ${!home && !work ? 'home and work' : !home ? 'home' : 'work'} in Memory → Me → Places and the drive to work shows here each morning.`, '›', { wrap: true, onClick: () => go('memory') }));
        }
        // Offline the phone would answer with the last drive it was told (kept for every read): an old "LIVE"
        // time is not this morning's, so say it plainly instead.
        if (navigator.onLine === false) {
          drive = null;
          commuteWords = '';
          commuteCost = '';
          commute.setStatus('OFFLINE', 'off');
          return void clear(commute.body, row('HOME → WORK', 'You’re offline: the drive time comes back with the connection.', null, { wrap: true }));
        }
        commute.setStatus('…', 'mid');
        const c = await brain.commute(home, work);
        drive = { minutes: c.minutes, delayMin: c.delayMin, live: c.live };
        workPlace = { label: work.label, query: work.query, address: work.address };
        setCommuteWords();
        paintSay();
        commute.setStatus(c.live ? 'LIVE' : 'NO LIVE TRAFFIC', c.live ? 'ok' : 'mid');
        const fuel = fuelEstimate(c.km);
        commuteCost = fuel?.line ?? '';
        clear(commute.body, row('HOME → WORK', c.line, `${c.km} km`, { wrap: true, tone: c.delayMin >= 10 ? 'bad' : undefined }), ...(fuel ? [row('FUEL', `${fuel.line}.`, null, { wrap: true })] : []));
        paintSay();
      } catch (e) {
        if (commute.el.hidden) return;
        drive = null;
        commuteWords = '';
        commuteCost = '';
        paintSay();
        const msg = rawText(e);
        commute.setStatus('CAN’T TIME IT', 'mid');
        clear(commute.body, row('HOME → WORK', /no road route/i.test(msg) ? 'There’s no road route between home and work: check the two places in Memory → Me → Places.' : 'The drive can’t be timed right now. It tries again when you next open the Brief.', null, { wrap: true }));
      }
    };
    // [further] The money line (PLACES AND SPENDING TOGETHER): this week's money near a saved place, when a statement's words name it; said
    // in the day's sentence and nowhere else, and nothing when none fit. His statements and his saved places only: no position, nothing new fetched.
    const paintMoney = async () => {
      try {
        const [s, p] = await Promise.all([brain.spending(), brain.places()]);
        const thisMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
        const n = s.kept && s.month === thisMonth ? nearPlaces(s.rows, p.places ?? [])[0] : undefined;
        moneyWords = n ? nearShort(n) : '';
      } catch {
        moneyWords = '';
      }
      paintSay();
    };
    const np = panel('HEADLINES', { footer: true, status: 'BBC', cls: 'news' });
    const sections = h('div.tabs', ...Object.entries(NEWS_FEEDS).map(([id, [label]]) => button(label, (b) => {
      setNewsFeed(id);
      [...sections.children].forEach((x) => x.classList.toggle('on', x === b));
    }, id === currentNewsFeed() ? 'on' : '')));
    np.el.insertBefore(sections, np.body);
    const ng = pager(np, 62, (x: Headline) => row(null, x.title, x.at ? fmt.ago(x.at) : '', { wrap: true, onClick: () => { go('core'); void send(`Explain this headline in plain terms and why it matters: "${x.title}". ${x.desc}`); } }), () => news.status, 'Headlines come in by themselves; pick another section above meanwhile.');
    // The morning digest (the library's "Fresh knowledge", gathered by the brain at 06:10 UTC), read from the
    // phone's own copy of the library: "Today in one line" when a model wrote the day in three levels, and the
    // BBC's headlines from it when the live feed can't be reached (offline too).
    const oneLine = h('p.brone', { hidden: true });
    np.el.insertBefore(oneLine, sections);
    P.right.append(np.el);
    let digest: ReturnType<typeof digestDay> = null;
    let digestTimer = 0;
    const loadDigest = () => {
      clearTimeout(digestTimer);
      digestTimer = window.setTimeout(() => void passagesOf('m-notes_daily').then((p) => {
        digest = digestDay(p);
        paintNews();
      }).catch(() => undefined), 300);
    };
    onLibraryChange(loadDigest);

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
      const today = digest?.day === isoDay(new Date());
      oneLine.hidden = !(today && digest?.oneLine);
      clear(oneLine, h('b', 'Today in one line'), h('span', digest?.oneLine ?? ''));
      const fallback = !news.data?.length && news.status === 'NO FEED' && !!digest?.headlines.length;
      if (fallback) {
        ng.set(digest!.headlines.map((x) => ({ title: x.title, desc: x.desc, url: '', at: 0 })));
        return np.setStatus(today ? 'FROM THIS MORNING’S DIGEST' : `FROM THE ${digest!.day.slice(8)}/${digest!.day.slice(5, 7)} DIGEST`, 'mid');
      }
      ng.set(news.data ?? []);
      np.setStatus(news.status, news.status === 'LIVE' ? 'ok' : 'off');
      // [lifeeasier] what the Brief is showing him is seen: WHAT DID I MISS? leaves those headlines out (features/core/missed.ts)
      if (ui.get().tab === 'brief') markSeen(topHeadlines());
    };
    weather.onChange(paintWeather);
    addEventListener('online', paintWeather);
    addEventListener('offline', paintWeather);
    air.onChange(paintWeather);
    news.onChange(paintNews);
    paintWeather();
    paintNews();
    // What Ghosty is told is on screen (cut at 400 characters by the brain): the day's facts first, so "what's my
    // day like?" asked here is answered from them.
    const describe = () => `Brief, ${dateEl.textContent}: ${[P.big.textContent, P.sub.textContent].filter(Boolean).join(' ')}. ${say.textContent} Diary: ${dayItems ? (dayItems.length ? dayItems.slice(0, 4).map((x) => `${x.when} ${x.title}`).join('; ') : 'nothing more today') : 'not known'}. Top headline: ${topHeadlines()[0] ?? 'none'}`;
    return {
      enter() {
        paintSay();
        loadDigest();
        // (readable by the spec at window.__ghosty.brief, as the vehicle check does)
        const g = (window as unknown as { __ghosty?: Record<string, unknown> }).__ghosty;
        if (g) g.brief = { describe };
        void paintDay();
        void mail.paint();
        void paintCommute();
        void paintMoney();
        setTimeout(() => ui.get().tab === 'brief' && markSeen(topHeadlines()), 1500);
        void fore.paint();
        weather.start();
        air.start();
        news.start();
      },
      describe,
      // (BRIEF-SHELL pass 1) what is open: the day's reading and the headlines section he is on
      context: () => {
        const feed = NEWS_FEEDS[currentNewsFeed()]?.[0] ?? '';
        const wx = [P.big.textContent, P.sub.textContent].filter(Boolean).join(' ');
        return screenSays('brief', 'Brief', `the brief${wx ? `, ${wx}` : ''}${feed ? `, on the ${feed.toLowerCase()} headlines` : ''}`, {
          looking: 'the brief',
          ...(feed ? { selected: { kind: 'group', id: `news:${currentNewsFeed()}`, label: `${feed} headlines` } } : {}),
        });
      },
    };
  },
};
