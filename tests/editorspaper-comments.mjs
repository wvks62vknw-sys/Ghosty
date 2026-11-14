// PAPER, part 4 (editors.u1): comments on words in documents, end to end on the phone.
//  1. By voice ("show the comments on my document", "comment on my letter") the latest document opens with COMMENTS, empty, in his words.
//  2. Words chosen → WRITE → COMMENT → typed → ADD COMMENT: kept on those words, marked in the page; with nothing chosen it says so.
//  3. REPLY, and UNDO takes the reply back. ASK GHOSTY sends only that sentence and the comment; the brain's answer comes as a reply.
//  4. An edit before the words: the comment still finds them. RESOLVE folds it away (SHOW RESOLVED, REOPEN).
//  5. Kept: the page reloaded, the document reopened, the comment and its replies are there.
//  6. Word out: a real Word comment (word/comments.xml, its range in the text); Word back in: the same comment on the same words.
//  7. DELETE, and UNDO puts it back.
import { ask, goDocs, docOf, exported } from './editorspaperkit.mjs';

const leaseDoc = () => ({
  id: 'dlease', title: 'Lease notes', kind: 'document', at: Date.now() + 2000,
  blocks: [
    { id: 'l1', t: 'h1', runs: [{ text: 'The flat' }] },
    { id: 'l2', t: 'p', runs: [{ text: 'The rent is due on the first. The deposit is six weeks of rent. Pets are allowed with permission.' }] },
    { id: 'l3', t: 'p', runs: [{ text: 'The boiler is serviced every year.' }] },
  ],
});

