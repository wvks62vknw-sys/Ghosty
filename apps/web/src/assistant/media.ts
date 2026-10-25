/**
 * The one audio player (internet radio). Ghosty starts it with play_radio; the top bar
 * shows what is playing with a stop button; the Radio tab browses stations.
 * Speech ducks the volume while Ghosty talks.
 */
import { createStore } from '../core/store';
import { ui } from '../state/app';

export interface NowPlaying {
  name: string;
  url: string;
  info?: string;
}

export const player = createStore({ now: null as NowPlaying | null, state: 'idle' as 'idle' | 'loading' | 'playing' | 'error', volume: 0.8 });

let audio: HTMLAudioElement | null = null;

function el(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'none';
    audio.addEventListener('playing', () => player.set({ state: 'playing' }));
    audio.addEventListener('waiting', () => player.set({ state: 'loading' }));
    audio.addEventListener('error', () => player.set({ state: 'error' }));
    audio.volume = player.get().volume;
  }
  return audio;
}

export async function playStation(s: NowPlaying): Promise<boolean> {
  if (!/^https:\/\//i.test(s.url)) {
    player.set({ now: s, state: 'error' });
    return false;
  }
  const a = el();
  a.src = s.url;
  player.set({ now: s, state: 'loading' });
  try {
    await a.play();
    return true;
  } catch {
    // Browsers block audio until the page has been tapped once.
    player.set({ state: 'error' });
    return false;
  }
}

export function stopAudio(): void {
  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  player.set({ now: null, state: 'idle' });
}

export function setVolume(v: number): void {
  const x = Math.max(0, Math.min(1, v));
  player.set({ volume: x });
  if (audio) audio.volume = x;
}

/** Lower the radio while Ghosty speaks. */
export function duck(on: boolean): void {
  if (audio && player.get().now) audio.volume = on ? Math.min(0.15, player.get().volume) : player.get().volume;
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
