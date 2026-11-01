// THE PEOPLE, WORK AND CREATIVE PACKS on the owner's phone (BRIEF-PACKS-2), against the preview's real brain and its scripted
// model (the mock writes the words of a song and calls the tools; every number, date and picture is made by code), at
// 440 × 956 and 390 × 844:
//  - PEOPLE: "Dad's birthday is 14 March" typed → the brain keeps it, its card is in the chat and the two reminders are in the
//    Agenda (a week before and on the day, 9am); UNDO takes them away; "who's who" opens the people sheet over the chat with
//    gift ideas from what was said, and nothing is looked up;
//  - WORK: a cover letter written from a pasted ad and the CV's facts (the mock model's line) shown in the chat AND in a
//    sheet to copy; interview practice: a question, an answer typed and timed (the phone's clock stubbed 62 s on), a plain
//    critique; "start a pomodoro" sets eight timers on the phone, "stop the pomodoro" clears them;
//  - CREATIVE: a song written by the mock model, its tune made by code and PLAYED (the audio context started by the tap) and
//    offered as a WAV and a MIDI file; a poster laid out and exported as a PNG; a comic strip drawn; a birthday card; a logo as an
//    SVG; a palette from a picture; drum pads tapped along with a loop; every file read back for its header;
//  - every sheet at 390 × 844: nothing sideways, every button, field and picture named for VoiceOver. No page errors.
//   BASE=http://localhost:8766 node tests/packs2.spec.mjs [outDir]
import { launch, webkitNoise } from './browser.mjs';
import { PHONE, UK, standDown } from './nav.mjs';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const t0 = Date.now();
await standDown(base, KEY);
const log = (s) => console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s · ${s}`);
const api = (path, body) => fetch(`${base}/api${path}`, { method: body ? 'POST' : 'GET', headers: { 'x-ghosty': '1', 'x-ghosty-key': KEY, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }).then((r) => r.json());
const doPack = (pack, action, args = {}) => api('/packs/do', { pack, action, args });

const CV_TEXT = 'My name is Sam Khan. I live in Leeds. My email is sam@example.com. I worked at Tesco as a shelf stacker from 2019 to 2022. I served customers on the tills at weekends. I studied catering at Leeds City College. I have a full driving licence. I am a reliable and friendly person who works well in a team.';
const AD = 'Customer Assistant at Fairfield Foods, Leeds. £12.60 an hour. Requirements: previous retail or customer service experience; good communication and teamwork; a full UK driving licence; forklift licence (desirable). Closing date 20 November 2026.';
const ANSWER = 'Last year at Tesco in Leeds we had a customer who was upset about a missing delivery. My job was to sort it out before the lunch rush. I checked the order with the warehouse, called the driver and found it had gone to the wrong store. I arranged a replacement the same afternoon and gave her a voucher, so she left happy. She wrote to my manager, and I was thanked in the team meeting.';

const browser = await launch({ executablePath: process.env.CHROMIUM ?? undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const until = (page, fn, arg, ms, why) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, async () => (problems.push(typeof why === 'function' ? await why() : why), false));
const sideways = (page, sel) => page.$$eval(sel, (els) => els.filter((e) => {
  if (!e.getClientRects().length) return false;
  const r = e.getBoundingClientRect();
  return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
}).slice(0, 5).map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')} "${(e.textContent ?? '').trim().slice(0, 40)}"`));
/** Buttons, fields, selects and pictures with no name VoiceOver could read. */
const unnamed = (page) => page.$$eval('.modal .pk button, .modal .pk input:not([type=hidden]), .modal .pk textarea, .modal .pk select, .modal .pk canvas, .modal .pk pre', (els) => els.filter((e) => e.getClientRects().length || e.type === 'file').filter((e) => !(e.getAttribute('aria-label') || (e.textContent ?? '').trim() || e.closest('label')?.textContent?.trim())).map((e) => e.outerHTML.slice(0, 80)));

