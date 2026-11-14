// THE EDITORS LANE, VIDEO (against CapCut / iMovie): DUPLICATE CLIP in ORDER lays a copy of the chosen clip straight after it (the same
// source, nothing new stored), said in his words; UNDO takes it out and REDO puts it back; the project, left and opened again, holds the
// copy; MOVE LEFT on the first clip and MOVE RIGHT on the last are greyed with the reason in their names (they did nothing before). Then
// the editor on its ORDER tray in all seven looks at 440 × 956, The Scan at 390 × 844, and at BODY 21: every key 44 pt, nothing sideways,
// no words cut. Run by tests/editorslane.spec.mjs (PARTS=video).

/** Short clips drawn and recorded on a page of their own, one after another (as tests/video.spec.mjs makes its clips). */
async function makeClips(browser, base, specs) {
  const made = [];
  for (const s of specs) {
    const gp = await browser.newPage();
    await gp.goto(base, { waitUntil: 'domcontentloaded' });
    await gp.bringToFront();
    made.push(await gp.evaluate(async (s) => {
      const type = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const g = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 800_000 });
      const parts = [];
      rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
      const stopped = new Promise((ok) => (rec.onstop = ok));
      const t0 = performance.now();
      const draw = () => {
        const t = (performance.now() - t0) / 1000;
        g.fillStyle = s.colour;
        g.fillRect(0, 0, 640, 360);
        g.fillStyle = 'white';
        g.fillRect((t * 120) % 560, 140, 60, 60);
      };
      const iv = setInterval(draw, 33);
      draw();
      rec.start(250);
      await new Promise((r) => setTimeout(r, s.secs * 1000));
      clearInterval(iv);
      rec.stop();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      const buf = new Uint8Array(await new Blob(parts, { type }).arrayBuffer());
      let bin = '';
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { name: s.name, type: type.split(';')[0], b64: btoa(bin) };
    }, s));
    await gp.close();
  }
  return made.map((m) => ({ name: m.name, mimeType: m.type, buffer: Buffer.from(m.b64, 'base64') }));
}

