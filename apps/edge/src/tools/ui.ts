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
  client('set_layer', 'Show or hide a God\'s Eye globe layer: satellite, buildings (3D), air, sats, quakes, events, cams (live public CCTV), traffic (live road speeds, TomTom key), ships, radar (rain), alerts (US weather), disasters (GDACS), aurora, dispatch (Seattle 911), buoys, cables, enforce (mapped ANPR, speed, red-light and bus-lane camera sites — locations only), transit (live buses and trams), incidents (motorway incidents), borders, cities, grid, clouds.', { layer: { type: 'string' }, on: { type: 'boolean' } }, ['layer', 'on']),
  client('set_theme', 'Change the interface colour theme: stark (JARVIS blue), arc (white arc core), mark3 (red and gold), nano (nanotech gold), warmachine (gunmetal), friday (green), ultron (violet), stealth (indigo).', { theme: { type: 'string' } }, ['theme']),
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
    "Open the LENS tab (the phone's camera, vision on the phone). mode see = spot objects live; read = turn a document, sign or label into text (OCR) to save to the library, copy or send to you; hands = hand gestures; ask = take a picture and ask you about it (question pre-filled); scan = barcodes and QR codes (products, books, links), documents to PDF, translate a sign; aim = point the phone at the sky or the street for live labels on planes, ships, buses, places and the space station. Use for \"read this\", \"scan this\", \"what am I looking at\", \"use the camera\". It never identifies people.",
    { mode: { type: 'string', enum: ['see', 'read', 'hands', 'ask', 'scan', 'aim'], description: 'which mode to open (default see)' }, question: { type: 'string', description: 'for ask: the question to pre-fill' } },
  ),
];
