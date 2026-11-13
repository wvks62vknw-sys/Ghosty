/**
 * REHEARSE (BRIEF-OCT-IDEAS-3 item 7; STARS 168; LEARN): he rehearses a conversation or a talk against Ghosty.
 *  - A CONVERSATION: the situation in his words ("a job interview for a junior mechanic", "telling my landlord about the damp"); I play
 *    the other side, the brain with the Character setting's HOW FIERY dial, one turn at a time; he answers by voice or by text; three
 *    rounds; then NOTES, five lines counted from his own answers (what landed, what to tighten).
 *  - A TALK FOR A MINUTE: he talks for a minute (or types what he would say) and gets back his filler words, his pace and the one line
 *    to cut.
 * Nothing is kept unless he taps KEEP (`ghosty.rehearsals`, on this phone only). The other side is sent to the brain quietly: no chat
 * history, no screen, no place goes with it. Every wait is said; a brain that cannot be reached is said, with TRY AGAIN.
 */
import { sayError } from '../../ui/hisWords';
import { speak, stopSpeaking } from '../../assistant/voice';
import { clear, h } from '../../core/dom';
import { screenSays } from '../../shell/awareness';
import type { TabDef } from '../../shell/tabs';
import { settings } from '../../state/app';
import { button, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { sections } from '../../ui/sections';
import { panel } from '../../ui/components';
import { askWithImage } from '../../vision/ask';
import { canHear, hear, type Ear } from '../../further/interpret';
import { notesOf, promptFor, ROUNDS, talkNotes, TEMPER_WORD, wordCount } from '../../further/rehearse';

export const KEEP_KEY = 'ghosty.rehearsals';
export const REHEARSE_ICON = '<circle cx="8.5" cy="8" r="3"/><circle cx="16.5" cy="9.5" r="2.4"/><path d="M3.5 19c.4-3.2 2.4-5 5-5s4.6 1.8 5 5M14.5 14.4c2.6-.4 4.7 1 5.3 4.1"/>';

/** What a test can read (window.__ghosty.rehearse). */
export const rehearseState = { stage: 'idle' as 'idle' | 'waiting' | 'answering' | 'notes', round: 0, situation: '', talk: [] as { other: string; answer: string }[], notes: [] as string[], kept: 0 };

interface Kept {
  at: number;
  situation: string;
  answers: string[];
  notes: string[];
}
const loadKept = (): Kept[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEEP_KEY) ?? '[]') as Kept[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
};

