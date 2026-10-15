/**
 * Tools the INTERFACE carries out (side: 'client'). The brain sends a `client` event;
 * apps/web/src/commands/builtin.ts runs it. Keep names in sync with CLIENT_COMMANDS in
 * packages/shared/src/protocol.ts.
 */
import type { Tool } from './types';

const client = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []): Tool => ({
  name,
  description,
  parameters: { type: 'object', properties, required },
  risk: 'auto',
  side: 'client',
  async run(a, ctx) {
    ctx.emit({ t: 'client', name, args: a });
    return 'Done on screen.';
  },
});

export const uiTools: Tool[] = [
  client('open_tab', 'Switch the interface to a tab, e.g. core, eye (globe), brief, threats, markets, memory, workshop, system.', { tab: { type: 'string' } }, ['tab']),
  client(
    'fly_to',
    "Open the God's Eye globe and fly the camera to a place name or coordinates.",
    { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' }, range_km: { type: 'number', description: 'camera distance, default 500' } },
  ),
  client('set_layer', 'Show or hide a God\'s Eye globe layer: satellite (real imagery when zoomed in), buildings (3D), air, sats, quakes, events, cams (live public CCTV), ships (AIS vessels), radar (live rain radar), alerts (US weather warnings), disasters (GDACS cyclones/floods/volcanoes/fires), aurora, dispatch (Seattle 911 calls), buoys (ocean waves/wind), cables (undersea internet cables), borders, cities, grid, clouds.', { layer: { type: 'string' }, on: { type: 'boolean' } }, ['layer', 'on']),
  client(
    'show_cameras',
    "Open God's Eye on live public traffic/road cameras near a place (London, New York City, California, Finland have them) and show the nearest camera's live picture. Use when the owner wants to see a place live, check traffic or the weather on the road.",
    { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' } },
  ),
  client('set_theme', 'Change the interface colour theme: stark (JARVIS blue), arc (white arc core), mark3 (red and gold), nano (nanotech gold), warmachine (gunmetal), friday (green), ultron (violet), stealth (indigo).', { theme: { type: 'string' } }, ['theme']),
  client('set_sensor_mode', 'Change the globe sensor mode: normal, nvg, flir, crt, noir.', { mode: { type: 'string' } }, ['mode']),
  client('notify', 'Show a short notice on screen.', { text: { type: 'string' } }, ['text']),
  client('reload_interface', 'Reload the interface so a freshly shipped change appears.', {}),
];
