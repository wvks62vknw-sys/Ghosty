// Keeping the owner's data (SYSTEM → STORAGE, BACKUP & RESTORE) and the pairing form, in a real browser:
//  - the pairing form is a proper sign-in form (iPhone's Passwords can save and fill the key) and still pairs;
//  - the STORAGE line says in plain words whether the phone keeps Ghosty's data;
//  - BACK UP NOW seals what lives only on the phone and the brain keeps ciphertext only;
//  - then everything is wiped (localStorage + IndexedDB, like Safari after 7 days), the phone pairs
//    again, the daily backup does NOT put the empty phone over the good copy, and RESTORE brings
//    the courses/flashcards, the space plan, radio favourites and a library document back.
//   BASE=http://localhost:8852 node tests/backup.spec.mjs [outDir]
//   ENGINE=webkit PLAYWRIGHT_BROWSERS_PATH=/tmp/claude-0/wk/browsers … (Safari's engine)
import { chromium, webkit } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'tests/.shots';
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://localhost:8788';
const engine = process.env.ENGINE === 'webkit' ? webkit : chromium;
const KEY = 'preview-owner-key-0123456789';
const problems = [];
const check = (ok, what) => void (ok || problems.push(what));

const browser = await engine.launch(process.env.ENGINE === 'webkit' ? {} : { executablePath: process.env.CHROMIUM ?? undefined });
// No service worker: in WebKit, requests from a page it controls would slip past page.route below.
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
const page = await ctx.newPage();
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('dialog', (d) => void d.accept());

const pair = async () => {
  await page.waitForSelector('#pair input', { timeout: 20000 });
  await page.fill('#pair input', KEY);
  await page.click('#pair button.on');
  await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
};
const toSystem = async () => {
  await page.evaluate(() => (location.hash = 'system'));
  await page.waitForSelector('#pg-system .storageline', { timeout: 10000 });
};

// ---- 1. the pairing form
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#pair input', { timeout: 20000 });
const form = await page.evaluate(() => {
  const f = document.querySelector('form#pairform');
  const user = f?.querySelector('input[autocomplete="username"]');
  const key = document.querySelector('#pair input');
  const unlock = document.querySelector('#pair button.on');
  return {
    form: !!f,
    userInForm: !!user && user.form === f,
    userValue: user?.value,
    userName: user?.getAttribute('name'),
    userBefore: !!user && !!key && !!(user.compareDocumentPosition(key) & Node.DOCUMENT_POSITION_FOLLOWING),
    userHidden: !!user && user.getBoundingClientRect().width <= 1 && user.getBoundingClientRect().height <= 1 && getComputedStyle(user).display !== 'none',
    userRect: user ? JSON.stringify(user.getBoundingClientRect()) : '',
    keyType: key?.getAttribute('type'),
    keyAuto: key?.getAttribute('autocomplete'),
    keyName: key?.getAttribute('name'),
    keyInForm: key?.form === f,
    unlockSubmits: unlock?.getAttribute('type') === 'submit' && unlock?.form === f,
    tip: document.querySelector('#pair .pairtip')?.textContent ?? '',
    offline: [...document.querySelectorAll('#pair button')].find((b) => b.textContent === 'CONTINUE OFFLINE')?.getAttribute('type'),
  };
});
check(form.form && form.keyInForm && form.userInForm, `the key and the username are not in one <form>: ${JSON.stringify(form)}`);
check(form.userValue === 'Ghosty owner' && form.userName === 'username' && form.userBefore && form.userHidden, `username field wrong: ${JSON.stringify(form)}`);
check(form.keyType === 'password' && form.keyAuto === 'current-password' && form.keyName === 'password', `key field is not a saved-password field: ${JSON.stringify(form)}`);
check(form.unlockSubmits, 'UNLOCK does not submit the form');
check(form.offline === 'button', 'CONTINUE OFFLINE would submit the form');
check(/Tip: let iPhone save this in Passwords — next time Face ID fills it in\./.test(form.tip), `tip line missing: "${form.tip}"`);
// A wrong key first (Enter in the field submits, no page load), then the right one.
await page.fill('#pair input', 'not-the-key-0000000000');
await page.press('#pair input', 'Enter');
await page.waitForFunction(() => /not accepted/.test(document.querySelector('#pair p.note')?.textContent ?? ''), null, { timeout: 10000 }).catch(() => problems.push('a wrong key was not refused in place'));
check(await page.$('#pair') !== null, 'the form went away after a wrong key');
await page.fill('#pair input', KEY);
await page.click('#pair button.on');
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
check((await page.$('#pairform')) === null, 'the sign-in form is still there after pairing (Safari needs it gone to offer saving)');
check((await page.evaluate(() => localStorage.getItem('ghosty.ownerKey'))) === KEY, 'pairing did not keep the key');

