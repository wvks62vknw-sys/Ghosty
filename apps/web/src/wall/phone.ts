/**
 * THE WALL, from the phone (BRIEF-MACHINE-WALL; apps/edge/src/wall.ts is the brain's half, wall/screen.ts the wall's own): the phone is the
 * remote. It pairs with the wall's code, sends what the Stage would draw (a kind and its data, never a picture of the screen, never the
 * camera, never a face) and rests or unpairs the wall. Everything that may go passes packages/shared/src/wall.ts's one gate first; the
 * brain applies it again.
 *
 * What this phone knows of the pairing is kept on it (`wallPhone`), so a phone that never paired makes no request at all, and the Stage's
 * WALL key is there the moment a wall is paired. His words (wallTurn, called first in session.ts send()): "pair the wall, KPQTRM",
 * "show that on the wall" / "on the wall", "clear the wall" / "wall off"; and "<ask>, on the wall" sends the answer's picture to the
 * wall instead of the Stage (wallSplit / takeWallTurn, read by show/stage.ts present()).
 */
import { brain } from '../api/brain';
import { createStore } from '../core/store';
import { toast } from '../ui/components';
import { WALL_SAYS, footSentence, onWallAlone, onWallSuffix, pairSaid, wallCheck, wallOffSaid, type WallInfo, type WallKind } from '../../../../packages/shared/src/wall';
import type { Show } from '../show/decide';

/** What this phone knows of its wall (kept on it). `lost`: the brain could not be reached the last time it was asked. */
export const wallPhone = createStore({ paired: false, pair: '', since: 0, showing: null as null | { kind: WallKind; sentence: string; at: number }, retryAt: 0, lost: false, at: 0 }, { persist: 'ghosty.wall.phone' });

/** For the checks (window.__ghosty.wallphone). */
export const wallPhoneState = { sent: 0, refused: 0, last: '', said: '' };

const known = (i: WallInfo) => wallPhone.set({ paired: i.paired, pair: i.pair ?? '', since: i.since ?? 0, showing: i.showing ?? null, retryAt: i.retryAt ?? 0, lost: false, at: Date.now() });

/** Ask the brain how the wall is now (and keep the answer). Null when the brain cannot be reached (the last known state stays). */
export async function refreshWall(): Promise<WallInfo | null> {
  try {
    const i = await brain.wallInfo();
    known(i);
    return i;
  } catch {
    wallPhone.set({ lost: true });
    return null;
  }
}

/** Type the wall's code. Says what happened in his words; `ok` when paired. */
export async function pairWall(code: string): Promise<{ ok: boolean; said: string; retryAt?: number }> {
  try {
    known(await brain.wallPair(code));
    return { ok: true, said: WALL_SAYS.paired };
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status === 429) {
      const retryAt = Date.now() + 60_000;
      wallPhone.set({ retryAt });
      return { ok: false, said: WALL_SAYS.wait, retryAt };
    }
    if (err.status === 400) return { ok: false, said: WALL_SAYS.wrong };
    wallPhone.set({ lost: true });
    return { ok: false, said: WALL_SAYS.offline };
  }
}

export interface WallSend {
  kind: WallKind;
  data: Record<string, unknown>;
  sentence: string;
}
export type WallResult = { ok: true; said: string } | { ok: false; why: 'stays' | 'none' | 'offline'; said: string };

/** Send a picture to the wall: through the gate first (a refusal never leaves the phone), then the brain. */
export async function sendToWall(p: WallSend | null): Promise<WallResult> {
  if (!p) {
    wallPhoneState.refused++;
    return { ok: false, why: 'stays', said: WALL_SAYS.stays };
  }
  const v = wallCheck(p.kind, p.data);
  if (!v.ok) {
    wallPhoneState.refused++;
    wallPhoneState.said = WALL_SAYS.stays;
    return { ok: false, why: 'stays', said: WALL_SAYS.stays };
  }
  if (!wallPhone.get().paired) return { ok: false, why: 'none', said: WALL_SAYS.noPair };
  try {
    known(await brain.wallShow({ kind: v.kind, data: v.data, sentence: p.sentence, pair: wallPhone.get().pair || undefined }));
    wallPhoneState.sent++;
    wallPhoneState.last = v.kind;
    wallPhoneState.said = WALL_SAYS.sent;
    return { ok: true, said: WALL_SAYS.sent };
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err.status === 422) return { ok: false, why: 'stays', said: WALL_SAYS.stays };
    if (err.status === 404 || err.status === 409) {
      // the wall left (or another took its place): this phone no longer has one
      wallPhone.set({ paired: false, pair: '', showing: null });
      return { ok: false, why: 'none', said: WALL_SAYS.noPair };
    }
    wallPhone.set({ lost: true });
    return { ok: false, why: 'offline', said: WALL_SAYS.none };
  }
}

export async function restWall(): Promise<boolean> {
  try {
    known(await brain.wallClear());
    return true;
  } catch {
    wallPhone.set({ lost: true });
    return false;
  }
}
export async function leaveWall(): Promise<boolean> {
  try {
    known(await brain.wallLeave());
    return true;
  } catch {
    wallPhone.set({ lost: true });
    return false;
  }
}

// ---------------------------------------------------------------- what the Stage drew, as the wall's data

const PLAN = /\b(?:plan|itinerary|timetable|schedule|checklist|agenda|menu|routine)\b/i;

