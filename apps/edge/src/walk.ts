/**
 * WALK ME HOME, THE NAMED PERSON AND THE PANIC PHRASE (OWNER-ISSUES 55, 56, 60; guardian.ts is the watch).
 *
 *  - THE ONE NAMED PERSON, set once in Settings → GUARDIAN: a name and a Telegram handle (they open his bot once with the
 *    invite) or an email (sent from his own linked address, integrations/mail.ts) — never a text, which costs money.
 *  - WALK ME HOME: the brain runs the clock (a 'walk' job), so the check-in fires even if the phone sleeps. At the ETA
 *    "Home?" on his phone and on Telegram (with I'M HOME); ten minutes on, asked again (spoken when Ghosty is open); five
 *    more, the named person is messaged, once — with his last known position only if he opted in. "Home", "yes" or a tap
 *    ends it ("Good. Night."); a named person already told gets the all-clear, once. His position is only what the phone
 *    sends while it is open, for this walk, and it is dropped when the walk ends.
 *  - THE PANIC PHRASE: chosen by him; the phone keeps only a keyed hash of it and so does the brain
 *    (packages/shared/src/guardian.ts). Said or typed — in the app, in a voice note, on Telegram — the message goes at once,
 *    with his position when there is one.
 *
 * Routes (owner only):
 *   POST   /guardian/person          {name, telegram?, email?, sharePos, ownerName?} / DELETE /guardian/person
 *   POST   /guardian/test            → the test message to the named person
 *   POST   /guardian/panic-phrase    {salt, hash, n} (made on the phone: the phrase never leaves it) / DELETE
 *   POST   /guardian/panic           {pos?} → the message, at once
 *   POST   /guardian/walk            {minutes?, from?} → started, or {ask: 'How long?'} / POST /guardian/walk/end {how}
 *   POST   /guardian/walk/pos        {lat, lon} → the last known position, only while a walk is under way
 */
import { clockIn, homeSaid, minutesIn, panicAlert, panicSaid, safeNote, testNote, walkAlert, walkCancelled, walkStart } from '../../../packages/shared/src/guardian';
import { guardianInfo, json } from './guardian';
import { CONFIG_KEY, loadConfig, loadWalk, nowOf, personRoute, saveConfig, WALK_KEY, zoneOf, type GuardConfig, type GuardDeps, type Person, type WalkState } from './guardstate';
import { parseEmailKey, sendMessage } from './integrations/mail';
import { observe } from './mind';
import { feel } from './mood';
import { pushIfWanted } from './notifyprefs';
import { savedPlace } from './places';
import type { ClientContext } from './prompt';
import { addInbox, addJob, loadJobs, removeJob, type InboxItem } from './schedule';
import { loadLink, tgButton, tgSend } from './telegram';

const PENDING_KEY = 'guardian:pending';
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
/** "Home?" is asked again this long after the ETA, and the named person is messaged this long after that. */
export const ASK_AGAIN_MS = 10 * MIN;
export const ALERT_AFTER_MS = 5 * MIN;
/** A walk nobody ended is put away this long after its ETA (the named person was told long before). */
export const WALK_MAX_MS = 6 * HOUR;
/** A second panic message within this time is the same call (the phone and Telegram hearing one utterance). */
const PANIC_AGAIN_MS = 60_000;

/** What the named person knows him as: his own words in GUARDIAN, else his name in Ghosty (never "Boss"). */
async function ownerName(storage: DurableObjectStorage, c: GuardConfig): Promise<string> {
  if (c.ownerName?.trim()) return c.ownerName.trim();
  const n = ((await storage.get<ClientContext>('owner:ctx').catch(() => undefined)) ?? {}).name?.trim() ?? '';
  return n && !/^boss$/i.test(n) ? n : 'Your friend';
}

// ---------------------------------------------------------------- the named person

