/**
 * What the jump bar lists, as a pure function (BRIEF-SHELL pass 1): which commands match what is typed, in which order and how
 * many, with his FAVOURITES and recents first when nothing is typed. commands/registry.ts draws these rows; the finding test
 * (apps/edge/test/finding.test.mjs) reads the same function, so "one typed word" and "two taps" are proved on the rule itself.
 */

export interface Command {
  id: string;
  title: string;
  /** More plain words it is found by (a screen's: its deck line and its YOU CAN lines, so "bins" finds HOME). */
  words?: string;
  group?: string;
  /** Single-key hotkey (ignored while typing) or 'mod+k' style. */
  keys?: string;
  /** Hidden commands still run, but are not listed in the palette. */
  hidden?: boolean;
  run: (args?: Record<string, unknown>) => void | Promise<void>;
}

/** The heading of each group of rows. */
export const GROUP_NAMES: Record<string, string> = {
  ASK: 'Ask Ghosty', FLY: 'Places', GO: 'Screens', THEME: 'Looks', SYSTEM: 'System', EYE: 'God’s eye', MEDIA: 'Media', TOOLS: 'Tools',
  RECENT: 'Recent', FAVOURITES: 'Favourites',
};
const groupName = (g?: string) => GROUP_NAMES[g ?? ''] ?? (g ? g.charAt(0) + g.slice(1).toLowerCase() : 'More');

/** What a query is matched against: the title without its "Theme: " style prefix, and the group's name. */
export const matchText = (c: Command) => `${c.title.replace(/^[A-Z][a-z]+: /, '')} ${groupName(c.group)}`;

export function fuzzy(q: string, s: string): number {
  q = q.toLowerCase();
  s = s.toLowerCase();
  if (!q) return 1;
  if (s.includes(q)) return 2 + (s.startsWith(q) ? 1 : 0);
  let i = 0;
  for (const ch of s) if (ch === q[i]) i++;
  return i === q.length ? 0.5 : 0;
}

/** How well a command matches: its title and group first; failing those, its plain words (found, but after the titles). */
export function score(q: string, c: Command): number {
  const s = fuzzy(q, matchText(c));
  if (s >= 2 || !q || !c.words) return s;
  return c.words.toLowerCase().includes(q.toLowerCase()) ? 1.5 : s;
}

/** How many rows the bar lists, and how many of one group when something is typed. */
export const ROWS = 12;
export const PER_GROUP = 3;

/**
 * The rows for `q`: the best twelve of the commands; with something typed (two letters or more) the `extra` rows ("Ask Ghosty …",
 * places) first, ASK before the rest; with nothing typed `rec` (his FAVOURITES, then his recents) before everything. At most
 * three of a group, except `rec`, which are his own lists in full; grouped under their headings.
 */
export function rankRows(cmds: Command[], q: string, o: { extra?: Command[]; rec?: Command[] } = {}): Command[] {
  const rec = o.rec ?? [];
  let items = cmds
    .filter((c) => !c.hidden)
    .map((c) => ({ c, s: score(q, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .map((x) => x.c)
    .slice(0, ROWS);
  const extra = o.extra ?? [];
  if (q.length > 1) items = [...extra.filter((c) => c.group === 'ASK'), ...extra.filter((c) => c.group !== 'ASK'), ...items];
  if (rec.length) items = [...rec, ...items.filter((c) => !rec.some((r) => r.id === c.id))];
  const seen = new Map<string, number>();
  items = items.filter((c) => {
    if (rec.includes(c)) return true;
    const n = seen.get(c.group ?? '') ?? 0;
    seen.set(c.group ?? '', n + 1);
    return n < PER_GROUP;
  });
  const order = [...new Set(items.map((c) => c.group ?? ''))];
  return order.flatMap((g) => items.filter((c) => (c.group ?? '') === g)).slice(0, ROWS);
}

/** A screen's command in the jump bar: found by its name, and by its plain words (its blurb, its deck name and promise and every YOU CAN line). */
export function tabCommand(t: { id: string; title: string; blurb?: string }, deck: Record<string, { name: string; promise: string; can: { text: string }[] } | undefined>, run: () => void): Command {
  const d = deck[t.id];
  return { id: `tab_${t.id}`, title: t.title, group: 'GO', words: [t.blurb ?? '', d?.name ?? '', d?.promise ?? '', ...(d?.can.map((l) => l.text) ?? [])].join(' '), run };
}
