/**
 * Infrastructure recon from passive, keyless sources: what the public record says about a
 * domain, hostname, IP address or web address. Targets are infrastructure only — never a
 * person's name or an email address (`notInfrastructure` says why one is refused) — and nothing
 * here scans, logs in or probes beyond one ordinary page request plus three well-known files.
 *
 *   dnsLookup       dns.google (A, AAAA, MX, NS, TXT, CNAME, CAA; PTR for an address) + email posture
 *   rdap            rdap.org → the registry's RDAP (registrar, dates, status, nameservers; networks for IPs)
 *   certs           crt.sh certificate transparency (names, wildcards, issuers, newest)
 *   wayback         archive.org availability + the CDX API's first and latest captures
 *   ipInfo          ipwho.is (org, ASN, place) + Shodan's free InternetDB (ports, CPEs, vulns as listed)
 *   subdomains      crt.sh names ∪ hackertarget's hostsearch
 *   httpFingerprint one GET following redirects by hand: server, security headers, title, robots/sitemap/security.txt
 *   recon           all of them together, in parallel where independent, each failure contained,
 *                   10-minute cache per target; renderReport turns the report into Markdown.
 *
 * Every outbound call has its own AbortSignal.timeout. RDAP contacts other than the registrar
 * and a network's abuse mailbox are deliberately not read.
 */
import type { CertInfo, DnsInfo, DnsRecord, HostingInfo, HttpHop, HttpInfo, IpInfo, RdapInfo, ReconKind, ReconReport, ReconSection, SubdomainHost, SubdomainInfo, WaybackInfo } from '../../../../packages/shared/src/recon';

export { RECON_SECTIONS } from '../../../../packages/shared/src/recon';

/** How long each source gets, in milliseconds (crt.sh is slow; a probe for a well-known file is quick). */
export const TIMEOUTS = { dns: 6000, rdap: 8000, certs: 12000, wayback: 8000, ip: 6000, hackertarget: 8000, http: 10000, probe: 5000 };
export type Timeouts = typeof TIMEOUTS;
/** A report is kept this long per target (in the Durable Object's memory). */
export const RECON_CACHE_MS = 10 * 60_000;
/** crt.sh rows read at most, newest first. */
export const MAX_CERT_ROWS = 500;
const MAX_BODY = 3_000_000;
const MAX_PAGE = 200_000;

const API_UA = 'Ghosty/2.0 (personal assistant; single user)';
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

/* ---------- targets ---------- */

