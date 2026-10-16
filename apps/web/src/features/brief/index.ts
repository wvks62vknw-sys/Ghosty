/** BRIEF tab: weather in detail, headlines by section, and a spoken briefing on request. */
import { send } from '../../assistant/session';
import { clear, fmt, h } from '../../core/dom';
import { GEO } from '../../engine/geo';
import { currentNewsFeed, NEWS_FEEDS, news, setNewsFeed, type Headline } from '../../data/news';
import { air, airBand, speed, temp, WMO, weather } from '../../data/weather';
import { go, type TabDef } from '../../shell/tabs';
import { home } from '../../state/app';
import { button, pager, panel, row, spark } from '../../ui/components';
import { page } from '../../ui/page';

export const briefTab: TabDef = {
  id: 'brief',
  title: 'BRIEF',
  icon: '<rect x="3" y="4" width="18" height="14" rx="1"/><path d="M7 9h10M7 13h6M8 21h8"/>',
  scene: 'backdrop',
  blurb: 'news · weather · your day at a glance',
  primary: true,
  mount(root) {
    const P = page(root, { tag: 'DAILY BRIEFING', rightLabel: 'HEADLINES', leftLabel: 'WEATHER' });
    const wp = panel('WEATHER');
    P.left.append(wp.el);
    const np = panel('HEADLINES', { footer: true, status: 'BBC' });
    const sections = h('div.tabs', ...Object.entries(NEWS_FEEDS).map(([id, [label]]) => button(label, (b) => {
      setNewsFeed(id);
      [...sections.children].forEach((x) => x.classList.toggle('on', x === b));
    }, id === currentNewsFeed() ? 'on' : '')));
    np.el.insertBefore(sections, np.body);
    const ng = pager(np, 62, (x: Headline) => row(null, x.title, x.at ? fmt.ago(x.at) : '', { wrap: true, onClick: () => { go('core'); void send(`Explain this headline in plain terms and why it matters: "${x.title}". ${x.desc}`); } }), () => news.status);
    np.foot!.prepend(button('BRIEF ME', () => {
      go('core');
      void send(`Give me a sharp spoken briefing in about 90 words: weather, then the most important headlines, flagging anything that needs my attention. HEADLINES: ${(news.data ?? []).slice(0, 6).map((x) => x.title).join(' | ')}`);
    }, 'warn'));
    P.right.append(np.el);

    const paintWeather = () => {
      const w = weather.data;
      wp.title.textContent = `WEATHER · ${home().name.toUpperCase()}`;
      clear(wp.body);
      if (!w) {
        wp.body.append(h('div.note', weather.status === 'NO FEED' ? 'Weather unavailable right now.' : 'Fetching forecast…'));
        return;
      }
      const c = w.current;
      const d = w.daily;
      P.big.textContent = temp(c.temperature_2m);
      P.sub.textContent = `${WMO(c.weather_code)} · feels ${temp(c.apparent_temperature)}`;
      wp.body.append(
        row('WIND', `${speed(c.wind_speed_10m)} ${GEO.card(c.wind_direction_10m)}`),
        row('HUMIDITY', `${c.relative_humidity_2m}%`),
        row('PRESSURE', `${Math.round(c.pressure_msl)} hPa`),
        row('TODAY', `${temp(d.temperature_2m_min[0]!)} → ${temp(d.temperature_2m_max[0]!)} · rain ${d.precipitation_probability_max[0]}%`),
        row('UV', (d.uv_index_max[0] ?? 0).toFixed(1)),
        row('SUN', `↑ ${d.sunrise[0]!.slice(11, 16)}   ↓ ${d.sunset[0]!.slice(11, 16)}`),
      );
      const q = air.data?.current;
      if (q) {
        const band = airBand(q.european_aqi);
        wp.body.append(row('AIR', `${band.label} · AQI ${Math.round(q.european_aqi)}`, `PM2.5 ${Math.round(q.pm2_5)} · NO₂ ${Math.round(q.nitrogen_dioxide)}`, { tone: band.tone === 'bad' ? 'bad' : band.tone === 'ok' ? 'up' : undefined }));
      }
      const h0 = new Date().getHours();
      wp.body.append(h('div.lab', 'NEXT 24H TEMPERATURE'), spark(w.hourly.temperature_2m.slice(h0, h0 + 24), 300, 38), h('div.lab', 'RAIN CHANCE'), spark(w.hourly.precipitation_probability.slice(h0, h0 + 24), 300, 26));
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
    air.onChange(paintWeather);
    news.onChange(paintNews);
    paintWeather();
    paintNews();
    return {
      enter() {
        weather.start();
        air.start();
        news.start();
      },
      describe: () => `Brief: ${P.big.textContent} ${P.sub.textContent}. Top headline: ${news.data?.[0]?.title ?? 'none'}`,
    };
  },
};