export const rehearseTab: TabDef = {
  id: 'rehearse',
  title: 'REHEARSE',
  icon: REHEARSE_ICON,
  scene: 'backdrop',
  blurb: 'rehearse a talk or a hard conversation · three rounds, then notes',
  now: () => (rehearseState.stage === 'idle' ? '' : `round ${Math.min(rehearseState.round, ROUNDS)} of ${ROUNDS}`),
  mount(root) {
    const P = page(root, { tag: 'LEARN // REHEARSE', sub: 'Say what it is, and I play the other side: three rounds, then notes on what landed and what to tighten. Nothing is kept unless you tap KEEP.', stack: true });
    root.classList.add('rhpg');
    P.big.dataset.case = 'keep';
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.rehearse = rehearseState;
    P.big.textContent = 'Rehearse';
    const conv = panel('A CONVERSATION', { grow: false, status: 'READY' });
    const talk = panel('A TALK FOR A MINUTE', { grow: false, status: 'READY' });
    P.left.append(conv.el, talk.el);
    P.right.hidden = true;
    (P.big.parentElement?.querySelector('.swap') as HTMLElement | null)?.setAttribute('hidden', '');
    const secs = sections(root, 'rehearse', [
      { id: 'conversation', label: 'Conversation', match: /^A CONVERSATION/ },
      { id: 'talk', label: 'Talk', match: /^A TALK/ },
    ]);

    // ------------------------------------------------------------------------------------------------ A CONVERSATION
    const fire = () => settings.get().persona?.fire ?? 1;
    const situation = h('textarea.fxfield', { name: 'situation', rows: 2, placeholder: 'e.g. a job interview for a junior mechanic, or telling my landlord about the damp', 'aria-label': 'The situation, in your words' }) as HTMLTextAreaElement;
    const temper = h('p.rhnote', '');
    const start = button('START', () => void begin(), 'on');
    start.dataset.act = 'start';
    start.dataset.case = 'keep';
    const lines = h('div.rhlines', { 'aria-live': 'polite' });
    const state = h('p.rhstate', { role: 'status' });
    const answer = h('textarea.fxfield', { name: 'answer', rows: 3, placeholder: 'Your answer: type it, or hold SPEAK', 'aria-label': 'Your answer' }) as HTMLTextAreaElement;
    const send = button('SEND', () => void sendAnswer(), 'on');
    send.dataset.act = 'send';
    send.dataset.case = 'keep';
    const speakKey = h('button.fxkey.rhspeak', { type: 'button', dataset: { act: 'speak', case: 'keep' }, 'aria-label': 'Hold to speak your answer' }, 'HOLD TO SPEAK') as HTMLButtonElement;
    // (a browser that cannot hear: no key that only ever says so)
    if (!canHear()) {
      speakKey.hidden = true;
      answer.placeholder = 'Your answer: type it';
    }
    const answerBox = h('div.rhanswer', answer, h('div.row.wrap', speakKey, send));
    answerBox.hidden = true;
    const notesBox = h('div.rhnotes', { hidden: true });
    const body = h('div.rhconv', h('label.rhlab', 'THE SITUATION', situation), temper, h('div.row.wrap', start), lines, state, answerBox, notesBox);
    conv.body.append(body);
    const paintTemper = () => {
      const f = fire();
      temper.textContent = `I will play the other side ${TEMPER_WORD[f]}, as your Character setting says (how fiery).`;
    };
    paintTemper();
    settings.subscribe(paintTemper);

    const S = rehearseState;
    const paintLines = () => {
      clear(lines);
      for (const t of S.talk) {
        lines.append(h('p.rhline.theirs', h('small', 'THE OTHER SIDE'), t.other));
        if (t.answer) lines.append(h('p.rhline.mine', h('small', 'YOU'), t.answer));
      }
    };
    let busy = false;
    const otherSide = async (): Promise<string> => {
      busy = true;
      S.stage = 'waiting';
      state.textContent = S.round === 1 ? 'The other side is getting ready to start…' : 'The other side is thinking what to say back…';
      conv.setStatus(`ROUND ${S.round} OF ${ROUNDS}`, 'mid');
      const r = await askWithImage(promptFor(S.situation, S.round, S.talk.filter((t) => t.answer), fire()), null, undefined, { quiet: true, bare: true });
      busy = false;
      const said = r.text.replace(/^(?:the )?other (?:side|person)\s*:\s*/i, '').trim();
      if (!said) throw new Error(r.error ? 'I can’t reach my brain to play the other side just now.' : 'I got nothing back to play the other side with.');
      return said;
    };
    const turn = async () => {
      answerBox.hidden = true;
      try {
        const said = await otherSide();
        S.talk.push({ other: said, answer: '' });
        paintLines();
        S.stage = 'answering';
        state.textContent = `Round ${S.round} of ${ROUNDS}: your turn. Answer by typing${canHear() ? ', or hold SPEAK' : ''}.`;
        answerBox.hidden = false;
        answer.value = '';
        answer.focus({ preventScroll: true });
        if (settings.get().speak) void speak(said, { here: true }).catch(() => undefined);
      } catch (e) {
        S.stage = 'idle';
        state.textContent = '';
        clear(state, h('span', `${sayError(e, 'play the other side')} `), button('TRY AGAIN', () => void turn()));
        conv.setStatus('NOT REACHED', 'off');
      }
    };
    async function begin(): Promise<void> {
      if (busy) return;
      const s = situation.value.trim();
      if (!s) {
        state.textContent = 'Say what it is first: a job interview, telling your landlord about the damp, asking for a day off.';
        situation.focus();
        return;
      }
      stopSpeaking();
      Object.assign(S, { situation: s, round: 1, talk: [], notes: [], stage: 'waiting' });
      notesBox.hidden = true;
      clear(notesBox);
      paintLines();
      start.textContent = 'START AGAIN';
      await turn();
    }
    async function sendAnswer(): Promise<void> {
      const a = answer.value.trim();
      if (!a || busy || S.stage !== 'answering') return;
      S.talk[S.talk.length - 1]!.answer = a;
      paintLines();
      answerBox.hidden = true;
      if (S.round >= ROUNDS) return finish();
      S.round += 1;
      await turn();
    }
    function finish(): void {
      S.stage = 'notes';
      S.notes = notesOf(S.talk.map((t) => t.answer));
      state.textContent = '';
      conv.setStatus('NOTES', 'ok');
      const keep = button('KEEP', () => {
        const all = loadKept();
        all.push({ at: Date.now(), situation: S.situation, answers: S.talk.map((t) => t.answer), notes: S.notes });
        try {
          localStorage.setItem(KEEP_KEY, JSON.stringify(all.slice(-20)));
          S.kept = all.length;
          keep.disabled = true;
          keep.textContent = 'KEPT';
          toast('Kept on this phone: the situation, your answers and the notes. The other side’s lines were not.', 'ok');
        } catch {
          toast('I couldn’t keep it: this phone’s storage is full or blocked.', 'bad');
        }
      }, 'on');
      keep.dataset.act = 'keep';
      keep.dataset.case = 'keep';
      clear(notesBox, h('b.rhnotehead', 'NOTES · counted from your own answers'), h('ul', ...S.notes.map((l) => h('li', l))), h('div.row.wrap', keep), h('small.rhnote', 'Nothing is kept unless you tap KEEP. Leaving this screen drops it.'));
      notesBox.hidden = false;
      notesBox.scrollIntoView?.({ block: 'nearest' });
    }

    // the answer by voice: held, then let go: what was heard goes in the box for him to read before SEND
    let ear: Ear | null = null;
    speakKey.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        speakKey.setPointerCapture(e.pointerId);
      } catch {
        /* still works */
      }
      if (ear) return;
      stopSpeaking();
      state.textContent = canHear() ? 'Listening… let go when you are done.' : 'This browser has no speech recognition: type your answer instead.';
      ear = hear(navigator.language || 'en-GB', (t) => t && (state.textContent = `Hearing: ${t}`));
      speakKey.setAttribute('aria-pressed', 'true');
    });
    const letGo = async () => {
      const e = ear;
      ear = null;
      speakKey.setAttribute('aria-pressed', 'false');
      if (!e) return;
      try {
        const t = await e.stop();
        if (t) {
          answer.value = `${answer.value.trim()} ${t}`.trim();
          state.textContent = 'That is what I heard: change anything, then SEND.';
        } else state.textContent = 'I heard nothing. Hold SPEAK and try again, or type.';
      } catch (err) {
        state.textContent = sayError(err, 'hear you');
      }
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) speakKey.addEventListener(ev, () => void letGo());
    speakKey.addEventListener('contextmenu', (e) => e.preventDefault());

    // ------------------------------------------------------------------------------------------------ A TALK FOR A MINUTE
    const said = h('textarea.fxfield', { name: 'talk', rows: 5, placeholder: 'Talk for a minute and I write down what I hear, or type what you would say here', 'aria-label': 'What you say in your talk' }) as HTMLTextAreaElement;
    const secsIn = h('input.fxfield', { name: 'seconds', type: 'number', min: '5', max: '300', inputMode: 'numeric', placeholder: 'Seconds it took', 'aria-label': 'How many seconds it took' }) as HTMLInputElement;
    const tState = h('p.rhstate', { role: 'status' });
    const tOut = h('div.rhtalk', { hidden: true });
    let started = 0;
    let tEar: Ear | null = null;
    let tick = 0;
    const startTalk = button('START TALKING', () => {
      if (tEar) return void stopTalk();
      if (!canHear()) return void (tState.textContent = 'This browser has no speech recognition: type what you would say, and how long it took.');
      stopSpeaking();
      started = Date.now();
      tEar = hear(navigator.language || 'en-GB', (t) => (said.value = t));
      startTalk.textContent = 'STOP';
      tick = window.setInterval(() => {
        const s = Math.round((Date.now() - started) / 1000);
        tState.textContent = `Listening… ${s} seconds. Talk as you would to them, then STOP.`;
        if (s >= 60) void stopTalk();
      }, 500);
    }, 'on');
    startTalk.dataset.act = 'talk';
    startTalk.dataset.case = 'keep';
    async function stopTalk(): Promise<void> {
      const e = tEar;
      tEar = null;
      clearInterval(tick);
      startTalk.textContent = 'START TALKING';
      if (!e) return;
      try {
        const t = await e.stop();
        if (t) said.value = t;
        secsIn.value = String(Math.max(1, Math.round((Date.now() - started) / 1000)));
        tState.textContent = said.value.trim() ? 'That is what I heard. CHECK IT gives your notes.' : 'I heard nothing. Try again, or type it.';
      } catch (err) {
        tState.textContent = sayError(err, 'hear you');
      }
    }
    const check = button('CHECK IT', () => {
      const t = said.value.trim();
      const secs2 = Number(secsIn.value);
      if (!t) return void (tState.textContent = 'Talk first, or type what you would say.');
      if (!Number.isFinite(secs2) || secs2 < 5) return void (tState.textContent = 'Tell me how many seconds it took (at least five), so I can work out your pace.');
      const n = talkNotes(t, secs2);
      tState.textContent = '';
      clear(tOut, h('b.rhnotehead', 'YOUR TALK · counted from what was said'), h('ul', ...n.lines.map((l) => h('li', l))), h('small.rhnote', `${wordCount(t)} words. Nothing is kept.`));
      tOut.hidden = false;
      talk.setStatus(`${n.wpm} A MINUTE`, 'ok');
    });
    check.dataset.act = 'check';
    check.dataset.case = 'keep';
    talk.body.append(h('div.rhconv', said, h('div.row.wrap', startTalk), secsIn, h('div.row.wrap', check), tState, tOut));

    return {
      enter() {
        paintTemper();
        paintLines();
      },
      leave() {
        // nothing is kept unless he tapped KEEP: what is on screen goes
        void stopTalk();
        void letGo();
        stopSpeaking();
        if (!busy) {
          Object.assign(S, { stage: 'idle', round: 0, talk: [], notes: [] });
          clear(lines);
          state.textContent = '';
          answerBox.hidden = true;
          notesBox.hidden = true;
          start.textContent = 'START';
          conv.setStatus('READY', 'off');
        }
      },
      open(arg) {
        const m = /^(?:situation=(.*)|talk)$/.exec(arg);
        if (!m) return;
        if (m[1] !== undefined) {
          situation.value = decodeURIComponent(m[1]);
          secs.select('conversation');
        } else secs.select('talk');
      },
      context: () => screenSays('rehearse', 'Rehearse', `rehearse, ${S.stage === 'idle' ? 'nothing started' : S.stage === 'notes' ? 'on its notes' : `round ${S.round} of ${ROUNDS}`}`),
    };
  },
};
