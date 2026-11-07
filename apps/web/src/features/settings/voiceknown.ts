/**
 * SETTINGS → VOICE & HOME → MY VOICE and PEOPLE I'VE INTRODUCED (BRIEF-VOICE-KNOWN 2, 5; OWNER-ISSUES 131 (7), 152): the voices
 * this phone knows, enrolled by the people themselves. MY VOICE: he reads three short sentences (Ghosty's own words, not a
 * stranger's text), the phone listens through the capture `listen()` uses and keeps the numbers (voiceprint.ts: 50 per sentence,
 * never a recording) in IndexedDB beside the faces (voicestore.ts); nothing is sent, not even to be written down (the sound
 * alone is listened for), BACKUP & RESTORE leaves it out, DELETE MY VOICE goes at once with UNDO. PEOPLE I'VE INTRODUCED: only with
 * them there. The screen says "Ask them to say 'yes' when I ask", Ghosty asks aloud, the yes is heard, then they read the three
 * sentences; stored like his, deletable by name; at most ten. A voice that matches nobody is "a voice I don't know", never a name.
 * The mark (STANDARD, the second habit): WORKING with a voice enrolled, DEGRADED with none ("no voice enrolled yet": ENROL), and
 * never OFFLINE, because it needs no signal (said).
 */
import { clear, h } from '../../core/dom';
import { listen, sound, speak, stopListening, takeSound, talkHooks, voiceSupport } from '../../assistant/voice';
import { refresh as refreshKnown, lastScore } from '../../assistant/voiceknown';
import { enrol, features, MIN_ENROL_VOICED, soundsLike, SENTENCES, type Print, type Voiced } from '../../assistant/voiceprint';
import { addVoice, forgetVoice, knownVoices, MAX_VOICES, putBack, saveMine, type Stored } from '../../assistant/voicestore';
import { speechCaps } from '../../api/brain';
import { panel, toast, undo } from '../../ui/components';
import { key, plate, tag, truthLine } from '../../ui/machine';

/**
 * The three sentences he reads: Ghosty's own words (what he says about this very thing), short, with the vowels in different
 * orders so the voice is heard in more than one shape. The same three for everyone: a person introduced reads them too.
 */
export const READ = ['I’m Ghosty, and I’m listening for you.', 'I keep this on your phone, and nowhere else.', 'Ask me anything, and I’ll answer plainly.'];
if (READ.length !== SENTENCES) throw new Error('three sentences');

