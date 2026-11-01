/**
 * KNOWLEDGE WITH SOURCES (OWNER-ISSUES 77): how far a source can be trusted, and how strongly a claim may be put — as code,
 * not only as words. Pure, shared by the brain (the cited pipeline, the search tools, the Digest) and the phone (the chips).
 *
 *  - `tierOf(url)`: PRIMARY (courts and tribunals, the UN, official releases and law, official data, academic work),
 *    CREDIBLE (human-rights and humanitarian bodies, investigative and fact-checking journalism), PRESS (established news
 *    organisations), REFERENCE (encyclopaedias: tertiary, their references are leads to primaries, never themselves the
 *    proof of a contested claim), LEAD (social platforms: where a claim is found, never what proves it), UNKNOWN (the rest).
 *    A curated host list (subdomains match), each row with its reason.
 *  - `capLabel(proposed, tiers)`: the six labels, and the lines that hold: a claim backed only by LEAD sources is at most a
 *    rumour; "established fact" needs at least one PRIMARY source or two CREDIBLE/PRESS ones read this turn; a claim with no
 *    supporting source read is contested at best. The label a model proposes is capped by what the tiers allow.
 *
 * About public matters and public figures as the documents say, never a private person (BRIEF-WORKSHOP, the lines that hold).
 */

export type Tier = 'primary' | 'credible' | 'press' | 'reference' | 'lead' | 'unknown';
export const TIERS: Tier[] = ['primary', 'credible', 'press', 'reference', 'lead', 'unknown'];

/** The host list: a tier, its hosts (a host matches itself and its subdomains), and why. */
const TABLE: [Tier, string[], string][] = [
  // PRIMARY: the record itself
  ['primary', ['icj-cij.org', 'icc-cpi.int', 'supremecourt.uk', 'judiciary.uk', 'bailii.org', 'courtlistener.com', 'documentcloud.org', 'echr.coe.int', 'curia.europa.eu', 'supremecourt.gov', 'uscourts.gov'], 'courts and tribunals: judgments, orders and filings (and the public archives that hold the filings as filed)'],
  ['primary', ['un.org', 'ohchr.org', 'news.un.org', 'digitallibrary.un.org', 'unrwa.org', 'unicef.org', 'unhcr.org', 'ochaopt.org', 'unocha.org', 'reliefweb.int'], 'the UN: its bodies’ own reports, resolutions, commissions of inquiry and data'],
  ['primary', ['gov.uk', 'legislation.gov.uk', 'parliament.uk', 'hansard.parliament.uk', 'congress.gov', 'govinfo.gov', 'justice.gov', 'fbi.gov', 'nationalarchives.gov.uk', 'archives.gov', 'state.gov', 'whitehouse.gov', 'gov.scot', 'gov.wales'], 'official releases and the law as published by the government or parliament itself (fbi.gov holds the FOIA Vault)'],
  ['primary', ['acas.org.uk', 'ico.org.uk', 'equalityhumanrights.com', 'policeconduct.gov.uk'], 'the UK’s statutory bodies and regulators (Acas, the Information Commissioner, the Equality and Human Rights Commission, the police complaints office): their own guidance and decisions, at source'],
  ['primary', ['ons.gov.uk', 'data.gov.uk', 'who.int', 'nhs.uk', 'ec.europa.eu', 'europa.eu', 'oecd.org', 'worldbank.org', 'imf.org', 'census.gov', 'bls.gov', 'cdc.gov', 'nih.gov'], 'official data and health bodies: the statistics and guidance at source'],
  ['primary', ['doi.org', 'arxiv.org', 'nature.com', 'science.org', 'thelancet.com', 'bmj.com', 'nejm.org', 'pubmed.ncbi.nlm.nih.gov', 'ncbi.nlm.nih.gov', 'jstor.org', 'ac.uk', 'edu', 'scholar.google.com', 'plos.org', 'sciencedirect.com', 'springer.com', 'wiley.com', 'cambridge.org', 'oup.com'], 'academic work: the papers and university pages (a preprint is a paper not yet peer-reviewed: still the primary record of what it says)'],
  // CREDIBLE: careful secondary work with a method
  ['credible', ['amnesty.org', 'amnesty.org.uk', 'hrw.org', 'btselem.org', 'msf.org', 'icrc.org', 'pchrgaza.org', 'alhaq.org', 'savethechildren.org', 'savethechildren.org.uk', 'oxfam.org', 'libertyhumanrights.org.uk', 'aclu.org', 'transparency.org'], 'human-rights and humanitarian bodies: documented investigations with a stated method'],
  ['credible', ['citizensadvice.org.uk', 'shelter.org.uk'], 'advice charities: the law and the steps to take, explained for the public from the statutes and the rules'],
  ['credible', ['icij.org', 'bellingcat.com', 'occrp.org', 'propublica.org', 'fullfact.org', 'factcheck.org', 'theintercept.com', 'declassifieduk.org', 'forensic-architecture.org', 'thebureauinvestigates.com', 'snopes.com', 'politifact.com', 'opendemocracy.net', 'airwars.org'], 'investigative and fact-checking journalism: shows its documents and its working'],
  // PRESS: established news organisations, edited, correctable
  ['press', ['bbc.co.uk', 'bbc.com', 'bbci.co.uk', 'reuters.com', 'apnews.com', 'theguardian.com', 'ft.com', 'economist.com', 'nytimes.com', 'washingtonpost.com', 'aljazeera.com', 'haaretz.com', 'timesofisrael.com', 'telegraph.co.uk', 'independent.co.uk', 'sky.com', 'channel4.com', 'itv.com', 'thetimes.co.uk', 'wsj.com', 'bloomberg.com', 'npr.org', 'pbs.org', 'lemonde.fr', 'dw.com', 'france24.com', 'cnn.com', 'abc.net.au', 'cbc.ca', 'politico.eu', 'politico.com', 'middleeasteye.net', '972mag.com'], 'established news organisations: edited, named, and they correct their mistakes'],
  // REFERENCE: tertiary
  ['reference', ['wikipedia.org', 'wikidata.org', 'britannica.com', 'wikimedia.org', 'stackoverflow.com'], 'encyclopaedias and reference works: tertiary — their references are the leads to follow'],
  // LEAD: where claims are found, never what proves them
  ['lead', ['tiktok.com', 'x.com', 'twitter.com', 'youtube.com', 'youtu.be', 'instagram.com', 'facebook.com', 'fb.watch', 'reddit.com', 't.me', 'telegram.me', 'threads.net', 'snapchat.com', 'bsky.app', 'truthsocial.com', 'rumble.com', 'substack.com', 'medium.com', 'quora.com', 'news.ycombinator.com'], 'social platforms and self-publishing: a claim found here is a lead to follow to its root, never the proof'],
];

