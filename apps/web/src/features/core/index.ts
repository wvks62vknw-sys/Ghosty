/**
 * CORE tab: the arc reactor, Ghosty's voice/text conversation, and at-a-glance panels.
 */
import { brain } from '../../api/brain';
import { answerApproval, askBigBrain, chat, send, thinkHarderAbout, type Entry } from '../../assistant/session';
import { stopThinking } from '../../offline/harder';
import { listen, micLevel, stopListening, voiceSupport } from '../../assistant/voice';
import { clear, fmt, h, icon } from '../../core/dom';
import { coins, CURRENCY_SYMBOL, indices } from '../../data/markets';
import { signals, threatLevel, quakes, events } from '../../data/hazards';
import { news } from '../../data/news';
import { air, airBand, WMO, temp, weather } from '../../data/weather';
import { onFrame } from '../../engine/scheduler';
import { run } from '../../commands/registry';
import { go, type TabDef } from '../../shell/tabs';
import { home, settings, ui } from '../../state/app';
import { button, pager, panel, row, SEV_COLORS, spark, toast } from '../../ui/components';
import { citedReply } from './cited';
import { StarkHud } from './hud';
import { progressRatio, progressText } from './progress';
import { Reactor } from './reactor';

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
const CAM = '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>';

let whisper = false;
let conversation = false;

async function voiceTurn(): Promise<void> {
  if (!voiceSupport.mic && !voiceSupport.browserStt) {
    toast('No microphone access in this browser', 'warn');
    conversation = false;
    return;
  }
  try {
    const text = await listen(whisper, (t) => chat.set({ live: t }));
    if (!conversation) return;
    if (!text) {
      if (conversation) setTimeout(() => void voiceTurn(), 300);
      return;
    }
    await send(text.replace(/^(hey |ok |okay )?(ghosty|ghost|jarvis)[,.!]?\s*/i, '') || text, { speak: true, voice: true });
    // wait for speech to finish, then listen again
    const wait = () => (ui.get().voice === 'speaking' || ui.get().busy ? setTimeout(wait, 250) : conversation && setTimeout(() => void voiceTurn(), 250));
    wait();
  } catch (e) {
    conversation = false;
    toast(String((e as Error)?.message ?? e), 'bad');
  }
}

/** A link to one of Ghosty's own pictures (made, or shared from the Lens): shown as the picture itself. */
const PICTURE = new RegExp(`^${location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i/[A-Za-z0-9_-]{16}$`);

/** Text with its web links made tappable (built as nodes: text can never become HTML); a picture link becomes the picture. */
function linked(text: string): HTMLElement {
  const out = h('span');
  let last = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g)) {
    out.append(text.slice(last, m.index));
    if (PICTURE.test(m[0])) out.append(h('a.piccard', { href: m[0], target: '_blank', rel: 'noopener noreferrer' }, h('img', { src: m[0], alt: 'picture Ghosty made', loading: 'lazy' })));
    else out.append(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer' }, m[0]));
    last = m.index! + m[0].length;
  }
  out.append(text.slice(last));
  return out;
}

/** An ordinary reply: from the phone (a quiet chip says so), cited, or plain. */
function plainReply(e: Extract<Entry, { kind: 'assistant' }>): HTMLElement {
  // Answered by the small model on the phone itself: one quiet chip says so.
  if (e.offline) return h('div.msg.off', h('small', 'GHOSTY'), linked(e.text || '…'), h('span.offchip', 'Answered on your phone (offline)'));
  // A cited answer: chips for its sources, the list under it, and how many claims the sources back.
  if (e.cited) return h('div.msg.cited', h('small', `GHOSTY${e.model ? ` · ${e.model}` : ''}`), ...citedReply(e.text, e.cited, linked));
  return h('div.msg', h('small', `GHOSTY${e.model ? ` · ${e.model}` : ''}`), linked(e.text));
}

/**
 * The STOP button of a THINK HARDER still running, kept from one repaint of the log to the next: the log is
 * redrawn as progress comes in, and a tap that lands while its button is swapped for a new one would be lost.
 */
let stopBtn: { at: number; el: HTMLButtonElement } | null = null;

