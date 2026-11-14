/**
 * MORE THAN ONE KIND OF THING TO MAKE (NEXT ROUND, comic.s5 one-panel joke, comic.s6 greeting card, comic.s2 picture book): the
 * same cast and drawing, a different shape. The phone's own writers here; Ghosty writes the same shapes when the brain is in
 * reach (script.ts asks with the shape's words). Posting anything is never done here: it is saved, or shared by his own tap.
 * Pure.
 */
import { newId, readIdea, writeComic, type Comic, type Page, type Panel } from './model';

export type Format = 'comic' | 'joke' | 'card' | 'book';
export const FORMATS: Format[] = ['comic', 'joke', 'card', 'book'];
export const FORMAT_NAMES: Record<Format, string> = { comic: 'A comic (four pages)', joke: 'A one-panel joke', card: 'A greeting card (three panels)', book: 'A picture book for children' };
/** What the brain is told the shape is (scriptAsk), and the least a script must hold to be drawn. */
export const FORMAT_ASK: Record<Format, { words: string; pages: number; panels: number; lines: number }> = {
  comic: { words: '', pages: 2, panels: 5, lines: 4 },
  joke: { words: 'This is a single-panel joke: exactly ONE PAGE with ONE PANEL, a caption that sets it up and one line that lands the punchline.', pages: 1, panels: 1, lines: 1 },
  card: { words: 'This is a greeting card: ONE PAGE with THREE PANELS: the greeting, the joke, and a warm last line for the person.', pages: 1, panels: 3, lines: 2 },
  book: { words: 'This is a picture book for a young child: SIX PAGEs with ONE PANEL each, big simple pictures, one or two short sentences a page as a CAPTION, gentle and kind, a happy ending.', pages: 1, panels: 4, lines: 0 },
};

const page = (panels: Panel[]): Page => ({ id: newId('g'), layout: 0, panels });
const pn = (p: Omit<Panel, 'id'>): Panel => ({ id: newId('p'), ...p });

/** A one-panel joke about his idea. */
export function writeJoke(idea: string, seed?: number): Comic {
  const c = writeComic({ idea, seed });
  const it = readIdea(idea);
  const H = c.cast[0]!;
  const lines = [
    [`${H.name} had been practising to ${it.goal} all week.`, 'Step one done. Step two is “find out what step two is”.'],
    [`The secret to how ${H.name} plans to ${it.goal}.`, 'There is no secret. That is the secret.'],
    [`${H.name}, moments before trying to ${it.goal}.`, 'What could possibly go wrong? (Everything. Everything could.)'],
  ];
  const [cap, line] = lines[(c.seed >>> 3) % lines.length]!;
  return {
    ...c, title: `${H.name}, in One Panel`, tagline: 'A one-panel joke.',
    pages: [page([pn({ scene: c.pages[0]!.panels[0]!.scene, time: 'day', shot: 'mid', actors: [{ who: H.id, mood: 'smug', pose: 'point', x: 0.4, face: 1 }, { who: c.cast[1]!.id, mood: 'think', pose: 'stand', x: 0.75, face: -1 }], balloons: [{ id: newId('b'), who: H.id, kind: 'speech', text: line! }], caption: cap!, sfx: '', beat: 'The setup and the punchline' })])],
  };
}

