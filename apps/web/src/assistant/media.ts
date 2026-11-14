/**
 * The one audio player (internet radio). Ghosty starts it with play_radio; the top bar
 * shows what is playing with a stop button; the Radio tab browses stations.
 * Speech ducks the volume while Ghosty talks. The lock screen, Control Centre and AirPods
 * see the station and work it (Media Session); a pause there shows as Paused here.
 */
import { createStore } from '../core/store';
import { ui } from '../state/app';

export interface NowPlaying {
  name: string;
  url: string;
  info?: string;
  /** [voice lane] his own name for a favourite ("morning"): "put on my morning station" (voice.c1). */
  label?: string;
}

/** Why the station is not playing, in a word: `words` says it to him. */
export type Why = '' | 'silent' | 'tap' | 'offline' | 'ended' | 'refused';

export const player = createStore({
  now: null as NowPlaying | null,
  state: 'idle' as 'idle' | 'loading' | 'playing' | 'paused' | 'error',
  volume: 0.8,
  /** when this station started playing (ms), 0 before it has */
  since: 0,
  why: '' as Why,
  /** when the sleep timer ends the radio (ms), 0 when none is set */
  sleepAt: 0,
  /** which choice set it: its minutes ("30"), "hour" for the end of this hour, "at" for a time he said; '' when none */
  sleepKind: '',
});

/** A station that has not started after this long is said to be not answering. */
export const TUNE_LIMIT_MS = 15_000;

let audio: HTMLAudioElement | null = null;
/** the play this element is on: an answer about an earlier one (the station he switched away from) is ignored */
let turn = 0;
let tuneTimer = 0;

function armTuneLimit(): void {
  clearTimeout(tuneTimer);
  const t = turn;
  tuneTimer = window.setTimeout(() => {
    if (t !== turn || player.get().state !== 'loading') return;
    fail('silent');
  }, TUNE_LIMIT_MS);
}

function fail(why: Why): void {
  // this play is over: its play() refused by the load below, or a late event, says nothing more
  turn++;
  clearTimeout(tuneTimer);
  player.set({ state: 'error', why });
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}

/** The station is meant to be sounding (connecting or playing): only then does an event from the element count. */
const live = () => !!player.get().now && (player.get().state === 'playing' || player.get().state === 'loading');

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('playing', () => {
      if (!player.get().now) return;
      clearTimeout(tuneTimer);
      player.set((p) => ({ state: 'playing', why: '', since: p.since || Date.now() }));
    });
    audio.addEventListener('waiting', () => {
      if (player.get().state !== 'playing') return;
      player.set({ state: 'loading' });
      armTuneLimit();
    });
    // paused from outside Ghosty: the lock screen, Control Centre, AirPods taken out (a pause Ghosty made has
    // already said so, and one left over from the station before has the element playing again by now)
    // (a stream that ran out pauses too, just before 'ended': that one is said as "stopped sending", never as Paused)
    audio.addEventListener('pause', () => {
      if (!live() || !audio?.paused || audio.ended) return;
      clearTimeout(tuneTimer);
      player.set({ state: 'paused' });
    });
    audio.addEventListener('ended', () => live() && fail('ended'));
    audio.addEventListener('error', () => live() && audio?.getAttribute('src') && fail('refused'));
    audio.volume = player.get().volume;
  }
  return audio;
}

export async function playStation(s: NowPlaying): Promise<boolean> {
  const t = ++turn;
  clearTimeout(tuneTimer);
  if (player.get().now?.url !== s.url) player.set({ since: 0 });
  rememberLast(s);
  rememberRecent(s);
  // he played again: the timer the reload left is no longer offered (PLAY AND KEEP THE TIMER keeps it until the station is tuning in)
  if (lostSleep && !carrying) dropKept();
  if (!/^https:\/\//i.test(s.url)) {
    player.set({ now: s, state: 'error', why: 'refused' });
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    player.set({ now: s, state: 'error', why: 'offline' });
    return false;
  }
  const a = el();
  a.src = s.url;
  player.set({ now: s, state: 'loading', why: '' });
  armTuneLimit();
  try {
    await a.play();
    return true;
  } catch (e) {
    // a station he switched away from (or stopped) before it started: not a failure of anything playing now
    if (t !== turn || player.get().now?.url !== s.url || player.get().state !== 'loading') return false;
    // Browsers (the iPhone above all) start sound only from a tap.
    fail((e as Error)?.name === 'NotAllowedError' ? 'tap' : 'refused');
    return false;
  }
}