/** A message to the named person: Telegram if they use his bot, else his own email. Throws, in plain words, when neither can go. */
export async function messagePerson(d: GuardDeps, subject: string, text: string): Promise<'telegram' | 'email'> {
  const c = await loadConfig(d.storage);
  const p = c.person;
  if (!p) throw new Error('there is no named person yet (Settings → GUARDIAN)');
  const route = await personRoute(d, p);
  if (route === 'telegram') {
    if (d.send?.telegram) await d.send.telegram(p.chatId!, text);
    else await tgSend((await d.vault.get('telegram'))!, p.chatId!, text);
    return 'telegram';
  }
  if (route === 'email') {
    if (d.send?.email) await d.send.email(p.email!, subject, text);
    else await sendMessage(parseEmailKey((await d.vault.get('email'))!), { to: [p.email!], subject, body: text });
    return 'email';
  }
  if (p.telegram && !p.chatId) throw new Error(`${p.name} hasn't opened your bot with the invite yet, and there's no email for them`);
  if (p.email) throw new Error('your email is not linked (LINKS → EMAIL), so I cannot email them');
  throw new Error(`I have no way to reach ${p.name}`);
}

/** The owner's own Telegram chat, with an optional button (I'M HOME). */
export async function tellOwner(d: GuardDeps, text: string, button?: { label: string; id: string }): Promise<boolean> {
  try {
    const link = await loadLink(d.env, d.storage);
    if (!link?.chatId) return false;
    if (d.send?.telegram) {
      await d.send.telegram(link.chatId, text, button);
      return true;
    }
    const token = await d.vault.get('telegram');
    if (!token) return false;
    if (button) await tgButton(token, link.chatId, text, 'w', button.id, button.label);
    else await tgSend(token, link.chatId, text);
    return true;
  } catch {
    return false;
  }
}

export async function pushOwner(d: GuardDeps, msg: { title: string; body: string; tag?: string; url?: string }): Promise<void> {
  try {
    if (d.send?.push) await d.send.push(msg);
    else await pushIfWanted(d.storage, null, msg, d.contact);
  } catch {
    /* no phone subscribed: the inbox and Telegram still carry it */
  }
}

const HANDLE = /^@?([A-Za-z][A-Za-z0-9_]{4,31})$/;
const EMAIL = /^[^\s@<>()",;]{1,64}@[^\s@<>()",;]{1,190}\.[a-z]{2,24}$/i;
const code = () => [...crypto.getRandomValues(new Uint8Array(9))].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

/** Set (or change) the named person. A Telegram handle gets a fresh invite; their chat is kept while the handle stays. */
export async function setPerson(storage: DurableObjectStorage, b: Record<string, unknown>, now = Date.now()): Promise<GuardConfig> {
  const name = String(b.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!name) throw new Error('say who they are: a name');
  const tg = String(b.telegram ?? '').trim();
  const em = String(b.email ?? '').trim();
  if (tg && !HANDLE.test(tg)) throw new Error('a Telegram handle is 5 to 32 letters, digits or _ (like @sam_k)');
  if (em && !EMAIL.test(em)) throw new Error('that email address does not look right');
  if (!tg && !em) throw new Error('give a Telegram handle or an email address: I never send texts (they cost money)');
  const c = await loadConfig(storage);
  const handle = tg ? `@${HANDLE.exec(tg)![1]}` : '';
  const same = c.person && handle && c.person.telegram?.toLowerCase() === handle.toLowerCase();
  const person: Person = {
    name,
    ...(handle ? { telegram: handle } : {}),
    ...(em ? { email: em } : {}),
    sharePos: b.sharePos === true,
    ...(same && c.person?.chatId ? { chatId: c.person.chatId } : {}),
    ...(handle && !(same && c.person?.chatId) ? { invite: same && c.person?.invite ? c.person.invite : { code: code(), at: now } } : {}),
  };
  const ownerWords = typeof b.ownerName === 'string' ? b.ownerName.replace(/\s+/g, ' ').trim().slice(0, 40) : undefined;
  const next: GuardConfig = { ...c, person, ...(ownerWords !== undefined ? { ownerName: ownerWords } : {}) };
  await saveConfig(storage, next);
  return next;
}

/** The named person opened his bot with the invite: their chat is kept (and nothing they send is ever acted on). */
export async function personJoined(d: GuardDeps, inviteCode: string, chatId: number, username: string | undefined, now = Date.now()): Promise<string | null> {
  const c = await loadConfig(d.storage);
  const p = c.person;
  if (!p?.invite || p.invite.code !== inviteCode || now - p.invite.at > 14 * DAY) return null;
  const want = p.telegram?.replace(/^@/, '').toLowerCase();
  if (want && username && username.toLowerCase() !== want) return `This link is for ${p.telegram}. Ask ${await ownerName(d.storage, c)} for your own.`;
  const { invite: _i, ...rest } = p;
  await saveConfig(d.storage, { ...c, person: { ...rest, chatId } });
  await d.notify({ kind: 'task', title: 'Guardian', text: `${p.name} is linked on Telegram: if you ever need them, I can reach them there.` }).catch(() => undefined);
  return `Thanks, ${p.name}. ${await ownerName(d.storage, c)} has named you as the one person I contact if he doesn't answer me on a walk home, or if he uses his emergency phrase. That's all: I won't message you for anything else.`;
}