const HOSTS = new Map<string, Tier>();
for (const [tier, hosts] of TABLE) for (const h of hosts) HOSTS.set(h, tier);

/** The host of an address, lower case, without "www." ("" when it is not one). */
export function hostOf(urlOrHost: string): string {
  const s = String(urlOrHost ?? '').trim();
  if (!s) return '';
  try {
    return new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return '';
  }
}

/** How far a source can be trusted, by its host: the host itself or the nearest parent domain in the table. */
export function tierOf(urlOrHost: string): Tier {
  const h = hostOf(urlOrHost);
  if (!h) return 'unknown';
  const parts = h.split('.');
  for (let i = 0; i < parts.length; i++) {
    const t = HOSTS.get(parts.slice(i).join('.'));
    if (t) return t;
  }
  return 'unknown';
}

/** Why a host has its tier (for the chips' long press and the tests), or ''. */
export function tierReason(urlOrHost: string): string {
  const h = hostOf(urlOrHost);
  const parts = h.split('.');
  for (let i = 0; i < parts.length; i++) {
    const row = TABLE.find(([, hosts]) => hosts.includes(parts.slice(i).join('.')));
    if (row) return row[2];
  }
  return '';
}

/** The chip's word. */
export function tierWord(t: Tier | undefined): string {
  return (t ?? 'unknown').toUpperCase();
}

