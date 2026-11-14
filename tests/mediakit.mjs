// THE EDITORS' MEDIA KIT (NEXT ROUND, spec word editorsmedia): the photo and video helpers the editorsmedia parts share. Not a part itself.

/** A small JPEG drawn in the page (a sky over grass, `tint` to tell the photos apart, `dim` to darken it), as the photo specs make theirs. */
export async function jpeg(page, w, h, tint = 0, dim = 1) {
  const b64 = await page.evaluate(async ({ w, h, tint, dim }) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6);
    sky.addColorStop(0, `rgb(${Math.round((30 + tint) * dim)}, ${Math.round(90 * dim)}, ${Math.round(205 * dim)})`);
    sky.addColorStop(1, `rgb(${Math.round((185 + tint) * dim)}, ${Math.round(215 * dim)}, ${Math.round(245 * dim)})`);
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = `rgb(${Math.round(60 * dim)}, ${Math.round(130 * dim)}, ${Math.round(70 * dim)})`;
    g.fillRect(0, h * 0.6, w, h * 0.4);
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.9));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = '';
    for (let i = 0; i < buf.length; i += 8192) s += String.fromCharCode(...buf.subarray(i, i + 8192));
    return btoa(s);
  }, { w, h, tint, dim });
  return Buffer.from(b64, 'base64');
}

/** The photo editor's own helpers on one page (h is the harness). */
export function photoKit(h, page) {
  const { until } = h;
  const st = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__ghosty.photoedit, (k, v) => (typeof v === 'function' ? undefined : v))));
  const recipe = () => page.evaluate(() => window.__ghosty.photoedit.recipe());
  /** The picture drawn and nothing waiting to be drawn (the editor's own flag, never a clock). */
  const drawn = () => until(page, () => window.__ghosty?.photoedit?.ready === true && window.__ghosty.photoedit.draws > 0 && !window.__ghosty.photoedit.pending, null, 60000);
  const toPhoto = async () => {
    await page.evaluate(() => (location.hash = 'photo'));
    await page.waitForFunction(() => document.body.dataset.tab === 'photo', null, { timeout: 15000 });
  };
  const toShelf = async () => {
    if (await page.locator('.pe:not([hidden])').count()) await page.click('.peback');
    await page.waitForSelector('.peshelf:not([hidden])', { timeout: 10000 });
  };
  const openFile = async (name, buffer) => {
    await toShelf();
    await page.setInputFiles('.peshelf input[type=file]', [{ name, mimeType: 'image/jpeg', buffer }]);
    await page.waitForSelector('.pe:not([hidden]) .pestage', { timeout: 30000 });
    await until(page, (n) => window.__ghosty?.photoedit?.name === n, name, 30000);
    return drawn();
  };
  const tool = async (t) => {
    await page.click(`.pepill[data-tool="${t}"]`);
    await until(page, (t) => window.__ghosty.photoedit.tool === t, t, 8000);
  };
  return { st, recipe, drawn, toPhoto, toShelf, openFile, tool };
}

/** Say `words` in the chat and wait for the first reply after his own message (found by its `data-at`) that matches `re` (as planlane's H.ask). */
export async function ask(page, words, re = /\S/, ms = 20000) {
  const t0 = await page.evaluate(() => Date.now());
  await page.evaluate(() => (location.hash = 'core'));
  await page.waitForSelector('#cin', { state: 'visible', timeout: 15000 });
  await page.fill('#cin', words);
  await page.keyboard.press('Enter');
  const find = ({ t0, src, flags, any }) => {
    const rx = new RegExp(src, flags);
    const msgs = [...document.querySelectorAll('#pg-core .msg')];
    const mine = msgs.map((m) => m.classList.contains('me') && Number(m.dataset.at ?? 0) >= t0).lastIndexOf(true);
    if (mine < 0) return null;
    const replies = msgs.slice(mine + 1).filter((m) => !m.classList.contains('me'));
    const r = any ? replies.at(-1) : replies.find((m) => rx.test(m.textContent ?? ''));
    return r ? { text: r.textContent ?? '' } : null;
  };
  const arg = { t0, src: re.source, flags: re.flags.replace('g', ''), any: false };
  const got = await page.waitForFunction(find, arg, { timeout: ms }).then((x) => x.jsonValue(), () => null);
  if (got) return { ok: true, ...got };
  const seen = await page.evaluate(find, { ...arg, any: true }).catch(() => null);
  return { ok: false, text: seen?.text ?? '' };
}

/** The screen has finished coming in: its drawn width equals its laid-out width (no entrance scale left on it). */
export const still = (h, page, sel) => h.until(page, (sel) => {
  const el = document.querySelector(sel);
  return !!el && el.offsetWidth > 0 && Math.abs(el.getBoundingClientRect().width - el.offsetWidth) < 0.25;
}, sel, 10000);

/** The video editor's own helpers on one page (h is the harness). */
export function videoKit(h, page) {
  const { until } = h;
  const fileInput = '#pg-video .vdsheet > .vd > input[type=file]';
  const toVideo = async () => {
    await page.evaluate(() => (location.hash = 'video'));
    await page.waitForSelector('#pg-video .vd', { timeout: 20000 });
  };
  const proj = () => page.evaluate(() => window.__ghosty.video.project());
  const line = () => page.locator('.vdline').textContent().then((t) => t ?? '');
  const key = (text) => page.locator('.vd button').filter({ hasText: new RegExp(`^\\s*${text}\\s*$`, 'i') }).first();
  const pill = async (t) => {
    await page.click(`.vdpill[data-tool="${t}"]`);
    await page.waitForFunction((x) => document.querySelector('.vd')?.dataset.tool === x, t);
  };
  const select = async (i) => {
    await page.waitForSelector(`.vdtile[data-index="${i}"]`, { timeout: 15000 });
    const id = await page.evaluate((i) => {
      const t = document.querySelector(`.vdtile[data-index="${i}"]`);
      t.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const r = t.getBoundingClientRect();
      t.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 4, clientY: r.top + r.height / 2 }));
      return t.dataset.id;
    }, i);
    return until(page, (want) => window.__ghosty.video.state().selected === want, id, 5000);
  };
  const addClips = async (list) => {
    await page.setInputFiles(fileInput, list);
    return until(page, (n) => document.querySelectorAll('.vdtile').length >= n, list.length, 60000);
  };
  const seek = (ms) => page.evaluate((t) => window.__ghosty.video.seek(t), ms);
  const px = (fx, fy) => page.evaluate(([x, y]) => window.__ghosty.video.pixel(x, y), [fx, fy]);
  /** A slider by its name, set as a finger leaves it (input, then change). */
  const slide = (label, v) => page.evaluate(([label, v]) => {
    const i = document.querySelector(`.vdtray input[type=range][aria-label="${label}"]`);
    if (!i) return false;
    i.value = String(v);
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }, [label, v]);
  return { toVideo, proj, line, key, pill, select, addClips, seek, px, slide };
}
