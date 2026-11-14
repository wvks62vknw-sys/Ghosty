/** SETTINGS tab: theme (seven looks and the twelve colours), THE LOOK (how everything is drawn), your name, units, how Ghosty talks (CHARACTER), voice, sounds, tilt-to-look, home location, the offline brain and the packs for no signal (offline maps, offline eyes). (Keys, models and status are in SYSTEM; email, Spotify and phone notifications in LINKS.) */
import { clear, fmt, h } from '../../core/dom';
import { para, rest } from '../../ui/oneline';
import { agoWords } from '../../workspace/versions';
import { lastBackupAt } from '../../workspace/store';
import { BUILD } from '../../state/build';
import { World } from '../../engine/world';
import type { TabDef } from '../../shell/tabs';
import { lookingAt, screenSays, stampFacts } from '../../shell/awareness';
import { home, settings } from '../../state/app';
import { presetNow, recipeEvents, recipeNow, themeKey, THEMES } from '../../state/theme';
import { button, panel, row, toast } from '../../ui/components';
import { looksGallery } from '../../ui/gallery';
import { key, stampLine } from '../../ui/machine';
import { wallRole } from '../../wall/role';
import { page } from '../../ui/page';
import { sectionNow, sections } from '../../ui/sections';
import { characterPanel } from './character';
import { facesBlock } from './faces'; // [guardian] PRIVACY → FACES
import { guardianPanel } from './guardian'; // [guardian] GUARDIAN: the named person and the panic phrase
import { offlinePanel } from './offline';
import { permissionsPanel } from './permissions'; // [health] PERMISSIONS: what the phone can be asked for
import { eyesPanel, mapsPanel, voiceModelPanel } from './packs';
import { saverPanel } from './saver';
import { keptBlock } from './kept';
import { wallPanel } from './wall'; // [wall] THE WALL: pair the second screen
import { shortcutsPanel } from './shortcuts'; // [resta] SHORTCUTS: Siri Shortcuts from Ghosty's links
import { switchRow } from './switch';
import { voiceControls } from './voice';
import { myVoicePanel, peoplePanel } from './voiceknown'; // [voiceknown] MY VOICE and PEOPLE I'VE INTRODUCED
import { tvNow, tvSetting } from '../../tv/setting'; // [restc] TV MODE
import { readingControls } from '../library/reader'; // [reader] READING: pages or scroll, the size, his voice for books
import { readingPrefs } from '../../library/place';