// ---------------------------------------------------------------- the walk home

/** The walking time from where he is to a place (the free OpenStreetMap foot router), in minutes; null when it would not answer. */
export async function walkingMinutes(from: { lat: number; lon: number }, to: { lat: number; lon: number }): Promise<number | null> {
  try {
    const r = await fetch(`https://routing.openstreetmap.de/routed-foot/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`, { headers: { 'User-Agent': 'Ghosty/2.0 (personal assistant; single user)' }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j = (await r.json()) as { routes?: { duration?: number }[] };
    const s = j.routes?.[0]?.duration;
    return typeof s === 'number' && s > 0 ? Math.max(1, Math.round(s / 60)) : null;
  } catch {
    return null;
  }
}

const okPos = (p: unknown): p is { lat: number; lon: number } => !!p && typeof p === 'object' && Number.isFinite((p as { lat: number }).lat) && Number.isFinite((p as { lon: number }).lon) && Math.abs((p as { lat: number }).lat) <= 90 && Math.abs((p as { lon: number }).lon) <= 180;

/** The words when a walk starts: when he'll be asked, how to end it, and the honest limit. */
function startWords(w: WalkState, zone: string, person: string, named: string): string {
  const mins = Math.max(1, Math.round((w.eta - w.startedAt) / MIN));
  const limit = w.via === 'telegram' ? "I can't see where you are from Telegram" : 'I only know where you are while I’m open';
  const who = person ? ` If you don't answer, I'll message ${person}.` : named ? ` (I can't reach ${named} yet: Settings → GUARDIAN.)` : ' (No named person yet: Settings → GUARDIAN.)';
  return `Walking you ${w.to.toLowerCase() === 'home' ? 'home' : `to ${w.to}`}: about ${mins} minute${mins === 1 ? '' : 's'}, so I'll ask at ${clockIn(w.eta, zone)}. Say "home" when you're in.${who} ${limit}.`;
}

/**
 * Start a walk home: `minutes` when he said how long, else the walking time from `from` (the phone's one position fix),
 * else the question back ("How long?"). One walk at a time: a new one replaces the last.
 */
export async function startWalk(d: GuardDeps, o: { minutes?: number | null; from?: { lat: number; lon: number } | null; via: 'app' | 'telegram' }): Promise<{ walk: WalkState; said: string } | { ask: string }> {
  const now = nowOf(d);
  const home = await savedPlace(d.storage, 'home');
  let minutes = o.minutes && o.minutes > 0 ? Math.min(240, Math.round(o.minutes)) : null;
  if (!minutes && home && okPos(o.from)) minutes = await (d.route ?? walkingMinutes)(o.from, home);
  if (!minutes) {
    await d.storage.put(PENDING_KEY, { at: now, via: o.via });
    return { ask: home ? 'How long will it take you?' : "How long will it take you? (I don't know where home is yet, so I can't work it out.)" };
  }
  await d.storage.delete(PENDING_KEY);
  const c = await loadConfig(d.storage);
  const w: WalkState = { id: code().slice(0, 8), startedAt: now, eta: now + minutes * MIN, to: home?.label ?? 'Home', stage: 'walking', via: o.via, ...(okPos(o.from) ? { pos: { lat: o.from.lat, lon: o.from.lon, at: now }, posAt: now } : {}) };
  await d.storage.put(WALK_KEY, w);
  for (const j of (await loadJobs(d.storage)).filter((x) => x.kind === 'walk')) await removeJob(d.storage, j.id);
  await addJob(d.storage, { kind: 'walk', title: 'Walk me home', text: w.id, next: w.eta, repeat: 'none', tz: 'UTC' });
  const zone = await zoneOf(d.storage);
  await observe(d.storage, { kind: 'place', text: `set off home at ${clockIn(now, zone)}, due ${clockIn(w.eta, zone)}`, via: o.via }, now).catch(() => null);
  return { walk: w, said: startWords(w, zone, (await personRoute(d, c.person)) ? c.person!.name : '', c.person?.name ?? '') };
}

/** The last known position, while a walk is under way (kept on the walk, dropped when it ends). */
export async function walkPos(d: GuardDeps, p: unknown): Promise<boolean> {
  const w = await loadWalk(d.storage);
  if (!w || w.stage === 'done' || !okPos(p)) return false;
  const now = nowOf(d);
  w.pos = { lat: +p.lat.toFixed(5), lon: +p.lon.toFixed(5), at: now };
  w.posAt = now;
  await d.storage.put(WALK_KEY, w);
  return true;
}

/** "Home?": his phone, his Telegram (with I'M HOME) and the inbox. The second time it is spoken too (when the phone is open). */
async function askHome(d: GuardDeps, w: WalkState, second: boolean, person: string): Promise<void> {
  const text = second ? `Are you home? Tap I'M HOME or say "home".${person ? ` If I don't hear from you in 5 minutes, I'll message ${person}.` : ''}` : `Home? You should be in by now. Tap I'M HOME, or say "home".`;
  await addInbox(d.storage, { kind: 'reminder', title: 'Home?', text }).catch(() => undefined);
  await pushOwner(d, { title: 'Home?', body: text, tag: `walk-${w.id}`, url: '/#walk' });
  await tellOwner(d, second ? `Home? ${text.replace(/^Are you home\? /, '')}` : 'Home?', { label: "I'M HOME", id: w.id });
}

/**
 * The walk's clock, run by its job: the step that is due (the first "Home?", the second, the message to the named person,
 * the walk put away), and when to come back (null: nothing more to do). Each step happens once.
 */
export async function walkTick(d: GuardDeps): Promise<number | null> {
  const w = await loadWalk(d.storage);
  if (!w || w.stage === 'done') return null;
  const now = nowOf(d);
  const c = await loadConfig(d.storage);
  const person = (await personRoute(d, c.person)) ? c.person!.name : '';
  const at2 = w.eta + ASK_AGAIN_MS;
  const at3 = at2 + ALERT_AFTER_MS;
  if (w.stage === 'walking') {
    if (now < w.eta) return w.eta;
    w.stage = 'asked';
    w.askedAt = now;
    await d.storage.put(WALK_KEY, w);
    await askHome(d, w, false, person);
    return at2;
  }
  if (w.stage === 'asked') {
    if (now < at2) return at2;
    w.stage = 'asked2';
    w.asked2At = now;
    await d.storage.put(WALK_KEY, w);
    await askHome(d, w, true, person);
    return at3;
  }
  if (w.stage === 'asked2') {
    if (now < at3) return at3;
    const zone = await zoneOf(d.storage);
    const owner = await ownerName(d.storage, c);
    try {
      if (!c.person) throw new Error('there is no named person (Settings → GUARDIAN)');
      const text = walkAlert({ owner, person: c.person.name, tz: zone, startedAt: w.startedAt, eta: w.eta, to: w.to, pos: c.person.sharePos && w.pos ? w.pos : null });
      // marked before it goes: if the brain stopped halfway, a second message is worse than none
      w.stage = 'alerted';
      w.alertedAt = now;
      await d.storage.put(WALK_KEY, w);
      w.alertVia = await messagePerson(d, `${owner} hasn't answered me`, text);
      await d.storage.put(WALK_KEY, w);
      await feel(d.storage, { kind: 'danger' }, now).catch(() => undefined);
      await d.notify({ kind: 'error', title: 'Walk home', text: `You didn't answer, so I've messaged ${c.person.name} by ${w.alertVia === 'telegram' ? 'Telegram' : 'email'}. Say "home" when you're in and I'll tell them you're fine.` });
      await observe(d.storage, { kind: 'place', text: `no answer on the walk home: messaged ${c.person.name}`, via: 'guardian' }, now).catch(() => null);
      return w.eta + WALK_MAX_MS;
    } catch (e) {
      const why = String((e as Error)?.message ?? e).slice(0, 200);
      w.tries = (w.tries ?? 0) + 1;
      // not sent: tried again in a minute (three times), then he is told it could not go
      if (w.tries < 3 && c.person) {
        w.stage = 'asked2';
        delete w.alertedAt;
        await d.storage.put(WALK_KEY, w);
        return now + MIN;
      }
      w.stage = 'alerted';
      await d.storage.put(WALK_KEY, w);
      await d.notify({ kind: 'error', title: 'Walk home', text: `You didn't answer, and I couldn't message anyone: ${why}.` });
      return w.eta + WALK_MAX_MS;
    }
  }
  if (now < w.eta + WALK_MAX_MS) return w.eta + WALK_MAX_MS;
  await endWalk(d, 'expired');
  return null;
}

/** The walk is over: "home" (the named person, if told, gets the all-clear once), cancelled, or put away. */
export async function endWalk(d: GuardDeps, how: 'home' | 'cancelled' | 'expired'): Promise<string> {
  const w = await loadWalk(d.storage);
  if (!w || w.stage === 'done') return how === 'home' ? 'Good.' : 'There is no walk under way.';
  const now = nowOf(d);
  const zone = await zoneOf(d.storage);
  const c = await loadConfig(d.storage);
  const told = w.stage === 'alerted' && !!w.alertVia;
  const { pos: _p, ...kept } = w;
  const done: WalkState = { ...kept, stage: 'done', how, endedAt: now };
  await d.storage.put(WALK_KEY, done);
  for (const j of (await loadJobs(d.storage)).filter((x) => x.kind === 'walk')) await removeJob(d.storage, j.id);
  if (how === 'home' && told && c.person && !w.safeSent) {
    try {
      await messagePerson(d, `${await ownerName(d.storage, c)} is fine`, safeNote({ owner: await ownerName(d.storage, c), person: c.person.name, tz: zone, at: now }));
      await d.storage.put(WALK_KEY, { ...done, safeSent: now });
    } catch {
      /* they will have heard nothing more: he is told below */
    }
  }
  if (how !== 'expired') await observe(d.storage, { kind: 'place', text: how === 'home' ? `home at ${clockIn(now, zone)}` : 'walk home cancelled', via: w.via }, now).catch(() => null);
  if (how === 'cancelled') return "Okay, I've stopped watching.";
  if (how === 'expired') return '';
  const h = Number(clockIn(now, zone).slice(0, 2));
  // (the Machine's two words after dark; in the day, one)
  const night = h >= 17 || h < 5 ? 'Good. Night.' : 'Good.';
  return told && c.person ? `${night} I've told ${c.person.name} you're fine.` : night;
}

// ---------------------------------------------------------------- the panic phrase

/** His panic phrase: the message goes at once, with his position when there is one (the phone's, else the walk's last). */
export async function panicNow(d: GuardDeps, o: { pos?: unknown; via: 'app' | 'telegram' }): Promise<{ sent: boolean; why?: string }> {
  const now = nowOf(d);
  const c = await loadConfig(d.storage);
  if (!c.person) return { sent: false, why: 'there is no named person (Settings → GUARDIAN)' };
  if (c.lastPanic && now - c.lastPanic < PANIC_AGAIN_MS) return { sent: true };
  const walk = await loadWalk(d.storage);
  const pos = okPos(o.pos) ? { lat: o.pos.lat, lon: o.pos.lon, at: now } : walk && walk.stage !== 'done' && walk.pos ? walk.pos : null;
  const zone = await zoneOf(d.storage);
  const owner = await ownerName(d.storage, c);
  await saveConfig(d.storage, { ...c, lastPanic: now });
  try {
    const via = await messagePerson(d, `${owner} needs you`, panicAlert({ owner, person: c.person.name, tz: zone, at: now, pos }));
    await feel(d.storage, { kind: 'danger' }, now).catch(() => undefined);
    // kept quietly: the inbox only — no push, no Telegram line, nothing on a screen someone else may be looking at
    await addInbox(d.storage, { kind: 'error', title: 'Emergency phrase', text: `Sent to ${c.person.name} by ${via === 'telegram' ? 'Telegram' : 'email'} at ${clockIn(now, zone)}${pos ? ', with your position' : ''}.`, read: true } as Omit<InboxItem, 'id' | 'at'>).catch(() => undefined);
    return { sent: true };
  } catch (e) {
    await saveConfig(d.storage, { ...c, lastPanic: 0 });
    return { sent: false, why: String((e as Error)?.message ?? e).slice(0, 200) };
  }
}

// ---------------------------------------------------------------- Telegram (his own chat)

/**
 * His words on Telegram, read before anything else (telegram.ts): the panic phrase (the message goes; the reply says
 * only "Done."), the walk's "home" / cancel, "walk me home" and the answer to "How long?". null: not the guardian's.
 */
export async function walkTelegram(d: GuardDeps, text: string): Promise<string | null> {
  const c = await loadConfig(d.storage);
  if (c.panic && (await panicSaid(text, c.panic))) {
    const r = await panicNow(d, { via: 'telegram' });
    return r.sent ? 'Done.' : `It couldn't go: ${r.why}.`;
  }
  const w = await loadWalk(d.storage);
  const walking = !!w && w.stage !== 'done';
  if (walking && homeSaid(text, w!.stage !== 'walking')) return endWalk(d, 'home');
  if (walking && walkCancelled(text)) return endWalk(d, 'cancelled');
  const start = walkStart(text);
  if (start) {
    if (walking && !start.minutes) return `I'm already walking you home: I'll ask at ${clockIn(w!.eta, await zoneOf(d.storage))}. Say "home" when you're in.`;
    const r = await startWalk(d, { minutes: start.minutes, via: 'telegram' });
    return 'ask' in r ? r.ask : r.said;
  }
  const pending = await d.storage.get<{ at: number; via: string }>(PENDING_KEY);
  if (pending && nowOf(d) - pending.at < 10 * MIN) {
    const m = minutesIn(text);
    if (m) {
      const r = await startWalk(d, { minutes: m, via: 'telegram' });
      return 'ask' in r ? r.ask : r.said;
    }
  }
  return null;
}

/** I'M HOME pressed under "Home?" on Telegram. */
export async function walkButton(d: GuardDeps, id: string): Promise<string> {
  const w = await loadWalk(d.storage);
  if (!w || w.id !== id || w.stage === 'done') return 'That walk is already over.';
  return endWalk(d, 'home');
}

export async function walkRoute(req: Request, path: string, method: string, d: GuardDeps): Promise<Response> {
  const body = method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};
  try {
    if (path === '/guardian/person' && method === 'POST') {
      await setPerson(d.storage, body, nowOf(d));
      return json(await guardianInfo(d));
    }
    if (path === '/guardian/person' && method === 'DELETE') {
      const { person: _p, ...rest } = await loadConfig(d.storage);
      await saveConfig(d.storage, rest);
      return json(await guardianInfo(d));
    }
    if (path === '/guardian/test' && method === 'POST') {
      const c = await loadConfig(d.storage);
      if (!c.person) return json({ error: 'name your person first' }, 400);
      try {
        const via = await messagePerson(d, 'A test from Ghosty', testNote({ owner: await ownerName(d.storage, c), person: c.person.name }));
        return json({ sent: true, via });
      } catch (e) {
        return json({ sent: false, error: String((e as Error)?.message ?? e).slice(0, 200) });
      }
    }
    if (path === '/guardian/panic-phrase' && method === 'POST') {
      const s = { salt: String(body.salt ?? ''), hash: String(body.hash ?? ''), n: Number(body.n) };
      if (!/^[0-9a-f]{32}$/.test(s.salt) || !/^[0-9a-f]{64}$/.test(s.hash) || !(s.n >= 2 && s.n <= 8)) return json({ error: 'that phrase was not made on your phone' }, 400);
      const c = await loadConfig(d.storage);
      await saveConfig(d.storage, { ...c, panic: s });
      return json(await guardianInfo(d));
    }
    if (path === '/guardian/panic-phrase' && method === 'DELETE') {
      const { panic: _p, ...rest } = await loadConfig(d.storage);
      await saveConfig(d.storage, rest);
      return json(await guardianInfo(d));
    }
    if (path === '/guardian/panic' && method === 'POST') return json(await panicNow(d, { pos: body.pos, via: 'app' }));
    if (path === '/guardian/walk' && method === 'POST') {
      const minutes = typeof body.minutes === 'number' ? body.minutes : null;
      const r = await startWalk(d, { minutes, from: okPos(body.from) ? body.from : null, via: 'app' });
      return json('ask' in r ? r : { said: r.said, walk: (await guardianInfo(d)).walk });
    }
    if (path === '/guardian/walk/end' && method === 'POST') {
      const how = body.how === 'cancelled' ? 'cancelled' : 'home';
      return json({ said: await endWalk(d, how), walk: (await guardianInfo(d)).walk });
    }
    if (path === '/guardian/walk/pos' && method === 'POST') return json({ kept: await walkPos(d, body) });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e).slice(0, 300) }, 400);
  }
  return json({ error: 'not found' }, 404);
}
