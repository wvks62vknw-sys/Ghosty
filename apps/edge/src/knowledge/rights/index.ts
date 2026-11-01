/**
 * THE RIGHTS-AND-LAW BASE (BRIEF-REST-E part 3): documented human-rights and international-law topics, and his
 * practical rights in the UK, each document read on 1 November 2026 (types.ts says the rule). HOW IT IS USED: when his
 * question is about a topic, the brain gets the matching topics as the turn's data, with each document's tier (agent.ts
 * `recall`, the way the handbook's playbooks are read), and the turn is answered as a cited one: the documents count as
 * read this turn, so the answer's SOURCES list is checked against them (cited.ts). The Library opens a topic as a page
 * of its documents (apps/web/src/docs/rights.ts). Pure: no fetch, no model.
 */
import { tierOf, tierWord, type Tier } from '../../../../../packages/shared/src/sources';
import { CHECKED, type Contact, type RightsDoc, type RightsTopic } from './types';
import { CONTACTS, UK_TOPICS } from './uk';
import { WORLD_TOPICS } from './world';

export { CHECKED, CONTACTS };
export type { Contact, RightsDoc, RightsTopic };

export const RIGHTS: RightsTopic[] = [...UK_TOPICS, ...WORLD_TOPICS];

/** The plain line every UK topic carries. */
export const NOT_ADVICE = 'Not legal advice: this is what the documents say. For your own case, here’s who to call.';

/** Every document, with its topic and its tier as the sourcing code labels it. */
export function rightsDocs(): (RightsDoc & { topic: string; tier: Tier })[] {
  return RIGHTS.flatMap((t) => t.docs.map((d) => ({ ...d, topic: t.id, tier: tierOf(d.url) })));
}

export const rightsTopic = (id: string): RightsTopic | null => RIGHTS.find((t) => t.id === id) ?? null;
export const contactsOf = (t: RightsTopic): Contact[] => (t.call ?? []).map((id) => CONTACTS.find((c) => c.id === id)).filter((c): c is Contact => !!c);

/**
 * The words that find a topic: a plain tag counts on its own; a tag written "~word" only when the question is about
 * rights or the law too ("can my landlord", "is it legal", "my rights"), so "my phone is broken" finds nothing. A topic
 * with an `about` list is found only when the question names its matter as well: "my landlord", "Gaza", "Epstein"; so
 * "pay my landlord on Friday", "is it genocide", "war crimes in Sudan", the cricket's ICC and Forza Horizon find none.
 */
const RIGHTS_WORDS = /\b(?:right|rights|legal|illegal|lawful|unlawful|law|laws|allowed|entitled|can (?:they|he|she|my|the|a|i|police|school)|do i have to|have to|must|complain|complaint|refund|sue|report|what happens|what can i do)\b/;
/**
 * Words that ask for writing or a job done ("write a letter to my landlord", "ring the landlord about the boiler",
 * "right, I need to send the invoice", "remind me to"), not a question about a topic: never a cited turn of this base.
 */
const NOT_A_QUESTION = /^(?:(?:right|ok|okay|so|also|and|then|hey|ghosty)[,.!]?\s+)*(?:(?:can|could|would) you |please |i need to |remember to |don[’']?t forget to )?(?:write|draft|compose|make|create|translate|summari[sz]e|rewrite|turn|remind|ring|call|phone|text|email|e-mail|message|book|buy|order|pay|send|add|note|put|set|schedule|save)\b|^DOCUMENT (?:EDIT|TRANSLATE)\b/i;
const plain = (w: string): string => w.replace(/^~/, '').replace(/[’']/g, '');

/** The topics his question is about, best first (none when it is not about one). */
export function findRights(text: string, max = 2): RightsTopic[] {
  if (!text || NOT_A_QUESTION.test(text.trim())) return [];
  const flat = ` ${text.toLowerCase().replace(/[’']/g, '').replace(/[^\p{L}\p{N}-]+/gu, ' ').replace(/\s+/g, ' ').trim()} `;
  const names = (w: string) => flat.includes(` ${plain(w)} `);
  const rightsy = RIGHTS_WORDS.test(flat);
  const scored = RIGHTS.map((t) => {
    let s = 0;
    if (t.about && !t.about.some(names)) return { t, s };
    for (const raw of t.tags) {
      const weak = raw.startsWith('~');
      if (!names(raw) || (weak && !rightsy)) continue;
      s += (weak ? 2 : 3) + plain(raw).split(' ').length - 1;
    }
    return { t, s };
  });
  return scored.filter((x) => x.s >= 3).sort((a, b) => b.s - a.s).slice(0, max).map((x) => x.t);
}

/** The documents of these topics as the turn's data: each numbered, with its tier, date, address and finding. */
export function rightsText(topics: RightsTopic[]): string {
  const out: string[] = [];
  let n = 0;
  for (const t of topics) {
    out.push(`TOPIC: ${t.title}${t.scope === 'uk' ? ' (the UK; England’s rules unless it says)' : ''}`);
    for (const d of t.docs) {
      n++;
      out.push(`[R${n}] ${d.title} — ${d.by}, ${d.dated} ${d.date} (${d.kind}; ${tierWord(tierOf(d.url))}) ${d.url}\nFinding: ${d.finding}`);
    }
    if (t.scope === 'uk') out.push(`${NOT_ADVICE} ${contactsOf(t).map((c) => `${c.name}: ${c.number}${c.hours ? ` (${c.hours})` : ''}`).join('; ')}.`);
  }
  return out.join('\n');
}

/** How the turn's data is introduced to the brain (on these turns only; never in the plain prompt). */
export const RIGHTS_HEAD =
  'FROM YOUR RIGHTS-AND-LAW BASE (looked up for this message: primary and credible documents, each read and dated, its tier given). Answer from them where they cover his question, looking further only for what they do not (anything newer), put [1], [2] and so on after each fact, numbered by document, and end with SOURCES listing each one you used as its title and address. Put every finding exactly as strongly as its document does: a court’s provisional order is not a judgment, an arrest warrant is not a conviction, a commission’s or an organisation’s finding is theirs. For his own UK problem, say plainly it is not legal advice and give who to call.';

/**
 * The documents as things read this turn (cited.ts counts them like pages fetched): a title, an address, the words, the
 * tier.
 */
export function rightsRead(topics: RightsTopic[]): { kind: 'web'; title: string; url: string; text: string; tier: Tier }[] {
  return topics.flatMap((t) => t.docs.map((d) => ({ kind: 'web' as const, title: d.title, url: d.url, text: `${d.title}. ${d.finding}`, tier: tierOf(d.url) })));
}
