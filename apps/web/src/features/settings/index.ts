/** SETTINGS tab: theme, your name, units, how Ghosty talks (CHARACTER), voice, sounds, tilt-to-look, home location and the offline brain. (Keys, models and status are in SYSTEM; email, Spotify and phone notifications in LINKS.) */
import { clear, fmt, h } from '../../core/dom';
import { BUILD } from '../../state/build';
import { World } from '../../engine/world';
import type { TabDef } from '../../shell/tabs';
import { home, settings } from '../../state/app';
import { applyTheme, proLook, THEMES } from '../../state/theme';
import { button, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { characterPanel } from './character';
import { offlinePanel } from './offline';
import { voiceControls } from './voice';

export const settingsTab: TabDef = {
  id: 'settings',
  title: 'SETTINGS',
  icon: '<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
  scene: 'backdrop',
  blurb: 'theme · name · character · units · voice · sounds · tilt · home · offline brain',
  mount(root) {
    const P = page(root, { tag: 'SETTINGS', leftLabel: 'LOOK', rightLabel: 'VOICE & HOME', stack: true });
    const lp = panel('LOOK', { grow: false });
    lp.el.classList.add('look');
    const vp = panel('VOICE & HOME', { grow: false });
    const cp = characterPanel();
    P.left.append(lp.el, cp.el);
    P.right.append(vp.el);
    const op = offlinePanel();
    P.right.append(op.el);
    // The calm looks: System and Links are rows of Settings (they open their own screens), then About, Privacy and Help.
    const goRow = (title: string, to: string, status: string) => {
      const p = panel(title, { grow: false, status });
      p.el.dataset.go = to;
      p.el.classList.add('gorow');
      return p.el;
    };
    const about = panel('ABOUT', { grow: false, status: BUILD.sha.slice(0, 7) });
    about.body.append(
      row('GHOSTY', 'Your own assistant: his brain runs in your Cloudflare account, his face on this phone.', null, { wrap: true }),
      row('VERSION', `${BUILD.sha.slice(0, 7)}${BUILD.at ? ` · built ${fmt.ago(Date.parse(BUILD.at))}` : ''}`),
      row('THEMES', `${Object.keys(THEMES).length} looks, from Graphite to the classic HUDs`),
    );
    const privacy = panel('PRIVACY', { grow: false, status: 'Yours only' });
    privacy.body.append(
      h('p.note', 'What you tell Ghosty, what he remembers and your keys are kept in your own Cloudflare account and on this phone — nowhere else.'),
      h('p.note', 'Questions go to the AI services you added keys for, and only the words needed to answer them. Memory never keeps passwords or what he read online.'),
    );
    const help = panel('HELP', { grow: false, status: 'Tips' });
    help.body.append(
      row('ASK', 'Type or tap the microphone on the reactor screen. Tap the reactor to wake it.', null, { wrap: true }),
      row('SEARCH', 'The magnifier at the top finds any screen, place or look, or asks Ghosty.', null, { wrap: true }),
      row('EVERY SCREEN', 'Tap your initial at the top right, then Every screen. A long press opens it at once.', null, { wrap: true }),
      row('REMEMBER', 'Say "remember …" and he keeps it; Memory shows what he knows and lets you remove it.', null, { wrap: true }),
    );
    P.right.append(goRow('SYSTEM', 'system', 'Keys, models, backups'), goRow('LINKS', 'links', 'Email, Spotify, phone'), about.el, privacy.el, help.el);

    // Theme picker: one card per theme, drawn in that theme's own colours and finish, so the
    // choice is made by looking rather than by name.
    const themes = h('div.themes');
    const paintHead = () => {
      const look = THEMES[settings.get().theme]?.label ?? 'Settings';
      const units = settings.get().units === 'metric' ? '°C · km' : '°F · miles';
      // The calm looks open Settings on a profile row (iOS): your name, then the look and units.
      if (proLook()) {
        P.big.textContent = settings.get().name;
        P.big.dataset.initial = (settings.get().name.trim()[0] ?? 'B').toUpperCase();
        P.big.dataset.case = 'keep';
        P.sub.textContent = `${look} · ${units}`;
      } else {
        P.big.textContent = look.toUpperCase();
        delete P.big.dataset.case;
        P.sub.textContent = `${settings.get().name} · ${units}`;
      }
    };
    const paintThemes = () => {
      clear(themes);
      const cur = settings.get().theme;
      let more = false;
      for (const [k, t] of Object.entries(THEMES)) {
        // the calm looks first, then every classic style under one label
        if (t.look !== 'pro' && !more) {
          more = true;
          themes.append(h('div.lab.morestyles', 'MORE STYLES'));
        }
        const b = h('button.tcard', { type: 'button', 'data-finish': t.finish, 'aria-pressed': String(cur === k), style: `--tc:${t.c};--ta:${t.a};--tr:${t.r};--tb:${t.bg}` },
          h('span.tprev', h('i.tp1'), h('i.tp2'), h('i.tp3'), h('i.tglow')),
          h('span.tname', t.label),
          h('span.ttag', t.tag),
        );
        b.classList.toggle('on', cur === k);
        b.addEventListener('click', () => {
          applyTheme(k);
          [...themes.children].forEach((x) => {
            x.classList.toggle('on', x === b);
            x.setAttribute('aria-pressed', String(x === b));
          });
          paintHead();
        });
        themes.append(b);
      }
    };
    paintThemes();
    const name = h('input', { value: settings.get().name, placeholder: 'What should I call you?', 'aria-label': 'Your name' });
    name.addEventListener('change', () => settings.set({ name: name.value.trim() || 'Boss' }));
    const units = h('select', { 'aria-label': 'Units' }, h('option', { value: 'metric' }, 'Units: °C · km'), h('option', { value: 'imperial' }, 'Units: °F · miles'));
    units.value = settings.get().units;
    units.addEventListener('change', () => settings.set({ units: units.value as 'metric' | 'imperial' }));
    lp.body.append(h('div.lab', 'THEME'), themes, h('div.lab', 'YOUR NAME'), name, units);

    // Whose voice and which (the brain's natural British voices, or this phone's), a SAMPLE, and barge-in: voice.ts.
    const vc = voiceControls();
    const sfx = h('select', { 'aria-label': 'Interface sounds' }, h('option', { value: 'on' }, 'Interface sounds: on'), h('option', { value: 'off' }, 'Interface sounds: off'));
    sfx.value = settings.get().sounds ? 'on' : 'off';
    sfx.addEventListener('change', () => settings.set({ sounds: sfx.value === 'on' }));
    const motion = h('select', { 'aria-label': 'Tilt to look around' }, h('option', { value: 'off' }, 'Tilt phone to look around: off'), h('option', { value: 'on' }, 'Tilt phone to look around: on'));
    motion.value = settings.get().motion ? 'on' : 'off';
    motion.addEventListener('change', () => settings.set({ motion: motion.value === 'on' }));
    const homeIn = h('input', { placeholder: `Home city (now ${home().name})`, 'aria-label': 'Home city' });
    const setHome = button('SET HOME', () => {
      const c = World.find(homeIn.value);
      if (!c) return toast('City not in my atlas', 'warn');
      settings.set({ home: { name: c.name, lat: c.lat, lon: c.lon } });
      toast(`Home set to ${c.name}`, 'ok');
      homeIn.value = '';
    });
    const gps = button('USE GPS', () =>
      navigator.geolocation?.getCurrentPosition(
        (p) => {
          const n = World.near(p.coords.latitude, p.coords.longitude, 5e4);
          settings.set({ home: { name: n && n.km < 80 ? n.city.name : 'Current position', lat: p.coords.latitude, lon: p.coords.longitude } });
          toast(`Home set to ${settings.get().home!.name}`, 'ok');
        },
        () => toast('Location unavailable', 'warn'),
        { timeout: 8000 },
      ),
    );
    vp.body.append(...vc.nodes, sfx, motion, h('div.lab', 'HOME'), h('div.keyrow', homeIn, setHome, gps));

    paintHead();
    // The name top-left is the theme in use: it follows every change, whether a card was tapped
    // here, the name or units were edited, or Ghosty switched the theme from chat.
    settings.subscribe((s, p) => {
      if (s.theme !== p.theme || s.name !== p.name || s.units !== p.units) paintHead();
      if (s.theme !== p.theme) paintThemes();
    });
    return {
      enter() {
        op.refresh();
        cp.refresh();
        vc.refresh();
        paintThemes();
        paintHead();
      },
      describe: () => `Settings: theme ${settings.get().theme}, name ${settings.get().name}`,
    };
  },
};