/** A library document's tier: its source address's; a YouTube transcript is a LEAD; his research notes are REFERENCE; the morning digest's passage says its own (its heading ends "· PRIMARY"); his uploads are UNKNOWN. */
export function libraryTier(id: string, source = '', heading = ''): Tier {
  if (/^yt_/i.test(id)) return 'lead';
  if (id === 'notes_research') return 'reference';
  const tagged = /·\s*(PRIMARY|CREDIBLE|PRESS|REFERENCE|LEAD|UNKNOWN)\s*$/.exec(heading);
  if (tagged) return tagged[1]!.toLowerCase() as Tier;
  const url = /https?:\/\/\S+/.exec(source)?.[0];
  if (url) return tierOf(url);
  if (/^arxiv\b/i.test(source)) return 'primary';
  return 'unknown';
}

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)tiktok\.com$/, 'TikTok'], [/(^|\.)(x|twitter)\.com$/, 'X'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'], [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(facebook\.com|fb\.watch)$/, 'Facebook'], [/(^|\.)reddit\.com$/, 'Reddit'], [/(^|\.)(t\.me|telegram\.me)$/, 'Telegram'], [/(^|\.)threads\.net$/, 'Threads'],
  [/(^|\.)snapchat\.com$/, 'Snapchat'], [/(^|\.)bsky\.app$/, 'Bluesky'], [/(^|\.)substack\.com$/, 'Substack'], [/(^|\.)medium\.com$/, 'Medium'],
];

/** What a page from a lead is, said before its words: "TikTok is a lead, not a source: …". */
export function leadNote(url: string): string {
  const h = hostOf(url);
  const name = PLATFORMS.find(([re]) => re.test(h))?.[1] ?? h ?? 'This';
  return `${name} is a lead, not a source: take the claim from it, then find its root — the court filing, the official release, the report or the paper — and say what that says. Never cite ${name} itself as the proof.`;
}

export const LABELS = ['established fact', 'documented allegation', 'legal finding in progress', 'contested', 'rumour', 'debunked'] as const;
export type Label = (typeof LABELS)[number];

/** A label in its one spelling, from what a model wrote ("Established Fact", "allegation", "rumor"); null when it is none of the six. */
export function labelOf(word: unknown): Label | null {
  const w = String(word ?? '').toLowerCase().trim();
  if (!w) return null;
  if (/establish|^fact$|proven fact|confirmed/.test(w)) return 'established fact';
  if (/legal|court|pending|in progress|ongoing case|proceeding/.test(w)) return 'legal finding in progress';
  if (/alleg|documented|reported/.test(w)) return 'documented allegation';
  if (/contest|disput|unclear|uncertain|unverified/.test(w)) return 'contested';
  if (/rumou?r|hearsay|speculat/.test(w)) return 'rumour';
  if (/debunk|false|disproven|refuted|myth/.test(w)) return 'debunked';
  return null;
}

/**
 * The strongest label the sources allow, given what was proposed. `tiers`: the sources read this turn that back the claim
 * (none: nothing read backs it). The lines that hold:
 *  - nothing backing it → contested at best;
 *  - only LEAD sources → rumour at best;
 *  - "established fact" needs ≥ 1 PRIMARY, or ≥ 2 CREDIBLE/PRESS → else a documented allegation.
 * With no proposal, the default is what the tiers say (documented allegation when backed by anything but leads).
 */
export function capLabel(proposed: unknown, tiers: Tier[]): { label: Label; capped: boolean; why?: string } {
  const want = labelOf(proposed);
  if (!tiers.length) {
    const label: Label = want === 'rumour' ? 'rumour' : 'contested';
    return { label, capped: !!want && want !== label, ...(want && want !== label ? { why: 'no source read this turn backs it' } : {}) };
  }
  if (tiers.every((t) => t === 'lead')) {
    const label: Label = 'rumour';
    return { label, capped: !!want && want !== label, ...(want && want !== label ? { why: 'only a lead (a social platform) backs it' } : {}) };
  }
  const primary = tiers.filter((t) => t === 'primary').length;
  const strong = tiers.filter((t) => t === 'credible' || t === 'press').length;
  const established = primary >= 1 || strong >= 2;
  const label: Label = want ?? 'documented allegation';
  if (label === 'established fact' && !established) return { label: 'documented allegation', capped: true, why: 'an established fact needs a primary source, or two credible ones' };
  return { label, capped: false };
}

/** The labels counted for the check line: "2 established, 1 documented, 1 contested". */
export function labelCounts(labels: (Label | undefined)[]): string {
  const short: Record<Label, string> = { 'established fact': 'established', 'documented allegation': 'documented', 'legal finding in progress': 'in court', contested: 'contested', rumour: 'rumour', debunked: 'debunked' };
  const n = new Map<Label, number>();
  for (const l of labels) if (l) n.set(l, (n.get(l) ?? 0) + 1);
  return LABELS.filter((l) => n.get(l)).map((l) => `${n.get(l)} ${short[l]}`).join(', ');
}
