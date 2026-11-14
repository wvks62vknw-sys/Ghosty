/**
 * The Health app's export (export.zip holding apple_health_export/export.xml), read as a stream. The XML can be
 * gigabytes: every sample is one <Record> element, so the reader passes each one to the app's tally and keeps only
 * the day totals. The phone and a watch both write steps and sleep, so each day takes the one source that saw the
 * most, never the sum of both (the sum would count every step twice).
 */
import { Sax } from './xml';
import { addDays, round, type Rec } from './input';

export interface HealthRecord { kind: 'record'; type: string; source: string; unit: string; value: string; start: string; end: string }
export interface HealthWorkout { kind: 'workout'; type: string; mins: number; km: number; kcal: number; start: string; end: string }
export interface HealthSummary { kind: 'summary'; day: string; move: number; moveGoal: number; exercise: number; stand: number }
export type HealthItem = HealthRecord | HealthWorkout | HealthSummary;

/** The zip entry holding the samples (not the clinical records or the route files beside it). */
export const healthAccept = (name: string): boolean => /(^|\/)(export|exportar|exporter|exportieren)\.xml$/.test(name);

const toKm = (v: number, unit: string): number => (unit === 'mi' ? v * 1.609344 : unit === 'm' ? v / 1000 : unit === 'yd' ? v * 0.0009144 : v);
const toKcal = (v: number, unit: string): number => (unit === 'kJ' ? v / 4.184 : v);
const toMins = (v: number, unit: string): number => (unit === 'h' || unit === 'hr' ? v * 60 : unit === 's' || unit === 'sec' ? v / 60 : v);

/** A stream reader that calls `emit` for every sample, workout and day summary. */
export function healthReader(emit: (item: HealthItem) => void): { push(t: string): void; end(): void } {
  let wk: HealthWorkout | null = null;
  const sax = new Sax({
    wants: (n) => n === 'Record' || n === 'Workout' || n === 'WorkoutStatistics' || n === 'ActivitySummary',
    open(name, a, self) {
      if (name === 'Record') {
        emit({ kind: 'record', type: a.type ?? '', source: a.sourceName ?? '', unit: a.unit ?? '', value: a.value ?? '', start: a.startDate ?? '', end: a.endDate ?? '' });
      } else if (name === 'Workout') {
        const w: HealthWorkout = {
          kind: 'workout',
          type: workoutName(a.workoutActivityType ?? ''),
          mins: toMins(Number(a.duration) || 0, a.durationUnit ?? 'min'),
          km: a.totalDistance ? toKm(Number(a.totalDistance) || 0, a.totalDistanceUnit ?? 'km') : 0,
          kcal: a.totalEnergyBurned ? toKcal(Number(a.totalEnergyBurned) || 0, a.totalEnergyBurnedUnit ?? 'kcal') : 0,
          start: a.startDate ?? '',
          end: a.endDate ?? '',
        };
        if (self) emit(w);
        else wk = w;
      } else if (name === 'WorkoutStatistics' && wk) {
        const v = Number(a.sum) || 0;
        if (/Distance/.test(a.type ?? '') && !wk.km) wk.km = toKm(v, a.unit ?? 'km');
        if (/ActiveEnergyBurned/.test(a.type ?? '') && !wk.kcal) wk.kcal = toKcal(v, a.unit ?? 'kcal');
      } else if (name === 'ActivitySummary' && a.dateComponents) {
        emit({
          kind: 'summary',
          day: a.dateComponents,
          move: toKcal(Number(a.activeEnergyBurned) || 0, a.activeEnergyBurnedUnit ?? 'kcal'),
          moveGoal: toKcal(Number(a.activeEnergyBurnedGoal) || 0, a.activeEnergyBurnedUnit ?? 'kcal'),
          exercise: Number(a.appleExerciseTime) || 0,
          stand: Number(a.appleStandHours) || 0,
        });
      }
    },
    close(name) {
      if (name === 'Workout' && wk) { emit(wk); wk = null; }
    },
  });
  return { push: (t) => sax.push(t), end: () => sax.end() };
}

