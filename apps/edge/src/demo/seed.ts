/**
 * THE DEMO'S SAMPLE DATA (BRIEF-REST-B part 3): a made-up owner, Sam, made-up places and a sample week, all written here and
 * nowhere else, put into the demo brain's own storage each time it is empty or twenty minutes old (demo/index.ts `freshen`).
 * Nothing in it is, or comes from, a real person's life: the addresses are invented, the people are invented, the dates are
 * worked out from "now" so the week is always the coming week. Written with the brain's own functions, so the screens read it
 * exactly as they read a real one.
 */
import { addEvent } from '../schedule';
import { keepPlace } from '../places';
import { addFact } from '../tools/memory';

const H = 3_600_000;
const D = 24 * H;

/** Midnight (London) at the start of the day `now` falls in, as a UTC time in ms (close enough for sample data: the hour is what matters). */
function dayStart(now: number): number {
  const d = new Date(now);
  const london = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/London' }));
  return d.getTime() - (london.getHours() * H + london.getMinutes() * 60_000 + london.getSeconds() * 1000 + d.getMilliseconds());
}

/** The sample facts: what the Memory tab shows. */
export const SAMPLE_FACTS = [
  'My name is Sam.',
  'I live in Sampleton and work at the Example Library, four days a week.',
  'I play the guitar on Sundays and I am learning Spanish.',
  'I am vegetarian, and Thursday is pasta night.',
  'My sister Alex has her birthday on 14 December.',
  'I am saving for a bike: forty pounds a month.',
  'I like to be told the day in two sentences, not ten.',
  'I walk to work when it is dry and take the bus when it is not.',
];

/** The sample places: invented addresses (there is no such Sampleton). */
export const SAMPLE_PLACES = [
  { id: 'home', label: 'Home', query: '1 Demo Lane, Sampleton', address: '1 Demo Lane, Sampleton (made up)', lat: 53.7965, lon: -1.5478 },
  { id: 'work', label: 'Work', query: 'Example Library, Sampleton', address: 'The Example Library, Sample Street, Sampleton (made up)', lat: 53.8008, lon: -1.5491 },
  { id: 'gym', label: 'Gym', query: 'Sample Fitness, Sampleton', address: 'Sample Fitness, Test Road, Sampleton (made up)', lat: 53.7937, lon: -1.536 },
  { id: 'parents', label: "Parents'", query: '9 Example Close, Sampleton', address: '9 Example Close, Sampleton (made up)', lat: 53.814, lon: -1.582 },
];

/** Sam's sample week, as offsets from the start of today: [days, hour, minutes long, title, where]. */
export const SAMPLE_WEEK: [number, number, number, string, string?][] = [
  [0, 18.5, 60, 'Guitar practice'],
  [1, 9, 480, 'Library shift', 'The Example Library'],
  [1, 19, 90, 'Spanish with Marta (sample)'],
  [2, 9, 480, 'Library shift', 'The Example Library'],
  [2, 12.5, 45, 'Dentist: check-up (sample)', 'Test Road Dental'],
  [3, 18, 75, 'Pasta night with Alex', 'Home'],
  [4, 9, 480, 'Library shift', 'The Example Library'],
  [4, 19.5, 150, "Alex's birthday dinner (sample)", 'The Example Arms'],
  [5, 10, 90, 'Park run (sample)', 'Sample Park'],
  [6, 16, 60, 'Guitar: a new riff'],
  [8, 18, 60, 'Book club (sample)', 'The Example Library'],
];

/** What Sam and Ghosty said earlier: the chat's history in the demo. */
export function sampleTurns(now: number): { role: 'user' | 'assistant'; text: string; at: number; model: string }[] {
  const t = (mins: number) => now - mins * 60_000;
  return [
    { role: 'user', text: "What's on tomorrow?", at: t(190), model: 'demo' },
    { role: 'assistant', text: 'A library shift from nine to five, and Spanish with Marta at seven. Nothing else yet. (This is sample data.)', at: t(190), model: 'demo' },
    { role: 'user', text: 'Can you remind me to practise the riff?', at: t(120), model: 'demo' },
    { role: 'assistant', text: 'In the real Ghosty I would set that reminder for you. This is the demo, so nothing is set here: but it is in the sample agenda on Sunday.', at: t(120), model: 'demo' },
  ];
}

/** Write the sample data into the demo brain's (empty) storage. */
export async function seedDemo(storage: DurableObjectStorage, now: number): Promise<void> {
  for (const f of SAMPLE_FACTS) await addFact(storage, f, { kind: 'owner', at: now - 3 * D });
  for (const p of SAMPLE_PLACES) await keepPlace(storage, { ...p, id: p.id });
  const start = dayStart(now);
  for (const [day, hour, mins, title, where] of SAMPLE_WEEK) {
    const at = start + day * D + hour * H;
    await addEvent(storage, { title, start: at, end: at + mins * 60_000, ...(where ? { location: where } : {}) });
  }
  await storage.put('turns', sampleTurns(now));
}
