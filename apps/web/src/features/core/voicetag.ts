/**
 * WHOSE VOICE, ON THE TALK BAR (BRIEF-VOICE-KNOWN 3): the tag the phone gives a spoken turn, in the Machine's marks (ui/machine.ts
 * `tag`): YOU, a person he introduced by name, or A VOICE I DON'T KNOW; nothing when no voice is enrolled. With one I don't
 * know the turn is held and the bar asks "A voice I don't know. Go on?" with GO ON and NOT NOW; "It's fine for an hour" stops
 * the asking for an hour (and ASK AGAIN ends that). All of it is a courtesy: nothing here opens or locks anything
 * (assistant/voiceknown.ts). Every key is 44 pt and named for VoiceOver.
 */
import { h } from '../../core/dom';
import { goOnNow, giveGrace, endGrace, grace, graceEnds, graceOn, notNow, speaker, TAG_MS } from '../../assistant/voiceknown';
import { key, tag, truthLine } from '../../ui/machine';

const clock = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function voiceTag(): HTMLElement {
  const el = h('div#voicetag', { hidden: true, role: 'status', 'aria-live': 'polite', dataset: { case: 'keep' } });
  let fade = 0;
  const paint = () => {
    clearTimeout(fade);
    const { heard, held, at } = speaker.get();
    if (!heard) {
      el.hidden = true;
      el.replaceChildren();
      delete el.dataset.who;
      return;
    }
    const unknown = heard.label === 'unknown';
    el.hidden = false;
    el.dataset.who = unknown ? 'unknown' : heard.label === 'owner' ? 'owner' : 'person';
    const kids: (Node | null)[] = [tag(heard.words, { tone: unknown ? 'warn' : 'on' })];
    if (held) {
      kids.push(
        h('p.vt-ask', { dataset: { case: 'keep' } }, 'A voice I don’t know. Go on?'),
        h('div.vt-keys', key('GO ON', () => goOnNow(), { kind: 'fill', label: 'Go on: answer what that voice said' }), key('NOT NOW', () => notNow(), { kind: 'line', label: 'Not now: drop what that voice said' })),
      );
    }
    if (unknown) {
      if (graceOn()) kids.push(truthLine([{ text: 'Not asking', tone: 'strong' }, `until ${clock(graceEnds())}`]), h('div.vt-keys', key('ASK AGAIN', () => endGrace(), { kind: 'ghost', label: 'Ask again: stop the hour of not asking' })));
      else kids.push(h('div.vt-keys', key('IT’S FINE FOR AN HOUR', () => giveGrace(), { kind: 'ghost', label: 'It’s fine for an hour: stop asking about voices I don’t know for an hour' })));
    } else if (heard.label === 'owner') kids.push(truthLine('It never unlocks anything'));
    el.replaceChildren(...kids.filter((k): k is Node => !!k));
    // the tag fades some time after the turn (a held turn's stays until it is answered)
    if (!held) fade = window.setTimeout(() => speaker.get().held || speaker.set({ heard: null, held: null, at: 0 }), Math.max(1000, TAG_MS - (Date.now() - at)));
  };
  speaker.subscribe(paint);
  grace.subscribe(paint);
  paint();
  return el;
}
