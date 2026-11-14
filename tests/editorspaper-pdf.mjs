// PAPER, part 2 (editors.s12): fill in and sign a PDF form, end to end on the phone.
//  1. By voice ("fill in a PDF form", "sign this PDF") the screen opens empty and says to choose a PDF; DOCUMENTS → FILL AND SIGN A PDF too.
//  2. A real PDF form (two text boxes, a tick box, a choice of round buttons) is read: its boxes become fields, the round buttons are
//     said as not filled; typing, ticking; UNDO steps the tick back.
//  3. SIGN: a signature drawn with a finger on the pad (not kept unless KEEP IT), put on the page with a tap, TAKE IT OFF and back.
//  4. SAVE PDF makes the filled PDF here; it holds the ink mark and, opened again, shows the same words and tick (a round trip).
//  5. KEEP IT keeps the signature on this phone; FORGET MY SIGNATURE lets it go.
import { ask, goDocs } from './editorspaperkit.mjs';
import { readFileSync } from 'node:fs';

/** A small PDF form, written by hand: Surname and Town text boxes, an "I agree" tick box, a round-button choice. */
export function formPdf() {
  const objs = [];
  const box = (w, h, body) => `<< /Type /XObject /Subtype /Form /BBox [0 0 ${w} ${h}] /Length ${body.length} >>\nstream\n${body}\nendstream`;
  const content = 'BT /F1 14 Tf 60 706 Td (Surname) Tj 0 -60 Td (Town) Tj 0 -40 Td (I agree to the terms) Tj 0 -60 Td (Contact by phone) Tj ET';
  objs[1] = '<< /Type /Catalog /Pages 2 0 R /AcroForm 5 0 R >>';
  objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objs[3] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 9 0 R >> >> /Annots [6 0 R 7 0 R 8 0 R 10 0 R] >>';
  objs[4] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  objs[5] = '<< /Fields [6 0 R 7 0 R 8 0 R 10 0 R] /DA (/Helv 0 Tf 0 g) /DR << /Font << /Helv 9 0 R >> >> >>';
  objs[6] = '<< /Type /Annot /Subtype /Widget /FT /Tx /T (surname) /TU (Your surname) /Rect [200 700 450 724] /P 3 0 R /F 4 /DA (/Helv 12 Tf 0 g) /MK << /BC [0 0 0] >> >>';
  objs[7] = '<< /Type /Annot /Subtype /Widget /FT /Tx /T (home_town) /Rect [200 640 450 664] /P 3 0 R /F 4 /DA (/Helv 12 Tf 0 g) /MK << /BC [0 0 0] >> >>';
  objs[8] = '<< /Type /Annot /Subtype /Widget /FT /Btn /T (agree) /TU (I agree to the terms) /Rect [260 598 278 616] /P 3 0 R /F 4 /V /Off /AS /Off /MK << /BC [0 0 0] /CA (4) >> /AP << /N << /Yes 11 0 R /Off 12 0 R >> >> /DA (/ZaDb 12 Tf 0 g) >>';
  objs[9] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[10] = '<< /Type /Annot /Subtype /Widget /FT /Btn /Ff 49152 /T (contact) /TU (How to contact you) /Rect [260 538 278 556] /P 3 0 R /F 4 /V /Off /AS /Off /MK << /BC [0 0 0] /CA (l) >> /AP << /N << /Phone 11 0 R /Off 12 0 R >> >> >>';
  objs[11] = box(18, 18, '0 g 3 3 12 12 re f');
  objs[12] = box(18, 18, '');
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const at = [];
  for (let i = 1; i < objs.length; i++) {
    at[i] = Buffer.byteLength(out, 'latin1');
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n${at.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R /Info << /Title (Parking permit) >> >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

export default async function (h) {
  const { open, check, until, measure, settle, LOOKS } = h;
  const { ctx, page } = await open({ look: LOOKS.scan });
  const state = () => page.evaluate(() => window.__ghosty?.pdfform ?? null);
  const said = () => page.evaluate(() => window.__ghosty?.pdfform?.said ?? '');
  const sheet = '.pdfform';

  // 1. voice and DOCUMENTS
  for (const words of ['fill in a PDF form', 'sign this PDF']) {
    const r = await ask(page, words, /CHOOSE A PDF/);
    check(r.ok, `pdf: “${words}” is answered (${r.text.slice(-80)})`);
    check(await until(page, () => window.__ghosty?.pdfform?.open && /No PDF chosen yet/.test(window.__ghosty.pdfform.said) && !!document.querySelector('.pdfform button')), `pdf: “${words}” opens fill and sign, empty, in his words`);
    await page.keyboard.press('Escape');
  }
  await goDocs(page);
  await page.locator('#pg-docs .dcbar button', { hasText: 'FILL AND SIGN A PDF' }).click();
  check(await until(page, () => window.__ghosty?.pdfform?.open), 'pdf: DOCUMENTS → FILL AND SIGN A PDF opens it');
  // a file that is not a PDF is said
  await page.setInputFiles(`${sheet} input[type=file]`, { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') });
  check(await until(page, () => /not a PDF/.test(window.__ghosty.pdfform.said)), 'pdf: a file that is not a PDF is said in his words');

  // 2. the form read
  const t0 = Date.now();
  await page.setInputFiles(`${sheet} input[type=file]`, { name: 'Parking permit.pdf', mimeType: 'application/pdf', buffer: formPdf() });
  check(await until(page, () => window.__ghosty.pdfform.fields === 3 && document.querySelectorAll('.pdfform canvas.pdfpage').length === 1, null, 20000), `pdf: the form is read with its three boxes and its page drawn (${Date.now() - t0} ms)`);
  const st = await state();
  check(st.cannot.length === 1 && /contact/i.test(st.cannot[0]), `pdf: the round-button choice is said as not filled (${st.cannot.join(', ')})`);
  check(/I cannot fill one: How to contact you/.test(await said()), `pdf: and the line says so (${await said()})`);
  check(await page.locator(`${sheet} input[aria-label="Your surname"]`).count() === 1 && await page.locator(`${sheet} input[aria-label="Home town"]`).count() === 1, 'pdf: each box is a field named by its description, or its name tidied');
  await page.fill(`${sheet} input[aria-label="Your surname"]`, 'Khan');
  await page.fill(`${sheet} input[aria-label="Home town"]`, 'Birmingham');
  await page.locator(`${sheet} input[aria-label="Home town"]`).press('Tab');
  await page.locator(`${sheet} .pdftick`).click();
  check(await until(page, () => window.__ghosty.pdfform.filled === 3), 'pdf: typed and ticked, all three boxes filled');
  check(await until(page, () => [...document.querySelectorAll('.pdfmark')].some((m) => m.textContent === 'Khan')), 'pdf: the page shows what he typed in its box');
  await page.locator(`${sheet} button`, { hasText: /^UNDO$/ }).click();
  check(await until(page, () => window.__ghosty.pdfform.filled === 2 && document.querySelector('.pdfform .pdftick')?.getAttribute('aria-checked') === 'false'), 'pdf: UNDO takes the tick back');
  await page.locator(`${sheet} .pdftick`).click();

  // 3. SIGN with a finger
  await page.locator(`${sheet} button`, { hasText: /^SIGN$/ }).click();
  await page.waitForSelector('canvas.pdfpad');
  await page.locator('.modal button', { hasText: /^DONE$/ }).last().click();
  check(await until(page, () => [...document.querySelectorAll('.pprsaid')].some((p) => /Sign in the box first/.test(p.textContent))), 'pdf: DONE on an empty pad says to sign first');
  await settle(page);
  const pad = await page.locator('canvas.pdfpad').boundingBox();
  await page.mouse.move(pad.x + 20, pad.y + pad.height * 0.7);
  await page.mouse.down();
  for (let k = 1; k <= 12; k++) await page.mouse.move(pad.x + 20 + k * (pad.width - 40) / 12, pad.y + pad.height * (0.7 - 0.4 * Math.sin(k)));
  await page.mouse.up();
  await page.locator('.modal button', { hasText: /^DONE$/ }).last().click();
  check(await until(page, () => window.__ghosty.pdfform.signed && /tap the page/i.test(window.__ghosty.pdfform.said)), 'pdf: the signature is drawn and it asks where it goes');
  check(await page.evaluate(() => localStorage.getItem('ghosty.signature')) === null, 'pdf: the signature is not kept on the phone (no KEEP IT)');
  await settle(page);
  const pg = await page.locator(`${sheet} canvas.pdfpage`).boundingBox();
  await page.locator(`${sheet} canvas.pdfpage`).click({ position: { x: pg.width * 0.6, y: pg.height * 0.85 } });
  check(await until(page, () => window.__ghosty.pdfform.placed?.page === 0 && !!document.querySelector('.pdfsigmark')), 'pdf: a tap on the page puts the signature there, drawn');
  const pl = (await state()).placed;
  check(pl.rect[1] > 60 && pl.rect[3] < 200 && pl.rect[0] > 250, `pdf: it sits where he tapped, low on the page (${pl.rect.map(Math.round).join(', ')})`);
  await page.locator(`${sheet} button`, { hasText: 'TAKE IT OFF' }).click();
  check(await until(page, () => !window.__ghosty.pdfform.placed && !document.querySelector('.pdfsigmark')), 'pdf: TAKE IT OFF takes it off');
  await page.locator(`${sheet} button`, { hasText: /^UNDO$/ }).click();
  check(await until(page, () => window.__ghosty.pdfform.placed?.page === 0), 'pdf: UNDO puts it back');
  await settle(page);
  await measure(page, sheet, 'pdf: fill and sign, filled and signed');

  // 4. SAVE PDF, and the round trip
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), (async () => {
    await page.locator(`${sheet} button`, { hasText: 'SAVE PDF' }).click();
    await page.waitForSelector(`${sheet} .cvoutt b`, { timeout: 20000 });
    await page.locator(`${sheet} .dcouts button`, { hasText: 'SAVE' }).click();
  })()]);
  const bytes = readFileSync(await dl.path());
  check(dl.suggestedFilename() === 'Parking permit (filled).pdf', `pdf: saved as “${dl.suggestedFilename()}”`);
  const txt = bytes.toString('latin1');
  check(txt.startsWith('%PDF') && bytes.length > formPdf().length && /\/InkList/.test(txt) && /\(Khan\)|Khan/.test(txt), `pdf: the filled PDF holds his words and the ink mark (${bytes.length} bytes)`);
  check(/3 of 3 boxes filled, signed on page 1\. Not filled: How to contact you\./.test(await said()), `pdf: it says what was filled and what was not (${await said()})`);
  await page.setInputFiles(`${sheet} input[type=file]`, { name: 'Parking permit (filled).pdf', mimeType: 'application/pdf', buffer: bytes });
  check(await until(page, () => window.__ghosty.pdfform.name === 'Parking permit (filled).pdf' && window.__ghosty.pdfform.fields === 3, null, 20000), 'pdf: the filled PDF opens again');
  const back = await page.evaluate(() => ({ s: document.querySelector('.pdfform input[aria-label="Your surname"]')?.value, t: document.querySelector('.pdfform input[aria-label="Home town"]')?.value, a: document.querySelector('.pdfform .pdftick')?.getAttribute('aria-checked') }));
  check(back.s === 'Khan' && back.t === 'Birmingham' && back.a === 'true', `pdf: and keeps the words and the tick in its boxes (${JSON.stringify(back)})`);

  // 5. KEEP IT, and FORGET
  await page.locator(`${sheet} button`, { hasText: /^SIGN/ }).first().click();
  await page.waitForSelector('canvas.pdfpad');
  await settle(page);
  const pad2 = await page.locator('canvas.pdfpad').boundingBox();
  await page.mouse.move(pad2.x + 30, pad2.y + 30);
  await page.mouse.down();
  await page.mouse.move(pad2.x + 120, pad2.y + 60);
  await page.mouse.up();
  await page.locator('.modal button', { hasText: 'KEEP IT' }).last().click();
  await page.locator('.modal button', { hasText: /^DONE$/ }).last().click();
  check(await until(page, () => JSON.parse(localStorage.getItem('ghosty.signature') ?? 'null')?.strokes?.length === 1), 'pdf: KEEP IT keeps the signature on this phone');
  await page.locator(`${sheet} button`, { hasText: 'FORGET MY SIGNATURE' }).click();
  check(await until(page, () => localStorage.getItem('ghosty.signature') === null && /no longer kept/.test(window.__ghosty.pdfform.said)), 'pdf: FORGET MY SIGNATURE lets it go');
  await page.screenshot({ path: `${h.out}/paper-pdf.png` });
  await ctx.close();
}
