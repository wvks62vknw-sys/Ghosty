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
  client('set_layer', 'Show or hide a globe layer: air, sats, quakes, events, borders, cities, grid, clouds.', { layer: { type: 'string' }, on: { type: 'boolean' } }, ['layer', 'on']),
  client('set_theme', 'Change the interface colour theme: stark, cyan, crimson, gold, emerald, violet, ice.', { theme: { type: 'string' } }, ['theme']),
  client('set_sensor_mode', 'Change the globe sensor mode: normal, nvg, flir, crt, noir.', { mode: { type: 'string' } }, ['mode']),
  client('notify', 'Show a short notice on screen.', { text: { type: 'string' } }, ['text']),
  client('reload_interface', 'Reload the interface so a freshly shipped change appears.', {}),
];
