// Infrastructure recon: every passive source parsed from fixtures (dns.google, rdap.org, crt.sh,
// archive.org, ipwho.is, InternetDB, hackertarget, one HTTP fingerprint), the composite report
// with a source that never answers, the ten-minute cache, the Markdown, the tools' refusal of
// a person-like target, the report filed in the library, GET /api/recon and the Threats card's
// view of it. Network faked; every outbound call honours its AbortSignal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { sqlStorage } from '../../../tests/sqlite-storage.mjs';

const B = process.env.RECON_BUILD ?? './.build';
const R = await import(`${B}/integrations/recon.mjs`);
const T = await import(`${B}/tools/index.mjs`);
const V = await import(`${B}/reconview.mjs`);
const mod = await import(`${B}/brain.mjs`);
const worker = mod.default;
const { GhostyAgent } = mod;

/* ---------- fixtures ---------- */

const TYPE = { A: 1, NS: 2, CNAME: 5, PTR: 12, MX: 15, TXT: 16, AAAA: 28, CAA: 257 };
const answer = (name, type, data) => ({ Status: 0, Answer: data.map((d) => ({ name: `${name}.`, type: TYPE[type], TTL: 300, data: d })) });
const DNS = {
  'example.com': {
    A: answer('example.com', 'A', ['93.184.216.34']),
    AAAA: answer('example.com', 'AAAA', ['2606:2800:220:1:248:1893:25c8:1946']),
    MX: answer('example.com', 'MX', ['10 mail.example.com.', '20 mail2.example.com.']),
    NS: answer('example.com', 'NS', ['a.iana-servers.net.', 'b.iana-servers.net.']),
    TXT: answer('example.com', 'TXT', ['"v=spf1 include:_spf.example.net ~all"', '"google-site-verification=abc" "def"']),
    CNAME: { Status: 0 },
    CAA: answer('example.com', 'CAA', ['0 issue "letsencrypt.org"']),
  },
  '_dmarc.example.com': { TXT: answer('_dmarc.example.com', 'TXT', ['"v=DMARC1; p=reject; rua=mailto:dmarc@example.com"']) },
  'www.example.com': { A: { Status: 0, Answer: [{ name: 'www.example.com.', type: 5, TTL: 60, data: 'example.com.' }, { name: 'example.com.', type: 1, TTL: 300, data: '93.184.216.34' }] } },
  '34.216.184.93.in-addr.arpa': { PTR: answer('34.216.184.93.in-addr.arpa', 'PTR', ['edge.example.net.']) },
};

const RDAP_DOMAIN = {
  objectClassName: 'domain',
  handle: '2336799_DOMAIN_COM-VRSN',
  ldhName: 'EXAMPLE.COM',
  status: ['client delete prohibited', 'client transfer prohibited'],
  events: [
    { eventAction: 'registration', eventDate: '1995-08-14T04:00:00Z' },
    { eventAction: 'expiration', eventDate: '2027-08-13T04:00:00Z' },
    { eventAction: 'last changed', eventDate: '2025-08-14T07:01:31Z' },
  ],
  secureDNS: { delegationSigned: true },
  nameservers: [{ ldhName: 'A.IANA-SERVERS.NET' }, { ldhName: 'B.IANA-SERVERS.NET' }],
  entities: [
    {
      roles: ['registrar'],
      vcardArray: ['vcard', [['version', {}, 'text', '4.0'], ['fn', {}, 'text', 'RESERVED-Internet Assigned Numbers Authority']]],
      publicIds: [{ type: 'IANA Registrar ID', identifier: '376' }],
      entities: [{ roles: ['abuse'], vcardArray: ['vcard', [['fn', {}, 'text', ''], ['email', {}, 'text', 'abuse@registrar.example']]] }],
    },
    { roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'Jane Q. Registrant'], ['email', {}, 'text', 'jane@example.com']]] },
  ],
};
const RDAP_IP = {
  objectClassName: 'ip network',
  handle: 'NET-93-184-216-0-1',
  name: 'EDGECAST-NETBLK-03',
  startAddress: '93.184.216.0',
  endAddress: '93.184.216.255',
  cidr0_cidrs: [{ v4prefix: '93.184.216.0', length: 24 }],
  country: 'us',
  type: 'DIRECT ALLOCATION',
  events: [{ eventAction: 'registration', eventDate: '2008-06-02T00:00:00Z' }, { eventAction: 'last changed', eventDate: '2023-11-05T00:00:00Z' }],
  entities: [{ roles: ['registrant'], vcardArray: ['vcard', [['fn', {}, 'text', 'Edgecast Inc.']]], entities: [{ roles: ['abuse'], vcardArray: ['vcard', [['fn', {}, 'text', 'Abuse Desk'], ['email', {}, 'text', 'abuse@edgecast.example']]] }] }],
};

const cert = (names, issuer, notBefore, extra = {}) => ({ issuer_ca_id: 1, issuer_name: issuer, common_name: names[0], name_value: names.join('\n'), id: Math.floor(Math.random() * 1e9), entry_timestamp: notBefore, not_before: notBefore, not_after: '2027-01-01T00:00:00', serial_number: 'ab', ...extra });
const CRT = [
  cert(['example.com', 'www.example.com'], "C=US, O=Let's Encrypt, CN=R11", '2026-09-01T10:00:00'),
  cert(['example.com', 'www.example.com'], "C=US, O=Let's Encrypt, CN=R11", '2026-07-01T10:00:00'), // a renewal: same name set
  cert(['*.example.com', 'example.com'], 'C=US, O=DigiCert Inc, CN=DigiCert TLS RSA SHA256 2020 CA1', '2025-03-10T00:00:00'),
  cert(['api.example.com'], "C=US, O=Let's Encrypt, CN=R10", '2026-01-15T00:00:00'),
  cert(['API.EXAMPLE.COM', 'staging-old.example.com'], "C=US, O=Let's Encrypt, CN=R3", '2023-05-05T00:00:00'),
  cert(['example.org', 'cdn.example.org'], 'C=US, O=Other CA', '2026-02-02T00:00:00'), // another domain in the same log entry: not ours
];

const WAYBACK_AVAILABLE = { url: 'https://example.com/', archived_snapshots: { closest: { status: '200', available: true, url: 'http://web.archive.org/web/20261001120000/https://example.com/', timestamp: '20261001120000' } } };
const CDX_FIRST = [['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'], ['com,example)/', '20020120142510', 'http://example.com:80/', 'text/html', '200', 'XYZ', '1792']];
const CDX_LATEST = [['urlkey', 'timestamp', 'original', 'mimetype', 'statuscode', 'digest', 'length'], ['com,example)/', '20261001120000', 'https://example.com/', 'text/html', '200', 'ABC', '1256']];

const IPWHO = { ip: '93.184.216.34', success: true, type: 'IPv4', continent: 'North America', country: 'United States', country_code: 'US', region: 'California', city: 'Los Angeles', is_eu: false, flag: { img: 'https://cdn.ipwhois.io/flags/us.svg', emoji: '🇺🇸' }, connection: { asn: 15133, org: 'Edgecast Inc.', isp: 'Edgecast Inc.', domain: 'edgecast.com' } };
const INTERNETDB = { cpes: ['cpe:/a:verizon:edgecast'], hostnames: ['example.com', 'www.example.com'], ip: '93.184.216.34', ports: [443, 80, 8443], tags: ['cdn'], vulns: ['CVE-2024-0001'] };

const HOSTSEARCH = 'www.example.com,93.184.216.34\napi.example.com,93.184.216.35\nvpn.example.com,203.0.113.9\nexample.com,93.184.216.34\n';

const PAGE = `<!doctype html><html><head><title>Example &amp; Co — home</title><meta name="generator" content="WordPress 6.6"></head><body><h1>Hello</h1></body></html>`;

