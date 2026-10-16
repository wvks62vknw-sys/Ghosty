/**
 * Infrastructure recon as tools: recon_domain runs every passive check at once (and can file
 * the report in the library); the pieces — dns_lookup, whois_rdap, cert_search, subdomains,
 * wayback_lookup, ip_lookup, http_fingerprint — stand on their own so the model can chain them
 * (recon, then library_import or web_fetch of something it found). Every one is infrastructure
 * only: a person's name or an email address is refused, with the reason, before anything is
 * looked up. Sources are keyless and public; nothing scans or logs in.
 */
import { chunkText } from '../../../../packages/shared/src/chunk';
import { certs, dnsLookup, httpFingerprint, ipInfo, notInfrastructure, rdap, recon, renderCerts, renderDns, renderHosting, renderHttp, renderRdap, renderReport, renderSubdomains, renderWayback, subdomains, wayback } from '../integrations/recon';
import { asData } from '../kernel/permissions';
import { Library } from '../library/store';
import { arg, clip, type Tool, type ToolContext } from './types';

const POLICY = "Infrastructure only — a domain, hostname, IP address or web address; it refuses a person's name or an email address and says why. Passive public records, no scanning, no logins.";

/** A refusal the model can read, or '' when the target is infrastructure. */
const refusal = (raw: string): string => {
  const why = notInfrastructure(raw);
  return why ? `Not looking that up: ${why}.` : '';
};

const progress = (ctx: ToolContext, label: string, done?: number, total?: number): void => ctx.progress?.(label, done, total);

/** The bare hostname in what the model sent (a URL, a host with a path, upper case). Checked for refusal first, as given. */
const bareHost = (raw: string): string => raw.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0]!;

const SOURCE = 'recon sources (dns.google, rdap.org, crt.sh, archive.org, ipwho.is, internetdb.shodan.io, hackertarget, the site itself)';

/** File the Markdown report in the library as a document of kind 'recon'. Returns the document's title. */
async function fileReport(ctx: ToolContext, target: string, markdown: string): Promise<string> {
  const l = new Library(ctx.storage, ctx.env);
  if (!l.available) throw new Error('the library is not available here (it needs Ghosty’s SQLite storage)');
  const title = `Recon: ${target} ${new Date().toISOString().slice(0, 10)}`;
  const doc = l.createDoc({ title, source: 'recon', kind: 'recon' });
  const passages = chunkText(markdown, { heading: title });
  for (let i = 0; i < passages.length; i += 40) await l.addPassages(doc.id, passages.slice(i, i + 40));
  l.finish(doc.id);
  return title;
}

