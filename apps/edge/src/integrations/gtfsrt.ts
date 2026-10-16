/**
 * A hand-written reader for GTFS-realtime feeds: the protobuf format Transport for West Midlands
 * and the Bus Open Data Service publish live bus and tram positions in. The Worker may not add
 * npm packages, so this is the protobuf wire format in miniature — varints, 64-bit and 32-bit
 * fixed fields, length-delimited strings and messages — plus a decoder for just the parts of a
 * FeedMessage God's Eye needs (vehicle positions and trip updates). Unknown fields are skipped.
 *
 * Defensive by design: a truncated or malformed feed throws a plain Error (never hangs), and a
 * feed is read up to 20,000 entities.
 */

export interface VehiclePosition {
  id: string;
  routeId: string;
  tripId: string;
  label: string;
  lat: number;
  lon: number;
  bearing: number | null;
  speedMs: number | null;
  stopSeq: number | null;
  status: number | null;
  /** When the position was reported, ms since the epoch (the feed header's time when the vehicle has none). */
  t: number;
  occupancy: number | null;
}

export interface TripUpdateStop {
  stopId: string;
  seq: number | null;
  /** Predicted arrival, unix seconds. */
  arrival: number | null;
  departure: number | null;
  /** Seconds late (negative = early). */
  delay: number | null;
}

export interface TripUpdate {
  tripId: string;
  routeId: string;
  vehicleId: string;
  stops: TripUpdateStop[];
  delay: number | null;
  /** ms since the epoch (0 when the update has no timestamp). */
  t: number;
}

/** Entities read from one feed, at most. */
export const MAX_ENTITIES = 20_000;

const utf8 = new TextDecoder();

/** Reads one protobuf message between `pos` and `end` of a shared byte array. */
class Reader {
  pos: number;
  constructor(
    private readonly b: Uint8Array,
    private readonly view: DataView,
    start: number,
    readonly end: number,
  ) {
    this.pos = start;
  }

  get eof(): boolean {
    return this.pos >= this.end;
  }

  /** A varint as two unsigned 32-bit halves (so 64-bit timestamps and negative int32s both decode exactly). */
  private varint(): { lo: number; hi: number } {
    let lo = 0;
    let hi = 0;
    let shift = 0;
    for (let i = 0; i < 10; i++) {
      if (this.pos >= this.end) throw new Error('truncated GTFS-realtime data (varint)');
      const byte = this.b[this.pos++]!;
      const v = byte & 0x7f;
      if (shift < 28) lo = (lo | (v << shift)) >>> 0;
      else if (shift === 28) {
        lo = (lo | ((v & 0x0f) << 28)) >>> 0;
        hi = v >>> 4;
      } else if (shift < 63) hi = (hi | (v << (shift - 32))) >>> 0;
      else hi = (hi | ((v & 1) << 31)) >>> 0;
      shift += 7;
      if (!(byte & 0x80)) return { lo, hi };
    }
    throw new Error('bad GTFS-realtime data (varint longer than 10 bytes)');
  }

  /** uint32 / uint64 / enum as a non-negative number (exact up to 2^53, plenty for timestamps). */
  uint(): number {
    const { lo, hi } = this.varint();
    return hi * 4294967296 + lo;
  }

  /** int32 (protobuf sign-extends negatives to 64 bits; the low word carries the value). */
  int32(): number {
    return this.varint().lo | 0;
  }

  bool(): boolean {
    const { lo, hi } = this.varint();
    return lo !== 0 || hi !== 0;
  }

  /** Field tag: field number and wire type. */
  tag(): { field: number; wire: number } {
    const { lo, hi } = this.varint();
    const field = hi * 536870912 + (lo >>> 3); // (hi << 29) | (lo >>> 3), without 32-bit overflow
    const wire = lo & 7;
    if (field < 1 || field > 536870911) throw new Error('bad GTFS-realtime data (field number)');
    return { field, wire };
  }

  float(): number {
    if (this.pos + 4 > this.end) throw new Error('truncated GTFS-realtime data (float)');
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }

  double(): number {
    if (this.pos + 8 > this.end) throw new Error('truncated GTFS-realtime data (double)');
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }

