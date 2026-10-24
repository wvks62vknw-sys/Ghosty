/**
 * GADGET MANUALS: "find the manual for my Bosch dishwasher SMS24AW01G" (or the rating plate read in Lens READ) → the
 * maker's own PDF found by a web search, read here with the library's PDF reader (packages/shared/src/pdf.ts) and
 * kept in the library on the GADGETS shelf (kind `manual`, one passage per page or part of a page, each with its page
 * number), with a record of the gadget (`GADGETS_KEY`: make, model, what it is, the document, where it came from and
 * its licence). From then on "my dishwasher shows E24" answers from the manual's own pages ("from the manual, page
 * 12"), or, when the manual is silent, from a web search said to be "from the web, not the manual". Replacement parts
 * are a search for the exact part name with plain links: in the order the search gave them, no shop favoured, any
 * affiliate tag taken off, and never a purchase.
 *
 * Where a manual may come from (`sourceOf`): the maker's own sites first (`MAKERS`), then the open archives known to
 * allow it (`ARCHIVES`); never a site that forbids it — the archives whose robots.txt shuts robots out of their
 * downloads (`FORBIDDEN`, checked by hand on 24 October 2026) and, at fetch time, any host whose robots.txt disallows
 * the file or whose content signals say no to AI input (`robotsAllows`). Any other site is not used. Every pick and
 * every skip is said, with the reason. The manual stays the maker's copyright: kept privately for the owner's own
 * use, never shared, published or trained on.
 */
import { chunkText } from '../../../../packages/shared/src/chunk';
import { extractPdf } from '../../../../packages/shared/src/pdf';
import { makeIn, modelIn } from '../../../../packages/shared/src/rating';
import type { Library } from '../library/store';
import { parseHitList } from './parts';

export const GADGETS_KEY = 'gadgets';
export const MAX_GADGETS = 60;
/** The most of a PDF fetched (a long multi-language manual is 5–15 MB) and the most pages kept. */
export const MAX_PDF_BYTES = 20_000_000;
export const MAX_PAGES = 240;
const UA = 'Mozilla/5.0 (compatible; GhostyAssistant/2.0; personal assistant)';

