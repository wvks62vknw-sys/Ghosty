/**
 * THE CREATIVE PACK (BRIEF-PACKS-2; OWNER-ISSUES 92 ④): ONE tool, `creative`, its abilities an `action` enum — described in
 * full only when his words turn the group on, named "creative pack" otherwise (tools/index.ts). A SONG: lyrics from the model
 * (original words only), the melody and chords made here in code and played, saved as a WAV or MIDI on his phone; chords; a
 * story's bones and a poem's rules for the model to write from, in his voice; a poster, a birthday card, a four-panel comic
 * strip and a logo drawn in code from shapes (our own: stick figures and shapes, said to be that); names; rhymes (Datamuse's
 * public list, no key); a palette from a photo or a colour; a drawing prompt a day; a beat he taps in. The pictures and the
 * sound are made by packages/shared/src/creative.ts and creativeart.ts and drawn and played by the phone's sheet; nothing is
 * ever copied from anyone's art, lyrics or music. Nothing is sent, nothing is searched for about a person.
 */
import { cardWords, toneOf, toneWords, VOICE_KEY, whenWords } from '../../../../packages/shared/src/people';
import { dayWords, prettyDay } from '../../../../packages/shared/src/packs';
import {
  acrostic,
  BEAT_STYLES,
  beatFromWords,
  beatGrid,
  beatOfGrid,
  checkPoem,
  chordWords,
  drawingPrompt,
  hashSeed,
  KEY_NAMES,
  makeChordLoop,
  makeSong,
  modeOf,
  nameIdeas,
  offlineRhymes,
  parseKey,
  parseTempo,
  POEM_FORMS,
  poemForm,
  rhymesFrom,
  rhymeUrl,
  storySeed,
  type Beat,
  type Mode,
  type NameKind,
} from '../../../../packages/shared/src/creative';
import { colourIn, colourName, harmony, logoSpec, posterFields, splitStory, themeFor, THEMES, type ThemeName } from '../../../../packages/shared/src/creativeart';
import { getJson, load, packTool, save, todayOf, wordsOf, type ActionFn, type PackDeps } from '../packs/base';
import { arg, type Tool } from './types';

export const CREATIVE_KEYS = { songs: 'creative:songs', beats: 'creative:beats', daily: 'creative:daily' } as const;

/** When the group is described in full: his words about making something. */
export const CREATIVE_WHEN = new RegExp(
  "\\b(?:(?:write|make|compose|create|invent|do|draw|design)\\s+(?:me\\s+)?(?:an?\\s+|some\\s+|my\\s+)?(?:song|lyrics|poem|haiku|limerick|sonnet|story|bedtime story|beat|poster|flyer|comic|cartoon|logo|palette|birthday card)s?|(?:song|poem|story) (?:about|for)|lyrics|melod(?:y|ies)|chord progression|chords? (?:in|for)|haiku|limerick|sonnet|acrostic|comic strip|a comic|a cartoon|birthday card|poster|flyer|logo|colou?r (?:palette|scheme)|palette from|(?:band|pet|team|baby|business) names?|names? (?:ideas )?for (?:my|a|the|our)|what (?:should|can) i (?:name|call)|rhymes? (?:with|for)|words that rhyme|drawing prompt|what should i draw|something to draw|drum (?:pattern|loop)|boom bap|four on the floor|my beat|a beat)\\b",
  'i',
);
export const CREATIVE_ABOUT =
  'You can make things with his creative pack (creative: song, story, poem, poster, comic, birthday, names, rhyme, palette, logo, prompt, beat, chords): drawn in code; original words only.';

