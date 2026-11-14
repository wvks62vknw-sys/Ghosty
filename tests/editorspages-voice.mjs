// THE EDITORS LANE, PAGES: VOICE NOTES INTO TIDY PAGES (editors.s6), end to end on the phone.
//  1. "take a voice note" in the chat opens the workspace's VOICE NOTE, its first line in his words.
//  2. RECORD with the phone's own microphone (a real MediaRecorder on a real sound), the clock counts, STOP; the states pass through
//     listening and writing; the brain's tidy lands as a page: its title, its paragraphs, TO DO with a to-do each, what he said at the end.
//  3. UNDO takes the page away.
//  4. Offline: a recording chosen from Voice Memos (a real WAV) is kept on this phone, said in his words; back online, it is tidied by itself.
//     This one becomes A DOCUMENT, tidied on the phone as the brain is away (said so), and lands in MY DOCUMENTS with its to-dos.
//  5. The panel in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21: every key 44 pt, nothing sideways, no words cut.

/** A real WAV: `secs` seconds of a soft tone at 16 kHz. */
function wav(secs = 3) {
  const rate = 16000;
  const n = rate * secs;
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12);
  b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((i / rate) * 2 * Math.PI * 220) * 6000), 44 + i * 2);
  return b;
}
// the phone's microphone, as a real stream: an oscillator through the page's own audio graph
const fakeMic = () => {
  const real = navigator.mediaDevices;
  if (!real) return;
  real.getUserMedia = async () => {
    const ac = new AudioContext();
    const o = ac.createOscillator();
    const dest = ac.createMediaStreamDestination();
    o.connect(dest);
    o.start();
    return dest.stream;
  };
};

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL, base } = h;
  const said = 'um so the kitchen tiles came today and they look great. I need to call the plumber on Monday. remember to order the grout';
  const reply = '# Kitchen tiles\n\nThe tiles came today and they look great.\n\n## To do\n- [ ] Call the plumber on Monday\n- [ ] Order the grout\n';
  const stream = (text) => `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from([{ t: 'status', text: 'thinking…' }, { t: 'text', text }, { t: 'done', model: 'Mock · scripted' }].map((e) => JSON.stringify(e)).join('\n') + '\n').toString('base64'))}`;
  const v = (page) => page.evaluate(() => ({ ...window.__ghosty.workspace.voice }));
  const panel = '#pg-workspace .wsvoice';
  const vkey = (page, label) => page.locator(`${panel} button:visible`).filter({ hasText: new RegExp(`^${label}$`) }).first();
  const goVoice = async (page) => {
    await page.evaluate(() => (location.hash = 'workspace'));
    await page.waitForSelector('#pg-workspace .wssheet', { timeout: 40000 });
    if (!(await page.locator(panel).isVisible().catch(() => false))) await page.locator('#pg-workspace .wssheet button:visible', { hasText: /^VOICE NOTE$/ }).first().click();
    return until(page, (sel) => !!document.querySelector(sel), panel);
  };

  // ---------------------------------------------------------------- 1 to 3: the chat's words, RECORD, the tidy page, UNDO
  {
    const { ctx, page } = await open({ look: LOOKS.scan, init: fakeMic });
    await page.route('**/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: said }) }));
    await page.route('**/api/chat', (r) => r.continue({ url: stream(reply) }));
    // 1. the chat's words (found by his own message's time, then the first reply after it that matches)
    await page.evaluate(() => (location.hash = 'core'));
    await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
    const t0 = await page.evaluate(() => Date.now());
    await page.fill('#cin', 'take a voice note');
    await page.keyboard.press('Enter');
    const answered = await until(page, (t0) => {
      const msgs = [...document.querySelectorAll('#pg-core .msg')];
      const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0).lastIndexOf(true);
      return mine >= 0 && msgs.slice(mine + 1).some((m) => !m.classList.contains('me') && /VOICE NOTE is open in your workspace/.test(m.textContent ?? ''));
    }, t0, 20000);
    check(answered, 'voice 1: “take a voice note” is answered in his words (VOICE NOTE is open in your workspace…)');
    check(await until(page, (sel) => !!document.querySelector(sel), `.wssheet ${'.wsvoice'}`, 15000), 'voice 1: the workspace opens on VOICE NOTE');
    check(/^Talk for a few minutes\. I keep the recording on this phone/.test((await v(page)).said), `voice 1: the first line says what happens (${(await v(page)).said})`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ look: LOOKS.scan, init: fakeMic });
    await page.route('**/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: said }) }));
    await page.route('**/api/chat', (r) => r.continue({ url: stream(reply) }));
    check(await goVoice(page), 'voice 2: the workspace screen has VOICE NOTE');
    // the states, as they pass
    await page.evaluate((sel) => {
      window.__states = [];
      const el = document.querySelector(sel);
      new MutationObserver(() => window.__states.at(-1) !== el.dataset.state && window.__states.push(el.dataset.state)).observe(el, { attributes: true, attributeFilter: ['data-state'] });
    }, panel);
    await vkey(page, 'RECORD').click();
    check(await until(page, () => window.__ghosty.workspace.voice.state === 'recording'), 'voice 2: RECORD starts recording');
    check(await until(page, () => /^Recording… 0:0[1-9]\. Tap STOP when you are done\.$/.test(window.__ghosty.workspace.voice.said), null, 8000), `voice 2: the clock counts in his words (${(await v(page)).said})`);
    check(await vkey(page, 'STOP').isVisible() && await vkey(page, 'THROW IT AWAY').isVisible(), 'voice 2: STOP and THROW IT AWAY while recording');
    await vkey(page, 'STOP').click();
    check(await until(page, () => window.__ghosty.workspace.voice.state === 'done', null, 30000), `voice 2: the note is done (${(await v(page)).said})`);
    const states = await page.evaluate(() => window.__states);
    check(['recording', 'listening', 'writing', 'done'].every((s) => states.includes(s)), `voice 2: it passed through recording, listening, writing and done (${states.join(' → ')})`);
    check((await v(page)).said === 'Done: “Kitchen tiles” is a page in your workspace, with 2 to-dos.', `voice 2: done, in his words (${(await v(page)).said})`);
    check(await until(page, () => window.__ghosty.workspace.view === 'page' && window.__ghosty.workspace.title === 'Kitchen tiles'), 'voice 2: the page opens, its title the tidy one');
    const bs = await page.evaluate(() => JSON.parse(window.__ghosty.workspace.json).blocks);
    check(bs.filter((b) => b.t === 'todo').map((b) => b.runs[0].text).join(' | ') === 'Call the plumber on Monday | Order the grout', 'voice 2: each action is a to-do');
    check(bs.some((b) => b.t === 'p' && b.runs[0]?.text === 'The tiles came today and they look great.'), 'voice 2: the paragraph is the tidy one');
    check(bs.at(-1).t === 'quote' && bs.at(-1).runs[0].text === said, 'voice 2: what he said is kept word for word at the end');
    check(await until(page, () => Object.values(JSON.parse(localStorage.getItem('ghosty.workspace') || '{"pages":{}}').pages).some((p) => p.title === 'Kitchen tiles' && !p.deleted)), 'voice 2: kept on this phone');
    check((await page.evaluate(() => new Promise((ok) => {
      const r = indexedDB.open('ghosty-voicenotes', 1);
      r.onsuccess = () => {
        const q = r.result.transaction('notes').objectStore('notes').count();
        q.onsuccess = () => ok(q.result);
      };
    }))) === 0, 'voice 2: the recording is let go once its page is made');
    // 3. UNDO
    await page.locator('#pg-workspace .wsstatus button', { hasText: /^UNDO$/ }).click();
    check(await until(page, () => !Object.values(JSON.parse(localStorage.getItem('ghosty.workspace') || '{"pages":{}}').pages).some((p) => p.title === 'Kitchen tiles' && !p.deleted)), 'voice 3: UNDO takes the page away');
    check(await until(page, () => window.__ghosty.workspace.said === 'Taken away: the page sits in the BIN for 30 days.'), 'voice 3: said in his words (into the BIN for 30 days)');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 4. offline: kept, then tidied by itself, as A DOCUMENT
  {
    const { ctx, page } = await open({ look: LOOKS.scan });
    await page.route('**/api/stt', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ text: said }) }));
    await page.route('**/api/chat', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"away"}' }));
    check(await goVoice(page), 'voice 4: VOICE NOTE opens');
    await vkey(page, 'A DOCUMENT').click();
    check(await until(page, () => window.__ghosty.workspace.voice.target === 'document' && document.querySelector('.wsvoice button[data-target="document"]')?.getAttribute('aria-pressed') === 'true'), 'voice 4: A DOCUMENT is chosen');
    await ctx.setOffline(true);
    await page.setInputFiles(`${panel} input[type=file]`, { name: 'Kitchen.wav', mimeType: 'audio/wav', buffer: wav(3) });
    check(await until(page, () => window.__ghosty.workspace.voice.state === 'offline'), 'voice 4: offline, it is not lost');
    check((await v(page)).said === 'Offline: your recording is kept on this phone, and I tidy it into a page when you are back.', `voice 4: said in his words (${(await v(page)).said})`);
    check(await until(page, () => window.__ghosty.workspace.voice.kept === 1 && !!document.querySelector('.wsvoicek')), 'voice 4: the kept recording is listed, with TIDY IT NOW and DELETE');
    await ctx.setOffline(false);
    check(await until(page, () => window.__ghosty.workspace.voice.state === 'done', null, 30000), `voice 4: back online, it is tidied by itself (${(await v(page)).said})`);
    check(/^Done: “So the kitchen tiles came today and…” is in MY DOCUMENTS, with 2 to-dos\. I tidied it on this phone, as my brain was away\.$/.test((await v(page)).said), `voice 4: done, in his words, saying the phone tidied it (${(await v(page)).said})`);
    const doc = await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.docs') || '[]').find((d) => d.from === 'a voice note'));
    check(!!doc && doc.blocks.filter((b) => b.t === 'todo').map((b) => b.runs[0].text).join(' | ') === 'Call the plumber on Monday | Order the grout', 'voice 4: the document is in MY DOCUMENTS with its to-dos');
    check(await until(page, () => window.__ghosty.workspace.voice.kept === 0), 'voice 4: the kept recording is let go');
    check(await page.locator('#pg-workspace .wsstatus button', { hasText: /^OPEN IT$/ }).isVisible(), 'voice 4: OPEN IT opens the document');
    await ctx.close();
  }

  // ---------------------------------------------------------------- 5. every look, The Scan small, BODY 21
  const runs = [...Object.keys(LOOKS).map((name) => ({ name, look: LOOKS[name], viewport: PHONE, big: false })), { name: 'scan at 390', look: LOOKS.scan, viewport: SMALL, big: false }, { name: 'scan at BODY 21', look: LOOKS.scan, viewport: PHONE, big: true }];
  for (const r of runs) {
    const { ctx, page } = await open({ look: r.look, viewport: r.viewport });
    check(await goVoice(page), `voice ${r.name}: VOICE NOTE opens`);
    if (r.big) await body21(page);
    await settle(page);
    await measure(page, '#pg-workspace', `voice ${r.name}`);
    await ctx.close();
  }
}
