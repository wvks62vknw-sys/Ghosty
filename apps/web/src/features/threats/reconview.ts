/**
 * The RECON card's view of a report, with no DOM: which rows each section shows (the source
 * named on every section, a short flag where something is weak), the status line while it
 * runs, the library title and the question ASK GHOSTY sends. Tested from apps/edge/test.
 */
import type { CertInfo, DnsInfo, HostingInfo, HttpInfo, RdapInfo, ReconReport, ReconSection, SubdomainInfo, WaybackInfo } from '../../../../../packages/shared/src/recon';

export interface ViewRow {
  k: string;
  v: string;
  /** A short flag on the right ("4 MISSING", "WEAK"), coloured by tone. */
  n?: string;
  tone?: 'up' | 'bad';
}

export interface SectionView {
  key: string;
  title: string;
  source: string;
  ok: boolean;
  skipped: boolean;
  error: string;
  rows: ViewRow[];
}

const join = (a: string[], max = 10): string => (a.length <= max ? a.join(', ') : `${a.slice(0, max).join(', ')} … +${a.length - max} more`);
const none = (a: string[], max?: number): string => (a.length ? join(a, max) : 'none');
const isIp = (s: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(s) || (s.includes(':') && /^[0-9a-f:]+$/i.test(s));
const day = (ts: string): string => (ts.length >= 8 ? `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}` : ts || 'unknown');

/** A null MX ("0 ."): the domain takes no email. (A report from before `noMail` was kept has one empty exchanger.) */
const takesNoMail = (e: DnsInfo['email']): boolean => e.noMail ?? (e.mx.length > 0 && e.mx.every((m) => !m.trim()));

function dnsRows(d: DnsInfo): ViewRow[] {
  const of = (t: string) => d.records.filter((r) => r.type === t).map((r) => r.data);
  const rows: ViewRow[] = [];
  if (isIp(d.name)) return [{ k: 'PTR', v: none(of('PTR')) }];
  for (const t of ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'CAA'] as const) {
    const v = of(t);
    if (v.length || t === 'A') rows.push({ k: t, v: d.failed.includes(t) ? 'not answered' : t === 'MX' && takesNoMail(d.email) ? 'none: it takes no email (null MX)' : none(v, 6) });
  }
  const txt = of('TXT');
  if (txt.length) rows.push({ k: 'TXT', v: join(txt.map((x) => `"${x}"`), 3) });
  const e = d.email;
  const weak = !e.spf || !e.dmarc || e.dmarcPolicy === 'none';
  rows.push({
    k: 'EMAIL',
    v: `${takesNoMail(e) ? 'takes no email' : e.mx.length ? `mail via ${join(e.mx, 3)}` : 'no mail exchangers'} · ${e.spf ? 'SPF present' : 'no SPF'} · ${e.dmarc ? `DMARC p=${e.dmarcPolicy ?? 'not set'}` : d.failed.includes('DMARC') ? 'DMARC not answered' : 'no DMARC'}`,
    ...(e.mx.length && weak && !takesNoMail(e) ? { n: 'WEAK', tone: 'bad' as const } : {}),
  });
  return rows;
}

function rdapRows(r: RdapInfo): ViewRow[] {
  if (r.kind === 'ip') {
    return [
      { k: 'NETWORK', v: r.name || r.handle || 'unnamed' },
      { k: 'BLOCK', v: `${r.cidr || 'unknown'}${r.country ? ` · ${r.country}` : ''}` },
      ...(r.abuse ? [{ k: 'ABUSE', v: r.abuse }] : []),
    ];
  }
  const soon = r.expires ? (Date.parse(r.expires) - Date.now()) / 86_400_000 : NaN;
  return [
    { k: 'REGISTRAR', v: r.registrar || 'not stated' },
    { k: 'REGISTERED', v: r.registered ?? 'unknown' },
    { k: 'EXPIRES', v: r.expires ?? 'unknown', ...(Number.isFinite(soon) && soon < 45 ? { n: soon < 0 ? 'EXPIRED' : `${Math.max(0, Math.ceil(soon))} DAYS`, tone: 'bad' as const } : {}) },
    { k: 'CHANGED', v: r.changed ?? 'unknown' },
    { k: 'STATUS', v: none(r.status, 4) },
    { k: 'NS', v: `${none(r.nameservers, 4)}${r.dnssec === null ? '' : r.dnssec ? ' · DNSSEC' : ' · no DNSSEC'}` },
  ];
}