/** A decided show as what the wall draws, or null (a kind that stays on the phone: a journey, a formula run). */
export function wallOf(show: Show, reply: string, ask = ''): WallSend | null {
  const sentence = footSentence(reply, show.title);
  switch (show.kind) {
    case 'chart':
      return { kind: 'chart', data: { series: show.series, title: show.title }, sentence };
    case 'map':
      if ('via' in show && show.via && !(Number.isFinite(show.lat) && show.lat !== 0 && show.label)) return null;
      return { kind: 'map', data: { lat: show.lat, lon: show.lon, label: show.label, zoom: show.zoom }, sentence };
    case 'eye':
      // a city asked about by name goes as its map: the wall draws maps, large
      return { kind: 'map', data: { lat: show.lat, lon: show.lon, label: show.label, zoom: 10 }, sentence };
    case 'document':
      return { kind: PLAN.test(ask || show.ask) ? 'plan' : 'document', data: { title: show.title, paragraphs: show.paragraphs }, sentence };
    case 'room':
      return show.room ? { kind: 'room', data: { room: { w: show.room.w, d: show.room.d, things: show.room.things.map((t) => ({ kind: t.kind, n: t.n })), sized: show.room.sized, unit: show.room.unit }, title: show.title }, sentence } : null;
    case 'part':
      return show.part ? { kind: 'part', data: { part: { kind: show.part.kind, name: show.part.name, dims: show.part.dims, unit: show.part.unit }, title: show.title }, sentence } : null;
    default:
      return null;
  }
}

/** The last picture the Stage decided on (a kind that cannot go is kept as `null`: "on the wall" after it says it stays). */
let last: { send: WallSend | null; at: number } | null = null;
export function noteShown(show: Show | null, reply: string, ask: string): void {
  last = show ? { send: wallOf(show, reply, ask), at: Date.now() } : null;
}

// ---------------------------------------------------------------- the Lens's named thing

/** The Lens's named thing for "show that on the wall": its name only, never the frame. A face, or someone, in the frame: it stays. */
async function lensThing(): Promise<{ send: WallSend | null } | null> {
  const { ui } = await import('../state/app');
  if (ui.get().tab !== 'lens') return null;
  const { oneState } = await import('../features/lens/one');
  const tags = oneState.tags ?? [];
  if (tags.some((t) => t.kind === 'face' || t.kind === 'stranger')) return { send: null };
  const named = tags.find((t) => t.kind === 'object' && /^looks like\s+\S/i.test(t.truth));
  if (!named) return { send: null };
  const name = named.truth.replace(/^looks like\s+/i, '').trim();
  return { send: { kind: 'thing', data: { name }, sentence: `It looks like ${name}.` } };
}

// ---------------------------------------------------------------- his words

/** One turn, said and answered on the phone, never to the brain's model. */
async function say(ask: string, reply: string): Promise<void> {
  const { chat } = await import('../assistant/session');
  const at = Date.now();
  chat.set((s) => ({ entries: [...s.entries, { kind: 'user' as const, text: ask, at }, { kind: 'assistant' as const, text: reply, at: at + 1, model: 'Direct · no AI' }].slice(-120), live: reply }));
}

/** "<ask>, on the wall": the ask with the tail taken off, and this turn's picture goes to the wall, not the Stage. */
let toWall = false;
export function wallSplit(text: string): string {
  const ask = onWallSuffix(text);
  toWall = ask !== null;
  return ask ?? text;
}
/** show/stage.ts present(): was this turn asked "on the wall"? (read once) */
export function takeWallTurn(): boolean {
  const t = toWall;
  toWall = false;
  return t;
}

/** Called first by session.ts send(): his words about the wall are answered here. false: not about the wall. */
export async function wallTurn(text: string): Promise<boolean> {
  const code = pairSaid(text);
  if (code) {
    const r = await pairWall(code);
    await say(text, r.said);
    return true;
  }
  if (wallOffSaid(text)) {
    if (!wallPhone.get().paired) return void (await say(text, WALL_SAYS.noPair)), true;
    await say(text, (await restWall()) ? WALL_SAYS.cleared : WALL_SAYS.none);
    return true;
  }
  if (onWallAlone(text)) {
    if (!wallPhone.get().paired) return void (await say(text, WALL_SAYS.noPair)), true;
    const lens = await lensThing();
    const pick = lens ?? (last && Date.now() - last.at < 3_600_000 ? { send: last.send } : null);
    if (!pick) return void (await say(text, WALL_SAYS.nothing)), true;
    const r = await sendToWall(pick.send);
    await say(text, r.said);
    return true;
  }
  return false;
}

/** The Stage's WALL key, pressed: the picture it shows goes. Words for the key and a line for the toast. */
export async function stageToWall(show: Show, reply: string, ask: string): Promise<WallResult> {
  const r = await sendToWall(wallOf(show, reply, ask));
  if (!r.ok && r.why === 'stays') toast(r.said, 'bad');
  return r;
}

// for the checks and the console (main.ts makes __ghosty after the first tab opens, so this retries)
if (typeof window !== 'undefined') {
  const w = window as unknown as { __ghosty?: Record<string, unknown> };
  const attach = () => !!w.__ghosty && ((w.__ghosty.wallphone = { state: wallPhoneState, store: wallPhone, refresh: refreshWall }), true);
  if (!attach()) {
    let n = 0;
    const timer = window.setInterval(() => (attach() || ++n > 60) && clearInterval(timer), 500);
  }
}