const NOT_SENT = 'Shown for you to check; nothing is sent.';
const open = (args: Record<string, unknown>) => ({ name: 'open_creative', args });
const clock12 = (words: string): string => {
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i.exec(words) ?? null;
  if (m) return `${+m[1]!}${m[2] && m[2] !== '00' ? `:${m[2]}` : ''}${m[3]!.toLowerCase()}`;
  const h = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(words);
  if (!h) return '';
  const hh = +h[1]!;
  return `${hh % 12 || 12}${h[2] !== '00' ? `:${h[2]}` : ''}${hh >= 12 ? 'pm' : 'am'}`;
};
const seedOf = (a: Record<string, unknown>, fallback: string): number => {
  const given = arg.num(a, 'seed', NaN);
  return (Number.isFinite(given) ? Math.floor(Math.abs(given)) : hashSeed(fallback) + Math.max(0, Math.floor(arg.num(a, 'variant', 0))) * 7919) >>> 0;
};
const stringsOf = (v: unknown, max: number): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim().slice(0, 140)).filter(Boolean).slice(0, max) : []);

// ---------------------------------------------------------------- the actions

interface StoredSong {
  title: string;
  lyrics: string;
  key: string;
  mode: Mode;
  tempo: number;
  seed: number;
  at: number;
}
const MAJOR_KEYS = ['C', 'G', 'D', 'A', 'F', 'Bb'];
const MINOR_KEYS = ['A', 'E', 'D', 'B', 'G'];

const song: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const lyrics = arg.str(a, 'lyrics', false).replace(/\r/g, '').slice(0, 2400).trim();
  const stored = await load<StoredSong[]>(d, CREATIVE_KEYS.songs, []);
  if (!lyrics && /\b(again|last one|play (?:my|the) (?:last )?song|my (?:last )?song)\b/i.test(words) && stored[0]) {
    const s = stored[0];
    return { text: `Your last song, “${s.title}”, is open on your phone: ${s.key} ${s.mode}, ${s.tempo} bpm.`, open: open({ what: 'song', ...s }) };
  }
  const pk = parseKey(words);
  const mode: Mode = (['major', 'minor'] as const).find((m) => m === arg.str(a, 'mode', false)) ?? pk?.mode ?? modeOf(words) ?? 'major';
  const seed = seedOf(a, `${words}|${lyrics}`);
  const given = arg.str(a, 'key', false);
  const key = KEY_NAMES.find((k) => k === given) ?? (pk && pk.mode === mode ? pk.key : (mode === 'minor' ? MINOR_KEYS : MAJOR_KEYS)[seed % (mode === 'minor' ? MINOR_KEYS.length : MAJOR_KEYS.length)]!);
  const tempo = Math.min(200, Math.max(40, Math.round(arg.num(a, 'tempo', parseTempo(words) ?? (mode === 'minor' ? 84 : 104)))));
  if (lyrics.split('\n').filter((l) => l.trim()).length < 2) {
    return {
      text: `To make the song, write ORIGINAL lyrics now (never a real song's words): 8 to 16 short lines of 6 to 10 syllables, in verses and a chorus divided by blank lines (label the chorus "[Chorus]"), about ${words.replace(/^(?:write|make|compose|create)\s+(?:me\s+)?(?:an?\s+)?song\s*/i, '') || 'whatever he asked'}. Then call creative song again with lyrics= those lines. I have chosen ${key} ${mode} at ${tempo} bpm; the melody and the chords are made by code to fit your lines.`,
      data: { brief: true, key, mode, tempo, seed },
    };
  }
  const title = arg.str(a, 'title', false).slice(0, 50) || undefined;
  const s = makeSong({ lyrics, key, mode, tempo, seed, ...(title ? { title } : {}) });
  if (s.notes.length < 4) return { text: 'Those lines are too short to sing. Give me at least two lines of a few words each.' };
  const keep: StoredSong = { title: s.title, lyrics, key, mode, tempo, seed, at: d.now() };
  await save(d, CREATIVE_KEYS.songs, [keep, ...stored.filter((x) => x.title !== s.title)].slice(0, 5));
  const secs = Math.round((s.beats * 60) / tempo);
  return {
    text: `“${s.title}”: ${key} ${mode}, ${tempo} bpm, ${s.lines.length} lines over ${s.bars} bars (about ${secs} seconds). Chords: ${chordWords(s)}. The tune and chords are made by code from your words and seed ${seed}: the same words, key and tempo always give the same song. It plays on your phone, and you can save it as a WAV or a MIDI file. Say "in D minor" or "slower" for another take. The words must be your own or new: I never reproduce a real song.`,
    open: open({ what: 'song', title: s.title, lyrics, key, mode, tempo, seed }),
    data: { key, mode, tempo, seed, bars: s.bars, lines: s.lines.length },
  };
};

