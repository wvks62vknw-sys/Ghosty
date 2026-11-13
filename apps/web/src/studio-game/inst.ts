/** THE GAME STUDIO's instrument on the MAKE hub (shell/hubcards.ts): a small room, tiles and a hero, in the hub's own line style. */
import { svgEl } from '../core/dom';

const path = (cls: string, d: string) => svgEl('path', { class: cls, d });
export function gameInst(): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 160 92', class: 'inst i-art', 'aria-hidden': 'true', focusable: 'false' });
  s.append(
    path('ln', 'M24 14h112v64H24z'),
    path('ln2', 'M24 62h112M24 70h112'),
    path('ln2', 'M52 62v16M80 62v16M108 62v16'),
    path('ln', 'M64 40h24v8H64z'),
    path('lit', 'M42 40h12v22H42z'),
    path('ln2', 'M45 33h6v7h-6z'),
    path('lit', 'M112 52l6-8 6 8-6 6z'),
    path('ln2', 'M96 28a4 4 0 108 0 4 4 0 10-8 0'),
  );
  return s;
}
