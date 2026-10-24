// Every tab as an iPhone 13 shows it in Safari — WebKit (Safari's engine) with a touch screen, the iPhone's
// user agent and its screen with Safari's bars (390×664), and only what iOS Safari has: no
// SpeechRecognition, no requestIdleCallback, no navigator.vibrate, no Notification outside a Home Screen app.
// On every tab (both sides where a phone swaps columns): no page errors; nothing sticks out sideways; every
// button on the first screen is at least 40 px tall and a finger at its centre lands on it; every text box is
// at least 16 px (Safari zooms the whole page on focus otherwise); fixed and sticky bars stay on screen.
// Also: the app shell fits the visible screen (no 100vh, which Safari measures with its bars hidden); no text
// growing on rotation, selectable panel titles or buttons stuck in their hover look; date and time boxes
// render; the mic says what is missing instead of failing; with Whisper the recording is the iPhone's
// audio/mp4 and its level meter is made in the tap; SCAN's beep comes from a context made by a tap.
//   PLAYWRIGHT_BROWSERS_PATH=… BASE=http://localhost:8788 node tests/safari.spec.mjs [outDir]
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const browser = await webkit.launch();
const problems = [];
const TABS = ['core', 'eye', 'lens', 'brief', 'agenda', 'threats', 'markets', 'radio', 'memory', 'library', 'workshop', 'learn', 'gym', 'studio', 'reverse', 'space', 'links', 'settings', 'system'];
const ctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 } });
// iOS Safari has none of these (and no Notification at all outside a Home Screen app): code must feature-detect.
await ctx.addInitScript(() => {
  for (const k of ['SpeechRecognition', 'webkitSpeechRecognition', 'requestIdleCallback', 'cancelIdleCallback', 'Notification']) delete window[k];
  try {
    Object.defineProperty(Navigator.prototype, 'vibrate', { value: undefined, configurable: true });
    delete Navigator.prototype.vibrate;
  } catch {
    /* already absent */
  }
});
const page = await ctx.newPage();
page.on('pageerror', (e) => /ResizeObserver loop|due to access control checks/.test(e.message) || problems.push(`pageerror: ${e.message}`)); // (WebKit reports a fetch the page caught, and its ResizeObserver notice, as page errors)
await page.goto(base);
await page.fill('#pair input', 'preview-owner-key-0123456789');
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
await page.waitForTimeout(1200);

// The app shell fills exactly the visible screen, and no stylesheet sizes a full-height box with vh
// (Safari's vh is the screen with its bars hidden: content would sit under the address bar and toolbar).
const shell = await page.evaluate(() => {
  const r = document.getElementById('app').getBoundingClientRect();
  const vh = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const walk = (list) => {
      for (const rule of list) {
        if (rule.cssRules) walk(rule.cssRules);
        if (!rule.style) continue;
        for (const prop of ['height', 'min-height']) {
          const v = rule.style.getPropertyValue(prop);
          if (/\b(9\d|100)vh\b/.test(v)) vh.push(`${rule.selectorText} { ${prop}: ${v} }`);
        }
      }
    };
    walk(rules);
  }
  return { top: r.top, bottom: r.bottom, h: innerHeight, vh };
});
if (Math.abs(shell.top) > 1 || Math.abs(shell.bottom - shell.h) > 1) problems.push(`the app shell is ${shell.top}–${shell.bottom}, not the visible screen 0–${shell.h}`);
// Safari's own habits: text that grows by itself when the phone turns, the panel titles (tapped to fold a panel)
// getting selected by a long press, and a tapped button left in its hover look.
const habits = await page.evaluate(async () => {
  const out = [];
  // (WebKit off the iPhone does not know text-size-adjust, so the stylesheet itself is read for it)
  const css = (await Promise.all([...document.styleSheets].filter((s) => s.href?.startsWith(location.origin)).map((s) => fetch(s.href).then((r) => r.text())))).join('\n');
  if (!/(^|[}\s])html\s*\{[^}]*-webkit-text-size-adjust:\s*100%/.test(css)) out.push('nothing stops iPhone Safari from enlarging text when the phone turns (html { -webkit-text-size-adjust: 100% })');
  const h3 = document.querySelector('.pn > h3');
  if (h3 && getComputedStyle(h3).webkitUserSelect !== 'none') out.push(`a panel title can be selected by a long press (-webkit-user-select: ${getComputedStyle(h3).webkitUserSelect})`);
  for (const sheet of document.styleSheets) {
    let rules;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) if (rule.selectorText && /^button(\.warn)?:hover$/.test(rule.selectorText)) out.push(`"${rule.selectorText}" applies on a touch screen (a tapped button stays lit)`);
  }
  return out;
});
for (const h of habits) problems.push(h);
for (const v of shell.vh) problems.push(`full-height box sized with vh (hidden under Safari's bars): ${v}`);

