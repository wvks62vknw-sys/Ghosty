/** SETTINGS tab: theme (Reactor, Graphite), your name, units, how Ghosty talks (CHARACTER), voice, sounds, tilt-to-look, home location and the offline brain. (Keys, models and status are in SYSTEM; email, Spotify and phone notifications in LINKS.) */
import { clear, fmt, h } from '../../core/dom';
import { BUILD } from '../../state/build';
import { World } from '../../engine/world';
import type { TabDef } from '../../shell/tabs';
import { home, settings } from '../../state/app';
import { applyTheme, themeKey, THEMES } from '../../state/theme';
import { button, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { characterPanel } from './character';
import { offlinePanel } from './offline';
import { switchRow } from './switch';
import { voiceControls } from './voice';

export const settingsTab: TabDef = {
  id: 'settings',
  title: 'SETTINGS',
  icon: '<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
  scene: 'backdrop',
  blurb: 'theme · name · character · units · voice · sounds · tilt · home · offline brain',
  mount(root) {
    const P = page(root, { tag: 'SETTINGS', leftLabel: 'THEME', rightLabel: 'VOICE & HOME', stack: true });
    // THEME: the one design in a colour (state/theme.ts); NAME & UNITS: what he calls you, and how he measures.
    const lp = panel('THEME', { grow: false, status: THEMES[themeKey(settings.get().theme)]!.label });
    lp.el.classList.add('themepn');
    const np = panel('NAME & UNITS', { grow: false, status: settings.get().name });
    const vp = panel('VOICE & HOME', { grow: false });
    const cp = characterPanel();
    P.left.append(lp.el, np.el, cp.el);
    P.right.append(vp.el);
    const op = offlinePanel();
    P.right.append(op.el);
    // System and Links are rows of Settings (they open their own screens), then About, Privacy and Help.
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
      row('THEMES', `${Object.values(THEMES).map((t) => t.label).join(' and ')}: colours of the one design`, null, { wrap: true }),
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

    // Theme: one live swatch per theme, drawn in its own accent (a little Home: the glow, the reactor, the lit
    // tab). A tap applies it at once, everywhere, and this phone remembers it.
    const themes = h('div.swatches', { role: 'radiogroup', 'aria-label': 'Theme' });
    const paintHead = () => {
      const t = THEMES[themeKey(settings.get().theme)]!;
      const units = settings.get().units === 'metric' ? '°C · km' : '°F · miles';
      // Settings opens on a profile row (iOS): your name, then the theme and units.
      P.big.textContent = settings.get().name;
      P.big.dataset.initial = (settings.get().name.trim()[0] ?? 'B').toUpperCase();
      P.big.dataset.case = 'keep';
      P.sub.textContent = `${t.label} · ${units}`;
      lp.setStatus(t.label);
      np.setStatus(settings.get().name);
    };
    const paintThemes = () => {
      const cur = themeKey(settings.get().theme);
      clear(themes, ...Object.entries(THEMES).map(([k, t]) => {
        const b = h('button.swatch', { type: 'button', role: 'radio', 'aria-checked': String(cur === k), dataset: { theme: k, case: 'keep' }, style: `--sw:${t.c};--sw2:${t.pale};--swk:${t.glow}` },
          h('span.swprev', { 'aria-hidden': 'true' }, h('i.swglow'), h('i.swcore'), h('i.swbar', h('i'), h('i'), h('i'))),
          h('span.swtxt', h('b', { dataset: { case: 'keep' } }, t.label), h('small', { dataset: { case: 'keep' } }, t.tag)),
          h('i.swtick', { 'aria-hidden': 'true' }),
        );
        b.classList.toggle('on', cur === k);
        b.addEventListener('click', () => {
          if (themeKey(settings.get().theme) === k) return;
          applyTheme(k);
          toast(`Theme: ${t.label}`, 'ok');
        });
        return b;
      }));
    };
    paintThemes();
    const name = h('input', { value: settings.get().name, placeholder: 'What should I call you?', 'aria-label': 'Your name' });
    name.addEventListener('change', () => settings.set({ name: name.value.trim() || 'Boss' }));
    const units = h('select', { 'aria-label': 'Units' }, h('option', { value: 'metric' }, 'Units: °C · km'), h('option', { value: 'imperial' }, 'Units: °F · miles'));
    units.value = settings.get().units;
    units.addEventListener('change', () => settings.set({ units: units.value as 'metric' | 'imperial' }));
    lp.body.append(themes, h('p.note.swnote', 'A theme changes Ghosty’s colour and nothing else: every screen keeps its layout.'));
    np.body.append(h('div.lab', 'YOUR NAME'), name, units);

    // Whose voice and which (the brain's natural British voices, or this phone's), a SAMPLE, and barge-in: voice.ts.
    const vc = voiceControls();
    // On/off settings are switches (switch.ts), not drop-downs.
    const sfx = switchRow('Interface sounds', 'Soft clicks when you tap', () => settings.get().sounds, (on) => settings.set({ sounds: on }));
    const motion = switchRow('Tilt phone to look around', 'The 3D scenes follow the phone', () => settings.get().motion, (on) => settings.set({ motion: on }));
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
    vp.body.append(...vc.nodes, sfx.el, motion.el, h('div.lab', 'HOME'), h('div.keyrow', homeIn, setHome, gps));

    paintHead();
    // The profile row follows every change, whether a swatch was tapped here, the name or units were edited,
    // or Ghosty switched the theme from chat.
    settings.subscribe((s, p) => {
      if (s.theme !== p.theme || s.name !== p.name || s.units !== p.units) paintHead();
      if (s.theme !== p.theme) paintThemes();
      if (s.sounds !== p.sounds) sfx.paint();
      if (s.motion !== p.motion) motion.paint();
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
