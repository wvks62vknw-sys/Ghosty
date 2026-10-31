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
  client('open_tab', 'Switch the interface to a tab, e.g. core, eye (globe), brief, threats, markets, memory, workshop, workbench, system.', { tab: { type: 'string' } }, ['tab']),
  client(
    'fly_to',
    "Open the God's Eye globe and fly the camera to a place name or coordinates.",
    { place: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' }, range_km: { type: 'number', description: 'camera distance, default 500' } },
  ),
  client('set_layer', 'Show or hide a God\'s Eye globe layer: satellite, buildings (3D), air, sats, quakes, events, cams (live public CCTV), traffic (live road speeds, TomTom key), ships, radar (rain), alerts (US weather), disasters (GDACS), aurora, dispatch (Seattle 911), buoys, cables, enforce (mapped ANPR, speed, red-light and bus-lane camera sites — locations only), transit (live buses and trams), incidents (motorway incidents), borders, cities, grid, clouds.', { layer: { type: 'string' }, on: { type: 'boolean' } }, ['layer', 'on']),
  client('set_theme', 'Change the interface colour theme: reactor (cyan, the default) or graphite (cool steel, quieter).', { theme: { type: 'string' } }, ['theme']),
  client('set_sensor_mode', 'Change the globe sensor mode: normal, nvg, flir, crt, noir.', { mode: { type: 'string' } }, ['mode']),
  client('notify', 'Show a short notice on screen.', { text: { type: 'string' } }, ['text']),
  client(
    'road_ahead',
    "ROAD AHEAD mode on God's Eye: the globe follows the owner's own phone position (heading up, nothing leaves the device) and a panel lists what is ahead — road incidents, safety-camera sites, motorway cameras to tap, buses. Use when the owner is driving or walking and wants the road ahead; on:false ends it.",
    { on: { type: 'boolean' } },
  ),
  client('reload_interface', 'Reload the interface so a freshly shipped change appears.', {}),
  client(
    'open_lens',
    "Open the LENS tab (the phone's camera; vision on the phone). Modes: see = spot objects live; read = text in a picture (OCR) to save, copy or send; hands = gestures; ask = a picture with a question (pre-filled); name = name anything; scan = barcodes, QR, documents to PDF, translate; aim = live labels on planes, ships, buses, places, the space station; measure = sizes from a photo; sound = is a speaker distorting. Never identifies people.",
    { mode: { type: 'string', enum: ['see', 'read', 'hands', 'ask', 'name', 'scan', 'aim', 'measure', 'sound'], description: 'which mode to open (default see)' }, question: { type: 'string', description: 'for ask: the question to pre-fill' } },
  ),
  client(
    'open_space',
    'Open the SPACE PLANNER (room plan to scale, furniture, WILL IT FIT?, MAKE SPACE); pass the room size in cm when known.',
    { width_cm: { type: 'number' }, depth_cm: { type: 'number' } },
  ),
];
