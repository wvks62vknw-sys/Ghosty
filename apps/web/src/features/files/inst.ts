/** FILES' instrument on the Me hub (shell/hubcards.ts): a folder with three sheets standing in it, in the hub's own line style. */
import { svgEl } from '../../core/dom';

const path = (cls: string, d: string) => svgEl('path', { class: cls, d });
export function filesInst(): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 160 92', class: 'inst i-art', 'aria-hidden': 'true', focusable: 'false' });
  s.append(
    path('ln2', 'M58 14h30l8 8v34H58z'),
    path('ln2', 'M66 8h30l8 8v34'),
    path('ln', 'M38 34h28l8 8h48v40H38z'),
    path('lit', 'M38 46h84'),
  );
  return s;
}
