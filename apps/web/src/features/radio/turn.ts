/** THE RADIO FROM THE CHAT (planlane): what was asked, done on the phone, and said back in one line (assistant/local.ts calls this). */
import type { PackReply } from '../../assistant/packs';
import { favourites, lastPlayed, player, playStation, recentStations, setSleepAt, stepStation, type NowPlaying } from '../../assistant/media';
import { radioAsked, type RadioAsk } from './asks';
import { clockWords, endOfHour, inWords, nextClock, ordinal, sleepAtSet, sleepLine } from './words';

const OPEN = [{ id: 'radio', ask: -1, label: 'Open the radio', open: 'radio' }];
/** Something is on (playing, tuning in or paused): there is a station to time, save or say. */
const on = () => {
  const p = player.get();
  return p.now && p.state !== 'error' && p.state !== 'idle' ? p.now : null;
};
const NOTHING = 'Nothing is playing, so there is nothing to stop. Play a station first, then set the timer.';

/** The words of the reply, and what was done (pure of the chat: the spec reads it through radioTurn). */
async function act(ask: RadioAsk): Promise<string> {
  const now = Date.now();
  const p = player.get();
  switch (ask.what) {
    case 'sleep':
    case 'sleepAt':
    case 'sleepHour': {
      if (!on()) return NOTHING;
      const at = ask.what === 'sleep' ? now + ask.min * 60_000 : ask.what === 'sleepHour' ? endOfHour(now) : nextClock(ask.h, ask.m, now, ask.half);
      setSleepAt(at, ask.what === 'sleep' ? String(ask.min) : ask.what === 'sleepHour' ? 'hour' : 'at');
      return sleepAtSet(at, now);
    }
    case 'sleepOff': {
      const stays = p.now ? (p.state === 'paused' ? `${p.now.name} is paused and stays on until you stop it` : `${p.now.name} keeps playing until you stop it`) : '';
      if (!p.sleepAt) return stays ? `There is no sleep timer set: ${stays}.` : 'There is no sleep timer set.';
      setSleepAt(0);
      return stays ? `Sleep timer off: ${stays}.` : 'Sleep timer off.';
    }
    case 'sleepLeft': {
      if (!p.now) return 'Nothing is playing, so there is no sleep timer.';
      if (!p.sleepAt || p.sleepAt <= now) return `There is no sleep timer: ${p.now.name} plays until you stop it. Say “turn the radio off in 30 minutes” to set one.`;
      return `${p.now.name} stops at ${clockWords(p.sleepAt)}, in ${inWords(p.sleepAt - now)}.`;
    }
    case 'step': {
      const n = stepStation(ask.dir);
      if (!n || (n.url === p.now?.url && p.state !== 'error')) return 'There is no other station to go to yet. Keep two or more favourites (tap ☆ next to a station on the Radio) and I can step through them.';
      const from = favourites.list().length > 1 ? 'favourites' : 'stations you played lately';
      void playStation(n);
      return `${ask.dir > 0 ? 'Next' : 'Back'}: ${n.name} (from your ${from}).`;
    }
    case 'favs':
    case 'fav': {
      const l = favourites.list();
      if (!l.length) return 'You have no favourite stations yet. Tap ☆ next to a station on the Radio to keep it.';
      const n = ask.what === 'fav' ? ask.n : 1;
      const s: NowPlaying | undefined = l[n - 1];
      if (!s) return `You have ${l.length === 1 ? 'one favourite' : `${l.length} favourites`}, so there is no ${ordinal(n)} one.`;
      void playStation(s);
      return `Playing ${s.name}, your ${ordinal(n)} favourite${l.length > 1 && ask.what === 'favs' ? `. Say “next station” for ${l[1]!.name}` : ''}.`;
    }
    case 'save':
    case 'unsave': {
      const s = on() ?? (p.now && p.state === 'error' ? p.now : null);
      if (!s) return ask.what === 'save' ? 'Nothing is playing, so there is no station to save. Play one first.' : 'Nothing is playing, so there is no station to take off.';
      const at = favourites.indexOf(s.url);
      if (ask.what === 'save') {
        if (at >= 0) return `${s.name} is already in your favourites (your ${ordinal(at + 1)}).`;
        favourites.toggle(s);
        return `Saved ${s.name} to your favourites. It is first on the list.`;
      }
      if (at < 0) return `${s.name} is not in your favourites.`;
      favourites.toggle(s);
      return `Took ${s.name} off your favourites.`;
    }
    case 'now': {
      if (!p.now || p.state === 'idle') {
        const last = lastPlayed() ?? recentStations()[0];
        return last ? `Nothing is playing. The last station was ${last.name}.` : 'Nothing is playing.';
      }
      const name = p.now.name;
      const info = p.now.info ? ` (${p.now.info})` : '';
      const head = p.state === 'playing' ? `${name} is on air${p.since ? ` since ${clockWords(p.since)}` : ''}${info}.` : p.state === 'loading' ? `Tuning in to ${name}${info}.` : p.state === 'paused' ? `${name} is paused${info}.` : `${name} didn’t play. Try another station.`;
      return p.sleepAt && p.sleepAt > Date.now() ? `${head} ${sleepLine(p.sleepAt, Date.now())}` : head;
    }
  }
}

/** The answer, or null to let the next table (and then the brain) answer. */
export async function radioTurn(text: string): Promise<PackReply | null> {
  const ask = radioAsked(text);
  if (!ask) return null;
  // words that do not name the radio ("what's playing", "add this to my favourites") are the radio's only while a station is on
  if ('loose' in ask && ask.loose && !on()) return null;
  return { said: text, reply: await act(ask), go: OPEN };
}