/** A THINK HARDER answer: live progress and STOP while it works; then the answer, how sure it is, its working, and ASK THE BIG BRAIN. */
function renderThink(e: Extract<Entry, { kind: 'assistant' }>): HTMLElement {
  const t = e.think!;
  const box = h('div.msg.off.think', h('small', 'GHOSTY · THINK HARDER'));
  if (t.state === 'running') {
    if (stopBtn?.at !== e.at) stopBtn = { at: e.at, el: button('STOP', () => stopThinking(), 'warn') };
    box.append(h('div.thinkline.live', h('i'), h('span', t.line)), h('div.row', stopBtn.el));
    return box;
  }
  if (stopBtn?.at === e.at) stopBtn = null;
  box.append(
    h('b.thinkans', t.answer || '(no answer)'),
    h(`div.thinkconf.${t.confidence ?? 'none'}` as 'div', `${t.line}${t.secs != null ? ` · ${t.secs} s` : ''}`),
  );
  if (e.text && e.text.trim() !== (t.answer ?? '').trim()) box.append(h('details.thinkwork', h('summary', 'HOW IT GOT THERE'), linked(e.text)));
  // The big brain is a separate, owner-asked step: only offered while the brain is reachable.
  const row2 = h('div.row');
  if (ui.get().connected) row2.append(button('ASK THE BIG BRAIN', () => void askBigBrain(t.q), 'bigbrain'));
  if (row2.childElementCount) box.append(row2);
  box.append(h('span.offchip', 'Worked out on your phone (offline)'));
  return box;
}

