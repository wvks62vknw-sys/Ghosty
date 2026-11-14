// A PHOTO FILM WITH MUSIC (NEXT ROUND, editors.s5; against CapCut's and iMovie's photo slideshows): the video editor takes still photos as
// clips, and PROJECT → PHOTO FILM makes a new video of picked photos cut to a song's beat. Proved end to end: the states in his words
// before anything is picked; three photos and a click track at 120 beats a minute make three clips of whole beats (four beats, 2 s each),
// the song laid under them from its first beat, each photo drifting (a slow zoom); the photo is what the player draws; UNDO takes the film
// back to the empty video and REDO puts it again; the film is kept when the app is opened again. Run by tests/editorsmedia.spec.mjs
// (PARTS=film).
import { ask, jpeg, videoKit } from './mediakit.mjs';

/** A click track: `bpm` clicks a minute over a quiet hum, `offset` s before the first (as video2.spec's). */
function clickWav(bpm, secs, rate = 22050, offset = 0.12) {
  const n = Math.round(secs * rate);
  const b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0);
  b.writeUInt32LE(36 + n * 2, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(n * 2, 40);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = 0.02 * Math.sin((2 * Math.PI * 110 * i) / rate);
  for (let t = offset; t < secs - 0.05; t += 60 / bpm) {
    const s0 = Math.round(t * rate);
    for (let k = 0; k < 440 && s0 + k < n; k++) x[s0 + k] += 0.8 * Math.exp(-k / 120) * Math.sin((2 * Math.PI * 2000 * k) / rate);
  }
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x[i])) * 32767), 44 + i * 2);
  return b;
}

export default async function (h) {
  const { open, check, until, LOOKS, PHONE } = h;
  const { ctx, page } = await open({ look: LOOKS.scan, viewport: PHONE });
  // (a fresh phone with no photo yet: the chat's photo change says to open one first; the approve part proves the rest of it)
  const rep = await ask(page, 'make this picture warmer', /Open a photo first/);
  check(rep.ok, `approve: with no photo yet the chat says to open one first ("${rep.text.slice(0, 120)}")`);
  const V = videoKit(h, page);
  await V.toVideo();
  const filmKey = page.locator('.vdfilmkey');
  check(await filmKey.count() === 1, 'film: the empty video offers MAKE A PHOTO FILM');
  await filmKey.click();
  await page.waitForFunction(() => document.querySelector('.vd')?.dataset.tool === 'project');
  const said0 = (await page.locator('.vdfilmsay').textContent()) ?? '';
  check(/No photos picked yet, and no song \(each photo gets two seconds\)\./.test(said0), `film: before anything is picked it says so ("${said0}")`);
  await page.locator('.vdmakefilm').click();
  check(/Pick the photos first/.test(await V.line()), `film: MAKE THE FILM with no photos asks for them ("${await V.line()}")`);
  const photos = [];
  for (const [i, tint] of [0, 60, 120].entries()) photos.push({ name: `IMG_${i + 1}.jpg`, mimeType: 'image/jpeg', buffer: await jpeg(page, 640, 360, tint) });
  await page.setInputFiles('input[data-pick="filmphotos"]', photos);
  await page.setInputFiles('input[data-pick="filmsong"]', { name: 'click120.wav', mimeType: 'audio/wav', buffer: clickWav(120, 12) });
  check(await until(page, () => /3 photos picked, and the song “click120\.wav”\./.test(document.querySelector('.vdfilmsay')?.textContent ?? ''), null, 5000), 'film: the three photos and the song are said before the film is made');
  await page.locator('.vdmakefilm').click();
  check(await until(page, () => !!window.__ghosty.video.state().film, null, 60000), 'film: the film is made');
  const f = (await page.evaluate(() => window.__ghosty.video.state().film));
  check(f.photos === 3 && Math.abs(f.bpm - 120) <= 2, `film: three photos, the beat found at about 120 a minute (${f.bpm})`);
  check(/^A photo film of 3 photos, [^,]+, cut on the beat \(about 1(19|20|21) beats a minute\)\. EXPORT makes the file\.$/.test(f.said), `film: said in his words ("${f.said}")`);
  const p = await V.proj();
  const lens = p.main.map((c) => c.out - c.in);
  check(p.main.length === 3 && lens.every((l) => Math.abs(l - 2000) <= 40), `film: each photo holds for four beats, 2 s (${lens.join(', ')} ms)`);
  check(p.main.every((c) => p.sources[c.src].kind === 'image' && (c.tr.keys.scale?.length ?? 0) === 2), 'film: each clip is a still photo with its slow zoom');
  check(p.music.length === 1 && Math.abs(p.music[0].in - 120) <= 60 && p.music[0].start === 0, `film: the song lies under it from its first beat (${p.music[0]?.in} ms in)`);
  check(p.name === 'Photo film', 'film: a new video, named Photo film');
  await V.seek(500);
  const px = await V.px(0.5, 0.15);
  check(px[2] > px[0] + 40, `film: the player draws the first photo (its sky: ${px.slice(0, 3)})`);
  await page.click('.vdundo');
  check(await until(page, () => window.__ghosty.video.project().main.length === 0, null, 5000), 'film: UNDO takes the film back to the empty video');
  await page.click('.vdredo');
  check(await until(page, () => window.__ghosty.video.project().main.length === 3, null, 5000), 'film: REDO puts it again');
  check(await until(page, () => window.__ghosty.video.state().savedAt === window.__ghosty.video.project().at, null, 10000), 'film: the film is saved on the phone');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => undefined);
  await V.toVideo();
  check(await until(page, () => document.querySelectorAll('.vdtile').length === 3 && window.__ghosty.video.project().music.length === 1, null, 30000), 'film: opened again, the three photos and the song are there');
  await V.seek(500);
  const px2 = await V.px(0.5, 0.15);
  check(px2[2] > px2[0] + 40, `film: and the player draws the photo again (${px2.slice(0, 3)})`);
  await ctx.close();
}
