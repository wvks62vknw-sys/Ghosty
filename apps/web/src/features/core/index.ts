/**
 * CORE tab: the arc reactor, Ghosty's voice/text conversation, and at-a-glance panels.
 */
import { voiceTag } from './voicetag'; // [voiceknown] whose voice, on the talk bar
import { peopleOpen } from '../lens/people'; // [guardian]
import { brain, speechCaps } from '../../api/brain';
import { pillWords } from './pill';
import { cancelTakeBack, startTakeBack, takeBackLeft, takeBackWords, takesBack } from './takeback'; // [security] security.u5
import { answerApproval, askBigBrain, askCloud, askPhone, chat, send, signOff, thinkHarderAbout, toolWords, turn, type Entry } from '../../assistant/session';
import { sfx } from '../../assistant/sfx';
import { endIntent } from '../../../../../packages/shared/src/intent';
import { CAT_WORDS } from '../../offline/trust';
import { canThink, recheckThink, stopThinking } from '../../offline/harder';
import { heardOver, holdMic, interrupt, listen, micLevel, onCutOff, onMicReleased, primeSpeech, speak, speakIn, stopListening, talkHooks, voiceIn, voiceSupport } from '../../assistant/voice';
import { languageName, OFFLINE_TRANSLATION_NOTE } from '../../offline/prompt';
import { clear, fmt, h, icon } from '../../core/dom';
import { coins, CURRENCY_SYMBOL, indices } from '../../data/markets';
import { signals, threatLevel, quakes, events } from '../../data/hazards';
import { news } from '../../data/news';
import { air, airBand, WMO, temp, weather } from '../../data/weather';
import { onFrame } from '../../engine/scheduler';
import { stopwatch } from '../../core/stopwatch';
import { jumpOpen, run } from '../../commands/registry';
import { go, type TabDef } from '../../shell/tabs';
import { navTo } from '../../shell/areas';
import { lookingAt, stampFacts } from '../../shell/awareness';
import { guardian } from '../../state/guardian';
import { stampLine } from '../../ui/machine';
import { recipe, recipeEvents } from '../../state/theme';
import { scanHome, type ScanHome } from './scan/home';
import { inkHome, type InkHome } from './ink/home';
import { mapHome, type MapHome } from './map/home';
import { eyeHome, type EyeHome } from './eye/home';
import { orbitHome, type OrbitHome } from './orbit/home';
import { grownHome, type GrownHome } from './grown/home';
import type { ScreenContext } from '../../../../../packages/shared/src/awareness';
import { popScreen, pushScreen } from '../../ui/listmode';
import { home, settings, ui } from '../../state/app';
import { button, pager, panel, row, SEV_COLORS, spark, toast } from '../../ui/components';
import { mindGlyph } from '../../ui/instruments';
import { citedReply } from './cited';
import { homeAfterReply, homeCard } from './homecard';
import { routeCHome } from './home';
import { cardEl } from './cards';
import { wallView } from './wall';
import { StarkHud } from './hud';
import { progressRatio, progressText } from './progress';
import { rateable, rateRow, ratings } from './rate';
import { localRow } from './localcard';
import { recallChip } from '../memory/recallcard';
import { heldReply, verifyRow } from './verifycard'; // [health] "Setting it…", the tick, RETRY and SHOW ME
import { holdForWhy, whyButton } from './why';
import { holdOrb } from '../further/mindmap';
import { siteRow } from './sitecard';
import { videoBody } from './ytcard';
import { Reactor } from './reactor';
import { orbSay } from './orbsay';
import { sayError } from '../../ui/hisWords';
import { key } from '../../ui/machine';
import { argWords } from '../../../../../packages/shared/src/abilities';
import { citedBody } from '../../cited/text';
import { approvalAsk, approvalDone, CALLOUT, COPIED, COPY_FAILED, CUT_LABEL, dayWords, FIRST_OPEN, foldReply, NEWEST, NEWEST_LABEL, REST_OPEN, REST_SHUT, shareText, turnWords } from './words';
import { NO_PICTURE_LABEL } from '../../show/words';
import { MIC_BLOCKED, MIC_BROWSER, MIC_NONE, NO_SIGNAL, STILL_LISTENING_MS, TALK_WORDS, talkState } from '../../assistant/words';
import type { CitedInfo } from '../../../../../packages/shared/src/protocol';

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
const CAM = '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>';

let whisper = false;
let conversation = false;
/** Which voice conversation this is (a tap on the mic starts a new one): a turn of an earlier one finishing late never carries on in it. */
let convoId = 0;
/**
 * ON THIS PHONE (OWNER-ISSUES 72): the next message stays on the phone, as every one does with the offline brain on
 * "always" — my offline brain answers it and nothing of it is sent anywhere. Off again once that message is sent.
 */
let hereNext = false;
let paintHere = (): void => undefined;
const takeHere = (): boolean => {
  const on = hereNext;
  hereNext = false;
  paintHere();
  return on;
};
/** The talk bar's two notes that outlast a tap (the microphone refused; the conversation ended on its own): drawn by `paintTalk` in mount(). */
let micNote = '';
let endedNote = false;
let paintTalk = (): void => undefined;
function micRefused(words: string): void {
  micNote = words;
  paintTalk();
}
function talkEnded(): void {
  endedNote = true;
  paintTalk();
  setTimeout(() => ((endedNote = false), paintTalk()), 8000);
}
/** Listens in a row that heard nothing: after two (about 25 s of quiet) the conversation ends and the microphone goes off. */
let quiet = 0;

/** A turn that has been thinking (the screen busy) this long, and Ghosty not speaking, is listened over: the conversation hears him again. */
const EARS_MS = 8_000;

/**
 * Send what was said, and keep the conversation's ears open while the turn is still thinking. A reply that takes more than 8 s
 * (a slow answer, or the phone's own attempt stuck: the owner, 2 Nov, spoke ten times in a row to a Ghosty that was "just
 * thinking for so long") no longer leaves him talking to one that is deaf: the conversation listens again, what he says is
 * sent like any message, and `send` cuts a stuck attempt on the phone short before it goes on (assistant/session.ts). It keeps
 * listening while anything it sent is still thinking, and never while Ghosty speaks: talking over a reply is voice.ts's
 * barge-in, left as it is (a reply that starts while an ear is open shuts it, and what it caught is dropped). As the
 * conversation itself does, it leaves the microphone alone after two quiet listens in a row (about 25 s), so a very long turn
 * never leaves it open and recordings going to be written down for nothing.
 * Resolves when everything sent has ended; a failure to send is thrown, as it always was.
 */
