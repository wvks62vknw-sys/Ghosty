/**
 * Edits that touch the whole timeline (BRIEF-EDITOR-VIDEO): SPLIT AT THE CUTS, CUT THE PAUSES (a ripple delete: the later
 * things move up by the time cut), and the overlay, title, music and voice items. Pure, each returns a changed copy.
 */
import { clipLen, flatTransform, newClip, place, sourceTime, splitAt, uid, type AudioItem, type Clip, type Cue, type Overlay, type Project, type Source } from './model';

const clone = <T,>(x: T): T => structuredClone(x);

/** Split at each of these timeline times (a split is the same length, so every time stays where it was). Returns how many were made. */
export function splitMany(p: Project, times: number[]): { p: Project; made: number } {
  let q = p;
  let made = 0;
  for (const t of [...times].sort((a, b) => a - b)) {
    const s = splitAt(q, t);
    if (s) {
      q = s;
      made++;
    }
  }
  return { p: q, made };
}

/**
 * Take the stretch [from, to) out of the timeline: the main clips lose it (a clip it cuts through becomes two), a transition at
 * a cut becomes a plain cut there, and the overlays, music, voice and subtitles after it move up by what was cut.
 */
export function rippleDelete(p: Project, from: number, to: number): Project {
  const d = to - from;
  if (d <= 0) return p;
  const q = clone(p);
  const pl = place(p.main);
  const main: Clip[] = [];
  for (const x of pl) {
    const c = clone(x.clip);
    const end = x.start + x.len;
    if (end <= from || x.start >= to) {
      main.push(c);
      continue;
    }
    if (x.start >= from && end <= to) continue; // all of it
    if (x.start < from) {
      const left: Clip = { ...clone(c), out: Math.round(sourceTime(c, from - x.start)), next: { kind: 'cut', len: 0 } };
      main.push(left);
    }
    if (end > to) {
      const right: Clip = { ...clone(c), id: x.start < from ? uid() : c.id, in: Math.round(sourceTime(c, to - x.start)), tr: x.start < from ? flatTransform() : c.tr };
      main.push(right);
    }
  }
  q.main = main.filter((c) => c.out - c.in >= 40);
  if (q.main.length) q.main[q.main.length - 1]!.next = { kind: 'cut', len: 0 };
  // a transition into a clip that was cut now has nothing right to overlap with: a clip's own `next` that is longer than its half is capped
  for (let i = 0; i < q.main.length - 1; i++) {
    const cap = Math.floor(Math.min(clipLen(q.main[i]!), clipLen(q.main[i + 1]!)) / 2);
    q.main[i]!.next.len = Math.min(q.main[i]!.next.len, cap);
    if (q.main[i]!.next.len < 100) q.main[i]!.next = { kind: 'cut', len: 0 };
  }
  const shift = <T extends { start: number }>(x: T, len: (x: T) => number, setLen: (x: T, n: number) => void): T | null => {
    const e = x.start + len(x);
    if (e <= from) return x;
    if (x.start >= to) return { ...x, start: x.start - d };
    if (x.start >= from) {
      if (e <= to) return null;
      return { ...x, start: from, ...(setLen(x, e - to), {}) };
    }
    setLen(x, len(x) - (Math.min(e, to) - from));
    return x;
  };
  const audio = (list: AudioItem[]) => list.map((a) => shift(clone(a), (z) => z.len, (z, n) => (z.len = n))).filter((a): a is AudioItem => !!a);
  q.music = audio(q.music);
  q.voice = audio(q.voice);
  q.overlays = q.overlays.map((o) => shift(clone(o), (z) => z.len, (z, n) => (z.len = n))).filter((o): o is Overlay => !!o);
  q.subs = q.subs
    .map((c) => {
      const cc = clone(c);
      if (cc.end <= from) return cc;
      if (cc.start >= to) return { ...cc, start: cc.start - d, end: cc.end - d };
      if (cc.start >= from) return cc.end <= to ? null : { ...cc, start: from, end: cc.end - d };
      return { ...cc, end: Math.max(cc.start + 100, cc.end - (Math.min(cc.end, to) - from)) };
    })
    .filter((c): c is Cue => !!c);
  return q;
}

/** Several stretches out, the last first so the earlier times stay true. */
export function cutRanges(p: Project, ranges: { from: number; to: number }[]): Project {
  let q = p;
  for (const r of [...ranges].sort((a, b) => b.from - a.from)) q = rippleDelete(q, r.from, r.to);
  return q;
}

