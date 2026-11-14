/**
 * The Apps card on the Home room's hub (shell/hubcards.ts CARDS.apps): a grid of app icons with the pinned ones lit, how many apps
 * the Library holds and how many he pinned, read from this phone only.
 */
import { svgEl } from '../../core/dom';
import type { HubCard } from '../../shell/hubcards';
import { allApps, appById, pinned } from './index';

const path = (cls: string, d: string) => svgEl('path', { class: cls, d });

/** Nine app tiles in a grid, the first lit: the shop window. */
export function appsInst(): SVGSVGElement {
  const s = svgEl('svg', { viewBox: '0 0 160 92', class: 'inst i-art', 'aria-hidden': 'true', focusable: 'false' });
  const tiles: SVGElement[] = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) tiles.push(path(r === 0 && c === 0 ? 'lit' : 'ln2', `M${50 + c * 22} ${12 + r * 24}h16v16h-16z`));
  s.append(...tiles, path('ln', 'M44 8h72v76H44z'));
  return s;
}

export const appsCard: HubCard = {
  title: 'Every app',
  status: () => 'READY',
  instrument: appsInst,
  readouts: () => [
    { label: 'In the Library', value: String(allApps().length), none: 'None yet' },
    { label: 'Pinned', value: pinned().length ? String(pinned().length) : null, none: 'None yet' },
  ],
  why: () => (pinned().length ? '' : 'Find an app, then pin it to Home'),
  say: () => {
    const p = pinned().map((id) => appById(id)?.name).filter(Boolean);
    return p.length ? `Pinned: ${p.slice(0, 3).join(', ')}${p.length > 3 ? ` and ${p.length - 3} more` : ''}` : `${allApps().length} apps, each kept on this phone`;
  },
  idle: 'Every app kept on this phone: say “open” and its name',
};
