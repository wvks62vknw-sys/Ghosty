/**
 * Gadgets: the best settings for a speaker, amp, soundbar or TV (gadget_settings: manuals and
 * reviewers, sources named) and a replacement part in UK shops (find_part: prices read off the
 * shops' pages, ranked by fit then price). Both look things up and change nothing; neither ever
 * fills a gap with a guess. A photo of the gadget or the part is identified by the model first
 * (the "gadgets and parts" playbook says how to chain it).
 */
import { gadgetSettings, type Use } from '../integrations/gadgets';
import { findParts } from '../integrations/parts';
import { asData } from '../kernel/permissions';
import { arg, clip, type Tool } from './types';
import { search } from './web';

const USES = ['music', 'films', 'gaming', 'speech'] as const;

export const gadgetTools: Tool[] = [
  {
    name: 'gadget_settings',
    description: "The best settings for a gadget (speaker, amp, soundbar, TV, headphones…): searches its manual, the maker's page and reviewers that test settings (RTINGS, What Hi-Fi?…), reads up to 4 pages and returns only the settings they publish, each with its source. Identify the make and model first (from a photo, its label or the Lens READ text).",
    parameters: {
      type: 'object',
      properties: {
        device: { type: 'string', description: 'make and model (e.g. "Sonos Arc", "Yamaha RX-V685"), or a description when the model is unknown' },
        use: { type: 'string', enum: [...USES], description: 'what it is mostly used for' },
        room: { type: 'string', description: 'the room, if it matters (e.g. "small bedroom", "against a wall")' },
      },
      required: ['device'],
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const device = arg.str(a, 'device').slice(0, 120);
      const u = arg.str(a, 'use', false).toLowerCase();
      const use = (USES as readonly string[]).includes(u) ? (u as Use) : '';
      const r = await gadgetSettings({ device, use, room: arg.str(a, 'room', false).slice(0, 80) }, { search: (q) => search(q, ctx), progress: ctx.progress });
      return r.found.length ? asData('manuals and reviews', clip(r.text, 7000)) : r.text;
    },
  },
  {
    name: 'find_part',
    description: 'Find a replacement part for sale in the UK (eBay UK, Amazon UK, eSpares, RS, CPC/Farnell, Screwfix, Toolstation, AliExpress…): reads up to 5 shop pages for title, price and stock, ranks by match (the part number above all) then price, with links. Give the part number whenever it is printed on the part.',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string', description: 'what the part is (e.g. "washing machine door seal", "TV remote", "20 mm 3 A fuse")' },
        part_number: { type: 'string', description: 'the number printed on the part or in the manual, if known' },
        device: { type: 'string', description: 'the gadget it belongs to: make and model' },
      },
      required: ['description'],
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const q = { description: arg.str(a, 'description').slice(0, 120), partNumber: arg.str(a, 'part_number', false).slice(0, 40) || undefined, device: arg.str(a, 'device', false).slice(0, 80) || undefined };
      const r = await findParts(q, { search: (s) => search(s, ctx), progress: ctx.progress });
      return r.listings.length ? asData('UK shop pages', clip(r.text, 6000)) : r.text;
    },
  },
];
