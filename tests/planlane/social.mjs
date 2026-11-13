// SOCIAL (planlane:social): WRITE A POST made whole, and the proof that the page never sends anything by itself.
//  - the pure words (where it goes, the count per account, the picture's line, what was made, each account's state);
//  - at 440 × 956 and 390 × 844, BODY 21: each account's state in words; the same post to two accounts at once (two drafts,
//    each with its own APPROVE); each account's own count (Bluesky counts an emoji as one); a picture with its words, refused
//    without them and refused for an account that takes no pictures; the words kept on the phone across a reload;
//    SENT TODAY with its link at 44 pt; nothing sideways, no word cut;
//  - APPROVE: /social/approve is never asked for by the page, only once by his tap on one draft's APPROVE (and the source
//    holds exactly one call to it, behind the APPROVE key);
//  - the brain not answering: the queue, the composer and every account panel say so (no link form shown on a guess);
//  - the seven looks: the composer with a picture fits and is drawn in the look's colours.
// His accounts, the draft route and the picture store are stood in with page.route; nothing reaches a real account.
import { readFileSync } from 'node:fs';
import { openSection } from '../nav.mjs';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const ACCOUNTS = [
  { id: 'bluesky', name: 'Bluesky', who: 'spec.bsky.social' },
  { id: 'mastodon', name: 'Mastodon', who: '@spec@mastodon.social' },
  { id: 'discord', name: 'Discord', who: 'Spec bot in Spec server' },
  { id: 'channel', name: 'your Telegram channel', who: null },
];
const SENT = [{ at: Date.now() - 3600_000, account: 'bluesky', kind: 'post', text: 'A post that went out this morning, after his APPROVE.', link: 'https://bsky.app/profile/spec.bsky.social/post/3kspec' }];

/** Stand in for his accounts: GET /social, POST /social/draft (kept), /social/approve (recorded), /lens/share (a picture id). */
async function standIn(page, { offline = false } = {}) {
  const asked = [];
  const drafts = [];
  const sent = [...SENT];
  const bodies = [];
  let n = 0;
  await page.route(/\/api\/(social|lens\/share)(\/|\?|$)/, async (r) => {
    const u = new URL(r.request().url());
    const m = r.request().method();
    asked.push(`${m} ${u.pathname}`);
    if (offline) return r.abort('internetdisconnected');
    if (u.pathname === '/api/social' && m === 'GET') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ accounts: ACCOUNTS, drafts, sent }) });
    if (u.pathname === '/api/lens/share') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ id: 'SpecPicture00001', url: 'https://ghosty.example/i/SpecPicture00001', expires: Date.now() + 86400_000, type: 'image/png' }) });
    if (u.pathname === '/api/social/draft') {
      const b = JSON.parse(r.request().postData() ?? '{}');
      bodies.push(b);
      const d = { id: `spec${++n}`, account: b.account, kind: 'post', text: b.text, ...(b.image ? { image: { id: b.image, alt: b.alt } } : {}), state: 'waiting', at: Date.now() + n, expires: Date.now() + 86400_000, from: 'phone' };
      drafts.push(d);
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ draft: d }) });
    }
    if (u.pathname === '/api/social/approve') {
      const { id } = JSON.parse(r.request().postData() ?? '{}');
      const d = drafts.find((x) => x.id === id);
      if (d) Object.assign(d, { state: 'sent', link: d.account === 'mastodon' ? 'https://mastodon.social/@spec/113' : 'https://bsky.app/profile/spec.bsky.social/post/3kspec2' });
      if (d) sent.push({ at: Date.now(), account: d.account, kind: 'post', text: d.text, link: d.link });
      return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ draft: d, said: `Posted: ${d?.link}` }) });
    }
    return r.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"not in this spec"}' });
  });
  return { asked, drafts, bodies };
}

