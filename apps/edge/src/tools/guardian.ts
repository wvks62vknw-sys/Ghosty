/**
 * THE GUARDIAN's tools (guardian.ts), offered when his words call for them: what is active near his places right now
 * (threats_near). A tool group on by its words, never always: the plain turn only names it.
 */
import { FEED_NAMES, clockIn, type GuardWarning } from '../../../../packages/shared/src/guardian';
import { guardianInfo, warningLine, watchTick, type GuardDeps } from '../guardian';
import { asData } from '../kernel/permissions';
import { placeLabel } from '../../../../packages/shared/src/places';
import { arg, type Tool, type ToolContext } from './types';

/** How old the watch may be before the tool looks again itself (the job looks every hour). */
const STALE_MS = 75 * 60_000;

/** The guardian's deps from a tool's context: a look only, so no notification (the hourly watch tells him what is new). */
const lookDeps = (ctx: ToolContext): GuardDeps => ({ env: ctx.env, storage: ctx.storage, vault: ctx.vault, notify: async () => undefined });

const monthName = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return y && m ? new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : ym;
};

export const guardianTools: Tool[] = [
  {
    name: 'threats_near',
    description:
      "What is active near the owner's saved places now: Environment Agency flood alerts and warnings (within 5 km), Met Office severe weather warnings for each place's area, and the latest published month of street crime within a mile (police.uk counts by type, about two months behind). From the hourly watch; looks again if it is over an hour old. Public warnings and counts as published: never a prediction about anyone or anywhere. Use for \"any flood warnings near home?\", \"is it safe round here?\", \"storm warning?\", \"crime near work?\".",
    parameters: { type: 'object', properties: { place: { type: 'string', description: 'one saved place ("home", "work"); omit for all of them' } } },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const d = lookDeps(ctx);
      let info = await guardianInfo(d);
      if (!info.places.length) return "No saved places to watch yet: the owner adds them in Memory → ME → PLACES (or says \"remember home is …\").";
      const last = Math.min(...(['flood', 'weather'] as const).map((f) => info.checked[f] ?? 0));
      if (Date.now() - last > STALE_MS) {
        await watchTick(d, { quiet: true }).catch(() => undefined);
        info = await guardianInfo(d);
      }
      const want = arg.str(a, 'place', false).trim();
      const id = want ? placeLabel(want)?.id ?? want.toLowerCase() : '';
      const places = id ? info.places.filter((p) => p.id === id || p.label.toLowerCase() === want.toLowerCase()) : info.places;
      if (!places.length) return `"${want}" is not one of his saved places (${info.places.map((p) => p.label).join(', ')}).`;
      const lines: string[] = [];
      for (const p of places) {
        const act = p.active.map((w: GuardWarning) => warningLine(w, p.label, info.tz));
        lines.push(act.length ? act.join('\n') : `${p.label}: no flood or weather warning in force.`);
        if (p.crime) lines.push(p.crime.total ? `${p.label}: ${p.crime.total} crimes reported within a mile in ${monthName(p.crime.month)} (police.uk): ${p.crime.top.map(([c, n]) => `${c} ${n}`).join(', ')}.` : `${p.label}: no crimes reported within a mile in the latest month (police.uk).`);
      }
      const when = (['flood', 'weather', 'crime'] as const).map((f) => (info.checked[f] ? `${FEED_NAMES[f].name} checked ${clockIn(info.checked[f]!, info.tz)}` : info.failed[f] ? `${FEED_NAMES[f].name}: could not be read (${info.failed[f]})` : '')).filter(Boolean);
      return asData('the public warning feeds (Environment Agency, Met Office, police.uk)', `${lines.join('\n')}\n${when.join('; ')}. Crime counts are a published monthly picture, not a forecast.`);
    },
  },
];
