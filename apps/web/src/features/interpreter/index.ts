/**
 * INTERPRETER (BRIEF-OCT-IDEAS-3 item 1; SEE): two halves of one screen, one facing him and one facing the other person (the far half
 * upside down), each with a hold-to-talk key. What is said in one language is heard by the phone's own speech recognition,
 * written in both halves and said aloud in the other language by the phone's own voice, both ways. The Lens's translation does the
 * work (the brain's when there is a signal, the offline brain on the phone when there is none: further/interpret.ts).
 *
 * Nothing is recorded; nothing of the other person is kept. The lines live on this screen only and go when it is left; only the pair
 * of languages is remembered. Every state is said: the language with no voice on this phone, no microphone, no signal.
 */
import { speakIn, stopSpeaking, voiceIn } from '../../assistant/voice';
import { clear, h, icon } from '../../core/dom';
import { screenSays } from '../../shell/awareness';
import type { TabDef } from '../../shell/tabs';
import { button, toast } from '../../ui/components';
import { page } from '../../ui/page';
import { canHear, hear, loadPair, savePair, translate, type Ear, type Pair } from '../../further/interpret';
import { LANGUAGES, langName } from '../../../../../packages/shared/src/scan';

type Side = 'near' | 'far';
interface Line {
  from: Side;
  /** What was said, in its own language, and what it came to in the other's. */
  said: string;
  came: string;
  /** 'brain' | 'offline' | 'same' once it came back; '' while it is on its way; 'failed' with `why`. */
  how: string;
  why?: string;
}

/** What a test can read (window.__ghosty.interpreter). */
export const interpState = {
  pair: loadPair() as Pair,
  lines: [] as Line[],
  listening: '' as '' | Side,
  /** What was said aloud, with the language (a phone with no voice for it says nothing aloud). */
  spoken: [] as { text: string; lang: string }[],
  /** Fixed 'nothing is kept': the lines are not written anywhere. */
  kept: false,
};

const MIC = '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>';
const KB = '<rect x="3" y="6.5" width="18" height="11" rx="2"/><path d="M7 10.5h.01M10.5 10.5h.01M14 10.5h.01M17.5 10.5h.01M7.5 14h9"/>';
export const INTERPRETER_ICON = '<path d="M3.5 6.5h9M8 4v2.5M5.5 6.5c.6 3 2.6 5.2 5.5 6.3M10.5 6.5c-.7 3-3 5.4-6.5 6.6"/><path d="M12.5 19.5l3.8-9 3.8 9M13.8 16.5h4.9"/>';

