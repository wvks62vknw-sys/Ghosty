// POST AN EDITED PHOTO WITH APPROVE (NEXT ROUND, editors.c6 with comic.c5's hook; built into SOCIAL small and additive): the Photo editor's
// EXPORT → DRAFT A POST puts the edited picture into SOCIAL's own WRITE A POST. He still picks the account, says what is in the picture and
// makes the draft; the draft waits in the queue, and only his APPROVE sends it. Proved end to end against stood-in accounts (nothing
// reaches a real one): nothing is drafted or sent by DRAFT A POST itself; a draft dropped with NO sends nothing; a second one goes out
// only on APPROVE, carrying the picture and its words. Then the export sheet with DRAFT A POST in all seven looks at 440, The Scan at 390
// and BODY 21. Run by tests/editorsmedia.spec.mjs (PARTS=post).
import { jpeg, photoKit } from './mediakit.mjs';

const ACCOUNTS = [
  { id: 'bluesky', name: 'Bluesky', who: 'spec.bsky.social' },
  { id: 'mastodon', name: 'Mastodon', who: null },
  { id: 'discord', name: 'Discord', who: null },
  { id: 'channel', name: 'your Telegram channel', who: null },
];

/** Stand in for his accounts: GET /social, POST /social/draft, /social/no, /social/approve (each recorded), /lens/share (a picture id). */
async function standIn(page) {
  const asked = [];
  const drafts = [];
  const sent = [];
  const bodies = [];
  let n = 0;
  await page.route(/\/api\/(social|lens\/share)(\/|\?|$)/, async (r) => {
    const u = new URL(r.request().url());
    const m = r.request().method();
    asked.push(`${m} ${u.pathname}`);
    const body = () => JSON.parse(r.request().postData() ?? '{}');
    const json = (x) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(x) });
    if (u.pathname === '/api/social' && m === 'GET') return json({ accounts: ACCOUNTS, drafts, sent });
    if (u.pathname === '/api/lens/share') return json({ id: 'SpecPicture00001', url: 'https://ghosty.example/i/SpecPicture00001', expires: Date.now() + 86400_000, type: 'image/jpeg' });
    if (u.pathname === '/api/social/draft') {
      const b = body();
      bodies.push(b);
      const d = { id: `spec${++n}`, account: b.account, kind: 'post', text: b.text, ...(b.image ? { image: { id: b.image, alt: b.alt } } : {}), state: 'waiting', at: Date.now() + n, expires: Date.now() + 86400_000, from: 'phone' };
      drafts.push(d);
      return json({ draft: d });
    }
    if (u.pathname === '/api/social/no') {
      const d = drafts.find((x) => x.id === body().id);
      if (d) d.state = 'dropped';
      return json({ draft: d });
    }
    if (u.pathname === '/api/social/approve') {
      const d = drafts.find((x) => x.id === body().id);
      if (d) Object.assign(d, { state: 'sent', link: 'https://bsky.app/profile/spec.bsky.social/post/3kmedia' });
      if (d) sent.push({ at: Date.now(), account: d.account, kind: 'post', text: d.text, link: d.link });
      return json({ draft: d, said: `Posted: ${d?.link}` });
    }
    return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"not in this spec"}' });
  });
  return { asked, drafts, bodies, sent };
}

