// Email: IMAP reading and SMTP sending against fake in-memory servers (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';

const M = await import('./.build/integrations/mail.mjs');
const T = await import('./.build/tools/index.mjs');

const latin1 = (b) => Buffer.from(b).toString('latin1');
const b64 = (s) => Buffer.from(s, 'utf8').toString('base64');

/** A socket whose other end is `session` (a scripted server). Output is split into small chunks. */
function socketFor(session, chunk = 7) {
  let ctl;
  let closed = false;
  const readable = new ReadableStream({ start(c) { ctl = c; } });
  const push = (s) => {
    if (closed) return;
    const bytes = typeof s === 'string' ? Buffer.from(s, 'latin1') : Buffer.from(s);
    for (let i = 0; i < bytes.length; i += chunk) ctl.enqueue(new Uint8Array(bytes.subarray(i, i + chunk)));
  };
  const end = () => {
    if (closed) return;
    closed = true;
    try { ctl.close(); } catch {}
  };
  let buf = '';
  const writable = new WritableStream({
    write(data) {
      buf += latin1(data);
      for (;;) {
        if (session.dataMode) {
          const i = buf.indexOf('\r\n.\r\n');
          if (i < 0) return;
          const data = buf.slice(0, i + 2);
          buf = buf.slice(i + 5);
          session.onData(data);
          continue;
        }
        if (session.literal) {
          if (buf.length < session.literal) return;
          const lit = buf.slice(0, session.literal);
          buf = buf.slice(session.literal);
          session.literal = 0;
          session.pending += lit;
          continue;
        }
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const lit = line.match(/\{(\d+)\}$/);
        if (lit && session.pending !== undefined) {
          session.pending += line;
          session.literal = Number(lit[1]);
          push('+ go on\r\n');
          continue;
        }
        const full = (session.pending ?? '') + line;
        if (session.pending !== undefined) session.pending = '';
        session.onLine(full);
      }
    },
  });
  session.send = push;
  session.end = end;
  return {
    readable,
    writable,
    close() { end(); },
    startTls() {
      session.tlsUpgrades = (session.tlsUpgrades ?? 0) + 1;
      return socketFor(session, chunk);
    },
  };
}

function fakeConnect(make) {
  const log = [];
  const connect = async (host, port, tls) => {
    const session = make(host, port);
    log.push({ host, port, tls, session });
    const sock = socketFor(session);
    session.start();
    return sock;
  };
  return { connect, log };
}

function unquote(s) {
  return [...s.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\(.)/g, '$1'));
}

// ---------- the fake IMAP server ----------

const CRLF = '\r\n';
const msg = (lines) => lines.join(CRLF);
const MAILBOX = () => [
  {
    uid: 101,
    flags: [],
    raw: msg([
      `From: =?ISO-8859-1?Q?Ren=E9?= <rene@example.fr>`,
      'To: me@gmail.com',
      `Subject: =?UTF-8?B?${b64('Café réunion ')}?=`,
      `  =?UTF-8?B?${b64('☕ demain')}?=`,
      'Date: Wed, 14 Oct 2026 09:00:00 +0200',
      'Message-ID: <a101@example.fr>',
      '',
      'On se voit demain ?',
    ]),
  },
  { uid: 102, flags: ['\\Seen'], raw: msg(['From: Old <old@example.com>', 'Subject: already read', 'Date: Tue, 13 Oct 2026 09:00:00 +0000', 'Message-ID: <a102@example.com>', '', 'hello']) },
  {
    uid: 103,
    flags: [],
    raw: msg([
      'From: Boss <boss@example.com>',
      'To: me@gmail.com',
      'Subject: Quarterly report',
      'Date: Thu, 15 Oct 2026 08:00:00 +0000',
      'Message-ID: <a103@example.com>',
      'References: <a0@example.com>',
      'MIME-Version: 1.0',
      'Content-Type: multipart/mixed; boundary="outer"',
      '',
      'This is a multi-part message.',
      '--outer',
      'Content-Type: multipart/alternative; boundary=inner',
      '',
      '--inner',
      'Content-Type: text/plain; charset="utf-8"',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      'Hello=20world =E2=9C=93',
      'this line is soft=',
      'ly wrapped',
      '--inner',
      'Content-Type: text/html; charset=utf-8',
      'Content-Transfer-Encoding: base64',
      '',
      b64('<html><body><p>HTML version</p></body></html>'),
      '--inner--',
      '--outer',
      'Content-Type: application/pdf; name="report.pdf"',
      'Content-Disposition: attachment; filename="report.pdf"',
      'Content-Transfer-Encoding: base64',
      '',
      'JVBERi0xLjQK',
      '--outer--',
      '',
    ]),
  },
  {
    uid: 104,
    flags: ['\\Seen'],
    raw: msg([
      'From: News <news@example.com>',
      'Subject: Only HTML',
      'Content-Type: text/html; charset=iso-8859-1',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from('<style>p{color:red}</style><h1>Big news</h1><p>Caf\xe9 &amp; cr\xe8me</p>', 'latin1').toString('base64'),
    ]),
  },
];