export const settingsTab: TabDef = {
  id: 'settings',
  title: 'SETTINGS',
  icon: '<path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="17" r="2"/>',
  scene: 'backdrop',
  blurb: 'theme · the looks · colour · the look · name · character · units · voice · sounds · tilt · home · offline brain · offline maps · offline eyes',
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
    // [health] PERMISSIONS, under the name: the nine things the phone can be asked for, in his words (permissions.ts)
    const pmp = permissionsPanel();
    P.left.append(lp.el, goRow('THE LOOK', 'look', 'How I draw everything'), rp.el, np.el, pmp.el, cp.el, gp.el);
    // [voiceknown] his voice known, and the people he introduced: under VOICE & HOME, in the same section (BRIEF-VOICE-KNOWN 2, 5)
    const mv = myVoicePanel();
    const pv = peoplePanel();
    P.right.append(vp.el, mv.el, pv.el, voiceModelPanel().el);
    const op = offlinePanel();
    P.right.append(op.el);
    // [offline] the map of his area and the Lens's eyes, kept on the phone on his tap (BRIEF-OFFLINE-1)
    P.right.append(mapsPanel().el, eyesPanel().el);
    // [next] SAVER: one switch that holds big downloads and the background feeds (saver.ts)
    P.right.append(saverPanel().el);
    const about = panel('ABOUT', { grow: false, status: BUILD.sha.slice(0, 7) });
    about.body.append(
      row('GHOSTY', 'Your own assistant: his brain runs in your Cloudflare account, his face on this phone.', null, { wrap: true }),
      row('VERSION', `${BUILD.sha.slice(0, 7)}${BUILD.at ? ` · built ${fmt.ago(Date.parse(BUILD.at))}` : ''}`),
    );
    const privacy = panel('PRIVACY', { grow: false, status: 'Yours only' });
    // [guardian] FACES: his own and the people he introduced, on this phone only, each gone in one tap
    const fb = facesBlock();
    const kept = keptBlock();
    privacy.body.append(
      h('p.note', 'What you tell me, what I remember and your keys are kept only in your own Cloudflare account and on this phone.'),
      ...para('p.note', 'Questions go only to the AI services you added keys for, with just the words needed. Memory never keeps passwords or what I read online.'),
      fb.el,
      // [next] everything kept about him, by kind, each with its own key to forget it, and his memory as a document (kept.ts)
      kept.el,
    );
    privacy.el.addEventListener('ghosty:reveal', () => void kept.refresh());
    const help = panel('HELP', { grow: false, status: 'Tips' });
    help.body.append(
      // (nothing on screen is a reactor any more, and there is one look: OWNER-ISSUES 45, BRIEF-ONE-LOOK)
      row('ASK', 'Tap Ask at the bottom, then type, or tap the microphone and talk.', null, { wrap: true }),
      row('SEARCH', 'The magnifier at the top finds any screen or place, or asks Ghosty.', null, { wrap: true }),
      row('EVERY SCREEN', 'Tap your initial at the top right, then Every screen; a long press opens it at once.', null, { wrap: true }),
      row('REMEMBER', 'Say "remember …" and he keeps it; Memory shows what he knows and lets you remove it.', null, { wrap: true }),
    );
    // [editors] THE WORKSPACE keeps its pages on this phone; "synced to the brain" means the daily encrypted backup, and this one line says when it last ran
    const wsp = panel('WORKSPACE', { grow: false, status: 'On this phone' });
    const paintWs = (): void => {
      const when = lastBackupAt();
      clear(wsp.body, row('SYNCED', when ? `My workspace is on this phone; the brain keeps only a sealed copy, last taken ${agoWords(when)}. I cannot open it.` : 'My workspace is on this phone; no backup has been taken yet, so the brain has no copy; SYSTEM takes one.', null, { wrap: true }));
    };
    paintWs();
    P.right.append(wsp.el, goRow('SECURITY', 'security', 'Every lock, every approval'), goRow('SYSTEM', 'system', 'Keys, models, backups'), goRow('LINKS', 'links', 'Email, Spotify, phone'), wallPanel().el, shortcutsPanel().el, about.el, privacy.el, help.el);
    // Sections (ui/sections.ts; the navigation sheet): a pill for each of the list's groups, the colour first. CHARACTER has no
    // group of its own (it sits under NAME & UNITS), so it goes with You: how he talks to you, beside what he calls you.
    sections(root, 'settings', [
      { id: 'appearance', label: 'Appearance', match: /^(THEME|THE LOOK|READING)/ },
      { id: 'you', label: 'You', match: /^(NAME|PERMISSIONS)/ },
      { id: 'voice', label: 'Voice & home', match: /^(VOICE|OFFLINE|SAVER|MY VOICE|PEOPLE I)/ },
      // [resta] SHORTCUTS (Siri) is Ghosty's own business too: under the same pill, so the row of pills stays as he knows it
      { id: 'ghosty', label: 'Ghosty', match: /^(SECURITY|SYSTEM|LINKS|SHORTCUTS|THE WALL|WORKSPACE)$/ },
      { id: 'about', label: 'About', match: /^(ABOUT|PRIVACY|HELP)$/ },
    ]);

    // Theme (BRIEF-THEME-GALLERY): seven looks as pictures and a row of twelve colours (ui/gallery.ts), under the stamp line that says
    // what the Machine is looking at. The ground, the dials, the switches and the presets are not on this page: they stay in the recipe
    // (state/theme.ts) and answer to his words ("paper", "black background", "glow off", "calm"). THE LOOK keeps its THEMES section.
    const gallery = looksGallery();
    const themeStamp = stampLine(() => stampFacts(lookingAt({ screen: 'settings', title: 'Theme', line: 'the theme', looking: 'the theme', at: Date.now() })));
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
    const paintThemes = () => gallery.paint();
    paintThemes();
    const name = h('input', { value: settings.get().name, placeholder: 'What should I call you?', 'aria-label': 'Your name' });
    name.addEventListener('change', () => settings.set({ name: name.value.trim() || 'Boss' }));
    const units = h('select', { 'aria-label': 'Units' }, h('option', { value: 'metric' }, 'Units: °C · km'), h('option', { value: 'imperial' }, 'Units: °F · miles'));
    units.value = settings.get().units;
    units.addEventListener('change', () => settings.set({ units: units.value as 'metric' | 'imperial' }));
    lp.body.append(themeStamp.el, gallery.el);
    // the Theme page is drawn in the system (its floor, its bar), as THE LOOK is: a class on the page while it is open
    new MutationObserver(() => document.body.classList.toggle('g-themepage', lp.el.classList.contains('pushed'))).observe(lp.el, { attributes: true, attributeFilter: ['class'] });
    // the recipe changing by itself (the day turning at sunrise or sunset) or from another screen: the row and the presets follow
    recipeEvents.on('change', () => {
      paintHead();
      paintThemes();
    });
    // [restc] TV MODE (tv/): big buttons, a focus ring, the arrow keys or a controller's d-pad; on by itself on a television
    const tvSw = switchRow('TV MODE', 'Big buttons and a focus ring for a controller; on by itself on a television.', tvNow, (on) => tvSetting.set({ mode: on ? 'on' : 'off' }));
    tvSw.el.classList.add('tvsw');
    tvSetting.subscribe(() => tvSw.paint());
    // [wall] THIS IS THE WALL: this screen becomes the second screen of his phone (wall/screen.ts); it asks for a code and nothing else
    const wallKey = key('THIS IS THE WALL', () => wallRole.set({ on: true }), { label: 'This screen is the wall: show me a code to pair with my phone' });
    wallKey.classList.add('tvwallkey');
    lp.body.append(tvSw.el, rest('You move the focus ring with the arrow keys or a controller’s d-pad.'), h('div.tvwallrow', h('p.note', 'A television or a laptop can be a second screen for your phone.'), wallKey), rest('It shows what you’re talking about, with nothing to touch.'));
    np.body.append(h('div.lab', 'YOUR NAME'), name, units);

    // Whose voice and which (the brain's natural British voices, or this phone's), a SAMPLE, and barge-in: voice.ts.
    const vc = voiceControls();
    // On/off settings are switches (switch.ts), not drop-downs.
    const sfx = switchRow('Interface sounds', 'Soft clicks when you tap', () => settings.get().sounds, (on) => settings.set({ sounds: on }));
    // THE SCORE (BRIEF-HUD-SCAN-1 7): B, the short score under the boot (a pad, a tick per thing found, the tone on the lock); off, A: the one tone alone
    const score = switchRow('The boot’s score', 'A short score under the boot, made on this phone; off, the one tone alone.', () => settings.get().bootScore !== false, (on) => settings.set({ bootScore: on }));
    score.el.dataset.id = 'bootscore';
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
          toast(e.code === 1 ? 'I’m not allowed your location: in iPhone Settings, Privacy & Security, Location Services, Safari Websites, allow it, or type the city.' : 'Couldn’t find where you are just now: try again outside, or type the city.', 'warn');
        },
        { timeout: 8000 },
      );
    });
    paintHome();
    // HOME KNOWS WHERE HE IS (BRIEF-HUD-SCAN-1 5; OWNER-ISSUES 158: on): the one switch; off, Home says SAVED PLACE ONLY
    const sense = switchRow('Home knows where you are', 'Decided on this phone from the hour, your saved place and its own sense; never sent anywhere.', () => settings.get().placeSense !== false, (on) => settings.set({ placeSense: on }));
    sense.el.dataset.id = 'placesense';
    // SHOW ME (BRIEF-KERNEL-YES 5; OWNER-ISSUES 173): the Stage under a reply, on by default; off, no picture under any reply
    const showMe = switchRow('Show me', 'A picture under the answer when there is one to show (a map, bars, a page, a part); off, never.', () => settings.get().showMe !== false, (on) => settings.set({ showMe: on }));
    showMe.el.dataset.id = 'showme';
    vp.body.append(...vc.nodes, sfx.el, score.el, rest('The score is a low pad, a tick for each thing I find and the tone when I lock on.'), motion.el, showMe.el, h('div.lab', 'HOME'), homeNow, h('div.keyrow', homeIn, setHome, gps), sense.el, rest('My brain gets a word at most, with your question, never where you are.'));

    paintHead();
    // The profile row follows every change, whether a swatch was tapped here, the name or units were edited,
    // or Ghosty switched the theme from chat.
    settings.subscribe((s, p) => {
      if (s.theme !== p.theme || s.look !== p.look || s.name !== p.name || s.units !== p.units) paintHead();
      if (s.theme !== p.theme || s.look !== p.look) paintThemes();
      if (s.home !== p.home) paintHome();
      if (s.sounds !== p.sounds) sfx.paint();
      if (s.motion !== p.motion) motion.paint();
      if (s.bootScore !== p.bootScore) score.paint();
      if (s.placeSense !== p.placeSense) sense.paint();
      if (s.showMe !== p.showMe) showMe.paint();
    });
    return {
      enter() {
        op.refresh();
        cp.refresh();
        gp.refresh();
        void fb.refresh();
        vc.refresh();
        void mv.refresh();
        void pv.refresh();
        paintThemes();
        paintHead();
      },
      // (BRIEF-SHELL pass 1) the section open
      context: () => {
        const sec = sectionNow('settings') || 'Settings';
        return screenSays('settings', 'Settings', `settings, on ${sec.toLowerCase()}`, { looking: 'settings', selected: { kind: 'group', id: `settings:${sec}`, label: sec } });
      },
      describe: () => `Settings: theme ${settings.get().theme}, name ${settings.get().name}`,
    };
  },
};