export default async function (h) {
  const { open, check, until, settle, measure, body21, LOOKS, PHONE, SMALL } = h;
  const exportReady = (page) => until(page, () => window.__ghosty.photoedit.export?.phase === 'ready' && window.__ghosty.photoedit.export.bytes > 0 && document.querySelector('.pepost')?.disabled === false, null, 60000);
  const toPost = async (page, P) => {
    await P.toPhoto();
    await until(page, () => window.__ghosty?.photoedit?.open === true, null, 20000);
    await P.drawn();
    await page.getByRole('button', { name: /^export$/i }).click();
    check(await exportReady(page), 'post: the export sheet draws the edited picture');
    await page.click('.pepost');
    return until(page, () => document.body.dataset.tab === 'social' && !!document.querySelector('#pg-social .soccompose img.socthumb'), null, 20000);
  };

  {
    const { ctx, page } = await open({ look: LOOKS.scan, viewport: PHONE });
    const S = await standIn(page);
    const P = photoKit(h, page);
    await P.toPhoto();
    await page.waitForSelector('.peshelf:not([hidden])', { timeout: 15000 });
    check(await P.openFile('IMG_POST.jpg', await jpeg(page, 800, 600, 30)), 'post: a photo opens');
    await P.tool('light');
    await page.evaluate(() => {
      const i = document.querySelector('#pe-s-exposure');
      i.value = '0.6';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await P.drawn();
    await page.getByRole('button', { name: /^export$/i }).click();
    check(await exportReady(page), 'post: the export sheet is ready');
    const note = (await page.locator('.pepostnote').textContent()) ?? '';
    check(/Nothing goes out until you tap APPROVE/.test(note), `post: the sheet says nothing goes out until APPROVE ("${note}")`);
    check(!(await page.locator('.pepost').isDisabled()), 'post: DRAFT A POST is live once the picture is drawn');
    // ENLARGE (editors.u14, no model): 2× BIGGER makes the file twice as wide and tall, says so plainly, and AS IT IS goes back
    const w1 = (await P.st()).export.w;
    await page.locator('.pescale button', { hasText: '2× BIGGER' }).click();
    check(await until(page, (w) => window.__ghosty.photoedit.export.w === w * 2 && document.querySelector('.pepost')?.disabled === false, w1, 30000), `post: 2× BIGGER makes it twice the size (${w1} → ${(await P.st()).export.w} px wide)`);
    const sn = (await page.locator('.pescalenote').textContent()) ?? '';
    check(/1,600 × 1,200, drawn up smoothly and sharpened on this phone/.test(sn) && /no model is offered/.test(sn), `post: it says what it did and that no model is offered ("${sn}")`);
    await page.locator('.pescale button', { hasText: 'AS IT IS' }).click();
    check(await until(page, (w) => window.__ghosty.photoedit.export.w === w && document.querySelector('.pepost')?.disabled === false, w1, 30000), 'post: AS IT IS goes back to the picture’s own size');
    await page.click('.pepost');
    check(await until(page, () => document.body.dataset.tab === 'social' && !!document.querySelector('#pg-social .soccompose img.socthumb'), null, 20000), 'post: SOCIAL opens with the picture in WRITE A POST');
    check((await P.st()).export?.posted === 'IMG_POST-edit.jpg', 'post: the edited picture (not the original) went over');
    check(!S.asked.some((a) => /draft|approve/.test(a)), `post: DRAFT A POST itself drafted and sent nothing (${S.asked.join(', ')})`);
    // he writes, says what is in the picture, and makes the draft: it waits for APPROVE
    await page.fill('#pg-social .soccompose textarea', 'The park this morning');
    await page.fill('#pg-social .soccompose .socalt', 'A green park under a blue sky');
    await page.locator('#pg-social .soccompose button', { hasText: /^MAKE THE DRAFT$/ }).click();
    check(await until(page, () => /waiting for your APPROVE/.test(document.querySelector('#pg-social .pknote')?.textContent ?? ''), null, 15000), 'post: the draft waits in the queue for his APPROVE');
    check(S.bodies.length === 1 && S.bodies[0].image === 'SpecPicture00001' && S.bodies[0].alt === 'A green park under a blue sky' && S.bodies[0].text === 'The park this morning', `post: one draft, with the picture and its words (${JSON.stringify(S.bodies[0] ?? null)})`);
    check(!S.asked.some((a) => /approve/.test(a)), 'post: nothing sent before APPROVE');
    // NO drops it, and nothing goes out (the undo of a draft)
    await page.locator('#pg-social button', { hasText: /^NO$/ }).first().click();
    check(await until(page, () => /Nothing waiting/.test(document.querySelector('#pg-social .pknote')?.textContent ?? ''), null, 15000), 'post: NO drops the draft');
    check(S.sent.length === 0 && !S.asked.some((a) => /approve/.test(a)), 'post: and nothing went out');
    // again, and this time APPROVE: only now does it go out
    check(await toPost(page, P), 'post: DRAFT A POST again puts the picture in a new post');
    check(!(await page.inputValue('#pg-social .soccompose .socalt')), 'post: the picture’s words are asked for again (the box starts empty)');
    await page.fill('#pg-social .soccompose textarea', 'The park, edited');
    await page.fill('#pg-social .soccompose .socalt', 'A green park under a blue sky');
    await page.locator('#pg-social .soccompose button', { hasText: /^MAKE THE DRAFT$/ }).click();
    await until(page, () => /1 waiting for your APPROVE/.test(document.querySelector('#pg-social .pknote')?.textContent ?? ''), null, 15000);
    await page.locator('#pg-social button', { hasText: /^APPROVE$/ }).first().click();
    check(await until(page, () => ![...document.querySelectorAll('#pg-social .socq button')].some((b) => /^APPROVE$/.test(b.textContent.trim())), null, 15000), 'post: APPROVE sends it and the queue is empty');
    check(S.sent.length === 1 && S.asked.filter((a) => /approve/.test(a)).length === 1, `post: exactly one post went out, on his APPROVE (${S.asked.join(', ')})`);
    await ctx.close();
  }
}
