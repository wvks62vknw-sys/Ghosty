/**
 * SETTINGS → VOICE: whose voice reads replies, which voice, a SAMPLE to hear it, and whether
 * talking over Ghosty interrupts it. The default ('auto') is the most natural free British voice
 * there is: Ghosty's own natural voice from the brain (Deepgram Aura on Workers AI) while the
 * day's free share lasts, then a natural British voice installed on this phone (an iPhone's
 * "Serena (Premium)" or "Daniel (Enhanced)"), else the plain one. The brain's voices are listed
 * in packages/shared/src/voices.ts; speaking is assistant/voice.ts.
 */
import { BRAIN_VOICES } from '../../../../../packages/shared/src/voices';
import { speechCaps } from '../../api/brain';
import { listVoices, naturalPhoneVoice, speakSample, stopSpeaking, voiceNow } from '../../assistant/voice';
import { clear, h } from '../../core/dom';
import { settings, ui } from '../../state/app';
import { button } from '../../ui/components';

const IOS_TIP = 'Tip: an iPhone has free natural British voices — Settings › Accessibility › Spoken Content › Voices › English › Voice (UK): download Serena (Premium) or Daniel (Enhanced). Then pick it here.';

export function voiceControls(): { nodes: HTMLElement[]; refresh(): void } {
  const engine = h('select', { 'aria-label': 'Voice engine' }, h('option', { value: 'auto' }, 'Best British voice available (automatic)'), h('option', { value: 'ghosty' }, "Ghosty's own voice (from the brain)"), h('option', { value: 'phone' }, "This phone's voice"));
  const voice = h('select', { 'aria-label': 'Voice' });
  const note = h('div.note.vnow');
  const now = h('div.note.vlast');
  const sample = button('SAMPLE', async (b) => {
    if (ui.get().voice === 'speaking') {
      stopSpeaking();
      return;
    }
    b.textContent = 'STOP';
    now.textContent = '';
    await speakSample({ engine: engine.value as 'auto' | 'ghosty' | 'phone', brainVoice: engine.value === 'ghosty' ? voice.value : 'auto', phoneVoice: engine.value === 'phone' ? voice.value : settings.get().voice });
    b.textContent = 'SAMPLE';
    if (voiceNow.name) now.textContent = `Just spoke: ${voiceNow.name}${voiceNow.engine === 'phone' ? ' (on this phone)' : " (Ghosty's own)"}${voiceNow.note ? ` — ${voiceNow.note.replace(/ \([^)]*\)/g, '')}` : ''}`;
  }, 'on');
  sample.setAttribute('aria-label', 'Hear a sample of this voice');
  const barge = h('select', { 'aria-label': 'Interrupt by talking' }, h('option', { value: 'on' }, 'Talk over Ghosty to interrupt: on'), h('option', { value: 'off' }, 'Talk over Ghosty to interrupt: off (tap to interrupt)'));

  const fill = () => {
    const s = settings.get();
    engine.value = s.voiceEngine;
    voice.hidden = s.voiceEngine === 'auto';
    if (s.voiceEngine === 'ghosty') {
      clear(voice, h('option', { value: 'auto' }, 'Most natural (Draco, British)'), ...BRAIN_VOICES.map((v) => h('option', { value: v.id }, v.label)));
      voice.value = BRAIN_VOICES.some((v) => v.id === s.brainVoice) ? s.brainVoice : 'auto';
    } else if (s.voiceEngine === 'phone') {
      const list = listVoices();
      const natural = naturalPhoneVoice();
      clear(voice, h('option', { value: 'auto' }, natural ? `Best on this phone (${natural.name})` : 'Best on this phone'), ...list.map((v) => h('option', { value: v.name }, `${v.name} (${v.lang})${/Premium|Enhanced|Natural|Neural/i.test(v.name) ? ' — natural' : ''}`)));
      voice.value = list.some((v) => v.name === s.voice) ? s.voice : 'auto';
    }
    const natural = naturalPhoneVoice();
    const brainSpeaks = speechCaps.get().tts;
    note.textContent =
      s.voiceEngine === 'auto'
        ? brainSpeaks
          ? `Ghosty's natural British voice (Draco) while today's free share lasts, then ${natural ? `${natural.name} on this phone` : 'the plain voice'}.${natural ? '' : ` ${IOS_TIP}`}`
          : `Your brain has no voice of its own here, so this phone speaks${natural ? `: ${natural.name}` : ''}.${natural ? '' : ` ${IOS_TIP}`}`
        : s.voiceEngine === 'ghosty'
          ? `The same voice everywhere, made by your brain. The natural voices have a free share each day (Helios and Athena last twice as long); after it, the plain voice.${brainSpeaks ? '' : " Your brain can't speak right now, so this phone's voice fills in."}`
          : natural
            ? 'Free, unlimited and works offline.'
            : `Free, unlimited and works offline. ${IOS_TIP}`;
    barge.value = s.bargeIn ? 'on' : 'off';
  };
  engine.addEventListener('change', () => {
    settings.set({ voiceEngine: engine.value === 'phone' ? 'phone' : engine.value === 'ghosty' ? 'ghosty' : 'auto' });
    fill();
  });
  voice.addEventListener('change', () => {
    if (settings.get().voiceEngine === 'ghosty') settings.set({ brainVoice: voice.value });
    else settings.set({ voice: voice.value });
  });
  barge.addEventListener('change', () => settings.set({ bargeIn: barge.value === 'on' }));
  fill();
  // The phone's voices arrive a moment after the page loads (and when one is downloaded).
  setTimeout(fill, 1000);
  // Only when the list really changed: some browsers announce a change every time the list is read (fill reads it).
  let heard = listVoices().map((v) => v.name).join('|');
  try {
    speechSynthesis.addEventListener('voiceschanged', () => {
      const now = listVoices().map((v) => v.name).join('|');
      if (now === heard) return;
      heard = now;
      fill();
    });
  } catch {
    /* no speech synthesis */
  }
  speechCaps.subscribe(fill);
  return { nodes: [h('div.lab', 'VOICE'), engine, h('div.keyrow.wrapit', voice, sample), note, now, barge], refresh: fill };
}
