/**
 * THE COMIC (FINAL ROUND, lane COMIC): what a comic made here is, and the writer that turns his idea into one. A comic is a
 * cast (each with a name and a look kept for every panel), a cover, and pages of panels on real grids; a panel holds its
 * scene, who is in it (their mood and pose), its balloons (speech, thought, a shout, a whisper), a caption and a sound
 * effect. The writer is ours and runs on the phone with no model: a beginning (the want and the plan), a turn (two tries that
 * go wrong, the low point, the rival, the odd idea) and an end (it works, then the rival's callback), with jokes built on
 * setups paid off later. Every line can be changed afterwards. Pure: no DOM.
 */

export type Species = 'person' | 'cat' | 'dog' | 'robot' | 'ghost' | 'alien' | 'bear' | 'rabbit';
export type Mood = 'happy' | 'sad' | 'angry' | 'shock' | 'think' | 'smug' | 'scared' | 'calm';
export type Pose = 'stand' | 'point' | 'cheer' | 'run' | 'jump' | 'sit' | 'fall';
export type Scene = 'town' | 'home' | 'park' | 'space' | 'sea' | 'forest' | 'stage' | 'lab' | 'kitchen' | 'school' | 'night' | 'plain';
export type Time = 'day' | 'dusk' | 'night';
export type Shot = 'wide' | 'mid' | 'close';
export type BalloonKind = 'speech' | 'thought' | 'shout' | 'whisper';

export interface Look {
  species: Species;
  skin: string;
  hair: string;
  /** 0 bald, 1 short, 2 spiky, 3 long, 4 bun, 5 curly */
  hairStyle: number;
  shirt: string;
  legs: string;
  /** 0 none, 1 cap, 2 top hat, 3 bow */
  hat: number;
  glasses: boolean;
  /** 0.82 to 1.12 */
  height: number;
}
export interface CastMember {
  id: string;
  name: string;
  role: 'hero' | 'friend' | 'rival' | 'extra';
  look: Look;
}
export interface Actor {
  who: string;
  mood: Mood;
  pose: Pose;
  /** 0 left to 1 right */
  x: number;
  /** which way they face */
  face: 1 | -1;
}
export interface Balloon {
  id: string;
  /** the cast id who says it */
  who: string;
  kind: BalloonKind;
  text: string;
}
export interface Panel {
  id: string;
  scene: Scene;
  time: Time;
  shot: Shot;
  actors: Actor[];
  balloons: Balloon[];
  caption: string;
  sfx: string;
  /** what the beat is for, said in one line (the script's own words) */
  beat: string;
}
export interface Page {
  id: string;
  /** an index into LAYOUTS for its panel count */
  layout: number;
  panels: Panel[];
}
export interface Comic {
  id: string;
  title: string;
  premise: string;
  idea: string;
  tagline: string;
  cast: CastMember[];
  pages: Page[];
  seed: number;
  made: number;
  edited: number;
}

/** A page's size as drawn (2:3, a comic book's shape). */
export const PAGE_W = 1000;
export const PAGE_H = 1500;
export const MARGIN = 34;
export const GUTTER = 18;

/** Real panel grids, by how many panels a page holds: each a list of [x, y, w, h] in fractions of the live area. */
export const LAYOUTS: Record<number, [number, number, number, number][][]> = {
  1: [[[0, 0, 1, 1]]],
  2: [
    [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]],
    [[0, 0, 1, 0.62], [0, 0.62, 1, 0.38]],
  ],
  3: [
    [[0, 0, 1, 0.42], [0, 0.42, 0.5, 0.58], [0.5, 0.42, 0.5, 0.58]],
    [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1, 0.5]],
    [[0, 0, 1, 1 / 3], [0, 1 / 3, 1, 1 / 3], [0, 2 / 3, 1, 1 / 3]],
  ],
  4: [
    [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
    [[0, 0, 1, 0.34], [0, 0.34, 0.5, 0.33], [0.5, 0.34, 0.5, 0.33], [0, 0.67, 1, 0.33]],
    [[0, 0, 0.6, 0.5], [0.6, 0, 0.4, 0.5], [0, 0.5, 0.4, 0.5], [0.4, 0.5, 0.6, 0.5]],
  ],
  5: [
    [[0, 0, 0.5, 0.33], [0.5, 0, 0.5, 0.33], [0, 0.33, 1, 0.34], [0, 0.67, 0.5, 0.33], [0.5, 0.67, 0.5, 0.33]],
    [[0, 0, 1, 0.4], [0, 0.4, 0.5, 0.3], [0.5, 0.4, 0.5, 0.3], [0, 0.7, 0.5, 0.3], [0.5, 0.7, 0.5, 0.3]],
  ],
  6: [
    [[0, 0, 0.5, 1 / 3], [0.5, 0, 0.5, 1 / 3], [0, 1 / 3, 0.5, 1 / 3], [0.5, 1 / 3, 0.5, 1 / 3], [0, 2 / 3, 0.5, 1 / 3], [0.5, 2 / 3, 0.5, 1 / 3]],
  ],
};
export const MAX_PANELS = 6;

