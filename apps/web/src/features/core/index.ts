/**
 * CORE tab: the arc reactor, Ghosty's voice/text conversation, and at-a-glance panels.
 */
import { brain } from '../../api/brain';
import { answerApproval, askBigBrain, chat, send, thinkHarderAbout, type Entry } from '../../assistant/session';
import { canThink, recheckThink, stopThinking } from '../../offline/harder';
import { holdMic, interrupt, listen, micLevel, onMicReleased, speak, stopListening, voiceSupport } from '../../assistant/voice';
import { proLook, themeEvents } from '../../state/theme';
import { clear, fmt, h, icon } from '../../core/dom';
import { coins, CURRENCY_SYMBOL, indices } from '../../data/markets';
import { signals, threatLevel, quakes, events } from '../../data/hazards';
import { news } from '../../data/news';
import { air, airBand, WMO, temp, weather } from '../../data/weather';
import { onFrame } from '../../engine/scheduler';
import { run } from '../../commands/registry';
import { go, type TabDef } from '../../shell/tabs';
import { navTo } from '../../shell/areas';
import { popScreen, pushScreen } from '../../ui/listmode';
import { home, settings, ui } from '../../state/app';
import { button, pager, panel, row, SEV_COLORS, spark, toast } from '../../ui/components';
import { citedReply } from './cited';
import { homeAfterReply, homeCard } from './homecard';
import { routeCHome } from './home';
import { StarkHud } from './hud';
import { progressRatio, progressText } from './progress';
import { rateable, rateRow, ratings } from './rate';
import { siteRow } from './sitecard';
import { videoBody } from './ytcard';
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
  // A voice conversation keeps the microphone open between turns, so talking over Ghosty cuts in (barge-in).
  holdMic(true);
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
    holdMic(false);
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

const COPY = '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5"/>';
const LISTEN = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>';

/** Under a reply (the calm looks show them): copy it, or hear it read aloud. */
function replyActs(text: string): HTMLElement {
  const copy = h('button.msgact', { type: 'button', 'aria-label': 'Copy the reply', title: 'Copy' }, icon(COPY));
  copy.addEventListener('click', () => void navigator.clipboard?.writeText(text).then(() => toast('Copied', 'ok'), () => toast('Could not copy', 'warn')));
  const hear = h('button.msgact', { type: 'button', 'aria-label': 'Read the reply aloud', title: 'Listen' }, icon(LISTEN));
  hear.addEventListener('click', () => void speak(text).catch(() => undefined));
  return h('div.msgacts', copy, hear);
}

const TICK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
/**
 * Route C's line over a reply: Ghosty's glyph, his name and the model that answered (as the brain named it),
 * and CITED when the answer is sourced. The classic looks keep their small capitals line instead (styles.css).
 */
function whoLine(model: string | undefined, cited: boolean, where = ''): HTMLElement {
  return h('div.rcwho', { dataset: { case: 'keep' } }, h('i.dot'), h('b', 'Ghosty'), model || where ? h('em', ` · ${model || where}`) : null,
    cited ? h('span.rccited', icon(TICK), 'CITED') : null);
}

/** An ordinary reply: from the phone (a quiet chip says so), cited, or plain. */
function plainReply(e: Extract<Entry, { kind: 'assistant' }>): HTMLElement {
  // Answered by the small model on the phone itself: one quiet chip says so.
  if (e.offline) return h('div.msg.off', whoLine(undefined, false, 'on your phone'), h('small', 'GHOSTY'), linked(e.text || '…'), h('span.offchip', 'Answered on your phone (offline)'));
  // A cited answer: chips for its sources, the list under it, and how many claims the sources back.
  if (e.cited) return h('div.msg.cited', whoLine(e.model, true), h('small', `GHOSTY${e.model ? ` · ${e.model}` : ''}`), ...citedReply(e.text, e.cited, linked));
  // Cut off: the owner interrupted while it was read out.
  return h('div.msg', whoLine(e.model, false), h('small', `GHOSTY${e.model ? ` · ${e.model}` : ''}`), ...videoBody(e.text, linked), e.cut ? h('span.cutchip', 'Cut off — you interrupted') : null);
}

/**
 * Route C: a run of tool steps before a reply as one line — "✓ 3 steps · Searching the web, weather, reading a
 * page" — that opens to the steps themselves (open while one is still working, so its progress shows).
 */
