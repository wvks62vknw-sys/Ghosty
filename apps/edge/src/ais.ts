/**
 * Ships anywhere in the world from AISstream (free key, aisstream.io). AISstream only
 * offers a live WebSocket, so the brain opens one for a few seconds for the box around
 * the globe camera, collects position + static reports, closes it, and caches the
 * result briefly. Baltic ships also come keyless from Digitraffic in the interface.
 */

export interface AisShip {
  mmsi: number;
  name: string;
  lat: number;
  lon: number;
  sog: number;
  cog: number;
  hdg: number;
  type: number;
  dest: string;
  nav: number;
  t: number;
  src: string;
}

interface Msg {
  MessageType?: string;
  MetaData?: { MMSI?: number; ShipName?: string; latitude?: number; longitude?: number };
  Message?: Record<string, Record<string, unknown>>;
}

/** Fold one AISstream message into the ship table. */
export function foldAis(table: Map<number, AisShip>, raw: unknown, now = Date.now()): void {
  let m: Msg;
  try {
    m = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Msg;
  } catch {
    return;
  }
  const mmsi = Number(m.MetaData?.MMSI);
  if (!mmsi || !m.MessageType) return;
  const body = m.Message?.[m.MessageType] ?? {};
  const cur = table.get(mmsi);
  const name = String(m.MetaData?.ShipName ?? body.Name ?? cur?.name ?? '').replace(/@+$/, '').trim();
  if (m.MessageType === 'ShipStaticData') {
    if (cur) Object.assign(cur, { name: name || cur.name, type: Number(body.Type) || cur.type, dest: String(body.Destination ?? cur.dest).replace(/@+$/, '').trim() });
    else table.set(mmsi, { mmsi, name, lat: NaN, lon: NaN, sog: 0, cog: 0, hdg: 0, type: Number(body.Type) || 0, dest: String(body.Destination ?? '').replace(/@+$/, '').trim(), nav: 15, t: 0, src: 'AISstream' });
    return;
  }
  const lat = Number(body.Latitude ?? m.MetaData?.latitude);
  const lon = Number(body.Longitude ?? m.MetaData?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;
  const sog = Number(body.Sog ?? 0);
  const cog = Number(body.Cog ?? 0);
  const th = Number(body.TrueHeading ?? 511);
  table.set(mmsi, {
    mmsi,
    name,
    lat,
    lon,
    sog: sog >= 102.3 ? 0 : sog,
    cog: cog >= 360 ? 0 : cog,
    hdg: th < 360 ? th : cog >= 360 ? 0 : cog,
    type: cur?.type ?? 0,
    dest: cur?.dest ?? '',
    nav: Number(body.NavigationalStatus ?? 15),
    t: now,
    src: 'AISstream',
  });
}

export interface WsLike {
  accept?(): void;
  send(data: string): void;
  close(): void;
  addEventListener(type: 'message', fn: (ev: { data: unknown }) => void): void;
}

/** Open AISstream, listen for `ms`, return ships with a position. */
export async function collectAis(
  apiKey: string,
  [w, s, e, n]: number[],
  ms = 6000,
  connect: () => Promise<WsLike> = async () => {
    const r = await fetch('https://stream.aisstream.io/v0/stream', { headers: { Upgrade: 'websocket' } });
    const ws = (r as unknown as { webSocket?: WsLike }).webSocket;
    if (!ws) throw new Error(`AISstream refused the connection (HTTP ${r.status})`);
    return ws;
  },
): Promise<AisShip[]> {
  const ws = await connect();
  ws.accept?.();
  const table = new Map<number, AisShip>();
  const dec = new TextDecoder();
  ws.addEventListener('message', (ev) => {
    const d = ev.data;
    foldAis(table, typeof d === 'string' ? d : d instanceof ArrayBuffer ? dec.decode(d) : ArrayBuffer.isView(d) ? dec.decode(d as Uint8Array) : d);
  });
  ws.send(
    JSON.stringify({
      APIKey: apiKey,
      BoundingBoxes: [[[s, w], [n, e]]],
      FilterMessageTypes: ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport', 'ShipStaticData'],
    }),
  );
  await new Promise((r) => setTimeout(r, ms));
  try {
    ws.close();
  } catch {
    /* already closed */
  }
  return [...table.values()].filter((x) => Number.isFinite(x.lat) && x.t > 0);
}