async function phone(viewport) {
  const ctx = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true, ...UK, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => webkitNoise(e) || problems.push(`[${viewport.width}] pageerror: ${e.message}`));
  await page.goto(base, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#pair input', { timeout: 15000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { timeout: 10000 });
  return { ctx, page };
}
async function say(page, words) {
  await page.fill('#cin', words);
  await page.press('#cin', 'Enter');
}
const lastReply = (page) => page.evaluate(() => [...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? '');
const card = (page, prefix) => page.evaluate((p) => [...document.querySelectorAll('#pg-core article.ccard:not(.wall)')].filter((c) => c.dataset.id?.startsWith(p)).map((c) => ({ id: c.dataset.id, title: c.querySelector('.cctitle')?.textContent ?? '', line: c.querySelector('.ccline')?.textContent ?? '', acts: [...c.querySelectorAll('.ccbtn')].map((b) => b.textContent) })).pop() ?? null, prefix);
/** The full chat open (the Ask page shows the latest reply alone; the cards are in the chat). It is a toggle, so only when it is not open yet. */
const openChat = async (page) => {
  if (!(await page.evaluate(() => !!document.querySelector('.hud.core.logopen')))) await page.locator('.logbtn:visible').first().click().catch(() => undefined);
  await page.waitForFunction(() => !!document.querySelector('.hud.core.logopen'), null, { timeout: 8000 }).catch(() => problems.push('the chat did not open'));
  await page.waitForTimeout(300);
};
const closeSheet = (page) => page.evaluate(() => document.querySelector('.modal .mhead button')?.click());
const sheet = (page, screen, W, why) => page.waitForSelector(`.modal [data-screen="${screen}"]`, { timeout: 12000 }).catch(() => problems.push(`[${W}] ${why}`));
/** Click a button that saves a file and read what the phone says it saved. */
async function saves(page, label, W) {
  const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
  await page.click(`.modal .pk button[aria-label="${label}"]`);
  const d = await dl;
  if (!d) problems.push(`[${W}] "${label}" offered no download`);
  await page.waitForTimeout(250);
  return { name: d?.suggestedFilename() ?? '', ...(await page.evaluate(() => ({ ...window.__ghosty.creative.saved }))) };
}

// ---------------------------------------------------------------- 440 × 956
{
  const W = 440;
  const { ctx, page } = await phone(PHONE);

  log('people');
  // PEOPLE: a birthday said in the chat → kept → its card → its two reminders in the Agenda → UNDO takes them away
  await doPack('people', 'forget', { who: 'Dad', words: 'forget Dad' });
  await say(page, "Dad's birthday is 14 March");
  await until(page, () => [...document.querySelectorAll('article.ccard')].some((c) => c.dataset.id?.startsWith('people:bday:')), null, 25000, async () => `[${W}] no birthday card after "Dad's birthday is 14 March": ${await lastReply(page)}`);
  const bc = await card(page, 'people:bday:');
  if (bc && (bc.title !== 'Dad’s birthday' || !/reminders a week before and on the day/.test(bc.line) || JSON.stringify(bc.acts.map((x) => x.toUpperCase())) !== JSON.stringify(['GIFT IDEAS', 'UNDO']))) problems.push(`[${W}] the birthday card: ${JSON.stringify(bc)}`);
  if (!/Kept: Dad’s birthday is 14 March/.test(await lastReply(page))) problems.push(`[${W}] the reply: ${await lastReply(page)}`);
  const jobs = (await api('/agenda')).jobs.filter((j) => j.title === 'Birthday: Dad');
  if (jobs.length !== 2 || new Set(jobs.map((j) => new Date(j.next).toISOString().slice(11, 16))).size !== 1) problems.push(`[${W}] the birthday's reminders in the Agenda: ${JSON.stringify(jobs.map((j) => new Date(j.next).toISOString()))}`);
  await doPack('people', 'note', { words: 'Dad loves fishing' });
  await page.screenshot({ path: `${out}/packs2-birthday-${W}.png` });
  log('who is who');
  await say(page, "who's who");
  await sheet(page, 'who', W, '"who\'s who" did not open the people sheet');
  await page.waitForSelector('.modal .pkperson', { timeout: 8000 }).catch(() => problems.push(`[${W}] no one in the people sheet`));
  const row = await page.evaluate(() => document.querySelector('.modal .pkperson .pklab')?.textContent ?? '');
  if (row !== 'birthday 14 March · loves fishing') problems.push(`[${W}] the person's line: ${row}`);
  await page.click('.modal .pk button[aria-label="Gift ideas for Dad"]');
  await until(page, () => /gift ideas/.test(window.__ghosty?.people?.said ?? '') && /fishing/.test(window.__ghosty.people.said), null, 10000, async () => `[${W}] no gift ideas from the notes: ${await page.evaluate(() => window.__ghosty?.people?.said)}`);
  if (!/not looked up/.test(await page.evaluate(() => window.__ghosty.people.said))) problems.push(`[${W}] the gift ideas did not say the prices were rough guides`);
  await page.screenshot({ path: `${out}/packs2-people-${W}.png` });
  await closeSheet(page);
  await openChat(page);
  await page.locator('#pg-core article.ccard:not(.wall)[data-id^="people:bday:"] .ccbtn', { hasText: /undo/i }).last().click();
  await until(page, async () => (await (await fetch('/api/agenda', { headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789' } })).json()).jobs.every((j) => j.title !== 'Birthday: Dad'), null, 8000, `[${W}] UNDO did not take the birthday's reminders away`);
  const stranger = await doPack('people', 'who', { who: 'Zed' });
  if (!/^I don’t have anyone called Zed\./.test(stranger.text)) problems.push(`[${W}] a name he never gave: ${stranger.text}`);

  log('cover letter');
  // WORK: the CV's facts kept, a pasted ad → the mock model's line → the letter in the chat and in a sheet
  await doPack('work', 'cv', { words: 'clear my cv' });
  await doPack('work', 'cv', { text: CV_TEXT });
  await say(page, `Write me a cover letter for this job: ${AD}`);
  await sheet(page, 'doc', W, 'the cover letter did not open as a document');
  await until(page, () => /Dear Fairfield Foods hiring team/.test(document.querySelector('.modal pre.pkdoc')?.textContent ?? ''), null, 15000, async () => `[${W}] the letter's greeting is not in the sheet: ${await page.evaluate(() => document.querySelector('.modal pre.pkdoc')?.textContent?.slice(0, 200))}`);
  const letter = await page.evaluate(() => document.querySelector('.modal pre.pkdoc')?.textContent ?? '');
  if (!/I served customers on the tills at weekends/.test(letter) || !/I have a full driving licence/.test(letter) || /forklift/i.test(letter.replace(/Left out.*/s, '')) || !/Sam Khan$/.test(letter.trim())) problems.push(`[${W}] the letter is not made from his facts alone: ${letter}`);
  await page.click('.modal .pk button[aria-label="Copy the cover letter"]');
  await until(page, () => (window.__ghosty?.work?.doc?.done ?? '') !== '', null, 4000, `[${W}] COPY said nothing`);
  await page.screenshot({ path: `${out}/packs2-cover-${W}.png` });
  await closeSheet(page);
  await until(page, () => /Cover letter for Customer Assistant/.test([...document.querySelectorAll('#pg-core .msg:not(.me)')].map((m) => m.textContent ?? '').pop() ?? ''), null, 15000, async () => `[${W}] the letter is not in the chat: ${await lastReply(page)}`);
  if (!/Left out, because your CV doesn’t say it: forklift licence/.test(await lastReply(page))) problems.push(`[${W}] the gaps were not said: ${await lastReply(page)}`);

  log('interview');
  // WORK: interview practice, a typed answer timed on the stubbed clock, the critique
  await say(page, 'interview practice for a shop job');
  await sheet(page, 'interview', W, '"interview practice" did not open the practice');
  await until(page, () => window.__ghosty?.work?.interview?.of === 6 && /Tell me about yourself/.test(window.__ghosty.work.interview.question), null, 6000, async () => `[${W}] the questions: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.work?.interview))}`);
  await page.fill('.modal .pk textarea[aria-label="Your answer, typed"]', ANSWER);
  await page.click('.modal .pk button[aria-label="Start the timer for your answer"]');
  await page.evaluate(() => (window.__ghostyClockOffset = 62_000));
  await page.waitForTimeout(600);
  await page.click('.modal .pk button[aria-label="Stop the timer and critique my answer"]');
  await until(page, () => /Length: 6\d seconds/.test(window.__ghosty?.work?.interview?.critique ?? ''), null, 10000, async () => `[${W}] no critique: ${await page.evaluate(() => JSON.stringify(window.__ghosty?.work?.interview))}`);
  const crit = await page.evaluate(() => window.__ghosty.work.interview.critique);
  if (!/Specifics: .*\n.*Shape: .*\n.*Filler: none I could pick out\./s.test(crit) || !/Next time:/.test(crit)) problems.push(`[${W}] the critique's parts: ${crit}`);
  await page.screenshot({ path: `${out}/packs2-interview-${W}.png` });
  await closeSheet(page);
  await page.evaluate(() => (window.__ghostyClockOffset = 0));

  log('pomodoro');
  await say(page, 'start a pomodoro');
  await until(page, () => (window.__ghosty?.timers?.() ?? []).filter((t) => /^pomodoro (focus|break)/.test(t.name)).length === 8, null, 8000, async () => `[${W}] the pomodoro timers: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.timers?.()))}`);
  if (!/Pomodoro: 4 × 25 minutes of focus with 5-minute breaks and a 15-minute long break at the end/.test(await lastReply(page))) problems.push(`[${W}] the pomodoro reply: ${await lastReply(page)}`);
  await say(page, 'stop the pomodoro');
  await until(page, () => (window.__ghosty?.timers?.() ?? []).length === 0, null, 6000, `[${W}] the pomodoro did not stop`);

  log('song');
  // CREATIVE: the mock model writes the words; the tune and chords are made by code, played by a tap, offered as WAV and MIDI
  await say(page, 'Write me a song about a rainy Monday');
  await sheet(page, 'song', W, 'the song did not open');
  await until(page, () => window.__ghosty?.creative?.song?.notes > 30 && /rainy|kettle/i.test(document.querySelector('.modal ol.pklist')?.textContent ?? ''), null, 15000, async () => `[${W}] the song's state: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.creative?.song))}`);
  const song1 = await page.evaluate(() => ({ ...window.__ghosty.creative.song }));
  await page.click('.modal .pk button[aria-label="Play the song"]');
  await until(page, () => window.__ghosty?.creative?.audio === 'running' && window.__ghosty.creative.playing === true, null, 8000, async () => `[${W}] the song did not play (the audio context starts at the tap): ${JSON.stringify(await page.evaluate(() => ({ a: window.__ghosty?.creative?.audio, p: window.__ghosty?.creative?.playing, e: window.__ghosty?.creative?.error })))}`);
  await until(page, () => window.__ghosty.creative.song.line >= 0, null, 6000, `[${W}] no line was lit while it played`);
  await page.screenshot({ path: `${out}/packs2-song-${W}.png` });
  const wav = await saves(page, 'Save the song as a WAV sound file', W);
  if (!/^RIFF.{4}WAVE$/s.test(wav.head) || wav.bytes < 100_000 || !/\.wav$/.test(wav.name)) problems.push(`[${W}] the WAV: ${JSON.stringify(wav)}`);
  const mid = await saves(page, 'Save the song as a MIDI file', W);
  if (!mid.head.startsWith('MThd') || mid.bytes < 300 || !/\.mid$/.test(mid.name)) problems.push(`[${W}] the MIDI: ${JSON.stringify(mid)}`);
  // another tune from the same words is another seed; the song has the same bars
  await page.click('.modal .pk button[aria-label="Make another tune from the same words"]');
  await page.waitForTimeout(500);
  const song2 = await page.evaluate(() => ({ ...window.__ghosty.creative.song }));
  if (song2.seed === song1.seed || song2.bars !== song1.bars) problems.push(`[${W}] another tune: ${JSON.stringify([song1, song2])}`);
  await page.click('.modal .pk button[aria-label="Stop the song"]');
  await closeSheet(page);

  log('poster');
  await say(page, 'A poster for Sam’s birthday party, Saturday 14 November at 7pm at the village hall');
  await sheet(page, 'poster', W, 'the poster did not open');
  await until(page, () => window.__ghosty?.creative?.poster?.drawn >= 1 && window.__ghosty.creative.poster.lines >= 3, null, 12000, async () => `[${W}] the poster was not drawn: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.creative?.poster))}`);
  const px = await page.evaluate(() => {
    const c = document.querySelector('.modal canvas.pkcanvas');
    const g = c.getContext('2d');
    const seen = new Set();
    for (let i = 0; i < 40; i++) seen.add(Array.from(g.getImageData(Math.floor((i * c.width) / 40), Math.floor((i * 7919) % c.height), 1, 1).data).join(','));
    return { w: c.width, h: c.height, colours: seen.size, label: c.getAttribute('aria-label') };
  });
  if (px.w !== 1080 || px.h !== 1528 || px.colours < 3 || !/birthday party/i.test(px.label)) problems.push(`[${W}] the poster's canvas: ${JSON.stringify(px)}`);
  const poster = await page.evaluate(() => ({ ...window.__ghosty.creative.poster }));
  if (poster.theme !== 'party' || !/^Sam’s birthday party$/.test(poster.title)) problems.push(`[${W}] the poster's fields: ${JSON.stringify(poster)}`);
  await page.screenshot({ path: `${out}/packs2-poster-${W}.png` });
  const png = await saves(page, 'Save the poster as a PNG picture', W);
  if (!png.head.startsWith('.PNG') || png.bytes < 8000 || !/\.png$/.test(png.name)) problems.push(`[${W}] the poster's PNG: ${JSON.stringify(png)}`);
  await closeSheet(page);

  log('comic');
  await say(page, 'A comic about a cat who learns to drive');
  await sheet(page, 'comic', W, 'the comic strip did not open');
  await until(page, () => window.__ghosty?.creative?.comic?.drawn >= 1 && window.__ghosty.creative.comic.captions.length === 4, null, 12000, async () => `[${W}] the comic was not drawn: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.creative?.comic))}`);
  const caps = await page.evaluate(() => window.__ghosty.creative.comic.captions);
  if (caps[0] !== 'A cat sits in the driver’s seat.' || caps[3] !== 'Off it goes, laughing, tail out of the window.') problems.push(`[${W}] the comic's captions are not the ones the model wrote: ${JSON.stringify(caps)}`);
  if (!/^A four-panel comic: 1, /.test(await page.evaluate(() => document.querySelector('.modal canvas.pkcanvas')?.getAttribute('aria-label') ?? ''))) problems.push(`[${W}] the comic's picture has no description`);
  if (!/Drawn by Ghosty in code: stick figures and shapes of our own/.test(await page.evaluate(() => document.querySelector('.modal .pk')?.textContent ?? ''))) problems.push(`[${W}] the comic does not say it is ours`);
  await page.screenshot({ path: `${out}/packs2-comic-${W}.png` });
  const comicPng = await saves(page, 'Save the comic strip as a PNG picture', W);
  if (!comicPng.head.startsWith('.PNG') || comicPng.bytes < 8000) problems.push(`[${W}] the comic's PNG: ${JSON.stringify(comicPng)}`);
  await closeSheet(page);

  log('beat');
  await say(page, 'make a beat');
  await sheet(page, 'beat', W, '"make a beat" did not open the drum pads');
  await page.click('.modal .pk button[aria-label="Play the beat as a loop"]');
  await until(page, () => window.__ghosty?.creative?.audio === 'running' && window.__ghosty.creative.beat.playing === true, null, 8000, async () => `[${W}] the beat did not play: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.creative?.beat))}`);
  const hits0 = await page.evaluate(() => window.__ghosty.creative.beat.hits);
  await page.click('.modal .pk button[aria-label="clap pad: tap along with the loop"]');
  await page.waitForTimeout(300);
  await page.click('.modal .pk button[aria-label="clap pad: tap along with the loop"]');
  await until(page, (h) => window.__ghosty.creative.beat.hits > h && window.__ghosty.creative.beat.taps >= 2, hits0, 5000, async () => `[${W}] the taps did not land on the grid: ${JSON.stringify(await page.evaluate(() => window.__ghosty.creative.beat))}`);
  await page.click('.modal .pk button[aria-label="hat, step 2"]');
  if ((await page.getAttribute('.modal .pk button[aria-label="hat, step 2"]', 'aria-pressed')) !== 'true') problems.push(`[${W}] a step square did not switch on`);
  await page.screenshot({ path: `${out}/packs2-beat-${W}.png` });
  const bw = await saves(page, 'Save four bars of the beat as a WAV sound file', W);
  if (!/^RIFF.{4}WAVE$/s.test(bw.head) || bw.bytes < 100_000) problems.push(`[${W}] the beat's WAV: ${JSON.stringify(bw)}`);
  await page.click('.modal .pk button:has-text("Save beat")');
  await until(page, async () => /Kept “my beat”|Kept “/.test((await (await fetch('/api/packs/do', { method: 'POST', headers: { 'x-ghosty': '1', 'x-ghosty-key': 'preview-owner-key-0123456789', 'content-type': 'application/json' }, body: JSON.stringify({ pack: 'creative', action: 'beat', args: { words: 'my beats' } }) })).json()).text ?? '') || true, null, 4000, '');
  const mine = await doPack('creative', 'beat', { words: 'my beats' });
  if (!/Your beats: /.test(mine.text)) problems.push(`[${W}] the brain did not keep the beat: ${mine.text}`);
  await page.click('.modal .pk button:has-text("Stop")');
  await closeSheet(page);

  log('card, logo, palette');
  await page.evaluate(() => window.__ghosty.run('open_creative', { what: 'birthday', name: 'Dad', age: 70, message: 'Happy birthday, Dad! Love from all of us.' }));
  await sheet(page, 'birthday', W, 'the birthday card did not open');
  await until(page, () => window.__ghosty?.creative?.card?.drawn >= 1, null, 8000, `[${W}] the card was not drawn`);
  const front = await saves(page, 'Save the front of the card as a PNG', W);
  const inner = await saves(page, 'Save the inside of the card as a PNG', W);
  if (!front.head.startsWith('.PNG') || !inner.head.startsWith('.PNG') || front.name === inner.name) problems.push(`[${W}] the card's PNGs: ${JSON.stringify([front, inner])}`);
  await closeSheet(page);
  await page.evaluate(() => window.__ghosty.run('open_creative', { what: 'logo', name: 'Harbour Bakery', vibe: 'calm' }));
  await sheet(page, 'logo', W, 'the logo did not open');
  await until(page, () => window.__ghosty?.creative?.logo?.name === 'Harbour Bakery' && window.__ghosty.creative.logo.icon === 'wave', null, 8000, async () => `[${W}] the logo: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.creative?.logo))}`);
  const svg = await saves(page, 'Save the logo as an SVG file', W);
  if (!svg.head.startsWith('<svg xmlns=') || !/\.svg$/.test(svg.name)) problems.push(`[${W}] the logo's SVG: ${JSON.stringify(svg)}`);
  await page.screenshot({ path: `${out}/packs2-logo-${W}.png` });
  await closeSheet(page);
  await page.evaluate(() => window.__ghosty.run('open_creative', { what: 'palette', colours: [] }));
  await sheet(page, 'palette', W, 'the palette maker did not open');
  // a picture made here (red, blue and white), handed to the photo field as a picked file: its colours are found on the phone
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = c.height = 120;
    const g = c.getContext('2d');
    g.fillStyle = '#c8202a';
    g.fillRect(0, 0, 120, 70);
    g.fillStyle = '#1e3cbe';
    g.fillRect(0, 70, 120, 35);
    g.fillStyle = '#f5f5f0';
    g.fillRect(0, 105, 120, 15);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'flag.png', { type: 'image/png' }));
    const input = document.querySelector('.modal input[type=file]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change'));
  });
  await until(page, () => window.__ghosty?.creative?.palette?.swatches?.length >= 3, null, 10000, async () => `[${W}] no palette from the picture: ${JSON.stringify(await page.evaluate(() => window.__ghosty?.creative?.palette))}`);
  const pal = await page.evaluate(() => window.__ghosty.creative.palette);
  if (pal.from !== 'a photo' || pal.swatches[0].name !== 'Red' || pal.swatches[0].share < 50) problems.push(`[${W}] the palette: ${JSON.stringify(pal)}`);
  await page.screenshot({ path: `${out}/packs2-palette-${W}.png` });
  await closeSheet(page);
  await ctx.close();
}

// ---------------------------------------------------------------- 390 × 844: every sheet, nothing sideways, everything named
{
  const W = 390;
  const { ctx, page } = await phone({ width: 390, height: 844 });
  await doPack('people', 'note', { words: 'Dad loves fishing' });
  await doPack('work', 'todo', { text: 'Right, I need to ring the plumber about the boiler and send the invoice to Mrs Patel by Friday. Also buy milk.' });
  await doPack('people', 'plan', { words: 'plan: pub on Friday at 8pm at the Crown, asked Ali, Sam and Jo. Ali yes, Sam can’t make it' });
  const sheets = [
    ['open_people', { what: 'who' }, 'who'],
    ['open_people', { what: 'plan' }, 'plan'],
    ['open_work', { what: 'doc', title: 'YOUR CV', text: 'SAM KHAN\nLeeds\n\nEXPERIENCE\n- Worked at Tesco', kind: 'cv' }, 'doc'],
    ['open_work', { what: 'doc', title: 'EMAIL DRAFT', text: 'Subject: Running late\n\nHello,\n\nI am running late.', kind: 'email', mailto: 'mailto:?subject=x' }, 'doc'],
    ['open_work', { what: 'interview', questions: ['Tell me about yourself.', 'Why do you want this job?'] }, 'interview'],
    ['open_work', { what: 'todo' }, 'todo'],
    ['open_creative', { what: 'song', lyrics: 'The kettle sings at half past six\nA grey sky leans against the glass\nI hum along to nothing much\nAnd let the Monday pass', key: 'D', mode: 'minor', tempo: 90, seed: 4 }, 'song'],
    ['open_creative', { what: 'poster', title: 'Annual summer fete and charity bake sale', subtitle: 'Sat 4 Jul · 11am', lines: ['The village green', 'Bring the family'], theme: 'nature' }, 'poster'],
    ['open_creative', { what: 'birthday', name: 'Samantha', age: 40, message: 'Happy birthday, Sam! Hope today is a really good one.' }, 'birthday'],
    ['open_creative', { what: 'comic', captions: ['A cat sits at the window.', 'A bird lands.', 'The cat plans something.', 'It is much too slow.'], names: ['Tom'] }, 'comic'],
    ['open_creative', { what: 'logo', name: 'Harbour Bakery', vibe: 'calm' }, 'logo'],
    ['open_creative', { what: 'palette', colours: ['#3a7bd5', '#d5883a', '#3ad59d'] }, 'palette'],
    ['open_creative', { what: 'beat' }, 'beat'],
  ];
  for (const [cmd, args, screen] of sheets) {
    log(`390: ${cmd} ${screen}`);
    await page.evaluate(([c, a]) => window.__ghosty.run(c, a), [cmd, args]);
    if (!(await page.waitForSelector(`.modal [data-screen="${screen}"]`, { timeout: 10000 }).catch(() => null))) {
      problems.push(`[${W}] ${cmd} ${JSON.stringify(args).slice(0, 60)} did not open ${screen}`);
      continue;
    }
    await page.waitForTimeout(500);
    const side = await sideways(page, '.modal .pk, .modal .pk *');
    if (side.length) problems.push(`[${W}] ${cmd} ${screen}: sideways: ${side.join('; ')}`);
    const named = await unnamed(page);
    if (named.length) problems.push(`[${W}] ${cmd} ${screen}: unnamed for VoiceOver: ${named.join('; ')}`);
    if (screen === 'todo') {
      const boxes = await page.$$('.modal .pkitems input[type=checkbox]');
      if (boxes.length < 3) problems.push(`[${W}] the to-do list shows ${boxes.length} jobs, not 3`);
      else {
        await boxes[0].click();
        await until(page, () => window.__ghosty.work.todo.filter((t) => t.done).length === 1, null, 6000, async () => `[${W}] ticking a job did not reach the brain: ${JSON.stringify(await page.evaluate(() => window.__ghosty.work.todo))}`);
      }
    }
    if (screen === 'plan' && !/^Pub$/.test(await page.evaluate(() => document.querySelector('.modal .pkmid')?.textContent ?? 'x'))) problems.push(`[${W}] the plan sheet does not show the plan`);
    await page.screenshot({ path: `${out}/packs2-${screen}-${W}-${sheets.indexOf(sheets.find((s) => s[0] === cmd && s[2] === screen && JSON.stringify(s[1]) === JSON.stringify(args)))}.png` });
    await closeSheet(page);
    await page.waitForTimeout(250);
  }
  // the live regions VoiceOver reads as they change: the critique, the status of a save, the timer on an answer
  await page.evaluate(() => window.__ghosty.run('open_work', { what: 'interview' }));
  await page.waitForSelector('.modal [data-screen="interview"]');
  if (!(await page.$('.modal .pk pre.pkdoc[aria-live="polite"]')) || !(await page.$('.modal .pk [role="timer"]'))) problems.push(`[${W}] the critique and the timer are not live regions`);
  await closeSheet(page);
  await ctx.close();
}

// what this spec kept in the preview's brain goes, so the specs after it start as they would
await doPack('people', 'forget', { who: 'Dad', words: 'forget Dad' }).catch(() => undefined);
await doPack('people', 'plan', { words: 'cancel the plan' }).catch(() => undefined);
await doPack('work', 'cv', { words: 'clear my cv' }).catch(() => undefined);
await doPack('work', 'todo', { words: 'clear my to-do list' }).catch(() => undefined);

await browser.close();
console.log(`(packs2 spec: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
if (problems.length) {
  console.log(`PROBLEMS:\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('Packs 2 run clean: a birthday said in the chat was kept with its card and two reminders, UNDO took them away, who’s who showed gift ideas from what was said and a stranger’s name was not looked up; a cover letter came from a pasted ad and the CV’s facts alone, in the chat and in a sheet; interview practice timed an answer and critiqued it; a pomodoro set eight timers and stopped; a song was written, its tune made by code, played by a tap and saved as a WAV and a MIDI file; a poster, a comic strip, a birthday card and a logo were drawn and saved (PNG, SVG) with their headers right; a palette came from a picture; the drum pads took taps; every sheet fits 390 × 844 and every control is named.');