async function sendWithEars(words: string, live: () => boolean): Promise<void> {
  const turns = new Set<Promise<void>>();
  const failed: unknown[] = [];
  let ears = false; // a listen of this turn's own is open
  let quietEars = 0; // listens of it in a row that heard nothing
  const go = (said: string): void => {
    quiet = 0;
    const p: Promise<void> = send(said.replace(/^(hey |ok |okay )?(ghosty|ghost|jarvis)[,.!]?\s*/i, '') || said, { speak: true, voice: true, here: takeHere() })
      .catch((e: unknown) => void failed.push(e))
      .finally(() => {
        turns.delete(p);
        // everything is answered (or ended) with no word spoken: the ear shuts, and what it caught is heard as usual
        if (!turns.size && ears) stopListening();
      });
    turns.add(p);
  };
  go(words);
  let busyAt = 0; // since when the screen has been thinking, as seen from here
  while (turns.size && live()) {
    await Promise.race([...turns, new Promise<void>((resolve) => setTimeout(resolve, 250))]);
    const u = ui.get();
    if (!turns.size || !live()) continue;
    if (!u.busy) {
      busyAt = 0;
      continue;
    }
    busyAt ||= Date.now();
    // (he talked over an aside: his words are being recorded already, so the ear opens for them now, not at 8 s)
    if (u.voice === 'speaking' || u.voice === 'listening' || (Date.now() - busyAt < EARS_MS && !heardOver())) continue;
    const here = settings.get().offlineBrain === 'always' || hereNext || peopleOpen();
    if (here && !voiceSupport.browserStt) break; // (no ears of the phone's own: the next listen says so)
    // A reply that starts to be spoken shuts the ear and drops what it caught (his own voice and the room): it is never heard back.
    const off = ui.subscribe((s) => {
      if (s.voice === 'speaking' && ears) stopListening(true);
    });
    ears = true;
    let heard = '';
    try {
      heard = await listen(!here && (whisper || speechCaps.get().stt), (t) => chat.set({ live: t }));
    } catch {
      break; // (the next listen, once the answer is in, says why it cannot hear)
    } finally {
      ears = false;
      off();
    }
    if (heard && live()) {
      quietEars = 0;
      go(heard);
    } else if (++quietEars >= 2) break; // (the answer is waited for, and the next listen is the conversation's own)
  }
  await Promise.all([...turns]);
  if (failed.length) throw failed[0];
}

async function voiceTurn(id: number, afterSpeech = false): Promise<void> {
  // (a turn of an earlier conversation, finishing late, must not carry on in a later one)
  const live = () => conversation && id === convoId;
  if (!voiceSupport.mic && !voiceSupport.browserStt) {
    toast(MIC_BROWSER, 'warn');
    micRefused(MIC_BROWSER);
    conversation = false;
    return;
  }
  // A voice conversation keeps the microphone open between turns, so talking over Ghosty cuts in (barge-in).
  holdMic(true);
  // [reader] LISTEN on a book: I read first; the ear opens when I stop (talked over, or the book read to its end)
  if (afterSpeech) await untilFree(live);
  if (!live()) return;
  try {
    // Kept on the phone ("always", or ON THIS PHONE): only the phone's own recogniser may hear it (the brain's gets the recording).
    // [guardian] So too with the Lens's PEOPLE open: an introduction ("this is Sam") is heard on the phone, never by the brain.
    const here = settings.get().offlineBrain === 'always' || hereNext || peopleOpen();
    if (here && !voiceSupport.browserStt) {
      endConversation();
      toast(MIC_BROWSER, 'warn');
      micRefused(MIC_BROWSER);
      return;
    }
    // The brain hears when its status says so (any status call since the app opened, not only CORE's own). The moment the
    // ear can hear him, a soft tone says it is his turn (BRIEF-TALK-1A 4).
    const text = await listen(!here && (whisper || speechCaps.get().stt), (t) => chat.set({ live: t }), () => sfx('turn'));
    if (!live()) return;
    if (!text) {
      if (++quiet >= 2) {
        endConversation();
        toast(TALK_WORDS.ended);
        talkEnded();
        return;
      }
      if (live()) setTimeout(() => void voiceTurn(id), 300);
      return;
    }
    quiet = 0;
    // "that's all", "bye", "see you later": the conversation ends here, signed off, the microphone let go (BRIEF-TALK-1A 4);
    // [reader] with a book being read (or just cut), the sign-off is where we are in it ("Page 48. I'll carry on from here.")
    if (endIntent(text)) {
      endConversation();
      const book = await import('../library/reader').then((r) => r.bookSignOff(text)).catch(() => false);
      if (!book) await signOff(text);
      return;
    }
    await sendWithEars(text, live);
    // the ear opens again the moment his reply ends: no wait of its own (it used to look every quarter second, twice)
    await untilFree(live);
    if (live()) void voiceTurn(id);
  } catch (e) {
    if (id === convoId) endConversation();
    const said = sayError(e, 'finish that');
    toast(said, 'bad');
    // the microphone refused (by the browser, or by his Settings), or no signal to hear him with: said on the talk bar too, and kept there
    if (said === MIC_BLOCKED || said === MIC_BROWSER || said === MIC_NONE || said === NO_SIGNAL) micRefused(said);
  }
}

/**
 * A voice conversation starts: the mic's tap, and Siri's "Ghosty listen" (?do=listen: BRIEF-TALK-1A 6). A fresh one: the quiet
 * listens that ended the last do not count against it; the voices are woken first (in the tap itself, when there is one), so
 * his first answer's first word is not the slow one (BRIEF-TALK-1A 1); the brain is woken too, for his first question.
 */
export function listenNow(): void {
  if (conversation) return;
  micNote = '';
  endedNote = false;
  conversation = true;
  quiet = 0;
  paintTalk();
  primeSpeech();
  // (not for a conversation kept on this phone: nothing of it goes to the brain, not even a hello)
  if (settings.get().offlineBrain !== 'always' && !hereNext) void brain.status().catch(() => undefined);
  const mic = document.querySelector('#mic');
  mic?.classList.add('on');
  void voiceTurn(++convoId).finally(() => document.querySelector('#mic')?.classList.toggle('on', conversation));
}

/**
 * [reader] A conversation that starts by waiting while I speak (LISTEN on a book, which holds the microphone itself in the tap
 * that started it): talked over, I stop and listen, and what he says is a turn like any other ("go on" reads on, a question is
 * answered, "that's all" ends it with where we are).
 */
function converseAfterSpeech(): void {
  if (conversation) return;
  conversation = true;
  quiet = 0;
  document.querySelector('#mic')?.classList.add('on');
  void voiceTurn(++convoId, true).finally(() => document.querySelector('#mic')?.classList.toggle('on', conversation));
}
talkHooks.converse = converseAfterSpeech;
talkHooks.end = () => conversation && endConversation();
talkHooks.live = () => conversation;

/** Resolves the moment Ghosty is neither speaking nor thinking (his reply has ended), or the conversation is over. */
function untilFree(live: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const free = () => !live() || (ui.get().voice !== 'speaking' && !ui.get().busy);
    if (free()) return resolve();
    const off = ui.subscribe(() => {
      if (!free()) return;
      off();
      resolve();
    });
  });
}

/** The voice conversation is over (quiet, or something went wrong): the microphone off, its button and the state line say so. */
function endConversation(): void {
  conversation = false;
  holdMic(false);
  document.querySelector('#mic')?.classList.remove('on');
  ui.set({}); // repaints the state line: no longer READY
  paintTalk();
}

/** A link to one of Ghosty's own pictures (made, or shared from the Lens): shown as the picture itself. */
const PICTURE = new RegExp(`^${location.origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/i/[A-Za-z0-9_-]{16}$`);