  /** A length-delimited field's bytes. */
  bytes(): Uint8Array {
    const len = this.uint();
    if (len > this.end - this.pos) throw new Error('truncated GTFS-realtime data (length)');
    const out = this.b.subarray(this.pos, this.pos + len);
    this.pos += len;
    return out;
  }

  string(): string {
    return utf8.decode(this.bytes());
  }

  /** A nested message as its own reader over the same bytes. */
  message(): Reader {
    const len = this.uint();
    if (len > this.end - this.pos) throw new Error('truncated GTFS-realtime data (message)');
    const r = new Reader(this.b, this.view, this.pos, this.pos + len);
    this.pos += len;
    return r;
  }

  /** Step over a field we do not use. */
  skip(wire: number): void {
    switch (wire) {
      case 0:
        this.varint();
        return;
      case 1:
        if (this.pos + 8 > this.end) throw new Error('truncated GTFS-realtime data (fixed64)');
        this.pos += 8;
        return;
      case 2:
        this.bytes();
        return;
      case 5:
        if (this.pos + 4 > this.end) throw new Error('truncated GTFS-realtime data (fixed32)');
        this.pos += 4;
        return;
      default:
        // 3 and 4 are the long-gone "group" wire types; 6 and 7 do not exist.
        throw new Error(`bad GTFS-realtime data (wire type ${wire})`);
    }
  }

  /** A length-delimited field (string or message) if the wire type says so; otherwise skip it. */
  len(wire: number): Reader | null {
    if (wire === 2) return this.message();
    this.skip(wire);
    return null;
  }
}

const str = (r: Reader, wire: number): string | null => (wire === 2 ? r.string() : (r.skip(wire), null));
const uintOr = (r: Reader, wire: number): number | null => (wire === 0 ? r.uint() : (r.skip(wire), null));
const int32Or = (r: Reader, wire: number): number | null => (wire === 0 ? r.int32() : (r.skip(wire), null));
const floatOr = (r: Reader, wire: number): number | null => (wire === 5 ? r.float() : wire === 1 ? r.double() : (r.skip(wire), null));

function readHeader(r: Reader): number | null {
  let t: number | null = null;
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 3) t = uintOr(r, wire);
    else r.skip(wire);
  }
  return t;
}

function readTrip(r: Reader): { tripId: string; routeId: string } {
  let tripId = '';
  let routeId = '';
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) tripId = str(r, wire) ?? tripId;
    else if (field === 5) routeId = str(r, wire) ?? routeId;
    else r.skip(wire);
  }
  return { tripId, routeId };
}

function readVehicleDescriptor(r: Reader): { id: string; label: string } {
  let id = '';
  let label = '';
  let plate = '';
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) id = str(r, wire) ?? id;
    else if (field === 2) label = str(r, wire) ?? label;
    else if (field === 3) plate = str(r, wire) ?? plate;
    else r.skip(wire);
  }
  return { id, label: label || plate };
}

function readPosition(r: Reader): { lat: number; lon: number; bearing: number | null; speedMs: number | null } {
  let lat = NaN;
  let lon = NaN;
  let bearing: number | null = null;
  let speedMs: number | null = null;
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) lat = floatOr(r, wire) ?? lat;
    else if (field === 2) lon = floatOr(r, wire) ?? lon;
    else if (field === 3) bearing = floatOr(r, wire);
    else if (field === 5) speedMs = floatOr(r, wire);
    else r.skip(wire);
  }
  return { lat, lon, bearing, speedMs };
}

function readVehicle(r: Reader, entityId: string): VehiclePosition | null {
  const v: VehiclePosition = { id: entityId, routeId: '', tripId: '', label: '', lat: NaN, lon: NaN, bearing: null, speedMs: null, stopSeq: null, status: null, t: 0, occupancy: null };
  while (!r.eof) {
    const { field, wire } = r.tag();
    switch (field) {
      case 1: {
        const m = r.len(wire);
        if (m) Object.assign(v, readTrip(m));
        break;
      }
      case 2: {
        const m = r.len(wire);
        if (m) Object.assign(v, readPosition(m));
        break;
      }
      case 3:
        v.stopSeq = uintOr(r, wire);
        break;
      case 4:
        v.status = int32Or(r, wire);
        break;
      case 5: {
        const t = uintOr(r, wire);
        if (t) v.t = t * 1000;
        break;
      }
      case 8: {
        const m = r.len(wire);
        if (m) {
          const d = readVehicleDescriptor(m);
          if (d.id) v.id = d.id;
          v.label = d.label;
        }
        break;
      }
      case 9:
        v.occupancy = int32Or(r, wire);
        break;
      default:
        r.skip(wire);
    }
  }
  // A vehicle without a usable position is no use on a map.
  if (!Number.isFinite(v.lat) || !Number.isFinite(v.lon) || Math.abs(v.lat) > 90 || Math.abs(v.lon) > 180) return null;
  if (v.bearing !== null && !Number.isFinite(v.bearing)) v.bearing = null;
  if (v.speedMs !== null && !Number.isFinite(v.speedMs)) v.speedMs = null;
  return v;
}

