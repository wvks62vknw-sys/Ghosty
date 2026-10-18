// Ghosty's offline brain: the small language model runs here, in its own thread, so the 6 MB
// WebLLM runtime and the model's GPU memory never touch the page. The page (src/offline/brain.ts)
// talks to it with a few plain messages:
//   { id, op: 'load', model, appConfig }   download (first time) and load the model; 'progress' events
//   { id, op: 'chat', messages, max, temperature? }  stream a reply: 'token' events, then 'done' with usage
//                                          (temperature: THINK HARDER varies it between attempts; 0.7 otherwise)
//   { id, op: 'stop' }                     stop the reply being written
//   { id, op: 'unload' }                   free the model's memory (the download stays cached)
// Every answer carries the request's id; failures come back as { id, t: 'error', message }.
import { MLCEngine } from './web-llm.mjs';

let engine = null;
let loaded = '';

const post = (m) => self.postMessage(m);

self.onmessage = async (ev) => {
  const m = ev.data || {};
  try {
    if (m.op === 'load') {
      const progress = (p) => post({ id: m.id, t: 'progress', progress: p.progress, text: p.text });
      if (!engine) engine = new MLCEngine({ appConfig: m.appConfig, initProgressCallback: progress, logLevel: 'WARN' });
      else engine.setInitProgressCallback(progress);
      if (loaded !== m.model) {
        await engine.reload(m.model);
        loaded = m.model;
      }
      post({ id: m.id, t: 'done' });
    } else if (m.op === 'chat') {
      if (!engine || !loaded) throw new Error('the offline brain is not loaded');
      const chunks = await engine.chat.completions.create({
        messages: m.messages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: m.max || 400,
        temperature: typeof m.temperature === 'number' ? m.temperature : 0.7,
        top_p: 0.8,
        // A small model thinking out loud is slow and wordy: answers only.
        extra_body: { enable_thinking: false },
      });
      let usage = null;
      for await (const c of chunks) {
        const piece = c.choices && c.choices[0] && c.choices[0].delta && c.choices[0].delta.content;
        if (piece) post({ id: m.id, t: 'token', text: piece });
        if (c.usage) usage = { tokens: c.usage.completion_tokens, perSecond: c.usage.extra && c.usage.extra.decode_tokens_per_s };
      }
      post({ id: m.id, t: 'done', usage });
    } else if (m.op === 'stop') {
      if (engine) await engine.interruptGenerate();
      post({ id: m.id, t: 'done' });
    } else if (m.op === 'unload') {
      if (engine) await engine.unload();
      loaded = '';
      post({ id: m.id, t: 'done' });
    }
  } catch (e) {
    post({ id: m.id, t: 'error', message: String((e && e.message) || e).slice(0, 400) });
  }
};