export const interpreterTab: TabDef = {
  id: 'interpreter',
  title: 'INTERPRETER',
  icon: INTERPRETER_ICON,
  scene: 'backdrop',
  blurb: 'two halves, two languages · hold to talk · nothing kept',
  now: () => `${langName(interpState.pair.a)} and ${langName(interpState.pair.b)}`,
  mount(root) {
    const P = page(root, { tag: 'SEE // INTERPRETER', sub: 'Two halves of the screen, one for each of you. Hold a key and speak; the other half writes it and says it.', stack: true });
    // (the plain line and the two languages are in the page itself: the hero's own would only say them twice)
    root.classList.add('fxpg');
    P.big.dataset.case = 'keep';
    const w = window as unknown as { __ghosty?: Record<string, unknown> };
    if (w.__ghosty) w.__ghosty.interpreter = interpState;

    const pairNow = () => interpState.pair;
    const opts = (sel: string) => LANGUAGES.map((l) => h('option', { value: l.code, ...(l.code === sel ? { selected: true } : {}) }, l.name));
    const selA = h('select#fxa', { 'aria-label': 'The language you speak' }, ...opts(pairNow().a)) as HTMLSelectElement;
    const selB = h('select#fxb', { 'aria-label': 'The language they speak' }, ...opts(pairNow().b)) as HTMLSelectElement;
    const swap = button('SWAP', () => setPair({ a: pairNow().b, b: pairNow().a }));
    swap.dataset.case = 'keep';
    swap.setAttribute('aria-label', 'Swap the two languages');

    interface Half {
      el: HTMLElement;
      head: HTMLElement;
      lines: HTMLElement;
      state: HTMLElement;
      key: HTMLButtonElement;
      typed: HTMLInputElement;
      say(t: string): void;
    }
    const mk = (side: Side): Half => {
      const lang = () => (side === 'near' ? pairNow().a : pairNow().b);
      const head = h('b.fxhead');
      const lines = h('div.fxlines', { 'aria-live': 'polite' });
      const state = h('p.fxstate', { role: 'status' });
      const key = h('button.fxkey', { type: 'button', dataset: { case: 'keep', side } }, h('span.fxmic', icon(MIC)), h('span.fxkeyt'));
      const typed = h('input.fxtype', { type: 'text', placeholder: 'Type it here, then Return', 'aria-label': `Type in ${langName(lang())}`, enterKeyHint: 'send', autocomplete: 'off', hidden: true }) as HTMLInputElement;
      const kb = h('button.fxkb', { type: 'button', 'aria-label': 'Type it instead', 'aria-pressed': 'false', dataset: { case: 'keep' } }, icon(KB));
      kb.addEventListener('click', () => {
        typed.hidden = !typed.hidden;
        state.hidden = !typed.hidden;
        kb.setAttribute('aria-pressed', String(!typed.hidden));
        if (!typed.hidden) typed.focus();
      });
      const el = h(`div.fxhalf.${side}` as 'div', { dataset: { side } }, head, lines, state, typed, h('div.fxkeys', kb, key));
      let ear: Ear | null = null;
      let down = false;
      const begin = () => {
        if (down || busy) return;
        down = true;
        stopSpeaking();
        interpState.listening = side;
        el.classList.add('hearing');
        key.setAttribute('aria-pressed', 'true');
        half(side).say(canHear() ? `Listening in ${langName(lang())}… let go when you are done.` : 'This browser has no speech recognition, so I can’t hear. Type it instead.');
        ear = hear(lang(), (t) => half(side).say(t ? `Hearing: ${t}` : ''));
      };
      const end = async () => {
        if (!down) return;
        down = false;
        interpState.listening = '';
        el.classList.remove('hearing');
        key.setAttribute('aria-pressed', 'false');
        const e = ear;
        ear = null;
        if (!e) return;
        let said = '';
        try {
          said = await e.stop();
        } catch (err) {
          return half(side).say(String((err as Error).message));
        }
        if (!said) return half(side).say('I heard nothing. Hold the key and say it again.');
        void exchange(side, said);
      };
      key.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try {
          key.setPointerCapture(e.pointerId);
        } catch {
          /* a pointer that cannot be captured still works */
        }
        begin();
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) key.addEventListener(ev, () => void end());
      key.addEventListener('keydown', (e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          begin();
        }
      });
      key.addEventListener('keyup', (e) => {
        if (e.key === ' ' || e.key === 'Enter') void end();
      });
      key.addEventListener('contextmenu', (e) => e.preventDefault());
      typed.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        const t = typed.value.trim();
        typed.value = '';
        if (t) void exchange(side, t);
      });
      return { el, head, lines, state, key, typed, say: (t) => (state.textContent = t) };
    };
    // (far is made first: it sits on top, the other person's side)
    const halves = { far: mk('far'), near: mk('near') };
    const half = (s: Side) => halves[s];
    const note = h('p.fxnote', 'Nothing is recorded, and nothing of the other person is kept: what is written here goes when you leave this screen. I use this phone’s own listening and voice; their words (text only, never their voice) are translated through my brain when there is a signal, and nothing is kept; with no signal I translate on the phone, roughly.');
    const pairRow = h('div.fxpair', h('label', h('span', 'YOU SPEAK'), selA), swap, h('label', h('span', 'THEY SPEAK'), selB));
    P.left.append(pairRow, h('div.fxhalves', halves.far.el, halves.near.el), note);
    P.right.hidden = true;
    P.big.textContent = '';
    (P.big.parentElement?.querySelector('.swap') as HTMLElement | null)?.setAttribute('hidden', '');

    let busy = false;
    /** The key's words and the heading, for the pair now. */
    function paintPair(): void {
      const { a, b } = pairNow();
      selA.value = a;
      selB.value = b;
      halves.near.head.textContent = langName(a).toUpperCase();
      halves.far.head.textContent = langName(b).toUpperCase();
      halves.near.key.querySelector('.fxkeyt')!.textContent = `HOLD TO TALK · ${langName(a)}`;
      halves.far.key.querySelector('.fxkeyt')!.textContent = `HOLD TO TALK · ${langName(b)}`;
      halves.near.key.setAttribute('aria-label', `Hold to talk, ${langName(a)}`);
      halves.far.key.setAttribute('aria-label', `Hold to talk, ${langName(b)}`);
      halves.near.el.lang = a;
      halves.far.el.lang = b;
      halves.near.typed.setAttribute('aria-label', `Type in ${langName(a)}`);
      halves.far.typed.setAttribute('aria-label', `Type in ${langName(b)}`);
      P.big.textContent = `${langName(a)} ⇄ ${langName(b)}`;
      const miss = [a, b].filter((c) => !voiceIn(c)).map(langName);
      for (const s of ['near', 'far'] as const) {
        if (!halves[s].state.textContent) halves[s].state.textContent = miss.length ? `No ${miss.join(' or ')} voice on this phone: it will write, not say.` : 'Hold the key and speak.';
      }
    }
    function setPair(p: Pair): void {
      if (p.a === p.b) return toast('Pick two different languages.', 'warn');
      interpState.pair = p;
      savePair(p);
      for (const s of ['near', 'far'] as const) halves[s].state.textContent = '';
      paintPair();
      paintLines();
    }
    selA.addEventListener('change', () => (selA.value === pairNow().b ? setPair({ a: selA.value, b: pairNow().a }) : setPair({ a: selA.value, b: pairNow().b })));
    selB.addEventListener('change', () => (selB.value === pairNow().a ? setPair({ a: pairNow().b, b: selB.value }) : setPair({ a: pairNow().a, b: selB.value })));

    /** Both halves show the talk, each in its own language: near in his, far (upside down) in theirs. */
    function paintLines(): void {
      for (const s of ['near', 'far'] as const) {
        const mine = s;
        clear(
          halves[s].lines,
          ...interpState.lines.slice(-4).map((l) => {
            const own = l.from === mine ? l.said : l.came;
            const who = l.from === mine ? 'YOU' : 'THEM';
            return h(`p.fxline.${l.from === mine ? 'mine' : 'theirs'}${l.how === 'failed' ? '.bad' : ''}` as 'p', h('small', who), l.how === 'failed' && l.from !== mine ? '…' : own || '…');
          }),
        );
      }
      paintSay();
    }
    function paintSay(): void {
      const last = interpState.lines.at(-1);
      if (last?.how === 'failed') {
        halves.near.say(last.why ?? '');
        halves.far.say('');
      }
      P.sub.textContent = interpState.lines.length ? 'Hold a key to speak again.' : 'Two halves of the screen, one for each of you. Hold a key and speak; the other half writes it and says it.';
    }

    async function exchange(from: Side, said: string): Promise<void> {
      const { a, b } = pairNow();
      const [fromLang, toLang] = from === 'near' ? [a, b] : [b, a];
      const to: Side = from === 'near' ? 'far' : 'near';
      const line: Line = { from, said, came: '', how: '' };
      interpState.lines.push(line);
      if (interpState.lines.length > 20) interpState.lines.splice(0, interpState.lines.length - 20);
      busy = true;
      paintLines();
      half(from).say(`Translating into ${langName(toLang)}…`);
      half(to).say(`Translating into ${langName(toLang)}…`);
      try {
        const r = await translate(said, toLang, fromLang);
        line.came = r.text;
        line.how = r.how;
        paintLines();
        half(from).say(r.how === 'offline' ? 'Translated on this phone, roughly: check the important bits.' : '');
        const spoke = speakIn(r.text, toLang);
        if (spoke) interpState.spoken.push({ text: r.text, lang: toLang });
        half(to).say(spoke ? (r.how === 'offline' ? 'Said aloud. Translated on this phone, roughly.' : 'Said aloud.') : `No ${langName(toLang)} voice on this phone: it is written here.`);
      } catch (e) {
        line.how = 'failed';
        line.why = String((e as Error).message);
        paintLines();
        half(to).say('');
      } finally {
        busy = false;
        paintPair();
      }
    }

    paintPair();
    paintLines();
    return {
      enter() {
        interpState.pair = loadPair();
        paintPair();
      },
      leave() {
        // nothing of the other person is kept: the lines, what was heard and what was said aloud all go
        stopSpeaking();
        interpState.lines.length = 0;
        interpState.spoken.length = 0;
        interpState.listening = '';
        for (const s of ['near', 'far'] as const) {
          halves[s].state.textContent = '';
          halves[s].typed.value = '';
        }
        paintLines();
        paintPair();
      },
      context: () => screenSays('interpreter', 'Interpreter', `the interpreter, ${langName(pairNow().a)} and ${langName(pairNow().b)}, ${interpState.lines.length ? `${interpState.lines.length} lines on screen` : 'nothing said yet'}`),
      open(arg) {
        const to = /^to=([a-z]{2,3})$/.exec(arg)?.[1];
        if (to && to !== pairNow().a && LANGUAGES.some((l) => l.code === to)) setPair({ a: pairNow().a, b: to });
      },
    };
  },
};
