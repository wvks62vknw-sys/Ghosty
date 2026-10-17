// SCAN on the phone, the parts that need no browser: the PDF writer's byte layout (header, every
// object where the cross-reference table says, the page tree, JPEG streams of the right length),
// what a scanned code is (web address and its warnings, Wi-Fi, vCard and MECARD, geo, email,
// phone, SMS, ISBN, product, text), barcode check digits, and finding and straightening a page.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const PDF = await import('./.build/scan/pdf.mjs');
const C = await import('./.build/scan/codes.mjs');
const P = await import('./.build/scan/page.mjs');

const latin1 = (b) => Buffer.from(b).toString('latin1');
/** A stand-in JPEG: the start and end markers around some bytes (the writer never looks inside). */
const fakeJpeg = (n) => new Uint8Array([0xff, 0xd8, ...Array.from({ length: n }, (_, i) => i % 251), 0xff, 0xd9]);

test('the PDF: header, objects where the xref says, page tree, JPEG streams, trailer', () => {
  const pages = [
    { jpeg: fakeJpeg(300), w: 1131, h: 1600 },
    { jpeg: fakeJpeg(120), w: 1600, h: 1131 },
  ];
  const bytes = PDF.makePdf(pages, { title: 'Scan (test) \\ é' });
  const s = latin1(bytes);
  assert.ok(s.startsWith('%PDF-1.4\n%'));
  assert.deepEqual([...bytes.subarray(10, 14)], [0xe2, 0xe3, 0xcf, 0xd3], 'binary marker comment');
  assert.ok(s.endsWith('%%EOF\n'));
  const startxref = Number(s.match(/startxref\n(\d+)\n%%EOF\n$/)[1]);
  assert.equal(s.slice(startxref, startxref + 5), 'xref\n');
  const table = s.slice(startxref).match(/^xref\n0 (\d+)\n([\s\S]*?)trailer/);
  const count = Number(table[1]);
  assert.equal(count, 1 + 3 + 3 * pages.length);
  const entries = table[2].match(/.{18}\r\n/g);
  assert.equal(entries.length, count, 'every entry is 20 bytes');
  assert.equal(entries[0], '0000000000 65535 f\r\n');
  for (let n = 1; n < count; n++) {
    const off = Number(entries[n].slice(0, 10));
    assert.equal(s.slice(off, off + `${n} 0 obj`.length), `${n} 0 obj`, `object ${n} is at its offset`);
  }
  assert.match(s, /\/Size 10 \/Root 1 0 R \/Info 3 0 R/);
  assert.match(s, /<< \/Type \/Pages \/Kids \[4 0 R 7 0 R\] \/Count 2 >>/);
  assert.match(s, /\/Title \(Scan \\\(test\\\) \\\\ \)/, 'title escaped, non-ASCII dropped');
  // the image streams carry exactly the JPEG's bytes
  const images = [...s.matchAll(/\/Width (\d+) \/Height (\d+) \/ColorSpace \/DeviceRGB \/BitsPerComponent 8 \/Filter \/DCTDecode \/Length (\d+) >>\nstream\n/g)];
  assert.equal(images.length, 2);
  images.forEach((m, i) => {
    assert.equal(Number(m[1]), pages[i].w);
    assert.equal(Number(m[3]), pages[i].jpeg.length);
    const at = m.index + m[0].length;
    assert.deepEqual([...bytes.subarray(at, at + pages[i].jpeg.length)], [...pages[i].jpeg]);
    assert.equal(s.slice(at + pages[i].jpeg.length, at + pages[i].jpeg.length + 10), '\nendstream');
  });
  // portrait page on portrait A4, landscape on landscape; contents streams' lengths are right
  assert.match(s, /4 0 obj\n<< \/Type \/Page \/Parent 2 0 R \/MediaBox \[0 0 595\.28 841\.89\]/);
  assert.match(s, /7 0 obj\n<< \/Type \/Page \/Parent 2 0 R \/MediaBox \[0 0 841\.89 595\.28\]/);
  for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n(q [^\n]* Do Q\n)endstream/g)) assert.equal(Number(m[1]), m[2].length);
  assert.throws(() => PDF.makePdf([]), /at least one page/);
});