/** `q`: the question this reply answers, when it is the latest answer (it gets THINK HARDER). */
function renderEntry(e: Entry, q?: string): HTMLElement {
  switch (e.kind) {
    case 'user':
      return h('div.msg.me', h('small', settings.get().name.toUpperCase()), h('span', e.text));
    case 'assistant': {
      if (e.think) return renderThink(e);
      const el = plainReply(e);
      if (q) el.append(h('div.row.thinkrow', button('THINK HARDER', () => void thinkHarderAbout(q), 'thinkbtn')));
      return el;
    }
    case 'link':
      return h('a.sitelink', { href: e.url, target: '_blank', rel: 'noopener noreferrer' }, h('small', 'LIVE · TAP TO OPEN'), h('b', e.title), h('span', e.url.replace(/^https?:\/\//, '')));
    case 'activity': {
      const el = h(`div.act.${e.state}` as 'div', h('i'), h('span', e.label), e.detail ? h('em', e.detail) : null);
      // What the tool is doing right now, under its line, with a thin bar when it knows how far it is.
      if (e.progress && e.state === 'running') {
        const ratio = progressRatio(e.progress);
        el.classList.add('live');
        el.append(h('div.prog', h('span', progressText(e.progress)), ratio === null ? null : h('div.pbar', h('b', { style: { width: `${Math.round(ratio * 100)}%` } }))));
      }
      return el;
    }
    case 'error':
      return h('div.msg.err', h('small', 'PROBLEM'), h('span', e.text));
    case 'approval': {
      const box = h('div.approval', h('small', 'NEEDS YOUR APPROVAL'), h('b', e.reason));
      if (e.state === 'waiting') box.append(h('div.row', button('APPROVE', () => void answerApproval(e.id, true), 'on'), button('DECLINE', () => void answerApproval(e.id, false), 'warn')));
      else box.append(h('span.note', e.via === 'telegram' ? `${e.state === 'approved' ? 'Approved' : 'Not now'} on Telegram.` : e.state === 'approved' ? 'Approved.' : 'Declined.'));
      return box;
    }
  }
}

export const coreTab: TabDef = {
  id: 'core',
  title: 'CORE',
  icon: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  scene: 'backdrop',
  blurb: 'talk to Ghosty · arc reactor HUD',
  primary: true,
  mount(root) {
    const reactor = new Reactor();
    const stark = new StarkHud();
    const hud = h('div.hud.core');
    const stateLabel = h('div#cstate', 'ONLINE');
    // On phones the call-outs around the reactor have no room: the same readings sit in one
    // quiet row under it instead (hidden on wide screens, where the call-outs show).
    const glance = h('div#glance');
    const glanceItems = new Map<string, { el: HTMLElement; v: HTMLElement }>();
    const note = (c: { id: string; label: string; value: string; tone?: 'ok' | 'warn' | 'bad' }) => {
      stark.set(c);
      let g = glanceItems.get(c.id);
      if (!g) {
        const v = h('b', '');
        const el = h('span.gi', h('small', c.label), v);
        glance.append(el);
        g = { el, v };
        glanceItems.set(c.id, g);
      }
      (g.el.firstChild as HTMLElement).textContent = c.label;
      g.v.textContent = c.value;
      g.el.className = `gi${c.tone ? ` ${c.tone}` : ''}`;
    };
    const caption = h('div#ccap', h('span', ''));
    const log = h('div.log');
    const input = h('input#cin', { placeholder: `Talk to me, ${settings.get().name}…`, autocomplete: 'off', enterKeyHint: 'send', 'aria-label': 'Message Ghosty' });
    const submit = () => {
      const t = input.value.trim();
      if (!t) return input.focus(); // nothing typed yet: open the keyboard rather than doing nothing
      input.value = '';
      void send(t, { speak: settings.get().speak });
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    // The Lens: a photo question goes to a model that can see pictures (the Lens's ASK mode).
    const lensBtn = h('button#lensbtn', { type: 'button', 'aria-label': 'Ask about a photo with the Lens', title: 'Ask with the camera' }, icon(CAM));
    lensBtn.addEventListener('click', () => {
      void run('open_lens', { mode: 'ask' }).then((ok) => {
        if (!ok) toast('The Lens is not available in this build', 'warn');
      });
    });
    const mic = h('button#mic', { type: 'button', 'aria-label': 'Talk by voice' }, icon(MIC));
    mic.addEventListener('click', () => {
      if (conversation) {
        conversation = false;
        stopListening();
        mic.classList.remove('on');
        return;
      }
      conversation = true;
      mic.classList.add('on');
      void voiceTurn().finally(() => mic.classList.toggle('on', conversation));
    });
    // CITED: answers looked up and sourced, each claim checked (remembered on this device).
    const citedBtn = button('CITED', (b) => {
      settings.set({ cited: !settings.get().cited });
      b.classList.toggle('on', settings.get().cited);
      b.setAttribute('aria-pressed', String(settings.get().cited));
      toast(settings.get().cited ? 'CITED on: answers come with sources, and each claim is checked' : 'CITED off', settings.get().cited ? 'ok' : '');
    }, `citedbtn${settings.get().cited ? ' on' : ''}`);
    citedBtn.setAttribute('aria-pressed', String(settings.get().cited));
    citedBtn.title = 'Answers with numbered sources, each claim checked';
    const voiceBtn = button(settings.get().speak ? 'VOICE ON' : 'VOICE OFF', (b) => {
      settings.set({ speak: !settings.get().speak });
      b.textContent = settings.get().speak ? 'VOICE ON' : 'VOICE OFF';
    });
    const convo = panel('CONVERSATION', { status: '' });
    convo.body.append(log);
    convo.el.classList.add('convo');
    const logBtn = button('LOG', (b) => {
      const open = hud.classList.toggle('logopen');
      b.classList.toggle('on', open);
      if (open) log.scrollTop = log.scrollHeight;
    }, 'logbtn');

    // side panels (wide screens)
    const wx = panel('WEATHER', { status: home().name.toUpperCase(), grow: false });
    const th = panel('THREAT LEVEL', { footer: true });
    const thPager = pager(th, 44, (s: ReturnType<typeof signals>[number]) => row(s.kind, s.text, s.tag, { sev: s.sev, onClick: () => void import('../../commands/builtin').then((m) => m.flyTo({ lat: s.lat, lon: s.lon, range_km: 1200 })) }), () => quakes.status);
    const mk = panel('MARKETS', { footer: true });
    const mkPager = pager(mk, 40, (x: { n: string; v: string; c: string; up: boolean; sp?: number[] }) => {
      const r = row(x.n, x.v, x.c, { tone: x.up ? 'up' : 'dn', onClick: () => go('markets') });
      if (x.sp) r.insertBefore(spark(x.sp, 60, 18), r.lastChild);
      return r;
    }, () => coins.status);
    const nw = panel('HEADLINES', { footer: true, status: 'BBC' });
    const nwPager = pager(nw, 58, (x: { title: string }) => row(null, x.title, null, { wrap: true, onClick: () => void send(`Explain this headline and why it matters: "${x.title}"`) }), () => news.status);

    const left = h('div.cside.l', convo.el, wx.el);
    const right = h('div.cside.r', th.el, mk.el, nw.el);
    const center = h('div.ccenter', stark.el, h('div.rwrap', reactor.el), stateLabel, glance, caption, h('div#cbar', logBtn, input, button('SEND', submit), citedBtn, voiceBtn, lensBtn, mic));
    hud.append(left, center, right);
    root.append(hud);

    // The caption shows the latest exchange, then fades 25 s after Ghosty has finished (it stays
    // in the LOG). Tap it to dismiss sooner.
    let fadeTimer = 0;
    const armFade = () => {
      clearTimeout(fadeTimer);
      caption.classList.remove('fade');
      if (!chat.get().live) return;
      fadeTimer = window.setTimeout(() => {
        if (ui.get().busy || ui.get().voice === 'speaking') return armFade();
        caption.classList.add('fade');
        fadeTimer = window.setTimeout(() => chat.set({ live: '' }), 900);
      }, 25000);
    };
    caption.addEventListener('click', () => chat.set({ live: '' }));
    // Ghosty's words appear as he says them: the caption types itself in (fast — a whole
    // reply within about a second), instead of landing all at once.
    let typing = 0;
    let shownLive = '';
    const reveal = (text: string) => {
      cancelAnimationFrame(typing);
      const span = caption.firstChild as HTMLElement;
      if (!text) {
        span.textContent = shownLive = '';
        return;
      }
      const from = text.startsWith(shownLive) ? shownLive.length : 0;
      const ms = Math.min(1400, Math.max(200, (text.length - from) * 9));
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        const n = from + Math.round((text.length - from) * k);
        span.textContent = shownLive = text.slice(0, n);
        if (k < 1) typing = requestAnimationFrame(step);
      };
      typing = requestAnimationFrame(step);
    };
    const paintLog = () => {
      const shown = chat.get().entries.slice(-40);
      // The latest reply to a question gets THINK HARDER (not one that is already a THINK HARDER answer).
      const last = shown.findLastIndex((x) => x.kind === 'assistant');
      const asked = last > 0 ? shown.slice(0, last).findLast((x) => x.kind === 'user') : undefined;
      const lastReply = shown[last];
      const q = lastReply?.kind === 'assistant' && !lastReply.think && asked?.kind === 'user' && !/^think harder\b/i.test(asked.text) ? asked.text : undefined;
      clear(log, ...shown.map((x, i) => renderEntry(x, i === last ? q : undefined)));
      log.scrollTop = log.scrollHeight;
      reveal(chat.get().live);
      armFade();
      // The HUD says what the tool at work is doing right now (the latest report); nothing once it has finished.
      const working = [...chat.get().entries].reverse().find((e): e is Extract<Entry, { kind: 'activity' }> => e.kind === 'activity' && e.state === 'running' && !!e.progress);
      stark.task(working?.progress ? progressText(working.progress) : null);
    };
    chat.subscribe(paintLog);
    paintLog();
    // power-up sequence: the HUD draws itself in, then reports
    const bootMsgs = ['POWERING UP', 'ARC OUTPUT NOMINAL', 'NEURAL LINK ESTABLISHED', 'ALL SYSTEMS ONLINE'];
    let booting = true;
    bootMsgs.forEach((m, i) => setTimeout(() => {
      stateLabel.textContent = m;
      if (i === bootMsgs.length - 1) setTimeout(() => {
        booting = false;
        paintState();
      }, 1400);
    }, i * 650));
    const paintState = () => {
      if (!ui.get().busy) stark.task(null); // nothing to show between turns (a tool left running by a broken turn is marked stopped in session.ts, so paintLog never picks it up again)
      if (booting) return;
      const s = ui.get();
      reactor.state = s.busy && s.voice !== 'speaking' ? 'thinking' : s.voice;
      stateLabel.textContent = s.voice === 'speaking' ? 'SPEAKING' : s.voice === 'listening' ? 'LISTENING' : s.busy ? (s.status || 'PROCESSING').toUpperCase().slice(0, 48) : conversation ? 'READY' : 'ONLINE';
    };
    ui.subscribe(paintState);
    paintState();
    onFrame((dt) => {
      if (ui.get().tab !== 'core') return;
      reactor.level = ui.get().voice === 'listening' ? micLevel.level : 0;
      reactor.spectrum = ui.get().voice === 'listening' ? micLevel.spectrum : null;
      reactor.frame(dt);
      // the HUD rings sit just outside the reactor's own instruments
      const rr = reactor.el.getBoundingClientRect();
      const lr = stark.el.getBoundingClientRect();
      const half = Math.min(rr.width, rr.height) / 2;
      stark.frame(dt, reactor.state, reactor.level, { x: rr.left - lr.left + rr.width / 2, y: rr.top - lr.top + rr.height / 2 }, (half / 1.45) * 1.22);
    });

    // live call-outs around the reactor
    const latency = async (): Promise<number | null> => {
      const t0 = performance.now();
      const ok = await brain.health();
      return ok ? Math.round(performance.now() - t0) : null;
    };
    let libAt = 0;
    let libText = '…';
    const paintCallouts = async () => {
      const lastModel = [...chat.get().entries].reverse().find((e) => e.kind === 'assistant' && e.model);
      const model = lastModel && lastModel.kind === 'assistant' ? lastModel.model ?? '' : '';
      const ms = await latency().catch(() => null);
      note({ id: 'ai', label: 'AI LINK', value: model ? model.replace(/ · /, ' ▸ ').slice(0, 30) : 'STANDING BY', tone: 'ok' });
      note({ id: 'uplink', label: 'UPLINK', value: ms === null ? 'OFFLINE' : `${navigator.onLine ? 'SECURE' : 'LOCAL'} · ${ms} MS`, tone: ms === null ? 'bad' : ms > 800 ? 'warn' : 'ok' });
      const w = weather.data;
      note({ id: 'env', label: home().name.toUpperCase().slice(0, 18), value: `${fmt.time(new Date())}${w ? ` · ${temp(w.current.temperature_2m)} ${WMO(w.current.weather_code).toUpperCase().slice(0, 14)}` : ''}` });
      const lv = threatLevel(signals());
      note({ id: 'threat', label: 'THREAT', value: lv.label, tone: lv.n >= 2 ? 'bad' : lv.n === 1 ? 'warn' : 'ok' });
      const bat = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> }).getBattery?.().catch(() => null);
      stark.set({ id: 'power', label: 'POWER', value: bat ? `${Math.round(bat.level * 100)}%${bat.charging ? ' · CHARGING' : ''}` : 'ARC · 3 GW', tone: bat && bat.level < 0.15 && !bat.charging ? 'warn' : 'ok' });
      // The library size changes slowly: ask every 5 minutes, not on every 15-second repaint (each ask is database reads).
      if (Date.now() - libAt > 300_000) {
        libAt = Date.now();
        const lib = await brain.library().catch(() => null);
        libText = lib ? `${fmt.n(lib.stats.passages)} PASSAGES` : 'OFFLINE';
      }
      stark.set({ id: 'library', label: 'LIBRARY', value: libText });
    };
    let calloutTimer = 0;

    const paintSide = () => {
      const w = weather.data;
      clear(wx.body);
      if (w) {
        wx.body.append(
          h('div.row', h('div.big', temp(w.current.temperature_2m)), h('div.lab', WMO(w.current.weather_code))),
          h('div.note', `feels ${temp(w.current.apparent_temperature)} · ${temp(w.daily.temperature_2m_min[0]!)} to ${temp(w.daily.temperature_2m_max[0]!)} · rain ${w.daily.precipitation_probability_max[0]}%${air.data ? ` · air ${airBand(air.data.current.european_aqi).label.toLowerCase()}` : ''}`),
          spark(w.hourly.temperature_2m.slice(new Date().getHours(), new Date().getHours() + 24), 260, 34),
        );
      } else wx.body.append(h('div.note', weather.status === 'NO FEED' ? 'Weather unavailable right now.' : 'Fetching forecast…'));
      const sig = signals();
      const lv = threatLevel(sig);
      th.setStatus(lv.label, lv.n >= 2 ? 'off' : lv.n === 1 ? 'mid' : 'ok');
      th.title.style.color = SEV_COLORS[lv.n]!;
      thPager.set(sig.slice(0, 12));
      const sym = CURRENCY_SYMBOL[settings.get().currency] ?? '';
      mkPager.set([
        ...(coins.data ?? []).slice(0, 4).map((c) => ({ n: c.sym, v: `${sym}${fmt.n(c.price, c.price < 10 ? 2 : 0)}`, c: `${c.change >= 0 ? '+' : ''}${c.change.toFixed(1)}%`, up: c.change >= 0, sp: c.spark })),
        ...(indices.data ?? []).slice(0, 4).map((c) => ({ n: c.name.slice(0, 10), v: fmt.n(c.price, 0), c: `${c.change >= 0 ? '+' : ''}${c.change.toFixed(2)}%`, up: c.change >= 0 })),
      ]);
      mk.setStatus(coins.status, coins.status === 'LIVE' ? 'ok' : 'mid');
      nwPager.set((news.data ?? []).slice(0, 8));
      nw.setStatus(news.status, news.status === 'LIVE' ? 'ok' : 'off');
    };
    for (const f of [weather, air, quakes, events, coins, indices, news]) f.onChange(paintSide);
    paintSide();
    return {
      enter() {
        void paintCallouts();
        clearInterval(calloutTimer);
        calloutTimer = window.setInterval(() => void paintCallouts(), 15000);
        weather.start();
        air.start();
        quakes.start();
        events.start();
        coins.start();
        indices.start();
        news.start();
        // Whisper through the brain when it can hear (a Groq key, or Workers AI); older brains only say which keys are set.
        brain
          .status()
          .then((s) => (whisper = s.speech ? s.speech.stt : s.keys.some((k) => k.name === 'groq' && k.set)))
          .catch(() => undefined);
      },
      leave() {
        clearInterval(calloutTimer);
      },
      describe: () => `Core screen. Last thing said: ${chat.get().live.slice(0, 160)}`,
    };
  },
};