/** Pause (a live stream: PLAY again goes back to what is on now). */
export function pauseAudio(): void {
  if (!audio || !player.get().now) return;
  turn++;
  clearTimeout(tuneTimer);
  player.set({ state: 'paused' });
  audio.pause();
}

/** Play the station that is paused or failed again, from what is on air now. */
export function resumeAudio(): Promise<boolean> {
  const now = player.get().now;
  return now ? playStation(now) : Promise.resolve(false);
}

export function stopAudio(): void {
  turn++;
  clearTimeout(tuneTimer);
  clearSleep();
  player.set({ now: null, state: 'idle', since: 0, why: '', sleepAt: 0, sleepKind: '' });
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
}

export function setVolume(v: number): void {
  const x = Math.max(0, Math.min(1, v));
  player.set({ volume: x });
  if (audio) audio.volume = x;
}

let volumeWorks: boolean | null = null;
/** False on an iPhone: Safari ignores a page's volume (it is always the phone's own), so a slider would do nothing. */
export function canSetVolume(): boolean {
  if (volumeWorks === null) {
    try {
      const a = new Audio();
      a.volume = 0.5;
      volumeWorks = Math.abs(a.volume - 0.5) < 0.01;
    } catch {
      volumeWorks = false;
    }
  }
  return volumeWorks;
}

/** Lower the radio while Ghosty speaks. */
/** Ghosty is speaking or listening: the radio is held low (the sleep timer's own volume work keeps to this). */
let ducked = false;
export function duck(on: boolean): void {
  ducked = on;
  if (audio && player.get().now) audio.volume = on ? Math.min(0.15, player.get().volume) : player.get().volume;
}

/** The last station played, kept on this phone so the Radio tab can offer it again. */
const LAST = 'ghosty.radio.last';
function rememberLast(s: NowPlaying): void {
  try {
    localStorage.setItem(LAST, JSON.stringify({ name: s.name, url: s.url, info: s.info }));
  } catch {
    /* ignore */
  }
}
export function lastPlayed(): NowPlaying | null {
  try {
    const s = JSON.parse(localStorage.getItem(LAST) ?? 'null') as NowPlaying | null;
    return s && typeof s.url === 'string' && typeof s.name === 'string' ? s : null;
  } catch {
    return null;
  }
}

/** The stations he played lately, newest first (eight, kept on this phone): RECENT on the Radio tab. */
const RECENT = 'ghosty.radio.recent';
function rememberRecent(s: NowPlaying): void {
  try {
    const l = recentStations().filter((x) => x.url !== s.url);
    l.unshift({ name: s.name, url: s.url, info: s.info });
    localStorage.setItem(RECENT, JSON.stringify(l.slice(0, 8)));
  } catch {
    /* ignore */
  }
}
export function recentStations(): NowPlaying[] {
  try {
    const l = JSON.parse(localStorage.getItem(RECENT) ?? '[]') as NowPlaying[];
    return Array.isArray(l) ? l.filter((s) => s && typeof s.url === 'string' && typeof s.name === 'string') : [];
  } catch {
    return [];
  }
}
export function forgetRecent(): void {
  try {
    localStorage.removeItem(RECENT);
  } catch {
    /* ignore */
  }
}

// THE SLEEP TIMER: the radio goes quiet over its last 20 seconds, then stops. A reload stops the radio (the browser ends the sound,
// and a page may not start it again without a tap), so the stop time is kept on the phone: after a reload the Radio offers it back
// (PLAY AND KEEP THE TIMER, one tap) until he plays something else or that time has passed.
const FADE_MS = 20_000;
const SLEEP_KEPT = 'ghosty.radio.sleep';
let sleepTimer = 0;
let fadeTimer = 0;
function clearSleep(): void {
  clearTimeout(sleepTimer);
  clearInterval(fadeTimer);
  sleepTimer = fadeTimer = 0;
  if (audio) audio.volume = ducked ? Math.min(0.15, player.get().volume) : player.get().volume;
  dropKept();
}
/** Stop the radio in `min` minutes (0 takes the timer off). */
export function setSleep(min: number): void {
  setSleepAt(min ? Date.now() + min * 60_000 : 0, String(min));
}
/** Stop the radio at `at` (ms; 0 takes the timer off). `kind` says which choice set it, so the screen lights that key. False when nothing is on to stop. */
export function setSleepAt(at: number, kind = 'at'): boolean {
  clearSleep();
  if (!at || at <= Date.now() || !player.get().now) {
    player.set({ sleepAt: 0, sleepKind: '' });
    return false;
  }
  player.set({ sleepAt: at, sleepKind: kind });
  try {
    localStorage.setItem(SLEEP_KEPT, JSON.stringify({ at, kind, name: player.get().now?.name ?? '' }));
  } catch {
    /* ignore */
  }
  sleepTimer = window.setTimeout(() => {
    const v0 = audio?.volume ?? 0;
    const t0 = Date.now();
    fadeTimer = window.setInterval(() => {
      const k = Math.max(0, 1 - (Date.now() - t0) / FADE_MS);
      if (audio) audio.volume = v0 * k;
      if (k <= 0) stopAudio();
    }, 250);
  }, Math.max(0, at - Date.now() - FADE_MS));
  return true;
}