function imapServer({ user = 'me@gmail.com', pass = 'abcdefghijklmnop', box = MAILBOX() } = {}) {
  const s = {
    commands: [],
    box,
    mode: null,
    pending: '',
    literal: 0,
    start() { s.send('* OK [CAPABILITY IMAP4rev1 LITERAL+] fake IMAP ready\r\n'); },
    onLine(line) {
      const m = line.match(/^(\S+) (UID \S+|\S+) ?(.*)$/);
      if (!m) return s.send('* BAD what\r\n');
      const [, tag, cmd, rest] = m;
      s.commands.push(cmd.toUpperCase() === 'LOGIN' ? 'LOGIN ***' : `${cmd} ${rest}`);
      const ok = (t = 'done') => s.send(`${tag} OK ${t}\r\n`);
      switch (cmd.toUpperCase()) {
        case 'LOGIN': {
          const [u, p] = unquote(rest);
          if (u === user && p === pass) return ok('LOGIN completed');
          return s.send(`${tag} NO [AUTHENTICATIONFAILED] Invalid credentials (Failure)\r\n`);
        }
        case 'EXAMINE':
        case 'SELECT':
          s.mode = cmd.toUpperCase();
          s.send(`* ${s.box.length} EXISTS\r\n* FLAGS (\\Seen)\r\n`);
          return ok(s.mode === 'EXAMINE' ? '[READ-ONLY] EXAMINE completed' : '[READ-WRITE] SELECT completed');
        case 'UID SEARCH': {
          let hits = s.box;
          if (/\bUNSEEN\b/.test(rest)) hits = hits.filter((x) => !x.flags.includes('\\Seen'));
          const from = rest.match(/FROM ("(?:[^"\\]|\\.)*")/);
          if (from) hits = hits.filter((x) => x.raw.toLowerCase().includes(`from: ${unquote(from[1])[0].toLowerCase()}`));
          const subj = rest.match(/SUBJECT ("(?:[^"\\]|\\.)*")/);
          if (subj) hits = hits.filter((x) => x.raw.toLowerCase().includes(unquote(subj[1])[0].toLowerCase()));
          s.send(`* SEARCH ${hits.map((x) => x.uid).join(' ')}\r\n`);
          return ok();
        }
        case 'UID FETCH': {
          const [set, items] = [rest.split(' ')[0], rest.slice(rest.indexOf(' ') + 1)];
          const uids = set.split(',').map(Number);
          for (const [i, x] of s.box.entries()) {
            if (!uids.includes(x.uid)) continue;
            if (/HEADER\.FIELDS/.test(items)) {
              const head = x.raw.split('\r\n\r\n')[0].split(/\r\n(?![ \t])/).filter((l) => /^(From|To|Subject|Date|Message-ID):/i.test(l)).join('\r\n');
              const lit = `${head}\r\n\r\n`;
              s.send(`* ${i + 1} FETCH (UID ${x.uid} FLAGS (${x.flags.join(' ')}) BODY[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)] {${Buffer.byteLength(lit, 'latin1')}}\r\n${lit})\r\n`);
            } else {
              const n = Number(items.match(/BODY\.PEEK\[\]<0\.(\d+)>/)?.[1] ?? 1e9);
              const lit = x.raw.slice(0, n);
              s.send(`* ${i + 1} FETCH (UID ${x.uid} FLAGS (${x.flags.join(' ')}) RFC822.SIZE ${x.raw.length} BODY[]<0> {${lit.length}}\r\n${lit})\r\n`);
            }
          }
          return ok();
        }
        case 'UID STORE': {
          const uid = Number(rest.split(' ')[0]);
          const x = s.box.find((y) => y.uid === uid);
          if (s.mode !== 'SELECT') return s.send(`${tag} NO mailbox is read-only\r\n`);
          if (x && !x.flags.includes('\\Seen')) x.flags.push('\\Seen');
          return ok();
        }
        case 'LOGOUT':
          s.send('* BYE logging out\r\n');
          ok();
          return s.end();
        default:
          return s.send(`${tag} BAD unknown command\r\n`);
      }
    },
  };
  return s;
}