/** Makers and their own sites (where their manuals live). A host counts when it is one of these or under one. */
export const MAKERS: Record<string, { name: string; hosts: string[] }> = {
  bosch: { name: 'Bosch', hosts: ['bosch-home.co.uk', 'bosch-home.com', 'bosch.com', 'bosch.co.uk'] },
  siemens: { name: 'Siemens', hosts: ['siemens-home.bsh-group.com', 'siemens-home.com', 'bsh-group.com'] },
  neff: { name: 'Neff', hosts: ['neff-home.com', 'neff.co.uk'] },
  samsung: { name: 'Samsung', hosts: ['samsung.com', 'samsungsetup.com'] },
  lg: { name: 'LG', hosts: ['lg.com', 'gscs.lge.com', 'lge.com'] },
  sony: { name: 'Sony', hosts: ['sony.co.uk', 'sony.com', 'sony.net'] },
  panasonic: { name: 'Panasonic', hosts: ['panasonic.com', 'panasonic.co.uk', 'panasonic.net'] },
  philips: { name: 'Philips', hosts: ['philips.co.uk', 'philips.com', 'documents.4rgos.it'] },
  whirlpool: { name: 'Whirlpool', hosts: ['whirlpool.co.uk', 'whirlpool.com', 'docs.whirlpool.eu'] },
  hotpoint: { name: 'Hotpoint', hosts: ['hotpoint.co.uk', 'hotpoint.eu', 'docs.whirlpool.eu'] },
  indesit: { name: 'Indesit', hosts: ['indesit.co.uk', 'indesit.com', 'docs.whirlpool.eu'] },
  beko: { name: 'Beko', hosts: ['beko.co.uk', 'beko.com', 'bekodocs.com'] },
  aeg: { name: 'AEG', hosts: ['aeg.co.uk', 'aeg.com', 'electrolux-medialibrary.com', 'electrolux.com'] },
  electrolux: { name: 'Electrolux', hosts: ['electrolux.co.uk', 'electrolux.com', 'electrolux-medialibrary.com'] },
  zanussi: { name: 'Zanussi', hosts: ['zanussi.co.uk', 'zanussi.com', 'electrolux-medialibrary.com'] },
  miele: { name: 'Miele', hosts: ['miele.co.uk', 'miele.com', 'mieleusa.com'] },
  hoover: { name: 'Hoover', hosts: ['hoover.co.uk', 'hoover-home.com', 'candy-hoover.com'] },
  candy: { name: 'Candy', hosts: ['candy-home.com', 'candy.co.uk', 'candy-hoover.com'] },
  smeg: { name: 'Smeg', hosts: ['smeg.com', 'smeg.co.uk'] },
  dyson: { name: 'Dyson', hosts: ['dyson.co.uk', 'dyson.com'] },
  delonghi: { name: "De'Longhi", hosts: ['delonghi.com', 'delonghi.co.uk'] },
  kenwood: { name: 'Kenwood', hosts: ['kenwoodworld.com', 'kenwood.co.uk'] },
  haier: { name: 'Haier', hosts: ['haier.co.uk', 'haier-europe.com', 'haier.com'] },
  hisense: { name: 'Hisense', hosts: ['hisense.co.uk', 'hisense.com', 'hisense-europe.com'] },
  sharp: { name: 'Sharp', hosts: ['sharp.co.uk', 'sharp.eu', 'sharpconsumer.eu'] },
  worcester: { name: 'Worcester Bosch', hosts: ['worcester-bosch.co.uk'] },
  vaillant: { name: 'Vaillant', hosts: ['vaillant.co.uk', 'vaillant.com'] },
  ideal: { name: 'Ideal', hosts: ['idealheating.com'] },
  baxi: { name: 'Baxi', hosts: ['baxi.co.uk'] },
  sonos: { name: 'Sonos', hosts: ['sonos.com'] },
  yamaha: { name: 'Yamaha', hosts: ['yamaha.com', 'usa.yamaha.com'] },
  canon: { name: 'Canon', hosts: ['canon.co.uk', 'canon-europe.com', 'canon.com'] },
  epson: { name: 'Epson', hosts: ['epson.co.uk', 'epson.eu', 'epson.com'] },
  hp: { name: 'HP', hosts: ['hp.com'] },
  brother: { name: 'Brother', hosts: ['brother.co.uk', 'brother.com'] },
  tefal: { name: 'Tefal', hosts: ['tefal.co.uk', 'groupeseb.com'] },
  russell: { name: 'Russell Hobbs', hosts: ['russellhobbs.com'] },
  morphy: { name: 'Morphy Richards', hosts: ['morphyrichards.co.uk'] },
  ninja: { name: 'Ninja', hosts: ['ninjakitchen.co.uk', 'sharkninja.com'] },
};

/** Open archives known to allow reading their copies. */
export const ARCHIVES: { host: string; name: string; licence: string }[] = [
  { host: 'archive.org', name: 'the Internet Archive', licence: "the Internet Archive's copy; the manual stays the maker's copyright: kept privately for the owner's own use, never shared or published" },
];

/** Manual sites that forbid it: their robots.txt shuts robots out of the downloads (checked by hand on 24 October 2026). */
export const FORBIDDEN: { host: string; name: string; why: string }[] = [
  { host: 'manualslib.com', name: 'ManualsLib', why: "ManualsLib's robots.txt shuts robots out of its downloads (/download/)" },
  { host: 'manualzz.com', name: 'Manualzz', why: "Manualzz's robots.txt shuts robots out of its downloads and documents (/download/, /documents/)" },
];

