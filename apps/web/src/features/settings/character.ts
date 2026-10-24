/**
 * SETTINGS → CHARACTER: three dials for how Ghosty talks — how dry, how brief, how warm — each
 * LESS / DEFAULT / MORE. The brain keeps them (POST /api/profile/persona, profile.ts) and puts
 * them into the character every prompt carries (packages/shared/src/persona.ts), so the app,
 * the voice, Telegram and notifications all change together. The phone keeps a copy in its
 * settings for the offline brain. Shown under the dials: the exact words Ghosty is given.
 */
import { brain } from '../../api/brain';
import { clear, h } from '../../core/dom';
import { settings } from '../../state/app';
import { button, panel, toast, type Panel } from '../../ui/components';
import { character, DEFAULT_PERSONA, PERSONA_DIALS, readPersona, type PersonaSettings } from '../../../../../packages/shared/src/persona';

export function characterPanel(): Panel & { refresh(): void } {
  const p = panel('CHARACTER', { grow: false, cls: 'character' });
  const dials = h('div.chardials');
  const said = h('div.note.charsays');
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
      state.textContent = 'Saved. The app, the voice, Telegram and notifications all use it.';
      paint();
    } catch (e) {
      cur = was;
      paint();
      state.textContent = '';
      toast(`Not saved: ${String((e as Error)?.message ?? e).slice(0, 120)}`, 'bad');
    }
  };

  const reset = button('DEFAULT', () => void save(DEFAULT_PERSONA));
  p.body.append(dials, h('div.row.charreset', reset), state, h('div.lab', 'WHAT GHOSTY IS TOLD'), said);

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
