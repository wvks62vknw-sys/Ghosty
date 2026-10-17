/**
 * Cited answers: when the owner wants facts they can rely on (CITED on in the chat, or "with
 * sources", "cite", "fact check", "is it true that…"), Ghosty must look things up first, answer
 * with numbered [n] markers and end with a SOURCES list. Afterwards every claim is checked
 * against what it actually read in this turn — one cheap model call, or matching words when no
 * model is free — and a number that points at nothing it read is flagged, never passed off as a
 * source. Nothing here runs on an ordinary turn.
 */
import type { ChatEvent, Citation, CitedInfo, ClaimCheck } from '../../../packages/shared/src/protocol';
import { asData } from './kernel/permissions';
import type { Msg } from './llm/router';
import type { LookedUp } from './tools/types';

/** The owner's words that make a turn a cited one (the composer's CITED toggle does it too). */
export const CITED_ASK = /\b(?:with (?:sources|citations|references)|cite|citations?|fact[- ]?check(?:ing)?|is it (?:really )?true that)\b/i;
export const citedAsked = (text: string): boolean => CITED_ASK.test(text);

/** Added to the system prompt on cited turns only (the plain prompt stays as it is). */
export const CITED_PROMPT =
  '\n\nCITED ANSWER (the owner wants facts they can rely on): look it up before answering — library_search and/or web_search, then web_fetch the 1–3 best pages. Put [1], [2]… after each fact, numbered by source. End with a list headed SOURCES, one line per source: [n] title — full URL (or the library document\'s title). Cite only what you searched or read in this turn; never invent a source, a number or a quote. If the sources disagree or say nothing, say so.';

/** Something read in this turn: a web page or search result (`url`), or a library passage (`doc`: its document's title). */
export type Source = LookedUp;

/** What one tool call recorded it read (ToolContext.found), with the call's id. */
export interface Read {
  call: string;
  source: Source;
}

/** A line of the answer's own SOURCES list. */
export interface Listed {
  n: number;
  title: string;
  url?: string;
}

/** At most this many claims are checked (the longest answers keep the ones with markers first). */
const MAX_CLAIMS = 8;
/** What the checking model reads of all the sources together. */
const CHECK_CHARS = 8000;

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.slice(0, 60);
  }
}

