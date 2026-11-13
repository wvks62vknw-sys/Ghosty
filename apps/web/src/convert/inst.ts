/**
 * The MAKE hub's instruments for the converter, the documents, the sheets, the slides and the workspace (shell/hubcards.ts), drawn in the hub's own line style
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

/** A slide: its frame, a title lit, a few lines and a picture, the talk's pointer under it. */
export function slidesInst(): SVGSVGElement {
  return art(
    path('ln', 'M28 10h104v60H28z'), path('lit', 'M38 22h46'), path('ln2', 'M38 34h36M38 42h30M38 50h34'), path('ln2', 'M92 32h30v24H92z'), path('ln2', 'M92 56l9-9 7 6 6-5'),
    path('ln2', 'M80 70v10M60 82h40'),
  );
}

/** A page of words: its title, a heading lit, lines and a list. */
export function docsInst(): SVGSVGElement {
  return art(
    path('ln', 'M46 8h68v76H46z'), path('lit', 'M54 20h40'), path('ln2', 'M54 32h52M54 39h48M54 46h44'),
    path('ln', 'M54 58h22'), path('ln2', 'M58 66h40M58 73h32'), svgEl('circle', { class: 'ln2', cx: 55, cy: 66, r: 1.3 }), svgEl('circle', { class: 'ln2', cx: 55, cy: 73, r: 1.3 }),
  );
}

/** A grid of cells: its first row lit, a column of figures and a total. */
export function sheetsInst(): SVGSVGElement {
  return art(
    path('ln', 'M30 12h100v72H30z'), path('lit', 'M30 24h100'), path('ln2', 'M30 36h100M30 48h100M30 60h100M30 72h100M64 12v72M98 12v72'),
    path('ln2', 'M36 42h22M36 54h18M36 66h20M104 42h20M104 54h14M104 66h18'), path('lit', 'M70 78h20'),
  );
}

/** A workspace: a page, a smaller page inside it, and a board of three columns lit at one card. */
export function workspaceInst(): SVGSVGElement {
  return art(
    path('ln', 'M24 10h46v70H24z'), path('lit', 'M31 22h24'), path('ln2', 'M31 32h30M31 40h26'), path('ln2', 'M34 52h30v22H34z'), path('ln2', 'M40 60h18M40 66h12'),
    path('ln', 'M82 14h16v56H82z'), path('ln', 'M102 14h16v38h-16z'), path('ln', 'M122 14h16v48h-16z'),
    path('lit', 'M86 22h8v8h-8z'), path('ln2', 'M86 38h8v8h-8z'), path('ln2', 'M106 22h8v8h-8z'), path('ln2', 'M126 22h8v8h-8z'), path('ln2', 'M126 36h8v8h-8z'),
  );
}

/** The editors together: a page of words, a grid, a slide and a board, side by side. */
export function editorsInst(): SVGSVGElement {
  return art(
    path('ln', 'M14 14h30v52H14z'), path('lit', 'M20 24h18'), path('ln2', 'M20 32h18M20 38h14M20 44h16'),
    path('ln', 'M48 14h30v52H48z'), path('lit', 'M48 26h30'), path('ln2', 'M48 38h30M48 50h30M63 14v52'),
    path('ln', 'M82 20h30v36H82z'), path('lit', 'M88 28h14'), path('ln2', 'M88 36h18M88 44h14M96 62v8M88 72h16'),
    path('ln', 'M116 14h8v52h-8z'), path('ln', 'M127 14h8v34h-8z'), path('ln', 'M138 14h8v44h-8z'), path('lit', 'M118 22h4v6h-4z'),
  );
}