// ---------- the fake SMTP server ----------

function smtpServer({ user = 'me@gmail.com', pass = 'abcdefghijklmnop' } = {}) {
  const s = {
    lines: [],
    rcpt: [],
    data: null,
    dataMode: false,
    start() { s.send('220 fake.example ESMTP ready\r\n'); },
    onLine(line) {
      s.lines.push(line.startsWith('AUTH') ? 'AUTH ***' : line);
      const [verb] = line.split(/[ :]/);
      switch (verb.toUpperCase()) {
        case 'EHLO': return s.send('250-fake.example at your service\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        case 'STARTTLS': return s.send('220 2.0.0 Ready to start TLS\r\n');
        case 'AUTH': {
          const raw = Buffer.from(line.split(' ')[2] ?? '', 'base64').toString('utf8');
          if (raw === `\0${user}\0${pass}`) return s.send('235 2.7.0 Accepted\r\n');
          return s.send('535-5.7.8 Username and Password not accepted.\r\n535 5.7.8 https://support.google.com/mail/?p=BadCredentials\r\n');
        }
        case 'MAIL': return s.send('250 2.1.0 OK\r\n');
        case 'RCPT': {
          s.rcpt.push(line.match(/<([^>]+)>/)[1]);
          return s.send('250 2.1.5 OK\r\n');
        }
        case 'DATA':
          s.dataMode = true;
          return s.send('354 Go ahead\r\n');
        case 'QUIT':
          s.send('221 2.0.0 closing\r\n');
          return s.end();
        default: return s.send('502 unknown\r\n');
      }
    },
    onData(raw) {
      s.dataMode = false;
      s.wire = raw;
      s.data = raw.split('\r\n').map((l) => (l.startsWith('..') ? l.slice(1) : l)).join('\r\n');
      s.send('250 2.0.0 OK queued\r\n');
    },
  };
  return s;
}

const servers = (opts) => fakeConnect((host) => (host.startsWith('imap') ? imapServer(opts) : smtpServer(opts)));
const gmail = () => M.parseEmailKey('me@gmail.com abcd efgh ijkl mnop');

function qpDecode(s) {
  const t = s.replace(/=\r\n/g, '');
  const out = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] === '=' && /^[0-9A-F]{2}$/.test(t.slice(i + 1, i + 3))) {
      out.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(t.charCodeAt(i));
  }
  return Buffer.from(out).toString('utf8');
}

// ---------- tests ----------

