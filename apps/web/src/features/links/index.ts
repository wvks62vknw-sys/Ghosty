/**
 * LINKS tab: everything Ghosty is connected to, in one place — email, Spotify, Telegram, this
 * phone (app + notifications), live traffic (TomTom), GitHub (self-editing) and the AI brain.
 * Every secret goes straight into the brain's encrypted vault and is never shown again.
 */
import type { BrainStatus, EmailStatus, KeyStatus, SpotifyStatus, TelegramStatus } from '../../../../../packages/shared/src/protocol';
import { brain, pauseEndsText } from '../../api/brain';
import { canPromptInstall, disablePush, enablePush, installHelp, promptInstall, pushState } from '../../assistant/push';
import { redirectUri, savedClientId, startSpotifyLink } from '../../assistant/spotify';
import { clear, fmt, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { ui } from '../../state/app';
import { button, confirmSheet, panel, row, toast, undo } from '../../ui/components';
import { page } from '../../ui/page';
import { paintNotifications } from './notifications';
import { goToPanel } from '../../ui/sections';

const NOSPELL = { autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false' } as const;

interface Provider {
  label: string;
  /** Where to make an app password. */
  link?: string;
  steps: string[];
  /** Fixed servers (Google Workspace); 'ask' = the owner types them. */
  servers?: [string, string] | 'ask';
  blocked?: string;
}

const PROVIDERS: Record<string, Provider> = {
  gmail: {
    label: 'Gmail',
    link: 'https://myaccount.google.com/apppasswords',
    steps: ['Turn on 2-Step Verification (Google Account → Security) if it is not on yet.', 'Press GET APP PASSWORD, type any name (e.g. Ghosty) and press Create.', 'Copy the 16-letter password Google shows and paste it below. It is not your normal password, and deleting it cuts Ghosty off.'],
  },
  workspace: {
    label: 'Google Workspace (own domain)',
    link: 'https://myaccount.google.com/apppasswords',
    servers: ['imap.gmail.com', 'smtp.gmail.com'],
    steps: ['Your admin must allow app passwords and IMAP. Turn on 2-Step Verification.', 'Press GET APP PASSWORD, create one named Ghosty, and paste it below.'],
  },
  icloud: {
    label: 'iCloud Mail',
    link: 'https://account.apple.com/account/manage',
    steps: ['Sign in, open Sign-In and Security → App-Specific Passwords.', 'Create one named Ghosty and paste it below with your @icloud.com / @me.com address.'],
  },
  yahoo: {
    label: 'Yahoo Mail',
    link: 'https://login.yahoo.com/account/security/app-passwords',
    steps: ['Open the link, choose "Generate app password", name it Ghosty.', 'Paste the password below.'],
  },
  aol: {
    label: 'AOL Mail',
    link: 'https://login.aol.com/account/security/app-passwords',
    steps: ['Open the link, choose "Generate app password", name it Ghosty.', 'Paste the password below.'],
  },
  fastmail: {
    label: 'Fastmail',
    link: 'https://app.fastmail.com/settings/security/apps',
    steps: ['Open Settings → Privacy & Security → App passwords → New app password (access: IMAP and SMTP).', 'Paste the password below.'],
  },
  other: {
    label: 'Other (IMAP / SMTP)',
    servers: 'ask',
    steps: ["Find your provider's IMAP and SMTP server names in its help pages (add :port if it is not 993 / 465).", 'Use an app password if your provider offers them.'],
  },
  outlook: {
    label: 'Outlook / Hotmail / Live',
    steps: [],
    blocked: 'Microsoft no longer lets apps sign in to Outlook.com mail with a password, so it cannot be linked. Forward your mail to a Gmail or iCloud address and link that instead.',
  },
};

export const linksTab: TabDef = {
  id: 'links',
  title: 'LINKS',
  icon: '<path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1"/><path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1"/>',
  scene: 'backdrop',
  blurb: 'email · spotify · telegram · phone · traffic · github · AI',
  mount(root) {
    const P = page(root, { tag: 'LINKS // CONNECTED SYSTEMS', sub: 'everything Ghosty is plugged into', leftLabel: 'EMAIL & MUSIC', rightLabel: 'PHONE & BRAIN', stack: true });
    const ep = panel('EMAIL', { grow: false });
    const spot = panel('SPOTIFY', { grow: false });
    const tg = panel('TELEGRAM', { grow: false });
    const ap = panel('PHONE · APP & NOTIFICATIONS', { grow: false });
    const np = panel('NOTIFICATIONS', { grow: false });
    const bp = panel('AI BRAIN', { grow: false });
    const gp = panel('GITHUB · SELF-EDIT', { grow: false });
    const tp = panel('LIVE TRAFFIC · TOMTOM', { grow: false });
    P.left.append(ep.el, spot.el, tg.el);
    P.right.append(ap.el, np.el, tp.el, bp.el, gp.el);

    const online = { email: false, spotify: false, telegram: false, phone: false, traffic: false, brain: false, github: false };
    const paintHero = () => {
      const n = Object.values(online).filter(Boolean).length;
      P.big.textContent = `${n} / 7 ONLINE`;
      P.dials(([['EMAIL', online.email], ['MUSIC', online.spotify], ['TELEGRAM', online.telegram], ['PHONE', online.phone], ['TRAFFIC', online.traffic], ['AI', online.brain], ['GITHUB', online.github]] as [string, boolean][]).map(([l, on]) => [l, on ? 1 : 0.04, on ? 'ON' : 'OFF', on ? '#52f2b5' : '#ff9a3c']));
    };

    // ---- email
    let editing = false;
    const paintEmail = async () => {
      let st: EmailStatus | null = null;
      try {
        st = await brain.emailStatus();
      } catch {
        /* offline */
      }
      online.email = !!st?.linked && !st.problem;
      paintHero();
      clear(ep.body);
      ep.setStatus(st?.linked ? (st.problem ? 'CHECK' : 'LINKED') : st?.unknown ? 'NOT KNOWN WHILE PAUSED' : st ? 'NOT LINKED' : 'OFFLINE', st?.linked && !st.problem ? 'ok' : 'mid');
      if (st?.linked && !editing) {
        ep.body.append(
          row('ACCOUNT', st.address ?? 'linked'),
          st.server ? row('SERVER', st.server) : '',
          st.problem ? h('div.note.bad', st.problem) : h('div.note', 'Ask Ghosty "any new email?", "read the one from Sam", or "email Sam that I\'m running late" — sending always waits for your OK.'),
          h('div.keyrow', button('CHANGE ACCOUNT', () => {
            editing = true;
            void paintEmail();
          }), button('UNLINK', async () => {
            // The app password is not kept on this phone, so this cannot be undone: said plainly first.
            if (!(await confirmSheet('Unlink your email?', `Ghosty stops reading and sending email as ${st.address ?? 'this account'}. The app password is wiped, not kept anywhere: to link it again you paste a new one.`, 'UNLINK'))) return;
            await brain.setKey('email', '').catch(() => undefined);
            toast('Email unlinked', 'ok');
            void paintEmail();
          }, 'warn')),
        );
        return;
      }
      const prov = h('select', { 'aria-label': 'Email provider' }, ...Object.entries(PROVIDERS).map(([k, p]) => h('option', { value: k }, p.label)));
      const addr = h('input', { type: 'email', placeholder: 'you@gmail.com', ...NOSPELL, 'aria-label': 'Email address' });
      const pw = h('input', { type: 'password', placeholder: 'app password', autocomplete: 'new-password', 'aria-label': 'App password' });
      const imap = h('input', { placeholder: 'IMAP server, e.g. imap.domain.com', ...NOSPELL, 'aria-label': 'IMAP server' });
      const smtp = h('input', { placeholder: 'SMTP server, e.g. smtp.domain.com', ...NOSPELL, 'aria-label': 'SMTP server' });
      const servers = h('div.stackf', imap, smtp);
      const steps = h('ol.steps');
      const help = h('div.keyrow');
      const blocked = h('div.note.bad');
      const msg = h('small.note', '');
      const save = button('LINK EMAIL', async (b) => {
        const p = PROVIDERS[prov.value]!;
        const a = addr.value.trim();
        const pass = pw.value.replace(/\s+/g, '');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(a)) return void (msg.textContent = 'Type your full email address.');
        if (!pass) return void (msg.textContent = 'Paste the app password.');
        const hosts = p.servers === 'ask' ? [imap.value.trim(), smtp.value.trim()] : p.servers ?? [];
        if (p.servers === 'ask' && (!hosts[0] || !hosts[1])) return void (msg.textContent = 'Type both server names.');
        b.disabled = true;
        msg.className = 'note';
        msg.textContent = 'signing in to check it…';
        try {
          const r = await brain.setKey('email', [a, pass, ...hosts].join(' '));
          if (r.works === false) {
            msg.textContent = `Saved, but it did not work: ${r.info}`;
            msg.className = 'note bad';
          } else {
            toast('Email linked', 'ok');
            editing = false;
            void paintEmail();
          }
        } catch (e) {
          msg.textContent = String((e as Error).message);
          msg.className = 'note bad';
        } finally {
          b.disabled = false;
        }
      }, 'on');
      const pick = () => {
        const p = PROVIDERS[prov.value]!;
        clear(steps, ...p.steps.map((s) => h('li', s)));
        clear(help, p.link ? h('a.lnk', { href: p.link, target: '_blank', rel: 'noopener' }, 'GET APP PASSWORD ↗') : '');
        servers.hidden = p.servers !== 'ask';
        blocked.textContent = p.blocked ?? '';
        blocked.hidden = !p.blocked;
        for (const el of [addr, pw, save]) el.disabled = !!p.blocked;
      };
      prov.addEventListener('change', pick);
      addr.addEventListener('change', () => {
        const d = addr.value.split('@')[1]?.toLowerCase() ?? '';
        const guess = /^(gmail|googlemail)\.com$/.test(d) ? 'gmail' : /^(icloud|me|mac)\.com$/.test(d) ? 'icloud' : /^yahoo\./.test(d) ? 'yahoo' : /^aol\./.test(d) ? 'aol' : /fastmail/.test(d) ? 'fastmail' : /^(outlook|hotmail|live|msn)\./.test(d) ? 'outlook' : '';
        if (guess && guess !== prov.value) {
          prov.value = guess;
          pick();
        }
      });
      pw.addEventListener('keydown', (e) => e.key === 'Enter' && save.click());
      pick();
      ep.body.append(
        h('div.note', 'Link your inbox so Ghosty can check, search and read your email, and draft or send replies (every send waits for your OK).'),
        h('div.lab', 'PROVIDER'),
        prov,
        steps,
        help,
        blocked,
        h('div.lab', 'ACCOUNT'),
        addr,
        pw,
        servers,
        h('div.keyrow', save, st?.linked ? button('CANCEL', () => {
          editing = false;
          void paintEmail();
        }) : ''),
        msg,
      );
    };

    // ---- Spotify: the owner links their own account (PKCE). The brain makes every Spotify call.
    const paintSpotify = async () => {
      let st: SpotifyStatus | null = null;
      try {
        st = await brain.spotifyStatus();
      } catch {
        /* offline */
      }
      online.spotify = !!st?.linked;
      paintHero();
      clear(spot.body);
      spot.setStatus(st?.linked ? 'LINKED' : st?.unknown ? 'NOT KNOWN WHILE PAUSED' : st ? 'NOT LINKED' : 'OFFLINE', st?.linked ? 'ok' : 'mid');
      if (st?.linked) {
        spot.body.append(
          row('ACCOUNT', st.name ?? 'Spotify user', (st.product ?? '').toUpperCase() || null, { tone: st.product === 'premium' ? 'up' : undefined }),
          h('div.note', st.product && st.product !== 'premium'
            ? 'Linked. Ghosty can see what is playing and your playlists; controlling playback (play, pause, skip, volume) needs Spotify Premium.'
            : 'Linked. Ask Ghosty "what\'s playing?", "play some jazz on Spotify", "skip", "turn it down".'),
          h('div.keyrow', button('UNLINK', async () => {
            if (!(await confirmSheet('Unlink Spotify?', 'Ghosty stops seeing and playing your Spotify. To link it again you go through Spotify’s sign-in once more.', 'UNLINK'))) return;
            await brain.spotifyUnlink().catch(() => undefined);
            toast('Spotify unlinked', 'ok');
            void paintSpotify();
          }, 'warn')),
        );
        return;
      }
      const uri = redirectUri();
      const idIn = h('input', { type: 'text', value: st?.clientId ?? savedClientId.get(), placeholder: "paste your app's Client ID", ...NOSPELL, 'aria-label': 'Spotify Client ID' });
      const msg = h('small.note', '');
      spot.body.append(
        h('div.note', 'Link your Spotify account so Ghosty can show what is playing and control it by voice or chat. No computer needed: every step works in Safari on the phone (if Ghosty is on the home screen, open ghosty in Safari for the linking step so Spotify can send you back).'),
        h(
          'ol.steps',
          h('li', 'Open ', h('a.lnk', { href: 'https://developer.spotify.com/dashboard', target: '_blank', rel: 'noopener' }, 'SPOTIFY DASHBOARD ↗'), ' and press Create app (any name and description).'),
          h('li', 'Under Redirect URIs add exactly the address below (press COPY), tick "Web API", and save.'),
          h('li', "Open the app's Settings, copy the Client ID and paste it here."),
          h('li', 'Press LINK SPOTIFY and allow access. You come straight back here.'),
        ),
        h('div.lab', 'REDIRECT URI'),
        h('div.keyrow', h('input', { type: 'text', value: uri, readOnly: true, 'aria-label': 'Redirect URI to copy' }), button('COPY', async () => {
          try {
            await navigator.clipboard.writeText(uri);
            toast('Redirect URI copied', 'ok');
          } catch {
            toast(`Copy this: ${uri}`, 'warn');
          }
        })),
        h('div.lab', 'CLIENT ID'),
        h('div.keyrow', idIn, button('LINK SPOTIFY', async (b) => {
          b.disabled = true;
          try {
            await startSpotifyLink(idIn.value);
          } catch (e) {
            msg.textContent = String((e as Error).message);
            msg.className = 'note bad';
            b.disabled = false;
          }
        }, 'on')),
        msg,
      );
    };

    // ---- Telegram: the bot token lives in SYSTEM → KEYS; here the pairing and what is paired.
    let codeTimer = 0;
    const paintTelegram = async () => {
      let st: TelegramStatus | null = null;
      try {
        st = await brain.telegramStatus();
      } catch {
        /* offline */
      }
      // The answer came after the owner left: nothing to paint, and no countdown ticking on a hidden panel.
      if (ui.get().tab !== 'links') return;
      online.telegram = !!st?.paired;
      paintHero();
      clearInterval(codeTimer);
      clear(tg.body);
      tg.setStatus(st?.paired ? `PAIRED · @${st.bot}` : st?.linked ? 'WAITING FOR PAIRING' : st?.unknown ? 'NOT KNOWN WHILE PAUSED' : st ? 'NOT CONNECTED' : 'OFFLINE', st?.paired ? 'ok' : 'mid');
      if (!st) return void tg.body.append(h('div.note', 'The brain is not reachable right now.'));
      if (st.unknown) return void tg.body.append(h('div.note', "The brain cannot read its Telegram link while its database is paused. If a chat was paired, it still works."));
      if (!st.linked) {
        tg.body.append(
          h('div.note', st.token
            ? 'The bot token is saved, but the bot is not connected yet (Ghosty could not reach Telegram, or has no https address). Open SYSTEM → KEYS → Telegram bot and press SAVE again.'
            : 'Talk to Ghosty from the Telegram app — text, voice notes and photos — and get its reminders and task results there. Paste the bot token in SYSTEM → KEYS → Telegram bot (HOW TO GET IT shows the two-minute setup).'),
          h('div.keyrow', button('SYSTEM → KEYS', () => goToPanel('system', 'KEYS'), 'on')),
        );
        return;
      }
      const newCode = button('NEW CODE', async (b) => {
        b.disabled = true;
        try {
          await brain.telegramCode();
        } catch (e) {
          toast(String((e as Error).message), 'warn');
        }
        void paintTelegram();
      });
      if (!st.paired) {
        const code = h('div.tgcode', st.code ?? '······');
        const left = h('small.note', '');
        const tick = () => {
          const ms = (st!.codeUntil ?? 0) - Date.now();
          const live = !!st!.code && ms > 0;
          left.textContent = live ? `valid for ${Math.max(1, Math.ceil(ms / 60_000))} min` : 'the code has expired — press NEW CODE';
          if (!live) code.textContent = '······';
        };
        tick();
        codeTimer = window.setInterval(tick, 5000);
        tg.body.append(
          row('BOT', `@${st.bot}`),
          h('div.note', `Open Telegram → @${st.bot} → press START → send it this code:`),
          code,
          left,
          h('div.keyrow', newCode, button('OPEN THE BOT ↗', () => void window.open(`https://t.me/${st!.bot}`, '_blank', 'noopener'))),
        );
        return;
      }
      tg.body.append(
        row('BOT', `@${st.bot}`, null, { tone: 'up' }),
        row('PAIRED WITH', st.name ?? 'you'),
        h('div.note', 'Message the bot in Telegram the way you talk to Ghosty here: text, a voice note or a photo. Reminders and finished tasks arrive there too.'),
        h('div.keyrow.wrapit', button('TEST', async (b) => {
          b.disabled = true;
          const r = await brain.telegramTest().catch((e: Error) => ({ sent: false, error: e.message }));
          toast(r.sent ? 'Sent to your Telegram' : `Could not send: ${r.error ?? 'unknown'}`, r.sent ? 'ok' : 'warn');
          b.disabled = false;
        }, 'on'), button('UNPAIR', async () => {
          if (!(await confirmSheet('Unpair Telegram?', 'Ghosty stops answering in your Telegram chat and sends nothing there. To pair again, send the bot a new code.', 'UNPAIR'))) return;
          await brain.telegramUnpair().catch(() => undefined);
          toast('Telegram unpaired', 'ok');
          void paintTelegram();
        }, 'warn')),
      );
    };

    // ---- this phone: install + push notifications
    /** Devices taken off with the UNDO bar still up. */
    const pushGoing = new Set<string>();
    const paintApp = async () => {
      const st = pushState.get();
      online.phone = st.status === 'on';
      paintHero();
      clear(ap.body);
      ap.setStatus(st.status === 'on' ? 'NOTIFYING' : st.installed ? 'APP' : 'OFF', st.status === 'on' ? 'ok' : 'mid');
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
        h('div.note', 'Ghosty sends reminders, finished tasks and anything you ask for ("ping my phone when the build is done").'),
      );
      try {
        const { devices } = await brain.pushDevices();
        if (devices.length) ap.body.append(h('div.lab', 'DEVICES THAT GET NOTIFICATIONS'));
        for (const d of devices) {
          if (pushGoing.has(d.id)) continue;
          const r = row(fmt.ago(d.at), d.label, '✕');
          const x = r.lastChild as HTMLElement;
          x.classList.add('del');
          x.title = 'Stop notifying this device';
          x.setAttribute('aria-label', `Stop notifying ${d.label}`);
          // Off the list with UNDO; the brain stops notifying it only when the bar goes (its subscription
          // lives on that device, so it could not be put back from here).
          x.addEventListener('click', () => {
            pushGoing.add(d.id);
            r.remove();
            undo(
              `No more notifications to ${d.label}`,
              () => {
                pushGoing.delete(d.id);
                void paintApp();
              },
              async () => {
                await brain.pushRemove(d.id).catch((e) => toast(`Could not remove it: ${(e as Error).message}`, 'bad'));
                pushGoing.delete(d.id);
                void paintApp();
              },
            );
          });
          ap.body.append(r);
        }
      } catch {
        /* offline */
      }
    };
    pushState.subscribe(() => {
      void paintApp();
      void paintNotifications(np);
    });

    // ---- AI brain + GitHub (from the brain's status)
    const keyForm = (k: KeyStatus, done: () => void) => {
      const input = h('input', { type: 'password', placeholder: k.set ? 'saved — paste a new one to replace' : `paste here (${k.hint})`, autocomplete: 'new-password', 'aria-label': `${k.label}` });
      const msg = h('small.note', '');
      const save = button(k.set ? 'REPLACE' : 'SAVE', async (b) => {
        const v = input.value.trim();
        if (!v) return void (msg.textContent = 'Paste it into the box first.');
        b.disabled = true;
        msg.textContent = 'checking…';
        try {
          const r = await brain.setKey(k.name, v);
          input.value = '';
          const later = r.waiting ? ` · in use now, written to the vault after ${pauseEndsText()}` : '';
          msg.textContent = r.works === false ? `saved, but ${r.info}${later}` : `saved · ${r.info ?? 'ok'}${later}`;
          msg.className = `note ${r.works === false ? 'bad' : 'good'}`;
          setTimeout(done, 1200);
        } catch (e) {
          msg.textContent = String((e as Error).message);
        } finally {
          b.disabled = false;
        }
      });
      return h('div.stackf', h('div.note', k.why), h('ol.steps', ...k.steps.map((s) => h('li', s))), h('div.keyrow', h('a.lnk', { href: k.link, target: '_blank', rel: 'noopener' }, 'OPEN SITE ↗')), h('div.keyrow', input, save), msg);
    };
    const paintBrain = async () => {
      let st: BrainStatus | null = null;
      try {
        st = await brain.status();
      } catch {
        /* offline */
      }
      clear(bp.body);
      clear(gp.body);
      clear(tp.body);
      if (!st) {
        online.brain = online.github = online.traffic = false;
        paintHero();
        bp.setStatus('OFFLINE', 'off');
        bp.body.append(h('div.note', 'The brain is not reachable right now.'));
        return;
      }
      const ready = st.models.filter((m) => m.state === 'ok');
      const missing = st.keys.filter((k) => k.need === 'needed' && !k.set);
      online.brain = ready.length > 0;
      online.github = st.repoReady;
      const tt = st.keys.find((k) => k.name === 'tomtom');
      online.traffic = !!tt?.set;
      paintHero();
      bp.setStatus(ready.length ? `${ready.length} MODELS READY` : 'NO MODELS', ready.length ? 'ok' : 'off');
      bp.body.append(
        row('MODELS', `${ready.length} ready of ${st.models.length}`, null, { tone: ready.length ? 'up' : 'dn' }),
        row('KEYS', `${st.keys.filter((k) => k.set).length} saved${missing.length ? ` · ${missing.length} needed` : ''}`, null, { tone: missing.length ? 'bad' : 'up' }),
        st.lastModel ? row('LAST', st.lastModel) : '',
        h('div.note', ready.length ? 'Free AI keys power Ghosty’s thinking; when one runs out, the next takes over. The library answers even with none.' : 'Add a free AI key (Gemini or Groq) so Ghosty can think. It takes about a minute.'),
        h('div.note', 'Backup: save your AI keys as Cloudflare secrets too (GEMINI_KEY, GROQ_KEY… — SETUP.md "Keep Ghosty working when the database is paused") and Ghosty keeps chatting even if the free daily database allowance runs out.'),
        h('div.keyrow', button('MANAGE AI KEYS', () => goToPanel('system', 'KEYS'), missing.length ? 'on' : '')),
      );
      gp.setStatus(st.repoReady ? 'ON' : 'OFF', st.repoReady ? 'ok' : 'mid');
      const gh = st.keys.find((k) => k.name === 'github');
      if (st.repoReady) gp.body.append(row('REPO', st.repo ?? '—', null, { tone: 'up' }), h('div.note', 'Ghosty can read its own code and propose, preview and ship changes to itself (Workshop).'), h('div.keyrow', button('OPEN WORKSHOP', () => go('workshop'))));
      else if (gh) gp.body.append(keyForm(gh, () => void paintBrain()));
      tp.setStatus(tt?.set ? 'LIVE' : 'OFF', tt?.set ? 'ok' : 'mid');
      if (tt?.set) tp.body.append(h('div.note', 'Live speeds on every road in God\'s Eye (green flowing → red jammed), plus crashes, closures and queues when you ask — e.g. "how\'s the traffic in Birmingham city centre?"'), h('div.keyrow', button('SHOW ON GOD\'S EYE', () => go('eye')), button('REPLACE KEY', () => clear(tp.body, keyForm(tt, () => void paintBrain())))));
      else if (tt) tp.body.append(keyForm(tt, () => void paintBrain()));
    };

    return {
      enter() {
        void paintEmail();
        void paintSpotify();
        void paintTelegram();
        void paintApp();
        void paintNotifications(np);
        void paintBrain();
      },
      leave() {
        clearInterval(codeTimer);
      },
      describe: () => `Links: ${Object.entries(online).map(([k, v]) => `${k} ${v ? 'on' : 'off'}`).join(', ')}.`,
    };
  },
};