/** A fake network: answers by host and path, records every call, hangs when told to (honouring the AbortSignal). */
function network(overrides = {}) {
  const calls = [];
  const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...headers } });
  const text = (t, status = 200, headers = {}) => new Response(t, { status, headers: { 'content-type': 'text/plain', ...headers } });
  // A source that never answers: settles only when the caller's timeout aborts it. (Node unrefs
  // AbortSignal.timeout's timer, so a ref'd one keeps the event loop alive until then.)
  const hang = (signal) => new Promise((_, reject) => {
    assert.ok(signal instanceof AbortSignal, 'a call that may hang carries a timeout signal');
    const keep = setTimeout(() => reject(new Error('the fake network waited 30 s: no timeout fired')), 30_000);
    const abort = () => {
      clearTimeout(keep);
      reject(signal.reason);
    };
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
  });
  const route = (url, init) => {
    const key = `${url.hostname}${url.pathname}`;
    const o = overrides[key] ?? overrides[url.hostname];
    if (o === 'hang') return hang(init.signal);
    if (typeof o === 'function') return o(url, init);
    if (o instanceof Response) return o.clone();
    switch (url.hostname) {
      case 'dns.google': {
        const name = url.searchParams.get('name');
        const type = url.searchParams.get('type');
        const a = DNS[name]?.[type];
        return a ? json(a) : json({ Status: 3 });
      }
      case 'rdap.org':
        if (url.pathname === '/domain/example.com') return json(RDAP_DOMAIN);
        if (url.pathname === '/ip/93.184.216.34') return json(RDAP_IP);
        return json({ errorCode: 404 }, 404);
      case 'crt.sh':
        return url.searchParams.get('q') === 'example.com' ? json(CRT) : json([]);
      case 'archive.org':
        return json(WAYBACK_AVAILABLE);
      case 'web.archive.org':
        return json(url.searchParams.get('limit') === '-1' ? CDX_LATEST : CDX_FIRST);
      case 'ipwho.is':
        return url.pathname === '/93.184.216.34' ? json(IPWHO) : json({ success: false, message: 'Invalid IP address' });
      case 'internetdb.shodan.io':
        return url.pathname === '/93.184.216.34' ? json(INTERNETDB) : json({ detail: 'No information available' }, 404);
      case 'api.hackertarget.com':
        return text(HOSTSEARCH);
      case 'example.com':
        if (url.protocol === 'http:' && url.pathname === '/') return new Response(null, { status: 301, headers: { location: 'https://example.com/' } });
        if (url.pathname === '/') return new Response(null, { status: 302, headers: { location: '/home/' } });
        if (url.pathname === '/home/') return new Response(null, { status: 307, headers: { location: 'https://www.example.com/' } });
        return new Response('nope', { status: 404 });
      case 'www.example.com':
        if (url.pathname === '/') return new Response(PAGE, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', server: 'nginx/1.25', 'x-powered-by': 'PHP/8.3', 'strict-transport-security': 'max-age=63072000', 'x-content-type-options': 'nosniff' } });
        if (url.pathname === '/robots.txt') return text('User-agent: *\nDisallow: /admin/\n');
        if (url.pathname === '/.well-known/security.txt') return text('Contact: mailto:security@example.com\n');
        return new Response('nope', { status: 404 });
    }
    return new Response('not faked', { status: 599 });
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    calls.push({ url, init });
    return route(url, init);
  };
  return calls;
}

const hosts = (calls) => [...new Set(calls.map((c) => c.url.hostname))];

/* ---------- targets ---------- */