function certRows(c: CertInfo): ViewRow[] {
  if (!c.total) return [{ k: 'CERTS', v: 'none in the transparency logs' }];
  return [
    { k: 'CERTS', v: `${c.total}${c.truncated ? '+' : ''} (${c.distinct} distinct name sets)${c.newest ? ` · newest ${c.newest.notBefore} by ${c.newest.issuer || 'unnamed'}` : ''}` },
    { k: 'ISSUERS', v: none(c.issuers.map((i) => `${i.name} (${i.n})`), 4) },
    { k: 'NAMES', v: none(c.names, 12) },
    ...(c.wildcards.length ? [{ k: 'WILDCARD', v: join(c.wildcards, 4) }] : []),
  ];
}

function subdomainRows(s: SubdomainInfo): ViewRow[] {
  const notes = s.sources.filter((x) => x.note).map((x) => `${x.source}: ${x.note}`);
  const rows: ViewRow[] = [{ k: 'FOUND', v: `${s.hosts.length} host${s.hosts.length === 1 ? '' : 's'} (${s.sources.map((x) => `${x.source} ${x.n}`).join(', ')})${notes.length ? ` · ${notes.join('; ')}` : ''}` }];
  for (const h of s.hosts.slice(0, 30)) rows.push({ k: h.via.join('+'), v: `${h.host}${h.ip ? ` → ${h.ip}` : ''}` });
  if (s.hosts.length > 30) rows.push({ k: '…', v: `${s.hosts.length - 30} more in the saved report` });
  return rows;
}

function waybackRows(w: WaybackInfo): ViewRow[] {
  if (!w.closest && !w.first && !w.latest) return [{ k: 'ARCHIVE', v: 'nothing in the Wayback Machine' }];
  return [
    { k: 'FIRST', v: w.cdx ? (w.first ? day(w.first.timestamp) : 'unknown') : 'the archive’s index did not answer' },
    { k: 'LATEST', v: w.cdx ? (w.latest ? day(w.latest.timestamp) : 'unknown') : 'the archive’s index did not answer' },
    ...(w.closest ? [{ k: 'CLOSEST', v: `${day(w.closest.timestamp)} ${w.closest.url}` }] : []),
  ];
}

function hostingRows(x: HostingInfo): ViewRow[] {
  const rows: ViewRow[] = [];
  for (const ip of x.ips) {
    const w = ip.who;
    if (w) rows.push({ k: 'OWNER', v: `${ip.ip}: ${[w.org || w.isp, w.asn, [w.city, w.country].filter(Boolean).join(', ') + (w.flag ? ` ${w.flag}` : '')].filter(Boolean).join(' · ') || 'no details'}` });
    const db = ip.db;
    if (db) {
      rows.push({ k: 'PORTS', v: `${ip.ip}: ${none(db.ports.map(String), 16)}`, ...(db.ports.length > 6 ? { n: `${db.ports.length} OPEN`, tone: 'bad' as const } : {}) });
      if (db.hostnames.length) rows.push({ k: 'HOSTNAMES', v: join(db.hostnames, 5) });
      if (db.cpes.length) rows.push({ k: 'SOFTWARE', v: join(db.cpes.map((c) => c.replace(/^cpe:\/?a?:?/, '')), 5) });
      rows.push({ k: 'VULNS', v: none(db.vulns, 8), ...(db.vulns.length ? { n: `${db.vulns.length} LISTED`, tone: 'bad' as const } : {}) });
    }
    for (const n of ip.notes) rows.push({ k: 'NOTE', v: `${ip.ip}: ${n}` });
  }
  if (x.network) rows.push({ k: 'NETWORK', v: `${x.network.name || x.network.handle || 'unnamed'}${x.network.cidr ? ` · ${x.network.cidr}` : ''}${x.network.country ? ` · ${x.network.country}` : ''}${x.network.abuse ? ` · abuse ${x.network.abuse}` : ''}` });
  return rows;
}

