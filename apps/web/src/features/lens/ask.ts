/**
 * ASK: a question with a picture for Ghosty. ASK GHOSTY captures a still, downsizes it to a
 * JPEG of at most 1024 px and sends it with the question to the brain's chat (the answer shows
 * here and in the chat history). The message also carries what the phone itself saw (labels,
 * scene, text), so if no model that sees pictures is reachable, Ghosty can still answer from
 * that — and the Lens offers DESCRIBE WITH WHAT I CAN SEE HERE, which sends only words.
 */
import { clear, h } from '../../core/dom';
import { button, toast } from '../../ui/components';
import { fromClassifier, onDeviceSummary } from '../../vision/boxes';
import { toJpegDataUrl } from '../../vision/camera';
import { classifier, nextStamp } from '../../vision/models';
import type { LensContext, Mode, ModeOpts } from './index';

const EXAMPLES = ['What is this?', 'Is this edible?', 'Translate this sign'];

export function createAskMode(L: LensContext): Mode {
  const S = L.state;
  let pendingStill: HTMLCanvasElement | null = null;
  let pendingText = '';
  let lastStill: HTMLCanvasElement | null = null;
  let busy = false;

  const q = h('textarea.lensq', { rows: 2, placeholder: 'What is this? / Is this edible? / Translate this sign', 'aria-label': 'Your question about the picture' });
  const chips = h('div.lenschips', ...EXAMPLES.map((e) => button(e, () => (q.value = e))));
  const askBtn = button('ASK GHOSTY', () => void ask(), 'warn');
  const replyModel = h('small');
  const replyText = h('div');
  const reply = h('div.lensreply', replyModel, replyText);
  reply.hidden = true;
  const fallback = button('DESCRIBE WITH WHAT I CAN SEE HERE', () => void describe(), 'on');
  fallback.hidden = true;
  const fallbackNote = h('div.note', "Ghosty's brain could not look at the picture: none of the models it can reach sees pictures right now (a free Gemini key in the System tab fixes that). This sends only words: the labels, scene and text the phone itself found.");
  fallbackNote.hidden = true;
  const note = h('div.note', "ASK GHOSTY sends one picture (a JPEG of at most 1024 px) and your question to Ghosty's brain, which needs a model that can see pictures. Nothing is sent before you press it.");
  const root = h('div.stackf', q, chips, h('div.row', askBtn), note, reply, fallback, fallbackNote);

  const showReply = (text: string, model: string) => {
    reply.hidden = false;
    replyModel.textContent = model || 'GHOSTY';
    replyText.textContent = text;
    S.reply = text;
  };

  const ask = async () => {
    const question = q.value.trim();
    if (!question) return void toast('Ask something first', 'warn');
    if (busy) return;
    busy = true;
    askBtn.disabled = true;
    fallback.hidden = true;
    fallbackNote.hidden = true;
    S.reply = '';
    try {
      let message = question;
      let dataUrl: string | null = null;
      if (pendingText) {
        message = `${question}\n\nText I read with the Lens (sent as text, not a picture):\n"""\n${pendingText.slice(0, 6000)}\n"""`;
      } else {
        const still = pendingStill ?? L.still(1024);
        if (!still) return void toast('No picture: START the camera first', 'warn');
        lastStill = still;
        L.showStill(still);
        dataUrl = toJpegDataUrl(still, 1024, 0.8);
        const seen = onDeviceSummary(S.detections, S.scene, S.ocrText);
        if (seen) message = `${question}\n\n${seen}`;
      }
      L.status(dataUrl ? 'sending the picture to Ghosty…' : 'asking Ghosty…', 'mid');
      const r = await L.ask(message, dataUrl);
      if (r.text) showReply(r.text, r.model);
      else if (r.error) showReply(r.error, 'PROBLEM');
      if (r.noVision) {
        fallback.hidden = false;
        fallbackNote.hidden = false;
        L.status("Ghosty can't see pictures right now", 'off');
      } else L.status(r.error && !r.text ? `problem: ${r.error}` : 'answered', r.error && !r.text ? 'off' : 'ok');
    } finally {
      busy = false;
      askBtn.disabled = false;
      pendingText = '';
      pendingStill = null;
    }
  };

  /** No vision model: say what the phone saw, in words only. */
  const describe = async () => {
    const question = q.value.trim() || 'What is this?';
    const still = lastStill ?? L.still(1024);
    let seen = onDeviceSummary(S.detections, S.scene, S.ocrText);
    if (!seen && still) {
      try {
        L.status('looking with the phone itself…', 'mid');
        const c = await classifier.get((s) => L.status(s, 'mid'));
        seen = onDeviceSummary([], fromClassifier(c.classifyForVideo(still, nextStamp(performance.now())), 5), S.ocrText);
      } catch {
        /* the classifier is not available here */
      }
    }
    if (!seen) return void toast('The phone saw nothing it could name: try SEE or READ first', 'warn');
    busy = true;
    askBtn.disabled = true;
    try {
      L.status('asking Ghosty with words only…', 'mid');
      const r = await L.ask(`${question}\n\nYou cannot see the picture, so here is what my phone saw on its own: ${seen}`, null);
      if (r.text) showReply(r.text, r.model);
      else if (r.error) showReply(r.error, 'PROBLEM');
      L.status(r.text ? 'answered from the on-device description' : 'no answer', r.text ? 'ok' : 'off');
    } finally {
      busy = false;
      askBtn.disabled = false;
    }
  };

  return {
    id: 'ask',
    enter(opts?: ModeOpts) {
      clear(L.panel);
      L.panel.append(root);
      if (opts?.question) q.value = opts.question;
      if (opts?.still) {
        pendingStill = opts.still;
        L.showStill(opts.still);
      }
      if (opts?.text) pendingText = opts.text;
      if (opts?.send) void ask();
      else if (S.camera === 'on') L.status('type a question, then ASK GHOSTY', 'ok');
    },
    leave() {
      L.showStill(null);
      pendingStill = null;
      pendingText = '';
    },
  };
}
