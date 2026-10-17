/**
 * vehicle_check: one UK plate the owner gives → that vehicle's public MOT record (and DVLA's,
 * when its key is set), from integrations/vehicle.ts. Shown once: as the check starts, the saved
 * history gets "[plate]" and a mark that leaves out the reply, and the record never goes into
 * memory, notes or the library. One car at a time, only when the owner asks; never anything
 * about who owns it.
 */
import { asData } from '../kernel/permissions';
import { isPlate } from '../../../../packages/shared/src/plates';
import { checkVehicle, forgetPlateInHistory, noteLookup, recentLookups, vehicleKeys } from '../integrations/vehicle';
import { storageError } from '../kv';
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
      const plate = arg.str(a, 'plate');
      if (!isPlate(plate)) throw new Error(`"${plate.slice(0, 12)}" is not a UK number plate (like AB12 CDE, A123 BCD, ABC 123D or ABZ 1234).`);
      // The saved history gets "[plate]" and a mark that leaves out the reply, before anything is looked up:
      // whatever happens next (a failed step, an approval answered later), the plate is not kept.
      // While the database is paused nothing was saved, so there is nothing to blank.
      await forgetPlateInHistory(ctx.storage, plate).catch((e) => {
        if (!storageError(e)) throw e;
      });
      noteLookup(plate);
      ctx.progress?.('checking the official record…');
      const answer = await checkVehicle(plate, await vehicleKeys(ctx.vault));
      if (!answer.ok && answer.reason === 'invalid') throw new Error(answer.message);
      if (!answer.ok) return `${answer.message}\nFree official checks: ${answer.links.map((l) => `${l.title} ${l.url}`).join(' · ')}`;
      return `${asData(answer.report.sources.join(' and '), answer.text)}\nShown to the owner once and not kept: do not remember it or file it anywhere.`;
    },
  },
];