function httpRows(x: HttpInfo): ViewRow[] {
  const miss = x.security.missing.length;
  return [
    { k: 'STATUS', v: `${x.status}${x.hops.length ? ` after ${x.hops.length} redirect${x.hops.length === 1 ? '' : 's'} → ${x.finalUrl}` : ''}${x.status >= 300 && x.status < 400 ? ' · still redirecting' : ''}${x.contentType ? ` · ${x.contentType}` : ''}`, ...(x.status >= 400 ? { n: 'ERROR', tone: 'bad' as const } : {}) },
    { k: 'SERVER', v: `${x.server || 'not stated'}${x.poweredBy ? ` · powered by ${x.poweredBy}` : ''}` },
    { k: 'HEADERS', v: `present: ${none(x.security.present)} · missing: ${none(x.security.missing)}`, ...(miss ? { n: `${miss} MISSING`, tone: 'bad' as const } : { n: 'ALL SET', tone: 'up' as const }) },
    { k: 'TITLE', v: `${x.title ? `"${x.title}"` : 'none'}${x.generator ? ` · ${x.generator}` : ''}` },
    { k: 'FILES', v: x.files.map((f) => `${f.path.replace(/^\/(\.well-known\/)?/, '')} ${f.status === null ? f.note : f.note === 'present' ? 'present' : f.note === 'none' ? 'none' : `${f.status} ${f.note}`}`).join(' · ') },
  ];
}

/** The sections in order, each with its rows (or why it has none). */
export function reportRows(r: ReconReport): SectionView[] {
  const sec = <D>(key: string, title: string, s: ReconSection<D>, rows: (d: D) => ViewRow[]): SectionView => ({
    key,
    title,
    source: s.source,
    ok: s.ok,
    skipped: !s.ok && !!s.skipped,
    error: s.ok ? '' : s.error,
    rows: s.ok ? rows(s.data) : [],
  });
  return [
    sec('dns', 'DNS', r.dns, dnsRows),
    sec('registration', 'Registration', r.registration, rdapRows),
    sec('certificates', 'Certificates', r.certificates, certRows),
    sec('subdomains', 'Subdomains', r.subdomains, subdomainRows),
    sec('history', 'History', r.history, waybackRows),
    sec('hosting', 'Hosting', r.hosting, hostingRows),
    sec('http', 'HTTP', r.http, httpRows),
  ];
}

const UK_DAY = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : iso;
};
const CDN = /cloudflare|akamai|fastly|amazon|google|microsoft|edgecast/i;

/**
 * WHAT STANDS OUT: the report in a few plain lines for someone who does not read DNS, worst first (tone 'bad'),
 * then plain facts, then what is in good order (tone 'up'). Each line says what it means, not the record it came from.
 */
export function standout(r: ReconReport, now = Date.now()): ViewRow[] {
  const bad: ViewRow[] = [];
  const fact: ViewRow[] = [];
  const good: ViewRow[] = [];
  const say = (k: string, v: string, tone?: 'up' | 'bad') => (tone === 'bad' ? bad : tone === 'up' ? good : fact).push({ k, v, ...(tone ? { tone } : {}) });
  if (r.hosting.ok) {
    const vulns = [...new Set(r.hosting.data.ips.flatMap((x) => x.db?.vulns ?? []))];
    if (vulns.length) say('RISK', `${vulns.length} known weakness${vulns.length === 1 ? '' : 'es'} listed for its software (${join(vulns, 3)})`, 'bad');
    const busiest = r.hosting.data.ips.filter((x) => x.db).sort((a, b) => b.db!.ports.length - a.db!.ports.length)[0];
    if (busiest && busiest.db!.ports.length > 6) {
      const org = busiest.who?.org || busiest.who?.isp || '';
      const shared = CDN.test(org) ? org.split(/[,\s]/)[0] : '';
      say('PORTS', `${busiest.db!.ports.length} network ports answer on its server${shared ? `: normal for ${shared}’s shared servers` : ' (a website usually needs 2)'}`, shared ? undefined : 'bad');
    }
  }
  if (r.registration.ok && r.registration.data.kind !== 'ip') {
    const g = r.registration.data;
    const left = g.expires ? Math.ceil((Date.parse(g.expires) - now) / 86_400_000) : NaN;
    if (Number.isFinite(left) && left < 0) say('NAME', `Its registration ran out on ${UK_DAY(g.expires!)}`, 'bad');
    else if (Number.isFinite(left) && left < 45) say('NAME', `Its registration runs out in ${left} day${left === 1 ? '' : 's'} (${UK_DAY(g.expires!)})`, 'bad');
    else if (g.registered || g.expires) say('NAME', `${g.registered ? `Registered since ${g.registered.slice(0, 4)}` : 'Registered'}${g.expires ? ` · paid up to ${UK_DAY(g.expires)}` : ''}`);
  }
  if (r.dns.ok && r.kind !== 'ip') {
    const e = r.dns.data.email;
    const strict = !!e.spf && !!e.dmarc && e.dmarcPolicy !== 'none' && e.dmarcPolicy !== null;
    if (takesNoMail(e)) say('EMAIL', strict ? 'Takes no email, and says so: nobody can send email in its name' : 'Takes no email', strict ? 'up' : undefined);
    else if (e.mx.length && !strict) say('EMAIL', `Email could be faked in its name (${[!e.spf && 'no SPF', !e.dmarc && 'no DMARC', e.dmarc && (e.dmarcPolicy ?? 'none') === 'none' && 'DMARC only watches'].filter(Boolean).join(', ')})`, 'bad');
    else if (e.mx.length) say('EMAIL', `Email is protected against forgery (SPF and DMARC p=${e.dmarcPolicy})`, 'up');
  }
  if (r.http.ok) {
    const x = r.http.data;
    const miss = x.security.missing.length;
    const all = miss + x.security.present.length;
    if (x.status >= 400) say('SITE', `The site answered with an error (${x.status})`, 'bad');
    if (miss) say('SITE', `${miss} of ${all} browser safety headers are missing`, 'bad');
    else if (all) say('SITE', 'All the usual browser safety headers are set', 'up');
    if (/^https:/i.test(x.finalUrl)) say('SITE', 'Opens over a secure connection (HTTPS)', 'up');
    else if (/^http:/i.test(x.finalUrl)) say('SITE', 'Does not move visitors to a secure connection (HTTPS)', 'bad');
  }
  if (r.subdomains.ok && r.subdomains.data.hosts.length) {
    const others = r.subdomains.data.hosts.map((x) => x.host).filter((x) => x !== r.host);
    if (others.length) say('NAMES', `${others.length} other name${others.length === 1 ? '' : 's'} found under it (${join(others, 3)})`);
  }
  const failed = failedCount(r);
  if (failed) say('SOURCES', `${failed} source${failed === 1 ? '' : 's'} did not answer: RUN again to ask ${failed === 1 ? 'it' : 'them'}`);
  return [...bad, ...fact, ...good].slice(0, 8);
}