const WORKOUT_NAMES: Record<string, string> = {
  TraditionalStrengthTraining: 'Strength', FunctionalStrengthTraining: 'Strength', HighIntensityIntervalTraining: 'Intervals',
  MixedCardio: 'Cardio', CoreTraining: 'Core', MindAndBody: 'Mind and body', Elliptical: 'Cross trainer', StairClimbing: 'Stairs',
  Other: 'Other',
};
/** "HKWorkoutActivityTypeTraditionalStrengthTraining" → "Strength"; "HKWorkoutActivityTypeRunning" → "Running". */
export function workoutName(t: string): string {
  const k = t.replace(/^HKWorkoutActivityType/, '');
  if (WORKOUT_NAMES[k]) return WORKOUT_NAMES[k];
  const words = k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : 'Workout';
}

// The export writes local wall time with its offset ("2026-11-14 07:30:00 +0000"): the day and the time are read as written.
const dayOf = (s: string) => s.slice(0, 10);
const timeOf = (s: string) => s.slice(11, 16);
const ms = (s: string) => Date.parse(s.replace(' ', 'T').replace(/ ([+-]\d{2})(\d{2})$/, '$1:$2'));

/** A tally: fed every item, gives the app's records at the end. */
export interface Tally { add(item: HealthItem): void; done(): Rec[] }

/** The source with the largest value of `pick` in a map of source → totals. */
function bestOf<T>(m: Map<string, T>, pick: (t: T) => number): T | undefined {
  let best: T | undefined;
  for (const t of m.values()) if (!best || pick(t) > pick(best)) best = t;
  return best;
}

/** Steps, walking distance and flights a day. */
export function stepsTally(): Tally {
  const days = new Map<string, Map<string, { steps: number; km: number; flights: number }>>();
  const slot = (day: string, src: string) => {
    let d = days.get(day);
    if (!d) days.set(day, (d = new Map()));
    let s = d.get(src);
    if (!s) d.set(src, (s = { steps: 0, km: 0, flights: 0 }));
    return s;
  };
  return {
    add(it) {
      if (it.kind !== 'record') return;
      const v = Number(it.value);
      if (!Number.isFinite(v)) return;
      if (it.type === 'HKQuantityTypeIdentifierStepCount') slot(dayOf(it.start), it.source).steps += v;
      else if (it.type === 'HKQuantityTypeIdentifierDistanceWalkingRunning') slot(dayOf(it.start), it.source).km += toKm(v, it.unit);
      else if (it.type === 'HKQuantityTypeIdentifierFlightsClimbed') slot(dayOf(it.start), it.source).flights += v;
    },
    done() {
      return [...days].map(([day, m]) => {
        const s = bestOf(m, (t) => t.steps)!;
        const km = s.km || bestOf(m, (t) => t.km)!.km;
        const flights = s.flights || bestOf(m, (t) => t.flights)!.flights;
        return { _key: day, date: day, steps: Math.round(s.steps), km: round(km, 2), flights: Math.round(flights) };
      });
    },
  };
}

/** Sleep a night (the night belongs to the morning he woke: anything ending after 18:00 counts to the next day). */
export function sleepTally(): Tally {
  type N = { asleep: number; inbed: number; deep: number; rem: number; bed: string; wake: string; first: number; last: number };
  const nights = new Map<string, Map<string, N>>();
  return {
    add(it) {
      if (it.kind !== 'record' || it.type !== 'HKCategoryTypeIdentifierSleepAnalysis') return;
      const a = ms(it.start), b = ms(it.end);
      if (!(b > a)) return;
      const mins = (b - a) / 60000;
      const night = +it.end.slice(11, 13) >= 18 ? addDays(dayOf(it.end), 1) : dayOf(it.end);
      let m = nights.get(night);
      if (!m) nights.set(night, (m = new Map()));
      let n = m.get(it.source);
      if (!n) m.set(it.source, (n = { asleep: 0, inbed: 0, deep: 0, rem: 0, bed: '', wake: '', first: Infinity, last: -Infinity }));
      const v = it.value.replace('HKCategoryValueSleepAnalysis', '');
      if (v === 'InBed') n.inbed += mins;
      else if (v.startsWith('Asleep')) {
        n.asleep += mins;
        if (v === 'AsleepDeep') n.deep += mins;
        if (v === 'AsleepREM') n.rem += mins;
      }
      if (v !== 'Awake') {
        if (a < n.first) { n.first = a; n.bed = timeOf(it.start); }
        if (b > n.last) { n.last = b; n.wake = timeOf(it.end); }
      }
    },
    done() {
      const out: Rec[] = [];
      for (const [night, m] of nights) {
        const n = bestOf(m, (t) => t.asleep || t.inbed / 1e6)!;
        const inbed = n.inbed || bestOf(m, (t) => t.inbed)!.inbed || (n.last - n.first) / 60000;
        out.push({ _key: night, date: night, asleep: Math.round(n.asleep), inbed: Math.round(inbed), deep: Math.round(n.deep), rem: Math.round(n.rem), bed: n.bed, wake: n.wake });
      }
      return out;
    },
  };
}