test('parseEmailKey: provider presets, custom servers, JSON, and Outlook refused', () => {
  const g = gmail();
  assert.deepEqual(g, { address: 'me@gmail.com', password: 'abcdefghijklmnop', imapHost: 'imap.gmail.com', imapPort: 993, smtpHost: 'smtp.gmail.com', smtpPort: 465, smtpTls: 'on' });
  const i = M.parseEmailKey('me@icloud.com abcd-efgh-ijkl-mnop');
  assert.equal(i.imapHost, 'imap.mail.me.com');
  assert.equal(i.smtpHost, 'smtp.mail.me.com');
  assert.equal(i.smtpPort, 587);
  assert.equal(i.smtpTls, 'starttls');
  assert.equal(i.password, 'abcd-efgh-ijkl-mnop');
  assert.equal(M.parseEmailKey('x@yahoo.com pw').imapHost, 'imap.mail.yahoo.com');
  assert.equal(M.parseEmailKey('x@fastmail.com pw').smtpHost, 'smtp.fastmail.com');
  assert.equal(M.parseEmailKey('x@googlemail.com pw').imapHost, 'imap.gmail.com');
  const c = M.parseEmailKey('me@company.com s3cret pass imap.company.com smtp.company.com:587');
  assert.equal(c.password, 's3cret pass');
  assert.equal(c.imapHost, 'imap.company.com');
  assert.equal(c.smtpPort, 587);
  assert.equal(c.smtpTls, 'starttls');
  assert.equal(M.parseEmailKey('me@gmail.comabcdefghijklmnop').password, 'abcdefghijklmnop', 'spaces stripped by a form still works');
  assert.equal(M.parseEmailKey(JSON.stringify({ address: 'me@gmail.com', password: 'pw' })).smtpHost, 'smtp.gmail.com');
  assert.throws(() => M.parseEmailKey('me@company.com s3cret'), (e) => e.kind === 'config' && /imap\.company\.com smtp\.company\.com/.test(e.message));
  assert.throws(() => M.parseEmailKey('me@gmail.com'), (e) => e.kind === 'config' && /password is missing/.test(e.message));
  assert.throws(() => M.parseEmailKey('not-an-address pw'), (e) => e.kind === 'config');
  for (const v of ['me@outlook.com pw', 'me@hotmail.co.uk pw', 'me@live.com pw', 'me@mine.com pw outlook.office365.com smtp.office365.com']) {
    assert.throws(() => M.parseEmailKey(v), (e) => e.kind === 'unsupported' && /Microsoft/.test(e.message), v);
  }
  assert.throws(() => M.parseEmailKey('me@x.com pw localhost.x 127.0.0.1'), (e) => e.kind === 'config');
});

test('a wrong password gives a clear Gmail message and never echoes the password', async () => {
  const { connect } = servers({ pass: 'the-right-one' });
  await assert.rejects(M.testLogin(gmail(), { connect }), (e) => {
    assert.equal(e.kind, 'auth');
    assert.match(e.message, /Gmail rejected the password — use an App Password/);
    assert.ok(!e.message.includes('abcdefghijklmnop'));
    return true;
  });
  const ok = servers();
  await M.testLogin(gmail(), { connect: ok.connect });
  assert.deepEqual(ok.log.map((x) => `${x.host}:${x.port}:${x.tls}`), ['imap.gmail.com:993:on', 'smtp.gmail.com:465:on']);
  assert.ok(ok.log[0].session.commands.includes('LOGOUT '));
});