/** What kind of gadget it is, from the owner's words. */
const KINDS = ['washer dryer', 'washing machine', 'tumble dryer', 'dishwasher', 'fridge freezer', 'fridge', 'freezer', 'oven', 'cooker', 'hob', 'microwave', 'extractor', 'cooker hood', 'boiler', 'kettle', 'toaster', 'coffee machine', 'air fryer', 'vacuum', 'hoover', 'television', 'tv', 'soundbar', 'speaker', 'amplifier', 'receiver', 'printer', 'camera', 'router', 'thermostat', 'heater', 'dehumidifier', 'blender', 'food processor', 'iron', 'hair dryer'];

export interface Device {
  make: string;
  /** The key in MAKERS, when the make is a known one. */
  maker?: string;
  model: string;
  kind: string;
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};
const under = (host: string, h: string) => host === h || host.endsWith(`.${h}`);

/** The make, model and kind of gadget from the owner's words (or a rating plate's text). */
export function parseDevice(text: string): Device {
  const t = String(text ?? '').toLowerCase();
  const maker = makeIn(text) || undefined;
  const kind = KINDS.find((k) => new RegExp(`\\b${k}s?\\b`).test(t)) ?? '';
  return { make: maker ? MAKERS[maker]!.name : '', ...(maker ? { maker } : {}), model: modelIn(text), kind: kind === 'tv' ? 'TV' : kind };
}

export const deviceName = (d: Pick<Device, 'make' | 'kind' | 'model'>) => [d.make, d.kind, d.model].filter(Boolean).join(' ') || 'the gadget';

export interface Source {
  from: 'maker' | 'archive' | 'forbidden' | 'other';
  name: string;
  why?: string;
  licence?: string;
}

/** Where a link is from, and whether a manual may be taken from it. */
export function sourceOf(url: string, d: Pick<Device, 'maker' | 'make'>): Source {
  const host = hostOf(url);
  const bad = FORBIDDEN.find((f) => under(host, f.host));
  if (bad) return { from: 'forbidden', name: bad.name, why: bad.why };
  const mk = d.maker ? MAKERS[d.maker] : undefined;
  if (mk?.hosts.some((h) => under(host, h))) return { from: 'maker', name: `${mk.name}'s own site`, licence: `© ${mk.name}: the maker's own manual, free on its site; kept privately for the owner's own use, never shared or published` };
  const arc = ARCHIVES.find((a) => under(host, a.host));
  if (arc) return { from: 'archive', name: arc.name, licence: arc.licence };
  return { from: 'other', name: host || 'a web page', why: `${host || 'that site'} is neither ${mk ? `${mk.name}'s own site` : "the maker's own site"} nor an archive known to allow it` };
}

export interface ManualPick {
  url: string;
  title: string;
  source: Source;
}

/**
 * The search results → the manual to take, best first: the maker's own PDF, a page on the maker's site (its PDF links
 * are read next), an archive's copy. Forbidden sites and any other site are skipped, each with its reason.
 */
export function pickManual(hits: { title: string; url: string }[], d: Device): { picks: ManualPick[]; skipped: { url: string; why: string }[] } {
  const picks: (ManualPick & { rank: number })[] = [];
  const skipped: { url: string; why: string }[] = [];
  for (const h of hits) {
    if (!/^https?:\/\//i.test(h.url) || picks.some((p) => p.url === h.url)) continue;
    const source = sourceOf(h.url, d);
    if (source.from === 'forbidden' || source.from === 'other') {
      skipped.push({ url: h.url, why: source.why ?? 'not used' });
      continue;
    }
    const pdf = /\.pdf(?:$|[?#])/i.test(h.url);
    picks.push({ url: h.url, title: h.title, source, rank: (source.from === 'maker' ? 0 : 2) + (pdf ? 0 : 1) });
  }
  return { picks: picks.sort((a, b) => a.rank - b.rank).map(({ rank: _r, ...p }) => p), skipped };
}

/** PDF links on a page (absolute), on the same allowed sources only. */
export function pdfLinks(html: string, base: string, d: Device): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"'#]+\.pdf(?:\?[^"']*)?)["']/gi)) {
    try {
      const u = new URL(m[1]!.replace(/&amp;/g, '&'), base).href;
      const s = sourceOf(u, d).from;
      if ((s === 'maker' || s === 'archive') && !out.includes(u)) out.push(u);
    } catch {
      /* not an address */
    }
  }
  return out;
}

