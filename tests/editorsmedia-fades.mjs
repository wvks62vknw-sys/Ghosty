// FADE LENGTHS AND COLOUR OVER TIME (NEXT ROUND, editors.u9; against CapCut and LumaFusion), on a still photo laid in as a clip (editors.s5): each clip's fade has its own length, 0.1 s up
// to the clip's cap, and the grade takes keys at the playhead so the colour moves over time (position, size and see-through already did).
// Proved end to end with the player's own pixels: a short fade lifts sooner than the default one; a grade keyed dark at the start and
// bright later is dark, then halfway, then bright along the clip; UNDO takes a key back; the keys and the fade are kept when the app is
// opened again; CLEAR THE GRADE KEYS holds the grade at the playhead. The export draws the same frame plan (compose.ts gradeAt; the brain
// test proves gradeAt). Then the GRADE tray with keys in all seven looks at 440 × 956, The Scan at 390 × 844 and BODY 21.
// Run by tests/editorsmedia.spec.mjs (PARTS=fades).
import { jpeg, videoKit } from './mediakit.mjs';

export default async function (h) {
  const { browser, base, open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const lum = (c) => (c ? c[0] + c[1] + c[2] : -1);
  let clips;

  {
    const { ctx, page } = await open({ look: LOOKS.scan, viewport: PHONE });
    // a still photo as the clip (the video editor takes photos now, editors.s5): the same picture every frame, so each pixel read is exact
    clips = [{ name: 'IMG_SKY.jpg', mimeType: 'image/jpeg', buffer: await jpeg(page, 640, 360, 0) }];
    const V = videoKit(h, page);
    await V.toVideo();
    check(await V.addClips(clips), 'fades: the clip is in the strip');
    const L = await page.evaluate(() => window.__ghosty.video.state().length);
    check(L === 3000, `fades: a photo lies on the timeline as a 3 s still clip (${L} ms)`);
    const at = (f) => Math.round(L * f);
    check(await V.select(0), 'fades: the clip is chosen');
    await V.pill('transition');
    check(!(await page.locator('.vdtray input[aria-label="Fade in length"]').count()), 'fades: no length slider before a fade is on');
    await V.key('FADE IN').click();
    const def = await page.evaluate(() => Math.min(1000, Math.min(2000, Math.floor(window.__ghosty.video.state().length / 3))));
    check(await until(page, (d) => window.__ghosty.video.project().main[0].fade?.in === d, def, 5000), `fades: FADE IN is one second by default (or a third of a short clip): ${def} ms`);
    check(await page.locator('.vdtray input[aria-label="Fade in length"]').count() === 1, 'fades: the fade in’s length slider is there');
    const max = Number(await page.locator('.vdtray input[aria-label="Fade in length"]').getAttribute('max'));
    const cap = await page.evaluate(() => Math.min(2000, Math.floor(window.__ghosty.video.state().length / 3)));
    check(Math.abs(max - cap) <= 1 && Number(await page.locator('.vdtray input[aria-label="Fade in length"]').getAttribute('min')) === 100, `fades: it runs from 0.1 s to the clip’s cap (${max} ms; a third of the clip)`);
    await V.seek(400);
    const at400long = lum(await V.px(0.2, 0.2));
    check(await V.slide('Fade in length', 300), 'fades: the length slider is moved to 0.3 s');
    check(await until(page, () => window.__ghosty.video.project().main[0].fade?.in === 300, null, 5000), 'fades: the clip’s fade in is 0.3 s');
    check(/rises from black over 0\.3 s/.test(await V.line()), `fades: said in his words ("${await V.line()}")`);
    await V.seek(150);
    const at150 = lum(await V.px(0.2, 0.2));
    await V.seek(400);
    const at400 = lum(await V.px(0.2, 0.2));
    await V.seek(at(0.6));
    const plain = lum(await V.px(0.2, 0.2));
    check(at150 > 0.3 * plain && at150 < 0.7 * plain, `fades: halfway into the 0.3 s fade the picture is about half up (${at150} of ${plain})`);
    check(Math.abs(at400 - plain) < 0.08 * plain && at400long < 0.6 * plain, `fades: at 0.4 s the short fade is done, where the one-second fade was not (${at400} against ${at400long}, plain ${plain})`);
    await page.click('.vdundo');
    check(await until(page, (d) => window.__ghosty.video.project().main[0].fade?.in === d, def, 5000), 'fades: UNDO puts the default fade back');
    await page.click('.vdredo');
    check(await until(page, () => window.__ghosty.video.project().main[0].fade?.in === 300, null, 5000), 'fades: REDO the 0.3 s fade');

    // the grade over time: a key at the start, a brighter grade at 3 s
    await V.pill('grade');
    const said0 = (await page.locator('.vdgradekeys').textContent()) ?? '';
    check(/No grade keys/.test(said0), `fades: GRADE says the grade holds for the whole clip until it is keyed ("${said0}")`);
    await V.seek(at(0.25));
    await V.slide('Exposure', -1);
    await until(page, () => window.__ghosty.video.project().main[0].grade.exposure === -1, null, 5000);
    await V.key('KEY THE GRADE AT THE PLAYHEAD').click();
    check(await until(page, () => (window.__ghosty.video.project().main[0].gradeKeys?.length ?? 0) === 2, null, 5000), 'fades: KEY THE GRADE keys the clip’s start and the playhead');
    check(/A grade key at/.test(await V.line()), `fades: the key is said ("${await V.line()}")`);
    await V.seek(at(0.75));
    check(/2 grade keys/.test((await page.locator('.vdgradekeys').textContent()) ?? ''), 'fades: the tray follows the playhead and says how many keys');
    await V.slide('Exposure', 1);
    check(await until(page, () => (window.__ghosty.video.project().main[0].gradeKeys?.length ?? 0) === 3, null, 5000), 'fades: a slider moved at another time adds a key there');
    const k = (await V.proj()).main[0].gradeKeys;
    check(k[0].g.exposure === -1 && k[1].g.exposure === -1 && k[2].g.exposure === 1 && Math.abs(k[2].t - at(0.75)) < 60, `fades: dark at the start and a quarter in, bright three quarters in (${k.map((x) => `${x.t}:${x.g.exposure}`).join(' ')})`);
    await V.seek(at(0.25));
    const dark = lum(await V.px(0.2, 0.2));
    await V.seek(at(0.5));
    const half = lum(await V.px(0.2, 0.2));
    await V.seek(at(0.8));
    const bright = lum(await V.px(0.2, 0.2));
    check(dark < half && half < bright && bright > dark + 120, `fades: the colour moves over time in the player: ${dark} → ${half} → ${bright}`);
    await page.click('.vdundo');
    check(await until(page, () => (window.__ghosty.video.project().main[0].gradeKeys?.length ?? 0) === 2, null, 5000), 'fades: UNDO takes the last key back');
    await page.click('.vdredo');
    check(await until(page, () => (window.__ghosty.video.project().main[0].gradeKeys?.length ?? 0) === 3, null, 5000), 'fades: REDO puts it back');

    // the round trip: kept, the app opened again, the keys and the fade there
    check(await until(page, () => window.__ghosty.video.state().savedAt === window.__ghosty.video.project().at, null, 10000), 'fades: the project is saved on the phone');
    const kept = JSON.stringify({ k: (await V.proj()).main[0].gradeKeys, f: (await V.proj()).main[0].fade });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => undefined);
    await V.toVideo();
    check(await until(page, () => document.querySelectorAll('.vdtile').length === 1, null, 30000), 'fades: the project opens again');
    const back = JSON.stringify({ k: (await V.proj()).main[0].gradeKeys, f: (await V.proj()).main[0].fade });
    check(back === kept, 'fades: the grade keys and the fade length are kept');
    check(await V.select(0), 'fades: the clip is chosen again');
    await V.pill('grade');
    await V.seek(at(0.5));
    await V.key('CLEAR THE GRADE KEYS').click();
    check(await until(page, () => !window.__ghosty.video.project().main[0].gradeKeys && Math.abs(window.__ghosty.video.project().main[0].grade.exposure) < 0.05, null, 5000), 'fades: CLEAR THE GRADE KEYS holds the grade at the playhead (halfway: about 0)');
    check(/grade keys are cleared/.test(await V.line()), 'fades: and says so');
    // FREEZE FRAME (the sweep, against CapCut): the picture at the playhead held for 2 s between the two halves of the clip
    await V.pill('split');
    await V.seek(1500);
    await V.key('FREEZE FRAME \\(2 S\\)').click();
    const froze = await until(page, () => window.__ghosty.video.project().main.length === 3, null, 30000);
    check(froze, `freeze: FREEZE FRAME splits the clip and lays the still between the halves ("${await V.line()}")`);
    const fz = await V.proj();
    if (froze) {
    check(fz.sources[fz.main[1].src].kind === 'image' && fz.main[1].out - fz.main[1].in === 2000 && JSON.stringify(fz.main[1].grade) === JSON.stringify(fz.main[0].grade), 'freeze: the still lasts 2 s and keeps the clip’s grade');
    check(/A freeze frame of 2 s at 0:01\.5, between the two halves of the clip\. UNDO takes it out\./.test(await V.line()), `freeze: said in his words ("${await V.line()}")`);
    await page.click('.vdundo');
    check(await until(page, () => window.__ghosty.video.project().main.length === 1, null, 5000), 'freeze: UNDO takes it out');
    }
    await ctx.close();
  }
}