let buttons = 0;
let inputs = 0;
const settle = () => page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a.effect?.getTiming().iterations !== Infinity).map((a) => a.finished.catch(() => undefined)))).catch(() => undefined);
/** On a phone a tab's two columns swap with its MORE button: the other side, or false when there is none. */
const otherSide = async (tab) => {
  const swap = page.locator(`#pg-${tab} .swap`);
  if (!(await swap.count()) || !(await swap.isVisible())) return false;
  await swap.click();
  await page.waitForTimeout(500);
  await settle();
  return true;
};
for (const tab of TABS) for (const side of ['', ' (other side)']) {
  if (!side) {
    await page.evaluate((t) => (location.hash = t), tab);
    await page.waitForTimeout(1500);
    await settle();
  } else if (!(await otherSide(tab))) continue;
  const where = `${tab}${side}`;
  await page.screenshot({ path: `${out}/safari-${tab}${side ? '-other' : ''}.png` });
  const r = await page.evaluate(() => {
    const W = innerWidth;
    const H = innerHeight;
    const shown = (e) => e.getClientRects().length > 0 && e.checkVisibility({ opacityProperty: true, visibilityProperty: true });
    const name = (e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${typeof e.className === 'string' && e.className ? `.${e.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''} "${(e.getAttribute('aria-label') || e.textContent || e.placeholder || '').trim().slice(0, 24)}"`;
    // the part of an element left after every clipping ancestor (the page itself clips at the screen edge)
    const visible = (e) => {
      let { left, top, right, bottom } = e.getBoundingClientRect();
      for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const ar = a.getBoundingClientRect();
        if (cs.overflowX !== 'visible') (left = Math.max(left, ar.left)), (right = Math.min(right, ar.right));
        if (cs.overflowY !== 'visible') (top = Math.max(top, ar.top)), (bottom = Math.min(bottom, ar.bottom));
      }
      return { left, top, right, bottom };
    };
    const out = { wide: [], small: [], covered: [], font: [], bars: [], nButtons: 0, nInputs: 0 };
    for (const e of document.querySelectorAll('#app *, body > *')) {
      if (!shown(e) || e.id === 'gl') continue;
      const v = visible(e);
      if (v.right - v.left < 1 || v.bottom - v.top < 1) continue;
      // sticks out sideways: some of it shows past the screen's edge
      if (v.right > W + 1 || v.left < -1) out.wide.push(`${name(e)} spans ${Math.round(v.left)}–${Math.round(v.right)} of ${W}`);
      const cs = getComputedStyle(e);
      if ((cs.position === 'fixed' || cs.position === 'sticky') && v.bottom - v.top < H * 0.6) {
        const b = e.getBoundingClientRect();
        if (b.top < -1 || b.bottom > H + 1) out.bars.push(`${name(e)} (${cs.position}) is at ${Math.round(b.top)}–${Math.round(b.bottom)} of ${H}`);
      }
    }
    // The tab bar floats over the page, which scrolls up from under it (iOS): a button in that band
    // is scrolled under the bar, not covered by it — it counts once it is scrolled above.
    const bar = document.querySelector('#dock.areas .tabcap');
    const barTop = bar && getComputedStyle(document.querySelector('#dock')).position === 'absolute' ? bar.getBoundingClientRect().top : H;
    for (const b of document.querySelectorAll('#app button, body > * button')) {
      if (!shown(b)) continue;
      const r = b.getBoundingClientRect();
      if (!b.closest('#dock') && r.bottom > barTop) continue;
      const v = visible(b);
      // on the first screen: shown whole, not clipped by a scrolling box or the screen
      if (r.width < 1 || v.left > r.left + 0.5 || v.right < r.right - 0.5 || v.top > r.top + 0.5 || v.bottom < r.bottom - 0.5 || r.top < 0 || r.bottom > H || r.left < 0 || r.right > W) continue;
      out.nButtons++;
      if (r.height < 39.5) out.small.push(`${name(b)} is ${Math.round(r.height)} px tall`);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!hit || !(hit === b || b.contains(hit))) out.covered.push(`${name(b)} is under ${hit ? name(hit) : 'nothing'}`);
    }
    for (const i of document.querySelectorAll('input, textarea, select')) {
      if (!shown(i) || /^(checkbox|radio|range|color|file|hidden|button|submit|image)$/.test(i.type)) continue;
      out.nInputs++;
      const fs = parseFloat(getComputedStyle(i).fontSize);
      if (fs < 16) out.font.push(`${name(i)} has ${fs}px text`);
    }
    return out;
  });
  buttons += r.nButtons;
  inputs += r.nInputs;
  for (const w of r.wide) problems.push(`[${where}] sticks out sideways: ${w}`);
  for (const s of r.small) problems.push(`[${where}] button too small for a finger: ${s}`);
  for (const c of r.covered) problems.push(`[${where}] button cannot be tapped: ${c}`);
  for (const f of r.font) problems.push(`[${where}] Safari zooms in when this box is tapped: ${f}`);
  for (const b of r.bars) problems.push(`[${where}] bar pushed off the screen: ${b}`);
}