function stepsLine(acts: Extract<Entry, { kind: 'activity' }>[], rows: HTMLElement[], open: Set<string>): HTMLElement {
  const running = acts.some((a) => a.state === 'running');
  const failed = acts.some((a) => a.state === 'fail');
  const seen = new Map<string, number>();
  for (const a of acts) {
    const l = a.state === 'ok' ? a.label.replace(/^Saving to /, 'Saved to ') : a.label;
    seen.set(l, (seen.get(l) ?? 0) + 1);
  }
  const words = [...seen].map(([l, n], i) => `${i ? l.charAt(0).toLowerCase() + l.slice(1) : l}${n > 1 ? ` ×${n}` : ''}`).join(', ');
  const key = acts[0]!.id;
  const d = h(`details.rcsteps${running ? '.live' : failed ? '.bad' : ''}` as 'details',
    h('summary', { dataset: { case: 'keep' } }, h('span.ck', icon(running ? '<circle cx="12" cy="12" r="6"/>' : failed ? '<path d="M7 7l10 10M17 7L7 17"/>' : TICK)), h('b', running ? 'Working' : `${acts.length} step${acts.length === 1 ? '' : 's'}`), h('i.sep'), h('span.w', words), icon('<path d="M6 9.5l6 6 6-6"/>', 'ic chv')),
    ...rows);
  d.open = running || open.has(key);
  d.addEventListener('toggle', () => (d.open ? open.add(key) : open.delete(key)));
  return d;
}
const openSteps = new Set<string>();

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
  if (e.cut) box.append(h('span.cutchip', 'Cut off — you interrupted'));
  return box;
}

