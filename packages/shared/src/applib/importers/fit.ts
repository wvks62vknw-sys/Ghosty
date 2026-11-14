/**
 * FIT activity files (the binary format sports watches and bike computers record), decoded from the published FIT
 * protocol: the file header, definition and data messages (normal and compressed-timestamp headers, either byte order,
 * developer fields skipped), and chained files. Only the session (18), lap (19) and record (20) messages are kept.
 */
import { sportOf, type Activity, type Pt } from './route';

/** Seconds from 1970 to the FIT epoch, 31 December 1989 00:00 UTC. */
export const FIT_EPOCH = 631065600;
const SEMI = 180 / 2 ** 31;
const FIT_SPORTS: Record<number, string> = { 1: 'Run', 2: 'Ride', 5: 'Swim', 11: 'Walk', 17: 'Hike' };

interface Def { little: boolean; global: number; fields: { num: number; size: number; type: number }[]; devSize: number }

/** Reads one field value (undefined when the protocol's "invalid" value is set or the size is an array). */
function readField(v: DataView, o: number, size: number, type: number, little: boolean): number | undefined {
  const base = type & 0x1f;
  switch (base) {
    case 0: case 2: case 10: case 13: { if (size !== 1) return undefined; const x = v.getUint8(o); return x === 0xff || (base === 10 && x === 0) ? undefined : x; }
    case 1: { if (size !== 1) return undefined; const x = v.getInt8(o); return x === 0x7f ? undefined : x; }
    case 3: { if (size !== 2) return undefined; const x = v.getInt16(o, little); return x === 0x7fff ? undefined : x; }
    case 4: case 11: { if (size !== 2) return undefined; const x = v.getUint16(o, little); return x === 0xffff || (base === 11 && x === 0) ? undefined : x; }
    case 5: { if (size !== 4) return undefined; const x = v.getInt32(o, little); return x === 0x7fffffff ? undefined : x; }
    case 6: case 12: { if (size !== 4) return undefined; const x = v.getUint32(o, little); return x === 0xffffffff || (base === 12 && x === 0) ? undefined : x; }
    case 8: { if (size !== 4) return undefined; const x = v.getFloat32(o, little); return Number.isFinite(x) ? x : undefined; }
    case 9: { if (size !== 8) return undefined; const x = v.getFloat64(o, little); return Number.isFinite(x) ? x : undefined; }
    default: return undefined;
  }
}

/** The messages of a FIT file as { global number, fields by number }. */
export function fitMessages(bytes: Uint8Array): { global: number; f: Record<number, number> }[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const b8 = (i: number): number => bytes[i] ?? 0;
  const out: { global: number; f: Record<number, number> }[] = [];
  let p = 0;
  while (p + 12 <= bytes.length) {
    const hsize = b8(p);
    if (hsize < 12 || String.fromCharCode(b8(p + 8), b8(p + 9), b8(p + 10), b8(p + 11)) !== '.FIT') {
      if (!out.length) throw new Error('not a FIT file');
      break;
    }
    const dataSize = v.getUint32(p + 4, true);
    const end = Math.min(bytes.length, p + hsize + dataSize);
    let q = p + hsize;
    const defs = new Map<number, Def>();
    let lastTs = 0;
    while (q < end) {
      const h = b8(q++);
      if (h & 0x80) {
        // compressed timestamp header: local type in bits 5-6, a 5-bit time offset in bits 0-4
        const local = (h >> 5) & 3;
        const off = h & 0x1f;
        let ts = (lastTs & ~0x1f) + off;
        if (off < (lastTs & 0x1f)) ts += 0x20;
        lastTs = ts;
        const d = defs.get(local);
        if (!d) break;
        const f = readData(v, q, d);
        q += d.fields.reduce((s, x) => s + x.size, 0) + d.devSize;
        if (f[253] == null) f[253] = ts;
        out.push({ global: d.global, f });
        continue;
      }
      const local = h & 0x0f;
      if (h & 0x40) {
        const little = b8(q + 1) === 0;
        const global = little ? v.getUint16(q + 2, true) : v.getUint16(q + 2, false);
        const n = b8(q + 4);
        q += 5;
        const fields = [];
        for (let i = 0; i < n; i++) { fields.push({ num: b8(q), size: b8(q + 1), type: b8(q + 2) }); q += 3; }
        let devSize = 0;
        if (h & 0x20) {
          const dn = b8(q++);
          for (let i = 0; i < dn; i++) { devSize += b8(q + 1); q += 3; }
        }
        defs.set(local, { little, global, fields, devSize });
      } else {
        const d = defs.get(local);
        if (!d) break;
        const f = readData(v, q, d);
        q += d.fields.reduce((s, x) => s + x.size, 0) + d.devSize;
        if (f[253] != null) lastTs = f[253];
        out.push({ global: d.global, f });
      }
    }
    p = end + 2; // the file's CRC
  }
  return out;
}

function readData(v: DataView, q: number, d: Def): Record<number, number> {
  const f: Record<number, number> = {};
  let o = q;
  for (const x of d.fields) {
    if (o + x.size > v.byteLength) break;
    const val = readField(v, o, x.size, x.type, d.little);
    if (val !== undefined) f[x.num] = val;
    o += x.size;
  }
  return f;
}

/** A FIT file as activities: one per session, with the records that fall inside it. */
export function fitActivities(bytes: Uint8Array): Activity[] {
  const msgs = fitMessages(bytes);
  const pts: Pt[] = [];
  const sessions: Activity[] = [];
  for (const m of msgs) {
    const f = m.f;
    if (m.global === 20) {
      const p: Pt = {};
      if (f[253] != null) p.t = (f[253] + FIT_EPOCH) * 1000;
      if (f[0] != null && f[1] != null) { p.lat = f[0] * SEMI; p.lon = f[1] * SEMI; }
      const alt = f[78] ?? f[2];
      if (alt != null) p.ele = alt / 5 - 500;
      if (f[3] != null) p.hr = f[3];
      if (f[5] != null) p.d = f[5] / 100;
      pts.push(p);
    } else if (m.global === 18) {
      const a: Activity = { sport: (f[5] != null ? FIT_SPORTS[f[5]] : undefined) ?? sportOf(f[5]), pts: [] };
      if (f[2] != null) a.start = (f[2] + FIT_EPOCH) * 1000;
      const timer = f[8] ?? f[7];
      if (timer != null) a.moving = timer / 1000;
      if (f[9] != null) a.distance = f[9] / 100;
      if (f[11] != null) a.kcal = f[11];
      if (f[16] != null) a.hrAvg = f[16];
      if (f[22] != null) a.ascent = f[22];
      sessions.push(a);
    }
  }
  if (!sessions.length) return pts.length ? [{ sport: 'Other', pts }] : [];
  sessions.sort((a, b) => (a.start ?? 0) - (b.start ?? 0));
  sessions.forEach((s, i) => {
    const from = s.start ?? -Infinity;
    const to = sessions[i + 1]?.start ?? Infinity;
    s.pts = pts.filter((p) => p.t == null || (p.t >= from && p.t < to));
  });
  return sessions;
}
