/**
 * The curriculum: what Ghosty studies on its own, domain by domain, each topic naming a real,
 * free source (study.ts resolves it: Wikipedia, Wikibooks, Wikiversity, MDN, arXiv, The Swift
 * Programming Language, OpenStax). Topics run from basics (level 1) to advanced (level 3).
 * Compact on purpose — one string per domain, split at runtime — so the Worker bundle stays
 * small however many thousand topics there are.
 *
 * Format of a domain's `t` string: one topic per line, `level|kind|title`, where kind is one
 * of wiki, wikibooks, wikiversity, mdn, arxiv, swift, openstax (openstax titles are the book
 * page path, e.g. /books/psychology-2e/pages/2-1-why-is-research-important), or wikipage (an
 * exact Wikipedia article title, read without a search: the topics a field's Wikipedia outline
 * adds, outlines.ts and study.ts `growField`, kept in the brain's storage in this same format).
 */
import { DOMAIN_TEXT } from './domains';

export type SourceKind = 'wiki' | 'wikibooks' | 'wikiversity' | 'mdn' | 'arxiv' | 'swift' | 'openstax' | 'gutenberg' | 'wikipage';
export interface Topic {
  /** The source title (an article title, an MDN page, a search phrase for arXiv, a Swift book page, an OpenStax page path, a Gutenberg book number then its title). */
  t: string;
  /** 1 basics, 2 intermediate, 3 advanced. */
  l: 1 | 2 | 3;
  k: SourceKind;
}
export interface Domain {
  id: string;
  name: string;
  /** One sentence on why it matters. */
  why: string;
  topics: Topic[];
}

const KINDS = new Set<string>(['wiki', 'wikibooks', 'wikiversity', 'mdn', 'arxiv', 'swift', 'openstax', 'gutenberg', 'wikipage']);

/** `level|kind|title` lines → topics (bad lines are skipped). */
export function parseTopics(text: string): Topic[] {
  const out: Topic[] = [];
  for (const line of text.split('\n')) {
    const s = line.trim();
    if (!s) continue;
    const m = s.match(/^([123])\|([a-z]+)\|(.+)$/);
    if (!m || !KINDS.has(m[2]!)) continue;
    out.push({ t: m[3]!.trim(), l: Number(m[1]) as 1 | 2 | 3, k: m[2] as SourceKind });
  }
  return out;
}

/** Every domain, in the order they are studied round-robin. */
export const DOMAINS: Domain[] = DOMAIN_TEXT.map((d) => ({ id: d.id, name: d.name, why: d.why, topics: parseTopics(d.t) }));

export const TOPIC_COUNT = DOMAINS.reduce((n, d) => n + d.topics.length, 0);

export const domainById = (id: string): Domain | undefined => DOMAINS.find((d) => d.id === id);
