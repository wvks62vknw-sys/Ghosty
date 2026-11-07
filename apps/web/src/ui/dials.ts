/**
 * THE DIALS (BRIEF-THEMES-2: "Settings → Appearance → Theme … shows the presets first; the dials are under them"): the recipe's
 * three choices and its switches, each live, each one visible thing said in a sentence, every control named for VoiceOver and
 * 44 pt or more. Settings → Theme and THE LOOK → THEMES both draw these (with the presets above them: ui/swatches.ts).
 *
 *   GROUND    the five, each tile drawn ON its ground (its canvas, its points, its ink), the chosen one's sentence under them
 *   COLOUR    the twelve accents, each chip in its own block (data-accent), on the ground in force
 *   WORLD     the five, each tile drawn IN its world (its floor, its corners, its reticle) on the ground in force; then the line
 *             that Orbit is a way round, not a look, and that every room follows the world fully with the shell
 *   SWITCHES  the eight, each a row: its name, the sentence of what the choice does now, and its choices as square keys
 *
 * A tap applies at once, everywhere (state/theme.ts applyRecipe), with the toast; a dial changed under a preset makes Custom,
 * kept exactly as set. Nothing here names a colour of its own: every tile and chip draws from the tokens it stands on.
 */
import { clear, h } from '../core/dom';
import { applyRecipe, groundNow, recipe, recipeEvents, savedHome, THEMES } from '../state/theme';
import { clockWords, COLOUR_KEYS, COLOUR_LABELS, daylight, groundOf, GROUNDS, ORBIT_LINE, ROOMS_LINE, SWITCHES, worldOf, WORLDS, type GroundKey, type NightKey, type Recipe, type SwitchKey, type Switches } from '../../../../packages/shared/src/themes';
import { toast } from './components';
import { eyeGlyph, tag, truthLine } from './machine';

export type DialPart = 'ground' | 'colour' | 'world' | 'switches';