/** A greeting card as three panels: the greeting, the joke, the warm last line. `to` is who it is for. */
export function writeCard(idea: string, seed?: number): Comic {
  const c = writeComic({ idea, seed });
  const to = (/\b(?:for|to)\s+([A-Z][\w'-]+|mum|mom|dad|nan|gran|grandad|grandma|grandpa)\b/i.exec(idea)?.[1] ?? 'you').replace(/^(\w)/, (x) => x.toUpperCase());
  const thanks = /\b(?:thank|thanks)\b/i.test(idea);
  const H = c.cast[0]!;
  const F = c.cast[1]!;
  const greet = thanks ? `Thank you, ${to}!` : `Happy birthday, ${to}!`;
  return {
    ...c, title: thanks ? `Thank You, ${to}` : `Happy Birthday, ${to}`, tagline: thanks ? 'A card that says thank you.' : 'A card with a cake in it.',
    pages: [page([
      pn({ scene: 'home', time: 'day', shot: 'wide', actors: [{ who: H.id, mood: 'happy', pose: 'cheer', x: 0.45, face: 1 }], balloons: [{ id: newId('b'), who: H.id, kind: 'shout', text: greet }], caption: '', sfx: 'TA-DA!', beat: 'The greeting' }),
      pn({ scene: 'kitchen', time: 'day', shot: 'mid', actors: [{ who: H.id, mood: 'shock', pose: 'fall', x: 0.35, face: 1 }, { who: F.id, mood: 'calm', pose: 'stand', x: 0.75, face: -1 }], balloons: [{ id: newId('b'), who: F.id, kind: 'speech', text: thanks ? 'You were supposed to carry the cake, not wear it.' : 'You were supposed to light the candles, not the cake.' }], caption: thanks ? 'We tried to make you a cake.' : 'We made you a cake.', sfx: 'SPLAT!', beat: 'The joke' }),
      pn({ scene: 'home', time: 'dusk', shot: 'mid', actors: [{ who: H.id, mood: 'happy', pose: 'stand', x: 0.35, face: 1 }, { who: F.id, mood: 'happy', pose: 'cheer', x: 0.7, face: -1 }], balloons: [{ id: newId('b'), who: H.id, kind: 'speech', text: thanks ? 'Seriously, thank you. You are the best.' : 'Have the best day. You deserve all of it.' }], caption: '', sfx: '', beat: 'The warm last line' }),
    ])],
  };
}

/** A picture book: six pages of one big panel each, a short caption a page, from the comic's own beats. */
export function writeBook(idea: string, seed?: number): Comic {
  const c = writeComic({ idea, seed });
  const it = readIdea(idea);
  const H = c.cast[0]!;
  const F = c.cast[1]!;
  const beats: [string, Panel['scene'], 'happy' | 'sad' | 'think' | 'shock' | 'calm', 'cheer' | 'stand' | 'fall' | 'sit' | 'point' | 'jump'][] = [
    [`This is ${H.name}. ${H.name} wanted to ${it.goal} more than anything.`, c.pages[0]!.panels[0]!.scene, 'happy', 'cheer'],
    [`${H.name} tried, and tried, and tried again.`, 'park', 'think', 'stand'],
    ['Oh dear. It did not go to plan.', 'park', 'shock', 'fall'],
    [`${H.name} felt sad. Then ${F.name} came to sit close by.`, 'home', 'sad', 'sit'],
    [`“Let’s try together,” said ${F.name}. And so they did.`, 'park', 'happy', 'point'],
    [`And ${H.name} did it! The end.`, 'park', 'happy', 'jump'],
  ];
  return {
    ...c, title: `${H.name} and the Big Dream`, tagline: 'A picture book.',
    pages: beats.map(([text, scene, mood, pose], i) => page([pn({
      scene, time: i === 3 ? 'dusk' : 'day', shot: i === 0 ? 'wide' : 'mid',
      actors: [{ who: H.id, mood, pose, x: i >= 3 ? 0.36 : 0.5, face: 1 }, ...(i >= 3 ? [{ who: F.id, mood: 'happy' as const, pose: 'stand' as const, x: 0.72, face: -1 as const }] : [])],
      balloons: [], caption: text, sfx: '', beat: `Page ${i + 1}`,
    })])),
  };
}

export function writeFormat(format: Format, idea: string, seed?: number): Comic {
  return format === 'joke' ? writeJoke(idea, seed) : format === 'card' ? writeCard(idea, seed) : format === 'book' ? writeBook(idea, seed) : writeComic({ idea, seed });
}