/** Text with its web links made tappable (built as nodes: text can never become HTML); a picture link becomes the picture. */
function linked(text: string): HTMLElement {
  const out = h('span');
  let last = 0;
  for (const m of text.matchAll(/https?:\/\/[^\s<>"')\]]+[^\s<>"')\].,;:!?]/g)) {
    out.append(text.slice(last, m.index));
    if (PICTURE.test(m[0])) {
      const pic = m[0];
      out.append(h('a.piccard', { href: pic, target: '_blank', rel: 'noopener noreferrer' }, h('img', { src: pic, alt: 'picture Ghosty made', loading: 'lazy' })));
      // EDIT IT (BRIEF-EDITOR-PHOTO): the picture opens in the photo editor, kept on this phone untouched
      const edit = button('EDIT IT', () => void import('../../commands/registry').then(({ run }) => run('open_photo', { picture: pic })), 'piceditit');
      edit.setAttribute('aria-label', 'Edit this picture in the photo editor');
      out.append(edit);
    }
    else out.append(h('a', { href: m[0], target: '_blank', rel: 'noopener noreferrer' }, m[0]));
    last = m.index! + m[0].length;
  }
  out.append(text.slice(last));
  return out;
}

const COPY = '<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7.5a2 2 0 002 2h2.5"/>';
const LISTEN = '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11"/>';

/**
 * LISTEN: the reply read aloud, all of it; tapped while Ghosty is speaking (this reply or any other), it stops
 * instead — the one way to stop the voice from the chat, where a tap on the reactor cannot reach.
 */
function listenTap(b: HTMLElement, text: () => string): void {
  if (interrupt('tap')) return;
  b.classList.add('on');
  b.setAttribute('aria-label', 'Stop reading aloud');
  void speak(text())
    .catch(() => undefined)
    .finally(() => {
      b.classList.remove('on');
      b.setAttribute('aria-label', 'Read the reply aloud');
    });
}

const SHARE = '<path d="M12 15V4M8 7.5l4-4 4 4M5 12v6.5A1.5 1.5 0 006.5 20h11a1.5 1.5 0 001.5-1.5V12"/>';
/** A reply as plain words with its sources' addresses (a sourced one without its list and check line: they are said under the words). */
const plainOf = (text: string, cited?: CitedInfo): string => shareText(cited ? citedBody(text) : text, cited?.citations);
const copyWords = (words: string): void => void navigator.clipboard?.writeText(words).then(() => toast(COPIED, 'ok'), () => toast(COPY_FAILED, 'warn'));

/** Under a reply: copy it as plain words, share it when the phone can, or hear it read aloud. */
function replyActs(text: string, cited?: CitedInfo): HTMLElement {
  const copy = h('button.msgact', { type: 'button', 'aria-label': 'Copy the reply', title: 'Copy' }, icon(COPY));
  copy.addEventListener('click', () => copyWords(plainOf(text, cited)));
  const hear = h('button.msgact', { type: 'button', 'aria-label': 'Read the reply aloud', title: 'Listen' }, icon(LISTEN));
  hear.addEventListener('click', () => listenTap(hear, () => (cited ? citedBody(text) : text)));
  const share = typeof navigator.share === 'function' ? h('button.msgact.shareact', { type: 'button', 'aria-label': 'Share the reply', title: 'Share' }, icon(SHARE)) : null;
  share?.addEventListener('click', () => void navigator.share({ text: plainOf(text, cited) }).catch(() => undefined));
  return h('div.msgacts', copy, share, hear);
}

const TICK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
/**
 * Route C's line over a reply: Ghosty's glyph (MIND in small, ui/instruments.ts), his name and the model that
 * answered (as the brain named it), and CITED when the answer is sourced.
 */
function whoLine(model: string | undefined, cited: boolean, where = ''): HTMLElement {
  return h('div.rcwho', { dataset: { case: 'keep' } }, mindGlyph(), h('b', 'Ghosty'), model || where ? h('em', ` · ${model || where}`) : null,
    cited ? h('span.rccited', icon(TICK), 'CITED') : null);
}

/**
 * The reply's meta line (BRIEF-IRON-BUILD step 4), only what is known: how long the answer took (from the question's
 * time to the reply's, both stamped on this phone or by the brain), and for a cited answer how many sources were
 * really looked up and how many claims were checked. Nothing when none of it is known.
 */
function metaLine(e: Extract<Entry, { kind: 'assistant' }>, askedAt?: number): HTMLElement | null {
  const took = askedAt && e.at > askedAt && e.at - askedAt < 600_000 ? (e.at - askedAt) / 1000 : null;
  const parts: HTMLElement[] = [];
  if (took != null) parts.push(h('span', h('b', took < 10 ? took.toFixed(1) : String(Math.round(took))), ' s'));
  if (e.cited) {
    const found = e.cited.citations.filter((c) => !c.missing).length;
    parts.push(h('span', h('b', String(found)), found === 1 ? ' source' : ' sources'));
    if (e.cited.checks.length) parts.push(h('span', h('b', String(e.cited.checks.length)), e.cited.checks.length === 1 ? ' claim' : ' claims'));
  }
  return parts.length ? h('div.rcmeta', { dataset: { case: 'keep' } }, ...parts) : null;
}

/** The replies he has opened the rest of (by their time): the log is redrawn as things come in, and an open reply stays open. */
const foldOpen = new Set<number>();
/**
 * A long reply folds past twelve lines (features/core/words.ts foldReply: never in the middle of a sentence) with "The rest" in a 44 pt
 * key. A reply still being written is not folded (it would jump under his eyes); one cut off by the signal is folded like any other.
 */
function replyBody(e: Extract<Entry, { kind: 'assistant' }>): HTMLElement[] {
  const f = turn.get().phase === 'streaming' && chat.get().entries.at(-1) === e ? null : foldReply(e.text);
  if (!f) return videoBody(e.text, linked);
  const open = foldOpen.has(e.at);
  const rest = h('span.foldrest', { hidden: !open }, ' ', ...videoBody(f.rest, linked));
  const k = key(open ? REST_SHUT : REST_OPEN, (b) => {
    const now = rest.hidden;
    rest.hidden = !now;
    if (now) foldOpen.add(e.at);
    else foldOpen.delete(e.at);
    b.querySelector('span')!.textContent = now ? REST_SHUT : REST_OPEN;
    b.setAttribute('aria-expanded', String(now));
  }, { kind: 'ghost', label: open ? 'Show less of the reply' : 'Show the rest of the reply' });
  k.classList.add('foldkey');
  k.setAttribute('aria-expanded', String(open));
  return [...videoBody(f.head, linked), rest, h('div.foldrow', { dataset: { state: 'folded' } }, k)];
}

/** An ordinary reply: from the phone (a quiet chip says so), cited, or plain. */
function plainReply(e: Extract<Entry, { kind: 'assistant' }>, askedAt?: number): HTMLElement {
  // A translation made on the phone with no signal: the language and "rough, offline", the translation, READ ALOUD in
  // that language's voice when the phone has one, and the honest note.
  if (e.offline && e.tr) {
    const to = e.tr.to;
    const name = languageName(to);
    const text = e.text;
    const read = voiceIn(to) ? button('READ ALOUD', () => void speakIn(text, to), 'readaloud') : h('span.note.novoice', { dataset: { case: 'keep' } }, `No ${name} voice on this phone to read it aloud`);
    return h('div.msg.off.tr', whoLine(undefined, false, 'on your phone'), h('small', `GHOSTY · ${name.toUpperCase()}`), h('b.trhead', `${name} · rough, offline`), h('div.trtext', { lang: to, dir: to === 'ar' || to === 'ur' || to === 'fa' ? 'rtl' : 'auto' }, text || '…'), text ? h('div.row.wrap.tracts', read) : null, h('span.offchip', OFFLINE_TRANSLATION_NOTE));
  }
  // Answered by the small model on the phone itself: one quiet chip says so. [offline2] Answered FIRST on it (its kind
  // trusted, offline/trust.ts): "on this phone", and the grade that earned it.
  if (e.offline && e.first) return h('div.msg.off.first', whoLine(undefined, false, 'on this phone'), h('small', 'GHOSTY'), linked(e.text || '…'), h('span.offchip', `On this phone: ${CAT_WORDS[e.first.cat].short} passed at ${e.first.pct}% on ${e.first.items} questions`));
  if (e.offline) return h('div.msg.off', whoLine(undefined, false, 'on your phone'), h('small', 'GHOSTY'), linked(e.text || '…'), h('span.offchip', 'Answered on your phone (offline)'));
  // A cited answer: chips for its sources, the list under it, and how many claims the sources back.
  if (e.cited) return h('div.msg.cited', whoLine(e.model, true), h('small', `GHOSTY${e.model ? ` · ${e.model}` : ''}`), metaLine(e, askedAt), ...citedReply(e.text, e.cited, linked));
  // Cut off: the owner interrupted while it was read out.
  return h('div.msg', whoLine(e.model, false), h('small', `GHOSTY${e.model ? ` · ${e.model}` : ''}`), metaLine(e, askedAt), ...replyBody(e), e.cut ? h('span.cutchip', e.carried ? 'Cut off — carried on below' : 'Cut off — you interrupted') : null);
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

/** [offline2] ASK THE CLOUD under an answer the phone gave first (the log's and the reply card's): the same ask to the cloud. */
function askCloudButton(at: number): HTMLButtonElement {
  const b = button('ASK THE CLOUD', () => void askCloud(at), 'askcloud');
  b.setAttribute('aria-label', 'Ask the cloud the same question: it leaves the phone');
  return b;
}

/** `q`: the question this reply answers, when it is the latest answer (it gets THINK HARDER); `askedAt`: when it was asked. */
function renderEntry(e: Entry, q?: string, askedAt?: number): HTMLElement {
  switch (e.kind) {
    case 'user':
      // data-at: the Memory tab's "from your chat" opens the conversation here.
      return h('div.msg.me', { 'data-at': String(e.at) }, h('small', settings.get().name.toUpperCase()), h('span', e.text));
    case 'assistant': {
      if (e.think) return renderThink(e);
      if (e.held) return heldReply();
      const el = plainReply(e, askedAt);
      // [health] what it did was read back: the tick, or RETRY and SHOW ME (verifycard.ts)
      if (e.verify) el.append(verifyRow(e) ?? '');
      // Answered from what he knows of himself ("can you …?"): GO, DO IT, and the offer to learn it (localcard.ts).
      if (e.local) el.append(localRow(e) ?? '');
      // [recall] "like you said on Tuesday": the RECALL chip opens that turn (features/memory/recallcard.ts)
      else el.append(recallChip(e.text, e.at) ?? '');
      // A website built on the phone: PREVIEW / SAVE FILE / PUBLISH (sitecard.ts).
      if (e.site) el.append(siteRow(e.site));
      // [offline2] answered FIRST on this phone: ASK THE CLOUD, one tap; tapped, it stays above the cloud's answer, struck faintly
      if (e.first) {
        if (e.struck) el.classList.add('struck');
        else if (e.text && ui.get().connected !== false) el.append(h('div.row.askrow', askCloudButton(e.at)));
      }
      // Route C: the reply card's one row — 👍 / 👎, copy, listen, then THINK HARDER on the right.
      const acts = h('div.rcacts');
      // 👍 / 👎: what the offline brain's weekly training learns from (rate.ts).
      if (rateable(e)) acts.append(rateRow(e));
      if (e.text && !e.offline) acts.append(replyActs(e.text, e.cited));
      // WHY (OWNER-ISSUES 67d): what ran for this reply and why, from the chat's own trail (why.ts); a long press too
      if (!e.local) {
        (acts.querySelector('.msgacts') ?? acts).append(whyButton(e.at));
        holdForWhy(el, e.at);
      }
      if (q) acts.append(h('div.row.thinkrow', button('THINK HARDER', () => void thinkHarderAbout(q), 'thinkbtn')));
      if (acts.childElementCount) el.append(acts);
      return el;
    }
    case 'home':
      // a plan drawn from the owner's words: OPEN IN SPACE / SEE IN 3-D (homecard.ts)
      return homeCard(e);
    case 'card':
      // a live card (cards.ts): a place, a car, a person, a number, a piece of the day
      return cardEl(e.card);
    case 'link':
      return h('a.sitelink', { href: e.url, target: '_blank', rel: 'noopener noreferrer' }, h('small', 'LIVE · TAP TO OPEN'), h('b', e.title), h('span', e.url.replace(/^https?:\/\//, '')));
    case 'activity': {
      // done: "Saving to memory" reads "Saved to memory"
      const label = e.state === 'ok' ? e.label.replace(/^Saving to /, 'Saved to ') : e.label;
      const el = h(`div.act.${e.state}` as 'div', h('i'), h('span', label), e.detail ? h('em', e.detail) : null);
      // saved to memory: the reply says "Remembered ✓" instead of a row of its own
      if (/ to memory$/.test(label)) el.classList.add('memact');
      // What the tool is doing right now, under its line, with a thin bar when it knows how far it is.
      if (e.progress && e.state === 'running') {
        const ratio = progressRatio(e.progress);
        el.classList.add('live');
        el.append(h('div.prog', h('span', progressText(e.progress)), ratio === null ? null : h('div.pbar', h('b', { style: { width: `${Math.round(ratio * 100)}%` } }))));
      }
      return el;
    }
    case 'error': {
      if (e.cool) {
        // [talk] every model cooling down (BRIEF-TALK-1A 5): said with the time; ASK MY PHONE while the wait is on and the phone's brain is awake
        const cool = h('div.msg.cool', h('small', 'COOLING DOWN'), h('span', e.text));
        if (e.cool.ask && ui.get().busy) {
          const b = button('ASK MY PHONE', () => void askPhone(e.cool!.ask!), 'askphone');
          b.title = 'End the wait: the brain on your phone answers this now';
          cool.append(h('div.row', b));
        }
        return cool;
      }
      /* state: core.ask error */
      /* state: core.turn error */
      const box = h('div.msg.err', { dataset: { state: e.note ? 'empty' : 'error' } }, h('small', e.note ? NO_PICTURE_LABEL : e.lost ? CUT_LABEL : e.ask ? 'KEPT ON THIS PHONE' : 'I COULDN’T'), h('span', e.text));
      // A send that did not land: his words are still his; one tap sends them again (HOMEPASS: the ask bar's failed send)
      if (e.retry) {
        const again = button('RETRY', () => void send(e.retry!, { speak: settings.get().speak }), 'retry');
        again.dataset.case = 'keep';
        box.append(h('div.row', again));
      }
      // A task kept on the phone that the phone could not do: the brain only by this tap, while it can be reached (OWNER-ISSUES 72).
      if (e.ask && ui.get().connected) {
        const ask = button('ASK THE BIG BRAIN', () => void askBigBrain(e.ask!), 'bigbrain');
        ask.title = 'Send this message to my big brain: it leaves the phone';
        box.append(h('div.row', ask));
      }
      return box;
    }
    case 'approval': {
      // the exact thing asked, in words, above the two keys (and for a screen reader on each key)
      const aw = argWords(e.args);
      const thing = `${toolWords(e.name, e.args).replace(/[.:\s]+$/, '')}${aw ? ` (${aw})` : ''}`;
      const box = h('div.approval', { dataset: { state: e.state } }, h('small', 'NEEDS YOUR APPROVAL'), h('b', e.reason), h('span.note.apthing', approvalAsk(thing)));
      if (e.state === 'waiting') {
        // [security] A FEW SECONDS TO TAKE IT BACK (security.u5): a send, a post, a payment or a publish counts down first
        const keys = h('div.row');
        const ask = () => {
          const yes = button('APPROVE', () => {
            if (!takesBack(e.name)) return void answerApproval(e.id, true);
            startTakeBack(e.id, () => void answerApproval(e.id, true));
            counting();
          }, 'on');
          const no = button('DECLINE', () => void answerApproval(e.id, false), 'warn');
          yes.setAttribute('aria-label', `Approve: ${thing}`);
          no.setAttribute('aria-label', `Decline: ${thing}`);
          for (const b of [yes, no]) b.classList.add('apkey');
          box.dataset.takeback = '';
          keys.replaceChildren(yes, no);
        };
        const counting = () => {
          const left = takeBackLeft(e.id);
          if (left == null) return ask();
          const words = h('span.note.aptakeback', takeBackWords(left));
          const back = button('TAKE IT BACK', () => {
            cancelTakeBack(e.id);
            ask();
          }, 'warn');
          back.classList.add('apkey', 'apback');
          back.setAttribute('aria-label', `Take it back: ${thing}`);
          box.dataset.takeback = 'counting';
          keys.replaceChildren(words, back);
          const tick = setInterval(() => {
            const s = takeBackLeft(e.id);
            if (s == null || !box.isConnected) return clearInterval(tick);
            words.textContent = takeBackWords(s);
          }, 250);
        };
        if (takeBackLeft(e.id) != null) counting();
        else ask();
        box.append(keys);
      } else box.append(h('span.note', approvalDone(e.state === 'approved', e.via)));
      return box;
    }
  }
}

/** What Home says it is (BRIEF-AWARENESS): the screen and my last words, so "that" has something to mean here; the stamp says "Looking at Home". */
let scanHud: ScanHome | null = null;
let inkHud: InkHome | null = null;
let mapHud: MapHome | null = null;
let eyeHud: EyeHome | null = null;
let orbitHud: OrbitHome | null = null;
let grownHud: GrownHome | null = null;
function homeContext(): ScreenContext {
  const live = chat.get().live.replace(/\s+/g, ' ').trim();
  // THE SCAN's Home says where he is (a word and a saved place's name, decided on the phone: scan/place.ts), never a coordinate
  const where = scanHud && document.body.classList.contains('scanhome') ? scanHud.placeWords() : '';
  return { screen: 'core', title: 'Home', line: `the home screen${where ? `, ${where}` : ''}${live ? `, my last words: “${live.slice(0, 90)}${live.length > 90 ? '…' : ''}”` : ', the chat with me'}`, looking: 'Home', at: Date.now() };
}

export const coreTab: TabDef = {
  id: 'core',
  title: 'CORE',
  icon: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  scene: 'backdrop',
  blurb: 'talk to Ghosty · arc reactor HUD',
  now() {
    const c = ui.get().connected;
    const ms = stopwatch.lastTrip();
    return c == null ? '' : c ? `Online${ms != null ? ` · ${ms} ms` : ''}` : 'Offline';
  },
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
    /** `glance`: the row's own wording when it must keep its case (a unit like °F; the row shows in sentence case). */
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
    // The field is narrow (its buttons sit inside it): a short invitation.
    const input = h('input#cin', { placeholder: 'Talk to me', autocomplete: 'off', enterKeyHint: 'send', 'aria-label': 'Message Ghosty' });
    // (taking the box wakes the voices, so the reply's first word is not the slow one: BRIEF-TALK-1A 1)
    input.addEventListener('focus', () => primeSpeech());
    const submit = () => {
      const t = input.value.trim();
      if (!t) return input.focus(); // nothing typed yet: open the keyboard rather than doing nothing
      input.value = '';
      void send(t, { speak: settings.get().speak, here: takeHere() });
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
      paintTalk();
    });
    mic.addEventListener('click', () => {
      // Ghosty is talking: the tap cuts in and it listens (a conversation's loop listens next by itself).
      if (interrupt('tap') && conversation) return;
      if (conversation) {
        conversation = false;
        holdMic(false);
        stopListening();
        mic.classList.remove('on');
        paintTalk();
        // [reader] the microphone let go just after he stopped a book: where we are, said once ("Page 48. I'll carry on from here.")
        void import('../library/reader').then((r) => r.micLetGo()).catch(() => undefined);
        return;
      }
      listenNow();
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
    // ON THIS PHONE: a small toggle by the microphone (hereNext above); the field says so while it is on. Hidden with the
    // offline brain on "always" (every message stays on the phone then, and the field says that instead).
    const hereBtn = h('button.herebtn', { type: 'button', 'aria-pressed': 'false', 'aria-label': 'On this phone only: my offline brain answers the next message, and nothing of it leaves the phone' });
    hereBtn.addEventListener('click', () => {
      hereNext = !hereNext;
      paintHere();
    });
    paintHere = () => {
      const always = settings.get().offlineBrain === 'always';
      hereBtn.hidden = always;
      hereBtn.classList.toggle('on', hereNext);
      hereBtn.setAttribute('aria-pressed', String(hereNext));
      input.placeholder = hereNext || always ? 'Ask on this phone only' : 'Talk to me';
    };
    paintHere();
    settings.subscribe((s, prev) => s.offlineBrain !== prev.offlineBrain && paintHere());
    const voiceBtn = button(settings.get().speak ? 'VOICE ON' : 'VOICE OFF', (b) => {
      settings.set({ speak: !settings.get().speak });
      b.textContent = settings.get().speak ? 'VOICE ON' : 'VOICE OFF';
    });
    const convo = panel('CONVERSATION', { status: '' });
    convo.body.append(log);
    convo.el.classList.add('convo');
    // The conversation's one way in and out: the ask bar's chat button, "Continue in chat" on a reply, and "‹ Ask"
    // once open. Tests know it as .logbtn.
    const logBtn = button('LOG', () => setChat(!hud.classList.contains('logopen')), 'logbtn');
    const setChat = (open: boolean) => {
      hud.classList.toggle('logopen', open);
      logBtn.classList.toggle('on', open);
      if (open) log.scrollTop = log.scrollHeight;
      if (open) pushScreen({ back: 'Ask', label: 'Chat', ownBack: true, pop: () => setChat(false) });
      else popScreen();
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
    // A lock-screen glance (date and time above the reactor; the weather and what is next under it) and a "+"
    // that holds voice replies and the camera.
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
    // (false until the agenda has answered once: the readout ribbon says "—" for it, not "nothing next", till then)
    let nextKnown = false;
    // Two or three things to ask for, under the reactor.
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
    // (CITED sits in the bar itself: the composer shows it as a toggle beside the field)
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
    // Today card and the two tiles.
    // THE ORB SAYS WHAT IT IS (orbsay.ts): the first listening, thinking, speaking; the brain gone; the models cooling; the first press
    const orbsay = orbSay();
    const rwrap = h('div.rwrap', reactor.el, orbsay.el);
    // [further] a long hold on the orb opens MIND AS A MAP: what he knows, laid out by subject (features/further/mindmap.ts)
    holdOrb(rwrap);
    const rc = routeCHome(rwrap);
    // [cards] HOME AS HIS WALL (wall.ts): the live cards in order of what matters now, above Home's own cards
    const wall = wallView();
    rc.below.prepend(wall.el);
    // THE STAMP LINE (BRIEF-SHELL pass 1; OWNER-ISSUES 149): Home's own, at the top, in the Machine's marks: the day, the time, his saved
    // place, the feeds watched (the one source, shell/awareness.ts stampFacts) and what is on screen (LOOKING AT HOME), the same
    // component the reader and THE LOOK use. The boot's own line becomes it at the landing (shell/boot.ts, styles.css `bootwait`).
    const stamp = stampLine(() => stampFacts(lookingAt(homeContext())));
    stamp.el.classList.add('hstamp');
    guardian.subscribe(() => stamp.refresh());
    // THE TALK BAR'S WORDS (assistant/words.ts): what the microphone and the voice are doing, in a line that reads without the animation,
    // and STOP while I speak. Hidden when nothing is going on.
    const talkStop = key('STOP', () => void interrupt('tap'), { kind: 'line', label: 'Stop me talking' });
    const talkSay = h('span.tlsay');
    const talkline = h('div#talkline', { role: 'status', 'aria-live': 'polite', hidden: true, dataset: { case: 'keep', state: 'idle' } }, talkSay, talkStop);
    let listenSince = 0;
    let liveAtListen = '';
    let cutNote = false;
    let cutAt = 0;
    let quietTimer = 0;
    paintTalk = () => {
      const u = ui.get();
      const live = chat.get().live;
      const heard = u.voice === 'listening' && live.trim() !== '' && live !== liveAtListen;
      // (the cut-in note stays through the moment between his voice cutting me off and the ear opening; it goes with his words or the next thing I say)
      if (heard || u.voice === 'thinking' || (u.voice === 'speaking' && Date.now() - cutAt > 600)) cutNote = false;
      // (a typed turn thinking is the turn line's to say; the talk bar speaks of the voice conversation only)
      const voice = u.voice === 'thinking' && !conversation ? 'idle' : u.voice;
      const st = talkState({ voice, heard, quietFor: u.voice === 'listening' ? Date.now() - listenSince : 0, cut: cutNote, refused: micNote, ended: endedNote });
      /* state: core.talk error */
      /* state: core.talk offline */
      const words = st === 'refused' ? micNote : TALK_WORDS[st];
      talkline.hidden = !words;
      talkline.dataset.state = st;
      if (talkSay.textContent !== words) talkSay.textContent = words;
      talkStop.hidden = st !== 'speaking';
      const on = u.voice === 'listening' || conversation;
      mic.setAttribute('aria-pressed', String(on));
      mic.setAttribute('aria-label', on ? 'Stop listening' : 'Talk by voice');
    };
    ui.subscribe((u, prev) => {
      if (u.voice === 'listening' && prev.voice !== 'listening') {
        /* state: core.talk loading */
        liveAtListen = chat.get().live;
        listenSince = Date.now();
        clearTimeout(quietTimer);
        quietTimer = window.setTimeout(paintTalk, STILL_LISTENING_MS + 60);
      }
      if (u.voice !== prev.voice) paintTalk();
    });
    chat.subscribe(() => paintTalk());
    onCutOff((c) => {
      if (c.how === 'voice') {
        cutNote = true;
        cutAt = Date.now();
      }
      paintTalk();
    });
    const cbar = h('div#cbar', plus, logBtn, input, button('SEND', submit, 'sendbtn'), plusMenu, citedBtn, hereBtn, mic);
    const center = h('div.ccenter', stamp.el, stark.el, lock, rc.wx, rc.hero, lockLine, stateLabel, glance, caption, rc.below, suggest, voiceTag(), talkline, cbar);
    // the date line sits in the navigation bar, beside search and the avatar (shown on the reactor screen only)
    setTimeout(() => document.querySelector('#top')?.prepend(rc.date), 0);
    caption.append(capActs);
    // Where the conversation button is (one at a time): "‹ Ask" in the navigation bar while the conversation is open,
    // "Continue in chat" on a reply, else the ask bar's chat button.
    const placeChat = () => {
      const top = document.querySelector('#top');
      const replying = !!chat.get().live && !caption.classList.contains('fade');
      center.classList.toggle('replying', replying && !hud.classList.contains('logopen'));
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
    // Touch the reactor: it answers with a pulse.
    reactor.el.addEventListener('pointerdown', (e) => reactor.poke(e));
    reactor.onPress = () => orbsay.pressed(recipe().world);
    hud.append(rc.glowBox, left, center, right);
    // THE SCAN's Home (BRIEF-HUD-SCAN-1; scan/home.ts): the whole of it with the room inside, drawn when THE LOOK's world is The Scan.
    // Its frame takes the stamp line, the latest reply's line, the orb's wrap and the ask line as they are (one of each on Home).
    scanHud = scanHome({ orbWrap: rwrap, stamp: stamp.el, caption, ask: cbar, next: () => (nextKnown ? nextUp : null), onBack: () => reactor.poke() });
    hud.append(scanHud.el);
    // ONE INK's Home (BRIEF-ONE-INK; ink/home.ts): the printed page, drawn when THE LOOK's world is One Ink; it takes the stamp line and the
    // orb's wrap as they are, reads the caption, and gives them back when the look is another (one of each on Home)
    inkHud = inkHome({ orbWrap: rwrap, stamp: stamp.el, caption, mic: () => mic.click(), nextUp: () => nextUp, next: () => (nextKnown ? nextUp : null), onBack: () => reactor.poke() });
    hud.append(inkHud.el);
    // THE MAP's Home (BRIEF-MAP-EYE-HUDS; map/home.ts): the plane, the districts and the square of nine, drawn when THE LOOK's world is The Map;
    // it takes the stamp line and the orb's wrap as they are and gives them back when the look is another
    mapHud = mapHome({ orbWrap: rwrap, stamp: stamp.el, caption, mic: () => mic.click(), nextUp: () => nextUp, onBack: () => reactor.poke() });
    hud.append(mapHud.el);
    // THE EYE's Home (BRIEF-EYE-HUD; eye/home.ts): the wall of feeds, one sharp, over God's Eye's globe in grain, drawn when THE LOOK's world is The Eye;
    // it takes the stamp line and the orb's wrap as they are and gives them back when the look is another
    eyeHud = eyeHome({ orbWrap: rwrap, stamp: stamp.el, caption, mic: () => mic.click(), nextUp: () => nextUp, onBack: () => reactor.poke() });
    hud.append(eyeHud.el);
    // ORBIT's Home (BRIEF-ORBIT-HUD; orbit/home.ts): the orb at the centre of its sky with the six rooms on a ring round it; it takes the
    // stamp line and the orb's wrap as they are, reads the caption, and gives them back when the look is another (one of each on Home)
    orbitHud = orbitHome({ orbWrap: rwrap, stamp: stamp.el, caption, nextUp: () => nextUp, onBack: () => reactor.poke() });
    hud.append(orbitHud.el);
    // GROWN UP's Home (BRIEF-GROWN-UP-HUD; grown/home.ts): the orb with its one ring, the hour's card and one row of chips; it takes the stamp line and
    // the orb's wrap as they are, reads the caption, and gives them back when the look is another (one of each on Home)
    grownHud = grownHome({ orbWrap: rwrap, stamp: stamp.el, caption, nextUp: () => nextUp });
    hud.append(grownHud.el);
    const scanWanted = () => recipe().world === 'scan';
    const inkWanted = () => recipe().world === 'ink';
    const orbitWanted = () => recipe().world === 'orbit';
    const grownWanted = () => recipe().world === 'grown';
    hud.classList.toggle('scan', scanWanted());
    hud.classList.toggle('ink', inkWanted());
    hud.classList.toggle('orbit', orbitWanted());
    hud.classList.toggle('grown', grownWanted());
    recipeEvents.on('change', () => {
      const on = scanWanted();
      hud.classList.toggle('scan', on);
      hud.classList.toggle('ink', inkWanted());
      hud.classList.toggle('orbit', orbitWanted());
      hud.classList.toggle('grown', grownWanted());
      if (ui.get().tab !== 'core') return;
      // (one look gives the parts back before the next takes them)
      if (on) {
        inkHud?.leave();
        mapHud?.leave();
        eyeHud?.leave();
        orbitHud?.leave();
        grownHud?.leave();
        scanHud?.enter();
      } else {
        scanHud?.leave();
        if (inkWanted()) {
          mapHud?.leave();
          eyeHud?.leave();
          orbitHud?.leave();
          grownHud?.leave();
          inkHud?.enter();
        } else {
          inkHud?.leave();
          const w = recipe().world;
          if (w !== 'map') mapHud?.leave();
          if (w !== 'eye') eyeHud?.leave();
          if (w !== 'orbit') orbitHud?.leave();
          if (w !== 'grown') grownHud?.leave();
          if (w === 'map') mapHud?.enter();
          else if (w === 'eye') eyeHud?.enter();
          else if (orbitWanted()) orbitHud?.enter();
          else if (grownWanted()) grownHud?.enter();
        }
      }
    });
    root.append(hud);
    // [reste] A file dropped on the chat goes to the converter (convert/sheet.ts), on this phone; nothing is sent.
    root.addEventListener('dragover', (e) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    });
    root.addEventListener('drop', (e) => {
      const files = [...(e.dataTransfer?.files ?? [])];
      if (!files.length) return;
      e.preventDefault();
      // [video] "cut this video": a clip dropped on the chat opens the video editor with it in (video/screen.ts); the rest go to the converter
      void import('../../video/screen').then((v) => {
        const clips = files.filter(v.isVideoFile);
        if (clips.length === files.length) return void v.openVideo(clips);
        void import('../../convert/sheet').then((s) => s.openConvert(files.filter((f) => !v.isVideoFile(f))));
        if (clips.length) void v.openVideo(clips);
      });
    });

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
    capCopy.addEventListener('click', () => copyWords(chat.get().live));
    const capHear = h('button.msgact', { type: 'button', 'aria-label': 'Read the reply aloud', title: 'Listen' }, icon(LISTEN));
    capHear.addEventListener('click', () => listenTap(capHear, () => chat.get().live));
    capActs.append(capCopy, capHear);
    // [lifeeasier] under "teach me what you learned this week" the speaker is named for what it does there (the chat's own READ IT TO ME is under the answer)
    chat.subscribe((st) => {
      const lastReply = st.entries.findLast((x) => x.kind === 'assistant');
      const named = lastReply?.kind === 'assistant' && !!lastReply.local?.read;
      capHear.setAttribute('aria-label', named ? 'Read it to me' : 'Read the reply aloud');
      capHear.title = named ? 'Read it to me' : 'Listen';
    });
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
      // with his voice reading the reply, the words are on screen the moment they are his to hear: the voice is the pace, and
      // the caption is never behind it (the typing-in is for a reply read in silence; a frame-starved screen would make it late)
      if (settings.get().speak) {
        span.textContent = shownLive = text;
        return;
      }
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
    let lastSent = -1;
    let lastSig = '';
    let unseen = false;
    /** The key that brings him to the newest message, shown only while something landed that he has not seen. */
    const newest = key(NEWEST, () => {
      log.scrollTop = log.scrollHeight;
      unseen = false;
      newest.remove();
    }, { kind: 'fill', label: NEWEST_LABEL });
    newest.classList.add('newestkey');
    log.addEventListener('scroll', () => {
      if (unseen && log.scrollHeight - log.scrollTop - log.clientHeight < 80) {
        unseen = false;
        newest.remove();
      }
    }, { passive: true });
    /** The first open: his name, what to do in one sentence, and three things he can say (each one a key that sends it). */
    const firstOpen = (): HTMLElement => {
      /* state: core.log empty */
      /* state: core.log offline */
      const offline = ui.get().connected === false || navigator.onLine === false;
      const tries = (offline ? FIRST_OPEN.offlineTries : FIRST_OPEN.tries).map((t) => key(t, () => void send(t, { speak: settings.get().speak, here: takeHere() }), { kind: 'line', label: `Ask: ${t}` }));
      return h('div.logfirst', { dataset: { state: 'empty' } }, h('p.note.logidle', `Here, ${settings.get().name.trim() || 'Boss'}.`), h('p.logsay', offline ? FIRST_OPEN.offlineSay : FIRST_OPEN.say), h('div.logtries', ...tries));
    };
    /** The one line under his words while a turn is at work (and, once he stops it, where it stays): its phase and the narration's own words. */
    const paintTurn = () => {
      const words = turnWords(turn.get().phase, ui.get().status);
      let el = log.querySelector<HTMLElement>(':scope > .turnline');
      if (!words) el?.remove();
      else {
        /* state: core.turn loading */
        const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
        if (!el) el = h('p.turnline', { role: 'status', 'aria-live': 'polite', dataset: { case: 'keep', state: 'loading' } });
        el.dataset.phase = turn.get().phase;
        if (el.textContent !== words) el.textContent = words;
        if (log.lastElementChild !== el) log.append(el);
        if (atEnd) log.scrollTop = log.scrollHeight;
      }
      if (unseen) log.append(newest);
      else newest.remove();
    };
    // [ci] The line is painted on the next frame, once, however many times the turn moves before it: painting it there and then
    // read the log's height straight after a change (a forced layout) inside the brain's event, before the reply was handed to the
    // voice, and so delayed his first spoken word (FINAL-CI 1). The frame comes before anything is drawn, so nothing flickers.
    let turnFrame = 0;
    const paintTurnSoon = () => {
      if (!turnFrame) turnFrame = requestAnimationFrame(() => ((turnFrame = 0), paintTurn()));
    };
    const paintLog = () => {
      // a plan card goes under the reply it came with (homecard.ts)
      const shown = homeAfterReply(chat.get().entries.slice(-40));
      // Reading back up the conversation, a reply coming in leaves him where he is: the log follows its end only when
      // he is already there, or when he has just sent a message of his own.
      const atEnd = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
      const mine = shown.findLast((x) => x.kind === 'user');
      const sent = mine?.kind === 'user' ? mine.at : 0;
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
      // when the question a reply answers was asked (its meta line's time)
      let askedAt = 0;
      shown.forEach((e, i) => {
        const at = 'at' in e ? e.at : 0;
        if (e.kind === 'user') askedAt = e.at;
        if (at) {
          const d = new Date(at);
          const k = d.toDateString();
          if (k !== day) {
            flush();
            day = k;
            // "Today 18:31", "Yesterday 09:05", "Monday 07:40": the day as he says it (words.ts), and the time of its first message
            els.push(h('div.daysep', `${dayWords(at)} ${fmt.time(d)}`));
          }
        }
        if (e.kind === 'activity') {
          run ??= { acts: [], rows: [] };
          run.acts.push(e);
          run.rows.push(renderEntry(e));
          return;
        }
        flush();
        els.push(renderEntry(e, i === last ? q : undefined, e.kind === 'assistant' ? askedAt || undefined : undefined));
        if (e.kind === 'assistant') askedAt = 0;
      });
      flush();
      // An empty conversation reads as someone already there (OWNER-ISSUES 67a): his name, nothing to choose from.
      if (!els.length) els.push(firstOpen());
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
      // a reply landing while he reads older turns leaves the page where it is, and a "newest" key says there is more
      const sig = `${shown.length}:${shown.at(-1) && 'text' in shown.at(-1)! ? (shown.at(-1) as { text: string }).text.length : 0}`;
      if (atEnd || sent !== lastSent) unseen = false;
      else if (sig !== lastSig) unseen = true;
      lastSig = sig;
      if (atEnd || sent !== lastSent) log.scrollTop = log.scrollHeight;
      lastSent = sent;
      // (the log is itself drawn in a frame now, or for his own words: the line goes back in the same paint, never a frame later)
      cancelAnimationFrame(turnFrame);
      turnFrame = 0;
      paintTurn();
      reveal(chat.get().live);
      paintCapRate();
      armFade();
      // The HUD says what the tool at work is doing right now (the latest report); nothing once it has finished.
      const working = [...chat.get().entries].reverse().find((e): e is Extract<Entry, { kind: 'activity' }> => e.kind === 'activity' && e.state === 'running' && !!e.progress);
      stark.task(working?.progress ? progressText(working.progress) : null);
    };
    const paintCapRate = () => {
      const last = chat.get().entries.at(-1);
      // (done: the turn is over AND the reply has been said. While it is read out the caption keeps no keys: in The Scan the caption
      // lies over the orb, and THAT FELT OFF, beside the thumbs, sat on the orb's centre, so his tap to silence me opened its sheet)
      const done = !!chat.get().live && !ui.get().busy && ui.get().voice !== 'speaking' && last?.kind === 'assistant';
      clear(capRate, ...(done && rateable(last) ? [rateRow(last)] : []),
        // [offline2] the reply card carries ASK THE CLOUD too, under an answer the phone gave first
        ...(done && last.first && !last.struck && last.text && ui.get().connected !== false ? [h('div.row.askrow', askCloudButton(last.at))] : []));
    };
    ui.subscribe((u, prev) => void ((u.busy !== prev.busy || (u.voice === 'speaking') !== (prev.voice === 'speaking')) && paintCapRate()));
    turn.subscribe(paintTurnSoon);
    ui.subscribe((u, prev) => void (u.status !== prev.status && paintTurnSoon()));
    // [ci] What the conversation holds is drawn once a frame: a reply landing moves the conversation two or three times in a row (the
    // reply, its steps settled, the turn's end), and each whole repaint of the log, there and then, held up the clip the voice had
    // just asked for, so his first spoken word came later (FINAL-CI 1). His own words, just sent, are drawn there and then.
    let logFrame = 0;
    chat.subscribe((s) => {
      // (his newest message, even when its answer came in the same breath: the reader and the phone's own answers add both at once;
      // and anything answered on the phone with no turn at work, such as "orbit": its line is there the moment its effect is)
      const newest = s.entries.findLast((e) => e.kind === 'user');
      if ((newest && newest.at !== lastSent) || !ui.get().busy) {
        cancelAnimationFrame(logFrame);
        logFrame = 0;
        paintLog();
      } else if (!logFrame) logFrame = requestAnimationFrame(() => ((logFrame = 0), paintLog()));
    });
    canThink.subscribe(paintLog);
    settings.subscribe((st, prev) => st.offlineBrain !== prev.offlineBrain && paintLog());
    recheckThink();
    ratings.subscribe(paintLog);
    paintLog();
    // (the power-up readouts that ran here are gone: the boot cinematic, shell/boot.ts, shows no status lines)
    const paintState = () => {
      if (!ui.get().busy) stark.task(null); // nothing to show between turns (a tool left running by a broken turn is marked stopped in session.ts, so paintLog never picks it up again)
      const s = ui.get();
      reactor.state = s.busy && s.voice !== 'speaking' ? 'thinking' : s.voice;
      // (one state at a time: speaking, then listening, then the work in hand, then the line; a long status is cut at a word, never in one)
      stateLabel.textContent = s.voice === 'speaking' ? 'SPEAKING' : s.voice === 'listening' ? 'LISTENING' : s.busy ? pillWords(s.status || 'PROCESSING') : s.connected === false ? 'OFFLINE' : conversation ? 'READY' : 'ONLINE';
      stateLabel.dataset.state = s.voice === 'speaking' ? 'speaking' : s.voice === 'listening' ? 'listening' : s.busy ? 'busy' : s.connected === false ? 'offline' : 'ready';
      // route C draws it as a pill: the accent while live, amber when the brain can't be reached
      // the old 2-D stand-in and the flat Mind go low with the brain gone (styles.css canvas.reactor[data-low]); MIND's own grey is mind.ts
      reactor.el.dataset.low = s.connected === false ? '1' : '';
      stateLabel.dataset.tone = s.connected === false && !s.busy && s.voice !== 'speaking' ? 'warn' : 'live';
    };
    ui.subscribe(paintState);
    paintState();
    let glowTick = 0;
    onFrame((dt) => {
      if (ui.get().tab !== 'core') return;
      // the jump bar covers the whole screen while it is open: the reactor and its rings are not drawn behind it (two layout reads and two canvases every
      // frame are the dearest thing the page does while it opens, and its open waits behind them)
      if (jumpOpen()) return;
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
      wall.refresh();
      const lastModel = [...chat.get().entries].reverse().find((e) => e.kind === 'assistant' && e.model);
      const model = lastModel && lastModel.kind === 'assistant' ? lastModel.model ?? '' : '';
      const ms = await latency().catch(() => null);
      note({ id: 'ai', label: 'AI LINK', value: model ? model.replace(/ · /, ' ▸ ').slice(0, 30) : 'STANDING BY', tone: 'ok' });
      /* state: core.hud error */
      /* state: core.hud offline */
      note({ id: 'uplink', label: 'UPLINK', value: ms === null ? (navigator.onLine === false ? CALLOUT.uplinkNoSignal : CALLOUT.uplinkDead) : `${navigator.onLine ? 'SECURE' : 'LOCAL'} · ${ms} MS`, tone: ms === null ? 'bad' : ms > 800 ? 'warn' : 'ok' });
      const w = weather.data;
      const sky = w ? WMO(w.current.weather_code).slice(0, 14) : '';
      note({ id: 'env', label: home().name.toUpperCase().slice(0, 18), value: `${fmt.time(new Date())}${w ? ` · ${temp(w.current.temperature_2m)} ${sky.toUpperCase()}` : ''}`, glance: w ? `${fmt.time(new Date())} · ${temp(w.current.temperature_2m)} ${sky}` : undefined });
      const lv = threatLevel(signals());
      // (CHECKING / CAN'T CHECK, when the feeds cannot be read, is not a green all-clear)
      note({ id: 'threat', label: 'THREAT', value: lv.label, tone: !lv.known ? 'warn' : lv.n >= 2 ? 'bad' : lv.n === 1 ? 'warn' : 'ok' });
      const bat = await (navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> }).getBattery?.().catch(() => null);
      stark.set({ id: 'power', label: 'POWER', value: bat ? `${Math.round(bat.level * 100)}%${bat.charging ? ' · CHARGING' : ''}` : CALLOUT.powerNone, tone: bat && bat.level < 0.15 && !bat.charging ? 'warn' : 'ok' });
      // The library size changes slowly: ask every 5 minutes, not on every 15-second repaint (each ask is database reads).
      if (Date.now() - libAt > 300_000) {
        libAt = Date.now();
        const lib = await brain.library().catch(() => null);
        libText = lib ? `${fmt.n(lib.stats.passages)} PASSAGES` : CALLOUT.libraryDead;
      }
      stark.set({ id: 'library', label: 'LIBRARY', value: libText });
      // What is next today, for the glance under the reactor (asked every 5 minutes, like the library).
      if (Date.now() - nextAt > 300_000) {
        nextAt = Date.now();
        const ag = await brain.agenda(2).catch(() => null);
        const now = Date.now();
        const ev = ag?.events.filter((x) => (x.end ?? x.start) > now).sort((a, b) => a.start - b.start)[0];
        nextUp = ev ? `${ev.title}${ev.allDay ? '' : ` · ${new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}` : '';
        nextKnown = !!ag;
        inkHud?.refresh();
        mapHud?.refresh();
        eyeHud?.refresh();
        orbitHud?.refresh();
        grownHud?.refresh();
        scanHud?.refresh();
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
        if (scanWanted()) scanHud?.enter();
        else if (recipe().world === 'ink') inkHud?.enter();
        else if (recipe().world === 'map') mapHud?.enter();
        else if (recipe().world === 'eye') eyeHud?.enter();
        else if (recipe().world === 'orbit') orbitHud?.enter();
        else if (recipe().world === 'grown') grownHud?.enter();
        // back on the reactor with the conversation still open: the bar says so again
        if (hud.classList.contains('logopen')) setTimeout(() => pushScreen({ back: 'Ask', label: 'Chat', ownBack: true, pop: () => setChat(false) }), 0);
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
        scanHud?.leave();
        inkHud?.leave();
        mapHud?.leave();
        eyeHud?.leave();
        orbitHud?.leave();
        grownHud?.leave();
      },
      describe: () => `Core screen. Last thing said: ${chat.get().live.slice(0, 160)}`,
      // (BRIEF-AWARENESS) the home screen and my last words, so "that" has something to mean here
      context: homeContext,
    };
  },
};
