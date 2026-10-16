/** SYSTEM tab: keys, AI models and connection status. (Theme, voice and home are in SETTINGS; email, Spotify and phone notifications in LINKS.) */
import type { BrainStatus, KeyStatus } from '../../../../../packages/shared/src/protocol';
import { brain, ownerKey, pauseEndsText } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { stats } from '../../engine/scheduler';
import { go, type TabDef } from '../../shell/tabs';
import { BUILD } from '../../state/build';
import { button, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';

export const systemTab: TabDef = {
  id: 'system',
  title: 'SYSTEM',
  icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
  scene: 'backdrop',
  blurb: 'AI keys · models · status',
  mount(root) {
    const P = page(root, { tag: 'SYSTEM CORE', rightLabel: 'STATUS', leftLabel: 'KEYS & MODELS', stack: true });
    const kp = panel('KEYS', { cls: 'scroll' });
    const mp = panel('AI MODELS', { footer: true, grow: false, cls: 'models' });
    P.left.append(kp.el, mp.el);
    const sp = panel('STATUS');
    P.right.append(sp.el);
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
        const input = h('input', { type: 'text', placeholder: k.set ? 'saved — paste a new one to replace' : `paste here (${k.hint})`, autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': `${k.label} key` });
        const st = h('small.note', '');
        const save = button(k.set ? 'REPLACE' : 'SAVE', async (b) => {
          const v = input.value.trim();
          if (!v) return void (st.textContent = 'Paste the key into the box first.');
          b.disabled = true;
          st.textContent = 'checking…';
          try {
            const r = await brain.setKey(k.name, v);
            input.value = '';
            // waiting: the database is paused — the key is in use now (memory, the mirror, this device) and written to the vault after the reset.
            const later = r.waiting ? ` · in use now, written to the vault after ${pauseEndsText()}` : '';
            st.textContent = r.works === false ? `saved, but ${r.info}${later}` : `saved · ${r.info ?? 'ok'}${later}`;
            st.className = `note ${r.works === false ? 'bad' : 'good'}`;
            toast(r.works === false ? `${k.label}: ${r.info}` : `${k.label} key works${r.waiting ? ' (kept while memory is paused)' : ''}`, r.works === false ? 'warn' : 'ok');
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
          h('div.row', h('span.lab', k.label), h('span.sp'), h(`small.chip${k.set ? '.good' : ''}` as 'small', k.set === null ? 'NOT KNOWN WHILE PAUSED' : k.set ? '✓ SAVED' : 'NOT SET')),
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
    // The database meter: how much of Cloudflare's free daily allowance is used, and by what
    // (the brain counts every row; see apps/edge/src/meter.ts). Past the allowance, memory pauses until midnight UTC.
    const meterRows = () => {
      const m = status?.meter;
      if (!m) return [];
      const pct = (n: number, of: number) => `${Math.min(999, Math.round((n / of) * 100))}%`;
      const resets = new Date(m.resetAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const top = m.by.slice(0, 3).map((b) => `${b.label} ${fmt.n(b.r)}r/${fmt.n(b.w)}w`).join(' · ');
      const tone = m.level >= 1 ? 'bad' : m.level > 0.7 ? 'dn' : 'up';
      return [
        row('DATABASE TODAY', `reads ${fmt.n(m.reads)} (${pct(m.reads, m.limits.reads)}) · writes ${fmt.n(m.writes)} (${pct(m.writes, m.limits.writes)})`, m.level >= 1 ? 'PAUSED' : m.level > 0.7 ? 'LOW' : 'OK', { tone }),
        row('ALLOWANCE RESETS', `${resets} (midnight UTC)${top ? ` · biggest: ${top}` : ''}`, null, { wrap: true }),
        ...(status?.waiting ? [row('KEYS WAITING', `${status.waiting} saved while memory was paused · in use now, written to the vault at ${resets}`, null, { wrap: true })] : []),
      ];
    };
    const paintStatus = () => {
      clear(sp.body);
      sp.body.append(
        row('BRAIN', status ? 'CONNECTED' : 'UNREACHABLE', null, { tone: status ? 'up' : 'dn' }),
        row('OWNER', status?.owner ?? '—'),
        row('SELF-EDIT', status?.repoReady ? `ON · ${status.repo}` : 'OFF — needs GitHub token', null, { tone: status?.repoReady ? 'up' : undefined }),
        row('PREVIEWS', status?.previews ?? 'unknown'),
        row('FRAME RATE', `${Math.round(stats.fps)} fps @ ${Math.round(stats.scale * 100)}%`),
        ...meterRows(),
        row('THIS DEVICE', ownerKey.get() ? 'paired with owner key' : 'signed in via Cloudflare Access'),
        row('VERSION', `${BUILD.sha.slice(0, 7)}${BUILD.at ? ` · built ${fmt.ago(Date.parse(BUILD.at))}` : ''}`, newer ? 'NEWER SHIPPED' : null, { tone: newer ? 'bad' : undefined }),
      );
      sp.body.append(h('div.keyrow', button('EMAIL · SPOTIFY · PHONE → LINKS', () => go('links'))));
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
