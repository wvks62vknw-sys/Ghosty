/**
 * THE PRESETS AS LIVE SWATCHES (BRIEF-THEMES-2 5; BRIEF-DESIGN-SYSTEM 4): one row per preset — the twelve colours (Graphite + the
 * colour + The Scan), then the directions seen along the way (The Scan, The Map, The Eye, One Ink, Glass) — drawn by the design
 * system itself, so a swatch is never a picture and never disagrees with what it applies. Each row's preview shows the preset's
 * GROUND, COLOUR and FLOOR at once: it stands on its ground (`data-ground`), in its colour (`data-accent`) and its world
 * (`data-world`: the floor's points, grid or grain, and the world's corners), with the eye in its colour inside a reticle drawn
 * the world's way. The one in use is the attended thing (a full box in its accent, IN USE in words, never colour alone); a
 * recipe that is no preset says so above them: CUSTOM, kept exactly as set. A tap applies the preset at once, everywhere, with
 * the toast; the phone keeps it (state/theme.ts). Settings → Theme and Settings → THE LOOK both show these.
 * `measure`: each row also prints its accent's worst contrast as text and as a line on the ground in force, read live.
 */
import { clear, h } from '../core/dom';
import { contrast, parseColour, ratioWords, type RGB } from '../design/contrast';
import { applyPreset, presetNow, PRESETS, recipe, recipeNow } from '../state/theme';
import { COLOUR_LABELS, groundOf, worldOf } from '../../../../packages/shared/src/themes';
import { toast } from './components';
import { eyeGlyph } from './machine';

/** The worst contrast of a swatch's accent text and accent line over the system's three surfaces (read from the page). */
export function accentContrast(el: Element): { text: number; line: number } | null {
  const cs = getComputedStyle(el);
  const surf = ['--g-canvas', '--g-plate', '--g-plate-strong'].map((n) => parseColour(cs.getPropertyValue(n)));
  const text = parseColour(cs.getPropertyValue('--g-accent-text'));
  const line = parseColour(cs.getPropertyValue('--g-accent'));
  if (!text || !line || surf.some((s) => !s)) return null;
  const s = surf as RGB[];
  return { text: Math.min(...s.map((x) => contrast(text, x))), line: Math.min(...s.map((x) => contrast(line, x))) };
}

export function themeSwatches(o: { measure?: boolean; label?: string } = {}): { el: HTMLElement; paint(): void } {
  const el = h('div.swatches', { role: 'radiogroup', 'aria-label': o.label ?? 'Theme', dataset: { g: 'swatches' } });
  const paint = () => {
    const cur = presetNow()?.key ?? '';
    const r = recipe();
    // a recipe that is no preset: said above them, in use, kept exactly as set
    const custom = cur
      ? null
      : h('div.swcustom', { role: 'status', dataset: { case: 'keep', g: 'custom' } },
        h('span.swcustom-k', 'Custom'), h('span.swcustom-v', ...recipeNow(r).split(' · ').flatMap((part, i) => (i ? [' · ', h('span', part)] : [h('span', part)]))), h('span.swstate', 'In use'));
    clear(el, custom, ...PRESETS.map((p) => {
      const on = cur === p.key;
      const reads = o.measure ? h('span.swread', { dataset: { case: 'keep' } }) : null;
      // the directions say their recipe; the twelve are the colour on Graphite in The Scan
      const recipeLine = p.from ? `${groundOf(p.ground)!.label} · ${COLOUR_LABELS[p.colour]} · ${worldOf(p.world)!.label}` : '';
      const b = h('button.swatch', { type: 'button', role: 'radio', 'aria-checked': String(on), 'aria-label': `${p.label}: ${p.tag}${recipeLine ? ` (${recipeLine})` : ''}${on ? ', in use' : ''}`, dataset: { theme: p.key, preset: p.key, accent: p.colour, case: 'keep', g: 'swatch' } },
        h('span.swprev', { 'aria-hidden': 'true', dataset: { ground: p.ground, world: p.world, accent: p.colour } }, h('i.g-floor'), h('span.g-ret-frame'), eyeGlyph(30)),
        h('span.swtxt', h('b', { dataset: { case: 'keep' } }, p.label), h('small', { dataset: { case: 'keep' } }, p.tag), recipeLine ? h('span.swrecipe', { dataset: { case: 'keep' } }, recipeLine) : null, reads),
        h('span.swstate', { 'aria-hidden': 'true', dataset: { case: 'keep' } }, on ? 'In use' : ''),
      );
      b.classList.toggle('on', on);
      b.addEventListener('click', () => {
        if (presetNow()?.key === p.key) return;
        applyPreset(p);
        toast(`Theme: ${p.label}`, 'ok');
      });
      return b;
    }));
    // the measured numbers, once the rows are in the page (they read their own computed tokens)
    if (o.measure) (el.isConnected ? measure() : requestAnimationFrame(measure));
  };
  const measure = () => {
    for (const b of el.querySelectorAll<HTMLElement>('.swatch')) {
      const m = accentContrast(b);
      const r = b.querySelector('.swread');
      if (r) r.textContent = m ? `Text ${ratioWords(m.text)} · line ${ratioWords(m.line)}` : '';
    }
  };
  return { el, paint };
}
