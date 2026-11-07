/**
 * What DESIGN A BUILD says about itself (BRIEF-AWARENESS; shell/awareness.ts): the thing he is making with its size, which side of
 * it is up (the plan, the bill, the build) and the part group lit. Pure: the design and the state go in.
 */
import type { ScreenContext, Selected } from '../../../../packages/shared/src/awareness';
import { groupLines, KIND_NAMES, type Design } from './kits';
import type { Side } from './state';

const SIDE_WORDS: Record<Side, string> = { plan: 'the plan', bill: 'the bill of materials', build: 'the build in 3-D' };
const lower = (s: string) => s.trim().toLowerCase();
const metres = (n: number) => `${Math.round(n * 100) / 100}`.replace(/(\.\d)0$/, '$1');

/** `screen`: 'studio' when the Studio's pane shows it, 'build' when the sheet does. */
export function buildContext(d: Design, side: Side, lit: string, screen = 'studio', now = Date.now()): ScreenContext {
  const p = d.params;
  const a = /^[aeiou]/i.test(KIND_NAMES[d.kind]) ? 'an' : 'a';
  const size = d.concept ? '' : ` ${metres(p.w)} × ${metres(p.d)} m`;
  let selected: Selected | undefined;
  const g = lit ? d.groups.find((x) => x.id === lit) : undefined;
  if (g) {
    const n = groupLines(d, g.id).lines.length;
    selected = { kind: 'group', id: g.id, label: `the ${lower(g.name)}`, detail: `${n} part${n === 1 ? '' : 's'} lit` };
  }
  return { screen, title: 'Design a build', line: `${a} ${lower(KIND_NAMES[d.kind])}${size}, ${SIDE_WORDS[side]}`, ...(selected ? { selected } : {}), at: now };
}