// Date and time boxes (AGENDA's new event and reminder) render as real pickers with a value, finger-sized.
// (The event's box is on the first side, the reminder's on the other.)
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(500);
await page.evaluate(() => (location.hash = 'agenda'));
await page.waitForTimeout(1200);
const dateBoxes = () =>
  page.$$eval('#pg-agenda input[type="datetime-local"]', (l) =>
    l.filter((i) => i.getClientRects().length).map((i) => {
      const r = i.getBoundingClientRect();
      return { label: i.getAttribute('aria-label'), type: i.type, value: i.value, w: Math.round(r.width), h: Math.round(r.height) };
    }),
  );
const dates = await dateBoxes();
if (await otherSide('agenda')) dates.push(...(await dateBoxes()).filter((d) => !dates.some((x) => x.label === d.label)));
if (dates.length < 2) problems.push(`AGENDA has ${dates.length} date and time boxes, expected the event's and the reminder's`);
for (const d of dates) if (d.type !== 'datetime-local' || !d.value || d.w < 120 || d.h < 39.5) problems.push(`a date and time box does not render properly: ${JSON.stringify(d)}`);

// Buttons drawn at a fixed size inside something else keep that size on a touch screen: the × pinned to a SCAN
// page thumbnail's corner and the 3-D map's zoom buttons (MapLibre's square stack) are not stretched to 40 px.
const fixedSize = await page.evaluate(() => {
  const box = document.createElement('div');
  box.innerHTML = '<div class="scanthumb"><img alt=""><button>×</button></div><div class="map3d"><div class="maplibregl-ctrl maplibregl-ctrl-group"><button></button><button></button></div></div>';
  document.body.append(box);
  const [x, zoom] = box.querySelectorAll('button');
  const out = { thumb: Math.round(x.getBoundingClientRect().height), zoom: Math.round(zoom.getBoundingClientRect().height), other: Math.round(document.querySelector('#mic')?.getBoundingClientRect().height ?? 0) };
  box.remove();
  return out;
});
if (fixedSize.thumb !== 24) problems.push(`the × on a SCAN thumbnail is stretched to ${fixedSize.thumb} px (should stay 24)`);
if (fixedSize.zoom !== 30) problems.push(`the 3-D map's zoom buttons are stretched to ${fixedSize.zoom} px (should stay 30)`);

// The mic, with no speech recognition (and no Whisper key): an honest message, no crash.
await page.evaluate(() => (location.hash = 'core'));
await page.waitForTimeout(1000);
const toastsBefore = await page.$$eval('.toast', (l) => l.length);
await page.click('#mic');
await page.waitForTimeout(1500);
const said = await page.$$eval('.toast', (l) => l.map((t) => t.textContent).join(' | '));
if ((await page.$$eval('.toast', (l) => l.length)) <= toastsBefore || !/speech recognition|microphone/i.test(said)) problems.push(`the mic without speech recognition said: "${said}"`);
const state = await page.evaluate(() => document.body.className);
if (/listening/.test(state)) problems.push('the mic stayed in listening after failing');

