/** SYSTEM tab: keys, AI models, appearance, voice, home location and connection status. */
import type { BrainStatus } from '../../../../../packages/shared/src/protocol';
import { brain, ownerKey } from '../../api/brain';
import { listVoices } from '../../assistant/voice';
import { clear, h } from '../../core/dom';
import { stats } from '../../engine/scheduler';
import { World } from '../../engine/world';
import type { TabDef } from '../../shell/tabs';
import { home, settings } from '../../state/app';
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
    const kp = panel('KEYS · STORED ENCRYPTED IN YOUR BRAIN');
    const mp = panel('AI MODELS', { footer: true });
    P.left.append(kp.el, mp.el);
    const lp = panel('LOOK & VOICE', { grow: false });
    const sp = panel('STATUS');
    P.right.append(lp.el, sp.el);
    let status: BrainStatus | null = null;

    const paintKeys = () => {
      clear(kp.body);
      if (!status) {
        kp.body.append(h('div.note', 'Brain not reachable. Check the connection on the right.'));
        return;
      }
      kp.body.append(h('div.note', 'Keys are sent once to your brain, encrypted there, and never shown again. Free keys take about a minute each.'));
      for (const k of status.keys) {
        const input = h('input', { type: 'password', placeholder: k.set ? '•••••••• saved — paste to replace' : k.hint, autocomplete: 'off', 'aria-label': k.label });
        const st = h('small.note', k.set ? 'saved' : '');
        const save = button(k.set ? 'REPLACE' : 'SAVE', async (b) => {
          b.disabled = true;
          try {
            await brain.setKey(k.name, input.value.trim());
            input.value = '';
            st.textContent = 'saved ✓';
            toast(`${k.label.split(' (')[0]} key saved`, 'ok');
            setTimeout(() => void load(), 1500);
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
        const link = h('a.lnk', { href: k.link, target: '_blank', rel: 'noopener' }, 'GET KEY ↗');
        kp.body.append(h('div.keyblock', h('div.row', h('span.lab', k.label), h('span.sp'), link), h('div.keyrow', input, save, remove), st));
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

    const paintStatus = () => {
      clear(sp.body);
      sp.body.append(
        row('BRAIN', status ? 'CONNECTED' : 'UNREACHABLE', null, { tone: status ? 'up' : 'dn' }),
        row('OWNER', status?.owner ?? '—'),
        row('SELF-EDIT', status?.repoReady ? `ON · ${status.repo}` : 'OFF — needs GitHub token', null, { tone: status?.repoReady ? 'up' : undefined }),
        row('PREVIEWS', status?.previews ?? 'unknown'),
        row('FRAME RATE', `${Math.round(stats.fps)} fps @ ${Math.round(stats.scale * 100)}%`),
        row('THIS DEVICE', ownerKey.get() ? 'paired with owner key' : 'signed in via Cloudflare Access'),
      );
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
      },
      describe: () => `System: ${P.big.textContent} · ${P.sub.textContent}`,
    };
  },
};
