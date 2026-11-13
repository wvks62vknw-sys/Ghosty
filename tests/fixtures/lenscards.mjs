// The Lens that just knows: the cards the camera shows, switchable in the page (BRIEF-LENS-KNOWS tests).
// Chromium's file-based fake camera (lenscard.mjs) plays one card for a whole run; a spec that has to move from a letter to a sign to a
// code to a mug in one visit gives the page its own camera instead: getUserMedia answers with a canvas's stream, and `window.__setCard(name)`
// redraws it ('blank', 'letter', 'bill', 'sign-fr', 'sign-fr2', 'sign-es', 'qr', 'mug'). Static on purpose: identical frames are a steady frame.
import { readFileSync } from 'node:fs';

export const qrPng = () => readFileSync(new URL('./qr-url.png', import.meta.url)).toString('base64');

/** For page.addInitScript(cardCamera, { qr }). */
export function cardCamera({ qr }) {
  const cv = document.createElement('canvas');
  cv.width = 640;
  cv.height = 480;
  const g = cv.getContext('2d');
  let qrImg = null;
  const img = new Image();
  img.onload = () => (qrImg = img);
  img.src = `data:image/png;base64,${qr}`;
  window.__card = 'blank';
  const centred = (t, y, size, weight = 'bold') => {
    g.font = `${weight} ${size}px sans-serif`;
    g.textAlign = 'center';
    g.fillText(t, 320, y);
    g.textAlign = 'left';
  };
  const draw = () => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 640, 480);
    g.fillStyle = '#000';
    const c = window.__card;
    if (c === 'blank') {
      g.fillStyle = '#9a9a9a';
      g.fillRect(0, 0, 640, 480);
    } else if (c === 'letter') {
      g.font = 'bold 30px sans-serif';
      g.fillText('Your bins are changing.', 40, 60);
      g.font = '24px sans-serif';
      ['From Monday the general waste bin moves to', 'Thursdays. Recycling stays on Mondays. Garden', 'waste pauses for the winter and starts again', 'in March.', '', 'Put your bins out by seven on collection day.', 'Nothing else changes for your street.'].forEach((l, i) => g.fillText(l, 40, 120 + i * 36));
    } else if (c === 'bill') {
      // a bill (BRIEF-OCT-IDEAS-2 6): the spec sets window.__billLines (a letterhead, an amount, a due date, a reference)
      const lines = window.__billLines ?? ['BRITISH GAS', 'Your balance is £84.20.', 'Please pay by 14 November 2026.', 'Reference 4471 2290'];
      g.font = 'bold 34px sans-serif';
      g.fillText(lines[0], 40, 64);
      g.font = '26px sans-serif';
      lines.slice(1).forEach((l, i) => g.fillText(l, 40, 130 + i * 44));
    } else if (c === 'sign-fr') {
      // a notice with a headline and a small line (the text check looks for print: one huge line is a blind spot of it, said in the report)
      centred('SORTIE DE SECOURS', 210, 34);
      centred('Ne pas bloquer cette issue', 262, 26, 'normal');
    } else if (c === 'sign-fr2') {
      centred('DEFENSE DE FUMER', 210, 34);
      centred('Merci de votre comprehension', 262, 26, 'normal');
    } else if (c === 'sign-es') {
      centred('SALIDA DE EMERGENCIA', 210, 34);
      centred('No bloquee esta salida', 262, 26, 'normal');
    } else if (c === 'qr') {
      if (qrImg) {
        g.imageSmoothingEnabled = false;
        g.drawImage(qrImg, 190, 110, 260, 260);
      }
    } else if (c === 'mug') {
      // a plain white mug on a grey table: no words, no code, nothing the text check takes for print
      g.fillStyle = '#6b6f73';
      g.fillRect(0, 0, 640, 480);
      g.fillStyle = '#f2f0ea';
      g.fillRect(230, 150, 170, 190);
      g.beginPath();
      g.ellipse(315, 150, 85, 22, 0, 0, Math.PI * 2);
      g.fill();
      g.lineWidth = 22;
      g.strokeStyle = '#f2f0ea';
      g.beginPath();
      g.arc(405, 245, 48, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      g.fillStyle = '#2a2d30';
      g.beginPath();
      g.ellipse(315, 150, 70, 14, 0, 0, Math.PI * 2);
      g.fill();
    }
  };
  draw();
  setInterval(draw, 100);
  const stream = cv.captureStream(10);
  navigator.mediaDevices.getUserMedia = () => new Promise((ok) => setTimeout(() => ok(stream), 500));
  // the clock of the spec: when the card was set, when the picture first held still after it, when the words (the plate) were first on screen
  window.__clock = {};
  window.__setCard = (name) => {
    window.__card = name;
    window.__clock = { set: performance.now(), moved: false };
  };
  const tick = () => {
    const o = window.__ghosty?.one;
    const c = window.__clock;
    const now = performance.now();
    if (o && c.set) {
      if (!o.steady) c.moved = true;
      if (o.steady && c.moved && !c.steady) c.steady = now;
      if (o.plate?.shown && c.moved && !c.plate) c.plate = now;
      if (o.looking && !c.looking && o.looking !== 'nothing yet') c.looking = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // the phone's own voice: it records what it is asked to say
  window.__spoke = [];
  const synth = window.speechSynthesis;
  synth.speak = (u) => void window.__spoke.push(u.text);
  synth.cancel = () => undefined;
  synth.getVoices = () => [];
}