test('a picture is placed as big as fits, centred', () => {
  const a = PDF.placeOnPage(1000, 1000, { w: 600, h: 800 });
  assert.deepEqual(a, { x: 0, y: 100, w: 600, h: 600 });
});

test('check digits: EAN-13, EAN-8, UPC-A, ISBN-10; a book is 978/979 but not 979-0', async () => {
  const S = await import('./.build/scan/codes.mjs');
  const kinds = (t, f) => S.classifyCode(t, f).kind;
  assert.equal(kinds('3017620422003', 'EAN13'), 'product');
  assert.equal(kinds('3017620422004', 'EAN13'), 'text', 'a wrong check digit is not a product');
  assert.equal(kinds('96385074', 'EAN8'), 'product');
  assert.equal(kinds('036000291452', 'UPCA'), 'product');
  assert.equal(kinds('9780140328721', 'EAN13'), 'isbn');
  assert.equal(kinds('0140328726', ''), 'isbn');
  assert.equal(kinds('9790260000438', 'EAN13'), 'product', 'sheet music (979-0) is not a book');
  assert.equal(S.classifyCode('9780140328721', 'EAN-13').code, '9780140328721');
  // UPC-E: checked and looked up as the UPC-A it stands for, whichever reader named it
  assert.equal(S.expandUpcE('03917139'), '039100000719');
  assert.equal(S.expandUpcE('04451266'), '044512000066');
  assert.equal(S.expandUpcE('01234505'), '012000003455');
  assert.equal(S.expandUpcE('01234531'), '012300000451');
  assert.equal(S.expandUpcE('01234544'), '012340000054');
  assert.deepEqual(S.classifyCode('03917139', 'UPCE'), { kind: 'product', raw: '03917139', code: '039100000719' });
  assert.equal(S.classifyCode('04451266', 'upc_e').code, '044512000066');
  assert.equal(kinds('03917138', 'UPCE'), 'text', 'a wrong UPC-E check digit is not a product');
});

test('a web address: the real site picked out, and warnings for the usual tricks', () => {
  const ok = C.classifyCode('https://www.bbc.co.uk/news?x=1', 'QRCode');
  assert.equal(ok.kind, 'url');
  assert.equal(ok.url.host, 'www.bbc.co.uk');
  assert.equal(ok.url.domain, 'bbc.co.uk');
  assert.deepEqual(ok.url.warnings, []);
  const w = (u) => C.urlParts(u).warnings.join(' | ');
  assert.match(w('http://example.com/'), /Not secure/);
  assert.match(w('https://paypal.com.secure-login.ru/verify'), /mentions "paypal" but the site really belongs to secure-login\.ru/);
  assert.match(w('https://xn--pypal-4ve.com/'), /look-alike letters/);
  assert.match(w('https://192.168.0.10/login'), /bare number address/);
  assert.match(w('https://www.google.com@evil.example/'), /hides its real destination behind an "@"/);
  assert.match(w('https://bit.ly/abc'), /link shortener/);
  assert.match(w('https://hmrc-tax-refund-claim.com/'), /mentions "hmrc"|joined by dashes/);
  assert.equal(w('https://www.paypal.com/signin'), '', 'the real site is not flagged');
  // a brand's name registered under someone else's suffix is not the brand
  assert.match(w('https://barclays.co.ua/login'), /mentions "barclays" but the site really belongs to barclays\.co\.ua/);
  assert.match(w('https://paypal.com.ru/signin'), /mentions "paypal" but the site really belongs to paypal\.com\.ru/);
  assert.match(w('https://paypal.ru/x'), /mentions "paypal"/);
  assert.match(w('https://microsoft.azurewebsites.net/'), /mentions "microsoft"/);
  // Amazon's shared hosting is anyone's: a bucket named after Amazon is not Amazon
  assert.match(w('https://amazon-account-verify.s3.amazonaws.com/login.html'), /mentions "amazon"/);
  for (const real of ['https://www.barclays.co.uk/', 'https://www.tax.service.gov.uk/', 'https://www.hmrc.gov.uk/', 'https://www.nhs.uk/', 'https://www.amazon.co.uk/', 'https://outlook.office.com/mail', 'https://www.gov.uk/'])
    assert.equal(w(real), '', `${real} is the real site`);
  assert.equal(C.registrableDomain('a.b.example.com.au'), 'example.com.au');
  assert.equal(C.classifyCode('www.example.org/menu').url.scheme, 'http');
  assert.equal(C.classifyCode('javascript:alert(1)').kind, 'text', 'no scheme but http(s) is a link');
});