/** `q`: the question this reply answers, when it is the latest answer (it gets THINK HARDER). */
function renderEntry(e: Entry, q?: string): HTMLElement {
  switch (e.kind) {
    case 'user':
      // data-at: the Memory tab's "from your chat" opens the conversation here.
      return h('div.msg.me', { 'data-at': String(e.at) }, h('small', settings.get().name.toUpperCase()), h('span', e.text));
    case 'assistant': {
      if (e.think) return renderThink(e);
      const el = plainReply(e);
      // A website built on the phone: PREVIEW / SAVE FILE / PUBLISH (sitecard.ts).
      if (e.site) el.append(siteRow(e.site));
      // Route C: the reply card's one row — 👍 / 👎, copy, listen, then THINK HARDER on the right.
      const acts = proLook() ? h('div.rcacts') : el;
      // 👍 / 👎: what the offline brain's weekly training learns from (rate.ts).
      if (rateable(e)) acts.append(rateRow(e));
      if (proLook() && e.text && !e.offline) acts.append(replyActs(e.text));
      if (q) acts.append(h('div.row.thinkrow', button('THINK HARDER', () => void thinkHarderAbout(q), 'thinkbtn')));
      // copy / listen (the calm looks show them under the latest reply)
      if (!proLook() && e.text && !e.offline) el.append(replyActs(e.text));
      if (acts !== el && acts.childElementCount) el.append(acts);
      return el;
    }
    case 'home':
      // a plan drawn from the owner's words: OPEN IN SPACE / SEE IN 3-D (homecard.ts)
      return homeCard(e);
    case 'link':
      return h('a.sitelink', { href: e.url, target: '_blank', rel: 'noopener noreferrer' }, h('small', 'LIVE · TAP TO OPEN'), h('b', e.title), h('span', e.url.replace(/^https?:\/\//, '')));
    case 'activity': {
      // done: "Saving to memory" reads "Saved to memory"
      const label = e.state === 'ok' ? e.label.replace(/^Saving to /, 'Saved to ') : e.label;
      const el = h(`div.act.${e.state}` as 'div', h('i'), h('span', label), e.detail ? h('em', e.detail) : null);
      // saved to memory: the calm looks say "Remembered ✓" on the reply instead of a row of its own
      if (/ to memory$/.test(label)) el.classList.add('memact');
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
    // (route C shows it as a pill in tracked capitals: its case is kept)
    const stateLabel = h('div#cstate', { dataset: { case: 'keep', tone: 'live' } }, 'ONLINE');
    // On phones the call-outs around the reactor have no room: the same readings sit in one
    // quiet row under it instead (hidden on wide screens, where the call-outs show).
    const glance = h('div#glance');
    const glanceItems = new Map<string, { el: HTMLElement; v: HTMLElement }>();
    /** `glance`: the row's own wording when it must keep its case (a unit like °F; the calm looks show the row in sentence case). */
    const note = (c: { id: string; label: string; value: string; glance?: string; tone?: 'ok' | 'warn' | 'bad' }) => {
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
      g.v.textContent = c.glance ?? c.value;
      if (c.glance) g.v.dataset.case = 'keep';
      else delete g.v.dataset.case;
      g.el.className = `gi${c.tone ? ` ${c.tone}` : ''}`;
    };
    // The caption: the latest words, and under a finished reply its 👍 / 👎 (rate.ts), so a phone can rate it without opening the LOG.
    const capRate = h('div.caprate');
    const caption = h('div#ccap', h('span', ''), capRate);
    const log = h('div.log');
    const input = h('input#cin', { placeholder: `Talk to me, ${settings.get().name}…`, autocomplete: 'off', enterKeyHint: 'send', 'aria-label': 'Message Ghosty' });
    // The calm looks' field is narrower (its buttons sit inside it): a shorter invitation.
    const placeholder = () => (input.placeholder = proLook() ? 'Ask anything' : `Talk to me, ${settings.get().name}…`);
    placeholder();
    themeEvents.on('change', placeholder);
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
    // The app hidden ends the voice conversation: the microphone is let go (voice.ts) and not taken again.
    onMicReleased(() => {
      conversation = false;
      mic.classList.remove('on');
    });
    mic.addEventListener('click', () => {
      // Ghosty is talking: the tap cuts in and it listens (a conversation's loop listens next by itself).
      if (interrupt('tap') && conversation) return;
      if (conversation) {
        conversation = false;
        holdMic(false);
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
    // The conversation's one way in and out (the calm looks: a "Chat" chip under the reactor, "Continue in chat" on a
    // reply, and "‹ Ask" once open; the classic looks: LOG in the chat bar). Tests know it as .logbtn.
    const logBtn = button('LOG', () => setChat(!hud.classList.contains('logopen')), 'logbtn');
    const setChat = (open: boolean) => {
      hud.classList.toggle('logopen', open);
      logBtn.classList.toggle('on', open);
      if (open) log.scrollTop = log.scrollHeight;
      if (proLook()) {
        if (open) pushScreen({ back: 'Ask', label: 'Chat', ownBack: true, pop: () => setChat(false) });
        else popScreen();
      }
      placeChat();
    };

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
    // A tap on the reactor — anywhere on this tab but a control or the log — while Ghosty is speaking stops it
    // (in a voice conversation it then listens). The reactor itself lets taps through to the scene behind it.
    document.addEventListener('pointerup', (e) => {
      if (ui.get().tab !== 'core' || ui.get().voice !== 'speaking') return;
      const t = e.target as Element | null;
      if (t?.closest?.('button, input, select, textarea, a, .log, .cside, #cbar, #topbar, nav, .modal')) return;
      interrupt('tap');
    });
    // The calm looks: a lock-screen glance (date and time above the reactor; the weather and what is next
    // under it) and a "+" that holds voice replies and the camera. The classic looks never show them.
    // Under the greeting (the navigation bar's large title): the time and the weather in one small line, then what is next.
    const lockDate = h('span.ldate');
    const lockTime = h('b.ltime');
    const lock = h('div#lock', lockDate, lockTime);
    const lockWx = h('span.lwx');
    const lockNext = h('span.lnext');
    const lockLine = h('div#lockline', lockWx, lockNext);
    const paintLock = () => {
      const d = new Date();
      const w0 = weather.data;
      lockDate.textContent = `${fmt.time(d)}${w0 ? `  ·  ${temp(w0.current.temperature_2m)} ${WMO(w0.current.weather_code).toLowerCase()}` : ''}`;
      lockTime.textContent = nextUp ? `Next: ${nextUp}` : d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
      lockWx.textContent = '';
      lockNext.textContent = nextUp;
      lockNext.hidden = !nextUp;
    };
    let nextUp = '';
    // Two or three things to ask for, under the reactor (the calm looks); the first is the way into the conversation.
    const chip = (label: string, tint: string, glyph: string, run: () => void) => {
      const b = h('button.sugg', { type: 'button', style: `--tint:${tint}` }, icon(glyph), h('span', label));
      b.addEventListener('click', run);
      return b;
    };
    const suggest = h('div#suggest',
      chip('Brief me', '#5e5ce6', '<path d="M5 4.5h11.5a2 2 0 012 2V19a1.5 1.5 0 01-1.5 1.5H6.5A1.5 1.5 0 015 19z"/><path d="M8.5 8.5h6M8.5 12h6M8.5 15.5h3.5M18.5 9H20v9.5a2 2 0 01-2 2"/>', () => navTo('brief', 'push')),
      chip('What’s on today', '#ff453a', '<rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>', () => void send('What should I know today?', { speak: settings.get().speak })),
      chip('God’s eye', '#0a84ff', '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5S14.6 18.1 12 20.5M12 3.5C9.4 5.9 8.2 8.7 8.2 12s1.2 6.1 3.8 8.5"/>', () => navTo('eye', 'push')),
    );
    const capActs = h('div.capacts');
    const plus = h('button.plusbtn', { type: 'button', 'aria-label': 'More: voice replies and the camera', 'aria-expanded': 'false' }, icon('<path d="M12 5v14M5 12h14"/>'));
    // (CITED sits in the bar itself: route C's composer shows it as a toggle beside the field; the classic looks, in a row)
    const plusMenu = h('div.plusmenu', voiceBtn, lensBtn);
    plus.addEventListener('click', () => {
      const open = !plusMenu.classList.contains('open');
      plusMenu.classList.toggle('open', open);
      plus.setAttribute('aria-expanded', String(open));
    });
    plusMenu.addEventListener('click', () => {
      plusMenu.classList.remove('open');
      plus.setAttribute('aria-expanded', 'false');
    });
    // Escape closes it, and so does a tap anywhere else
    addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !plusMenu.classList.contains('open')) return;
      plusMenu.classList.remove('open');
      plus.setAttribute('aria-expanded', 'false');
    });
    document.addEventListener('pointerdown', (e) => {
      if (!plusMenu.classList.contains('open') || plus.contains(e.target as Node) || plusMenu.contains(e.target as Node)) return;
      plusMenu.classList.remove('open');
      plus.setAttribute('aria-expanded', 'false');
    });
    // Route C's Home (home.ts): the date and weather lines, the reactor framed by its four instruments, the
    // Today card and the two tiles. The classic looks see only the reactor of it (styles.css).
    const rwrap = h('div.rwrap', reactor.el);
    const rc = routeCHome(rwrap);
    const center = h('div.ccenter', stark.el, lock, rc.wx, rc.hero, lockLine, stateLabel, glance, caption, rc.below, suggest, h('div#cbar', plus, logBtn, input, button('SEND', submit, 'sendbtn'), plusMenu, citedBtn, mic));
    // the date line sits in the navigation bar, beside search and the avatar (shown on the reactor screen only)
    setTimeout(() => document.querySelector('#top')?.prepend(rc.date), 0);
    caption.append(capActs);
    // Where the conversation button is (one at a time): the classic looks' chat bar; in the calm looks "‹ Ask" in the
    // navigation bar while the conversation is open, "Continue in chat" on a reply, else the "Chat" chip.
    const cbar = center.querySelector('#cbar')!;
    const placeChat = () => {
      const top = document.querySelector('#top');
      const replying = !!chat.get().live && !caption.classList.contains('fade');
      center.classList.toggle('replying', proLook() && replying && !hud.classList.contains('logopen'));
      if (!proLook()) {
        delete logBtn.dataset.label;
        if (logBtn.parentElement !== cbar) cbar.insertBefore(logBtn, input);
        return;
      }
      if (hud.classList.contains('logopen') && top) {
        logBtn.dataset.label = 'Ask';
        if (logBtn.parentElement !== top) top.prepend(logBtn);
      } else if (replying) {
        logBtn.dataset.label = 'Continue in chat';
        if (logBtn.parentElement !== capActs) capActs.append(logBtn);
      } else {
        // route C: the way into the conversation is the ask bar's own chat button (left in the field)
        logBtn.dataset.label = 'Chat';
        if (logBtn.parentElement !== cbar) cbar.insertBefore(logBtn, input);
      }
    };
    setTimeout(placeChat, 0);
    themeEvents.on('change', placeChat);
    // Touch the reactor: it answers with a pulse.
    reactor.el.addEventListener('pointerdown', (e) => proLook() && reactor.poke(e));
    hud.append(rc.glow, left, center, right);
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
    caption.addEventListener('click', (e) => !(e.target as HTMLElement).closest('button') && chat.set({ live: '' }));
    // the reply card's own actions: copy, listen (then "Continue in chat", placed by placeChat)
    const capCopy = h('button.msgact', { type: 'button', 'aria-label': 'Copy the reply', title: 'Copy' }, icon(COPY));
    capCopy.addEventListener('click', () => void navigator.clipboard?.writeText(chat.get().live).then(() => toast('Copied', 'ok'), () => toast('Could not copy', 'warn')));
    const capHear = h('button.msgact', { type: 'button', 'aria-label': 'Read the reply aloud', title: 'Listen' }, icon(LISTEN));
    capHear.addEventListener('click', () => void speak(chat.get().live).catch(() => undefined));
    capActs.append(capCopy, capHear);
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
      // a plan card goes under the reply it came with (homecard.ts)
      const shown = homeAfterReply(chat.get().entries.slice(-40));
      // The latest reply to a question gets THINK HARDER (not one that is already a THINK HARDER answer).
      const last = shown.findLastIndex((x) => x.kind === 'assistant');
      const asked = last > 0 ? shown.slice(0, last).findLast((x) => x.kind === 'user') : undefined;
      const lastReply = shown[last];
      // Only where it can work: the offline brain is on this phone and not switched off.
      const offered = canThink.get().ready && settings.get().offlineBrain !== 'off';
      const q = offered && lastReply?.kind === 'assistant' && !lastReply.think && asked?.kind === 'user' && !/^think harder\b/i.test(asked.text) ? asked.text : undefined;
      // a day line where the day changes ("Today", "Yesterday", "Friday 16 October")
      let day = '';
      const els: HTMLElement[] = [];
      // route C: a run of tool rows becomes one "N steps" line that opens to them
      let run: { acts: Extract<Entry, { kind: 'activity' }>[]; rows: HTMLElement[] } | null = null;
      const flush = () => {
        if (run) els.push(stepsLine(run.acts, run.rows, openSteps));
        run = null;
      };
      shown.forEach((e, i) => {
        const at = 'at' in e ? e.at : 0;
        if (at) {
          const d = new Date(at);
          const k = d.toDateString();
          if (k !== day) {
            flush();
            day = k;
            const ago = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / 864e5);
            // "Today 18:31": the day, and the time of its first message
            els.push(h('div.daysep', `${ago === 0 ? 'Today' : ago === 1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })} ${fmt.time(d)}`));
          }
        }
        if (proLook() && e.kind === 'activity') {
          run ??= { acts: [], rows: [] };
          run.acts.push(e);
          run.rows.push(renderEntry(e));
          return;
        }
        flush();
        els.push(renderEntry(e, i === last ? q : undefined));
      });
      flush();
      clear(log, ...els);
      // copy / listen only under the latest reply
      [...log.querySelectorAll('.msg:not(.me)')].at(-1)?.classList.add('latest');
      // "Remembered ✓" on the reply that follows a save to memory
      for (const a of log.querySelectorAll('.act.memact.ok')) {
        let n = (a.closest('.rcsteps') ?? a).nextElementSibling;
        while (n && !n.matches('.msg:not(.me)') && n.matches('.act')) n = n.nextElementSibling;
        if (n?.matches('.msg:not(.me)')) n.append(h('span.memchip', 'Remembered'));
      }
      placeChat();
      log.scrollTop = log.scrollHeight;
      reveal(chat.get().live);
      paintCapRate();
      armFade();
      // The HUD says what the tool at work is doing right now (the latest report); nothing once it has finished.
      const working = [...chat.get().entries].reverse().find((e): e is Extract<Entry, { kind: 'activity' }> => e.kind === 'activity' && e.state === 'running' && !!e.progress);
      stark.task(working?.progress ? progressText(working.progress) : null);
    };
    const paintCapRate = () => {
      const last = chat.get().entries.at(-1);
      clear(capRate, ...(chat.get().live && !ui.get().busy && last?.kind === 'assistant' && rateable(last) ? [rateRow(last)] : []));
    };
    ui.subscribe((u, prev) => void (u.busy !== prev.busy && paintCapRate()));
    chat.subscribe(paintLog);
    canThink.subscribe(paintLog);
    settings.subscribe((st, prev) => st.offlineBrain !== prev.offlineBrain && paintLog());
    recheckThink();
    ratings.subscribe(paintLog);
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
      stateLabel.textContent = s.voice === 'speaking' ? 'SPEAKING' : s.voice === 'listening' ? 'LISTENING' : s.busy ? (s.status || 'PROCESSING').toUpperCase().slice(0, 48) : s.connected === false ? 'OFFLINE' : conversation ? 'READY' : 'ONLINE';
      // route C draws it as a pill: the accent while live, amber when the brain can't be reached
      stateLabel.dataset.tone = s.connected === false && !s.busy && s.voice !== 'speaking' ? 'warn' : 'live';
    };
    ui.subscribe(paintState);
    paintState();
    let glowTick = 0;
    onFrame((dt) => {
      if (ui.get().tab !== 'core') return;
      reactor.level = ui.get().voice === 'listening' ? micLevel.level : 0;
      reactor.spectrum = ui.get().voice === 'listening' ? micLevel.spectrum : null;
      reactor.frame(dt);
      // the HUD rings sit just outside the reactor's own instruments
      const rr = reactor.el.getBoundingClientRect();
      const lr = stark.el.getBoundingClientRect();
      const half = Math.min(rr.width, rr.height) / 2;
      stark.frame(dt, reactor.state, reactor.level, { x: rr.left - lr.left + rr.width / 2, y: rr.top - lr.top + rr.height / 2 }, (half / reactor.extent()) * 1.22);
      // The reactor's light tints the glass around it (styles.css --glow), a few times a second.
      if ((glowTick += dt) > 0.12) {
        glowTick = 0;
        hud.style.setProperty('--glow', reactor.light().toFixed(2));
        paintLock();
      }
    });

    // live call-outs around the reactor
    const latency = async (): Promise<number | null> => {
      const t0 = performance.now();
      const ok = await brain.health();
      return ok ? Math.round(performance.now() - t0) : null;
    };
    let libAt = 0;
    let libText = '…';
    let nextAt = 0;
    const paintCallouts = async () => {
      // route C's instruments and cards (each refreshes only what is stale)
      rc.tick();
      rc.enter();
      const lastModel = [...chat.get().entries].reverse().find((e) => e.kind === 'assistant' && e.model);
      const model = lastModel && lastModel.kind === 'assistant' ? lastModel.model ?? '' : '';
      const ms = await latency().catch(() => null);
      note({ id: 'ai', label: 'AI LINK', value: model ? model.replace(/ · /, ' ▸ ').slice(0, 30) : 'STANDING BY', tone: 'ok' });
      note({ id: 'uplink', label: 'UPLINK', value: ms === null ? 'OFFLINE' : `${navigator.onLine ? 'SECURE' : 'LOCAL'} · ${ms} MS`, tone: ms === null ? 'bad' : ms > 800 ? 'warn' : 'ok' });
      const w = weather.data;
      const sky = w ? WMO(w.current.weather_code).slice(0, 14) : '';
      note({ id: 'env', label: home().name.toUpperCase().slice(0, 18), value: `${fmt.time(new Date())}${w ? ` · ${temp(w.current.temperature_2m)} ${sky.toUpperCase()}` : ''}`, glance: w ? `${fmt.time(new Date())} · ${temp(w.current.temperature_2m)} ${sky}` : undefined });
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
      // What is next today, for the glance under the reactor (asked every 5 minutes, like the library).
      if (Date.now() - nextAt > 300_000) {
        nextAt = Date.now();
        const ag = await brain.agenda(2).catch(() => null);
        const now = Date.now();
        const ev = ag?.events.filter((x) => (x.end ?? x.start) > now).sort((a, b) => a.start - b.start)[0];
        nextUp = ev ? `${ev.title}${ev.allDay ? '' : ` · ${new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}` : '';
      }
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
        // back on the reactor with the conversation still open: the bar says so again
        if (proLook() && hud.classList.contains('logopen')) setTimeout(() => pushScreen({ back: 'Ask', label: 'Chat', ownBack: true, pop: () => setChat(false) }), 0);
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