test('targets: domains, hosts, URLs and addresses are infrastructure; names and email addresses are refused with the reason', () => {
  assert.deepEqual(R.parseTarget('Example.com'), { kind: 'domain', host: 'example.com', domain: 'example.com', url: 'https://example.com/' });
  assert.deepEqual(R.parseTarget('www.example.co.uk'), { kind: 'domain', host: 'www.example.co.uk', domain: 'example.co.uk', url: 'https://www.example.co.uk/' });
  assert.deepEqual(R.parseTarget('https://shop.example.com/cart?x=1'), { kind: 'url', host: 'shop.example.com', domain: 'example.com', url: 'https://shop.example.com/cart?x=1' });
  assert.deepEqual(R.parseTarget('93.184.216.34'), { kind: 'ip', host: '93.184.216.34', domain: '', url: 'http://93.184.216.34/' });
  assert.deepEqual(R.parseTarget('2606:2800:220:1:248:1893:25c8:1946'), { kind: 'ip', host: '2606:2800:220:1:248:1893:25c8:1946', domain: '', url: 'http://[2606:2800:220:1:248:1893:25c8:1946]/' });
  assert.equal(R.parseTarget('example.com.').host, 'example.com', 'trailing dot dropped');
  assert.match(R.notInfrastructure('John Smith'), /person's name/);
  assert.match(R.notInfrastructure('Mary Jane Watson'), /person's name/);
  assert.match(R.notInfrastructure('someone@example.com'), /email address/);
  assert.match(R.notInfrastructure('mailto:someone@example.com'), /email address/);
  assert.match(R.notInfrastructure('the shop down the road'), /spaces/);
  assert.match(R.notInfrastructure('   '), /say which/);
  assert.equal(R.notInfrastructure('example.com'), '');
  assert.equal(R.notInfrastructure('https://example.com/a page'), '', 'a URL may carry a space');
  assert.throws(() => R.parseTarget('Jane Doe'), /person's name/);
  assert.throws(() => R.parseTarget('jane@example.com'), /email address/);
  assert.throws(() => R.parseTarget('localhost'), /not a public domain/);
  assert.throws(() => R.parseTarget('ftp://example.com/'), /only http/);
  assert.throws(() => R.parseTarget('not a host!'), /spaces/);
  // private, loopback, link-local, carrier-NAT, multicast and reserved addresses, and local-only names: nothing public to look up
  for (const ip of ['127.0.0.1', '10.0.0.1', '172.16.5.5', '172.31.255.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '::1', '::', 'fd00::1', 'fc00::', 'fe80::1', 'ff02::1', '::ffff:7f00:1', '0:0:0:0:0:0:0:1']) {
    assert.ok(R.isPrivateIp(ip), `${ip} is private`);
    assert.throws(() => R.parseTarget(ip), /private, local or reserved address/, ip);
  }
  assert.throws(() => R.parseTarget('http://[::1]:8080/admin'), /private, local or reserved address/);
  assert.throws(() => R.parseTarget('http://10.0.0.1/admin'), /private, local or reserved address/);
  for (const ip of ['93.184.216.34', '8.8.8.8', '172.15.0.1', '172.32.0.1', '100.63.0.1', '100.128.0.1', '169.253.0.1', '223.255.255.255', '2606:2800:220:1:248:1893:25c8:1946', '2001:db8::1', 'fb00::1', 'fec0::1']) assert.ok(!R.isPrivateIp(ip), `${ip} is public`);
  for (const name of ['foo.localhost', 'router.local', 'metadata.google.internal', 'printer.home.arpa', 'LOCALHOST']) assert.throws(() => R.parseTarget(name), /not a public domain/, name);
  assert.equal(R.parseTarget('internal.example.com').host, 'internal.example.com', 'only the suffix counts');
  // a username and password never go out to the sources
  assert.throws(() => R.parseTarget('https://user:secret@example.com/'), /leave the username and password out/);
  assert.throws(() => R.parseTarget('https://user@example.com/'), /leave the username and password out/);
  // an international name is sent the way a browser sends it (punycode), which is what the sources expect
  assert.equal(R.parseTarget('münchen.de').host, 'xn--mnchen-3ya.de');
  assert.equal(R.parseTarget('https://münchen.de/path').url, 'https://xn--mnchen-3ya.de/path');
  assert.equal(R.registrable('a.b.example.com'), 'example.com');
  assert.equal(R.registrable('www.england.nhs.uk'), 'england.nhs.uk', 'nhs.uk is a public suffix like co.uk');
  assert.equal(R.registrable('example.com'), 'example.com');
});

/* ---------- the sources ---------- */

test('dnsLookup: the usual records from dns.google, TXT unquoted, SPF and DMARC read, a type that fails is named', async () => {
  const calls = network();
  // CAA answers 500; everything else comes from the table.
  const withCaaDown = async () => {
    const real = globalThis.fetch;
    globalThis.fetch = async (input, init) => (new URL(input).searchParams.get('type') === 'CAA' ? new Response('boom', { status: 500 }) : real(input, init));
    try {
      return await R.dnsLookup('example.com');
    } finally {
      globalThis.fetch = real;
    }
  };
  const d = await withCaaDown();
  assert.deepEqual(d.ips, ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']);
  const of = (t) => d.records.filter((r) => r.type === t).map((r) => r.data);
  assert.deepEqual(of('NS'), ['a.iana-servers.net', 'b.iana-servers.net'], 'trailing dots dropped');
  assert.deepEqual(of('TXT'), ['v=spf1 include:_spf.example.net ~all', 'google-site-verification=abcdef'], 'quotes stripped, split strings joined');
  assert.deepEqual(of('MX'), ['10 mail.example.com', '20 mail2.example.com']);
  assert.deepEqual(d.failed, ['CAA']);
  assert.equal(d.email.spf, 'v=spf1 include:_spf.example.net ~all');
  assert.match(d.email.dmarc, /^v=DMARC1/);
  assert.equal(d.email.dmarcPolicy, 'reject');
  assert.deepEqual(d.email.mx, ['mail.example.com', 'mail2.example.com']);
  // every dns.google call carries a timeout signal
  const d2 = await R.dnsLookup('example.com');
  assert.deepEqual(d2.failed, []);
  assert.ok(calls.length >= 8 && calls.every((c) => c.init.signal instanceof AbortSignal));
  // a CNAME'd host answers both the CNAME and the A it points at
  const www = await R.dnsLookup('www.example.com');
  assert.deepEqual(www.records.filter((r) => r.type === 'CNAME').map((r) => r.data), ['example.com']);
  assert.deepEqual(www.ips, ['93.184.216.34']);
  // an address gets its reverse name
  assert.equal(R.reverseName('93.184.216.34'), '34.216.184.93.in-addr.arpa');
  assert.equal(R.reverseName('2001:db8::1'), '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa');
  const ptr = await R.dnsLookup('93.184.216.34');
  assert.deepEqual(ptr.records, [{ type: 'PTR', data: 'edge.example.net', ttl: 300 }]);
  // nothing answering at all is an error, not an empty answer
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await assert.rejects(R.dnsLookup('example.com'), /dns.google did not answer/);
  assert.equal(R.emailPosture([], [], ['10 mx.example.com.']).spf, null);
  assert.equal(R.emailPosture(['v=spf1 -all'], ['v=DMARC1; p=quarantine; pct=100'], []).dmarcPolicy, 'quarantine');
});

test('rdap: a domain gives registrar, dates, status, nameservers and DNSSEC; an address gives its network, block, country and abuse mailbox; contact people are not read', async () => {
  network();
  const d = await R.rdap('www.example.com');
  assert.equal(d.kind, 'domain');
  assert.equal(d.name, 'example.com', 'the registrable domain, lower-case');
  assert.equal(d.registrar, 'RESERVED-Internet Assigned Numbers Authority');
  assert.equal(d.registered, '1995-08-14');
  assert.equal(d.expires, '2027-08-13');
  assert.equal(d.changed, '2025-08-14');
  assert.deepEqual(d.status, ['client delete prohibited', 'client transfer prohibited']);
  assert.deepEqual(d.nameservers, ['a.iana-servers.net', 'b.iana-servers.net']);
  assert.equal(d.dnssec, true);
  assert.equal(d.abuse, 'abuse@registrar.example', 'the registrar\'s abuse desk, found nested');
  assert.ok(!JSON.stringify(d).includes('Jane') && !JSON.stringify(d).includes('jane@'), 'the registrant person is never read');
  const ip = await R.rdap('93.184.216.34');
  assert.equal(ip.kind, 'ip');
  assert.equal(ip.name, 'EDGECAST-NETBLK-03');
  assert.equal(ip.cidr, '93.184.216.0/24');
  assert.equal(ip.country, 'US');
  assert.equal(ip.abuse, 'abuse@edgecast.example');
  assert.equal(ip.registered, '2008-06-02');
  assert.equal(R.parseRdap({ startAddress: '10.0.0.0', endAddress: '10.0.0.255' }, 'ip').cidr, '10.0.0.0 – 10.0.0.255', 'a range when no CIDR is given');
  assert.deepEqual(R.parseRdap(null, 'domain').status, [], 'garbage parses to an empty record');
  await assert.rejects(R.rdap('nothing.example'), /no RDAP record/);
});

test('certs: crt.sh rows deduplicated by name set, wildcards and other domains set apart, issuers counted, newest first, capped at 500 rows', async () => {
  network();
  const c = await R.certs('www.example.com');
  assert.equal(c.domain, 'example.com');
  assert.equal(c.total, 6);
  assert.equal(c.distinct, 5, 'the renewal shares its name set');
  assert.deepEqual(c.names, ['*.example.com', 'api.example.com', 'example.com', 'staging-old.example.com', 'www.example.com'], 'lower-cased, deduplicated, example.org left out');
  assert.deepEqual(c.wildcards, ['*.example.com']);
  assert.deepEqual(c.subdomains, ['api.example.com', 'staging-old.example.com', 'www.example.com']);
  assert.deepEqual(c.issuers, [{ name: "Let's Encrypt", n: 4 }, { name: 'Other CA', n: 1 }, { name: 'DigiCert Inc', n: 1 }], 'most certificates first, then the more recent issuer');
  assert.deepEqual(c.newest, { notBefore: '2026-09-01', notAfter: '2027-01-01', name: 'example.com', issuer: "Let's Encrypt" });
  assert.equal(c.truncated, false);
  assert.equal(R.issuerName('C=US, O="Google Trust Services", CN=WR3'), 'Google Trust Services');
  assert.equal(R.issuerName('CN=R3'), 'R3');
  const many = Array.from({ length: 620 }, (_, i) => cert([`h${i}.example.com`], 'O=CA', `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00`));
  const big = R.parseCerts(many, 'example.com');
  assert.equal(big.total, 500);
  assert.equal(big.truncated, true);
  assert.equal(big.names.length, 500);
  // a body cut short by the size cap still yields the complete rows
  const cut = JSON.stringify(CRT).slice(0, JSON.stringify(CRT).length - 40);
  assert.equal(R.parseCerts(R.repairJsonArray(cut), 'example.com').total, 5);
  assert.throws(() => R.repairJsonArray('not json'), /not a JSON list/);
  assert.deepEqual(R.parseCerts([], 'example.com').names, []);
  // an address is never turned into a "domain" (registrable("93.184.216.34") would be "216.34")
  const calls = network();
  await assert.rejects(R.certs('93.184.216.34'), /certificates are looked up by domain name, not by address/);
  await assert.rejects(R.subdomains('93.184.216.34'), /subdomains are looked up by domain name, not by address/);
  assert.equal(calls.length, 0, 'nothing was asked');
});

test('wayback: the closest snapshot plus first and latest captures; a CDX index that never answers leaves just the snapshot; nothing answering is an error', async () => {
  const calls = network();
  const w = await R.wayback('https://example.com/', 'example.com');
  assert.equal(w.url, 'https://example.com/');
  assert.equal(w.cdx, true);
  // archive.org is asked for the origin and path only: a share link's token, a reset link's secret or a password stays here
  await R.wayback('https://user:secret@example.com/reset?token=abc123#frag');
  const asked = calls.filter((c) => c.url.hostname === 'archive.org').map((c) => c.url.searchParams.get('url'));
  assert.deepEqual(asked, ['https://example.com/', 'https://example.com/reset']);
  assert.ok(!calls.some((c) => /abc123|secret/.test(c.url.toString())), 'the secret part of the link never leaves');
  assert.equal(calls.filter((c) => c.url.hostname === 'web.archive.org').at(-1).url.searchParams.get('url'), 'example.com');
  assert.equal(R.archiveUrl('https://app.example.com/share?id=1&token=xyz'), 'https://app.example.com/share');
  assert.equal(R.archiveUrl('not a url'), 'not a url');
  assert.equal(w.first.timestamp, '20020120142510');
  assert.equal(w.latest.timestamp, '20261001120000');
  assert.equal(w.closest.url, 'http://web.archive.org/web/20261001120000/https://example.com/');
  assert.equal(R.waybackDay(w.first.timestamp), '2002-01-20');
  network({ 'web.archive.org': 'hang' });
  const slow = await R.wayback('https://example.com/', 'example.com', { timeoutMs: 40 });
  assert.equal(slow.cdx, false);
  assert.equal(slow.first, null);
  assert.equal(slow.closest.timestamp, '20261001120000');
  network({ 'archive.org': 'hang', 'web.archive.org': 'hang' });
  await assert.rejects(R.wayback('https://example.com/', 'example.com', { timeoutMs: 30 }), /timed out after 30 ms/);
  assert.equal(R.parseAvailable({ archived_snapshots: {} }), null);
  assert.equal(R.parseCdx([['urlkey', 'timestamp', 'original']]), null, 'a header row alone is no capture');
});

test('ipInfo: ipwho.is and InternetDB together; an address InternetDB has nothing on is said so; both silent is an error', async () => {
  network();
  const i = await R.ipInfo('93.184.216.34');
  assert.deepEqual(i.who, { org: 'Edgecast Inc.', isp: 'Edgecast Inc.', asn: 'AS15133', country: 'United States', countryCode: 'US', region: 'California', city: 'Los Angeles', flag: '🇺🇸', type: 'IPv4' });
  assert.deepEqual(i.db, { ports: [80, 443, 8443], hostnames: ['example.com', 'www.example.com'], cpes: ['cpe:/a:verizon:edgecast'], vulns: ['CVE-2024-0001'], tags: ['cdn'] });
  assert.deepEqual(i.notes, []);
  const quiet = await R.ipInfo('203.0.113.9');
  assert.equal(quiet.db, null);
  assert.equal(quiet.who, null, 'ipwho.is said the lookup failed');
  assert.deepEqual(quiet.notes, ['ipwho.is has nothing for this address', 'internetdb.shodan.io lists nothing for this address']);
  network({ 'ipwho.is': 'hang', 'internetdb.shodan.io': new Response('down', { status: 503 }) });
  await assert.rejects(R.ipInfo('93.184.216.34', { timeoutMs: 30 }), /ipwho.is did not answer \(timed out after 30 ms\); internetdb.shodan.io did not answer \(answered 503\)/);
  await assert.rejects(R.ipInfo('example.com'), /not an IP address/);
});

test('subdomains: hackertarget lines merged with the certificate names, each host saying where it came from; its error texts count as no answer', async () => {
  assert.deepEqual(R.parseHostsearch('error check your search parameter').hosts, []);
  assert.match(R.parseHostsearch('API count exceeded - Increase Quota with Membership').note, /API count exceeded/);
  assert.deepEqual(R.parseHostsearch('').hosts, []);
  assert.deepEqual(R.parseHostsearch(HOSTSEARCH).hosts.map((h) => h.host), ['www.example.com', 'api.example.com', 'vpn.example.com', 'example.com']);
  network();
  const s = await R.subdomains('example.com');
  assert.equal(s.domain, 'example.com');
  assert.deepEqual(s.hosts, [
    { host: 'api.example.com', ip: '93.184.216.35', via: ['crt.sh', 'hackertarget'] },
    { host: 'staging-old.example.com', ip: null, via: ['crt.sh'] },
    { host: 'vpn.example.com', ip: '203.0.113.9', via: ['hackertarget'] },
    { host: 'www.example.com', ip: '93.184.216.34', via: ['crt.sh', 'hackertarget'] },
  ]);
  assert.deepEqual(s.sources, [{ source: 'crt.sh', n: 3, note: '' }, { source: 'hackertarget', n: 3, note: '' }]);
  // names already known from a cert_search are reused: crt.sh is not asked again
  const calls = network({ 'api.hackertarget.com': new Response('error check your search parameter', { headers: { 'content-type': 'text/plain' } }) });
  const s2 = await R.subdomains('example.com', { certNames: ['x.example.com', '*.example.com', 'example.com'] });
  assert.deepEqual(s2.hosts, [{ host: 'x.example.com', ip: null, via: ['crt.sh'] }]);
  assert.match(s2.sources[1].note, /error check your search parameter/);
  assert.ok(!hosts(calls).includes('crt.sh'));
  network({ 'api.hackertarget.com': 'hang', 'crt.sh': 'hang' });
  await assert.rejects(R.subdomains('example.com', { timeoutMs: 30, certsMs: 30 }), /hackertarget did not answer.*crt.sh did not answer/);
});

test('httpFingerprint: one browser-like GET following the redirect chain by hand, headers present and missing, title, generator, the well-known files', async () => {
  const calls = network();
  const x = await R.httpFingerprint('http://example.com/');
  assert.equal(x.finalUrl, 'https://www.example.com/');
  assert.equal(x.status, 200);
  assert.deepEqual(x.hops, [
    { url: 'http://example.com/', status: 301, location: 'https://example.com/' },
    { url: 'https://example.com/', status: 302, location: 'https://example.com/home/' },
    { url: 'https://example.com/home/', status: 307, location: 'https://www.example.com/' },
  ]);
  assert.equal(x.server, 'nginx/1.25');
  assert.equal(x.poweredBy, 'PHP/8.3');
  assert.equal(x.contentType, 'text/html');
  assert.deepEqual(x.security, { present: ['HSTS', 'X-Content-Type-Options'], missing: ['CSP', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy'] });
  assert.equal(x.title, 'Example & Co — home');
  assert.equal(x.generator, 'WordPress 6.6');
  assert.deepEqual(x.files, [
    { path: '/robots.txt', status: 200, note: 'present' },
    { path: '/sitemap.xml', status: 404, note: 'none' },
    { path: '/.well-known/security.txt', status: 200, note: 'present' },
  ]);
  const pages = calls.filter((c) => c.url.hostname.endsWith('example.com'));
  assert.equal(pages.length, 4 + 3, 'four hops and three probes, nothing else');
  assert.ok(pages.every((c) => c.init.redirect === 'manual' && c.init.signal instanceof AbortSignal && /Mozilla/.test(c.init.headers['User-Agent'])));
  // a redirect loop stops after five hops and reports the last 3xx as where it got to
  const loopCalls = network({ 'loop.example': () => new Response(null, { status: 302, headers: { location: `https://loop.example/${Math.random()}` } }) });
  const loop = await R.httpFingerprint('https://loop.example/');
  assert.equal(loop.status, 302);
  assert.equal(loop.hops.length, 5);
  assert.equal(loopCalls.filter((c) => c.url.hostname === 'loop.example' && !/robots|sitemap|security/.test(c.url.pathname)).length, 6, 'six requests: the first and five hops');
  assert.match(R.renderHttp(loop)[0], /^- 302 after 5 redirects: .*\(still redirecting: stopped there\) \(direct request\)$/);
  // a soft-404 robots.txt (HTML) is called out; a probe that never answers does not sink the fingerprint
  network({ 'www.example.com/robots.txt': new Response('<html>home</html>', { headers: { 'content-type': 'text/html' } }), 'www.example.com/sitemap.xml': 'hang' });
  const soft = await R.httpFingerprint('https://www.example.com/', { probeMs: 30 });
  assert.equal(soft.files[0].note, 'answers a web page, probably not the file');
  assert.deepEqual(soft.files[1], { path: '/sitemap.xml', status: null, note: 'no answer (timed out after 30 ms)' });
  await assert.rejects(R.httpFingerprint('example.com'), /must start with http/);
  assert.deepEqual(R.pageMeta('<p>no head</p>'), { title: '', generator: '' });
});

/* ---------- the composite ---------- */

test('recon: every source in parallel, crt.sh never answering leaves its section saying so and the rest standing; progress counts the steps', async () => {
  R.clearReconCache();
  const calls = network({ 'crt.sh': 'hang' });
  const steps = [];
  const r = await R.recon('Example.com', { onStep: (label, done, total) => steps.push([label, done, total]), now: 1_000_000, timeouts: { certs: 50 } });
  assert.equal(r.kind, 'domain');
  assert.equal(r.host, 'example.com');
  assert.equal(r.url, 'https://example.com/');
  assert.equal(r.at, 1_000_000);
  assert.equal(r.cached, undefined);
  assert.equal(r.dns.ok, true);
  assert.deepEqual(r.dns.data.ips, ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946']);
  assert.equal(r.registration.ok, true);
  assert.equal(r.registration.data.registrar, 'RESERVED-Internet Assigned Numbers Authority');
  assert.equal(r.certificates.ok, false);
  assert.equal(r.certificates.error, 'crt.sh did not answer (timed out after 50 ms)');
  assert.equal(r.certificates.skipped, undefined, 'a failure, not a skip');
  assert.equal(r.subdomains.ok, true, 'hackertarget still answered');
  assert.deepEqual(r.subdomains.data.hosts.map((h) => h.host), ['api.example.com', 'vpn.example.com', 'www.example.com']);
  assert.equal(r.history.ok, true);
  assert.equal(r.history.data.first.timestamp, '20020120142510');
  assert.equal(r.hosting.ok, true);
  assert.deepEqual(r.hosting.data.ips.map((i) => i.ip), ['93.184.216.34', '2606:2800:220:1:248:1893:25c8:1946'], 'the first IPv4 and the first IPv6');
  assert.equal(r.hosting.data.ips[0].who.asn, 'AS15133');
  assert.equal(r.hosting.data.network.cidr, '93.184.216.0/24');
  assert.equal(r.http.ok, true);
  assert.equal(r.http.data.finalUrl, 'https://www.example.com/');
  assert.deepEqual(steps[0], ['starting', 0, 7]);
  assert.equal(steps.length, 8);
  assert.deepEqual(steps.slice(1).map((s) => s[1]), [1, 2, 3, 4, 5, 6, 7]);
  assert.ok(steps.slice(1).every((s) => s[2] === 7 && /(answered|did not answer)$/.test(s[0])));
  assert.ok(steps.some((s) => s[0] === 'crt.sh did not answer'));
  assert.ok(calls.every((c) => c.init.signal instanceof AbortSignal), 'every outbound call has a timeout');
  const wanted = ['dns.google', 'rdap.org', 'crt.sh', 'archive.org', 'web.archive.org', 'ipwho.is', 'internetdb.shodan.io', 'api.hackertarget.com', 'example.com', 'www.example.com'];
  for (const h of wanted) assert.ok(hosts(calls).includes(h), `asked ${h}`);
  // an address: five checks, certificates and subdomains skipped on purpose
  const ip = await R.recon('93.184.216.34', { onStep: (l, d, t) => steps.push([l, d, t]), now: 1_000_000 });
  assert.equal(ip.kind, 'ip');
  assert.equal(ip.certificates.ok, false);
  assert.equal(ip.certificates.skipped, true);
  assert.equal(ip.subdomains.skipped, true);
  assert.equal(ip.registration.data.name, 'EDGECAST-NETBLK-03');
  assert.deepEqual(ip.dns.data.records, [{ type: 'PTR', data: 'edge.example.net', ttl: 300 }]);
  assert.equal(ip.hosting.data.network, null, 'the network is already the registration section');
  assert.equal(steps[steps.length - 1][2], 5);
  await assert.rejects(R.recon('Jane Doe'), /person's name/);
  await assert.rejects(R.recon('127.0.0.1'), /private, local or reserved address/);
});

test('recon: one address with both lookups silent is noted, and the other address keeps the Hosting section', async () => {
  R.clearReconCache();
  // the IPv6 address: ipwho.is never answers and InternetDB is down; the IPv4 address answers as usual
  const enc6 = encodeURIComponent('2606:2800:220:1:248:1893:25c8:1946');
  network({ [`ipwho.is/${enc6}`]: 'hang', [`internetdb.shodan.io/${enc6}`]: new Response('down', { status: 503 }) });
  const r = await R.recon('example.com', { now: 2_000_000, timeouts: { ip: 40 } });
  assert.equal(r.hosting.ok, true, 'the IPv4 details that came back are kept');
  const [v4, v6] = r.hosting.data.ips;
  assert.equal(v4.who.asn, 'AS15133');
  assert.deepEqual(v6, { ip: '2606:2800:220:1:248:1893:25c8:1946', who: null, db: null, notes: ['ipwho.is did not answer (timed out after 40 ms)', 'internetdb.shodan.io did not answer (answered 503)'] });
  assert.equal(r.hosting.data.network.cidr, '93.184.216.0/24');
  const md = R.renderReport(r);
  assert.match(md, /- 2606:2800:220:1:248:1893:25c8:1946: ipwho\.is did not answer \(timed out after 40 ms\) \(ipwho\.is\)/);
  assert.match(md, /- 2606:2800:220:1:248:1893:25c8:1946: internetdb\.shodan\.io did not answer \(answered 503\) \(internetdb\.shodan\.io\)/);
  assert.ok(V.reportRows(r).find((v) => v.key === 'hosting').rows.some((x) => x.k === 'NOTE' && /2606.*ipwho\.is did not answer/.test(x.v)));
  // every address silent: the section says so
  R.clearReconCache();
  network({ 'ipwho.is': 'hang', 'internetdb.shodan.io': new Response('down', { status: 503 }) });
  const none = await R.recon('example.com', { now: 2_000_000, timeouts: { ip: 40 } });
  assert.equal(none.hosting.ok, false);
  assert.match(none.hosting.error, /^ipwho\.is, internetdb\.shodan\.io, rdap\.org did not answer \(ipwho\.is did not answer \(timed out after 40 ms\); internetdb\.shodan\.io did not answer \(answered 503\)\)$/);
});

test('recon keeps a report for ten minutes per target, then asks again', async () => {
  R.clearReconCache();
  const calls = network();
  const a = await R.recon('example.com', { now: 5_000_000 });
  const n = calls.length;
  assert.ok(n > 10);
  const b = await R.recon('EXAMPLE.com', { now: 5_000_000 + 9 * 60_000 });
  assert.equal(b.cached, true);
  assert.equal(b.at, a.at);
  assert.equal(calls.length, n, 'nothing fetched again');
  const c = await R.recon('example.com', { now: 5_000_000 + 11 * 60_000 });
  assert.equal(c.cached, undefined);
  assert.ok(calls.length > n, 'fetched again after ten minutes');
  const fresh = await R.recon('example.com', { now: 5_000_000 + 11 * 60_000, fresh: true });
  assert.equal(fresh.cached, undefined);
  assert.equal(R.RECON_CACHE_MS, 10 * 60_000);
});

test('a report no source answered for is not kept: the next run asks again', async () => {
  R.clearReconCache();
  const quiet = { dns: 30, rdap: 30, certs: 30, wayback: 30, ip: 30, hackertarget: 30, http: 30, probe: 30 };
  const calls = network({ 'dns.google': 'hang', 'rdap.org': 'hang', 'crt.sh': 'hang', 'archive.org': 'hang', 'web.archive.org': 'hang', 'api.hackertarget.com': 'hang', 'example.com': 'hang' });
  const a = await R.recon('example.com', { now: 6_000_000, timeouts: quiet });
  assert.ok([a.dns, a.registration, a.certificates, a.subdomains, a.history, a.hosting, a.http].every((s) => !s.ok), 'every source silent');
  assert.equal(V.failedCount(a), 7);
  const n = calls.length;
  const b = await R.recon('example.com', { now: 6_000_000 + 1000, timeouts: quiet });
  assert.equal(b.cached, undefined, 'not served from the cache');
  assert.ok(calls.length > n, 'asked again');
  // one source answering is enough to keep the report
  network({ 'rdap.org': 'hang', 'crt.sh': 'hang', 'archive.org': 'hang', 'web.archive.org': 'hang', 'api.hackertarget.com': 'hang', 'example.com': 'hang' });
  const c = await R.recon('example.com', { now: 6_000_000 + 2000, timeouts: quiet });
  assert.equal(c.dns.ok, true);
  assert.equal((await R.recon('example.com', { now: 6_000_000 + 3000, timeouts: quiet })).cached, true);
});

test('renderReport: readable Markdown, a section per source group, the source named on every line', async () => {
  R.clearReconCache();
  network({ 'crt.sh': 'hang' });
  const r = await R.recon('example.com', { now: Date.UTC(2026, 9, 16, 12, 0), timeouts: { certs: 40 } });
  const md = R.renderReport(r);
  assert.match(md, /^# Recon: example.com\n/);
  assert.match(md, /on 2026-10-16 12:00 UTC/);
  assert.match(md, /1 source did not answer/);
  for (const h of ['## DNS (dns.google)', '## Registration (rdap.org)', '## Certificates (crt.sh)', '## Subdomains (crt.sh, hackertarget)', '## History (archive.org)', '## Hosting (ipwho.is, internetdb.shodan.io, rdap.org)', '## HTTP (direct request)']) assert.ok(md.includes(h), h);
  const bullets = md.split('\n').filter((l) => l.startsWith('- '));
  assert.ok(bullets.length > 20);
  for (const l of bullets) assert.match(l, /\([a-z][\w.]*(, [\w.]+)*( request)?\)$/, `names its source: ${l}`);
  assert.match(md, /- A: 93\.184\.216\.34 \(dns\.google\)/);
  assert.match(md, /- Email: mail via mail\.example\.com, mail2\.example\.com · SPF include:_spf\.example\.net ~all · DMARC p=reject \(dns\.google\)/);
  assert.match(md, /- Registrar: RESERVED-Internet Assigned Numbers Authority · handle 2336799_DOMAIN_COM-VRSN \(rdap\.org\)/);
  assert.match(md, /- crt\.sh did not answer \(timed out after 40 ms\) \(crt\.sh\)/);
  assert.match(md, /- 3 hosts under example\.com; crt\.sh: did not answer/);
  assert.match(md, /- api\.example\.com → 93\.184\.216\.35 \(hackertarget\)/);
  assert.match(md, /- First capture: 2002-01-20 · Latest: 2026-10-01 \(archive\.org\)/);
  assert.match(md, /- 93\.184\.216\.34: Edgecast Inc\. · AS15133 · Los Angeles, California, United States 🇺🇸 \(ipwho\.is\)/);
  assert.match(md, /- 93\.184\.216\.34: ports seen 80, 443, 8443 · hostnames example\.com, www\.example\.com · CPEs cpe:\/a:verizon:edgecast · vulns CVE-2024-0001 · tags cdn \(internetdb\.shodan\.io\)/);
  assert.match(md, /- Network: EDGECAST-NETBLK-03 · 93\.184\.216\.0\/24 · US \(rdap\.org\)/);
  assert.match(md, /- 200 after 2 redirects: https:\/\/example\.com\/ → https:\/\/example\.com\/home\/ → https:\/\/www\.example\.com\/ · text\/html \(direct request\)/);
  assert.match(md, /- Security headers present: HSTS, X-Content-Type-Options; missing: CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy \(direct request\)/);
  assert.match(md, /- Title: "Example & Co — home" · generator: WordPress 6\.6/);
  assert.match(md, /- robots\.txt: present · sitemap\.xml: 404 · security\.txt: present/);
  assert.match(md, /records about infrastructure, not about a person; an address used by a home connection can still point to a household, so do not use this to find someone/);
  assert.doesNotMatch(md, /nothing here identifies a person/, 'no claim the tool cannot keep');
  // the single-source renderers are what the piece tools print
  assert.match(R.renderCerts(R.parseCerts(CRT, 'example.com')).join('\n'), /6 certificates \(5 distinct name sets\), 5 names, 1 wildcard; newest issued 2026-09-01 for example\.com by Let's Encrypt, valid to 2027-01-01 \(crt\.sh\)/);
  assert.match(R.renderCerts(R.parseCerts([], 'example.com'))[0], /No certificates/);
});

/* ---------- the tools ---------- */

const toolCtx = (opts = {}) => {
  const progress = [];
  const storage = { get: async () => undefined, put: async () => undefined, ...(opts.sql ? { sql: sqlStorage() } : {}) };
  return { progress, ctx: { env: {}, storage, vault: { get: async () => null }, emit: () => undefined, progress: (label, done, total) => progress.push([label, done, total]) } };
};

test('the recon tools are registered, read-only, and refuse a person-like target with the reason', async () => {
  const names = ['recon_domain', 'dns_lookup', 'whois_rdap', 'cert_search', 'subdomains', 'wayback_lookup', 'ip_lookup', 'http_fingerprint'];
  for (const n of names) {
    const t = T.toolByName.get(n);
    assert.ok(t, `${n} registered`);
    assert.equal(t.risk, 'auto');
    if (n !== 'recon_domain') assert.equal(t.pure, true, `${n} is pure`);
    assert.match(t.description, /Infrastructure only/);
    assert.match(t.description, /refuses a person's name or an email address/);
  }
  // recon_domain is read-only unless it files the report
  const rd = T.toolByName.get('recon_domain');
  assert.equal(typeof rd.pure, 'function');
  assert.equal(rd.pure({ target: 'example.com' }), true);
  assert.equal(rd.pure({ target: 'example.com', save: false }), true);
  assert.equal(rd.pure({ target: 'example.com', save: true }), false);
  assert.match(T.toolByName.get('ip_lookup').description, /home connection.*do not look those up/);
  const calls = network();
  const { ctx } = toolCtx();
  const refused = await T.toolByName.get('recon_domain').run({ target: 'John Smith' }, ctx);
  assert.match(refused, /^Not looking that up: that looks like a person's name/);
  assert.match(await T.toolByName.get('recon_domain').run({ target: 'someone@example.com' }, ctx), /email address/);
  assert.match(await T.toolByName.get('dns_lookup').run({ name: 'Jane Doe' }, ctx), /person's name/);
  assert.match(await T.toolByName.get('whois_rdap').run({ target: 'boss@example.com' }, ctx), /email address/);
  assert.match(await T.toolByName.get('cert_search').run({ domain: 'Ada Lovelace' }, ctx), /person's name/);
  assert.match(await T.toolByName.get('subdomains').run({ domain: 'me@example.com' }, ctx), /email address/);
  assert.match(await T.toolByName.get('wayback_lookup').run({ url: 'Grace Hopper' }, ctx), /person's name/);
  assert.match(await T.toolByName.get('ip_lookup').run({ ip: 'ops@example.com' }, ctx), /email address/);
  assert.match(await T.toolByName.get('http_fingerprint').run({ url: 'Alan Turing' }, ctx), /person's name/);
  // the pieces refuse what recon_domain refuses: a private or local address, a password in the address
  await assert.rejects(T.toolByName.get('http_fingerprint').run({ url: 'localhost' }, ctx), /not a public domain/);
  await assert.rejects(T.toolByName.get('http_fingerprint').run({ url: 'http://127.0.0.1:8787/' }, ctx), /private, local or reserved/);
  await assert.rejects(T.toolByName.get('http_fingerprint').run({ url: '[::1]' }, ctx), /private, local or reserved/);
  await assert.rejects(T.toolByName.get('wayback_lookup').run({ url: 'https://user:pw@example.com/' }, ctx), /username and password/);
  await assert.rejects(T.toolByName.get('dns_lookup').run({ name: 'metadata.google.internal' }, ctx), /not a public domain/);
  await assert.rejects(T.toolByName.get('ip_lookup').run({ ip: '169.254.169.254' }, ctx), /private, local or reserved/);
  await assert.rejects(T.toolByName.get('whois_rdap').run({ target: '10.0.0.1' }, ctx), /private, local or reserved/);
  // certificates and subdomains are looked up by domain name: an address is refused, not mangled into "216.34"
  assert.equal(await T.toolByName.get('cert_search').run({ domain: '93.184.216.34' }, ctx), 'Not looking that up: certificates are looked up by domain name, not by address.');
  assert.equal(await T.toolByName.get('subdomains').run({ domain: 'http://93.184.216.34/' }, ctx), 'Not looking that up: subdomains are looked up by domain name, not by address.');
  assert.equal(calls.length, 0, 'nothing was looked up');
});

test('recon_domain reports with progress, the pieces answer on their own, and save: true files the report in the library', async () => {
  network();
  const { ctx, progress } = toolCtx({ sql: true });
  const out = await T.toolByName.get('recon_domain').run({ target: 'example.com', save: true }, ctx);
  assert.match(out, /^<<external content from recon sources/);
  assert.match(out, /# Recon: example\.com/);
  assert.match(out, /- Registrar: RESERVED-Internet Assigned Numbers Authority/);
  assert.match(out, /Filed in the library as "Recon: example\.com \d{4}-\d{2}-\d{2}" \(kind: recon\)/);
  assert.deepEqual(progress[0], ['running 7 checks on example.com…', 0, 7]);
  // the label is the plain step; the interface adds "n of N" from the counts, so the label must not carry it too
  assert.ok(progress.some(([l, d, t]) => l === 'dns.google answered' && t === 7 && d >= 1));
  assert.ok(progress.every(([l]) => !/\d of \d/.test(l)), JSON.stringify(progress));
  assert.equal(progress.filter(([, , t]) => t === 7).length, 8);
  assert.deepEqual(progress[progress.length - 1], ['filing the report in the library…', undefined, undefined]);
  const docs = ctx.storage.sql.exec(`SELECT title, kind, source, passages, status FROM lib_docs`).toArray();
  assert.equal(docs.length, 1);
  assert.match(docs[0].title, /^Recon: example\.com \d{4}-\d{2}-\d{2}$/);
  assert.equal(docs[0].kind, 'recon');
  assert.equal(docs[0].source, 'recon');
  assert.equal(docs[0].status, 'ready');
  assert.ok(docs[0].passages >= 1);
  // the pieces
  const dns = await T.toolByName.get('dns_lookup').run({ name: 'https://example.com/path' }, toolCtx().ctx);
  assert.match(dns, /DNS for example\.com:/);
  assert.match(dns, /- Email: .*DMARC p=reject \(dns\.google\)/);
  assert.match(await T.toolByName.get('whois_rdap').run({ target: 'https://example.com/about' }, toolCtx().ctx), /RDAP for example\.com:\n.*\n- Registered: 1995-08-14 · Expires: 2027-08-13/);
  assert.match(await T.toolByName.get('whois_rdap').run({ target: '93.184.216.34' }, toolCtx().ctx), /- Abuse contact: abuse@edgecast\.example \(rdap\.org\)/);
  assert.match(await T.toolByName.get('cert_search').run({ domain: 'example.com' }, toolCtx().ctx), /- Issuers: Let's Encrypt \(4\), Other CA \(1\), DigiCert Inc \(1\) \(crt\.sh\)/);
  assert.match(await T.toolByName.get('subdomains').run({ domain: 'example.com' }, toolCtx().ctx), /- 4 hosts under example\.com \(crt\.sh, hackertarget\)/);
  assert.match(await T.toolByName.get('wayback_lookup').run({ url: 'example.com' }, toolCtx().ctx), /- Closest snapshot: 2026-10-01 http:\/\/web\.archive\.org/);
  const wb = await T.toolByName.get('wayback_lookup').run({ url: 'https://example.com/reset?token=abc123' }, toolCtx().ctx);
  assert.match(wb, /Wayback Machine for https:\/\/example\.com\/reset:/, 'says what archive.org was asked for');
  assert.ok(!wb.includes('abc123'));
  assert.match(await T.toolByName.get('ip_lookup').run({ ip: '93.184.216.34' }, toolCtx().ctx), /vulns CVE-2024-0001/);
  const fp = toolCtx();
  assert.match(await T.toolByName.get('http_fingerprint').run({ url: 'www.example.com' }, fp.ctx), /- Server: nginx\/1\.25 · X-Powered-By: PHP\/8\.3/);
  assert.deepEqual(fp.progress, [['fetching https://www.example.com/…', undefined, undefined]]);
  // an international name reaches the sources as punycode, the way recon_domain sends it
  const idn = network();
  await T.toolByName.get('dns_lookup').run({ name: 'münchen.de' }, toolCtx().ctx);
  await T.toolByName.get('whois_rdap').run({ target: 'MÜNCHEN.de' }, toolCtx().ctx).catch(() => undefined);
  await T.toolByName.get('cert_search').run({ domain: 'https://münchen.de/x' }, toolCtx().ctx);
  assert.ok(idn.length >= 10);
  assert.ok(idn.every((c) => !/m%C3%BCnchen|münchen/i.test(c.url.toString()) && /xn--mnchen-3ya\.de/.test(c.url.toString())), idn.map((c) => c.url.toString()).join('\n'));
  network();
  // without SQLite the save is refused plainly, and the report that took the lookups still comes back
  const unsaved = await T.toolByName.get('recon_domain').run({ target: 'example.com', save: true }, toolCtx().ctx);
  assert.match(unsaved, /- Registrar: RESERVED-Internet Assigned Numbers Authority/);
  assert.match(unsaved, /\n\nCould not file it: the library is not available here \(it needs Ghosty’s SQLite storage\)\.\n<<end external content>>$/);
  assert.ok(!unsaved.includes('Filed in the library'));
  // a bare context (some callers pass no progress) still works
  const bare = await T.toolByName.get('dns_lookup').run({ name: 'example.com' }, { env: {}, storage: {}, vault: { get: async () => null }, emit: () => undefined });
  assert.match(bare, /- NS: a\.iana-servers\.net, b\.iana-servers\.net/);
});

/* ---------- the route ---------- */

class MemStorage {
  m = new Map();
  async get(k) {
    if (Array.isArray(k)) return new Map(k.filter((x) => this.m.has(x)).map((x) => [x, structuredClone(this.m.get(x))]));
    return this.m.has(k) ? structuredClone(this.m.get(k)) : undefined;
  }
  async put(k, v) {
    if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.m.set(a, structuredClone(b));
    else this.m.set(k, structuredClone(v));
  }
  async delete(k) {
    if (Array.isArray(k)) return k.filter((x) => this.m.delete(x)).length;
    return this.m.delete(k);
  }
  async list({ prefix = '' } = {}) {
    return new Map([...this.m].filter(([k]) => k.startsWith(prefix)).sort().map(([k, v]) => [k, structuredClone(v)]));
  }
  async setAlarm() {}
  async getAlarm() { return null; }
}

test('GET /api/recon?target= answers the report and its Markdown for the owner, and refuses a person with the reason', async () => {
  const OWNER_KEY = 'test-owner-key-0123456789abcdef';
  const pending = [];
  const state = { storage: new MemStorage(), waitUntil: (p) => pending.push(p), blockConcurrencyWhile: (f) => f() };
  const env = { OWNER_KEY, VAULT_KEY: Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString('base64'), MOCK_LLM: '1' };
  let agent;
  env.AGENT = { idFromName: (n) => ({ toString: () => n }), get: () => ({ fetch: (r) => (agent ??= new GhostyAgent(state, env)).fetch(r) }) };
  const ctx = { waitUntil: (p) => pending.push(p), passThroughOnException() {} };
  const call = (path, key = OWNER_KEY) => worker.fetch(new Request(`https://ghosty.test${path}`, { headers: { 'x-ghosty': '1', ...(key ? { 'x-ghosty-key': key } : {}) } }), env, ctx);
  network();
  const r = await call('/api/recon?target=example.com');
  assert.equal(r.status, 200, await r.clone().text());
  const j = await r.json();
  assert.equal(j.report.host, 'example.com');
  assert.equal(j.report.kind, 'domain');
  assert.equal(j.report.dns.ok, true);
  assert.equal(j.report.registration.data.expires, '2027-08-13');
  assert.equal(j.report.http.data.finalUrl, 'https://www.example.com/');
  assert.match(j.markdown, /^# Recon: example\.com/);
  assert.ok(!JSON.stringify(j).includes('Jane'), 'no contact person leaks through the route');
  const again = await (await call('/api/recon?target=example.com')).json();
  assert.equal(again.report.cached, true, 'the second look within ten minutes comes from the cache');
  const forced = await (await call('/api/recon?target=example.com&fresh=1')).json();
  assert.equal(forced.report.cached, undefined, 'fresh=1 (the card\'s RUN after silent sources) asks the sources again');
  assert.equal(forced.report.host, 'example.com');
  assert.equal((await (await call('/api/recon?target=example.com&fresh=0')).json()).report.cached, true);
  const person = await call('/api/recon?target=John%20Smith');
  assert.equal(person.status, 400);
  assert.match((await person.json()).error, /person's name/);
  assert.match((await (await call('/api/recon?target=someone%40example.com')).json()).error, /email address/);
  const local = await call('/api/recon?target=http%3A%2F%2F192.168.1.1%2F');
  assert.equal(local.status, 400);
  assert.match((await local.json()).error, /private, local or reserved address/);
  assert.equal((await call('/api/recon?target=')).status, 400);
  assert.equal((await call('/api/recon?target=example.com', null)).status, 401, 'owner only');
  await Promise.allSettled(pending.splice(0));
});

/* ---------- the Threats card's view ---------- */

test('the RECON card: every section names its source, weak spots get a flag, a silent source shows why, and the texts name the target', async () => {
  R.clearReconCache();
  network({ 'crt.sh': 'hang' });
  const r = await R.recon('example.com', { now: Date.UTC(2026, 9, 16, 12, 0), timeouts: { certs: 40 } });
  const views = V.reportRows(r);
  assert.deepEqual(views.map((v) => v.title), ['DNS', 'Registration', 'Certificates', 'Subdomains', 'History', 'Hosting', 'HTTP']);
  assert.deepEqual(views.map((v) => v.source), ['dns.google', 'rdap.org', 'crt.sh', 'crt.sh, hackertarget', 'archive.org', 'ipwho.is, internetdb.shodan.io, rdap.org', 'direct request']);
  const by = Object.fromEntries(views.map((v) => [v.key, v]));
  assert.equal(by.certificates.ok, false);
  assert.equal(by.certificates.skipped, false);
  assert.match(by.certificates.error, /crt\.sh did not answer/);
  assert.deepEqual(by.certificates.rows, []);
  const dns = Object.fromEntries(by.dns.rows.map((x) => [x.k, x]));
  assert.equal(dns.A.v, '93.184.216.34');
  assert.equal(dns.MX.v, '10 mail.example.com, 20 mail2.example.com');
  assert.equal(dns.EMAIL.n, undefined, 'SPF and DMARC reject: nothing to flag');
  assert.match(dns.EMAIL.v, /SPF present · DMARC p=reject/);
  const reg = Object.fromEntries(by.registration.rows.map((x) => [x.k, x]));
  assert.equal(reg.REGISTRAR.v, 'RESERVED-Internet Assigned Numbers Authority');
  assert.equal(reg.EXPIRES.v, '2027-08-13');
  assert.equal(reg.NS.v, 'a.iana-servers.net, b.iana-servers.net · DNSSEC');
  assert.equal(by.subdomains.rows[0].v, '3 hosts (crt.sh 0, hackertarget 3) · crt.sh: did not answer (timed out after 40 ms)');
  assert.deepEqual(by.subdomains.rows[1], { k: 'hackertarget', v: 'api.example.com → 93.184.216.35' });
  const hist = Object.fromEntries(by.history.rows.map((x) => [x.k, x]));
  assert.equal(hist.FIRST.v, '2002-01-20');
  assert.equal(hist.LATEST.v, '2026-10-01');
  const host = by.hosting.rows;
  assert.match(host.find((x) => x.k === 'OWNER').v, /Edgecast Inc\. · AS15133 · Los Angeles, United States 🇺🇸/);
  assert.deepEqual(host.find((x) => x.k === 'VULNS'), { k: 'VULNS', v: 'CVE-2024-0001', n: '1 LISTED', tone: 'bad' });
  assert.match(host.find((x) => x.k === 'NETWORK').v, /EDGECAST-NETBLK-03 · 93\.184\.216\.0\/24 · US · abuse abuse@edgecast\.example/);
  const http = Object.fromEntries(by.http.rows.map((x) => [x.k, x]));
  assert.equal(http.STATUS.v, '200 after 2 redirects → https://www.example.com/ · text/html');
  assert.deepEqual(http.HEADERS, { k: 'HEADERS', v: 'present: HSTS, X-Content-Type-Options · missing: CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy', n: '4 MISSING', tone: 'bad' });
  assert.equal(http.FILES.v, 'robots.txt present · sitemap.xml none · security.txt present');
  assert.equal(V.failedCount(r), 1);
  assert.equal(V.runningText('example.com', 4230), 'running 7 checks on example.com… 4.2 s');
  assert.equal(V.runningText('http://93.184.216.34/admin', 500), 'running 5 checks on http://93.184.216.34/admin… 0.5 s');
  assert.match(V.summaryLine(r), /^domain example\.com · \d+\.\d s · 1 source did not answer$/);
  assert.equal(V.summaryLine({ ...r, cached: true }), 'domain example.com · from the last run (kept 10 minutes) · 1 source did not answer');
  assert.equal(V.reconTitle(r), 'Recon: example.com 2026-10-16');
  assert.match(V.askPrompt(r), /recon on example\.com in the Threats tab/);
  // weak email posture and an expiring registration get flags; a skipped section is not an error
  const ip = await R.recon('93.184.216.34', { now: Date.UTC(2026, 9, 16, 12, 0) });
  const ipViews = Object.fromEntries(V.reportRows(ip).map((v) => [v.key, v]));
  assert.equal(ipViews.certificates.skipped, true);
  assert.deepEqual(ipViews.dns.rows, [{ k: 'PTR', v: 'edge.example.net' }]);
  assert.equal(ipViews.registration.rows[0].v, 'EDGECAST-NETBLK-03');
  assert.equal(V.runningText('93.184.216.34', 0), 'running 5 checks on 93.184.216.34… 0.0 s');
  const weak = V.reportRows({ ...r, dns: { ...r.dns, data: { ...r.dns.data, email: { spf: null, dmarc: null, dmarcPolicy: null, mx: ['mail.example.com'] } } }, registration: { ...r.registration, data: { ...r.registration.data, expires: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10) } } });
  const wb = Object.fromEntries(weak.map((v) => [v.key, v]));
  assert.deepEqual(wb.dns.rows.find((x) => x.k === 'EMAIL').n, 'WEAK');
  assert.deepEqual(wb.registration.rows.find((x) => x.k === 'EXPIRES').n, '10 DAYS');
});