test('Wi-Fi, contacts, places, email, phone, SMS and plain text', () => {
  const wifi = C.classifyCode('WIFI:T:WPA;S:Home\\;Net;P:pa\\:ss\\\\word;H:true;;');
  assert.deepEqual(wifi.wifi, { ssid: 'Home;Net', security: 'WPA', password: 'pa:ss\\word', hidden: true });
  assert.equal(C.classifyCode('WIFI:S:Cafe;T:nopass;;').wifi.security, 'open (no password)');
  assert.doesNotMatch(C.describeCode(wifi), /pa:ss/, 'the password stays out of what is sent or saved');
  const v = C.classifyCode('BEGIN:VCARD\r\nVERSION:3.0\r\nN:Smith;Jane;;;\r\nFN:Jane Smith\r\nORG:Acme Ltd\r\nTEL;TYPE=CELL:+44 7700 900123\r\nEMAIL:jane@example.com\r\nADR;TYPE=WORK:;;1 High St;Birmingham;;B1 1AA;UK\r\nURL:https://acme.example\r\nEND:VCARD');
  assert.equal(v.kind, 'contact');
  assert.deepEqual(v.contact, { name: 'Jane Smith', org: 'Acme Ltd', phones: ['+44 7700 900123'], emails: ['jane@example.com'], urls: ['https://acme.example'], address: '1 High St, Birmingham, B1 1AA, UK' });
  const me = C.classifyCode('MECARD:N:Smith,Jane;TEL:01214960000;EMAIL:j@example.com;;');
  assert.equal(me.contact.name, 'Jane Smith');
  assert.deepEqual(me.contact.phones, ['01214960000']);
  const g = C.classifyCode('geo:52.4797,-1.9026?q=Bullring');
  assert.deepEqual(g.geo, { lat: 52.4797, lon: -1.9026, label: 'Bullring' });
  assert.equal(C.classifyCode('geo:95,10').kind, 'text');
  const m = C.classifyCode('mailto:hello@example.com?subject=Hi%20there&body=Yes');
  assert.deepEqual(m.email, { to: 'hello@example.com', subject: 'Hi there', body: 'Yes' });
  assert.equal(C.classifyCode('MATMSG:TO:a@b.co;SUB:Hey;BODY:Hi;;').email.subject, 'Hey');
  assert.equal(C.classifyCode('tel:+441214960000').phone, '+441214960000');
  assert.deepEqual(C.classifyCode('SMSTO:+447700900123:See you at 6').sms, { to: '+447700900123', body: 'See you at 6' });
  assert.equal(C.classifyCode('Table 12 — order at the bar').kind, 'text');
  assert.match(C.describeCode(g), /A place: 52\.4797, -1\.9026 \(Bullring\)/);
});