// ---- 2. seed what lives only on this phone, then look at STORAGE
// The library document below was added while the brain could not take it: its upload keeps failing,
// so it stays "on this device only" (the brain's own documents are never in the backup — it has them).
await page.route('**/api/library/docs', (r) => (r.request().method() === 'POST' ? r.abort() : r.continue()));
await page.evaluate(async () => {
  const card = { id: 'card-1', course: 'c1', front: 'BACKUP-MARKER-front', back: 'back', added: 1, ef: 2.5, reps: 1, interval: 1, due: Date.now() + 86_400_000, lapses: 0, last: Date.now() };
  localStorage.setItem('ghosty.learn', JSON.stringify({ courses: [{ id: 'c1', topic: 'bridges', title: 'Bridges 101', level: 'beginner', minutes: 30, lessons: 3, done: 1, next: 2, nextTitle: 'Arches' }], cards: [card], full: {}, quizzes: [], pending: [], pendingDone: [], synced: 0 }));
  localStorage.setItem('ghosty.space', JSON.stringify({ plan: { v: 1, room: { w: 512, d: 333 }, items: [{ id: 'piano', kind: 'sofa3', label: 'Grand piano', w: 150, d: 150, x: 10, y: 10, rot: 0 }] }, measures: [] }));
  localStorage.setItem('ghosty.radio.favs', JSON.stringify([{ name: 'Marker FM', url: 'https://radio.example/marker' }]));
  // A document kept only on this phone (the brain has not got it yet).
  await new Promise((ok, bad) => {
    const r = indexedDB.open('ghosty-library', 2);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pass')) db.createObjectStore('pass', { keyPath: ['doc', 'n'] });
    };
    r.onsuccess = () => {
      const db = r.result;
      const tx = db.transaction(['docs', 'pass'], 'readwrite');
      tx.objectStore('docs').put({ id: 'local-marker', title: 'Marker notes', source: 'typed on the phone', kind: 'note', pages: 1, count: 1, chars: 26, at: Date.now() });
      tx.objectStore('pass').put({ doc: 'local-marker', n: 0, text: 'BACKUP-MARKER passage text' });
      tx.oncomplete = () => {
        db.close();
        ok();
      };
      tx.onerror = () => bad(tx.error);
    };
    r.onerror = () => bad(r.error);
  });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
await toSystem();
const line = await page.textContent('#pg-system .storageline');
check(/^STORAGE: (PROTECTED( · [\d.]+ MB used)?|NOT PROTECTED — .+)$/.test(line ?? ''), `storage line not in plain words: "${line}"`);
if (/NOT PROTECTED/.test(line ?? '')) {
  const canAsk = await page.evaluate(() => !!navigator.storage?.persisted);
  if (canAsk) {
    check(/add Ghosty to your Home Screen \(Share → Add to Home Screen\) so iPhone keeps your data|press PROTECT/.test(line), `no Home Screen advice: "${line}"`);
    check(!!(await page.$('#pg-system button:has-text("PROTECT")')), 'no PROTECT button while not protected');
  } else check(/cannot be asked|add Ghosty to your Home Screen/.test(line), `no plain words for a browser that cannot be asked: "${line}"`);
}

// ---- 3. BACK UP NOW
const before = Date.now();
await page.click('#pg-system button:has-text("BACK UP NOW")');
await page.waitForFunction((t) => (JSON.parse(localStorage.getItem('ghosty.backup.last') ?? 'null')?.at ?? 0) >= t, before, { timeout: 30000 }).catch(() => problems.push('BACK UP NOW never finished'));
check((await page.evaluate(() => JSON.parse(localStorage.getItem('ghosty.backup.last') ?? 'null')?.ok)) === true, `BACK UP NOW failed: ${await page.textContent('#pg-system .backupmsg').catch(() => '')}`);
await page.waitForSelector('#pg-system [data-backup]', { timeout: 30000 }).catch(async () => problems.push(`no backup listed after BACK UP NOW: ${await page.textContent('#pg-system .backupmsg').catch(() => '')}`));
const kept = await page.evaluate(async (key) => {
  const h = { 'x-ghosty': '1', 'x-ghosty-key': key };
  const list = await (await fetch('/api/backup', { headers: h })).json();
  const one = await (await fetch(`/api/backup/${list.backups[0]?.id}`, { headers: h })).json();
  return { list, text: JSON.stringify(one) };
}, KEY);
check(kept.list.backups?.length === 1, `brain lists ${kept.list.backups?.length} backups`);
check(!/MARKER|Bridges|piano/i.test(kept.text), 'the brain holds readable data — the backup must be sealed on the phone');
check(/"kdf":"PBKDF2-SHA256"/.test(kept.text) && /"ct":"/.test(kept.text), `not a sealed envelope: ${kept.text.slice(0, 200)}`);
await page.screenshot({ path: `${out}/backup-system.png`, fullPage: true });

// ---- 4. Safari wipes everything (and the owner key with it)
await page.evaluate(async () => {
  localStorage.clear();
  await new Promise((ok) => {
    const r = indexedDB.deleteDatabase('ghosty-library');
    r.onsuccess = r.onerror = r.onblocked = () => ok();
  });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await pair();
const gone = await page.evaluate(() => ({ learn: localStorage.getItem('ghosty.learn'), space: localStorage.getItem('ghosty.space') }));
check(!/MARKER/.test(gone.learn ?? '') && !/piano/i.test(gone.space ?? ''), 'the wipe did not wipe');
await toSystem();
await page.waitForSelector('#pg-system .wiped', { timeout: 10000 }).catch(() => problems.push('no "restore first" advice on a wiped phone with backups in the brain'));
// The daily backup (20 s after start) must not put the empty phone over the good copy now.
await page.waitForTimeout(23000);
const still = await page.evaluate(async (key) => (await (await fetch('/api/backup', { headers: { 'x-ghosty': '1', 'x-ghosty-key': key } })).json()).backups, KEY);
check(still.length === 1 && still[0].at === kept.list.backups[0].at, `the daily backup replaced the good copy on a wiped phone: ${JSON.stringify(still)}`);

// ---- 5. RESTORE
await page.click('#pg-system [data-backup] button:has-text("RESTORE")');
await page.waitForFunction(() => /Put back:/.test(document.querySelector('#pg-system .backupmsg')?.textContent ?? ''), null, { timeout: 30000 }).catch(() => problems.push('no restore report'));
const report = (await page.textContent('#pg-system .backupmsg').catch(() => '')) ?? '';
check(/courses, lessons and flashcards/.test(report) && /space plan/.test(report) && /1 document kept only on this phone put back/.test(report), `restore report: "${report}"`);
await page.screenshot({ path: `${out}/backup-restored.png`, fullPage: true });
await page.waitForEvent('load', { timeout: 15000 }).catch(() => undefined); // it reloads itself
await page.waitForSelector('#boot', { state: 'detached', timeout: 20000 });
const back = await page.evaluate(async () => {
  const doc = await new Promise((ok) => {
    const r = indexedDB.open('ghosty-library');
    r.onsuccess = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('pass')) return ok(null);
      const g = db.transaction('pass', 'readonly').objectStore('pass').get(['local-marker', 0]);
      g.onsuccess = () => ok(g.result?.text ?? null);
      g.onerror = () => ok(null);
    };
    r.onerror = () => ok(null);
  });
  return { learn: localStorage.getItem('ghosty.learn') ?? '', space: localStorage.getItem('ghosty.space') ?? '', favs: localStorage.getItem('ghosty.radio.favs') ?? '', key: localStorage.getItem('ghosty.ownerKey'), doc };
});
check(/BACKUP-MARKER-front/.test(back.learn) && /Bridges 101/.test(back.learn), 'flashcards/courses not back');
check(/Grand piano/.test(back.space) && /"w":512/.test(back.space), 'space plan not back');
check(/Marker FM/.test(back.favs), 'radio favourites not back');
check(back.doc === 'BACKUP-MARKER passage text', `library document not back: ${back.doc}`);
check(back.key === KEY, 'the owner key was lost by the restore');

await browser.close();
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'Backup run clean: sign-in form for Passwords, storage line, sealed backup, wipe, restore with everything back.');
process.exit(problems.length ? 1 : 0);
