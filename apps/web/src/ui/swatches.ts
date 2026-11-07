/**
 * THE TWELVE THEMES AS LIVE SWATCHES (BRIEF-DESIGN-SYSTEM 4, BRIEF-THEMES 2): one row per theme, drawn by the design system
 * itself in that theme's own accent block (`data-accent`: tokens.css), so a swatch is never a picture and never disagrees with
 * the theme it applies. Each row: the eye in its colour inside a reticle, the name, the tag line; the one in use is the
 * attended thing (a full box in its accent, IN USE in words, never colour alone). A tap applies it at once, everywhere, with
 * the toast; the phone keeps the pick (state/theme.ts). Settings → Theme and Settings → THE LOOK both show these.
 * `measure`: each row also prints its accent's worst contrast as text and as a line on the system's surfaces, read live.
 */
import { clear, h } from '../core/dom';
import { contrast, parseColour, ratioWords, type RGB } from '../design/contrast';
import { applyTheme, themeKey, THEMES } from '../state/theme';
import { settings } from '../state/app';
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
    const cur = themeKey(settings.get().theme);
    clear(el, ...Object.entries(THEMES).map(([k, t]) => {
      const on = cur === k;
      const reads = o.measure ? h('span.swread', { dataset: { case: 'keep' } }) : null;
      const b = h('button.swatch', { type: 'button', role: 'radio', 'aria-checked': String(on), 'aria-label': `${t.label}: ${t.tag}${on ? ', in use' : ''}`, dataset: { theme: k, accent: k, case: 'keep', g: 'swatch' } },
        h('span.swprev', { 'aria-hidden': 'true' }, h('span.g-ret-frame'), eyeGlyph(30)),
        h('span.swtxt', h('b', { dataset: { case: 'keep' } }, t.label), h('small', { dataset: { case: 'keep' } }, t.tag), reads),
        h('span.swstate', { 'aria-hidden': 'true', dataset: { case: 'keep' } }, on ? 'In use' : ''),
      );
      b.classList.toggle('on', on);
      b.addEventListener('click', () => {
        if (themeKey(settings.get().theme) === k) return;
        applyTheme(k);
        toast(`Theme: ${t.label}`, 'ok');
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
