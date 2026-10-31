/**
 * SETTINGS → CHARACTER: three dials for how Ghosty talks — how dry, how brief, how warm — each
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
import { character, DEFAULT_PERSONA, PERSONA_DIALS, readPersona, type PersonaSettings } from '../../../../../packages/shared/src/persona';

/** "Now: dry, warm, answers as long as yours, as he comes." — the dials in plain words (the steps' own names, in small letters). */
export function nowLine(p: PersonaSettings): string {
  const step = (k: keyof PersonaSettings) => PERSONA_DIALS.find((d) => d.key === k)!.steps[p[k]].toLowerCase();
  const same = p.dry === DEFAULT_PERSONA.dry && p.brief === DEFAULT_PERSONA.brief && p.warm === DEFAULT_PERSONA.warm;
  // HOW BRIEF's default follows his own length (persona.ts lengthBand)
  const length = p.brief === 1 ? 'answers as long as yours' : `${step('brief')} answers`;
  return `Now: ${step('dry')}, ${step('warm')}, ${length}${same ? ', as he comes' : ''}. The app, the voice, Telegram and notifications all sound like this.`;
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
  p.body.append(
    now,
    dials,
    h('div.row.charreset', reset),
    state,
    h('details.charwords', h('summary', { dataset: { case: 'keep' } }, 'The exact words Ghosty is given'), said),
  );

  const refresh = () => {
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
  return { ...p, refresh };
}