const STRUMS = ['D D U U D U', 'D – D U – U D U', 'D D U – U D U –', 'D U D U D U D U'];
const chords: ActionFn = async (a) => {
  const words = wordsOf(a);
  const pk = parseKey(words);
  const mode: Mode = pk?.mode ?? modeOf(words) ?? 'major';
  const seed = seedOf(a, words);
  const key = pk?.key ?? (mode === 'minor' ? MINOR_KEYS : MAJOR_KEYS)[seed % (mode === 'minor' ? MINOR_KEYS.length : MAJOR_KEYS.length)]!;
  const tempo = Math.min(200, Math.max(40, Math.round(arg.num(a, 'tempo', parseTempo(words) ?? 90))));
  const s = makeChordLoop({ key, mode, tempo, seed });
  return {
    text: `Chords in ${key} ${mode}: ${chordWords(s)}, four beats each, then round again. Try the strum ${STRUMS[seed % STRUMS.length]} (D down, U up). It plays on your phone at ${tempo} bpm with a simple tune over it. Say another key, or "sadder", for a different set.`,
    open: open({ what: 'song', title: s.title, lyrics: '', key, mode, tempo, seed }),
    data: { key, mode, tempo, seed },
  };
};

const story: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const tone = toneOf(await load<string[]>(d, VOICE_KEY, []));
  const sd = storySeed(`${words}|${arg.str(a, 'genre', false)}`, Math.max(0, Math.floor(arg.num(a, 'variant', 0))));
  return {
    text: `Write the story now, about ${sd.words} words, from this seed unless he gave his own idea (${words || 'no prompt'}):\n- hero: ${sd.hero}\n- place: ${sd.place}\n- wants: ${sd.want}\n- in the way: ${sd.blocker}\n- the turn: ${sd.turn}\n- ending: ${sd.ending}\nIn his voice: ${toneWords(tone)}. Original characters and plot only: nothing from an existing book, film or song. Show it to him; nothing is sent. He can say "another" for a new seed.`,
    data: { seed: sd },
  };
};

const poem: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const text = arg.str(a, 'text', false).slice(0, 3000);
  const form = (Object.keys(POEM_FORMS).find((f) => f === arg.str(a, 'form', false)) ?? poemForm(words)) as keyof typeof POEM_FORMS;
  const word = arg.str(a, 'word', false) || /\b(?:spelling|spells|for the word|acrostic (?:of|for))\s+([A-Za-z]{2,12})\b/i.exec(words)?.[1] || '';
  if (text.trim()) {
    const problems = checkPoem(form, text, word);
    return { text: problems.length ? `As a ${form}, it needs a little work: ${problems.join('; ')}. (Syllables are counted by rule, so allow one either way.)` : `That keeps the ${form} form (syllables are counted by rule, so a line may be one off). ${NOT_SENT}`, data: { form, problems } };
  }
  const topic = words.replace(/\b(?:write|make|compose|a|an|me|poem|haiku|limerick|sonnet|about|on|ode|acrostic)\b/gi, ' ').replace(/\s+/g, ' ').trim();
  let rhy = '';
  const target = topic.split(' ').filter((w) => w.length > 3).pop();
  if (target && ['limerick', 'couplets', 'sonnet', 'ode'].includes(form)) {
    try {
      const g = rhymesFrom(await getJson(d, rhymeUrl(target), 200_000, 6000), target);
      rhy = g.length ? `\nRhymes for "${target}" if they help: ${g.flatMap((x) => x.words).slice(0, 10).join(', ')}.` : '';
    } catch {
      /* no rhyme list now: the poem can still be written */
    }
  }
  return { text: `Write the ${form} now${topic ? ` about ${topic}` : ''}. The form: ${POEM_FORMS[form]}${form === 'acrostic' && word ? `\nScaffold:\n${acrostic(word)}` : ''}${rhy}\nOriginal words only. Show it to him; nothing is sent. To check it, call creative poem again with text= the poem.`, data: { form } };
};