export interface Target {
  kind: ReconKind;
  /** Hostname (lower-case, no trailing dot) or IP address. */
  host: string;
  /** The registrable domain; '' for an IP address. */
  domain: string;
  /** The address to fingerprint and look up in the Wayback Machine. */
  url: string;
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;
const HOST = /^(?=.{1,253}$)([a-z0-9_](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/i; // a label may start with _ (_dmarc.example.com)

export const isIpv4 = (s: string): boolean => IPV4.test(s);
/** An IPv6 address: hex groups of up to four digits, eight of them or fewer around one "::". */
export function isIpv6(s: string): boolean {
  if (!IPV6.test(s) || !s.includes(':')) return false;
  const parts = s.split('::');
  if (parts.length > 2) return false;
  const groups = parts.flatMap((p) => (p ? p.split(':') : []));
  if (groups.some((g) => !g || g.length > 4)) return false;
  return parts.length === 2 ? groups.length <= 7 : groups.length === 8;
}
export const isIp = (s: string): boolean => isIpv4(s) || isIpv6(s);

/** The eight groups of an IPv6 address, each four hex digits ("2001:db8::1" → 2001, 0db8, 0000, …, 0001). */
const groups6 = (ip: string): string[] => {
  const [head = '', tail = ''] = ip.toLowerCase().split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  return [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t].map((g) => g.padStart(4, '0'));
};

/**
 * An address no public record describes: loopback, private (10/8, 172.16/12, 192.168/16,
 * fc00::/7), carrier NAT, link-local, multicast, reserved, the unspecified address, or an IPv4
 * address mapped into IPv6. Refused before anything is asked about it.
 */
export function isPrivateIp(ip: string): boolean {
  if (isIpv4(ip)) {
    const [a, b] = ip.split('.').map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  const g = groups6(ip);
  const first = parseInt(g[0]!, 16);
  const hex = g.join('');
  return /^0{31}[01]$/.test(hex) || hex.startsWith('00000000000000000000ffff') || (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80 || (first & 0xff00) === 0xff00;
}

/** Names that never leave a local network (localhost, .local, .internal, .home.arpa). */
const LOCAL_NAME = /^localhost$|\.(localhost|local|internal|home\.arpa)$/i;

/** Second-level suffixes under which the registrable domain has three labels (co.uk, com.au, …). */
const SECOND_LEVEL = /^(co|com|org|net|gov|edu|ac|or|ne|go|mil|nom|gob|sch|ltd|plc|me|biz|info|nhs|police)\.[a-z]{2}$/;

/** The registrable domain of a hostname: www.example.co.uk → example.co.uk, a.b.example.com → example.com. */
export function registrable(host: string): string {
  const labels = host.toLowerCase().split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  const n = SECOND_LEVEL.test(labels.slice(-2).join('.')) ? 3 : 2;
  return labels.slice(-n).join('.');
}

/**
 * Why a target is not infrastructure, in plain words, or '' when it is fine: a person's name
 * (two or more capitalised words), an email address, or words with spaces that are no address.
 */
export function notInfrastructure(raw: string): string {
  const s = raw.trim();
  if (!s) return 'say which domain, host, IP address or web address to look at';
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(s) || /^mailto:/i.test(s)) return 'that is an email address — recon is for domains, hosts, IP addresses and web addresses, never for a person';
  if (/^[A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+)+$/.test(s)) return 'that looks like a person\'s name — recon is for domains, hosts, IP addresses and web addresses, never for a person';
  if (/\s/.test(s) && !/^https?:\/\//i.test(s)) return 'that is not a domain, host, IP address or web address (it has spaces in it)';
  return '';
}

/** Parse a target. Throws (with the reason) for anything that is not infrastructure. */
export function parseTarget(raw: string): Target {
  const why = notInfrastructure(raw);
  if (why) throw new Error(why);
  let s = raw.trim();
  const hadScheme = /^https?:\/\//i.test(s);
  if (!hadScheme && /^[a-z][a-z0-9+.-]*:\/\//i.test(s)) throw new Error('only http:// and https:// addresses can be looked at');
  if (!hadScheme) s = isIpv6(s) ? `https://[${s}]` : `https://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new Error(`"${raw.trim()}" is not a domain, host, IP address or web address`);
  }
  // A username and password in the address would go out to every source: not sent anywhere.
  if (u.username || u.password) throw new Error('leave the username and password out of the address');
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (isIp(host)) {
    if (isPrivateIp(host)) throw new Error(`${host} is a private, local or reserved address — the public records are about public addresses only`);
    const url = hadScheme ? u.toString() : `http://${isIpv6(host) ? `[${host}]` : host}/`;
    return { kind: 'ip', host, domain: '', url };
  }
  if (!HOST.test(host) || LOCAL_NAME.test(host)) throw new Error(`"${host}" is not a public domain name or IP address`);
  const bare = !hadScheme && (u.pathname === '/' || u.pathname === '') && !u.search;
  return { kind: bare ? 'domain' : 'url', host, domain: registrable(host), url: u.toString() };
}

/* ---------- fetch helpers ---------- */

const why = (e: unknown, ms?: number): string => {
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) return ms ? `timed out after ${ms >= 1000 ? `${Math.round(ms / 1000)} s` : `${ms} ms`}` : 'timed out';
  if (e instanceof TypeError) return 'could not be reached';
  return e instanceof Error ? e.message : String(e);
};

/** Read a response body up to `max` bytes; `cut` says whether it was cut short. */
async function readText(r: Response, max: number): Promise<{ text: string; cut: boolean }> {
  if (!r.body) return { text: '', cut: false };
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let cut = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
    if (size >= max) {
      cut = true;
      reader.cancel().catch(() => undefined);
      break;
    }
  }
  const all = new Uint8Array(Math.min(size, max));
  let o = 0;
  for (const c of chunks) {
    const part = c.subarray(0, Math.max(0, all.length - o));
    all.set(part, o);
    o += part.length;
  }
  return { text: new TextDecoder().decode(all), cut };
}

async function getJson<T>(url: string, ms: number): Promise<T> {
  const r = await fetch(url, { headers: { 'User-Agent': API_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`answered ${r.status}`);
  return (await r.json()) as T;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const strs = (v: unknown): string[] => list(v).map(str).filter(Boolean);
const uniq = (a: string[]): string[] => [...new Set(a)];
const day = (v: unknown): string | null => {
  const s = str(v);
  const t = Date.parse(s);
  return s && Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : s ? s.slice(0, 10) : null;
};

/* ---------- DNS (dns.google) ---------- */

export const DNS_TYPES = ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'CAA'] as const;
const TYPE_NAMES: Record<number, string> = { 1: 'A', 2: 'NS', 5: 'CNAME', 6: 'SOA', 12: 'PTR', 15: 'MX', 16: 'TXT', 28: 'AAAA', 257: 'CAA' };

/** TXT data as dns.google quotes it: "abc" "def" → abcdef. */
const unquote = (s: string): string => (s.startsWith('"') ? s.replace(/^"|"$/g, '').replace(/"\s*"/g, '') : s);

/** The records in a dns.google answer, by their real type (an A query for a CNAME'd name answers both). */
export function parseDns(json: unknown): DnsRecord[] {
  const j = json as { Answer?: unknown } | null;
  const out: DnsRecord[] = [];
  for (const raw of list(j?.Answer)) {
    const r = raw as Record<string, unknown>;
    const type = typeof r.type === 'number' ? TYPE_NAMES[r.type] ?? `TYPE${r.type}` : str(r.type);
    const data = str(r.data);
    if (!data) continue;
    out.push({ type, data: type === 'TXT' ? unquote(data) : data.replace(/\.$/, ''), ttl: typeof r.TTL === 'number' ? r.TTL : 0 });
  }
  return out;
}

/** The in-addr.arpa / ip6.arpa name of an address, for a PTR lookup. */
export function reverseName(ip: string): string {
  if (isIpv4(ip)) return `${ip.split('.').reverse().join('.')}.in-addr.arpa`;
  return `${groups6(ip).join('').split('').reverse().join('.')}.ip6.arpa`;
}

/** Email posture from the TXT records of a name and of _dmarc.<name>. */
export function emailPosture(txt: string[], dmarcTxt: string[], mx: string[]): DnsInfo['email'] {
  const spf = txt.find((t) => /^v=spf1\b/i.test(t)) ?? null;
  const dmarc = dmarcTxt.find((t) => /^v=DMARC1\b/i.test(t)) ?? null;
  const policy = dmarc?.match(/(?:^|;)\s*p=([a-z]+)/i)?.[1]?.toLowerCase() ?? null;
  return { spf, dmarc, dmarcPolicy: policy, mx: mx.map((m) => m.replace(/^\d+\s+/, '').replace(/\.$/, '')) };
}

/** All the usual records of a name (PTR for an address), plus the email posture. Throws only when dns.google answered nothing at all. */
export async function dnsLookup(name: string, opts: { timeoutMs?: number } = {}): Promise<DnsInfo> {
  const ms = opts.timeoutMs ?? TIMEOUTS.dns;
  const q = (n: string, type: string) => getJson<unknown>(`https://dns.google/resolve?name=${encodeURIComponent(n)}&type=${type}`, ms);
  if (isIp(name)) {
    const ptr = parseDns(await q(reverseName(name), 'PTR'));
    return { name, records: ptr, ips: [name], email: { spf: null, dmarc: null, dmarcPolicy: null, mx: [] }, failed: [] };
  }
  const asks: [label: string, p: Promise<unknown>][] = [...DNS_TYPES.map((t): [string, Promise<unknown>] => [t, q(name, t)]), ['DMARC', q(`_dmarc.${name}`, 'TXT')]];
  const settled = await Promise.allSettled(asks.map(([, p]) => p));
  const failed: string[] = [];
  const seen = new Set<string>();
  const records: DnsRecord[] = [];
  let dmarc: string[] = [];
  settled.forEach((s, i) => {
    const label = asks[i]![0];
    if (s.status === 'rejected') return void failed.push(label);
    const recs = parseDns(s.value);
    if (label === 'DMARC') return void (dmarc = recs.filter((r) => r.type === 'TXT').map((r) => r.data));
    for (const r of recs) {
      const k = `${r.type} ${r.data}`;
      if (!seen.has(k)) {
        seen.add(k);
        records.push(r);
      }
    }
  });
  if (failed.length === asks.length) throw new Error('dns.google did not answer');
  const of = (t: string) => records.filter((r) => r.type === t).map((r) => r.data);
  return { name, records, ips: [...of('A'), ...of('AAAA')], email: emailPosture(of('TXT'), dmarc, of('MX')), failed };
}

/* ---------- RDAP (rdap.org → the registry) ---------- */

interface RdapEntity {
  roles?: unknown;
  vcardArray?: unknown;
  entities?: unknown;
}

/** A field of an entity's vCard (jCard): ['vcard', [['fn', {}, 'text', 'Name'], …]]. */
function vcard(e: RdapEntity, field: string): string {
  const card = list(e.vcardArray)[1];
  for (const item of list(card)) {
    const it = list(item);
    if (str(it[0]).toLowerCase() === field) return str(it[3]);
  }
  return '';
}

/** The first entity with a role, searching nested entities too. */
function entityWithRole(entities: unknown, role: string): RdapEntity | null {
  for (const raw of list(entities)) {
    const e = raw as RdapEntity;
    if (strs(e.roles).map((r) => r.toLowerCase()).includes(role)) return e;
    const nested = entityWithRole(e.entities, role);
    if (nested) return nested;
  }
  return null;
}

/** An RDAP domain or IP-network object, mapped defensively. Only the registrar and a network's abuse mailbox are read from the contacts. */
export function parseRdap(json: unknown, kind: 'domain' | 'ip'): RdapInfo {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  const events = list(j.events).map((e) => e as Record<string, unknown>);
  const at = (action: RegExp) => day(events.find((e) => action.test(str(e.eventAction)))?.eventDate);
  const registrar = entityWithRole(j.entities, 'registrar');
  const abuse = entityWithRole(j.entities, 'abuse');
  const cidrs = list(j.cidr0_cidrs).map((c) => c as Record<string, unknown>).map((c) => `${str(c.v4prefix) || str(c.v6prefix)}/${str(c.length)}`).filter((c) => !c.startsWith('/'));
  const secure = j.secureDNS as { delegationSigned?: unknown } | undefined;
  return {
    kind,
    handle: str(j.handle),
    name: str(j.ldhName) ? str(j.ldhName).toLowerCase() : str(j.name),
    registrar: registrar ? vcard(registrar, 'fn') : '',
    registered: at(/^registration$/i),
    expires: at(/^expiration$/i),
    changed: at(/^last changed$/i) ?? at(/^last update of rdap database$/i),
    status: strs(j.status),
    nameservers: uniq(list(j.nameservers).map((n) => str((n as { ldhName?: unknown }).ldhName).toLowerCase()).filter(Boolean)),
    dnssec: typeof secure?.delegationSigned === 'boolean' ? secure.delegationSigned : null,
    cidr: cidrs.join(', ') || (str(j.startAddress) && str(j.endAddress) ? `${str(j.startAddress)} – ${str(j.endAddress)}` : ''),
    country: str(j.country).toUpperCase(),
    abuse: abuse ? vcard(abuse, 'email') : '',
  };
}

/** The registration record of a domain, or the network record of an IP address. */
export async function rdap(target: string, opts: { timeoutMs?: number } = {}): Promise<RdapInfo> {
  const ms = opts.timeoutMs ?? TIMEOUTS.rdap;
  const kind: 'domain' | 'ip' = isIp(target) ? 'ip' : 'domain';
  const name = kind === 'domain' ? registrable(target) : target;
  const r = await fetch(`https://rdap.org/${kind}/${encodeURIComponent(name)}`, { headers: { 'User-Agent': API_UA, Accept: 'application/rdap+json, application/json' }, signal: AbortSignal.timeout(ms) });
  if (r.status === 404) throw new Error(`no RDAP record for ${name} (the registry may not publish one)`);
  if (!r.ok) throw new Error(`answered ${r.status}`);
  return parseRdap(await r.json(), kind);
}

/* ---------- certificates (crt.sh) ---------- */

/** Why an IP address gets no certificate or subdomain lookup (registrable("93.184.216.34") would be "216.34"). */
export const NOT_BY_ADDRESS = { certs: 'certificates are looked up by domain name, not by address', subdomains: 'subdomains are looked up by domain name, not by address' };

/** The organisation in an issuer DN ("C=US, O=Let's Encrypt, CN=R11" → Let's Encrypt), else its CN, else the text. */
export function issuerName(dn: string): string {
  const o = dn.match(/(?:^|,\s*)O=("[^"]*"|[^,]+)/)?.[1]?.replace(/^"|"$/g, '').trim();
  const cn = dn.match(/(?:^|,\s*)CN=([^,]+)/)?.[1]?.trim();
  return o || cn || dn.trim();
}

/** crt.sh's JSON (newest first, at most MAX_CERT_ROWS rows): names deduplicated, wildcards and subdomains apart, issuers counted. */
export function parseCerts(json: unknown, domain: string): CertInfo {
  const d = domain.toLowerCase();
  const rows = list(json)
    .map((r) => r as Record<string, unknown>)
    .sort((a, b) => (Date.parse(str(b.not_before)) || 0) - (Date.parse(str(a.not_before)) || 0));
  const kept = rows.slice(0, MAX_CERT_ROWS);
  const names = new Set<string>();
  const sets = new Set<string>();
  const issuers = new Map<string, number>();
  let newest: CertInfo['newest'] = null;
  for (const r of kept) {
    const set = str(r.name_value).toLowerCase();
    const rowNames = uniq([...set.split(/\s+/), str(r.common_name).toLowerCase()].map((n) => n.trim()).filter((n) => n && (n === d || n.endsWith(`.${d}`))));
    for (const n of rowNames) names.add(n);
    if (set) sets.add(set);
    const issuer = issuerName(str(r.issuer_name));
    if (issuer) issuers.set(issuer, (issuers.get(issuer) ?? 0) + 1);
    if (!newest && rowNames.length) newest = { notBefore: day(r.not_before) ?? '', notAfter: day(r.not_after) ?? '', name: rowNames[0]!, issuer };
  }
  const all = [...names].sort();
  return {
    domain: d,
    total: kept.length,
    distinct: sets.size,
    truncated: rows.length > kept.length,
    names: all,
    wildcards: all.filter((n) => n.startsWith('*.')),
    subdomains: all.filter((n) => !n.startsWith('*.') && n !== d),
    issuers: [...issuers].map(([name, n]) => ({ name, n })).sort((a, b) => b.n - a.n),
    newest,
  };
}

/** A JSON array cut short by the size cap: keep the complete objects and close it. */
export function repairJsonArray(text: string): unknown {
  const end = text.lastIndexOf('},');
  if (!text.trimStart().startsWith('[') || end < 0) throw new Error('not a JSON list');
  return JSON.parse(`${text.slice(0, end + 1)}]`);
}

/** Certificates issued for a domain and its subdomains, from certificate transparency logs via crt.sh. */
export async function certs(domain: string, opts: { timeoutMs?: number } = {}): Promise<CertInfo> {
  const ms = opts.timeoutMs ?? TIMEOUTS.certs;
  if (isIp(domain)) throw new Error(NOT_BY_ADDRESS.certs);
  const d = registrable(domain);
  const r = await fetch(`https://crt.sh/?q=${encodeURIComponent(d)}&output=json`, { headers: { 'User-Agent': API_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`answered ${r.status}`);
  const { text, cut } = await readText(r, MAX_BODY);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    if (!cut) throw new Error('answered with something that is not JSON');
    json = repairJsonArray(text);
  }
  const info = parseCerts(json, d);
  if (cut) info.truncated = true;
  return info;
}

/* ---------- history (archive.org) ---------- */

/** archive.org/wayback/available: the closest snapshot, or null. */
export function parseAvailable(json: unknown): WaybackInfo['closest'] {
  const c = ((json as { archived_snapshots?: { closest?: unknown } } | null)?.archived_snapshots?.closest ?? null) as Record<string, unknown> | null;
  if (!c || c.available === false) return null;
  const url = str(c.url);
  return url ? { url, timestamp: str(c.timestamp), status: str(c.status) } : null;
}

/** One CDX row ([header row, data row…]) as { timestamp, url }, or null. */
export function parseCdx(json: unknown): { timestamp: string; url: string } | null {
  const rows = list(json);
  if (rows.length < 2) return null;
  const head = strs(rows[0]).map((h) => h.toLowerCase());
  const row = list(rows[rows.length - 1]);
  const ti = head.indexOf('timestamp');
  const ui = head.indexOf('original');
  const timestamp = str(row[ti >= 0 ? ti : 1]);
  return timestamp ? { timestamp, url: str(row[ui >= 0 ? ui : 2]) } : null;
}

/** "20020120142510" → "2002-01-20". */
export const waybackDay = (ts: string): string => (ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : ts);

/** The address as archive.org is asked for it: origin and path only. A query string, fragment or password (a share link's token, a reset link) stays here. */
export function archiveUrl(url: string): string {
  try {
    const u = new URL(url);
    u.username = u.password = '';
    u.search = u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}

/** The closest snapshot of a URL (looked up as its origin and path), plus the first and latest captures of its host when the CDX API answers in time. */
export async function wayback(url: string, host = '', opts: { timeoutMs?: number } = {}): Promise<WaybackInfo> {
  const ms = opts.timeoutMs ?? TIMEOUTS.wayback;
  const asked = archiveUrl(url);
  const h = host || (() => { try { return new URL(asked).hostname; } catch { return asked; } })();
  const cdx = (limit: number) => getJson<unknown>(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(h)}&output=json&limit=${limit}`, ms).then(parseCdx);
  const [avail, first, latest] = await Promise.allSettled([getJson<unknown>(`https://archive.org/wayback/available?url=${encodeURIComponent(asked)}`, ms), cdx(1), cdx(-1)]);
  if (avail.status === 'rejected' && first.status === 'rejected' && latest.status === 'rejected') throw new Error(why(avail.reason, ms));
  return {
    url: asked,
    closest: avail.status === 'fulfilled' ? parseAvailable(avail.value) : null,
    first: first.status === 'fulfilled' ? first.value : null,
    latest: latest.status === 'fulfilled' ? latest.value : null,
    cdx: first.status === 'fulfilled' || latest.status === 'fulfilled',
  };
}

/* ---------- addresses (ipwho.is + InternetDB) ---------- */

/** ipwho.is's answer, or null when it says the lookup failed. */
export function parseIpWho(json: unknown): IpInfo['who'] {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  if (j.success === false) return null;
  const c = (j.connection && typeof j.connection === 'object' ? j.connection : {}) as Record<string, unknown>;
  const flag = (j.flag && typeof j.flag === 'object' ? j.flag : {}) as Record<string, unknown>;
  const asn = str(c.asn);
  return {
    org: str(c.org),
    isp: str(c.isp),
    asn: asn ? (asn.startsWith('AS') ? asn : `AS${asn}`) : '',
    country: str(j.country),
    countryCode: str(j.country_code).toUpperCase(),
    region: str(j.region),
    city: str(j.city),
    flag: str(flag.emoji),
    type: str(j.type),
  };
}

/** InternetDB's summary of an address (what Shodan has already seen; nothing is scanned by us). */
export function parseInternetDb(json: unknown): IpInfo['db'] {
  const j = (json && typeof json === 'object' ? json : {}) as Record<string, unknown>;
  if (!Array.isArray(j.ports) && !Array.isArray(j.hostnames) && !Array.isArray(j.vulns)) return null;
  return {
    ports: list(j.ports).map((p) => Number(p)).filter((p) => Number.isInteger(p) && p > 0).sort((a, b) => a - b),
    hostnames: strs(j.hostnames),
    cpes: strs(j.cpes),
    vulns: strs(j.vulns),
    tags: strs(j.tags),
  };
}

/** Who an address belongs to and what InternetDB lists for it; either source may be missing, both missing is an error. */
export async function ipInfo(ip: string, opts: { timeoutMs?: number } = {}): Promise<IpInfo> {
  const ms = opts.timeoutMs ?? TIMEOUTS.ip;
  if (!isIp(ip)) throw new Error(`"${ip}" is not an IP address`);
  const [who, db] = await Promise.allSettled([
    getJson<unknown>(`https://ipwho.is/${encodeURIComponent(ip)}`, ms).then(parseIpWho),
    fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, { headers: { 'User-Agent': API_UA, Accept: 'application/json' }, signal: AbortSignal.timeout(ms) }).then(async (r) => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`answered ${r.status}`);
      return parseInternetDb(await r.json());
    }),
  ]);
  const notes: string[] = [];
  if (who.status === 'rejected') notes.push(`ipwho.is did not answer (${why(who.reason, ms)})`);
  else if (!who.value) notes.push('ipwho.is has nothing for this address');
  if (db.status === 'rejected') notes.push(`internetdb.shodan.io did not answer (${why(db.reason, ms)})`);
  else if (!db.value) notes.push('internetdb.shodan.io lists nothing for this address');
  if (who.status === 'rejected' && db.status === 'rejected') throw new Error(notes.join('; '));
  return { ip, who: who.status === 'fulfilled' ? who.value : null, db: db.status === 'fulfilled' ? db.value : null, notes };
}

/* ---------- subdomains (crt.sh ∪ hackertarget) ---------- */

/** hackertarget's hostsearch text (host,ip per line); its error texts count as no answer. */
export function parseHostsearch(text: string): { hosts: SubdomainHost[]; note: string } {
  const t = text.trim();
  if (!t) return { hosts: [], note: 'nothing listed' };
  if (/^error\b/i.test(t) || /api count exceeded/i.test(t) || /^(?!.*,)/.test(t.split('\n')[0]!)) return { hosts: [], note: t.split('\n')[0]!.slice(0, 80) };
  const hosts: SubdomainHost[] = [];
  for (const line of t.split('\n')) {
    const [host = '', ip = ''] = line.split(',').map((s) => s.trim().toLowerCase());
    if (host && HOST.test(host)) hosts.push({ host, ip: isIp(ip) ? ip : null, via: ['hackertarget'] });
  }
  return { hosts, note: '' };
}

/** Certificate names and hackertarget's list merged, one row per host (sorted), with where each came from. */
export function mergeHosts(domain: string, certNames: string[], ht: SubdomainHost[]): SubdomainHost[] {
  const d = domain.toLowerCase();
  const by = new Map<string, SubdomainHost>();
  for (const n of certNames) {
    const host = n.toLowerCase();
    if (host.startsWith('*.') || host === d || !host.endsWith(`.${d}`)) continue;
    by.set(host, { host, ip: null, via: ['crt.sh'] });
  }
  for (const h of ht) {
    if (h.host === d || !h.host.endsWith(`.${d}`)) continue;
    const had = by.get(h.host);
    if (had) {
      had.ip = had.ip ?? h.ip;
      if (!had.via.includes('hackertarget')) had.via.push('hackertarget');
    } else by.set(h.host, { ...h, via: [...h.via] });
  }
  return [...by.values()].sort((a, b) => a.host.localeCompare(b.host));
}

/**
 * Subdomains of a domain: the names in its certificates (crt.sh — pass `certNames` when they
 * are already known, with `certsError` when that lookup already failed, else crt.sh is asked)
 * and hackertarget's hostsearch. A source that fails is noted; both failing is an error.
 */
export async function subdomains(domain: string, opts: { timeoutMs?: number; certsMs?: number; certNames?: string[] | null; certsError?: string } = {}): Promise<SubdomainInfo> {
  const ms = opts.timeoutMs ?? TIMEOUTS.hackertarget;
  const certsMs = opts.certsMs ?? TIMEOUTS.certs;
  if (isIp(domain)) throw new Error(NOT_BY_ADDRESS.subdomains);
  const d = registrable(domain);
  const [ht, ct] = await Promise.allSettled([
    fetch(`https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(d)}`, { headers: { 'User-Agent': API_UA, Accept: 'text/plain' }, signal: AbortSignal.timeout(ms) }).then(async (r) => {
      if (!r.ok) throw new Error(`answered ${r.status}`);
      return parseHostsearch((await readText(r, 500_000)).text);
    }),
    opts.certsError ? Promise.reject(new Error(opts.certsError)) : opts.certNames ? Promise.resolve(opts.certNames) : certs(d, { timeoutMs: certsMs }).then((c) => c.names),
  ]);
  const certNote = ct.status === 'rejected' ? (opts.certsError ?? `did not answer (${why(ct.reason, certsMs)})`) : '';
  if (ht.status === 'rejected' && ct.status === 'rejected') throw new Error(`hackertarget did not answer (${why(ht.reason, ms)}); crt.sh ${certNote}`);
  const certNames = ct.status === 'fulfilled' ? ct.value : [];
  const hosts = mergeHosts(d, certNames, ht.status === 'fulfilled' ? ht.value.hosts : []);
  const sources = [
    { source: 'crt.sh', n: hosts.filter((h) => h.via.includes('crt.sh')).length, note: certNote },
    { source: 'hackertarget', n: hosts.filter((h) => h.via.includes('hackertarget')).length, note: ht.status === 'rejected' ? `did not answer (${why(ht.reason, ms)})` : ht.value.note },
  ];
  return { domain: d, hosts, sources };
}

/* ---------- HTTP fingerprint ---------- */

export const SECURITY_HEADERS: [header: string, label: string][] = [
  ['content-security-policy', 'CSP'],
  ['strict-transport-security', 'HSTS'],
  ['x-frame-options', 'X-Frame-Options'],
  ['x-content-type-options', 'X-Content-Type-Options'],
  ['referrer-policy', 'Referrer-Policy'],
  ['permissions-policy', 'Permissions-Policy'],
];

/** Which of the security headers a response carries and which it lacks. */
export function securityHeaders(headers: Headers): HttpInfo['security'] {
  const present: string[] = [];
  const missing: string[] = [];
  for (const [name, label] of SECURITY_HEADERS) (headers.get(name) ? present : missing).push(label);
  return { present, missing };
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const plain = (s: string): string =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, code: string) => {
      const c = code.toLowerCase();
      if (c.startsWith('#x')) return String.fromCodePoint(parseInt(c.slice(2), 16) || 32);
      if (c.startsWith('#')) return String.fromCodePoint(parseInt(c.slice(1), 10) || 32);
      return ENTITY[c] ?? all;
    })
    .replace(/\s+/g, ' ')
    .trim();

/** The <title> and the generator meta of a page. */
export function pageMeta(html: string): { title: string; generator: string } {
  const title = plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').slice(0, 200);
  const meta = html.match(/<meta[^>]+name=["']?generator["']?[^>]*>/i)?.[0] ?? '';
  const generator = plain(meta.match(/content=["']([^"']*)["']/i)?.[1] ?? '').slice(0, 120);
  return { title, generator };
}

const WELL_KNOWN = ['/robots.txt', '/sitemap.xml', '/.well-known/security.txt'];

/**
 * One GET with a browser-like User-Agent, following up to five redirects by hand, then a look
 * for the three well-known files at the final origin. Nothing else is requested.
 */
export async function httpFingerprint(url: string, opts: { timeoutMs?: number; probeMs?: number } = {}): Promise<HttpInfo> {
  const ms = opts.timeoutMs ?? TIMEOUTS.http;
  const probeMs = opts.probeMs ?? TIMEOUTS.probe;
  if (!/^https?:\/\//i.test(url)) throw new Error('the address must start with http:// or https://');
  const headers = { 'User-Agent': BROWSER_UA, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'en-GB,en;q=0.8' };
  const hops: HttpHop[] = [];
  let current = url;
  let r = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(ms) });
  // Up to five redirects; a page still redirecting after that is reported with its last 3xx as the final status.
  for (let hop = 0; hop < 5; hop++) {
    const location = r.headers.get('location') ?? '';
    if (![301, 302, 303, 307, 308].includes(r.status) || !location) break;
    let next: string;
    try {
      next = new URL(location, current).toString();
    } catch {
      break;
    }
    hops.push({ url: current, status: r.status, location: next });
    // A hop into a private or local address (10.0.0.1, 169.254.169.254, foo.localhost) is recorded but not followed: the report ends at this redirect.
    const to = new URL(next).hostname.replace(/^\[|\]$/g, '');
    if (isIp(to) ? isPrivateIp(to) : LOCAL_NAME.test(to)) break;
    r.body?.cancel().catch(() => undefined);
    current = next;
    r = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(ms) });
  }
  const contentType = r.headers.get('content-type') ?? '';
  const html = /html|xml/i.test(contentType) || !contentType ? (await readText(r, MAX_PAGE)).text : (r.body?.cancel().catch(() => undefined), '');
  const { title, generator } = pageMeta(html);
  const origin = new URL(current).origin;
  const files = await Promise.all(
    WELL_KNOWN.map(async (path) => {
      try {
        const p = await fetch(`${origin}${path}`, { headers, redirect: 'manual', signal: AbortSignal.timeout(probeMs) });
        const type = p.headers.get('content-type') ?? '';
        p.body?.cancel().catch(() => undefined);
        const note = p.status >= 200 && p.status < 300 ? (/html/i.test(type) ? 'answers a web page, probably not the file' : 'present') : p.status >= 300 && p.status < 400 ? 'redirects' : p.status === 404 ? 'none' : `answers ${p.status}`;
        return { path, status: p.status, note };
      } catch (e) {
        return { path, status: null, note: `no answer (${why(e, probeMs)})` };
      }
    }),
  );
  return {
    url,
    finalUrl: current,
    status: r.status,
    hops,
    server: r.headers.get('server') ?? '',
    poweredBy: r.headers.get('x-powered-by') ?? '',
    contentType: contentType.split(';')[0]!.trim(),
    security: securityHeaders(r.headers),
    title,
    generator,
    files,
  };
}

/* ---------- the composite ---------- */

export interface ReconOptions {
  /** Called when a step finishes ("crt.sh answered", 3, 7) and once at the start ("starting", 0, total). */
  onStep?: (label: string, done: number, total: number) => void;
  /** The clock, for the cache (tests). */
  now?: number;
  timeouts?: Partial<Timeouts>;
  /** Ignore a cached report. */
  fresh?: boolean;
}

const cache = new Map<string, { at: number; report: ReconReport }>();
export const clearReconCache = (): void => cache.clear();

/** Addresses worth describing: the first IPv4 and the first IPv6. */
const pickIps = (ips: string[]): string[] => uniq([ips.find(isIpv4), ips.find(isIpv6)].filter((x): x is string => !!x));

/**
 * Everything at once about a target. Independent sources run in parallel (hosting waits for
 * DNS, subdomains for crt.sh); a source that fails leaves its section saying so and the rest
 * stands. Reports are kept ten minutes per target.
 */
export async function recon(raw: string, opts: ReconOptions = {}): Promise<ReconReport> {
  const t = parseTarget(raw);
  const now = opts.now ?? Date.now();
  const key = `${t.kind}|${t.host}|${t.url}`;
  const hit = cache.get(key);
  if (hit && !opts.fresh && now - hit.at < RECON_CACHE_MS) return { ...hit.report, cached: true };
  const T = { ...TIMEOUTS, ...opts.timeouts };
  const started = Date.now();
  const total = t.kind === 'ip' ? 5 : 7;
  let done = 0;
  opts.onStep?.('starting', 0, total);
  const step = async <D>(source: string, fn: () => Promise<D>, ms: number): Promise<ReconSection<D>> => {
    const t0 = Date.now();
    try {
      const data = await fn();
      opts.onStep?.(`${source} answered`, ++done, total);
      return { source, ok: true, ms: Date.now() - t0, data };
    } catch (e) {
      opts.onStep?.(`${source} did not answer`, ++done, total);
      return { source, ok: false, ms: Date.now() - t0, error: `${source} did not answer (${why(e, ms)})` };
    }
  };
  const skip = <D>(source: string, reason: string): ReconSection<D> => ({ source, ok: false, ms: 0, error: reason, skipped: true });

  const dnsP = step('dns.google', () => dnsLookup(t.host, { timeoutMs: T.dns }), T.dns);
  const regP = step('rdap.org', () => rdap(t.kind === 'ip' ? t.host : t.domain, { timeoutMs: T.rdap }), T.rdap);
  const certP = t.kind === 'ip' ? Promise.resolve(skip<CertInfo>('crt.sh', NOT_BY_ADDRESS.certs)) : step('crt.sh', () => certs(t.domain, { timeoutMs: T.certs }), T.certs);
  const histP = step('archive.org', () => wayback(t.url, t.host, { timeoutMs: T.wayback }), T.wayback);
  const httpP = step('direct request', () => httpFingerprint(t.url, { timeoutMs: T.http, probeMs: T.probe }), T.http);
  // hackertarget starts now; its names are merged with the certificates' once crt.sh answers.
  const htNames: Promise<SubdomainInfo> | null =
    t.kind === 'ip'
      ? null
      : certP.then((c) => subdomains(t.domain, { timeoutMs: T.hackertarget, certsMs: T.certs, certNames: c.ok ? c.data.names : [], ...(c.ok ? {} : { certsError: c.error.replace(/^crt\.sh /, '') }) }));
  const subP = htNames ? step('crt.sh, hackertarget', () => htNames, T.hackertarget) : Promise.resolve(skip<SubdomainInfo>('crt.sh, hackertarget', NOT_BY_ADDRESS.subdomains));
  const hostP = step(
    t.kind === 'ip' ? 'ipwho.is, internetdb.shodan.io' : 'ipwho.is, internetdb.shodan.io, rdap.org',
    async (): Promise<HostingInfo> => {
      const d = await dnsP;
      const ips = t.kind === 'ip' ? [t.host] : d.ok ? pickIps(d.data.ips) : [];
      if (!ips.length) throw new Error(d.ok ? 'the name has no address' : 'no address to look up without the DNS answer');
      const [settled, net] = await Promise.all([
        Promise.allSettled(ips.map((ip) => ipInfo(ip, { timeoutMs: T.ip }))),
        t.kind === 'ip' ? Promise.resolve(null) : rdap(ips[0]!, { timeoutMs: T.rdap }).catch(() => null),
      ]);
      // An address neither source answered for is noted; the section only fails when that is true of every address.
      if (settled.every((s) => s.status === 'rejected')) throw (settled[0] as PromiseRejectedResult).reason;
      const infos: IpInfo[] = settled.map((s, i) => (s.status === 'fulfilled' ? s.value : { ip: ips[i]!, who: null, db: null, notes: why(s.reason, T.ip).split('; ') }));
      return { ips: infos, network: net };
    },
    T.ip,
  );

  const [dns, registration, certificates, subs, history, hosting, http] = await Promise.all([dnsP, regP, certP, subP, histP, hostP, httpP]);
  const report: ReconReport = { target: raw.trim(), kind: t.kind, host: t.host, domain: t.domain, url: t.url, at: now, ms: Date.now() - started, dns, registration, certificates, subdomains: subs, history, hosting, http };
  // A report no source answered for (a network blip, everything timing out) is not kept: the next run asks again.
  if ([dns, registration, certificates, subs, history, hosting, http].some((s) => s.ok)) cache.set(key, { at: now, report });
  for (const [k, v] of cache) if (now - v.at >= RECON_CACHE_MS) cache.delete(k);
  while (cache.size > 40) cache.delete(cache.keys().next().value!);
  return report;
}

/* ---------- Markdown ---------- */

const line = (text: string, source: string): string => `- ${text} (${source})`;
const join = (a: string[], max = 12): string => (a.length <= max ? a.join(', ') : `${a.slice(0, max).join(', ')} … and ${a.length - max} more`);
const none = (a: string[], max?: number): string => (a.length ? join(a, max) : 'none');

export function renderDns(d: DnsInfo, src = 'dns.google'): string[] {
  const of = (t: string) => d.records.filter((r) => r.type === t).map((r) => r.data);
  const out: string[] = [];
  const types = isIp(d.name) ? ['PTR'] : [...DNS_TYPES];
  for (const t of types) out.push(line(`${t}: ${d.failed.includes(t) ? 'not answered' : none(of(t).map((x) => (t === 'TXT' ? `"${x}"` : x)), t === 'TXT' ? 6 : 12)}`, src));
  if (!isIp(d.name)) {
    const e = d.email;
    const spf = e.spf ? `SPF ${e.spf.replace(/^v=spf1\s*/i, '').trim() || 'present'}` : 'no SPF';
    const dmarc = d.failed.includes('DMARC') ? 'DMARC not answered' : e.dmarc ? `DMARC p=${e.dmarcPolicy ?? 'not set'}` : 'no DMARC';
    out.push(line(`Email: ${e.mx.length ? `mail via ${join(e.mx, 4)}` : 'no mail exchangers'} · ${spf} · ${dmarc}`, src));
  }
  return out;
}

export function renderRdap(r: RdapInfo, src = 'rdap.org'): string[] {
  const out: string[] = [];
  if (r.kind === 'domain') {
    out.push(line(`Registrar: ${r.registrar || 'not stated'}${r.handle ? ` · handle ${r.handle}` : ''}`, src));
    out.push(line(`Registered: ${r.registered ?? 'unknown'} · Expires: ${r.expires ?? 'unknown'} · Last changed: ${r.changed ?? 'unknown'}`, src));
    out.push(line(`Status: ${none(r.status)}`, src));
    out.push(line(`Nameservers: ${none(r.nameservers)}${r.dnssec === null ? '' : r.dnssec ? ' · DNSSEC signed' : ' · no DNSSEC'}`, src));
  } else {
    out.push(line(`Network: ${r.name || r.handle || 'unnamed'}${r.cidr ? ` · ${r.cidr}` : ''}${r.country ? ` · ${r.country}` : ''}`, src));
    if (r.abuse) out.push(line(`Abuse contact: ${r.abuse}`, src));
    if (r.registered || r.changed) out.push(line(`Allocated: ${r.registered ?? 'unknown'} · Last changed: ${r.changed ?? 'unknown'}`, src));
  }
  return out;
}

export function renderCerts(c: CertInfo, src = 'crt.sh'): string[] {
  const out: string[] = [];
  if (!c.total) return [line('No certificates in the transparency logs for this domain', src)];
  out.push(line(`${c.total}${c.truncated ? '+' : ''} certificates (${c.distinct} distinct name sets), ${c.names.length} names, ${c.wildcards.length} wildcard${c.wildcards.length === 1 ? '' : 's'}${c.newest ? `; newest issued ${c.newest.notBefore} for ${c.newest.name} by ${c.newest.issuer || 'an unnamed issuer'}, valid to ${c.newest.notAfter}` : ''}`, src));
  out.push(line(`Issuers: ${none(c.issuers.map((i) => `${i.name} (${i.n})`), 6)}`, src));
  out.push(line(`Names: ${none(c.names, 20)}`, src));
  return out;
}

export function renderSubdomains(s: SubdomainInfo): string[] {
  const out: string[] = [];
  const srcs = s.sources.map((x) => x.source).join(', ');
  out.push(line(`${s.hosts.length} host${s.hosts.length === 1 ? '' : 's'} under ${s.domain}${s.sources.map((x) => (x.note ? `; ${x.source}: ${x.note}` : '')).join('')}`, srcs));
  for (const h of s.hosts.slice(0, 40)) out.push(line(`${h.host}${h.ip ? ` → ${h.ip}` : ''}`, h.via.join(', ')));
  if (s.hosts.length > 40) out.push(line(`… and ${s.hosts.length - 40} more`, srcs));
  return out;
}

export function renderWayback(w: WaybackInfo, src = 'archive.org'): string[] {
  const out: string[] = [];
  if (!w.closest && !w.first && !w.latest) return [line('Nothing in the Wayback Machine for this address', src)];
  if (w.cdx) out.push(line(`First capture: ${w.first ? waybackDay(w.first.timestamp) : 'unknown'} · Latest: ${w.latest ? waybackDay(w.latest.timestamp) : 'unknown'}`, src));
  else out.push(line('The CDX index did not answer in time: first and latest captures unknown', src));
  if (w.closest) out.push(line(`Closest snapshot: ${waybackDay(w.closest.timestamp)} ${w.closest.url}`, src));
  return out;
}

export function renderHosting(h: HostingInfo): string[] {
  const out: string[] = [];
  for (const ip of h.ips) {
    const w = ip.who;
    if (w) out.push(line(`${ip.ip}: ${[w.org || w.isp, w.asn, [w.city, w.region, w.country].filter(Boolean).join(', ') + (w.flag ? ` ${w.flag}` : '')].filter(Boolean).join(' · ') || 'no details'}`, 'ipwho.is'));
    const db = ip.db;
    if (db) out.push(line(`${ip.ip}: ports seen ${none(db.ports.map(String), 20)} · hostnames ${none(db.hostnames, 6)} · CPEs ${none(db.cpes, 6)} · vulns ${none(db.vulns, 10)}${db.tags.length ? ` · tags ${join(db.tags, 6)}` : ''}`, 'internetdb.shodan.io'));
    for (const n of ip.notes) out.push(line(`${ip.ip}: ${n}`, n.split(' ')[0]!));
  }
  if (h.network) out.push(...renderRdap(h.network));
  return out;
}

export function renderHttp(x: HttpInfo, src = 'direct request'): string[] {
  const out: string[] = [];
  const chain = x.hops.length ? ` after ${x.hops.length} redirect${x.hops.length === 1 ? '' : 's'}: ${[...x.hops.map((h) => h.url), x.finalUrl].join(' → ')}` : x.finalUrl !== x.url ? ` at ${x.finalUrl}` : '';
  const still = x.status >= 300 && x.status < 400 ? ' (still redirecting: stopped there)' : '';
  out.push(line(`${x.status}${chain}${still}${x.contentType ? ` · ${x.contentType}` : ''}`, src));
  out.push(line(`Server: ${x.server || 'not stated'} · X-Powered-By: ${x.poweredBy || 'none'}`, src));
  out.push(line(`Security headers present: ${none(x.security.present)}; missing: ${none(x.security.missing)}`, src));
  out.push(line(`Title: ${x.title ? `"${x.title}"` : 'none'} · generator: ${x.generator || 'none'}`, src));
  out.push(line(x.files.map((f) => `${f.path.replace(/^\/(\.well-known\/)?/, '')}: ${f.status === null ? f.note : f.note === 'present' ? 'present' : `${f.status}${f.note && f.note !== 'none' ? ` (${f.note})` : ''}`}`).join(' · '), src));
  return out;
}

const SOURCES = 'dns.google, rdap.org, crt.sh, archive.org, ipwho.is, internetdb.shodan.io, hackertarget';

/** The report as readable Markdown: a section per source group, the source named on every line. */
export function renderReport(r: ReconReport): string {
  const when = new Date(r.at).toISOString().slice(0, 16).replace('T', ' ');
  const sec = <D>(title: string, s: ReconSection<D>, render: (d: D) => string[]): string[] => [`\n## ${title} (${s.source})`, ...(s.ok ? render(s.data) : [line(s.error, s.source)])];
  const failed = [r.dns, r.registration, r.certificates, r.subdomains, r.history, r.hosting, r.http].filter((s) => !s.ok && !s.skipped).length;
  return [
    `# Recon: ${r.target}`,
    `Passive lookups of public records about ${r.kind === 'ip' ? `the address ${r.host}` : r.kind === 'url' ? `${r.url} (host ${r.host}, domain ${r.domain})` : `${r.host}${r.domain !== r.host ? ` (domain ${r.domain})` : ''}`} on ${when} UTC, ${(r.ms / 1000).toFixed(1)} s${r.cached ? ', from the last run' : ''}${failed ? `; ${failed} source${failed === 1 ? '' : 's'} did not answer` : ''}. Sources: ${SOURCES}. These are records about infrastructure, not about a person; an address used by a home connection can still point to a household, so do not use this to find someone.`,
    ...sec('DNS', r.dns, renderDns),
    ...sec('Registration', r.registration, renderRdap),
    ...sec('Certificates', r.certificates, renderCerts),
    ...sec('Subdomains', r.subdomains, renderSubdomains),
    ...sec('History', r.history, renderWayback),
    ...sec('Hosting', r.hosting, renderHosting),
    ...sec('HTTP', r.http, renderHttp),
  ].join('\n');
}
