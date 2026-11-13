/**
 * THE APP'S OWN MP4 MUXER (BRIEF-EDITOR-VIDEO): a flat .mp4 — ftyp, mdat, moov — with one avc1 track (the avcC the encoder gave,
 * passed through byte for byte) and one mp4a track (esds from the encoder's AudioSpecificConfig), the sample tables stts, stss,
 * stsc, stsz and stco, and the durations right. No B-frames: the samples are in decode order with their own durations. The
 * samples of each track are written in chunks of about a second, the two tracks taking turns, so a player can start early.
 * No package: this is the file the brief names where it names mp4-muxer. Pure.
 */

export interface VideoSample {
  data: Uint8Array;
  /** Duration in microseconds. */
  dur: number;
  key: boolean;
}
export interface AudioSample {
  data: Uint8Array;
  /** Duration in sample-rate ticks (1024 for AAC). */
  dur: number;
}
export interface VideoTrack {
  width: number;
  height: number;
  /** The AVCDecoderConfigurationRecord (the encoder's `description`). */
  avcC: Uint8Array;
  samples: VideoSample[];
}
export interface AudioTrack {
  rate: number;
  channels: number;
  /** The AudioSpecificConfig (the encoder's `description`). */
  config: Uint8Array;
  samples: AudioSample[];
}
export const VIDEO_SCALE = 90_000;
const MOVIE_SCALE = 1000;

const u32 = (n: number) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const u16 = (n: number) => new Uint8Array([(n >>> 8) & 255, n & 255]);
const cat = (...p: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(p.reduce((n, x) => n + x.length, 0));
  let at = 0;
  for (const x of p) {
    out.set(x, at);
    at += x.length;
  }
  return out;
};
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));
const box = (type: string, ...body: Uint8Array[]): Uint8Array => {
  const b = cat(...body);
  return cat(u32(8 + b.length), ascii(type), b);
};
const full = (type: string, version: number, flags: number, ...body: Uint8Array[]) => box(type, new Uint8Array([version, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255]), ...body);
const zeros = (n: number) => new Uint8Array(n);
const MATRIX = cat(u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000));

/** Run-length table pairs for stts: [count, duration]. */
function runs(durs: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const d of durs) {
    const l = out[out.length - 1];
    if (l && l[1] === d) l[0]++;
    else out.push([1, d]);
  }
  return out;
}

interface Built {
  /** The track's samples as data, and how they are cut into chunks (a count of samples each). */
  datas: Uint8Array[];
  chunks: number[];
  durs: number[];
  sync: number[] | null;
  scale: number;
  stsd: Uint8Array;
  handler: 'vide' | 'soun';
  w: number;
  h: number;
  channels: number;
}

function videoStsd(t: VideoTrack): Uint8Array {
  const entry = box(
    'avc1', zeros(6), u16(1), u16(0), u16(0), zeros(12), u16(t.width), u16(t.height), u32(0x00480000), u32(0x00480000), u32(0), u16(1), zeros(32), u16(0x0018), u16(0xffff),
    box('avcC', t.avcC),
  );
  return full('stsd', 0, 0, u32(1), entry);
}
function audioStsd(t: AudioTrack): Uint8Array {
  const cfg = t.config;
  const dsi = cat(new Uint8Array([0x05, cfg.length]), cfg);
  const dec = cat(new Uint8Array([0x04, 13 + dsi.length, 0x40, 0x15, 0, 0, 0]), u32(0), u32(0), dsi);
  const sl = new Uint8Array([0x06, 1, 0x02]);
  const es = cat(new Uint8Array([0x03, 3 + dec.length + sl.length]), u16(0), new Uint8Array([0]), dec, sl);
  const entry = box('mp4a', zeros(6), u16(1), u16(0), u16(0), u32(0), u16(t.channels), u16(16), u16(0), u16(0), u32(t.rate * 65536 > 0xffffffff ? 0 : t.rate * 65536), full('esds', 0, 0, es));
  return full('stsd', 0, 0, u32(1), entry);
}

