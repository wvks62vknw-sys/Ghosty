/** Radio: find internet radio stations (radio-browser.info, free) and play them in the interface. */
import { arg, type Tool } from './types';

export interface Station {
  name: string;
  url: string;
  country: string;
  tags: string;
  codec: string;
  bitrate: number;
  votes: number;
}

const API = 'https://de1.api.radio-browser.info/json/stations/search';

export async function searchStations(q: { name?: string; tag?: string; country?: string }, limit = 8): Promise<Station[]> {
  const u = new URL(API);
  if (q.name) u.searchParams.set('name', q.name);
  if (q.tag) u.searchParams.set('tag', q.tag);
  if (q.country) u.searchParams.set('country', q.country);
  u.searchParams.set('hidebroken', 'true');
  u.searchParams.set('order', 'clickcount');
  u.searchParams.set('reverse', 'true');
  u.searchParams.set('limit', '40');
  const r = await fetch(u.toString(), { headers: { 'User-Agent': 'Ghosty/2.0 (personal assistant)' } });
  if (!r.ok) throw new Error(`radio directory answered ${r.status}`);
  const j = (await r.json()) as { name: string; url_resolved: string; country: string; tags: string; codec: string; bitrate: number; votes: number }[];
  // Only secure streams play inside an https page.
  return j
    .filter((s) => /^https:\/\//i.test(s.url_resolved ?? ''))
    .slice(0, limit)
    .map((s) => ({ name: s.name.trim().slice(0, 80), url: s.url_resolved, country: s.country, tags: (s.tags ?? '').split(',').slice(0, 4).join(', '), codec: s.codec, bitrate: s.bitrate, votes: s.votes }));
}

export const mediaTools: Tool[] = [
  {
    name: 'play_radio',
    description:
      'Find and play an internet radio station in the interface. Search by station name (e.g. "BBC Radio 1", "Capital FM") or by genre/tag (e.g. "jazz", "lofi", "news") and optional country.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Station name' }, genre: { type: 'string', description: 'Genre/tag instead of a name' }, country: { type: 'string' } },
    },
    risk: 'auto',
    async run(a, ctx) {
      const name = arg.str(a, 'name', false);
      const genre = arg.str(a, 'genre', false);
      const country = arg.str(a, 'country', false);
      if (!name && !genre) throw new Error('give a station name or a genre');
      let list = await searchStations({ name: name || undefined, tag: genre ? genre.toLowerCase() : undefined, country: country || undefined });
      if (!list.length && name) list = await searchStations({ name: name.split(/\s+/).slice(0, 2).join(' '), country: country || undefined });
      const s = list[0];
      if (!s) return `I couldn't find a playable station for "${name || genre}".`;
      ctx.emit({ t: 'client', name: 'play_radio', args: { name: s.name, url: s.url, info: [s.country, s.tags].filter(Boolean).join(' · ') } });
      const others = list.slice(1, 5).map((x) => x.name);
      return `Playing ${s.name}${s.country ? ` (${s.country})` : ''}.${others.length ? ` Other matches: ${others.join('; ')}.` : ''}`;
    },
  },
  {
    name: 'stop_audio',
    description: 'Stop the radio or any audio playing in the interface.',
    parameters: { type: 'object', properties: {} },
    risk: 'auto',
    side: 'client',
    async run(_a, ctx) {
      ctx.emit({ t: 'client', name: 'stop_audio', args: {} });
      return 'Stopped.';
    },
  },
];