const poster: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  const date = dayWords(words, today) || whenWords(words, today, '00:00')?.date || '';
  const time = clock12(words);
  const when = date ? `${prettyDay(date, today.slice(0, 4))}${time ? ` · ${time}` : ''}` : time;
  const fields = posterFields(arg.str(a, 'title', false) ? `${arg.str(a, 'title', false)}, ${words}` : words, when);
  const theme = (Object.keys(THEMES) as ThemeName[]).find((t) => t === arg.str(a, 'theme', false)) ?? themeFor(words);
  const f = { ...fields, ...(arg.str(a, 'title', false) ? { title: arg.str(a, 'title', false) } : {}), theme, seed: seedOf(a, words) };
  return { text: `Your poster, laid out on your phone: “${f.title}”${f.subtitle ? `, ${f.subtitle}` : ''}${f.lines?.length ? `, ${f.lines.join('; ')}` : ''} in the ${theme} look. Change any line there and it redraws; SAVE PNG puts the picture in your downloads. The title is as big as fits. ${NOT_SENT}`, open: open({ what: 'poster', ...f }), data: f };
};

const comic: ActionFn = async (a, d) => {
  void d;
  const words = wordsOf(a);
  const caps = stringsOf(a.captions, 4);
  const captions = caps.length === 4 ? caps : splitStory(caps.length ? caps.join('. ') : words.replace(/^(?:make|draw|do)\s+(?:me\s+)?(?:an?\s+)?(?:comic(?: strip)?|cartoon)\s+(?:about|of|where|with)?\s*/i, ''), 4);
  const names = stringsOf(a.names, 3);
  return { text: `Your four-panel comic, drawn on your phone: ${captions.map((c, i) => `${i + 1}. ${c}`).join(' ')}\nStick figures and shapes drawn by Ghosty in code, with the face each caption calls for: it is our own art, not anyone's. Edit a caption there and it redraws; SAVE PNG keeps it. ${NOT_SENT}`, open: open({ what: 'comic', captions, names, seed: seedOf(a, words) }), data: { captions, names } };
};