function trak(id: number, b: Built, offsets: number[], movieDur: number): Uint8Array {
  const dur = b.durs.reduce((n, d) => n + d, 0);
  const movieTicks = Math.round((dur / b.scale) * MOVIE_SCALE);
  void movieDur;
  const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(id), u32(0), u32(movieTicks), zeros(8), u16(0), u16(0), u16(b.handler === 'soun' ? 0x0100 : 0), u16(0), MATRIX, u32(b.w * 65536), u32(b.h * 65536));
  const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(b.scale), u32(dur), u16(0x55c4), u16(0));
  const hdlr = full('hdlr', 0, 0, u32(0), ascii(b.handler), zeros(12), ascii(b.handler === 'vide' ? 'VideoHandler\0' : 'SoundHandler\0'));
  const media = b.handler === 'vide' ? full('vmhd', 0, 1, zeros(8)) : full('smhd', 0, 0, zeros(4));
  const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
  const stts = full('stts', 0, 0, u32(runs(b.durs).length), ...runs(b.durs).map(([c, d]) => cat(u32(c), u32(d))));
  const stss = b.sync ? full('stss', 0, 0, u32(b.sync.length), ...b.sync.map((i) => u32(i))) : new Uint8Array(0);
  // stsc: runs of chunks holding the same number of samples
  const stscRows: [number, number][] = [];
  b.chunks.forEach((n, i) => {
    if (!stscRows.length || stscRows[stscRows.length - 1]![1] !== n) stscRows.push([i + 1, n]);
  });
  const stsc = full('stsc', 0, 0, u32(stscRows.length), ...stscRows.map(([first, n]) => cat(u32(first), u32(n), u32(1))));
  const stsz = full('stsz', 0, 0, u32(0), u32(b.datas.length), ...b.datas.map((d) => u32(d.length)));
  const stco = full('stco', 0, 0, u32(offsets.length), ...offsets.map((o) => u32(o)));
  const stbl = box('stbl', b.stsd, stts, stss, stsc, stsz, stco);
  return box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', media, dinf, stbl)));
}

/** The file as parts to join (so a large video is not copied once more here) and its total size. */
export function muxMp4(video: VideoTrack | null, audio: AudioTrack | null): { parts: Uint8Array[]; size: number } {
  const tracks: Built[] = [];
  if (video) {
    const durs = video.samples.map((s) => Math.max(1, Math.round((s.dur * VIDEO_SCALE) / 1e6)));
    const fps = Math.max(1, Math.round(video.samples.length / Math.max(1e-6, durs.reduce((n, d) => n + d, 0) / VIDEO_SCALE)));
    const per = fps;
    const chunks: number[] = [];
    for (let i = 0; i < video.samples.length; i += per) chunks.push(Math.min(per, video.samples.length - i));
    tracks.push({ datas: video.samples.map((s) => s.data), chunks, durs, sync: video.samples.flatMap((s, i) => (s.key ? [i + 1] : [])), scale: VIDEO_SCALE, stsd: videoStsd(video), handler: 'vide', w: video.width, h: video.height, channels: 0 });
  }
  if (audio) {
    const per = Math.max(1, Math.round(audio.rate / 1024));
    const chunks: number[] = [];
    for (let i = 0; i < audio.samples.length; i += per) chunks.push(Math.min(per, audio.samples.length - i));
    tracks.push({ datas: audio.samples.map((s) => s.data), chunks, durs: audio.samples.map((s) => s.dur), sync: null, scale: audio.rate, stsd: audioStsd(audio), handler: 'soun', w: 0, h: 0, channels: audio.channels });
  }
  // interleave: the chunk whose start time is earliest goes next
  const ftyp = box('ftyp', ascii('isom'), u32(0x200), ascii('isom'), ascii('iso2'), ascii('avc1'), ascii('mp41'));
  const mdatStart = ftyp.length + 8;
  const idx = tracks.map(() => ({ chunk: 0, sample: 0, time: 0 }));
  const offsets: number[][] = tracks.map(() => []);
  const body: Uint8Array[] = [];
  let at = mdatStart;
  for (;;) {
    let pick = -1;
    for (let k = 0; k < tracks.length; k++) {
      if (idx[k]!.chunk >= tracks[k]!.chunks.length) continue;
      if (pick < 0 || idx[k]!.time / tracks[k]!.scale < idx[pick]!.time / tracks[pick]!.scale) pick = k;
    }
    if (pick < 0) break;
    const t = tracks[pick]!;
    const s = idx[pick]!;
    offsets[pick]!.push(at);
    for (let i = 0; i < t.chunks[s.chunk]!; i++) {
      const d = t.datas[s.sample]!;
      body.push(d);
      at += d.length;
      s.time += t.durs[s.sample]!;
      s.sample++;
    }
    s.chunk++;
  }
  const mdat = cat(u32(at - mdatStart + 8), ascii('mdat'));
  const movieDur = Math.max(0, ...tracks.map((t) => Math.round((t.durs.reduce((n, d) => n + d, 0) / t.scale) * MOVIE_SCALE)));
  const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(MOVIE_SCALE), u32(movieDur), u32(0x00010000), u16(0x0100), zeros(10), MATRIX, zeros(24), u32(tracks.length + 1));
  const moov = box('moov', mvhd, ...tracks.map((t, i) => trak(i + 1, t, offsets[i]!, movieDur)));
  const parts = [ftyp, mdat, ...body, moov];
  return { parts, size: parts.reduce((n, p) => n + p.length, 0) };
}

