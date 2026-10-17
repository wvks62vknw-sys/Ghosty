/**
 * vehicle_check: one UK plate the owner gives → that vehicle's public MOT record (and DVLA's,
 * when its key is set), from integrations/vehicle.ts. Shown once: the plate is noted in memory so
 * the saved conversation has it blanked, and the record never goes into memory, notes or the
 * library. One car at a time, only when the owner asks; never anything about who owns it.
 */
import { asData } from '../kernel/permissions';
import { checkVehicle, noteLookup, recentLookups, vehicleKeys } from '../integrations/vehicle';
import { arg, type Tool } from './types';

/** Checks allowed in any ten minutes. */
const MAX_PER_10_MIN = 5;

export const vehicleTools: Tool[] = [
  {
    name: 'vehicle_check',
    description:
      "Check ONE UK vehicle by its number plate, only when the owner asks about that car: make, model, colour, fuel, first used, MOT valid until, each MOT test with mileage, advisories and defects, a warning when the mileage went down, outstanding recalls (DVSA MOT history), and tax status when the DVLA key is set. Never about the keeper or owner, never for several cars or on a schedule. The record is shown once and not kept: never remember it, schedule it or put it in notes.",
    parameters: { type: 'object', properties: { plate: { type: 'string', description: 'the number plate, e.g. AB12 CDE' } }, required: ['plate'] },
    risk: 'auto',
    async run(a, ctx) {
      // One car at a time: a run of checks in a few minutes is a batch, which this is not for.
      if (recentLookups().filter((l) => Date.now() - l.at < 10 * 60_000).length >= MAX_PER_10_MIN) throw new Error('that is a lot of cars in a few minutes: vehicle checks are for one car at a time, when the owner asks about it');
      ctx.progress?.('checking the official record…');
      const answer = await checkVehicle(arg.str(a, 'plate'), await vehicleKeys(ctx.vault));
      if (!answer.ok && answer.reason === 'invalid') throw new Error(answer.message);
      // Noted in memory (never stored): the saved conversation gets "[plate]" and leaves out the reply that follows.
      noteLookup(arg.str(a, 'plate'));
      if (!answer.ok) return `${answer.message}\nFree official checks: ${answer.links.map((l) => `${l.title} ${l.url}`).join(' · ')}`;
      return `${asData(answer.report.sources.join(' and '), answer.text)}\nShown to the owner once and not kept: do not remember it or file it anywhere.`;
    },
  },
];
