/**
 * MIND MAPS IN THE WORKSPACE (editors.s8): a block of nodes and branches (the centre idea, its branches, theirs), drawn as a tree from the
 * left with the house's tokens, each node a 44 pt key. Any branch becomes to-dos in one tap: its branches' words (or its own, when it has
 * none) as to-dos under the map. In Markdown it goes out as a nested list (any app reads it) between two marks only Ghosty reads, and comes
 * back as a map. Pure: apps/edge/test/workspace.test.mjs.
 */
export interface MindNode {
  id: string;
  text: string;
  /** null: the centre. */
  parent: string | null;
}
let seq = 0;
export const nodeId = (): string => `m${Date.now().toString(36)}${(seq++).toString(36)}`;
export const MAX_NODES = 200;

export const rootOf = (ns: MindNode[]): MindNode | undefined => ns.find((n) => n.parent === null) ?? ns[0];
export const kidsOf = (ns: MindNode[], id: string): MindNode[] => ns.filter((n) => n.parent === id);
/** A node and every node under it. */
export function branchIds(ns: MindNode[], id: string): Set<string> {
  const out = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const n of ns) if (n.parent && out.has(n.parent) && !out.has(n.id)) {
      out.add(n.id);
      grew = true;
    }
  }
  return out;
}
export function addNode(ns: MindNode[], parent: string, text: string): { nodes: MindNode[]; id: string } | { error: string } {
  if (!ns.some((n) => n.id === parent)) return { error: 'That branch is not on the map any more.' };
  if (ns.length >= MAX_NODES) return { error: `A map holds ${MAX_NODES} ideas at most: start a second map for the rest.` };
  const id = nodeId();
  return { nodes: [...ns, { id, text: text.trim().slice(0, 200), parent }], id };
}
export const renameNode = (ns: MindNode[], id: string, text: string): MindNode[] => ns.map((n) => (n.id === id ? { ...n, text: text.trim().slice(0, 200) } : n));
/** A branch taken off with everything on it (the centre stays: it is cleared of its branches instead). */
export function removeNode(ns: MindNode[], id: string): MindNode[] {
  const n = ns.find((x) => x.id === id);
  if (!n) return ns;
  const gone = branchIds(ns, id);
  if (n.parent === null) gone.delete(id);
  return ns.filter((x) => !gone.has(x.id));
}
/** The to-dos a branch makes: its own branches' words, or its own words when it has none. */
export function branchTodos(ns: MindNode[], id: string): string[] {
  const n = ns.find((x) => x.id === id);
  if (!n) return [];
  const kids = kidsOf(ns, id).map((k) => k.text.trim()).filter(Boolean);
  return kids.length ? kids : n.text.trim() ? [n.text.trim()] : [];
}

export interface Placed {
  id: string;
  text: string;
  depth: number;
  /** Its row: the leaves are one a row, a parent sits at the middle of its children. */
  row: number;
}
/** The tree laid from the left: a column for each depth, a row for each leaf. */
export function layout(ns: MindNode[]): { nodes: Placed[]; edges: [string, string][]; rows: number; depth: number } {
  const root = rootOf(ns);
  if (!root) return { nodes: [], edges: [], rows: 0, depth: 0 };
  const out: Placed[] = [];
  const edges: [string, string][] = [];
  let next = 0;
  let deepest = 0;
  const seen = new Set<string>();
  const walk = (n: MindNode, depth: number): number => {
    seen.add(n.id);
    deepest = Math.max(deepest, depth);
    const kids = kidsOf(ns, n.id).filter((k) => !seen.has(k.id));
    let row: number;
    if (!kids.length) row = next++;
    else {
      const rows = kids.map((k) => {
        edges.push([n.id, k.id]);
        return walk(k, depth + 1);
      });
      row = (rows[0]! + rows[rows.length - 1]!) / 2;
    }
    out.push({ id: n.id, text: n.text, depth, row });
    return row;
  };
  walk(root, 0);
  return { nodes: out, edges, rows: next, depth: deepest };
}

/** The map as a nested Markdown list (two spaces a level), between Ghosty's marks. */
export function mindMd(ns: MindNode[]): string[] {
  const root = rootOf(ns);
  if (!root) return [];
  const lines = ['<!--ghosty:mind-->'];
  const walk = (n: MindNode, d: number, seen: Set<string>): void => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    lines.push(`${'  '.repeat(d)}- ${n.text.replace(/\n/g, ' ')}`);
    for (const k of kidsOf(ns, n.id)) walk(k, d + 1, seen);
  };
  walk(root, 0, new Set());
  lines.push('<!--/ghosty:mind-->');
  return lines;
}
/** A nested list read back as a map (the first line the centre). */
export function mindFromLines(lines: string[]): MindNode[] {
  const out: MindNode[] = [];
  const stack: { id: string; d: number }[] = [];
  for (const l of lines) {
    const m = /^(\s*)[-*+]\s+(.*)$/.exec(l);
    if (!m) continue;
    const d = Math.floor(m[1]!.replace(/\t/g, '  ').length / 2);
    while (stack.length && stack[stack.length - 1]!.d >= d) stack.pop();
    const id = nodeId();
    const parent = out.length ? (stack[stack.length - 1]?.id ?? out[0]!.id) : null;
    out.push({ id, text: m[2]!.trim(), parent });
    stack.push({ id, d });
  }
  return out;
}
