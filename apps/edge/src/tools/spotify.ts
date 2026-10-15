/** Spotify: what's playing and playback control on the owner's linked account (LINKS tab → SPOTIFY). */
import { api, SpotifyError } from '../integrations/spotify';
import { asData } from '../kernel/permissions';
import { arg, type Tool, type ToolContext } from './types';

interface Artist {
  name: string;
}
interface Item {
  name: string;
  uri: string;
  type?: string;
  artists?: Artist[];
  album?: { name: string };
  show?: { name: string };
  duration_ms?: number;
  owner?: { display_name?: string | null; id?: string };
  tracks?: { total?: number };
  items?: { total?: number };
}
interface Device {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted?: boolean;
  volume_percent: number | null;
}
interface Player {
  is_playing: boolean;
  progress_ms: number | null;
  shuffle_state?: boolean;
  repeat_state?: string;
  device?: Device;
  item?: Item | null;
}

const TYPES = ['track', 'album', 'artist', 'playlist'] as const;
type Kind = (typeof TYPES)[number];
const ACTIONS = ['play', 'pause', 'next', 'previous', 'shuffle_on', 'shuffle_off', 'repeat_off', 'repeat_track', 'repeat_context', 'volume'] as const;

const mmss = (ms: number | null | undefined) => {
  const s = Math.max(0, Math.round((ms ?? 0) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const by = (x: Item) => (x.artists?.length ? x.artists.map((a) => a.name).join(', ') : x.show?.name ?? '');
const clean = (s: string, max = 120) => s.replace(/\s+/g, ' ').trim().slice(0, max);

/** Describe an item in a few words: "Song — Artist (Album)". */
function label(x: Item): string {
  const who = by(x);
  return clean(`${x.name}${who ? ` — ${who}` : ''}${x.album?.name ? ` (${x.album.name})` : ''}`, 200);
}

async function devices(ctx: ToolContext): Promise<Device[]> {
  return (await api<{ devices: Device[] }>(ctx, 'GET', '/me/player/devices'))?.devices ?? [];
}

/** Find a device by (part of) its name; null when none was asked for. */
async function deviceId(ctx: ToolContext, name: string): Promise<string | null> {
  if (!name) return null;
  const list = await devices(ctx);
  const q = name.toLowerCase();
  const d = list.find((x) => x.name.toLowerCase() === q) ?? list.find((x) => x.name.toLowerCase().includes(q));
  if (!d?.id) throw new Error(`No Spotify device called "${name}". Available: ${list.map((x) => x.name).join(', ') || 'none — open Spotify on a device first'}.`);
  return d.id;
}

async function search(ctx: ToolContext, q: string, type: Kind, limit = 5): Promise<Item[]> {
  const u = `/search?${new URLSearchParams({ q, type, limit: String(limit) }).toString()}`;
  const j = await api<Record<string, { items?: (Item | null)[] }>>(ctx, 'GET', u);
  return (j?.[`${type}s`]?.items ?? []).filter((x): x is Item => !!x && typeof x.uri === 'string');
}

const withDevice = (path: string, id: string | null) => (id ? `${path}${path.includes('?') ? '&' : '?'}device_id=${encodeURIComponent(id)}` : path);

export const spotifyTools: Tool[] = [
  {
    name: 'spotify_now_playing',
    description: "What is playing on the owner's Spotify right now: track, artists, album, progress, device, playing/paused. Use for \"what's this song?\", \"what's playing?\".",
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const p = await api<Player>(ctx, 'GET', '/me/player?additional_types=episode');
      if (!p || !p.item) return p?.device ? `Nothing is playing on Spotify (device: ${p.device.name}).` : 'Nothing is playing on Spotify right now.';
      const x = p.item;
      const dev = p.device ? ` · on ${p.device.name}${p.device.volume_percent != null ? ` (volume ${p.device.volume_percent}%)` : ''}` : '';
      const modes = ` · shuffle ${p.shuffle_state ? 'on' : 'off'}, repeat ${p.repeat_state ?? 'off'}`;
      return `${p.is_playing ? 'Playing' : 'Paused'}: ${label(x)} · ${mmss(p.progress_ms)} / ${mmss(x.duration_ms)}${dev}${modes}`;
    },
  },
  {
    name: 'spotify_control',
    description:
      'Control Spotify playback: play (resume), pause, next, previous, shuffle_on/shuffle_off, repeat_off/repeat_track/repeat_context, or volume (with level 0-100). Use for "pause the music", "skip", "turn it up", "shuffle". Needs Spotify Premium.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: [...ACTIONS] },
        level: { type: 'number', description: 'Volume 0-100 (only for action "volume")' },
        device: { type: 'string', description: 'Optional device name' },
      },
      required: ['action'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const action = arg.str(a, 'action').toLowerCase() as (typeof ACTIONS)[number];
      if (!ACTIONS.includes(action)) throw new Error(`action must be one of ${ACTIONS.join(', ')}`);
      const id = await deviceId(ctx, arg.str(a, 'device', false));
      switch (action) {
        case 'play':
          await api(ctx, 'PUT', withDevice('/me/player/play', id));
          return 'Resumed Spotify.';
        case 'pause':
          await api(ctx, 'PUT', withDevice('/me/player/pause', id));
          return 'Paused Spotify.';
        case 'next':
          await api(ctx, 'POST', withDevice('/me/player/next', id));
          return 'Skipped to the next track.';
        case 'previous':
          await api(ctx, 'POST', withDevice('/me/player/previous', id));
          return 'Went back to the previous track.';
        case 'shuffle_on':
        case 'shuffle_off':
          await api(ctx, 'PUT', withDevice(`/me/player/shuffle?state=${action === 'shuffle_on'}`, id));
          return `Shuffle ${action === 'shuffle_on' ? 'on' : 'off'}.`;
        case 'volume': {
          const level = Math.round(Math.max(0, Math.min(100, arg.num(a, 'level'))));
          await api(ctx, 'PUT', withDevice(`/me/player/volume?volume_percent=${level}`, id));
          return `Volume set to ${level}%.`;
        }
        default: {
          const state = action.slice('repeat_'.length);
          await api(ctx, 'PUT', withDevice(`/me/player/repeat?state=${state}`, id));
          return `Repeat ${state === 'off' ? 'off' : state === 'track' ? 'this track' : 'the album/playlist'}.`;
        }
      }
    },
  },
  {
    name: 'spotify_play',
    description:
      'Search Spotify and start playing the best match on the owner\'s account: a track, album, artist or playlist (type, default track). Use for "play Bohemian Rhapsody", "play some Taylor Swift" (type artist), "play my Chill playlist" (type playlist). Optional device name. Use play_radio instead for internet radio stations.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What to play, e.g. "Bohemian Rhapsody Queen"' },
        type: { type: 'string', enum: [...TYPES], description: 'Default track' },
        device: { type: 'string', description: 'Optional device name, e.g. "Kitchen"' },
      },
      required: ['query'],
    },
    risk: 'auto',
    async run(a, ctx) {
      const query = clean(arg.str(a, 'query'), 200);
      const t = (arg.str(a, 'type', false) || 'track').toLowerCase() as Kind;
      const type: Kind = TYPES.includes(t) ? t : 'track';
      const best = (await search(ctx, query, type))[0];
      if (!best) return `Nothing on Spotify matched ${type} "${query}".`;
      const body = type === 'track' ? { uris: [best.uri] } : { context_uri: best.uri };
      let id = await deviceId(ctx, arg.str(a, 'device', false));
      try {
        await api(ctx, 'PUT', withDevice('/me/player/play', id), body);
      } catch (e) {
        // Nothing active: start it on the first available device rather than give up.
        if (id || !(e instanceof SpotifyError) || e.reason !== 'NO_ACTIVE_DEVICE') throw e;
        const d = (await devices(ctx)).find((x) => x.id && !x.is_restricted);
        if (!d?.id) throw e;
        id = d.id;
        await api(ctx, 'PUT', withDevice('/me/player/play', id), body);
      }
      const what = type === 'track' ? label(best) : type === 'artist' ? `${best.name} (artist)` : type === 'album' ? `the album ${label(best)}` : `the playlist ${best.name}`;
      return `Playing ${what} on Spotify.`;
    },
  },
  {
    name: 'spotify_queue',
    description: 'Add a song to the owner\'s Spotify queue (plays after the current one). Use for "queue …", "play … next", "add … to the queue".',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Song to find, e.g. "Yellow Coldplay"' } }, required: ['query'] },
    risk: 'auto',
    async run(a, ctx) {
      const query = clean(arg.str(a, 'query'), 200);
      const best = (await search(ctx, query, 'track', 1))[0];
      if (!best) return `No song on Spotify matched "${query}".`;
      await api(ctx, 'POST', `/me/player/queue?uri=${encodeURIComponent(best.uri)}`);
      return `Queued ${label(best)}.`;
    },
  },
  {
    name: 'spotify_playlists',
    description: "List the owner's Spotify playlists (name, owner, number of tracks). Use for \"what playlists do I have?\" or to find one to play with spotify_play.",
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const j = await api<{ items?: (Item | null)[]; total?: number }>(ctx, 'GET', '/me/playlists?limit=50');
      const list = (j?.items ?? []).filter((x): x is Item => !!x);
      if (!list.length) return 'No Spotify playlists found.';
      const lines = list.map((p) => {
        const n = p.tracks?.total ?? p.items?.total;
        return `- ${clean(p.name, 80)}${n != null ? ` (${n} tracks)` : ''}${p.owner?.display_name ? ` · by ${clean(p.owner.display_name, 40)}` : ''}`;
      });
      return asData('Spotify playlists', `${j?.total ?? list.length} playlists:\n${lines.join('\n')}`);
    },
  },
  {
    name: 'spotify_devices',
    description: "List the devices Spotify can play on right now (phone, computer, speakers) and which one is active. Use before playing on a named device, or when playback says there's no active device.",
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    async run(_a, ctx) {
      const list = await devices(ctx);
      if (!list.length) return 'No Spotify devices are available. Open Spotify on a phone, computer or speaker first.';
      return list.map((d) => `- ${d.name} (${d.type.toLowerCase()})${d.is_active ? ' · active' : ''}${d.volume_percent != null ? ` · volume ${d.volume_percent}%` : ''}`).join('\n');
    },
  },
];
