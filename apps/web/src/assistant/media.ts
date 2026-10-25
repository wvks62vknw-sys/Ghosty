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
    audio.addEventListener('pause', () => {
      if (!live() || !audio?.paused) return;
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
  player.set({ now: null, state: 'idle', since: 0, why: '' });
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
export function duck(on: boolean): void {
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

const FAV = 'ghosty.radio.favs';
function saveFavs(l: NowPlaying[]): void {
  try {
    localStorage.setItem(FAV, JSON.stringify(l.slice(0, 40)));
  } catch {
    /* ignore */
  }
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
  /** Put a station back where it was (UNDO of a removal). */
  put(s: NowPlaying, at: number): void {
    const l = favourites.list().filter((x) => x.url !== s.url);
    l.splice(Math.max(0, Math.min(at, l.length)), 0, { name: s.name, url: s.url, info: s.info });
    saveFavs(l);
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
  let shown = '';
  player.subscribe((p) => {
    const key = p.now ? `${p.now.url}|${p.now.name}` : '';
    if (key !== shown) {
      shown = key;
      try {
        session.metadata = p.now ? new MediaMetadata({ title: p.now.name, artist: p.now.info || 'Live radio', album: 'Ghosty radio', artwork: [{ src: '/icon-512.png', sizes: '512x512', type: 'image/png' }] }) : null;
      } catch {
        /* no MediaMetadata here */
      }
    }
    session.playbackState = p.state === 'playing' || p.state === 'loading' ? 'playing' : p.now ? 'paused' : 'none';
  });
}