/** One address in one spelling: no scheme, "www.", fragment or trailing slash; the host in lower case. */
export function sameUrl(url: string): string {
  const u = url.trim().replace(/#.*$/, '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
  const i = u.indexOf('/');
  return i < 0 ? u.toLowerCase() : u.slice(0, i).toLowerCase() + u.slice(i);
}

/**
 * Everything looked up since the owner's last message: the records the lookups themselves made
 * as they ran (pages fetched, search results, library passages), in the order the model asked
 * for them. Never re-read from the tool results' text: a page or passage could dress its own
 * words up as another result with any address. The same address twice (found by a search, then
 * read) is one source with both texts.
 */
export function turnSources(ctx: Msg[], read: Read[]): Source[] {
  let from = ctx.length - 1;
  while (from > 0 && ctx[from]!.role !== 'user') from--;
  const order: string[] = [];
  for (const m of ctx.slice(Math.max(0, from))) if (m.role === 'assistant') for (const c of m.tool_calls ?? []) order.push(c.id);
  const found = read
    .map((r, i) => ({ ...r, at: order.indexOf(r.call), i }))
    .filter((r) => r.at >= 0)
    .sort((x, y) => x.at - y.at || x.i - y.i)
    .map((r) => r.source);
  const out: Source[] = [];
  for (const s of found) {
    const twin = s.url ? out.find((o) => o.url && sameUrl(o.url) === sameUrl(s.url!)) : out.find((o) => o.kind === 'library' && o.title === s.title);
    if (!twin) out.push({ ...s });
    else {
      if (!twin.text.includes(s.text)) twin.text = `${twin.text}\n${s.text}`.trim();
      if (s.kind === 'web' && twin.title === host(twin.url ?? '')) twin.title = s.title;
    }
  }
  return out;
}

/** Where the answer's own list of sources begins: a line saying just "Sources" (in any common dress). */
const SOURCES_HEAD = /^[ \t]*(?:#{1,4}[ \t]*)?(?:\*\*|__)?(?:sources|references)(?:\*\*|__)?[ \t]*:?[ \t]*(?:\*\*|__)?[ \t]*$/gim;
const LIST_LINE = /^\s*(?:[-*•]\s*)?\[?(\d{1,2})[\].)]?\s*[:.\-–—]?\s+(.*)$/;

/** The answer's words and its SOURCES list, apart. Lines after the list that aren't sources go back to the words. */
export function splitAnswer(text: string): { body: string; listed: Listed[] } {
  const heads = [...text.matchAll(SOURCES_HEAD)];
  const head = heads[heads.length - 1];
  if (!head) return { body: text.trim(), listed: [] };
  const body = text.slice(0, head.index).trim();
  const listed: Listed[] = [];
  const rest: string[] = [];
  for (const line of text.slice(head.index! + head[0].length).split('\n')) {
    if (!line.trim()) continue;
    const m = line.match(LIST_LINE);
    if (!m) {
      rest.push(line.trim());
      continue;
    }
    const md = m[2]!.match(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/);
    const raw = md?.[2] ?? m[2]!.match(/https?:\/\/[^\s<>)\]]+/)?.[0];
    const url = raw?.replace(/[.,;:!?]+$/, '');
    const title = (md ? m[2]!.replace(md[0], md[1]!) : m[2]!)
      .replace(raw ?? '\u0000', '')
      .replace(/[*_`<>()]/g, '')
      .replace(/[\s.,;]*[—–:|-]?[\s.,;]*$/, '')
      .replace(/^\s*[—–:|-]\s*/, '')
      .trim();
    if (!listed.some((l) => l.n === Number(m[1]))) listed.push({ n: Number(m[1]), title: title || (url ? host(url) : ''), ...(url ? { url } : {}) });
  }
  return { body: [body, ...rest].join('\n\n').trim(), listed };
}

const MARKER = /\[(\d{1,2}(?:\s*[,–-]\s*\d{1,2})*)\](?!\()/g;

/** The numbers in one marker: "1", "1, 3", "2–4". */
function numbersIn(inside: string): number[] {
  const out: number[] = [];
  for (const part of inside.split(',')) {
    const [a, b] = part.split(/[–-]/).map((x) => Number(x.trim()));
    if (b !== undefined && b >= a! && b - a! < 10) for (let k = a!; k <= b; k++) out.push(k);
    else out.push(a!);
  }
  return out.filter((n) => n > 0);
}

/** The source numbers an answer (or one claim) points at, in order, once each. */
export function markersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(MARKER)) for (const n of numbersIn(m[1]!)) if (!out.includes(n)) out.push(n);
  return out;
}

/** A name in one spelling: lower case, words only. */
const plainName = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * A listed line with an address matches the source with that address. One without names a
 * library document, and must name it exactly (its title, or its title with the passage's
 * heading); a web page is never matched by its title, which is often just "Home" or "News".
 */
function findSource(l: Listed, sources: Source[]): Source | undefined {
  if (l.url) return sources.find((s) => s.url && sameUrl(s.url) === sameUrl(l.url!));
  const name = plainName(l.title);
  const bare = plainName(l.title.replace(/[\s(—–:|-]*(?:your\s+)?library\)?\s*$/i, ''));
  if (!name) return undefined;
  return sources.find((s) => s.kind === 'library' && [s.doc ?? '', s.title].map(plainName).some((n) => n && (n === name || n === bare)));
}

/**
 * Each number the answer uses or lists, matched to something read in this turn. A number with no
 * line in the list, or a line naming something never looked up, is kept but flagged `missing`.
 */
export function matchCitations(body: string, listed: Listed[], sources: Source[]): { citations: Citation[]; picked: Map<number, Source> } {
  const ns = [...new Set([...markersIn(body), ...listed.map((l) => l.n)])].sort((a, b) => a - b);
  const picked = new Map<number, Source>();
  const citations = ns.map((n): Citation => {
    const l = listed.find((x) => x.n === n);
    if (!l) return { n, title: 'no source was listed for this number', missing: true };
    const s = findSource(l, sources);
    if (!s) return { n, title: l.title || 'unnamed source', ...(l.url ? { url: l.url } : {}), missing: true };
    picked.set(n, s);
    return { n, title: l.title || s.title, ...(s.url ? { url: s.url } : { doc: s.doc ?? s.title }) };
  });
  return { citations, picked };
}

const SENTENCE_END = /(?<=[.!?](?:\[\d{1,2}(?:\s*[,–-]\s*\d{1,2})*\])*)\s+(?=[A-Z0-9"“‘([])/;

/**
 * The answer's claims: its sentences and list items worth checking (four words or more, not a
 * question or a heading), each exactly as written so the phone can mark it. Those with markers
 * come first when there are more than eight.
 */
export function splitClaims(body: string, max = MAX_CLAIMS): string[] {
  const all: string[] = [];
  for (const line of body.split('\n')) {
    const l = line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
    if (!l || /^(#|\||>|```)/.test(l)) continue;
    for (const raw of l.split(SENTENCE_END)) {
      const s = raw.trim();
      const plain = s.replace(MARKER, '').replace(/[*_`]/g, '').trim();
      if (plain.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length < 4 || /[?:]$/.test(plain)) continue;
      if (!all.includes(s)) all.push(s);
    }
  }
  const marked = (c: string) => (markersIn(c).length ? 0 : 1);
  return all
    .map((c, i) => ({ c, i }))
    .sort((a, b) => marked(a.c) - marked(b.c) || a.i - b.i)
    .slice(0, max)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.c);
}

const STOP = new Set('about above after also among and another are because been before being between both but can could does each from have having here into its itself just more most much must only other over same should since some such than that their them then there these they this those through under until very were what when where which while will with within without would your'.split(' '));

/** The telling words of a text, lower case, numbers without their thousands commas ("299,792,458" → "299792458"). */
export function keyTerms(text: string): string[] {
  return text
    .replace(MARKER, ' ')
    .toLowerCase()
    .replace(/(\d)[,   ](?=\d{3}\b)/g, '$1')
    .split(/[^a-z0-9]+/)
    .filter((w) => /^\d+$/.test(w) || (w.length >= 4 && !STOP.has(w)));
}

/** Words that turn a statement round: matching words cannot tell "does" from "does not". */
const NEGATION = /\b(?:not|no|never|none|nobody|nothing|neither|nor|cannot|without|(?:is|are|was|were|does|do|did|wo|ca|could|should|would|has|have|had)n't|false|untrue|myth|disproven|debunked)\b/i;
const negated = (t: string) => NEGATION.test(t.replace(/[’‘]/g, "'").replace(MARKER, ' '));
/** Words that say which way something goes: a claim and the sentence backing it must use the same ones. */
const DIRECTION = /\b(?:more|less|fewer|most|least|higher|lower|larger|smaller|bigger|increas\w*|decreas\w*|reduc\w*|rais\w*|ris(?:e|es|ing)|fall(?:s|ing)?|before|after|above|below)\b/gi;
const direction = (t: string) => [...new Set((t.toLowerCase().match(DIRECTION) ?? []).map((w) => w.replace(/(?:e|es|ed|ing|s)$/, '')))].sort().join(' ');

/**
 * A claim checked without a model: most of its telling words, and every number in it, in one
 * sentence of a source that points the same way. A claim that negates is never passed this way
 * (nor is it backed by a sentence that negates): words alone cannot see which way it points, so
 * it stays not found rather than being marked as backed.
 */
export function wordCheck(claim: string, pool: { n?: number; text: string }[]): ClaimCheck {
  const want = [...new Set(keyTerms(claim))];
  const nums = want.filter((w) => /^\d+$/.test(w));
  if (want.length < 2 || negated(claim)) return { claim, status: 'not_found' };
  const dir = direction(claim);
  let best: { score: number; n?: number } = { score: 0 };
  for (const s of pool) {
    for (const part of s.text.split(/(?<=[.!?])\s+|\n+/)) {
      if (negated(part) || direction(part) !== dir) continue;
      const have = new Set(keyTerms(part));
      if (!nums.every((x) => have.has(x))) continue;
      const score = want.filter((w) => have.has(w)).length / want.length;
      if (score > best.score) best = { score, n: s.n };
    }
  }
  return best.score >= 0.6 ? { claim, status: 'supported', ...(best.n ? { source: best.n } : {}) } : { claim, status: 'not_found' };
}

/** The parts of a long source that bear on the claims, in their order, up to `max` characters. */
export function relevantText(text: string, claims: string[], max: number): string {
  if (text.length <= max) return text;
  const want = new Set(claims.flatMap(keyTerms));
  const parts = text.split(/(?<=[.!?])\s+|\n+/).filter((p) => p.trim());
  const scored = parts.map((p, i) => ({ p: p.trim(), i, s: keyTerms(p).filter((w) => want.has(w)).length })).filter((x) => x.s > 0);
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  const keep: typeof scored = [];
  let size = 0;
  for (const x of scored) {
    if (size + x.p.length + 3 > max) continue;
    keep.push(x);
    size += x.p.length + 3;
  }
  if (!keep.length) return text.slice(0, max);
  return keep
    .sort((a, b) => a.i - b.i)
    .map((x) => x.p)
    .join(' … ');
}

/** The one sentence of a source that best backs the claims citing it (shown when its chip is tapped). */
export function quoteFor(text: string, claims: string[]): string | undefined {
  const want = new Set(claims.flatMap(keyTerms));
  let best = { s: 0, p: '' };
  for (const p of text.split(/(?<=[.!?])\s+|\n+/)) {
    const s = keyTerms(p).filter((w) => want.has(w)).length;
    if (s > best.s) best = { s, p: p.trim() };
  }
  return best.s >= 2 ? (best.p.length > 220 ? `${best.p.slice(0, 217)}…` : best.p) : undefined;
}

/** The checking call: the claims, and the sources as data. */
export function checkMessages(claims: string[], pool: { title: string; text: string }[]): Msg[] {
  const each = Math.max(600, Math.floor(CHECK_CHARS / Math.max(1, pool.length)));
  const sources = pool.map((s, i) => `[${i + 1}] ${s.title}\n${relevantText(s.text, claims, each)}`).join('\n\n');
  return [
    {
      role: 'system',
      content:
        'CLAIM CHECK. For each numbered claim, say whether the source texts state it (the same fact; numbers must match). Judge only from the sources, never from what you know. Reply with ONLY JSON: {"checks":[{"i":1,"found":true,"source":2}]} — "found" is false when no source says it; "source" is the number of the source that does.',
    },
    { role: 'user', content: `CLAIMS:\n${claims.map((c, i) => `${i + 1}. ${c}`).join('\n')}\n\nSOURCES:\n${asData('the pages and passages looked up for this answer', sources)}` },
  ];
}

/** The checker's verdicts, claim by claim (null where it said nothing usable). */
export function parseChecks(raw: string, count: number): ({ found: boolean; source?: number } | null)[] {
  const out: ({ found: boolean; source?: number } | null)[] = Array.from({ length: count }, () => null);
  const t = raw.replace(/```(?:json)?/gi, '');
  let list: unknown = null;
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  try {
    if (a >= 0 && b > a) list = (JSON.parse(t.slice(a, b + 1)) as { checks?: unknown }).checks;
  } catch {
    /* maybe a bare list */
  }
  if (!Array.isArray(list)) {
    const c = t.indexOf('[');
    const d = t.lastIndexOf(']');
    try {
      if (c >= 0 && d > c) list = JSON.parse(t.slice(c, d + 1));
    } catch {
      return out;
    }
  }
  if (!Array.isArray(list)) return out;
  list.forEach((item, k) => {
    if (!item || typeof item !== 'object') return;
    const o = item as Record<string, unknown>;
    const i = typeof o.i === 'number' ? o.i - 1 : k;
    if (i < 0 || i >= count) return;
    const f = o.found ?? o.supported ?? o.status;
    const found = f === true || (typeof f === 'string' && /^(true|yes|found|supported|confirmed)$/i.test(f));
    const no = f === false || (typeof f === 'string' && /^(false|no|not[_ ]found|unsupported|unconfirmed)$/i.test(f));
    if (!found && !no) return;
    out[i] = { found, ...(typeof o.source === 'number' ? { source: o.source } : {}) };
  });
  return out;
}

/** "✓ 5 of 6 claims found in the sources" — the line under a cited answer. */
export function checkLine(checks: ClaimCheck[]): string {
  const ok = checks.filter((c) => c.status === 'supported').length;
  return `${ok ? '✓' : '✕'} ${ok} of ${checks.length} claim${checks.length === 1 ? '' : 's'} found in the sources`;
}

/** The answer as sent (chat, Telegram, history): its words, the SOURCES list as plain lines with links, the check line. */
export function renderCited(body: string, citations: Citation[], line: string): string {
  const list = citations.map((c) => `[${c.n}] ${c.title}${c.url ? ` — ${c.url}` : c.doc ? ' — your library' : ''}${c.missing ? ' (never looked up: not a checked source)' : ''}`);
  return [body, list.length ? `SOURCES\n${list.join('\n')}` : '', line].filter(Boolean).join('\n\n');
}

/**
 * A cited turn's final answer, finished: sources matched, claims checked (`complete`: one cheap
 * model call, skipped when nothing was looked up; any failure falls back to matching words).
 */
export async function citeAnswer(text: string, ctx: Msg[], read: Read[], complete: (m: Msg[]) => Promise<string>, emit: (ev: ChatEvent) => void): Promise<{ text: string; info: CitedInfo }> {
  const sources = turnSources(ctx, read);
  const { body, listed } = splitAnswer(text);
  const { citations, picked } = matchCitations(body, listed, sources);
  const claims = splitClaims(body);
  // What the claims are checked against: the sources the answer cites, else everything read this turn.
  const pool: { n?: number; title: string; text: string }[] = picked.size ? [...picked].map(([n, s]) => ({ n, title: s.title, text: s.text })) : sources.slice(0, 4).map((s) => ({ title: s.title, text: s.text }));
  let verdicts: ({ found: boolean; source?: number } | null)[] = claims.map(() => null);
  if (claims.length && pool.length) {
    emit({ t: 'status', text: 'checking each claim against the sources…' });
    try {
      verdicts = parseChecks(await complete(checkMessages(claims, pool)), claims.length);
    } catch {
      /* no model free: matching words below */
    }
  }
  const checks = claims.map((claim, i): ClaimCheck => {
    const v = verdicts[i];
    if (!v) return pool.length ? wordCheck(claim, pool) : { claim, status: 'not_found' };
    const by = v.found && v.source ? pool[v.source - 1]?.n : undefined;
    return v.found ? { claim, status: 'supported', ...(by ? { source: by } : {}) } : { claim, status: 'not_found' };
  });
  for (const c of citations) {
    const s = picked.get(c.n);
    if (!s) continue;
    const backing = claims.filter((k) => markersIn(k).includes(c.n));
    const quote = quoteFor(s.text, backing.length ? backing : claims);
    if (quote) c.quote = quote;
  }
  const line = !sources.length ? 'I could not look anything up for this, so none of it is checked against a source.' : checks.length ? checkLine(checks) : '';
  return { text: renderCited(body, citations, line), info: { citations, checks } };
}
