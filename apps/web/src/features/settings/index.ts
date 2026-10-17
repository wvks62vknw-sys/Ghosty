/** SETTINGS tab: theme, your name, units, voice, sounds, tilt-to-look, home location and the offline brain. (Keys, models and status are in SYSTEM; email, Spotify and phone notifications in LINKS.) */
import { listVoices } from '../../assistant/voice';
import { clear, h } from '../../core/dom';
import { World } from '../../engine/world';
import type { TabDef } from '../../shell/tabs';
import { home, settings } from '../../state/app';
import { applyTheme, THEMES } from '../../state/theme';
import { button, panel, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { offlinePanel } from './offline';

export const settingsTab: TabDef = {
  id: 'settings',
  title: 'SETTINGS',
  icon: '<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
  scene: 'backdrop',
  blurb: 'theme · name · units · voice · sounds · tilt · home · offline brain',
  mount(root) {
    const P = page(root, { tag: 'SETTINGS', leftLabel: 'LOOK', rightLabel: 'VOICE & HOME', stack: true });
    const lp = panel('LOOK', { grow: false });
    lp.el.classList.add('look');
    const vp = panel('VOICE & HOME', { grow: false });
    P.left.append(lp.el);
    P.right.append(vp.el);
    const op = offlinePanel();
    P.right.append(op.el);

    // Theme picker: one card per theme, drawn in that theme's own colours and finish, so the
    // choice is made by looking rather than by name.
    const themes = h('div.themes');
    const paintHead = () => {
      P.big.textContent = THEMES[settings.get().theme]?.label.toUpperCase() ?? 'SETTINGS';
      P.sub.textContent = `${settings.get().name} · ${settings.get().units === 'metric' ? '°C · km' : '°F · miles'}`;
    };
    const paintThemes = () => {
      clear(themes);
      const cur = settings.get().theme;
      for (const [k, t] of Object.entries(THEMES)) {
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

    // Whose voice: Ghosty's own (made by the brain, the same everywhere) or this phone's, which the list below picks.
    const engine = h('select', { 'aria-label': 'Voice engine' }, h('option', { value: 'ghosty' }, "Ghosty's own voice (from the brain)"), h('option', { value: 'phone' }, "This phone's voice"));
    engine.value = settings.get().voiceEngine;
    engine.addEventListener('change', () => settings.set({ voiceEngine: engine.value === 'phone' ? 'phone' : 'ghosty' }));
    const voice = h('select', { 'aria-label': 'Voice' });
    const fillVoices = () => {
      clear(voice, h('option', { value: 'auto' }, 'Voice: best available'), ...listVoices().map((v) => h('option', { value: v.name }, `${v.name} (${v.lang})`)));
      voice.value = settings.get().voice;
    };
    fillVoices();
    setTimeout(fillVoices, 1000);
    voice.addEventListener('change', () => settings.set({ voice: voice.value }));
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
    vp.body.append(h('div.lab', 'VOICE'), engine, voice, sfx, motion, h('div.lab', 'HOME'), h('div.keyrow', homeIn, setHome, gps));

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
        paintThemes();
        paintHead();
      },
      describe: () => `Settings: theme ${settings.get().theme}, name ${settings.get().name}`,
    };
  },
};
