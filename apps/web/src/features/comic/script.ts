/**
 * GHOSTY WRITES, THE APP DRAWS (NEXT ROUND, comic.u2): the brain writes the script for his exact idea, in a small plain format
 * asked for in the message (no tool, no new prompt words), and the phone reads it into pages and panels drawn with the same cast,
 * so the characters still look the same in every panel. Anything the brain writes that the drawing cannot do (a place it has
 * no scene for, a mood it cannot draw) is mapped to the nearest one it can; a script too thin to be a comic is refused, and the
 * phone's own writer takes over. Pure.
 */
import { MOODS, newId, POSES, SCENES, SHOTS, TIMES, type Actor, type Balloon, type BalloonKind, type CastMember, type Comic, type Mood, type Page, type Panel, type Pose, type Scene, type Shot, type Time } from './model';

/** The message the brain is sent: the idea, the cast as the app will draw them, and the format to answer in. */
export function scriptAsk(idea: string, cast: CastMember[], style = ''): string {
  const who = cast.map((m) => `${m.role.toUpperCase()} = ${m.name} (${m.look.species === 'person' ? 'a person' : `a ${m.look.species}`})`).join('; ');
  return [
    `COMIC SCRIPT: write the script of a short, genuinely funny four-page comic book about: ${idea.trim().slice(0, 300)}.`,
    style ? `The kind of story: ${style}.` : '',
    `The cast, already drawn: ${who}. Use these names. Do not add other speaking characters.`,
    'Give it a beginning (what the hero wants), a turn (it goes wrong, then a new idea) and an end, with a joke set up early that pays off on the last page. Jokes should land: short lines, good timing, a final gag.',
    `Answer as text only, in exactly this format, and nothing else (no tool):`,
    'TITLE: the title',
    'TAGLINE: one line for the cover',
    'PAGE',
    `PANEL: place, time, shot | what this panel is for   (place one of: ${SCENES.join(', ')}; time one of: ${TIMES.join(', ')}; shot one of: ${SHOTS.join(', ')})`,
    `CAST: HERO mood pose; FRIEND mood pose   (who is in the panel; mood one of: ${MOODS.join(', ')}; pose one of: ${POSES.join(', ')})`,
    'CAPTION: optional narration',
    'HERO: a line of speech   (or HERO (thought): / HERO (shout): / HERO (whisper):)',
    'SFX: optional sound effect',
    'Four PAGEs; three or four PANELs on each; at most two lines of speech in a panel; every line under 90 characters.',
  ].filter(Boolean).join('\n');
}

const pick = <T extends string>(word: string, list: readonly T[], near: Record<string, T>, fallback: T): T => {
  const w = word.trim().toLowerCase();
  if ((list as readonly string[]).includes(w)) return w as T;
  for (const [k, v] of Object.entries(near)) if (w.includes(k)) return v;
  return fallback;
};
const NEAR_SCENE: Record<string, Scene> = { city: 'town', street: 'town', house: 'home', room: 'home', bedroom: 'home', garden: 'park', field: 'park', moon: 'space', planet: 'space', rocket: 'space', ocean: 'sea', beach: 'sea', boat: 'sea', wood: 'forest', jungle: 'forest', theatre: 'stage', hall: 'stage', workshop: 'lab', garage: 'lab', cafe: 'kitchen', restaurant: 'kitchen', class: 'school', office: 'home', sky: 'plain' };
const NEAR_TIME: Record<string, Time> = { morning: 'day', noon: 'day', afternoon: 'day', evening: 'dusk', sunset: 'dusk', dawn: 'dusk', midnight: 'night' };
const NEAR_SHOT: Record<string, Shot> = { long: 'wide', establishing: 'wide', medium: 'mid', closeup: 'close', 'close-up': 'close' };
const NEAR_MOOD: Record<string, Mood> = { joy: 'happy', excit: 'happy', glad: 'happy', cry: 'sad', upset: 'sad', mad: 'angry', furious: 'angry', surpris: 'shock', amaz: 'shock', puzzl: 'think', curious: 'think', proud: 'smug', afraid: 'scared', fright: 'scared', nervous: 'scared', neutral: 'calm', bored: 'calm' };
const NEAR_POSE: Record<string, Pose> = { wav: 'cheer', celebrat: 'cheer', walk: 'run', dash: 'run', leap: 'jump', fly: 'jump', crash: 'fall', trip: 'fall', slump: 'sit', kneel: 'sit', gestur: 'point' };

export interface ScriptRead {
  title: string;
  tagline: string;
  pages: Page[];
}