/**
 * Does this robots.txt let a robot read `path`? The `User-agent: *` group, the longest matching Allow/Disallow rule
 * winning (`*` and `$` understood), Allow winning a tie. A content signal saying `ai-input=no` forbids it too.
 */
export function robotsAllows(txt: string, path: string): boolean {
  const lines = String(txt ?? '').split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim());
  if (lines.some((l) => /^content-signal\s*:.*\bai-input\s*=\s*no\b/i.test(l))) return false;
  const rules: { allow: boolean; pat: string }[] = [];
  let agents: string[] = [];
  let inRules = false;
  for (const l of lines) {
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    if (key === 'user-agent') {
      if (inRules) agents = [];
      inRules = false;
      agents.push(m[2]!.trim());
    } else if (key === 'allow' || key === 'disallow') {
      inRules = true;
      if (agents.includes('*') && m[2]!.trim()) rules.push({ allow: key === 'allow', pat: m[2]!.trim() });
    }
  }
  let best: { allow: boolean; len: number } | null = null;
  for (const r of rules) {
    const re = new RegExp(`^${r.pat.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$|\$$/, '$')}`);
    if (!re.test(path)) continue;
    if (!best || r.pat.length > best.len || (r.pat.length === best.len && r.allow)) best = { allow: r.allow, len: r.pat.length };
  }
  return best ? best.allow : true;
}

export interface GadgetRecord {
  id: string;
  /** "Bosch dishwasher SMS24AW01G". */
  name: string;
  make: string;
  model: string;
  kind: string;
  /** The library document on the GADGETS shelf. */
  doc: string;
  url: string;
  host: string;
  from: 'maker' | 'archive';
  /** Where it came from and its licence, word for word as the owner sees them. */
  source: string;
  licence: string;
  pages: number;
  /** The model number was found in the manual's own text (a manual can cover a whole range). */
  modelSeen: boolean;
  at: number;
}

export async function loadGadgets(storage: DurableObjectStorage): Promise<GadgetRecord[]> {
  return ((await storage.get<GadgetRecord[]>(GADGETS_KEY)) ?? []).filter((g) => g && g.doc);
}

export interface ManualDeps {
  storage: DurableObjectStorage;
  library: Library | null;
  /** A web search → the helper's text ("1. title\nurl\nsnippet"). */
  search: (query: string) => Promise<string>;
  fetch?: typeof fetch;
  progress?: (label: string, done?: number, total?: number) => void;
  now?: () => number;
}

