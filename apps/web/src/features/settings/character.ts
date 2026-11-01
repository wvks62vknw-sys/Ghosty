/**
 * SETTINGS → CHARACTER: four dials for how Ghosty talks — how dry, how brief, how warm, how fiery — each
 * LESS / DEFAULT / MORE. The brain keeps them (POST /api/profile/persona, profile.ts) and puts
 * them into the character every prompt carries (packages/shared/src/persona.ts), so the app,
 * the voice, Telegram and notifications all change together. The phone keeps a copy in its
 * settings for the offline brain. Under the dials: how he sounds now, in plain words ("Now: dry, warm, answers as long as yours,
 * as he comes."), and the exact words Ghosty is given one tap away (they read like an instruction to a machine, which
 * is what they are; a wall of them was the panel's main text).
 */
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { settings } from '../../state/app';
import { button, panel, toast, type Panel } from '../../ui/components';
import { principlesEditor } from './principles';
import { character, DEFAULT_PERSONA, PERSONA_DIALS, readPersona, type PersonaSettings } from '../../../../../packages/shared/src/persona';
import { DIALS, DEFAULT_DIAL, type Dial } from '../../../../../packages/shared/src/cadence';
import type { SpeakInfo } from '../../api/brain';

/** "Now: dry, warm, answers as long as yours, as he comes." — the dials in plain words (the steps' own names, in small letters). */
export function nowLine(p: PersonaSettings): string {
  const step = (k: keyof PersonaSettings) => PERSONA_DIALS.find((d) => d.key === k)!.steps[p[k]].toLowerCase();
  const same = p.dry === DEFAULT_PERSONA.dry && p.brief === DEFAULT_PERSONA.brief && p.warm === DEFAULT_PERSONA.warm && p.fire === DEFAULT_PERSONA.fire;
  // HOW BRIEF's default follows his own length (persona.ts lengthBand)
  const length = p.brief === 1 ? 'answers as long as yours' : `${step('brief')} answers`;
  return `Now: ${step('dry')}, ${step('warm')}, ${step('fire')}, ${length}${same ? ', as he comes' : ''}. The app, the voice, Telegram and notifications all sound like this.`;
}

export function characterPanel(): Panel & { refresh(): void } {
  const p = panel('CHARACTER', { grow: false, cls: 'character' });
  const dials = h('div.chardials');
  const said = h('div.note.charsays');
  const now = h('p.note.charnow');
  const state = h('div.note.charstate');
  let cur: PersonaSettings = readPersona(settings.get().persona);

  const paint = () => {
    clear(
      dials,
      ...PERSONA_DIALS.map((d) =>
        h(
          'div.lenschips.learnchips',
          { role: 'group', 'aria-label': d.label, 'data-dial': d.key },
          h('span.lab', d.label),
          ...d.steps.map((label, i) => {
            const b = button(label, () => void save({ ...cur, [d.key]: i }), cur[d.key] === i ? 'on' : '');
            b.setAttribute('aria-pressed', String(cur[d.key] === i));
            return b;
          }),
        ),
      ),
    );
    said.textContent = character(cur);
    now.textContent = nowLine(cur);
  };

  const save = async (next: PersonaSettings) => {
    const was = cur;
    cur = readPersona(next);
    paint();
    state.textContent = 'Saving…';
    try {
      const r = await brain.setPersona(cur);
      cur = readPersona(r.persona);
      settings.set({ persona: cur });
      state.textContent = 'Saved.';
      paint();
    } catch {
      cur = was;
      paint();
      state.textContent = '';
      // In his words, never the browser's (SMALL-GAPS A).
      toast("Not saved: I can't reach my brain right now. Try again in a moment.", 'bad');
    }
  };

  const reset = button('DEFAULT', () => void save(DEFAULT_PERSONA));
  // SPEAK FIRST (BRIEF-SIDEWAYS 3): how often he may bring something up unasked, across the chat, push and Telegram. The
  // brain keeps it (speak.ts); it is never part of the words Ghosty is given.
  const speakDial = h('div.lenschips.learnchips.speakdial', { role: 'group', 'aria-label': 'SPEAK FIRST', 'data-dial': 'speak' });
  const speakNow = h('p.note.speaknow', { dataset: { case: 'keep' } });
  let speak: SpeakInfo | null = null;
  const paintSpeak = () => {
    const on: Dial = speak?.dial ?? DEFAULT_DIAL;
    clear(
      speakDial,
      h('span.lab', 'SPEAK FIRST'),
      ...DIALS.map((d) => {
        const b = button(d.label, () => void setSpeak(d.id), on === d.id ? 'on' : '');
        b.setAttribute('aria-pressed', String(on === d.id));
        return b;
      }),
    );
    const said = speak ? speak.today.filter((s) => !s.held && !s.danger).length : 0;
    speakNow.textContent = `${DIALS.find((d) => d.id === on)!.says}${speak ? ` Today: ${said} said${speak.stopped ? '; you said stop, so I’m quiet until tomorrow' : ''}.` : ''}`;
  };
  const setSpeak = async (dial: Dial) => {
    try {
      speak = await brain.setSpeakDial(dial);
      paintSpeak();
    } catch {
      toast("Not saved: I can't reach my brain right now. Try again in a moment.", 'bad');
    }
  };
  // His PRINCIPLES (OWNER-ISSUES 64, 69b): the lines he holds me to, in his words — the same editor as MEMORY's.
  const princ = principlesEditor();
  p.body.append(
    now,
    dials,
    h('div.row.charreset', reset),
    state,
    speakDial,
    speakNow,
    h('div.charprinc', h('span.lab', 'PRINCIPLES'), princ.el),
    h('details.charwords', h('summary', { dataset: { case: 'keep' } }, 'The exact words Ghosty is given'), said),
  );

  const refresh = () => {
    princ.refresh();
    void brain
      .speak()
      .then((r) => {
        speak = r;
        paintSpeak();
      })
      .catch(() => undefined);
    void brain
      .persona()
      .then((r) => {
        cur = readPersona(r.persona);
        settings.set({ persona: cur });
        paint();
      })
      .catch(() => undefined); // offline: the copy on this phone stays
  };
  paint();
  paintSpeak();
  return { ...p, refresh };
}
