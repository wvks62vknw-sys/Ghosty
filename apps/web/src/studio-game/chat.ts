/**
 * A GAME FROM THE CHAT (BRIEF-KERNEL-3 item 4): "make me a platformer about a fox" builds a studio game from the studio's OWN KIT and
 * nothing else: the studio's template for its rooms (painted from the kit's tiles), its own drawn sprites with the hero's body
 * re-coloured to an ink of the kit, one person who says the words the brain wrote, one quest, a save point. No model draws a sprite
 * or a tile; the brain's words are only the names and the dialogue. Pure: the brain's tool and the node test both run this file;
 * the phone saves the result to the studio's library and opens it, and nothing is ever published from here.
 */
import { INKS, PALETTES, hardProblems, makeId, newNpc, newQuest, readGame, template, type Game, type Kind, type Npc, type Quest, type Room } from './model';

export interface GameSpec {
  /** The name he gave it (a game of this name is kept in the studio's library). */
  name: string;
  kind?: Kind;
  /** One of the kit's worlds (PALETTES' ids). */
  world?: string;
  /** An ink of the kit (INKS' names, "Amber") the hero's body is painted in. */
  colour?: string;
  /** The person who talks: a name and what they say (the brain's words). */
  person?: string;
  lines?: string[];
  /** The one quest's name. */
  quest?: string;
}

const clean = (s: unknown, n: number): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, n) : '');
/** The ink (its index in the kit's sixteen) a colour word names, or -1. */
export const inkIndex = (word: string): number => INKS.findIndex((x, i) => i > 0 && x.name.toLowerCase() === word.trim().toLowerCase());
/** A frame with one ink swapped for another everywhere (the sprite sheet, re-coloured: 256 characters in, 256 out). */
export const recolour = (frame: string, from: number, to: number): string => frame.split('').map((c) => (c === from.toString(16) ? to.toString(16) : c)).join('');
/** The words a game's name is built from: letters, numbers and spaces, at most 40. */
const nameOf = (s: string): string => clean(s.replace(/[^\p{L}\p{N} '’-]/gu, ' '), 40) || 'My game';

export function gameFromChat(spec: GameSpec): Game {
  const kind: Kind = spec.kind === 'topdown' ? 'topdown' : 'platformer';
  const name = nameOf(spec.name);
  const g = template(kind === 'platformer' ? 'platformer' : 'adventure', name);
  g.id = makeId('g');
  const world = PALETTES.find((p) => p.id === spec.world)?.id;
  if (world) {
    g.palette = world;
    g.music = world;
    g.rooms[0]!.bg = world;
  }
  // the hero's body (ink 8, Amber) painted in an ink of the kit
  const ink = inkIndex(spec.colour ?? '');
  const hero = g.sprites.find((s) => s.id === 'hero');
  if (hero && ink > 0 && ink !== 8) for (const a of Object.keys(hero.anims) as (keyof typeof hero.anims)[]) hero.anims[a] = hero.anims[a]!.map((f) => recolour(f, 8, ink));
  const words = (spec.lines ?? []).map((l) => clean(l, 160)).filter(Boolean).slice(0, 8);
  const who = clean(spec.person, 24) || 'Mara';
  let npc: Npc | undefined = g.npcs[0];
  const first = g.rooms[0]!;
  const put = (r: Room, x: number, y: number, c: string): void => {
    r.rows[y] = r.rows[y]!.slice(0, x) + c + r.rows[y]!.slice(x + 1);
  };
  if (!npc) {
    npc = newNpc(g, who);
    g.npcs.push(npc);
    put(first, 6, 9, 'N');
    first.marks['6,9'] = npc.id;
    put(first, 30, 9, 'V');
    g.things.unshift({ id: 'coin', name: 'Coin', sprite: 'icon-coin', does: 'coin', door: '', value: 1 });
    const coin = template('blank').sprites.find((s) => s.id === 'icon-coin');
    if (coin && !g.sprites.some((s) => s.id === coin.id)) g.sprites.push(coin);
    const q: Quest = newQuest(g, clean(spec.quest, 40) || 'The first favour');
    q.steps = [{ t: 'talk', npc: npc.id }, { t: 'collect', thing: 'coin', n: 3 }, { t: 'talk', npc: npc.id }];
    q.reward = { coins: 5, item: '', door: '', line: 'Thank you. That is exactly what I needed.', inChest: false };
    g.quests.push(q);
    g.rules.end = 'quests';
  } else {
    npc.name = who;
    if (spec.quest && g.quests[0]) g.quests[0].name = clean(spec.quest, 40);
  }
  npc.name = who;
  if (words.length) npc.lines = words.map((text, i) => ({ text, once: i === 0 && words.length > 1 }));
  else if (!npc.lines.length) npc.lines = [{ text: 'Hello! Bring me three coins and I will thank you properly.', once: false }];
  g.at = Date.now();
  return g;
}

/** What a built game holds, in a line he reads (and the brain tells him). */
export function gameSummary(g: Game): string {
  const saves = g.rooms.reduce((n, r) => n + r.rows.reduce((m, row) => m + [...row].filter((c) => c === 'V').length, 0), 0);
  return `“${g.name}”: a ${g.kind === 'platformer' ? 'platformer' : 'top-down adventure'} of ${g.rooms.length} room${g.rooms.length === 1 ? '' : 's'}, ${g.sprites.length} sprites, ${g.npcs.length} ${g.npcs.length === 1 ? 'person' : 'people'} (${g.npcs.map((n) => n.name).join(', ')}), ${g.quests.length} quest${g.quests.length === 1 ? '' : 's'}${saves ? ` and ${saves} save point${saves === 1 ? '' : 's'}` : ''}`;
}

/** The game as the studio would read it back, and what would stop it playing (none for a built game). */
export function checked(g: Game): { game: Game; stops: string[] } | null {
  const r = readGame(JSON.parse(JSON.stringify(g)));
  return r ? { game: r.game, stops: hardProblems(r.game).map((p) => p.text) } : null;
}
