/**
 * The MAKE hub's instrument for the video editor (shell/hubcards.ts), in the hub's own line style (ui/instruments.ts: `ln`, `ln2`,
 * `lit`): a strip of clips with the playhead on it, and the picture above.
 */
import { svgEl } from '../core/dom';

const path = (cls: string, d: string) => svgEl('path', { class: cls, d });
export function videoInst(): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 160 92', class: 'inst i-art', 'aria-hidden': 'true', focusable: 'false' });
  s.append(
    path('ln', 'M52 8h56v34H52z'), path('lit', 'M75 18l14 7-14 7z'),
    path('ln2', 'M20 56h34v22H20zM56 56h24v22H56zM82 56h44v22H82zM128 56h14v22h-14z'),
    path('lit', 'M70 50v34'),
  );
  return s;
}