// ---------------------------------------------------------------- reading the boxes back (the brain test and the export's own check)
export interface Box {
  type: string;
  start: number;
  size: number;
  kids: Box[];
}
const CONTAINERS = new Set(['moov', 'trak', 'mdia', 'minf', 'stbl', 'dinf']);
export function walkBoxes(b: Uint8Array, from = 0, to = b.length): Box[] {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Box[] = [];
  let p = from;
  while (p + 8 <= to) {
    const size = dv.getUint32(p);
    const type = String.fromCharCode(b[p + 4]!, b[p + 5]!, b[p + 6]!, b[p + 7]!);
    if (size < 8 || p + size > to) break;
    out.push({ type, start: p, size, kids: CONTAINERS.has(type) ? walkBoxes(b, p + 8, p + size) : [] });
    p += size;
  }
  return out;
}

/** What a flat .mp4 holds, read by the box walk: its tracks, each with its sample count and duration. */
export function describeMp4(b: Uint8Array): { tracks: { kind: string; samples: number; duration: number; scale: number; entry: string }[]; movieDuration: number } {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const moov = walkBoxes(b).find((x) => x.type === 'moov');
  const find = (bx: Box, path: string[]): Box | undefined => (path.length ? bx.kids.map((k) => (k.type === path[0] ? find(k, path.slice(1)) : undefined)).find(Boolean) : bx);
  const tracks = (moov?.kids ?? []).filter((k) => k.type === 'trak').map((tk) => {
    const hdlr = find(tk, ['mdia', 'hdlr'])!;
    const mdhd = find(tk, ['mdia', 'mdhd'])!;
    const stbl = find(tk, ['mdia', 'minf', 'stbl'])!;
    const stsz = stbl.kids.find((k) => k.type === 'stsz')!;
    const stsd = stbl.kids.find((k) => k.type === 'stsd')!;
    return {
      kind: String.fromCharCode(...b.subarray(hdlr.start + 16, hdlr.start + 20)),
      samples: dv.getUint32(stsz.start + 16),
      duration: dv.getUint32(mdhd.start + 24),
      scale: dv.getUint32(mdhd.start + 20),
      entry: String.fromCharCode(...b.subarray(stsd.start + 20, stsd.start + 24)),
    };
  });
  const mvhd = moov?.kids.find((k) => k.type === 'mvhd');
  return { tracks, movieDuration: mvhd ? dv.getUint32(mvhd.start + 24) : 0 };
}