/** A grey picture: a dark table with a light page, its corners at `q`. */
function scene(w, h, q) {
  const g = new Uint8Array(w * h).fill(40);
  const inside = (x, y) => {
    for (let i = 0; i < 4; i++) {
      const a = q[i];
      const b = q[(i + 1) % 4];
      if ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x) < 0) return false;
    }
    return true;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (inside(x + 0.5, y + 0.5)) g[y * w + x] = 230;
  return g;
}

test('a light page on a dark table is found, its corners in order; nothing found on a blank picture', () => {
  const corners = [{ x: 60, y: 30 }, { x: 200, y: 50 }, { x: 190, y: 230 }, { x: 40, y: 210 }];
  const q = P.findPage(scene(256, 256, corners), 256, 256);
  assert.ok(q, 'found');
  q.forEach((p, i) => assert.ok(Math.hypot(p.x - corners[i].x, p.y - corners[i].y) < 4, `corner ${i}: ${JSON.stringify(p)} vs ${JSON.stringify(corners[i])}`));
  assert.equal(P.findPage(new Uint8Array(100 * 100).fill(128), 100, 100), null);
  assert.deepEqual(P.orderQuad([{ x: 10, y: 90 }, { x: 90, y: 10 }, { x: 10, y: 10 }, { x: 90, y: 90 }]), [{ x: 10, y: 10 }, { x: 90, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 90 }]);
  assert.equal(P.otsu([10, 10, 10, 200, 200, 200]) >= 10 && P.otsu([10, 10, 10, 200, 200, 200]) < 200, true);
});

test('straightening: corners go to the page corners, A4-shaped, and the page comes out light', () => {
  const quad = [{ x: 30, y: 20 }, { x: 170, y: 35 }, { x: 160, y: 230 }, { x: 25, y: 215 }];
  const to = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 141 }, { x: 0, y: 141 }];
  const H = P.homography(quad, to);
  quad.forEach((p, i) => {
    const r = P.applyH(H, p.x, p.y);
    assert.ok(Math.abs(r.x - to[i].x) < 1e-6 && Math.abs(r.y - to[i].y) < 1e-6);
  });
  const size = P.pageSize(quad, 282);
  assert.deepEqual(size, { w: 199, h: 282 });
  assert.deepEqual(P.pageSize([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 0, y: 100 }], 282), { w: 282, h: 199 });
  const w = 200;
  const h = 250;
  const gray = scene(w, h, quad);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < gray.length; i++) rgba.set([gray[i], gray[i], gray[i], 255], i * 4);
  const out = P.warpPage({ data: rgba, width: w, height: h }, quad, 60, 85);
  let light = 0;
  for (let i = 0; i < out.length; i += 4) if (out[i] > 200) light++;
  assert.ok(light / (60 * 85) > 0.95, `the straightened page is the page (${light} light of ${60 * 85})`);
  const e = P.enhance(new Uint8ClampedArray([100, 100, 100, 255, 150, 150, 150, 255, 120, 120, 120, 255, 140, 140, 140, 255]));
  assert.equal(e[0], 0);
  assert.equal(e[4], 255);
  assert.throws(() => P.homography([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], to), /do not make a page/);
});

test('the barcode reader ships both its licences: zxing-wasm (MIT) and zxing-cpp compiled into the wasm (Apache-2.0)', async () => {
  const { readFile } = await import('node:fs/promises');
  const dir = new URL('../../web/public/vendor/', import.meta.url);
  assert.match(await readFile(new URL('zxing/LICENSE', dir), 'utf8'), /MIT License/);
  const apache = await readFile(new URL('zxing/LICENSE-zxing-cpp.txt', dir), 'utf8');
  assert.match(apache, /zxing-cpp/);
  assert.match(apache, /Apache License\s+Version 2\.0, January 2004/);
  assert.match(apache, /4\. Redistribution\./);
  assert.match(await readFile(new URL('VISION.md', dir), 'utf8'), /zxing\/LICENSE-zxing-cpp\.txt/);
});
