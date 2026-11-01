/**
 * THE CARS HE NAMES (BRIEF-SIDEWAYS item 2d; OWNER-ISSUES 93c): "my dad's car is RX15 KNG" is kept as one line in his
 * memory — whose, the plate, a nickname — locked, so the nightly reflection never rewrites it, and forgotten in one tap
 * (the Memory tab, or Settings → GUARDIAN → PEOPLE). Cars are only ever his or those of people he introduced: his named
 * person, a relation ("my dad", "my mate Haris") or someone whose car he named before. A plate gives the vehicle's public
 * facts only (the vehicle check as it is); nothing about a keeper is ever looked for or kept. The months its MOT and tax
 * fall due are kept on the line once he has looked at its card, for the day's pieces (speak.ts).
 *
 *   GET /cars → { cars } · POST /cars { said } → kept from his own words, by the same code as the chat · POST /cars/months
 *   { plate, mot?, tax? } · DELETE /cars/<plate>
 */
import { carFactText, carName, carSaid, parseCarFact, personCard, plateOffer, platesIn, type Card, type NamedCar } from '../../../packages/shared/src/cards';
import type { MemoryFact } from '../../../packages/shared/src/protocol';
import { formatPlate, isPlate, normalisePlate } from '../../../packages/shared/src/plates';
import { loadConfig, loadWalk, personRoute } from './guardstate';
import type { Vault } from './kernel/vault';
import { loadMemory, MEMORY_KEY } from './tools/memory';

export type KeptCar = NamedCar & { id: string; at: number };

const MAX_FACTS = 500;
/** A message that is a plate and nothing else ("ab12 cde?"): the plate, else ''. */
const bareOf = (t: string) => (/^[\sA-Za-z0-9?!.]+$/.test(t.trim()) ? normalisePlate(t.trim().replace(/[?!.]+$/, '')) : '');
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Every car he named, from his memory. */
export async function listCars(storage: DurableObjectStorage): Promise<KeptCar[]> {
  return (await loadMemory(storage)).flatMap((f) => {
    const c = parseCarFact(f.text);
    return c ? [{ ...c, id: f.id, at: f.at }] : [];
  });
}

/** The people he introduced: the guardian's named person and everyone whose car he named. */
export async function knownPeople(storage: DurableObjectStorage): Promise<string[]> {
  const [cfg, cars] = await Promise.all([loadConfig(storage).catch(() => ({}) as Awaited<ReturnType<typeof loadConfig>>), listCars(storage).catch(() => [])]);
  const names = [cfg.person?.name ?? '', ...cars.filter((c) => c.whose !== 'me').map((c) => c.whose)].map((n) => n.trim()).filter(Boolean);
  return [...new Map(names.map((n) => [n.toLowerCase(), n])).values()];
}

