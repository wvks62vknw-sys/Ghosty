/**
 * Infrastructure recon: the report the brain builds (apps/edge/src/integrations/recon.ts) and
 * the interface shows (GET /api/recon → the Threats tab's RECON card). Passive lookups of public
 * records about a domain, host, IP address or web address — never a person. Every section names
 * its source; a source that did not answer leaves its section `ok: false` with the reason, and
 * the rest of the report stands.
 */
export type ReconKind = 'domain' | 'ip' | 'url';

export type ReconSection<T> =
  | { source: string; ok: true; ms: number; data: T }
  | { source: string; ok: false; ms: number; error: string; skipped?: boolean };

export interface DnsRecord {
  type: string;
  data: string;
  ttl: number;
}

export interface DnsInfo {
  name: string;
  /** A, AAAA, MX, NS, TXT, CNAME and CAA records (PTR for an IP address), deduplicated. */
  records: DnsRecord[];
  /** The A and AAAA addresses. */
  ips: string[];
  /** Email posture from the TXT records: the SPF record, the DMARC record at _dmarc.<name> and its policy. */
  email: { spf: string | null; dmarc: string | null; dmarcPolicy: string | null; mx: string[] };
  /** Record types dns.google did not answer for. */
  failed: string[];
}

export interface RdapInfo {
  kind: 'domain' | 'ip';
  handle: string;
  /** The domain (ldhName) or the network's name. */
  name: string;
  registrar: string;
  registered: string | null;
  expires: string | null;
  changed: string | null;
  status: string[];
  nameservers: string[];
  dnssec: boolean | null;
  /** IP networks: the block, its country and its abuse mailbox (an organisation's, never a person's). */
  cidr: string;
  country: string;
  abuse: string;
}

export interface CertInfo {
  domain: string;
  /** Rows read from crt.sh (at most 500) and how many distinct name sets they cover. */
  total: number;
  distinct: number;
  truncated: boolean;
  names: string[];
  wildcards: string[];
  subdomains: string[];
  issuers: { name: string; n: number }[];
  newest: { notBefore: string; notAfter: string; name: string; issuer: string } | null;
}

export interface SubdomainHost {
  host: string;
  ip: string | null;
  via: string[];
}

export interface SubdomainInfo {
  domain: string;
  hosts: SubdomainHost[];
  sources: { source: string; n: number; note: string }[];
}

export interface WaybackInfo {
  url: string;
  closest: { url: string; timestamp: string; status: string } | null;
  first: { timestamp: string; url: string } | null;
  latest: { timestamp: string; url: string } | null;
  /** Whether the CDX API answered in time (first and latest captures come from it). */
  cdx: boolean;
}

export interface IpInfo {
  ip: string;
  who: { org: string; isp: string; asn: string; country: string; countryCode: string; region: string; city: string; flag: string; type: string } | null;
  db: { ports: number[]; hostnames: string[]; cpes: string[]; vulns: string[]; tags: string[] } | null;
  notes: string[];
}

export interface HostingInfo {
  ips: IpInfo[];
  /** The first address's network (rdap.org), when it answered. */
  network: RdapInfo | null;
}

export interface HttpHop {
  url: string;
  status: number;
  location: string;
}

export interface HttpInfo {
  url: string;
  finalUrl: string;
  status: number;
  hops: HttpHop[];
  server: string;
  poweredBy: string;
  contentType: string;
  security: { present: string[]; missing: string[] };
  title: string;
  generator: string;
  /** /robots.txt, /sitemap.xml and /.well-known/security.txt: the status each answered with (null = no answer). */
  files: { path: string; status: number | null; note: string }[];
}

export interface ReconReport {
  /** The target as given (trimmed). */
  target: string;
  kind: ReconKind;
  /** The hostname or IP address looked up. */
  host: string;
  /** The registrable domain (example.co.uk for www.example.co.uk), '' for an IP address. */
  domain: string;
  /** The address fingerprinted over HTTP. */
  url: string;
  at: number;
  ms: number;
  cached?: boolean;
  dns: ReconSection<DnsInfo>;
  registration: ReconSection<RdapInfo>;
  certificates: ReconSection<CertInfo>;
  subdomains: ReconSection<SubdomainInfo>;
  history: ReconSection<WaybackInfo>;
  hosting: ReconSection<HostingInfo>;
  http: ReconSection<HttpInfo>;
}

/** The order the sections are shown in, with their titles. */
export const RECON_SECTIONS: [key: Exclude<keyof ReconReport, 'target' | 'kind' | 'host' | 'domain' | 'url' | 'at' | 'ms' | 'cached'>, title: string][] = [
  ['dns', 'DNS'],
  ['registration', 'Registration'],
  ['certificates', 'Certificates'],
  ['subdomains', 'Subdomains'],
  ['history', 'History'],
  ['hosting', 'Hosting'],
  ['http', 'HTTP'],
];
