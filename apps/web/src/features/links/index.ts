/**
 * LINKS tab: everything Ghosty is connected to, in one place — email, Spotify, Telegram, this
 * phone (app + notifications), live traffic (TomTom), GitHub (self-editing) and the AI brain.
 * Every secret goes straight into the brain's encrypted vault and is never shown again.
 *
 * (FINAL ROUND) Every connection says where it stands the same way (words.ts stateTag): not linked, linked as …, linked but not
 * working (why, and the one next step), one step left, checking, not known while paused, or the brain out of reach (with TRY AGAIN).
 * The top line counts those very rows. A TEST key sits where the brain can check (Spotify, Telegram, this phone's notifications), and
 * what the last check said is kept on the phone (ghosty.links.checks), so a link whose check failed never shows as working.
 */
import type { BrainStatus, EmailStatus, KeyStatus, SpotifyStatus, TelegramStatus } from '../../../../../packages/shared/src/protocol';
import { brain, pauseEndsText } from '../../api/brain';
import { canPromptInstall, disablePush, enablePush, installHelp, promptInstall, pushState } from '../../assistant/push';
import { redirectUri, savedClientId, startSpotifyLink } from '../../assistant/spotify';
import { clear, fmt, h } from '../../core/dom';
import { go, type TabDef } from '../../shell/tabs';
import { screenSays } from '../../shell/awareness';
import { ui } from '../../state/app';
import { button, confirmSheet, panel, row, toast, undo, type Panel } from '../../ui/components';
import { page } from '../../ui/page';
import { paintNotifications } from './notifications';
import { TELEGRAM as TG, missedWords } from './words';
import { goToPanel, sectionNow, sections } from '../../ui/sections';
import { socialPanels } from './social'; // [social] his own accounts: BLUESKY, MASTODON, DISCORD, TELEGRAM CHANNEL (BRIEF-SOCIAL)
import { sayError } from '../../ui/hisWords';
import { NO_DEVICE, OFFLINE_LINE, PAUSED_LINE, checkLine, emailWhy, heroWords, modelsReady, sentTo, spotifyWhy, stateLight, stateTag, TELEGRAM_TEST_FAILED, type LinkCheck, type LinkState } from './words';