/** Keep a car he named: one line per plate (naming it again moves it or renames it), locked, from the chat. */
export async function saveCar(storage: DurableObjectStorage, c: NamedCar, now = Date.now()): Promise<NamedCar> {
  const p = normalisePlate(c.plate);
  if (!isPlate(p)) throw new Error('that is not a UK number plate');
  const whose = c.whose === 'me' ? 'me' : c.whose.replace(/[^\p{L}' -]/gu, '').trim().slice(0, 40);
  if (!whose) throw new Error('whose car is it?');
  const facts = await loadMemory(storage);
  const i = facts.findIndex((f) => normalisePlate(parseCarFact(f.text)?.plate ?? '') === p);
  const prev = i >= 0 ? parseCarFact(facts[i]!.text) : null;
  const next: NamedCar = { whose, plate: formatPlate(p) };
  const nickname = c.nickname ?? prev?.nickname;
  if (nickname) next.nickname = nickname.slice(0, 30);
  // (a car that changed hands keeps no months from before)
  if (prev && prev.whose === whose) {
    if (prev.mot) next.mot = prev.mot;
    if (prev.tax) next.tax = prev.tax;
  }
  const text = carFactText(next);
  if (i >= 0) facts[i] = { ...facts[i]!, text, edited: now, locked: true };
  else facts.push({ id: crypto.randomUUID().slice(0, 8), text, at: now, src: { kind: 'chat', at: now }, locked: true } satisfies MemoryFact);
  while (facts.length > MAX_FACTS) {
    const k = facts.findIndex((f) => !f.locked);
    facts.splice(k < 0 ? 0 : k, 1);
  }
  await storage.put(MEMORY_KEY, facts);
  return next;
}

/** The months a named car's MOT and tax fall due ("2027-03"), from a card he looked at. Only for a car he named. */
export async function setMonths(storage: DurableObjectStorage, plate: string, m: { mot?: unknown; tax?: unknown }): Promise<NamedCar | null> {
  const p = normalisePlate(plate);
  const facts = await loadMemory(storage);
  const i = facts.findIndex((f) => normalisePlate(parseCarFact(f.text)?.plate ?? '') === p);
  if (i < 0) return null;
  const car = parseCarFact(facts[i]!.text)!;
  if (typeof m.mot === 'string' && MONTH.test(m.mot)) car.mot = m.mot;
  if (typeof m.tax === 'string' && MONTH.test(m.tax)) car.tax = m.tax;
  facts[i] = { ...facts[i]!, text: carFactText(car) };
  await storage.put(MEMORY_KEY, facts);
  return car;
}

export async function forgetCar(storage: DurableObjectStorage, plate: string): Promise<boolean> {
  const p = normalisePlate(plate);
  const facts = await loadMemory(storage);
  const keep = facts.filter((f) => normalisePlate(parseCarFact(f.text)?.plate ?? '') !== p);
  if (keep.length === facts.length) return false;
  await storage.put(MEMORY_KEY, keep);
  return true;
}

/** The PERSON card for someone he introduced — null for anyone else (a stranger's name gets nothing). */
export async function personFor(d: { storage: DurableObjectStorage; vault: Pick<Vault, 'get'> }, name: string): Promise<Card | null> {
  const low = name.trim().toLowerCase();
  const [cfg, cars] = await Promise.all([loadConfig(d.storage), listCars(d.storage)]);
  const theirs = cars.filter((c) => c.whose.toLowerCase() === low);
  const named = cfg.person && cfg.person.name.trim().toLowerCase() === low ? cfg.person : undefined;
  if (!named && !theirs.length) return null;
  const via = named ? await personRoute({ vault: d.vault }, named).catch(() => '' as const) : '';
  const walk = named ? await loadWalk(d.storage).catch(() => null) : null;
  return personCard({ name: named?.name ?? theirs[0]!.whose, ...(named ? { named: { via } } : {}), cars: theirs, walk: !!walk && walk.stage !== 'done' });
}

/**
 * His words answered by code, with no model, on every channel: a car he names → kept, with its person's card (or, his
 * own, its card offer); a plate on its own → the offer of its car ("That's a plate. Want the car?"), or the car he named.
 */
export async function carTurn(d: { storage: DurableObjectStorage; vault: Pick<Vault, 'get'> }, text: string): Promise<{ text: string; cards: Card[] } | null> {
  // (no plate, nothing to do: the database is not read for an ordinary message)
  const plates = platesIn(text);
  if (!plates.length) return null;
  const known = (await knownPeople(d.storage)).map((n) => n.toLowerCase());
  const car = carSaid(text, known);
  if (car) {
    const kept = await saveCar(d.storage, car);
    const nick = kept.nickname ? ` (${kept.nickname})` : '';
    if (kept.whose === 'me') return { text: `Kept: your car is ${kept.plate}${nick}. Type its plate any time for its MOT and tax.`, cards: [plateOffer(kept.plate, kept)] };
    const person = await personFor(d, kept.whose);
    return { text: `Kept: ${kept.whose}'s car is ${kept.plate}${nick}. It's under ${kept.whose} in Settings → Guardian → People.`, cards: person ? [person] : [] };
  }
  if (plates.length !== 1 || bareOf(text) !== plates[0]) return null;
  const named = (await listCars(d.storage)).find((c) => normalisePlate(c.plate) === plates[0]);
  return { text: named ? `That's ${carName(named).replace(/^Your\b/, 'your')}.` : "That's a plate. Want the car?", cards: [plateOffer(plates[0]!, named)] };
}

const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function carsRoute(req: Request, path: string, method: string, d: { storage: DurableObjectStorage; vault: Pick<Vault, 'get'> }): Promise<Response> {
  const body = method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  if (path === '/cars' && method === 'GET') return json({ cars: await listCars(d.storage) });
  if (path === '/cars' && method === 'POST') {
    // from his own words, read by the same code as the chat: only his car or an introduced person's is ever kept
    const car = carSaid(String(body.said ?? ''), (await knownPeople(d.storage)).map((n) => n.toLowerCase()));
    if (!car) return json({ error: 'not a car of yours or of someone you introduced' }, 400);
    return json({ car: await saveCar(d.storage, car), cars: await listCars(d.storage) });
  }
  if (path === '/cars/months' && method === 'POST') {
    const car = await setMonths(d.storage, String(body.plate ?? ''), body);
    return car ? json({ car }) : json({ error: 'not a car you named' }, 404);
  }
  const m = /^\/cars\/([A-Za-z0-9 %]{2,24})$/.exec(path);
  if (m && method === 'DELETE') return json({ forgotten: await forgetCar(d.storage, decodeURIComponent(m[1]!)), cars: await listCars(d.storage) });
  return json({ error: 'not found' }, 404);
}