/**
 * The card's error line in plain words: the brain out of reach (a network error), silent for a minute (aborted),
 * failing (5xx), asking for the key again (401); the brain's own words for anything else it refused (they are plain).
 */
export function reconError(e: unknown, status = 0, said = ''): string {
  if ((e as Error | null)?.name === 'AbortError') return 'No answer after a minute. RUN again: the sources that did answer are kept for ten minutes.';
  if (e) return e instanceof TypeError || /fetch|network|load failed/i.test(String((e as Error).message ?? e)) ? 'Can’t reach Ghosty’s brain right now. Check the connection, then RUN again.' : String((e as Error).message ?? e);
  if (status === 401) return 'Ghosty needs your owner key again: pair this phone in Settings, then RUN again.';
  if (status >= 400 && status < 500 && said) return said;
  if (status && status < 400) return 'Ghosty’s brain sent an answer this card can’t read. Try again in a minute.';
  return `Ghosty’s brain had a problem with that (error ${status || 'unknown'}). Try again in a minute.`;
}

/** How many sources did not answer (sections skipped on purpose do not count). */
export const failedCount = (r: ReconReport): number => [r.dns, r.registration, r.certificates, r.subdomains, r.history, r.hosting, r.http].filter((s) => !s.ok && !s.skipped).length;

/** "running 7 checks on example.com… 4.2 s" while the one request is under way. */
export const runningText = (target: string, ms: number): string => `running ${isIp(target.replace(/^https?:\/\//, '').split('/')[0] ?? '') ? 5 : 7} checks on ${target}… ${(ms / 1000).toFixed(1)} s`;

/** The line under the input once the report is in. */
export function summaryLine(r: ReconReport): string {
  const failed = failedCount(r);
  const when = r.cached ? 'from the last run (kept 10 minutes)' : `${(r.ms / 1000).toFixed(1)} s`;
  return `${r.kind === 'ip' ? 'address' : r.kind === 'url' ? 'page' : 'domain'} ${r.host} · ${when}${failed ? ` · ${failed} source${failed === 1 ? '' : 's'} did not answer` : ''}`;
}

/** The library document's title. */
export const reconTitle = (r: ReconReport): string => `Recon: ${r.host} ${new Date(r.at).toISOString().slice(0, 10)}`;

/** The question ASK GHOSTY sends to the chat. */
export const askPrompt = (r: ReconReport): string =>
  `I ran recon on ${r.target} in the Threats tab (your recon_domain has the report cached for ten minutes). Read it and tell me what stands out: exposed services or listed vulnerabilities, missing security headers, the email posture, old or odd subdomains, when the registration expires — and what to look at next.`;