export function addMain(p: Project, src: Source): Project {
  const q = clone(p);
  q.sources[src.id] = src;
  const c = newClip(src);
  if (!q.main.length) {
    q.w = src.w;
    q.h = src.h;
  }
  q.main.push(c);
  return q;
}

export function addTitle(p: Project, at: number, len: number, text = 'Your title'): { p: Project; id: string } {
  const q = clone(p);
  const used = q.overlays.filter((o) => at < o.start + o.len && at + len > o.start).map((o) => o.track);
  const o: Overlay = { id: uid(), track: used.includes(0) ? 1 : 0, start: Math.round(at), len, title: { text, pos: 'bottom', appear: 'fade', leave: 'fade' } };
  q.overlays.push(o);
  return { p: q, id: o.id };
}
export function addPip(p: Project, src: Source, at: number): { p: Project; id: string } {
  const q = clone(p);
  q.sources[src.id] = src;
  const c = newClip(src);
  const len = Math.round(Math.min(c.out - c.in, 6000, Math.max(1000, place(p.main).reduce((m, x) => Math.max(m, x.start + x.len), 0) - at)));
  c.out = c.in + len;
  const used = q.overlays.filter((o) => at < o.start + o.len && at + len > o.start).map((o) => o.track);
  const o: Overlay = { id: uid(), track: used.includes(0) ? 1 : 0, start: Math.round(at), len, clip: c, corner: 'br', size: 0.35 };
  q.overlays.push(o);
  return { p: q, id: o.id };
}
export function addAudio(p: Project, kind: 'music' | 'voice', src: Source, at: number): { p: Project; id: string } {
  const q = clone(p);
  q.sources[src.id] = src;
  const total = place(p.main).reduce((m, x) => Math.max(m, x.start + x.len), 0);
  const a: AudioItem = { id: uid(), src: src.id, start: Math.round(at), in: 0, len: Math.round(kind === 'voice' ? src.dur : Math.min(src.dur, Math.max(1000, total - at))), gain: kind === 'voice' ? 1 : 0.7, fadeIn: kind === 'music' ? 500 : 0, fadeOut: kind === 'music' ? 800 : 0 };
  q[kind].push(a);
  return { p: q, id: a.id };
}

/** Copy one clip's grade (and its LUT) to every other main clip. */
export function copyGrade(p: Project, from: string): Project | null {
  const src = p.main.find((c) => c.id === from);
  if (!src) return null;
  const q = clone(p);
  for (const c of q.main) {
    c.grade = clone(src.grade);
    // (the grade over time goes with it, from each clip's own start)
    if (src.gradeKeys?.length) c.gradeKeys = clone(src.gradeKeys);
    else delete c.gradeKeys;
    if (src.lut) c.lut = src.lut;
    else delete c.lut;
  }
  return q;
}

/**
 * A PHOTO FILM (NEXT ROUND, editors.s5): his photos as clips cut on the music's beat, each held for whole beats (at least 1.8 s, about
 * two seconds when the music has no beat I can find), drifting gently in and out (a slow zoom, the way a slideshow film moves), with the
 * song under it from its first beat so every cut lands on one. A new project's main track and music; nothing else is touched. Pure.
 */
export const FILM_MIN_MS = 1800;
export function photoFilm(p: Project, photos: Source[], song: Source | null, beat: { period: number; first: number } | null): Project {
  const q = clone(p);
  const period = beat && beat.period > 150 ? beat.period : 0;
  const hold = period ? Math.max(1, Math.ceil(FILM_MIN_MS / period)) * period : 2000;
  q.main = [];
  for (const [i, s] of photos.entries()) {
    q.sources[s.id] = s;
    const c = newClip(s);
    c.out = Math.round(hold * (i + 1)) - Math.round(hold * i);
    c.fit = 'fill';
    // a slow zoom, in on one photo and out on the next
    c.tr.keys.scale = i % 2 ? [{ t: 0, v: 1.1, ease: true }, { t: c.out, v: 1 }] : [{ t: 0, v: 1, ease: true }, { t: c.out, v: 1.1 }];
    q.main.push(c);
  }
  if (photos[0]) {
    q.w = photos[0].w;
    q.h = photos[0].h;
  }
  q.music = [];
  if (song) {
    q.sources[song.id] = song;
    const total = q.main.reduce((n, c) => n + (c.out - c.in), 0);
    const from = Math.max(0, Math.min(Math.round(beat?.first ?? 0), Math.max(0, song.dur - 1000)));
    q.music.push({ id: uid(), src: song.id, start: 0, in: from, len: Math.max(1000, Math.min(total, song.dur - from)), gain: 0.8, fadeIn: 300, fadeOut: 1500 });
  }
  return q;
}
