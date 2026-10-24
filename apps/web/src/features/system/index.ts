/** SYSTEM tab: keys, AI models, connection status, keeping data on the phone and its daily backup. (Theme, voice and home are in SETTINGS; email, Spotify and phone notifications in LINKS.) */
import type { BrainStatus, KeyStatus, ProviderRoom } from '../../../../../packages/shared/src/protocol';
import { brain, lastSeen, ownerKey, pauseEndsText } from '../../api/brain';
import { clear, fmt, h } from '../../core/dom';
import { stats } from '../../engine/scheduler';
import { go, type TabDef } from '../../shell/tabs';
import { BUILD } from '../../state/build';
import { button, confirmSheet, panel, row, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { loopsPanel } from './loops';
import { reportCardPanel } from './reportcard';
import { backupName, backUpNow, lastBackup, listBackups, phoneTrusted, restoreAndReload, sizeText, takeRestoreReport } from './backup';
import { checkStorage, storageLine, storageState } from './storage';
import { trainingPanel } from './training';
import { nightPanel } from './night';
import { statusDials } from '../../ui/statusdials';
import { speedCard } from './speed';

export const systemTab: TabDef = {
  id: 'system',
  title: 'SYSTEM',
  icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/>',
  scene: 'backdrop',
  blurb: 'AI keys · models · status',
  now() {
    const m = lastSeen.get().status?.meter;
    return m ? `Database ${Math.min(100, Math.round(Math.max(0, m.level) * 100))}% used today` : '';
  },
  mount(root) {
    const P = page(root, { tag: 'SYSTEM CORE', rightLabel: 'DATA', leftLabel: 'STATUS & KEYS', stack: true });
    // Status first (online, Ghosty connected, self-edit, this phone, version), then the brain's keys and models.
    const sp = panel('STATUS');
    const kp = panel('KEYS', { cls: 'scroll' });
    const mp = panel('AI MODELS', { footer: true, grow: false, cls: 'models' });
    const rp = panel('AI ROOM', { grow: false, cls: 'airoom' });
    // What the offline brain on this phone can do, measured here (reportcard.ts), and its weekly self-training (training.ts).
    const rc = reportCardPanel();
    // Every loop he practises in, on one card: what it practised, what improved, what was rejected (loops.ts).
    const lp = loopsPanel();
    const tp = trainingPanel();
    // NIGHT SCHOOL (night.ts): the phone works through the night, plugged in and open on Ghosty.
    const np = nightPanel();
    P.left.append(sp.el, kp.el, mp.el, rp.el, rc.el, lp.el, tp.el, np.el);
    const stp = panel('STORAGE', { grow: false });
    const bkp = panel('BACKUP & RESTORE', { grow: false });
    P.right.append(stp.el, bkp.el);
    let status: BrainStatus | null = null;

    let showOptional = false;
    const openHelp = new Set<string>();
    const paintKeys = () => {
      clear(kp.body);
      if (!status) {
        kp.body.append(h('div.note', 'Brain not reachable. Check the connection in STATUS.'));
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
        const attrs = { placeholder: k.set ? 'saved — paste a new one to replace' : `paste here (${k.hint})`, autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': `${k.label} key` };
        // A key pasted as several lines keeps its line breaks (a one-line box would run them together).
        const input = k.lines ? h('textarea.keylines', { ...attrs, rows: k.lines }) : h('input', { type: 'text', ...attrs });
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
        // A key is never shown again once saved, so a removal cannot be undone: said plainly first.
        const remove = k.set ? button('REMOVE', async () => {
          if (!(await confirmSheet(`Remove the ${k.label} key?`, `It is wiped from Ghosty, not kept anywhere: what needs it stops working until you paste the key again (${k.link.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]} shows it).`, 'REMOVE'))) return;
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
    // The free AI allowances right now (the brain's quota engine): room this minute, used today, when it resets.
    const paintRoom = () => {
      clear(rp.body);
      const cap = status?.capacity;
      if (!cap) {
        rp.setStatus('', 'off');
        if (status) rp.body.append(h('div.note', 'The brain does not count its free AI room yet: it needs an update first.'));
        return;
      }
      const ready = cap.providers.filter((x) => !x.smallOnly && (x.state === 'ready' || x.state === 'busy')).length;
      rp.setStatus(!cap.providers.length ? 'NONE' : !ready ? 'FULL' : /busy/i.test(cap.summary) ? 'BUSY' : 'PLENTY', !ready ? 'mid' : 'ok');
      rp.body.append(h('div.note.roomsum', cap.summary));
      const clock = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const STATE: Record<ProviderRoom['state'], string> = { ready: 'READY', busy: 'BUSY', full: 'FULL', out: 'OUT TODAY' };
      for (const p of cap.providers) {
        const now = p.roomNow === null ? 'no minute limit' : `room now ${p.roomNow} of ${p.perMinute} a minute`;
        const today = `used today ${fmt.n(p.usedToday)}${p.perDay ? ` of ${fmt.n(p.perDay)}` : ''}`;
        // Each model its own daily allowance: the best one's room, and how many are out (never one summed number).
        const best = p.dayLeft !== undefined ? `best model ${fmt.n(p.dayLeft)} left today` : '';
        const out = p.modelsOut ? `${p.modelsOut} of ${p.models} models out` : '';
        const reset = p.state === 'full' || p.state === 'out' ? (p.backAt ? `back ${clock(p.backAt)}` : '') : p.resetAt ? `resets ${clock(p.resetAt)}` : 'rolling day';
        // (A long row is cut at three lines on a phone: what matters most goes first.)
        const parts = [p.smallOnly ? 'small jobs only' : '', now, today, out, best, reset];
        const r = row(p.provider.toUpperCase(), parts.filter(Boolean).join(' · '), STATE[p.state], { tone: p.state === 'ready' ? 'up' : p.state === 'busy' ? undefined : 'dn', wrap: true });
        r.dataset.room = p.state;
        rp.body.append(r);
      }
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
    // route C: the three dials head the Status card (free AI today, the database today, the offline brain)
    const dials = statusDials();
    // SPEED (speed.ts) under the dials: how long Ghosty takes, from this phone's stopwatch and the brain's
    const speed = speedCard();
    const paintStatus = () => {
      clear(sp.body);
      sp.body.append(dials.el, speed.el);
      void dials.paint(status);
      speed.paint(status);
      // What the owner needs at a glance; the engineering details fold away under Advanced.
      const ver = `${BUILD.sha.slice(0, 7)}${BUILD.at ? ` · built ${fmt.ago(Date.parse(BUILD.at))}` : ''}`;
      sp.body.append(
        row('GHOSTY', status ? 'Connected' : 'Can’t be reached right now', null, { tone: status ? 'up' : 'dn' }),
        row('SELF-EDIT', status?.repoReady ? `On · ${status.repo}` : 'Off — add a GitHub key to turn it on', null, { tone: status?.repoReady ? 'up' : undefined, wrap: true }),
        row('THIS PHONE', ownerKey.get() ? 'Paired with your owner key' : 'Signed in with Cloudflare Access', null, { wrap: true }),
        row('VERSION', newer ? 'A newer version is ready' : 'Up to date', newer ? 'NEWER SHIPPED' : null, { tone: newer ? 'bad' : undefined }),
        h('details.adv', h('summary', 'Advanced'),
          row('OWNER', status?.owner ?? '—'),
          row('PREVIEWS', status?.previews ?? 'not reported'),
          row('FRAME RATE', `${Math.round(stats.fps)} fps @ ${Math.round(stats.scale * 100)}%`),
          ...meterRows(),
          row('BUILD', ver),
        ),
      );
      const linksBtn = button('EMAIL · SPOTIFY · PHONE → LINKS', () => go('links'));
      linksBtn.dataset.label = 'Email, Spotify and phone';
      sp.body.append(h('div.keyrow', linksBtn));
      if (newer) sp.body.append(button('RELOAD TO GET THE NEW VERSION', () => location.reload(), 'on'));
      if (ownerKey.get())
        sp.body.append(button('FORGET OWNER KEY ON THIS DEVICE', async () => {
          if (!(await confirmSheet('Forget the owner key here?', 'This phone stops being able to talk to Ghosty’s brain until you type the owner key again. Nothing on the brain changes.', 'FORGET IT'))) return;
          ownerKey.set('');
          location.reload();
        }, 'warn'));
    };

    // ---- keeping data on this phone (storage.ts)
    const paintStorage = () => {
      const line = storageLine();
      clear(stp.body);
      stp.setStatus(line.ok ? 'PROTECTED' : 'AT RISK', line.ok ? 'ok' : 'mid');
      stp.body.append(h(`div.note.storageline${line.ok ? '.good' : '.bad'}` as 'div', line.text));
      if (!line.ok) {
        stp.body.append(
          !storageState.get().supported ? '' : button('PROTECT', async (b) => {
            b.disabled = true;
            await checkStorage(true);
            b.disabled = false;
            if (!storageState.get().persisted) toast('iPhone said no. Add Ghosty to your Home Screen (Share → Add to Home Screen), open it from there, then press PROTECT again.', 'warn');
          }, 'on'),
          h('div.note', 'Without this, Safari deletes what Ghosty keeps on this phone after 7 days without use. Your daily backup (below) can bring it back.'),
        );
      }
    };
    storageState.subscribe(() => paintStorage());

    // ---- the daily backup (backup.ts): sealed on this phone, kept by the brain for 7 days
    // What the last restore put back, shown once after its reload.
    let restored = takeRestoreReport();
    let painting = 0;
    const paintBackup = async () => {
      const mine = ++painting;
      clear(bkp.body);
      const known = lastBackup.get();
      const last = known && known.at > 0 ? known : null;
      bkp.setStatus(!last ? 'NONE YET' : last.ok ? `LAST ${fmt.ago(last.at).toUpperCase()}` : 'LAST TRY FAILED', last?.ok ? 'ok' : 'mid');
      const msg = h('div.note.backupmsg', '');
      if (restored) {
        msg.textContent = restored;
        msg.className = 'note backupmsg good';
        restored = null;
      }
      bkp.body.append(
        h('div.note', 'Once a day Ghosty locks a copy of what lives only on this phone (courses, flashcards, plans, settings) with your owner key and keeps it in your brain. Only this phone can open it. Your chat, memory and agenda are kept by the brain itself.'),
        last ? row('LAST BACKUP', last.ok ? `${fmt.ago(last.at)}${last.size ? ` · ${sizeText(last.size)}` : ''}` : `failed ${fmt.ago(last.at)}: ${last.error ?? ''}`, null, { tone: last.ok ? 'up' : 'dn', wrap: true }) : '',
        h('div.keyrow', button('BACK UP NOW', async (b) => {
          // A phone with no backup record while the brain has copies may be a wiped one: ask first.
          if (!phoneTrusted() && ownerKey.get()) {
            const any = await listBackups().then((l) => l.length > 0).catch(() => false);
            if (any && !confirm('This phone has no backup record. Backing up now could replace a good copy from today with an empty phone. Restore first?\n\nCancel: stop here and pick a backup to RESTORE below.\nOK: back up this phone anyway.')) return;
          }
          b.disabled = true;
          msg.textContent = 'locking and sending…';
          msg.className = 'note backupmsg';
          try {
            const text = await backUpNow();
            toast(text, 'ok');
            void paintBackup();
          } catch (e) {
            msg.textContent = String((e as Error).message);
            msg.className = 'note backupmsg bad';
            b.disabled = false;
          }
        }, 'on')),
        msg,
      );
      if (!ownerKey.get()) return;
      try {
        const list = await listBackups();
        if (mine !== painting) return; // a newer paint has started: this one's list is stale
        bkp.body.append(h('div.lab', 'RESTORE FROM A BACKUP'));
        if (!list.length) bkp.body.append(h('div.note', 'No backups yet.'));
        else if (!phoneTrusted()) bkp.body.append(h('div.note.bad.wiped', 'This phone has no record of backing up, but your brain has backups. If Safari cleared Ghosty (or this is a new phone), RESTORE the newest one first. The daily backup waits until then, so it never puts an empty phone over your good copies.'));
        for (const b of list) {
          const day = new Date(b.at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
          const time = new Date(b.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
          const name = backupName(b);
          const r = row(day, `${name} · ${time} · ${sizeText(b.size)}`, null, { wrap: true });
          r.dataset.backup = b.id;
          r.append(button('RESTORE', async (btn) => {
            if (!confirm(`Restore the backup from ${day} (${name})?\n\nIt is joined with what is on this phone now: where both have the same thing, the newer one wins. Nothing here is deleted. Ghosty reloads straight after.`)) return;
            btn.disabled = true;
            msg.textContent = 'opening the backup…';
            msg.className = 'note backupmsg';
            try {
              msg.textContent = `${await restoreAndReload(b)} Reloading…`;
              msg.className = 'note backupmsg good';
            } catch (e) {
              msg.textContent = String((e as Error).message);
              msg.className = 'note backupmsg bad';
              btn.disabled = false;
            }
          }));
          bkp.body.append(r);
        }
      } catch (e) {
        if (mine !== painting) return;
        const st = (e as { status?: number }).status;
        bkp.body.append(h('div.note', st === 404 ? 'The brain cannot keep backups yet: it needs an update first.' : st === 501 ? String((e as Error).message) : 'The list of backups needs the brain; it is not reachable right now.'));
      }
    };

    const load = async () => {
      void checkStorage(false).then(paintStorage);
      void paintBackup();
      try {
        status = await brain.status();
        P.big.textContent = status.models.some((m) => m.state === 'ok') ? 'ONLINE' : 'NO MODELS';
        const nm = status.models.filter((m) => m.state === 'ok').length;
        const nk = status.keys.filter((k) => k.set).length;
        P.sub.textContent = `${nm ? `${nm} model${nm === 1 ? '' : 's'} ready` : 'No model ready yet'} · ${nk ? `${nk} key${nk === 1 ? '' : 's'} added` : 'no keys added yet'}`;
      } catch {
        status = null;
        P.big.textContent = 'OFFLINE';
      }
      paintKeys();
      paintModels();
      paintRoom();
      paintStatus();
    };
    return {
      enter() {
        void load();
        void checkVersion();
        tp.refresh();
        lp.refresh();
      },
      describe: () => `System: ${P.big.textContent} · ${P.sub.textContent}`,
    };
  },
};