/** The brain's script, read into pages for this cast; null when it is too thin to be a comic (under two pages or five panels). */
export function readScript(text: string, cast: CastMember[]): ScriptRead | null {
  const roleOf = (word: string): string | null => {
    const w = word.trim().toLowerCase().replace(/[^a-z0-9 '’-]/g, '');
    const byRole = cast.find((m) => m.role === w || m.id === w);
    if (byRole) return byRole.id;
    const byName = cast.find((m) => m.name.toLowerCase() === w || m.name.toLowerCase().split(' ')[0] === w.split(' ')[0]);
    return byName?.id ?? null;
  };
  let title = '';
  let tagline = '';
  const pages: Page[] = [];
  let page: Page | null = null;
  let panel: Panel | null = null;
  const newPanel = (scene: Scene, time: Time, shot: Shot, beat: string) => {
    if (!page) {
      page = { id: newId('g'), layout: 0, panels: [] };
      pages.push(page);
    }
    if (page.panels.length >= 6) return null;
    panel = { id: newId('p'), scene, time, shot, actors: [], balloons: [], caption: '', sfx: '', beat: beat.slice(0, 120) || 'A panel' };
    page.panels.push(panel);
    return panel;
  };
  const lastScene = (): [Scene, Time] => {
    const p = (panel as Panel | null) ?? null;
    return p ? [p.scene, p.time] : ['town', 'day'];
  };
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.replace(/^[\s>*•-]+/, '').replace(/\*\*/g, '').trim();
    if (!line || /^```/.test(line)) continue;
    let m: RegExpExecArray | null;
    if ((m = /^title\s*:\s*(.+)$/i.exec(line))) title = m[1]!.replace(/^["“]|["”]$/g, '').trim().slice(0, 60);
    else if ((m = /^tagline\s*:\s*(.+)$/i.exec(line))) tagline = m[1]!.trim().slice(0, 120);
    else if (/^page\b/i.test(line)) {
      page = { id: newId('g'), layout: 0, panels: [] };
      pages.push(page);
      panel = null;
    } else if ((m = /^panel\b[^:]*:?\s*(.*)$/i.exec(line))) {
      const [where, beat = ''] = m[1]!.split('|');
      const parts = (where ?? '').split(',').map((x) => x.trim());
      const [s0, t0] = lastScene();
      newPanel(pick(parts[0] ?? '', SCENES, NEAR_SCENE, s0), pick(parts[1] ?? '', TIMES, NEAR_TIME, t0), pick(parts[2] ?? '', SHOTS, NEAR_SHOT, 'mid'), beat.trim());
    } else if ((m = /^cast\s*:\s*(.+)$/i.exec(line))) {
      const p = (panel as Panel | null) ?? newPanel(...lastScene(), 'mid', '');
      if (!p) continue;
      for (const bit of m[1]!.split(/[;,]/)) {
        const words = bit.trim().split(/\s+/);
        if (!words[0]) continue;
        // a name of two words ("Captain Fluff") is tried, whole, before a one-word name or role
        const two = words.slice(0, 2).join(' ').toLowerCase();
        const whole = words.length > 2 ? cast.find((m) => m.name.toLowerCase() === two)?.id : undefined;
        const id = whole ?? roleOf(words[0]);
        if (!id || p.actors.some((a) => a.who === id)) continue;
        const rest = words.slice(whole ? 2 : 1);
        p.actors.push({ who: id, mood: pick(rest[0] ?? '', MOODS, NEAR_MOOD, 'calm'), pose: pick(rest[1] ?? '', POSES, NEAR_POSE, 'stand'), x: 0.5, face: 1 });
      }
    } else if ((m = /^caption\s*:\s*(.+)$/i.exec(line))) {
      const p = (panel as Panel | null) ?? newPanel(...lastScene(), 'mid', '');
      if (p) p.caption = m[1]!.trim().slice(0, 140);
    } else if ((m = /^(?:sfx|sound(?: effect)?)\s*:\s*(.+)$/i.exec(line))) {
      const p = (panel as Panel | null) ?? newPanel(...lastScene(), 'mid', '');
      if (p) p.sfx = m[1]!.replace(/^["“]|["”]$/g, '').trim().slice(0, 24);
    } else if ((m = /^([A-Za-z][\w '’-]{0,30}?)\s*(?:\(([a-z]+)\))?\s*:\s*(.+)$/i.exec(line))) {
      const id = roleOf(m[1]!);
      if (!id) continue;
      const p = (panel as Panel | null) ?? newPanel(...lastScene(), 'mid', '');
      if (!p || p.balloons.length >= 3) continue;
      const k = (m[2] ?? '').toLowerCase();
      const kind: BalloonKind = k.startsWith('th') ? 'thought' : k.startsWith('sh') || k.startsWith('ye') ? 'shout' : k.startsWith('wh') ? 'whisper' : 'speech';
      const said = m[3]!.replace(/^["“]|["”]$/g, '').trim().slice(0, 160);
      if (said) p.balloons.push({ id: newId('b'), who: id, kind, text: said } satisfies Balloon);
    }
  }
  // tidy: empty pages out, every speaker in the panel, the cast spread across it facing each other
  const kept = pages.filter((p) => p.panels.length);
  for (const p of kept)
    for (const q of p.panels) {
      for (const b of q.balloons) if (!q.actors.some((a) => a.who === b.who)) q.actors.push({ who: b.who, mood: 'calm', pose: 'stand', x: 0.5, face: 1 });
      if (!q.actors.length && cast[0]) q.actors.push({ who: cast[0].id, mood: 'calm', pose: 'stand', x: 0.5, face: 1 });
      q.actors = q.actors.slice(0, 3);
      const n = q.actors.length;
      q.actors.forEach((a: Actor, i) => {
        a.x = n === 1 ? 0.5 : 0.25 + (i * 0.55) / (n - 1);
        a.face = n > 1 && i === n - 1 ? -1 : 1;
      });
    }
  const panels = kept.reduce((s, p) => s + p.panels.length, 0);
  const lines = kept.reduce((s, p) => s + p.panels.reduce((t, q) => t + q.balloons.length, 0), 0);
  if (kept.length < 2 || panels < 5 || lines < 4) return null;
  return { title, tagline, pages: kept.slice(0, 8) };
}

/** The local comic with the brain's script in place of the phone's own: the same cast (names and looks), its pages. */
export function withScript(base: Comic, s: ScriptRead): Comic {
  return { ...base, title: s.title || base.title, tagline: s.tagline || base.tagline, pages: s.pages, premise: `${base.premise.split('.')[0]}. Written by Ghosty for your idea.` };
}