async function get(f: typeof fetch, url: string, ms: number): Promise<Response | null> {
  try {
    const r = await f(url, { headers: { 'User-Agent': UA, Accept: 'application/pdf,text/html;q=0.9,*/*;q=0.5', 'Accept-Language': 'en-GB,en;q=0.8' }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

/** The whole body up to `max` bytes (null when it is bigger). */
async function bytesOf(r: Response, max: number): Promise<Uint8Array | null> {
  if (Number(r.headers.get('content-length') ?? 0) > max || !r.body) return null;
  const reader = r.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      reader.cancel().catch(() => undefined);
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** May a robot read this address? (robots.txt read once per host per errand; unreadable counts as no rules.) */
async function robotsOk(f: typeof fetch, url: string, seen: Map<string, string>): Promise<boolean> {
  const u = new URL(url);
  if (!seen.has(u.origin)) {
    const r = await get(f, `${u.origin}/robots.txt`, 5000);
    seen.set(u.origin, r ? (await r.text().catch(() => '')).slice(0, 100_000) : '');
  }
  return robotsAllows(seen.get(u.origin)!, `${u.pathname}${u.search}`);
}

/** "FIND THE MANUAL": search, pick, read, file on the GADGETS shelf. Returns what to tell the owner (and the record when one was kept). */
export async function findManual(deps: ManualDeps, what: string): Promise<{ text: string; record?: GadgetRecord }> {
  const lib = deps.library;
  if (!lib) return { text: 'Manuals are kept in the library, which needs Ghosty’s own storage: it is not available here.' };
  const d = parseDevice(what);
  if (!d.model) return { text: `I need the model number to find the right manual: it is on the rating plate (inside the door, on the back or underneath; often after "E-Nr", "Model" or "Type"). Photograph it in Lens READ, or type it, and ask again.` };
  const name = deviceName(d);
  const have = (await loadGadgets(deps.storage)).find((g) => g.model === d.model && lib.doc(g.doc));
  if (have) return { text: `The manual for the ${have.name} is already on the GADGETS shelf in the library ("${lib.doc(have.doc)?.title}", ${have.pages} pages, ${have.source}). Ask about it ("my ${have.kind || 'gadget'} shows E24").`, record: have };
  const f = deps.fetch ?? fetch;
  const queries = [`${d.make} ${d.model} ${d.kind} user manual pdf`.replace(/\s+/g, ' ').trim(), `${d.model} manual pdf${d.maker ? ` site:${MAKERS[d.maker]!.hosts[0]}` : ''}`];
  const hits: { title: string; url: string }[] = [];
  for (const [i, q] of queries.entries()) {
    deps.progress?.(i ? "searching the maker's site…" : 'searching for the manual…');
    for (const h of await deps.search(q).then(parseHitList).catch(() => [])) if (!hits.some((x) => x.url === h.url)) hits.push(h);
    if (pickManual(hits, d).picks.some((p) => p.source.from === 'maker' && /\.pdf(?:$|[?#])/i.test(p.url))) break;
  }
  const { picks, skipped } = pickManual(hits, d);
  const robots = new Map<string, string>();
  const tried: string[] = [];
  // up to four tries: a PDF directly, or a maker's page whose PDF links are read
  const queue: ManualPick[] = picks.slice(0, 4);
  for (let i = 0; i < queue.length && tried.length < 6; i++) {
    const p = queue[i]!;
    if (!(await robotsOk(f, p.url, robots))) {
      skipped.push({ url: p.url, why: `${hostOf(p.url)}'s robots.txt does not allow robots to read it` });
      continue;
    }
    tried.push(p.url);
    deps.progress?.(`reading ${hostOf(p.url)}…`);
    const r = await get(f, p.url, 20_000);
    if (!r) continue;
    const type = r.headers.get('content-type') ?? '';
    if (/html/i.test(type)) {
      const html = (await r.text().catch(() => '')).slice(0, 600_000);
      for (const u of pdfLinks(html, p.url, d).slice(0, 3)) if (!queue.some((x) => x.url === u)) queue.push({ url: u, title: p.title, source: sourceOf(u, d) });
      continue;
    }
    const bytes = await bytesOf(r, MAX_PDF_BYTES);
    if (!bytes) {
      skipped.push({ url: p.url, why: `bigger than ${MAX_PDF_BYTES / 1e6} MB` });
      continue;
    }
    let pdf: Awaited<ReturnType<typeof extractPdf>>;
    try {
      pdf = await extractPdf(bytes, `${name} manual`);
    } catch {
      skipped.push({ url: p.url, why: 'not a PDF that could be read' });
      continue;
    }
    const pages = pdf.pages.slice(0, MAX_PAGES);
    if (pages.join('').replace(/\s/g, '').length < 200) {
      skipped.push({ url: p.url, why: pdf.warning ?? 'almost no text in it (a scanned manual)' });
      continue;
    }
    const all = pages.join('\n').toUpperCase().replace(/\s+/g, '');
    const modelSeen = all.includes(d.model.replace(/\s+/g, ''));
    const source = `from ${p.source.name} (${hostOf(p.url)})`;
    const title = `${name} — manual`;
    deps.progress?.('filing it on the GADGETS shelf…');
    const doc = lib.createDoc({ title, source: `${p.url} · ${p.source.licence ?? ''}`.slice(0, 500), kind: 'manual', pages: pages.length });
    const passages = pages.flatMap((t, n) => chunkText(t, { heading: `Page ${n + 1}` }).map((x) => ({ ...x, heading: `Page ${n + 1}`, page: n + 1 })));
    for (let j = 0; j < passages.length; j += 40) await lib.addPassages(doc.id, passages.slice(j, j + 40));
    lib.finish(doc.id);
    const record: GadgetRecord = { id: d.model.toLowerCase().replace(/[^a-z0-9]/g, ''), name, make: d.make, model: d.model, kind: d.kind, doc: doc.id, url: p.url, host: hostOf(p.url), from: p.source.from as 'maker' | 'archive', source, licence: p.source.licence ?? '', pages: pages.length, modelSeen, at: (deps.now ?? Date.now)() };
    const list = (await loadGadgets(deps.storage)).filter((g) => g.id !== record.id);
    await deps.storage.put(GADGETS_KEY, [record, ...list].slice(0, MAX_GADGETS));
    const lines = [
      `Found the manual for the ${name} ${source} and kept it in the library on the GADGETS shelf: "${title}", ${pages.length} page${pages.length === 1 ? '' : 's'}${pdf.pages.length > pages.length ? ` (the first ${MAX_PAGES} of ${pdf.pages.length})` : ''}.`,
      `Source: ${p.url}`,
      `Licence: ${p.source.licence}.`,
      modelSeen ? `The model number ${d.model} is in it.` : `The model number ${d.model} is not printed in it: it may be the manual for the whole range; check the model list on its first pages.`,
      skipped.length ? `Not used: ${skipped.slice(0, 4).map((s) => `${hostOf(s.url)} (${s.why})`).join('; ')}.` : '',
      `Ask about it any time: "my ${d.kind || 'gadget'} shows E24" answers from its pages.`,
    ];
    return { text: lines.filter(Boolean).join('\n'), record };
  }
  return {
    text: [
      `I could not find a manual for the ${name} that I may use: only the maker's own site or an archive that allows it, never a site that forbids it.`,
      skipped.length ? `Skipped: ${skipped.slice(0, 5).map((s) => `${hostOf(s.url)} (${s.why})`).join('; ')}.` : 'The search found nothing from the maker.',
      d.maker ? `${MAKERS[d.maker]!.name}'s own support site has a manual search by model number: ${MAKERS[d.maker]!.hosts[0]}.` : '',
      'A PDF the owner downloads can be added in the Library tab.',
    ].filter(Boolean).join('\n'),
  };
}

/** Fault codes in the owner's words: "E24", "E:24", "E 24", "error 24", "F21", "H20". Normalised ("E24"). */
export function faultCodes(text: string): string[] {
  const out: string[] = [];
  for (const m of String(text ?? '').matchAll(/\b([A-Z]{1,2})\s?[:\-.]?\s?(\d{1,3})\b/gi)) {
    const c = `${m[1]!.toUpperCase()}${m[2]}`;
    if (/^(PAGE|NO|P|PG)\d/.test(c) || /^(AM|PM|MM|CM|KG|KW|HZ|V|W|C)\d/i.test(c)) continue;
    if (!out.includes(c)) out.push(c);
  }
  for (const m of String(text ?? '').matchAll(/\b(?:error|fault|code)\s*(?:code\s*)?(\d{1,3})\b/gi)) if (!out.includes(m[1]!)) out.push(m[1]!);
  return out.slice(0, 3);
}

/** Does a page's text mention this code (any of the ways a manual prints it)? */
export function mentions(text: string, code: string): boolean {
  const m = code.match(/^([A-Z]{0,2})(\d+)$/);
  if (!m) return false;
  const re = m[1] ? new RegExp(`\\b${m[1]}\\s?[:\\-.]?\\s?0*${m[2]}\\b`, 'i') : new RegExp(`\\b(?:error|fault|code)\\s*0*${m[2]}\\b`, 'i');
  return re.test(text);
}

const STOP = new Set('a an and are as at be but by can do does for from has have how i if in is it its me my of on or our shows showing so that the then there this to was what when where which why will with won wont doesnt isnt keeps keep it'.split(' '));
const keyWords = (s: string) => [...new Set(String(s ?? '').toLowerCase().match(/[a-z]{3,}/g) ?? [])].filter((w) => !STOP.has(w));

/** Which kept gadget the owner means: its model number, then what it is, then the make; the newest otherwise. */
export function whichGadget(list: GadgetRecord[], text: string): GadgetRecord | null {
  if (!list.length) return null;
  const t = String(text ?? '').toLowerCase();
  const up = t.toUpperCase().replace(/\s+/g, '');
  return list.find((g) => up.includes(g.model.replace(/\s+/g, ''))) ?? list.find((g) => g.kind && new RegExp(`\\b${g.kind.toLowerCase()}s?\\b`).test(t)) ?? list.find((g) => g.make && t.includes(g.make.toLowerCase())) ?? list[0]!;
}

/** Affiliate and tracking parameters taken off every link (and Amazon's /ref=… path tail). */
export function cleanLink(url: string): string {
  try {
    const u = new URL(url);
    for (const k of [...u.searchParams.keys()]) if (/^(tag|ref|ref_|aff\w*|affiliate\w*|utm_\w+|clickref|irclickid|irgwc|awc|cjevent|cjdata|gclid|fbclid|msclkid|mkevt|mkcid|mkrid|campid|customid|toolid|ascsubtag|linkcode|linkid|camp|creative|creativeasin|psc|smid|th|sr|qid|keywords|partner\w*|sub_?id\w*)$/i.test(k)) u.searchParams.delete(k);
    u.pathname = u.pathname.replace(/\/ref=[^/]*$/i, '');
    return u.href;
  } catch {
    return url;
  }
}

/**
 * "My dishwasher shows E24": the manual's own pages first (the page that mentions the code, else the pages that share
 * the most words with the question), said as "from the manual, page n"; when the manual is silent, a web search said
 * as "from the web, not the manual".
 */
export async function askManual(deps: ManualDeps, question: string): Promise<{ text: string; pages: number[]; from: 'manual' | 'web' | 'none' }> {
  const lib = deps.library;
  const list = await loadGadgets(deps.storage);
  const g = lib ? whichGadget(list.filter((x) => lib.doc(x.doc)), question) : null;
  if (!lib || !g) return { text: 'No manual is kept yet. Say "find the manual for my <make> <what it is> <model number>" (the model number is on the rating plate) and I will look for the maker\'s own.', pages: [], from: 'none' };
  const codes = faultCodes(question);
  const words = keyWords(question).filter((w) => !g.kind.toLowerCase().split(' ').includes(w) && w !== g.make.toLowerCase());
  const hits: { page: number; text: string; score: number }[] = [];
  let after = 0;
  for (let guard = 0; guard < 20; guard++) {
    const r = lib.passagesOf(g.doc, after, 300);
    for (const p of r.passages) {
      const lower = p.text.toLowerCase();
      const coded = codes.some((c) => mentions(p.text, c));
      const shared = words.filter((w) => lower.includes(w)).length;
      const score = coded ? 100 + shared : codes.length ? 0 : shared;
      if (score >= (codes.length ? 100 : Math.min(2, words.length)) && score > 0) hits.push({ page: p.page ?? 0, text: p.text, score });
    }
    if (r.next === null) break;
    after = r.next;
  }
  hits.sort((a, b) => b.score - a.score || a.page - b.page);
  const best = hits.filter((h, i) => hits.findIndex((x) => x.page === h.page) === i).slice(0, 2);
  if (best.length) {
    const pages = best.map((b) => b.page).filter(Boolean);
    return {
      from: 'manual',
      pages,
      text: [
        `From the manual, page ${pages.join(' and ')} (${g.name}, ${g.source}). Give the owner these steps in the manual's own order and say the page${pages.length > 1 ? 's' : ''}:`,
        ...best.map((b) => `--- page ${b.page} ---\n${b.text.slice(0, 1600)}`),
        `Manual: ${g.url}`,
      ].join('\n'),
    };
  }
  const what = codes.length ? `${codes.join(' / ')} ${g.kind ? `${g.kind} ` : ''}error code` : question.replace(/\s+/g, ' ').trim().slice(0, 80);
  deps.progress?.('the manual is silent: searching the web…');
  const web = await deps.search(`${g.make} ${g.model} ${what}`.replace(/\s+/g, ' ').trim()).then(parseHitList).catch(() => []);
  const silent = `The manual for the ${g.name} does not mention ${codes.length ? codes.join(' or ') : 'that'} (all ${g.pages} pages looked through).`;
  if (!web.length) return { from: 'none', pages: [], text: `${silent} A web search found nothing either: say so, and suggest ${g.make || 'the maker'}'s support line.` };
  return {
    from: 'web',
    pages: [],
    text: [`${silent} From the web, not the manual: say exactly that, name each site, and that it is not ${g.make || 'the maker'}'s word.`, ...web.slice(0, 4).map((h, i) => `${i + 1}. ${h.title} (${hostOf(h.url)})\n${cleanLink(h.url)}\n${h.text}`)].join('\n'),
  };
}

/**
 * REPLACEMENT PARTS: a search for the exact part name with this gadget's make and model → plain links, in the order the
 * search gave them (no shop favoured), affiliate tags taken off, and never a purchase.
 */
export async function partLinks(deps: Pick<ManualDeps, 'search' | 'storage' | 'progress'>, a: { part: string; device?: string }): Promise<{ text: string; links: string[] }> {
  const part = String(a.part ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!part) return { text: 'Say which part: its exact name as the manual prints it (e.g. "drain pump", "filter combination").', links: [] };
  const list = await loadGadgets(deps.storage).catch(() => []);
  const g = whichGadget(list, `${a.device ?? ''} ${part}`);
  const d = a.device ? parseDevice(a.device) : null;
  const who = d && (d.model || d.make) ? `${d.make} ${d.model}`.trim() : g ? `${g.make} ${g.model}`.trim() : '';
  deps.progress?.('searching for the part…');
  const hits = await deps.search(`"${part}" ${who} replacement part`.trim()).then(parseHitList).catch(() => []);
  if (!hits.length) return { text: `The search found nothing for "${part}"${who ? ` for the ${who}` : ''}. Suggest the part number printed in the manual's parts list or on the old part.`, links: [] };
  const links = hits.slice(0, 6).map((h) => cleanLink(h.url));
  return {
    links,
    text: [
      `Replacement part search for "${part}"${who ? ` (${who})` : ''}: links in the order the search gave them. No shop is favoured, no link carries an affiliate tag, and Ghosty never buys anything. Check the part number against the manual or the old part before ordering; find_part reads UK shops' prices.`,
      ...hits.slice(0, 6).map((h, i) => `${i + 1}. ${h.title} (${hostOf(h.url)})\n${links[i]}`),
    ].join('\n'),
  };
}
