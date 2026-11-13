/**
 * THE APP'S OWN MP4 READER (BRIEF-EDITOR-VIDEO): the video track of a flat .mp4/.mov or a fragmented one (a recorder's), H.264 only:
 * its avcC, its size, and every sample's place in the file, its decode and presentation times and whether it is a sync sample.
 * With it, WebCodecs' decoder (reader.ts) gives the export every frame in turn instead of seeking a `<video>` for each one.
 * Edit lists are not read (a clip whose first frame is not at zero may be a frame or two out); HEVC and other codecs are said to
 * be "not here" (null), and the export then falls back to the phone's own player. Pure.
 */

export interface Sample {
  offset: number;
  size: number;
  /** Decode and presentation time, in timescale ticks. */
  dts: number;
  cts: number;
  key: boolean;
  dur: number;
}
export interface VideoTrackInfo {
  codec: string;
  description: Uint8Array;
  w: number;
  h: number;
  timescale: number;
  samples: Sample[];
}

interface Box {
  type: string;
  start: number;
  size: number;
}
const kids = (b: Uint8Array, from: number, to: number): Box[] => {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const out: Box[] = [];
  let p = from;
  while (p + 8 <= to) {
    let size = dv.getUint32(p);
    if (size === 1 && p + 16 <= to) size = Number(dv.getBigUint64(p + 8));
    if (size === 0) size = to - p;
    if (size < 8 || p + size > to) break;
    out.push({ type: String.fromCharCode(b[p + 4]!, b[p + 5]!, b[p + 6]!, b[p + 7]!), start: p, size });
    p += size;
  }
  return out;
};
const find = (b: Uint8Array, box: Box, ...path: string[]): Box | undefined => {
  let cur: Box | undefined = box;
  for (const t of path) cur = cur && kids(b, cur.start + 8, cur.start + cur.size).find((x) => x.type === t);
  return cur;
};

