/**
 * App-wide state.
 *  settings — saved on this device (name, theme, units, voice, sounds, home location)
 *  ui       — what is on screen right now (tab, brain activity, voice state)
 */
import { createStore } from '../core/store';

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export interface Settings {
  name: string;
  theme: string;
  units: 'metric' | 'imperial';
  speak: boolean;
  voice: string;
  /** Whose voice reads replies: Ghosty's own (from the brain) or this phone's speech synthesis. */
  voiceEngine: 'ghosty' | 'phone';
  home: Place | null;
  currency: 'gbp' | 'usd' | 'eur';
  /** Soft interface sounds (tab changes, the systems deck). */
  sounds: boolean;
  /** Tilt the phone to look around the holographic room (asks for motion access). */
  motion: boolean;
}

const tz = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return '';
  }
})();

export const settings = createStore<Settings>(
  {
    name: 'Boss',
    theme: 'stark',
    units: /^en-US/i.test(navigator.language) ? 'imperial' : 'metric',
    speak: true,
    voice: 'auto',
    voiceEngine: 'ghosty',
    home: null,
    sounds: true,
    motion: false,
    currency: /London|Europe\/(Dublin|Belfast)/.test(tz) ? 'gbp' : /Europe\//.test(tz) ? 'eur' : 'usd',
  },
  { persist: 'ghosty.settings' },
);

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const ui = createStore({
  tab: 'core',
  busy: false,
  voice: 'idle' as VoiceState,
  connected: null as boolean | null,
  status: '',
});

const TZ_PLACES: Record<string, Place> = {
  'Europe/London': { name: 'London', lat: 51.507, lon: -0.128 },
  'Europe/Paris': { name: 'Paris', lat: 48.857, lon: 2.352 },
  'Europe/Berlin': { name: 'Berlin', lat: 52.52, lon: 13.405 },
  'America/New_York': { name: 'New York', lat: 40.713, lon: -74.006 },
  'America/Chicago': { name: 'Chicago', lat: 41.878, lon: -87.63 },
  'America/Denver': { name: 'Denver', lat: 39.739, lon: -104.99 },
  'America/Los_Angeles': { name: 'Los Angeles', lat: 34.052, lon: -118.244 },
  'Asia/Dubai': { name: 'Dubai', lat: 25.205, lon: 55.271 },
  'Asia/Kolkata': { name: 'Mumbai', lat: 19.076, lon: 72.878 },
  'Asia/Karachi': { name: 'Karachi', lat: 24.861, lon: 67.01 },
  'Asia/Singapore': { name: 'Singapore', lat: 1.352, lon: 103.82 },
  'Asia/Tokyo': { name: 'Tokyo', lat: 35.676, lon: 139.65 },
  'Australia/Sydney': { name: 'Sydney', lat: -33.869, lon: 151.209 },
};

/** The owner's location: saved home, else a guess from the device time zone. */
export function home(): Place {
  return settings.get().home ?? TZ_PLACES[tz] ?? TZ_PLACES['Europe/London']!;
}

export const timeZone = tz;