export const reconTools: Tool[] = [
  {
    name: 'recon_domain',
    description: `Everything the public record says about a domain, host, IP address or web address, in one go: DNS records and email posture (SPF, DMARC), registration (registrar, dates, status, nameservers), certificates and the subdomains they reveal, the Wayback Machine's first and latest captures, hosting (owner, ASN, place, the ports and vulnerabilities Shodan's free InternetDB already lists) and one HTTP fingerprint (redirects, server, security headers, title, robots/sitemap/security.txt). Runs the sources in parallel, about 5–15 s; a source that does not answer is said so. Then chain: library_import or web_fetch an interesting page or subdomain it found. save: true files the report in the library. ${POLICY}`,
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: 'e.g. example.com, www.example.co.uk, 93.184.216.34, https://example.com/page' },
        save: { type: 'boolean', description: 'file the report in the library as "Recon: <target> <date>"' },
      },
      required: ['target'],
    },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const target = arg.str(a, 'target').trim();
      const no = refusal(target);
      if (no) return no;
      const report = await recon(target, { onStep: (label, done, total) => progress(ctx, done ? `${label} · ${done} of ${total}` : `running ${total} checks on ${target}…`, done, total) });
      let md = renderReport(report);
      if (arg.bool(a, 'save')) {
        progress(ctx, 'filing the report in the library…');
        const title = await fileReport(ctx, report.host, md);
        md += `\n\nFiled in the library as "${title}" (kind: recon).`;
      }
      return asData(SOURCE, clip(md, 9000));
    },
  },
  {
    name: 'dns_lookup',
    description: `DNS records of a name from Google's public resolver: A, AAAA, MX, NS, TXT, CNAME, CAA (PTR for an IP address), plus the email posture — SPF present or not, DMARC policy. ${POLICY}`,
    parameters: { type: 'object', properties: { name: { type: 'string', description: 'a hostname, e.g. mail.example.com, or an IP address for its reverse name' } }, required: ['name'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const raw = arg.str(a, 'name');
      const no = refusal(raw);
      if (no) return no;
      const name = bareHost(raw);
      progress(ctx, 'dns.google…');
      const d = await dnsLookup(name);
      return asData('dns.google', [`DNS for ${name}:`, ...renderDns(d)].join('\n'));
    },
  },
  {
    name: 'whois_rdap',
    description: `Who a domain is registered with and when (registrar, registration/expiry/last-changed dates, status, nameservers), or for an IP address which network it is in (name, block, country, abuse contact) — the registry's RDAP record via rdap.org, the modern WHOIS. Contact people are not read. ${POLICY}`,
    parameters: { type: 'object', properties: { target: { type: 'string', description: 'a domain (example.com) or an IP address' } }, required: ['target'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const raw = arg.str(a, 'target');
      const no = refusal(raw);
      if (no) return no;
      const target = bareHost(raw);
      progress(ctx, 'rdap.org…');
      const r = await rdap(target);
      return asData('rdap.org', [`RDAP for ${r.name || target}:`, ...renderRdap(r)].join('\n'));
    },
  },
  {
    name: 'cert_search',
    description: `Certificates issued for a domain and its subdomains, from the public certificate transparency logs (crt.sh): the names on them, wildcards, issuers, the newest. Can take ten seconds. ${POLICY}`,
    parameters: { type: 'object', properties: { domain: { type: 'string', description: 'e.g. example.com' } }, required: ['domain'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const raw = arg.str(a, 'domain');
      const no = refusal(raw);
      if (no) return no;
      const domain = bareHost(raw);
      progress(ctx, 'crt.sh… (can take ten seconds)');
      const c = await certs(domain);
      return asData('crt.sh', [`Certificates for ${c.domain}:`, ...renderCerts(c)].join('\n'));
    },
  },
  {
    name: 'subdomains',
    description: `Hostnames under a domain, from the names on its certificates (crt.sh) and hackertarget's host search — with the address each resolves to where known. ${POLICY}`,
    parameters: { type: 'object', properties: { domain: { type: 'string', description: 'e.g. example.com' } }, required: ['domain'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const raw = arg.str(a, 'domain');
      const no = refusal(raw);
      if (no) return no;
      const domain = bareHost(raw);
      progress(ctx, 'crt.sh and hackertarget…');
      const s = await subdomains(domain);
      return asData('crt.sh, hackertarget', clip([`Subdomains of ${s.domain}:`, ...renderSubdomains(s)].join('\n'), 6000));
    },
  },
  {
    name: 'wayback_lookup',
    description: `What the Wayback Machine (archive.org) has for a web address: the closest snapshot, and the first and latest captures of its host. ${POLICY}`,
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'e.g. https://example.com/ or a bare domain' } }, required: ['url'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const raw = arg.str(a, 'url').trim();
      const no = refusal(raw);
      if (no) return no;
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}/`;
      progress(ctx, 'archive.org…');
      const w = await wayback(url);
      return asData('archive.org', [`Wayback Machine for ${url}:`, ...renderWayback(w)].join('\n'));
    },
  },
  {
    name: 'ip_lookup',
    description: `Who an IP address belongs to and where it is (ipwho.is: organisation, ASN, country, city) and what Shodan's free InternetDB already lists for it (open ports, hostnames, CPEs, known vulnerabilities) — a summary of what others have seen, never a scan by you. whois_rdap gives the network block. ${POLICY}`,
    parameters: { type: 'object', properties: { ip: { type: 'string', description: 'an IPv4 or IPv6 address' } }, required: ['ip'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const ip = arg.str(a, 'ip').trim();
      const no = refusal(ip);
      if (no) return no;
      progress(ctx, 'ipwho.is and internetdb.shodan.io…');
      const i = await ipInfo(ip);
      return asData('ipwho.is, internetdb.shodan.io', [`Address ${ip}:`, ...renderHosting({ ips: [i], network: null })].join('\n'));
    },
  },
  {
    name: 'http_fingerprint',
    description: `One ordinary page request to a web address, like a browser would make: the redirect chain and final address, status, server and X-Powered-By headers, which security headers are present or missing (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), the page title and generator, and whether robots.txt, sitemap.xml and security.txt exist. Nothing else is requested. ${POLICY}`,
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'e.g. https://example.com/ or a bare domain' } }, required: ['url'] },
    risk: 'auto',
    pure: true,
    async run(a, ctx) {
      const raw = arg.str(a, 'url').trim();
      const no = refusal(raw);
      if (no) return no;
      const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}/`;
      progress(ctx, `fetching ${url}…`);
      const x = await httpFingerprint(url);
      return asData(url, [`HTTP fingerprint of ${url}:`, ...renderHttp(x)].join('\n'));
    },
  },
];