export default async function (h) {
  const { open, check, until, measure, settle, LOOKS, base } = h;
  const { ctx, page } = await open({ look: LOOKS.scan, seed: { 'ghosty.docs': [leaseDoc()] } });
  const asked = [];
  const answer = 'Six weeks is the most a landlord in England can ask for, so that is within the rules.';
  const ndjson = (events) => events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await page.route('**/api/chat', (r) => {
    asked.push(r.request().postData() ?? '');
    return r.continue({ url: `${base}/__test/stream?lines=${encodeURIComponent(Buffer.from(ndjson([{ t: 'status', text: 'thinking…' }, { t: 'text', text: answer }, { t: 'done', model: 'Mock · scripted' }])).toString('base64'))}` });
  });
  const cm = () => page.evaluate(() => window.__ghosty?.comments ?? null);
  const said = () => page.evaluate(() => window.__ghosty?.docs?.said ?? '');
  const choose = (text, word) => page.evaluate(([t, w]) => {
    const el = [...document.querySelectorAll('.dcpage .dcb')].find((e) => e.textContent.includes(t));
    el.focus();
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = n.textContent.indexOf(w);
      if (i < 0) continue;
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + w.length);
      getSelection().removeAllRanges();
      getSelection().addRange(r);
      return true;
    }
    return false;
  }, [text, word]);

  // 1. voice
  for (const words of ['show the comments on my document', 'comment on my letter']) {
    const r = await ask(page, words, /WRITE → COMMENT/);
    check(r.ok, `comments: “${words}” is answered`);
    check(await until(page, () => window.__ghosty?.docs?.title === 'Lease notes' && /No comments yet/.test(document.querySelector('.dccmtbox:not([hidden]) .dccomments')?.textContent ?? '')), `comments: “${words}” opens the latest document with its comments, empty, in his words`);
    await page.keyboard.press('Escape');
  }

  // 2. a comment on chosen words
  await goDocs(page);
  await page.locator('.dcopen', { hasText: 'Lease notes' }).first().click();
  await until(page, () => window.__ghosty?.docs?.view === 'doc');
  await page.evaluate(() => getSelection().removeAllRanges());
  await page.locator('#pg-docs .dctitle').click();
  await page.locator('#pg-docs button[aria-label="Comment on the chosen words"]').click();
  check(await until(page, () => /Choose the words to comment on first/.test(window.__ghosty.docs.said)), 'comments: COMMENT with nothing chosen says to choose the words');
  check(await choose('The deposit', 'six weeks of rent'), 'comments: the words “six weeks of rent” are chosen');
  await page.locator('#pg-docs button[aria-label="Comment on the chosen words"]').click();
  await page.waitForSelector('#pg-docs .dccmtnew input');
  check(/“six weeks of rent”/.test(await page.locator('#pg-docs .dccmtnew').textContent()), 'comments: the new comment shows the words it is on');
  await page.fill('#pg-docs .dccmtnew input', 'Is this too much?');
  await page.locator('#pg-docs .dccmtnew button', { hasText: 'ADD COMMENT' }).click();
  check(await until(page, () => { const d = JSON.parse(window.__ghosty.docs.json); return d.comments?.length === 1 && d.comments[0].quote === 'six weeks of rent' && d.comments[0].text === 'Is this too much?'; }), 'comments: the comment is kept in the document, on those words');
  check(await until(page, () => !!globalThis.CSS?.highlights?.get('dccmt')?.size), 'comments: the words are marked in the page');
  check((await cm()).open === 1, 'comments: COMMENTS says one open');

  // 3. reply, undo, ask Ghosty
  await page.fill('#pg-docs .dccmt input', 'I will ask the agent.');
  await page.locator('#pg-docs .dccmt button', { hasText: 'REPLY' }).click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).comments[0].replies.length === 1), 'comments: REPLY adds a reply');
  await page.locator('#pg-docs .dctools button', { hasText: /^UNDO$/ }).click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).comments[0].replies.length === 0 && (window.__ghosty.comments.list[0]?.replies.length ?? 1) === 0), 'comments: UNDO takes the reply back');
  await page.locator('#pg-docs .dccmt button', { hasText: 'ASK GHOSTY' }).click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).comments[0].replies.some((r) => r.who === 'ghosty' && /Six weeks is the most/.test(r.text)), null, 20000), 'comments: ASK GHOSTY’s answer comes as Ghosty’s reply');
  const sent = asked.at(-1) ?? '';
  check(/The deposit is six weeks of rent\./.test(sent) && /Is this too much\?/.test(sent) && !/boiler/.test(sent) && !/rent is due/.test(sent), 'comments: only that one sentence and the comment went with the message');
  check(/Ghosty replied/.test(await said()), `comments: it says Ghosty replied (${await said()})`);

  // 4. an edit before the words, then resolve
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('#pg-docs .dcpage .dcb')].find((e) => e.textContent.includes('The deposit'));
    el.focus();
    const r = document.createRange();
    r.setStart(el.firstChild, 0);
    r.collapse(true);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  });
  await page.keyboard.type('Note: ');
  await page.locator('#pg-docs .dctitle').click();
  check(await until(page, () => /^Note: The rent/.test(JSON.parse(window.__ghosty.docs.json).blocks[1].runs[0].text)), 'comments: words typed before the comment’s words');
  check(await until(page, () => window.__ghosty.comments.list[0] && !window.__ghosty.comments.list[0].lost && !!globalThis.CSS?.highlights?.get('dccmt')?.size), 'comments: the comment still finds its words');
  await settle(page);
  await measure(page, '#pg-docs .dccomments', 'comments: the panel with a comment and replies');
  await page.locator('#pg-docs .dccmt button', { hasText: 'RESOLVE' }).click();
  check(await until(page, () => window.__ghosty.comments.open === 0 && window.__ghosty.comments.resolved === 1 && !document.querySelector('#pg-docs .dccmt')), 'comments: RESOLVE folds it away');
  await page.locator('#pg-docs .dccomments button', { hasText: 'SHOW RESOLVED (1)' }).click();
  await page.locator('#pg-docs .dccmt button', { hasText: 'REOPEN' }).click();
  check(await until(page, () => window.__ghosty.comments.open === 1), 'comments: SHOW RESOLVED and REOPEN bring it back');

  // 5. kept on the phone: reload and reopen
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#boot', { state: 'detached', timeout: 40000 }).catch(() => undefined);
  await goDocs(page);
  await page.locator('.dcopen', { hasText: 'Lease notes' }).first().click();
  await until(page, () => window.__ghosty?.docs?.view === 'doc');
  const kept = await docOf(page);
  check(kept.comments?.length === 1 && kept.comments[0].replies.some((r) => r.who === 'ghosty'), 'comments: after a reload the comment and Ghosty’s reply are still there');
  check(await until(page, () => !!globalThis.CSS?.highlights?.get('dccmt')?.size), 'comments: and its words are marked again');

  // 6. Word out and back in
  const word = await exported(page, 'WORD');
  const raw = word.bytes.toString('latin1');
  check(/word\/comments\.xml/.test(raw) && /w:commentRangeStart/.test(raw) && /Is this too much\?/.test(raw) && /Ghosty: Six weeks/.test(raw), 'comments: the Word file holds a real Word comment on the words, with the replies');
  await page.locator('.dcbar button', { hasText: 'MY DOCUMENTS' }).first().click();
  await page.setInputFiles('.dcsheet input[type=file][accept*=".docx"]', { name: 'Lease back.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: word.bytes });
  check(await until(page, () => window.__ghosty?.docs?.view === 'doc' && /Lease/.test(window.__ghosty.docs.title) && !!JSON.parse(window.__ghosty.docs.json).comments), 'comments: the Word file reads back in with its comment');
  const back = await docOf(page);
  const c = back.comments?.[0];
  check(c?.quote === 'six weeks of rent' && c.text === 'Is this too much?' && c.replies.some((r) => r.who === 'ghosty' && /Six weeks is the most/.test(r.text)), `comments: the same comment on the same words, with Ghosty’s reply (${JSON.stringify(c)?.slice(0, 160)})`);

  // 7. delete and undo
  await page.locator('#pg-docs .dctools button', { hasText: 'COMMENTS' }).click();
  await page.locator('#pg-docs .dccmt button', { hasText: 'DELETE' }).click();
  check(await until(page, () => !JSON.parse(window.__ghosty.docs.json).comments && /No comments yet/.test(document.querySelector('#pg-docs .dccomments')?.textContent ?? '')), 'comments: DELETE takes it away');
  await page.locator('#pg-docs .dctools button', { hasText: /^UNDO$/ }).click();
  check(await until(page, () => JSON.parse(window.__ghosty.docs.json).comments?.length === 1), 'comments: UNDO puts it back');
  await page.screenshot({ path: `${h.out}/paper-comments.png` });
  await ctx.close();
}