/** The panels of a page in page pixels (the gutters taken out). */
export function panelRects(p: Pick<Page, 'layout' | 'panels'>, w = PAGE_W, h = PAGE_H, margin = MARGIN, gutter = GUTTER): { x: number; y: number; w: number; h: number }[] {
  const n = Math.max(1, Math.min(MAX_PANELS, p.panels.length));
  const set = LAYOUTS[n]!;
  const grid = set[((p.layout % set.length) + set.length) % set.length]!;
  const lw = w - margin * 2;
  const lh = h - margin * 2;
  return grid.map(([fx, fy, fw, fh]) => {
    const x0 = margin + fx * lw + (fx > 0 ? gutter / 2 : 0);
    const y0 = margin + fy * lh + (fy > 0 ? gutter / 2 : 0);
    const x1 = margin + (fx + fw) * lw - (fx + fw < 0.999 ? gutter / 2 : 0);
    const y1 = margin + (fy + fh) * lh - (fy + fh < 0.999 ? gutter / 2 : 0);
    return { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
  });
}
export const layoutCount = (n: number): number => LAYOUTS[Math.max(1, Math.min(MAX_PANELS, n))]!.length;

// ---------------------------------------------------------------- the dice (one seed, the same comic again)
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const pickOf = <T>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length]!;
let idn = 0;
export const newId = (p: string): string => `${p}${Date.now().toString(36)}${(idn++).toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

// ---------------------------------------------------------------- looks
const SKINS = ['#f6d3b3', '#e8b48f', '#c98e62', '#9a6440', '#6e4428', '#f1c6a0'];
const HAIRS = ['#2b1d14', '#5a3a1e', '#a0522d', '#e2b659', '#1b1b1b', '#c0c0c0', '#b8342f', '#4a3b8f'];
const SHIRTS = ['#e63946', '#1d6fd8', '#2a9d8f', '#f4a261', '#8e44ad', '#f1c40f', '#ff6f91', '#3a3a3a', '#16a085'];
const LEGS = ['#2c3e50', '#34495e', '#5d4037', '#1d3557', '#4a4a4a'];
const FURS: Partial<Record<Species, string[]>> = {
  cat: ['#f39c12', '#7f8c8d', '#2b2b2b', '#e9e3d5', '#d35400'],
  dog: ['#c68642', '#8d5524', '#f1e0c5', '#3b2f2f', '#e0ac69'],
  bear: ['#8d5524', '#5d4037', '#f5f5f5'],
  rabbit: ['#f5f5f5', '#bfa98a', '#9e9e9e'],
  robot: ['#b0bec5', '#90a4ae', '#ffd54f', '#80cbc4'],
  ghost: ['#f4f7fb'],
  alien: ['#7ed957', '#5ec2b7', '#b28dff'],
};
export function lookFor(species: Species, seed: number): Look {
  const r = rng(seed);
  const fur = FURS[species];
  return {
    species,
    skin: fur ? pickOf(r, fur) : pickOf(r, SKINS),
    hair: pickOf(r, HAIRS),
    hairStyle: species === 'person' ? Math.floor(r() * 6) : 0,
    shirt: pickOf(r, SHIRTS),
    legs: pickOf(r, LEGS),
    hat: r() < 0.22 ? (r() < 0.6 ? 1 : 3) : 0,
    glasses: r() < 0.25,
    height: 0.86 + r() * 0.24,
  };
}

// ---------------------------------------------------------------- reading his idea
const SPECIES_WORDS: [RegExp, Species][] = [
  [/\b(?:cat|kitten|kitty|moggy)s?\b/i, 'cat'],
  [/\b(?:dog|puppy|pup|doggo|hound)s?\b/i, 'dog'],
  [/\b(?:robot|android|droid|machine)s?\b/i, 'robot'],
  [/\b(?:ghost|spirit|phantom|spook)s?\b/i, 'ghost'],
  [/\b(?:alien|martian|ufo|space ?man)s?\b/i, 'alien'],
  [/\b(?:bear|teddy)s?\b/i, 'bear'],
  [/\b(?:rabbit|bunny|hare)s?\b/i, 'rabbit'],
];
const SCENE_WORDS: [RegExp, Scene][] = [
  [/\b(?:space|moon|mars|planet|rocket|astronaut|star|galaxy|alien|orbit)/i, 'space'],
  [/\b(?:sea|ocean|beach|pirate|boat|ship|fish|island|surf|mermaid)/i, 'sea'],
  [/\b(?:forest|wood|woods|camp|tree|jungle|dragon|wizard|knight|castle)/i, 'forest'],
  [/\b(?:school|class|teacher|exam|homework|maths|lesson)/i, 'school'],
  [/\b(?:cook|cake|pizza|bake|kitchen|food|chef|dinner|lunch|biscuit|sandwich|soup)/i, 'kitchen'],
  [/\b(?:lab|science|invent|experiment|robot|machine|time travel|gadget)/i, 'lab'],
  [/\b(?:band|sing|song|dance|talent|show|stage|concert|guitar|music|magic trick)/i, 'stage'],
  [/\b(?:park|football|race|run|garden|picnic|kite|bike|skate)/i, 'park'],
  [/\b(?:ghost|haunted|spooky|night|vampire|halloween|monster)/i, 'night'],
];
const NAMES_FOR: Record<Species, string[]> = {
  person: ['Sam', 'Maya', 'Leo', 'Priya', 'Max', 'Zara', 'Omar', 'Ruby', 'Finn', 'Ava', 'Kai', 'Nia'],
  cat: ['Whiskers', 'Mittens', 'Biscuit', 'Pickle', 'Noodle', 'Captain Fluff'],
  dog: ['Rex', 'Bisky', 'Pepper', 'Barkley', 'Waffles', 'Sergeant Sniff'],
  robot: ['Bolt', 'Unit 7', 'Sprocket', 'Beep', 'Gizmo'],
  ghost: ['Boo', 'Wisp', 'Casper-Jones', 'Misty'],
  alien: ['Zib', 'Glorp', 'Xenna', 'Blip'],
  bear: ['Bruno', 'Honey', 'Big Ted'],
  rabbit: ['Hopps', 'Clover', 'Thumper-Jo'],
};
const FRIENDS = ['Pip', 'Jo', 'Tess', 'Ravi', 'Mo', 'Lulu', 'Ted', 'Ines'];
const RIVALS = ['Victor Smugly', 'Bea Better', 'Rex Rival', 'Dame Snoot', 'Professor Gloat', 'Brad Boast'];
const ODD_WAYS: [string, string][] = [
  ['backwards', 'Backwards. Obviously.'],
  ['while singing', 'With a song. Loudly.'],
  ['together', 'Together, this time.'],
  ['upside down', 'Upside down. Don’t ask.'],
  ['very, very slowly', 'Very, very slowly.'],
  ['with a sandwich', 'With a sandwich. For courage.'],
];
const PLACES: Record<Scene, string> = {
  town: 'Puddleton, a small town', home: 'Home', park: 'The park', space: 'Somewhere above the clouds', sea: 'The seaside', forest: 'Deep in the woods',
  stage: 'The town hall', lab: 'The garage lab', kitchen: 'The kitchen', school: 'School', night: 'A dark and stormy night', plain: 'Somewhere',
};

const cap1 = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const tidy = (s: string) => s.replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();

export interface IdeaRead {
  /** what it is about, as he said it */
  about: string;
  /** who the hero is ("a cat"): their species */
  species: Species;
  /** the hero's name when he gave one */
  name: string;
  /** the want, as "fly to the moon" (an infinitive without "to") */
  goal: string;
  scene: Scene;
}
/** His words read for a hero, a want and a place. */
export function readIdea(idea: string): IdeaRead {
  let about = tidy(idea)
    .replace(/^(?:please\s+)?(?:can you\s+)?(?:make|write|draw|create|do|give)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+|another\s+)?(?:new\s+|full\s+|funny\s+|short\s+|proper\s+)*(?:comic(?:\s+(?:book|strip))?|cartoon|graphic novel)\s*/i, '')
    .replace(/^(?:about|where|in which|with|of|on)\s+/i, '')
    .trim();
  if (!about) about = 'a cat who wants to fly';
  const species = SPECIES_WORDS.find(([re]) => re.test(about))?.[1] ?? 'person';
  const named = /\b(?:called|named)\s+([A-Z][\w'-]+(?:\s[A-Z][\w'-]+)?)/.exec(about) ?? /\bmy\s+(?:cat|dog|robot|rabbit|bear|friend|brother|sister|son|daughter)\s+([A-Z][\w'-]+)/.exec(about);
  let goal = '';
  const want = /\b(?:who|that|which)?\s*(?:wants?|wanted|tries|tried|dreams?|hopes?|needs?|has|have|decides?|plans?|is trying|learns?|learning)\s+(?:to|of)\s+(.+)$/i.exec(about);
  const cant = /\b(?:who|that)\s+(?:can(?:'|’)?t|cannot|can not)\s+(.+)$/i.exec(about);
  if (want) goal = want[1]!.replace(/^being\b/i, 'be');
  else if (cant) goal = cant[1]!;
  else if (/\b(?:who|that)\s+(\w+s)\s+(.+)$/i.test(about)) {
    const m = /\b(?:who|that)\s+(\w+?)s\s+(.+)$/i.exec(about)!;
    goal = `${m[1]} ${m[2]}`;
  }
  goal = tidy(goal).replace(/\b(?:their|his|her)\b/gi, 'my');
  if (!goal) {
    const core = about.replace(/^(?:my|a|an|the|some)\s+/i, '');
    goal = SPECIES_WORDS.some(([re]) => re.test(about)) && core.split(' ').length <= 3 ? 'win the Great Puddleton Talent Show' : `win the Grand ${core.split(' ').slice(0, 4).map(cap1).join(' ')} Contest`;
  }
  const scene = SCENE_WORDS.find(([re]) => re.test(`${about} ${goal}`))?.[1] ?? 'town';
  return { about, species, name: named?.[1] ?? '', goal: goal.slice(0, 80), scene };
}

// ---------------------------------------------------------------- the writer
interface Ask {
  idea: string;
  seed?: number;
  hero?: string;
  friend?: string;
  rival?: string;
}
const sp = (who: string, text: string, kind: BalloonKind = 'speech'): Balloon => ({ id: newId('b'), who, kind, text });
const act = (who: string, mood: Mood, pose: Pose, x: number, face: 1 | -1 = 1): Actor => ({ who, mood, pose, x, face });

/** His idea as a whole comic: cast, cover words, and four pages (three, four, four and three panels). */
export function writeComic(a: Ask): Comic {
  const seed = a.seed ?? hashOf(a.idea);
  const r = rng(seed);
  const it = readIdea(a.idea);
  const heroName = (a.hero || it.name || pickOf(r, NAMES_FOR[it.species])).slice(0, 24);
  const friendName = (a.friend || pickOf(r, FRIENDS.filter((n) => n !== heroName))).slice(0, 24);
  const rivalName = (a.rival || pickOf(r, RIVALS)).slice(0, 24);
  const H = 'hero';
  const F = 'friend';
  const V = 'rival';
  const cast: CastMember[] = [
    { id: H, name: heroName, role: 'hero', look: lookFor(it.species, seed ^ 0x51) },
    { id: F, name: friendName, role: 'friend', look: lookFor(r() < 0.3 && it.species !== 'person' ? it.species : 'person', seed ^ 0xa7) },
    { id: V, name: rivalName, role: 'rival', look: { ...lookFor('person', seed ^ 0x3c), hat: 2, glasses: r() < 0.5 } },
  ];
  const G = it.goal;
  const Gnow = G.replace(/^be\b/i, 'become').replace(/^have\b/i, 'get');
  const S = it.scene;
  const home: Scene = S === 'space' ? 'lab' : S === 'night' ? 'home' : S === 'sea' ? 'town' : S;
  const [odd, oddCap] = pickOf(r, ODD_WAYS);
  const crash = pickOf(r, ['CRASH!', 'KER-SPLAT!', 'BONK!', 'THWUMP!']);
  const boom = pickOf(r, ['KA-BOOM!', 'KABLAM!', 'FWOOMP!', 'SPLOOSH!']);
  const whoosh = pickOf(r, ['WHOOSH!', 'ZWOOOM!', 'SHWING!', 'VROOOM!']);
  const yesterday = pickOf(r, ['You said that yesterday.', 'You said that last Tuesday.', 'You say that every morning.']);
  const score = pickOf(r, ['Ten out of ten for enthusiasm.', 'Nailed the landing. With your face.', 'Strong start. Bit of a middle. No end.']);
  const p = (scene: Scene, time: Time, shot: Shot, beat: string, actors: Actor[], balloons: Balloon[], caption = '', sfx = ''): Panel => ({ id: newId('p'), scene, time, shot, actors, balloons, caption, sfx, beat });

  const page1: Panel[] = [
    p(home, 'day', 'wide', 'The want: who the hero is and what they want, said out loud', [act(H, 'happy', 'cheer', 0.42)], [sp(H, `Today is the day. Today I ${Gnow}!`, 'shout')], `${PLACES[home]}. A perfectly ordinary morning.`),
    p(home, 'day', 'mid', 'The friend, who has heard this before', [act(H, 'smug', 'point', 0.32), act(F, 'calm', 'stand', 0.72, -1)], [sp(F, yesterday), sp(H, 'Yesterday I was not ready. Today I have a PLAN.')]),
    p(home, 'day', 'close', 'The plan, which is not a plan (the setup for later)', [act(H, 'smug', 'point', 0.4), act(F, 'think', 'stand', 0.8, -1)], [sp(H, `Step one: ${G}. Step two: there is no step two.`), sp(F, '…That’s the whole plan?', 'thought')]),
  ];
  const page2: Panel[] = [
    p(S, 'day', 'wide', 'The first try: big confidence', [act(H, 'happy', 'run', 0.3), act(F, 'calm', 'stand', 0.85, -1)], [sp(H, 'HERE I GOOOO!', 'shout')], 'Attempt number one.', whoosh),
    p(S, 'day', 'mid', 'It goes wrong; the friend’s dry line', [act(H, 'shock', 'fall', 0.38), act(F, 'calm', 'stand', 0.78, -1)], [sp(F, score)], '', crash),
    p(S, 'day', 'mid', 'The second try: now with safety (the setup)', [act(H, 'angry', 'stand', 0.35), act(F, 'think', 'stand', 0.75, -1)], [sp(H, 'Fine. This time, with a helmet. And a cushion. And a second cushion.'), sp(F, 'What could possibly go wrong?')], 'Attempt number two. Now with safety.'),
    p(S, 'day', 'mid', 'It goes wrong bigger: the line that comes back at the end', [act(H, 'shock', 'sit', 0.42), act(F, 'calm', 'stand', 0.8, -1)], [sp(H, '…Who put that there?'), sp(F, 'You did. Ten minutes ago.')], 'Several things, it turned out.', boom),
  ];
  const page3: Panel[] = [
    p(home, 'night', 'wide', 'The low point', [act(H, 'sad', 'sit', 0.45)], [sp(H, `Maybe I’m just not someone who can ${G}.`, 'whisper')], 'That evening.'),
    p(home, 'night', 'mid', 'The rival rubs it in', [act(V, 'smug', 'point', 0.66, -1), act(H, 'sad', 'sit', 0.28)], [sp(V, `Ha! Everyone knows you can’t ${G}, ${heroName}. Leave it to the professionals.`)]),
    p(home, 'night', 'mid', 'The turn: the friend’s odd idea', [act(F, 'happy', 'point', 0.66, -1), act(H, 'think', 'sit', 0.3)], [sp(F, `Wait. What if you did it… ${odd}?`), sp(H, 'That is the worst idea I have ever heard.')]),
    p(home, 'night', 'close', 'The hero changes their mind (the laugh is the pause)', [act(H, 'happy', 'cheer', 0.5)], [sp(H, '…I love it.')], 'A long pause.'),
  ];
  const page4: Panel[] = [
    p(S, 'day', 'wide', 'The payoff: it works, the odd way', [act(H, 'happy', 'jump', 0.38), act(V, 'shock', 'stand', 0.82, -1)], [sp(H, 'WHEEEEE!', 'shout'), sp(V, 'Impossible!', 'shout')], `The next morning. ${oddCap}`, whoosh),
    p(S, 'dusk', 'mid', 'Friends again, and a dig at the plan', [act(H, 'happy', 'cheer', 0.34), act(F, 'happy', 'stand', 0.7, -1)], [sp(H, `I did it! I really did it!`), sp(F, 'Told you. Well, I told you it was the worst idea. Same thing.')]),
    p(S, 'dusk', 'mid', 'The callback: the rival tries it too', [act(V, 'shock', 'sit', 0.5)], [sp(V, '…Who put that there?')], 'Meanwhile… THE END.', crash),
  ];
  const pages: Page[] = [
    { id: newId('g'), layout: 0, panels: page1 },
    { id: newId('g'), layout: 0, panels: page2 },
    { id: newId('g'), layout: 1, panels: page3 },
    { id: newId('g'), layout: 0, panels: page4 },
  ];
  const title = pickOf(r, [`${heroName}’s Big Plan`, `${heroName} Gives It a Go`, `${heroName} vs. Everything`, `The Amazing ${heroName}`]);
  const premise = `${heroName} (${it.about.length < 60 ? it.about : it.species === 'person' ? 'our hero' : `a ${it.species}`}) wants to ${G}. Two tries go wrong, ${rivalName} gloats, and ${friendName}’s odd idea, doing it ${odd}, is the one that works.`;
  return { id: newId('c'), title, premise, idea: a.idea.slice(0, 300), tagline: `In which ${heroName} tries to ${G}.`, cast, pages, seed, made: Date.now(), edited: Date.now() };
}

/** The words of the whole comic, page by page (the script he can read, and what the reader says aloud). */
export function scriptOf(c: Comic): string {
  const nameOf = (id: string) => c.cast.find((x) => x.id === id)?.name ?? id;
  const lines = [`${c.title.toUpperCase()}`, c.tagline, '', `Premise: ${c.premise}`, '', `Cast: ${c.cast.map((m) => `${m.name} (${m.role})`).join(', ')}`];
  c.pages.forEach((pg, i) => {
    lines.push('', `PAGE ${i + 1}`);
    pg.panels.forEach((pn, k) => {
      lines.push(`  Panel ${k + 1}. ${pn.beat}`);
      if (pn.caption) lines.push(`    CAPTION: ${pn.caption}`);
      for (const b of pn.balloons) lines.push(`    ${nameOf(b.who).toUpperCase()}${b.kind === 'speech' ? '' : ` (${b.kind})`}: ${b.text}`);
      if (pn.sfx) lines.push(`    SFX: ${pn.sfx}`);
    });
  });
  return lines.join('\n');
}

/** A blank panel for a page (the hero, calm, in the page's first scene). */
export function blankPanel(c: Comic, like?: Panel): Panel {
  return { id: newId('p'), scene: like?.scene ?? 'town', time: like?.time ?? 'day', shot: 'mid', actors: [act(c.cast[0]?.id ?? 'hero', 'calm', 'stand', 0.5)], balloons: [], caption: '', sfx: '', beat: 'A new panel' };
}

/** A comic as kept: checked on the way in, so a damaged copy can never draw nonsense. */
export function comicFrom(x: unknown): Comic | null {
  const c = x as Comic;
  if (!c || typeof c !== 'object' || typeof c.id !== 'string' || !Array.isArray(c.pages) || !Array.isArray(c.cast)) return null;
  if (!c.pages.every((p) => p && Array.isArray(p.panels) && p.panels.every((q) => q && Array.isArray(q.balloons) && Array.isArray(q.actors)))) return null;
  return c;
}

export const MOODS: Mood[] = ['happy', 'sad', 'angry', 'shock', 'think', 'smug', 'scared', 'calm'];
export const POSES: Pose[] = ['stand', 'point', 'cheer', 'run', 'jump', 'sit', 'fall'];
export const SCENES: Scene[] = ['town', 'home', 'park', 'space', 'sea', 'forest', 'stage', 'lab', 'kitchen', 'school', 'night', 'plain'];
export const TIMES: Time[] = ['day', 'dusk', 'night'];
export const SHOTS: Shot[] = ['wide', 'mid', 'close'];
export const KINDS: BalloonKind[] = ['speech', 'thought', 'shout', 'whisper'];
export const SPECIES: Species[] = ['person', 'cat', 'dog', 'robot', 'ghost', 'alien', 'bear', 'rabbit'];