/** What a switch's choice says now, with the honest edge where there is one (Reduce Motion wins; Paper and Body reach the system's pages first). */
export function switchLine(k: SwitchKey, r: Recipe, now = Date.now()): string {
  const def = SWITCHES.find((s) => s.key === k)!;
  const opt = def.options.find((o) => o.value === r.switches[k]) ?? def.options[0]!;
  if (k === 'motion' && typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return 'Reduce Motion is on in your phone’s settings, so I hold still whatever this says: it always wins.';
  if (k === 'day' && r.switches.day === 'on') {
    const dl = daylight(now, savedHome());
    const night = groundOf(r.night)!.label;
    return `${dl.day ? `Paper till ${clockWords(dl.flipAt)}, then ${night}` : `${night} till ${clockWords(dl.flipAt)}, then Paper`}. ${savedHome() ? 'From your home’s sun times, never your live location.' : 'No home saved, so 08:00 to 18:00.'}`;
  }
  if (k === 'body' && r.switches.body !== 17) return `${opt.line} It reaches the pages I draw in the new system now; every room follows with the shell.`;
  return opt.line;
}

/** The Ground dial's sentence for the ground in force (Paper says how far it reaches today). */
export function groundLine(r: Recipe): string {
  const g = groundOf(groundNow(r))!;
  const said = `${g.label}: ${g.line.charAt(0).toLowerCase()}${g.line.slice(1)}`;
  return g.key === 'paper' ? `${said} It reaches the pages I draw in the new system first: this one, THE LOOK and the reader; the other rooms stay on ${groundOf(r.night)!.label}, your night ground, until the shell.` : said;
}

export function lookDials(o: { parts?: DialPart[]; label?: string } = {}): { el: HTMLElement; paint(): void; stop(): void } {
  const parts = o.parts ?? ['ground', 'colour', 'world', 'switches'];
  const el = h('div.gdials', { dataset: { g: 'dials' }, role: 'group', 'aria-label': o.label ?? 'The dials' });
  /** Apply a change to the recipe now, and say what it did (once a minute for the same words: ui/components.ts). */
  const change = (next: Recipe, said: string) => {
    applyRecipe(next);
    toast(said, 'ok');
  };
  const choice = (o2: { name: string; label: string; on: boolean; data: Record<string, string>; face: Node; onTap: () => void; cls?: string }) => {
    const b = h(`button.gchoice${o2.cls ? `.${o2.cls}` : ''}` as 'button', { type: 'button', role: 'radio', 'aria-checked': String(o2.on), 'aria-label': `${o2.label}${o2.on ? ', chosen' : ''}`, dataset: { case: 'keep', ...o2.data } },
      h('span.gchoice-face', { 'aria-hidden': 'true' }, o2.face),
      h('span.gchoice-name', o2.name));
    b.classList.toggle('on', o2.on);
    b.addEventListener('click', () => (b.getAttribute('aria-checked') === 'true' ? undefined : o2.onTap()));
    return b;
  };
  const head = (name: string, count: string, line: string) =>
    h('div.gdial-head', tag(name, { count }), h('p.gdial-line', { dataset: { case: 'keep' } }, line));

  const paint = () => {
    const r = recipe();
    const ground = groundNow(r);
    const blocks: HTMLElement[] = [];
    if (parts.includes('ground')) {
      const tiles = GROUNDS.map((g) => choice({
        name: g.label, label: `${g.label}: ${g.line}`, on: ground === g.key,
        data: { choice: g.key, ground: g.key, accent: r.colour },
        face: h('span.gface', h('i.g-floor'), h('span.gface-ink', 'Aa'), h('span.gface-dot')),
        onTap: () => change({ ...r, ground: g.key, night: g.key === 'paper' ? r.night : (g.key as NightKey), switches: { ...r.switches, day: 'off' } }, `Ground: ${g.label}`),
      }));
      blocks.push(h('section.gdial', { dataset: { dial: 'ground' } }, head('Ground', groundOf(ground)!.label, groundLine(r)),
        h('div.gchoices.grounds', { role: 'radiogroup', 'aria-label': 'Ground' }, ...tiles),
        r.switches.day === 'on' ? truthLine([{ text: 'Following the day', tone: 'on' }, switchLine('day', r).split('.')[0]!]) : null));
    }
    if (parts.includes('colour')) {
      const chips = COLOUR_KEYS.map((k) => choice({
        name: COLOUR_LABELS[k], label: `${COLOUR_LABELS[k]}: ${THEMES[k]?.tag ?? ''}`, on: r.colour === k, cls: 'colour',
        data: { choice: k, accent: k },
        face: eyeGlyph(26),
        onTap: () => change({ ...r, colour: k }, `Colour: ${COLOUR_LABELS[k]}`),
      }));
      blocks.push(h('section.gdial', { dataset: { dial: 'colour' } }, head('Colour', COLOUR_LABELS[r.colour], `${THEMES[r.colour]?.tag ?? COLOUR_LABELS[r.colour]}. A colour changes my light and nothing else.`),
        h('div.gchoices.colours', { role: 'radiogroup', 'aria-label': 'Colour' }, ...chips)));
    }
    if (parts.includes('world')) {
      const tiles = WORLDS.map((w) => choice({
        name: w.label, label: `${w.label}: ${w.line}`, on: r.world === w.key,
        data: { choice: w.key, world: w.key, ground, accent: r.colour },
        face: h('span.wface', h('i.g-floor'), h('span.wface-ret', h('span.g-ret-frame')), h('span.wface-plate')),
        onTap: () => change({ ...r, world: w.key }, `World: ${w.label}`),
      }));
      const wNow = worldOf(r.world)!;
      blocks.push(h('section.gdial', { dataset: { dial: 'world' } }, head('World', wNow.label, `${wNow.label}${/^[WD]\d$/.test(wNow.from) ? ` (${wNow.from})` : ''}: ${wNow.line.charAt(0).toLowerCase()}${wNow.line.slice(1)}`),
        h('div.gchoices.worlds', { role: 'radiogroup', 'aria-label': 'World' }, ...tiles),
        h('p.gdial-note', { dataset: { case: 'keep' } }, `${ORBIT_LINE} ${ROOMS_LINE}`)));
    }
    if (parts.includes('switches')) {
      const rows = SWITCHES.map((def) => {
        const keys = def.options.map((opt) => {
          const on = r.switches[def.key] === opt.value;
          const b = h('button.g-key.gsw', { type: 'button', role: 'radio', 'aria-checked': String(on), 'aria-pressed': String(on), 'aria-label': `${def.label}: ${opt.label}${on ? ', chosen' : ''}`, dataset: { case: 'keep', g: 'key', sw: def.key, val: String(opt.value) } }, h('span', opt.label));
          b.addEventListener('click', () => {
            if (r.switches[def.key] === opt.value) return;
            const switches = { ...r.switches, [def.key]: opt.value } as Switches;
            change({ ...r, switches }, `${def.label}: ${opt.label}`);
          });
          return b;
        });
        return h('div.gswitch', { dataset: { switch: def.key } },
          h('div.gswitch-text', h('span.gswitch-name', def.label), h('span.gswitch-line', { dataset: { case: 'keep' } }, switchLine(def.key, r))),
          h('div.gswitch-keys', { role: 'radiogroup', 'aria-label': def.label }, ...keys));
      });
      blocks.push(h('section.gdial', { dataset: { dial: 'switches' } }, head('Switches', String(SWITCHES.length), 'Each one changes one thing you can see, and I keep it.'), ...rows));
    }
    clear(el, ...blocks);
  };
  paint();
  const off = recipeEvents.on('change', paint);
  // the follow-the-day row keeps its clock true while it is on screen (the minute it flips)
  const tick = window.setInterval(() => el.isConnected && recipe().switches.day === 'on' && paint(), 60_000);
  return {
    el,
    paint,
    stop() {
      if (typeof off === 'function') off();
      clearInterval(tick);
    },
  };
}

/** A ground key as a NightKey (the dark ones), or the default night ground. */
export const asNight = (g: GroundKey, fallback: NightKey): NightKey => (g === 'paper' ? fallback : (g as NightKey));
