/**
 * Saved places in a chat (places.ts): "remember that home is 12 Acacia Avenue, B13" looks the address up and
 * shows what the map found for a yes (remember_place); the yes keeps it (remember_place with confirm). "Take me
 * home" needs no tool of its own: plan_journey and get_directions read the saved place. Not in `extraTools`
 * (every tool there is described on every turn): its own keyword group in tools/index.ts.
 */
import { findPlace, forgetPlace, keepPlace, loadPlaces, pendingPlace, proposePlace } from '../places';
import { ownerPlace } from './travel';
import { arg, type Tool } from './types';

export const placesTools: Tool[] = [
  {
    name: 'remember_place',
    description:
      'Save a place the owner names (home, work, school, gym, parents or any name) for journeys, directions and the Brief. First call: name + address (or postcode) — it is looked up and NOT kept: tell the owner what was found and ask if it is right. When they say yes: call again with confirm true.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'home, work, school, gym, parents, or the name he uses' },
        address: { type: 'string', description: 'the address, place name or postcode he gave' },
        confirm: { type: 'boolean', description: 'true only after the owner said yes to what was found' },
      },
    },
    risk: 'auto',
    async run(a, ctx) {
      if (arg.bool(a, 'confirm')) {
        const p = await pendingPlace(ctx.storage);
        if (!p) return 'Nothing is waiting for a yes: look the place up first (name and address).';
        const name = arg.str(a, 'name', false);
        if (name && name.trim().toLowerCase() !== p.id && name.trim().toLowerCase() !== p.label.toLowerCase()) {
          const found = await findPlace(name, p.query);
          await keepPlace(ctx.storage, found);
          return `Kept ${found.label}: ${found.address}. Journeys, directions and the Brief use it now; it is in Memory → ME → PLACES.`;
        }
        await keepPlace(ctx.storage, p);
        return `Kept ${p.label}: ${p.address}. Journeys, directions and the Brief use it now; it is in Memory → ME → PLACES (only in his memory, nowhere else).`;
      }
      const found = await findPlace(arg.str(a, 'name'), arg.str(a, 'address'), await ownerPlace(ctx).catch(() => null));
      await proposePlace(ctx.storage, found);
      ctx.emit({ t: 'client', name: 'show_map', args: { place: found.label, lat: found.lat, lon: found.lon, style: 'streets', zoom: 16, points: [{ lat: found.lat, lon: found.lon, label: found.label }] } });
      return `Found for ${found.label}: ${found.address} (${found.lat.toFixed(5)}, ${found.lon.toFixed(5)}), shown on the map. NOT kept yet: ask the owner if that is right; if yes, call remember_place with confirm true.`;
    },
  },
  {
    name: 'forget_place',
    description: 'Forget a saved place by its name (home, work, …). Also: list the saved places with name "list".',
    parameters: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    risk: 'auto',
    async run(a, ctx) {
      const name = arg.str(a, 'name');
      if (/^(list|all|places)$/i.test(name.trim())) {
        const list = await loadPlaces(ctx.storage);
        return list.length ? list.map((p) => `${p.label}: ${p.address}`).join('\n') : 'No places saved yet.';
      }
      const gone = await forgetPlace(ctx.storage, name);
      return gone ? `Forgot ${gone.label} (${gone.address}).` : `No saved place called "${name}".`;
    },
  },
];