/** Heart rate a day: the average, lowest and highest, his resting rate and his variability. */
export function heartTally(): Tally {
  type D = { sum: number; n: number; low: number; high: number; resting: number; hrvSum: number; hrvN: number };
  const days = new Map<string, D>();
  const day = (k: string) => {
    let d = days.get(k);
    if (!d) days.set(k, (d = { sum: 0, n: 0, low: Infinity, high: -Infinity, resting: 0, hrvSum: 0, hrvN: 0 }));
    return d;
  };
  return {
    add(it) {
      if (it.kind !== 'record') return;
      const v = Number(it.value);
      if (!Number.isFinite(v)) return;
      if (it.type === 'HKQuantityTypeIdentifierHeartRate') {
        const d = day(dayOf(it.start));
        d.sum += v; d.n++;
        if (v < d.low) d.low = v;
        if (v > d.high) d.high = v;
      } else if (it.type === 'HKQuantityTypeIdentifierRestingHeartRate') day(dayOf(it.start)).resting = v;
      else if (it.type === 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN') { const d = day(dayOf(it.start)); d.hrvSum += v; d.hrvN++; }
    },
    done() {
      return [...days].map(([k, d]) => {
        const r: Rec = { _key: k, date: k };
        if (d.n) { r.avg = Math.round(d.sum / d.n); r.low = Math.round(d.low); r.high = Math.round(d.high); }
        if (d.resting) r.resting = Math.round(d.resting);
        if (d.hrvN) r.hrv = Math.round(d.hrvSum / d.hrvN);
        return r;
      });
    },
  };
}

/** Every workout. */
export function workoutsTally(): Tally {
  const out: Rec[] = [];
  return {
    add(it) {
      if (it.kind !== 'workout' || !it.start) return;
      const r: Rec = { _key: `${it.start}|${it.type}`, date: dayOf(it.start), time: timeOf(it.start), type: it.type, mins: Math.round(it.mins) };
      if (it.km) r.km = round(it.km, 2);
      if (it.kcal) r.kcal = Math.round(it.kcal);
      out.push(r);
    },
    done: () => out,
  };
}

/** Weight and body fat, the last reading of each day. */
export function weightTally(): Tally {
  const days = new Map<string, { kg?: number; fat?: number }>();
  return {
    add(it) {
      if (it.kind !== 'record') return;
      const v = Number(it.value);
      if (!Number.isFinite(v)) return;
      const k = dayOf(it.start);
      if (it.type === 'HKQuantityTypeIdentifierBodyMass') {
        const kg = it.unit === 'lb' ? v * 0.45359237 : it.unit === 'g' ? v / 1000 : it.unit === 'st' ? v * 6.35029318 : v;
        days.set(k, { ...days.get(k), kg: round(kg, 1) });
      } else if (it.type === 'HKQuantityTypeIdentifierBodyFatPercentage') {
        days.set(k, { ...days.get(k), fat: round(it.unit === '%' && v > 1 ? v : v * 100, 1) });
      }
    },
    done: () => [...days].filter(([, d]) => d.kg != null || d.fat != null).map(([k, d]) => ({ _key: k, date: k, ...d }) as Rec),
  };
}

/** The day's move, exercise and stand totals. */
export function activityTally(): Tally {
  const out = new Map<string, Rec>();
  return {
    add(it) {
      if (it.kind !== 'summary' || !/^\d{4}-\d{2}-\d{2}$/.test(it.day)) return;
      if (!it.move && !it.exercise && !it.stand) return;
      out.set(it.day, { _key: it.day, date: it.day, move: Math.round(it.move), goal: Math.round(it.moveGoal), exercise: Math.round(it.exercise), stand: Math.round(it.stand) });
    },
    done: () => [...out.values()],
  };
}
