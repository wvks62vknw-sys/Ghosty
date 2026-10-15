/** SYSTEM tab: keys, AI models, appearance, voice, home location and connection status. */
import type { BrainStatus, KeyStatus } from '../../../../../packages/shared/src/protocol';
import { brain, ownerKey } from '../../api/brain';
import { canPromptInstall, disablePush, enablePush, installHelp, promptInstall, pushState } from '../../assistant/push';
import { listVoices } from '../../assistant/voice';
import { clear, fmt, h } from '../../core/dom';
import { stats } from '../../engine/scheduler';
import { World } from '../../engine/world';
import type { TabDef } from '../../shell/tabs';
import { home, settings } from '../../state/app';
import { BUILD } from '../../state/build';
import { applyTheme, THEMES } from '../../state/theme';
import { button, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';

export const systemTab: TabDef = {
  id: 'system',
  title: 'SYSTEM',
  icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
  scene: 'backdrop',
  mount(root) {
    const P = page(root, { tag: 'SYSTEM CORE', rightLabel: 'LOOK & STATUS', leftLabel: 'KEYS & MODELS' });
    const kp = panel('KEYS', { cls: 'scroll' });
    const mp = panel('AI MODELS', { footer: true, grow: false, cls: 'models' });
    P.left.append(kp.el, mp.el);
    const lp = panel('LOOK & VOICE', { grow: false });
    const ap = panel('PHONE APP & NOTIFICATIONS', { grow: false, cls: 'scroll' });
    const sp = panel('STATUS');
    P.right.append(lp.el, ap.el, sp.el);
    const paintApp = async () => {
      const st = pushState.get();
      clear(ap.body);
      ap.setStatus(st.status === 'on' ? 'NOTIFYING' : st.installed ? 'APP' : '', st.status === 'on' ? 'ok' : 'mid');
      ap.body.append(
        h('div.note', st.installed ? 'Ghosty is installed as an app on this device.' : `Install Ghosty like an app: ${installHelp()}`),
        h(
          'div.keyrow.wrapit',
          canPromptInstall() && !st.installed ? button('INSTALL APP', async () => void (await promptInstall())) : '',
          st.status === 'on'
            ? button('TURN OFF HERE', async () => {
                await disablePush();
                void paintApp();
              }, 'warn')
            : button('TURN ON NOTIFICATIONS', async () => {
                toast(await enablePush(), pushState.get().status === 'on' ? 'ok' : 'warn');
                void paintApp();
              }, 'on'),
          button('SEND TEST', async () => {
            const r = await brain.pushTest().catch(() => ({ sent: 0 }));
            toast(r.sent ? `Sent to ${r.sent} device(s)` : 'No device has notifications on yet', r.sent ? 'ok' : 'warn');
          }),
        ),
        st.status === 'blocked' ? h('div.note.bad', "Notifications are blocked for this site. Allow them in the browser's site settings (padlock icon), then press TURN ON.") : '',
        st.status === 'needs-install' ? h('div.note.bad', 'On iPhone, notifications only work after "Add to Home Screen". Open Ghosty from the home-screen icon and turn them on there.') : '',
      );
      try {
        const { devices } = await brain.pushDevices();
        if (devices.length) ap.body.append(h('div.lab', 'DEVICES THAT GET NOTIFICATIONS'));
        for (const d of devices) {
          const r = row(fmt.ago(d.at), d.label, '✕');
          const x = r.lastChild as HTMLElement;
          x.classList.add('del');
          x.title = 'Stop notifying this device';
          x.addEventListener('click', async () => {
            await brain.pushRemove(d.id);
            void paintApp();
          });
          ap.body.append(r);
        }
      } catch {
        /* offline */
      }
    };
    pushState.subscribe(() => void paintApp());
    void paintApp();
    let status: BrainStatus | null = null;

    let showOptional = false;
    const openHelp = new Set<string>();
    const paintKeys = () => {
      clear(kp.body);
      if (!status) {
        kp.body.append(h('div.note', 'Brain not reachable. Check the connection on the right.'));
        return;
      }
      const missing = status.keys.filter((k) => k.need === 'needed' && !k.set);
      kp.setStatus(missing.length ? `${missing.length} NEEDED` : 'READY', missing.length ? 'mid' : 'ok');
      kp.body.append(
        h('div.note', missing.length
          ? 'You only need the two keys under NEEDED. Each takes about a minute: press HOW TO GET IT and follow the steps. Keys are encrypted in your brain and never shown again.'
          : 'All set. The others are optional extras. Keys are encrypted in your brain and never shown again.'),
      );
      const block = (k: KeyStatus) => {
        const input = h('input', { type: 'password', placeholder: k.set ? 'saved — paste a new one to replace' : `paste here (${k.hint})`, autocomplete: 'off', 'aria-label': `${k.label} key` });
        const st = h('small.note', '');
        const save = button(k.set ? 'REPLACE' : 'SAVE', async (b) => {
          const v = input.value.trim();
          if (!v) return void (st.textContent = 'Paste the key into the box first.');
          b.disabled = true;
          st.textContent = 'checking…';
          try {
            const r = await brain.setKey(k.name, v);
            input.value = '';
            st.textContent = r.works === false ? `saved, but ${r.info}` : `saved · ${r.info ?? 'ok'}`;
            st.className = `note ${r.works === false ? 'bad' : 'good'}`;
            toast(r.works === false ? `${k.label}: ${r.info}` : `${k.label} key works`, r.works === false ? 'warn' : 'ok');
            setTimeout(() => void load(), 1200);
          } catch (e) {
            st.textContent = String((e as Error).message);
          } finally {
            b.disabled = false;
          }
        });
        const remove = k.set ? button('REMOVE', async () => {
          await brain.setKey(k.name, '');
          void load();
        }, 'warn') : null;
        const steps = h('ol.steps', ...k.steps.map((x) => h('li', x)));
        steps.hidden = !openHelp.has(k.name);
        const help = button(steps.hidden ? 'HOW TO GET IT' : 'HIDE STEPS', (b) => {
          steps.hidden = !steps.hidden;
          if (steps.hidden) openHelp.delete(k.name);
          else openHelp.add(k.name);
          b.textContent = steps.hidden ? 'HOW TO GET IT' : 'HIDE STEPS';
        });
        const link = h('a.lnk', { href: k.link, target: '_blank', rel: 'noopener' }, 'OPEN SITE ↗');
        return h(
          'div.keyblock',
          h('div.row', h('span.lab', k.label), h('span.sp'), h(`small.chip${k.set ? '.good' : ''}` as 'small', k.set ? '✓ SAVED' : 'NOT SET')),
          h('div.note', k.why),
          h('div.keyrow', help, link),
          steps,
          h('div.keyrow', input, save, remove),
          st,
        );
      };
      const groups: [string, KeyStatus['need']][] = [['NEEDED', 'needed'], ['RECOMMENDED', 'recommended'], ['OPTIONAL', 'optional']];
      for (const [title, need] of groups) {
        const ks = status.keys.filter((k) => k.need === need);
        if (!ks.length) continue;
        kp.body.append(h('div.lab.keygroup', title));
        if (need === 'optional' && !showOptional && !ks.some((k) => k.set)) {
          kp.body.append(button(`SHOW ${ks.length} OPTIONAL KEYS (NOT NEEDED)`, () => { showOptional = true; paintKeys(); }));
          continue;
        }
        for (const k of ks) kp.body.append(block(k));
      }
    };
    const paintModels = () => {
      clear(mp.body);
      if (!status) return;
      mp.setStatus(status.lastModel ? `LAST: ${status.lastModel}` : '', 'ok');
      if (!status.models.length) mp.body.append(h('div.note', 'Add at least one AI key above. Gemini is the strongest free option for building things; Groq is the fastest for chat.'));
      for (const m of status.models) mp.body.append(row(m.provider.toUpperCase(), m.model, m.info, { tone: m.state === 'ok' ? 'up' : m.state === 'cool' ? undefined : 'dn' }));
    };
    mp.foot!.append(button('RE-CHECK MODELS', async () => {
      await brain.resetModels().catch(() => undefined);
      void load();
    }));

    // look & voice
    const themes = h('div.grid3', ...Object.entries(THEMES).map(([k, t]) => {
      const b = button(t.label, () => {
        applyTheme(k);
        [...themes.children].forEach((x) => x.classList.toggle('on', x === b));
      }, settings.get().theme === k ? 'on' : '');
      b.style.color = t.c;
      return b;
    }));
    const name = h('input', { value: settings.get().name, placeholder: 'What should I call you?', 'aria-label': 'Your name' });
    name.addEventListener('change', () => settings.set({ name: name.value.trim() || 'Boss' }));
    const units = h('select', { 'aria-label': 'Units' }, h('option', { value: 'metric' }, 'Units: °C · km'), h('option', { value: 'imperial' }, 'Units: °F · miles'));
    units.value = settings.get().units;
    units.addEventListener('change', () => settings.set({ units: units.value as 'metric' | 'imperial' }));
    const voice = h('select', { 'aria-label': 'Voice' });
    const fillVoices = () => {
      clear(voice, h('option', { value: 'auto' }, 'Voice: best available'), ...listVoices().map((v) => h('option', { value: v.name }, `${v.name} (${v.lang})`)));
      voice.value = settings.get().voice;
    };
    fillVoices();
    setTimeout(fillVoices, 1000);
    voice.addEventListener('change', () => settings.set({ voice: voice.value }));
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
    lp.body.append(h('div.lab', 'THEME'), themes, h('div.lab', 'YOUR NAME'), name, units, voice, h('div.lab', 'HOME'), h('div.keyrow', homeIn, setHome, gps));

    // A newer version shipped than the one on screen? (Compares with the latest version on GitHub.)
    let newer = false;
    const checkVersion = async () => {
      if (!/^[0-9a-f]{40}$/.test(BUILD.sha)) return;
      try {
        const c = await brain.changes();
        const latest = c.versions[0]?.sha;
        newer = !!latest && latest !== BUILD.sha && Date.parse(c.versions[0]!.date) > Date.parse(BUILD.at || '0');
        paintStatus();
      } catch {
        /* no GitHub connection: nothing to compare with */
      }
    };
    const paintStatus = () => {
      clear(sp.body);
      sp.body.append(
        row('BRAIN', status ? 'CONNECTED' : 'UNREACHABLE', null, { tone: status ? 'up' : 'dn' }),
        row('OWNER', status?.owner ?? '—'),
        row('SELF-EDIT', status?.repoReady ? `ON · ${status.repo}` : 'OFF — needs GitHub token', null, { tone: status?.repoReady ? 'up' : undefined }),
        row('PREVIEWS', status?.previews ?? 'unknown'),
        row('FRAME RATE', `${Math.round(stats.fps)} fps @ ${Math.round(stats.scale * 100)}%`),
        row('THIS DEVICE', ownerKey.get() ? 'paired with owner key' : 'signed in via Cloudflare Access'),
        row('VERSION', `${BUILD.sha.slice(0, 7)}${BUILD.at ? ` · built ${fmt.ago(Date.parse(BUILD.at))}` : ''}`, newer ? 'NEWER SHIPPED' : null, { tone: newer ? 'bad' : undefined }),
      );
      if (newer) sp.body.append(button('RELOAD TO GET THE NEW VERSION', () => location.reload(), 'on'));
      if (ownerKey.get()) sp.body.append(button('FORGET OWNER KEY ON THIS DEVICE', () => { ownerKey.set(''); location.reload(); }, 'warn'));
    };

    const load = async () => {
      try {
        status = await brain.status();
        P.big.textContent = status.models.some((m) => m.state === 'ok') ? 'ONLINE' : 'NO MODELS';
        P.sub.textContent = `${status.models.filter((m) => m.state === 'ok').length} models ready · ${status.keys.filter((k) => k.set).length} keys set`;
      } catch {
        status = null;
        P.big.textContent = 'OFFLINE';
      }
      paintKeys();
      paintModels();
      paintStatus();
    };
    return {
      enter() {
        void load();
        void checkVersion();
      },
      describe: () => `System: ${P.big.textContent} · ${P.sub.textContent}`,
    };
  },
};
