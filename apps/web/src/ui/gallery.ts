/**
 * THE LOOKS GALLERY (BRIEF-THEME-GALLERY; OWNER-ISSUES 155, 157): the Theme page is seven looks, each a still of its Home, and a
 * row of twelve colours. Nothing else: the ground, the dials, the switches and the presets stay in the recipe (state/theme.ts) and
 * answer to his words ("paper", "black background", "glow off", "calm"), they are just not on this page.
 *
 *   THE LOOK    seven cards (two rows of three and one): the look he is in carries the reticle's corners in his accent and says
 *               YOU'RE IN IT; the two that are built (The Scan, Glass) apply their world at once; the five that are not carry
 *               COMING, and a tap says its one line and changes nothing
 *   THE COLOUR  the twelve, a ring on the chosen one, applying at once and kept (the boot wears it)
 *   ASK         "Say a look, or a colour": opens the chat, where the same words work with no model
 *
 * Every card and swatch is 44 pt or more; every control is named for VoiceOver. Nothing here names a colour of its own.
 */
import { clear, h } from '../core/dom';
import { applyRecipe, recipe, recipeEvents } from '../state/theme';
import { openChat } from '../shell/launcher';
import { ASK_LINE, comingLine, GALLERY_COUNT, LOOKS, lookOfWorld, type LookDef } from '../../../../packages/shared/src/looks';
import { COLOUR_KEYS, COLOUR_LABELS } from '../../../../packages/shared/src/themes';
import { toast } from './components';
import { tag, truthLine } from './machine';

/** The still's size: 2x the card at 440 (the card is about 130 pt wide, 11 to 10). */
export const STILL = { width: 264, height: 240 } as const;

export function looksGallery(): { el: HTMLElement; paint(): void } {
  const el = h('div.gg', { dataset: { g: 'gallery' } });
  // built once, painted often: the stills never reload when a colour is tapped
  const cards = LOOKS.map((l) => {
    const sub = h('small', { dataset: { case: 'keep' } });
    const name = h('span.gg-name');
    const b = h('button.gg-look', { type: 'button', role: 'radio', dataset: { look: l.key, built: String(l.built), case: 'keep' } },
      h('span.gg-thumb',
        h('img', { src: l.still, width: STILL.width, height: STILL.height, alt: l.name, loading: 'lazy', decoding: 'async' }),
        h('span.g-ret-frame', { 'aria-hidden': 'true' }),
        l.built ? null : h('span.gg-coming', { dataset: { case: 'keep' } }, 'Coming')),
      h('span.gg-cap', name, sub));
    b.addEventListener('click', () => {
      if (!l.built || !l.world) return toast(comingLine(l), 'ok');
      if (recipe().world === l.world) return;
      applyRecipe({ ...recipe(), world: l.world });
      toast(`${l.name}: on`, 'ok');
    });
    return { l, b, name, sub };
  });
  const swatches = COLOUR_KEYS.map((k) => {
    const b = h('button.gg-sw', { type: 'button', role: 'radio', dataset: { accent: k, colour: k, case: 'keep' } }, h('i', { 'aria-hidden': 'true' }));
    b.addEventListener('click', () => {
      if (recipe().colour === k) return;
      applyRecipe({ ...recipe(), colour: k });
      toast(`Colour: ${COLOUR_LABELS[k]}`, 'ok');
    });
    return { k, b };
  });
  const lookHead = h('div.gg-sec');
  const colourHead = h('div.gg-kick');
  const ask = h('button.gg-ask', { type: 'button', 'aria-label': `${ASK_LINE}: open the chat`, dataset: { case: 'keep' } }, h('span', ASK_LINE));
  ask.insertAdjacentHTML('beforeend', '<svg class="gg-mic" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>');
  ask.addEventListener('click', () => openChat());
  const row = (a: number, b: number, label: string) => h('div.gg-looks', { role: 'radiogroup', 'aria-label': label }, ...cards.slice(a, b).map((c) => c.b));
  el.append(
    lookHead,
    row(0, 3, 'The world, first row'),
    h('div.gg-colour', { dataset: { g: 'colour' } }, colourHead, h('div.gg-row', { role: 'radiogroup', 'aria-label': 'The colour' }, ...swatches.map((s) => s.b))),
    row(3, 7, 'The world, second row'),
    ask);

  const paint = () => {
    const r = recipe();
    const here = lookOfWorld(r.world);
    clear(lookHead, tag('The world', { count: here.name }), h('small', { dataset: { case: 'keep' } }, GALLERY_COUNT));
    clear(colourHead, tag('The colour', { count: COLOUR_LABELS[r.colour] }), truthLine('12 · yours to change'));
    for (const { l, b, name, sub } of cards) {
      const on = l.key === here.key;
      b.setAttribute('aria-checked', String(on));
      b.setAttribute('aria-label', `${l.name}: ${on ? 'you’re in it' : l.line}${l.built ? '' : ', coming'}`);
      b.classList.toggle('on', on);
      clear(name, tag(l.name, on ? { tone: 'on' } : {}));
      sub.textContent = on ? 'You’re in it' : l.line;
    }
    for (const { k, b } of swatches) {
      const on = r.colour === k;
      b.setAttribute('aria-checked', String(on));
      b.setAttribute('aria-label', `${COLOUR_LABELS[k]}${on ? ', chosen' : ''}`);
      b.classList.toggle('on', on);
    }
  };
  paint();
  recipeEvents.on('change', paint);
  return { el, paint };
}