test('lists unread mail newest first, read-only, with RFC 2047 subjects decoded from literals', async () => {
  const { connect, log } = servers();
  const r = await M.listMessages(gmail(), { unread: true, limit: 10 }, { connect });
  assert.equal(r.total, 2);
  assert.deepEqual(r.messages.map((m) => m.uid), [103, 101]);
  const cafe = r.messages[1];
  assert.equal(cafe.subject, 'Café réunion ☕ demain');
  assert.equal(cafe.from, 'René <rene@example.fr>');
  assert.equal(cafe.unread, true);
  assert.equal(cafe.messageId, '<a101@example.fr>');
  const cmds = log[0].session.commands;
  assert.ok(cmds.includes('EXAMINE INBOX'), cmds.join(' | '));
  assert.ok(!cmds.some((c) => c.startsWith('SELECT')), 'reading never opens the mailbox read-write');
  assert.ok(cmds.some((c) => /^UID FETCH 103,101 \(UID FLAGS BODY\.PEEK\[HEADER\.FIELDS/.test(c)), cmds.join(' | '));
});

test('search builds quoted criteria safely', async () => {
  const { connect, log } = servers();
  const r = await M.listMessages(gmail(), { from: 'Boss', subject: 'say "hi" \\ there', since: '2026-10-01', limit: 5 }, { connect });
  assert.equal(r.total, 0);
  const search = log[0].session.commands.find((c) => c.startsWith('UID SEARCH'));
  assert.equal(search, 'UID SEARCH SINCE 1-Oct-2026 FROM "Boss" SUBJECT "say \\"hi\\" \\\\ there"');
  const r2 = await M.listMessages(gmail(), { from: 'boss' }, { connect });
  assert.deepEqual(r2.messages.map((m) => m.subject), ['Quarterly report']);
});

test('reads a multipart message: quoted-printable text/plain wins over base64 html; attachments listed; stays unread', async () => {
  const { connect, log } = servers();
  const m = await M.readMessage(gmail(), 103, { connect });
  assert.equal(m.subject, 'Quarterly report');
  assert.equal(m.from, 'Boss <boss@example.com>');
  assert.equal(m.text, 'Hello world ✓\nthis line is softly wrapped');
  assert.deepEqual(m.attachments, ['report.pdf (application/pdf)']);
  assert.equal(m.references, '<a0@example.com>');
  assert.equal(m.unread, true);
  assert.equal(m.truncated, false);
  const s = log[0].session;
  assert.ok(s.commands.some((c) => /^UID FETCH 103 \(UID FLAGS RFC822\.SIZE BODY\.PEEK\[\]<0\.200000>\)$/.test(c)));
  assert.ok(!s.box.find((x) => x.uid === 103).flags.includes('\\Seen'));
  const h = await M.readMessage(gmail(), 104, { connect });
  assert.equal(h.text, 'Big news\nCafé & crème');
  await assert.rejects(M.readMessage(gmail(), 999, { connect }), (e) => e.kind === 'notfound');
});

test('mark_read opens read-write and sets \\Seen', async () => {
  const { connect, log } = servers();
  const m = await M.readMessage(gmail(), 101, { connect, markRead: true });
  assert.equal(m.text, 'On se voit demain ?');
  const s = log[0].session;
  assert.ok(s.commands.includes('SELECT INBOX'));
  assert.ok(s.box.find((x) => x.uid === 101).flags.includes('\\Seen'));
});

test('sends with AUTH PLAIN, every recipient, encoded subject, and dot-stuffing', async () => {
  const { connect, log } = servers();
  const body = 'Hi team,\n.hidden line starts with a dot\n.\nNaïve café — see you ✓\n' + 'x'.repeat(100);
  const r = await M.sendMessage(gmail(), { to: ['Ann <ann@example.com>', 'bob@example.com'], cc: ['carol@example.com', 'bob@example.com'], subject: 'Réunion demain', body, inReplyTo: '<a101@example.fr>', references: '<a0@example.fr>' }, { connect });
  assert.deepEqual(r.accepted, ['ann@example.com', 'bob@example.com', 'carol@example.com']);
  const s = log[0].session;
  assert.deepEqual(s.rcpt, ['ann@example.com', 'bob@example.com', 'carol@example.com']);
  assert.ok(s.lines.includes('MAIL FROM:<me@gmail.com>'));
  assert.ok(s.lines.includes('AUTH ***'));
  assert.equal(s.lines.at(-1), 'QUIT');
  assert.match(s.wire, /\r\n\.\.hidden line/, 'a line starting with "." is doubled on the wire');
  assert.match(s.wire, /\r\n\.\.\r\n/, 'a line that is only "." is doubled too');
  const [head, ...rest] = s.data.split('\r\n\r\n');
  assert.match(head, /^From: me@gmail\.com\r\nTo: ann@example\.com, bob@example\.com\r\nCc: carol@example\.com, bob@example\.com\r\n/);
  assert.match(head, new RegExp(`Subject: =\\?UTF-8\\?B\\?${b64('Réunion demain').replace(/[+/=]/g, '\\$&')}\\?=`));
  assert.match(head, /In-Reply-To: <a101@example\.fr>/);
  assert.match(head, /References: <a0@example\.fr> <a101@example\.fr>/);
  assert.match(head, /Content-Type: text\/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable/);
  assert.match(head, /Message-ID: <[0-9a-f]{24}\.ghosty@gmail\.com>/);
  assert.ok(rest.join('\r\n\r\n').split('\r\n').every((l) => l.length <= 76), 'quoted-printable lines stay short');
  assert.equal(qpDecode(rest.join('\r\n\r\n')).replace(/\r\n$/, ''), body.replace(/\n/g, '\r\n').replace(/\r\n$/, ''));
});

test('iCloud sends over STARTTLS on 587; bad SMTP password and silent servers fail clearly', async () => {
  const { connect, log } = servers({ user: 'me@icloud.com', pass: 'abcd-efgh-ijkl-mnop' });
  await M.sendMessage(M.parseEmailKey('me@icloud.com abcd-efgh-ijkl-mnop'), { to: ['a@example.com'], subject: 'hi', body: 'hello' }, { connect });
  assert.equal(log[0].tls, 'starttls');
  assert.equal(log[0].port, 587);
  assert.equal(log[0].session.tlsUpgrades, 1);
  assert.deepEqual(log[0].session.lines.slice(0, 3), ['EHLO icloud.com', 'STARTTLS', 'EHLO icloud.com']);

  const bad = servers({ pass: 'nope' });
  await assert.rejects(M.sendMessage(gmail(), { to: ['a@example.com'], subject: 'hi', body: 'x' }, { connect: bad.connect }), (e) => e.kind === 'auth' && /App Password/.test(e.message));
  await assert.rejects(M.sendMessage(gmail(), { to: Array.from({ length: 21 }, (_, i) => `p${i}@example.com`), subject: 'hi', body: 'x' }, { connect: bad.connect }), /at most 20/);
  await assert.rejects(M.sendMessage(gmail(), { to: ['not an address'], subject: 'hi', body: 'x' }, { connect: bad.connect }), (e) => e.kind === 'config');

  const silent = fakeConnect(() => ({ start() {}, onLine() {} }));
  await assert.rejects(M.testLogin(gmail(), { connect: silent.connect, timeoutMs: 50 }), (e) => e.kind === 'network' && /did not answer/.test(e.message));
  const refused = async () => { throw new Error('connection refused'); };
  await assert.rejects(M.testLogin(gmail(), { connect: refused }), (e) => e.kind === 'network' && /imap\.gmail\.com:993/.test(e.message));
});

test('MIME helpers: encoded words, quoted-printable round trip, html to text', () => {
  assert.equal(M.decodeHeader('=?utf-8?q?Hello_W=C3=B6rld?= =?UTF-8?B?IQ==?= plain'), 'Hello Wörld! plain');
  assert.equal(M.decodeHeader('Re: [x] =?iso-8859-1?q?caf=E9?='), 'Re: [x] café');
  assert.equal(M.encodeHeader('plain subject'), 'plain subject');
  assert.equal(M.decodeHeader(M.encodeHeader('Ünïcödé '.repeat(12).trim())), 'Ünïcödé '.repeat(12).trim());
  assert.equal(M.dotStuff('a\r\n.b\r\nc'), 'a\r\n..b\r\nc\r\n.\r\n');
  assert.equal(M.htmlText('<p>A&nbsp;&amp;&#x263A;</p><script>bad()</script>B'), 'A &☺\nB');
});

test('email tools: registered, grouped, friendly when not linked, approval shows who and what', async () => {
  for (const n of ['check_email', 'search_email', 'read_email', 'send_email']) assert.ok(T.toolByName.has(n), n);
  const names = (text) => T.selectTools(text, new Set(), false).map((t) => t.name);
  assert.ok(names('check my inbox please').includes('check_email'));
  assert.ok(names('any new emails?').includes('read_email'));
  assert.ok(!names('hi').includes('check_email'));
  assert.equal(T.toolByName.get('send_email').risk, 'confirm');

  const vault = (v) => ({ get: async (k) => (k === 'email' ? v : null) });
  await assert.rejects(T.toolByName.get('check_email').run({}, { vault: vault(null) }), /System → Keys → Email/);
  await assert.rejects(T.toolByName.get('read_email').run({ uid: 1 }, { vault: vault('me@outlook.com pw') }), /Microsoft/);
  const send = T.toolByName.get('send_email');
  const { args, reason } = await send.approval({ to: 'ann@example.com, Bob <bob@example.com>', subject: 'Lunch', body: 'Friday at 1?' }, { vault: vault('me@gmail.com abcd efgh ijkl mnop') });
  assert.deepEqual(args.to, ['ann@example.com', 'bob@example.com']);
  assert.match(reason, /from me@gmail\.com to ann@example\.com, bob@example\.com/);
  assert.match(reason, /Subject: "Lunch"/);
  assert.match(reason, /Friday at 1\?/);
  await assert.rejects(send.approval({ subject: 'x', body: 'y' }, { vault: vault('me@gmail.com pw') }), /who should it go to/);
});