export function demuxMp4(b: Uint8Array): VideoTrackInfo | null {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const top = kids(b, 0, b.length);
  const moov = top.find((x) => x.type === 'moov');
  if (!moov) return null;
  const trak = kids(b, moov.start + 8, moov.start + moov.size).filter((x) => x.type === 'trak').find((t) => {
    const hd = find(b, t, 'mdia', 'hdlr');
    return hd && String.fromCharCode(...b.subarray(hd.start + 16, hd.start + 20)) === 'vide';
  });
  if (!trak) return null;
  const trackId = dv.getUint32(find(b, trak, 'tkhd')!.start + (b[find(b, trak, 'tkhd')!.start + 8] === 1 ? 28 : 20));
  const mdhd = find(b, trak, 'mdia', 'mdhd')!;
  const timescale = dv.getUint32(mdhd.start + (b[mdhd.start + 8] === 1 ? 28 : 20));
  const stbl = find(b, trak, 'mdia', 'minf', 'stbl');
  const stsd = stbl && find(b, stbl, 'stsd');
  if (!stbl || !stsd) return null;
  const entry = kids(b, stsd.start + 16, stsd.start + stsd.size)[0];
  if (!entry || (entry.type !== 'avc1' && entry.type !== 'avc3')) return null;
  const w = dv.getUint16(entry.start + 32);
  const h = dv.getUint16(entry.start + 34);
  const avcCbox = kids(b, entry.start + 86, entry.start + entry.size).find((x) => x.type === 'avcC');
  if (!avcCbox) return null;
  const description = b.slice(avcCbox.start + 8, avcCbox.start + avcCbox.size);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  const codec = `avc1.${hex(description[1]!)}${hex(description[2]!)}${hex(description[3]!)}`;
  const samples: Sample[] = [];
  const sbox = (t: string) => kids(b, stbl.start + 8, stbl.start + stbl.size).find((x) => x.type === t);
  const stsz = sbox('stsz');
  const stts = sbox('stts');
  if (stsz && stts && dv.getUint32(stsz.start + 16) > 0) {
    // a flat file: the tables
    const count = dv.getUint32(stsz.start + 16);
    const fixed = dv.getUint32(stsz.start + 12);
    const sizes = Array.from({ length: count }, (_, i) => (fixed ? fixed : dv.getUint32(stsz.start + 20 + i * 4)));
    const durs: number[] = [];
    for (let i = 0, p = stts.start + 16; i < dv.getUint32(stts.start + 12); i++, p += 8) for (let k = 0; k < dv.getUint32(p); k++) durs.push(dv.getUint32(p + 4));
    const stss = sbox('stss');
    const sync = stss ? new Set(Array.from({ length: dv.getUint32(stss.start + 12) }, (_, i) => dv.getUint32(stss.start + 16 + i * 4) - 1)) : null;
    const ctts = sbox('ctts');
    const cto: number[] = [];
    if (ctts) {
      const v1 = b[ctts.start + 8] === 1;
      for (let i = 0, p = ctts.start + 16; i < dv.getUint32(ctts.start + 12); i++, p += 8) for (let k = 0; k < dv.getUint32(p); k++) cto.push(v1 ? dv.getInt32(p + 4) : dv.getUint32(p + 4));
    }
    const stsc = sbox('stsc')!;
    const co = sbox('stco') ?? sbox('co64');
    if (!co || !stsc) return null;
    const wide = co.type === 'co64';
    const chunks = dv.getUint32(co.start + 12);
    const rows = Array.from({ length: dv.getUint32(stsc.start + 12) }, (_, i) => ({ first: dv.getUint32(stsc.start + 16 + i * 12), per: dv.getUint32(stsc.start + 20 + i * 12) }));
    let s = 0;
    let dts = 0;
    for (let c = 0; c < chunks && s < count; c++) {
      let per = rows[0]!.per;
      for (const r of rows) if (c + 1 >= r.first) per = r.per;
      let off = wide ? Number(dv.getBigUint64(co.start + 16 + c * 8)) : dv.getUint32(co.start + 16 + c * 4);
      for (let k = 0; k < per && s < count; k++, s++) {
        samples.push({ offset: off, size: sizes[s]!, dts, cts: dts + (cto[s] ?? 0), key: sync ? sync.has(s) : true, dur: durs[s] ?? 0 });
        off += sizes[s]!;
        dts += durs[s] ?? 0;
      }
    }
  } else {
    // a fragmented file: trex defaults, then each moof's runs
    const mvex = kids(b, moov.start + 8, moov.start + moov.size).find((x) => x.type === 'mvex');
    const trex = mvex && kids(b, mvex.start + 8, mvex.start + mvex.size).find((x) => x.type === 'trex' && dv.getUint32(x.start + 12) === trackId);
    const def = { dur: trex ? dv.getUint32(trex.start + 20) : 0, size: trex ? dv.getUint32(trex.start + 24) : 0, flags: trex ? dv.getUint32(trex.start + 28) : 0 };
    let dts = 0;
    for (const moof of top.filter((x) => x.type === 'moof')) {
      for (const traf of kids(b, moof.start + 8, moof.start + moof.size).filter((x) => x.type === 'traf')) {
        const tfhd = kids(b, traf.start + 8, traf.start + traf.size).find((x) => x.type === 'tfhd');
        if (!tfhd || dv.getUint32(tfhd.start + 12) !== trackId) continue;
        const fl = dv.getUint32(tfhd.start + 8) & 0xffffff;
        let p = tfhd.start + 16;
        let base = moof.start;
        if (fl & 1) {
          base = Number(dv.getBigUint64(p));
          p += 8;
        }
        if (fl & 2) p += 4;
        const d = { ...def };
        if (fl & 8) {
          d.dur = dv.getUint32(p);
          p += 4;
        }
        if (fl & 0x10) {
          d.size = dv.getUint32(p);
          p += 4;
        }
        if (fl & 0x20) d.flags = dv.getUint32(p);
        const tfdt = kids(b, traf.start + 8, traf.start + traf.size).find((x) => x.type === 'tfdt');
        if (tfdt) dts = b[tfdt.start + 8] === 1 ? Number(dv.getBigUint64(tfdt.start + 12)) : dv.getUint32(tfdt.start + 12);
        for (const trun of kids(b, traf.start + 8, traf.start + traf.size).filter((x) => x.type === 'trun')) {
          const tf = dv.getUint32(trun.start + 8) & 0xffffff;
          const v1 = b[trun.start + 8] === 1;
          const n = dv.getUint32(trun.start + 12);
          let q = trun.start + 16;
          let off = base;
          if (tf & 1) {
            off = base + dv.getInt32(q);
            q += 4;
          }
          let first = tf & 4 ? dv.getUint32(q) : -1;
          if (tf & 4) q += 4;
          for (let i = 0; i < n; i++) {
            const dur = tf & 0x100 ? dv.getUint32(q) : d.dur;
            if (tf & 0x100) q += 4;
            const size = tf & 0x200 ? dv.getUint32(q) : d.size;
            if (tf & 0x200) q += 4;
            let flags = d.flags;
            if (tf & 0x400) {
              flags = dv.getUint32(q);
              q += 4;
            } else if (i === 0 && first >= 0) flags = first;
            const co = tf & 0x800 ? (v1 ? dv.getInt32(q) : dv.getUint32(q)) : 0;
            if (tf & 0x800) q += 4;
            // sample_is_non_sync_sample is bit 16 of the flags; when no flags are given at all, only the first sample is trusted as a key
            const known = !!(tf & 0x400) || (i === 0 && first >= 0) || d.flags !== 0;
            samples.push({ offset: off, size, dts, cts: dts + co, key: known ? !(flags & 0x10000) : samples.length === 0, dur });
            off += size;
            dts += dur;
          }
          first = -1;
        }
      }
    }
  }
  if (!samples.length) return null;
  return { codec, description, w, h, timescale, samples };
}
