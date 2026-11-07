/**
 * What the room plan can do on "that wall" / "there" (BRIEF-AWARENESS item 4: the chat's words act on what is selected, on the phone,
 * with no model). The planner (features/space/index.ts) sets these when it is mounted; assistant/thatone.ts calls them. Each
 * returns the sentence to say, or null when it could not act (nothing of that kind selected).
 */
export const spaceHooks: {
  /** The selected wall's real-length box brought up and focused: "The north wall: 3.2 m, how long?" */
  lengthSheet?: () => string | null;
  /** A piece of furniture (by the word he said) put against the selected wall, or where it fits. */
  addAt?: (word: string) => string | null;
  /** A door or a window on the selected wall. */
  openingOn?: (type: 'door' | 'window') => string | null;
} = {};

/** The catalogue's piece for a word he would say ("wardrobe", "a double bed", "sofa", "tv"); null for one it has not got. */
export function pieceFor(word: string, catalogue: { kind: string; label: string }[]): { kind: string; label: string } | null {
  const w = word.toLowerCase().replace(/^(?:a|an|the|my|some)\s+/, '').replace(/\s+/g, ' ').trim();
  if (!w) return null;
  const alias: [RegExp, string][] = [
    [/\bwardrobe|closet|cupboard\b/, 'wardrobe'],
    [/\bking\b/, 'king'],
    [/\bsingle bed|single\b/, 'single'],
    [/\bbed\b/, 'double'],
    [/\b3[- ]?seater|three[- ]seater|big sofa|couch\b/, 'sofa3'],
    [/\bsofa|settee|couch\b/, 'sofa2'],
    [/\barmchair|chair\b/, 'armchair'],
    [/\bdesk|workstation\b/, 'desk'],
    [/\bdining|table\b/, 'dining'],
    [/\btv|telly|television\b/, 'tv'],
    [/\bbookcase|bookshelf|bookshelves|shelves|shelf\b/, 'bookcase'],
  ];
  const hit = alias.find(([re]) => re.test(w))?.[1];
  return catalogue.find((c) => c.kind === hit) ?? catalogue.find((c) => c.label.toLowerCase().includes(w)) ?? null;
}
