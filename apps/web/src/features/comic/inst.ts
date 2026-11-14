/** THE COMIC's instrument on the MAKE hub (shell/hubcards.ts): a page of panels with a speech balloon, in the hub's own line style. */
import { svgEl } from '../../core/dom';

const path = (cls: string, d: string) => svgEl('path', { class: cls, d });
export function comicInst(): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 160 92', class: 'inst i-art', 'aria-hidden': 'true', focusable: 'false' });
  s.append(
    path('ln', 'M40 8h80v76H40z'),
    path('ln2', 'M40 40h80M82 8v32M70 40v44'),
    path('lit', 'M90 16h22a4 4 0 014 4v6a4 4 0 01-4 4h-12l-6 5v-5h-4a4 4 0 01-4-4v-6a4 4 0 014-4z'),
    path('ln2', 'M52 32a6 6 0 1012 0 6 6 0 10-12 0M58 38v-0'),
    path('ln2', 'M82 74l10-14 10 14z'),
  );
  return s;
}