/** What the last TEST (or the check when he linked it) said, per connection: kept on the phone. */
const CHECKS = 'ghosty.links.checks';
function readChecks(): Record<string, LinkCheck> {
  try {
    const all = JSON.parse(localStorage.getItem(CHECKS) ?? '{}') as Record<string, LinkCheck> | null;
    return all && typeof all === 'object' ? all : {};
  } catch {
    return {};
  }
}
function keepCheck(id: string, c: LinkCheck | null): void {
  try {
    const all = readChecks();
    if (c) all[id] = c;
    else delete all[id];
    localStorage.setItem(CHECKS, JSON.stringify(all));
  } catch {
    /* the phone would not keep it: the line is right until the page closes */
  }
}
/** The last check of `id`, if it was about the account linked now (`who`). */
function checkOf(id: string, who?: string | null): LinkCheck | null {
  const c = readChecks()[id];
  return c && typeof c.ok === 'boolean' && (!who || !c.who || c.who === who) ? c : null;
}
/** The quiet line under a connection: when it was last tested, and what that said. */
const checkNote = (c: LinkCheck | null) => (c ? h('small.note.lkcheck', checkLine(c)) : '');


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
    tg.body.classList.add('tgbody');
    const ap = panel('PHONE · APP & NOTIFICATIONS', { grow: false });
    const np = panel('NOTIFICATIONS', { grow: false });
    const bp = panel('AI BRAIN', { grow: false });
    const gp = panel('GITHUB · SELF-EDIT', { grow: false });
    const tp = panel('LIVE TRAFFIC · TOMTOM', { grow: false });
    // [restd] his own Home Assistant box: the steps, or the house in a line (house/links.ts)
    const hp = panel('HOME ASSISTANT', { grow: false, cls: 'housepn' });
    const social = socialPanels();
    P.left.append(ep.el, spot.el, tg.el, ...social.panels.map((x) => x.el));
    P.right.append(ap.el, np.el, tp.el, bp.el, gp.el, hp.el);
    // Sections (ui/sections.ts): a pill for each of the list's groups: his accounts (email, music, Telegram), this phone
    // (the app and its notifications) and the services behind Ghosty (traffic, the AI brain, GitHub).
    sections(root, 'links', [
      { id: 'accounts', label: 'Accounts', match: /^(EMAIL|SPOTIFY|TELEGRAM(?! CHANNEL))/ },
      // [social] the accounts he made for me, each posting only with his APPROVE (features/links/social.ts)
      { id: 'social', label: 'Social', match: /^(BLUESKY|MASTODON|DISCORD|TELEGRAM CHANNEL)/ },
      { id: 'phone', label: 'This phone', match: /^(PHONE|NOTIFICATIONS)/ },
      { id: 'services', label: 'Services', match: /^(LIVE|AI|GITHUB|HOME ASSISTANT)/ },
    ]);

    // Each connection's state, as its panel says it: the top line counts these very rows (never a count of its own).
    const NAMES = { email: 'EMAIL', spotify: 'MUSIC', telegram: 'TELEGRAM', phone: 'PHONE', traffic: 'TRAFFIC', brain: 'AI', github: 'GITHUB' } as const;
    type Id = keyof typeof NAMES;
    const state: Record<Id, LinkState> = { email: 'checking', spotify: 'checking', telegram: 'checking', phone: 'checking', traffic: 'checking', brain: 'checking', github: 'checking' };
    const said: Record<Id, string> = { email: '', spotify: '', telegram: '', phone: '', traffic: '', brain: '', github: '' };
    const paintHero = () => {
      const w = heroWords((Object.keys(state) as Id[]).map((id) => ({ id, state: state[id] })));
      /* state: links.connections empty */
      P.big.textContent = w.big;
      P.sub.textContent = w.sub;
      P.dials((Object.keys(NAMES) as Id[]).map((id) => {
        const s = state[id];
        return [NAMES[id], s === 'linked' ? 1 : s === 'failing' ? 0.5 : 0.04, s === 'linked' ? 'ON' : s === 'failing' ? 'FIX' : 'OFF', s === 'linked' ? 'var(--c)' : s === 'failing' || s === 'offline' ? 'var(--r)' : 'var(--a)'];
      }));
    };
    /** One connection's state: its panel's line and light, and the top line. `tag` is said in place of the plain words when given. */
    const setState = (p: Panel, id: Id, s: LinkState, who?: string | null, tag?: string) => {
      state[id] = s;
      said[id] = tag ?? stateTag(s, who);
      p.setStatus(said[id], stateLight(s));
      paintHero();
    };
    /** The brain could not be reached, or its database is paused: said in the panel, with TRY AGAIN (never the link form, as if not linked). */
    const unknownBody = (p: Panel, id: Id, s: 'offline' | 'paused', what: string, again: () => void, line?: string) => {
      setState(p, id, s);
      clear(p.body, h('div.note', line ?? (s === 'offline' ? OFFLINE_LINE(what) : PAUSED_LINE(what))), h('div.keyrow', button('TRY AGAIN', again, 'on')));
    };

    // ---- email
    let editing = false;
    const paintEmail = async () => {
      /* state: links.connections loading */
      if (state.email === 'checking') setState(ep, 'email', 'checking');
      let st: EmailStatus | null = null;
      try {
        st = await brain.emailStatus();
      } catch {
        st = null;
      }
      /* state: links.connections offline */
      if (!st) return unknownBody(ep, 'email', 'offline', 'your email', () => void paintEmail());
      if (st.unknown) return unknownBody(ep, 'email', 'paused', 'email', () => void paintEmail());
      clear(ep.body);
      if (st.linked && !editing) {
        // A link whose saved details cannot be used, or whose check (when he linked it) failed, is never said as working.
        const c = checkOf('email', st.address);
        const bad = st.problem ? emailWhy(st.problem) : c && !c.ok ? (c.why ?? emailWhy()) : '';
        /* state: links.connections error */
        setState(ep, 'email', bad ? 'failing' : 'linked', st.address);
        ep.body.append(
          row('ACCOUNT', st.address ?? 'linked'),
          st.server ? row('SERVER', st.server) : '',
          bad ? h('div.note.bad.lkwhy', bad) : h('div.note', 'Ask Ghosty "any new email?", "read the one from Sam", or "email Sam that I\'m running late" — sending always waits for your OK.'),
          st.problem ? '' : checkNote(c),
          h('div.keyrow.wrapit', button('CHANGE ACCOUNT', () => {
            editing = true;
            void paintEmail();
          }, bad ? 'on' : ''), button('UNLINK', async () => {
            // The app password is not kept on this phone, so this cannot be undone: said plainly first.
            if (!(await confirmSheet('Unlink your email?', `Ghosty stops reading and sending email as ${st.address ?? 'this account'}. The app password is wiped, not kept anywhere: to link it again you paste a new one.`, 'UNLINK'))) return;
            // (a failed unlink says so: never "unlinked" while it is still linked)
            try {
              await brain.setKey('email', '');
              keepCheck('email', null);
              toast('Email unlinked', 'ok');
            } catch (e) {
              toast(sayError(e, 'unlink your email: it is still linked'), 'bad');
            }
            void paintEmail();
          }, 'warn')),
        );
        return;
      }
      setState(ep, 'email', st.linked ? state.email : 'not', st.address, st.linked ? said.email : undefined);
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
        msg.textContent = 'Signing in to check it…';
        try {
          const r = await brain.setKey('email', [a, pass, ...hosts].join(' '));
          // The brain keeps what was pasted even when the check fails: the panel then says it is linked but not working, and why.
          keepCheck('email', r.works === false ? { ok: false, at: Date.now(), who: a, why: emailWhy(r.info) } : { ok: true, at: Date.now(), who: a });
          toast(r.works === false ? 'Saved, but it does not work yet: the reason is in EMAIL.' : 'Email linked', r.works === false ? 'warn' : 'ok');
          editing = false;
          void paintEmail();
        } catch (e) {
          msg.textContent = sayError(e, 'link your email');
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
      if (state.spotify === 'checking') setState(spot, 'spotify', 'checking');
      let st: SpotifyStatus | null = null;
      try {
        st = await brain.spotifyStatus();
      } catch {
        st = null;
      }
      if (!st) return unknownBody(spot, 'spotify', 'offline', 'Spotify', () => void paintSpotify());
      if (st.unknown) return unknownBody(spot, 'spotify', 'paused', 'Spotify', () => void paintSpotify());
      clear(spot.body);
      if (st.linked) {
        const c = checkOf('spotify', st.name);
        const bad = c && !c.ok ? (c.why ?? spotifyWhy()) : '';
        setState(spot, 'spotify', bad ? 'failing' : 'linked', st.name);
        spot.body.append(
          row('ACCOUNT', st.name ?? 'Spotify user', (st.product ?? '').toUpperCase() || null, { tone: st.product === 'premium' ? 'up' : undefined }),
          bad ? h('div.note.bad.lkwhy', bad) : h('div.note', st.product && st.product !== 'premium'
            ? 'Linked. Ghosty can see what is playing and your playlists; controlling playback (play, pause, skip, volume) needs Spotify Premium.'
            : 'Linked. Ask Ghosty "what\'s playing?", "play some jazz on Spotify", "skip", "turn it down".'),
          checkNote(c),
          h('div.keyrow.wrapit', button('TEST', async (b) => {
            // One read of his own Spotify profile through the saved sign-in (the brain's /spotify/test): it works, or why not.
            b.disabled = true;
            spot.setStatus(stateTag('checking'), undefined);
            const r = await brain.spotifyTest().catch((e) => {
              toast(sayError(e, 'test Spotify'), 'warn');
              return null;
            });
            if (r) {
              keepCheck('spotify', { ok: r.works, at: Date.now(), who: st.name ?? undefined, ...(r.works ? {} : { why: spotifyWhy(r.why) }) });
              toast(r.works ? 'Spotify works: I can see your account.' : spotifyWhy(r.why), r.works ? 'ok' : 'warn');
            }
            b.disabled = false;
            void paintSpotify();
          }, 'on'), button('UNLINK', async () => {
            if (!(await confirmSheet('Unlink Spotify?', 'Ghosty stops seeing and playing your Spotify. To link it again you go through Spotify’s sign-in once more.', 'UNLINK'))) return;
            try {
              await brain.spotifyUnlink();
              keepCheck('spotify', null);
              toast('Spotify unlinked', 'ok');
            } catch (e) {
              toast(sayError(e, 'unlink Spotify: it is still linked'), 'bad');
            }
            void paintSpotify();
          }, 'warn')),
        );
        return;
      }
      setState(spot, 'spotify', 'not');
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
            toast('The phone would not copy it: press on the address above and copy it from there.', 'warn');
          }
        })),
        h('div.lab', 'CLIENT ID'),
        h('div.keyrow', idIn, button('LINK SPOTIFY', async (b) => {
          b.disabled = true;
          try {
            await startSpotifyLink(idIn.value);
          } catch (e) {
            msg.textContent = sayError(e, 'start the Spotify sign-in');
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
      if (state.telegram === 'checking') setState(tg, 'telegram', 'checking');
      let st: TelegramStatus | null = null;
      try {
        st = await brain.telegramStatus();
      } catch {
        st = null;
      }
      // The answer came after the owner left: nothing to paint, and no countdown ticking on a hidden panel.
      if (ui.get().tab !== 'links') return;
      clearInterval(codeTimer);
      if (!st) return unknownBody(tg, 'telegram', 'offline', 'Telegram', () => void paintTelegram(), TG.offline);
      if (st.unknown) return unknownBody(tg, 'telegram', 'paused', 'Telegram', () => void paintTelegram(), TG.paused);
      clear(tg.body);
      if (!st.linked) {
        // A key saved that could not connect the bot is linked but not working, with its one next step; no key is not linked.
        setState(tg, 'telegram', st.token ? 'failing' : 'not');
        tg.body.append(
          h(st.token ? 'div.note.bad.lkwhy' : 'div.note', st.token ? TG.keyNotConnected : TG.noKey),
          h('div.keyrow', button('SYSTEM → KEYS', () => goToPanel('system', 'KEYS'), 'on')),
        );
        return;
      }
      const newCode = button('NEW CODE', async (b) => {
        b.disabled = true;
        try {
          await brain.telegramCode();
        } catch (e) {
          toast(sayError(e, 'make a new code'), 'warn');
        }
        void paintTelegram();
      });
      if (!st.paired) {
        setState(tg, 'telegram', 'waiting', null, 'One step left: send the code');
        const code = h('div.tgcode', st.code ?? '······');
        const left = h('small.note', '');
        const tick = () => {
          const ms = (st!.codeUntil ?? 0) - Date.now();
          const live = !!st!.code && ms > 0;
          left.textContent = TG.left(ms, live);
          if (!live) code.textContent = '······';
        };
        tick();
        codeTimer = window.setInterval(tick, 5000);
        tg.body.append(
          row('BOT', `@${st.bot}`),
          h('div.note', TG.steps(st.bot ?? '')),
          code,
          left,
          h('div.keyrow', newCode, button('OPEN THE BOT ↗', () => void window.open(`https://t.me/${st!.bot}`, '_blank', 'noopener'))),
        );
        return;
      }
      // Paired: a TEST that failed, or messages that did not arrive, is linked but not working until a TEST gets through.
      const c = checkOf('telegram', st.bot);
      const bad = st.missed ? `${missedWords(st.missed)} Tap TEST to check it works now.` : c && !c.ok ? `${c.why ?? TELEGRAM_TEST_FAILED} Tap TEST to try again.` : '';
      setState(tg, 'telegram', bad ? 'failing' : 'linked', `@${st.bot}`);
      tg.body.append(
        row('BOT', `@${st.bot}`, null, { tone: bad ? undefined : 'up' }),
        row('PAIRED WITH', st.name ?? 'you'),
        bad ? h('div.note.bad.lkwhy.tgmissed', bad) : h('div.note', TG.pairedNote),
        checkNote(c),
        h('div.keyrow.wrapit', button('TEST', async (b) => {
          b.disabled = true;
          tg.setStatus(stateTag('checking'), undefined);
          const r = await brain.telegramTest().catch((e: Error) => ({ sent: false, error: sayError(e, 'send the test to your Telegram') }));
          keepCheck('telegram', { ok: r.sent, at: Date.now(), who: st!.bot ?? undefined, ...(r.sent ? {} : { why: r.error ?? TELEGRAM_TEST_FAILED }) });
          toast(r.sent ? TG.testSent : (r.error ?? TELEGRAM_TEST_FAILED), r.sent ? 'ok' : 'warn');
          void paintTelegram();
          b.disabled = false;
        }, 'on'), button('UNPAIR', async () => {
          if (!(await confirmSheet(TG.unpairTitle, TG.unpairBody, TG.unpairKey))) return;
          const gone = await brain.telegramUnpair().then(() => true, () => false);
          if (gone) keepCheck('telegram', null);
          toast(gone ? TG.unpaired : TG.unpairFailed, gone ? 'ok' : 'warn');
          void paintTelegram();
        }, 'warn')),
      );
    };

    // ---- this phone: install + push notifications
    /** Devices taken off with the UNDO bar still up. */
    const pushGoing = new Set<string>();
    const sendTest = async () => {
      // The brain out of reach is said as that, never as "no device has notifications on".
      const r = await brain.pushTest().catch((e) => {
        toast(sayError(e, 'send the test notification'), 'warn');
        return null;
      });
      if (r) toast(r.sent ? sentTo(r.sent) : NO_DEVICE, r.sent ? 'ok' : 'warn');
    };
    const paintApp = async () => {
      const st = pushState.get();
      const s: LinkState = st.status === 'on' ? 'linked' : st.status === 'blocked' ? 'failing' : st.status === 'needs-install' ? 'waiting' : st.status === 'unknown' ? 'checking' : 'not';
      setState(ap, 'phone', s, null, st.status === 'on' ? 'Notifications on' : st.status === 'blocked' ? 'Blocked by the browser' : st.status === 'needs-install' ? 'Add to Home Screen first' : st.status === 'unsupported' ? 'This browser can’t notify' : st.status === 'unknown' ? undefined : st.installed ? 'Installed · notifications off' : 'Notifications off');
      clear(ap.body);
      ap.body.append(
        h('div.note', st.installed ? 'Ghosty is installed as an app on this device.' : `Install Ghosty like an app: ${installHelp()}`),
        h(
          'div.keyrow.wrapit',
          canPromptInstall() && !st.installed ? button('INSTALL APP', async () => {
            await promptInstall();
            void paintApp();
          }) : '',
          st.status === 'on'
            ? button('TURN OFF HERE', async () => {
                if (!(await confirmSheet('Turn notifications off here?', 'This phone stops getting Ghosty’s notifications. Your other devices keep theirs, and you can turn them on again here any time.', 'TURN OFF'))) return;
                await disablePush();
                toast('Notifications are off on this phone.', 'ok');
                void paintApp();
              }, 'warn')
            : st.status === 'unsupported' ? '' : button('TURN ON NOTIFICATIONS', async () => {
                toast(await enablePush(), pushState.get().status === 'on' ? 'ok' : 'warn');
                void paintApp();
              }, 'on'),
          button('SEND TEST', () => void sendTest()),
        ),
        st.status === 'blocked' ? h('div.note.bad.lkwhy', "Notifications are blocked for this site. Allow them in the browser's site settings (padlock icon), then press TURN ON.") : '',
        st.status === 'needs-install' ? h('div.note.bad.lkwhy', 'On iPhone, notifications only work after "Add to Home Screen". Open Ghosty from the home-screen icon and turn them on there.') : '',
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
                await brain.pushRemove(d.id).catch((e) => toast(sayError(e, `stop notifying ${d.label}: it still gets them`), 'bad'));
                pushGoing.delete(d.id);
                void paintApp();
              },
            );
          });
          ap.body.append(r);
        }
      } catch {
        // (the devices are the brain's to list: out of reach, the panel says so in a line, and the rest of it still works here)
        ap.body.append(h('small.note', 'I can’t reach my brain to list the devices that get notifications. They show here when it answers.'));
      }
    };
    pushState.subscribe(() => {
      void paintApp();
      void paintNotifications(np);
    });

    // ---- AI brain + GitHub (from the brain's status)
    /** What a key's check says, kept as the connection's last check (GitHub → github, TomTom → traffic). */
    const KEY_ID: Record<string, Id> = { github: 'github', tomtom: 'traffic' };
    const keyForm = (k: KeyStatus, done: () => void) => {
      const input = h('input', { type: 'password', placeholder: k.set ? 'saved — paste a new one to replace' : `paste here (${k.hint})`, autocomplete: 'new-password', 'aria-label': `${k.label}` });
      const msg = h('small.note', '');
      const save = button(k.set ? 'REPLACE' : 'SAVE', async (b) => {
        const v = input.value.trim();
        if (!v) return void (msg.textContent = 'Paste it into the box first.');
        b.disabled = true;
        msg.textContent = 'Checking it…';
        try {
          const r = await brain.setKey(k.name, v);
          input.value = '';
          const later = r.waiting ? ` · in use now, written to the vault after ${pauseEndsText()}` : '';
          msg.textContent = r.works === false ? `Saved, but it doesn’t work: ${r.info}${later}` : `Saved · ${r.info ?? 'it works'}${later}`;
          msg.className = `note ${r.works === false ? 'bad' : 'good'}`;
          const id = KEY_ID[k.name];
          if (id) keepCheck(id, r.works === false ? { ok: false, at: Date.now(), why: `The key didn’t work: ${r.info ?? 'paste it again'}.` } : { ok: true, at: Date.now() });
          setTimeout(done, 1200);
        } catch (e) {
          msg.textContent = sayError(e, `save the ${k.label} key`);
          msg.className = 'note bad';
        } finally {
          b.disabled = false;
        }
      });
      return h('div.stackf', h('div.note', k.why), h('ol.steps', ...k.steps.map((s) => h('li', s))), h('div.keyrow', h('a.lnk', { href: k.link, target: '_blank', rel: 'noopener' }, 'OPEN SITE ↗')), h('div.keyrow', input, save), msg);
    };
    const paintBrain = async () => {
      for (const [p, id] of [[bp, 'brain'], [gp, 'github'], [tp, 'traffic']] as [Panel, Id][]) if (state[id] === 'checking') setState(p, id, 'checking');
      let st: BrainStatus | null = null;
      try {
        st = await brain.status();
      } catch {
        st = null;
      }
      if (!st) {
        // Out of reach: each of the three says so with TRY AGAIN (never an empty panel, never "off" as if not set up).
        unknownBody(bp, 'brain', 'offline', 'the AI brain', () => void paintBrain(), 'I can’t reach my brain right now. The library on this phone still answers. Tap TRY AGAIN when you have a signal.');
        unknownBody(gp, 'github', 'offline', 'GitHub', () => void paintBrain());
        unknownBody(tp, 'traffic', 'offline', 'live traffic', () => void paintBrain());
        return;
      }
      clear(bp.body);
      clear(gp.body);
      clear(tp.body);
      const ready = st.models.filter((m) => m.state === 'ok');
      const missing = st.keys.filter((k) => k.need === 'needed' && !k.set);
      setState(bp, 'brain', ready.length ? 'linked' : 'failing', null, modelsReady(ready.length));
      bp.body.append(
        row('MODELS', `${ready.length} ready of ${st.models.length}`, null, { tone: ready.length ? 'up' : 'dn' }),
        row('KEYS', `${st.keys.filter((k) => k.set).length} saved${missing.length ? ` · ${missing.length} needed` : ''}`, null, { tone: missing.length ? 'bad' : 'up' }),
        st.lastModel ? row('LAST ANSWER BY', st.lastModel) : '',
        h(ready.length ? 'div.note' : 'div.note.bad.lkwhy', ready.length ? 'Free AI keys power Ghosty’s thinking; when one runs out, the next takes over. The library answers even with none.' : 'No AI key works right now, so I can only answer from the library. Add a free AI key (Gemini or Groq) under MANAGE AI KEYS: it takes about a minute.'),
        h('div.note', 'Backup: save your AI keys as Cloudflare secrets too (GEMINI_KEY, GROQ_KEY… — SETUP.md "Keep Ghosty working when the database is paused") and Ghosty keeps chatting even if the free daily database allowance runs out.'),
        h('div.keyrow', button('MANAGE AI KEYS', () => goToPanel('system', 'KEYS'), missing.length || !ready.length ? 'on' : '')),
      );
      const gh = st.keys.find((k) => k.name === 'github');
      if (st.repoReady) {
        setState(gp, 'github', 'linked', st.repo);
        gp.body.append(row('REPO', st.repo ?? '—', null, { tone: 'up' }), h('div.note', 'Ghosty can read its own code and propose, preview and ship changes to itself (Workshop).'), h('div.keyrow', button('OPEN WORKSHOP', () => go('workshop'))));
      } else if (gh?.set === null) unknownBody(gp, 'github', 'paused', 'GitHub', () => void paintBrain());
      else if (gh) {
        // A token saved that cannot edit the repository is linked but not working: the form to replace it is the one next step.
        setState(gp, 'github', gh.set ? 'failing' : 'not');
        gp.body.append(gh.set ? h('div.note.bad.lkwhy', checkOf('github')?.why ?? 'The GitHub token is saved, but it cannot edit my repository. Paste a token with "Contents: Read and write" below.') : '', keyForm(gh, () => void paintBrain()));
      } else {
        setState(gp, 'github', 'not');
        gp.body.append(h('div.note', 'Self-editing is not set up on this brain: it needs its repository named in its settings (SETUP.md, GITHUB_REPO).'));
      }
      const tt = st.keys.find((k) => k.name === 'tomtom');
      if (tt?.set === null) unknownBody(tp, 'traffic', 'paused', 'live traffic', () => void paintBrain());
      else if (tt?.set) {
        const c = checkOf('traffic');
        const bad = c && !c.ok ? (c.why ?? 'The key didn’t work.') : '';
        setState(tp, 'traffic', bad ? 'failing' : 'linked');
        tp.body.append(
          bad ? h('div.note.bad.lkwhy', `${bad} Tap REPLACE KEY and paste it again.`) : h('div.note', 'Live speeds on every road in God\'s Eye (green flowing → red jammed), plus crashes, closures and queues when you ask — e.g. "how\'s the traffic in Birmingham city centre?"'),
          checkNote(c),
          h('div.keyrow.wrapit', button('SHOW ON GOD\'S EYE', () => go('eye')), button('REPLACE KEY', () => clear(tp.body, keyForm(tt, () => void paintBrain())), bad ? 'on' : '')),
        );
      } else if (tt) {
        setState(tp, 'traffic', 'not');
        tp.body.append(keyForm(tt, () => void paintBrain()));
      } else {
        setState(tp, 'traffic', 'not');
        tp.body.append(h('div.note', 'Live traffic is not offered by this brain yet. Traffic in God’s Eye still works without it.'));
      }
    };

    return {
      enter() {
        void paintEmail();
        void paintSpotify();
        void paintTelegram();
        void paintApp();
        void paintNotifications(np);
        void paintBrain();
        void social.paint(); // [social]
        void import('../../house/links').then((m) => m.paintHouseLink(hp)).catch(() => undefined); // [restd]
      },
      leave() {
        clearInterval(codeTimer);
      },
      // (BRIEF-SHELL pass 1) the page open
      context: () => {
        const sec = sectionNow('links') || 'Accounts';
        return screenSays('links', 'Links', `links, on ${sec.toLowerCase()}`, { looking: 'links', selected: { kind: 'group', id: `links:${sec}`, label: sec } });
      },
      // Each connection as its panel says it ("email: Linked as tony@gmail.com; spotify: Not linked; …").
      describe: () => `Links: ${(Object.keys(NAMES) as Id[]).map((id) => `${id}: ${said[id] || stateTag(state[id])}`).join('; ')}.`,
    };
  },
};
