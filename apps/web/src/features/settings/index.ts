/** SETTINGS tab: theme (the twelve), THE LOOK (how everything is drawn), your name, units, how Ghosty talks (CHARACTER), voice, sounds, tilt-to-look, home location and the offline brain. (Keys, models and status are in SYSTEM; email, Spotify and phone notifications in LINKS.) */
import { fmt, h } from '../../core/dom';
import { BUILD } from '../../state/build';
import { World } from '../../engine/world';
import type { TabDef } from '../../shell/tabs';
import { home, settings } from '../../state/app';
import { presetNow, recipeEvents, recipeNow, themeKey, THEMES } from '../../state/theme';
import { button, panel, row, toast } from '../../ui/components';
import { themeSwatches } from '../../ui/swatches';
import { lookDials } from '../../ui/dials';
import { page } from '../../ui/page';
import { sections } from '../../ui/sections';
import { characterPanel } from './character';
import { facesBlock } from './faces'; // [guardian] PRIVACY → FACES
import { guardianPanel } from './guardian'; // [guardian] GUARDIAN: the named person and the panic phrase
import { offlinePanel } from './offline';
import { shortcutsPanel } from './shortcuts'; // [resta] SHORTCUTS: Siri Shortcuts from Ghosty's links
import { switchRow } from './switch';
import { voiceControls } from './voice';
import { tvNow, tvSetting } from '../../tv/setting'; // [restc] TV MODE
import { readingControls } from '../library/reader'; // [reader] READING: pages or scroll, the size, his voice for books
import { readingPrefs } from '../../library/place';

