// THE MEDIA TOOLS IN EVERY LOOK (NEXT ROUND, editorsmedia): each new screen of this round's photo and video tools in all seven looks at
// 440 × 956, The Scan at 390 × 844 and at BODY 21, one phone each (every key 44 pt, nothing sideways, no words cut): the Photo editor with
// Ghosty's marked changes up; its EXPORT sheet with 2× BIGGER and DRAFT A POST; the Video editor's TRANSITION tray with a fade's length
// slider and its GRADE tray with grade keys; and PROJECT's PHOTO FILM (the fade slider and PHOTO FILM on The Scan's three passes, where
// words wrap most; the rest in every look). Run by tests/editorsmedia.spec.mjs (PARTS=looks).
import { jpeg, photoKit, videoKit } from './mediakit.mjs';

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  let photo = null;
  let n = 0;
  /** One pass over the new screens on this phone as it is now (its look, its size, its text size). */
  const pass = async (page, where, tag) => {
    let t = Date.now();
    const lap = (what) => {
      if (process.env.LAPS) console.log(`  ${where} ${what}: ${Date.now() - t} ms`);
      t = Date.now();
    };
    // the Photo editor with three marked changes, then its export sheet
    const P = photoKit(h, page);
    await P.toPhoto();
    await page.waitForSelector('.peshelf:not([hidden]), .pe:not([hidden])', { timeout: 15000 });
    check(await P.openFile(`IMG_L${++n}.jpg`, photo), `${where}: the photo opens`);
    lap('photo open');
    await P.tool('brain');
    await page.fill('.peaskin', 'warmer, more contrast and crop to 4:5');
    await page.click('.pesuggask');
    check(await until(page, () => window.__ghosty.photoedit.changes.length === 3, null, 5000), `${where}: three changes marked`);
    await settle(page);
    await measure(page, '#pg-photo .pe', `${where} photo with Ghosty’s changes`);
    await page.screenshot({ path: `${h.out}/editorsmedia-approve-${tag}.png` }).catch(() => undefined);
    lap('changes measured');
    await page.getByRole('button', { name: /^export$/i }).click();
    await until(page, () => document.querySelector('.pepost')?.disabled === false, null, 60000);
    // (2× BIGGER's longer line where words wrap most: The Scan at 440, 390 and BODY 21; the other looks measure the sheet as it opens)
    if (tag.startsWith('scan')) {
      await page.locator('.pescale button', { hasText: '2× BIGGER' }).click();
      await until(page, () => window.__ghosty.photoedit.export?.scale === 2 && window.__ghosty.photoedit.export.w > 900 && document.querySelector('.pepost')?.disabled === false, null, 30000);
    }
    await settle(page);
    await measure(page, '.peexport', `${where} export sheet, 2× BIGGER and DRAFT A POST`);
    await page.screenshot({ path: `${h.out}/editorsmedia-export-${tag}.png` }).catch(() => undefined);
    lap('export measured');
    await page.keyboard.press('Escape');
    // the Video editor: a fade's length, grade keys, and PROJECT's PHOTO FILM (a photo clip each pass, the newest chosen)
    const V = videoKit(h, page);
    await V.toVideo();
    const have = await page.locator('.vdtile').count();
    check(await V.addClips([{ name: `IMG_V${n}.jpg`, mimeType: 'image/jpeg', buffer: photo }]), `${where}: a photo goes in as a clip`);
    await V.select(have);
    lap('clip in');
    const full = tag.startsWith('scan');
    // (TRANSITION's fade slider and PROJECT's PHOTO FILM are rows of the same keys and sliders as GRADE: measured on The Scan at 440, 390
    // and BODY 21, where words wrap most; GRADE with its keys, the tallest tray, in every look)
    if (full) {
      await V.pill('transition');
      await V.key('FADE OUT').click();
      await until(page, () => !!document.querySelector('.vdtray input[aria-label="Fade out length"]'), null, 5000);
      await settle(page);
      await measure(page, '#pg-video', `${where} video TRANSITION with a fade length`);
    }
    lap('fade measured');
    await V.pill('grade');
    await V.seek(have * 3000 + 800);
    await V.key('KEY THE GRADE AT THE PLAYHEAD').click();
    await until(page, () => !!document.querySelector('.vdcleargrade'), null, 5000);
    await settle(page);
    await measure(page, '#pg-video', `${where} video GRADE with keys`);
    lap('grade measured');
    if (full) {
      await V.pill('project');
      await until(page, () => !!document.querySelector('.vdmakefilm'), null, 5000);
      await settle(page);
      await measure(page, '#pg-video', `${where} video PROJECT with PHOTO FILM`);
    }
    lap('project measured');
    await page.screenshot({ path: `${h.out}/editorsmedia-video-${tag}.png` }).catch(() => undefined);
  };
  for (const k of Object.keys(LOOKS)) {
    if (process.env.LOOK && process.env.LOOK !== k) continue;
    const t0 = Date.now();
    const { ctx, page } = await open({ look: LOOKS[k], viewport: PHONE });
    if (process.env.LAPS) console.log(`  ${k} boot: ${Date.now() - t0} ms`);
    photo ??= await jpeg(page, 480, 360, 20);
    await pass(page, `${k} 440`, `${k}-440`);
    if (k === 'scan') {
      // The Scan at 390 × 844, then at BODY 21 (on the same phone: the screens are drawn again at the new size and text)
      await page.setViewportSize(SMALL);
      await pass(page, 'scan 390', 'scan-390');
      await page.setViewportSize(PHONE);
      await body21(page);
      await pass(page, 'scan 440 BODY 21', 'scan-440-b21');
    }
    await ctx.close();
  }
}