const day = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
/** A name he can say: letters, digits, a space, an apostrophe, a dot or a hyphen; 24 at most. */
export const cleanName = (s: string): string => s.replace(/[^\p{L}\p{N} '’.-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 24);
/** Any yes-like word (the person introduced says it aloud). */
export const YES = /\b(yes|yeah|yep|yup|yea|sure|okay|ok|go ahead|please do|that'?s fine|fine|all right|alright|of course|do it)\b/i;
const NO = /\b(no|nope|don'?t|do not|not now|stop|cancel)\b/i;

/** For the checks: how long the last enrolment took him, from the tap to the voice kept. */
export const lastEnrol = { ms: -1, who: '' };

/** What the screen says while it listens. */
interface Stage {
  box: HTMLElement;
  say(a: string, b?: string, c?: string): void;
  cancelled(): boolean;
}

async function listenOnce(stage: Stage, line: (t: string) => void): Promise<Voiced | null> {
  let text = '';
  try {
    text = await listen(false, () => undefined, () => line('Now'), true);
  } catch (e) {
    stage.say(String((e as Error)?.message ?? e));
    return null;
  }
  void text;
  const snd = takeSound();
  const pcm = snd ? await snd.pcm : null;
  return pcm ? features(pcm) : { secs: 0, profile: null };
}

/** The three sentences, one at a time, each asked again (up to three tries) if not enough of the voice was caught. */
async function readThree(stage: Stage, who: string): Promise<Voiced[] | null> {
  const got: Voiced[] = [];
  for (let i = 0; i < READ.length; i++) {
    let ok: Voiced | null = null;
    for (let tries = 0; tries < 3 && !ok && !stage.cancelled(); tries++) {
      stage.say(`${who} · ${i + 1} of ${READ.length}`, READ[i]!);
      stage.box.dataset.state = 'waiting';
      const v = await listenOnce(stage, () => (stage.box.dataset.state = 'listening'));
      if (stage.cancelled()) return null;
      if (!v) return null;
      if (v.profile && v.secs >= MIN_ENROL_VOICED) ok = v;
      else stage.say(`${who} · ${i + 1} of ${READ.length}`, READ[i]!, v.secs > 0.2 ? 'I only caught a little of that: once more, a touch louder.' : 'I didn’t hear anything: once more.');
    }
    if (!ok) {
      if (!stage.cancelled()) stage.say('I couldn’t hear you well enough. Try again somewhere quieter, with the phone close.');
      return null;
    }
    got.push(ok);
  }
  return got;
}

/** A stage on the page: the sentence big, a line under it, a CANCEL key. */
function stageIn(host: HTMLElement, onCancel: () => void): Stage & { done(): void } {
  let gone = false;
  const head = h('p.vk-head', { dataset: { case: 'keep' } });
  const sentence = h('p.vk-sentence', { dataset: { case: 'keep' }, 'aria-live': 'polite' });
  const sub = h('p.vk-sub', { dataset: { case: 'keep' }, role: 'status' });
  const cancel = key('CANCEL', () => {
    gone = true;
    stopListening(true);
    onCancel();
  }, { kind: 'line', label: 'Cancel: stop listening' });
  const box = plate({ strong: true, label: 'Reading aloud' }, tag('LISTENING', { tone: 'on' }), head, sentence, sub, h('div.vk-keys', cancel));
  box.classList.add('vk-stage');
  host.append(box);
  return {
    box,
    say(a, b = '', c = '') {
      head.textContent = b ? a : '';
      sentence.textContent = b || '';
      sub.textContent = c || (b ? 'Read it out loud, as you would to me.' : a);
    },
    cancelled: () => gone,
    done() {
      gone = true;
      box.remove();
    },
  };
}

/** Make sure no conversation holds the microphone, and the sound is kept for this. */
function takeTheEar(): () => void {
  if (talkHooks.live()) talkHooks.end?.();
  sound.wanted = true;
  return () => void refreshKnown();
}

const unsupported = () => !voiceSupport.mic || typeof MediaRecorder === 'undefined';

// ---------------------------------------------------------------- MY VOICE

export function myVoicePanel(): { el: HTMLElement; refresh(): Promise<void> } {
  const p = panel('MY VOICE', { grow: false });
  p.el.dataset.id = 'myvoice';
  const body = p.body;
  let busy = false;

  const paint = async () => {
    const all = await knownVoices();
    if (busy) return; // (a read in progress owns the panel: a late repaint must not wipe it)
    const me = all.find((v) => v.me);
    const nosound = lastScore.kind === 'nosound';
    const mark = unsupported() ? { word: 'DEGRADED', tone: 'warn' as const, why: 'this browser gives me no sound to compare' } : me ? (nosound ? { word: 'DEGRADED', tone: 'warn' as const, why: 'my last listen gave me no sound to compare: the phone’s own ear does not always share the microphone' } : { word: 'WORKING', tone: 'on' as const, why: `I know your voice, from ${day(me.at)}` }) : { word: 'DEGRADED', tone: 'warn' as const, why: 'no voice enrolled yet' };
    p.setStatus(mark.word === 'WORKING' ? 'Working' : 'Degraded');
    const keys: HTMLElement[] = [];
    if (me) {
      keys.push(key('RE-ENROL', () => void start(), { kind: 'line', label: 'Enrol my voice again: read three sentences' }), key('DELETE MY VOICE', () => void drop(me), { kind: 'line', label: 'Delete my voice from this phone (you can undo it)' }));
    } else keys.push(key('ENROL', () => void start(), { kind: 'fill', label: 'Enrol my voice: read three short sentences' }));
    clear(
      body,
      h('p.vk-lede', { dataset: { case: 'keep' } }, 'I’ll know it’s you. It never unlocks anything: the confirm tap still does.'),
      h('div.vk-marks', { role: 'list', 'aria-label': 'How it is now' },
        (() => {
          const l = truthLine([{ text: 'My voice', tone: 'strong' }, { text: mark.word, tone: mark.tone }, mark.why]);
          l.setAttribute('role', 'listitem');
          l.dataset.mark = mark.word.toLowerCase();
          return l;
        })(),
        (() => {
          const l = truthLine([{ text: 'Signal', tone: 'strong' }, 'not needed: it works with no connection']);
          l.setAttribute('role', 'listitem');
          return l;
        })()),
      h('div.vk-keys', ...keys),
      h('p.vk-note', { dataset: { case: 'keep' } }, 'What it is for: when you talk to me I check the sound against yours and show YOU on the bar. When it is someone else I ask before I go on, and I say nothing private to them.'),
      h('p.vk-note', { dataset: { case: 'keep' } }, 'What it is not: a lock. A recording of you can fool it, and a cold or a whisper can make me doubt you. Everything that matters still needs your tap.'),
      h('p.vk-note', { dataset: { case: 'keep' } }, 'What I keep: a few hundred numbers about how you sound, never a recording. They stay on this phone: not sent to my brain, not in a backup.'),
    );
  };

  const start = async () => {
    if (busy) return;
    if (unsupported()) return void toast('This browser gives me no way to listen for your voice: try Safari on your phone.', 'warn');
    busy = true;
    const t0 = performance.now();
    const release = takeTheEar();
    clear(body);
    const stage = stageIn(body, () => {
      stage.done();
      void paint();
    });
    const looks = await readThree(stage, 'You');
    release();
    busy = false;
    if (stage.cancelled() && !looks) return void (await paint());
    stage.done();
    const print = looks ? enrol(looks) : null;
    if (print) {
      await saveMine(print);
      await refreshKnown();
      lastEnrol.ms = Math.round(performance.now() - t0);
      lastEnrol.who = 'me';
      toast('Got it. I’ll know your voice now.', 'ok');
    } else if (looks) toast('I couldn’t get a clean enough read of your voice. Try again somewhere quieter.', 'warn');
    await paint();
  };

  const drop = async (v: Stored) => {
    const was = await forgetVoice(v.id);
    await refreshKnown();
    await paint();
    if (was)
      undo('Deleted my voice', async () => {
        await putBack(was);
        await refreshKnown();
        await paint();
      });
  };

  void paint();
  return { el: p.el, refresh: paint };
}

// ---------------------------------------------------------------- PEOPLE I'VE INTRODUCED

export function peoplePanel(): { el: HTMLElement; refresh(): Promise<void> } {
  const p = panel('PEOPLE I’VE INTRODUCED', { grow: false });
  p.el.dataset.id = 'voicepeople';
  const body = p.body;
  let busy = false;
  const name = h('input', { placeholder: 'Their name', 'aria-label': 'Their name', autocomplete: 'off', maxlength: '24', enterkeyhint: 'go' });

  const paint = async () => {
    const all = await knownVoices();
    if (busy) return; // (an introduction in progress owns the panel: a late repaint must not wipe it)
    const others = all.filter((v) => !v.me);
    const full = others.length >= MAX_VOICES;
    p.setStatus(others.length ? `${others.length}` : 'None');
    const list = h('div.vk-list', { role: 'list', 'aria-label': 'People whose voice I know' });
    for (const v of others) {
      const del = key('FORGET', () => void drop(v), { kind: 'ghost', label: `Forget ${v.name}’s voice (you can undo it)` });
      const r = h('div.vk-person', { role: 'listitem', dataset: { voice: v.id, case: 'keep' } }, h('b', v.name), h('span', `introduced ${day(v.at)}`), del);
      list.append(r);
    }
    const add = key('ADD', () => void start(), { kind: 'fill', label: 'Add someone: only with them here, they say yes aloud and read three sentences' });
    add.disabled = full || busy;
    clear(
      body,
      h('p.vk-lede', { dataset: { case: 'keep' } }, others.length ? 'I know these voices, because each of them said yes to me aloud.' : 'No one yet. I only learn a voice with its owner here, saying yes aloud.'),
      list,
      h('div.vk-add', h('label.vk-label', { for: 'vk-name', dataset: { case: 'keep' } }, 'THEIR NAME'), Object.assign(name, { id: 'vk-name' }), add),
      h('p.vk-note', { dataset: { case: 'keep' } }, full ? `I keep ${MAX_VOICES} people at most, so it never becomes a roll of strangers. Forget someone to add another.` : `Only with them here: I ask them aloud, they say yes, then they read three sentences. I keep ${MAX_VOICES} people at most, so it never becomes a roll of strangers.`),
      h('p.vk-note', { dataset: { case: 'keep' } }, 'I only ever use this to say a name when I hear one of these voices. A voice that matches none of them is just a voice I don’t know: I never guess a name.'),
    );
  };

  const drop = async (v: Stored) => {
    const was = await forgetVoice(v.id);
    await refreshKnown();
    await paint();
    if (was)
      undo(`Forgot ${was.name}’s voice`, async () => {
        await putBack(was);
        await refreshKnown();
        await paint();
      });
  };

  const start = async () => {
    if (busy) return;
    const who = cleanName(name.value);
    if (!who) return void toast('Type their name first.', 'warn');
    if (unsupported()) return void toast('This browser gives me no way to listen for a voice: try Safari on your phone.', 'warn');
    const all = await knownVoices();
    if (all.some((v) => v.name.toLowerCase() === who.toLowerCase())) return void toast(`I already know a ${who}: forget them first, or add them with another name.`, 'warn');
    busy = true;
    const t0 = performance.now();
    const release = takeTheEar();
    clear(body);
    const stage = stageIn(body, () => {
      stage.done();
      void paint();
    });
    const finish = async () => {
      release();
      busy = false;
      stage.done();
      await paint();
    };
    // 1. their yes, aloud: Ghosty asks, they say it
    stage.say(`Ask ${who} to say “yes” when I ask.`);
    stage.box.dataset.state = 'asking';
    await speak(`${who}, is it all right if I learn your voice? Say yes.`).catch(() => undefined);
    if (stage.cancelled()) return void (await finish());
    stage.say(`${who}, say “yes”.`);
    let said = '';
    for (let tries = 0; tries < 2 && !YES.test(said); tries++) {
      stage.box.dataset.state = 'listening';
      try {
        said = await listen(!(navigator.onLine === false) && speechCaps.get().stt, () => undefined, () => undefined);
      } catch (e) {
        stage.say(String((e as Error)?.message ?? e));
        return void (await new Promise((r) => setTimeout(r, 1800)), await finish());
      }
      takeSound(); // (the yes is words, not the voiceprint)
      if (stage.cancelled()) return void (await finish());
      if (NO.test(said) && !YES.test(said)) break;
    }
    if (!YES.test(said)) {
      toast(`${who} didn’t say yes, so I haven’t learned anything.`, '');
      return void (await finish());
    }
    // 2. three sentences, in their voice
    const looks = await readThree(stage, who);
    if (stage.cancelled()) return void (await finish());
    const print: Print | null = looks ? enrol(looks) : null;
    if (!print) {
      toast(looks ? `I couldn’t get a clean enough read of ${who}’s voice.` : `I haven’t learned ${who}’s voice.`, 'warn');
      return void (await finish());
    }
    const same = soundsLike(await knownVoices(), print);
    if (same) {
      toast(`${who} and ${same.me ? 'you' : same.name} sound too alike for me to tell apart, so I haven’t added ${who}. I’d rather say “a voice I don’t know” than the wrong name.`, 'warn');
      return void (await finish());
    }
    await addVoice(who, print);
    await refreshKnown();
    lastEnrol.ms = Math.round(performance.now() - t0);
    lastEnrol.who = who;
    name.value = '';
    toast(`Got it. I’ll know ${who}’s voice.`, 'ok');
    await finish();
  };

  name.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') void start();
  });
  void paint();
  return { el: p.el, refresh: paint };
}
