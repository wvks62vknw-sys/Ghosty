/** PAINT's instrument on the MAKE hub (shell/hubcards.ts): an easel's canvas with a brush stroke and a brush, in the hub's own line style. */
import { svgEl } from '../../core/dom';

const path = (cls: string, d: string) => svgEl('path', { class: cls, d });
export function paintInst(): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 160 92', class: 'inst i-art', 'aria-hidden': 'true', focusable: 'false' });
  s.append(
    path('ln', 'M46 10h68v56H46z'),
    path('ln2', 'M62 84l18-18 18 18M80 66v18'),
    path('lit', 'M54 50c10-18 22-26 34-22s18 14 18 4'),
    path('ln2', 'M118 20l20-12 4 6-20 12zM118 20l-6 10 10-4'),
  );
  return s;
}