/** A sleep timer that was still to run when the page last closed or reloaded (the reload stopped the radio; its stop time is kept). */
let lostSleep: { at: number; name: string; kind: string } | null = null;
try {
  const k = JSON.parse(localStorage.getItem(SLEEP_KEPT) ?? 'null') as { at?: unknown; name?: unknown; kind?: unknown } | null;
  if (k && typeof k.at === 'number' && k.at > Date.now()) lostSleep = { at: k.at, name: typeof k.name === 'string' ? k.name : '', kind: typeof k.kind === 'string' && k.kind ? k.kind : 'at' };
  else localStorage.removeItem(SLEEP_KEPT);
} catch {
  /* ignore */
}
/** The kept timer is one thing, on the phone and in this page together: dropped from both at once (STOP, TIMER OFF, another station). */
export function dropKept(): void {
  lostSleep = null;
  try {
    localStorage.removeItem(SLEEP_KEPT);
  } catch {
    /* ignore */
  }
}
/** The sleep timer the last reload stopped, while it would still be running: null while a station is on (or tuning in), and dropped
 * once its time has passed. A station that could not start (offline, refused) leaves it kept, so the offer stays. */
export function sleepLost(): { at: number; name: string; kind: string } | null {
  if (lostSleep && lostSleep.at <= Date.now()) dropKept();
  const p = player.get();
  return p.now && p.state !== 'error' ? null : lostSleep;
}
let carrying = false;
/** PLAY AND KEEP THE TIMER: play `s` (the station shown) again with the stop time the reload left. False, playing nothing, when there
 * is none to keep (its time has passed); when the station cannot start (offline, refused) the timer stays kept and unset. */
export function carryOn(s: NowPlaying): Promise<boolean> {
  const k = sleepLost();
  if (!k) return Promise.resolve(false);
  carrying = true;
  let p: Promise<boolean>;
  try {
    p = playStation(s);
  } finally {
    carrying = false;
  }
  // playStation has put the station on, or said why it cannot play, before its first await: the timer goes back on only while it tunes in
  if (player.get().now && player.get().state === 'loading') setSleepAt(k.at, k.kind);
  return p;
}

/** The stations he played lately as they stood when he began to step through them: playing one moves it to the front of RECENT,
 * so stepping through the live list would swap the newest two for ever. Kept while the station on air is one of them. */
let stepRecents: NowPlaying[] = [];
/** The station after (or before) the one on, in his favourites, else the ones he played lately: the lock screen's ⏭ and ⏮.
 * Through the ones he played lately (newest first), ⏮ "previous" is the one he played before this one, ⏭ "next" the other way round. */
export function stepStation(dir: 1 | -1): NowPlaying | null {
  const url = player.get().now?.url;
  if (favourites.list().length > 1) {
    const l = favourites.list();
    const at = l.findIndex((s) => s.url === url);
    return l[(at < 0 ? (dir > 0 ? 0 : l.length - 1) : at + dir + l.length) % l.length] ?? null;
  }
  if (!url || !stepRecents.some((s) => s.url === url)) stepRecents = recentStations();
  const l = stepRecents;
  if (!l.length) return null;
  const at = l.findIndex((s) => s.url === url);
  return l[at < 0 ? 0 : (at - dir + l.length) % l.length] ?? null;
}

