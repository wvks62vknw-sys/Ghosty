/**
 * The MAKE hub's instruments for the converter and the documents (shell/hubcards.ts), drawn in the hub's own line style
 * (ui/instruments.ts: `ln`, `ln2`, `lit`): a file turning into another, and a page of words with a heading.
 */
import { svgEl } from '../core/dom';

const path = (cls: string, d: string) => svgEl('path', { class: cls, d });
function art(...kids: SVGElement[]): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 160 92', class: 'inst i-art', 'aria-hidden': 'true', focusable: 'false' });
  s.append(...kids);
  return s;
}

/** A page with a folded corner becoming another, an arrow between them. */
export function convertInst(): SVGSVGElement {
  return art(
    path('ln', 'M26 14h28l10 10v54H26z'), path('ln2', 'M54 14v10h10'), path('ln2', 'M33 40h22M33 48h22M33 56h14'),
    path('lit', 'M72 46h18M84 39l7 7-7 7'),
    path('ln', 'M98 14h28l10 10v54H98z'), path('ln2', 'M126 14v10h10'), path('ln2', 'M106 36h22v24h-22z'),
  );
}

/** A page of words: its title, a heading lit, lines and a list. */
export function docsInst(): SVGSVGElement {
  return art(
    path('ln', 'M46 8h68v76H46z'), path('lit', 'M54 20h40'), path('ln2', 'M54 32h52M54 39h48M54 46h44'),
    path('ln', 'M54 58h22'), path('ln2', 'M58 66h40M58 73h32'), svgEl('circle', { class: 'ln2', cx: 55, cy: 66, r: 1.3 }), svgEl('circle', { class: 'ln2', cx: 55, cy: 73, r: 1.3 }),
  );
}
