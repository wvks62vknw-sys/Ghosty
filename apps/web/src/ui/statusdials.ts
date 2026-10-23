/**
 * Route C's three Status dials (the Me sheet's Status card and System's STATUS panel): free AI today (the brain's
 * quota engine), the database today (its meter against the free daily allowance) and the offline brain on this
 * phone (can it run here, is it downloaded, is it on). Each dial says when it has nothing to show.
 */
import type { BrainStatus } from '../../../../packages/shared/src/protocol';
import { h } from '../core/dom';
import { currentModel, offlineReady, offlineSupport } from '../offline/brain';
import { settings } from '../state/app';
import { databaseToday, freeAiToday, type Tone } from '../state/status';
import { gauge } from './components';

export interface StatusDials {
  el: HTMLElement;
  /** Read the dials from a status (null: the brain could not be reached). Resolves to the tones shown. */
  paint(st: BrainStatus | null): Promise<Tone[]>;
  /** What each dial reads ("72% · Groq ready"), for specs. */
  read(): Record<string, string>;
}

export function statusDials(): StatusDials {
  const dials = {
    ai: { g: gauge(74, 'left'), label: 'Free AI today', sub: h('small', 'measuring…') },
    db: { g: gauge(74, 'used'), label: 'Database today', sub: h('small', 'measuring…') },
    off: { g: gauge(74), label: 'Offline brain', sub: h('small', 'checking…') },
  };
  const said: Record<string, string> = {};
  for (const d of Object.values(dials)) d.g.set(null, '—', '', 'idle');
  const el = h('div.megauges', ...Object.entries(dials).map(([k, d]) => h('div.megauge', { dataset: { dial: k, case: 'keep' } }, d.g.el, h('b', d.label), d.sub)));
  const say = (k: keyof typeof dials, frac: number | null, value: string, unit: string, sub: string, tone: Tone): Tone => {
    dials[k].g.set(frac, value, unit, tone);
    dials[k].sub.textContent = sub;
    said[k] = `${value}${unit} · ${sub}`;
    return tone;
  };
  return {
    el,
    read: () => ({ ...said }),
    async paint(st) {
      const ai = freeAiToday(st?.capacity);
      const db = databaseToday(st?.meter);
      const tones = [
        say('ai', ai.frac, ai.value, ai.unit, st ? ai.ready : 'brain unreachable', st ? ai.tone : 'idle'),
        say('db', db.frac, db.value, db.unit, st ? db.sub : 'brain unreachable', st ? db.tone : 'idle'),
      ];
      const sup = await offlineSupport().catch(() => ({ ok: false, reason: '' }));
      const m = currentModel();
      if (settings.get().offlineBrain === 'off') tones.push(say('off', null, 'Off', '', 'switched off in Settings', 'idle'));
      else if (!sup.ok) tones.push(say('off', null, 'No', '', 'not on this phone', 'idle'));
      else if (await offlineReady().catch(() => false)) tones.push(say('off', 1, 'Ready', '', `${m.label}, on phone`, 'live'));
      else tones.push(say('off', 0, 'Not yet', '', `${m.mb} MB to download`, 'idle'));
      return tones;
    },
  };
}
