// A fake speaker for the checks that count what Ghosty says (tests/octideas.spec.mjs): the phone's speech synthesis as a recorder.
// Every utterance spoken is pushed on window.__spoken as its text; it "plays" for 40 ms and ends. The phone's voice is the one in
// use (settings.voiceEngine 'phone'), so nothing is asked of the brain.
//   await ctx.addInitScript(fakeSpeaker);
export function fakeSpeaker() {
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      Object.assign(this, { text, voice: null, lang: '', rate: 1, pitch: 1, volume: 1 });
    }
  };
  const synth = window.SpeechSynthesis?.prototype ?? window.speechSynthesis;
  let cur = null;
  const voices = [{ name: 'Daniel', lang: 'en-GB', voiceURI: 'Daniel', localService: true, default: false }];
  synth.getVoices = () => voices;
  Object.defineProperty(synth, 'speaking', { configurable: true, get: () => !!cur });
  Object.defineProperty(synth, 'pending', { configurable: true, get: () => false });
  synth.speak = (u) => {
    if (!u.text.trim() || u.volume === 0) return void setTimeout(() => u.onend?.({}), 5);
    window.__spoken.push(u.text);
    cur = u;
    setTimeout(() => {
      cur = null;
      u.onstart?.({});
      u.onend?.({});
    }, 40);
  };
  synth.cancel = () => {
    cur = null;
  };
  synth.pause = () => undefined;
  synth.resume = () => undefined;
}