export async function run(H) {
  const { check, phone, open, fit, log, PHONE, PHONE2, WORLDS, RAW } = H;

  // ---- 1. the pure words
  const W = await H.pure('apps/web/src/features/social/words.ts');
  check(W.toWords(['Bluesky']) === 'To Bluesky: one draft, and it waits for your APPROVE.', `toWords one: ${W.toWords(['Bluesky'])}`);
  check(W.toWords(['Bluesky', 'Mastodon']) === 'To Bluesky and Mastodon: two drafts, and each waits for its own APPROVE.', `toWords two: ${W.toWords(['Bluesky', 'Mastodon'])}`);
  check(W.composeKey(1) === 'MAKE THE DRAFT' && W.composeKey(2) === 'MAKE 2 DRAFTS', 'the key says how many drafts');
  check(W.countWords([{ name: 'Bluesky', n: 34, max: 300 }]) === '34 of 300 letters', 'one account: the plain count');
  check(W.countWords([{ name: 'Bluesky', n: 310, max: 300 }, { name: 'Mastodon', n: 310, max: 500 }]) === 'Bluesky 10 over its 300 · Mastodon 310 of 500', `two accounts: ${W.countWords([{ name: 'Bluesky', n: 310, max: 300 }, { name: 'Mastodon', n: 310, max: 500 }])}`);
  check(/^Discord takes words only/.test(W.pictureWords(['Bluesky', 'Discord'], ['Discord'])) && /one picture/.test(W.pictureWords(['Bluesky'], [])), 'the picture line says who takes pictures');
  check(W.madeWords(['Bluesky', 'Mastodon'], []) === 'Two drafts made for Bluesky and Mastodon: each waits above for your APPROVE.', `made: ${W.madeWords(['Bluesky', 'Mastodon'], [])}`);
  check(/^Draft made for Bluesky: it waits above for your APPROVE\. Not for Mastodon: Mastodon takes 500 characters at most\. Your words are still here/.test(W.madeWords(['Bluesky'], [{ name: 'Mastodon', why: 'Mastodon takes 500 characters at most.' }])), 'made for one, not the other, said whole');
  check(W.accountsWords(ACCOUNTS) === 'Linked: Bluesky as spec.bsky.social, Mastodon as @spec@mastodon.social, Discord as Spec bot in Spec server. Not linked: your Telegram channel (under Accounts, with the steps).', `accounts: ${W.accountsWords(ACCOUNTS)}`);
  check(/can’t reach my brain/.test(W.accountsWords(null)) && /Try again/.test(W.accountsWords(null)), 'the brain not answering, said with what to do');
  check(/APPROVE/.test(W.SENT_EMPTY) && /Try again/.test(W.SENT_ERROR) && /Try again/.test(W.accountOffline('Bluesky')), 'SENT TODAY and the panels say their states');
  for (const s of [W.KEPT_NOTE, W.ALT_MISSING, W.PICTURE_NO(['Discord']), W.PICTURE_BIG, W.PICTURE_KINDS]) check(!RAW.test(s) && s.length < 160, `a short plain line: ${s}`);

  // ---- 2. the proof in the source: one call to approve in the whole app (apps/web/src), behind the APPROVE key only
  const { readdirSync, statSync } = await import('node:fs');
  const root = new URL('../../apps/web/src/', import.meta.url);
  const walk = (u) => readdirSync(u).flatMap((f) => (statSync(new URL(f, u)).isDirectory() ? walk(new URL(`${f}/`, u)) : f.endsWith('.ts') ? [new URL(f, u)] : []));
  const calls = walk(root).flatMap((u) => [...readFileSync(u, 'utf8').matchAll(/\.socialApprove\(/g)].map(() => u.pathname.split('/apps/web/src/')[1]));
  check(calls.length === 1 && calls[0] === 'features/links/drafts.ts', `exactly one call to approve in the app, in the draft card: ${calls.join(', ')}`);
  const drafts = readFileSync(new URL('features/links/drafts.ts', root), 'utf8');
  check([...drafts.matchAll(/\bapprove\(d, /g)].length === 1 && /button\(sendKey\(d\.state\), \(b\) => void approve\(d, b, after\)/.test(drafts), 'approve() runs only from the APPROVE key his finger taps');
  const queue = readFileSync(new URL('features/social/queue.ts', root), 'utf8');
  check(!/socialApprove|social\/approve|setInterval/.test(queue) && /draftWith\(\{ account: a\.id/.test(queue), 'WRITE A POST only ever asks for drafts, and runs on no timer');

  // ---- 3. the composer, whole, at both sizes, BODY 21
  for (const vp of [PHONE, PHONE2]) {
    const { ctx, page } = await phone(vp, 'scan', {}, 21);
    const s = await standIn(page);
    await open(page, 'social');
    await page.waitForSelector('#pg-social .soccompose textarea', { timeout: 15000 }).catch(() => check(false, `[${vp.width}] no WRITE A POST box`));
    const acc = await page.textContent('#pg-social .socacc').catch(() => '');
    check(/^Linked: Bluesky as spec\.bsky\.social, Mastodon as @spec@mastodon\.social, Discord as/.test(acc ?? '') && /Not linked: your Telegram channel/.test(acc ?? ''), `[${vp.width}] each account's state in words: ${acc}`);
    const keys = await page.$$eval('#pg-social .soccompose [role=group] button', (b) => b.map((x) => `${x.textContent.trim()}:${x.getAttribute('aria-pressed')}`));
    check(keys.join(',') === 'Bluesky:true,Mastodon:false,Discord:false', `[${vp.width}] his linked accounts, Bluesky chosen first: ${keys.join(',')}`);
    // two accounts at once
    await page.click('#pg-social .soccompose [role=group] button:has-text("Mastodon")');
    await page.waitForFunction(() => document.querySelectorAll('#pg-social .soccompose [role=group] button[aria-pressed=true]').length === 2, null, { timeout: 3000 }).catch(() => check(false, `[${vp.width}] Mastodon did not join`));
    check((await page.textContent('#pg-social .socto')) === 'To Bluesky and Mastodon: two drafts, and each waits for its own APPROVE.', `[${vp.width}] where it goes: ${await page.textContent('#pg-social .socto')}`);
    const key = (await page.textContent('#pg-social .soccompose .keyrow button.on:not([aria-pressed])').catch(() => '')).trim();
    check(/^make 2 drafts$/i.test(key), `[${vp.width}] the key says two drafts: ${key}`);
    // each account counts its own way: an emoji family is one on Bluesky, several letters elsewhere
    await page.fill('#pg-social .soccompose textarea', 'Canal walk 👨‍👩‍👧');
    const count = await page.textContent('#pg-social .soccount');
    check(count === 'Bluesky 12 of 300 · Mastodon 16 of 500', `[${vp.width}] each account's own count: ${count}`);
    // kept on the phone: leave and come back (a reload), the words and both accounts are still there
    await page.reload();
    await page.waitForSelector('#boot', { state: 'detached', timeout: 30000 });
    await open(page, 'social');
    await page.waitForSelector('#pg-social .soccompose textarea', { timeout: 15000 });
    check((await page.inputValue('#pg-social .soccompose textarea')) === 'Canal walk 👨‍👩‍👧', `[${vp.width}] his words were kept across a reload`);
    check((await page.$$('#pg-social .soccompose [role=group] button[aria-pressed=true]')).length === 2, `[${vp.width}] the two accounts were kept across a reload`);
    check(/stay on this phone/.test(await page.textContent('#pg-social .sockept').catch(() => '')), `[${vp.width}] it says the words stay on the phone`);
    // a picture: its words first, then two drafts, each with the picture and its words
    check(/Bluesky and Mastodon take one picture/.test(await page.textContent('#pg-social .socpicl').catch(() => '')), `[${vp.width}] it says the picture can go`);
    await page.setInputFiles('#pg-social .soccompose input[type=file]', { name: 'canal.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('#pg-social .soccompose img.socthumb', { timeout: 5000 }).catch(() => check(false, `[${vp.width}] the picture did not show`));
    check(/keeps this picture for 24 hours/.test(await page.textContent('#pg-social .socpick').catch(() => '')), `[${vp.width}] it says where the picture is kept, and for how long`);
    await page.click('#pg-social .soccompose .keyrow button:has-text("2 drafts")');
    check(/Say what is in the picture first/.test(await page.textContent('#pg-social .socmsg')), `[${vp.width}] no draft without the picture's words: ${await page.textContent('#pg-social .socmsg')}`);
    check(!s.asked.some((a) => /draft|lens/.test(a)), `[${vp.width}] nothing was asked of the brain before the picture had its words`);
    // Discord takes no pictures: said, and nothing made
    await page.click('#pg-social .soccompose [role=group] button:has-text("Discord")');
    await page.fill('#pg-social .soccompose input.socalt', 'The canal at dusk, two swans');
    await page.click('#pg-social .soccompose .keyrow button:has-text("3 drafts")');
    check(/^Discord takes no pictures\. Take the picture off, or untick it\.$/.test(await page.textContent('#pg-social .socmsg')), `[${vp.width}] Discord with a picture is refused in words: ${await page.textContent('#pg-social .socmsg')}`);
    await page.click('#pg-social .soccompose [role=group] button:has-text("Discord")');
    const fc = await fit(page, '#pg-social .soccompose');
    check(!fc.small.length && !fc.sideways && !fc.cut.length, `[${vp.width}] WRITE A POST with a picture fits: ${JSON.stringify(fc)}`);
    if (vp === PHONE) await page.screenshot({ path: `${H.out}/planlane-social-compose-${vp.width}.png` });
    await page.click('#pg-social .soccompose .keyrow button:has-text("2 drafts")');
    await page.waitForFunction(() => /2 waiting for your APPROVE/.test(document.querySelector('#pg-social .pknote')?.textContent ?? ''), null, { timeout: 8000 }).catch(async () => check(false, `[${vp.width}] two drafts did not wait in the queue: ${await page.textContent('#pg-social .pknote')}`));
    check(s.bodies.length === 2 && s.bodies.map((b) => b.account).join(',') === 'bluesky,mastodon' && s.bodies.every((b) => b.image === 'SpecPicture00001' && b.alt === 'The canal at dusk, two swans' && b.text === 'Canal walk 👨‍👩‍👧'), `[${vp.width}] two drafts, each with the picture and its words: ${JSON.stringify(s.bodies)}`);
    check(s.asked.filter((a) => a === 'POST /api/lens/share').length === 1, `[${vp.width}] the picture was kept once for both`);
    check(/^Two drafts made for Bluesky and Mastodon/.test(await page.textContent('#pg-social .socmsg')), `[${vp.width}] what was made, said: ${await page.textContent('#pg-social .socmsg')}`);
    const approves = await page.$$eval('#pg-social .socq .draftcard button', (b) => b.filter((x) => /approve/i.test(x.textContent)).length);
    check(approves === 2, `[${vp.width}] each draft has its own APPROVE: ${approves}`);
    check(!(await page.inputValue('#pg-social .soccompose textarea')) && !(await page.$('#pg-social .soccompose img.socthumb')), `[${vp.width}] the box is clear once the drafts are made`);
    check((await page.evaluate(() => localStorage.getItem('ghosty.social.compose'))) === null || !/Canal/.test(await page.evaluate(() => localStorage.getItem('ghosty.social.compose'))), `[${vp.width}] the kept words are let go once made`);
    // nothing approved by the page: then his one tap on one APPROVE asks once, for that draft only
    check(!s.asked.some((a) => /approve/.test(a)), `[${vp.width}] the page never asked to approve: ${s.asked.join(', ')}`);
    await page.locator('#pg-social .socq .draftcard').first().locator('button', { hasText: /approve/i }).click();
    await page.waitForFunction(() => /1 waiting for your APPROVE/.test(document.querySelector('#pg-social .pknote')?.textContent ?? ''), null, { timeout: 8000 }).catch(() => undefined);
    check(s.asked.filter((a) => /approve/.test(a)).length === 1, `[${vp.width}] one tap, one approve: ${s.asked.filter((a) => /approve/.test(a)).join(', ')}`);
    // SENT TODAY: what went out with its link, a key at 44 pt
    await page.waitForFunction(() => document.querySelectorAll('#pg-social .socsent').length === 2, null, { timeout: 8000 }).catch(() => undefined);
    const sentLine = await page.textContent('#pg-social .socsentl').catch(() => '');
    check(sentLine === '2 things went out today, each after your APPROVE:', `[${vp.width}] SENT TODAY shows what his APPROVE just sent, at once: ${sentLine}`);
    const lk = await page.$$eval('#pg-social a.socopen', (a) => a.map((x) => ({ t: x.textContent, h: x.getBoundingClientRect().height, href: x.getAttribute('href') }))).catch(() => []);
    check(lk.length === 2 && lk.every((x) => x.h >= 43.5 && (/on Bluesky/.test(x.t) ? /^https:\/\/bsky\.app\//.test(x.href) : /on Mastodon/.test(x.t) && /^https:\/\/mastodon\.social\//.test(x.href))), `[${vp.width}] each one links to where it went out, at 44 pt: ${JSON.stringify(lk)}`);
    const fp = await fit(page, '#pg-social');
    check(!fp.small.length && !fp.sideways && !fp.cut.length, `[${vp.width}] SOCIAL fits at BODY 21: ${JSON.stringify(fp)}`);
    await ctx.close();
  }
  log('social: the composer at both sizes');

  // ---- 4. the brain not answering: the queue, the composer and the accounts say so, and show no link form on a guess
  {
    const { ctx, page } = await phone(PHONE2, 'scan', { 'ghosty.social.compose': JSON.stringify({ text: 'Words written before the signal went', to: ['bluesky'], alt: '' }) }, 21);
    await standIn(page, { offline: true });
    await open(page, 'social');
    await page.waitForFunction(() => /can’t reach my brain/.test(document.querySelector('#pg-social .pknote')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => check(false, 'the queue did not say the brain is not answering'));
    check(/can’t reach my brain/.test(await page.textContent('#pg-social .socacc').catch(() => '')), 'the composer says the brain is not answering');
    check(/stay on this phone/.test(await page.textContent('#pg-social .soccompose').catch(() => '')), 'and that his words are still kept');
    await openSection(page, 'social', 'Accounts');
    await page.waitForSelector('#pg-social .socoff', { timeout: 8000 }).catch(() => check(false, 'the account panels did not say the brain is not answering'));
    const off = await page.$$eval('#pg-social .pn.socialpanel', (p) => p.map((x) => ({ off: !!x.querySelector('.socoff'), form: !!x.querySelector('input'), retry: [...x.querySelectorAll('button')].some((b) => /try again/i.test(b.textContent)) })));
    check(off.length === 4 && off.every((x) => x.off && !x.form && x.retry), `every account panel says it and offers TRY AGAIN, with no form: ${JSON.stringify(off)}`);
    const fo = await fit(page, '#pg-social');
    check(!fo.small.length && !fo.sideways && !fo.cut.length, `the panels fit at BODY 21: ${JSON.stringify(fo)}`);
    await ctx.close();
  }
  log('social: offline');

  // ---- 5. the seven looks: the composer with a picture fits, and its words are drawn in the look's colours
  for (const world of WORLDS) {
    const { ctx, page } = await phone(PHONE2, world, { 'ghosty.social.compose': JSON.stringify({ text: 'A post long enough to wrap onto a second line at the largest text, in every look', to: ['bluesky', 'mastodon'], alt: 'Two swans' }) }, 21);
    await standIn(page);
    await open(page, 'social');
    await page.waitForSelector('#pg-social .soccompose textarea', { timeout: 15000 }).catch(() => check(false, `[${world}] no WRITE A POST`));
    await page.setInputFiles('#pg-social .soccompose input[type=file]', { name: 'canal.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('#pg-social .soccompose img.socthumb', { timeout: 5000 }).catch(() => check(false, `[${world}] the picture did not show`));
    const f = await fit(page, '#pg-social');
    check(!f.small.length && !f.sideways && !f.cut.length, `[${world}] SOCIAL fits: ${JSON.stringify(f)}`);
    const c = await page.$eval('#pg-social .socto', (e) => ({ color: getComputedStyle(e).color, bg: getComputedStyle(document.body).backgroundColor })).catch(() => null);
    check(c && c.color !== c.bg && c.color !== 'rgba(0, 0, 0, 0)', `[${world}] the composer's words are drawn in a colour of the look: ${JSON.stringify(c)}`);
    if (world === 'glass') await page.screenshot({ path: `${H.out}/planlane-social-glass.png` });
    await ctx.close();
  }
  log('social: seven looks');
}