const birthday: ActionFn = async (a) => {
  const words = wordsOf(a);
  const name = arg.str(a, 'name', false) || /\b(?:for|to)\s+(?:my\s+)?([A-Z][\p{L}'’-]+)/u.exec(words)?.[1] || 'You';
  const age = Number(arg.str(a, 'age', false) || /\b(\d{1,3})(?:st|nd|rd|th)?\b/.exec(words)?.[1] || NaN);
  const style = (['warm', 'funny', 'short', 'formal'] as const).find((s) => s === arg.str(a, 'style', false) || new RegExp(`\\b${s}\\b`, 'i').test(words)) ?? 'warm';
  const message = arg.str(a, 'message', false) || cardWords({ occasion: 'birthday', name, style, ...(Number.isFinite(age) ? { age } : {}), ...(arg.str(a, 'from', false) ? { from: arg.str(a, 'from', false) } : {}) });
  return { text: `A birthday card for ${name}${Number.isFinite(age) ? ` (${age})` : ''}, drawn on your phone: balloons and confetti on the front, the message inside. Edit the words there; SAVE FRONT and SAVE INSIDE keep each side as a PNG to print or send yourself.\nInside:\n${message}\n${NOT_SENT}`, open: open({ what: 'birthday', name, ...(Number.isFinite(age) ? { age } : {}), message, seed: seedOf(a, name) }), data: { message } };
};

const names: ActionFn = async (a) => {
  const words = wordsOf(a);
  const kind: NameKind = (['band', 'pet', 'team'] as const).find((k) => k === arg.str(a, 'kind', false)) ?? (/\b(?:pet|dog|cat|puppy|kitten|rabbit|hamster|fish|bird|horse|guinea pig)\b/i.test(words) ? 'pet' : /\b(?:team|club|squad|league)\b/i.test(words) ? 'team' : 'band');
  const list = nameIdeas(kind, words, Math.max(0, Math.floor(arg.num(a, 'variant', 0))));
  return { text: list.length ? `Ten ${kind} names${list.length < 10 ? ` (that’s all I could make for those words)` : ''}:\n${list.map((n, i) => `${i + 1}. ${n}`).join('\n')}\nMade from my own word lists. Say "more" for another ten, or give me a theme (space, sea, garden…) or "starting with B".` : 'I couldn’t make a name from those words: give me a theme, like "space" or "garden".', data: { kind, names: list } };
};

const rhyme: ActionFn = async (a, d) => {
  const word = (arg.str(a, 'word', false) || /\brhym\w*\s+(?:with|for)\s+([A-Za-z'-]+)|\bwords that rhyme with\s+([A-Za-z'-]+)/i.exec(wordsOf(a))?.slice(1).find(Boolean) || wordsOf(a).split(/\s+/).pop() || '').toLowerCase().replace(/[^a-z'-]/g, '');
  if (!word) return { text: 'Which word? Say "rhymes with light".' };
  let groups: { sy: number; words: string[] }[] = [];
  try {
    groups = rhymesFrom(await getJson(d, rhymeUrl(word), 200_000, 7000), word);
  } catch {
    /* the public list did not answer: the small one below */
  }
  if (groups.length) return { text: `Rhymes with "${word}":\n${groups.map((g) => `- ${g.sy} syllable${g.sy === 1 ? '' : 's'}: ${g.words.join(', ')}`).join('\n')}\nFrom Datamuse's public word list; only the word is sent, nothing about you.`, data: { groups } };
  const small = offlineRhymes(word);
  return { text: small.length ? `Rhymes with "${word}" (the public rhyme list didn’t answer, so these are from my own short list): ${small.join(', ')}.` : `I couldn’t reach the public rhyme list just now, and "${word}" isn’t in my short one. Try again in a minute.` };
};

const palette: ActionFn = async (a) => {
  const words = wordsOf(a);
  const hex = colourIn(words);
  if (!hex) return { text: 'Show me a photo and I’ll pull its main colours out on your phone (your photo stays on the phone), or name a colour ("#3a7bd5", "teal") and I’ll find ones that go with it.', open: open({ what: 'palette', colours: [] }) };
  const h = harmony(hex);
  const all = [hex, ...h.complement, ...h.analogous, ...h.triad, ...h.shades.filter((x) => x !== hex)];
  return {
    text: `Colours that go with ${hex} (${colourName(hex)}), by the rules of the colour wheel:\n- opposite: ${h.complement.join(', ')}\n- neighbours: ${h.analogous.join(', ')}\n- triad: ${h.triad.join(', ')}\n- lighter, same, darker: ${h.shades.join(', ')}\nThey are open as swatches on your phone to copy.`,
    open: open({ what: 'palette', colours: [...new Set(all)].slice(0, 9) }),
    data: { hex, harmony: h },
  };
};

const logo: ActionFn = async (a) => {
  const words = wordsOf(a);
  const name = arg.str(a, 'name', false) || /\b(?:for|called|named)\s+(?:my\s+|the\s+|a\s+)?([A-Z][\p{L}'’& -]{1,26})/u.exec(words)?.[1]?.trim() || '';
  if (!name) return { text: 'What is the name to put under it? Say "a calm logo for Harbour Bakery".' };
  const vibe = arg.str(a, 'vibe', false) || words;
  const variant = Math.max(0, Math.floor(arg.num(a, 'variant', 0)));
  const spec = logoSpec(name, vibe, variant);
  return { text: `A logo sketch for ${spec.name}, drawn on your phone from shapes: a ${spec.shape} in ${colourName(spec.colours[0])} with ${spec.icon === 'none' ? 'the first letter' : `a ${spec.icon === 'bolt' ? 'bolt' : spec.icon}`} in ${colourName(spec.colours[2])}, the name under it. It’s a simple sketch of our own, not a finished brand. SAVE SVG or SAVE PNG keeps it; "another" gives a new look.`, open: open({ what: 'logo', name: spec.name, vibe, seed: variant }), data: { spec } };
};

const prompt: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const today = todayOf(d);
  if (/\b(stop|no more|turn off|don'?t)\b.*\b(daily|every day|each day|prompt)\b|\b(daily|every day) .*\boff\b/i.test(words)) {
    await save(d, CREATIVE_KEYS.daily, { on: false });
    return { text: 'The daily drawing prompt is off in your Brief.' };
  }
  const daily = /\b(every day|each day|daily|each morning|every morning)\b/i.test(words);
  if (daily) await save(d, CREATIVE_KEYS.daily, { on: true });
  const nth = Math.max(0, Math.floor(arg.num(a, 'variant', /\b(another|different|new one|again)\b/i.test(words) ? 1 : 0)));
  return { text: `${daily ? 'From now on the Brief shows a drawing prompt each day. ' : ''}Today's drawing prompt: ${drawingPrompt(today, nth)}\nSay "another" for a different one; the same prompt stays all day.`, data: { prompt: drawingPrompt(today, nth) } };
};

interface StoredBeat {
  name: string;
  bpm: number;
  grid: string;
}
const beat: ActionFn = async (a, d) => {
  const words = wordsOf(a);
  const kept = await load<StoredBeat[]>(d, CREATIVE_KEYS.beats, []);
  const grid = arg.str(a, 'grid', false);
  const bpmGiven = arg.num(a, 'bpm', parseTempo(words) ?? NaN);
  if (grid) {
    const b = beatOfGrid(grid, Number.isFinite(bpmGiven) ? bpmGiven : 100, arg.str(a, 'name', false).slice(0, 30) || 'my beat');
    if (!b) return { text: 'That grid isn’t four rows of sixteen steps (kick, snare, hat, clap, each "x" or "."). Tap your beat in on the phone and I’ll keep it.' };
    await save(d, CREATIVE_KEYS.beats, [{ name: b.name, bpm: b.bpm, grid: beatGrid(b) }, ...kept.filter((x) => x.name !== b.name)].slice(0, 10));
    return { text: `Kept “${b.name}” at ${b.bpm} bpm.\n${beatGrid(b)}`, data: { beat: b } };
  }
  if (/\b(my beats|saved beats|list)\b/i.test(words)) return { text: kept.length ? `Your beats: ${kept.map((b) => `${b.name} (${b.bpm} bpm)`).join('; ')}. Say "open my beat ${kept[0]!.name}" to play one.` : 'No beats kept yet. Say "a house beat at 124" or open the pads and tap one in.' };
  const mine = kept.find((b) => words.toLowerCase().includes(b.name.toLowerCase()) && /\b(open|play|my)\b/i.test(words));
  const b: Beat = mine ? (beatOfGrid(mine.grid, mine.bpm, mine.name) ?? beatFromWords(words)) : beatFromWords(words);
  return { text: `A ${b.name} beat at ${b.bpm} bpm, open as pads on your phone: tap the squares, or tap the drum pads along with the loop and each hit lands on the nearest sixteenth. SAVE keeps it; you can export it as a WAV or a MIDI file.\n${beatGrid(b)}\nStyles I know: ${BEAT_STYLES.join(', ')}.`, open: open({ what: 'beat', beat: b }), data: { beat: b } };
};

export const CREATIVE: Record<string, ActionFn> = { song, story, poem, poster, comic, birthday, names, rhyme, palette, logo, prompt, beat, chords };
export const CREATIVE_ACTIONS = Object.keys(CREATIVE);

export const creativeTools: Tool[] = [
  packTool({
    name: 'creative',
    description:
      "His creative pack: original words only, made in code on his phone, nothing sent. song: lyrics YOU write (a line each, blank line between verses), words = the topic, key, tempo, seed; the tune and chords come from code; with no lyrics it tells you what to write. chords: a progression (words: key, mood). story: a story's bones to write in his voice (words, genre). poem: the form's rules (words; form: haiku, limerick, sonnet, couplets, ode, acrostic, free; word) or a check of yours (text). poster: laid out from words (title, theme). comic: four panels (captions, names). birthday: a card (name, age, message, style). names: band, pet or team names (kind, words). rhyme: words that rhyme (word). palette: from a photo on his phone, or a colour (words). logo: a shape sketch (name, vibe). prompt: today's drawing prompt, or each day in the Brief. beat: a drum pattern (words: style, bpm) to tap in",
    actions: CREATIVE,
    properties: {
      words: { type: 'string', description: 'his words for it, as he said them' },
      lyrics: { type: 'string', description: 'song: the lyrics you wrote, one line per line, a blank line between sections' },
      title: { type: 'string', description: 'song, poster: a title' },
      key: { type: 'string', enum: [...KEY_NAMES], description: 'song: the key' },
      mode: { type: 'string', enum: ['major', 'minor'], description: 'song: major or minor' },
      tempo: { type: 'number', description: 'song, chords: beats a minute' },
      seed: { type: 'number', description: 'song, poster, comic, logo: for the same look again' },
      variant: { type: 'number', description: '1, 2… for another one of names, story, logo, prompt' },
      form: { type: 'string', enum: Object.keys(POEM_FORMS), description: 'poem: the form' },
      text: { type: 'string', description: 'poem: a poem to check' },
      word: { type: 'string', description: 'poem: the word an acrostic spells; rhyme: the word to rhyme' },
      genre: { type: 'string', description: 'story: a genre' },
      theme: { type: 'string', enum: Object.keys(THEMES), description: 'poster: the look' },
      captions: { type: 'array', items: { type: 'string' }, description: 'comic: the four captions' },
      names: { type: 'array', items: { type: 'string' }, description: 'comic: the characters' },
      name: { type: 'string', description: 'birthday: whose; logo: the name; beat: its name' },
      age: { type: 'number', description: 'birthday: the age' },
      message: { type: 'string', description: 'birthday: the words inside' },
      style: { type: 'string', enum: ['warm', 'funny', 'short', 'formal'], description: 'birthday: the style of the words' },
      kind: { type: 'string', enum: ['band', 'pet', 'team'], description: 'names: what for' },
      vibe: { type: 'string', description: 'logo: the feel (calm, bold, nature, playful, premium, tech…)' },
      grid: { type: 'string', description: 'beat: four rows kick/snare/hat/clap of 16 x or . to keep' },
      bpm: { type: 'number', description: 'beat: the tempo' },
    },
    reads: ['story', 'poem', 'poster', 'comic', 'birthday', 'names', 'rhyme', 'palette', 'logo', 'chords'],
  }),
];

/** The Brief's creative line (mind.ts): today's drawing prompt, when he asked for one each day. */
export async function creativeLines(d: PackDeps): Promise<string[]> {
  const on = await load<{ on?: boolean }>(d, CREATIVE_KEYS.daily, {});
  return on.on ? [`Drawing prompt: ${drawingPrompt(todayOf(d))}`] : [];
}