export default async function (h) {
  const { browser, base, open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const clips = await makeClips(browser, base, [{ name: 'red.mp4', secs: 2, colour: 'rgb(220,40,40)' }, { name: 'green.mp4', secs: 2, colour: 'rgb(40,200,60)' }]);
  check(clips.every((c) => c.buffer.length > 1000), `video: two clips drawn on the phone (${clips.map((c) => c.buffer.length).join(', ')} bytes)`);
  const fileInput = '#pg-video .vdsheet > .vd > input[type=file]';
  const toVideo = async (page) => {
    await page.evaluate(() => (location.hash = 'video'));
    await page.waitForSelector('#pg-video .vd', { timeout: 20000 });
  };
  const proj = (page) => page.evaluate(() => window.__ghosty.video.project());
  const line = (page) => page.locator('.vdline').textContent().then((t) => t ?? '');
  const key = (page, text) => page.locator('.vd button').filter({ hasText: new RegExp(`^\\s*${text}\\s*$`, 'i') }).first();
  const pill = async (page, t) => {
    await page.click(`.vdpill[data-tool="${t}"]`);
    await page.waitForFunction((x) => document.querySelector('.vd')?.dataset.tool === x, t);
  };
  /** A tap on the i-th clip (the strip is drawn again as the clip loads, so the tile is found at the moment of the tap). */
  const select = async (page, i) => {
    await page.waitForSelector(`.vdtile[data-index="${i}"]`, { timeout: 15000 });
    const id = await page.evaluate((i) => {
      const t = document.querySelector(`.vdtile[data-index="${i}"]`);
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = t.getBoundingClientRect();
      t.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
      return t.dataset.id;
    }, i);
    return until(page, (want) => window.__ghosty.video.state().selected === want, id, 5000);
  };
  const addClips = async (page, list) => {
    await page.setInputFiles(fileInput, list);
    return until(page, (n) => document.querySelectorAll('.vdtile').length >= n, list.length, 60000);
  };

  // ---- DUPLICATE CLIP, undo, redo, the round trip, and the moves greyed at the ends
  {
    const { ctx, page } = await open({ look: LOOKS.scan, viewport: PHONE });
    await toVideo(page);
    const empty = (await page.locator('.vdempty1').textContent()) ?? '';
    check(/No video yet/.test(empty), `video: the empty editor says so ("${empty}")`);
    check(await addClips(page, clips), 'video: both clips are in the strip');
    check(await select(page, 0), 'video: the first clip is chosen');
    await pill(page, 'order');
    const left = key(page, 'MOVE LEFT');
    check(await left.isDisabled() && /already at that end/.test((await left.getAttribute('aria-label')) ?? ''), 'video: MOVE LEFT is greyed on the first clip, its name saying why');
    const p0 = await proj(page);
    await key(page, 'DUPLICATE CLIP').click();
    check(await until(page, (n) => window.__ghosty.video.project().main.length === n + 1, p0.main.length, 5000), 'video: DUPLICATE CLIP adds one clip');
    let p = await proj(page);
    check(p.main[1].src === p0.main[0].src && p.main[1].in === p0.main[0].in && p.main[1].out === p0.main[0].out && p.main[1].id !== p0.main[0].id && Object.keys(p.sources).length === Object.keys(p0.sources).length,
      'video: the copy is the same stretch of the same source, straight after it, and nothing new is stored');
    check(/A copy of clip 1 is in place 2, right after it\. UNDO takes it out\./.test(await line(page)), `video: the copy is said in his words ("${await line(page)}")`);
    await page.click('.vdundo');
    check(await until(page, (n) => window.__ghosty.video.project().main.length === n, p0.main.length, 5000), 'video: UNDO takes the copy out');
    await page.click('.vdredo');
    check(await until(page, (n) => window.__ghosty.video.project().main.length === n + 1, p0.main.length, 5000), 'video: REDO puts the copy back');
    // the round trip: kept (a save after the REDO), the app opened again, the copy still there
    check(await until(page, () => window.__ghosty.video.state().savedAt === window.__ghosty.video.project().at, null, 10000), 'video: the project as it is now is saved on the phone');
    const kept = (await proj(page)).main.map((c) => c.src).join();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => undefined);
    await toVideo(page);
    check(await until(page, () => document.querySelectorAll('.vdtile').length === 3, null, 30000), 'video: the project opens again with the copy');
    p = await proj(page);
    check(p.main.map((c) => c.src).join() === kept, 'video: the clips reopen in the same order');
    check(await select(page, 2), 'video: the last clip is chosen');
    await pill(page, 'order');
    check(await key(page, 'MOVE RIGHT').isDisabled(), 'video: MOVE RIGHT is greyed on the last clip');
    check(!(await key(page, 'MOVE LEFT').isDisabled()), 'video: MOVE LEFT is live on the last clip');

    // FADE IN on the first clip: the picture rises from black (the player's own pixel, at the clip's first frame and after the fade)
    const px = (fx, fy) => page.evaluate(([x, y]) => window.__ghosty.video.pixel(x, y), [fx, fy]);
    const seek = (ms) => page.evaluate((t) => window.__ghosty.video.seek(t), ms);
    const lum = (c) => (c ? c[0] + c[1] + c[2] : -1);
    check(await select(page, 0), 'video: the first clip is chosen again');
    await pill(page, 'transition');
    await seek(1500);
    const plain0 = await px(0.1, 0.1);
    await key(page, 'FADE IN').click();
    check(await until(page, () => !!window.__ghosty.video.project().main[0].fade?.in, null, 5000), 'video: FADE IN is kept on the clip');
    check(/rises from black/.test(await line(page)), `video: the fade is said in his words ("${await line(page)}")`);
    await seek(0);
    const dark = await px(0.1, 0.1);
    await seek(1500);
    const lit = await px(0.1, 0.1);
    check(lum(dark) >= 0 && lum(dark) < 60 && lum(lit) > lum(dark) + 120 && Math.abs(lum(lit) - lum(plain0)) < 40, `video: the first frame is black under FADE IN and the clip is itself after it (${dark} → ${lit}; without the fade ${plain0})`);
    await page.click('.vdundo');
    check(await until(page, () => !window.__ghosty.video.project().main[0].fade, null, 5000), 'video: UNDO takes the fade off');
    await ctx.close();
  }

  // ---- every look at 440, The Scan at 390 and at BODY 21: the editor with a clip, on its ORDER tray
  const runs = [...Object.keys(LOOKS).map((k) => ({ k, vp: PHONE, big: false })), { k: 'scan', vp: SMALL, big: false }, { k: 'scan', vp: PHONE, big: true }];
  for (const { k, vp, big } of runs) {
    const where = `video ${k} ${vp.width}${big ? ' BODY 21' : ''}`;
    const { ctx, page } = await open({ look: LOOKS[k], viewport: vp });
    await toVideo(page);
    if (big) await body21(page);
    await settle(page);
    await measure(page, '#pg-video', `${where} empty`);
    check(await addClips(page, clips.slice(0, 1)), `${where}: a clip goes in`);
    await select(page, 0);
    await pill(page, 'order');
    await settle(page);
    await measure(page, '#pg-video', `${where} ORDER`);
    await page.screenshot({ path: `${h.out}/editorslane-video-${k}-${vp.width}${big ? '-b21' : ''}.png` }).catch(() => undefined);
    await ctx.close();
  }
}