// The mic when the brain can hear (Whisper): the recording is made the iPhone's way. A stand-in microphone that
// answers after a moment (as the permission prompt does) and a recorder that, like Safari's, only makes
// audio/mp4. The level meter's AudioContext must be made in the tap itself, before that wait: Safari starts a
// context made afterwards suspended, so the meter would hear only silence and never notice the speaker stop.
// (no service worker here: WebKit's page.route() cannot see the requests of a page one controls)
const vctx = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 664 }, serviceWorkers: 'block' });
await vctx.addInitScript(() => {
  const mic = (window.__mic = { meter: null, answered: false, mime: null, picked: false, beeps: [] });
  const Real = window.AudioContext;
  window.AudioContext = class extends Real {
    constructor(...a) {
      super(...a);
      this.bornBeforeMic = !mic.answered;
      this.bornBeforePick = !mic.picked;
    }
    createOscillator() {
      const o = super.createOscillator();
      const start = o.start.bind(o);
      o.start = (...a) => {
        if (o.frequency.value === 1760) mic.beeps.push(this.bornBeforePick ? 'made before' : 'made after');
        return start(...a);
      };
      return o;
    }
    createMediaStreamSource(s) {
      mic.meter = this.bornBeforeMic ? 'made in the tap' : 'made after the microphone answered';
      return super.createMediaStreamSource(s);
    }
  };
  const getUserMedia = () =>
    new Promise((resolve) =>
      setTimeout(() => {
        const d = new Real().createMediaStreamDestination();
        mic.answered = true;
        resolve(d.stream);
      }, 400),
    );
  if (window.MediaDevices) Object.defineProperty(MediaDevices.prototype, 'getUserMedia', { value: getUserMedia, configurable: true });
  else Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia } });
  window.MediaRecorder = class {
    static isTypeSupported(m) {
      return m === 'audio/mp4';
    }
    constructor(_s, o) {
      mic.mime = o?.mimeType ?? '';
      this.mimeType = o?.mimeType ?? '';
    }
    start() {}
    stop() {
      setTimeout(() => this.onstop?.(), 0);
    }
  };
});
await vctx.route('**/api/status', async (route) => {
  const r = await route.fetch();
  const j = await r.json();
  j.speech = { stt: true, tts: false };
  await route.fulfill({ response: r, headers: { ...r.headers(), 'content-type': 'application/json' }, body: JSON.stringify(j) });
});
const vpage = await vctx.newPage();
vpage.on('pageerror', (e) => /ResizeObserver loop|due to access control checks/.test(e.message) || problems.push(`[voice] pageerror: ${e.message}`));
await vpage.goto(base);
await vpage.fill('#pair input', 'preview-owner-key-0123456789');
await vpage.click('#pair button.on');
await vpage.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
await vpage.waitForTimeout(1500);
await vpage.click('#mic');
await vpage.waitForTimeout(1200);
const heard = await vpage.evaluate(() => window.__mic);
if (heard.meter !== 'made in the tap') problems.push(`the mic's level meter was ${heard.meter ?? 'never connected'} (Safari keeps such a context suspended)`);
if (heard.mime !== 'audio/mp4') problems.push(`the recorder did not pick the iPhone's audio/mp4: asked for "${heard.mime}"`);
await vpage.click('#mic'); // stop listening

// SCAN's beep when a code is found: the sound must come from a context made by a tap in SCAN, not one made at the
// moment the code is found (long after any tap: iPhone Safari keeps that one silent, so there was never a beep).
await vpage.evaluate(() => window.__ghosty.run('open_lens', { mode: 'scan' }));
await vpage.waitForTimeout(800);
await vpage.locator('#pg-lens .lensmodes button', { hasText: 'SCAN' }).click();
await vpage.waitForFunction(() => window.__ghosty?.lens?.mode === 'scan' && window.__ghosty?.scan?.sub === 'code', null, { timeout: 10000 }).catch(() => problems.push('SCAN did not open'));
await vpage.evaluate(() => (window.__mic.picked = true));
await vpage.locator('#pg-lens input[type=file]').setInputFiles(new URL('./fixtures/qr-url.png', import.meta.url).pathname);
const read = await vpage.waitForFunction(() => (window.__ghosty?.scan?.codes ?? []).length > 0, null, { timeout: 60000 }).then(() => true, () => false);
if (!read) problems.push('SCAN did not read the QR code photo');
else {
  await vpage.waitForTimeout(300);
  const beeps = await vpage.evaluate(() => window.__mic.beeps);
  if (!beeps.length) problems.push('no beep when the code was found');
  else if (beeps.some((b) => b !== 'made before')) problems.push(`the beep came from an audio context ${beeps.join(', ')} the code was found (silent on an iPhone)`);
}
await vctx.close();

await browser.close();
if (buttons < 40) problems.push(`only ${buttons} buttons were checked: the spec did not see the tabs`);
console.log(problems.length ? `PROBLEMS:\n${[...new Set(problems)].join('\n')}` : `Safari run clean on an iPhone 13 screen: ${TABS.length} tabs, ${buttons} buttons and ${inputs} text boxes checked.`);
process.exit(problems.length ? 1 : 0);