const FAV = 'ghosty.radio.favs';
/** Who to tell when his favourites change (the Radio's lists and stars), whether the change came from a tap or from the chat. */
const favWatchers = new Set<() => void>();
export function onFavourites(fn: () => void): () => void {
  favWatchers.add(fn);
  return () => favWatchers.delete(fn);
}
function saveFavs(l: NowPlaying[]): void {
  try {
    localStorage.setItem(FAV, JSON.stringify(l.slice(0, 40)));
  } catch {
    /* ignore */
  }
  for (const fn of favWatchers) fn();
}
export const favourites = {
  list(): NowPlaying[] {
    try {
      return JSON.parse(localStorage.getItem(FAV) ?? '[]') as NowPlaying[];
    } catch {
      return [];
    }
  },
  toggle(s: NowPlaying): boolean {
    const l = favourites.list();
    const i = l.findIndex((x) => x.url === s.url);
    if (i >= 0) l.splice(i, 1);
    else l.unshift({ name: s.name, url: s.url, info: s.info });
    saveFavs(l);
    return i < 0;
  },
  /**
   * [voice lane] RADIO FAVOURITES BY HIS OWN NAME (voice.c1, built into PLAN AND HOME's radio, small and additive): "call this my morning
   * station" names the station (kept as a favourite, added if it was not one); "put on my morning station" finds it by that name.
   */
  name(s: NowPlaying, label: string): void {
    const l = favourites.list().map((x) => (x.label === label && x.url !== s.url ? { ...x, label: undefined } : x));
    const i = l.findIndex((x) => x.url === s.url);
    if (i >= 0) l[i] = { ...l[i]!, label };
    else l.unshift({ name: s.name, url: s.url, info: s.info, label });
    saveFavs(l);
  },
  byName(label: string): NowPlaying | null {
    return favourites.list().find((x) => x.label === label) ?? null;
  },
  /** Put a station back where it was (UNDO of a removal). */
  put(s: NowPlaying, at: number): void {
    const l = favourites.list().filter((x) => x.url !== s.url);
    l.splice(Math.max(0, Math.min(at, l.length)), 0, { name: s.name, url: s.url, info: s.info });
    saveFavs(l);
  },
  /** Move a favourite one place up (-1) or down (1): his own order, which ⏭ and ⏮ and "play my second favourite" follow. */
  move(url: string, dir: -1 | 1): boolean {
    const l = favourites.list();
    const i = l.findIndex((x) => x.url === url);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= l.length) return false;
    [l[i], l[j]] = [l[j]!, l[i]!];
    saveFavs(l);
    return true;
  },
  indexOf: (url: string) => favourites.list().findIndex((x) => x.url === url),
  has: (url: string) => favourites.list().some((x) => x.url === url),
};

// Duck while Ghosty talks or listens.
ui.subscribe((s, p) => {
  if (s.voice !== p.voice) duck(s.voice === 'speaking' || s.voice === 'listening');
});

// The lock screen, Control Centre and AirPods: the station's name, and play / pause / stop that reach Ghosty.
const session = typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;
if (session) {
  const on = (action: MediaSessionAction, fn: () => void) => {
    try {
      session.setActionHandler(action, fn);
    } catch {
      /* this action is not offered on this phone */
    }
  };
  on('play', () => void resumeAudio());
  on('pause', () => pauseAudio());
  on('stop', () => stopAudio());
  // ⏭ and ⏮ on the lock screen and AirPods: the next or previous of his favourites (the ones he played lately when he has none)
  const step = (dir: 1 | -1) => {
    const n = stepStation(dir);
    if (n && n.url !== player.get().now?.url) void playStation(n);
  };
  on('nexttrack', () => step(1));
  on('previoustrack', () => step(-1));
  let shown = '';
  player.subscribe((p) => {
    // the sleep timer shows on the lock screen too, on the line under the station's name ("Stops at 23:10 · UK · News")
    const stops = p.sleepAt ? `Stops at ${new Date(p.sleepAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : '';
    const key = p.now ? `${p.now.url}|${p.now.name}|${stops}` : '';
    if (key !== shown) {
      shown = key;
      try {
        session.metadata = p.now ? new MediaMetadata({ title: p.now.name, artist: [stops, p.now.info || 'Live radio'].filter(Boolean).join(' · '), album: 'Ghosty radio', artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }) : null;
      } catch {
        /* no MediaMetadata here */
      }
    }
    session.playbackState = p.state === 'playing' || p.state === 'loading' ? 'playing' : p.now ? 'paused' : 'none';
  });
}