function readStopTimeEvent(r: Reader): { delay: number | null; time: number | null } {
  let delay: number | null = null;
  let time: number | null = null;
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) delay = int32Or(r, wire);
    else if (field === 2) time = uintOr(r, wire);
    else r.skip(wire);
  }
  return { delay, time };
}

function readStopTimeUpdate(r: Reader): TripUpdateStop {
  const s: TripUpdateStop = { stopId: '', seq: null, arrival: null, departure: null, delay: null };
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1) s.seq = uintOr(r, wire);
    else if (field === 4) s.stopId = str(r, wire) ?? s.stopId;
    else if (field === 2 || field === 3) {
      const m = r.len(wire);
      if (!m) continue;
      const ev = readStopTimeEvent(m);
      if (field === 2) s.arrival = ev.time;
      else s.departure = ev.time;
      if (ev.delay !== null && (field === 2 || s.delay === null)) s.delay = ev.delay;
    } else r.skip(wire);
  }
  return s;
}

function readTripUpdate(r: Reader): TripUpdate {
  const u: TripUpdate = { tripId: '', routeId: '', vehicleId: '', stops: [], delay: null, t: 0 };
  while (!r.eof) {
    const { field, wire } = r.tag();
    switch (field) {
      case 1: {
        const m = r.len(wire);
        if (m) Object.assign(u, readTrip(m));
        break;
      }
      case 2: {
        const m = r.len(wire);
        if (m) u.stops.push(readStopTimeUpdate(m));
        break;
      }
      case 3: {
        const m = r.len(wire);
        if (m) u.vehicleId = readVehicleDescriptor(m).id;
        break;
      }
      case 4: {
        const t = uintOr(r, wire);
        if (t) u.t = t * 1000;
        break;
      }
      case 5:
        u.delay = int32Or(r, wire);
        break;
      default:
        r.skip(wire);
    }
  }
  return u;
}

/**
 * Decode a GTFS-realtime FeedMessage: the header time (unix seconds) and every vehicle position
 * and trip update it carries. Throws a plain Error on truncated or malformed bytes.
 */
export function decodeFeed(bytes: Uint8Array): { headerTime: number | null; vehicles: VehiclePosition[]; trips: TripUpdate[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const r = new Reader(bytes, view, 0, bytes.byteLength);
  let headerTime: number | null = null;
  const vehicles: VehiclePosition[] = [];
  const trips: TripUpdate[] = [];
  let entities = 0;
  while (!r.eof) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === 2) headerTime = readHeader(r.message());
    else if (field === 2 && wire === 2) {
      if (entities >= MAX_ENTITIES) break;
      entities++;
      const e = r.message();
      let id = '';
      let deleted = false;
      let vehicle: Reader | null = null;
      let trip: Reader | null = null;
      while (!e.eof) {
        const { field: f, wire: w } = e.tag();
        if (f === 1) id = str(e, w) ?? id;
        else if (f === 2 && w === 0) deleted = e.bool();
        else if (f === 3) trip = e.len(w);
        else if (f === 4) vehicle = e.len(w);
        else e.skip(w);
      }
      if (deleted) continue;
      if (vehicle) {
        const v = readVehicle(vehicle, id);
        if (v) vehicles.push(v);
      }
      if (trip) trips.push(readTripUpdate(trip));
    } else r.skip(wire);
  }
  if (headerTime) {
    for (const v of vehicles) if (!v.t) v.t = headerTime * 1000;
    for (const t of trips) if (!t.t) t.t = headerTime * 1000;
  }
  return { headerTime, vehicles, trips };
}