export const settingsTab: TabDef = {
  id: 'settings',
  title: 'SETTINGS',
  icon: '<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
  scene: 'backdrop',
  blurb: 'theme · ground · world · switches · the look · name · character · units · voice · sounds · tilt · home · offline brain',
  mount(root) {
    const P = page(root, { tag: 'SETTINGS', leftLabel: 'THEME', rightLabel: 'VOICE & HOME', stack: true });
    // THEME: his recipe (state/theme.ts; BRIEF-THEMES-2): the presets first, the dials under them; the row says the recipe.
    // NAME & UNITS: what he calls you, and how he measures.
    const lp = panel('THEME', { grow: false, status: recipeNow() });
    lp.el.classList.add('themepn');
    const np = panel('NAME & UNITS', { grow: false, status: settings.get().name });
    const vp = panel('VOICE & HOME', { grow: false });
    const cp = characterPanel();
    // [guardian] GUARDIAN goes with You (after CHARACTER, like it with no group of its own): the one person, the panic phrase
    const gp = guardianPanel();
    // System and Links are rows of Settings (they open their own screens), then About, Privacy and Help.
    const goRow = (title: string, to: string, status: string) => {
      const p = panel(title, { grow: false, status });
      p.el.dataset.go = to;
      p.el.classList.add('gorow');
      return p.el;
    };
    // THE LOOK (features/look, BRIEF-DESIGN-SYSTEM 5): how everything is drawn from here, a row under the theme (two taps away)
    // [reader] READING (BRIEF-LIBRARY-READER 1, 3): how a book is shown in the reader and whose voice reads it to him; the same
    // controls as the reader's own TEXT key
    const rp = panel('READING', { grow: false });
    const paintReading = () => rp.setStatus(`${readingPrefs.get().mode === 'pages' ? 'Pages' : 'Scroll'} · ${readingPrefs.get().size} pt`);
    paintReading();
    readingPrefs.subscribe(paintReading);
    rp.body.append(readingControls());
    P.left.append(lp.el, goRow('THE LOOK', 'look', 'How I draw everything'), rp.el, np.el, cp.el, gp.el);
    P.right.append(vp.el);
    const op = offlinePanel();
    P.right.append(op.el);
    const about = panel('ABOUT', { grow: false, status: BUILD.sha.slice(0, 7) });
    about.body.append(
      row('GHOSTY', 'Your own assistant: his brain runs in your Cloudflare account, his face on this phone.', null, { wrap: true }),
      row('VERSION', `${BUILD.sha.slice(0, 7)}${BUILD.at ? ` · built ${fmt.ago(Date.parse(BUILD.at))}` : ''}`),
    );
    const privacy = panel('PRIVACY', { grow: false, status: 'Yours only' });
    // [guardian] FACES: his own and the people he introduced, on this phone only, each gone in one tap
    const fb = facesBlock();
    privacy.body.append(
      h('p.note', 'What you tell Ghosty, what he remembers and your keys are kept in your own Cloudflare account and on this phone — nowhere else.'),
      h('p.note', 'Questions go to the AI services you added keys for, and only the words needed to answer them. Memory never keeps passwords or what he read online.'),
      fb.el,
    );
    const help = panel('HELP', { grow: false, status: 'Tips' });
    help.body.append(
      // (nothing on screen is a reactor any more, and there is one look: OWNER-ISSUES 45, BRIEF-ONE-LOOK)
      row('ASK', 'Tap Ask at the bottom, then type, or tap the microphone and talk.', null, { wrap: true }),
      row('SEARCH', 'The magnifier at the top finds any screen or place, or asks Ghosty.', null, { wrap: true }),
      row('EVERY SCREEN', 'Tap your initial at the top right, then Every screen. A long press opens it at once.', null, { wrap: true }),
      row('REMEMBER', 'Say "remember …" and he keeps it; Memory shows what he knows and lets you remove it.', null, { wrap: true }),
    );
    P.right.append(goRow('SYSTEM', 'system', 'Keys, models, backups'), goRow('LINKS', 'links', 'Email, Spotify, phone'), shortcutsPanel().el, about.el, privacy.el, help.el);
    // Sections (ui/sections.ts; the navigation sheet): a pill for each of the list's groups, the colour first. CHARACTER has no
    // group of its own (it sits under NAME & UNITS), so it goes with You: how he talks to you, beside what he calls you.
    sections(root, 'settings', [
      { id: 'appearance', label: 'Appearance', match: /^(THEME|THE LOOK|READING)/ },
      { id: 'you', label: 'You', match: /^NAME/ },
      { id: 'voice', label: 'Voice & home', match: /^(VOICE|OFFLINE)/ },
      // [resta] SHORTCUTS (Siri) is Ghosty's own business too: under the same pill, so the row of pills stays as he knows it
      { id: 'ghosty', label: 'Ghosty', match: /^(SYSTEM|LINKS|SHORTCUTS)$/ },
      { id: 'about', label: 'About', match: /^(ABOUT|PRIVACY|HELP)$/ },
    ]);

    // Theme: the seventeen presets as live swatches (ui/swatches.ts), each drawn by the design system on its own ground, in its
    // colour and world; the dials under them (ui/dials.ts: GROUND, COLOUR, WORLD, the switches). A tap applies at once,
    // everywhere, and this phone remembers it; a dial changed under a preset makes Custom, kept exactly as set.
    const themes = themeSwatches();
    const dials = lookDials({ label: 'Theme dials' });
    const paintHead = () => {
      const t = THEMES[themeKey(settings.get().theme)]!;
      const units = settings.get().units === 'metric' ? '°C · km' : '°F · miles';
      // Settings opens on a profile row (iOS): your name, then the theme and units.
      P.big.textContent = settings.get().name;
      P.big.dataset.initial = (settings.get().name.trim()[0] ?? 'B').toUpperCase();
      P.big.dataset.case = 'keep';
      P.sub.textContent = `${t.label} · ${units}`;
      // the Theme row says the recipe ("Ember · Black · The Scan"; following the day, "Paper till 16:32")
      lp.setStatus(recipeNow());
      lp.el.dataset.preset = presetNow()?.key ?? 'custom';
      np.setStatus(settings.get().name);
    };
    const paintThemes = () => themes.paint();
    paintThemes();
    const name = h('input', { value: settings.get().name, placeholder: 'What should I call you?', 'aria-label': 'Your name' });
    name.addEventListener('change', () => settings.set({ name: name.value.trim() || 'Boss' }));
    const units = h('select', { 'aria-label': 'Units' }, h('option', { value: 'metric' }, 'Units: °C · km'), h('option', { value: 'imperial' }, 'Units: °F · miles'));
    units.value = settings.get().units;
    units.addEventListener('change', () => settings.set({ units: units.value as 'metric' | 'imperial' }));
    lp.body.append(
      h('p.gpage-lede', { dataset: { case: 'keep' } }, 'Pick a whole look, or turn the dials under it. I keep what you set, and wake up in it.'),
      themes.el,
      dials.el,
      h('p.note.swnote', 'A preset is a whole recipe: its ground, its colour, its world and its switches. Change any dial and I keep it as Custom. Settings › The look shows how I draw everything.'),
    );
    // the Theme page is drawn in the system (its floor, its bar), as THE LOOK is: a class on the page while it is open
    new MutationObserver(() => document.body.classList.toggle('g-themepage', lp.el.classList.contains('pushed'))).observe(lp.el, { attributes: true, attributeFilter: ['class'] });
    // the recipe changing by itself (the day turning at sunrise or sunset) or from another screen: the row and the presets follow
    recipeEvents.on('change', () => {
      paintHead();
      paintThemes();
    });
    // [restc] TV MODE (tv/): big buttons, a focus ring, the arrow keys or a controller's d-pad; on by itself on a television
    const tvSw = switchRow('TV MODE', 'Big buttons and a focus ring you move with the arrow keys or a controller’s d-pad. On by itself on a television.', tvNow, (on) => tvSetting.set({ mode: on ? 'on' : 'off' }));
    tvSw.el.classList.add('tvsw');
    tvSetting.subscribe(() => tvSw.paint());
    lp.body.append(tvSw.el);
    np.body.append(h('div.lab', 'YOUR NAME'), name, units);

    // Whose voice and which (the brain's natural British voices, or this phone's), a SAMPLE, and barge-in: voice.ts.
    const vc = voiceControls();
    // On/off settings are switches (switch.ts), not drop-downs.
    const sfx = switchRow('Interface sounds', 'Soft clicks when you tap', () => settings.get().sounds, (on) => settings.set({ sounds: on }));
    const motion = switchRow('Tilt phone to look around', 'The 3D scenes follow the phone', () => settings.get().motion, (on) => settings.set({ motion: on }));
    // HOME: where home is now, said in full (it was only in the box's placeholder, cut off at "Home city (now Lonc").
    const homeNow = h('div.note.homenow');
    const paintHome = () => (homeNow.textContent = `Home: ${home().name}`);
    const homeIn = h('input', { placeholder: 'Another city', 'aria-label': 'Home city' });
    const setHome = button('SET HOME', () => {
      const q = homeIn.value.trim();
      if (!q) return toast('Type a city first, or tap Use GPS', 'warn');
      const c = World.find(q);
      if (!c) return toast(`I don’t know “${q.slice(0, 40)}” yet: try the nearest big town`, 'warn');
      settings.set({ home: { name: c.name, lat: c.lat, lon: c.lon } });
      toast(`Home set to ${c.name}`, 'ok');
      homeIn.value = '';
    });
    // USE GPS says what it is doing, and why it could not (it did nothing at all where the browser has no location).
    const gps = button('USE GPS', (b) => {
      if (!navigator.geolocation) return toast('This browser can’t share where you are: type the city instead', 'warn');
      b.disabled = true;
      toast('Finding where you are…');
      navigator.geolocation.getCurrentPosition(
        (p) => {
          b.disabled = false;
          const n = World.near(p.coords.latitude, p.coords.longitude, 5e4);
          settings.set({ home: { name: n && n.km < 80 ? n.city.name : 'Current position', lat: p.coords.latitude, lon: p.coords.longitude } });
          toast(`Home set to ${settings.get().home!.name}`, 'ok');
        },
        (e) => {
          b.disabled = false;
          toast(e.code === 1 ? 'Ghosty isn’t allowed your location: on the iPhone, Settings › Privacy & Security › Location Services › Safari Websites. Or type the city.' : 'Couldn’t find where you are just now: try again outside, or type the city.', 'warn');
        },
        { timeout: 8000 },
      );
    });
    paintHome();
    vp.body.append(...vc.nodes, sfx.el, motion.el, h('div.lab', 'HOME'), homeNow, h('div.keyrow', homeIn, setHome, gps));

    paintHead();
    // The profile row follows every change, whether a swatch was tapped here, the name or units were edited,
    // or Ghosty switched the theme from chat.
    settings.subscribe((s, p) => {
      if (s.theme !== p.theme || s.look !== p.look || s.name !== p.name || s.units !== p.units) paintHead();
      if (s.theme !== p.theme || s.look !== p.look) paintThemes();
      if (s.home !== p.home) paintHome();
      if (s.sounds !== p.sounds) sfx.paint();
      if (s.motion !== p.motion) motion.paint();
    });
    return {
      enter() {
        op.refresh();
        cp.refresh();
        gp.refresh();
        void fb.refresh();
        vc.refresh();
        paintThemes();
        paintHead();
      },
      describe: () => `Settings: theme ${settings.get().theme}, name ${settings.get().name}`,
    };
  },
};
